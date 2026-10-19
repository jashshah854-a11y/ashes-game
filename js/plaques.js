// Ashes of Empires, plaque system.
// Builds plaque descriptors from a player view and renders them as DOM elements.
// Loadable in node (module.exports) and in the browser (global.AshesPlaques).
// Reads ONLY an adapter playerView object. Never requires js/sim.js, never calls
// any sim function, and never mutates the view (builds new objects only).
(function (global) {
  'use strict';

  var PALETTE = {
    playerFill: '#2E6FD8',
    enemyFill: '#14161A',
    enemyRim: '#C8372D',
    numeral: '#FFFFFF'
  };

  var GLYPHS = {
    soldier: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-5-7h10v2H7v-2zm0-4h10v2H7v-2zm0-4h10v2H7V8z"/></svg>',
    drone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM12 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM6 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 10c0 2.21-1.79 4-4 4h-2V8h2c2.21 0 4 1.79 4 4zm-6 4h2v-4h-2c-2.21 0-4-1.79-4-4V4c0-1.11-.89-2-2-2H6c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2v-4h-2c0 2.21-1.79 4-4 4z"/></svg>',
    factory: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-2h6v2zm4 0h-6v-2h6v2zm4 0h-6v-2h6v2zm-4-4H6v-2h6v2zm4 0h-6v-2h6v2zm4 0h-6v-2h6v2zm-4-4H6V7h6v2zm4 0h-6V7h6v2zm4 0h-6V7h6v2zM8 5h2v2H8V5zm4 0h2v2h-2V5zm4 0h2v2h-2V5z"/></svg>',
    fort: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v8H3v-8zm4 8H5v-8h2v8zm4-8H7v8h2v-8zm4 8h-2v-8h2v8zm4-8v8h2v-8h-2zM3 3v8h2V3H3zm4 0v8h2V3H7zm4 0v8h2V3h-2zm4 0v8h2V3h-2zm4 0v8h2V3h-2zM16 17.01V10h2v7.01h-2z"/></svg>',
    alarm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
  };

  function glyphForType(type) {
    if (type === 'infantry') return 'soldier';
    if (type === 'drone') return 'drone';
    if (type === 'flotilla') return 'ship';
    return 'soldier';
  }

  function buildPlaques(view) {
    var unitPlaques = [];
    var buildingMarks = [];

    view.provinces.forEach(function (p) {
      if (p.intel === 'live') {
        var groups = {};
        if (p.units && p.units.length > 0) {
          p.units.forEach(function (u) {
            var key = u.nation + '|' + u.type;
            if (!groups[key]) {
              groups[key] = {
                nation: u.nation,
                type: u.type,
                count: 0,
                totalStrength: 0,
                outOfSupply: false
              };
            }
            groups[key].count++;
            groups[key].totalStrength += u.strength;
            if ((u.supplyPenalty || 0) > 0) {
              groups[key].outOfSupply = true;
            }
          });
        }

        var sortedKeys = Object.keys(groups).sort();
        sortedKeys.forEach(function (key) {
          var g = groups[key];
          var numeral = String(g.count) + 'x' + String(g.totalStrength);
          unitPlaques.push({
            provinceId: p.id,
            x: p.x,
            y: p.y,
            intel: 'live',
            nation: g.nation,
            type: g.type,
            glyph: glyphForType(g.type),
            count: g.count,
            totalStrength: g.totalStrength,
            numeral: numeral,
            outOfSupply: g.outOfSupply,
            hollow: false
          });
        });

        if (p.flotilla && typeof p.flotilla === 'string' && p.flotilla.length > 0) {
          unitPlaques.push({
            provinceId: p.id,
            x: p.x,
            y: p.y,
            intel: 'live',
            nation: p.flotilla,
            type: 'flotilla',
            glyph: 'ship',
            count: 1,
            totalStrength: null,
            numeral: null,
            outOfSupply: false,
            hollow: false
          });
        }

        if ((p.factoryLevel || 0) > 0) {
          buildingMarks.push({
            provinceId: p.id,
            x: p.x,
            y: p.y,
            kind: 'factory',
            level: p.factoryLevel,
            glyph: 'factory'
          });
        }
        if ((p.fortLevel || 0) > 0) {
          buildingMarks.push({
            provinceId: p.id,
            x: p.x,
            y: p.y,
            kind: 'fort',
            level: p.fortLevel,
            glyph: 'fort'
          });
        }
      } else if (p.intel === 'remembered' && p.snapshot) {
        var snapGroups = {};
        if (p.snapshot.units && p.snapshot.units.length > 0) {
          p.snapshot.units.forEach(function (u) {
            var key = u.nation + '|' + u.type;
            if (!snapGroups[key]) {
              snapGroups[key] = {
                nation: u.nation,
                type: u.type
              };
            }
          });
        }
        var snapKeys = Object.keys(snapGroups).sort();
        snapKeys.forEach(function (key) {
          var g = snapGroups[key];
          unitPlaques.push({
            provinceId: p.id,
            x: p.x,
            y: p.y,
            intel: 'remembered',
            nation: g.nation,
            type: g.type,
            glyph: glyphForType(g.type),
            count: null,
            totalStrength: null,
            numeral: null,
            outOfSupply: false,
            hollow: true
          });
        });
      }
    });

    return { unitPlaques: unitPlaques, buildingMarks: buildingMarks };
  }

  function renderPlaques(container, view) {
    if (typeof document === 'undefined') {
      return;
    }

    var descriptors = buildPlaques(view);
    var layer = document.createElement('div');
    layer.className = 'plaque-layer';
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';

    descriptors.unitPlaques.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'plaque ' + (d.hollow ? 'plaque-hollow' : 'plaque-live') + ' ' +
        (d.nation === 'player' ? 'faction-player' : 'faction-enemy');
      el.dataset.province = d.provinceId;
      el.dataset.type = d.type;
      el.dataset.nation = d.nation;
      el.dataset.intel = d.intel;
      el.style.left = ((d.x + 0.5) * 10) + '%';
      el.style.top = ((d.y + 0.5) * 100 / 7) + '%';

      var glyphSpan = document.createElement('span');
      glyphSpan.className = 'glyph';
      glyphSpan.innerHTML = d.glyph;
      el.appendChild(glyphSpan);

      if (d.numeral !== null) {
        var numeralSpan = document.createElement('span');
        numeralSpan.className = 'numeral';
        numeralSpan.textContent = d.numeral;
        el.appendChild(numeralSpan);
      }

      if (d.outOfSupply) {
        var alarmSpan = document.createElement('span');
        alarmSpan.className = 'alarm';
        alarmSpan.innerHTML = GLYPHS.alarm;
        el.appendChild(alarmSpan);
      }

      layer.appendChild(el);
    });

    descriptors.buildingMarks.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'building-mark mark-' + d.kind;
      el.dataset.province = d.provinceId;
      el.dataset.kind = d.kind;
      el.style.left = ((d.x + 0.5) * 10) + '%';
      el.style.top = (d.y * 100 / 7) + '%';

      var glyphSpan = document.createElement('span');
      glyphSpan.className = 'glyph';
      glyphSpan.innerHTML = d.glyph;
      el.appendChild(glyphSpan);

      var levelSpan = document.createElement('span');
      levelSpan.className = 'mark-level';
      levelSpan.textContent = String(d.level);
      el.appendChild(levelSpan);

      layer.appendChild(el);
    });

    container.appendChild(layer);
    container.dataset.plaqueCount = String(descriptors.unitPlaques.length + descriptors.buildingMarks.length);
  }

  var AshesPlaques = {
    buildPlaques: buildPlaques,
    renderPlaques: renderPlaques,
    PALETTE: PALETTE,
    GLYPHS: GLYPHS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesPlaques;
  }
  global.AshesPlaques = AshesPlaques;
})(typeof window !== 'undefined' ? window : globalThis);