// Presentation guard tests for the Ashes of Empires read-only adapter.
// Run: node --test tests/presentation.test.js
//
// The Run 1 fence: the simulation sources stay byte identical to their
// pinned hashes, the adapter is the only way presentation reads the
// simulation, the adapter calls nothing that changes the game, and
// every generated asset file is admitted in the asset log.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const Sim = require('../js/sim.js');
const playerView = require('../js/adapter.js');
const AshesMapGeometry = require('../js/map-geometry.js');
const AshesMapCanvas = require('../js/map-canvas.js');
const assetCheck = require('../tools/check-asset-log.js');

const REPO_ROOT = path.join(__dirname, '..');
const FORBIDDEN_CALLS = [
  'tick', 'issueOrder', 'queueProduction', 'cancelProduction', 'assignLineTemplate',
  'buildFactory', 'buildFortification', 'buildRail', 'plantAgent', 'deployFlotilla',
  'reinforceUnit', 'researchDroneGen2', 'researchDroneGen3', 'researchJamming',
  'productionPhase', 'movementPhase', 'intelPhase', 'historyPhase', 'beatPhase'
];
const BANNED_PRESENTATION_STRINGS = [
  'shadowBlur', 'getImageData', 'fillText', 'ctx.filter',
  'createLinearGradient', 'createRadialGradient'
];

test('sim hash pin: js/sim.js, js/save.js and js/lore.js are byte identical to their pinned sha256 hashes', () => {
  const pinned = {
    'js/sim.js': '26a6aa1bc0d08d1aa35678dbcbdf75a340cab6cd8419382a9835bc1867ebbafb',
    'js/save.js': '9ccf9acfac2e3c7d822d67dd143e6cdab84d2d8fc34d312cec5abc0261aa9584',
    'js/lore.js': '6b623169faaf3b84429763081faa5cd97f7c389d433d0239aec315b1f83e8661'
  };
  Object.keys(pinned).forEach(rel => {
    const file = path.join(REPO_ROOT, rel);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.strictEqual(hash, pinned[rel], rel + ' must stay byte identical to its pinned hash');
  });
});

test('adapter shape: a fresh seed 42 game exposes 70 provinces with live and dark intel and 35 owned provinces', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);

  assert.strictEqual(view.day, 1);
  assert.strictEqual(view.gameOver, false);
  assert.strictEqual(view.winner, null);
  assert.strictEqual(view.viewer, 'player');

  // One entry per province, sorted by province id.
  assert.strictEqual(view.provinces.length, 70);
  assert.strictEqual(view.provinces.length, Object.keys(s.provinces).length);
  view.provinces.forEach((p, i) => {
    assert.strictEqual(p.id, Object.keys(s.provinces).sort()[i]);
    // Every entry always carries the geography fields.
    ['id', 'x', 'y', 'name', 'isCapital', 'coastal', 'intel', 'lastSeenDay'].forEach(k => {
      assert.ok(Object.prototype.hasOwnProperty.call(p, k), p.id + ' is missing ' + k);
    });
    assert.ok(['live', 'remembered', 'dark'].includes(p.intel), p.id + ' intel is ' + p.intel);
  });
  assert.ok(view.provinces.some(p => p.intel === 'live'), 'at least one live province');
  assert.ok(view.provinces.some(p => p.intel === 'dark'), 'at least one dark province');

  // Edges mirror the edge list as fresh objects with exactly four fields.
  assert.strictEqual(view.edges.length, s.edgeList.length);
  view.edges.forEach((e, i) => {
    assert.deepStrictEqual(Object.keys(e).sort(), ['a', 'b', 'railState', 'terrain']);
    assert.strictEqual(e.a, s.edgeList[i].a);
    assert.strictEqual(e.b, s.edgeList[i].b);
    assert.strictEqual(e.terrain, s.edgeList[i].terrain);
    assert.strictEqual(typeof e.railState, 'string');
    assert.ok(['none', 'built'].includes(e.railState) || e.railState.length > 0);
  });

  // ownNation carries exactly the 17 presentation fields.
  assert.deepStrictEqual(Object.keys(view.ownNation).sort(), [
    'agents', 'capitalId', 'droneGen2', 'droneGen3', 'equipment', 'factoryLevels',
    'flotillas', 'id', 'interceptors', 'jammingGen', 'manpower', 'name',
    'provincesOwned', 'researchPoints', 'score', 'short', 'steel'
  ]);
  assert.strictEqual(view.ownNation.id, 'player');
  assert.strictEqual(view.ownNation.capitalId, 'p0_3');
  assert.strictEqual(view.ownNation.provincesOwned, 35);
  assert.strictEqual(view.ownNation.provincesOwned,
    Object.keys(s.provinces).filter(id => s.provinces[id].owner === 'player').length);
  assert.strictEqual(view.ownNation.manpower, Sim.manpowerPool(s, 'player'));
  assert.strictEqual(view.ownNation.factoryLevels, Sim.factoryLevels(s, 'player'));
  assert.deepStrictEqual(view.ownNation.score, Sim.campaignScore(s, 'player'));
});

test('fog gating: dark provinces expose geography only and remembered provinces expose only their snapshot', () => {
  // A real tick records a day 1 snapshot for every live province; the
  // checker edit then pulls the player drone wings, so p6_3 keeps its
  // snapshot but falls out of sight and becomes remembered. Nothing
  // else about the staging changes what the adapter is allowed to show.
  const s = Sim.createGame(42);
  Sim.tick(s);
  s.units = s.units.filter(u => u.type !== 'drone');
  const view = playerView(s);

  let live = 0, remembered = 0, dark = 0;
  view.provinces.forEach(p => {
    if (p.intel === 'live') {
      live++;
      assert.ok(Object.prototype.hasOwnProperty.call(p, 'owner'), p.id + ' live has an owner');
      assert.ok(Object.prototype.hasOwnProperty.call(p, 'units'), p.id + ' live has units');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'snapshot'), p.id + ' live carries no snapshot');
    } else if (p.intel === 'remembered') {
      remembered++;
      assert.ok(p.snapshot && typeof p.snapshot === 'object', p.id + ' remembered has a snapshot');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'units'), p.id + ' remembered carries no units');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'owner'), p.id + ' remembered carries no owner');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'steel'), p.id + ' remembered carries no steel');
    } else {
      assert.strictEqual(p.intel, 'dark');
      dark++;
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'owner'), p.id + ' dark carries no owner');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'snapshot'), p.id + ' dark carries no snapshot');
      assert.ok(!Object.prototype.hasOwnProperty.call(p, 'units'), p.id + ' dark carries no units');
    }
  });
  assert.ok(live > 0, 'at least one live province');
  assert.ok(remembered > 0, 'at least one remembered province');
  assert.ok(dark > 0, 'at least one dark province');
});

test('read only by value: mutating the view never changes the state', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const before = JSON.stringify(s);

  view.day = 999;
  view.provinces.forEach(p => {
    if (Object.prototype.hasOwnProperty.call(p, 'owner')) p.owner = 'enemy';
    if (Object.prototype.hasOwnProperty.call(p, 'units')) {
      if (p.units.length > 0) p.units[0].strength = -50;
      p.units.push({ id: -1, nation: 'player', type: 'infantry', provinceId: p.id });
    }
    if (Object.prototype.hasOwnProperty.call(p, 'snapshot')) {
      p.snapshot.day = -1;
      p.snapshot.units.push({ nation: 'enemy', type: 'infantry', count: 99, totalStrength: 99 });
    }
  });
  view.ownNation.steel = 99999;
  view.ownNation.score.total = 99999;
  view.edges.push({ a: 'x', b: 'y', terrain: 'land', railState: 'none' });
  if (view.edges.length > 0) view.edges[0].railState = 'hacked';

  assert.strictEqual(JSON.stringify(s), before, 'the state must be untouched by view mutation');
});

