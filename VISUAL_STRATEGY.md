Route note (added by Vector, 2026-10-19): commissioned by Jash the same morning he ordered the Cycle 23 reorder (visuals first) and the rendition to Blender process. Produced by Claude (Opus) as the design authority. The anthropic.py API route returned its known 1 byte failure while consuming usage (in 2612, out 12000), so the document was produced through the documented fallback, the local Claude Code CLI (claude -p --model opus), in about 11 minutes. Dash scan on receipt: zero em dashes, zero en dashes.

I couldn't save VISUAL_STRATEGY.md because writing to `/tmp` was denied, so the full document is below. Approve the write, or tell me where the repo lives, and I'll save it there. I also couldn't open STRATEGY.md or RESEARCH.md to check exact paths. The document handles that with one rule (section 0.3): if STRATEGY.md already names a path for something, that path wins.

Four points need your attention:
- **Two rulings are interpreted, not changed** (7.4 and 7.8). Section 7.4 says the value bands cover the board and the small map on the end screens, not the title and end scenes. Section 7.8 proposes a new value band for units and structures, and it needs your ruling.
- **There is a gap in the order (7.7).** No step makes the Blender versions of the city, capital, factory, fort or terrain pieces. The document has Step 17 build the finished city, capital, factory and fort, and the terrain pieces wait until Step 23.
- **ChatGPT sessions start today**, while Steps 7 to 11 need neither ChatGPT nor Colab. That way the daily cap never holds up a step (6.2).
- **On order 2:** I took "Claude Design" to mean the design authority owns all visual decisions. If you meant Anthropic's Claude Design product, only the role name in 0.2 changes.

---

# VISUAL_STRATEGY.md

Ashes of Empires: the visual plan, storyboard, mood board, and production process

