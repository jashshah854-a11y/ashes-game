// Ashes of Empires, balance harness.
//
// Scripted players that play full campaigns through the public command
// path only: queueProduction, researchDroneGen2, buildRail, buildFactory,
// issueOrder. No state edits, no teleports, no direct province flips.
// Each player acts once per day, then the real Sim.tick runs.
//
// Jash's balance ruling (2026-10-11, quoted in CYCLE_LOG.md): the intended
// play paths must win with at least 20 percent of starting friendly
// strength left, and passive and reckless play must lose. Each profile's
// role in that ruling is its `ruling` field below.
//
// Usage:
//   node tools/balance.js                      all profiles, the 8 standard seeds
//   node tools/balance.js --seeds 1-500        a seed range (mass testing)
//   node tools/balance.js --seeds 1,7,42       a seed list
//   node tools/balance.js --profile sensible   one profile (repeatable): passive,
//                     sensible, factories, fortress, reckless, rationed, direct, drones
//   node tools/balance.js --trace 42 --profile factories   day by day trace
//   node tools/balance.js --sim path/to/sim.js run against another sim build
//   node tools/balance.js --json               machine readable results
// Exit code 1 when any ruling check fails, so a script can gate on it.
'use strict';

const path = require('path');

const STANDARD_SEEDS = [1, 7, 42, 99, 1234, 555, 2024, 31337];
const FLOOR_PERCENT = 20;
const MAX_DAYS = 400; // the campaign ends at day 150; this is only a runaway guard

// ---------- Shared helpers ----------

function pid(Sim, x, y) { return Sim.provinceId(x, y); }

function playerUnits(Sim, s) { return Sim.unitsOf(s, 'player'); }

function totalStrength(units) { return units.reduce((a, u) => a + u.strength, 0); }

// Queue one order on every idle line. Lines that are open but idle get
// work; nothing is queued past one order per line, so steel is not
// committed far ahead of need.
function feedLines(Sim, s) {
  (s.nations.player.productionLines || []).forEach(line => {
    if (line.queue === 0) Sim.queueProduction(s, 'player', line.id);
  });
}

// Research: since Cycle 11 every script buys the next project in the same
// order the Dominion follows (CFG.aiResearchOrder), as soon as it has the
// points, so both sides research on one clock. Drone Gen 2 comes first, on
// the same day as before. Older sims without the research table buy Drone
// Gen 2 only.
function researchWhenReady(Sim, s) {
  const n = s.nations.player;
  if (!Sim.research) {
    if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
    return;
  }
  const next = Sim.CFG.aiResearchOrder.filter(id => !Sim.hasResearched(s, 'player', id))[0];
  if (next && n.researchPoints >= Sim.CFG.research[next].cost) Sim.research(s, 'player', next);
}

// Lay one rail edge per day from supplied ground into unsupplied owned
// ground, keeping a steel buffer so production is not starved by rail.
function railDiscipline(Sim, s, buffer) {
  const n = s.nations.player;
  if (n.steel < Sim.CFG.railCostSteel + buffer) return;
  const sup = Sim.computeSupply(s, 'player');
  const cands = s.edgeList.filter(e => {
    if (e.rail) return false;
    const a = s.provinces[e.a], b = s.provinces[e.b];
    if (a.owner !== 'player' || b.owner !== 'player') return false;
    const sa = sup[a.id] && sup[a.id].supplied, sb = sup[b.id] && sup[b.id].supplied;
    return sa !== sb;
  });
  // Prefer the capital row, then the easternmost edge: that is where the army is.
  const row = s.provinces[s.nations.player.capitalId].y;
  const score = e => {
    const a = s.provinces[e.a], b = s.provinces[e.b];
    return (a.y === row && b.y === row ? 100 : 0) + Math.max(a.x, b.x);
  };
  cands.sort((e1, e2) => score(e2) - score(e1) || (e1.a < e2.a ? -1 : 1));
  if (cands.length) Sim.buildRail(s, 'player', cands[0].a, cands[0].b);
}

// Raise factories toward the next locked production line only. Equipment
// buys nothing else, and every factory level eats steel daily, so levels
// beyond the last unlock would be pure steel drain. Cheapest builds first.
function factoriesTowardNextLine(Sim, s) {
  const CFG = Sim.CFG;
  if (!Sim.lineLockInfo) return; // sims before Cycle 6 have no line gating
  for (let guard = 0; guard < 10; guard++) {
    let nextLocked = null;
    for (let id = 1; id <= CFG.maxProductionLines; id++) {
      if (Sim.lineLockInfo(s, 'player', id)) { nextLocked = id; break; }
    }
    if (!nextLocked) return;
    const owned = Object.values(s.provinces)
      .filter(p => p.owner === 'player' && p.factoryLevel < CFG.maxFactoryLevel)
      .sort((a, b) => a.factoryLevel - b.factoryLevel || a.x - b.x || a.y - b.y);
    if (!owned.length) return;
    const res = Sim.buildFactory(s, 'player', owned[0].id);
    if (!res.ok) return;
  }
}

// Spend spare equipment on walls, one start per day: the capital first,
// then the staging province where the army masses. Runs after the factory
// builds, so lines still unlock first; walls get what equipment is left.
function fortifyHome(Sim, s, staging) {
  if (!Sim.buildFortification) return; // sims before Cycle 8 have no walls
  const targets = [s.nations.player.capitalId, staging];
  for (const id of targets) {
    const p = s.provinces[id];
    if (!p || p.owner !== 'player' || p.fortBuild || (p.fortLevel || 0) >= Sim.CFG.fortMaxLevel) continue;
    if (Sim.buildFortification(s, 'player', id).ok) return;
  }
}

// One step from `from` toward `to` through player owned provinces (BFS on
// the real graph). Returns the next province id, or null if unreachable.
function stepToward(Sim, s, from, to) {
  if (from === to) return null;
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    Sim.neighborsOf(s, s.provinces[cur]).forEach(np => {
      if (np.owner !== 'player' || prev[np.id] !== undefined) return;
      prev[np.id] = cur;
      queue.push(np.id);
    });
  }
  if (prev[to] === undefined) return null;
  let step = to;
  while (prev[step] !== from) step = prev[step];
  return step;
}

// ---------- Profiles ----------

// Passive: never issues a command.
function passive() {}

// Sensible (the Cycle 5 definition as CYCLE_LOG records it, rebuilt here
// because the Cycle 5 script itself was never committed):
// queues both lines when idle, researches Drone Gen 2, builds rail to
// unsupplied provinces with a steel buffer, keeps 2 capital infantry as a
// garrison, masses every other unit at the easternmost capital row
// province, and attacks only eastward along that row with 5 or more units
// massed and a 1.5x stackPower edge.
function makeSensible(withFactories, withForts, droneLines) {
  return function sensible(Sim, s) {
    const n = s.nations.player;
    const row = s.provinces[n.capitalId].y;
    researchWhenReady(Sim, s);
    // Drone heavy: every open line builds drone wings (retooling is free
    // while a line is idle, and a line keeps its template once set).
    if (droneLines) (n.productionLines || []).forEach(line => { if (line.template !== 'drone') Sim.assignLineTemplate(s, 'player', line.id, 'drone'); });
    if (withFactories) factoriesTowardNextLine(Sim, s);
    feedLines(Sim, s);
    railDiscipline(Sim, s, 40);

    const units = playerUnits(Sim, s);
    const garrison = new Set(units
      .filter(u => u.provinceId === n.capitalId && u.type === 'infantry')
      .sort((a, b) => a.id - b.id).slice(0, 2).map(u => u.id));

    let sx = -1;
    for (let x = 0; x < s.mapW; x++) if (s.provinces[pid(Sim, x, row)].owner === 'player') sx = x;
    const staging = pid(Sim, sx, row);
    if (withForts) fortifyHome(Sim, s, staging);

    // Orders are cleared by every movement phase, so a unit given no
    // order today simply holds; nothing here edits unit state directly.
    const field = units.filter(u => !garrison.has(u.id));
    field.forEach(u => {
      if (u.provinceId === staging) return;
      const step = stepToward(Sim, s, u.provinceId, staging);
      if (step) Sim.issueOrder(s, u.id, step);
    });

    const massed = field.filter(u => u.provinceId === staging);
    if (massed.length >= 5 && sx + 1 < s.mapW) {
      const target = pid(Sim, sx + 1, row);
      const defs = Sim.unitsIn(s, target).filter(d => d.nation === 'enemy');
      const mine = Sim.stackPower(s, massed, 'attack', target);
      if (!defs.length || mine >= 1.5 * Sim.stackPower(s, defs, 'defense')) {
        massed.forEach(u => Sim.issueOrder(s, u.id, target));
      }
    }
  };
}