test('read only by source: the adapter calls no mutator and assigns no state field', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'adapter.js'), 'utf8');
  FORBIDDEN_CALLS.forEach(name => {
    const re = new RegExp('(\\bSim\\.)?\\b' + name + '\\b\\s*\\(');
    assert.ok(!re.test(src), 'adapter must not call ' + name);
  });
  assert.ok(
    !/state\.[A-Za-z_$][A-Za-z0-9_$]*\s*=(?!=)/.test(src),
    'adapter must not assign to a state field'
  );
});

test('determinism: two views of the same state are deep equal and one tick advances the day by exactly one', () => {
  const s = Sim.createGame(42);
  const a = playerView(s);
  const b = playerView(s);
  assert.deepStrictEqual(b, a, 'two views of one untouched state are deep equal');

  const dayBefore = s.day;
  Sim.tick(s);
  const c = playerView(s);
  assert.strictEqual(c.day, dayBefore + 1, 'one tick advances the view day by exactly one');
});

test('lint: the adapter source contains no banned presentation strings', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'adapter.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'adapter must not contain ' + str);
  });
});

test('asset log check: the real repo passes, and a temp fixture fails once then passes after its log line', () => {
  const real = assetCheck.checkAssets(REPO_ROOT);
  assert.deepStrictEqual(real.failures, [], 'every asset file in the repo is admitted in the asset log');

  // A temp fixture with one fake png and an empty log dir must fail
  // exactly once, naming that file.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashes-asset-check-'));
  try {
    fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'assets', 'log'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'assets', 'foo.png'), 'not a real png');

    const first = assetCheck.checkAssets(tmp);
    assert.strictEqual(first.failures.length, 1, 'one unadmitted asset file');
    assert.strictEqual(first.failures[0], 'assets/foo.png');
    assert.strictEqual(first.counts.assetFiles, 1);

    // Admitting it in a log line makes the same fixture pass.
    fs.writeFileSync(
      path.join(tmp, 'assets', 'log', 'textures.jsonl'),
      JSON.stringify({ status: 'admitted', final: { file: 'assets/foo.png' } }) + '\n'
    );
    const second = assetCheck.checkAssets(tmp);
    assert.deepStrictEqual(second.failures, [], 'the admitted asset file now passes');
    assert.strictEqual(second.counts.admittedEntries, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('fixture: the committed worst case board reads back with its section 2.8.1 counts', () => {
  const Save = require('../js/save.js');
  const fixturePath = path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  const s = readBack.state;

  assert.ok(s.day >= 140, 'day at least 140, got ' + s.day);
  assert.strictEqual(s.gameOver, false, 'gameOver must be false');
  assert.strictEqual(Object.keys(s.provinces).length, 70, 'province count must be 70');

  let factoryTotal = 0;
  let factoryMin = Infinity;
  Object.keys(s.provinces).forEach(function (id) {
    const p = s.provinces[id];
    factoryTotal += p.factoryLevel;
    if (p.factoryLevel < factoryMin) factoryMin = p.factoryLevel;
  });
  assert.ok(factoryTotal >= 120, 'factoryTotal at least 120, got ' + factoryTotal);
  assert.ok(factoryMin >= 1, 'factoryMin at least 1, got ' + factoryMin);

  let railBuilt = 0;
  s.edgeList.forEach(function (e) {
    if (e.rail && !e.rail.converting && e.rail.daysLeft === 0) railBuilt++;
  });
  assert.ok(railBuilt >= 55, 'railBuilt at least 55, got ' + railBuilt);

  assert.ok(s.units.length >= 160, 'units at least 160, got ' + s.units.length);
  const damagedUnits = s.units.filter(function (u) { return u.strength < u.maxStrength; }).length;
  assert.ok(damagedUnits >= 40, 'damagedUnits at least 40, got ' + damagedUnits);

  var supply = {};
  ['player', 'enemy'].forEach(function (nation) {
    var per = Sim.computeSupply(s, nation) || {};
    Object.keys(per).forEach(function (id) { supply[id] = per[id]; });
  });
  const outOfSupplyUnits = s.units.filter(function (u) {
    var entry = supply[u.provinceId];
    return !entry || !entry.supplied;
  }).length;
  assert.ok(outOfSupplyUnits >= 30, 'outOfSupplyUnits at least 30, got ' + outOfSupplyUnits);

  const view = playerView(s);
  const viewRemembered = view.provinces.filter(function (p) { return p.intel === 'remembered'; });
  const viewDark = view.provinces.filter(function (p) { return p.intel === 'dark'; });
  const CORNER_IDS = ['p0_0', 'p9_0', 'p0_6', 'p9_6'];
  const rememberedCorner = viewRemembered.filter(function (p) { return CORNER_IDS.indexOf(p.id) !== -1; }).length;
  const darkCorner = viewDark.filter(function (p) { return CORNER_IDS.indexOf(p.id) !== -1; }).length;
  assert.ok(viewRemembered.length >= 8, 'remembered at least 8, got ' + viewRemembered.length);
  assert.ok(rememberedCorner >= 1, 'remembered corner at least 1, got ' + rememberedCorner);
  assert.ok(viewDark.length >= 12, 'dark at least 12, got ' + viewDark.length);
  assert.ok(darkCorner >= 1, 'dark corner at least 1, got ' + darkCorner);
});

// Plaque system tests (Cycle 23 Step 5a)
const AshesPlaques = require('../js/plaques.js');

test('plaque build: fixture view returns 27 live unit groups, 7 flotilla plaques, 3 remembered plaques (37 unitPlaques) and 84 buildingMarks (46 factory, 38 fort), with densest province p0_3 present', () => {
  const Save = require('../js/save.js');
  const fixturePath = path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  const s = readBack.state;
  const view = playerView(s);
  const descriptors = AshesPlaques.buildPlaques(view);

  assert.strictEqual(descriptors.unitPlaques.length, 37, 'unitPlaques length ' + descriptors.unitPlaques.length);
  assert.strictEqual(descriptors.buildingMarks.length, 84, 'buildingMarks length ' + descriptors.buildingMarks.length);

  const factoryMarks = descriptors.buildingMarks.filter(m => m.kind === 'factory').length;
  const fortMarks = descriptors.buildingMarks.filter(m => m.kind === 'fort').length;
  assert.strictEqual(factoryMarks, 46, 'factory marks ' + factoryMarks);
  assert.strictEqual(fortMarks, 38, 'fort marks ' + fortMarks);

  const densest = descriptors.unitPlaques.some(d => d.provinceId === 'p0_3' && d.intel === 'live');
  assert.ok(densest, 'densest province p0_3 present in live unitPlaques');
});

test('plaque build: every remembered plaque has numeral null, count null, totalStrength null and hollow true, and no dark province id appears in any descriptor', () => {
  const Save = require('../js/save.js');
  const fixturePath = path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  const s = readBack.state;
  const view = playerView(s);
  const descriptors = AshesPlaques.buildPlaques(view);

  descriptors.unitPlaques.forEach(d => {
    if (d.intel === 'remembered') {
      assert.strictEqual(d.numeral, null, 'remembered plaque numeral is null for ' + d.provinceId);
      assert.strictEqual(d.count, null, 'remembered plaque count is null for ' + d.provinceId);
      assert.strictEqual(d.totalStrength, null, 'remembered plaque totalStrength is null for ' + d.provinceId);
      assert.strictEqual(d.hollow, true, 'remembered plaque hollow is true for ' + d.provinceId);
    }
  });

  const darkIds = view.provinces.filter(p => p.intel === 'dark').map(p => p.id);
  const darkInDescriptors = descriptors.unitPlaques.some(d => darkIds.includes(d.provinceId)) ||
    descriptors.buildingMarks.some(m => darkIds.includes(m.provinceId));
  assert.strictEqual(darkInDescriptors, false, 'no dark province id appears in any descriptor');
});

test('plaque build: does not mutate the view and is deterministic', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const viewBefore = JSON.stringify(view);

  const a = AshesPlaques.buildPlaques(view);
  const viewAfterFirst = JSON.stringify(view);
  assert.strictEqual(viewAfterFirst, viewBefore, 'view unchanged after first buildPlaques call');

  const b = AshesPlaques.buildPlaques(view);
  const viewAfterSecond = JSON.stringify(view);
  assert.strictEqual(viewAfterSecond, viewBefore, 'view unchanged after second buildPlaques call');

  assert.deepStrictEqual(b, a, 'two calls to buildPlaques are deep equal');
});

test('plaque palette: grayscale split between playerFill and enemyFill is at least 50 levels (Rec 709 luma)', () => {
  function hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) throw new Error('bad hex ' + hex);
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  function luma(rgb) {
    // STRATEGY.md section 1.5: luma uses Rec 709 weights on the sRGB
    // values themselves, on the 0 to 255 scale.
    return Math.round(0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b);
  }
  const playerLuma = luma(hexToRgb(AshesPlaques.PALETTE.playerFill));
  const enemyLuma = luma(hexToRgb(AshesPlaques.PALETTE.enemyFill));
  const diff = Math.abs(playerLuma - enemyLuma);
  assert.ok(diff >= 50, 'luma diff ' + diff + ' (player ' + playerLuma + ', enemy ' + enemyLuma + ') must be >= 50');
});

