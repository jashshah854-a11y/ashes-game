# Step 14: map review package (fog on the chart)

MAP_TREATMENT Step 14 closes the chart sequence (Steps 9 to 14): the map
is now one continent on a printed chart, with rivers, relief, borders,
ownership ribbons, the graticule and frame, and fog drawn as chart
states. This folder is the review package for Jash. The verdicts asked
for are at the end; nothing in this package changes any code.

## What is in this folder

- F02.png: the opening board. Fresh game, seed 42, day 1, paused
  (43 ownership fills, 7 front edges; intel: 43 live, 0 remembered,
  27 dark). The west is live and in full colour, one column beside the
  river is already last seen, and the east is Unknown paper.
- F04.png: the mid-war front board. The committed worst case fixture
  (tools/fixture/worst-case.json, day 146, 46 fills, 12 front edges;
  intel: 46 live, 9 remembered, 15 dark) imported through the real
  save path. It stands in for the storyboard F04 frame; no separate
  F04 fixture exists yet, same as Step 12c recorded.
- F06.png: the fog frame. A clip of the same fixture board as F04
  (its right 45 percent), per VISUAL_STRATEGY frame F06, which keeps
  the whole board and a crop. The whole board is F04 above; the crop
  puts the three fog states side by side: live provinces in full
  colour with numbered plaques, last seen provinces as faded hatched
  sepia with hollow plaques and no numerals, and Unknown provinces as
  blank paper with the coast, water lines, rivers, and borders
  redrawn in ink.
- F02-gray.png, F04-gray.png, F06-gray.png: luma copies of the three
  frames (orchestrator, python PIL), because the Step 14 acceptance
  sentence is a grayscale claim: the three states are told apart by
  texture and value, never by darkness alone.
- contact-sheet.png: all six images in one sheet, colour on top,
  gray below, each cell labelled.
- Made by tools/map-review-capture.js (11 of 11 checks on the run
  that produced these files; F02 and F04 byte sizes match the
  builder's independent run exactly, so the captures are
  deterministic).

## The numbers behind the frames (Step 14 build, re-verified here)

- Fog sea rows, fog over base composites measured by
  tools/fog-check.js: live 84.9 (band 60 to 150), remembered 143.8
  (band 120 to 175), dark 205.5 (band 185 to 225). All three bands
  pass, in seed 42 and in the fixture.
- This run, on the final tree: sim suite 191 pass, presentation
  suite 90 pass, balance byte identical to
  tools/baseline-cycle22.txt, fog check 27 of 27, graticule 18 of
  18, chart 13 of 13, labels 21 of 21, dash scan zero on text files.

## The MAP-TGT side by side cannot be produced yet

MAP_TREATMENT 7.1 names MAP-TGT (the R0 rendition, a whole map style
target generated from the master sheet) as the reference for this
review's drift check. MAP-TGT does not exist in this repo: there is
no art-direction/briefs folder and no R0 rendition has ever been
produced; R0 stays queued through the browser lane when the daily
cap allows. The treatment itself states R0 blocks no build step, and
Steps 9 to 14 were built to its hex values. This package therefore
compares the board against the treatment's own acceptance sentences
and band numbers, not against a target image, and invents no
substitute reference. When R0 lands, the drift check is a small
follow-up: place MAP-TGT beside F02 and F06 and record where the
board drifts from it.

## Honest observations from reading the frames

- The three fog states do read apart at a glance, in colour and in
  gray: full colour and relief in sight, faded hatch for last seen,
  flat paper for Unknown, and the Unknown sea margin carries its
  water lines on paper as prescribed.
- The DOM tile chips still print over Unknown provinces: names,
  Steel counts, and Coast tags are visible on the paper east in F02.
  The fog layer hides military fact on the canvas and gates the
  inspector and the attack preview; the tile chip layer was never
  part of Step 14's scope. Whether Unknown should hide the chips too
  is a fog scope question for the ruling below, not a Step 14 defect
  against its spec.
- The red diagonal striping across the west in F02 is the existing
  out of supply tile pattern, not fog and not part of this review.
- Relief reads as soft mottled ground more than as lit slopes
  (Step 11 recorded the same, partly the RES 16 upscale). That is
  exactly the judgment the first ruling below asks for.

## Rulings asked of Jash (recorded in DECISIONS_FOR_JASH.md)

1. Relief verdict (MAP_TREATMENT 7.5, RX trigger 1): do the hills in
   F02 and F04 look flat, computer drawn, or fake to you? A yes fires
   the RX01 and RX02 Blender micro relief tiles at Step 19. A no
   keeps code relief as shipped.
2. Fog scope: should Unknown also hide the DOM tile chips (Steel,
   Coast, names), or is paper with the region's ink and chips an
   acceptable chart convention?
3. P-MT1 (from Step 12c, still open): the ownership wash stays at
   FILL_ALPHA 0.06 until you rule on the 0.14 captures in
   art-direction/storyboard/step-12c.

Until Jash rules, the shipped values stay in force and the loop
moves on to Step 15 (plaques on the live board, already built early
as Cycle 23 Step 9 in the item 28 numbering; the treatment sequence
continues at Step 16, attack beats).
