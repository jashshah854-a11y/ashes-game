// Ashes of Empires, lore.
// The world as it was before the player pressed start: the history of
// both nations, their capitals, the river between them, and the text of
// the event cards that mark turning points in a campaign. Pure data. No
// rule in the game reads it; the sim records when a turning point
// happens (state.beats in js/sim.js) and the UI looks the text up here.
// Loadable in the browser (window.AshesLore) and in node (module.exports),
// like js/sim.js, so the tests can check it against the sim's own names.
//
// Written by the build loop in Cycle 7 under the lore rule: every word
// here is open for Jash's rewrite or veto (DECISIONS_FOR_JASH.md).
// Lore states only facts the game really has: two capitals at the ends
// of the capital row, the rail spine between them cut at the river, the
// river frontier from the north sea to the south sea, captured rail that
// must be converted before it feeds an army, steel, factories, drones,
// and the Dominion doctrine printed in its panel. It never names the
// other provinces, whose names change with every seed.
(function (global) {
  'use strict';

  var LORE = {
    codexOrder: ['ashwater', 'player', 'enemy', 'vesskar', 'khessograd'],

    entries: {
      ashwater: {
        title: 'The Ashwater and the Spine',
        kind: 'History',
        text: [
          'Before the Partition there was one empire and one river through the middle of it. The Ashwater runs from the northern sea to the southern sea, and for three centuries the Ashen Empire crossed it on a single great line: the Spine, the imperial railway that ran from the customs city of Vesskar to the arsenal of Khessograd, carrying the taxes of the west to the east and the soldiers of the east to the west.',
          'The empire ended in a winter. The last emperor, short of money and patience, sent the eastern army over the Ashwater to collect the western cities\' arrears by force, a few regiments at a time. The cities had stopped paying and started arming. Regiment after regiment was caught on the crossings and destroyed. By spring the emperor was dead, the treasury was in Khessograd, the guild councils were in Vesskar, and the Spine was cut at the river.',
          'The Treaty of the Ashwater, signed on a barge in midstream because neither side would set foot on the other bank, drew the frontier along the water and settled nothing else. Within a year the Compact had relaid its track to a narrower gauge, so that no Khessite train could run into the west; the Dominion kept the imperial gauge, and since then no army has ridden the other side\'s rail. The bridges were left standing, because each side believed it would need them.',
          'For forty-one years the frontier has been quiet in the way a held breath is quiet. Now both banks are mobilizing again, and the Spine, still the only straight road between the two capitals, is where everyone expects the war to be decided.'
        ]
      },

      player: {
        title: 'The Vessari Compact',
        kind: 'Nation, west bank',
        text: [
          'The Compact was signed, not crowned. When the Ashen Empire broke along the Ashwater forty-one years ago, the western cities did not wait for a new emperor. Their guild councils met in the counting halls of Vesskar and wrote a charter that bound them to one army, one treasury, and one rail gauge, and to nothing else. Every city kept its own council. Every council sends a delegate to the Compact Assembly in Vesskar City, and the Assembly elects a First Delegate who commands in war and answers for it in peace.',
          'The Vessari are a people of ledgers and workshops. Their steel comes out of the western hills in small, stubborn seams, never enough and always argued over, and what they cannot dig they try to out-make. The drone wing was a Vessari invention, first built in a Vesskar workshop to survey flooded rail cuttings and later fitted with a charge by an engineer whose name the Assembly still will not print. The Compact holds, almost as a matter of faith, that a cheap machine which forces an expensive answer is a victory even when the machine is lost.',
          'They remember the Partition differently from their neighbors. To the Vessari it was a liberation. The old throne in the east had taxed the western cities for a century to feed its arsenals, and when the empire collapsed the cities simply stopped paying. The founding charter calls the Ashwater "the line where the debt ended." Vessari children are taught that the Khessites did not lose a war; they lost a customer.',
          'That memory has made the Compact proud and slow. The Assembly argues before it builds, and it builds before it marches. Its railways grew city by city on borrowed money, laid to the Compact gauge, a hand\'s width narrower than the imperial one. The narrow gauge was a deliberate choice in the Compact\'s first year: no Khessite train can run on Vessari track, and every line an army captures must be relaid before it feeds that army. The engineers call it the gauge war, and both sides have fought it ever since.',
          'Now the Dominion is mobilizing on the far bank, and the Assembly has done what it always does: voted, late, for factories. The Compact has never trusted in numbers. It intends to outbuild the Dominion, and it knows it has to start now.'
        ]
      },

      enemy: {
        title: 'The Khessite Dominion',
        kind: 'Nation, east bank',
        text: [
          'Khessograd was the empire\'s arsenal before it was anyone\'s capital. The Ashen Throne kept its foundries, its powder works, and its eastern army there, behind walls that have never been taken. When the empire broke, the arsenal did not break with it. The officers of the eastern army, the great Houses of the general staff, shut the gates, paid their soldiers out of the imperial treasury, and declared that the empire had not ended, only lost its west. That declaration is still law. The Khessite Dominion calls itself the lawful remnant of the Ashen Empire, and its ruler, the Dominar, is chosen for life by the Houses from among their own officers.',
          'The Dominion is a staff college that grew a country. Its provinces are governed by officers, its railways by the army, its schools by the war ministry. Its doctrine is written down and taught to every lieutenant, and its first article is the Reckoning: never attack without three against two. The Khessites lost the west, by their own account, because the last emperor fed his regiments into the Ashwater crossings a few at a time and watched them die there. The Houses swore it would never happen again. A Khessite army masses before it moves, it does not attack beyond the reach of its own rail, and it never leaves Khessograd without a garrison. Foreign observers call this caution. The Houses call it memory.',
          'To the Khessites, the Partition was a theft. The western cities were imperial cities, built with imperial money, and the Compact\'s charter is a ledger written by debtors who refused to pay. The Dominion has never recognized the Ashwater as a border. Its maps show a river inside the empire, and its rail is still laid to the full imperial gauge so that, in the words of a Dominar\'s decree, "the trains will be ready when the west comes home."',
          'Its foundries are old and enormous, built to arm an empire rather than a province. What the Dominion lacks is invention. Its drones began as Vessari designs, captured and copied, and its generals resent every one of them; a Khessite general wants divisions he can count.',
          'Forty-one years after the Partition, the Houses believe the Compact has grown soft and quarrelsome, its Assembly too busy voting to fight. The mobilization orders went out in the spring. The Dominion does not say it means to conquer the west. It says it means to take it back.'
        ]
      },

      vesskar: {
        title: 'Vesskar City',
        kind: 'Capital of the Vessari Compact',
        text: [
          'The Compact\'s capital and the western end of the Spine. Vesskar grew rich counting other people\'s goods as the empire\'s great customs city, and it has never quite stopped counting. The Compact Assembly meets in the old customs hall, under a ceiling painted with the tariffs of the empire it outlived.',
          'The city\'s factories are newer than its walls, and its walls are not much. If Vesskar City falls, the Compact falls with it: the charter names no other seat, and in forty-one years the Assembly has never agreed on a place to run to.'
        ]
      },

      khessograd: {
        title: 'Khessograd',
        kind: 'Capital of the Khessite Dominion',
        text: [
          'The old imperial arsenal, the seat of the Dominar, and the eastern end of the Spine. Khessograd is foundries inside walls inside more walls, and no army has ever taken it. By a decree older than the Dominar\'s title, three units of the army stand inside the city at all times and do not leave it, whatever happens at the front.',
          'The Houses say Khessograd cannot fall. The Compact\'s Assembly has noticed that every Khessite says so, and that none of them has ever had to find out. If Khessograd falls, the Dominion\'s claim to be the empire falls with it.'
        ]
      }
    },

    // Event cards, one per campaign beat recorded by the sim. Each has a
    // variant for the side that reached the beat first, or for both when
    // they reached it on the same day. One exception, Cycle 8 step 0:
    // droneGen2 ships only the enemy and both variants. Both nations
    // accrue research at the same flat rate and the Dominion researches
    // on the first tick it can afford it, so the player can at best tie
    // on day 21 and can never field Gen 2 alone first; a player variant
    // would be text no campaign could ever show.
    beats: {
      capitalRow: {
        title: 'Blood on the Spine',
        trigger: 'the first province on the capital row, the old Spine railway between the two capitals, changed hands',
        variants: {
          player: 'Vessari columns have taken ground on the Spine. In Vesskar City the Assembly has ordered the customs bells rung, as they were rung forty-one years ago, and the newspapers are already printing the miles to Khessograd. In Khessograd the Houses have said nothing in public. Their staff officers are redrawing the railhead.',
          enemy: 'Khessite columns have taken ground on the Spine. The Dominar\'s words are read aloud in every garrison: the first mile of the west has come home. In Vesskar City the Assembly is in emergency session, and for once the vote to build is unanimous.',
          both: 'Both armies have taken ground on the Spine on the same day, each crossing into the other\'s half of the old railway. The rival gauges meet in the mud. Neither capital\'s newspapers mention the other side\'s gains.'
        }
      },
      droneGen2: {
        title: 'The Second Generation',
        trigger: 'a nation fielded Drone Gen 2 for the first time',
        variants: {
          enemy: 'The foundries of Khessograd have fielded the second generation of drone wings, built on the Vessari first generation machines the Dominion captured and copied in the Partition years, and carried a step further to Khessite standards. The Houses dislike the machines and field them anyway. The staff college has added a chapter to the Reckoning on how to count them.',
          both: 'Both nations fielded the second generation of drone wings on the same day. Spies on each bank will spend the next month explaining to their own side how the other side managed it.'
        }
      },
      line3: {
        title: 'A Third Line',
        trigger: 'a nation opened its third production line',
        variants: {
          player: 'Factories across the Compact have reached the output the Assembly\'s war bonds were written against, and a third production line has opened. In the counting halls of Vesskar they call it the compounding: factories feed the lines, the lines feed the army, and the army, the Assembly hopes, will hold the factories.',
          enemy: 'The Dominion\'s foundries have opened a third production line. The order went out from the war ministry in a single sentence, as Khessite orders do. On the Ashwater, Vessari scouts have started counting the trains.',
          both: 'Both nations opened a third production line on the same day. The war is becoming a contest of factories, which is the one kind of war each side was sure it would win.'
        }
      }
    },

    // Printed on every event card, so a card never reads as a hidden rule.
    noEffect: 'This card is history, not a rule. It changes nothing in the game: no bonus, no penalty, no new order.'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LORE;
  } else {
    global.AshesLore = LORE;
  }
})(typeof window !== 'undefined' ? window : this);