// Reckless: abandons the capital lane (every unit on the capital marches
// north and never returns), attacks piecemeal (exactly one field unit
// moves or attacks per day, rotating, always eastward when it can), never
// builds rail. It still researches and queues production, so it is not a
// passive player in disguise.
function reckless(Sim, s, mem) {
  const n = s.nations.player;
  researchWhenReady(Sim, s);
  feedLines(Sim, s);
  const cap = s.provinces[n.capitalId];
  const north = pid(Sim, cap.x, cap.y - 1);
  const units = playerUnits(Sim, s);
  units.forEach(u => { if (u.provinceId === n.capitalId) Sim.issueOrder(s, u.id, north); });
  const field = units.filter(u => u.provinceId !== n.capitalId).sort((a, b) => a.id - b.id);
  if (!field.length) return;
  mem.turn = (mem.turn || 0) + 1;
  const u = field[mem.turn % field.length];
  const here = s.provinces[u.provinceId];
  const opts = Sim.neighborsOf(s, here).filter(p => p.id !== n.capitalId)
    .sort((a, b) => b.x - a.x || Math.abs(a.y - cap.y) - Math.abs(b.y - cap.y));
  if (opts.length && opts[0].x > here.x) Sim.issueOrder(s, u.id, opts[0].id);
}

// Vector's step 4 scripts, ported from its tools/balance.js (committed on
// master in 08435ad) in the Cycle 6 reconciliation, round 2, so one harness
// runs every profile. Logic is unchanged except that the garrison list is
// kept in the script's own memory instead of on the game state.
function neighborToward(Sim, s, unit, targetId) {
  const m = /^p(\d+)_(\d+)$/.exec(targetId);
  const t = { x: +m[1], y: +m[2] };
  const here = s.provinces[unit.provinceId];
  let best = null, bestScore = null;
  Sim.neighborsOf(s, here).forEach(p => {
    const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
    const score = d * 100 + Math.abs(p.y - 3) * 10 - p.x; // distance, then capital row, then east
    if (bestScore === null || score < bestScore) { bestScore = score; best = p; }
  });
  return best;
}

// Sensible with rationed factory builds: at most one factory per day, only
// in heartland provinces (x 4 or less), only below 16 total levels, and
// only when steel income covers the extra upkeep plus a full 3 line drain
// with headroom. Attacks also wait until no massed unit carries a supply
// penalty. Otherwise the same mass and push plan as the sensible profile.
function rationed(Sim, s, mem) {
  const n = s.nations.player;
  researchWhenReady(Sim, s);
  if (Sim.factoryLevels(s, 'player') < 16) {
    const income = Sim.steelIncome(s, 'player');
    const upkeepAfter = (Sim.factoryLevels(s, 'player') + 1) * Sim.CFG.steelPerFactoryLevel;
    if (income - upkeepAfter - 15 >= 5) {
      const owned = Object.values(s.provinces).filter(p => p.owner === 'player' && p.x <= 4 && p.factoryLevel < Sim.CFG.maxFactoryLevel);
      owned.sort((a, b) => (a.factoryLevel - b.factoryLevel) || (a.x - b.x));
      for (const p of owned) {
        if (n.equipment >= Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1)) { Sim.buildFactory(s, 'player', p.id); break; }
      }
    }
  }
  Sim.syncProductionLines(s, 'player');
  n.productionLines.forEach(line => { if (line.queue === 0) Sim.queueProduction(s, 'player', line.id); });
  if (n.steel >= 55) {
    const sup = Sim.computeSupply(s, 'player');
    const cands = [];
    s.edgeList.forEach(e => {
      if (e.rail) return;
      const pa = s.provinces[e.a], pb = s.provinces[e.b];
      if (pa.owner !== 'player' || pb.owner !== 'player') return;
      const aSup = sup[pa.id] && sup[pa.id].supplied, bSup = sup[pb.id] && sup[pb.id].supplied;
      if (aSup === bSup) return;
      cands.push(e);
    });
    cands.sort((e1, e2) => Math.max(s.provinces[e2.a].x, s.provinces[e2.b].x) - Math.max(s.provinces[e1.a].x, s.provinces[e1.b].x));
    if (cands.length) Sim.buildRail(s, 'player', cands[0].a, cands[0].b);
  }
  if (!mem.garrison) {
    mem.garrison = Sim.unitsIn(s, n.capitalId).filter(u => u.nation === 'player' && u.type === 'infantry').slice(0, 2).map(u => u.id);
  }
  const row3 = Object.values(s.provinces).filter(p => p.owner === 'player' && p.y === 3);
  row3.sort((a, b) => b.x - a.x);
  const staging = row3[0];
  if (!staging) return;
  const atStaging = Sim.unitsIn(s, staging.id).filter(u => u.nation === 'player' && !mem.garrison.includes(u.id));
  let attackTarget = null;
  if (atStaging.length >= 5 && atStaging.every(u => (u.supplyPenalty || 0) === 0)) {
    const east = s.provinces[Sim.provinceId(staging.x + 1, 3)];
    if (east && east.owner === 'enemy') {
      const defs = Sim.unitsIn(s, east.id).filter(u => u.nation === 'enemy');
      if (!defs.length || Sim.stackPower(s, atStaging, 'attack', east.id) >= Sim.stackPower(s, defs, 'defense') * 1.5) attackTarget = east.id;
    }
  }
  Sim.unitsOf(s, 'player').forEach(u => {
    if (mem.garrison.includes(u.id)) return;
    if (u.provinceId === staging.id) { if (attackTarget) Sim.issueOrder(s, u.id, attackTarget); return; }
    const next = neighborToward(Sim, s, u, staging.id);
    if (next && next.id !== u.provinceId && next.owner === 'player') Sim.issueOrder(s, u.id, next.id);
  });
}

