'use strict';
// Ashes of Empires, Cycle 23 Step 11, relief browser check.
// Proves: the chart debug readout carries the node chart relief values, the
// base canvas shows shaded relief (not one flat land colour) at land points
// away from rivers, borders, and the coast, and the page raises no errors.
// Pattern from tools/river-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

async function main() {
  // ---------- Node part: compute expectations from seed 42 ----------
  const state = Sim.createGame(42);
  const view = playerView(state);
  const geom = MapGeom.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const relief = chart.relief;

  // Sample points: centres of provinces at x 1..3 and 6..8 on rows 1, 3, 5,
  // skipping any point within 0.3 cell of a river (dR from the node chart).
  function nearest(x, y) {
    const i = Math.max(0, Math.min(relief.width - 1, Math.floor((x - relief.x0) * relief.res)));
    const j = Math.max(0, Math.min(relief.height - 1, Math.floor((y - relief.y0) * relief.res)));
    return j * relief.width + i;
  }
  const points = [];
  [1, 3, 5].forEach((row) => {
    [1, 2, 3, 6, 7, 8].forEach((col) => {
      const p = geom.provinces.find((q) => q.x === col && q.y === row);
      if (!p) return;
      const k = nearest(p.center.x, p.center.y);
      if (relief.dR[k] < 0.3 || !relief.landMask[k]) return;
      points.push({ id: p.id, x: p.center.x, y: p.center.y });
    });
  });

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(HARNESS_URL);
    await H.dismissTitle(page);

    const debugWaited = await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesChartDebug !== 'undefined' &&
          typeof window.AshesMapCanvasDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 10000);
    await H.dismissBurst(page);
    await H.ensurePaused(page);

    // 1. Relief values in the chart debug readout
    const dbg = await page.evaluate(() => window.AshesChartDebug || null);
    check('browser: AshesChartDebug exists', debugWaited === true && !!dbg, JSON.stringify(dbg));
    check('browser: reliefSalt equals node chart', !!dbg && dbg.reliefSalt === relief.salt,
      (dbg ? dbg.reliefSalt : 'none') + ' vs ' + relief.salt);
    check('browser: reliefRes equals node chart', !!dbg && dbg.reliefRes === relief.res,
      (dbg ? dbg.reliefRes : 'none') + ' vs ' + relief.res);
    check('browser: reliefContours equals node chart', !!dbg && dbg.reliefContours === relief.contours.length,
      (dbg ? dbg.reliefContours : 'none') + ' vs ' + relief.contours.length);
    check('browser: reliefHash equals node chart', !!dbg && dbg.reliefHash === relief.hash,
      (dbg ? dbg.reliefHash : 'none') + ' vs ' + relief.hash);

    // 2. Base canvas pixels in chart space
    async function sampleBase(cx, cy) {
      return page.evaluate(([cx, cy]) => {
        const c = document.getElementById('map-base');
        const x = Math.min(c.width - 1, Math.floor(((cx + 1.3) / 12.6) * c.width));
        const y = Math.min(c.height - 1, Math.floor(((cy + 1.3) / 9.85) * c.height));
        const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
        return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
      }, [cx, cy]);
    }
    check('browser: at least 6 relief sample points away from rivers', points.length >= 6, points.length + ' points');
    const colours = new Set();
    for (const pt of points) {
      const px = await sampleBase(pt.x, pt.y);
      const luma = 0.2126 * px.r + 0.7152 * px.g + 0.0722 * px.b;
      colours.add(px.r + ',' + px.g + ',' + px.b);
      check('browser: relief pixel at ' + pt.id + ' centre is opaque with luma 60 to 150',
        px.a === 255 && luma >= 60 && luma <= 150,
        'cell=' + pt.x.toFixed(3) + ',' + pt.y.toFixed(3) + ' rgba=' + px.r + ',' + px.g + ',' + px.b + ',' + px.a +
        ' luma=' + luma.toFixed(1) + ' at ' + px.x + ',' + px.y);
    }
    check('browser: relief samples show at least 3 distinct colours (flat land would show 1)', colours.size >= 3,
      colours.size + ' distinct: ' + Array.from(colours).join(' '));

    // 3. Screenshot
    await page.locator('#map-board').screenshot({ path: '/tmp/relief-check.png' });
    check('browser: board screenshot saved to /tmp/relief-check.png', fs.existsSync('/tmp/relief-check.png'), '');

    // 4. No page errors
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
