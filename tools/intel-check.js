'use strict';
// Real browser check for the intel and fog UI (Cycle 13 step 2), in
// headless Chromium through Playwright, against the repo's index.html
// on seed 7, in the manpower-check and drone-ew-check pattern. Every
// expected number and wording that carries a number is computed in
// this file from the sim's own readouts (Sim.intelState,
// Sim.intelLiveCount, Sim.intelSnapshot, Sim.agentStock,
// Sim.stackPower, Sim.plantAgent) and CFG, never copied from a panel.
// Cycle 14 step 2 adjustment, named: the live preview's expected
// stack power is now computed through Sim.stackPower with the
// target named, because the navy UI states the river crossing
// penalty inside the attack numbers for the river edge target
// p5_3; the assertion itself and this check's total (31) are
// unchanged, only its expected number follows the shared readout.
// Cycle 14 step 0 extension: the factory button on the province
// card is gated by the same readout. Two dark provinces whose true
// factory levels differ (computed from the node mirror) must
// render the identical constant factory button text, carrying no
// level derived cost, and a remembered province must render that
// same constant rather than its current or snapshot level cost.
// Run 1, the unmodified game, paused before the first tick: every
// tile's fog state matches the shared readout for all 70 provinces;
// a dark tile (the Dominion capital) shows no owner color, badges,
// rail, or unit chips, while a live enemy tile shows its current
// chips; the legend states the three states and the sight rules; the
// nation card headline shows the live observation count from the
// readout and the agent stock with its priced build path; a
// production row offers a Retool to Agent button and the summary
// names the agent stock; the inspector shows current detail for the
// live province and the plain dark wording, with reveal
// instructions and no military figures, for the capital; the attack
// preview from the front province states the exact shared stack
// powers against the live defended neighbor.
// Run 2, checker edit stated plainly: the served js/sim.js wraps
// createGame, records one intel phase (so every then live province
// holds a day 1 snapshot), and then sets the three sight ranges in
// CFG to 0 for the served game only, so the front enemy province is
// remembered, not live. Its tile must be hatched with only ghost
// chips from its snapshot, its inspector must lead with the last
// seen day and show only snapshot figures, and its preview must
// show the snapshot defenders with their day and no exact numbers.
// Run 3, the same sight range edit with no intel phase recorded, so
// the same province is dark: its preview must show no enemy figures
// and state the plain reason and the reveal instructions.
// Run 4, checker edit stated plainly: the wrapper stages one agent
// in the player's stockpile. Planting it on the Dominion capital
// through the real province card button makes the capital live on
// the map and in its inspector, spends exactly the one stock, and a
// second click surfaces the sim's duplicate refusal in the card
// notice; an own province shows the planting control disabled with
// its reason on the button.
// Run 5: no horizontal scroll at a 390 px phone width.
// Usage: node tools/intel-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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

function groupsText(snap) {
  return snap.units.map((g) => g.count + ' ' + CFG.unitTypes[g.type].label + ' (' + g.totalStrength +
    ' total strength, ' + (g.nation === 'player' ? 'yours' : 'Dominion') + ')').join(', ');
}

// Run fn with the three sight ranges zeroed, restoring them after,
// for the node mirrors of the staged browser runs.
function withZeroSight(fn) {
  const saved = [CFG.ownedSightRange, CFG.unitSightRange, CFG.droneSightRange];
  CFG.ownedSightRange = 0; CFG.unitSightRange = 0; CFG.droneSightRange = 0;
  try { return fn(); } finally {
    CFG.ownedSightRange = saved[0]; CFG.unitSightRange = saved[1]; CFG.droneSightRange = saved[2];
  }
}

const ZERO_SIGHT_SRC =
  'S.CFG.ownedSightRange=0;S.CFG.unitSightRange=0;S.CFG.droneSightRange=0;';

