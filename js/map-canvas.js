// Ashes of Empires, map canvas renderer for the parchment board layer.
// Builds an offscreen canvas from the same map geometry the DOM tiles use.
// Loadable in node (module.exports) and in the browser (global.AshesMapCanvas).
// Reads ONLY a playerView object and the geometry object. Never requires
// js/sim.js, never calls any sim function, and never mutates inputs.
(function (global) {
  'use strict';

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
      ops.push({ kind: 'polygon', id: p.id, points: points });
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

    // River segments
    geom.riverSegments.forEach(function (rs) {
      var path = [];
      for (var i = 0; i < rs.path.length; i++) {
        var pt = rs.path[i];
        path.push(pt.x, pt.y);
      }
      ops.push({ kind: 'river', a: rs.a, b: rs.b, path: path });
    });

    // Rail segments
    geom.railSegments.forEach(function (rs) {
      var path = [];
      for (var i = 0; i < rs.path.length; i++) {
        var pt = rs.path[i];
        path.push(pt.x, pt.y);
      }
      ops.push({ kind: 'rail', a: rs.a, b: rs.b, railState: rs.railState, path: path, dashed: rs.railState !== 'built' });
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
    });
    var canonical = parts.join('|');
    var hash = fnv1a(canonical);
    return hash.toString(16).padStart(8, '0');
  }

  // Execute draw operations on a canvas context.
  // scaleX, scaleY: device pixels per cell-space unit.
  function drawOps(ctx, ops, scaleX, scaleY) {
    var canvas = ctx.canvas;
    var w = canvas.width;
    var h = canvas.height;

    ops.forEach(function (op) {
      switch (op.kind) {
        case 'sea':
          ctx.fillStyle = '#2c4a5e';
          ctx.fillRect(0, 0, w, h);
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
            ctx.fillStyle = '#d9cfae';
            ctx.fill();
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
          ctx.beginPath();
          var rpath = op.path;
          if (rpath.length >= 2) {
            ctx.moveTo(rpath[0] * scaleX, rpath[1] * scaleY);
            for (var i = 2; i < rpath.length; i += 2) {
              ctx.lineTo(rpath[i] * scaleX, rpath[i + 1] * scaleY);
            }
            ctx.strokeStyle = '#7fb3d9';
            ctx.lineWidth = Math.max(2, 0.035 * scaleX);
            ctx.stroke();
          }
          break;

        case 'rail':
          ctx.beginPath();
          var rapath = op.path;
          if (rapath.length >= 2) {
            ctx.moveTo(rapath[0] * scaleX, rapath[1] * scaleY);
            for (var i = 2; i < rapath.length; i += 2) {
              ctx.lineTo(rapath[i] * scaleX, rapath[i + 1] * scaleY);
            }
            ctx.strokeStyle = '#3a352a';
            ctx.lineWidth = Math.max(2, 0.045 * scaleX);
            if (op.dashed) {
              ctx.save();
              ctx.setLineDash([8, 6]);
              ctx.stroke();
              ctx.restore();
            } else {
              ctx.stroke();
            }
          }
          break;
      }
    });
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

    // scaleX = canvas.width / geom.mapW  (device px per cell)
    // scaleY = canvas.height / geom.mapH
    var scaleX = canvas.width / geom.mapW;
    var scaleY = canvas.height / geom.mapH;

    drawOps(ctx, ops, scaleX, scaleY);

    var hash = drawOpsHash(ops);

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

  // Check if a polygon segment lies exactly on the map boundary.
  function isBoundarySegment(p1, p2, mapW, mapH) {
    // x===0 or x===mapW or y===0 or y===mapH
    var eps = 1e-9;
    var onLeft = Math.abs(p1.x) < eps && Math.abs(p2.x) < eps;
    var onRight = Math.abs(p1.x - mapW) < eps && Math.abs(p2.x - mapW) < eps;
    var onTop = Math.abs(p1.y) < eps && Math.abs(p2.y) < eps;
    var onBottom = Math.abs(p1.y - mapH) < eps && Math.abs(p2.y - mapH) < eps;
    return onLeft || onRight || onTop || onBottom;
  }

  // Build state operations from geometry and view.
  // Rules:
  // - For each edge where BOTH owners known and different: emit front op, then band ops for both sides.
  // - For each edge where EXACTLY ONE owner known: emit band op for known side only.
  // - For each province with known owner, for each polygon segment on map boundary: emit band op.
  // - Same-owner edges and unknown-unknown edges emit nothing.
  // - Sorted by province id then edge a then b.
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
      var segments = [
        { p1: poly[0], p2: poly[1] }, // top
        { p1: poly[2], p2: poly[3] }, // right
        { p1: poly[4], p2: poly[5] }, // bottom
        { p1: poly[6], p2: poly[7] }  // left
      ];

      segments.forEach(function (seg) {
        if (isBoundarySegment(seg.p1, seg.p2, geom.mapW, geom.mapH)) {
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
    ops.sort(function (a, b) {
      if (a.kind === 'front' && b.kind === 'front') {
        if (a.a !== b.a) return a.a.localeCompare(b.a);
        return a.b.localeCompare(b.b);
      }
      if (a.kind === 'band' && b.kind === 'band') {
        return a.provinceId.localeCompare(b.provinceId);
      }
      // Put bands before fronts for consistent grouping
      return a.kind === 'band' ? -1 : 1;
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
          var offsetDist = halfCore;

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

    // scaleX = canvas.width / geom.mapW  (device px per cell)
    // scaleY = canvas.height / geom.mapH
    var scaleX = canvas.width / geom.mapW;
    var scaleY = canvas.height / geom.mapH;

    drawStateOps(ctx, ops, scaleX, scaleY);

    var hash = stateOpsHash(ops);

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
    renderStateCanvas: renderStateCanvas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesMapCanvas;
  }
  global.AshesMapCanvas = AshesMapCanvas;
})(typeof window !== 'undefined' ? window : globalThis);