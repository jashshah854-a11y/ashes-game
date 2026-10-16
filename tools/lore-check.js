'use strict';
// Real browser check for the lore UI (Cycle 7, extended in Cycle 10):
// event cards and the codex, for turning points and recurring texture.
// Drives the repo's index.html in headless Chromium through Playwright.
// Replays seed 7 (?seed=7), where a player who never acts meets all three
// turning points: the capital row on day 11, then Drone Gen 2 and line 3
// together on day 21. Recurring texture cards interleave on the same war:
// a first texture burst on day 15 (Walls Rise, then The Gauge War twice,
// the second firing a repeat), Walls Rise again on day 19, and a day 21
// burst mixing texture cards with the two turning point cards.
// Run A: day 11 card, open the codex from the card, close it (the war
//   must run again); then drain each card burst, texture cards checked
//   like beat cards, until both day 21 turning points have been shown;
//   the codex then lists five entries, three turning points, and the two
//   recurring textures reached so far.
// Run B: in the day 21 burst, open the codex from the first card, close
//   it (the queued next card must appear), drain the burst (the war must
//   run again).
// Run C: judge flag regression: view a reached turning point in the codex,
//   start a New Game, and open the codex again; the article must render the
//   first history entry with no page error (a stale beat selection used to
//   dereference an unrecorded beat and break the codex), and the new game
//   codex lists the turning points and the recurring textures as not yet.
// Run D: the day 15 burst: a recurring card fires for a second time in
//   the same burst, queued behind the first firing, shows its occurrence
//   count honestly, and the war runs again after the burst.
// Run E: view a reached recurring texture in the codex (counts and days,
//   the fired variant text), view a capital entry (both endings render),
//   start a New Game, and open the codex again: the article renders the
//   first history entry and every texture is not yet (the stale texture
//   selection guard).
// Every card's text must match js/lore.js, its why line and no effect
// sentence must show, and the day must not move while it is open.
// Usage: node tools/lore-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Lore = require('../js/lore.js');
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
  const card = Object.values(Lore.beats).find((b) => b.title === c.title) ||
    Object.values(Lore.textures).find((b) => b.title === c.title);
  c.textOk = !!card && Object.values(card.variants).indexOf(c.body) !== -1;
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

