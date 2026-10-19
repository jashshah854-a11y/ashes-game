'use strict';
// Ashes of Empires, Cycle 23 Step 9, live board plaque browser check.
// Proves on the real index.html: a fresh seed 42 game shows unit plaques whose
// total, live, and hollow counts equal node side AshesPlaques.buildPlaques on
// the same fresh state; every live plaque carries the descriptor numeral
// (COUNTxSTRENGTH) and a flotilla plaque carries none, as its descriptor
// numeral is null; no .unit-chip remains in #map-board; no building marks are
// drawn on the live board; after importing the committed fixture the hollow
// plaque count equals the fixture's remembered descriptor count, no hollow
// plaque holds a digit, and window.AshesPlaqueDebug matches the DOM counts.
// Pattern from tools/fog-check.js (fixture import included).
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
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
const NUMERAL_RE = /^[0-9]+x[0-9]+$/;

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function descriptorCounts(view) {
  const plaques = AshesPlaques.buildPlaques(view).unitPlaques;
  const hollow = plaques.filter((d) => d.hollow).length;
  return {
    total: plaques.length,
    live: plaques.length - hollow,
    hollow: hollow,
    numerals: plaques.filter((d) => !d.hollow).map((d) => d.provinceId + '|' + d.nation + '|' + d.type + '|' + d.numeral).sort()
  };
}

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  const [chooser] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#btn-import') ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => { const notice = (await page.textContent('#save-notice')).trim(); return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1; }, 5000);
  await H.ensurePaused(page);
  await H.dismissBurst(page);
}

// Read every plaque in the live board's plaque layer.
async function readBoard(page) {
  return page.evaluate(() => {
    const board = document.getElementById('map-board');
    const layers = board.querySelectorAll(':scope > .plaque-layer');
    const plaques = Array.prototype.map.call(board.querySelectorAll('.plaque-layer .plaque'), (p) => {
      const num = p.querySelector('.numeral');
      return {
        province: p.dataset.province,
        nation: p.dataset.nation,
        type: p.dataset.type,
        hollow: p.classList.contains('plaque-hollow'),
        live: p.classList.contains('plaque-live'),
        numeral: num ? num.textContent : null,
        text: p.textContent
      };
    });
    const layer = layers.length ? layers[layers.length - 1] : null;
    return {
      layers: layers.length,
      layerZ: layer ? window.getComputedStyle(layer).zIndex : null,
      layerPointer: layer ? window.getComputedStyle(layer).pointerEvents : null,
      plaques: plaques,
      unitChips: board.querySelectorAll('.unit-chip').length,
      buildingMarks: board.querySelectorAll('.building-mark').length,
      debug: window.AshesPlaqueDebug || null
    };
  });
}

function domCounts(board) {
  const hollow = board.plaques.filter((p) => p.hollow).length;
  return { total: board.plaques.length, live: board.plaques.length - hollow, hollow: hollow };
}

