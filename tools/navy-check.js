'use strict';
// Real browser check for river crossings and the river flotilla (Cycle
// 14), in headless Chromium through Playwright, against the repo's
// index.html on seed 7, at 1400 px and 390 px. Every run serves
// js/sim.js with one addition that changes no rule: Sim.tick and
// Sim.createGame record the state on window.
// Run 1, the unmodified game: the river province's card states the
// crossing cost and that it has no flotilla; the button states its cost,
// days, effect, and why it is disabled; a province off the river says so;
// the doctrine says the Dominion builds none; the preview names the crossing.
// Run 2, checker edit stated plainly: the player starts with 5000
// equipment, and only the Dominion's capital garrison and its river
// province's units stay on the map (it is still mobilizing, so nothing
// takes the front while the work runs). A flotilla is built at the
// front through the real button;
// the badge, card, and button follow it to standing, and the attack
// preview from there no longer carries the crossing, with its power equal
// to stackPower.
// Run 3: the same at 390 px: no horizontal scroll, the badge visible on top.
// Usage: node tools/navy-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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
const RIVER = Sim.provinceId(CFG.mapW / 2, 3);

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

async function serveSim(page, edit) {
  await page.route('**/js/sim.js', async (r) => {
    const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
      '\n;(function(){var S=window.AshesSim,o=S.createGame,t=S.tick;' +
      'S.tick=function(s){window.__state=s;return t(s);};' +
      'S.createGame=function(seed){var s=o(seed);window.__state=s;' + (edit || '') + 'return s;};})();\n';
    await r.fulfill({ contentType: 'application/javascript', body: src });
  });
}

async function badge(page, provId) {
  return page.evaluate((id) => {
    const tile = document.querySelector('[data-prov="' + id + '"]');
    const b = tile && tile.querySelector('.fleet-badge');
    if (!b) return { ok: false, text: null };
    tile.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: hit === b || b.contains(hit), text: b.innerText.trim() };
  }, provId);
}