async function tiles(page) {
  return page.evaluate(() => {
    const out = {};
    Array.prototype.forEach.call(document.querySelectorAll('#map .province'), (t) => {
      out[t.getAttribute('data-prov')] = {
        cls: t.className,
        intel: t.getAttribute('data-intel'),
        text: t.textContent.replace(/\s+/g, ' ').trim(),
        chips: Array.prototype.map.call(t.querySelectorAll('.unit-chip'), (c) => ({ cls: c.className, text: c.textContent.replace(/\s+/g, ' ').trim() })),
        badges: t.querySelectorAll('.factory-badge, .fort-badge').length,
        rail: t.querySelectorAll('.rail-bar').length
      };
    });
    return out;
  });
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
    const capId = fresh.nations.enemy.capitalId;
    const capName = fresh.provinces[capId].name;
    const front = 'p5_3';
    const frontName = fresh.provinces[front].name;
    const frontUnits = Sim.unitsIn(fresh, front);
    const myStack = Sim.unitsIn(fresh, 'p4_3').filter((u) => u.nation === 'player');
    const theirDefs = frontUnits.filter((u) => u.nation === 'enemy');
    const livePreview = 'Attack ' + frontName + ': your stack power ' + Sim.stackPower(fresh, myStack, 'attack', { toId: front }) +
      ' vs their defense ' + Sim.stackPower(fresh, theirDefs, 'defense');
    // Cycle 14 step 0 staging: a second dark province whose true
    // factory level differs from the dark capital's, so the two
    // live cost labels computed from CFG would differ.
    const otherDarkId = Object.keys(fresh.provinces).find((id) =>
      id !== capId && Sim.intelState(fresh, 'player', id) === 'dark' &&
      fresh.provinces[id].factoryLevel !== fresh.provinces[capId].factoryLevel);
    if (!otherDarkId) throw new Error('staging assumption broken: no dark province with a factory level differing from the capital');
    const factoryCostLabel = (id) => fresh.provinces[id].factoryLevel >= CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + (CFG.factoryCostPerLevel * (fresh.provinces[id].factoryLevel + 1)) + ' eq)';
    const FACTORY_CONSTANT = 'Build / Upgrade Factory';
    if (factoryCostLabel(capId) === factoryCostLabel(otherDarkId)) {
      throw new Error('staging assumption broken: dark pair cost labels do not differ');
    }

    // Run 1: the unmodified game at the start.
    let page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    let map = await tiles(page);
    const mismatches = Object.keys(fresh.provinces).filter((id) => map[id].intel !== Sim.intelState(fresh, 'player', id));
    check('every tile fog state matches the shared intel readout for all ' + total + ' provinces',
      mismatches.length === 0, mismatches.length ? 'mismatch: ' + mismatches.join(',') : 'live ' + Sim.intelLiveCount(fresh, 'player') + ', dark ' + (total - Sim.intelLiveCount(fresh, 'player')));
    check('dark capital tile carries the fog treatment and no owner color',
      map[capId].cls.indexOf('intel-dark') !== -1 && map[capId].cls.indexOf('owner-fog') !== -1 &&
        map[capId].cls.indexOf('owner-enemy') === -1,
      map[capId].cls);
    check('dark capital tile shows the map only: no badges, rail, or unit chips, name and steel kept',
      map[capId].badges === 0 && map[capId].rail === 0 && map[capId].chips.length === 0 &&
        map[capId].text.indexOf(capName) !== -1 && map[capId].text.indexOf('Steel ' + fresh.provinces[capId].steel) !== -1,
      map[capId].text);
    check('live enemy tile shows its current unit chips and no ghost chips',
      map[front].cls.indexOf('intel-live') !== -1 && map[front].cls.indexOf('owner-enemy') !== -1 &&
        map[front].chips.length === frontUnits.length &&
        map[front].chips.every((c) => c.cls.indexOf('ghost') === -1),
      map[front].text);
    const legend = (await page.textContent('#intel-legend')).replace(/\s+/g, ' ').trim();
    check('legend states the three states, the sight rules, and that fog gates information, never orders',
      legend.indexOf('Live: seen today') !== -1 && legend.indexOf('Remembered: seen before but not today') !== -1 &&
        legend.indexOf('Dark: never seen') !== -1 &&
        legend.indexOf('your provinces and the provinces next to them') !== -1 &&
        legend.indexOf('drone wings, which see one province further (two provinces away)') !== -1 &&
        legend.indexOf('an agent, which watches its own province') !== -1 &&
        legend.indexOf('Fog gates information, never orders') !== -1,
      legend.slice(0, 200));
    check('nation card headline shows provinces under live observation from the readout',
      (await page.textContent('#stat-intel-live')) === Sim.intelLiveCount(fresh, 'player') + ' of ' + total,
      await page.textContent('#stat-intel-live'));
    check('nation card shows the agent stock from the readout',
      (await page.textContent('#stat-agents')) === String(Sim.agentStock(fresh, 'player')),
      await page.textContent('#stat-agents'));
    const agentExplain = await page.textContent('#agent-explain');
    check('agent explain states the priced build path from CFG and that an agent watches its province only',
      agentExplain.indexOf(Sim.CFG.unitTypes.agent.steelCost + ' steel over ' + Sim.CFG.unitTypes.agent.buildDays + ' days') !== -1 &&
        agentExplain.indexOf('plus ' + Sim.manpowerCost('agent') + ' manpower paid when queued') !== -1 &&
        agentExplain.indexOf('An agent reveals its province only, never its neighbors') !== -1,
      agentExplain.slice(0, 200));
    const rowsText = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#production-lines .prod-line'),
      (r) => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    check('a production row offers a Retool to Agent button',
      rowsText.indexOf('Retool to ' + CFG.unitTypes.agent.label) !== -1, rowsText.slice(0, 200));
    const summary = await page.textContent('#prod-summary');
    check('production summary names the agent stock from the readout',
      summary.indexOf('Agent stock: ' + Sim.agentStock(fresh, 'player') + ' (finished Agents join this stockpile)') !== -1,
      summary);
    await page.click('[data-prov="' + front + '"]');
    let details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('inspector for a live enemy province states it is live today and shows the current figures',
      details.indexOf('Intel: live, seen today (day ' + fresh.day + '). What follows is current.') !== -1 &&
        details.indexOf('Owner: Dominion') !== -1 &&
        details.indexOf('Factory level: ' + fresh.provinces[front].factoryLevel + ' of ' + CFG.maxFactoryLevel) !== -1 &&
        details.indexOf('Units here: ' + frontUnits.length) !== -1,
      details.slice(0, 240));
    await page.click('[data-prov="p4_3"]');
    let unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('attack preview against a live target states the exact shared stack powers',
      unitText.indexOf(livePreview) !== -1, unitText.slice(0, 300));
    await page.click('[data-prov="' + capId + '"]');
    details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('inspector for a dark province states plainly that nothing is known beyond the map, with the reveal instructions',
      details.indexOf('Nothing is known beyond the map') !== -1 &&
        details.indexOf('bring one of your units next to it') !== -1 &&
        details.indexOf('bring a drone wing within two provinces of it') !== -1 &&
        details.indexOf('or plant an agent there') !== -1,
      details.slice(0, 240));
    check('inspector for a dark province shows no military figures at all',
      details.indexOf('Factory level:') === -1 && details.indexOf('Units here:') === -1 &&
        details.indexOf('Owner:') === -1 && details.indexOf('Fortification:') === -1,
      details.slice(0, 240));
    const darkFactoryBtnCap = (await page.textContent('#btn-factory')).replace(/\s+/g, ' ').trim();
    await page.click('[data-prov="' + otherDarkId + '"]');
    const darkFactoryBtnOther = (await page.textContent('#btn-factory')).replace(/\s+/g, ' ').trim();
    check('factory button text is identical for two dark provinces whose true factory levels differ, and is the constant with no level cost',
      darkFactoryBtnCap === FACTORY_CONSTANT && darkFactoryBtnOther === FACTORY_CONSTANT &&
        darkFactoryBtnCap !== factoryCostLabel(capId) && darkFactoryBtnOther !== factoryCostLabel(otherDarkId),
      'capital (' + fresh.provinces[capId].factoryLevel + '): "' + darkFactoryBtnCap + '" vs ' + otherDarkId +
        ' (' + fresh.provinces[otherDarkId].factoryLevel + '): "' + darkFactoryBtnOther + '"; live labels would be "' +
        factoryCostLabel(capId) + '" and "' + factoryCostLabel(otherDarkId) + '"');
    await page.close();

    // Run 2: remembered front province, staged as described above.
    const stagedR = Sim.createGame(7);
    Sim.intelPhase(stagedR);
    const snapR = Sim.intelSnapshot(stagedR, 'player', front);
    if (!snapR || !snapR.units.length) throw new Error('staging assumption broken: no snapshot with units for ' + front);
    const stateR = withZeroSight(() => Sim.intelState(stagedR, 'player', front));
    if (stateR !== 'remembered') throw new Error('staging assumption broken: ' + front + ' is ' + stateR + ', not remembered');
    page = await newPage();
    await serveEdited(page, 'S.intelPhase(s);' + ZERO_SIGHT_SRC);
    await page.goto(URL);
    await page.click('#btn-pause');
    map = await tiles(page);
    check('remembered tile is hatched in its snapshot owner color, from the readout state',
      map[front].intel === 'remembered' && map[front].cls.indexOf('intel-remembered') !== -1 &&
        map[front].cls.indexOf('owner-' + snapR.owner) !== -1,
      map[front].cls);
    check('remembered tile shows only ghost chips from its snapshot, each marked with its day',
      map[front].chips.length === snapR.units.length &&
        map[front].chips.every((c) => c.cls.indexOf('ghost') !== -1 && c.text.indexOf('Day ' + snapR.day + ' ghost:') !== -1),
      map[front].text);
    await page.click('[data-prov="' + front + '"]');
    details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('inspector for a remembered province leads with its last seen day and shows only snapshot figures',
      details.indexOf('Last seen on day ' + snapR.day + ': this may have changed since.') === 0 &&
        details.indexOf('Owner when last seen: Dominion') !== -1 &&
        details.indexOf('Factory level when last seen: ' + snapR.factoryLevel) !== -1 &&
        details.indexOf('Units when last seen: ' + groupsText(snapR)) !== -1 &&
        details.indexOf('Units here:') === -1 && details.indexOf('Intel: live') === -1,
      details.slice(0, 300));
    await page.click('[data-prov="p4_3"]');
    unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('preview against a remembered target shows the snapshot defenders with their day and fort level, labelled last seen',
      unitText.indexOf('Attack ' + frontName + ': last seen on day ' + snapR.day + '. Defenders then: ' + groupsText(snapR) +
        '; fort level then: ' + snapR.fortLevel) !== -1 &&
        unitText.indexOf('The true numbers today are not known.') !== -1,
      unitText.slice(0, 300));
    check('preview against a remembered target shows no exact stack powers',
      unitText.indexOf('your stack power') === -1 && unitText.indexOf('vs their defense') === -1,
      unitText.slice(0, 300));
    await page.click('[data-prov="' + front + '"]');
    const rememberedFactoryBtn = (await page.textContent('#btn-factory')).replace(/\s+/g, ' ').trim();
    const rememberedCostLabel = snapR.factoryLevel >= CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + (CFG.factoryCostPerLevel * (snapR.factoryLevel + 1)) + ' eq)';
    check('factory button for a remembered province shows the same constant, not its current or snapshot level cost',
      rememberedFactoryBtn === FACTORY_CONSTANT && rememberedFactoryBtn !== rememberedCostLabel &&
        (await page.evaluate(() => document.getElementById('btn-factory').disabled)) === true,
      '"' + rememberedFactoryBtn + '" vs snapshot cost label "' + rememberedCostLabel + '"');
    await page.close();

    // Run 3: dark front province, staged as described above.
    const stagedD = Sim.createGame(7);
    const stateD = withZeroSight(() => Sim.intelState(stagedD, 'player', front));
    if (stateD !== 'dark') throw new Error('staging assumption broken: ' + front + ' is ' + stateD + ', not dark');
    page = await newPage();
    await serveEdited(page, ZERO_SIGHT_SRC);
    await page.goto(URL);
    await page.click('#btn-pause');
    map = await tiles(page);
    check('staged dark tile matches the readout state', map[front].intel === 'dark', map[front].cls);
    await page.click('[data-prov="p4_3"]');
    unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('preview against a dark target shows no enemy figures and states the plain reason with the reveal instructions',
      unitText.indexOf('Attack ' + frontName + ': nothing is known about its defenders today') !== -1 &&
        unitText.indexOf('no enemy figures are shown for a province you have never seen') !== -1 &&
        unitText.indexOf('The true numbers today are not known.') !== -1 &&
        unitText.indexOf('bring a drone wing within two provinces of it') !== -1 &&
        unitText.indexOf('your stack power') === -1 && unitText.indexOf('vs their defense') === -1,
      unitText.slice(0, 300));
    await page.close();

    // Run 4: planting an agent through the real control.
    const stagedA = Sim.createGame(7);
    stagedA.nations.player.agents = 1;
    const planted = Sim.plantAgent(stagedA, 'player', capId);
    if (!planted.ok) throw new Error('staging assumption broken: node plant failed');
    const dupReason = Sim.plantAgent(stagedA, 'player', capId).reason;
    const liveAfter = Sim.intelLiveCount(Sim.createGame(7), 'player') + 1;
    page = await newPage();
    await serveEdited(page, 's.nations.player.agents=1;');
    await page.goto(URL);
    await page.click('#btn-pause');
    check('staged agent stock shows on the nation card',
      (await page.textContent('#stat-agents')) === '1', await page.textContent('#stat-agents'));
    await page.click('[data-prov="' + capId + '"]');
    check('plant control on a dark enemy capital is enabled and names the province and the stock',
      (await page.evaluate(() => document.getElementById('btn-agent').disabled)) === false &&
        (await page.textContent('#btn-agent')) === 'Plant agent in ' + capName + ' (stock: 1)',
      await page.textContent('#btn-agent'));
    await page.click('#btn-agent');
    check('planting through the real control spends the stock and makes the capital live on the map and the headline',
      (await page.textContent('#stat-agents')) === '0' &&
        (await page.evaluate((id) => document.querySelector('[data-prov="' + id + '"]').getAttribute('data-intel'), capId)) === 'live' &&
        (await page.textContent('#stat-intel-live')) === liveAfter + ' of ' + total,
      'headline ' + (await page.textContent('#stat-intel-live')));
    details = (await page.textContent('#prov-details')).replace(/\s+/g, ' ').trim();
    check('the planted capital inspector now shows live current detail',
      details.indexOf('Intel: live, seen today') !== -1 && details.indexOf('Owner: Dominion') !== -1,
      details.slice(0, 200));
    await page.click('#btn-agent');
    const notice = (await page.textContent('#prov-notice')).replace(/\s+/g, ' ').trim();
    check('a second planting on the same province surfaces the sim duplicate refusal in the card notice and spends nothing',
      notice === dupReason &&
        (await page.evaluate(() => document.getElementById('prov-notice').className)) === 'prod-rejected' &&
        (await page.textContent('#stat-agents')) === '0',
      notice);
    await page.click('[data-prov="' + fresh.nations.player.capitalId + '"]');
    check('plant control on an own province is disabled with its reason on the button',
      (await page.evaluate(() => document.getElementById('btn-agent').disabled)) === true &&
        (await page.textContent('#btn-agent')) === 'Plant agent (your own provinces need none)',
      await page.textContent('#btn-agent'));
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
