'use strict';
// Real browser check for the cancel production UI (Cycle 20 step 2), in
// headless Chromium through Playwright, against the repo's index.html on
// seed 1, in the manpower-check and order-marker-check pattern. Every
// expected number is derived in node from Sim (Sim.createGame,
// Sim.manpowerPool, Sim.manpowerCost, Sim.CFG).
// Scenario A: fresh paused game, zero .btn-cancel at start. Click real
// Queue on Line 1. Exactly 1 button.btn-cancel in Line 1 row, text
// contains Cancel, infantry label, refund text with derived number;
// explanation row contains refund number. Click cancel. Queue back to 0
// in queue, zero .btn-cancel, summary manpower pool back to starting
// pool from fresh node game, Line 1 shows Idle.
// Scenario B: fresh paused game, click Line 1 Queue twice. Exactly 2
// .btn-cancel in Line 1. Click one. Exactly 1 remains, queue reads 1 in
// queue, summary pool rose by exactly derived refund vs two-queued
// pool.
// Scenario C staged save: in node create seed 1 game, player steel 500,
// queue two infantry line 1 via Sim.queueProduction, run
// Sim.productionPhase once for player, serialize with js/save.js, write
// temp file, browser import through real file import input following
// tools/battle-why-check.js pattern. Line 1 shows exactly 1 .btn-cancel
// and contains cannot be cancelled sentence about unit in progress and
// retooling scrapping it. Click cancel. Queue reads 1 in queue, zero
// .btn-cancel in Line 1, cannot be cancelled sentence still present.
// Scenario D staged save: one queued infantry plus one productionPhase,
// import, zero .btn-cancel in Line 1, cannot be cancelled sentence
// present.
// Vocabulary audit: text of every .btn-cancel and new explanation
// sentences in A to D contains none of cancelProduction, manpowerCost,
// underscore, or the word player.
// Pause before interacting, dismiss event overlays using existing helper
// patterns.
// Usage: node tools/cancel-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const CFG = Sim.CFG;

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

async function waitFor(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(100); }
  return false;
}

async function awaitCondition(page, fn, label, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await page.waitForTimeout(50);
  }
  throw new Error('awaitCondition timeout: ' + label);
}

async function ensurePaused(page) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const txt = await page.textContent('#btn-pause');
    if (txt.trim() === 'Resume') return;
    await page.click('#btn-pause');
    await page.waitForTimeout(50);
  }
  throw new Error('ensurePaused: pause button never read Resume after 50 attempts');
}

async function dismissBurst(page) {
  if (!(await page.isVisible('#event-overlay'))) return;
  while (await page.isVisible('#event-overlay')) {
    await page.click('#btn-event-continue');
    await page.waitForTimeout(150);
  }
}

async function clickWhenClear(page, selector) {
  for (let attempt = 0; attempt < 25; attempt++) {
    await dismissBurst(page);
    try {
      await page.click(selector, { timeout: 2000 });
      return;
    } catch (e) { }
  }
  throw new Error('could not click ' + selector + ': an overlay kept covering it');
}

async function prodRows(page) {
  return page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#production-lines .prod-line'),
    (r) => r.textContent.replace(/\s+/g, ' ').trim()));
}

async function cancelButtonsInLine(page, lineIndex) {
  return page.evaluate((idx) => {
    const rows = document.querySelectorAll('#production-lines .prod-line');
    if (idx >= rows.length) return [];
    const row = rows[idx];
    const btns = row.querySelectorAll('.btn-cancel');
    return Array.from(btns).map(b => b.textContent.trim());
  }, lineIndex);
}

