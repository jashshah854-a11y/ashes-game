# Decisions parked for Jash

Taste calls the loop will not make for you. Each one is blocking something
specific; everything else keeps moving.

LORE WRITTEN BY THE LOOP, OPEN FOR YOUR REWRITE OR VETO (Cycle 7). Under
the lore rule the loop wrote the world's first lore itself rather than
stall. All of it is in js/lore.js and none of it changes a number in the
game. Read it, then keep, rewrite, or strike any of it. Everything below
was invented by the loop, not by you:
- The Ashen Empire, the old empire both nations came out of, broken
  forty-one years ago in the Partition.
- The Ashwater, the river frontier, and the Spine, the old imperial
  railway along the capital row, cut at the river.
- The Treaty of the Ashwater, signed on a barge in midstream.
- The rival rail gauges (the in game reason captured rail must be
  converted), and the engineers' name for it, the gauge war.
- The Vessari: a charter of guild cities, the Compact Assembly, the First
  Delegate, a nation of ledgers and workshops that invented the drone
  wing, and remembers the Partition as "the line where the debt ended."
- The Khessites: the old imperial arsenal turned capital, the great
  Houses of the general staff, the Dominar chosen for life, and the
  Reckoning ("never attack without three against two", the in game
  reason the Dominion attacks only at 1.5x and keeps three units home).
- The tone: grounded, dry, a little wry, no magic, no chosen ones.
- Three event cards: "Blood on the Spine", "The Second Generation", and
  "A Third Line", each with a Vessari, a Khessite, and a same day text.

CYCLE 10 ADDITIONS, ALSO LOOP WRITTEN AND OPEN FOR REWRITE OR VETO
(second lore pass, step 1). Three recurring texture cards in
js/lore.js (LORE.textures), each with a Vessari and a Khessite text,
each printing the same no effect sentence as the turning point cards:
- "Walls Rise": fires each time a province finishes building a
  fortification level. The Compact text is engineers, sightlines, and
  a cost report; the Dominion text is the manual, the schedule, and
  the next wall ordered before the concrete cures.
- "The Gauge War": fires each time a stretch of captured rail
  finishes converting to its new owner's gauge. Both texts are the
  relaying crews: four days, one rail of every pair moved a hand's
  width, recorded as a restoration by one side and as overtime by
  the other.
- "A Practiced Line": fires each time a production line reaches full
  efficiency (150 percent). Both texts are the line crews and the
  report writers disagreeing about what to call it.
- Both capital codex entries gained a closing paragraph describing
  both endings the game has: the capital falling (the nation falls
  with it, in the sim's own end wording) and the campaign ending on
  day 150 with the capital still standing (for Vesskar, a hard,
  grinding survival; for Khessograd, the arsenal enduring with its
  claim intact and its west unrecovered). This closes the endpoint
  gap recorded in item 9.
- One wording note from the Cycle 10 judge (step 4), recorded for
  this same veto pass and explicitly not graded a defect: both
  "Walls Rise" variants open with the word "Another", which on a
  campaign's first ever fortification completion slightly
  presupposes an earlier one. The judge's reading: walls exist in
  the world's fiction before any given completion, and the word
  carries no mechanical or factual claim. No text was changed and
  no step was assigned; it is yours to keep or strike when you
  read the card, alongside the item 9 passages.

1. Calibration feel. Current numbers on master, measured with the
   committed harness (tools/balance.js) and re-verified at Cycle 9
   step 3 (the rerun is committed as tools/baseline-cycle9.txt):
   a commander who never acts falls on day 36 on all 8 standard
   seeds, inside the judge's 30 to 45 band; the scripted sensible player
   (which builds factories toward line 3) captures the enemy capital 8 of
   8, on day 43 on 7 seeds and day 28 on seed 2024, with end strength
   190.3 to 265.3 percent of the starting 72; a reckless player who
   abandons the capital lane loses 8 of 8, on day 37. The capture moved
   later than the pre walls day 25 when fortifications landed in
   Cycle 8 step 1 (the Dominion now walls its capital and its river
   province), and a fortress profile that also walls its own
   capital and staging province wins the same 8 of 8 on the same days.
   Cycle 9 step 1 (line efficiency) then moved the sensible capture
   earlier again on 7 seeds (day 46 to 43) as practiced lines started
   finishing units sooner, and 3 days later on seed 2024 (day 25 to
   28), whose fast win turned on one early stack's exact timing.
   The bands, not the exact day, are the ruling. Questions: does day 36
   feel right to you for a do-nothing commander, and does a day 43 win
   for sensible play feel right, or do you want the skeleton gentler
   while you learn it?

2. Next build. Cycle 6, "Close the loop, fix the clock", is complete
   (judge verdict PASS WITH FIX-NOW FLAGS, all flags closed in the step 5
   commit): factories gate production line count with locked slots shown
   with their unlock condition, and battles resolve simultaneously from a
   start of tick snapshot. The takeover reconciliation of the GitHub
   branch's first 6 slices is also decided (slices 2 to 5 ported, slice
   1's harness and slice 6's branch text dropped for the reasons logged
   in CYCLE_LOG). Cycle 7, the lore seed, is now in progress on master:
   step 1 (lore content in js/lore.js plus the sim's campaign beat hooks)
   is ported and verified, with the loop written lore flagged at the top
   of this file for your rewrite or veto, per the lore rule; the loop
   does not stall waiting for approval. Step 2 (codex panel and event
   card UI) is now also built and verified in a real browser: the cards
   appear in game when their beat fires and the codex holds the history
   and the turning points so far. Step 3 (tests and balance) is now
   also built: 6 lore and beat tests bring the suite to 49, all
   passing, and the balance rerun is byte identical to the committed
   baseline. Step 4 (judge) is now also done: a fresh judge with no
   builder context returned CONDITIONAL PASS (EU5 lore STRONG, with
   one defect), one fix-now flag (a codex bug across New Game) is
   fixed, and the other (the Drone Gen 2 card texts, item 9) had
   its documentation done in Cycle 7 with the variant resolution
   carried to Cycle 8 step 0. Cycle 7 is complete. Cycle 8,
   fortifications paid in equipment, is now in progress: step 0 is
   done (item 9's variant resolution closed by narrowing the card
   to the enemy and both variants and rewording the enemy text,
   with a reachability test pinning that real campaigns fire
   exactly the shipped variants), and step 1 (sim) is now also
   done: fortifications are built for equipment over 5 days, add
   25 percent defense per level (max level 2) through the shared
   stackPower path, lose a level on capture, and the Dominion
   walls its capital and its river Spine province past 300
   equipment. Step 2 (UI) is now also done: the province card
   states the level, cost, days, and exact bonus with a Fortify
   button, the map badge sits on top of the tile, the attack
   preview and unit card name the walls, and the enemy card lists
   Dominion fortifications and its wall rule. Step 3 (tests and
   balance) is now also done: 8 formal fortification tests bring
   the suite to 58, the harness gained a fortress profile that
   wins 8 of 8, the Cycle 8 baseline is committed, and the
   fortification browser check is committed and passes 13 of 13.
   Step 4 (judge) is now also done: a fresh judge returned PASS
   WITH FIX-NOW FLAGS, with one flag (the map's fort level badge is
   covered by the building badge during an upgrade) carried to
   Cycle 9 step 0 by the judge's own prescription. Cycle 8 is
   complete. Cycle 9, Production Line Efficiency Ramps, is now in
   progress, prescribed in full in CYCLE_LOG: step 0 is done (the
   building badge now sits below the level badge, both show during
   an upgrade, and the fort check's new combined state run passes
   17 of 17), and step 1 (the efficiency sim) is now also done:
   a line's efficiency starts at 100 percent, rises 2 percent per
   funded working day to a 150 percent cap, drops back to 100 on a
   retool, and affects only how many funded days a unit takes to
   build (at the cap, infantry in 4 days and drones in 2), with
   the steel drain per day and the listed steel cost unchanged;
   step 2 (efficiency on screen) is now also done: the production
   panel shows each line's efficiency percent with the live build
   days from the sim readout against the base days, the funded
   working days left to full efficiency, a starting level wording
   at the floor and a full efficiency wording at the cap, and the
   retool warning now states the efficiency points a retool loses
   beside the steel at risk; the unit card names its build days as
   base speed. Step 3 (tests and balance) is now also done:
   7 formal efficiency tests bring the suite to 65, the balance
   rerun is committed as tools/baseline-cycle9.txt with every
   ruling band passing and no tuning slice needed, and a seed 42
   trace shows a line reaching the 150 percent cap after 25
   funded days and its next unit charged at the ramped 4 days
   for 20 steel. Step 3 also revisited the equipment question
   as prescribed: efficiency ramps spend no equipment, equipment
   keeps its two spends (factories and fortifications), and the
   late campaign surplus (sensible ends with 1955 to 3090
   equipment in the Cycle 9 baseline) stays open for a later
   cycle and for you, with nothing built for it. Step 4 (a fresh
   judge) is now also done: a fresh judge with no builder context
   returned PASS WITH FIX-NOW FLAGS, independently rerunning the
   suite (65 pass), the balance diff (byte identical to
   tools/baseline-cycle9.txt), and all four browser checks, and
   reproducing both step 3 non vacuity mutants and the seed 42
   trace itself. Its one flag is a quote accuracy defect, not
   taste: at 116 to 119 percent efficiency a fresh infantry unit
   is quoted 6 days and actually charged 5, because the readout
   is a ceiling at the starting efficiency while the charge sums
   the rising efficiency; the judge prescribed making the two
   readout day functions exact in js/sim.js, with the charge
   path untouched, and assigned it to Cycle 10 step 0. Cycle 9
   is complete. Cycle 10, the second lore pass, is now in
   progress as prescribed in CYCLE_LOG: step 0 is done (that flag
   closed: both readout day functions are now exact in js/sim.js
   by iterating the rise, the charge path untouched, infantry at
   118 percent now quotes 5 and charges 5 for 25 steel, the test
   repinned to equality across every efficiency, suite 65, balance
   byte identical to tools/baseline-cycle9.txt, all four browser
   checks passing). Step 1 is now also done: three recurring texture
   cards (Walls Rise, The Gauge War, A Practiced Line) are written in
   js/lore.js with only the variants real campaigns produce, the sim
   records every occurrence in state.textures as it happens with no
   rule reading the records, and both capital codex entries now
   describe both endings. The reachability tally on all four harness
   profiles and all 8 standard seeds is recorded in CYCLE_LOG: every
   shipped variant fires, and every trigger fires at least twice in
   at least one campaign (in fact in 8 of 8 campaigns of at least one
   profile). Three candidate triggers were not shipped: a province
   retaken never happened in 32 prototype campaigns, and new rail
   completed and province captured fire so often (up to 23 and 13
   times a campaign) that as cards they would be noise, not texture.
   Step 2 is now also done: every recorded texture occurrence surfaces
   as its own card through the existing event card overlay and queue,
   stating its day and, on repeats, its occurrence count for its side
   (a passive campaign now pauses for its 10 texture occurrences as
   well as its 3 turning points; whether recurring cards should hard
   pause at all is your item 10 call, unchanged and not decided by
   this step), the codex shows the recurring texture reached so far
   with per side counts and every day listed beside the turning
   points, the extended capital entries render there as ordinary
   entries, and the extended lore browser check passes 116 of 116.
   Step 3 is now also done: 8 formal texture tests bring the suite
   to 73 (each trigger recording once per occurrence on its day for
   the correct side with repeats as second entries, a campaign level
   pin that real campaigns on seed 42 fire exactly the shipped
   variant set, determinism, zero mechanical effect with its mutant
   failing exactly that test, and a capital endpoint wording test),
   and the balance rerun is byte identical to
   tools/baseline-cycle9.txt. Step 4 is now also done: a fresh
   judge with no builder context returned PASS, the first clean
   pass with no fix-now flags in the loop's recorded verdicts,
   independently rerunning the suite (73 pass), the balance diff
   (byte identical to tools/baseline-cycle9.txt), and all four
   browser checks (lore 116 of 116, efficiency 15 of 15, fort 17
   of 17, browser 6 of 6), reproducing the step 3 zero effect
   mutant and the step 1 reachability tally itself, and grading
   EU5 lore STRONG strengthened and legibility STRONG with no
   remaining named exception. Cycle 10 is complete. Cycle 11,
   Manpower, is prescribed in full in CYCLE_LOG at the Cycle 10
   step 4 entry (no step 0 and no carried flag, so it starts at
   step 1: one manpower pool per nation, daily intake per owned
   province, per template costs paid at queue time through the
   shared queueProduction path with numbered rejections, the
   identical gate for the AI, and a step 3 requirement that the
   constraint demonstrably bind while every ruling band passes).
   Step 1 is now also done: the pool starts at 1200 for both
   nations, intake is 1 per owned province per day (35 a day at
   the start), infantry costs 120 manpower and a drone wing 25,
   both paid in full at queue time through queueProduction with
   numbered rejections, the AI bound by the identical gate, and
   retooling a line with queued orders settles the manpower
   difference so a cheap queue cannot become an expensive unit
   for free; the suite stays 73 and the balance rerun is byte
   identical to tools/baseline-cycle9.txt. Step 2 is now also
   done: the nation card shows the pool and the daily intake
   with a plain words explanation that intake is per province
   held, the production summary names the pool, each production
   row and the unit card state the manpower cost beside the
   steel cost, a refused queue attempt shows its numbered
   reason in the panel, and the enemy card shows the Dominion's
   pool and intake by the same numbers, verified by the new
   tools/manpower-check.js (15 of 15 in a real browser).
   Step 3 is now also done: 7 formal manpower tests bring the
   suite to 80, the recorded binding trace on seed 42 (queueing
   ahead pays for 13 orders and the 14th is refused for manpower,
   20 in the pool against a 25 cost) is pinned as a test, the
   non vacuity mutant (intake accrued only for the player) fails
   exactly the AI parity test, and the balance rerun is committed
   as tools/baseline-cycle11.txt with every ruling band passing
   (byte identical to the Cycle 9 baseline; the harness profiles
   themselves never bind, honestly recorded in CYCLE_LOG).
   Step 4 (judge) is now also done: a fresh judge with no
   builder context returned PASS, no fix-now flags, independently
   rerunning the suite (80 pass), the balance diff (byte identical
   to tools/baseline-cycle11.txt), and all five browser checks,
   and reproducing both the binding trace and the non vacuity
   mutant (which it also verified clean against the pre step 3
   suite). Cycle 11 is complete. Its judge parked
   four taste questions with you, undecided by
   the prescription: whether manpower should also gate factory
   or fortification construction crews, whether the pool should
   have a cap that wastes overflow intake, the flavor name of
   the intake beyond the plain word manpower, and whether a
   future cycle may spend manpower on partial unit
   reinforcement; none of them blocks the remaining steps.
   The Cycle 11 judge's prescription for Cycle 12 (Drones and
   EW with the cost exchange scoreboard, prescribed in full in
   CYCLE_LOG) parks five more taste questions with you, also
   undecided and blocking nothing: whether interceptor launches
   should stay automatic or become a player choice once the
   scoreboard has taught the exchange; the interceptor's flavor
   and name (missile, counter drone, or crewed wing; the loop
   uses the plain word interceptor until you rule); whether the
   scoreboard should stay steel only or a later cycle should
   price losses in steel and manpower combined; whether jamming
   should in a later cycle also blunt interceptor launches
   (Cycle 12 deliberately keeps jamming on drone fighting power
   only); and whether Drone Gen 3 should change how a drone wing
   looks on the map beyond its numbers.
   Cycle 12 step 1 is now also done: the sim carries the
   interceptor stockpile (starting at 4, replenished only by
   building the Interceptor production template at 50 steel
   over 5 days and 10 manpower, 3.33 times a drone wing's
   steel), automatic launches inside the shared combat path
   (one per attacking drone wing up to stock, before the
   first round, the drone's attack never counting), the
   record only exchange ledger in steel with its net
   readout, and the EW counter (Drone Gen 3 at 90 points
   with base drone stats 6 and 4, Jamming Gen 1 and 2 at
   50 and 80, effectiveness 100 plus 25 times the
   generation difference, clamped 50 to 150, applied in
   unitStats; at the start the difference is plus 1 for
   both nations, so starting drones fight at 125 percent).
   Every ruling band passes on the balance rerun with no
   tuning slice (passive day 36 on all 8, sensible wins
   8 of 8 on reportDays spread 35 to 89, reckless loses
   8 of 8), and the five taste questions above stay
   parked exactly as the judge left them, undecided by
   this step. Step 2 is now also done: the cost exchange
   scoreboard shows both nations' destroyed, lost, forced,
   suffered, and net in steel with a plain words headline
   naming who is bleeding faster, the attack preview states
   the launches an attack with drones triggers and both
   effectiveness percents with their generation numbers,
   the Gen 3 and jamming research surfaces and the enemy
   card's generations and stock are on screen, the drone
   wing unit card states its generation, production lines
   can be retooled to Interceptors from the panel, and the
   new tools/drone-ew-check.js passes 28 of 28 in a real
   browser. Step 3 is now also done: 10 formal drones and
   EW tests bring the suite to 90, the launches free for
   the enemy mutant fails exactly the mirrored parity
   test and is clean against the pre step suite, the
   mechanic moves in real campaigns on every harness
   profile (sensible seed 42, public commands only:
   the player forces 8 Dominion launches for 400 steel
   and ends at net plus 445), the balance rerun is
   committed as tools/baseline-cycle12.txt with every
   ruling band passing and no tuning slice, and the
   scoreboard's honest limit is stated in BACKLOG.md:
   it records steel only, decides nothing, pays for
   nothing, and changes no win condition. Step 4 (a
   fresh judge) is now also done: PASS, no fix-now
   flags, so Cycle 12 is complete, and Cycle 13 (Intel
   and Fog) is prescribed in full in CYCLE_LOG, starting
   at step 1 with no step 0 and no carried flag. The
   five taste questions above stay parked exactly as
   the Cycle 11 judge left them, undecided by this step,
   and the Cycle 13 judge parks six more taste questions
   with you (dark provinces hiding geography, ghost chips
   for remembered provinces, fogging the aggregate
   panels, a fog bound AI, agent removal and flavor, and
   a recon sortie order), recorded in the closing
   summary at the end of this file, all undecided and
   blocking nothing.
   Cycle 13 step 1 is now also done: the sim carries the
   shared intelState readout (live, remembered, or dark)
   from owned ground and its neighbors, units and their
   neighbors, drone wings at sight range 2 through the
   province graph, and planted agents watching their
   province alone; end of tick per nation snapshots that
   no rule reads; and agents built only through the Agent
   production template (40 steel over 4 days, 60 manpower
   at queue time) and placed only through plantAgent on a
   province the nation does not own, until that province
   changes owner. The Dominion builds at most one agent,
   on a line standing idle while its army is at its cap,
   and plants a held agent on your capital. The six taste
   questions above stay parked exactly as the Cycle 12
   judge left them, undecided by this step; the defaults
   used are the prescribed ones (the theater map stays
   known and only military fact is hidden, the scripted
   AI does not read intel, agents are not removable).
   Cycle 13 step 2 is now also done: fog is on screen.
   The map shows live, remembered (dimmed and hatched,
   with the snapshot's ghost unit chips marked with
   their day), and dark states under a plain words
   legend; the province inspector and the attack
   preview are gated by the same intel readout, so a
   remembered target shows only its snapshot with its
   day and a dark target shows no enemy figures, each
   stating how to reveal it; the nation card shows
   provinces under live observation and the agent
   stock, and planting runs through a Plant agent
   button on the province card, with refusals shown in
   the card. tools/intel-check.js passes 29 of 29.
   The ghost chips question above is now shipped in
   its ghost chips form as the loop default (ghost
   figures on the map, snapshot numbers in the
   inspector); it stays open for your rewrite or veto
   exactly as parked, and no other taste question was
   decided by this step.
   Cycle 13 step 3 is now also done: 8 formal intel
   tests bring the suite to 98 (sight mirrored for
   both nations, the drone second ring pin, snapshots
   frozen while a province is unseen and updated when
   sight returns, the priced agent path and its
   refusals, a full campaign identical with recording
   on and off except the intel records, and AI parity
   through the real tick path, with the Dominion
   planting its agent on your capital at the shared
   price), the drone sight range mutant fails exactly
   the drone recon test and is clean against the pre
   step suite, the seed 42 recon trace is recorded
   (a drone wing ordered forward makes Drafeld live
   and its snapshot shows it empty and unwalled, a
   soft spot infantry alone could not see), and
   tools/baseline-cycle13.txt is committed with every
   ruling band passing (against the Cycle 12 baseline
   only enemyEquipment moved, down 5 to 90 in 10 of
   32 rows, from the Dominion's priced agent build
   delaying a steel gated factory build, as traced at
   step 1). No new taste item was created by this
   step, and the six taste questions above stay
   parked exactly as the Cycle 12 judge left them.
   Step 4 (a fresh judge) is now also done: PASS WITH
   FIX-NOW FLAGS, no failed verdict, independently
   rerunning the suite (98 pass), the balance diff (byte
   identical to tools/baseline-cycle13.txt), and all seven
   browser checks, and reproducing the recon trace and
   the mutant itself. Its one flag is a defect, not taste:
   the province card factory button label is computed
   from the true current factory level with no intel
   gating, so it leaks that level for dark and remembered
   provinces; it is carried to Cycle 14 step 0 with its
   fix prescribed (a constant, level free label for non
   live provinces, and the intel check extended to pin
   it). Cycle 13 is complete. Cycle 14 step 0 is now
   also done: that flag is closed (a constant, level free
   factory button label for non live provinces, the intel
   check extended to 31 of 31, suite 98, balance byte
   identical to tools/baseline-cycle13.txt). Cycle 14 step 1
   is now also done: flotillas built only through the
   Flotilla production template (40 steel over 4 days, 30
   manpower at queue time) and stationed only through
   deployFlotilla on owned coastal or river ground, the
   coastal control readout (a stationed flotilla first,
   then holding units; owned but empty is not controlled),
   blockade at 3 enemy home coastal provinces controlled
   costing 25 percent of daily steel income through
   incomePhase only, and a 25 percent river crossing
   attack penalty inside stackPower that a flotilla at
   either bank removes, with the Dominion building and
   stationing under stated rules at identical prices.
   One balance band is known broken going into step 3
   (a passive player survives on seed 2024, traced in
   CYCLE_LOG to the crossing delay and the AI's out of
   supply freeze; step 3 owns the tuning), no new taste
   item was created by this step, and the six navy taste
   questions below stay parked as the Cycle 13 judge
   left them. Cycle 14 step 2 is now also done: navy is
   on screen (coastal and flotilla marks on the map with
   river edges drawn supported or not, the blockade
   lines on the nation card from the sim readouts, the
   Deploy flotilla control on the province card, and
   the river crossing penalty named inside the attack
   preview, whose numbers now come from the shared
   stackPower for the named target), verified by the
   new tools/navy-check.js at 29 of 29 in a real
   browser, with every prior browser check at its
   recorded total (the intel check's live preview
   expectation now follows the shared readout's
   penalized number for its river target, its total
   unchanged at 31). No new taste item was created by
   this step, and the six navy taste questions below
   stay parked exactly as the Cycle 13 judge left
   them. Cycle 14 step 3 is now also done: the formal
   navy tests (suite 106), the binding traces, and the
   committed Cycle 14 baseline, with the passive seed
   2024 break restored by one tuning slice in its own
   commit (CFG.supplyMaxHops 8 to 10: the frozen
   Dominion stack at p2_3 sat at 9 rail hops from its
   capital, one past the old cap; exactly one of the 32
   balance rows changed). The hop cap is a loop tuned
   number, recorded here so you can veto it with the
   rest, not a taste call made for you. One honest
   limit from that step: blockade never fires in any
   of the 32 standard harness campaigns (both scripted
   armies fight the capital row, never the coastal
   rows); its binding evidence is a staged trace
   through the real income path (9 steel per day on
   three consecutive days), and the river crossing
   binds in a real campaign (an unsupported flank
   crossing quoted 3 against an open 4, a flotilla
   supported capital row crossing quoted the full 4).
   No new taste item was created by this step, and the
   six navy taste questions below stay parked exactly
   as the Cycle 13 judge left them. Cycle 14 step 4
   (a fresh judge) is now also done: PASS, no fix-now
   flags, the judge independently rerunning the suite
   (106 pass), the balance diff (byte identical to
   tools/baseline-cycle14.txt), and all eight browser
   checks, and reproducing both binding traces, its
   own blockade tally (0 of 32 standard campaigns),
   and the non vacuity mutant. Cycle 14 is complete.
   The judge prescribed no next cycle: navy was last
   in the deferred order, the bible's v1 systems list
   is complete, and the next direction is your call;
   its candidates (a campaign end screen with scoring,
   save and load with integrity and determinism tests,
   a playability pass) are candidates only, recorded
   in CYCLE_LOG, and none is started. Cycle 14, Navy, is
   prescribed in full in CYCLE_LOG at this step, starting
   at step 0 with that carried flag, then step 1
   (flotillas built through a priced production template
   and stationed through one public command, one shared
   coastal control readout, blockade pressure on steel
   income past a threshold, and a named river crossing
   attack penalty that a flotilla at either bank
   removes), step 2 (navy on screen), step 3 (tests,
   balance, and a binding trace), and step 4 (judge).
   Its judge parks six more taste questions with you,
   also undecided and blocking nothing: the flotilla's
   flavor name and service beyond the plain word
   flotilla; whether blockade should bite steel income,
   equipment output, or both in a later cycle (Cycle 14
   builds steel income only); whether a river crossing
   should also cost time beyond the attack penalty;
   whether flotillas should be sinkable in a later cycle
   or stay permanent until their province falls; whether
   coastal control should be scored on a campaign end
   screen when scoring exists; and whether the Dominion's
   coastal provinces should be visible as a theater
   control bar or stay as counts on the cards.
   No new taste item was created by Cycle 9 step 0,
   step 1, step 2, step 3, or step 4, or by Cycle 10 step 0; the
   step 0s were prescribed defect fixes and Cycle 9 steps 1 to 3
   are loop tuning, display, and tests under the judge's
   prescription. The assessed branch items that were pending before
   step 2 are both ported and verified: the Cycle 6 judge flag 1 fix
   (defenders drawn for every targeted province before any battle forms,
   see CYCLE_LOG and item 8) and judge flag 4, which rode with step 2
   (the enemy card now shows the Dominion's factory levels and open
   lines, with the next unlock threshold).

3. Rail conversion. It emerged from balance work and the judge voted
   keeper. It is in the game now: captured rail takes 4 days to convert
   and feeds nobody meanwhile. If the feel is wrong when you play, say so
   and it comes out or gets retuned. One number controls it.

4. Dominion capital garrison. Since Cycle 5 step 4 the Dominion holds the
   first 3 idle units on its capital as a permanent garrison (before that
   it marched them west on day 1 and a lone reckless unit could take the
   empty capital). Three is effectively a difficulty number: bigger makes
   Khessograd harder to crack, smaller makes it softer. Your call if 3
   feels wrong when you play.

5. Retooling scraps work in progress with no steel refund. That is the
   current rule; the panel now states the exact steel at risk before you
   click. The judge flagged the rule itself as taste: keep the hard scrap,
   or should retooling refund some or all of the spent steel?

6. Cancelling queued production orders. Today a queued order cannot be
   cancelled or refunded and a line cannot be paused. Should queue cancel
   exist, and if so with a full refund, a partial refund, or none? Parked
   until your call; nothing is blocked by it.

7. Locked production lines (Cycle 6, shipped and judge passed).
   Factories now gate how many production lines a nation can run (line 3
   at 16 total factory levels, line 4 at 24, hard cap 4), with locked
   slots visible in the panel and the unlock condition written out. An
   unlocked line stays open even if the nation later loses the factories
   that opened it; that permanence was a loop legibility call, and
   whether it should stay permanent is taste. The thresholds are loop
   tuning, but whether a locked slot feels good or frustrating is taste.
   Flag it when you play Cycle 6 if it feels wrong.

8. Defenders stay home (branch Cycle 6 judge flag 1, ported). The rule
   the docs already stated is now the rule the code runs in all cases:
   a unit standing on a province an enemy column marches on stays to
   defend it that day and its own order is cancelled, even if its own
   attack would have sorted first. The unit card now states this where
   the order is given. Whether a stack under attack should always stay
   home, rather than being allowed to march out, is also a feel
   question; flag it when you play if it feels wrong.

9. Lore asymmetry against game symmetry (Cycle 7 judge flag 1 and
   its race question; the asymmetry passages and the endpoint note
   below are loop observations). The judge proved, and the loop
   verified on master, that the player text of "The Second
   Generation" can never be the one a campaign shows: both nations
   earn research at the same flat rate and the Dominion researches
   the first day it can afford it, so the best you can reach is both
   sides on day 21, never the Vessari alone first. The enemy text
   has the mirror problem: it says Gen 2 was copied from Vessari
   designs, in campaigns where the Compact has not fielded Gen 2
   at all. The judge's question underneath, in its own framing:
   should Drone Gen 2 feel like a race you can win outright, or
   like the simultaneous arms race the symmetric research now
   produces? You had not answered when Cycle 8 step 0 ran, so the
   loop took the default the judge prescribed: the card is narrowed
   to the outcomes the game can produce (enemy, both), the player
   variant is deleted, and the enemy text is reworded onto the
   Vessari first generation machines captured and copied in the
   Partition years. The race question itself is still yours: the
   loop will only build a player first research path on your word. The both text of "Blood on the
   Spine" also never fired in 200 passive campaigns the loop ran. The
   endpoint gap that used to sit in this item is closed: since Cycle 10
   step 1 both capital entries describe both endings (see the Cycle 10
   list at the top of this file). Separately, three passages in the lore imply edges
   the game does not give anyone: Khessograd's walls against
   Vesskar's walls that are "not much", the Dominion's old and
   enormous foundries, and Vessari steel that is "never enough",
   while in the game both nations start with identical steel,
   equipment, and research. Your call, in your own time: should the game grow
   asymmetries to match the text (a Vessari research edge, real
   capital walls, uneven steel), should the text be rewritten to
   match the symmetric game, or is the gap acceptable as unreliable
   national memory, which both entries already play with? Nothing
   is blocked; the unreachable Gen 2 player text is gone from the
   shipped card since Cycle 8 step 0, and the other passages above
   remain as written, open for your rewrite or veto.

10. Event cards hard pause the war (loop question, not the
    judge's). Every turning point card currently stops the clock until
    you press Continue; two cards landing on one day (day 21 in the
    standard passive run) pause twice in a row. Keep the hard pause
    on every card, pause only on the first card of a day, or let
    cards queue without pausing? Your feel call when you play it.

11. Event cards with a choice (loop question, not the judge's).
    A later lore pass could offer a choice on a card with a real
    effect in the game. That would break the sentence every card
    currently prints, that it changes nothing in the game, so the
    loop will not drift into it: only if you say so, and then the
    printed promise changes with it.

12. Capital starting fortifications (Cycle 8 prescription). The
    fortifications cycle the judge prescribed starts every capital
    unwalled, like every other province, until you rule otherwise.
    If capitals should start with a wall level (which would also
    give the Khessograd entry's walls a mechanic), say so before or
    during Cycle 8; the default was built in Cycle 8 step 1:
    every capital starts unwalled.

13. The Khessite voice (Cycle 7 judge, taste). The Dominion's entry
    and cards speak of theft, debtors, and taking the west back,
    with no sympathetic shading. The judge flagged the tone itself
    as yours to settle when you read the codex: keep the Khessites
    this unsympathetic, or give them a shade of sympathy?

Nothing here blocks the loop. Cycle 6 is complete, the first 6
reconciliation slices are decided, both assessed branch judge flag
fixes (1 and 4) are ported, and Cycle 7 (the lore seed) is complete
through its step 4 judge; the lore above is loop written and open for
your rewrite or veto. Cycle 8 (fortifications) is complete through
its step 4 judge (PASS WITH FIX-NOW FLAGS). Cycle 9 (Production
Line Efficiency Ramps) is complete through its step 4 judge
(PASS WITH FIX-NOW FLAGS, the one flag carried to Cycle 10
step 0 by the judge's own prescription). Cycle 10 (the second
lore pass) is complete: step 0 is done (that flag closed, the
readout exact), step 1 is done (recurring texture content and
recording hooks, capital endpoint wording), step 2 is done
(recurring texture on screen through the card overlay and the
codex), step 3 is done (formal texture tests, suite 73, balance
byte identical to tools/baseline-cycle9.txt), and step 4 (a
fresh judge) is done: PASS, no fix-now flags. Cycle 11
(Manpower) is in progress, prescribed in full in CYCLE_LOG:
step 1 (the sim: one pool per nation, intake per owned
province, per template costs paid at queue time through the
shared queueProduction path, the identical gate for the AI)
is done, step 2 (UI: pool and intake on the nation and enemy
cards, manpower costs on the production rows and the unit
card, a visible queue refusal, tools/manpower-check.js 15
of 15) is done, step 3 (tests and balance: suite 80, the
binding trace pinned, tools/baseline-cycle11.txt committed)
is done, and step 4 (a fresh judge) is done: PASS, no
fix-now flags, so Cycle 11 is complete. Cycle 12 (Drones
and EW with the cost exchange scoreboard) is prescribed in
full in CYCLE_LOG, starting at step 1 with no step 0 and
no carried flag; step 1 (the sim: interceptor launches,
the exchange ledger, and the EW generation counter) is
done, step 2 (the scoreboard, preview lines, and research
surfaces on screen, drone-ew check 28 of 28) is done,
step 3 (tests and balance: suite 90, the movement trace
recorded, tools/baseline-cycle12.txt committed) is done,
and step 4 (a fresh judge) is now also done: PASS, no
fix-now flags, the judge independently rerunning the
suite (90 pass), the balance diff (byte identical to
tools/baseline-cycle12.txt), and all six browser checks,
reproducing the movement trace (sensible seed 42, net
plus 445, 8 Dominion launches) and the non vacuity
mutant (89 pass, 1 fail on the current suite, clean at
80 on the pre step suite), and verifying in code that
every exchange and effectiveness number traces to the
CFG costs and the one shared readout and that the
ledger is read by no rule. Cycle 12 is complete. The
five taste questions above stay parked exactly as the
Cycle 11 judge left them, undecided by every Cycle 12
step; the judge verified the loop used only the
prescribed defaults (launches automatic, the plain word
interceptor, a steel only scoreboard, jamming on drone
fighting power only, no map appearance change for Gen 3).
Cycle 13 (Intel and Fog) is prescribed in full in
CYCLE_LOG at Cycle 12 step 4, starting at step 1 with
no step 0 and no carried flag: fog as an information
layer only that changes no battle number, one shared
intelState readout (live, remembered, or dark) from
owned ground, units, drone wings at sight range 2, and
agents, per nation snapshots no rule reads, and agents
built only through a priced production path and placed
through one public command, with the scripted AI not
reading intel in this cycle. Its judge parks six more
taste questions with you, also undecided and blocking
nothing: whether dark provinces should hide even
geography, names, and owner color (the loop default
keeps the theater map known and hides only military
fact); whether remembered provinces should show ghost
unit chips on the map or snapshot numbers only in the
inspector; whether the war level aggregate panels
should be fogged in a later cycle or stay known as
general war intelligence; whether the scripted AI
should become fog bound in a later cycle; whether
agents should be removable or counterable, gain
neighbors, or get a flavor name beyond the plain word
agent; and whether a later cycle should add a non
combat recon sortie order for drone wings. Cycle 13
step 1 (the sim: the intelState readout family, end of
tick snapshots, the priced Agent template and
plantAgent, and the Dominion's stated agent spending
rules) is now also done, as recorded in item 2 above.
Cycle 13 step 2 (fog on screen: the three map states
with a legend, the gated inspector and preview, the
agent surface and planting control, and
tools/intel-check.js at 29 of 29) is now also done, as
recorded in item 2 above; its one shape choice, ghost
chips for remembered provinces, shipped as the loop
default the prescription allowed and stays open for
your rewrite or veto. Cycle 13 step 3 (formal tests,
the recon trace, and the Cycle 13 baseline) is now
also done, as recorded in item 2 above. Cycle 13 step 4
(a fresh judge) is now also done: PASS WITH FIX-NOW
FLAGS, its one flag (the factory button fog leak, a
defect, not taste) carried to Cycle 14 step 0, so
Cycle 13 is complete. Cycle 14 step 0 is now also
done: that flag is closed, as recorded in item 2
above. Cycle 14 step 1 is now also done: navy in the
sim, as recorded in item 2 above. Cycle 14 step 2 is
now also done: navy on screen, as recorded in item 2
above. Cycle 14 step 3 is now also done: formal navy
tests, the binding traces, and the Cycle 14 baseline,
as recorded in item 2 above. Cycle 14 step 4 (a fresh
judge) is now also done: PASS, no fix-now flags, so
Cycle 14 is complete, as recorded in item 2 above.
Cycle 14 (Navy) is prescribed
in full in CYCLE_LOG, with six more taste questions
parked in item 2 above, all undecided and blocking
nothing. With Cycle 14 complete, the bible's v1
systems list is complete and the judge prescribed
no next cycle: the next direction is your call, and
the judge's candidates (a campaign end screen with
scoring, save and load, a playability pass) are
recorded in CYCLE_LOG as candidates only. The work runs without waiting on any
item above.

14. Campaign score floor and feel (Cycle 15 step 1). The new scoring
    readout weights are loop tuning in CFG: 10 points per province,
    5 per factory level, 1 per army strength point, the raw exchange
    net in steel, 50 for holding your own capital, and 100 for holding
    the enemy capital. Because the exchange net is signed, a heavily
    losing nation can finish with a negative total (a passive player
    on seed 1 finishes at minus 15). Should a campaign total floor at
    zero, or is a negative total an honest and even useful signal of
    how badly a campaign went? And do the weights themselves feel
    right when you see the end screen in step 2? Nothing is blocked;
    the readout ships as built until you rule.

15. Cycle 15 judge taste items (Step 4, all undecided, blocking nothing).
    The Cycle 15 judge returned PASS with no fix-now flags and parked five
    taste items beside item 14: (a) whether the end screen should show a
    start versus end comparison of the nation next to the final snapshot,
    since the core fantasy is starting weak and becoming visibly powerful
    and the screen currently shows the end only; (b) whether a short lore
    epilogue should accompany the final numbers, and how much text the end
    screen should carry; (c) whether the end screen should say explicitly,
    and in what voice, when a player wins on the victory conditions but
    trails on score (the margin line already states the facts; this is
    only about naming the case); (d) whether the cost exchange values
    should be rescaled so the numbers read more naturally to a player (a
    display scale question, not a change to what the ledger computes);
    (e) whether the exchange component should gain a uniform named scoring
    weight (it is currently the raw net at one point per steel, the only
    component with no CFG weight), which sits with item 14 weights
    question. The judge also noted, without making it a defect, that the
    exchange component scale across drone heavy sensible play is
    unmeasured; a readout only tally across the standard seeds and paths
    would answer it if you want the number before ruling.

16. Cycle 17 judge taste items (Cycle 16 Step 5, all undecided, blocking nothing).
    The Cycle 16 judge returned PASS WITH FIX-NOW FLAGS (the one flag
    closed by attribution, see CYCLE_LOG) and prescribed Cycle 17, the
    playability pass, with seven taste items parked for you: (a) hint
    style, contextual first encounter hints (the Step 3 default) against
    a guided tutorial sequence; (b) visible progression display, whether
    to add a since day 1 country growth readout, which needs history the
    sim does not keep today and so needs a ruling on where that history
    lives and whether it enters the save; (c) save slots and autosave, a
    single slot (current) against multiple named slots, and whether
    autosave exists and how often it runs; (d) default speed, what speed
    a new game starts at and whether speed should reset on newGame, given
    that it survives today; (e) voice of player facing text, plain and
    neutral against in world flavored wording for errors, hints, and
    confirmations; (f) color and accessibility, whether the map legend
    palette needs a colorblind safe variant in this pass or a later one;
    (g) balance, where any balance change found during the Cycle 17 walk
    is logged and parked under your 2026-10-11 ruling, never applied in
    Cycle 17. The uniform exchange weight question the judge also listed
    is already parked at item 15(e) and stays there.

17. Cycle 17 judge taste items (Step 5, all undecided, blocking nothing).
    The Cycle 17 judge returned PASS WITH FIX-NOW FLAGS (the one flag is
    documentation only and rides to Cycle 18 Step 0; it is not taste) and
    listed five taste items in the order of how much they hold the game
    back from its pitch: (a) visible progression, already parked at item
    16(b), named by this judge as the weakest compass axis and the largest
    gap between the game and its pitch, needing your ruling on what
    history the sim should keep and what a later era country should look
    like; the look of Cycle 18's pending order markers also falls under
    this item (their existence is spec, their style waits for the
    ruling); (b) the equipment third spend: the core loop is now legible
    end to end but its tail goes slack with a late campaign surplus
    (recorded under the economy item in BACKLOG.md), and any new sink is
    design and balance, so name the sink or rule the surplus intended;
    (c) production line cancel or pause, already parked at item 6,
    confirmed still parked by this judge; (d) blockade frequency:
    blockade never fires in the 32 standard harness campaigns, Cycle 18
    Step 4 will prove its explanation renders in a staged scenario and
    record the finding, and whether a mechanic players almost never see
    is working as intended or needs balance work is then yours; (e) gap
    index items 10 and 15 remain PARKED exactly as recorded, listed by
    the judge so the ledger is complete. None of these was decided by
    the loop, and Cycle 18 is prescribed only from the spec items that
    remain once these are excluded.

18. Cycle 18 judge taste items (Step 5, all undecided, blocking nothing).
    The Cycle 18 judge returned PASS WITH FIX-NOW FLAGS (the three flags
    are evidence and test items carried to Cycle 19 Step 0; they are not
    taste) and parked five taste items: (a) Why line weighting: the per
    battle Why line lists the fight's facts but does not say which one
    decided it, and it omits the per round random multiplier by the
    Step 0 spec's deliberate choice, so a player can read attack ahead
    of defense and still see a loss with no on screen reason; whether
    to add a closing clause naming the deciding factor, or naming luck
    where the record supports it, is yours (any luck wording must come
    from the record, never inferred at render time); (b) save size
    growth: the battle record lengthens state.log inside the save
    payload, and whether to measure a long campaign save and set a soft
    ceiling (for example trimming records older than a set number of
    days) is yours; (c) stacked order markers: two markers on one target
    are correct by count but may read poorly, and a numeric badge is a
    cosmetic option only after Cycle 19 Step 0 pins the exact counts;
    (d) blockade distance to threshold: if you keep blockade rare, the
    card could show how close each nation is (for example 2 of 3
    needed) so the mechanic is learnable before it fires, which rides
    with your dormancy ruling in item 17(d); (e) a deliberate lore
    cycle: js/lore.js has not moved for several cycles, and the judge
    suggests the EU5 axis get one deliberate cycle before the project's
    identity drifts entirely toward systems. The same judge's Step 1
    direction also puts three standing questions to you as explicit
    decisions with recommended defaults recorded in CYCLE_LOG (history
    retention for visible progression, item 16(b) and 17(a); the
    equipment third spend, item 17(b); blockade dormancy, item 17(d));
    the loop will present them and build nothing on silence.

19. Cycle 19 Step 1 ruling sheet (presented 2026-10-18 by the build loop,
    awaiting your ruling; nothing is built on silence). The Cycle 18
    judge directed that three standing questions, plus the item 6 gate
    for Cycle 19 Step 2, be put to you as explicit questions with
    recommended defaults. Each question below can be answered in one
    line. Until you rule, Cycle 19 Steps 2 and 3 stay unstarted, exactly
    as the step list in CYCLE_LOG records.

    Q1. History retention for visible progression (items 16(b) and
    17(a); your ruling here gates Cycle 19 Step 3, the first visible
    progression surface). The game keeps no history today: the end
    screen shows the final snapshot only, and a year 3 country cannot
    be compared with its day 1 self on any screen. The judge's
    recommended default is a compact per nation snapshot, recorded at
    fixed day intervals across the 150 day campaign (the loop's
    proposed interval: day 1, then every 30 days, plus the final day,
    so at most 6 records per nation), holding only provinces owned,
    total factory levels, army strength, production lines open, steel,
    equipment, and manpower. Like the beats and textures records, no
    rule would read it; it would exist only so a screen can show the
    comparison.
    - Option A (judge's recommended default): the compact snapshot
      above. Step 3 then builds a comparison panel from it.
    - Option B: start and end only. One day 1 snapshot per nation is
      kept, and Step 3 becomes a start versus end panel. Less storage,
      no growth curve.
    - Option C: no history. Step 3 is skipped and recorded, and
      visible progression stays a map only matter.
    Save consequence, stated before any code: options A and B put
    history inside the game state and therefore inside the save
    payload, so the build step that follows your ruling first makes a
    saveVersion decision in the Cycle 18 Step 0 style. Option C has
    no save consequence.

    Q2. The equipment third spend (item 17(b)). Equipment today has
    exactly two spends: a factory level costs 40 times the target
    level (40, 80, 120; maximum level 3 per province) and a
    fortification level costs 100 times the target level (100, 200;
    maximum level 2), while factories produce 5 equipment per level
    per day. In the committed Cycle 18 baseline the sensible player
    finishes holding 1860 to 4405 equipment across the 8 standard
    seeds, and even the fortress profile, which also buys walls,
    finishes with 720 to 3395: late in a campaign the stockpile has
    nothing left to buy. Two concrete costed options, both loop
    proposals with proposed prices, not tuned facts; whichever you
    pick gets its own build cycle and must pass the standing balance
    ruling before it ships:
    - Option A, reinforce: equipment restores strength to a damaged
      unit, at a proposed 15 equipment per strength point, only for a
      unit standing on supplied owned ground, never above its full
      strength (infantry 12, drone wing 6). Costed examples: an
      infantry division at half strength (6 of 12) costs 90 to refill;
      a wing at 1 of 6 costs 75. An end of campaign surplus of 1860
      would buy about 124 strength points if it were all spent this
      way. Note: the Cycle 11 judge separately parked whether manpower
      may one day pay for partial reinforcement; this option is the
      equipment version of that question, and picking it settles the
      sink, not the manpower question.
    - Option B, convert: equipment is scrapped into steel at a
      proposed 5 equipment for 1 steel, through a control on the
      nation card, capped only by the stockpile. Costed example: a
      2000 surplus converts to 400 steel, about 13 infantry divisions
      at their 30 steel build cost. No new unit, system, or map
      object; the compounding loop gains an outlet instead of a new
      verb.
    - Option C: rule the surplus intended. No third spend is built,
      and the surplus stands in the record as the honest end state of
      a won economy.

    Q3. Blockade dormancy (items 17(d) and 18(d)). Blockade bites when
    a nation controls at least 3 of the other nation's home coastal
    provinces, and costs the blockaded nation 25 percent of its daily
    steel income (both numbers are CFG values in js/sim.js). It has
    never fired in play the loop can measure: 0 of the 32 standard
    harness campaigns in the Cycle 18 baseline, and 0 blockaded nation
    days across 289 days of passive campaigns tallied at Cycle 18
    Step 4. Its explanation is proven on screen (Cycle 18 Step 4); its
    frequency is the open question.
    - Option A (judge's recommended default): diagnostic first. A
      later step records, with no behavior change, how close each
      nation comes in real campaigns (the highest coastal control
      count reached, and the days spent at 1 and at 2 of the 3
      needed), and you rule on tuning with that evidence in hand.
    - Option B: tune now, without the diagnostic (for example a
      threshold of 2, or a higher steel percent). This is a balance
      change under your 2026-10-11 ruling and is not the judge's
      recommendation.
    - Option C: rule dormancy intended. Blockade stays rare by
      design; the distance to threshold display in item 18(d) can
      still be considered on its own if you want the mechanic
      learnable before it fires.

    Q4. Production line cancel or pause (item 6; your ruling here
    gates Cycle 19 Step 2). Today a queued order cannot be cancelled
    or refunded and a line cannot be paused. The money facts that
    shape any answer: manpower is paid in full at queue time
    (infantry 120, drone wing 25, interceptor 10, agent 60, flotilla
    30), while steel is never paid up front; it drains day by day
    only while a unit is in progress, and retooling already scraps an
    in progress unit with no steel refund. Item 6 asks the refund
    question directly: full refund, partial refund, or none.
    - Option A, the smallest form: cancel applies to queued orders
      only, the manpower paid for a cancelled order is refunded in
      full, and a unit already in progress cannot be cancelled (the
      retool scrap rule already covers ending its line's work). No
      pause.
    - Option B: cancel reaches the unit in progress as well, with
      manpower refunded and the steel already drained lost, exactly
      as a retool loses it today.
    - Option C: cancel plus pause (a paused line holds its queue and
      its work in progress and drains nothing until resumed).
    - Option D: no cancel and no pause. Cycle 19 Step 2 is skipped
      and recorded, and item 6 stays as the standing rule.

    Cycle 19 closure note (2026-10-18, loop record, not a ruling):
    Steps 2 and 3 of Cycle 19 are now recorded as skipped in
    CYCLE_LOG, because no ruling on Q1 or Q4 above had arrived
    through any channel the loop can read. Nothing above is decided
    by that skip: Q1 to Q4 stay open, and a later ruling starts the
    matching work in a later cycle.

20. Rulings under the autopilot order (2026-10-18, superseding the
    Cycle 19 closure note above). Jash's order of 2026-10-18: this loop
    is wholly autopilot; decisions, taste calls, and guidance questions
    never go to Jash and never wait on his silence; they are settled by
    Claude. The Cycle 19 Steps 2 and 3 skips, recorded on silence, are
    superseded by this order and reopen in Cycle 20 under the rulings
    below. Each ruling carries the words the order requires: Ruled by
    Claude under Jash's 2026-10-18 autopilot order.

    Q1, history retention for visible progression: Option A adopted,
    the judge's recommended default (compact per nation snapshots).
    Ruled by Claude under Jash's 2026-10-18 autopilot order. The
    snapshots are recorded at day 1, then every 30 days, plus the
    final day, at most 6 records per nation, holding only provinces
    owned, total factory levels, army strength, production lines
    open, steel, equipment, and manpower; no rule reads them. History
    lives inside the game state and therefore inside the save
    payload; the build step makes its saveVersion decision before
    any code, in the Cycle 18 Step 0 style. This ruling reopens the
    visible progression build as Cycle 20 Steps 3 and 4 (history in
    the sim, then the comparison panel), after the Q4 build, per the
    cycle order in the Q4 consultation below.

    Q2, the equipment third spend: Option A adopted, reinforce.
    Ruled by Claude under Jash's 2026-10-18 autopilot order, on the
    Opus 5.5 consultation recorded in full in CYCLE_LOG at Cycle 20
    Step 0 (usage in 2119, out 5027). Equipment restores strength to
    a damaged unit at 15 equipment per strength point, only for a
    unit standing on supplied owned ground, never above its full
    strength, through an explicit command on the unit card, never
    automatic; partial points may be bought when the stockpile is
    short; a unit engaged in combat that day and a destroyed unit
    cannot be reinforced; stackPower is unchanged and reinforcement
    writes only to the existing strength field. The pick gets its
    own build cycle (Cycle 21, after Cycle 20) and must pass the
    standing balance ruling on the 8 standard seeds before it ships,
    with the sensible and fortress profiles updated to reinforce,
    the reckless profile run with and without reinforcement and
    losing both ways, the AI using the same command under the same
    rules, and the balance report showing equipment spent on
    reinforcement per seed. The price of 15 is the only tuning knob,
    adjusted in small slices if bands move; eligibility is not
    loosened to fix balance. The manpower reinforcement question
    stays parked, untouched by this ruling.

    Q3, blockade dormancy: Option A adopted, diagnostic first, the
    judge's recommended default. Ruled by Claude under Jash's
    2026-10-18 autopilot order. A later step records, with no
    behavior change, how close each nation comes in real campaigns
    (the highest coastal control count reached, and the days spent
    at 1 and at 2 of the 3 needed), and any tuning ruling waits for
    that evidence. The diagnostic's build home is the first step of
    the cycle after the Q2 cycle (Cycle 22 planning), recorded here
    so the ruling is not lost; Cycle 20 and Cycle 21 do not carry it.

    Q4, production line cancel or pause (item 6): Option A adopted,
    cancel queued orders only. Ruled by Claude under Jash's
    2026-10-18 autopilot order, on the same Opus 5.5 consultation as
    Q2. Cancel applies to queued orders only; the manpower paid for
    a cancelled order is refunded in full, at the cost that order
    currently represents after any retool settlement (infantry 120,
    drone wing 25, interceptor 10, agent 60, flotilla 30); a unit
    already in progress cannot be cancelled and shows no cancel
    control, and its surface states that retooling scraps it and its
    drained steel is lost; there is no pause. Cancel does not touch
    line efficiency, adds no new state and no saveVersion change,
    and the AI and the balance profiles never cancel, so the balance
    must stay byte identical to tools/baseline-cycle18.txt through
    the Q4 steps; any diff is a bug, not a tuning event. Required
    tests: exact refund per unit type, an in progress unit cannot be
    cancelled, cancelling the middle of a multi order queue
    preserves the order of the rest, cancel after a retool refunds
    the post retool cost, and a save and load round trip covering a
    queue after a cancel. This ruling reopens the cancel build as
    Cycle 20 Steps 1 and 2 (the sim command, then the panel
    control), landing before the Q1 build per the consultation's
    cycle order, because it is small, needs no save change, and
    keeps any save or balance regression attributable to one change.

21. Cycle 20 milestone settlements (2026-10-18, under the autopilot
    order). Two items from the Cycle 20 milestone review are settled
    here so later cycles do not reopen them. (a) The final snapshot
    day seam: a history snapshot stamps the day its ending tick began
    (day 35 on passive seed 1) while the balance report's reportDay
    is the following day; the same stamp before increment convention
    holds for beats, textures, and intel, and Cycle 20 Step 3 pinned
    it. Ruled: keep the current semantics, no change. Ruled by Claude
    under Jash's 2026-10-18 autopilot order. (b) The milestone's
    completion call 3 taste items (queued reinforce orders and their
    associated defaults) are not adopted: they contradict the Q2
    ruling in item 20 (an instant explicit command, never a queued
    order). The Cycle 21 step list in CYCLE_LOG at the Cycle 20
    Step 6 entry governs. Ruled by Claude under Jash's 2026-10-18
    autopilot order.

22. Cycle 21 Step 0 rulings (2026-10-18, the judge's eight Step 0
    questions answered from the code; each ruling carries the words
    the autopilot order requires). Ruled by Claude under Jash's
    2026-10-18 autopilot order.

    Ruling 1, engaged in combat that day: there is NO existing
    source of truth. addUnit gives a unit id, nation, type,
    provinceId, strength, maxStrength, order, daysOut,
    supplyPenalty, and attritionCarry, and no combat day field.
    The battle record from fightRounds carries nation ids, powers,
    penalties, launch counts, and destroyed counts, and no unit
    ids. movementPhase holds participant id sets only in local
    variables and discards them on return; state.log is capped at
    60 entries and no rule reads it. New state is therefore
    required, and it was ruled by consultation in the same run
    (Opus 5.5 through the anthropic.py route, usage in 1987, out
    3661): Option A, sub choice A1. One saved per unit field,
    lastCombatDay, initialized to null in addUnit and read through
    a typeof fallback, where null means never fought. saveVersion
    stays 3 with no bump and no load migration, because units is
    already a required key whose contents are not shape validated
    on load and a missing field has the safe meaning never fought
    (the manpower pool and line efficiency fallbacks are the
    codebase precedent; the version 2 to 3 bump was for a new
    required top level key, which this is not). movementPhase
    stamps lastCombatDay with the day the tick began, on the real
    unit by id in the same writeback pass as strength, for every
    participant on both sides of every battle, meeting, and clash
    engagement, including a drone destroyed by an interceptor
    launch; uncontested movers, adjacent bystanders, and undrawn
    units are not stamped, and battleClone does not copy the
    field. The shared refusal check refuses when lastCombatDay is
    a number at least state.day minus 1, evaluated after the not
    destroyed and owned checks and before the cost computation,
    and the refusal text names the day of the fight and never says
    "today", in the shape: fought in the battle of day D, units
    can be reinforced after a full day out of combat. Options B
    (transient unsaved field), C (dropping the rule), D (a proxy),
    and E (participant ids in the capped log) were rejected with
    reasons in the consultation. This ruling amends item 20 Q2's
    "no per unit state" for this single field only; every other
    Q2 constraint stands. Ruled by Claude under Jash's 2026-10-18
    autopilot order.

    Ruling 2, supplied ground: the supply function is
    computeSupply(state, nationId) in js/sim.js, the function
    supplyPhase calls for both nations. It returns, for every
    province the nation owns, supplied, hops, and reason.
    Reinforce calls computeSupply(state, unit.nation) and reads
    the entry for unit.provinceId. No new approximation of supply
    is allowed. Ruled by Claude under Jash's 2026-10-18 autopilot
    order.

    Ruling 3, owned ground: the tile owner field is
    state.provinces[unit.provinceId].owner and the rule is owner
    equals unit.nation. Captures apply at the end of movementPhase
    in canonical province order, setting prov.owner to the
    capturing nation before onProvinceCaptured runs, so a unit
    that captures a province stands on owned ground from the
    moment that tick completes, on the day of capture. A blocked
    or contested arrival does not move and changes nothing.
    Ruled by Claude under Jash's 2026-10-18 autopilot order.

    Ruling 4, not destroyed: destroyed units are removed from
    state at the end of tick by the strength over 0 filter after
    movementPhase; inside a tick a dead unit sits at strength 0
    until that filter. The rule is strength over 0 AND the unit
    still present in state.units. A stale reference to a removed
    unit is refused. Ruled by Claude under Jash's 2026-10-18
    autopilot order.

    Ruling 5, strength ceiling and granularity: the ceiling field
    is unit.maxStrength, set in addUnit from
    CFG.unitTypes[type].strength (infantry 12, drone 6; the
    interceptor, agent, and flotilla templates are stockpiles and
    never take the field, so they are never reinforce targets).
    Reinforce buys whole strength points only, at 15 equipment
    each, capped by maxStrength minus strength and by the whole
    points the equipment on hand affords. No fractional points
    and no partial equipment charge. Ruled by Claude under Jash's
    2026-10-18 autopilot order.

    Ruling 6, timing inside the tick: a player command resolves
    immediately when issued, matching queueProduction,
    cancelProduction, and assignLineTemplate, which mutate inside
    the call and are invoked from js/main.js click handlers
    between ticks. Reinforce follows that convention. The AI
    reinforce decision in Step 4 sits inside aiTakeTurn, which
    tick calls after supplyPhase and before movementPhase, so the
    AI decides on the same state the player sees between ticks,
    with the most recent combat still the previous tick's. Ruled
    by Claude under Jash's 2026-10-18 autopilot order.

    Ruling 7, stackPower: stackPower in js/sim.js is not edited
    for reinforce. It sums per unit attack or defense for living
    units, gating on strength over 0 and never scaling by the
    strength value; strength is the damage pool applyDamage soaks
    into. A reinforced unit's benefit is durability and the full
    strength totals in campaignScore and historySnapshot, not a
    stackPower change, and no later run is to "fix" stackPower to
    scale by strength under this cycle. Ruled by Claude under
    Jash's 2026-10-18 autopilot order.

    Ruling 8, manpower: reinforce reads and writes no manpower
    field. Its only spend is state.nations[nationId].equipment.
    Step 2 tests assert the manpower pool is byte identical
    before and after every reinforce call, refused or accepted.
    Ruled by Claude under Jash's 2026-10-18 autopilot order.


23. Cycle 21 milestone settlements (2026-10-18, under the autopilot
    order). (a) F3 and F5 from the Cycle 21 judge are closed by
    orchestrator verification in the Step 6 entry of CYCLE_LOG:
    stackPower is byte identical across the cycle, every deleted line
    is attributed there, and the ending equipment figures already
    exist in the balance report as endEquipment and
    enemyEquipment, with the surplus finding recorded (reinforce
    spends 240 to 390 per good campaign and does not close the
    surplus; the 15 per point knob stays untouched). No new report
    columns are built for F5. (b) The judge's four taste items are
    adopted as rulings: reinforce notice wording leads with the unit
    name and the gain; factory markers use three clear tiers; a
    damaged unit colour reuses an existing palette colour rather
    than adding a new one; the Cycle 22 growth view is labelled with
    in world days, not snapshot indices. Ruled by Claude under
    Jash's 2026-10-18 autopilot order. (c) Cycle 22 runs the judge's
    prescription recorded at Cycle 21 Step 6 in CYCLE_LOG, starting
    with Step 0; the blockade diagnostic ruling itself is recorded
    at Cycle 22 Step 1 before any instrumentation, per that
    prescription.

24. Cycle 22 Step 0 rulings (2026-10-18, under the autopilot
    order). Ruled by Claude under Jash's 2026-10-18 autopilot
    order.

    (a) Closures carried from Cycle 21, recorded and re-verified
    on HEAD bcc4a87 in this step. F3 is closed: the stackPower
    function body extracted at 2cee316 (the pre Cycle 21 commit)
    and at HEAD is byte identical, 1551 characters at both
    revisions, sha256
    b25006c44f303e7afe9cd2a845e34e068951cd30d4f16748bd6787e1e333349d,
    cmp clean, re-run in this step, not only cited from the
    milestone entry; and every deleted line in the cycle is
    attributed in the Cycle 21 Step 6 claims check in CYCLE_LOG
    (js/sim.js 3, js/save.js 1, tools/save-hardening-check.js 5,
    BACKLOG.md 1, each a comma, a comment, a renumbering, or the
    standing backlog paragraph replacement, with no assertion
    weakened or removed). F5 is closed as instrumentation: the
    ending equipment figures already exist in every balance
    report row as endEquipment (player) and enemyEquipment
    (Dominion), so no new report columns are built for F5. The
    surplus finding, read from tools/baseline-cycle21.txt in
    this step: sensible spends 240 to 390 equipment on reinforce
    and ends with 1525 to 3505; fortress spends 240 to 375 and
    ends with 225 to 1765; passive spends 0 and ends with 725 to
    2310. Reinforce is a real sink and does not close the
    surplus, and the 15 equipment per point price stays
    untouched. Future milestone packages quote endEquipment and
    enemyEquipment beside any spend figure.

    (b) Visible progression design for Cycle 22 Steps 3 and 4,
    ruled before any code. Presentation only, over fields that
    already exist: no new system, no new field, no new saved
    state, saveVersion stays 3, stackPower untouched, and
    lastCombatDay remains the only per unit addition since
    Cycle 20. Every visual reads a sim field or accessor once
    in the renderer and derives no game number: no summing, no
    averaging, and no threshold invented in the UI. The one
    mapping allowed is identity mapping, a field value to its
    own tier or label, as below. All map marks inherit the
    existing intel gating in renderMap (live provinces show
    their true marks, remembered provinces show their snapshot
    marks, dark provinces show none), so no progression mark
    may leak a fact fog hides.

    Step 3 sources, field by field. Factories: the tier is the
    province factoryLevel itself, 1, 2, or 3, against
    CFG.maxFactoryLevel 3; the existing factory badge in
    renderMap, carrying its lvl1, lvl2, and lvl3 classes, is
    the tier carrier, and Step 3 strengthens those three tiers
    so they read apart at a glance and adds plain words legend
    text for them, per item 23(b) (three clear tiers). No
    factory count is summed on the map; the nation level total
    stays where it already lives, on the nation and enemy
    cards through Sim.factoryLevels. Rail: the state is the
    edge rail state the existing railBar helper already reads,
    built (a rail with no days left and not converting),
    building, converting, or absent (no rail object, no bar);
    built already draws as a solid bar and building or
    converting as a striped bar with a days tag, and Step 3
    may strengthen that distinction in CSS and legend words
    only, reading the edge state once per edge. Units: a unit
    chip reads unit.strength and unit.maxStrength once and
    shows current strength against maximum at a glance (the
    unit card already states both numbers in words; the chip
    is the map surface Step 3 owns). A damaged unit, strength
    below maximum, reuses an existing palette colour, the red
    family already used for enemy chip borders and supply
    tags, per item 23(c); Step 3 introduces no new colour
    value.

    (c) Step 4 home surface, ruled: the existing Campaign
    growth card (index.html progression card, renderProgression
    in js/main.js, built in Cycle 20 Step 4) is the single
    growth view. Step 4 creates no second view and no second
    panel; its work is the judge's exit proof on that card
    (saves with 1, 3, and 6 snapshots read back before use,
    rendered values equal to saved values, a one field shift
    mutant failing, and a save that fails history validation
    never reaching the view), plus any wording the proof shows
    missing. The view draws only from the eight validated
    history snapshot fields (day, provinces, factoryLevels,
    armyStrength, linesOpen, steel, equipment, manpower),
    labels each snapshot by its day, per item 23(d) (in world
    days, never a snapshot index), and handles one snapshot
    honestly as a single point with no change row and no fake
    trend, which is the card's current behaviour. Snapshot
    cadence and fields do not change.

    (d) Dominion reinforcement surface, ruled: the war log.
    The chain already exists end to end and Step 0 records it
    so Step 2 proves it instead of inventing a surface:
    reinforceUnit in js/sim.js logs every reinforcement for
    both nations through logEvent, in the shape nation name,
    reinforce, unit label, province, points gained, and
    equipment cost; state.log carries the entry; renderLog in
    js/main.js renders state.log as the war log the player
    reads (the last 12 entries). No new notice, panel, or UI
    surface is created for this. Step 2 work under this ruling:
    a browser proof that a Dominion reinforcement line renders
    in the war log against a read back staged save, and the
    engaged today wording item, whose text lives at its source
    in reinforceEligibility in js/sim.js (today it reads, in
    part, fought in the battle of day D, units can be
    reinforced after a full day out of combat) and reaches the
    unit card only through Sim.reinforceInfo, with the card
    computing nothing. Any wording change happens at that
    source, never in the renderer. The item 23(a) wording
    settlement (lead with the unit name and the gain) applies
    to the player facing reinforce notice on the unit card;
    the war log line keeps its nation first shape, which is
    how every war log entry names its actor.

    (e) What Step 0 does not rule. The blockade diagnostic
    ruling is not made here: Cycle 22 Step 1 records it in
    DECISIONS before any instrumentation is written, exactly
    as the Cycle 21 prescription states, and Step 0 makes no
    blockade claim and builds no diagnostic figure. No tuning
    of any kind is ruled or made in Cycle 22 (the 15 per point
    reinforce price, blockade parameters, and AI weights all
    stay as they are).

25. Cycle 22 Step 1 blockade diagnostic ruling (2026-10-18,
    recorded before any instrumentation is written, as the
    Cycle 21 prescription requires). Ruled by Claude under
    Jash's 2026-10-18 autopilot order.

    (a) The diagnostic ruling, pre instrumentation. What
    blockade is believed to do, from the code: a nation is
    blockaded when the opposing nation controls at least
    CFG.blockadeCoastalThreshold (3) of its home coastal
    provinces, where control means the owner holds the
    province with units or a stationed flotilla
    (Sim.coastalControl), home coastal provinces are the 10
    coastal provinces on a nation's own half of the theater
    (Sim.homeCoastalProvinces), and the one mechanical effect
    is that the blockaded nation loses
    CFG.blockadeSteelPct (25) percent of its daily steel
    income, rounded down, through incomePhase only
    (Sim.blockadeLoss). The belief under test: blockade never
    fires in the standard harness campaigns because the
    scripted armies of every profile fight the capital row
    and never contest the coastal rows, so no nation ever
    controls even one enemy home coastal province. Which
    profiles and seeds should show it: none of the five
    harness profiles (passive, sensible, reckless,
    reckless-reinforce, fortress) on any of the 8 standard
    seeds is expected to reach a count above 0, because no
    profile orders a unit toward a coastal province, builds
    or stations a flotilla, or holds captured coastal ground.
    The figure that confirms or refutes it: for each nation,
    sampled after each tick completes, the offensive count
    Sim.enemyHomeCoastalControlCount(state, nation), meaning
    how many of the opposing nation's home coastal provinces
    that nation controls; the report carries, per nation, the
    highest count reached in the campaign and the number of
    sampled days the count stood at exactly 1 and exactly 2
    of the 3 needed. Confirmation is a highest count of 0 and
    zero days at 1 and at 2 for both nations in all 40
    campaigns: the armies never come within two provinces of
    the threshold, so dormancy is a profile geography fact,
    not a threshold arithmetic defect. Any highest count of
    2 or more, or a run of days at 2, refutes the strong form
    and reframes dormancy as a near miss. The instrumentation
    is report only: new columns in tools/balance.js, sampled
    through the existing readouts, changing no simulation
    outcome, with the exit proof that the balance output is
    byte identical to tools/baseline-cycle21.txt once the
    new columns are stripped.

    (b) The finding and the next action, ruled after the
    evidence (Cycle 22 Step 1, same run). The diagnostic
    confirms the belief in its strong form: across all 5
    profiles on all 8 standard seeds, 40 campaigns and 1607
    sampled campaign days, the highest offensive coastal
    control count reached by either nation in any campaign
    is 0, with zero days at 1 and zero days at 2 of the 3
    needed (tools/baseline-cycle22.txt, every blockade field
    0 in all 40 rows; the stripped output is byte identical
    to tools/baseline-cycle21.txt). Dormancy is a profile
    geography fact, not a threshold arithmetic defect: the
    scripted armies never enter the coastal rows at all, so
    a threshold of 1 would also never fire. The surplus
    answer, quoted from the same report: sensible spends
    240 to 390 on reinforce and still ends at 1525 to 3505
    equipment (Dominion ends 1335 to 3530); fortress spends
    240 to 375 and ends at 225 to 1765; reckless-reinforce
    spends exactly 30 and ends at 810 to 2270; reinforce
    does not close the late campaign surplus. Next action:
    Option A adopted, leave as is. Ruled by Claude under
    Jash's 2026-10-18 autopilot order, on an Opus 5.5
    consultation in the same run (usage in 1031, out 1422):
    keep the threshold at 3 and the steel effect at 25
    percent unchanged; blockade stays a player driven
    strategic option whose count against the threshold is
    already shown on the nation card, so it is legible
    before it fires. The consultation's two caveats are
    adopted with it: leave as is means until human play
    data says otherwise, not never revisit; and if AI
    opponents share the scripted profiles' blindness to
    the coast, humans can blockade but are never blockaded,
    an asymmetry that belongs to future AI behavior work
    judged on its own evidence, not to a blockade retune.
    No tuning is made in Cycle 22.

    (c) The reachability proof and the closing of flag F3
    (Cycle 23 Step 2, 2026-10-19). Ruled by Claude under
    Jash's 2026-10-18 autopilot order. The premise in (a)
    and the Option A ruling in (b) are now proven for the
    player side: tools/blockade-reachability.js drives one
    campaign on seed 42 at commit 323d2b0 through the public
    command path only (queueProduction, researchDroneGen2,
    issueOrder, tick, and the readouts; no state writes, no
    staged provinces, no debug setters), bending both flanks
    toward the coast on lane weighted routes and holding the
    captured coastal provinces with units. The offensive
    count first reaches 1 and 2 on day 5 (the north and
    south river coastal provinces fall on the same tick)
    and 3 on day 6. The steel figures around the threshold:
    day 5, count 2, Dominion steel 43, income 35, blockade
    loss 0; day 6, count 3, steel 50, income 35, loss 8,
    isBlockaded true, the loss exactly the floor of 35
    times the CFG 25 percent; day 7, count still 3, loss
    still 8, the day 7 tick income phase having applied the
    threshold day loss (the stockpile line itself also
    carries the Dominion's own spending, so the readout,
    not the stockpile delta, is the effect figure). An
    orchestrator cross check with the same routing on all
    8 standard seeds reaches count 3 on day 6 on every
    seed, with threshold losses of 8 to 11 steel. Flag F3
    is closed: blockade is reachable by a player through
    the public path and its effect lands; item 25 does not
    reopen. The (b) caveat stands unchanged: the scripted
    AI never contests the coast, so a player can blockade
    but is never blockaded; that asymmetry stays future AI
    behavior work, not a blockade retune. No parameter
    changes.

26. The visual transformation (2026-10-18, Jash's direction,
    executed under his pipeline order and the autopilot
    order). Jash saw the game for the first time and rejected
    the tile grid in his own words: it is not a map, they are
    random squares, there are no models attacking each other,
    and it has to look good. He ordered the method as well as
    the outcome: research first, then Claude designs the
    workflow and the full strategy from the research, then
    testing, then build. Adopted documents, all in this repo:
    VISION_BOARD.md (the Lamplit War Table, Opus 5.5),
    RESEARCH.md (five research lanes; the board's
    architecture confirmed, six amendments D1 to D6 forced),
    and STRATEGY.md (Claude's image production workflow and
    full visual strategy, written 2026-10-18; the API route
    returned its known one byte failure and the document came
    through the local Claude Code CLI fallback, disclosed in
    the file itself). Rulings recorded from STRATEGY.md: the
    master reference is the OpenAI diorama board image
    (art-direction/master-diorama-board.png) and every asset
    derives from the master sheet, never from a sibling; the
    missing OpenAI blender table concept is skipped
    permanently (it could only be a sibling, and the cap
    reset is worth more in the TX01 bake-off); ownership is a
    gradient border band, not a fill; fog is texture, never
    darkness, and Last seen hides live numerals; sprites ship
    only after a 100 percent grayscale silhouette
    identification test at final size; the sprite camera is
    locked at due south, X 45 degrees, on a flat top down map,
    facings rotate and never flip; tint is the overlay formula
    on a gunmetal base calibrated to sRGB 128; the build runs
    as Cycle 23 in BACKLOG.md, 22 runs, plaques first and
    miniatures last. Two decision points are named inside the
    strategy and are settled here in advance under the
    autopilot order: (a) the faction colors sit only 7 luma
    levels apart, so owner identity in grayscale belongs to
    the plaques (different fills, corners and strokes, about
    a 70 level split plus a shape channel); if the Run 19
    tuning pass still fails its thresholds, darkening
    Khessite red's value while keeping its hue is adopted as
    the standing fallback and Claude rules on its exact value
    in that run, recording the ruling here; (b) the three
    owner checkpoints in the run plan are demonstrations for
    Jash, not approval gates, and the cycle never waits at
    them. Ruled by Claude under Jash's 2026-10-18 autopilot
    order, on Jash's own visual direction of the same day.

27. Cycle 23 Step 0 rulings (2026-10-18, under the autopilot
    order). Ruled by Claude under Jash's 2026-10-18 autopilot
    order.

    (a) The Cycle 23 scope conflict, reconciled. Two shapes
    claimed the name Cycle 23: the visual transformation
    (Jash's direct order of 2026-10-18, recorded at item 26
    above and in BACKLOG.md, 22 runs in STRATEGY.md section
    2.7) and the Cycle 22 milestone judge's prescription
    (deflake, blockade reachability, deliberate lore). Neither
    is renumbered and neither is dropped. The visual
    transformation keeps the name Cycle 23, because it is
    Jash's own order and its documents and run numbers are
    already the record. The judge's prescription folds into
    Cycle 23 as its opening and closing steps, in this order:
    Step 0, this decisions and audit step; Step 1, the deflake
    (the judge's flags F1 and F2, tests and tools only, the
    first code step of the cycle, before any content work,
    exactly as the judge homed them); Step 2, the blockade
    reachability proof (flag F3, report only, no parameter
    changes); Steps 3 to 24, the visual transformation Runs 1
    to 22 in STRATEGY.md order, keeping their Run numbers in
    every log entry; Step 25, the judge's authored lore bound
    to visible progression (content only, scope ruled at (c)
    below; it now binds to both the Cycle 22 progression
    surfaces and the visual transformation's plaques and map);
    Step 26, the judge's legibility fixes (presentation only:
    the blockade map answer, the damaged chip's non colour
    cue, the production panel's surplus sentence, each with a
    check and a mutant); Step 27, verification, close, and
    milestone review, printing the outcome table the judge's
    process note requires. The judge's own Step 0 assignments
    land here instead of at items 26 and 27 as first written:
    item 26 was already taken by the visual rulings, so the
    deflake method is ruled at (b) and the lore scope at (c)
    of this item. Binding constraints carried whole from both
    parents: no new system and no saveVersion change anywhere
    in Cycle 23; no numeric event effects; the 15 equipment
    per point reinforce price, blockade parameters, and AI
    weights unchanged; stackPower sha256 must remain
    5c6822d3eb6cd9d8ecaf8e5c5056b759923f4fdbc708de4911cd863ce1d4772c
    (verified at HEAD at this step under the Step 5 extraction
    method, and identical at the Cycle 22 start commit); the
    visual cycle's standing guard that the simulation source
    tree stays byte identical through its runs.

    (b) The deflake method, ruled before Step 1 code. One
    shared browser helper in tools (a single module every
    browser check requires) owns all waiting: it pauses the
    sim, waits deterministically on a named condition with a
    bounded timeout that fails loudly, and dismisses or awaits
    the event overlay before any click. No check file keeps a
    wait of its own: no fixed waitForTimeout after a click, no
    local sleep helper, no unbounded loop. The single
    sanctioned survivor is the poll interval inside the shared
    helper's own bounded condition wait, which is the helper's
    engine, not a wait on a hope. The Step 0 sleep audit,
    counted this run and recorded in CYCLE_LOG as Step 1's
    exit target: waitForTimeout appears 52 times in 12 files
    (save-hardening 11, reinforce 8, save 5, order-marker 5,
    cancel 4, lore 4, battle-why 3, growth-view 3,
    map-progression 3, progression 3, end-screen 2, fort 1);
    local sleep helpers add 21 awaited sleep calls in 4 more
    files (first-touch 8, core-loop 6, battle-systems 5,
    browser 2); 6 checks carry no sleep based wait at all
    (blockade, drone-ew, efficiency, intel, manpower, navy).
    Step 1 migrates reinforce-check and fort-check first, then
    every other file named here, and closes only on the
    judge's consecutive run proofs.

    (c) The lore step scope (Step 25), ruled. Authored content
    only: at least 6 authored events, at least 2 per nation
    identity already in js/lore.js; each event reads exactly
    one existing field from this list and names it in a
    comment: factory level, rail built state, history
    snapshots, war log entries, unit strength against
    maxStrength. Zero numeric effect, so stripped balance
    stays byte identical. Required bindings, from the judge:
    a first factory reaching level 3; a first built rail line
    completing; a unit falling below half of maxStrength and
    later recovering; a history snapshot showing territory
    growth across a year boundary. Fired event state rides
    the two record families that already exist and are
    already saved under saveVersion 3, verified in code this
    run: once each events record in state.beats and recurring
    events append to state.textures, both carried in the save
    payload by js/save.js (its record families list names
    beats and textures), so no new saved structure is created
    and saveVersion stays 3. The F4 coverage assertion
    enumerates every new event by name, and a mutant disabling
    each new event fails by name.

    (d) What Step 0 does not rule. No visual run's design
    question is settled here beyond item 26; Run level taste
    inside the visual cycle is ruled at its own run under the
    autopilot order. The blockade next action stays item
    25(b) Option A, leave as is, until Step 2's reachability
    evidence either proves it or reopens it. No tuning of any
    kind is ruled or made in Cycle 23.

## Item 28: Cycle 23 reordered, visuals first (Jash's order, 2026-10-19)

On 2026-10-19 Jash asked why the game has shown no leap in how it looks, was told plainly that the strategy's order spends its first half on invisible work (plaques, geometry, benchmarks, gates) with the decoration last, and chose the offered option in his own words: "Reorder the plan: visuals first, starting now."

The reorder, effective the moment Step 6b (canvas integration, in flight when the order landed) commits:

- Step 7: ownership bands and the front line on the live canvas (former Run 5).
- Step 8: fog in its three states on the live canvas (former Run 6).
- Step 9: the proven plaque system wired onto the live board as the unit display.
- Step 10: attack beats inside the tick on the live board; checkpoint 1 demonstration (former Run 8).
- Step 11: atmosphere on the live board: lamp glow, vignette, embers, and the palette harness (former Run 7).
- Step 12: master sheet and the TX01 texture bake-off (former Run 9).
- Step 13: terrain and sea textures into the base layer (former Run 10).
- Step 14: fog and panel textures, decals (former Run 11).
- Step 15: UI frames and the interim title (former Run 12).
- Steps 16 to 20: Blender rig lock, silhouette blockouts, infantry, drone, and flotilla batches (former Runs 13 to 17).
- Step 21: smoke and sprite beats (former Run 18).
- Step 22: team color tuning pass; checkpoint 2 demonstration (former Run 19).
- Step 23: conditional richness (former Run 20).
- Step 24: final title and end frames (former Run 21).
- Step 25: release candidate; checkpoint 3 demonstration (former Run 22).
- Steps 26 to 28: lore, legibility, and close (former Steps 25 to 27).

Two standing rules ride with the reorder. First, sequence changed, standards did not: every gate, value band, and pass criterion in STRATEGY.md still binds, and the worst-case admission protocol still gates the release candidate and sprite admission; a step may arrive earlier, it may not arrive weaker. Second, from Step 7 on, every step must produce a change Jash can see in a screenshot of the live board, or its CYCLE_LOG entry must name the visible step it serves and why it cannot be visible itself; an invisible step with no named visible dependent is not a step under this order.

Addendum to item 28, same morning, Jash's own words: "give visual work to claude design"; "As a strategy, plan, and process, we will tell ChatGPT image models to create the best renderings according to its image generation model. We will then copy the rendition and remake it into a Blender component to give it a more hyperrealistic approach"; "creating a way for us to have a strategy, especially to do a visual storyboard, mood board, vision board, whatever."

Adopted process for visual components: Claude (Opus, the design authority behind VISION_BOARD.md and STRATEGY.md) owns visual design and is commissioned to produce the visual storyboard strategy for the reordered cycle. Asset production for components runs: (1) ChatGPT image models generate the best rendition of each storyboarded component or scene, conditioned on the adopted master; (2) the rendition is copied and remade as a Blender component (Colab lane, pinned rig) for the hyperreal finish; (3) the loop wires finished components in at their reordered steps. Binding limits carried from RESEARCH.md and STRATEGY.md, which this process does not repeal: the live map stays canvas drawn from sim data (a rendition never becomes the map), plaques and state layers stay code drawn, sprites still pass the grayscale silhouette gate at final size before admission, and every rendition derives from the one master, never from a sibling rendition.

## Item 29: Proposal P1 adopted, the Figures band (Jash's ruling, 2026-10-19)

VISUAL_STRATEGY.md section 7.8 proposed adding a sixth value band, Figures 50 to 210, measured on sprite pixels after tint, to cover the units and structures the original five bands never named. Claude marked it as needing Jash's ruling because it amends the band table; the working gate A6 (median 60 to 150, maximum 210) was enforced meanwhile. On 2026-10-19 Jash adopted it in his own words: "Adopt the Figures band."

In force from this item: the band table in STRATEGY.md carries the Figures row (50 to 210); the Step 11 palette harness reports the Figures column alongside the other bands; no asset is affected unless it already fails gate A6. VISUAL_STRATEGY.md is adopted as the design document for the reordered Cycle 23 steps, alongside VISION_BOARD.md, RESEARCH.md, and STRATEGY.md. Its section 3.8 rendition session procedure runs through the browser lane on Jash's ChatGPT account under his standing subscription permission, following the staged brief files verbatim (no rewording, no re-rolls, the daily cap logged when hit), not by Jash in person.

## Item 30: Builder policy, Opus 5.5 builds, free models demoted (Jash's order, 2026-10-19)

Jash's words: "I would highly suggest that you start using Claude Opus 5.5 rather than using the free models because they are giving pretty shitty results right now. Or just use Astra, Opus, or anything that is actually pretty good. Use the free models for stuff that is not really innovative."

Adopted the same morning into the ashes-game-build-loop job body, read back and verified: the builder for innovative and player facing steps is Claude Opus 5.5 through the local Claude Code CLI (verified invocation: brief on stdin, --allowedTools=Write,Edit,Bash,Read; the skip-permissions flag is refused under root and is not used). The free OpenCode rotation builds mechanical steps only (bulk renames and format migrations, bookkeeping generation, pattern-copy test scaffolding), and every CYCLE_LOG step entry names the builder and its class, with a one line justification for any free built step. A failed Opus build is never silently downgraded to a free model. Astra and PC Claude remain reachable through the IRIS lane for work that needs the PC; they are not a build route from this VM.

## Item 31: The map must be a proper map (Jash's direction, 2026-10-19)

Jash rejected the canvas board outright, in his words: "this is not a map. This is so weird this looks so bad visually, it's horrible. What are you even trying to create? Proper map with proper type topography with latitude/longitude hills rivers, oceans, continents." He is right: the jittered lattice with ownership bands reads as a diagram, not a place.

Direction in force from this item: the board is redesigned as a geographic map: one continuous continent with a real coastline, a surrounding ocean, rivers drawn as rivers from the sim's own river segments, deterministic decorative relief (hills and shading, stable per province), and a latitude and longitude graticule. Claude designed it as MAP_TREATMENT.md (commissioned the same morning, produced through the local Claude CLI after the API route's repeated 1 byte failures), and that document is adopted as the governing map design. What survives from the earlier rulings: adjacency, river, and coast truth come from the sim only; relief is presentation and never a game rule; the information layers (ownership bands or their restyled successor, the three fog states, plaques) and every readability gate still bind, and where a look fights a gate, the gate wins. Step 7c's two fixes remain valid and proceed. The treatment's section 8 sequence amends the item 28 order for the map steps (chart and sea, rivers, relief, borders and names, graticule, fog on the chart with a map review); the plaques work landed ahead of it counts as the treatment's Step 15 content, done early.

## Item 32: Step 14 map review, three verdicts awaiting Jash (presented 2026-10-19)

The MAP_TREATMENT Step 14 map review package is built and committed at art-direction/storyboard/step-14 (frames F02, F04, F06, their gray copies, a contact sheet, and a README with the band numbers). Three verdicts sit with Jash. None is settled by the loop, because the governing documents name Jash himself as the decider for each: the RX trigger is defined as Jash's verdict, and P-MT1 is a marked proposal awaiting his ruling. Nothing builds on silence: the shipped values below stay in force until he rules.

1. Relief verdict (MAP_TREATMENT 7.5, RX trigger 1): if Jash's verdict on the F02 and F04 frames is that the hills look flat, computer drawn, or fake, the RX01 and RX02 Blender micro relief tiles fire at Step 19. Until he rules, code relief as shipped (RES 16) stays.
2. Fog scope for tile chips: in F02 the DOM tile chips (province names, Steel counts, Coast tags) print over Unknown provinces, while the canvas fog and the gated inspector hide military fact. Step 14's spec did not cover the chip layer. Jash rules whether Unknown should hide the chips too; until he rules, the chips stay as shipped.
3. P-MT1 (from Step 12c): the ownership wash stays at FILL_ALPHA 0.06 until Jash rules on the 0.14 captures in art-direction/storyboard/step-12c.

Also recorded in the package README: the MAP-TGT side by side the treatment names for this review cannot be produced yet, because MAP-TGT (the R0 rendition) does not exist in this repo and R0 remains queued through the browser lane. The review compares the board against the treatment's acceptance sentences and band numbers instead, and the drift check becomes a small follow-up when R0 lands.

## Item 33: Step 16 checkpoint 1 package, and the zoom pan gap (presented 2026-10-19)

The MAP_TREATMENT Step 16 checkpoint 1 package is built and committed at art-direction/storyboard/step-16 (F05 beat 0, 1, and 2 close-ups at zoom 2, gray copies, a contact sheet, and a README judging the acceptance sentence on the close-up). Two verdicts sit with Jash. Neither is settled by the loop: checkpoint 1 is the owner's checkpoint in the governing sequence, and the pan question changes the build sequence itself. Nothing builds on silence; the shipped game and the Step 17 sequence stay in force until he rules.

1. Checkpoint 1 verdict (old VISUAL_STRATEGY Step 10): do the F05 frames read the way the bible wants a fight to read (who attacked whom, across which border, what the result was, inside one 900 ms beat)? The loop's own reading, recorded in the package README, is that the sentence holds: in beat 1 the state light lies only on the attacked edge (Torford to Kharmund, across the river), and the plaques carry the result (the Vessari attacker destroyed, the Khessite defender at 1x2).
2. Zoom pan gap (found by Step 16b's captures): at zoom above 1 the map viewport clips the board and the game offers no pan or scroll control, so a player at 200 percent cannot bring the eastern half of the board into view. Zoom 1 is unaffected. Jash rules whether a pan step joins the sequence ahead of Step 17 (atmosphere and palette harness), or the gap waits for a later cycle. Until he rules, Step 17 proceeds as sequenced.

## Item 34: Item 33 verdicts ruled by Claude (2026-10-19, autopilot order)

Item 33 presented two verdicts and recorded that neither would be settled by the loop. That park is superseded by Jash's 2026-10-18 autopilot order, under which loop decisions and taste calls are settled by Claude and recorded as rulings. On 2026-10-19 the build loop consulted Claude Opus 5.5 (anthropic.py route, model claude-opus-5-5, usage in=674 out=605) with the checkpoint facts and the pan options, and adopts its picks:

1. Checkpoint 1 verdict: PASS. The F05 frames show each element of the acceptance sentence within one 900 ms beat: the gold light marks only the attacked river edge (Torford to Kharmund), and the plaques show the Vessari attacker destroyed and the Khessite defender at 1x2. The consulting Claude noted this ruling rests on the loop's reading of the frames; if a reviewer viewing them finds the plaques illegible at zoom 2, that would reopen it. Ruled by Claude under Jash's 2026-10-18 autopilot order.
2. Zoom pan gap: Option B. Step 17 proceeds as sequenced, and a pan step lands right after Step 17, before Step 18. Reasoning adopted: zoom 1 is the default full view and the game is pre-release and single player, so the clipping blocks no current path; but a zoom level that cannot reach half the board is a real defect, so the pan step must not slip to a later cycle. Ruled by Claude under Jash's 2026-10-18 autopilot order.

## Item 35: Furniture paper inside the vignette corners (ruled 2026-10-19, autopilot order)

Step 17a homed one question here: the vignette is drawn before the chart furniture, so degree bar segments and the north arrow's paper half inside the corners stay at full FRAME_PAPER luma 216.45 while the frame paper beside them darkens to about 208 to 212 (the Step 17b harness measured the whole base plus fog composite maximum at 216.4 on both real boards). On 2026-10-19 the build loop consulted Claude Opus 5.5 (anthropic.py route, model claude-opus-5-5, usage in=606 out=368) with those measured facts and two options, and adopts its pick:

1. Furniture vignette: Option A. Keep the furniture crisp and close the question. Reasoning adopted: legibility is law, and applying the vignette to the furniture would trade away label contrast exactly where the degree frame anchors; the brightness gap is at most about 8 luma levels, inside the vignette's own cap, confined to small furniture patches in the extreme corners, with no pixel near the 225 ceiling; a brighter cartouche on aged margin paper reads as printed furniture laid over the sheet, not as a defect. No 17c fix is homed. Ruled by Claude under Jash's 2026-10-18 autopilot order.
