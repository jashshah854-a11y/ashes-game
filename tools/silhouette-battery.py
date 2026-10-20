"""Silhouette battery: generate the judge sheet and legend, and score judges.

Cycle 23 Step 22b, per VISUAL_STRATEGY 4.6 (silhouette battery), serving
gate A2 of 4.5 (admission: the battery at final display size scores 100
percent for every board family) and gate R-d of 3.7 (segment the subject
from the background, fill it Ink on Paper, scale to 56 px, 64 for S-CAP).
System python3 with PIL and numpy only; no network, no font file.

Run (from the repo root):
  python3 tools/silhouette-battery.py --inputs DIR --out DIR [--seed N]
      generate legend.png, tiles.png and key.json into the out DIR
  python3 tools/silhouette-battery.py --score KEY_JSON ANSWERS_JSON [...]
      score one answers file per judge against key.json
Exit codes: 0 pass (generation succeeded, or every judge 100 percent with
at least 3 judges), 1 scoring fail, 2 hard error (bad inputs or answers).

Inputs contract:
  DIR holds one beauty PNG per family named <ID>_beauty.png. ID is one of
  U-INF, U-DRN, U-FLT, S-CTY, S-CAP, S-FAC, S-FRT, or a terrain piece ID
  starting with T- (for example T-FOR). All seven named families and at
  least one T- piece are required; a missing one, or an ID that is neither
  named nor T-, is a hard error (exit 2). Files not ending in _beauty.png
  are ignored. Sources are the 4x renders (224 px, S-CAP 256 px); PNGs are
  16 bit RGBA and Pillow opens them as 8 bit RGBA, as in
  tools/sprite-rig-check.py. A source that is not square, is smaller than
  its display size, or has an empty mask is a hard error (exit 2).

Silhouette extraction (gate R-d wording):
  mask = alpha above 0.5, that is alpha 128 or more in 8 bit levels. Crop
  to the mask bounding box, scale to fit inside the display box (56 x 56,
  S-CAP 64 x 64) preserving aspect: scale s = min(D / w, D / h), scaled
  size max(1, w * s) by max(1, h * s) rounded half up, nearest neighbour
  sampling src = floor((dst + 0.5) * w / nw), all in exact integer
  arithmetic (Pillow's NEAREST resize uses fixed point and was measured
  one source row off at an exact pixel centre, so it is not used).
  Pasted centered (offset floor((D - n) / 2)) on a Paper tile of exactly
  the display box. Every tile pixel is exactly Ink #2B2620 or exactly
  Paper #E6D8B5; no anti-aliasing anywhere.

Outputs (no timestamps; same inputs and seed give byte identical files):
  legend.png  one row per family in canonical order (U-INF, U-DRN, U-FLT,
              S-CTY, S-CAP, S-FAC, S-FRT, then T- pieces in ID order): the
              family's display tile scaled 4x nearest (224 px, S-CAP 256
              px; the same silhouette the judge sees, magnified) with its
              plain name to the right in Ink. Names: infantry, drone,
              flotilla, city, capital, factory, fort, terrain. Text is the
              Pillow default font rendered in 1 bit mode (no anti-aliasing)
              and scaled up nearest, so the legend is Ink and Paper only.
  tiles.png   2 copies of every family, shuffled with random.Random(seed)
              (default seed 20261020), in a row major grid of uniform
              64 x 64 cells. Each family's tile (56 px, S-CAP 64 px) is
              centered in its cell on Paper; cells are separated by 2 px
              Ink gutters (between cells, no outer frame); unused cells in
              the last row are Paper. No labels, numbers or marks.
  key.json    the answer key, never shown to judges: seed, display sizes,
              cell and gutter, grid, tile count, legend order, and tiles in
              sheet order {index, family, answer}. Every T- piece answers
              "terrain".

Scoring (gate A2 rule): each ANSWERS_JSON is one judge's JSON list of plain
names in sheet order (compared after trimming and lower casing). Pass only
with at least MIN_JUDGES = 3 answer files and every judge at PASS_PERCENT =
100. Per VISUAL_STRATEGY 4.6 any confusion between two families fails both
until a model changes; the confusions printed name both families.

Honest limits: the battery judges silhouettes only (not tint, value, or
finish). This tool does not create models or renders. A 100 percent score
is only meaningful from at least 3 independent fresh-eyes judge sessions
run later on real family renders (the Step 5b and 5c fresh-eyes
precedent); a scripted or self-graded run proves the tool, not the art.
"""
import argparse
import json
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAPER_HEX = "#E6D8B5"
INK_HEX = "#2B2620"
PAPER = (0xE6, 0xD8, 0xB5)
INK = (0x2B, 0x26, 0x20)

ALPHA_THRESHOLD = 128  # alpha above 0.5 in 8 bit levels
MIN_JUDGES = 3
PASS_PERCENT = 100
COPIES = 2
DEFAULT_SEED = 20261020
LEGEND_SCALE = 4
CELL = 64
GUTTER = 2

FAMILIES = ["U-INF", "U-DRN", "U-FLT", "S-CTY", "S-CAP", "S-FAC", "S-FRT"]
PLAIN_NAMES = {
    "U-INF": "infantry",
    "U-DRN": "drone",
    "U-FLT": "flotilla",
    "S-CTY": "city",
    "S-CAP": "capital",
    "S-FAC": "factory",
    "S-FRT": "fort",
}
TERRAIN_NAME = "terrain"
DISPLAY = {"S-CAP": 64}
DISPLAY_DEFAULT = 56
SUFFIX = "_beauty.png"

LEGEND_MARGIN = 16
LEGEND_ROW_GAP = 16
LEGEND_TEXT_GAP = 32
TEXT_SCALE = 4


class BatteryError(Exception):
    pass


def display_size(fid):
    return DISPLAY.get(fid, DISPLAY_DEFAULT)


def plain_name(fid):
    return TERRAIN_NAME if fid.startswith("T-") else PLAIN_NAMES[fid]


def is_terrain(fid):
    return fid.startswith("T-") and len(fid) > 2


def collect_inputs(inputs_dir):
    if not os.path.isdir(inputs_dir):
        raise BatteryError("inputs dir not found: %s" % inputs_dir)
    found = {}
    unknown = []
    for name in sorted(os.listdir(inputs_dir)):
        if not name.endswith(SUFFIX):
            continue
        fid = name[: -len(SUFFIX)]
        if fid in PLAIN_NAMES or is_terrain(fid):
            found[fid] = os.path.join(inputs_dir, name)
        else:
            unknown.append(fid)
    if unknown:
        raise BatteryError("unknown family ID(s): %s" % ", ".join(unknown))
    missing = [f for f in FAMILIES if f not in found]
    if not any(is_terrain(f) for f in found):
        missing.append("T-xxx (at least one terrain piece)")
    if missing:
        raise BatteryError("missing family ID(s): %s" % ", ".join(missing))
    order = FAMILIES + sorted(f for f in found if is_terrain(f))
    return order, found


def load_mask(path):
    im = Image.open(path)
    im.load()
    a = np.asarray(im.convert("RGBA"))[:, :, 3]
    return a >= ALPHA_THRESHOLD


