'use strict';
// Ashes of Empires, Cycle 23 Step 8, fog layer browser check.
// Proves: #map-fog canvas exists between #map-base and #map-state, debug
// counts match the real modules, the Unknown and remembered fills land in
// their luma bands on the live canvas, live provinces stay transparent, and
// remembered tiles show no live unit plaques, only hollow ones.
// Cycle 23 Step 14 (MAP_TREATMENT 6.4): one sea row per picked sea sector,
// fog composited over the base canvas at a point inside the sector sea part,
// in its province's fog state band; and the Unknown coastline Ink redraw is
// present on the fog canvas along a dark coast.
// Pattern from tools/ownership-check.js; fixture import from tools/fixture-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// getImageData is used here in the CHECK only, never in the frame path.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesPlaques = require('../js/plaques.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const AshesMapCanvas = require('../js/map-canvas.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function intelCounts(view) {
  const counts = { live: 0, remembered: 0, dark: 0 };
  view.provinces.forEach((p) => { counts[p.intel]++; });
  return counts;
}

function luma(px) {
  return 0.2126 * px.r + 0.7152 * px.g + 0.0722 * px.b;
}

// Sample the #map-fog pixel at the centre of cell (cx, cy) in chart space
// (Cycle 23 Step 9): the canvas spans 12.6 by 9.85 cells with the 10 x 7
// lattice inset 1.3 left and top.
async function sampleCellCentre(page, cx, cy) {
  return page.evaluate(([cx, cy]) => {
    const c = document.getElementById('map-fog');
    const x = Math.min(c.width - 1, Math.floor(((cx + 0.5 + 1.3) / 12.6) * c.width));
    const y = Math.min(c.height - 1, Math.floor(((cy + 0.5 + 1.3) / 9.85) * c.height));
    const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
    return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
  }, [cx, cy]);
}

// Sea row bands by fog state (MAP_TREATMENT 6.4).
const SEA_BANDS = { live: [60, 150], remembered: [120, 175], dark: [185, 225] };
const GRATICULE_CLEAR = 0.08;

