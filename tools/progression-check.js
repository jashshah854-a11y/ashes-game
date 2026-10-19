'use strict';
// Real browser check for the campaign progression panel (Cycle 20 step 4),
// in headless Chromium through Playwright, against the repo's index.html on
// seed 1. Every expected text is built in node from Sim.createGame and the
// staged states using the exact formats above, never copied from the page.
//
// Scenario A: fresh game at ?seed=1, paused. Assert: progression card exists;
// exactly 2 .progression-nation blocks; titles exact; each block has exactly
// 1 .progression-row snapshot row plus the only day 1 line (so snapshot rows
// whose text starts with 'Day ' count exactly 1 per nation); the day 1 row
// text equals the node mirror text for seed 1 for both nations; the only line
// text is exact; there are 0 .progression-change rows; the explain text is exact.
//
// Scenario B: in node, create seed 1, tick with Sim.tick until state.history.player
// has 2 snapshots (cap 200 ticks), serialize with require('../js/save.js'),
// write the text to a temp file in os.tmpdir(), open a fresh page at ?seed=1,
// import through the real #save-file-input (setInputFiles pattern from
// tools/battle-why-check.js), wait until #progression-blocks contains 'Day 30',
// pause the game. Assert each nation block has exactly 2 snapshot rows with
// exact staged texts, exactly 1 .progression-change per nation with the exact
// signed change text built from the staged snapshots, and no only day 1 line.
//
// Scenario C: in node, create seed 1 and tick until state.gameOver (passive,
// cap 400 ticks), serialize and import the same way in a fresh page. Assert
// each nation has exactly 3 snapshot rows (days 1, 30, and the final day from
// the staged history) with exact texts, and exactly 1 change row per nation
// with exact text.
//
// Vocabulary audit across all scenarios: the full text of #progression-card
// contains none of: state.history, historySnapshot, campaignHistory, CFG,
// undefined, NaN, [object, or an underscore character.
//
// Also assert no page errors were collected.
//
// Dismiss any event overlay before interacting, using the helper pattern
// from cancel-check.js.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/progression-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Vocabulary audit: banned words in any progression card text
const BANNED_WORDS = ['state.history', 'historySnapshot', 'campaignHistory', 'CFG', 'undefined', 'NaN', '[object', '_'];

function checkVocabulary(text) {
  const hits = BANNED_WORDS.filter(w => text.indexOf(w) !== -1);
  return { ok: hits.length === 0, hits };
}

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

// Build expected change row text from first and last snapshots
function changeRowText(first, last) {
  return 'Change since day 1, day ' + last.day + ' compared with day 1: provinces held ' + signedNum(last.provinces - first.provinces) + ', factory levels ' + signedNum(last.factoryLevels - first.factoryLevels) + ', army strength ' + signedNum(last.armyStrength - first.armyStrength) + ', production lines open ' + signedNum(last.linesOpen - first.linesOpen) + ', steel ' + signedNum(last.steel - first.steel) + ', equipment ' + signedNum(last.equipment - first.equipment) + ', manpower ' + signedNum(last.manpower - first.manpower) + '.';
}

// Build expected explain text
function explainText(interval) {
  return 'Snapshots are recorded on day 1, then every ' + interval + ' days, and on the final day of the campaign. Each snapshot records provinces held, factory levels, army strength, production lines open, steel, equipment, and manpower for that day, so a later country can be compared with its day 1 self. No rule in the game reads these snapshots.';
}

// ---------- Build staged saves in node ----------

// Scenario B: seed 1, tick until player history has 2 snapshots (cap 200 ticks)
const sB = Sim.createGame(1);
let ticksB = 0;
while (sB.history.player.length < 2 && ticksB < 200 && !sB.gameOver) {
  Sim.tick(sB);
  ticksB++;
}
const saveTextB = Save.serializeSave(sB).text;
const savePathB = path.join(os.tmpdir(), 'progression-B.json');
fs.writeFileSync(savePathB, saveTextB);

// Scenario C: seed 1, tick until gameOver (cap 400 ticks)
const sC = Sim.createGame(1);
let ticksC = 0;
while (!sC.gameOver && ticksC < 400) {
  Sim.tick(sC);
  ticksC++;
}
const saveTextC = Save.serializeSave(sC).text;
const savePathC = path.join(os.tmpdir(), 'progression-C.json');
fs.writeFileSync(savePathC, saveTextC);

// Node mirror for Scenario A: fresh seed 1 game (day 1 only)
const fresh = Sim.createGame(1);
const playerDay1 = fresh.history.player[0];
const enemyDay1 = fresh.history.enemy[0];
const interval = CFG.historyIntervalDays;

