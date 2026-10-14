'use strict';
// Real browser check for the lore UI (Cycle 7): event cards and the codex.
// Drives the repo's index.html in headless Chromium through Playwright.
// Replays the first seed (from 1 up) whose game, with a player who never
// acts, meets the capital row turning point first and then Drone Gen 2 and
// line 3 together on one later day, found from js/sim.js at run time so a
// balance change cannot quietly remove the same day pair (Cycle 10: with
// the shared clock, seed 7's pair split into days 21 and 24, and a check
// pinned to seed 7 kept passing on timing alone).
// Run A: the first card, open the codex from the card, close it (the war
//   must run again); the same day pair, Continue twice (the war must run again).
// Run B: at the pair, open the codex from the first card, close it (the second
//   card must appear), Continue (the war must run again).
// Every card's text must match js/lore.js, its why line and no effect
// sentence must show, and the day must not move while it is open.
// Usage: node tools/lore-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Lore = require('../js/lore.js');
const Sim = require('../js/sim.js');

function findSeed() {
  for (let seed = 1; seed <= 500; seed++) {
    const s = Sim.createGame(seed);
    while (!s.gameOver) Sim.tick(s);
    const b = s.beats;
    if (b.capitalRow && b.droneGen2 && b.line3 && b.capitalRow.day < b.droneGen2.day && b.droneGen2.day === b.line3.day) {
      return { seed, first: b.capitalRow.day, pair: b.droneGen2.day };
    }
  }
  throw new Error('no seed with a same day pair in 1 to 500');
}
const PICK = findSeed();
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));

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

async function readCard(page) {
  const c = {
    kicker: await page.textContent('#event-kicker'), title: await page.textContent('#event-title'),
    body: await page.textContent('#event-body'), why: await page.textContent('#event-why'),
    noeffect: await page.textContent('#event-noeffect'), day: await page.textContent('#day-counter')
  };
  await page.waitForTimeout(900);
  c.dayLater = await page.textContent('#day-counter');
  const beat = Object.values(Lore.beats).find((b) => b.title === c.title);
  c.textOk = !!beat && Object.values(beat.variants).indexOf(c.body) !== -1;
  return c;
}

async function cardChecks(page, label) {
  const c = await readCard(page);
  check(label + ': text matches js/lore.js', c.textOk, c.title);
  check(label + ': why line and no effect sentence', /^Why this card: on day \d+ /.test(c.why) && c.noeffect === Lore.noEffect, c.why);
  check(label + ': the war is paused under the card', c.day === c.dayLater, 'day ' + c.day + ' then ' + c.dayLater);
  return c;
}

async function running(page) {
  const a = await page.textContent('#day-counter');
  const moved = await waitFor(page, async () => (await page.textContent('#day-counter')) !== a, 3000);
  return moved && (await page.textContent('#btn-pause')) === 'Pause';
}

async function untilCard(page) {
  return waitFor(page, () => page.isVisible('#event-overlay'), 60000);
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  console.log('seed ' + PICK.seed + ': first card on day ' + PICK.first + ', same day pair on day ' + PICK.pair);
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    for (const run of ['A', 'B']) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('file://' + path.join(REPO, 'index.html') + '?seed=' + PICK.seed);
      await page.click('#btn-speed2');
      if (run === 'A') {
        check('A: first card appears', await untilCard(page));
        const c1 = await cardChecks(page, 'A card 1');
        check('A card 1 is the capital row card on day ' + PICK.first, c1.title === Lore.beats.capitalRow.title && c1.kicker === 'Turning point, day ' + PICK.first, c1.kicker);
        await page.click('#btn-event-codex');
        check('A: codex opens from the card', await page.isVisible('#codex-overlay'));
        await page.click('#btn-codex-close');
        check('A: the war runs again after card then codex', await running(page));
        check('A: the day ' + PICK.pair + ' card appears', await untilCard(page));
        const c2 = await cardChecks(page, 'A card 2');
        await page.click('#btn-event-continue');
        check('A: the second card of the same day follows', await waitFor(page, () => page.isVisible('#event-overlay'), 2000));
        const c3 = await cardChecks(page, 'A card 3');
        check('A: the pair shares day ' + PICK.pair, c2.kicker === 'Turning point, day ' + PICK.pair && c3.kicker === c2.kicker, c2.kicker + ' / ' + c3.kicker);
        await page.click('#btn-event-continue');
        check('A: the war runs again after the same day pair', await running(page));
        await page.click('#btn-codex');
        const rows = await page.$$eval('.codex-entry', (ns) => ns.map((n) => n.textContent));
        check('A: codex lists five entries and three turning points', rows.length === 8, rows.slice(5).join(' / '));
        await page.click('#btn-codex-close');
        check('A: the war runs again after the codex', await running(page));
      } else {
        await untilCard(page);
        await page.click('#btn-event-continue'); // the first card
        check('B: the day ' + PICK.pair + ' card appears', await untilCard(page));
        const first = await readCard(page);
        await page.click('#btn-event-codex');
        await page.click('#btn-codex-close');
        check('B: the queued second card appears after the codex closes', await waitFor(page, () => page.isVisible('#event-overlay'), 2000));
        const second = await cardChecks(page, 'B card 2');
        check('B: it is the other card of day ' + PICK.pair, second.title !== first.title && second.kicker === first.kicker && first.kicker === 'Turning point, day ' + PICK.pair, first.title + ' then ' + second.title + ', ' + second.kicker);
        await page.click('#btn-event-continue');
        check('B: the war runs again', await running(page));
      }
      check(run + ': no page errors', errors.length === 0, errors.join('; '));
      await page.close();
    }
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto('file://' + path.join(REPO, 'index.html') + '?seed=' + PICK.seed);
    await phone.click('#btn-pause');
    const w = await phone.evaluate(() => document.documentElement.scrollWidth);
    check('phone width: no horizontal scroll at 390 px', w <= 390, 'document width ' + w);
    await phone.close();
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
