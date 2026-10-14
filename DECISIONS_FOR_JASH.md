# Decisions parked for Jash

Taste calls the loop will not make for you. Each one is blocking something
specific; everything else keeps moving.

## Start here: the five calls that unblock the most (Cycle 14 brief)

Three systems are built and working but change little in play until you
rule: jamming, recon, and the drone balance. They are tied together, so
the order below matters. Every number is measured over 200 seeds with the
committed harness (`node tools/balance.js --seeds 1-200`).

1. Item 20, should an all drone army be the fastest way to win? Today an
   all drone script wins at median day 38, mixed production at day 52.
   Options measured: leave it (drones lead by 14 days); drone attack
   2 / 3 / 4 by generation (drones lead by 9; every ruling still passes;
   the smallest safe step); 2 / 4 / 6 or infantry attack 5 or fragile
   drones (each breaks a ruling). Cheaper jamming or a reactive Dominion
   do not close it. If drones should not lead, say so and the loop lands
   2 / 3 / 4 as one measured slice.
2. Item 27, should the Dominion fly recon and act on it? This is the one
   that makes fog, recon, and jamming matter. Today no decision on either
   side reads beyond its neighbours, so fog changes what you see, not the
   war: a script that acts on recon gains nothing on net against the same
   script with the rule off. A yes means the loop designs a Dominion that
   scouts before it attacks, measured against the rulings.
3. Item 24, how should the drone and jamming race pace? Jamming never
   reaches a drone in intended play (both sides field Gen 2 on day 21,
   before Jamming Gen 1 on day 38, and Gen 3 on day 78, before Jamming
   Gen 2 on day 111). Options: cheaper jamming, Jamming Gen 2 before Gen
   3 in the Dominion's order, or dearer drone generations. Every clock
   change measured so far moves a ruling (both jammings first loses
   rationed seed 108). It matters only after item 27 gives sight a use.
4. Item 25, should recon cost something? Today it is free and unlimited:
   one Gen 2 wing at the front lifts the fog three provinces deep every
   day. Only matters once item 27 makes sight count.
5. Item 15, the siege. Most wins end at a walled Khessograd (twelve units
   behind level 2 walls defend at 66; an attack needs 99). Should
   something break walls (drones, a siege unit), or is the siege the war?

Everything else below waits on you too, but nothing else stalls a system.
The loop keeps building around all of it; next is the navy, starting with
river crossings.

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

1. Calibration feel. Measured with the committed harness in Cycle 10
   (walls and capital air defense included, and the Dominion deciding
   everything on the same clock as you): a commander who never acts falls
   on day 30 on every standard seed, the very edge of the judge's 30 to 45
   band (it fell on day 36 before the Dominion's clock was made fair); a
   reckless one loses every time; sensible play that builds factories
   toward more lines wins every seed tried (200 of 200), median day 52,
   often ending with about three times its starting strength, and the
   same with walls at home wins every seed too (median day 50). Sensible
   play that never builds a factory wins 198 of 200, median day 43. Questions: does day 30 feel right for a do-nothing commander, and does
   building up feel like it pays off enough, or too surely?

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
   wins every seed. Remeasured after fortifications (Cycle 8) and the
   shared clock (Cycle 9): still 0 to 7 rail edges per campaign on the
   factory paths, and now 21 to 97 days at empty steel, because walls and
   a sharper Dominion make the wars longer. Options: leave it (factories and rail are a real
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
    and walls (since Cycle 8) that either side may build on the same
    terms, with no city walled at the start. Three passages imply edges
    the game does not have
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

15. The siege. Most winning wars now end at a walled Khessograd: twelve
    units behind level 2 walls defend at 66, and an attack needs 99 to
    clear the Dominion's own 1.5x rule. Is that the war you want, or
    should something break walls (drones, a siege unit)?

16. Walls on capture. Today a captured fortification loses one level.
    Should it be razed entirely instead, and should you be able to slight
    your own walls before you retreat?

17. Seeing the enemy's walls. The enemy card shows the Dominion's exact
    walls today. Fog of war exists since Cycle 12 and treats walls and
    air defense as public structures, so you still see them deep in the
    fog. Should they become something you only see with recon?

18. The Dominion's rail priority on screen. Since Cycle 9 the Dominion
    lays rail on its Spine first. Its doctrine text says only "Starve its
    rail and it stalls." Should it also say "It lays its Spine first",
    which tells you exactly where to cut?

19. Interception and the steel exchange (Cycle 10). Built with working
    answers, each a CFG number or one line to change:
    - Name: the header and card say "Steel bled" and "Steel exchange".
      Keep, or call it something else?
    - Does it score the campaign? Today it only informs, and says so; the
      war is still won by taking the capital.
    - How expensive should a launch feel? Today 20 steel against a 15
      steel drone wing, stripping 4 of its 6 strength. The defender wins
      the fight and loses the steel exchange.
    - A hold fire toggle, so a player can save steel and let wings through?
      Not built; air defense always fires while steel lasts.
    - Drones striking rail or factories? Not built; drones fight only in
      battles.
    - Air defense on capture: today it is lost with the province. Keep it,
      or let the captor take it over?
    - Where the Dominion builds it: today its capital only. On its river
      Spine province too measured as a loss on one seed in 200 for the
      rationed script; that is a balance question the builder will measure
      again, but whether the Dominion should defend its front this way is
      a feel question.

20. Should an all drone army be the fastest way to win? Today a script
    that builds only drone wings wins every seed tried, median day 38,
    against day 52 for the same script building both. Cycle 11 added
    jamming, but jamming alone cannot close it: per steel a Gen 2 drone
    wing has 2.5 times infantry's attack, 1.5 times its defense, and the
    same strength, and it arrives on day 20, long before any jamming that
    reaches it. Measured over 200 seeds (drone median against mixed
    median, the target being 5 days or less):
    - Today (drone attack 3 / 5 / 7 by generation): 38 against 52.
    - A Dominion that researches jamming first when your army is mostly
      drones: 32 against 41 (it delays its own Gen 2 and gets weaker).
    - Cheaper jamming (30 and 60 points): 38 against 52; with the
      reactive rule, 32 against 49, or 37 against 62 at 30 and 40.
    - Infantry attack 5: 38 against 52, and it breaks the rulings (rationed
      wins 188 of 200, the reckless direct script wins 1).
    - Drone attack 2 / 3 / 4: 49 against 58, rulings pass. Attack 2 / 4 / 6:
      49 against 58, rulings break (rationed 198 of 200). Attack 2 / 3 / 4
      with defense 1 / 2 / 3: 43 against 52, rulings break (rationed 199,
      reckless direct wins 9). Gen 2 and Gen 3 adding attack only (2 / 3 / 4,
      defense 2 / 2 / 3): 44 against 57, rulings not measured.
    - Rulings for the other rows: today and cheaper jamming pass; the
      reactive rule rows were measured on two profiles only. The Cycle 11
      judge also found drone attack 2 / 3 / 4 with slower or dearer drones
      breaks the rulings.
    - Massing by strength instead of unit count (a harness change, to
      test whether cheap fast units only win by count): drones 22 against
      50, so the edge is real power, not a counting artifact.
    None reaches 5 days without reshaping the whole game. The builder has
    not changed the drone numbers: whether drones are meant to be the
    strongest unit is yours. If they should not lead, drone attack 2 / 3 / 4
    is the smallest measured step (9 days instead of 14).

21. Should the attack preview say how many interceptors the Dominion can
    pay for? It does today, which tells you roughly how much steel it
    holds, something nothing else shows, even under the fog of war that
    Cycle 12 added (the target is always a seen neighbour).

22. Should the Dominion read your army and adapt its research? Today it
    never changes its order, and that predictability is what lets you plan
    around it.

23. Should interceptor steel be held back ahead of that day's factories
    and rail, or should air defense take only what is left? Today it is
    held back at the attacker's decision, which also means the Dominion
    decides its factories and rail on the steel left after the hold.

24. The jamming clock. Jamming never reaches the other side's wings in
    combat or blinds its recon in intended play, because both sides
    research on one clock and Drone Gen 2 lands on day 21, before any
    jamming that reaches it (Jamming Gen 1 on day 38 reaches only Gen 1),
    and Drone Gen 3 on day 78, before Jamming Gen 2 (day 111). Measured in
    Cycle 12: 9,232 recon flights over 200 seeds, none blinded; the Cycle
    11 judge counted 0 jammed wings in 44,339 drone fights. Making it bite
    means changing that clock (cheaper jamming, Jamming Gen 2 before Drone
    Gen 3 in the Dominion's order, or dearer drone generations), and every
    such change moves the rulings: researching both jammings before Gen 3
    loses rationed seed 108. How the drone and jamming race should pace is
    yours; it ties to items 20 and 22. One more fact from the Cycle 12
    judge: under a research order where blinding does happen (4,331 of
    15,323 recon flights blinded over 200 seeds) no result changed,
    because nothing yet acts on what recon sees (item 27). Changing the
    clock alone will not make jamming matter. Cycle 13 measured a script
    that does act on recon (it holds when it sees a counterattack waiting
    behind its target). Against its control, the same recon with the hold
    off, acting on sight gains nothing on net (the same win days; 7
    campaigns faster, 49 slower). With both sides researching jamming
    first, 3,889 of 10,409 of its flights were blinded and switching
    blinding off moved only its best end strength. So sight matters only
    once a real decision in the game reads it, which is item 27.

25. Should recon cost something (steel, the wing's defense that day, or
    a cooldown)? Today any drone wing can fly every day for free, so one
    Gen 2 wing at the front lifts the fog three provinces deep every day.

26. Should the war log show the Dominion's production at all? Since
    Cycle 13 it hides production lines from provinces you cannot see;
    the Dominion's capital is one of those unless your front is next to
    it or your recon lights it.

27. Should the Dominion fly recon and act on what it sees? Today it sees
    only its neighbours and flies none; no decision on either side reads
    beyond its neighbours, so fog changes what you see, not the war.

28. Should the steel exchange count only what you can see? Today it
    counts every Dominion loss, attrition deep in the fog included, so
    its Dominion total tells you how much of its army is starving behind
    the front, which nothing else shows.

29. Should one click order the whole stack? Today a click orders only
    the selected unit, and an attack with a stack means ordering each
    unit (the preview says so, and counts only the units free to join).
    The Dominion decides per group, so a stack command would also match
    how it thinks.

30. Should the Dominion build river flotillas? The command exists for both
    sides, but the Dominion's rule is off: on (at 450 equipment), it cost
    the rationed script seeds 89 and 108 over 200; at 800 equipment, or
    with the rationed script building its own flotilla too, it still lost
    seed 108, the seesaw seed that tips on every Dominion gain. Leaving it
    off keeps a tool only you use.

Nothing here blocks the loop. Cycles 9 to 12 passed their judges (10, 11,
and 12 with conditions, each closed in the next cycle's step 0); nothing
waits on any item above.
