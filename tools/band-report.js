'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 17b, the palette harness
// (band report). Carries the Step 11 / Step 17 acceptance sentence
// (VISUAL_STRATEGY 6.1 Step 11, MAP_TREATMENT 8.1 Step 17): the harness band
// report passes for every province, and no atmosphere pixel reaches 225.
//
// Boards. Two real boards, the only two this repo has:
// - F02: a fresh game at seed 42 (file:// index.html?seed=42), paused. Node
//   view: Sim.createGame(42) through js/adapter.js. Intel counts live 43,
//   remembered 0, dark 27.
// - fixture: tools/fixture/worst-case.json imported through the real save
//   path (the F04 worst case board; F06 is a crop of this same board). Node
//   view: Save.deserializeSave of that file through the adapter. Intel counts
//   live 46, remembered 9, dark 15.
// The other storyboard fixtures (F03, F05, F07) do not exist in this repo, so
// the harness runs on these two boards. Across the two boards all 70
// provinces are measured twice and all three fog states occur. This tool
// claims no F03 to F07 coverage.
//
// Composite under measurement: the #map-base canvas with the #map-fog canvas
// drawn over it, composited once per board onto an offscreen canvas inside
// page.evaluate, one getImageData read. The #map-state canvas (ownership
// bands, front line) and the DOM plaques and labels are NOT in the composite:
// they are information layers measured by their own checks, and the band
// table governs ground and fog. getImageData is used in this tool only, never
// in game code.
//
// Rows. One row per province (polygon = chart.hitPolygons[id], state = the
// view's intel), and one sea row per province with at least one sea sector
// (key id + '#sea', the union of all that province's sector seaParts, state =
// the province's intel). Every canvas pixel whose centre, mapped through the
// chart extent, lies inside the row polygon is sampled (step 1, no
// subsampling). Rec. 709 luma.
//
// Pass criteria. Bands: live 60 to 150, remembered 120 to 175, dark 185 to
// 225. A row passes when its MEAN and its MEDIAN both lie in its band; p5 and
// p95 are printed for information only, never gated. The designed line work
// that sits on the ground (the remembered hatch at Ink alpha 0.30 covering
// about a fifth of a remembered province, the graticule at alpha 0.20 over
// Unknown paper) legitimately reads outside the ground band, which is why
// every earlier step measured ground at points between lines. Mean and median
// over every pixel are strictly stronger than those point checks.
// Also gated: fog states at least 25 levels apart (STRATEGY 2.8.5) on the
// mean of province row means per state, the global max luma of each
// composite under 225, n >= 20 per row, and the page board identity
// (AshesFogDebug counts equal the node counts).
//
// Textures (Cycle 23 Steps 19a, 19b, and 19c). The measured #map-base now
// includes the wired TX-LAND land texture (soft-light pattern above the relief
// raster), the TX-SEA sea texture (soft-light pattern over the sea, below the
// beach and coastline), and the TX-PAPER border paper (opaque fill of the
// border strip, below the vignette and the furniture); the measured #map-fog
// includes the TX-FOG-UK Unknown paper (pattern fill at alpha 1) and the
// TX-FOG-LS last seen wash (pattern fill at alpha 0.65). The patterns load
// asynchronously, so before each board's measurement the harness waits until
// window.AshesTextureDebug.landState, seaState, paperState, fogUkState, and
// fogLsState are all 'ready'; an 'error' state in any of them (or a timeout) is a harness error
// (exit 2), never a silent untextured pass.
//
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const BANDS = { live: [60, 150], remembered: [120, 175], dark: [185, 225] };
const STATES = ['live', 'remembered', 'dark'];
const MIN_N = 20;
const SEPARATION = 25;
const CEILING = 225;

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

// Rows for one view, built from the real modules. Each row carries a list of
// polygons; a pixel belongs to the row when it lies in any of them.
function buildRows(view) {
  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(view));
  const intel = {};
  view.provinces.forEach((p) => { intel[p.id] = p.intel; });
  const rows = [];
  const seaParts = {};
  chart.sectors.forEach((s) => {
    if (!s.sea) return;
    if (!seaParts[s.provinceId]) seaParts[s.provinceId] = [];
    seaParts[s.provinceId].push(s.seaPart);
  });
  view.provinces.forEach((p) => {
    rows.push({ id: p.id, state: p.intel, polys: [chart.hitPolygons[p.id]], sea: false });
  });
  view.provinces.forEach((p) => {
    if (seaParts[p.id]) rows.push({ id: p.id + '#sea', state: intel[p.id], polys: seaParts[p.id], sea: true });
  });
  return { rows: rows, extent: chart.extent };
}

