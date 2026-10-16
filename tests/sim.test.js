// Node unit tests for the Ashes of Empires simulation core.
// Run: node --test tests/sim.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Sim = require('../js/sim.js');

test('createGame: map has two nations, capitals, and starting armies', () => {
  const s = Sim.createGame(42);
  const provs = Object.values(s.provinces);
  assert.strictEqual(provs.length, Sim.CFG.mapW * Sim.CFG.mapH);
  assert.ok(provs.some(p => p.owner === 'player'));
  assert.ok(provs.some(p => p.owner === 'enemy'));
  assert.strictEqual(s.provinces[s.nations.player.capitalId].isCapital, true);
  assert.strictEqual(s.provinces[s.nations.enemy.capitalId].isCapital, true);
  assert.ok(Sim.unitsOf(s, 'player').length >= 3);
  assert.ok(Sim.unitsOf(s, 'enemy').length >= 3);
});

test('tick: day advances and game does not end immediately', () => {
  const s = Sim.createGame(7);
  const d0 = s.day;
  Sim.tick(s);
  Sim.tick(s);
  assert.strictEqual(s.day, d0 + 2);
  assert.strictEqual(s.gameOver, false);
});

test('economy: factories produce equipment when steel is available', () => {
  const s = Sim.createGame(11);
  const before = s.nations.player.equipment;
  const levels = Sim.factoryLevels(s, 'player');
  assert.ok(levels > 0, 'player should start with factories');
  const result = Sim.economyTick(s, 'player');
  assert.ok(result.levelsRunning > 0);
  assert.strictEqual(
    s.nations.player.equipment,
    before + result.levelsRunning * Sim.CFG.equipPerFactoryLevel
  );
});

test('economy: no steel means production is gated to zero', () => {
  const s = Sim.createGame(13);
  // Strip the player of every steel producing province and the stockpile.
  Object.values(s.provinces).forEach(p => { if (p.owner === 'player') p.steel = 0; });
  s.nations.player.steel = 0;
  const before = s.nations.player.equipment;
  const result = Sim.economyTick(s, 'player');
  assert.strictEqual(result.levelsRunning, 0);
  assert.strictEqual(s.nations.player.equipment, before);
});

test('economy: research points accrue daily', () => {
  const s = Sim.createGame(17);
  const before = s.nations.player.researchPoints;
  Sim.economyTick(s, 'player');
  assert.strictEqual(s.nations.player.researchPoints, before + Sim.CFG.researchPerDay);
});

test('combat: a strong attacker clears a weak defender and takes the province', () => {
  const s = Sim.createGame(19);
  // Stage a fight: one fresh player infantry vs a nearly dead enemy infantry
  // in the enemy province next door.
  const atkProv = s.provinces[Sim.provinceId(4, 3)];
  const defProv = s.provinces[Sim.provinceId(5, 3)];
  s.units = s.units.filter(u => u.provinceId !== defProv.id);
  const atk = Sim.unitsOf(s, 'player').find(u => u.provinceId === atkProv.id && u.type === 'infantry');
  const defState = { id: 999, nation: 'enemy', type: 'infantry', provinceId: defProv.id, strength: 1, maxStrength: 12, order: null };
  s.units.push(defState);
  const rng = Sim.makeRng(99);
  const cleared = Sim.resolveBattle(s, [atk], [defState], rng);
  assert.strictEqual(cleared, true);
  assert.strictEqual(defState.strength, 0);
  assert.ok(atk.strength > 0);
});

test('combat: moving into a cleared enemy province flips ownership', () => {
  const s = Sim.createGame(23);
  const defProv = s.provinces[Sim.provinceId(5, 3)];
  // Remove every defender from the target province, then march in.
  s.units = s.units.filter(u => u.provinceId !== defProv.id);
  const marcher = Sim.unitsOf(s, 'player').find(u => u.provinceId === Sim.provinceId(4, 3) && u.type === 'infantry');
  const res = Sim.issueOrder(s, marcher.id, defProv.id);
  assert.strictEqual(res.ok, true);
  Sim.tick(s);
  assert.strictEqual(defProv.owner, 'player');
  assert.strictEqual(marcher.provinceId, defProv.id);
});

test('orders: non-adjacent targets are rejected', () => {
  const s = Sim.createGame(29);
  const u = Sim.unitsOf(s, 'player')[0];
  const far = s.provinces[Sim.provinceId(9, 0)];
  const res = Sim.issueOrder(s, u.id, far.id);
  assert.strictEqual(res.ok, false);
});

test('factory: building raises the level and charges equipment', () => {
  const s = Sim.createGame(31);
  const prov = Object.values(s.provinces).find(p => p.owner === 'player' && p.factoryLevel === 0);
  s.nations.player.equipment = 500;
  const lvl = prov.factoryLevel;
  const res = Sim.buildFactory(s, 'player', prov.id);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(prov.factoryLevel, lvl + 1);
  assert.strictEqual(s.nations.player.equipment, 500 - Sim.CFG.factoryCostPerLevel * (lvl + 1));
});

test('factory: cannot build in an enemy province or past max level', () => {
  const s = Sim.createGame(37);
  const enemyProv = Object.values(s.provinces).find(p => p.owner === 'enemy');
  assert.strictEqual(Sim.buildFactory(s, 'player', enemyProv.id).ok, false);
  const cap = s.provinces[s.nations.player.capitalId];
  cap.factoryLevel = Sim.CFG.maxFactoryLevel;
  s.nations.player.equipment = 9999;
  assert.strictEqual(Sim.buildFactory(s, 'player', cap.id).ok, false);
});

test('research: Drone Gen 2 changes drone attack and defense stats', () => {
  const s = Sim.createGame(41);
  const drone = Sim.unitsOf(s, 'player').find(u => u.type === 'drone');
  // Cycle 12 step 1: unitStats now folds in the shared EW readout, so
  // the pinned numbers are the readout's numbers, not the raw base
  // stats. At the start the Compact is drone generation 1 against
  // Dominion jamming generation 0, effectiveness 125 percent:
  // attack round(3 times 1.25) is 4, defense round(2 times 1.25) is 3.
  // This test legitimately pinned pre EW behavior and is repinned
  // here for exactly that reason; the formal EW tests are step 3.
  const before = Sim.unitStats(s, drone);
  assert.deepStrictEqual(before, { attack: 4, defense: 3, supplyPenalty: 0, fortBonus: 0 });
  s.nations.player.researchPoints = Sim.CFG.droneGen2Cost;
  const res = Sim.researchDroneGen2(s, 'player');
  assert.strictEqual(res.ok, true);
  const after = Sim.unitStats(s, drone);
  // Drone Gen 2 against jamming generation 0 is effectiveness 150
  // percent: attack round(5 times 1.5) is 8, defense round(3 times
  // 1.5) is 5.
  assert.deepStrictEqual(after, { attack: 8, defense: 5, supplyPenalty: 0, fortBonus: 0 });
  // Infantry is untouched by drone research.
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  assert.deepStrictEqual(Sim.unitStats(s, inf), { attack: 4, defense: 4, supplyPenalty: 0, fortBonus: 0 });
});

test('win: capturing the enemy capital ends the game for the player', () => {
  const s = Sim.createGame(43);
  const cap = s.provinces[s.nations.enemy.capitalId];
  // Teleport a player unit next to the capital and clear its defenders.
  const next = Sim.neighborsOf(s, cap)[0];
  s.units = s.units.filter(u => u.provinceId !== cap.id);
  const hero = Sim.unitsOf(s, 'player')[0];
  hero.provinceId = next.id;
  const res = Sim.issueOrder(s, hero.id, cap.id);
  assert.strictEqual(res.ok, true);
  Sim.tick(s);
  assert.strictEqual(cap.owner, 'player');
  assert.strictEqual(s.gameOver, true);
  assert.strictEqual(s.winner, 'player');
});

test('campaign end: passing the end date ends the game', () => {
  const s = Sim.createGame(47);
  s.day = Sim.CFG.campaignEndDay;
  Sim.tick(s);
  assert.strictEqual(s.gameOver, true);
  assert.ok(s.endReason && s.endReason.length > 0);
});

test('determinism: same seed, same outcome after 30 ticks', () => {
  const a = Sim.createGame(1234);
  const b = Sim.createGame(1234);
  for (let i = 0; i < 30; i++) { Sim.tick(a); Sim.tick(b); }
  assert.strictEqual(a.day, b.day);
  assert.strictEqual(a.nations.player.equipment, b.nations.player.equipment);
  assert.strictEqual(a.nations.enemy.equipment, b.nations.enemy.equipment);
  assert.strictEqual(a.units.length, b.units.length);
});

// ---------- Cycle 3: graph, rail, supply ----------

test('graph: adjacency comes from typed edges, river on the frontier line', () => {
  const s = Sim.createGame(53);
  const mid = s.provinces[Sim.provinceId(4, 3)];
  const east = s.provinces[Sim.provinceId(5, 3)];
  const e = Sim.edgeBetween(s, mid.id, east.id);
  assert.ok(e, 'frontier provinces must share an edge');
  assert.strictEqual(e.terrain, 'river');
  const land = Sim.edgeBetween(s, Sim.provinceId(0, 3), Sim.provinceId(1, 3));
  assert.strictEqual(land.terrain, 'land');
  assert.strictEqual(Sim.edgeBetween(s, Sim.provinceId(0, 0), Sim.provinceId(5, 5)), null);
  const ns = Sim.neighborsOf(s, mid).map(p => p.id).sort();
  assert.deepStrictEqual(ns, ['p3_3', 'p4_2', 'p4_4', 'p5_3']);
});

test('supply: the starting rail spine supplies the front, corners are cut off', () => {
  const s = Sim.createGame(59);
  const sup = Sim.computeSupply(s, 'player');
  assert.strictEqual(sup[s.nations.player.capitalId].supplied, true);
  assert.strictEqual(sup[Sim.provinceId(4, 3)].supplied, true);
  assert.strictEqual(sup[Sim.provinceId(3, 2)].supplied, true);
  const corner = sup[Sim.provinceId(0, 0)];
  assert.strictEqual(corner.supplied, false);
  assert.strictEqual(corner.reason, 'no rail link');
});

test('rail: building validates, charges steel, and completes after build days', () => {
  const s = Sim.createGame(61);
  const cap = s.nations.player.capitalId;           // p0_3
  const north = Sim.provinceId(0, 2);
  s.nations.player.steel = 100;
  const before = Sim.computeSupply(s, 'player');
  assert.strictEqual(before[north].supplied, false);
  const res = Sim.buildRail(s, 'player', cap, north);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(s.nations.player.steel, 100 - Sim.CFG.railCostSteel);
  assert.strictEqual(Sim.buildRail(s, 'player', cap, north).ok, false, 'duplicate rail rejected');
  for (let i = 0; i < Sim.CFG.railBuildDays; i++) Sim.tick(s);
  const after = Sim.computeSupply(s, 'player');
  assert.strictEqual(after[north].supplied, true);
  assert.strictEqual(after[north].hops, 1);
});

test('rail: cannot build to a foreign province or without steel', () => {
  const s = Sim.createGame(67);
  const mine = Sim.provinceId(4, 3);
  const theirs = Sim.provinceId(5, 3);
  s.nations.player.steel = 999;
  assert.strictEqual(Sim.buildRail(s, 'player', mine, theirs).ok, false);
  const s2 = Sim.createGame(67);
  s2.nations.player.steel = 0;
  assert.strictEqual(Sim.buildRail(s2, 'player', s2.nations.player.capitalId, Sim.provinceId(0, 2)).ok, false);
});

test('supply: cutting one province pockets the enemy forward base, penalties accrue 10/30/50', () => {
  const s = Sim.createGame(71);
  // Stage the pocket: the player seizes p6_3, the middle of the enemy
  // rail spine. The enemy forward provinces p5_3, p5_2, p5_4 keep their
  // rail but lose their line to Khessograd.
  s.provinces[Sim.provinceId(6, 3)].owner = 'player';
  const sup = Sim.computeSupply(s, 'enemy');
  assert.strictEqual(sup[Sim.provinceId(5, 3)].supplied, false);
  assert.strictEqual(sup[Sim.provinceId(5, 3)].reason, 'line cut or too long');
  assert.strictEqual(sup[Sim.provinceId(8, 3)].supplied, true);
  // A unit in the pocket accrues the named penalty on schedule.
  const stuck = Sim.unitsOf(s, 'enemy').find(u => u.provinceId === Sim.provinceId(5, 3) && u.type === 'infantry');
  Sim.supplyPhase(s);
  assert.strictEqual(stuck.daysOut, 1);
  assert.strictEqual(stuck.supplyPenalty, 10);
  Sim.supplyPhase(s); Sim.supplyPhase(s);
  assert.strictEqual(stuck.supplyPenalty, 30);
  Sim.supplyPhase(s); Sim.supplyPhase(s); Sim.supplyPhase(s); Sim.supplyPhase(s);
  assert.strictEqual(stuck.daysOut, 7);
  assert.strictEqual(stuck.supplyPenalty, 50, 'penalty floors at the cap');
  // Attrition after the grace days has bitten by day 12 out.
  for (let i = 0; i < 5; i++) Sim.supplyPhase(s);
  assert.ok(stuck.strength < stuck.maxStrength, 'attrition must reduce strength');
  // Resupply: hand the spine province back, penalties unwind 10 per day.
  s.provinces[Sim.provinceId(6, 3)].owner = 'enemy';
  Sim.supplyPhase(s);
  assert.strictEqual(stuck.daysOut, 0);
  assert.strictEqual(stuck.supplyPenalty, 40);
  Sim.supplyPhase(s);
  assert.strictEqual(stuck.supplyPenalty, 30);
});

test('supply: penalty is a named modifier inside unitStats and stackPower', () => {
  const s = Sim.createGame(73);
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  inf.supplyPenalty = 50;
  const st = Sim.unitStats(s, inf);
  assert.strictEqual(st.supplyPenalty, 50);
  assert.strictEqual(st.attack, 2);
  assert.strictEqual(st.defense, 2);
  const fresh = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry' && u.id !== inf.id);
  assert.strictEqual(Sim.stackPower(s, [inf, fresh], 'attack'), 2 + 4);
});

// ---------- Cycle 5: production lines, queues, steel starvation ----------
// These tests call productionPhase directly instead of Sim.tick so that
// economy income and AI decisions cannot blur the steel numbers.

// Run productionPhase until the given line completes a unit, or until
// maxDays have passed. Returns the 1-based day of completion (or -1),
// the total steel spent, and the units completed.
function runUntilComplete(s, nationId, maxDays) {
  let spent = 0;
  for (let day = 1; day <= maxDays; day++) {
    const r = Sim.productionPhase(s, nationId);
    spent += r.steelSpent;
    if (r.completed.length > 0) return { day, spent, completed: r.completed };
  }
  return { day: -1, spent, completed: [] };
}

test('production parity: player and AI start with identical lines, steel, and equipment', () => {
  const s = Sim.createGame(101);
  const p = s.nations.player;
  const e = s.nations.enemy;
  assert.strictEqual(Sim.CFG.productionLinesPerNation, 2);
  assert.strictEqual(p.productionLines.length, Sim.CFG.productionLinesPerNation);
  assert.strictEqual(e.productionLines.length, Sim.CFG.productionLinesPerNation);
  assert.deepStrictEqual(p.productionLines, e.productionLines);
  assert.deepStrictEqual(p.productionLines.map(l => l.id), [1, 2]);
  assert.deepStrictEqual(p.productionLines.map(l => l.template), ['infantry', 'drone']);
  p.productionLines.concat(e.productionLines).forEach(l => {
    assert.strictEqual(l.queue, 0);
    assert.strictEqual(l.progressDays, 0);
    assert.strictEqual(l.stalled, false);
  });
  // Separate objects, not shared references.
  assert.notStrictEqual(p.productionLines[0], e.productionLines[0]);
  assert.strictEqual(p.steel, 20);
  assert.strictEqual(e.steel, 20);
  assert.strictEqual(p.equipment, 60);
  assert.strictEqual(e.equipment, 60);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 0);
  assert.strictEqual(Sim.queuedUnits(s, 'enemy'), 0);
  assert.strictEqual(Sim.productionDrain(s, 'player'), 0);
  assert.strictEqual(Sim.productionDrain(s, 'enemy'), 0);
});

