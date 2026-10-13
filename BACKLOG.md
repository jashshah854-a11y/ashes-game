# Ashes of Empires, Backlog

Honest list of what is stubbed, simplified, or missing. If it is not in the
game, it is written here. Nothing in this file is secretly faked in the code.

## Stubbed or simplified (current, after Cycle 5 step 2)

- Combat ordering: player attack groups resolve before AI groups each day. Real simultaneous resolution is a future fix.
- Passing through: opposing units can swap provinces in one day without fighting if both march past each other. Battles only happen when a unit enters a held province.
- Battle model: simultaneous damage rounds, damage soaks into the first unit of a stack, no terrain, no fortification bonus, no retreat, no supply effects.
- AI: scripted rules only. Since Cycle 3 it decides per battle group with the shared stackPower estimate, needs 1.5x superiority to attack a defended province, will not attack while out of supply, builds rail toward its front every few days, and waits out a 10-day mobilization. It never plans beyond the next province, never defends its capital on purpose, never builds drones vs infantry by strategy, and its research is a timer, not a choice.
- Balance state after Cycle 3 (measured, see CYCLE_LOG): a passive player who never acts loses the capital around day 36 (Iteration 1's endless stall was a broken AI gate, not balance); a scripted sensible player survives 8 of 8 seeds with the front near the third column; capital capture by concentrated human play is still not proven as an achievable strategy. Tuning belongs to later cycles, especially once fortifications exist.
- Economy: one equipment stockpile and one resource (steel). No manpower, no fuel, no upkeep, no partial unit reinforcement. Since Cycle 5 step 1, units are built on production lines over days for steel and deploy at the capital; equipment no longer buys units and now funds factory construction only. Whether factories should also gate line count or build speed is an open design question, flagged for the Cycle 5 judge pass.
- Research: exactly one item (Drone Gen 2). Points accrue at a flat daily rate with no labs, no choices, no EW tree.
- Map: the rules run on an explicit typed-edge graph since Cycle 3 (land and river edges; coastal is a province flag). The renderer still draws a flat 10 by 7 grid with 4-direction movement, province names are syllable generated, terrain types have no combat effect yet, no sea provinces, no province shapes.
- UI: full re-render of the map every tick, no animations, no sound, no save or load, no minimap, no tooltips beyond the hint text. Selected unit orders show in the unit card only, not as arrows on the map.

- Production lines (Cycle 5, steps 1 and 2 of 4 done): each nation has 2 lines (line 1 infantry, line 2 drone at start), a queue cap of 9 per line, no way to cancel or refund a queued order, and no way to pause a line; retooling scraps work in progress with no steel refund. The production panel (step 2) shows each line, its template, queue, days remaining, and steel drain, and the unit card shows unit cost; the old train buttons are gone. Formal production tests and the balance rerun are step 3, and the judge pass is step 4.

## Done since Iteration 1 (kept honest, limits noted)

- Production lines and unit costs (Cycle 5 step 1): lines assigned a template, steel cost per unit paid as a daily drain over build days (infantry 30 steel over 6 days, drone 15 steel over 3 days, 5 steel per day per working line), finished units deploy at the capital, and the AI orders through the identical lines and costs. A day the stockpile cannot pay the drain is a stalled day with no progress, so rail building and unit production compete for the same steel.
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
