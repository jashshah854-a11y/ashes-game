'use strict';
// Ashes of Empires, Cycle 23 Step 9d, live tick cost profile.
// What this proves: the live state redraw on the real game page meets the
// Step 4 budget of STRATEGY.md section 2.8.4 (state canvas redraw p95 at
// most 6 ms) on a developed state, now that MAP_TREATMENT Step 9 grew the
// board. Opens the real index.html at 1400 by 1000. Inside the page it builds
// a developed state from the page globals (AshesSim.createGame(42), then 60
// AshesSim.tick calls), the view with AshesView, and the geometry with
// AshesMapGeometry.buildGeometry, then times 100 iterations of
// AshesMapCanvas.buildStateOps plus AshesMapCanvas.renderStateCanvas at the
// live #map-state canvas pixel size. renderStateCanvas draws to an offscreen
// canvas, which is what the live renderStateCanvasNow in js/main.js blits
// from, so this is the same work the live redraw pays per changed tick.
// Informational lines only (no gate): one AshesView call, one buildGeometry
// call, and one buildFogOps plus renderFogCanvas at the live #map-fog size,
// each the median of 20.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/tick-profile.js
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html');

const STATE_P95_BUDGET_MS = 6; // STRATEGY.md section 2.8.4, Step 4 budget

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
function note(name, detail) {
  console.log('INFO | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
function round3(x) { return Math.round(x * 1000) / 1000; }

// Runs inside the page by page.evaluate. Builds the developed state from the
// page globals and times every phase with performance.now.
function PROFILE_MEASURE() {
  function stats(durs) {
    var sorted = durs.slice().sort(function (a, b) { return a - b; });
    var n = sorted.length;
    return {
      p95: sorted[Math.min(n - 1, Math.floor(n * 0.95))],
      median: sorted[n >> 1],
      max: sorted[n - 1],
      n: n
    };
  }
  function timeMany(n, fn) {
    var durs = [];
    for (var i = 0; i < n; i++) {
      var t0 = performance.now();
      fn();
      durs.push(performance.now() - t0);
    }
    return stats(durs);
  }

  var state = AshesSim.createGame(42);
  for (var t = 0; t < 60; t++) AshesSim.tick(state);
  var view = AshesView(state);
  var geom = AshesMapGeometry.buildGeometry(view);

  var stateCanvas = document.getElementById('map-state');
  var fogCanvas = document.getElementById('map-fog');
  var sw = stateCanvas.width, sh = stateCanvas.height;
  var fw = fogCanvas.width, fh = fogCanvas.height;

  var stateRedraw = timeMany(100, function () {
    AshesMapCanvas.buildStateOps(geom, view);
    AshesMapCanvas.renderStateCanvas(geom, view, sw, sh);
  });
  var viewTime = timeMany(20, function () { AshesView(state); });
  var geomTime = timeMany(20, function () { AshesMapGeometry.buildGeometry(view); });
  var fogTime = timeMany(20, function () {
    AshesMapCanvas.buildFogOps(geom, view);
    AshesMapCanvas.renderFogCanvas(geom, view, fw, fh);
  });

  return {
    day: state.day,
    tickCount: state.tickCount,
    provinces: view.provinces.length,
    stateOps: AshesMapCanvas.buildStateOps(geom, view).length,
    stateSize: { w: sw, h: sh },
    fogSize: { w: fw, h: fh },
    stateRedraw: stateRedraw,
    view: viewTime,
    geometry: geomTime,
    fog: fogTime
  };
}

async function main() {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForFunction(() => {
      const c = document.getElementById('map-state');
      return c && c.width > 0 && c.height > 0;
    }, null, { timeout: 10000 });

    const m = await page.evaluate(PROFILE_MEASURE);

    note('Developed state', 'seed 42, ' + m.tickCount + ' ticks, day ' + m.day +
      ', ' + m.provinces + ' provinces, ' + m.stateOps + ' state ops');
    note('Live canvas sizes', 'map-state ' + m.stateSize.w + ' by ' + m.stateSize.h +
      ' px, map-fog ' + m.fogSize.w + ' by ' + m.fogSize.h + ' px');
    note('State redraw (buildStateOps plus renderStateCanvas, n ' + m.stateRedraw.n + ')',
      'p95 ' + round3(m.stateRedraw.p95) + ' ms, median ' + round3(m.stateRedraw.median) +
      ' ms, max ' + round3(m.stateRedraw.max) + ' ms');
    note('AshesView (median of ' + m.view.n + ')', round3(m.view.median) + ' ms');
    note('buildGeometry (median of ' + m.geometry.n + ')', round3(m.geometry.median) + ' ms');
    note('buildFogOps plus renderFogCanvas (median of ' + m.fog.n + ')', round3(m.fog.median) + ' ms');

    check('State redraw p95 at most ' + STATE_P95_BUDGET_MS + ' ms (Step 4 budget)',
      m.stateRedraw.p95 <= STATE_P95_BUDGET_MS, 'p95 ' + round3(m.stateRedraw.p95) + ' ms');
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('SUMMARY | ' + (failed ? 'FAIL' : 'PASS') + ' | ' + (results.length - failed) +
    ' of ' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
