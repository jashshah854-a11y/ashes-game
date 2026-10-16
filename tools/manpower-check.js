'use strict';
// Real browser check for the manpower UI (Cycle 11 step 2), in headless
// Chromium through Playwright, against the repo's index.html on seed 7,
// in the fort-check and efficiency-check pattern. Every expected number
// is computed in this file from the sim's own readouts (Sim.manpowerPool,
// Sim.manpowerIntake, Sim.manpowerCost) and CFG, never copied from the
// panel.
// Run 1, the unmodified game, paused before the first tick: the nation
// card shows the pool and the daily intake from the readouts and states
// in plain words that intake is per province held; the production
// summary names the same pool, each live production row states its
// template's manpower cost beside its steel cost and build days, the
// enemy card shows the Dominion's pool and intake by the same readouts,
// and the unit card cost line carries its unit's manpower cost.
// Run 2, checker edit stated plainly: the served js/sim.js wraps
// createGame and stages the player's manpower pool at 100, below the
// infantry cost and above the drone crew cost (both read from the sim).
// Clicking Queue on the infantry line must surface the sim's numbered
// refusal in the panel, queue nothing, and charge nothing; clicking
// Queue on the drone line right after must succeed against the same
// pool, proving the refusal was the manpower gate and not a dead button.
// Run 3: no horizontal scroll at a 390 px phone width.
// Usage: node tools/manpower-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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

async function prodRows(page) {
  return page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#production-lines .prod-line'),
    (r) => r.textContent.replace(/\s+/g, ' ').trim()));
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
    const pool = Sim.manpowerPool(fresh, 'player');
    const intake = Sim.manpowerIntake(fresh, 'player');
    const provs = intake / CFG.manpowerPerProvincePerDay;
    const enemyPool = Sim.manpowerPool(fresh, 'enemy');
    const enemyIntake = Sim.manpowerIntake(fresh, 'enemy');
    const lines = fresh.nations.player.productionLines;

    // Run 1: the unmodified game at the start.
    let page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    check('nation card shows the pool from the readout',
      (await page.textContent('#stat-manpower')) === String(pool),
      'pool ' + pool);
    check('nation card shows the daily intake from the readout',
      (await page.textContent('#stat-manpower-intake')) === String(intake),
      'intake ' + intake);
    const explain = await page.textContent('#manpower-explain');
    check('nation card states in plain words that intake is per province held, with the live counts',
      explain.indexOf('grows by ' + CFG.manpowerPerProvincePerDay + ' per day for each province you hold') !== -1 &&
        explain.indexOf('(you hold ' + provs + ', so ' + intake + ' per day)') !== -1 &&
        explain.indexOf('Taking ground raises the intake, losing ground lowers it.') !== -1,
      explain);
    const summary = await page.textContent('#prod-summary');
    check('production summary names the pool the queue draws from',
      summary.indexOf('Manpower pool: ' + pool + ' (queueing draws from this pool)') !== -1,
      summary);
    let rows = await prodRows(page);
    lines.forEach((line, i) => {
      const t = CFG.unitTypes[line.template];
      check('production row for line ' + line.id + ' states its manpower cost beside the steel cost and build days',
        rows[i].indexOf(t.steelCost + ' steel over ') !== -1 &&
          rows[i].indexOf('plus ' + Sim.manpowerCost(line.template) + ' manpower paid in full when queued') !== -1,
        rows[i]);
    });
    check('enemy card shows the Dominion pool from the readout',
      (await page.textContent('#stat-enemy-manpower')) === String(enemyPool),
      'enemy pool ' + enemyPool);
    check('enemy card shows the Dominion intake from the readout',
      (await page.textContent('#stat-enemy-manpower-intake')) === String(enemyIntake),
      'enemy intake ' + enemyIntake);
    check('no refusal notice before any queue attempt',
      (await page.evaluate(() => document.getElementById('prod-notice').className)) === 'hidden');
    // The unit card: the first player unit on the capital, the same one
    // a click selects in the mirrored node game.
    const capId = fresh.nations.player.capitalId;
    const firstUnit = Sim.unitsIn(fresh, capId).filter((u) => u.nation === 'player')[0];
    await page.click('[data-prov="' + capId + '"]');
    const unitText = (await page.textContent('#unit-details')).replace(/\s+/g, ' ').trim();
    check('unit card cost line carries the manpower cost of its unit, from the readout',
      unitText.indexOf('plus ' + Sim.manpowerCost(firstUnit.type) + ' manpower paid in full from the pool when queued') !== -1,
      unitText.slice(0, 240));
    await page.close();

    // Run 2: staged short pool. Queueing infantry is refused in the
    // open; queueing a drone wing against the same pool succeeds.
    const staged = 100;
    const infCost = Sim.manpowerCost('infantry');
    const droneCost = Sim.manpowerCost('drone');
    if (!(staged < infCost && staged >= droneCost)) throw new Error('staging assumption broken: pool ' + staged + ', infantry ' + infCost + ', drone ' + droneCost);
    page = await newPage();
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);' +
        's.nations.player.manpower=' + staged + ';return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
    await page.goto(URL);
    await page.click('#btn-pause');
    const queueBtns = page.locator('#production-lines .prod-line .prod-btns button:first-child');
    await queueBtns.nth(0).click();
    const notice = (await page.textContent('#prod-notice')).replace(/\s+/g, ' ').trim();
    const expectReason = 'Not enough manpower to queue a ' + CFG.unitTypes.infantry.label + '. It costs ' +
      infCost + ' manpower, you have ' + staged + ', you are ' + (infCost - staged) + ' short.';
    check('a refused queue attempt surfaces the sim numbered reason in the panel',
      notice === expectReason &&
        (await page.evaluate(() => document.getElementById('prod-notice').className)) === 'prod-rejected',
      notice);
    rows = await prodRows(page);
    check('the refused attempt queued nothing and charged nothing',
      rows[0].indexOf('0 in queue') !== -1 &&
        (await page.textContent('#stat-manpower')) === String(staged),
      rows[0]);
    await queueBtns.nth(1).click();
    rows = await prodRows(page);
    check('a drone order against the same pool succeeds, so the refusal was the manpower gate',
      rows[1].indexOf('1 in queue') !== -1 &&
        (await page.textContent('#stat-manpower')) === String(staged - droneCost) &&
        (await page.evaluate(() => document.getElementById('prod-notice').className)) === 'hidden',
      rows[1]);
    await page.close();

    // Run 3: phone width.
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
