// Ashes of Empires, read-only presentation adapter.
//
// Presentation reads the simulation only through this adapter; the
// adapter never changes the game; fog gating comes from the sim intel
// readouts, so a dark province exposes geography only and a remembered
// province exposes only its snapshot.
//
// Every call to playerView builds a brand new plain object. Nothing in
// the view is a reference into the live state, so a renderer may keep,
// cache, or mutate a view without any way to reach the simulation.
//
// Loadable in the browser (global.AshesView) and in node
// (module.exports), like js/sim.js.
(function (global) {
  'use strict';

  var Sim = (typeof module !== 'undefined' && module.exports)
    ? require('./sim.js')
    : global.AshesSim;

  // A fresh copy of any sim readout: every nested object and array is
  // new, so the view never shares structure with the live state.
  function deepCopy(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepCopy);
    var out = {};
    Object.keys(value).forEach(function (k) { out[k] = deepCopy(value[k]); });
    return out;
  }

  // The whole player view of one state, built only from sim readouts.
  // Dark provinces carry geography only; remembered provinces carry
  // their snapshot and nothing current; live provinces carry the live
  // facts. The adapter calls no sim function that changes state.
  function playerView(state) {
    var provinces = Object.keys(state.provinces).sort().map(function (id) {
      var p = state.provinces[id];
      var entry = {
        id: p.id,
        x: p.x,
        y: p.y,
        name: p.name,
        isCapital: p.isCapital,
        coastal: p.coastal,
        intel: Sim.intelState(state, 'player', id),
        lastSeenDay: Sim.intelLastSeenDay(state, 'player', id)
      };

      if (entry.intel === 'live') {
        entry.owner = p.owner;
        entry.steel = p.steel;
        entry.factoryLevel = p.factoryLevel;
        entry.fortLevel = p.fortLevel;
        entry.fortBuild = p.fortBuild ? deepCopy(p.fortBuild) : null;
        entry.flotilla = p.flotilla;
        entry.units = Sim.unitsIn(state, id).map(function (u) {
          var st = Sim.unitStats(state, u);
          return {
            id: u.id,
            nation: u.nation,
            type: u.type,
            provinceId: u.provinceId,
            strength: u.strength,
            maxStrength: u.maxStrength,
            supplyPenalty: u.supplyPenalty,
            stats: {
              attack: st.attack,
              defense: st.defense,
              supplyPenalty: st.supplyPenalty
            }
          };
        });
      } else if (entry.intel === 'remembered') {
        var snap = Sim.intelSnapshot(state, 'player', id);
        entry.snapshot = snap ? deepCopy(snap) : null;
      }
      return entry;
    });

    var edges = state.edgeList.map(function (e) {
      var railState;
      if (e.rail == null) railState = 'none';
      else if (e.rail.converting) railState = 'converting';
      else if (e.rail.daysLeft > 0) railState = 'building';
      else railState = 'built';
      return { a: e.a, b: e.b, terrain: e.terrain, railState: railState };
    });

    var n = state.nations.player;
    var provincesOwned = 0;
    Object.keys(state.provinces).forEach(function (k) {
      if (state.provinces[k].owner === 'player') provincesOwned++;
    });

    var ownNation = {
      id: n.id,
      name: n.name,
      short: n.short,
      steel: n.steel,
      equipment: n.equipment,
      researchPoints: n.researchPoints,
      manpower: Sim.manpowerPool(state, 'player'),
      droneGen2: n.droneGen2,
      droneGen3: n.droneGen3,
      jammingGen: Sim.jammingGeneration(state, 'player'),
      interceptors: Sim.interceptorStock(state, 'player'),
      agents: Sim.agentStock(state, 'player'),
      flotillas: Sim.flotillaStock(state, 'player'),
      capitalId: n.capitalId,
      provincesOwned: provincesOwned,
      factoryLevels: Sim.factoryLevels(state, 'player'),
      score: deepCopy(Sim.campaignScore(state, 'player'))
    };

    return {
      day: state.day,
      gameOver: state.gameOver,
      winner: state.winner,
      viewer: 'player',
      provinces: provinces,
      edges: edges,
      ownNation: ownNation
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = playerView;
  }
  global.AshesView = playerView;
})(typeof window !== 'undefined' ? window : globalThis);
