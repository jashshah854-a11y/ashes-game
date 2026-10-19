# Ashes of Empires: Vision Board and Build Document

Provenance: written by Claude Opus 5.5 on 2026-10-18 (three calls, usage in 1440 out 8000, in 2153 out 8000, in 402 out 1391), ordered by Jash after he saw the tile interface and rejected it: the map must read as real geography, units must be visible and seen to attack, and the game must look good. Adopted as the build direction from Cycle 23 onward. Concept images live in art-direction/ in this repo: vision-map.webp (the theater as it should read), vision-title.webp (title screen art), vision-table.webp (the war table itself, storyboard frame 1).

## 1. Art Direction: "The Lamplit War Table"

The game looks like a general's campaign map at night: a painted relief map under warm lamplight, with painted metal miniatures standing on it. Terrain is muted and earthy. Faction color is the only saturated thing on the board, so ownership always wins the eye. Fire, impacts and alerts use one ember orange. Ink lines are dark brown, never black. Light comes from the upper left on every asset, rendered and drawn, and the edges of the map fall into a soft vignette.

**References:** the map screen of Unity of Command II, Hearts of Iron IV terrain mode at close zoom, 1914 staff maps with hatched front lines, and painted tabletop miniatures in the style of Axis and Allies or Memoir 44.

**Palette (fixed, builders do not invent colors):**

| Role | Hex |
|---|---|
| Paper | #E6D8B5 |
| Ink | #2B2620 |
| Sea deep | #2F4A5A |
| Sea shallow | #4F7183 |
| Plains | #A9A06A |
| Forest | #5E6B45 |
| Hills | #9A8A62 |
| Mountains | #8A8378 |
| Marsh | #6F7A5C |
| Steppe | #BFA875 |
| Vessari blue | #2E6FD8 |
| Khessite red | #C8372D |
| Ember | #F29A2E |
| Remembered fog | sepia, 60% desaturated |

**Type:** province names in a small caps serif (IM Fell English SC, OFL). All numbers in a condensed sans (IBM Plex Sans Condensed, OFL). Both are bundled as local woff2 files. Numbers are never set in the decorative face.

## 2. The Map

**Ruling: the map is drawn in canvas 2D by code, generated from the simulation's own data.** Image model output is used only as seamless terrain textures that fill provinces. It is not the map.

**Why the other two routes lose:**

- **Painted map with overlays.** An image model cannot draw 70 provinces whose borders, rivers and coasts match the simulation's adjacency, river edges and coastal flags. The painting would show a river where the game has none, and players would plan around a lie. Any data change also means repainting.
- **Blender rendered terrain.** This would look the best as a still. It is still a baked image, though, so ownership, fog and front lines go on top as overlays anyway. It also couples every map tweak to a Colab session that the automated loop cannot run on its own. The cost is high, it is fragile, and the only gain is in an area (relief shading) that textures already cover.
- **Canvas.** Canvas is the only route where the picture is the state. Rivers sit exactly on the edges the simulation marks as rivers. A border turns red the same tick the province changes hands. It has no build step, and it costs nothing at 900 ms ticks.

**Geometry (the core trick):** keep the 10 by 7 lattice, but stop drawing squares.

- Each lattice corner point is jittered with a seeded RNG, up to 30% of a cell. Because each jittered corner is shared by every province that touches it, adjacency stays identical to the grid.
- Each shared edge is then subdivided four times with midpoint displacement, seeded by edge id, so both neighbors draw the same wiggly border.
- Do not use Voronoi. It creates diagonal contacts the simulation does not have, and players would see two provinces touching that cannot attack each other.
- A presentation test asserts that two provinces share a drawn edge if and only if the simulation lists them as neighbors.

**Layers:**

1. **Static base, drawn once to an offscreen canvas:** sea, coastlines, terrain, rivers, rails, city sites, names.
2. **State layer, redrawn on every tick that changes state:** ownership tint, borders, front lines, fog, supply.
3. **Unit and effect layer:** animated with requestAnimationFrame only while something is moving, and fully idle when nothing is. Units, attack effects and movement arrows live here.
4. **Interface layer, plain DOM over the canvas:** tooltips, the province panel, production and research queues. Text in the DOM stays sharp at any zoom, and the canvas never draws a menu.

## 3. Units and Combat

**Ruling: units are painted metal miniatures rendered in Blender on the Colab A100 and exported as sprite sheets.** Code draws everything that carries information around them: bases, plaques, numbers and arrows.

**Why the other two routes lose:**

