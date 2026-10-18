# Cycle 16 Step 0a - Simulation State Inventory

## 1. Scope

This is Cycle 16 Step 0a, a half size state inventory audit of the Ashes of
Empires simulation core. It inventories the sim state tables below for the save
and load cycle. It covers the state object returned by `createGame` in
`js/sim.js`, its province and nation subobjects, its production lines, its
units, and the edge alias pair.

Step 0b is now included. The rng audit, the UI held state table, the
hazards table, and the wall clock and randomness grep are written below as
Sections 8 through 11.

Later Cycle 16 steps, defined once for reference: Step 0b is the deferred audit
parts named above; Step 1 is rng state into state; Step 2 is serialize and
deserialize; Step 3 is UI save and load controls; Step 4 is tests and balance;
Step 5 is milestone review.

All counts in this file were produced by running node against the real module.
The count method is stated beside each count. Every type is the JavaScript type
at creation.

## 2. Top Level State Object

`createGame(seed)` returns one plain object. Count method: node
`Object.keys(state).length` on a fresh `createGame(1)`. Result: 19 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| day | number | authoritative | Current campaign day, starts at 1 and advances once per tick. |
| seed | number | authoritative | Rng seed, the only input to map and start generation. |
| tickCount | number | authoritative | Total ticks run. Its load bearing use is the per engagement rng derivation from seed, tickCount, and the canonical engagement key. |
| mapW | number | authoritative | Province columns, from CFG at creation. |
| mapH | number | authoritative | Province rows, from CFG at creation. |
| provinces | object | authoritative | Province subobjects keyed by province id. |
| edges | object | alias | Edge lookup keyed by the two province ids joined with a vertical bar. |
| edgeList | array | alias | Edge array, references the same edge objects as edges. |
| units | array | authoritative | Live units, each a unit subobject. |
| nextUnitId | number | authoritative | Next unit id to hand out, starts at 1 in the constructor, and a fresh createGame returns 15 after the starting units are handed out. |
| gameOver | boolean | authoritative | True once a win condition is met. |
| winner | null | authoritative | Winning nation id, null until the war ends. |
| endReason | null | authoritative | Why the war ended, null until the war ends. |
| log | array | record | Event log entries, capped at 60 by shift. |
| beats | object | record | Campaign turning points, recorded once each. |
| textures | array | record | Recurring texture occurrences, recorded as they happen. |
| exchange | object | record | Cost exchange ledger, record only, no rule reads it. |
| intel | object | record | Intel snapshots and planted agents per nation, record only. |
| nations | object | authoritative | Nation subobjects keyed by player and enemy. |

The 19 keys were read from the live state object, not copied from the brief.

## 3. Province Subobject

`provinces` is an object keyed by province id. Count method: node
`Object.keys(state.provinces).length` on a fresh `createGame(1)`. Result: 70
entries, which matches `mapW * mapH` (10 * 7). Province object key count
method: node `Object.keys(state.provinces[id]).length` on any province.
Result: 12 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| id | string | authoritative | Province id, the same key used in the provinces object. |
| x | number | authoritative | Column index, a sim input, not a renderer value. |
| y | number | authoritative | Row index, a sim input, not a renderer value. |
| owner | string | authoritative | Owning nation id, player or enemy. |
| name | string | authoritative | Province display name, fixed at creation for the capitals. |
| steel | number | authoritative | Base steel in the ground, the income input. |
| factoryLevel | number | authoritative | Factory levels, gates how many production lines open. |
| isCapital | boolean | authoritative | True for the two capital provinces. |
| fortLevel | number | authoritative | Completed fortification levels, drives defense bonus. |
| fortBuild | null | authoritative | Null, or an object with toLevel and daysLeft while fortifying. |
| flotilla | null | authoritative | Null, or the nation id string of a stationed flotilla. |
| coastal | boolean | authoritative | True on the north and south rows, the navy gate. |

Sim readers of x, not a layout value: a grep of `js/sim.js` was run for the
readers and they were confirmed. `homeCoastalProvinces` reads `p.x` to split
coastal provinces by nation half. `startingOwner` reads `prov.x` to decide the
half a province belongs to. AI targeting sorts read `x` to order attack
options (closest to the heartland first, and west first). A renderer must not
move x without changing these rules.

Sim reader of y: the capital row beat test in `BEAT_TESTS.capitalRow` reads
`p.y`, taking the capital row from the player capital and testing whether a
nation holds ground on that row outside its starting half. A renderer must not
move y without changing that test.

Nested notes: `fortBuild` is null or an object with the keys toLevel and
daysLeft. `flotilla` is null or a nation id string.

## 4. Nation Subobject

`nations` has the keys player and enemy. Nation object key count method: node
`Object.keys(state.nations.player).length` on a fresh `createGame(1)`.
Result: 15 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| id | string | authoritative | Nation id, player or enemy. |
| name | string | authoritative | Full faction name. |
| short | string | authoritative | Short faction name used in log text. |
| equipment | number | authoritative | Equipment stock. |
| steel | number | authoritative | Steel stock, spent on rail and units. |
| researchPoints | number | authoritative | Research pool, spent on upgrades. |
| manpower | number | authoritative | Manpower pool, spent on units. |
| droneGen2 | boolean | authoritative | Drone generation 2 research flag. |
| droneGen3 | boolean | authoritative | Drone generation 3 research flag. |
| jammingGen | number | authoritative | Jamming generation level. |
| interceptors | number | authoritative | Interceptor stockpile, launched in defense. |
| agents | number | authoritative | Agent stockpile, planted in enemy ground. |
| flotillas | number | authoritative | Flotilla stockpile, stationed on coastlines. |
| capitalId | string | authoritative | Province id of the capital. |
| productionLines | array | authoritative | Production line subobjects for the nation. |

## 5. Production Line Subobject

Each nation starts with 2 lines. Count method: node
`state.nations.player.productionLines.length` on a fresh `createGame(1)`.
Result: 2. Line object key count method: node
`Object.keys(state.nations.player.productionLines[0]).length`. Result: 7 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| id | number | authoritative | Line number within the nation, starts at 1. |
| template | string | authoritative | Unit template the line is assigned to. |
| queue | number | authoritative | Orders waiting, the unit in production included. |
| progressDays | number | authoritative | Paid days of work on the current unit. |
| work | number | authoritative | Work points on the current unit. |
| efficiency | number | authoritative | Percent, floor 100, rises on funded working days. |
| stalled | boolean | authoritative | True when the last production day went unpaid. |

## 6. Unit Subobject

`units` is an array. Count method: node `state.units.length` on a fresh
`createGame(1)`. Result: 14 units. Unit object key count method: node
`Object.keys(state.units[0]).length`. Result: 10 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| id | number | authoritative | Unit id, unique across the map. |
| nation | string | authoritative | Owning nation id. |
| type | string | authoritative | Unit type key into CFG.unitTypes. |
| provinceId | string | authoritative | Province the unit stands in. |
| strength | number | authoritative | Current strength, falls in battle and attrition. |
| maxStrength | number | authoritative | Full strength from the unit type. |
| order | null | authoritative | Null, or an object with a target province id. |
| daysOut | number | authoritative | Consecutive days out of supply. |
| supplyPenalty | number | authoritative | Current percent penalty, 0 to the cap. |
| attritionCarry | number | authoritative | Fractional attrition accumulator. |

Nested note: `order` is null or an object with the key target, a province id.
At creation every unit order is null.

## 7. Edge Alias Note

`edges` is an object keyed by the two province ids joined with a vertical bar,
for example `p0_0|p1_0`. `edgeList` is an array of the same edge objects in
creation order. Count method: node `Object.keys(state.edges).length` and
`state.edgeList.length` on a fresh `createGame(1)`. Result: edges has 123
entries and edgeList has 123 entries.

Both hold references to the same edge objects. Verification method: node
identity comparison, for each entry e in `edgeList` test
`state.edges[e.a + '|' + e.b] === e`. Result: 123 of 123 entries matched, so
the two representations cannot hold different objects.

Edge object key count method: node `Object.keys(state.edgeList[0]).length`.
Result: 4 keys.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| a | string | authoritative | First endpoint province id. |
| b | string | authoritative | Second endpoint province id. |
| terrain | string | authoritative | Edge type, land or river. |
| rail | null | authoritative | Null, or an object with owner and daysLeft. |

Nested note: `rail` is null or an object with the keys owner and daysLeft. At
creation 16 edges carry a rail object. A rail under conversion also carries a
`converting` object, so the saved shape must allow that field.

What the alias means for save and load: `edges` and `edgeList` are two views of
one edge set, not two independent tables. Serialize from one source and
rebuild the other from it on load, so the lookup and the array can never
disagree. Saving only one representation and regenerating the other from
scratch would lose the exact edge object identity that the sim and any future
reader rely on.

## 8. Rng Audit

All randomness in the sim comes from one generator, `makeRng` in `js/sim.js`
at line 207. It is a mulberry32 generator: a closure variable holds the
internal state, seeded by `seed >>> 0`, and the call returns a draw function.
No rng object or function is stored in the game state. Method: node scan of a
fresh `createGame(1)` for function valued fields at any depth. Result: 0.
`makeRng` is exported once for the tests, at api line 2574.

