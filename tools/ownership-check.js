'use strict';
// Ashes of Empires, Cycle 23 Step 7a, ownership layer browser check (Step 7c adds fill checks).
// Proves: #map-state canvas exists, debug counts, pixel sampling, redraw discipline.
// Pattern from tools/map-canvas-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

async function main() {
  // ---------- Node part: compute expectations from seed 42 ----------
  const state = Sim.createGame(42);
  const view = playerView(state);
  const geom = MapGeom.buildGeometry(view);

  // Cycle 23 Step 7c: fill count and one live player and one live enemy province centre.
  const ownerLookup = {};
  view.provinces.forEach(function (p) {
    if (p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy')) ownerLookup[p.id] = p.owner;
  });
  const expectedFills = Object.keys(ownerLookup).length;
  const playerProv = geom.provinces.find(function (p) { return ownerLookup[p.id] === 'player'; });
  const enemyProv = geom.provinces.find(function (p) { return ownerLookup[p.id] === 'enemy'; });
  const centres = {
    mapW: geom.mapW,
    mapH: geom.mapH,
    player: { id: playerProv.id, x: playerProv.center.x, y: playerProv.center.y },
    enemy: { id: enemyProv.id, x: enemyProv.center.x, y: enemyProv.center.y }
  };

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

    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesStateDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);

    // 1. #map-state canvas exists in the DOM, has nonzero size, and z-index above #map-base
    const canvasCheck = await page.evaluate(() => {
      const stateCanvas = document.getElementById('map-state');
      const baseCanvas = document.getElementById('map-base');
      if (!stateCanvas || stateCanvas.tagName !== 'CANVAS') return { exists: false };
      const stateStyle = window.getComputedStyle(stateCanvas);
      const baseStyle = window.getComputedStyle(baseCanvas);
      const stateZ = parseInt(stateStyle.zIndex, 10) || 0;
      const baseZ = parseInt(baseStyle.zIndex, 10) || 0;
      return {
        exists: true,
        width: stateCanvas.width,
        height: stateCanvas.height,
        stateZ: stateZ,
        baseZ: baseZ,
        zIndexOk: stateZ > baseZ
      };
    });
    check('browser: #map-state canvas exists', canvasCheck.exists === true, String(canvasCheck.exists));
    check('browser: #map-state canvas has nonzero size', canvasCheck.width > 0 && canvasCheck.height > 0, canvasCheck.width + 'x' + canvasCheck.height);
    check('browser: #map-state z-index above #map-base', canvasCheck.zIndexOk === true, 'stateZ=' + canvasCheck.stateZ + ' baseZ=' + canvasCheck.baseZ);

    // 2. window.AshesStateDebug exists with bandOps > 0 and frontOps > 0
    const debugExists = await page.evaluate(() => typeof window.AshesStateDebug !== 'undefined');
    check('browser: AshesStateDebug exists', debugExists === true, String(debugExists));

    let dbg = await page.evaluate(() => window.AshesStateDebug);
    check('browser: AshesStateDebug.bandOps > 0', dbg.bandOps > 0, 'bandOps=' + dbg.bandOps);
    check('browser: AshesStateDebug.frontOps > 0', dbg.frontOps > 0, 'frontOps=' + dbg.frontOps);

    // 3. Pixel sampling: at least 100 strongly blue pixels (b > 150, b > r + 40) and at least 100 strongly red pixels (r > 120, r > b + 40)
    const pixelCounts = await page.evaluate(() => {
      const c = document.getElementById('map-state');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const data = img.data;
      let blueCount = 0;
      let redCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;
        // Strongly blue: b > 150, b > r + 40
        if (b > 150 && b > r + 40) blueCount++;
        // Strongly red: r > 120, r > b + 40
        if (r > 120 && r > b + 40) redCount++;
      }
      return { blueCount, redCount };
    });
    check('browser: at least 100 strongly blue pixels', pixelCounts.blueCount >= 100, 'blue=' + pixelCounts.blueCount);
    check('browser: at least 100 strongly red pixels', pixelCounts.redCount >= 100, 'red=' + pixelCounts.redCount);

    // Cycle 23 Step 7c: fill ops count, faint interior fill pixels, transparent live owner tiles
    check('browser: AshesStateDebug.fillOps equals node fill count', dbg.fillOps === expectedFills, 'fillOps=' + dbg.fillOps + ' expected=' + expectedFills);

    const centrePx = await page.evaluate((c) => {
      const cv = document.getElementById('map-state');
      const ctx = cv.getContext('2d');
      // Cell point to canvas pixel in chart space (Cycle 23 Step 9): the canvas
      // spans 12.6 by 9.85 cells with the lattice inset 1.3 left and top.
      function sample(pt) {
        const px = Math.floor((pt.x + 1.3) * cv.width / 12.6);
        const py = Math.floor((pt.y + 1.3) * cv.height / 9.85);
        const d = ctx.getImageData(px, py, 1, 1).data;
        return { px: px, py: py, r: d[0], g: d[1], b: d[2], a: d[3] };
      }
      return { player: sample(c.player), enemy: sample(c.enemy) };
    }, centres);
    const pc = centrePx.player;
    const ec = centrePx.enemy;
    check('browser: player province centre pixel is the faint blue fill',
      pc.a > 0 && pc.a <= 40 && pc.b > pc.r,
      centres.player.id + ' at ' + pc.px + ',' + pc.py + ' rgba=' + pc.r + ',' + pc.g + ',' + pc.b + ',' + pc.a);
    check('browser: enemy province centre pixel is the faint red fill',
      ec.a > 0 && ec.a <= 40 && ec.r > ec.b,
      centres.enemy.id + ' at ' + ec.px + ',' + ec.py + ' rgba=' + ec.r + ',' + ec.g + ',' + ec.b + ',' + ec.a);

    const tileBg = await page.evaluate(() => {
      const pt = document.querySelector('.province.owner-player.intel-live');
      const et = document.querySelector('.province.owner-enemy.intel-live');
      return {
        player: pt ? window.getComputedStyle(pt).backgroundColor : null,
        enemy: et ? window.getComputedStyle(et).backgroundColor : null
      };
    });
    check('browser: live owner tile background is fully transparent',
      tileBg.player === 'rgba(0, 0, 0, 0)' && tileBg.enemy === 'rgba(0, 0, 0, 0)',
      'player=' + tileBg.player + ' enemy=' + tileBg.enemy);

    // 4. Redraw discipline: read drawCount, click three different province tiles, read drawCount again, assert equal
    const drawCountBefore = await page.evaluate(() => window.AshesStateDebug.drawCount);
    // Click three different province tiles (re-query each time to avoid stale elements)
    for (let i = 0; i < 3; i++) {
      await page.evaluate((idx) => {
        const provinces = document.querySelectorAll('.province');
        if (provinces[idx]) provinces[idx].click();
      }, i);
      await H.waitFor(page, async () => {
        try {
          return await page.evaluate(() => typeof window.AshesStateDebug !== 'undefined');
        } catch (e) {
          return false;
        }
      }, 2000);
    }
    const drawCountAfter = await page.evaluate(() => window.AshesStateDebug.drawCount);
    check('browser: state drawCount unchanged after selection clicks', drawCountAfter === drawCountBefore, 'before=' + drawCountBefore + ' after=' + drawCountAfter);

    // 5. Save a screenshot
    await page.screenshot({ path: '/tmp/ownership-check.png', fullPage: true });
    check('browser: screenshot saved to /tmp/ownership-check.png', true, '');

    // 6. No page errors
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