- **Image model miniatures.** Each generation drifts in silhouette, scale, camera angle and light direction. Three unit types times two factions times several poses would never look like one set. Walk frames that do not match each other are worse than no animation.
- **Drawn shapes.** Shapes give you counters, not miniatures. They read well, but they make the game look like a spreadsheet, and Jash asked for production values. Drawn shapes are kept only as the Phase 1 placeholder and the permanent fallback if a sprite fails to load.
- **Blender.** One scene, one camera, one key light from the upper left, every frame. Three models are a small modeling job, and once the scene exists, re-rendering at a new size or angle is a single Colab run. The miniatures are rendered in neutral gunmetal with a separate tint mask pass, so code applies Vessari blue or Khessite red from the palette. No faction color is ever baked into a sprite, and no rendered color can drift from the table above.

**Representation:**

- **Infantry stack:** three rifleman figures on one round base. The base rim is faction color. A small brass plaque under the base shows strength in IBM Plex Sans Condensed. If a province holds more than one stack, the miniature stays single and the plaque reads "3 × 12" style: count, then total strength. One miniature per province keeps the board from turning into a crowd.
- **Drone wing:** three small drones in a V, drawn 12 px above their own soft shadow on the map. They bob 2 px on a 1.6 second loop. The shadow is what tells the eye which province they are over.
- **Naval flotilla:** one destroyer miniature with a short code drawn wake behind it. Flotillas sit on sea cells and rock 1 degree on a 2 second loop. A blockading flotilla gets a dashed ember ring on the blockaded coast, not on the ship.
- **Default size:** 56 px tall on screen at default zoom, rendered at 256 px so hi DPI and zoom never blur.

**Movement:**

- Orders show as a dashed ink arrow from the unit to its destination, curved slightly so arrows in opposite directions do not overlap.
- When the simulation moves a unit, the state layer updates immediately. The miniature glides from the old province centroid to the new one over 0.7 seconds with ease in and ease out, finishing 0.2 seconds before the next tick.
- Infantry plays its 8 frame walk while moving. Drones fly a shallow arc. Flotillas follow a sea lane polyline, never cutting across land.
- If a new tick arrives before an animation finishes, the miniature snaps to its true position. Animation never lags the simulation by more than one tick. The truth always wins over smoothness.

**Attack beats (one ground attack, 0.9 seconds total, fits in one tick):**

| Time (s) | Beat |
|---|---|
| 0.00 | Attacker lunges 25% of the way toward the shared border. |
| 0.15 | Ember muzzle flash on the attacker, 3 frames. |
| 0.20 | Three short tracers cross the border toward the defender. |
| 0.35 | Impact: ember burst on the defender, then a smoke puff begins. |
| 0.40 | Defender shakes 4 px for 0.15 seconds. |
| 0.45 | Damage number rises 20 px from the defender's plaque and fades by 0.85. |
| 0.55 | Attacker slides back to its centroid. |
| 0.90 | Smoke is gone. Board is still. |

- **Drone strike:** the wing dives from its hover height to the target over 0.3 seconds, flashes at 0.35, and climbs back by 0.8.
- **Naval fire:** two broadside flashes at 0.15 and 0.25, white splash columns at the target from 0.35 to 0.7.
- **Destruction:** the miniature tips over and fades over 0.6 seconds. A scorch decal stays on the province for 10 ticks.
- **Legibility rules for effects:** plaques and numbers draw above every effect, always. No more than 6 attacks animate at once. Extras resolve with only the damage number, and the player's own battles take priority. In remembered or dark fog, nothing animates that the simulation has not revealed to the player. A battle the player cannot see is not shown.

## 4. Storyboard

**Frame 1: Title screen.** A Blender render of the war table at night. A brass lamp in the upper left throws a warm pool across the map. Blue and red miniatures face each other across a river, and one red figure lies tipped over in the foreground. The title is set in IM Fell English SC in ink brown on a paper strip. Two buttons, New War and Continue, sit low and quiet. The player should feel they have walked into a tent where something has already started.

**Frame 2: Opening day.** The map fills the screen. It reads as a coastline with real bays, rivers that bend, a mountain spine of ink hachures across the middle. Blue tint covers the west, red the east, and a wide band of sepia remembered fog and dark ground sits between them. A handful of miniatures stand near each capital. Nothing moves until the player gives the first order. The feeling is calm and readable: here is my country, there is theirs, I do not know what is in between.

**Frame 3: Mid war front line.** The fog has burned back. A hatched ink front line runs north to south through the middle, with blue and red miniatures facing each other on both sides of it. Dashed order arrows push east in two places. One factory province glows faintly ember because it is under drone attack. Supply lines thin out behind the blue salient, and the player can see the overreach before the game tells them. The feeling is pressure: the map is busy, but every number is still readable.

**Frame 4: A battle moment.** Close zoom on a river crossing. A blue infantry stack lunges toward the bank, muzzle flashes pop, tracers cross the water, and an ember burst hits the red stack on the far side. The red plaque drops from 14 to 9 and a white "minus 5" floats up. Behind it, a blue flotilla fires splash columns into a coastal fort. The player feels the hit land and knows the result before reading the log.

**Frame 5: End screen.** The same table as the title, morning light now instead of lamplight, with the winning faction's miniatures standing on the losing capital. A paper ledger card lists days fought, provinces taken, units lost and factories built, all in Plex numbers. One button: New War. The feeling is a quiet ending, the lamp is out and the map is settled.

## 5. Asset List

| Asset | Route | Size and format |
|---|---|---|
| Terrain textures: plains, forest, hills, mountains, marsh, steppe | Image model, then desaturated and tiled in code, multiplied by the palette color | 6 × 512 × 512 seamless PNG, grayscale |
| Sea texture | Image model, grayscale | 512 × 512 seamless PNG |
| Paper grain overlay | Image model | 1024 × 1024 seamless PNG, grayscale, 12% opacity |
| Coastlines, borders, rivers, rails, front line hatching | Code | Canvas paths |
| Mountain hachures and forest tree stamps | Code | Canvas paths, seeded per province |
| Fog: live, remembered, dark | Code | Canvas filter and fill |
| Lamp glow and vignette | Code | Radial gradients, vignette capped at 15% darkening |
| Infantry miniature: idle 1 frame, walk 8, fire 4, destroyed 6 | Blender on Colab | 256 × 256 frames, PNG atlas with alpha, plus tint mask atlas, plus JSON frame map |
| Drone wing: hover loop 8, dive 6, destroyed 6 | Blender on Colab | Same atlas format |
| Flotilla: rock loop 8, broadside 4, sinking 8 | Blender on Colab | Same atlas format |
| City, capital, factory, fort markers | Blender on Colab | 128 × 128 PNG with alpha, plus tint mask |
| Smoke puff | Blender on Colab | 16 frames at 128 × 128, PNG atlas |
| Muzzle flash, tracers, ember burst, splash columns, damage numbers | Code | Canvas particles and text |
| Scorch decal | Image model | 128 × 128 PNG with alpha, 3 variants |
| Unit bases, rims, brass plaques | Code | Canvas shapes |
| UI panel frame (wood and brass) | Image model | 256 × 256 PNG, 9 slice |
| Interface icons: production, research, supply, blockade, fort, rail | Code | Inline SVG, 24 px, ink color |
| Title screen | Blender on Colab, same scene and miniatures | 2560 × 1440 JPG, quality 85 |
| End screens: Vessari victory, Khessite victory | Blender on Colab, same scene, morning light | 2 × 2560 × 1440 JPG |
| Fonts: IM Fell English SC, IBM Plex Sans Condensed | Bundled | woff2, local |

Audio is not on this board. It deserves its own document.

## 6. Build Plan

**Rules for every cycle:**

- One cycle builds one step. A free model writes the code. The orchestrator verifies, and a step that fails verification is reverted, not patched over.
- The orchestrator diffs the simulation directory on every run. Any change to simulation code or simulation data rejects the step outright.
- All 191 simulation tests must pass on every run.
- Every presentation step adds at least one presentation test of its own. Screenshot checks run in headless Chromium against a fixed seed and a fixed saved game.
- A palette lint fails any hex color in presentation code that is not in the palette table.

**Phase 1: the map stops looking like squares, and units appear on it.**

1. Geometry module: seeded corner jitter and midpoint displaced shared edges, a pure function from simulation data to polygons. Tests: the adjacency test (shared drawn edge if and only if neighbors), determinism under a fixed seed, and no polygon self intersects.
2. Static base layer on an offscreen canvas: sea, coastlines, flat palette terrain fills. Test: no straight axis aligned border segment longer than 40% of a cell appears in the screenshot.
3. Rivers drawn only on simulation river edges, rails, city sites, province names placed at each polygon's widest interior point. Test: every simulation river edge has a drawn river and no other edge does. Names never overlap each other.
4. State layer: ownership tint, borders, three state fog, front line hatching. Test: capture a province in the saved game and assert the border changes on the same tick.
5. Hit testing by point in polygon. Test: clicking the centroid of every province selects that province.
6. Placeholder units in code: base, faction rim, plaque, and a simple silhouette per type, at centroids. Test: every unit the simulation reports as visible to the player appears, and none in fog appear.
7. Sprite loader that uses Blender atlases if present and falls back to placeholders if not. Test: game runs with the atlas folder deleted.

Between steps 6 and 7, Jash runs the Blender notebook on Colab once by hand and commits the atlases. The loop cannot do this part, and the plan does not pretend it can.

**Phase 2: units move and visibly fight.**

8. Movement interpolation with the snap rule. Test: at every tick boundary, every miniature is at its true province within 1 px.
9. Order arrows. Test: arrows match the simulation's queued orders.
10. Ground attack beats from the table in section 3. Test: a scripted battle produces the beat sequence, and the plaque shows the post combat number by the end of the tick.
11. Drone strike and naval fire beats.
12. Destruction animation and scorch decals.
13. Effect cap and priority, plus the fog rule for battles. Test: a saved game with 20 simultaneous battles never animates more than 6, and no battle in fog animates.

**Phase 3: production values.**

14. Terrain textures multiplied into the fills, paper grain, lamp glow and vignette.
15. Title and end screens.
16. UI panel frame and icons.

**Phase 4: polish.**

17. Zoom and pan with level of detail: below default zoom, miniatures shrink to plaques only.
18. Reduced motion setting: movement snaps, attacks show only the damage number.
19. Performance budget: the frame must render in under 8 ms on a mid range laptop with every unit on the map. Test: timed render in headless Chromium.

**Risks, named honestly:**

- **Textures can kill ownership.** A busy forest texture under a blue tint turns muddy. This is the biggest legibility risk on the board. Mitigation: textures are grayscale, capped at 20% contrast, and the screenshot test checks that tinted provinces stay within a set distance of the pure faction color. If they fail, textures get cut, not the tint.
- **The vignette can hide real provinces.** Edge provinces are playable ground. The vignette is capped at 15% and never touches plaques or names.
- **Jitter can make slivers.** A 30% jitter can pinch a province until its name and unit do not fit. Mitigation: a test asserts every polygon has a minimum interior width, and the seed is rerolled if any fails.
- **Ember means too many things.** Fire, alerts and blockades all use ember, and ember sits close to Khessite red. Ember is always a glow or a ring, never a fill, so it cannot be mistaken for ownership.
- **Red and blue
are close enough to ember under protanopia and deuteranopia that a Khessite border next to a burning province can read as one shape. Ember must never touch a red edge without a dark outline, and every faction mark needs a second cue (plaque shape or edge pattern) so color is never the only signal.

- **Sprite pipeline cost.** Blender renders are slow to iterate and easy to drift in lighting, angle and scale between batches. Lock one camera, one light rig and one export size before rendering more than a test set, or the units will not look like they belong to the same table.
- **Beats outrunning the tick.** If attack animations are timed by feel, they will spill past 900 ms and start stacking on the next tick. Beats must be scheduled as fractions of the tick and cut cleanly when a new tick lands, with the simulation state always winning over whatever the animation was showing.
- **Fog leaks.** Any render path that reads full simulation state can show what the player should not see: a plaque count, an edge glow, a sound cue. The renderer should receive a fogged view, not the full state, so leaks are impossible rather than merely avoided.
- **Redraw cost.** Displaced edges and jittered corners are cheap once, expensive every frame. Cache the base map and redraw only what changed, or the canvas will stutter on large maps and low end machines.
- **Scope creep against the test suite.** Visual work tempts changes to simulation code "just to expose one field." Every such change risks the 191 tests. Rendering reads; it does not reach in and edit.

## 7. One ruling

If only three things get built, build these, in this order:

1. **The map from simulation data, with fog applied.** Shared jittered corners, displaced edges, the fixed palette, and a renderer that only ever sees the fogged view. This is the board. Without it nothing else has a place to stand, and it settles the two risks that can quietly ruin trust: wrong borders and leaked information.

2. **Code drawn plaques on plain tokens.** Faction mark, unit type, strength, readable at the smallest zoom. This is where legibility is won or lost. A player who can read every plaque can play the full game on flat tokens.

3. **Attack beats inside the 900 ms tick.** Windup, strike, result, timed as fractions of the tick and cut cleanly when the next one lands. This turns state changes into events a player can follow, which is the difference between watching numbers change and seeing a war.

The Blender sprites do not make the list. They are the most visible part of the board and the least necessary. Plaques carry the information, beats carry the action, and sprites can be added later on top of both without changing either.
