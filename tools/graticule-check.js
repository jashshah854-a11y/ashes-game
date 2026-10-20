'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 13, graticule, degree border,
// scale bar, north arrow, and legend browser check (MAP_TREATMENT 4.1 to 4.4
// and 5.6).
// Proves, on seed 42 paused at the start: #map-chart-labels holds the 23
// border labels whose texts equal the node side expectation from the real
// modules; AshesFogDebug reports 9 furniture ops; the #map-fog canvas carries
// a graticule line in the sea margin (alpha on the line, none beside it); the
// #map-base canvas carries the scale bar (Ink first part, Paper second); the
// first #map-legend list is the 10 item treatment list; no chart label
// overlaps another or leaves the board; no page errors.
// Pattern from tools/labels-check.js. Uses playwright-core from PLAYWRIGHT
// env var (or ~/workspace/pwcore) and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// getImageData is used here in the CHECK only, never in the frame path.
// Screenshot: /tmp/graticule-check.png.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const MapGeom = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const MapCanvas = require('../js/map-canvas.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright', path.join(os.homedir(), 'workspace/pwcore/node_modules/playwright-core')]
    .find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const SHOT = '/tmp/graticule-check.png';

const LEGEND_FIRST = 'This is a map of the war. Blue is your nation, the Vessari Compact. Red is the Khessite Dominion.';
const LEGEND_LAST = 'Blank paper is land you have never seen, and paper sea is water you have not charted. A faded brown, hatched province is what you saw last time; it may have changed.';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

