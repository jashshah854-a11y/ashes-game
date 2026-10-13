# Ashes of Empires: design bible v0
Written Mon 2026-10-12, ~midnight, from Jash's direction in main chat. This document is the law for the build loop. The judge (Claude Opus 5.5) grades against this, not against vibes.

## The game in one sentence
A real-time-with-pause grand strategy game in a fictional world: HOI4's war, Civ VII's visible upgrades, EU5's lore depth, and nothing the player needs a wiki to operate.

## The design compass (Jash's own words, distilled)
- HOI4 has his heart: production lines, divisions, frontlines that bend. That is the skeleton.
- Civ VII: he loves upgrading things and watching how cool they become. Progression must be VISIBLE on the map. A country in year 3 must look like a different animal from year 1.
- EU5: lore and depth. The world existed before the player pressed start. Nations have history and grudges. Events tell the story of the place while it is conquered.
- Stellaris is the warning: amazing, but he cannot understand how to use it. Rule: depth is welcome, opacity is failure. Every system explains itself on screen at the moment the player touches it.

## The core fantasy
Start weak. Build. Watch your country become visibly powerful because you made it powerful. The compounding loop is the game: factories feed production, production feeds the army, the army takes ground, the ground holds resources, resources build more factories.

## Signature mechanics (what makes this ours, not a clone)
- Drone cost-exchange: a cheap drone that forces an expensive interceptor launch is a victory even when the drone dies. The scoreboard tracks who bleeds money faster, not only who holds ground.
- EW arms race: drone generations and jamming generations counter each other through the research tree.
- Rail is supply: railroads are how the front eats. Cut the rail, starve the front.
- Intel as sight: the spy network is drone recon plus agents. It lifts fog and finds soft spots. Spying is how you see, not a side menu.

## Systems: in for v1 (theater scale, full verbs)
Real-time tick with pause and speed controls. Province map, one fictional theater, one playable nation plus AI rivals. Economy (factories, resources). Construction (factories, fortifications, rail). Production lines the player can retool. Army units and frontline combat. Air layer including drones. Navy at theater scale (coastal control, river crossings, a blockade pressure on the economy). Intel/recon. Research tree (drone generations, EW generations, industry). Lore events delivered as event cards.

## Systems: out for v1 (do not build, do not stub secretly)
World map, hundreds of nations, deep diplomacy, political parties, global trade market, naval invasions, multiple playable nations. Expansions after v1 ships, decided by Jash.

## World
Fictional (the Ashes setting). Nations get written backstories before they get stats. Lore is content, not decoration.

## Loop rules (how this gets built)
- Builder: Muse subagents in the sandbox repo (~/workspace/ashes-game). Vanilla JS, node tests for the simulation core. Git commits per cycle.
- Judge: Claude Opus 5.5 at high reasoning, called through the direct Anthropic line, billed to Jash's Agent SDK credit (authorized by Jash 2026-10-12 for this project). The judge grades each iteration against this bible plus test results: does it run, does it match the compass, is the new system legible on screen.
- Recall: every cycle reads CYCLE_LOG.md first and appends what was built, the judge verdict, and the lesson. That log is the loop's memory.
- Human gate: spec-level calls (does it match the bible) are the loop's to make. Taste-level calls (is this fun, is this the right feel) are NEVER made by impersonating Jash. They go into DECISIONS_FOR_JASH.md and wait for him. This is Jash's own doctrine: agents brief, humans decide.
- Stop conditions for unattended running: 3 consecutive failed judge verdicts, a broken build that survives 2 fix attempts, or the cycle budget for the night is spent. On stop: write the state plainly in CYCLE_LOG.md and wait.
- No em dashes in any game copy, docs, or logs.

## Iteration 1: definition of done
A playable skeleton, ugly is fine, running is not negotiable:
- A province map (grid or region layout) of a fictional theater, 2 nations, capitals marked.
- Real-time tick with pause and 2 speeds, day counter.
- Economy tick: factories produce equipment stockpile; resources gate production.
- Units on provinces; player can select and order a move/attack; simple combat resolution; provinces change owner and color.
- One visible upgrade: build or upgrade a factory in a province; its on-map representation changes with level.
- One research item (Drone Gen 2) that visibly changes drone unit stats.
- Win/lose stub: capture the enemy capital or survive to the campaign end date.
- Node unit tests for tick, economy, and combat functions, all passing. A CYCLE_LOG.md entry and a BACKLOG.md listing what is stubbed.
