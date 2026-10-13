'use strict';
// Real browser check for the air defense UI and the steel exchange
// (Cycle 10), in headless Chromium through Playwright, against the repo's
// index.html on seed 7. Every run serves js/sim.js with one addition that
// changes no rule: Sim.tick records the state it was handed on window, so
// the check can compare what the page shows with the sim's own ledger.
// Run 1, the unmodified game: the button states its cost, days, launch
// cost, and why it is disabled; the doctrine text carries the sim's
// threshold; the header scoreboard starts at zero; the province card has
// an air defense line.
// Run 2, checker edit stated plainly: the player starts with 5000
// equipment. Air defense is built at the capital through the real button;
// the card, button, and badge state the work and then the standing unit.
// Run 3, checker edit stated plainly: the Dominion's river province starts
// with air defense standing and 1000 steel. The preview for the player's
// front stack (one infantry, one drone wing) must equal stackPower with the
// target and name the launch and its steel; the stack is then ordered in
// through the map, the launch must appear in the log, and the header and
// the breakdown card must equal the sim's ledger, rounded.
// Run 4: no horizontal scroll at a 390 px phone width.
// Usage: node tools/ad-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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
const RIVER_NAME = Sim.createGame(7).provinces[RIVER].name;

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// Serve the sim with the state hook and an optional edit to the new game.
async function serveSim(page, edit) {
  await page.route('**/js/sim.js', async (r) => {
    const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
      '\n;(function(){var S=window.AshesSim,o=S.createGame,t=S.tick;' +
      'S.tick=function(s){window.__state=s;return t(s);};' +
      'S.createGame=function(seed){var s=o(seed);window.__state=s;' + (edit || '') + 'return s;};})();\n';
    await r.fulfill({ contentType: 'application/javascript', body: src });
  });
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

async function badge(page, provId) {
  return page.evaluate((id) => {
    const tile = document.querySelector('[data-prov="' + id + '"]');
    const b = tile && tile.querySelector('.ad-badge');
    if (!b) return { ok: false, text: null };
    tile.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: hit === b || b.contains(hit), text: b.textContent };
  }, provId);
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
    await page.click('[data-prov="p1_3"]');
    const label = await page.textContent('#btn-ad');
    check('button states cost, days, launch cost, and why it is disabled',
      (await page.isDisabled('#btn-ad')) && label.indexOf('Build air defense (' + CFG.airDefenseCost + ' eq, ' + CFG.airDefenseBuildDays +
        ' days; ' + CFG.interceptorSteel + ' steel per launch): need ' + CFG.airDefenseCost + ', you have') === 0, label);
    check('doctrine text carries the sim threshold', (await page.textContent('#ai-ad-eq')) === String(CFG.aiAirDefenseEquipment));
    check('province card has an air defense line', /Air defense: none/.test(await page.textContent('#prov-details')));
    check('header scoreboard starts at zero',
      (await page.textContent('#xc-you')) === '0' && (await page.textContent('#xc-them')) === '0' &&
      (await page.textContent('#xc-ratio')) === 'No steel bled yet.');
    check('scoreboard explanation carries the sim numbers',
      (await page.textContent('#xc-explain')).indexOf('costs ' + CFG.unitTypes.drone.steelCost + ' steel, so ' +
        (CFG.unitTypes.drone.steelCost / CFG.unitTypes.drone.strength) + ' a point') !== -1);
    await page.click('[data-prov="' + RIVER + '"]');
    check('an enemy province says the button is for your own provinces', (await page.textContent('#btn-ad')) === 'Air defense (only your own provinces)');
    await page.close();

    // Run 2: the player builds air defense at the capital through the button.
    page = await newPage();
    await serveSim(page, 's.nations.player.equipment=5000;');
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p0_3"]');
    await page.click('#btn-ad');
    check('paid up front', (await page.textContent('#stat-equipment')) === String(5000 - CFG.airDefenseCost));
    check('work in progress on the card and the button',
      new RegExp('Air defense: being built, ' + CFG.airDefenseBuildDays + ' days left').test(await page.textContent('#prov-details')) &&
      (await page.textContent('#btn-ad')) === 'Building air defense: ' + CFG.airDefenseBuildDays + ' days left');
    let b = await badge(page, 'p0_3');
    check('work in progress badge is visible on top', b.ok && b.text === 'AD in ' + CFG.airDefenseBuildDays + 'd', String(b.text));
    await page.click('#btn-speed2');
    await page.click('#btn-pause'); // resume: the speed button keeps a paused game paused
    await untilTrue(page, async () => (await badge(page, 'p0_3')).text === 'AD', 30000);
    await page.click('#btn-pause');
    b = await badge(page, 'p0_3');
    check('standing badge is visible on top', b.ok && b.text === 'AD', String(b.text));
    await page.click('[data-prov="p0_3"]');
    const card = await page.textContent('#prov-details');
    check('card states what it does and what it costs',
      card.indexOf('Air defense: standing. When enemy drone wings attack troops here, it launches one interceptor per wing before the fight, ' +
        CFG.interceptorSteel + ' steel each from your stockpile, -' + CFG.interceptStrength + ' strength per wing hit') !== -1, card);
    check('the button says it is standing', (await page.isDisabled('#btn-ad')) && (await page.textContent('#btn-ad')) === 'Air defense standing');
    await page.close();

    // Run 3: the Dominion's river province has air defense; the preview and the scoreboard.
    page = await newPage();
    await serveSim(page, 's.provinces.' + RIVER + '.airDefense=1;s.nations.enemy.steel=1000;');
    await page.goto(URL);
    await page.click('#btn-pause');
    check('enemy card names the Dominion air defense', (await page.textContent('#stat-enemy-ad')) === RIVER_NAME, await page.textContent('#stat-enemy-ad'));
    await page.click('[data-prov="p4_3"]');
    const preview = await page.textContent('#unit-details');
    const m = preview.match(/your stack power (\d+)/);
    const sim = await page.evaluate((r) => {
      const S = window.AshesSim, s = window.__state;
      const stack = S.unitsIn(s, 'p4_3').filter((u) => u.nation === 'player');
      return { withTarget: S.stackPower(s, stack, 'attack', r), plain: S.stackPower(s, stack, 'attack') };
    }, RIVER);
    check('preview power is stackPower with the target', !!m && Number(m[1]) === sim.withTarget, (m && m[1]) + ' vs ' + sim.withTarget);
    check('preview names the launch and its steel',
      preview.indexOf('Their air defense there launches one interceptor per drone wing (' + CFG.interceptorSteel + ' steel each, -' +
        CFG.interceptStrength + ' strength) while their steel lasts: 1 of your 1 wing would be hit (' + CFG.interceptorSteel + ' of their steel), 1 fights on at lower strength with full attack.') !== -1, preview);
    // Order the front stack into the river province through the map: the
    // first click picked the infantry, the second picks the drone wing.
    await page.click('[data-prov="' + RIVER + '"]');
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="' + RIVER + '"]');
    const ordered = await page.evaluate(() => window.__state.units.filter((u) => u.nation === 'player' && u.order).map((u) => u.type).sort().join(','));
    check('both front units ordered through the map', ordered === 'drone,infantry', ordered);
    await page.click('#btn-pause');
    await untilTrue(page, () => page.evaluate(() => window.__state.day > 1), 10000);
    await page.click('#btn-pause');
    const logText = await page.textContent('#log');
    check('the log names the launch and its steel',
      logText.indexOf('Khessite air defense at ' + RIVER_NAME + ' launches 1 interceptor (' + CFG.interceptorSteel + ' steel)') !== -1, logText.slice(0, 300));
    await page.click('#btn-pause');
    const shown = await page.evaluate(() => ({
      you: document.getElementById('xc-you').textContent, them: document.getElementById('xc-them').textContent,
      youLost: document.getElementById('xc-you-lost').textContent, themLaunch: document.getElementById('xc-them-launch').textContent,
      ratio: document.getElementById('xc-ratio').textContent, l: window.__state.ledger
    }));
    const round = (l) => String(Math.round(l.lostSteel + l.launchSteel));
    check('header totals equal the sim ledger, rounded', shown.you === round(shown.l.player) && shown.them === round(shown.l.enemy),
      shown.you + '/' + shown.them + ' vs ' + JSON.stringify(shown.l));
    check('breakdown equals the sim ledger', shown.youLost === String(Math.round(shown.l.player.lostSteel)) &&
      shown.themLaunch === shown.l.enemy.launchSteel + ' (' + shown.l.enemy.launches + (shown.l.enemy.launches === 1 ? ' launch)' : ' launches)'), shown.youLost + ', ' + shown.themLaunch);
    check('the ratio is stated in words', /bleeds \d+\.\d steel for every 1 of (yours|theirs)\./.test(shown.ratio), shown.ratio);
    check('the launch is in the ledger', shown.l.enemy.launches === 1 && shown.l.enemy.launchSteel === CFG.interceptorSteel, JSON.stringify(shown.l.enemy));
    await page.close();

    // Run 4: phone width.
    page = await newPage({ width: 390, height: 844 });
    await serveSim(page);
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
