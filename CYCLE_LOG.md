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