// Composite #map-fog over #map-base once, read it once, and measure every
// row over every pixel whose centre lies in the row polygon set.
async function measure(page, built) {
  return page.evaluate(([ext, rows]) => {
    const base = document.getElementById('map-base');
    const fog = document.getElementById('map-fog');
    const W = base.width;
    const Hh = base.height;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = Hh;
    const g = off.getContext('2d');
    g.drawImage(base, 0, 0, W, Hh);
    g.drawImage(fog, 0, 0, W, Hh);
    const d = g.getImageData(0, 0, W, Hh).data;
    const L = new Float64Array(W * Hh);
    let globalMax = -1;
    let maxAt = null;
    for (let i = 0, k = 0; i < W * Hh; i++, k += 4) {
      const v = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
      L[i] = v;
      if (v > globalMax) { globalMax = v; maxAt = { x: i % W, y: Math.floor(i / W), r: d[k], g: d[k + 1], b: d[k + 2] }; }
    }
    // Point in polygon by ray casting.
    function inPoly(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    const sx = (ext.x1 - ext.x0) / W;
    const sy = (ext.y1 - ext.y0) / Hh;
    // Nearest rank percentile over a sorted array.
    function pct(a, p) { return a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))]; }
    const out = rows.map((row) => {
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      row.polys.forEach((poly) => poly.forEach((q) => {
        if (q.x < bx0) bx0 = q.x; if (q.x > bx1) bx1 = q.x;
        if (q.y < by0) by0 = q.y; if (q.y > by1) by1 = q.y;
      }));
      const i0 = Math.max(0, Math.floor((bx0 - ext.x0) / sx) - 1);
      const i1 = Math.min(W - 1, Math.ceil((bx1 - ext.x0) / sx) + 1);
      const j0 = Math.max(0, Math.floor((by0 - ext.y0) / sy) - 1);
      const j1 = Math.min(Hh - 1, Math.ceil((by1 - ext.y0) / sy) + 1);
      const vals = [];
      for (let j = j0; j <= j1; j++) {
        const cy = ext.y0 + (j + 0.5) * sy;
        for (let i = i0; i <= i1; i++) {
          const cx = ext.x0 + (i + 0.5) * sx;
          if (row.polys.some((poly) => inPoly(cx, cy, poly))) vals.push(L[j * W + i]);
        }
      }
      const n = vals.length;
      if (n === 0) return { id: row.id, n: 0 };
      let sum = 0;
      vals.forEach((v) => { sum += v; });
      vals.sort((a, b) => a - b);
      const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
      return { id: row.id, n: n, mean: sum / n, median: median, p5: pct(vals, 0.05), p95: pct(vals, 0.95) };
    });
    return { width: W, height: Hh, globalMax: globalMax, maxAt: maxAt, rows: out };
  }, [built.extent, built.rows.map((r) => ({ id: r.id, polys: r.polys }))]);
}

function f1(v) { return v === undefined ? '-' : v.toFixed(1); }

// Print the band table for one board and run its counted checks.
function reportBoard(label, built, m, expectSep) {
  check(label + ': composite canvas has nonzero size', m.width > 0 && m.height > 0, m.width + 'x' + m.height);
  const means = { live: [], remembered: [], dark: [] };
  built.rows.forEach((row, idx) => {
    const r = m.rows[idx];
    const band = BANDS[row.state];
    const inBand = (v) => v !== undefined && v >= band[0] && v <= band[1];
    const ok = r.n >= MIN_N && inBand(r.mean) && inBand(r.median);
    check(label + ': ' + row.id + ' ' + row.state + ' band ' + band[0] + ' to ' + band[1], ok,
      'n=' + r.n + ' mean=' + f1(r.mean) + ' median=' + f1(r.median) + ' p5=' + f1(r.p5) + ' p95=' + f1(r.p95) +
      (r.n < MIN_N ? ' (n under ' + MIN_N + ')' : ''));
    if (!row.sea && r.n > 0) means[row.state].push(r.mean);
  });
  const stateMean = {};
  STATES.forEach((s) => {
    if (means[s].length) stateMean[s] = means[s].reduce((a, b) => a + b, 0) / means[s].length;
  });
  console.log(label + ': state means of province row means ' +
    STATES.filter((s) => stateMean[s] !== undefined).map((s) => s + '=' + stateMean[s].toFixed(1) + ' (' + means[s].length + ' rows)').join(' '));
  expectSep.forEach(([lo, hi]) => {
    const diff = stateMean[hi] - stateMean[lo];
    check(label + ': fog separation ' + hi + ' minus ' + lo + ' at least ' + SEPARATION,
      stateMean[lo] !== undefined && stateMean[hi] !== undefined && diff >= SEPARATION,
      'diff=' + (isNaN(diff) ? 'n/a' : diff.toFixed(1)));
  });
  check(label + ': global max composite luma under ' + CEILING, m.globalMax < CEILING,
    'max=' + m.globalMax.toFixed(1) + (m.maxAt ? ' at ' + m.maxAt.x + ',' + m.maxAt.y + ' rgb=' + m.maxAt.r + ',' + m.maxAt.g + ',' + m.maxAt.b : ''));
  const prov = built.rows.filter((r) => !r.sea).length;
  const sea = built.rows.length - prov;
  console.log(label + ': rows ' + built.rows.length + ' (province ' + prov + ', sea ' + sea + ')');
  return { prov: prov, sea: sea, globalMax: m.globalMax, stateMean: stateMean };
}

// Wait for the TX-LAND (Step 19a), TX-SEA, TX-PAPER (Step 19b), TX-FOG-UK,
// and TX-FOG-LS (Step 19c) textures to finish loading; an 'error' state in
// any of them throws.
const TEXTURE_STATES = ['landState', 'seaState', 'paperState', 'fogUkState', 'fogLsState'];
async function waitTextures(page, label) {
  await H.waitUntil(async () => {
    try {
      return await page.evaluate((keys) => {
        const d = window.AshesTextureDebug;
        return !!d && keys.every((k) => d[k] === 'ready' || d[k] === 'error');
      }, TEXTURE_STATES);
    } catch (e) {
      return false;
    }
  }, 30000, label + ': TX-LAND, TX-SEA, TX-PAPER, TX-FOG-UK, and TX-FOG-LS texture states settle');
  const st = await page.evaluate((keys) => keys.map((k) => k + '=' + window.AshesTextureDebug[k]), TEXTURE_STATES);
  if (st.some((s) => !/=ready$/.test(s))) throw new Error(label + ': texture states not all ready: ' + st.join(' '));
}

async function fogDebugCounts(page) {
  return page.evaluate(() => window.AshesFogDebug && window.AshesFogDebug.counts);
}

function sameCounts(a, b) {
  return !!a && !!b && a.live === b.live && a.remembered === b.remembered && a.dark === b.dark;
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
  // ---------- Node part: rows from the real modules ----------
  const seedView = playerView(Sim.createGame(42));
  const seedCounts = intelCounts(seedView);
  check('node: F02 seed 42 view counts are 43 live, 0 remembered, 27 dark',
    seedCounts.live === 43 && seedCounts.remembered === 0 && seedCounts.dark === 27,
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
  check('node: fixture view counts are 46 live, 9 remembered, 15 dark',
    fixtureCounts.live === 46 && fixtureCounts.remembered === 9 && fixtureCounts.dark === 15,
    'live=' + fixtureCounts.live + ' remembered=' + fixtureCounts.remembered + ' dark=' + fixtureCounts.dark);

  const seedRows = buildRows(seedView);
  const fixtureRows = buildRows(fixtureView);

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  let sumA = null;
  let sumB = null;

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

    // ----- Board A: F02, seed 42 -----
    const countsA = await fogDebugCounts(page);
    check('F02: AshesFogDebug counts equal node seed 42 counts', sameCounts(countsA, seedCounts), JSON.stringify(countsA));
    await waitTextures(page, 'F02');
    const mA = await measure(page, seedRows);
    sumA = reportBoard('F02', seedRows, mA, [['live', 'dark']]);
    // Identity holds after the read too, so the measured pixels are this board.
    const countsA2 = await fogDebugCounts(page);
    check('F02: AshesFogDebug counts unchanged after the measurement', sameCounts(countsA2, seedCounts), JSON.stringify(countsA2));
    await page.screenshot({ path: '/tmp/band-report-f02.png', fullPage: true });
    check('F02: screenshot saved to /tmp/band-report-f02.png', true, '');

    // ----- Board B: fixture -----
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => window.AshesFogDebug && window.AshesFogDebug.counts.remembered > 0);
      } catch (e) {
        return false;
      }
    }, 10000);
    const countsB = await fogDebugCounts(page);
    check('fixture: AshesFogDebug counts equal node fixture counts', sameCounts(countsB, fixtureCounts), JSON.stringify(countsB));
    await waitTextures(page, 'fixture');
    const mB = await measure(page, fixtureRows);
    sumB = reportBoard('fixture', fixtureRows, mB, [['live', 'remembered'], ['remembered', 'dark']]);
    const countsB2 = await fogDebugCounts(page);
    check('fixture: AshesFogDebug counts unchanged after the measurement', sameCounts(countsB2, fixtureCounts), JSON.stringify(countsB2));
    await page.screenshot({ path: '/tmp/band-report-fixture.png', fullPage: true });
    check('fixture: screenshot saved to /tmp/band-report-fixture.png', true, '');

    check('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');

    await page.close();
  } finally {
    await browser.close();
  }

  console.log('SUMMARY: F02 rows ' + (sumA.prov + sumA.sea) + ' (sea ' + sumA.sea + ') max ' + sumA.globalMax.toFixed(1) +
    '; fixture rows ' + (sumB.prov + sumB.sea) + ' (sea ' + sumB.sea + ') max ' + sumB.globalMax.toFixed(1));
  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
