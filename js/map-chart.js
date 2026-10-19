// Ashes of Empires, chart frame, coastline, aprons, and hit polygons (Cycle 23 Step 9).
// Builds the sea chart around the province lattice from a geometry object.
// Loadable in node (module.exports) and in the browser (global.AshesChart).
// Reads ONLY a geometry object (the output of AshesMapGeometry.buildGeometry).
// Never requires js/sim.js, never calls any sim function, and never mutates geom.
(function (global) {
  'use strict';

  // Chart frame constants for the standard 10 by 7 map (MAP_TREATMENT 1.1).
  var SEA_MARGIN = 1.0;
  var BORDER_SIDE = 0.30;
  var BORDER_FOOT = 0.55;
  var EXTENT = { x0: -1.3, y0: -1.3, x1: 11.3, y1: 8.55 };
  var NEATLINE = { x0: -1.0, y0: -1.0, x1: 11.0, y1: 8.0 };
  var WIDTH_CELLS = 12.6;
  var HEIGHT_CELLS = 9.85;
  var INSET_X = 1.3;
  var INSET_Y = 1.3;

  // Palette (MAP_TREATMENT 0.2).
  var SEA_DEEP = '#3E5A66';
  var SEA_MID = '#4C6973';
  var SEA_SHELF = '#5B7880';
  var SEA_SHORE = '#6A878C';
  var LAND_LOW = '#7E8158';
  var BEACH = '#B9AA80';
  var FRAME_PAPER = '#E6D8B5';
  var INK = '#2B2620';
  var RIVER_WATER = '#6F8C8F';
  var RIVER_BANK = '#4A4335';
  var RIVER_GLINT = '#8FA6A3';
  var LAND_HIGH = '#8A7A58';
  var CONTOUR = '#5A4A36';
  var SHADE_DARK = '#2B2620';
  var SHADE_LIGHT = '#F3EAD2';

  // Relief parameters (MAP_TREATMENT 3.2 to 3.6).
  var RELIEF_RES = 16;
  var RELIEF_Z = 3.0;
  var RELIEF_LIGHT = { x: -0.5, y: -0.5, z: 0.7071 };
  var RELIEF_LEVELS = [0.30, 0.55, 0.80];
  var RELIEF_MIN_CONTOUR = 0.25;
  var RELIEF_RIVER_CLEAR = 0.06;
  var RESERVE_RX = 0.45;
  var RESERVE_RY = 0.11;
  var ANCHOR_LIFT = 0.30;
  var FAIRNESS_MAX = 0.08;
  var SALT_MAX = 15;
  var BEYOND_RUGGEDNESS = 0.6;

  // River parameters (MAP_TREATMENT 2.3 and 2.5).
  var W_SRC = 0.055;
  var W_MOUTH = 0.100;
  var RIVER_FULL_LEN = 6.0;
  var RIVER_STEP = 0.04;
  var ESTUARY_LEN = 0.15;
  var ESTUARY_WIDEN = 1.8;
  var FAN_OFFSET = 0.10;
  var FAN_RX = 0.22;
  var FAN_RY = 0.12;

  // Coastline parameters (MAP_TREATMENT 1.3).
  var COAST_STEP = 0.05;
  var ARC_SAMPLES = 8;
  var NOISE_OCTAVES = 4;
  var NOISE_WAVELENGTH = 2.2;
  var NOISE_GAIN = 0.5;
  var RAMP_LEN = 0.50;
  var COAST_FLOOR_WINDOW = 0.20;
  var COAST_FLOOR_MARGIN = 0.08;

  // Wave mark parameters (MAP_TREATMENT 1.6).
  var WAVE_SPACING = 0.40;
  var WAVE_JITTER = 0.12;
  var WAVE_CLEAR = 0.45;

  // FNV-1a 32-bit hash (same algorithm as map-geometry.js).
  function fnv1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  // mulberry32 PRNG (same as map-geometry.js).
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var z = Math.imul(t ^ (t >>> 15), 1 | t);
      z = Math.imul(z ^ (z >>> 7), 61 | t);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // Point in polygon via ray casting (even-odd rule), own copy.
  function pointInPolygon(pt, polygon) {
    var x = pt.x;
    var y = pt.y;
    var inside = false;
    var n = polygon.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = polygon[i].x;
      var yi = polygon[i].y;
      var xj = polygon[j].x;
      var yj = polygon[j].y;
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Distance from point (px, py) to segment (ax, ay)-(bx, by).
  function distToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    var qx = ax + t * dx - px;
    var qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }

  // chartSeed: FNV-1a over every province polygon coordinate, toFixed(4),
  // provinces in geom.provinces order, points in polygon order.
  function computeChartSeed(geom) {
    var parts = [];
    geom.provinces.forEach(function (p) {
      p.polygon.forEach(function (pt) {
        parts.push(pt.x.toFixed(4), pt.y.toFixed(4));
      });
    });
    return fnv1a(parts.join('|'));
  }

  // 1D fractal value noise in [-1, 1] that wraps at perimeter length L.
  function makeNoise(chartSeed, L) {
    var octaves = [];
    var ampSum = 0;
    for (var k = 0; k < NOISE_OCTAVES; k++) {
      var wavelength = NOISE_WAVELENGTH / Math.pow(2, k);
      var count = Math.max(1, Math.round(L / wavelength));
      var rng = mulberry32(fnv1a(chartSeed + ':coast:' + k));
      var values = [];
      for (var i = 0; i < count; i++) values.push(rng() * 2 - 1);
      var amp = Math.pow(NOISE_GAIN, k);
      ampSum += amp;
      octaves.push({ count: count, spacing: L / count, values: values, amp: amp });
    }
    return function (t) {
      var sum = 0;
      for (var k = 0; k < octaves.length; k++) {
        var o = octaves[k];
        var u = t / o.spacing;
        var i0 = Math.floor(u);
        var f = u - i0;
        var s = f * f * (3 - 2 * f);
        var a = o.values[((i0 % o.count) + o.count) % o.count];
        var b = o.values[(((i0 + 1) % o.count) + o.count) % o.count];
        sum += o.amp * (a + (b - a) * s);
      }
      return sum / ampSum;
    };
  }

  // Outward normal of each side.
  var SIDE_NORMAL = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
  };

  // Polygon point indices of the two segments on each side.
  var SIDE_SEGS = {
    top: [[0, 1], [1, 2]],
    right: [[2, 3], [3, 4]],
    bottom: [[4, 5], [5, 6]],
    left: [[6, 7], [7, 0]]
  };

  // Boundary segments in clockwise perimeter order from the top left,
  // each with its interval [t0, t1] on the lattice rectangle perimeter.
  function buildBoundarySegments(geom) {
    var W = geom.mapW;
    var H = geom.mapH;
    var byCoord = {};
    geom.provinces.forEach(function (p) { byCoord[p.x + ':' + p.y] = p; });
    var segs = [];

    function pushSide(p, side, tStart) {
      var pairs = SIDE_SEGS[side];
      for (var s = 0; s < 2; s++) {
        segs.push({
          provinceId: p.id,
          key: p.id + ':' + side + ':' + s,
          side: side,
          segIndex: s,
          p1: p.polygon[pairs[s][0]],
          p2: p.polygon[pairs[s][1]],
          coastal: !!p.coastal,
          sea: !!p.coastal,
          t0: tStart + 0.5 * s,
          t1: tStart + 0.5 * (s + 1)
        });
      }
    }

    var x, y;
    for (x = 0; x < W; x++) pushSide(byCoord[x + ':0'], 'top', x);
    for (y = 0; y < H; y++) pushSide(byCoord[(W - 1) + ':' + y], 'right', W + y);
    for (x = W - 1; x >= 0; x--) pushSide(byCoord[x + ':' + (H - 1)], 'bottom', W + H + (W - 1 - x));
    for (y = H - 1; y >= 0; y--) pushSide(byCoord['0:' + y], 'left', 2 * W + H + (H - 1 - y));
    return segs;
  }

  // Rectangle point and outward normal at perimeter parameter t (not at a corner).
  function rectPoint(t, W, H) {
    if (t <= W) return { x: t, y: 0, side: 'top' };
    if (t <= W + H) return { x: W, y: t - W, side: 'right' };
    if (t <= 2 * W + H) return { x: W - (t - W - H), y: H, side: 'bottom' };
    return { x: 0, y: H - (t - 2 * W - H), side: 'left' };
  }

  // Lattice lookup for hitTest: cell to province, original polygons, and
  // edge neighbours in geom.edges order (as AshesMapGeometry.hitTest walks them).
  function buildLattice(geom) {
    var byCell = {};
    var polygons = {};
    var neighbours = {};
    geom.provinces.forEach(function (p) {
      byCell[p.x + ':' + p.y] = p.id;
      polygons[p.id] = p.polygon.map(function (q) { return { x: q.x, y: q.y }; });
      neighbours[p.id] = [];
    });
    geom.edges.forEach(function (e) {
      if (neighbours[e.a]) neighbours[e.a].push(e.b);
      if (neighbours[e.b]) neighbours[e.b].push(e.a);
    });
    return { byCell: byCell, polygons: polygons, neighbours: neighbours };
  }

  // Single entry memo cache. The chart is a pure function of the static map
  // layout (province polygons, cell positions, coastal flags, edge paths), and
  // buildChart runs on every render, so a repeat call with the same layout
  // returns the SAME chart object. Callers (js/main.js, js/map-canvas.js)
  // treat the chart as read only, so sharing the object is safe; do not
  // mutate a returned chart.
  var chartCache = null;

  // Layout key: chartSeed plus each province's id, x, y, and coastal flag
  // in geom.provinces order, plus every river segment path (Step 10).
  function chartLayoutKey(geom, chartSeed) {
    var parts = [String(chartSeed)];
    geom.provinces.forEach(function (p) {
      parts.push(p.id + ',' + p.x + ',' + p.y + ',' + (p.coastal ? 1 : 0));
    });
    (geom.riverSegments || []).forEach(function (rs) {
      parts.push('r' + rs.a + ',' + rs.b + rs.path.map(function (q) {
        return ',' + q.x.toFixed(6) + ',' + q.y.toFixed(6);
      }).join(''));
    });
    return parts.join('|');
  }

  // Polyline length of a path of {x, y} points.
  function polylineLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return len;
  }

  // Points along a polyline from its start, consecutive points at most
  // RIVER_STEP apart. Each point carries s, its arc length from the start.
  function subdividePath(path) {
    var out = [];
    if (path.length === 0) return out;
    var s = 0;
    out.push({ x: path[0].x, y: path[0].y, s: 0 });
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1];
      var b = path[i];
      var segLen = Math.hypot(b.x - a.x, b.y - a.y);
      var n = Math.max(1, Math.ceil(segLen / RIVER_STEP));
      for (var k = 1; k <= n; k++) {
        var t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: s + segLen * t });
      }
      s += segLen;
    }
    return out;
  }

  // River width at accumulated upstream length A (MAP_TREATMENT 2.3).
  function riverWidth(A) {
    return W_SRC + (W_MOUTH - W_SRC) * Math.pow(Math.min(1, A / RIVER_FULL_LEN), 0.6);
  }

  // River graph, flow, widths, mouth extensions, and estuary fans
  // (MAP_TREATMENT 2.1 to 2.5). Reads geom.riverSegments, dividerAt (grid
  // corner key to coastline point), and the coastline (pseudo mouth choice).
  function buildRivers(geom, dividerAt, coastline) {
    var W = geom.mapW;
    var H = geom.mapH;
    var segments = geom.riverSegments || [];
    var nodes = [];
    var adj = [];

    // 2.2 nodes: path endpoints merged within 1e-6 cell.
    function nodeFor(q) {
      for (var i = 0; i < nodes.length; i++) {
        if (Math.abs(nodes[i].x - q.x) <= 1e-6 && Math.abs(nodes[i].y - q.y) <= 1e-6) return i;
      }
      var gx = Math.round(q.x);
      var gy = Math.round(q.y);
      var boundary = gx === 0 || gx === W || gy === 0 || gy === H;
      var key = boundary ? gx + ':' + gy : q.x.toFixed(6) + ',' + q.y.toFixed(6);
      nodes.push({
        x: q.x,
        y: q.y,
        key: key,
        D: Infinity,
        mouth: boundary && !!dividerAt[gx + ':' + gy],
        source: false
      });
      adj.push([]);
      return nodes.length - 1;
    }

    var edgeData = segments.map(function (rs, ei) {
      var path = rs.path;
      var na = nodeFor(path[0]);
      var nb = nodeFor(path[path.length - 1]);
      var length = polylineLength(path);
      adj[na].push({ node: nb, edge: ei, len: length });
      adj[nb].push({ node: na, edge: ei, len: length });
      return { a: rs.a, b: rs.b, start: na, end: nb, length: length, path: path };
    });

    // Connected components.
    var comp = nodes.map(function () { return -1; });
    var nComp = 0;
    nodes.forEach(function (n0, i0) {
      if (comp[i0] >= 0) return;
      var stack = [i0];
      comp[i0] = nComp;
      while (stack.length) {
        var u = stack.pop();
        adj[u].forEach(function (nb) {
          if (comp[nb.node] < 0) { comp[nb.node] = nComp; stack.push(nb.node); }
        });
      }
      nComp++;
    });

    // Pseudo mouth for a component with no mouth: its degree 1 node closest
    // to the coastline (ties: lower y, then lower x). No estuary.
    function coastDist(q) {
      var best = Infinity;
      for (var i = 0; i < coastline.length; i++) {
        var a = coastline[i];
        var b = coastline[(i + 1) % coastline.length];
        var d = distToSegment(q.x, q.y, a.x, a.y, b.x, b.y);
        if (d < best) best = d;
      }
      return best;
    }
    var seeds = [];
    for (var ci = 0; ci < nComp; ci++) {
      var members = [];
      nodes.forEach(function (n1, i1) { if (comp[i1] === ci) members.push(i1); });
      var mouths = members.filter(function (i2) { return nodes[i2].mouth; });
      if (mouths.length) { seeds = seeds.concat(mouths); continue; }
      var ends = members.filter(function (i3) { return adj[i3].length === 1; });
      if (!ends.length) ends = members;
      var bestI = -1;
      var bestD = Infinity;
      ends.forEach(function (i4) {
        var d = coastDist(nodes[i4]);
        var n4 = nodes[i4];
        if (bestI < 0 || d < bestD ||
          (d === bestD && (n4.y < nodes[bestI].y || (n4.y === nodes[bestI].y && n4.x < nodes[bestI].x)))) {
          bestI = i4;
          bestD = d;
        }
      });
      seeds.push(bestI);
    }

    // 2.2 flow rule 1: multi source Dijkstra from the mouths.
    var done = nodes.map(function () { return false; });
    seeds.forEach(function (i5) { nodes[i5].D = 0; });
    for (;;) {
      var u = -1;
      for (var i6 = 0; i6 < nodes.length; i6++) {
        if (!done[i6] && nodes[i6].D < Infinity && (u < 0 || nodes[i6].D < nodes[u].D)) u = i6;
      }
      if (u < 0) break;
      done[u] = true;
      adj[u].forEach(function (nb) {
        var nd = nodes[u].D + nb.len;
        if (nd < nodes[nb.node].D) nodes[nb.node].D = nd;
      });
    }

    // 2.2 flow rule 2: from the higher D end; ties flow toward lower y, then lower x.
    function downstreamOf(i, j) {
      var p = nodes[i];
      var q = nodes[j];
      if (p.D !== q.D) return p.D < q.D ? i : j;
      if (p.y !== q.y) return p.y < q.y ? i : j;
      return p.x <= q.x ? i : j;
    }
    edgeData.forEach(function (e) {
      e.to = downstreamOf(e.start, e.end);
      e.from = e.to === e.start ? e.end : e.start;
    });

    // 2.2 flow rule 3: sources have no neighbour of higher D.
    nodes.forEach(function (n7, i7) {
      n7.source = !adj[i7].some(function (nb) { return nodes[nb.node].D > n7.D; });
    });

    // 2.3: accumulated upstream length per node, every edge upstream counted once.
    var inEdges = nodes.map(function () { return []; });
    edgeData.forEach(function (e, ei) { inEdges[e.to].push(ei); });
    var accum = nodes.map(function (n8, i8) {
      var seen = {};
      var total = 0;
      var stack = [i8];
      while (stack.length) {
        var v = stack.pop();
        inEdges[v].forEach(function (ei) {
          if (seen[ei]) return;
          seen[ei] = true;
          total += edgeData[ei].length;
          stack.push(edgeData[ei].from);
        });
      }
      return total;
    });

    var edges = edgeData.map(function (e) {
      var forward = e.from === e.start;
      var aUp = accum[e.from];
      var samples = subdividePath(e.path).map(function (q) {
        var sUp = forward ? q.s : e.length - q.s;
        return { x: q.x, y: q.y, w: riverWidth(aUp + sUp) };
      });
      return { a: e.a, b: e.b, from: e.from, to: e.to, length: e.length, samples: samples };
    });

    // 2.5: mouth extensions along the divider ray, and estuary fans.
    var mouthList = [];
    var fans = [];
    nodes.forEach(function (n9, i9) {
      if (!n9.mouth) return;
      var coast = dividerAt[n9.key];
      var dx = coast.x - n9.x;
      var dy = coast.y - n9.y;
      var len = Math.hypot(dx, dy);
      var ux = len > 0 ? dx / len : 0;
      var uy = len > 0 ? dy / len : 0;
      var samples = subdividePath([{ x: n9.x, y: n9.y }, { x: coast.x, y: coast.y }]).map(function (q) {
        var into = q.s - (len - ESTUARY_LEN);
        var w = into > 0 ? W_MOUTH * (1 + (ESTUARY_WIDEN - 1) * Math.min(1, into / ESTUARY_LEN)) : W_MOUTH;
        return { x: q.x, y: q.y, w: w };
      });
      mouthList.push({ node: i9, x: n9.x, y: n9.y, coastX: coast.x, coastY: coast.y, samples: samples });
      fans.push({
        cx: coast.x + FAN_OFFSET * ux,
        cy: coast.y + FAN_OFFSET * uy,
        rx: FAN_RX,
        ry: FAN_RY,
        angle: Math.atan2(uy, ux)
      });
    });

    return { nodes: nodes, edges: edges, mouths: mouthList, fans: fans };
  }

  // ---------- Relief (Cycle 23 Step 11, MAP_TREATMENT 3) ----------
  // Decorative presentation only: no sim number, order, or outcome reads it.

  function smoothstep(e0, e1, v) {
    var t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hexRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Two pass 3-4 chamfer distance transform over a w by h grid, in place.
  // dist holds 0 at seed cells and a large value elsewhere. When label is
  // given, every improvement copies the label of the neighbour it came from,
  // so each cell ends up carrying the label of the seed its chamfer path
  // started at. That seed is the nearest one up to the chamfer metric error
  // (under 8 percent), which is the same approximation the distance itself
  // makes, so the label and the distance always agree with each other.
  function chamfer(dist, label, w, h) {
    var i, j, k, v;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        k = j * w + i;
        if (i > 0) { v = dist[k - 1] + 3; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k - 1]; } }
        if (j > 0) {
          v = dist[k - w] + 3; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k - w]; }
          if (i > 0) { v = dist[k - w - 1] + 4; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k - w - 1]; } }
          if (i < w - 1) { v = dist[k - w + 1] + 4; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k - w + 1]; } }
        }
      }
    }
    for (j = h - 1; j >= 0; j--) {
      for (i = w - 1; i >= 0; i--) {
        k = j * w + i;
        if (i < w - 1) { v = dist[k + 1] + 3; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k + 1]; } }
        if (j < h - 1) {
          v = dist[k + w] + 3; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k + w]; }
          if (i < w - 1) { v = dist[k + w + 1] + 4; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k + w + 1]; } }
          if (i > 0) { v = dist[k + w - 1] + 4; if (v < dist[k]) { dist[k] = v; if (label) label[k] = label[k + w - 1]; } }
        }
      }
    }
  }

  // Starting owners at tick 0: js/sim.js newGame deals provinces west to
  // east, player when p.x < mapW / 2, enemy otherwise. A presentation test
  // pins this partition against a fresh sim game.
  function startingOwner(geom, p) {
    return p.x < geom.mapW / 2 ? 'player' : 'enemy';
  }

  // Per province ruggedness with the fairness salt (MAP_TREATMENT 3.3).
  function buildRuggedness(geom, chartSeed) {
    var best = null;
    for (var salt = 0; salt <= SALT_MAX; salt++) {
      var rug = {};
      var sum = { player: 0, enemy: 0 };
      var cnt = { player: 0, enemy: 0 };
      geom.provinces.forEach(function (p) {
        var u = mulberry32(fnv1a(chartSeed + ':rug:' + salt + ':' + p.id))();
        var r = 0.25 + 0.75 * u;
        rug[p.id] = r;
        var o = startingOwner(geom, p);
        sum[o] += r;
        cnt[o]++;
      });
      var mean = {
        player: cnt.player ? sum.player / cnt.player : 0,
        enemy: cnt.enemy ? sum.enemy / cnt.enemy : 0
      };
      var diff = Math.abs(mean.player - mean.enemy);
      if (!best || diff < best.diff) best = { salt: salt, ruggedness: rug, mean: mean, diff: diff };
      if (diff <= FAIRNESS_MAX) break;
    }
    return best;
  }

  // Relief: height grid, distance fields, shade raster, contours, label
  // reserves. A pure function of geom, the coastline, and the river graph,
  // deterministic by chartSeed. Heights and fields are Float32Arrays
  // (compact, and the raster and tests index them flat, row major).
  function buildRelief(geom, coastline, rivers, chartSeed, neatline) {
    var W = geom.mapW;
    var H = geom.mapH;
    var RES = RELIEF_RES;
    var g = 1 / RES;
    var x0 = neatline.x0;
    var y0 = neatline.y0;
    var gw = Math.round((neatline.x1 - neatline.x0) * RES);
    var gh = Math.round((neatline.y1 - neatline.y0) * RES);
    var N = gw * gh;
    var BIG = 1e9;
    var i, j, k, q;

    function sx(ii) { return x0 + (ii + 0.5) * g; }
    function sy(jj) { return y0 + (jj + 0.5) * g; }
    function cellIndex(x, y) {
      var ii = clamp(Math.floor((x - x0) * RES), 0, gw - 1);
      var jj = clamp(Math.floor((y - y0) * RES), 0, gh - 1);
      return jj * gw + ii;
    }

    // Land mask: scanline even-odd fill over grid rows, O(rows x segments).
    var land = new Uint8Array(N);
    var nc = coastline.length;
    for (j = 0; j < gh; j++) {
      var yy = sy(j);
      var xs = [];
      for (q = 0; q < nc; q++) {
        var ca = coastline[q];
        var cb = coastline[(q + 1) % nc];
        if ((ca.y > yy) !== (cb.y > yy)) xs.push(ca.x + (yy - ca.y) * (cb.x - ca.x) / (cb.y - ca.y));
      }
      xs.sort(function (a, b) { return a - b; });
      for (q = 0; q + 1 < xs.length; q += 2) {
        var iStart = Math.max(0, Math.ceil((xs[q] - x0) * RES - 0.5));
        var iEnd = Math.min(gw - 1, Math.floor((xs[q + 1] - x0) * RES - 0.5));
        for (i = iStart; i <= iEnd; i++) {
          var px = sx(i);
          if (px > xs[q] && px < xs[q + 1]) land[j * gw + i] = 1;
        }
      }
    }

    // Rasterise a polyline segment into seed cells at half a grid step.
    function seedSegment(dist, ax, ay, bx, by, onCell) {
      var n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (0.5 * g)));
      for (var s = 0; s <= n; s++) {
        var t = s / n;
        var kk = cellIndex(ax + (bx - ax) * t, ay + (by - ay) * t);
        dist[kk] = 0;
        if (onCell) onCell(kk, t);
      }
    }
    var CHAMFER_SCALE = g / 3;

    // dC: distance to the coastline.
    var dC = new Float32Array(N);
    dC.fill(BIG);
    for (q = 0; q < nc; q++) {
      var c1 = coastline[q];
      var c2 = coastline[(q + 1) % nc];
      seedSegment(dC, c1.x, c1.y, c2.x, c2.y, null);
    }
    chamfer(dC, null, gw, gh);
    for (k = 0; k < N; k++) dC[k] *= CHAMFER_SCALE;

    // River components, recomputed here from nodes and edges (union find).
    var nodes = rivers.nodes;
    var parent = nodes.map(function (n0, ni) { return ni; });
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    rivers.edges.forEach(function (e) {
      var ra = find(e.from);
      var rb = find(e.to);
      if (ra !== rb) parent[ra] = rb;
    });
    var compMaxD = {};
    nodes.forEach(function (n1, ni) {
      var r = find(ni);
      if (compMaxD[r] === undefined || n1.D > compMaxD[r]) compMaxD[r] = n1.D;
    });
    function dnOf(nodeIndex, D) {
      var m = compMaxD[find(nodeIndex)];
      return m > 0 ? clamp(D / m, 0, 1) : 0;
    }

    // dR: distance to the river centreline (3-4 chamfer, like dC), and Dn
    // of the nearest river point. A point on an edge has graph distance
    // min(Da + s, Db + len - s) from the mouth. The Dn label is carried by
    // a feature transform in the same two raster passes: each cell keeps
    // the river point (x, y, Dn) of a neighbour when that point is closer to
    // the cell centre by true Euclidean distance. Plain label copying along
    // chamfer paths left the label in row bands (the 3-4 metric breaks
    // ties along rows), and the valley floor term turned those bands into
    // visible stripes; the Euclidean feature transform gives the nearest
    // river point to within a sample almost everywhere, so Dn is smooth.
    var dR = new Float32Array(N);
    dR.fill(BIG);
    var riverDn = new Float32Array(N);
    var featX = new Float64Array(N);
    var featY = new Float64Array(N);
    var featD2 = new Float64Array(N);
    featD2.fill(Infinity);
    function seedRiverPoint(x, y, dn) {
      var kk = cellIndex(x, y);
      var ci = kk % gw;
      var cj = (kk - ci) / gw;
      var ex = x - sx(ci);
      var ey = y - sy(cj);
      var d2 = ex * ex + ey * ey;
      dR[kk] = 0;
      if (d2 < featD2[kk]) { featD2[kk] = d2; featX[kk] = x; featY[kk] = y; riverDn[kk] = dn; }
    }
    function seedRiverStroke(pts, dnAt) {
      for (var s = 1; s < pts.length; s++) {
        var a = pts[s - 1];
        var b = pts[s];
        var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (0.5 * g)));
        for (var t = 0; t <= n; t++) {
          var f = t / n;
          seedRiverPoint(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, dnAt(s - 1 + f));
        }
      }
    }
    rivers.edges.forEach(function (e) {
      var smp = e.samples;
      if (!smp.length) return;
      // Which node sits at the first sample: from or to.
      var nf = nodes[e.from];
      var nt = nodes[e.to];
      var firstIsFrom = Math.hypot(smp[0].x - nf.x, smp[0].y - nf.y) <= Math.hypot(smp[0].x - nt.x, smp[0].y - nt.y);
      var dFirst = firstIsFrom ? nf.D : nt.D;
      var dLast = firstIsFrom ? nt.D : nf.D;
      var arc = [0];
      for (var s = 1; s < smp.length; s++) arc.push(arc[s - 1] + Math.hypot(smp[s].x - smp[s - 1].x, smp[s].y - smp[s - 1].y));
      var len = arc[arc.length - 1];
      seedRiverStroke(smp, function (fi) {
        var i0 = Math.min(Math.floor(fi), smp.length - 1);
        var i1 = Math.min(i0 + 1, smp.length - 1);
        var sArc = arc[i0] + (arc[i1] - arc[i0]) * (fi - i0);
        return dnOf(e.from, Math.min(dFirst + sArc, dLast + len - sArc));
      });
    });
    // Mouth extension samples belong to their mouth node's component, D = 0.
    rivers.mouths.forEach(function (m) {
      seedRiverStroke(m.samples, function () { return 0; });
    });
    chamfer(dR, null, gw, gh);
    for (k = 0; k < N; k++) dR[k] *= CHAMFER_SCALE;
    function takeFeature(kk, from, cx, cy) {
      if (featD2[from] === Infinity) return;
      var ex = featX[from] - cx;
      var ey = featY[from] - cy;
      var d2 = ex * ex + ey * ey;
      if (d2 < featD2[kk]) { featD2[kk] = d2; featX[kk] = featX[from]; featY[kk] = featY[from]; riverDn[kk] = riverDn[from]; }
    }
    for (j = 0; j < gh; j++) {
      for (i = 0; i < gw; i++) {
        k = j * gw + i;
        if (i > 0) takeFeature(k, k - 1, sx(i), sy(j));
        if (j > 0) {
          takeFeature(k, k - gw, sx(i), sy(j));
          if (i > 0) takeFeature(k, k - gw - 1, sx(i), sy(j));
          if (i < gw - 1) takeFeature(k, k - gw + 1, sx(i), sy(j));
        }
      }
      for (i = gw - 2; i >= 0; i--) takeFeature(j * gw + i, j * gw + i + 1, sx(i), sy(j));
    }
    for (j = gh - 1; j >= 0; j--) {
      for (i = gw - 1; i >= 0; i--) {
        k = j * gw + i;
        if (i < gw - 1) takeFeature(k, k + 1, sx(i), sy(j));
        if (j < gh - 1) {
          takeFeature(k, k + gw, sx(i), sy(j));
          if (i < gw - 1) takeFeature(k, k + gw + 1, sx(i), sy(j));
          if (i > 0) takeFeature(k, k + gw - 1, sx(i), sy(j));
        }
      }
      for (i = 1; i < gw; i++) takeFeature(j * gw + i, j * gw + i - 1, sx(i), sy(j));
    }

    // dS: exact Euclidean distance to the nearest river source. Sources are
    // few (one per river head), so a direct loop per sample is cheap and
    // exact, and needs no chamfer.
    var sources = nodes.filter(function (n2) { return n2.source; });

    // Ruggedness, fairness salt, and r(P).
    var rugInfo = buildRuggedness(geom, chartSeed);
    var rugGrid = new Float32Array(W * H);
    geom.provinces.forEach(function (p) { rugGrid[p.y * W + p.x] = rugInfo.ruggedness[p.id]; });
    // Outside the lattice rectangle r is 0.6, reached 0.5 cell out; the
    // first 0.5 cell outside blends linearly from the clamped edge value to
    // 0.6. Deviation from the literal rule (0.6 at once outside): the jump
    // drew a straight ridge along the whole lattice edge in the hillshade.
    // Inside the lattice r is exactly the clamped bilinear rule.
    function rAt(x, y) {
      var out = Math.max(0 - x, x - W, 0 - y, y - H);
      if (out >= 0.5) return BEYOND_RUGGEDNESS;
      var r = rLattice(clamp(x, 0, W), clamp(y, 0, H));
      return out > 0 ? r + (BEYOND_RUGGEDNESS - r) * (out / 0.5) : r;
    }
    function rLattice(x, y) {
      var fx = clamp(x - 0.5, 0, W - 1);
      var fy = clamp(y - 0.5, 0, H - 1);
      var ix = Math.min(Math.floor(fx), W - 2);
      var iy = Math.min(Math.floor(fy), H - 2);
      var tx = fx - ix;
      var ty = fy - iy;
      var r00 = rugGrid[iy * W + ix];
      var r10 = rugGrid[iy * W + ix + 1];
      var r01 = rugGrid[(iy + 1) * W + ix];
      var r11 = rugGrid[(iy + 1) * W + ix + 1];
      return (r00 * (1 - tx) + r10 * tx) * (1 - ty) + (r01 * (1 - tx) + r11 * tx) * ty;
    }

    // Value noise lattices, one cached dense table per octave, so each
    // lattice point is hashed exactly once (caching changes no value).
    var octaves = [];
    for (var o = 0; o < 4; o++) {
      var freq = 0.9 * Math.pow(2, o);
      var lx0 = Math.floor(neatline.x0 * freq) - 1;
      var ly0 = Math.floor(neatline.y0 * freq) - 1;
      var lw = Math.ceil(neatline.x1 * freq) + 2 - lx0;
      var lh = Math.ceil(neatline.y1 * freq) + 2 - ly0;
      var table = new Float64Array(lw * lh);
      for (var ly = 0; ly < lh; ly++) {
        for (var lx = 0; lx < lw; lx++) {
          table[ly * lw + lx] = mulberry32(fnv1a(chartSeed + ':h:' + o + ':' + (lx + lx0) + ',' + (ly + ly0)))();
        }
      }
      octaves.push({ freq: freq, amp: Math.pow(0.5, o), x0: lx0, y0: ly0, w: lw, table: table });
    }
    function fbm(x, y) {
      var sum = 0;
      for (var oo = 0; oo < 4; oo++) {
        var oc = octaves[oo];
        var qx = x * oc.freq;
        var qy = y * oc.freq;
        var ix = Math.floor(qx);
        var iy = Math.floor(qy);
        var tx = qx - ix;
        var ty = qy - iy;
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        var b = (iy - oc.y0) * oc.w + (ix - oc.x0);
        var t = oc.table;
        var top = t[b] + (t[b + 1] - t[b]) * tx;
        var bot = t[b + oc.w] + (t[b + oc.w + 1] - t[b + oc.w]) * tx;
        sum += oc.amp * (top + (bot - top) * ty);
      }
      return sum / 1.875;
    }

    // Height (MAP_TREATMENT 3.3). Deviation from the literal formula, on
    // purpose: the valley floor term (hv + 0.02) is multiplied by the same
    // shore factor smoothstep(0, 0.45, dC) as raw. Taken literally, the
    // floor holds every shore at hv + 0.02 (0.08 to 0.32) and the 3.3
    // guarantee "h is 0 at the coast" fails along the whole coastline. With
    // the factor, the shore far from rivers comes down to 0 exactly, while
    // the mouth valley keeps its river level at the coast through the
    // hv * (1 - wv) term. Second deviation: the floor also fades out between
    // 0.6 and 1.2 cell from the river (reach). The floor exists to make the
    // valley (3.3: never below river level at 0.6 cell, which still holds
    // in full); left everywhere, it ties far ground to the level of a river
    // cells away, and the nearest river point jumps across bends, so the
    // floor drew straight stripes across the hillshade.
    var heights = new Float32Array(N);
    var nearestRiverDn = riverDn;
    for (j = 0; j < gh; j++) {
      var py = sy(j);
      for (i = 0; i < gw; i++) {
        k = j * gw + i;
        if (!land[k]) continue;
        var pxx = sx(i);
        var dc = dC[k];
        var dS = BIG;
        for (q = 0; q < sources.length; q++) {
          var sdx = pxx - sources[q].x;
          var sdy = py - sources[q].y;
          var dsq = Math.sqrt(sdx * sdx + sdy * sdy);
          if (dsq < dS) dS = dsq;
        }
        var shore = smoothstep(0, 0.45, dc);
        var base = 0.35 * smoothstep(0, 2.5, dc);
        var raw = base + 0.65 * rAt(pxx, py) * fbm(pxx, py) + (sources.length ? 0.25 * Math.exp(-(dS / 0.8) * (dS / 0.8)) : 0);
        raw = raw * shore;
        var hv = 0.06 + 0.24 * riverDn[k];
        var wv = smoothstep(0.05, 0.60, dR[k]);
        var reach = 1 - smoothstep(0.6, 1.2, dR[k]);
        var hh = hv * (1 - wv) + Math.max(raw, (hv + 0.02) * shore * reach) * wv;
        heights[k] = clamp(hh, 0, 1);
      }
    }

    // Label anchors and reserves (MAP_TREATMENT 3.6 and 5.5). The anchor is
    // the average of the polygon vertices (the 8 point polygon spreads its
    // jitter over corners and midpoints, so this tracks the drawn shape
    // better than geom center, which averages the four corners only), moved
    // up 0.30 cell. Names are drawn in Step 12.
    var labelReserves = geom.provinces.map(function (p) {
      var ax = 0;
      var ay = 0;
      p.polygon.forEach(function (pt) { ax += pt.x; ay += pt.y; });
      ax /= p.polygon.length;
      ay /= p.polygon.length;
      return { id: p.id, x: ax, y: ay - ANCHOR_LIFT, rx: RESERVE_RX, ry: RESERVE_RY };
    });
    // Reserves bucketed by the whole cell their bounding box touches, so a
    // point tests only the few ellipses near it (the test itself is exact).
    var reserveBuckets = {};
    labelReserves.forEach(function (lr) {
      for (var by = Math.floor(lr.y - lr.ry); by <= Math.floor(lr.y + lr.ry); by++) {
        for (var bx = Math.floor(lr.x - lr.rx); bx <= Math.floor(lr.x + lr.rx); bx++) {
          (reserveBuckets[bx + ':' + by] = reserveBuckets[bx + ':' + by] || []).push(lr);
        }
      }
    });
    function inReserve(x, y) {
      var bucket = reserveBuckets[Math.floor(x) + ':' + Math.floor(y)];
      if (!bucket) return false;
      for (var r = 0; r < bucket.length; r++) {
        var lr = bucket[r];
        var ex = (x - lr.x) / lr.rx;
        var ey = (y - lr.y) / lr.ry;
        if (ex * ex + ey * ey <= 1) return true;
      }
      return false;
    }
    var reserveMask = new Uint8Array(N);
    labelReserves.forEach(function (lr) {
      var i0 = clamp(Math.floor((lr.x - lr.rx - x0) * RES), 0, gw - 1);
      var i1 = clamp(Math.ceil((lr.x + lr.rx - x0) * RES), 0, gw - 1);
      var j0 = clamp(Math.floor((lr.y - lr.ry - y0) * RES), 0, gh - 1);
      var j1 = clamp(Math.ceil((lr.y + lr.ry - y0) * RES), 0, gh - 1);
      for (var jj = j0; jj <= j1; jj++) {
        for (var ii = i0; ii <= i1; ii++) {
          var ex = (sx(ii) - lr.x) / lr.rx;
          var ey = (sy(jj) - lr.y) / lr.ry;
          if (ex * ex + ey * ey <= 1) reserveMask[jj * gw + ii] = 1;
        }
      }
    });

    // Hillshade and tint (MAP_TREATMENT 3.4) into an RGBA raster.
    var low = hexRgb(LAND_LOW);
    var high = hexRgb(LAND_HIGH);
    var dark = hexRgb(SHADE_DARK);
    var light = hexRgb(SHADE_LIGHT);
    var rgba = new Uint8Array(N * 4);
    for (j = 0; j < gh; j++) {
      for (i = 0; i < gw; i++) {
        k = j * gw + i;
        if (!land[k]) continue;
        var hl = heights[j * gw + Math.max(0, i - 1)];
        var hr = heights[j * gw + Math.min(gw - 1, i + 1)];
        var hu = heights[Math.max(0, j - 1) * gw + i];
        var hd = heights[Math.min(gh - 1, j + 1) * gw + i];
        var dhdx = (hr - hl) / (2 * g);
        var dhdy = (hd - hu) / (2 * g);
        var nx = -RELIEF_Z * dhdx;
        var ny = -RELIEF_Z * dhdy;
        var nl = Math.sqrt(nx * nx + ny * ny + 1);
        var sh = Math.max(0, (nx * RELIEF_LIGHT.x + ny * RELIEF_LIGHT.y + RELIEF_LIGHT.z) / nl);
        var delta = sh - 0.7071;
        if (reserveMask[k]) delta *= 0.35;
        var tm = smoothstep(0.25, 0.75, heights[k]);
        var target = delta < 0 ? dark : light;
        var amt = delta < 0 ? Math.min(0.38, -1.1 * delta) : Math.min(0.20, 0.9 * delta);
        for (var ch = 0; ch < 3; ch++) {
          var tint = low[ch] + (high[ch] - low[ch]) * tm;
          rgba[k * 4 + ch] = Math.round(tint + (target[ch] - tint) * amt);
        }
        rgba[k * 4 + 3] = 255;
      }
    }

    // Contours (MAP_TREATMENT 3.5): marching squares over the sample grid,
    // two Chaikin passes, then cuts. A point is cut when the nearest grid
    // sample is sea, has dR below 0.06, or the point lies inside a label
    // reserve ellipse (tested exactly). Runs shorter than 0.25 cell are
    // dropped last, after every cut.
    // Segment table per case: edges 0 top, 1 right, 2 bottom, 3 left.
    // Corner bits: a (top left) 8, b (top right) 4, c (bottom right) 2, d (bottom left) 1.
    var CASES = [
      [], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], null, [[0, 2]], [[3, 0]],
      [[3, 0]], [[0, 2]], null, [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []
    ];
    function contourLevel(level) {
      var pts = new Map();
      var segs = [];
      function edgeKey(ci, cj, e) {
        if (e === 0) return (cj * gw + ci) * 2;
        if (e === 2) return ((cj + 1) * gw + ci) * 2;
        if (e === 3) return (cj * gw + ci) * 2 + 1;
        return (cj * gw + ci + 1) * 2 + 1;
      }
      function edgePoint(ci, cj, e, va, vb, vc, vd) {
        var key = edgeKey(ci, cj, e);
        if (pts.has(key)) return key;
        var xa = sx(ci);
        var ya = sy(cj);
        var p;
        if (e === 0) p = { x: xa + g * (level - va) / (vb - va), y: ya };
        else if (e === 2) p = { x: xa + g * (level - vd) / (vc - vd), y: ya + g };
        else if (e === 3) p = { x: xa, y: ya + g * (level - va) / (vd - va) };
        else p = { x: xa + g, y: ya + g * (level - vb) / (vc - vb) };
        pts.set(key, p);
        return key;
      }
      for (var cj = 0; cj < gh - 1; cj++) {
        for (var ci = 0; ci < gw - 1; ci++) {
          var va = heights[cj * gw + ci];
          var vb = heights[cj * gw + ci + 1];
          var vc = heights[(cj + 1) * gw + ci + 1];
          var vd = heights[(cj + 1) * gw + ci];
          var cs = (va >= level ? 8 : 0) | (vb >= level ? 4 : 0) | (vc >= level ? 2 : 0) | (vd >= level ? 1 : 0);
          var list = CASES[cs];
          if (list === null) {
            var centreHigh = (va + vb + vc + vd) / 4 >= level;
            if (cs === 5) list = centreHigh ? [[3, 0], [2, 1]] : [[0, 1], [3, 2]];
            else list = centreHigh ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]];
          }
          for (var s = 0; s < list.length; s++) {
            segs.push([
              edgePoint(ci, cj, list[s][0], va, vb, vc, vd),
              edgePoint(ci, cj, list[s][1], va, vb, vc, vd)
            ]);
          }
        }
      }
      // Chain segments into polylines through shared edge points.
      var byKey = new Map();
      segs.forEach(function (sg, si) {
        for (var e = 0; e < 2; e++) {
          var lst = byKey.get(sg[e]);
          if (!lst) { lst = []; byKey.set(sg[e], lst); }
          lst.push(si);
        }
      });
      var used = new Uint8Array(segs.length);
      var lines = [];
      function walk(startKey, chainOut) {
        var key = startKey;
        for (;;) {
          var cand = byKey.get(key);
          var next = -1;
          for (var c = 0; c < cand.length; c++) if (!used[cand[c]]) { next = cand[c]; break; }
          if (next < 0) return;
          used[next] = 1;
          key = segs[next][0] === key ? segs[next][1] : segs[next][0];
          chainOut.push(key);
        }
      }
      for (var si = 0; si < segs.length; si++) {
        if (used[si]) continue;
        used[si] = 1;
        var fwd = [segs[si][0], segs[si][1]];
        walk(segs[si][1], fwd);
        var closed = fwd[fwd.length - 1] === fwd[0];
        var keys = fwd;
        if (!closed) {
          var back = [];
          walk(segs[si][0], back);
          keys = back.reverse().concat(fwd);
        }
        lines.push({ closed: closed, pts: keys.map(function (kk) { return pts.get(kk); }) });
      }
      return lines;
    }
    function chaikin(line) {
      var p = line.pts;
      var out = [];
      if (line.closed) {
        var n = p.length - 1;
        for (var a = 0; a < n; a++) {
          var p0 = p[a];
          var p1 = p[(a + 1) % n];
          out.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
          out.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
        }
        out.push(out[0]);
      } else {
        out.push(p[0]);
        for (var b = 0; b + 1 < p.length; b++) {
          var q0 = p[b];
          var q1 = p[b + 1];
          out.push({ x: 0.75 * q0.x + 0.25 * q1.x, y: 0.75 * q0.y + 0.25 * q1.y });
          out.push({ x: 0.25 * q0.x + 0.75 * q1.x, y: 0.25 * q0.y + 0.75 * q1.y });
        }
        out.push(p[p.length - 1]);
      }
      return { closed: line.closed, pts: out };
    }
    function keepPoint(pt) {
      var kk = cellIndex(pt.x, pt.y);
      return land[kk] === 1 && dR[kk] >= RELIEF_RIVER_CLEAR && !inReserve(pt.x, pt.y);
    }
    var contours = [];
    var contourCounts = {};
    RELIEF_LEVELS.forEach(function (level) {
      contourCounts[level.toFixed(2)] = 0;
      contourLevel(level).forEach(function (line) {
        var sm = chaikin(chaikin(line)).pts;
        var keep = sm.map(keepPoint);
        // A closed loop with a cut is rotated to start at a cut point, so
        // its runs never wrap.
        if (line.closed) {
          var firstBad = keep.indexOf(false);
          if (firstBad > 0) {
            sm = sm.slice(firstBad, sm.length - 1).concat(sm.slice(0, firstBad + 1));
            keep = sm.map(keepPoint);
          }
        }
        var run = [];
        function flush() {
          if (run.length >= 2) {
            var len = 0;
            for (var r = 1; r < run.length; r++) {
              var ldx = run[r].x - run[r - 1].x;
              var ldy = run[r].y - run[r - 1].y;
              len += Math.sqrt(ldx * ldx + ldy * ldy);
            }
            if (len >= RELIEF_MIN_CONTOUR) {
              var flat = [];
              run.forEach(function (pt) { flat.push(pt.x, pt.y); });
              contours.push({ level: level, points: flat });
              contourCounts[level.toFixed(2)]++;
            }
          }
          run = [];
        }
        for (var s = 0; s < sm.length; s++) {
          if (keep[s]) run.push(sm[s]);
          else flush();
        }
        flush();
      });
    });

    // Relief hash: FNV-1a over the salt, every height, then each contour's
    // level and points, every value rounded to 4 decimals as the integer
    // round(v * 10000) and fed as its four bytes (no 62k string build).
    var hv32 = 0x811c9dc5;
    function feed(v) {
      var n = Math.round(v * 10000) | 0;
      hv32 = Math.imul(hv32 ^ (n & 255), 0x01000193);
      hv32 = Math.imul(hv32 ^ ((n >>> 8) & 255), 0x01000193);
      hv32 = Math.imul(hv32 ^ ((n >>> 16) & 255), 0x01000193);
      hv32 = Math.imul(hv32 ^ ((n >>> 24) & 255), 0x01000193);
    }
    feed(rugInfo.salt);
    for (k = 0; k < N; k++) feed(heights[k]);
    contours.forEach(function (c) {
      feed(c.level);
      feed(c.points.length);
      for (var m = 0; m < c.points.length; m++) feed(c.points[m]);
    });
    var hash = (hv32 >>> 0).toString(16).padStart(8, '0');

    return {
      res: RES,
      width: gw,
      height: gh,
      x0: x0,
      y0: y0,
      heights: heights,
      landMask: land,
      dC: dC,
      dR: dR,
      nearestRiverDn: nearestRiverDn,
      rgba: rgba,
      contours: contours,
      contourCounts: contourCounts,
      labelReserves: labelReserves,
      ruggedness: rugInfo.ruggedness,
      salt: rugInfo.salt,
      meanRuggedness: { player: rugInfo.mean.player, enemy: rugInfo.mean.enemy },
      hash: hash
    };
  }

  function buildChart(geom) {
    var chartSeed = computeChartSeed(geom);
    var key = chartLayoutKey(geom, chartSeed);
    if (chartCache && chartCache.key === key) return chartCache.chart;
    var chart = computeChart(geom, chartSeed);
    chartCache = { key: key, chart: chart };
    return chart;
  }

  function computeChart(geom, chartSeed) {
    var W = geom.mapW;
    var H = geom.mapH;
    var L = 2 * (W + H);
    var N = makeNoise(chartSeed, L);

    var extent = {
      x0: -(SEA_MARGIN + BORDER_SIDE),
      y0: -(SEA_MARGIN + BORDER_SIDE),
      x1: W + SEA_MARGIN + BORDER_SIDE,
      y1: H + SEA_MARGIN + BORDER_FOOT
    };
    var neatline = { x0: -SEA_MARGIN, y0: -SEA_MARGIN, x1: W + SEA_MARGIN, y1: H + SEA_MARGIN };
    var widthCells = extent.x1 - extent.x0;
    var heightCells = extent.y1 - extent.y0;

    var segs = buildBoundarySegments(geom);
    var nSeg = segs.length;

    function seaOffset(t) { return clamp(0.30 + 0.22 * N(t), 0.08, 0.60); }
    function inlandOffset(t) { return clamp(0.62 + 0.12 * N(t), 0.50, 0.80); }

    // Polygon floor. The geometry jitters boundary points up to about 0.5 cell
    // past the lattice edge, so the bare offset formula could run the coast
    // through a province. The offset is therefore never less than the outward
    // reach of the boundary polygons within COAST_FLOOR_WINDOW along the side,
    // plus COAST_FLOOR_MARGIN. The floor never exceeds the sea clamp maximum
    // on the standard map (largest reach 0.51), so M-BOUNDS still holds.
    var sidePolylines = { top: [], right: [], bottom: [], left: [] };
    segs.forEach(function (seg) {
      sidePolylines[seg.side].push([alongOut(seg.side, seg.p1), alongOut(seg.side, seg.p2)]);
    });
    function alongOut(side, q) {
      if (side === 'top') return { s: q.x, o: -q.y };
      if (side === 'right') return { s: q.y, o: q.x - W };
      if (side === 'bottom') return { s: q.x, o: q.y - H };
      return { s: q.y, o: -q.x };
    }
    function polygonReach(side, s) {
      var lo = s - COAST_FLOOR_WINDOW;
      var hi = s + COAST_FLOOR_WINDOW;
      var best = -Infinity;
      sidePolylines[side].forEach(function (pair) {
        var a = pair[0];
        var b = pair[1];
        if (a.s >= lo && a.s <= hi && a.o > best) best = a.o;
        if (b.s >= lo && b.s <= hi && b.o > best) best = b.o;
        var smin = Math.min(a.s, b.s);
        var smax = Math.max(a.s, b.s);
        [lo, hi].forEach(function (sv) {
          if (sv >= smin && sv <= smax && smax > smin) {
            var o = a.o + (b.o - a.o) * (sv - a.s) / (b.s - a.s);
            if (o > best) best = o;
          }
        });
      });
      return best;
    }

    // Offset on segment index si at perimeter parameter t, with the sea to
    // inland ramp over the sea segment half nearest an inland neighbour.
    function segOffset(si, t, side, s) {
      var seg = segs[si];
      var o;
      if (!seg.sea) {
        o = inlandOffset(t);
      } else {
        var prev = segs[(si - 1 + nSeg) % nSeg];
        var next = segs[(si + 1) % nSeg];
        var w = 0;
        if (!prev.sea) w = Math.max(w, 1 - (t - seg.t0) / RAMP_LEN);
        if (!next.sea) w = Math.max(w, 1 - (seg.t1 - t) / RAMP_LEN);
        w = clamp(w, 0, 1);
        var so = seaOffset(t);
        o = so + (inlandOffset(t) - so) * w;
      }
      if (side) o = Math.max(o, polygonReach(side, s) + COAST_FLOOR_MARGIN);
      return o;
    }

    // Raw samples: each corner arc, then the side samples strictly between corners.
    var cornerT = [0, W, W + H, 2 * W + H];
    var cornerPos = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    var cornerFromAngle = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
    // The segment that starts at each corner owns that corner arc.
    var cornerSegIndex = [];
    for (var c = 0; c < 4; c++) {
      for (var si = 0; si < nSeg; si++) {
        if (Math.abs(segs[si].t0 - cornerT[c]) < 1e-9) { cornerSegIndex.push(si); break; }
      }
    }

    var raw = [];
    var segPtr = 0;
    for (c = 0; c < 4; c++) {
      var cs = segs[cornerSegIndex[c]];
      var tc = cornerT[c];
      // The arc sits between two sides; the floor takes the reach of both.
      var prevSideC = segs[(cornerSegIndex[c] - 1 + nSeg) % nSeg].side;
      var nextSideC = cs.side;
      var sPrev = (prevSideC === 'top' || prevSideC === 'bottom') ? cornerPos[c].x : cornerPos[c].y;
      var sNext = (nextSideC === 'top' || nextSideC === 'bottom') ? cornerPos[c].x : cornerPos[c].y;
      var oc = Math.max(segOffset(cornerSegIndex[c], tc, prevSideC, sPrev), segOffset(cornerSegIndex[c], tc, nextSideC, sNext));
      var cornerKey = cs.provinceId + ':corner';
      for (var a = 0; a < ARC_SAMPLES; a++) {
        var ang = cornerFromAngle[c] + (Math.PI / 2) * (a / (ARC_SAMPLES - 1));
        raw.push({
          x: cornerPos[c].x + oc * Math.cos(ang),
          y: cornerPos[c].y + oc * Math.sin(ang),
          key: cornerKey,
          seg: cornerSegIndex[c]
        });
      }
      var tEnd = c < 3 ? cornerT[c + 1] : L;
      var steps = Math.round((tEnd - tc) / COAST_STEP);
      for (var k = 1; k < steps; k++) {
        var t = tc + k * COAST_STEP;
        while (segPtr < nSeg - 1 && t >= segs[segPtr].t1 - 1e-9) segPtr++;
        var rp = rectPoint(t, W, H);
        var nrm = SIDE_NORMAL[rp.side];
        var o = segOffset(segPtr, t, rp.side, (rp.side === 'top' || rp.side === 'bottom') ? rp.x : rp.y);
        raw.push({ x: rp.x + o * nrm.x, y: rp.y + o * nrm.y, key: segs[segPtr].key, seg: segPtr });
      }
    }

    // One Chaikin pass over the closed loop; a smoothed point keeps the key
    // of its first parent.
    var coastline = [];
    var segOf = [];
    for (var i = 0; i < raw.length; i++) {
      var p0 = raw[i];
      var p1 = raw[(i + 1) % raw.length];
      coastline.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y, key: p0.key });
      coastline.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y, key: p0.key });
      segOf.push(p0.seg, p0.seg);
    }

    // Coastline index range per boundary segment (its own points, plus the
    // corner arc at its start). Ranges are contiguous by construction.
    var ranges = segs.map(function () { return { start: -1, end: -1 }; });
    for (i = 0; i < segOf.length; i++) {
      var r = ranges[segOf[i]];
      if (r.start < 0) r.start = i;
      r.end = i;
    }

    function chain(si) {
      var r = ranges[si];
      return coastline.slice(r.start, r.end + 1).map(function (q) { return { x: q.x, y: q.y }; });
    }

    // Neatline point where the outward ray from coast point q meets the neatline,
    // along the side normal.
    function neatPoint(q, side) {
      if (side === 'top') return { x: q.x, y: neatline.y0 };
      if (side === 'bottom') return { x: q.x, y: neatline.y1 };
      if (side === 'left') return { x: neatline.x0, y: q.y };
      return { x: neatline.x1, y: q.y };
    }

    var NEAT_CORNERS = [
      { x: neatline.x0, y: neatline.y0 },
      { x: neatline.x1, y: neatline.y0 },
      { x: neatline.x1, y: neatline.y1 },
      { x: neatline.x0, y: neatline.y1 }
    ];

    // Sectors: apron (sea) or beyond land (inland), plus the sea part out to the neatline.
    var sectors = segs.map(function (seg, si) {
      var ch = chain(si);
      var outer = [{ x: seg.p1.x, y: seg.p1.y }].concat(ch, [{ x: seg.p2.x, y: seg.p2.y }]);
      var seaPart = ch.slice();
      var cIdx = cornerSegIndex.indexOf(si);
      var rev = [];
      // Walk the neatline backwards from the end divider to the start divider.
      rev.push(neatPoint(ch[ch.length - 1], seg.side));
      if (cIdx >= 0) {
        rev.push({ x: NEAT_CORNERS[cIdx].x, y: NEAT_CORNERS[cIdx].y });
        var prevSide = segs[(si - 1 + nSeg) % nSeg].side;
        rev.push(neatPoint(ch[0], prevSide));
      } else {
        rev.push(neatPoint(ch[0], seg.side));
      }
      seaPart = seaPart.concat(rev);
      return {
        key: seg.key,
        provinceId: seg.provinceId,
        sea: seg.sea,
        apron: seg.sea ? outer : null,
        beyond: seg.sea ? null : outer,
        seaPart: seaPart
      };
    });

    // Hit polygons: original polygon with every sea segment replaced by
    // p1, its coastline chain in perimeter order, p2.
    var segsByProvince = {};
    segs.forEach(function (seg, si) {
      if (!segsByProvince[seg.provinceId]) segsByProvince[seg.provinceId] = {};
      segsByProvince[seg.provinceId][SIDE_SEGS[seg.side][seg.segIndex][0]] = si;
    });
    var hitPolygons = {};
    geom.provinces.forEach(function (p) {
      var bySeg = segsByProvince[p.id] || {};
      var out = [];
      for (var j = 0; j < p.polygon.length; j++) {
        var pt = p.polygon[j];
        out.push({ x: pt.x, y: pt.y });
        var si = bySeg[j];
        if (si !== undefined && segs[si].sea) {
          out = out.concat(chain(si));
        }
      }
      hitPolygons[p.id] = out;
    });

    // Divider coast point per boundary vertex (grid corner key "gx:gy").
    // A vertex gets a divider when a sea segment touches it: the first point of
    // the chain of the sea segment starting there, else the last point of the
    // chain of the sea segment ending there.
    function gridKeyOf(seg, which) {
      var prov = null;
      for (var q = 0; q < geom.provinces.length; q++) {
        if (geom.provinces[q].id === seg.provinceId) { prov = geom.provinces[q]; break; }
      }
      var idx = SIDE_SEGS[seg.side][seg.segIndex][which];
      // Polygon corner indices: 0 TL, 2 TR, 4 BR, 6 BL. Odd indices are midpoints.
      if (idx === 0) return prov.x + ':' + prov.y;
      if (idx === 2) return (prov.x + 1) + ':' + prov.y;
      if (idx === 4) return (prov.x + 1) + ':' + (prov.y + 1);
      if (idx === 6) return prov.x + ':' + (prov.y + 1);
      return null;
    }
    var dividerAt = {};
    segs.forEach(function (seg, si) {
      if (!seg.sea) return;
      var ch = chain(si);
      var kStart = gridKeyOf(seg, 0);
      var kEnd = gridKeyOf(seg, 1);
      if (kStart !== null) dividerAt[kStart] = ch[0];
      if (kEnd !== null && !dividerAt[kEnd]) dividerAt[kEnd] = ch[ch.length - 1];
    });

    var rivers = buildRivers(geom, dividerAt, coastline);
    var relief = buildRelief(geom, coastline, rivers, chartSeed, neatline);

    var chartEdges = geom.edges.map(function (e) {
      var path = e.path.map(function (q) { return { x: q.x, y: q.y }; });
      var extended = false;
      if (path.length >= 2) {
        var first = path[0];
        var last = path[path.length - 1];
        var kFirst = Math.round(first.x) + ':' + Math.round(first.y);
        var kLast = Math.round(last.x) + ':' + Math.round(last.y);
        if (onLatticeBoundary(first) && dividerAt[kFirst]) {
          path.unshift({ x: dividerAt[kFirst].x, y: dividerAt[kFirst].y });
          extended = true;
        }
        if (onLatticeBoundary(last) && dividerAt[kLast]) {
          path.push({ x: dividerAt[kLast].x, y: dividerAt[kLast].y });
          extended = true;
        }
      }
      return { a: e.a, b: e.b, path: path, extended: extended };
    });

    function onLatticeBoundary(q) {
      var gx = Math.round(q.x);
      var gy = Math.round(q.y);
      return gx === 0 || gx === W || gy === 0 || gy === H;
    }

    // Wave marks: jittered grid over the neatline, kept in open sea only.
    var waves = [];
    var wrng = mulberry32(fnv1a(chartSeed + ':wave'));
    for (var gyw = neatline.y0 + WAVE_SPACING / 2; gyw < neatline.y1; gyw += WAVE_SPACING) {
      for (var gxw = neatline.x0 + WAVE_SPACING / 2; gxw < neatline.x1; gxw += WAVE_SPACING) {
        var wx = gxw + (wrng() * 2 - 1) * WAVE_JITTER;
        var wy = gyw + (wrng() * 2 - 1) * WAVE_JITTER;
        if (wx <= neatline.x0 || wx >= neatline.x1 || wy <= neatline.y0 || wy >= neatline.y1) continue;
        if (pointInPolygon({ x: wx, y: wy }, coastline)) continue;
        var near = false;
        for (var ci = 0; ci < coastline.length && !near; ci++) {
          var ca = coastline[ci];
          var cb = coastline[(ci + 1) % coastline.length];
          if (distToSegment(wx, wy, ca.x, ca.y, cb.x, cb.y) <= WAVE_CLEAR) near = true;
        }
        if (!near) waves.push({ x: wx, y: wy });
      }
    }

    return {
      chartSeed: chartSeed,
      mapW: W,
      mapH: H,
      extent: extent,
      neatline: neatline,
      widthCells: widthCells,
      heightCells: heightCells,
      insetX: -extent.x0,
      insetTop: -extent.y0,
      insetBottom: extent.y1 - H,
      boundarySegments: segs.map(function (seg, si) {
        return {
          provinceId: seg.provinceId,
          key: seg.key,
          side: seg.side,
          p1: seg.p1,
          p2: seg.p2,
          coastal: seg.coastal,
          sea: seg.sea,
          t0: seg.t0,
          t1: seg.t1,
          coastStart: ranges[si].start,
          coastEnd: ranges[si].end
        };
      }),
      coastline: coastline,
      sectors: sectors,
      hitPolygons: hitPolygons,
      provinceOrder: geom.provinces.map(function (p) { return p.id; }),
      lattice: buildLattice(geom),
      chartEdges: chartEdges,
      waves: waves,
      rivers: rivers,
      relief: relief
    };
  }

  // Hit test in cell space. Inside the lattice rectangle the answer follows
  // the lattice rule of AshesMapGeometry.hitTest (cell candidate, then its
  // edge neighbours, then the cell itself), so clicks agree with tiles and
  // with the geometry everywhere on the lattice. Outside the lattice: the
  // province whose hit polygon contains (x, y), or null for sea, beyond
  // land, and the border strip.
  function hitTest(chart, x, y) {
    var pt = { x: x, y: y };
    var lat = chart.lattice;
    if (x >= 0 && x < chart.mapW && y >= 0 && y < chart.mapH) {
      var cand = lat.byCell[Math.floor(x) + ':' + Math.floor(y)];
      if (!cand) return null;
      if (pointInPolygon(pt, lat.polygons[cand])) return cand;
      var nbrs = lat.neighbours[cand] || [];
      for (var n = 0; n < nbrs.length; n++) {
        if (pointInPolygon(pt, lat.polygons[nbrs[n]])) return nbrs[n];
      }
      return cand;
    }
    var order = chart.provinceOrder;
    for (var i = 0; i < order.length; i++) {
      if (pointInPolygon(pt, chart.hitPolygons[order[i]])) return order[i];
    }
    return null;
  }

  var CHART_CONSTANTS = {
    SEA_MARGIN: SEA_MARGIN,
    BORDER_SIDE: BORDER_SIDE,
    BORDER_FOOT: BORDER_FOOT,
    EXTENT: EXTENT,
    NEATLINE: NEATLINE,
    WIDTH_CELLS: WIDTH_CELLS,
    HEIGHT_CELLS: HEIGHT_CELLS,
    INSET_X: INSET_X,
    INSET_Y: INSET_Y,
    SEA_DEEP: SEA_DEEP,
    SEA_MID: SEA_MID,
    SEA_SHELF: SEA_SHELF,
    SEA_SHORE: SEA_SHORE,
    LAND_LOW: LAND_LOW,
    LAND_HIGH: LAND_HIGH,
    CONTOUR: CONTOUR,
    SHADE_DARK: SHADE_DARK,
    SHADE_LIGHT: SHADE_LIGHT,
    RELIEF_RES: RELIEF_RES,
    BEACH: BEACH,
    FRAME_PAPER: FRAME_PAPER,
    INK: INK,
    RIVER_WATER: RIVER_WATER,
    RIVER_BANK: RIVER_BANK,
    RIVER_GLINT: RIVER_GLINT,
    W_SRC: W_SRC,
    W_MOUTH: W_MOUTH
  };

  var AshesChart = {
    buildChart: buildChart,
    hitTest: hitTest,
    pointInPolygon: pointInPolygon,
    fnv1a: fnv1a,
    mulberry32: mulberry32,
    buildRelief: buildRelief,
    CHART_CONSTANTS: CHART_CONSTANTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesChart;
  }
  global.AshesChart = AshesChart;
})(typeof window !== 'undefined' ? window : globalThis);
