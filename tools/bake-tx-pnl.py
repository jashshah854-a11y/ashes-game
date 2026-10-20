"""Bake TX-PNL Candidate B, the UI panel grain tile, in Blender, headless.

Cycle 23 Step 20a, per MAP_TREATMENT 8.1 Step 20 and VISUAL_STRATEGY 3.4
("the paper and brass of the UI panels"): the Step 19 route (Blender
material through CAM_TEX at 1024 px) sets the route for TX-PNL. Modeled on
tools/bake-tx-paper.py; same CAM_TEX settings, its own rig file.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-tx-pnl.py

Render engine: Cycles, CPU device. Denoise off and a fixed sample count so the
bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m; camera
CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale 2.0;
1024 x 1024; view transform Standard, look None; seed 0; filter width 1.5;
emission only, no lights, no shadows. The plane mesh runs 0.1 m past the
2 m tile (PLANE_HALF). Saved to blender/rig/aoe_rig_txpnl_v1.blend, never
over an existing rig file.

Material TX_PNL_grain: a neutral grain tile for a soft-light blend over the
dark DOM panels (cards #22252a, sub panels #1c1f23), so it must not shift
the panel tone. Emission colour = neutral mid gray x fine paper tooth grain
factor x a very faint, luma neutral warm brass tint factor. Both noises are
sampled on the TX-LAND torus embedded in 4D (u = pi (x + 1), v = pi (y + 1);
vector = (cos u, sin u, cos v) / pi, W = sin v / pi), so the tile wraps
seamlessly even though VISUAL_STRATEGY 3.7 R-h exempts TX-PNL.

Normalisation shape (as tools/bake-rx.py): Rec 601 luma mean 128 plus or
minus 2, standard deviation at most 10. Unlike RX there is no affine remap:
the material itself is built to land there, and only GRAIN_GAIN is tuned.
Hard limits, checked on the PNG and on the decoded WebP; the script exits 1
if any fails: mean 126 to 130, sd at most 10.

Output: art-direction/textures/TX-PNL/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 95, as TX-PAPER). Blender's bundled Python has no
PIL, so the last step shells to the system python3 to re-save the PNG
without Blender's metadata chunks, write the WebP, and measure both.

RESULT (Step 20a bake, GRAIN_GAIN 2.2): PNG luma mean 127.70, sd 7.75,
min 90.00, max 156.11, max chroma 2, mean sRGB 127.70, 127.70, 127.68
(1281045 bytes). Decoded WebP at quality 95: luma mean 127.81, sd 7.74,
min 92.00, max 156.00, max chroma 5 (314458 bytes). A second run reproduced
both files byte identical. Gain 1.0 gave sd 3.52 (mean 127.94), too faint
to read over the dark panels after soft-light, so 2.2 ships with margin
under the sd 10 limit.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Base tone, sRGB 0..255: neutral mid gray, Rec 601 luma 128.
BASE_SRGB = (128, 128, 128)
# Grain noise scale, features per metre (as TX-LAND and TX-PAPER): a very
# fine paper tooth.
GRAIN_SCALE = 200.0
# Grain noise detail octaves (as TX-PAPER).
GRAIN_DETAIL = 4.0
# Grain gain: colour factor = 1 + GRAIN_GAIN * (noise - 0.5), in linear
# light. The one tuned knob; sets the luma sd.
GRAIN_GAIN = 2.2
# Brass tint noise scale, features per metre: broad, faint patches.
TINT_SCALE = 6.0
# Brass tint gain: per channel factor = 1 + TINT_GAIN * (noise - 0.5) * DIR.
TINT_GAIN = 0.12
# Warm brass direction per linear channel, chosen luma neutral to first
# order (0.299 R + 0.587 G + 0.114 B = 0): red and green up, blue down.
TINT_DIR = (0.12, 0.08, -0.72)
# Hard luma limits (Rec 601), checked on the PNG and on the decoded WebP.
LUMA_MEAN_MIN = 126.0
LUMA_MEAN_MAX = 130.0
LUMA_SD_MAX = 10.0
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
# the pixel filter at the frame edge samples wrapped grain (as TX-PAPER).
PLANE_HALF = 1.1
# WebP quality, as TX-PAPER (fine grain survives the seam check at 95).
WEBP_QUALITY = 95

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "art-direction", "textures", "TX-PNL")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_txpnl_v1.blend")

CONVERT = r"""
import sys
import numpy as np
from PIL import Image
src, webp, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
im.load()
im.save(src, format="PNG", optimize=False)
im.save(webp, format="WEBP", quality=q, method=6)

