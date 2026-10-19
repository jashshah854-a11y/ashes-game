# Ashes of Empires: Image Production Workflow and Full Visual Strategy

Written by Claude (Opus) on 2026-10-18 from RESEARCH.md and the Lamplit War Table vision board, under Jash's pipeline order (research first, then Claude designs the workflow and the strategy, then testing).
Route note: the Anthropic API route returned its known 1-byte failure after consuming usage (in 11680, out 12000). This document was produced by the documented fallback, the local Claude Code CLI on the opus model, same prompt, full text below unedited.

---

# Document 1: The Image Production Workflow

## 1.1 Ruling on the master sheet

**The master sheet is a composite built around `openai-blender-map.png`.** It sits on one sheet with a lighting panel cut from the Muse blender table, a value strip, a palette strip, a scale bar and a light glyph. Once the first texture is approved, that texture joins the sheet.

Why `openai-blender-map.png`:
1. **It has been checked first hand.** It is the closest single image we have to a buildable specification of the whole look: a raised board, materials you can read, a single light, units, castles, factories and rails all in one consistent render language.
2. **It already uses the house concept frame.** The "describe it as a Blender build" framing is recorded as a project finding. The master should speak the same language that every later prompt uses.
3. **The Muse blender map was a close second.** It lost because it only shows the map. The OpenAI frame shows the map and the pieces together, and how they sit together is what every later derivation has to respect.

What is left out of the master, and why:
- **Painterly `openai-map.png`.** It is far denser than 70 provinces can carry. Putting it in the master would pull every derivation toward density, which is the failure D6 exists to stop. It can be marketing key art only.
- **Painterly Muse map and Muse table.** They are the right mood but less buildable. Their mood survives through the lighting panel and the code-drawn lamp layer.
- **All four Gemini images and `openai-table.png`.** Nobody has looked at them first hand, so they are hearsay. An image nobody has checked is never a production reference.

What the master is NOT a reference for: geography, density, or the glowing red front line in `openai-blender-map.png`.
- The renderer draws only the simulation's geography, so the river and coastline in the hero image carry no meaning.
- The glowing front line is ruled out twice over. A glow is atmosphere sharing pixels with state (graded NEVER). Its red also collides with Khessite red.
- These exclusions are written on the annotated copy of the sheet. They are also enforced by the post steps, which strip color and normalize value whatever the generator returns.

## 1.2 Master sheet contents

The sheet is exported twice from one layout file. Both exports are hashed:
- **`M_ref`**: no text at all. This is the only copy ever sent to a model. Text on a reference sheet leaks into generations as fake lettering.
- **`M_doc`**: the same panels plus annotations, for people.

Layout: 3072 x 2048 px, eight panels.

| Panel | Contents | Purpose |
|---|---|---|
| A. Hero | `openai-blender-map.png`, full frame, scaled to fit | Material language, overall light, how pieces sit on the board |
| B. Game zoom crop | A quiet terrain region of panel A (fields, forest edge, a stretch of water), scaled so one province matches the real default zoom | Grain and feature scale at the size the player sees |
| C. Light panel | Crop of the Muse blender table: lamp, warm key from upper left, dim cool fill | The only lighting reference |
| D. Approved texture | Empty in M1. Holds the approved TX01 paper grain at 1:1 in M2 | Grain and surface reference for every later texture |
| E. Value strip | Five flat gray blocks at bands A to E (section 1.5) | Value lock that derivations are judged against |
| F. Palette strip | The board's fixed palette swatches, with Vessari blue #2E6FD8 and Khessite red #C8372D as the only saturated swatches | Reference for people only; textures never carry color |
| G. Scale bar | One lattice cell at default zoom, a 56 px sprite box, a plaque box, a "tree crown" mark and a "field furrow" mark at target feature size | Feature scale gate (G6) |
| H. Light glyph | A plain arrow from screen upper left, about 45 degrees in screen space, elevated | Light direction gate (G12) |

Versions:
- **M1** = panels A, B, C, E, F, G, H. It is used only to condition the TX01 bake-off.
- **M2** = M1 plus the approved TX01 in panel D. M2 is sealed: every later image generation is conditioned on M2 and nothing else.
- **M3 or later** happens only if a model version change forces a re-bake. It is a logged event, never a quiet swap.

The derivation rule is written at the top of `M_doc`: **every asset is derived from the master, never from a sibling asset.** A texture that came out well is never fed back in as a reference for the next one.

The scale numbers on panels B and G come from the build at default zoom (one lattice cell in CSS px, measured in Run 4), not from guesses. The master is built in Run 9, after the map geometry exists.

## 1.3 Model assignment and the texture bake-off

- **Textures and decals.** One model wins the whole texture family through a single bake-off on TX01 (paper grain). The bake-off runs in Run 9, after the OpenAI cap resets.
  - Contestants: OpenAI gpt-image (API `images.edit` with `input_fidelity="high"` and the preserve list on every call), Gemini image edit, the Muse media generator, and ComfyUI on the Colab GPU (circular padding, with M_ref as image prompt).
  - Each contestant gets the same brief, 8 generations and 2 edits.
  - Outputs are blinded: renamed to random ids and stripped of metadata.
  - Every candidate goes through the full post chain before judging and is judged composited at game zoom on the worst case fixture.
  - Score is **batch yield**: how many candidates pass every gate. The look decides ties.
  - Must-pass items: brief fit, and producibility (passes the tile and rotation tests within two heals).
  - The bake-off is re-run only when a contestant's model version changes, and it is re-blinded each time.
