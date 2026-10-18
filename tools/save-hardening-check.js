'use strict';
// Real browser check for the save and load hardening (Cycle 17 step 4), in the
// tools/save-check.js pattern: headless Chromium through Playwright against
// the repo's own index.html. Opens file:// index.html?seed=1 at 1400 by 1000
// and drives only the real buttons. There is no debug hook into the page, so
// every game fact below (the day counter, the steel stockpile, the notice) is
// read from the page DOM, the only readable surface, exactly as the player
// sees it.
//
// The run does not assume any particular day or tick at save time. After
// clicking Save, the slot text is read back through page.evaluate, then
// deserialized in node with js/save.js. The expected day, tickCount, seed,
// and player nation name come from that artifact, and notice assertions are
// built from those values. No expectation in the file assumes day 1 or tick 0.
//
// Checks, in order:
// 1. Contents: the save-contents element text mentions the cost exchange
//    ledger, the intel snapshots, production lines and queues, and both
//    nations.
// 2. Replace warning: the save-replace-warning element text says loading
//    replaces the current game and mentions saved or exported.
// 3. Slot meta empty: with the slot cleared first through page.evaluate, the
//    save-slot-meta text equals "Browser slot: empty. Nothing is saved in the
//    browser slot yet." (reload the page after clearing so startup runs).
// 4. Slot meta after save: click the real Save to browser slot button, read
//    the slot text back, deserialize in node, and assert the meta text equals
//    "Browser slot: Day " + day + ", " + nation name + ", saved at " + a time
//    text that contains a colon; assert the meta starts with that prefix shape
//    and contains a colon after "saved at".
// 5. Post load confirmation: advance at least 3 days, load from the slot
//    through the real button, poll for the notice, and assert it equals
//    "Loaded. Day " + savedDay + ", " + savedNation + ", seed " + savedSeed
//    + "." and the day counter equals the saved day after a prompt pause.
// 6. Browser continuation through main.js: after that load, run at speed 1
//    and see the day advance at least 1, then click speed 2 and see the day
//    advance at least 1 more, dismissing event cards through Continue; this
//    proves the main.js timer drives the sim at both speeds.
// 7. Quota: page.evaluate to wrap Storage.prototype.setItem so it throws a
//    DOMException named QuotaExceededError when the key is the slot key,
//    click Save, assert the notice equals "The browser slot is full, so this
//    save was not stored. Export the save to a file instead." and the error
//    style, then restore the original setItem.
// 8. Version: build a version 99 save by taking the current slot text,
//    parsing it, setting saveVersion to 99, writing it back to the slot
//    through page.evaluate, click Load, assert the notice equals the exact new
//    version message with 99 filled in and the error style class.
// 9. Empty file: use the file chooser from the real Import button with an
//    empty buffer file named empty.json, assert the notice equals "That file
//    is empty, so there is nothing to load. Your current game keeps running."
// 10. Binary file: chooser with a buffer of non text bytes (for example
//     0x00 0x89 0x50 0x4e 0x47 0xff 0xfe) named binary.json, assert the
//     notice is a non empty error that does not start with Loaded, has the
//     error style, and the game still runs (day advances at speed 2 or the
//     game is unpaused and advancing).
// 11. FileReader error: page.evaluate to save window.FileReader and replace
//     it with a stub constructor whose readAsText calls this.onerror with an
//     error after a tick, then import a valid exported file through the
//     chooser, assert the notice equals "The browser could not read that
//     file, so nothing was loaded. Your current game keeps running.", then
//     restore the real FileReader. To get a valid file, export one first
//     through the real Export button and the download event.
// 12. Re-import: import that exported file, note the Loaded from file notice
//     with nation, advance at least 3 days, import the same file again
//     through the chooser, assert the Loaded from file notice appears again
//     with the saved day and the day counter returns to the saved day after a
//     prompt pause. This pins the input reset.
// 13. History validation: prove three malformed history cases through the
//     browser slot path. For each case, take the current valid slot save,
//     mutate the history (not a list; a snapshot field as text; snapshot days
//     not starting at 1 or not increasing), recompute the checksum, write the
//     mutated envelope to the slot, click Load, and assert the notice starts
//     with the exact damage prefix, has the error style, and does not start
//     with Loaded. Each case is its own check.
// 14. Broken labels: the save card texts checked contain no undefined, NaN,
//     or [object.
// 15. No page errors.
// Usage: node tools/save-hardening-check.js   (CHROME=/path/to/chrome,
// PLAYWRIGHT=/path/to/playwright)
// Exit 0 when every check passes, 1 on a failed check, 2 on error.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const Save = require('../js/save.js');
const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const URL = 'file://' + path.join(REPO, 'index.html') + '?seed=1';
const SAVE_SLOT_KEY = 'ashes-save-slot-1';
const SAVE_SLOT_META_KEY = 'ashes-save-slot-1-meta';

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

async function pauseButtonText(page) {
  return (await page.textContent('#btn-pause')).trim();
}

async function ensureRunning(page) {
  while (true) {
    const txt = await pauseButtonText(page);
    if (txt === 'Pause') return;
    await page.click('#btn-pause');
    await page.waitForTimeout(50);
  }
}

async function ensurePaused(page) {
  while (true) {
    const txt = await pauseButtonText(page);
    if (txt === 'Resume') return;
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

async function readSlotText(page) {
  return await page.evaluate((key) => localStorage.getItem(key), SAVE_SLOT_KEY);
}

async function getSaveNotice(page) {
  return (await page.textContent('#save-notice')).trim();
}

async function getSaveNoticeClass(page) {
  return await page.getAttribute('#save-notice', 'class');
}

function checkTextNoBrokenLabels(text) {
  return text.indexOf('undefined') === -1 &&
         text.indexOf('NaN') === -1 &&
         text.indexOf('[object') === -1;
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

    await ensureRunning(page);

    // 1. Contents: the save-contents element text mentions the cost exchange
    // ledger, the intel snapshots, production lines and queues, and both
    // nations.
    const contentsText = (await page.textContent('#save-contents')).trim();
    const hasLedger = /cost exchange ledger/i.test(contentsText);
    const hasIntel = /intel snapshots?/i.test(contentsText);
    const hasProd = /production lines? and queues?/i.test(contentsText);
    const hasBothNations = /both\s+nations/i.test(contentsText);
    check('Contents: save-contents mentions cost exchange ledger', hasLedger, contentsText);
    check('Contents: save-contents mentions intel snapshots', hasIntel, contentsText);
    check('Contents: save-contents mentions production lines and queues', hasProd, contentsText);
    check('Contents: save-contents mentions both nations', hasBothNations, contentsText);

    // 2. Replace warning: the save-replace-warning element text says loading
    // replaces the current game and mentions saved or exported.
    const replaceText = (await page.textContent('#save-replace-warning')).trim();
    const warnsReplace = /loading a save replaces the current game/i.test(replaceText);
    const warnsSavedOrExported = /saved or exported/i.test(replaceText);
    check('Replace warning: says loading replaces the current game', warnsReplace, replaceText);
    check('Replace warning: mentions saved or exported', warnsSavedOrExported, replaceText);

    // 3. Slot meta empty: with the slot cleared first through page.evaluate,
    // the save-slot-meta text equals "Browser slot: empty. Nothing is saved in
    // the browser slot yet." (reload the page after clearing so startup runs).
    await page.evaluate((key) => { localStorage.removeItem(key); }, SAVE_SLOT_KEY);
    await page.evaluate((key) => { localStorage.removeItem(key); }, SAVE_SLOT_META_KEY);
    await page.reload();
    await page.waitForTimeout(200);
    const emptyMeta = (await page.textContent('#save-slot-meta')).trim();
    const expectedEmptyMeta = 'Browser slot: empty. Nothing is saved in the browser slot yet.';
    check('Slot meta empty: matches exact empty wording', emptyMeta === expectedEmptyMeta,
      'got: ' + emptyMeta + ' expected: ' + expectedEmptyMeta);

    // 4. Slot meta after save: click the real Save to browser slot button, read
    // the slot text back, deserialize in node, and assert the meta text equals
    // "Browser slot: Day " + day + ", " + nation name + ", saved at " + a time
    // text that contains a colon; assert the meta starts with that prefix shape
    // and contains a colon after "saved at".
    await ensureRunning(page);
    await page.click('#btn-save-slot');
    await page.waitForTimeout(100);
    const slotText = await readSlotText(page);
    const deser = Save.deserializeSave(slotText);
    const savedState = deser.state;
    const savedDay = savedState.day;
    const savedNation = savedState.nations.player.name;
    const metaAfterSave = (await page.textContent('#save-slot-meta')).trim();
    const metaPrefix = 'Browser slot: Day ' + savedDay + ', ' + savedNation + ', saved at ';
    const hasPrefix = metaAfterSave.startsWith(metaPrefix);
    const hasColonAfterSavedAt = metaAfterSave.indexOf('saved at ') !== -1 &&
                                  metaAfterSave.indexOf(':', metaAfterSave.indexOf('saved at ')) !== -1;
    check('Slot meta after save: starts with expected prefix', hasPrefix,
      'got: ' + metaAfterSave + ' expected prefix: ' + metaPrefix);
    check('Slot meta after save: contains a colon after saved at', hasColonAfterSavedAt, metaAfterSave);

    // 5. Post load confirmation: advance at least 3 days, load from the slot
    // through the real button, poll for the notice, and assert it equals
    // "Loaded. Day " + savedDay + ", " + savedNation + ", seed " + savedSeed
    // + "." and the day counter equals the saved day after a prompt pause.
    await ensureRunning(page);
    await page.click('#btn-speed2');
    const advanceDeadline = Date.now() + 120000;
    let dayNow = await dayCounter(page);
    const targetDay = savedDay + 3;
    while (dayNow < targetDay && Date.now() < advanceDeadline) {
      await dismissBurst(page);
      dayNow = await dayCounter(page);
      if (dayNow < targetDay) await page.waitForTimeout(200);
    }
    check('Advance before load: reached at least saved day plus 3', dayNow >= targetDay,
      'day ' + dayNow + ' target ' + targetDay);

    const savedSeed = savedState.seed;
    await clickWhenClear(page, '#btn-load-slot');
    const loadNoticed = await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t.indexOf('Loaded. Day ') === 0;
    }, 5000);
    await ensurePaused(page);
    const dayAfterLoad = await dayCounter(page);
    const loadMsg = await getSaveNotice(page);
    const expectedLoadMsg = 'Loaded. Day ' + savedDay + ', ' + savedNation + ', seed ' + savedSeed + '.';
    check('Post load: notice matches expected text', loadMsg === expectedLoadMsg,
      'got: ' + loadMsg + ' expected: ' + expectedLoadMsg);
    check('Post load: day counter equals saved day', dayAfterLoad === savedDay,
      'day ' + dayAfterLoad + ' expected ' + savedDay);

    // 6. Browser continuation through main.js: after that load, run at speed
    // 1 and see the day advance at least 1, then click speed 2 and see the
    // day advance at least 1 more, dismissing event cards through Continue.
    await ensureRunning(page);
    await page.click('#btn-speed1');
    const dayBeforeSpeed1 = await dayCounter(page);
    let advanced1 = await waitFor(page, async () => {
      await dismissBurst(page);
      return (await dayCounter(page)) > dayBeforeSpeed1;
    }, 15000);
    check('Continuation at speed 1: day advanced at least 1', advanced1,
      'held at day ' + dayBeforeSpeed1);

    await page.click('#btn-speed2');
    const dayBeforeSpeed2 = await dayCounter(page);
    let advanced2 = await waitFor(page, async () => {
      await dismissBurst(page);
      return (await dayCounter(page)) > dayBeforeSpeed2;
    }, 10000);
    check('Continuation at speed 2: day advanced at least 1 more', advanced2,
      'held at day ' + dayBeforeSpeed2);

    // 7. Quota: wrap Storage.prototype.setItem so it throws a
    // QuotaExceededError when the key is the slot key, click Save, assert
    // the notice equals "The browser slot is full, so this save was not
    // stored. Export the save to a file instead." and the error style, then
    // restore the original setItem.
    await page.evaluate(() => {
      window._originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'ashes-save-slot-1') {
          const e = new DOMException('Quota exceeded', 'QuotaExceededError');
          e.name = 'QuotaExceededError';
          e.code = 22;
          throw e;
        }
        return window._originalSetItem.call(this, key, value);
      };
    });
    await page.click('#btn-save-slot');
    await page.waitForTimeout(200);
    const quotaMsg = await getSaveNotice(page);
    const quotaClass = await getSaveNoticeClass(page);
    const expectedQuotaMsg = 'The browser slot is full, so this save was not stored. Export the save to a file instead.';
    check('Quota: notice matches expected quota message', quotaMsg === expectedQuotaMsg,
      'got: ' + quotaMsg);
    check('Quota: notice is styled as error', quotaClass === 'save-notice-error', quotaClass);
    // Restore original setItem
    await page.evaluate(() => {
      Storage.prototype.setItem = window._originalSetItem;
    });

    // 8. Version: build a version 99 save by taking the current slot text,
    // parsing it, setting saveVersion to 99, writing it back to the slot
    // through page.evaluate, click Load, assert the notice equals the exact
    // new version message with 99 filled in and the error style class.
    const slotTextForVersion = await readSlotText(page);
    const envelope = JSON.parse(slotTextForVersion);
    envelope.saveVersion = 99;
    const version99Text = JSON.stringify(envelope);
    await page.evaluate((args) => { localStorage.setItem(args.key, args.text); }, { key: SAVE_SLOT_KEY, text: version99Text });
    await clickWhenClear(page, '#btn-load-slot');
    await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t.length > 0 && t.indexOf('Loaded') === -1;
    }, 5000);
    const versionMsg = await getSaveNotice(page);
    const versionClass = await getSaveNoticeClass(page);
    const expectedVersionMsg = 'This save was made by a different version of the game (save version 99). This game can only load version 3 saves, so nothing was loaded and your current game keeps running.';
    check('Version: notice matches exact version rejection message with 99', versionMsg === expectedVersionMsg,
      'got: ' + versionMsg);
    check('Version: notice is styled as error', versionClass === 'save-notice-error', versionClass);

    // 9. Empty file: use the file chooser from the real Import button with an
    // empty buffer file named empty.json, assert the notice equals "That file
    // is empty, so there is nothing to load. Your current game keeps running."
    const emptyFile = Buffer.alloc(0);
    const emptyPath = path.join(__dirname, '..', 'empty.json');
    fs.writeFileSync(emptyPath, emptyFile);
    const [emptyChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await emptyChooser.setFiles({ name: 'empty.json', mimeType: 'application/json', buffer: emptyFile });
    await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t.length > 0;
    }, 3000);
    const emptyMsg = await getSaveNotice(page);
    const expectedEmptyMsg = 'That file is empty, so there is nothing to load. Your current game keeps running.';
    check('Empty file: notice matches expected empty file message', emptyMsg === expectedEmptyMsg,
      'got: ' + emptyMsg);
    fs.unlinkSync(emptyPath);

    // 10. Binary file: chooser with a buffer of non text bytes named
    // binary.json, assert the notice is a non empty error that does not
    // start with Loaded, has the error style, and the game still runs.
    const binaryBuffer = Buffer.from([0x00, 0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]);
    const binaryPath = path.join(__dirname, '..', 'binary.json');
    fs.writeFileSync(binaryPath, binaryBuffer);
    const [binaryChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    const noticeBeforeBinary = await getSaveNotice(page);
    await binaryChooser.setFiles({ name: 'binary.json', mimeType: 'application/json', buffer: binaryBuffer });
    // readAsText decodes asynchronously, so wait for a notice actually
    // written by this import, never the one already on screen.
    const binaryNoticed = await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t !== noticeBeforeBinary;
    }, 5000);
    const binaryMsg = await getSaveNotice(page);
    const binaryClass = await getSaveNoticeClass(page);
    const binaryIsError = binaryNoticed && binaryMsg.length > 0 && binaryMsg.indexOf('Loaded') !== 0;
    check('Binary file: notice is a non empty error not starting with Loaded', binaryIsError,
      'got: ' + binaryMsg);
    check('Binary file: notice is styled as error', binaryClass === 'save-notice-error', binaryClass);
    // Game still runs: ensure running at speed 2 and day advances
    await ensureRunning(page);
    await page.click('#btn-speed2');
    const dayBeforeBinary = await dayCounter(page);
    let binaryRuns = await waitFor(page, async () => {
      await dismissBurst(page);
      return (await dayCounter(page)) !== dayBeforeBinary;
    }, 15000);
    check('Binary file: game still runs (day advances at speed 2)', binaryRuns,
      'held at day ' + dayBeforeBinary);
    fs.unlinkSync(binaryPath);

    // 11. FileReader error: page.evaluate to save window.FileReader and
    // replace it with a stub constructor whose readAsText calls this.onerror
    // with an error after a tick, then import a valid exported file through
    // the chooser, assert the notice equals "The browser could not read that
    // file, so nothing was loaded. Your current game keeps running.", then
    // restore the real FileReader. To get a valid file, export one first
    // through the real Export button and the download event.
    await page.evaluate(() => {
      window._originalFileReader = window.FileReader;
      window.FileReader = function() {
        const self = this;
        this.readAsText = function(file) {
          setTimeout(function() {
            if (self.onerror) self.onerror(new Error('FileReader error'));
          }, 0);
        };
      };
    });
    // Export a valid file first
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-export')
    ]);
    const exportPath = await download.path();
    const [frChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await frChooser.setFiles(exportPath);
    const expectedFrMsg = 'The browser could not read that file, so nothing was loaded. Your current game keeps running.';
    // The stub calls onerror on a later task, so wait for the exact message
    // this import writes, never whatever notice is already on screen.
    const frNoticed = await waitFor(page, async () =>
      (await page.textContent('#save-notice')).trim() === expectedFrMsg, 5000);
    const frMsg = await getSaveNotice(page);
    check('FileReader error: notice matches expected reader error message',
      frNoticed && frMsg === expectedFrMsg, 'got: ' + frMsg);
    // Restore real FileReader
    await page.evaluate(() => {
      window.FileReader = window._originalFileReader;
    });

    // 12. Re-import: import that exported file, note the Loaded from file
    // notice with nation, advance at least 3 days, import the same file
    // again through the chooser, assert the Loaded from file notice appears
    // again with the saved day and the day counter returns to the saved day
    // after a prompt pause. This pins the input reset.
    const [reImportChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await reImportChooser.setFiles(exportPath);
    await waitFor(page, async () => {
      const t = (await page.textContent('#save-notice')).trim();
      return t.indexOf('Loaded from file') === 0;
    }, 3000);
    const reImportMsg = await getSaveNotice(page);
    const deserExport = Save.deserializeSave(fs.readFileSync(exportPath, 'utf8'));
    const exportDay = deserExport.state.day;
    const exportNation = deserExport.state.nations.player.name;
    const exportSeed = deserExport.state.seed;
    const expectedReImportMsg = 'Loaded from file. Day ' + exportDay + ', ' + exportNation + ', seed ' + exportSeed + '.';
    check('Re-import first load: notice matches expected loaded from file', reImportMsg === expectedReImportMsg,
      'got: ' + reImportMsg + ' expected: ' + expectedReImportMsg);
    await ensurePaused(page);
    const dayAfterFirstImport = await dayCounter(page);
    check('Re-import first load: day counter equals saved day', dayAfterFirstImport === exportDay,
      'day ' + dayAfterFirstImport + ' expected ' + exportDay);

    // Advance at least 3 days
    await ensureRunning(page);
    await page.click('#btn-speed2');
    const advanceDeadline2 = Date.now() + 120000;
    let dayNow2 = await dayCounter(page);
    const targetDay2 = exportDay + 3;
    while (dayNow2 < targetDay2 && Date.now() < advanceDeadline2) {
      await dismissBurst(page);
      dayNow2 = await dayCounter(page);
      if (dayNow2 < targetDay2) await page.waitForTimeout(200);
    }
    check('Re-import advance: reached at least saved day plus 3', dayNow2 >= targetDay2,
      'day ' + dayNow2 + ' target ' + targetDay2);

    // Import the same file again. Save first so the notice holds Saved, not
    // the first import's text: the poll below can then only pass on a Loaded
    // from file notice written by this second import.
    await page.click('#btn-save-slot');
    const [reImportChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btn-import')
    ]);
    await reImportChooser2.setFiles(exportPath);
    const secondImportNoticed = await waitFor(page, async () =>
      (await page.textContent('#save-notice')).trim() === expectedReImportMsg, 5000);
    const reImportMsg2 = await getSaveNotice(page);
    check('Re-import second load: notice matches expected loaded from file again',
      secondImportNoticed && reImportMsg2 === expectedReImportMsg,
      'got: ' + reImportMsg2 + ' expected: ' + expectedReImportMsg);
    await ensurePaused(page);
    const dayAfterSecondImport = await dayCounter(page);
    check('Re-import second load: day counter returns to saved day', dayAfterSecondImport === exportDay,
      'day ' + dayAfterSecondImport + ' expected ' + exportDay);

    // 13. History validation: prove three malformed history cases through the
    // browser slot path. For each case, take the current valid slot save,
    // mutate the history, recompute the checksum, write the mutated envelope
    // to the slot, click Load, and assert the notice starts with the exact
    // damage prefix, has the error style, and does not start with Loaded.
    // Each case is its own check() call.
    const damagePrefix = 'The saved campaign history is damaged, so the save cannot be loaded: ';
    // Save a valid game to the slot first, to have a clean baseline for each case.
    async function saveValidSlot() {
      await ensureRunning(page);
      await page.click('#btn-save-slot');
      await page.waitForTimeout(100);
    }
    // Read the current slot, mutate it with the given function, write it back,
    // click Load, and return the notice text and class.
    async function loadMutatedSave(mutateFn) {
      const slotText = await readSlotText(page);
      const envelope = JSON.parse(slotText);
      const payload = JSON.parse(envelope.payload);
      mutateFn(payload);
      envelope.payload = JSON.stringify(payload);
      envelope.checksum = Save.checksumFor(envelope.payload);
      const mutatedText = JSON.stringify(envelope);
      await page.evaluate((args) => { localStorage.setItem(args.key, args.text); }, { key: SAVE_SLOT_KEY, text: mutatedText });
      await clickWhenClear(page, '#btn-load-slot');
      await waitFor(page, async () => {
        const t = (await page.textContent('#save-notice')).trim();
        return t.length > 0 && t.indexOf('Loaded') !== 0;
      }, 5000);
      const msg = await getSaveNotice(page);
      const cls = await getSaveNoticeClass(page);
      return { msg, cls };
    }

    // Case 1: player history is not a list (set to a text value)
    await saveValidSlot();
    let result = await loadMutatedSave((payload) => {
      payload.history.player = 'not a list';
    });
    const histMsgCase1 = result.msg;
    check('History validation: player history not a list - notice starts with damage prefix',
      result.msg.startsWith(damagePrefix), 'got: ' + result.msg);
    check('History validation: player history not a list - notice is error style',
      result.cls === 'save-notice-error', 'class: ' + result.cls);
    check('History validation: player history not a list - notice does not start with Loaded',
      result.msg.indexOf('Loaded') !== 0, 'got: ' + result.msg);

    // Case 2: a snapshot field is a text value (steel as text)
    await saveValidSlot();
    result = await loadMutatedSave((payload) => {
      payload.history.player[0].steel = 'not a number';
    });
    const histMsgCase2 = result.msg;
    check('History validation: snapshot steel as text - notice starts with damage prefix',
      result.msg.startsWith(damagePrefix), 'got: ' + result.msg);
    check('History validation: snapshot steel as text - notice is error style',
      result.cls === 'save-notice-error', 'class: ' + result.cls);
    check('History validation: snapshot steel as text - notice does not start with Loaded',
      result.msg.indexOf('Loaded') !== 0, 'got: ' + result.msg);

    // Case 3: snapshot days not starting at 1 (first day changed to 2)
    await saveValidSlot();
    result = await loadMutatedSave((payload) => {
      payload.history.player[0].day = 2;
    });
    const histMsgCase3 = result.msg;
    check('History validation: first snapshot day not 1 - notice starts with damage prefix',
      result.msg.startsWith(damagePrefix), 'got: ' + result.msg);
    check('History validation: first snapshot day not 1 - notice is error style',
      result.cls === 'save-notice-error', 'class: ' + result.cls);
    check('History validation: first snapshot day not 1 - notice does not start with Loaded',
      result.msg.indexOf('Loaded') !== 0, 'got: ' + result.msg);

    // Case 4: snapshot days not strictly increasing (second day <= first day)
    // This requires a save with at least 2 snapshots. Tick until we have 2.
    await ensureRunning(page);
    await page.click('#btn-speed2');
    let dayForTwoSnaps = await dayCounter(page);
    while (dayForTwoSnaps < 31 && Date.now() < Date.now() + 120000) {
      await dismissBurst(page);
      dayForTwoSnaps = await dayCounter(page);
      if (dayForTwoSnaps < 31) await page.waitForTimeout(200);
    }
    await saveValidSlot();
    result = await loadMutatedSave((payload) => {
      if (payload.history.player.length >= 2) {
        payload.history.player[1].day = payload.history.player[0].day;
      }
    });
    const histMsg1 = result.msg;
    check('History validation: snapshot days not increasing - notice starts with damage prefix',
      result.msg.startsWith(damagePrefix), 'got: ' + result.msg);
    check('History validation: snapshot days not increasing - notice is error style',
      result.cls === 'save-notice-error', 'class: ' + result.cls);
    check('History validation: snapshot days not increasing - notice does not start with Loaded',
      result.msg.indexOf('Loaded') !== 0, 'got: ' + result.msg);

    // Restore a valid save into the slot for the remaining sections.
    await saveValidSlot();

    // 14. Broken labels: the save card texts checked contain no undefined,
    // NaN, or [object.
    const textsToCheck = [
      contentsText,
      replaceText,
      emptyMeta,
      metaAfterSave,
      loadMsg,
      quotaMsg,
      versionMsg,
      emptyMsg,
      binaryMsg,
      frMsg,
      reImportMsg,
      reImportMsg2,
      histMsgCase1,
      histMsgCase2,
      histMsgCase3,
      histMsg1
    ];
    let allClean = true;
    let badText = '';
    for (const t of textsToCheck) {
      if (!checkTextNoBrokenLabels(t)) {
        allClean = false;
        badText = t;
        break;
      }
    }
    check('Broken labels: no undefined, NaN, or [object in save card texts', allClean,
      allClean ? 'all clean' : 'bad text: ' + badText);

    // 15. No page errors.
    check('No page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });