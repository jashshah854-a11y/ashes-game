"""Bake the RX01 / RX02 micro relief shade tile in Blender, headless.

Cycle 23 Step 19d-1, per MAP_TREATMENT 7.5: trigger 2 has fired (the Step
18c-2 TX-LAND winner is route B, Blender), so the rig and CAM_TEX are already
paid for and RX01 and RX02 are wired. One tile serves both: RX02 is the same
tile family, so RX01 and RX02 share art-direction/textures/RX01/candidate-b.*.
Modeled on tools/bake-tx-foguk.py (Step 19c); same CAM_TEX settings, its own
rig file.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-rx.py

Render engine: Cycles, CPU device. Denoise off, a fixed sample count, and
direct light only (no bounces), so the bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX with KEY): metric units, 1 unit = 1 m;
camera CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale
2.0; 1024 x 1024; view transform Standard, look None; seed 0; filter width
1.5. Unlike the emission only TX bakes, this one is lit: one sun lamp KEY
from the upper left of the frame (azimuth from the minus x, plus y corner) at
KEY_ELEVATION degrees, falling on a displaced plane. World black, so the KEY
is the only light. Saved to blender/rig/aoe_rig_rx_v1.blend, never over an
existing rig file.

Displaced plane: a 32 px base grid with a Simple subdivision modifier at
render level 5, so the render mesh has 1 render px spacing, running 64 px
past the 2 m tile on every side, so the pixel filter and the KEY shadows at
the frame edge see wrapped relief. Material RX_relief:
a matte white diffuse surface whose displacement (true displacement plus
bump, DISPLACEMENT_METHOD 'BOTH') is an fBm noise height sampled on the
TX-LAND torus embedded in 4D (u = pi (x + 1), v = pi (y + 1); vector =
(cos u, sin u, cos v) / pi, W = sin v / pi). The height field is therefore
periodic over the 2 m tile, so the tile is seamless by construction: real
light on small periodic undulations, no objects, no features, no colour.

Normalisation (MAP_TREATMENT 7.5: mean luma 128, standard deviation 10 or
less), done in this script: Blender renders a 16 bit PNG to a temp file; the
system python3 step reads it, takes Rec 601 luma (the render is gray, so
luma equals each channel), and applies one affine remap
out = 128 + (luma - mean) * TARGET_SD / sd, rounded to 8 bit gray RGB. The
remap is per pixel and affine, so the wrap stays seamless. Pillow opens a 16
bit RGB PNG as 8 bit RGB, so the remap reads 8 bit levels and the printed raw
mean and sd are those levels divided by 257; the affine remap is scale free,
so this only sets the input precision (raw sd about 8.4 levels stretched to
9, a gain near 1.07, leaving a few empty levels in the histogram tails). Hard limits,
checked on the PNG and on the decoded WebP (what the board draws); the
script exits 1 if any fails: mean 126 to 130, sd at most 10, max chroma
(max channel minus min channel) at most CHROMA_MAX.

Output: art-direction/textures/RX01/candidate-b.png (8 bit RGB) and
candidate-b.webp (quality 90).

RESULT (Step 19d-1 bake): see the RESULT lines printed by the script; the
measured numbers are recorded in art-direction/asset-log.jsonl
(RX01-wired-step19d1).
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bpy
from mathutils import Vector

# Relief noise scale, features per metre: about 2 x 14 = 28 undulations
# across the 1024 px tile, roughly 36 px each, well under a province.
RELIEF_SCALE = 14.0
# Relief noise detail octaves: finer undulations ride on the main ones.
RELIEF_DETAIL = 5.0
# Relief noise roughness: the weight of each finer octave.
RELIEF_ROUGHNESS = 0.55
# Displacement height in metres for the full noise range (midlevel 0.5).
DISPLACE_SCALE = 0.03
# Displacement method: true displacement of the grid plus bump for detail
# finer than the grid step.
DISPLACEMENT_METHOD = "BOTH"
# KEY light: sun from the upper left of the frame, elevation in degrees.
KEY_ELEVATION = 40.0
# KEY strength (W per square metre); the normalisation fixes the final
# levels, this only keeps the raw render well inside 0..1.
KEY_STRENGTH = 1.5
# KEY angular diameter in degrees: 0 gives hard, noise free shadows.
KEY_ANGLE = 0.0
# Diffuse albedo, linear gray.
ALBEDO = 0.5
# Normalisation targets (MAP_TREATMENT 7.5): mean luma 128, sd 10 or less;
# TARGET_SD leaves margin under 10 for the WebP round trip.
TARGET_MEAN = 128.0
TARGET_SD = 9.0
# Hard limits, checked on the PNG and on the decoded WebP.
LUMA_MEAN_MIN = 126.0
LUMA_MEAN_MAX = 130.0
LUMA_SD_MAX = 10.0
CHROMA_MAX = 3
# Path-trace samples: enough to settle sub-pixel antialiasing.
SAMPLES = 32
# Render seed, per VISUAL_STRATEGY 4.1.
SEED = 0
# Pixel filter width in px, per VISUAL_STRATEGY 4.1.
FILTER_WIDTH = 1.5
# Output edge in px, per VISUAL_STRATEGY 4.1 CAM_TEX.
RES = 1024
# CAM_TEX ortho scale in metres, equal to the tile size.
ORTHO_SCALE = 2.0
# Base grid cell in render px, and the Simple subdivision levels that split
# it down to 1 render px at render (2 ** 5 = 32).
BASE_CELL_PX = 32
SUBDIV_LEVELS = 5
GRID_BASE_STEP = ORTHO_SCALE * BASE_CELL_PX / RES
# Grid margin past the tile edge in base cells on every side (64 px, about
# 0.125 m, a little past the TX bakes' 0.1 m PLANE_HALF): covers the pixel
# filter and the KEY shadow reach.
GRID_MARGIN_CELLS = 2
# WebP quality, per the bake-off spec.
WEBP_QUALITY = 90

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "art-direction", "textures", "RX01")
OUT_PNG = os.path.join(OUT_DIR, "candidate-b.png")
OUT_WEBP = os.path.join(OUT_DIR, "candidate-b.webp")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_rx_v1.blend")

CONVERT = r"""
import sys
import numpy as np
from PIL import Image
raw, png, webp, q, tmean, tsd = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
src = Image.open(raw)
src.load()
a = np.asarray(src).astype(np.float64)
if a.ndim == 2:
    a = np.stack([a, a, a], axis=-1)