test('plaque glyphs: exactly six keys, all SVG strings pairwise different, soldier drone ship pairwise different', () => {
  const keys = Object.keys(AshesPlaques.GLYPHS).sort();
  assert.deepStrictEqual(keys, ['alarm', 'drone', 'factory', 'fort', 'ship', 'soldier'], 'exactly six glyph keys');

  const values = Object.values(AshesPlaques.GLYPHS);
  const unique = new Set(values);
  assert.strictEqual(unique.size, values.length, 'all six SVG strings are pairwise different');

  assert.notStrictEqual(AshesPlaques.GLYPHS.soldier, AshesPlaques.GLYPHS.drone, 'soldier and drone differ');
  assert.notStrictEqual(AshesPlaques.GLYPHS.soldier, AshesPlaques.GLYPHS.ship, 'soldier and ship differ');
  assert.notStrictEqual(AshesPlaques.GLYPHS.drone, AshesPlaques.GLYPHS.ship, 'drone and ship differ');
});

test('plaque source lint: js/plaques.js contains no banned strings and no sim mutator calls', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'plaques.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'plaques.js must not contain ' + str);
  });
  FORBIDDEN_CALLS.forEach(name => {
    const re = new RegExp('(\\bSim\\.)?\\b' + name + '\\b\\s*\\(');
    assert.ok(!re.test(src), 'plaques.js must not call ' + name);
  });
  // Also verify no require of sim.js
  assert.ok(!/require\(['\"]\.\/sim\.js['\"]\)/.test(src), 'plaques.js must not require sim.js');
});

test('plaque build: fresh seed 42 game view returns 8 live unit groups and zero remembered plaques', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const descriptors = AshesPlaques.buildPlaques(view);

  const liveGroups = descriptors.unitPlaques.filter(d => d.intel === 'live').length;
  const rememberedGroups = descriptors.unitPlaques.filter(d => d.intel === 'remembered').length;
  assert.strictEqual(liveGroups, 8, 'live unit groups ' + liveGroups);
  assert.strictEqual(rememberedGroups, 0, 'remembered groups ' + rememberedGroups);
});

// Map geometry tests (Cycle 23 Step 6a)

test('map geometry: buildGeometry is deterministic and does not mutate the view (seed 42)', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const viewBefore = JSON.stringify(view);

  const geomA = AshesMapGeometry.buildGeometry(view);
  const viewAfterFirst = JSON.stringify(view);
  assert.strictEqual(viewAfterFirst, viewBefore, 'view unchanged after first buildGeometry call');

  const geomB = AshesMapGeometry.buildGeometry(view);
  const viewAfterSecond = JSON.stringify(view);
  assert.strictEqual(viewAfterSecond, viewBefore, 'view unchanged after second buildGeometry call');

  assert.deepStrictEqual(geomB, geomA, 'two calls to buildGeometry are deep equal');
});

test('map geometry: buildGeometry is deterministic and does not mutate the view (fixture worst-case)', () => {
  const Save = require('../js/save.js');
  const fixturePath = path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  const s = readBack.state;
  const view = playerView(s);
  const viewBefore = JSON.stringify(view);

  const geomA = AshesMapGeometry.buildGeometry(view);
  const viewAfterFirst = JSON.stringify(view);
  assert.strictEqual(viewAfterFirst, viewBefore, 'view unchanged after first buildGeometry call (fixture)');

  const geomB = AshesMapGeometry.buildGeometry(view);
  const viewAfterSecond = JSON.stringify(view);
  assert.strictEqual(viewAfterSecond, viewBefore, 'view unchanged after second buildGeometry call (fixture)');

  assert.deepStrictEqual(geomB, geomA, 'two calls to buildGeometry are deep equal (fixture)');
});

test('map geometry: topology - edge endpoints share exactly 2 polygon points matching view edge set', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  // Build set of view edge keys (sorted a|b).
  var viewEdgeKeys = new Set();
  view.edges.forEach(function (e) {
    var key = e.a < e.b ? e.a + '|' + e.b : e.b + '|' + e.a;
    viewEdgeKeys.add(key);
  });

  // Build set of province pairs sharing >= 2 identical polygon points.
  var sharedEdgeKeys = new Set();
  var provinces = geom.provinces;
  for (var i = 0; i < provinces.length; i++) {
    for (var j = i + 1; j < provinces.length; j++) {
      var pa = provinces[i];
      var pb = provinces[j];
      var shared = 0;
      for (var pi = 0; pi < pa.polygon.length; pi++) {
        for (var pj = 0; pj < pb.polygon.length; pj++) {
          if (pa.polygon[pi].x === pb.polygon[pj].x && pa.polygon[pi].y === pb.polygon[pj].y) {
            shared++;
          }
        }
      }
      if (shared >= 2) {
        var key = pa.id < pb.id ? pa.id + '|' + pb.id : pb.id + '|' + pa.id;
        sharedEdgeKeys.add(key);
      }
    }
  }

  // The two sets must be equal.
  assert.strictEqual(sharedEdgeKeys.size, viewEdgeKeys.size, 'shared edge count ' + sharedEdgeKeys.size + ' vs view edge count ' + viewEdgeKeys.size);
  sharedEdgeKeys.forEach(function (key) {
    assert.ok(viewEdgeKeys.has(key), 'shared edge ' + key + ' not in view edges');
  });
  viewEdgeKeys.forEach(function (key) {
    assert.ok(sharedEdgeKeys.has(key), 'view edge ' + key + ' not in shared edges');
  });
});

