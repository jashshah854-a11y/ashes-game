#!/usr/bin/env python3
"""Build TX-LAND bake-off Candidate A from rendition R2-TX-LAND-c4.

Cycle 23 Step 18c-1, per MAP_TREATMENT 7.4 and VISUAL_STRATEGY 6.3.
Deterministic and idempotent: same source in, same bytes out. The source
rendition is only read, never written.

Pipeline (in this order):
  1. Crop to CROP_BOX, dropping the lamp rim and its cast shadow at top left.
  2. Flatten the lamp falloff: illumination = Gaussian blur (sigma BLUR_SIGMA,
     reflect padding) per channel; out = pixel / illumination * channel mean.
  3. Resize to OUT_SIZE with LANCZOS.
  4. Toroidal cross-fade, separable: blend with the half-width wrap using
     weights that are 0 at the left/right edge and 1 past FEATHER px, then
     the same vertically with the half-height wrap. At every tile edge the
     output is the wrapped copy, whose edge pixels are original neighbours,
     so the offset cross disappears; the wrapped copy's own seam sits in the
     tile centre where its weight is 0.

Deviation from the brief's listed order: the crop runs before the flatten
(so the dark rim does not bleed into the illumination estimate near the crop
edge) and the resize runs before the cross-fade (so LANCZOS never filters
across a non-wrapping border of an already seamless tile).

Run: python3 tools/make-tx-land-candidates.py
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

# Gaussian sigma in source px; 200 px is far above the grain and fleck scale
# (under 20 px) and below the lamp falloff scale (the full 1600 px frame).
BLUR_SIGMA = 200.0
# Crop box (left, top, right, bottom) in source px. Measured from the file:
# 25 px box-blurred luma below 170 (rim plus its shadow) reaches at most
# x 343, y 260, x+y 346; this 1280 x 1280 box starts at (320, 320) and so
# contains none of it.
CROP_BOX = (320, 320, 1600, 1600)
# Final tile edge in px, the spec size for the map ground texture.
OUT_SIZE = 1024
# Cross-fade feather band in output px: 10 percent of the 1024 px tile width.
FEATHER = 102
# WebP quality, per the bake-off spec.
WEBP_QUALITY = 90

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-direction", "renditions", "TX-LAND", "R2-TX-LAND-c4.png")
OUT_DIR = os.path.join(ROOT, "art-direction", "bakeoff", "TX-LAND")
OUT_PNG = os.path.join(OUT_DIR, "candidate-a.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-a.webp")


def flatten(img):
    """Divide out low frequency illumination per channel, keep the channel mean."""
    out = np.empty_like(img)
    for c in range(img.shape[2]):
        ch = img[:, :, c]
        illum = gaussian_filter(ch, sigma=BLUR_SIGMA, mode="reflect")
        out[:, :, c] = ch / np.maximum(illum, 1e-6) * ch.mean()
    return out


def edge_weight(n):
    """Weight 0 at both edges rising to 1 at FEATHER px in, smoothstep shaped."""
    idx = np.arange(n, dtype=np.float64)
    d = np.minimum(idx, n - 1 - idx)
    t = np.clip(d / FEATHER, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def make_seamless(img):
    h, w = img.shape[:2]
    wx = edge_weight(w)[None, :, None]
    img = wx * img + (1.0 - wx) * np.roll(img, w // 2, axis=1)
    wy = edge_weight(h)[:, None, None]
    img = wy * img + (1.0 - wy) * np.roll(img, h // 2, axis=0)
    return img


def main():
    if not os.path.isfile(SRC):
        print("missing source: " + SRC, file=sys.stderr)
        return 1
    src = Image.open(SRC).convert("RGB")
    img = np.asarray(src.crop(CROP_BOX), dtype=np.float64)
    img = flatten(img)
    img8 = Image.fromarray(np.clip(np.rint(img), 0, 255).astype(np.uint8), "RGB")
    img8 = img8.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    img = make_seamless(np.asarray(img8, dtype=np.float64))
    out = Image.fromarray(np.clip(np.rint(img), 0, 255).astype(np.uint8), "RGB")
    os.makedirs(OUT_DIR, exist_ok=True)
    out.save(OUT_PNG, format="PNG", optimize=False)
    out.save(OUT_WEBP, format="WEBP", quality=WEBP_QUALITY, method=6)
    print("wrote " + os.path.relpath(OUT_PNG, ROOT))
    print("wrote " + os.path.relpath(OUT_WEBP, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
