'use strict';
// Real browser check for the drones and EW UI (Cycle 12 step 2), in
// headless Chromium through Playwright, against the repo's index.html
// on seed 7, in the manpower-check pattern. Every expected number is
// computed in this file from the sim's own readouts (Sim.exchangeRecord,
// Sim.droneGeneration, Sim.jammingGeneration, Sim.droneEffectiveness,
// Sim.interceptorStock, Sim.interceptorCost) and CFG, never copied
// from the panel.
// Run 1, the unmodified game, paused before the first tick: the nation
// and enemy cards show both generations and the interceptor stock from
// the readouts; the scoreboard reads all zero with the even headline;
// the research surfaces state the Gen 3 cost and prerequisite and the
// next jamming generation and its cost; a production row offers a
// Retool to Interceptor button; the attack preview from the front
// province (a stack holding a drone wing, facing a defended province
// whose nation holds stock) states the launches the attack triggers,
// their steel cost, that the targeted drones die to them, and both
// effectiveness percents with their generation numbers; the drone
// wing's unit card states its nation's drone generation.
// Run 2, checker edit stated plainly: the served js/sim.js wraps
// createGame and fights one staged battle before the game returns: the
// player's lone front drone wing attacks the enemy province stack
// through the real Sim.resolveBattle, so the defender launches exactly
// one interceptor and the ledger records that exchange. The scoreboard
// must show the node's own staged figures, and the enemy card the
// staged stock.
// Run 3, checker edit stated plainly: the wrapper fields Drone Gen 2
// for the player and banks 200 research points. The real Gen 3 button
// fields Gen 3 for its exact cost, and the real jamming button then
// fields Jamming Gen 1 for its exact cost, leaving the Gen 2 jamming
// button disabled for want of points.
// Run 4: no horizontal scroll at a 390 px phone width.
// Usage: node tools/drone-ew-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const newPage = async (vp) => { const p = await browser.newPage({ viewport: vp || { width: 1400, height: 1000 } }); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  try {
    const fresh = Sim.createGame(7);

    // Run 1: the unmodified game at the start.
    let page = await newPage();
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    check('nation card shows the drone generation from the readout',
      (await page.textContent('#stat-drone-gen')) === 'Gen ' + Sim.droneGeneration(fresh, 'player'));
    check('nation card shows the jamming generation from the readout',
      (await page.textContent('#stat-jamming-gen')) === 'Gen ' + Sim.jammingGeneration(fresh, 'player'));
    check('nation card shows the interceptor stock from the readout',
      (await page.textContent('#stat-interceptors')) === String(Sim.interceptorStock(fresh, 'player')),
      'stock ' + Sim.interceptorStock(fresh, 'player'));
    check('enemy card shows the Dominion drone generation from the readout',
      (await page.textContent('#stat-enemy-gen')) === 'Gen ' + Sim.droneGeneration(fresh, 'enemy'));
    check('enemy card shows the Dominion jamming generation from the readout',
      (await page.textContent('#stat-enemy-jamming')) === 'Gen ' + Sim.jammingGeneration(fresh, 'enemy'));
    check('enemy card shows the Dominion interceptor stock from the readout',
      (await page.textContent('#stat-enemy-interceptors')) === String(Sim.interceptorStock(fresh, 'enemy')),
      'stock ' + Sim.interceptorStock(fresh, 'enemy'));
    const zero = Sim.exchangeRecord(fresh, 'player');
    check('scoreboard starts at the readout zero for both nations',
      (await page.textContent('#ex-player-destroyed')) === String(zero.destroyed) &&
        (await page.textContent('#ex-player-lost')) === String(zero.lost) &&
        (await page.textContent('#ex-player-forced')) === String(zero.forced) &&
        (await page.textContent('#ex-player-suffered')) === String(zero.suffered) &&
        (await page.textContent('#ex-player-net')) === String(zero.net) &&
        (await page.textContent('#ex-enemy-net')) === String(Sim.exchangeRecord(fresh, 'enemy').net));
    check('scoreboard headline states the even exchange in plain words',
      (await page.textContent('#ex-headline')) === 'The exchange is even: neither side is bleeding faster, and both net exchanges are 0 steel.');
    const exExplain = await page.textContent('#ex-explain');
    check('scoreboard states it is steel only and decides nothing',
      exExplain.indexOf('A drone wing costs ' + CFG.unitTypes.drone.steelCost + ' steel and an interceptor launch costs ' + Sim.interceptorCost() + ' steel') !== -1 &&
        exExplain.indexOf('it decides nothing, pays for nothing, and changes no win condition') !== -1,
      exExplain);
    const gen3Btn = await page.textContent('#btn-research-gen3');
    check('Gen 3 research button states its cost and its prerequisite, disabled before Gen 2',
      gen3Btn === 'Research Drone Gen 3 (' + CFG.droneGen3Cost + ' pts, requires Drone Gen 2 first)' &&
        (await page.evaluate(() => document.getElementById('btn-research-gen3').disabled)) === true,
      gen3Btn);
    const gen3Explain = await page.textContent('#research-gen3-explain');
    check('Gen 3 explain states the Gen 3 stats from CFG and the prerequisite',
      gen3Explain.indexOf('attack ' + CFG.droneGen3.attack + ', defense ' + CFG.droneGen3.defense) !== -1 &&
        gen3Explain.indexOf('It requires Drone Gen 2 first.') !== -1,
      gen3Explain);
    const jamBtn = await page.textContent('#btn-research-jamming');
    check('jamming research button names the next generation and its cost from CFG',
      jamBtn === 'Research Jamming Gen ' + (Sim.jammingGeneration(fresh, 'player') + 1) + ' (' + CFG.jammingCosts[0] + ' pts)',
      jamBtn);
    const jamExplain = await page.textContent('#research-jamming-explain');
    check('jamming explain states jamming does not blunt interceptor launches',
      jamExplain.indexOf('Jamming does not blunt interceptor launches.') !== -1, jamExplain);
    const summary = await page.textContent('#prod-summary');
    check('production summary names the interceptor stock from the readout',
      summary.indexOf('Interceptor stock: ' + Sim.interceptorStock(fresh, 'player') + ' (finished Interceptors join this stockpile)') !== -1,
      summary);
    const rowsText = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#production-lines .prod-line'),
      (r) => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    check('a production row offers a Retool to Interceptor button',
      rowsText.indexOf('Retool to ' + CFG.unitTypes.interceptor.label) !== -1, rowsText.slice(0, 200));
    // Preview and unit card: the front stack at p4_3 holds a drone wing
    // and faces the defended enemy province p5_3 (fixed placements in
    // createGame, the same provinces the node game uses below).
    const myDrones = Sim.unitsIn(fresh, 'p4_3').filter((u) => u.nation === 'player' && u.type === 'drone').length;
    const stockE = Sim.interceptorStock(fresh, 'enemy');
    const launches = Math.min(stockE, myDrones);
    await page.click('[data-prov="p4_3"]');
    let unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('preview states your drone effectiveness with its generation numbers',
      unitText.indexOf('Your drone wings fight at ' + Sim.droneEffectiveness(fresh, 'player', 'enemy') +
        '% effectiveness (your drone generation ' + Sim.droneGeneration(fresh, 'player') +
        ' against their jamming generation ' + Sim.jammingGeneration(fresh, 'enemy') + ')') !== -1,
      unitText.slice(0, 400));
    check('preview states the launches the attack triggers, their cost, and that the drones die to them',
      unitText.indexOf('Attacking with ' + myDrones + ' drone wing triggers ' + launches +
        ' interceptor launch from their stock of ' + stockE + ', costing them ' + (launches * Sim.interceptorCost()) +
        ' steel. The targeted drone wings die to the interceptors before the battle and their attack never counts.') !== -1,
      unitText.slice(0, 500));
    check('preview states their drone effectiveness with its generation numbers',
      unitText.indexOf('Their drone wings fight at ' + Sim.droneEffectiveness(fresh, 'enemy', 'player') +
        '% effectiveness (their drone generation ' + Sim.droneGeneration(fresh, 'enemy') +
        ' against your jamming generation ' + Sim.jammingGeneration(fresh, 'player') + ')') !== -1);
    await page.click('[data-prov="p4_3"]'); // cycle the selection to the drone wing
    unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('drone wing unit card states its nation drone generation and effectiveness',
      unitText.indexOf('Drone generation ' + Sim.droneGeneration(fresh, 'player') +
        ', fighting at ' + Sim.droneEffectiveness(fresh, 'player') + '% effectiveness') !== -1,
      unitText.slice(0, 200));
    await page.close();

    // Run 2: the staged exchange, mirrored in node first.
    const staged = Sim.createGame(7);
    const atk = staged.units.filter((u) => u.nation === 'player' && u.type === 'drone' && u.provinceId === 'p4_3');
    const def = staged.units.filter((u) => u.nation === 'enemy' && u.provinceId === 'p5_3');
    Sim.resolveBattle(staged, atk, def, Sim.makeRng(1));
    const sp = Sim.exchangeRecord(staged, 'player');
    const se = Sim.exchangeRecord(staged, 'enemy');
    if (!(sp.forced === Sim.interceptorCost() && sp.net > 0)) throw new Error('staging assumption broken: ' + JSON.stringify(sp));
    page = await newPage();
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);' +
        'var a=s.units.filter(function(u){return u.nation===\'player\'&&u.type===\'drone\'&&u.provinceId===\'p4_3\';});' +
        'var d=s.units.filter(function(u){return u.nation===\'enemy\'&&u.provinceId===\'p5_3\';});' +
        'S.resolveBattle(s,a,d,S.makeRng(1));return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    check('scoreboard shows the staged player figures from the readouts',
      (await page.textContent('#ex-player-destroyed')) === String(sp.destroyed) &&
        (await page.textContent('#ex-player-lost')) === String(sp.lost) &&
        (await page.textContent('#ex-player-forced')) === String(sp.forced) &&
        (await page.textContent('#ex-player-suffered')) === String(sp.suffered) &&
        (await page.textContent('#ex-player-net')) === String(sp.net),
      JSON.stringify(sp));
    check('scoreboard shows the staged enemy figures from the readouts',
      (await page.textContent('#ex-enemy-destroyed')) === String(se.destroyed) &&
        (await page.textContent('#ex-enemy-lost')) === String(se.lost) &&
        (await page.textContent('#ex-enemy-forced')) === String(se.forced) &&
        (await page.textContent('#ex-enemy-suffered')) === String(se.suffered) &&
        (await page.textContent('#ex-enemy-net')) === String(se.net),
      JSON.stringify(se));
    check('scoreboard headline names the bleeding side and the net amount',
      (await page.textContent('#ex-headline')) === 'The Dominion is bleeding faster: your net exchange is +' + sp.net +
        ' steel, so you have destroyed and forced ' + sp.net + ' steel more than you have lost and been forced to spend.');
    check('enemy card shows the staged stock after the launch',
      (await page.textContent('#stat-enemy-interceptors')) === String(Sim.interceptorStock(staged, 'enemy')),
      'stock ' + Sim.interceptorStock(staged, 'enemy'));
    await page.close();

    // Run 3: the research buttons through the real UI.
    page = await newPage();
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);' +
        's.nations.player.droneGen2=true;s.nations.player.researchPoints=200;return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
    await page.goto(URL);
    await H.dismissTitle(page);
    await page.click('#btn-pause');
    check('Gen 3 button is enabled with Gen 2 fielded and points banked',
      (await page.textContent('#btn-research-gen3')) === 'Research Drone Gen 3 (' + CFG.droneGen3Cost + ' pts)' &&
        (await page.evaluate(() => document.getElementById('btn-research-gen3').disabled)) === false);
    await page.click('#btn-research-gen3');
    check('clicking Gen 3 fields it for its exact cost',
      (await page.textContent('#stat-drone-gen')) === 'Gen 3' &&
        (await page.textContent('#stat-research')) === String(200 - CFG.droneGen3Cost) &&
        (await page.textContent('#btn-research-gen3')) === 'Drone Gen 3 fielded',
      'points ' + (await page.textContent('#stat-research')));
    await page.click('#btn-research-jamming');
    check('clicking jamming fields Gen 1 for its exact cost and offers Gen 2 next',
      (await page.textContent('#stat-jamming-gen')) === 'Gen 1' &&
        (await page.textContent('#stat-research')) === String(200 - CFG.droneGen3Cost - CFG.jammingCosts[0]) &&
        (await page.textContent('#btn-research-jamming')) === 'Research Jamming Gen 2 (' + CFG.jammingCosts[1] + ' pts)' &&
        (await page.evaluate(() => document.getElementById('btn-research-jamming').disabled)) === true,
      'points ' + (await page.textContent('#stat-research')));
    await page.close();

    // Run 4: phone width.
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
