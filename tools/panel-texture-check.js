'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 20a, TX-PNL panel texture
// browser check.
// Proves, on the real index.html in headless Chromium: after load the CSS var
// --tx-pnl-image is set on the root and a .card computes a background image;
// the grain is measurably visible in a flat padding strip of the first .card
// (at least 12 distinct luma values textured, at most 3 with js/tx-pnl-data.js
// blocked); legibility holds (strip mean luma within 3 levels of the flat
// page, .card h2 colour rgb(232, 200, 122) on both pages); and with the data
// script blocked the page still initializes with no page exception.
// Pattern from tools/browser-check.js: raw CDP over WebSocket, no Playwright.
// The blocked page fails the js/tx-pnl-data.js file:// request through CDP
// Fetch interception (the raw CDP form of the page.route block other checks use).
// Uses tools/browser-helper.js for waiting (no local sleep).
// Screenshot clips are decoded in node (zlib inflate plus PNG unfiltering).
// Screenshots: /tmp/panel-texture-check-textured.png and -blocked.png.
// Usage: node tools/panel-texture-check.js
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const CDP_PORT = 9341;
const CHROME = process.env.CHROME ||
  ['/opt/meta-chromium/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const H2_COLOR = 'rgb(232, 200, 122)';
const MIN_TEXTURED_LEVELS = 12;
const MAX_FLAT_LEVELS = 3;
const MAX_MEAN_DELTA = 3;

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

// Decodes an 8 bit RGB or RGBA non interlaced PNG (the CDP screenshot form),
// undoing all five scanline filters.
function decodePng(buf) {
  let off = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error('unsupported PNG: depth ' + bitDepth + ' type ' + colorType + ' interlace ' + interlace);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
      } else if (filter !== 0) throw new Error('bad PNG filter ' + filter + ' on row ' + y);
      out[row + x] = (raw[src + x] + pred) & 255;
    }
  }
  return { width, height, bpp, data: out };
}

// Integer Rec. 601 luma per pixel; returns distinct count and mean.
function lumaStats(img) {
  const seen = new Set();
  let sum = 0;
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const k = i * img.bpp;
    const L = Math.round(0.299 * img.data[k] + 0.587 * img.data[k + 1] + 0.114 * img.data[k + 2]);
    seen.add(L);
    sum += L;
  }
  return { distinct: seen.size, mean: n ? sum / n : 0, pixels: n };
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

// Dismisses the opening event overlay and pauses the clock, all in page, so
// nothing covers the panels or changes them between the two loads.
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

// Page state plus the first .card padding strip rectangle: the left padding
// band, inset past the 1 px border and the 4 px radius, top and bottom,
// clipped to the viewport.
const SNAPSHOT_EXPR = `(function () {
  var card = document.querySelector('.card');
  var h2 = document.querySelector('.card h2');
  var day = document.getElementById('day-counter');
  var out = {
    varValue: getComputedStyle(document.documentElement).getPropertyValue('--tx-pnl-image').trim(),
    inlineVar: document.documentElement.style.getPropertyValue('--tx-pnl-image').trim(),
    hasData: typeof window.AshesTxPnlData === 'string' && window.AshesTxPnlData.length > 0,
    cards: document.querySelectorAll('.card').length,
    cardBg: card ? getComputedStyle(card).backgroundImage : null,
    cardsWithBg: Array.prototype.filter.call(document.querySelectorAll('.card'), function (c) { return getComputedStyle(c).backgroundImage !== 'none'; }).length,
    h2Color: h2 ? getComputedStyle(h2).color : null,
    dayText: day ? day.textContent.trim() : '',
    strip: null
  };
  if (card) {
    window.scrollTo(0, 0);
    var r = card.getBoundingClientRect();
    var cs = getComputedStyle(card);
    var padL = parseFloat(cs.paddingLeft), bL = parseFloat(cs.borderLeftWidth);
    var x = Math.ceil(r.left + bL + 1);
    var w = Math.floor(r.left + bL + padL) - x - 1;
    var y = Math.ceil(r.top + 8);
    var h = Math.floor(Math.min(r.bottom, window.innerHeight) - 8) - y;
    out.strip = { x: x, y: y, width: w, height: h };
  }
  return out;
})()`;

const FRAMES_EXPR = 'new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); })';

async function loadAndMeasure(cdp, url, label, blocked, exceptions) {
  exceptions.length = 0;
  await cdp.send('Page.navigate', { url });
  await H.waitUntil(async () => {
    try {
      return await cdp.evaluate("document.readyState === 'complete' && !!document.querySelector('.card') && document.getElementById('day-counter').textContent.trim().length > 0");
    } catch (e) { return false; }
  }, 20000, label + ': page initializes');
  await H.waitUntil(async () => { try { return await cdp.evaluate(SETTLE_EXPR); } catch (e) { return false; } }, 10000, label + ': overlay dismissed and clock paused');
  if (!blocked) {
    await H.waitUntil(async () => {
      try { return await cdp.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--tx-pnl-image').trim().length > 0"); } catch (e) { return false; }
    }, 15000, label + ': --tx-pnl-image set');
  }
  await cdp.evaluate(FRAMES_EXPR);
  const snap = await cdp.evaluate(SNAPSHOT_EXPR);
  let stats = null;
  if (snap.strip && snap.strip.width > 0 && snap.strip.height > 0) {
    const clip = Object.assign({ scale: 1 }, snap.strip);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false });
    if (!shot.result || !shot.result.data) throw new Error(label + ': screenshot failed');
    stats = lumaStats(decodePng(Buffer.from(shot.result.data, 'base64')));
    const full = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (full.result && full.result.data) fs.writeFileSync('/tmp/panel-texture-check-' + label + '.png', Buffer.from(full.result.data, 'base64'));
  }
  return { snap, stats, exceptions: exceptions.slice() };
}

async function main() {
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const base = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--user-data-dir=/tmp/chrome-ashes-panel-texture-check', '--remote-debugging-address=127.0.0.1',
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
    let blockedRequests = 0;
    cdp.on((method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails || {};
        exceptions.push((d.exception && d.exception.description) || d.text || 'exception');
      }
      if (method === 'Fetch.requestPaused') {
        blockedRequests++;
        cdp.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' });
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });

    // ----- Textured page -----
    const tex = await loadAndMeasure(cdp, base, 'textured', false, exceptions);
    check('textured: --tx-pnl-image is set inline on document.documentElement',
      tex.snap.inlineVar.indexOf('url(') === 0 && tex.snap.varValue.indexOf('data:image/webp;base64,') !== -1,
      tex.snap.inlineVar.slice(0, 40) + '... (' + tex.snap.inlineVar.length + ' chars)');
    check('textured: at least one .card computes a background-image other than none',
      tex.snap.cardsWithBg >= 1 && tex.snap.cardBg !== 'none',
      tex.snap.cardsWithBg + ' of ' + tex.snap.cards + ' cards');
    check('textured: padding strip of the first .card was probed',
      !!tex.stats && tex.stats.pixels >= 200,
      tex.snap.strip ? JSON.stringify(tex.snap.strip) + ' ' + (tex.stats ? tex.stats.pixels + ' px' : 'no stats') : 'no card');
    check('textured: padding strip shows at least ' + MIN_TEXTURED_LEVELS + ' distinct luma values',
      !!tex.stats && tex.stats.distinct >= MIN_TEXTURED_LEVELS,
      tex.stats ? tex.stats.distinct + ' distinct, mean ' + tex.stats.mean.toFixed(2) : 'no stats');
    check('textured: .card h2 color is ' + H2_COLOR, tex.snap.h2Color === H2_COLOR, String(tex.snap.h2Color));
    check('textured: no page exceptions', tex.exceptions.length === 0, tex.exceptions.join('; ') || 'none');

    // ----- Blocked page: js/tx-pnl-data.js request failed by CDP Fetch -----
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*tx-pnl-data.js*', requestStage: 'Request' }] });
    const flat = await loadAndMeasure(cdp, base, 'blocked', true, exceptions);
    // Give the (absent) texture a chance to arrive, so flatness is not a race.
    await cdp.evaluate(FRAMES_EXPR);
    const late = await cdp.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--tx-pnl-image').trim()");
    check('blocked: the js/tx-pnl-data.js request was intercepted and failed', blockedRequests >= 1, blockedRequests + ' request(s)');
    check('blocked: AshesTxPnlData is absent and --tx-pnl-image stays unset',
      flat.snap.hasData === false && flat.snap.varValue === '' && late === '',
      'hasData=' + flat.snap.hasData + ' var="' + flat.snap.varValue + '"');
    check('blocked: page initializes (a .card exists, day counter has text)',
      flat.snap.cards >= 1 && flat.snap.dayText.length > 0,
      flat.snap.cards + ' cards, day "' + flat.snap.dayText + '"');
    check('blocked: no page exception broke init', flat.exceptions.length === 0, flat.exceptions.join('; ') || 'none');
    check('blocked: every .card background-image is none', flat.snap.cardsWithBg === 0, flat.snap.cardsWithBg + ' textured');
    check('blocked: same padding strip rectangle as the textured page',
      JSON.stringify(flat.snap.strip) === JSON.stringify(tex.snap.strip), JSON.stringify(flat.snap.strip));
    check('blocked: padding strip shows at most ' + MAX_FLAT_LEVELS + ' distinct luma values',
      !!flat.stats && flat.stats.distinct <= MAX_FLAT_LEVELS,
      flat.stats ? flat.stats.distinct + ' distinct, mean ' + flat.stats.mean.toFixed(2) + ', ' + flat.stats.pixels + ' px' : 'no stats');
    check('blocked: .card h2 color is ' + H2_COLOR, flat.snap.h2Color === H2_COLOR, String(flat.snap.h2Color));

    // ----- Legibility -----
    const delta = tex.stats && flat.stats ? Math.abs(tex.stats.mean - flat.stats.mean) : Infinity;
    check('legibility: textured strip mean luma within ' + MAX_MEAN_DELTA + ' of the flat strip', delta <= MAX_MEAN_DELTA,
      'textured ' + (tex.stats ? tex.stats.mean.toFixed(2) : '?') + ' vs flat ' + (flat.stats ? flat.stats.mean.toFixed(2) : '?') + ' (delta ' + delta.toFixed(2) + ')');

    await cdp.send('Fetch.disable');
    cdp.ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