test('map geometry: river/rail/coast segment counts match view exactly, coast path points are in province polygon', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  // River segments: one per view edge with terrain === 'river'.
  var viewRivers = view.edges.filter(function (e) { return e.terrain === 'river'; }).length;
  assert.strictEqual(geom.riverSegments.length, viewRivers, 'riverSegments count ' + geom.riverSegments.length + ' vs view rivers ' + viewRivers);

  // Rail segments: one per view edge with railState !== 'none'.
  var viewRails = view.edges.filter(function (e) { return e.railState !== 'none'; }).length;
  assert.strictEqual(geom.railSegments.length, viewRails, 'railSegments count ' + geom.railSegments.length + ' vs view rails ' + viewRails);

  // Coast segments: one per coastal province.
  var viewCoastal = view.provinces.filter(function (p) { return p.coastal; }).length;
  assert.strictEqual(geom.coastSegments.length, viewCoastal, 'coastSegments count ' + geom.coastSegments.length + ' vs coastal provinces ' + viewCoastal);

  // Every coast segment's path points must appear in the province's polygon.
  geom.coastSegments.forEach(function (cs) {
    var province = geom.provinces.find(function (p) { return p.id === cs.provinceId; });
    assert.ok(province, 'coast segment province ' + cs.provinceId + ' found in geometry');
    cs.path.forEach(function (pt) {
      var found = province.polygon.some(function (pp) { return pp.x === pt.x && pp.y === pt.y; });
      assert.ok(found, 'coast segment point (' + pt.x + ',' + pt.y + ') not in polygon of ' + cs.provinceId);
    });
  });
});

test('map geometry: every edge path point appears in both endpoint province polygons', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  geom.edges.forEach(function (e) {
    var pa = geom.provinces.find(function (p) { return p.id === e.a; });
    var pb = geom.provinces.find(function (p) { return p.id === e.b; });
    assert.ok(pa, 'province ' + e.a + ' exists');
    assert.ok(pb, 'province ' + e.b + ' exists');
    e.path.forEach(function (pt) {
      var inA = pa.polygon.some(function (pp) { return pp.x === pt.x && pp.y === pt.y; });
      var inB = pb.polygon.some(function (pp) { return pp.x === pt.x && pp.y === pt.y; });
      assert.ok(inA, 'edge path point (' + pt.x + ',' + pt.y + ') not in polygon of ' + e.a);
      assert.ok(inB, 'edge path point (' + pt.x + ',' + pt.y + ') not in polygon of ' + e.b);
    });
  });
});

test('map geometry: corner displacement - at least 20 corners displaced >0.01, at least one coast corner >0.20', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  var displacedCount = 0;
  var coastDisplacedOver20 = 0;

  geom.provinces.forEach(function (p) {
    var poly = p.polygon;
    // Corners at polygon indices 0 (TL), 2 (TR), 4 (BR), 6 (BL).
    var cornerIndices = [0, 2, 4, 6];
    cornerIndices.forEach(function (idx) {
      var pt = poly[idx];
      // Infer lattice position from province x,y and corner index.
      var latticeX, latticeY;
      if (idx === 0) { latticeX = p.x; latticeY = p.y; } // TL
      else if (idx === 2) { latticeX = p.x + 1; latticeY = p.y; } // TR
      else if (idx === 4) { latticeX = p.x + 1; latticeY = p.y + 1; } // BR
      else { latticeX = p.x; latticeY = p.y + 1; } // BL

      var dx = Math.abs(pt.x - latticeX);
      var dy = Math.abs(pt.y - latticeY);
      var maxDisp = Math.max(dx, dy);
      if (maxDisp > 0.01) displacedCount++;
      // Check if this is a coast corner (province is coastal and corner is on coast edge).
      if (p.coastal) {
        var isCoastCorner = false;
        if (p.y === 0 && (idx === 0 || idx === 2)) isCoastCorner = true; // top coast
        if (p.y === geom.mapH - 1 && (idx === 4 || idx === 6)) isCoastCorner = true; // bottom coast
        if (isCoastCorner && maxDisp > 0.20) coastDisplacedOver20++;
      }
    });
  });

  assert.ok(displacedCount >= 20, 'at least 20 corners displaced >0.01, got ' + displacedCount);
  assert.ok(coastDisplacedOver20 >= 1, 'at least one coast corner displaced >0.20, got ' + coastDisplacedOver20);
});

test('map geometry: hitTest centres return own id (seed 42 and fixture), outside points null, sweep step 0.25 inside never null and within 1 cell', () => {
  // Seed 42
  var s = Sim.createGame(42);
  var view = playerView(s);
  var geom = AshesMapGeometry.buildGeometry(view);

  // Centres return own id.
  geom.provinces.forEach(function (p) {
    var hit = AshesMapGeometry.hitTest(geom, p.center.x, p.center.y);
    assert.strictEqual(hit, p.id, 'hitTest at center of ' + p.id + ' returns ' + hit);
  });

  // Outside points return null.
  assert.strictEqual(AshesMapGeometry.hitTest(geom, -1, 3), null, 'hitTest(-1,3) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom, 10, 3), null, 'hitTest(10,3) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom, 3, -1), null, 'hitTest(3,-1) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom, 3, 7), null, 'hitTest(3,7) is null');

  // Sweep step 0.25 inside board: never null, result within 1 cell of lattice candidate.
  for (var y = 0; y < geom.mapH; y += 0.25) {
    for (var x = 0; x < geom.mapW; x += 0.25) {
      var hit = AshesMapGeometry.hitTest(geom, x, y);
      assert.ok(hit !== null, 'hitTest(' + x + ',' + y + ') returned null inside board');
      var hp = geom.provinces.find(function (p) { return p.id === hit; });
      assert.ok(hp, 'hit province ' + hit + ' exists in geometry');
      // Lattice candidate.
      var gx = Math.floor(x);
      var gy = Math.floor(y);
      var candidateId = 'p' + gx + '_' + gy;
      // Result must be candidate or an edge neighbour of candidate.
      var isCandidateOrNeighbour = (hit === candidateId);
      if (!isCandidateOrNeighbour) {
        geom.edges.forEach(function (e) {
          if (e.a === candidateId && e.b === hit) isCandidateOrNeighbour = true;
          if (e.b === candidateId && e.a === hit) isCandidateOrNeighbour = true;
        });
      }
      assert.ok(isCandidateOrNeighbour, 'hitTest(' + x + ',' + y + ') = ' + hit + ' not candidate ' + candidateId + ' or its neighbour');
    }
  }

  // Fixture worst-case
  const Save = require('../js/save.js');
  const fixturePath = path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  const s2 = readBack.state;
  const view2 = playerView(s2);
  const geom2 = AshesMapGeometry.buildGeometry(view2);

  geom2.provinces.forEach(function (p) {
    var hit = AshesMapGeometry.hitTest(geom2, p.center.x, p.center.y);
    assert.strictEqual(hit, p.id, 'fixture: hitTest at center of ' + p.id + ' returns ' + hit);
  });

  assert.strictEqual(AshesMapGeometry.hitTest(geom2, -1, 3), null, 'fixture: hitTest(-1,3) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom2, 10, 3), null, 'fixture: hitTest(10,3) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom2, 3, -1), null, 'fixture: hitTest(3,-1) is null');
  assert.strictEqual(AshesMapGeometry.hitTest(geom2, 3, 7), null, 'fixture: hitTest(3,7) is null');

  for (var y2 = 0; y2 < geom2.mapH; y2 += 0.25) {
    for (var x2 = 0; x2 < geom2.mapW; x2 += 0.25) {
      var hit2 = AshesMapGeometry.hitTest(geom2, x2, y2);
      assert.ok(hit2 !== null, 'fixture: hitTest(' + x2 + ',' + y2 + ') returned null inside board');
      var hp2 = geom2.provinces.find(function (p) { return p.id === hit2; });
      assert.ok(hp2, 'fixture: hit province ' + hit2 + ' exists in geometry');
      var gx2 = Math.floor(x2);
      var gy2 = Math.floor(y2);
      var candidateId2 = 'p' + gx2 + '_' + gy2;
      var isCandidateOrNeighbour2 = (hit2 === candidateId2);
      if (!isCandidateOrNeighbour2) {
        geom2.edges.forEach(function (e) {
          if (e.a === candidateId2 && e.b === hit2) isCandidateOrNeighbour2 = true;
          if (e.b === candidateId2 && e.a === hit2) isCandidateOrNeighbour2 = true;
        });
      }
      assert.ok(isCandidateOrNeighbour2, 'fixture: hitTest(' + x2 + ',' + y2 + ') = ' + hit2 + ' not candidate ' + candidateId2 + ' or its neighbour');
    }
  }
});

test('map geometry: CELL_PX is 160 and board dimensions are 1600x1120', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  assert.strictEqual(AshesMapGeometry.CELL_PX, 160, 'CELL_PX is 160');
  assert.strictEqual(geom.cellPx, 160, 'geom.cellPx is 160');
  assert.strictEqual(geom.boardWidthPx, 1600, 'boardWidthPx is 1600');
  assert.strictEqual(geom.boardHeightPx, 1120, 'boardHeightPx is 1120');
  assert.strictEqual(geom.mapW, 10, 'mapW is 10');
  assert.strictEqual(geom.mapH, 7, 'mapH is 7');
});

test('map geometry: toPx converts cell coordinates to pixel coordinates', () => {
  assert.deepStrictEqual(AshesMapGeometry.toPx({ x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepStrictEqual(AshesMapGeometry.toPx({ x: 1, y: 0 }), { x: 160, y: 0 });
  assert.deepStrictEqual(AshesMapGeometry.toPx({ x: 0, y: 1 }), { x: 0, y: 160 });
  assert.deepStrictEqual(AshesMapGeometry.toPx({ x: 9, y: 6 }), { x: 1440, y: 960 });
});

test('map geometry source lint: js/map-geometry.js contains no banned strings, no sim require, no Math.random', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-geometry.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'map-geometry.js must not contain ' + str);
  });
  assert.ok(!/require\(['\"]\.\/sim\.js['\"]\)/.test(src), 'map-geometry.js must not require sim.js');
  assert.ok(!/Math\.random\(\)/.test(src), 'map-geometry.js must not use Math.random');
  // Also verify no Date usage
  assert.ok(!/new Date\(\)/.test(src), 'map-geometry.js must not use new Date()');
  assert.ok(!/Date\.now\(\)/.test(src), 'map-geometry.js must not use Date.now()');
  // Verify no em/en dashes
  assert.ok(!/[\u2013\u2014]/.test(src), 'map-geometry.js must not contain em or en dashes');
});

// Map canvas tests (Cycle 23 Step 6b)

test('map canvas: effectiveDpr caps at desktop and mobile limits', () => {
  assert.strictEqual(AshesMapCanvas.effectiveDpr(3, 1600), 2, 'dpr 3 at width 1600 capped to 2');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(3, 390), 1.5, 'dpr 3 at width 390 capped to 1.5');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(1, 1600), 1, 'dpr 1 at width 1600 stays 1');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(2, 1600), 2, 'dpr 2 at width 1600 stays 2');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(null, 1600), 1, 'null dpr defaults to 1');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(0, 1600), 1, 'dpr 0 treated as 1');
  assert.strictEqual(AshesMapCanvas.effectiveDpr(undefined, 1600), 1, 'undefined dpr defaults to 1');
});

test('map canvas: fitPixels under cap unchanged and over cap scales down', () => {
  // Under cap
  var under = AshesMapCanvas.fitPixels(1000, 1000);
  assert.strictEqual(under.width, 1000);
  assert.strictEqual(under.height, 1000);
  assert.strictEqual(under.scale, 1);

  // Over cap
  var over = AshesMapCanvas.fitPixels(5000, 5000);
  assert.ok(over.width * over.height <= AshesMapCanvas.PIXEL_CAP, 'scaled area under cap: ' + over.width * over.height);
  assert.ok(over.width < 5000 && over.height < 5000, 'dimensions reduced');
  assert.ok(over.scale < 1, 'scale reduced');

  // Min 1x1
  var tiny = AshesMapCanvas.fitPixels(10000, 10000);
  assert.ok(tiny.width >= 1 && tiny.height >= 1, 'min dimensions 1x1');
});

test('map canvas: buildDrawOps on seed 42 view and geometry', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildDrawOps(geom, view);

  // First op is sea
  assert.strictEqual(ops[0].kind, 'sea', 'first op is sea');

  // Polygon ops count equals geom.provinces.length (70)
  var polygonOps = ops.filter(function (op) { return op.kind === 'polygon'; });
  assert.strictEqual(polygonOps.length, geom.provinces.length, 'polygon ops count ' + polygonOps.length + ' vs provinces ' + geom.provinces.length);
  assert.strictEqual(geom.provinces.length, 70, 'provinces count is 70');

  // Coast/river/rail op counts equal geom segment lengths
  var coastOps = ops.filter(function (op) { return op.kind === 'coast'; });
  var riverOps = ops.filter(function (op) { return op.kind === 'river'; });
  var railOps = ops.filter(function (op) { return op.kind === 'rail'; });
  assert.strictEqual(coastOps.length, geom.coastSegments.length, 'coast ops ' + coastOps.length + ' vs coastSegments ' + geom.coastSegments.length);
  assert.strictEqual(riverOps.length, geom.riverSegments.length, 'river ops ' + riverOps.length + ' vs riverSegments ' + geom.riverSegments.length);
  assert.strictEqual(railOps.length, geom.railSegments.length, 'rail ops ' + railOps.length + ' vs railSegments ' + geom.railSegments.length);

  // Op order: polygons before segments
  var firstSegmentIdx = ops.findIndex(function (op) { return op.kind !== 'sea' && op.kind !== 'polygon'; });
  var lastPolygonIdx = ops.findLastIndex(function (op) { return op.kind === 'polygon'; });
  assert.ok(firstSegmentIdx > lastPolygonIdx, 'all polygons before any segment');
});

