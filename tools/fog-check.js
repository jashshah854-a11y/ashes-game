'use strict';
// Ashes of Empires, Cycle 23 Step 8, fog layer browser check.
// Proves: #map-fog canvas exists between #map-base and #map-state, debug
// counts match the real modules, the Unknown and remembered fills land in
// their luma bands on the live canvas, live provinces stay transparent, and
// remembered tiles show no live unit plaques, only hollow ones.
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

// Sample the #map-fog pixel at the centre of cell (cx, cy) in a 10 x 7 board.
async function sampleCellCentre(page, cx, cy) {
  return page.evaluate(([cx, cy]) => {
    const c = document.getElementById('map-fog');
    const x = Math.min(c.width - 1, Math.floor(((cx + 0.5) / 10) * c.width));
    const y = Math.min(c.height - 1, Math.floor(((cy + 0.5) / 7) * c.height));
    const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
    return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
  }, [cx, cy]);
}

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  const [chooser] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#btn-import') ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => { const notice = (await page.textContent('#save-notice')).trim(); return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1; }, 5000);
  await H.ensurePaused(page);
  await H.dismissBurst(page);
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

    const remPx = await sampleCellCentre(page, 5, 2);
    const remLuma = luma(remPx);
    check('B: remembered p5_2 centre pixel is opaque', remPx.a === 255, 'a=' + remPx.a + ' at ' + remPx.x + ',' + remPx.y);
    check('B: remembered p5_2 centre pixel luma in band C (120 to 175)', remLuma >= 120 && remLuma <= 175,
      'luma=' + remLuma.toFixed(1) + ' rgb=' + remPx.r + ',' + remPx.g + ',' + remPx.b);

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
