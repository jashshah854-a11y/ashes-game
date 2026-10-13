# Ashes of Empires, Backlog

Honest list of what is stubbed, simplified, or missing. If it is not in the
game, it is written here. Nothing in this file is secretly faked in the code.

## Stubbed or simplified (current, after Cycle 3)

- Combat ordering: player attack groups resolve before AI groups each day. Real simultaneous resolution is a future fix.
- Passing through: opposing units can swap provinces in one day without fighting if both march past each other. Battles only happen when a unit enters a held province.
- Battle model: simultaneous damage rounds, damage soaks into the first unit of a stack, no terrain, no fortification bonus, no retreat, no supply effects.
- AI: scripted rules only. Since Cycle 3 it decides per battle group with the shared stackPower estimate, needs 1.5x superiority to attack a defended province, will not attack while out of supply, builds rail toward its front every few days, and waits out a 10-day mobilization. It never plans beyond the next province, never defends its capital on purpose, never builds drones vs infantry by strategy, and its research is a timer, not a choice.
- Balance state after Cycle 3 (measured, see CYCLE_LOG): a passive player who never acts loses the capital around day 36 (Iteration 1's endless stall was a broken AI gate, not balance); a scripted sensible player survives 8 of 8 seeds with the front near the third column; capital capture by concentrated human play is still not proven as an achievable strategy. Tuning belongs to later cycles, especially once fortifications exist.
- Economy: one equipment stockpile and one resource (steel). No manpower, no fuel, no upkeep, no production lines to retool, no partial unit reinforcement. Units are bought whole at a factory province and appear instantly.
- Research: exactly one item (Drone Gen 2). Points accrue at a flat daily rate with no labs, no choices, no EW tree.
- Map: the rules run on an explicit typed-edge graph since Cycle 3 (land and river edges; coastal is a province flag). The renderer still draws a flat 10 by 7 grid with 4-direction movement, province names are syllable generated, terrain types have no combat effect yet, no sea provinces, no province shapes.
- UI: full re-render of the map every tick, no animations, no sound, no save or load, no minimap, no tooltips beyond the hint text. Selected unit orders show in the unit card only, not as arrows on the map.

## Done since Iteration 1 (kept honest, limits noted)

- Rail network and supply (Cycle 3): rail edges buildable for steel over days, supply computed over the owner's rail net within 8 hops, out-of-supply penalties and attrition as named, visible modifiers, captured rail converts over 4 days before it feeds the capturer. Limits: no rail levels or capacity, no supply effect on the economy, hover route highlighting not built (the inspector states the reason instead).

## Bible v1 systems not yet started (future cycles, Jash gated)

- Fortifications (construction verb, and a defense bonus in combat).
- Navy at theater scale: coastal control, river crossings, blockade pressure on the economy.
- Air layer beyond drone wings as ground-adjacent units: interception and the drone cost-exchange scoreboard (who bleeds money faster), which is a signature mechanic and deserves its own cycle.
- EW arms race: jamming generations countering drone generations in the research tree.
- Intel and recon: fog of war, drone recon lifting it, finding soft spots.
- Production lines the player can retool, with efficiency over time.
- Lore: nation backstories in an in-game codex, event cards that fire as the campaign unfolds, named characters or grudges. Current lore is names only.
- Multiple AI rivals and a second theater.
- Save and load, campaign scoring screen, difficulty settings.

## Explicitly out of scope for v1 (per the bible, do not build)

World map, hundreds of nations, deep diplomacy, political parties, global trade market, naval invasions, multiple playable nations.
