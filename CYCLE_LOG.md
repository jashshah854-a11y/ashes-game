# Ashes of Empires, Cycle Log

The loop's memory. Read before every cycle, append after every cycle.

## Cycle 1, Iteration 1 playable skeleton (2026-10-13)

Built by: Muse subagent in the sandbox repo, against DESIGN_BIBLE.md.

### What was built
- `js/sim.js`: the whole simulation core as plain functions over a plain state object. It loads in the browser (window.AshesSim) and in node (module.exports), so the tests exercise the exact code the game runs.
  - 10 by 7 province grid, two fictional nations: The Vessari Compact (player, west) and The Khessite Dominion (AI, east). Capitals at the west and east ends of the middle row, marked, named (Vesskar City, Khessograd), and garrisoned.
  - Real-time tick: one tick is one day. Economy phase, AI phase, then movement and combat. Day counter and a campaign end at day 150.
  - Economy: steel income per owned province feeds a steel stockpile; factory levels consume steel daily and produce equipment; if steel runs short, factory levels sit idle and output drops. That is the resource gate, and a test proves it.
  - Units: Infantry Divisions and Drone Wings with strength, attack, defense. Click select, click an adjacent province to march or attack. Units sharing origin and target fight as one battle group. Provinces flip owner and color on capture.
  - Visible upgrade: build or upgrade a factory (levels 1 to 3) in any owned province; the on-map factory badge grows with level.
  - Research: Drone Gen 2 costs 60 research points and raises drone wings from attack 3 / defense 2 to attack 5 / defense 3. The unit panel and map chips show the live numbers, so the change is visible.
  - Win and lose: capture Khessograd to win, lose Vesskar City to lose, or reach day 150 with your capital standing for a survival victory.
  - Enemy AI: scripted and deliberately weak. It researches Gen 2 when it can, grows factories when rich, trains up to a 14 unit field army, and pushes west, refusing attacks it badly loses on paper.
- `index.html`, `css/style.css`, `js/main.js`: the browser layer. CSS grid map with owner colors, factory badges, unit chips; side panel with nation stats, province inspector, build and train buttons, research button, selected unit card, enemy summary, and a war log. Pause button and 1x / 2x speed buttons drive the tick timer. New Game starts a fresh random seed.
- `tests/sim.test.js`: 14 node tests covering game creation, tick, economy production, the steel gate, research accrual, battle resolution, province capture, order validation, factory build rules, the Drone Gen 2 stat change, capital capture victory, campaign end, and seed determinism.

### Test results
- `node --test tests/sim.test.js`: 14 pass, 0 fail.
- Headless autoplay smoke tests (scripted players):
  - Passive player (never acts): survives to day 151, survival victory. The AI expands but does not steamroll.
  - Sensible player (trains, researches, holds a capital garrison, advances in groups): survives to day 151 on 4 of 4 seeds, front stabilizes around the third column.
  - Reckless players who abandon the capital lane lose it in roughly 7 to 15 days. The capital fall is fast when the lane is left open; that is recorded in BACKLOG.md as a balance item, not hidden.

### Lessons burned into the code during this cycle
- Capital garrisons exist because the first smoke test ended with a lone enemy unit strolling down an empty middle row into an undefended capital on day 7.
- The AI has a 14 unit cap because the first uncapped run ended with a 51 unit pile-up that never attacked anything.
- Battle groups exist because single units attacking a pooled defending stack one at a time was guaranteed suicide, for the player and the AI alike. Smoke tests found it, the fix is grouped resolution.

### What is stubbed
Everything in BACKLOG.md. Short version: no fortifications, rail, navy, intel or fog, lore events, production line retooling, or drone cost-exchange scoring yet. Those are v1 systems from the bible and they are future cycles, listed openly in the backlog rather than faked here.

### Judge verdict
Not yet called for this cycle. Iteration 1 stands on the bible's own definition of done: running, playable end to end, tests green. The first Opus 5.5 judge pass should grade this skeleton before Iteration 2 scope is chosen.

## Cycle 2, Opus 5.5 judge pass on Iteration 1 (2026-10-13)

Judge: Claude Opus 5.5 at high, direct Anthropic line, graded against DESIGN_BIBLE.md with the cycle 1 summary and test results. Two calls: the main verdict (its tail was cut at the token cap) and a short completion call for the remainder. Verdict recorded here in substance.

### Verdict: PASS against the Iteration 1 bar
Every bar item confirmed: map and nations, day tick with pause and speeds, steel-gated economy, select/move/attack with battle groups, growing factory badge, Drone Gen 2 live stat change, win/lose/survival endings, 14 passing tests on a sim core shared by browser and tests, and an honest backlog. The judge called the multi-seed headless smoke runs "more rigor than the bar asked for."

### Two confirmations the judge demanded, both verified in code by Vector
- Day counter IS rendered (index.html day box; main.js updates it every render).
- Unit training DOES spend the equipment stockpile (trainUnit deducts CFG cost from nation equipment). The compounding loop's first link is intact.

### Compass check (judge's grades)
- HOI4 war heart: EMBRYO. Units, groups, captures exist. No production lines, no frontline concept, no supply, no retreat. "A board game of chips."
- Civ visible progression: EMBRYO. One badge grows. A day 140 map does not yet look like a different animal from day 1.
- EU5 lore: ABSENT. Syllable names, no events, no history, no grudges.
- Legibility: EMBRYO. Live chips and war log are good. Hidden rules will feel like bugs: the AI's private odds, first-unit damage soak, player-first resolution order.

### Risks named (accepted as the roadmap)
1. Grid coordinates as topology. Rail, rivers, coasts, crossings, blockade all need edge data. Move to an explicit province graph with typed edges now, while it is one file.
2. Units bought whole, priced in nothing. Production lines and the cost-exchange scoreboard both need units built from equipment over time, every asset carrying a cost. Later means touching combat, AI, and UI at once.
3. Hidden, order-dependent combat. Player-first resolution and damage soak are biases everything else will balance against. Fix before supply, terrain, and drones layer on. Combat odds must be one shared function the AI and the player preview both call.

### Next cycle prescribed by the judge (accepted as Cycle 3)
Rail is supply, legible on the map:
- Graph refactor: typed edges (land, river, coast). The CSS grid stays as a renderer. STOP computing adjacency from coordinates anywhere; delete the coordinate helpers.
- Rail: a buildable edge, costs steel, takes days to construct.
- Supply: a province is supplied if rail connects it to its capital within N hops through owned provinces. Out-of-supply units lose 10 percent attack and defense per day out (floor at 50 percent effectiveness), cannot reinforce, and after a 3-day grace take 2 percent strength attrition per day. Penalties are named modifiers in the combat math, shown on screen. Resupply clears penalties at the same 10 percent per day rate they accrued.
- Legibility: supply overlay (hatched red for unsupplied), rail drawn as track lines, construction dashed with days remaining, broken-supply marker with day count on unit counters, province hover or inspector shows the supply route and the break point, combat preview lists supply modifiers for both sides.
- Test: cutting one rail province flips a pocket to unsupplied; penalties verified after 1, 3, and 7 days.

### Sequencing note
Risk 2 (unit production over time and money costs) and the simultaneous-resolution half of risk 3 are real but come after Cycle 3. The shared odds function half of risk 3 rides along with Cycle 3 because supply modifiers must be visible to both sides.

## Cycle 4, Opus 5.5 judge pass on Cycle 3 (2026-10-13)

Verdict: PASS. All four prescribed items shipped and each closes the risk it targeted. The judge called the balance regression "good news" (it proved the old gate was hiding broken math) and the fixes the right kind: legible rules instead of hidden fudge.

