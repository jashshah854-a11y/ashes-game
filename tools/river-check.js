'use strict';
// Ashes of Empires, Cycle 23 Step 10, river browser check.
// Proves: the chart debug readout carries the node chart river counts, the
// base canvas draws water at the middle river segment and along the north
// mouth extension, and the page raises no errors.
// Pattern from tools/chart-check.js.
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
  const rivers = chart.rivers;

  // Middle river segment (p4_3 to p5_3): its path midpoint point.
  const middle = geom.riverSegments.find((rs) => rs.a === 'p4_3' && rs.b === 'p5_3') ||
    geom.riverSegments[Math.floor(geom.riverSegments.length / 2)];
  const riverPt = middle.path[1];

  // North mouth (smallest y): midpoint of its extension ray.
  const north = rivers.mouths.slice().sort((a, b) => a.y - b.y)[0];
  const mouthPt = north ? { x: (north.x + north.coastX) / 2, y: (north.y + north.coastY) / 2 } : null;

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

    // 1. River counts in the chart debug readout
    const dbg = await page.evaluate(() => window.AshesChartDebug || null);
    check('browser: AshesChartDebug exists', debugWaited === true && !!dbg, JSON.stringify(dbg));
    check('browser: riverEdges equals node chart', !!dbg && dbg.riverEdges === rivers.edges.length,
      (dbg ? dbg.riverEdges : 'none') + ' vs ' + rivers.edges.length);
    check('browser: riverMouths equals node chart', !!dbg && dbg.riverMouths === rivers.mouths.length,
      (dbg ? dbg.riverMouths : 'none') + ' vs ' + rivers.mouths.length);
    check('browser: riverFans equals node chart', !!dbg && dbg.riverFans === rivers.fans.length,
      (dbg ? dbg.riverFans : 'none') + ' vs ' + rivers.fans.length);

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
    function isWater(px) {
      return px.a === 255 && px.b - px.r >= 10;
    }
    const river = await sampleBase(riverPt.x, riverPt.y);
    check('browser: base canvas pixel at the middle river segment midpoint is water coloured', isWater(river),
      'cell=' + riverPt.x.toFixed(3) + ',' + riverPt.y.toFixed(3) +
      ' rgba=' + river.r + ',' + river.g + ',' + river.b + ',' + river.a + ' at ' + river.x + ',' + river.y);
    if (mouthPt) {
      const mouth = await sampleBase(mouthPt.x, mouthPt.y);
      check('browser: base canvas pixel at the north mouth extension midpoint is water coloured', isWater(mouth),
        'cell=' + mouthPt.x.toFixed(3) + ',' + mouthPt.y.toFixed(3) +
        ' rgba=' + mouth.r + ',' + mouth.g + ',' + mouth.b + ',' + mouth.a + ' at ' + mouth.x + ',' + mouth.y);
    } else {
      check('browser: base canvas pixel at the north mouth extension midpoint is water coloured', false, 'no mouth in node chart');
    }

    // 3. Screenshot
    await page.locator('#map-board').screenshot({ path: '/tmp/river-check.png' });
    check('browser: board screenshot saved to /tmp/river-check.png', fs.existsSync('/tmp/river-check.png'), '');

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
