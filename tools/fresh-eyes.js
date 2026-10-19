'use strict';
// Ashes of Empires, Cycle 23 Step 5b, fresh-eyes plaque viewer.
// Standalone node generation tool. Loads worst-case fixture, builds view and
// descriptors, selects 30 targets, renders 3 sheets of 10 in browser,
// captures color and grayscale screenshots, writes key.json.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js waiting patterns from plaque-check.js.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesPlaques = require('../js/plaques.js');
const H = require('./browser-helper.js');

const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');
const OUT_DIR = '/tmp/ashes-fresh-eyes';

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));

if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function provinceOrder(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

function selectTargets(descriptors, view) {
  const liveByType = {};
  descriptors.unitPlaques.filter(d => d.intel === 'live').forEach(d => {
    const key = d.nation + '|' + d.type;
    if (!liveByType[key]) liveByType[key] = [];
    liveByType[key].push(d);
  });

  const rememberedByType = {};
  descriptors.unitPlaques.filter(d => d.intel === 'remembered').forEach(d => {
    const key = d.nation + '|' + d.type;
    if (!rememberedByType[key]) rememberedByType[key] = [];
    rememberedByType[key].push(d);
  });

  const darkProvinces = view.provinces.filter(p => p.intel === 'dark').sort(provinceOrder);

  function take(key, n, bucket) {
    const arr = (bucket[key] || []).sort((a, b) => {
      if (a.provinceId !== b.provinceId) return a.provinceId.localeCompare(b.provinceId);
      return 0;
    });
    return arr.slice(0, n);
  }

  const targets = [];

  const livePlayerInfantry = take('player|infantry', 5, liveByType);
  const liveEnemyInfantry = take('enemy|infantry', 3, liveByType);
  const livePlayerDrone = take('player|drone', 3, liveByType);
  const liveEnemyDrone = take('enemy|drone', 5, liveByType);
  const liveEnemyFlotilla = take('enemy|flotilla', 5, liveByType);
  const rememberedEnemyInfantry = take('enemy|infantry', 1, rememberedByType);
  const rememberedEnemyDrone = take('enemy|drone', 2, rememberedByType);

  function pushTargets(arr, piece, owner, fog) {
    arr.forEach(d => targets.push({
      descriptor: d,
      piece: piece,
      owner: owner,
      fog: fog
    }));
  }

  pushTargets(livePlayerInfantry, 'infantry', 'player', 'live');
  pushTargets(liveEnemyInfantry, 'infantry', 'enemy', 'live');
  pushTargets(livePlayerDrone, 'drone', 'player', 'live');
  pushTargets(liveEnemyDrone, 'drone', 'enemy', 'live');
  pushTargets(liveEnemyFlotilla, 'flotilla', 'enemy', 'live');
  pushTargets(rememberedEnemyInfantry, 'infantry', 'enemy', 'remembered');
  pushTargets(rememberedEnemyDrone, 'drone', 'enemy', 'remembered');

  for (let i = 0; i < 6 && i < darkProvinces.length; i++) {
    const p = darkProvinces[i];
    targets.push({
      descriptor: { provinceId: p.id, x: p.x, y: p.y },
      piece: 'none',
      owner: 'none',
      fog: 'dark'
    });
  }

  return targets.slice(0, 30);
}

async function main() {
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  if (!readBack.ok) throw new Error('fixture deserialize failed: ' + readBack.reason);
  const s = readBack.state;
  const view = playerView(s);
  const descriptors = AshesPlaques.buildPlaques(view);

  const targets = selectTargets(descriptors, view);
  console.log('Selected ' + targets.length + ' targets');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });

  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 420 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const keyData = { sheet1: [], sheet2: [], sheet3: [] };

    for (let sheetIdx = 0; sheetIdx < 3; sheetIdx++) {
      const sheetTargets = targets.slice(sheetIdx * 10, sheetIdx * 10 + 10);
      const sheetName = 'sheet' + (sheetIdx + 1);

      const html = buildSheetHtml(sheetTargets, view, descriptors, sheetIdx);

      const sheetHtmlPath = path.join(OUT_DIR, sheetName + '.html');
      fs.writeFileSync(sheetHtmlPath, html);
      await page.goto('file://' + sheetHtmlPath, { waitUntil: 'domcontentloaded' });
      await H.waitFor(page, async () => {
        try {
          return await page.evaluate(() => document.fonts.ready.then(() => true));
        } catch (e) { return false; }
      }, 10000);

      const colorPath = path.join(OUT_DIR, sheetName + '-color.png');
      await page.screenshot({ path: colorPath, fullPage: false });

      await page.evaluate(() => {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(c => {
          const clone = c.querySelector('.board-clone');
          if (clone) clone.style.filter = 'grayscale(1)';
        });
      });

      const grayPath = path.join(OUT_DIR, sheetName + '-gray.png');
      await page.screenshot({ path: grayPath, fullPage: false });

      sheetTargets.forEach((t, i) => {
        keyData[sheetName].push({
          n: sheetIdx * 10 + i + 1,
          provinceId: t.descriptor.provinceId,
          piece: t.piece,
          owner: t.owner,
          fog: t.fog
        });
      });

      console.log(sheetName + ': ' + sheetTargets.length + ' cells, color=' + path.basename(colorPath) + ', gray=' + path.basename(grayPath));
    }

    const keyPath = path.join(OUT_DIR, 'key.json');
    fs.writeFileSync(keyPath, JSON.stringify(keyData, null, 2));
    console.log('Wrote key.json with ' + Object.keys(keyData).length + ' sheets');

  } finally {
    await browser.close();
  }
}

