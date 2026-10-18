// Ashes of Empires, save files.
// Turns the sim state from createGame in js/sim.js into one JSON save string
// and back again, touching no game rule on either trip. A save is an
// envelope, an object with five fields in this order: saveVersion (this
// format is version 1), seed (the campaign seed), tick (the tick count), and
// checksum, a guard over the payload, then the payload itself, the whole
// saved game state written as one JSON string. checksumFor computes that
// guard: an FNV-1a hash over the payload string, with the same starting
// value and multiplier the sim uses in hashString in js/sim.js, returned as
// a decimal string.
// edges and edgeList are two views of one edge set, so the save keeps every
// other top level key of the state, omits edges, and lets edgeList carry
// each edge once; on load the edges lookup is rebuilt from edgeList with
// each edges entry set to the very same object as its edgeList entry, so
// the two views can never drift apart.
// The four record families, beats, textures, exchange, and intel, are
// records only. They are restored exactly as saved: nothing is recomputed
// or regenerated, and no sim function is called on load.
// serializeSave never throws. Before it writes, it walks the saved state
// and refuses, naming the field where it sits, any value a JSON save
// cannot carry faithfully: a function, an undefined value, a symbol, a
// bigint, NaN, Infinity, negative Infinity, or a circular reference.
// deserializeSave never throws either. It refuses text that is not a save
// at all, a header with a field missing, a version other than 1, a payload
// that does not match its checksum, or a payload that is damaged or does
// not agree with its header, each with a plain reason naming what is
// wrong.
// Plain functions over plain data. No DOM, no timers, no storage, no file
// access. Loadable in the browser (window.AshesSave) and in node
// (module.exports), like js/sim.js.
(function (global) {
  'use strict';

  var SAVE_VERSION = 1;

  // The 18 top level keys of a saved state: the createGame keys minus edges,
  // in createGame order. edges is omitted because edgeList carries every
  // edge once and edges is rebuilt from it on load.
  var REQUIRED_KEYS = [
    'day', 'seed', 'tickCount', 'mapW', 'mapH', 'provinces', 'edgeList',
    'units', 'nextUnitId', 'gameOver', 'winner', 'endReason', 'log',
    'beats', 'textures', 'exchange', 'intel', 'nations'
  ];

  var HEADER_FIELDS = ['saveVersion', 'seed', 'tick', 'checksum', 'payload'];

  function checksumFor(payloadText) {
    var h = 2166136261;
    for (var i = 0; i < payloadText.length; i++) {
      h ^= payloadText.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return String(h >>> 0);
  }

  function unserializable(path, why) {
    return {
      field: path,
      reason: 'The save cannot be written because ' + path + ' ' + why + '.'
    };
  }

  // Returns null when JSON can carry the value faithfully, or a rejection
  // naming the first value it cannot carry. Walks every nested object and
  // array; ancestors holds the objects on the current path as the cycle
  // guard, so a shared object visited twice on different branches is fine
  // and only a true loop is refused.
  function checkValue(value, path, ancestors) {
    var t = typeof value;
    if (t === 'function') {
      return unserializable(path, 'holds a function, and a save file can store data, not functions');
    }
    if (t === 'undefined') {
      return unserializable(path, 'is undefined, a value a save file cannot store');
    }
    if (t === 'symbol') {
      return unserializable(path, 'holds a symbol, a value a save file cannot store');
    }
    if (t === 'bigint') {
      return unserializable(path, 'holds a BigInt, a kind of number a save file cannot store');
    }
    if (t === 'number' && value !== value) {
      return unserializable(path, 'holds NaN, a number that is not a real number, and a save file cannot store it');
    }
    if (t === 'number' && value === Infinity) {
      return unserializable(path, 'holds Infinity, an infinite number a save file cannot store');
    }
    if (t === 'number' && value === -Infinity) {
      return unserializable(path, 'holds negative Infinity, an infinite number a save file cannot store');
    }
    if (t === 'number' && Object.is(value, -0)) {
      return unserializable(path, 'holds negative zero, a value a save file cannot store faithfully');
    }
    if (t === 'object' && value !== null) {
      if (ancestors.indexOf(value) !== -1) {
        return unserializable(path, 'points back to an earlier part of the save, forming a circular loop a save file cannot store');
      }
      ancestors.push(value);
      var bad = null;
      var keys;
      var i;
      if (Array.isArray(value)) {
        for (i = 0; i < value.length; i++) {
          bad = checkValue(value[i], path + '[' + i + ']', ancestors);
          if (bad) break;
        }
      } else {
        keys = Object.keys(value);
        for (i = 0; i < keys.length; i++) {
          bad = checkValue(value[keys[i]], path === '' ? keys[i] : path + '.' + keys[i], ancestors);
          if (bad) break;
        }
      }
      ancestors.pop();
      return bad;
    }
    return null;
  }

  function serializeSave(state) {
    if (!state || typeof state !== 'object') {
      return {
        ok: false,
        kind: 'missing',
        field: 'state',
        reason: 'The game state itself is missing or is not an object, so there is nothing to save.'
      };
    }
    if (state.edgeList === undefined) {
      return {
        ok: false,
        kind: 'missing',
        field: 'edgeList',
        reason: 'The game state is missing its edge list, the record of every road and river crossing between provinces, so there is nothing to save.'
      };
    }
    if (!Array.isArray(state.edgeList)) {
      return {
        ok: false,
        kind: 'missing',
        field: 'edgeList',
        reason: 'The game state has an edge list that is not a list, so the roads and river crossings between provinces cannot be saved.'
      };
    }

    // Build the saved state: every top level key except edges, in the order
    // the state itself carries them.
    var saved = {};
    var stateKeys = Object.keys(state);
    for (var i = 0; i < stateKeys.length; i++) {
      var k = stateKeys[i];
      if (k === 'edges') continue;
      saved[k] = state[k];
    }

    // Walk the saved state before stringifying: JSON must carry every value
    // faithfully, or the save would silently lose it.
    var bad = checkValue(saved, '', []);
    if (bad) return { ok: false, kind: 'unserializable', field: bad.field, reason: bad.reason };

    var payloadText = JSON.stringify(saved);
    var envelope = {
      saveVersion: SAVE_VERSION,
      seed: state.seed,
      tick: state.tickCount,
      checksum: checksumFor(payloadText),
      payload: payloadText
    };
    return { ok: true, text: JSON.stringify(envelope) };
  }

  function deserializeSave(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return {
        ok: false,
        kind: 'not-a-save',
        reason: 'There is nothing to load: a save must be a non empty piece of text, and what was given is empty or is not text at all.'
      };
    }
    var envelope;
    try {
      envelope = JSON.parse(text);
    } catch (e) {
      return {
        ok: false,
        kind: 'not-a-save',
        reason: 'The save file is broken: its text does not read as JSON, so it was cut off or damaged and there is nothing to load.'
      };
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return {
        ok: false,
        kind: 'not-a-save',
        reason: 'The save file is not an Ashes of Empires save: a save begins with one envelope object at the top, and this file does not contain one.'
      };
    }
    if (typeof envelope.payload !== 'string') {
      return {
        ok: false,
        kind: 'not-a-save',
        reason: 'The save envelope is broken: its payload field, the part that holds the campaign itself, is not text.'
      };
    }
    for (var h = 0; h < HEADER_FIELDS.length; h++) {
      if (!(HEADER_FIELDS[h] in envelope)) {
        return {
          ok: false,
          kind: 'missing',
          field: HEADER_FIELDS[h],
          reason: 'The save header is missing its ' + HEADER_FIELDS[h] + ', so the save cannot be loaded.'
        };
      }
    }
    if (envelope.saveVersion !== SAVE_VERSION) {
      return {
        ok: false,
        kind: 'version',
        reason: 'This save was made by a different version of the game (save version ' + String(envelope.saveVersion) + '). This game can only load version ' + SAVE_VERSION + ' saves, so nothing was loaded and your current game keeps running.'
      };
    }
    if (checksumFor(envelope.payload) !== envelope.checksum) {
      return {
        ok: false,
        kind: 'checksum',
        reason: 'The save does not match the checksum in its own header, so its contents were damaged or changed after it was saved.'
      };
    }
    var payload;
    try {
      payload = JSON.parse(envelope.payload);
    } catch (e) {
      return {
        ok: false,
        kind: 'corrupt',
        reason: 'The payload, the part of the save that holds the campaign itself, does not read as JSON, so the save is damaged.'
      };
    }
    if (!payload || typeof payload !== 'object') {
      return {
        ok: false,
        kind: 'missing',
        field: REQUIRED_KEYS[0],
        reason: 'The saved game is missing its ' + REQUIRED_KEYS[0] + ', so the campaign cannot be restored.'
      };
    }
    for (var r = 0; r < REQUIRED_KEYS.length; r++) {
      if (!(REQUIRED_KEYS[r] in payload)) {
        return {
          ok: false,
          kind: 'missing',
          field: REQUIRED_KEYS[r],
          reason: 'The saved game is missing its ' + REQUIRED_KEYS[r] + ', so the campaign cannot be restored.'
        };
      }
    }
    if (payload.seed !== envelope.seed) {
      return {
        ok: false,
        kind: 'corrupt',
        reason: 'The campaign seed inside the payload does not match the seed recorded in the save header, so the save was changed after it was written.'
      };
    }
    if (payload.tickCount !== envelope.tick) {
      return {
        ok: false,
        kind: 'corrupt',
        reason: 'The tick count inside the payload does not match the tick count recorded in the save header, so the save was changed after it was written.'
      };
    }
    if (!Array.isArray(payload.edgeList)) {
      return {
        ok: false,
        kind: 'corrupt',
        reason: 'The saved edge list, which records every road and river crossing between provinces, is not a list, so the map cannot be rebuilt.'
      };
    }
    for (var ei = 0; ei < payload.edgeList.length; ei++) {
      var entry = payload.edgeList[ei];
      if (!entry || typeof entry !== 'object' || typeof entry.a !== 'string' || typeof entry.b !== 'string') {
        return {
          ok: false,
          kind: 'corrupt',
          reason: 'The edge at index ' + ei + ' in the saved edge list does not carry the ids of its two provinces as text, so the map cannot be rebuilt.'
        };
      }
    }

    // Rebuild the edges lookup from edgeList: the key is the two endpoint
    // ids sorted as strings and joined with a vertical bar, the edgeKey rule
    // from js/sim.js, and each edges entry is the very same object as its
    // edgeList entry.
    var edges = {};
    for (var ej = 0; ej < payload.edgeList.length; ej++) {
      var e = payload.edgeList[ej];
      var key = e.a < e.b ? e.a + '|' + e.b : e.b + '|' + e.a;
      edges[key] = e;
    }

    var restored = {
      day: payload.day,
      seed: payload.seed,
      tickCount: payload.tickCount,
      mapW: payload.mapW,
      mapH: payload.mapH,
      provinces: payload.provinces,
      edges: edges,
      edgeList: payload.edgeList,
      units: payload.units,
      nextUnitId: payload.nextUnitId,
      gameOver: payload.gameOver,
      winner: payload.winner,
      endReason: payload.endReason,
      log: payload.log,
      beats: payload.beats,
      textures: payload.textures,
      exchange: payload.exchange,
      intel: payload.intel,
      nations: payload.nations
    };
    return { ok: true, state: restored };
  }

  var api = {
    SAVE_VERSION: SAVE_VERSION,
    serializeSave: serializeSave,
    deserializeSave: deserializeSave,
    checksumFor: checksumFor
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.AshesSave = api;
})(typeof window !== 'undefined' ? window : globalThis);
