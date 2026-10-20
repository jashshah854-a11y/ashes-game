#!/usr/bin/env python3
"""Score TX-LAND bake-off candidates A and B on the two candidate-local
criteria of MAP_TREATMENT 7.4 and print one JSON object.

Cycle 23 Step 18c-1. Deterministic: reads files only, writes nothing.

r_h (seamless, offset-cross measurement, the R2 selection method):
  Roll the candidate by half its height and half its width, so the tile
  edges meet in a cross at the centre. All diffs are absolute differences
  of RGB values, averaged over every pixel and channel of the line.
    cross H   = mean |row[h/2] - row[h/2 - 1]| (the shifted horizontal seam)
    cross V   = mean |col[w/2] - col[w/2 - 1]| (the shifted vertical seam)
    typical H = median over rows r = 64, 128, ... (skipping r = h/2) of
                mean |row[r] - row[r - 1]|
    typical V = the same over columns
  Point = 1 only if cross H <= RATIO_MAX * typical H and
  cross V <= RATIO_MAX * typical V.

size: point = 1 if the WebP file is <= SIZE_MAX_BYTES.

Exit status: 0 on a completed score (whatever the points), 1 if any input
is missing or a PNG is not 1024 x 1024.

Run: python3 tools/tx-land-score.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

# Seam passes when its cross mean is at most this multiple of the typical mean.
RATIO_MAX = 2.0
# Typical-line sampling stride in px, per the spec (every 64th row/column).
STRIDE = 64
# WebP budget per MAP_TREATMENT 7.4: 250 KiB.
SIZE_MAX_BYTES = 250 * 1024
# Required PNG edge in px.
EXPECTED = 1024

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAKE_DIR = os.path.join(ROOT, "art-direction", "bakeoff", "TX-LAND")
CANDIDATES = ("a", "b")


def line_diff(a, b):
    return float(np.mean(np.abs(a - b)))


def score_rh(img):
    h, w = img.shape[:2]
    s = np.roll(img, (h // 2, w // 2), axis=(0, 1))
    cross_h = line_diff(s[h // 2], s[h // 2 - 1])
    cross_v = line_diff(s[:, w // 2], s[:, w // 2 - 1])
    typ_h = float(np.median([line_diff(s[r], s[r - 1])
                             for r in range(STRIDE, h, STRIDE) if r != h // 2]))
    typ_v = float(np.median([line_diff(s[:, c], s[:, c - 1])
                             for c in range(STRIDE, w, STRIDE) if c != w // 2]))
    ratio_h = cross_h / typ_h if typ_h > 0 else float("inf")
    ratio_v = cross_v / typ_v if typ_v > 0 else float("inf")
    point = 1 if (ratio_h <= RATIO_MAX and ratio_v <= RATIO_MAX) else 0
    return {
        "point": point,
        "cross_h": round(cross_h, 4),
        "cross_v": round(cross_v, 4),
        "typical_h": round(typ_h, 4),
        "typical_v": round(typ_v, 4),
        "ratio_h": round(ratio_h, 4),
        "ratio_v": round(ratio_v, 4),
        "ratio_max": RATIO_MAX,
    }


def main():
    result = {"criteria": "MAP_TREATMENT 7.4 candidate-local: r_h, size", "candidates": {}}
    errors = []
    for key in CANDIDATES:
        png = os.path.join(BAKE_DIR, "candidate-%s.png" % key)
        webp = os.path.join(BAKE_DIR, "candidate-%s.webp" % key)
        for p in (png, webp):
            if not os.path.isfile(p):
                errors.append("missing: " + os.path.relpath(p, ROOT))
        if not (os.path.isfile(png) and os.path.isfile(webp)):
            continue
        im = Image.open(png)
        if im.size != (EXPECTED, EXPECTED):
            errors.append("%s is %dx%d, expected %dx%d"
                          % (os.path.relpath(png, ROOT), im.size[0], im.size[1], EXPECTED, EXPECTED))
            continue
        img = np.asarray(im.convert("RGB"), dtype=np.float64)
        luma = 0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]
        webp_bytes = os.path.getsize(webp)
        result["candidates"][key] = {
            "png": os.path.relpath(png, ROOT),
            "webp": os.path.relpath(webp, ROOT),
            "png_size": [im.size[0], im.size[1]],
            "mean_luma": round(float(luma.mean()), 2),
            "r_h": score_rh(img),
            "size": {
                "point": 1 if webp_bytes <= SIZE_MAX_BYTES else 0,
                "webp_bytes": webp_bytes,
                "max_bytes": SIZE_MAX_BYTES,
            },
        }
    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
