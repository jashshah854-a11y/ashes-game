'use strict';
// Ashes of Empires, Cycle 23 Step 16a (MAP_TREATMENT 8.1 Step 16), attack
// beat browser check.
// Proves: one live tick of a staged attack lights the attacked edge on
// #map-beats, the page's beat edges equal the edges derived in node by the
// identical derivation (snapshot, one Sim.tick on a clone of the staged state,
// the tick's new battle records, the post-tick units, the neighbor map, the
// same fog gate through Sim.intelState), the lit edge midpoint has alpha above
// 0 while the beat phase is above 0, a control edge carries no light, and the
// light is gone once the phase returns to 0.
// Staging in the tools/battle-why-check.js pattern: seed 42 reduced to one
// player infantry at p4_3 ordered to p5_3 and one enemy infantry at p5_3, both
// interceptor stocks 0, serialized without running movementPhase.
// Harness from tools/fog-check.js; in-page pause observer from
// tools/fixture-check.js. Uses playwright-core from PLAYWRIGHT env var and
// Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// getImageData is used here in the CHECK only, never in the frame path.
// Usage: node tools/beat-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
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
const SAVE_PATH = '/tmp/beat-check-staged.json';
const SHOT_PATH = '/tmp/beat-check.png';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

// ---------- Staging in node ----------
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
fs.writeFileSync(SAVE_PATH, stagedText);

// The identical derivation js/main.js runs in the timer callback, on a clone
// of the staged state read back through the same save path the page uses.
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
  return { fightDay: fightDay, records: records, edges: edges };
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
// chart point, through the shared chart extent.
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

async function main() {
  // ---------- Node part ----------
  const derived = nodeDerivation();
  check('node: the staged tick writes a battle record', derived.records.length > 0,
    derived.records.map((r) => r.kind + '@' + r.targetId + ' ' + r.aNation + '>' + r.bNation).join(', ') || 'none');
  check('node: the derivation lights the staged edge ' + FROM + ' to ' + TO,
    derived.edges.some((e) => e.a === FROM && e.b === TO), JSON.stringify(derived.edges));

  const chart = AshesChart.buildChart(AshesMapGeometry.buildGeometry(playerView(Sim.createGame(42))));
  const ext = chart.extent;
  const litEdge = findChartEdge(chart, FROM, TO);
  const litKeys = {};
  derived.edges.forEach((e) => { litKeys[e.a + '|' + e.b] = true; });
  const litMid = litEdge ? pathMidpoint(litEdge.path) : null;
  // Control: the chart edge farthest from the attacked midpoint that no
  // derived edge lights.
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
    const startDay = await dayText();
    check('page: the staged save loaded at the staged day', startDay === derived.fightDay, 'day ' + startDay);
    const preDebug = await page.evaluate(() => window.AshesBeatDebug);
    check('page: no beat after the load', !!preDebug && preDebug.edges.length === 0 && preDebug.phase === 0, JSON.stringify(preDebug));

    // The beat lives 900 ms, which is also one day at speed 1, so the lit
    // sample is taken in page by an observer on the day counter: render()
    // writes the counter inside the timer callback and the beat is drawn
    // later in that same callback, so the observer microtask sees the
    // finished phase 1 frame. It also pauses there, so no second day can
    // land before the outside Pause.
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
          samples: sampler({ src: args.src, pts: [args.ext, args.pts] })
        };
        var btn = document.getElementById('btn-pause');
        if (btn.textContent.trim() === 'Pause') btn.click();
      });
      observer.observe(counter, { childList: true, characterData: true, subtree: true });
    }, { src: sampleBeatsInPage.toString(), ext: ext, pts: [litMid, controlMid], startDay: startDay });

    await page.click('#btn-pause'); // Resume
    const advanced = await H.waitFor(page, async () => (await dayText()) >= startDay + 1, 5000);
    await H.ensurePaused(page);
    const endDay = await dayText();
    check('page: the day counter advanced exactly one day', advanced && endDay === startDay + 1, startDay + ' to ' + endDay);

    let pageDebug = null;
    await H.waitFor(page, async () => {
      pageDebug = await page.evaluate(() => window.AshesBeatDebug);
      return !!pageDebug && pageDebug.edges.length > 0;
    }, 3000);
    check('page: AshesBeatDebug edges are non empty', !!pageDebug && pageDebug.edges.length > 0, JSON.stringify(pageDebug));
    check('page: the staged edge ' + FROM + ' to ' + TO + ' is in the page edges',
      !!pageDebug && pageDebug.edges.some((e) => e.a === FROM && e.b === TO), JSON.stringify(pageDebug && pageDebug.edges));
    check('page: page edges deep equal the node derivation',
      !!pageDebug && JSON.stringify(pageDebug.edges) === JSON.stringify(derived.edges),
      'page ' + JSON.stringify(pageDebug && pageDebug.edges) + ' node ' + JSON.stringify(derived.edges));
    check('page: AshesBeatDebug day is the fought day', !!pageDebug && pageDebug.day === derived.fightDay, 'day ' + (pageDebug && pageDebug.day));

    // Screenshot as close to the lit frame as the harness can get.
    const shotPhase = await page.evaluate(() => window.AshesBeatDebug.phase);
    await page.screenshot({ path: SHOT_PATH, fullPage: true });

    const lit = await page.evaluate(() => window.__beatLitSample || null);
    check('page: the in-page sample ran with the phase above 0', !!lit && lit.phase > 0, 'phase ' + (lit && lit.phase));
    if (lit) {
      check('page: attacked edge midpoint alpha above 0 while lit', lit.samples[0].a > 0,
        'a=' + lit.samples[0].a + ' at ' + lit.samples[0].x + ',' + lit.samples[0].y);
      check('page: control edge ' + control.a + '|' + control.b + ' midpoint alpha 0 while lit', lit.samples[1].a === 0,
        'a=' + lit.samples[1].a + ' at ' + lit.samples[1].x + ',' + lit.samples[1].y);
    }

    // Timers run while paused: the beat goes dark by itself.
    const dark = await H.waitFor(page, async () => (await page.evaluate(() => window.AshesBeatDebug.phase)) === 0, 3000);
    check('page: the beat phase returns to 0', dark, '');
    const after = await page.evaluate(sampleBeatsInPage, [ext, [litMid, controlMid]]);
    check('page: attacked edge midpoint alpha 0 after the phase returns to 0', after[0].a === 0, 'a=' + after[0].a);
    const afterDebug = await page.evaluate(() => window.AshesBeatDebug);
    check('page: the debug record keeps the day edges after the beat goes dark',
      JSON.stringify(afterDebug.edges) === JSON.stringify(derived.edges), JSON.stringify(afterDebug));

    check('page: screenshot saved to ' + SHOT_PATH, fs.existsSync(SHOT_PATH), 'phase at shot ' + shotPhase);
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
