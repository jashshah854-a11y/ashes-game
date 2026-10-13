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
//   node tools/balance.js --profile sensible   one profile (repeatable)
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

function researchWhenReady(Sim, s) {
  const n = s.nations.player;
  if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
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
function makeSensible(withFactories) {
  return function sensible(Sim, s) {
    const n = s.nations.player;
    const row = s.provinces[n.capitalId].y;
    researchWhenReady(Sim, s);
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
      const mine = Sim.stackPower(s, massed, 'attack');
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

// ruling: 'win' must win above the floor, 'lose' must lose, 'report' is
// measured and printed but gates nothing. Since Cycle 6 step 4 (Jash's
// call: lines are paid before factories) building factories for more
// lines is the intended path, and the Cycle 5 sensible script, which
// never builds a factory, is kept as a report so its trend stays visible.
const PROFILES = {
  passive: { play: passive, ruling: 'lose', label: 'passive (never acts)' },
  sensible: { play: makeSensible(false), ruling: 'report', label: 'sensible without factories (Cycle 5 definition, rebuilt)' },
  factories: { play: makeSensible(true), ruling: 'win', label: 'sensible plus factories toward the next line' },
  reckless: { play: reckless, ruling: 'lose', label: 'reckless (open capital, piecemeal, no rail)' }
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
  while (!s.gameOver && s.day < MAX_DAYS) {
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
    lines: (s.nations.player.productionLines || []).length,
    enemyLines: (s.nations.enemy.productionLines || []).length,
    builtByLine, lineOpenDay,
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
          '  factory lvls ' + String(r.factoryLevels).padStart(2) + '  lines ' + r.lines +
          (r.lineOpenDay['3'] != null ? ' (L3 day ' + r.lineOpenDay['3'] + ')' : '') +
          '  built ' + (lines || 'none') + '  enemy lines ' + r.enemyLines);
      });
    } else {
      const losses = results.filter(r => r.winner !== 'player');
      console.log('  win days: ' + summarize(wins.map(r => r.day)));
      console.log('  loss days: ' + summarize(losses.map(r => r.day)));
      console.log('  end strength % on wins: ' + summarize(wins.map(r => r.endPercent)));
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