// Reckless, direct march: vacates the capital north and never returns, and
// each day only the first living unit steps toward the enemy capital.
function recklessDirect(Sim, s) {
  const n = s.nations.player;
  researchWhenReady(Sim, s);
  Sim.syncProductionLines(s, 'player');
  n.productionLines.forEach(line => { if (line.queue === 0) Sim.queueProduction(s, 'player', line.id); });
  const capUnits = Sim.unitsIn(s, n.capitalId).filter(u => u.nation === 'player');
  if (capUnits.length) { capUnits.forEach(u => Sim.issueOrder(s, u.id, Sim.provinceId(0, 2))); return; }
  const actor = Sim.unitsOf(s, 'player')[0];
  if (actor) {
    const next = neighborToward(Sim, s, actor, s.nations.enemy.capitalId);
    if (next && next.id !== actor.provinceId) Sim.issueOrder(s, actor.id, next.id);
  }
}

// ruling: 'win' must win above the floor, 'lose' must lose, 'report' is
// measured and printed but gates nothing. Since Cycle 6 step 4 (Jash's
// call: lines are paid before factories) building factories for more
// lines is the intended path, and the Cycle 5 sensible script, which
// never builds a factory, is kept as a report so its trend stays visible.
const PROFILES = {
  passive: { play: passive, ruling: 'lose', label: 'passive (never acts)' },
  sensible: { play: makeSensible(false), ruling: 'report', label: 'sensible without factories (Cycle 5 definition, rebuilt)' },
  factories: { play: makeSensible(true), ruling: 'win', label: 'sensible plus factories toward the next line' },
  fortress: { play: makeSensible(true, true), ruling: 'win', label: 'sensible plus factories, then walls at home and at the staging province' },
  reckless: { play: reckless, ruling: 'lose', label: 'reckless (open capital, piecemeal, no rail)' },
  rationed: { play: rationed, ruling: 'win', label: 'sensible with rationed factory builds (Vector step 4 script)' },
  direct: { play: recklessDirect, ruling: 'lose', label: 'reckless direct march (Vector step 4 script)' },
  // Cycle 10: the steel exchange report. Same as factories, but every line
  // builds drone wings, so its attacks meet the Dominion's air defense.
  drones: { play: makeSensible(true, false, true), ruling: 'report', label: 'sensible plus factories, every line building drone wings (steel exchange report)' }
};

// ---------- One campaign ----------

