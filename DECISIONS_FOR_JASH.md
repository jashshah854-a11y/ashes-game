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
