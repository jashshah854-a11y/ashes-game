'use strict';
// Real browser check for Cycle 22 Step 3, visible progression part one on the
// map (presentation only), in headless Chromium through Playwright against the
// repo's index.html on seed 1. Every expected string is built in node from the
// staged states after they are read back, never copied from the page.
//
// Staging happens in node only, and both saves are read back before any browser
// use:
//   Early save: Sim.createGame(1) unchanged, serialized with js/save.js,
//   written to a temp file in os.tmpdir(), read back with deserializeSave. Node
//   asserts: ok true, province p0_3 factoryLevel is 2, the unit with id 5 has
//   strength 12 and maxStrength 12, and the edge between p0_3 and p1_3 has a
//   rail with daysLeft 0.
//   Developed save: Sim.createGame(1), then province p0_3 factoryLevel set to 3,
//   p1_2 factoryLevel set to 2, p3_0 left at factoryLevel 1, the unit with id 5
//   strength set to 5 (it stands at p0_3, maxStrength 12), the unit with id 6
//   left at full strength at p0_3, and the edge between p0_0 and p1_0 set to
//   rail { owner: player, daysLeft: 3 }. Serialized, written, read back. Node
//   asserts: ok true, the factory levels are 3 at p0_3, 2 at p1_2, and 1 at
//   p3_0, unit 5 strength is 5, and that edge rail daysLeft is 3.
//
// Browser Scenario A (early save imported through #btn-import): the p0_3 tile
// has a factory badge with class lvl2 and text Factory 2; no tile has a lvl3
// factory badge; every live unit plaque on the map reads its node derived
// numeral at full strength (no damaged stack); the p0_3 player infantry plaque
// reads the node derived numeral COUNTxSTRENGTH; the right rail bar of p0_3 has
// class built and not building; no rail bar on the map has class building.
//
// Browser Scenario B (developed save imported, fresh page): p3_0, p1_2, and
// p0_3 carry factory badges lvl1, lvl2, lvl3 with texts Factory 1, Factory 2,
// Factory 3; the computed font sizes strictly increase; the computed background
// colors of lvl2 and lvl3 differ; the lvl3 badge border top width exceeds the
// lvl1 one; p0_3 has exactly one player infantry plaque, its numeral equals the
// node descriptor numeral, its total strength is lower than the same stack at
// full strength (node), its count matches the Scenario A plaque and its total is
// lower than that full strength plaque's, and the drop equals the node strength
// loss of unit 5; the right rail bar of p0_3 has class built; the right rail bar of p0_0 has class
// building and not built; the bottom rail bar of p0_0 does not exist; the
// legend text contains the factory tier, finished railroad, no bar, and damaged
// plaque number sentences; the map and legend text together contain none of undefined,
// NaN, or [object; and there are no page errors in either scenario.
//
// Cycle 23 step 9 shape change, named: unit chips are gone from the board, and
// the plaque numeral IS the damage display now. A plaque groups a stack by
// nation and type, so the per unit chip label and the red damaged chip color
// have no plaque counterpart; each chip assertion became a plaque numeral
// assertion one for one, and the total (37) is unchanged.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/map-progression-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');
const os = require('os');

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
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=1';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// Find an edge in the read back state by its two province ids, using the
// edgeList the save carries, so a missing edge is a clean null rather than a
// crash in the node checks.
function findEdge(state, aId, bId) {
  for (let i = 0; i < state.edgeList.length; i++) {
    const e = state.edgeList[i];
    if ((e.a === aId && e.b === bId) || (e.a === bId && e.b === aId)) return e;
  }
  return null;
}

function findUnit(state, id) {
  for (let i = 0; i < state.units.length; i++) if (state.units[i].id === id) return state.units[i];
  return null;
}

// Node side plaque descriptors from the read back state, keyed by
// province|nation|type, so the page numerals are compared against node truth,
// never against themselves. fullNumeral is the same stack at full strength
// (count x the sum of maxStrength), the reference a damaged numeral must undercut.
function plaqueTruth(state) {
  const out = {};
  AshesPlaques.buildPlaques(playerView(state)).unitPlaques.forEach((d) => {
    if (d.hollow || d.numeral === null) return;
    const units = Sim.unitsIn(state, d.provinceId).filter((u) => u.nation === d.nation && u.type === d.type);
    const full = units.reduce((sum, u) => sum + u.maxStrength, 0);
    out[d.provinceId + '|' + d.nation + '|' + d.type] = {
      numeral: d.numeral,
      count: d.count,
      total: d.totalStrength,
      fullNumeral: d.count + 'x' + full,
      fullTotal: full
    };
  });
  return out;
}

function parseNumeral(text) {
  const m = /^([0-9]+)x([0-9]+)$/.exec(text || '');
  return m ? { count: Number(m[1]), total: Number(m[2]) } : null;
}

// ---------- Stage both saves in node and read them back ----------

const earlyState = Sim.createGame(1);
const earlyText = Save.serializeSave(earlyState).text;
const earlyPath = path.join(os.tmpdir(), 'map-progression-early.json');
fs.writeFileSync(earlyPath, earlyText);
const earlyRead = Save.deserializeSave(earlyText);

check('Early save reads back ok', earlyRead.ok === true, earlyRead.reason || '');
let earlyRestored = earlyRead.ok ? earlyRead.state : null;
if (earlyRestored) {
  check('Early save p0_3 factoryLevel is 2', earlyRestored.provinces['p0_3'].factoryLevel === 2, 'is ' + earlyRestored.provinces['p0_3'].factoryLevel);
  const earlyUnit = findUnit(earlyRestored, 5);
  check('Early save unit 5 strength 12 and maxStrength 12', !!earlyUnit && earlyUnit.strength === 12 && earlyUnit.maxStrength === 12, earlyUnit ? earlyUnit.strength + '/' + earlyUnit.maxStrength : 'missing');
  const earlyRail = findEdge(earlyRestored, 'p0_3', 'p1_3');
  check('Early save p0_3 to p1_3 rail daysLeft 0', !!earlyRail && !!earlyRail.rail && earlyRail.rail.daysLeft === 0, earlyRail && earlyRail.rail ? String(earlyRail.rail.daysLeft) : 'no rail');
}

const devState = Sim.createGame(1);
devState.provinces['p0_3'].factoryLevel = 3;
devState.provinces['p1_2'].factoryLevel = 2;
// p3_0 stays at its starting factoryLevel 1.
const devUnit5 = findUnit(devState, 5);
devUnit5.strength = 5;
// Unit 6 stays at full strength at p0_3.
const devEdge = findEdge(devState, 'p0_0', 'p1_0');
devEdge.rail = { owner: 'player', daysLeft: 3 };
const devText = Save.serializeSave(devState).text;
const devPath = path.join(os.tmpdir(), 'map-progression-developed.json');
fs.writeFileSync(devPath, devText);
const devRead = Save.deserializeSave(devText);

check('Developed save reads back ok', devRead.ok === true, devRead.reason || '');
let devRestored = devRead.ok ? devRead.state : null;
if (devRestored) {
  check('Developed save factory levels are 3, 2, 1',
    devRestored.provinces['p0_3'].factoryLevel === 3 &&
    devRestored.provinces['p1_2'].factoryLevel === 2 &&
    devRestored.provinces['p3_0'].factoryLevel === 1,
    [devRestored.provinces['p0_3'].factoryLevel, devRestored.provinces['p1_2'].factoryLevel, devRestored.provinces['p3_0'].factoryLevel].join(','));
  const devUnit5Back = findUnit(devRestored, 5);
  check('Developed save unit 5 strength is 5', !!devUnit5Back && devUnit5Back.strength === 5, devUnit5Back ? String(devUnit5Back.strength) : 'missing');
  const devRailBack = findEdge(devRestored, 'p0_0', 'p1_0');
  check('Developed save p0_0 to p1_0 rail daysLeft 3', !!devRailBack && !!devRailBack.rail && devRailBack.rail.daysLeft === 3, devRailBack && devRailBack.rail ? String(devRailBack.rail.daysLeft) : 'no rail');
}

// Node derived expected plaque numerals from the read back states.
const devUnit5Node = devRestored ? findUnit(devRestored, 5) : null;
const earlyTruth = earlyRestored ? plaqueTruth(earlyRestored) : {};
const devTruth = devRestored ? plaqueTruth(devRestored) : {};
const INF_KEY = 'p0_3|player|infantry';
const expectedEarlyInf = earlyTruth[INF_KEY] || null;
const expectedDevInf = devTruth[INF_KEY] || null;
const devUnit5Loss = devUnit5Node ? devUnit5Node.maxStrength - devUnit5Node.strength : null;

// ---------- Browser page helpers ----------

// Live plaques on the board, optionally for one province (by dataset.province).
async function boardPlaques(page, provId) {
  return page.$$eval('#map-board .plaque-layer .plaque.plaque-live', (els, provId) =>
    els.filter(e => !provId || e.dataset.province === provId).map(e => {
      const n = e.querySelector('.numeral');
      return { province: e.dataset.province, nation: e.dataset.nation, type: e.dataset.type, numeral: n ? n.textContent : null };
    }), provId || null
  );
}

async function tileFactoryBadges(page, provId) {
  return page.$$eval('.province[data-prov="' + provId + '"] .factory-badge', els =>
    els.map(e => ({ text: e.textContent.trim(), className: e.className }))
  );
}

async function tileRailBar(page, provId, side) {
  return page.$$eval('.province[data-prov="' + provId + '"] .rail-bar.' + side, els =>
    els.map(e => ({ className: e.className, built: e.classList.contains('built'), building: e.classList.contains('building') }))
  );
}

async function badgeStyle(page, provId) {
  return page.$eval('.province[data-prov="' + provId + '"] .factory-badge', e => {
    const cs = getComputedStyle(e);
    return { fontSize: cs.fontSize, backgroundColor: cs.backgroundColor, borderTopWidth: cs.borderTopWidth, color: cs.color };
  });
}

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#btn-import')
  ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => {
    const notice = (await page.textContent('#save-notice')).trim();
    return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
  }, 5000);
  await H.ensurePaused(page);
  await H.dismissBurst(page);
}

// ---------- Browser checks ----------

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    // ---------- Scenario A: early save imported ----------
    const errorsA = [];
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errorsA.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    await importSave(page, earlyPath);
    await H.waitFor(page, async () => await page.$('.province[data-prov="p0_3"] .factory-badge') !== null, 5000);

    const badgeA = await tileFactoryBadges(page, 'p0_3');
    check('Scenario A: p0_3 has one factory badge', badgeA.length === 1, 'found ' + badgeA.length);
    if (badgeA.length === 1) {
      check('Scenario A: p0_3 factory badge has class lvl2', badgeA[0].className.split(/\s+/).indexOf('lvl2') !== -1, badgeA[0].className);
      check('Scenario A: p0_3 factory badge text is Factory 2', badgeA[0].text === 'Factory 2', badgeA[0].text);
    }

    const lvl3CountA = await page.$$eval('#map .factory-badge.lvl3', els => els.length);
    check('Scenario A: no lvl3 factory badge on the map', lvl3CountA === 0, 'found ' + lvl3CountA);

    const plaquesA = (await boardPlaques(page)).filter(p => p.numeral !== null);
    const damagedA = plaquesA.filter(p => {
      const t = earlyTruth[p.province + '|' + p.nation + '|' + p.type];
      return !t || p.numeral !== t.numeral || t.numeral !== t.fullNumeral;
    });
    check('Scenario A: no damaged stack on the map: every live plaque numeral equals its node full strength numeral',
      plaquesA.length > 0 && damagedA.length === 0, 'plaques ' + plaquesA.length + ' off: ' + JSON.stringify(damagedA.slice(0, 3)));

    const infA = (await boardPlaques(page, 'p0_3')).filter(p => p.nation === 'player' && p.type === 'infantry');
    const infNumeralA = infA.length === 1 ? infA[0].numeral : null;
    check('Scenario A: p0_3 full strength infantry plaque reads node derived numeral',
      !!expectedEarlyInf && infA.length === 1 && infNumeralA === expectedEarlyInf.numeral && infNumeralA === expectedEarlyInf.fullNumeral,
      'plaques: ' + JSON.stringify(infA.map(p => p.numeral)) + ' expected: ' + (expectedEarlyInf && expectedEarlyInf.numeral));

    const railA = await tileRailBar(page, 'p0_3', 'r');
    check('Scenario A: p0_3 right rail bar has class built and not building', railA.length === 1 && railA[0].built === true && railA[0].building === false, JSON.stringify(railA));

    const buildingCountA = await page.$$eval('#map .rail-bar.building', els => els.length);
    check('Scenario A: no rail bar on the map has class building', buildingCountA === 0, 'found ' + buildingCountA);

    check('Scenario A: no page errors', errorsA.length === 0, errorsA.join('; ') || 'none');

    await page.close();

    // ---------- Scenario B: developed save imported, fresh page ----------
    const errorsB = [];
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errorsB.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    await importSave(page, devPath);
    await H.waitFor(page, async () => await page.$('.province[data-prov="p0_3"] .factory-badge.lvl3') !== null, 5000);

    const badgeLvl1 = await tileFactoryBadges(page, 'p3_0');
    const badgeLvl2 = await tileFactoryBadges(page, 'p1_2');
    const badgeLvl3 = await tileFactoryBadges(page, 'p0_3');
    check('Scenario B: p3_0 has factory badge lvl1 with text Factory 1', badgeLvl1.length === 1 && badgeLvl1[0].className.split(/\s+/).indexOf('lvl1') !== -1 && badgeLvl1[0].text === 'Factory 1', JSON.stringify(badgeLvl1));
    check('Scenario B: p1_2 has factory badge lvl2 with text Factory 2', badgeLvl2.length === 1 && badgeLvl2[0].className.split(/\s+/).indexOf('lvl2') !== -1 && badgeLvl2[0].text === 'Factory 2', JSON.stringify(badgeLvl2));
    check('Scenario B: p0_3 has factory badge lvl3 with text Factory 3', badgeLvl3.length === 1 && badgeLvl3[0].className.split(/\s+/).indexOf('lvl3') !== -1 && badgeLvl3[0].text === 'Factory 3', JSON.stringify(badgeLvl3));

    const style1 = await badgeStyle(page, 'p3_0');
    const style2 = await badgeStyle(page, 'p1_2');
    const style3 = await badgeStyle(page, 'p0_3');
    check('Scenario B: factory badge font sizes strictly increasing',
      parseFloat(style1.fontSize) < parseFloat(style2.fontSize) && parseFloat(style2.fontSize) < parseFloat(style3.fontSize),
      [style1.fontSize, style2.fontSize, style3.fontSize].join(' < '));
    check('Scenario B: lvl2 and lvl3 badge background colors differ', style2.backgroundColor !== style3.backgroundColor, style2.backgroundColor + ' vs ' + style3.backgroundColor);
    check('Scenario B: lvl3 border top width exceeds lvl1', parseFloat(style3.borderTopWidth) > parseFloat(style1.borderTopWidth), style3.borderTopWidth + ' vs ' + style1.borderTopWidth);

    // Five chip checks become five plaque numeral checks: the damaged stack
    // is unit 5 (strength 5 of 12) grouped with unit 6 in one infantry plaque.
    const infB = (await boardPlaques(page, 'p0_3')).filter(p => p.nation === 'player' && p.type === 'infantry');
    check('Scenario B: p0_3 has exactly one player infantry plaque (the damaged stack)', infB.length === 1, 'found ' + infB.length);
    const parsedB = infB.length === 1 ? parseNumeral(infB[0].numeral) : null;
    if (infB.length === 1) {
      check('Scenario B: damaged stack plaque reads node derived numeral', !!expectedDevInf && infB[0].numeral === expectedDevInf.numeral,
        'got: ' + infB[0].numeral + ' expected: ' + (expectedDevInf && expectedDevInf.numeral));
    }
    check('Scenario B: damaged stack numeral total strength is lower than the same stack at full strength (node)',
      !!parsedB && !!expectedDevInf && parsedB.count === expectedDevInf.count && parsedB.total < expectedDevInf.fullTotal,
      'got: ' + (infB[0] && infB[0].numeral) + ' full: ' + (expectedDevInf && expectedDevInf.fullNumeral));

    const parsedA = parseNumeral(infNumeralA);
    check('Scenario B: damaged plaque keeps the Scenario A count and shows a lower total than that full strength plaque',
      !!parsedA && !!parsedB && parsedA.count === parsedB.count && parsedB.total < parsedA.total,
      'A: ' + infNumeralA + ' B: ' + (infB[0] && infB[0].numeral));
    if (parsedA && parsedB) {
      check('Scenario B: the plaque total drops by exactly the node strength loss of unit 5', parsedA.total - parsedB.total === devUnit5Loss,
        'drop ' + (parsedA.total - parsedB.total) + ' expected ' + devUnit5Loss);
    }

    const railBuiltB = await tileRailBar(page, 'p0_3', 'r');
    check('Scenario B: p0_3 right rail bar has class built', railBuiltB.length === 1 && railBuiltB[0].built === true, JSON.stringify(railBuiltB));

    const railBuildingB = await tileRailBar(page, 'p0_0', 'r');
    check('Scenario B: p0_0 right rail bar has class building and not built', railBuildingB.length === 1 && railBuildingB[0].building === true && railBuildingB[0].built === false, JSON.stringify(railBuildingB));

    const railBottomB = await tileRailBar(page, 'p0_0', 'b');
    check('Scenario B: p0_0 bottom rail bar does not exist', railBottomB.length === 0, 'found ' + railBottomB.length);

    const legendText = (await page.textContent('#map-legend')).replace(/\s+/g, ' ');
    check('Scenario B: legend has factory tier sentence parts', legendText.indexOf('level 1 is the smallest') !== -1 && legendText.indexOf('level 3 is the largest and brightest') !== -1, 'factory tier words missing');
    check('Scenario B: legend has finished railroad sentence', legendText.indexOf('thick solid pale bar') !== -1, 'finished railroad words missing');
    check('Scenario B: legend has no bar sentence', legendText.indexOf('No bar on a shared border means there is no railroad there') !== -1, 'no bar words missing');
    check('Scenario B: legend has damaged plaque number words', legendText.indexOf('A unit below full strength lowers the total strength in its plaque number') !== -1, 'damaged plaque words missing');

    const mapAndLegend = ((await page.textContent('#map')) + ' ' + legendText).replace(/\s+/g, ' ');
    const vocabHits = ['undefined', 'NaN', '[object'].filter(w => mapAndLegend.indexOf(w) !== -1);
    check('Scenario B: map and legend text contain no undefined, NaN, or [object', vocabHits.length === 0, vocabHits.join(', ') || 'clean');

    check('Scenario B: no page errors', errorsB.length === 0, errorsB.join('; ') || 'none');

    await page.close();

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });