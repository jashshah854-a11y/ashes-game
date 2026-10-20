"""Build the pinned sprite rig, the golden frame, and the golden test unit's
three passes in Blender, headless.

Cycle 23 Step 22a (MAP_TREATMENT Step 22, old Step 16, first half), per
VISUAL_STRATEGY 4.1 (pinned rig), 4.2 (golden frame rule), 4.4 (three passes)
and 4.5 gate A3, and STRATEGY gates G10, G11, G12. The silhouette battery is
Step 22b and is not built here.

Run command (from the repo root), one command reproduces everything:
  ~/.local/bin/blender --background --python tools/build-sprite-rig.py

Version pin: the script exits 1 on any Blender other than 5.2.2 (checked on
bpy.app.version and bpy.app.version_string before any work).

ROUTE SUBSTITUTION, recorded plainly (Step 18c-1 and Step 19 precedents): the
spec assumes the Colab lane, the golden established in session C1 and passed
on both an A100 and an L4 (OptiX GPU). This build runs on local Blender 5.2.2
LTS, Cycles on CPU, because the rig and the golden must live in the repo and
no GPU exists in this environment. The golden here is established on local
CPU only; the A100 and L4 pass remains owed and is not claimed anywhere.

Rig (VISUAL_STRATEGY 4.1): metric, 1 unit = 1 m. CAM_SPRITE orthographic at
(0, -10, 10), rotation (45, 0, 0) degrees, ortho scale 2.0, shift (0, 0.25):
112 render px per metre, a 224 x 224 sprite frame, the ground contact anchor
(world origin) on render pixel (112, 168). CAM_TEX orthographic at (0, 0, 10),
rotation 0, ortho scale 2.0, kept so the rig can bake textures. KEY sun,
strength 3.0, angle 2 degrees, at (-5.5, 4.5, 7.0) with a Track To constraint
on the empty KEY_target at the origin: light from screen upper left. World
flat gray (linear 0.5) at strength 0.3, no HDRI. View transform Standard,
look None, exposure 0, gamma 1, dither 0. Cycles CPU, seed 0, filter width
1.5 px, film transparent, PNG RGBA 16 bit. Material TINT_paint: Principled,
base color sRGB (128, 128, 128), roughness 0.6, metallic 0. Saved to
blender/rig/aoe_rig_sprite_v1.blend, never over an existing rig file.

Golden scene (VISUAL_STRATEGY 4.2), blender/golden/golden_v1.blend, rendered
through CAM_SPRITE at 224 x 224 (no 448 deviation needed): the gray test unit
at the origin (round base plus three blocks, tintable surfaces TINT_paint,
the rest NEUTRAL_gray; footprint 1.0 m, height 0.66 m), the tint swatch card
(an upright card square to the camera carrying one flat emission patch of
sRGB (128, 128, 128) and three TINT_paint patches at three orientations), an
Ink cube, and a smooth probe sphere. Items do not overlap in screen space.

Golden rule: the first run establishes blender/golden/golden_v1.png. Every
later run renders the golden to a temp file and diffs it against the archived
png through tools/sprite-rig-check.py --diff (VISUAL_STRATEGY 4.2
tolerances); the archived golden is never overwritten, and the script exits 1
if the re-render is over tolerance. A new golden is golden_v2, never a silent
re-baseline.

Samples: beauty and golden 256 with OIDN denoise (the default Cycles CPU
denoiser in this build; deterministic run to run on this machine, verified by
the golden diff), mask and swatch mask 16 without denoise, shadow 256 without
denoise (the shadow catcher alpha is not denoised). Adaptive sampling off.

Passes (VISUAL_STRATEGY 4.4), the test unit alone through CAM_SPRITE at 224,
under blender/golden/passes/:
  testunit_beauty.png      all unit objects visible, film transparent
  testunit_mask.png        TINT_ materials swapped to white emission 1.0, all
                           others to black emission
  testunit_shadow.png      4 x 4 m shadow catcher at z = 0, the unit invisible
                           to camera but casting; the shadow is in alpha
  testunit_swatchmask.png  the G10 swatch: the swatch card's emission patch
                           alone, its material swapped to MASK_half (the 0.5
                           mask material, an emission that Standard encodes to
                           128), rendered with the mask pass settings
Manifests: blender/golden/golden_v1.json and blender/golden/passes/
testunit.json. A measured block written by tools/sprite-rig-check.py --record
is carried forward while the golden png sha256 is unchanged.
"""
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bpy
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

PINNED_VERSION = (5, 2, 2)
PINNED_VERSION_PREFIX = "5.2.2"
if tuple(bpy.app.version) != PINNED_VERSION or not bpy.app.version_string.startswith(PINNED_VERSION_PREFIX):
    print("build-sprite-rig: Blender %s is not the pinned 5.2.2, refusing to run" % bpy.app.version_string,
          file=sys.stderr)
    sys.exit(1)

# CAM_SPRITE, per VISUAL_STRATEGY 4.1.
CAM_SPRITE_LOCATION = (0.0, -10.0, 10.0)
CAM_SPRITE_ROTATION_DEG = (45.0, 0.0, 0.0)
CAM_SPRITE_ORTHO_SCALE = 2.0
CAM_SPRITE_SHIFT_X = 0.0
CAM_SPRITE_SHIFT_Y = 0.25
# CAM_TEX, as in the existing rigs.
CAM_TEX_LOCATION = (0.0, 0.0, 10.0)
CAM_TEX_ORTHO_SCALE = 2.0
# Sprite frame edge in px; 112 px per metre at ortho scale 2.0.
FRAME = 224
PX_PER_M = FRAME / CAM_SPRITE_ORTHO_SCALE
# Ground contact anchor, render px (x right, y down), per VISUAL_STRATEGY 4.1.
ANCHOR_PX = (112, 168)
# KEY sun, per VISUAL_STRATEGY 4.1.
KEY_LOCATION = (-5.5, 4.5, 7.0)
KEY_STRENGTH = 3.0
KEY_ANGLE_DEG = 2.0
# World: flat gray background, linear value, strength per VISUAL_STRATEGY 4.1.
WORLD_GRAY = 0.5
WORLD_STRENGTH = 0.3
# Render, per VISUAL_STRATEGY 4.1 and 4.4.
SEED = 0
FILTER_WIDTH = 1.5
SAMPLES_BEAUTY = 256
SAMPLES_MASK = 16
SAMPLES_SHADOW = 256
DENOISE_BEAUTY = True
COLOR_DEPTH = "16"
# Materials (sRGB 0..255 base colors).
TINT_SRGB = 128
TINT_ROUGHNESS = 0.6
NEUTRAL_SRGB = 100
NEUTRAL_ROUGHNESS = 0.7
INK_SRGB = 22
INK_ROUGHNESS = 0.9
PROBE_SRGB = 128
PROBE_ROUGHNESS = 0.25
SWATCH_SRGB = 128
# Shadow catcher plane edge in metres, per VISUAL_STRATEGY 4.4.
CATCHER_SIZE = 4.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_sprite_v1.blend")
GOLDEN_DIR = os.path.join(ROOT, "blender", "golden")
GOLDEN_BLEND = os.path.join(GOLDEN_DIR, "golden_v1.blend")
GOLDEN_PNG = os.path.join(GOLDEN_DIR, "golden_v1.png")
GOLDEN_JSON = os.path.join(GOLDEN_DIR, "golden_v1.json")
PASSES_DIR = os.path.join(GOLDEN_DIR, "passes")
PASSES_JSON = os.path.join(PASSES_DIR, "testunit.json")
CHECK_TOOL = os.path.join(ROOT, "tools", "sprite-rig-check.py")


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, "/")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def srgb_to_linear(c8):
    c = c8 / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ---------- rig ----------

def build_rig():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "AOE_RIG_SPRITE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    scene.render.engine = "CYCLES"
    cy = scene.cycles
    cy.device = "CPU"
    cy.samples = SAMPLES_BEAUTY
    cy.use_adaptive_sampling = False
    cy.use_denoising = DENOISE_BEAUTY
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.seed = SEED
    cy.use_animated_seed = False
    cy.filter_width = FILTER_WIDTH
    scene.render.resolution_x = FRAME
    scene.render.resolution_y = FRAME
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.use_stamp = False
    # No stamp metadata (date, render time, file path) in the PNGs, so a
    # re-render reproduces the file byte for byte, not just its pixels.
    for prop in scene.render.bl_rna.properties:
        if prop.identifier.startswith("use_stamp") and prop.type == "BOOLEAN":
            setattr(scene.render, prop.identifier, False)
    scene.render.dither_intensity = 0.0
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    img = scene.render.image_settings
    img.file_format = "PNG"
    img.color_mode = "RGBA"
    img.color_depth = COLOR_DEPTH
    img.compression = 15

    world = bpy.data.worlds.new("WORLD_flat_gray")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (WORLD_GRAY, WORLD_GRAY, WORLD_GRAY, 1.0)
    bg.inputs["Strength"].default_value = WORLD_STRENGTH
    scene.world = world

    cam_data = bpy.data.cameras.new("CAM_SPRITE")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = CAM_SPRITE_ORTHO_SCALE
    cam_data.shift_x = CAM_SPRITE_SHIFT_X
    cam_data.shift_y = CAM_SPRITE_SHIFT_Y
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam = bpy.data.objects.new("CAM_SPRITE", cam_data)
    cam.location = CAM_SPRITE_LOCATION
    cam.rotation_euler = tuple(math.radians(a) for a in CAM_SPRITE_ROTATION_DEG)
    scene.collection.objects.link(cam)
    scene.camera = cam

    tex_data = bpy.data.cameras.new("CAM_TEX")
    tex_data.type = "ORTHO"
    tex_data.ortho_scale = CAM_TEX_ORTHO_SCALE
    tex_data.clip_start = 0.1
    tex_data.clip_end = 100.0
    tex = bpy.data.objects.new("CAM_TEX", tex_data)
    tex.location = CAM_TEX_LOCATION
    tex.rotation_euler = (0.0, 0.0, 0.0)
    scene.collection.objects.link(tex)

    target = bpy.data.objects.new("KEY_target", None)
    target.location = (0.0, 0.0, 0.0)
    scene.collection.objects.link(target)
    key_data = bpy.data.lights.new("KEY", type="SUN")
    key_data.energy = KEY_STRENGTH
    key_data.angle = math.radians(KEY_ANGLE_DEG)
    key = bpy.data.objects.new("KEY", key_data)
    key.location = KEY_LOCATION
    con = key.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    scene.collection.objects.link(key)

    principled("TINT_paint", TINT_SRGB, TINT_ROUGHNESS)
    return scene


def principled(name, srgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    lin = srgb_to_linear(srgb)
    bsdf.inputs["Base Color"].default_value = (lin, lin, lin, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def emission(name, linear_value):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (linear_value, linear_value, linear_value, 1.0)
    em.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


# ---------- geometry ----------

def link_mesh(scene, name, bm, mat, location=(0.0, 0.0, 0.0), smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    scene.collection.objects.link(obj)
    return obj


def box(scene, name, size, center, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    return link_mesh(scene, name, bm, mat, center)


def cylinder(scene, name, radius, depth, center, mat):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=radius, radius2=radius, depth=depth)
    obj = link_mesh(scene, name, bm, mat, center)
    # Smooth sides only: flat caps keep their edge.
    for poly in obj.data.polygons:
        poly.use_smooth = abs(poly.normal.z) < 0.5
    return obj


def sphere(scene, name, radius, center, mat):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=radius)
    return link_mesh(scene, name, bm, mat, center, smooth=True)


def quad(scene, name, center, normal, up_hint, w, h, mat):
    n = Vector(normal).normalized()
    right = Vector(up_hint).cross(n).normalized()
    up = n.cross(right).normalized()
    c = Vector(center)
    bm = bmesh.new()
    vs = [bm.verts.new(c + right * sx * w / 2 + up * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(vs)
    return link_mesh(scene, name, bm, mat)


def build_test_unit(scene, tint, neutral):
    # A board piece on a round base, symmetric in x, origin at the footprint
    # centre on z = 0. Footprint 1.0 m, height 0.66 m.
    return [
        cylinder(scene, "UNIT_base", 0.5, 0.12, (0.0, 0.0, 0.06), neutral),
        box(scene, "UNIT_body", (0.56, 0.40, 0.34), (0.0, 0.0, 0.29), tint),
        box(scene, "UNIT_turret", (0.30, 0.26, 0.20), (0.0, 0.02, 0.56), tint),
        box(scene, "UNIT_plate", (0.40, 0.10, 0.15), (0.0, -0.25, 0.195), neutral),
    ]


# Swatch card: upright, square to CAM_SPRITE (normal along the camera's
# local plus z), so patches project undistorted. Centre chosen so the card
# sits in the top band of the frame, clear of the unit, sphere, and cube.
CARD_CENTER = (0.0, 0.95, 0.591)
CARD_W, CARD_H = 1.9, 0.6
PATCH = 0.30
PATCH_XS = (-0.66, -0.22, 0.22, 0.66)


def build_golden(scene, tint):
    neutral = principled("NEUTRAL_gray", NEUTRAL_SRGB, NEUTRAL_ROUGHNESS)
    ink = principled("INK_black", INK_SRGB, INK_ROUGHNESS)
    probe = principled("PROBE_gray", PROBE_SRGB, PROBE_ROUGHNESS)
    swatch = emission("SWATCH_emission", srgb_to_linear(SWATCH_SRGB))

    unit = build_test_unit(scene, tint, neutral)

    view_n = Vector((0.0, -math.sqrt(0.5), math.sqrt(0.5)))
    up_hint = Vector((0.0, 0.0, 1.0))
    card_c = Vector(CARD_CENTER)
    card = quad(scene, "CARD_base", card_c, view_n, up_hint, CARD_W, CARD_H, neutral)
    key = bpy.data.objects["KEY"]
    to_sun = Vector(key.location).normalized()
    normals = {
        "CARD_emission": view_n,
        "CARD_lit_square": view_n,
        "CARD_lit_sunward": (view_n + to_sun).normalized(),
        "CARD_lit_away": (view_n - 0.5 * to_sun).normalized(),
    }
    patches = []
    for (name, n), x in zip(normals.items(), PATCH_XS):
        tilt = view_n.angle(n)
        # Lift each patch off the card so a tilted patch clears the card.
        lift = 0.5 * PATCH * math.sin(tilt) + 0.003
        c = card_c + Vector((x, 0.0, 0.0)) + view_n * lift
        mat = swatch if name == "CARD_emission" else tint
        patches.append(quad(scene, name, c, n, up_hint, PATCH, PATCH, mat))

    cube = box(scene, "INK_cube", (0.3, 0.3, 0.3), (0.77, 0.0, 0.15), ink)
    probe_obj = sphere(scene, "PROBE_sphere", 0.18, (-0.77, 0.0, 0.18), probe)
    return {"unit": unit, "card": card, "patches": patches, "cube": cube, "probe": probe_obj}


# ---------- projection helpers ----------

def to_px(scene, cam, co):
    v = world_to_camera_view(scene, cam, Vector(co))
    return (v.x * FRAME, (1.0 - v.y) * FRAME)


def screen_bbox(scene, cam, objs):
    xs, ys = [], []
    for o in objs:
        for corner in o.bound_box:
            px = to_px(scene, cam, o.matrix_world @ Vector(corner))
            xs.append(px[0])
            ys.append(px[1])
    return [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]


def overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


# ---------- rendering ----------

def strip_text_chunks(path):
    # Cycles writes its render timings as tEXt chunks even with every stamp
    # flag off; dropping the tEXt chunks (pixels untouched) makes each PNG
    # byte reproducible run to run.
    with open(path, "rb") as f:
        data = f.read()
    out, i = [data[:8]], 8
    while i < len(data):
        n = int.from_bytes(data[i:i + 4], "big")
        if data[i + 4:i + 8] != b"tEXt":
            out.append(data[i:i + 12 + n])
        i += 12 + n
    with open(path, "wb") as f:
        f.write(b"".join(out))


def render(scene, path, samples, denoise):
    scene.cycles.samples = samples
    scene.cycles.use_denoising = denoise
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    strip_text_chunks(path)


def golden_diff(a, b):
    py = shutil.which("python3")
    if py is None:
        raise RuntimeError("system python3 with PIL not found for the golden diff")
    res = subprocess.run([py, CHECK_TOOL, "--diff", a, b], capture_output=True, text=True)
    print(res.stdout.strip())
    return res.returncode == 0, res.stdout.strip()


def main():
    scene = build_rig()
    tint = bpy.data.materials["TINT_paint"]
    cam = scene.camera
    bpy.context.view_layer.update()
    os.makedirs(os.path.dirname(RIG), exist_ok=True)
    os.makedirs(PASSES_DIR, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=RIG)
    rig_sha = sha256(RIG)
    print("wrote " + rel(RIG))

    anchor = to_px(scene, cam, (0.0, 0.0, 0.0))
    if abs(anchor[0] - ANCHOR_PX[0]) > 1e-3 or abs(anchor[1] - ANCHOR_PX[1]) > 1e-3:
        raise RuntimeError("CAM_SPRITE anchor projects to %r, not %r" % (anchor, ANCHOR_PX))

    g = build_golden(scene, tint)
    bpy.context.view_layer.update()
    regions = {
        "unit": screen_bbox(scene, cam, g["unit"]),
        "card": screen_bbox(scene, cam, [g["card"]] + g["patches"]),
        "ink_cube": screen_bbox(scene, cam, [g["cube"]]),
        "probe_sphere": screen_bbox(scene, cam, [g["probe"]]),
    }
    names = list(regions)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            if overlaps(regions[names[i]], regions[names[j]]):
                raise RuntimeError("golden items overlap in screen space: %s and %s" % (names[i], names[j]))
        r = regions[names[i]]
        if r[0] < 0 or r[1] < 0 or r[2] > FRAME or r[3] > FRAME:
            raise RuntimeError("golden item %s leaves the frame: %r" % (names[i], r))
    patch_px = {}
    for p in g["patches"]:
        centre = sum((p.matrix_world @ v.co for v in p.data.vertices), Vector()) / len(p.data.vertices)
        patch_px[p.name] = [round(c, 2) for c in to_px(scene, cam, centre)]
    probe_c = to_px(scene, cam, g["probe"].location)
    probe_info = {"center_px": [round(probe_c[0], 2), round(probe_c[1], 2)],
                  "radius_px": round(0.18 * PX_PER_M, 2)}
    unit_h = max((o.matrix_world @ Vector(c)).z for o in g["unit"] for c in o.bound_box)
    unit_fp = max(max(abs((o.matrix_world @ Vector(c)).x), abs((o.matrix_world @ Vector(c)).y))
                  for o in g["unit"] for c in o.bound_box) * 2

    bpy.ops.wm.save_as_mainfile(filepath=GOLDEN_BLEND)
    golden_blend_sha = sha256(GOLDEN_BLEND)
    print("wrote " + rel(GOLDEN_BLEND))

    tmp = tempfile.mkdtemp(prefix="aoe-golden-")
    try:
        fresh = os.path.join(tmp, "golden_rerender.png")
        render(scene, fresh, SAMPLES_BEAUTY, DENOISE_BEAUTY)
        if os.path.exists(GOLDEN_PNG):
            ok, line = golden_diff(GOLDEN_PNG, fresh)
            if not ok:
                raise RuntimeError("golden re-render over tolerance, archived golden kept, no outputs trusted: " + line)
            golden_event = "re-render diffed against the archived golden: " + line
            print("golden kept: " + rel(GOLDEN_PNG))
        else:
            shutil.copyfile(fresh, GOLDEN_PNG)
            golden_event = "golden established by this run"
            print("wrote " + rel(GOLDEN_PNG))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # ---------- passes: the test unit alone ----------
    unit_names = {o.name for o in g["unit"]}
    extras = [o for o in scene.objects if o.type == "MESH" and o.name not in unit_names]
    for o in extras:
        o.hide_render = True

    out = {k: os.path.join(PASSES_DIR, "testunit_%s.png" % k) for k in ("beauty", "mask", "shadow", "swatchmask")}
    render(scene, out["beauty"], SAMPLES_BEAUTY, DENOISE_BEAUTY)

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=CATCHER_SIZE / 2)
    catcher = link_mesh(scene, "SHADOW_catcher", bm, bpy.data.materials["NEUTRAL_gray"])
    catcher.is_shadow_catcher = True
    for o in g["unit"]:
        o.visible_camera = False
    render(scene, out["shadow"], SAMPLES_SHADOW, False)
    catcher.hide_render = True
    for o in g["unit"]:
        o.visible_camera = True

    white = emission("MASK_white", 1.0)
    black = emission("MASK_black", 0.0)
    for o in g["unit"]:
        for slot in o.material_slots:
            slot.material = white if slot.material.name.startswith("TINT_") else black
    render(scene, out["mask"], SAMPLES_MASK, False)

    half = emission("MASK_half", srgb_to_linear(SWATCH_SRGB))
    for o in g["unit"]:
        o.hide_render = True
    em = bpy.data.objects["CARD_emission"]
    em.hide_render = False
    em.material_slots[0].material = half
    render(scene, out["swatchmask"], SAMPLES_MASK, False)
    for k in ("beauty", "mask", "shadow", "swatchmask"):
        print("wrote " + rel(out[k]))

    # ---------- manifests ----------
    settings = {
        "engine": "CYCLES", "device": "CPU", "seed": SEED, "adaptive_sampling": False,
        "filter_width_px": FILTER_WIDTH, "film_transparent": True,
        "samples": {"beauty": SAMPLES_BEAUTY, "golden": SAMPLES_BEAUTY, "mask": SAMPLES_MASK,
                    "swatchmask": SAMPLES_MASK, "shadow": SAMPLES_SHADOW},
        "denoise": {"beauty": "OIDN (OPENIMAGEDENOISE, CPU)", "golden": "OIDN (OPENIMAGEDENOISE, CPU)",
                    "mask": "off", "swatchmask": "off", "shadow": "off"},
        "view_transform": "Standard", "look": "None", "exposure": 0.0, "gamma": 1.0,
        "display_device": "sRGB", "dither_intensity": 0.0,
        "format": "PNG RGBA", "bit_depth": int(COLOR_DEPTH),
        "resolution": [FRAME, FRAME],
    }
    camera = {
        "CAM_SPRITE": {"type": "ORTHO", "location": list(CAM_SPRITE_LOCATION),
                       "rotation_deg": list(CAM_SPRITE_ROTATION_DEG), "ortho_scale": CAM_SPRITE_ORTHO_SCALE,
                       "shift_x": CAM_SPRITE_SHIFT_X, "shift_y": CAM_SPRITE_SHIFT_Y,
                       "px_per_m": PX_PER_M},
        "CAM_TEX": {"type": "ORTHO", "location": list(CAM_TEX_LOCATION), "rotation_deg": [0.0, 0.0, 0.0],
                    "ortho_scale": CAM_TEX_ORTHO_SCALE},
    }
    light = {"KEY": {"type": "SUN", "strength": KEY_STRENGTH, "angle_deg": KEY_ANGLE_DEG,
                     "location": list(KEY_LOCATION), "constraint": "TRACK_TO KEY_target at the origin"},
             "world": {"color_linear": WORLD_GRAY, "strength": WORLD_STRENGTH, "hdri": False}}
    blender = {"version_string": bpy.app.version_string, "version": list(bpy.app.version),
               "build_hash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash)}
    route = ("Route substitution: the spec assumes the Colab lane (golden established in session C1 and passed on an "
             "A100 and an L4, OptiX GPU). This golden was established on local Blender 5.2.2 LTS, Cycles on CPU, "
             "because the rig and golden must live in the repo and no GPU exists in this environment. The A100 and "
             "L4 pass remains owed; no GPU pass is claimed.")

    previous = None
    if os.path.exists(GOLDEN_JSON):
        with open(GOLDEN_JSON) as f:
            previous = json.load(f)
    golden_sha = sha256(GOLDEN_PNG)
    manifest = {
        "id": "BL00",
        "step": "22a",
        "build_script": "tools/build-sprite-rig.py",
        "check_tool": "tools/sprite-rig-check.py",
        "blender": blender,
        "rig": {"file": rel(RIG), "sha256_at_save": rig_sha,
                "note": ".blend bytes can differ between saves (file header and timestamps) while renders "
                        "reproduce; the render, not the .blend sha256, is the reproducibility baseline"},
        "golden_blend": {"file": rel(GOLDEN_BLEND), "sha256_at_save": golden_blend_sha},
        "golden_png": {"file": rel(GOLDEN_PNG), "sha256": golden_sha,
                       "established": (previous or {}).get("golden_png", {}).get("established") or "2026-10-20",
                       "established_on": "local CPU (Cycles CPU, this VM); A100 and L4 pass owed",
                       "frame": [FRAME, FRAME], "deviation_448": False,
                       "last_build_event": golden_event},
        "camera": camera,
        "light": light,
        "render": settings,
        "anchor_px": list(ANCHOR_PX),
        "anchor_projected_px": [round(anchor[0], 4), round(anchor[1], 4)],
        "scene": {
            "test_unit": {"objects": sorted(unit_names), "footprint_m": round(unit_fp, 3), "height_m": round(unit_h, 3),
                          "tint_material": "TINT_paint", "other_material": "NEUTRAL_gray"},
            "swatch_card": {"emission_patch": "CARD_emission", "emission_srgb": [SWATCH_SRGB] * 3,
                            "lit_patches": ["CARD_lit_sunward", "CARD_lit_square", "CARD_lit_away"],
                            "expected_luma_order": "CARD_lit_sunward > CARD_lit_square > CARD_lit_away",
                            "patch_size_m": PATCH, "patch_centers_px": patch_px},
            "ink_cube": {"material": "INK_black", "base_srgb": INK_SRGB, "roughness": INK_ROUGHNESS},
            "probe_sphere": dict(probe_info, material="PROBE_gray", base_srgb=PROBE_SRGB, roughness=PROBE_ROUGHNESS),
            "screen_regions_px": regions,
        },
        "materials": {"TINT_paint": {"base_srgb": [TINT_SRGB] * 3, "roughness": TINT_ROUGHNESS, "metallic": 0.0},
                      "NEUTRAL_gray": {"base_srgb": [NEUTRAL_SRGB] * 3, "roughness": NEUTRAL_ROUGHNESS}},
        "tolerances": {
            "applied": "VISUAL_STRATEGY 4.2",
            "visual_strategy_4_2": {"mean_abs_diff_max_levels": 1.0, "pixels_within_8_levels_min_fraction": 0.995},
            "strategy_g11": {"mean_abs_error_max_levels": 0.5, "p99_5_max_levels": 3, "mask_max_levels": 1,
                             "note": "recorded, not the pass rule for this golden diff, per the Step 22a brief"},
            "g10_swatch_mask": "128 plus or minus 1",
            "a3_beauty_patch": "128 plus or minus 2 per channel",
            "a3_delta_e_2000_max": 2.0,
            "diff_space": "8 bit levels via PIL, premultiplied RGB plus alpha, all four channels",
        },
        "route_substitution": route,
    }
    if previous and previous.get("measured") and previous["measured"].get("golden_png_sha256") == golden_sha:
        manifest["measured"] = previous["measured"]
    else:
        manifest["measured"] = None
        manifest["measured_note"] = "run python3 tools/sprite-rig-check.py --record to fill the measured block"
    with open(GOLDEN_JSON, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("wrote " + rel(GOLDEN_JSON))

    passes = {
        "id": "BL00-testunit",
        "step": "22a",
        "rig": rel(RIG),
        "golden": rel(GOLDEN_BLEND),
        "blender": blender,
        "frame_px": [FRAME, FRAME],
        "anchor_px": list(ANCHOR_PX),
        "anchor_projected_px": [round(anchor[0], 4), round(anchor[1], 4)],
        "anchor_rule": "model origin at the footprint centre on z = 0 at world origin",
        "camera": "CAM_SPRITE",
        "render": settings,
        "outputs": {
            "beauty": {"file": rel(out["beauty"]), "sha256": sha256(out["beauty"]),
                       "how": "all unit objects visible, film transparent, shadow catcher off"},
            "mask": {"file": rel(out["mask"]), "sha256": sha256(out["mask"]),
                     "how": "TINT_ materials swapped to MASK_white (emission 1.0), all others to MASK_black"},
            "shadow": {"file": rel(out["shadow"]), "sha256": sha256(out["shadow"]),
                       "how": "4 x 4 m shadow catcher at z = 0, unit visible_camera off but casting; shadow in alpha"},
            "swatchmask": {"file": rel(out["swatchmask"]), "sha256": sha256(out["swatchmask"]),
                           "how": "G10 swatch: the swatch card's CARD_emission patch alone, material swapped to "
                                  "MASK_half (emission linear %.6f, which Standard encodes to sRGB 128), mask pass "
                                  "settings" % srgb_to_linear(SWATCH_SRGB),
                           "patch_center_px": patch_px["CARD_emission"]},
        },
        "observation": ("The mask pass is encoded by the Standard view transform, so its antialiased edge values "
                        "are sRGB encoded coverage, not linear coverage; recorded for the atlas packer, not changed "
                        "here."),
        "route_substitution": route,
    }
    with open(PASSES_JSON, "w") as f:
        json.dump(passes, f, indent=2)
        f.write("\n")
    print("wrote " + rel(PASSES_JSON))


try:
    main()
except Exception as exc:
    print("build-sprite-rig failed: %r" % (exc,), file=sys.stderr)
    sys.exit(1)