`createGame` at line 1133 makes one local rng at line 1134,
`makeRng(seed == null ? 1234 : seed)`, so a null seed means 1234. It spends
that generator only during creation, in three uses per province: province
steel at line 1183, floor of rng times 3; province names at line 1188; and
factory levels at line 1190, rng below 0.22. The generator is then discarded.
It is a local variable and the returned state holds no reference to it, which
the function field scan above confirms.

Battles spend no creation rng. `movementPhase` at line 1670 gives each
engagement its own rng at line 1813, through `engagementRng` at line 1647,
which returns `makeRng(hashString(state.seed + '|' + state.tickCount + '|' +
key))`: the seed, the tick count, and the canonical engagement key joined with
vertical bars. `hashString` at line 1637 is FNV-1a style, initial value
2166136261 and multiplier 16777619. `fightRounds` at line 1560 draws rng
twice per round, the side A roll before the side B roll at lines 1600 and
1601, for at most 12 rounds at line 1589. `resolveBattle` at line 1618 takes
an rng as its fourth parameter and creates none.

Method: node, `Sim.makeRng(42)()` drawn twice, then `Sim.makeRng(43)()`.
Result: the two 42 draws are identical and the 43 draw differs. So a battle
history is a pure function of seed, tickCount, and the engagement keys, and
the rng is savable as those derivation inputs and nothing else.

## 9. UI Held State in js/main.js

`js/main.js` holds the browser side of the game in module level variables.
Each one below lists its type or shape, what `newGame` does to it, and what a
load must do.

| Variable | Type or shape | newGame | A load must do | Sim relevance (Cycle 17 Step 0) |
|----------|---------------|---------|----------------|----------------------------------|
| state | object, the live sim state object | Replaces it with a fresh createGame, seeded from urlSeed or a random seed | Replaces it with the deserialized saved state | Sim relevant. It is the sim state object itself; every Sim call reads and writes it. |
| selectedProvinceId | string or null, a province id | Sets it to null | Sets it to null | Not sim relevant. Selection only. Handlers pass its value as an argument to Sim functions in the same handler (buildFortification, buildFactory, plantAgent, deployFlotilla, js/main.js lines 1373 to 1389); the sim never reads the variable. |
| selectedUnitId | number or null, a unit id | Sets it to null | Sets it to null | Not sim relevant. Selection only. onProvinceClick (js/main.js line 1319) calls Sim.issueOrder(state, u.id, provId) in the same handler; no pending order is stored in js/main.js, and js/main.js never writes a unit order field directly. |
| paused | boolean | Sets it to false | Sets it to false | Cadence only. The timer callback (js/main.js lines 66 to 76) reads it to skip Sim.tick; setPaused (line 1104) writes only paused and the button text; it is never passed to a Sim function. |
| speed | number, 1 or 2 | Does not reset it | Does not reset it | Cadence only. Read only in startTimer (line 66) to choose 900 or 300 ms; its handlers (lines 1349 to 1358) write it and restart the timer. |
| timer | setInterval handle or null, not serializable | Restarts it through startTimer, 900 ms at speed 1 and 300 ms at speed 2 | Restarts it the same way; the old handle is never saved | Cadence only. The setInterval handle only (lines 66 to 76); it decides when ticks happen, never what a tick computes. |
| shownBeats | object, beat ids whose card has been shown this game | Resets it to an empty object | Rebuilds it from state.beats, with every recorded beat id counted as shown | Not sim relevant. Card state derived from state.beats in checkLoreCards (line 1145); closeCard (line 1197) calls no Sim function. |
| cardQueue | array of waiting card entries, each with kind beat or texture | Resets it to an empty array | Rebuilds it empty, so nothing waits | Not sim relevant. Card descriptors derived from state.beats and state.textures; dismissal only shows the next card or restores the pause flag. |
| shownTextureCount | number, an index into state.textures | Resets it to 0 | Rebuilds it from state.textures, set to the saved length so no recorded texture is re-shown | Not sim relevant. A render only index into state.textures. |
| pauseBeforeOverlay | boolean or null, the pause flag to restore when the last overlay closes | Sets it to null | Sets it to null; no overlay is pending | Not sim relevant, pause restore only. openOverlayPause and closeOverlayPause only save and restore the paused flag through setPaused. |
| codexEntryId | string, the open codex entry | Sets it to 'ashwater' | Sets it to 'ashwater' | Not sim relevant. Article selection only; renderCodex falls back to the first history entry for a selection the current game has not produced. |
| prodNotice | string, the last refused queue or retool reason | Sets it to an empty string | Sets it to an empty string | Not sim relevant. A display string copied from Sim refusal results. |
| provNotice | string, the last refused province card action reason | Sets it to an empty string | Sets it to an empty string | Not sim relevant. A display string copied from Sim refusal results. |
| el | object, the DOM element cache, not serializable | Leaves it untouched | Leaves it untouched; the same document keeps the cached nodes valid | Not sim relevant. DOM element references only. |
| urlSeed | number or null, the seed parsed from the address | Consumes it, sets it to null | Consumes it, sets it to null; the seed now comes from the saved state | Not sim relevant. Parsed at lines 81 to 84 and consumed exactly once in newGame (lines 87 to 88, where it is set to null); loadFromText never reads it as a seed source (it sets it to null at line 159 and the seed comes from the deserialized state). |

