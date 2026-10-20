"""Bake the DC01 to DC07 decal luminance sources in Blender, headless.

Cycle 23 Step 20b, per MAP_TREATMENT 8.1 Step 20 ("DC-xx, decals clipped to
hit polygons") and the STRATEGY.md decal table: DC01 to DC04 are scorch
marks (four variants), DC05 to DC07 are shell craters (three variants).
DC08 (rubble) needs destruction the sim does not have, and DC09 is table
frame only, so neither is baked here. Modeled on tools/bake-tx-pnl.py; same
CAM_TEX settings, its own rig file, one rig for all seven bakes.

Render command (from the repo root):
  ~/.local/bin/blender --background --python tools/bake-dc.py

Render engine: Cycles, CPU device. Denoise off and a fixed sample count so the
bake is byte reproducible.

Rig (VISUAL_STRATEGY 4.1, CAM_TEX only): metric units, 1 unit = 1 m; camera
CAM_TEX orthographic at (0, 0, 10), rotation (0, 0, 0), ortho scale 2.0 (the
tile size); 256 x 256 (STRATEGY G17: decals at most 256); view transform
Standard, look None; seed 0; filter width 1.5; emission only, no lights, no
shadows. Saved to blender/rig/aoe_rig_dc_v1.blend with one material per
variant (DC01 to DC07); the plane takes each in turn for its render.

Each material is flat emission: one dark mark on plain white, gray only, so
the PNG is a clean luminance source for the RESEARCH.md P9 luminance alpha
(tools/make-dc-alpha.py). The mark is a radial falloff whose radius is
displaced by two noises (a broad shape noise and a fine edge noise), each
variant with its own noise W seed, radius, stretch, and rotation.
  Scorch: an irregular soot blotch, darkest at the centre, a soft ragged edge,
  faint mottling inside.
  Crater: a darker depressed centre, a lighter rim band, and a fainter outer
  ejecta ring fading to white.
The mark stays inside the outer 8 px (0.0625 m) frame for every variant, so
the P9 frame zeroing never cuts ink.

Output: art-direction/textures/DCxx/candidate-b.png (8 bit RGB, 256 x 256).
Blender's bundled Python has no PIL, so the last step shells to the system
python3 to re-save each PNG without Blender's metadata chunks and to print
its sha256 and luma range.
"""
import math
import os
import shutil
import subprocess
import sys

import bpy

# Path-trace samples: emission only, enough to settle edge antialiasing.
SAMPLES = 16
# Render seed, per VISUAL_STRATEGY 4.1.
SEED = 0
# Pixel filter width in px, per VISUAL_STRATEGY 4.1.
FILTER_WIDTH = 1.5
# Output edge in px, STRATEGY G17 (decals at most 256).
RES = 256
# CAM_TEX ortho scale in metres, equal to the tile size.
ORTHO_SCALE = 2.0
# Plane half size in metres: past the frame on every side.
PLANE_HALF = 1.1
# Display gamma used to turn the target sRGB value into linear emission, so
# the Standard view transform lands each value near its intended sRGB level.
GAMMA = 2.2

# Per variant: kind, noise W seed, radius R (m), stretch (sx, sy), rotation
# (rad), shape noise (scale, amplitude in m), edge noise (scale, amplitude
# in m). Extent check: R + (shape amp + edge amp) / 2 stays under 0.9 m, and
# stretch never exceeds 1, so every mark clears the 0.0625 m frame.
VARIANTS = [
    ("DC01", "scorch", 1.3, 0.64, (1.00, 0.82), 0.40, (2.2, 0.40), (11.0, 0.12)),
    ("DC02", "scorch", 4.7, 0.60, (0.86, 1.00), 1.10, (1.8, 0.48), (13.0, 0.10)),
    ("DC03", "scorch", 7.9, 0.66, (1.00, 0.92), 2.30, (2.8, 0.34), (9.0, 0.14)),
    ("DC04", "scorch", 12.2, 0.58, (0.78, 1.00), 0.90, (1.5, 0.52), (15.0, 0.10)),
    ("DC05", "crater", 2.1, 0.70, (1.00, 0.96), 0.20, (2.0, 0.16), (14.0, 0.06)),
    ("DC06", "crater", 5.5, 0.66, (0.93, 1.00), 1.70, (2.6, 0.20), (12.0, 0.07)),
    ("DC07", "crater", 9.4, 0.72, (1.00, 0.88), 2.80, (1.7, 0.14), (16.0, 0.05)),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, "art-direction", "textures")
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_dc_v1.blend")

CONVERT = r"""
import hashlib
import sys
import numpy as np
from PIL import Image
for src in sys.argv[1:]:
    im = Image.open(src).convert("RGB")
    im.load()
    im.save(src, format="PNG", optimize=False)
    x = np.asarray(im).astype(np.float64)
    y = 0.299 * x[:, :, 0] + 0.587 * x[:, :, 1] + 0.114 * x[:, :, 2]
    chroma = int((x.max(axis=2) - x.min(axis=2)).max())
    edge = np.concatenate([y[:8, :].ravel(), y[-8:, :].ravel(), y[:, :8].ravel(), y[:, -8:].ravel()])
    sha = hashlib.sha256(open(src, "rb").read()).hexdigest()
    print("png %s size %dx%d luma min %.2f max %.2f mean %.2f chroma %d frame_min %.2f sha256 %s"
          % (src, im.size[0], im.size[1], y.min(), y.max(), y.mean(), chroma, edge.min(), sha))
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
    world.color = (1.0, 1.0, 1.0)
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

    mesh = bpy.data.meshes.new("DC_plane")
    h = PLANE_HALF
    mesh.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
    mesh.update()
    plane = bpy.data.objects.new("DC_plane", mesh)
    scene.collection.objects.link(plane)
    mats = {}
    for v in VARIANTS:
        mats[v[0]] = build_material(*v)
    plane.data.materials.append(mats[VARIANTS[0][0]])
    return scene, plane, mats


def build_material(vid, kind, seed, radius, stretch, rot, shape, edge):
    mat = bpy.data.materials.new("DC_" + vid)
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

    def smooth(value, lo, hi, out_lo, out_hi):
        n = nodes.new("ShaderNodeMapRange")
        n.data_type = "FLOAT"
        n.interpolation_type = "SMOOTHSTEP"
        n.clamp = True
        links.new(value, n.inputs["Value"])
        n.inputs["From Min"].default_value = lo
        n.inputs["From Max"].default_value = hi
        n.inputs["To Min"].default_value = out_lo
        n.inputs["To Max"].default_value = out_hi
        return n.outputs["Result"]

    tex = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tex.outputs["Object"], sep.inputs[0])
    x, y = sep.outputs["X"], sep.outputs["Y"]

    # Rotate then stretch: x' = (x cos a + y sin a) / sx, y' = (y cos a - x sin a) / sy.
    ca, sa = math.cos(rot), math.sin(rot)
    xr = math_node("MULTIPLY_ADD", x, ca, math_node("MULTIPLY", y, sa))
    yr = math_node("MULTIPLY_ADD", y, ca, math_node("MULTIPLY", x, -sa))
    xs = math_node("DIVIDE", xr, stretch[0])
    ys = math_node("DIVIDE", yr, stretch[1])
    r = math_node("SQRT", math_node("ADD", math_node("MULTIPLY", xs, xs), math_node("MULTIPLY", ys, ys)))

    def noise(scale, detail, w):
        n = nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = "4D"
        links.new(tex.outputs["Object"], n.inputs["Vector"])
        n.inputs["W"].default_value = w
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = 0.55
        n.inputs["Distortion"].default_value = 0.0
        return n.outputs["Fac"]

    # Displaced radius: r + amp * (noise - 0.5) for the shape and edge noises,
    # then t = r' / R (0 at the centre, 1 at the edge of the mark).
    n_shape = noise(shape[0], 2.0, seed)
    n_edge = noise(edge[0], 6.0, seed + 31.7)
    d_shape = math_node("MULTIPLY_ADD", n_shape, shape[1], -shape[1] / 2.0)
    d_edge = math_node("MULTIPLY_ADD", n_edge, edge[1], -edge[1] / 2.0)
    rd = math_node("ADD", r, math_node("ADD", d_shape, d_edge))
    t = math_node("DIVIDE", rd, radius)

    if kind == "scorch":
        # Soot: full body to t 0.35, ragged soft falloff to 0 at t 1, and a
        # darker core so the centre reads darkest.
        body = smooth(t, 0.42, 1.0, 1.0, 0.0)
        core = smooth(t, 0.0, 0.65, 1.0, 0.0)
        dark = math_node("MULTIPLY", body, math_node("MULTIPLY_ADD", core, 0.32, 0.58))
    else:
        # Crater: depressed centre (dark to t 0.22, gone by 0.48), a lighter
        # rim band where only a faint wash remains (t near 0.5), the rim
        # ring (t 0.55 to 0.70), and ejecta fading out by t 1.
        centre = smooth(t, 0.22, 0.48, 0.92, 0.0)
        rim = smooth(t, 0.30, 0.60, 0.20, 0.0)
        ring_in = smooth(t, 0.44, 0.58, 0.0, 1.0)
        ring_out = smooth(t, 0.70, 1.0, 1.0, 0.0)
        ring = math_node("MULTIPLY", math_node("MULTIPLY", ring_in, ring_out), 0.56)
        dark = math_node("MAXIMUM", math_node("MAXIMUM", centre, ring), rim)

    # Mottling: plus or minus 15 percent of the darkness from a mid noise.
    mottle = math_node("MULTIPLY_ADD", noise(7.0, 3.0, seed + 63.1), 0.30, 0.85)
    dark = math_node("MULTIPLY", dark, mottle)
    dark = math_node("MINIMUM", math_node("MAXIMUM", dark, 0.0), 1.0)
    # Target sRGB value 1 - dark, to linear emission by the display gamma.
    srgb = math_node("SUBTRACT", 1.0, dark)
    lin = math_node("POWER", srgb, GAMMA)

    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    links.new(lin, emit.inputs["Color"])
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def convert_outputs(paths):
    py = shutil.which("python3")
    if py is None:
        raise RuntimeError("system python3 with PIL and numpy not found for PNG re-save")
    res = subprocess.run([py, "-c", CONVERT] + paths, check=True, capture_output=True, text=True)
    lines = [ln for ln in res.stdout.strip().splitlines() if ln.startswith("png ")]
    if len(lines) != len(paths):
        raise RuntimeError("DC measurement missing: %r" % (res.stdout,))
    for line in lines:
        print("RESULT " + line)
        parts = line.split()
        lmin, lmax, frame_min = float(parts[6]), float(parts[8]), float(parts[14])
        # A real mark (dark ink present), white ground, and an ink free frame.
        if not (lmin < 80.0 and lmax > 250.0 and frame_min > 250.0):
            raise RuntimeError("DC bake outside its limits: " + line)


def main():
    scene, plane, mats = build_scene()
    os.makedirs(os.path.dirname(RIG), exist_ok=True)
    # No .blend1 backup next to the rig on re-runs.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=RIG)
    outs = []
    for v in VARIANTS:
        vid = v[0]
        out_dir = os.path.join(TEX_DIR, vid)
        os.makedirs(out_dir, exist_ok=True)
        out_png = os.path.join(out_dir, "candidate-b.png")
        plane.data.materials[0] = mats[vid]
        scene.render.filepath = out_png
        bpy.ops.render.render(write_still=True)
        outs.append(out_png)
    convert_outputs(outs)
    for p in outs:
        print("wrote " + os.path.relpath(p, ROOT))
    print("wrote " + os.path.relpath(RIG, ROOT))


try:
    main()
except Exception as exc:
    print("bake failed: %r" % (exc,), file=sys.stderr)
    sys.exit(1)