function runGame(Sim, seed, profileName, opts) {
  opts = opts || {};
  const profile = PROFILES[profileName];
  const s = Sim.createGame(seed);
  const startUnits = playerUnits(Sim, s);
  const startIds = new Set(startUnits.map(u => u.id));
  const startStrength = totalStrength(startUnits);
  const mem = {};
  const builtByLine = {};
  const lineOpenDay = {};
  const trace = [];
  // Days the Dominion's air defense launched at you: whether that day's
  // attack on the province failed, and the steel each side bled that day.
  const intercepts = [];
  const bledNow = id => s.ledger ? s.ledger[id].lostSteel + s.ledger[id].launchSteel : 0;
  while (!s.gameOver && s.day < MAX_DAYS) {
    const youBefore = bledNow('player'), themBefore = bledNow('enemy');
    // Province names repeat on the map, so launches are matched to the
    // Dominion's air defense provinces by id, through their names.
    const adIds = Object.keys(s.provinces).filter(k => s.provinces[k].airDefense > 0 && s.provinces[k].owner === 'enemy');
    const day = s.day;
    const seen = new Set(s.log); // the log is capped, so diff by entry identity
    profile.play(Sim, s, mem);
    Sim.tick(s);
    const fresh = s.log.filter(e => !seen.has(e));
    fresh.forEach(e => {
      let m = /^Vessari line (\d+) completes/.exec(e.msg);
      if (m) builtByLine[m[1]] = (builtByLine[m[1]] || 0) + 1;
      m = /^Vessari open production line (\d+)/.exec(e.msg);
      if (m && lineOpenDay[m[1]] == null) lineOpenDay[m[1]] = day;
    });
    fresh.forEach(e => {
      const m = /^Khessite air defense at (.+?) (launches|cannot launch)/.exec(e.msg);
      if (!m) return;
      const ids = adIds.filter(k => s.provinces[k].name === m[1]);
      const taken = ids.some(k => s.provinces[k].owner === 'player');
      intercepts.push({ day, failed: !taken, you: bledNow('player') - youBefore, them: bledNow('enemy') - themBefore });
    });
    if (opts.trace) {
      const units = playerUnits(Sim, s);
      const n = s.nations.player;
      trace.push('day ' + String(day).padStart(3) +
        '  units ' + String(units.length).padStart(2) + '  str ' + String(totalStrength(units)).padStart(3) +
        '  steel ' + String(n.steel).padStart(4) + '  eq ' + String(n.equipment).padStart(4) +
        '  factory lvls ' + String(Sim.factoryLevels(s, 'player')).padStart(2) +
        '  lines ' + (n.productionLines || []).length +
        '  front x ' + frontX(Sim, s) +
        (fresh.length ? '\n         ' + fresh.map(e => e.msg).join('\n         ') : ''));
    }
  }
  // Lines opened at game start or before the first tick have no open day.
  const units = playerUnits(Sim, s);
  const endStrength = totalStrength(units);
  const originalLeft = totalStrength(units.filter(u => startIds.has(u.id)));
  return {
    seed, profile: profileName,
    // day is the counter shown when the campaign ends, the convention CYCLE_LOG uses.
    winner: s.winner, day: s.day, endReason: s.endReason,
    startStrength, endStrength,
    endPercent: Math.round(1000 * endStrength / startStrength) / 10,
    originalLeft,
    originalPercent: Math.round(1000 * originalLeft / startStrength) / 10,
    factoryLevels: Sim.factoryLevels(s, 'player'),
    endEquipment: s.nations.player.equipment,
    enemyEquipment: s.nations.enemy.equipment,
    lines: (s.nations.player.productionLines || []).length,
    enemyLines: (s.nations.enemy.productionLines || []).length,
    builtByLine, lineOpenDay,
    bled: Math.round(bledNow('player')), enemyBled: Math.round(bledNow('enemy')),
    launches: s.ledger ? s.ledger.enemy.launches : 0,
    intercepts,
    trace
  };
}

function frontX(Sim, s) {
  const row = s.provinces[s.nations.player.capitalId].y;
  let sx = -1;
  for (let x = 0; x < s.mapW; x++) if (s.provinces[pid(Sim, x, row)].owner === 'player') sx = x;
  return sx;
}

// ---------- Ruling checks ----------

function judge(profileName, results) {
  const p = PROFILES[profileName];
  const missed = results.filter(r => p.ruling === 'lose'
    ? r.winner === 'player'
    : !(r.winner === 'player' && r.endPercent >= FLOOR_PERCENT));
  const fails = p.ruling === 'report' ? [] : missed;
  return { pass: fails.length === 0, fails, missed };
}

// ---------- CLI ----------

function parseSeeds(spec) {
  const out = [];
  spec.split(',').forEach(part => {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) out.push(i); } else if (part.trim()) out.push(+part);
  });
  return out;
}

function summarize(nums) {
  if (!nums.length) return '-';
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return sorted[0] + ' to ' + sorted[sorted.length - 1] + ' (median ' + mid + ')';
}

