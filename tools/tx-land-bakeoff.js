'use strict';
// Ashes of Empires, Cycle 23 Step 18c-2, the TX-LAND bake-off proof harness.
// For each TX-LAND bake-off candidate (art-direction/bakeoff/TX-LAND/
// candidate-a.png and candidate-b.png) this tool wires the candidate into a
// live board as the TX-LAND pattern per MAP_TREATMENT 7.3 (pattern over the
// land path, globalCompositeOperation 'soft-light', alpha 0.35) and scores the
// two remaining bake-off criteria of VISUAL_STRATEGY 6.3 / MAP_TREATMENT 7.4:
// (1) the band report in F02 for all three fog states, and (2) the F02-gray
// plaque battery, automated part.
//
// HARNESS APPLICATION CAVEAT. The game has no texture wiring yet (that is
// Step 19, which will wire the winner inside the chart-land draw op). This
// harness applies the candidate AFTER the real board renders: on the
// #map-base canvas context it traces the chart coastline polygon (the land
// path), clips to it, sets globalCompositeOperation 'soft-light' and
// globalAlpha 0.35, fills the whole canvas with createPattern(candidate,
// 'repeat') at the image's native 1024 px, and restores. So this draws over
// the finished base (relief and rivers included) clipped to the land path,
// where Step 19 wiring will draw at the chart-land position under relief. The
// band measurement is the same base-plus-fog composite tools/band-report.js
// measures, so the fog state bands are measured exactly as the shipped
// harness measures them.
//
// Coordinates. Computed in node from the real modules: view =
// playerView(Sim.createGame(42)); chart = AshesChart.buildChart(
// AshesMapGeometry.buildGeometry(view)); land path = chart.coastline (cell
// space); extent = chart.extent. A cell point maps to canvas device pixels as
// px = (x - x0) * (canvas.width / (x1 - x0)), py = (y - y0) * (canvas.height /
// (y1 - y0)), the same extent mapping tools/band-report.js measures with. The
// chart geometry is identical on both boards, so one land path serves both.
//
// Boards (as in tools/band-report.js):
// - F02: a fresh game at seed 42 (file:// index.html?seed=42), paused. Intel
//   counts live 43, remembered 0, dark 27.
// - fixture: tools/fixture/worst-case.json imported through the real save
//   path (in-page pause observer copied from band-report). Intel counts live
//   46, remembered 9, dark 15.
// Together the two boards cover all three fog states. The texture is applied
// on EACH board after it renders (F02 after pause; fixture after import and
// pause). AshesFogDebug counts are asserted equal to the node counts before
// and after each measurement, exactly as band-report does.
//
// Composite under measurement: #map-base (texture applied) with #map-fog drawn
// over it, one getImageData read per board. Rows, bands, and criteria are
// copied from tools/band-report.js: live 60 to 150, remembered 120 to 175,
// dark 185 to 225; a row passes when n >= 20 and both mean and median lie in
// band; state separation at least 25 on the mean of province row means (F02:
// live to dark; fixture: live to remembered and remembered to dark); global
// max composite luma under 225.
// BAND POINT per candidate: 1 only if every province and sea row on both
// boards passes, every separation check passes, both global max checks pass,
// all identity count checks pass, the texture was applied, and there are no
// page errors. Otherwise 0.
//
// Plaque battery (automated part), on the F02 board with the texture applied,
// adapted from the fresh-board assertions of tools/live-plaque-check.js: DOM
// plaque total, live, and hollow counts equal AshesPlaques.buildPlaques
// descriptor counts; live plaque numerals match the descriptors one for one
// and have the COUNTxSTRENGTH shape (a flotilla plaque carries none); no
// hollow plaque contains a digit; AshesPlaqueDebug matches the DOM counts; no
// .unit-chip remains in #map-board. PLAQUE POINT: 1 only if all pass.
//
// Gray capture. After the plaque assertions the #map-board element is
// screenshotted in color to /tmp/ashes-tx-bakeoff/F02-<c>.png, then with
// style filter grayscale(1) to /tmp/ashes-tx-bakeoff/F02-gray-<c>.png, and
// the filter is removed. This tool only produces the gray captures; the
// orchestrator reads them itself for the legibility read, which is not scored
// here.
//
// Output per candidate: a header line, the band tables for both boards, the
// plaque assertion lines (PASS | name | detail), the capture paths, and one
// machine readable line: SUMMARY {"candidate":..,"bandPoint":..,
// "plaquePoint":..,"bandFailures":..,"plaqueFailures":..}.
//
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// One browser launch per candidate.
// Exit 0 when the harness completes both candidates, whatever the points; 1
// when a candidate file is missing or not 1024x1024; 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const AshesPlaques = require('../js/plaques.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');
const BAKEOFF_DIR = path.join(REPO, 'art-direction', 'bakeoff', 'TX-LAND');
const CANDIDATES = ['a', 'b'];
const OUT_DIR = '/tmp/ashes-tx-bakeoff';
const TEX_SIZE = 1024;
const TEX_OP = 'soft-light';
const TEX_ALPHA = 0.35;

