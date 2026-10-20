'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 21a, TF interim table frame
// browser check.
// Proves, on the real index.html?seed=42 in headless Chromium:
//   #tf-frame, its four .tf-corner fittings, and the DC09 stains (.dc09-ink,
//   .dc09-ring) exist; at the default viewport and zoom 1 no corner or stain
//   box intersects the #map-base canvas box, and the canvas sits inside the
//   frame's content box, so the rail ring lies wholly outside the map;
//   corner fittings and stains take no pointer events, and the map centre
//   hit test lands inside #map-viewport;
//   G16 shape: at 1280x720, 1024x768, 1680x720 and 390x844 every corner
//   fitting has the identical pixel size and the rail (the gap between the
//   frame edge and the viewport edge, all four sides) has the identical
//   thickness, so corners never stretch;
//   zoom and pan work with the frame present: a real mouse click on Zoom in
//   changes the zoom label and the board transform, a real mouse drag on the
//   board moves the viewport scroll, and the top corner fittings do not move;
//   no page exceptions and no console errors.
// Pattern from tools/panel-texture-check.js: raw CDP over WebSocket, no
// Playwright. Uses tools/browser-helper.js for waiting (no local sleep).
// Screenshot: /tmp/frame-check-default.png (default viewport, zoom 1).
// Usage: node tools/frame-check.js
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const CDP_PORT = 9343;
const CHROME = process.env.CHROME ||
  ['/opt/meta-chromium/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const DEFAULT_VIEWPORT = { width: 1500, height: 1100 };
const G16_VIEWPORTS = [
  { name: '16:9 1280x720', width: 1280, height: 720 },
  { name: '4:3 1024x768', width: 1024, height: 768 },
  { name: '21:9 1680x720', width: 1680, height: 720 },
  { name: 'portrait 390x844', width: 390, height: 844 }
];

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

// Dismisses the opening event overlay and pauses the clock, all in page.
const SETTLE_EXPR = `(function () {
  var ov = document.getElementById('event-overlay');
  if (ov && getComputedStyle(ov).display !== 'none' && !ov.classList.contains('hidden')) {
    var c = document.getElementById('btn-event-continue');
    if (c) c.click();
    return false;
  }
  var p = document.getElementById('btn-pause');
  if (p && p.textContent.trim() === 'Pause') { p.click(); return false; }
  return true;
})()`;

const FRAMES_EXPR = 'new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); })';

// Document coordinate boxes (client rect plus page scroll) of the frame parts.
const SNAPSHOT_EXPR = `(function () {
  function box(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }
  var frame = document.getElementById('tf-frame');
  var vp = document.getElementById('map-viewport');
  var cs = frame ? getComputedStyle(frame) : null;
  var corners = Array.prototype.map.call(document.querySelectorAll('#tf-frame > .tf-corner'), function (c) {
    return { cls: c.className, box: box(c), pe: getComputedStyle(c).pointerEvents };
  });
  var stains = ['dc09-ink', 'dc09-ring'].map(function (cls) {
    var el = document.querySelector('#tf-frame > .' + cls);
    return { cls: cls, box: box(el), pe: el ? getComputedStyle(el).pointerEvents : null };
  });
  return {
    frame: box(frame),
    frameTransform: cs ? cs.transform : null,
    framePad: cs ? [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft] : null,
    viewport: box(vp),
    viewportParent: vp && vp.parentElement ? vp.parentElement.id : null,
    canvas: box(document.getElementById('map-base')),
    corners: corners,
    stains: stains,
    boardTransform: getComputedStyle(document.getElementById('map-board')).transform,
    zoomLabel: document.getElementById('zoom-label').textContent.trim(),
    scrollLeft: vp ? vp.scrollLeft : null
  };
})()`;

function intersects(a, b) {
  if (!a || !b) return true;
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0;
}
function inside(inner, outer) {
  return !!inner && !!outer && inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}
function r2(n) { return Math.round(n * 100) / 100; }
function railOf(s) {
  return [
    r2(s.viewport.y - s.frame.y),
    r2(s.frame.x + s.frame.w - (s.viewport.x + s.viewport.w)),
    r2(s.frame.y + s.frame.h - (s.viewport.y + s.viewport.h)),
    r2(s.viewport.x - s.frame.x)
  ];
}
function cornerSizes(s) { return s.corners.map((c) => c.box ? r2(c.box.w) + 'x' + r2(c.box.h) : 'none'); }

async function load(cdp, url, vp, label) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url });
  await H.waitUntil(async () => {
    try {
      return await cdp.evaluate("document.readyState === 'complete' && document.getElementById('day-counter').textContent.trim().length > 0 && document.getElementById('map-base').getBoundingClientRect().width > 0 && !!window.AshesPanDebug");
    } catch (e) { return false; }
  }, 20000, label + ': page initializes');
  await H.waitUntil(async () => { try { return await cdp.evaluate(SETTLE_EXPR); } catch (e) { return false; } }, 10000, label + ': overlay dismissed and clock paused');
  await cdp.evaluate('window.scrollTo(0, 0)');
  await cdp.evaluate(FRAMES_EXPR);
  return cdp.evaluate(SNAPSHOT_EXPR);
}

async function mouse(cdp, type, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1 });
}

async function main() {
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const url = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--user-data-dir=/tmp/chrome-ashes-frame-check', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + CDP_PORT, '--window-size=1500,1100', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    await H.tryWait(async () => {
      try { targets = await getJson('http://127.0.0.1:' + CDP_PORT + '/json'); } catch (e) { /* not up yet */ }
      return !!targets && targets.some((t) => t.type === 'page');
    }, 20000);
    if (!targets) throw new Error('chrome debugging endpoint never came up');
    const cdp = await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);

    const errors = [];
    cdp.on((method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails || {};
        errors.push('exception: ' + ((d.exception && d.exception.description) || d.text || '?'));
      }
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
        errors.push('console.error: ' + (params.args || []).map((a) => a.value || a.description || '').join(' '));
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    // ----- Default viewport, zoom 1 -----
    const s = await load(cdp, url, DEFAULT_VIEWPORT, 'default');
    check('structure: #tf-frame exists and wraps #map-viewport', !!s.frame && s.viewportParent === 'tf-frame', 'viewport parent ' + s.viewportParent);
    check('structure: four .tf-corner fittings exist', s.corners.length === 4 && s.corners.every((c) => !!c.box),
      s.corners.map((c) => c.cls).join(', '));
    check('structure: DC09 ink blot and cup ring exist', s.stains.every((st) => !!st.box), s.stains.map((st) => st.cls + (st.box ? '' : ' missing')).join(', '));
    check('frame does not transform (only #map-board scales)', s.frameTransform === 'none', String(s.frameTransform));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) fs.writeFileSync('/tmp/frame-check-default.png', Buffer.from(shot.result.data, 'base64'));
    const rail = railOf(s);
    console.log('MEASURE | rail thickness top, right, bottom, left (px) | ' + rail.join(', ') + ' | computed padding ' + (s.framePad || []).join(' '));
    console.log('MEASURE | corner fitting sizes (px) | ' + cornerSizes(s).join(', '));
    console.log('MEASURE | #map-base box | ' + JSON.stringify(s.canvas) + ' | #tf-frame box ' + JSON.stringify(s.frame));
    check('rail: equal thickness on all four sides and above 0', rail.every((v) => v === rail[0]) && rail[0] > 0, rail.join(', '));
    check('canvas box lies inside the frame content box (rail ring wholly outside the map)',
      inside(s.canvas, { x: s.frame.x + rail[3], y: s.frame.y + rail[0], w: s.frame.w - rail[1] - rail[3], h: s.frame.h - rail[0] - rail[2] }),
      JSON.stringify(s.canvas));
    const hits = s.corners.concat(s.stains).filter((p) => intersects(p.box, s.canvas)).map((p) => p.cls);
    check('no corner or stain box intersects the #map-base canvas box', hits.length === 0, hits.join(', ') || 'none');
    const railBand = (b) => !!b && inside(b, s.frame) &&
      !intersects(b, { x: s.frame.x + rail[3], y: s.frame.y + rail[0], w: s.frame.w - rail[1] - rail[3], h: s.frame.h - rail[0] - rail[2] });
    check('DC09 stains lie inside the rail band', s.stains.every((st) => railBand(st.box)), s.stains.map((st) => st.cls + ' ' + JSON.stringify(st.box)).join('; '));
    check('corner fittings and stains take no pointer events', s.corners.concat(s.stains).every((p) => p.pe === 'none'),
      s.corners.concat(s.stains).map((p) => p.pe).join(', '));
    const hitInMap = await cdp.evaluate(`(function () {
      var c = document.getElementById('map-base').getBoundingClientRect();
      var el = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      return !!el && document.getElementById('map-viewport').contains(el);
    })()`);
    check('map centre hit test lands inside #map-viewport, not on the frame', hitInMap === true, String(hitInMap));

    // ----- Zoom and pan with the frame present -----
    const zoomBtn = await cdp.evaluate("(function () { var r = document.getElementById('btn-zoom-in').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await mouse(cdp, 'mousePressed', zoomBtn.x, zoomBtn.y);
    await mouse(cdp, 'mouseReleased', zoomBtn.x, zoomBtn.y);
    await H.waitUntil(async () => (await cdp.evaluate("document.getElementById('zoom-label').textContent.trim()")) !== s.zoomLabel, 5000, 'zoom label changes');
    await cdp.evaluate(FRAMES_EXPR);
    const z = await cdp.evaluate(SNAPSHOT_EXPR);
    check('zoom: clicking Zoom in changes the zoom label and the board transform',
      z.zoomLabel !== s.zoomLabel && z.boardTransform !== s.boardTransform,
      s.zoomLabel + ' to ' + z.zoomLabel + ', ' + s.boardTransform + ' to ' + z.boardTransform);
    const vpc = await cdp.evaluate("(function () { var r = document.getElementById('map-viewport').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height, window.innerHeight - r.top) / 2 }; })()");
    await mouse(cdp, 'mouseMoved', vpc.x, vpc.y);
    await mouse(cdp, 'mousePressed', vpc.x, vpc.y);
    for (let i = 1; i <= 20; i++) await mouse(cdp, 'mouseMoved', vpc.x - i * 15, vpc.y);
    await mouse(cdp, 'mouseReleased', vpc.x - 300, vpc.y);
    await cdp.evaluate(FRAMES_EXPR);
    const p = await cdp.evaluate(SNAPSHOT_EXPR);
    check('pan: dragging the board moves the viewport scroll', p.scrollLeft > z.scrollLeft, 'scrollLeft ' + z.scrollLeft + ' to ' + p.scrollLeft);
    const top = (snap) => snap.corners.filter((c) => /tf-corner-t[lr]/.test(c.cls)).map((c) => JSON.stringify(c.box)).join(' ');
    check('pan and zoom: the top corner fittings did not move', top(p) === top(s), top(p));
    check('pan and zoom: rail thickness unchanged', JSON.stringify(railOf(p)) === JSON.stringify(rail), railOf(p).join(', '));

    // ----- G16: four viewport shapes -----
    const shapes = [];
    for (const vp of G16_VIEWPORTS) {
      const g = await load(cdp, url, vp, vp.name);
      shapes.push({ name: vp.name, rail: railOf(g), corners: cornerSizes(g), canvas: g.canvas, snap: g });
      console.log('MEASURE | ' + vp.name + ' | rail ' + railOf(g).join(', ') + ' | corners ' + cornerSizes(g).join(', '));
    }
    const refCorners = JSON.stringify(shapes[0].corners);
    check('G16: every corner fitting is the same pixel size at all four viewports (corners never stretch)',
      shapes.every((sh) => JSON.stringify(sh.corners) === refCorners) && shapes[0].corners.every((c) => c === shapes[0].corners[0]),
      shapes.map((sh) => sh.name + ' ' + sh.corners[0]).join('; '));
    const refRail = JSON.stringify(rail);
    check('G16: rail thickness is identical at all four viewports and matches the default',
      shapes.every((sh) => JSON.stringify(sh.rail) === refRail),
      shapes.map((sh) => sh.name + ' ' + sh.rail[0]).join('; '));
    check('G16: no corner or stain box intersects the canvas at any of the four viewports',
      shapes.every((sh) => sh.snap.corners.concat(sh.snap.stains).every((q) => !intersects(q.box, sh.canvas))),
      shapes.map((sh) => sh.name + ' canvas ' + r2(sh.canvas.w) + 'x' + r2(sh.canvas.h)).join('; '));

    check('no page exceptions or console errors', errors.length === 0, errors.join('; ') || 'none');
    console.log('MEASURE | RAIL ' + rail[0] + 'px, CORNER ' + shapes[0].corners[0] + 'px');
    cdp.ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