async function untilTrue(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.isVisible('#event-overlay')) await page.click('#btn-event-continue');
    if (await fn()) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function buildAndRun(page, label, phone) {
  const building = phone ? 'Fl..' : 'Fleet ' + CFG.flotillaBuildDays + 'd', standing = phone ? 'Fl' : 'Fleet';
  await serveSim(page, "s.nations.player.equipment=5000;s.units=s.units.filter(function(u){return u.nation==='player'||u.provinceId===s.nations.enemy.capitalId||u.provinceId==='" + RIVER + "';});");
  await page.goto(URL);
  await page.click('#btn-pause');
  await page.click('[data-prov="p4_3"]');
  await page.click('#btn-flotilla');
  check(label + 'paid up front', (await page.textContent('#stat-equipment')) === String(5000 - CFG.flotillaCost));
  let b = await badge(page, 'p4_3');
  check(label + 'work in progress badge on top', b.ok && b.text === building, String(b.text));
  check(label + 'card and button show the work', new RegExp('River flotilla: being built, ' + CFG.flotillaBuildDays + ' days left').test(await page.textContent('#prov-details')) &&
    (await page.textContent('#btn-flotilla')) === 'Building river flotilla: ' + CFG.flotillaBuildDays + ' days left');
  await page.click('#btn-speed2');
  await page.click('#btn-pause');
  await untilTrue(page, async () => (await badge(page, 'p4_3')).text === standing, 30000);
  await page.click('#btn-pause');
  b = await badge(page, 'p4_3');
  check(label + 'standing badge on top', b.ok && b.text === standing, String(b.text));
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
    await serveSim(page);
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p4_3"]');
    check('the river province card states the crossing and no flotilla',
      (await page.textContent('#prov-details')).indexOf('River flotilla: none. Attacks from here across the river lose ' + CFG.riverCrossingPct + '% attack') !== -1);
    const have = await page.evaluate(() => window.__state.nations.player.equipment);
    check('the button states cost, days, effect, and why it is disabled',
      (await page.isDisabled('#btn-flotilla')) && (await page.textContent('#btn-flotilla')) === 'Build river flotilla (' + CFG.flotillaCost + ' eq, ' + CFG.flotillaBuildDays +
        ' days; attacks from here across the river keep full attack): need ' + CFG.flotillaCost + ', you have ' + have, await page.textContent('#btn-flotilla'));
    const pv = await page.textContent('#unit-details');
    const pm = pv.match(new RegExp('your stack power (\\d+) .*?\\(includes -' + CFG.riverCrossingPct + '% for attacking across the river, taken once off the stack: (\\d+) to (\\d+)\\)'));
    check('the preview names the crossing with the real before and after numbers', !!pm && pm[1] === pm[3] && Number(pm[3]) === Math.max(1, Math.round(Number(pm[2]) * (1 - CFG.riverCrossingPct / 100))), pm ? pm.slice(1).join(' ') : pv.slice(0, 200));
    await page.click('[data-prov="p3_3"]');
    check('a province off the river says so', (await page.textContent('#btn-flotilla')) === 'River flotilla (only provinces on the river)');
    const rv = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state;
      const westBank = s.edgeList.filter((e) => e.terrain === 'river').map((e) => (s.provinces[e.a].x < s.provinces[e.b].x ? e.a : e.b));
      const drawn = westBank.filter((id) => {
        const b = document.querySelector('[data-prov="' + id + '"] .river-bar');
        if (!b) return false;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.08);
        return r.width >= 4 && r.height > 20 && hit === b;
      });
      return { edges: westBank.length, drawn: drawn.length, extra: document.querySelectorAll('.river-bar').length };
    });
    check('1400: the river is drawn on every river edge and nowhere else', rv.edges === 7 && rv.drawn === rv.edges && rv.extra === rv.edges, JSON.stringify(rv));
    check('the doctrine says the Dominion builds none', /It builds no river flotilla, so its attacks across the river always pay the crossing\./.test(await page.textContent('#enemy-card')));
    await page.close();

    // Run 2: build one through the button, at 1400 px.
    page = await newPage();
    await buildAndRun(page, '1400: ');
    await page.click('[data-prov="p4_3"]');
    check('1400: the card says it stands', /River flotilla: standing\. Your attacks from here across the river keep full attack \(no -15%\)/.test(await page.textContent('#prov-details')) &&
      (await page.textContent('#btn-flotilla')) === 'River flotilla standing');
    const after = await page.textContent('#unit-details');
    const sim = await page.evaluate((r) => {
      const S = window.AshesSim, s = window.__state;
      const g = S.unitsIn(s, 'p4_3').filter((u) => u.nation === 'player' && !u.order);
      return S.stackPower(s, g, 'attack', r);
    }, RIVER);
    const m = after.match(/Attack [A-Za-z ]+: your stack power (\d+)/);
    check('1400: the preview drops the crossing and equals stackPower', !!m && after.indexOf('for attacking across the river') === -1 && Number(m[1]) === sim, (m && m[1]) + ' vs ' + sim);
    await page.close();

    // Run 3: phone width.
    page = await newPage({ width: 390, height: 844 });
    await buildAndRun(page, '390: ', true);
    // A tile with walls, air defense, and a fleet: every badge readable on
    // top and a unit chip still visible (checker edit: walls and air
    // defense set on p4_3 directly, the fleet built above).
    await page.evaluate(() => { const s = window.__state; s.provinces.p4_3.fortLevel = 1; s.provinces.p4_3.airDefense = 1; });
    await page.click('[data-prov="p3_3"]'); // re-render
    const stack3 = await page.evaluate(() => {
      const tile = document.querySelector('[data-prov="p4_3"]');
      tile.scrollIntoView({ block: 'center' });
      const top = (el) => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h === el || el.contains(h); };
      const badges = ['.fort-badge', '.ad-badge', '.fleet-badge'].map((q) => tile.querySelector(q));
      const chips = Array.prototype.slice.call(tile.querySelectorAll('.unit-chip'));
      return { badges: badges.map((b) => b ? b.innerText.trim() + (top(b) ? '' : ' (covered)') : 'missing'), chipVisible: chips.some(top), chips: chips.length };
    });
    check('390: walls, air defense, and fleet all read on top, and a unit chip stays visible',
      stack3.badges.join(',') === 'F1,AD,Fl' && stack3.chipVisible, JSON.stringify(stack3));
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check('390: no horizontal scroll', w <= 390, 'document width ' + w);
    const rv390 = await page.evaluate(() => Array.prototype.filter.call(document.querySelectorAll('.river-bar'), (b) => {
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return r.width >= 4 && r.height > 20 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.08) === b;
    }).length);
    check('390: the river is drawn on all 7 river edges', rv390 === 7, String(rv390));
    await page.close();
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
