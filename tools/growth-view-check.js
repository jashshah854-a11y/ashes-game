'use strict';
// Real exit proof browser check for Cycle 22 Step 4, the Campaign growth card
// (index.html #progression-card, renderProgression in js/main.js), in headless
// Chromium through Playwright against the repo's index.html on seed 1. Every
// expected string is built in node from the READ BACK history of each staged
// save, never from the original staged object and never copied from the page.
//
// Scenario A, one snapshot: Sim.createGame(1) is serialized with js/save.js,
// written to a temp file in os.tmpdir(), and read back with deserializeSave.
// Node checks: ok is true; both nations carry exactly 1 snapshot; both first
// snapshots are day 1; the read back player snapshot equals the staged object
// field by field on all eight fields.
// Browser: a fresh page at ?seed=1 imports save A. For each nation block under
// #progression-blocks (nth-child 1 and 2): exactly 1 snapshot row (rows whose
// text starts with 'Day ') with the exact text built from the read back
// snapshot; exactly 1 only day 1 line with the exact text; and zero
// .progression-change rows in the whole card.
//
// Scenario B, three snapshots: Sim.createGame(1) ticked with Sim.tick until
// gameOver (cap 400). Serialized, written, read back. Node checks: ok true;
// both nations have exactly 3 snapshots; the days are 1, 30, and a final day
// greater than 30 for both nations.
// Browser: a fresh page imports save B. Per nation: exactly 3 snapshot rows,
// each text exact from the read back history; exactly 1 .progression-change row
// with the exact signed change text; and no only day 1 line.
//
// Scenario C, six snapshots, staged (this is a staged history on a fresh game
// set to day 150, not a played campaign): Sim.createGame(1) is set to day 150
// and both nation histories are replaced with the six snapshot objects in
// order. Serialized, written, read back. Node checks: ok true; both nations
// have exactly 6 snapshots; every read back snapshot equals the staged values
// field by field on all eight fields, with all six days per nation and the last
// snapshot steel and manpower per nation asserted.
// Browser: a fresh page imports save C. Per nation: exactly 6 snapshot rows,
// each text exact from the read back history; exactly 1 change row exact; and
// no only day 1 line.
//
// Scenario D, damaged history never reaches the view: the Scenario B save text
// is read back into a fresh state object and that state's history.player[1].day
// is set to 999, then serialized to textD. Node checks:
// Save.deserializeSave(textD).ok is false and its reason starts with 'The saved
// campaign history is damaged'. That exact reason string is the expected notice
// for the page.
// Browser: a fresh page (a paused seed 1 game, which shows 1 snapshot per
// nation) imports textD. The #save-notice text equals the node expected reason
// exactly; the progression card still shows exactly 1 snapshot row per nation,
// and that row equals the fresh game day 1 expected row built from a node
// mirror Sim.createGame(1) history; and there are zero change rows.
//
// Vocabulary audit in scenarios A, B, and C: the full #progression-card text
// contains none of: state.history, historySnapshot, campaignHistory, CFG,
// undefined, NaN, [object, or an underscore character.
//
// Final check: no page errors across all scenarios.
//
// Dismiss any event overlay before interacting, using the helper pattern from
// tools/progression-check.js.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/growth-view-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/meta-chromium/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=1';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// Vocabulary audit: banned words in any progression card text
const BANNED_WORDS = ['state.history', 'historySnapshot', 'campaignHistory', 'CFG', 'undefined', 'NaN', '[object', '_'];

function checkVocabulary(text) {
  const hits = BANNED_WORDS.filter(w => text.indexOf(w) !== -1);
  return { ok: hits.length === 0, hits };
}

// The eight snapshot fields, in the order the sim writes and the renderer reads.
const FIELD_ORDER = ['day', 'provinces', 'factoryLevels', 'armyStrength', 'linesOpen', 'steel', 'equipment', 'manpower'];

// Signed number helper mirroring main.js
function signedNum(n) { return n > 0 ? '+' + n : String(n); }

// Build expected snapshot row text from a snapshot object
function snapshotRowText(snap) {
  return 'Day ' + snap.day + ': ' + snap.provinces + ' provinces held, ' + snap.factoryLevels + ' factory levels, army strength ' + snap.armyStrength + ', ' + snap.linesOpen + ' production lines open, ' + snap.steel + ' steel, ' + snap.equipment + ' equipment, ' + snap.manpower + ' manpower.';
}

