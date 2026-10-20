'use strict';
// Ashes of Empires, Cycle 23 MAP_TREATMENT Step 16b, checkpoint 1 package
// capture of the F05 attack beat at zoom 2 in three beats.
// This tool changes nothing; it captures whatever the tree it runs in renders,
// and asserts the facts the checkpoint 1 acceptance sentence rests on.
//
// Stand-in: the storyboard F05 fixture (the first attack event after tick 300)
// does not exist as a fixture in this repo, so the package uses the
// tools/beat-check.js staged one tick attack as its stand-in, the same honesty
// pattern as the F04 stand-ins in Steps 12c and 14b. Staging copied from
// beat-check: seed 42 reduced to one player infantry at p4_3 (Torford) ordered
// to p5_3 (Kharmund) and one enemy infantry at p5_3, both interceptor stocks 0,
// serialized through js/save.js and imported through the real file input with
// the tools/fixture-check.js in-page pause observer.
//
// Phase freeze: the game's own 300 and 900 ms phase callbacks (js/main.js
// deriveBeats) are held by the harness and invoked in order, so each phase can
// be screenshotted. An in-page wrapper on window.setTimeout captures calls with
// delay exactly 300 or exactly 900 while window.__freezeBeats is true; every
// other call passes through to the original. No frame is altered, only held.
//
// Frames (panned viewport clips at zoom 2, reached through the real
// #btn-zoom-in control; viewport 1280 by 1750, deviceScaleFactor 1):
//   F05-beat0.png  start: attack declared, no light yet (day D, paused).
//   F05-beat1.png  peak flash: phase 1 held after the one day tick.
//   F05-beat2.png  settle: phase 2 (the fade), counts final.
// At zoom 2 #map-viewport clips the board (overflow hidden), and the game
// itself offers no pan control at zoom. The harness frames the attacked edge
// by setting the map viewport's scrollLeft so the attacked edge half arc
// midpoint (board fractions fx, fy from the chart extent) sits at the
// horizontal centre, then takes page screenshots clipped to the visible
// viewport width and 620 px of height around fy. That missing pan control is
// a finding the package README records; this tool neither fixes nor hides it.
// This is harness framing only; no game rendering changes.
//
// Node derivation, pathMidpoint, findChartEdge and the beats canvas sampler
// copied from tools/beat-check.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// getImageData is used here in the CHECK only, never in the frame path.
//
// Usage: node tools/beat-capture.js <outDir>
//   outDir defaults to /tmp/ashes-beat-capture; created if missing.
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesBeats = require('../js/beats.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesChart = require('../js/map-chart.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'index.html') + '?seed=42';
const SAVE_PATH = '/tmp/beat-capture-staged.json';

const OUT_DIR = process.argv[2] || '/tmp/ashes-beat-capture';
const BEAT0_PATH = path.join(OUT_DIR, 'F05-beat0.png');
const BEAT1_PATH = path.join(OUT_DIR, 'F05-beat1.png');
const BEAT2_PATH = path.join(OUT_DIR, 'F05-beat2.png');
const CLIP_HALF_HEIGHT = 310;

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

// ---------- Staging in node (copied from tools/beat-check.js) ----------
const FROM = Sim.provinceId(4, 3);
const TO = Sim.provinceId(5, 3);
const staged = Sim.createGame(42);
staged.units = staged.units.filter((u) =>
  (u.provinceId === FROM && u.nation === 'player' && u.type === 'infantry') ||
  (u.provinceId === TO && u.nation === 'enemy' && u.type === 'infantry'));
staged.nations.player.interceptors = 0;
staged.nations.enemy.interceptors = 0;
const attacker = staged.units.find((u) => u.nation === 'player');
Sim.issueOrder(staged, attacker.id, TO);
const stagedText = Save.serializeSave(staged).text;

// Plaque numeral for one nation's infantry in one province, the way
// js/plaques.js groups it: count x total strength.
function numeralOf(units, pid, nation) {
  const group = units.filter((u) => u.provinceId === pid && u.nation === nation && u.type === 'infantry');
  if (!group.length) return null;
  return group.length + 'x' + group.reduce((sum, u) => sum + u.strength, 0);
}

