// Ashes of Empires, attack beats (Cycle 23 Step 16a, MAP_TREATMENT 8.1).
// Derives the edges an attack crossed during one tick from three facts the UI
// already holds: a pre-tick unit snapshot, the battle records the tick wrote,
// and the post-tick units. The sim resolves a whole day inside one tick and its
// battle records name the kind, target, and nations but not the edge crossed,
// so the edge is rebuilt here in the sim's own assignment priority: a unit
// fights at most one battle per tick, and defenders are drawn first.
// Loadable in node (module.exports) and in the browser (global.AshesBeats).
// Reads ONLY the plain input data. Never requires js/sim.js, never calls any
// sim function, and never mutates its input (builds new objects only).
(function (global) {
  'use strict';

  var BEAT_KINDS = { battle: true, clash: true, meeting: true };

  function cmpStr(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }

  // input: { fightDay, snapshot: [{id, nation, provinceId, orderTarget}],
  //   records: [{kind, targetId, aNation, bNation}],
  //   postUnits: [{id, nation, provinceId, lastCombatDay}],
  //   neighbors: {provinceId: [provinceId, ...]} }
  // Returns [{a, b}] with a before b, deduped, sorted by a then b.
  function deriveBeatEdges(input) {
    var fightDay = input.fightDay;
    var snapshot = input.snapshot || [];
    var records = (input.records || []).filter(function (r) { return r && BEAT_KINDS[r.kind]; });
    var postUnits = input.postUnits || [];
    var neighbors = input.neighbors || {};

    var postById = {};
    postUnits.forEach(function (u) { postById[u.id] = u; });

    // Fought units: present before and after the tick, stamped this day.
    var fought = [];
    snapshot.forEach(function (s) {
      var p = postById[s.id];
      if (p && p.lastCombatDay === fightDay) fought.push({ snap: s, post: p });
    });

    var assigned = {};
    var edgeMap = {};
    function addEdge(x, y) {
      if (x == null || y == null || x === y) return;
      var a = cmpStr(x, y) <= 0 ? x : y;
      var b = a === x ? y : x;
      edgeMap[a + '|' + b] = { a: a, b: b };
    }
    function adjacent(x, y) {
      var list = neighbors[x] || [];
      return list.indexOf(y) !== -1;
    }
    function hasOrder(s) { return s.orderTarget != null && s.orderTarget !== s.provinceId; }

    // a. Defense: units standing on a battle target for its defending nation.
    records.forEach(function (r) {
      if (r.kind !== 'battle') return;
      fought.forEach(function (f) {
        if (assigned[f.snap.id]) return;
        if (f.snap.provinceId === r.targetId && f.snap.nation === r.bNation) assigned[f.snap.id] = true;
      });
    });

    // b. Snapshot orders.
    fought.forEach(function (f) {
      var s = f.snap;
      if (assigned[s.id] || !hasOrder(s)) return;
      var attack = records.some(function (r) {
        return (r.kind === 'battle' || r.kind === 'clash') && r.targetId === s.orderTarget && r.aNation === s.nation;
      });
      var meeting = !attack && records.some(function (r) {
        return r.kind === 'meeting' && (r.aNation === s.nation || r.bNation === s.nation);
      });
      if (attack || meeting) {
        assigned[s.id] = true;
        addEdge(s.provinceId, s.orderTarget);
      }
    });

    // c. Post-position: a unit beside the target that took it or held its origin.
    fought.forEach(function (f) {
      var s = f.snap;
      if (assigned[s.id]) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var nationOk = (r.kind === 'battle' && s.nation === r.aNation) ||
          (r.kind === 'clash' && (s.nation === r.aNation || s.nation === r.bNation));
        if (!nationOk) continue;
        var t = r.targetId;
        if (s.provinceId === t || !adjacent(s.provinceId, t)) continue;
        if (f.post.provinceId !== t && f.post.provinceId !== s.provinceId) continue;
        assigned[s.id] = true;
        addEdge(s.provinceId, t);
        return;
      }
    });

    // d. Meeting pairing against a fought unit of the other nation.
    fought.forEach(function (f) {
      var s = f.snap;
      if (assigned[s.id]) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.kind !== 'meeting' || (r.aNation !== s.nation && r.bNation !== s.nation)) continue;
        var other = r.aNation === s.nation ? r.bNation : r.aNation;
        var match = null;
        for (var j = 0; j < fought.length && !match; j++) {
          var v = fought[j].snap;
          if (v.nation !== other) continue;
          if (s.orderTarget != null) {
            if (v.provinceId === s.orderTarget) match = v;
          } else if (v.orderTarget === s.provinceId) {
            match = v;
          }
        }
        if (match) {
          addEdge(s.provinceId, match.provinceId);
          assigned[s.id] = true;
          return;
        }
      }
    });

    // e. Destroyed ordered groups: gone after the tick, the attack still crossed.
    snapshot.forEach(function (s) {
      if (postById[s.id] || !hasOrder(s)) return;
      var attack = records.some(function (r) {
        return (r.kind === 'battle' || r.kind === 'clash') && r.targetId === s.orderTarget && r.aNation === s.nation;
      });
      if (!attack) return;
      var homeBattle = records.some(function (r) { return r.kind === 'battle' && r.targetId === s.provinceId; });
      if (!homeBattle) addEdge(s.provinceId, s.orderTarget);
    });

    return Object.keys(edgeMap).map(function (k) { return edgeMap[k]; }).sort(function (x, y) {
      return cmpStr(x.a, y.a) || cmpStr(x.b, y.b);
    });
  }

  var AshesBeats = {
    deriveBeatEdges: deriveBeatEdges
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesBeats;
  }
  global.AshesBeats = AshesBeats;
})(typeof window !== 'undefined' ? window : globalThis);
