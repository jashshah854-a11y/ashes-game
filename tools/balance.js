'use strict';
// Balance harness for the standard balance rerun (Cycle 6 step 5, judge
// fix-now flag 3: the harness now lives in the repo so balance numbers are
// reproducible from repo contents alone).
// Provenance: reconstructed in Cycle 6 step 5 from the step 4 working
// harness (/tmp/dbg2.js, the step 4 harness core) plus the reportDay and
// origStrengthPct fields the step 4 final run recorded in its stored
// output. Verified in step 5: this file reproduces the step 4 stored
// output (/tmp/balance-final.txt) on every numeric field for all three
// profiles on all 8 standard seeds.
// Usage: node tools/balance.js [passive|sensible|reckless|reckless-reinforce|fortress|all]
// Profiles use only public sim commands (queueProduction, buildFactory,
// buildRail, buildFortification, researchDroneGen2, issueOrder,
// reinforceUnit). No state edits.
// The fortress profile and the endEquipment fields were added in
// Cycle 8 step 3, in this harness's shape: fortress is the sensible
// script plus walls, and every report now carries both nations' end
// equipment, so a fortifying path's equipment spend is visible.
// The exchange fields were added in Cycle 12 step 3, in the same
// shape: every report now carries both nations' end exchange records
// (Sim.exchangeRecord), so a campaign's interceptor launches and its
// cost exchange net are visible in the report and the baseline.
// Cycle 21 step 4: the harness profiles now call the public reinforceUnit
// command. A reinforceAll helper visits a nation's units in id order,
// skips full strength units, calls Sim.reinforceUnit and sums the
// returned cost of successful calls into a per run counter for the
// player. sensibleDay calls reinforceAll after its rail block and before
// movement. recklessDay gains a withReinforce parameter: true calls
// reinforceAll after queueing production and before vacating the
// capital; false is byte identical to the prior reckless behavior.
// run() dispatches profile 'reckless' with false and a new profile
// 'reckless-reinforce' with true, resets the counter at the start of
// each run, and every returned report gains reinforceSpentPlayer
// carrying the counter (0 for passive and plain reckless). The 'all'
// profile list becomes passive, sensible, reckless, reckless-reinforce,
// fortress in that order, and process.argv profile selection accepts
// 'reckless-reinforce'.
// Cycle 22 step 1: added six blockade fields to the run report.
// They sample Sim.enemyHomeCoastalControlCount after each tick for
// each nation. The fields are report only and no profile or sim
// behavior changed.
const Sim = require('../js/sim.js');
const SEEDS = [1, 7, 42, 99, 1234, 555, 2024, 31337];

function totalStrength(s, nid) {
  return Sim.unitsOf(s, nid).reduce((a, u) => a + u.strength, 0);
}
function prov(id) { const m = /^p(\d+)_(\d+)$/.exec(id); return { x: +m[1], y: +m[2] }; }
function neighborToward(s, unit, targetId) {
  const t = prov(targetId);
  const here = s.provinces[unit.provinceId];
  let best = null, bestScore = null;
  Sim.neighborsOf(s, here).forEach(p => {
    const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
    const score = d * 100 + Math.abs(p.y - 3) * 10 - p.x; // distance, then capital row, then east
    if (bestScore === null || score < bestScore) { bestScore = score; best = p; }
  });
  return best;
}

// Spend spare equipment on walls, one start per day: the capital first,
// then the staging province where the army masses (the easternmost
// player province on the capital row). Called after the factory builds
// inside sensibleDay, so factories still get first claim on equipment
// each day and walls get what is left.
function fortifyHome(s) {
  const targets = [s.nations.player.capitalId];
  const row3 = Object.values(s.provinces).filter(p => p.owner === 'player' && p.y === 3);
  row3.sort((a, b) => b.x - a.x);
  if (row3[0]) targets.push(row3[0].id);
  for (const id of targets) {
    const p = s.provinces[id];
    if (!p || p.owner !== 'player' || p.fortBuild || (p.fortLevel || 0) >= Sim.CFG.fortMaxLevel) continue;
    if (Sim.buildFortification(s, 'player', id).ok) return;
  }
}

// Reinforce all eligible units of a nation in id order. Sums the
// equipment cost of successful reinforceUnit calls into the per run
// counter returned via the reference object.
function reinforceAll(s, nid, counter) {
  Sim.unitsOf(s, nid).sort((a, b) => a.id - b.id).forEach(u => {
    if (u.strength < u.maxStrength) {
      const r = Sim.reinforceUnit(s, u.id);
      if (r.ok) counter.spent += r.cost;
    }
  });
}

function sensibleDay(s, trace, withForts) {
  const n = s.nations.player;
  if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
  // Factory to line path: at most one factory per day, only in safe
  // heartland provinces (x <= 4, never on captured ground), only when
  // steel income covers the extra upkeep plus full production drain
  // with headroom, so the build does not starve the lines it unlocks.
  if (Sim.factoryLevels(s, 'player') < 16) {
    const income = Sim.steelIncome(s, 'player');
    const upkeepAfter = (Sim.factoryLevels(s, 'player') + 1) * Sim.CFG.steelPerFactoryLevel;
    if (income - upkeepAfter - 15 >= 5) {
      const owned = Object.values(s.provinces).filter(p => p.owner === 'player' && p.x <= 4 && p.factoryLevel < Sim.CFG.maxFactoryLevel);
      owned.sort((a, b) => (a.factoryLevel - b.factoryLevel) || (a.x - b.x));
      for (const p of owned) {
        const cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
        if (n.equipment >= cost) {
          const r = Sim.buildFactory(s, 'player', p.id);
          if (r.ok && trace) trace.push(`day ${s.day}: buildFactory ${p.id} to level ${r.level}, total factories now ${Sim.factoryLevels(s, 'player')}`);
          break;
        }
      }
    }
  }
  if (withForts) fortifyHome(s);
  Sim.syncProductionLines(s, 'player');
  if (trace && Sim.factoryLevels(s, 'player') >= 16 && !trace.unlockedLogged) {
    trace.unlockedLogged = true;
    trace.push(`day ${s.day}: factory total reached ${Sim.factoryLevels(s, 'player')}, unlocked lines = ${Sim.unlockedLineCount(s, 'player')}, line objects = ${n.productionLines.length}`);
  }
  n.productionLines.forEach(line => {
    if (line.queue === 0) {
      const r = Sim.queueProduction(s, 'player', line.id);
      if (trace && r.ok && line.id === 3 && !trace.line3Queued) { trace.line3Queued = true; trace.push(`day ${s.day}: queued on line 3 (${r.template}, ${r.cost} steel over ${r.buildDays} days) via queueProduction`); }
    }
  });
  // Rail: one edge per day, connecting a supplied province to an unsupplied owned one, keep 40 steel buffer.
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
    // Toward the front: the unsupplied endpoint furthest east first.
    cands.sort((e1, e2) => Math.max(s.provinces[e2.a].x, s.provinces[e2.b].x) - Math.max(s.provinces[e1.a].x, s.provinces[e1.b].x));
    if (cands.length) Sim.buildRail(s, 'player', cands[0].a, cands[0].b);
  }
  // Reinforce: after rail, before movement.
  if (s._reinforceCounter) reinforceAll(s, 'player', s._reinforceCounter);
  // Movement: keep the 2 starting capital infantry as garrison.
  if (!s._garrison) {
    s._garrison = Sim.unitsIn(s, n.capitalId).filter(u => u.nation === 'player' && u.type === 'infantry').slice(0, 2).map(u => u.id);
  }
  const row3 = Object.values(s.provinces).filter(p => p.owner === 'player' && p.y === 3);
  row3.sort((a, b) => b.x - a.x);
  const staging = row3[0];
  if (!staging) return;
  const atStaging = Sim.unitsIn(s, staging.id).filter(u => u.nation === 'player' && !s._garrison.includes(u.id));
  let attackTarget = null;
  if (atStaging.length >= 5 && atStaging.every(u => (u.supplyPenalty || 0) === 0)) {
    const east = s.provinces[Sim.provinceId(staging.x + 1, 3)];
    if (east && east.owner === 'enemy') {
      const defs = Sim.unitsIn(s, east.id).filter(u => u.nation === 'enemy');
      const myPow = Sim.stackPower(s, atStaging, 'attack');
      const theirPow = Sim.stackPower(s, defs, 'defense');
      if (!defs.length || myPow >= theirPow * 1.5) attackTarget = east.id;
    }
  }
  Sim.unitsOf(s, 'player').forEach(u => {
    if (s._garrison.includes(u.id)) return;
    if (u.provinceId === staging.id) {
      if (attackTarget) Sim.issueOrder(s, u.id, attackTarget);
      return;
    }
    const next = neighborToward(s, u, staging.id);
    if (next && next.id !== u.provinceId && next.owner === 'player') Sim.issueOrder(s, u.id, next.id);
  });
}

function recklessDay(s, withReinforce) {
  const n = s.nations.player;
  if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
  Sim.syncProductionLines(s, 'player');
  n.productionLines.forEach(line => { if (line.queue === 0) Sim.queueProduction(s, 'player', line.id); });
  // Reinforce: after queueing production, before vacating the capital.
  if (withReinforce && s._reinforceCounter) reinforceAll(s, 'player', s._reinforceCounter);
  // Vacate the capital north, never return.
  const capUnits = Sim.unitsIn(s, n.capitalId).filter(u => u.nation === 'player');
  if (capUnits.length) {
    capUnits.forEach(u => Sim.issueOrder(s, u.id, Sim.provinceId(0, 2)));
    return;
  }
  // Exactly one field unit acts per day, toward the enemy capital.
  const field = Sim.unitsOf(s, 'player').filter(u => u.provinceId !== Sim.provinceId(0, 2) || s.day > 2);
  const actor = Sim.unitsOf(s, 'player')[0];
  if (actor) {
    const next = neighborToward(s, actor, s.nations.enemy.capitalId);
    if (next && next.id !== actor.provinceId) Sim.issueOrder(s, actor.id, next.id);
  }
}

function run(seed, profile) {
  const s = Sim.createGame(seed);
  const trace = (profile === 'sensible' || profile === 'fortress') ? [] : null;
  // Per run reinforce spend counter for the player.
  s._reinforceCounter = { spent: 0 };
  // Blockade progress trackers for player and enemy nations.
  const blockadeTrackers = {
    player: { max: 0, daysAt1: 0, daysAt2: 0 },
    enemy: { max: 0, daysAt1: 0, daysAt2: 0 }
  };
  let days = 0;
  while (!s.gameOver && days < 200) {
    if (profile === 'sensible') sensibleDay(s, trace);
    else if (profile === 'fortress') sensibleDay(s, trace, true);
    else if (profile === 'reckless') recklessDay(s, false);
    else if (profile === 'reckless-reinforce') recklessDay(s, true);
    Sim.tick(s); days++;
    // Sample blockade progress after each tick.
    for (const n of ['player', 'enemy']) {
      const val = Sim.enemyHomeCoastalControlCount(s, n);
      const tr = blockadeTrackers[n];
      if (val > tr.max) tr.max = val;
      if (val === 1) tr.daysAt1++;
      if (val === 2) tr.daysAt2++;
    }
  }
  const origStrength = s.units.filter(u => u.nation === 'player' && u.id <= 7 && u.strength > 0).reduce((a, u) => a + u.strength, 0);
  return {
    seed, winner: s.winner, endDay: s.tickCount, gameOver: s.gameOver, reportDay: s.day,
    endStrengthPct: +(totalStrength(s, 'player') / 72 * 100).toFixed(1),
    origStrengthPct: +(origStrength / 72 * 100).toFixed(1),
    factories: Sim.factoryLevels(s, 'player'),
    endEquipment: s.nations.player.equipment,
    exchangePlayer: Sim.exchangeRecord(s, 'player'),
    exchangeEnemy: Sim.exchangeRecord(s, 'enemy'),
    enemyEquipment: s.nations.enemy.equipment,
    lines: s.nations.player.productionLines.length,
    line3QueueSeen: trace ? !!trace.line3Queued : undefined,
    trace: trace || undefined,
    reason: s.endReason,
    reinforceSpentPlayer: s._reinforceCounter.spent,
    blockadePlayerMax: blockadeTrackers.player.max,
    blockadePlayerDaysAt1: blockadeTrackers.player.daysAt1,
    blockadePlayerDaysAt2: blockadeTrackers.player.daysAt2,
    blockadeEnemyMax: blockadeTrackers.enemy.max,
    blockadeEnemyDaysAt1: blockadeTrackers.enemy.daysAt1,
    blockadeEnemyDaysAt2: blockadeTrackers.enemy.daysAt2
  };
}

const profile = process.argv[2] || 'all';
for (const p of (profile === 'all' ? ['passive', 'sensible', 'reckless', 'reckless-reinforce', 'fortress'] : [profile])) {
  console.log('== ' + p);
  for (const seed of SEEDS) {
    const r = run(seed, p);
    console.log(JSON.stringify(r));
  }
}
