'use strict';
// Real browser check for the research panel and jamming (Cycle 11), in
// headless Chromium through Playwright, against the repo's index.html on
// seed 7. Every run serves js/sim.js with one addition that changes no
// rule: Sim.tick and Sim.createGame record the state on window, so the
// check can compare what the page shows with the sim.
// Run 1, the unmodified game: every project is listed with its cost and
// its effect in CFG numbers (jamming with the rounded numbers and whether
// it reaches the Dominion's current wings), and each button says why it is
// disabled and in how many days it becomes affordable; the Dominion's
// research order, its next project, and that project's arrival day are on
// its card.
// Run 2, checker edit stated plainly: the player starts with 1000 research
// points. Projects are bought through the real buttons; points, rows, the
// jamming row, and the unit card follow.
// Run 3, checker edit stated plainly: the Dominion starts with Jamming Gen
// 2. The player's Gen 1 drone wing is jammed; the nation card, the unit
// card, and the attack preview must name it, and the preview's power must
// equal stackPower.
// Run 4: no horizontal scroll at a 390 px phone width.
// Usage: node tools/research-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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
const text = (page, sel) => page.textContent(sel);

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
    const rows = await page.$$eval('.research-item', (ns) => ns.map((n) => n.textContent));
    check('every project is listed', rows.length === Object.keys(CFG.research).length, rows.length + ' rows');
    check('costs and effects come from CFG',
      rows.some((r) => r.indexOf(CFG.research.droneGen3.label + ' ' + CFG.research.droneGen3.cost + ' pts') === 0 &&
        r.indexOf('attack ' + CFG.droneGen3.attack + ', defense ' + CFG.droneGen3.defense) !== -1) &&
      rows.some((r) => r.indexOf('Enemy drone wings of Gen 1 and 2 fight at -' + CFG.jammingPct + '% attack and defense, rounded (a Gen 2 wing: attack ' +
        CFG.droneGen2.attack + ' to ' + Sim.jammedValue(CFG.droneGen2.attack) + ', defense ' + CFG.droneGen2.defense + ' to ' + Sim.jammedValue(CFG.droneGen2.defense) + ').') !== -1), rows[3]);
    check('each jamming item says whether it reaches their current wings',
      rows.filter((r) => r.indexOf('Their wings are Gen 1 now: this would jam them.') !== -1).length === 2, rows[2]);
    const pts = await page.evaluate(() => window.__state.nations.player.researchPoints);
    check('the affordable project says how many points you lack',
      (await text(page, '#research-droneGen2')) === 'Research (' + CFG.research.droneGen2.cost + ' pts): need ' + CFG.research.droneGen2.cost + ', you have ' + pts +
        ' (affordable in ' + Math.ceil((CFG.research.droneGen2.cost - pts) / CFG.researchPerDay) + ' days)' &&
      (await page.isDisabled('#research-droneGen2')), await text(page, '#research-droneGen2'));
    check('a locked project names its prerequisite',
      (await text(page, '#research-droneGen3')) === 'Needs Drone Gen 2 first' && (await text(page, '#research-jamming2')) === 'Needs Jamming Gen 1 first');
    check('the Dominion research order is in its doctrine text',
      (await text(page, '#ai-research-order')) === CFG.aiResearchOrder.map((id) => CFG.research[id].label).join(', then '), await text(page, '#ai-research-order'));
    const first = CFG.research[CFG.aiResearchOrder[0]];
    const k = Math.ceil(first.cost / CFG.researchPerDay);
    check('the Dominion next research row names its arrival day',
      (await text(page, '#stat-enemy-research')) === first.label + ' at ' + first.cost + ' points (it has 0, gaining ' + CFG.researchPerDay + ' a day): day ' + (1 + k) + ', in ' + k + ' days',
      await text(page, '#stat-enemy-research'));
    check('no jamming at the start', (await text(page, '#stat-jamming')) === 'none' && (await text(page, '#stat-enemy-jam')) === 'none');
    await page.close();

    // Run 2: buying through the buttons.
    page = await newPage();
    await serveSim(page, 's.nations.player.researchPoints=1000;');
    await page.goto(URL);
    await page.click('#btn-pause');
    await page.click('#research-droneGen2');
    check('points paid', (await page.evaluate(() => window.__state.nations.player.researchPoints)) === 1000 - CFG.research.droneGen2.cost);
    check('the bought row says fielded and the next opens',
      (await text(page, '#research-droneGen2')) === 'Fielded' && !(await page.isDisabled('#research-droneGen3')));
    await page.click('#research-jamming1');
    await page.click('#research-jamming2');
    check('the jamming row names your level and whether it reaches their wings',
      (await text(page, '#stat-jamming')) === 'Gen 2, jamming their Gen 1 wings', await text(page, '#stat-jamming'));
    check('the Dominion drone row says its wings are jammed',
      (await text(page, '#stat-enemy-gen')) === 'Gen 1 (jammed: attack ' + CFG.unitTypes.drone.attack + ' to ' + Sim.jammedValue(CFG.unitTypes.drone.attack) + ', defense ' + CFG.unitTypes.drone.defense + ' to ' + Sim.jammedValue(CFG.unitTypes.drone.defense) + ')', await text(page, '#stat-enemy-gen'));
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="p4_3"]'); // the second click picks the drone wing
    check('the unit card shows Gen 2 stats', /^Drone Wing .*Attack 5, Defense 3 \(Drone Gen 2\)/.test(await text(page, '#unit-details')), (await text(page, '#unit-details')).slice(0, 80));
    await page.close();

    // Run 3: the Dominion jams your Gen 1 wings.
    page = await newPage();
    await serveSim(page, 's.nations.enemy.jamming=2;');
    await page.goto(URL);
    await page.click('#btn-pause');
    check('your drone row says jammed', (await text(page, '#stat-drone-gen')) === 'Gen 1 (jammed: attack ' + CFG.unitTypes.drone.attack + ' to ' + Sim.jammedValue(CFG.unitTypes.drone.attack) + ', defense ' + CFG.unitTypes.drone.defense + ' to ' + Sim.jammedValue(CFG.unitTypes.drone.defense) + ')', await text(page, '#stat-drone-gen'));
    check('the Dominion jamming row', (await text(page, '#stat-enemy-jam')) === 'Gen 2, jamming your Gen 1 wings', await text(page, '#stat-enemy-jam'));
    await page.click('[data-prov="p4_3"]');
    await page.click('[data-prov="p4_3"]');
    const card = await text(page, '#unit-details');
    const sim = await page.evaluate(() => {
      const S = window.AshesSim, s = window.__state;
      const stack = S.unitsIn(s, 'p4_3').filter((u) => u.nation === 'player');
      const d = stack.find((u) => u.type === 'drone');
      return { st: S.unitStats(s, d), power: S.stackPower(s, stack, 'attack', S.provinceId(S.CFG.mapW / 2, 3)) };
    });
    check('the unit card names the jamming inside its numbers',
      card.indexOf('Attack ' + sim.st.attack + ', Defense ' + sim.st.defense + ' (Drone Gen 1) (includes -' + CFG.jammingPct + '% from Dominion Jamming Gen 2)') !== -1, card.slice(0, 120));
    const m = card.match(/your stack power (\d+) \(includes -40% on your jammed drone wings\)/);
    check('the preview names the jamming and its power equals stackPower', !!m && Number(m[1]) === sim.power, (m && m[1]) + ' vs ' + sim.power);
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