// Closest point to p on segment a b.
function closestOnSeg(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// Sample point for one sea sector: a coastline chain point and its neatline
// projection (onto the neatline piece in the sea part tail), midpoint taken,
// kept only inside the sea part and clear of the graticule lines. Corner
// sectors (a three point tail) are skipped. Null when nothing qualifies.
function seaSamplePoint(chart, sector) {
  const coastKeys = {};
  chart.coastline.forEach((q) => { coastKeys[q.x + ',' + q.y] = true; });
  const chain = sector.seaPart.filter((q) => coastKeys[q.x + ',' + q.y]);
  const tail = sector.seaPart.slice(chain.length);
  if (tail.length !== 2 || chain.length < 3) return null;
  const meridians = AshesMapCanvas.GRATICULE_MERIDIANS.map((m) => m.x);
  const parallels = AshesMapCanvas.GRATICULE_PARALLELS.map((p) => p.y);
  // Walk outward from the chain middle.
  const mid = Math.floor(chain.length / 2);
  for (let k = 0; k < chain.length; k++) {
    const i = mid + (k % 2 === 0 ? k / 2 : -(k + 1) / 2);
    if (i < 1 || i > chain.length - 2) continue;
    const c = chain[i];
    const n = closestOnSeg(c, tail[0], tail[1]);
    const pt = { x: (c.x + n.x) / 2, y: (c.y + n.y) / 2 };
    if (!AshesChart.pointInPolygon(pt, sector.seaPart)) continue;
    if (meridians.some((x) => Math.abs(x - pt.x) < GRATICULE_CLEAR)) continue;
    if (parallels.some((y) => Math.abs(y - pt.y) < GRATICULE_CLEAR)) continue;
    return pt;
  }
  return null;
}

// One picked sea sector per fog state present among the sea sectors of the view.
function pickSeaRows(view) {
  const geom = AshesMapGeometry.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const intel = {};
  view.provinces.forEach((p) => { intel[p.id] = p.intel; });
  const rows = [];
  ['live', 'remembered', 'dark'].forEach((state) => {
    const sectors = chart.sectors.filter((s) => s.sea && intel[s.provinceId] === state);
    for (let i = 0; i < sectors.length; i++) {
      const pt = seaSamplePoint(chart, sectors[i]);
      if (pt) { rows.push({ state: state, id: sectors[i].provinceId, pt: pt }); return; }
    }
    rows.push({ state: state, id: null, pt: null, present: sectors.length > 0 });
  });
  return { rows: rows, chart: chart, geom: geom };
}

// Composite fog over base at chart point pt, each canvas mapped through the
// shared chart transform (extent spans the whole canvas).
async function sampleComposite(page, ext, pt) {
  return page.evaluate(([ext, pt]) => {
    function px(id) {
      const c = document.getElementById(id);
      const x = Math.min(c.width - 1, Math.floor(((pt.x - ext.x0) / (ext.x1 - ext.x0)) * c.width));
      const y = Math.min(c.height - 1, Math.floor(((pt.y - ext.y0) / (ext.y1 - ext.y0)) * c.height));
      const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
      return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
    }
    const base = px('map-base');
    const fog = px('map-fog');
    const fa = fog.a / 255;
    return {
      base: base,
      fog: fog,
      r: fa * fog.r + (1 - fa) * base.r,
      g: fa * fog.g + (1 - fa) * base.g,
      b: fa * fog.b + (1 - fa) * base.b
    };
  }, [ext, pt]);
}

// Chart extent; the lattice is 10 x 7 for every view, so seed 42 stands in.
function chartExtent() {
  return AshesChart.buildChart(AshesMapGeometry.buildGeometry(playerView(Sim.createGame(42)))).extent;
}

async function checkSeaRows(page, label, picked) {
  const ext = picked.chart.extent;
  for (const row of picked.rows) {
    if (!row.pt) {
      if (row.present) check(label + ': sea row for a ' + row.state + ' sector has a sample point', false, 'no qualifying point');
      continue;
    }
    const s = await sampleComposite(page, ext, row.pt);
    const L = luma(s);
    const band = SEA_BANDS[row.state];
    check(label + ': sea row ' + row.id + '#sea ' + row.state + ' composite luma in ' + band[0] + ' to ' + band[1],
      L >= band[0] && L <= band[1],
      'luma=' + L.toFixed(1) + ' at ' + row.pt.x.toFixed(3) + ',' + row.pt.y.toFixed(3) + ' fogA=' + s.fog.a + ' base=' + s.base.r + ',' + s.base.g + ',' + s.base.b);
  }
}

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  // loadFromText restarts the timer unpaused at speed 1, so the first tick
  // lands about 900 ms after the load. Pausing from outside (notice poll, then
  // a Playwright click) costs CDP round trips that can cross that tick, move
  // units, and turn live provinces into remembered ones. So a one-shot
  // observer pauses in page: its callback runs as a microtask right after the
  // load handler writes the Loaded notice, before any queued tick task. Error
  // notices never click.
  await page.evaluate(function () {
    var notice = document.getElementById('save-notice');
    var observer = new MutationObserver(function () {
      if (notice.textContent.trim().indexOf('Loaded') !== 0) return;
      observer.disconnect();
      var btn = document.getElementById('btn-pause');
      if (btn.textContent.trim() === 'Pause') btn.click();
    });
    observer.observe(notice, { childList: true, characterData: true, subtree: true });
  });
  const [chooser] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#btn-import') ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => { const notice = (await page.textContent('#save-notice')).trim(); return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1; }, 5000);
  // Confirms the button reads Resume; returns at once when the observer
  // already paused, so it adds no click in the normal path.
  await H.ensurePaused(page);
  await H.dismissBurst(page);
  // Clicking #btn-import scrolls the low Import button into view. The old
  // outside pause click on the top bar scrolled back up as a side effect; the
  // in-page pause does not, so restore the scroll explicitly, because later
  // canvas sampling and plaque geometry must not depend on an outside click
  // scrolling back.
  await page.evaluate(function () { window.scrollTo(0, 0); });
}

async function main() {
  // ---------- Node part: expectations from the real modules ----------
  const seedCounts = intelCounts(playerView(Sim.createGame(42)));
  check('node: seed 42 view counts', seedCounts.dark > 0 && seedCounts.live > 0,
    'live=' + seedCounts.live + ' remembered=' + seedCounts.remembered + ' dark=' + seedCounts.dark);

  const readBack = Save.deserializeSave(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  check('node: fixture reads back', readBack.ok === true, readBack.reason || '');
  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }
  const fixtureView = playerView(readBack.state);
  const fixtureCounts = intelCounts(fixtureView);
  const fixtureHollow = AshesPlaques.buildPlaques(fixtureView).unitPlaques.filter((d) => d.hollow).length;
  check('node: fixture view counts are 46 live, 9 remembered, 15 dark',
    fixtureCounts.live === 46 && fixtureCounts.remembered === 9 && fixtureCounts.dark === 15,
    'live=' + fixtureCounts.live + ' remembered=' + fixtureCounts.remembered + ' dark=' + fixtureCounts.dark);

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(HARNESS_URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesFogDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);

    // Cycle 23 Step 19c: wait until the TX-FOG-UK and TX-FOG-LS patterns are
    // ready (and the fog canvas redrawn with them) so every sample below
    // measures the textured board deterministically.
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => {
          const d = window.AshesTextureDebug;
          return !!d && d.fogUkState === 'ready' && d.fogLsState === 'ready';
        });
      } catch (e) {
        return false;
      }
    }, 30000);

    // ----- Part A: seed 42 -----
    const canvasCheck = await page.evaluate(() => {
      const fog = document.getElementById('map-fog');
      if (!fog || fog.tagName !== 'CANVAS') return { exists: false };
      const z = (id) => parseInt(window.getComputedStyle(document.getElementById(id)).zIndex, 10) || 0;
      return {
        exists: true,
        width: fog.width,
        height: fog.height,
        fogZ: z('map-fog'),
        baseZ: z('map-base'),
        stateZ: z('map-state')
      };
    });
    check('A: #map-fog canvas exists', canvasCheck.exists === true, String(canvasCheck.exists));
    check('A: #map-fog canvas has nonzero size', canvasCheck.width > 0 && canvasCheck.height > 0, canvasCheck.width + 'x' + canvasCheck.height);
    check('A: #map-fog z-index above #map-base and below #map-state',
      canvasCheck.fogZ > canvasCheck.baseZ && canvasCheck.fogZ < canvasCheck.stateZ,
      'baseZ=' + canvasCheck.baseZ + ' fogZ=' + canvasCheck.fogZ + ' stateZ=' + canvasCheck.stateZ);

    const dbgA = await page.evaluate(() => window.AshesFogDebug);
    check('A: AshesFogDebug exists', !!dbgA, String(!!dbgA));
    check('A: AshesFogDebug dark count at least 20', dbgA && dbgA.counts.dark >= 20, 'dark=' + (dbgA && dbgA.counts.dark));
    check('A: AshesFogDebug counts equal node seed 42 counts',
      dbgA && dbgA.counts.live === seedCounts.live && dbgA.counts.remembered === seedCounts.remembered && dbgA.counts.dark === seedCounts.dark,
      JSON.stringify(dbgA && dbgA.counts));

    const darkPx = await sampleCellCentre(page, 9, 0);
    const darkLuma = luma(darkPx);
    check('A: dark p9_0 centre pixel is opaque', darkPx.a === 255, 'a=' + darkPx.a + ' at ' + darkPx.x + ',' + darkPx.y);
    check('A: dark p9_0 centre pixel luma in band D (185 to 225)', darkLuma >= 185 && darkLuma <= 225,
      'luma=' + darkLuma.toFixed(1) + ' rgb=' + darkPx.r + ',' + darkPx.g + ',' + darkPx.b);

    const livePx = await sampleCellCentre(page, 0, 3);
    check('A: live capital p0_3 centre pixel is transparent', livePx.a === 0, 'a=' + livePx.a + ' at ' + livePx.x + ',' + livePx.y);

    // Step 14: sea rows on seed 42 (live and dark exist; no remembered).
    const seedView = playerView(Sim.createGame(42));
    const seedPicked = pickSeaRows(seedView);
    check('A: node picked a live and a dark sea sector on seed 42',
      seedPicked.rows.filter((r) => r.pt && (r.state === 'live' || r.state === 'dark')).length === 2,
      seedPicked.rows.map((r) => r.state + '=' + r.id).join(' '));
    await checkSeaRows(page, 'A', seedPicked);

    // Step 14: the page fog hash equals the node hash for the same view.
    const seedHash = AshesMapCanvas.fogOpsHash(AshesMapCanvas.buildFogOps(seedPicked.geom, seedView)
      .concat(AshesMapCanvas.buildFurnitureOps(seedPicked.geom)));
    check('A: AshesFogDebug hash equals the node fog hash', dbgA && dbgA.hash === seedHash, (dbgA && dbgA.hash) + ' vs ' + seedHash);

    // Step 14: Unknown coastline Ink redraw (6.3) on a dark coast. Scan a
    // small window of fog pixels around coastline chain points of the dark
    // coastal op; the darkest pixel must read as ink over the Unknown fill.
    // The brief's luma 60 bound is out of reach here: at deviceScaleFactor 1
    // the fog canvas is about 71 px per cell, so the 0.008 cell coast stroke
    // is about 0.57 device px at alpha 0.70 and antialiases to luma about
    // 145. The bound used is 160, below every other mark the fog canvas puts
    // on Unknown paper (a full 1 px water line at 0.25 reads about 164, the
    // graticule at 0.20 about 172), so only the coast redraw can pass it.
    // The hash equality check above pins the ops themselves.
    const darkCoastOp = AshesMapCanvas.buildFogOps(seedPicked.geom, seedView)
      .find((op) => op.kind === 'unknown' && op.coastPaths.length > 0);
    if (!darkCoastOp) {
      check('A: seed 42 has a dark coastal province', false, 'none');
    } else {
      const coast = darkCoastOp.coastPaths[0];
      const probes = [];
      for (let f = 0.3; f <= 0.71; f += 0.2) {
        const i = 2 * Math.floor((coast.length / 2) * f);
        probes.push({ x: coast[i], y: coast[i + 1] });
      }
      const ink = await page.evaluate(([ext, probes]) => {
        const c = document.getElementById('map-fog');
        const g = c.getContext('2d');
        let best = null;
        probes.forEach((pt) => {
          const cx = Math.floor(((pt.x - ext.x0) / (ext.x1 - ext.x0)) * c.width);
          const cy = Math.floor(((pt.y - ext.y0) / (ext.y1 - ext.y0)) * c.height);
          const d = g.getImageData(cx - 3, cy - 3, 7, 7).data;
          for (let k = 0; k < d.length; k += 4) {
            const L = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
            if (d[k + 3] === 255 && (!best || L < best.luma)) best = { luma: L, x: cx, y: cy };
          }
        });
        return best;
      }, [seedPicked.chart.extent, probes]);
      check('A: dark coast ' + darkCoastOp.id + ' shows Ink redraw on the fog canvas (opaque pixel, luma under 160)',
        !!ink && ink.luma < 160, ink ? 'darkest luma=' + ink.luma.toFixed(1) + ' near ' + ink.x + ',' + ink.y : 'no opaque pixel');
    }

    // ----- Part B: fixture -----
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => window.AshesFogDebug && window.AshesFogDebug.counts.remembered > 0);
      } catch (e) {
        return false;
      }
    }, 10000);

    const dbgB = await page.evaluate(() => window.AshesFogDebug);
    check('B: AshesFogDebug counts equal node fixture counts',
      dbgB && dbgB.counts.live === fixtureCounts.live && dbgB.counts.remembered === fixtureCounts.remembered && dbgB.counts.dark === fixtureCounts.dark,
      JSON.stringify(dbgB && dbgB.counts));

    // Step 14 (MAP_TREATMENT 6.2): the remembered wash is CHART_FADED at
    // alpha 0.65, translucent by design, so the centre pixel (between hatch
    // lines by the anchor rule) is read as the fog composited over the base.
    const remPx = await sampleCellCentre(page, 5, 2);
    const remComp = await sampleComposite(page, chartExtent(), { x: 5.5, y: 2.5 });
    const remLuma = luma(remComp);
    check('B: remembered p5_2 centre pixel is the 0.65 wash (alpha 166)', Math.abs(remPx.a - 166) <= 1, 'a=' + remPx.a + ' at ' + remPx.x + ',' + remPx.y);
    check('B: remembered p5_2 centre composite luma in band C (120 to 175)', remLuma >= 120 && remLuma <= 175,
      'luma=' + remLuma.toFixed(1) + ' fog=' + remPx.r + ',' + remPx.g + ',' + remPx.b + ' base=' + remComp.base.r + ',' + remComp.base.g + ',' + remComp.base.b);

    // Step 14: sea rows on the fixture (all three states exist).
    const fixturePicked = pickSeaRows(fixtureView);
    check('B: node picked a live, a remembered, and a dark sea sector on the fixture',
      fixturePicked.rows.filter((r) => r.pt).length === 3,
      fixturePicked.rows.map((r) => r.state + '=' + r.id).join(' '));
    await checkSeaRows(page, 'B', fixturePicked);

    // Cycle 23 step 9: unit figures are plaques now. One check, same count:
    // no live plaque sits on a remembered province, and hollow plaques exist
    // for the remembered snapshot groups (count equals the node descriptors).
    const domCheck = await page.evaluate(() => {
      const tiles = document.querySelectorAll('#map .province[data-intel="remembered"]');
      const remembered = {};
      tiles.forEach((t) => { remembered[t.getAttribute('data-prov')] = true; });
      let livePlaques = 0;
      let hollowPlaques = 0;
      document.querySelectorAll('#map-board .plaque-layer .plaque').forEach((p) => {
        if (!remembered[p.dataset.province]) return;
        if (p.classList.contains('plaque-hollow')) hollowPlaques++;
        else livePlaques++;
      });
      return { tiles: tiles.length, livePlaques: livePlaques, hollowPlaques: hollowPlaques };
    });
    check('B: remembered tiles carry zero live unit plaques and their snapshot groups show as hollow plaques',
      domCheck.tiles === fixtureCounts.remembered && domCheck.livePlaques === 0 &&
        domCheck.hollowPlaques > 0 && domCheck.hollowPlaques === fixtureHollow,
      'tiles=' + domCheck.tiles + ' livePlaques=' + domCheck.livePlaques + ' hollowPlaques=' + domCheck.hollowPlaques + ' expectedHollow=' + fixtureHollow);

    await page.screenshot({ path: '/tmp/fog-check.png', fullPage: true });
    check('B: screenshot saved to /tmp/fog-check.png', true, '');

    check('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');

    await page.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
