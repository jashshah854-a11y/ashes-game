"""Bake TX-PAPER Candidate B in Blender, headless.

Cycle 23 Step 19b, per MAP_TREATMENT 7.3 and 7.4: the Step 18c bake-off
winner route (Candidate B, Blender material through CAM_TEX at 1024 px) sets
the route for TX-PAPER. Modeled on tools/bake-tx-land.py; same rig.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-tx-paper.py

Render engine: Cycles, CPU device. Denoise off and a fixed sample count so the
bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m; camera
CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale 2.0;
1024 x 1024; view transform Standard, look None; seed 0; filter width 1.5;
emission only, no lights, no shadows. The plane mesh runs 0.1 m past the
2 m tile (PLANE_HALF). Saved to blender/rig/aoe_rig_txpaper_v1.blend, never
over the TX-LAND rig blender/rig/aoe_rig_v1.blend.

Material TX_PAPER_paper: chart border paper, plain warm paper grain like
TX-LAND's paper but with no brush mottling and no fibre flecks. Emission
colour = FRAME_PAPER base tone x fine grain factor, the grain sampled on the
TX-LAND torus embedded in 4D (u = pi (x + 1), v = pi (y + 1); vector =
(cos u, sin u, cos v) / pi, W = sin v / pi), so the tile wraps seamlessly.

Base tone: the chart FRAME_PAPER, sRGB (230, 216, 181) = #E6D8B5 in
js/map-chart.js (Rec 601 luma 216.2).

Hard limits on the baked PNG (Rec 601 luma): mean 208 to 220, max at most
224 (the band report gates every composite under 225), min at least 195.
The script checks them after the bake and exits 1 if any fails.

Output: art-direction/textures/TX-PAPER/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 90). Blender's bundled Python has no PIL, so the
last step shells to the system python3 to re-save the PNG without Blender's
metadata chunks, write the WebP, and measure the luma limits.

RESULT (Step 19b bake, measured on candidate-b.png): mean sRGB 229.99,
215.99, 180.99; luma mean 216.19, min 210.01, max 222.08, std 1.47; 9 x 9
box high-pass spread 1.41; mean absolute horizontal and vertical neighbour
differences 1.03 and 1.03 (isotropic). The decoded WebP (what the board
draws) measures luma mean 216.39, min 210.38, max 221.38. Gain 0.5 gave max
227.38 and gain 0.3 gave PNG max 223.38 but WebP max 224.61, too close to
the 225 gate, so 0.25 ships.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Paper base tone, sRGB 0..255: FRAME_PAPER in js/map-chart.js.
BASE_SRGB = (230, 216, 181)
# Grain noise scale, features per metre (as TX-LAND): a very fine paper tooth.
GRAIN_SCALE = 200.0
# Grain noise detail octaves (as TX-LAND).
GRAIN_DETAIL = 4.0
# Grain gain: colour factor = 1 + GRAIN_GAIN * (noise - 0.5). Small, so the
# luma stays inside the hard limits with margin on the decoded WebP too.
GRAIN_GAIN = 0.25
# Hard luma limits on the baked PNG (Rec 601), checked after the bake.
LUMA_MEAN_MIN = 208.0
LUMA_MEAN_MAX = 220.0
LUMA_MAX = 224.0
LUMA_MIN = 195.0
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
OUT_DIR = os.path.join(ROOT, "art-direction", "textures", "TX-PAPER")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_txpaper_v1.blend")

CONVERT = r"""
import sys
from PIL import Image
src, webp, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
im.load()
im.save(src, format="PNG", optimize=False)
im.save(webp, format="WEBP", quality=q, method=6)
px = list(im.getdata())
luma = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
print("luma mean %.2f min %.2f max %.2f" % (sum(luma) / len(luma), min(luma), max(luma)))
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
    mat = bpy.data.materials.new("TX_PAPER_paper")
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
    line = res.stdout.strip().splitlines()[-1]
    print(line)
    parts = line.split()
    mean, lo, hi = float(parts[2]), float(parts[4]), float(parts[6])
    if not (LUMA_MEAN_MIN <= mean <= LUMA_MEAN_MAX and lo >= LUMA_MIN and hi <= LUMA_MAX):
        raise RuntimeError("TX-PAPER luma outside the hard limits: " + line)


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
