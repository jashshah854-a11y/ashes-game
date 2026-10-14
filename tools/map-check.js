'use strict';
// Real browser check that crowded map tiles stay readable (Cycle 16), in
// headless Chromium through Playwright, on seed 7, at 1400 px and 390 px.
// Every run serves js/sim.js with one addition that changes no rule:
// createGame records the state on window, and a checker edit, stated
// plainly here, crowds two tiles: the capital p0_3 (three units and its
// level 2 factory) gets level 1 walls being raised to 2; the front p4_3
// (two units) gets level 1 walls, air defense, and a river flotilla.
// Further tiles carry standing level 2 walls (p1_3), walls being raised
// (p2_3), and air defense being built (p3_3). For the two crowded tiles at
// both widths, every badge and every unit chip must be visible by hit test
// at its centre; on every tile nothing may overlap the province name; and
// the map key must name every
// badge code, and no factory badge may sit over a province name.
// Usage: node tools/map-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=7';
const EDIT = "s.provinces.p0_3.fortLevel=1;s.provinces.p0_3.fortBuild={toLevel:2,daysLeft:5};" +
  "s.provinces.p4_3.fortLevel=1;s.provinces.p4_3.airDefense=1;s.provinces.p4_3.flotilla=1;" +
  "s.provinces.p1_3.fortLevel=2;s.provinces.p2_3.fortBuild={toLevel:1,daysLeft:3};s.provinces.p3_3.airDefenseBuild={daysLeft:2};";

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

async function crowded(page, id) {
  return page.evaluate((pid) => {
    const tile = document.querySelector('[data-prov="' + pid + '"]');
    tile.scrollIntoView({ block: 'center' });
    const t = tile.getBoundingClientRect();
    const items = Array.prototype.slice.call(tile.querySelectorAll('.fort-badge, .ad-badge, .fleet-badge, .factory-badge, .unit-chip'));
    const bad = items.filter((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const inside = cx > t.left && cx < t.right && cy > t.top && cy < t.bottom;
      const hit = document.elementFromPoint(cx, cy);
      return !inside || !(hit === el || el.contains(hit));
    }).map((el) => el.className + ' "' + el.innerText.trim() + '"');
    return { count: items.length, bad };
  }, id);
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    for (const [w, h] of [[1400, 1000], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/js/sim.js', async (r) => {
        const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
          '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);window.__state=s;' + EDIT + 'return s;};})();\n';
        await r.fulfill({ contentType: 'application/javascript', body: src });
      });
      await page.goto(URL);
      await page.click('#btn-pause');
      for (const id of ['p0_3', 'p4_3']) {
        const c = await crowded(page, id);
        check(w + ' px: every badge and unit chip on ' + id + ' is visible', c.count >= 4 && c.bad.length === 0, c.count + ' items; covered or outside: ' + c.bad.join('; '));
      }
      // Cycle 17: nothing on any tile may overlap its name: every badge type
      // (walls standing and being raised, air defense standing and being
      // built, fleet, factory), rail work tags, the fog tag, and unit chips.
      const overName = await page.evaluate(() => {
        const bad = [];
        Array.prototype.forEach.call(document.querySelectorAll('.province'), (tile) => {
          const n = tile.querySelector('.pname');
          if (!n) return;
          const a = n.getBoundingClientRect();
          tile.querySelectorAll('.fort-badge, .ad-badge, .fleet-badge, .factory-badge, .rail-tag, .fog-tag, .unit-chip').forEach((el) => {
            const b = el.getBoundingClientRect();
            if (b.width && b.height && b.left < a.right - 1 && b.right > a.left + 1 && b.top < a.bottom - 1 && b.bottom > a.top + 1) {
              bad.push(tile.getAttribute('data-prov') + ' ' + el.className.split(' ')[0]);
            }
          });
        });
        return bad;
      });
      check(w + ' px: no badge, tag, or chip overlaps any province name', overName.length === 0, overName.slice(0, 6).join(', '));
      const capBadge = await page.evaluate(() => document.querySelector('[data-prov="p0_3"] .fort-badge').innerText.trim());
      check(w + ' px: standing walls and walls being raised share one badge', (await page.$$eval('[data-prov="p0_3"] .fort-badge', (ns) => ns.length)) === 1 &&
        (w > 700 ? capBadge === 'Fort 1, to 2 in 5d' : capBadge === 'F1>2'), capBadge);
      const key = await page.textContent('#map-key');
      check(w + ' px: the map key names every badge code', ['F1', 'AD', 'Fl', 'Factory', 'dashed'].every((k) => key.indexOf(k) !== -1), key);
      if (w === 390) check('390 px: no horizontal scroll', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
      await page.close();
    }
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
