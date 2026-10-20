"""Validate the silhouette battery tool before any real board family exists.

Cycle 23 Step 22b, per VISUAL_STRATEGY 4.6 (silhouette battery), gate A2
of 4.5 and gate R-d of 3.7. Proves tools/silhouette-battery.py works; it
does not run a judge session and does not judge any art. System python3
with PIL and numpy only.

Run (from the repo root):
  python3 tools/silhouette-check.py
Prints one PASS or FAIL line per check; exits 0 only when every check
passes. Everything is written under temp dirs that are removed at the end;
no file in the repo is written.

Fixtures: the sources built here are TOOL FIXTURES, NOT GAME ART. One
trivially distinct geometric shape per required family plus one T-FOR
terrain piece, drawn on transparent 8 bit RGBA PNGs at the 4x render sizes
(224 px; S-CAP 256 px): circle U-INF, triangle U-DRN, wide flat rectangle
U-FLT, tall rectangle S-CTY, diamond S-CAP, ring S-FAC, cross S-FRT, blob
cluster T-FOR. The circle carries a wide band at alpha 127 (just under 0.5)
that the alpha above 0.5 rule must drop; if it leaked, the circle tile's
Ink bounding box would turn wide instead of square.

Checks:
  1 generation: exit 0 and legend.png, tiles.png, key.json exist.
  2 tile count: 2 per family (7 named + T-FOR = 16 tiles), 2 of each
    answer, T-FOR answers terrain.
  3 Ink or Paper only: every tiles.png pixel outside the gutters, and
    every legend.png pixel, is exactly Ink #2B2620 or Paper #E6D8B5; every
    gutter pixel is Ink; every tile has at least 20 Ink pixels.
  4 geometry: tiles.png is the grid of uniform 64 x 64 cells with 2 px
    gutters between; each tile's Ink lies inside its 56 px (S-CAP 64 px)
    centered box; legend rows at 4x display size (224, S-CAP 256).
  5 determinism: two runs with one seed are byte identical in all three
    outputs; another seed changes the key tile order (a collision FAILs).
  6 scoring: 3 perfect judges exit 0 at 100 percent; one judge with one
    tile wrong exits 1 and the confusion names the tile index and both
    names; 2 judge files exit 1; a wrong length list exits 2.
  7 error paths: missing family, unknown ID, no T- piece, empty alpha,
    and a non-square source each exit 2.
  8 fidelity: for every tile on the sheet, the Ink set equals exactly an
    independent re-derivation of the fit rule from the fixture source
    (exact Fraction pixel centres here, integer index mapping in the
    tool), and
    the circle tile's Ink box is square (alpha 127 band dropped).

Honest limits: passing proves the tool, not any model. The A2 gate is only
served by at least 3 independent fresh-eyes judge sessions run later on
real family renders (the Step 5b and 5c fresh-eyes precedent).
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATTERY = os.path.join(ROOT, "tools", "silhouette-battery.py")
PAPER = (0xE6, 0xD8, 0xB5)
INK = (0x2B, 0x26, 0x20)
CELL = 64
GUTTER = 2
SEED = 20261020
FAMILIES = ["U-INF", "U-DRN", "U-FLT", "S-CTY", "S-CAP", "S-FAC", "S-FRT", "T-FOR"]
NAMES = {"U-INF": "infantry", "U-DRN": "drone", "U-FLT": "flotilla", "S-CTY": "city",
         "S-CAP": "capital", "S-FAC": "factory", "S-FRT": "fort", "T-FOR": "terrain"}
DISPLAY = {f: (64 if f == "S-CAP" else 56) for f in FAMILIES}
SOURCE = {f: (256 if f == "S-CAP" else 224) for f in FAMILIES}
MIN_INK = 20

results = []


def report(name, ok, detail):
    results.append(ok)
    print("%s %s: %s" % ("PASS" if ok else "FAIL", name, detail))


def draw_fixture(fid, size):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size
    solid = (90, 90, 90, 255)
    if fid == "U-INF":
        d.rectangle([s * 0.05, s * 0.45, s * 0.95, s * 0.55], fill=(90, 90, 90, 127))
        d.ellipse([s * 0.25, s * 0.25, s * 0.75, s * 0.75], fill=solid)
    elif fid == "U-DRN":
        d.polygon([(s * 0.5, s * 0.1), (s * 0.9, s * 0.85), (s * 0.1, s * 0.85)], fill=solid)
    elif fid == "U-FLT":
        d.rectangle([s * 0.08, s * 0.45, s * 0.92, s * 0.6], fill=solid)
    elif fid == "S-CTY":
        d.rectangle([s * 0.4, s * 0.1, s * 0.6, s * 0.9], fill=solid)
    elif fid == "S-CAP":
        d.polygon([(s * 0.5, s * 0.1), (s * 0.9, s * 0.5), (s * 0.5, s * 0.9), (s * 0.1, s * 0.5)], fill=solid)
    elif fid == "S-FAC":
        d.ellipse([s * 0.1, s * 0.1, s * 0.9, s * 0.9], fill=solid)
        d.ellipse([s * 0.3, s * 0.3, s * 0.7, s * 0.7], fill=(0, 0, 0, 0))
    elif fid == "S-FRT":
        d.rectangle([s * 0.42, s * 0.1, s * 0.58, s * 0.9], fill=solid)
        d.rectangle([s * 0.1, s * 0.42, s * 0.9, s * 0.58], fill=solid)
    elif fid == "T-FOR":
        for cx, cy, r in [(0.3, 0.35, 0.14), (0.62, 0.3, 0.12), (0.45, 0.65, 0.16), (0.75, 0.68, 0.1)]:
            d.ellipse([s * (cx - r), s * (cy - r), s * (cx + r), s * (cy + r)], fill=solid)
    return im


def make_inputs(d, families=FAMILIES, empty=None, extra=None, bad_size=None):
    os.makedirs(d, exist_ok=True)
    for f in families:
        size = SOURCE.get(f, 224)
        if f == bad_size:
            im = draw_fixture(f, size).crop((0, 0, size, size - 10))
        elif f == empty:
            im = Image.new("RGBA", (size, size), (90, 90, 90, 127))
        else:
            im = draw_fixture(f, size)
        im.save(os.path.join(d, f + "_beauty.png"))
    for f in extra or []:
        draw_fixture("U-INF", 224).save(os.path.join(d, f + "_beauty.png"))
    return d


def run(args):
    p = subprocess.run([sys.executable, BATTERY] + args, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def rgb(path):
    return np.asarray(Image.open(path).convert("RGB"))


def is_color(a, c):
    return np.all(a == np.array(c, dtype=np.uint8), axis=-1)


def rederive(src_path, box):
    """Independent fit rule: alpha >= 128, bbox crop, fit, nearest by exact
    rational pixel centres (Fraction, per pixel), not the tool's code path."""
    a = np.asarray(Image.open(src_path).convert("RGBA"))[:, :, 3] >= 128
    ys, xs = np.nonzero(a)
    crop = a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    h, w = crop.shape
    s = min(Fraction(box, w), Fraction(box, h))
    nw = max(1, math.floor(w * s + Fraction(1, 2)))
    nh = max(1, math.floor(h * s + Fraction(1, 2)))
    out = np.zeros((box, box), dtype=bool)
    oy, ox = (box - nh) // 2, (box - nw) // 2
    for y in range(nh):
        sy = math.floor((y + Fraction(1, 2)) * Fraction(h, nh))
        for x in range(nw):
            sx = math.floor((x + Fraction(1, 2)) * Fraction(w, nw))
            out[oy + y, ox + x] = crop[sy, sx]
    return out


def cell_origin(i, cols):
    r, c = divmod(i, cols)
    return r * (CELL + GUTTER), c * (CELL + GUTTER)


def files_bytes(d):
    return {n: open(os.path.join(d, n), "rb").read() for n in ("legend.png", "tiles.png", "key.json")}


def main():
    tmp = tempfile.mkdtemp(prefix="silhouette-check-")
    try:
        src = make_inputs(os.path.join(tmp, "src"))
        out = os.path.join(tmp, "out")

        # 1 generation
        code, txt = run(["--inputs", src, "--out", out])
        present = all(os.path.isfile(os.path.join(out, n)) for n in ("legend.png", "tiles.png", "key.json"))
        report("1 generation", code == 0 and present, "exit %d, outputs present %s" % (code, present))
        if not (code == 0 and present):
            print(txt)
            return 1
        key = json.load(open(os.path.join(out, "key.json")))
        tiles = key["tiles"]

        # 2 tile count
        counts = {}
        for t in tiles:
            counts[t["answer"]] = counts.get(t["answer"], 0) + 1
        fam_counts = {}
        for t in tiles:
            fam_counts[t["family"]] = fam_counts.get(t["family"], 0) + 1
        tfor = [t["answer"] for t in tiles if t["family"] == "T-FOR"]
        ok2 = (len(tiles) == 16 and key["tile_count"] == 16
               and all(fam_counts.get(f) == 2 for f in FAMILIES)
               and sorted(counts) == sorted(NAMES.values()) and all(v == 2 for v in counts.values())
               and tfor == ["terrain", "terrain"]
               and [t["index"] for t in tiles] == list(range(16))
               and all(t["answer"] == NAMES[t["family"]] for t in tiles))
        report("2 tile count", ok2, "%d tiles, per answer %s, T-FOR answers %s" % (len(tiles), counts, tfor))

        # 3 Ink or Paper only
        sheet = rgb(os.path.join(out, "tiles.png"))
        cols, rows = key["grid"]["cols"], key["grid"]["rows"]
        gutter = np.ones(sheet.shape[:2], dtype=bool)
        for i in range(cols * rows):
            y0, x0 = cell_origin(i, cols)
            gutter[y0: y0 + CELL, x0: x0 + CELL] = False
        ink, paper = is_color(sheet, INK), is_color(sheet, PAPER)
        stray = int((~gutter & ~ink & ~paper).sum())
        gutter_bad = int((gutter & ~ink).sum())
        legend = rgb(os.path.join(out, "legend.png"))
        legend_stray = int((~is_color(legend, INK) & ~is_color(legend, PAPER)).sum())
        ink_counts = []
        for i in range(len(tiles)):
            y0, x0 = cell_origin(i, cols)
            ink_counts.append(int(ink[y0: y0 + CELL, x0: x0 + CELL].sum()))
        ok3 = stray == 0 and gutter_bad == 0 and legend_stray == 0 and min(ink_counts) >= MIN_INK
        report("3 Ink or Paper only", ok3,
               "stray tile pixels %d, non Ink gutter pixels %d, stray legend pixels %d, min Ink per tile %d (need %d)"
               % (stray, gutter_bad, legend_stray, min(ink_counts), MIN_INK))

        # 4 geometry
        exp_w, exp_h = cols * CELL + (cols - 1) * GUTTER, rows * CELL + (rows - 1) * GUTTER
        outside = 0
        for i, t in enumerate(tiles):
            y0, x0 = cell_origin(i, cols)
            cell_ink = ink[y0: y0 + CELL, x0: x0 + CELL].copy()
            dsz = DISPLAY[t["family"]]
            o = (CELL - dsz) // 2
            cell_ink[o: o + dsz, o: o + dsz] = False
            outside += int(cell_ink.sum())
        # legend: each row's silhouette band is 4x display size; measure Ink height of the silhouette column
        lg_ink = is_color(legend, INK)
        col_w = 4 * max(DISPLAY.values())
        sil_col = lg_ink[:, 16: 16 + col_w]
        ok_sizes = key["display_sizes"] == DISPLAY and key["cell_px"] == CELL and key["gutter_px"] == GUTTER
        exp_legend_h = 16 * 2 + sum(4 * DISPLAY[f] for f in FAMILIES) + 16 * (len(FAMILIES) - 1)
        ok4 = (sheet.shape[1] == exp_w and sheet.shape[0] == exp_h and (cols, rows) == (4, 4)
               and outside == 0 and ok_sizes and legend.shape[0] == exp_legend_h and sil_col.any()
               and [e["family"] for e in key["legend_order"]] == FAMILIES)
        report("4 geometry", ok4,
               "tiles.png %d x %d (expect %d x %d, %d x %d grid of %d px cells, %d px gutters), Ink outside display box %d, "
               "legend height %d (expect %d from 4x rows)"
               % (sheet.shape[1], sheet.shape[0], exp_w, exp_h, cols, rows, CELL, GUTTER, outside,
                  legend.shape[0], exp_legend_h))

        # 5 determinism
        out2, out3 = os.path.join(tmp, "out2"), os.path.join(tmp, "out3")
        c2, _ = run(["--inputs", src, "--out", out2, "--seed", str(SEED)])
        c3, _ = run(["--inputs", src, "--out", out3, "--seed", str(SEED + 1)])
        same = c2 == 0 and files_bytes(out) == files_bytes(out2)
        order_a = [t["family"] for t in tiles]
        order_b = [t["family"] for t in json.load(open(os.path.join(out3, "key.json")))["tiles"]] if c3 == 0 else order_a
        report("5 determinism", same and order_a != order_b,
               "same seed byte identical %s, seed %d order differs from seed %d %s" % (same, SEED + 1, SEED, order_a != order_b))

        # 6 scoring
        kp = os.path.join(out, "key.json")
        perfect = [t["answer"] for t in tiles]
        jp = []
        for n in range(3):
            p = os.path.join(tmp, "judge%d.json" % n)
            json.dump([a.upper() if n == 2 else a for a in perfect], open(p, "w"))
            jp.append(p)
        c_ok, t_ok = run(["--score", kp] + jp)
        wrong = list(perfect)
        wrong_i = 5
        wrong_ans = "drone" if perfect[wrong_i] != "drone" else "fort"
        wrong[wrong_i] = wrong_ans
        wp = os.path.join(tmp, "judge_wrong.json")
        json.dump(wrong, open(wp, "w"))
        c_bad, t_bad = run(["--score", kp, jp[0], jp[1], wp])
        line = "tile %d: answered %s, correct %s (family %s)" % (wrong_i, wrong_ans, perfect[wrong_i], tiles[wrong_i]["family"])
        c_two, _ = run(["--score", kp, jp[0], jp[1]])
        sp = os.path.join(tmp, "judge_short.json")
        json.dump(perfect[:-1], open(sp, "w"))
        c_len, _ = run(["--score", kp, jp[0], jp[1], sp])
        ok6 = (c_ok == 0 and t_ok.count("16 / 16 correct, 100.0 percent") == 3
               and c_bad == 1 and line in t_bad and "15 / 16 correct" in t_bad
               and c_two == 1 and c_len == 2)
        report("6 scoring", ok6,
               "3 perfect judges exit %d, one wrong exit %d with confusion line %s, two judges exit %d, short list exit %d"
               % (c_ok, c_bad, line in t_bad, c_two, c_len))

        # 7 error paths
        cases = {
            "missing S-FRT": make_inputs(os.path.join(tmp, "e1"), families=[f for f in FAMILIES if f != "S-FRT"]),
            "unknown X-FOO": make_inputs(os.path.join(tmp, "e2"), extra=["X-FOO"]),
            "no T- piece": make_inputs(os.path.join(tmp, "e3"), families=[f for f in FAMILIES if f != "T-FOR"]),
            "empty alpha U-DRN": make_inputs(os.path.join(tmp, "e4"), empty="U-DRN"),
            "non-square S-CTY": make_inputs(os.path.join(tmp, "e5"), bad_size="S-CTY"),
        }
        codes = {k: run(["--inputs", v, "--out", os.path.join(tmp, "eo")])[0] for k, v in cases.items()}
        report("7 error paths", all(c == 2 for c in codes.values()),
               ", ".join("%s exit %d" % (k, c) for k, c in codes.items()))

        # 8 fidelity
        mism = {}
        expected = {f: rederive(os.path.join(src, f + "_beauty.png"), DISPLAY[f]) for f in FAMILIES}
        for i, t in enumerate(tiles):
            y0, x0 = cell_origin(i, cols)
            dsz = DISPLAY[t["family"]]
            o = (CELL - dsz) // 2
            got = ink[y0 + o: y0 + o + dsz, x0 + o: x0 + o + dsz]
            diff = int((got != expected[t["family"]]).sum())
            if diff:
                mism[i] = diff
        ci = tiles.index(next(t for t in tiles if t["family"] == "U-INF"))
        y0, x0 = cell_origin(ci, cols)
        ys, xs = np.nonzero(ink[y0: y0 + CELL, x0: x0 + CELL])
        cw, ch = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
        report("8 fidelity", not mism and cw == ch,
               "tiles matching the independent re-derivation pixel for pixel %d / %d%s; circle tile Ink box %d x %d "
               "(square means the alpha 127 band was dropped)"
               % (len(tiles) - len(mism), len(tiles), (", mismatched pixels " + str(mism)) if mism else "", cw, ch))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("%d / %d checks pass" % (sum(results), len(results)))
    return 0 if results and all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
