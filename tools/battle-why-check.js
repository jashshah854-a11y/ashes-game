'use strict';
// Real browser check for the battle why render (Cycle 18 step 2), in the
// tools/save-hardening-check.js and tools/end-screen-check.js pattern:
// headless Chromium through Playwright against the repo's own index.html.
// Opens file:// index.html?seed=1 at 1400 by 1000 and drives only the real
// buttons. Every game fact is read from the page DOM, the only readable
// surface, exactly as the player sees it.
//
// The check stages three saves in node with js/sim.js and js/save.js,
// replicating the stagings of the Cycle 18 step 1 tests exactly:
// A. seed 233, one player infantry at p4_3 and one enemy infantry at p5_3,
//    both interceptor stocks 0, order the player unit to p5_3, run
//    Sim.movementPhase. Its battle record has aRiverPenaltyPct 25.
// B. Same as A but attacker.supplyPenalty = 30 and the p5_3 fortLevel = 2
//    before the order, so the record has aSupplyPenaltyPct 30 and
//    bFortBonusPct 50.
// C. The surviving drone staging of the step 1 drone test: two player drone
//    wings at p4_3 (the second a copy with a fresh id from nextUnitId), one
//    enemy infantry at p5_3, enemy interceptors 1, both drones ordered to
//    p5_3, movementPhase. Its record has launches 1 and
//    aDroneEffectivenessPct 125.
//
// Serialize each staged state with Save.serializeSave and write the three
// texts to files under /tmp.
//
// In the browser: pause the game, then import each save in turn through the
// real file input (setInputFiles on #save-file-input, the pattern in
// tools/save-hardening-check.js), and after each import read the #log list
// items text.
//
// Assertions per scenario: the battle outcome item exists; its text contains
// the message and the full expected why, where the expected why is built in
// the check by a function replicating battleWhyText sentence for sentence but
// fed from the STAGED NODE STATE record (state.nations shorts in node are
// the same strings), never by reading the DOM helper; plus fact spot checks
// tying the render to the sim staging (A: the why contains '25 percent
// river crossing penalty' and both powers equal Sim.stackPower computed in
// node before movementPhase, exactly as the step 1 test computes expA and
// expB; B: contains '30 percent supply penalty' and '50 percent
// fortification bonus'; C: contains '1 interceptor launched', 'steel each',
// and '125 percent effectiveness').
//
// The interceptor launch line in scenario C carries no battle record: assert
// its list item contains NO 'Why:' text.
//
// Assert at least one non battle entry in a scenario renders with no
// 'Why:'.
//
// Vocabulary audit on every rendered why text: it must not contain 'player',
// 'enemy', 'aPower', 'bPower', 'battle', 'targetId', 'Pct', or an
// underscore. (Check the why span text only, not the message.)
//
// Count and print PASS and FAIL per assertion like the other checks, with a
// totals line.
//
// The check must be non vacuous by construction: against the pre step UI
// there is no battle-why span, so the why assertions fail. Do not weaken
// assertions to make it pass.
//
// Usage: node tools/battle-why-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const H = require('./browser-helper.js');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=1';

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

// ---------- Build the three staged saves in node ----------

// Scenario A: river crossing penalty
const sA = Sim.createGame(233);
const aId = Sim.provinceId(4, 3);
const bId = Sim.provinceId(5, 3);
sA.units = sA.units.filter(u =>
  (u.provinceId === aId && u.nation === 'player' && u.type === 'infantry') ||
  (u.provinceId === bId && u.nation === 'enemy' && u.type === 'infantry'));
sA.nations.player.interceptors = 0;
sA.nations.enemy.interceptors = 0;
const attackerA = sA.units.find(u => u.nation === 'player');
const defenderA = sA.units.find(u => u.nation === 'enemy');
const expAA = Sim.stackPower(sA, [attackerA], 'attack', { toId: bId });
const expBA = Sim.stackPower(sA, [defenderA], 'defense');
Sim.issueOrder(sA, attackerA.id, bId);
Sim.movementPhase(sA);
const saveTextA = Save.serializeSave(sA).text;
fs.writeFileSync('/tmp/battle-why-A.json', saveTextA);

// Scenario B: supply penalty and fortification
const sB = Sim.createGame(233);
sB.units = sB.units.filter(u =>
  (u.provinceId === aId && u.nation === 'player' && u.type === 'infantry') ||
  (u.provinceId === bId && u.nation === 'enemy' && u.type === 'infantry'));
sB.nations.player.interceptors = 0;
sB.nations.enemy.interceptors = 0;
const attackerB = sB.units.find(u => u.nation === 'player');
const defenderB = sB.units.find(u => u.nation === 'enemy');
attackerB.supplyPenalty = 30;
sB.provinces[bId].fortLevel = 2;
const expAB = Sim.stackPower(sB, [attackerB], 'attack', { toId: bId });
const expBB = Sim.stackPower(sB, [defenderB], 'defense');
Sim.issueOrder(sB, attackerB.id, bId);
Sim.movementPhase(sB);
const saveTextB = Save.serializeSave(sB).text;
fs.writeFileSync('/tmp/battle-why-B.json', saveTextB);

// Scenario C: surviving drone with interceptor launch
const sC = Sim.createGame(233);
const firstDrone = sC.units.find(u =>
  u.provinceId === aId && u.nation === 'player' && u.type === 'drone');
const secondDrone = Object.assign({}, firstDrone, { id: sC.nextUnitId++ });
sC.units = sC.units.filter(u =>
  (u.provinceId === aId && u.nation === 'player' && u.type === 'drone') ||
  (u.provinceId === bId && u.nation === 'enemy' && u.type === 'infantry'));
sC.units.push(secondDrone);
sC.nations.enemy.interceptors = 1;
const expEff = Sim.droneEffectiveness(sC, 'player');
Sim.issueOrder(sC, firstDrone.id, bId);
Sim.issueOrder(sC, secondDrone.id, bId);
Sim.movementPhase(sC);
const saveTextC = Save.serializeSave(sC).text;
fs.writeFileSync('/tmp/battle-why-C.json', saveTextC);

// ---------- Replicate battleWhyText logic in node for expected strings ----------

function expectedWhyFromRecord(b, nations) {
  if (!b) return '';
  if (!nations[b.aNation] || !nations[b.bNation]) return '';
  const aName = nations[b.aNation].short;
  const bName = nations[b.bNation].short;
  const sentences = [];

  if (b.kind === 'meeting') {
    sentences.push(aName + ' attack power ' + b.aPower + ' against ' + bName + ' attack power ' + b.bPower + '.');
  } else {
    sentences.push(aName + ' attack power ' + b.aPower + ' against ' + bName + ' defense power ' + b.bPower + '.');
  }

  if (b.aSupplyPenaltyPct > 0) sentences.push(aName + ' fought with a ' + b.aSupplyPenaltyPct + ' percent supply penalty.');
  if (b.bSupplyPenaltyPct > 0) sentences.push(bName + ' fought with a ' + b.bSupplyPenaltyPct + ' percent supply penalty.');
  if (b.aFortBonusPct > 0) sentences.push(aName + ' had a ' + b.aFortBonusPct + ' percent fortification bonus counted in its power.');
  if (b.bFortBonusPct > 0) sentences.push(bName + ' had a ' + b.bFortBonusPct + ' percent fortification bonus counted in its power.');
  if (b.aRiverPenaltyPct > 0) sentences.push(aName + ' had a ' + b.aRiverPenaltyPct + ' percent river crossing penalty counted in its power.');
  if (b.bRiverPenaltyPct > 0) sentences.push(bName + ' had a ' + b.bRiverPenaltyPct + ' percent river crossing penalty counted in its power.');

  if (b.aDroneEffectivenessPct != null) sentences.push(aName + ' drone wings fought at ' + b.aDroneEffectivenessPct + ' percent effectiveness.');
  if (b.bDroneEffectivenessPct != null) sentences.push(bName + ' drone wings fought at ' + b.bDroneEffectivenessPct + ' percent effectiveness.');

  if (b.launches > 0) {
    const launchWord = b.launches === 1 ? '1 interceptor launched' : b.launches + ' interceptors launched';
    const wingWord = b.launches === 1 ? 'attacking drone wing.' : 'attacking drone wings.';
    sentences.push(launchWord + ' before the rounds at ' + b.launchSteelEach + ' steel each, knocking down ' + b.launches + ' ' + wingWord);
  }

  const aUnitWord = b.aDestroyed === 1 ? ' unit' : ' units';
  const bUnitWord = b.bDestroyed === 1 ? ' unit.' : ' units.';
  sentences.push('Losses: ' + aName + ' lost ' + b.aDestroyed + aUnitWord + ', ' + bName + ' lost ' + b.bDestroyed + bUnitWord);

  return 'Why: ' + sentences.join(' ');
}

