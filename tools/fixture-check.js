'use strict';
// Ashes of Empires, Cycle 23 Step 3b, worst case board fixture check.
// What this proves: the committed worst case fixture of STRATEGY.md section 2.8.1
// reads back with its counts in node, renders in a real browser through the save
// import path, and renders the twelve fixed crops of section 2.8.1 plus DPR 2 and
// phone viewport shots.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/fixture-check.js
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const H = require('./browser-helper.js');

const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=1';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

var CORNER_IDS = ['p0_0', 'p9_0', 'p0_6', 'p9_6'];

function isMapEdge(p) {
  return p.y === 0 || p.y === 6 || p.x === 0 || p.x === 9;
}

function isCorner(id) {
  return CORNER_IDS.indexOf(id) !== -1;
}

function frontProvincesOf(s, nation) {
  var other = nation === 'player' ? 'enemy' : 'player';
  var set = new Set();
  s.edgeList.forEach(function (e) {
    var oa = s.provinces[e.a].owner;
    var ob = s.provinces[e.b].owner;
    if (oa !== ob) {
      if (oa === nation) set.add(e.a);
      if (ob === nation) set.add(e.b);
    }
  });
  return set;
}

function frontCovered(s, nation, frontSet) {
  var n = 0;
  frontSet.forEach(function (id) {
    var units = Sim.unitsIn(s, id);
    for (var i = 0; i < units.length; i++) {
      if (units[i].nation === nation) { n++; break; }
    }
  });
  return n;
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
  // ---------- Node part ----------
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  check('fixture reads back', readBack.ok === true, readBack.reason || '');

  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }

  const s = readBack.state;
  const view = playerView(s);

  // Compute counts
  const ids = Object.keys(s.provinces);

  var factoryTotal = 0;
  var factoryMin = Infinity;
  var provincesFortified = 0;
  ids.forEach(function (id) {
    var p = s.provinces[id];
    factoryTotal += p.factoryLevel;
    if (p.factoryLevel < factoryMin) factoryMin = p.factoryLevel;
    if ((p.fortLevel || 0) >= 1) provincesFortified++;
  });

  var railBuilt = 0;
  s.edgeList.forEach(function (e) {
    if (e.rail && !e.rail.converting && e.rail.daysLeft === 0) railBuilt++;
  });

  const unitsTotal = s.units.length;
  const damagedUnits = s.units.filter(function (u) { return u.strength < u.maxStrength; }).length;

  var supply = {};
  ['player', 'enemy'].forEach(function (nation) {
    var per = Sim.computeSupply(s, nation) || {};
    Object.keys(per).forEach(function (id) { supply[id] = per[id]; });
  });
  const outOfSupplyUnits = s.units.filter(function (u) {
    var entry = supply[u.provinceId];
    return !entry || !entry.supplied;
  }).length;

  const playerFront = frontProvincesOf(s, 'player');
  const enemyFront = frontProvincesOf(s, 'enemy');
  const playerFrontCovered = frontCovered(s, 'player', playerFront);
  const enemyFrontCovered = frontCovered(s, 'enemy', enemyFront);

  const viewLive = view.provinces.filter(function (p) { return p.intel === 'live'; }).length;
  const viewRemembered = view.provinces.filter(function (p) { return p.intel === 'remembered'; }).length;
  const viewDark = view.provinces.filter(function (p) { return p.intel === 'dark'; }).length;

  const remembered = view.provinces.filter(function (p) { return p.intel === 'remembered'; });
  const dark = view.provinces.filter(function (p) { return p.intel === 'dark'; });
  const rememberedEdge = remembered.filter(function (p) { return isMapEdge(p); }).length;
  const rememberedCorner = remembered.filter(function (p) { return isCorner(p.id); }).length;
  const darkEdge = dark.filter(function (p) { return isMapEdge(p); }).length;
  const darkCorner = dark.filter(function (p) { return isCorner(p.id); }).length;

  // Densest province
  var unitCounts = {};
  s.units.forEach(function (u) { unitCounts[u.provinceId] = (unitCounts[u.provinceId] || 0) + 1; });
  var densestId = null;
  var densestCount = -1;
  Object.keys(unitCounts).forEach(function (id) {
    var c = unitCounts[id];
    if (c > densestCount || (c === densestCount && id < densestId)) {
      densestCount = c;
      densestId = id;
    }
  });

  // Node checks
  check('day >= 140', s.day >= 140, String(s.day));
  check('gameOver is false', s.gameOver === false, String(s.gameOver));
  check('provinceCount === 70', ids.length === 70, String(ids.length));
  check('factoryTotal >= 120', factoryTotal >= 120, String(factoryTotal));
  check('factoryMin >= 1', factoryMin >= 1, String(factoryMin));
  check('provincesFortified >= 35', provincesFortified >= 35, String(provincesFortified));
  check('railBuilt >= 55', railBuilt >= 55, String(railBuilt));
  check('unitsTotal >= 160', unitsTotal >= 160, String(unitsTotal));
  check('damagedUnits >= 40', damagedUnits >= 40, String(damagedUnits));
  check('outOfSupplyUnits >= 30', outOfSupplyUnits >= 30, String(outOfSupplyUnits));
  check('playerFrontCovered >= 7', playerFrontCovered >= 7, playerFrontCovered + ' of ' + playerFront.size);
  check('enemyFrontCovered >= enemyFrontProvinces - 1', enemyFrontCovered >= enemyFront.size - 1, enemyFrontCovered + ' of ' + enemyFront.size);
  check('viewLive >= 40', viewLive >= 40, String(viewLive));
  check('viewRemembered >= 8', viewRemembered >= 8, String(viewRemembered));
  check('rememberedEdge >= 2', rememberedEdge >= 2, String(rememberedEdge));
  check('rememberedCorner >= 1', rememberedCorner >= 1, String(rememberedCorner));
  check('viewDark >= 12', viewDark >= 12, String(viewDark));
  check('darkEdge >= 6', darkEdge >= 6, String(darkEdge));
  check('darkCorner >= 1', darkCorner >= 1, String(darkCorner));
  check('densest unit count >= 20', densestCount >= 20, densestId + ' has ' + densestCount);

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-check-'));

  try {
    // Desktop context
    const errorsDesktop = [];
    let page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errorsDesktop.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => (await page.$$('#map .province')).length === 70, 10000);

    const tileCount = (await page.$$('#map .province')).length;
    check('desktop: 70 province tiles rendered', tileCount === 70, 'found ' + tileCount);

    const dayText = (await page.textContent('#day-counter')).trim();
    check('desktop: day counter shows the fixture day', dayText === String(s.day), 'got ' + dayText + ' expected ' + s.day);

    check('desktop: no page errors yet', errorsDesktop.length === 0, errorsDesktop.join('; ') || 'none');

    // Crops
    const mapBox = await page.locator('#map').boundingBox();
    const W = mapBox.width;
    const H_map = mapBox.height;
    const cw = W / 3;
    const ch = H_map / 3;

    async function crop(name, cx, cy) {
      const clip = {
        x: mapBox.x + cx - cw / 2,
        y: mapBox.y + cy - ch / 2,
        width: cw,
        height: ch
      };
      const file = path.join(tempDir, name.replace(/\s+/g, '_') + '.png');
      await page.screenshot({ path: file, clip: clip });
      const stat = fs.statSync(file);
      check('crop ' + name, stat.size > 2000, stat.size + ' bytes');
    }

    // Corners centered ON the map corners
    await crop('corner top left', 0, 0);
    await crop('corner top right', W, 0);
    await crop('corner bottom left', 0, H_map);
    await crop('corner bottom right', W, H_map);

    // Edge midpoints
    await crop('edge top', W / 2, 0);
    await crop('edge bottom', W / 2, H_map);
    await crop('edge left', 0, H_map / 2);
    await crop('edge right', W, H_map / 2);

    // Centers
    await crop('center', W / 2, H_map / 2);
    await crop('center upper', W / 2, H_map / 3);
    await crop('center lower', W / 2, 2 * H_map / 3);

    // Densest region: center on the tile, then clamp
    const densestTile = await page.locator('.province[data-prov="' + densestId + '"]').boundingBox();
    if (densestTile) {
      let cx = densestTile.x + densestTile.width / 2 - mapBox.x;
      let cy = densestTile.y + densestTile.height / 2 - mapBox.y;
      // Clamp so whole clip stays inside map box
      cx = Math.max(cw / 2, Math.min(W - cw / 2, cx));
      cy = Math.max(ch / 2, Math.min(H_map - ch / 2, cy));
      await crop('densest region', cx, cy);
    } else {
      check('crop densest region', false, 'tile not found');
    }

    await page.close();

    // DPR 2 context
    const errorsDPR2 = [];
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errorsDPR2.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => (await page.$$('#map .province')).length === 70, 10000);

    const dpr2File = path.join(tempDir, 'dpr2_map.png');
    await page.locator('#map').screenshot({ path: dpr2File });
    const dpr2Stat = fs.statSync(dpr2File);
    check('dpr2: map screenshot exists and > 5000 bytes', dpr2Stat.size > 5000, dpr2Stat.size + ' bytes');
    check('dpr2: no page errors', errorsDPR2.length === 0, errorsDPR2.join('; ') || 'none');

    await page.close();

    // Phone context
    const errorsPhone = [];
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errorsPhone.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => (await page.$$('#map .province')).length === 70, 10000);

    const phoneTileCount = (await page.$$('#map .province')).length;
    check('phone: 70 province tiles rendered', phoneTileCount === 70, 'found ' + phoneTileCount);

    const phoneFile = path.join(tempDir, 'phone_full.png');
    await page.screenshot({ path: phoneFile, fullPage: true });
    const phoneStat = fs.statSync(phoneFile);
    check('phone: full page screenshot exists and > 5000 bytes', phoneStat.size > 5000, phoneStat.size + ' bytes');
    check('phone: no page errors', errorsPhone.length === 0, errorsPhone.join('; ') || 'none');

    await page.close();

  } finally {
    await browser.close();
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });