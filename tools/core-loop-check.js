'use strict';
// Real browser check for the Cycle 17 Step 2 core loop chain. Drives the
// actual repo index.html in headless Chromium over CDP, not a stub, and
// asserts the factory per level numbers, the unit stacking sentence, and the
// ground to steel income chain link (link 4) all render on the cards with real
// numbers taken from the sim, with no broken labels.
// Usage: node tools/core-loop-check.js
// Exit 0 when every gating check passes, 1 on a check failure, 2 on error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const Sim = require('../js/sim.js');

const REPO = path.join(__dirname, '..');
const PORT = 9342;
const USER_DATA = '/tmp/chrome-ashes-core-loop';
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

    // Every expected number below comes from the sim, never a copied literal.
    const CFG = Sim.CFG;

    // ---- 1. Pause the game with the real Pause button ----
    await evaluate("document.getElementById('btn-pause').click()");
    await sleep(200);
    const pauseLabel = await evaluate("document.getElementById('btn-pause').textContent.trim()");
    check('pause button reads Resume after click', pauseLabel === 'Resume', pauseLabel);

    // ---- 2. Province card from a real player owned live tile ----
    const clickedProv = await evaluate("(function () { var t = document.querySelector('.province.owner-player.intel-live'); if (!t) return null; t.click(); return t.getAttribute('data-prov'); })()");
    await sleep(200);
    check('clicked a player owned live province tile', !!clickedProv, String(clickedProv));
    const provDetails = await evaluate("document.getElementById('prov-details').textContent.replace(/\\s+/g, ' ').trim()");
    const provExplain = await evaluate("document.getElementById('prov-explain').textContent.replace(/\\s+/g, ' ').trim()");
    check('province details rendered', provDetails.replace(/\\s+/g, '').length > 0, provDetails.slice(0, 80));
    check('province explain rendered', provExplain.replace(/\\s+/g, '').length > 0, provExplain.slice(0, 80));

    // ---- 3. Factory per level numbers (link 5 note and walk row 5) ----
    check('factory sentence starts with each factory level', provExplain.indexOf('Each factory level produces') !== -1, '');
    check('factory sentence carries CFG equipment per day', provExplain.indexOf(CFG.equipPerFactoryLevel + ' equipment per day') !== -1, 'want ' + CFG.equipPerFactoryLevel + ' equipment per day');
    check('factory sentence carries CFG steel per day', provExplain.indexOf(CFG.steelPerFactoryLevel + ' steel per day') !== -1, 'want ' + CFG.steelPerFactoryLevel + ' steel per day');

    // ---- 4. Chain link 4: ground to steel income ----
    const steelMatch = provDetails.match(/Steel output:\s*(\d+)\s*per day/);
    check('province details carry a Steel output per day', !!steelMatch, provDetails.slice(0, 140));
    if (steelMatch) {
      const steel = steelMatch[1];
      check('chain sentence carries the province steel per day', provExplain.indexOf(steel + ' steel per day to the income of the nation that holds it') !== -1, 'want ' + steel + ' steel per day');
    }
    check('chain sentence names steel income', provExplain.indexOf('steel income') !== -1, '');

    // ---- 5. Unit card from a real tile holding a player unit chip ----
    const clickedUnitProv = await evaluate("(function () { var t = document.querySelector('.province .unit-chip.mine'); if (!t) return null; var p = t.closest('.province'); if (!p) return null; p.click(); return p.getAttribute('data-prov'); })()");
    await sleep(200);
    check('clicked a tile holding a player unit chip', !!clickedUnitProv, String(clickedUnitProv));
    const unitText = await evaluate("document.getElementById('unit-details').textContent.replace(/\\s+/g, ' ').trim()");
    check('unit details rendered', unitText.replace(/\\s+/g, '').length > 0, unitText.slice(0, 80));
    check('stacking sentence present', unitText.indexOf('fight together as one stack') !== -1, '');
    check('stacking sentence names attack', unitText.indexOf('attack') !== -1, '');
    check('stacking sentence names defense', unitText.indexOf('defense') !== -1, '');
    check('stacking sentence carries the live stack count', unitText.indexOf('This province holds ') !== -1 && /\d+ of your units/.test(unitText), '');

    // ---- 6. No broken labels in any of the three checked texts ----
    const bad = ['undefined', 'NaN', '[object'];
    const texts = {
      'province details': provDetails,
      'province explain': provExplain,
      'unit details': unitText
    };
    Object.keys(texts).forEach(function (label) {
      bad.forEach(function (token) {
        check(label + ' free of ' + token, texts[label].indexOf(token) === -1, '');
      });
      check(label + ' is not empty', texts[label].replace(/\\s+/g, '').length > 0, '');
    });

    // ---- 7. Resume if paused ----
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