async function main() {
  // ---------- Node part: expectations from the real modules ----------
  const seedState = Sim.createGame(42);
  const seedExp = descriptorCounts(playerView(seedState));
  check('node: seed 42 descriptors have live plaques', seedExp.live > 0,
    'total=' + seedExp.total + ' live=' + seedExp.live + ' hollow=' + seedExp.hollow);

  const readBack = Save.deserializeSave(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  check('node: fixture reads back', readBack.ok === true, readBack.reason || '');
  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }
  const fixExp = descriptorCounts(playerView(readBack.state));
  check('node: fixture descriptors have remembered plaques', fixExp.hollow > 0,
    'total=' + fixExp.total + ' live=' + fixExp.live + ' hollow=' + fixExp.hollow);

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
        return await page.evaluate(() => typeof window.AshesPlaqueDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);

    // ----- Part A: fresh seed 42 -----
    const a = await readBoard(page);
    const aCounts = domCounts(a);
    check('A: exactly one plaque layer in #map-board', a.layers === 1, 'layers=' + a.layers);
    check('A: plaque layer sits above the state canvas (z-index 4) and ignores clicks',
      a.layerZ === '4' && a.layerPointer === 'none', 'z=' + a.layerZ + ' pointer=' + a.layerPointer);
    check('A: DOM plaque counts equal node buildPlaques on fresh seed 42',
      aCounts.total === seedExp.total && aCounts.live === seedExp.live && aCounts.hollow === seedExp.hollow,
      'dom=' + JSON.stringify(aCounts) + ' node=' + JSON.stringify({ total: seedExp.total, live: seedExp.live, hollow: seedExp.hollow }));
    const badLive = a.plaques.filter((p) => !p.hollow && (p.type === 'flotilla' ? p.numeral !== null : !(p.numeral && NUMERAL_RE.test(p.numeral))));
    check('A: every live unit plaque has a .numeral matching COUNTxSTRENGTH (flotilla plaques carry none)',
      a.plaques.some((p) => !p.hollow) && badLive.length === 0, 'bad=' + JSON.stringify(badLive.slice(0, 3)));
    const domNumerals = a.plaques.filter((p) => !p.hollow).map((p) => p.province + '|' + p.nation + '|' + p.type + '|' + p.numeral).sort();
    check('A: live plaque numerals equal the node descriptor numerals one for one',
      JSON.stringify(domNumerals) === JSON.stringify(seedExp.numerals),
      'dom=' + domNumerals.slice(0, 4).join(',') + ' node=' + seedExp.numerals.slice(0, 4).join(','));
    check('A: zero .unit-chip elements in #map-board', a.unitChips === 0, 'unitChips=' + a.unitChips);
    check('A: zero building marks on the live board', a.buildingMarks === 0, 'buildingMarks=' + a.buildingMarks);
    check('A: AshesPlaqueDebug matches the DOM counts',
      !!a.debug && a.debug.total === aCounts.total && a.debug.live === aCounts.live && a.debug.hollow === aCounts.hollow,
      JSON.stringify(a.debug));

    // ----- Part B: committed fixture -----
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => window.AshesPlaqueDebug && window.AshesPlaqueDebug.hollow > 0);
      } catch (e) {
        return false;
      }
    }, 10000);

    const b = await readBoard(page);
    const bCounts = domCounts(b);
    check('B: exactly one plaque layer after import', b.layers === 1, 'layers=' + b.layers);
    check('B: hollow plaque count equals the fixture remembered descriptor count',
      bCounts.hollow === fixExp.hollow, 'dom=' + bCounts.hollow + ' node=' + fixExp.hollow);
    // A load resumes the war until the helper pauses it, so the imported board
    // can be a day past the node read back and live stacks may have moved;
    // live plaques are pinned by numeral shape here, and the exact live count
    // is pinned against AshesPlaqueDebug below.
    const badLiveB = b.plaques.filter((p) => !p.hollow && (p.type === 'flotilla' ? p.numeral !== null : !(p.numeral && NUMERAL_RE.test(p.numeral))));
    check('B: live plaques present and every live unit plaque numeral matches COUNTxSTRENGTH (flotilla plaques carry none)',
      bCounts.live > 0 && badLiveB.length === 0, 'live=' + bCounts.live + ' node=' + fixExp.live + ' bad=' + JSON.stringify(badLiveB.slice(0, 3)));
    const digitHollow = b.plaques.filter((p) => p.hollow && (/[0-9]/.test(p.text) || p.numeral !== null));
    check('B: zero hollow plaques contain any digit or numeral', digitHollow.length === 0,
      'withDigits=' + digitHollow.length);
    check('B: AshesPlaqueDebug matches the DOM counts',
      !!b.debug && b.debug.total === bCounts.total && b.debug.live === bCounts.live && b.debug.hollow === bCounts.hollow,
      JSON.stringify(b.debug));
    check('B: zero .unit-chip elements in #map-board', b.unitChips === 0, 'unitChips=' + b.unitChips);

    await page.screenshot({ path: '/tmp/live-plaque-check.png', fullPage: true });
    check('B: screenshot saved to /tmp/live-plaque-check.png', true, '');

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
