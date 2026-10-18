# Cycle 17 Step 0 - Legibility Audit

## 1. Scope and F1 confirmation

This is the Cycle 17 Step 0 legibility audit, audit only, no code changed. Standing rules: zero sim change this cycle unless a step is an explicit balance slice; new state lives outside the sim payload; legibility proof in later steps is a real browser DOM assertion. The F1 confirmation, rechecked by the orchestrator this run: exactly one commit in Cycle 16 touches js/sim.js, ac28bee (Cycle 16 Step 1); git diff numstat over the cycle for js/sim.js is 25 insertions and 3 deletions; the 28 in the judge package was the churn figure (25 plus 3), not insertions; all 25 insertions are Step 1 items (the canonical engagementKey builder and audit comment, 3 call sites, 3 export lines) and all 3 deletions are the inline key expressions they replaced; the cycle total of 6 deletions reconciles as js/sim.js 3, js/main.js 1, BACKLOG.md 2. Disposition: F1 closed, no revert owed.

## 2. First session walk

| Touch point | Element (file and line) | What the player sees | What they must know to act | Explained at that moment (Yes, Partial, or No) | Gap and owner |
|-------------|-------------------------|----------------------|----------------------------|-----------------------------------------------|---------------|
| 1. Start screen or nation pick | index.html lines 9 to 22 (header), js/main.js line 86 (newGame), line 1451 (newGame called on load), line 66 (startTimer) | title, subtitle naming both nations, Day 1 of 150, and the war already running; there is no start screen and no nation pick, the player is always the Vessari Compact | who they are, that the goal is to take the enemy capital before the campaign ends, and that losing their own capital loses the war | Partial | Closed in Cycle 17 Step 1 by tools/first-touch-check.js: the start statement in index.html now states identity, goal, and lose condition. |
| 2. First map view | index.html line 28 (map), lines 29 to 38 (intel legend), lines 39 to 47 (hint), js/main.js line 325 (renderMap) | colored province tiles with names, steel values, badges, unit chips, and bars | what each color, badge, chip, and bar means | Partial | Closed in Cycle 17 Step 1 by tools/first-touch-check.js: the map legend in index.html now explains every map mark in plain words. |
| 3. Pause and speed controls | index.html lines 17 to 19, js/main.js lines 1341 to 1358 (handlers), lines 66 to 76 (startTimer, 900 ms at speed 1 and 300 ms at speed 2) | Pause, Speed 1x, Speed 2x buttons; Pause toggles to Resume | the game runs in real time, pause freezes the days, the speeds change the pace of days, and orders can be given while paused or running | Partial | Closed in Cycle 17 Step 1 by tools/first-touch-check.js: the controls explanation in index.html now covers real time, pace, Pause and Resume, and orders while paused. |
| 4. First production line | index.html lines 88 to 105 (production card), js/main.js line 608 (renderProduction) | per line, the template, steel over days at current efficiency against base days, manpower paid when queued, queue count and cap, efficiency lines, a summary, and a long explain paragraph covering drain, stalls, deployment at the capital, stockpile templates, efficiency, retool loss, and manpower | cost, time, where a finished unit appears, stall and retool rules, and how locked lines open | Yes | none |
| 5. First factory | index.html lines 108 to 120 (province card), js/main.js line 856 (renderProvinceCard) and lines 900 to 903 (the province explain) | factory level of max, a build button with its equipment cost or its need and have wording, and the explain sentence that factories turn steel into equipment every day and produce more at higher levels, plus the line unlock text | a factory level produces 5 equipment per day and consumes 2 steel per day (js/sim.js CFG, steelPerFactoryLevel 2 and equipPerFactoryLevel 5), and that factory levels gate production lines | Yes | Closed in Cycle 17 Step 2 by tools/core-loop-check.js: the factory per level numbers are now on the province card. |
| 6. First division (first unit) | index.html lines 122 to 125 (unit card), js/main.js line 970 (renderUnitCard) | for a clicked unit, its label, strength of max, attack and defense, build cost, supply state, stationed province, and any order | what strength means in a fight, that several units in one province fight together as one stack, and what the map chip shorthand means | Yes | Both halves are now closed: the chip legend half in Cycle 17 Step 1 by tools/first-touch-check.js, and the stacking sentence in Cycle 17 Step 2 by tools/core-loop-check.js. |
| 7. First move or attack order | index.html lines 39 to 47 (hint), js/main.js line 1319 (onProvinceClick), line 970 onward (the attack preview) | a highlighted neighbor set, and a rich preview with stack power, fort, river, drone, EW, and interceptor lines | an order executes on the next tick (at dawn), moves one province, and that a unit ordered elsewhere stays to defend its own province if an enemy column marches on it that day | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: order timing and the stays home rule stated in the map hint before the first order. |
| 8. First frontline bend | js/main.js line 325 (renderMap owner colors), js/sim.js line 1953 (capture log line) | a captured province tile changes color, and the war log records the capture | that the front has moved and which province changed hands today | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: frontline naming, tile color change, and war log province name all stated in the map hint. |
| 9. First battle result | index.html lines 175 to 178 (war log), js/main.js line 1096 (renderLog), js/sim.js lines 1905 to 1953 (outcome log lines) | outcome lines only, such as capture after a hard fight, repelled, or a group destroyed, among the last 12 log entries | who won, why, and what was lost and what changed | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: battle result why (higher stack power) and losses (destroyed chip disappears, survivors lower strength) stated in the log explain paragraph. |
| 10. First event | index.html lines 181 to 199 (event overlay), js/main.js line 1168 onward (showNextCard) and line 1197 (closeCard) | the card, a why line with trigger and day, the printed sentence that it changes nothing in the game, a The game is paused label, and Continue and Codex buttons | that the card changes nothing in the game, that the war stays paused until they press Continue, and that a second card from the same day may follow | Yes | none for legibility. Whether every card should hard pause is a taste question, PARKED (DECISIONS_FOR_JASH.md item 10) |
| 11. First drone exchange row | index.html lines 146 to 161 (exchange card), js/main.js line 534 (renderExchange) | both nations rows in steel, a headline naming who is bleeding faster, and an explain line with the net formula and the drone and interceptor steel costs | destroyed and lost are the steel values of the units each side destroyed and lost | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: destroyed and lost definitions, both nations rows wording, and end screen 1 point per steel all stated in the exchange explain. |
| 12. First EW encounter | index.html lines 72 to 84 (generation rows and research explains), js/main.js line 1049 onward (preview effectiveness lines) | drone and jamming generation numbers, research explains, and in the preview an effectiveness percent with the two generation numbers that produced it | effectiveness is 100 plus 25 per generation of advantage, clamped between 50 and 150 (js/sim.js CFG ewStepPct 25, ewFloorPct 50, ewCapPct 150) | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: the EW effectiveness rule built from CFG values (100, ewStepPct, ewFloorPct, ewCapPct) stated on the research jamming explain. |
| 13. Rail supply encounter | index.html lines 43 to 47 (hint), js/main.js lines 879 to 887 (province supply line), lines 984 to 990 (unit supply text), line 950 (renderRailActions) | off net hatching, a supply line with hops of 10 from the capital or the not supplied reason, out of supply penalty percent on the unit card, and rail build buttons with steel cost and days | a unit out of supply weakens daily, and attrition starts after a grace of 3 days (js/sim.js line 163, supplyGraceDays 3) | Yes | Closed in Cycle 17 Step 3 by tools/battle-systems-check.js: supply grace length (3 days from CFG.supplyGraceDays) stated in the map hint and the unit card supply text. |
| 14. Intel fog encounter | index.html lines 29 to 38 (intel legend), js/main.js line 856 onward (province card intel branches) and line 313 (ghostChips) | the three fog states explained in the legend, a province card that states live with its day, remembered with its snapshot day and that figures may have changed, or dark with what is not known, plus how to reveal each | which of the three sight states a province is in, how old remembered figures are, and how to make a hidden province live | Yes | none |
| 15. Save card | index.html lines 163 to 174, js/main.js lines 1391 to 1447 (slot and file handlers) and line 140 (loadFromText) | an explain paragraph (a save records the whole campaign, captures a whole tick, one browser slot, a file copy survives cleared browser data, a failed load shows its reason and the current game keeps running) and notices after each action, including a Loaded notice with day, nation, and seed after a load, plus the save contents paragraph, the slot metadata line, and the replace warning added in Cycle 17 Step 4 | what a save contains, what save is currently in the slot (its day and nation) before loading it, and that loading replaces the current game | Yes | Closed in Cycle 17 Step 4 by tools/save-hardening-check.js: the contents list, slot metadata, and replace warning are now shown on the save card, and G2 (file import hardening) and G3 (the saveVersion rejection message) are closed in the same step. |
| 16. End screen | index.html lines 48 to 56 (banner), js/main.js line 251 (showBanner) | victory or defeat, the reason, the end day against the 150 day campaign, both nations full scoring breakdowns with the weight of every row, a margin line, an explain paragraph, and a New Game button | whether they won or lost and why, the final day, how each score row is earned, and how the two totals compare | Yes | none for legibility. Taste items about this screen are PARKED (DECISIONS_FOR_JASH.md item 15) |