Status: adopted for execution, 2026-10-19
Authority: Claude Design (design authority for this project; owner of all visual work by Jash's order 2)
Serves: DECISIONS item 28 (reordered production, Steps 7 to 25)
Sits under: VISION_BOARD.md ("The Lamplit War Table"), RESEARCH.md, STRATEGY.md. Where this document and a binding ruling from those files disagree, the binding ruling wins and this document is wrong; report it, do not improvise.

---

## 0. How to use this document

### 0.1 Jash's orders, and how this document answers each

| Order | What it means in practice | Where it is answered |
|---|---|---|
| 1. Visuals first, starting now | The build loop's next runs are visible work (Steps 7 to 11 change what the player sees on every run). Scarce sessions are booked ahead so no visual step waits. | Sections 1, 6 |
| 2. Give visual work to Claude Design | Claude Design writes every brief, makes every selection, and signs every admission. Nobody else makes a visual design decision. | 0.2 |
| 3. ChatGPT renditions, then Blender remakes | Every 3D component goes: master sheet, then ChatGPT rendition (the target), then Blender remake (the shipped asset). | Sections 3, 4 |
| 4. A storyboard, mood board, vision board | The storyboard is 10 numbered frames captured from the real game. The mood board is the master sheet. The vision board stays VISION_BOARD.md. | Sections 1, 2 |

### 0.2 Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| Claude Design | design authority | Writes brief files, runs selection, signs admissions, versions the master sheet, rules on gate failures using Section 5 | Edits code or renders |
| Builder | the build loop (free builder model) | One verified step per run: canvas code, harness, captures, gate scripts, staging, asset log entries | Chooses between candidates, changes a brief, changes a palette value |
| Rendition operator | Jash, in his own ChatGPT browser account | Runs a rendition session exactly as the brief file says and drops outputs on Drive | Edits prompts, re-rolls outside the brief count |
| Colab operator | whoever runs the notebooks | Runs the Blender notebook for the named session, golden frame first | Models outside the brief's modeling targets |

### 0.3 Fixed facts every section relies on

- Palette (fixed, never tuned): Paper #E6D8B5, Ink #2B2620, Vessari blue #2E6FD8, Khessite red #C8372D, Ember #F29A2E.
- Value bands on the final board composite (Rec. 709 luma, 0-255): Ink 0-40; Terrain in sight 60-150; Last seen 120-175; Unknown 185-225; State lights 225-255. Atmosphere stays below 225.
- Reference capture: headless Chromium, viewport 1600 x 900, device pixel ratio 1, plus a second capture at ratio 2. Default zoom is 1.0 as defined in js/map-canvas.js.
- Board sprite display box: 56 x 56 px at default zoom (capital: 64 x 64 px). Rendered at 4x (224 px; capital 256 px).
- Grayscale means Rec. 709 luma: Y = 0.2126 R + 0.7152 G + 0.0722 B on sRGB values.
- Paths: where STRATEGY.md already names a path for the same thing, that path wins. Otherwise use the paths below.

| Thing | Path |
|---|---|
| Master sheet (current) | art-direction/master-sheet.png and art-direction/master-sheet.json (labels live in the JSON, never on the image) |
| Master sheet history | art-direction/master-sheet/vN/ |
| Adopted diorama | art-direction/master-diorama-board.png (never edited) |
| Asset log (append-only) | art-direction/asset-log.jsonl |
| Brief files | art-direction/briefs/R<session>-<family>.md |
| Renditions | art-direction/renditions/<family>/ |
| Storyboard captures | art-direction/storyboard/current/ and art-direction/storyboard/step-NN/ |
| Fixtures | fixtures/storyboard/F01.json to F10.json |
| Runtime assets | assets/ (only admitted assets) |
| Drive conveyor | Drive: AshesOfEmpires/inbox/renditions/YYYY-MM-DD/, AshesOfEmpires/colab/in/, AshesOfEmpires/colab/out/ |
| Blender rig | blender/rig/aoe_rig_v1.blend, golden frame blender/golden/golden_v1.png |

### 0.4 Component IDs

Every component in this document has one ID. Log entries, file names, and briefs use it.

| ID | Component | Kind |
|---|---|---|
| U-INF | infantry stack | Blender board sprite |
| U-DRN | drone wing | Blender board sprite |
| U-FLT | flotilla | Blender board sprite |
| S-CTY | city | Blender board sprite |
| S-CAP | capital | Blender board sprite |
| S-FAC | factory | Blender board sprite |
| S-FRT | fort | Blender board sprite |
| T-xxx | terrain pieces, one per raised terrain type in the sim's terrain list (for example T-FOR forest, T-HIL hills, T-MTN mountains) | Blender board sprite |
| FX-SMK | smoke loop | Blender flipbook |
| SC-TTL | title scene | Blender scene |
| SC-VIC | victory scene | Blender scene |
| SC-DEF | defeat scene | Blender scene |
| TF | table frame around the map | Blender scene, static |
| TX-TER, TX-SEA, TX-RIV | terrain, sea, river fills (one TX-TER per terrain type) | texture |
| TX-FOG-LS, TX-FOG-UK | last seen paper, unknown paper | texture |
| TX-PNL | UI panel surface | texture |
| DC-xx | ground decals (craters, roads, scorch) | texture |
| K-BAND | ownership bands | code |
| K-FRONT | front line | code |
| K-FOG | fog states | code |
| K-PLQ | plaques and numerals | code (proven, do not redraw) |
| K-BEAT | attack beat flash and edge light | code |
| K-ATM | atmosphere (lamp warmth, vignette, grain) | code |
| K-TXT | all player-facing words, including the title wordmark | code |
| K-MINI | small board map drawn from final sim state | code |

### 0.5 The board's draw order (bottom to top)

1. TF table frame (outside the map rectangle only)
2. TX-SEA, TX-TER, TX-RIV fills, clipped to province polygons from js/map-geometry.js
3. DC-xx decals, clipped to their province polygon
4. K-BAND ownership bands
5. T-xxx terrain pieces
6. S-xxx structures (tinted)
7. U-xxx units (tinted), in sight provinces only
8. FX-SMK smoke
9. K-ATM atmosphere (affects layers 1 to 8 only)
10. K-FOG texture overlay for Last seen and Unknown provinces
11. K-FRONT front line
12. K-PLQ plaques and numerals
13. K-BEAT state lights

Rulings carried in this order: units are not drawn in Last seen or Unknown provinces (Last seen shows only the hollow plaque at the last known position). Structures and terrain pieces stay drawn under the fog texture, because they are map knowledge, not live state. Atmosphere never touches layers 10 to 13.

---

## 1. The storyboard

The storyboard is captured, not painted, wherever the board is on screen. Each frame below has a fixture (a saved sim state) and is captured by the storyboard harness on every step that touches it. Early captures show placeholders where components do not exist yet; the contact sheet is the progress report Jash looks at.

### 1.1 Storyboard harness (builder builds this in Step 7, first run)

- storyboard.html?frame=Fxx loads fixtures/storyboard/Fxx.json into the renderer, draws one frame, and stops. No clock runs. F05 also takes &beat=0, &beat=1, &beat=2 (start, peak, settle).
- tools/make-fixtures.js runs the sim headless with seed 20261019 and saves the first state that meets each frame's condition below. F07 is synthetic: the script builds it by editing a saved state. If a condition is never met within 3000 ticks, the script tries seeds 20261020, 20261021, and so on, and records the seed used in the fixture.
- tools/storyboard-capture.js writes, per frame: Fxx.png (1x), Fxx@2x.png, Fxx-gray.png (luma), and composes contact-sheet.png (all frames in a 4 x 3 grid, frame ID under each in the sheet margin). It copies the set to art-direction/storyboard/step-NN/ when a step is accepted.

### 1.2 The frames

#### F01 Title

- Composition: the war table at night in lamplight. The diorama board sits in the middle distance, slightly out of focus. One brass lamp at upper left throws warm light across the board edge. The upper third is dark, empty table and shadow, reserved for the wordmark. Two plain buttons centered in the lower third: "New game", "How to play".
- Camera: Blender perspective camera, 50 mm, eye low at the table edge, pitched 18 degrees down, 16:9 frame (rendered 3840 x 2160, shipped 1920 x 1080).
- Sim-true: nothing. This is a scene. The board in it shows no readable state (no plaques, no numerals, no front line).
- Components: SC-TTL, K-TXT (wordmark and buttons, typeset in code), K-ATM (grain only).
- Proves: the material ceiling of the game. A player sees a physical, lit object worth touching.
- Interim (Step 15): the selected SC-TTL rendition as background, wordmark in code. Final (Step 24): the Blender SC-TTL render.

#### F02 Opening board

- Fixture: tick 0 of the seed.
- Composition: the whole 10 x 7 lattice centered on the table frame, TF visible as a border of wood and paper edge on all four sides. Blue nation left, red right, the river down the middle, as in the master diorama.
- Camera: canvas view, top-down, zoom 1.0, centered on the lattice center. Sprites carry the 45 degree look; ground fills are top-down.
- Sim-true: every province polygon, every owner, every structure position, every starting unit with its numeral, terrain type per province, fog state per province from the player's side.
- Components: TX-TER, TX-SEA, TX-RIV, T-xxx, K-BAND, S-CAP, S-CTY, S-FAC, S-FRT, U-INF, U-FLT, K-FOG (Unknown on the enemy side), K-PLQ, K-ATM, TF.
- Proves: in 3 seconds a new player can say which side is theirs, where the river is, and where their armies stand.

#### F03 First contact

- Fixture: first tick at which a Vessari unit and a Khessite unit stand in adjacent provinces and both are in sight for the player.
- Composition: whole board, default zoom. The contact pair falls in the middle third of the screen in most seeds; do not reframe.
- Camera: as F02.
- Sim-true: the front line exactly on the edges where owners differ; the enemy plaque newly visible; fog boundaries.
- Components: everything in F02, plus K-FRONT.
- Proves: the front line reads as the brightest non-state element, and an enemy coming out of fog is impossible to miss.

#### F04 Mid-war front

- Fixture: first tick at or after tick 300 at which the front line has at least 6 province edges and each side has at least one drone wing on the board.
- Composition and camera: as F02.
- Sim-true: ownership after conquest, front line shape, all unit types present, numerals.
- Components: F03 set plus U-DRN, DC-xx (scorch and craters in provinces that changed hands, placed from sim history), FX-SMK in provinces with a fight in the last 3 ticks.
- Proves: the front line follows province edges exactly and never invents a border; three unit types are told apart at a glance.

#### F05 Battle beat close-up

- Fixture: the first attack event after tick 300. Captured three times: beat=0 (attack declared), beat=1 (peak flash), beat=2 (settle, numerals updated).
- Composition: zoom 2.0 centered on the midpoint of the attacked edge. Attacker province left or right as the sim has it; no mirroring.
- Camera: canvas view, zoom 2.0.
- Sim-true: attacker, defender, the exact shared edge, both counts before and after.
- Components: U-xxx beat frames (beat-L or beat-R pose), K-BEAT, FX-SMK, K-PLQ, K-FRONT.
- Proves: within one 900 ms beat a player can say who attacked whom across which border and what the result was.

#### F06 Fog and last seen

- Fixture: first tick at which a province holding an enemy unit leaves the player's sight while at least one Unknown province and one in sight province touch it.
- Composition: default zoom, captured whole, then cropped by the harness to the bounding box of that province plus its neighbors, padded 40 px. Both versions are kept.
- Camera: as F02.
- Sim-true: the three fog states per province; the hollow plaque at the last known position; no numeral on it; no unit sprite there.
- Components: TX-FOG-LS, TX-FOG-UK, K-FOG, K-PLQ (hollow), S-xxx and T-xxx under fog.
- Proves: the three states are told apart in grayscale by texture and value band, never by darkness, and Last seen shows no live numbers.

#### F07 Late-game worst case

- Fixture: synthetic. Start from the F04 state and set: the most fragmented ownership pattern the script can make (alternate owners along the river column and leave any isolated province isolated), the maximum unit count the sim allows in every province that holds units, every structure type present at least twice, smoke in every province on the front, all three fog states present, and an attack beat on at least one edge (frozen at beat=1).
- Composition and camera: as F02.
- Sim-true: every element is a legal sim state, even if unlikely.
- Components: every board component.
- Proves: readability under maximum load. Every numeral readable, no sprite crosses a province edge, the front line still the brightest non-state element. The harness also records canvas draw time per frame as a number in the step report (no pass threshold set here).

#### F08 Victory

- Fixture: a saved end state where the player's nation wins (script: run until a win; if the seed gives the player a loss, play the other side).
- Composition: full 16:9 scene. Left two thirds: SC-VIC (the winner's capital miniature on the board in warm lamplight, banners raised, smoke clearing). Right third: K-MINI (the final board from sim state, ownership bands and front line only, no sprites) on a paper card, and the result in plain words: "Victory", "Provinces held: 41 of 70", "Length of war: 12 min 30 s". Buttons: "Play again", "Share".
- Camera: Blender perspective 85 mm, pitched 30 degrees down, capital at the right third line of the scene area.
- Sim-true: K-MINI and every number. The scene is shared by both nations; its banners are tinted in code to the winner's color.
- Components: SC-VIC (beauty and tint mask), K-MINI, K-TXT, K-ATM.
- Proves: the win feels earned and the card tells the truth about the war.

#### F09 Defeat

- Fixture: a saved end state where the player's nation loses.
- Composition: as F08, with SC-DEF: the player's capital miniature fallen, cold ash, a thin ember glow, banners down. Words: "Defeat", "Provinces held: 9 of 70", "Length of war: 12 min 30 s". Buttons: "Play again", "Share".
- Camera: as F08.
- Sim-true: K-MINI and every number; the fallen capital is tinted in code to the loser's color.
- Components: SC-DEF (beauty and tint mask), K-MINI, K-TXT, K-ATM.
- Proves: losing is clear, quiet, and makes the player want another game.

#### F10 Share card

- Fixture: the F08 state (and a second card from F09).
- Composition: a 1200 x 630 PNG made in code. Left 630 x 630: a crop of the end scene (SC-VIC or SC-DEF, tinted). Right 570 x 630: K-MINI on paper, and two lines in plain words: "Vessari victory in 12 min 30 s" and "41 of 70 provinces held".
- Camera: none; a fixed code layout.
- Sim-true: the map and both lines.
- Components: SC-VIC or SC-DEF crop, K-MINI, K-TXT.
- Proves: a shared image is both beautiful and honest; nothing on it was invented.

### 1.3 Frame acceptance common to all board frames (F02 to F07)

- Edge containment: no opaque sprite pixel (alpha above 0.1) lies outside its province polygon inset by 3 px.
- Band report: within each province, excluding sprite, plaque, front line, and state light pixels (taken from the layer canvases), the 5th to 95th luma percentile lies inside the band for that province's fog state.
- Nothing outside layers 11 to 13 reaches luma 225.
- Plaque battery: the proven plaque identification battery, rerun on Fxx.png and Fxx-gray.png, scores 100 percent.

---

## 2. The mood board

The mood board is the master sheet. One image, versioned, the only parent any generation may have.

### 2.1 Master sheet versions

| Version | When | Content |
|---|---|---|
| v1 | today | the adopted diorama alone (art-direction/master-diorama-board.png) |
| v2 | adopted in Step 12 (renditions made ahead, see 6.2) | panels P1 to P10 below |
| v3 | adopted at checkpoint 2 (Step 22) | P4 and P5 replaced by renders of the admitted Blender sprites; P10 regenerated from v3 |

v3 exists so the final title and end scenes (Step 24) are generated against the pieces that actually ship, not against their early targets.

### 2.2 Master sheet v2 layout

A 4 x 3 grid of 768 x 768 cells, 3072 x 2304 total; cells touch with no gutters, and the two cells P1 to P10 leave unused are filled with Paper #E6D8B5. Assembled by the builder from logged images. No text anywhere on the image; master-sheet.json names each cell, its source log ID, and its crop.

| Cell | Panel | Source | Purpose for the storyboard |
|---|---|---|---|
| P1 | the adopted diorama, scaled to fit, unedited | existing file | the anchor; every other panel is generated with it attached |
| P2 | palette strip: five flat swatches, then a 13-step luma ramp marking the five value bands | drawn in code by the builder | locks color and value; no hex text on the image |
| P3 | material swatches: paper, ink, table wood, brass, board base, painted pewter (unpainted, the neutral that will be tinted) | rendition, R1 | sets material language for TF, TX-PNL, and all models |
| P4 | unit lineup: infantry stack, drone wing, flotilla, same scale, 45 degree view, tintable panels in Vessari blue | rendition, R1 | F02 to F07 figures |
| P5 | structure lineup: city, capital, factory, fort, same rules | rendition, R1 | F02 to F07 structures |
| P6 | terrain kit: one tile per sim terrain type plus sea, river bank, coast, top-down | rendition, R1 | TX-TER, TX-SEA, TX-RIV, T-xxx |
| P7 | smoke and ember: a smoke column, scorch, a crater, ember glow | rendition, R1 | FX-SMK, DC-xx, K-BEAT warmth |
| P8 | fog papers: three adjacent squares of board, in sight, last seen (hatched, sepia, ink line work), unknown (blank paper grain) | rendition, R1 | TX-FOG-LS, TX-FOG-UK, F06 |
| P9 | the lamp at night: the table, lamp at upper left, falloff across the board edge | rendition, R1 | K-ATM, TF, F01 |
| P10 | scene keys: three small thumbnails side by side: title, victory, defeat | rendition, R1 | F01, F08, F09 |

Plaques are deliberately absent from the master sheet. They are proven code, and a generator that is shown plaques will start painting its own.

### 2.3 Standing rules for staying on master

1. Every rendition request attaches the current master sheet first, then at most one crop of the panel for that family (taken from the same master sheet). Nothing else.
2. Never attach a sibling asset: not another family's rendition, not an earlier candidate, not a Blender render that is not on the master sheet. Consistency between families comes only from the master sheet.
3. Every candidate starts in a new ChatGPT temporary chat, so no earlier image sits in the chat context. The one exception: a turnaround request is made in the same chat as its own selected hero image (same asset, same ID).
4. Every request opens with the style preamble in 3.1, verbatim.
5. A regeneration changes one thing in the brief. The brief file is versioned (R6-U-INF.md v1, v2); the change is written in its header.
6. Renditions contain no text, letters, numerals, logos, UI, plaques, or readable map state. Any of these rejects the image.
7. Every output is logged, including rejects. An unlogged asset does not exist.
8. Drift check at selection: the builder pastes the candidate, scaled to board size, onto a crop of P1; Claude Design answers "same world: yes or no". No means reject.
9. The master sheet changes only by version bump, signed by Claude Design and shown to Jash at the next checkpoint. Old versions stay in art-direction/master-sheet/vN/. Every log entry records the master version it was made against. A version bump does not force regeneration of admitted assets; it only governs new generations.
10. P1 is never edited, regenerated, or replaced.

### 2.4 Asset log entry (one JSON object per line, append-only)

```
{"id":"U-INF-R6-c2","parent":"master-sheet-v2","kind":"rendition","family":"U-INF",
 "session":"R6","date":"2026-10-24","brief":"R6-U-INF.md v1","file":"art-direction/renditions/U-INF/R6-c2.png",
 "sha256":"...","status":"selected","gates":{"R-a":"pass","R-b":"pass","R-c":"pass","R-d":"pass","R-e":"pass","R-f":"pass","R-g":"pass"},
 "note":""}
```

Status moves only forward, by appending a new line: candidate, then selected or rejected, then for Blender assets admitted or failed, then retired. A Blender asset's parent is its selected rendition ID; its grandparent is the master version. tools/asset-lint.js (built in Step 12) fails the step if any file under assets/ lacks an admitted log line with a matching sha256, or if any runtime file references art-direction/.

---

## 3. The rendition protocol (Jash's process, step 1)

### 3.1 Style preamble (pasted verbatim at the top of every request)

> Use the attached master sheet as the only style reference. A lamplit war table: handmade tabletop miniatures of painted pewter, wood, paper, and ink, under one warm lamp from the upper left. Soft contact shadows. Muted paper and ink tones. Faction paint is flat Vessari blue exactly as on the master sheet. Absolutely no text, letters, numbers, symbols, logos, labels, or user interface anywhere in the image.

### 3.2 Board piece brief pattern (U-xxx, S-xxx, T-xxx)

Request A, the hero (one per candidate, each in a new temporary chat):

> [preamble] Subject: one single [SUBJECT] as a miniature game piece. View: from 45 degrees above, facing straight on, drawn orthographic like a technical illustration, no perspective distortion. Background: plain flat medium gray, seamless, nothing else in frame. The whole piece is in frame with clear empty space on every side. Paint: [TINT SURFACES] are painted flat Vessari blue; everything else is unpainted dark pewter, wood, and ink black. Light: one warm key light from the upper left, shadow falling to the lower right. Shape: [SILHOUETTE KEY]. Bold simple shapes that still read as [NAME] when shrunk to the size of a fingernail. Square image.

Request B, the turnaround (only for the selected hero, same chat):

> Using the piece in this chat, make an orthographic turnaround of exactly the same piece: front view, left side view, back view, and top view in one row, same scale, same plain gray background, flat even light. No text, no labels, no numbers.

Attachments for both: art-direction/master-sheet.png, then the family's panel crop (P4 for units, P5 for structures, P6 for terrain pieces).

### 3.3 Per-family briefs

| ID | SUBJECT | TINT SURFACES | SILHOUETTE KEY (what must read at 56 px) | Hero candidates | Turnaround |
|---|---|---|---|---|---|
| U-INF | infantry stack: three soldiers massed shoulder to shoulder on one round base, a standard pole raised from the middle | coats and the standard cloth | a tall, narrow, tight cluster with one vertical spike (the pole) above it; taller than wide | 4 | yes |
| U-DRN | drone wing: three small flying drones in a V formation hovering above a round base on one thin stand | drone upper shells | a wide V floating clear of its base, with visible empty gap under the V; wider than tall | 4 | yes |
| U-FLT | flotilla: two low warships in line on a small plate of water | hull bands and deck flags | long, low, horizontal; one funnel or mast per hull; at least twice as wide as tall | 4 | yes |
| S-CTY | city: a tight cluster of roofs of three or four heights on a square plinth | roofs | a broad stepped skyline, blocky, no single tall point | 3 | yes |
| S-CAP | capital: a city cluster with one central domed tower and a flag on top | roofs and the flag | the tallest board sprite, a single central spire clearly above a broad base | 3 | yes |
| S-FAC | factory: a long hall with a sawtooth roof and two tall chimneys | roof panels | a sawtooth edge plus two thin vertical chimneys at one end | 3 | yes |
| S-FRT | fort: a low ring wall with angled bastions, open inside | wall top band | low, flat, wide ring with notched rim; the lowest structure | 3 | yes |
| T-xxx | one terrain feature per sim type (forest clump, hills, mountains, and so on) | none | rounded masses for forest and hills, peaked masses for mountains; no vertical straight lines, so they can never be taken for a structure or unit | 2 each | no |

For T-xxx, replace the Paint sentence with: "No faction paint; natural muted colors from the master sheet."

### 3.4 Texture brief pattern (TX-xxx, DC-xx)

> [preamble] A top-down seamless texture of [SURFACE] as it looks on the board in the master sheet. Flat even light, no cast shadows, no objects, no horizon, no edges or borders. Square image. Fill the whole frame.

| ID | SURFACE | Candidates |
|---|---|---|
| TX-TER (one per terrain type) | the painted board surface for [terrain] | 2 each |
| TX-SEA | painted sea, gentle brush ripples | 2 |
| TX-RIV | painted river water | 2 |
| TX-FOG-LS | old sepia paper with fine ink hatching | 3 |
| TX-FOG-UK | plain warm paper with fine grain, nothing drawn | 2 |
| TX-PNL | the paper and brass of the UI panels | 2 |
| DC-xx (scorch, crater, road) | a single [decal] on plain flat gray, seen straight down | 2 each |

DC-xx are not seamless; they use the board piece background and margin rules.

### 3.5 Smoke brief (FX-SMK)

> [preamble] One column of gray smoke rising from a small ember glow, as a miniature effect on the war table. Plain flat dark gray background, nothing else. The whole column in frame with space on every side. Light from the upper left. Square image.

Candidates: 3. No turnaround. This is a reference for a Blender volume, not a source image.

### 3.6 Scene briefs (SC-TTL, SC-VIC, SC-DEF, TF)

> [preamble] Photographic macro detail, physically plausible materials, shallow depth of field. [SCENE]. Wide 16:9 image.

| ID | SCENE | Candidates |
|---|---|---|
| SC-TTL | The war table at night seen from a low angle at the table edge. The diorama board from the master sheet in the middle distance, slightly out of focus. A brass lamp at upper left. The upper third is dark empty shadow. | 3 |
| SC-VIC | Close on the capital miniature from the master sheet standing on the board, banners raised and painted flat Vessari blue, smoke clearing, warm lamp light from the upper left. Empty quiet table in the right third. | 3 |
| SC-DEF | Close on the capital miniature from the master sheet fallen on the board, broken tower, cold gray ash, one thin ember glow, banners down and painted flat Vessari blue. Empty quiet table in the right third. | 3 |
| TF | Straight top-down view of the edge of the war table: dark wood, a brass corner fitting, the paper edge of the board, lamp light from upper left. The center is plain flat gray where the map will go. | 2 |

Scenes need no turnaround. The Colab operator models from the hero plus the master sheet.

### 3.7 Selection gates (a rendition becomes the remake target only if it passes all)

The builder runs R-a to R-e and R-h as scripts where marked and posts results; Claude Design rules on R-f and R-g and selects.

| Gate | Test | Applies to |
|---|---|---|
| R-a No text | Any letter, numeral, symbol, logo, label, or UI element seen by Claude Design, or detected by the builder's OCR pass, rejects. | all |
| R-b Clean framing | Single subject, fully in frame, at least 8 percent margin on each side; border strip (outer 10 percent) luma standard deviation 6 or less. | board pieces, DC, smoke |
| R-c Rig match | View is from about 45 degrees above, near orthographic (parallel edges stay parallel by eye), shadow falls lower right. | board pieces |
| R-d Silhouette at final size | Script: segment the subject from the background, fill it Ink on Paper, scale to 56 px (64 for S-CAP), and run the silhouette battery (4.6) against the current target or blockout of every other board family. 100 percent or reject. | board pieces |
| R-e Tintable surfaces | Script: pixels within 20 degrees hue of #2E6FD8 and saturation above 0.35 cover 20 to 60 percent of the subject area, in 3 or fewer connected regions, each at least 5 percent of the subject. | U-xxx, S-xxx, SC-VIC, SC-DEF |
| R-f Buildable | Every part is a primitive, a bevelled block, a lathe, or a simple sculpt; part count within the 4.3 budget; nothing melted, impossible, or ambiguous; the turnaround agrees with the hero. One turnaround retry is allowed; a second disagreement rejects the hero. | board pieces, scenes |
| R-g On master | The drift check in 2.3 rule 8 answers yes; no dominant hue outside the palette families plus neutral metal and wood. | all |
| R-h Seamless | Script: offset the texture by half its width and height; Claude Design cannot see the seam cross at 100 percent zoom; a 3 x 3 tile shows no repeating feature visible at default zoom. | TX-xxx except TX-PNL |

Choosing among passing candidates: largest silhouette distinctness (fewest near-miss judge answers in R-d), then fewest parts, then Claude Design's eye.

If no candidate passes: one more round with one brief change chosen by Claude Design. If the second round also fails, the family goes to the fallback: the Colab operator models directly from the master sheet panel (P4, P5, or P6), which is a legal parent. A family never blocks a step for more than two rounds.

### 3.8 Rendition session procedure (Jash)

1. Open the brief file the builder staged for the session (art-direction/briefs/Rn-*.md). It lists, in priority order, every request with its attachments and its exact text.
2. For each request: new temporary chat, attach the listed files in the listed order, paste the text exactly, send.
3. Download every output unmodified. Name it Rn-<ID>-c<k>.png (turnarounds Rn-<ID>-c<k>-turn.png). Drop it in Drive AshesOfEmpires/inbox/renditions/YYYY-MM-DD/.
4. If the daily cap is hit, stop and write the time in the session's brief file. The remaining requests carry to the next day in the same order.
5. Do not reword, re-roll, or add requests. If something looks wrong, note it in the brief file; Claude Design decides.

---

## 4. The Blender remake protocol (Jash's process, step 2)

### 4.1 The pinned rig (blender/rig/aoe_rig_v1.blend; CAM_TEX built in Step 12, the rest in Step 16)

| Setting | Value |
|---|---|
| Blender | 5.2.2, the exact build pinned in the notebook; the notebook refuses to run on any other version string |
| Units | metric, 1 Blender unit = 1 m |
| CAM_SPRITE | orthographic, location (0, -10, 10), rotation X 45, Y 0, Z 0 degrees; ortho scale 2.0 (S-CAP: 2.2857, keeping the same pixels per meter); shift X 0, shift Y 0.25 |
| Resulting scale | 112 render px per meter at 4x; 28 display px per meter |
| Ground contact anchor | the model origin at the center of its footprint on z = 0, at world origin; it lands on render pixel (112, 168) of 224 (S-CAP: (128, 192) of 256); stored in the atlas JSON as the anchor |
| CAM_TEX | orthographic, location (0, 0, 10), rotation 0, 0, 0; ortho scale equal to the tile size in meters; used for TX and DC bakes |
| CAM_SCENE | perspective, per scene file; inherits KEY and world |
| KEY | sun, strength 3.0, angle 2 degrees, at (-5.5, 4.5, 7.0) with a Track To constraint on an empty at the origin: light comes from screen upper left |
| World | flat gray, strength 0.3; no HDRI on board sprites |
| Color management | board sprites and textures: view transform Standard, look None, exposure 0, gamma 1. Scenes: AgX, look Medium High Contrast |
| Render | Cycles on GPU (OptiX), seed 0, filter width 1.50 px, OIDN denoise for beauty, film transparent, PNG RGBA 16 bit |
| Tintable material | shader TINT_paint: base color sRGB (128, 128, 128), no saturation, roughness 0.6, metallic 0. Every tintable surface uses it and only it; its name prefix TINT_ is how the mask pass finds it |

### 4.2 Golden frame rule

- At the start of every Colab session, before any other render: open blender/golden/golden_v1.blend (a gray test unit, the tint swatch card, and an Ink cube, through CAM_SPRITE and KEY), render it, and diff against blender/golden/golden_v1.png.
- Pass: mean absolute difference 1.0/255 or less, and 99.5 percent of pixels within 8/255 per channel. Fail: stop the session; no output of that session may be logged. Post the diff image to Drive colab/out/ and write FAIL in the session log.
- The golden is established once, in session C1 (Step 12), and must pass on both an A100 and an L4 before it is adopted. It is never re-baselined silently; a new golden is golden_v2, signed by Claude Design, with the reason in the log.

### 4.3 Modeling targets per family

All board sprites fit the projected box: footprint 1.6 x 1.6 m or less and height 1.0 m or less (S-CAP 1.8 x 1.8 m footprint, 1.3 m height). Detail floor: no geometry feature smaller than 0.15 m (4 display px). Features below the floor are deleted, not textured in; at 56 px they become noise.

| ID | Silhouette first (block this before anything else) | Parts budget | Beat frames |
|---|---|---|---|
| U-INF | three figure blocks on a 1.2 m round base, pole 0.3 m above the figures; total height 1.0 m | 12 | rest, beat-L, beat-R |
| U-DRN | V of three drones at 0.55 to 0.8 m height, empty gap above base of at least 0.3 m, base 1.0 m | 10 | rest, beat-L, beat-R |
| U-FLT | two hulls 1.5 m long on a 1.6 x 0.9 m water plate, height 0.6 m | 10 | rest, beat-L, beat-R |
| S-CTY | 5 to 7 blocks of three heights up to 0.8 m on a 1.5 m square plinth | 14 | none |
| S-CAP | S-CTY language plus a central tower to 1.3 m with flag | 16 | none |
| S-FAC | hall 1.4 x 0.7 m, sawtooth roof, two chimneys to 1.0 m | 10 | none |
| S-FRT | ring wall 1.5 m across, 0.35 m high, four bastions | 8 | none |
| T-xxx | masses within 1.6 x 1.6 m, height 0.3 to 0.9 m by type, no vertical straight edges | 8 | none |
| FX-SMK | volume column, 1.0 m footprint, 1.6 m tall, rendered in its own 512 px box at 128 display px | n/a | 8 frame loop |
| SC-xxx, TF | match the selected rendition's composition; reuse the board sprite models at scene scale, with a scene detail pass added (see Section 5) | no limit | none |

Beat frames: beat-L and beat-R are separate renders of a facing pose, never mirrored images, so the key light stays upper left.

The model matches the rendition in silhouette, proportions, and where the tintable surfaces are. It does not chase the rendition's surface detail below the floor.

### 4.4 The three passes (blender/scripts/render_passes.py, one call per model and frame)

| Pass | How | Output |
|---|---|---|
| Beauty | Cycles, 256 samples (scenes 1024), OIDN, film transparent, all objects visible, shadow catcher off | ID_frame_beauty.png |
| Tint mask | same camera, filter, and resolution; material override: TINT_ materials become white emission 1.0, every other material black emission; 16 samples, no denoise; view transform Standard | ID_frame_mask.png (white is tintable) |
| Shadow | a 4 x 4 m shadow catcher plane at z = 0; the model set invisible to camera but still casting shadows | ID_frame_shadow.png (alpha only, drawn in Ink in code) |

The Colab notebook writes the three PNGs plus a JSON (ID, frame, anchor, render settings, rig hash, golden result, Blender version) to Drive colab/out/<session>/. The builder downsamples (Lanczos 3, premultiplied alpha) to 1x and 2x, packs the atlases assets/sprites/board@1x.png, board@2x.png, board-mask@1x.png, board-mask@2x.png, board-shadow@1x.png, board-shadow@2x.png and board.json, then logs each frame.

Tint in code (never in Blender): at load, each sprite is pre-tinted once per nation into an offscreen canvas.
For each channel, b = beauty, t = nation color, both 0 to 1:
overlay = 2bt when b < 0.5, else 1 - 2(1 - b)(1 - t);
out = b + (overlay - b) x mask x k, with k = 1.0 until Step 22 sets it.
Neutral gray 0.5 under this formula returns exactly the nation color, which is why TINT_paint is mid-gray.

### 4.5 Admission gates (a component ships only after all pass; failures are logged)

| Gate | Test | On fail |
|---|---|---|
| A1 Golden | the session's golden frame passed | session void |
| A2 Silhouette | the silhouette battery (4.6) at final display size scores 100 percent for every board family including this one | change the model; never the palette, never the tint |
| A3 Tint round trip | the swatch card rendered in this session: its flat emission patch arrives in the beauty PNG at (128, 128, 128) plus or minus 2; after code tint the patch is within Delta E 2000 of 2.0 or less of #2E6FD8 and of #C8372D in a canvas capture; lit patches keep their luma order after tint; mask and beauty alpha edges agree within 1 render px | fix material or color management, re-render |
| A4 Size budget | each sprite frame at 2x 16 KB or less; all board atlases together (1x and 2x, all three passes) 1.5 MB or less; scenes 1920 x 1080 WebP quality 85, 500 KB or less beauty and 150 KB or less mask; FX-SMK atlas 400 KB or less | simplify the model or reduce frames |
| A5 Edge containment | in F02, F04, and F07 at default zoom, every placement of the sprite keeps all pixels with alpha above 0.1 inside its province polygon inset by 3 px | shrink the model's footprint (global per family); slots in js/map-canvas.js stay as they are |
| A6 Value | after tint, the sprite's median luma lies in 60 to 150, its maximum 210 or less, no pixel 225 or above | adjust materials; never the band |
| A7 Lineage | log shows parent selected rendition (or master panel under the 3.7 fallback), master version, session, sha256 | not admitted until logged |

### 4.6 Silhouette battery

- Tiles: every board family (U-INF, U-DRN, U-FLT, S-CTY, S-CAP, S-FAC, S-FRT, and one tile per T-xxx under the single answer "terrain"), each rendered as alpha above 0.5 filled Ink on Paper at final display size, 2 copies each, shuffled.
- Legend: the same silhouettes at 4x with plain names, shown first.
- Judges: at least 3 independent fresh-eyes judge sessions, as run for the plaque battery. Each names every tile.
- Pass: 100 percent correct from every judge. Any confusion between two families fails both until a model changes.

---

## 5. Hyperrealism, honestly bounded

Jash asked for a hyperrealistic finish. It is real and worth paying for in the right places. On the live board it mostly cannot be seen: a 56 px sprite is about 3,000 pixels, and the eye reads it as a shape.

### 5.1 Where hyperreal pays (full budget)

| Place | Frames | What "hyperreal" means there |
|---|---|---|
| Title scene | F01 | 1024 samples, depth of field, AgX, real wood grain, brass wear, paper fiber, lamp falloff |
| Victory and defeat scenes | F08, F09 | the same; ash and smoke volumes; ember glow |
| Share card scene crop | F10 | inherits F08 or F09 |
| Table frame | F02 to F07 border | baked once at full detail; it sits outside the map and carries no state |
| Marketing and store images | outside the game | built from scene renders plus K-MINI, never from a rendition |

### 5.2 Where it yields

| Place | What wins instead |
|---|---|
| Board sprites (56 px) | silhouette, then value band, then tint area; surface detail below 0.15 m is deleted |
| Ground textures | the value band for the province's fog state; texture contrast is clamped by the band, not by taste |
| Atmosphere | stays below 225; never darkens fog; vignette applies to TF and may lower board luma by at most 8 levels at the board corners, and never below the floor of the province's band |
| Anything near plaques, numerals, front line, beats | the information layer. Nothing is drawn on top of it, and nothing near it may reach the state band |

### 5.3 The rule a builder applies when a rendition detail and a gate fight

> The gate wins, always. Remove or simplify the detail in the model until the gate passes. Never change the palette, a value band, the tint formula, a plaque, or any information layer to keep a detail. If the simplified model no longer looks like the rendition, the model is right and the rendition was only a target; log the difference in the note field and move on.

Priority order when two goods conflict: sim truth, then the information layers, then silhouette, then value band, then tint area, then material, then detail.

---

## 6. Step mapping

### 6.1 Per step

R = a ChatGPT rendition session (Jash's browser, daily cap). C = a Colab Blender session (golden frame first). "None" means the step needs neither.

| Step | Delivers (frames; components) | Screenshot acceptance (one sentence) | R session | C session |
|---|---|---|---|---|
| 7 Ownership bands and front line | F02, F03, F04 placeholders; storyboard harness, fixtures, contact sheet; K-BAND, K-FRONT on the live canvas | In F03 and F04, a pixel probe along every geometry edge finds front line on exactly the edges whose two provinces have different owners and on no other edge. | None. Book R1 today (runs alongside) | None |
| 8 Fog three states | F06, fog in F02 to F04; K-FOG with flat code fills | In F06-gray, each province's luma band report matches its fog state, and the Last seen province shows a hollow plaque and no numeral. | None (R1 continues if the cap carried it) | None |
| 9 Plaques on the live board | F02 to F07; K-PLQ wired | The plaque battery rerun on F02 to F07, color and gray, scores 100 percent. | None. Book R2 | None |
| 10 Attack beats (checkpoint 1) | F05; K-BEAT | In F05 beat=1 the state light lies only on the attacked edge, and beat=2 shows both updated counts; Jash reviews contact sheet step-10. | None. Book R6 | None |
| 11 Atmosphere and palette harness | all board frames; K-ATM; band report tool | The harness band report passes for every province in F02 to F07, and no atmosphere pixel reaches 225. | None. Book R7 | None |
| 12 Master sheet v2 and TX01 bake-off | mood board v2; asset-lint; TX01 candidates in F02 | F02 with each TX01 candidate passes the band report, and the bake-off winner is logged by the rule in 6.3. | R1 consumed, R2 consumed | C1: CAM_TEX rig, golden_v1 established on A100 and L4, TX01 Blender candidate |
| 13 Terrain and sea textures | F02, F04; TX-TER, TX-SEA, TX-RIV | F02 and F04 pass the band report with real textures, and the 3 x 3 tile seam check passes. | R3 (texture renditions; if the Blender route won TX01, R3 is 1 reference request per type instead of 2 candidates) | C2 only if the Blender route won TX01 |
| 14 Fog and panel textures, decals | F06, F04; TX-FOG-LS, TX-FOG-UK, TX-PNL, DC-xx | F06-gray tells the three states apart by texture with every band report passing, and decals stay inside their polygons. | R4 | C3 (DC-xx bakes through CAM_TEX) |
| 15 UI frames and interim title | F01 interim; TF interim (code frame plus TX-PNL); K-TXT | F01 shows the selected SC-TTL rendition with the code wordmark and two buttons, and asset-lint passes. | R5 (SC-TTL and TF renditions) | None |
| 16 Blender rig | rig, golden, swatch card, silhouette battery tool | The golden passes on A100 and L4, and a canvas capture of the tinted swatch card lands within Delta E 2.0 of both nation colors. | None. Book R8 | C4 |
| 17 Blockouts | F02, F04, F07 with gray blockouts of every board family; S-xxx finals (see 7.7) | The silhouette battery on blockouts scores 100 percent, and F07 passes edge containment. | R6, R7 consumed | C5 |
| 18 Infantry | U-INF final, rest and beats | F02, F04, F07 with U-INF pass gates A1 to A7. | None | C6 |
| 19 Drones | U-DRN final | F04 and F07 with U-DRN pass gates A1 to A7. | None | C7 |
| 20 Flotilla | U-FLT final | F02 and F07 with U-FLT pass gates A1 to A7. | None | C8 |
| 21 Smoke and sprite beats | F05 final, FX-SMK in F04 and F07 | F05 beat=0, 1, 2 show the beat pose, smoke under the plaques, and every numeral readable at 1x. | R8 (FX-SMK part) consumed | C9 |
| 22 Team color tuning (checkpoint 2) | all frames; k per family set; master v3 adopted | With k set per family (allowed range 0.6 to 1.0, palette untouched), plaque and silhouette batteries both pass on F02 to F07 in gray, and Jash reviews contact sheet step-22. | None. Book R9 against master v3 | None (unless a gate fails; then the failing family's session repeats) |
| 23 Conditional richness | T-xxx finals, decal density, in F02, F04, F07 | F07 with richness on passes every gate in 1.3 and 4.5; any richness item that fails is switched off and logged, not tuned. | R8 (T-xxx part) consumed | C10 |
| 24 Final title and end frames | F01, F08, F09, F10 final; SC-TTL, SC-VIC, SC-DEF, TF final | F08 and F09 show tinted scenes for both nations, K-MINI matches the fixture's final ownership exactly, and F10 renders at 1200 x 630. | R9 consumed | C11 |
| 25 Release candidate (checkpoint 3) | every frame, every asset | All ten frames pass every gate, asset-lint passes, and Jash reviews contact sheet step-25. | None | C12 only if any asset was re-rendered (golden plus regression) |

### 6.2 Booking the scarce resources

The build loop never waits on a session inside a run. A step whose scarce inputs are not logged as selected is not started; the run reports "waiting on Rn" or "waiting on Cn" and stops. To keep that from happening, rendition sessions run ahead of the steps that consume them, starting today, while Steps 7 to 11 need none.

Rendition queue, in this order (request counts include turnarounds and are planning estimates):

| Session | Content | Requests | Needed by |
|---|---|---|---|
| R1 | master sheet panels P3 to P10 (2 candidates each) | 16 | Step 12 |
| R2 | TX01 candidates (the terrain type covering the most provinces) | 4 | Step 12 |
| R6 | U-INF, U-DRN, U-FLT heroes and turnarounds | 15 | Step 17 |
| R7 | S-CTY, S-CAP, S-FAC, S-FRT heroes and turnarounds | 16 | Step 17 |
| R3 | remaining TX-TER, TX-SEA, TX-RIV | about 12 | Step 13 |
| R4 | TX-FOG-LS, TX-FOG-UK, TX-PNL, DC-xx | about 13 | Step 14 |
| R5 | SC-TTL, TF | 5 | Step 15 |
| R8 | FX-SMK, T-xxx | about 11 | Steps 21, 23 |
| R9 | SC-TTL, SC-VIC, SC-DEF against master v3 | 9 | Step 24 |

R6 and R7 sit ahead of R3 to R5 on purpose. Unit and structure targets feed the longest chain (rendition, then blockout, then final), and they are the most likely to need a second round. R3 to R5 are small and can slip a day without harm. If a day's cap is hit mid-session, the next day resumes at the next unfinished request in this table.

Colab sessions C1 to C12 are not daily-capped. Each is booked when its step starts and always begins with the golden frame.

### 6.3 TX01 bake-off rule (so Step 12 needs no new decision)

Candidates: A, the best ChatGPT texture made seamless by the builder; B, a Blender material remade from that same rendition and baked through CAM_TEX at 1024 px. Score each 0 or 1 on: R-h seamless; band report in F02 for all three fog states; F02-gray plaque battery 100 percent; size 250 KB or less as WebP. The higher total wins. A tie goes to B, because a baked material can be re-rendered at any size and reproduced from the rig, and a generated image cannot. The winner sets the route for all of Step 13.

---

## 7. Conflicts

### 7.1 "Copy the rendition" against "a generated rendition never becomes the map"

Pressure: a strong ChatGPT board image is tempting to use as the map background.
Resolution: renditions of the board are mood board only (P1, P8, P9). No rendition is ever drawn under, over, or as the map. asset-lint fails any runtime reference to art-direction/. A rendition may reach the runtime in exactly one place, outside the map: the interim title background (Step 15). It is copied to assets/scenes/ with its own admitted log line and retired when the Blender title replaces it in Step 24.

### 7.2 Renditions in blue against "faction color never bakes into a render"

Pressure: the renditions show Vessari blue paint, and scenes look better with color baked in.
Resolution: the blue in a rendition is a marker telling the Colab operator which surfaces are tintable. The Blender model paints those surfaces with TINT_paint mid-gray, and color arrives only in code from the mask pass. This includes SC-VIC and SC-DEF: one render, two nations, tinted in code.

### 7.3 Rendition then Blender against "every generation derives from the master sheet, never from a sibling"

Pressure: the Blender model derives from a rendition, not from the master directly, and a turnaround is made from a hero image.
Resolution: the lineage is a chain, not a sibling link: master version, then rendition (parent: master), then Blender asset (parent: that rendition). A turnaround is the same asset as its hero and shares its ID. What stays forbidden: attaching any asset of another family, or an earlier candidate, to a new generation. Master v3 is how admitted Blender pieces legally become a parent for the end scenes.

### 7.4 Hyperreal finish against the value bands and the 225 ceiling

Pressure: photoreal renders produce specular highlights above 225 and deep shadows.
Resolution: gate A6 holds board sprites to median 60 to 150 and maximum 210; materials are adjusted, never the band. Interpretation, stated plainly: the bands govern every pixel of the board composite and the K-MINI inset; they do not govern the scene area of F01, F08, F09, F10, which shows no board state. If Jash or RESEARCH.md reads the bands as covering scenes too, scenes get the same clamp and nothing else in this document changes.

### 7.5 Lamplit mood against "fog is texture, never darkness"

Pressure: a lamp at upper left naturally leaves the far board corner dark, which would put Unknown provinces below 185.
Resolution: lamp falloff lives on TF. On the board, the vignette is capped at 8 levels and never goes below the band floor of the province's fog state (5.2). The band report checks it every step.

### 7.6 Daily cap against "one verified step per run"

Pressure: a free-plan cap can stall a step for a day.
Resolution: the booking queue in 6.2 runs renditions ahead, starting today. A step without its logged inputs is not started. The two-round limit plus the master panel fallback in 3.7 means no family blocks for more than two rounds.

### 7.7 Gap in the adopted order: structures and terrain pieces have no named Blender batch

Pressure: Steps 16 to 20 name rig, blockouts, infantry, drones, flotilla. Capital, city, factory, fort, and terrain pieces have no slot, yet F02 needs structures.
Resolution, inside the adopted order: Step 17 delivers blockouts of every board family and the finals of the four structures. They are static, need no beat frames, and share one modeling language, so they fit one session. T-xxx finals ride in Step 23 as richness, because the board reads with ground textures alone. Until Step 17, structures stay as the code markers the canvas already uses.

### 7.8 Proposal P1 (needs Jash's ruling): add a Figures band

Marked proposal. Not in force.
The binding bands name Ink, Terrain in sight, Last seen, Unknown, and State lights, but not the units and structures standing on the terrain. This document's gate A6 (median 60 to 150, maximum 210) is a working rule to fill that silence.
Proposal: add a sixth band, Figures 50 to 210, measured on sprite pixels after tint, to RESEARCH.md's band table.
Cost: one line in RESEARCH.md; one extra column in the band report; a rerun of the Step 11 harness on all board frames (one build loop run). No asset is affected unless it already fails A6.
Until Jash rules: A6 is enforced as written above, because it never contradicts an existing band, and the band report prints Figures numbers for information only.

No other binding ruling is under enough pressure to need a change. Jash's process changes how and in what order components are made; every information layer, band, tint rule, and gate above stands as ruled.
