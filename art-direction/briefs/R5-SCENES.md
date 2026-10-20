# R5-SCENES.md v1

Staged rendition session brief, shaped by VISUAL_STRATEGY.md section 3.8.

| Field | Value |
|---|---|
| Session id | R5 |
| Families | SC-TTL (title scene, 3 candidates), TF (table frame, 2 candidates) |
| Needed by | MAP_TREATMENT Step 21b (interim title F01, VISUAL_STRATEGY Step 15 row); TF winner is a remake target for the final title step only |
| Parent | master sheet v2: art-direction/master-sheet/v2/master-sheet-v2.png |
| Renderer | Muse media pipeline on the build VM, per DECISIONS item 37 (extends item 36 to R5) |
| Brief version | v1 (no regeneration changes) |

SC-TTL interim use, stated plainly (VISUAL_STRATEGY 7.1): a rendition may reach the runtime in exactly one place, outside the map: the interim title background. The selected SC-TTL candidate is copied to assets/scenes/ with its own admitted log line at Step 21b-3 and retired when the Blender title replaces it at the final title step. The TF winner is reference only and is never wired into the build (item 37 safeguard 5); TF interim is already built as a code frame (Step 21a).

## Attachments (every request, in this order)

1. art-direction/master-sheet/v2/master-sheet-v2.png
2. The family panel crop from the same master sheet: art-direction/master-sheet/v2/panels/P10.png for SC-TTL (scene keys), art-direction/master-sheet/v2/panels/P9.png for TF (the lamp at night).

Nothing else (VISUAL_STRATEGY 2.3 rule 1: the current master sheet first, then at most one crop of the panel for that family).

## Request text, SC-TTL (identical for all three requests)

The text below is the VISUAL_STRATEGY 3.1 style preamble verbatim, then the section 3.6 scene lead verbatim, then the section 3.6 SC-TTL cell text verbatim, then the section 3.6 closing. Paste it exactly as one message, with no changes:

```
Use the attached master sheet as the only style reference. A lamplit war table: handmade tabletop miniatures of painted pewter, wood, paper, and ink, under one warm lamp from the upper left. Soft contact shadows. Muted paper and ink tones. Faction paint is flat Vessari blue exactly as on the master sheet. Absolutely no text, letters, numbers, symbols, logos, labels, or user interface anywhere in the image. Photographic macro detail, physically plausible materials, shallow depth of field. The war table at night seen from a low angle at the table edge. The diorama board from the master sheet in the middle distance, slightly out of focus. A brass lamp at upper left. The upper third is dark empty shadow. Wide 16:9 image.
```

## Request text, TF (identical for both requests)

Same construction, with the section 3.6 TF cell text verbatim:

```
Use the attached master sheet as the only style reference. A lamplit war table: handmade tabletop miniatures of painted pewter, wood, paper, and ink, under one warm lamp from the upper left. Soft contact shadows. Muted paper and ink tones. Faction paint is flat Vessari blue exactly as on the master sheet. Absolutely no text, letters, numbers, symbols, logos, labels, or user interface anywhere in the image. Photographic macro detail, physically plausible materials, shallow depth of field. Straight top-down view of the edge of the war table: dark wood, a brass corner fitting, the paper edge of the board, lamp light from upper left. The center is plain flat gray where the map will go. Wide 16:9 image.
```

## Requests (priority order)

| # | Family | Attachments | Text | Output name |
|---|---|---|---|---|
| 1 | SC-TTL | master v2, P10 | SC-TTL text above | R5-SC-TTL-c1.png |
| 2 | SC-TTL | master v2, P10 | SC-TTL text above | R5-SC-TTL-c2.png |
| 3 | SC-TTL | master v2, P10 | SC-TTL text above | R5-SC-TTL-c3.png |
| 4 | TF | master v2, P9 | TF text above | R5-TF-c1.png |
| 5 | TF | master v2, P9 | TF text above | R5-TF-c2.png |

## Output naming and location

- Every output lands unmodified in art-direction/renditions/<family>/, named as above (the media pipeline route lands files directly in the repo, so the conveyor rule is met by construction).
- Every output is logged in art-direction/asset-log.jsonl, rejects included (VISUAL_STRATEGY 2.3 rule 7).

## Selection gates (VISUAL_STRATEGY 3.7)

- R-a No text: any letter, numeral, symbol, logo, label, or UI element rejects. Applies to all.
- R-f Buildable (scenes): every part is a primitive, a bevelled block, a lathe, or a simple sculpt; nothing melted, impossible, or ambiguous. Applies to SC-TTL (and TF as a scene).
- R-g On master: the drift check (VISUAL_STRATEGY 2.3 rule 8) answers yes; no dominant hue outside the palette families plus neutral metal and wood. Applies to all.
- SC-TTL extra, from F01: the upper third is dark empty shadow (reserved for the code wordmark), the board sits in the middle distance slightly out of focus and shows no readable state (no plaques, no numerals, no front line), one brass lamp at upper left.
- Choosing among passing candidates: Claude Design's eye, on composition for the F01 layout (dark upper third, board in middle distance, buttons zone in the lower third uncluttered).

## Session rules (VISUAL_STRATEGY 3.8 and DECISIONS item 37)

- No rewording, no re-rolls, and no added requests outside the counts of 3 and 2. If something looks wrong, note it below; Claude Design decides.
- If no candidate in a family passes the gates, nothing is regenerated in this session; the VISUAL_STRATEGY 3.7 fallback governs in a later run.

## Session notes

- Staged 2026-10-20 by the build loop (Cycle 23 Step 21b-1). The orchestrator's string comparison at staging time returned true for the preamble on both texts and for both section 3.6 cell texts against VISUAL_STRATEGY.md.

- 2026-10-20 (build loop, Step 21b-1, under DECISIONS item 37): SC-TTL requests 1 to 3 ran through the Muse media pipeline on the build VM, master sheet v2 plus the P10 crop attached to each, the brief text above verbatim, all 3 candidates landed directly in art-direction/renditions/SC-TTL/ at 2048x1152 (the conveyor rule is met by construction). Selection by the orchestrator from the files at full size: c2 SELECTED as R5-SC-TTL-c2 (gates R-a, R-f, R-g pass; darkest emptiest upper third, mean luma 5.0 on the right 75 percent; clean lower third), c1 and c3 rejected on F01 composition with gates passing, all logged in art-direction/asset-log.jsonl. No rewording and no re-rolls were used; the SC-TTL count of 3 is complete. TF requests 4 and 5 remain for Step 21b-2.
