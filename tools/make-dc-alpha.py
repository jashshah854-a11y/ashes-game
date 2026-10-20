"""Turn the DC01 to DC07 luminance bakes into straight alpha ink decals.

Cycle 23 Step 20b. Applies RESEARCH.md P9 (luminance alpha), as written, to
each art-direction/textures/DCxx/candidate-b.png from tools/bake-dc.py:
  1. L = Rec. 709 luminance of the sRGB values in 0..1
     (0.2126 R + 0.7152 G + 0.0722 B).
  2. alpha = clamp((1 - L - 0.04) / 0.86, 0, 1).
  3. Gaussian blur of the alpha channel, radius 0.7 px.
  4. RGB set to the flat board ink (43, 38, 32), CHART_INK #2B2620.
  5. The outer 8 px frame of alpha set to 0.
Output: candidate-b-alpha.png beside each source, 8 bit RGBA, straight
alpha, 256 x 256 (STRATEGY G17: decals at most 256).

Run (from the repo root): python3 tools/make-dc-alpha.py
Plain python3 with PIL and numpy; deterministic. Prints, per output, its byte
size, its sha256, the count of fully opaque pixels (must be above 0), and the
count of frame pixels with alpha above 0 (must be 0). Exits 1 if either
limit fails.
"""
import hashlib
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

INK = (43, 38, 32)
FRAME = 8
BLUR_RADIUS = 0.7
SIZE = 256
VARIANTS = ["DC01", "DC02", "DC03", "DC04", "DC05", "DC06", "DC07"]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, "art-direction", "textures")


def convert(vid):
    src = os.path.join(TEX_DIR, vid, "candidate-b.png")
    dst = os.path.join(TEX_DIR, vid, "candidate-b-alpha.png")
    im = Image.open(src).convert("RGB")
    if im.size != (SIZE, SIZE):
        raise RuntimeError("%s is %r, not %d square" % (src, im.size, SIZE))
    rgb = np.asarray(im).astype(np.float64) / 255.0
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    alpha = np.clip((1.0 - lum - 0.04) / 0.86, 0.0, 1.0)
    a8 = Image.fromarray(np.round(alpha * 255.0).astype(np.uint8), mode="L")
    a8 = a8.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))
    a = np.array(a8, dtype=np.uint8)
    a[:FRAME, :] = 0
    a[-FRAME:, :] = 0
    a[:, :FRAME] = 0
    a[:, -FRAME:] = 0
    out = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    out[:, :, 0] = INK[0]
    out[:, :, 1] = INK[1]
    out[:, :, 2] = INK[2]
    out[:, :, 3] = a
    Image.fromarray(out, mode="RGBA").save(dst, format="PNG", optimize=False)

    check = np.asarray(Image.open(dst).convert("RGBA"))
    ca = check[:, :, 3]
    frame_mask = np.ones((SIZE, SIZE), dtype=bool)
    frame_mask[FRAME:-FRAME, FRAME:-FRAME] = False
    opaque = int((ca == 255).sum())
    frame_inked = int((ca[frame_mask] > 0).sum())
    data = open(dst, "rb").read()
    sha = hashlib.sha256(data).hexdigest()
    print("%s %s bytes %d sha256 %s opaque %d frame_alpha_above_0 %d"
          % (vid, os.path.relpath(dst, ROOT), len(data), sha, opaque, frame_inked))
    return opaque > 0 and frame_inked == 0


def main():
    ok = True
    for vid in VARIANTS:
        ok = convert(vid) and ok
    if not ok:
        print("DC alpha limits failed", file=sys.stderr)
        sys.exit(1)


main()