const BANDS = { live: [60, 150], remembered: [120, 175], dark: [185, 225] };
const STATES = ['live', 'remembered', 'dark'];
const MIN_N = 20;
const SEPARATION = 25;
const CEILING = 225;
const NUMERAL_RE = /^[0-9]+x[0-9]+$/;

// Results per candidate, split by criterion. check() writes to the current
// candidate's band or plaque list.
let current = null;
function check(kind, name, ok, detail) {
  current[kind].push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}
const band = (name, ok, detail) => check('band', name, ok, detail);
const plaque = (name, ok, detail) => check('plaque', name, ok, detail);

function intelCounts(view) {
  const counts = { live: 0, remembered: 0, dark: 0 };
  view.provinces.forEach((p) => { counts[p.intel]++; });
  return counts;
}

// PNG width and height from the IHDR chunk (bytes 16 to 23).
function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Copied from tools/band-report.js (buildRows): rows for one view, built from
// the real modules. Each row carries a list of polygons; a pixel belongs to
// the row when it lies in any of them.
function buildRows(view) {
  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(view));
  const intel = {};
  view.provinces.forEach((p) => { intel[p.id] = p.intel; });
  const rows = [];
  const seaParts = {};
  chart.sectors.forEach((s) => {
    if (!s.sea) return;
    if (!seaParts[s.provinceId]) seaParts[s.provinceId] = [];
    seaParts[s.provinceId].push(s.seaPart);
  });
  view.provinces.forEach((p) => {
    rows.push({ id: p.id, state: p.intel, polys: [chart.hitPolygons[p.id]], sea: false });
  });
  view.provinces.forEach((p) => {
    if (seaParts[p.id]) rows.push({ id: p.id + '#sea', state: intel[p.id], polys: seaParts[p.id], sea: true });
  });
  return { rows: rows, extent: chart.extent };
}

// Copied from tools/band-report.js (measure): composite #map-fog over
// #map-base once, read it once, and measure every row over every pixel whose
// centre lies in the row polygon set.
async function measure(page, built) {
  return page.evaluate(([ext, rows]) => {
    const base = document.getElementById('map-base');
    const fog = document.getElementById('map-fog');
    const W = base.width;
    const Hh = base.height;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = Hh;
    const g = off.getContext('2d');
    g.drawImage(base, 0, 0, W, Hh);
    g.drawImage(fog, 0, 0, W, Hh);
    const d = g.getImageData(0, 0, W, Hh).data;
    const L = new Float64Array(W * Hh);
    let globalMax = -1;
    let maxAt = null;
    for (let i = 0, k = 0; i < W * Hh; i++, k += 4) {
      const v = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
      L[i] = v;
      if (v > globalMax) { globalMax = v; maxAt = { x: i % W, y: Math.floor(i / W), r: d[k], g: d[k + 1], b: d[k + 2] }; }
    }
    // Point in polygon by ray casting.
    function inPoly(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    const sx = (ext.x1 - ext.x0) / W;
    const sy = (ext.y1 - ext.y0) / Hh;
    // Nearest rank percentile over a sorted array.
    function pct(a, p) { return a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))]; }
    const out = rows.map((row) => {
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      row.polys.forEach((poly) => poly.forEach((q) => {
        if (q.x < bx0) bx0 = q.x; if (q.x > bx1) bx1 = q.x;
        if (q.y < by0) by0 = q.y; if (q.y > by1) by1 = q.y;
      }));
      const i0 = Math.max(0, Math.floor((bx0 - ext.x0) / sx) - 1);
      const i1 = Math.min(W - 1, Math.ceil((bx1 - ext.x0) / sx) + 1);
      const j0 = Math.max(0, Math.floor((by0 - ext.y0) / sy) - 1);
      const j1 = Math.min(Hh - 1, Math.ceil((by1 - ext.y0) / sy) + 1);
      const vals = [];
      for (let j = j0; j <= j1; j++) {
        const cy = ext.y0 + (j + 0.5) * sy;
        for (let i = i0; i <= i1; i++) {
          const cx = ext.x0 + (i + 0.5) * sx;
          if (row.polys.some((poly) => inPoly(cx, cy, poly))) vals.push(L[j * W + i]);
        }
      }
      const n = vals.length;
      if (n === 0) return { id: row.id, n: 0 };
      let sum = 0;
      vals.forEach((v) => { sum += v; });
      vals.sort((a, b) => a - b);
      const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
      return { id: row.id, n: n, mean: sum / n, median: median, p5: pct(vals, 0.05), p95: pct(vals, 0.95) };
    });
    return { width: W, height: Hh, globalMax: globalMax, maxAt: maxAt, rows: out };
  }, [built.extent, built.rows.map((r) => ({ id: r.id, polys: r.polys }))]);
}

function f1(v) { return v === undefined ? '-' : v.toFixed(1); }

// Copied from tools/band-report.js (reportBoard): print the band table for
// one board and run its counted checks, all counted toward the band point.
function reportBoard(label, built, m, expectSep) {
  band(label + ': composite canvas has nonzero size', m.width > 0 && m.height > 0, m.width + 'x' + m.height);
  const means = { live: [], remembered: [], dark: [] };
  built.rows.forEach((row, idx) => {
    const r = m.rows[idx];
    const b = BANDS[row.state];
    const inBand = (v) => v !== undefined && v >= b[0] && v <= b[1];
    const ok = r.n >= MIN_N && inBand(r.mean) && inBand(r.median);
    band(label + ': ' + row.id + ' ' + row.state + ' band ' + b[0] + ' to ' + b[1], ok,
      'n=' + r.n + ' mean=' + f1(r.mean) + ' median=' + f1(r.median) + ' p5=' + f1(r.p5) + ' p95=' + f1(r.p95) +
      (r.n < MIN_N ? ' (n under ' + MIN_N + ')' : ''));
    if (!row.sea && r.n > 0) means[row.state].push(r.mean);
  });
  const stateMean = {};
  STATES.forEach((s) => {
    if (means[s].length) stateMean[s] = means[s].reduce((a, b) => a + b, 0) / means[s].length;
  });
  console.log(label + ': state means of province row means ' +
    STATES.filter((s) => stateMean[s] !== undefined).map((s) => s + '=' + stateMean[s].toFixed(1) + ' (' + means[s].length + ' rows)').join(' '));
  expectSep.forEach(([lo, hi]) => {
    const diff = stateMean[hi] - stateMean[lo];
    band(label + ': fog separation ' + hi + ' minus ' + lo + ' at least ' + SEPARATION,
      stateMean[lo] !== undefined && stateMean[hi] !== undefined && diff >= SEPARATION,
      'diff=' + (isNaN(diff) ? 'n/a' : diff.toFixed(1)));
  });
  band(label + ': global max composite luma under ' + CEILING, m.globalMax < CEILING,
    'max=' + m.globalMax.toFixed(1) + (m.maxAt ? ' at ' + m.maxAt.x + ',' + m.maxAt.y + ' rgb=' + m.maxAt.r + ',' + m.maxAt.g + ',' + m.maxAt.b : ''));
  const prov = built.rows.filter((r) => !r.sea).length;
  const sea = built.rows.length - prov;
  console.log(label + ': rows ' + built.rows.length + ' (province ' + prov + ', sea ' + sea + ')');
  return { prov: prov, sea: sea, globalMax: m.globalMax, stateMean: stateMean };
}

async function fogDebugCounts(page) {
  return page.evaluate(() => window.AshesFogDebug && window.AshesFogDebug.counts);
}

function sameCounts(a, b) {
  return !!a && !!b && a.live === b.live && a.remembered === b.remembered && a.dark === b.dark;
}

// Copied from tools/band-report.js (importSave), in-page pause observer
// included: it pauses as a microtask right after the load handler writes the
// Loaded notice, before any queued tick can move units.
async function importSave(page, savePath) {
  await H.dismissBurst(page);
  await page.evaluate(function () {
    var notice = document.getElementById('save-notice');
    var observer = new MutationObserver(function () {
      if (notice.textContent.trim().indexOf('Loaded') !== 0) return;
      observer.disconnect();
      var btn = document.getElementById('btn-pause');
      if (btn.textContent.trim() === 'Pause') btn.click();
    });
    observer.observe(notice, { childList: true, characterData: true, subtree: true });
  });
  const [chooser] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#btn-import') ]);
  await chooser.setFiles(savePath);
  await H.waitFor(page, async () => { const notice = (await page.textContent('#save-notice')).trim(); return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1; }, 5000);
  await H.ensurePaused(page);
  await H.dismissBurst(page);
  await page.evaluate(function () { window.scrollTo(0, 0); });
}

// The TX-LAND harness application (see the header caveat). Draws the
// candidate over the finished #map-base, clipped to the land path, in device
// pixels with an identity transform so the pattern tiles at native 1024 px.
// Returns the image size and how many base pixels the draw changed.
async function applyTexture(page, b64, land, ext) {
  return page.evaluate(async ([data, pts, e, op, alpha]) => {
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('candidate image failed to load'));
    });
    img.src = 'data:image/png;base64,' + data;
    await loaded;
    await img.decode();
    const canvas = document.getElementById('map-base');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const Hh = canvas.height;
    const before = ctx.getImageData(0, 0, W, Hh).data;
    const kx = W / (e.x1 - e.x0);
    const ky = Hh / (e.y1 - e.y0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = (p.x - e.x0) * kx;
      const py = (p.y - e.y0) * ky;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.createPattern(img, 'repeat');
    ctx.fillRect(0, 0, W, Hh);
    ctx.restore();
    const after = ctx.getImageData(0, 0, W, Hh).data;
    let changed = 0;
    for (let k = 0; k < after.length; k += 4) {
      if (after[k] !== before[k] || after[k + 1] !== before[k + 1] || after[k + 2] !== before[k + 2]) changed++;
    }
    return { width: img.naturalWidth, height: img.naturalHeight, canvasW: W, canvasH: Hh, changed: changed };
  }, [b64, land, ext, TEX_OP, TEX_ALPHA]);
}

async function textureStep(page, label, b64, land, ext) {
  const t = await applyTexture(page, b64, land, ext);
  band(label + ': texture applied (' + TEX_OP + ' alpha ' + TEX_ALPHA + ', native ' + TEX_SIZE + ' px, clipped to the land path)',
    t.width === TEX_SIZE && t.height === TEX_SIZE && t.changed > 0,
    'image=' + t.width + 'x' + t.height + ' canvas=' + t.canvasW + 'x' + t.canvasH + ' changedPixels=' + t.changed);
}

function descriptorCounts(view) {
  const plaques = AshesPlaques.buildPlaques(view).unitPlaques;
  const hollow = plaques.filter((d) => d.hollow).length;
  return {
    total: plaques.length,
    live: plaques.length - hollow,
    hollow: hollow,
    numerals: plaques.filter((d) => !d.hollow).map((d) => d.provinceId + '|' + d.nation + '|' + d.type + '|' + d.numeral).sort()
  };
}

// Adapted from tools/live-plaque-check.js (readBoard).
async function readPlaques(page) {
  return page.evaluate(() => {
    const board = document.getElementById('map-board');
    const plaques = Array.prototype.map.call(board.querySelectorAll('.plaque-layer .plaque'), (p) => {
      const num = p.querySelector('.numeral');
      return {
        province: p.dataset.province,
        nation: p.dataset.nation,
        type: p.dataset.type,
        hollow: p.classList.contains('plaque-hollow'),
        numeral: num ? num.textContent : null,
        text: p.textContent
      };
    });
    return { plaques: plaques, unitChips: board.querySelectorAll('.unit-chip').length, debug: window.AshesPlaqueDebug || null };
  });
}

// Fresh-board plaque assertions adapted from tools/live-plaque-check.js
// part A, run on the textured F02 board.
async function plaqueBattery(page, exp) {
  const a = await readPlaques(page);
  const hollowN = a.plaques.filter((p) => p.hollow).length;
  const c = { total: a.plaques.length, live: a.plaques.length - hollowN, hollow: hollowN };
  plaque('F02 plaques: DOM plaque counts equal node buildPlaques on fresh seed 42',
    c.total === exp.total && c.live === exp.live && c.hollow === exp.hollow,
    'dom=' + JSON.stringify(c) + ' node=' + JSON.stringify({ total: exp.total, live: exp.live, hollow: exp.hollow }));
  const badLive = a.plaques.filter((p) => !p.hollow && (p.type === 'flotilla' ? p.numeral !== null : !(p.numeral && NUMERAL_RE.test(p.numeral))));
  plaque('F02 plaques: every live unit plaque has a .numeral matching COUNTxSTRENGTH (flotilla plaques carry none)',
    a.plaques.some((p) => !p.hollow) && badLive.length === 0, 'bad=' + JSON.stringify(badLive.slice(0, 3)));
  const domNumerals = a.plaques.filter((p) => !p.hollow).map((p) => p.province + '|' + p.nation + '|' + p.type + '|' + p.numeral).sort();
  plaque('F02 plaques: live plaque numerals equal the node descriptor numerals one for one',
    JSON.stringify(domNumerals) === JSON.stringify(exp.numerals),
    'dom=' + domNumerals.slice(0, 4).join(',') + ' node=' + exp.numerals.slice(0, 4).join(','));
  const digitHollow = a.plaques.filter((p) => p.hollow && (/[0-9]/.test(p.text) || p.numeral !== null));
  plaque('F02 plaques: zero hollow plaques contain any digit or numeral', digitHollow.length === 0,
    'hollow=' + c.hollow + ' withDigits=' + digitHollow.length);
  plaque('F02 plaques: AshesPlaqueDebug matches the DOM counts',
    !!a.debug && a.debug.total === c.total && a.debug.live === c.live && a.debug.hollow === c.hollow,
    JSON.stringify(a.debug));
  plaque('F02 plaques: zero .unit-chip elements in #map-board', a.unitChips === 0, 'unitChips=' + a.unitChips);
}

