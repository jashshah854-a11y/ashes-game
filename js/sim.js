// Ashes of Empires, simulation core.
// Plain functions over a plain state object. No DOM, no timers.
// Loadable in the browser (window.AshesSim) and in node (module.exports)
// so the same code that runs the game is the code the tests exercise.
(function (global) {
  'use strict';

  // ---------- Tunables (Iteration 1 skeleton values) ----------
  var CFG = {
    mapW: 10,
    mapH: 7,
    campaignEndDay: 150,
    steelPerFactoryLevel: 2,      // steel consumed per factory level per day
    equipPerFactoryLevel: 5,      // equipment produced per factory level per day
    researchPerDay: 3,
    droneGen2Cost: 60,            // research points
    factoryCostPerLevel: 40,      // equipment, multiplied by target level
    maxFactoryLevel: 3,
    infantryCost: 30,
    droneCost: 15,
    unitTypes: {
      infantry: { label: 'Infantry Division', attack: 4, defense: 4, strength: 12, cost: 30 },
      drone:    { label: 'Drone Wing',        attack: 3, defense: 2, strength: 6,  cost: 15 }
    },
    droneGen2: { attack: 5, defense: 3 }  // drone stats once Drone Gen 2 is researched
  };

  // ---------- Seeded RNG (mulberry32) ----------
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Map helpers ----------
  function provinceId(x, y) { return 'p' + x + '_' + y; }

  function neighborsOf(state, prov) {
    var out = [];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var nx = prov.x + dirs[i][0], ny = prov.y + dirs[i][1];
      if (nx >= 0 && ny >= 0 && nx < state.mapW && ny < state.mapH) {
        out.push(state.provinces[provinceId(nx, ny)]);
      }
    }
    return out;
  }

  function areAdjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function unitsIn(state, provId) {
    return state.units.filter(function (u) { return u.provinceId === provId && u.strength > 0; });
  }

  function unitsOf(state, nationId) {
    return state.units.filter(function (u) { return u.nation === nationId && u.strength > 0; });
  }

  // Province names: light lore flavor from syllables, seeded so the map is stable.
  var NAME_A = ['Ves', 'Khar', 'Tor', 'Bel', 'Ost', 'Mir', 'Dra', 'Sel', 'Vor', 'Ash'];
  var NAME_B = ['kar', 'mund', 'feld', 'grad', 'holm', 'wick', 'marsh', 'crest', 'vale', 'ford'];

  // ---------- Game creation ----------
  function createGame(seed) {
    var rng = makeRng(seed == null ? 1234 : seed);
    var state = {
      day: 1,
      seed: seed == null ? 1234 : seed,
      rngState: null, // rng is recreated per call from seed + tickCount for determinism
      tickCount: 0,
      mapW: CFG.mapW,
      mapH: CFG.mapH,
      provinces: {},
      units: [],
      nextUnitId: 1,
      gameOver: false,
      winner: null,
      endReason: null,
      log: [],
      nations: {
        player: {
          id: 'player', name: 'The Vessari Compact', short: 'Vessari',
          equipment: 60, steel: 20, researchPoints: 0,
          droneGen2: false, capitalId: provinceId(0, 3)
        },
        enemy: {
          id: 'enemy', name: 'The Khessite Dominion', short: 'Khessite',
          equipment: 60, steel: 20, researchPoints: 0,
          droneGen2: false, capitalId: provinceId(CFG.mapW - 1, 3)
        }
      }
    };

    // Provinces: west half player, east half enemy. Front line in the middle.
    for (var y = 0; y < CFG.mapH; y++) {
      for (var x = 0; x < CFG.mapW; x++) {
        var id = provinceId(x, y);
        var owner = x < CFG.mapW / 2 ? 'player' : 'enemy';
        var steel = Math.floor(rng() * 3); // 0..2 base steel
        if (x === 2 || x === CFG.mapW - 3) steel += 1; // richer near the heartland
        var isCapital = (id === state.nations.player.capitalId || id === state.nations.enemy.capitalId);
        state.provinces[id] = {
          id: id, x: x, y: y, owner: owner,
          name: NAME_A[Math.floor(rng() * NAME_A.length)] + NAME_B[Math.floor(rng() * NAME_B.length)],
          steel: steel,
          factoryLevel: isCapital ? 2 : (rng() < 0.22 ? 1 : 0),
          isCapital: isCapital
        };
      }
    }
    state.provinces[state.nations.player.capitalId].name = 'Vesskar City';
    state.provinces[state.nations.enemy.capitalId].name = 'Khessograd';

    // Starting armies near the front, plus a garrison on each capital so
    // the capitals cannot be taken by a lone unit strolling down an
    // empty lane (found in the Iteration 1 autoplay smoke test).
    addUnit(state, 'player', 'infantry', provinceId(3, 2));
    addUnit(state, 'player', 'infantry', provinceId(3, 4));
    addUnit(state, 'player', 'infantry', provinceId(4, 3));
    addUnit(state, 'player', 'drone', provinceId(4, 3));
    addUnit(state, 'player', 'infantry', state.nations.player.capitalId);
    addUnit(state, 'enemy', 'infantry', provinceId(6, 2));
    addUnit(state, 'enemy', 'infantry', provinceId(6, 4));
    addUnit(state, 'enemy', 'infantry', provinceId(5, 3));
    addUnit(state, 'enemy', 'drone', provinceId(5, 3));
    addUnit(state, 'enemy', 'infantry', state.nations.enemy.capitalId);

    logEvent(state, 'War begins. The Compact and the Dominion mobilize along the river line.');
    return state;
  }

  function addUnit(state, nationId, type, provId) {
    var base = CFG.unitTypes[type];
    var u = {
      id: state.nextUnitId++,
      nation: nationId,
      type: type,
      provinceId: provId,
      strength: base.strength,
      maxStrength: base.strength,
      order: null
    };
    state.units.push(u);
    return u;
  }

  function logEvent(state, msg) {
    state.log.push({ day: state.day, msg: msg });
    if (state.log.length > 60) state.log.shift();
  }

  // Unit combat stats, research aware. This is what Drone Gen 2 changes.
  function unitStats(state, unit) {
    var base = CFG.unitTypes[unit.type];
    if (unit.type === 'drone' && state.nations[unit.nation].droneGen2) {
      return { attack: CFG.droneGen2.attack, defense: CFG.droneGen2.defense };
    }
    return { attack: base.attack, defense: base.defense };
  }

  // ---------- Orders ----------
  function issueOrder(state, unitId, targetProvId) {
    var unit = null;
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].id === unitId) unit = state.units[i];
    }
    if (!unit || unit.strength <= 0) return { ok: false, reason: 'no such unit' };
    var from = state.provinces[unit.provinceId];
    var to = state.provinces[targetProvId];
    if (!to) return { ok: false, reason: 'no such province' };
    if (!areAdjacent(from, to)) return { ok: false, reason: 'not adjacent' };
    unit.order = { target: targetProvId };
    return { ok: true };
  }

  // ---------- Combat ----------
  // One engagement: attacking units (already grouped by caller) hit the
  // defenders of a province. Simultaneous rounds until one side is gone
  // or 12 rounds pass. Returns true if the attackers cleared the province.
  function resolveBattle(state, attackers, defenders, rng) {
    var round = 0;
    function alive(list) { return list.filter(function (u) { return u.strength > 0; }); }
    while (alive(attackers).length > 0 && alive(defenders).length > 0 && round < 12) {
      round++;
      var atkPower = alive(attackers).reduce(function (s, u) { return s + unitStats(state, u).attack; }, 0);
      var defPower = alive(defenders).reduce(function (s, u) { return s + unitStats(state, u).defense; }, 0);
      var dmgToDef = Math.max(1, Math.round(atkPower * (0.7 + rng() * 0.6)));
      var dmgToAtk = Math.max(1, Math.round(defPower * (0.7 + rng() * 0.6)));
      applyDamage(defenders, dmgToDef);
      applyDamage(attackers, dmgToAtk);
    }
    return alive(defenders).length === 0 && alive(attackers).length > 0;
  }

  // Damage soaks into the first living unit, overflow spills to the next.
  function applyDamage(units, dmg) {
    for (var i = 0; i < units.length && dmg > 0; i++) {
      var u = units[i];
      if (u.strength <= 0) continue;
      var absorbed = Math.min(u.strength, dmg);
      u.strength -= absorbed;
      dmg -= absorbed;
    }
  }

  // Execute one attack group: friendly units from the same origin province
  // ordered into the same target fight as one battle group, then survivors
  // march in together. (Iteration 1 lesson: single units attacking a pooled
  // stack one at a time was guaranteed suicide, for the player and the AI.)
  function executeGroup(state, group, rng) {
    if (!group.length) return;
    var lead = group[0];
    var target = state.provinces[lead.order.target];
    group.forEach(function (u) { u.order = null; });
    if (!target) return;
    var attackers = group.filter(function (u) { return u.strength > 0; });
    if (!attackers.length) return;

    var defenders = unitsIn(state, target.id).filter(function (u) { return u.nation !== lead.nation; });
    if (defenders.length === 0) {
      attackers.forEach(function (u) { u.provinceId = target.id; });
      if (target.owner !== lead.nation) {
        target.owner = lead.nation;
        logEvent(state, state.nations[lead.nation].short + ' take ' + target.name + ' unopposed.');
        checkCapital(state, target);
      }
      return;
    }
    var cleared = resolveBattle(state, attackers, defenders, rng);
    var survivors = attackers.filter(function (u) { return u.strength > 0; });
    if (cleared && survivors.length) {
      survivors.forEach(function (u) { u.provinceId = target.id; });
      target.owner = lead.nation;
      logEvent(state, state.nations[lead.nation].short + ' capture ' + target.name + ' after a hard fight.');
      checkCapital(state, target);
    } else if (!survivors.length) {
      logEvent(state, 'A ' + state.nations[lead.nation].short + ' attack group is destroyed at ' + target.name + '.');
    } else {
      logEvent(state, state.nations[lead.nation].short + ' attack on ' + target.name + ' is repelled.');
    }
  }

  function checkCapital(state, prov) {
    if (state.gameOver) return;
    if (prov.id === state.nations.enemy.capitalId && prov.owner === 'player') {
      state.gameOver = true; state.winner = 'player';
      state.endReason = 'Enemy capital captured. The Dominion collapses.';
    } else if (prov.id === state.nations.player.capitalId && prov.owner === 'enemy') {
      state.gameOver = true; state.winner = 'enemy';
      state.endReason = 'Your capital has fallen. The Compact is finished.';
    }
  }

  // ---------- Economy ----------
  function nationProvinces(state, nationId) {
    return Object.keys(state.provinces).map(function (k) { return state.provinces[k]; })
      .filter(function (p) { return p.owner === nationId; });
  }

  function factoryLevels(state, nationId) {
    return nationProvinces(state, nationId).reduce(function (s, p) { return s + p.factoryLevel; }, 0);
  }

  function steelIncome(state, nationId) {
    return nationProvinces(state, nationId).reduce(function (s, p) { return s + p.steel; }, 0);
  }

  // One day of economy for one nation. Resources gate production: if the
  // steel stockpile plus today's income cannot feed every factory level,
  // only some levels run and equipment output drops proportionally.
  function economyTick(state, nationId) {
    var n = state.nations[nationId];
    n.steel += steelIncome(state, nationId);
    var levels = factoryLevels(state, nationId);
    var steelWanted = levels * CFG.steelPerFactoryLevel;
    var steelUsed = Math.min(n.steel, steelWanted);
    var levelsRunning = CFG.steelPerFactoryLevel > 0
      ? Math.floor(steelUsed / CFG.steelPerFactoryLevel) : levels;
    n.steel -= levelsRunning * CFG.steelPerFactoryLevel;
    n.equipment += levelsRunning * CFG.equipPerFactoryLevel;
    n.researchPoints += CFG.researchPerDay;
    return { levelsRunning: levelsRunning, levelsIdle: levels - levelsRunning };
  }

  function buildFactory(state, nationId, provId) {
    var prov = state.provinces[provId];
    var n = state.nations[nationId];
    if (!prov || prov.owner !== nationId) return { ok: false, reason: 'not your province' };
    if (prov.factoryLevel >= CFG.maxFactoryLevel) return { ok: false, reason: 'factory at max level' };
    var cost = CFG.factoryCostPerLevel * (prov.factoryLevel + 1);
    if (n.equipment < cost) return { ok: false, reason: 'not enough equipment', cost: cost };
    n.equipment -= cost;
    prov.factoryLevel += 1;
    logEvent(state, state.nations[nationId].short + ' raise a factory in ' + prov.name +
      ' to level ' + prov.factoryLevel + '.');
    return { ok: true, cost: cost, level: prov.factoryLevel };
  }

  function trainUnit(state, nationId, type, provId) {
    var prov = state.provinces[provId];
    var n = state.nations[nationId];
    if (!prov || prov.owner !== nationId) return { ok: false, reason: 'not your province' };
    if (prov.factoryLevel < 1) return { ok: false, reason: 'needs a factory' };
    var cost = CFG.unitTypes[type].cost;
    if (n.equipment < cost) return { ok: false, reason: 'not enough equipment', cost: cost };
    n.equipment -= cost;
    var u = addUnit(state, nationId, type, provId);
    logEvent(state, state.nations[nationId].short + ' deploy a ' + CFG.unitTypes[type].label + ' in ' + prov.name + '.');
    return { ok: true, unit: u, cost: cost };
  }

  function researchDroneGen2(state, nationId) {
    var n = state.nations[nationId];
    if (n.droneGen2) return { ok: false, reason: 'already researched' };
    if (n.researchPoints < CFG.droneGen2Cost) {
      return { ok: false, reason: 'not enough research points', cost: CFG.droneGen2Cost };
    }
    n.researchPoints -= CFG.droneGen2Cost;
    n.droneGen2 = true;
    logEvent(state, state.nations[nationId].short + ' field Drone Gen 2. Drone wings hit harder now.');
    return { ok: true };
  }

  // ---------- Enemy AI (minimal, scripted, deliberately weak) ----------
  function aiTakeTurn(state) {
    var ai = 'enemy';
    var n = state.nations[ai];
    // Research as soon as it can afford it.
    if (!n.droneGen2 && n.researchPoints >= CFG.droneGen2Cost) researchDroneGen2(state, ai);
    // Grow one factory near home when rich.
    if (n.equipment >= 140) {
      var home = nationProvinces(state, ai).filter(function (p) { return p.factoryLevel < 2; });
      home.sort(function (a, b) { return b.x - a.x; }); // closest to its own heartland first
      if (home.length) buildFactory(state, ai, home[0].id);
    }
    // Train at the capital when it has a surplus, up to a modest field army.
    // (The cap exists because the first smoke test ended with a 51 unit pile-up.)
    if (n.equipment >= 90 && state.day % 3 === 0 && unitsOf(state, ai).length < 14) {
      trainUnit(state, ai, state.day % 2 === 0 ? 'infantry' : 'drone', n.capitalId);
    }
    // Orders: push toward the player capital, attack only when not badly outmatched.
    unitsOf(state, ai).forEach(function (u) {
      if (u.order) return;
      var here = state.provinces[u.provinceId];
      var options = neighborsOf(state, here);
      // Prefer stepping west (toward the player), prefer enemy held tiles we can take.
      options.sort(function (a, b) { return a.x - b.x; });
      for (var i = 0; i < options.length; i++) {
        var t = options[i];
        if (t.owner === ai) {
          // Drift toward the front if we are deep in our own land.
          if (t.x < here.x) { u.order = { target: t.id }; return; }
          continue;
        }
        var defenders = unitsIn(state, t.id).filter(function (d) { return d.nation !== ai; });
        var defPower = defenders.reduce(function (s, d) { return s + d.strength; }, 0);
        if (defenders.length === 0 || u.strength >= defPower * 0.8) {
          u.order = { target: t.id };
          return;
        }
      }
    });
  }

  // ---------- The tick ----------
  function tick(state) {
    if (state.gameOver) return state;
    var rng = makeRng(state.seed + state.tickCount * 7919);
    economyTick(state, 'player');
    economyTick(state, 'enemy');
    aiTakeTurn(state);
    // Movement and combat: units sharing a nation, an origin province, and
    // a target form one attack group. Player groups resolve first in the
    // skeleton; honest ordering note in BACKLOG.
    var movers = state.units.filter(function (u) { return u.order && u.strength > 0; });
    var groupMap = {};
    var groups = [];
    movers.forEach(function (u) {
      var key = u.nation + '|' + u.provinceId + '|' + u.order.target;
      if (!groupMap[key]) { groupMap[key] = []; groups.push(groupMap[key]); }
      groupMap[key].push(u);
    });
    groups.sort(function (g1, g2) {
      if (g1[0].nation === g2[0].nation) return 0;
      return g1[0].nation === 'player' ? -1 : 1;
    });
    groups.forEach(function (g) { executeGroup(state, g, rng); });
    // Remove the dead.
    state.units = state.units.filter(function (u) { return u.strength > 0; });
    state.day += 1;
    state.tickCount += 1;
    if (!state.gameOver && state.day > CFG.campaignEndDay) {
      state.gameOver = true;
      state.winner = state.provinces[state.nations.player.capitalId].owner === 'player' ? 'player' : 'enemy';
      state.endReason = state.winner === 'player'
        ? 'Campaign ends. Your capital still stands. A hard, grinding survival.'
        : 'Campaign ends with your capital in enemy hands.';
    }
    return state;
  }

  var api = {
    CFG: CFG,
    createGame: createGame,
    tick: tick,
    economyTick: economyTick,
    issueOrder: issueOrder,
    resolveBattle: resolveBattle,
    buildFactory: buildFactory,
    trainUnit: trainUnit,
    researchDroneGen2: researchDroneGen2,
    unitStats: unitStats,
    unitsIn: unitsIn,
    unitsOf: unitsOf,
    neighborsOf: neighborsOf,
    steelIncome: steelIncome,
    factoryLevels: factoryLevels,
    makeRng: makeRng,
    provinceId: provinceId
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.AshesSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