// The identical derivation js/main.js runs in the timer callback, on a clone
// of the staged state read back through the same save path the page uses.
// Also returns the post-tick state for the post-tick facts.
function nodeDerivation() {
  const s = Save.deserializeSave(stagedText).state;
  const fightDay = s.day;
  const snapshot = s.units.map((u) => ({ id: u.id, nation: u.nation, provinceId: u.provinceId, orderTarget: u.order ? u.order.target : null }));
  const tail = s.log.length ? s.log[s.log.length - 1] : null;
  Sim.tick(s);
  const idx = tail ? s.log.indexOf(tail) : -1;
  const fresh = (tail && idx === -1)
    ? s.log.filter((en) => en.day === fightDay && en.battle)
    : s.log.slice(idx + 1);
  const records = fresh.filter((en) => en.battle).map((en) => en.battle);
  const neighbors = {};
  Object.keys(s.provinces).forEach((pid) => {
    neighbors[pid] = Sim.neighborsOf(s, s.provinces[pid]).map((p) => p.id);
  });
  const edges = AshesBeats.deriveBeatEdges({ fightDay: fightDay, snapshot: snapshot, records: records, postUnits: s.units, neighbors: neighbors })
    .filter((e) => Sim.intelState(s, 'player', e.a) === 'live' || Sim.intelState(s, 'player', e.b) === 'live');
  return { fightDay: fightDay, records: records, edges: edges, post: s };
}

// Half arc length point of a chart edge path.
function pathMidpoint(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let half = total / 2;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (seg >= half && seg > 0) {
      const t = half / seg;
      return { x: points[i - 1].x + t * (points[i].x - points[i - 1].x), y: points[i - 1].y + t * (points[i].y - points[i - 1].y) };
    }
    half -= seg;
  }
  return points[points.length - 1];
}

