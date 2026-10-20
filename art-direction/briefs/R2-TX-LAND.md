# R2-TX-LAND.md v1

Staged rendition session brief, shaped by VISUAL_STRATEGY.md section 3.8.

| Field | Value |
|---|---|
| Session id | R2 |
| Family | TX-LAND (TX01 read as TX-LAND, MAP_TREATMENT.md 7.4) |
| Requests | 4 candidates (MAP_TREATMENT 8.2), each in a new temporary ChatGPT chat |
| Needed by | MAP_TREATMENT Step 18, the TX-LAND bake-off |
| Parent | master sheet v2 plus its P6 crop (MAP_TREATMENT 7.2) |
| Brief version | v1 (no regeneration changes) |

## Ordering (read before booking)

This session cannot run yet. Its parent is master sheet v2, and v2's P6 panel is a 768 by 768 crop of the selected MAP-TGT rendition. So the order is:

1. R0 (MAP-TGT) runs and a winner is selected and logged as MAP-TGT-R0-cN.
2. Master sheet v2 is assembled with the P6 crop taken from that winner (art-direction/master-sheet/v2/manifest.json tracks the panels).
3. Only then does R2 run, attaching master sheet v2 and the P6 crop.

## Attachments (every request, in this order)

1. The master sheet v2 image (path fixed when v2 is assembled in Step 18; not on disk yet).
2. The P6 crop from that same master sheet v2 (768 by 768 MAP-TGT crop centred on the river and one coast).

Nothing else (VISUAL_STRATEGY 2.3 rules 1 and 2).

## Request text (identical for all four requests)

Built from the VISUAL_STRATEGY 3.4 texture pattern: the 3.1 style preamble verbatim, then the pattern sentence with SURFACE set to the TX-LAND surface from MAP_TREATMENT 7.3. Paste it exactly as one message, with no changes:

```
Use the attached master sheet as the only style reference. A lamplit war table: handmade tabletop miniatures of painted pewter, wood, paper, and ink, under one warm lamp from the upper left. Soft contact shadows. Muted paper and ink tones. Faction paint is flat Vessari blue exactly as on the master sheet. Absolutely no text, letters, numbers, symbols, logos, labels, or user interface anywhere in the image. A top-down seamless texture of painted chart paper ground, very fine grain and brush mottling, no features as it looks on the board in the master sheet. Flat even light, no cast shadows, no objects, no horizon, no edges or borders. Square image. Fill the whole frame.
```

## Requests (priority order)

| # | Chat | Attachments | Text | Output name |
|---|---|---|---|---|
| 1 | new temporary chat | master sheet v2, then P6 crop | request text above | R2-TX-LAND-c1.png |
| 2 | new temporary chat | master sheet v2, then P6 crop | request text above | R2-TX-LAND-c2.png |
| 3 | new temporary chat | master sheet v2, then P6 crop | request text above | R2-TX-LAND-c3.png |
| 4 | new temporary chat | master sheet v2, then P6 crop | request text above | R2-TX-LAND-c4.png |

## Output naming and location

- Download every output unmodified, including any that look wrong.
- Name each R2-TX-LAND-c<k>.png for k 1 to 4.
- Final location: art-direction/renditions/TX-LAND/ (the Drive conveyor AshesOfEmpires/inbox/renditions/YYYY-MM-DD/ may carry them there, VISUAL_STRATEGY 3.8 step 3).
- Every output is logged in art-direction/asset-log.jsonl, rejects included, with parent master-sheet-v2.

## Selection gates (VISUAL_STRATEGY 3.7)

- R-a No text: any letter, numeral, symbol, logo, label, or UI element rejects.
- R-h Seamless: offset the texture by half its width and height; the seam cross is not visible at 100 percent zoom; a 3 x 3 tile shows no repeating feature visible at default zoom.

## Bake-off scoring (MAP_TREATMENT 7.4, VISUAL_STRATEGY 6.3 rule otherwise unchanged)

- Candidate A: the best R2 rendition, made seamless by the builder.
- Candidate B: a Blender material remade from that same rendition and baked through CAM_TEX at 1024 px.
- Each candidate scores 0 or 1 on each of:
  - R-h seamless;
  - band report in F02 for all three fog states;
  - F02-gray plaque battery at 100 percent;
  - size 250 KB or less as WebP.
- The higher total wins. A tie goes to B.
- The winner sets the route for TX-SEA, TX-PAPER, TX-FOG-UK, and TX-FOG-LS at Step 19.

## Application spec (MAP_TREATMENT 7.3)

| Applied as | Clamp |
|---|---|
| pattern over the land path, globalCompositeOperation 'soft-light', alpha 0.35 | land band report still 60 to 150 |

## Session rules (VISUAL_STRATEGY 3.8)

- If the daily cap is hit, stop and write the time in this brief file under "Session notes". The remaining requests carry to the next day in the same order.
- No rewording, no re-rolls, and no added requests outside the count of 4. If something looks wrong, note it below; Claude Design decides.

## Session notes

(none yet)
