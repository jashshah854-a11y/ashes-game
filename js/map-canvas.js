// Ashes of Empires, map canvas renderer for the parchment board layer.
// Builds an offscreen canvas from the same map geometry the DOM tiles use.
// Loadable in node (module.exports) and in the browser (global.AshesMapCanvas).
// Reads ONLY a playerView object and the geometry object. Never requires
// js/sim.js, never calls any sim function, and never mutates inputs.
(function (global) {
  'use strict';

  // Chart module (Cycle 23 Step 9): node require, browser global.
  var AshesChart = (typeof module !== 'undefined' && module.exports)
    ? require('./map-chart.js')
    : global.AshesChart;
  var CHART_C = AshesChart ? AshesChart.CHART_CONSTANTS : {};
  var CHART_SEA_DEEP = CHART_C.SEA_DEEP;
  var CHART_SEA_MID = CHART_C.SEA_MID;
  var CHART_SEA_SHELF = CHART_C.SEA_SHELF;
  var CHART_SEA_SHORE = CHART_C.SEA_SHORE;
  var CHART_LAND_LOW = CHART_C.LAND_LOW;
  var CHART_BEACH = CHART_C.BEACH;
  var CHART_FRAME_PAPER = CHART_C.FRAME_PAPER;
  var CHART_INK = CHART_C.INK;
  var CHART_RIVER_WATER = CHART_C.RIVER_WATER;
  var CHART_RIVER_BANK = CHART_C.RIVER_BANK;
  var CHART_RIVER_GLINT = CHART_C.RIVER_GLINT;
  var CHART_CONTOUR = CHART_C.CONTOUR;

  // TX-LAND texture data (Cycle 23 Step 19a): node require, browser global.
  var AshesTxLandData = (typeof module !== 'undefined' && module.exports)
    ? require('./tx-land-data.js')
    : global.AshesTxLandData;

  // TX-SEA and TX-PAPER texture data (Cycle 23 Step 19b): node require,
  // browser global.
  var AshesTxSeaData = (typeof module !== 'undefined' && module.exports)
    ? require('./tx-sea-data.js')
    : global.AshesTxSeaData;
  var AshesTxPaperData = (typeof module !== 'undefined' && module.exports)
    ? require('./tx-paper-data.js')
    : global.AshesTxPaperData;

  // TX-FOG-UK and TX-FOG-LS texture data (Cycle 23 Step 19c): node require,
  // browser global.
  var AshesTxFogUkData = (typeof module !== 'undefined' && module.exports)
    ? require('./tx-foguk-data.js')
    : global.AshesTxFogUkData;
  var AshesTxFogLsData = (typeof module !== 'undefined' && module.exports)
    ? require('./tx-fogls-data.js')
    : global.AshesTxFogLsData;

  // RX01 / RX02 micro relief tile data (Cycle 23 Step 19d-1): node require,
  // browser global.
  var AshesRxData = (typeof module !== 'undefined' && module.exports)
    ? require('./rx-data.js')
    : global.AshesRxData;

  // Rail restyle (Cycle 23 Step 10, MAP_TREATMENT 2.6), in cell units.
  var RAIL_LINE_W = 0.008;
  var RAIL_TIE_STEP = 0.06;
  var RAIL_TIE_LEN = 0.03;
  var RAIL_DOT_STEP = 0.04;
  var RAIL_DOT_R = 0.004;

  // Province borders (Cycle 23 Step 12a, MAP_TREATMENT 5.2), in cell units.
  var BORDER_LINE_W = 0.009;
  var BORDER_ALPHA = 0.50;
  var BORDER_DASH = 0.040;
  var BORDER_GAP = 0.025;

  // Front casing (MAP_TREATMENT 5.3 item 3): Paper under the Ink front.
  var FRONT_CASING = '#E6D8B5';
  var FRONT_CASING_ALPHA = 0.6;
  var FRONT_CASING_PLUS_PX = 2;

  // Fictional coordinates (Cycle 23 Step 13, MAP_TREATMENT 4.1 and 4.2):
  // latitude(y) = 51.5 - 2.0 * y, longitude(x) = 8.5 + 2.8 * x. One
  // graticule line every 5 degrees.
  var DEG = '°';
  var GRATICULE_MERIDIANS = [10, 15, 20, 25, 30, 35].map(function (lon) {
    return { lon: lon, x: (lon - 8.5) / 2.8, label: lon + DEG + 'E' };
  });
  var GRATICULE_PARALLELS = [50, 45, 40].map(function (lat) {
    return { lat: lat, y: (51.5 - lat) / 2, label: lat + DEG + 'N' };
  });
  var GRATICULE_LABELS = GRATICULE_MERIDIANS.map(function (m) { return m.label; })
    .concat(GRATICULE_PARALLELS.map(function (p) { return p.label; }));
  var GRATICULE_ALPHA = 0.20;

  // Chart border furniture (MAP_TREATMENT 4.3 and 4.4), in cell units. The
  // scale bar and the north arrow sit in the foot strip of the standard
  // 10 by 7 lattice (neatline bottom at y 8, frame bottom at y 8.55). The
  // arrow stands in the corner column past the right degree bar (x 11.06 to
  // 11.3), so the N above its tip clears both degree bars.
  var DEGREE_BAR_W = 0.06;
  var NEATLINE_W = 0.008;
  var OUTER_FRAME_W = 0.012;
  var SCALE_BAR = { x: -1.20, y: 8.10, length: 0.90, height: 0.035, marks: [0, 0.225, 0.45, 0.90] };
  var NORTH_ARROW = { cx: 11.18, tipY: 8.14, baseY: 8.50, halfWidth: 0.07 };

  // Graticule furniture ops (MAP_TREATMENT 4.2): meridians west to east, then
  // parallels north to south, each running neatline to neatline. Geometry
  // alone decides the list; it never reads the view or the fog.
  function buildFurnitureOps(geom) {
    var x0 = -1;
    var y0 = -1;
    var x1 = geom.mapW + 1;
    var y1 = geom.mapH + 1;
    var ops = [];
    GRATICULE_MERIDIANS.forEach(function (m) {
      ops.push({ kind: 'graticule', line: [m.x, y0, m.x, y1] });
    });
    GRATICULE_PARALLELS.forEach(function (p) {
      ops.push({ kind: 'graticule', line: [x0, p.y, x1, p.y] });
    });
    return ops;
  }

  // Flat [x, y, ...] from a point array.
  function flatPoints(points) {
    var flat = [];
    for (var i = 0; i < points.length; i++) flat.push(points[i].x, points[i].y);
    return flat;
  }

  // Stations every step of arc length along a flat path, starting half a
  // step in so shared corners do not double up. Each station carries the
  // unit direction of the piece it lies on.
  function pathStations(path, step) {
    var out = [];
    var total = 0;
    var i;
    for (i = 2; i < path.length; i += 2) {
      total += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    }
    var next = step / 2;
    var base = 0;
    for (i = 2; i < path.length && next <= total; i += 2) {
      var ax = path[i - 2];
      var ay = path[i - 1];
      var dx = path[i] - ax;
      var dy = path[i + 1] - ay;
      var len = Math.hypot(dx, dy);
      if (len <= 0) continue;
      while (next <= base + len) {
        var t = (next - base) / len;
        out.push({ x: ax + dx * t, y: ay + dy * t, ux: dx / len, uy: dy / len });
        next += step;
      }
      base += len;
    }
    return out;
  }

  // Flat [x1, y1, x2, y2, ...] cross ties for a built rail path.
  function railTies(path) {
    var ties = [];
    var h = RAIL_TIE_LEN / 2;
    pathStations(path, RAIL_TIE_STEP).forEach(function (st) {
      ties.push(st.x + st.uy * h, st.y - st.ux * h, st.x - st.uy * h, st.y + st.ux * h);
    });
    return ties;
  }

  // Flat [x, y, ...] dot centres for an unbuilt rail path.
  function railDots(path) {
    var dots = [];
    pathStations(path, RAIL_DOT_STEP).forEach(function (st) { dots.push(st.x, st.y); });
    return dots;
  }

  // Flat [x, y, w, ...] from chart river samples.
  function flatSamples(samples) {
    var flat = [];
    samples.forEach(function (q) { flat.push(q.x, q.y, q.w); });
    return flat;
  }

  // Constants
  var DPR_CAP_DESKTOP = 2;
  var DPR_CAP_MOBILE = 1.5;
  var MOBILE_MAX_WIDTH = 820;
  var PIXEL_CAP = 16700000;
  var ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // FNV-1a 32-bit hash (same algorithm as map-geometry.js)
  function fnv1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  // State layer constants (nominal px at scaleX 160)
  var BAND_WIDE_W = 16;
  var BAND_MID_W = 9;
  var BAND_CORE_W = 3;
  var BAND_WIDE_ALPHA = 0.12;
  var BAND_MID_ALPHA = 0.18;
  var FILL_ALPHA = 0.06;
  var FRONT_W = 4;

  // Return effective DPR capped by device class.
  // rawDpr: window.devicePixelRatio or 1. viewportWidth: window.innerWidth.
  function effectiveDpr(rawDpr, viewportWidth) {
    var dpr = (typeof rawDpr === 'number' && rawDpr >= 1) ? rawDpr : 1;
    var cap = (viewportWidth <= MOBILE_MAX_WIDTH) ? DPR_CAP_MOBILE : DPR_CAP_DESKTOP;
    return dpr > cap ? cap : dpr;
  }

  // Fit dimensions under the pixel cap.
  // Returns {width, height, scale} where scale is the factor applied to both dimensions.
  function fitPixels(w, h) {
    var area = w * h;
    if (area <= PIXEL_CAP) {
      return { width: w, height: h, scale: 1 };
    }
    var scale = Math.sqrt(PIXEL_CAP / area);
    var nw = Math.max(1, Math.floor(w * scale));
    var nh = Math.max(1, Math.floor(h * scale));
    // Re-check in case flooring pushed us over (should not happen but be safe)
    if (nw * nh > PIXEL_CAP) {
      scale = Math.sqrt(PIXEL_CAP / (nw * nh));
      nw = Math.max(1, Math.floor(nw * scale));
      nh = Math.max(1, Math.floor(nh * scale));
    }
    return { width: nw, height: nh, scale: scale };
  }

  // Build an ordered array of plain draw operations from geometry and view.
  // No DOM use. Points are in cell-space coordinates.
  function buildDrawOps(geom, view) {
    var ops = [];

    // Sea background (first)
    ops.push({ kind: 'sea' });

    // Province polygons in order (geom.provinces is already sorted by id)
    geom.provinces.forEach(function (p) {
      var points = [];
      for (var i = 0; i < p.polygon.length; i++) {
        var pt = p.polygon[i];
        points.push(pt.x, pt.y);
      }
      // boundarySegs: one flag per polygon segment in point order, true when
      // the segment lies on the lattice boundary by cell position (Step 9).
      var boundarySegs = [
        p.y === 0, p.y === 0,
        p.x === geom.mapW - 1, p.x === geom.mapW - 1,
        p.y === geom.mapH - 1, p.y === geom.mapH - 1,
        p.x === 0, p.x === 0
      ];
      ops.push({ kind: 'polygon', id: p.id, points: points, x: p.x, y: p.y, boundarySegs: boundarySegs });
    });

    // The old light blue coast ops are retired (Cycle 23 Step 12a): the
    // chart coastline (Step 9) is the only coast line.

    // River segments, each carrying its chart edge samples (Step 10).
    var chart = AshesChart ? AshesChart.buildChart(geom) : null;
    var rivers = chart ? chart.rivers : { edges: [], mouths: [] };
    geom.riverSegments.forEach(function (rs, ri) {
      var path = [];
      for (var i = 0; i < rs.path.length; i++) {
        var pt = rs.path[i];
        path.push(pt.x, pt.y);
      }
      var edge = rivers.edges[ri];
      if (!edge || edge.a !== rs.a || edge.b !== rs.b) {
        edge = rivers.edges.find(function (e) { return e.a === rs.a && e.b === rs.b; });
      }
      ops.push({ kind: 'river', a: rs.a, b: rs.b, path: path, samples: edge ? flatSamples(edge.samples) : [] });
    });

    // Mouth extensions, one stroke per mouth (MAP_TREATMENT 2.5).
    ops.push({ kind: 'river-mouths', strokes: rivers.mouths.map(function (m) { return flatSamples(m.samples); }) });

    // Rail segments: ties for built rail, dots otherwise (MAP_TREATMENT 2.6).
    geom.railSegments.forEach(function (rs) {
      var path = [];
      for (var i = 0; i < rs.path.length; i++) {
        var pt = rs.path[i];
        path.push(pt.x, pt.y);
      }
      var built = rs.railState === 'built';
      ops.push({
        kind: 'rail', a: rs.a, b: rs.b, railState: rs.railState, path: path, dashed: !built,
        ties: built ? railTies(path) : [],
        dots: built ? [] : railDots(path)
      });
    });

    // Province borders (Cycle 23 Step 12a, MAP_TREATMENT 5.2): one dashed
    // line per chart edge that is not a river edge, since the river is the
    // border there. Without the chart module the geometry edge paths stand in.
    var riverPair = {};
    geom.riverSegments.forEach(function (rs) { riverPair[rs.a + '|' + rs.b] = true; });
    var borderEdges = chart ? chart.chartEdges : geom.edges;
    borderEdges.forEach(function (e) {
      if (riverPair[e.a + '|' + e.b] || riverPair[e.b + '|' + e.a]) return;
      ops.push({ kind: 'border', a: e.a, b: e.b, path: flatPoints(e.path) });
    });

    return ops;
  }

  // FNV-1a hash of a canonical string built from ops.
  function drawOpsHash(ops) {
    var parts = [];
    ops.forEach(function (op) {
      parts.push(op.kind);
      if (op.id !== undefined) parts.push(String(op.id));
      if (op.provinceId !== undefined) parts.push(String(op.provinceId));
      if (op.a !== undefined) parts.push(String(op.a));
      if (op.b !== undefined) parts.push(String(op.b));
      if (op.railState !== undefined) parts.push(String(op.railState));
      if (op.dashed !== undefined) parts.push(op.dashed ? '1' : '0');
      if (op.points) {
        for (var i = 0; i < op.points.length; i++) {
          parts.push(op.points[i].toFixed(4));
        }
      }
      if (op.path) {
        for (var j = 0; j < op.path.length; j++) {
          parts.push(op.path[j].toFixed(4));
        }
      }
      // River samples, mouth strokes, rail ties, and rail dots (Step 10).
      ['samples', 'ties', 'dots'].forEach(function (field) {
        if (!op[field]) return;
        parts.push(field);
        for (var k = 0; k < op[field].length; k++) parts.push(op[field][k].toFixed(4));
      });
      if (op.strokes) {
        op.strokes.forEach(function (st) {
          parts.push('stroke');
          for (var m = 0; m < st.length; m++) parts.push(st[m].toFixed(4));
        });
      }
    });
    var canonical = parts.join('|');
    var hash = fnv1a(canonical);
    return hash.toString(16).padStart(8, '0');
  }

  // Draw the whole river network in three passes: banks, water, glints
  // (MAP_TREATMENT 2.4). strokes: flat [x, y, w, ...] arrays in cell space.
  function drawRiverNetwork(ctx, strokes, scaleX, scaleY) {
    function eachPiece(fn) {
      strokes.forEach(function (st) {
        for (var i = 3; i < st.length; i += 3) {
          fn(st[i - 3], st[i - 2], st[i], st[i + 1], (st[i - 1] + st[i + 2]) / 2);
        }
      });
    }
    function piece(x1, y1, x2, y2, width) {
      ctx.beginPath();
      ctx.moveTo(x1 * scaleX, y1 * scaleY);
      ctx.lineTo(x2 * scaleX, y2 * scaleY);
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 1: banks.
    ctx.strokeStyle = CHART_RIVER_BANK;
    ctx.globalAlpha = 0.55;
    eachPiece(function (x1, y1, x2, y2, w) { piece(x1, y1, x2, y2, w * scaleX + 2); });

    // Pass 2: water.
    ctx.strokeStyle = CHART_RIVER_WATER;
    ctx.globalAlpha = 1;
    eachPiece(function (x1, y1, x2, y2, w) { piece(x1, y1, x2, y2, w * scaleX); });

    // Pass 3: glints, offset toward the lamp (upper left) along the normal.
    ctx.strokeStyle = CHART_RIVER_GLINT;
    ctx.globalAlpha = 0.35;
    eachPiece(function (x1, y1, x2, y2, w) {
      if (w < 0.06) return;
      var dx = x2 - x1;
      var dy = y2 - y1;
      var len = Math.hypot(dx, dy);
      if (len <= 0) return;
      var nx = -dy / len;
      var ny = dx / len;
      if (nx + ny > 0 || (nx + ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
      var ox = 0.15 * w * nx;
      var oy = 0.15 * w * ny;
      piece(x1 + ox, y1 + oy, x2 + ox, y2 + oy, 0.3 * w * scaleX);
    });
    ctx.restore();
  }

  // Execute draw operations on a canvas context.
  // scaleX, scaleY: device pixels per cell-space unit.
  function drawOps(ctx, ops, scaleX, scaleY) {
    // Lattice size from the polygon ops' cell positions (the sea fills the
    // neatline, one cell beyond the lattice on every side).
    var mapW = 0;
    var mapH = 0;
    ops.forEach(function (op) {
      if (op.kind !== 'polygon') return;
      if (op.x + 1 > mapW) mapW = op.x + 1;
      if (op.y + 1 > mapH) mapH = op.y + 1;
    });

    // Every river stroke (edges, then mouth extensions) for the three pass draw.
    var riverStrokes = [];
    var riversDrawn = false;
    ops.forEach(function (op) {
      if (op.kind === 'river' && op.samples) riverStrokes.push(op.samples);
      if (op.kind === 'river-mouths') riverStrokes = riverStrokes.concat(op.strokes);
    });

    ops.forEach(function (op) {
      switch (op.kind) {
        case 'sea':
          // Neatline rectangle in cell space (Cycle 23 Step 9).
          ctx.fillStyle = CHART_SEA_DEEP;
          ctx.fillRect(-1 * scaleX, -1 * scaleY, (mapW + 2) * scaleX, (mapH + 2) * scaleY);
          break;

        case 'polygon':
          ctx.beginPath();
          var pts = op.points;
          if (pts.length >= 2) {
            ctx.moveTo(pts[0] * scaleX, pts[1] * scaleY);
            for (var i = 2; i < pts.length; i += 2) {
              ctx.lineTo(pts[i] * scaleX, pts[i + 1] * scaleY);
            }
            ctx.closePath();
            ctx.fillStyle = CHART_LAND_LOW;
            ctx.fill();
            // No segment stroke: the dashed border ops draw the province
            // lines (Cycle 23 Step 12a).
          }
          break;

        case 'border':
          var bpath = op.path;
          if (bpath.length < 4) break;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(bpath[0] * scaleX, bpath[1] * scaleY);
          for (var i = 2; i < bpath.length; i += 2) {
            ctx.lineTo(bpath[i] * scaleX, bpath[i + 1] * scaleY);
          }
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = BORDER_ALPHA;
          ctx.lineWidth = BORDER_LINE_W * scaleX;
          ctx.lineCap = 'round';
          ctx.setLineDash([BORDER_DASH * scaleX, BORDER_GAP * scaleX]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.restore();
          break;

        case 'river':
        case 'river-mouths':
          // The first river op draws the whole network (Step 10).
          if (riversDrawn) break;
          riversDrawn = true;
          drawRiverNetwork(ctx, riverStrokes, scaleX, scaleY);
          break;

        case 'rail':
          var rapath = op.path;
          ctx.save();
          ctx.strokeStyle = CHART_INK;
          ctx.fillStyle = CHART_INK;
          ctx.lineWidth = RAIL_LINE_W * scaleX;
          if (op.railState === 'built') {
            if (rapath.length >= 4) {
              ctx.beginPath();
              ctx.moveTo(rapath[0] * scaleX, rapath[1] * scaleY);
              for (var i = 2; i < rapath.length; i += 2) {
                ctx.lineTo(rapath[i] * scaleX, rapath[i + 1] * scaleY);
              }
              ctx.globalAlpha = 0.8;
              ctx.stroke();
            }
            var ties = op.ties || [];
            if (ties.length) {
              ctx.beginPath();
              for (var ti = 0; ti < ties.length; ti += 4) {
                ctx.moveTo(ties[ti] * scaleX, ties[ti + 1] * scaleY);
                ctx.lineTo(ties[ti + 2] * scaleX, ties[ti + 3] * scaleY);
              }
              ctx.globalAlpha = 0.6;
              ctx.stroke();
            }
          } else {
            var dots = op.dots || [];
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            for (var di = 0; di < dots.length; di += 2) {
              ctx.moveTo((dots[di] + RAIL_DOT_R) * scaleX, dots[di + 1] * scaleY);
              ctx.arc(dots[di] * scaleX, dots[di + 1] * scaleY, RAIL_DOT_R * scaleX, 0, 2 * Math.PI);
            }
            ctx.fill();
          }
          ctx.restore();
          break;
      }
    });
  }

  // Flat closed coastline path [x0, y0, x1, y1, ...] in cell space.
  function coastFlat(chart) {
    var flat = [];
    chart.coastline.forEach(function (q) { flat.push(q.x, q.y); });
    return flat;
  }

  // Chart ops (Cycle 23 Step 9, MAP_TREATMENT 1.6 and 1.7). Plain data in
  // cell space: 'under' draws beneath the province ops, 'over' above them.
  function buildChartOps(chart) {
    var coast = coastFlat(chart);
    var under = [];
    var ext = chart.extent;
    var neat = chart.neatline;
    under.push({ kind: 'chart-paper', rect: [ext.x0, ext.y0, ext.x1 - ext.x0, ext.y1 - ext.y0] });
    under.push({ kind: 'chart-sea', rect: [neat.x0, neat.y0, neat.x1 - neat.x0, neat.y1 - neat.y0] });
    function band(w, style) {
      under.push({ kind: 'chart-stroke', path: coast, widthCells: w, style: style, alpha: 1, plusPx: 0 });
    }
    function waterLine(w, restoreStyle) {
      under.push({ kind: 'chart-stroke', path: coast, widthCells: w, style: CHART_INK, alpha: 0.16, plusPx: 1 });
      under.push({ kind: 'chart-stroke', path: coast, widthCells: w, style: restoreStyle, alpha: 1, plusPx: -1 });
    }
    band(0.72, CHART_SEA_MID);
    waterLine(0.52, CHART_SEA_MID);
    band(0.44, CHART_SEA_SHELF);
    waterLine(0.30, CHART_SEA_SHELF);
    band(0.22, CHART_SEA_SHORE);
    waterLine(0.14, CHART_SEA_SHORE);
    chart.waves.forEach(function (wv) {
      under.push({ kind: 'chart-wave', x: wv.x, y: wv.y });
    });
    // Estuary fans in the sea, before the land (MAP_TREATMENT 2.5).
    chart.rivers.fans.forEach(function (f) {
      under.push({ kind: 'chart-estuary-fan', cx: f.cx, cy: f.cy, rx: f.rx, ry: f.ry, angle: f.angle });
    });
    under.push({ kind: 'chart-land', path: coast });

    var over = [];
    over.push({ kind: 'chart-beach', path: coast });
    over.push({ kind: 'chart-coastline', path: coast });
    var inland = [];
    chart.boundarySegments.forEach(function (seg) {
      if (seg.sea) return;
      inland.push([seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y]);
    });
    over.push({ kind: 'chart-edge-of-war', segments: inland });
    return { under: under, over: over, furniture: buildChartFurniture(chart) };
  }

  // Chart furniture (Cycle 23 Step 13, MAP_TREATMENT 4.3 and 4.4): the degree
  // bar outside the neatline, the neatline and outer frame, the scale bar,
  // and the north arrow. Drawn last on the base canvas.
  function buildChartFurniture(chart) {
    var ext = chart.extent;
    var neat = chart.neatline;
    var w = DEGREE_BAR_W;
    var degX = 1 / 2.8;
    var degY = 0.5;
    var out = [];

    // One side of the degree bar, clockwise from its starting corner, Ink
    // first, one degree per segment, the last clipped at the far corner.
    // rectAt(a, b) turns the run [a, b] along the side into a rect.
    function side(start, end, step, rectAt) {
      var dir = end > start ? 1 : -1;
      var total = Math.abs(end - start);
      for (var i = 0, d = 0; d < total - 1e-9; i++, d += step) {
        var a = start + dir * d;
        var b = start + dir * Math.min(d + step, total);
        out.push({ kind: 'chart-degree-bar', rect: rectAt(Math.min(a, b), Math.max(a, b)), style: i % 2 === 0 ? 'ink' : 'paper' });
      }
    }
    side(neat.x0, neat.x1, degX, function (a, b) { return [a, neat.y0 - w, b - a, w]; });
    side(neat.y0, neat.y1, degY, function (a, b) { return [neat.x1, a, w, b - a]; });
    side(neat.x1, neat.x0, degX, function (a, b) { return [a, neat.y1, b - a, w]; });
    side(neat.y1, neat.y0, degY, function (a, b) { return [neat.x0 - w, a, w, b - a]; });

    out.push({ kind: 'chart-frame', rect: [neat.x0, neat.y0, neat.x1 - neat.x0, neat.y1 - neat.y0], widthCells: NEATLINE_W });
    out.push({ kind: 'chart-frame', rect: [ext.x0, ext.y0, ext.x1 - ext.x0, ext.y1 - ext.y0], widthCells: OUTER_FRAME_W });

    // Scale bar parts between the marks at 0, 50, 100, and 200 km (the last
    // part twice as long), alternating Ink and Paper from the left.
    var mk = SCALE_BAR.marks;
    for (var k = 1; k < mk.length; k++) {
      out.push({ kind: 'chart-scale-bar', rect: [SCALE_BAR.x + mk[k - 1], SCALE_BAR.y, mk[k] - mk[k - 1], SCALE_BAR.height], style: k % 2 === 1 ? 'ink' : 'paper' });
    }
    out.push({ kind: 'chart-north-arrow', cx: NORTH_ARROW.cx, tipY: NORTH_ARROW.tipY, baseY: NORTH_ARROW.baseY, halfWidth: NORTH_ARROW.halfWidth });
    return out;
  }

  // Execute chart furniture ops on a context already translated to the cell
  // space origin.
  function drawChartFurniture(ctx, ops, scaleX, scaleY) {
    function rectPx(r) { return [r[0] * scaleX, r[1] * scaleY, r[2] * scaleX, r[3] * scaleY]; }
    ops.forEach(function (op) {
      var r;
      switch (op.kind) {
        case 'chart-degree-bar':
        case 'chart-scale-bar':
          r = rectPx(op.rect);
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = op.style === 'ink' ? CHART_INK : CHART_FRAME_PAPER;
          ctx.fillRect(r[0], r[1], r[2], r[3]);
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = op.kind === 'chart-degree-bar' ? 0.5 : 1;
          ctx.lineWidth = 1;
          ctx.strokeRect(r[0], r[1], r[2], r[3]);
          ctx.restore();
          break;

        case 'chart-frame':
          r = rectPx(op.rect);
          ctx.save();
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = 1;
          ctx.lineWidth = op.widthCells * scaleX;
          ctx.strokeRect(r[0], r[1], r[2], r[3]);
          ctx.restore();
          break;

        case 'chart-north-arrow':
          var cx = op.cx * scaleX;
          var tip = op.tipY * scaleY;
          var base = op.baseY * scaleY;
          var hw = op.halfWidth * scaleX;
          ctx.save();
          ctx.lineJoin = 'miter';
          ctx.lineWidth = 1;
          ctx.strokeStyle = CHART_INK;
          // Right half: Paper with an Ink outline.
          ctx.beginPath();
          ctx.moveTo(cx, tip);
          ctx.lineTo(cx + hw, base);
          ctx.lineTo(cx, base);
          ctx.closePath();
          ctx.fillStyle = CHART_FRAME_PAPER;
          ctx.fill();
          ctx.stroke();
          // Left half: Ink.
          ctx.beginPath();
          ctx.moveTo(cx, tip);
          ctx.lineTo(cx - hw, base);
          ctx.lineTo(cx, base);
          ctx.closePath();
          ctx.fillStyle = CHART_INK;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          break;
      }
    });
  }

  function traceClosed(ctx, path, scaleX, scaleY) {
    ctx.beginPath();
    ctx.moveTo(path[0] * scaleX, path[1] * scaleY);
    for (var i = 2; i < path.length; i += 2) {
      ctx.lineTo(path[i] * scaleX, path[i + 1] * scaleY);
    }
    ctx.closePath();
  }

  // Execute chart ops (either list) on a context already translated to the
  // cell space origin.
  function drawChartOps(ctx, ops, scaleX, scaleY) {
    ops.forEach(function (op) {
      switch (op.kind) {
        case 'chart-paper':
          ctx.fillStyle = CHART_FRAME_PAPER;
          ctx.fillRect(op.rect[0] * scaleX, op.rect[1] * scaleY, op.rect[2] * scaleX, op.rect[3] * scaleY);
          break;

        case 'chart-sea':
          ctx.fillStyle = CHART_SEA_DEEP;
          ctx.fillRect(op.rect[0] * scaleX, op.rect[1] * scaleY, op.rect[2] * scaleX, op.rect[3] * scaleY);
          break;

        case 'chart-stroke':
          ctx.save();
          traceClosed(ctx, op.path, scaleX, scaleY);
          ctx.lineJoin = 'round';
          ctx.strokeStyle = op.style;
          ctx.globalAlpha = op.alpha;
          ctx.lineWidth = Math.max(1, op.widthCells * scaleX + op.plusPx);
          ctx.stroke();
          ctx.restore();
          break;

        case 'chart-wave':
          var half = 0.05;
          var amp = 0.012;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo((op.x - half) * scaleX, op.y * scaleY);
          ctx.quadraticCurveTo((op.x - half / 2) * scaleX, (op.y - 2 * amp) * scaleY, op.x * scaleX, op.y * scaleY);
          ctx.quadraticCurveTo((op.x + half / 2) * scaleX, (op.y - 2 * amp) * scaleY, (op.x + half) * scaleX, op.y * scaleY);
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = 0.10;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          break;

        case 'chart-estuary-fan':
          // Scale into cell space first, then rotate, so rx lies along the
          // ray and ry across it in cell units.
          ctx.save();
          ctx.translate(op.cx * scaleX, op.cy * scaleY);
          ctx.scale(scaleX, scaleY);
          ctx.rotate(op.angle);
          ctx.beginPath();
          ctx.ellipse(0, 0, op.rx, op.ry, 0, 0, 2 * Math.PI);
          ctx.fillStyle = CHART_SEA_SHORE;
          ctx.globalAlpha = 0.6;
          ctx.fill();
          ctx.restore();
          break;

        case 'chart-land':
          traceClosed(ctx, op.path, scaleX, scaleY);
          ctx.fillStyle = CHART_LAND_LOW;
          ctx.fill();
          break;

        case 'chart-beach':
          ctx.save();
          traceClosed(ctx, op.path, scaleX, scaleY);
          ctx.clip();
          traceClosed(ctx, op.path, scaleX, scaleY);
          ctx.lineJoin = 'round';
          ctx.strokeStyle = CHART_BEACH;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 0.10 * scaleX;
          ctx.stroke();
          ctx.restore();
          break;

        case 'chart-coastline':
          ctx.save();
          traceClosed(ctx, op.path, scaleX, scaleY);
          ctx.lineJoin = 'round';
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 0.010 * scaleX;
          ctx.stroke();
          ctx.restore();
          break;

        case 'chart-edge-of-war':
          ctx.save();
          ctx.beginPath();
          op.segments.forEach(function (sg) {
            ctx.moveTo(sg[0] * scaleX, sg[1] * scaleY);
            ctx.lineTo(sg[2] * scaleX, sg[3] * scaleY);
          });
          ctx.strokeStyle = CHART_INK;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 0.008 * scaleX;
          ctx.setLineDash([0.06 * scaleX, 0.025 * scaleX, 0.008 * scaleX, 0.025 * scaleX]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          break;
      }
    });
  }

  // FNV-1a hash of the coastline coordinates, toFixed(4).
  function coastlineHash(chart) {
    var parts = [];
    chart.coastline.forEach(function (q) { parts.push(q.x.toFixed(4), q.y.toFixed(4)); });
    return fnv1a(parts.join('|')).toString(16).padStart(8, '0');
  }

  // Shared chart transform (Step 9): device px per cell over the whole chart
  // extent, origin translated to lattice (0, 0).
  function chartTransform(canvas, chart) {
    var scaleX = canvas.width / chart.widthCells;
    var scaleY = canvas.height / chart.heightCells;
    return { scaleX: scaleX, scaleY: scaleY, tx: chart.insetX * scaleX, ty: chart.insetTop * scaleY };
  }

  // Relief raster canvas (Cycle 23 Step 11), cached per relief object: the
  // relief is computed once per geometry, so a rebake at a new canvas size
  // reuses the same small raster.
  var reliefRasterCache = null;
  function reliefRaster(relief) {
    if (reliefRasterCache && reliefRasterCache.relief === relief) return reliefRasterCache.canvas;
    var rc = document.createElement('canvas');
    rc.width = relief.width;
    rc.height = relief.height;
    var rctx = rc.getContext('2d');
    var img = rctx.createImageData(relief.width, relief.height);
    img.data.set(relief.rgba);
    rctx.putImageData(img, 0, 0);
    reliefRasterCache = { relief: relief, canvas: rc };
    return rc;
  }

  // Relief on the base canvas (MAP_TREATMENT 3.2 to 3.5): the baked
  // hillshade raster scaled to the neatline and clipped to the land path,
  // then the contour polylines. Contour width is 1 device px, or 2 when
  // scaleX is at least 240 device px per cell (DPR 2 at zoom 1 gives about
  // 320, DPR 1 gives about 160, so 240 splits the two).
  function drawRelief(ctx, chart, scaleX, scaleY) {
    var relief = chart.relief;
    if (!relief) return;
    var neat = chart.neatline;
    ctx.save();
    traceClosed(ctx, coastFlat(chart), scaleX, scaleY);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(reliefRaster(relief), neat.x0 * scaleX, neat.y0 * scaleY,
      (neat.x1 - neat.x0) * scaleX, (neat.y1 - neat.y0) * scaleY);
    ctx.restore();

    // TX-LAND (Step 19a) draws here, above the relief raster and below the
    // contours. The relief raster is opaque over all land, so any position
    // under it is invisible (measured at 19a with the texture before
    // drawRelief: 5254 of 673460 F02 base pixels changed, 0.8 percent).
    // drawLandTexture applies its own clip to the same coastline path the
    // raster block above uses, so it is called after that block's restore
    // rather than inside it, to keep one clip rather than two.
    drawLandTexture(ctx, chart, scaleX, scaleY);

    // RX01 (Step 19d-1) draws here: after drawLandTexture and before the
    // contours, so the micro relief shades the textured ground and the
    // contour lines stay crisp above it.
    drawRxLand(ctx, chart, scaleX, scaleY);

    ctx.save();
    ctx.strokeStyle = CHART_CONTOUR;
    ctx.globalAlpha = 0.22;
    ctx.lineJoin = 'round';
    ctx.lineWidth = scaleX >= 240 ? 2 : 1;
    ctx.beginPath();
    relief.contours.forEach(function (c) {
      var pts = c.points;
      ctx.moveTo(pts[0] * scaleX, pts[1] * scaleY);
      for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * scaleX, pts[i + 1] * scaleY);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Corner vignette (Cycle 23 Step 17a, K-ATM, VISUAL_STRATEGY 5.2 and 7.5).
  // Ink at most 0.045 alpha: 0.045 * (FRAME_PAPER luma 216.5 - INK luma
  // 38.6) = 8.0, so the vignette lowers a pixel by at most 8 luma levels, and
  // only at the exact extent corners. It darkens only, so nothing below 225
  // can rise to it. Province interiors are masked out by construction.
  var VIGNETTE_MAX_ALPHA = 0.045;
  var VIGNETTE_RANGE = 1.6;
  var VIGNETTE_RES = 8;

  // Pure vignette raster over the chart extent, node safe. A pixel inside
  // any hit polygon is transparent; elsewhere (border strip, sea margin,
  // beyond-land margin) alpha falls off from each extent edge over
  // VIGNETTE_RANGE cells, as the product of the two edge factors.
  function buildVignetteRaster(chart) {
    var ext = chart.extent;
    var extW = ext.x1 - ext.x0;
    var extH = ext.y1 - ext.y0;
    var width = Math.round(extW * VIGNETTE_RES);
    var height = Math.round(extH * VIGNETTE_RES);
    var rgba = new Uint8ClampedArray(width * height * 4);
    var ids = (chart.provinceOrder || Object.keys(chart.hitPolygons)).filter(function (id) {
      return chart.hitPolygons[id];
    });
    var polys = ids.map(function (id) {
      var flat = flatPoints(chart.hitPolygons[id]);
      var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (var i = 0; i < flat.length; i += 2) {
        if (flat[i] < bx0) bx0 = flat[i];
        if (flat[i] > bx1) bx1 = flat[i];
        if (flat[i + 1] < by0) by0 = flat[i + 1];
        if (flat[i + 1] > by1) by1 = flat[i + 1];
      }
      return { flat: flat, x0: bx0, y0: by0, x1: bx1, y1: by1 };
    });
    function inAnyProvince(x, y) {
      for (var k = 0; k < polys.length; k++) {
        var p = polys[k];
        if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) continue;
        if (pointInFlat(x, y, p.flat)) return true;
      }
      return false;
    }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    var maxAlpha = 0;
    for (var py = 0; py < height; py++) {
      var y = ext.y0 + (py + 0.5) * extH / height;
      var dy = Math.min(y - ext.y0, ext.y1 - y);
      var sy = clamp01(1 - dy / VIGNETTE_RANGE);
      for (var px = 0; px < width; px++) {
        var o = (py * width + px) * 4;
        rgba[o] = 43;
        rgba[o + 1] = 38;
        rgba[o + 2] = 32;
        if (sy === 0) continue;
        var x = ext.x0 + (px + 0.5) * extW / width;
        var dx = Math.min(x - ext.x0, ext.x1 - x);
        var sx = clamp01(1 - dx / VIGNETTE_RANGE);
        if (sx === 0) continue;
        if (inAnyProvince(x, y)) continue;
        var a = VIGNETTE_MAX_ALPHA * sx * sy;
        if (a > maxAlpha) maxAlpha = a;
        rgba[o + 3] = Math.round(a * 255);
      }
    }
    return { width: width, height: height, rgba: rgba, maxAlpha: maxAlpha };
  }

  // Vignette raster canvas, cached per chart object (mirrors reliefRaster).
  var vignetteRasterCache = null;
  function vignetteRasterCanvas(chart) {
    if (vignetteRasterCache && vignetteRasterCache.chart === chart) return vignetteRasterCache.canvas;
    var v = buildVignetteRaster(chart);
    var vc = document.createElement('canvas');
    vc.width = v.width;
    vc.height = v.height;
    var vctx = vc.getContext('2d');
    var img = vctx.createImageData(v.width, v.height);
    img.data.set(v.rgba);
    vctx.putImageData(img, 0, 0);
    vignetteRasterCache = { chart: chart, canvas: vc };
    return vc;
  }

  // Vignette on the base canvas, scaled over the full chart extent. Drawn
  // after the chart over ops and before the furniture, so degree labels,
  // the scale bar, and the north arrow stay crisp on top.
  function drawVignette(ctx, chart, scaleX, scaleY) {
    var ext = chart.extent;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(vignetteRasterCanvas(chart), ext.x0 * scaleX, ext.y0 * scaleY,
      (ext.x1 - ext.x0) * scaleX, (ext.y1 - ext.y0) * scaleY);
    ctx.restore();
  }

  // TX-LAND land texture (Cycle 23 Step 19a, MAP_TREATMENT 7.3 and 6.5): the
  // Step 18c-2 bake-off winner (Candidate B) as a pattern over the land path,
  // soft-light at alpha 0.35. TX_LAND_VALUE_SCALE compresses the texture
  // around mid gray (128) before it becomes a pattern; 1 is the image as
  // baked. The pattern source is built once at load time. 0.25 is the
  // measured value at which the wired board (texture above the relief
  // raster, below the contours) passes the band report: scale 1 gives
  // fixture separation 23.0, 0.5 gives 24.9, 0.25 gives 25.9 against the
  // 25 gate.
  var TX_LAND_ALPHA = 0.35;
  var TX_LAND_SIZE = 1024;
  var TX_LAND_VALUE_SCALE = 0.25;

  // TX-SEA sea texture (Cycle 23 Step 19b, MAP_TREATMENT 7.3): the Blender
  // route bake (tools/bake-tx-sea.py) as a pattern over the sea only,
  // soft-light at alpha 0.30. TX_SEA_VALUE_SCALE compresses the texture
  // around mid gray (128) before it becomes a pattern, as TX_LAND_VALUE_SCALE
  // does; 1 is the image as baked.
  var TX_SEA_ALPHA = 0.30;
  var TX_SEA_SIZE = 1024;
  var TX_SEA_VALUE_SCALE = 1;

  // TX-PAPER border paper (Cycle 23 Step 19b, MAP_TREATMENT 7.3): the Blender
  // route bake (tools/bake-tx-paper.py) as an opaque fill of the border
  // strip. It is a fill, not an overlay, so it has no alpha or value scale.
  var TX_PAPER_SIZE = 1024;

  // TX-FOG textures (Cycle 23 Step 19c, MAP_TREATMENT 6.5 and 7.3): Blender
  // route bakes (tools/bake-tx-foguk.py, tools/bake-tx-fogls.py) used as
  // pattern fills in drawFogOps. TX-FOG-UK replaces the flat Unknown fill
  // (alpha 1); TX-FOG-LS replaces the flat last seen wash and keeps
  // FOG_REMEMBERED_ALPHA. Both are fills used as baked, so they have no value
  // scale. The LS texture is grain only: the fine ink hatching of the last
  // seen surface is already the code hatch in drawFogOps (Ink at alpha 0.30,
  // pinned by tests), so baking hatching in would double it.
  var TX_FOG_UK_SIZE = 1024;
  var TX_FOG_LS_SIZE = 1024;

  // RX01 / RX02 micro relief shade tile (Cycle 23 Step 19d-1, MAP_TREATMENT
  // 7.5): one Blender route bake (tools/bake-rx.py, KEY light from the upper
  // left on a periodic displaced plane, normalised to mean luma 128, sd 10 or
  // less) shared by both. RX01 is a soft-light pattern over land at alpha
  // RX_ALPHA_LAND times ruggedness r(P), drawn in RX_STEPS quantised alpha
  // steps clipped to precomputed ruggedness zones (rxLandAlpha, buildRxZones).
  // RX02 is the same tile as a soft-light pattern over beyond land (the area
  // TX-SEA clips to) at RX_ALPHA_BEYOND flat. RX_VALUE_SCALE compresses the
  // tile around mid gray (128) before it becomes a pattern, as
  // TX_LAND_VALUE_SCALE does; 1 is the image as baked. Value scale ladder
  // (try 1, then 0.5, then 0.25; ship the first rung that passes), measured
  // with tools/band-report.js on the wired board, fixture remembered minus
  // live separation against the 25 gate (Step 19c board without RX: 25.9):
  // scale 1 gives 25.9 (pass, exit 0, 0 failures of 197; fixture live 118.4,
  // remembered 144.3, dark 203.4). The ladder stopped at its first rung, so
  // 0.5 and 0.25 were not measured. Shipped at 1.
  var RX_ALPHA_LAND = 0.5;
  var RX_ALPHA_BEYOND = 0.3;
  var RX_SIZE = 1024;
  var RX_STEPS = 8;
  // Ruggedness range from js/map-chart.js buildRuggedness (r = 0.25 + 0.75 u).
  var RX_RUG_MIN = 0.25;
  var RX_RUG_MAX = 1.0;
  var RX_VALUE_SCALE = 1;

  // Quantised RX01 alpha for one ruggedness value, pure and node safe.
  // Bucket rule: the ruggedness range RX_RUG_MIN to RX_RUG_MAX is cut into
  // RX_STEPS equal buckets, k = floor((r - RX_RUG_MIN) / width), clamped to 0
  // to RX_STEPS - 1 (r at or below the minimum, or not a number, is bucket 0;
  // r at or above the maximum is the top bucket). The bucket representative
  // is the bucket midpoint, RX_RUG_MIN + (k + 0.5) * width, and the alpha is
  // RX_ALPHA_LAND times that representative, so the 8 steps run from 0.5 *
  // 0.296875 to 0.5 * 0.953125 and never exceed 0.5.
  function rxBucket(r) {
    var width = (RX_RUG_MAX - RX_RUG_MIN) / RX_STEPS;
    var k = Math.floor((r - RX_RUG_MIN) / width);
    if (!(k >= 0)) k = 0;
    if (k > RX_STEPS - 1) k = RX_STEPS - 1;
    return k;
  }
  function rxLandAlpha(r) {
    var width = (RX_RUG_MAX - RX_RUG_MIN) / RX_STEPS;
    return RX_ALPHA_LAND * (RX_RUG_MIN + (rxBucket(r) + 0.5) * width);
  }

  // Ruggedness zones, pure and node safe: the province hit polygons
  // (chart.hitPolygons) grouped by rxBucket of chart.relief.ruggedness, in
  // ascending bucket order, empty buckets dropped. Each zone is
  // { bucket, alpha, polys } with polys as flat cell space paths.
  function buildRxZones(chart) {
    var rug = (chart.relief && chart.relief.ruggedness) || {};
    var ids = chart.provinceOrder || Object.keys(chart.hitPolygons);
    var byBucket = [];
    ids.forEach(function (id) {
      var poly = chart.hitPolygons[id];
      if (!poly || typeof rug[id] !== 'number') return;
      var k = rxBucket(rug[id]);
      if (!byBucket[k]) byBucket[k] = { bucket: k, alpha: rxLandAlpha(rug[id]), polys: [] };
      byBucket[k].polys.push(flatPoints(poly));
    });
    return byBucket.filter(function (z) { return !!z; });
  }

  // Zones cached per chart object (mirrors reliefRasterCache), so the frame
  // path never regroups provinces.
  var rxZoneCache = null;
  function rxZones(chart) {
    if (rxZoneCache && rxZoneCache.chart === chart) return rxZoneCache.zones;
    var zones = buildRxZones(chart);
    rxZoneCache = { chart: chart, zones: zones };
    return zones;
  }

  // Shared texture debug object (exported as textureDebug and as the global
  // AshesTextureDebug). The land field names predate Step 19b and keep their
  // meaning; tools/band-report.js reads them.
  var txLandDebug = {
    landState: 'unavailable',
    landAlpha: TX_LAND_ALPHA,
    landSize: TX_LAND_SIZE,
    landValueScale: TX_LAND_VALUE_SCALE,
    seaState: 'unavailable',
    seaAlpha: TX_SEA_ALPHA,
    seaSize: TX_SEA_SIZE,
    seaValueScale: TX_SEA_VALUE_SCALE,
    paperState: 'unavailable',
    paperSize: TX_PAPER_SIZE,
    fogUkState: 'unavailable',
    fogUkSize: TX_FOG_UK_SIZE,
    fogLsState: 'unavailable',
    fogLsSize: TX_FOG_LS_SIZE,
    rxState: 'unavailable',
    rxSize: RX_SIZE,
    rxAlphaLand: RX_ALPHA_LAND,
    rxAlphaBeyond: RX_ALPHA_BEYOND,
    rxValueScale: RX_VALUE_SCALE
  };
  var txLandSource = null;

  // Browser-only loader, started lazily by the first renderBaseCanvas call.
  // Never throws into rendering: a decode or canvas failure records 'error'.
  function startLandTexture() {
    if (txLandDebug.landState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesTxLandData) return;
    txLandDebug.landState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = TX_LAND_SIZE;
          sc.height = TX_LAND_SIZE;
          var sctx = sc.getContext('2d');
          // Value remap out = 128 + (in - 128) * TX_LAND_VALUE_SCALE, done as
          // source-over of the image at alpha TX_LAND_VALUE_SCALE on mid gray
          // (k * in + (1 - k) * 128 is the same line), because game code
          // never reads pixels back (the source lint bans that call here).
          if (TX_LAND_VALUE_SCALE !== 1) {
            sctx.fillStyle = 'rgb(128, 128, 128)';
            sctx.fillRect(0, 0, TX_LAND_SIZE, TX_LAND_SIZE);
            sctx.globalAlpha = TX_LAND_VALUE_SCALE;
          }
          sctx.drawImage(img, 0, 0, TX_LAND_SIZE, TX_LAND_SIZE);
          sctx.globalAlpha = 1;
          txLandSource = sc;
          txLandDebug.landState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-land-texture-ready'));
          }
        } catch (e) {
          txLandSource = null;
          txLandDebug.landState = 'error';
        }
      };
      img.onerror = function () {
        txLandSource = null;
        txLandDebug.landState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesTxLandData;
    } catch (e) {
      txLandDebug.landState = 'error';
    }
  }

  // Draw the TX-LAND pattern clipped to the coastline path, over the chart
  // extent rect (the chart-paper rect). Returns false, drawing nothing, until
  // the pattern source is ready. The context here is translated only (cell
  // coordinates are multiplied by scaleX and scaleY by hand), so the pattern
  // space is already device px and one tile is 1024 device px, matching the
  // 18c-2 harness application; a scale(1 / scaleX, 1 / scaleY) pattern
  // transform would shrink the tile to a few device px, so none is set.
  function drawLandTexture(ctx, chart, scaleX, scaleY) {
    if (!txLandSource) return false;
    var ext = chart.extent;
    ctx.save();
    traceClosed(ctx, coastFlat(chart), scaleX, scaleY);
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = TX_LAND_ALPHA;
    ctx.fillStyle = ctx.createPattern(txLandSource, 'repeat');
    ctx.fillRect(ext.x0 * scaleX, ext.y0 * scaleY, (ext.x1 - ext.x0) * scaleX, (ext.y1 - ext.y0) * scaleY);
    ctx.restore();
    return true;
  }

  var txSeaSource = null;
  var txPaperSource = null;

  // Browser-only loader for TX-SEA, started lazily by the first
  // renderBaseCanvas call. Never throws into rendering: a decode or canvas
  // failure records 'error'.
  function startSeaTexture() {
    if (txLandDebug.seaState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesTxSeaData) return;
    txLandDebug.seaState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = TX_SEA_SIZE;
          sc.height = TX_SEA_SIZE;
          var sctx = sc.getContext('2d');
          // Value remap out = 128 + (in - 128) * TX_SEA_VALUE_SCALE, the same
          // mid gray trick as TX-LAND: source-over of the image at alpha
          // TX_SEA_VALUE_SCALE on mid gray (k * in + (1 - k) * 128 is the
          // same line), because game code never reads pixels back.
          if (TX_SEA_VALUE_SCALE !== 1) {
            sctx.fillStyle = 'rgb(128, 128, 128)';
            sctx.fillRect(0, 0, TX_SEA_SIZE, TX_SEA_SIZE);
            sctx.globalAlpha = TX_SEA_VALUE_SCALE;
          }
          sctx.drawImage(img, 0, 0, TX_SEA_SIZE, TX_SEA_SIZE);
          sctx.globalAlpha = 1;
          txSeaSource = sc;
          txLandDebug.seaState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-sea-texture-ready'));
          }
        } catch (e) {
          txSeaSource = null;
          txLandDebug.seaState = 'error';
        }
      };
      img.onerror = function () {
        txSeaSource = null;
        txLandDebug.seaState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesTxSeaData;
    } catch (e) {
      txLandDebug.seaState = 'error';
    }
  }

  // Browser-only loader for TX-PAPER, started lazily by the first
  // renderBaseCanvas call. Never throws into rendering. No value remap: the
  // paper is a fill and is used as baked.
  function startPaperTexture() {
    if (txLandDebug.paperState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesTxPaperData) return;
    txLandDebug.paperState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = TX_PAPER_SIZE;
          sc.height = TX_PAPER_SIZE;
          sc.getContext('2d').drawImage(img, 0, 0, TX_PAPER_SIZE, TX_PAPER_SIZE);
          txPaperSource = sc;
          txLandDebug.paperState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-paper-texture-ready'));
          }
        } catch (e) {
          txPaperSource = null;
          txLandDebug.paperState = 'error';
        }
      };
      img.onerror = function () {
        txPaperSource = null;
        txLandDebug.paperState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesTxPaperData;
    } catch (e) {
      txLandDebug.paperState = 'error';
    }
  }

  var txFogUkSource = null;
  var txFogLsSource = null;

  // Browser-only loader for TX-FOG-UK, started lazily by the first
  // renderFogCanvas call. Never throws into rendering. No value remap: the
  // Unknown paper is a fill and is used as baked.
  function startFogUkTexture() {
    if (txLandDebug.fogUkState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesTxFogUkData) return;
    txLandDebug.fogUkState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = TX_FOG_UK_SIZE;
          sc.height = TX_FOG_UK_SIZE;
          sc.getContext('2d').drawImage(img, 0, 0, TX_FOG_UK_SIZE, TX_FOG_UK_SIZE);
          txFogUkSource = sc;
          txLandDebug.fogUkState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-foguk-texture-ready'));
          }
        } catch (e) {
          txFogUkSource = null;
          txLandDebug.fogUkState = 'error';
        }
      };
      img.onerror = function () {
        txFogUkSource = null;
        txLandDebug.fogUkState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesTxFogUkData;
    } catch (e) {
      txLandDebug.fogUkState = 'error';
    }
  }

  // Browser-only loader for TX-FOG-LS, started lazily by the first
  // renderFogCanvas call. Never throws into rendering. No value remap: the
  // last seen wash is a fill and is used as baked.
  function startFogLsTexture() {
    if (txLandDebug.fogLsState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesTxFogLsData) return;
    txLandDebug.fogLsState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = TX_FOG_LS_SIZE;
          sc.height = TX_FOG_LS_SIZE;
          sc.getContext('2d').drawImage(img, 0, 0, TX_FOG_LS_SIZE, TX_FOG_LS_SIZE);
          txFogLsSource = sc;
          txLandDebug.fogLsState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-fogls-texture-ready'));
          }
        } catch (e) {
          txFogLsSource = null;
          txLandDebug.fogLsState = 'error';
        }
      };
      img.onerror = function () {
        txFogLsSource = null;
        txLandDebug.fogLsState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesTxFogLsData;
    } catch (e) {
      txLandDebug.fogLsState = 'error';
    }
  }

  // Draw the TX-SEA pattern clipped to the sea only: one path of the
  // neatline rect plus the coastline, clipped with the evenodd rule, so the
  // land inside the coast is excluded. Returns false, drawing nothing, until
  // the pattern source is ready. As with TX-LAND, the context is translated
  // only, so pattern space is device px and one tile is 1024 device px; no
  // pattern transform is set.
  function drawSeaTexture(ctx, chart, scaleX, scaleY) {
    if (!txSeaSource) return false;
    var neat = chart.neatline;
    var x0 = neat.x0 * scaleX;
    var y0 = neat.y0 * scaleY;
    var w = (neat.x1 - neat.x0) * scaleX;
    var h = (neat.y1 - neat.y0) * scaleY;
    ctx.save();
    traceClosed(ctx, coastFlat(chart), scaleX, scaleY);
    ctx.rect(x0, y0, w, h);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = TX_SEA_ALPHA;
    ctx.fillStyle = ctx.createPattern(txSeaSource, 'repeat');
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
    return true;
  }

  var rxSource = null;

  // Browser-only loader for the RX tile, started lazily by the first
  // renderBaseCanvas call. Never throws into rendering: a decode or canvas
  // failure records 'error'.
  function startRxTexture() {
    if (txLandDebug.rxState !== 'unavailable') return;
    if (typeof document === 'undefined' || typeof Image === 'undefined' || !AshesRxData) return;
    txLandDebug.rxState = 'loading';
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var sc = document.createElement('canvas');
          sc.width = RX_SIZE;
          sc.height = RX_SIZE;
          var sctx = sc.getContext('2d');
          // Value remap out = 128 + (in - 128) * RX_VALUE_SCALE, the same mid
          // gray trick as TX-LAND: source-over of the image at alpha
          // RX_VALUE_SCALE on mid gray (k * in + (1 - k) * 128 is the same
          // line), because game code never reads pixels back.
          if (RX_VALUE_SCALE !== 1) {
            sctx.fillStyle = 'rgb(128, 128, 128)';
            sctx.fillRect(0, 0, RX_SIZE, RX_SIZE);
            sctx.globalAlpha = RX_VALUE_SCALE;
          }
          sctx.drawImage(img, 0, 0, RX_SIZE, RX_SIZE);
          sctx.globalAlpha = 1;
          rxSource = sc;
          txLandDebug.rxState = 'ready';
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('ashes-rx-texture-ready'));
          }
        } catch (e) {
          rxSource = null;
          txLandDebug.rxState = 'error';
        }
      };
      img.onerror = function () {
        rxSource = null;
        txLandDebug.rxState = 'error';
      };
      img.src = 'data:image/webp;base64,' + AshesRxData;
    } catch (e) {
      txLandDebug.rxState = 'error';
    }
  }

  // Draw RX01 over land: clipped to the coastline path, then one soft-light
  // pattern fill per ruggedness zone, each clipped to the union of its
  // province hit polygons at that zone's quantised alpha (at most RX_STEPS
  // fills). Returns false, drawing nothing, until the pattern source is
  // ready. Pattern space is device px, one tile 1024 device px, no pattern
  // transform (same reasoning as TX-LAND).
  function drawRxLand(ctx, chart, scaleX, scaleY) {
    if (!rxSource) return false;
    var neat = chart.neatline;
    var x0 = neat.x0 * scaleX;
    var y0 = neat.y0 * scaleY;
    var w = (neat.x1 - neat.x0) * scaleX;
    var h = (neat.y1 - neat.y0) * scaleY;
    var zones = rxZones(chart);
    ctx.save();
    traceClosed(ctx, coastFlat(chart), scaleX, scaleY);
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = ctx.createPattern(rxSource, 'repeat');
    zones.forEach(function (z) {
      ctx.save();
      ctx.beginPath();
      z.polys.forEach(function (p) {
        ctx.moveTo(p[0] * scaleX, p[1] * scaleY);
        for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * scaleX, p[i + 1] * scaleY);
        ctx.closePath();
      });
      ctx.clip();
      ctx.globalAlpha = z.alpha;
      ctx.fillRect(x0, y0, w, h);
      ctx.restore();
    });
    ctx.restore();
    return true;
  }

  // Draw RX02 over beyond land: the same clip as drawSeaTexture (neatline
  // rect plus coastline, evenodd), soft-light at RX_ALPHA_BEYOND flat.
  // Returns false, drawing nothing, until the pattern source is ready.
  function drawRxBeyondLand(ctx, chart, scaleX, scaleY) {
    if (!rxSource) return false;
    var neat = chart.neatline;
    var x0 = neat.x0 * scaleX;
    var y0 = neat.y0 * scaleY;
    var w = (neat.x1 - neat.x0) * scaleX;
    var h = (neat.y1 - neat.y0) * scaleY;
    ctx.save();
    traceClosed(ctx, coastFlat(chart), scaleX, scaleY);
    ctx.rect(x0, y0, w, h);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = RX_ALPHA_BEYOND;
    ctx.fillStyle = ctx.createPattern(rxSource, 'repeat');
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
    return true;
  }

  // Draw the TX-PAPER pattern as an opaque fill (source-over, alpha 1) of the
  // border strip only: one path of the chart extent rect plus the neatline
  // rect, clipped with the evenodd rule. Returns false until the pattern
  // source is ready. Pattern space is device px, one tile 1024 device px, no
  // pattern transform (same reasoning as TX-LAND).
  function drawPaperTexture(ctx, chart, scaleX, scaleY) {
    if (!txPaperSource) return false;
    var ext = chart.extent;
    var neat = chart.neatline;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ext.x0 * scaleX, ext.y0 * scaleY, (ext.x1 - ext.x0) * scaleX, (ext.y1 - ext.y0) * scaleY);
    ctx.rect(neat.x0 * scaleX, neat.y0 * scaleY, (neat.x1 - neat.x0) * scaleX, (neat.y1 - neat.y0) * scaleY);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = ctx.createPattern(txPaperSource, 'repeat');
    ctx.fillRect(ext.x0 * scaleX, ext.y0 * scaleY, (ext.x1 - ext.x0) * scaleX, (ext.y1 - ext.y0) * scaleY);
    ctx.restore();
    return true;
  }

  // Render the base offscreen canvas. Browser only (needs document).
  // Returns {canvas, width, height, hash, ops} or null if not in browser.
  function renderBaseCanvas(geom, view, widthPx, heightPx) {
    if (typeof document === 'undefined') {
      return null;
    }

    startLandTexture();
    startSeaTexture();
    startPaperTexture();
    startRxTexture();

    var canvas = document.createElement('canvas');
    var fitted = fitPixels(widthPx, heightPx);
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    var ctx = canvas.getContext('2d');

    var ops = buildDrawOps(geom, view);
    var chart = AshesChart.buildChart(geom);
    var chartOps = buildChartOps(chart);

    // Device px per cell over the chart extent (Cycle 23 Step 9).
    var tf = chartTransform(canvas, chart);
    var scaleX = tf.scaleX;
    var scaleY = tf.scaleY;

    ctx.save();
    ctx.translate(tf.tx, tf.ty);
    // Draw order (MAP_TREATMENT 3, with 1.6, 2.4, and C7): sea, land,
    // relief, rivers, borders, rail, coast. The chart under ops lay the sea
    // and the flat land, drawOps lays the province fills and the first river
    // and rail pass, then the relief raster and contours cover the land, and
    // a second drawOps call puts the rivers, then the dashed borders (Step
    // 12a), then the rail back above the relief (drawOps collects every
    // river stroke, so the network redraws once). Borders draw only in the
    // second pass, since the relief would cover them in the first. The chart
    // over ops add the beach, coastline, and edge of the war last.
    function opsOfKind(kinds) {
      return ops.filter(function (op) { return kinds.indexOf(op.kind) !== -1; });
    }
    drawChartOps(ctx, chartOps.under, scaleX, scaleY);
    drawOps(ctx, ops.filter(function (op) { return op.kind !== 'border'; }), scaleX, scaleY);
    // TX-LAND (Step 19a) draws inside drawRelief, above the relief raster and
    // below the contours. Every earlier position is buried: the 'chart-land'
    // case of drawChartOps sits under the opaque drawOps province fills, and
    // a position after those fills sits under the opaque relief raster.
    drawRelief(ctx, chart, scaleX, scaleY);
    drawOps(ctx, opsOfKind(['river', 'river-mouths']).concat(opsOfKind(['border']), opsOfKind(['rail'])), scaleX, scaleY);
    // TX-SEA (Step 19b) draws here, where the sea is final and no land work
    // can bury it: after the second drawOps pass and before the chart over
    // ops, so the beach strip and coastline stroke stay crisp above it, and
    // before the vignette and the furniture.
    drawSeaTexture(ctx, chart, scaleX, scaleY);
    // RX02 (Step 19d-1) draws here: after TX-SEA, over the same beyond land
    // area (neatline minus coastline), and before the chart over ops, so the
    // beach strip and coastline stroke stay crisp above both.
    drawRxBeyondLand(ctx, chart, scaleX, scaleY);
    drawChartOps(ctx, chartOps.over, scaleX, scaleY);
    // TX-PAPER (Step 19b) fills the border strip here, after the chart over
    // ops and before the vignette, so the vignette darkens its corners as it
    // darkened the flat paper and the furniture stays crisp on top. The flat
    // chart-paper fill from the under ops remains underneath as the fallback
    // until the pattern is ready.
    drawPaperTexture(ctx, chart, scaleX, scaleY);
    drawVignette(ctx, chart, scaleX, scaleY);
    drawChartFurniture(ctx, chartOps.furniture, scaleX, scaleY);
    ctx.restore();

    var hash = fnv1a(drawOpsHash(ops) + '|' + coastlineHash(chart)).toString(16).padStart(8, '0');

    return {
      canvas: canvas,
      width: canvas.width,
      height: canvas.height,
      hash: hash,
      ops: ops
    };
  }

  // Build a lookup of known owners from view.provinces.
  // Owner is known ONLY when intel is 'live' and owner is 'player' or 'enemy'.
  function buildOwnerLookup(view) {
    var lookup = {};
    view.provinces.forEach(function (p) {
      if (p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy')) {
        lookup[p.id] = p.owner;
      }
    });
    return lookup;
  }

  // Build state operations from geometry and view.
  // Rules:
  // - For each province with known owner: emit one fill op (drawn first, at FILL_ALPHA).
  // - For each edge where BOTH owners known and different: emit front op, then band ops for both sides.
  // - For each edge where EXACTLY ONE owner known: emit band op for known side only.
  // - For each province with known owner, for each chart boundary segment it owns: emit one band op.
  // - Same-owner edges and unknown-unknown edges emit nothing.
  // - Sorted fills, then bands, then fronts; by province id, then edge a then b.
  // Chart paths (Cycle 23 Step 12a, MAP_TREATMENT 5.3 items 1 and 2): fills and
  // band clips use the hit polygons, interior bands and fronts use the chart
  // edge paths (extended to the coast), and a sea boundary band follows the
  // coastline chain of its segment. Without the chart module the lattice
  // polygons and geometry edge paths stand in, and no boundary bands are drawn.
  function buildStateOps(geom, view) {
    var ops = [];
    var ownerLookup = buildOwnerLookup(view);
    var chart = AshesChart ? AshesChart.buildChart(geom) : null;

    var polyById = {};
    geom.provinces.forEach(function (p) {
      var poly = chart && chart.hitPolygons[p.id] ? chart.hitPolygons[p.id] : p.polygon;
      polyById[p.id] = flatPoints(poly);
    });
    var edges = chart ? chart.chartEdges : geom.edges;

    function band(provinceId, owner, path) {
      ops.push({ kind: 'band', provinceId: provinceId, owner: owner, doubled: (owner === 'enemy'), path: path, polygon: polyById[provinceId].slice() });
    }

    // 0. One ownership fill per province with a known owner (Cycle 23 Step 7c)
    geom.provinces.forEach(function (p) {
      var owner = ownerLookup[p.id];
      if (!owner) return;
      ops.push({ kind: 'fill', provinceId: p.id, owner: owner, polygon: polyById[p.id].slice() });
    });

    // 1. Interior edges
    edges.forEach(function (e) {
      var oa = ownerLookup[e.a];
      var ob = ownerLookup[e.b];

      if (oa && ob) {
        if (oa !== ob) {
          // Different known owners: front line + two band ops
          ops.push({ kind: 'front', a: e.a, b: e.b, path: flatPoints(e.path) });
          band(e.a, oa, flatPoints(e.path));
          band(e.b, ob, flatPoints(e.path));
        }
        // Same owner: nothing
      } else if (oa && !ob) {
        band(e.a, oa, flatPoints(e.path));
      } else if (!oa && ob) {
        band(e.b, ob, flatPoints(e.path));
      }
      // Neither known: nothing
    });

    // 2. Chart boundary segments: one band per segment of a known owner
    // province. A sea segment's ribbon runs p1, its coastline chain, p2; an
    // inland segment keeps the lattice edge p1 to p2.
    if (chart) {
      chart.boundarySegments.forEach(function (seg) {
        var owner = ownerLookup[seg.provinceId];
        if (!owner) return;
        var pts = [seg.p1];
        if (seg.sea) pts = pts.concat(chart.coastline.slice(seg.coastStart, seg.coastEnd + 1));
        pts.push(seg.p2);
        band(seg.provinceId, owner, flatPoints(pts));
      });
    }

    // Sort: by kind (band before front for determinism? spec says sorted by province id then edge a then b)
    // Actually: front ops have a,b; band ops have provinceId. Sort by provinceId for bands, by a then b for fronts.
    // But we built them in order already: edges in geom.edges order (which comes from view.edges sorted), then boundary segments in province order.
    // This should be deterministic. Let's ensure a stable sort.
    // Fills sort first so they draw under every band and front.
    var KIND_RANK = { fill: 0, band: 1, front: 2 };
    ops.sort(function (a, b) {
      if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
      if (a.kind === 'front') {
        if (a.a !== b.a) return a.a.localeCompare(b.a);
        return a.b.localeCompare(b.b);
      }
      return a.provinceId.localeCompare(b.provinceId);
    });

    return ops;
  }

  // Draw state operations on a canvas context.
  // scaleX, scaleY: device pixels per cell-space unit.
  function drawStateOps(ctx, ops, scaleX, scaleY) {
    var INK = '#1e1a12';
    var PLAYER_COLOR = '#2E6FD8';
    var ENEMY_COLOR = '#C8372D';

    // Width formulas at scaleX (device px per cell). At scaleX 160: 16, 9, 3, 4 px.
    var wideW = 0.10 * scaleX;
    var midW = 0.05625 * scaleX;
    var coreW = 0.01875 * scaleX;
    var frontW = 0.025 * scaleX;

    ctx.lineJoin = 'round';

    // Ownership fills first, under every band and front (Cycle 23 Step 7c).
    ops.forEach(function (op) {
      if (op.kind !== 'fill') return;
      var polygon = op.polygon;
      if (polygon.length < 6) return;
      ctx.beginPath();
      ctx.moveTo(polygon[0] * scaleX, polygon[1] * scaleY);
      for (var i = 2; i < polygon.length; i += 2) {
        ctx.lineTo(polygon[i] * scaleX, polygon[i + 1] * scaleY);
      }
      ctx.closePath();
      ctx.fillStyle = (op.owner === 'player') ? PLAYER_COLOR : ENEMY_COLOR;
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ops.forEach(function (op) {
      if (op.kind === 'front') {
        var path = op.path;
        if (path.length < 4) return;
        ctx.beginPath();
        ctx.moveTo(path[0] * scaleX, path[1] * scaleY);
        for (var i = 2; i < path.length; i += 2) {
          ctx.lineTo(path[i] * scaleX, path[i + 1] * scaleY);
        }
        // Paper casing under the Ink front (MAP_TREATMENT 5.3 item 3).
        ctx.strokeStyle = FRONT_CASING;
        ctx.globalAlpha = FRONT_CASING_ALPHA;
        ctx.lineWidth = frontW + FRONT_CASING_PLUS_PX;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = INK;
        ctx.lineWidth = frontW;
        ctx.stroke();
      } else if (op.kind === 'band') {
        var path = op.path;
        if (path.length < 4) return;
        var polygon = op.polygon;
        var owner = op.owner;
        var doubled = op.doubled;
        var color = (owner === 'player') ? PLAYER_COLOR : ENEMY_COLOR;

        // Clip to the province polygon
        ctx.save();
        if (polygon.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(polygon[0] * scaleX, polygon[1] * scaleY);
          for (var i = 2; i < polygon.length; i += 2) {
            ctx.lineTo(polygon[i] * scaleX, polygon[i + 1] * scaleY);
          }
          ctx.closePath();
          ctx.clip();
        }

        // Helper to draw band strokes on the path
        function strokeBand(p, lineWidth, alpha) {
          ctx.beginPath();
          ctx.moveTo(p[0] * scaleX, p[1] * scaleY);
          for (var i = 2; i < p.length; i += 2) {
            ctx.lineTo(p[i] * scaleX, p[i + 1] * scaleY);
          }
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Wide stroke
        strokeBand(path, wideW, BAND_WIDE_ALPHA);
        // Mid stroke
        strokeBand(path, midW, BAND_MID_ALPHA);

        // Core stroke(s)
        if (!doubled) {
          // Single core stroke with ink edges
          // Ink stroke first (slightly wider)
          ctx.beginPath();
          ctx.moveTo(path[0] * scaleX, path[1] * scaleY);
          for (var i = 2; i < path.length; i += 2) {
            ctx.lineTo(path[i] * scaleX, path[i + 1] * scaleY);
          }
          ctx.strokeStyle = INK;
          ctx.lineWidth = coreW + 2;
          ctx.stroke();

          // Faction color at core width
          ctx.beginPath();
          ctx.moveTo(path[0] * scaleX, path[1] * scaleY);
          for (var i = 2; i < path.length; i += 2) {
            ctx.lineTo(path[i] * scaleX, path[i + 1] * scaleY);
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = coreW;
          ctx.stroke();
        } else {
          // Khessite (enemy): TWO core strokes at half width, offset perpendicular by +/- core*0.5
          var halfCore = coreW * 0.5;
          var offsetDist = halfCore / scaleX;

          // Compute normal from first and last path points
          var x1 = path[0], y1 = path[1];
          var x2 = path[path.length - 2], y2 = path[path.length - 1];
          var dx = x2 - x1;
          var dy = y2 - y1;
          var len = Math.sqrt(dx * dx + dy * dy);
          var nx = 0, ny = 0;
          if (len > 1e-6) {
            nx = -dy / len;
            ny = dx / len;
          }

          // Two offsets: +normal and -normal
          var offsets = [offsetDist, -offsetDist];
          offsets.forEach(function (offset) {
            // Offset all path points
            var offsetPath = [];
            for (var i = 0; i < path.length; i += 2) {
              offsetPath.push(path[i] + nx * offset, path[i + 1] + ny * offset);
            }

            // Ink edge first
            ctx.beginPath();
            ctx.moveTo(offsetPath[0] * scaleX, offsetPath[1] * scaleY);
            for (var i = 2; i < offsetPath.length; i += 2) {
              ctx.lineTo(offsetPath[i] * scaleX, offsetPath[i + 1] * scaleY);
            }
            ctx.strokeStyle = INK;
            ctx.lineWidth = halfCore + 1.5;
            ctx.stroke();

            // Faction color
            ctx.beginPath();
            ctx.moveTo(offsetPath[0] * scaleX, offsetPath[1] * scaleY);
            for (var i = 2; i < offsetPath.length; i += 2) {
              ctx.lineTo(offsetPath[i] * scaleX, offsetPath[i + 1] * scaleY);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = halfCore;
            ctx.stroke();
          });
        }

        ctx.restore();
      }
    });
  }

  // FNV-1a hash of a canonical string built from state ops.
  function stateOpsHash(ops) {
    var parts = [];
    ops.forEach(function (op) {
      parts.push(op.kind);
      if (op.provinceId !== undefined) parts.push(String(op.provinceId));
      if (op.owner !== undefined) parts.push(String(op.owner));
      if (op.doubled !== undefined) parts.push(op.doubled ? '1' : '0');
      if (op.a !== undefined) parts.push(String(op.a));
      if (op.b !== undefined) parts.push(String(op.b));
      if (op.path) {
        for (var j = 0; j < op.path.length; j++) {
          parts.push(op.path[j].toFixed(4));
        }
      }
      if (op.polygon) {
        for (var k = 0; k < op.polygon.length; k++) {
          parts.push(op.polygon[k].toFixed(4));
        }
      }
    });
    var canonical = parts.join('|');
    var hash = fnv1a(canonical);
    return hash.toString(16).padStart(8, '0');
  }

  // Render the state offscreen canvas. Browser only (needs document).
  // Returns {canvas, width, height, hash, ops} or null if not in browser.
  function renderStateCanvas(geom, view, widthPx, heightPx) {
    if (typeof document === 'undefined') {
      return null;
    }

    var canvas = document.createElement('canvas');
    var fitted = fitPixels(widthPx, heightPx);
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    var ctx = canvas.getContext('2d');

    var ops = buildStateOps(geom, view);

    // Shared chart transform (Cycle 23 Step 9).
    var tf = chartTransform(canvas, AshesChart.buildChart(geom));
    var scaleX = tf.scaleX;
    var scaleY = tf.scaleY;

    ctx.save();
    ctx.translate(tf.tx, tf.ty);
    drawStateOps(ctx, ops, scaleX, scaleY);
    ctx.restore();

    var hash = stateOpsHash(ops);

    return {
      canvas: canvas,
      width: canvas.width,
      height: canvas.height,
      hash: hash,
      ops: ops
    };
  }

  // Fog layer constants (Cycle 23 Step 8, chart fog Step 14, MAP_TREATMENT 6).
  // Fog is texture and value, never darkness: Unknown is uncharted paper,
  // the lightest ground on the board (luma band D, 185 to 225); last seen is
  // a translucent faded chart wash (CHART_FADED at 0.65) that lands in band
  // C (120 to 175) over both sea and land.
  var FOG_UNKNOWN_FILL = '#DCCDA8';
  var FOG_REMEMBERED_FILL = '#C2AE86';
  var FOG_REMEMBERED_ALPHA = 0.65;
  var FOG_HATCH_INK = '#2B2620';
  var FOG_HATCH_ALPHA = 0.30;
  var FOG_HATCH_SPACING = 0.12;
  var FOG_HATCH_W = 1.5;
  var FOG_BAND_GRAY = '#6E6E66';
  var FOG_BAND_ALPHA = 0.5;
  // Unknown ink redraw (MAP_TREATMENT 6.3). Widths in cells unless noted.
  var FOG_COAST_W = 0.008;
  var FOG_COAST_ALPHA = 0.70;
  var FOG_WATER_OFFSETS = [0.07, 0.15, 0.26];
  var FOG_WATER_W_PX = 1;
  var FOG_WATER_ALPHA = 0.25;
  var FOG_RIVER_W = 0.006;
  var FOG_RIVER_ALPHA = 0.60;
  var FOG_BORDER_ALPHA = 0.35;

  // Trace a flat polygon as the current path.
  function tracePolygon(ctx, poly, scaleX, scaleY) {
    ctx.beginPath();
    ctx.moveTo(poly[0] * scaleX, poly[1] * scaleY);
    for (var i = 2; i < poly.length; i += 2) {
      ctx.lineTo(poly[i] * scaleX, poly[i + 1] * scaleY);
    }
    ctx.closePath();
  }

  // Trace every flat polygon as one path of closed subpaths. The hit polygon
  // and its sea sectors never overlap, so the path is their union.
  function tracePolygons(ctx, polys, scaleX, scaleY) {
    ctx.beginPath();
    polys.forEach(function (poly) {
      if (!poly || poly.length < 6) return;
      ctx.moveTo(poly[0] * scaleX, poly[1] * scaleY);
      for (var i = 2; i < poly.length; i += 2) {
        ctx.lineTo(poly[i] * scaleX, poly[i + 1] * scaleY);
      }
      ctx.closePath();
    });
  }

  // Stroke flat polylines as one path.
  function strokePolylines(ctx, lines, scaleX, scaleY) {
    ctx.beginPath();
    lines.forEach(function (ln) {
      if (!ln || ln.length < 4) return;
      ctx.moveTo(ln[0] * scaleX, ln[1] * scaleY);
      for (var i = 2; i < ln.length; i += 2) {
        ctx.lineTo(ln[i] * scaleX, ln[i + 1] * scaleY);
      }
    });
    ctx.stroke();
  }

  // Even odd point in polygon test on a flat [x, y, ...] polygon.
  function pointInFlat(x, y, flat) {
    var inside = false;
    var n = flat.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = flat[2 * i], yi = flat[2 * i + 1];
      var xj = flat[2 * j], yj = flat[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Area centroid of a flat polygon; the vertex mean when the area vanishes.
  function flatCentroid(flat) {
    var n = flat.length / 2;
    var a = 0, cx = 0, cy = 0, mx = 0, my = 0;
    for (var i = 0; i < n; i++) {
      var x0 = flat[2 * i], y0 = flat[2 * i + 1];
      var j = (i + 1) % n;
      var x1 = flat[2 * j], y1 = flat[2 * j + 1];
      var cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
      mx += x0;
      my += y0;
    }
    if (Math.abs(a) < 1e-12) return { x: mx / n, y: my / n };
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }

  // Sea sectors of one province with their coastline chains, ordered along
  // the coastline so consecutive chains join end to start (a corner province
  // whose sectors wrap the coastline start comes out in walk order). Each
  // entry: { seaPart: flat polygon, chain: [{x, y}], first, last } where
  // first and last are coastline indices of the chain ends.
  function fogSeaSectors(chart, provinceId) {
    var coastIndex = {};
    chart.coastline.forEach(function (q, i) { coastIndex[q.x + ',' + q.y] = i; });
    var out = [];
    chart.sectors.forEach(function (sec) {
      if (!sec.sea || sec.provinceId !== provinceId) return;
      var chainPts = [];
      var first = -1, last = -1;
      sec.seaPart.forEach(function (q) {
        var idx = coastIndex[q.x + ',' + q.y];
        if (idx === undefined) return;
        chainPts.push({ x: q.x, y: q.y });
        if (first < 0) first = idx;
        last = idx;
      });
      out.push({ seaPart: flatPoints(sec.seaPart), chain: chainPts, first: first, last: last });
    });
    if (out.length < 2) return out;
    var n = chart.coastline.length;
    var start = 0;
    for (var s = 0; s < out.length; s++) {
      var prevIdx = (out[s].first - 1 + n) % n;
      var hasPrev = out.some(function (o) { return o.last === prevIdx; });
      if (!hasPrev) { start = s; break; }
    }
    return out.slice(start).concat(out.slice(0, start));
  }

  // Water lines (MAP_TREATMENT 6.3, the 1.6 offsets): one flat polyline per
  // offset, running through every sea sector of the province in coastline
  // order. Each chain point moves toward the centroid of its sector sea
  // part; points that leave the sector are dropped.
  function fogWaterLines(seaSectors) {
    var lines = FOG_WATER_OFFSETS.map(function () { return []; });
    seaSectors.forEach(function (sec) {
      var c = flatCentroid(sec.seaPart);
      sec.chain.forEach(function (q) {
        var dx = c.x - q.x;
        var dy = c.y - q.y;
        var len = Math.hypot(dx, dy);
        if (len < 1e-9) return;
        FOG_WATER_OFFSETS.forEach(function (d, k) {
          var x = q.x + dx / len * d;
          var y = q.y + dy / len * d;
          if (pointInFlat(x, y, sec.seaPart)) lines[k].push(x, y);
        });
      });
    });
    return lines;
  }

  // River centre lines inside a province: the maximal runs of consecutive
  // river samples inside the hit polygon, two points or more.
  function fogRiverPaths(chart, hitFlat) {
    var paths = [];
    chart.rivers.edges.forEach(function (e) {
      var run = [];
      e.samples.forEach(function (q) {
        if (pointInFlat(q.x, q.y, hitFlat)) {
          run.push(q.x, q.y);
        } else {
          if (run.length >= 4) paths.push(run);
          run = [];
        }
      });
      if (run.length >= 4) paths.push(run);
    });
    return paths;
  }

  // Build fog operations from geometry and view.
  // Reads ONLY geom polygons and view.provinces (id, intel, snapshot), plus
  // the chart built from geom. Each op covers the province hit polygon plus
  // its sea sectors (MAP_TREATMENT 6): polygons[0] is the hit polygon and
  // each sea sector sea part follows. Dark provinces emit an 'unknown' op
  // carrying the ink redraw paths of 6.3; remembered provinces emit a
  // 'remembered' op carrying the snapshot owner; live provinces emit
  // nothing. Sorted by province id. Without the chart module the original
  // polygon is the only clip polygon and the redraw lists are empty.
  function buildFogOps(geom, view) {
    var ops = [];
    var geomById = {};
    geom.provinces.forEach(function (p) { geomById[p.id] = p; });
    var chart = AshesChart ? AshesChart.buildChart(geom) : null;

    view.provinces.forEach(function (vp) {
      if (vp.intel !== 'dark' && vp.intel !== 'remembered') return;
      var gp = geomById[vp.id];
      if (!gp) return;
      var hit = flatPoints(chart && chart.hitPolygons[vp.id] ? chart.hitPolygons[vp.id] : gp.polygon);
      var seaSectors = chart ? fogSeaSectors(chart, vp.id) : [];
      var polygons = [hit].concat(seaSectors.map(function (sec) { return sec.seaPart; }));

      if (vp.intel === 'remembered') {
        ops.push({
          kind: 'remembered',
          id: vp.id,
          polygon: hit,
          polygons: polygons,
          snapshotOwner: vp.snapshot ? vp.snapshot.owner : null,
          hatch: true,
          hatchAnchor: [gp.x + 0.5, gp.y + 0.5]
        });
        return;
      }

      var coastPaths = seaSectors.map(function (sec) { return flatPoints(sec.chain); });
      var waterLines = coastPaths.length ? fogWaterLines(seaSectors) : [];
      var riverPaths = chart ? fogRiverPaths(chart, hit) : [];
      var borderPaths = [];
      if (chart) {
        chart.chartEdges.forEach(function (e) {
          if (e.a === vp.id || e.b === vp.id) borderPaths.push(flatPoints(e.path));
        });
      }
      ops.push({
        kind: 'unknown',
        id: vp.id,
        polygon: hit,
        polygons: polygons,
        coastPaths: coastPaths,
        waterLines: waterLines,
        riverPaths: riverPaths,
        borderPaths: borderPaths
      });
    });

    ops.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    return ops;
  }

  // Draw fog operations on a canvas context. Live provinces have no op,
  // so the canvas stays transparent over them.
  // scaleX, scaleY: device pixels per cell-space unit.
  function drawFogOps(ctx, ops, scaleX, scaleY) {
    var bandW = 0.01875 * scaleX;
    var graticule = [];

    ops.forEach(function (op) {
      if (op.kind === 'graticule') {
        graticule.push(op.line);
        return;
      }
      var poly = op.polygon;
      if (!poly || poly.length < 6) return;
      var polys = op.polygons && op.polygons.length ? op.polygons : [poly];
      var hit = polys[0];

      if (op.kind === 'unknown') {
        // 6.3: uncharted paper over the hit polygon plus the sea sectors,
        // then the Ink any chart of the region would show, inside that clip.
        ctx.save();
        tracePolygons(ctx, polys, scaleX, scaleY);
        ctx.clip();
        ctx.globalAlpha = 1;
        // TX-FOG-UK (Step 19c) when its source is ready, else the flat fill.
        // The context is translated only, so pattern space is device px and
        // one tile is 1024 device px; no pattern transform (as TX-LAND).
        ctx.fillStyle = txFogUkSource ? ctx.createPattern(txFogUkSource, 'repeat') : FOG_UNKNOWN_FILL;
        tracePolygons(ctx, polys, scaleX, scaleY);
        ctx.fill();

        ctx.strokeStyle = CHART_INK;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (op.coastPaths && op.coastPaths.length) {
          ctx.globalAlpha = FOG_COAST_ALPHA;
          ctx.lineWidth = FOG_COAST_W * scaleX;
          strokePolylines(ctx, op.coastPaths, scaleX, scaleY);
        }
        if (op.waterLines && op.waterLines.length) {
          ctx.globalAlpha = FOG_WATER_ALPHA;
          ctx.lineWidth = FOG_WATER_W_PX;
          strokePolylines(ctx, op.waterLines, scaleX, scaleY);
        }
        if (op.riverPaths && op.riverPaths.length) {
          ctx.globalAlpha = FOG_RIVER_ALPHA;
          ctx.lineWidth = FOG_RIVER_W * scaleX;
          strokePolylines(ctx, op.riverPaths, scaleX, scaleY);
        }
        if (op.borderPaths && op.borderPaths.length) {
          ctx.globalAlpha = FOG_BORDER_ALPHA;
          ctx.lineWidth = BORDER_LINE_W * scaleX;
          ctx.setLineDash([BORDER_DASH * scaleX, BORDER_GAP * scaleX]);
          strokePolylines(ctx, op.borderPaths, scaleX, scaleY);
          ctx.setLineDash([]);
        }
        ctx.restore();
      } else if (op.kind === 'remembered') {
        // 6.2: a faded chart wash over the hit polygon plus the sea sectors.
        ctx.save();
        tracePolygons(ctx, polys, scaleX, scaleY);
        ctx.clip();
        ctx.globalAlpha = FOG_REMEMBERED_ALPHA;
        // TX-FOG-LS (Step 19c) when its source is ready, else the flat wash;
        // same alpha either way, pattern space as for TX-FOG-UK above.
        ctx.fillStyle = txFogLsSource ? ctx.createPattern(txFogLsSource, 'repeat') : FOG_REMEMBERED_FILL;
        tracePolygons(ctx, polys, scaleX, scaleY);
        ctx.fill();
        ctx.restore();

        if (op.hatch) {
          var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (var i = 0; i < hit.length; i += 2) {
            if (hit[i] < minX) minX = hit[i];
            if (hit[i] > maxX) maxX = hit[i];
            if (hit[i + 1] < minY) minY = hit[i + 1];
            if (hit[i + 1] > maxY) maxY = hit[i + 1];
          }
          // Diagonal hatch lines x - y = c inside the hit polygon, phased so
          // the province cell centre falls midway between two lines and
          // reads the flat wash.
          ctx.save();
          tracePolygon(ctx, hit, scaleX, scaleY);
          ctx.clip();
          var s = FOG_HATCH_SPACING;
          var anchor = op.hatchAnchor || [(minX + maxX) / 2, (minY + maxY) / 2];
          var c0 = (anchor[0] - anchor[1]) + s / 2;
          var cMin = minX - maxY;
          var cMax = maxX - minY;
          var c = c0 - Math.ceil((c0 - cMin) / s) * s;
          ctx.beginPath();
          for (; c <= cMax; c += s) {
            ctx.moveTo((c + minY) * scaleX, minY * scaleY);
            ctx.lineTo((c + maxY) * scaleX, maxY * scaleY);
          }
          ctx.strokeStyle = CHART_INK || FOG_HATCH_INK;
          ctx.globalAlpha = FOG_HATCH_ALPHA;
          ctx.lineWidth = FOG_HATCH_W;
          ctx.stroke();
          ctx.restore();
        }

        // Gray band standing in for the last known owner band, along the
        // hit polygon perimeter (coastline chain and chart edge paths).
        ctx.save();
        tracePolygon(ctx, hit, scaleX, scaleY);
        ctx.strokeStyle = FOG_BAND_GRAY;
        ctx.globalAlpha = FOG_BAND_ALPHA;
        ctx.lineWidth = bandW;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    });

    // Graticule furniture (Cycle 23 Step 13, MAP_TREATMENT 4.2): one solid
    // Ink path at alpha 0.20 over every fog state, so crossings do not
    // double. Width 1 device px, or 2 at scaleX 240 and up (the drawRelief
    // contour rule). Each line snaps to the device pixel grid so a 1 px line
    // lands on one pixel column instead of smearing over two.
    if (!graticule.length) return;
    var lw = scaleX >= 240 ? 2 : 1;
    var tf = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    function snap(v, origin) {
      if (!tf) return v;
      var dev = origin + v;
      return (lw % 2 === 1 ? Math.floor(dev) + 0.5 : Math.round(dev)) - origin;
    }
    ctx.save();
    ctx.strokeStyle = CHART_INK;
    ctx.globalAlpha = GRATICULE_ALPHA;
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.beginPath();
    graticule.forEach(function (ln) {
      var x1 = ln[0] * scaleX, y1 = ln[1] * scaleY, x2 = ln[2] * scaleX, y2 = ln[3] * scaleY;
      if (x1 === x2) { x1 = x2 = snap(x1, tf ? tf.e : 0); }
      if (y1 === y2) { y1 = y2 = snap(y1, tf ? tf.f : 0); }
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    ctx.stroke();
    ctx.restore();
  }

  // FNV-1a hash of a canonical string built from fog ops.
  function fogOpsHash(ops) {
    var parts = [];
    function pushNum(v) { parts.push(v.toFixed(4)); }
    function pushLists(tag, lists) {
      parts.push(tag + lists.length);
      lists.forEach(function (ln) {
        parts.push('#' + ln.length);
        ln.forEach(pushNum);
      });
    }
    ops.forEach(function (op) {
      parts.push(op.kind);
      // Graticule furniture (Step 13) carries only its line, no id or polygon.
      if (op.kind === 'graticule') {
        op.line.forEach(pushNum);
        return;
      }
      parts.push(String(op.id));
      if (op.kind === 'remembered') {
        parts.push(op.snapshotOwner === null ? '' : String(op.snapshotOwner));
        parts.push(op.hatch ? '1' : '0');
        if (op.hatchAnchor) { pushNum(op.hatchAnchor[0]); pushNum(op.hatchAnchor[1]); }
      }
      pushLists('P', op.polygons || [op.polygon]);
      if (op.kind === 'unknown') {
        pushLists('C', op.coastPaths || []);
        pushLists('W', op.waterLines || []);
        pushLists('R', op.riverPaths || []);
        pushLists('B', op.borderPaths || []);
      }
    });
    var canonical = parts.join('|');
    var hash = fnv1a(canonical);
    return hash.toString(16).padStart(8, '0');
  }

  // Render the fog offscreen canvas. Browser only (needs document).
  // Returns {canvas, width, height, hash, ops} or null if not in browser.
  function renderFogCanvas(geom, view, widthPx, heightPx) {
    if (typeof document === 'undefined') {
      return null;
    }

    startFogUkTexture();
    startFogLsTexture();

    var canvas = document.createElement('canvas');
    var fitted = fitPixels(widthPx, heightPx);
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    var ctx = canvas.getContext('2d');

    var ops = buildFogOps(geom, view);

    // Shared chart transform (Cycle 23 Step 9).
    var tf = chartTransform(canvas, AshesChart.buildChart(geom));
    var scaleX = tf.scaleX;
    var scaleY = tf.scaleY;

    ctx.save();
    ctx.translate(tf.tx, tf.ty);
    // Graticule furniture drawn last and counted in the hash (MAP_TREATMENT
    // 4.2); the returned ops stay the fog ops only.
    var withFurniture = ops.concat(buildFurnitureOps(geom));
    drawFogOps(ctx, withFurniture, scaleX, scaleY);
    ctx.restore();

    var hash = fogOpsHash(withFurniture);

    return {
      canvas: canvas,
      width: canvas.width,
      height: canvas.height,
      hash: hash,
      ops: ops
    };
  }

  // Attack beats (Cycle 23 Step 16a, MAP_TREATMENT 8.1 Step 16): a state
  // light on each attacked edge in the moment after a fight. One pale gold,
  // luma about 241, inside the State lights band (225 to 255). Widths are in
  // cells; phase 1 is the flash, phase 2 the fade.
  var BEAT_COLOR = '#FFF3C4';
  var BEAT_WIDE_W = 0.09;
  var BEAT_CORE_W = 0.03;
  var BEAT_PHASE_ALPHA = {
    1: { wide: 0.35, core: 0.95 },
    2: { wide: 0.15, core: 0.45 }
  };

  // One beat op per edge with a chart (or geometry) edge path, matched by
  // unordered pair, sorted by a then b. An edge with no path emits no op.
  function buildBeatOps(geom, edges) {
    var chart = AshesChart ? AshesChart.buildChart(geom) : null;
    var source = chart ? chart.chartEdges : geom.edges;
    var pathByPair = {};
    source.forEach(function (e) {
      pathByPair[e.a + '|' + e.b] = e.path;
      pathByPair[e.b + '|' + e.a] = e.path;
    });
    var ops = [];
    (edges || []).forEach(function (e) {
      var path = pathByPair[e.a + '|' + e.b];
      if (!path) return;
      ops.push({ kind: 'beat', a: e.a, b: e.b, path: flatPoints(path) });
    });
    ops.sort(function (x, y) {
      if (x.a !== y.a) return x.a < y.a ? -1 : 1;
      if (x.b !== y.b) return x.b < y.b ? -1 : 1;
      return 0;
    });
    return ops;
  }

  function strokeBeatPath(ctx, path, scaleX, scaleY) {
    ctx.beginPath();
    ctx.moveTo(path[0] * scaleX, path[1] * scaleY);
    for (var i = 2; i < path.length; i += 2) ctx.lineTo(path[i] * scaleX, path[i + 1] * scaleY);
    ctx.stroke();
  }

  // Each op stroked twice: the wide glow, then the bright core.
  function drawBeatOps(ctx, ops, scaleX, scaleY, phase) {
    var alpha = BEAT_PHASE_ALPHA[phase];
    if (!alpha) return;
    ctx.lineJoin = 'round';
    ops.forEach(function (op) {
      if (op.kind !== 'beat' || op.path.length < 4) return;
      ctx.strokeStyle = BEAT_COLOR;
      ctx.lineWidth = BEAT_WIDE_W * scaleX;
      ctx.globalAlpha = alpha.wide;
      strokeBeatPath(ctx, op.path, scaleX, scaleY);
      ctx.strokeStyle = BEAT_COLOR;
      ctx.lineWidth = BEAT_CORE_W * scaleX;
      ctx.globalAlpha = alpha.core;
      strokeBeatPath(ctx, op.path, scaleX, scaleY);
    });
    ctx.globalAlpha = 1;
  }

  // Render the beat offscreen canvas. Browser only (needs document).
  // Returns {canvas, width, height, ops} or null if not in browser.
  function renderBeatCanvas(geom, edges, widthPx, heightPx, phase) {
    if (typeof document === 'undefined') {
      return null;
    }

    var canvas = document.createElement('canvas');
    var fitted = fitPixels(widthPx, heightPx);
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    var ctx = canvas.getContext('2d');

    var ops = buildBeatOps(geom, edges);

    // Shared chart transform (Cycle 23 Step 9).
    var tf = chartTransform(canvas, AshesChart.buildChart(geom));

    ctx.save();
    ctx.translate(tf.tx, tf.ty);
    drawBeatOps(ctx, ops, tf.scaleX, tf.scaleY, phase);
    ctx.restore();

    return {
      canvas: canvas,
      width: canvas.width,
      height: canvas.height,
      ops: ops
    };
  }

  var AshesMapCanvas = {
    DPR_CAP_DESKTOP: DPR_CAP_DESKTOP,
    DPR_CAP_MOBILE: DPR_CAP_MOBILE,
    MOBILE_MAX_WIDTH: MOBILE_MAX_WIDTH,
    PIXEL_CAP: PIXEL_CAP,
    ZOOM_STEPS: ZOOM_STEPS,
    effectiveDpr: effectiveDpr,
    fitPixels: fitPixels,
    buildDrawOps: buildDrawOps,
    drawOpsHash: drawOpsHash,
    drawOps: drawOps,
    renderBaseCanvas: renderBaseCanvas,
    // Chart exports (Cycle 23 Step 9)
    buildChartOps: buildChartOps,
    drawChartOps: drawChartOps,
    coastlineHash: coastlineHash,
    // Chart furniture and graticule exports (Cycle 23 Step 13)
    GRATICULE_MERIDIANS: GRATICULE_MERIDIANS,
    GRATICULE_PARALLELS: GRATICULE_PARALLELS,
    GRATICULE_LABELS: GRATICULE_LABELS,
    SCALE_BAR: SCALE_BAR,
    NORTH_ARROW: NORTH_ARROW,
    buildFurnitureOps: buildFurnitureOps,
    drawChartFurniture: drawChartFurniture,
    // State layer exports
    BAND_WIDE_W: BAND_WIDE_W,
    BAND_MID_W: BAND_MID_W,
    BAND_CORE_W: BAND_CORE_W,
    BAND_WIDE_ALPHA: BAND_WIDE_ALPHA,
    BAND_MID_ALPHA: BAND_MID_ALPHA,
    FILL_ALPHA: FILL_ALPHA,
    FRONT_W: FRONT_W,
    buildStateOps: buildStateOps,
    drawStateOps: drawStateOps,
    stateOpsHash: stateOpsHash,
    renderStateCanvas: renderStateCanvas,
    // Fog layer exports
    FOG_UNKNOWN_FILL: FOG_UNKNOWN_FILL,
    FOG_REMEMBERED_FILL: FOG_REMEMBERED_FILL,
    FOG_REMEMBERED_ALPHA: FOG_REMEMBERED_ALPHA,
    buildFogOps: buildFogOps,
    drawFogOps: drawFogOps,
    fogOpsHash: fogOpsHash,
    renderFogCanvas: renderFogCanvas,
    // Attack beat exports (Cycle 23 Step 16a)
    BEAT_COLOR: BEAT_COLOR,
    BEAT_WIDE_W: BEAT_WIDE_W,
    BEAT_CORE_W: BEAT_CORE_W,
    BEAT_PHASE_ALPHA: BEAT_PHASE_ALPHA,
    buildBeatOps: buildBeatOps,
    drawBeatOps: drawBeatOps,
    renderBeatCanvas: renderBeatCanvas,
    // Vignette exports (Cycle 23 Step 17a)
    VIGNETTE_MAX_ALPHA: VIGNETTE_MAX_ALPHA,
    VIGNETTE_RANGE: VIGNETTE_RANGE,
    VIGNETTE_RES: VIGNETTE_RES,
    buildVignetteRaster: buildVignetteRaster,
    drawVignette: drawVignette,
    // TX-LAND texture exports (Cycle 23 Step 19a)
    TX_LAND_ALPHA: TX_LAND_ALPHA,
    TX_LAND_SIZE: TX_LAND_SIZE,
    TX_LAND_VALUE_SCALE: TX_LAND_VALUE_SCALE,
    textureDebug: txLandDebug,
    drawLandTexture: drawLandTexture,
    TX_SEA_ALPHA: TX_SEA_ALPHA,
    TX_SEA_SIZE: TX_SEA_SIZE,
    TX_SEA_VALUE_SCALE: TX_SEA_VALUE_SCALE,
    TX_PAPER_SIZE: TX_PAPER_SIZE,
    drawSeaTexture: drawSeaTexture,
    drawPaperTexture: drawPaperTexture,
    // TX-FOG texture exports (Cycle 23 Step 19c)
    TX_FOG_UK_SIZE: TX_FOG_UK_SIZE,
    TX_FOG_LS_SIZE: TX_FOG_LS_SIZE,
    // RX01 / RX02 micro relief exports (Cycle 23 Step 19d-1)
    RX_ALPHA_LAND: RX_ALPHA_LAND,
    RX_ALPHA_BEYOND: RX_ALPHA_BEYOND,
    RX_SIZE: RX_SIZE,
    RX_STEPS: RX_STEPS,
    RX_RUG_MIN: RX_RUG_MIN,
    RX_RUG_MAX: RX_RUG_MAX,
    RX_VALUE_SCALE: RX_VALUE_SCALE,
    rxBucket: rxBucket,
    rxLandAlpha: rxLandAlpha,
    buildRxZones: buildRxZones,
    drawRxLand: drawRxLand,
    drawRxBeyondLand: drawRxBeyondLand
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesMapCanvas;
  }
  global.AshesMapCanvas = AshesMapCanvas;
  global.AshesTextureDebug = txLandDebug;
})(typeof window !== 'undefined' ? window : globalThis);