'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 12b, province names and tile
// restyle browser check (MAP_TREATMENT 5.4 and 5.5).
// Proves, on seed 42 paused at the start: the IM Fell English SC face is
// loaded; #map-labels holds exactly one .map-label per province whose texts,
// in data-prov order, equal the node side Sim.createGame(42) names; no tile
// keeps the retired name line or river bar; a tile has no background or
// border; a badge is a Paper chip with an Ink hairline; label size, capital
// size, nowrap, one line, and fog opacity follow 5.5; the name layer never
// takes a click; every name sits inside the board.
// Pattern from tools/borders-check.js. Uses playwright-core from PLAYWRIGHT
// env var (or ~/workspace/pwcore) and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Screenshot: /tmp/labels-check.png.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright', path.join(os.homedir(), 'workspace/pwcore/node_modules/playwright-core')]
    .find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const SHOT = '/tmp/labels-check.png';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

// rgba(230, 216, 181, 0.92) as the browser may serialise it.
function isPaper(c) {
  const m = /^rgba\(\s*230,\s*216,\s*181,\s*([0-9.]+)\s*\)$/.exec(c || '');
  return !!m && Math.abs(parseFloat(m[1]) - 0.92) < 0.005;
}

async function main() {
  const fresh = Sim.createGame(42);
  const expectedNames = [];
  for (let y = 0; y < fresh.mapH; y++) {
    for (let x = 0; x < fresh.mapW; x++) expectedNames.push(fresh.provinces[Sim.provinceId(x, y)].name);
  }
  const ids = Object.keys(fresh.provinces);
  const darkId = ids.find((id) => Sim.intelState(fresh, 'player', id) === 'dark');
  const liveId = ids.find((id) => Sim.intelState(fresh, 'player', id) === 'live' && !fresh.provinces[id].isCapital);
  const capitalId = ids.find((id) => fresh.provinces[id].isCapital);

  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(HARNESS_URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const fontOk = await page.evaluate(async () => {
      await document.fonts.ready;
      await document.fonts.load('12px "IM Fell English SC"');
      return document.fonts.status === 'loaded' && document.fonts.check('12px "IM Fell English SC"') &&
        Array.from(document.fonts).some((f) => f.family.replace(/"/g, '') === 'IM Fell English SC' && f.status === 'loaded');
    });
    check('document.fonts is ready and the IM Fell English SC face is loaded', fontOk === true, String(fontOk));
    // The refit on font load is asynchronous; wait until a label reports the face.
    await H.waitFor(page, async () => page.evaluate(() => document.querySelectorAll('#map-labels .map-label').length > 0), 5000);

    const labels = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#map-labels .map-label'), (n) => ({ prov: n.getAttribute('data-prov'), text: n.textContent })));
    check('exactly 70 .map-label spans', labels.length === 70 && expectedNames.length === 70, labels.length + ' vs ' + expectedNames.length);
    const texts = labels.map((l) => l.text);
    const order = labels.map((l) => l.prov);
    const nodeOrder = [];
    for (let y = 0; y < fresh.mapH; y++) for (let x = 0; x < fresh.mapW; x++) nodeOrder.push(Sim.provinceId(x, y));
    check('label texts in data-prov order equal the node Sim.createGame(42) province names',
      JSON.stringify(texts) === JSON.stringify(expectedNames) && JSON.stringify(order) === JSON.stringify(nodeOrder),
      texts.slice(0, 4).join(', '));

    const retired = await page.evaluate(() => ({
      pname: document.querySelectorAll('#map .pname').length,
      river: document.querySelectorAll('#map .river-bar').length
    }));
    check('no .pname element in any tile', retired.pname === 0, String(retired.pname));
    check('no .river-bar element in any tile', retired.river === 0, String(retired.river));

    const tileStyle = await page.evaluate((id) => {
      const t = document.querySelector('#map .province[data-prov="' + id + '"]');
      const cs = getComputedStyle(t);
      return { bg: cs.backgroundColor, border: cs.borderTopStyle };
    }, liveId);
    check('a live tile has a transparent background', tileStyle.bg === 'rgba(0, 0, 0, 0)', tileStyle.bg);
    check('a live tile has no border', tileStyle.border === 'none', tileStyle.border);

    const chip = await page.evaluate(() => {
      const b = document.querySelector('#map .coast-badge') || document.querySelector('#map .factory-badge');
      if (!b) return null;
      const cs = getComputedStyle(b);
      return { cls: b.className, bg: cs.backgroundColor, border: cs.borderTopColor };
    });
    check('the first coast or factory badge has the Paper chip background', !!chip && isPaper(chip.bg), chip ? chip.cls + ' ' + chip.bg : 'none');
    check('the first coast or factory badge has the Ink hairline', !!chip && chip.border === 'rgb(43, 38, 32)', chip ? chip.border : 'none');

    const ls = await page.evaluate((a) => {
      const pick = (id) => {
        const n = document.querySelector('#map-labels .map-label[data-prov="' + id + '"]');
        const cs = getComputedStyle(n);
        return { family: cs.fontFamily, size: cs.fontSize, opacity: cs.opacity };
      };
      const all = Array.prototype.map.call(document.querySelectorAll('#map-labels .map-label'), (n) => {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return { prov: n.getAttribute('data-prov'), ws: cs.whiteSpace, h: n.offsetHeight, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      });
      const layer = document.getElementById('map-labels');
      const board = document.getElementById('map-board').getBoundingClientRect();
      const first = all[0];
      const hit = document.elementFromPoint(first.cx, first.cy);
      return {
        normal: pick(a.liveId), capital: pick(a.capitalId), dark: pick(a.darkId), all: all,
        pointer: getComputedStyle(layer).pointerEvents,
        hitIsLabel: !!hit && hit.classList.contains('map-label'),
        hitTag: hit ? hit.tagName + '.' + hit.className : 'none',
        board: { l: board.left, t: board.top, r: board.right, b: board.bottom }
      };
    }, { liveId, capitalId, darkId });
    check('a normal label is set in IM Fell English SC', ls.normal.family.indexOf('IM Fell English SC') !== -1, ls.normal.family);
    check('a normal label is 12px', ls.normal.size === '12px', ls.normal.size);
    check('a capital label is 14px', !!capitalId && ls.capital.size === '14px', capitalId + ' ' + ls.capital.size);
    const wrapped = ls.all.filter((l) => l.ws !== 'nowrap');
    check('every label has white-space nowrap', wrapped.length === 0, wrapped.map((l) => l.prov).join(',') || 'none');
    const tall = ls.all.filter((l) => !(l.h > 0 && l.h <= 22));
    check('every label is a single line (offsetHeight at most 22)', tall.length === 0,
      tall.map((l) => l.prov + ':' + l.h).join(',') || 'max ' + Math.max.apply(null, ls.all.map((l) => l.h)));
    check('a dark (Unknown) province label has opacity 0.75', !!darkId && ls.dark.opacity === '0.75', darkId + ' ' + ls.dark.opacity);
    check('a live province label has opacity 1', ls.normal.opacity === '1', liveId + ' ' + ls.normal.opacity);
    check('#map-labels pointer-events is none', ls.pointer === 'none', ls.pointer);
    check('elementFromPoint at a label centre is not the label', ls.hitIsLabel === false, ls.hitTag);
    const outside = ls.all.filter((l) => !(l.cx >= ls.board.l && l.cx <= ls.board.r && l.cy >= ls.board.t && l.cy <= ls.board.b));
    check('every label centre lies inside the map board', outside.length === 0, outside.map((l) => l.prov).join(',') || 'none');

    await page.screenshot({ path: SHOT, fullPage: false });
    check('screenshot saved to ' + SHOT, fs.existsSync(SHOT) && fs.statSync(SHOT).size > 0, SHOT);

    check('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');
    await page.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
