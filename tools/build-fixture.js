'use strict';
// Ashes of Empires, Cycle 23 Step 3b, worst case board fixture builder.
//
// What this builds: the worst case board of STRATEGY.md section 2.8.1, the
// board every later visual feature is admitted against. All 70 provinces
// developed as far as the simulation allows (factory, fort, and rail wherever
// legal), units massed on every front edge, late game day, all three fog
// states present at map edges and corners and next to live ground, damaged
// units, and units out of supply.
//
// How it builds: one campaign on seed 42 driven through the simulation public
// API only. The commands used are createGame, tick, buildFactory,
// buildFortification, buildRail, queueProduction, syncProductionLines,
// issueOrder, and the research commands researchDroneGen2, researchDroneGen3
// and researchJamming. Everything else is a read only (playerView,
// unitsIn, unitsOf, neighborsOf, computeSupply, factoryLevels, and the
// province, edge, unit, and nation fields those readouts walk). The driver
// never writes a state field.
//
// Determinism: the run is deterministic and this script proves it. It builds
// the whole campaign twice from createGame(42) through the same driver and
// asserts the two serialized save texts are byte identical. It then reads
// the first text back with deserializeSave and asserts the read back day
// equals the built day, so the file on disk is what the run really produced.
//
// The development frontier note: steel income caps equipment production, so
// maximum factories, maximum forts, and maximum rail cannot all happen inside
// the 150 day campaign. The driver funds rail first while steel is cheap, then
// factories, then forts, so the counts printed below are the measured frontier
// of what one campaign can reach, not a theoretical maximum.
//
// Usage: node tools/build-fixture.js
// Exit 0 when every section 2.8.1 threshold holds, the determinism check and
// the read back check pass, and the fixture file is written. Exit 1 otherwise.
//
// Writes tools/fixture/worst-case.json (the directory is created).

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');

const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

// ---------- The driver (reproduced faithfully) ----------

// Runs one scripted campaign on seed 42 through the public simulation
// commands only and returns the finished state. Local variable s holds the
// state for the whole run.
function buildFixtureState() {
  var s = Sim.createGame(42);
  var NATIONS = ['player', 'enemy'];
  function railPass(nation) {
    var n = s.nations[nation];
    for (var g = 0; g < 200; g++) {
      if (n.steel < 15) break;
      var e = null;
      for (var i = 0; i < s.edgeList.length; i++) {
        var cand = s.edgeList[i];
        if (!cand.rail && s.provinces[cand.a].owner === nation && s.provinces[cand.b].owner === nation) { e = cand; break; }
      }
      if (!e) break;
      if (!Sim.buildRail(s, nation, e.a, e.b).ok) break;
    }
  }
  function factoryPass(nation) {
    for (var g = 0; g < 300; g++) {
      var owned = Object.values(s.provinces).filter(function (p) { return p.owner === nation && p.factoryLevel < Sim.CFG.maxFactoryLevel; });
      if (!owned.length) break;
      owned.sort(function (a, b) { return a.factoryLevel - b.factoryLevel || (a.id < b.id ? -1 : 1); });
      if (!Sim.buildFactory(s, nation, owned[0].id).ok) break;
    }
  }
  function fortPass(nation) {
    Object.values(s.provinces).filter(function (p) { return p.owner === nation && (p.fortLevel || 0) < Sim.CFG.fortMaxLevel && !p.fortBuild; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; })
      .forEach(function (p) { if (s.nations[nation].equipment > 100) Sim.buildFortification(s, nation, p.id); });
  }
  function queuePass(nation, cap) {
    var n = s.nations[nation];
    Sim.syncProductionLines(s, nation);
    n.productionLines.forEach(function (line) {
      while ((line.queue || 0) < cap) { if (!Sim.queueProduction(s, nation, line.id).ok) break; }
    });
  }
  function develop(nation, day) {
    Sim.researchDroneGen2(s, nation); Sim.researchDroneGen3(s, nation); Sim.researchJamming(s, nation);
    if (day <= 20) { railPass(nation); return; }
    if (day <= 84) { factoryPass(nation); railPass(nation); queuePass(nation, 2); return; }
    fortPass(nation); factoryPass(nation); railPass(nation); queuePass(nation, 2);
  }
  function stepToward(u, targets, ownOnly) {
    var fromId = u.provinceId;
    if (targets.has(fromId)) return null;
    var prev = {}; var q = [fromId]; prev[fromId] = null;
    while (q.length) {
      var cur = q.shift();
      if (targets.has(cur)) { var path = []; var node = cur; while (node) { path.unshift(node); node = prev[node]; } return path[1] || null; }
      Sim.neighborsOf(s, s.provinces[cur]).forEach(function (nb) {
        if (ownOnly && nb.owner !== u.nation && !targets.has(nb.id)) return;
        if (!(nb.id in prev)) { prev[nb.id] = cur; q.push(nb.id); }
      });
    }
    return null;
  }
  function frontProvinces(nation) {
    var set = new Set();
    s.edgeList.forEach(function (e) {
      var oa = s.provinces[e.a].owner, ob = s.provinces[e.b].owner;
      if (oa !== ob) { if (oa === nation) set.add(e.a); if (ob === nation) set.add(e.b); }
    });
    return set;
  }
  function garrisonIds(nation) {
    var cap = s.nations[nation].capitalId;
    return new Set(Sim.unitsIn(s, cap).filter(function (u) { return u.nation === nation; }).slice(0, 3).map(function (u) { return u.id; }));
  }
  var tourRows = [0, 6, 3, 0, 6];
  var assignments = { player: {}, enemy: {} };
  function orders(day) {
    NATIONS.forEach(function (nation) {
      var gar = garrisonIds(nation);
      var units = Sim.unitsOf(s, nation);
      var drones = units.filter(function (u) { return u.type === 'drone'; });
      if (day % 7 === 1 || day >= 125) {
        var fp = Array.from(frontProvinces(nation)).sort();
        var field = units.filter(function (u) { return !gar.has(u.id) && !(nation === 'player' && u.type === 'drone' && day <= 60); });
        assignments[nation] = {};
        field.forEach(function (u, i) { if (fp.length) assignments[nation][u.id] = fp[i % fp.length]; });
      }
      units.forEach(function (u) {
        if (gar.has(u.id)) return;
        if (nation === 'player' && u.type === 'drone' && day >= 138) {
          var stepHome = stepToward(u, new Set([s.nations.player.capitalId]), false);
          if (stepHome) Sim.issueOrder(s, u.id, stepHome);
          return;
        }
        if (nation === 'player' && u.type === 'drone' && day >= 8 && day <= 60) {
          var row = tourRows[drones.indexOf(u) % tourRows.length];
          var target = day <= 38 ? 'p7_' + row : 'p4_' + row;
          var stepTour = stepToward(u, new Set([target]), false);
          if (stepTour) Sim.issueOrder(s, u.id, stepTour);
          return;
        }
        if (day < 30) {
          var stepFront = stepToward(u, frontProvinces(nation), true);
          if (stepFront && s.provinces[stepFront].owner === nation) Sim.issueOrder(s, u.id, stepFront);
          return;
        }
        var assigned = assignments[nation][u.id];
        if (assigned) {
          var stepAssigned = stepToward(u, new Set([assigned]), true);
          if (stepAssigned && s.provinces[stepAssigned].owner === nation) Sim.issueOrder(s, u.id, stepAssigned);
        }
      });
    });
  }
  while (!s.gameOver && s.day <= 145) {
    NATIONS.forEach(function (n) { develop(n, s.day); });
    orders(s.day);
    Sim.tick(s);
  }
  return s;
}

// ---------- Counts ----------

// The set of provinces owned by nation that share an edge with a province
// owned by the other nation.
function frontProvincesOf(s, nation) {
  var other = nation === 'player' ? 'enemy' : 'player';
  var set = new Set();
  s.edgeList.forEach(function (e) {
    var oa = s.provinces[e.a].owner;
    var ob = s.provinces[e.b].owner;
    if (oa !== ob) {
      if (oa === nation) set.add(e.a);
      if (ob === nation) set.add(e.b);
    }
  });
  return set;
}

// Of the front provinces, the count where at least one unit of the owner
// stands on the province.
function frontCovered(s, nation, frontSet) {
  var n = 0;
  frontSet.forEach(function (id) {
    var units = Sim.unitsIn(s, id);
    for (var i = 0; i < units.length; i++) {
      if (units[i].nation === nation) { n++; break; }
    }
  });
  return n;
}

var CORNER_IDS = ['p0_0', 'p9_0', 'p0_6', 'p9_6'];

function isMapEdge(p) {
  return p.y === 0 || p.y === 6 || p.x === 0 || p.x === 9;
}

function isCorner(id) {
  return CORNER_IDS.indexOf(id) !== -1;
}

// Computes every reported count from the state and from playerView(state).
// The view supplies the fog classifications (live, remembered, dark); the
// state supplies the raw facts those classifications rest on.
function computeCounts(s) {
  var view = playerView(s);
  var ids = Object.keys(s.provinces);
  var counts = {};
  counts.day = s.day;
  counts.gameOver = s.gameOver;
  counts.provinceCount = ids.length;

  var factoryTotal = 0;
  var factoryMin = Infinity;
  var factoryL3 = 0;
  var fortTotal = 0;
  var provincesFortified = 0;
  ids.forEach(function (id) {
    var p = s.provinces[id];
    factoryTotal += p.factoryLevel;
    if (p.factoryLevel < factoryMin) factoryMin = p.factoryLevel;
    if (p.factoryLevel >= 3) factoryL3++;
    fortTotal += p.fortLevel || 0;
    if ((p.fortLevel || 0) >= 1) provincesFortified++;
  });
  counts.factoryTotal = factoryTotal;
  counts.factoryMin = factoryMin;
  counts.factoryL3 = factoryL3;
  counts.fortTotal = fortTotal;
  counts.provincesFortified = provincesFortified;

  var railBuilt = 0, railBuilding = 0, railConverting = 0, railNone = 0;
  s.edgeList.forEach(function (e) {
    if (!e.rail) railNone++;
    else if (e.rail.converting) railConverting++;
    else if (e.rail.daysLeft > 0) railBuilding++;
    else railBuilt++;
  });
  counts.railBuilt = railBuilt;
  counts.railBuilding = railBuilding;
  counts.railConverting = railConverting;
  counts.railNone = railNone;

  counts.unitsTotal = s.units.length;
  counts.unitsPlayer = s.units.filter(function (u) { return u.nation === 'player'; }).length;
  counts.unitsEnemy = s.units.filter(function (u) { return u.nation === 'enemy'; }).length;
  counts.damagedUnits = s.units.filter(function (u) { return u.strength < u.maxStrength; }).length;

  var supply = {};
  ['player', 'enemy'].forEach(function (nation) {
    var per = Sim.computeSupply(s, nation) || {};
    Object.keys(per).forEach(function (id) { supply[id] = per[id]; });
  });
  counts.outOfSupplyUnits = s.units.filter(function (u) {
    var entry = supply[u.provinceId];
    return !entry || !entry.supplied;
  }).length;

  var playerFront = frontProvincesOf(s, 'player');
  var enemyFront = frontProvincesOf(s, 'enemy');
  counts.playerFrontProvinces = playerFront.size;
  counts.playerFrontCovered = frontCovered(s, 'player', playerFront);
  counts.enemyFrontProvinces = enemyFront.size;
  counts.enemyFrontCovered = frontCovered(s, 'enemy', enemyFront);

  var intelById = {};
  view.provinces.forEach(function (p) { intelById[p.id] = p.intel; });
  counts.viewLive = view.provinces.filter(function (p) { return p.intel === 'live'; }).length;
  counts.viewRemembered = view.provinces.filter(function (p) { return p.intel === 'remembered'; }).length;
  counts.viewDark = view.provinces.filter(function (p) { return p.intel === 'dark'; }).length;

  var remembered = view.provinces.filter(function (p) { return p.intel === 'remembered'; });
  var dark = view.provinces.filter(function (p) { return p.intel === 'dark'; });
  counts.rememberedEdge = remembered.filter(function (p) { return isMapEdge(p); }).length;
  counts.rememberedCorner = remembered.filter(function (p) { return isCorner(p.id); }).length;
  counts.darkEdge = dark.filter(function (p) { return isMapEdge(p); }).length;
  counts.darkCorner = dark.filter(function (p) { return isCorner(p.id); }).length;
  counts.rememberedNextToLive = remembered.filter(function (p) {
    var neighbors = Sim.neighborsOf(s, s.provinces[p.id]);
    for (var i = 0; i < neighbors.length; i++) {
      if (intelById[neighbors[i].id] === 'live') return true;
    }
    return false;
  }).length;

  return counts;
}

// ---------- Thresholds (section 2.8.1 as far as the simulation allows) ----------

// Each threshold name is printed with its PASS or FAIL line; ok decides it
// and value is the measured count the threshold was checked against.
function evaluateThresholds(c) {
  return [
    { name: 'day >= 140', ok: c.day >= 140, value: c.day },
    { name: 'gameOver is false', ok: c.gameOver === false, value: c.gameOver },
    { name: 'provinceCount === 70', ok: c.provinceCount === 70, value: c.provinceCount },
    { name: 'factoryTotal >= 120', ok: c.factoryTotal >= 120, value: c.factoryTotal },
    { name: 'factoryMin >= 1', ok: c.factoryMin >= 1, value: c.factoryMin },
    { name: 'factoryL3 >= 10', ok: c.factoryL3 >= 10, value: c.factoryL3 },
    { name: 'fortTotal >= 35', ok: c.fortTotal >= 35, value: c.fortTotal },
    { name: 'provincesFortified >= 35', ok: c.provincesFortified >= 35, value: c.provincesFortified },
    { name: 'railBuilt >= 55', ok: c.railBuilt >= 55, value: c.railBuilt },
    { name: 'unitsTotal >= 160', ok: c.unitsTotal >= 160, value: c.unitsTotal },
    { name: 'damagedUnits >= 40', ok: c.damagedUnits >= 40, value: c.damagedUnits },
    { name: 'outOfSupplyUnits >= 30', ok: c.outOfSupplyUnits >= 30, value: c.outOfSupplyUnits },
    { name: 'playerFrontCovered >= 7', ok: c.playerFrontCovered >= 7, value: c.playerFrontCovered },
    { name: 'enemyFrontCovered >= enemyFrontProvinces - 1', ok: c.enemyFrontCovered >= c.enemyFrontProvinces - 1, value: c.enemyFrontCovered + ' of ' + c.enemyFrontProvinces },
    { name: 'viewLive >= 40', ok: c.viewLive >= 40, value: c.viewLive },
    { name: 'viewRemembered >= 8', ok: c.viewRemembered >= 8, value: c.viewRemembered },
    { name: 'rememberedEdge >= 2', ok: c.rememberedEdge >= 2, value: c.rememberedEdge },
    { name: 'rememberedCorner >= 1', ok: c.rememberedCorner >= 1, value: c.rememberedCorner },
    { name: 'rememberedNextToLive >= 5', ok: c.rememberedNextToLive >= 5, value: c.rememberedNextToLive },
    { name: 'viewDark >= 12', ok: c.viewDark >= 12, value: c.viewDark },
    { name: 'darkEdge >= 6', ok: c.darkEdge >= 6, value: c.darkEdge },
    { name: 'darkCorner >= 1', ok: c.darkCorner >= 1, value: c.darkCorner }
  ];
}

// ---------- Main ----------

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

function main() {
  // Build once, serialize.
  const s = buildFixtureState();
  const serA = Save.serializeSave(s);
  check('serialize built state ok', serA.ok, serA.reason || '');

  // Build a second fresh state through the same driver, serialize, and
  // assert the two texts are byte identical (the determinism proof).
  const s2 = buildFixtureState();
  const serB = Save.serializeSave(s2);
  check('serialize second build ok', serB.ok, serB.reason || '');
  const deterministic = serA.ok && serB.ok && serA.text === serB.text;
  check('determinism: two builds serialize to byte identical text', deterministic,
    serA.ok && serB.ok ? (deterministic ? serA.text.length + ' bytes, identical' : 'TEXTS DIFFER') : 'serialize failed');

  // Read the first text back and assert it agrees with the built state.
  const readBack = serA.ok ? Save.deserializeSave(serA.text) : { ok: false, reason: 'serialize failed' };
  check('read back ok', readBack.ok === true, readBack.reason || '');
  check('read back day equals built day', readBack.ok === true && readBack.state.day === s.day,
    readBack.ok ? (readBack.state.day + ' vs ' + s.day) : 'read back failed');

  // Write the fixture file (create the directory).
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, serA.ok ? serA.text : '');
  check('fixture file written to tools/fixture/worst-case.json', serA.ok === true && fs.existsSync(FIXTURE_PATH),
    serA.ok ? fs.statSync(FIXTURE_PATH).size + ' bytes' : 'not written');

  // Report one line per count.
  const c = computeCounts(s);
  const COUNT_ORDER = [
    'day', 'gameOver', 'provinceCount', 'factoryTotal', 'factoryMin', 'factoryL3',
    'fortTotal', 'provincesFortified', 'railBuilt', 'railBuilding', 'railConverting',
    'railNone', 'unitsTotal', 'unitsPlayer', 'unitsEnemy', 'damagedUnits',
    'outOfSupplyUnits', 'playerFrontProvinces', 'playerFrontCovered',
    'enemyFrontProvinces', 'enemyFrontCovered', 'viewLive', 'viewRemembered',
    'viewDark', 'rememberedEdge', 'rememberedCorner', 'rememberedNextToLive',
    'darkEdge', 'darkCorner'
  ];
  COUNT_ORDER.forEach(function (name) {
    console.log('count ' + name + ' ' + c[name]);
  });

  // Print PASS or FAIL per threshold.
  evaluateThresholds(c).forEach(function (t) {
    check('threshold ' + t.name, t.ok, String(t.value));
  });
}

// Run the campaign, print, and exit only when this file is the main module.
// Required as a module (the screenshot harness reuses the counts and the
// threshold list) the builder runs nothing and changes no state.
function runMain() {
  main();
  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  runMain();
}

module.exports = {
  buildFixtureState: buildFixtureState,
  computeCounts: computeCounts,
  evaluateThresholds: evaluateThresholds,
  frontProvincesOf: frontProvincesOf,
  FIXTURE_PATH: FIXTURE_PATH
};
