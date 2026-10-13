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
- Passages the Cycle 7 judge flagged because they imply edges the game
  does not have: see item 12.

1. Calibration feel. Measured with the committed harness after Cycle 6
   (and your lines first call): a commander who never acts falls on day
   36 on every standard seed; a reckless one loses every time; sensible
   play that builds factories toward more lines wins every seed tried
   (200 of 200), median day 34, often ending with about twice its starting
   strength. Sensible play that never builds a factory still wins most
   seeds (193 of 200) but can lose a long war to a Dominion running 4
   lines. Correction from the Cycle 6 judge: the factory path is not a
   faster win. It wins later than the no factory script on most seeds
   (median day 34 against 22) and wins more surely (200 of 200 against
   193), because it trades rail for production (see item 8). Questions:
   does day 36 feel right for a do-nothing commander, and does building
   up feel like it pays off enough, or too surely?

2. Next build. Cycle 6, "Close the loop, fix the clock", passed two
   independent judges, both with fix-now flags, now closed (see
   CYCLE_LOG): factories gate production line count with locked slots
   shown with their unlock condition, battles resolve simultaneously from
   a snapshot taken at the start of the movement phase, and production
   lines are paid before factories. Cycle 7, the lore seed, is done too:
   both nations' histories, a codex panel, and 3 event cards, loop written
   under the lore rule and flagged at the top of this file for your
   rewrite or veto. Cycle 8 is fortifications paid in equipment, so that
   equipment finally buys something besides factories (item 11). The loop
   follows the judge unless you say otherwise.

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

7. Locked production lines (Cycle 6, judge ruled). Factories now gate how
   many production lines a nation can run: line 3 opens at 16 total
   factory levels, line 4 at 24, and an opened line stays open. The panel
   shows each locked slot with its condition, for example "Line 3 locked.
   Build 9 more factory levels anywhere to unlock it (needs 16 total
   factory levels, you have 7)." The thresholds are loop tuning, but
   whether a locked slot feels good or frustrating, and whether unlocks
   should stay permanent when factories are lost, is taste. Flag it when
   you play if it feels wrong. Decided by you on 2026-10-13: production
   lines are paid before factories each day, so building for more lines
   pays off instead of starving every line.

8. Rail against factories. When you chose "lines first" the rail cost was
   not in front of you. With lines paid first, factories eat every steel
   the lines leave and cannot be paused, so a player who builds toward
   more lines almost never saves the 15 steel a rail edge costs: 0 to 7
   rail edges per campaign and 8 to 43 days at empty steel, against 12 to
   39 edges and no dry days for a player who skips factories. It still
   wins every seed. Remeasured after fortifications (Cycle 8): unchanged,
   0 to 7 rail edges per campaign on the factory paths, 21 to 83 days at
   empty steel. Options: leave it (factories and rail are a real
   trade), pay rail before factories, let the player pause factories, or
   let the player set a steel reserve that factories cannot touch.

9. Defending against an attack. A stack whose province is attacked on the
   same day stays home and fights, and its own order is cancelled; the
   unit card now says so. The alternative is that it carries out its own
   attack and gives the ground up. The first is the rule today.

10. Both capitals fall on the same day. Today the Dominion wins, by
    province order, not by design (it has never happened in a test run).
    Draw, loss, or win?

11. What equipment buys. Since Cycle 8 it buys factories and
    fortifications (100 equipment per level, up to level 2, +25 percent
    defense per level). A player who fortifies no longer piles it up.
    Questions: do capitals start with walls (today no city does, so the
    Dominion has to build Khessograd's walls during the war)? And should
    the Dominion fortify more than its capital and its river province?

12. Lore against a symmetric game. The lore says the Vessari invent and
    the Khessites out-build and out-wall them, but the game is symmetric:
    equal starting armies, equal research, symmetric steel and factories,
    and no walls yet. Three passages imply edges the game does not have
    (Khessograd "foundries inside walls inside more walls" against
    Vesskar's "walls are not much"; the Khessite foundries "old and
    enormous"; Vessari steel "never enough"), and the Vessari card for
    Drone Gen 2 can never fire, because a player can at best tie the
    Dominion's research. Make the game asymmetric to match (for example a
    Vessari research edge, or Khessograd walls once fortifications exist),
    or make the text symmetric?

13. Event cards pause the war. Every card hard-pauses until you press
    Continue; two land on the same day in about 16 percent of games. Keep
    the hard pause, or show cards without pausing?

14. Cards with choices. Today every card is history with no effect. Should
    a later card offer a choice with a real effect, the way EU5 events do,
    and from which cycle?

Nothing here blocks the loop. Cycle 7 is complete; Cycle 8
(fortifications paid in equipment) is next and runs without waiting on
any item above.