// Vocabulary audit: banned words in the why span text
const BANNED_WORDS = ['player', 'enemy', 'aPower', 'bPower', 'battle', 'targetId', 'Pct', '_'];

function checkVocabulary(whyText) {
  const hits = BANNED_WORDS.filter(w => whyText.indexOf(w) !== -1);
  return { ok: hits.length === 0, hits };
}

// ---------- Browser checks ----------

(async () => {
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await H.dismissTitle(page);

    await H.ensurePaused(page);

    // Helper: import a save file and return log items text
    async function importSaveAndReadLog(saveText, label) {
      const savePath = '/tmp/battle-why-' + label + '.json';
      fs.writeFileSync(savePath, saveText);
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#btn-import')
      ]);
      await fileChooser.setFiles(savePath);
      // Wait for the load to complete (notice appears)
      await H.waitFor(page, async () => {
        const notice = (await page.textContent('#save-notice')).trim();
        return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
      }, 5000);
      await H.dismissBurst(page);
      // Read log items
      const items = await page.evaluate(() => {
        const lis = Array.from(document.querySelectorAll('#log li'));
        return lis.map(li => ({
          fullText: li.textContent,
          whyText: li.querySelector('.battle-why') ? li.querySelector('.battle-why').textContent : '',
          hasWhy: !!li.querySelector('.battle-why')
        }));
      });
      return items;
    }

    // ---- Scenario A ----
    const itemsA = await importSaveAndReadLog(saveTextA, 'A');
    const logA = Save.deserializeSave(saveTextA);
    const entryA = logA.state.log.find(e => e.battle && e.battle.kind === 'battle');
    const expectedWhyA = expectedWhyFromRecord(entryA ? entryA.battle : null, logA.state.nations);

    check('Scenario A: battle outcome entry exists', !!entryA, entryA ? entryA.msg : 'none');
    check('Scenario A: expected why is non empty', expectedWhyA.length > 0, expectedWhyA);
    if (entryA) {
      const rendered = itemsA.find(it => it.fullText.indexOf(entryA.msg) !== -1);
      check('Scenario A: battle outcome rendered in log', !!rendered, 'log items: ' + itemsA.map(i => i.fullText.slice(0, 60)).join(' | '));
      if (rendered) {
        check('Scenario A: rendered why matches expected why exactly', rendered.whyText === expectedWhyA,
          'got: ' + rendered.whyText + ' expected: ' + expectedWhyA);
        check('Scenario A: why contains 25 percent river crossing penalty', rendered.whyText.indexOf('25 percent river crossing penalty') !== -1,
          rendered.whyText);
        check('Scenario A: attacker power equals node stackPower expA', rendered.whyText.indexOf('attack power ' + expAA) !== -1,
          'expA=' + expAA + ' why=' + rendered.whyText);
        check('Scenario A: defender power equals node stackPower expB', rendered.whyText.indexOf('defense power ' + expBA) !== -1,
          'expB=' + expBA + ' why=' + rendered.whyText);
        const vocabA = checkVocabulary(rendered.whyText);
        check('Scenario A: vocabulary audit clean', vocabA.ok, vocabA.hits.join(', ') || 'clean');
      }
    }
    // Non-battle entry check
    const nonBattleA = itemsA.find(it => !it.hasWhy);
    check('Scenario A: at least one non battle entry renders without Why', !!nonBattleA,
      nonBattleA ? nonBattleA.fullText.slice(0, 60) : 'none');

    // ---- Scenario B ----
    const itemsB = await importSaveAndReadLog(saveTextB, 'B');
    const logB = Save.deserializeSave(saveTextB);
    const entryB = logB.state.log.find(e => e.battle && e.battle.kind === 'battle');
    const expectedWhyB = expectedWhyFromRecord(entryB ? entryB.battle : null, logB.state.nations);

    check('Scenario B: battle outcome entry exists', !!entryB, entryB ? entryB.msg : 'none');
    check('Scenario B: expected why is non empty', expectedWhyB.length > 0, expectedWhyB);
    if (entryB) {
      const rendered = itemsB.find(it => it.fullText.indexOf(entryB.msg) !== -1);
      check('Scenario B: battle outcome rendered in log', !!rendered, 'log items: ' + itemsB.map(i => i.fullText.slice(0, 60)).join(' | '));
      if (rendered) {
        check('Scenario B: rendered why matches expected why exactly', rendered.whyText === expectedWhyB,
          'got: ' + rendered.whyText + ' expected: ' + expectedWhyB);
        check('Scenario B: why contains 30 percent supply penalty', rendered.whyText.indexOf('30 percent supply penalty') !== -1,
          rendered.whyText);
        check('Scenario B: why contains 50 percent fortification bonus', rendered.whyText.indexOf('50 percent fortification bonus') !== -1,
          rendered.whyText);
        const vocabB = checkVocabulary(rendered.whyText);
        check('Scenario B: vocabulary audit clean', vocabB.ok, vocabB.hits.join(', ') || 'clean');
      }
    }
    const nonBattleB = itemsB.find(it => !it.hasWhy);
    check('Scenario B: at least one non battle entry renders without Why', !!nonBattleB,
      nonBattleB ? nonBattleB.fullText.slice(0, 60) : 'none');

    // ---- Scenario C ----
    const itemsC = await importSaveAndReadLog(saveTextC, 'C');
    const logC = Save.deserializeSave(saveTextC);
    const entryC = logC.state.log.find(e => e.battle && e.battle.kind === 'battle');
    const expectedWhyC = expectedWhyFromRecord(entryC ? entryC.battle : null, logC.state.nations);

    check('Scenario C: battle outcome entry exists', !!entryC, entryC ? entryC.msg : 'none');
    check('Scenario C: expected why is non empty', expectedWhyC.length > 0, expectedWhyC);
    if (entryC) {
      const rendered = itemsC.find(it => it.fullText.indexOf(entryC.msg) !== -1);
      check('Scenario C: battle outcome rendered in log', !!rendered, 'log items: ' + itemsC.map(i => i.fullText.slice(0, 60)).join(' | '));
      if (rendered) {
        check('Scenario C: rendered why matches expected why exactly', rendered.whyText === expectedWhyC,
          'got: ' + rendered.whyText + ' expected: ' + expectedWhyC);
        check('Scenario C: why contains 1 interceptor launched', rendered.whyText.indexOf('1 interceptor launched') !== -1,
          rendered.whyText);
        check('Scenario C: why contains steel each', rendered.whyText.indexOf('steel each') !== -1,
          rendered.whyText);
        check('Scenario C: why contains 125 percent effectiveness', rendered.whyText.indexOf('125 percent effectiveness') !== -1,
          rendered.whyText);
        const vocabC = checkVocabulary(rendered.whyText);
        check('Scenario C: vocabulary audit clean', vocabC.ok, vocabC.hits.join(', ') || 'clean');
      }
    }
    // Interceptor launch line carries no battle record: assert no Why
    // The launch line message starts with the nation short name + " launch"
    // Full text includes "Day N" prefix from the day-tag span
    const launchLineC = itemsC.find(it => /Day \d+(Vessari|Khessite) launch \d+ interceptor/.test(it.fullText));
    check('Scenario C: interceptor launch line exists', !!launchLineC, 'log items: ' + itemsC.map(i => i.fullText.slice(0, 60)).join(' | '));
    if (launchLineC) {
      check('Scenario C: launch line has NO Why text', launchLineC.whyText === '',
        'launch line whyText: ' + JSON.stringify(launchLineC.whyText));
    }
    const nonBattleC = itemsC.find(it => !it.hasWhy);
    check('Scenario C: at least one non battle entry renders without Why', !!nonBattleC,
      nonBattleC ? nonBattleC.fullText.slice(0, 60) : 'none');

    // ---- Page errors ----
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });