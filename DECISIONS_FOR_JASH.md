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
   identical to tools/baseline-cycle9.txt. Steps 2 (UI), 3
   (tests and balance), and 4 (judge) remain. Its judge parked
   four taste questions with you, undecided by
   the prescription: whether manpower should also gate factory
   or fortification construction crews, whether the pool should
   have a cap that wastes overflow intake, the flavor name of
   the intake beyond the plain word manpower, and whether a
   future cycle may spend manpower on partial unit
   reinforcement; none of them blocks the remaining steps.
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
is done, and steps 2 (UI), 3 (tests and balance), and 4
(judge) remain; the work runs without waiting on any item
above.
