'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 20b, DC-xx decal browser check.
// Proves, on the real index.html?seed=42 in headless Chromium, played
// unpaused at 2x through the page's own controls (event cards dismissed with
// their own Continue button) until window.AshesDecalDebug.count is at least
// 1 (bounded, 90 s), then paused through the Pause button:
//   events exist and every event day is at most the current day;
//   AshesDecalDebug.ops has one op per event (every event has a hit polygon);
//   containment: every #map-decals pixel with alpha above 0 lies in a decal
//   op's province (AshesChart.hitTest) AND inside that op's stamp square;
//   at least one op's square holds at least 50 pixels with alpha above 0;
//   determinism: a reload with the same seed, replayed to the same count,
//   gives the identical event list (provinceId, day, variant);
//   no page exception in either run.
// Pixel scan: EVERY pixel of #map-decals (no subsampling), done in page.
// Chart transform: recomputed in page exactly as js/map-canvas.js
// chartTransform does it (scale = canvas px over chart.widthCells and
// chart.heightCells, origin at chart.insetX, chart.insetTop), over
// AshesChart.buildChart(AshesMapGeometry.buildGeometry(AshesView(s))).
// js/main.js keeps its game state in a closure (there is no window.state),
// so s is AshesSim.createGame(seed) built in page with the same seed: the
// board geometry depends only on the seeded map. The check proves that chart
// is the live one by matching every op polygon against its hitPolygons and
// the chart seed against AshesChartDebug. The current day is read from the
// page's own #day-counter, which js/main.js writes from state.day.
// Stamp square: drawDecals draws a square of side op.size * scaleX device px
// on both axes, so in cell units the half side is op.size / 2 on x and
// op.size * scaleX / scaleY / 2 on y (the two agree when the scales match;
// the check prints both scales).
// Antialiasing: the stamp is clipped to the hit polygon, so an edge pixel can
// carry alpha while its centre sits just across the edge. A pixel passes if
// its centre or any of its four corners satisfies province plus square.
// Pattern from tools/panel-texture-check.js: raw CDP over WebSocket, no
// Playwright. Uses tools/browser-helper.js for waiting (no local sleep).
// Screenshot: /tmp/decal-check.png.
// Usage: node tools/decal-check.js
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const CDP_PORT = 9342;
const SEED = 42;
const CHROME = process.env.CHROME ||
  ['/opt/meta-chromium/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const PLAY_TIMEOUT_MS = 90000;
const MIN_DISC_PIXELS = 50;

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// Minimal CDP session over the page target WebSocket, with event listeners.
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method) listeners.forEach((fn) => fn(m.method, m.params || {}));
  };
  const send = (method, params) => new Promise((resolve) => {
    const id = ++mid;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.error) throw new Error(r.error.message);
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result.result.value;
  };
  return { ws, send, evaluate, on: (fn) => listeners.push(fn) };
}

// One play step through the page's own controls: close an event card or the
// codex, select 2x once, and resume if paused. Returns the decal count.
const PLAY_EXPR = `(function () {
  var ov = document.getElementById('event-overlay');
  if (ov && !ov.classList.contains('hidden')) { document.getElementById('btn-event-continue').click(); }
  var cx = document.getElementById('codex-overlay');
  if (cx && !cx.classList.contains('hidden')) { document.getElementById('btn-codex-close').click(); }
  var s2 = document.getElementById('btn-speed2');
  if (s2 && !s2.classList.contains('active')) s2.click();
  var p = document.getElementById('btn-pause');
  if (p && p.textContent.trim() === 'Resume') p.click();
  var d = window.AshesDecalDebug;
  return d ? d.count : 0;
})()`;

// Pause through the Pause button; true once the clock reads paused.
const PAUSE_EXPR = `(function () {
  var p = document.getElementById('btn-pause');
  if (p.textContent.trim() === 'Resume') return true;
  var ov = document.getElementById('event-overlay');
  if (ov && !ov.classList.contains('hidden')) return true; // a card holds the pause
  p.click();
  return p.textContent.trim() === 'Resume';
})()`;

// Settled once every variant an op needs has loaded and the canvas was
// redrawn after the last load (drawCount steady across two polls).
const READY_EXPR = `(function () {
  var d = window.AshesDecalDebug, t = window.AshesTextureDebug;
  if (!d || !t || !t.decalStates) return null;
  var ok = d.ops.every(function (op) { return t.decalStates[op.variant] === 'ready'; });
  return { ok: ok, drawCount: d.drawCount };
})()`;

const FRAMES_EXPR = 'new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); })';

function measureExpr(seed) {
  return `(function () {
  var dbg = window.AshesDecalDebug;
  var canvas = document.getElementById('map-decals');
  var s = AshesSim.createGame(${seed});
  var chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(AshesView(s)));
  var W = canvas.width, Hh = canvas.height;
  // js/map-canvas.js chartTransform, recomputed.
  var scaleX = W / chart.widthCells;
  var scaleY = Hh / chart.heightCells;
  var tx = chart.insetX * scaleX, ty = chart.insetTop * scaleY;
  var ops = dbg.ops;
  var polyMismatch = [];
  ops.forEach(function (op) {
    var hp = chart.hitPolygons[op.provinceId];
    var flat = [];
    (hp || []).forEach(function (q) { flat.push(q.x, q.y); });
    var same = flat.length === op.polygon.length && flat.every(function (v, i) { return Math.abs(v - op.polygon[i]) < 1e-9; });
    if (!same) polyMismatch.push(op.provinceId);
  });
  var byProv = {};
  ops.forEach(function (op) { (byProv[op.provinceId] = byProv[op.provinceId] || []).push(op); });
  function inSquare(op, x, y) {
    var hx = op.size / 2, hy = op.size * scaleX / scaleY / 2;
    return Math.abs(x - op.cx) <= hx && Math.abs(y - op.cy) <= hy;
  }
  // The op a cell point belongs to: province from hitTest, square from the op.
  function owningOp(x, y) {
    var pid = AshesChart.hitTest(chart, x, y);
    var list = pid ? byProv[pid] : null;
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (inSquare(list[i], x, y)) return list[i];
    return null;
  }
  var data = canvas.getContext('2d').getImageData(0, 0, W, Hh).data;
  var alphaPx = 0, outside = 0, outsideSamples = [], centreFallback = 0;
  var perOp = ops.map(function () { return 0; });
  for (var py = 0; py < Hh; py++) {
    for (var px = 0; px < W; px++) {
      if (data[(py * W + px) * 4 + 3] === 0) continue;
      alphaPx++;
      var pts = [[px + 0.5, py + 0.5], [px, py], [px + 1, py], [px, py + 1], [px + 1, py + 1]];
      var hit = null;
      for (var k = 0; k < pts.length && !hit; k++) {
        hit = owningOp((pts[k][0] - tx) / scaleX, (pts[k][1] - ty) / scaleY);
        if (hit && k > 0) centreFallback++;
      }
      if (!hit) {
        outside++;
        if (outsideSamples.length < 5) outsideSamples.push(px + ',' + py);
        continue;
      }
      var cxc = (px + 0.5 - tx) / scaleX, cyc = (py + 0.5 - ty) / scaleY;
      ops.forEach(function (op, i) { if (inSquare(op, cxc, cyc)) perOp[i]++; });
    }
  }
  return {
    width: W, height: Hh, scaleX: scaleX, scaleY: scaleY,
    chartSeed: chart.chartSeed,
    liveChartSeed: window.AshesChartDebug ? window.AshesChartDebug.seed : null,
    polyMismatch: polyMismatch,
    alphaPx: alphaPx, outside: outside, outsideSamples: outsideSamples, centreFallback: centreFallback,
    perOp: perOp,
    day: parseInt(document.getElementById('day-counter').textContent, 10),
    count: dbg.count, drawCount: dbg.drawCount, hash: dbg.hash,
    events: dbg.events.map(function (e) { return { provinceId: e.provinceId, day: e.day, variant: e.variant }; }),
    opsLen: ops.length,
    ops: ops.map(function (op) { return { provinceId: op.provinceId, day: op.day, variant: op.variant, cx: op.cx, cy: op.cy, size: op.size }; })
  };
})()`;
}

// Loads the page, plays until the decal count reaches target, pauses, waits
// for the decal images, and measures.
async function playRun(cdp, url, label, target, exceptions) {
  exceptions.length = 0;
  await cdp.send('Page.navigate', { url });
  await H.waitUntil(async () => {
    try {
      return await cdp.evaluate("document.readyState === 'complete' && !!document.getElementById('map-decals') && document.getElementById('day-counter').textContent.trim().length > 0 && !!window.AshesDecalDebug");
    } catch (e) { return false; }
  }, 20000, label + ': page initializes');
  const t0 = Date.now();
  let count = 0;
  const reached = await H.tryWait(async () => {
    try { count = await cdp.evaluate(PLAY_EXPR); } catch (e) { return false; }
    return count >= target;
  }, PLAY_TIMEOUT_MS);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!reached) return { reached: false, count, elapsed, exceptions: exceptions.slice() };
  await H.waitUntil(async () => { try { return await cdp.evaluate(PAUSE_EXPR); } catch (e) { return false; } }, 10000, label + ': paused');
  let lastDraw = -1;
  await H.waitUntil(async () => {
    let r = null;
    try { r = await cdp.evaluate(READY_EXPR); } catch (e) { return false; }
    if (!r || !r.ok) return false;
    const steady = r.drawCount === lastDraw;
    lastDraw = r.drawCount;
    return steady;
  }, 15000, label + ': decal images ready and drawn');
  await cdp.evaluate(FRAMES_EXPR);
  const m = await cdp.evaluate(measureExpr(SEED));
  return { reached: true, count: m.count, elapsed, m, exceptions: exceptions.slice() };
}

async function main() {
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const url = 'file://' + path.join(REPO, 'index.html') + '?seed=' + SEED;
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--user-data-dir=/tmp/chrome-ashes-decal-check', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + CDP_PORT, '--window-size=1500,1100', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    await H.tryWait(async () => {
      try { targets = await getJson('http://127.0.0.1:' + CDP_PORT + '/json'); } catch (e) { /* not up yet */ }
      return !!targets && targets.some((t) => t.type === 'page');
    }, 20000);
    if (!targets) throw new Error('chrome debugging endpoint never came up');
    const target = targets.find((t) => t.type === 'page');
    const cdp = await connect(target.webSocketDebuggerUrl);

    const exceptions = [];
    cdp.on((method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails || {};
        exceptions.push((d.exception && d.exception.description) || d.text || 'exception');
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });

    // ----- Run 1 -----
    const r1 = await playRun(cdp, url, 'run 1', 1, exceptions);
    check('run 1: AshesDecalDebug.count reached at least 1 within ' + (PLAY_TIMEOUT_MS / 1000) + ' s',
      r1.reached, 'count ' + r1.count + ' after ' + r1.elapsed + ' s');
    if (r1.reached) {
      const m = r1.m;
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      if (shot.result && shot.result.data) fs.writeFileSync('/tmp/decal-check.png', Buffer.from(shot.result.data, 'base64'));
      console.log('INFO | canvas ' + m.width + ' x ' + m.height + ', scaleX ' + m.scaleX.toFixed(4) + ', scaleY ' + m.scaleY.toFixed(4) +
        ', day ' + m.day + ', drawCount ' + m.drawCount + ', hash ' + m.hash);
      m.ops.forEach((op, i) => console.log('INFO | op ' + op.provinceId + ' day ' + op.day + ' ' + op.variant +
        ' centre (' + op.cx.toFixed(3) + ', ' + op.cy.toFixed(3) + ') size ' + op.size + ', ' + m.perOp[i] + ' px'));
      const badDays = m.events.filter((e) => !(e.day <= m.day));
      check('events: at least one event and every event day <= current day ' + m.day,
        m.events.length >= 1 && badDays.length === 0,
        m.events.length + ' events, days ' + m.events.map((e) => e.day).join(',') + (badDays.length ? ', late ' + JSON.stringify(badDays) : ''));
      check('ops: AshesDecalDebug.ops length equals the event count', m.opsLen === m.events.length,
        m.opsLen + ' ops, ' + m.events.length + ' events');
      check('transform: recomputed chart is the live chart (seed and every op polygon match)',
        m.chartSeed === m.liveChartSeed && m.polyMismatch.length === 0,
        'seed ' + m.chartSeed + ' vs live ' + m.liveChartSeed + ', polygon mismatches ' + (m.polyMismatch.join(',') || 'none'));
      check('containment: every #map-decals pixel with alpha above 0 is in a decal province and inside its stamp square',
        m.alphaPx > 0 && m.outside === 0,
        m.alphaPx + ' alpha px scanned (every pixel), ' + m.outside + ' outside' +
        (m.outsideSamples.length ? ' e.g. ' + m.outsideSamples.join(' ') : '') + ', ' + m.centreFallback + ' passed on a corner');
      const best = Math.max(0, ...m.perOp);
      check('draws: at least one op square holds at least ' + MIN_DISC_PIXELS + ' pixels with alpha above 0',
        best >= MIN_DISC_PIXELS, 'max ' + best + ' px');
    }
    check('run 1: no page exceptions', r1.exceptions.length === 0, r1.exceptions.join('; ') || 'none');

    // ----- Run 2: same seed, replayed to the same count -----
    if (r1.reached) {
      const r2 = await playRun(cdp, url, 'run 2', r1.count, exceptions);
      check('run 2: replay reached the run 1 count ' + r1.count + ' within ' + (PLAY_TIMEOUT_MS / 1000) + ' s',
        r2.reached, 'count ' + r2.count + ' after ' + r2.elapsed + ' s');
      const a = JSON.stringify(r1.m.events);
      const b = r2.reached ? JSON.stringify(r2.m.events) : null;
      check('determinism: run 2 event list (provinceId, day, variant) is identical to run 1', a === b,
        a + (a === b ? '' : ' vs ' + b));
      check('run 2: no page exceptions', r2.exceptions.length === 0, r2.exceptions.join('; ') || 'none');
    }

    cdp.ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