def fit_mask(mask, box):
    """Crop to the mask bounding box and fit inside box x box, nearest."""
    ys, xs = np.nonzero(mask)
    if ys.size == 0:
        raise BatteryError("empty mask")
    crop = mask[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    h, w = crop.shape
    m = max(w, h)
    nw = max(1, (2 * w * box + m) // (2 * m))
    nh = max(1, (2 * h * box + m) // (2 * m))
    nw, nh = min(nw, box), min(nh, box)
    sx = ((2 * np.arange(nw) + 1) * w) // (2 * nw)
    sy = ((2 * np.arange(nh) + 1) * h) // (2 * nh)
    scaled = crop[sy][:, sx]
    out = np.zeros((box, box), dtype=bool)
    oy, ox = (box - nh) // 2, (box - nw) // 2
    out[oy: oy + nh, ox: ox + nw] = scaled
    return out


def silhouette(fid, path):
    im = Image.open(path)
    w, h = im.size
    d = display_size(fid)
    if w != h:
        raise BatteryError("%s: source %d x %d is not square" % (fid, w, h))
    if w < d:
        raise BatteryError("%s: source %d px is smaller than display size %d px" % (fid, w, d))
    try:
        return fit_mask(load_mask(path), d)
    except BatteryError:
        raise BatteryError("%s: empty mask (no alpha above 0.5)" % fid)


def paint(mask):
    rgb = np.empty(mask.shape + (3,), dtype=np.uint8)
    rgb[:] = PAPER
    rgb[mask] = INK
    return rgb


def text_mask(s):
    font = ImageFont.load_default()
    probe = Image.new("1", (1, 1), 0)
    l, t, r, b = ImageDraw.Draw(probe).textbbox((0, 0), s, font=font)
    im = Image.new("1", (r - l + 2, b - t + 2), 0)
    ImageDraw.Draw(im).text((1 - l, 1 - t), s, fill=1, font=font)
    m = np.asarray(im, dtype=bool)
    return np.repeat(np.repeat(m, TEXT_SCALE, axis=0), TEXT_SCALE, axis=1)


def build_legend(order, sil):
    big = {f: np.repeat(np.repeat(sil[f], LEGEND_SCALE, axis=0), LEGEND_SCALE, axis=1) for f in order}
    texts = {f: text_mask(plain_name(f)) for f in order}
    col = max(m.shape[1] for m in big.values())
    text_w = max(t.shape[1] for t in texts.values())
    width = LEGEND_MARGIN + col + LEGEND_TEXT_GAP + text_w + LEGEND_MARGIN
    rows_h = [max(big[f].shape[0], texts[f].shape[0]) for f in order]
    height = LEGEND_MARGIN * 2 + sum(rows_h) + LEGEND_ROW_GAP * (len(order) - 1)
    canvas = np.zeros((height, width), dtype=bool)
    y = LEGEND_MARGIN
    for f, rh in zip(order, rows_h):
        b = big[f]
        by = y + (rh - b.shape[0]) // 2
        bx = LEGEND_MARGIN + (col - b.shape[1]) // 2
        canvas[by: by + b.shape[0], bx: bx + b.shape[1]] = b
        t = texts[f]
        ty = y + (rh - t.shape[0]) // 2
        tx = LEGEND_MARGIN + col + LEGEND_TEXT_GAP
        canvas[ty: ty + t.shape[0], tx: tx + t.shape[1]] = t
        y += rh + LEGEND_ROW_GAP
    return paint(canvas)


def grid_shape(n):
    cols = int(np.ceil(np.sqrt(n)))
    rows = int(np.ceil(n / cols))
    return cols, rows


def build_tiles(sheet, sil):
    cols, rows = grid_shape(len(sheet))
    width = cols * CELL + (cols - 1) * GUTTER
    height = rows * CELL + (rows - 1) * GUTTER
    ink = np.ones((height, width), dtype=bool)
    for i in range(rows * cols):
        r, c = divmod(i, cols)
        y0, x0 = r * (CELL + GUTTER), c * (CELL + GUTTER)
        cell = np.zeros((CELL, CELL), dtype=bool)
        if i < len(sheet):
            m = sil[sheet[i]]
            o = (CELL - m.shape[0]) // 2
            cell[o: o + m.shape[0], o: o + m.shape[1]] = m
        ink[y0: y0 + CELL, x0: x0 + CELL] = cell
    return paint(ink), cols, rows


def save_png(rgb, path):
    # optimize off and no metadata so the bytes depend on the pixels only
    Image.fromarray(rgb, "RGB").save(path, format="PNG", optimize=False)


def generate(inputs_dir, out_dir, seed):
    order, found = collect_inputs(inputs_dir)
    sil = {f: silhouette(f, found[f]) for f in order}
    sheet = [f for f in order for _ in range(COPIES)]
    random.Random(seed).shuffle(sheet)
    os.makedirs(out_dir, exist_ok=True)
    save_png(build_legend(order, sil), os.path.join(out_dir, "legend.png"))
    tiles, cols, rows = build_tiles(sheet, sil)
    save_png(tiles, os.path.join(out_dir, "tiles.png"))
    key = {
        "spec": "VISUAL_STRATEGY 4.6 silhouette battery, gate A2",
        "seed": seed,
        "copies_per_family": COPIES,
        "display_sizes": {f: display_size(f) for f in order},
        "cell_px": CELL,
        "gutter_px": GUTTER,
        "cell_rule": "uniform 64 x 64 cells, each family tile (56 px, S-CAP 64 px) centered on Paper, 2 px Ink gutters between cells",
        "grid": {"cols": cols, "rows": rows},
        "tile_count": len(sheet),
        "legend_order": [{"family": f, "answer": plain_name(f)} for f in order],
        "tiles": [{"index": i, "family": f, "answer": plain_name(f)} for i, f in enumerate(sheet)],
        "pass_rule": {"min_judges": MIN_JUDGES, "pass_percent": PASS_PERCENT},
    }
    with open(os.path.join(out_dir, "key.json"), "w", newline="\n") as fh:
        json.dump(key, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print("generated %d tiles (%d families x %d) in a %d x %d grid, seed %d -> %s"
          % (len(sheet), len(order), COPIES, cols, rows, seed, out_dir))
    return 0


def load_json(path, what):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError) as e:
        raise BatteryError("%s %s unreadable: %s" % (what, path, e))


def score(key_path, answer_paths):
    key = load_json(key_path, "key")
    try:
        tiles = key["tiles"]
        expected = [t["answer"] for t in tiles]
    except (KeyError, TypeError):
        raise BatteryError("key %s has no tiles list" % key_path)
    judges = []
    for p in answer_paths:
        ans = load_json(p, "answers")
        if not isinstance(ans, list) or not all(isinstance(a, str) for a in ans):
            raise BatteryError("answers %s must be a JSON list of strings" % p)
        if len(ans) != len(expected):
            raise BatteryError("answers %s has %d entries, key has %d tiles" % (p, len(ans), len(expected)))
        judges.append((p, [a.strip().lower() for a in ans]))
    all_perfect = True
    for p, ans in judges:
        wrong = [i for i, a in enumerate(ans) if a != expected[i]]
        correct = len(expected) - len(wrong)
        pct = 100.0 * correct / len(expected)
        if correct * 100 < PASS_PERCENT * len(expected):
            all_perfect = False
        print("judge %s: %d / %d correct, %.1f percent" % (p, correct, len(expected), pct))
        for i in wrong:
            print("  tile %d: answered %s, correct %s (family %s)"
                  % (i, ans[i] or "(blank)", expected[i], tiles[i]["family"]))
    enough = len(judges) >= MIN_JUDGES
    if not enough:
        print("FAIL: %d judge file(s); at least %d independent judges required" % (len(judges), MIN_JUDGES))
    if not all_perfect:
        print("FAIL: every judge must score %d percent" % PASS_PERCENT)
    if enough and all_perfect:
        print("PASS: %d judges, every judge %d percent" % (len(judges), PASS_PERCENT))
        return 0
    return 1


def main(argv):
    ap = argparse.ArgumentParser(description="VISUAL_STRATEGY 4.6 silhouette battery")
    ap.add_argument("--inputs")
    ap.add_argument("--out")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--score", nargs="+", metavar="JSON")
    args = ap.parse_args(argv)
    try:
        if args.score:
            if args.inputs or args.out:
                raise BatteryError("--score does not take --inputs or --out")
            if len(args.score) < 2:
                raise BatteryError("--score needs KEY_JSON and at least one ANSWERS_JSON")
            return score(args.score[0], args.score[1:])
        if not args.inputs or not args.out:
            raise BatteryError("generation needs --inputs DIR and --out DIR")
        return generate(args.inputs, args.out, args.seed)
    except BatteryError as e:
        print("ERROR: %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
