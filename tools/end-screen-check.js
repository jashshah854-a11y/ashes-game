'use strict';
// Real browser check for the campaign end screen (Cycle 15 step 3), in the
// tools/navy-check.js and tools/lore-check.js pattern: headless Chromium
// through Playwright against the repo's own index.html. Loads
// file:// index.html?seed=1 at a wide viewport (1400 by 1000) and drives a
// passive player to game over by clicking the speed 2 button and then
// dismissing every event card through its real Continue button, using the
// lore-check burst discipline (after a Continue a queued card appears
// synchronously, a short wait detects it, the next tick's cards are game
// days away), until the end banner is visible.
//
// Every expected number and string on the end screen is computed here from a
// node mirror, not copied from a panel: the mirror runs one passive campaign
// with Sim.createGame(1), ticks until gameOver, and takes
// Sim.campaignResult of that final state, and the scoring weights come from
// Sim.CFG. The mirror day and winner are asserted from the mirror itself
// (the recorded passive seed 1 defeat). The row wording replicates
// js/main.js endNationBlock, endMarginText, and endExplainText exactly,
// including the Total row sum phrase and the exchange row net sentence.
//
// Checks, in order:
// 1. At game start the banner (id banner) computes to display none and its
//    bounding box is zero sized, so the hidden state is proven in a real
//    browser while the war runs.
// 2. The real game is driven to game over as a passive player.
// 3. At game over: the title is Defeat (from the mirror winner), the reason
//    equals the mirror endReason, and the day line states the mirror day and
//    the campaign length from Sim.CFG.
// 4. The scores container holds exactly two nation blocks, titled The Vessari
//    Compact (you) and The Khessite Dominion, each with exactly 7 rows (the
//    last also the total row) in the fixed order, and every rendered row
//    equals the text replicated from js/main.js endNationBlock exactly.
// 5. The margin line and the explain paragraph equal the replicated
//    endMarginText and endExplainText text for the mirror.
// 6. Vocabulary audit: the rendered banner text carries no code identifier
//    and no parenthetical code pattern, and no nation block row says you or
//    your as a standalone word.
// 7. Wide layout: the scores container computes to flex, the two blocks sit
//    side by side, the total row is bold with a 1px top border, and there is
//    no horizontal scroll.
// 8. New Game on the end screen hides the banner again and restarts on day 1.
// 9. Narrow layout: a SECOND page is opened at a requested 390 wide and
//    driven to game over the same passive way (the choice: drive a second
//    page, keep the wide page for the New Game check rather than reload it).
//    This headless build floors the window, so the check PRINTS the measured
//    inner width beside the requested 390 and asserts stacking and the
//    scroll claim against the measured width, whatever it is; it does not
//    claim a literal 390 viewport. Recorded measured outcomes: the Cycle 15
//    step 2b proof saw a 390 request render at a measured 500 inner width,
//    and this committed check's own run saw a measured 390; the check always
//    prints the measured value it actually used.
// 10. No page errors on either page.
// Usage: node tools/end-screen-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
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

// ---------- The node mirror and the replicated screen builders ----------

// The scoring weights as js/main.js reads them: plain numbers from Sim.CFG.
const W = {
  province: CFG.scorePerProvince,
  factory: CFG.scorePerFactoryLevel,
  strength: CFG.scorePerStrength,
  ownCapital: CFG.scoreOwnCapital,
  enemyCapital: CFG.scoreEnemyCapital
};

// The mirror: one passive campaign to game over, scored at the end.
const mirror = Sim.createGame(1);
while (!mirror.gameOver && mirror.day < 160) Sim.tick(mirror);
const MR = Sim.campaignResult(mirror);

