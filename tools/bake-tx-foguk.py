"""Bake TX-FOG-UK Candidate B in Blender, headless.

Cycle 23 Step 19c, per MAP_TREATMENT 6.5 and 7.3: the Step 18c bake-off
winner route (Candidate B, Blender material through CAM_TEX at 1024 px) sets
the route for TX-FOG-UK. Modeled on tools/bake-tx-paper.py and
tools/bake-tx-sea.py (Step 19b); same rig settings, its own rig file. No
rendition session: the material is a procedural remake from the measured
flat tone, the same remake pattern Steps 19a and 19b used.

Spec (MAP_TREATMENT 6.5): TX-FOG-UK replaces the flat Unknown fill (the
CHART_UNKNOWN fill, FOG_UNKNOWN_FILL). It is a pattern with mean luma 205
plus or minus 3 and standard deviation 6 or less, created with createPattern
at load time and drawn at alpha 1. MAP_TREATMENT 7.3 surface: plain warm
paper grain.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-tx-foguk.py

Render engine: Cycles, CPU device. Denoise off and a fixed sample count so the
bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m; camera
CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale 2.0;
1024 x 1024; view transform Standard, look None; seed 0; filter width 1.5;
emission only, no lights, no shadows. The plane mesh runs 0.1 m past the
2 m tile (PLANE_HALF). Saved to blender/rig/aoe_rig_txfoguk_v1.blend, never over an
existing rig file.

Material TX_FOG_UK_paper: plain warm paper grain only, no mottling, no flecks.
Emission colour = base tone x fine grain factor, the grain sampled on the
TX-LAND torus embedded in 4D (u = pi (x + 1), v = pi (y + 1); vector =
(cos u, sin u, cos v) / pi, W = sin v / pi), so the tile wraps seamlessly.

Base tone: FOG_UNKNOWN_FILL #DCCDA8 in js/map-canvas.js, sRGB (220, 205, 168) (Rec 601
luma 205.3), baked at exactly this tone so the composite keeps its measured
value.

Hard limits (Rec 601 luma), measured on the baked PNG and re-checked on the
decoded WebP (what the board draws); the script exits 1 if any fails: mean
202 to 208, sd at most 5, min at least 185, max at most 224.

Output: art-direction/textures/TX-FOG-UK/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 90). Blender's bundled Python has no PIL, so the
last step shells to the system python3 to re-save the PNG without Blender's
metadata chunks, write the WebP, and measure the luma limits on both.

RESULT (Step 19c bake): measured on candidate-b.png: mean sRGB 219.99,
204.99, 167.99; luma mean 205.26, sd 1.41, min 199.38, max 211.15. The
decoded WebP (what the board draws) measures luma mean 205.46, sd 0.72, min
201.38, max 210.38, inside the 6.5 spec (205 plus or minus 3, sd 6 or less).
Seam ratios by the tools/tx-land-score.py method: PNG 0.94 (H) and 0.95 (V),
WebP 1.46 and 1.44 (pass under 2). Gain 0.25 (the TX-PAPER value) held every
limit with margin on the first bake, so no step-down was needed. Two runs
give the same PNG sha256
04b75b38ba56ed0cd0da0e08ca9afe90df9a14c932bfbdecae25866c903c4bd9.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Base tone, sRGB 0..255: FOG_UNKNOWN_FILL #DCCDA8 in js/map-canvas.js.
BASE_SRGB = (220, 205, 168)
# Grain noise scale, features per metre (as TX-LAND): a very fine paper tooth.
GRAIN_SCALE = 200.0
# Grain noise detail octaves (as TX-LAND).
GRAIN_DETAIL = 4.0
# Grain gain: colour factor = 1 + GRAIN_GAIN * (noise - 0.5). Small, so the
# luma stays inside the hard limits with margin on the decoded WebP too.
GRAIN_GAIN = 0.25
# Hard luma limits (Rec 601), checked after the bake on the PNG and on the
# decoded WebP (what the board draws).
LUMA_MEAN_MIN = 202.0
LUMA_MEAN_MAX = 208.0
LUMA_SD_MAX = 5.0
LUMA_MAX = 224.0
LUMA_MIN = 185.0
# Path-trace samples: enough to settle sub-pixel grain antialiasing.
SAMPLES = 32
# Render seed, per VISUAL_STRATEGY 4.1.
SEED = 0
# Pixel filter width in px, per VISUAL_STRATEGY 4.1.
FILTER_WIDTH = 1.5
# Output edge in px, per VISUAL_STRATEGY 4.1 CAM_TEX.
RES = 1024
# CAM_TEX ortho scale in metres, equal to the tile size.
ORTHO_SCALE = 2.0
# Plane half size in metres: 0.1 m (51 px) past the tile on every side so
# the pixel filter at the frame edge samples wrapped paper (as TX-LAND).
PLANE_HALF = 1.1
# WebP quality, per the bake-off spec.
WEBP_QUALITY = 90

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "art-direction", "textures", "TX-FOG-UK")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_txfoguk_v1.blend")

CONVERT = r"""
import sys
from PIL import Image
src, webp, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
im.load()
im.save(src, format="PNG", optimize=False)
im.save(webp, format="WEBP", quality=q, method=6)

def stats(img, label):
    px = list(img.getdata())
    luma = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
    n = len(luma)
    mean = sum(luma) / n
    sd = (sum((v - mean) ** 2 for v in luma) / n) ** 0.5
    print("%s luma mean %.2f sd %.2f min %.2f max %.2f" % (label, mean, sd, min(luma), max(luma)))

stats(im, "png")
dec = Image.open(webp).convert("RGB")
dec.load()
stats(dec, "webp")
"""


def srgb_to_linear(c8):
    out = []
    for v in c8:
        c = v / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "AOE_RIG"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.cycles.seed = SEED
    scene.cycles.use_animated_seed = False
    scene.cycles.filter_width = FILTER_WIDTH
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.use_stamp = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    img = scene.render.image_settings
    img.file_format = "PNG"
    img.color_mode = "RGB"
    img.color_depth = "8"
    img.compression = 15

    world = bpy.data.worlds.new("WORLD_flat")
    world.color = (0.0, 0.0, 0.0)
    scene.world = world

    cam_data = bpy.data.cameras.new("CAM_TEX")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ORTHO_SCALE
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam = bpy.data.objects.new("CAM_TEX", cam_data)
    cam.location = (0.0, 0.0, 10.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    mesh = bpy.data.meshes.new("TX_plane")
    h = PLANE_HALF
    mesh.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
    mesh.update()
    plane = bpy.data.objects.new("TX_plane", mesh)
    scene.collection.objects.link(plane)
    plane.data.materials.append(build_material())
    return scene


def build_material():
    mat = bpy.data.materials.new("TX_FOG_UK_paper")
    if mat.node_tree is None:
        mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()

    def math_node(op, a=None, b=None, c=None):
        n = nodes.new("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                links.new(v, n.inputs[i])
        return n.outputs[0]

    tex = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tex.outputs["Object"], sep.inputs[0])

    # Angles around the torus: u, v in [0, 2 pi] over the plane's [-1, 1].
    u = math_node("MULTIPLY_ADD", sep.outputs["X"], math.pi, math.pi)
    v = math_node("MULTIPLY_ADD", sep.outputs["Y"], math.pi, math.pi)
    inv_pi = 1.0 / math.pi
    cu = math_node("MULTIPLY", math_node("COSINE", u), inv_pi)
    su = math_node("MULTIPLY", math_node("SINE", u), inv_pi)
    cv = math_node("MULTIPLY", math_node("COSINE", v), inv_pi)
    sv = math_node("MULTIPLY", math_node("SINE", v), inv_pi)
    comb = nodes.new("ShaderNodeCombineXYZ")
    links.new(cu, comb.inputs[0])
    links.new(su, comb.inputs[1])
    links.new(cv, comb.inputs[2])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    links.new(comb.outputs[0], noise.inputs["Vector"])
    links.new(sv, noise.inputs["W"])
    noise.inputs["Scale"].default_value = GRAIN_SCALE
    noise.inputs["Detail"].default_value = GRAIN_DETAIL
    noise.inputs["Roughness"].default_value = 0.5
    noise.inputs["Distortion"].default_value = 0.0

    # factor = 1 + GRAIN_GAIN * (noise - 0.5) = noise * GAIN + (1 - GAIN / 2)
    grain = math_node("MULTIPLY_ADD", noise.outputs["Fac"], GRAIN_GAIN, 1.0 - GRAIN_GAIN / 2.0)
    base = nodes.new("ShaderNodeRGB")
    base.outputs[0].default_value = srgb_to_linear(BASE_SRGB)
    scale = nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    links.new(base.outputs[0], scale.inputs[0])
    links.new(grain, scale.inputs["Scale"])

    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    links.new(scale.outputs["Vector"], emit.inputs["Color"])
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def convert_outputs():
    py = shutil.which("python3")
    if py is None:
        raise RuntimeError("system python3 with PIL not found for WebP conversion")
    res = subprocess.run([py, "-c", CONVERT, OUT_PNG, OUT_WEBP, str(WEBP_QUALITY)],
                         check=True, capture_output=True, text=True)
    lines = [ln for ln in res.stdout.strip().splitlines() if " luma mean " in ln]
    if len(lines) != 2:
        raise RuntimeError("TX-FOG-UK measurement missing: %r" % (res.stdout,))
    for line in lines:
        print(line)
        parts = line.split()
        mean, sd, lo, hi = float(parts[3]), float(parts[5]), float(parts[7]), float(parts[9])
        if not (LUMA_MEAN_MIN <= mean <= LUMA_MEAN_MAX and sd <= LUMA_SD_MAX
                and lo >= LUMA_MIN and hi <= LUMA_MAX):
            raise RuntimeError("TX-FOG-UK luma outside the hard limits: " + line)


def main():
    scene = build_scene()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(RIG), exist_ok=True)
    # No .blend1 backup next to the rig on re-runs.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=RIG)
    scene.render.filepath = OUT_PNG
    bpy.ops.render.render(write_still=True)
    convert_outputs()
    print("wrote " + os.path.relpath(OUT_PNG, ROOT))
    print("wrote " + os.path.relpath(OUT_WEBP, ROOT))
    print("wrote " + os.path.relpath(RIG, ROOT))


try:
    main()
except Exception as exc:
    print("bake failed: %r" % (exc,), file=sys.stderr)
    sys.exit(1)
