'use strict';
// Ashes of Empires, Cycle 23 zoom pan step, pan browser check.
// Proves: at zoom 1 nothing pans; at zoom 2 the board is pannable and a real
// mouse drag scrolls the viewport east; the drag selects and orders nothing;
// a plain click on a tile in the panned view still selects it; reset returns
// to 100 percent at scroll 0; the pan hint is visible; no page errors.
// Pattern from tools/map-canvas-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const PAN_HINT = 'When zoomed in, drag the map or use the bar under it to pan.';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function provinceLabel(state, id) {
  const p = state.provinces[id];
  return p ? p.name + (p.isCapital ? ' (capital)' : '') : null;
}

async function main() {
  // ---------- Node part: province names from seed 42 ----------
  const state = Sim.createGame(42);

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

    const ready = await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesMapCanvasDebug !== 'undefined' && typeof window.AshesPanDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 10000);
    check('browser: AshesPanDebug exists', ready === true, String(ready));
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    const settleCount = () => page.evaluate(() => window.AshesMapCanvasDebug.settleCount);
    async function clickAndSettle(sel) {
      const before = await settleCount();
      await page.click(sel);
      return H.waitFor(page, async () => {
        try { return (await settleCount()) > before; } catch (e) { return false; }
      }, 10000);
    }

    // 1. zoom 1: nothing to pan
    let pd = await page.evaluate(() => window.AshesPanDebug);
    check('browser: zoom 1 not pannable, maxScrollLeft 0', pd.zoom === 1 && pd.pannable === false && pd.maxScrollLeft === 0,
      'zoom=' + pd.zoom + ' pannable=' + pd.pannable + ' maxScrollLeft=' + pd.maxScrollLeft);

    // Stage a selection at zoom 1: a player tile, so a unit may be picked and
    // a stray click during the drag could issue an order.
    const startProv = await page.evaluate(() => {
      const t = document.querySelector('.province.owner-player') || document.querySelector('.province');
      return t ? t.getAttribute('data-prov') : null;
    });
    await page.click('.province[data-prov="' + startProv + '"]');
    const selName = await page.textContent('#prov-name');
    check('browser: staged selection', selName === provinceLabel(state, startProv), selName + ' vs ' + provinceLabel(state, startProv));

    // 2. zoom in three times to 2
    let settled = true;
    for (let i = 0; i < 3; i++) settled = (await clickAndSettle('#btn-zoom-in')) && settled;
    pd = await page.evaluate(() => window.AshesPanDebug);
    check('browser: zoom 2 pannable, maxScrollLeft > 400', settled && pd.zoom === 2 && pd.pannable === true && pd.maxScrollLeft > 400,
      'settled=' + settled + ' zoom=' + pd.zoom + ' pannable=' + pd.pannable + ' maxScrollLeft=' + pd.maxScrollLeft);

    // 3. real drag with page.mouse: move left 400 px in steps. A bubble-phase
    // click counter on document proves the post-drag click is swallowed at
    // the viewport (pointer capture alone already keeps it off the tiles).
    await page.evaluate(() => {
      window.__panCheckClicks = 0;
      document.addEventListener('click', () => { window.__panCheckClicks++; });
    });
    const before = await page.evaluate(() => ({
      name: document.getElementById('prov-name').textContent,
      log: document.getElementById('log').children.length,
      selected: Array.prototype.map.call(document.querySelectorAll('.province.selected'), (n) => n.getAttribute('data-prov')).join(','),
      scrollLeft: document.getElementById('map-viewport').scrollLeft
    }));
    const vr = await page.evaluate(() => {
      const r = document.getElementById('map-viewport').getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const sx = Math.round(vr.left + vr.width * 0.8);
    const sy = Math.round(vr.top + Math.min(300, vr.height / 3));
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx - 400, sy, { steps: 20 });
    await page.mouse.up();
    const draggedOk = await H.waitFor(page, async () => {
      const s = await page.evaluate(() => ({ el: document.getElementById('map-viewport').scrollLeft, dbg: window.AshesPanDebug.scrollLeft }));
      return s.el - before.scrollLeft >= 200 && s.el === s.dbg;
    }, 5000);
    const afterDrag = await page.evaluate(() => ({
      el: document.getElementById('map-viewport').scrollLeft,
      dbg: window.AshesPanDebug.scrollLeft,
      dragging: document.getElementById('map-viewport').classList.contains('dragging')
    }));
    check('browser: drag pans east by at least 200', draggedOk && afterDrag.el - before.scrollLeft >= 200,
      'scrollLeft ' + before.scrollLeft + ' -> ' + afterDrag.el);
    check('browser: AshesPanDebug.scrollLeft matches element', afterDrag.dbg === afterDrag.el && !afterDrag.dragging,
      'dbg=' + afterDrag.dbg + ' el=' + afterDrag.el + ' dragging=' + afterDrag.dragging);

    // 4. the drag selected and ordered nothing
    const post = await page.evaluate(() => ({
      name: document.getElementById('prov-name').textContent,
      log: document.getElementById('log').children.length,
      selected: Array.prototype.map.call(document.querySelectorAll('.province.selected'), (n) => n.getAttribute('data-prov')).join(',')
    }));
    check('browser: drag left selection unchanged', post.name === before.name && post.selected === before.selected,
      post.name + ' [' + post.selected + '] vs ' + before.name + ' [' + before.selected + ']');
    check('browser: drag issued no order (war log length unchanged)', post.log === before.log, post.log + ' vs ' + before.log);
    const dragClicks = await page.evaluate(() => window.__panCheckClicks);
    check('browser: post-drag click swallowed before it bubbles', dragClicks === 0, 'document saw ' + dragClicks + ' clicks');

    // 5. a plain click on a tile in the panned view selects it. Prefer a tile
    // east of the unpanned view (proves the eastern half is reachable), not
    // reachable (no order), not selected, whose center hit lands on itself.
    const target = await page.evaluate(() => {
      const vp = document.getElementById('map-viewport');
      const v = vp.getBoundingClientRect();
      const board = document.getElementById('map-board').getBoundingClientRect();
      const cands = [];
      document.querySelectorAll('.province').forEach((t) => {
        if (t.classList.contains('selected') || t.classList.contains('reachable')) return;
        const r = t.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < v.left + 10 || cx > v.left + vp.clientWidth - 10 || cy < v.top + 10 || cy > v.top + vp.clientHeight - 10) return;
        const hit = document.elementFromPoint(cx, cy);
        const hitTile = hit && hit.closest ? hit.closest('.province') : null;
        if (hitTile !== t) return;
        cands.push({ id: t.getAttribute('data-prov'), cx: cx, cy: cy, east: (cx - board.left) > vp.clientWidth });
      });
      cands.sort((a, b) => (b.east ? 1 : 0) - (a.east ? 1 : 0));
      return cands[0] || null;
    });
    check('browser: found a clickable tile in the panned view', !!target, target ? (target.id + ' east=' + target.east) : 'none');
    if (target) {
      await page.mouse.click(target.cx, target.cy);
      const want = provinceLabel(state, target.id);
      const got = await H.waitFor(page, async () => (await page.textContent('#prov-name')) === want, 3000);
      const name = await page.textContent('#prov-name');
      check('browser: plain click after pan selects the tile', got === true, name + ' vs ' + want);
      const plainClicks = await page.evaluate(() => window.__panCheckClicks);
      check('browser: plain click is not swallowed', plainClicks === 1, 'document saw ' + plainClicks + ' clicks');
    } else {
      check('browser: plain click after pan selects the tile', false, 'no target');
      check('browser: plain click is not swallowed', false, 'no target');
    }

    // 6. reset returns to 100 percent, scroll 0, not pannable
    const resetSettled = await clickAndSettle('#btn-zoom-reset');
    await H.waitFor(page, async () => (await page.evaluate(() => window.AshesPanDebug.scrollLeft)) === 0, 3000);
    const rs = await page.evaluate(() => ({
      label: document.getElementById('zoom-label').textContent,
      el: document.getElementById('map-viewport').scrollLeft,
      pd: window.AshesPanDebug
    }));
    check('browser: reset to 100%, scrollLeft 0, not pannable',
      resetSettled && rs.label === 'Zoom 100%' && rs.el === 0 && rs.pd.scrollLeft === 0 && rs.pd.pannable === false && rs.pd.zoom === 1,
      rs.label + ' el=' + rs.el + ' dbg=' + rs.pd.scrollLeft + ' pannable=' + rs.pd.pannable);

    // 7. pan hint present and visible
    const hintText = await page.textContent('#pan-hint');
    const hintVisible = await page.isVisible('#pan-hint');
    check('browser: pan hint present and visible', hintVisible && hintText === PAN_HINT, hintVisible + ' ' + hintText);

    // 8. no page errors
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
