'use strict';
// Real browser check for the blockade status line (Cycle 18 step 4), in
// headless Chromium through Playwright, against the repo's index.html on
// seed 7, in the navy-check pattern. Every expected number and wording
// that carries a number is computed in this file from the sim's own
// readouts (Sim.homeCoastalProvinces, Sim.coastalControl,
// Sim.isBlockaded, Sim.blockadeLoss, Sim.steelIncome,
// Sim.coastalControlCount, Sim.incomePhase) and CFG, never copied from a
// panel.
// Node mirror, no browser: stage a fresh seed 7 game by taking the first
// three provinces of Sim.homeCoastalProvinces for the enemy, setting each
// owner to the player, and moving the first three player units in
// state.units order onto them by provinceId. Then assert the player
// controls each staged province, the player holds exactly 3 enemy home
// coastal provinces, the Dominion is blockaded while the player is not,
// the Dominion loss equals the floor of its steel income times the CFG
// percent and is above zero, the player loss is 0, and one incomePhase
// raises the Dominion steel by exactly income minus the loss, both
// computed before the call.
// Run 1, the staged game in the browser, checker edit stated plainly: the
// served js/sim.js wraps createGame and applies the same owner flips by
// province id and unit moves by unit id the node mirror applied. The
// nation card must match a staged mirror that has NOT had incomePhase
// called on it: both blockade losses, both coastal control counts, the
// blockade status line equal to the exact two sentence plain words string
// built from the mirror readouts, the navy explain carrying the CFG
// threshold and percent, and the status line carrying none of undefined,
// NaN, or [object.
// Run 2, the unmodified game, paused before the first tick: both blockade
// stats are 0 and the status line is the exact not blockaded two sentence
// string built from a fresh mirror, with counts from the readouts.
// Run 3: no horizontal scroll at a 390 px phone width.
// Run 4: no page errors.
// Usage: node tools/blockade-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const CFG = Sim.CFG;
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=7';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// The two sentence plain words blockade status string, in the exact
// shapes the nation card renders, built only from sim readouts and CFG:
// who holds how many of whose home coastal ground, and what the
// blockaded side loses in steel today.
function statusText(s) {
  var n = Sim.homeCoastalProvinces(s, 'enemy').filter(function (pid) {
    return Sim.coastalControl(s, pid) === 'player';
  }).length;
  var m = Sim.homeCoastalProvinces(s, 'player').filter(function (pid) {
    return Sim.coastalControl(s, pid) === 'enemy';
  }).length;
  return (Sim.isBlockaded(s, 'enemy')
      ? 'The Dominion is blockaded today: you control ' + n +
        ' of its home coastal provinces (' + CFG.blockadeCoastalThreshold +
        ' needed to blockade it), so it loses ' + Sim.blockadeLoss(s, 'enemy') +
        ' steel today, ' + CFG.blockadeSteelPct + ' percent of its daily steel income.'
      : 'The Dominion is not blockaded today: you control ' + n +
        ' of its home coastal provinces (' + CFG.blockadeCoastalThreshold +
        ' needed to blockade it).') + ' ' +
    (Sim.isBlockaded(s, 'player')
      ? 'You are blockaded today: the Dominion controls ' + m +
        ' of your home coastal provinces (' + CFG.blockadeCoastalThreshold +
        ' needed to blockade you), so you lose ' + Sim.blockadeLoss(s, 'player') +
        ' steel today, ' + CFG.blockadeSteelPct + ' percent of your daily steel income.'
      : 'You are not blockaded today: the Dominion controls ' + m +
        ' of your home coastal provinces (' + CFG.blockadeCoastalThreshold +
        ' needed to blockade you).');
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const newPage = async (vp) => { const p = await browser.newPage({ viewport: vp || { width: 1400, height: 1000 } }); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const serveEdited = async (page, editSrc) => {
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);' +
        editSrc + 'return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
  };
  try {
    // Node mirror checks: one staged seed 7 game, held and asserted in
    // node before any browser runs.
    const mirror = Sim.createGame(7);
    const targets = Sim.homeCoastalProvinces(mirror, 'enemy').slice(0, 3);
    const movedUnits = mirror.units.filter((u) => u.nation === 'player').slice(0, 3);
    if (targets.length !== 3 || movedUnits.length !== 3) {
      throw new Error('staging assumption broken: seed 7 has fewer than three enemy home coastal provinces or player units');
    }
    targets.forEach((pid, i) => {
      mirror.provinces[pid].owner = 'player';
      movedUnits[i].provinceId = pid;
    });
    check('node mirror: the player controls each staged province',
      targets.every((pid) => Sim.coastalControl(mirror, pid) === 'player'),
      targets.map((pid) => '=' + Sim.coastalControl(mirror, pid)).join(','));
    const playerOnEnemy = Sim.homeCoastalProvinces(mirror, 'enemy').filter(function (pid) {
      return Sim.coastalControl(mirror, pid) === 'player';
    }).length;
    check('node mirror: the player controls exactly 3 enemy home coastal provinces',
      playerOnEnemy === 3, String(playerOnEnemy));
    check('node mirror: the Dominion is blockaded and the player is not',
      Sim.isBlockaded(mirror, 'enemy') === true && Sim.isBlockaded(mirror, 'player') === false,
      'enemy ' + Sim.isBlockaded(mirror, 'enemy') + ', player ' + Sim.isBlockaded(mirror, 'player'));
    const enemyIncome = Sim.steelIncome(mirror, 'enemy');
    const enemyLoss = Sim.blockadeLoss(mirror, 'enemy');
    const expectedLoss = Math.floor(enemyIncome * CFG.blockadeSteelPct / 100);
    check('node mirror: Dominion blockade loss equals the floor of its steel income times the CFG percent and is above zero',
      enemyLoss === expectedLoss && enemyLoss > 0,
      enemyLoss + ' vs ' + expectedLoss + ' from income ' + enemyIncome);
    check('node mirror: the player blockade loss is 0',
      Sim.blockadeLoss(mirror, 'player') === 0, String(Sim.blockadeLoss(mirror, 'player')));
    const steelBefore = mirror.nations.enemy.steel;
    const incomeBefore = Sim.steelIncome(mirror, 'enemy');
    const lossBefore = Sim.blockadeLoss(mirror, 'enemy');
    Sim.incomePhase(mirror, 'enemy');
    check('node mirror: one incomePhase pays the Dominion its income minus the blockade loss',
      (mirror.nations.enemy.steel - steelBefore) === incomeBefore - lossBefore,
      'rose ' + (mirror.nations.enemy.steel - steelBefore) + ' vs ' + incomeBefore + ' - ' + lossBefore);

    // Run 1: the same staging served through the wrapper, a checker edit
    // stated plainly. The expected values come from a staged mirror that
    // has not had incomePhase called on it.
    const served = Sim.createGame(7);
    const serveTargets = Sim.homeCoastalProvinces(served, 'enemy').slice(0, 3);
    const serveUnits = served.units.filter((u) => u.nation === 'player').slice(0, 3);
    serveTargets.forEach((pid, i) => {
      served.provinces[pid].owner = 'player';
      serveUnits[i].provinceId = pid;
    });
    if (!Sim.isBlockaded(served, 'enemy') || Sim.blockadeLoss(served, 'enemy') <= 0) {
      throw new Error('staging assumption broken: served mirror is not blockading the Dominion');
    }
    const editSrc = serveTargets.map((pid) =>
      's.provinces[\'' + pid + '\'].owner=\'player\';').join('') +
      serveUnits.map((u, i) =>
        's.units.filter(function(x){return x.id===' + u.id + ';})[0].provinceId=\'' +
        serveTargets[i] + '\';').join('');
    let page = await newPage();
    await serveEdited(page, editSrc);
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    check('blockaded game: Dominion steel lost to blockade today equals the mirror readout',
      (await page.textContent('#stat-blockade-enemy')) === String(Sim.blockadeLoss(served, 'enemy')),
      (await page.textContent('#stat-blockade-enemy')) + ' vs ' + Sim.blockadeLoss(served, 'enemy'));
    check('blockaded game: your steel lost to blockade today equals the mirror readout',
      (await page.textContent('#stat-blockade-player')) === String(Sim.blockadeLoss(served, 'player')),
      (await page.textContent('#stat-blockade-player')) + ' vs ' + Sim.blockadeLoss(served, 'player'));
    check('blockaded game: nation card coastal counts match the mirror',
      (await page.textContent('#stat-coastal-player')) === String(Sim.coastalControlCount(served, 'player')) &&
        (await page.textContent('#stat-coastal-enemy')) === String(Sim.coastalControlCount(served, 'enemy')),
      (await page.textContent('#stat-coastal-player')) + ' / ' + (await page.textContent('#stat-coastal-enemy')) +
        ' vs mirror ' + Sim.coastalControlCount(served, 'player') + ' / ' + Sim.coastalControlCount(served, 'enemy'));
    const statusLine = await page.textContent('#blockade-status');
    const expectedStatus = statusText(served);
    check('blockaded game: the blockade status line equals the exact two sentence string from the mirror readouts',
      statusLine === expectedStatus, statusLine);
    const stagedExplain = (await page.textContent('#navy-explain')).replace(/\s+/g, ' ').trim();
    check('navy explain states the blockade threshold and percent from CFG',
      stagedExplain.indexOf('Control at least ' + CFG.blockadeCoastalThreshold + ' of the other nation\'s home coastal provinces') !== -1 &&
        stagedExplain.indexOf('loses ' + CFG.blockadeSteelPct + '% of its daily steel income to blockade') !== -1,
      stagedExplain.slice(0, 240));
    check('the blockade status line carries no undefined, NaN, or [object',
      statusLine.indexOf('undefined') === -1 && statusLine.indexOf('NaN') === -1 &&
        statusLine.indexOf('[object') === -1,
      statusLine);
    await page.close();

    // Run 2: the unmodified game, paused before the first tick.
    const fresh = Sim.createGame(7);
    page = await newPage();
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    check('unmodified game: both blockade stats are 0',
      (await page.textContent('#stat-blockade-player')) === '0' &&
        (await page.textContent('#stat-blockade-enemy')) === '0',
      (await page.textContent('#stat-blockade-player')) + ' / ' + (await page.textContent('#stat-blockade-enemy')));
    const freshStatus = await page.textContent('#blockade-status');
    check('unmodified game: the blockade status line is the exact not blockaded two sentence string from a fresh mirror',
      freshStatus === statusText(fresh), freshStatus);
    await page.close();

    // Run 3: phone width.
    page = await newPage({ width: 390, height: 844 });
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check('no horizontal scroll at 390 px', w <= 390, 'document width ' + w);
    await page.close();
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