// Build expected only-day-1 line
function onlyDay1Line(interval) {
  return 'Only day 1 is recorded so far. The next snapshot is recorded on day ' + interval + '.';
}

// Build expected change row text from the first and last read back snapshots
function changeRowText(first, last) {
  return 'Change since day 1, day ' + last.day + ' compared with day 1: provinces held ' + signedNum(last.provinces - first.provinces) + ', factory levels ' + signedNum(last.factoryLevels - first.factoryLevels) + ', army strength ' + signedNum(last.armyStrength - first.armyStrength) + ', production lines open ' + signedNum(last.linesOpen - first.linesOpen) + ', steel ' + signedNum(last.steel - first.steel) + ', equipment ' + signedNum(last.equipment - first.equipment) + ', manpower ' + signedNum(last.manpower - first.manpower) + '.';
}

// Field by field comparison over the eight fields, returning the mismatches.
function snapshotDiffs(gotList, wantList, label) {
  const diffs = [];
  if (!Array.isArray(gotList) || !Array.isArray(wantList)) { diffs.push(label + ': not a list'); return diffs; }
  if (gotList.length !== wantList.length) { diffs.push(label + ': length ' + gotList.length + ' vs ' + wantList.length); return diffs; }
  for (let i = 0; i < gotList.length; i++) {
    for (let fi = 0; fi < FIELD_ORDER.length; fi++) {
      const f = FIELD_ORDER[fi];
      if (gotList[i][f] !== wantList[i][f]) diffs.push(label + ' snap ' + i + ' ' + f + ': ' + gotList[i][f] + ' vs ' + wantList[i][f]);
    }
  }
  return diffs;
}

// Build one staged snapshot with the keys in the sim's own order.
function makeSnap(day, provinces, factoryLevels, armyStrength, linesOpen, steel, equipment, manpower) {
  return {
    day: day,
    provinces: provinces,
    factoryLevels: factoryLevels,
    armyStrength: armyStrength,
    linesOpen: linesOpen,
    steel: steel,
    equipment: equipment,
    manpower: manpower
  };
}

// ---------- Stage every save in node and read each one back ----------

const interval = Sim.CFG.historyIntervalDays;

// Scenario A: a fresh seed 1 game, one snapshot per nation.
const sA = Sim.createGame(1);
const textA = Save.serializeSave(sA).text;
const savePathA = path.join(os.tmpdir(), 'growth-view-A.json');
fs.writeFileSync(savePathA, textA);
const backA = Save.deserializeSave(textA);

check('Scenario A: save reads back ok', backA.ok === true, backA.reason || '');
const histA = backA.ok ? backA.state.history : null;
check('Scenario A: player history has 1 snapshot', !!histA && Array.isArray(histA.player) && histA.player.length === 1, histA ? 'has ' + histA.player.length : 'no history');
check('Scenario A: enemy history has 1 snapshot', !!histA && Array.isArray(histA.enemy) && histA.enemy.length === 1, histA ? 'has ' + histA.enemy.length : 'no history');
check('Scenario A: both first snapshots are day 1', !!histA && histA.player[0].day === 1 && histA.enemy[0].day === 1, histA ? histA.player[0].day + ',' + histA.enemy[0].day : 'no history');
if (histA) {
  const diffsA = snapshotDiffs([histA.player[0]], [sA.history.player[0]], 'A read back vs staged');
  check('Scenario A: read back player snapshot equals staged object on all eight fields', diffsA.length === 0, diffsA.join(', ') || 'all eight match');
}

// Scenario B: seed 1 ticked to gameOver (cap 400).
const sB = Sim.createGame(1);
let ticksB = 0;
while (!sB.gameOver && ticksB < 400) {
  Sim.tick(sB);
  ticksB++;
}
const textB = Save.serializeSave(sB).text;
const savePathB = path.join(os.tmpdir(), 'growth-view-B.json');
fs.writeFileSync(savePathB, textB);
const backB = Save.deserializeSave(textB);

check('Scenario B: save reads back ok', backB.ok === true, backB.reason || '');
const histB = backB.ok ? backB.state.history : null;
check('Scenario B: player has exactly 3 snapshots', !!histB && Array.isArray(histB.player) && histB.player.length === 3, histB ? 'has ' + histB.player.length : 'no history');
check('Scenario B: enemy has exactly 3 snapshots', !!histB && Array.isArray(histB.enemy) && histB.enemy.length === 3, histB ? 'has ' + histB.enemy.length : 'no history');
if (histB && histB.player.length === 3) {
  check('Scenario B: player days are 1, 30, final above 30', histB.player[0].day === 1 && histB.player[1].day === 30 && histB.player[2].day > 30, histB.player.map(s => s.day).join(','));
}
if (histB && histB.enemy.length === 3) {
  check('Scenario B: enemy days are 1, 30, final above 30', histB.enemy[0].day === 1 && histB.enemy[1].day === 30 && histB.enemy[2].day > 30, histB.enemy.map(s => s.day).join(','));
}

// Scenario C: staged history on a fresh game set to day 150. Not a played
// campaign: the six snapshot objects are placed directly in field order.
const stagedPlayerC = [
  makeSnap(1, 35, 8, 72, 2, 100, 200, 1200),
  makeSnap(30, 36, 10, 84, 2, 140, 320, 1310),
  makeSnap(60, 38, 12, 96, 3, 90, 450, 1420),
  makeSnap(90, 40, 14, 108, 3, 180, 610, 1530),
  makeSnap(120, 42, 16, 120, 3, 230, 790, 1640),
  makeSnap(150, 44, 18, 132, 4, 275, 980, 1750)
];
const stagedEnemyC = [
  makeSnap(1, 35, 9, 72, 2, 110, 210, 1190),
  makeSnap(30, 34, 10, 66, 2, 95, 260, 1280),
  makeSnap(60, 33, 11, 60, 2, 150, 330, 1370),
  makeSnap(90, 32, 12, 54, 2, 120, 410, 1460),
  makeSnap(120, 31, 13, 48, 3, 170, 500, 1550),
  makeSnap(150, 30, 14, 42, 3, 205, 590, 1640)
];
const sC = Sim.createGame(1);
sC.day = 150;
sC.history.player = stagedPlayerC.slice();
sC.history.enemy = stagedEnemyC.slice();
const textC = Save.serializeSave(sC).text;
const savePathC = path.join(os.tmpdir(), 'growth-view-C.json');
fs.writeFileSync(savePathC, textC);
const backC = Save.deserializeSave(textC);

check('Scenario C: save reads back ok', backC.ok === true, backC.reason || '');
const histC = backC.ok ? backC.state.history : null;
check('Scenario C: player has exactly 6 snapshots', !!histC && Array.isArray(histC.player) && histC.player.length === 6, histC ? 'has ' + histC.player.length : 'no history');
check('Scenario C: enemy has exactly 6 snapshots', !!histC && Array.isArray(histC.enemy) && histC.enemy.length === 6, histC ? 'has ' + histC.enemy.length : 'no history');
if (histC) {
  const expectedDaysC = stagedPlayerC.map(s => s.day).join(',');
  check('Scenario C: player read back days are all six staged days', histC.player.map(s => s.day).join(',') === expectedDaysC, histC.player.map(s => s.day).join(','));
  check('Scenario C: enemy read back days are all six staged days', histC.enemy.map(s => s.day).join(',') === expectedDaysC, histC.enemy.map(s => s.day).join(','));
  check('Scenario C: player last snapshot steel and manpower match staged', histC.player[5].steel === 275 && histC.player[5].manpower === 1750, histC.player[5].steel + '/' + histC.player[5].manpower);
  check('Scenario C: enemy last snapshot steel and manpower match staged', histC.enemy[5].steel === 205 && histC.enemy[5].manpower === 1640, histC.enemy[5].steel + '/' + histC.enemy[5].manpower);

  const diffsPC = snapshotDiffs(histC.player, stagedPlayerC, 'C player');
  check('Scenario C: every player snapshot equals staged values on all eight fields', diffsPC.length === 0, diffsPC.join(', ') || 'all six match');
  const diffsEC = snapshotDiffs(histC.enemy, stagedEnemyC, 'C enemy');
  check('Scenario C: every enemy snapshot equals staged values on all eight fields', diffsEC.length === 0, diffsEC.join(', ') || 'all six match');
}

// Scenario D: damage the Scenario B history in a fresh read back state, so the
// invalid snapshot never reaches the view.
const stateD = Save.deserializeSave(textB).state;
if (stateD && Array.isArray(stateD.history.player) && stateD.history.player.length > 1) {
  stateD.history.player[1].day = 999;
}
const textD = Save.serializeSave(stateD).text;
const savePathD = path.join(os.tmpdir(), 'growth-view-D.json');
fs.writeFileSync(savePathD, textD);
const readD = Save.deserializeSave(textD);

