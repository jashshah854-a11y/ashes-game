'use strict';

const POLL_MS = 100;

async function tryWait(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  return false;
}

async function waitUntil(fn, ms, label) {
  const ok = await tryWait(fn, ms);
  if (!ok) throw new Error('waitUntil timed out: ' + label);
}

async function waitFor(page, fn, ms) {
  return tryWait(fn, ms);
}

async function ensurePaused(page) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const txt = await page.textContent('#btn-pause');
    if (txt.trim() === 'Resume') return;
    await page.click('#btn-pause');
    await tryWait(async () => {
      const t = await page.textContent('#btn-pause');
      return t.trim() === 'Resume';
    }, 500);
  }
  throw new Error('ensurePaused: never reached Resume state');
}

async function dismissBurst(page) {
  if (!(await page.isVisible('#event-overlay'))) return;
  for (let attempt = 0; attempt < 50; attempt++) {
    await page.click('#btn-event-continue');
    const hidden = await tryWait(async () => !(await page.isVisible('#event-overlay')), 300);
    if (hidden) return;
  }
  throw new Error('dismissBurst: overlay still visible after max attempts');
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

async function untilText(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.isVisible('#event-overlay')) await page.click('#btn-event-continue');
    if (await fn()) return true;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  return false;
}

// Cycle 23 Step 21b-3: the F01 title overlay covers the page at load and
// holds the war paused. Playwright checks call dismissTitle(page); raw CDP
// checks evaluate TITLE_DISMISS_EXPR, which clicks New game when the title
// is visible and returns whether it dismissed.
async function dismissTitle(page) {
  if (!(await page.isVisible('#title-overlay'))) return;
  await page.click('#btn-title-new');
  const hidden = await tryWait(async () => !(await page.isVisible('#title-overlay')), 5000);
  if (!hidden) throw new Error('dismissTitle: title overlay still visible');
}

const TITLE_DISMISS_EXPR = `(function () {
  var t = document.getElementById('title-overlay');
  if (!t || t.classList.contains('hidden') || getComputedStyle(t).display === 'none') return false;
  var b = document.getElementById('btn-title-new');
  if (b) b.click();
  return !!b;
})()`;

module.exports = { POLL_MS, tryWait, waitUntil, waitFor, ensurePaused, dismissBurst, clickWhenClear, untilText, dismissTitle, TITLE_DISMISS_EXPR };