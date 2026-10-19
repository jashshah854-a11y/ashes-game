> Route note (added by Vector): Produced 2026-10-19 via the local Claude Code CLI (claude --model opus, Jash's Max login) after the anthropic.py route's repeated 1 byte failures this morning. Commissioned on Jash's 2026-10-19 direction ("Proper map with proper type topography with latitude/longitude hills rivers, oceans, continents"), recorded as DECISIONS item 31. This document governs the map treatment for Cycle 23 and amends the step sequence of DECISIONS item 28 where section 8 says so.

I couldn't save the file: writing `/tmp/MAP_TREATMENT.md` needs a permission this session can't grant. The full document is below. Approve the write or tell me the repo path and I'll save it there.

The decisions that most affect the build, and the ones that need a ruling from Jash:

- **Edge provinces that aren't coastal.** In the current build the north and south rows are coastal, but most west and east edge provinces are not. Drawing sea against those provinces would make them look coastal when they aren't. So the coast runs around a strip of land past the edge of the war, marked with a dash dot line. The whole continent still sits in the sea.
- **The river and the front.** The river rises in central hills and flows north and south to the sea. This comes only from the sim's river edges plus a distance rule. Rivers are always at least 2.2 times as wide as the front line, so the starting front runs down the middle of the water instead of hiding it.
- **The ownership bands stay.** On a terrain map they work as the coloured border ribbons of an old political map, so every measurement is unchanged. They now run along the coast and the front gets a thin paper edge. A stronger province tint is offered as proposal P-MT1 for Jash to rule on; it is not in force.
- **Terrain pieces are retired.** The raised hill and forest pieces assumed terrain types the sim doesn't have, and at 56 px they would look like game pieces.
- **The test rule needs one exception.** Step 14 must replace two of Step 8's existing tests (the mist and puff counts, and the gray fill colour). That breaks the "append only" rule for tests, so it is listed as conflict C6.
- **Six new map steps.** They become Steps 9 to 14, and every later step moves back by six.

The document has no em or en dashes.

---

# MAP_TREATMENT.md

Ashes of Empires: the map as a proper map

Status: adopted for execution, 2026-10-19
Authority: Claude Design (design authority; author of VISION_BOARD.md, STRATEGY.md, VISUAL_STRATEGY.md)
Serves: DECISIONS item 31 (Jash's direction: "Proper map with proper type topography with latitude/longitude hills rivers, oceans, continents")
Supersedes: every map treatment in VISION_BOARD.md, STRATEGY.md, and VISUAL_STRATEGY.md that draws the board as a lattice of tinted tiles. Where this document and an earlier document disagree about how the map looks, this document wins. Where this document and a gate disagree, the gate wins (VISUAL_STRATEGY 5.3), and Section 9 records every such case.

---

## 0. The idea in one paragraph

The board stops being a diagram of 70 cells. It becomes a printed and hand coloured chart of one continent at war, lying on the lamplit table. The chart shows:
- a real coast with shaded sea around it;
- rivers that rise in the hills and run to the sea;
- soft hill shading lit from the upper left, with faint contour lines;
- dashed province borders;
- a latitude and longitude grid with degree labels in the margin.

Ownership reads the way it did on 19th century political maps: coloured ribbons along the borders, with the black front line where the two colours meet. The ribbons are the D1 band, with its measures unchanged. Fog turns the map back into an unfinished chart: blank paper land and paper sea where the player has never looked, and a faded sepia copy where they looked before. Everything that matters to play still comes from the sim and nothing else. Everything this document adds that is not in the sim (the shape of the coast, the hills, the grid) is scenery, and the game says so in plain words.

### 0.1 What the current build gets wrong (retired by this document)

| Current look | Why it fails | Replaced by |
|---|---|---|
| DOM tiles with solid blue, red, and gray backgrounds | Reads as a spreadsheet; hides all ground | Transparent tiles; ground drawn on canvas (Section 5) |
| Parchment edge lines on every polygon edge, all equal | Every edge looks the same; no hierarchy | Coast, river, border, and graticule each get their own line (Sections 1 to 5) |
| Lattice boundary as a straight rectangle edge | No coast, no sea | Generated coastline and sea margin (Section 1) |
| River drawn as an edge style | Not a river | Tapered water course with banks and mouth (Section 2) |
| Fog as gray fill with mist wisps and cloud puffs | Game effect, not a chart | Uncharted paper and faded chart (Section 6) |

### 0.2 Fixed facts this document relies on

- **Cell space.** The geometry module (js/map-geometry.js) works in cell units. The lattice spans x 0 to 10, y 0 to 7. A cell is about 160 device px at DPR 1, zoom 1.0. Every size below is given in cell units, with its pixel equivalent at 160 px per cell. Code computes sizes as `k * scaleX`, where scaleX is device px per cell. This is the same convention as drawStateOps.
- **Palette** (fixed, from VISUAL_STRATEGY 0.3): Paper #E6D8B5, Ink #2B2620, Vessari blue #2E6FD8, Khessite red #C8372D, Ember #F29A2E. Band ink for state strokes stays '#1e1a12', as built in Step 7a.
- **Value bands** (Rec. 709 luma, 0 to 255): Ink 0 to 40; Terrain in sight 60 to 150; Last seen 120 to 175; Unknown 185 to 225; State lights 225 to 255.
- **Frame path lint** (tests/presentation.test.js): shadowBlur, getImageData, fillText, ctx.filter, createLinearGradient, and createRadialGradient are banned in frame path modules. This document uses none of them anywhere in game code. Text on the map is DOM text. Soft shading comes from a baked raster (Section 3), never from gradients.
- **Determinism idiom:** FNV-1a hash plus mulberry32, as in js/map-geometry.js. No Math.random anywhere.
- **Canvas stack after Step 8:** #map-base (z 0), #map-fog (z 1), #map tiles (z 2), #map-state (z 3). This document adds #map-labels (DOM, z 4, pointer-events none).

Every colour below was checked for luma by hand with the Rec. 709 weights. The builder recomputes each one in a test (Section 8, every step).

| Name | Hex | Luma | Used for |
|---|---|---|---|
| SEA_DEEP | #3E5A66 | 85.0 | open sea |
| SEA_MID | #4C6973 | 99.6 | outer shelf |
| SEA_SHELF | #5B7880 | 114.4 | inner shelf |
| SEA_SHORE | #6A878C | 129.2 | shore water, estuary fans |
| RIVER_WATER | #6F8C8F | 134.0 | river fill |
| RIVER_BANK | #4A4335 | 67.4 | river banks |
| RIVER_GLINT | #8FA6A3 | 160.9 | river centre glint, drawn at alpha 0.35 only (result about 143) |
| LAND_LOW | #7E8158 | 125.5 | lowland tint (olive) |
| LAND_HIGH | #8A7A58 | 123.0 | upland tint (ochre brown) |
| BEACH | #B9AA80 | 170.1 | shore strip on land, alpha 0.35 only (result about 141) |
| CONTOUR | #5A4A36 | 75.9 | contour lines, alpha 0.22 |
| SHADE_DARK | #2B2620 (Ink) | 38.6 | hillshade shadow, alpha at most 0.38 (darkest result about 92) |
| SHADE_LIGHT | #F3EAD2 | 234.0 | hillshade light, alpha at most 0.20 (lightest result about 147) |
| CHART_UNKNOWN | #DCCDA8 | 205.5 | Unknown land and uncharted sea (the Step 8 value, kept) |
| CHART_FADED | #C2AE86 | 175.3 | Last seen wash, alpha 0.65 (results 144 to 166 over any in sight ground) |
| FRAME_PAPER | #E6D8B5 (Paper) | 216.5 | chart border strip |

---

## 1. Landmass and ocean

### 1.1 The chart frame

The canvas no longer ends at the lattice. It draws a whole chart sheet:

| Constant | Value (cell units) | Meaning |
|---|---|---|
| SEA_MARGIN | 1.0 | distance from the lattice edge to the neatline on all four sides |
| BORDER_SIDE | 0.30 | width of the degree border outside the neatline, top, left, right |
| BORDER_FOOT | 0.55 | width of the degree border at the bottom (holds scale bar and north arrow) |
| Chart extent | x from -1.30 to 11.30, y from -1.30 to 8.55 | 12.6 by 9.85 cells |
| Neatline | x from -1.0 to 11.0, y from -1.0 to 8.0 | the inner frame line; sea and land never cross it |

**Layout rule:**
- At zoom 1.0 the cell keeps exactly its current CSS size. Every pixel gate calibrated at about 160 px per cell therefore stays valid: the plaque battery, band widths, front width, and sprite boxes.
- #map-board grows by the margins.
- The #map tile grid is inset by 1.30 cells left and 1.30 cells top, through one CSS variable `--chart-inset` set from js/main.js.
- If the grown board overflows the map viewport, the viewport scrolls and opens centred on the lattice centre (cell 5, 3.5).
- Zoom buttons and the settle re-render are unchanged.

### 1.2 What lies beyond each edge of the lattice (from sim data only)

A boundary segment is any segment of a province polygon that lies on the lattice boundary: both points at x 0, or x 10, or y 0, or y 7. This is the same test Step 7a uses. Each boundary segment is classed by its province's coastal flag:

- **Sea segment:** the province is coastal. Beyond the segment lies the province's own shore (the apron, still part of the province), and then sea.
- **Inland segment:** the province is not coastal. Beyond the segment lies land outside the war, then a coast, then sea. This keeps a non coastal edge province truthful: it does not touch the sea, yet the continent still ends in a real coast.

The current build shows the north and south rows mostly coastal and most west and east edge provinces not coastal. The rules below cover any mix.

**Test M-COAST (Step 9):**
- A province with a sea segment has coastal true.
- A province with coastal true has at least one sea segment.
- If any coastal province has no boundary segment (an inland coastal province), the test fails and prints the province ids. The step then stops and reports to Claude Design.
- No inlet or lake is ever invented to make the test pass.

### 1.3 The coastline (one closed curve around the continent)

The coastline is built once per geometry, from geom only, in a new pure module: js/map-chart.js.

1. **Perimeter walk.**
   - Walk the lattice boundary clockwise from (0, 0). Parameter t is arc length along the rectangle, from 0 to 34.
   - Each boundary segment occupies an interval of t. It carries its key `<provinceId>:<segmentIndex>` and its class (sea or inland).
   - At each of the four rectangle corners, insert a corner arc: a quarter circle around the corner vertex, swept by the outward normal and sampled at 8 points. Tag the arc with the corner province's key.
2. **Offset.** Each sample point is the rectangle point plus offset o(t) times the outward normal. On corner arcs, use the swept normal.
   - Sea segments: o(t) = clamp(0.30 + 0.22 * N(t), 0.08, 0.60).
   - Inland segments: o(t) = clamp(0.62 + 0.12 * N(t), 0.50, 0.80).
   - Where a sea segment meets an inland segment, o ramps linearly between the two formulas over the 0.50 cell of the sea segment nearest the shared vertex. The coast turns out into a headland there.
   - N(t) is 1D fractal noise in -1 to 1:
     - 4 octaves, base wavelength 2.2 cells, octave gain 0.5, wavelength halving per octave.
     - Value noise with smoothstep interpolation over lattice values from mulberry32, seeded with FNV-1a of (chartSeed + ":coast:" + octave).
     - N wraps at t = 34, so the curve closes without a seam. The lattice value index is taken modulo the octave's period count.
3. **Sampling and smoothing.** Sample every 0.05 cell of t. Apply one Chaikin pass, keeping corner tags by majority. The result is about 700 to 800 points, each tagged with its key.
4. **Bounds.** Every coastline point lies at least 0.06 cell outside the lattice and at least 0.20 cell inside the neatline. Test M-BOUNDS asserts this.

**chartSeed** is FNV-1a over every province polygon coordinate of geom, toFixed(4), in province id order. The chart is therefore exactly as stable as the polygons. The same geometry always yields the same coast, hills, and rivers, across sessions and saves. This needs no access to the sim seed and no edit to js/map-geometry.js.

### 1.4 Aprons, sectors, and hit polygons

From each boundary vertex (a point where two boundary segments meet), cast a divider ray along the outward normal: from the vertex to the coastline, then on to the neatline. The rays split everything outside the lattice into one sector per boundary segment. The corner quadrant belongs to the corner province. Each sector has up to three parts:

- **Apron** (sea segments only): the part between the lattice edge and the coastline. It is land, and it belongs to the province.
- **Beyond land** (inland segments only): the part between the lattice edge and the coastline. It is land outside the war and belongs to no province.
- **Sea sector:** the part between the coastline and the neatline. It belongs to the province for fog only (Section 6) and never affects play.

**Hit polygon for province p:** p's polygon with every sea segment replaced by this path:
1. the segment start;
2. its divider ray out to the coastline;
3. the coastline points tagged with that segment or its corner arc;
4. the next divider ray back to the segment end.

For provinces with no sea segment, the hit polygon is the original polygon.

Properties that tests pin (Step 9):

- **M-CONTAIN:** every original polygon lies inside its hit polygon. No province loses ground.
- **M-ADJ:** two hit polygons share a boundary longer than 0.01 cell only if the sim says the provinces are adjacent. Every sim adjacency still shares a boundary. This is the existing shared edge test, rerun on hit polygons. It holds by construction, because aprons meet only along divider rays that continue sim edges between neighbours.
- **M-HIT:** 10,000 seeded points inside the lattice resolve to the same province under hit polygons as under original polygons. Points in an apron resolve to its province. Points in sea and in beyond land resolve to nothing.

**Chart edge paths:** a sim edge path that ends at a boundary vertex with a sea segment on at least one side is extended by the divider ray to the coastline. Front lines, bands, borders, and rivers all use the extended path. A front that reaches the sea therefore runs to the water's edge instead of stopping at the old lattice edge.

### 1.5 Hit testing in play

- Clicks on #map-board resolve by point in hit polygon, using `AshesChart.hitTest(cellX, cellY)`, a new export of js/map-chart.js.
- The board converts the event point to cell space through the same transform the renderer uses, zoom included.
- A hit selects the province exactly as a tile click does today.
- A miss (sea, beyond land, border) clears nothing and does nothing.
- DOM tiles keep their roles as keyboard focus and screen reader targets, with tabindex and labels unchanged, and get `pointer-events: none`.
- Browser checks that click tile centres still work, because a cell centre always lies inside its polygon.

### 1.6 Sea rendering (base canvas, in sight look)

Drawn in this order, all clipped to the neatline rectangle:

1. **Base fill.** Fill the neatline rectangle with SEA_DEEP.
2. **Shelf and water lines.** Build the closed coastline path. Stroke it with lineJoin round in this exact order. Each width is the full lineWidth, k * scaleX.

| Order | Kind | Width (cells) | Style |
|---|---|---|---|
| 1 | band | 0.72 | SEA_MID |
| 2 | water line | 0.52 + 1 px | Ink alpha 0.16, then restore inner 0.52 - 1 px with SEA_MID |
| 3 | band | 0.44 | SEA_SHELF |
| 4 | water line | 0.30 + 1 px | Ink alpha 0.16, then restore 0.30 - 1 px with SEA_SHELF |
| 5 | band | 0.22 | SEA_SHORE |
| 6 | water line | 0.14 + 1 px | Ink alpha 0.16, then restore 0.14 - 1 px with SEA_SHORE |

   The land drawn next covers the inner half of every stroke. What remains is the classic chart treatment: a shelf of three lighter steps hugging the coast, with three thin engraved water lines parallel to it. At a glance it reads as sea.
3. **Wave marks.**
   - Points come from a jittered grid of 0.40 cell spacing over the sea, with jitter up to 0.12, seeded with chartSeed + ":wave".
   - Keep only points more than 0.45 cell from the coastline, using the distance field in 3.2.
   - At each kept point, stroke a small two hump wave: a quadratic curve 0.10 cell long, amplitude 0.012 cell, Ink alpha 0.10, lineWidth 1 device px.
   - This gives about 60 marks on the whole chart.
4. **Estuary fans** (Section 2.5).

Then the land is drawn (Section 3), then:

5. **Shore strip on land:** stroke the coastline path with width 0.10 cell in BEACH at alpha 0.35, clipped to the land path.
6. **Coastline:** stroke the coastline path in Ink, width 0.010 cell (1.6 px), alpha 0.85, lineJoin round. This is the strongest line in the base layer. Where the coastline runs in front of beyond land it is drawn the same way; it is all one coast.

### 1.7 Corners and the edge of the war

- **Corners.** The corner arcs from 1.3 give the continent rounded shoulders at every corner.
  - If both sides of a corner province are sea segments, its apron wraps the corner as one piece.
  - If one side is inland, the ramp from 1.3 turns the corner into a headland.
- **Edge of the war.** Every inland segment of the lattice boundary is drawn in the base layer as a dash dot line:
  - Ink alpha 0.45, width 0.008 cell.
  - Pattern in cells: dash 0.06, gap 0.025, dot 0.008, gap 0.025.
  - Beyond land gets the same terrain and relief as everything else, so the continent is continuous.
  - Beyond land gets no political wash, no band, and no name, so nobody can take it for a province.

---

## 2. Rivers

### 2.1 Source of truth

The river network is exactly geom.riverSegments (the sim's river edges), using each edge's 3 point path, plus the mouth extensions in 2.5. Nothing else is drawn as water on land.

**Test R-TRUTH (Step 10):**
- Every drawn river sample lies within 0.001 cell of a sim river edge path or of a mouth divider ray.
- Every sim river edge is drawn.

### 2.2 The river graph

- **Nodes** are path endpoints (lattice corners), merged when within 1e-6 cell.
- **Edges** are river segments. An edge's length is its path's polyline length.
- **Rivers** are connected components.
- **Mouth nodes** are nodes on the lattice boundary whose two adjacent boundary segments include at least one sea segment.

Flow uses one rule for every case:

1. D(node) is the graph distance to the nearest mouth (multi source Dijkstra over the component). If the component has no mouth, use as a pseudo mouth its degree 1 node closest to the coastline (ties: lower y, then lower x). A pseudo mouth gets no estuary.
2. Each edge flows from its higher D end to its lower D end. If both ends have equal D, the edge flows toward the end with the lower y, then the lower x.
3. Sources are nodes with no neighbour of higher D.

On the starting map, the river runs down the middle columns and touches coastal rows north and south. This rule gives it one watershed near the middle: it rises in the central hills and flows north and south to the sea. Real rivers behave this way, so flow stays sensible without any elevation data.

### 2.3 Width and taper

Accumulated length A(node) is the sum of the lengths of every edge upstream of the node, plus the edge itself. Width at a point on an edge, interpolated by position along the edge:

`w = W_SRC + (W_MOUTH - W_SRC) * min(1, A / 6.0) ^ 0.6`

| Constant | Cells | px at 160 |
|---|---|---|
| W_SRC | 0.055 | 8.8 |
| W_MOUTH | 0.100 | 16.0 |

The river is never narrower than 2.2 times the front line (0.025 cell). This matters because the starting front lies on the river. The front line is drawn down the middle of the water, with water visible on both sides, and it reads like a real border that follows a river.

### 2.4 Drawing

Subdivide every edge path into pieces of at most 0.04 cell. Draw three passes over the whole network: all banks, then all water, then all glints.

1. **Bank:** stroke each piece at width w + 2 device px in RIVER_BANK alpha 0.55, lineCap round.
2. **Water:** stroke at width w in RIVER_WATER, lineCap round.
3. **Glint:** where w is at least 0.06 cell, stroke at width 0.3 w in RIVER_GLINT alpha 0.35. Offset it 0.15 w toward the upper left (the lamp side) along the piece normal.

Round caps on short pieces make tapered joins and confluences seamless. The centreline is the sim path exactly and is never smoothed, so the front line and bands that share the path stay inside the water.

Relief (Section 3) carves a valley along every river, so rivers lie in low ground and fall from source to mouth.

### 2.5 Reaching the sea

- At every mouth node, the river continues along that node's divider ray (1.4), from the lattice boundary to the coastline, at width W_MOUTH.
- Over the last 0.15 cell it widens linearly to 1.8 times W_MOUTH (the estuary).
- In the sea, before the land is drawn (1.6 step 4), each mouth gets an estuary fan:
  - an ellipse centred 0.10 cell seaward of the point where the river crosses the coastline;
  - radii 0.22 cell along the outward normal and 0.12 cell across it;
  - filled SEA_SHORE at alpha 0.6.
- The divider ray is also the apron boundary between the two provinces, so the river remains the border all the way to the sea.

### 2.6 Rail

Rail data is unchanged (geom.railSegments, built or not). It is restyled as map railways:
- **Built rail:** Ink line, width 0.008 cell, alpha 0.8, with cross ties 0.03 cell long every 0.06 cell at Ink alpha 0.6.
- **Unbuilt rail:** a dotted line, dots 0.008 cell every 0.04 cell, Ink alpha 0.45.
- Rail crosses rivers without a bridge symbol.

---

## 3. Topography (decorative relief)

### 3.1 The rule, stated plainly

Relief is decorative presentation. It is never a game rule. No sim number, order, or outcome reads it, and the sim has no elevation. The legend (Section 5.6) tells the player: "Hills and shading make the map look like real land. They are scenery only. They do not slow armies or help defenders."

To keep scenery from looking like a rule:

- No hill or mountain symbols, no peaks, no snow, no forest. Relief is continuous shading that ignores province borders, so no province looks like a "hill province".
- The T-xxx raised terrain pieces from VISUAL_STRATEGY are retired (Section 9, C7).
- Fairness of look: the mean ruggedness of each nation's starting provinces differs by at most 0.08 (3.3), so neither side looks like it was given the high ground.

### 3.2 Technique: a baked hillshade raster plus vector contours

This technique was chosen because it fits a 60 fps budget. All relief work happens once per geometry and once per canvas size, never in the frame path. Frames only blit the finished base canvas, as they do today.

- **Height grid.** RELIEF_RES = 24 samples per cell over the neatline rectangle (12 by 9 cells): 288 by 216 = 62,208 samples. It is computed once per chartSeed and cached in memory for the session.
- **Distance fields** on the same grid:
  - dC: distance to the coastline;
  - dR: distance to the river network centreline;
  - the D value of the nearest river point;
  - dS: distance to the nearest river source.

  Each is computed with a two pass 3 4 chamfer distance transform, seeded by rasterising the curve at grid resolution, then scaled to cell units. This is O(N), with no per sample search over segments.
- **Shade raster.**
  - A canvas of 288 by 216 px holds the final land colour per sample, with tint and shade already composited in JS arithmetic.
  - It is written once with createImageData and putImageData. Both are allowed; neither is on the banned list.
  - At bake time the base canvas draws it scaled to size with imageSmoothingEnabled true and imageSmoothingQuality 'high', clipped to the land path (the coastline closed path).
  - At 160 px per cell one sample spans about 6.7 px. Hill shading is soft by nature, so the upscale reads as smooth ground.

### 3.3 The height function (normalised height h in 0 to 1, land samples only)

**Per province ruggedness:**
- r_p = 0.25 + 0.75 * u, with u from mulberry32 seeded by FNV-1a(chartSeed + ":rug:" + salt + ":" + provinceId).
- Fairness: compute the mean r_p over each nation's starting provinces, using owners at tick 0 from a fresh game's view. If the means differ by more than 0.08, increment salt (starting at 0) and recompute, up to salt 15. Then keep the salt with the smallest difference.
- Beyond land uses r = 0.6.
- r(P) at any point is the bilinear interpolation of r values at cell centres, clamped at the lattice edge. Ruggedness therefore flows smoothly across borders.

For a land sample P:

```
fbm(P)  = sum over o = 0..3 of 0.5^o * V(P * 0.9 * 2^o, seed o), divided by 1.875   (V is 2D value noise in 0..1, smoothstep interpolated, lattice values from mulberry32(FNV-1a(chartSeed + ":h:" + o + ":" + ix + "," + iy)))
base    = 0.35 * smoothstep(0, 2.5, dC)                    (land rises away from the sea)
raw     = base + 0.65 * r(P) * fbm(P) + 0.25 * exp(-(dS / 0.8)^2)   (watershed boss at river sources)
raw     = raw * smoothstep(0, 0.45, dC)                    (every shore comes down to sea level)
hv      = 0.06 + 0.24 * Dn                                 (river level; Dn = D of nearest river point / max D in that component, 0 at the mouth, 1 at the source)
wv      = smoothstep(0.05, 0.60, dR)
h       = hv * (1 - wv) + max(raw, hv + 0.02) * wv         (valley: river level at the water, rising away from it)
h       = clamp(h, 0, 1)
```

Guarantees, pinned by tests in Step 11:
- h is 0 within 0.01 cell of the coast, so coastal provinces meet the sea.
- h along every river falls monotonically from source to mouth.
- h at 0.6 cell from a river is never below the river level at its nearest point.

### 3.4 Hillshade and tint (per sample, in JS)

- **Gradient:** central differences over grid spacing g = 1/24 cell, vertical exaggeration Z = 3.0.
- **Normal:** n = normalise(-Z dh/dx, -Z dh/dy, 1). Canvas y points down.
- **Light:** from the upper left, matching the lamp. L = (-0.5, -0.5, 0.7071), azimuth 315 degrees, altitude 45 degrees.
- **Shade term:** s = max(0, n . L); delta = s - 0.7071, which is zero on flat ground.
- **Tint:** T = mix(LAND_LOW, LAND_HIGH, smoothstep(0.25, 0.75, h)).
- **Shade:** if delta < 0, out = mix(T, SHADE_DARK, min(0.38, -1.1 * delta)); otherwise out = mix(T, SHADE_LIGHT, min(0.20, 0.9 * delta)).
- **Label reserve (3.6):** inside a reserve, multiply delta by 0.35 before applying the shade rule.

Luma check: flat ground is about 124, the deepest shadow about 92, and the brightest lit slope about 147. The whole land stays inside the Terrain in sight band (60 to 150), with room left for the political wash and the bands.

### 3.5 Contour lines

- Three levels: h = 0.30, 0.55, 0.80.
- Extract with marching squares over the height grid, then apply two Chaikin passes.
- Drop any polyline shorter than 0.25 cell.
- Cut any contour within 0.06 cell of a river centreline or inside a label reserve.
- Stroke CONTOUR at alpha 0.22, lineWidth 1 device px (2 at DPR 2), lineJoin round.
- The paths are cached in cell space per chartSeed and drawn at bake time.

The contours give the "proper topography" read Jash asked for without shouting.

### 3.6 Label reserves (names never collide with relief)

Each province's name anchor (5.5) defines a reserve ellipse with half axes 0.45 by 0.11 cell. Inside it, hillshade delta is scaled by 0.35 and contours are cut. The name always sits on calm, even ground.

### 3.7 Performance budget

Measured by the step's check on the reference capture machine, using the F07 worst case fixture.

| Work | When | Budget |
|---|---|---|
| Chart build (coast, aprons, hit polygons, river graph) | once per geometry | 15 ms |
| Height grid, distance fields, shade raster, contours | once per geometry | 45 ms |
| Base canvas bake | per canvas size (new game, zoom settle, resize) | 40 ms at DPR 1, 120 ms at DPR 2 |
| Per state change redraw (fog, state) | each tick with a change | unchanged from Steps 7 and 8 |

Fixed fallback if the relief budget fails: RELIEF_RES drops from 24 to 16, and the step logs the measured times. No other change is permitted to meet the budget.

---

## 4. Latitude and longitude

### 4.1 The fictional coordinates

Equirectangular projection, straight lines, north up. Cells come out square on the ground at the chart's middle latitude.

- latitude(y) = 51.5 degrees N - 2.0 * y
- longitude(x) = 8.5 degrees E + 2.8 * x

The neatline spans about 53.5 N to 35.5 N and 5.7 E to 39.3 E. At 44.5 N, one cell is about 222 km tall and about 222 km wide.

### 4.2 Graticule lines

- **Spacing:** every 5 degrees.
  - Meridians at 10, 15, 20, 25, 30, 35 E (x = 0.536, 2.321, 4.107, 5.893, 7.679, 9.464).
  - Parallels at 50, 45, 40 N (y = 0.75, 3.25, 5.75).
  - None of these coincides with a cell edge or a cell centre, so the grid never doubles a border or crosses a plaque centre.
- **Style:** Ink, alpha 0.20, lineWidth 1 device px (2 at DPR 2), solid, from neatline to neatline, over sea and land alike.
- **Placement in the stack:**
  - Drawn as the last pass of the #map-fog canvas render: a constant "chart furniture" op list appended after the fog ops and included in the fog hash.
  - The grid therefore runs unbroken over charted ground, faded chart, and blank paper.
  - It stays under tiles, names, bands, the front, and plaques.
- **Luma impact:** under 1 percent of pixels, at about 108 on terrain and about 172 on paper, so it never moves a band percentile.

### 4.3 Degree border

Drawn on the base canvas, between the neatline and the outer frame line:
- FRAME_PAPER fill.
- Along the inner edge, a degree bar 0.06 cell wide, alternating Ink and Paper every 1 degree (the classic chart border).
- Neatline: Ink, 0.008 cell. Outer frame line: Ink, 0.012 cell.

Labels are DOM text in #map-labels:
- IM Fell English (roman, not SC), 11 CSS px at zoom 1, Ink.
- Centred in the border strip at each graticule line.
- Meridian labels ("10°E", "15°E", and so on) on the top and bottom borders.
- Parallel labels ("50°N", "45°N", "40°N") on the left and right borders.
- Labels scale with zoom like the rest of the board.

### 4.4 Scale bar and north arrow (both earn their place)

The scale bar gives the player one useful fact: how big a province is. The north arrow is there because the grid implies a direction, and a chart without one looks unfinished. Both sit in the bottom border strip (BORDER_FOOT), outside the sea, so they never sit on top of play.

**Scale bar**, at the left end of the foot strip:
- A bar 0.90 cell long (200 km) and 0.035 cell tall.
- Four alternating Ink and Paper parts marking 0, 50, 100, and 200 km; the last part is twice as long.
- DOM labels "0", "100", "200 km", 10 px.
- Under it, in DOM, 10 px italic: "One province is about 220 km across."
- The bar is drawn in cell units, so it stays true at every zoom.

**North arrow**, at the right end of the foot strip:
- A slim two tone arrowhead 0.36 cell tall, pointing up.
- The left half is Ink. The right half is Paper with an Ink outline, so the lit half faces the lamp.
- A DOM "N" in IM Fell English SC above it.

No compass rose. A rose in the sea would compete with the coast at the most open part of the chart.

---

## 5. Borders, ownership, and the front

### 5.1 Line hierarchy (thickest and darkest first)

| Line | Layer | Width | Style |
|---|---|---|---|
| Front | #map-state | 0.025 cell (4 px) | Ink core, unchanged from D1, plus a paper casing (5.3) |
| Band core | #map-state | 0.01875 cell (3 px) | faction colour with ink edges, unchanged from D1 |
| Coastline | base | 0.010 cell | Ink alpha 0.85 |
| Province border | base | 0.009 cell (1.44 px) | Ink alpha 0.50, dashed |
| Edge of the war | base | 0.008 cell | Ink alpha 0.45, dash dot |
| Rail | base | 0.008 cell | as 2.6 |
| Graticule | fog canvas | 1 device px | Ink alpha 0.20 |
| Contours | base | 1 device px | CONTOUR alpha 0.22 |

### 5.2 Province borders (administrative lines)

- Every chart edge path (1.4) between two provinces that is not a river edge gets a dashed line on the base canvas:
  - Ink alpha 0.50;
  - lineWidth 0.009 * scaleX;
  - setLineDash([0.040 * scaleX, 0.025 * scaleX]);
  - lineCap round.
- River edges get no dashed line, because the river is the border.
- These lines replace the current parchment edge lines entirely.

### 5.3 Ownership and the front: D1 kept, restyled to sit on terrain

The D1 ruling stays in force with every measure unchanged:
- band widths 16, 9, 3 px nominal (0.10, 0.05625, 0.01875 * scaleX);
- alphas 0.12 and 0.18;
- FILL_ALPHA 0.06;
- the doubled Khessite core;
- ink edges;
- the 4 px front.

On a terrain chart, D1 turns out to be exactly the hand coloured border ribbon of an old political map, so it is the right treatment rather than a compromise. Three changes make it sit on terrain:

1. **Geometry.** Bands and the front use chart edge paths (1.4), so they run to the coast. For a province's sea segments, the band path is the coastline points tagged with that segment, clipped to the province's hit polygon. The ribbon follows the coast, as on a political map. Inland segments keep the lattice boundary path (the edge of the war).
2. **Political wash.** For every live province with a known owner, FILL_ALPHA 0.06 is drawn as a fill of the hit polygon in the faction colour, on #map-state under the bands. If Step 7a did not draw it, Step 12 does.
3. **Front casing.** Before the 4 px Ink front stroke, stroke the same path at 0.025 * scaleX + 2 device px in Paper #E6D8B5 at alpha 0.6. On dark relief or over the river, the front then has a thin light edge on both sides. The core stays in the Ink band. The casing is about 216 luma at full strength and lower when blended, so it stays under 225.

**Readability cost.** With the flat tile tints gone, ownership reads from the border ribbons and the faint wash rather than from solid fills.
- Each nation's ground is contiguous and fully ringed by its ribbon, so the eye reads territories the way it reads countries on any atlas.
- The cost: a province deep inside a territory carries only the 0.06 wash.
- That is acceptable for the "which side holds this" question, because the ribbon answers it at the territory scale. The Step 12 acceptance tests it.

**Marked proposal P-MT1** (needs Jash's ruling; not in force):
- Raise FILL_ALPHA from 0.06 to 0.14 for a stronger hand coloured wash. Luma stays in band, at about 126 over flat ground.
- Step 12 captures F02 and F04 both ways as an A and B pair for Jash.
- Until he rules, 0.06 is drawn.

### 5.4 DOM tiles

- Each tile loses its background colour, border, and box.
- It keeps everything else it shows today (badges, chips, plaques), restyled as small Paper chips with an Ink hairline so they read on terrain.
- The unit display is replaced by the plaque system at Step 15, as already planned.
- The tile name line moves to #map-labels (5.5).

### 5.5 Province names on terrain

- **Layer:** #map-labels, a DOM overlay above #map-state, pointer-events none. It is positioned in the same cell space through the chart inset and zoom transform.
- **Font:** IM Fell English SC (VISION_BOARD), 12 CSS px at zoom 1, Ink #2B2620, letter-spacing 0.08em. Capitals are 14 px.
- **Anchor:**
  1. Take the polygon's centroid, moved up 0.30 cell.
  2. Clamp it so the label box (measured in DOM) stays inside the polygon inset by 0.06 cell.
  3. If it still does not fit, drop letter-spacing to 0.02em, then the size to 11 px.
  4. No name ever wraps or leaves its province.
- **Halo:** text-shadow 0 0 2px rgba(230, 216, 181, 0.9), 0 0 4px rgba(230, 216, 181, 0.6). With the label reserve in 3.6, the name sits on calm ground and is never cut by a contour or a dark slope.
- **Fog:** names stay in every fog state, because the map of provinces is known even when what is in them is not. On Unknown ground they are drawn at opacity 0.75.
- **Sea and continent names:** none. The sim names no seas or continents, and this document does not invent lore.

**Marked proposal P-MT3:** if js/lore.js gains sea and land names, they are drawn:
- in italic IM Fell English, 13 px, Ink alpha 0.6, letter-spacing 0.3em;
- at reserved points in the sea sectors farthest from the coast.

### 5.6 The map legend (replaces the current tile wording)

The #map-legend list is replaced in full with these items, in this order, in these words:

1. "This is a map of the war. Blue is your nation, the Vessari Compact. Red is the Khessite Dominion."
2. "A coloured band along a border shows who holds the ground on that side: blue for yours, red for the Dominion. The black line where blue meets red is the front."
3. "Dashed lines are province borders. Click anywhere inside a province to select it."
4. "Rivers are drawn in blue gray. Crossing a river is harder for your troops."
5. "Provinces that touch the sea are coastal. Flotillas are built and sail there."
6. "Railways are drawn as ties on a line. A dotted line is a railway not yet built."
7. "A dash dot line at the edge of the map is the edge of the war. The land beyond it takes no part."
8. "Hills and shading make the map look like real land. They are scenery only. They do not slow armies or help defenders."
9. "The thin lines of latitude and longitude help you find your way. Distance in the game is counted in provinces, not degrees."
10. "Blank paper is land you have never seen, and paper sea is water you have not charted. A faded brown, hatched province is what you saw last time; it may have changed."

Item 4 must match the sim's river rule. If How to play words the river penalty more exactly, item 4 copies that wording.

---

## 6. Fog on the chart

The three states keep their meaning and data source: adapter playerView intel 'live', 'remembered', and 'dark'. Fog stays texture and value, never darkness. Unknown is the lightest ground on the board.

Each fog op now covers the province's hit polygon plus its sea sector (1.4), so the sea in front of an unseen coast is uncharted too.

### 6.1 In sight (live)

The fog canvas draws nothing. The full chart shows.

### 6.2 Last seen (remembered): a faded chart

1. Clip to the hit polygon plus the sea sector.
2. Fill CHART_FADED at alpha 0.65. Coast, rivers, relief, borders, and contours stay faintly visible under the wash. Resulting luma is about 144 over open sea and about 160 to 166 over land, inside the 120 to 175 band.
3. Hatch:
   - diagonal lines from upper right to lower left;
   - spacing 0.12 cell, Ink alpha 0.30, lineWidth 1.5 device px;
   - anchored so the cell centre falls between two lines (the Step 8 hatchAnchor, kept).
4. Draw the gray last known owner band at half alpha along the perimeter (the D2 ruling, as built in Step 8), now on the chart edge paths.

### 6.3 Unknown (dark): uncharted paper

1. Clip to the hit polygon plus the sea sector.
2. Fill CHART_UNKNOWN (luma 205.5), opaque. No relief, no colour.
3. Redraw on top, in Ink, what any chart of the region would show:
   - the coastline within the clip: 0.008 cell, alpha 0.70;
   - in the sea sector, three water lines at 0.07, 0.15, and 0.26 cell from the coast (the 1.6 offsets): 1 px, alpha 0.25;
   - river courses within the clip, as single lines with no water fill: 0.006 cell, alpha 0.60;
   - dashed province borders, alpha 0.35.
4. Paper grain: none until textures land at Step 19, then TX-FOG-UK (6.5).

**Retired from Step 8:** the mist wisps, the cloud puffs, and the opaque gray #9E9E97 remembered fill.
**Kept from Step 8:** the fog ops, fingerprint, hash, AshesFogDebug, and canvas wiring.

### 6.4 Band report additions

- The band report gains one row per sea sector, keyed `<provinceId>#sea`. Each row is measured against its province's fog state band:
  - in sight sea: 60 to 150;
  - last seen: 120 to 175;
  - unknown: 185 to 225.
- Beyond land and the border strip are reported for information only. They are gated only by the 225 ceiling.

### 6.5 Textures in fog (Step 19)

- TX-FOG-UK replaces the flat CHART_UNKNOWN fill. It is a pattern with mean luma 205 plus or minus 3 and standard deviation 6 or less.
- TX-FOG-LS replaces the flat CHART_FADED wash, keeping the 0.65 alpha.
- Both are created with createPattern at bake or load time.

---

## 7. Textures and the rendition pipeline

### 7.1 The one board level style target: MAP-TGT

One ChatGPT rendition defines the look of the whole map. It is a style target only: never drawn, never sampled, never shipped (Section 9, C1).

- Brief file: art-direction/briefs/R0-MAP-TGT.md.
- Attachments: art-direction/master-sheet.png (v1, the adopted diorama), and nothing else.
- Four candidates, each in a new temporary chat.
- Request text:

> [VISUAL_STRATEGY 3.1 preamble, verbatim] Subject: the board in the master sheet remade as a printed and hand colored chart of one continent, seen straight down, filling the frame. The continent is wider than tall. Its north and south shores are coast with shaded shallow water stepping down to deeper sea, thin engraved water lines parallel to the coast, and a few tiny wave marks in the open sea. Its west and east edges also end in coast after a strip of land. One river rises in low hills near the middle of the continent and flows north to the sea and south to the sea, wider near each mouth. Soft hill shading lit from the upper left with a few faint contour lines; no mountains, no peaks, no snow, no forests. Fine dashed borders divide the land into many small provinces of similar size. The land on the left has a thin Vessari blue ribbon along its borders, the land on the right a thin Khessite red ribbon, and a single black line runs down the river where the colors meet. A plain latitude and longitude grid of thin lines across land and sea, and a narrow chart border with alternating black and paper degree bars, with no numbers. Muted olive and ochre land, gray green blue sea, warm paper border. Absolutely no text, letters, numbers, labels, compass rose, or user interface. Wide 4:3 image.

**Selection gates:**
- R-a (no text).
- R-g (on master).
- R-m (new; Claude Design rules on it): at thumbnail size (256 px wide) the image shows land and sea as different things, the river reaches the sea, and the ribbons read as ownership without solid fills.

**After selection:**
- The winner is logged as MAP-TGT-R0-cN, with parent master-sheet-v1.
- Book R0 today, ahead of R1.
- R0 does not block any build step: Steps 9 to 14 build to the hex values in this document.
- MAP-TGT is the reference for the Step 14 drift check and for Jash's map review.

### 7.2 Master sheet change

- Master sheet v2 (Step 18) replaces panel P6 (terrain kit) with a 768 by 768 crop of MAP-TGT, centred on the river and one coast.
- From then on, every map texture rendition attaches master sheet v2 plus the P6 crop. This is legal under VISUAL_STRATEGY 2.3 rules 1 and 2.
- P8 (fog papers) stays and feeds TX-FOG-LS and TX-FOG-UK.

### 7.3 Textures the map needs

| ID | Surface | Applied as | Clamp |
|---|---|---|---|
| TX-LAND | painted chart paper ground, very fine grain and brush mottling, no features | pattern over the land path, globalCompositeOperation 'soft-light', alpha 0.35 | land band report still 60 to 150 |
| TX-SEA | painted sea paper, faint horizontal brush ripple | pattern over the sea, 'soft-light', alpha 0.30 | sea sector band 60 to 150 |
| TX-PAPER | chart border paper | fill of the border strip | under 225 |
| TX-FOG-UK | plain warm paper grain | Unknown fill (6.5) | mean 205 plus or minus 3, sd 6 or less |
| TX-FOG-LS | old sepia paper with fine ink hatching | Last seen wash (6.5) | 120 to 175 |

- No forest, scrub, or terrain type textures. The sim has no terrain types, and drawn forests read as game terrain in this genre.
- TX-TER (as a family) and TX-RIV are retired. Rivers stay code drawn.

### 7.4 How the TX01 bake-off changes

TX01 becomes TX-LAND, the texture covering the most map area. The VISUAL_STRATEGY 6.3 rule is otherwise unchanged:

- **Candidate A:** the best ChatGPT rendition, made seamless.
- **Candidate B:** a Blender material remade from that rendition and baked through CAM_TEX at 1024 px.
- **Scoring:**
  - R-h seamless;
  - band report in F02 for all three fog states;
  - F02-gray plaque battery at 100 percent;
  - size 250 KB or less as WebP.
- A tie goes to B.
- The winner sets the route for TX-SEA, TX-PAPER, TX-FOG-UK, and TX-FOG-LS at Step 19.

### 7.5 Blender relief tiles RX01 and RX02: role and trigger

Code relief (Section 3) is the default and ships unless a trigger fires. The one thing Blender does better is surface micro relief: real light falling on small undulations, which makes ground look modelled rather than shaded.

**RX01:**
- A seamless micro relief shade tile, 1024 px.
- Rendered through CAM_TEX with KEY (upper left light) from a Blender displaced plane.
- Normalised to mean luma 128, standard deviation 10 or less.
- Used as a 'soft-light' pattern over land at alpha 0.5 multiplied by ruggedness r(P).
- Drawn in 8 alpha steps (r quantised), clipped to precomputed ruggedness zones. This keeps the frame path free of per pixel work.

**RX02:** the same tile family for beyond land, at alpha 0.3.

**Trigger** (either of these):
1. Jash's verdict at the Step 14 map review says the hills look flat, computer drawn, or fake.
2. At Step 19, the TX-LAND winner is route B (Blender), so the rig and CAM_TEX are already paid for.

**Whole map Blender bake:** exporting the height grid as a 16 bit PNG and rendering it displaced is allowed only if Step 9 measurement M1 shows the geometry is identical for every new game. If geometry varies by seed, the relief varies too and must stay code.

---

## 8. Build order

### 8.1 The amended Cycle 23 sequence

- Step 7c's two fixes proceed as already ordered.
- Step 8 (fog) is built and passing 18 of 18 checks. It is accepted and committed as built. Its canvas, ops, fingerprint, and tests are the infrastructure Step 14 restyles.
- Every step below is built by Opus 5.5, one verified step per run, briefed by the orchestrator from this document.
- Every step runs the standing checks:
  - node --check on touched files;
  - tests/sim.test.js, 191 pass;
  - tests/presentation.test.js, all pass;
  - balance byte identical to the baseline;
  - the step's browser check;
  - no em or en dashes.
- js/sim.js, js/adapter.js, js/map-geometry.js, js/save.js, and js/lore.js are never touched.

| Step | Name | Builder | Delivers | Screenshot acceptance (one sentence) | Retires |
|---|---|---|---|---|---|
| 9 | Chart, sea, and coast | Opus 5.5 | js/map-chart.js (frame, coastline, aprons, sectors, hit polygons, chart edge paths, hitTest, chartSeed); base canvas draws border strip, sea (1.6), flat LAND_LOW land, beach strip, coastline, edge of the war; board grows by margins; board click by hit polygon; tile backgrounds removed; tests M-COAST, M-BOUNDS, M-CONTAIN, M-ADJ, M-HIT; measurement M1 (does geometry vary by seed) logged | F02 shows one continent with an irregular inked coastline, shaded shelf and water lines in a sea that surrounds it on every side, and no coloured tile backgrounds anywhere. | flat faction tile tints; the rectangular lattice edge; parchment edge lines on boundary segments |
| 10 | Rivers | Opus 5.5 | river graph, flow, width taper, banks, water, glint, mouth extensions, estuary fans; rail restyle (2.6); test R-TRUTH; tests for monotonic width downstream and mouths only at sea vertices | In F02 the river down the middle is a tapered blue gray water course with dark banks that widens toward both coasts and opens into the sea with a fan at each mouth, and the front line in F03 runs inside the water. | river as an edge style; old rail edge style |
| 11 | Relief | Opus 5.5 | height grid, distance fields, shade raster, contours, label reserves (anchors computed here, names drawn in Step 12), fairness salt; budget check (3.7) with fixed fallback; tests for coast height 0, monotonic river level, determinism by chartSeed | F02 shows soft hills lit from the upper left with faint contours, rivers lying in valleys, shores flattening into the sea, and no visible seam at any province border. | flat land fill |
| 12 | Borders, ownership, names | Opus 5.5 | dashed province borders (5.2); D1 on chart edge paths and coast ribbons; political wash at FILL_ALPHA; front casing; #map-labels with IM Fell English SC names and halos; tile chip restyle (5.4); P-MT1 A and B captures for Jash | In F04 a player can name the owner of every live province from the ribbons alone, the front is the darkest line on the map, and every province name sits on calm ground inside its own borders. | parchment edge lines on interior edges; the tile name line |
| 13 | Graticule, scale bar, north arrow, legend | Opus 5.5 | graticule as fog canvas furniture op; degree border; DOM degree labels; scale bar; north arrow; full legend replacement (5.6) | F02 shows the latitude and longitude grid across land and sea with degree labels in the border, a 200 km scale bar and a north arrow in the foot strip, and the new legend under the map. | every legend item that describes tiles or the parchment board, including the Step 7a band item (reworded as item 2) |
| 14 | Fog on the chart; map review | Opus 5.5 | fog ops cover hit polygon plus sea sector; Last seen faded chart; Unknown uncharted paper with coast, water lines, rivers, borders redrawn in ink; band report sea rows; Step 8 tests for wisps and puffs replaced (this step is authorised to edit them); storyboard contact sheet step-14 and a side by side with MAP-TGT for Jash | In F06-gray the three states are told apart by texture and value with every band report passing, and the sea in front of an unseen coast is paper with water lines. | mist wisps, cloud puffs, opaque gray Last seen fill, the Step 8 fog legend item |
| 15 | Plaques on the live board | Opus 5.5 | old Step 9, unchanged except plaques sit above #map-labels in the layer order (plaques above names) | as old Step 9 | as old Step 9 |
| 16 | Attack beats, checkpoint 1 | Opus 5.5 | old Step 10 | as old Step 10 | none |
| 17 | Atmosphere and palette harness | Opus 5.5 | old Step 11; vignette applies to the border strip and the sea margin first; the band report now includes sea sectors | as old Step 11 | none |
| 18 | Master sheet v2 and the TX-LAND bake-off | Opus 5.5 | old Step 12 with P6 replaced by the MAP-TGT crop (7.2) and TX01 read as TX-LAND (7.4) | F02 with each TX-LAND candidate passes the band report, and the winner is logged by the 6.3 rule. | P6 terrain kit panel |
| 19 | Map textures | Opus 5.5 | old Step 13 plus the fog half of old Step 14: TX-LAND, TX-SEA, TX-PAPER, TX-FOG-UK, TX-FOG-LS; RX trigger evaluated and, if fired, RX01 and RX02 wired | F02, F04, and F06 pass every band report with real textures, and the 3 x 3 seam check passes for every map texture. | flat fills under textures |
| 20 | Panel textures and decals | Opus 5.5 | the rest of old Step 14: TX-PNL, DC-xx, decals clipped to hit polygons | as old Step 14 for TX-PNL and decals | none |
| 21 | UI frames and interim title | Opus 5.5 | old Step 15; TF now frames the chart's outer frame line | as old Step 15 | none |

Old Steps 16 to 28 become Steps 22 to 34, with content unchanged except:
- Old Step 17 (blockouts) drops T-xxx.
- Old Step 23 (conditional richness) drops the T-xxx finals. It keeps decal density, and the RX tiles if they have not already been triggered.

### 8.2 Rendition booking change

- Add R0 (MAP-TGT, 4 requests) at the head of the VISUAL_STRATEGY 6.2 queue, today.
- R2 becomes TX-LAND (4 requests).
- R3 becomes TX-SEA and TX-PAPER (4 requests).
- R4 keeps TX-FOG-LS, TX-FOG-UK, TX-PNL, and DC-xx.
- R8 drops T-xxx.
- The rest is unchanged.

### 8.3 Storyboard frame changes

- **F02 composition:** the whole chart, frame to frame, centred on the lattice centre, with TF around it.
- **F06:** the crop box includes the province's sea sector.
- **F07:** in addition to its current loads, the generator puts at least two coastal provinces in Unknown and two in Last seen, so uncharted and faded sea are both under test.
- **All board frames:** the harness records chart build, relief, and base bake times (3.7) in the step report.

---

## 9. Conflicts with STRATEGY.md and VISUAL_STRATEGY.md

### C1. "A generated rendition never becomes the map"

**Pressure:** MAP-TGT is a whole map image, and it will look good.

**Resolution (ruling holds):**
- MAP-TGT is a style target, and the parent of texture renditions through master sheet v2.
- It is never drawn, sampled, traced, or shipped. asset-lint already fails any runtime reference to art-direction/.
- The only pre-rendered pixels in the map are seamless textures and RX tiles that pass R-h and the band report. All sit inside the canvas base layer, as RESEARCH.md D5 allows.
- Every shape on the map (coast, river, border, front, sector, relief) is computed from sim geometry.

### C2. Value bands, including the proposed Figures band

**Pressure:** the sea is not a province and had no band; relief adds shadows and highlights; ink lines now cross Unknown paper.

**Resolution:**
- Sea sectors take their province's fog band (6.4).
- Relief is clamped by construction (92 to 147), inside Terrain 60 to 150.
- Coastline, borders, graticule, and contours are thin and stay well under 5 percent of any province's pixels, so they do not move the 5th to 95th percentiles. The band report proves this every step.
- Nothing new reaches 225.
- The Figures band proposal (VISUAL_STRATEGY 7.8, P1) is unaffected. With T-xxx retired, Figures covers only units and structures, and relief is Terrain.

### C3. The D1 band spec

**Pressure:** Jash's direction could read as "remove the bands".

**Resolution:** D1 is kept with every measure unchanged (5.3). Three additions sit within it:
- chart edge paths, so bands and the front reach the coast;
- coast ribbons on sea segments;
- the paper casing on the front, which adds pixels beside the front but changes neither its width nor its value.

Proposal P-MT1 (FILL_ALPHA 0.14) is marked and not in force.

### C4. Hit testing on jittered polygons

**Pressure:** aprons extend coastal provinces past the lattice, and DOM tiles are rectangles.

**Resolution:**
- Hit testing moves to hit polygons. These contain the original jittered polygons exactly and add only aprons (1.4, 1.5).
- M-ADJ, M-CONTAIN, and M-HIT pin that adjacency truth and every in-lattice hit are unchanged.
- DOM tiles keep their keyboard and screen reader roles.

### C5. The worst case fixture (tools/fixture/worst-case.json and F07)

**Pressure:** new map layers add load, and the fixture's fog counts are pinned (46 live, 9 remembered, 15 dark).

**Resolution:**
- The fixture is not edited, so its counts stand.
- F07 gains the coastal fog requirement in 8.3.
- The performance budget in 3.7 is measured on F07, with a fixed fallback.

### C6. Step 8's tests and the "append only" test rule

**Pressure:** Step 8 pinned exactly 3 wisps and 4 puffs per Unknown op, and the gray remembered fill. This document retires both.

**Resolution:**
- Step 14 is authorised to replace exactly those assertions (the wisp and puff counts, and the FOG_REMEMBERED_FILL value) with the chart fog equivalents.
- Every other existing test stays untouched.
- FOG_UNKNOWN_FILL keeps its value, #DCCDA8.

### C7. VISUAL_STRATEGY T-xxx terrain pieces and the draw order

**Pressure:** T-xxx assumed a sim terrain list that does not exist. Raised hill miniatures at 56 px would read as game pieces, which contradicts 3.1.

**Resolution:**
- T-xxx is retired from the component list, the silhouette battery, R8, old Step 17, and old Step 23.
- The VISUAL_STRATEGY 0.5 draw order becomes, bottom to top:
  1. TF;
  2. base chart (sea, land, relief, rivers, borders, rail, coast);
  3. decals;
  4. fog, with the graticule furniture;
  5. DOM tiles and chips;
  6. #map-state (wash, bands, front);
  7. #map-labels (names, degree labels);
  8. structures, units, smoke, atmosphere, plaques, and beats, in the order already ruled above the state layer.
- Where VISUAL_STRATEGY 0.5 differs from this list, VISUAL_STRATEGY is wrong and this list wins.

### C8. "Fog is texture and value, never darkness"

**Pressure:** none new; the chart fog is lighter than before.

**Resolution:** the ruling holds. Unknown, at 205.5, is the lightest ground. Last seen is a light sepia wash, not a gray dimming.

### C9. Lint bans in frame path modules

**Pressure:** soft relief and text normally use gradients and fillText.

**Resolution:**
- Neither is used. Relief comes from a putImageData raster made at bake time, and all text is DOM.
- js/map-chart.js and any relief module are added to the lint's module list.

### C10. "Every step must be visible" (item 28)

**Pressure:** Step 9 includes invisible geometry work.

**Resolution:** each step pairs its pure module with the first visible use of it in the same run, so no step is invisible.

### C11. Reorder item 28's numbering

**Pressure:** six new steps push the old sequence back.

**Resolution:** 8.1 is the amendment item 31 anticipated. Visual work still comes first, and the map is the largest visual change the game can make.

No other ruling is under pressure. Jash's direction changes how the map looks and the order of work. Sim truth, the information layers, the bands, the tint rules, and every gate stand as ruled.
