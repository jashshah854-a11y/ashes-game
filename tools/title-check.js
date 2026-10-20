'use strict';
// Ashes of Empires, Cycle 23 Step 21b-3, F01 interim title screen browser
// check.
// Proves, on the real index.html?seed=42 in headless Chromium:
//   the title overlay is visible at load, its computed background-image
//   references assets/scenes/sc-ttl-interim.png, the wordmark reads
//   "Ashes of Empires", and the buttons block holds exactly the two buttons
//   "New game" and "How to play";
//   the war is paused behind the title: the day counter stays 1 across at
//   least 2.1 seconds;
//   "How to play" shows #title-how (naming Khessograd and Vesskar City) and
//   hides the buttons block, and "Back" reverses both;
//   "New game" hides the title overlay and the day counter reaches 2 or more
//   within 3.5 seconds;
//   no page exceptions and no console errors.
// Pattern from tools/frame-check.js: raw CDP over WebSocket, no Playwright.
// Uses tools/browser-helper.js for waiting (no local sleep).
// Screenshot: /tmp/title-check.png (taken while the title is up).
// Usage: node tools/title-check.js
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const CDP_PORT = 9344;
const CHROME = process.env.CHROME ||
  ['/opt/meta-chromium/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const VIEWPORT = { width: 1500, height: 1100 };
const PAUSE_HOLD_MS = 2100;
const ADVANCE_MS = 3500;

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

const FRAMES_EXPR = 'new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); })';

// Visibility of the title parts, computed in page.
const STATE_EXPR = `(function () {
  function shown(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
  }
  var t = document.getElementById('title-overlay');
  var how = document.getElementById('title-how');
  var btns = document.getElementById('title-buttons');
  return {
    titleShown: shown(t),
    bg: t ? getComputedStyle(t).backgroundImage : null,
    wordmark: (document.getElementById('title-wordmark') || {}).textContent,
    buttons: btns ? Array.prototype.map.call(btns.querySelectorAll('button'), function (b) { return b.textContent.trim(); }) : [],
    buttonsShown: shown(btns),
    howShown: shown(how),
    howText: how ? how.textContent : '',
    day: document.getElementById('day-counter').textContent.trim()
  };
})()`;

// Real mouse click at the centre of an element.
async function clickId(cdp, id) {
  const c = await cdp.evaluate("(function () { var r = document.getElementById('" + id + "').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, button: 'none', buttons: 0, clickCount: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', buttons: 0, clickCount: 1 });
}

async function main() {
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const url = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--user-data-dir=/tmp/chrome-ashes-title-check', '--remote-debugging-address=127.0.0.1',
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url });
    await H.waitUntil(async () => {
      try {
        return await cdp.evaluate("document.readyState === 'complete' && document.getElementById('day-counter').textContent.trim().length > 0 && !!document.getElementById('title-overlay')");
      } catch (e) { return false; }
    }, 20000, 'page initializes');
    await cdp.evaluate(FRAMES_EXPR);

    // ----- 1. Title at load -----
    const s0 = await cdp.evaluate(STATE_EXPR);
    check('title overlay visible at load', s0.titleShown === true, String(s0.titleShown));
    check('title background-image references assets/scenes/sc-ttl-interim.png',
      typeof s0.bg === 'string' && s0.bg.indexOf('assets/scenes/sc-ttl-interim.png') !== -1, s0.bg);
    check('wordmark reads "Ashes of Empires"', (s0.wordmark || '').trim() === 'Ashes of Empires', s0.wordmark);
    check('buttons block holds exactly "New game" and "How to play"',
      JSON.stringify(s0.buttons) === JSON.stringify(['New game', 'How to play']) && s0.buttonsShown, JSON.stringify(s0.buttons));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) fs.writeFileSync('/tmp/title-check.png', Buffer.from(shot.result.data, 'base64'));

    // ----- 2. War paused behind the title -----
    const t0 = Date.now();
    const days = [s0.day];
    await H.tryWait(async () => {
      days.push(await cdp.evaluate("document.getElementById('day-counter').textContent.trim()"));
      return false;
    }, PAUSE_HOLD_MS);
    const held = Date.now() - t0;
    check('war paused behind the title: day counter stays 1 for at least 2.1 s',
      held >= PAUSE_HOLD_MS && days.every((d) => d === '1'), 'held ' + held + ' ms, ' + days.length + ' samples, days seen ' + Array.from(new Set(days)).join(','));

    // ----- 3. How to play and Back -----
    await clickId(cdp, 'btn-title-how');
    await H.tryWait(async () => (await cdp.evaluate(STATE_EXPR)).howShown, 3000);
    const s1 = await cdp.evaluate(STATE_EXPR);
    check('How to play shows #title-how and hides the buttons block', s1.howShown && !s1.buttonsShown,
      'how ' + s1.howShown + ', buttons ' + s1.buttonsShown);
    check('#title-how names Khessograd and Vesskar City',
      s1.howText.indexOf('Khessograd') !== -1 && s1.howText.indexOf('Vesskar City') !== -1, s1.howText.replace(/\s+/g, ' ').trim().slice(0, 80));
    await clickId(cdp, 'btn-title-back');
    await H.tryWait(async () => (await cdp.evaluate(STATE_EXPR)).buttonsShown, 3000);
    const s2 = await cdp.evaluate(STATE_EXPR);
    check('Back hides #title-how and shows the buttons block again', !s2.howShown && s2.buttonsShown && s2.titleShown,
      'how ' + s2.howShown + ', buttons ' + s2.buttonsShown + ', title ' + s2.titleShown);
    check('day counter still 1 after How to play and Back', s2.day === '1', s2.day);

    // ----- 4. New game -----
    await clickId(cdp, 'btn-title-new');
    const t1 = Date.now();
    const gone = await H.tryWait(async () => !(await cdp.evaluate(STATE_EXPR)).titleShown, 3000);
    check('New game hides the title overlay', gone, String(gone));
    let day = 1;
    const advanced = await H.tryWait(async () => {
      day = parseInt(await cdp.evaluate("document.getElementById('day-counter').textContent.trim()"), 10);
      return day >= 2;
    }, ADVANCE_MS);
    check('after New game the day counter reaches 2 or more within 3.5 s', advanced,
      'day ' + day + ' after ' + (Date.now() - t1) + ' ms');

    check('no page exceptions or console errors', errors.length === 0, errors.join('; ') || 'none');
    cdp.ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
