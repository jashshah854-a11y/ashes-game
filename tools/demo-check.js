'use strict';
// Real browser check for the demo options (Cycle 17), in headless Chromium
// through Playwright, against the unmodified index.html. The standard game
// must show no options card and keep every CFG default; each address
// option must reach CFG and be named with its measured effect; options
// combine; an unknown value is ignored; the try card links every option.
// Usage: node tools/demo-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const D = Sim.CFG;
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const BASE = 'file://' + path.join(REPO, 'index.html') + '?seed=7';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}
const cfgOf = (page) => page.evaluate(() => {
  const C = window.AshesSim.CFG;
  return { d1: C.unitTypes.drone.attack, d2: C.droneGen2.attack, d3: C.droneGen3.attack, fl: C.aiBuildsFlotilla, cr: C.riverCrossingPct, bl: C.blockadePct };
});
const DEFAULTS = { d1: D.unitTypes.drone.attack, d2: D.droneGen2.attack, d3: D.droneGen3.attack, fl: D.aiBuildsFlotilla, cr: D.riverCrossingPct, bl: D.blockadePct };
const CASES = [
  ['drones=234', { d1: 2, d2: 3, d3: 4 }, /Drone attack 2 \/ 3 \/ 4 by generation \(item 20\)/],
  ['aiflotilla=1', { fl: true }, /The Dominion builds river flotillas \(item 30\)/],
  ['crossing=0', { cr: 0 }, /No river crossing cost \(item 31\)/],
  ['crossing=25', { cr: 25 }, /River crossing 25 percent \(item 31\)/],
  ['crossing=35', { cr: 35 }, /River crossing 35 percent \(item 31\)/],
  ['blockade=0', { bl: 0 }, /No blockade \(item 34\)/],
  ['blockade=100', { bl: 100 }, /Blockade 100 percent \(item 34\)/]
];

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const open = async (q, vp) => {
    const p = await browser.newPage({ viewport: vp || { width: 1400, height: 1000 } });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + q);
    await p.click('#btn-pause');
    return p;
  };
  try {
    let page = await open('');
    check('the standard game shows no options card and keeps every default',
      !(await page.isVisible('#demo-card')) && JSON.stringify(await cfgOf(page)) === JSON.stringify(DEFAULTS), JSON.stringify(await cfgOf(page)));
    const links = await page.$$eval('#demo-links a', (as) => as.map((a) => a.getAttribute('href')));
    check('the try card links every option and the standard game', links.length === CASES.length + 1 &&
      CASES.every(([q]) => links.indexOf('?seed=7&' + q) !== -1) && links.indexOf('?seed=7') !== -1, links.join(' '));
    await page.close();
    for (const [q, want, label] of CASES) {
      page = await open('&' + q);
      const cfg = await cfgOf(page);
      const expect = Object.assign({}, DEFAULTS, want);
      const card = (await page.isVisible('#demo-card')) ? await page.textContent('#demo-list') : '';
      check(q + ' reaches CFG and is named with its effect', JSON.stringify(cfg) === JSON.stringify(expect) && label.test(card), JSON.stringify(cfg));
      await page.close();
    }
    page = await open('&drones=234&crossing=25');
    const both = await cfgOf(page);
    check('options combine', both.d1 === 2 && both.cr === 25 && (await page.$$eval('#demo-list li', (ls) => ls.length)) === 2);
    await page.close();
    page = await open('&crossing=99');
    check('an unknown value is ignored', !(await page.isVisible('#demo-card')) && (await cfgOf(page)).cr === DEFAULTS.cr);
    await page.close();
    page = await open('&drones=234', { width: 390, height: 844 });
    check('390 px: no horizontal scroll with an option on', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await page.close();
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