- **ChatGPT route caveat.** If OpenAI is only reachable through the ChatGPT web app, there is no `input_fidelity` and no parameter record. The log says "ChatGPT UI, parameters unknown". The post chain then carries more of the load, which is acceptable because color and value are locked in post anyway.
- **ComfyUI circular padding** is the standing fallback for any texture that fails healing twice, whichever model won.
- **Blender 5.2.2** (pinned, with build hash) runs on the Colab GPU lane for:
  - all sprites,
  - smoke blobs,
  - optional relief tiles (D5),
  - the final title and end frames.
  The Colab lane is driven by notebook cells, with Google Drive carrying checkpoints and manifests. SSH into Colab does not work from this VM.
- **Code only, never generated** (listed so nobody spends image budget on them): plaques, unit glyphs, building glyphs, the out of supply alarm mark, ownership bands, the front line, rivers, rails, coasts, the lamp glow, the vignette, embers, attack tracers and flashes, and hover highlights. Plaques are a deliberate no-image zone: their readability must not depend on a generator.

## 1.4 Asset inventory

Framing key:
- **Flat**: orthographic top-down surface, even diffuse light, no shadows, no objects. The Blender framing does NOT apply, because render vocabulary pulls in a studio light that bakes direction into the surface and fails the rotation test.
- **Blender framing**: describe the asset as an object rendered in Blender (orthographic frontal or set camera, named materials, named light rig).
- **Blender render**: an actual Blender render, not a prompt.

The terrain list is reconciled against the simulation's terrain types before generation starts. There is no texture for a terrain the simulation does not define, and no terrain the simulation defines goes without one.

### Textures (shipped as 8-bit grayscale PNG, 512 x 512; palette applied in code)

| ID | Asset | Source | Framing | Reference inputs | Post steps | Histogram target (p1 / median / p99) | Gates |
|---|---|---|---|---|---|---|---|
| TX01 | Paper grain, map ground under everything | Bake-off; this asset is the bake-off | Flat: "laid paper scanned under even light" | M1 | P1 to P8 | 205 / 228 / 250 | G1 to G6, G15, G17, G18 |
| TX02 | Plains and farmland | Bake-off winner | Flat | M2 | P1 to P8 | 150 / 205 / 250 | G1 to G6, G13, G15, G17, G18 |
| TX03 | Forest canopy | Bake-off winner | Flat | M2 | P1 to P8 | 140 / 195 / 245 | same |
| TX04 | Hills, painted flat version | Bake-off winner | Flat | M2 | P1 to P8 | 145 / 200 / 248 | same |
| TX05 | Mountains, painted flat version | Bake-off winner | Flat | M2 | P1 to P8 | 140 / 195 / 248 | same |
| TX06 | Marsh, only if the sim defines it | Bake-off winner | Flat | M2 | P1 to P8 | 150 / 205 / 250 | same |
| TX07 | Settled or urban ground, only if the sim defines it | Bake-off winner | Flat | M2 | P1 to P8 | 150 / 205 / 250 | same |
| TX08 | Open sea | Bake-off winner | Flat | M2 | P1 to P8; mirror tiling in code allowed if healing fights | 170 / 215 / 250 | same |
| TX10 | Unknown fog: faint mist wisps on blank parchment | Bake-off winner | Flat | M2 | P1 to P8; mirror tiling allowed | 225 / 240 / 252 (used as a lighten layer) | G1 to G6, G13, G17, G18 |
| TX11 | Last seen fog: fine pencil hatching on transparent | Bake-off winner, or code-drawn if generation misbehaves | Flat | M2 | P1 to P8, then luminance alpha (P9) | lines near 110 | G3, G4, G7, G13 |
| TX12 | HUD panel card stock | Bake-off winner | Flat | M2 | P1 to P8 | 190 / 220 / 245 | G1 to G6, G17, G18 |

Each row's histogram target sets the raw tile's range. The real acceptance number is the composite check G13: after the tile is multiplied onto its terrain color, the result must land in band B (or C or D for the fog tiles).

### Relief tiles (D5, conditional on Run 20's trigger)

| ID | Asset | Source | Framing | Reference inputs | Post | Gates |
|---|---|---|---|---|---|---|
| RX01 | Hill relief tile | Blender render: procedural heightfield, top-down ortho camera, key light from screen upper left (world vector -1, +1, +1), procedural world only | Blender render | Rig file + M2 panel H | Packer: gray, levels into band B after multiply, seam check | G3, G5, G6, G12 (replaces G4: relief is lit on purpose, so it must match the light glyph instead of passing rotation), G13, G17 |
| RX02 | Mountain relief tile | Same | Same | Same | Same | Same |

Relief tiles are seamless by construction (periodic noise) and are never rotated by the tiler.

### Decals (generated on plain white, luminance alpha, shipped as PNG with straight alpha)

| ID | Asset | Source | Framing | Reference inputs | Post | Gates |
|---|---|---|---|---|---|---|
| DC01 to DC04 | Scorch marks, four variants | Bake-off winner | Flat: "single soot scorch on plain white paper, no shadow" | M2 | P1, P2, P9 | G1, G7, G8, G13, G17 |
| DC05 to DC07 | Shell craters, three variants | Bake-off winner | Flat | M2 | P1, P2, P9 | same |
| DC08 | Rubble mark for a destroyed building, only if the sim has destruction | Bake-off winner | Flat | M2 | P1, P2, P9 | same |
| DC09 | Ink blot and cup ring, used **on the table frame only, never on the map** (a stain on the map reads as state) | Bake-off winner | Flat | M2 | P1, P2, P9 | G1, G7, G8 |

Each decal gets one variant chosen by a hash of province id and event tick, so replays look the same.

### UI frames

| ID | Asset | Source | Framing | Reference inputs | Post | Gates |
|---|---|---|---|---|---|---|
| UI01 | Table edge 9-slice: walnut rail with brass corner fittings, generated as an opaque frontal rectangle | Bake-off winner; Blender render fallback with procedural wood | Blender framing: "frontal orthographic render of a walnut table edge with brass corners, warm key from upper left" | M2 (panels A and C) | P1, P2, P10 (gradient map to the board's table colors), slice margins measured and logged | G1, G2, G12, G15, G16, G17 |
| UI02 | HUD card frame 9-slice, smaller, leather edged | Same | Same | M2 | Same | Same |

### Frames

| ID | Asset | Source | Framing | Reference inputs | Post | Gates |
|---|---|---|---|---|---|---|
| FR01 | Interim title | The existing verified Muse title art | Already made | n/a | P10 palette lock: faction colors snapped to the two hexes, everything else held under chroma cap | G1, G13 (title text area), owner approval |
| FR02 | Final title | Blender render using the real shipped miniature models on a modeled table under the lamp. Subsurface scattering, post Defocus and a long sample count are allowed here and nowhere else | Blender render | Rig file, all BL assets, M2 panel C | Packer, palette check | G1, G11 style golden, G13, owner approval |
| FR03 | Victory frame ("The war is won"): your blue piece standing, the red piece tipped over, lamp steady | Blender render | Blender render | Same | Same | Same |
| FR04 | Defeat frame ("The war is lost"): your blue piece tipped, the lamp low | Blender render | Blender render | Same | Same | Same |
| FR05 | Share card | Crop of FR02 | Derived | FR02 | Crop, export | G1 |

Using the real models in FR02 to FR04 is the strongest consistency move available: the end frames show the exact pieces the player just moved.

### Blender sprites (512 render, packed to 256, outline baked in the render)

| ID | Asset | Frames | Gates |
|---|---|---|---|
| BL00 | Rig, golden frame, swatch sphere, probe sphere | n/a | G10, G11, G12 |
| BL01 | Infantry: one big figure per stack | idle, fire 1, fire 2, recoil, hit, tipped; times two facings | G9 to G14, G19 |
| BL02 | Drone wing: one big drone hovering over a separate ground shadow | same set | same |
| BL03 | Naval flotilla: one ship, side profile | same set | same |
| BL04 | Smoke blobs, low-poly shaded, four variants | single frames | G7, G11, G13 |
| BL05 | Optional factory and fort props (Run 20, only if the worst case test passes with them in) | static, per owner tint | G9, G13, G14 |

Each render produces three passes: beauty, mask (white override on the tintable collection, Standard view, no AgX) and shadow (shadow catcher). The packer resamples in premultiplied space, trims, and writes a JSON manifest with:
- .blend hash
- Blender version and build hash
- device
- denoiser (OpenImageDenoise)
- seed
- frame map
- trim offsets
- anchor (ground contact center)

The anchor is never centered automatically, anywhere in the chain.

### Not generated but logged
One plaque font: a condensed sans with tabular figures under the SIL Open Font License (candidate: Barlow Semi Condensed). It gets an asset log entry with license and hash.

## 1.5 Value bands

Luma is on the final composite, 0 to 255, using Rec. 709 weights on sRGB values.

| Band | Range | Holds |
|---|---|---|
| A. Ink | 0 to 40 | Front line ink, stroke edges, sprite outlines, Khessite plaque fill |
| B. Terrain, In sight | 60 to 150 | Full color painted terrain |
| C. Last seen | 120 to 175 | Gray terrain, lifted, low contrast, pencil hatching |
| D. Unknown | 185 to 225 | Blank parchment with faint mist |
| E. State lights | 225 to 255 | Plaque numerals, bright stroke highlights |

B and C overlap in raw range on purpose. They separate by chroma (B has color, C has none) and by the hatching texture. Gate G13 also requires their **mean** luma to sit at least 25 levels apart on the composite.

## 1.6 Post processing steps (deterministic scripts, versioned, each run logged)

- **P1 Ingest.** Save every raw candidate untouched with its sha256 into the raw archive. Nothing is ever overwritten.
- **P2 Gray.** Convert to luminance (Rec. 709 weights on linearized values, re-encoded to sRGB) as a single channel.
- **P3 Crop and size.** Crop to a square, work at 1024, export at 512, Lanczos.
- **P4 Heal.**
  1. Offset 50 percent on both axes.
  2. Mask a cross 6 percent of the tile wide and inpaint it (OpenCV Telea first; the winning model's edit on the cross mask with M_ref second).
  3. Offset back.
  4. At most two heals. Then fall back to ComfyUI circular padding, or mirror tiling for TX01, TX08 and TX10.
- **P5 Delight.** Subtract a Gaussian blur at a quarter of the tile width and add back the mean. This removes low-frequency lighting gradients, which is what the rotation test catches.
- **P6 Levels.** Remap percentiles to the row's p1 and p99, then a gamma tweak to hit the median.
- **P7 Scale match.** Resample so dominant feature size matches the scale bar (panel G), measured by FFT peak.
- **P8 Export.** 8-bit grayscale PNG, metadata stripped, sha256 recorded.
- **P9 Luminance alpha** (decals and hatching).
  1. alpha = clamp((1 minus L minus 0.04) / 0.86).
  2. Blur alpha 0.7 px.
  3. Set color to flat board ink.
  4. Zero the outer 8 px.
  5. If the falloff misbehaves, fall back to two-background triangulation: the same blotch on black and on white, alpha solved per pixel.
- **P10 Gradient map.** A three-stop map from gray onto board palette colors, used for UI frames and the interim title.

## 1.7 Acceptance gates

Every gate writes its measured values and an evidence image into the asset log. A failing gate stops the asset, never the batch.

| Gate | Name | Method | Pass |
|---|---|---|---|
| G1 | Brief fit | Judged blind, composited at game zoom | Must pass; no score can buy it back |
| G2 | Producibility | The post chain completes without hand painting | Must pass |
| G3 | 3x3 tile test | Tile 3x3 at game zoom, view for 2 seconds; also measure gradient energy along tile edges against the interior | No seam seen; edge energy at most 1.2 times interior; no motif recognizably repeated within the 3x3 |
| G4 | Rotation test | Rotate 180 degrees and compare side by side; measure mean luma of left vs right and top vs bottom halves | No visible light direction; half-mean differences at most 3 levels |
| G5 | Histogram value range | Percentiles on the shipped tile | p1 and p99 within 3 levels of target; median within 4 |
| G6 | Feature scale match | FFT peak against the panel G target; side by side with TX01 at game zoom | Within 20 percent; judged a set |
| G7 | Halo check | Composite over the lightest and darkest terrain at game zoom and at 4x | No light or dark ring; ring luma deviates from neighbors by at most 6 levels; no rectangular ghost |
| G8 | Alpha integrity | Scan the alpha channel | Opaque regions exactly 255 (no 252 to 254); border exactly 0 |
| G9 | Silhouette ID test | Pure black silhouettes at 56 CSS px, DPR 1 and 2, in groups of all unit types mixed, from the game camera, color removed, shown to fresh judges | 100 percent of types named correctly by every judge; any confused pair means the model is wrong |
| G10 | Swatch round trip | Render the 0.5 mask swatch through the full chain and read the saved pixel | 128 plus or minus 1 in the mask pass |
| G11 | Golden frame diff | Re-render the archived golden beauty, mask and shadow at session start and pixel diff | Mean absolute error at most 0.5 levels; 99.5th percentile at most 3; mask max at most 1. Over tolerance means a full stop for the session |
| G12 | Light direction test | A probe sphere in the rig, or highlight position on the asset | Highlight in the upper left quadrant matching panel H |
| G13 | Value band composite | Drop the asset into the worst case fixture and measure band means and state contrast | Lands in its band; every state mark keeps the contrast in section 2.8.5 |
| G14 | Worst case admission | Run the fresh eyes protocol (2.8.2) with the asset in | Passes at the protocol thresholds |
| G15 | Master conformance | Side by side with M2 panels B and D at game zoom | Judged the same material family |
| G16 | 9-slice stretch | Frame at 16:9, 4:3, 21:9 and a 390 px wide portrait phone | Corners never stretch; edges repeat with no visible seam |
| G17 | Size budget | Dimensions and bytes | Tiles 512 square; decals at most 256; whole texture set under 4 MB |
| G18 | Grayscale only | Channel check | Single channel, or max chroma at most 1 |
| G19 | Outline width | Measure outline ring width at four points on each atlas frame | 1.5 CSS px plus or minus 0.3 at display size |

G3 to G6, G9 and G13 are the research's tests. G1, G2, G7, G8, G10 and G11 come straight from the lanes. G12 and G14 to G19 are mine.

## 1.8 Asset log format

One append-only JSON Lines file per family (`assets/log/textures.jsonl`, `decals.jsonl`, `ui.jsonl`, `frames.jsonl`). Blender families use their packer manifest as the log entry and link it. One line per candidate, chosen or not. A line is never edited; a correction is a new line that supersedes the old one.

```json
{"asset_id":"TX03","version":2,"status":"admitted","supersedes":"TX03@1",
 "run":"build-loop run 10","date_utc":"2026-10-21T14:05:00Z",
 "model":{"vendor":"google","model_id_as_returned":"<exact string>","route":"api edit","params":{"size":"1024x1024"}},
 "master":{"version":"M2","sha256":"<hash of M_ref>"},
 "references":[{"file":"M_ref_M2.png","sha256":"<hash>"}],
 "prompt":"<full prompt, verbatim>","preserve_list":"<verbatim>",
 "candidates":[{"file":"raw/TX03_c1.png","sha256":"<hash>"},{"file":"raw/TX03_c2.png","sha256":"<hash>"}],
 "chosen":"raw/TX03_c2.png",
 "post":[{"step":"P2","script":"post/gray.py","script_sha":"<hash>","args":{}},
         {"step":"P4","attempts":1,"method":"telea"},
         {"step":"P6","args":{"p1":140,"median":195,"p99":245}}],
 "final":{"file":"public/tex/forest.png","sha256":"<hash>","px":"512x512","bytes":183240},
 "gates":{"G3":{"pass":true,"edge_ratio":1.08,"evidence":"gates/TX03_3x3.png"},
          "G4":{"pass":true,"lr":1.2,"tb":2.1},"G5":{"pass":true,"p1":141,"median":196,"p99":244},
          "G13":{"pass":true,"band_B_mean":104}},
 "reviewer":"orchestrator","notes":""}
```

Rule: an asset with no log line does not exist. The build refuses to load any texture whose hash is missing from an admitted log line, and a test enforces that.

## 1.9 Ruling on the missing OpenAI blender table cell: skip

**Skip it.** Do not regenerate it after the cap resets, and do not substitute anything for it.
1. **It would be a sibling, not a master.** The direction is adopted and the master is chosen. A new concept image could only become one more sibling, and the workflow forbids deriving from siblings.
2. **The table framing is already covered by references nobody needs to recheck.** The verified Muse blender table supplies the lighting panel. UI01 is generated from the master, and FR02 to FR04 will be real Blender renders of the real pieces. Nothing downstream would read from the missing cell.
3. **The reset is worth more elsewhere.** The bake-off needs OpenAI's 8 generations and 2 edits on TX01 in Run 9. Spending the reset on a concept cell could cost OpenAI its place in the bake-off that actually decides production.
4. **Concept bake-offs are not production bake-offs.** Filling the 2x2 grid would make the comparison table look complete without changing any decision.

---

# Document 2: The Full Visual Strategy

## 2.1 Where the research overrides the board (research wins, one line each)

- The board spent Phase 1 effort on sprites early; the research wins: plaques and the worst case board come first and sprites come last.
- The board treated a fixed palette as the color safeguard; the research wins: pairwise tests at final size are the safeguard, and the palette is only the starting point.
- The board rejected pre-rendered maps outright; the research wins: pre-rendered texture is allowed inside the canvas base layer, under the state drawn from data.
- The board filled provinces with ownership color; the research wins: ownership is a gradient border band.
- Any darkening of fog in the board; the research wins: fog is texture and value, never darkness.
- The board let atmosphere and state negotiate their contrast; the research wins: atmosphere sits strictly below the state band, and embers move below the state layer.

## 2.2 The plan in one paragraph

A painted campaign map lies on a walnut table under one lamp. The map is drawn in canvas 2D from simulation data only:
- jittered lattice polygons with shared displaced edges,
- grayscale painted textures multiplied onto a muted terrain palette,
- rivers, coasts and rails exactly where the simulation puts them.

Ownership is a band of faction color along borders. Fog is the cartographer's blank parchment (Unknown), faded pencil (Last seen), or full paint (In sight). Plaques carry the information. Painted metal miniatures stand above the plaques, tinted in code from one gunmetal render. Every 900 ms tick can play an attack beat. Vessari blue and Khessite red are the only saturated colors on screen. Nothing on screen is invented by the renderer.

## 2.3 Layer stack (bottom to top)

1. **Table frame.** DOM and CSS: UI01 9-slice and the DC09 table stains. It holds the vignette. Vignette darkening inside the map rectangle is capped at 8 percent at the corners.
2. **Base canvas, offscreen.** Paper grain, terrain textures clipped to province polygons, sea, coasts, rivers, rails, optional relief tiles. Rendered on load and on zoom settle only. A second, gray copy is made once at load by pixel math (allowed at load, banned in the frame path) for the Last seen treatment.
3. **Fog canvas.** Unknown provinces: TX10 mist over a lifted parchment fill, with pre-rendered cloud puff stamps along their borders. Last seen provinces: the gray base copy clipped with hard edges to the jittered polygon, plus TX11 hatching. Redraws only when fog changes. No `ctx.filter` anywhere.
4. **Ambient canvas.** Embers and smoke blobs. Below state on purpose. Embers are amber, never within 25 degrees of hue of Khessite red, at most 3 px, alpha capped at 0.6.
5. **State canvas.** Ownership bands, front line ink, building glyphs, the out of supply alarm mark, decals for damaged provinces. Redraws on tick change, never on a timer.
6. **Unit canvas.** Sprites from cached per-owner atlases.
7. **Action canvas.** Attack beats and hover highlight. rAF runs only while something on this layer is moving.
8. **DOM plaque overlay.** Plaque chips with numerals, sharing the canvas container's CSS transform so zoom gestures move everything together.

Memory check at DPR 2 on a 1600 x 1120 CSS map: about 7.2M px per canvas, six canvases, about 172 MB. That is under the iOS total of about 384 MB and under the per-canvas cap of about 16.7M px. Mobile caps DPR at 1.5 by default, and 2 only if the benchmark allows it.

## 2.4 The six amendments, adopted

**D1. Ownership is a gradient border band, not a fill.**
- Changes in the board: the ownership fill is gone. Province fill tint drops to alpha 0.06.
- The band sits on each border edge between different owners (or owner and neutral or sea), clipped to the owner's own polygon so it lies on their side. It is three strokes:
  - 16 px at alpha 0.12,
  - 9 px at alpha 0.18,
  - 3 px at alpha 1.0 with 1 px ink edges on both sides,
  all on the displaced edge path. The ink edges give the band value contrast against terrain in grayscale.
- The front line (edges between opposing factions) gets a 4 px ink line under both bands. No glow.
- Borders inside one owner's territory are a thin ink province line.
- The board's Phase 3 changes with it: textures multiply into terrain colors, never owner colors. This removes the old "texture kills ownership" risk.

**D2. Fog is texture, never darkness, and Last seen hides live numbers.**
- Changes in the board: three plain-word states, separated by value first.
  - **Unknown**: blank parchment with mist, the lightest band (D).
  - **Last seen**: gray, lifted, hatched (band C).
  - **In sight**: full paint (band B).
- Last seen plaques are hollow outlines of the unit glyph with **no numeral**, and the last known owner band is drawn gray at half alpha.
- Unknown draws no state at all.
- The renderer reads only the player's view of the simulation, never the truth.

**D3. Sprites ship only after a silhouette test, with a baked dark outline.**
- Changes in the board: a gray blockout of every unit type must pass G9 before any detail is modeled.
- One big model per stack.
- The outline is an inverted hull in the .blend (Solidify modifier, flipped normals, near-black emission, kept out of the mask and shadow passes). Its thickness is set by script so it lands at 1.5 CSS px at display size.
- If two types cannot be told apart in silhouette, the model changes; the palette never does.

**D4. Canvas stands, with the nine specs.** Changes in the board: the specs become build requirements.
1. Base texture lives inside the canvas.
2. Fog edges: hard per-province edges for Last seen, stamped cloud puffs for Unknown, no `ctx.filter`.
3. Tint-mask atlases composited once per owner at load and cached as ImageBitmaps.
4. DPR caps at 2 on desktop and 1.5 to 2 on mobile, within the pixel budget above.
5. CSS transform during a zoom gesture, re-render on settle.
6. Hover highlight on the action canvas only.
7. Hit testing by lattice lookup plus ray casting on polygons, tested headless.
8. Reduced motion as in 2.6.
9. A frame-time monitor driving the degradation order: DPR step down, then effect density, then base texture resolution.

`shadowBlur`, per-frame gradients, `getImageData` and `fillText` are banned in frame-path modules by a lint test. The action canvas is budgeted as usually running.

**D5. Pre-rendered richness goes inside the canvas.**
- Changes in the board: the blanket rejection is withdrawn.
- Generated textures go in now.
- Blender relief tiles (RX01, RX02) are permitted and triggered only if the worst case board fails fresh eyes on terrain type, or the owner reads terrain as flat at an owner checkpoint.
- Relief always lands in band B after multiply.

**D6. Readability is tested on the worst case board or it is not tested.**
- Changes in the board: the demo board and opening position are no longer evidence of anything.
- Every visual feature, texture, sprite batch and effect is admitted only through 2.8.2 on the fixture in 2.8.1.

## 2.5 The three open decisions, resolved

### Decision 1: ground projection and camera lock

**Ruling: flat map, standing miniatures.** The map stays a true top-down drawing with no fake tilt. Sprites are standing pieces placed on it, rendered from one locked camera:
- Blender orthographic camera at rotation X 45 degrees, Y 0, Z 0, placed due south of the model looking north and down.
- Fixed ortho scale for every unit type. Model scale varies per type so each fills about 80 percent of the frame.

Why:
- True isometric (X 54.736) and 2:1 dimetric (X 60) only make sense on a map drawn in that projection. Both assume a Z 45 diagonal view, which shows units corner-on.
- Ashes' front runs north to south with Vessari west and Khessite east, so pieces face east or west. A camera from due south shows every piece in full side profile, the most identifiable silhouette for a soldier, a drone and a ship.
- X 45 still shows enough top surface to read as a miniature on a table rather than a cardboard standee.
- The ground footprint is foreshortened to about 0.71. It is hidden by the contact shadow, which reads as lamp-thrown at this size.
- The anchor is the ground contact center, placed at the plaque's top center. Drones float above a separate ground shadow whose center is the anchor.
- Sprites never cross a province edge at default zoom (checked by a fixture test).

Light, specified in screen space so map and sprites agree:
- Key light from screen upper left.
- Sprite rig key vector (west, north, up): (-1.0, 0.15, 1.25).
- Top-down relief rig vector: (-1.0, 1.0, 1.0).
- Both put the highlight in the upper left quadrant, verified by G12.

### Decision 2: facing policy

**Ruling: rotate, never flip. Two facings, east and west.**
- West facing is the same model rotated 180 degrees about Z under the same camera and light, so the upper-left light holds on every frame and asymmetric details stay honest.
- Cost: 6 frames x 2 facings x 3 unit types = 36 renders of 3 passes each. That is trivial on the Colab GPU.
- Facing rule in code:
  - face toward the x of the current attack target, else toward the x of the last move;
  - a purely north or south move or attack keeps the current facing;
  - new units face the enemy side (Vessari east, Khessite west).

### Decision 3: tint formula and gunmetal base

**Ruling: overlay with a mid-gray pivot, in sRGB values, computed once per owner at load.** For each atlas pixel with beauty B (sRGB, 0 to 1), mask m (0 to 1, from the mask pass, which bypasses AgX) and faction color F:

```
Y = 0.2126*B.r + 0.7152*B.g + 0.0722*B.b
T = (Y < 0.5) ? 2*Y*F : 1 - 2*(1 - Y)*(1 - F)     per channel
out.rgb = (1 - m)*B + m*T                         alpha untouched
```

- The formula runs in plain JS on typed arrays, so a Node unit test can check exact parity against a golden PNG on every platform.
- Composite ops are not used for this, because their color handling can differ by browser.

**The gunmetal base this implies:**
- Tintable surfaces must render at a median of sRGB 128 (Y 0.50, plus or minus 0.03), ranging from about 0.30 in shadow to 0.70 in highlight. At Y 0.5, overlay returns exactly #2E6FD8 or #C8372D, with form shading around it.
- Starting point: Principled base color sRGB 0.5 (linear 0.214), roughness 0.6, metallic 0. Then calibrate (Run 13): render the swatch model, measure the median in the mask region, adjust the base color until it hits 128, and lock it into the rig file.
- Untinted metal (barrels, tracks, rotors, fittings) renders at sRGB 56 to 82. That is where "gunmetal" is visible.
- The outline renders at about 16.
- Why not multiply: on a mid-gray base it shows each faction color at half value (#2E6FD8 becomes about #17376C), which sinks into the ink band. Making multiply work needs a near-white base that previews as white plastic and flattens highlights.

**Measured problem to state now:** #2E6FD8 and #C8372D have luma of about 104 and 97, only 7 levels apart. **They fail the grayscale pairwise test against each other before any art exists.** So:
- Owner identity in grayscale belongs to the plaque, not the sprite.
  - Vessari plaques: blue fill, square corners, single stroke.
  - Khessite plaques: ink fill (band A) with a 2 px red rim and chamfered corners.
  - White numerals on both.
  - That gives a value split of about 70 levels plus a shape channel.
- The Khessite inner border stroke is doubled (two 1.5 px lines); the Vessari stroke is single.
- Sprites must pass the grayscale unit test, not the grayscale owner test.
- Named fallback if the Run 19 tuning pass still fails: darken Khessite red's value while keeping its hue. That decision goes to the owner, since it changes an adopted color.

## 2.6 Attack beats inside the 900 ms tick

| Time | What happens |
|---|---|
| 0 to 150 ms | The attacker lunges 6 px toward the target: plaque first, sprite once sprites exist |
| 150 to 450 ms | Type tracer: infantry muzzle flashes, drone streak, ship shell arc |
| 450 to 650 ms | Impact flash on the defender, a decal stamp if damage is persistent, the defender's numeral ticks down |
| 650 to 900 ms | Settle. A destroyed piece plays its tipped frame and fades |

- Beats are information, so they live on the action canvas above units. Embers and smoke are atmosphere and live below state.
- Reduced motion: no lunge and no arc, one flash, numeral change.
- No beat ever lags its tick: a beat still running when the next tick lands snaps to its final state.

## 2.7 Production order, one step per build loop run

**Standing guards on every run:**
- Free models build.
- The orchestrator verifies against tests and checks screenshots directly.
- All 191 simulation tests stay green.
- The simulation source tree is byte-identical to its pinned hash (a test fails on any diff).
- Presentation reads the simulation through a read-only adapter only.
- Presentation tests and the lint test stay green.
- The asset log check passes.

A run that breaks a guard is reverted, not patched forward.

**Run 1. Fence and fixture.**
- Build: the read-only adapter; the guard tests; a fixture builder that produces the worst case board (2.8.1) through the simulation's public API or a seeded scripted run, saved as JSON; the headless Chromium screenshot harness with fixed crops.
- Verify: fixture contents against the spec, by count.
- Pass: guards green; fixture loads; crops render.

**Run 2. One-afternoon canvas benchmark** (throwaway).
- Build: rough polygons, three-stroke bands, a dummy 256 px atlas with 200 sprites, all fronts firing, on the fixture.
- Verify: 2.8.4 numbers.
- Pass: thresholds met, or the degradation order shown to meet them. Otherwise stop and re-grade against the PixiJS triggers.

**Run 3. Plaque system.**
- Build: DOM plaques on lattice centers, unit glyphs (soldier, drone, ship), both faction shapes, numerals in the OFL font, hollow Last seen style, the out of supply alarm mark, factory and fort glyphs.
- Verify: fresh eyes on unit and owner with plaques only, color and grayscale.
- Pass: 2.8.2 thresholds.

**Run 4. Map geometry.**
- Build: deterministic jitter seeded by province id; shared displaced edges; stronger displacement on coasts; sea; rivers and rails from simulation data only; DPR caps; offscreen base; zoom by CSS transform and settle re-render; lattice plus ray cast hit testing.
- Verify: topology test (the polygon adjacency graph equals the simulation's adjacency graph); invents-nothing test (drawn river, rail and coast segments match the data one to one); hit test suite; record the default zoom cell size for the master.
- Pass: all tests green.

**Run 5. Ownership bands and front line.**
- Build: the D1 bands, ink front line, near-zero fill, doubled Khessite stroke; the state canvas redraws on change only.
- Verify: owner test on the fixture; a redraw counter proves zero redraws between ticks.
- Pass: 2.8.2 owner thresholds.

**Run 6. Fog, three states.**
- Build: the D2 treatments with procedural placeholder mist and hatching; the gray base copy; hard edges and cloud stamps; Last seen numeral suppression.
- Verify: fog state test; a DOM assertion finds zero numerals in Last seen provinces; Safari run (WebKit through Playwright) shows fog drawn.
- Pass: 2.8.2 fog threshold, the assertion at 100 percent, and WebKit fog present.

**Run 7. Atmosphere and the palette harness.**
- Build: the lamp glow pre-rendered offscreen; the vignette cap; the ambient ember canvas; a CSS placeholder table frame; the pairwise palette harness (2.8.5); the frame-time monitor and degradation order.
- Verify: first full pairwise report, at edges and under maximum embers.
- Pass: 2.8.5 thresholds.

**Run 8. Attack beats with plaques.**
- Build: 2.6 beats in code, reduced motion, beat timing tests.
- Verify: frame timing during all-fronts fire; a beat never crosses a tick.
- Pass: benchmark thresholds held. **Owner checkpoint 1:** the map and pieces attacking each other, with counters standing in as the pieces.

**Run 9. Master and bake-off.**
- Build: assemble M1 (M_ref and M_doc); run the TX01 bake-off (1.3) after the cap reset; admit TX01; seal M2.
- Verify: blinding, log completeness, gates G1 to G6, G15, G17 and G18.
- Pass: a winner exists with a yield of at least 3 of 10.

**Run 10. Terrain and sea textures.**
- Build: TX02 to TX08 from M2 by the winner; post P1 to P8; in game.
- Verify: G3 to G6 and G13 per tile; fresh eyes on the fixture.
- Pass: every tile gated; 2.8.2 holds with textures in.

**Run 11. Fog and panel textures, decals.**
- Build: TX10 to TX12 and DC01 to DC08 replace the placeholders.
- Verify: G7, G8 and G13; fog test re-run.
- Pass: 2.8.2 fog threshold holds.

**Run 12. UI frames and interim title.**
- Build: UI01, UI02, FR01; the DC09 stains on the frame.
- Verify: G16 at four aspects; G13 on the title text area.
- Pass: gates green.

**Run 13. Blender rig lock** (Colab lane).
- Build: pinned 5.2.2 with a version and hash assert; a single entry point with `--python-exit-code 1`; OptiX then CUDA with a loud abort and no silent CPU; procedural world only; Cycles, 128 to 256 samples, noise threshold 0.01, min 16, OpenImageDenoise, fixed seed; sRGB, AgX, locked Look, exposure 0 asserted; locked camera, light and catcher collection; three-pass File Output; the packer; the manifest; skip-existing frames.
- Verify: G10, G11 baseline archived, G12, gunmetal calibration at 128, outline calibration (G19).
- Pass: all gates green.

**Run 14. Silhouette blockouts.**
- Build: gray untextured blockouts of infantry, drone wing and flotilla, rendered through the rig.
- Verify: G9 with fresh judges, mixed groups, both facings.
- Pass: 100 percent; any confusion goes back to modeling inside this run.

**Run 15. Infantry batch.**
- Build: the full infantry model and 12 frames; packer; per-owner tint atlases cached at load; anchored in game.
- Verify: G9, G10, G11, G19, G13, G14; Node parity test for the tint formula; the in-browser golden fixture diff (2.8.3).
- Pass: all green.

**Run 16. Drone wing batch.** Same as Run 15.

**Run 17. Flotilla batch.** Same as Run 15.

**Run 18. Smoke and sprite beats.**
- Build: BL04 smoke on the ambient canvas; beats switch to sprite frames; the tipped frame on destruction.
- Verify: frame timing; fresh eyes under maximum effects.
- Pass: benchmark and 2.8.2 hold.

**Run 19. Team color tuning pass** (scheduled; the research expects the first pass to overshoot).
- Build: adjust stroke widths, plaque rims and ember hue and alpha within the palette.
- Verify: full 2.8.5 plus colorblind simulations; fresh eyes.
- Pass: all thresholds. **Owner checkpoint 2:** the miniatures.

**Run 20. Conditional richness.**
- Build: RX01 and RX02 if the D5 trigger fired; BL05 props only if the fixture passes with them in.
- Verify: G12, G13, G14.
- Pass: or skip, logged with the reason.

**Run 21. Final title and end frames.**
- Build: FR02 to FR05 from the real models.
- Verify: G1, G13, golden archive.
- Pass: owner approval at the next checkpoint.

**Run 22. Release candidate.**
- Build: nothing new.
- Verify: the entire protocol in 2.8 from a clean checkout, plus a WebKit and a mobile viewport run.
- Pass: every threshold. **Owner checkpoint 3.**

## 2.8 Testing protocol

### 2.8.1 Worst case board fixture
- All 70 provinces developed as far as the simulation allows: factory, fort and rail wherever legal.
- Maximum units, on every front edge.
- Late game state.
- All three fog states present, including Unknown and Last seen at map edges and corners and directly next to In sight.
- Out of supply units present.
- Damaged provinces present.
- Every front firing in one tick, embers and smoke at maximum, lamp and vignette on.
- Default zoom.
- Crops: 4 corners, 4 edge midpoints, 3 center, plus the densest effect region. Desktop at DPR 1 and 2, plus a 390 px phone viewport.
- The fixture is versioned. The demo board and the opening position are never used as evidence.

### 2.8.2 Fresh eyes identification
- **Targets:** 30 per run. Each is marked with a small numbered pin placed beside the target (test overlay only, never on it).
- **Questions per target:** what piece is this, who owns it, which of Unknown, Last seen or In sight is this province.
- **Judges:**
  - Three fresh-context vision models from at least two vendors. Each sees each crop once at final size, with no zoom and no metadata, and answers in one reply.
  - At owner checkpoints, the owner plus one other person, with a 3 second limit per target.
- **Pass, color:** unit at least 95 percent, owner at least 98 percent, fog at least 95 percent.
- **Pass, grayscale:** unit at least 90 percent, fog at least 95 percent, owner at least 95 percent judged on plaques.
- **Further conditions:**
  - No unit pair confused more than once.
  - Every judge must pass individually; an average can hide one judge failing.
  - Zero numerals visible in Last seen, by automated assertion.
- **Reading feedback:** sort complaints into taste (discount, people adapt) and information (unit, owner, fog: always fixed). "Players will adapt" never applies to an information complaint.

### 2.8.3 Golden frame pixel diffs
- **Blender session:** G11 at the start of every session. Over tolerance is a full stop.
- **Atlas:** frames that did not change in a batch must be byte-identical to the previous atlas.
- **In browser:** fixed-seed fixture screenshots per crop, diffed against the committed golden.
  - Unchanged regions: at most 0.1 percent of pixels differing by more than 8 levels.
  - Changed regions: need orchestrator approval and a new golden with a log line.
  - Beats are frozen at fixed timestamps (0, 300, 550, 850 ms) for capture.

### 2.8.4 Canvas benchmark (Lane 4, one afternoon, Run 2, repeated in Runs 8, 18 and 22)
- **Setup:** headless Chromium on the fixture at DPR 2, plus a 4x CPU throttle run, plus a SwiftShader software GL run as the pessimistic floor.
- **Pass:**
  - State canvas redraw: p95 at most 6 ms.
  - Animated frame with 200 sprites and all beats: p95 at most 10 ms unthrottled and at most 16.7 ms throttled.
  - Base re-render on zoom settle: at most 120 ms.
  - No main thread task over 50 ms during a tick.
  - Total canvas memory under the iOS budget at each DPR cap.
- **Failure:** apply the degradation order and re-measure.
- **PixiJS re-grade triggers, named now:** more than about 1,000 sprites at once, territory drawn per pixel, or core play depending on shader effects.

### 2.8.5 Palette pairwise tests
- **Pairs:** every pair that can touch on screen:
  - faction vs faction (bands, plaques, sprites);
  - each faction vs each terrain, at both texture extremes;
  - each faction vs sea;
  - the fog states pairwise;
  - river vs each terrain;
  - plaque vs each local background;
  - each faction vs ember and smoke at maximum density.
- **Measured** at final size on fixture composites, not on swatches, in color, in grayscale, and under deuteranopia, protanopia and tritanopia simulation.
- **Pass:**
  - State marks against local background: contrast ratio at least 3:1 in grayscale, at map edges and under maximum embers.
  - Fog state means at least 25 levels apart.
  - Faction plaque fills at least 50 levels apart in grayscale.
  - Faction vs faction CIEDE2000 at least 30 in color and at least 20 under each colorblind simulation.
  - Faction vs ember CIEDE2000 at least 20.
  - Terrain chroma stays under the cap, so the two factions are the only saturated colors.

### 2.8.6 Renderer invents nothing
Run on every run from Run 4 on:
- the topology test;
- one-to-one counts of rivers, rails, coasts, units and buildings against the player's view of the simulation;
- jitter determinism (same seed, identical base canvas hash);
- the lint test for banned frame-path calls.

---

Neither document has been saved to a file yet. Two things need the owner:
- **Khessite red.** The faction colors sit only 7 levels apart in grayscale. My fix is in the plaques. If Run 19 still fails, darkening Khessite red is the owner's call.
- **When the miniatures arrive.** At checkpoint 1 the "models attacking each other" are counters, not miniatures, because the research puts sprites last.
