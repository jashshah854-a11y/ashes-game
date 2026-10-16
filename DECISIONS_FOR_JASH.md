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
   committed harness (tools/balance.js) and re-verified at reconciliation
   step 5: a commander who never acts falls on day 36 on all 8 standard
   seeds, inside the judge's 30 to 45 band; the scripted sensible player
   (which builds factories toward line 3) captures the enemy capital 8 of
   8 on day 25, with end strength 140.3 to 225.0 percent of the starting
   72; a reckless player who abandons the capital lane loses 8 of 8, on
   day 37. The day 25 capture is much faster than Cycle 5's days 43 to 52;
   simultaneous battles and the rebuilt script both feed that, and the
   bands, not the exact day, are the ruling. Questions: does day 36 feel
   right to you for a do-nothing commander, and does a day 25 win for
   sensible play feel right, or do you want the skeleton gentler while
   you learn it?

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
   does not stall waiting for approval. Steps 2 (codex panel and event
   card UI), 3 (tests and balance), and 4 (judge) remain. The assessed
   branch item that was pending before step 2, the branch's Cycle 6
   judge flag 1 fix (defenders drawn for every targeted province before
   any battle forms), is now ported and verified (see CYCLE_LOG and
   item 8). The remaining assessed branch item, judge flag 4 (the enemy
   card showing the Dominion's factory levels and open lines), is a
   candidate to ride with step 2's UI work.

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

Nothing here blocks the loop. Cycle 6 is complete, the first 6
reconciliation slices are decided, the branch judge flag 1 fix is
ported, and Cycle 7 (the lore seed) step 1 is built; the lore above is
loop written and open for your rewrite or veto, and the cycle runs
without waiting on any item above.
