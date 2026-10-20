"""Bake TX-LAND bake-off Candidate B in Blender, headless.

Cycle 23 Step 18c-1, per MAP_TREATMENT 7.4 and VISUAL_STRATEGY 6.3.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-tx-land.py

Route substitution, recorded: the bake-off spec assumed the Colab lane, but
local Blender 5.2.2 LTS (the pinned version) is available in this
environment and the rig must live in the repo anyway. The substance
(Blender material, CAM_TEX at 1024) is unchanged.

Render engine: Cycles, CPU device (Cycles is present in this headless build;
no GPU, so not OptiX). Denoise off and a fixed sample count so the bake is
byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m;
camera CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale
2.0; 1024 x 1024; view transform Standard, look None; seed 0. The tile is
the 2 m x 2 m square at z = 0 centred on the origin that CAM_TEX frames
exactly; the plane mesh itself runs 0.1 m past it (see PLANE_HALF). Saved
to blender/rig/aoe_rig_v1.blend.

Material TX_LAND_paper, remade from the rendition rather than a photo of it:
emission only (flat, even, no lights, no shadows, no vignette), colour =
paper base tone x fine grain factor, then mixed toward a fibre tone by a
sparse fleck mask. Both textures are sampled on a torus embedded in 4D
(u = pi (x + 1), v = pi (y + 1) over the plane; vector = (cos u, sin u,
cos v) / pi, W = sin v / pi), so the tile wraps seamlessly. The 1 / pi
radius makes 1 texture unit equal 1 m of plane, so node scales read as
features per metre, as with plain object coordinates.

Output: art-direction/bakeoff/TX-LAND/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 90). Blender's bundled Python has no PIL, so the
last step shells to the system python3 to re-save the PNG without Blender's
metadata chunks and write the WebP.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Paper base tone, sRGB 0..255: mean of R2-TX-LAND-c4.png over the
# lamp-free crop box (320, 320, 1600, 1600), measured 185.74, 165.30, 144.81.
BASE_SRGB = (186, 165, 145)
# Fibre fleck tone, sRGB 0..255: a dark warm brown like the rendition's
# fibre flecks (its 1st luma percentile after flattening is about 140).
FLECK_SRGB = (120, 90, 62)
# Grain noise scale, features per metre: 400 across the 2 m tile, about
# 2.6 render px each, the rendition's very fine grain; finer than this the
# pixel filter averages the grain away.
GRAIN_SCALE = 200.0
# Grain noise detail octaves: sub-pixel structure for a paper tooth.
GRAIN_DETAIL = 4.0
# Grain gain: colour factor = 1 + GRAIN_GAIN * (noise - 0.5); 1.2 brings the
# 4 px luma high-pass spread to about 5.6 of 255 (rendition, flattened: 6.5).
GRAIN_GAIN = 1.2
# Fleck voronoi scale, cells per metre: 80 cells across the tile, one
# candidate fleck per 12.8 px cell, coarser than the grain.
FLECK_SCALE = 40.0
# Fleck radius as voronoi F1 distance in cell units. The plane is a 2D slice
# of a 4D cell lattice, so most feature points lie off the slice; 0.4 lets a
# sparse subset land as small soft dots (at 0.12 none showed).
FLECK_RADIUS = 0.4
# Fleck strength: peak mix toward FLECK_SRGB at a dot centre; coverage stays
# sparse, so the flecks read as a low-strength speckle.
FLECK_STRENGTH = 0.6
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
# Plane half size in metres. The tile is the 2 m square CAM_TEX frames;
# the plane runs 0.1 m (51 px) past it on every side so the 1.5 px pixel
# filter at the frame edge samples wrapped paper instead of the black world
# (at exactly 1.0 the edge rows rendered 8 levels dark and broke the wrap).
PLANE_HALF = 1.1
# WebP quality, per the bake-off spec.
WEBP_QUALITY = 90

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "art-direction", "bakeoff", "TX-LAND")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_v1.blend")

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
    mat = bpy.data.materials.new("TX_LAND_paper")
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

    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.voronoi_dimensions = "4D"
    vor.feature = "F1"
    links.new(comb.outputs[0], vor.inputs["Vector"])
    links.new(sv, vor.inputs["W"])
    vor.inputs["Scale"].default_value = FLECK_SCALE
    vor.inputs["Randomness"].default_value = 1.0
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.interpolation_type = "SMOOTHSTEP"
    ramp.clamp = True
    links.new(vor.outputs["Distance"], ramp.inputs["Value"])
    ramp.inputs["From Min"].default_value = 0.0
    ramp.inputs["From Max"].default_value = FLECK_RADIUS
    ramp.inputs["To Min"].default_value = FLECK_STRENGTH
    ramp.inputs["To Max"].default_value = 0.0

    fleck = nodes.new("ShaderNodeRGB")
    fleck.outputs[0].default_value = srgb_to_linear(FLECK_SRGB)
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MIX"
    links.new(ramp.outputs["Result"], mix.inputs["Factor"])
    links.new(scale.outputs["Vector"], mix.inputs["A"])
    links.new(fleck.outputs[0], mix.inputs["B"])

    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    links.new(mix.outputs["Result"], emit.inputs["Color"])
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
