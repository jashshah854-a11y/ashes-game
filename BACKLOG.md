# Ashes of Empires, Backlog

Honest list of what is stubbed, simplified, or missing. If it is not in the
game, it is written here. Nothing in this file is secretly faked in the code.

## Stubbed or simplified in Iteration 1

- Combat ordering: player attack groups resolve before AI groups each day. Real simultaneous resolution is a future fix.
- Passing through: opposing units can swap provinces in one day without fighting if both march past each other. Battles only happen when a unit enters a held province.
- Battle model: simultaneous damage rounds, damage soaks into the first unit of a stack, no terrain, no fortification bonus, no retreat, no supply effects.
- AI: scripted rules only. It attacks single provinces with whatever group shares an origin, never plans, never defends its capital on purpose, never builds drones vs infantry by strategy, and its research is a timer, not a choice.
- Balance state at end of Iteration 1: a passive player survives to the campaign end; a reckless player loses the capital in 7 to 15 days because the middle row is a fast open lane once abandoned; scripted attackers never captured the enemy capital, so capital capture by concentrated human play is proven as a mechanic (unit test) but not yet proven as an achievable strategy. Tuning belongs to a later cycle.
- Economy: one equipment stockpile and one resource (steel). No manpower, no fuel, no upkeep, no production lines to retool, no partial unit reinforcement. Units are bought whole at a factory province and appear instantly.
- Research: exactly one item (Drone Gen 2). Points accrue at a flat daily rate with no labs, no choices, no EW tree.
- Map: flat 10 by 7 grid, 4-direction movement, province names generated from syllables. No terrain types (the river line in the fiction is not modeled), no sea provinces, no province shapes.
- UI: full re-render of the map every tick, no animations, no sound, no save or load, no minimap, no tooltips beyond the hint text. Selected unit orders show in the unit card only, not as arrows on the map.

## Bible v1 systems not yet started (future cycles, Jash gated)

- Fortifications (construction verb, and a defense bonus in combat).
- Rail network and supply: rail as how the front eats, cut rail to starve a front.
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