a = a[:, :, :3] / 257.0
luma = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
mean, sd = float(luma.mean()), float(luma.std())
print("raw luma mean %.4f sd %.4f" % (mean, sd))
out = np.clip(np.rint(tmean + (luma - mean) * (tsd / sd)), 0, 255).astype(np.uint8)
im = Image.fromarray(np.stack([out, out, out], axis=-1), "RGB")
im.save(png, format="PNG", optimize=False)
im.save(webp, format="WEBP", quality=q, method=6)

def stats(img, label):
    x = np.asarray(img.convert("RGB")).astype(np.float64)
    y = 0.299 * x[:, :, 0] + 0.587 * x[:, :, 1] + 0.114 * x[:, :, 2]
    chroma = int((x.max(axis=2) - x.min(axis=2)).max())
    print("%s luma mean %.2f sd %.2f min %.2f max %.2f chroma %d" % (label, y.mean(), y.std(), y.min(), y.max(), chroma))

stats(Image.open(png), "png")
dec = Image.open(webp)
dec.load()
stats(dec, "webp")
"""


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
    # Direct light only: the KEY on the relief, no bounce noise.
    scene.cycles.max_bounces = 0
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
    img.color_depth = "16"
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

    # KEY: sun from the upper left (minus x, plus y in frame), local plus z
    # pointed at the sun, so the light travels along local minus z.
    key_data = bpy.data.lights.new("KEY", type="SUN")
    key_data.energy = KEY_STRENGTH
    key_data.angle = math.radians(KEY_ANGLE)
    key = bpy.data.objects.new("KEY", key_data)
    el = math.radians(KEY_ELEVATION)
    to_sun = Vector((-math.cos(el) / math.sqrt(2.0), math.cos(el) / math.sqrt(2.0), math.sin(el)))
    key.rotation_mode = "QUATERNION"
    key.rotation_quaternion = to_sun.to_track_quat("Z", "Y")
    key.location = (0.0, 0.0, 5.0)
    scene.collection.objects.link(key)

    plane = bpy.data.objects.new("RX_plane", build_grid())
    scene.collection.objects.link(plane)
    sub = plane.modifiers.new("RX_subdiv", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = 0
    sub.render_levels = SUBDIV_LEVELS
    plane.data.materials.append(build_material())
    return scene


def build_grid():
    # A small base grid at GRID_BASE_STEP, (2 * half) cells per side centred
    # on the origin, so the tile edges at plus and minus 1 m fall on vertex
    # rows. A Simple subdivision modifier (added in build_scene) splits each
    # cell 2 ** SUBDIV_LEVELS times per side at render, down to 1 render px,
    # so the rig file stays small while the render sees the full grid.
    half = RES // (2 * BASE_CELL_PX) + GRID_MARGIN_CELLS
    n = 2 * half + 1
    coords = [(k - half) * GRID_BASE_STEP for k in range(n)]
    verts = [(x, y, 0.0) for y in coords for x in coords]
    faces = []
    for j in range(n - 1):
        for i in range(n - 1):
            a = j * n + i
            faces.append((a, a + 1, a + 1 + n, a + n))
    mesh = bpy.data.meshes.new("RX_plane")
    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()
    return mesh


def build_material():
    mat = bpy.data.materials.new("RX_relief")
    if mat.node_tree is None:
        mat.use_nodes = True
    mat.displacement_method = DISPLACEMENT_METHOD
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
    noise.inputs["Scale"].default_value = RELIEF_SCALE
    noise.inputs["Detail"].default_value = RELIEF_DETAIL
    noise.inputs["Roughness"].default_value = RELIEF_ROUGHNESS
    noise.inputs["Distortion"].default_value = 0.0

    disp = nodes.new("ShaderNodeDisplacement")
    disp.space = "OBJECT"
    links.new(noise.outputs["Fac"], disp.inputs["Height"])
    disp.inputs["Midlevel"].default_value = 0.5
    disp.inputs["Scale"].default_value = DISPLACE_SCALE

    bsdf = nodes.new("ShaderNodeBsdfDiffuse")
    bsdf.inputs["Color"].default_value = (ALBEDO, ALBEDO, ALBEDO, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.0
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(bsdf.outputs[0], out.inputs["Surface"])
    links.new(disp.outputs[0], out.inputs["Displacement"])
    return mat


def convert_outputs(raw):
    py = shutil.which("python3")
    if py is None:
        raise RuntimeError("system python3 with PIL and numpy not found for normalisation")
    res = subprocess.run([py, "-c", CONVERT, raw, OUT_PNG, OUT_WEBP, str(WEBP_QUALITY),
                          repr(TARGET_MEAN), repr(TARGET_SD)],
                         check=True, capture_output=True, text=True)
    out = res.stdout.strip().splitlines()
    for line in out:
        if line.startswith("raw "):
            print("RESULT " + line)
    lines = [ln for ln in out if " luma mean " in ln and not ln.startswith("raw ")]
    if len(lines) != 2:
        raise RuntimeError("RX measurement missing: %r" % (res.stdout,))
    for line in lines:
        print("RESULT " + line)
        parts = line.split()
        mean, sd, chroma = float(parts[3]), float(parts[5]), int(parts[11])
        if not (LUMA_MEAN_MIN <= mean <= LUMA_MEAN_MAX and sd <= LUMA_SD_MAX and chroma <= CHROMA_MAX):
            raise RuntimeError("RX luma outside the hard limits: " + line)


def main():
    scene = build_scene()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(RIG), exist_ok=True)
    # No .blend1 backup next to the rig on re-runs.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=RIG)
    tmp = tempfile.mkdtemp(prefix="aoe-rx-")
    try:
        raw = os.path.join(tmp, "rx-raw16.png")
        scene.render.filepath = raw
        bpy.ops.render.render(write_still=True)
        convert_outputs(raw)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("wrote " + os.path.relpath(OUT_PNG, ROOT))
    print("wrote " + os.path.relpath(OUT_WEBP, ROOT))
    print("wrote " + os.path.relpath(RIG, ROOT))


try:
    main()
except Exception as exc:
    print("bake failed: %r" % (exc,), file=sys.stderr)
    sys.exit(1)
