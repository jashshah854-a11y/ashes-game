"""Bake TX-SEA Candidate B in Blender, headless.

Cycle 23 Step 19b, per MAP_TREATMENT 7.3 and 7.4: the Step 18c bake-off
winner route (Candidate B, Blender material through CAM_TEX at 1024 px) sets
the route for TX-SEA. Modeled on tools/bake-tx-land.py; same rig.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-tx-sea.py

Render engine: Cycles, CPU device. Denoise off and a fixed sample count so the
bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m; camera
CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale 2.0;
1024 x 1024; view transform Standard, look None; seed 0; filter width 1.5;
emission only, no lights, no shadows. The plane mesh runs 0.1 m past the
2 m tile (PLANE_HALF). Saved to blender/rig/aoe_rig_txsea_v1.blend, never
over the TX-LAND rig blender/rig/aoe_rig_v1.blend.

Material TX_SEA_paper, remade from the master's sea rather than a photo of
it: painted sea paper with a faint horizontal brush ripple. Emission colour
= sea base tone x fine grain factor x ripple factor. Both noises are sampled
on the TX-LAND torus embedded in 4D (u = pi (x + 1), v = pi (y + 1);
vector = (cos u, sin u, cos v) / pi, W = sin v / pi), so the tile wraps
seamlessly. The ripple noise samples the same torus with its u pair scaled
by RIPPLE_STRETCH_X and its v pair by RIPPLE_STRETCH_Y: the sampled path is
still a closed loop in each angle, so the wrap stays closed, and the noise
varies slowly along x and fast along y, which reads as long horizontal
streaks.

Base tone, measured: art-direction/master-sheet/v2/panels/P6.png (the
MAP-TGT crop), open sea box x 440 to 600, y 118 to 150 (above the coast's
engraved water lines, between the grid lines, away from the lamp-lit left
side and the dark right edge), ink pixels excluded (luma below the box
median minus 25; 89.1 percent of the box kept). Mean sRGB 144.94, 133.70,
114.73 (luma 134.9), rounded to (145, 134, 115).

Measured on the baked PNG (9 x 9 box high-pass on Rec 601 luma, wrapped;
the same metric gives 5.45 on TX-LAND candidate B): see the RESULT note at
the end of this header.

Output: art-direction/textures/TX-SEA/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 90). Blender's bundled Python has no PIL, so the
last step shells to the system python3 to re-save the PNG without Blender's
metadata chunks and write the WebP.

RESULT (Step 19b bake, measured on candidate-b.png): mean sRGB 144.64,
133.67, 114.71; luma mean 134.79, min 93.91, max 165.27, std 8.92; 9 x 9 box
high-pass spread 5.71 (TX-LAND candidate B: 5.45); mean absolute horizontal
neighbour difference 1.13 against vertical 3.99 (TX-LAND candidate B: 3.74
and 3.73), so the grain is clearly horizontal. Wrap seam differences
(column 0 against column 1023, row 0 against row 1023) are 1.04 and 3.72,
in line with the interior neighbour differences, so the tile wraps.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Sea base tone, sRGB 0..255: P6 open sea box, measured as in the header.
BASE_SRGB = (145, 134, 115)
# Grain noise scale, features per metre (as TX-LAND): a very fine paper tooth.
GRAIN_SCALE = 200.0
# Grain noise detail octaves.
GRAIN_DETAIL = 4.0
# Grain gain: colour factor = 1 + GRAIN_GAIN * (noise - 0.5). Small, so the
# ripple carries the character.
GRAIN_GAIN = 0.4
# Ripple noise scale, features per metre before the axis stretch.
RIPPLE_SCALE = 100.0
# Ripple axis stretch: x runs at 0.08 of the scale (about 8 features per
# metre, streaks about 64 px long), y at the full scale (about 5 px apart).
RIPPLE_STRETCH_X = 0.08
RIPPLE_STRETCH_Y = 1.0
# Ripple noise detail octaves: low, so the streaks stay soft brush strokes.
RIPPLE_DETAIL = 2.0
# Ripple gain: colour factor = 1 + RIPPLE_GAIN * (noise - 0.5).
RIPPLE_GAIN = 1.8
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
OUT_DIR = os.path.join(ROOT, "art-direction", "textures", "TX-SEA")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_txsea_v1.blend")

CONVERT = r"""
import sys
from PIL import Image
src, webp, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
im.load()
im.save(src, format="PNG", optimize=False)
im.save(webp, format="WEBP", quality=q, method=6)
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
    mat = bpy.data.materials.new("TX_SEA_paper")
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
    cos_u, sin_u = math_node("COSINE", u), math_node("SINE", u)
    cos_v, sin_v = math_node("COSINE", v), math_node("SINE", v)

    # One torus embedding per noise: the u pair scaled by rx, the v pair by
    # ry. Returns (vector socket, W socket).
    def torus(rx, ry):
        comb = nodes.new("ShaderNodeCombineXYZ")
        links.new(math_node("MULTIPLY", cos_u, inv_pi * rx), comb.inputs[0])
        links.new(math_node("MULTIPLY", sin_u, inv_pi * rx), comb.inputs[1])
        links.new(math_node("MULTIPLY", cos_v, inv_pi * ry), comb.inputs[2])
        return comb.outputs[0], math_node("MULTIPLY", sin_v, inv_pi * ry)

    def noise_factor(vec_w, scale, detail, gain):
        n = nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = "4D"
        links.new(vec_w[0], n.inputs["Vector"])
        links.new(vec_w[1], n.inputs["W"])
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = 0.5
        n.inputs["Distortion"].default_value = 0.0
        # factor = 1 + gain * (noise - 0.5) = noise * gain + (1 - gain / 2)
        return math_node("MULTIPLY_ADD", n.outputs["Fac"], gain, 1.0 - gain / 2.0)

    grain = noise_factor(torus(1.0, 1.0), GRAIN_SCALE, GRAIN_DETAIL, GRAIN_GAIN)
    ripple = noise_factor(torus(RIPPLE_STRETCH_X, RIPPLE_STRETCH_Y), RIPPLE_SCALE, RIPPLE_DETAIL, RIPPLE_GAIN)
    factor = math_node("MULTIPLY", grain, ripple)

    base = nodes.new("ShaderNodeRGB")
    base.outputs[0].default_value = srgb_to_linear(BASE_SRGB)
    scale = nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    links.new(base.outputs[0], scale.inputs[0])
    links.new(factor, scale.inputs["Scale"])

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
    subprocess.run([py, "-c", CONVERT, OUT_PNG, OUT_WEBP, str(WEBP_QUALITY)], check=True)


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