function main(argv) {
  const args = { profiles: [], seeds: STANDARD_SEEDS, sim: path.join(__dirname, '..', 'js', 'sim.js') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seeds') args.seeds = parseSeeds(argv[++i]);
    else if (a === '--profile') args.profiles.push(argv[++i]);
    else if (a === '--sim') args.sim = path.resolve(argv[++i]);
    else if (a === '--trace') args.trace = +argv[++i];
    else if (a === '--json') args.json = true;
    else { console.error('unknown argument ' + a); process.exit(2); }
  }
  if (!args.profiles.length) args.profiles = Object.keys(PROFILES);
  args.profiles.forEach(p => { if (!PROFILES[p]) { console.error('unknown profile ' + p); process.exit(2); } });
  const Sim = require(args.sim);

  if (args.trace != null) {
    args.profiles.forEach(p => {
      const r = runGame(Sim, args.trace, p, { trace: true });
      console.log('# trace, seed ' + args.trace + ', ' + PROFILES[p].label);
      r.trace.forEach(line => console.log(line));
      console.log('# result: ' + r.winner + ' on day ' + r.day + '. ' + r.endReason);
    });
    return 0;
  }

  const all = {};
  let ok = true;
  args.profiles.forEach(p => {
    const results = args.seeds.map(seed => runGame(Sim, seed, p));
    const verdict = judge(p, results);
    if (!verdict.pass) ok = false;
    all[p] = { results: results.map(r => { const c = Object.assign({}, r); delete c.trace; return c; }), pass: verdict.pass };
    if (args.json) return;
    const wins = results.filter(r => r.winner === 'player');
    console.log('\n' + PROFILES[p].label + ': ' + wins.length + ' of ' + results.length + ' won. ' +
      (PROFILES[p].ruling === 'report'
        ? 'Report only, not a ruling path.'
        : 'Ruling check ' + (verdict.pass ? 'PASS' : 'FAIL') +
          ' (' + (PROFILES[p].ruling === 'win' ? 'must win with ' + FLOOR_PERCENT + '% strength left' : 'must lose') + ').'));
    if (results.length <= 20) {
      results.forEach(r => {
        const lines = Object.keys(r.builtByLine).sort().map(k => 'L' + k + ':' + r.builtByLine[k]).join(' ');
        console.log('  seed ' + String(r.seed).padStart(5) + '  ' + (r.winner === 'player' ? 'WIN ' : 'LOSS') +
          ' day ' + String(r.day).padStart(3) +
          '  end ' + String(r.endPercent).padStart(5) + '%  original army ' + String(r.originalPercent).padStart(5) + '%' +
          '  eq ' + String(r.endEquipment).padStart(5) + '/' + String(r.enemyEquipment).padStart(5) +
          '  factory lvls ' + String(r.factoryLevels).padStart(2) + '  lines ' + r.lines +
          (r.lineOpenDay['3'] != null ? ' (L3 day ' + r.lineOpenDay['3'] + ')' : '') +
          '  built ' + (lines || 'none') + '  enemy lines ' + r.enemyLines +
          '  bled ' + r.bled + '/' + r.enemyBled + (r.launches ? '  launches at you ' + r.launches : ''));
      });
    } else {
      const losses = results.filter(r => r.winner !== 'player');
      console.log('  win days: ' + summarize(wins.map(r => r.day)));
      console.log('  loss days: ' + summarize(losses.map(r => r.day)));
      console.log('  end strength % on wins: ' + summarize(wins.map(r => r.endPercent)));
      console.log('  end equipment, yours: ' + summarize(results.map(r => r.endEquipment)) + '; Dominion: ' + summarize(results.map(r => r.enemyEquipment)));
      console.log('  steel bled, yours: ' + summarize(results.map(r => r.bled)) + '; Dominion: ' + summarize(results.map(r => r.enemyBled)));
    }
    // The steel exchange on days the Dominion's air defense fired at you.
    const ix = [].concat.apply([], results.map(r => r.intercepts));
    if (ix.length) {
      const failed = ix.filter(i => i.failed);
      const failedWon = failed.filter(i => i.you < i.them);
      console.log('  air defense fired at you on ' + ix.length + ' days in ' + results.filter(r => r.intercepts.length).length +
        ' campaigns; ' + failed.length + ' of those attacks failed, and on ' + failedWon.length +
        ' of the failed ones you still bled less steel that day than the Dominion');
    }
    if (verdict.missed.length) {
      console.log('  ' + (verdict.pass ? 'seeds short of a floor win: ' : 'failing seeds: ') +
        verdict.missed.map(r => r.seed).join(', '));
    }
  });
  if (args.json) console.log(JSON.stringify(all, null, 1));
  else console.log('\nOverall: ' + (ok ? 'every ruling check passes.' : 'a ruling check FAILS.'));
  return ok ? 0 : 1;
}

module.exports = { PROFILES, STANDARD_SEEDS, runGame, judge };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
