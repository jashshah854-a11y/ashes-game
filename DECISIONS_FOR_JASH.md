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

1. Calibration feel. Current numbers on master, measured with the
   committed harness (tools/balance.js) and re-verified at Cycle 9
   step 1: a commander who never acts falls on day 36 on all 8 standard
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
   step 2 (the panel shows efficiency and its live effect) is
   next. No new taste item was created by step 0 or step 1; step 0
   was a prescribed defect fix and step 1's numbers are loop
   tuning under the judge's prescription. The assessed branch items that were pending before
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
   Spine" also never fired in 200 passive campaigns the loop ran. Separately, three passages in the lore imply edges
   the game does not give anyone: Khessograd's walls against
   Vesskar's walls that are "not much", the Dominion's old and
   enormous foundries, and Vessari steel that is "never enough",
   while in the game both nations start with identical steel,
   equipment, and research. And the two capital entries describe
   only the capital fall ending; neither mentions that a campaign
   also ends on day 150 with a survival victory if your capital
   still stands. Your call, in your own time: should the game grow
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
Line Efficiency Ramps) is in progress: step 0 closed that judge
flag, step 1 (the efficiency sim) is built, and step 2 (efficiency
on screen) is next,
and the work runs without waiting on any item above.
