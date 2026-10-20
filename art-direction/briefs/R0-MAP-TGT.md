# R0-MAP-TGT.md v1

Staged rendition session brief, shaped by VISUAL_STRATEGY.md section 3.8.

| Field | Value |
|---|---|
| Session id | R0 |
| Family | MAP-TGT (the one board level style target, MAP_TREATMENT.md 7.1) |
| Requests | 4 candidates, each in a new temporary ChatGPT chat |
| Needed by | MAP_TREATMENT Step 18 (master sheet v2 takes its P6 crop from the R0 winner) |
| Parent | master sheet v1: art-direction/master-diorama-board.png |
| Brief version | v1 (no regeneration changes) |

MAP-TGT is a style target only: never drawn, never sampled, never shipped (MAP_TREATMENT 7.1 and Section 9, C1). No pixel of any R0 output ever enters assets/ or the game.

## Attachments (every request, in this order)

1. art-direction/master-diorama-board.png

Nothing else (MAP_TREATMENT 7.1: the master sheet v1 and nothing else).

Note: this repo has no art-direction/master-sheet.png file yet. MAP_TREATMENT 7.1 and VISUAL_STRATEGY 0.3 name that path, but master sheet v1 is the adopted diorama alone (VISUAL_STRATEGY 2.1), so the file above is the v1 master and is the one to attach.

## Request text (identical for all four requests)

The text below is the VISUAL_STRATEGY 3.1 style preamble verbatim, followed by the MAP_TREATMENT 7.1 request paragraph verbatim (the placeholder "[VISUAL_STRATEGY 3.1 preamble, verbatim]" in 7.1 is resolved to the preamble itself). Paste it exactly as one message, with no changes:

```
Use the attached master sheet as the only style reference. A lamplit war table: handmade tabletop miniatures of painted pewter, wood, paper, and ink, under one warm lamp from the upper left. Soft contact shadows. Muted paper and ink tones. Faction paint is flat Vessari blue exactly as on the master sheet. Absolutely no text, letters, numbers, symbols, logos, labels, or user interface anywhere in the image. Subject: the board in the master sheet remade as a printed and hand colored chart of one continent, seen straight down, filling the frame. The continent is wider than tall. Its north and south shores are coast with shaded shallow water stepping down to deeper sea, thin engraved water lines parallel to the coast, and a few tiny wave marks in the open sea. Its west and east edges also end in coast after a strip of land. One river rises in low hills near the middle of the continent and flows north to the sea and south to the sea, wider near each mouth. Soft hill shading lit from the upper left with a few faint contour lines; no mountains, no peaks, no snow, no forests. Fine dashed borders divide the land into many small provinces of similar size. The land on the left has a thin Vessari blue ribbon along its borders, the land on the right a thin Khessite red ribbon, and a single black line runs down the river where the colors meet. A plain latitude and longitude grid of thin lines across land and sea, and a narrow chart border with alternating black and paper degree bars, with no numbers. Muted olive and ochre land, gray green blue sea, warm paper border. Absolutely no text, letters, numbers, labels, compass rose, or user interface. Wide 4:3 image.
```

## Requests (priority order)

| # | Chat | Attachments | Text | Output name |
|---|---|---|---|---|
| 1 | new temporary chat | art-direction/master-diorama-board.png | request text above | R0-MAP-TGT-c1.png |
| 2 | new temporary chat | art-direction/master-diorama-board.png | request text above | R0-MAP-TGT-c2.png |
| 3 | new temporary chat | art-direction/master-diorama-board.png | request text above | R0-MAP-TGT-c3.png |
| 4 | new temporary chat | art-direction/master-diorama-board.png | request text above | R0-MAP-TGT-c4.png |

## Output naming and location

- Download every output unmodified, including any that look wrong.
- Name each R0-MAP-TGT-c<k>.png for k 1 to 4.
- Final location: art-direction/renditions/MAP-TGT/ (the Drive conveyor AshesOfEmpires/inbox/renditions/YYYY-MM-DD/ may carry them there, VISUAL_STRATEGY 3.8 step 3).
- Every output is logged in art-direction/asset-log.jsonl, rejects included (VISUAL_STRATEGY 2.3 rule 7).

## Selection gates (MAP_TREATMENT 7.1)

- R-a No text: any letter, numeral, symbol, logo, label, or UI element rejects.
- R-g On master: the drift check (VISUAL_STRATEGY 2.3 rule 8) answers yes; no dominant hue outside the palette families plus neutral metal and wood.
- R-m Thumbnail read (Claude Design rules on it): at thumbnail size, 256 px wide, the image shows land and sea as different things, the river reaches the sea, and the ribbons read as ownership without solid fills.

After selection the winner is logged as MAP-TGT-R0-cN, with parent master-sheet-v1. It then becomes the reference for the Step 14 drift check and Jash's map review, and the source of the master sheet v2 P6 crop (MAP_TREATMENT 7.2).

## Session rules (VISUAL_STRATEGY 3.8)

- If the daily cap is hit, stop and write the time in this brief file under "Session notes". The remaining requests carry to the next day in the same order.
- No rewording, no re-rolls, and no added requests outside the count of 4. If something looks wrong, note it below; Claude Design decides.

## Session notes

- 2026-10-20 (build loop, Step 18b partial): candidate 1 generated in a new temporary chat and downloaded (.webp) on the browser host; no daily cap was hit and no sign-in wall appeared. The download is not reachable from the build VM and a Drive upload attempt failed in the browser host's file picker, so candidate 1 is not in the repo yet and no selection was made. Candidate 2's generation was interrupted by a browser session drop before download. Resume order: solve the conveyor for candidate 1 first, then resume at candidate 2. Full record in CYCLE_LOG, Step 18b PARTIAL entry.
- 2026-10-20 (build loop, Step 18b conveyor retry): the conveyor could not be solved because candidate 1 is not on the browser host the lane can reach (no ChatGPT .webp in its Downloads; the orchestrator's VM search also found nothing), and the browser's Google session has expired behind a one time code wall. Candidate 1 is treated as lost. Resume order, changed: first a human sign-in in the live browser, then restart R0 at candidate 1, and prove the Drive conveyor inside the same session (upload each candidate to AshesOfEmpires/inbox/renditions/YYYY-MM-DD/ and have the orchestrator confirm it in Drive) before requesting the next candidate. Full record in CYCLE_LOG, Step 18b conveyor retry entry.
