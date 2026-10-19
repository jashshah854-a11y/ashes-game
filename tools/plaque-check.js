'use strict';
// Ashes of Empires, Cycle 23 Step 5a, plaque system browser check.
// Proves: buildPlaques on the committed fixture matches expected counts,
// renderPlaques produces matching DOM counts, no digits in hollow plaques,
// both faction plaque types present, no page errors.
// Pattern from tools/fixture-check.js and tools/canvas-benchmark.js.
// Uses playwright-core from PLAYWRIGHT env var and Chromium from CHROME env var.
// Uses tools/browser-helper.js for waiting (no waitForTimeout, no local sleep).
// Exit 0 when every check passes, 1 on counted failures, 2 on harness errors.

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const Sim = require('../js/sim.js');
const Save = require('../js/save.js');
const playerView = require('../js/adapter.js');
const AshesPlaques = require('../js/plaques.js');
const H = require('./browser-helper.js');

const FIXTURE_PATH = path.join(REPO, 'tools', 'fixture', 'worst-case.json');

const PW = process.env.PLAYWRIGHT ||
  ['playwright', '/opt/node22/lib/node_modules/playwright'].find((p) => { try { require.resolve(p); return true; } catch (e) { return false; } });
const CHROME = process.env.CHROME ||
  ['/opt/pw-browsers/chromium', '/opt/meta-chromium/chrome'].find((p) => fs.existsSync(p));
const HARNESS_URL = 'file://' + path.join(REPO, 'tools', 'plaques.html');

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined && detail !== null ? ' | ' + detail : ''));
}

async function main() {
  // ---------- Node part: compute expectations from the fixture ----------
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  check('fixture reads back', readBack.ok === true, readBack.reason || '');

  if (!readBack.ok) {
    const failed = results.filter(function (ok) { return !ok; }).length;
    console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
    process.exit(1);
  }

  const s = readBack.state;
  const view = playerView(s);
  const descriptors = AshesPlaques.buildPlaques(view);

  // Compute expected counts from the view with the same grouping rules
  var liveUnitGroups = 0;
  var alarmGroups = 0;
  var flotillaPlaques = 0;
  var rememberedGroups = 0;
  var factoryMarks = 0;
  var fortMarks = 0;

  view.provinces.forEach(function (p) {
    if (p.intel === 'live') {
      var groups = {};
      if (p.units && p.units.length > 0) {
        p.units.forEach(function (u) {
          var key = u.nation + '|' + u.type;
          if (!groups[key]) {
            groups[key] = { outOfSupply: false };
          }
          if ((u.supplyPenalty || 0) > 0) {
            groups[key].outOfSupply = true;
          }
        });
      }
      liveUnitGroups += Object.keys(groups).length;
      Object.keys(groups).forEach(function (key) {
        if (groups[key].outOfSupply) alarmGroups++;
      });

      if (p.flotilla && typeof p.flotilla === 'string' && p.flotilla.length > 0) {
        flotillaPlaques++;
      }

      if ((p.factoryLevel || 0) > 0) factoryMarks++;
      if ((p.fortLevel || 0) > 0) fortMarks++;
    } else if (p.intel === 'remembered' && p.snapshot) {
      var snapGroups = {};
      if (p.snapshot.units && p.snapshot.units.length > 0) {
        p.snapshot.units.forEach(function (u) {
          var key = u.nation + '|' + u.type;
          if (!snapGroups[key]) {
            snapGroups[key] = true;
          }
        });
      }
      rememberedGroups += Object.keys(snapGroups).length;
    }
  });

  // Pin the measured fixture totals as literals
  const PINNED = {
    liveUnitGroups: 27,
    alarmGroups: 15,
    flotillaPlaques: 7,
    rememberedGroups: 3,
    factoryMarks: 46,
    fortMarks: 38
  };

  check('node: live unit groups', liveUnitGroups === PINNED.liveUnitGroups, liveUnitGroups + ' vs ' + PINNED.liveUnitGroups);
  check('node: alarm groups', alarmGroups === PINNED.alarmGroups, alarmGroups + ' vs ' + PINNED.alarmGroups);
  check('node: flotilla plaques', flotillaPlaques === PINNED.flotillaPlaques, flotillaPlaques + ' vs ' + PINNED.flotillaPlaques);
  check('node: remembered groups', rememberedGroups === PINNED.rememberedGroups, rememberedGroups + ' vs ' + PINNED.rememberedGroups);
  check('node: factory marks', factoryMarks === PINNED.factoryMarks, factoryMarks + ' vs ' + PINNED.factoryMarks);
  check('node: fort marks', fortMarks === PINNED.fortMarks, fortMarks + ' vs ' + PINNED.fortMarks);

  // Check descriptor counts match expectations
  const expectedUnitPlaques = PINNED.liveUnitGroups + PINNED.flotillaPlaques + PINNED.rememberedGroups;
  const expectedBuildingMarks = PINNED.factoryMarks + PINNED.fortMarks;

  check('node: unitPlaques array length', descriptors.unitPlaques.length === expectedUnitPlaques, descriptors.unitPlaques.length + ' vs ' + expectedUnitPlaques);
  check('node: buildingMarks array length', descriptors.buildingMarks.length === expectedBuildingMarks, descriptors.buildingMarks.length + ' vs ' + expectedBuildingMarks);

  // ---------- Browser part ----------
  if (!PW) throw new Error('Playwright not found; set PLAYWRIGHT to its path');
  if (!CHROME) throw new Error('no Chromium found; set CHROME to its path');

  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(HARNESS_URL);
    await H.waitFor(page, async () => {
      try {
        return await page.evaluate('typeof window.PLAQUE_PAGE !== "undefined"');
      } catch (e) {
        return false;
      }
    }, 10000);

    // Pass the view to PLAQUE_PAGE.setup in one evaluate argument
    const domCounts = await page.evaluate((viewArg) => {
      return window.PLAQUE_PAGE.setup(viewArg);
    }, view);

    // Now call counts() to get DOM measurements
    const counts = await page.evaluate(() => {
      return window.PLAQUE_PAGE.counts();
    });

    await page.close();

    // Assert DOM counts equal node expectations
    check('browser: unitPlaques count', counts.unitPlaques === expectedUnitPlaques, counts.unitPlaques + ' vs ' + expectedUnitPlaques);
    check('browser: hollowPlaques count', counts.hollowPlaques === PINNED.rememberedGroups, counts.hollowPlaques + ' vs ' + PINNED.rememberedGroups);
    // One numeral span per live unit group (flotilla and remembered plaques carry none); alarm marks are counted separately below.
    check('browser: numeralSpans count', counts.numeralSpans === PINNED.liveUnitGroups, counts.numeralSpans + ' vs ' + PINNED.liveUnitGroups);
    check('browser: alarmMarks count', counts.alarmMarks === PINNED.alarmGroups, counts.alarmMarks + ' vs ' + PINNED.alarmGroups);
    check('browser: buildingMarks count', counts.buildingMarks === expectedBuildingMarks, counts.buildingMarks + ' vs ' + expectedBuildingMarks);
    check('browser: factoryMarks count', counts.factoryMarks === PINNED.factoryMarks, counts.factoryMarks + ' vs ' + PINNED.factoryMarks);
    check('browser: fortMarks count', counts.fortMarks === PINNED.fortMarks, counts.fortMarks + ' vs ' + PINNED.fortMarks);

    // digitTextInHollow must be 0
    check('browser: digitTextInHollow is 0', counts.digitTextInHollow === 0, String(counts.digitTextInHollow));

    // At least one player plaque and one enemy plaque exist
    const hasPlayer = descriptors.unitPlaques.some(d => d.nation === 'player' && !d.hollow);
    const hasEnemy = descriptors.unitPlaques.some(d => d.nation !== 'player' && !d.hollow);
    check('browser: at least one player plaque exists', hasPlayer === true, '');
    check('browser: at least one enemy plaque exists', hasEnemy === true, '');

    // No page errors occurred
    check('browser: no page errors', errors.length === 0, errors.join('; ') || 'none');

  } finally {
    await browser.close();
  }

  const failed = results.filter(function (ok) { return !ok; }).length;
  console.log('FAILURES: ' + failed + ' / TOTAL: ' + results.length);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });