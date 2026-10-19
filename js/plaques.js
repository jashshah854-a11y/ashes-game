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
    soldier: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.9 4.5A2.1 2.1 0 1 1 14.1 4.5A2.1 2.1 0 1 1 9.9 4.5ZM9.1 8.1L14.9 8.1L14.4 12.7L9.6 12.7ZM9.2 12.1L11.3 12.5L7.6 21.3L5.7 20.7ZM12.7 12.5L14.8 12.1L19.9 20.9L18 21.4ZM5.77 12.41L17.37 6.01L18.23 7.59L6.63 13.99Z"/></svg>',
    drone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.43 7.57L7.57 6.43L17.57 16.43L16.43 17.57ZM17.57 7.57L7.57 17.57L6.43 16.43L16.43 6.43ZM9.3 12A2.7 2.7 0 1 1 14.7 12A2.7 2.7 0 1 1 9.3 12ZM3.4 5.6A2.2 2.2 0 1 1 7.8 5.6A2.2 2.2 0 1 1 3.4 5.6ZM16.2 5.6A2.2 2.2 0 1 1 20.6 5.6A2.2 2.2 0 1 1 16.2 5.6ZM3.4 18.4A2.2 2.2 0 1 1 7.8 18.4A2.2 2.2 0 1 1 3.4 18.4ZM16.2 18.4A2.2 2.2 0 1 1 20.6 18.4A2.2 2.2 0 1 1 16.2 18.4Z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.2 11.8L5.5 13L20 13L20 17.2L7.5 18.6ZM9 8.5L16 8.5L16 13L9 13ZM10.5 5.5L14 5.5L14 8.5L10.5 8.5ZM11.3 3L12.7 3L12.7 8.5L11.3 8.5Z"/></svg>',
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
      glyphSpan.innerHTML = GLYPHS[d.glyph] || '';
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
      glyphSpan.innerHTML = GLYPHS[d.glyph] || '';
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