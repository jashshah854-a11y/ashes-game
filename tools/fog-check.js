'use strict';
// Real browser check for fog of war and drone recon (Cycle 12), in
// headless Chromium through Playwright, against the repo's index.html on
// seed 7, at 1400 px and at a 390 px phone width. Every run serves
// js/sim.js with one addition that changes no rule: Sim.tick and
// Sim.createGame record the state on window, so the page can be compared
// with the sim's own visibility.
// Run 1, the unmodified game: every province the sim says you cannot see
// is drawn fogged with no unit chips, every seen one is not; the enemy
// card counts only the Dominion units you see; an unseen province's card
// says its units are unknown.
// Run 2: the front drone wing flies recon through its card's button; the
// provinces the sim lit are drawn and their units shown, the button and
// the unit card say it flew, the map no longer offers it a march, the log
// names the flight, and the infantry's attack preview leaves the wing out.
// Run 3, checker edit stated plainly: the Dominion starts with Jamming Gen
// 1. The button warns that the flight would be blinded; after the click
// the log says it was and nothing beyond the front is revealed.
// Run 4: no horizontal scroll at 390 px, and the fog matches the sim there too.
// Usage: node tools/fog-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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

async function serveSim(page, edit) {
  await page.route('**/js/sim.js', async (r) => {
    const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
      '\n;(function(){var S=window.AshesSim,o=S.createGame,t=S.tick;' +
      'S.tick=function(s){window.__state=s;return t(s);};' +
      'S.createGame=function(seed){var s=o(seed);window.__state=s;' + (edit || '') + 'return s;};})();\n';
    await r.fulfill({ contentType: 'application/javascript', body: src });
  });
}

// Compare every tile with the sim: fogged exactly when unseen, and no
// enemy chip on any fogged tile.
async function fogMatches(page) {
  return page.evaluate(() => {
    const S = window.AshesSim, s = window.__state;
    const seen = S.visibleProvinces(s, 'player');
    const bad = [];
    Object.keys(s.provinces).forEach((id) => {
      const tile = document.querySelector('[data-prov="' + id + '"]');
      const fogged = tile.classList.contains('fogged');
      if (fogged === !!seen[id]) bad.push(id + (fogged ? ' fogged but seen' : ' unfogged but unseen'));
      if (fogged && tile.querySelector('.unit-chip.theirs')) bad.push(id + ' shows an enemy chip while fogged');
    });
    return { ok: bad.length === 0, bad: bad.slice(0, 5), unseen: Object.keys(s.provinces).filter((id) => !seen[id]).length };
  });
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
    let fm = await fogMatches(page);
    check('fog on the map matches the sim, and no enemy chip shows in fog', fm.ok && fm.unseen > 0, fm.bad.join('; ') + ' (' + fm.unseen + ' unseen)');
    const seenCount = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state;
      return S.unitsOf(s, 'enemy').filter((u) => S.canSee(s, 'player', u.provinceId)).length;
    });
    check('the enemy card counts only the units you see, and never says whether any are hidden',
      (await page.textContent('#stat-enemy-units')) === seenCount + ' seen; units in provinces you cannot see are unknown', await page.textContent('#stat-enemy-units'));
    const cap = Sim.createGame(7).nations.enemy.capitalId;
    await page.click('[data-prov="' + cap + '"]');
    check('an unseen province says its units are unknown', /Units here: unknown\./.test(await page.textContent('#prov-details')) &&
      /Sight: unseen\. Units here are unknown/.test(await page.textContent('#prov-details')));
    check('the hint explains the recon outline', /outlined in green/.test(await page.textContent('.hint')));
    check('the doctrine says the Dominion sees by the same rule', /decides only on what it sees, and flies no recon/.test(await page.textContent('#enemy-card')));
    await page.close();

    // Run 1a (Cycle 14): a unit ordered elsewhere is left out of the attack preview.
    page = await newPage();
    await serveSim(page);
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p4_3"]'); // picks the infantry
    await page.click('[data-prov="p4_2"]'); // orders it to p4_2
    await page.click('[data-prov="p4_3"]'); // picks the drone wing
    const pv = await page.textContent('#unit-details');
    const expectPower = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state, t = S.provinceId(S.CFG.mapW / 2, 3);
      const g = S.unitsIn(s, 'p4_3').filter((x) => x.nation === 'player' && (!x.order || x.order.target === t));
      return S.stackPower(s, g, 'attack', t);
    });
    const pp = pv.match(/your stack power (\d+)/);
    check('the preview leaves out a unit ordered elsewhere and says a click orders one unit',
      /^Drone Wing/.test(pv) && !!pp && Number(pp[1]) === expectPower && expectPower === 3 &&
      /\(1 unit here is ordered elsewhere and left out\)/.test(pv) && /A click orders only the selected unit\./.test(pv), (pp && pp[1]) + ' vs ' + expectPower);
    await page.close();

    // Run 1b: the war on days 6 to 8 while the Dominion builds in fog.
    page = await newPage();
    await serveSim(page);
    await page.goto(URL);
    await page.click('#btn-speed2');
    await page.waitForFunction(() => window.__state && window.__state.day >= 9, null, { timeout: 30000 });
    await page.click('#btn-pause');
    const logs = await page.evaluate(() => {
      const s = window.__state;
      return {
        hidden: s.log.filter((e) => e.day >= 6 && e.day <= 8 && e.hiddenFrom && e.hiddenFrom.indexOf('player') !== -1).map((e) => e.msg),
        shown: document.getElementById('log').textContent
      };
    });
    check('the war log leaves out Dominion production in fog',
      logs.hidden.length > 0 && logs.hidden.every((m) => logs.shown.indexOf(m) === -1) && !/Khessite line \d completes/.test(logs.shown),
      logs.hidden.length + ' hidden lines on days 6 to 8');
    await page.close();

    // Run 2: recon through the button.
    page = await newPage();
    await serveSim(page);
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="p4_3"]'); // the second click picks the drone wing
    const label = await page.textContent('#btn-recon');
    check('the recon button states range, duration, and that the wing holds',
      label === 'Fly recon (Gen 1: lights every province within ' + CFG.reconRange[1] + ' hops through tomorrow; the wing holds today)', label);
    await page.click('#btn-recon');
    const after = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state;
      const lit = Object.keys(s.recon.player).filter((id) => s.recon.player[id] >= s.day);
      return { lit, deep: lit.filter((id) => !S.neighborsOf(s, s.provinces[id]).some((np) => np.owner === 'player') && s.provinces[id].owner !== 'player') };
    });
    check('recon lit the provinces within range', after.lit.length === Sim.provincesWithin(Sim.createGame(7), 'p4_3', CFG.reconRange[1]).length, after.lit.length + ' lit');
    fm = await fogMatches(page);
    check('the lit provinces are drawn unfogged and marked', fm.ok && after.deep.length > 0 &&
      (await page.evaluate((ids) => ids.every((id) => document.querySelector('[data-prov="' + id + '"]').classList.contains('lit')), after.deep)), after.deep.join(','));
    await page.click('[data-prov="' + after.deep[0] + '"]');
    const day = await page.evaluate(() => window.__state.day);
    check('a recon lit province card says so, with the last day', new RegExp('Sight: lit by your recon through day ' + (day + 1)).test(await page.textContent('#prov-details')), await page.textContent('#prov-details'));
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="p4_3"]'); // back to the wing
    check('the button and the unit card say it flew', (await page.textContent('#btn-recon')) === 'Fly recon: this wing already flew today' &&
      /Flew recon today; it holds this province until tomorrow\./.test(await page.textContent('#unit-details')));
    check('the map offers the wing no march today', (await page.$$eval('.province.reachable', (ns) => ns.length)) === 0);
    check('the log names the flight', /Vessari recon from .* \(Gen 1, 2 hops\) lights \d+ provinces through tomorrow\./.test(await page.textContent('#log')));
    await page.click('[data-prov="p4_3"]'); // cycles to the infantry
    const inf = await page.textContent('#unit-details');
    const marchable = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state;
      const st = S.unitsIn(s, 'p4_3').filter((x) => x.nation === 'player' && x.reconDay !== s.day);
      return S.stackPower(s, st, 'attack', S.provinceId(S.CFG.mapW / 2, 3));
    });
    const pm = inf.match(/your stack power (\d+)/);
    check('after recon, the infantry preview counts only the units that can march',
      /^Infantry Division/.test(inf) && !!pm && Number(pm[1]) === marchable && /1 drone wing here flew recon today and cannot march/.test(inf), (pm && pm[1]) + ' vs ' + marchable);
    await page.close();

    // Run 3: the Dominion's jamming blinds Gen 1 recon.
    page = await newPage();
    await serveSim(page, 's.nations.enemy.jamming=1;');
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="p4_3"]');
    check('the button warns the flight would be blinded', /Warning: Dominion Jamming Gen 1 reaches Gen 1 drones, so the flight would be blinded$/.test(await page.textContent('#btn-recon')), await page.textContent('#btn-recon'));
    await page.click('#btn-recon');
    check('the log says it was blinded', /recon from .* is blinded: Khessite Jamming Gen 1 reaches Gen 1 drones\. Nothing is seen\./.test(await page.textContent('#log')));
    fm = await fogMatches(page);
    check('nothing beyond the front is revealed', fm.ok && (await page.$$eval('.province.lit', (ns) => ns.length)) === 0, fm.bad.join('; '));
    await page.close();

    // Run 4: phone width.
    page = await newPage({ width: 390, height: 844 });
    await serveSim(page);
    await page.goto(URL);
    await page.click('#btn-pause');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check('no horizontal scroll at 390 px', w <= 390, 'document width ' + w);
    fm = await fogMatches(page);
    check('fog matches the sim at 390 px', fm.ok, fm.bad.join('; '));
    const tags = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.fog-tag'), (t) => {
      const r = t.getBoundingClientRect(), tile = t.closest('.province').getBoundingClientRect();
      return { text: t.innerText.trim(), inside: r.left >= tile.left - 0.5 && r.right <= tile.right + 0.5 };
    }));
    check('at 390 px the fog tag is short and fits its tile', tags.length > 0 && tags.every((t) => t.text === '?' && t.inside), JSON.stringify(tags[0]));
    await page.close();
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