test('map canvas: drawOpsHash deterministic and changes when view changes', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops1 = AshesMapCanvas.buildDrawOps(geom, view);
  const hash1 = AshesMapCanvas.drawOpsHash(ops1);

  // Same view, same hash
  const ops2 = AshesMapCanvas.buildDrawOps(geom, view);
  const hash2 = AshesMapCanvas.drawOpsHash(ops2);
  assert.strictEqual(hash2, hash1, 'hash deterministic across builds');

  // Flip a railState in a copied view and rebuild geometry -> hash changes
  var viewCopy = JSON.parse(JSON.stringify(view));
  if (viewCopy.edges.length > 0) {
    viewCopy.edges[0].railState = viewCopy.edges[0].railState === 'built' ? 'building' : 'built';
  }
  var geomCopy = AshesMapGeometry.buildGeometry(viewCopy);
  var ops3 = AshesMapCanvas.buildDrawOps(geomCopy, viewCopy);
  var hash3 = AshesMapCanvas.drawOpsHash(ops3);
  assert.notStrictEqual(hash3, hash1, 'hash changes when railState flips');
  // Hash is 8 char hex
  assert.ok(/^[0-9a-f]{8}$/.test(hash1), 'hash is 8 char hex: ' + hash1);
});

test('map canvas source lint: js/map-canvas.js contains no banned strings, no sim require, no Math.random, no em/en dashes', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'map-canvas.js must not contain ' + str);
  });
  assert.ok(!/require\(['\"]\.\/sim\.js['\"]\)/.test(src), 'map-canvas.js must not require sim.js');
  assert.ok(!/Math\.random\(\)/.test(src), 'map-canvas.js must not use Math.random');
  assert.ok(!/new Date\(\)/.test(src), 'map-canvas.js must not use new Date()');
  assert.ok(!/Date\.now\(\)/.test(src), 'map-canvas.js must not use Date.now()');
  assert.ok(!/[\u2013\u2014]/.test(src), 'map-canvas.js must not contain em or en dashes');
});

// State layer tests (Cycle 23 Step 7a)

test('state ops: on fresh seed 42, band ops exist for both owners; every band op province has intel live; no band/front references remembered or dark; front count matches geometry edges with different known owners; band count matches independent computation', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildStateOps(geom, view);

  // Band ops exist for both owners
  var playerBands = ops.filter(function (op) { return op.kind === 'band' && op.owner === 'player'; });
  var enemyBands = ops.filter(function (op) { return op.kind === 'band' && op.owner === 'enemy'; });
  assert.ok(playerBands.length > 0, 'player band ops exist: ' + playerBands.length);
  assert.ok(enemyBands.length > 0, 'enemy band ops exist: ' + enemyBands.length);

  // Every band op's province has intel 'live' in the view
  var liveProvinceIds = view.provinces.filter(function (p) { return p.intel === 'live'; }).map(function (p) { return p.id; });
  ops.forEach(function (op) {
    if (op.kind === 'band') {
      assert.ok(liveProvinceIds.indexOf(op.provinceId) !== -1, 'band op province ' + op.provinceId + ' must have intel live');
    }
  });

  // No band or front op references a remembered or dark province
  var rememberedDarkIds = view.provinces.filter(function (p) { return p.intel === 'remembered' || p.intel === 'dark'; }).map(function (p) { return p.id; });
  ops.forEach(function (op) {
    if (op.kind === 'band') {
      assert.ok(rememberedDarkIds.indexOf(op.provinceId) === -1, 'band op must not reference remembered/dark province ' + op.provinceId);
    }
    if (op.kind === 'front') {
      assert.ok(rememberedDarkIds.indexOf(op.a) === -1, 'front op must not reference remembered/dark province ' + op.a);
      assert.ok(rememberedDarkIds.indexOf(op.b) === -1, 'front op must not reference remembered/dark province ' + op.b);
    }
  });

  // Front ops count equals number of geometry edges whose endpoints have different known owners
  var ownerLookup = {};
  view.provinces.forEach(function (p) {
    if (p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy')) {
      ownerLookup[p.id] = p.owner;
    }
  });
  var expectedFronts = 0;
  geom.edges.forEach(function (e) {
    var oa = ownerLookup[e.a];
    var ob = ownerLookup[e.b];
    if (oa && ob && oa !== ob) expectedFronts++;
  });
  var frontOps = ops.filter(function (op) { return op.kind === 'front'; });
  assert.strictEqual(frontOps.length, expectedFronts, 'front ops ' + frontOps.length + ' vs expected ' + expectedFronts);

  // Band ops on differing edges = 2 * front count + one-sided edges + boundary bands
  // Compute full expected band count independently
  var expectedBands = 0;
  // Interior edges
  geom.edges.forEach(function (e) {
    var oa = ownerLookup[e.a];
    var ob = ownerLookup[e.b];
    if (oa && ob && oa !== ob) {
      expectedBands += 2; // both sides
    } else if (oa && !ob) {
      expectedBands += 1; // only a
    } else if (!oa && ob) {
      expectedBands += 1; // only b
    }
  });
  var interiorBands = expectedBands;
  // Boundary sides, from the pre-jitter lattice cell only (Cycle 23 Step 7c):
  // one per side of a known-owner province that sits on the grid edge.
  var expectedBoundary = 0;
  geom.provinces.forEach(function (p) {
    if (!ownerLookup[p.id]) return;
    if (p.y === 0) expectedBoundary++;
    if (p.x === geom.mapW - 1) expectedBoundary++;
    if (p.y === geom.mapH - 1) expectedBoundary++;
    if (p.x === 0) expectedBoundary++;
  });
  expectedBands += expectedBoundary;

  var bandOps = ops.filter(function (op) { return op.kind === 'band'; });
  assert.strictEqual(bandOps.length, expectedBands, 'band ops ' + bandOps.length + ' vs expected ' + expectedBands);

  // Positive boundary assertion: the boundary bands implied by the built ops are present
  var builtBoundary = bandOps.length - interiorBands;
  assert.ok(builtBoundary > 0, 'boundary bands on seed 42 must be greater than 0: ' + builtBoundary);
  assert.strictEqual(builtBoundary, expectedBoundary, 'boundary bands ' + builtBoundary + ' vs lattice expected ' + expectedBoundary);
});

test('state ops: fill ops on fresh seed 42, one per live known-owner province, polygon matches geometry, none for remembered or dark (Cycle 23 Step 7c)', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildStateOps(geom, view);

  var viewById = {};
  view.provinces.forEach(function (p) { viewById[p.id] = p; });
  var geomById = {};
  geom.provinces.forEach(function (p) { geomById[p.id] = p; });

  var expectedFills = view.provinces.filter(function (p) {
    return p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy');
  }).length;
  var fillOps = ops.filter(function (op) { return op.kind === 'fill'; });
  assert.ok(expectedFills > 0, 'seed 42 has live known-owner provinces');
  assert.strictEqual(fillOps.length, expectedFills, 'fill ops ' + fillOps.length + ' vs expected ' + expectedFills);

  var seen = {};
  fillOps.forEach(function (op) {
    var vp = viewById[op.provinceId];
    assert.ok(vp, 'fill op province exists in view: ' + op.provinceId);
    assert.strictEqual(vp.intel, 'live', 'fill op province live: ' + op.provinceId);
    assert.strictEqual(op.owner, vp.owner, 'fill op owner matches view for ' + op.provinceId);
    assert.ok(op.owner === 'player' || op.owner === 'enemy', 'fill op owner known for ' + op.provinceId);
    assert.ok(!seen[op.provinceId], 'one fill op per province: ' + op.provinceId);
    seen[op.provinceId] = true;
    var flat = [];
    geomById[op.provinceId].polygon.forEach(function (pt) { flat.push(pt.x, pt.y); });
    assert.deepStrictEqual(op.polygon, flat, 'fill polygon equals flattened geometry polygon for ' + op.provinceId);
  });

  view.provinces.forEach(function (p) {
    if (p.intel === 'remembered' || p.intel === 'dark') {
      assert.ok(!seen[p.id], 'no fill op for remembered or dark province ' + p.id);
    }
  });

  // Fills sort ahead of every band and front so they draw underneath
  var lastFill = -1;
  var firstOther = ops.length;
  ops.forEach(function (op, idx) {
    if (op.kind === 'fill') lastFill = idx;
    else if (idx < firstOther) firstOther = idx;
  });
  assert.ok(lastFill < firstOther, 'fill ops precede band and front ops');
});

