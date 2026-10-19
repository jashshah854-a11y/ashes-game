// Ashes of Empires, map geometry for presentation.
// Builds jittered province polygons and segment paths from a player view.
// Loadable in node (module.exports) and in the browser (global.AshesMapGeometry).
// Reads ONLY a playerView object. Never requires js/sim.js, never calls
// any sim function, and never mutates the view (builds new objects only).
(function (global) {
  'use strict';

  var CELL_PX = 160;

  // FNV-1a 32-bit hash of a string, returns unsigned 32-bit integer.
  function fnv1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  // mulberry32 PRNG, seeded by a 32-bit unsigned integer.
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var z = Math.imul(t ^ (t >>> 15), 1 | t);
      z = Math.imul(z ^ (z >>> 7), 61 | t);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic jitter in [-maxOffset, maxOffset] for a given key.
  function jitter(key, maxOffset) {
    var seed = fnv1a(key);
    var rng = mulberry32(seed);
    return (rng() * 2 - 1) * maxOffset;
  }

  // Point in polygon via ray casting (even-odd rule).
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

  // Convert cell coordinates to pixel coordinates.
  function toPx(p) {
    return { x: p.x * CELL_PX, y: p.y * CELL_PX };
  }

  // Build the full geometry from a player view.
  function buildGeometry(view) {
    var provinces = view.provinces;
    var edges = view.edges;

    // Grid dimensions derived from the view itself.
    var mapW = 0;
    var mapH = 0;
    provinces.forEach(function (p) {
      if (p.x + 1 > mapW) mapW = p.x + 1;
      if (p.y + 1 > mapH) mapH = p.y + 1;
    });
    var boardWidthPx = mapW * CELL_PX;
    var boardHeightPx = mapH * CELL_PX;

    // ------------------------------------------------------------------
    // 1. Compute jittered lattice corners.
    //    Corners indexed by gx=0..mapW, gy=0..mapH.
    // ------------------------------------------------------------------
    var corners = {}; // key "gx:gy" -> {x, y}
    for (var gy = 0; gy <= mapH; gy++) {
      for (var gx = 0; gx <= mapW; gx++) {
        var key = 'corner:' + gx + ':' + gy;
        var isExtreme = (gx === 0 || gx === mapW) && (gy === 0 || gy === mapH);
        var maxOffset = (gy === 0 || gy === mapH) ? 0.32 : 0.20;
        if (isExtreme) {
          maxOffset = 0;
        }
        var dx = jitter(key + ':x', maxOffset);
        var dy = jitter(key + ':y', maxOffset);
        corners[gx + ':' + gy] = { x: gx + dx, y: gy + dy };
      }
    }

    // ------------------------------------------------------------------
    // 2. Compute edge midpoints for interior edges (shared borders).
    //    Key: "edge:a|b" where a,b are sorted province ids.
    // ------------------------------------------------------------------
    var edgeMidpoints = {}; // key -> {x, y}
    var edgeKeyToEdge = {};
    edges.forEach(function (e) {
      var a = e.a;
      var b = e.b;
      var key = 'edge:' + (a < b ? a + '|' + b : b + '|' + a);
      edgeKeyToEdge[key] = e;

      // Find the two shared corners between province a and b.
      var pa = provinces.find(function (p) { return p.id === a; });
      var pb = provinces.find(function (p) { return p.id === b; });
      if (!pa || !pb) return;

      // Determine shared border: horizontal neighbour (same y, x differs by 1)
      // or vertical neighbour (same x, y differs by 1).
      var sharedCorners = [];
      if (pa.y === pb.y) {
        // Horizontal neighbours: shared border is vertical segment.
        // Left province has x = min(pa.x, pb.x), right has x = max.
        var left = pa.x < pb.x ? pa : pb;
        var right = pa.x < pb.x ? pb : pa;
        // Shared corners: TR of left = (left.x+1, left.y), BR of left = (left.x+1, left.y+1)
        var c1 = corners[(left.x + 1) + ':' + left.y];
        var c2 = corners[(left.x + 1) + ':' + (left.y + 1)];
        sharedCorners = [c1, c2];
      } else if (pa.x === pb.x) {
        // Vertical neighbours: shared border is horizontal segment.
        // Top province has y = min(pa.y, pb.y), bottom has y = max.
        var top = pa.y < pb.y ? pa : pb;
        var bottom = pa.y < pb.y ? pb : pa;
        // Shared corners: BL of top = (top.x, top.y+1), BR of top = (top.x+1, top.y+1)
        var c1 = corners[top.x + ':' + (top.y + 1)];
        var c2 = corners[(top.x + 1) + ':' + (top.y + 1)];
        sharedCorners = [c1, c2];
      }

      if (sharedCorners.length === 2) {
        var mx = (sharedCorners[0].x + sharedCorners[1].x) / 2;
        var my = (sharedCorners[0].y + sharedCorners[1].y) / 2;
        var jx = jitter(key + ':mx', 0.14);
        var jy = jitter(key + ':my', 0.14);
        edgeMidpoints[key] = { x: mx + jx, y: my + jy };
      }
    });

    // ------------------------------------------------------------------
    // 3. Compute outer border midpoints for coastal provinces.
    //    Key: "outer:provinceId:side" where side is 'top' or 'bottom'.
    // ------------------------------------------------------------------
    var outerMidpoints = {}; // key -> {x, y}
    provinces.forEach(function (p) {
      if (!p.coastal) return;
      // Top edge (y=0) or bottom edge (y=6).
      if (p.y === 0) {
        // Top outer border: between TL (x,y) and TR (x+1,y)
        var c1 = corners[p.x + ':' + p.y];
        var c2 = corners[(p.x + 1) + ':' + p.y];
        var mx = (c1.x + c2.x) / 2;
        var my = (c1.y + c2.y) / 2;
        var key = 'outer:' + p.id + ':top';
        var jx = jitter(key + ':mx', 0.32);
        var jy = jitter(key + ':my', 0.32);
        outerMidpoints[key] = { x: mx + jx, y: my + jy };
      }
      if (p.y === mapH - 1) { // y=6
        // Bottom outer border: between BL (x,y+1) and BR (x+1,y+1)
        var c1 = corners[p.x + ':' + (p.y + 1)];
        var c2 = corners[(p.x + 1) + ':' + (p.y + 1)];
        var mx = (c1.x + c2.x) / 2;
        var my = (c1.y + c2.y) / 2;
        var key = 'outer:' + p.id + ':bottom';
        var jx = jitter(key + ':mx', 0.32);
        var jy = jitter(key + ':my', 0.32);
        outerMidpoints[key] = { x: mx + jx, y: my + jy };
      }
    });

    // ------------------------------------------------------------------
    // 4. Build province polygons (8 points each) and centers.
    // ------------------------------------------------------------------
    var provincePolys = {}; // provinceId -> polygon (array of 8 points)
    var provinceCenters = {}; // provinceId -> center point
    var provinceById = {};
    var provinceByCoord = {};
    provinces.forEach(function (p) {
      provinceById[p.id] = p;
      provinceByCoord[p.x + ':' + p.y] = p;
    });

    provinces.forEach(function (p) {
      // Four lattice corners of this cell.
      var tl = corners[p.x + ':' + p.y];
      var tr = corners[(p.x + 1) + ':' + p.y];
      var br = corners[(p.x + 1) + ':' + (p.y + 1)];
      var bl = corners[p.x + ':' + (p.y + 1)];

      // Top midpoint: outer if coastal and y=0, else interior edge midpoint.
      var topMid;
      if (p.y === 0 && p.coastal) {
        topMid = outerMidpoints['outer:' + p.id + ':top'];
      } else if (p.y > 0) {
        // Neighbour to the north: province at (x, y-1)
        var northId = provinceByCoord[p.x + ':' + (p.y - 1)].id;
        var key = 'edge:' + (p.id < northId ? p.id + '|' + northId : northId + '|' + p.id);
        topMid = edgeMidpoints[key];
      } else {
        // Top row but not coastal: fallback to geometric midpoint (should not happen per facts)
        topMid = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
      }

      // Right midpoint: interior edge to east neighbour if exists.
      var rightMid;
      if (p.x < mapW - 1) {
        var eastId = provinceByCoord[(p.x + 1) + ':' + p.y].id;
        var key = 'edge:' + (p.id < eastId ? p.id + '|' + eastId : eastId + '|' + p.id);
        rightMid = edgeMidpoints[key];
      } else {
        // Right border: geometric midpoint of right edge.
        rightMid = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
      }

      // Bottom midpoint: outer if coastal and y=6, else interior edge midpoint.
      var bottomMid;
      if (p.y === mapH - 1 && p.coastal) {
        bottomMid = outerMidpoints['outer:' + p.id + ':bottom'];
      } else if (p.y < mapH - 1) {
        var southId = provinceByCoord[p.x + ':' + (p.y + 1)].id;
        var key = 'edge:' + (p.id < southId ? p.id + '|' + southId : southId + '|' + p.id);
        bottomMid = edgeMidpoints[key];
      } else {
        bottomMid = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
      }

      // Left midpoint: interior edge to west neighbour if exists.
      var leftMid;
      if (p.x > 0) {
        var westId = provinceByCoord[(p.x - 1) + ':' + p.y].id;
        var key = 'edge:' + (p.id < westId ? p.id + '|' + westId : westId + '|' + p.id);
        leftMid = edgeMidpoints[key];
      } else {
        leftMid = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };
      }

      // Polygon in order: TL, topMid, TR, rightMid, BR, bottomMid, BL, leftMid.
      var polygon = [tl, topMid, tr, rightMid, br, bottomMid, bl, leftMid];
      provincePolys[p.id] = polygon;

      // Center = average of 4 corners.
      var cx = (tl.x + tr.x + br.x + bl.x) / 4;
      var cy = (tl.y + tr.y + br.y + bl.y) / 4;
      provinceCenters[p.id] = { x: cx, y: cy };
    });

    // ------------------------------------------------------------------
    // 5. Build output provinces array (sorted by id).
    // ------------------------------------------------------------------
    var outProvinces = provinces.map(function (p) {
      return {
        id: p.id,
        x: p.x,
        y: p.y,
        coastal: p.coastal,
        center: provinceCenters[p.id],
        polygon: provincePolys[p.id]
      };
    }).sort(function (a, b) { return a.id.localeCompare(b.id); });

    // ------------------------------------------------------------------
    // 6. Build output edges with path (3 points: corner, shared midpoint, corner).
    // ------------------------------------------------------------------
    var outEdges = edges.map(function (e) {
      var a = e.a;
      var b = e.b;
      var key = 'edge:' + (a < b ? a + '|' + b : b + '|' + a);
      var mid = edgeMidpoints[key];

      // Find the two shared corners.
      var pa = provinceById[a];
      var pb = provinceById[b];
      var c1, c2;
      if (pa && pb) {
        if (pa.y === pb.y) {
          // Horizontal neighbours.
          var left = pa.x < pb.x ? pa : pb;
          c1 = corners[(left.x + 1) + ':' + left.y];
          c2 = corners[(left.x + 1) + ':' + (left.y + 1)];
        } else if (pa.x === pb.x) {
          // Vertical neighbours.
          var top = pa.y < pb.y ? pa : pb;
          c1 = corners[top.x + ':' + (top.y + 1)];
          c2 = corners[(top.x + 1) + ':' + (top.y + 1)];
        }
      }
      var path = c1 && c2 && mid ? [c1, mid, c2] : [];

      return {
        a: a,
        b: b,
        terrain: e.terrain,
        railState: e.railState,
        path: path
      };
    });

    // ------------------------------------------------------------------
    // 7. Build riverSegments (terrain === 'river').
    // ------------------------------------------------------------------
    var riverSegments = edges
      .filter(function (e) { return e.terrain === 'river'; })
      .map(function (e) {
        var a = e.a;
        var b = e.b;
        var key = 'edge:' + (a < b ? a + '|' + b : b + '|' + a);
        var mid = edgeMidpoints[key];
        var pa = provinceById[a];
        var pb = provinceById[b];
        var c1, c2;
        if (pa && pb) {
          if (pa.y === pb.y) {
            var left = pa.x < pb.x ? pa : pb;
            c1 = corners[(left.x + 1) + ':' + left.y];
            c2 = corners[(left.x + 1) + ':' + (left.y + 1)];
          } else if (pa.x === pb.x) {
            var top = pa.y < pb.y ? pa : pb;
            c1 = corners[top.x + ':' + (top.y + 1)];
            c2 = corners[(top.x + 1) + ':' + (top.y + 1)];
          }
        }
        return { a: a, b: b, path: c1 && c2 && mid ? [c1, mid, c2] : [] };
      });

    // ------------------------------------------------------------------
    // 8. Build railSegments (railState !== 'none').
    // ------------------------------------------------------------------
    var railSegments = edges
      .filter(function (e) { return e.railState !== 'none'; })
      .map(function (e) {
        var a = e.a;
        var b = e.b;
        var key = 'edge:' + (a < b ? a + '|' + b : b + '|' + a);
        var mid = edgeMidpoints[key];
        var pa = provinceById[a];
        var pb = provinceById[b];
        var c1, c2;
        if (pa && pb) {
          if (pa.y === pb.y) {
            var left = pa.x < pb.x ? pa : pb;
            c1 = corners[(left.x + 1) + ':' + left.y];
            c2 = corners[(left.x + 1) + ':' + (left.y + 1)];
          } else if (pa.x === pb.x) {
            var top = pa.y < pb.y ? pa : pb;
            c1 = corners[top.x + ':' + (top.y + 1)];
            c2 = corners[(top.x + 1) + ':' + (top.y + 1)];
          }
        }
        return { a: a, b: b, railState: e.railState, path: c1 && c2 && mid ? [c1, mid, c2] : [] };
      });

    // ------------------------------------------------------------------
    // 9. Build coastSegments (one per coastal province).
    //    Side: 'top' if y=0 else 'bottom'.
    //    Path: top edge polygon points indices 0,1,2; bottom edge indices 4,5,6 (reversed).
    // ------------------------------------------------------------------
    var coastSegments = [];
    provinces.forEach(function (p) {
      if (!p.coastal) return;
      var poly = provincePolys[p.id];
      if (p.y === 0) {
        // Top edge: indices 0 (TL), 1 (topMid), 2 (TR).
        coastSegments.push({
          provinceId: p.id,
          side: 'top',
          path: [poly[0], poly[1], poly[2]]
        });
      } else if (p.y === mapH - 1) {
        // Bottom edge: indices 4 (BR), 5 (bottomMid), 6 (BL) -- in polygon order.
        coastSegments.push({
          provinceId: p.id,
          side: 'bottom',
          path: [poly[4], poly[5], poly[6]]
        });
      }
    });

    return {
      mapW: mapW,
      mapH: mapH,
      cellPx: CELL_PX,
      boardWidthPx: boardWidthPx,
      boardHeightPx: boardHeightPx,
      provinces: outProvinces,
      edges: outEdges,
      riverSegments: riverSegments,
      railSegments: railSegments,
      coastSegments: coastSegments
    };
  }

  // Hit test: given geometry and cell-space point (x,y), return province id or null.
  function hitTest(geom, x, y) {
    if (x < 0 || x >= geom.mapW || y < 0 || y >= geom.mapH) {
      return null;
    }
    var gx = Math.floor(x);
    var gy = Math.floor(y);
    var candidate = geom.provinces.find(function (p) { return p.x === gx && p.y === gy; });
    if (!candidate) return null;
    var candidateId = candidate.id;
    var pt = { x: x, y: y };
    if (candidate && pointInPolygon(pt, candidate.polygon)) {
      return candidate.id;
    }
    // Test edge neighbours of the candidate.
    var neighbourIds = [];
    geom.edges.forEach(function (e) {
      if (e.a === candidateId) neighbourIds.push(e.b);
      else if (e.b === candidateId) neighbourIds.push(e.a);
    });
    for (var i = 0; i < neighbourIds.length; i++) {
      var nid = neighbourIds[i];
      var np = geom.provinces.find(function (p) { return p.id === nid; });
      if (np && pointInPolygon(pt, np.polygon)) {
        return nid;
      }
    }
    return candidateId;
  }

  var AshesMapGeometry = {
    buildGeometry: buildGeometry,
    pointInPolygon: pointInPolygon,
    hitTest: hitTest,
    toPx: toPx,
    CELL_PX: CELL_PX
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesMapGeometry;
  }
  global.AshesMapGeometry = AshesMapGeometry;
})(typeof window !== 'undefined' ? window : globalThis);