- Rail conversion: KEEPER, in the judge's words, because it came out of balance pressure rather than wish-listing and directly expresses "rail is supply." Two conditions: keep it to one tunable number (it is: railConvertDays), and surface it in the attack preview (done in this cycle, below).
- Small flags, all fixed in this cycle: the inspector now shows hops as "N of 8 hops" against the limit; the attack preview warns how many rail edges a capture will start converting and that units beyond will be unsupplied; the Dominion's doctrine (1.5x superiority, never attacks out of supply, 10-day mobilization) is printed in its panel so its caution reads as rules, not randomness.
- Standing caveat: risk 3 is half closed. Odds are shared, but battles still resolve sequentially within a tick, so resolution order can matter. The judge's rider for a future cycle: compute all battle results from start-of-tick state, then apply.
- Next cycle prescribed: production lines and unit costs (risk 2). Lines assigned a template, steel cost per unit, build time in days, deployment at the capital, identical budgets for the AI, production panel with queue and steel drain, unit cost on the unit card, tests for budget parity, queue timing, and the rail-versus-units steel tradeoff. Exit criteria: passive falls in about 30 to 45 days, sensible survives 8 of 8. Deferred by the judge: fortifications, efficiency ramps, manpower, drones and EW, lore seed (lore waits until there are priced units and a real economy for it to describe).

## Cycle 5, production lines and unit costs, Step 1 of 4: sim (2026-10-13)

Prescription: Cycle 4 judge verdict (risk 2). This run did step 1 only, the simulation. Step 2 (production panel UI), step 3 (tests and balance), and step 4 (judge) remain for later runs of this loop.

### What was built
- Production lines in `js/sim.js`, same dual browser and node module pattern. Each nation starts with 2 lines, identical for player and AI: line 1 assigned infantry, line 2 assigned drone. A line holds a queue of orders (cap 9) and builds one unit at a time.
- Unit costs are now steel, paid over time instead of instantly: infantry costs 30 steel over 6 build days, a drone wing costs 15 steel over 3 build days. Both drain 5 steel per day while the line works, so every number stays whole and visible. Nothing is charged up front and no unit appears on the day it is ordered.
- A finished unit deploys at the nation's capital, for the player and the AI alike.
- Steel starvation is a rule, not a bug: if the stockpile cannot pay a line's daily drain, that line stalls for the day and makes no progress. Rail building (15 steel up front per edge) and unit production now compete for the same steel, which is the tradeoff the judge asked for.
- Retooling exists in the sim: `assignLineTemplate` switches a line's template and scraps the work in progress (steel already drained into it is lost); the queue count carries over. New API: `queueProduction`, `assignLineTemplate`, `productionPhase`, `productionDrain`, `queuedUnits`, `lineSteelPerDay`, `productionLine`.
- Instant purchases are gone. The old `trainUnit` survives only as a compatibility alias that queues an order on the first line assigned to that template, so the current browser UI keeps working until step 2 replaces the train buttons with the production panel. It spawns nothing and charges no equipment.
- Starting armies are unchanged in composition (5 infantry, 2 drone wings per side), so their repriced value is the same 180 the old equipment prices gave (5 times 30 plus 2 times 15), now denominated in steel paid over time for reinforcements. Starting steel, equipment, and research are unchanged.
- AI budget discipline fix, forced by the balance run below: the AI now grows a factory at most every 3 days and only with a steel stockpile of 60 or more. Same prices as the player, no discount; it is a spending rule for a scripted AI, like its attack doctrine.

### Test and balance results
- Existing suite: `node --test tests/sim.test.js`, 20 pass, 0 fail. (Formal production tests are step 3 of this cycle; the checks below are this step's verification, not a substitute.)
- Spot checks run by hand against the new API: player and AI lines, budgets, and costs are identical at game start; a queued infantry completes exactly on the 6th funded production day and deploys at the capital, with exactly 30 steel spent; with steel at zero a queued line makes zero progress and reports stalled; retooling zeroes progress.
- Passive player (never acts) across seeds 1, 7, 42, 99, 1234, 555, 2024, 31337: capital falls on day 36 on all 8 seeds, inside the judge's day 30 to 45 band and exactly matching the Cycle 3 measurement.
- Scripted sensible player (queues both lines, researches Drone Gen 2, builds rail toward unsupplied provinces with a steel buffer, masses every non-garrison unit at the easternmost capital-row province and attacks only eastward with a clear power edge): survives 8 of 8 seeds, all 8 by capturing the enemy capital between day 25 and day 78.

### Lessons from the balance run
- The first version of this step failed passively on 3 of 8 seeds (the player survived by doing nothing). Cause: the old AI grew a factory almost every day, each level adds daily steel demand, and with lines now also draining steel the Dominion's stockpile was pinned at zero by about day 25. Rail never got funded, its lead group starved at 50 percent penalty one province from the capital, and the AI's own rule against attacking while out of supply froze it there. Under instant purchases the AI won on day 36 before the spiral mattered. Pacing and steel-gating its factory growth (above) restored day 36 on all 8 seeds. The old instant-buy economy was hiding a factory steel spiral; production exposed it.
- A sensible player who leaves the starting units scattered in three provinces loses them piecemeal to the AI stack, production or not. Massing at one staging province is what survives; that matches the mission text for the step 3 script (trains, researches, rails unsupplied units, masses at the front).
- Equipment is now a factory-building currency only (see BACKLOG). Whether factories should also gate line count or build speed is flagged for the step 4 judge, not decided here.

## Cycle 5, production lines and unit costs, Step 2 of 4: production panel UI (2026-10-13)

Prescription: Cycle 4 judge verdict (risk 2), step 2 of this cycle. Built by Claude Opus 5.5 through the direct Anthropic line, per Jash's division of labor (Opus builds, Vector orchestrates: brief, apply, test, verify, commit). Step 1 (sim) shipped in commit 8c40c9a. Steps 3 (tests and balance) and 4 (judge) remain.

### What Opus built
- `index.html`: a new Production card between the nation card and the province card, with a summary div (id prod-summary), a lines container (id production-lines), and a static explain paragraph stating the rules in plain words: one unit at a time per line, steel drained daily, a day the stockpile cannot pay is a stalled day with no progress, finished units deploy at the capital, retooling scraps the unit in progress and its spent steel. The two old train buttons (btn-train-inf, btn-train-drone) are removed from the province card; the factory button stays.
- `js/main.js`: renderProduction(), called on every render. One row per player line showing the template label, full cost and build days (30 steel over 6 days infantry, 15 over 3 drone), queue count against the cap of 9, days paid and days left on the unit in progress, and the 5 steel per day drain while working. An idle line says so; a stalled line shows "Stalled: not enough steel today. No progress made." in a highlighted style; a line with work in progress carries the note "Retooling scraps the unit in progress." Per line buttons: Queue (+1), disabled at the cap, calling queueProduction; and Retool to the other template, calling assignLineTemplate. The summary line shows total production drain (productionDrain), total queued units, and the capital name finished units deploy at. The selected unit card now shows "Cost to build: N steel over M days on a production line." The train button handlers and all province card train gating are gone; nothing in the UI calls the trainUnit alias anymore. Map, supply, rail, research, attack preview, and log rendering are unchanged (verified by diff: the only main.js changes are the ones listed here).
- `css/style.css`: production panel styles in the existing palette, with the stalled note in the same red treatment as the supply penalty tag.

### Opus usage
- Build call: [usage: in=12614, out=12825]. One call, no fix rounds needed.

### Test and verification results (run by the orchestrator)
- `node --check js/main.js` and `node --check js/sim.js`: both pass.
- `node --test tests/sim.test.js`: 20 pass, 0 fail (suite unchanged this step; formal production tests are step 3).
- Id sync check: every id in the main.js element list exists in index.html; the only HTML ids not in the JS list are the structural card ids, same as before this step.
- Em dash scan of the Opus output: zero.
- Headless DOM smoke test (orchestrator glue, a stub DOM in node running the real sim.js and main.js): the panel renders 2 rows with correct costs and idle text; the summary starts at 0 drain and names Vesskar City; clicking Queue on line 1 rebuilds the row to "1 in queue, 0 of 6 days paid, 6 days left, 5 steel per day" and the summary drain becomes 5; clicking Retool switches line 1 to Drone Wing at 15 steel over 3 days with the queue carried over. PASS.

### Lessons
- The diff discipline paid off: because the brief demanded complete replacement files plus an exact API list, the returned files changed only what the step specified, and the whole step verified in one pass with no fix round.
- A stub DOM smoke test is cheap and catches panel wiring (ids, listeners, re-render after clicks) without a browser. Worth keeping for step 3's harness work.

## Cycle 5, production lines and unit costs, Step 3 of 4: tests and balance (2026-10-13)

Prescription: Cycle 4 judge verdict (risk 2), step 3 of this cycle. Tests authored by Claude Opus 5.5 through the direct Anthropic line, per Jash's division of labor. Steps 1 (sim, commit 8c40c9a) and 2 (production panel UI, commit 32368c0) are done. Step 4 (judge) remains for a later run of this loop.

### What Opus built
- `tests/sim.test.js`: all 20 existing tests preserved verbatim (verified by diff: the change is a pure append of 290 lines, no existing line touched), plus a new Cycle 5 production section with 10 tests.
  - Budget parity (3 tests): player and AI start with identical lines, steel, and equipment; template costs, build days, and per day drain are the same CFG numbers for both nations; and the same order queued by both nations completes on the same production day for the same total steel when productionPhase runs in isolation, so there is no discount on either side.
  - Queue completion timing (5 tests): ordering charges nothing up front and spawns nothing on the day ordered; infantry completes exactly on the 6th funded day for exactly 30 steel and deploys at the capital; a drone wing completes exactly on the 3rd funded day for exactly 15 steel; two orders on one line build strictly one after the other; a line holds CFG.maxQueuePerLine (9) orders and rejects one more.
  - Steel starvation (2 tests): rail paid up front (15 steel for the capital to p0_2 edge) leaves the player below the 5 steel daily drain, and the infantry line stalls with stalled true, progressDays stuck at 0, zero steel spent by the line, and no unit appearing; and at exactly zero steel a line stalls, topping up to exactly the drain makes the next day progress and clears the stalled flag, and a later return to zero keeps the paid progress instead of erasing it.

### Opus usage
- Build call: [usage: in=11344, out=13296]. One call, no fix rounds needed: the returned file passed the whole suite on the first run.

### Test and balance results (run by the orchestrator)
- `node --check js/sim.js` and `node --check js/main.js`: both pass. Em dash scan of the Opus output: zero.
- `node --test tests/sim.test.js`: 30 pass, 0 fail (20 existing plus 10 new).
- Balance rerun, harness note: the balance harness for this step was written by the orchestrator as glue (as the mission allows), because no harness file exists in the repo from step 1; the scripted players below are that glue, not Opus work. The sim itself is unchanged since step 1, so this is a regression check, not new tuning.
  - Passive player (never acts) across seeds 1, 7, 42, 99, 1234, 555, 2024, 31337: capital falls on day 36 on all 8 seeds, inside the judge's day 30 to 45 band, exactly matching the step 1 measurement.
  - Scripted sensible player (queues both lines whenever idle, researches Drone Gen 2, builds rail toward unsupplied owned provinces keeping a steel buffer of 40, keeps the two starting capital infantry as garrison, masses every other unit at the easternmost capital row province, and attacks only eastward along the capital row with at least 1.5x stackPower edge): survives 8 of 8 seeds, all 8 by capturing the enemy capital on day 28, inside step 1's day 25 to 78 capture range.

### Lessons
- The first draft of the orchestrator's sensible player got only 5 of 8, because it attacked opportunistically from whatever province a group stood in and lost units piecemeal, which is exactly the failure step 1's log already recorded. Enforcing the mass first rule (no attack until at least 5 units are massed at the staging province, then only eastward with a clear power edge) restored 8 of 8 with no sim change. The balance did not regress; the script had.
- Testing productionPhase directly, in isolation from the tick, is what makes the parity and timing numbers exact: on full ticks, economy income and the AI's own orders blur who spent what. Opus chose that isolation unprompted and it is the right call for this layer of tests.

## IRIS handover, lessons from the old PC loop (2026-10-13)

The old Ashes loop (Claude Code plus Hermes on Jash's PC, repo Ashes-Semantic-Zoom) is PAUSED by Jash's decision as of 2026-10-13 08:12: STOP file set, both scheduled tasks disabled, cycle 96 stopped mid-run with no commit. Head is cycle 95 (546b9ce), tests 233/233. This cloud build is the live Ashes work now. One dirty file on the PC branch (planning/gate-receipt.json) belongs to that repo, not this one. To resume the PC loop later, the STOP file comes out and the tasks re-enable; its Gate 3 spectator work and the old RTS demo design do not transfer as specs. The process lessons below do, and the loop treats them as binding.

- Jash's balance ruling (2026-10-11): both intended play paths must WIN through the public command path with at least 20 percent of starting friendly health left; a passive or reckless path must still lose. The old mission once "won" by 2.3 to 3.75 HP only because it was accidentally balanced around a bug (misplaced Fortify cover helping the player). Verify wins come from intended mechanics, never from a defect, and say so in the log if one does.
- Rebalance in small slices. A one-shot big rebalance regressed the old suite and was reverted; the fix was three small separately committed slices.
- Determinism and saves: the old sim produced a mission freeze at 3599.9s, time drift from per-frame rounding, and saves that soft-locked or failed to load. When save/load arrives in this build, it comes with save integrity and time-step determinism tests.
- Validate any scoring or judging metric before tuning against it. The old loop tuned cues against an unvalidated score and moved nothing.
- Commit discipline: commit every cycle that does not make tests worse; a cycle attempts the next slice instead of quitting.

## Cycle 5, production lines and unit costs, Step 4 of 4: balance ruling checks, fix, and judge (2026-10-13)

Prescription: Cycle 4 judge verdict (risk 2), step 4 of this cycle, plus the balance ruling checks that Step 3 predated. Steps 1 (sim, 8c40c9a), 2 (UI, 32368c0), and 3 (tests, b976a51) were done. This step closes the cycle. All code in this step was authored by Claude Opus 5.5 through the direct Anthropic line, per Jash's division of labor; the orchestrator wrote the briefs and the balance harness glue, applied the returns, ran every test and balance run itself, and verified the judge's factual claims by trace before accepting them.

### The ruling checks (Jash's ruling, quoted in the IRIS handover entry above, his words from 2026-10-11)
Both intended play paths must win through the public command path with at least 20 percent of starting friendly health left; a passive or reckless path must still lose. The harness is orchestrator glue, run on the 8 prescribed seeds (1, 7, 42, 99, 1234, 555, 2024, 31337). Starting friendly strength is 72 (5 infantry at 12 plus 2 drone wings at 6). Strength retention below is reported as end strength as a percent of that 72; end strength includes reinforcements built during the campaign, so values over 100 are growth, not retention in the strict sense (label corrected at the judge's direction). The scripts use only public commands: queueProduction, researchDroneGen2, buildRail, issueOrder. No state edits, no teleports, no direct province flips.
- Sensible player (queues both lines when idle, researches Drone Gen 2, builds rail to unsupplied provinces keeping a steel buffer, keeps 2 capital infantry as garrison, masses at the easternmost capital row province, attacks only eastward with 5 or more massed and a 1.5x stackPower edge): BEFORE the fix, wins 8 of 8, all by enemy capital capture on day 28, end strength 136.1 to 170.8 percent of starting. Check (b) passed before the fix and passes after it (below).
- Reckless player (abandons the capital lane: capital units vacate north and never return or defend; attacks piecemeal: exactly one field unit orders a move or attack per day; no rail discipline: buildRail is never called; it still queues production, so it is not a passive player in disguise): BEFORE the fix, reckless WON 5 of 8 seeds, capturing Khessograd on day 12 (seeds 1, 1234, 2024) and day 18 (seeds 7, 555), and lost on day 36 on the other 3. Check (a) FAILED.

### Root cause, verified by a day by day trace
The Dominion AI abandoned its own capital. In aiTakeTurn its capital units were grouped into origins like any province, and the no-attack fallback drifted them west on day 1, so Khessograd stood empty from day 2 except for fresh production deployments that also drifted west the next day. A lone walker down any row could take it unopposed. The backlog already admitted the AI never defended its capital on purpose; Iteration 1 taught this exact lesson for the player's capital and the AI side never got the same fix.

### The fix (one small slice, commit 96da531, built by Opus 5.5)
In aiTakeTurn, the first 3 idle Dominion units on its capital hold as a garrison and receive no orders; units beyond 3 act normally, so reinforcements still advance. The enemy panel doctrine text now states the garrison rule. No tuning numbers changed in this slice (the step 1 factory pacing change earlier in this cycle was a tuning change; the two facts are separate). Suite after the fix: 30 pass, 0 fail at that point.
- Opus usage, fix build call: [usage: in=18568, out=1429]. One call, no fix rounds. The same spec was validated in a throwaway prototype by the orchestrator before the brief was sent, and the returned code matched the prototype's semantics exactly.

### Balance after the fix (orchestrator rerun, all 8 seeds)
- Passive player: capital falls on day 36 on all 8 seeds, unchanged, inside the 30 to 45 band.
- Sensible player: wins 8 of 8, all by enemy capital capture, on days 43 to 52 (per seed: 47, 50, 47, 43, 49, 46, 46, 52). End strength as percent of starting 72: 95.8, 120.8, 81.9, 118.1, 130.6, 108.3, 93.1, 144.4. The 20 percent floor clears on every seed through real orders only. Extra honesty check run by the orchestrator: counting only surviving units of the original starting army, strength left is 24 on every seed (33.3 percent of 72, the untouched 2 infantry capital garrison), so the floor clears even with reinforcements excluded.
- Reckless player: LOSES 8 of 8. Its capital falls on day 36 on 6 seeds and on day 54 on seeds 7 and 555. Both ruling checks now PASS.

### Judge verdict (fresh Opus 5.5 call, not the builder context)
- Opus usage, judge call: [usage: in=6437, out=8127].
- VERDICT: PASS, conditional on the fix-now flags below (all closed in this step, see next section). Every prescribed deliverable shipped and both exit criteria met. The judge's deciding reason: the cycle found its own failure in the reckless check, traced it to a real AI defect, fixed it with one small rule change and no tuning edits, and re-verified all three player profiles.
- Compass check: HOI4 war heart FORMING (above embryo; production, retooling, drain, rail competition, capital deployment form a real supply to front chain; fortifications, frontline bending, simultaneous combat still missing). Civ visible progression EMBRYO (nothing this cycle makes a year 3 map look different from year 1). EU5 lore ABSENT (names only; the judge called this a debt, not a deferral, five cycles in). Legibility EMBRYO, trending up (panel states its rules and flags stalls; no tooltips, no order arrows, and at verdict time the panel had never been seen in a real browser).
- Ruling on the open equipment question: factories must gate production line COUNT, not build speed, and equipment as a factory only currency is acceptable for exactly one more cycle, not as the end state, because the bible's compounding loop (factories feed production, production feeds the army) is currently closed on itself. Line count is legible; speed modifiers are the Stellaris trap. Thresholds are loop tuning; whether a locked slot feels good is taste and is parked for Jash in DECISIONS_FOR_JASH.md.
- Next prescription (Cycle 6, "Close the loop, fix the clock"): (A) factories gate line count, start unchanged at 2 lines, extra slots unlock at loop-chosen total factory level thresholds, hard cap 4, identical rule for the AI, locked slots shown in the panel with the exact unlock condition in plain words, tests for slot count, locked queue rejection, and parity. (B) Simultaneous battle resolution from start-of-tick state (closes the Cycle 4 risk 3 caveat), including units swapping provinces across the same edge meeting in battle instead of passing through, with order-reversal and edge-swap tests. Exit criteria: full suite green, balance rerun on all 8 seeds (passive 30 to 45, sensible 8 of 8 above the 20 percent floor, reckless loses 8 of 8, sensible shown using the factory to line path in at least one seed trace), a real browser render check of the locked slot UI, and log and backlog updated with no contradictions. Deferred in stated order: lore seed is reserved as Cycle 7 and not to be bumped again (written backstories for both nations, a codex panel, 3 event cards, tone and content to Jash for approval), then fortifications, efficiency ramps, manpower, drones and EW, the cost-exchange scoreboard, intel and fog, navy.

### The judge's claims check, verified by the orchestrator before acceptance
1. "Passive day 36 unchanged is doubtful; a held garrison should shrink the attacking force." VERIFIED TRUE and explained. Trace of passive seed 1 after the fix: the garrison units (ids 12, 13, 14, the starting capital stack) never left Khessograd on any day. The stack standing on the player capital at the fall was ids 11, 15, 16, 17, 18, 19, 20: a starting front drone plus production deployments that were beyond the garrison count when they left. The front army plus excess reinforcements were always sufficient; the day never moved.
2. "Reckless surviving to day 54 on seeds 7 and 555 is counterintuitive; show a trace." TRACED. On seed 7 the Dominion's westernmost unit was still at x=5 on day 12 and x=4 on day 30, reaching x=1 only on day 48; on seed 1 it reached x=4 by day 12 and x=1 by day 30. The piecemeal attacks on seed 7 kept meeting Dominion groups further east, so the advance west was slower even though the reckless capital lane stood open. The loss is real, only later.
3. "Factory steel spiral conflicts with equipment funds factories." RESOLVED, no conflict. Exact economics, now also stated in BACKLOG.md: building a factory level costs equipment (40 times the target level); running factories consume steel (2 per level per day) and produce equipment (5 per level per day). The step 1 spiral was steel consumption by daily factory running costs competing with rail and production drains, not a steel build cost.
4. Backlog contradictions (capital defense, capital capture proven, day 28 wins, step 4 status): all four CORRECTED in BACKLOG.md in this step, with the day 28 result marked superseded rather than erased.
5. Ruling source: the 20 percent floor and the reckless check come from Jash's ruling of 2026-10-11, quoted in the IRIS handover entry in this log. This entry cites it directly so future judges can verify.
6. Independence: the fix was authored by Opus 5.5 and judged by a separate fresh Opus 5.5 call; every number in this entry was produced or reproduced by the orchestrator's own runs, not taken from the builder's or judge's word.

### Judge fix-now flags, all closed in this step
- Garrison and retool tests (Opus authored, commit 5c8f6eb): [usage: in=13186, out=14847]. A pure append; the garrison test pins that the first 3 capital units hold for 3 ticks and that a staged 4th unit acts (the last capital unit in array order drifts west) while the staged unit is held; the retool test pins progress reset, queue carried, no refund (steel stays 90 after 10 spent), and the retooled drone completing for 15 more. Suite: 32 pass, 0 fail.
- Retool warning (Opus authored, commit 0eb9b9c): [usage: in=7776, out=7302]. The production note now reads, before the player acts: "Retooling scraps the unit in progress and loses the N steel already spent on it." with N computed live as progressDays times the per day drain.
- Real browser check (orchestrator, headless Chromium at /opt/meta-chromium/chrome driving the actual repo index.html over CDP, screenshot saved during the run): the production panel renders with both lines, costs, and the deploy-at-capital summary; clicking the real Queue buttons updated the rows and moved the summary drain from 0 to 10 steel per day; after real ticks the infantry line showed 3 of 6 days paid with the new retool note rendering the correct live amount (15 steel), the drone line completed its unit and returned to idle, and the selected unit card showed "Cost to build: 30 steel over 6 days on a production line." One honest gap: the stalled warning was not triggered in the browser session (forcing a stall needs steel starvation through UI clicks alone); it remains covered by the step 2 stub DOM smoke test and the sim starvation tests.
- Backlog and decisions updates: in this step's documentation commit (BACKLOG.md corrections above; DECISIONS_FOR_JASH.md gains the garrison size, the retool scrap rule, the queue cancel question, and the locked line slot feel, all as Jash taste calls, none decided for him).

### Opus usage for the cycle (from the recorded lines in this log)
- Step 2 build: [usage: in=12614, out=12825]. Step 3 build: [usage: in=11344, out=13296].
- Step 4: fix [usage: in=18568, out=1429], judge flags tests [usage: in=13186, out=14847], retool UI [usage: in=7776, out=7302], judge [usage: in=6437, out=8127]. Step 4 subtotal: in=45967, out=31705.
- Recorded cycle total, steps 2 to 4: in=69925, out=57826. Step 1's usage was not recorded in its log entry, so the true cycle total is higher by that one call; stated plainly rather than reconstructed.

### Lessons
- Test a reckless profile, not only passive and sensible (the judge's lesson, earned here): the sensible and passive checks were green while a third profile was winning by walking into an empty capital.
- A garrison rule has to bind the side it was written for. Iteration 1 garrisoned the player's capital against the AI; nobody checked that the AI's own movement orders respected its capital garrison, and its drift rule quietly undid it on day 1.
- Balance numbers need their definitions in the log: end strength over starting strength, with and without reinforcements, are different claims and both are now on record.

### Mission status
The production lines cycle prescribed by the Cycle 4 judge is complete: steps 1 to 4 done, judge PASS with all fix-now flags closed, no unresolved balance flags. Per the mission, this loop job is disabled at the end of this step and a completion summary goes to the chat. Cycle 6 as prescribed above is the queued next work when Jash wants it running.

## Cycle 6, Close the loop, fix the clock, Step 1 of 5: factories gate line count, sim (2026-10-13)

Prescription: Cycle 5 judge verdict, item (A). This run did step 1 only, the simulation. Step 2 (simultaneous battles), step 3 (locked slot UI), step 4 (tests and balance), and step 5 (judge) remain for later runs. Mission note: this cycle runs under Jash's 2026-10-13 continuous mission (cycle after cycle until the Anthropic credit is exhausted); the Cycle 5 entry's "loop job is disabled" line is superseded history, not current state. All code in this step was authored by Claude Opus 5.5 through the direct Anthropic line (9 anchor replacement blocks against js/sim.js, applied verbatim by the orchestrator); the orchestrator wrote the brief, chose the tuning below, ran every check itself, and verified the results.

### Tuning chosen by the loop (recorded per the prescription)
- One tunable config in CFG: lineUnlockFactoryLevels [0, 0, 16, 24] with maxProductionLines 4 as the hard cap. Line 3 unlocks at 16 total factory levels (summed over owned provinces, the existing factoryLevels function), line 4 at 24.
- Why 16 and 24: starting totals on the 8 standard seeds run 5 to 14 (highest is player seed 1 at 14), so every standard seed still starts with exactly 2 lines, unchanged, and line 3 is a build goal, not a gift. Building from a typical start of 8 to 16 takes 8 factory level builds, affordable from equipment income inside the first weeks.
- An unlock is permanent once reached: lines never relock or disappear if factory provinces are later lost. Decided as a legibility call (an unlock that flickers with the front line would read as a bug), and noted here so the step 5 judge can rule on it.

### What Opus built
- `js/sim.js` only. New functions, all exported: syncProductionLines (appends earned line objects in id order, templates alternating infantry, drone, infantry, drone, and logs each opening with the nation's total factory levels), unlockedLineCount, isLineUnlocked, lineLockInfo (required, current, and missing levels for a locked in-range slot).
- queueProduction and assignLineTemplate sync first, then reject an in-range locked line with { ok: false, locked: true } and a legible reason carrying real numbers, for example at seed 42 start: "Line 3 is locked. Build 8 more factory levels anywhere to unlock it (needs 16 total factory levels, you have 8)." No queue is incremented and nothing is logged on a locked rejection. Out-of-range ids still return "no such production line".
- productionPhase syncs at its start, so a line earned by building or capturing factories works the same day. aiTakeTurn syncs the Dominion's lines immediately before its production ordering block, so the AI queues on lines 3 and 4 through the identical queueProduction path and costs the moment they unlock.
- Starting state is untouched: exactly 2 line objects per nation (ids 1 and 2, infantry and drone), same costs, build days, armies, steel, and equipment. The existing parity test that pins this passed unmodified.

### Opus usage
- Build call: [usage: in=17660, out=4594]. One call, no fix rounds needed: the 9 blocks applied cleanly, syntax and the whole suite passed on the first run.
- Cycle 6 running total: in=17660, out=4594. Recorded grand total across cycles (sum of the usage lines in this log; Cycle 5 step 1 and the Cycle 2 judge calls were never recorded, so the true total is higher): in=87585, out=62420.

### Test and verification results (run by the orchestrator)
- `node --check js/sim.js`: pass. Em dash scan of js/sim.js: zero.
- `node --test tests/sim.test.js`: 32 pass, 0 fail (suite unchanged this step; formal line gating tests are step 4).
- Spot checks by the orchestrator against the new API: on all 8 standard seeds both nations start with 2 lines, unlockedLineCount 2, and totals under 16. Locked queue and retool rejections return the exact numbers above and create no phantom line. Raised to exactly 16 total factory levels (direct province edits in the checker only, not a balance run), line 3 unlocks with template infantry, queues, and a unit built on it deploys at the capital after 6 funded days. Line 4 stays locked at 16 and unlocks at 24 with template drone for the enemy, same thresholds. Permanence verified: razing every player factory to 0 leaves line 3 open and queueable.
- AI parity through the real tick path: with the enemy raised to 16 total factory levels, one tick left the Dominion with lines 1, 2, and 3 each holding a queued order, line 3 included, so the AI demonstrably uses an extra line when unlocked.

### Lessons
- The representation matters more than the rule: keeping productionLines at exactly the earned lines (and syncing at every public entry point: queue, retool, production phase, AI turn) preserved the pinned starting test and made locked rejection a small special case, instead of a fourth line object the UI and tests would have to explain before step 3 exists.
- Thresholds chosen against measured starting totals, not vibes: the 14 on seed 1 is what pushed line 3 to 16. A threshold of 12, the first number that came to mind, would have handed seed 1 a third line at game start and broken the prescription's "start unchanged at 2" on a standard seed.

## Cycle 6, Close the loop, fix the clock, Step 2 of 5: simultaneous battles, sim (2026-10-13)

Prescription: Cycle 5 judge verdict, item (B), closing the Cycle 4 caveat that battles resolved sequentially within a tick with the player first. This run did step 2 only. Step 3 (locked slot UI), step 4 (tests and balance), and step 5 (judge) remain. Note on process: the 12:43 run of this step was interrupted and committed nothing; this run is its relaunch, verified against a clean tree with HEAD still at step 1 (fa9dfeb) before any work. All code in this step was authored by Claude Opus 5.5 through the direct Anthropic line (5 anchor replacement blocks, applied verbatim by the orchestrator); the orchestrator wrote the brief, ran every check itself, and verified the behaviors below with its own scenario harness.

### What Opus built
- `js/sim.js`: a new exported movementPhase(state) replaces the sequential group execution in tick (the player-first sort and executeGroup are gone). It snapshots every ordered unit's origin and target, builds groups keyed nation, origin, target, and assigns each unit to at most one engagement per tick, in this priority: (a) edge swap meeting battles, opposing groups crossing the same edge in opposite directions; (b) province battles, where all snapshot occupants of a target province defend it even if they had orders elsewhere (their orders are cancelled for the tick), and all attacking groups against one province combine into one battle; (c) incoming clashes, opposing groups converging on the same empty province; (d) unopposed moves.
- Every engagement is computed on shallow unit copies from the snapshot (real units are untouched while any battle is calculated), with clone lists sorted by unit id and its own rng seeded deterministically from the game seed, the tick count, and a canonical engagement key, so an engagement's rolls do not depend on other engagements or on unit order. Meeting battles are symmetric: both sides deal damage with their attack power. Province battles keep the existing math exactly (attack versus defense, 12 round cap, damage soak in unit id order). Results are then applied at once: winners march in only if no living enemy unit is staying at their target, captures flip owners and run the capital check in canonical province order, and every order touched by the phase is cleared. The exported resolveBattle keeps its signature and behavior for existing callers.
- `js/main.js`: the attack preview keeps its province battle line unchanged and adds, per defended neighbor, the honest meeting line: "If they march out and meet you on the road: your attack N vs their attack M." Nothing else in the UI changed.

### Opus usage
- First build call: [usage: in=28017, out=16000]. It returned NO text: the entire 16000 output tokens were spent before any block was emitted (adaptive thinking consumed the cap). Recorded as spend, retried once per the mission's failure rule with a 32000 cap and an output economy instruction.
- Retry build call: [usage: in=28114, out=23556]. Five blocks, all anchors matched exactly once, applied cleanly.
- Step total: in=56131, out=39556. Cycle 6 running total: in=73791, out=44150. Recorded grand total across cycles (sum of the usage lines in this log; Cycle 5 step 1 and the Cycle 2 judge calls were never recorded, so the true total is higher): in=143716, out=101976.

### Test and verification results (run by the orchestrator)
- `node --check js/sim.js` and `node --check js/main.js`: pass. Em dash scan of both files: zero.
- `node --test tests/sim.test.js`: 32 pass, 0 fail (suite unchanged this step; the formal simultaneous resolution tests are step 4).
- Order reversal determinism: a busy movement phase (two player groups attacking and moving, three enemy groups moving, one defender group ordered away from an attacked province) run on two identical states, one with state.units reversed, produces identical results: same units, positions, strengths, owners, and game over state. PASS.
- Edge swap: an isolated player infantry at p4_3 and enemy infantry at p5_3 ordered across the same edge at each other did NOT pass through. They met on the road (log: "Vessari and Khessite columns meet on the road between Belfeld and Ashmund. The Vessari win and march on to Ashmund."), the enemy infantry was destroyed, and the player survivor (strength 2) marched on and took its target. PASS.
- Defender drawn into defense: both enemy units at p5_3 were ordered north to p5_2 while a player stack attacked p5_3; neither marched away, both fought as defenders from the snapshot and died there. PASS.
- Balance anchor (full passive games, all 8 standard seeds): the player capital falls on day 36 on every seed, exactly the Cycle 5 measurement, so removing player-first resolution did not shift the passive band. The sensible and reckless reruns belong to step 4.

### Lessons
- Output caps are a real build risk with this model: a 16000 token cap produced zero usable text on a brief whose answer needed about 21000 characters. Build calls for whole phase rewrites should start at 32000, and the wasted call still counts in the usage ledger above.
- The one engagement per unit rule is what makes simultaneity tractable: assignment priority (road first, then province defense, then clashes) removes the double fighting and pass-through cases by construction, and per engagement rng seeds make order independence provable rather than hoped for.

## Cycle 6, Close the loop, fix the clock, Step 3 of 5: locked slots in the production panel, UI (2026-10-13)

Prescription: Cycle 5 judge verdict, item (A), second half: locked slots shown in the panel with the exact unlock condition in plain words, no silent absence. This run did step 3 only. Step 4 (tests and balance) and step 5 (judge) remain. All code in this step was authored by Claude Opus 5.5 through the direct Anthropic line (3 anchor replacement blocks, applied verbatim by the orchestrator); the orchestrator wrote the brief, ran every check itself, and verified the panel in a real browser.

### What Opus built
- `js/main.js`, renderProduction only: it now calls Sim.syncProductionLines(state, 'player') first, so the panel always matches the slots the sim has earned (an earned line appears the moment factories reach the threshold, not after the next production phase). After the live line rows, one locked row renders for each line id above the real line count up to CFG.maxProductionLines where Sim.lineLockInfo returns non-null. A locked row is titled "Line N: Locked", states the condition from the sim's own numbers in exactly this shape: "Line 3 locked. Build 9 more factory levels anywhere to unlock it (needs 16 total factory levels, you have 7)." (singular "factory level" when exactly 1 is missing), and adds the note "This line appears here on its own the day your factories reach the total. Nothing to click yet." Locked rows have no buttons. Nothing else in main.js changed.
- `css/style.css`: two appended rules only. Locked rows get a dashed border in the existing palette color and 0.75 opacity; the condition text uses the existing muted color. Live rows are untouched.

### Opus usage
- Build call: [usage: in=12000, out=1101]. One call, no fix rounds: all 3 anchors matched exactly once and the result passed every check below on the first run.
- Step total: in=12000, out=1101. Cycle 6 running total: in=85791, out=45251. Recorded grand total across cycles (sum of the usage lines in this log; Cycle 5 step 1 and the Cycle 2 judge calls were never recorded, so the true total is higher): in=155716, out=103077.

### Test and verification results (run by the orchestrator)
- `node --check js/main.js`: pass. Em dash scan of js/main.js and css/style.css: zero.
- `node --test tests/sim.test.js`: 32 pass, 0 fail (suite unchanged this step; the formal line gating tests are step 4).
- Real browser check (orchestrator, headless Chromium at /opt/meta-chromium/chrome over CDP against the actual repo index.html, fresh random seed): at day 3 with 7 total factory levels the panel rendered exactly 2 live rows and 2 locked rows. Both locked rows carried zero buttons and the nothing to click note. The condition text matched the live factory total exactly for both slots: line 3 "Build 9 more factory levels anywhere to unlock it (needs 16 total factory levels, you have 7)" and line 4 the same shape with 17 more and 24 needed. Screenshot inspected by the orchestrator: the locked rows sit below the live lines, visibly dimmed and dashed, wording legible.
- One honest gap: a best effort attempt to drive the unlock transition through pure UI clicks in the same session (clicking provinces and the real Build Factory button whenever affordable, at speed 2) did not reach 16 total factory levels: the unattended clicker never defended and its capital fell on day 36, the standard passive fall day. The transition itself (locked row replaced by a working line at the threshold) is verified at sim level from step 1, where a line earned at 16 queued and deployed a unit; the formal tests for it are step 4, and step 4's prescribed browser check is of this locked slot UI, which is now done and passed.

### Lessons
- The panel sync call closes a real legibility hole the brief almost missed: without it, a line earned by a factory build would have stayed invisible until the next production phase while its locked row vanished (lineLockInfo already returns null), leaving neither row on screen for a beat. Syncing at render makes the panel and the sim agree at every instant the player can look.
- Driving an unlock through raw UI clicks is a balance question in disguise: an undefended economy cannot outbuild the day 36 fall. That is the passive band working as designed, not a UI defect, and it is why the step 4 sensible trace (which defends while building) is the right vehicle for showing the factory to line path.

## Cycle 6, Close the loop, fix the clock, Step 4 of 5: tests and balance (2026-10-13)

Prescription: Cycle 5 judge verdict, exit criteria for Cycle 6: formal tests for line slot count, locked queue rejection, AI parity, order reversal determinism, and the edge swap meeting battle; the balance rerun on the 8 standard seeds; a sensible trace using the factory to line path; and a real browser render check of the locked slot UI. Steps 1 (sim gating), 2 (simultaneous battles), and 3 (locked slot panel) are done. Step 5 (judge) remains. Builder note: this step was built directly by the orchestrator in its own context, per Jash's 2026-10-13 builder change recorded in this run's mission; no Anthropic line call was made for building, fixing, testing, or judging in this step.

### Sync in
- The GitHub copy fetched at run start was BEHIND local: it carried the step 2 state (17:20) while local HEAD was step 3 (94be7a1, 17:29). GitHub had no content the local repo lacks, so nothing was copied in and nothing of the collaborator's was overwritten. The local step 3 commits had not reached GitHub yet; they go out with this run's sync out.

### What was built
- `tests/sim.test.js` only (commit 874851b, a pure append of 7 tests before the Cycle 5 step 4 section, no existing test touched, no sim or UI code changed this step):
  - Line slots on the standard seeds: all 8 seeds start both nations below 16 total factory levels with exactly 2 lines, line 3 locked with missing equal to 16 minus the live total.
  - Thresholds: at 15 total nothing opens (line 3 missing 1, line 4 missing 9); at 16 line 3 opens with template infantry and line 4 is missing 8; at 23 nothing more; at 24 line 4 opens with template drone; at 30 the hard cap of 4 still holds and slot 5 returns "no such production line"; and permanence: dropping to 0 factories after unlocking leaves line 3 open and queueable.
  - Locked rejection: queue and retool on a locked line return ok false with locked true and the exact numbers, including the verbatim reason strings at the live total, at 15 ("Build 1 more factory level", singular), and for line 4 at 16 ("Build 8 more factory levels, needs 24, you have 16"). A rejection creates no phantom line, no queue, and no log entry.
  - AI parity: at 16 total factory levels for both nations the enemy opens the same line 3 with the same template, queues it for the same 30 steel over 6 days at the same drain, and completes it on the same production day deploying at its own capital. A second parity test runs one real tick at 16 enemy factory levels and finds the AI with line 3 open and one order queued on it through the real tick path, while the player gained no line.
  - Order reversal determinism: a busy movement phase (a player attack group, a player move group, defenders at p5_3 ordered away east, an enemy move group, and the enemy capital group marching west) run through movementPhase on two identical states, one with state.units reversed, produces identical units, positions, strengths, owners, and game over state. The test also asserts the phase was not vacuous (strengths fell and the unopposed groups marched).
  - Edge swap meeting battle: a full strength player infantry at p4_3 and a weakened (strength 1) enemy infantry at p5_3 ordered across the same edge at each other meet on the road: the enemy is destroyed, the winner's strength drops below 12 (it paid for the road), it marches on to p5_3 and takes the province, no enemy unit passes through to p4_3, and the log carries the "meet on the road" line.
- Suite: `node --test tests/sim.test.js`: 39 pass, 0 fail (32 before, 7 new). `node --check` passes on js/sim.js, js/main.js, and tests/sim.test.js. Em dash scan of the repo: zero.

### Balance rerun (orchestrator harness, public commands only)
- The harness is orchestrator glue written for this run (the Cycle 5 harness was never in the repo, so this script was rebuilt from the Cycle 5 log descriptions plus two rules this cycle adds; harness rules are listed so the numbers can be judged against them). Profiles use only public commands: queueProduction, buildFactory, buildRail, researchDroneGen2, issueOrder. No state edits, no teleports. Day convention matches the prior entries in this log: the day reported is state.day after the ending tick (the passive fall reads 36 under it, exactly as in Cycles 5 and 6 step 2).
- Sensible player: queues every idle line (line 3 included once open), researches Drone Gen 2, builds rail one edge per day toward the easternmost unsupplied owned province keeping a 40 steel buffer, keeps the 2 starting capital infantry as garrison, masses every other unit at the easternmost owned capital row province, and attacks only eastward along the capital row with at least 5 units massed, at least 1.5x stackPower edge, and no unit in the attacking stack carrying a supply penalty at order time. Factory to line rule: at most one factory build per day, only in heartland provinces (x at most 4, never on captured ground), only when steel income covers the added upkeep plus a full 3 line production drain with 5 to spare.
- Passive player (never acts): capital falls on day 36 on all 8 seeds, inside the 30 to 45 band, unchanged from Cycles 5 and 6 step 2.
- Sensible player: wins 8 of 8, all by capturing Khessograd, on day 25 on all 8 seeds (state.day after the ending tick). End strength as percent of the starting 72: seed 1: 147.2, 7: 156.9, 42: 156.9, 99: 155.6, 1234: 154.2, 555: 140.3, 2024: 225.0, 31337: 152.8. The 20 percent floor clears on every seed. Counting only surviving units of the original starting army, strength left is 33.3 percent on 7 seeds and 41.7 percent on seed 2024, so the floor clears with reinforcements excluded too. Win integrity check on seed 42: on the tick before the capture the enemy capital held 6 Dominion units (the 3 garrison plus reinforcements), and the log records the capture "after a hard fight"; the win comes from a massed, railed, supplied stack through the public command path, not from an empty capital or a defect.
- Reckless player (capital units vacate north and never return, exactly one field unit acts per day toward the enemy capital, never builds rail, still queues production): loses 8 of 8, its capital falls on day 37 on all 8 seeds.
- Factory to line trace, seed 2024 (the prescribed at least one seed): day 1 buildFactory in the heartland takes the total to 11, then one build per day on days 2, 3, 4, and 6 reaches 12, 13, 14, 15, and on day 7 a build in a second heartland province reaches exactly 16 total factory levels; the same day the sync opens line 3 (3 line objects, unlockedLineCount 3) and the script queues an infantry order on line 3 through queueProduction (30 steel over 6 days). The campaign then wins by capital capture on day 25 with line 3 still open (final total 19 factory levels). Other seeds also build toward 16 under the same rules (seed 31337 reached 12 built levels and 15 total by capture day); seed 2024 is the one that crosses the threshold by building, as required.
- Capture day honesty note: sensible captured on day 43 to 52 in Cycle 5 and on day 25 here. The sim changed between those measurements (Cycle 6 step 2 simultaneous resolution), and this run's rebuilt script differs from the Cycle 5 glue in its stated details (the supply penalty attack gate and the factory rules above), so 25 versus 43 to 52 is two measurements of two related scripts on two sim versions, recorded as measured, not as a like for like regression claim. The exit bands themselves (passive 30 to 45, sensible 8 of 8 over the floor, reckless 0 of 8) all pass with margin.

### Browser render check (real Chromium, this step)
- Headless Chromium at /opt/meta-chromium/chrome driven over CDP against the actual repo index.html (not a stub): at day 3 on a fresh random seed with 10 total factory levels shown in the nation panel, the production panel rendered exactly 2 live rows and 2 locked rows. Locked row texts matched the live total exactly: line 3 "Build 6 more factory levels anywhere to unlock it (needs 16 total factory levels, you have 10)" and line 4 the same shape with 14 more and 24 needed. Both locked rows carried zero buttons and the nothing to click note. A screenshot of the panel was inspected: the locked rows sit below the live lines, dashed and dimmed, wording legible, live rows keep their Queue and Retool buttons.

### Lessons
- The first draft of this run's sensible script failed the bands (2 seeds lost, 2 more only survived to the campaign end): it built factories on captured frontier provinces (the levels were lost with the ground, and totals kept slipping back under 16) and rushed the total upward from day 1, raising daily steel upkeep until production starved. The disciplined version (heartland only, a steel headroom gate, one build per day) plus holding attacks until no attacker carried a supply penalty at order time restored 8 of 8 captures with no sim change. A factory is a steel commitment before it is a line unlock; where and when the script builds matters as much as how many.
- Seed 31337 in the early drafts is the warning case: its field army collapsed in one mid game battle fought into a stronger position while its supply penalties were live at tick level. The supply gate at order time is one tick behind the penalty the supply phase is about to apply, which the log states openly rather than hiding behind the word supplied.
- Balance harnesses need to live somewhere durable or be rebuilt from their log descriptions every cycle; this is the second cycle rebuilt from prose. The step 5 judge may want to rule on whether the harness should be committed as a repo file in a later cycle.

## Cycle 6 reconciliation: parallel steps 3 and 4 ported onto master (2026-10-13)

Builder: the Claude Code builder session, on Jash's instruction: master is the base, the parallel branch's unique work is ported onto it in small committed slices, with the full suite and the balance rerun after each slice. Vector's loop has stopped and will not build further; this session now holds the build.

### What happened
The Claude Code session built Cycle 6 steps 3 and 4 on branch claude/adoring-johnson-cf5bmq (PR jashshah854-a11y/ashes-game#1) and claimed each step in CYCLE_LOG.md on that branch only. Vector's loop reads master, never saw the claims, and built both steps on master (entries above). Process lesson, binding from here: a claim only counts where the other builder reads it, so a claim goes on the shared branch or it is not a claim.

### Kept, dropped, and why (decided before porting)
- Kept, the balance harness tools/balance.js: master has no committed harness (Vector's step 4 script was session glue, the third rebuilt from prose).
- Kept, one test: the busy order reversal scenario. Evidence: five mutated sims were run against master's own 39 tests. Master already fails on four (meeting battles disabled, engagement rng tied to array order, slot 4 reading slot 3's threshold, unlocks relocking) but stays green when defenders ordered elsewhere are not drawn into the battle for their province. The branch's reversal test fails on that mutant.
- Dropped, the branch's slot count, locked rejection, AI parity, and edge swap tests, and its lock info test: each duplicates master coverage that already fails on the matching mutants.
- Dropped, the branch's locked slot rows and their CSS: master's rows (Vector's step 3) stay. They carry the same live numbers plus the "nothing to click yet" note.
- Dropped, the branch's buildFactory line sync: master's renderProduction syncs on every render, which closes the same legibility gap in the UI, and queueProduction and productionPhase already sync for the rules.
- Kept, the factory card sentence stating the unlock thresholds, the live total, and permanence: master states the rule only in the production card.
- Kept, the two sim slices from the branch's step 4 (AI research on start of day numbers; production lines paid before factories, Jash's call), each with its test, plus the idle factory text on the nation card.

### Slice 1: the balance harness
- `tools/balance.js` ported as written on the branch, except that both sensible profiles start as ruling paths. The no factory script only becomes report only in slice 5, with the economy change Jash ruled on.
- Suite: 39 pass, 0 fail (unchanged, the harness is not a test file).
- Harness on master's sim, 8 standard seeds: passive falls on day 36 on all 8 (PASS). Reckless loses 8 of 8 (PASS). Sensible without factories wins 7 of 8 and loses seed 31337 (FAIL). Sensible with factories wins 1 of 8 (FAIL). Seeds 1 to 200: passive 0 survive; sensible 189; factories 27; reckless survives seed 22 only.
- Why this does not contradict master's step 4 "bands met": Vector's uncommitted script used different rules (a supply penalty attack gate, heartland only factory builds behind a steel headroom gate, one build per day), and the log describes it in prose only. Its own lesson is the same finding seen from the other side: the factory path starved production unless the script rationed it. The harness's factories profile builds toward the next line without rationing, which is what a player reading "Build N more factory levels to unlock" would do.

### Slice 2: the drawn in defender test
- `tests/sim.test.js`: a pure append of the branch's busy order reversal scenario (one movement phase holding a province battle whose defenders were ordered elsewhere, a road meeting, a clash over empty ground, and a plain move, run twice with state.units reversed), renamed "every engagement kind is order independent, and ordered defenders still defend".
- Suite: 40 pass, 0 fail. Against the mutant that stops drawing ordered defenders into the battle for their province, this test fails and every other test passes, so it closes the one gap the mutation check found.
- Balance rerun: unchanged from slice 1 (tests do not touch the sim).

### Slice 3: the factory card states the line unlock rule
- `js/main.js`: a new lineUnlockText() builds a sentence from CFG.lineUnlockFactoryLevels and the live total, appended to the factory card on your own provinces, for example "Your total factory levels across all provinces also unlock production lines: Line 3 opens at 16, line 4 opens at 24 (you have 7). An unlocked line stays open even if you later lose factories." The rule is now stated where the player builds factories, not only in the production card.
- Suite: 40 pass, 0 fail. Balance rerun: unchanged from slice 1 (UI only). Browser check: with slice 5, which touches the same cards.

### Slice 4: the AI decides research on start of day numbers
- `js/sim.js`: the AI's research decision moves out of aiTakeTurn (which runs after the economy phase has added the day's points) into a new aiResearch called first in tick, the same moment a player's click lands. With identical points the AI had fielded Drone Gen 2 one day before the player could; that head start lost sensible seed 31337 once simultaneous battles stopped masking it (full trace in the parallel branch's step 4 entry above). Moving the whole AI turn instead was measured on the branch and rejected as a big rebalance (a passive player survived 19 of 200).
- New test: with equal points, a player who researches as soon as the panel allows fields Gen 2 on the same day as the AI (seed 31337). Suite: 41 pass, 0 fail.
- Balance rerun, 8 standard seeds: passive day 36 on all 8 (PASS); sensible without factories wins 8 of 8 (now PASS, seed 31337 recovered); sensible with factories 2 of 8 (FAIL, the trap slice 5 fixes); reckless loses 8 of 8 (PASS). Seeds 1 to 200: passive 0 survive; sensible 190 (was 189); factories 28; reckless survives seed 22 only.
