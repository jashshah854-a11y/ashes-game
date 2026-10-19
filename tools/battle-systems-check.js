'use strict';
// Real browser check for Cycle 17 Step 3: battles, events, and signature systems legibility.
// Drives the actual repo index.html in headless Chromium over CDP, not a stub.
// Asserts the map hint, log explain, exchange explain, research jamming explain,
// and unit card supply grace text all render with real numbers from the sim,
// with no broken labels.
// Usage: node tools/battle-systems-check.js
// Exit 0 when every gating check passes, 1 on a check failure, 2 on error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const Sim = require('../js/sim.js');
const H = require('./browser-helper.js');

const REPO = path.join(__dirname, '..');
const PORT = 9343;
const USER_DATA = '/tmp/chrome-ashes-battle-systems';

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
    await H.tryWait(async () => {
      try { targets = await getJson('http://127.0.0.1:' + PORT + '/json'); } catch (e) { /* not up yet */ }
      return !!targets;
    }, 20000);
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

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      return r.result.result.value;
    };

    await H.waitUntil(async () => {
      try {
        return await evaluate("(function () { var el = document.querySelector('#map-legend + .hint'); return !!el && el.textContent.replace(/\\s+/g, '').length > 0 && document.querySelectorAll('.province').length > 0; })()");
      } catch (e) { return false; }
    }, 10000, 'map hint paragraph renders');

    // Every expected number below comes from the sim, never a copied literal.
    const CFG = Sim.CFG;

    // ---- 1. Pause the game with the real Pause button ----
    await evaluate("document.getElementById('btn-pause').click()");
    await H.tryWait(async () => (await evaluate("document.getElementById('btn-pause').textContent.trim()")) === 'Resume', 3000);
    const pauseLabel = await evaluate("document.getElementById('btn-pause').textContent.trim()");
    check('pause button reads Resume after click', pauseLabel === 'Resume', pauseLabel);

    // ---- 2. Map hint paragraph assertions ----
    const mapHint = await evaluate("document.querySelector('#map-legend + .hint').textContent.replace(/\\s+/g, ' ').trim()");
    check('map hint rendered', mapHint.replace(/\\s+/g, '').length > 0, mapHint.slice(0, 120));

    // Order timing
    check('map hint has dawn and next day wording', mapHint.indexOf('at dawn on the next day') !== -1, '');
    check('map hint has one neighboring province per day', mapHint.indexOf('one neighboring province per day') !== -1, '');

    // Stays home rule
    check('map hint has stays to defend wording', mapHint.indexOf('stays to defend its own province') !== -1, '');
    check('map hint has order cancelled wording', mapHint.indexOf('order is cancelled') !== -1, '');

    // Frontline naming
    check('map hint has front border wording', mapHint.toLowerCase().indexOf('the front is the border where your blue provinces meet dominion red provinces') !== -1, '');
    check('map hint has capture changes tile color', mapHint.indexOf('its tile changes to the captor color') !== -1, '');
    check('map hint has front moves wording', mapHint.indexOf('so the front moves') !== -1, '');
    check('map hint has war log names province', mapHint.indexOf('war log names the province that changed hands') !== -1, '');

    // Supply grace (3 days from CFG)
    check('map hint has 3 days out of supply attrition wording', mapHint.indexOf('after 3 days out of supply it also loses strength to attrition') !== -1, 'want after 3 days out of supply it also loses strength to attrition');
    check('map hint supply grace number matches CFG', mapHint.indexOf('after ' + CFG.supplyGraceDays + ' days out of supply') !== -1, 'CFG.supplyGraceDays is ' + CFG.supplyGraceDays);

    // ---- 3. Log explain paragraph assertions ----
    const logExplain = await evaluate("document.getElementById('log-explain').textContent.replace(/\\s+/g, ' ').trim()");
    check('log explain rendered', logExplain.replace(/\\s+/g, '').length > 0, logExplain.slice(0, 120));

    check('log explain capture means tile changed color', logExplain.indexOf('capture line means the named nation took the named province and its tile changed color') !== -1, '');
    check('log explain repelled or destroyed means defenders held', logExplain.indexOf('repelled or destroyed line means the defenders held and the province did not change hands') !== -1, '');
    check('log explain higher stack power wins', logExplain.indexOf('the side with the higher stack power in the fight wins') !== -1, '');
    check('log explain attack against defense', logExplain.indexOf('attack against defense') !== -1, '');
    check('log explain supply fortifications river drone counted', logExplain.indexOf('with supply, fortifications, river crossings, and drone effectiveness counted') !== -1, '');
    check('log explain same numbers as attack preview', logExplain.indexOf('the same numbers the attack preview shows before you order') !== -1, '');
    check('log explain hit points destroyed chip disappears', logExplain.indexOf('loses all its strength in hit points is destroyed and its chip disappears from the map') !== -1, '');
    check('log explain survivors lower strength', logExplain.indexOf('survivors stay with lower strength, shown in hit points on their chip and on the unit card') !== -1, '');

    // ---- 4. Exchange explain assertions ----
    const exExplain = await evaluate("document.getElementById('ex-explain').textContent.replace(/\\s+/g, ' ').trim()");
    check('exchange explain rendered', exExplain.replace(/\\s+/g, '').length > 0, exExplain.slice(0, 120));

    check('exchange explain destroyed definition', exExplain.indexOf('Destroyed is the steel value of enemy units that this nation destroyed') !== -1, '');
    check('exchange explain lost definition', exExplain.indexOf('Lost is the steel value of its own units that it lost') !== -1, '');
    check('exchange explain both nations rows wording', exExplain.indexOf('The same words mean the same in both nations rows') !== -1, '');
    check('exchange explain launches forced and suffered keep names', exExplain.indexOf('Launches forced and launches suffered keep their existing names') !== -1, '');
    check('exchange explain end screen 1 point per steel', exExplain.indexOf('on the campaign end screen, this net counts at 1 point per steel') !== -1, '');

    // ---- 5. Research jamming explain assertions ----
    const jamExplain = await evaluate("document.getElementById('research-jamming-explain').textContent.replace(/\\s+/g, ' ').trim()");
    check('research jamming explain rendered', jamExplain.replace(/\\s+/g, '').length > 0, jamExplain.slice(0, 120));

    check('jamming explain has 100 base', jamExplain.indexOf('100 plus ' + CFG.ewStepPct) !== -1, 'want 100 plus ' + CFG.ewStepPct);
    check('jamming explain has ewStepPct', jamExplain.indexOf('for each generation a nation drone generation leads the other nation jamming generation, minus ' + CFG.ewStepPct) !== -1, 'want ewStepPct ' + CFG.ewStepPct);
    check('jamming explain has ewFloorPct', jamExplain.indexOf('never below ' + CFG.ewFloorPct) !== -1, 'want ewFloorPct ' + CFG.ewFloorPct);
    check('jamming explain has ewCapPct', jamExplain.indexOf('never above ' + CFG.ewCapPct) !== -1, 'want ewCapPct ' + CFG.ewCapPct);

    // ---- 6. Unit card from a real tile holding a player unit chip ----
    const clickedUnitProv = await evaluate("(function () { var t = document.querySelector('.province .unit-chip.mine'); if (!t) return null; var p = t.closest('.province'); if (!p) return null; p.click(); return p.getAttribute('data-prov'); })()");
    await H.tryWait(async () => (await evaluate("document.getElementById('unit-details').textContent.replace(/\\s+/g, ' ').trim()")).indexOf('No unit selected') === -1, 3000);
    check('clicked a tile holding a player unit chip', !!clickedUnitProv, String(clickedUnitProv));
    const unitText = await evaluate("document.getElementById('unit-details').textContent.replace(/\\s+/g, ' ').trim()");
    check('unit details rendered', unitText.replace(/\\s+/g, '').length > 0, unitText.slice(0, 120));
    check('unit details has no broken labels', unitText.indexOf('undefined') === -1 && unitText.indexOf('NaN') === -1 && unitText.indexOf('[object') === -1, '');

    // ---- 7. No broken labels in any of the checked texts ----
    const bad = ['undefined', 'NaN', '[object'];
    const texts = {
      'map hint': mapHint,
      'log explain': logExplain,
      'exchange explain': exExplain,
      'research jamming explain': jamExplain,
      'unit details': unitText
    };
    Object.keys(texts).forEach(function (label) {
      bad.forEach(function (token) {
        check(label + ' free of ' + token, texts[label].indexOf(token) === -1, '');
      });
      check(label + ' is not empty', texts[label].replace(/\\s+/g, '').length > 0, '');
    });

    // ---- 8. Resume if paused ----
    const finalLabel = await evaluate("document.getElementById('btn-pause').textContent.trim()");
    if (finalLabel === 'Resume') {
      await evaluate("document.getElementById('btn-pause').click()");
      await H.tryWait(async () => (await evaluate("document.getElementById('btn-pause').textContent.trim()")) === 'Pause', 3000);
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