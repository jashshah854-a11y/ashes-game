'use strict';
// A full campaign won through real browser clicks (Cycle 17), in headless
// Chromium through Playwright, against the unmodified index.html on seed 7
// at 1400 px. The page's js/sim.js is served with one addition that changes
// no rule: createGame records the state on window, so the driver can read
// what a player sees and confirm each click did what it meant.
// The driver plays the intended factories path, the rules of the harness's
// factories profile, but every action is a click on the page: research
// buttons, Queue buttons on idle lines, a province and Build / Upgrade
// Factory, a province and its Build rail button, and unit orders (Escape,
// the origin province until the unit is picked, then the target). Each
// day it pauses, acts, and presses Next day; event cards are continued.
// Exit: the player wins with at least 20 percent of its starting strength
// left, every order lands as clicked, and the page throws no errors.
// Usage: node tools/campaign-check.js [--seed 7]   (CHROME=..., PLAYWRIGHT=...)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const argSeed = process.argv.indexOf('--seed') !== -1 ? Number(process.argv[process.argv.indexOf('--seed') + 1]) : 7;
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=' + argSeed;

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// The planner runs in the page, reads the state, and names the next
// single action, or null when the day's work is done.
function planNext(day) {
  const S = window.AshesSim, s = window.__state, C = S.CFG, n = s.nations.player;
  window.__railDay = window.__railDay || {};
  // 1. Research, in the Dominion's order (the harness rule).
  const next = C.aiResearchOrder.filter((id) => !S.hasResearched(s, 'player', id))[0];
  if (next && n.researchPoints >= C.research[next].cost) return { type: 'research', id: next };
  // 2. Idle production lines.
  const idle = (n.productionLines || []).filter((l) => l.queue === 0)[0];
  if (idle) return { type: 'queue', line: idle.id };
  // 3. Factories toward the next locked line, cheapest first.
  let locked = null;
  for (let id = 1; id <= C.maxProductionLines; id++) { if (S.lineLockInfo(s, 'player', id)) { locked = id; break; } }
  if (locked) {
    const owned = Object.values(s.provinces).filter((p) => p.owner === 'player' && p.factoryLevel < C.maxFactoryLevel)
      .sort((a, b) => a.factoryLevel - b.factoryLevel || a.x - b.x || a.y - b.y);
    if (owned.length && n.equipment >= C.factoryCostPerLevel * (owned[0].factoryLevel + 1)) return { type: 'factory', prov: owned[0].id };
  }
  // 4. One rail edge a day from supplied into unsupplied owned ground.
  if (!window.__railDay[day] && n.steel >= C.railCostSteel + 40) {
    const sup = S.computeSupply(s, 'player');
    const row = s.provinces[n.capitalId].y;
    const cands = s.edgeList.filter((e) => {
      if (e.rail) return false;
      const a = s.provinces[e.a], b = s.provinces[e.b];
      if (a.owner !== 'player' || b.owner !== 'player') return false;
      return !!(sup[a.id] && sup[a.id].supplied) !== !!(sup[b.id] && sup[b.id].supplied);
    });
    const score = (e) => { const a = s.provinces[e.a], b = s.provinces[e.b]; return (a.y === row && b.y === row ? 100 : 0) + Math.max(a.x, b.x); };
    cands.sort((e1, e2) => score(e2) - score(e1) || (e1.a < e2.a ? -1 : 1));
    if (cands.length) {
      window.__railDay[day] = true;
      const e = cands[0];
      return { type: 'rail', from: e.a, to: e.b };
    }
  }
  // 5. Movement: two capital infantry hold; the rest mass at the
  // easternmost capital row province and attack east with 5 massed and a
  // 1.5x edge on the shared estimate.
  const row = s.provinces[n.capitalId].y;
  const units = S.unitsOf(s, 'player');
  const garrison = new Set(units.filter((u) => u.provinceId === n.capitalId && u.type === 'infantry').sort((a, b) => a.id - b.id).slice(0, 2).map((u) => u.id));
  let sx = -1;
  for (let x = 0; x < s.mapW; x++) if (s.provinces[S.provinceId(x, row)].owner === 'player') sx = x;
  const staging = S.provinceId(sx, row);
  const field = units.filter((u) => !garrison.has(u.id));
  const massed = field.filter((u) => u.provinceId === staging);
  if (massed.length >= 5 && sx + 1 < s.mapW) {
    const target = S.provinceId(sx + 1, row);
    const seen = S.seenUnitsIn(s, 'player', target);
    if (seen) {
      const defs = seen.filter((u) => u.nation === 'enemy');
      const mine = S.stackPower(s, massed, 'attack', target);
      if (!defs.length || mine >= 1.5 * S.stackPower(s, defs, 'defense')) {
        const u = massed.find((x) => !x.order);
        if (u) return { type: 'order', unit: u.id, from: u.provinceId, to: target };
      }
    }
  }
  for (const u of field) {
    if (u.order || u.provinceId === staging) continue;
    // One step toward the staging province through owned ground.
    const prev = {}; prev[u.provinceId] = null; const q = [u.provinceId];
    while (q.length) {
      const cur = q.shift(); if (cur === staging) break;
      S.neighborsOf(s, s.provinces[cur]).forEach((np) => { if (np.owner === 'player' && prev[np.id] === undefined) { prev[np.id] = cur; q.push(np.id); } });
    }
    if (prev[staging] === undefined) continue;
    let step = staging; while (prev[step] !== u.provinceId) step = prev[step];
    return { type: 'order', unit: u.id, from: u.provinceId, to: step };
  }
  return null;
}

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  let misfires = 0, clicks = 0, actions = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/js/sim.js', async (r) => {
      const src = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8') +
        '\n;(function(){var S=window.AshesSim,o=S.createGame;S.createGame=function(seed){var s=o(seed);window.__state=s;return s;};})();\n';
      await r.fulfill({ contentType: 'application/javascript', body: src });
    });
    await page.goto(URL);
    await page.click('#btn-pause');
    const start = await page.evaluate(() => window.AshesSim.unitsOf(window.__state, 'player').reduce((a, u) => a + u.strength, 0));
    const click = async (sel) => { clicks++; await page.click(sel); };
    for (let guard = 0; guard < 400; guard++) {
      if (await page.isVisible('#event-overlay')) { await click('#btn-event-continue'); continue; }
      const st = await page.evaluate(() => ({ over: window.__state.gameOver, day: window.__state.day }));
      if (st.over) break;
      // Act until the planner has nothing left today.
      for (let k = 0; k < 60; k++) {
        const a = await page.evaluate(planNext, st.day);
        if (!a) break;
        actions++;
        if (a.type === 'research') await click('#research-' + a.id);
        else if (a.type === 'queue') await click('[data-queue-line="' + a.line + '"]');
        else if (a.type === 'factory') { await click('[data-prov="' + a.prov + '"]'); await click('#btn-factory'); }
        else if (a.type === 'rail') {
          await page.keyboard.press('Escape');
          await click('[data-prov="' + a.from + '"]');
          await click('#rail-actions [data-rail-to="' + a.to + '"]');
        } else if (a.type === 'order') {
          await page.keyboard.press('Escape');
          const k2 = await page.evaluate((x) => window.AshesSim.unitsIn(window.__state, x.from).filter((u) => u.nation === 'player').findIndex((u) => u.id === x.unit), a);
          for (let c = 0; c <= k2; c++) await click('[data-prov="' + a.from + '"]');
          await click('[data-prov="' + a.to + '"]');
          const ok = await page.evaluate((x) => { const u = window.__state.units.find((v) => v.id === x.unit); return !!(u && u.order && u.order.target === x.to); }, a);
          if (!ok) { misfires++; break; }
        }
      }
      if (misfires) break;
      if (await page.isVisible('#event-overlay')) continue;
      await click('#btn-step');
    }
    const end = await page.evaluate(() => {
      const s = window.__state;
      return { over: s.gameOver, winner: s.winner, day: s.day, strength: window.AshesSim.unitsOf(s, 'player').reduce((a, u) => a + u.strength, 0),
        banner: document.getElementById('banner').textContent };
    });
    const pct = Math.round(1000 * end.strength / start) / 10;
    check('every order landed as clicked', misfires === 0, misfires + ' misfires');
    check('the campaign ends in a win for the player', end.over && end.winner === 'player', 'day ' + end.day + ', ' + end.banner);
    check('with at least 20 percent of the starting strength left', pct >= 20, pct + ' percent (' + end.strength + ' of ' + start + ')');
    console.log('seed ' + argSeed + ': ' + actions + ' actions in ' + clicks + ' clicks, won on day ' + end.day);
    await page.close();
    check('no page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