check('Scenario D: damaged save is refused', readD.ok === false, readD.ok ? 'accepted' : 'refused');
const expectedDNotice = readD.ok ? '' : readD.reason;
check('Scenario D: refusal reason starts with the damaged campaign history sentence', expectedDNotice.indexOf('The saved campaign history is damaged') === 0, expectedDNotice || 'no reason');

// Node mirror for Scenario D: a fresh seed 1 game, day 1 only.
const freshD = Sim.createGame(1);
const playerDay1D = freshD.history.player[0];
const enemyDay1D = freshD.history.enemy[0];

// ---------- Browser checks ----------

async function importSave(page, savePath) {
  await H.dismissBurst(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#btn-import')
  ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => {
    const notice = (await page.textContent('#save-notice')).trim();
    const cls = (await page.getAttribute('#save-notice', 'class')) || '';
    return notice.indexOf('Loaded from file') === 0 || cls.indexOf('save-notice-error') !== -1;
  }, 5000);
  const notice = (await page.textContent('#save-notice')).trim();
  await H.ensurePaused(page);
  await H.dismissBurst(page);
  return notice;
}

function nationSnapshotRows(page, ni) {
  return page.$$eval('#progression-blocks .progression-nation:nth-child(' + ni + ') .progression-row', els =>
    els.filter(e => e.textContent.trim().startsWith('Day ')).map(e => e.textContent.trim())
  );
}

function nationOnlyDay1Rows(page, ni) {
  return page.$$eval('#progression-blocks .progression-nation:nth-child(' + ni + ') .progression-row', els =>
    els.filter(e => e.textContent.trim().startsWith('Only day 1')).map(e => e.textContent.trim())
  );
}

function nationChangeRows(page, ni) {
  return page.$$eval('#progression-blocks .progression-nation:nth-child(' + ni + ') .progression-change', els =>
    els.map(e => e.textContent.trim())
  );
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    // ---------- Scenario A: import a one snapshot save ----------
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const noticeA = await importSave(page, savePathA);
    check('Scenario A: import reports a load from file', noticeA.indexOf('Loaded from file') === 0, noticeA);
    await H.waitFor(page, async () => (await page.textContent('#progression-blocks')).indexOf('Day 1') !== -1, 5000);

    check('Scenario A: progression card exists', await page.isVisible('#progression-card'), 'card not visible');
    const blocksA = await page.$$eval('#progression-blocks .progression-nation', els => els.length);
    check('Scenario A: exactly 2 progression-nation blocks', blocksA === 2, 'found ' + blocksA);

    const snapsA = histA ? [histA.player, histA.enemy] : [[], []];
    for (let ni = 1; ni <= 2; ni++) {
      const rows = await nationSnapshotRows(page, ni);
      check('Scenario A: nation ' + ni + ' has exactly 1 snapshot row', rows.length === 1, 'found ' + rows.length);
      if (rows.length === 1 && snapsA[ni - 1].length === 1) {
        const expected = snapshotRowText(snapsA[ni - 1][0]);
        check('Scenario A: nation ' + ni + ' snapshot row text matches read back history', rows[0] === expected, 'got: ' + rows[0] + ' expected: ' + expected);
      }

      const onlyRows = await nationOnlyDay1Rows(page, ni);
      check('Scenario A: nation ' + ni + ' has exactly 1 only day 1 line', onlyRows.length === 1, 'found ' + onlyRows.length);
      if (onlyRows.length === 1) {
        check('Scenario A: nation ' + ni + ' only day 1 line text exact', onlyRows[0] === onlyDay1Line(interval), onlyRows[0]);
      }
    }

    const changeRowsA = await page.$$eval('#progression-card .progression-change', els => els.length);
    check('Scenario A: zero progression-change rows in the card', changeRowsA === 0, 'found ' + changeRowsA);

    const cardTextA = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabA = checkVocabulary(cardTextA);
    check('Scenario A: vocabulary audit clean', vocabA.ok, vocabA.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario B: import a three snapshot save ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const noticeB = await importSave(page, savePathB);
    check('Scenario B: import reports a load from file', noticeB.indexOf('Loaded from file') === 0, noticeB);
    await H.waitFor(page, async () => (await page.textContent('#progression-blocks')).indexOf('Day 30') !== -1, 5000);

    const snapsB = histB ? [histB.player, histB.enemy] : [[], []];
    for (let ni = 1; ni <= 2; ni++) {
      const snaps = snapsB[ni - 1];
      const rows = await nationSnapshotRows(page, ni);
      check('Scenario B: nation ' + ni + ' has exactly 3 snapshot rows', rows.length === 3, 'found ' + rows.length);
      if (rows.length === 3 && snaps.length === 3) {
        check('Scenario B: nation ' + ni + ' snapshot 0 text exact', rows[0] === snapshotRowText(snaps[0]), rows[0]);
        check('Scenario B: nation ' + ni + ' snapshot 1 text exact', rows[1] === snapshotRowText(snaps[1]), rows[1]);
        check('Scenario B: nation ' + ni + ' snapshot 2 text exact', rows[2] === snapshotRowText(snaps[2]), rows[2]);
      }

      const onlyRows = await nationOnlyDay1Rows(page, ni);
      check('Scenario B: nation ' + ni + ' has no only day 1 line', onlyRows.length === 0, 'found ' + onlyRows.length);

      const changeRows = await nationChangeRows(page, ni);
      check('Scenario B: nation ' + ni + ' has exactly 1 change row', changeRows.length === 1, 'found ' + changeRows.length);
      if (changeRows.length === 1 && snaps.length === 3) {
        const expectedChange = changeRowText(snaps[0], snaps[snaps.length - 1]);
        check('Scenario B: nation ' + ni + ' change row text exact', changeRows[0] === expectedChange, 'got: ' + changeRows[0] + ' expected: ' + expectedChange);
      }
    }

    const cardTextB = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabB = checkVocabulary(cardTextB);
    check('Scenario B: vocabulary audit clean', vocabB.ok, vocabB.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario C: import a six snapshot save ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const noticeC = await importSave(page, savePathC);
    check('Scenario C: import reports a load from file', noticeC.indexOf('Loaded from file') === 0, noticeC);
    await H.waitFor(page, async () => (await page.textContent('#progression-blocks')).indexOf('Day 150') !== -1, 5000);

    const snapsC = histC ? [histC.player, histC.enemy] : [[], []];
    for (let ni = 1; ni <= 2; ni++) {
      const snaps = snapsC[ni - 1];
      const rows = await nationSnapshotRows(page, ni);
      check('Scenario C: nation ' + ni + ' has exactly 6 snapshot rows', rows.length === 6, 'found ' + rows.length);
      if (rows.length === 6 && snaps.length === 6) {
        for (let ri = 0; ri < 6; ri++) {
          check('Scenario C: nation ' + ni + ' snapshot ' + ri + ' text exact', rows[ri] === snapshotRowText(snaps[ri]), rows[ri]);
        }
      }

      const onlyRows = await nationOnlyDay1Rows(page, ni);
      check('Scenario C: nation ' + ni + ' has no only day 1 line', onlyRows.length === 0, 'found ' + onlyRows.length);

      const changeRows = await nationChangeRows(page, ni);
      check('Scenario C: nation ' + ni + ' has exactly 1 change row', changeRows.length === 1, 'found ' + changeRows.length);
      if (changeRows.length === 1 && snaps.length === 6) {
        const expectedChange = changeRowText(snaps[0], snaps[snaps.length - 1]);
        check('Scenario C: nation ' + ni + ' change row text exact', changeRows[0] === expectedChange, 'got: ' + changeRows[0] + ' expected: ' + expectedChange);
      }
    }

    const cardTextC = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabC = checkVocabulary(cardTextC);
    check('Scenario C: vocabulary audit clean', vocabC.ok, vocabC.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario D: a damaged save never reaches the view ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const noticeD = await importSave(page, savePathD);
    check('Scenario D: notice text equals the node expected reason exactly', noticeD === expectedDNotice, 'got: ' + noticeD + ' expected: ' + expectedDNotice);

    const snapsD = [playerDay1D, enemyDay1D];
    for (let ni = 1; ni <= 2; ni++) {
      const rows = await nationSnapshotRows(page, ni);
      check('Scenario D: nation ' + ni + ' still shows exactly 1 snapshot row', rows.length === 1, 'found ' + rows.length);
      if (rows.length === 1) {
        const expected = snapshotRowText(snapsD[ni - 1]);
        check('Scenario D: nation ' + ni + ' row equals fresh game day 1 expected row', rows[0] === expected, 'got: ' + rows[0] + ' expected: ' + expected);
      }
    }

    const changeRowsD = await page.$$eval('#progression-card .progression-change', els => els.length);
    check('Scenario D: zero progression-change rows in the card', changeRowsD === 0, 'found ' + changeRowsD);

    await page.close();

    // ---------- Page errors ----------
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });