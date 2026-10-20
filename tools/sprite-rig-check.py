"""Verify the Step 22a sprite rig, golden frame, and golden test unit passes.

Cycle 23 Step 22a, per VISUAL_STRATEGY 4.1, 4.2, 4.4, 4.5 gate A3 and
STRATEGY gates G10, G11, G12. System python3 with PIL and numpy; no colour
library, the tint formula and Delta E 2000 are implemented here.

Run (from the repo root):
  python3 tools/sprite-rig-check.py            run every check
  python3 tools/sprite-rig-check.py --record   run every check, then write the
                                               measured block into
                                               blender/golden/golden_v1.json
  python3 tools/sprite-rig-check.py --diff A B golden diff of two PNGs only
                                               (used by the build script)
Prints one PASS or FAIL line per check with measured values; exits 0 only
when every check passes.

ROUTE: the golden is established and re-rendered on local Blender 5.2.2 LTS,
Cycles CPU (see tools/build-sprite-rig.py). The A100 and L4 pass is owed.

Reading: PNGs are 16 bit RGBA; Pillow opens them as 8 bit RGBA, so every
value below is in 8 bit levels (0 to 255).

Checks:
  G11 golden diff (VISUAL_STRATEGY 4.2 tolerances applied): re-render
    blender/golden/golden_v1.blend through Blender 5.2.2 to a temp file and
    diff against blender/golden/golden_v1.png in premultiplied RGB plus alpha,
    all four channels. Pass: mean absolute difference 1.0 level or less, and
    99.5 percent of pixels have every channel within 8 levels. The stricter
    STRATEGY G11 set (mean 0.5 or less, 99.5th percentile 3 or less) is
    printed alongside for the record.
  G10 swatch round trip: blender/golden/passes/testunit_swatchmask.png is the
    swatch card's emission patch rendered through the mask pass settings with
    the 0.5 mask material (G10 interpreted on the emission patch). Pass: every
    pixel of the 9 x 9 window at the patch centre has R, G, B within 128
    plus or minus 1, alpha 255.
  A3 beauty patch: the same window on the fresh golden re-render's emission
    patch. Pass: every pixel's R, G, B within 128 plus or minus 2.
  A3 tint: the section 4.4 formula with k = 1 and mask 1 applied to the patch
    mean; Delta E 2000 against Vessari #2E6FD8 and Khessite #C8372D. Pass:
    both 2.0 or less.
  A3 luma order: the three lit TINT_paint patches (sunward, square, away)
    keep the order sunward > square > away in Rec 601 luma before tint and
    after tint with each nation colour (mask 1), each pre-tint step at least
    3 levels.
  A3 edges: test unit beauty and mask alpha (above 0.5) agree within 1 render
    px: every pixel in one and not the other has a pixel of the other within
    its 3 x 3 neighbourhood.
  G12 light direction: in the fresh golden re-render, the probe sphere's
    highlight (centroid of the disk pixels within 2 levels of the disk's
    maximum luma) sits in the upper left quadrant of the sphere's bounding
    box: dx < 0 and dy < 0 from the box centre (image y down).
  Anchor: in testunit_beauty.png the alpha (above 0.5) column centroid is
    within 2 px of anchor x 112, the anchor pixel (112, 168) is opaque, and
    the lowest opaque row is within 2 px of the projected front edge of the
    0.5 m base (168 + 0.5 x 112 x sin 45 = 207.6). The anchor itself was
    asserted in Blender by projecting the world origin (manifest value).
  Ink: the Ink cube's opaque pixels in the golden have mean Rec 601 luma
    under 40.
"""
import datetime
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = os.environ.get("BLENDER", os.path.expanduser("~/.local/bin/blender"))
GOLDEN_BLEND = os.path.join(ROOT, "blender", "golden", "golden_v1.blend")
GOLDEN_PNG = os.path.join(ROOT, "blender", "golden", "golden_v1.png")
GOLDEN_JSON = os.path.join(ROOT, "blender", "golden", "golden_v1.json")
PASSES_DIR = os.path.join(ROOT, "blender", "golden", "passes")
PASSES_JSON = os.path.join(PASSES_DIR, "testunit.json")

MAD_MAX = 1.0
WITHIN_LEVELS = 8
WITHIN_FRACTION = 0.995
STRICT_MAD_MAX = 0.5
STRICT_P995_MAX = 3.0
SWATCH_TARGET = 128
SWATCH_TOL = 1
PATCH_TOL = 2
DE_MAX = 2.0
LUMA_STEP_MIN = 3.0
INK_LUMA_MAX = 40.0
ANCHOR_TOL_PX = 2.0
WINDOW = 9
NATIONS = {"Vessari": "#2E6FD8", "Khessite": "#C8372D"}
K = 1.0

RERENDER = r"""
import sys, bpy
if tuple(bpy.app.version) != (5, 2, 2):
    print("pinned Blender 5.2.2 required, got " + bpy.app.version_string)
    sys.exit(1)
bpy.context.scene.render.filepath = sys.argv[sys.argv.index("--") + 1]
bpy.ops.render.render(write_still=True)
"""


def load(path):
    im = Image.open(path)
    im.load()
    return np.asarray(im.convert("RGBA")).astype(np.float64)


def golden_diff(a_path, b_path):
    a, b = load(a_path), load(b_path)
    if a.shape != b.shape:
        return False, "shape %r against %r" % (a.shape, b.shape), {}

    def premul(x):
        y = x.copy()
        y[:, :, :3] = x[:, :, :3] * x[:, :, 3:4] / 255.0
        return y

    d = np.abs(premul(a) - premul(b))
    mad = float(d.mean())
    per_px = d.max(axis=2)
    within = float((per_px <= WITHIN_LEVELS).mean())
    p995 = float(np.percentile(d, 99.5))
    dmax = float(d.max())
    ok = mad <= MAD_MAX and within >= WITHIN_FRACTION
    strict = mad <= STRICT_MAD_MAX and p995 <= STRICT_P995_MAX
    line = ("mean abs diff %.4f levels (max %.1f), pixels within %d levels %.4f%% (min %.1f%%), "
            "max diff %.2f; STRATEGY G11 set: p99.5 %.3f, strict set %s"
            % (mad, MAD_MAX, WITHIN_LEVELS, within * 100, WITHIN_FRACTION * 100, dmax, p995,
               "met" if strict else "not met"))
    return ok, line, {"mean_abs_diff_levels": round(mad, 4), "pixels_within_8_fraction": round(within, 6),
                      "p99_5_levels": round(p995, 4), "max_diff_levels": round(dmax, 4),
                      "strategy_g11_strict_met": strict}


def window(img, center):
    cx, cy = int(math.floor(center[0])), int(math.floor(center[1]))
    h = WINDOW // 2
    return img[cy - h:cy + h + 1, cx - h:cx + h + 1]


def luma(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def tint(beauty_levels, nation_levels, mask=1.0, k=K):
    # VISUAL_STRATEGY 4.4, per channel, all values 0 to 1.
    b = beauty_levels / 255.0
    t = nation_levels / 255.0
    overlay = np.where(b < 0.5, 2 * b * t, 1 - 2 * (1 - b) * (1 - t))
    return (b + (overlay - b) * mask * k) * 255.0


def srgb_to_lab(rgb_levels):
    c = np.asarray(rgb_levels, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = m @ lin / np.array([0.95047, 1.0, 1.08883])
    e, kap = 216 / 24389, 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (kap * xyz + 16) / 116)
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def delta_e_2000(lab1, lab2):
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p else 0.0
    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    elif h2p - h1p > 180:
        dhp = h2p - h1p - 360
    else:
        dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dtheta = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dtheta)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def rerender(out_path):
    res = subprocess.run([BLENDER, "--background", GOLDEN_BLEND, "--python-expr", RERENDER, "--", out_path],
                         capture_output=True, text=True)
    if res.returncode != 0 or not os.path.exists(out_path):
        raise RuntimeError("golden re-render failed: %s" % (res.stdout[-800:] + res.stderr[-800:]))
    for line in res.stdout.splitlines():
        if line.startswith("Blender ") and "hash" in line:
            return line.strip()
    return "Blender (version line not printed)"


def run_checks():
    with open(GOLDEN_JSON) as f:
        gm = json.load(f)
    with open(PASSES_JSON) as f:
        pm = json.load(f)
    results, measured = [], {}

    def report(name, ok, text):
        results.append(ok)
        print("%s %s: %s" % ("PASS" if ok else "FAIL", name, text))

    tmp = tempfile.mkdtemp(prefix="aoe-sprite-check-")
    try:
        fresh_path = os.path.join(tmp, "golden_rerender.png")
        version_line = rerender(fresh_path)
        ok, line, vals = golden_diff(GOLDEN_PNG, fresh_path)
        report("G11 golden diff (VISUAL_STRATEGY 4.2)", ok, line + "; " + version_line)
        measured["golden_diff"] = vals
        fresh = load(fresh_path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    scene = gm["scene"]
    patches = scene["swatch_card"]["patch_centers_px"]

    sm = load(os.path.join(ROOT, pm["outputs"]["swatchmask"]["file"]))
    w = window(sm, pm["outputs"]["swatchmask"]["patch_center_px"])
    rgb = w[..., :3]
    ok = bool(np.all(np.abs(rgb - SWATCH_TARGET) <= SWATCH_TOL) and np.all(w[..., 3] == 255))
    report("G10 swatch round trip", ok, "mask swatch window mean %.3f min %d max %d alpha min %d (target %d plus or minus %d)"
           % (rgb.mean(), rgb.min(), rgb.max(), w[..., 3].min(), SWATCH_TARGET, SWATCH_TOL))
    measured["g10_swatch_mask"] = {"mean": round(float(rgb.mean()), 3), "min": int(rgb.min()), "max": int(rgb.max())}

    w = window(fresh, patches["CARD_emission"])
    rgb = w[..., :3]
    patch_mean = rgb.reshape(-1, 3).mean(axis=0)
    ok = bool(np.all(np.abs(rgb - 128) <= PATCH_TOL))
    report("A3 beauty patch", ok, "emission patch mean (%.3f, %.3f, %.3f) min %d max %d (target 128 plus or minus %d)"
           % (tuple(patch_mean) + (rgb.min(), rgb.max(), PATCH_TOL)))
    measured["a3_beauty_patch"] = {"mean_rgb": [round(float(v), 3) for v in patch_mean],
                                   "min": int(rgb.min()), "max": int(rgb.max())}

    des = {}
    for nation, hx in NATIONS.items():
        t = hex_rgb(hx)
        out = tint(patch_mean, t)
        des[nation] = delta_e_2000(srgb_to_lab(out), srgb_to_lab(t))
    ok = all(v <= DE_MAX for v in des.values())
    report("A3 tint Delta E 2000", ok, ", ".join("%s %s %.4f" % (n, NATIONS[n], v) for n, v in des.items())
           + " (max %.1f)" % DE_MAX)
    measured["a3_delta_e_2000"] = {n: round(v, 4) for n, v in des.items()}

    order = scene["swatch_card"]["lit_patches"]
    lit = {n: window(fresh, patches[n])[..., :3].reshape(-1, 3).mean(axis=0) for n in order}
    pre = [float(luma(lit[n])) for n in order]
    ok = all(pre[i] - pre[i + 1] >= LUMA_STEP_MIN for i in range(len(pre) - 1))
    parts = ["pre %s" % "/".join("%.2f" % v for v in pre)]
    lm = {"pre": [round(v, 3) for v in pre]}
    for nation, hx in NATIONS.items():
        post = [float(luma(tint(lit[n], hex_rgb(hx)))) for n in order]
        ok = ok and all(post[i] > post[i + 1] for i in range(len(post) - 1))
        parts.append("%s %s" % (nation, "/".join("%.2f" % v for v in post)))
        lm[nation] = [round(v, 3) for v in post]
    report("A3 luma order", ok, "%s > %s > %s: " % tuple(order) + ", ".join(parts))
    measured["a3_luma_order"] = lm

    beauty = load(os.path.join(ROOT, pm["outputs"]["beauty"]["file"]))
    mask = load(os.path.join(ROOT, pm["outputs"]["mask"]["file"]))
    ba, ma = beauty[..., 3] > 127.5, mask[..., 3] > 127.5

    def dilate(m):
        p = np.pad(m, 1)
        out = np.zeros_like(m)
        for dy in (0, 1, 2):
            for dx in (0, 1, 2):
                out |= p[dy:dy + m.shape[0], dx:dx + m.shape[1]]
        return out

    stray = int(((ba & ~dilate(ma)) | (ma & ~dilate(ba))).sum())
    xor = int((ba ^ ma).sum())
    report("A3 edges", stray == 0, "beauty and mask alpha differ on %d px, %d of them farther than 1 px" % (xor, stray))
    measured["a3_edges"] = {"differing_px": xor, "beyond_1px": stray}

    pc = scene["probe_sphere"]["center_px"]
    r = scene["probe_sphere"]["radius_px"]
    yy, xx = np.mgrid[0:fresh.shape[0], 0:fresh.shape[1]]
    disk = ((xx + 0.5 - pc[0]) ** 2 + (yy + 0.5 - pc[1]) ** 2 <= (r - 1.5) ** 2) & (fresh[..., 3] > 250)
    lum = luma(fresh[..., :3])
    peak = lum[disk].max()
    hl = disk & (lum >= peak - 2.0)
    hx_, hy_ = float((xx[hl] + 0.5).mean()), float((yy[hl] + 0.5).mean())
    dx, dy = hx_ - pc[0], hy_ - pc[1]
    quadrant = ("upper" if dy < 0 else "lower") + " " + ("left" if dx < 0 else "right")
    report("G12 light direction", dx < 0 and dy < 0,
           "probe highlight at (%.2f, %.2f), %s of sphere centre (%.2f, %.2f) by dx %.2f dy %.2f px, peak luma %.1f, %d px"
           % (hx_, hy_, quadrant, pc[0], pc[1], dx, dy, peak, int(hl.sum())))
    measured["g12_highlight"] = {"quadrant": quadrant, "dx_px": round(dx, 2), "dy_px": round(dy, 2),
                                 "peak_luma": round(float(peak), 2)}

    ax, ay = pm["anchor_px"]
    rows, cols = np.nonzero(ba)
    cx = float((cols + 0.5).mean())
    bottom = float(rows.max() + 1)
    expected_bottom = ay + 0.5 * 112 * math.sin(math.radians(45))
    ok = abs(cx - ax) <= ANCHOR_TOL_PX and bool(ba[ay, ax]) and abs(bottom - expected_bottom) <= ANCHOR_TOL_PX
    report("Anchor", ok, "beauty alpha column centroid x %.2f (anchor %d), anchor pixel opaque %s, lowest opaque edge "
           "y %.1f (expected %.1f), projected origin %r" % (cx, ax, bool(ba[ay, ax]), bottom, expected_bottom,
                                                            pm["anchor_projected_px"]))
    measured["anchor"] = {"alpha_centroid_x": round(cx, 2), "bottom_edge_y": bottom,
                          "expected_bottom_edge_y": round(expected_bottom, 2), "anchor_opaque": bool(ba[ay, ax])}

    x0, y0, x1, y1 = scene["screen_regions_px"]["ink_cube"]
    reg = fresh[int(math.ceil(y0)):int(y1), int(math.ceil(x0)):int(x1)]
    opaque = reg[..., 3] > 250
    ink = float(luma(reg[..., :3])[opaque].mean())
    report("Ink luma", ink < INK_LUMA_MAX, "Ink cube mean luma %.2f over %d px (under %.0f)" % (ink, int(opaque.sum()), INK_LUMA_MAX))
    measured["ink_mean_luma"] = round(ink, 2)

    return all(results), measured


def main(argv):
    if len(argv) >= 1 and argv[0] == "--diff":
        ok, line, _ = golden_diff(argv[1], argv[2])
        print("%s golden diff: %s" % ("PASS" if ok else "FAIL", line))
        return 0 if ok else 1
    ok, measured = run_checks()
    if "--record" in argv:
        with open(GOLDEN_JSON) as f:
            gm = json.load(f)
        with open(GOLDEN_PNG, "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
        measured = dict({"golden_png_sha256": sha, "date": datetime.date.today().isoformat(),
                         "tool": "tools/sprite-rig-check.py", "all_pass": ok}, **measured)
        gm["measured"] = measured
        gm.pop("measured_note", None)
        with open(GOLDEN_JSON, "w") as f:
            json.dump(gm, f, indent=2)
            f.write("\n")
        print("recorded measured block in " + os.path.relpath(GOLDEN_JSON, ROOT))
    print("SPRITE RIG CHECK: %s" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
