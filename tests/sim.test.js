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
  assert.deepStrictEqual(before, { attack: 3, defense: 2 });
  s.nations.player.researchPoints = Sim.CFG.droneGen2Cost;
  const res = Sim.researchDroneGen2(s, 'player');
  assert.strictEqual(res.ok, true);
  const after = Sim.unitStats(s, drone);
  assert.deepStrictEqual(after, { attack: Sim.CFG.droneGen2.attack, defense: Sim.CFG.droneGen2.defense });
  // Infantry is untouched by drone research.
  const inf = Sim.unitsOf(s, 'player').find(u => u.type === 'infantry');
  assert.deepStrictEqual(Sim.unitStats(s, inf), { attack: 4, defense: 4 });
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
