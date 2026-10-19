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

  // Rail restyle (Cycle 23 Step 10, MAP_TREATMENT 2.6), in cell units.
  var RAIL_LINE_W = 0.008;
  var RAIL_TIE_STEP = 0.06;
  var RAIL_TIE_LEN = 0.03;
  var RAIL_DOT_STEP = 0.04;
  var RAIL_DOT_R = 0.004;

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

    // Coast segments
    geom.coastSegments.forEach(function (cs) {
      var path = [];
      for (var i = 0; i < cs.path.length; i++) {
        var pt = cs.path[i];
        path.push(pt.x, pt.y);
      }
      ops.push({ kind: 'coast', provinceId: cs.provinceId, path: path });
    });

    // River segments, each carrying its chart edge samples (Step 10).
    var rivers = AshesChart ? AshesChart.buildChart(geom).rivers : { edges: [], mouths: [] };
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
            // Stroke only the segments off the lattice boundary (Step 9).
            ctx.beginPath();
            var nPts = pts.length / 2;
            for (var si = 0; si < nPts; si++) {
              if (op.boundarySegs && op.boundarySegs[si]) continue;
              var sj = (si + 1) % nPts;
              ctx.moveTo(pts[si * 2] * scaleX, pts[si * 2 + 1] * scaleY);
              ctx.lineTo(pts[sj * 2] * scaleX, pts[sj * 2 + 1] * scaleY);
            }
            ctx.strokeStyle = 'rgba(30,26,18,0.55)';
            ctx.lineWidth = 2; // device px
            ctx.stroke();
          }
          break;

        case 'coast':
          ctx.beginPath();
          var cpath = op.path;
          if (cpath.length >= 2) {
            ctx.moveTo(cpath[0] * scaleX, cpath[1] * scaleY);
            for (var i = 2; i < cpath.length; i += 2) {
              ctx.lineTo(cpath[i] * scaleX, cpath[i + 1] * scaleY);
            }
            ctx.strokeStyle = '#7fb3d9';
            ctx.lineWidth = Math.max(3, 0.05 * scaleX);
            ctx.stroke();
          }
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
    return { under: under, over: over };
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

  // Render the base offscreen canvas. Browser only (needs document).
  // Returns {canvas, width, height, hash, ops} or null if not in browser.
  function renderBaseCanvas(geom, view, widthPx, heightPx) {
    if (typeof document === 'undefined') {
      return null;
    }

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
    drawChartOps(ctx, chartOps.under, scaleX, scaleY);
    drawOps(ctx, ops, scaleX, scaleY);
    drawChartOps(ctx, chartOps.over, scaleX, scaleY);
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
  // - For each province with known owner, for each side on the lattice boundary: emit band op.
  //   Boundary membership comes from the pre-jitter lattice cell (p.x, p.y), never from
  //   the jittered polygon coordinates (Cycle 23 Step 7c).
  // - Same-owner edges and unknown-unknown edges emit nothing.
  // - Sorted fills, then bands, then fronts; by province id, then edge a then b.
  function buildStateOps(geom, view) {
    var ops = [];
    var ownerLookup = buildOwnerLookup(view);
    var provinceById = {};
    geom.provinces.forEach(function (p) { provinceById[p.id] = p; });

    // Helper to convert polygon array to flat array of coordinates
    function polygonToFlat(polygon) {
      var flat = [];
      for (var i = 0; i < polygon.length; i++) {
        flat.push(polygon[i].x, polygon[i].y);
      }
      return flat;
    }

    // Helper to convert path array to flat array
    function pathToFlat(path) {
      var flat = [];
      for (var i = 0; i < path.length; i++) {
        flat.push(path[i].x, path[i].y);
      }
      return flat;
    }

    // 0. One ownership fill per province with a known owner (Cycle 23 Step 7c)
    geom.provinces.forEach(function (p) {
      var owner = ownerLookup[p.id];
      if (!owner) return;
      ops.push({ kind: 'fill', provinceId: p.id, owner: owner, polygon: polygonToFlat(p.polygon) });
    });

    // 1. Process interior edges (from geom.edges)
    geom.edges.forEach(function (e) {
      var oa = ownerLookup[e.a];
      var ob = ownerLookup[e.b];

      if (oa && ob) {
        if (oa !== ob) {
          // Different known owners: front line + two band ops
          ops.push({ kind: 'front', a: e.a, b: e.b, path: pathToFlat(e.path) });
          var polyA = polygonToFlat(provinceById[e.a].polygon);
          ops.push({ kind: 'band', provinceId: e.a, owner: oa, doubled: (oa === 'enemy'), path: pathToFlat(e.path), polygon: polyA });
          var polyB = polygonToFlat(provinceById[e.b].polygon);
          ops.push({ kind: 'band', provinceId: e.b, owner: ob, doubled: (ob === 'enemy'), path: pathToFlat(e.path), polygon: polyB });
        }
        // Same owner: nothing
      } else if (oa && !ob) {
        // Only a has known owner: band for a
        var polyA = polygonToFlat(provinceById[e.a].polygon);
        ops.push({ kind: 'band', provinceId: e.a, owner: oa, doubled: (oa === 'enemy'), path: pathToFlat(e.path), polygon: polyA });
      } else if (!oa && ob) {
        // Only b has known owner: band for b
        var polyB = polygonToFlat(provinceById[e.b].polygon);
        ops.push({ kind: 'band', provinceId: e.b, owner: ob, doubled: (ob === 'enemy'), path: pathToFlat(e.path), polygon: polyB });
      }
      // Neither known: nothing
    });

    // 2. Process map boundary segments for provinces with known owners
    // Dedupe identical segments within a province
    var seenBoundary = {};
    geom.provinces.forEach(function (p) {
      var owner = ownerLookup[p.id];
      if (!owner) return;

      var poly = p.polygon;
      var flatPoly = polygonToFlat(poly);

      // Polygon has 8 points: TL(0), topMid(1), TR(2), rightMid(3), BR(4), bottomMid(5), BL(6), leftMid(7)
      // Segments: 0-1 (top), 2-3 (right), 4-5 (bottom), 6-7 (left)
      // A side is on the map boundary when its lattice cell sits on that edge of the grid.
      var segments = [
        { p1: poly[0], p2: poly[1], onBoundary: p.y === 0 },             // top
        { p1: poly[2], p2: poly[3], onBoundary: p.x === geom.mapW - 1 }, // right
        { p1: poly[4], p2: poly[5], onBoundary: p.y === geom.mapH - 1 }, // bottom
        { p1: poly[6], p2: poly[7], onBoundary: p.x === 0 }              // left
      ];

      segments.forEach(function (seg) {
        if (seg.onBoundary) {
          var key = p.id + ':' + seg.p1.x.toFixed(4) + ',' + seg.p1.y.toFixed(4) + '-' + seg.p2.x.toFixed(4) + ',' + seg.p2.y.toFixed(4);
          if (!seenBoundary[key]) {
            seenBoundary[key] = true;
            var path = [seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y];
            ops.push({ kind: 'band', provinceId: p.id, owner: owner, doubled: (owner === 'enemy'), path: path, polygon: flatPoly });
          }
        }
      });
    });

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

  // Fog layer constants (Cycle 23 Step 8). Fog is texture and value, never
  // darkness: the Unknown fill is the lightest state (luma band D, 185 to
  // 225), the remembered gray sits in band C (120 to 175). The mist color
  // is itself under 225 luma, so any mist over the Unknown fill stays in
  // band D however many wisps and puffs overlap.
  var FOG_UNKNOWN_FILL = '#DCCDA8';
  var FOG_REMEMBERED_FILL = '#9E9E97';
  var FOG_MIST = '#EFE7D3';
  var FOG_WISP_ALPHA = 0.3;
  var FOG_PUFF_ALPHA = 0.25;
  var FOG_HATCH_INK = '#1e1a12';
  var FOG_HATCH_ALPHA = 0.35;
  var FOG_HATCH_SPACING = 0.12;
  var FOG_HATCH_W = 1.5;
  var FOG_BAND_GRAY = '#6E6E66';
  var FOG_BAND_ALPHA = 0.5;
  var FOG_WISPS = 3;
  var FOG_PUFFS = 4;

  // mulberry32 PRNG, seeded by a 32-bit unsigned integer (same as map-geometry.js).
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var z = Math.imul(t ^ (t >>> 15), 1 | t);
      z = Math.imul(z ^ (z >>> 7), 61 | t);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clampTo(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // Trace a flat polygon as the current path.
  function tracePolygon(ctx, poly, scaleX, scaleY) {
    ctx.beginPath();
    ctx.moveTo(poly[0] * scaleX, poly[1] * scaleY);
    for (var i = 2; i < poly.length; i += 2) {
      ctx.lineTo(poly[i] * scaleX, poly[i + 1] * scaleY);
    }
    ctx.closePath();
  }

  // Build fog operations from geometry and view.
  // Reads ONLY geom polygons and view.provinces (id, intel, snapshot).
  // Dark provinces emit an 'unknown' op with deterministic mist wisps and
  // border puffs; remembered provinces emit a 'remembered' op carrying the
  // snapshot owner; live provinces emit nothing. Sorted by province id.
  function buildFogOps(geom, view) {
    var ops = [];
    var geomById = {};
    geom.provinces.forEach(function (p) { geomById[p.id] = p; });
    var mapW = geom.mapW;
    var mapH = geom.mapH;

    view.provinces.forEach(function (vp) {
      if (vp.intel !== 'dark' && vp.intel !== 'remembered') return;
      var gp = geomById[vp.id];
      if (!gp) return;
      var poly = gp.polygon;
      var flat = [];
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < poly.length; i++) {
        flat.push(poly[i].x, poly[i].y);
        if (poly[i].x < minX) minX = poly[i].x;
        if (poly[i].y < minY) minY = poly[i].y;
        if (poly[i].x > maxX) maxX = poly[i].x;
        if (poly[i].y > maxY) maxY = poly[i].y;
      }

      if (vp.intel === 'remembered') {
        ops.push({
          kind: 'remembered',
          id: vp.id,
          polygon: flat,
          snapshotOwner: vp.snapshot ? vp.snapshot.owner : null,
          hatch: true,
          hatchAnchor: [gp.x + 0.5, gp.y + 0.5]
        });
        return;
      }

      var rng = mulberry32(fnv1a('fog:' + vp.id));
      // Wisps: inside the polygon bbox shrunk 15 percent on each side,
      // clamped to the board.
      var bw = maxX - minX;
      var bh = maxY - minY;
      var sx0 = minX + bw * 0.15, sx1 = maxX - bw * 0.15;
      var sy0 = minY + bh * 0.15, sy1 = maxY - bh * 0.15;
      var wisps = [];
      for (var w = 0; w < FOG_WISPS; w++) {
        wisps.push({
          x: clampTo(sx0 + rng() * (sx1 - sx0), 0, mapW),
          y: clampTo(sy0 + rng() * (sy1 - sy0), 0, mapH),
          rx: 0.14 + rng() * 0.10,
          ry: 0.05 + rng() * 0.05
        });
      }
      // Puffs: points along the polygon perimeter, clamped to the board.
      var puffs = [];
      var n = poly.length;
      for (var k = 0; k < FOG_PUFFS; k++) {
        var seg = Math.floor(rng() * n) % n;
        var t = rng();
        var a = poly[seg];
        var b = poly[(seg + 1) % n];
        puffs.push({
          x: clampTo(a.x + (b.x - a.x) * t, 0, mapW),
          y: clampTo(a.y + (b.y - a.y) * t, 0, mapH),
          r: 0.05 + rng() * 0.04
        });
      }
      ops.push({ kind: 'unknown', id: vp.id, polygon: flat, wisps: wisps, puffs: puffs });
    });

    ops.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    return ops;
  }

  // Draw fog operations on a canvas context. Live provinces have no op,
  // so the canvas stays transparent over them.
  // scaleX, scaleY: device pixels per cell-space unit.
  function drawFogOps(ctx, ops, scaleX, scaleY) {
    var bandW = 0.01875 * scaleX;

    ops.forEach(function (op) {
      var poly = op.polygon;
      if (!poly || poly.length < 6) return;

      if (op.kind === 'unknown') {
        ctx.save();
        tracePolygon(ctx, poly, scaleX, scaleY);
        ctx.clip();
        ctx.globalAlpha = 1;
        ctx.fillStyle = FOG_UNKNOWN_FILL;
        tracePolygon(ctx, poly, scaleX, scaleY);
        ctx.fill();

        ctx.fillStyle = FOG_MIST;
        ctx.globalAlpha = FOG_WISP_ALPHA;
        op.wisps.forEach(function (w) {
          ctx.beginPath();
          ctx.ellipse(w.x * scaleX, w.y * scaleY, w.rx * scaleX, w.ry * scaleY, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = FOG_PUFF_ALPHA;
        op.puffs.forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p.x * scaleX, p.y * scaleY, p.r * scaleX, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      } else if (op.kind === 'remembered') {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < poly.length; i += 2) {
          if (poly[i] < minX) minX = poly[i];
          if (poly[i] > maxX) maxX = poly[i];
          if (poly[i + 1] < minY) minY = poly[i + 1];
          if (poly[i + 1] > maxY) maxY = poly[i + 1];
        }

        ctx.save();
        tracePolygon(ctx, poly, scaleX, scaleY);
        ctx.clip();
        ctx.globalAlpha = 1;
        ctx.fillStyle = FOG_REMEMBERED_FILL;
        tracePolygon(ctx, poly, scaleX, scaleY);
        ctx.fill();

        if (op.hatch) {
          // Diagonal hatch lines x - y = c, phased so the province cell
          // centre falls midway between two lines and reads the flat fill.
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
          ctx.strokeStyle = FOG_HATCH_INK;
          ctx.globalAlpha = FOG_HATCH_ALPHA;
          ctx.lineWidth = FOG_HATCH_W;
          ctx.stroke();
        }
        ctx.restore();

        // Gray band standing in for the last known owner band.
        ctx.save();
        tracePolygon(ctx, poly, scaleX, scaleY);
        ctx.strokeStyle = FOG_BAND_GRAY;
        ctx.globalAlpha = FOG_BAND_ALPHA;
        ctx.lineWidth = bandW;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // FNV-1a hash of a canonical string built from fog ops.
  function fogOpsHash(ops) {
    var parts = [];
    function pushNum(v) { parts.push(v.toFixed(4)); }
    ops.forEach(function (op) {
      parts.push(op.kind);
      parts.push(String(op.id));
      if (op.kind === 'remembered') {
        parts.push(op.snapshotOwner === null ? '' : String(op.snapshotOwner));
        parts.push(op.hatch ? '1' : '0');
        if (op.hatchAnchor) { pushNum(op.hatchAnchor[0]); pushNum(op.hatchAnchor[1]); }
      }
      for (var i = 0; i < op.polygon.length; i++) pushNum(op.polygon[i]);
      if (op.wisps) {
        op.wisps.forEach(function (w) { pushNum(w.x); pushNum(w.y); pushNum(w.rx); pushNum(w.ry); });
      }
      if (op.puffs) {
        op.puffs.forEach(function (p) { pushNum(p.x); pushNum(p.y); pushNum(p.r); });
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
    drawFogOps(ctx, ops, scaleX, scaleY);
    ctx.restore();

    var hash = fogOpsHash(ops);

    return {
      canvas: canvas,
      width: canvas.width,
      height: canvas.height,
      hash: hash,
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
    FOG_MIST: FOG_MIST,
    FOG_WISP_ALPHA: FOG_WISP_ALPHA,
    FOG_PUFF_ALPHA: FOG_PUFF_ALPHA,
    buildFogOps: buildFogOps,
    drawFogOps: drawFogOps,
    fogOpsHash: fogOpsHash,
    renderFogCanvas: renderFogCanvas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesMapCanvas;
  }
  global.AshesMapCanvas = AshesMapCanvas;
})(typeof window !== 'undefined' ? window : globalThis);