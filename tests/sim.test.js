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
  const before = Sim.unitStats(s, drone);
  assert.deepStrictEqual(before, { attack: 3, defense: 2, supplyPenalty: 0 });
  s.nations.player.researchPoints = Sim.CFG.droneGen2Cost;
  const res = Sim.researchDroneGen2(s, 'player');
  assert.strictEqual(res.ok, true);
  const after = Sim.unitStats(s, drone);
  assert.deepStrictEqual(after, { attack: Sim.CFG.droneGen2.attack, defense: Sim.CFG.droneGen2.defense, supplyPenalty: 0 });
  // Infantry is untouched by drone research.
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  assert.deepStrictEqual(Sim.unitStats(s, inf), { attack: 4, defense: 4, supplyPenalty: 0 });
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
