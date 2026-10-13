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
  assert.deepStrictEqual(before, { attack: 3, defense: 2, supplyPenalty: 0, fortBonus: 0, jamming: 0 });
  s.nations.player.researchPoints = Sim.CFG.droneGen2Cost;
  const res = Sim.researchDroneGen2(s, 'player');
  assert.strictEqual(res.ok, true);
  const after = Sim.unitStats(s, drone);
  assert.deepStrictEqual(after, { attack: Sim.CFG.droneGen2.attack, defense: Sim.CFG.droneGen2.defense, supplyPenalty: 0, fortBonus: 0, jamming: 0 });
  // Infantry is untouched by drone research.
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  assert.deepStrictEqual(Sim.unitStats(s, inf), { attack: 4, defense: 4, supplyPenalty: 0, fortBonus: 0, jamming: 0 });
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

test('lore: every sim beat has a card with all three variants, and no lore copy has an em or en dash', () => {
  assert.deepStrictEqual(Object.keys(Lore.beats).sort(), Sim.BEAT_IDS.slice().sort());
  Sim.BEAT_IDS.forEach(id => {
    const b = Lore.beats[id];
    assert.ok(b.title && b.trigger, id);
    ['player', 'enemy', 'both'].forEach(v => assert.ok(b.variants[v] && b.variants[v].length > 40, id + ' ' + v));
  });
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

test('beats: the same seed and the same commands record the same beats', () => {
  const H = require('../tools/balance.js');
  const run = () => {
    const s = Sim.createGame(1234); const mem = {};
    while (!s.gameOver) { H.PROFILES.factories.play(Sim, s, mem); Sim.tick(s); }
    return s.beats;
  };
  const a = run();
  assert.deepStrictEqual(Object.keys(a).sort(), Sim.BEAT_IDS.slice().sort(), 'a full campaign reaches all three beats');
  assert.deepStrictEqual(run(), a);
});

test('beats: recording them changes nothing else in a full campaign', () => {
  const H = require('../tools/balance.js');
  const play = (beatsOn) => {
    Sim.CFG.campaignBeats = beatsOn;
    try {
      const s = Sim.createGame(42); const mem = {};
      while (!s.gameOver) { H.PROFILES.factories.play(Sim, s, mem); Sim.tick(s); }
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
  // Ordered at the start of the tick and worked one day in that tick's
  // construction phase, exactly like a player's order made before the tick.
  assert.deepStrictEqual(cap.fortBuild, { toLevel: 1, daysLeft: Sim.CFG.fortBuildDays - 1 });
  const mine = Sim.createGame(42);
  mine.nations.player.equipment = 1000;
  Sim.buildFortification(mine, 'player', mine.nations.player.capitalId);
  Sim.tick(mine);
  assert.deepStrictEqual(mine.provinces[mine.nations.player.capitalId].fortBuild, cap.fortBuild, 'same day, same progress for both sides');
  assert.ok(s.log.some(e => /^Khessite begin fortifying Khessograd to level 1/.test(e.msg)), 'the same command logs the same way');
  Sim.tick(s);
  const river = s.provinces[Sim.provinceId(Sim.CFG.mapW / 2, cap.y)];
  assert.ok(river.fortBuild && river.fortBuild.toLevel === 1, 'next it walls the Spine province facing the river');
  // Below the threshold it builds nothing new.
  const p = Sim.createGame(42);
  // The threshold is checked at the start of the tick, before the day's income; start well below it anyway.
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

// ---------- Cycle 9: one clock for both sides ----------

test('one clock: the same order from the player and the AI on the same day starts, pays, and finishes on the same day', () => {
  // Production: both nations start with idle lines; the player queues
  // before tick 1, the Dominion queues at the start of tick 1. The first
  // unit on each line must complete on the same day for both.
  const p = Sim.createGame(42);
  [p.nations.player, p.nations.enemy].forEach(n => { n.steel = 1000; });
  Sim.queueProduction(p, 'player', 1);
  Sim.queueProduction(p, 'player', 2);
  const firstDone = { player: {}, enemy: {} };
  for (let d = 1; d <= Sim.CFG.unitTypes.infantry.buildDays; d++) {
    const day = p.day, seen = new Set(p.log);
    Sim.tick(p);
    p.log.filter(e => !seen.has(e)).forEach(e => {
      const m = /^(Vessari|Khessite) line (\d) completes/.exec(e.msg);
      if (m) { const nat = m[1] === 'Vessari' ? 'player' : 'enemy'; if (firstDone[nat][m[2]] == null) firstDone[nat][m[2]] = day; }
    });
  }
  assert.strictEqual(firstDone.player['1'], Sim.CFG.unitTypes.infantry.buildDays, 'the player infantry finishes on its last build day');
  assert.strictEqual(firstDone.player['2'], Sim.CFG.unitTypes.drone.buildDays, 'the player drone finishes on its last build day');
  assert.deepStrictEqual(firstDone.enemy, firstDone.player, 'the Dominion first units finish on the same days');
  // Factories: on a day the Dominion's rule fires (every third day), the
  // player builds the same level; both count it in that day's output.
  const f = Sim.createGame(42);
  while (f.day % 3 !== 0) Sim.tick(f);
  // 200 equipment: enough for the Dominion's factory rule (140), not for
  // its wall rule (300); steel to spare so every factory level runs.
  [f.nations.player, f.nations.enemy].forEach(n => { n.steel = 1000; n.equipment = 200; });
  const before = { player: Sim.factoryLevels(f, 'player'), enemy: Sim.factoryLevels(f, 'enemy') };
  const levelsBefore = {}; Object.values(f.provinces).forEach(q => { levelsBefore[q.id] = q.factoryLevel; });
  const eqBefore = { player: 200, enemy: 200 };
  const target = Object.values(f.provinces).find(q => q.owner === 'player' && q.factoryLevel === 0);
  assert.strictEqual(Sim.buildFactory(f, 'player', target.id).ok, true);
  eqBefore.player = 200; // measure from before the click: the cost is part of the day
  const fday = f.day;
  Sim.tick(f);
  ['player', 'enemy'].forEach(nat => {
    assert.strictEqual(Sim.factoryLevels(f, nat), before[nat] + 1, nat + ' gained one level on day ' + fday);
    assert.ok(f.log.some(e => e.day === fday && new RegExp('^' + f.nations[nat].short + ' raise a factory').test(e.msg)), nat + ' logged it on day ' + fday);
    const raised = Object.values(f.provinces).find(q => q.owner === nat && q.factoryLevel === levelsBefore[q.id] + 1);
    const cost = Sim.CFG.factoryCostPerLevel * raised.factoryLevel;
    const output = Sim.CFG.equipPerFactoryLevel * Sim.factoryLevels(f, nat);
    assert.strictEqual(f.nations[nat].equipment - eqBefore[nat], output - cost,
      nat + ': the new level already produces on the day it is built');
  });
  // Rail: on a day the Dominion's rule fires (every fourth day), the
  // player lays one edge too; both finish on the same day.
  const r = Sim.createGame(42);
  while (r.day % 4 !== 0) Sim.tick(r);
  [r.nations.player, r.nations.enemy].forEach(n => { n.steel = 1000; });
  const bare = r.edgeList.find(e => !e.rail && r.provinces[e.a].owner === 'player' && r.provinces[e.b].owner === 'player');
  assert.strictEqual(Sim.buildRail(r, 'player', bare.a, bare.b).ok, true);
  const railDay = r.day;
  const enemyRailsBefore = new Set(r.edgeList.filter(e => e.rail && e.rail.owner === 'enemy').map(e => e.a + e.b));
  Sim.tick(r);
  const theirs = r.edgeList.find(e => e.rail && e.rail.owner === 'enemy' && !enemyRailsBefore.has(e.a + e.b));
  assert.ok(theirs, 'the Dominion laid an edge on day ' + railDay);
  assert.strictEqual(theirs.rail.daysLeft, bare.rail.daysLeft, 'both rails stand at the same days left after the same tick');
  while (bare.rail.daysLeft > 0) Sim.tick(r);
  assert.strictEqual(theirs.rail.daysLeft, 0, 'and finish on the same day');
});

test('one clock: a new Dominion unit waits a tick before it moves, like a new player unit', () => {
  const s = Sim.createGame(42);
  const known = new Set(s.units.map(u => u.id));
  let fresh = 0;
  while (!s.gameOver && s.day < 40) {
    Sim.tick(s);
    Sim.unitsOf(s, 'enemy').forEach(u => {
      if (known.has(u.id)) return;
      known.add(u.id);
      fresh += 1;
      assert.strictEqual(u.provinceId, s.nations.enemy.capitalId, 'unit ' + u.id + ' built on day ' + (s.day - 1) + ' is still at the capital that night');
    });
    s.units.forEach(u => known.add(u.id));
  }
  assert.ok(fresh >= 5, 'the Dominion built units in this window');
});

// ---------- Cycle 10: air defense, interception, and the steel ledger ----------
const mkU = (id, nation, type, provinceId, strength) => {
  const t = Sim.CFG.unitTypes[type];
  return { id, nation, type, provinceId, strength: strength == null ? t.strength : strength, maxStrength: t.strength,
    order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 };
};

test('air defense: refusals, equipment paid up front, it stands after the build days, capture loses it', () => {
  const s = Sim.createGame(7);
  const n = s.nations.player;
  assert.strictEqual(Sim.buildAirDefense(s, 'player', 'p9_3').reason, 'not your province');
  n.equipment = Sim.CFG.airDefenseCost - 1;
  const poor = Sim.buildAirDefense(s, 'player', 'p1_3');
  assert.strictEqual(poor.reason, 'not enough equipment');
  assert.strictEqual(poor.cost, Sim.CFG.airDefenseCost);
  n.equipment = 1000;
  assert.strictEqual(Sim.buildAirDefense(s, 'player', 'p1_3').ok, true);
  assert.strictEqual(n.equipment, 1000 - Sim.CFG.airDefenseCost);
  assert.strictEqual(Sim.buildAirDefense(s, 'player', 'p1_3').reason, 'air defense already under construction');
  for (let d = 1; d < Sim.CFG.airDefenseBuildDays; d++) { Sim.tick(s); assert.strictEqual(s.provinces.p1_3.airDefense, 0, 'not yet on day ' + d); }
  Sim.tick(s);
  assert.strictEqual(s.provinces.p1_3.airDefense, 1);
  assert.strictEqual(Sim.buildAirDefense(s, 'player', 'p1_3').reason, 'air defense already built');
  // Capture loses it, and any work in progress.
  const c = Sim.createGame(5);
  c.units = [mkU(1, 'player', 'infantry', 'p4_3')];
  c.provinces.p5_3.airDefense = 1;
  Sim.issueOrder(c, 1, 'p5_3');
  Sim.movementPhase(c);
  assert.strictEqual(c.provinces.p5_3.owner, 'player');
  assert.strictEqual(c.provinces.p5_3.airDefense, 0);
});

// Two infantry and two drone wings attack one infantry in p5_3.
function interceptScenario(opts) {
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'player', 'infantry', 'p4_3'), mkU(9, 'enemy', 'infantry', 'p5_3')];
  if (opts.wings) opts.wings.forEach((str, i) => s.units.push(mkU(3 + i, 'player', 'drone', 'p4_3', str)));
  s.provinces.p5_3.airDefense = opts.ad ? 1 : 0;
  s.nations.enemy.steel = opts.steel == null ? 1000 : opts.steel;
  s.units.filter(u => u.nation === 'player').forEach(u => Sim.issueOrder(s, u.id, 'p5_3'));
  const stack = s.units.filter(u => u.nation === 'player');
  const est = Sim.stackPower(s, stack, 'attack', 'p5_3');
  const steelBefore = s.nations.enemy.steel;
  Sim.movementPhase(s);
  const str = id => { const u = s.units.find(x => x.id === id); return u ? u.strength : 0; };
  return { s, est, spent: steelBefore - s.nations.enemy.steel, inf: [str(1), str(2), str(9)], wings: [str(3), str(4)] };
}

test('interception: one launch per wing before the fight, 20 steel each, downed wings fight as if absent', () => {
  const none = interceptScenario({});
  const hit = interceptScenario({ wings: [4, 4], ad: true });
  assert.strictEqual(hit.spent, 2 * Sim.CFG.interceptorSteel);
  assert.deepStrictEqual(hit.wings, [0, 0], 'two damaged wings of 4 are downed');
  // Same engagement key, same rolls: the battle is exactly the one without the wings.
  assert.deepStrictEqual(hit.inf, none.inf);
  assert.strictEqual(hit.est, none.est, 'stackPower with the target counts the downed wings as nothing');
  assert.strictEqual(hit.s.ledger.enemy.launchSteel, 2 * Sim.CFG.interceptorSteel);
  assert.strictEqual(hit.s.ledger.enemy.launches, 2);
  assert.ok(hit.s.log.some(e => e.msg === 'Khessite air defense at ' + hit.s.provinces.p5_3.name +
    ' launches 2 interceptors (40 steel), downing 2 drone wings.'), 'the launch is logged with its cost');
  // Without air defense the same wings fight.
  const open = interceptScenario({ wings: [4, 4] });
  assert.strictEqual(open.spent, 0);
  assert.ok(open.est > none.est);
});

test('interception: a full wing survives one launch at 2, and launches stop when the steel runs out', () => {
  const full = interceptScenario({ wings: [6, 6], ad: true, steel: Sim.CFG.interceptorSteel + 5 });
  assert.strictEqual(full.spent, Sim.CFG.interceptorSteel, 'steel for one launch only');
  assert.strictEqual(full.s.ledger.enemy.launches, 1);
  assert.ok(full.s.log.some(e => /launches 1 interceptor \(20 steel\)\. 1 wing gets through untouched: not enough steel to launch\./.test(e.msg)));
  // Nobody is downed by a launch on a full wing, so the estimate is the plain attack.
  const plain = Sim.stackPower(full.s, [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'player', 'infantry', 'p4_3'),
    mkU(3, 'player', 'drone', 'p4_3'), mkU(4, 'player', 'drone', 'p4_3')], 'attack');
  assert.strictEqual(full.est, plain);
  const broke = interceptScenario({ wings: [4, 4], ad: true, steel: 0 });
  assert.strictEqual(broke.spent, 0);
  assert.ok(broke.s.log.some(e => /air defense at .* cannot launch: an interceptor costs 20 steel\. 2 drone wings get through untouched\./.test(e.msg)));
  assert.strictEqual(broke.est, interceptScenario({ wings: [4, 4] }).est, 'no steel, no launches in the estimate either');
});

test('interception: a launch on a full wing strips exactly interceptStrength before the fight', () => {
  const s = Sim.createGame(5);
  const wing = mkU(3, 'player', 'drone', 'p4_3');
  s.provinces.p5_3.airDefense = 1;
  s.nations.enemy.steel = 1000;
  const plan = Sim.interceptPlan(s, [wing, mkU(1, 'player', 'infantry', 'p4_3')], 'p5_3');
  assert.deepStrictEqual(plan.map(u => u.id), [3], 'only drone wings are targeted');
  assert.strictEqual(Sim.CFG.unitTypes.drone.strength - Sim.CFG.interceptStrength, 2);
  // Its own wings over its own province are never targeted.
  assert.deepStrictEqual(Sim.interceptPlan(s, [mkU(5, 'enemy', 'drone', 'p5_3')], 'p5_3'), []);
});

test('ledger: every strength point lost is priced at its unit steel cost, in battle and to attrition', () => {
  const r = interceptScenario({ wings: [6, 6] });
  const price = (type, lost) => lost * Sim.CFG.unitTypes[type].steelCost / Sim.CFG.unitTypes[type].strength;
  const playerLost = price('infantry', 24 - r.inf[0] - r.inf[1]) + price('drone', 12 - r.wings[0] - r.wings[1]);
  assert.ok(Math.abs(r.s.ledger.player.lostSteel - playerLost) < 1e-9, r.s.ledger.player.lostSteel + ' vs ' + playerLost);
  assert.ok(Math.abs(r.s.ledger.enemy.lostSteel - price('infantry', 12 - r.inf[2])) < 1e-9);
  // Attrition counts too: a unit cut off long enough loses strength, and the ledger sees it.
  const s = Sim.createGame(7);
  const corner = Sim.provinceId(0, 0);
  s.units = [mkU(1, 'player', 'infantry', corner)];
  s.edgeList.forEach(e => { if (e.a === corner || e.b === corner) e.rail = null; });
  for (let d = 0; d < 20; d++) Sim.supplyPhase(s);
  const lost = 12 - s.units[0].strength;
  assert.ok(lost > 0, 'attrition took strength');
  assert.ok(Math.abs(s.ledger.player.lostSteel - price('infantry', lost)) < 1e-9);
});

test('air defense: the Dominion builds it at its capital through the same command, after walls, above its threshold', () => {
  const s = Sim.createGame(42);
  s.nations.enemy.equipment = Sim.CFG.aiAirDefenseEquipment + 2 * Sim.CFG.fortCostPerLevel;
  Sim.tick(s);
  const cap = s.provinces[s.nations.enemy.capitalId];
  assert.ok(cap.fortBuild, 'walls first');
  assert.deepStrictEqual(cap.airDefenseBuild, { daysLeft: Sim.CFG.airDefenseBuildDays - 1 });
  assert.ok(s.log.some(e => /^Khessite begin building air defense at Khessograd \(120 equipment, 4 days\)\./.test(e.msg)));
  const p = Sim.createGame(42);
  p.nations.enemy.equipment = Sim.CFG.aiAirDefenseEquipment - 1;
  Sim.tick(p);
  assert.ok(!p.provinces[p.nations.enemy.capitalId].airDefenseBuild, 'nothing below the threshold');
});

test('air defense parity: the same order from both sides starts, pays, and finishes on the same day, and launches cost the same', () => {
  const s = Sim.createGame(42);
  s.nations.enemy.equipment = Sim.CFG.aiAirDefenseEquipment + 2 * Sim.CFG.fortCostPerLevel; // walls take theirs first
  s.nations.player.equipment = 1000;
  const playerCap = s.provinces[s.nations.player.capitalId], enemyCap = s.provinces[s.nations.enemy.capitalId];
  const eqBefore = s.nations.player.equipment;
  assert.strictEqual(Sim.buildAirDefense(s, 'player', playerCap.id).ok, true);
  assert.strictEqual(eqBefore - s.nations.player.equipment, Sim.CFG.airDefenseCost);
  Sim.tick(s);
  assert.deepStrictEqual(playerCap.airDefenseBuild, enemyCap.airDefenseBuild, 'same progress after the same tick');
  let days = 1;
  while (playerCap.airDefenseBuild) { Sim.tick(s); days++; assert.strictEqual(enemyCap.airDefense > 0, playerCap.airDefense > 0); }
  assert.strictEqual(days, Sim.CFG.airDefenseBuildDays);
  assert.strictEqual(enemyCap.airDefense, 1);
  // Mirror launches: Dominion wings into a Vessari province pay the Vessari exactly what the reverse pays the Dominion.
  const launch = (attacker, defender, from, to) => {
    const g = Sim.createGame(5);
    g.units = [mkU(1, attacker, 'drone', from), mkU(2, defender, 'infantry', to)];
    g.provinces[to].airDefense = 1;
    g.nations[defender].steel = 100;
    Sim.issueOrder(g, 1, to);
    Sim.movementPhase(g);
    return { spent: 100 - g.nations[defender].steel, launches: g.ledger[defender].launches };
  };
  assert.deepStrictEqual(launch('enemy', 'player', 'p5_3', 'p4_3'), launch('player', 'enemy', 'p4_3', 'p5_3'));
  assert.deepStrictEqual(launch('enemy', 'player', 'p5_3', 'p4_3'), { spent: Sim.CFG.interceptorSteel, launches: 1 });
});

test('steel exchange: a drone attack into air defense can lose the fight and still bleed the defender more steel', () => {
  // Three full wings against two infantry behind level 2 walls with air
  // defense. The launches leave each wing at 2; the walled defense then
  // kills all of them in the first round on any roll (the least damage it
  // can deal is 8, against 6 strength left), so this holds for every seed.
  for (const seed of [1, 7, 42]) {
    const s = Sim.createGame(seed);
    s.units = [mkU(1, 'player', 'drone', 'p4_3'), mkU(2, 'player', 'drone', 'p4_3'), mkU(3, 'player', 'drone', 'p4_3'),
      mkU(9, 'enemy', 'infantry', 'p5_3'), mkU(10, 'enemy', 'infantry', 'p5_3')];
    s.provinces.p5_3.airDefense = 1;
    s.provinces.p5_3.fortLevel = Sim.CFG.fortMaxLevel;
    s.nations.enemy.steel = 1000;
    [1, 2, 3].forEach(id => Sim.issueOrder(s, id, 'p5_3'));
    Sim.movementPhase(s);
    const bled = id => s.ledger[id].lostSteel + s.ledger[id].launchSteel;
    assert.strictEqual(s.provinces.p5_3.owner, 'enemy', 'the attack fails');
    assert.strictEqual(s.units.filter(u => u.nation === 'player' && u.strength > 0).length, 0, 'every wing is lost');
    assert.strictEqual(bled('player'), 3 * Sim.CFG.unitTypes.drone.steelCost);
    assert.ok(bled('enemy') > bled('player'), 'seed ' + seed + ': the Dominion bled ' + bled('enemy') + ' against ' + bled('player'));
  }
});

// ---------- Cycle 11 step 0: the interception rules the Cycle 10 judge found untested ----------
test('interception: a clash for an empty province with air defense draws launches from its owner', () => {
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'drone', 'p4_4', 4), mkU(2, 'enemy', 'infantry', 'p6_4')];
  s.provinces.p5_4.airDefense = 1; // empty, the Dominion's, and both sides march in
  s.nations.enemy.steel = 100;
  Sim.issueOrder(s, 1, 'p5_4'); Sim.issueOrder(s, 2, 'p5_4');
  Sim.movementPhase(s);
  assert.strictEqual(s.ledger.enemy.launches, 1, 'the clash defender launches at the incoming wing');
  assert.strictEqual(s.nations.enemy.steel, 100 - Sim.CFG.interceptorSteel);
});

test('interception: groups that meet on the road draw no launches, wherever the air defense stands', () => {
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'drone', 'p4_3'), mkU(2, 'enemy', 'infantry', 'p5_3')];
  s.provinces.p5_3.airDefense = 1;
  s.provinces.p4_3.airDefense = 1;
  s.nations.enemy.steel = 100; s.nations.player.steel = 100;
  Sim.issueOrder(s, 1, 'p5_3'); Sim.issueOrder(s, 2, 'p4_3');
  Sim.movementPhase(s);
  assert.ok(s.log.some(e => /meet on the road|on the road/.test(e.msg)), 'it was a meeting: ' + s.log.slice(-3).map(e => e.msg).join(' / '));
  assert.strictEqual(s.ledger.enemy.launches + s.ledger.player.launches, 0);
});

test('interception: when steel is short the lowest unit ids are hit first, whatever the unit array order', () => {
  const run = (reverse) => {
    const s = Sim.createGame(5);
    s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(3, 'player', 'drone', 'p4_3', 4), mkU(4, 'player', 'drone', 'p4_3', 4),
      mkU(9, 'enemy', 'infantry', 'p5_3')];
    if (reverse) s.units.reverse();
    s.provinces.p5_3.airDefense = 1;
    s.nations.enemy.steel = Sim.CFG.interceptorSteel; // one launch
    const plan = Sim.interceptPlan(s, s.units.filter(u => u.nation === 'player'), 'p5_3').map(u => u.id);
    s.units.filter(u => u.nation === 'player').forEach(u => Sim.issueOrder(s, u.id, 'p5_3'));
    Sim.movementPhase(s);
    const wing = id => { const u = s.units.find(x => x.id === id); return u ? u.strength : 0; };
    return { plan, w3: wing(3), launches: s.ledger.enemy.launches, msgs: s.log.slice(-4).map(e => e.msg).join(' / ') };
  };
  const a = run(false), b = run(true);
  assert.deepStrictEqual(a.plan, [3]);
  assert.strictEqual(a.launches, 1);
  assert.deepStrictEqual(a, b, 'reversing the unit array changes nothing');
  assert.ok(/launches 1 interceptor \(20 steel\), downing 1 drone wing\. 1 wing gets through untouched/.test(a.msgs), a.msgs);
});

test('interception: the Dominion attack estimate counts the launches it would face', () => {
  const aiAttacks = (ad) => {
    const s = Sim.createGame(5);
    s.day = Sim.CFG.aiMobilizationDays + 1;
    // Two damaged wings (attack 3 each) against one infantry (defense 4): 6 clears 1.5 x 4 in the open.
    s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'enemy', 'drone', 'p5_3', 4), mkU(3, 'enemy', 'drone', 'p5_3', 4)];
    s.provinces.p4_3.airDefense = ad ? 1 : 0;
    s.nations.player.steel = 1000;
    s.nations.enemy.equipment = 0;
    Sim.tick(s);
    return s.log.some(e => /Khessite (attack on|capture)|A Khessite attack group|air defense at/.test(e.msg)) ||
      s.units.some(u => u.nation === 'enemy' && u.provinceId === 'p4_3');
  };
  assert.strictEqual(aiAttacks(false), true, 'two wings attack one infantry in the open');
  assert.strictEqual(aiAttacks(true), false, 'the same two hold when the launches would down both');
});

test('launch reserve: launches are paid from the steel the attacker saw at dawn, through a real tick', () => {
  // The judge's case: two damaged wings and an infantry into air defense, the
  // Dominion holding 19 then 39 steel at dawn. Its factories eat the steel
  // the lines leave during the day, so only a reserve set aside at dawn
  // makes the battle match the estimate.
  [19, 39, 0, 200].forEach(steel => {
    const s = Sim.createGame(5);
    s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'player', 'drone', 'p4_3', 4), mkU(3, 'player', 'drone', 'p4_3', 4),
      mkU(9, 'enemy', 'infantry', 'p5_3')];
    s.provinces.p5_3.airDefense = 1;
    s.nations.enemy.steel = steel;
    s.nations.enemy.equipment = 0;
    const stack = s.units.filter(u => u.nation === 'player');
    const planned = Sim.interceptPlan(s, stack, 'p5_3').length;
    stack.forEach(u => Sim.issueOrder(s, u.id, 'p5_3'));
    Sim.tick(s);
    assert.strictEqual(s.ledger.enemy.launches, planned, 'dawn steel ' + steel + ': the battle launches what the estimate counted');
    assert.strictEqual(s.provinces.p5_3.launchReserve, null, 'the reserve is cleared after movement');
  });
});

test('launch reserve: steel set aside but not used is refunded the same day', () => {
  // The wing's attack becomes a meeting on the road, so no launch happens.
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'drone', 'p4_3'), mkU(2, 'enemy', 'infantry', 'p5_3')];
  s.provinces.p5_3.airDefense = 1;
  s.nations.enemy.steel = 100;
  Sim.issueOrder(s, 1, 'p5_3'); Sim.issueOrder(s, 2, 'p4_3');
  Sim.reserveLaunches(s, 'player');
  assert.strictEqual(s.nations.enemy.steel, 100 - Sim.CFG.interceptorSteel, 'set aside at dawn');
  assert.strictEqual(s.provinces.p5_3.launchReserve, 1);
  Sim.movementPhase(s);
  assert.strictEqual(s.ledger.enemy.launches, 0);
  assert.strictEqual(s.nations.enemy.steel, 100, 'refunded');
});

test('launch reserve: air defense finished today fires from tomorrow, and says so', () => {
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'player', 'drone', 'p4_3', 4), mkU(9, 'enemy', 'infantry', 'p5_3')];
  s.provinces.p5_3.airDefenseBuild = { daysLeft: 1 };
  s.nations.enemy.steel = 200;
  const stack = s.units.filter(u => u.nation === 'player');
  const est = Sim.stackPower(s, stack, 'attack', 'p5_3');
  assert.strictEqual(est, Sim.stackPower(s, stack, 'attack'), 'nothing stands yet, so the estimate counts no launch');
  stack.forEach(u => Sim.issueOrder(s, u.id, 'p5_3'));
  Sim.tick(s);
  assert.strictEqual(s.ledger.enemy.launches, 0, 'no launch on the day it is finished');
  assert.ok(s.log.some(e => /air defense at .* was finished today and fires from tomorrow\. 1 drone wing gets through untouched\./.test(e.msg)));
});

test('launch reserve: each side reserves on its own decision clock, the same way', () => {
  // Mirror: Dominion wings into a Vessari province with air defense through a real tick.
  const s = Sim.createGame(5);
  s.day = Sim.CFG.aiMobilizationDays + 1;
  s.units = [mkU(1, 'player', 'infantry', 'p4_3'), mkU(2, 'enemy', 'drone', 'p5_3', 4), mkU(3, 'enemy', 'drone', 'p5_3', 4),
    mkU(4, 'enemy', 'infantry', 'p5_3')];
  s.provinces.p4_3.airDefense = 1;
  s.nations.player.steel = Sim.CFG.interceptorSteel; // one launch at dawn
  s.nations.enemy.equipment = 0;
  Sim.tick(s);
  // Attack 10, or 7 after the one launch downs a wing, against defense 4: it attacks either way.
  assert.ok(s.log.some(e => /^Vessari air defense at .* launches 1 interceptor \(20 steel\), downing 1 drone wing\. 1 wing gets through untouched/.test(e.msg)),
    s.log.slice(-6).map(e => e.msg).join(' / '));
  assert.strictEqual(s.ledger.player.launches, 1, 'the one launch its dawn steel paid for');
  assert.ok(s.nations.player.steel >= 0);
});

// ---------- Cycle 11: research projects and jamming ----------
test('research: one command for every project, with prerequisites, costs, and refusals', () => {
  const s = Sim.createGame(7);
  const n = s.nations.player;
  assert.strictEqual(Sim.research(s, 'player', 'nope').reason, 'no such research project');
  n.researchPoints = 1000;
  const early = Sim.research(s, 'player', 'droneGen3');
  assert.strictEqual(early.reason, 'needs Drone Gen 2 first');
  assert.strictEqual(n.researchPoints, 1000, 'a refusal costs nothing');
  assert.strictEqual(Sim.research(s, 'player', 'jamming2').reason, 'needs Jamming Gen 1 first');
  n.researchPoints = Sim.CFG.research.jamming1.cost - 1;
  assert.deepStrictEqual(Sim.research(s, 'player', 'jamming1'), { ok: false, reason: 'not enough research points', cost: Sim.CFG.research.jamming1.cost });
  n.researchPoints = 1000;
  ['droneGen2', 'droneGen3', 'jamming1', 'jamming2'].forEach(id => {
    const before = n.researchPoints;
    assert.strictEqual(Sim.research(s, 'player', id).ok, true, id);
    assert.strictEqual(before - n.researchPoints, Sim.CFG.research[id].cost, id + ' costs its stated points');
    assert.strictEqual(Sim.hasResearched(s, 'player', id), true);
    assert.strictEqual(Sim.research(s, 'player', id).reason, 'already researched');
  });
  assert.strictEqual(Sim.droneGeneration(s, 'player'), 3);
  assert.strictEqual(n.jamming, 2);
  const drone = Sim.unitsOf(s, 'player').find(u => u.type === 'drone');
  assert.strictEqual(Sim.unitStats(s, drone).attack, Sim.CFG.droneGen3.attack);
  assert.ok(s.log.some(e => e.msg === 'Vessari field Jamming Gen 2. Enemy Gen 1 and Gen 2 drone wings now fight at -40% attack and defense.'));
});

test('jamming: a named modifier in unitStats against drone generations it reaches, and only those', () => {
  const s = Sim.createGame(7);
  const drone = Sim.unitsOf(s, 'player').find(u => u.type === 'drone');
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  const pct = Sim.CFG.jammingPct;
  const jammed = (a, d) => ({ attack: Math.max(1, Math.round(a * (1 - pct / 100))), defense: Math.max(1, Math.round(d * (1 - pct / 100))) });
  const at = () => { const st = Sim.unitStats(s, drone); return { attack: st.attack, defense: st.defense, jamming: st.jamming }; };
  s.nations.enemy.jamming = 1; // Gen 1 wing against Jamming Gen 1
  assert.deepStrictEqual(at(), Object.assign(jammed(3, 2), { jamming: pct }));
  s.nations.player.droneGen2 = true; // Gen 2 outranges Jamming Gen 1
  assert.deepStrictEqual(at(), { attack: Sim.CFG.droneGen2.attack, defense: Sim.CFG.droneGen2.defense, jamming: 0 });
  s.nations.enemy.jamming = 2;
  assert.deepStrictEqual(at(), Object.assign(jammed(Sim.CFG.droneGen2.attack, Sim.CFG.droneGen2.defense), { jamming: pct }));
  s.nations.player.droneGen3 = true; // Gen 3 outranges Jamming Gen 2
  assert.deepStrictEqual(at(), { attack: Sim.CFG.droneGen3.attack, defense: Sim.CFG.droneGen3.defense, jamming: 0 });
  s.nations.player.droneGen3 = false;
  assert.strictEqual(Sim.stackPower(s, [drone], 'attack'), jammed(Sim.CFG.droneGen2.attack, 1).attack, 'stackPower reads the jammed attack');
  assert.strictEqual(Sim.unitStats(s, inf).jamming, 0, 'jamming never touches infantry');
  // Your own jamming never touches your own wings.
  s.nations.enemy.jamming = 0; s.nations.player.jamming = 2;
  assert.strictEqual(Sim.unitStats(s, drone).jamming, 0);
});

test('jamming: the same attack with the defender jamming leaves more defenders standing', () => {
  // Two wings against three infantry: the wings are destroyed either way, so
  // the strength they took off the defenders measures their attack.
  const play = (seed, jam) => {
    const s = Sim.createGame(seed);
    s.units = [mkU(1, 'player', 'drone', 'p4_3'), mkU(2, 'player', 'drone', 'p4_3'),
      mkU(9, 'enemy', 'infantry', 'p5_3'), mkU(10, 'enemy', 'infantry', 'p5_3'), mkU(11, 'enemy', 'infantry', 'p5_3')];
    s.nations.enemy.jamming = jam;
    [1, 2].forEach(id => Sim.issueOrder(s, id, 'p5_3'));
    Sim.movementPhase(s);
    return s.units.filter(u => u.nation === 'enemy').reduce((a, u) => a + u.strength, 0);
  };
  [1, 5, 7, 42].forEach(seed => assert.ok(play(seed, 1) > play(seed, 0), 'seed ' + seed + ': ' + play(seed, 0) + ' left open, ' + play(seed, 1) + ' left jammed'));
});

test('AI research: the Dominion buys the first unfinished project in its stated order, never skipping ahead', () => {
  const s = Sim.createGame(42);
  s.nations.enemy.researchPoints = 1000;
  const bought = [];
  for (let d = 0; d < 6; d++) {
    Sim.tick(s);
    Sim.CFG.aiResearchOrder.forEach(id => { if (Sim.hasResearched(s, 'enemy', id) && bought.indexOf(id) === -1) bought.push(id); });
  }
  assert.deepStrictEqual(bought, Sim.CFG.aiResearchOrder, 'one project per day, in order');
  const t = Sim.createGame(42);
  t.nations.enemy.droneGen2 = true;
  t.nations.enemy.researchPoints = Sim.CFG.research.droneGen3.cost; // enough for Gen 3, but Jamming Gen 1 is next
  Sim.tick(t);
  assert.strictEqual(t.nations.enemy.jamming, 1);
  assert.strictEqual(t.nations.enemy.droneGen3, false);
  // Gen 3 is next and costs 120; with 100 points it waits, though Jamming Gen 2 (100) is affordable.
  const w = Sim.createGame(42);
  w.nations.enemy.droneGen2 = true; w.nations.enemy.jamming = 1;
  w.nations.enemy.researchPoints = Sim.CFG.research.jamming2.cost;
  Sim.tick(w);
  assert.strictEqual(w.nations.enemy.jamming, 1, 'it saves for Drone Gen 3 instead of skipping ahead');
  assert.strictEqual(w.nations.enemy.researchPoints, Sim.CFG.research.jamming2.cost + Sim.CFG.researchPerDay);
  // Same points, same project, same day for both sides: the player's click before the tick, the AI at its start.
  const u = Sim.createGame(42);
  ['player', 'enemy'].forEach(id => { u.nations[id].droneGen2 = true; u.nations[id].researchPoints = Sim.CFG.research.jamming1.cost; });
  Sim.research(u, 'player', 'jamming1');
  Sim.tick(u);
  assert.strictEqual(u.nations.player.jamming, u.nations.enemy.jamming);
  assert.strictEqual(u.nations.player.researchPoints, u.nations.enemy.researchPoints);
});

test('launch reserve: when steel covers one launch, the lower province id gets it, and the battle there uses it', () => {
  const s = Sim.createGame(5);
  s.units = [mkU(1, 'player', 'drone', 'p4_3', 4), mkU(2, 'player', 'drone', 'p4_4', 4),
    mkU(9, 'enemy', 'infantry', 'p5_3'), mkU(10, 'enemy', 'infantry', 'p5_4')];
  s.provinces.p5_3.airDefense = 1;
  s.provinces.p5_4.airDefense = 1;
  s.nations.enemy.steel = Sim.CFG.interceptorSteel; // one launch for two provinces
  Sim.issueOrder(s, 1, 'p5_3'); Sim.issueOrder(s, 2, 'p5_4');
  Sim.reserveLaunches(s, 'player');
  assert.strictEqual(s.provinces.p5_3.launchReserve, 1, 'p5_3 sorts first and is served first');
  assert.strictEqual(s.provinces.p5_4.launchReserve, 0);
  Sim.movementPhase(s);
  assert.ok(s.log.some(e => e.msg.indexOf('air defense at ' + s.provinces.p5_3.name + ' launches 1 interceptor') !== -1));
  assert.ok(s.log.some(e => e.msg.indexOf('air defense at ' + s.provinces.p5_4.name + ' cannot launch') !== -1));
  assert.strictEqual(s.ledger.enemy.launches, 1);
});

// ---------- Cycle 12: fog of war and drone recon ----------
test('fog: a nation sees its provinces and their neighbours, and enemy units only there', () => {
  const s = Sim.createGame(7);
  const seen = Sim.visibleProvinces(s, 'player');
  Object.keys(s.provinces).forEach(pid => {
    const p = s.provinces[pid];
    const expect = p.owner === 'player' || Sim.neighborsOf(s, p).some(np => np.owner === 'player');
    assert.strictEqual(!!seen[pid], expect, pid);
  });
  const cap = s.nations.enemy.capitalId;
  assert.strictEqual(Sim.canSee(s, 'player', cap), false, 'the Dominion capital is deep behind its front');
  assert.strictEqual(Sim.seenUnitsIn(s, 'player', cap), null, 'unseen is unknown, not an empty list');
  assert.deepStrictEqual(Sim.seenUnitsIn(s, 'player', 'p5_3').map(u => u.id), Sim.unitsIn(s, 'p5_3').map(u => u.id));
  // The same rule from the other side.
  assert.strictEqual(Sim.canSee(s, 'enemy', s.nations.player.capitalId), false);
  assert.strictEqual(Sim.canSee(s, 'enemy', 'p4_3'), true);
});

test('recon: one command, range by generation, lit through the end of the next day, and the wing holds', () => {
  const s = Sim.createGame(7);
  const wing = Sim.unitsIn(s, 'p4_3').find(u => u.type === 'drone');
  const inf = Sim.unitsIn(s, 'p4_3').find(u => u.type === 'infantry');
  assert.strictEqual(Sim.reconFlight(s, 'player', inf.id).reason, 'only drone wings fly recon');
  assert.strictEqual(Sim.reconFlight(s, 'enemy', wing.id).reason, 'no such unit');
  Sim.issueOrder(s, wing.id, 'p3_3');
  assert.strictEqual(Sim.reconFlight(s, 'player', wing.id).reason, 'already ordered to march today');
  wing.order = null;
  const r = Sim.reconFlight(s, 'player', wing.id);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.lit, Sim.provincesWithin(s, 'p4_3', Sim.CFG.reconRange[1]));
  assert.ok(r.lit.indexOf('p6_3') !== -1 && r.lit.indexOf('p7_3') === -1, 'Gen 1 reaches 2 hops');
  assert.strictEqual(Sim.canSee(s, 'player', 'p6_3'), true);
  assert.strictEqual(Sim.reconFlight(s, 'player', wing.id).reason, 'already flew recon today');
  assert.strictEqual(Sim.issueOrder(s, wing.id, 'p3_3').reason, 'flew recon today');
  const day = s.day;
  Sim.tick(s);
  assert.strictEqual(wing.provinceId, 'p4_3', 'the wing held its province');
  assert.strictEqual(Sim.canSee(s, 'player', 'p6_3'), true, 'still lit the next day');
  Sim.tick(s);
  assert.strictEqual(s.day, day + 2);
  assert.strictEqual(s.recon.player.p6_3, day + 1, 'lit through day ' + (day + 1) + ' only');
  // Gen 2 reaches 3 hops.
  const g = Sim.createGame(7);
  g.nations.player.droneGen2 = true;
  const w2 = Sim.unitsIn(g, 'p4_3').find(u => u.type === 'drone');
  assert.ok(Sim.reconFlight(g, 'player', w2.id).lit.indexOf('p7_3') !== -1);
});

test('recon: jamming at or above the wing generation blinds it, your own jamming never does, and the rule is the same for both', () => {
  const blinded = (viewer, foeJam, gen) => {
    const s = Sim.createGame(7);
    const other = viewer === 'player' ? 'enemy' : 'player';
    s.nations[other].jamming = foeJam;
    s.nations[viewer].jamming = 2;
    if (gen >= 2) s.nations[viewer].droneGen2 = true;
    const prov = viewer === 'player' ? 'p4_3' : 'p5_3';
    const w = Sim.unitsIn(s, prov).find(u => u.type === 'drone' && u.nation === viewer);
    const r = Sim.reconFlight(s, viewer, w.id);
    return { blinded: r.blinded, lit: r.lit.length, logged: s.log.some(e => /is blinded: .* Jamming Gen \d reaches Gen \d drones\. Nothing is seen\./.test(e.msg)) };
  };
  ['player', 'enemy'].forEach(v => {
    assert.deepStrictEqual(blinded(v, 1, 1), { blinded: true, lit: 0, logged: true }, v + ': Jamming Gen 1 blinds Gen 1');
    assert.strictEqual(blinded(v, 1, 2).blinded, false, v + ': Gen 2 outranges Jamming Gen 1');
    assert.strictEqual(blinded(v, 2, 2).blinded, true, v + ': Jamming Gen 2 blinds Gen 2');
    assert.strictEqual(blinded(v, 0, 1).blinded, false, v + ': its own Jamming Gen 2 never blinds it');
  });
});
