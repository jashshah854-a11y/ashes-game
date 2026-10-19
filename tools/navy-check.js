'use strict';
// Real browser check for the navy UI (Cycle 14 step 2), in headless
// Chromium through Playwright, against the repo's index.html on
// seed 7, in the intel-check pattern. Every expected number and
// wording that carries a number is computed in this file from the
// sim's own readouts (Sim.flotillaStock, Sim.coastalControlCount,
// Sim.blockadeLoss, Sim.riverCrossingSupported,
// Sim.riverCrossingPenaltyFor, Sim.stackPower, Sim.deployFlotilla)
// and CFG, never copied from a panel.
// Run 1, the unmodified game, paused before the first tick: the
// nation card shows the flotilla stock, both coastal control
// counts, and both blockade losses from the readouts, and its navy
// explain states the build price, the blockade threshold and
// percent, the crossing percent, and that flotillas never carry
// troops and there are no invasions; a production row offers a
// Retool to Flotilla button and the summary names the flotilla
// stock; every coastal tile carries the coast badge and no tile
// carries a flotilla badge; no tile draws a river bar (retired in
// Cycle 23 Step 12b) and the river edge east of the front province is
// unsupported by the readout; the province card for an
// owned coastal province states its coastal and river status, that
// no flotilla is stationed, and offers the Deploy control naming
// the province and the stock; an inland province that is neither
// coastal nor river shows the Deploy control disabled with its
// reason on the button; and the attack preview against the river
// front province states the penalized stack power from the shared
// readout and names the crossing penalty with its percent.
// Run 2, checker edit stated plainly: the served js/sim.js wraps
// createGame and stages two flotillas in the player's stockpile.
// Deploying one on the front river province through the real
// control stations it (badge on the tile, the crossing supported by
// the readout with no tile river bar, the
// card stating the station and the supported crossing, and the
// preview now stating the penalty does not apply at full attack);
// deploying the second on an owned coastal province through the
// real control moves the coastal control count by exactly the
// mirror's amount.
// Run 3, checker edit stated plainly: the wrapper flips three
// Dominion home coastal provinces to the player with a player
// flotilla stationed on each, the smallest staging that meets the
// blockade threshold. The nation card's blockade lines must equal
// the node mirror with the same edits: the Dominion loses the
// readout amount, the player loses the mirror's amount, and both
// coastal counts match.
// Run 4, the unmodified game again: deploying with an empty stock
// through the real control surfaces the sim's empty stock refusal
// verbatim in the card notice and stations nothing.
// Run 5: no horizontal scroll at a 390 px phone width.
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

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

async function tile(page, id) {
  return page.evaluate((tid) => {
    const t = document.querySelector('[data-prov="' + tid + '"]');
    return {
      text: t.textContent.replace(/\s+/g, ' ').trim(),
      coast: !!t.querySelector('.coast-badge'),
      flotilla: Array.prototype.map.call(t.querySelectorAll('.flotilla-badge'), (b) => b.textContent.replace(/\s+/g, ' ').trim())
    };
  }, id);
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
    const fresh = Sim.createGame(7);
    const total = Object.keys(fresh.provinces).length;
    const coastalIds = Object.keys(fresh.provinces).filter((id) => fresh.provinces[id].coastal);
    const front = 'p4_3';
    const frontName = fresh.provinces[front].name;
    const target = 'p5_3';
    const targetName = fresh.provinces[target].name;
    const myStack = Sim.unitsIn(fresh, front).filter((u) => u.nation === 'player');
    const crossPower = Sim.stackPower(fresh, myStack, 'attack', { toId: target });
    const fullPower = Sim.stackPower(fresh, myStack, 'attack');
    const crossPct = Sim.riverCrossingPenaltyFor(fresh, myStack[0], target);
    if (!(crossPct > 0 && crossPower < fullPower)) throw new Error('staging assumption broken: front crossing is not penalized at start');
    const ownCoastal = 'p0_0';
    const ownCoastalName = fresh.provinces[ownCoastal].name;
    const inland = 'p2_3';
    if (fresh.provinces[inland].coastal || Sim.isRiverProvince(fresh, inland)) {
      throw new Error('staging assumption broken: ' + inland + ' is coastal or river');
    }

    // Run 1: the unmodified game at the start.
    let page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    check('nation card shows the flotilla stock from the readout',
      (await page.textContent('#stat-flotillas')) === String(Sim.flotillaStock(fresh, 'player')),
      await page.textContent('#stat-flotillas'));
    check('nation card shows both coastal control counts from the readout',
      (await page.textContent('#stat-coastal-player')) === String(Sim.coastalControlCount(fresh, 'player')) &&
        (await page.textContent('#stat-coastal-enemy')) === String(Sim.coastalControlCount(fresh, 'enemy')),
      (await page.textContent('#stat-coastal-player')) + ' / ' + (await page.textContent('#stat-coastal-enemy')));
    check('nation card shows both blockade losses from the readout',
      (await page.textContent('#stat-blockade-player')) === String(Sim.blockadeLoss(fresh, 'player')) &&
        (await page.textContent('#stat-blockade-enemy')) === String(Sim.blockadeLoss(fresh, 'enemy')),
      (await page.textContent('#stat-blockade-player')) + ' / ' + (await page.textContent('#stat-blockade-enemy')));
    const navyExplain = (await page.textContent('#navy-explain')).replace(/\s+/g, ' ').trim();
    check('navy explain states the whole system in plain words, with the CFG numbers',
      navyExplain.indexOf(CFG.unitTypes.flotilla.steelCost + ' steel over ' + CFG.unitTypes.flotilla.buildDays + ' days') !== -1 &&
        navyExplain.indexOf('plus ' + Sim.manpowerCost('flotilla') + ' manpower paid when queued') !== -1 &&
        navyExplain.indexOf('Control at least ' + CFG.blockadeCoastalThreshold + ' of the other nation\'s home coastal provinces') !== -1 &&
        navyExplain.indexOf('loses ' + CFG.blockadeSteelPct + '% of its daily steel income to blockade') !== -1 &&
        navyExplain.indexOf('removes the ' + CFG.riverCrossingPct + '% river crossing penalty') !== -1 &&
        navyExplain.indexOf('Flotillas never carry troops and there are no invasions.') !== -1,
      navyExplain.slice(0, 240));
    const rowsText = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#production-lines .prod-line'),
      (r) => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    check('a production row offers a Retool to Flotilla button, from CFG',
      rowsText.indexOf('Retool to ' + CFG.unitTypes.flotilla.label) !== -1, rowsText.slice(0, 200));
    const summary = await page.textContent('#prod-summary');
    check('production summary names the flotilla stock from the readout',
      summary.indexOf('Flotilla stock: ' + Sim.flotillaStock(fresh, 'player') + ' (finished Flotillas join this stockpile)') !== -1,
      summary);
    let coastCount = 0;
    let flotillaTiles = 0;
    for (const id of Object.keys(fresh.provinces)) {
      const t = await tile(page, id);
      if (t.coast) coastCount++;
      if (t.flotilla.length) flotillaTiles++;
    }
    check('every coastal tile carries the coast badge and no other tile does',
      coastCount === coastalIds.length, coastCount + ' badged of ' + coastalIds.length + ' coastal, of ' + total);
    check('no tile carries a flotilla badge before any flotilla is stationed',
      flotillaTiles === 0, String(flotillaTiles));
    // Cycle 23 Step 12b: the tile river bars are retired. The base canvas has
    // drawn the river since Step 10 and MAP_TREATMENT retires river as an edge
    // style, so this check now asserts no tile carries a river bar while the
    // staged crossing fact (unsupported at the start) still holds in the sim.
    const riverBarsRun1 = await page.evaluate(() => document.querySelectorAll('#map .province .river-bar').length);
    check('no tile draws a river bar (retired), and the river edge east of the front province is unsupported by the readout',
      riverBarsRun1 === 0 && Sim.riverCrossingSupported(fresh, 'player', front, target) === false,
      'riverBars=' + riverBarsRun1);
    await page.click('[data-prov="' + ownCoastal + '"]');
    let details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('province card for an owned coastal province states its coastal and river status and that no flotilla is stationed',
      details.indexOf('Coastal: yes, this province faces the sea') !== -1 &&
        details.indexOf('River: no') !== -1 &&
        details.indexOf('Flotilla: none stationed here') !== -1,
      details.slice(0, 300));
    check('deploy control on an eligible owned coastal province is enabled and names the province and the stock',
      (await page.evaluate(() => document.getElementById('btn-flotilla').disabled)) === false &&
        (await page.textContent('#btn-flotilla')) === 'Deploy flotilla in ' + ownCoastalName + ' (stock: ' + Sim.flotillaStock(fresh, 'player') + ')',
      await page.textContent('#btn-flotilla'));
    await page.click('[data-prov="' + inland + '"]');
    check('deploy control on an inland province that is neither coastal nor river is disabled with its reason on the button',
      (await page.evaluate(() => document.getElementById('btn-flotilla').disabled)) === true &&
        (await page.textContent('#btn-flotilla')) === 'Deploy flotilla (needs coastal or river ground)',
      await page.textContent('#btn-flotilla'));
    await page.click('[data-prov="' + front + '"]');
    const unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('attack preview against the river front province states the penalized stack power from the shared readout',
      unitText.indexOf('Attack ' + targetName + ': your stack power ' + crossPower + ' vs their defense ') !== -1 &&
        crossPower !== fullPower,
      unitText.slice(0, 300));
    check('attack preview names the river crossing penalty with its percent and how to remove it',
      unitText.indexOf('River crossing to ' + targetName + ': your attack loses ' + crossPct +
        '% crossing the river without flotilla support, already included in your stack power above.') !== -1 &&
        unitText.indexOf('Station a flotilla at either bank (' + frontName + ' or ' + targetName + ') to remove it.') !== -1,
      unitText.slice(0, 400));
    await page.close();

    // Run 2: two staged flotillas, deployed through the real control.
    const mirror2 = Sim.createGame(7);
    mirror2.nations.player.flotillas = 2;
    if (!Sim.deployFlotilla(mirror2, 'player', front).ok) throw new Error('staging assumption broken: mirror river deploy failed');
    if (!Sim.deployFlotilla(mirror2, 'player', ownCoastal).ok) throw new Error('staging assumption broken: mirror coastal deploy failed');
    page = await newPage();
    await serveEdited(page, 's.nations.player.flotillas=2;');
    await page.goto(URL);
    await page.click('#btn-pause');
    check('staged flotilla stock shows on the nation card',
      (await page.textContent('#stat-flotillas')) === '2', await page.textContent('#stat-flotillas'));
    await page.click('[data-prov="' + front + '"]');
    details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('province card for the front river province states it stands on the river and that its crossings are not supported yet',
      details.indexOf('River: yes, this province stands on the river') !== -1 &&
        details.indexOf('River crossings for you: not supported. Your attacks across the river here lose ' +
          CFG.riverCrossingPct + '% attack') !== -1,
      details.slice(0, 340));
    await page.click('#btn-flotilla');
    check('deploying through the real control spends one stock and stations the flotilla on the tile',
      (await page.textContent('#stat-flotillas')) === '1' &&
        (await tile(page, front)).flotilla.length === 1 &&
        (await tile(page, front)).flotilla[0] === 'Flotilla: Yours',
      (await tile(page, front)).text);
    // Cycle 23 Step 12b: river bars retired (see run 1); the supported
    // crossing is asserted through the sim readout on the mirror instead.
    const riverBarsRun2 = await page.evaluate(() => document.querySelectorAll('#map .province .river-bar').length);
    check('no tile draws a river bar (retired), and the stationed edge is supported by the readout',
      riverBarsRun2 === 0 && Sim.riverCrossingSupported(mirror2, 'player', front, target) === true,
      'riverBars=' + riverBarsRun2);
    details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('the front province card now states the stationed flotilla and the supported crossing',
      details.indexOf('Flotilla: stationed here, yours') !== -1 &&
        details.indexOf('River crossings for you: supported by a flotilla at one bank, so no ' +
          CFG.riverCrossingPct + '% crossing penalty') !== -1,
      details.slice(0, 340));
    const unitText2 = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('the preview now states the penalty does not apply, at the full unpenalized stack power',
      unitText2.indexOf('Attack ' + targetName + ': your stack power ' + fullPower + ' vs their defense ') !== -1 &&
        unitText2.indexOf('River crossing to ' + targetName + ': a flotilla of yours stationed at either bank ' +
          'supports this crossing, so the ' + CFG.riverCrossingPct + '% river crossing penalty does not apply.') !== -1,
      unitText2.slice(0, 400));
    await page.click('[data-prov="' + ownCoastal + '"]');
    await page.click('#btn-flotilla');
    check('deploying the second flotilla on owned coastal ground moves the coastal control count to the mirror amount',
      (await page.textContent('#stat-flotillas')) === String(Sim.flotillaStock(mirror2, 'player')) &&
        (await page.textContent('#stat-coastal-player')) === String(Sim.coastalControlCount(mirror2, 'player')) &&
        Sim.coastalControlCount(mirror2, 'player') === Sim.coastalControlCount(fresh, 'player') + 1,
      'count ' + (await page.textContent('#stat-coastal-player')) + ', mirror ' + Sim.coastalControlCount(mirror2, 'player'));
    await page.close();

    // Run 3: a staged blockaded game, mirrored in node.
    const flipped = ['p9_0', 'p9_6', 'p8_0'];
    const mirror3 = Sim.createGame(7);
    flipped.forEach((id) => { mirror3.provinces[id].owner = 'player'; mirror3.provinces[id].flotilla = 'player'; });
    if (!Sim.isBlockaded(mirror3, 'enemy') || Sim.blockadeLoss(mirror3, 'enemy') <= 0) {
      throw new Error('staging assumption broken: mirror is not blockading the Dominion');
    }
    page = await newPage();
    await serveEdited(page, flipped.map((id) =>
      's.provinces[\'' + id + '\'].owner=\'player\';s.provinces[\'' + id + '\'].flotilla=\'player\';').join(''));
    await page.goto(URL);
    await page.click('#btn-pause');
    check('blockaded game: nation card coastal counts match the mirror',
      (await page.textContent('#stat-coastal-player')) === String(Sim.coastalControlCount(mirror3, 'player')) &&
        (await page.textContent('#stat-coastal-enemy')) === String(Sim.coastalControlCount(mirror3, 'enemy')),
      (await page.textContent('#stat-coastal-player')) + ' / ' + (await page.textContent('#stat-coastal-enemy')) +
        ' vs mirror ' + Sim.coastalControlCount(mirror3, 'player') + ' / ' + Sim.coastalControlCount(mirror3, 'enemy'));
    check('blockaded game: Dominion steel lost to blockade today equals the readout on the mirror',
      (await page.textContent('#stat-blockade-enemy')) === String(Sim.blockadeLoss(mirror3, 'enemy')),
      (await page.textContent('#stat-blockade-enemy')) + ' vs ' + Sim.blockadeLoss(mirror3, 'enemy'));
    check('blockaded game: your steel lost to blockade today equals the readout on the mirror',
      (await page.textContent('#stat-blockade-player')) === String(Sim.blockadeLoss(mirror3, 'player')),
      (await page.textContent('#stat-blockade-player')) + ' vs ' + Sim.blockadeLoss(mirror3, 'player'));
    const flippedTile = await tile(page, flipped[0]);
    check('a flipped coastal tile carries the coast badge and your flotilla badge',
      flippedTile.coast && flippedTile.flotilla.length === 1 && flippedTile.flotilla[0] === 'Flotilla: Yours',
      flippedTile.text);
    await page.close();

    // Run 4: an empty stock refusal through the real control.
    const mirror4 = Sim.createGame(7);
    const emptyReason = Sim.deployFlotilla(mirror4, 'player', ownCoastal).reason;
    page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('[data-prov="' + ownCoastal + '"]');
    await page.click('#btn-flotilla');
    const notice = (await page.textContent('#prov-notice')).replace(/\s+/g, ' ').trim();
    check('deploying with an empty stock surfaces the sim refusal verbatim in the card notice',
      notice === emptyReason &&
        (await page.evaluate(() => document.getElementById('prov-notice').className)) === 'prod-rejected',
      notice);
    check('the refused deployment stations nothing and spends nothing',
      (await page.textContent('#stat-flotillas')) === String(Sim.flotillaStock(fresh, 'player')) &&
        (await tile(page, ownCoastal)).flotilla.length === 0,
      (await tile(page, ownCoastal)).text);
    await page.close();

    // Run 5: phone width.
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