test('production parity: template costs, build days, and drain are the same numbers for both nations', () => {
  const inf = Sim.CFG.unitTypes.infantry;
  const dr = Sim.CFG.unitTypes.drone;
  assert.strictEqual(inf.steelCost, 30);
  assert.strictEqual(inf.buildDays, 6);
  assert.strictEqual(dr.steelCost, 15);
  assert.strictEqual(dr.buildDays, 3);
  assert.strictEqual(Sim.lineSteelPerDay('infantry'), 5);
  assert.strictEqual(Sim.lineSteelPerDay('drone'), 5);
  assert.strictEqual(Sim.lineSteelPerDay('infantry'), inf.steelCost / inf.buildDays);
  assert.strictEqual(Sim.lineSteelPerDay('drone'), dr.steelCost / dr.buildDays);

  const s = Sim.createGame(103);
  ['player', 'enemy'].forEach(nid => {
    const a = Sim.queueProduction(s, nid, 1);
    const b = Sim.queueProduction(s, nid, 2);
    assert.strictEqual(a.ok, true);
    assert.strictEqual(a.template, 'infantry');
    assert.strictEqual(a.cost, inf.steelCost);
    assert.strictEqual(a.buildDays, inf.buildDays);
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.template, 'drone');
    assert.strictEqual(b.cost, dr.steelCost);
    assert.strictEqual(b.buildDays, dr.buildDays);
  });
  assert.strictEqual(Sim.productionDrain(s, 'player'), Sim.productionDrain(s, 'enemy'));
  assert.strictEqual(Sim.productionDrain(s, 'player'),
    Sim.lineSteelPerDay('infantry') + Sim.lineSteelPerDay('drone'));
  assert.strictEqual(Sim.productionDrain(s, 'player'), 10);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), Sim.queuedUnits(s, 'enemy'));
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 2);
});

test('production parity: same order completes on the same day for the same steel, no discounts', () => {
  const s = Sim.createGame(107);
  s.nations.player.steel = 100;
  s.nations.enemy.steel = 100;
  ['infantry', 'drone'].forEach(template => {
    const lineId = template === 'infantry' ? 1 : 2;
    const t = Sim.CFG.unitTypes[template];
    assert.strictEqual(Sim.queueProduction(s, 'player', lineId).ok, true);
    assert.strictEqual(Sim.queueProduction(s, 'enemy', lineId).ok, true);
    const pSteel = s.nations.player.steel;
    const eSteel = s.nations.enemy.steel;
    const pr = runUntilComplete(s, 'player', 20);
    const er = runUntilComplete(s, 'enemy', 20);
    assert.strictEqual(pr.day, t.buildDays);
    assert.strictEqual(er.day, t.buildDays);
    assert.strictEqual(pr.spent, t.steelCost);
    assert.strictEqual(er.spent, t.steelCost);
    assert.strictEqual(pSteel - s.nations.player.steel, t.steelCost);
    assert.strictEqual(eSteel - s.nations.enemy.steel, t.steelCost);
    assert.strictEqual(pr.completed[0].type, template);
    assert.strictEqual(er.completed[0].type, template);
    assert.strictEqual(pr.completed[0].provinceId, s.nations.player.capitalId);
    assert.strictEqual(er.completed[0].provinceId, s.nations.enemy.capitalId);
  });
  assert.strictEqual(s.nations.player.steel, s.nations.enemy.steel);
  assert.strictEqual(s.nations.player.steel, 100 - 30 - 15);
});

test('production queue: ordering is free and spawns nothing on the day ordered', () => {
  const s = Sim.createGame(109);
  s.nations.player.steel = 100;
  const unitsBefore = Sim.unitsOf(s, 'player').length;
  const res = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.cost, 30);
  assert.strictEqual(res.buildDays, 6);
  assert.strictEqual(s.nations.player.steel, 100, 'nothing is paid up front');
  assert.strictEqual(Sim.unitsOf(s, 'player').length, unitsBefore, 'no unit appears on order');
  const line = Sim.productionLine(s, 'player', 1);
  assert.strictEqual(line.queue, 1);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 1);
  assert.strictEqual(Sim.productionLine(s, 'player', 99), null);
  assert.strictEqual(Sim.queueProduction(s, 'player', 99).ok, false);
});

test('production queue: infantry completes on the 6th funded day for exactly 30 steel at the capital', () => {
  const s = Sim.createGame(113);
  const n = s.nations.player;
  n.steel = 100;
  const unitsBefore = Sim.unitsOf(s, 'player').length;
  Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  const perDay = Sim.lineSteelPerDay('infantry');
  assert.strictEqual(perDay, 5);
  for (let day = 1; day <= 5; day++) {
    const r = Sim.productionPhase(s, 'player');
    assert.strictEqual(r.completed.length, 0, 'not done on day ' + day);
    assert.strictEqual(r.steelSpent, perDay);
    assert.strictEqual(line.progressDays, day);
    assert.strictEqual(line.stalled, false);
    assert.strictEqual(n.steel, 100 - perDay * day);
  }
  assert.strictEqual(Sim.unitsOf(s, 'player').length, unitsBefore, 'nothing on day 5');
  const r6 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r6.completed.length, 1);
  assert.strictEqual(r6.steelSpent, perDay);
  const u = r6.completed[0];
  assert.strictEqual(u.type, 'infantry');
  assert.strictEqual(u.nation, 'player');
  assert.strictEqual(u.provinceId, n.capitalId);
  assert.strictEqual(n.capitalId, 'p0_3');
  assert.strictEqual(n.steel, 100 - 30);
  assert.strictEqual(n.steel, 100 - Sim.CFG.unitTypes.infantry.steelCost);
  assert.strictEqual(line.queue, 0);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(Sim.unitsOf(s, 'player').length, unitsBefore + 1);
  // An empty line drains nothing afterwards.
  const r7 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r7.steelSpent, 0);
  assert.strictEqual(r7.completed.length, 0);
  assert.strictEqual(n.steel, 70);
});

test('production queue: drone wing completes on the 3rd funded day for exactly 15 steel', () => {
  const s = Sim.createGame(127);
  const n = s.nations.player;
  n.steel = 50;
  Sim.queueProduction(s, 'player', 2);
  const line = Sim.productionLine(s, 'player', 2);
  assert.strictEqual(line.template, 'drone');
  const r1 = Sim.productionPhase(s, 'player');
  const r2 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r1.completed.length, 0);
  assert.strictEqual(r2.completed.length, 0);
  assert.strictEqual(line.progressDays, 2);
  const r3 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r3.completed.length, 1);
  assert.strictEqual(r3.completed[0].type, 'drone');
  assert.strictEqual(r3.completed[0].provinceId, n.capitalId);
  assert.strictEqual(r1.steelSpent + r2.steelSpent + r3.steelSpent, 15);
  assert.strictEqual(r1.steelSpent + r2.steelSpent + r3.steelSpent, Sim.CFG.unitTypes.drone.steelCost);
  assert.strictEqual(n.steel, 50 - 15);
  assert.strictEqual(line.queue, 0);
  assert.strictEqual(line.progressDays, 0);
});

test('production queue: two orders on one line build one after the other', () => {
  const s = Sim.createGame(131);
  const n = s.nations.player;
  n.steel = 200;
  Sim.queueProduction(s, 'player', 1);
  Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  assert.strictEqual(line.queue, 2);
  assert.strictEqual(Sim.productionDrain(s, 'player'), 5, 'one line builds one unit at a time');
  const first = runUntilComplete(s, 'player', 20);
  assert.strictEqual(first.day, 6);
  assert.strictEqual(first.completed.length, 1, 'second unit is not done with the first');
  assert.strictEqual(line.queue, 1);
  assert.strictEqual(line.progressDays, 0);
  const second = runUntilComplete(s, 'player', 20);
  assert.strictEqual(second.day, 6, 'second unit takes its own full build');
  assert.strictEqual(second.completed.length, 1);
  assert.strictEqual(line.queue, 0);
  assert.strictEqual(first.spent + second.spent, 60);
  assert.strictEqual(n.steel, 200 - 60);
});

test('production queue: a line holds CFG.maxQueuePerLine orders and rejects one more', () => {
  const s = Sim.createGame(137);
  assert.strictEqual(Sim.CFG.maxQueuePerLine, 9);
  for (let i = 0; i < Sim.CFG.maxQueuePerLine; i++) {
    assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true, 'order ' + (i + 1));
  }
  const line = Sim.productionLine(s, 'player', 1);
  assert.strictEqual(line.queue, 9);
  const over = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(over.ok, false);
  assert.ok(over.reason && over.reason.length > 0);
  assert.strictEqual(line.queue, 9);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 9);
  // The other line is unaffected by the cap on line 1.
  assert.strictEqual(Sim.queueProduction(s, 'player', 2).ok, true);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 10);
});

test('steel starvation: rail paid up front leaves too little steel, the infantry line stalls', () => {
  const s = Sim.createGame(139);
  const n = s.nations.player;
  n.steel = 19;
  const unitsBefore = Sim.unitsOf(s, 'player').length;
  assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true);
  const rail = Sim.buildRail(s, 'player', 'p0_3', 'p0_2');
  assert.strictEqual(rail.ok, true);
  assert.strictEqual(rail.cost, Sim.CFG.railCostSteel);
  assert.strictEqual(Sim.CFG.railCostSteel, 15);
  assert.strictEqual(n.steel, 19 - 15);
  assert.ok(n.steel < Sim.productionDrain(s, 'player'), 'remainder is below the daily drain');
  const line = Sim.productionLine(s, 'player', 1);
  const r = Sim.productionPhase(s, 'player');
  assert.deepStrictEqual(r.completed, []);
  assert.strictEqual(r.steelSpent, 0);
  assert.strictEqual(line.stalled, true);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(line.queue, 1);
  assert.strictEqual(n.steel, 4, 'a stalled line spends nothing');
  assert.strictEqual(Sim.unitsOf(s, 'player').length, unitsBefore);
  // Still starved the next day: still no progress, still no spend.
  const r2 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r2.steelSpent, 0);
  assert.strictEqual(line.stalled, true);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(n.steel, 4);
});

test('steel starvation: exactly zero steel stalls, topping up to the drain recovers', () => {
  const s = Sim.createGame(149);
  const n = s.nations.player;
  n.steel = 0;
  Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  const unitsBefore = Sim.unitsOf(s, 'player').length;
  const r0 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r0.steelSpent, 0);
  assert.strictEqual(r0.completed.length, 0);
  assert.strictEqual(line.stalled, true);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(n.steel, 0);
  // Top up to exactly the drain: the next day is paid and makes progress.
  n.steel = Sim.productionDrain(s, 'player');
  assert.strictEqual(n.steel, 5);
  const r1 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r1.steelSpent, 5);
  assert.strictEqual(r1.completed.length, 0);
  assert.strictEqual(line.stalled, false);
  assert.strictEqual(line.progressDays, 1);
  assert.strictEqual(n.steel, 0);
  // Back to zero: stalls again but keeps the work already paid for.
  const r2 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r2.steelSpent, 0);
  assert.strictEqual(line.stalled, true);
  assert.strictEqual(line.progressDays, 1);
  // Funding the remaining days finishes the unit for 30 steel in total.
  n.steel = 25;
  const rest = runUntilComplete(s, 'player', 10);
  assert.strictEqual(rest.day, 5, 'five more funded days after the first');
  assert.strictEqual(rest.spent + r1.steelSpent, 30);
  assert.strictEqual(line.stalled, false);
  assert.strictEqual(n.steel, 0);
  assert.strictEqual(Sim.unitsOf(s, 'player').length, unitsBefore + 1);
});

// ---------- Cycle 6: factory gated line slots, simultaneous battles ----------

// Set a nation's total factory levels exactly, spreading levels over
// its own provinces in id order, at most CFG.maxFactoryLevel each.
// Test staging only: the balance runs never do this.
function setFactoryTotal(s, nationId, total) {
  const owned = Object.values(s.provinces)
    .filter(p => p.owner === nationId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  let left = total;
  owned.forEach(p => {
    const give = Math.min(Sim.CFG.maxFactoryLevel, left);
    p.factoryLevel = give;
    left -= give;
  });
  assert.strictEqual(left, 0, 'enough provinces to hold the total');
  assert.strictEqual(Sim.factoryLevels(s, nationId), total);
}

test('line slots: every standard seed starts with exactly 2 lines for both nations', () => {
  [1, 7, 42, 99, 1234, 555, 2024, 31337].forEach(seed => {
    const s = Sim.createGame(seed);
    ['player', 'enemy'].forEach(nid => {
      assert.ok(Sim.factoryLevels(s, nid) < 16, 'seed ' + seed + ' ' + nid + ' starts below the line 3 threshold');
      assert.strictEqual(Sim.unlockedLineCount(s, nid), 2);
      assert.strictEqual(s.nations[nid].productionLines.length, 2);
      const info = Sim.lineLockInfo(s, nid, 3);
      assert.strictEqual(info.required, 16);
      assert.strictEqual(info.current, Sim.factoryLevels(s, nid));
      assert.strictEqual(info.missing, 16 - Sim.factoryLevels(s, nid));
      assert.strictEqual(Sim.isLineUnlocked(s, nid, 3), false);
      assert.strictEqual(Sim.isLineUnlocked(s, nid, 2), true);
    });
  });
});

test('line slots: thresholds at 15, 16, 23, and 24, the hard cap of 4, permanence', () => {
  const s = Sim.createGame(211);
  assert.deepStrictEqual(Sim.CFG.lineUnlockFactoryLevels, [0, 0, 16, 24]);
  assert.strictEqual(Sim.CFG.maxProductionLines, 4);

  setFactoryTotal(s, 'player', 15);
  assert.deepStrictEqual(Sim.syncProductionLines(s, 'player'), []);
  assert.strictEqual(s.nations.player.productionLines.length, 2);
  assert.strictEqual(Sim.unlockedLineCount(s, 'player'), 2);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 3).missing, 1);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 4).missing, 9);

  setFactoryTotal(s, 'player', 16);
  const opened3 = Sim.syncProductionLines(s, 'player');
  assert.strictEqual(opened3.length, 1);
  assert.strictEqual(opened3[0].id, 3);
  assert.strictEqual(opened3[0].template, 'infantry');
  assert.strictEqual(s.nations.player.productionLines.length, 3);
  assert.strictEqual(Sim.unlockedLineCount(s, 'player'), 3);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 3), null);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 4).missing, 8);

  setFactoryTotal(s, 'player', 23);
  assert.deepStrictEqual(Sim.syncProductionLines(s, 'player'), []);
  assert.strictEqual(s.nations.player.productionLines.length, 3);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 4).missing, 1);

  setFactoryTotal(s, 'player', 24);
  const opened4 = Sim.syncProductionLines(s, 'player');
  assert.strictEqual(opened4.length, 1);
  assert.strictEqual(opened4[0].id, 4);
  assert.strictEqual(opened4[0].template, 'drone');
  assert.strictEqual(s.nations.player.productionLines.length, 4);
  assert.strictEqual(Sim.unlockedLineCount(s, 'player'), 4);
  assert.strictEqual(Sim.lineLockInfo(s, 'player', 4), null);

  // The cap is hard: more factories open nothing, and slot 5 does not exist.
  setFactoryTotal(s, 'player', 30);
  assert.deepStrictEqual(Sim.syncProductionLines(s, 'player'), []);
  assert.strictEqual(s.nations.player.productionLines.length, 4);
  assert.strictEqual(Sim.productionLine(s, 'player', 5), null);
  const noSlot = Sim.queueProduction(s, 'player', 5);
  assert.strictEqual(noSlot.ok, false);
  assert.strictEqual(noSlot.reason, 'no such production line');

  // Permanence: losing every factory never relocks an opened line.
  setFactoryTotal(s, 'player', 0);
  assert.strictEqual(Sim.unlockedLineCount(s, 'player'), 4);
  assert.strictEqual(Sim.isLineUnlocked(s, 'player', 3), true);
  assert.strictEqual(Sim.queueProduction(s, 'player', 3).ok, true);
  assert.strictEqual(Sim.productionLine(s, 'player', 3).queue, 1);
});

