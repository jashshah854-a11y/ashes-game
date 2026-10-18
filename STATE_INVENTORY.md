# Cycle 16 Step 0a - Simulation State Inventory

## 1. Scope

This is Cycle 16 Step 0a, a half size state inventory audit of the Ashes of
Empires simulation core. It inventories the sim state tables below for the save
and load cycle. It covers the state object returned by `createGame` in
`js/sim.js`, its province and nation subobjects, its production lines, its
units, and the edge alias pair.

Deferred to Step 0b: the rng audit, the UI held state table, the hazards
table, and the wall clock grep. Those four are named here only and are not
written in this file.

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
| tickCount | number | authoritative | Total ticks run, used for AI and pacing. |
| mapW | number | authoritative | Province columns, from CFG at creation. |
| mapH | number | authoritative | Province rows, from CFG at creation. |
| provinces | object | authoritative | Province subobjects keyed by province id. |
| edges | object | alias | Edge lookup keyed by the two province ids joined with a vertical bar. |
| edgeList | array | alias | Edge array, references the same edge objects as edges. |
| units | array | authoritative | Live units, each a unit subobject. |
| nextUnitId | number | authoritative | Next unit id to hand out, starts at 1. |
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