async function getProdSummaryManpower(page) {
  const summary = await page.textContent('#prod-summary');
  const m = summary.match(/Manpower pool: (\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Vocabulary audit: banned words in cancel button text and explanation rows
const BANNED_WORDS = ['cancelProduction', 'manpowerCost', '_', 'player'];

function checkVocabulary(text) {
  const hits = BANNED_WORDS.filter(w => text.toLowerCase().indexOf(w.toLowerCase()) !== -1);
  return { ok: hits.length === 0, hits };
}

// ---------- Build staged saves in node ----------

// Scenario C: seed 1, player steel 500, queue two infantry on line 1,
// run productionPhase once for player.
const sC = Sim.createGame(1);
sC.nations.player.steel = 500;
Sim.syncProductionLines(sC, 'player');
Sim.queueProduction(sC, 'player', 1);
Sim.queueProduction(sC, 'player', 1);
Sim.productionPhase(sC, 'player');
const saveTextC = Save.serializeSave(sC).text;
fs.writeFileSync('/tmp/cancel-C.json', saveTextC);

// Scenario D: seed 1, queue one infantry on line 1, run productionPhase once.
const sD = Sim.createGame(1);
sD.nations.player.steel = 500;
Sim.syncProductionLines(sD, 'player');
Sim.queueProduction(sD, 'player', 1);
Sim.productionPhase(sD, 'player');
const saveTextD = Save.serializeSave(sD).text;
fs.writeFileSync('/tmp/cancel-D.json', saveTextD);

// ---------- Browser checks ----------

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    // ---------- Derive all expected numbers in node ----------
    const fresh = Sim.createGame(1);
    const startPool = Sim.manpowerPool(fresh, 'player');
    const infCost = Sim.manpowerCost('infantry');
    const infLabel = CFG.unitTypes.infantry.label;

    // ---------- Scenario A: real clicks, fresh paused game ----------
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await ensurePaused(page);
    await dismissBurst(page);

    // Zero cancel buttons at start
    let btnsStart = await cancelButtonsInLine(page, 0);
    check('Scenario A: zero cancel buttons at start', btnsStart.length === 0, 'found: ' + btnsStart.length);

    // Click Queue on Line 1
    const queueBtns = page.locator('#production-lines .prod-line .prod-btns button:first-child');
    await queueBtns.nth(0).click();
    await awaitCondition(page, async () => (await cancelButtonsInLine(page, 0)).length === 1, 'Scenario A: cancel button appears after queue', 5000);
    await dismissBurst(page);

    // Exactly 1 cancel button in Line 1
    let btnsA1 = await cancelButtonsInLine(page, 0);
    check('Scenario A: exactly one cancel button after one queue', btnsA1.length === 1, 'found: ' + btnsA1.length);
    if (btnsA1.length === 1) {
      const txt = btnsA1[0];
      check('Scenario A: cancel button text contains Cancel', txt.indexOf('Cancel') !== -1, txt);
      check('Scenario A: cancel button text contains infantry label', txt.indexOf(infLabel) !== -1, txt);
      check('Scenario A: cancel button text contains refund number', txt.indexOf('refund ' + infCost + ' manpower') !== -1, txt);
      const vocabBtn = checkVocabulary(txt);
      check('Scenario A: cancel button vocabulary audit clean', vocabBtn.ok, vocabBtn.hits.join(', ') || 'clean');
    }

    // Explanation row contains refund number
    let rowsA1 = await prodRows(page);
    const line1RowA1 = rowsA1[0];
    check('Scenario A: explanation row contains refund number', line1RowA1.indexOf(infCost + ' manpower') !== -1, line1RowA1);
    check('Scenario A: explanation row vocabulary clean', checkVocabulary(line1RowA1).ok, checkVocabulary(line1RowA1).hits.join(', ') || 'clean');

    // Click cancel
    await page.click('#production-lines .prod-line .btn-cancel');
    await awaitCondition(page, async () => (await prodRows(page))[0].indexOf('0 in queue') !== -1, 'Scenario A: queue reads 0 after cancel', 5000);
    await dismissBurst(page);

    // Queue back to 0
    let rowsA2 = await prodRows(page);
    check('Scenario A: queue reads 0 after cancel', rowsA2[0].indexOf('0 in queue') !== -1, rowsA2[0]);

    // Zero cancel buttons
    let btnsA2 = await cancelButtonsInLine(page, 0);
    check('Scenario A: zero cancel buttons after cancel', btnsA2.length === 0, 'found: ' + btnsA2.length);

    // Summary manpower pool back to starting pool
    const poolA2 = await getProdSummaryManpower(page);
    check('Scenario A: summary manpower pool back to starting pool', poolA2 === startPool, 'pool ' + poolA2 + ' expected ' + startPool);

    // Line 1 shows Idle
    check('Scenario A: Line 1 shows Idle', rowsA2[0].indexOf('Idle') !== -1, rowsA2[0]);

    await page.close();

    // ---------- Scenario B: fresh paused game, queue twice ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await ensurePaused(page);
    await dismissBurst(page);

    // Click Queue twice on Line 1
    const queueBtnsB = page.locator('#production-lines .prod-line .prod-btns button:first-child');
    await queueBtnsB.nth(0).click();
    await awaitCondition(page, async () => (await cancelButtonsInLine(page, 0)).length === 1, 'Scenario B: first cancel button appears', 5000);
    await dismissBurst(page);
    await queueBtnsB.nth(0).click();
    await awaitCondition(page, async () => (await cancelButtonsInLine(page, 0)).length === 2, 'Scenario B: second cancel button appears', 5000);
    await dismissBurst(page);

    // Exactly 2 cancel buttons
    let btnsB1 = await cancelButtonsInLine(page, 0);
    check('Scenario B: exactly two cancel buttons after two queues', btnsB1.length === 2, 'found: ' + btnsB1.length);
    if (btnsB1.length === 2) {
      btnsB1.forEach((txt, i) => {
        check('Scenario B: cancel button ' + (i+1) + ' text contains Cancel', txt.indexOf('Cancel') !== -1, txt);
        check('Scenario B: cancel button ' + (i+1) + ' text contains infantry label', txt.indexOf(infLabel) !== -1, txt);
        check('Scenario B: cancel button ' + (i+1) + ' text contains refund number', txt.indexOf('refund ' + infCost + ' manpower') !== -1, txt);
        const vocabBtn = checkVocabulary(txt);
        check('Scenario B: cancel button ' + (i+1) + ' vocabulary audit clean', vocabBtn.ok, vocabBtn.hits.join(', ') || 'clean');
      });
    }

    // Click one cancel button
    await page.click('#production-lines .prod-line .btn-cancel');
    await awaitCondition(page, async () => (await prodRows(page))[0].indexOf('1 in queue') !== -1, 'Scenario B: queue reads 1 after cancel', 5000);
    await dismissBurst(page);

    // Exactly 1 remains
    let btnsB2 = await cancelButtonsInLine(page, 0);
    check('Scenario B: exactly one cancel button remains after one cancel', btnsB2.length === 1, 'found: ' + btnsB2.length);

    // Queue reads 1 in queue
    let rowsB2 = await prodRows(page);
    check('Scenario B: queue reads 1 in queue', rowsB2[0].indexOf('1 in queue') !== -1, rowsB2[0]);

    // Summary pool rose by exactly derived refund vs two-queued pool
    const poolTwoQueued = startPool - 2 * infCost;
    const poolAfterOneCancel = await getProdSummaryManpower(page);
    check('Scenario B: summary pool rose by exactly one refund', poolAfterOneCancel === poolTwoQueued + infCost, 'pool ' + poolAfterOneCancel + ' expected ' + (poolTwoQueued + infCost));

    await page.close();

    // ---------- Scenario C: staged save with unit in progress ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await ensurePaused(page);
    await dismissBurst(page);

    // Import save C
    const savePathC = '/tmp/cancel-C.json';
    const [fileChooserC] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserC.setFiles(savePathC);
    await awaitCondition(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0;
    }, 'Scenario C: save notice shows Loaded', 5000);
    await ensurePaused(page);
    await dismissBurst(page);

    // Line 1 shows exactly 1 cancel button
    let btnsC = await cancelButtonsInLine(page, 0);
    check('Scenario C: exactly one cancel button (unit in progress, two queued)', btnsC.length === 1, 'found: ' + btnsC.length);

    // Contains cannot be cancelled sentence
    let rowsC1 = await prodRows(page);
    const line1RowC1 = rowsC1[0];
    check('Scenario C: cannot be cancelled sentence present', line1RowC1.indexOf('The unit in progress cannot be cancelled. Retooling scraps it and its drained steel is lost.') !== -1, line1RowC1);
    check('Scenario C: cannot be cancelled sentence vocabulary clean', checkVocabulary(line1RowC1).ok, checkVocabulary(line1RowC1).hits.join(', ') || 'clean');

    // Cancel button vocabulary
    if (btnsC.length === 1) {
      const vocabBtn = checkVocabulary(btnsC[0]);
      check('Scenario C: cancel button vocabulary audit clean', vocabBtn.ok, vocabBtn.hits.join(', ') || 'clean');
    }

    // Click cancel
    await page.click('#production-lines .prod-line .btn-cancel');
    await awaitCondition(page, async () => (await prodRows(page))[0].indexOf('1 in queue') !== -1, 'Scenario C: queue reads 1 after cancel', 5000);
    await dismissBurst(page);

    // Queue reads 1 in queue
    let rowsC2 = await prodRows(page);
    check('Scenario C: queue reads 1 in queue after cancel', rowsC2[0].indexOf('1 in queue') !== -1, rowsC2[0]);

    // Zero cancel buttons in Line 1
    let btnsC2 = await cancelButtonsInLine(page, 0);
    check('Scenario C: zero cancel buttons after cancel', btnsC2.length === 0, 'found: ' + btnsC2.length);

    // Cannot be cancelled sentence still present
    check('Scenario C: cannot be cancelled sentence still present after cancel', rowsC2[0].indexOf('The unit in progress cannot be cancelled. Retooling scraps it and its drained steel is lost.') !== -1, rowsC2[0]);

    await page.close();

    // ---------- Scenario D: staged save, one queued plus productionPhase ----------
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await ensurePaused(page);
    await dismissBurst(page);

    // Import save D
    const savePathD = '/tmp/cancel-D.json';
    const [fileChooserD] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await fileChooserD.setFiles(savePathD);
    await awaitCondition(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0;
    }, 'Scenario D: save notice shows Loaded', 5000);
    await ensurePaused(page);
    await dismissBurst(page);

    // Zero cancel buttons in Line 1
    let btnsD = await cancelButtonsInLine(page, 0);
    check('Scenario D: zero cancel buttons (one queued, unit in progress)', btnsD.length === 0, 'found: ' + btnsD.length);

    // Cannot be cancelled sentence present
    let rowsD = await prodRows(page);
    check('Scenario D: cannot be cancelled sentence present', rowsD[0].indexOf('The unit in progress cannot be cancelled. Retooling scraps it and its drained steel is lost.') !== -1, rowsD[0]);
    check('Scenario D: cannot be cancelled sentence vocabulary clean', checkVocabulary(rowsD[0]).ok, checkVocabulary(rowsD[0]).hits.join(', ') || 'clean');

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