## 3. Interactive element audit

Count method, stated exactly: static interactive elements are the button and input tags in index.html, counted by tag search (20 buttons and 1 input, 21 total); dynamic interactive element types are the distinct button creation sites in js/main.js (7). One row per element, 28 rows total, count matches 21 plus 7 equals 28. The export download anchor created at js/main.js line 1425 is excluded with its reason: it is a programmatic download trigger clicked by code, never presented to or clicked by the player.

Static rows (id, index.html line):
- btn-pause 17: toggles pause and resume
- btn-speed1 18: sets speed to 1x and restarts timer
- btn-speed2 19: sets speed to 2x and restarts timer
- btn-codex 20: opens the codex panel
- btn-new 21: starts a new game
- btn-end-new 54: starts a new game from the end screen
- btn-research 79: researches Drone Gen 2, bought at once on click
- btn-research-gen3 81: researches Drone Gen 3, bought at once on click
- btn-research-jamming 83: researches the next jamming generation, bought at once on click
- btn-factory 112: builds or upgrades a factory
- btn-fort 113: builds a fortification
- btn-agent 114: plants an agent
- btn-flotilla 115: deploys a flotilla
- btn-save-slot 168: saves to the browser slot
- btn-load-slot 169: loads from the browser slot
- btn-export 170: exports save to a file
- btn-import 171: opens file picker for import
- save-file-input (input) 173: file input for save import
- btn-event-codex 195: opens codex from event card
- btn-event-continue 196: closes event card and resumes
- btn-codex-close 208: closes the codex panel

Dynamic rows (type, js/main.js creation line):
- province tile button, line 347 (click listener line 393): selects a province and shows its card
- production Queue button, line 678: queues a unit on that production line
- production Retool button, line 690 (one per other template): retools the line to another template
- rail build button, line 958: builds or extends rail from this province
- codex history entry button, line 1224: selects a history article in the codex
- codex turning point entry button, line 1246: selects a turning point article in the codex
- codex texture entry button, line 1271: selects a texture article in the codex

## 4. Core loop chain audit

| Link | Upstream | Downstream | Verdict | Notes |
|------|----------|------------|---------|-------|
| 1 | factories | production lines and equipment | Shown | The locked line rows (js/main.js lines 710 to 724) and the line unlock text (lines 733 to 743) state that total factory levels unlock production lines, and the province explain (lines 900 to 903) states factories turn steel into equipment. |
| 2 | production | army | Shown | The production explain (index.html lines 95 to 105) and the production summary (js/main.js lines 618 to 625) state lines build units and finished units deploy at the capital. |
| 3 | army | ground | Shown | The map hint (index.html lines 39 to 47) and the unit card preview state that a selected unit marches or attacks a highlighted neighbor and takes ground; the frontline naming gap is walk row 8, not this link. |
| 4 | ground | resources (steel half) | Shown | The province card explain (js/main.js renderProvinceCard) now states the chain in plain words: holding a province adds its steel per day to the income of the nation that holds it, taking a province adds its steel per day to your steel income, and losing one removes it. Cited by tools/core-loop-check.js. |
| 5 | resources | factories | Shown, with a note | The factory button states its equipment cost with need and have wording (js/main.js lines 940 to 947), so the build path from resources to factories is shown at the point of interaction; the per level numbers that were missing here are walk row 5, closed in Cycle 17 Step 2. |