test('locked lines: queue and retool are rejected with the exact numbers, nothing changes', () => {
  const s = Sim.createGame(213);
  const current = Sim.factoryLevels(s, 'player');
  assert.ok(current < 16, 'this seed starts below the threshold');
  const missing = 16 - current;
  const logBefore = s.log.length;

  const q = Sim.queueProduction(s, 'player', 3);
  assert.strictEqual(q.ok, false);
  assert.strictEqual(q.locked, true);
  assert.strictEqual(q.lineId, 3);
  assert.strictEqual(q.required, 16);
  assert.strictEqual(q.current, current);
  assert.strictEqual(q.missing, missing);
  assert.strictEqual(q.reason,
    'Line 3 is locked. Build ' + missing + ' more factory ' +
    (missing === 1 ? 'level' : 'levels') + ' anywhere to unlock it (needs 16 total factory levels, you have ' +
    current + ').');
  // No phantom line, no queue, no log line.
  assert.strictEqual(s.nations.player.productionLines.length, 2);
  assert.strictEqual(Sim.productionLine(s, 'player', 3), null);
  assert.strictEqual(Sim.queuedUnits(s, 'player'), 0);
  assert.strictEqual(s.log.length, logBefore);

  const rt = Sim.assignLineTemplate(s, 'player', 3, 'drone');
  assert.strictEqual(rt.ok, false);
  assert.strictEqual(rt.locked, true);
  assert.strictEqual(s.nations.player.productionLines.length, 2);

  // At 15 total the reason goes singular: exactly 1 more factory level.
  setFactoryTotal(s, 'player', 15);
  const q15 = Sim.queueProduction(s, 'player', 3);
  assert.strictEqual(q15.ok, false);
  assert.strictEqual(q15.reason,
    'Line 3 is locked. Build 1 more factory level anywhere to unlock it (needs 16 total factory levels, you have 15).');

  // Line 4 stays locked at 16 with its own numbers.
  setFactoryTotal(s, 'player', 16);
  Sim.syncProductionLines(s, 'player');
  const q4 = Sim.queueProduction(s, 'player', 4);
  assert.strictEqual(q4.ok, false);
  assert.strictEqual(q4.locked, true);
  assert.strictEqual(q4.reason,
    'Line 4 is locked. Build 8 more factory levels anywhere to unlock it (needs 24 total factory levels, you have 16).');
  assert.strictEqual(Sim.productionLine(s, 'player', 3).queue, 0);
});

test('AI parity: the enemy unlocks at the same thresholds and pays the same for line 3', () => {
  const s = Sim.createGame(217);
  setFactoryTotal(s, 'player', 16);
  setFactoryTotal(s, 'enemy', 16);
  Sim.syncProductionLines(s, 'player');
  Sim.syncProductionLines(s, 'enemy');
  assert.strictEqual(s.nations.player.productionLines.length, 3);
  assert.strictEqual(s.nations.enemy.productionLines.length, 3);
  assert.deepStrictEqual(
    s.nations.enemy.productionLines.map(l => l.template),
    s.nations.player.productionLines.map(l => l.template));

  s.nations.player.steel = 100;
  s.nations.enemy.steel = 100;
  const qp = Sim.queueProduction(s, 'player', 3);
  const qe = Sim.queueProduction(s, 'enemy', 3);
  assert.strictEqual(qp.ok, true);
  assert.strictEqual(qe.ok, true);
  assert.strictEqual(qe.template, qp.template);
  assert.strictEqual(qe.cost, qp.cost);
  assert.strictEqual(qe.cost, 30);
  assert.strictEqual(qe.buildDays, qp.buildDays);
  assert.strictEqual(Sim.productionDrain(s, 'enemy'), Sim.productionDrain(s, 'player'));

  const pr = runUntilComplete(s, 'player', 20);
  const er = runUntilComplete(s, 'enemy', 20);
  assert.strictEqual(pr.day, 6);
  assert.strictEqual(er.day, 6);
  assert.strictEqual(pr.spent, 30);
  assert.strictEqual(er.spent, 30);
  assert.strictEqual(pr.completed[0].provinceId, s.nations.player.capitalId);
  assert.strictEqual(er.completed[0].provinceId, s.nations.enemy.capitalId);
  assert.strictEqual(s.nations.player.steel, s.nations.enemy.steel);
});

test('AI parity: one real tick opens and queues the enemy line 3 at 16 factory levels', () => {
  const s = Sim.createGame(223);
  setFactoryTotal(s, 'enemy', 16);
  assert.ok(Sim.factoryLevels(s, 'player') < 16);
  Sim.tick(s);
  assert.strictEqual(s.nations.enemy.productionLines.length, 3);
  const line3 = Sim.productionLine(s, 'enemy', 3);
  assert.ok(line3, 'the AI has a line 3 after the tick');
  assert.strictEqual(line3.template, 'infantry');
  assert.strictEqual(line3.queue, 1, 'the AI queued on line 3 through the real tick path');
  assert.strictEqual(s.nations.player.productionLines.length, 2, 'the player gained no line');
});

test('simultaneous battles: reversing the unit array changes nothing', () => {
  function scenario() {
    const s = Sim.createGame(229);
    const order = (nation, provId, target) => {
      Sim.unitsIn(s, provId).filter(u => u.nation === nation)
        .forEach(u => assert.strictEqual(Sim.issueOrder(s, u.id, target).ok, true));
    };
    // Two player groups: one attacks p5_3, one moves up to the capital row.
    order('player', Sim.provinceId(4, 3), Sim.provinceId(5, 3));
    order('player', Sim.provinceId(3, 2), Sim.provinceId(3, 3));
    // The p5_3 defenders are ordered away east: the snapshot still makes
    // them defend. Another enemy group moves, the capital group marches west.
    order('enemy', Sim.provinceId(5, 3), Sim.provinceId(6, 3));
    order('enemy', Sim.provinceId(6, 2), Sim.provinceId(6, 3));
    order('enemy', s.nations.enemy.capitalId, Sim.provinceId(8, 3));
    return s;
  }
  function snapshot(s) {
    return {
      units: s.units.map(u => [u.id, u.nation, u.provinceId, u.strength])
        .sort((a, b) => a[0] - b[0]),
      owners: Object.keys(s.provinces).sort().map(pid => s.provinces[pid].owner),
      gameOver: s.gameOver,
      winner: s.winner
    };
  }
  const a = scenario();
  const strengthBefore = a.units.reduce((sum, u) => sum + u.strength, 0);
  const b = scenario();
  b.units.reverse();
  Sim.movementPhase(a);
  Sim.movementPhase(b);
  assert.deepStrictEqual(snapshot(b), snapshot(a));
  // The scenario is not vacuous: the phase fought or moved something.
  const after = snapshot(a);
  const strengthAfter = after.units.reduce((sum, row) => sum + row[3], 0);
  assert.ok(strengthAfter < strengthBefore || after.owners.includes('player'),
    'the phase must change strengths or owners');
  assert.ok(after.units.some(row => row[2] === Sim.provinceId(3, 3) || row[2] === Sim.provinceId(8, 3)),
    'unopposed groups marched');
});

test('meeting battle: groups crossing the same edge fight on the road, they do not pass through', () => {
  const s = Sim.createGame(233);
  const aId = Sim.provinceId(4, 3);
  const bId = Sim.provinceId(5, 3);
  s.units = s.units.filter(u =>
    (u.provinceId === aId && u.nation === 'player' && u.type === 'infantry') ||
    (u.provinceId === bId && u.nation === 'enemy' && u.type === 'infantry'));
  assert.strictEqual(s.units.length, 2);
  const mine = s.units.find(u => u.nation === 'player');
  const theirs = s.units.find(u => u.nation === 'enemy');
  // A weakened enemy column, staged the way earlier tests weaken a
  // defender: the road battle must still cost the winner strength.
  theirs.strength = 1;
  assert.strictEqual(Sim.issueOrder(s, mine.id, bId).ok, true);
  assert.strictEqual(Sim.issueOrder(s, theirs.id, aId).ok, true);
  Sim.movementPhase(s);
  assert.strictEqual(theirs.strength, 0, 'the crossing enemy column is destroyed on the road');
  assert.ok(mine.strength > 0 && mine.strength < 12, 'the winner paid for the road battle');
  assert.strictEqual(mine.provinceId, bId, 'the winner marched on to its target');
  assert.strictEqual(s.provinces[bId].owner, 'player');
  assert.strictEqual(Sim.unitsIn(s, aId).filter(u => u.nation === 'enemy').length, 0,
    'no enemy unit passed through to the other side');
  assert.ok(s.log.some(e => e.msg.includes('meet on the road')), 'the meeting battle is logged');
});

// ---------- Cycle 5 step 4: judge flags, capital garrison and retooling ----------

test('AI garrison: the first 3 idle units on the Dominion capital hold, a 4th unit acts', () => {
  // Part 1: the 3 starting capital units stay home for several days.
  const s = Sim.createGame(151);
  const capId = s.nations.enemy.capitalId;
  const startCap = Sim.unitsIn(s, capId).filter(u => u.nation === 'enemy');
  assert.strictEqual(startCap.length, 3, 'the Dominion starts with 3 units on its capital');
  Sim.tick(s);
  Sim.tick(s);
  Sim.tick(s);
  startCap.forEach(u => {
    assert.strictEqual(u.provinceId, capId, 'garrison unit ' + u.id + ' must stay on the capital');
  });

  // Part 2: a fresh game with a 4th unit staged onto the capital.
  const s2 = Sim.createGame(151);
  const cap2 = s2.nations.enemy.capitalId;
  const enemyUnits = Sim.unitsOf(s2, 'enemy');
  const capUnits = enemyUnits.filter(u => u.provinceId === cap2);
  assert.strictEqual(capUnits.length, 3);
  const lastCap = capUnits[capUnits.length - 1];
  const lastCapIdx = s2.units.indexOf(lastCap);
  // State.units order decides who is held. Pick an enemy field unit that
  // sits earlier in the array than the last capital unit, so the field
  // unit joins the held 3 and the last capital unit is the one beyond 3.
  const field = s2.units.find((u, i) =>
    u.nation === 'enemy' && u.provinceId !== cap2 && i < lastCapIdx);
  assert.ok(field, 'need an enemy field unit created before the last capital unit');
  field.provinceId = cap2;
  field.order = null;
  assert.strictEqual(Sim.unitsIn(s2, cap2).filter(u => u.nation === 'enemy').length, 4);

  Sim.tick(s2);

  const after = Sim.unitsIn(s2, cap2).filter(u => u.nation === 'enemy');
  assert.strictEqual(after.length, 3, 'exactly 3 units remain as the garrison');
  assert.ok(!after.includes(lastCap), 'the last capital unit in array order is the one that left');
  assert.ok(after.includes(field), 'the staged field unit is held on the capital');
  // The unit beyond 3 drifts one province west of the capital.
  const m = /^p(\d+)_(\d+)$/.exec(cap2);
  assert.ok(m, 'capital id has the pX_Y form');
  const westId = Sim.provinceId(Number(m[1]) - 1, Number(m[2]));
  assert.strictEqual(lastCap.provinceId, westId);
});

test('retool: switching a line template resets progress, keeps the queue, refunds nothing', () => {
  const s = Sim.createGame(157);
  const n = s.nations.player;
  // Baseline for the whole test: 100 steel, no further top-ups.
  n.steel = 100;
  assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true);
  const line = Sim.productionLine(s, 'player', 1);
  assert.strictEqual(line.template, 'infantry');
  // Two funded infantry days at 5 steel each.
  Sim.productionPhase(s, 'player');
  Sim.productionPhase(s, 'player');
  assert.strictEqual(line.progressDays, 2);
  assert.strictEqual(n.steel, 90);
  // Retool to drone: the 10 steel already spent stays spent.
  const res = Sim.assignLineTemplate(s, 'player', 1, 'drone');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.retooled, true);
  assert.strictEqual(line.template, 'drone');
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(line.queue, 1);
  assert.strictEqual(n.steel, 90, 'the retool itself refunds nothing');
  // 90 steel is enough to fund the full 3 day drone build.
  const done = runUntilComplete(s, 'player', 10);
  assert.strictEqual(done.day, 3);
  assert.strictEqual(done.spent, 15);
  assert.strictEqual(done.completed.length, 1);
  assert.strictEqual(done.completed[0].type, 'drone');
  assert.strictEqual(done.completed[0].provinceId, n.capitalId);
  assert.strictEqual(line.queue, 0);
  // Total spend from the 100 steel baseline: 10 before retool plus 15 after.
  assert.strictEqual(100 - n.steel, 10 + 15);
  assert.strictEqual(n.steel, 75);
});

// ---------- Cycle 6 reconciliation: drawn in defenders under reversal ----------

// A busy movement phase with every engagement kind in it: a province
// battle whose defenders had orders elsewhere, a meeting on a road, a
// clash over an empty province, and a plain move.
function busyScenario(reverse) {
  const s = Sim.createGame(77);
  // Checker staging (Cycle 12 step 1): this scenario pins movement
  // and order independence, not the EW launch rule, so both nations
  // start it with empty interceptor stocks. With stock on hand the
  // defending Dominion launches at the attacking drone wing and it
  // dies before the battle, which legitimately changes which
  // defenders take damage. The launch rule's own pins are Cycle 12
  // step 3 work.
  s.nations.player.interceptors = 0;
  s.nations.enemy.interceptors = 0;
  const byId = id => s.units.find(u => u.id === id);
  // Starting ids: player 1 (p3_2 inf), 2 (p3_4 inf), 3 (p4_3 inf), 4 (p4_3 drone),
  // 5 and 6 (capital inf), 7 (capital drone); enemy 8 (p6_2 inf), 9 (p6_4 inf),
  // 10 (p5_3 inf), 11 (p5_3 drone), 12 to 14 on its capital.
  byId(1).provinceId = 'p4_2'; byId(8).provinceId = 'p5_2';
  byId(9).provinceId = 'p5_4';
  Sim.issueOrder(s, 3, 'p5_3'); Sim.issueOrder(s, 4, 'p5_3');   // battle
  Sim.issueOrder(s, 10, 'p5_2'); Sim.issueOrder(s, 11, 'p5_2'); // defenders ordered away
  Sim.issueOrder(s, 1, 'p5_2'); Sim.issueOrder(s, 8, 'p4_2');   // meeting on the road
  Sim.issueOrder(s, 2, 'p4_4'); Sim.issueOrder(s, 9, 'p4_4');   // clash over empty ground
  Sim.issueOrder(s, 7, 'p1_3');                                 // unopposed move
  if (reverse) s.units.reverse();
  Sim.movementPhase(s);
  return s;
}

function snapshot(s) {
  return {
    units: s.units.slice().sort((a, b) => a.id - b.id)
      .map(u => [u.id, u.provinceId, u.strength, u.order]),
    owners: Object.keys(s.provinces).sort().map(k => s.provinces[k].owner),
    log: s.log.map(e => e.msg),
    over: [s.gameOver, s.winner]
  };
}

test('simultaneous battles: every engagement kind is order independent, and ordered defenders still defend', () => {
  const a = busyScenario(false);
  const b = busyScenario(true);
  assert.deepStrictEqual(snapshot(b), snapshot(a));
  const msgs = a.log.map(e => e.msg).join('\n');
  assert.match(msgs, /columns meet on the road/, 'the scenario includes a meeting battle');
  assert.match(msgs, /Columns clash at|win the clash for/, 'the scenario includes a clash');
  // The defenders ordered north were drawn into the defense of p5_3:
  // a battle was fought there, both took damage, and neither marched to p5_2.
  const p53 = a.provinces.p5_3.name;
  assert.ok(new RegExp('(destroyed at|attack on|capture) ' + p53).test(msgs), 'a province battle is fought at ' + p53);
  [10, 11].forEach(id => {
    const u = a.units.find(x => x.id === id);
    assert.ok(u.strength < u.maxStrength, 'defender ' + id + ' fought');
    assert.notStrictEqual(u.provinceId, 'p5_2', 'defender ' + id + ' did not march away');
  });
  // Every order the phase touched is cleared.
  assert.ok(a.units.every(u => u.order === null));
});

test('research clock: with equal points, a player who clicks as soon as the panel allows fields Drone Gen 2 the same day as the AI', () => {
  const s = Sim.createGame(31337);
  const fielded = {};
  while (!s.gameOver && s.day < 40 && !(fielded.player && fielded.enemy)) {
    // The player's click happens before the tick, on the numbers the UI shows.
    if (!s.nations.player.droneGen2 && s.nations.player.researchPoints >= Sim.CFG.droneGen2Cost) {
      Sim.researchDroneGen2(s, 'player');
    }
    const day = s.day;
    Sim.tick(s);
    ['player', 'enemy'].forEach(n => { if (s.nations[n].droneGen2 && fielded[n] == null) fielded[n] = day; });
  }
  assert.ok(fielded.player != null && fielded.enemy != null, 'both nations reach Drone Gen 2');
  assert.strictEqual(fielded.enemy, fielded.player, 'no side gets a head start from tick order');
});

test('economy order: production lines are paid before factories, and idle factory levels are counted', () => {
  const s = Sim.createGame(42);
  const n = s.nations.player;
  // Checker edit: no steel income, so the stockpile is the only steel today.
  Object.values(s.provinces).forEach(p => { if (p.owner === 'player') p.steel = 0; });
  const levels = Sim.factoryLevels(s, 'player');
  assert.ok(levels > 0);
  assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true);
  const drain = Sim.lineSteelPerDay('infantry');
  n.steel = drain; // exactly one line day, nothing left for any factory
  const eq = n.equipment;
  Sim.tick(s);
  assert.strictEqual(Sim.productionLine(s, 'player', 1).progressDays, 1, 'the line was paid');
  assert.strictEqual(Sim.productionLine(s, 'player', 1).stalled, false);
  assert.strictEqual(n.steel, 0);
  assert.strictEqual(n.equipment, eq, 'no factory ran');
  assert.strictEqual(n.factoryLevelsIdle, levels, 'every level sat idle and the count says so');
  // With steel to spare, every level runs and none is idle.
  n.steel = 1000;
  Sim.tick(s);
  assert.strictEqual(n.factoryLevelsIdle, 0);
  assert.strictEqual(n.equipment, eq + levels * Sim.CFG.equipPerFactoryLevel);
});

test('simultaneous battles: occupants of a province under attack stay to defend it, mirror cases resolve the same way', () => {
  const mk = (id, nation, provinceId) => ({ id, nation, type: 'infantry', provinceId, strength: 12, maxStrength: 12,
    order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
  // West side attacks: occupants of p5_3 were ordered to attack p5_4.
  const a = Sim.createGame(5);
  a.provinces.p5_4.owner = 'player';
  a.units = [mk(1, 'player', 'p4_3'), mk(2, 'player', 'p4_3'), mk(3, 'enemy', 'p5_3'), mk(4, 'player', 'p5_4')];
  Sim.issueOrder(a, 1, 'p5_3'); Sim.issueOrder(a, 2, 'p5_3'); Sim.issueOrder(a, 3, 'p5_4');
  Sim.movementPhase(a);
  // East side attacks, the exact mirror: occupants of p4_3 were ordered to attack p4_4.
  const b = Sim.createGame(5);
  b.provinces.p4_4.owner = 'enemy';
  b.units = [mk(1, 'enemy', 'p5_3'), mk(2, 'enemy', 'p5_3'), mk(3, 'player', 'p4_3'), mk(4, 'enemy', 'p4_4')];
  Sim.issueOrder(b, 1, 'p4_3'); Sim.issueOrder(b, 2, 'p4_3'); Sim.issueOrder(b, 3, 'p4_4');
  Sim.movementPhase(b);
  for (const [s, home, away] of [[a, 'p5_3', 'p5_4'], [b, 'p4_3', 'p4_4']]) {
    const occ = s.units.find(u => u.id === 3);
    assert.ok(occ.strength < 12 || occ.provinceId === home, 'the occupant fought at home');
    assert.notStrictEqual(occ.provinceId, away, 'the occupant did not march out');
    assert.strictEqual(s.units.find(u => u.id === 4).strength, 12, 'its own attack never happened');
    assert.ok(s.log.some(e => /after a hard fight|is repelled|destroyed at|cannot advance/.test(e.msg)), 'a battle was fought for ' + home);
    assert.ok(!s.log.some(e => /unopposed/.test(e.msg)), 'nobody walked into an empty province');
  }
});

// ---------- Cycle 7: lore and campaign beats ----------

const Lore = require('../js/lore.js');

// Checker edit used only to set up scenarios: raise a nation's owned
// factories, lowest levels first, until its total reaches `total`.
function raiseFactoriesTo(s, nationId, total) {
  let have = Sim.factoryLevels(s, nationId);
  while (have < total) {
    const p = Object.values(s.provinces)
      .filter(q => q.owner === nationId && q.factoryLevel < Sim.CFG.maxFactoryLevel)
      .sort((a, b) => a.factoryLevel - b.factoryLevel || (a.id < b.id ? -1 : 1))[0];
    p.factoryLevel += 1;
    have += 1;
  }
}

test('lore: every codex entry exists, names match the sim, nation histories are 300 to 500 words', () => {
  const s = Sim.createGame(7);
  assert.deepStrictEqual(Lore.codexOrder, ['ashwater', 'player', 'enemy', 'vesskar', 'khessograd']);
  Lore.codexOrder.forEach(id => {
    const e = Lore.entries[id];
    assert.ok(e && e.title && e.kind && e.text.length > 0, 'entry ' + id);
  });
  assert.strictEqual(Lore.entries.player.title, s.nations.player.name);
  assert.strictEqual(Lore.entries.enemy.title, s.nations.enemy.name);
  assert.strictEqual(Lore.entries.vesskar.title, s.provinces[s.nations.player.capitalId].name);
  assert.strictEqual(Lore.entries.khessograd.title, s.provinces[s.nations.enemy.capitalId].name);
  for (const id of ['player', 'enemy']) {
    const words = Lore.entries[id].text.join(' ').split(/\s+/).length;
    assert.ok(words >= 300 && words <= 500, id + ' history is ' + words + ' words');
  }
});

test('lore: every sim beat has a card with its shipped variants, and no lore copy has an em or en dash', () => {
  assert.deepStrictEqual(Object.keys(Lore.beats).sort(), Sim.BEAT_IDS.slice().sort());
  // Shipped variant sets, Cycle 8 step 0: droneGen2 ships only enemy
  // and both, because symmetric research accrual plus the Dominion
  // researching on the first affordable tick caps the player at a
  // day 21 tie; a player first variant could never fire (see the
  // reachability test below). The other beats ship all three.
  const shipped = {
    capitalRow: ['player', 'enemy', 'both'],
    droneGen2: ['enemy', 'both'],
    line3: ['player', 'enemy', 'both']
  };
  Sim.BEAT_IDS.forEach(id => {
    const b = Lore.beats[id];
    assert.ok(b.title && b.trigger, id);
    assert.deepStrictEqual(Object.keys(b.variants).sort(), shipped[id].slice().sort(), id + ' shipped variants');
    shipped[id].forEach(v => assert.ok(b.variants[v] && b.variants[v].length > 40, id + ' ' + v));
  });
  // The enemy Gen 2 text is grounded in the captured first generation
  // machines, not in a Vessari Gen 2 the Compact may never have fielded.
  assert.ok(/first generation/.test(Lore.beats.droneGen2.variants.enemy), 'enemy Gen 2 text names the first generation origin');
  assert.ok(!/copied from Vessari designs/.test(JSON.stringify(Lore)), 'no lore copy claims Gen 2 was copied from Vessari designs');
  assert.ok(/changes nothing in the game/.test(Lore.noEffect));
  const all = JSON.stringify(Lore);
  assert.ok(!/[\u2013\u2014]/.test(all), 'no em or en dash anywhere in the lore');
});

test('beats: a capital row capture is recorded once, on the day it happens, for the side that took it', () => {
  const s = Sim.createGame(91);
  assert.deepStrictEqual(s.beats, {});
  // Clear the first enemy capital row province and march a player infantry in.
  s.units = s.units.filter(u => u.provinceId !== 'p5_3');
  const inf = s.units.find(u => u.nation === 'player' && u.provinceId === 'p4_3' && u.type === 'infantry');
  Sim.tick(s); // day 1: nothing has changed hands yet
  assert.strictEqual(s.beats.capitalRow, undefined);
  s.units = s.units.filter(u => u.provinceId !== 'p5_3' || u.nation === 'player');
  const day = s.day;
  assert.strictEqual(Sim.issueOrder(s, inf.id, 'p5_3').ok, true);
  Sim.tick(s);
  assert.strictEqual(s.provinces.p5_3.owner, 'player');
  assert.deepStrictEqual(s.beats.capitalRow, { day: day, by: 'player' });
  // Later events never overwrite it.
  s.provinces.p4_3.owner = 'enemy';
  Sim.tick(s);
  assert.deepStrictEqual(s.beats.capitalRow, { day: day, by: 'player' });
});

test('beats: Drone Gen 2 and line 3 record the first side, or both on the same day', () => {
  // Drone Gen 2: the player clicks on the day the points arrive, so both field it that tick.
  const s = Sim.createGame(42);
  while (!s.beats.droneGen2 && s.day < 40) {
    if (!s.nations.player.droneGen2 && s.nations.player.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
    Sim.tick(s);
  }
  assert.strictEqual(s.beats.droneGen2.by, 'both');
  // A player who never researches leaves the beat to the Dominion alone.
  const p = Sim.createGame(42);
  while (!p.beats.droneGen2 && p.day < 40) Sim.tick(p);
  assert.strictEqual(p.beats.droneGen2.by, 'enemy');
  assert.strictEqual(p.beats.droneGen2.day, s.beats.droneGen2.day);
  // Line 3: whoever reaches 16 factory levels first.
  const l = Sim.createGame(42);
  raiseFactoriesTo(l, 'player', Sim.CFG.lineUnlockFactoryLevels[2]);
  const day = l.day;
  Sim.tick(l);
  assert.deepStrictEqual(l.beats.line3, { day: day, by: 'player' });
});

test('beats: every shipped Drone Gen 2 variant can fire through a real campaign path', () => {
  // Cycle 8 step 0 reachability pin, per the Cycle 7 judge flag 1
  // resolution: the set of outcomes real campaigns produce must equal
  // the set of variants js/lore.js ships for this beat. Two profiles on
  // seed 42 through the public paths only: a passive player who never
  // researches (tick only) leaves the beat to the enemy alone, and an
  // eager player who researches the moment the panel numbers allow
  // ties the Dominion on the same day. No staged state either way.
  const fired = {};
  const passive = Sim.createGame(42);
  while (!passive.beats.droneGen2 && passive.day < 40) Sim.tick(passive);
  assert.ok(passive.beats.droneGen2, 'passive campaign records the beat');
  fired[passive.beats.droneGen2.by] = passive.beats.droneGen2.day;
  const eager = Sim.createGame(42);
  while (!eager.beats.droneGen2 && eager.day < 40) {
    if (!eager.nations.player.droneGen2 && eager.nations.player.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(eager, 'player');
    Sim.tick(eager);
  }
  assert.ok(eager.beats.droneGen2, 'eager campaign records the beat');
  fired[eager.beats.droneGen2.by] = eager.beats.droneGen2.day;
  assert.deepStrictEqual(Object.keys(fired).sort(), Object.keys(Lore.beats.droneGen2.variants).sort(),
    'real campaigns fire exactly the shipped variants, no more and no fewer');
  assert.strictEqual(fired.enemy, fired.both, 'both outcomes land on the same day, the research clock tie');
});

test('beats: the same seed and the same commands record the same beats', () => {
  // Master adaptation: the branch test drove the branch harness's
  // factories profile (H.PROFILES.factories), which master's harness
  // does not export (reconciliation slice 1 kept master's harness).
  // The passive profile exists on master in substance: no commands,
  // tick only, and a passive campaign still reaches all three beats,
  // each recorded by the enemy (verified in Cycle 7 step 1).
  const run = () => {
    const s = Sim.createGame(1234);
    while (!s.gameOver) Sim.tick(s);
    return s.beats;
  };
  const a = run();
  assert.deepStrictEqual(Object.keys(a).sort(), Sim.BEAT_IDS.slice().sort(), 'a full campaign reaches all three beats');
  assert.deepStrictEqual(run(), a);
});

test('beats: recording them changes nothing else in a full campaign', () => {
  // Master adaptation, same reason as the determinism test above:
  // a full passive campaign on seed 42, with CFG.campaignBeats on
  // and off, compared as JSON in every field except state.beats.
  const play = (beatsOn) => {
    Sim.CFG.campaignBeats = beatsOn;
    try {
      const s = Sim.createGame(42);
      while (!s.gameOver) Sim.tick(s);
      return s;
    } finally {
      Sim.CFG.campaignBeats = true;
    }
  };
  const on = play(true), off = play(false);
  assert.ok(Object.keys(on.beats).length === 3);
  assert.deepStrictEqual(off.beats, {});
  const strip = s => { const c = Object.assign({}, s); delete c.beats; return JSON.stringify(c); };
  assert.strictEqual(strip(on), strip(off), 'every unit, province, nation, edge, and log line is identical');
});

// ---------- Cycle 8: fortifications ----------

test('fortify: refusals, equipment paid up front, the level arrives after the build days', () => {
  const s = Sim.createGame(7);
  const n = s.nations.player;
  assert.strictEqual(Sim.buildFortification(s, 'player', 'p9_3').reason, 'not your province');
  n.equipment = 50;
  const poor = Sim.buildFortification(s, 'player', 'p1_3');
  assert.strictEqual(poor.ok, false);
  assert.strictEqual(poor.cost, Sim.CFG.fortCostPerLevel);
  n.equipment = 1000;
  const r = Sim.buildFortification(s, 'player', 'p1_3');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(n.equipment, 1000 - Sim.CFG.fortCostPerLevel);
  assert.strictEqual(Sim.buildFortification(s, 'player', 'p1_3').reason, 'fortification already under construction');
  for (let d = 1; d < Sim.CFG.fortBuildDays; d++) { Sim.tick(s); assert.strictEqual(s.provinces.p1_3.fortLevel, 0, 'not yet on day ' + d); }
  Sim.tick(s);
  assert.strictEqual(s.provinces.p1_3.fortLevel, 1);
  assert.strictEqual(s.provinces.p1_3.fortBuild, null);
  // Level 2 costs twice as much; past the cap is refused.
  const before = n.equipment;
  assert.strictEqual(Sim.buildFortification(s, 'player', 'p1_3').cost, 2 * Sim.CFG.fortCostPerLevel);
  assert.strictEqual(n.equipment, before - 2 * Sim.CFG.fortCostPerLevel);
  for (let d = 0; d < Sim.CFG.fortBuildDays; d++) Sim.tick(s);
  assert.strictEqual(s.provinces.p1_3.fortLevel, Sim.CFG.fortMaxLevel);
  assert.strictEqual(Sim.buildFortification(s, 'player', 'p1_3').reason, 'fortification at max level');
});

test('fortify: the bonus is one modifier in unitStats, so stackPower, the battle, and the preview all see it', () => {
  const s = Sim.createGame(7);
  const inf = Sim.unitsIn(s, s.nations.player.capitalId).find(u => u.type === 'infantry');
  const plain = Sim.unitStats(s, inf);
  const stackBefore = Sim.stackPower(s, [inf], 'defense');
  s.provinces[s.nations.player.capitalId].fortLevel = 2; // checker edit for a pure stats check
  const walled = Sim.unitStats(s, inf);
  assert.strictEqual(walled.fortBonus, 2 * Sim.CFG.fortDefensePctPerLevel);
  assert.strictEqual(walled.defense, Math.round(plain.defense * (1 + walled.fortBonus / 100)));
  assert.strictEqual(walled.attack, plain.attack, 'walls never add attack');
  assert.strictEqual(Sim.stackPower(s, [inf], 'defense'), walled.defense);
  assert.ok(Sim.stackPower(s, [inf], 'defense') > stackBefore);
  // An enemy unit standing in that province gets nothing from walls it does not hold.
  const foe = { id: 900, nation: 'enemy', type: 'infantry', provinceId: s.nations.player.capitalId, strength: 12, maxStrength: 12, order: null };
  assert.strictEqual(Sim.unitStats(s, foe).fortBonus, 0);
});

test('fortify: the same attack on a walled province costs the attackers more', () => {
  const play = (fort) => {
    const s = Sim.createGame(5);
    s.units = [];
    const mk = (id, nation, provinceId) => ({ id, nation, type: 'infantry', provinceId, strength: 12, maxStrength: 12,
      order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
    s.units.push(mk(1, 'player', 'p4_3'), mk(2, 'player', 'p4_3'), mk(3, 'enemy', 'p5_3'));
    s.provinces.p5_3.fortLevel = fort;
    Sim.issueOrder(s, 1, 'p5_3'); Sim.issueOrder(s, 2, 'p5_3');
    Sim.movementPhase(s);
    const left = s.units.filter(u => u.nation === 'player').reduce((a, u) => a + u.strength, 0);
    return { owner: s.provinces.p5_3.owner, attackersLeft: left };
  };
  // Same seed, same tick, same engagement key: the rolls are identical, only the walls differ.
  const open = play(0), walled = play(Sim.CFG.fortMaxLevel);
  assert.strictEqual(open.owner, 'player', 'two infantry take an unwalled province from one');
  assert.ok(walled.attackersLeft < open.attackersLeft, 'walls make the attackers pay more: ' + open.attackersLeft + ' left open, ' + walled.attackersLeft + ' walled');
});

test('fortify: the AI walls its capital and its river Spine province through the same command', () => {
  const s = Sim.createGame(42);
  s.nations.enemy.equipment = Sim.CFG.aiFortifyEquipment + 1000;
  Sim.tick(s);
  const cap = s.provinces[s.nations.enemy.capitalId];
  assert.deepStrictEqual(cap.fortBuild, { toLevel: 1, daysLeft: Sim.CFG.fortBuildDays });
  assert.ok(s.log.some(e => /^Khessite begin fortifying Khessograd to level 1/.test(e.msg)), 'the same command logs the same way');
  Sim.tick(s);
  const river = s.provinces[Sim.provinceId(Sim.CFG.mapW / 2, cap.y)];
  assert.ok(river.fortBuild && river.fortBuild.toLevel === 1, 'next it walls the Spine province facing the river');
  // Below the threshold it builds nothing new.
  const p = Sim.createGame(42);
  // The threshold is checked after the day's income, so start well below it.
  p.nations.enemy.equipment = 0;
  Sim.tick(p);
  assert.ok(p.nations.enemy.equipment < Sim.CFG.aiFortifyEquipment);
  assert.ok(!p.provinces[p.nations.enemy.capitalId].fortBuild, 'no walls below the threshold');
});

test('fortify: capture slights the walls by one level and loses any work in progress', () => {
  const s = Sim.createGame(5);
  s.units = [];
  const mk = (id, nation, provinceId) => ({ id, nation, type: 'infantry', provinceId, strength: 12, maxStrength: 12,
    order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
  s.units.push(mk(1, 'player', 'p4_3'));
  s.provinces.p5_3.fortLevel = 2;
  s.provinces.p5_3.fortBuild = null;
  Sim.issueOrder(s, 1, 'p5_3');
  Sim.movementPhase(s); // empty province: an unopposed capture
  assert.strictEqual(s.provinces.p5_3.owner, 'player');
  assert.strictEqual(s.provinces.p5_3.fortLevel, 1);
  // Work in progress is lost on capture.
  s.provinces.p5_4.fortLevel = 0;
  s.provinces.p5_4.fortBuild = { toLevel: 1, daysLeft: 3 };
  assert.strictEqual(Sim.issueOrder(s, 1, 'p5_4').ok, true);
  Sim.movementPhase(s);
  assert.strictEqual(s.provinces.p5_4.owner, 'player');
  assert.strictEqual(s.provinces.p5_4.fortBuild, null);
  assert.strictEqual(s.provinces.p5_4.fortLevel, 0);
});

test('fortify: clash defenders use the walls of the province they enter, not the one they left', () => {
  const mk = (id, nation, provinceId) => ({ id, nation, type: 'infantry', provinceId, strength: 12, maxStrength: 12,
    order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
  const clash = (targetWalls, originWalls) => {
    const s = Sim.createGame(5);
    s.units = [mk(1, 'player', 'p3_4'), mk(2, 'enemy', 'p5_4')];
    s.provinces.p4_4.fortLevel = targetWalls;
    s.provinces.p3_4.fortLevel = originWalls;
    Sim.issueOrder(s, 1, 'p4_4'); Sim.issueOrder(s, 2, 'p4_4');
    Sim.movementPhase(s);
    return JSON.stringify([s.provinces.p4_4.owner, s.units.map(u => u.strength)]);
  };
  const open = clash(0, 0);
  assert.strictEqual(clash(0, 2), open, 'walls back home change nothing in a clash elsewhere');
  assert.notStrictEqual(clash(2, 0), open, 'walls on the contested province change the clash');
});

test('fortify: the Dominion attacks an open province but holds against the same province walled', () => {
  const mk = (id, nation, provinceId) => ({ id, nation, type: 'infantry', provinceId, strength: 12, maxStrength: 12,
    order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
  const aiAttacks = (walls) => {
    const s = Sim.createGame(5);
    s.day = Sim.CFG.aiMobilizationDays + 1; // past mobilization
    s.units = [mk(1, 'player', 'p4_3'), mk(2, 'enemy', 'p5_3'), mk(3, 'enemy', 'p5_3')];
    s.provinces.p4_3.fortLevel = walls;
    s.nations.enemy.equipment = 0; // no wall building of its own this tick
    Sim.tick(s);
    return s.units.filter(u => u.nation === 'enemy').some(u => u.provinceId === 'p4_3') ||
      s.log.some(e => /Khessite (attack on|capture)|A Khessite attack group/.test(e.msg));
  };
  // Attack 8 against defense 4 clears the 1.5x gate; behind level 2 walls the defense is 6 and 8 does not reach 9.
  assert.strictEqual(aiAttacks(0), true, 'two infantry attack one in the open');
  assert.strictEqual(aiAttacks(Sim.CFG.fortMaxLevel), false, 'the same two hold against level 2 walls');
});

test('fortify: walls multiply a stack once, so each level adds its stated percent even for hungry defenders', () => {
  const s = Sim.createGame(5);
  const hungry = id => ({ id, nation: 'player', type: 'infantry', provinceId: 'p1_3', strength: 12, maxStrength: 12, supplyPenalty: 50 });
  const stack = [1, 2, 3, 4, 5, 6].map(hungry);
  const at = L => { s.provinces.p1_3.fortLevel = L; return Sim.stackPower(s, stack, 'defense'); };
  const open = at(0);
  assert.strictEqual(open, 12, 'six infantry at the 50 percent supply penalty defend at 2 each');
  assert.strictEqual(at(1), Math.round(open * (1 + Sim.CFG.fortDefensePctPerLevel / 100)));
  assert.strictEqual(at(2), Math.round(open * (1 + 2 * Sim.CFG.fortDefensePctPerLevel / 100)));
  assert.ok(at(2) > at(1), 'the second level always adds defense');
  // One unit alone reads the same number in its card and in stackPower.
  s.provinces.p1_3.fortLevel = 2;
  assert.strictEqual(Sim.stackPower(s, [stack[0]], 'defense'), Sim.unitStats(s, stack[0]).defense);
});

// ---------- Cycle 9: production line efficiency ramps ----------
// These tests call productionPhase directly, like the Cycle 5 tests,
// except the AI parity test, which goes through Sim.tick, the real
// tick path. Staging a line's efficiency field directly is the test
// equivalent of the work a line has already done; every charge is
// then measured through queueProduction and productionPhase, the
// public path both nations use.

test('efficiency: both nations start at the floor on every standard seed, and a line opened later starts there too', () => {
  const floor = Sim.CFG.lineEfficiencyFloor;
  assert.strictEqual(floor, 100);
  [1, 7, 42, 99, 1234, 555, 2024, 31337].forEach(seed => {
    const s = Sim.createGame(seed);
    ['player', 'enemy'].forEach(nid => {
      s.nations[nid].productionLines.forEach(line => {
        assert.strictEqual(line.efficiency, floor, 'seed ' + seed + ' ' + nid + ' line ' + line.id);
        assert.strictEqual(line.work, 0);
        assert.strictEqual(Sim.lineEfficiency(line), floor);
        assert.strictEqual(Sim.lineWorkPerDay(line), floor);
        assert.strictEqual(Sim.productionWorkNeeded(line.template), Sim.CFG.unitTypes[line.template].buildDays * 100);
        assert.strictEqual(Sim.lineBuildDays(line), Sim.CFG.unitTypes[line.template].buildDays,
          'at the floor the readout is the base days');
        assert.strictEqual(Sim.lineDaysLeft(line), 0, 'nothing queued, nothing left');
      });
    });
  });
  // A line earned at 16 factory levels starts at the floor like any other.
  const s = Sim.createGame(42);
  setFactoryTotal(s, 'player', 16);
  const created = Sim.syncProductionLines(s, 'player');
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].efficiency, floor);
  assert.strictEqual(created[0].work, 0);
  assert.strictEqual(Sim.lineBuildDays(created[0]), Sim.CFG.unitTypes.infantry.buildDays);
});

test('efficiency: a funded day rises by the CFG rise, a stalled day and an idle day rise nothing', () => {
  const s = Sim.createGame(163);
  const n = s.nations.player;
  n.steel = 100;
  Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  const idle = Sim.productionLine(s, 'player', 2);
  const r1 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r1.steelSpent, Sim.lineSteelPerDay('infantry'));
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyFloor + Sim.CFG.lineEfficiencyRisePerDay);
  assert.strictEqual(line.work, 100, 'the first funded day adds work at the efficiency the day started with');
  assert.strictEqual(line.progressDays, 1);
  assert.strictEqual(Sim.lineDaysLeft(line), Math.ceil((600 - 100) / 102));
  // A stalled day: no steel, no work, no rise, the paid work is kept.
  n.steel = 0;
  const r2 = Sim.productionPhase(s, 'player');
  assert.strictEqual(r2.steelSpent, 0);
  assert.strictEqual(line.stalled, true);
  assert.strictEqual(line.efficiency, 102, 'a stalled day earns no efficiency');
  assert.strictEqual(line.work, 100, 'a stalled day adds no work');
  assert.strictEqual(line.progressDays, 1);
  // Funding again resumes the rise from where it held.
  n.steel = 5;
  Sim.productionPhase(s, 'player');
  assert.strictEqual(line.stalled, false);
  assert.strictEqual(line.work, 100 + 102);
  assert.strictEqual(line.efficiency, 104);
  // The idle line earned nothing on any of those days.
  assert.strictEqual(idle.efficiency, Sim.CFG.lineEfficiencyFloor);
  assert.strictEqual(idle.work, 0);
});

test('efficiency: the cap is reached after the stated funded days and never passed', () => {
  const daysToCap = (Sim.CFG.lineEfficiencyCap - Sim.CFG.lineEfficiencyFloor) / Sim.CFG.lineEfficiencyRisePerDay;
  assert.strictEqual(daysToCap, 25, 'the CFG numbers state 25 funded working days to full efficiency');
  const s = Sim.createGame(42);
  const n = s.nations.player;
  n.steel = 10000;
  for (let i = 0; i < Sim.CFG.maxQueuePerLine; i++) Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  for (let day = 1; day <= daysToCap - 1; day++) Sim.productionPhase(s, 'player');
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyCap - Sim.CFG.lineEfficiencyRisePerDay,
    'one funded day short of the cap');
  Sim.productionPhase(s, 'player');
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyCap, 'the cap on the 25th funded day');
  for (let day = 0; day < 10; day++) Sim.productionPhase(s, 'player');
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyCap, 'never above the cap');
  assert.ok(line.queue > 0, 'the line was funded on every one of those days, so the cap was earned, not staged');
});

test('efficiency: the charged number through productionPhase equals the shared readout at the floor, the mid ramp, and the cap, for both templates', () => {
  // The mid ramp is 130, the staged mid ramp of the step 2 panel check.
  const cases = [
    { eff: Sim.CFG.lineEfficiencyFloor, infantryDays: 6, droneDays: 3 },
    { eff: 130, infantryDays: 5, droneDays: 3 },
    { eff: Sim.CFG.lineEfficiencyCap, infantryDays: 4, droneDays: 2 }
  ];
  cases.forEach(c => {
    [['infantry', 1, c.infantryDays], ['drone', 2, c.droneDays]].forEach(([template, lineId, expectedDays]) => {
      const s = Sim.createGame(167);
      const n = s.nations.player;
      n.steel = 1000;
      const line = Sim.productionLine(s, 'player', lineId);
      line.efficiency = c.eff;
      line.work = 0;
      const readout = Sim.lineBuildDays(line);
      assert.strictEqual(readout, expectedDays, template + ' readout at ' + c.eff + ' percent');
      const q = Sim.queueProduction(s, 'player', lineId);
      assert.strictEqual(q.ok, true);
      assert.strictEqual(q.buildDays, readout, 'queueProduction quotes the readout');
      assert.strictEqual(q.cost, Sim.CFG.unitTypes[template].steelCost, 'the listed steel cost never changes');
      const done = runUntilComplete(s, 'player', 20);
      assert.strictEqual(done.day, readout, template + ' at ' + c.eff + ' percent is charged the readout days');
      assert.strictEqual(done.spent, expectedDays * Sim.lineSteelPerDay(template),
        'steel actually paid is the charged days times the unchanged daily drain');
      assert.strictEqual(done.completed[0].type, template);
      assert.strictEqual(done.completed[0].provinceId, n.capitalId);
    });
  });
});

test('efficiency: the readout is exact, charged days equal it at every efficiency, and the band case is pinned', () => {
  // lineBuildDays is exact in funded days (Cycle 10 step 0): it
  // iterates the documented rise the same way productionPhase
  // charges it, so the days charged through productionPhase equal
  // the readout at every efficiency for both templates, not merely
  // never longer than it.
  for (let eff = Sim.CFG.lineEfficiencyFloor; eff <= Sim.CFG.lineEfficiencyCap; eff++) {
    [['infantry', 1], ['drone', 2]].forEach(([template, lineId]) => {
      const s = Sim.createGame(173);
      s.nations.player.steel = 1000;
      const line = Sim.productionLine(s, 'player', lineId);
      line.efficiency = eff;
      line.work = 0;
      const readout = Sim.lineBuildDays(line);
      const q = Sim.queueProduction(s, 'player', lineId);
      assert.strictEqual(q.buildDays, readout, template + ' at ' + eff + ': queue quotes the readout');
      const done = runUntilComplete(s, 'player', 20);
      assert.strictEqual(done.day, readout, template + ' at ' + eff + ': ' + done.day + ' funded days, readout ' + readout);
      assert.strictEqual(done.spent, done.day * Sim.lineSteelPerDay(template));
    });
  }
  // The band case from the Cycle 9 judge Flag 1: infantry staged at
  // 118 percent quotes 5 and is charged 5 funded days for 25 steel,
  // because the rising work crosses the 600 point need on day 5.
  const s = Sim.createGame(179);
  s.nations.player.steel = 1000;
  const line = Sim.productionLine(s, 'player', 1);
  line.efficiency = 118;
  line.work = 0;
  assert.strictEqual(Sim.lineBuildDays(line), 5);
  const q = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(q.buildDays, 5);
  const done = runUntilComplete(s, 'player', 20);
  assert.strictEqual(done.day, 5);
  assert.strictEqual(done.spent, 25);
  // An in progress lineDaysLeft case in the same band, pinned equal
  // to the funded days actually remaining: at 118 percent with 118
  // work already paid, 482 points remain; the rising days add 118,
  // 120, 122, and 124, so exactly 4 funded days remain.
  const s2 = Sim.createGame(181);
  s2.nations.player.steel = 1000;
  const line2 = Sim.productionLine(s2, 'player', 1);
  line2.efficiency = 118;
  line2.work = 0;
  Sim.queueProduction(s2, 'player', 1);
  Sim.productionPhase(s2, 'player');
  assert.strictEqual(line2.work, 118);
  assert.strictEqual(line2.efficiency, 120);
  // Restart the band measurement from a clean in progress state at
  // 118 percent with one day of work in, as a player would see it.
  line2.efficiency = 118;
  assert.strictEqual(Sim.lineDaysLeft(line2), 4);
  const done2 = runUntilComplete(s2, 'player', 20);
  assert.strictEqual(done2.day, 4);
  assert.strictEqual(done2.spent, 20);
});

test('efficiency: retooling drops efficiency to the floor and scraps the work together, and a same template assign loses nothing', () => {
  const s = Sim.createGame(181);
  const n = s.nations.player;
  n.steel = 100;
  Sim.queueProduction(s, 'player', 1);
  const line = Sim.productionLine(s, 'player', 1);
  Sim.productionPhase(s, 'player');
  // Assigning the template the line already has is not a retool.
  const same = Sim.assignLineTemplate(s, 'player', 1, 'infantry');
  assert.strictEqual(same.ok, true);
  assert.strictEqual(same.retooled, false);
  assert.strictEqual(line.efficiency, 102, 'no efficiency is lost when nothing is retooled');
  assert.strictEqual(line.work, 100);
  Sim.productionPhase(s, 'player');
  assert.strictEqual(line.efficiency, 104);
  assert.strictEqual(line.work, 202);
  assert.strictEqual(line.progressDays, 2);
  assert.strictEqual(n.steel, 90);
  // A real retool: efficiency to the floor, work and progress scrapped
  // together, the queue carries over, and no steel is refunded.
  const res = Sim.assignLineTemplate(s, 'player', 1, 'drone');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.retooled, true);
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyFloor);
  assert.strictEqual(line.work, 0);
  assert.strictEqual(line.progressDays, 0);
  assert.strictEqual(line.queue, 1);
  assert.strictEqual(n.steel, 90, 'the retool refunds nothing, as before');
  assert.strictEqual(Sim.lineBuildDays(line), Sim.CFG.unitTypes.drone.buildDays,
    'the next unit is quoted at the floor again');
  const done = runUntilComplete(s, 'player', 10);
  assert.strictEqual(done.day, 3, 'the drone after a retool takes its full base days');
  assert.strictEqual(done.spent, 15);
  assert.strictEqual(100 - n.steel, 10 + 15);
});

test('efficiency: AI parity through the real tick path, same rise, same work, same charged days at the cap', () => {
  const s = Sim.createGame(191);
  ['player', 'enemy'].forEach(nid => {
    s.nations[nid].steel = 200;
    const line = Sim.productionLine(s, nid, 1);
    line.efficiency = 130;
    line.work = 0;
  });
  const qp = Sim.queueProduction(s, 'player', 1);
  const qe = Sim.queueProduction(s, 'enemy', 1);
  assert.strictEqual(qe.buildDays, qp.buildDays);
  assert.strictEqual(qe.buildDays, 5);
  assert.strictEqual(qe.cost, qp.cost);
  Sim.tick(s);
  ['player', 'enemy'].forEach(nid => {
    const line = Sim.productionLine(s, nid, 1);
    assert.strictEqual(line.efficiency, 132, nid + ' line 1 rose by the same rise through the tick');
    assert.strictEqual(line.work, 130, nid + ' line 1 added work at its starting efficiency');
    assert.strictEqual(line.progressDays, 1);
    assert.strictEqual(line.queue, 1);
    assert.strictEqual(line.stalled, false);
  });
  // And at the cap both nations are charged the same ramped days
  // through productionPhase: a drone in 2 funded days for 10 steel.
  const t = Sim.createGame(193);
  ['player', 'enemy'].forEach(nid => {
    t.nations[nid].steel = 1000;
    const line = Sim.productionLine(t, nid, 2);
    line.efficiency = Sim.CFG.lineEfficiencyCap;
    line.work = 0;
    assert.strictEqual(Sim.queueProduction(t, nid, 2).buildDays, 2);
  });
  const pr = runUntilComplete(t, 'player', 10);
  const er = runUntilComplete(t, 'enemy', 10);
  assert.strictEqual(pr.day, 2);
  assert.strictEqual(er.day, 2);
  assert.strictEqual(pr.spent, 10);
  assert.strictEqual(er.spent, 10);
  assert.strictEqual(pr.completed[0].provinceId, t.nations.player.capitalId);
  assert.strictEqual(er.completed[0].provinceId, t.nations.enemy.capitalId);
});

// ---------- Cycle 10: recurring event texture ----------
// The drivers below are adapted from tools/balance.js (the harness's
// sensible script, plus its fortress wall spending), public sim
// commands only, so the campaign level pins in this section run the
// same profiles the Cycle 10 step 1 reachability tally ran. Staging a
// line's efficiency or a conversion's final day is a checker edit in
// the Cycle 9 pattern; every charge, completion, and recording then
// goes through the real productionPhase or a real tick.

function texProv(id) { const m = /^p(\d+)_(\d+)$/.exec(id); return { x: +m[1], y: +m[2] }; }
function texNeighborToward(s, unit, targetId) {
  const t = texProv(targetId);
  const here = s.provinces[unit.provinceId];
  let best = null, bestScore = null;
  Sim.neighborsOf(s, here).forEach(p => {
    const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
    const score = d * 100 + Math.abs(p.y - 3) * 10 - p.x;
    if (bestScore === null || score < bestScore) { bestScore = score; best = p; }
  });
  return best;
}
function texFortifyHome(s) {
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
function texSensibleDay(s, withForts) {
  const n = s.nations.player;
  if (!n.droneGen2 && n.researchPoints >= Sim.CFG.droneGen2Cost) Sim.researchDroneGen2(s, 'player');
  if (Sim.factoryLevels(s, 'player') < 16) {
    const income = Sim.steelIncome(s, 'player');
    const upkeepAfter = (Sim.factoryLevels(s, 'player') + 1) * Sim.CFG.steelPerFactoryLevel;
    if (income - upkeepAfter - 15 >= 5) {
      const owned = Object.values(s.provinces).filter(p => p.owner === 'player' && p.x <= 4 && p.factoryLevel < Sim.CFG.maxFactoryLevel);
      owned.sort((a, b) => (a.factoryLevel - b.factoryLevel) || (a.x - b.x));
      for (const p of owned) {
        const cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
        if (n.equipment >= cost) { Sim.buildFactory(s, 'player', p.id); break; }
      }
    }
  }
  if (withForts) texFortifyHome(s);
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
  if (!s._texGarrison) {
    s._texGarrison = Sim.unitsIn(s, n.capitalId).filter(u => u.nation === 'player' && u.type === 'infantry').slice(0, 2).map(u => u.id);
  }
  const row3 = Object.values(s.provinces).filter(p => p.owner === 'player' && p.y === 3);
  row3.sort((a, b) => b.x - a.x);
  const staging = row3[0];
  if (!staging) return;
  const atStaging = Sim.unitsIn(s, staging.id).filter(u => u.nation === 'player' && !s._texGarrison.includes(u.id));
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
    if (s._texGarrison.includes(u.id)) return;
    if (u.provinceId === staging.id) {
      if (attackTarget) Sim.issueOrder(s, u.id, attackTarget);
      return;
    }
    const next = texNeighborToward(s, u, staging.id);
    if (next && next.id !== u.provinceId && next.owner === 'player') Sim.issueOrder(s, u.id, next.id);
  });
}
function texRunCampaign(seed, profile) {
  const s = Sim.createGame(seed);
  let days = 0;
  while (!s.gameOver && days < 200) {
    if (profile === 'sensible') texSensibleDay(s, false);
    else if (profile === 'fortress') texSensibleDay(s, true);
    Sim.tick(s);
    days++;
  }
  return s;
}

test('lore textures: every sim texture id has a card shipping exactly the player and enemy variants, and no texture copy has an em or en dash', () => {
  assert.deepStrictEqual(Object.keys(Lore.textures).sort(), Sim.TEXTURE_IDS.slice().sort());
  Sim.TEXTURE_IDS.forEach(id => {
    const c = Lore.textures[id];
    assert.ok(c.title && c.trigger, id);
    // No both variant: occurrences are recorded per side as they
    // happen, not per day, so a both variant is a shape the recording
    // never produces (Cycle 10 step 1).
    assert.deepStrictEqual(Object.keys(c.variants).sort(), ['enemy', 'player'], id + ' shipped variants');
    ['player', 'enemy'].forEach(v => assert.ok(c.variants[v] && c.variants[v].length > 40, id + ' ' + v));
  });
  assert.ok(/changes nothing in the game/.test(Lore.noEffect), 'textures print under the same no effect sentence as the beats');
  const all = JSON.stringify(Lore.textures);
  assert.ok(!/[\u2013\u2014]/.test(all), 'no em or en dash anywhere in the texture copy');
});

test('lore capitals: both capital entries describe both endings, in the sim own end wording', () => {
  // Sim end texts (js/sim.js): a fallen player capital reads "Your
  // capital has fallen. The Compact is finished.", a captured enemy
  // capital "Enemy capital captured. The Dominion collapses.", and
  // the campaign end "Campaign ends. Your capital still stands. A
  // hard, grinding survival."
  const vesskar = Lore.entries.vesskar.text.join(' ');
  const khessograd = Lore.entries.khessograd.text.join(' ');
  assert.ok(/If Vesskar City falls/.test(vesskar) && /Compact is finished/.test(vesskar), 'Vesskar entry describes its fall');
  assert.ok(/still stands when the campaign ends on day 150/.test(vesskar) && /hard, grinding survival/.test(vesskar), 'Vesskar entry describes the day 150 survival');
  assert.ok(/If Khessograd falls/.test(khessograd) && /Dominion collapses/.test(khessograd), 'Khessograd entry describes its fall');
  assert.ok(/still stands when the campaign ends on day 150/.test(khessograd) && /claim intact/.test(khessograd), 'Khessograd entry describes the day 150 survival');
});

test('textures: a finished fortification records once per completion, on its day, for the side that built it, and a second completion is a second entry', () => {
  const s = Sim.createGame(42);
  s.nations.player.equipment = 1000;
  const cap = s.nations.player.capitalId;
  assert.strictEqual(Sim.buildFortification(s, 'player', cap).ok, true);
  for (let i = 0; i < 5; i++) Sim.tick(s);
  assert.deepStrictEqual(s.textures.filter(t => t.id === 'fortCompleted' && t.by === 'player'),
    [{ id: 'fortCompleted', day: 5, by: 'player' }], 'level 1 completes and records on day 5');
  assert.strictEqual(Sim.buildFortification(s, 'player', cap).ok, true);
  for (let i = 0; i < 5; i++) Sim.tick(s);
  assert.deepStrictEqual(s.textures.filter(t => t.id === 'fortCompleted' && t.by === 'player'),
    [{ id: 'fortCompleted', day: 5, by: 'player' }, { id: 'fortCompleted', day: 10, by: 'player' }],
    'the raise to level 2 is a second entry on its own day, not swallowed by a once only rule');
});

test('textures: a finished rail conversion records on its day for the converting side, and a second conversion is a second entry', () => {
  // Checker edit: two captured stretches of rail are staged on their
  // final conversion day (the conversion state a real capture sets
  // up, four days earlier). Each completion then goes through a real
  // tick and its constructionPhase.
  const s = Sim.createGame(42);
  const railEdges = s.edgeList.filter(e => e.rail && e.rail.daysLeft === 0);
  const e1 = railEdges[0], e2 = railEdges[1];
  e1.rail = { owner: 'enemy', daysLeft: 0, converting: { to: 'player', daysLeft: 1 } };
  Sim.tick(s);
  assert.strictEqual(e1.rail.owner, 'player');
  e2.rail = { owner: 'player', daysLeft: 0, converting: { to: 'enemy', daysLeft: 1 } };
  Sim.tick(s);
  assert.strictEqual(e2.rail.owner, 'enemy');
  assert.deepStrictEqual(s.textures, [
    { id: 'railConverted', day: 1, by: 'player' },
    { id: 'railConverted', day: 2, by: 'enemy' }
  ], 'each conversion records once, on its day, for its own side, in firing order');
});

test('textures: a line reaching full efficiency records once at the crossing, for both nations, and resting at the cap records nothing more', () => {
  const s = Sim.createGame(42);
  const line = Sim.productionLine(s, 'player', 1);
  line.efficiency = 148; // checker edit: work the line has already done
  s.nations.player.steel = 100;
  assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true);
  Sim.productionPhase(s, 'player');
  assert.strictEqual(line.efficiency, Sim.CFG.lineEfficiencyCap);
  assert.deepStrictEqual(s.textures, [{ id: 'lineCapped', day: 1, by: 'player' }]);
  // A funded day at the cap is not a new crossing.
  s.nations.player.steel = 100;
  assert.strictEqual(Sim.queueProduction(s, 'player', 1).ok, true);
  Sim.productionPhase(s, 'player');
  assert.deepStrictEqual(s.textures, [{ id: 'lineCapped', day: 1, by: 'player' }], 'resting at the cap does not refire');
  // The enemy crosses through the same productionPhase path.
  const eline = Sim.productionLine(s, 'enemy', 2);
  eline.efficiency = 148;
  s.nations.enemy.steel = 100;
  assert.strictEqual(Sim.queueProduction(s, 'enemy', 2).ok, true);
  Sim.productionPhase(s, 'enemy');
  assert.deepStrictEqual(s.textures, [
    { id: 'lineCapped', day: 1, by: 'player' },
    { id: 'lineCapped', day: 1, by: 'enemy' }
  ]);
});

test('textures: every shipped variant fires through real campaigns, and no campaign fires an unshipped one', () => {
  // Campaign level set equality pin, in the Cycle 8 step 0 pattern:
  // three full campaigns on seed 42 through public commands only
  // (passive, and the harness sensible and fortress profiles adapted
  // above). Step 1 tally scope: passive proves the enemy fort and
  // rail variants, sensible the player rail and both line variants,
  // fortress the player fort variant.
  const fired = {};
  ['passive', 'sensible', 'fortress'].forEach(profile => {
    const s = texRunCampaign(42, profile);
    assert.ok(s.gameOver, profile + ' campaign completes');
    assert.ok(s.textures.length > 0, profile + ' campaign records texture');
    s.textures.forEach(t => {
      assert.ok(Sim.TEXTURE_IDS.includes(t.id), profile + ' records a known texture id');
      if (!fired[t.id]) fired[t.id] = {};
      fired[t.id][t.by] = true;
    });
  });
  Sim.TEXTURE_IDS.forEach(id => {
    assert.deepStrictEqual(Object.keys(fired[id] || {}).sort(), Object.keys(Lore.textures[id].variants).sort(),
      id + ': real campaigns fire exactly the shipped variants, no more and no fewer');
  });
});

test('textures: the same seed and the same commands record the same occurrences', () => {
  const passiveA = texRunCampaign(42, 'passive');
  const passiveB = texRunCampaign(42, 'passive');
  // Cycle 12 step 1 repin: the count was 10 before the EW cycle.
  // The new combat mechanic changes this real campaign (one more
  // rail conversion, and the Dominion's first line now reaches full
  // efficiency on day 29 as interceptor losses keep its lines
  // working), so it records 12 occurrences. Formal re-verification
  // of the campaign pins is Cycle 12 step 3 work.
  assert.strictEqual(passiveA.textures.length, 12, 'a passive seed 42 campaign records its 12 occurrences');
  assert.deepStrictEqual(passiveB.textures, passiveA.textures);
  const sensibleA = texRunCampaign(42, 'sensible');
  const sensibleB = texRunCampaign(42, 'sensible');
  assert.ok(sensibleA.textures.length > 0);
  assert.deepStrictEqual(sensibleB.textures, sensibleA.textures);
});

test('textures: recording them changes nothing else in a full campaign', () => {
  const play = (texturesOn) => {
    Sim.CFG.campaignTextures = texturesOn;
    try {
      return texRunCampaign(42, 'passive');
    } finally {
      Sim.CFG.campaignTextures = true;
    }
  };
  const on = play(true), off = play(false);
  assert.strictEqual(on.textures.length, 12); // Cycle 12 step 1 repin, see the determinism test above
  assert.deepStrictEqual(off.textures, []);
  const strip = s => { const c = Object.assign({}, s); delete c.textures; return JSON.stringify(c); };
  assert.strictEqual(strip(on), strip(off), 'every unit, province, nation, edge, beat, and log line is identical');
});

// ---------- Cycle 11: manpower ----------
// Manpower is paid in full at queue time through queueProduction,
// the one ordering path both nations share, and accrues in
// incomePhase at one CFG rate per owned province. Staging a pool
// directly is a checker edit in the Cycle 9 pattern; every charge,
// refusal, and accrual then goes through the public path. The
// accrual test pins the player's accrual through incomePhase and
// the intake formula for both nations through the shared readout;
// the Dominion's accrual through the real tick is pinned by the
// parity test at the end of this section, which is what makes the
// step's non vacuity mutant (intake accrued only for the player)
// fail exactly that one test.

test('manpower: both nations start at the CFG pool on every standard seed, intake is owned provinces times the CFG rate for both, and costs trace to CFG', () => {
  [1, 7, 42, 99, 1234, 555, 2024, 31337].forEach(seed => {
    const s = Sim.createGame(seed);
    ['player', 'enemy'].forEach(nid => {
      assert.strictEqual(Sim.manpowerPool(s, nid), Sim.CFG.manpowerStart, 'seed ' + seed + ' ' + nid + ' starting pool');
      const owned = Object.values(s.provinces).filter(p => p.owner === nid).length;
      assert.strictEqual(Sim.manpowerIntake(s, nid), owned * Sim.CFG.manpowerPerProvincePerDay,
        'seed ' + seed + ' ' + nid + ' intake is its owned provinces times the one CFG rate');
    });
  });
  assert.strictEqual(Sim.manpowerCost('infantry'), Sim.CFG.unitTypes.infantry.manpowerCost);
  assert.strictEqual(Sim.manpowerCost('drone'), Sim.CFG.unitTypes.drone.manpowerCost);
  assert.ok(Sim.manpowerCost('drone') > 0, 'a drone wing costs a crew, not zero: zero would make drones a manpower bypass');
  assert.ok(Sim.manpowerCost('infantry') > Sim.manpowerCost('drone'), 'infantry costs substantially more than a drone crew');
});

test('manpower accrual: incomePhase adds exactly the intake each day, and captured ground raises intake while lost ground lowers it', () => {
  const s = Sim.createGame(42);
  const intake0 = Sim.manpowerIntake(s, 'player');
  assert.ok(intake0 > 0);
  Sim.incomePhase(s, 'player');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), Sim.CFG.manpowerStart + intake0, 'one day accrues exactly one intake');
  Sim.incomePhase(s, 'player');
  Sim.incomePhase(s, 'player');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), Sim.CFG.manpowerStart + 3 * intake0, 'accrual sums over days');
  // Capture and loss, as ownership flips: the same province moves
  // the gainer's intake up and the loser's down by the CFG rate,
  // by the identical formula for both nations (the readouts), and
  // the player's next accrual uses the new intake.
  const gained = Object.values(s.provinces).find(p => p.owner === 'enemy');
  const enemyIntake0 = Sim.manpowerIntake(s, 'enemy');
  gained.owner = 'player';
  assert.strictEqual(Sim.manpowerIntake(s, 'player'), intake0 + Sim.CFG.manpowerPerProvincePerDay, 'captured ground raises intake');
  assert.strictEqual(Sim.manpowerIntake(s, 'enemy'), enemyIntake0 - Sim.CFG.manpowerPerProvincePerDay, 'lost ground lowers intake');
  const poolBefore = Sim.manpowerPool(s, 'player');
  Sim.incomePhase(s, 'player');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), poolBefore + intake0 + Sim.CFG.manpowerPerProvincePerDay,
    'the day after a capture accrues at the raised intake');
});

