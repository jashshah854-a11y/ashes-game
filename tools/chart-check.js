'use strict';
// Ashes of Empires, Cycle 23 Step 9, chart board browser check.
// Proves: the chart debug readout matches the node chart, the board grew by
// the chart margins, the base canvas draws sea outside the coast and flat
// land inside it, live owner tiles stay transparent, an apron click selects
// its province through the hit polygons, an open sea click changes nothing,
// and the page raises no errors.
// Pattern from tools/map-canvas-check.js.
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
  const expectedCoast = chart.coastline.length;
  const expectedSeed = chart.chartSeed;

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

    // 1. Chart debug readout
    const dbg = await page.evaluate(() => window.AshesChartDebug || null);
    check('browser: AshesChartDebug exists', debugWaited === true && !!dbg, JSON.stringify(dbg));
    check('browser: coastlinePoints equals node chart and is over 400',
      !!dbg && dbg.coastlinePoints === expectedCoast && dbg.coastlinePoints > 400,
      (dbg ? dbg.coastlinePoints : 'none') + ' vs ' + expectedCoast);
    check('browser: chart seed equals node chartSeed', !!dbg && dbg.seed === expectedSeed,
      (dbg ? dbg.seed : 'none') + ' vs ' + expectedSeed);
    check('browser: every province has a hit polygon', !!dbg && dbg.hitProvinces === geom.provinces.length,
      (dbg ? dbg.hitProvinces : 'none') + ' vs ' + geom.provinces.length);

    // 2. Board grown by the chart margins
    const sizes = await page.evaluate(() => {
      const b = document.getElementById('map-board');
      const m = document.getElementById('map');
      return { bw: b.clientWidth, bh: b.clientHeight, mw: m.clientWidth, mh: m.clientHeight, pad: b.style.padding };
    });
    check('browser: board wider than the tile grid by over 100 px', sizes.bw > sizes.mw + 100,
      'board=' + sizes.bw + ' grid=' + sizes.mw + ' padding=' + sizes.pad);
    check('browser: board taller than the tile grid by over 50 px', sizes.bh > sizes.mh + 50,
      'board=' + sizes.bh + ' grid=' + sizes.mh);

    // 3. Base canvas pixels in chart space
    async function sampleBase(cx, cy) {
      return page.evaluate(([cx, cy]) => {
        const c = document.getElementById('map-base');
        const x = Math.min(c.width - 1, Math.floor(((cx + 1.3) / 12.6) * c.width));
        const y = Math.min(c.height - 1, Math.floor(((cy + 1.3) / 9.85) * c.height));
        const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
        return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
      }, [cx, cy]);
    }
    const sea = await sampleBase(-0.7, 3.5);
    check('browser: base canvas sea pixel at cell -0.7,3.5 is sea coloured',
      sea.a === 255 && sea.b > sea.r && sea.g > sea.r,
      'rgba=' + sea.r + ',' + sea.g + ',' + sea.b + ',' + sea.a + ' at ' + sea.x + ',' + sea.y);
    const land = await sampleBase(4.5, 3.5);
    const landLuma = 0.2126 * land.r + 0.7152 * land.g + 0.0722 * land.b;
    check('browser: base canvas land pixel at cell 4.5,3.5 is relief inside the Terrain band (luma 60 to 150)',
      land.a === 255 && landLuma >= 60 && landLuma <= 150,
      'rgba=' + land.r + ',' + land.g + ',' + land.b + ',' + land.a + ' luma=' + landLuma.toFixed(1) + ' at ' + land.x + ',' + land.y);

    // 4. Live owner tiles stay transparent
    const tileBg = await page.evaluate(() => {
      const pt = document.querySelector('.province.owner-player');
      const et = document.querySelector('.province.owner-enemy');
      return {
        player: pt ? window.getComputedStyle(pt).backgroundColor : null,
        enemy: et ? window.getComputedStyle(et).backgroundColor : null
      };
    });
    check('browser: live owner tile backgrounds are transparent',
      tileBg.player === 'rgba(0, 0, 0, 0)' && tileBg.enemy === 'rgba(0, 0, 0, 0)',
      'player=' + tileBg.player + ' enemy=' + tileBg.enemy);

    // Board client position of a cell point, in the renderer's chart space.
    async function boardPoint(cx, cy) {
      return page.evaluate(([cx, cy]) => {
        const r = document.getElementById('map-board').getBoundingClientRect();
        return { x: r.left + ((cx + 1.3) / 12.6) * r.width, y: r.top + ((cy + 1.3) / 9.85) * r.height };
      }, [cx, cy]);
    }
    function selectedProv() {
      return page.evaluate(() => {
        const t = document.querySelector('.province.selected');
        return t ? t.getAttribute('data-prov') : null;
      });
    }

    // 5. Apron click selects p0_0
    const apron = await boardPoint(0.5, -0.25);
    await page.mouse.click(apron.x, apron.y);
    await H.waitFor(page, async () => (await selectedProv()) === 'p0_0', 3000);
    const afterApron = await selectedProv();
    check('browser: apron click at cell 0.5,-0.25 selects p0_0', afterApron === 'p0_0',
      'selected=' + afterApron + ' at ' + apron.x.toFixed(1) + ',' + apron.y.toFixed(1));

    // 6. Sea click keeps the selection
    await page.evaluate(() => {
      const t = document.querySelector('.province[data-prov="p4_3"]');
      if (t) t.click();
    });
    await H.waitFor(page, async () => (await selectedProv()) === 'p4_3', 3000);
    const beforeSea = await selectedProv();
    const seaPt = await boardPoint(5.0, -0.88);
    await page.mouse.click(seaPt.x, seaPt.y);
    const afterSea = await selectedProv();
    check('browser: open sea click at cell 5.0,-0.88 keeps the selection on p4_3',
      beforeSea === 'p4_3' && afterSea === 'p4_3', 'before=' + beforeSea + ' after=' + afterSea);

    // 7. Screenshot
    await page.locator('#map-board').screenshot({ path: '/tmp/chart-check.png' });
    check('browser: board screenshot saved to /tmp/chart-check.png', fs.existsSync('/tmp/chart-check.png'), '');

    // 8. No page errors
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
