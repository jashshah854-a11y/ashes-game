'use strict';
// Real browser check for the reinforce UI (Cycle 21 step 3), in
// headless Chromium through Playwright, against the repo's index.html on
// seed 1, in the cancel-check pattern. Every expected number is derived
// in node from Sim (Sim.createGame, Sim.reinforceInfo, Sim.reinforceUnit,
// Sim.reinforceCost, Sim.CFG).
// Scenario A: eligible unit, click reinforce. Seed 1 game; first player
// infantry at capital; strength 5; equipment 90. Node readout shows
// buyablePoints 6, total cost 90. After select: exactly one .btn-reinforce,
// line text and button text match node readout, details show 5 of 12 hp.
// Click: details show 11 of 12 hp, equipment stat 0, no .btn-reinforce,
// reinforce line shows not enough equipment reason from fresh node readout
// on post-click state.
// Scenario B: full strength. Seed 1, no damage. Select capital infantry.
// Zero .btn-reinforce; line text equals 'Reinforce: ' plus node reason.
// Scenario C: fought recently. Seed 1; damage infantry to 5; set
// lastCombatDay to state.day; equipment 500. Zero .btn-reinforce; line
// text equals 'Reinforce: ' plus node reason naming battle day.
// Scenario D: not enough equipment. Seed 1; damage infantry to 5;
// equipment 10. Zero .btn-reinforce; line text equals 'Reinforce: ' plus
// node reason.
// Vocabulary audit: #unit-reinforce text contains none of
// reinforceUnit, reinforceInfo, reinforceCost, lastCombatDay, underscore,
// or undefined.
// Final check: no page errors.
// Usage: node tools/reinforce-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const CFG = Sim.CFG;
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



async function getUnitReinforceLine(page) {
  return page.textContent('#unit-reinforce .unit-reinforce-line');
}

async function getUnitReinforceButtons(page) {
  return page.evaluate(() => {
    const btns = document.querySelectorAll('#unit-reinforce .btn-reinforce');
    return Array.from(btns).map(b => b.textContent.trim());
  });
}

async function getUnitDetails(page) {
  return page.textContent('#unit-details');
}

async function getEquipmentStat(page) {
  return page.textContent('#stat-equipment');
}

async function getUnitNotice(page) {
  return page.textContent('#unit-notice');
}

async function getUnitReinforceAllText(page) {
  return page.textContent('#unit-reinforce');
}

// Vocabulary audit: banned words in reinforce line and button text
const BANNED_WORDS = ['reinforceUnit', 'reinforceInfo', 'reinforceCost', 'lastCombatDay', '_', 'undefined'];

function checkVocabulary(text) {
  const hits = BANNED_WORDS.filter(w => text.toLowerCase().indexOf(w.toLowerCase()) !== -1);
  return { ok: hits.length === 0, hits };
}

// ---------- Build staged states in node ----------

// Helper: get the first player infantry unit at the capital
function getFirstCapitalInfantry(state) {
  const capitalId = state.nations.player.capitalId;
  const units = state.units.filter(u => u.nation === 'player' && u.type === 'infantry' && u.provinceId === capitalId && u.strength > 0);
  units.sort((a, b) => a.id - b.id);
  return units[0];
}

// Base fresh game for reference numbers
const fresh = Sim.createGame(1);
const capitalInfantry = getFirstCapitalInfantry(fresh);
const infLabel = CFG.unitTypes.infantry.label;
const costPerPoint = CFG.reinforceEquipmentPerPoint;
const capitalId = fresh.nations.player.capitalId;

// ---------- Scenario A: eligible, click reinforce ----------
// Build staged state for node readouts
const sA = Sim.createGame(1);
const uA = getFirstCapitalInfantry(sA);
uA.strength = 5;
sA.nations.player.equipment = 90;
const infoA = Sim.reinforceInfo(sA, uA.id);
const buyableA = infoA.buyablePoints;
const totalCostA = Sim.reinforceCost(buyableA);
const pointWordA = buyableA === 1 ? 'point' : 'points';
const eligibleLineA = 'Reinforce: this unit is at ' + infoA.strength + ' of ' + infoA.maxStrength + ' hit points. It can regain ' + buyableA + ' strength ' + pointWordA + ' for ' + totalCostA + ' equipment (' + infoA.costPerPoint + ' equipment per point). You have ' + infoA.equipment + ' equipment.';
const buttonTextA = 'Reinforce: restore ' + buyableA + ' strength for ' + totalCostA + ' equipment';

// Post-click expected state: apply reinforce to a copy for node readout
const sApost = Sim.createGame(1);
const uApost = getFirstCapitalInfantry(sApost);
uApost.strength = 5;
sApost.nations.player.equipment = 90;
Sim.reinforceUnit(sApost, uApost.id);
const infoApost = Sim.reinforceInfo(sApost, uApost.id);
const postReasonA = infoApost.reason; // should be not enough equipment
const postLineA = 'Reinforce: ' + postReasonA;

// ---------- Scenario B: full strength ----------
const sB = Sim.createGame(1);
const uB = getFirstCapitalInfantry(sB);
// full strength (12), equipment high
sB.nations.player.equipment = 500;
const infoB = Sim.reinforceInfo(sB, uB.id);
const reasonB = infoB.reason;
const lineB = 'Reinforce: ' + reasonB;

const saveTextB = Save.serializeSave(sB).text;
fs.writeFileSync('/tmp/reinforce-B.json', saveTextB);

const saveTextA = Save.serializeSave(sA).text;
fs.writeFileSync('/tmp/reinforce-A.json', saveTextA);
// ---------- Scenario C: fought recently ----------
const sC = Sim.createGame(1);
const uC = getFirstCapitalInfantry(sC);
uC.strength = 5;
uC.lastCombatDay = sC.day; // fought today
sC.nations.player.equipment = 500;
const infoC = Sim.reinforceInfo(sC, uC.id);
const reasonC = infoC.reason;
const lineC = 'Reinforce: ' + reasonC;

const saveTextC = Save.serializeSave(sC).text;
fs.writeFileSync('/tmp/reinforce-C.json', saveTextC);

// ---------- Scenario D: not enough equipment ----------
const sD = Sim.createGame(1);
const uD = getFirstCapitalInfantry(sD);
uD.strength = 5;
sD.nations.player.equipment = 10;
const infoD = Sim.reinforceInfo(sD, uD.id);
const reasonD = infoD.reason;
const lineD = 'Reinforce: ' + reasonD;

const saveTextD = Save.serializeSave(sD).text;
fs.writeFileSync('/tmp/reinforce-D.json', saveTextD);

// ---------- Scenario E: Dominion reinforce in war log ----------
const sE = Sim.createGame(1);
const enemyCapitalId = sE.nations.enemy.capitalId;
const uE = sE.units.find(u => u.nation === 'enemy' && u.type === 'infantry' && u.provinceId === enemyCapitalId && u.strength > 0);
assert.ok(uE, 'need a Dominion infantry on its capital for Scenario E');
uE.strength = 5;
sE.nations.enemy.equipment = 500;
const resE = Sim.reinforceUnit(sE, uE.id);
assert.strictEqual(resE.ok, true, 'Scenario E node reinforce must succeed');
const expectedLogMsgE = sE.log[sE.log.length - 1].msg;
// Serialize and write
const saveTextE = Save.serializeSave(sE).text;
fs.writeFileSync('/tmp/reinforce-E.json', saveTextE);
// Read back in node to verify save round trip
const desE = Save.deserializeSave(saveTextE);
let scenarioESkipBrowser = false;
if (!desE.ok) {
  check('Scenario E: node deserialize ok', false, 'deserialize failed: ' + desE.reason);
  scenarioESkipBrowser = true;
} else {
  check('Scenario E: node deserialize ok', desE.ok, 'deserialize ok');
  const restoredLogMsgE = desE.state.log[desE.state.log.length - 1].msg;
  check('Scenario E: restored state log contains exact message', restoredLogMsgE === expectedLogMsgE, 'expected: ' + expectedLogMsgE + ' got: ' + restoredLogMsgE);
}

// ---------- Browser checks ----------

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    // Scenario A: import the staged save, then select the unit and click reinforce.
    // We'll do this by importing a staged save.
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save A (strength 5, equipment 90)
    const [fileChooserA] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserA.setFiles('/tmp/reinforce-A.json');
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    // Click the capital province to select it (and its unit)
    await H.clickWhenClear(page, '.province[data-prov="' + capitalId + '"]');
    await H.tryWait(async () => {
      const txt = await page.textContent('#unit-reinforce .unit-reinforce-line');
      return txt && txt.trim().length > 0;
    }, 2000);
    await H.dismissBurst(page);

    // Check reinforce UI
    const btnsA = await getUnitReinforceButtons(page);
    check('Scenario A: exactly one reinforce button', btnsA.length === 1, 'found: ' + btnsA.length);
    if (btnsA.length === 1) {
      check('Scenario A: button text matches', btnsA[0] === buttonTextA, 'got: ' + btnsA[0] + ' expected: ' + buttonTextA);
      const vocabBtn = checkVocabulary(btnsA[0]);
      check('Scenario A: button vocabulary audit clean', vocabBtn.ok, vocabBtn.hits.join(', ') || 'clean');
    }

    const lineA = await getUnitReinforceLine(page);
    check('Scenario A: line text matches node readout', lineA.trim() === eligibleLineA.trim(), 'got: ' + lineA + ' expected: ' + eligibleLineA);
    const vocabLineA = checkVocabulary(lineA);
    check('Scenario A: line vocabulary audit clean', vocabLineA.ok, vocabLineA.hits.join(', ') || 'clean');

    const detailsA = await getUnitDetails(page);
    check('Scenario A: unit details show 5 of 12 hp', detailsA.indexOf('strength 5 hit points of 12 hit points') !== -1, detailsA);

    // Click the reinforce button
    await H.clickWhenClear(page, '#unit-reinforce .btn-reinforce');
    await H.tryWait(async () => {
      const txt = await page.textContent('#unit-details');
      return txt && txt.indexOf('strength 11 hit points of 12 hit points') !== -1;
    }, 2000);
    await H.dismissBurst(page);

    // After click: details show 11 of 12 hp
    const detailsA2 = await getUnitDetails(page);
    check('Scenario A: after click unit shows 11 of 12 hp', detailsA2.indexOf('strength 11 hit points of 12 hit points') !== -1, detailsA2);

    // Equipment stat shows 0
    const equipA2 = await getEquipmentStat(page);
    check('Scenario A: equipment stat is 0', equipA2.trim() === '0', 'got: ' + equipA2);

    // No reinforce button remains
    const btnsA2 = await getUnitReinforceButtons(page);
    check('Scenario A: zero reinforce buttons after click', btnsA2.length === 0, 'found: ' + btnsA2.length);

    // Reinforce line shows not enough equipment reason from fresh node readout
    const lineA2 = await getUnitReinforceLine(page);
    check('Scenario A: post-click line matches node readout', lineA2.trim() === postLineA.trim(), 'got: ' + lineA2 + ' expected: ' + postLineA);
    const vocabLineA2 = checkVocabulary(lineA2);
    check('Scenario A: post-click line vocabulary clean', vocabLineA2.ok, vocabLineA2.hits.join(', ') || 'clean');

    // Vocabulary audit on all reinforce text
    const allTextA = await getUnitReinforceAllText(page);
    const vocabAllA = checkVocabulary(allTextA);
    check('Scenario A: full reinforce text vocabulary clean', vocabAllA.ok, vocabAllA.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario B: full strength ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save B (full strength)
    const [fileChooserB] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserB.setFiles('/tmp/reinforce-B.json');
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    // Click the capital province
    await H.clickWhenClear(page, '.province[data-prov="' + capitalId + '"]');
    await H.tryWait(async () => {
      const txt = await page.textContent('#unit-reinforce .unit-reinforce-line');
      return txt && txt.trim().length > 0;
    }, 2000);
    await H.dismissBurst(page);

    // Zero reinforce buttons
    const btnsB = await getUnitReinforceButtons(page);
    check('Scenario B: zero reinforce buttons', btnsB.length === 0, 'found: ' + btnsB.length);

    // Line text equals 'Reinforce: ' plus node reason
    const pageLineB = await getUnitReinforceLine(page);
    check('Scenario B: line text matches node readout', pageLineB.trim() === lineB.trim(), 'got: ' + pageLineB + ' expected: ' + lineB);
    const vocabLineB = checkVocabulary(pageLineB);
    check('Scenario B: line vocabulary audit clean', vocabLineB.ok, vocabLineB.hits.join(', ') || 'clean');

    // Vocabulary audit on all reinforce text
    const allTextB = await getUnitReinforceAllText(page);
    const vocabAllB = checkVocabulary(allTextB);
    check('Scenario B: full reinforce text vocabulary clean', vocabAllB.ok, vocabAllB.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario C: fought recently ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save C (fought today)
    const [fileChooserC] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserC.setFiles('/tmp/reinforce-C.json');
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    // Click the capital province
    await H.clickWhenClear(page, '.province[data-prov="' + capitalId + '"]');
    await H.tryWait(async () => {
      const txt = await page.textContent('#unit-reinforce .unit-reinforce-line');
      return txt && txt.trim().length > 0;
    }, 2000);
    await H.dismissBurst(page);

    // Zero reinforce buttons
    const btnsC = await getUnitReinforceButtons(page);
    check('Scenario C: zero reinforce buttons', btnsC.length === 0, 'found: ' + btnsC.length);

    // Line text equals 'Reinforce: ' plus node reason, and reason names the battle day
    const pageLineC = await getUnitReinforceLine(page);
    check('Scenario C: line text matches node readout', pageLineC.trim() === lineC.trim(), 'got: ' + pageLineC + ' expected: ' + lineC);
    check('Scenario C: reason names battle day ' + sC.day, pageLineC.indexOf('day ' + sC.day) !== -1, pageLineC);
    const vocabLineC = checkVocabulary(pageLineC);
    check('Scenario C: line vocabulary audit clean', vocabLineC.ok, vocabLineC.hits.join(', ') || 'clean');

    // Vocabulary audit on all reinforce text
    const allTextC = await getUnitReinforceAllText(page);
    const vocabAllC = checkVocabulary(allTextC);
    check('Scenario C: full reinforce text vocabulary clean', vocabAllC.ok, vocabAllC.hits.join(', ') || 'clean');

    // Scenario C addition: line states the day the unit can be reinforced again
    const expectedEligibilityDay = 'It can be reinforced again on day ' + (infoC.lastCombatDay + 2) + '.';
    check('Scenario C: line states the day the unit can be reinforced again', pageLineC.indexOf(expectedEligibilityDay) !== -1, 'expected: ' + expectedEligibilityDay + ' in: ' + pageLineC);

    await page.close();

    // ---------- Scenario D: not enough equipment ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save D (not enough equipment)
    const [fileChooserD] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserD.setFiles('/tmp/reinforce-D.json');
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    // Click the capital province
    await H.clickWhenClear(page, '.province[data-prov="' + capitalId + '"]');
    await H.tryWait(async () => {
      const txt = await page.textContent('#unit-reinforce .unit-reinforce-line');
      return txt && txt.trim().length > 0;
    }, 2000);
    await H.dismissBurst(page);

    // Zero reinforce buttons
    const btnsD = await getUnitReinforceButtons(page);
    check('Scenario D: zero reinforce buttons', btnsD.length === 0, 'found: ' + btnsD.length);

    // Line text equals 'Reinforce: ' plus node reason
    const pageLineD = await getUnitReinforceLine(page);
    check('Scenario D: line text matches node readout', pageLineD.trim() === lineD.trim(), 'got: ' + pageLineD + ' expected: ' + lineD);
    const vocabLineD = checkVocabulary(pageLineD);
    check('Scenario D: line vocabulary audit clean', vocabLineD.ok, vocabLineD.hits.join(', ') || 'clean');

    // Vocabulary audit on all reinforce text
    const allTextD = await getUnitReinforceAllText(page);
    const vocabAllD = checkVocabulary(allTextD);
    check('Scenario D: full reinforce text vocabulary clean', vocabAllD.ok, vocabAllD.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario E: Dominion reinforce in war log ----------
    if (!scenarioESkipBrowser) {
      page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await H.ensurePaused(page);
      await H.dismissBurst(page);

      // Import save E
      const [fileChooserE] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#btn-import')
      ]);
      await fileChooserE.setFiles('/tmp/reinforce-E.json');
      await H.waitFor(page, async () => {
        const notice = (await page.textContent('#save-notice')).trim();
        return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
      }, 5000);
      await H.dismissBurst(page);

      // Read war log element #log text and check it contains the exact expected message
      const logText = await page.textContent('#log');
      check('Scenario E: Dominion reinforce line renders in the war log', logText.indexOf(expectedLogMsgE) !== -1, 'expected message not found in log');
      check('Scenario E: war log message contains no underscore', !expectedLogMsgE.includes('_'), 'message: ' + expectedLogMsgE);

      await page.close();
    }

    // ---------- Page errors ----------
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });