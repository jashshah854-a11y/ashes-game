// Ashes of Empires, decal record (Cycle 23 Step 20b, MAP_TREATMENT 8.1).
// Derives decal stamps from the change of province owners across one tick,
// in the js/beats.js pattern: js/main.js snapshots the owners before the tick
// and hands both owner maps here with the provinces the player witnessed
// (intel live or remembered after the tick). A witnessed change of hands
// earns one stamp, scorch or crater, its variant picked by a hash of the
// province id and the event day (STRATEGY.md decals), so replays look the
// same. The record is a session record only, like beats: never saved.
// Loadable in node (module.exports) and in the browser (global.AshesDecals).
// Reads ONLY the plain input data. Never requires js/sim.js, never calls any
// sim function, and never mutates its input (builds new objects only).
(function (global) {
  'use strict';

  var VARIANT_COUNT = 7;
  // Session caps: the latest 3 stamps per province and 210 on the board.
  var PER_PROVINCE_CAP = 3;
  var TOTAL_CAP = 210;

  function cmpStr(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }

  // FNV-1a 32-bit hash (same algorithm as js/map-canvas.js).
  function fnv1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  // 'DC01' to 'DC07' from the province id and the event day.
  function variantFor(provinceId, day) {
    var h = fnv1a(provinceId + ':' + day);
    return 'DC0' + (1 + (h % VARIANT_COUNT));
  }

  // DC01 to DC04 are scorch marks, DC05 to DC07 shell craters.
  function kindFor(variant) {
    var n = parseInt(String(variant).slice(2), 10);
    return n >= 5 ? 'crater' : 'scorch';
  }

  function hasId(witnessedIds, id) {
    if (!witnessedIds) return false;
    if (typeof witnessedIds.has === 'function') return witnessedIds.has(id);
    return witnessedIds.indexOf(id) !== -1;
  }

  // prevOwners, nextOwners: {provinceId: owner}. One event per province in
  // both maps whose owner changed and that the player witnessed, sorted by
  // province id.
  function deriveDecalEvents(prevOwners, nextOwners, day, witnessedIds) {
    var prev = prevOwners || {};
    var next = nextOwners || {};
    var events = [];
    Object.keys(next).sort(cmpStr).forEach(function (pid) {
      if (!Object.prototype.hasOwnProperty.call(prev, pid)) return;
      if (prev[pid] === next[pid]) return;
      if (!hasId(witnessedIds, pid)) return;
      var variant = variantFor(pid, day);
      events.push({ provinceId: pid, day: day, by: next[pid], variant: variant, kind: kindFor(variant) });
    });
    return events;
  }

  // A new array: existing plus events, deduplicated by province and day (the
  // first copy kept), then the latest PER_PROVINCE_CAP per province and the
  // latest TOTAL_CAP overall, oldest dropped. Order is the record order,
  // oldest first.
  function appendDecals(existing, events) {
    var seen = {};
    var merged = [];
    (existing || []).concat(events || []).forEach(function (e) {
      var key = e.provinceId + '|' + e.day;
      if (seen[key]) return;
      seen[key] = true;
      merged.push(e);
    });
    var perProv = {};
    var keep = [];
    for (var i = merged.length - 1; i >= 0; i--) {
      var pid = merged[i].provinceId;
      perProv[pid] = (perProv[pid] || 0) + 1;
      if (perProv[pid] <= PER_PROVINCE_CAP) keep.push(merged[i]);
    }
    keep.reverse();
    if (keep.length > TOTAL_CAP) keep = keep.slice(keep.length - TOTAL_CAP);
    return keep.map(function (e) {
      return { provinceId: e.provinceId, day: e.day, by: e.by, variant: e.variant, kind: e.kind };
    });
  }

  var AshesDecals = {
    PER_PROVINCE_CAP: PER_PROVINCE_CAP,
    TOTAL_CAP: TOTAL_CAP,
    fnv1a: fnv1a,
    variantFor: variantFor,
    kindFor: kindFor,
    deriveDecalEvents: deriveDecalEvents,
    appendDecals: appendDecals
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesDecals;
  }
  global.AshesDecals = AshesDecals;
})(typeof window !== 'undefined' ? window : globalThis);
