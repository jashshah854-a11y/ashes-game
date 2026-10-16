'use strict';
// Real browser check for the production line efficiency UI (Cycle 9
// step 2), in headless Chromium through Playwright, against the repo's
// index.html on seed 7, in the fort-check pattern. Every expected
// number is computed in this file from the sim's own readouts
// (Sim.lineBuildDays and Sim.lineDaysLeft) and CFG, never copied from
// the panel.
// Run 1, the unmodified game, paused before the first tick: both lines
// sit at the floor, so the panel must say so in first time player
// words, quote the live build days equal to the base days, name the
// days to full efficiency, and show no retool loss note (nothing can
// be lost yet).
// Run 2, checker edit stated plainly: the served js/sim.js wraps
// createGame and stages the player's lines after creation. Line 1 is
// set to the exact state two funded days produce when a line starts
// them at 126 percent (work 126 + 128 = 254, efficiency now 130), with
// one unit in progress; line 2 is set to the 150 percent cap, idle.
// The panel must quote the ramped live days against the base days,
// the funded days left from Sim.lineDaysLeft, the days to the cap,
// the full efficiency wording on the capped line, and, before any
// retool click is made, the extended retool warning: the steel
// already spent beside the efficiency points that would be lost on
// line 1, and the efficiency only loss on the idle capped line 2.
// Run 3: no horizontal scroll at a 390 px phone width.
// Usage: node tools/efficiency-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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

function daysToCap(eff) {
  return eff >= CFG.lineEfficiencyCap ? 0 : Math.ceil((CFG.lineEfficiencyCap - eff) / CFG.lineEfficiencyRisePerDay);
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
    // Run 1: the unmodified game at the floor.
    let page = await newPage();
    await page.goto(URL);
    await page.click('#btn-pause');
    let rows = await prodRows(page);
    const floorDaysInf = Sim.lineBuildDays({ template: 'infantry', efficiency: CFG.lineEfficiencyFloor });
    const floorDaysDrone = Sim.lineBuildDays({ template: 'drone', efficiency: CFG.lineEfficiencyFloor });
    const capDays = daysToCap(CFG.lineEfficiencyFloor);
    check('line 1 at the floor says so, with the gain per day and the days to full efficiency',
      rows[0].indexOf('Efficiency ' + CFG.lineEfficiencyFloor + '%, the starting level: this line has not practiced yet.') !== -1 &&
        rows[0].indexOf('gains +' + CFG.lineEfficiencyRisePerDay + '% per funded working day') !== -1 &&
        rows[0].indexOf('full efficiency (' + CFG.lineEfficiencyCap + '%) after ' + capDays + ' funded working days') !== -1,
      rows[0]);
    check('line 1 cost row quotes the readout days at the floor against the base days',
      rows[0].indexOf(CFG.unitTypes.infantry.steelCost + ' steel over ' + floorDaysInf + ' days at current efficiency (base ' + CFG.unitTypes.infantry.buildDays + ' days)') !== -1,
      rows[0]);
    check('line 2 at the floor says so in the same words',
      rows[1].indexOf('Efficiency ' + CFG.lineEfficiencyFloor + '%, the starting level: this line has not practiced yet.') !== -1 &&
        rows[1].indexOf('full efficiency (' + CFG.lineEfficiencyCap + '%) after ' + capDays + ' funded working days') !== -1,
      rows[1]);
    check('line 2 cost row quotes the readout days at the floor against the base days',
      rows[1].indexOf(CFG.unitTypes.drone.steelCost + ' steel over ' + floorDaysDrone + ' days at current efficiency (base ' + CFG.unitTypes.drone.buildDays + ' days)') !== -1,
      rows[1]);
    check('no retool loss note at the floor, where nothing can be lost',
      rows[0].indexOf('Retooling') === -1 && rows[1].indexOf('Retooling') === -1,
      rows[0] + ' // ' + rows[1]);
    await page.close();

    // Run 2: staged ramp, one line mid ramp with a unit in progress,
    // one line capped and idle. No button in the panel is clicked in
    // this run, so the retool warnings asserted here are the warnings
    // shown before any click, as prescribed.
    page = await newPage();
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);' +
        'var L=s.nations.player.productionLines;' +
        'L[0].efficiency=130;L[0].queue=1;L[0].progressDays=2;L[0].work=254;' +
        'L[1].efficiency=150;return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
    await page.goto(URL);
    await page.click('#btn-pause');
    rows = await prodRows(page);
    const midLine = { template: 'infantry', efficiency: 130, queue: 1, progressDays: 2, work: 254 };
    const midDays = Sim.lineBuildDays(midLine);
    const midLeft = Sim.lineDaysLeft(midLine);
    const midToCap = daysToCap(130);
    const steelSpent = 2 * Sim.lineSteelPerDay('infantry');
    check('mid ramp line shows its percent, rising, with the days to full efficiency',
      rows[0].indexOf('Efficiency 130% and rising:') !== -1 &&
        rows[0].indexOf(midToCap + ' funded working days to full efficiency (' + CFG.lineEfficiencyCap + '%)') !== -1,
      rows[0]);
    check('mid ramp cost row quotes the readout days against the base days',
      rows[0].indexOf(CFG.unitTypes.infantry.steelCost + ' steel over ' + midDays + ' days at current efficiency (base ' + CFG.unitTypes.infantry.buildDays + ' days)') !== -1,
      rows[0]);
    check('mid ramp progress row counts funded days paid and the readout days left',
      rows[0].indexOf('2 funded days paid, ' + midLeft + ' days left at the current efficiency') !== -1,
      rows[0]);
    check('retool warning before any click states the steel spent and the efficiency lost, beside each other',
      rows[0].indexOf('Retooling scraps the unit in progress and loses the ' + steelSpent + ' steel already spent on it.') !== -1 &&
        rows[0].indexOf('It also drops efficiency from 130% back to ' + CFG.lineEfficiencyFloor + '%, losing 30 points of efficiency.') !== -1,
      rows[0]);
    const capLineDays = Sim.lineBuildDays({ template: 'drone', efficiency: CFG.lineEfficiencyCap });
    check('capped line says it is at full efficiency, with the live days against the base days',
      rows[1].indexOf('Efficiency ' + CFG.lineEfficiencyCap + '%: full efficiency.') !== -1 &&
        rows[1].indexOf('A fresh unit takes ' + capLineDays + ' days here instead of the base ' + CFG.unitTypes.drone.buildDays + ' days.') !== -1,
      rows[1]);
    check('capped line cost row quotes the readout days against the base days',
      rows[1].indexOf(CFG.unitTypes.drone.steelCost + ' steel over ' + capLineDays + ' days at current efficiency (base ' + CFG.unitTypes.drone.buildDays + ' days)') !== -1,
      rows[1]);
    check('idle capped line retool warning states the efficiency loss and that no steel is lost',
      rows[1].indexOf('Retooling drops efficiency from ' + CFG.lineEfficiencyCap + '% back to ' + CFG.lineEfficiencyFloor + '%, losing ' + (CFG.lineEfficiencyCap - CFG.lineEfficiencyFloor) + ' points of efficiency. No unit is in progress, so no steel is lost.') !== -1,
      rows[1]);
    // The unit card quotes base days only under the base speed name.
    await page.click('[data-prov="p0_3"]');
    const unitText = await page.textContent('#unit-details');
    check('unit card names its build days as base speed and points at the live panel days',
      /steel over \d+ days at base speed on a production line/.test(unitText) &&
        unitText.indexOf("the Production panel shows each line's live days") !== -1,
      unitText.replace(/\s+/g, ' ').trim().slice(0, 200));
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
