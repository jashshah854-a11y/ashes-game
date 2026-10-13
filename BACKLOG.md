# Ashes of Empires, Backlog

Honest list of what is stubbed, simplified, or missing. If it is not in the
game, it is written here. Nothing in this file is secretly faked in the code.

## Stubbed or simplified (current, after Cycle 5 step 4)

- Combat ordering: player attack groups resolve before AI groups each day. Real simultaneous resolution is a future fix.
- Passing through: opposing units can swap provinces in one day without fighting if both march past each other. Battles only happen when a unit enters a held province.
- Battle model: simultaneous damage rounds, damage soaks into the first unit of a stack, no terrain, no fortification bonus, no retreat. Supply penalties do apply to attack and defense through unitStats.
- AI: scripted rules only. Since Cycle 3 it decides per battle group with the shared stackPower estimate, needs 1.5x superiority to attack a defended province, will not attack while out of supply, builds rail toward its front every few days, and waits out a 10-day mobilization. Since Cycle 5 step 4 it holds a garrison of the first 3 idle units on its own capital (they receive no orders; units beyond 3 advance normally). It never plans beyond the next province, never builds drones vs infantry by strategy, and its research is a timer, not a choice.
- Balance state after Cycle 5 step 4 (measured, see CYCLE_LOG): a passive player who never acts loses the capital on day 36 on all 8 prescribed seeds; a scripted sensible player captures the enemy capital 8 of 8 on days 43 to 52, with end strength 81.9 to 144.4 percent of the 72 starting strength; a scripted reckless player (abandons the capital lane, attacks piecemeal, never builds rail) loses 8 of 8. Tuning belongs to later cycles, especially once fortifications exist.
- Economy: one equipment stockpile and one resource (steel). No manpower, no fuel, no upkeep, no partial unit reinforcement. Exact factory economics: building a factory level costs equipment (40 times the target level); running factories consume steel (2 per level per day) and produce equipment (5 per level per day). Since Cycle 5 step 1, units are built on production lines over days for steel and deploy at the capital; equipment no longer buys units and funds factory construction only. The Cycle 5 judge ruled that factories must gate production line count (not build speed), acceptable as factory-only currency for one more cycle only; that gating is Cycle 6 work, not built yet.
- Research: exactly one item (Drone Gen 2). Points accrue at a flat daily rate with no labs, no choices, no EW tree.
- Map: the rules run on an explicit typed-edge graph since Cycle 3 (land and river edges; coastal is a province flag). The renderer still draws a flat 10 by 7 grid with 4-direction movement, province names are syllable generated, terrain types have no combat effect yet, no sea provinces, no province shapes.
- UI: full re-render of the map every tick, no animations, no sound, no save or load, no minimap, no tooltips beyond the hint text. Selected unit orders show in the unit card only, not as arrows on the map.

- Production lines (Cycle 5, all 4 steps done, judge PASS): each nation has 2 lines (line 1 infantry, line 2 drone at start), a queue cap of 9 per line, no way to cancel or refund a queued order, and no way to pause a line (cancel and pause are parked pending Jash's call, see DECISIONS_FOR_JASH.md); retooling scraps work in progress with no steel refund, and the panel now states the steel that will be lost before the player acts. The production panel (step 2) shows each line, its template, queue, days remaining, and steel drain, and the unit card shows unit cost; the old train buttons are gone. Line count is not yet gated by factories; that is prescribed for Cycle 6 by the Cycle 5 judge, together with simultaneous battle resolution.

## Done since Iteration 1 (kept honest, limits noted)

- Production lines and unit costs (Cycle 5 step 1): lines assigned a template, steel cost per unit paid as a daily drain over build days (infantry 30 steel over 6 days, drone 15 steel over 3 days, 5 steel per day per working line), finished units deploy at the capital, and the AI orders through the identical lines and costs. A day the stockpile cannot pay the drain is a stalled day with no progress, so rail building and unit production compete for the same steel.
- Production tests and balance rerun (Cycle 5 step 3): 10 Opus authored tests pin budget parity between player and AI, queue completion timing (infantry on the 6th funded day for 30 steel, drone on the 3rd for 15, sequential queues, cap of 9), and steel starvation where a rail purchase up front stalls a production line with no progress and no charge. Balance rerun on the unchanged sim: passive player falls on day 36 on all 8 prescribed seeds, scripted sensible player survives 8 of 8, all by capital capture on day 28. Suite is now 30 tests, all passing. (The day 28 capture result was superseded in step 4: the Dominion capital garrison fix slowed sensible wins to days 43 to 52, still 8 of 8.)
- Balance ruling checks, garrison fix, and judge pass (Cycle 5 step 4): Jash's ruling checks run on all 8 seeds. The reckless check failed pre-fix (reckless won 5 of 8 by walking into a Khessograd the AI had abandoned on day 1) and passed post-fix (reckless loses 8 of 8); the sensible check passed before and after (8 of 8 capital captures through the public command path, end strength 81.9 to 144.4 percent of starting 72, floor is 20 percent). Fix: the Dominion holds its first 3 idle capital units as a garrison. Judge verdict PASS with all fix-now flags closed in the same step: garrison and retool tests (suite now 32, all passing), the retool note stating the steel at risk, and a real headless Chromium render and interaction check of the production panel and unit cost card.
- Production panel (Cycle 5 step 2): a Production card lists both player lines with template, full cost and build days, queue count against the cap, days paid and days left on the unit in progress, steel drain per day, a stalled warning when a day goes unpaid, and queue and retool buttons per line. A summary line shows total production drain and queued units, and the selected unit card now shows its build cost. The old province card train buttons were removed.
- Rail network and supply (Cycle 3): rail edges buildable for steel over days, supply computed over the owner's rail net within 8 hops, out-of-supply penalties and attrition as named, visible modifiers, captured rail converts over 4 days before it feeds the capturer. Limits: no rail levels or capacity, no supply effect on the economy, hover route highlighting not built (the inspector states the reason instead).

## Bible v1 systems not yet started (future cycles, Jash gated)

- Fortifications (construction verb, and a defense bonus in combat).
- Navy at theater scale: coastal control, river crossings, blockade pressure on the economy.
- Air layer beyond drone wings as ground-adjacent units: interception and the drone cost-exchange scoreboard (who bleeds money faster), which is a signature mechanic and deserves its own cycle.
- EW arms race: jamming generations countering drone generations in the research tree.
- Intel and recon: fog of war, drone recon lifting it, finding soft spots.
- Production line efficiency over time (lines exist since Cycle 5 step 1 and can be retooled; output does not ramp with experience yet).
- Lore: nation backstories in an in-game codex, event cards that fire as the campaign unfolds, named characters or grudges. Current lore is names only.
- Multiple AI rivals and a second theater.
- Save and load, campaign scoring screen, difficulty settings.

## Explicitly out of scope for v1 (per the bible, do not build)

World map, hundreds of nations, deep diplomacy, political parties, global trade market, naval invasions, multiple playable nations.