// ---------- Browser checks ----------

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    // ---------- Scenario A: fresh paused game ----------
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Progression card exists
    check('Scenario A: progression card exists',
      await page.isVisible('#progression-card'), 'card not visible');

    // Exactly 2 .progression-nation blocks
    const nationBlocksA = await page.$$eval('#progression-blocks .progression-nation', els => els.length);
    check('Scenario A: exactly 2 progression-nation blocks', nationBlocksA === 2, 'found ' + nationBlocksA);

    // Titles exact
    const titlesA = await page.$$eval('#progression-blocks .progression-nation-title', els => els.map(e => e.textContent.trim()));
    check('Scenario A: first block title is Vessari Compact (you)', titlesA[0] === 'The Vessari Compact (you)', titlesA[0]);
    check('Scenario A: second block title is Khessite Dominion', titlesA[1] === 'The Khessite Dominion', titlesA[1]);

    // Each block has exactly 1 snapshot row (text starts with 'Day ')
    for (let ni = 0; ni < 2; ni++) {
      const snapshotRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-row', els =>
        els.filter(e => e.textContent.trim().startsWith('Day ')).map(e => e.textContent.trim())
      );
      check('Scenario A: nation ' + (ni + 1) + ' has exactly 1 snapshot row', snapshotRows.length === 1, 'found ' + snapshotRows.length);
      if (snapshotRows.length === 1) {
        const expected = ni === 0 ? snapshotRowText(playerDay1) : snapshotRowText(enemyDay1);
        check('Scenario A: nation ' + (ni + 1) + ' day 1 row text matches node mirror', snapshotRows[0] === expected, 'got: ' + snapshotRows[0] + ' expected: ' + expected);
      }
    }

    // The only-day-1 line text is exact (one per nation)
    for (let ni = 0; ni < 2; ni++) {
      const onlyRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-row', els =>
        els.filter(e => e.textContent.trim().startsWith('Only day 1')).map(e => e.textContent.trim())
      );
      check('Scenario A: nation ' + (ni + 1) + ' has exactly 1 only-day-1 line', onlyRows.length === 1, 'found ' + onlyRows.length);
      if (onlyRows.length === 1) {
        check('Scenario A: nation ' + (ni + 1) + ' only-day-1 line text exact', onlyRows[0] === onlyDay1Line(interval), onlyRows[0]);
      }
    }

    // Zero .progression-change rows
    const changeRowsA = await page.$$eval('#progression-blocks .progression-change', els => els.length);
    check('Scenario A: zero progression-change rows', changeRowsA === 0, 'found ' + changeRowsA);

    // Explain text is exact
    const explainA = (await page.textContent('#progression-explain')).trim();
    check('Scenario A: explain text exact', explainA === explainText(interval), explainA);

    // Vocabulary audit on full progression card text
    const cardTextA = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabA = checkVocabulary(cardTextA);
    check('Scenario A: vocabulary audit clean', vocabA.ok, vocabA.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario B: staged save with 2 snapshots ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save B
    const [fileChooserB] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserB.setFiles(savePathB);
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    // Wait until #progression-blocks contains 'Day 30'
    await H.waitFor(page, async () => {
      const text = await page.textContent('#progression-blocks');
      return text.indexOf('Day 30') !== -1;
    }, 5000);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Expected snapshots from node staged state
    const playerSnapsB = sB.history.player;
    const enemySnapsB = sB.history.enemy;
    check('Scenario B: node player has 2 snapshots', playerSnapsB.length === 2, 'has ' + playerSnapsB.length);
    check('Scenario B: node enemy has 2 snapshots', enemySnapsB.length === 2, 'has ' + enemySnapsB.length);

    // For each nation: exactly 2 snapshot rows with exact texts, 1 change row exact, no only-day-1 line
    for (let ni = 0; ni < 2; ni++) {
      const snaps = ni === 0 ? playerSnapsB : enemySnapsB;
      const snapshotRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-row', els =>
        els.filter(e => e.textContent.trim().startsWith('Day ')).map(e => e.textContent.trim())
      );
      check('Scenario B: nation ' + (ni + 1) + ' has exactly 2 snapshot rows', snapshotRows.length === 2, 'found ' + snapshotRows.length);
      if (snapshotRows.length === 2) {
        check('Scenario B: nation ' + (ni + 1) + ' snapshot 0 text exact', snapshotRows[0] === snapshotRowText(snaps[0]), snapshotRows[0]);
        check('Scenario B: nation ' + (ni + 1) + ' snapshot 1 text exact', snapshotRows[1] === snapshotRowText(snaps[1]), snapshotRows[1]);
      }

      // No only-day-1 line
      const onlyRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-row', els =>
        els.filter(e => e.textContent.trim().startsWith('Only day 1')).length
      );
      check('Scenario B: nation ' + (ni + 1) + ' has no only-day-1 line', onlyRows === 0, 'found ' + onlyRows);

      // Exactly 1 change row with exact text
      const changeRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-change', els =>
        els.map(e => e.textContent.trim())
      );
      check('Scenario B: nation ' + (ni + 1) + ' has exactly 1 change row', changeRows.length === 1, 'found ' + changeRows.length);
      if (changeRows.length === 1) {
        const expectedChange = changeRowText(snaps[0], snaps[snaps.length - 1]);
        check('Scenario B: nation ' + (ni + 1) + ' change row text exact', changeRows[0] === expectedChange, 'got: ' + changeRows[0] + ' expected: ' + expectedChange);
      }
    }

    // Vocabulary audit
    const cardTextB = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabB = checkVocabulary(cardTextB);
    check('Scenario B: vocabulary audit clean', vocabB.ok, vocabB.hits.join(', ') || 'clean');

    await page.close();

    // ---------- Scenario C: staged save with gameOver ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import save C
    const [fileChooserC] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserC.setFiles(savePathC);
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.dismissBurst(page);

    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Expected snapshots from node staged state
    const playerSnapsC = sC.history.player;
    const enemySnapsC = sC.history.enemy;
    check('Scenario C: node player has 3 snapshots', playerSnapsC.length === 3, 'has ' + playerSnapsC.length);
    check('Scenario C: node enemy has 3 snapshots', enemySnapsC.length === 3, 'has ' + enemySnapsC.length);
    if (playerSnapsC.length === 3) {
      check('Scenario C: player snapshot days are 1, 30, final', playerSnapsC[0].day === 1 && playerSnapsC[1].day === 30 && playerSnapsC[2].day > 30, playerSnapsC.map(s => s.day).join(','));
    }
    if (enemySnapsC.length === 3) {
      check('Scenario C: enemy snapshot days are 1, 30, final', enemySnapsC[0].day === 1 && enemySnapsC[1].day === 30 && enemySnapsC[2].day > 30, enemySnapsC.map(s => s.day).join(','));
    }

    // For each nation: exactly 3 snapshot rows with exact texts, 1 change row exact
    for (let ni = 0; ni < 2; ni++) {
      const snaps = ni === 0 ? playerSnapsC : enemySnapsC;
      const snapshotRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-row', els =>
        els.filter(e => e.textContent.trim().startsWith('Day ')).map(e => e.textContent.trim())
      );
      check('Scenario C: nation ' + (ni + 1) + ' has exactly 3 snapshot rows', snapshotRows.length === 3, 'found ' + snapshotRows.length);
      if (snapshotRows.length === 3) {
        check('Scenario C: nation ' + (ni + 1) + ' snapshot 0 text exact', snapshotRows[0] === snapshotRowText(snaps[0]), snapshotRows[0]);
        check('Scenario C: nation ' + (ni + 1) + ' snapshot 1 text exact', snapshotRows[1] === snapshotRowText(snaps[1]), snapshotRows[1]);
        check('Scenario C: nation ' + (ni + 1) + ' snapshot 2 text exact', snapshotRows[2] === snapshotRowText(snaps[2]), snapshotRows[2]);
      }

      // Exactly 1 change row with exact text
      const changeRows = await page.$$eval('#progression-blocks .progression-nation:nth-child(' + (ni + 1) + ') .progression-change', els =>
        els.map(e => e.textContent.trim())
      );
      check('Scenario C: nation ' + (ni + 1) + ' has exactly 1 change row', changeRows.length === 1, 'found ' + changeRows.length);
      if (changeRows.length === 1) {
        const expectedChange = changeRowText(snaps[0], snaps[snaps.length - 1]);
        check('Scenario C: nation ' + (ni + 1) + ' change row text exact', changeRows[0] === expectedChange, 'got: ' + changeRows[0] + ' expected: ' + expectedChange);
      }
    }

    // Vocabulary audit
    const cardTextC = (await page.textContent('#progression-card')).replace(/\s+/g, ' ').trim();
    const vocabC = checkVocabulary(cardTextC);
    check('Scenario C: vocabulary audit clean', vocabC.ok, vocabC.hits.join(', ') || 'clean');

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