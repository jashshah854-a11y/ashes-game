'use strict';
// Ashes of Empires, Cycle 23 Step 4, visual Run 2 canvas benchmark.
// What this proves: the throwaway Run 2 canvas benchmark of STRATEGY.md
// section 2.7 renders the worst case fixture board (2.8.1) on six stacked
// canvases - rough province polygons, three stroke front bands, a 256 px
// dummy atlas with 200 sprites, every front firing - and meets the section
// 2.8.4 thresholds: state redraw p95 at most 6 ms, animated frame p95 at
// most 10 ms unthrottled and at most 16.7 ms under a 4x CPU throttle, base
// re-render max at most 120 ms, no single frame or state draw over 50 ms,
// and total canvas memory under 384 MB with each canvas under 16.7 million
// pixels. The SwiftShader software GL run is the pessimistic floor reported
// for the record only; the gated thresholds are the DPR 2 and throttled runs.
//
// PLAYWRIGHT=/tmp/pwcore/node_modules/playwright-core
// CHROME=/opt/meta-chromium/chrome
//
// Usage: node tools/canvas-benchmark.js
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');

const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'tools', 'benchmark.html');

const CANVAS_IDS = ['bench-base', 'bench-fog', 'bench-ambient', 'bench-state', 'bench-unit', 'bench-action'];

const PRIMARY = { dpr: 2, spriteCount: 200, effectDensity: 1, baseScale: 1 };
const DEGRADATION = [
  { dpr: 1.5 },
  { dpr: 1.5, effectDensity: 0.5 },
  { dpr: 1.5, effectDensity: 0.5, baseScale: 0.5 }
];

const MEMORY_LIMIT = 384 * 1024 * 1024; // 384 MB total canvas memory
const PIXEL_LIMIT = 16700000; // 16.7 million pixels per canvas

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
// PASS/FAIL shaped line that is reported but never counted as a failure.
function infoCheck(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
function note(name, detail) {
  console.log('INFO | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
function round3(x) { return Math.round(x * 1000) / 1000; }

// Measurement helper, run inside the page by page.evaluate. For a phase it
// synchronously loops the draw call N times, timing each with
// performance.now, then sorts the durations and returns p95, max, median, n.
// Phases: state (drawState, 100 iterations), frame (drawFrame with
// increasing tMs, 120 iterations), base (drawBase, 20 iterations).
function BENCH_MEASURE(phase) {
  var iters = phase === 'state' ? 100 : phase === 'frame' ? 120 : 20;
  var durs = [];
  for (var i = 0; i < iters; i++) {
    var t0 = performance.now();
    if (phase === 'state') BENCH.drawState();
    else if (phase === 'frame') BENCH.drawFrame((i * 900) / iters);
    else BENCH.drawBase();
    durs.push(performance.now() - t0);
  }
  durs.sort(function (a, b) { return a - b; });
  var mid = iters >> 1;
  return {
    p95: durs[Math.min(iters - 1, Math.floor(iters * 0.95))],
    max: durs[iters - 1],
    median: iters % 2 ? durs[mid] : (durs[mid - 1] + durs[mid]) / 2,
    n: iters
  };
}

async function main() {
  // ---------- Node part ----------
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  check('fixture reads back', readBack.ok === true, readBack.reason || '');
  if (!readBack.ok) {
    const failed = results.filter((ok) => !ok).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }

  const view = playerView(readBack.state);
  const viewJson = JSON.stringify(view);

  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);

  const browser = await chromium.launch({ executablePath: CHROME });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1120 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(URL);
    await page.waitForFunction(() => window.BENCH && typeof window.BENCH.setup === 'function', null, { timeout: 30000 });

    await page.evaluate(([v, o]) => BENCH.setup(JSON.parse(v), o), [viewJson, PRIMARY]);

    const counts = await page.evaluate(() => BENCH.counts());
    check('counts provinces 70', counts.provinces === 70, String(counts.provinces));
    check('counts spritesPerFrame 200', counts.spritesPerFrame === 200, String(counts.spritesPerFrame));
    check('counts atlasSize 256', counts.atlasSize === 256, String(counts.atlasSize));
    check('counts frontEdges above 0', counts.frontEdges > 0, String(counts.frontEdges));
    check('counts canvasCount 6', counts.canvasCount === 6, String(counts.canvasCount));

    // ---------- Primary measurement at DPR 2 ----------
    const measured = {
      state: await page.evaluate(BENCH_MEASURE, 'state'),
      frame: await page.evaluate(BENCH_MEASURE, 'frame'),
      base: await page.evaluate(BENCH_MEASURE, 'base')
    };

    let memBytes = await page.evaluate(() => BENCH.memoryBytes());
    let maxPixels = await page.evaluate((ids) => Math.max.apply(null, ids.map((id) => {
      const c = document.getElementById(id);
      return c.width * c.height;
    })), CANVAS_IDS);

    const gateStart = results.length;
    check('state p95 at most 6 ms', measured.state.p95 <= 6, round3(measured.state.p95) + ' ms');
    check('frame p95 at most 10 ms', measured.frame.p95 <= 10, round3(measured.frame.p95) + ' ms');
    check('base max at most 120 ms', measured.base.max <= 120, round3(measured.base.max) + ' ms');
    check('no frame or state draw over 50 ms', Math.max(measured.state.max, measured.frame.max) <= 50,
      round3(Math.max(measured.state.max, measured.frame.max)) + ' ms');
    check('total canvas memory under 384 MB', memBytes < MEMORY_LIMIT, (memBytes / 1048576).toFixed(1) + ' MB');
    check('each canvas under 16.7 million pixels', maxPixels < PIXEL_LIMIT, String(maxPixels));

    // ---------- CPU throttle flow ----------
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const throttled = await page.evaluate(BENCH_MEASURE, 'frame');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    check('throttled frame p95 at most 16.7 ms', throttled.p95 <= 16.7, round3(throttled.p95) + ' ms');

    // ---------- SwiftShader flow (pessimistic floor, reported only) ----------
    let ssState = null;
    let ssFrame = null;
    const browser2 = await chromium.launch({
      executablePath: CHROME,
      args: ['--use-gl=angle', '--use-angle=swiftshader']
    });
    try {
      const page2 = await browser2.newPage({ viewport: { width: 1600, height: 1120 } });
      await page2.goto(URL);
      await page2.waitForFunction(() => window.BENCH && typeof window.BENCH.setup === 'function', null, { timeout: 30000 });
      await page2.evaluate(([v, o]) => BENCH.setup(JSON.parse(v), o), [viewJson, PRIMARY]);
      ssState = await page2.evaluate(BENCH_MEASURE, 'state');
      ssFrame = await page2.evaluate(BENCH_MEASURE, 'frame');
    } finally {
      await browser2.close();
    }
    infoCheck('swiftshader state p95', ssState.p95 <= 6, round3(ssState.p95) + ' ms (reported, not counted)');
    infoCheck('swiftshader frame p95', ssFrame.p95 <= 10, round3(ssFrame.p95) + ' ms (reported, not counted)');

    // ---------- Degradation order ----------
    let failures = currentFailures();
    let configUsed = Object.assign({}, PRIMARY);
    let degraded = false;
    let rung = 0;
    while (failures.length > 0 && rung < DEGRADATION.length) {
      configUsed = Object.assign({}, PRIMARY, DEGRADATION[rung]);
      rung++;
      degraded = true;
      note('degrade to dpr ' + configUsed.dpr + ' effectDensity ' + configUsed.effectDensity +
        ' baseScale ' + configUsed.baseScale);
      await page.evaluate(([v, o]) => BENCH.setup(JSON.parse(v), o), [viewJson, configUsed]);
      const toRemeasure = [];
      if (failures.indexOf('state') !== -1 || failures.indexOf('longtask') !== -1) toRemeasure.push('state');
      if (failures.indexOf('frame') !== -1 || failures.indexOf('longtask') !== -1) toRemeasure.push('frame');
      if (failures.indexOf('base') !== -1) toRemeasure.push('base');
      for (let j = 0; j < toRemeasure.length; j++) {
        const phase = toRemeasure[j];
        measured[phase] = await page.evaluate(BENCH_MEASURE, phase);
        note('remeasured ' + phase + ' at degraded config',
          'p95 ' + round3(measured[phase].p95) + ' ms, max ' + round3(measured[phase].max) + ' ms');
      }
      memBytes = await page.evaluate(() => BENCH.memoryBytes());
      maxPixels = await page.evaluate((ids) => Math.max.apply(null, ids.map((id) => {
        const c = document.getElementById(id);
        return c.width * c.height;
      })), CANVAS_IDS);
      failures = currentFailures();
    }

    // ---------- Verdict ----------
    const countsOk = counts.provinces === 70 && counts.spritesPerFrame === 200 &&
      counts.atlasSize === 256 && counts.frontEdges > 0 && counts.canvasCount === 6;
    const throttledOk = throttled.p95 <= 16.7;
    const pass = countsOk && throttledOk && failures.length === 0;
    if (pass) results.length = gateStart; // drop gated checks superseded by degradation

    note('page errors', pageErrors.length === 0 ? 'none' : pageErrors.join('; '));

    function currentFailures() {
      const f = [];
      if (measured.state.p95 > 6) f.push('state');
      if (measured.frame.p95 > 10) f.push('frame');
      if (measured.base.max > 120) f.push('base');
      if (Math.max(measured.state.max, measured.frame.max) > 50) f.push('longtask');
      if (memBytes >= MEMORY_LIMIT) f.push('memory');
      if (maxPixels >= PIXEL_LIMIT) f.push('pixels');
      return f;
    }

    const maxDrawMs = Math.max(measured.state.max, measured.frame.max);
    console.log('SUMMARY | ' + (pass ? 'PASS' : 'FAIL') +
      ' | config dpr=' + configUsed.dpr + ' spriteCount=' + configUsed.spriteCount +
      ' effectDensity=' + configUsed.effectDensity + ' baseScale=' + configUsed.baseScale +
      (degraded ? ' (degraded)' : '') +
      ' | state p95 ' + round3(measured.state.p95) + ' ms' +
      ' | frame p95 ' + round3(measured.frame.p95) + ' ms' +
      ' | throttled frame p95 ' + round3(throttled.p95) + ' ms' +
      ' | base max ' + round3(measured.base.max) + ' ms' +
      ' | max draw ' + round3(maxDrawMs) + ' ms' +
      ' | memory ' + (memBytes / 1048576).toFixed(1) + ' MB');

    console.log('BENCH_JSON: ' + JSON.stringify({
      counts: counts,
      stateP95: round3(measured.state.p95),
      frameP95: round3(measured.frame.p95),
      throttledFrameP95: round3(throttled.p95),
      baseMax: round3(measured.base.max),
      maxDrawMs: round3(maxDrawMs),
      memoryMB: Math.round((memBytes / 1048576) * 10) / 10,
      swiftshaderStateP95: round3(ssState.p95),
      swiftshaderFrameP95: round3(ssFrame.p95),
      config: configUsed,
      pass: pass
    }));

    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