// Read and Continue every card in the burst that is currently queued,
// starting with a card already read by the caller if one is passed.
// Cards queued behind an open card appear synchronously on Continue,
// so a short 150 ms window detects them; the next tick's cards are at
// least two game days away (600 ms at speed 2), so bursts stay separate
// per tick. When no card appears within the window the burst is over
// and the war has resumed. Returns the cards read, in order.
async function drainBurst(page, label, first) {
  const cards = [];
  let pending = first || null;
  while (true) {
    if (!pending) {
      const visible = await waitFor(page, () => page.isVisible('#event-overlay'), 150);
      if (!visible) break;
      pending = await cardChecks(page, label + ' card ' + (cards.length + 1));
    }
    cards.push(pending);
    pending = null;
    await page.click('#btn-event-continue');
  }
  return cards;
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    for (const run of ['A', 'B', 'C', 'D', 'E']) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('file://' + path.join(REPO, 'index.html') + '?seed=7');
      await page.click('#btn-speed2');
      if (run === 'A') {
        check('A: first card appears', await untilCard(page));
        const c1 = await cardChecks(page, 'A card 1');
        check('A card 1 is the capital row card on day 11', c1.title === Lore.beats.capitalRow.title && /day 11$/.test(c1.kicker), c1.kicker);
        await page.click('#btn-event-codex');
        check('A: codex opens from the card', await page.isVisible('#codex-overlay'));
        await page.click('#btn-codex-close');
        check('A: the war runs again after card then codex', await running(page));
        const beatTitles = {};
        let bursts = 0;
        while (Object.keys(beatTitles).length < 2 && bursts < 6) {
          check('A: another card burst appears', await untilCard(page));
          const cards = await drainBurst(page, 'A burst ' + (bursts + 1));
          cards.forEach((c) => {
            if (c.title === Lore.beats.droneGen2.title || c.title === Lore.beats.line3.title) beatTitles[c.title] = true;
          });
          bursts++;
        }
        check('A: both day 21 turning point cards were shown among the texture cards', Object.keys(beatTitles).length === 2, Object.keys(beatTitles).join(' / '));
        await page.click('#btn-codex');
        const rows = await page.$$eval('.codex-entry', (ns) => ns.map((n) => n.textContent));
        check('A: codex lists five entries, three turning points, and two recurring textures', rows.length === 10, rows.slice(5).join(' / '));
        const texPending = await page.$$eval('.codex-texture', (ns) => ns.map((n) => n.textContent));
        check('A: the unreached recurring texture is marked not yet in the codex', texPending.length === 1 && texPending[0].indexOf(Lore.textures.lineCapped.title) !== -1, texPending.join(' / '));
        await page.click('#btn-codex-close');
        // Day advance only here: the war demonstrably resumed (pause
        // restoration itself is pinned above and in Runs B and D), but
        // the day 25 texture card can legitimately re-pause the war
        // before a button text read lands, which is the war running
        // into its next card, not a lost restoration.
        const dayBefore = await page.textContent('#day-counter');
        check('A: the war runs again after the codex (the day advances)', await waitFor(page, async () => (await page.textContent('#day-counter')) !== dayBefore, 3000), 'day ' + dayBefore);
      } else if (run === 'C') {
        check('C: first card appears', await untilCard(page));
        await page.click('#btn-event-continue'); // day 11
        await page.click('#btn-codex');
        const entries = await page.$$('.codex-entry');
        let beatEntry = null;
        for (const e of entries) { if ((await e.textContent()).indexOf(Lore.beats.capitalRow.title) !== -1) { beatEntry = e; break; } }
        check('C: the reached turning point is listed in the codex', !!beatEntry);
        if (beatEntry) await beatEntry.click();
        const art1 = await page.textContent('#codex-article');
        check('C: the codex article shows the turning point', art1.indexOf(Lore.beats.capitalRow.variants.enemy) !== -1, art1.slice(0, 60));
        await page.click('#btn-codex-close');
        await page.click('#btn-new');
        await page.click('#btn-codex');
        const h3 = await page.textContent('#codex-article h3');
        check('C: the codex article renders after New Game', h3 === Lore.entries.ashwater.title, String(h3));
        const rows = await page.$$eval('.codex-entry', (ns) => ns.map((n) => n.textContent));
        const pending = await page.$$eval('.codex-beat', (ns) => ns.map((n) => n.textContent));
        check('C: the new game codex lists five entries and unreached turning points', rows.length === 5 && pending.length === 3, 'entries ' + rows.length + ', pending ' + pending.length);
        const texPending = await page.$$eval('.codex-texture', (ns) => ns.map((n) => n.textContent));
        check('C: the new game codex lists every recurring texture as not yet', texPending.length === 3, texPending.join(' / '));
        await page.click('#btn-codex-close');
      } else if (run === 'B') {
        await untilCard(page);
        await page.click('#btn-event-continue'); // day 11
        let reached = false;
        for (let b = 0; b < 6 && !reached; b++) {
          check('B: a card burst appears', await untilCard(page));
          const first = await cardChecks(page, 'B burst ' + (b + 1) + ' first');
          if (!/day 21/.test(first.kicker)) { await drainBurst(page, 'B burst ' + (b + 1), first); continue; }
          reached = true;
          await page.click('#btn-event-codex');
          await page.click('#btn-codex-close');
          check('B: the queued second card appears after the codex closes', await waitFor(page, () => page.isVisible('#event-overlay'), 2000));
          const second = await cardChecks(page, 'B card 2');
          check('B: it is another card of the day 21 burst', second.title !== first.title, first.title + ' then ' + second.title);
          await drainBurst(page, 'B day 21 burst', second);
          check('B: the war runs again', await running(page));
        }
        check('B: the day 21 burst was reached', reached);
      } else if (run === 'D') {
        check('D: first card appears', await untilCard(page));
        await page.click('#btn-event-continue'); // day 11
        check('D: the day 15 texture burst appears', await untilCard(page));
        const cards = await drainBurst(page, 'D burst');
        check('D: the burst is Walls Rise, then The Gauge War twice',
          cards.length === 3 && cards[0].title === Lore.textures.fortCompleted.title &&
          cards[1].title === Lore.textures.railConverted.title && cards[2].title === Lore.textures.railConverted.title,
          cards.map((c) => c.title).join(' / '));
        check('D: the second firing shows its occurrence honestly',
          cards.length === 3 && cards[2].why.indexOf('2nd time for the Khessites') !== -1 && cards[2].kicker.indexOf('2nd time') !== -1 &&
          cards[1].why.indexOf('first time for the Khessites') !== -1,
          cards.length === 3 ? cards[2].kicker + ' | ' + cards[2].why : 'burst too short');
        check('D: the repeat queued behind the first firing without losing the pause', cards.length === 3 && cards.every((c) => c.day === c.dayLater), cards.map((c) => c.day).join(' / '));
        check('D: the war runs again after the burst', await running(page));
      } else { // Run E
        check('E: first card appears', await untilCard(page));
        await page.click('#btn-event-continue'); // day 11
        check('E: the day 15 texture burst appears', await untilCard(page));
        await drainBurst(page, 'E day 15 burst');
        check('E: the next texture card appears', await untilCard(page)); // day 19, Walls Rise again
        await page.click('#btn-event-codex');
        check('E: codex opens from a recurring texture card', await page.isVisible('#codex-overlay'));
        const entries = await page.$$('.codex-entry');
        let texEntry = null;
        for (const e of entries) { if ((await e.textContent()).indexOf(Lore.textures.railConverted.title) !== -1) { texEntry = e; break; } }
        check('E: the reached recurring texture is listed in the codex', !!texEntry);
        if (texEntry) await texEntry.click();
        const art = await page.textContent('#codex-article');
        check('E: the texture article shows its counts and days', art.indexOf('The Khessites: 2 times, on days 15, 15.') !== -1, art.slice(0, 120));
        check('E: the texture article shows the fired variant text', art.indexOf(Lore.textures.railConverted.variants.enemy) !== -1, art.slice(0, 60));
        const entries2 = await page.$$('.codex-entry');
        let capEntry = null;
        for (const e of entries2) { if ((await e.textContent()).indexOf(Lore.entries.khessograd.title) !== -1) { capEntry = e; break; } }
        check('E: the capital entry is listed in the codex', !!capEntry);
        if (capEntry) await capEntry.click();
        const capArt = await page.textContent('#codex-article');
        check('E: the capital entry renders both endings', capArt.indexOf('If Khessograd falls') !== -1 && capArt.indexOf('day 150') !== -1, capArt.slice(0, 60));
        await page.click('#btn-codex-close');
        await page.click('#btn-new');
        await page.click('#btn-codex');
        const h3 = await page.textContent('#codex-article h3');
        check('E: the codex article renders after New Game', h3 === Lore.entries.ashwater.title, String(h3));
        const texPending = await page.$$eval('.codex-texture', (ns) => ns.map((n) => n.textContent));
        check('E: the new game codex lists every recurring texture as not yet', texPending.length === 3, texPending.join(' / '));
        await page.click('#btn-codex-close');
      }
      check(run + ': no page errors', errors.length === 0, errors.join('; '));
      await page.close();
    }
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto('file://' + path.join(REPO, 'index.html') + '?seed=7');
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