function buildSheetHtml(targets, view, descriptors, sheetIdx) {
  const boardWidth = 1000;
  const boardHeight = 700;
  const cellWidth = 300;
  const cellHeight = 210;
  const cellCenterX = 150;
  const cellCenterY = 105;
  const provinceScaleX = 100;
  const provinceScaleY = 100;

  const byProvince = {};
  descriptors.unitPlaques.forEach((d, index) => {
    const pid = d.provinceId;
    if (!byProvince[pid]) byProvince[pid] = [];
    byProvince[pid].push({ descriptor: d, index: index });
  });

  const offsetMap = {};
  Object.keys(byProvince).forEach(pid => {
    const group = byProvince[pid];
    const N = group.length;
    if (N > 1) {
      group.forEach((item, i) => {
        const offset = (i - (N - 1) / 2) * 22;
        offsetMap[item.index] = offset;
      });
    } else {
      offsetMap[group[0].index] = 0;
    }
  });

  let cellsHtml = '';
  targets.forEach((t, i) => {
    const desc = t.descriptor;
    const left = cellCenterX - (desc.x + 0.5) * provinceScaleX;
    const top = cellCenterY - (desc.y + 0.5) * provinceScaleY;

    let pinOffset = 0;
    if (t.fog !== 'dark') {
      const idx = descriptors.unitPlaques.findIndex(d => d === desc);
      if (idx >= 0) pinOffset = offsetMap[idx] || 0;
    }

    const pinTop = cellCenterY + pinOffset - 10;
    const pinLeft = cellCenterX + 16;

    const cellId = 'cell-' + sheetIdx + '-' + i;
    const cloneId = 'clone-' + sheetIdx + '-' + i;

    cellsHtml += `
      <div class="cell" id="${cellId}" style="width:${cellWidth}px;height:${cellHeight}px;background:#1a1d18;position:relative;overflow:hidden;border:1px solid #333;display:flex;flex-direction:column;">
        <div class="cell-number" style="position:absolute;top:4px;left:4px;font:10px monospace;color:#888;z-index:10;">${sheetIdx * 10 + i + 1}</div>
        <div class="board-clone" id="${cloneId}" style="position:absolute;left:${left}px;top:${top}px;width:${boardWidth}px;height:${boardHeight}px;background:#20241F;"></div>
        <div class="pin" style="position:absolute;left:${pinLeft}px;top:${pinTop}px;width:20px;height:20px;border-radius:50%;background:#000;border:2px solid #fff;color:#fff;font:bold 11px/20px monospace;text-align:center;z-index:5;">${sheetIdx * 10 + i + 1}</div>
      </div>`;
  });

  const plaquesScript = `
    (function() {
      var view = ${JSON.stringify(view)};
      var AshesPlaques = window.AshesPlaques;
      var descriptors = AshesPlaques.buildPlaques(view);
      ${targets.map((t, i) => `
        var clone${i} = document.getElementById('clone-${sheetIdx}-${i}');
        AshesPlaques.renderPlaques(clone${i}, view);
      `).join('\n')}
    })();
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fresh Eyes Sheet ${sheetIdx + 1}</title>
<style>
html,body{margin:0;padding:0;background:#000;}
.sheet{display:grid;grid-template-columns:repeat(5,300px);grid-template-rows:repeat(2,210px);gap:0;padding:0;background:#000;}
.cell{position:relative;}
.board-clone{position:absolute;}
.plaque-layer{position:absolute;inset:0;pointer-events:none;}
.plaque{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:2px;padding:1px 4px;font-family:"Barlow Semi Condensed",sans-serif;font-size:11px;line-height:1.2;color:#fff;}
.plaque.faction-player{background:#2E6FD8;border:1px solid #0B1E3A;}
.plaque.faction-enemy{background:#14161A;border:2px solid #C8372D;clip-path:polygon(4px 0,calc(100%-4px) 0,100% 4px,100% calc(100%-4px),calc(100%-4px) 100%,4px 100%,0 calc(100%-4px),0 4px);}
.plaque-hollow{background:transparent;color:#8A8A8A;border:1px dashed #8A8A8A;}
.plaque-hollow .glyph{opacity:0.65;color:#9A9A9A;}
.plaque .glyph svg{width:17px;height:17px;display:block;}
.plaque .alarm{color:#FFD94D;display:inline-flex;}
.building-mark{position:absolute;transform:translate(-50%,0);display:flex;gap:1px;font-family:"Barlow Semi Condensed",sans-serif;font-size:9px;color:#F2ECD9;background:rgba(0,0,0,0.55);padding:0 2px;}
</style>
<link rel="stylesheet" href="file://${REPO}/css/plaques.css">
</head><body>
<div class="sheet">${cellsHtml}</div>
<script src="file://${REPO}/js/sim.js"></script>
<script src="file://${REPO}/js/save.js"></script>
<script src="file://${REPO}/js/adapter.js"></script>
<script src="file://${REPO}/js/plaques.js"></script>
<script>${plaquesScript}</script>
</body></html>`;
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });