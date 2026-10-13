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
