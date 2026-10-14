'use strict';
// Real browser check for the fortification UI (Cycle 8), in headless
// Chromium through Playwright, against the repo's index.html on seed 7.
// Run 1, the unmodified game: the Fortify button states its cost and why
// it is disabled with the starting equipment; the Dominion doctrine text
// carries the sim's own fortify threshold.
// Run 2, checker edit stated plainly: the served js/sim.js gives the
// player 5000 starting equipment so a fortify click is possible on day 1.
// The capital is fortified through the real button; the badge, province
// card, and unit card must state the level and the exact bonus, and the
// badge must be visible on top, not hidden under unit chips.
// Run 3, checker edit stated plainly: the Dominion starts with 2000
// equipment so it walls its river province while the player's front stack
// still stands next to it; the enemy card row and the attack preview must
// name the walls.
// Run 4: no horizontal scroll at a 390 px phone width.
// Usage: node tools/fort-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

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

async function withExtraEquipment(page, nation, amount) {
  await page.route('**/js/sim.js', async (r) => {
    const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
      '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);s.nations.' +
      nation + '.equipment=' + amount + ';return s;};})();\n';
    await r.fulfill({ contentType: 'application/javascript', body: src });
  });
}

async function badgeOnTop(page, provId) {
  return page.evaluate((id) => {
    const tile = document.querySelector('[data-prov="' + id + '"]');
    const badge = tile && tile.querySelector('.fort-badge');
    if (!badge) return { ok: false, text: null };
    tile.scrollIntoView({ block: 'center' }); // a click elsewhere may have scrolled the map away
    const r = badge.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: hit === badge || badge.contains(hit), text: badge.innerText.trim() };
  }, provId);
}

async function untilText(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.isVisible('#event-overlay')) await page.click('#btn-event-continue');
    if (await fn()) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const newPage = async (vp) => { const p = await browser.newPage({ viewport: vp || { width: 1400, height: 1000 } }); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  try {
    // Run 1: the unmodified game.
    let page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p1_3"]');
    const cost1 = CFG.fortCostPerLevel;
    const label = await page.textContent('#btn-fort');
    check('button states cost, days, bonus, and why it is disabled',
      (await page.isDisabled('#btn-fort')) && label.indexOf('(' + cost1 + ' eq, ' + CFG.fortBuildDays + ' days, +' + CFG.fortDefensePctPerLevel + '% defense): need ' + cost1 + ', you have') !== -1, label);
    check('doctrine text carries the sim threshold', (await page.textContent('#ai-fort-eq')) === String(CFG.aiFortifyEquipment));
    check('province card has a fortification line', /Fortification: level 0 of 2/.test(await page.textContent('#prov-details')));
    await page.close();

    // Run 2: the player fortifies the capital through the real button.
    page = await newPage();
    await withExtraEquipment(page, 'player', 5000);
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p0_3"]');
    await page.click('#btn-fort');
    check('paid up front', (await page.textContent('#stat-equipment')) === String(5000 - cost1));
    check('work in progress on the card and button',
      /Being raised to level 1, 5 days left/.test(await page.textContent('#prov-details')) && (await page.textContent('#btn-fort')) === 'Fortifying: 5 days left');
    let badge = await badgeOnTop(page, 'p0_3');
    check('work in progress badge is visible on top of the unit chips', badge.ok && badge.text === 'Fort 1 in 5d', String(badge.text));
    await page.click('#btn-speed2');
    await page.click('#btn-pause');
    await untilText(page, async () => (await badgeOnTop(page, 'p0_3')).text === 'Fort 1', 30000);
    await page.click('#btn-pause');
    badge = await badgeOnTop(page, 'p0_3');
    check('finished badge is visible on top of the unit chips', badge.ok && badge.text === 'Fort 1', String(badge.text));
    await page.click('[data-prov="p0_3"]');
    check('card states the exact bonus', /level 1 of 2, \+25% defense for your units defending here/.test(await page.textContent('#prov-details')));
    check('unit card names the walls', /\(includes \+25% from fortifications here\)/.test(await page.textContent('#unit-details')));
    await page.close();

    // Run 3: the Dominion walls its river province; the preview and enemy card name it.
    page = await newPage();
    await withExtraEquipment(page, 'enemy', 2000);
    await page.goto(URL);
    await page.click('#btn-speed2');
    const river = Sim.provinceId(CFG.mapW / 2, 3);
    await untilText(page, async () => (await badgeOnTop(page, river)).text === 'Fort 1', 30000);
    await page.click('#btn-pause');
    const forts = await page.textContent('#stat-enemy-forts');
    check('enemy card lists Dominion walls', forts !== 'none' && /Khessograd/.test(forts), forts);
    await page.click('[data-prov="p4_3"]');
    const preview = await page.textContent('#unit-details');
    check('attack preview names the walls inside their defense', /their defense \d+ \(supply effects included; includes \+25% from level 1 fortifications\)/.test(preview));
    await page.close();

    // Run 4: phone width.
    page = await newPage({ width: 390, height: 844 });
    await page.goto(URL);
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
