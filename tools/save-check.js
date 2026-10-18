'use strict';
// Real browser check for the save and load UI (Cycle 16 step 3), in the
// tools/lore-check.js and tools/end-screen-check.js pattern: headless
// Chromium through Playwright against the repo's own index.html. Opens
// file:// index.html?seed=1 at 1400 by 1000 and drives only the real
// buttons. There is no debug hook into the page, so every game fact below
// (the day counter, the steel stockpile, the notice) is read from the page
// DOM, the only readable surface, exactly as the player sees it.
//
// The run does not assume any particular day or tick at save time. After
// clicking Save, the slot text is read back through page.evaluate, then
// deserialized in node with js/save.js. The expected day, tickCount, seed,
// and player steel come from that artifact, and the notice assertion compares
// against 'Saved. Day ' + day + ', seed ' + seed + '.' built from those
// values. No expectation in the file assumes day 1 or tick 0.
//
// Checks, in order:
// 1. Save to the browser slot (game running, no pause race): notice text and
//    success style asserted against the artifact derived values; also assert
//    the DOM steel at save time equals the deserialized player steel.
// 2. Advance: ensureRunning, click speed 2, dismiss bursts, wait until the
//    day counter reaches at least the saved day plus 4 (relative target),
//    generous deadline.
// 3. Load from the slot through clickWhenClear: poll for the Loaded notice,
//    ensurePaused promptly, then assert the day counter equals the saved day
//    and the DOM steel equals the saved steel; no event overlay visible;
//    codex closed.
// 4. File round trip while paused: Export through the download event; assert
//    the suggested filename is 'ashes-save-day-' + savedDay + '-seed-' +
//    savedSeed + '.json'; parse the envelope and assert saveVersion 2, seed
//    equals savedSeed, and tick equals the saved tickCount; assert the
//    envelope carries no filename or name field; deserialize in node is ok.
//    Import through the real Import button and file chooser; poll for the
//    notice and assert it equals 'Loaded from file. Day ' + savedDay + ', ' +
//    savedNation + ', seed ' + savedSeed + '.'; ensurePaused promptly and
//    assert the day counter equals the saved day. In a comment, state the margin honestly: the notice
//    is written in the same handler that swaps the state, so it is exact; the
//    day read happens after a prompt pause at speed 1, inside one 900 ms tick
//    window.
// 5. Corrupted slot (overwrite with 'not a save at all' through
//    page.evaluate): plain error text, error style, and the game keeps
//    running (ensureRunning, speed 2, day advances, bursts dismissed while
//    waiting).
// 6. Empty slot: the exact no save wording.
// 7. No page errors.
// Usage: node tools/save-check.js   (CHROME=/path/to/chrome, PLAYWRIGHT=/path/to/playwright)
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
const SAVE_SLOT_KEY = 'ashes-save-slot-1';

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

async function dayCounter(page) {
  return parseInt(await page.textContent('#day-counter'), 10);
}

// Read the Pause button text. 'Pause' means the game is running. 'Resume'
// means it is paused.
async function pauseButtonText(page) {
  return (await page.textContent('#btn-pause')).trim();
}

// Click the Pause button only when the current state differs from the target.
async function ensureRunning(page) {
  while (true) {
    const txt = await pauseButtonText(page);
    if (txt === 'Pause') return; // already running
    await page.click('#btn-pause');
    await page.waitForTimeout(50);
  }
}

async function ensurePaused(page) {
  while (true) {
    const txt = await pauseButtonText(page);
    if (txt === 'Resume') return; // already paused
    await page.click('#btn-pause');
    await page.waitForTimeout(50);
  }
}

// Dismiss an open event card through its real Continue button. A card
// queued behind one appears synchronously, so a short wait detects it, and
// the next tick's cards are game days away. When nothing appears within the
// window the burst is over and the war has resumed.
async function dismissBurst(page) {
  if (!(await page.isVisible('#event-overlay'))) return;
  while (await page.isVisible('#event-overlay')) {
    await page.click('#btn-event-continue');
    await page.waitForTimeout(150);
  }
}

// Click a control that an open overlay can cover: clear the overlay first,
// then click, and if a card opened in between, clear it and try again.
async function clickWhenClear(page, selector) {
  for (let attempt = 0; attempt < 25; attempt++) {
    await dismissBurst(page);
    try {
      await page.click(selector, { timeout: 2000 });
      return;
    } catch (e) { /* a card opened mid-click; dismiss it and retry */ }
  }
  throw new Error('could not click ' + selector + ': an overlay kept covering it');
}

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

    // Start with the game running (do not pause on load). The first save will
    // capture whatever day and tick the sim has reached by the time the Save
    // handler runs. All expectations derive from the saved artifact.
    await ensureRunning(page);

    // 1. Save to the browser slot (game running, no pause race).
    await page.click('#btn-save-slot');
    const saveMsg = (await page.textContent('#save-notice')).trim();
    const slotText = await page.evaluate((key) => localStorage.getItem(key), SAVE_SLOT_KEY);
    const deser = Save.deserializeSave(slotText);
    const savedState = deser.state;
    const savedDay = savedState.day;
    const savedTick = savedState.tickCount;
    const savedSeed = savedState.seed;
    const savedNation = savedState.nations.player.name;
    const savedSteel = savedState.nations.player.steel;
    const expectedSaveNotice = 'Saved. Day ' + savedDay + ', seed ' + savedSeed + '.';
    check('Save: notice says saved with artifact day and seed',
      saveMsg === expectedSaveNotice, 'got: ' + saveMsg + ' expected: ' + expectedSaveNotice);
    check('Save: the notice is styled as a success',
      (await page.getAttribute('#save-notice', 'class')) === 'save-notice-ok',
      String(await page.getAttribute('#save-notice', 'class')));
    const steelAtSave = (await page.textContent('#stat-steel')).trim();
    check('Save: the steel stockpile matches the deserialized player steel',
      steelAtSave === String(savedSteel), 'DOM ' + steelAtSave + ', artifact ' + savedSteel);

    // 2. Advance to at least savedDay + 4, dismissing any card through Continue.
    await ensureRunning(page);
    await page.click('#btn-speed2');
    const advanceDeadline = Date.now() + 120000;
    let dayNow = await dayCounter(page);
    const targetDay = savedDay + 4;
    while (dayNow < targetDay && Date.now() < advanceDeadline) {
      await dismissBurst(page);
      dayNow = await dayCounter(page);
      if (dayNow < targetDay) await page.waitForTimeout(200);
    }
    check('Advance: the campaign reached at least saved day plus 4', dayNow >= targetDay, 'day ' + dayNow + ' target ' + targetDay);

    // 3. Load it back: day equals savedDay, same steel as right after the save.
    await clickWhenClear(page, '#btn-load-slot');
    // Poll for the Loaded notice text to appear.
    const loadNoticed = await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t.indexOf('Loaded. Day ') === 0;
    }, 5000);
    await ensurePaused(page);
    const dayAfterLoad = await dayCounter(page);
    const steelAfterLoad = (await page.textContent('#stat-steel')).trim();
    check('Load: the day counter equals the saved day', dayAfterLoad === savedDay, 'day ' + dayAfterLoad + ' expected ' + savedDay);
    check('Load: the steel stockpile equals the saved steel',
      steelAfterLoad === String(savedSteel), 'saved ' + savedSteel + ', loaded ' + steelAfterLoad);
    check('Load: no event card overlay is visible afterwards',
      !(await page.isVisible('#event-overlay')));
    check('Load: the codex is still closed',
      !(await page.isVisible('#codex-overlay')));

    // 4. The file round trip, taken while the restored campaign sits paused.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-export')
    ]);
    const exportPath = await download.path();
    const exportText = fs.readFileSync(exportPath, 'utf8');
    const envelope = JSON.parse(exportText);
    check('Export: the envelope reads saveVersion 2, seed equals savedSeed, tick equals savedTick',
      envelope.saveVersion === 2 && envelope.seed === savedSeed && envelope.tick === savedTick,
      'version ' + envelope.saveVersion + ', seed ' + envelope.seed + ', tick ' + envelope.tick);
    const deserExport = Save.deserializeSave(exportText);
    check('Export: js/save.js reads the exported file back ok in node',
      deserExport.ok, deserExport.ok ? 'ok' : deserExport.reason);
    const suggested = download.suggestedFilename();
    const expectedFilename = 'ashes-save-day-' + savedDay + '-seed-' + savedSeed + '.json';
    check('Export: the file name carries the day and the seed',
      suggested === expectedFilename, suggested);
    check('Export: the envelope holds no file name, the name is UI only',
      !('filename' in envelope) && !('name' in envelope),
      Object.keys(envelope).join(','));

    // Import that same file through the real Import button and file chooser.
    // The notice is written in the same handler that swaps the state, so it is
    // exact. The day read happens after a prompt pause at speed 1, inside one
    // 900 ms tick window.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await chooser.setFiles(exportPath);
    const importNoticed = await waitFor(page, async () =>
      (await page.textContent('#save-notice')).indexOf('Loaded from file') === 0, 3000);
    const importMsg = (await page.textContent('#save-notice')).trim();
    const expectedImportNotice = 'Loaded from file. Day ' + savedDay + ', ' + savedNation + ', seed ' + savedSeed + '.';
    check('Import: the notice says loaded from file with saved day and seed',
      importNoticed && importMsg === expectedImportNotice, importMsg);
    await ensurePaused(page);
    check('Import: the day counter equals the saved day',
      (await dayCounter(page)) === savedDay, 'day ' + await dayCounter(page));

    // Back to running at speed 2 for the corrupted slot check.
    await ensureRunning(page);
    await page.click('#btn-speed2');

    // 5. A corrupted slot: plain error, and the game keeps running.
    await page.evaluate((key) => { localStorage.setItem(key, 'not a save at all'); }, SAVE_SLOT_KEY);
    await clickWhenClear(page, '#btn-load-slot');
    const corruptMsg = (await page.textContent('#save-notice')).trim();
    check('Corrupted load: the notice shows a plain error',
      corruptMsg.length > 0 && corruptMsg.indexOf('Loaded') === -1, corruptMsg);
    check('Corrupted load: the notice is styled as a failure',
      (await page.getAttribute('#save-notice', 'class')) === 'save-notice-error',
      String(await page.getAttribute('#save-notice', 'class')));
    const dayBeforeCorruptRun = await dayCounter(page);
    const keptRunning = await waitFor(page, async () => {
      await dismissBurst(page);
      return (await dayCounter(page)) !== dayBeforeCorruptRun;
    }, 15000);
    check('Corrupted load: the game keeps running, the day counter advances at speed 2',
      keptRunning, 'held at day ' + dayBeforeCorruptRun);

    // 6. An empty slot.
    await page.evaluate((key) => { localStorage.removeItem(key); }, SAVE_SLOT_KEY);
    await clickWhenClear(page, '#btn-load-slot');
    const emptyMsg = (await page.textContent('#save-notice')).trim();
    check('Empty slot: the notice says the slot holds no save yet',
      emptyMsg === 'The browser slot holds no save yet.', emptyMsg);

    // 7. No page errors.
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });