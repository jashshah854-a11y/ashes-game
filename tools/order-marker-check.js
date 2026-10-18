'use strict';
// Real browser check for the order marker render (Cycle 18 step 3), in the
// tools/battle-why-check.js pattern:
// headless Chromium through Playwright against the repo's own index.html.
// Opens file:// index.html?seed=1 at 1400 by 1000 and drives only the real
// buttons. Every game fact is read from the page DOM, the only readable
// surface, exactly as the player sees it.
//
// The check stages saves in node with js/sim.js and js/save.js:
// A. seed 1 game, issueOrder a player unit to a neighbor AND an enemy unit
//    to a neighbor, serialize to /tmp, import through real #btn-import file
//    input. Assert exactly one .order-marker total, on the player target
//    tile, matching type (Inf or Drone), and none on the enemy target tile.
// B. Import a second staged save, fresh seed 1 with no orders, assert zero
//    markers.
// C. a third staged save, fresh seed 1, two player units that start stacked on
//    the same province both ordered to the same neighboring province; assert
//    exactly two .order-marker total and exactly two on that common target
//    tile, with marker texts matching the two ordered unit types.
//
// Browser path also verifies live interaction:
// (a) pause via real Pause button; assert zero .order-marker before any order
// (b) real clicks only: click a tile holding a player unit chip, then click a
//     neighboring reachable tile; assert exactly one .order-marker, inside the
//     clicked target tile, text exactly matching the selected unit type shown
//     on its chip (Inf or Drone form above)
//
// (e) #map-legend text contains "order marker" and "ordered here at dawn"
// (f) vocabulary audit: no marker text contains "player", "enemy",
//     "order.target", or underscore
// (g) no page errors
//
// Uses pause, overlay dismissal, and file import helper patterns from
// tools/battle-why-check.js. Stay paused during click path, bounded
// deterministic waits.
//
// Usage: node tools/order-marker-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');

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

async function waitFor(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(100); }
  return false;
}

async function ensurePaused(page) {
  while (true) {
    const txt = await page.textContent('#btn-pause');
    if (txt.trim() === 'Resume') return;
    await page.click('#btn-pause');
    await page.waitForTimeout(50);
  }
}

async function dismissBurst(page) {
  if (!(await page.isVisible('#event-overlay'))) return;
  while (await page.isVisible('#event-overlay')) {
    await page.click('#btn-event-continue');
    await page.waitForTimeout(150);
  }
}

async function clickWhenClear(page, selector) {
  for (let attempt = 0; attempt < 25; attempt++) {
    await dismissBurst(page);
    try {
      await page.click(selector, { timeout: 2000 });
      return;
    } catch (e) { }
  }
  throw new Error('could not click ' + selector + ': an overlay kept covering it');
}

// Vocabulary audit: banned words in order marker text
const BANNED_WORDS = ['player', 'enemy', 'order.target', '_'];

function checkVocabulary(text) {
  const hits = BANNED_WORDS.filter(w => text.toLowerCase().indexOf(w.toLowerCase()) !== -1);
  return { ok: hits.length === 0, hits };
}

// ---------- Build staged saves in node ----------

// Scenario A: seed 1, player unit ordered to neighbor AND enemy unit ordered to neighbor
const sA = Sim.createGame(1);
// Find a player unit and an enemy unit that are neighbors
let playerUnit = null;
let enemyUnit = null;
let playerTargetId = null;
let enemyTargetId = null;

for (const u of sA.units) {
  if (u.nation === 'player' && !playerUnit) {
    const prov = sA.provinces[u.provinceId];
    const neighbors = Sim.neighborsOf(sA, prov);
    const enemyNeighbor = neighbors.find(n => n.owner === 'enemy' || n.owner === 'fog');
    if (enemyNeighbor) {
      playerUnit = u;
      playerTargetId = enemyNeighbor.id;
    }
  }
  if (u.nation === 'enemy' && !enemyUnit) {
    const prov = sA.provinces[u.provinceId];
    const neighbors = Sim.neighborsOf(sA, prov);
    const playerNeighbor = neighbors.find(n => n.owner === 'player');
    if (playerNeighbor) {
      enemyUnit = u;
      enemyTargetId = playerNeighbor.id;
    }
  }
  if (playerUnit && enemyUnit) break;
}

if (!playerUnit || !enemyUnit || !playerTargetId || !enemyTargetId) {
  throw new Error('Could not find suitable player and enemy units with neighbor targets for seed 1');
}

Sim.issueOrder(sA, playerUnit.id, playerTargetId);
Sim.issueOrder(sA, enemyUnit.id, enemyTargetId);
const saveTextA = Save.serializeSave(sA).text;
fs.writeFileSync('/tmp/order-marker-A.json', saveTextA);

// Scenario B: fresh seed 1 with no orders
const sB = Sim.createGame(1);
const saveTextB = Save.serializeSave(sB).text;
fs.writeFileSync('/tmp/order-marker-B.json', saveTextB);

// Scenario C: fresh seed 1, two player units stacked on same province, both
// ordered to the same neighbor
const sC = Sim.createGame(1);
// Group player units by provinceId, in state.units order
const playerUnitsByProv = {};
for (const u of sC.units) {
  if (u.nation === 'player') {
    if (!playerUnitsByProv[u.provinceId]) playerUnitsByProv[u.provinceId] = [];
    playerUnitsByProv[u.provinceId].push(u);
  }
}
// Find first province with at least two player units
let stackedProvId = null;
let stackedUnits = null;
for (const provId of Object.keys(playerUnitsByProv)) {
  if (playerUnitsByProv[provId].length >= 2) {
    stackedProvId = provId;
    stackedUnits = playerUnitsByProv[provId].slice(0, 2);
    break;
  }
}
if (!stackedProvId || !stackedUnits) {
  throw new Error('Could not find a province with at least two player units for seed 1');
}
// Compute neighbors and take first as common target
const stackedProv = sC.provinces[stackedProvId];
const neighbors = Sim.neighborsOf(sC, stackedProv);
if (neighbors.length === 0) {
  throw new Error('Stacked province has no neighbors for seed 1');
}
const commonTargetId = neighbors[0].id;
// Issue orders for both units to the common target
const orderResults = [];
for (const u of stackedUnits) {
  const res = Sim.issueOrder(sC, u.id, commonTargetId);
  orderResults.push(res);
}
if (!orderResults.every(r => r.ok)) {
  throw new Error('One or both issueOrder calls failed for Scenario C');
}
// Record expected marker texts in state.units order
const expectedTextsC = stackedUnits.map(u => {
  const typeLabel = u.type === 'drone' ? 'Drone' : 'Inf';
  return 'Order: ' + typeLabel + ' ordered here at dawn';
});
const saveTextC = Save.serializeSave(sC).text;
fs.writeFileSync('/tmp/order-marker-C.json', saveTextC);

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

    await ensurePaused(page);
    await dismissBurst(page);

    // Helper: count order markers on page
    async function countMarkers() {
      return await page.evaluate(() => {
        const markers = document.querySelectorAll('.order-marker');
        return Array.from(markers).map(m => ({
          text: m.textContent.trim(),
          parentProvince: m.closest('.province') ? m.closest('.province').getAttribute('data-prov') : null
        }));
      });
    }

    // Helper: import a save file
    async function importSave(saveText, label) {
      const savePath = '/tmp/order-marker-' + label + '.json';
      fs.writeFileSync(savePath, saveText);
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#btn-import')
      ]);
      await fileChooser.setFiles(savePath);
      await waitFor(page, async () => {
        const notice = (await page.textContent('#save-notice')).trim();
        return notice.indexOf('Loaded') === 0 || notice.indexOf('Error') !== -1 || notice.indexOf('could not') !== -1;
      }, 5000);
      await dismissBurst(page);
    }

    // ---- (a) Pause and assert zero markers before any order ----
    const markersBefore = await countMarkers();
    check('Zero markers before any order (paused fresh game)', markersBefore.length === 0, 'found: ' + markersBefore.length);

    // ---- (b) Live click path: click player unit tile, then neighbor ----
    // Find a player unit chip on the map
    const playerChip = await page.$('.unit-chip.mine');
    check('Player unit chip exists for click test', !!playerChip, 'no .unit-chip.mine found');
    if (playerChip) {
      // Click the province button containing the chip (the tile)
      const playerTile = await playerChip.evaluateHandle(el => el.closest('.province'));
      const playerProvId = await playerTile.evaluate(el => el.getAttribute('data-prov'));
      await clickWhenClear(page, '.province[data-prov="' + playerProvId + '"]');
      await page.waitForTimeout(100);
      await dismissBurst(page);

      // Find a reachable neighbor tile (dashed green outline)
      const reachableTiles = await page.$$('.province.reachable');
      check('At least one reachable neighbor exists', reachableTiles.length > 0, 'count: ' + reachableTiles.length);
      if (reachableTiles.length > 0) {
        const targetTile = reachableTiles[0];
        const targetProvId = await targetTile.getAttribute('data-prov');
        await clickWhenClear(page, '.province[data-prov="' + targetProvId + '"]');
        await page.waitForTimeout(100);
        await dismissBurst(page);

        // Assert exactly one marker on the target tile
        const markersAfterClick = await countMarkers();
        check('Exactly one marker after live click order', markersAfterClick.length === 1, 'found: ' + markersAfterClick.length);
        if (markersAfterClick.length === 1) {
          const marker = markersAfterClick[0];
          check('Marker is on the clicked target tile', marker.parentProvince === targetProvId,
            'marker on ' + marker.parentProvince + ' expected ' + targetProvId);
          // Get the selected unit type from the chip text
          const chipText = await playerChip.textContent();
          const expectedType = chipText.includes('Drone') ? 'Drone' : 'Inf';
          const expectedText = 'Order: ' + expectedType + ' ordered here at dawn';
          check('Marker text matches selected unit type exactly', marker.text === expectedText,
            'got: ' + marker.text + ' expected: ' + expectedText);
          // Vocabulary audit on marker text
          const vocab = checkVocabulary(marker.text);
          check('Marker vocabulary audit clean', vocab.ok, vocab.hits.join(', ') || 'clean');
        }
      }
    }

    // ---- Scenario A import: player + enemy orders ----
    await importSave(saveTextA, 'A');
    const markersA = await countMarkers();
    check('Scenario A: exactly one marker total (player only)', markersA.length === 1, 'found: ' + markersA.length);
    if (markersA.length === 1) {
      const marker = markersA[0];
      check('Scenario A: marker on player target tile', marker.parentProvince === playerTargetId,
        'marker on ' + marker.parentProvince + ' expected ' + playerTargetId);
      // Verify marker text matches player unit type
      const playerTypeLabel = playerUnit.type === 'drone' ? 'Drone' : 'Inf';
      const expectedTextA = 'Order: ' + playerTypeLabel + ' ordered here at dawn';
      check('Scenario A: marker text matches player unit type', marker.text === expectedTextA,
        'got: ' + marker.text + ' expected: ' + expectedTextA);
      const vocabA = checkVocabulary(marker.text);
      check('Scenario A: marker vocabulary audit clean', vocabA.ok, vocabA.hits.join(', ') || 'clean');
    }
    // Verify no marker on enemy target tile
    const markersOnEnemyTarget = markersA.filter(m => m.parentProvince === enemyTargetId);
    check('Scenario A: zero markers on enemy target tile', markersOnEnemyTarget.length === 0,
      'found on enemy target: ' + markersOnEnemyTarget.length);

    // ---- Scenario B import: no orders ----
    await importSave(saveTextB, 'B');
    const markersB = await countMarkers();
    check('Scenario B (no orders): zero markers', markersB.length === 0, 'found: ' + markersB.length);

    // ---- Scenario C import: two orders to same target ----
    await importSave(saveTextC, 'C');
    const markersC = await countMarkers();
    check('Scenario C (two orders, one target): exactly two markers total', markersC.length === 2, 'found: ' + markersC.length);
    const markersCOnTarget = markersC.filter(m => m.parentProvince === commonTargetId);
    check('Scenario C: exactly two markers on the common target tile', markersCOnTarget.length === 2, 'found on target: ' + markersCOnTarget.length + ' expected: 2');
    const sortedFoundTexts = markersC.map(m => m.text).sort();
    const sortedExpectedTexts = expectedTextsC.slice().sort();
    check('Scenario C: marker texts match the two ordered unit types', JSON.stringify(sortedFoundTexts) === JSON.stringify(sortedExpectedTexts), 'found: ' + JSON.stringify(sortedFoundTexts) + ' expected: ' + JSON.stringify(sortedExpectedTexts));

    // ---- (e) Map legend contains order marker text ----
    const legendText = await page.textContent('#map-legend');
    check('Map legend contains "order marker"', legendText.toLowerCase().indexOf('order marker') !== -1, 'legend text checked');
    check('Map legend contains "ordered here at dawn"', legendText.toLowerCase().indexOf('ordered here at dawn') !== -1, 'legend text checked');

    // ---- (g) Page errors ----
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });