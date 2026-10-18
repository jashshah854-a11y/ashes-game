'use strict';
// Real browser check for the first touch controls and the map (Cycle 17 Step 1).
// Drives the actual repo index.html in headless Chromium over CDP, not a stub,
// and asserts the start statement, the controls explanation, the map legend, the
// real Pause and Speed 2x buttons, and the province and unit cards all render
// real content with no broken labels.
// Usage: node tools/first-touch-check.js
// Exit 0 when every gating check passes, 1 on a check failure, 2 on error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const REPO = path.join(__dirname, '..');
const PORT = 9341;
const USER_DATA = '/tmp/chrome-ashes-first-touch';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + USER_DATA, '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + PORT, '--window-size=1500,1100',
    'file://' + REPO + '/index.html',
  ], { stdio: 'ignore' });
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + detail); };
  try {
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(500);
      try { targets = await getJson('http://127.0.0.1:' + PORT + '/json'); } catch (e) { /* not up yet */ }
    }
    if (!targets) throw new Error('chrome debugging endpoint never came up');
    const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html')) || targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let mid = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    const send = (method, params) => new Promise((resolve) => {
      const id = ++mid;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(2500);

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      return r.result.result.value;
    };

    // ---- 1. Start statement ----
    const startText = await evaluate("document.getElementById('start-statement') ? document.getElementById('start-statement').textContent.replace(/\\s+/g, ' ').trim() : ''");
    check('start statement exists', !!startText, startText.slice(0, 60));
    ['Vessari Compact', 'Khessograd', 'Vesskar City', 'day 150', 'survival victory'].forEach(function (tok) {
      check('start statement names ' + tok, startText.indexOf(tok) !== -1, '');
    });

    // ---- 2. Controls explanation ----
    const controlsText = await evaluate("document.getElementById('controls-explain') ? document.getElementById('controls-explain').textContent.replace(/\\s+/g, ' ').trim() : ''");
    check('controls explanation exists', !!controlsText, controlsText.slice(0, 60));
    const controlsLower = controlsText.toLowerCase();
    ['real time', 'speed 1x', '0.9', 'speed 2x', '0.3', 'pause', 'resume', 'paused', 'orders'].forEach(function (tok) {
      check('controls explanation covers ' + tok, controlsLower.indexOf(tok) !== -1, '');
    });

    // ---- 3. Map legend ----
    const legendText = await evaluate("document.getElementById('map-legend') ? document.getElementById('map-legend').textContent.replace(/\\s+/g, ' ').trim() : ''");
    check('map legend exists', !!legendText, legendText.slice(0, 60));
    const legendTokens = ['capital star', 'selected province', 'reach outline', 'Steel per day', 'Factory level',
      'Fort level', 'building fort', 'days left', 'Coast', 'Flotilla', 'railroad', 'rail under construction',
      'Converting', 'river', 'supported crossing', 'supply hatching', 'Inf', 'Drone', 'hp', 'attack',
      'blue border', 'yours', 'red border', 'Dominion', 'selected unit chip is gold', 'Day N ghost'];
    legendTokens.forEach(function (tok) {
      check('map legend token: ' + tok, legendText.indexOf(tok) !== -1, '');
    });

    // ---- 4. Pause freezes the days ----
    await evaluate("document.getElementById('btn-pause').click()");
    await sleep(150);
    const pauseLabel = await evaluate("document.getElementById('btn-pause').textContent.trim()");
    check('pause button reads Resume after click', pauseLabel === 'Resume', pauseLabel);
    const dayBefore = await evaluate("document.getElementById('day-counter').textContent");
    await sleep(1150);
    const dayAfter = await evaluate("document.getElementById('day-counter').textContent");
    check('day counter does not advance while paused', dayBefore === dayAfter, dayBefore + ' -> ' + dayAfter);

    // ---- 5. Speed 2x becomes the active speed ----
    await evaluate("document.getElementById('btn-speed2').click()");
    await sleep(150);
    const speed2Active = await evaluate("document.getElementById('btn-speed2').classList.contains('active')");
    const speed1Active = await evaluate("document.getElementById('btn-speed1').classList.contains('active')");
    check('speed 2x button is active', speed2Active === true, 'speed2=' + speed2Active);
    check('speed 1x button is not active', speed1Active === false, 'speed1=' + speed1Active);

    // ---- 6. Province card from a real player owned tile ----
    const clickedProv = await evaluate("(function () { var t = document.querySelector('.province.owner-player.intel-live'); if (!t) return null; t.click(); return t.getAttribute('data-prov'); })()");
    await sleep(150);
    const provName = await evaluate("document.getElementById('prov-name').textContent.trim()");
    const provDetails = await evaluate("document.getElementById('prov-details').textContent.replace(/\\s+/g, ' ').trim()");
    check('clicked a player owned province tile', !!clickedProv, String(clickedProv));
    check('province card shows a name', !!provName && provName.indexOf('No province selected') === -1, provName);
    check('province card shows Steel output and per day', provDetails.indexOf('Steel output:') !== -1 && provDetails.indexOf('per day') !== -1, provDetails.slice(0, 120));

    // ---- 7. Unit card from a real tile holding a player unit chip ----
    const clickedUnitProv = await evaluate("(function () { var t = document.querySelector('.province .unit-chip.mine'); if (!t) return null; var p = t.closest('.province'); if (!p) return null; p.click(); return p.getAttribute('data-prov'); })()");
    await sleep(150);
    const unitText = await evaluate("document.getElementById('unit-details').textContent.replace(/\\s+/g, ' ').trim()");
    check('clicked a tile holding a player unit chip', !!clickedUnitProv, String(clickedUnitProv));
    check('unit card shows hit points', unitText.indexOf('hit points') !== -1, unitText.slice(0, 120));
    check('unit card shows Attack', unitText.indexOf('Attack') !== -1, '');
    check('unit card shows Defense', unitText.indexOf('Defense') !== -1, '');

    // ---- 8. No broken labels anywhere checked ----
    const bad = ['undefined', 'NaN', '[object'];
    const texts = {
      'start statement': startText,
      'controls explanation': controlsText,
      'map legend': legendText,
      'province card': provName + ' ' + provDetails,
      'unit card': unitText
    };
    Object.keys(texts).forEach(function (label) {
      bad.forEach(function (token) {
        check(label + ' free of ' + token, texts[label].indexOf(token) === -1, '');
      });
      check(label + ' is not an empty rendered label', texts[label].replace(/\\s+/g, '').length > 0, '');
    });

    // ---- 9. Resume if paused ----
    const finalLabel = await evaluate("document.getElementById('btn-pause').textContent.trim()");
    if (finalLabel === 'Resume') {
      await evaluate("document.getElementById('btn-pause').click()");
      await sleep(150);
      const afterResume = await evaluate("document.getElementById('btn-pause').textContent.trim()");
      check('game resumed at the end', afterResume === 'Pause', afterResume);
    } else {
      check('game resumed at the end', finalLabel === 'Pause', finalLabel);
    }

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
  const failed = results.filter((r) => !r.ok);
  console.log('GATING FAILURES: ' + failed.length + ' / TOTAL: ' + results.length);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
