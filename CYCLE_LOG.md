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