function findChartEdge(chart, a, b) {
  return chart.chartEdges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

// In-page sampler source: max alpha over a 3 by 3 window of #map-beats at a
// chart point, through the shared chart extent. Adapted from beat-check to
// take its points as one args array, so it serves both page.evaluate and the
// in-page observer.
function sampleBeatsInPage(args) {
  const ext = args[0];
  const pts = args[1];
  const c = document.getElementById('map-beats');
  const g = c.getContext('2d');
  return pts.map(function (pt) {
    const x = Math.floor(((pt.x - ext.x0) / (ext.x1 - ext.x0)) * c.width);
    const y = Math.floor(((pt.y - ext.y0) / (ext.y1 - ext.y0)) * c.height);
    const d = g.getImageData(x - 1, y - 1, 3, 3).data;
    let a = 0;
    for (let k = 3; k < d.length; k += 4) a = Math.max(a, d[k]);
    return { x: x, y: y, a: a };
  });
}

// Minimal PNG IHDR read: signature, then the IHDR chunk with width and
// height as big endian 32 bit integers at bytes 16 and 20.
function pngSize(file) {
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

function sizeDetail(size) {
  return size ? size.width + 'x' + size.height + ' px, ' + size.bytes + ' bytes' : 'not a PNG';
}

// A captured frame is exactly the clip size.
function frameIsClip(size, clip) {
  return !!size && size.width === Math.round(clip.width) && size.height === 2 * CLIP_HALF_HEIGHT;
}

// Page rect of the first .plaque at a province, or null.
function plaqueRectInPage(pid) {
  var el = Array.prototype.slice.call(document.querySelectorAll('.plaque'))
    .filter(function (e) { return e.dataset.province === pid; })[0];
  if (!el) return null;
  var r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

function rectInClip(r, clip) {
  return !!r && r.left >= clip.x && r.right <= clip.x + clip.width && r.top >= clip.y && r.bottom <= clip.y + clip.height;
}

function rectDetail(r) {
  return r ? Math.round(r.left) + '..' + Math.round(r.right) + ' x ' + Math.round(r.top) + '..' + Math.round(r.bottom) : 'no plaque';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(SAVE_PATH, stagedText);

  // ---------- Node part ----------
  const pre = Save.deserializeSave(stagedText).state;
  const preFrom = numeralOf(pre.units, FROM, 'player');
  const preTo = numeralOf(pre.units, TO, 'enemy');
  check('node: pre-tick Torford (' + FROM + ') player infantry numeral is 1x12', preFrom === '1x12', 'numeral ' + preFrom);
  check('node: pre-tick Kharmund (' + TO + ') enemy infantry numeral is 1x12', preTo === '1x12', 'numeral ' + preTo);

  const derived = nodeDerivation();
  const post = derived.post;
  check('node: the staged tick writes a battle record at ' + TO, derived.records.some((r) => r.targetId === TO),
    derived.records.map((r) => r.kind + '@' + r.targetId + ' ' + r.aNation + '>' + r.bNation).join(', ') || 'none');
  check('node: the derivation lights exactly the edge ' + FROM + ' to ' + TO,
    derived.edges.length === 1 && derived.edges[0].a === FROM && derived.edges[0].b === TO, JSON.stringify(derived.edges));
  check('node: post-tick the attacker unit is gone', !post.units.some((u) => u.id === attacker.id), 'attacker ' + attacker.id);
  const defenders = post.units.filter((u) => u.provinceId === TO && u.nation === 'enemy');
  const postTo = numeralOf(post.units, TO, 'enemy');
  check('node: post-tick the defender at ' + TO + ' has strength 2', defenders.length === 1 && defenders[0].strength === 2,
    'numeral ' + postTo);
  check('node: post-tick Kharmund stays enemy owned', post.provinces[TO].owner === 'enemy', 'owner ' + post.provinces[TO].owner);
  const postFrom = numeralOf(post.units, FROM, 'player');

  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(playerView(Sim.createGame(42))));
  const ext = chart.extent;
  const litEdge = findChartEdge(chart, FROM, TO);
  const litKeys = {};
  derived.edges.forEach((e) => { litKeys[e.a + '|' + e.b] = true; });
  const litMid = litEdge ? pathMidpoint(litEdge.path) : null;
  // Control: the chart edge farthest from the attacked midpoint that no
  // derived edge lights (the same pick as beat-check).
  let control = null;
  let controlMid = null;
  if (litMid) {
    let best = -1;
    chart.chartEdges.forEach((e) => {
      const key = (e.a < e.b ? e.a + '|' + e.b : e.b + '|' + e.a);
      if (litKeys[key]) return;
      const m = pathMidpoint(e.path);
      const d = Math.hypot(m.x - litMid.x, m.y - litMid.y);
      if (d > best) { best = d; control = e; controlMid = m; }
    });
  }
  check('node: chart edge and control edge found', !!litEdge && !!control,
    (control ? 'control ' + control.a + '|' + control.b : 'none'));
  if (!litMid || !controlMid) throw new Error('no attacked chart edge midpoint; cannot sample or crop');
  const fx = (litMid.x - ext.x0) / (ext.x1 - ext.x0);
  const fy = (litMid.y - ext.y0) / (ext.y1 - ext.y0);
  check('node: attacked edge midpoint board fractions inside the board', fx > 0 && fx < 1 && fy > 0 && fy < 1,
    'fx=' + fx.toFixed(4) + ' fy=' + fy.toFixed(4));
  console.log('MIDPOINT | chart ' + litMid.x.toFixed(4) + ',' + litMid.y.toFixed(4) +
    ' | extent ' + JSON.stringify(ext) + ' | fx=' + fx.toFixed(4) + ' fy=' + fy.toFixed(4));
  const pts = [litMid, controlMid];

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1750 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(HARNESS_URL);
    await H.ensurePaused(page);
    await H.dismissBurst(page);

    // Import through the real file input with the fixture check's in-page
    // pause observer: it pauses as a microtask after the Loaded notice,
    // before any queued tick task.
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
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-import')]);
    await chooser.setFiles(SAVE_PATH);
    await H.waitFor(page, async () => {
      const notice = (await page.textContent('#save-notice')).trim();
      return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
    }, 5000);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    await page.evaluate(function () { window.scrollTo(0, 0); });

    const dayText = async () => parseInt((await page.textContent('#day-counter')).replace(/\D+/g, ''), 10);
    // Numeral text of every .plaque at a province (null for a plaque with no
    // numeral span).
    const plaqueNumerals = (pid) => page.evaluate(function (p) {
      return Array.prototype.slice.call(document.querySelectorAll('.plaque'))
        .filter(function (el) { return el.dataset.province === p; })
        .map(function (el) { var n = el.querySelector('.numeral'); return n ? n.textContent.trim() : null; });
    }, pid);

    const startDay = await dayText();
    check('page: the staged save loaded at the staged day', startDay === derived.fightDay, 'day ' + startDay);
    const preDebug = await page.evaluate(() => window.AshesBeatDebug);
    check('page: no beat after the load', !!preDebug && preDebug.edges.length === 0 && preDebug.phase === 0, JSON.stringify(preDebug));
    const preFromDom = await plaqueNumerals(FROM);
    const preToDom = await plaqueNumerals(TO);
    check('page: ' + FROM + ' plaque reads ' + preFrom, preFromDom.length === 1 && preFromDom[0] === preFrom, JSON.stringify(preFromDom));
    check('page: ' + TO + ' plaque reads ' + preTo, preToDom.length === 1 && preToDom[0] === preTo, JSON.stringify(preToDom));

    // ---------- Zoom to 2 through the real controls ----------
    const settleBefore = await page.evaluate(() => (window.AshesMapCanvasDebug ? window.AshesMapCanvasDebug.settleCount : 0));
    for (let i = 0; i < 3; i++) await page.click('#btn-zoom-in');
    const zoomed = await H.waitFor(page, async () => {
      const label = (await page.textContent('#zoom-label')).trim();
      const dbg = await page.evaluate(() => window.AshesMapCanvasDebug || null);
      return label === 'Zoom 200%' && !!dbg && dbg.zoom === 2 && dbg.settleCount > settleBefore;
    }, 5000);
    const zoomDbg = await page.evaluate(() => window.AshesMapCanvasDebug || null);
    check('page: zoom 200% reached and settled through #btn-zoom-in', zoomed,
      'label ' + (await page.textContent('#zoom-label')).trim() + ', zoom ' + (zoomDbg && zoomDbg.zoom) +
      ', settleCount ' + settleBefore + ' to ' + (zoomDbg && zoomDbg.settleCount));
    await H.ensurePaused(page);
    check('page: still at the staged day after zooming', (await dayText()) === startDay, 'day ' + (await dayText()));

    // At zoom 2 the board is wider than #map-viewport, which clips it
    // (overflow hidden, and the game offers no pan control). Harness framing:
    // pan the viewport through scrollLeft so the attacked midpoint sits at the
    // horizontal centre, then clip the page to the visible viewport.
    const pan = await page.evaluate(function (f) {
      var vp = document.getElementById('map-viewport');
      var max = vp.scrollWidth - vp.clientWidth;
      var target = Math.min(Math.max(Math.round(f * vp.scrollWidth - vp.clientWidth / 2), 0), Math.max(max, 0));
      vp.scrollLeft = target;
      var r = vp.getBoundingClientRect();
      return { target: target, actual: vp.scrollLeft, scrollWidth: vp.scrollWidth, clientWidth: vp.clientWidth,
        vpRect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    }, fx);
    check('page: #map-viewport panned to the target scrollLeft (within 2 px)', Math.abs(pan.actual - pan.target) <= 2,
      'target ' + pan.target + ', actual ' + pan.actual + ', scrollWidth ' + pan.scrollWidth + ', clientWidth ' + pan.clientWidth);
    const vpRect = pan.vpRect;
    const clip = { x: vpRect.x, y: Math.max(0, vpRect.y + fy * vpRect.height - CLIP_HALF_HEIGHT), width: vpRect.width, height: 2 * CLIP_HALF_HEIGHT };
    const midPageX = vpRect.x + fx * pan.scrollWidth - pan.actual;
    const clipCentreX = clip.x + clip.width / 2;
    console.log('PAN | scrollLeft target ' + pan.target + ' actual ' + pan.actual + ' | viewport rect ' + JSON.stringify(vpRect) +
      ' | clip ' + JSON.stringify(clip) + ' | midpoint page x ' + midPageX.toFixed(2) + ' vs clip centre ' + clipCentreX.toFixed(2));
    check('page: attacked midpoint page x inside the clip and within 4 px of its horizontal centre',
      midPageX >= clip.x && midPageX <= clip.x + clip.width && Math.abs(midPageX - clipCentreX) <= 4,
      'midpoint x ' + midPageX.toFixed(2) + ', clip centre ' + clipCentreX.toFixed(2));

    // ---------- Beat 0: attack declared, no light ----------
    await page.screenshot({ path: BEAT0_PATH, clip: clip });
    const beat0Sample = await page.evaluate(sampleBeatsInPage, [ext, pts]);
    check('beat0: attacked edge midpoint alpha 0 before the tick', beat0Sample[0].a === 0,
      'a=' + beat0Sample[0].a + ' at ' + beat0Sample[0].x + ',' + beat0Sample[0].y);
    const size0 = pngSize(BEAT0_PATH);
    check('beat0: ' + BEAT0_PATH + ' is exactly the clip, ' + Math.round(clip.width) + 'x' + clip.height + ' px',
      frameIsClip(size0, clip), sizeDetail(size0));
    const fromRect0 = await page.evaluate(plaqueRectInPage, FROM);
    const toRect0 = await page.evaluate(plaqueRectInPage, TO);
    check('beat0: ' + FROM + ' and ' + TO + ' plaques both fully inside the clip',
      rectInClip(fromRect0, clip) && rectInClip(toRect0, clip),
      FROM + ' ' + rectDetail(fromRect0) + ', ' + TO + ' ' + rectDetail(toRect0));

    // ---------- Freeze the beat phases, then the day sampler ----------
    await page.evaluate(function () {
      var original = window.setTimeout;
      window.__heldBeatTimers = [];
      window.__freezeBeats = false;
      window.setTimeout = function (fn, delay) {
        if (window.__freezeBeats && (delay === 300 || delay === 900)) {
          window.__heldBeatTimers.push({ fn: fn, delay: delay });
          return -window.__heldBeatTimers.length;
        }
        return original.apply(window, arguments);
      };
      window.__freezeBeats = true;
    });
    // The day counter observer from beat-check: render() writes the counter
    // inside the timer callback and the beat is drawn later in that same
    // callback, so the observer microtask sees the finished phase 1 frame. It
    // pauses there, so no second day can land before the outside Pause.
    await page.evaluate(function (args) {
      var sampler = new Function('args', 'return (' + args.src + ')(args.pts);');
      var counter = document.getElementById('day-counter');
      var observer = new MutationObserver(function () {
        // A same day rewrite (the Resume click re-renders) is not the tick.
        if (parseInt(counter.textContent.replace(/\D+/g, ''), 10) === args.startDay) return;
        observer.disconnect();
        var dbg = window.AshesBeatDebug;
        window.__beatLitSample = {
          phase: dbg ? dbg.phase : null,
          debug: dbg ? JSON.parse(JSON.stringify(dbg)) : null,
          samples: sampler({ src: args.src, pts: [args.ext, args.pts] })
        };
        var btn = document.getElementById('btn-pause');
        if (btn.textContent.trim() === 'Pause') btn.click();
      });
      observer.observe(counter, { childList: true, characterData: true, subtree: true });
    }, { src: sampleBeatsInPage.toString(), ext: ext, pts: pts, startDay: startDay });

    await page.click('#btn-pause'); // Resume
    const advanced = await H.waitFor(page, async () => (await dayText()) >= startDay + 1, 5000);
    await H.ensurePaused(page);
    await H.dismissBurst(page);
    const endDay = await dayText();
    check('page: the day counter advanced exactly one day', advanced && endDay === startDay + 1, startDay + ' to ' + endDay);

    // ---------- Beat 1: peak flash, phase 1 held ----------
    const dbg1 = await page.evaluate(() => window.AshesBeatDebug);
    check('beat1: AshesBeatDebug phase is 1 (held)', !!dbg1 && dbg1.phase === 1, JSON.stringify(dbg1));
    check('beat1: page edges deep equal the node derivation',
      !!dbg1 && JSON.stringify(dbg1.edges) === JSON.stringify(derived.edges),
      'page ' + JSON.stringify(dbg1 && dbg1.edges) + ' node ' + JSON.stringify(derived.edges));
    const held = await page.evaluate(() => window.__heldBeatTimers.map((t) => t.delay));
    check('beat1: exactly two phase timers held, delays 300 then 900', JSON.stringify(held) === '[300,900]', JSON.stringify(held));
    const lit = await page.evaluate(() => window.__beatLitSample || null);
    check('beat1: the in-page sample ran with phase 1', !!lit && lit.phase === 1, 'phase ' + (lit && lit.phase));
    if (lit) {
      check('beat1: attacked edge midpoint alpha above 0 (in-page sample)', lit.samples[0].a > 0,
        'a=' + lit.samples[0].a + ' at ' + lit.samples[0].x + ',' + lit.samples[0].y);
      check('beat1: control edge ' + control.a + '|' + control.b + ' midpoint alpha 0 (in-page sample)', lit.samples[1].a === 0,
        'a=' + lit.samples[1].a + ' at ' + lit.samples[1].x + ',' + lit.samples[1].y);
    }
    const postFromDom = await plaqueNumerals(FROM);
    const postToDom = await plaqueNumerals(TO);
    check('beat1: no plaque at ' + FROM + ' after the tick', postFromDom.length === 0 && postFrom === null, JSON.stringify(postFromDom));
    check('beat1: ' + TO + ' plaque reads ' + postTo + ' (expected 1x2)',
      postTo === '1x2' && postToDom.length === 1 && postToDom[0] === postTo, JSON.stringify(postToDom));
    // The same sampler on the held frame, so phase 1 and phase 2 compare like
    // for like.
    const phase1Sample = await page.evaluate(sampleBeatsInPage, [ext, pts]);
    await page.screenshot({ path: BEAT1_PATH, clip: clip });
    const phaseAtShot1 = await page.evaluate(() => window.AshesBeatDebug.phase);
    const size1 = pngSize(BEAT1_PATH);
    check('beat1: ' + BEAT1_PATH + ' captured while phase 1 is held, exactly the clip', phaseAtShot1 === 1 && frameIsClip(size1, clip),
      'phase ' + phaseAtShot1 + ', ' + sizeDetail(size1));
    const toRect1 = await page.evaluate(plaqueRectInPage, TO);
    check('beat1: ' + TO + ' plaque fully inside the clip', rectInClip(toRect1, clip), TO + ' ' + rectDetail(toRect1));

    // ---------- Beat 2: the fade, phase 2 ----------
    await page.evaluate(() => window.__heldBeatTimers[0].fn());
    const dbg2 = await page.evaluate(() => window.AshesBeatDebug);
    check('beat2: AshesBeatDebug phase is 2 after the held 300 ms callback', !!dbg2 && dbg2.phase === 2, JSON.stringify(dbg2));
    const phase2Sample = await page.evaluate(sampleBeatsInPage, [ext, pts]);
    const a1 = phase1Sample[0].a;
    const a2 = phase2Sample[0].a;
    // Strictly dimmer, unless the phase 1 sample saturated and phase 2 also
    // samples saturated, where dimmer or equal is the most the sampler shows.
    const saturated = a1 === 255 && a2 === 255;
    check('beat2: attacked edge midpoint alpha above 0 and dimmer than phase 1',
      a2 > 0 && (saturated ? a2 <= a1 : a2 < a1),
      'phase1 a=' + a1 + ' (in-page lit sample a=' + (lit ? lit.samples[0].a : 'none') + '), phase2 a=' + a2 + (saturated ? ', saturated rule' : ''));
    check('beat2: control edge midpoint alpha 0 in phase 2', phase2Sample[1].a === 0, 'a=' + phase2Sample[1].a);
    await page.screenshot({ path: BEAT2_PATH, clip: clip });
    const phaseAtShot2 = await page.evaluate(() => window.AshesBeatDebug.phase);
    const size2 = pngSize(BEAT2_PATH);
    check('beat2: ' + BEAT2_PATH + ' captured while phase 2 is held, exactly the clip', phaseAtShot2 === 2 && frameIsClip(size2, clip),
      'phase ' + phaseAtShot2 + ', ' + sizeDetail(size2));
    const postToDom2 = await plaqueNumerals(TO);
    check('beat2: counts final, ' + TO + ' plaque still reads ' + postTo, postToDom2.length === 1 && postToDom2[0] === postTo, JSON.stringify(postToDom2));

    // ---------- Dark: the held 900 ms callback ----------
    await page.evaluate(() => window.__heldBeatTimers[1].fn());
    const dbg3 = await page.evaluate(() => window.AshesBeatDebug);
    check('dark: phase returns to 0 after the held 900 ms callback', !!dbg3 && dbg3.phase === 0, JSON.stringify(dbg3));
    const darkSample = await page.evaluate(sampleBeatsInPage, [ext, pts]);
    check('dark: attacked edge midpoint alpha 0', darkSample[0].a === 0, 'a=' + darkSample[0].a);
    check('dark: the debug record keeps the day edges',
      !!dbg3 && JSON.stringify(dbg3.edges) === JSON.stringify(derived.edges) && dbg3.day === derived.fightDay, JSON.stringify(dbg3));
    await page.evaluate(() => { window.__freezeBeats = false; });

    check('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');

    await page.close();
  } finally {
    await browser.close();
  }

  console.log('FRAMES | ' + [BEAT0_PATH, BEAT1_PATH, BEAT2_PATH].map((f) => path.basename(f) + ' ' + sizeDetail(pngSize(f))).join(' | '));
  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