async function runCandidate(chromium, cand, ctx) {
  current = { band: [], plaque: [] };
  const file = path.join(BAKEOFF_DIR, 'candidate-' + cand + '.png');
  const b64 = fs.readFileSync(file).toString('base64');
  console.log('');
  console.log('========== TX-LAND candidate ' + cand + ': ' + path.relative(REPO, file) +
    ' as ' + TEX_OP + ' alpha ' + TEX_ALPHA + ' over the land path ==========');
  console.log('boards: F02 covers live and dark; fixture covers live, remembered, and dark; together all three fog states');

  band('node: F02 seed 42 view counts are 43 live, 0 remembered, 27 dark',
    ctx.seedCounts.live === 43 && ctx.seedCounts.remembered === 0 && ctx.seedCounts.dark === 27,
    'live=' + ctx.seedCounts.live + ' remembered=' + ctx.seedCounts.remembered + ' dark=' + ctx.seedCounts.dark);
  band('node: fixture view counts are 46 live, 9 remembered, 15 dark',
    ctx.fixtureCounts.live === 46 && ctx.fixtureCounts.remembered === 9 && ctx.fixtureCounts.dark === 15,
    'live=' + ctx.fixtureCounts.live + ' remembered=' + ctx.fixtureCounts.remembered + ' dark=' + ctx.fixtureCounts.dark);
  band('node: land path has points and both boards share one chart extent',
    ctx.land.length > 2 && JSON.stringify(ctx.seedRows.extent) === JSON.stringify(ctx.fixtureRows.extent),
    'coastline=' + ctx.land.length + ' extent=' + JSON.stringify(ctx.extent));

  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const colorPath = path.join(OUT_DIR, 'F02-' + cand + '.png');
  const grayPath = path.join(OUT_DIR, 'F02-gray-' + cand + '.png');
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(HARNESS_URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => typeof window.AshesFogDebug !== 'undefined' && typeof window.AshesPlaqueDebug !== 'undefined');
      } catch (e) {
        return false;
      }
    }, 15000);

    // ----- Board A: F02, seed 42 -----
    console.log('--- band report, board F02 (candidate ' + cand + ') ---');
    const countsA = await fogDebugCounts(page);
    band('F02: AshesFogDebug counts equal node seed 42 counts', sameCounts(countsA, ctx.seedCounts), JSON.stringify(countsA));
    await textureStep(page, 'F02', b64, ctx.land, ctx.extent);
    const mA = await measure(page, ctx.seedRows);
    reportBoard('F02', ctx.seedRows, mA, [['live', 'dark']]);
    const countsA2 = await fogDebugCounts(page);
    band('F02: AshesFogDebug counts unchanged after the measurement', sameCounts(countsA2, ctx.seedCounts), JSON.stringify(countsA2));

    // ----- Plaque battery on the textured F02 board -----
    console.log('--- plaque battery, textured F02 (candidate ' + cand + ') ---');
    await plaqueBattery(page, ctx.plaqueExp);

    // ----- Captures: color, then grayscale(1) -----
    const boardEl = page.locator('#map-board');
    await boardEl.screenshot({ path: colorPath });
    await page.evaluate(() => { document.getElementById('map-board').style.filter = 'grayscale(1)'; });
    await boardEl.screenshot({ path: grayPath });
    await page.evaluate(() => { document.getElementById('map-board').style.filter = ''; });
    console.log('capture: color board ' + colorPath);
    console.log('capture: gray board ' + grayPath + ' (legibility read by the orchestrator, not scored here)');

    // ----- Board B: fixture -----
    console.log('--- band report, board fixture (candidate ' + cand + ') ---');
    await importSave(page, FIXTURE_PATH);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate(() => window.AshesFogDebug && window.AshesFogDebug.counts.remembered > 0);
      } catch (e) {
        return false;
      }
    }, 10000);
    const countsB = await fogDebugCounts(page);
    band('fixture: AshesFogDebug counts equal node fixture counts', sameCounts(countsB, ctx.fixtureCounts), JSON.stringify(countsB));
    await textureStep(page, 'fixture', b64, ctx.land, ctx.extent);
    const mB = await measure(page, ctx.fixtureRows);
    reportBoard('fixture', ctx.fixtureRows, mB, [['live', 'remembered'], ['remembered', 'dark']]);
    const countsB2 = await fogDebugCounts(page);
    band('fixture: AshesFogDebug counts unchanged after the measurement', sameCounts(countsB2, ctx.fixtureCounts), JSON.stringify(countsB2));

    band('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');
    await page.close();
  } finally {
    await browser.close();
  }

  const bandFailures = current.band.filter((ok) => !ok).length;
  const plaqueFailures = current.plaque.filter((ok) => !ok).length;
  console.log('candidate ' + cand + ': band checks ' + current.band.length + ', plaque checks ' + current.plaque.length);
  console.log('SUMMARY ' + JSON.stringify({
    candidate: cand,
    bandPoint: bandFailures === 0 ? 1 : 0,
    plaquePoint: plaqueFailures === 0 && current.plaque.length > 0 ? 1 : 0,
    bandFailures: bandFailures,
    plaqueFailures: plaqueFailures
  }));
}

async function main() {
  // ---------- Candidate files: present and 1024x1024 ----------
  let badFile = false;
  CANDIDATES.forEach((cand) => {
    const file = path.join(BAKEOFF_DIR, 'candidate-' + cand + '.png');
    if (!fs.existsSync(file)) {
      console.log('FAIL | candidate ' + cand + ' file present | missing ' + path.relative(REPO, file));
      badFile = true;
      return;
    }
    const size = pngSize(fs.readFileSync(file));
    const ok = !!size && size.width === TEX_SIZE && size.height === TEX_SIZE;
    console.log((ok ? 'PASS' : 'FAIL') + ' | candidate ' + cand + ' is a ' + TEX_SIZE + 'x' + TEX_SIZE + ' PNG | ' +
      (size ? size.width + 'x' + size.height : 'not a PNG'));
    if (!ok) badFile = true;
  });
  if (badFile) process.exit(1);

  // ---------- Node part: rows, land path, and plaque expectations ----------
  const seedView = playerView(Sim.createGame(42));
  const readBack = Save.deserializeSave(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  if (!readBack.ok) throw new Error('fixture does not read back: ' + (readBack.reason || ''));
  const fixtureView = playerView(readBack.state);
  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(seedView));
  const ctx = {
    seedCounts: intelCounts(seedView),
    fixtureCounts: intelCounts(fixtureView),
    seedRows: buildRows(seedView),
    fixtureRows: buildRows(fixtureView),
    land: chart.coastline.map((q) => ({ x: q.x, y: q.y })),
    extent: chart.extent,
    plaqueExp: descriptorCounts(playerView(Sim.createGame(42)))
  };

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = require(PW);
  for (const cand of CANDIDATES) await runCandidate(chromium, cand, ctx);
  process.exit(0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
