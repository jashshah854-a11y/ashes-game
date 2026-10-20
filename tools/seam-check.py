#!/usr/bin/env python3
"""Formal 3 x 3 seam check for every shipped map texture, measured on the
shipped WebP payloads exactly as the game loads them.

Cycle 23 MAP_TREATMENT Step 19d-2. Deterministic: reads files only, writes
nothing, no network, no randomness.

What it proves: every map texture the game ships tiles seamlessly. For each
payload the base64 string is pulled out of the data module the game loads
(js/*-data.js), decoded, and required to be byte identical (sha256) to the
committed .webp on disk. The WebP is then decoded from those shipped bytes,
not from any PNG source, so the measurement covers the real payload.

3 x 3 construction: the decoded RGB tile (h x w) is tiled with
np.tile(tile, (3, 3, 1)) into a 3h x 3w image. Its internal seams are
    vertical seams   = between tile columns 1|2 and 2|3, at x = w and x = 2w
    horizontal seams = between tile rows 1|2 and 2|3, at y = h and y = 2h
All diffs are absolute differences of RGB values, averaged over the full
seam length and every channel:
    vertical seam at x   = mean |col[x] - col[x - 1]| of the tiled image
    horizontal seam at y = mean |row[y] - row[y - 1]| of the tiled image
Typical diff per direction, in the spirit of tools/tx-land-score.py, on the
SINGLE tile:
    typical vertical   = median over columns c = 64, 128, ... (skipping
                         columns adjacent to the tile edge seam) of
                         mean |col[c] - col[c - 1]|
    typical horizontal = the same over rows

Criterion: a seam passes when its mean diff <= RATIO_MAX * the typical diff
for its direction, RATIO_MAX = 2.0. Source: the R-h threshold of
tools/tx-land-score.py and the MAP_TREATMENT Step 19 acceptance line "the
3 x 3 seam check passes for every map texture". Every seam of every texture
must pass. One check = one texture in one direction (both seams of that
direction), plus one byte identity check per payload.

Out of scope: the F06 band coverage note does NOT belong here; this tool
measures seams only.

Exit status: 0 when every check passes, 1 on counted failures (seam ratio
over the limit, or data module bytes not identical to the .webp on disk),
2 on harness errors (missing file, no base64 payload found, undecodable
payload).

Run: python3 tools/seam-check.py
"""
import base64
import hashlib
import io
import os
import re
import sys

import numpy as np
from PIL import Image

# Seam passes when its mean diff is at most this multiple of the typical diff.
RATIO_MAX = 2.0
# Typical-line sampling stride in px (every 64th row/column).
STRIDE = 64
# Tiling factor for the seam construction.
TILES = 3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (label, shipped webp, data module the game loads)
PAYLOADS = (
    ("TX-LAND", "art-direction/bakeoff/TX-LAND/candidate-b.webp", "js/tx-land-data.js"),
    ("TX-SEA", "art-direction/textures/TX-SEA/candidate-b.webp", "js/tx-sea-data.js"),
    ("TX-PAPER", "art-direction/textures/TX-PAPER/candidate-b.webp", "js/tx-paper-data.js"),
    ("TX-FOG-UK", "art-direction/textures/TX-FOG-UK/candidate-b.webp", "js/tx-foguk-data.js"),
    ("TX-FOG-LS", "art-direction/textures/TX-FOG-LS/candidate-b.webp", "js/tx-fogls-data.js"),
    ("RX01/RX02", "art-direction/textures/RX01/candidate-b.webp", "js/rx-data.js"),
)

# The data modules assign one single quoted base64 literal:
#   var AshesTxLandData = 'UklGR...';
# An optional data URI prefix is tolerated.
B64_RE = re.compile(r"var\s+\w+\s*=\s*'(?:data:image/webp;base64,)?([A-Za-z0-9+/=]+)'\s*;")


class HarnessError(Exception):
    pass


def line_diff(a, b):
    return float(np.mean(np.abs(a - b)))


def extract_payload(js_path):
    with open(js_path, "r", encoding="utf-8") as f:
        text = f.read()
    found = B64_RE.findall(text)
    if len(found) != 1:
        raise HarnessError("%s: expected exactly 1 base64 literal, found %d"
                           % (os.path.relpath(js_path, ROOT), len(found)))
    try:
        return base64.b64decode(found[0], validate=True)
    except ValueError as e:
        raise HarnessError("%s: base64 decode failed: %s"
                           % (os.path.relpath(js_path, ROOT), e))


def decode_webp(data, label):
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as e:
        raise HarnessError("%s: shipped payload is not decodable: %s" % (label, e))
    if im.format != "WEBP":
        raise HarnessError("%s: shipped payload decodes as %s, not WEBP" % (label, im.format))
    return np.asarray(im.convert("RGB"), dtype=np.float64)


def typical(tile, axis):
    # axis 0: adjacent rows (horizontal typical); axis 1: adjacent columns.
    n = tile.shape[axis]
    vals = []
    for i in range(STRIDE, n, STRIDE):
        # Skip lines adjacent to the tile edge seam (between n - 1 and 0).
        if i <= 1 or i >= n - 1:
            continue
        if axis == 0:
            vals.append(line_diff(tile[i], tile[i - 1]))
        else:
            vals.append(line_diff(tile[:, i], tile[:, i - 1]))
    if not vals:
        raise HarnessError("tile too small for stride %d" % STRIDE)
    return float(np.median(vals))


def seams(tile, axis):
    h, w = tile.shape[:2]
    big = np.tile(tile, (TILES, TILES, 1))
    out = []
    if axis == 0:
        for k in range(1, TILES):
            y = k * h
            out.append(line_diff(big[y], big[y - 1]))
    else:
        for k in range(1, TILES):
            x = k * w
            out.append(line_diff(big[:, x], big[:, x - 1]))
    return out


def check_payload(label, webp_rel, js_rel):
    """Return (passed, total) counted checks for one payload."""
    webp_path = os.path.join(ROOT, webp_rel)
    js_path = os.path.join(ROOT, js_rel)
    for p in (webp_path, js_path):
        if not os.path.isfile(p):
            raise HarnessError("missing: " + os.path.relpath(p, ROOT))
    with open(webp_path, "rb") as f:
        disk = f.read()
    shipped = extract_payload(js_path)
    disk_sha = hashlib.sha256(disk).hexdigest()
    ship_sha = hashlib.sha256(shipped).hexdigest()
    passed = 0
    total = 1
    same = shipped == disk
    print("%s | %s bytes identity | disk %s sha256 %s | %s %s sha256 %s"
          % ("PASS" if same else "FAIL", label, webp_rel, disk_sha,
             js_rel, len(shipped), ship_sha))
    if same:
        passed += 1

    tile = decode_webp(shipped, label)
    h, w = tile.shape[:2]
    luma = 0.299 * tile[:, :, 0] + 0.587 * tile[:, :, 1] + 0.114 * tile[:, :, 2]
    print("INFO | %s | %dx%d px | mean luma %.2f | luma sd %.2f | webp %d bytes"
          % (label, w, h, float(luma.mean()), float(luma.std()), len(shipped)))

    for name, axis in (("vertical", 1), ("horizontal", 0)):
        s = seams(tile, axis)
        t = typical(tile, axis)
        ratios = [v / t if t > 0 else float("inf") for v in s]
        worst = max(ratios)
        ok = all(r <= RATIO_MAX for r in ratios)
        total += 1
        if ok:
            passed += 1
        print("%s | %s %s seams | ratio worst %.4f (seams %s; typical %.4f)"
              % ("PASS" if ok else "FAIL", label, name, worst,
                 ", ".join("%.4f" % v for v in s), t))
    return passed, total


def main():
    passed = 0
    total = 0
    try:
        for label, webp_rel, js_rel in PAYLOADS:
            p, t = check_payload(label, webp_rel, js_rel)
            passed += p
            total += t
    except HarnessError as e:
        print("harness error: %s" % e, file=sys.stderr)
        return 2
    print("seam check: %d of %d checks pass (ratio max %.1f, %d x %d tiling)"
          % (passed, total, RATIO_MAX, TILES, TILES))
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