Three rules cover the table. `newGame` does not reset `speed`, so the player
keeps the chosen pace across a new game and a load keeps it too.
`shownBeats`, `cardQueue`, and `shownTextureCount` are derivable from
`state.beats` and `state.textures`, so they are never saved. The timer handle
and the `el` cache are not serializable and must never be saved. A failed
load must leave the current game running: old state, old timer, old selection,
with the failure reported.

### Classification note (Cycle 17 Step 0, gap G1)

js/main.js contains no direct assignment to a field of state or its subobjects (grep verified; the only state assignments are the whole object replacements in newGame and loadFromText). Confirmed negative: apart from state itself, no UI held variable is read by or feeds the simulation; handlers call Sim functions with values in the same handler, and paused, speed, and timer decide when Sim.tick is called, never what it computes. One proof hole stays open by name: the Cycle 16 continuation tests bypass the main.js timer in a node harness, and the batching test covers tick batching, not UI speed values, so one browser driven continuation check through main.js is owned by Cycle 17 Step 4.

## 10. Save and Load Hazards

Owners below use the recorded Cycle 16 definitions from the Scope section.

| Hazard | Detail | Owner |
|--------|-------|-------|
| The rng closure cannot be serialized | The derivation inputs seed and tickCount plus the canonical engagement keys are what must be persisted instead | Step 1 is rng state into state |
| The edges and edgeList alias loses object identity | A plain JSON round trip breaks the shared reference. Node check: 123 of 123 entries alias the same objects before, 0 of 123 after | Step 2 is serialize and deserialize |
| Fractional numbers must stay exact | Unit attritionCarry and every other fraction must be preserved exactly, never rounded. Node check: JSON returns 0.14 and one third bit identical. Proof in Step 4 | Step 2 is serialize and deserialize, proof in Step 4 is tests and balance |
| Nested optional objects | fortBuild with keys toLevel and daysLeft; rail with keys owner and daysLeft plus a converting object with keys to and daysLeft; unit order with key target | Step 2 is serialize and deserialize |
| Null fields must stay null | winner, endReason, fortBuild, flotilla, order, and rail are null at creation, and a round trip must leave them null | Step 2 is serialize and deserialize |
| Record families must be restored exactly | The beats, textures, exchange, and intel snapshots and agents are records; load them as saved, with no recomputation. Proof in Step 4 | Step 2 is serialize and deserialize, proof in Step 4 is tests and balance |
| UI held state is not game state | Discard and rebuild it on load, and a failed load must leave the current game running | Step 3 is UI save and load controls |
| Determinism and save integrity need tests | Inspection proves nothing; only the tests prove a saved game replays identically | Step 4 is tests and balance |

## 11. Wall Clock and Randomness Grep

Wall clock method: grep for `Date.now`, `new Date`, and `performance.now`
across `js/` and `index.html`. Result: zero matches. The sim header says the
same in words: no DOM, no timers, at `js/sim.js` line 2. The only timer in the
codebase is in `js/main.js`. `startTimer` at line 64 sets `setInterval` at
900 ms for speed 1 and 300 ms for speed 2, at line 66, calling `Sim.tick`
when not paused and not game over, and `stopTimer` at line 75 clears it.
Nothing in the game waits on wall clock time, so the state object is the
whole game and a save captures it completely.

Randomness method: grep for `Math.random` and `makeRng` across `js/`.
Result: `makeRng` lives only in `js/sim.js`, defined at line 207, called at
line 1134 in `createGame` and at line 1648 in `engagementRng`, exported at
line 2574. `Math.random` appears once in the whole js folder, at
`js/main.js` line 85 in `newGame`, choosing a fresh seed as floor of
`Math.random` times 100000 when no url seed is present. `js/lore.js` holds no
randomness. No other randomness exists in `js/sim.js` or `js/lore.js`.