## 5. G1 closure (determinism relevant data outside state)

Section 9 of STATE_INVENTORY.md now carries a classification for all 15 UI held rows. The confirmed negative, in one sentence: apart from state itself, which is the sim state object, no UI held variable is read by or feeds the simulation; the only contacts are event handlers calling Sim functions with values in the same handler, and paused, speed, and timer deciding when Sim.tick is called, never what it computes. Supporting facts: a grep of js/main.js for assignments to fields of state or its subobjects finds no direct sim field writes (the only state assignments are the object replacements in newGame and loadFromText); onProvinceClick calls Sim.issueOrder in the same handler and no pending order is stored anywhere in js/main.js; card dismissal (closeCard, closeCodex) calls no Sim function. One hole left open honestly: the Cycle 16 continuation and batching tests run in a node harness that calls Sim.tick directly and bypasses the main.js timer, and the batching test (tests/sim.test.js line 3656) covers tick batching, not the UI speed values, so one browser driven continuation check through main.js is owned by Step 4.

## 6. Wall clock and randomness grep record

Method: grep for Date.now, performance.now, new Date, Math.random, setTimeout, setInterval, and requestAnimationFrame across js/sim.js and everything it imports. js/sim.js imports nothing (no require calls, no script dependencies; it is a standalone module). Result: zero hits for every one of the seven tokens in js/sim.js, and zero in js/lore.js and js/save.js as well. The hits in js/main.js (setInterval in startTimer, Math.random in newGame seed choice, setTimeout in the export handler) are UI code, not the sim path. Verdict: zero on the sim path, as expected; no fix now item; Step 1 is not blocked.

## 7. The saveVersion rule (closes G3, the rule half)

- Any change to the shape of the saved sim payload bumps SAVE_VERSION in js/save.js
- a save whose version is unknown or older is either migrated by a named, tested migration function or rejected in plain language, and is never loaded silently
- meta state (tutorial, onboarding, or seen state) never enters the sim payload, and if it must be saved it goes in a separated envelope section under the same version rule
- the exact rejection message wording is owned by Step 4

Current behavior, stated for the record: SAVE_VERSION is 1 (js/save.js line 34), and deserializeSave already rejects any other version with a plain language reason (js/save.js lines 214 to 218); no migration function exists today, which is acceptable while there is only one version.

## 8. Gap index

Step 1 owns the start statement and the map legend and the pause and speed explanation.
Step 2 owns the factory per level numbers, the stacking sentence, and chain link 4 (ground to steel income). Step 2 is closed in Cycle 17 Step 2 by tools/core-loop-check.js covering the factory per level numbers, the stacking sentence, and chain link 4.
Step 3 owns order timing and stays home before the first order, the frontline naming, battle result why and losses, the exchange row definitions, the EW effectiveness rule, and the supply grace number. Step 3 is closed in Cycle 17 Step 3 by tools/battle-systems-check.js covering all six items.
Step 4 is closed in Cycle 17 Step 4 by tools/save-hardening-check.js covering the save card contents, slot metadata, and replace warning, G2 file import hardening, the G3 rejection message, and the browser driven continuation check.
PARKED items are the event card hard pause feel (DECISIONS item 10) and the end screen taste items (DECISIONS item 15), each with its reason in one line.