// Replicated from js/main.js pointWord.
function pointWord(n) { return n === 1 ? 'point' : 'points'; }
// Replicated from js/main.js sumPhrase: values joined with plus, and minus
// plus the absolute value for a negative piece.
function sumPhrase(vals) {
  let out = String(vals[0]);
  for (let i = 1; i < vals.length; i++) {
    out += vals[i] < 0 ? ' minus ' + Math.abs(vals[i]) : ' plus ' + vals[i];
  }
  return out;
}
// Replicated from js/main.js endNationBlock: the seven rows in the fixed
// order, identical for both blocks.
function expectedRows(s) {
  return [
    'Provinces held: ' + s.provinces + ', at ' + W.province + ' ' + pointWord(W.province) +
      ' per province held = ' + s.provincePoints + ' points.',
    'Factory levels: ' + s.factoryLevels + ', at ' + W.factory + ' ' + pointWord(W.factory) +
      ' per factory level = ' + s.factoryPoints + ' points.',
    'Army strength: ' + s.armyStrength + ', at ' + W.strength + ' ' + pointWord(W.strength) +
      ' per strength point = ' + s.armyPoints + ' points.',
    'Cost exchange net: ' + s.exchangeNet + ' steel, at 1 point per steel = ' + s.exchangePoints +
      ' points. The net is destroyed plus launches forced, minus lost plus launches suffered.',
    'Own capital: ' + (s.ownCapitalHeld ? 'held' : 'not held') + ', at ' + W.ownCapital + ' ' +
      pointWord(W.ownCapital) + ' for holding its own capital = ' + s.ownCapitalPoints + ' points.',
    'Enemy capital: ' + (s.enemyCapitalHeld ? 'held' : 'not held') + ', at ' + W.enemyCapital + ' ' +
      pointWord(W.enemyCapital) + ' for holding the other nation capital = ' + s.enemyCapitalPoints + ' points.',
    'Total: ' + sumPhrase([s.provincePoints, s.factoryPoints, s.armyPoints, s.exchangePoints,
      s.ownCapitalPoints, s.enemyCapitalPoints]) + ' = ' + s.total + ' points.'
  ];
}
// Replicated from js/main.js endMarginText.
function expectedMargin(r) {
  if (r.margin === 0) {
    return 'The campaign score is level at ' + r.player.total + ' points each. ' +
      'The winner was decided by the campaign win conditions, not by this score.';
  }
  return (r.margin > 0 ? 'The Vessari Compact' : 'The Khessite Dominion') + ' leads by ' +
    Math.abs(r.margin) + ' points (' + r.player.total + ' to ' + r.enemy.total + ').';
}
// Replicated from js/main.js endExplainText.
function expectedExplain() {
  return 'Both nations are counted the same way. Provinces held are worth ' + W.province + ' ' +
    pointWord(W.province) + ' each; factory levels are worth ' + W.factory + ' ' +
    pointWord(W.factory) + ' each; army strength points are worth ' + W.strength + ' ' +
    pointWord(W.strength) + ' each; the cost exchange net is worth one point per steel; holding ' +
    'a nation own capital is worth ' + W.ownCapital + ' ' + pointWord(W.ownCapital) +
    ' and holding the other nation capital is worth ' + W.enemyCapital + ' ' +
    pointWord(W.enemyCapital) + '. Add those six pieces and that is the campaign score. ' +
    'It does not change the result, and no rule in the game reads it.';
}

// ---------- The passive driver ----------

// Drive a passive player to game over: speed 2, then dismiss every card until
// the end banner is visible. Returns null on success, or a failure reason.
async function driveToEnd(page) {
  await page.click('#btn-speed2');
  const deadline = Date.now() + 150000;
  let guard = 0;
  while (guard < 4000) {
    guard++;
    if (Date.now() > deadline) return 'the overall loop limit passed with no game over';
    const endWait = Date.now() + 30000;
    let what = null;
    while (Date.now() < endWait) {
      const remaining = endWait - Date.now();
      if (await H.tryWait(async () => await page.isVisible('#event-overlay'), remaining)) {
        what = 'card';
        break;
      }
      if (await H.tryWait(async () => await page.isVisible('#banner'), remaining)) {
        what = 'end';
        break;
      }
    }
    if (what === 'card') {
      // A card is up and the war is paused; continue it. A card queued behind
      // this one appears synchronously, so a short wait detects the burst.
      await page.click('#btn-event-continue');
      await H.tryWait(async () => !(await page.isVisible('#event-overlay')) || await page.isVisible('#banner'), 1000);
      continue;
    }
    if (what === 'end') return null;
    return 'neither an event card nor the end banner appeared within 30 s';
  }
  return 'the loop limit was reached with no game over';
}

