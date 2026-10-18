# Cycle 18 Step 0 spec for The Battle Explains Itself

No code in this step. Steps 1 to 4 build from this spec.

## 1. Battle reason spec

All claims grounded in js/sim.js as it is now. Read fightRounds, stackPower, unitStats, fortBonusFor, riverCrossingPenaltyFor, droneEffectiveness, movementPhase, and logEvent.

### 1.1 Three fighting engagement kinds

The three fighting engagement kinds are battle, meeting, and clash. Move engagements fight nothing. All fighting goes through fightRounds, called by movementPhase on battle clones with modes attack and defense for battles and clashes, or attack and attack for a meeting (js/sim.js, the engagement compute loop in movementPhase: the second mode is attack only when the kind is meeting, defense otherwise).

### 1.2 Values recorded at resolution for Step 1

Step 1 will record the following values that are already computed at resolution:

- First round attacker power and defender power from stackPower. The attack side is computed with the river context naming the defender province. The defense side is computed in defense mode.
- Per side modifier facts present at fight start:
  - Supply penalties of the units (from unitStats supplyPenalty field)
  - Fortification bonus percent for defenders standing on their own fortified province. CFG.fortDefensePctPerLevel per level (25), applied once per stack in defense stackPower.
  - River crossing penalty percent for an attacking unit crossing a river edge. CFG.riverCrossingPct (25), zero when a friendly flotilla stations at either bank (riverCrossingSupported).
  - Drone effectiveness percent for each nation with drone wings in the fight. 100 plus CFG.ewStepPct (25) per generation of drone lead over the other nation jamming, clamped CFG.ewFloorPct (50) to CFG.ewCapPct (150).
  - Interceptor launches that happen before the first round: count, CFG steel cost each (CFG.unitTypes.interceptor.steelCost = 50), and that each launch destroys one attacking drone wing whose attack never counts.

### 1.3 What is NOT recorded and why

The per round random damage multiplier (0.7 plus rng times 0.6) and the later round powers are not recorded. The recorded powers are the first round powers, the same shared stackPower numbers the preview and the AI estimate use, so the explanation can never disagree with the preview.

### 1.4 Losses

Step 1 also records, per side, how many units were destroyed in the fight, each counted exactly once. That total has two parts: the attacking drone wings destroyed by interceptor launches before the first round (launches happen before the start strengths snapshot, so those victims are not in the snapshot comparison), plus the units that were alive in the start strengths snapshot fightRounds takes after any launches and are dead when the rounds end. Adding the snapshot deaths alone would miss the interceptor victims; counting a victim in both parts would double count it, which the fightRounds comments (the battle deaths pricing note) already guard against for the exchange ledger.

### 1.5 Storage

State.log entries are objects with day and msg only, written by logEvent. Step 1 adds one new field named battle to battle outcome log entries only, holding the recorded values above in plain data.

Log lines that get the battle field:

- Battle kind outcome lines in movementPhase: repelled, attack group destroyed, and cleared but cannot advance, in the outcome block at lines 1910 to 1914; and capture after a hard fight, which is logged later in the captures loop at line 1953.
- Meeting outcome line (the message built at lines 1917 to 1928).
- Clash outcome lines: win but cannot move in and neither side takes it, in the outcome block at lines 1932 to 1934; and win and take it and win and hold it, logged in the captures loop at lines 1965 and 1968.

The interceptor launch line is written inside fightRounds before the outcome is known (lines 1576 to 1582), so it gets no battle field. Its launch count rides in the battle field of that engagement outcome line instead.

All other log lines keep exactly day and msg.

### 1.6 Capture and outcome logic unchanged

The field is written after the outcome is decided. No recorded value is read by any rule. Recording must not change any computation order, any rng draw order or count, or any outcome. Step 1 must pin that with a test asserting resolution results are unchanged with the record present.

## 2. Save payload and saveVersion decision

### 2.1 Facts

State.log is part of the saved payload. js/save.js REQUIRED_KEYS includes log, and the payload carries the log verbatim. Adding the battle field changes the shape of the saved payload.

### 2.2 Decision

Under the saveVersion rule in LEGIBILITY_AUDIT.md Section 7, the decision made now before any code exists is:

