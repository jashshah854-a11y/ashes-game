'use strict';
// Ashes of Empires, Cycle 23 Step 6b, map canvas browser check.
// Proves: #map-base canvas exists, debug counts match node geometry,
// pixel cap and dpr, hash stability, zoom behavior, province selection,
// no page errors.
// Pattern from tools/plaque-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
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

  const expectedProvinces = geom.provinces.length;
  const expectedRivers = geom.riverSegments.length;
  const expectedRails = geom.railSegments.length;
  const expectedCoasts = geom.coastSegments.length;

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
        return await page.evaluate(() => typeof window.AshesMapCanvasDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 10000);

    // 1. #map-base canvas exists in the DOM
    const canvasExists = await page.evaluate(() => {
      const c = document.getElementById('map-base');
      return !!c && c.tagName === 'CANVAS';
    });
    check('browser: #map-base canvas exists', canvasExists === true, String(canvasExists));

    // 2. window.AshesMapCanvasDebug exists
    const debugExists = await page.evaluate(() => typeof window.AshesMapCanvasDebug !== 'undefined');
    check('browser: AshesMapCanvasDebug exists', debugWaited === true && debugExists === true, String(debugExists));

    let dbg = await page.evaluate(() => window.AshesMapCanvasDebug);

    // 3. provinces
    check('browser: debug.counts.provinces', dbg.counts.provinces === expectedProvinces, dbg.counts.provinces + ' vs ' + expectedProvinces);
    // 4. rivers
    check('browser: debug.counts.rivers', dbg.counts.rivers === expectedRivers, dbg.counts.rivers + ' vs ' + expectedRivers);
    // 5. rails
    check('browser: debug.counts.rails', dbg.counts.rails === expectedRails, dbg.counts.rails + ' vs ' + expectedRails);
    // 6. coasts
    check('browser: debug.counts.coasts', dbg.counts.coasts === expectedCoasts, dbg.counts.coasts + ' vs ' + expectedCoasts);

    // 7. canvas backing pixels
    const pixelCount = await page.evaluate(() => {
      const c = document.getElementById('map-base');
      return c.width * c.height;
    });
    check('browser: canvas backing pixels <= 16700000', pixelCount <= 16700000, pixelCount + ' vs 16700000');

    // 8. dpr
    const pageDpr = await page.evaluate(() => Math.min(window.devicePixelRatio || 1, 2));
    check('browser: debug.dpr equals capped dpr', dbg.dpr === pageDpr, dbg.dpr + ' vs ' + pageDpr);

    // 9. baseHash regex
    check('browser: debug.baseHash format', /^[0-9a-f]{8}$/.test(dbg.baseHash), String(dbg.baseHash));

    // 10. hash stability
    const recHash = dbg.baseHash;
    const recRender = dbg.renderCount;
    const recSettle = dbg.settleCount;
    await page.click('#btn-zoom-reset');
    await H.waitFor(page, async () => {
      try {
        const d = await page.evaluate(() => window.AshesMapCanvasDebug);
        return d.settleCount > recSettle;
      } catch (e) {
        return false;
      }
    }, 10000);
    dbg = await page.evaluate(() => window.AshesMapCanvasDebug);
    check('browser: hash stability', dbg.baseHash === recHash && dbg.renderCount > recRender, dbg.baseHash + ' / ' + dbg.renderCount + ' vs ' + recRender);

    // 11. Zoom
    const zoomRenderBefore = dbg.renderCount;
    const zoomSettleBefore = dbg.settleCount;
    await page.click('#btn-zoom-in');
    await H.waitFor(page, async () => {
      try {
        const d = await page.evaluate(() => window.AshesMapCanvasDebug);
        return d.settleCount > zoomSettleBefore;
      } catch (e) {
        return false;
      }
    }, 10000);
    dbg = await page.evaluate(() => window.AshesMapCanvasDebug);
    const transform = await page.evaluate(() => document.getElementById('map-board').style.transform);
    check('browser: zoom in', dbg.zoom === 1.25 && (transform || '').indexOf('1.25') !== -1, 'zoom=' + dbg.zoom + ' transform=' + transform);

    // 12. zoom settle renderCount increased
    await H.waitFor(page, async () => {
      try {
        const d = await page.evaluate(() => window.AshesMapCanvasDebug);
        return d.settleCount > zoomSettleBefore;
      } catch (e) {
        return false;
      }
    }, 10000);
    const dbg2 = await page.evaluate(() => window.AshesMapCanvasDebug);
    check('browser: zoom settle renderCount increased', dbg2.renderCount > zoomRenderBefore, dbg2.renderCount + ' vs ' + zoomRenderBefore);

    // 13. Click first province tile
    await page.click('.province');
    const provSelected = await page.evaluate(() => {
      const t = document.querySelector('.province');
      const name = document.getElementById('prov-name').textContent;
      return (t && t.classList.contains('selected')) || name !== 'No province selected';
    });
    check('browser: province tile selects', provSelected === true, String(provSelected));

    // 14. No page errors
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