// Read the end screen facts one page at a time.
async function readEndScreen(page) {
  return page.evaluate(() => {
    const banner = document.getElementById('banner');
    const blocks = Array.prototype.map.call(document.querySelectorAll('#end-scores .end-nation'), (b) => {
      const rows = Array.prototype.map.call(b.querySelectorAll('.end-row'), (r) => ({
        cls: r.className,
        text: r.textContent,
        weight: getComputedStyle(r).fontWeight,
        borderTop: getComputedStyle(r).borderTopWidth
      }));
      const rect = b.getBoundingClientRect();
      return {
        title: b.querySelector('.end-nation-title').textContent,
        rows: rows,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      };
    });
    const r = banner.getBoundingClientRect();
    return {
      display: getComputedStyle(banner).display,
      bannerBox: { width: r.width, height: r.height },
      bannerText: banner.textContent,
      title: document.getElementById('end-title').textContent,
      reason: document.getElementById('end-reason').textContent,
      day: document.getElementById('end-day').textContent,
      margin: document.getElementById('end-margin').textContent,
      explain: document.getElementById('end-explain').textContent,
      scoresDisplay: getComputedStyle(document.getElementById('end-scores')).display,
      blocks: blocks,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    };
  });
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const wideErrors = [];
  const narrowErrors = [];
  try {
    // The mirror must be the recorded passive seed 1 defeat, asserted from
    // the mirror itself before any of its numbers are trusted.
    check('the node mirror is the recorded passive seed 1 defeat',
      MR.gameOver === true && MR.winner === 'enemy' && MR.day === 36,
      'winner ' + MR.winner + ', day ' + MR.day + ', player ' + MR.player.total + ', enemy ' + MR.enemy.total);

    // ---------- Wide page ----------
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => wideErrors.push(e.message));
    await page.goto(URL);
    await H.dismissTitle(page);
    const start = await page.evaluate(() => {
      const b = document.getElementById('banner');
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return { display: cs.display, width: r.width, height: r.height };
    });
    check('at game start the banner computes to display none with a zero size box',
      start.display === 'none' && start.width === 0 && start.height === 0,
      'display ' + start.display + ', box ' + start.width + ' by ' + start.height);

    const driveReason = await driveToEnd(page);
    check('the real game can be driven to game over as a passive player', driveReason === null, driveReason || 'banner shown');

    const dom = await readEndScreen(page);
    check('at game over the banner is visible',
      dom.display !== 'none' && dom.bannerBox.width > 0 && dom.bannerBox.height > 0,
      'display ' + dom.display + ', box ' + Math.round(dom.bannerBox.width) + ' by ' + Math.round(dom.bannerBox.height));

    // Title, reason, day, all from the mirror and CFG.
    const expTitle = MR.winner === 'player' ? 'Victory' : 'Defeat';
    check('the end title is ' + expTitle + ' from the mirror winner',
      dom.title === expTitle && expTitle === 'Defeat', dom.title);
    check('the end reason equals the mirror endReason', dom.reason === MR.endReason, dom.reason);
    check('the end day states the mirror day and the campaign length from Sim.CFG',
      dom.day === 'The campaign ended on day ' + MR.day + ', in a campaign that runs ' + CFG.campaignEndDay + ' days.',
      dom.day);

    // The two nation blocks and their rows.
    const expP = expectedRows(MR.player);
    const expE = expectedRows(MR.enemy);
    check('the scores container holds exactly two nation blocks', dom.blocks.length === 2, String(dom.blocks.length));
    check('the blocks are titled The Vessari Compact (you) then The Khessite Dominion',
      dom.blocks.length === 2 && dom.blocks[0].title === 'The Vessari Compact (you)' && dom.blocks[1].title === 'The Khessite Dominion',
      dom.blocks.map((b) => b.title).join(' | '));
    const shapeOk = dom.blocks.length === 2 && dom.blocks.every((b) =>
      b.rows.length === 7 && b.rows[b.rows.length - 1].cls.indexOf('end-total') !== -1 &&
      b.rows.slice(0, 6).every((r) => r.cls.indexOf('end-total') === -1));
    check('each block has exactly 7 rows in the fixed order, the last also the total row', shapeOk,
      dom.blocks.map((b) => b.rows.length + ' rows').join(' | '));
    let rowOk = dom.blocks.length === 2;
    let rowDetail = '';
    if (rowOk) {
      for (let bi = 0; bi < 2; bi++) {
        const exp = bi === 0 ? expP : expE;
        for (let ri = 0; ri < 7; ri++) {
          const got = dom.blocks[bi].rows[ri].text;
          if (got !== exp[ri]) {
            rowOk = false;
            rowDetail = 'block ' + (bi + 1) + ' row ' + (ri + 1) + ': got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(exp[ri]);
          }
        }
      }
    }
    check('every rendered row equals the text replicated from js/main.js endNationBlock exactly', rowOk, rowDetail);

    // Margin and explain.
    check('the margin line equals the replicated endMarginText for the mirror',
      dom.margin === expectedMargin(MR), dom.margin);
    check('the explain paragraph equals the replicated endExplainText from the CFG weights',
      dom.explain === expectedExplain(), dom.explain.slice(0, 120));

    // Vocabulary audit of the rendered banner text.
    const banned = ['Sim', 'CFG', 'campaignScore', 'campaignResult', 'scorePerProvince',
      'scorePerFactoryLevel', 'scorePerStrength', 'scoreOwnCapital', 'scoreEnemyCapital', '.js'];
    const hits = banned.filter((t) => dom.bannerText.indexOf(t) !== -1);
    check('the rendered banner text carries no code identifier', hits.length === 0, hits.join(', ') || 'clean');
    check('the rendered banner text has no parenthetical code pattern (a parenthesis containing a dot)',
      !/\([^)]*\./.test(dom.bannerText), 'clean');
    const rowSay = [];
    dom.blocks.forEach((b) => {
      b.rows.forEach((r, i) => {
        if (/\byou\b/i.test(r.text) || /\byour\b/i.test(r.text)) rowSay.push('row ' + (i + 1) + ': ' + r.text.slice(0, 40));
      });
    });
    check('no nation block row says you or your as a standalone word', rowSay.length === 0, rowSay.join(' | ') || 'clean');

    // Wide layout.
    check('the scores container computes to flex', dom.scoresDisplay === 'flex', dom.scoresDisplay);
    const sideBySide = dom.blocks.length === 2 &&
      Math.abs(dom.blocks[0].rect.top - dom.blocks[1].rect.top) <= 2 &&
      dom.blocks[1].rect.left > dom.blocks[0].rect.left;
    check('the two nation blocks sit side by side at a wide width', sideBySide,
      dom.blocks.map((b) => 'top ' + Math.round(b.rect.top) + ' left ' + Math.round(b.rect.left)).join(' | '));
    const totalRow = dom.blocks[0] && dom.blocks[0].rows[6];
    const weightNum = totalRow ? parseInt(totalRow.weight, 10) : 0;
    check('the total row computes to bold', !!totalRow && (totalRow.weight === 'bold' || weightNum >= 600),
      totalRow ? totalRow.weight : 'no total row');
    check('the total row has a 1px top border', !!totalRow && totalRow.borderTop === '1px',
      totalRow ? totalRow.borderTop : 'no total row');
    check('no horizontal scroll at the wide width', dom.scrollWidth <= dom.innerWidth,
      'document width ' + dom.scrollWidth + ' vs inner width ' + dom.innerWidth);

    // New Game on the end screen.
    await page.click('#btn-end-new');
    const afterNew = await page.evaluate(() => {
      const b = document.getElementById('banner');
      return { display: getComputedStyle(b).display, day: document.getElementById('day-counter').textContent };
    });
    check('the end screen New Game button hides the banner again',
      afterNew.display === 'none', afterNew.display);
    check('and the new game starts on day 1', afterNew.day === '1', afterNew.day);
    check('wide page: no page errors', wideErrors.length === 0, wideErrors.join('; ') || 'none');
    await page.close();

    // ---------- Narrow page ----------
    // Choice: a second page at a requested 390 wide is driven to game over
    // the same passive way, rather than reloading the wide page, so the wide
    // page keeps its end screen until after the New Game check above.
    const narrow = await browser.newPage({ viewport: { width: 390, height: 844 } });
    narrow.on('pageerror', (e) => narrowErrors.push(e.message));
    await narrow.goto(URL);
    await H.dismissTitle(narrow);
    const nStart = await narrow.evaluate(() => getComputedStyle(document.getElementById('banner')).display);
    check('narrow page: the banner starts hidden too', nStart === 'none', nStart);
    const narrowDrive = await driveToEnd(narrow);
    check('narrow page: the game can be driven to game over as a passive player', narrowDrive === null, narrowDrive || 'banner shown');
    const ndom = await readEndScreen(narrow);
    console.log('NOTE | narrow viewport requested 390 by 844 | measured inner width ' + ndom.innerWidth +
      ' | document scroll width ' + ndom.scrollWidth);
    const stacked = ndom.blocks.length === 2 && ndom.blocks[1].rect.top >= ndom.blocks[0].rect.bottom - 1;
    check('narrow page: the two nation blocks stack, asserted against the measured width', stacked,
      ndom.blocks.map((b) => 'top ' + Math.round(b.rect.top) + ' bottom ' + Math.round(b.rect.bottom)).join(' | ') +
      ' at measured inner width ' + ndom.innerWidth);
    check('narrow page: no horizontal scroll at the measured width',
      ndom.scrollWidth <= ndom.innerWidth,
      'document width ' + ndom.scrollWidth + ' vs measured inner width ' + ndom.innerWidth);
    check('narrow page: no page errors', narrowErrors.length === 0, narrowErrors.join('; ') || 'none');
    await narrow.close();
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });