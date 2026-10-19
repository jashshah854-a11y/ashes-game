# Step 12c: P-MT1 A and B captures (for Jash's ruling)

Proposal P-MT1 (MAP_TREATMENT.md section 5.3): raise the ownership wash
FILL_ALPHA from 0.06 to 0.14 so a province deep inside a territory reads
its owner from the wash, not only from the border ribbons. Not in force.
These captures are the A and B pair the proposal asks for.

- A-0.06-F02.png and A-0.06-F04.png: the game as shipped, FILL_ALPHA 0.06.
- B-0.14-F02.png and B-0.14-F04.png: the same boards from a scratch copy
  whose only change is that one constant at 0.14. The shipped tree still
  draws 0.06.
- contact-sheet.png: the four captures in one image, A on the left,
  B on the right, F02 on top, F04 below.
- F02 is the opening board: fresh game, seed 42, day 1, paused
  (43 ownership fills, 7 front edges).
- F04 here is the committed worst case fixture (tools/fixture/worst-case.json,
  day 146, a contested front board: 46 fills, 12 front edges, drone wings
  on both sides), imported through the real save path. It stands in for
  the mid-war front frame; it is not a separate storyboard fixture, and
  none exists yet.
- Made by tools/fill-capture.js (run on both trees). Each run prints the
  FILL_ALPHA it captured: A runs printed 0.06, the B run printed 0.14.
- Measured difference (orchestrator, python PIL on these files): pixels
  differing by more than 8 in any channel are 27.7 percent of F02 and
  29.1 percent of F04. A state canvas centre sample carries alpha 15 of
  255 at 0.06 and 36 of 255 at 0.14.
- Reading note: the red diagonal striping across the west in both F02
  captures is the existing out of supply tile pattern, identical in A
  and B. It is not part of this comparison.
- Jash's ruling is recorded in DECISIONS_FOR_JASH.md. Until he rules,
  0.06 stays in force and no code changes.