test('manpower payment: an infantry order deducts exactly its CFG cost at queue time, a drone order its crew cost, and steel is not charged at queue time', () => {
  const s = Sim.createGame(42);
  const steel0 = s.nations.player.steel;
  const inf = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(inf.ok, true);
  assert.strictEqual(inf.manpowerCost, Sim.CFG.unitTypes.infantry.manpowerCost);
  assert.strictEqual(Sim.manpowerPool(s, 'player'), Sim.CFG.manpowerStart - Sim.CFG.unitTypes.infantry.manpowerCost,
    'the infantry cost is paid in full at queue time');
  const dro = Sim.queueProduction(s, 'player', 2);
  assert.strictEqual(dro.ok, true);
  assert.strictEqual(dro.manpowerCost, Sim.CFG.unitTypes.drone.manpowerCost);
  assert.strictEqual(Sim.manpowerPool(s, 'player'),
    Sim.CFG.manpowerStart - Sim.CFG.unitTypes.infantry.manpowerCost - Sim.CFG.unitTypes.drone.manpowerCost,
    'the drone crew cost is paid on top, at its own smaller number');
  assert.strictEqual(Sim.productionLine(s, 'player', 1).queue, 1);
  assert.strictEqual(Sim.productionLine(s, 'player', 2).queue, 1);
  assert.strictEqual(s.nations.player.steel, steel0, 'steel still drains over build days, never at queue time');
});

test('manpower gate: an order the pool cannot pay is rejected with the numbered reason and charges nothing, and topping up by exactly the shortfall makes the same order succeed', () => {
  const s = Sim.createGame(42);
  s.nations.player.manpower = Sim.CFG.unitTypes.infantry.manpowerCost - 1; // checker edit: a pool 1 short
  const logLen = s.log.length;
  const r = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.manpower, true);
  assert.strictEqual(r.manpowerCost, Sim.CFG.unitTypes.infantry.manpowerCost);
  assert.strictEqual(r.current, Sim.CFG.unitTypes.infantry.manpowerCost - 1);
  assert.strictEqual(r.missing, 1);
  assert.strictEqual(r.reason, 'Not enough manpower to queue a ' + Sim.CFG.unitTypes.infantry.label +
    '. It costs ' + r.manpowerCost + ' manpower, you have ' + r.current + ', you are 1 short.');
  assert.strictEqual(Sim.productionLine(s, 'player', 1).queue, 0, 'a rejected order queues nothing');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), r.current, 'a rejected order deducts nothing');
  assert.strictEqual(s.log.length, logLen, 'a rejected order logs nothing');
  s.nations.player.manpower += r.missing; // top up by exactly the shortfall
  const ok = Sim.queueProduction(s, 'player', 1);
  assert.strictEqual(ok.ok, true, 'the same order succeeds once the shortfall is covered');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), 0, 'and it pays the full cost, leaving nothing');
  assert.strictEqual(Sim.productionLine(s, 'player', 1).queue, 1);
});

test('manpower binding: queueing ahead on seed 42 pays for 13 orders and the 14th attempt is rejected for manpower, public commands only', () => {
  // The recorded binding trace for Cycle 11 step 3, pinned here:
  // the starting pool is a reserve, not decoration. Filling line 1
  // to its queue cap with infantry and queueing drone wings on
  // line 2 spends 9 times 120 plus 4 times 25, and the next order
  // is refused by the pool alone (both queues still have room on
  // line 2, and steel is never charged at queue time).
  const s = Sim.createGame(42);
  let paid = 0, count = 0;
  for (let i = 0; i < 9; i++) {
    const r = Sim.queueProduction(s, 'player', 1);
    assert.strictEqual(r.ok, true, 'infantry order ' + (i + 1));
    paid += r.manpowerCost; count++;
  }
  let rejected = null;
  for (let i = 0; i < 9 && !rejected; i++) {
    const r = Sim.queueProduction(s, 'player', 2);
    if (r.ok) { paid += r.manpowerCost; count++; } else rejected = r;
  }
  assert.strictEqual(count, 13, '13 orders are paid before the pool binds');
  assert.strictEqual(paid, 9 * Sim.CFG.unitTypes.infantry.manpowerCost + 4 * Sim.CFG.unitTypes.drone.manpowerCost);
  assert.strictEqual(Sim.manpowerPool(s, 'player'), Sim.CFG.manpowerStart - paid);
  assert.ok(rejected, 'the 14th attempt is rejected');
  assert.strictEqual(rejected.manpower, true);
  assert.strictEqual(rejected.template, 'drone');
  assert.strictEqual(rejected.current, Sim.CFG.manpowerStart - paid);
  assert.strictEqual(rejected.missing, Sim.CFG.unitTypes.drone.manpowerCost - rejected.current);
  assert.strictEqual(Sim.productionLine(s, 'player', 1).queue, 9);
  assert.strictEqual(Sim.productionLine(s, 'player', 2).queue, 4, 'the rejected order queued nothing');
});

test('manpower retool: switching a line with queued orders settles the manpower difference per queued order, and a short pool rejects the retool unchanged', () => {
  const s = Sim.createGame(42);
  assert.strictEqual(Sim.queueProduction(s, 'player', 2).ok, true); // one drone wing paid at the crew cost
  const poolAfterQueue = Sim.manpowerPool(s, 'player');
  const diff = Sim.CFG.unitTypes.infantry.manpowerCost - Sim.CFG.unitTypes.drone.manpowerCost;
  const up = Sim.assignLineTemplate(s, 'player', 2, 'infantry');
  assert.strictEqual(up.ok, true);
  assert.strictEqual(up.manpowerDelta, diff, 'retooling to the dearer template charges the difference for the queued order');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), poolAfterQueue - diff);
  assert.strictEqual(Sim.productionLine(s, 'player', 2).queue, 1, 'the queue carries over the retool');
  const back = Sim.assignLineTemplate(s, 'player', 2, 'drone');
  assert.strictEqual(back.ok, true);
  assert.strictEqual(back.manpowerDelta, -diff, 'retooling back refunds the difference');
  assert.strictEqual(Sim.manpowerPool(s, 'player'), poolAfterQueue, 'a round trip retool costs nothing in manpower');
  // A retool the pool cannot settle is rejected with the numbers
  // and changes nothing: no discount path through the panel.
  const t = Sim.createGame(42);
  assert.strictEqual(Sim.queueProduction(t, 'player', 2).ok, true);
  t.nations.player.manpower = diff - 50; // checker edit: 50 short of the settlement
  const no = Sim.assignLineTemplate(t, 'player', 2, 'infantry');
  assert.strictEqual(no.ok, false);
  assert.strictEqual(no.manpower, true);
  assert.strictEqual(no.missing, 50);
  assert.strictEqual(Sim.productionLine(t, 'player', 2).template, 'drone', 'the line keeps its template');
  assert.strictEqual(Sim.manpowerPool(t, 'player'), diff - 50, 'and the pool is untouched');
});

test('manpower parity: the Dominion pays the same costs through queueProduction and accrues the same intake through the real tick path', () => {
  const s = Sim.createGame(42);
  ['player', 'enemy'].forEach(nid => { s.nations[nid].steel = 500; });
  const pi = Sim.queueProduction(s, 'player', 1), ei = Sim.queueProduction(s, 'enemy', 1);
  const pd = Sim.queueProduction(s, 'player', 2), ed = Sim.queueProduction(s, 'enemy', 2);
  assert.strictEqual(ei.manpowerCost, pi.manpowerCost, 'the Dominion pays the infantry cost, no discount');
  assert.strictEqual(ed.manpowerCost, pd.manpowerCost, 'the Dominion pays the drone crew cost, no discount');
  assert.strictEqual(Sim.manpowerPool(s, 'enemy'), Sim.manpowerPool(s, 'player'), 'identical orders leave identical pools');
  const intakeP = Sim.manpowerIntake(s, 'player'), intakeE = Sim.manpowerIntake(s, 'enemy');
  assert.strictEqual(intakeE, intakeP, 'identical ground gives identical intake');
  const poolP = Sim.manpowerPool(s, 'player'), poolE = Sim.manpowerPool(s, 'enemy');
  Sim.tick(s);
  assert.strictEqual(Sim.manpowerPool(s, 'player'), poolP + intakeP, 'the player accrues its intake through the tick');
  assert.strictEqual(Sim.manpowerPool(s, 'enemy'), poolE + intakeE, 'the Dominion accrues its intake through the same tick');
  assert.strictEqual(Sim.manpowerPool(s, 'enemy'), Sim.manpowerPool(s, 'player'), 'pools stay equal after one real tick');
});

// ---------- Cycle 12: drones, EW, interceptors, and the exchange ----------
// Launches live inside fightRounds, the shared combat path, and every
// destruction and launch is priced in steel from CFG into the record
// only exchange ledger. Staging a nation's stock, a unit's strength,
// or a generation field directly is a checker edit in the Cycle 9
// pattern; every battle then goes through Sim.resolveBattle, the
// public combat path, and every charge goes through queueProduction,
// productionPhase, researchDroneGen3, researchJamming, or a real tick.
// Mutant partition, chosen before these tests were written: the
// mirrored parity test at the end of this section is the only test
// here that asserts an enemy suffered figure from a battle where the
// Dominion defends; every other launch and ledger test stages the
// Compact as the defender (or asserts a suffered figure of zero for
// an attacking enemy, which no launch can change). That is what
// makes the step's non vacuity mutant (interceptor launches free for
// the enemy: its suffered is never recorded) fail exactly that one
// test, and no other.

test('drones and EW: a stocked defender launches one interceptor per attacking drone wing, up to its stock, the drones die to the interceptors, and their attack never counts', () => {
  // Stock covers both wings: both die before the first round, so the
  // defender stands at full strength when the battle ends.
  const s = Sim.createGame(42);
  const drones = Sim.unitsOf(s, 'player').filter(u => u.type === 'drone').sort((a, b) => a.id - b.id);
  assert.strictEqual(drones.length, 2);
  const def = Sim.unitsOf(s, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
  const defStrength = def.strength;
  Sim.resolveBattle(s, drones, [def], Sim.makeRng(99));
  assert.strictEqual(Sim.interceptorStock(s, 'enemy'), Sim.CFG.interceptorStart - 2, 'one launch per attacking drone wing');
  drones.forEach(d => assert.strictEqual(d.strength, 0, 'drone wing ' + d.id + ' died to an interceptor'));
  assert.strictEqual(def.strength, defStrength, 'the targeted drones attack never counted, so the defender took no battle damage');
  // Stock for only one wing: exactly one launch, the lowest unit id
  // is targeted first, and the surviving wing fights the battle.
  const t = Sim.createGame(42);
  t.nations.enemy.interceptors = 1;
  const tdrones = Sim.unitsOf(t, 'player').filter(u => u.type === 'drone').sort((a, b) => a.id - b.id);
  const tdef = Sim.unitsOf(t, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
  tdef.strength = 1; // checker edit: a defender the surviving wing finishes
  Sim.resolveBattle(t, tdrones, [tdef], Sim.makeRng(99));
  assert.strictEqual(Sim.interceptorStock(t, 'enemy'), 0, 'launches stop at the stock on hand');
  assert.strictEqual(tdrones[0].strength, 0, 'the lowest id drone wing is the first target');
  assert.ok(tdrones[1].strength > 0, 'the wing no interceptor reached fought on and lived');
  assert.strictEqual(tdef.strength, 0, 'and it finished the weakened defender in battle');
  assert.ok(t.log.some(l => l.msg.includes('launch 1 interceptor (' + Sim.interceptorCost() + ' steel)')),
    'the launch is logged with its count and its steel');
});

test('drones and EW: an infantry only attack launches nothing, and an attack against an empty stock launches nothing and fights as before', () => {
  const s = Sim.createGame(42);
  const atk = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(4, 3));
  const def = Sim.unitsOf(s, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
  def.strength = 1;
  Sim.resolveBattle(s, [atk], [def], Sim.makeRng(99));
  assert.strictEqual(def.strength, 0);
  assert.ok(atk.strength > 0);
  assert.strictEqual(Sim.interceptorStock(s, 'enemy'), Sim.CFG.interceptorStart, 'no drones in the attack, no launches, ever');
  assert.strictEqual(Sim.exchangeForced(s, 'player'), 0);
  assert.strictEqual(Sim.exchangeSuffered(s, 'enemy'), 0);
  // Empty stock: the drone wing fights the battle itself.
  const t = Sim.createGame(42);
  t.nations.enemy.interceptors = 0;
  const drone = Sim.unitsOf(t, 'player').find(u => u.type === 'drone' && u.provinceId === Sim.provinceId(4, 3));
  const tdef = Sim.unitsOf(t, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
  tdef.strength = 1;
  Sim.resolveBattle(t, [drone], [tdef], Sim.makeRng(99));
  assert.strictEqual(tdef.strength, 0, 'with no stock the drone kills in battle as it did before Cycle 12');
  assert.ok(drone.strength > 0);
  assert.strictEqual(Sim.interceptorStock(t, 'enemy'), 0);
  assert.strictEqual(Sim.exchangeForced(t, 'player'), 0);
  assert.strictEqual(Sim.exchangeSuffered(t, 'enemy'), 0);
});

test('drones and EW: one interceptor costs more than three drone wings in steel, by the margin step 1 recorded', () => {
  const droneSteel = Sim.CFG.unitTypes.drone.steelCost;
  const intSteel = Sim.interceptorCost();
  assert.strictEqual(intSteel, Sim.CFG.unitTypes.interceptor.steelCost, 'the launch price is the template CFG steel cost, no second price list');
  assert.ok(intSteel > 3 * droneSteel, 'one forced launch bleeds more steel than three drone wings cost: ' + intSteel + ' against ' + droneSteel + ' each');
  assert.strictEqual((intSteel / droneSteel).toFixed(2), '3.33', 'the recorded margin: 50 steel against 15, 3.33 times');
  assert.strictEqual(intSteel - droneSteel, 35, 'so a drone wing that dies forcing one launch still nets its owner 35 steel on that fact alone');
  assert.ok(Sim.CFG.unitTypes.interceptor.manpowerCost > 0, 'the interceptor template also carries a manpower price, paid through the same queue gate');
});

test('drones and EW: the exchange ledger is exact for an interceptor kill and for a battle death, counts an interceptor kill once, and is deterministic', () => {
  const droneSteel = Sim.CFG.unitTypes.drone.steelCost;
  const infSteel = Sim.CFG.unitTypes.infantry.steelCost;
  const intSteel = Sim.interceptorCost();
  // The Compact defends: an enemy drone wing dies to an interceptor.
  const stagedIntercept = () => {
    const s = Sim.createGame(42);
    const drone = Sim.unitsOf(s, 'enemy').find(u => u.type === 'drone');
    const def = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(4, 3));
    Sim.resolveBattle(s, [drone], [def], Sim.makeRng(99));
    return { s, drone, def };
  };
  const a = stagedIntercept();
  assert.strictEqual(a.drone.strength, 0);
  assert.strictEqual(a.def.strength, a.def.maxStrength, 'the intercepted drones attack never counted');
  assert.strictEqual(Sim.interceptorStock(a.s, 'player'), Sim.CFG.interceptorStart - 1);
  assert.deepStrictEqual(Sim.exchangeRecord(a.s, 'player'),
    { destroyed: droneSteel, lost: 0, forced: 0, suffered: intSteel, net: droneSteel - intSteel },
    'the defender destroyed one drone wing, priced once at its CFG steel, and suffered one launch at the interceptor CFG steel');
  assert.deepStrictEqual(Sim.exchangeRecord(a.s, 'enemy'),
    { destroyed: 0, lost: droneSteel, forced: intSteel, suffered: 0, net: intSteel - droneSteel },
    'the attacker lost the wing once, never again as a battle death, and forced the launch');
  ['player', 'enemy'].forEach(nid => {
    const r = Sim.exchangeRecord(a.s, nid);
    assert.strictEqual(r.net, r.destroyed + r.forced - r.lost - r.suffered, nid + ' net is its stated definition');
    assert.strictEqual(Sim.exchangeNet(a.s, nid), r.net);
  });
  assert.strictEqual(Sim.exchangeDestroyed(a.s, 'player'), droneSteel);
  assert.strictEqual(Sim.exchangeLost(a.s, 'enemy'), droneSteel);
  assert.strictEqual(Sim.exchangeForced(a.s, 'enemy'), intSteel);
  assert.strictEqual(Sim.exchangeSuffered(a.s, 'player'), intSteel);
  // Two identical staged battles give identical ledgers.
  const b = stagedIntercept();
  assert.deepStrictEqual(Sim.exchangeRecord(b.s, 'player'), Sim.exchangeRecord(a.s, 'player'));
  assert.deepStrictEqual(Sim.exchangeRecord(b.s, 'enemy'), Sim.exchangeRecord(a.s, 'enemy'));
  // A plain battle death with no stock on either side prices at the
  // template CFG steel, and no launch figure moves.
  const t = Sim.createGame(42);
  t.nations.player.interceptors = 0;
  t.nations.enemy.interceptors = 0;
  const atk = Sim.unitsOf(t, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
  const def = Sim.unitsOf(t, 'player').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(4, 3));
  def.strength = 1;
  Sim.resolveBattle(t, [atk], [def], Sim.makeRng(99));
  assert.strictEqual(def.strength, 0);
  assert.ok(atk.strength > 0);
  assert.deepStrictEqual(Sim.exchangeRecord(t, 'enemy'),
    { destroyed: infSteel, lost: 0, forced: 0, suffered: 0, net: infSteel });
  assert.deepStrictEqual(Sim.exchangeRecord(t, 'player'),
    { destroyed: 0, lost: infSteel, forced: 0, suffered: 0, net: -infSteel });
});

test('drones and EW: the effectiveness readout returns the stated percent at differences of plus 1, 0, and minus 1, clamps at its cap and floor, and touches drone wings only', () => {
  const s = Sim.createGame(42);
  assert.strictEqual(Sim.droneGeneration(s, 'player'), 1);
  assert.strictEqual(Sim.jammingGeneration(s, 'enemy'), 0);
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), 100 + Sim.CFG.ewStepPct, 'difference plus 1 at the start: 125 percent');
  s.nations.enemy.jammingGen = 1; // checker edit: the opposing jamming generation
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), 100, 'difference 0: 100 percent');
  s.nations.enemy.jammingGen = 2;
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), 100 - Sim.CFG.ewStepPct, 'difference minus 1: 75 percent');
  // unitStats carries the readout, and infantry is never touched.
  const drone = Sim.unitsOf(s, 'player').find(u => u.type === 'drone');
  assert.deepStrictEqual(Sim.unitStats(s, drone), { attack: 2, defense: 2, supplyPenalty: 0, fortBonus: 0 },
    'at 75 percent the Gen 1 base stats 3 and 2 round to 2 and 2');
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  assert.deepStrictEqual(Sim.unitStats(s, inf), { attack: 4, defense: 4, supplyPenalty: 0, fortBonus: 0 },
    'jamming affects drone wings only, never infantry');
  s.nations.enemy.jammingGen = 1;
  assert.deepStrictEqual(Sim.unitStats(s, drone), { attack: 3, defense: 2, supplyPenalty: 0, fortBonus: 0 },
    'at difference 0 the drone fights at its printed base stats');
  s.nations.enemy.jammingGen = 0;
  assert.deepStrictEqual(Sim.unitStats(s, drone), { attack: 4, defense: 3, supplyPenalty: 0, fortBonus: 0 },
    'at difference plus 1 the drone fights at 125 percent');
  // The cap binds inside the shipped ranges: Gen 3 against no jamming
  // is a difference of plus 3, 175 clamped to the cap.
  s.nations.player.droneGen2 = true;
  s.nations.player.droneGen3 = true;
  assert.strictEqual(Sim.droneGeneration(s, 'player'), 3);
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), Sim.CFG.ewCapPct, 'difference plus 3 clamps to the 150 cap');
  // The floor cannot bind with the shipped generation ranges (the
  // lowest reachable difference is minus 1, 75 percent), so it is
  // pinned here with a staged jamming generation beyond Gen 2, which
  // exercises the clamp arithmetic and nothing else.
  s.nations.player.droneGen2 = false;
  s.nations.player.droneGen3 = false;
  s.nations.enemy.jammingGen = 3;
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), Sim.CFG.ewFloorPct, 'difference minus 2 reaches the 50 floor');
  s.nations.enemy.jammingGen = 4;
  assert.strictEqual(Sim.droneEffectiveness(s, 'player'), Sim.CFG.ewFloorPct, 'difference minus 3 would be 25, clamped to the floor');
});

test('drones and EW: a battle fought through the readout deals the readout numbers', () => {
  // The same staged battle and the same rng seed at two generations:
  // the only change is the generation, so the defender outcome moves
  // by exactly the readout and base stat numbers the preview quotes.
  const staged = (gen2) => {
    const s = Sim.createGame(42);
    s.nations.player.interceptors = 0;
    s.nations.enemy.interceptors = 0;
    if (gen2) s.nations.player.droneGen2 = true;
    const drone = Sim.unitsOf(s, 'player').find(u => u.type === 'drone' && u.provinceId === Sim.provinceId(4, 3));
    const def = Sim.unitsOf(s, 'enemy').find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(5, 3));
    const pow = Sim.stackPower(s, [drone], 'attack');
    Sim.resolveBattle(s, [drone], [def], Sim.makeRng(99));
    return { pow, drone, def };
  };
  const g1 = staged(false);
  assert.strictEqual(g1.pow, 4, 'Gen 1 at 125 percent: stackPower attack is the readout number 4');
  assert.strictEqual(g1.drone.strength, 0);
  assert.strictEqual(g1.def.strength, 5, 'the Gen 1 wing dies leaving the defender at 5 under this rng seed');
  const g2 = staged(true);
  assert.strictEqual(g2.pow, 8, 'Gen 2 at 150 percent: stackPower attack is the readout number 8');
  assert.strictEqual(g2.drone.strength, 0);
  assert.strictEqual(g2.def.strength, 0, 'the Gen 2 wing deals the readout numbers and destroys the defender before it dies');
});

test('drones and EW: research gating, Gen 3 refused without Gen 2, jamming bought in order, points deducted exactly, identical costs for both nations', () => {
  const s = Sim.createGame(42);
  s.nations.player.researchPoints = 500;
  const noGen2 = Sim.researchDroneGen3(s, 'player');
  assert.strictEqual(noGen2.ok, false, 'Drone Gen 3 is refused without Drone Gen 2');
  assert.ok(/requires Drone Gen 2/.test(noGen2.reason));
  assert.strictEqual(s.nations.player.researchPoints, 500, 'a refused purchase deducts nothing');
  assert.strictEqual(Sim.droneGeneration(s, 'player'), 1);
  // Insufficient points refuse the same way once Gen 2 is held.
  s.nations.player.droneGen2 = true; // checker edit: the prerequisite, earned in play by the test above's own path in real campaigns
  s.nations.player.researchPoints = Sim.CFG.droneGen3Cost - 1;
  assert.strictEqual(Sim.researchDroneGen3(s, 'player').ok, false);
  assert.strictEqual(s.nations.player.researchPoints, Sim.CFG.droneGen3Cost - 1);
  s.nations.player.researchPoints = Sim.CFG.droneGen3Cost;
  assert.strictEqual(Sim.researchDroneGen3(s, 'player').ok, true);
  assert.strictEqual(s.nations.player.researchPoints, 0, 'Gen 3 deducts exactly its CFG cost');
  assert.strictEqual(Sim.droneGeneration(s, 'player'), 3);
  assert.strictEqual(Sim.researchDroneGen3(s, 'player').ok, false, 'and it cannot be bought twice');
  // Jamming, in order, for the player.
  const j = Sim.createGame(42);
  j.nations.player.researchPoints = Sim.CFG.jammingCosts[0] - 1;
  assert.strictEqual(Sim.researchJamming(j, 'player').ok, false, 'one point short refuses Jamming Gen 1');
  assert.strictEqual(Sim.jammingGeneration(j, 'player'), 0);
  j.nations.player.researchPoints = Sim.CFG.jammingCosts[0];
  const j1 = Sim.researchJamming(j, 'player');
  assert.strictEqual(j1.ok, true);
  assert.strictEqual(j1.generation, 1, 'the first jamming purchase is Gen 1, never Gen 2');
  assert.strictEqual(j.nations.player.researchPoints, 0, 'Gen 1 deducts exactly the first CFG jamming cost');
  j.nations.player.researchPoints = Sim.CFG.jammingCosts[1];
  const j2 = Sim.researchJamming(j, 'player');
  assert.strictEqual(j2.ok, true);
  assert.strictEqual(j2.generation, 2);
  assert.strictEqual(j.nations.player.researchPoints, 0, 'Gen 2 deducts exactly the second CFG jamming cost');
  j.nations.player.researchPoints = 500;
  assert.strictEqual(Sim.researchJamming(j, 'player').ok, false, 'there is no third jamming generation to buy');
  // The Dominion pays the identical numbers through the same functions.
  const e = Sim.createGame(42);
  e.nations.enemy.droneGen2 = true;
  e.nations.enemy.researchPoints = Sim.CFG.droneGen3Cost;
  assert.strictEqual(Sim.researchDroneGen3(e, 'enemy').ok, true);
  assert.strictEqual(e.nations.enemy.researchPoints, 0, 'the Dominion pays the same Gen 3 cost, no discount');
  assert.strictEqual(Sim.droneGeneration(e, 'enemy'), 3);
  e.nations.enemy.researchPoints = Sim.CFG.jammingCosts[0] + Sim.CFG.jammingCosts[1];
  assert.strictEqual(Sim.researchJamming(e, 'enemy').generation, 1);
  assert.strictEqual(Sim.researchJamming(e, 'enemy').generation, 2);
  assert.strictEqual(e.nations.enemy.researchPoints, 0, 'the Dominion pays the same two jamming costs in the same order');
});

test('drones and EW: an Interceptor is built only through the priced production path, completes into the stockpile on the stated day for the stated steel, and deploys no unit, for both nations', () => {
  ['player', 'enemy'].forEach(nid => {
    const s = Sim.createGame(42);
    s.nations[nid].steel = 500;
    assert.strictEqual(Sim.assignLineTemplate(s, nid, 1, 'interceptor').ok, true);
    const q = Sim.queueProduction(s, nid, 1);
    assert.strictEqual(q.ok, true, nid + ' queues an Interceptor through queueProduction');
    assert.strictEqual(q.cost, Sim.CFG.unitTypes.interceptor.steelCost);
    assert.strictEqual(q.manpowerCost, Sim.CFG.unitTypes.interceptor.manpowerCost);
    assert.strictEqual(q.buildDays, Sim.CFG.unitTypes.interceptor.buildDays, 'at the floor the readout quotes the base build days');
    assert.strictEqual(Sim.manpowerPool(s, nid), Sim.CFG.manpowerStart - q.manpowerCost, 'manpower is paid at queue time, as for any template');
    const unitCount = s.units.length;
    for (let day = 1; day < Sim.CFG.unitTypes.interceptor.buildDays; day++) {
      Sim.productionPhase(s, nid);
      assert.strictEqual(Sim.interceptorStock(s, nid), Sim.CFG.interceptorStart, nid + ' stock unchanged on day ' + day);
    }
    Sim.productionPhase(s, nid);
    assert.strictEqual(Sim.interceptorStock(s, nid), Sim.CFG.interceptorStart + 1,
      nid + ' the finished Interceptor joins the stockpile on the ' + Sim.CFG.unitTypes.interceptor.buildDays + 'th funded day');
    assert.strictEqual(s.units.length, unitCount, 'no map unit ever deployed');
    assert.strictEqual(s.nations[nid].steel, 500 - Sim.CFG.unitTypes.interceptor.steelCost,
      'exactly the listed steel was drained over the build, at the unchanged daily drain');
  });
});

test('drones and EW: mirrored parity, the same staged battle with the nations swapped gives mirrored ledgers and the same stock spent', () => {
  // This is the section's mutant target test (see the header): the
  // only assertion of an enemy suffered figure for a defending
  // Dominion in this section lives here.
  const droneSteel = Sim.CFG.unitTypes.drone.steelCost;
  const intSteel = Sim.interceptorCost();
  const staged = (attacker) => {
    const s = Sim.createGame(42);
    const defender = attacker === 'player' ? 'enemy' : 'player';
    const drone = Sim.unitsOf(s, attacker).find(u => u.type === 'drone' && u.provinceId === Sim.provinceId(attacker === 'player' ? 4 : 5, 3));
    const def = Sim.unitsOf(s, defender).find(u => u.type === 'infantry' && u.provinceId === Sim.provinceId(attacker === 'player' ? 5 : 4, 3));
    Sim.resolveBattle(s, [drone], [def], Sim.makeRng(99));
    return {
      s,
      atkRecord: Sim.exchangeRecord(s, attacker),
      defRecord: Sim.exchangeRecord(s, defender),
      stockLeft: Sim.interceptorStock(s, defender),
      defStrength: def.strength,
      droneStrength: drone.strength
    };
  };
  const p = staged('player');
  assert.deepStrictEqual(p.atkRecord, { destroyed: 0, lost: droneSteel, forced: intSteel, suffered: 0, net: intSteel - droneSteel });
  assert.deepStrictEqual(p.defRecord, { destroyed: droneSteel, lost: 0, forced: 0, suffered: intSteel, net: droneSteel - intSteel },
    'the Dominion defending suffers the same launch price the Compact suffers in the mirror');
  const e = staged('enemy');
  assert.deepStrictEqual(e.atkRecord, p.atkRecord, 'the enemy attacking records exactly what the player attacking recorded: role for role, the ledgers are the same');
  assert.deepStrictEqual(e.defRecord, p.defRecord, 'and the enemy defending in the first staging records exactly what the player defending records here');
  assert.strictEqual(e.stockLeft, p.stockLeft, 'both defenders spent exactly one interceptor from the same starting stock');
  assert.strictEqual(e.defStrength, p.defStrength);
  assert.strictEqual(e.droneStrength, p.droneStrength);
});

test('drones and EW: AI parity through the real tick path, the Dominion researches jamming and replenishes interceptors through the same priced paths', () => {
  // Research: staged with Gen 2 held and exactly the Gen 1 price on
  // hand, one real tick leaves the Dominion at Jamming Gen 1, its
  // points spent at the start of the tick on start of day numbers
  // and then regrown by the day's income at the flat CFG rate.
  const s = Sim.createGame(42);
  s.nations.enemy.droneGen2 = true; // checker edit: the state a real campaign reaches on day 21
  s.nations.enemy.researchPoints = Sim.CFG.jammingCosts[0];
  Sim.tick(s);
  assert.strictEqual(Sim.jammingGeneration(s, 'enemy'), 1, 'the Dominion bought Jamming Gen 1 through the tick');
  assert.strictEqual(s.nations.enemy.researchPoints, Sim.CFG.researchPerDay,
    'it paid the full CFG cost, not a discounted one: the pool is the day income that landed after the purchase');
  assert.strictEqual(Sim.jammingGeneration(s, 'player'), 0, 'the player has no auto purchase; its research is its own clicks at the same prices pinned above');
  // Replenishment: with its stock staged at 1, one real tick leaves
  // the Dominion's line 2 retooled to Interceptors with one order
  // queued through queueProduction, at the shared manpower prices.
  const t = Sim.createGame(42);
  t.nations.enemy.interceptors = 1;
  const intake = Sim.manpowerIntake(t, 'enemy');
  Sim.tick(t);
  const line2 = Sim.productionLine(t, 'enemy', 2);
  assert.strictEqual(line2.template, 'interceptor', 'line 2 retooled to Interceptors by the stated spending rule');
  assert.strictEqual(line2.queue, 1, 'and one Interceptor was queued through the shared path');
  assert.strictEqual(Sim.interceptorStock(t, 'enemy'), 1, 'the stock itself lands only when the build completes, five funded days on');
  assert.strictEqual(Sim.manpowerPool(t, 'enemy'),
    Sim.CFG.manpowerStart + intake - Sim.manpowerCost('infantry') - Sim.manpowerCost('interceptor'),
    'the tick charged the Dominion the shared queue prices: an infantry order on line 1 and the Interceptor on line 2, no discount');
});