test('state ops: determinism - two buildStateOps calls produce identical hash; flipped owner produces different hash', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);

  const ops1 = AshesMapCanvas.buildStateOps(geom, view);
  const hash1 = AshesMapCanvas.stateOpsHash(ops1);

  const ops2 = AshesMapCanvas.buildStateOps(geom, view);
  const hash2 = AshesMapCanvas.stateOpsHash(ops2);
  assert.strictEqual(hash2, hash1, 'hash deterministic across builds');

  // Flip one province owner in a copied view
  var viewCopy = JSON.parse(JSON.stringify(view));
  // Find a live player province and make it enemy
  var livePlayer = viewCopy.provinces.find(function (p) { return p.intel === 'live' && p.owner === 'player'; });
  if (livePlayer) {
    livePlayer.owner = 'enemy';
  }
  var geomCopy = AshesMapGeometry.buildGeometry(viewCopy);
  var ops3 = AshesMapCanvas.buildStateOps(geomCopy, viewCopy);
  var hash3 = AshesMapCanvas.stateOpsHash(ops3);
  assert.notStrictEqual(hash3, hash1, 'hash changes when owner flips');
});

test('state ops: constants have correct values', () => {
  assert.strictEqual(AshesMapCanvas.BAND_WIDE_W, 16, 'BAND_WIDE_W');
  assert.strictEqual(AshesMapCanvas.BAND_MID_W, 9, 'BAND_MID_W');
  assert.strictEqual(AshesMapCanvas.BAND_CORE_W, 3, 'BAND_CORE_W');
  assert.strictEqual(AshesMapCanvas.BAND_WIDE_ALPHA, 0.12, 'BAND_WIDE_ALPHA');
  assert.strictEqual(AshesMapCanvas.BAND_MID_ALPHA, 0.18, 'BAND_MID_ALPHA');
  assert.strictEqual(AshesMapCanvas.FILL_ALPHA, 0.06, 'FILL_ALPHA');
  assert.strictEqual(AshesMapCanvas.FRONT_W, 4, 'FRONT_W');

  // Enemy bands have doubled true, player bands doubled false
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildStateOps(geom, view);
  var enemyBands = ops.filter(function (op) { return op.kind === 'band' && op.owner === 'enemy'; });
  var playerBands = ops.filter(function (op) { return op.kind === 'band' && op.owner === 'player'; });
  enemyBands.forEach(function (op) {
    assert.strictEqual(op.doubled, true, 'enemy band doubled true for ' + op.provinceId);
  });
  playerBands.forEach(function (op) {
    assert.strictEqual(op.doubled, false, 'player band doubled false for ' + op.provinceId);
  });
});

test('state ops source lint: js/map-canvas.js state functions contain no banned strings', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'map-canvas.js must not contain ' + str);
  });
});

// Fog layer tests (Cycle 23 Step 8)

function fogFixtureView() {
  const Save = require('../js/save.js');
  const fixtureText = fs.readFileSync(path.join(__dirname, '..', 'tools', 'fixture', 'worst-case.json'), 'utf8');
  const readBack = Save.deserializeSave(fixtureText);
  assert.strictEqual(readBack.ok, true, readBack.reason || 'deserialize failed');
  return playerView(readBack.state);
}

function fogIntelCount(view, intel) {
  return view.provinces.filter(function (p) { return p.intel === intel; }).length;
}

function hexLuma(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('fog ops: fresh seed 42 view emits no op for live provinces, one unknown op per dark province (27), zero remembered ops', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildFogOps(geom, view);
  const darkCount = fogIntelCount(view, 'dark');
  const intelById = {};
  view.provinces.forEach(function (p) { intelById[p.id] = p.intel; });
  assert.strictEqual(darkCount, 27, 'seed 42 has 27 dark provinces');
  assert.strictEqual(ops.filter(function (op) { return op.kind === 'unknown'; }).length, darkCount);
  assert.strictEqual(ops.filter(function (op) { return op.kind === 'remembered'; }).length, fogIntelCount(view, 'remembered'));
  assert.strictEqual(ops.filter(function (op) { return op.kind === 'remembered'; }).length, 0);
  ops.forEach(function (op) {
    assert.notStrictEqual(intelById[op.id], 'live', 'no fog op for live province ' + op.id);
    if (op.kind === 'unknown') assert.strictEqual(intelById[op.id], 'dark');
  });
  const ids = ops.map(function (op) { return op.id; });
  assert.deepStrictEqual(ids, ids.slice().sort(), 'ops sorted by province id');
});

test('fog ops: fixture view emits 9 remembered and 15 unknown ops, each remembered op carries its view snapshot owner', () => {
  const view = fogFixtureView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildFogOps(geom, view);
  const remembered = ops.filter(function (op) { return op.kind === 'remembered'; });
  const unknown = ops.filter(function (op) { return op.kind === 'unknown'; });
  assert.strictEqual(remembered.length, fogIntelCount(view, 'remembered'));
  assert.strictEqual(unknown.length, fogIntelCount(view, 'dark'));
  assert.strictEqual(remembered.length, 9);
  assert.strictEqual(unknown.length, 15);
  assert.strictEqual(ops.length, 24, 'no op for the 46 live provinces');
  const byId = {};
  view.provinces.forEach(function (p) { byId[p.id] = p; });
  remembered.forEach(function (op) {
    const vp = byId[op.id];
    assert.strictEqual(vp.intel, 'remembered');
    assert.strictEqual(op.snapshotOwner, vp.snapshot ? vp.snapshot.owner : null, 'snapshot owner for ' + op.id);
    assert.strictEqual(op.hatch, true);
  });
});

test('fog ops: deterministic, and flipping one province intel changes the hash', () => {
  const view = fogFixtureView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const a = AshesMapCanvas.buildFogOps(geom, view);
  const b = AshesMapCanvas.buildFogOps(geom, view);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(AshesMapCanvas.fogOpsHash(a), AshesMapCanvas.fogOpsHash(b));

  const cloned = JSON.parse(JSON.stringify(view));
  const target = cloned.provinces.find(function (p) { return p.intel === 'dark'; });
  target.intel = 'live';
  const flipped = AshesMapCanvas.buildFogOps(geom, cloned);
  assert.notStrictEqual(AshesMapCanvas.fogOpsHash(flipped), AshesMapCanvas.fogOpsHash(a));
  assert.strictEqual(flipped.length, a.length - 1);
});

test('fog palette: Unknown fill luma in band D (185 to 225), remembered fill in band C (120 to 175), at least 25 apart, mist cannot leave band D', () => {
  const unknownLuma = hexLuma(AshesMapCanvas.FOG_UNKNOWN_FILL);
  const rememberedLuma = hexLuma(AshesMapCanvas.FOG_REMEMBERED_FILL);
  const mistLuma = hexLuma(AshesMapCanvas.FOG_MIST);
  assert.ok(unknownLuma >= 185 && unknownLuma <= 225, 'unknown luma ' + unknownLuma.toFixed(1));
  assert.ok(rememberedLuma >= 120 && rememberedLuma <= 175, 'remembered luma ' + rememberedLuma.toFixed(1));
  assert.ok(unknownLuma - rememberedLuma >= 25, 'difference ' + (unknownLuma - rememberedLuma).toFixed(1));
  // Worst case: all 3 wisps and 1 puff stacked over one pixel of Unknown fill.
  assert.ok(mistLuma > unknownLuma, 'mist reads lighter than the fill');
  let worst = unknownLuma;
  for (let i = 0; i < 3; i++) worst += (mistLuma - worst) * AshesMapCanvas.FOG_WISP_ALPHA;
  worst += (mistLuma - worst) * AshesMapCanvas.FOG_PUFF_ALPHA;
  assert.ok(worst <= 225, 'worst case stacked mist luma ' + worst.toFixed(1));
  assert.ok(AshesMapCanvas.FOG_WISP_ALPHA <= 0.35 && AshesMapCanvas.FOG_PUFF_ALPHA <= 0.3);
});

test('fog ops: every unknown op has exactly 3 wisps and 4 puffs, all inside the board bounds (seed 42 and fixture)', () => {
  [playerView(Sim.createGame(42)), fogFixtureView()].forEach(function (view) {
    const geom = AshesMapGeometry.buildGeometry(view);
    const ops = AshesMapCanvas.buildFogOps(geom, view);
    ops.filter(function (op) { return op.kind === 'unknown'; }).forEach(function (op) {
      assert.strictEqual(op.wisps.length, 3, 'wisps for ' + op.id);
      assert.strictEqual(op.puffs.length, 4, 'puffs for ' + op.id);
      op.wisps.concat(op.puffs).forEach(function (pt) {
        assert.ok(pt.x >= 0 && pt.x <= geom.mapW && pt.y >= 0 && pt.y <= geom.mapH, op.id + ' point ' + pt.x + ',' + pt.y);
      });
    });
  });
});

test('fog ops: buildFogOps does not mutate the view or geometry', () => {
  const view = fogFixtureView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const viewBefore = JSON.stringify(view);
  const geomBefore = JSON.stringify(geom);
  AshesMapCanvas.buildFogOps(geom, view);
  assert.strictEqual(JSON.stringify(view), viewBefore);
  assert.strictEqual(JSON.stringify(geom), geomBefore);
});

// Live board plaques (Cycle 23 Step 9)

// A minimal stub DOM, just enough for AshesPlaques.renderPlaques: elements
// record className, dataset, style, children, innerHTML and textContent.
// renderPlaques reads the free global document, so the stub is installed on
// globalThis for the call and removed afterward.
function plaqueStubElement(tag) {
  return {
    tagName: tag,
    className: '',
    dataset: {},
    style: {},
    children: [],
    innerHTML: '',
    textContent: '',
    appendChild: function (child) { this.children.push(child); return child; }
  };
}

function renderPlaquesWithStub(view, opts) {
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const previous = globalThis.document;
  globalThis.document = { createElement: plaqueStubElement };
  try {
    const container = plaqueStubElement('div');
    if (opts === undefined) AshesPlaques.renderPlaques(container, view);
    else AshesPlaques.renderPlaques(container, view, opts);
    return container;
  } finally {
    if (hadDocument) globalThis.document = previous;
    else delete globalThis.document;
  }
}

test('plaque render: { buildings: false } on the fixture view renders unit plaques only, zero building-mark elements, and plaqueCount equals the rendered count', () => {
  const view = fogFixtureView();
  const descriptors = AshesPlaques.buildPlaques(view);
  const container = renderPlaquesWithStub(view, { buildings: false });
  assert.strictEqual(container.children.length, 1, 'one plaque-layer appended');
  const layer = container.children[0];
  assert.strictEqual(layer.className, 'plaque-layer');
  const marks = layer.children.filter(c => c.className.indexOf('building-mark') !== -1).length;
  const plaques = layer.children.filter(c => /(^| )plaque( |$)/.test(c.className)).length;
  assert.strictEqual(marks, 0, 'building-mark elements ' + marks);
  assert.strictEqual(plaques, descriptors.unitPlaques.length, 'plaque elements ' + plaques);
  assert.strictEqual(layer.children.length, descriptors.unitPlaques.length);
  assert.strictEqual(container.dataset.plaqueCount, String(layer.children.length));
});

test('plaque render: with no opts the fixture view still renders unit plaques plus every building mark, and plaqueCount counts both', () => {
  const view = fogFixtureView();
  const descriptors = AshesPlaques.buildPlaques(view);
  const container = renderPlaquesWithStub(view);
  const layer = container.children[0];
  const marks = layer.children.filter(c => c.className.indexOf('building-mark') !== -1).length;
  assert.strictEqual(marks, descriptors.buildingMarks.length, 'building-mark elements ' + marks);
  assert.strictEqual(layer.children.length, descriptors.unitPlaques.length + descriptors.buildingMarks.length);
  assert.strictEqual(container.dataset.plaqueCount, String(descriptors.unitPlaques.length + descriptors.buildingMarks.length));
});

test('plaque render: every hollow plaque rendered from the fixture carries no numeral and no digit', () => {
  const view = fogFixtureView();
  const layer = renderPlaquesWithStub(view, { buildings: false }).children[0];
  const hollow = layer.children.filter(c => c.className.indexOf('plaque-hollow') !== -1);
  assert.ok(hollow.length > 0, 'fixture has hollow plaques');
  hollow.forEach(function (el) {
    assert.ok(!el.children.some(c => c.className === 'numeral'), 'hollow plaque at ' + el.dataset.province + ' has a numeral');
    el.children.forEach(function (c) { assert.ok(!/[0-9]/.test(c.textContent), 'digit in hollow plaque at ' + el.dataset.province); });
  });
});

test('live board source pin: js/main.js generates no unit-chip markup and no ghostChips, and renders plaques without building marks', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  assert.ok(src.indexOf('unit-chip') === -1, 'main.js must not generate unit-chip markup');
  assert.ok(src.indexOf('ghostChips') === -1, 'main.js must not reference ghostChips');
  assert.ok(/AshesPlaques\.renderPlaques\(el\.mapBoard, view, \{ buildings: false \}\)/.test(src), 'main.js renders plaques with buildings false');
  assert.ok(src.indexOf('AshesPlaqueDebug') !== -1, 'main.js maintains AshesPlaqueDebug');
  assert.ok(src.indexOf('plaque-selected') !== -1, 'main.js marks the selected plaque');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'main.js must not contain ' + str);
  });
});

test('live board source pin: index.html loads css/plaques.css and js/plaques.js after adapter.js and before main.js, and no longer describes chips', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('<link rel="stylesheet" href="css/plaques.css">') !== -1, 'index.html links css/plaques.css');
  const adapterAt = html.indexOf('<script src="js/adapter.js"></script>');
  const plaquesAt = html.indexOf('<script src="js/plaques.js"></script>');
  const mainAt = html.indexOf('<script src="js/main.js"></script>');
  assert.ok(adapterAt !== -1 && plaquesAt !== -1 && mainAt !== -1, 'scripts present');
  assert.ok(adapterAt < plaquesAt && plaquesAt < mainAt, 'plaques.js loads after adapter.js and before main.js');
  assert.ok(!/\bchips?\b/i.test(html), 'index.html must not describe unit chips');
  assert.ok(html.indexOf('2x24') !== -1 && html.indexOf('hollow dashed plaque') !== -1 && html.indexOf('yellow alarm mark') !== -1, 'legend explains plaques');
});
