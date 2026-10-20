'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 14b, map review package captures.
// Produces the three storyboard board frames that prove the Step 14 fog on the
// chart work (live, remembered, dark provinces on the board). This tool changes
// nothing; it captures whatever the tree it runs in renders.
//
// F02: a fresh game at seed 42, paused (index.html?seed=42). The opening board:
// live west, Unknown east.
// F04: the committed worst case fixture tools/fixture/worst-case.json (day 146,
// the mid-war front board: fronts 12, fills 46) imported through the real save
// import path, paused at the fixture day. It contains all three fog states.
// F06: the fog frame. F06 is a clip of the same fixture board as F04, per
// VISUAL_STRATEGY frame F06 (whole board captured, then cropped; here the full
// board is F04 and the crop is F06). The clip covers the right 45 percent of the
// #map-board bounding box at full board height: the eastern strip where live,
// remembered (hatched, faded), and dark (Unknown paper) provinces sit side by
// side.
// F02 and F04 are screenshots of the #map-board element only; F06 is a page
// screenshot clipped to the board strip. Viewport 1280 by 900, deviceScaleFactor 1.
//
// MAP-TGT (the R0 style target rendition) does not exist in this repo, so no
// side by side capture is produced by this tool; the review package README
// records that absence. This tool captures only the real game.
//
// Fixture import race discipline copied from tools/fill-capture.js importSave
// (itself copied from tools/fixture-check.js).
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
//
// Usage: node tools/map-review-capture.js <outDir>
//   outDir defaults to /tmp/ashes-map-review.
//   Writes <outDir>/F02.png, <outDir>/F04.png and <outDir>/F06.png.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
const MapCanvas = require('../js/map-canvas.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const OUT_DIR = process.argv[2] || '/tmp/ashes-map-review';
const F02_PATH = path.join(OUT_DIR, 'F02.png');
const F04_PATH = path.join(OUT_DIR, 'F04.png');
const F06_PATH = path.join(OUT_DIR, 'F06.png');

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function stateCounts(state) {
  const view = playerView(state);
  const geom = MapGeom.buildGeometry(view);
  const ops = MapCanvas.buildStateOps(geom, view);
  return {
    fillOps: ops.filter((op) => op.kind === 'fill').length,
    frontOps: ops.filter((op) => op.kind === 'front').length
  };
}

function intelCounts(state) {
  const counts = { live: 0, remembered: 0, dark: 0 };
  playerView(state).provinces.forEach((p) => {
    if (Object.prototype.hasOwnProperty.call(counts, p.intel)) counts[p.intel] += 1;
  });
  return counts;
}

function intelDetail(c) {
  return 'live=' + c.live + ' remembered=' + c.remembered + ' dark=' + c.dark;
}

// Copied from tools/fill-capture.js importSave.
async function importSave(page, savePath) {
  await H.dismissBurst(page);
  // loadFromText restarts the timer unpaused at speed 1, so the first tick
  // lands about 900 ms after the load. A one-shot observer pauses in page: its
  // callback runs as a microtask right after the load handler writes the
  // Loaded notice, before any queued tick task. Error notices never click.
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
  await H.ensurePaused(page);
  await H.dismissBurst(page);
  // The import click scrolls the page down; the board screenshot geometry must
  // not depend on it, so restore the scroll before any screenshot.
  await page.evaluate(function () { window.scrollTo(0, 0); });
}

function fileSize(p) {
  return fs.existsSync(p) ? fs.statSync(p).size : 0;
}

async function main() {
  // ---------- Node part ----------
  const freshState = Sim.createGame(42);
  const fresh = stateCounts(freshState);
  check('node: seed 42 fillOps equals 43 and frontOps equals 7',
    fresh.fillOps === 43 && fresh.frontOps === 7,
    'fills=' + fresh.fillOps + ' fronts=' + fresh.frontOps);

  const freshIntel = intelCounts(freshState);
  check('node: seed 42 intel live > 0 and dark > 0',
    freshIntel.live > 0 && freshIntel.dark > 0,
    intelDetail(freshIntel));

  const readBack = Save.deserializeSave(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const fixture = readBack.ok ? stateCounts(readBack.state) : null;
  const fixtureDay = readBack.ok ? readBack.state.day : null;
  check('node: fixture reads back, day 146, fillOps 46, frontOps 12',
    readBack.ok === true && fixtureDay === 146 && fixture.fillOps === 46 && fixture.frontOps === 12,
    readBack.ok ? 'day=' + fixtureDay + ' fills=' + fixture.fillOps + ' fronts=' + fixture.frontOps : (readBack.reason || 'not ok'));
  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }

  const fixtureIntel = intelCounts(readBack.state);
  check('node: fixture intel live > 0, remembered > 0, dark > 0',
    fixtureIntel.live > 0 && fixtureIntel.remembered > 0 && fixtureIntel.dark > 0,
    intelDetail(fixtureIntel));

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(URL);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesMapCanvasDebug !== 'undefined' &&
          typeof window.AshesStateDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);

    check('page loads, no page errors pending',
      errors.length === 0,
      errors.length ? 'errors: ' + errors.join('; ') : 'none');

    // ----- F02: seed 42, paused -----
    await H.dismissBurst(page);
    await H.ensurePaused(page);
    await H.waitFor(page, async () => page.evaluate((exp) => !!window.AshesStateDebug &&
      window.AshesStateDebug.fillOps === exp.fillOps && window.AshesStateDebug.frontOps === exp.frontOps, fresh), 5000);
    const dbgF02 = await page.evaluate(() => window.AshesStateDebug || null);
    check('F02: AshesStateDebug fillOps and frontOps equal node (43, 7)',
      !!dbgF02 && dbgF02.fillOps === fresh.fillOps && dbgF02.frontOps === fresh.frontOps,
      dbgF02 ? 'fills=' + dbgF02.fillOps + ' fronts=' + dbgF02.frontOps : 'none');
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.locator('#map-board').screenshot({ path: F02_PATH });
    const f02Size = fileSize(F02_PATH);
    check('F02: screenshot exists and > 5000 bytes', f02Size > 5000, F02_PATH + ' ' + f02Size + ' bytes');

    // ----- F04: worst case fixture through the import path, paused -----
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => page.evaluate((exp) => !!window.AshesStateDebug &&
      window.AshesStateDebug.fillOps === exp.fillOps && window.AshesStateDebug.frontOps === exp.frontOps, fixture), 5000);
    const dayText = (await page.textContent('#day-counter')).trim();
    const dbgF04 = await page.evaluate(() => window.AshesStateDebug || null);
    check('F04: day counter 146, AshesStateDebug fillOps 46 and frontOps 12',
      dayText === '146' && !!dbgF04 && dbgF04.fillOps === 46 && dbgF04.frontOps === 12,
      'day=' + dayText + (dbgF04 ? ' fills=' + dbgF04.fillOps + ' fronts=' + dbgF04.frontOps : ' none'));
    await page.locator('#map-board').screenshot({ path: F04_PATH });
    const f04Size = fileSize(F04_PATH);
    check('F04: screenshot exists and > 5000 bytes', f04Size > 5000, F04_PATH + ' ' + f04Size + ' bytes');

    // ----- F06: clip of the same fixture board, eastern 45 percent -----
    await page.evaluate(function () { window.scrollTo(0, 0); });
    const box = await page.evaluate(() => {
      const r = document.getElementById('map-board').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const clip = { x: box.x + box.width * 0.55, y: box.y, width: box.width * 0.45, height: box.height };
    await page.screenshot({ path: F06_PATH, clip: clip });
    const f06Size = fileSize(F06_PATH);
    check('F06: clip screenshot exists and > 5000 bytes', f06Size > 5000,
      F06_PATH + ' ' + f06Size + ' bytes clip=' + [clip.x, clip.y, clip.width, clip.height].map((v) => Math.round(v)).join(','));

    check('browser: no page errors across the run', errors.length === 0, errors.join('; ') || 'none');

    await page.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
