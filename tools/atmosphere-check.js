'use strict';
// Ashes of Empires, Cycle 23 Step 17a, corner vignette browser check (K-ATM).
// Proves: the page's AshesMapCanvas carries the vignette constants and builds
// a raster byte identical to the node build (the page rebuilds the seed 42
// chart from its own AshesSim, AshesView, AshesMapGeometry, and AshesChart
// globals); the #map-base border strip paper is darkened in the top-left and
// bottom-right corner windows by at least 3 levels and stays paper; a
// top-center border strip window stays essentially undarkened; and a live
// province cell center on #map-base stays in the Terrain band 60 to 150.
// Window shape, adjusted once from the briefed 80 by 20 device px after
// observing the live canvas (892 by 755 at DPR 1, about 71 px per cell):
// 20 rows reached the degree bar (y -1.06), whose paper segments are
// furniture drawn above the vignette at full FRAME_PAPER luma 216.45; the
// bottom-right corner also holds the north arrow (corner column x 11.06 to
// 11.3, its paper half at full luma); and an 80 px wide window's inner
// edge is already about 214.4, past the falloff the cap allows. So corner
// windows are 24 by 12 device px: top-left at the canvas corner, and
// bottom-right shifted 22 px left of the corner to clear the arrow column.
// Both read pure frame paper under the vignette. The top-center control
// window uses 12 rows too, so it reads frame paper, not the degree bar.
// Pattern from tools/fog-check.js; cell mapping from tools/chart-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// getImageData is used here in the CHECK only, never in the frame path.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const AshesMapCanvas = require('../js/map-canvas.js');
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

// FNV-1a over raster bytes, as a hex string.
function bytesHash(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Max luma pixel in a device px window of #map-base.
async function windowMaxLuma(page, x, y, w, h) {
  return page.evaluate(([x, y, w, h]) => {
    const c = document.getElementById('map-base');
    const x0 = x < 0 ? c.width + x : x;
    const y0 = y < 0 ? c.height + y : y;
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let best = -1;
    let at = null;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (l > best) { best = l; at = [x0 + (i / 4) % w, y0 + Math.floor(i / 4 / w), d[i], d[i + 1], d[i + 2]]; }
    }
    return { luma: best, at: at, cw: c.width, ch: c.height };
  }, [x, y, w, h]);
}

async function main() {
  // ---------- Node part: expectations from the real modules ----------
  const view = playerView(Sim.createGame(42));
  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(view));
  const raster = AshesMapCanvas.buildVignetteRaster(chart);
  const nodeHash = bytesHash(raster.rgba);
  check('node: vignette raster built', raster.width > 0 && raster.height > 0 && raster.maxAlpha > 0.04,
    raster.width + 'x' + raster.height + ' maxAlpha=' + raster.maxAlpha.toFixed(4) + ' hash=' + nodeHash);
  const live = view.provinces.find((p) => p.intel === 'live');
  check('node: seed 42 has a live province', !!live, live ? live.id : 'none');

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
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => {
          const c = document.getElementById('map-base');
          return !!c && c.width > 0 && c.height > 0;
        });
      } catch (e) {
        return false;
      }
    }, 15000);

    // Constants and page side rebuild from the page's own globals.
    const pageSide = await page.evaluate(() => {
      const M = window.AshesMapCanvas;
      const out = {
        maxAlpha: M.VIGNETTE_MAX_ALPHA, range: M.VIGNETTE_RANGE, res: M.VIGNETTE_RES,
        hasBuild: typeof M.buildVignetteRaster === 'function', hasDraw: typeof M.drawVignette === 'function',
        globals: !!(window.AshesSim && window.AshesView && window.AshesMapGeometry && window.AshesChart)
      };
      if (out.globals && out.hasBuild) {
        const v = window.AshesView(window.AshesSim.createGame(42));
        const r = M.buildVignetteRaster(window.AshesChart.buildChart(window.AshesMapGeometry.buildGeometry(v)));
        let h = 0x811c9dc5;
        for (let i = 0; i < r.rgba.length; i++) { h ^= r.rgba[i]; h = Math.imul(h, 0x01000193) >>> 0; }
        out.width = r.width; out.height = r.height; out.hash = h.toString(16).padStart(8, '0');
      }
      return out;
    });
    check('browser: page vignette constants equal the node module',
      pageSide.maxAlpha === AshesMapCanvas.VIGNETTE_MAX_ALPHA && pageSide.range === AshesMapCanvas.VIGNETTE_RANGE &&
        pageSide.res === AshesMapCanvas.VIGNETTE_RES && pageSide.hasBuild && pageSide.hasDraw,
      'maxAlpha=' + pageSide.maxAlpha + ' range=' + pageSide.range + ' res=' + pageSide.res);
    check('browser: page rebuilt raster is byte identical to node (hash)',
      pageSide.globals && pageSide.hash === nodeHash && pageSide.width === raster.width && pageSide.height === raster.height,
      'page=' + pageSide.hash + ' node=' + nodeHash + ' globals=' + pageSide.globals);

    // Corner darkening on the real #map-base canvas.
    const tl = await windowMaxLuma(page, 0, 0, 24, 12);
    check('browser: top-left 24x12 corner max luma pixel is darkened paper (195 to 213.5)',
      tl.luma >= 195 && tl.luma <= 213.5,
      'luma=' + tl.luma.toFixed(2) + ' at ' + JSON.stringify(tl.at) + ' canvas=' + tl.cw + 'x' + tl.ch);
    const br = await windowMaxLuma(page, -46, -12, 24, 12);
    check('browser: bottom-right 24x12 corner (22 px left of the arrow column) max luma pixel is darkened paper (195 to 213.5)',
      br.luma >= 195 && br.luma <= 213.5,
      'luma=' + br.luma.toFixed(2) + ' at ' + JSON.stringify(br.at));

    // Control: top-center of the border strip, far from both vertical edges.
    const tcX = Math.floor(tl.cw / 2) - 40;
    const tc = await windowMaxLuma(page, tcX, 0, 80, 12);
    check('browser: top-center border strip max luma pixel is essentially undarkened (at least 214)',
      tc.luma >= 214, 'luma=' + tc.luma.toFixed(2) + ' at ' + JSON.stringify(tc.at));

    // Province safety: live province cell center stays in the Terrain band.
    const prov = await page.evaluate(([cx, cy]) => {
      const c = document.getElementById('map-base');
      const x = Math.min(c.width - 1, Math.floor(((cx + 0.5 + 1.3) / 12.6) * c.width));
      const y = Math.min(c.height - 1, Math.floor(((cy + 0.5 + 1.3) / 9.85) * c.height));
      const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
      return { x: x, y: y, r: d[0], g: d[1], b: d[2], a: d[3] };
    }, [live.x, live.y]);
    const provLuma = 0.2126 * prov.r + 0.7152 * prov.g + 0.0722 * prov.b;
    check('browser: live province ' + live.id + ' cell center on #map-base is in the Terrain band 60 to 150',
      prov.a === 255 && provLuma >= 60 && provLuma <= 150,
      'rgba=' + prov.r + ',' + prov.g + ',' + prov.b + ',' + prov.a + ' luma=' + provLuma.toFixed(1) + ' at ' + prov.x + ',' + prov.y);

    await page.screenshot({ path: '/tmp/atmosphere-check.png', fullPage: true });
    check('browser: screenshot saved to /tmp/atmosphere-check.png', true, '');

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