def stats(img, label):
    x = np.asarray(img.convert("RGB")).astype(np.float64)
    y = 0.299 * x[:, :, 0] + 0.587 * x[:, :, 1] + 0.114 * x[:, :, 2]
    chroma = int((x.max(axis=2) - x.min(axis=2)).max())
    rgb = x.reshape(-1, 3).mean(axis=0)
    print("%s luma mean %.2f sd %.2f min %.2f max %.2f chroma %d rgb %.2f %.2f %.2f"
          % (label, y.mean(), y.std(), y.min(), y.max(), chroma, rgb[0], rgb[1], rgb[2]))

stats(Image.open(src), "png")
dec = Image.open(webp)
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
    mat = bpy.data.materials.new("TX_PNL_grain")
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

    def torus_noise(scale, detail):
        n = nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = "4D"
        links.new(comb.outputs[0], n.inputs["Vector"])
        links.new(sv, n.inputs["W"])
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = 0.5
        n.inputs["Distortion"].default_value = 0.0
        return n.outputs["Fac"]

    # Grain: factor = 1 + GRAIN_GAIN * (noise - 0.5) = noise * GAIN + (1 - GAIN / 2)
    grain = math_node("MULTIPLY_ADD", torus_noise(GRAIN_SCALE, GRAIN_DETAIL),
                      GRAIN_GAIN, 1.0 - GRAIN_GAIN / 2.0)
    # Tint amount: TINT_GAIN * (noise - 0.5), centred on zero.
    tint_amt = math_node("MULTIPLY_ADD", torus_noise(TINT_SCALE, 2.0),
                         TINT_GAIN, -TINT_GAIN / 2.0)
    # Per channel tint factor = (1, 1, 1) + tint_amt * TINT_DIR.
    tint_vec = nodes.new("ShaderNodeVectorMath")
    tint_vec.operation = "MULTIPLY_ADD"
    links.new(tint_amt, tint_vec.inputs[0])
    tint_vec.inputs[1].default_value = TINT_DIR
    tint_vec.inputs[2].default_value = (1.0, 1.0, 1.0)

    base = nodes.new("ShaderNodeRGB")
    base.outputs[0].default_value = srgb_to_linear(BASE_SRGB)
    tinted = nodes.new("ShaderNodeVectorMath")
    tinted.operation = "MULTIPLY"
    links.new(base.outputs[0], tinted.inputs[0])
    links.new(tint_vec.outputs[0], tinted.inputs[1])
    scale = nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    links.new(tinted.outputs[0], scale.inputs[0])
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
        raise RuntimeError("system python3 with PIL and numpy not found for WebP conversion")
    res = subprocess.run([py, "-c", CONVERT, OUT_PNG, OUT_WEBP, str(WEBP_QUALITY)],
                         check=True, capture_output=True, text=True)
    lines = [ln for ln in res.stdout.strip().splitlines() if " luma mean " in ln]
    if len(lines) != 2:
        raise RuntimeError("TX-PNL measurement missing: %r" % (res.stdout,))
    for line in lines:
        print("RESULT " + line)
        parts = line.split()
        mean, sd = float(parts[3]), float(parts[5])
        if not (LUMA_MEAN_MIN <= mean <= LUMA_MEAN_MAX and sd <= LUMA_SD_MAX):
            raise RuntimeError("TX-PNL luma outside the hard limits: " + line)


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
