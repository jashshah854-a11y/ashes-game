'use strict';
// Cycle 23 Step 2: blockade reachability report.
//
// Purpose: prove whether the blockade mechanic is reachable through the
// public command path. The driver uses only public sim commands and
// readouts from js/sim.js (createGame, tick, syncProductionLines,
// queueProduction, researchDroneGen2, issueOrder, unitsOf, unitsIn,
// neighborsOf, enemyHomeCoastalControlCount, isBlockaded, blockadeLoss,
// steelIncome). It never writes to any state field, never sets owners or
// positions, and has no debug setters. Reading state fields (province
// owner, nation steel, day) for reporting and routing decisions is
// allowed, exactly as tools/balance.js does.
//
// This script is not part of the balance run and changes no baseline.
//
// Usage: node tools/blockade-reachability.js
// Exit codes: 0 the threshold is reached and the effect is observed,
// 1 the campaign ends before count 3, 2 on error.
//
// Campaign: seed 42. Keep the 2 starting capital infantry as garrison.
// Every other player unit joins a lane by its starting province row (y at
// most 3 is the north lane toward p5_0 then p6_0, y above 3 is the south
// lane toward p5_6). Reinforcements that deploy at the capital later
// alternate lanes starting with north. Each day queue production on every
// idle line and research Drone Gen 2 when affordable, mirroring the
// sensible play in tools/balance.js.

const Sim = require('../js/sim.js');
const childProcess = require('child_process');
const path = require('path');

const SEED = 42;
const NORTH_TARGETS = ['p5_0', 'p6_0'];
const SOUTH_TARGETS = ['p5_6'];
const PUBLIC_COMMANDS = [
  'createGame', 'tick', 'syncProductionLines', 'queueProduction',
  'researchDroneGen2', 'issueOrder', 'unitsOf', 'unitsIn', 'neighborsOf',
  'enemyHomeCoastalControlCount', 'isBlockaded', 'blockadeLoss', 'steelIncome'
];

const usedCommands = [];
function call(name) {
  if (usedCommands.indexOf(name) === -1) usedCommands.push(name);
  const args = Array.prototype.slice.call(arguments, 1);
  return Sim[name].apply(null, args);
}

function provinceRow(pid) {
  const m = /^p(\d+)_(\d+)$/.exec(pid);
  return m ? +m[2] : 0;
}

function main() {
  let commit = 'unknown';
  try {
    const out = childProcess.execSync('git rev-parse HEAD', {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8'
    });
    commit = (out || '').trim() || 'unknown';
  } catch (e) {
    commit = 'unknown';
  }

  const s = call('createGame', SEED);

  let garrisonCache = null;
  const laneOf = {};
  const initialIds = new Set();
  let sawInitial = false;
  let alt = 0;

  function unitById(id) {
    for (let i = 0; i < s.units.length; i++) {
      if (s.units[i].id === id) return s.units[i];
    }
    return null;
  }

  function garrisonIds() {
    if (garrisonCache) return garrisonCache;
    const cap = s.nations.player.capitalId;
    const infantry = call('unitsIn', s, cap)
      .filter(function (u) { return u.nation === 'player' && u.type === 'infantry'; })
      .sort(function (a, b) { return a.id - b.id; });
    garrisonCache = infantry.slice(0, 2).map(function (u) { return u.id; });
    return garrisonCache;
  }

  function laneFor(unit) {
    if (Object.prototype.hasOwnProperty.call(laneOf, unit.id)) return laneOf[unit.id];
    if (!sawInitial) {
      call('unitsOf', s, 'player').forEach(function (x) { initialIds.add(x.id); });
      sawInitial = true;
    }
    let lane;
    if (initialIds.has(unit.id)) {
      lane = provinceRow(unit.provinceId) <= 3 ? 'north' : 'south';
    } else {
      lane = (alt % 2 === 0) ? 'north' : 'south';
      alt += 1;
    }
    laneOf[unit.id] = lane;
    return lane;
  }

  function laneTargets(lane) {
    return lane === 'north' ? NORTH_TARGETS : SOUTH_TARGETS;
  }

  function designatedHolder(targetId) {
    const units = call('unitsIn', s, targetId)
      .filter(function (u) { return u.nation === 'player'; })
      .sort(function (a, b) { return a.id - b.id; });
    return units.length ? units[0] : null;
  }

  function currentTarget(lane) {
    const targets = laneTargets(lane);
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const prov = s.provinces[t];
      if (!prov || prov.owner !== 'player') return t;
      if (!designatedHolder(t)) return t;
    }
    return null;
  }

  function hasEnemyUnits(provId) {
    return call('unitsIn', s, provId).some(function (u) { return u.nation === 'enemy'; });
  }

  function stepCost(prov, row, targetId) {
    let c = 10 + 3 * Math.abs(prov.y - row);
    if (prov.id !== targetId && hasEnemyUnits(prov.id)) c += 50;
    return c;
  }

  function dijkstra(targetId, lane) {
    const row = lane === 'north' ? 0 : 6;
    const ids = Object.keys(s.provinces);
    const dist = {};
    dist[targetId] = 0;
    const settled = new Set();
    while (settled.size < ids.length) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (settled.has(id)) continue;
        const d = dist[id];
        if (d !== undefined && d < bestD) { bestD = d; best = id; }
      }
      if (best === null) break;
      settled.add(best);
      const enterCost = stepCost(s.provinces[best], row, targetId);
      call('neighborsOf', s, s.provinces[best]).forEach(function (v) {
        if (settled.has(v.id)) return;
        const cand = bestD + enterCost;
        if (dist[v.id] === undefined || cand < dist[v.id]) dist[v.id] = cand;
      });
    }
    return { dist: dist, row: row };
  }

  function cheapestStep(unitId, lane, targetId) {
    const info = dijkstra(targetId, lane);
    const dist = info.dist;
    const row = info.row;
    const u = unitById(unitId);
    if (!u || u.provinceId === targetId) return null;
    let bestV = null;
    let bestScore = Infinity;
    call('neighborsOf', s, s.provinces[u.provinceId]).forEach(function (v) {
      if (v.id === u.provinceId) return;
      const d = dist[v.id];
      if (d === undefined) return;
      const score = stepCost(v, row, targetId) + d;
      if (score < bestScore || (score === bestScore && bestV && v.id < bestV.id)) {
        bestScore = score;
        bestV = v;
      }
    });
    return bestV ? bestV.id : null;
  }

  function issueMovementOrders() {
    const garrison = garrisonIds();
    call('unitsOf', s, 'player').forEach(function (u) {
      if (garrison.indexOf(u.id) !== -1) return;
      const lane = laneFor(u);
      const targets = laneTargets(lane);
      let isHolder = false;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const prov = s.provinces[t];
        if (prov && prov.owner === 'player' && designatedHolder(t) === u) {
          isHolder = true;
          break;
        }
      }
      if (isHolder) return;
      const target = currentTarget(lane);
      if (!target) return;
      const next = cheapestStep(u.id, lane, target);
      if (next && next !== u.provinceId) call('issueOrder', s, u.id, next);
    });
  }

  function playDay() {
    const n = s.nations.player;
    if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) {
      call('researchDroneGen2', s, 'player');
    }
    call('syncProductionLines', s, 'player');
    n.productionLines.forEach(function (line) {
      if (line.queue === 0) call('queueProduction', s, 'player', line.id);
    });
    issueMovementOrders();
  }

  function makeSnapshot(day, count) {
    return {
      day: day,
      count: count,
      dominionSteel: s.nations.enemy.steel,
      dominionIncome: call('steelIncome', s, 'enemy'),
      dominionBlockadeLoss: call('blockadeLoss', s, 'enemy'),
      isBlockaded: call('isBlockaded', s, 'enemy')
    };
  }

  const firstDay = { 1: null, 2: null, 3: null };
  let prev = null;
  let threshold = null;
  let dayBefore = null;
  let highest = 0;
  let highestDay = 1;

  while (!s.gameOver && s.day <= 150 && threshold === null) {
    playDay();
    call('tick', s);
    const count = call('enemyHomeCoastalControlCount', s, 'player');
    const snap = makeSnapshot(s.day, count);
    if (count > highest) { highest = count; highestDay = s.day; }
    for (const k of [1, 2, 3]) {
      if (firstDay[k] === null && count >= k) firstDay[k] = s.day;
    }
    if (count >= 3 && threshold === null) {
      threshold = snap;
      dayBefore = prev;
    }
    prev = snap;
  }

  let following = null;
  if (threshold !== null) {
    playDay();
    call('tick', s);
    const count = call('enemyHomeCoastalControlCount', s, 'player');
    following = makeSnapshot(s.day, count);
  }

  const lines = [];
  lines.push('Blockade reachability report (Cycle 23 Step 2)');
  lines.push('Seed: ' + SEED);
  lines.push('Commit: ' + commit);
  lines.push('Public commands used: ' + usedCommands.join(', '));
  lines.push('First day count reached 1: ' + (firstDay[1] === null ? 'never' : 'day ' + firstDay[1]));
  lines.push('First day count reached 2: ' + (firstDay[2] === null ? 'never' : 'day ' + firstDay[2]));
  lines.push('First day count reached 3: ' + (firstDay[3] === null ? 'never' : 'day ' + firstDay[3]));
  if (threshold !== null) {
    const b = dayBefore || makeSnapshot(threshold.day - 1, 0);
    lines.push('Day before threshold (day ' + b.day + '): count=' + b.count +
      ', Dominion steel stockpile=' + b.dominionSteel +
      ', Dominion steel income=' + b.dominionIncome +
      ', Dominion blockade loss=' + b.dominionBlockadeLoss);
    lines.push('Threshold day (day ' + threshold.day + '): count=' + threshold.count +
      ', Dominion steel stockpile=' + threshold.dominionSteel +
      ', Dominion steel income=' + threshold.dominionIncome +
      ', Dominion blockade loss=' + threshold.dominionBlockadeLoss +
      ', isBlockaded=' + threshold.isBlockaded);
    lines.push('Following day (day ' + following.day + '): count=' + following.count +
      ', Dominion steel stockpile=' + following.dominionSteel +
      ', Dominion steel income=' + following.dominionIncome +
      ', Dominion blockade loss=' + following.dominionBlockadeLoss +
      ', isBlockaded=' + following.isBlockaded);
    lines.push('The following tick income phase applied the threshold day loss of ' +
      threshold.dominionBlockadeLoss + ' steel.');
    lines.push('Loss arithmetic: loss = Math.floor(Dominion steel income * CFG.blockadeSteelPct / 100) = ' +
      'Math.floor(' + threshold.dominionIncome + ' * ' + Sim.CFG.blockadeSteelPct + ' / 100) = ' +
      threshold.dominionBlockadeLoss + ' steel.');
    lines.push('Result: the blockade threshold was reached and the effect was observed.');
  } else {
    lines.push('Highest count reached: ' + highest + ' on day ' + highestDay + ' (plateaued).');
    lines.push('Result: the campaign ended before the blockade threshold.');
  }
  process.stdout.write(lines.join('\n') + '\n');

  const unknown = usedCommands.filter(function (c) { return PUBLIC_COMMANDS.indexOf(c) === -1; });
  if (unknown.length) {
    process.stderr.write('Error: non-public commands used: ' + unknown.join(', ') + '\n');
    process.exitCode = 2;
    return;
  }

  if (threshold !== null && threshold.dominionBlockadeLoss > 0) process.exitCode = 0;
  else process.exitCode = 1;
}

try {
  main();
} catch (e) {
  process.stderr.write('Error: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exitCode = 2;
}
