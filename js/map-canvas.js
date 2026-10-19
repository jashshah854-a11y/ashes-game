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
    renderBaseCanvas: renderBaseCanvas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AshesMapCanvas;
  }
  global.AshesMapCanvas = AshesMapCanvas;
})(typeof window !== 'undefined' ? window : globalThis);