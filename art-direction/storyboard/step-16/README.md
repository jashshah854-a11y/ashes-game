# Step 16: checkpoint 1 package (attack beats)

MAP_TREATMENT Step 16 closes the attack beat work: Step 16a put the
state light on the live board, and this package is the checkpoint 1
review surface for it (old VISUAL_STRATEGY Step 10: Jash reviews the
contact sheet). The acceptance sentence is judged on these close-ups
below. Nothing in this package changes any code.

## What is in this folder

- F05-beat0.png: beat 0, the attack declared. The staged board at
  zoom 2, paused on day 1 before the tick: the Vessari (blue) infantry
  plaque at Torford reads 1x12, the Khessite (black and red) infantry
  plaque at Kharmund reads 1x12, and Kharmund carries the order badge
  (Order: Inf ordered here at dawn) that marks it as the target. No
  edge is lit.
- F05-beat1.png: beat 1, the peak flash. One day tick later, phase 1
  of the beat held: the pale gold state light runs down the shared
  Torford and Kharmund border (the river edge at the centre of the
  frame) and nowhere else. The fight is already resolved on the
  plaques: Torford's plaque is gone, and Kharmund's reads 1x2.
- F05-beat2.png: beat 2, the settle. Phase 2, the fade, same frame:
  the light is dimmer on the same edge, the counts stay final.
- F05-beat0-gray.png, F05-beat1-gray.png, F05-beat2-gray.png: luma
  copies (orchestrator, python PIL). The light reads on value alone:
  a bright band on the one edge in beat 1, fainter in beat 2, absent
  in beat 0.
- contact-sheet.png: all six images in one sheet, colour on top,
  gray below, each cell labelled.
- Made by tools/beat-capture.js (40 of 40 checks on the run that
  produced these files; the three colour frames' byte sizes match
  the builder's independent self-test exactly, so the captures are
  deterministic).

## The staged attack, stated plainly

The storyboard F05 fixture (the first attack event after tick 300)
does not exist as a fixture in this repo. Like the F04 stand-ins in
Steps 12c and 14b, this package uses a stand-in: the exact staged
attack tools/beat-check.js already proves. Seed 42 is reduced to one
Vessari infantry group at Torford (strength 12) ordered into
Kharmund, held by one Khessite infantry group (strength 12), both
interceptor stocks at 0, imported through the real save path. One
tick resolves the fight: the battle record is battle at p5_3,
player against enemy, with the 25 percent river crossing penalty on
the attacker. The war log line reads: A Vessari attack group is
destroyed at Kharmund. The attacker is destroyed outright, the
defender drops from 12 to 2, and Kharmund stays Khessite.

So the result a player reads off these frames is: my group attacked
across the river into Kharmund, the light flashed on that border,
and my group is gone while the defender holds at 1x2. The old Step
10 wording said beat 2 shows both updated counts; here one side's
updated count is its absence, which is the honest shape of this
fight, and the frames show exactly that.

## The numbers behind the frames (tools/beat-capture.js)

- Page beat edges deep equal the node derivation: exactly one edge,
  p4_3 to p5_3. The control edge (p9_5 to p9_6, the farthest unlit
  chart edge) samples alpha 0 in every phase.
- Beats canvas alpha at the attacked edge midpoint: 0 at beat 0,
  246 at phase 1, 135 at phase 2, 0 again after the 900 ms callback.
  BEAT_COLOR #FFF3C4 sits in the State lights band (Step 16a).
- Plaques in the DOM: 1x12 and 1x12 before the tick; no plaque at
  Torford and 1x2 at Kharmund after it. Both plaques are proven
  inside the frame by the tool's rect assertions, not just present
  somewhere on the page.
- This run, on the final tree: sim suite 191 pass, presentation
  suite 104 pass, balance byte identical to
  tools/baseline-cycle22.txt, beat check 18 of 18, dash scan zero
  on text files.

## How the frames were taken (two harness techniques, disclosed)

- Phase freeze: a beat lives 900 ms (phase 1 for 300 ms, phase 2
  for 600 ms), too fast to screenshot reliably. The tool holds the
  game's own 300 and 900 ms phase callbacks (captured through a
  window.setTimeout wrapper armed only around the tick) and invokes
  them in order between screenshots. No frame is altered, only
  held; the alphas above are sampled on the held frames.
- Panned framing: the captures are page screenshots clipped to the
  map viewport at zoom 2, framed by setting the viewport's
  scrollLeft so the attacked edge sits at the horizontal centre
  (scrollLeft 431 of 1784; the midpoint lands 0.2 px from the clip
  centre). The first build of this tool screenshotted the board
  element instead, and its right half showed the side panel, because
  the viewport clips the zoomed board; those frames were discarded.

## A finding this step surfaces: no pan at zoom

At zoom above 1 the map viewport clips the board (overflow hidden)
and the game offers no pan or scroll control, so a player zoomed to
200 percent cannot bring the eastern half of their own board into
view at all. The harness could pan only because it set the
viewport's scroll position directly. On the default zoom 1 board
everything is visible, so no shipped view is broken; the gap opens
only when a player zooms in, which is exactly when they want to read
a fight like this one up close. This package does not fix it and
does not hide it: it is recorded in BACKLOG and in
DECISIONS_FOR_JASH.md item 33 for Jash's ruling on whether a pan
step joins the sequence ahead of Step 17.

## Honest observations from reading the frames

- The acceptance sentence holds on the close-up: in beat 1 the
  state light lies only on the attacked edge, and a reader can say
  who attacked whom across which border (Vessari out of Torford,
  across the river, into Kharmund) and what the result was (the
  attacker destroyed, the defender at 1x2), from the three frames
  together.
- The other pale bars in the frames are the finished railroad bars,
  present identically in all three beats including beat 0; the beat
  light is the brighter, wider band on the river edge itself.
- In beat 0 the order badge at Kharmund sits partly under the
  defender's plaque (both are centred on the province). The plaque
  numeral stays fully readable and the badge's first line is cut by
  the plaque; recorded here as a cosmetic overlap, the same class
  as the plaque and name overlap Step 9 recorded.
- The out of supply hatching in the west (red diagonal stripes) is
  the existing tile pattern, unrelated to the beat.

## The verdict asked of Jash (DECISIONS_FOR_JASH.md item 33)

Checkpoint 1: do these three frames read the way the bible wants a
fight to read (who attacked whom, across which border, what the
result was, inside one beat)? And separately: should a zoom pan
step be added to the sequence ahead of Step 17 (atmosphere), or
does the pan gap wait for a later cycle? Until Jash rules, the
loop moves on to Step 17 as sequenced.
