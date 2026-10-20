'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 12a, borders and ownership browser check.
// Proves: the base debug border op count equals the node count (one dashed
// border per non river chart edge), and the state debug fill, band, and front
// counts equal the node buildStateOps counts on chart paths, for seed 42 and
// for the worst case fixture imported through the save path.
// Race discipline: the page is paused before sampling, then the slot save is
// taken and the node counts are computed from that exact state, so a tick
// cannot land between the page counts and the node counts.
// Pattern from tools/chart-check.js and tools/ownership-check.js; fixture
// import from tools/fog-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const MapCanvas = require('../js/map-canvas.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');
const SAVE_SLOT_KEY = 'ashes-save-slot-1';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

// Expected counts for one state, from the real modules.
function expectedCounts(state) {
  const view = playerView(state);
  const geom = MapGeom.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const river = {};
  geom.riverSegments.forEach((rs) => { river[rs.a + '|' + rs.b] = true; river[rs.b + '|' + rs.a] = true; });
  const owners = {};
  view.provinces.forEach((p) => {
    if (p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy')) owners[p.id] = p.owner;
  });
  const stateOps = MapCanvas.buildStateOps(geom, view);
  const drawOps = MapCanvas.buildDrawOps(geom, view);
  const seaRibbons = chart.boundarySegments.filter((s) => s.sea && owners[s.provinceId]).length;
  const inlandRibbons = chart.boundarySegments.filter((s) => !s.sea && owners[s.provinceId]).length;
  return {
    day: state.day,
    borderFromChart: chart.chartEdges.filter((e) => !river[e.a + '|' + e.b]).length,
    borderOps: drawOps.filter((op) => op.kind === 'border').length,
    fillOps: stateOps.filter((op) => op.kind === 'fill').length,
    bandOps: stateOps.filter((op) => op.kind === 'band').length,
    frontOps: stateOps.filter((op) => op.kind === 'front').length,
    seaRibbons: seaRibbons,
    inlandRibbons: inlandRibbons,
    hash: MapCanvas.stateOpsHash(stateOps)
  };
}

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  // loadFromText restarts the timer unpaused at speed 1, so the first tick
  // lands about 900 ms after the load. Pausing from outside (notice poll, then
  // a Playwright click) costs CDP round trips that can cross that tick and
  // move the fixture off its committed counts. So a one-shot observer pauses
  // in page: its callback runs as a microtask right after the load handler
  // writes the Loaded notice, before any queued tick task. Error notices never
  // click.
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
  // screenshot geometry must not depend on an outside click scrolling back.
  await page.evaluate(function () { window.scrollTo(0, 0); });
}

// Paused page state through the browser slot: save, read the slot text, and
// deserialize it in node.
async function pagedState(page) {
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_SLOT_KEY);
  await H.clickWhenClear(page, '#btn-save-slot');
  await H.waitFor(page, async () => page.evaluate((key) => localStorage.getItem(key) !== null, SAVE_SLOT_KEY), 5000);
  const text = await page.evaluate((key) => localStorage.getItem(key), SAVE_SLOT_KEY);
  if (text === null) return null;
  const rb = Save.deserializeSave(text);
  return rb.ok ? rb.state : null;
}

// The state debug object is written after every render; wait until its hash
// equals the node hash for the paused state.
async function settledStateDebug(page, hash) {
  await H.waitFor(page, async () => page.evaluate((h) => !!window.AshesStateDebug && window.AshesStateDebug.hash === h, hash), 5000);
  return page.evaluate(() => window.AshesStateDebug || null);
}

function compareState(label, dbg, exp) {
  check(label + ': AshesStateDebug hash equals node stateOpsHash', !!dbg && dbg.hash === exp.hash,
    (dbg ? dbg.hash : 'none') + ' vs ' + exp.hash);
  check(label + ': fillOps equals node', !!dbg && dbg.fillOps === exp.fillOps, (dbg ? dbg.fillOps : 'none') + ' vs ' + exp.fillOps);
  check(label + ': bandOps equals node', !!dbg && dbg.bandOps === exp.bandOps, (dbg ? dbg.bandOps : 'none') + ' vs ' + exp.bandOps);
  check(label + ': frontOps equals node', !!dbg && dbg.frontOps === exp.frontOps, (dbg ? dbg.frontOps : 'none') + ' vs ' + exp.frontOps);
}

async function main() {
  // ---------- Node part: fresh seed 42 and the fixture ----------
  const fresh = expectedCounts(Sim.createGame(42));
  check('node: seed 42 border ops equal non river chart edges',
    fresh.borderOps === fresh.borderFromChart && fresh.borderOps > 0,
    'borderOps=' + fresh.borderOps + ' chart=' + fresh.borderFromChart);
  check('node: seed 42 sea ribbons exist', fresh.seaRibbons > 0,
    'sea=' + fresh.seaRibbons + ' inland=' + fresh.inlandRibbons + ' fills=' + fresh.fillOps +
    ' bands=' + fresh.bandOps + ' fronts=' + fresh.frontOps);

  const readBack = Save.deserializeSave(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  check('node: fixture reads back', readBack.ok === true, readBack.reason || '');
  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }
  const fixture = expectedCounts(readBack.state);
  check('node: fixture sea ribbons exist', fixture.seaRibbons > 0,
    'sea=' + fixture.seaRibbons + ' inland=' + fixture.inlandRibbons + ' fills=' + fixture.fillOps +
    ' bands=' + fixture.bandOps + ' fronts=' + fixture.frontOps);

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
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesMapCanvasDebug !== 'undefined' &&
          typeof window.AshesStateDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);
    await H.dismissBurst(page);
    await H.ensurePaused(page);

    // ----- Part A: seed 42, paused -----
    const base = await page.evaluate(() => window.AshesMapCanvasDebug || null);
    check('A: AshesMapCanvasDebug.borderOps equals node border count',
      !!base && base.borderOps === fresh.borderOps,
      (base ? base.borderOps : 'none') + ' vs ' + fresh.borderOps);

    const stateA = await pagedState(page);
    check('A: paused page state read through the browser slot', !!stateA, stateA ? 'day=' + stateA.day : 'none');
    if (stateA) {
      const expA = expectedCounts(stateA);
      check('A: paused page geometry gives the same border count', expA.borderOps === fresh.borderOps,
        expA.borderOps + ' vs ' + fresh.borderOps);
      const dbgA = await settledStateDebug(page, expA.hash);
      compareState('A (day ' + expA.day + ')', dbgA, expA);
    }

    await page.screenshot({ path: '/tmp/borders-check.png', fullPage: true });
    check('A: screenshot saved to /tmp/borders-check.png', fs.existsSync('/tmp/borders-check.png'), '');

    // ----- Part B: worst case fixture through the import path, paused -----
    await importSave(page, FIXTURE_PATH);
    const stateB = await pagedState(page);
    check('B: paused fixture state read through the browser slot', !!stateB, stateB ? 'day=' + stateB.day : 'none');
    if (stateB) {
      const expB = expectedCounts(stateB);
      check('B: paused fixture state equals the committed fixture counts',
        expB.fillOps === fixture.fillOps && expB.bandOps === fixture.bandOps && expB.frontOps === fixture.frontOps,
        'fills=' + expB.fillOps + ' bands=' + expB.bandOps + ' fronts=' + expB.frontOps);
      const dbgB = await settledStateDebug(page, expB.hash);
      compareState('B (day ' + expB.day + ')', dbgB, expB);
    }
    const baseB = await page.evaluate(() => window.AshesMapCanvasDebug || null);
    check('B: AshesMapCanvasDebug.borderOps equals node fixture border count',
      !!baseB && baseB.borderOps === fixture.borderOps,
      (baseB ? baseB.borderOps : 'none') + ' vs ' + fixture.borderOps);

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