async function main() {
  // Node side expectations from the real modules.
  const view = playerView(Sim.createGame(42));
  const geom = MapGeom.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const furniture = MapCanvas.buildFurnitureOps(geom);
  const chartFurniture = MapCanvas.buildChartOps(chart).furniture;
  const SB = MapCanvas.SCALE_BAR;
  const mer = MapCanvas.GRATICULE_MERIDIANS;
  const par = MapCanvas.GRATICULE_PARALLELS;
  check('node: buildFurnitureOps gives 9 graticule ops', furniture.length === 9 && furniture.every((o) => o.kind === 'graticule'), String(furniture.length));
  const kindCount = {};
  chartFurniture.forEach((o) => { kindCount[o.kind] = (kindCount[o.kind] || 0) + 1; });
  check('node: chart furniture has 2 frames, 3 scale bar parts, 1 north arrow, and degree bar segments',
    kindCount['chart-frame'] === 2 && kindCount['chart-scale-bar'] === 3 && kindCount['chart-north-arrow'] === 1 && kindCount['chart-degree-bar'] > 0,
    JSON.stringify(kindCount));
  const expectedTexts = [];
  mer.forEach((m) => { expectedTexts.push(m.label, m.label); });
  par.forEach((p) => { expectedTexts.push(p.label, p.label); });
  expectedTexts.push('0', '100', '200 km', 'One province is about 220 km across.', 'N');
  expectedTexts.sort();

  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(HARNESS_URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await H.waitFor(page, async () => page.evaluate(() =>
      document.querySelectorAll('#map-chart-labels .chart-label').length > 0 && !!window.AshesFogDebug), 5000);

    const labels = await page.evaluate(() => {
      const board = document.getElementById('map-board').getBoundingClientRect();
      return {
        exists: !!document.getElementById('map-chart-labels'),
        spans: Array.prototype.map.call(document.querySelectorAll('#map-chart-labels span'), (n) => {
          const r = n.getBoundingClientRect();
          return { text: n.textContent, cls: n.className, l: r.left, t: r.top, r: r.right, b: r.bottom };
        }),
        board: { l: board.left, t: board.top, r: board.right, b: board.bottom }
      };
    });
    check('#map-chart-labels exists', labels.exists === true, String(labels.exists));
    check('#map-chart-labels holds exactly 23 spans', labels.spans.length === 23, String(labels.spans.length));
    const texts = labels.spans.map((s) => s.text).sort();
    check('chart label texts equal the expected set', JSON.stringify(texts) === JSON.stringify(expectedTexts), texts.join(', '));
    const outside = labels.spans.filter((s) => !(s.l >= labels.board.l - 0.5 && s.r <= labels.board.r + 0.5 && s.t >= labels.board.t - 0.5 && s.b <= labels.board.b + 0.5));
    check('every chart label lies inside the map board', outside.length === 0, outside.map((s) => s.text).join(', ') || 'none');
    const overlaps = [];
    for (let i = 0; i < labels.spans.length; i++) {
      for (let j = i + 1; j < labels.spans.length; j++) {
        const a = labels.spans[i];
        const b = labels.spans[j];
        if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps.push(a.text + ' x ' + b.text);
      }
    }
    check('no chart label overlaps another', overlaps.length === 0, overlaps.join('; ') || 'none');
    // Every degree label clears the 0.06 cell degree bar outside the neatline.
    const cellX = (labels.board.r - labels.board.l) / chart.widthCells;
    const cellY = (labels.board.b - labels.board.t) / chart.heightCells;
    const neat = chart.neatline;
    const bx = (x) => labels.board.l + (x + chart.insetX) * cellX;
    const by = (y) => labels.board.t + (y + chart.insetTop) * cellY;
    const onBar = labels.spans.filter((s) => s.cls.indexOf('degree-label') !== -1 || s.cls.indexOf('north-label') !== -1).filter((s) => {
      const barX0 = bx(neat.x0 - 0.06), barX1 = bx(neat.x1 + 0.06), barY0 = by(neat.y0 - 0.06), barY1 = by(neat.y1 + 0.06);
      // Inside the outer edge of the bar on any side means it touches the bar.
      return s.r > barX0 && s.l < barX1 && s.b > barY0 && s.t < barY1;
    });
    check('every degree label and the N clear the degree bar', onBar.length === 0,
      onBar.map((s) => s.text).join(', ') || 'none (' + cellX.toFixed(1) + ' css px per cell)');

    const furnitureOps = await page.evaluate(() => window.AshesFogDebug.furnitureOps);
    check('AshesFogDebug.furnitureOps is 9', furnitureOps === 9, String(furnitureOps));

    // Canvas pixel probes, in device px of each canvas over the chart extent.
    const probe = await page.evaluate((a) => {
      function at(id, x, y) {
        const c = document.getElementById(id);
        const sx = c.width / a.widthCells;
        const sy = c.height / a.heightCells;
        const px = Math.floor((x + a.insetX) * sx);
        const py = Math.floor((y + a.insetTop) * sy);
        return { c: c, sx: sx, px: px, py: py };
      }
      function rgba(c, px, py) { return Array.from(c.getContext('2d').getImageData(px, py, 1, 1).data); }
      const line = at('map-fog', a.merX, -0.5);
      let maxAlpha = 0;
      for (let dx = -3; dx <= 3; dx++) maxAlpha = Math.max(maxAlpha, rgba(line.c, line.px + dx, line.py)[3]);
      const off = at('map-fog', a.merX - 0.3, -0.5);
      const offPx = rgba(off.c, off.px, off.py);
      const ink = at('map-base', a.sbX + 0.1125, a.sbY + 0.0175);
      const paper = at('map-base', a.sbX + 0.3375, a.sbY + 0.0175);
      const luma = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      const inkPx = rgba(ink.c, ink.px, ink.py);
      const paperPx = rgba(paper.c, paper.px, paper.py);
      return { lineAlpha: maxAlpha, offAlpha: offPx[3], inkLuma: luma(inkPx), paperLuma: luma(paperPx), inkPx: inkPx, paperPx: paperPx, fogScale: line.sx };
    }, { widthCells: chart.widthCells, heightCells: chart.heightCells, insetX: chart.insetX, insetTop: chart.insetTop, merX: mer[0].x, sbX: SB.x, sbY: SB.y });
    check('fog canvas: the 10E meridian in the sea margin has alpha at least 40 within 3 px', probe.lineAlpha >= 40, 'alpha ' + probe.lineAlpha + ' at scale ' + probe.fogScale.toFixed(1));
    check('fog canvas: 0.3 cell west of the meridian the margin is transparent', probe.offAlpha === 0, 'alpha ' + probe.offAlpha);
    check('base canvas: scale bar first part is Ink (luma under 80)', probe.inkLuma < 80, probe.inkLuma.toFixed(1) + ' ' + probe.inkPx.join(','));
    check('base canvas: scale bar second part is Paper (luma over 180)', probe.paperLuma > 180, probe.paperLuma.toFixed(1) + ' ' + probe.paperPx.join(','));

    const legend = await page.evaluate(() => {
      const ul = document.querySelector('#map-legend ul.legend-list');
      const items = ul ? Array.prototype.map.call(ul.children, (li) => li.textContent.replace(/\s+/g, ' ').trim()) : [];
      return items;
    });
    check('first #map-legend list has exactly 10 items', legend.length === 10, String(legend.length));
    check('first legend item is the treatment sentence', legend[0] === LEGEND_FIRST, legend[0]);
    check('last legend item is the treatment sentence', legend[9] === LEGEND_LAST, legend[9]);

    await page.locator('#map-viewport').screenshot({ path: SHOT });
    check('screenshot saved to ' + SHOT, fs.existsSync(SHOT) && fs.statSync(SHOT).size > 0, SHOT);

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