- Step 1 bumps SAVE_VERSION in js/save.js from 1 to 2.
- Version 1 saves are rejected in plain language under the existing version rejection, with no migration function, because a version 1 log has no battle facts and the game must not invent explanations for old battles.
- The existing rejection message already builds its text from SAVE_VERSION (js/save.js lines 214 to 218).
- Step 1 owns updating every surface that names version 1. Grep for SAVE_VERSION, saveVersion, and version 1 wording across js, tests, and tools yields these surfaces:
  - js/save.js: the header comment naming this format as version 1 (lines 4 to 5), SAVE_VERSION constant (line 34), HEADER_FIELDS (line 45), serializeSave envelope (line 163), deserializeSave check (line 214), rejection message (lines 215 to 219), exported API (line 324).
  - tests/sim.test.js: version check test at line 3267, which stages a bad version by setting badVersion.saveVersion = 2; that staged value must move off 2 in Step 1 (to a value that is neither 1 nor 2, for example 99), or the staged save would become a valid version 2 save and the test would stop testing rejection.
  - tools/save-check.js: the header comment naming saveVersion 1 (line 30) and the expected saveVersion 1 checks at lines 203 to 205.
  - tools/save-hardening-check.js: the version 99 mutation at lines 314 and 319 needs no change (99 stays an invalid version), but its expected rejection message at line 329 hardcodes the words version 1 saves and must be updated to version 2, because the message text is built from SAVE_VERSION.
- Round trip byte identity within version 2 is preserved because js/save.js transports the log verbatim (lines 148 to 154 and 299 to 319).
- Legacy version handling is Step 1 work, not Step 2 or later.

## 3. Golden impact prediction

Predictions with reasons:

- tools/balance.js output stays byte identical because its report rows contain no log fields.
- The suite whole state JSON comparisons compare runs of the same code against each other, so both sides gain the field together.
- Tests that read the log read entry.msg, which does not change.
- The determinism snapshot in tests maps the log to msg strings only.
- Golden passive day assertions pin day and gameOver only.

The one class of test Step 1 must watch: save round trip and continuation equivalence tests that deep compare the full log between a direct run and a restored run. These stay green only if the battle field survives the round trip exactly, which the verbatim log transport gives.

If Step 1 finds any prediction here wrong, it stops and reports rather than adapting silently.

## 4. G4 record

G4, the probe era test name tidy, lands in Step 1 because Step 1 touches tests/sim.test.js. The test currently named "save and load: negative zero probe and conditional fix" at about line 3390 of tests/sim.test.js is the item. It is renamed in Step 1 to a name stating what it pins, with no assertion changed by the rename.

## 5. Blockade reachability plan for Step 4

Grounded in js/sim.js: coastalControl, homeCoastalProvinces, enemyHomeCoastalControlCount, isBlockaded, blockadeLoss, incomePhase, CFG.blockadeCoastalThreshold (3), CFG.blockadeSteelPct (25).

### 5.1 Rule statement

A nation is blockaded when the opposing nation controls at least 3 of its home coastal provinces. Home coastal means the coastal provinces on its starting half of the map. A coastal province is controlled by its owner when the owner stations a flotilla there or holds it with units. An owned but empty coastal province is controlled by nobody.

The effect is only in incomePhase: the blockaded nation loses floor of its daily steel income times 25 percent (CFG.blockadeSteelPct).

### 5.2 Why the 32 standard harness campaigns never fire it

The scripted profiles fight along the capital row and never take and hold three enemy home coastal provinces, which sit on the far top and bottom rows.

### 5.3 Staged plan for Step 4, no tuning

In a browser check, stage a state through the sim public surface or the createGame wrapper pattern used by earlier checks. Take the first three provinces of Sim.homeCoastalProvinces for the enemy. Give them to the player and hold each with a player unit (control by holding units, so no flotilla build time is needed). Assert Sim.isBlockaded for the enemy is true and Sim.blockadeLoss for the enemy equals the floor formula from Sim.steelIncome and CFG. Run one real tick or incomePhase and assert the enemy steel rose by income minus the loss. Then load the game in the browser and assert the nation card blockade number for the enemy and the navy explain text render those same numbers in the DOM.

Record the harness frequency finding (0 of 32) in BACKLOG as part of Step 4, not this step. Any change to how often blockade fires is balance and is parked for Jash.

## 6. Exit criteria mapping for Cycle 18 Steps 1 to 4

Copied from the judge prescription in CYCLE_LOG.md Cycle 17 Step 5 entry:

- Step 1: sim diff confined to the battle record, balance byte identical, any golden diff quoted line by line and limited to the new fields.
- Steps 2, 3, and 4: each adds a browser check shown non vacuous against the pre step UI.
- Step 2 closes the walk row 9 residual by per battle text, not more static prose.
- The audit verdict column and gap column agree at cycle close.