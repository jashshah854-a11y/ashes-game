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

  // River/rail op counts equal geom segment lengths.
  // Changed in Cycle 23 Step 12a: the old light blue coast ops are retired
  // (the chart coastline is the only coast line), so the pin is now zero
  // coast ops instead of one per geom.coastSegments entry.
  var coastOps = ops.filter(function (op) { return op.kind === 'coast'; });
  var riverOps = ops.filter(function (op) { return op.kind === 'river'; });
  var railOps = ops.filter(function (op) { return op.kind === 'rail'; });
  assert.strictEqual(coastOps.length, 0, 'no coast ops after Step 12a: ' + coastOps.length);
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
  // Changed in Cycle 23 Step 12a: boundary bands come from the chart boundary
  // segments (one per segment of a known-owner province, sea and inland), not
  // from one lattice side per boundary cell, so the expectation is recomputed
  // from chart.boundarySegments with the view derived owner lookup above.
  const chart = require('../js/map-chart.js').buildChart(geom);
  var expectedBoundary = chart.boundarySegments.filter(function (seg) { return !!ownerLookup[seg.provinceId]; }).length;
  expectedBands += expectedBoundary;

  var bandOps = ops.filter(function (op) { return op.kind === 'band'; });
  assert.strictEqual(bandOps.length, expectedBands, 'band ops ' + bandOps.length + ' vs expected ' + expectedBands);

  // Positive boundary assertion: the boundary bands implied by the built ops are present
  var builtBoundary = bandOps.length - interiorBands;
  assert.ok(builtBoundary > 0, 'boundary bands on seed 42 must be greater than 0: ' + builtBoundary);
  assert.strictEqual(builtBoundary, expectedBoundary, 'boundary bands ' + builtBoundary + ' vs chart expected ' + expectedBoundary);
});

test('state ops: fill ops on fresh seed 42, one per live known-owner province, polygon matches geometry, none for remembered or dark (Cycle 23 Step 7c)', () => {
  const s = Sim.createGame(42);
  const view = playerView(s);
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildStateOps(geom, view);
  const fillChart = require('../js/map-chart.js').buildChart(geom);

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
    // Changed in Cycle 23 Step 12a: the political wash fills the hit polygon
    // (MAP_TREATMENT 5.3 item 2), so the fill polygon is the flattened chart
    // hit polygon, not the lattice polygon.
    assert.ok(geomById[op.provinceId], 'fill op province exists in geometry: ' + op.provinceId);
    var flat = [];
    fillChart.hitPolygons[op.provinceId].forEach(function (pt) { flat.push(pt.x, pt.y); });
    assert.deepStrictEqual(op.polygon, flat, 'fill polygon equals flattened hit polygon for ' + op.provinceId);
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

test('fog palette: chart fog (MAP_TREATMENT 6, C6): Unknown fill in band D, CHART_FADED wash at 0.65 lands in band C over sea and land and stays translucent', () => {
  const C = require('../js/map-chart.js').CHART_CONSTANTS;
  const unknownLuma = hexLuma(AshesMapCanvas.FOG_UNKNOWN_FILL);
  assert.strictEqual(AshesMapCanvas.FOG_UNKNOWN_FILL, '#DCCDA8', 'Unknown fill keeps its value');
  assert.ok(unknownLuma >= 185 && unknownLuma <= 225, 'unknown luma ' + unknownLuma.toFixed(1));
  assert.strictEqual(AshesMapCanvas.FOG_REMEMBERED_FILL, '#C2AE86', 'remembered fill is CHART_FADED');
  const fadedLuma = hexLuma(AshesMapCanvas.FOG_REMEMBERED_FILL);
  assert.ok(Math.abs(fadedLuma - 175.3) < 0.1, 'CHART_FADED luma ' + fadedLuma.toFixed(2));
  assert.strictEqual(AshesMapCanvas.FOG_REMEMBERED_ALPHA, 0.65);
  assert.ok(Math.abs(hexLuma(C.SEA_DEEP) - 85.0) < 0.1, 'SEA_DEEP luma ' + hexLuma(C.SEA_DEEP).toFixed(2));
  assert.ok(Math.abs(hexLuma(C.LAND_LOW) - 125.5) < 0.1, 'LAND_LOW luma ' + hexLuma(C.LAND_LOW).toFixed(2));
  const a = AshesMapCanvas.FOG_REMEMBERED_ALPHA;
  const overSea = a * fadedLuma + (1 - a) * hexLuma(C.SEA_DEEP);
  const overLand = a * fadedLuma + (1 - a) * hexLuma(C.LAND_LOW);
  assert.ok(overSea >= 120 && overSea <= 175, 'wash over SEA_DEEP ' + overSea.toFixed(1));
  assert.ok(Math.abs(overSea - 144) < 1, 'about 144 over open sea, got ' + overSea.toFixed(1));
  assert.ok(overLand >= 120 && overLand <= 175, 'wash over LAND_LOW ' + overLand.toFixed(1));
  assert.ok(overLand - overSea > 10, 'the composite follows the ground, so the wash is translucent, not opaque gray');
  assert.ok(unknownLuma - overLand >= 25 && unknownLuma - overSea >= 25, 'Unknown stays the lightest state by at least 25');
});

test('fog ops: unknown ops carry the 6.3 ink redraw, no wisps or puffs; coastal provinces get 3 water lines in their sea sectors (seed 42 and fixture)', () => {
  const AC = require('../js/map-chart.js');
  [playerView(Sim.createGame(42)), fogFixtureView()].forEach(function (view, vi) {
    const geom = AshesMapGeometry.buildGeometry(view);
    const chart = AC.buildChart(geom);
    const ext = chart.extent;
    const ops = AshesMapCanvas.buildFogOps(geom, view);
    let coastal = 0;
    ops.filter(function (op) { return op.kind === 'unknown'; }).forEach(function (op) {
      assert.ok(!('wisps' in op) && !('puffs' in op), 'no wisps or puffs on ' + op.id);
      const sectors = chart.sectors.filter(function (s) { return s.sea && s.provinceId === op.id; });
      if (sectors.length) {
        coastal++;
        assert.ok(op.coastPaths.length > 0, 'coast paths for coastal ' + op.id);
        assert.strictEqual(op.waterLines.length, 3, 'three water lines for ' + op.id);
        const chains = op.coastPaths.map(function (c) {
          const pts = [];
          for (let i = 0; i < c.length; i += 2) pts.push({ x: c[i], y: c[i + 1] });
          return pts;
        });
        op.waterLines.forEach(function (w, k) {
          assert.ok(w.length >= 4, op.id + ' water line ' + k + ' has points');
          for (let i = 0; i < w.length; i += 2) {
            const p = { x: w[i], y: w[i + 1] };
            assert.ok(sectors.some(function (s) { return AC.pointInPolygon(p, s.seaPart); }), op.id + ' water point inside a sea sector');
            let best = Infinity;
            chains.forEach(function (ch) {
              for (let j = 0; j + 1 < ch.length; j++) best = Math.min(best, step9DistToSeg(p, ch[j], ch[j + 1]));
            });
            assert.ok(best <= 0.30, op.id + ' water point within 0.30 of the coast, got ' + best.toFixed(3));
          }
        });
      } else {
        assert.deepStrictEqual(op.coastPaths, [], 'inland ' + op.id + ' has no coast');
        assert.deepStrictEqual(op.waterLines, [], 'inland ' + op.id + ' has no water lines');
      }
      op.riverPaths.concat(op.borderPaths).forEach(function (ln) {
        for (let i = 0; i < ln.length; i += 2) {
          assert.ok(ln[i] >= ext.x0 && ln[i] <= ext.x1 && ln[i + 1] >= ext.y0 && ln[i + 1] <= ext.y1, op.id + ' path point inside the chart extent');
        }
      });
    });
    if (vi === 0) assert.ok(coastal > 0, 'seed 42 has a dark coastal province');
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

// Chart, sea, and coast tests (Cycle 23 Step 9)

const AshesChart = require('../js/map-chart.js');

function step9Chart(seed) {
  const view = playerView(Sim.createGame(seed));
  const geom = AshesMapGeometry.buildGeometry(view);
  return { view: view, geom: geom, chart: AshesChart.buildChart(geom) };
}

function step9DistToSeg(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}

function step9DistToPolygon(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, step9DistToSeg(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return best;
}

function step9InsideOrOn(p, poly) {
  return AshesChart.pointInPolygon(p, poly) || step9DistToPolygon(p, poly) <= 1e-9;
}

function step9Mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function step9ChainMid(chart, seg) {
  const idx = Math.floor((seg.coastStart + seg.coastEnd) / 2);
  return chart.coastline[idx];
}

test('chart source lint: js/map-chart.js contains no banned strings, no sim require, no Math.random, no Date, no em/en dashes', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-chart.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'map-chart.js must not contain ' + str);
  });
  assert.ok(!/require\(['\"]\.\/sim\.js['\"]\)/.test(src), 'map-chart.js must not require sim.js');
  assert.ok(!/Math\.random\(\)/.test(src), 'map-chart.js must not use Math.random');
  assert.ok(!/new Date\(\)/.test(src), 'map-chart.js must not use new Date()');
  assert.ok(!/Date\.now\(\)/.test(src), 'map-chart.js must not use Date.now()');
  assert.ok(!/[\u2013\u2014]/.test(src), 'map-chart.js must not contain em or en dashes');
});

test('chart M-COAST: sea segments sit exactly on coastal provinces, every coastal province has one', () => {
  const { geom, chart } = step9Chart(42);
  const coastalById = {};
  geom.provinces.forEach(p => { coastalById[p.id] = !!p.coastal; });
  assert.strictEqual(chart.boundarySegments.length, 2 * 2 * (geom.mapW + geom.mapH), 'two segments per boundary cell side');
  const withSea = {};
  chart.boundarySegments.forEach(seg => {
    assert.strictEqual(seg.sea, coastalById[seg.provinceId], seg.key + ' sea flag equals province coastal flag');
    assert.strictEqual(seg.coastal, coastalById[seg.provinceId], seg.key + ' coastal flag');
    if (seg.sea) withSea[seg.provinceId] = true;
  });
  Object.keys(withSea).forEach(id => assert.strictEqual(coastalById[id], true, id + ' has a sea segment so must be coastal'));
  const inlandCoastal = geom.provinces.filter(p => p.coastal && !withSea[p.id]).map(p => p.id);
  assert.deepStrictEqual(inlandCoastal, [], 'every coastal province has at least one sea segment');
});

test('chart M-BOUNDS: every coastline point lies at least 0.06 outside the lattice and 0.20 inside the neatline; every polygon point lies inside the coast', () => {
  const { geom, chart } = step9Chart(42);
  const W = geom.mapW;
  const H = geom.mapH;
  const n = chart.neatline;
  assert.ok(chart.coastline.length > 400, 'coastline points ' + chart.coastline.length);
  chart.coastline.forEach((q, i) => {
    const outside = Math.max(-q.y, q.y - H, -q.x, q.x - W);
    assert.ok(outside >= 0.06, 'coast point ' + i + ' outside the lattice by ' + outside.toFixed(4));
    assert.ok(q.x >= n.x0 + 0.20 && q.x <= n.x1 - 0.20 && q.y >= n.y0 + 0.20 && q.y <= n.y1 - 0.20,
      'coast point ' + i + ' at ' + q.x.toFixed(3) + ',' + q.y.toFixed(3) + ' within 0.20 of the neatline');
  });
  geom.provinces.forEach(p => p.polygon.forEach((q, i) => {
    assert.ok(AshesChart.pointInPolygon(q, chart.coastline), p.id + ' point ' + i + ' lies inside the coastline');
  }));
  // Frame values for the standard map.
  assert.deepStrictEqual(chart.extent, { x0: -1.3, y0: -1.3, x1: 11.3, y1: 8.55 });
  assert.deepStrictEqual(chart.neatline, { x0: -1, y0: -1, x1: 11, y1: 8 });
  assert.ok(Math.abs(chart.widthCells - 12.6) < 1e-9 && Math.abs(chart.heightCells - 9.85) < 1e-9, 'chart size 12.6 by 9.85');
  assert.ok(Math.abs(chart.insetX - 1.3) < 1e-9 && Math.abs(chart.insetTop - 1.3) < 1e-9 && Math.abs(chart.insetBottom - 1.55) < 1e-9, 'insets');
});

test('chart M-CONTAIN: every original polygon vertex and edge midpoint lies inside or on its hit polygon', () => {
  const { geom, chart } = step9Chart(42);
  geom.provinces.forEach(p => {
    const hit = chart.hitPolygons[p.id];
    assert.ok(hit && hit.length >= p.polygon.length, p.id + ' has a hit polygon');
    p.polygon.forEach((q, i) => {
      assert.ok(step9InsideOrOn(q, hit), p.id + ' vertex ' + i + ' inside or on its hit polygon');
      const m = step9Mid(q, p.polygon[(i + 1) % p.polygon.length]);
      assert.ok(step9InsideOrOn(m, hit), p.id + ' edge ' + i + ' midpoint inside or on its hit polygon');
    });
    if (!p.coastal) assert.deepStrictEqual(hit, p.polygon.map(q => ({ x: q.x, y: q.y })), p.id + ' inland hit polygon is its polygon');
  });
  // Bottom and left sides: polygon order matches perimeter order, so each
  // sea chain starts nearer p1 than p2.
  chart.boundarySegments.forEach(seg => {
    if (!seg.sea) return;
    const first = chart.coastline[seg.coastStart];
    const last = chart.coastline[seg.coastEnd];
    const along = (seg.side === 'top' || seg.side === 'bottom') ? 'x' : 'y';
    const dirSeg = Math.sign(seg.p2[along] - seg.p1[along]);
    const dirChain = Math.sign(last[along] - first[along]);
    if (dirSeg !== 0) assert.strictEqual(dirChain, dirSeg, seg.key + ' chain runs in polygon order');
  });
});

test('chart M-ADJ: sim adjacencies keep their shared boundary and hit polygons create no false adjacency', () => {
  const { view, geom, chart } = step9Chart(42);
  const adj = {};
  view.edges.forEach(e => { adj[e.a + '|' + e.b] = true; adj[e.b + '|' + e.a] = true; });
  function has(poly, q) { return poly.some(r => r.x === q.x && r.y === q.y); }
  geom.edges.forEach(e => {
    assert.strictEqual(e.path.length, 3, 'edge path has 3 points');
    [e.path[0], e.path[2]].forEach(q => {
      assert.ok(has(chart.hitPolygons[e.a], q), e.a + ' hit polygon keeps shared point with ' + e.b);
      assert.ok(has(chart.hitPolygons[e.b], q), e.b + ' hit polygon keeps shared point with ' + e.a);
    });
  });
  const ids = geom.provinces.map(p => p.id);
  const boxes = {};
  ids.forEach(id => {
    const poly = chart.hitPolygons[id];
    boxes[id] = {
      x0: Math.min.apply(null, poly.map(q => q.x)), x1: Math.max.apply(null, poly.map(q => q.x)),
      y0: Math.min.apply(null, poly.map(q => q.y)), y1: Math.max.apply(null, poly.map(q => q.y))
    };
  });
  let checked = 0;
  ids.forEach(a => ids.forEach(b => {
    if (a === b || adj[a + '|' + b]) return;
    const bb = boxes[b];
    const polyB = chart.hitPolygons[b];
    chart.hitPolygons[a].forEach(q => {
      if (q.x < bb.x0 || q.x > bb.x1 || q.y < bb.y0 || q.y > bb.y1) return;
      checked++;
      const strictlyInside = AshesChart.pointInPolygon(q, polyB) && step9DistToPolygon(q, polyB) > 1e-9;
      assert.ok(!strictlyInside, a + ' vertex ' + q.x.toFixed(4) + ',' + q.y.toFixed(4) + ' strictly inside non adjacent ' + b);
    });
  }));
  assert.ok(checked > 0, 'some vertices were bbox candidates');
});

test('chart M-HIT: 10000 lattice points agree with geometry hitTest; aprons hit their province; sea, border, and beyond land miss', () => {
  const { geom, chart } = step9Chart(42);
  const rng = AshesChart.mulberry32(0x5eed09);
  for (let i = 0; i < 10000; i++) {
    const x = rng() * geom.mapW;
    const y = rng() * geom.mapH;
    assert.strictEqual(AshesChart.hitTest(chart, x, y), AshesMapGeometry.hitTest(geom, x, y), 'point ' + x + ',' + y);
  }
  let seaChecked = 0;
  chart.boundarySegments.forEach(seg => {
    const probe = step9Mid(step9Mid(seg.p1, seg.p2), step9ChainMid(chart, seg));
    if (seg.sea) {
      assert.strictEqual(AshesChart.hitTest(chart, probe.x, probe.y), seg.provinceId, seg.key + ' apron probe ' + probe.x.toFixed(3) + ',' + probe.y.toFixed(3));
      seaChecked++;
    }
  });
  assert.ok(seaChecked > 0, 'sea segments probed');
  assert.strictEqual(AshesChart.hitTest(chart, -0.9, -0.9), null, 'neatline corner is sea');
  assert.strictEqual(AshesChart.hitTest(chart, 5.0, -1.15), null, 'border strip misses');
  const inland = chart.boundarySegments.find(seg => !seg.sea && seg.side === 'left');
  assert.ok(inland, 'a west inland segment exists');
  const beyond = step9Mid(step9Mid(inland.p1, inland.p2), step9ChainMid(chart, inland));
  assert.strictEqual(AshesChart.hitTest(chart, beyond.x, beyond.y), null, inland.key + ' beyond land probe misses');
  // Open sea north of the coast misses (the browser sea click point).
  assert.strictEqual(AshesChart.hitTest(chart, 5.0, -0.88), null, 'open sea at 5.0,-0.88 misses');
  // Apron of p0_0 at 0.5,-0.25 hits p0_0 (the browser apron click point).
  assert.strictEqual(AshesChart.hitTest(chart, 0.5, -0.25), 'p0_0', 'apron at 0.5,-0.25 hits p0_0');
});

test('chart determinism: chartSeed and coastline are stable, and geometry does not vary by sim seed (M1)', () => {
  const a = step9Chart(42);
  const again = AshesChart.buildChart(a.geom);
  assert.strictEqual(again.chartSeed, a.chart.chartSeed, 'same geometry, same chartSeed');
  assert.deepStrictEqual(again.coastline, a.chart.coastline, 'same geometry, same coastline');
  assert.deepStrictEqual(again.waves, a.chart.waves, 'same geometry, same waves');
  const b = step9Chart(7);
  assert.strictEqual(b.chart.chartSeed, a.chart.chartSeed, 'seed 7 geometry gives the same chartSeed as seed 42');
  assert.ok(Number.isInteger(a.chart.chartSeed) && a.chart.chartSeed >= 0 && a.chart.chartSeed <= 0xffffffff, 'chartSeed is unsigned 32 bit');
});

test('chart edges: extended edge paths end on a coastline point and otherwise equal the geometry path', () => {
  const { geom, chart } = step9Chart(42);
  const coastKeys = new Set(chart.coastline.map(q => q.x.toFixed(4) + ',' + q.y.toFixed(4)));
  assert.strictEqual(chart.chartEdges.length, geom.edges.length, 'aligned with geom.edges');
  let extended = 0;
  chart.chartEdges.forEach((ce, i) => {
    const orig = geom.edges[i].path.map(q => ({ x: q.x, y: q.y }));
    assert.strictEqual(ce.a, geom.edges[i].a);
    assert.strictEqual(ce.b, geom.edges[i].b);
    if (!ce.extended) {
      assert.deepStrictEqual(ce.path, orig, 'unextended edge ' + i + ' keeps its path');
      return;
    }
    extended++;
    let path = ce.path.slice();
    const k = q => q.x.toFixed(4) + ',' + q.y.toFixed(4);
    const startExt = path.length > orig.length && coastKeys.has(k(path[0]));
    if (startExt) path = path.slice(1);
    const endExt = path.length > orig.length && coastKeys.has(k(path[path.length - 1]));
    if (endExt) path = path.slice(0, -1);
    assert.ok(startExt || endExt, 'extended edge ' + i + ' starts or ends on a coastline point');
    assert.deepStrictEqual(path, orig, 'edge ' + i + ' without its extension equals the geometry path');
  });
  assert.ok(extended > 0, 'at least one edge is extended, got ' + extended);
});

test('chart ops: under and over lists follow MAP_TREATMENT 1.6 order; polygon ops flag lattice boundary segments', () => {
  const { view, geom, chart } = step9Chart(42);
  const ops = AshesMapCanvas.buildChartOps(chart);
  const kinds = ops.under.map(o => o.kind);
  assert.strictEqual(kinds[0], 'chart-paper');
  assert.strictEqual(kinds[1], 'chart-sea');
  const strokes = ops.under.filter(o => o.kind === 'chart-stroke');
  assert.deepStrictEqual(strokes.map(o => [o.widthCells, o.plusPx]),
    [[0.72, 0], [0.52, 1], [0.52, -1], [0.44, 0], [0.30, 1], [0.30, -1], [0.22, 0], [0.14, 1], [0.14, -1]]);
  assert.strictEqual(ops.under.filter(o => o.kind === 'chart-wave').length, chart.waves.length);
  assert.strictEqual(kinds[kinds.length - 1], 'chart-land');
  assert.deepStrictEqual(ops.over.map(o => o.kind), ['chart-beach', 'chart-coastline', 'chart-edge-of-war']);
  assert.strictEqual(ops.over[2].segments.length, chart.boundarySegments.filter(s => !s.sea).length);
  const drawOps = AshesMapCanvas.buildDrawOps(geom, view);
  const p00 = drawOps.find(o => o.kind === 'polygon' && o.id === 'p0_0');
  assert.deepStrictEqual(p00.boundarySegs, [true, true, false, false, false, false, true, true]);
  const p44 = drawOps.find(o => o.kind === 'polygon' && o.id === 'p4_4');
  assert.deepStrictEqual(p44.boundarySegs, [false, false, false, false, false, false, false, false]);
});

// River and rail tests (Cycle 23 Step 10, MAP_TREATMENT 2)

function step10Hex(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

test('river R-TRUTH: every edge sample lies on its geom path, every mouth sample on its divider ray, edges aligned with geom.riverSegments', () => {
  const { geom, chart } = step9Chart(42);
  const rivers = chart.rivers;
  assert.strictEqual(rivers.edges.length, geom.riverSegments.length, 'one chart edge per geom river segment');
  assert.strictEqual(rivers.edges.length, 7, 'seed 42 has 7 river segments');
  rivers.edges.forEach((e, i) => {
    const rs = geom.riverSegments[i];
    assert.strictEqual(e.a, rs.a, 'edge ' + i + ' a');
    assert.strictEqual(e.b, rs.b, 'edge ' + i + ' b');
    assert.ok(e.samples.length >= 2, 'edge ' + i + ' has samples');
    e.samples.forEach((q, k) => {
      const d = Math.min(step9DistToSeg(q, rs.path[0], rs.path[1]), step9DistToSeg(q, rs.path[1], rs.path[2]));
      assert.ok(d <= 0.001, 'edge ' + i + ' sample ' + k + ' off its path by ' + d);
      if (k > 0) {
        const gap = Math.hypot(q.x - e.samples[k - 1].x, q.y - e.samples[k - 1].y);
        assert.ok(gap <= 0.04 + 1e-9, 'edge ' + i + ' sample gap ' + gap);
      }
    });
  });
  rivers.mouths.forEach((m, i) => {
    const node = { x: m.x, y: m.y };
    const coast = { x: m.coastX, y: m.coastY };
    m.samples.forEach((q, k) => {
      const d = step9DistToSeg(q, node, coast);
      assert.ok(d <= 0.001, 'mouth ' + i + ' sample ' + k + ' off its ray by ' + d);
    });
  });
});

test('river flow and width: mouths at D 0 north and south, widths within W_SRC and W_MOUTH and non decreasing downstream', () => {
  const { geom, chart } = step9Chart(42);
  const C = AshesChart.CHART_CONSTANTS;
  const rivers = chart.rivers;
  assert.strictEqual(rivers.mouths.length, 2, 'two mouths');
  // + 0 folds Math.round(-0.13), which is -0, to 0.
  const gys = rivers.mouths.map(m => Math.round(m.y) + 0).sort((a, b) => a - b);
  assert.deepStrictEqual(gys, [0, geom.mapH], 'one mouth on the north edge, one on the south edge');
  rivers.mouths.forEach(m => {
    assert.strictEqual(rivers.nodes[m.node].D, 0, 'mouth node D is 0');
    assert.strictEqual(rivers.nodes[m.node].mouth, true);
  });
  assert.strictEqual(rivers.nodes.filter(n => n.mouth).length, 2, 'exactly the two mouth nodes are flagged');
  rivers.edges.forEach((e, i) => {
    assert.ok(rivers.nodes[e.from].D >= rivers.nodes[e.to].D, 'edge ' + i + ' flows downhill in D');
    e.samples.forEach(q => {
      assert.ok(q.w >= C.W_SRC - 1e-9 && q.w <= C.W_MOUTH + 1e-9, 'edge ' + i + ' width ' + q.w);
    });
    const fromNode = rivers.nodes[e.from];
    const first = e.samples[0];
    const forward = Math.abs(first.x - fromNode.x) <= 1e-6 && Math.abs(first.y - fromNode.y) <= 1e-6;
    const flow = forward ? e.samples : e.samples.slice().reverse();
    for (let k = 1; k < flow.length; k++) {
      assert.ok(flow[k].w >= flow[k - 1].w - 1e-9, 'edge ' + i + ' width falls downstream at sample ' + k);
    }
  });
  // 2.2 * 0.025 is 0.05500000000000001 in floating point, so compare with a 1e-12 tolerance.
  assert.ok(C.W_SRC >= 2.2 * 0.025 - 1e-12, 'W_SRC at least 2.2 times the front line width');
});

test('river mouths: only at sea vertices, coast points on the coastline, one fan per mouth on the sea side', () => {
  const { chart } = step9Chart(42);
  const rivers = chart.rivers;
  const coastKeys = new Set(chart.coastline.map(q => q.x.toFixed(4) + ',' + q.y.toFixed(4)));
  rivers.mouths.forEach((m, i) => {
    assert.ok(coastKeys.has(m.coastX.toFixed(4) + ',' + m.coastY.toFixed(4)), 'mouth ' + i + ' coast point is on the coastline');
  });
  assert.strictEqual(rivers.fans.length, rivers.mouths.length, 'one fan per mouth');
  rivers.fans.forEach((f, i) => {
    assert.strictEqual(AshesChart.pointInPolygon({ x: f.cx, y: f.cy }, chart.coastline), false, 'fan ' + i + ' centre lies in the sea');
    assert.strictEqual(f.rx, 0.22);
    assert.strictEqual(f.ry, 0.12);
  });
});

test('river determinism: a second buildChart gives deep equal rivers', () => {
  const a = step9Chart(42);
  const again = AshesChart.buildChart(a.geom);
  assert.deepStrictEqual(again.rivers, a.chart.rivers);
  const fresh = step9Chart(42);
  assert.deepStrictEqual(fresh.chart.rivers, a.chart.rivers, 'rebuilt geometry gives the same rivers');
});

test('river palette: RIVER_WATER, RIVER_BANK and RIVER_GLINT match their MAP_TREATMENT 0.2 luma', () => {
  const C = AshesChart.CHART_CONSTANTS;
  function luma(hex) {
    const rgb = step10Hex(hex);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  [['RIVER_WATER', 134.0], ['RIVER_BANK', 67.4], ['RIVER_GLINT', 160.9]].forEach(([name, want]) => {
    const got = luma(C[name]);
    assert.ok(Math.abs(got - want) <= 0.6, name + ' luma ' + got.toFixed(2) + ' vs ' + want);
  });
});

test('river chart ops: one estuary fan op per fan, all before chart-land', () => {
  const { chart } = step9Chart(42);
  const ops = AshesMapCanvas.buildChartOps(chart);
  const kinds = ops.under.map(o => o.kind);
  const landAt = kinds.indexOf('chart-land');
  const fanAt = [];
  kinds.forEach((k, i) => { if (k === 'chart-estuary-fan') fanAt.push(i); });
  assert.strictEqual(fanAt.length, chart.rivers.fans.length, 'fan op count');
  assert.ok(fanAt.length > 0, 'fans exist');
  fanAt.forEach(i => assert.ok(i < landAt, 'fan op ' + i + ' before chart-land at ' + landAt));
});

test('river draw ops: river ops carry samples, one river-mouths op sits between rivers and rails', () => {
  const { view, geom, chart } = step9Chart(42);
  const ops = AshesMapCanvas.buildDrawOps(geom, view);
  const riverOps = ops.filter(o => o.kind === 'river');
  riverOps.forEach((op, i) => {
    assert.strictEqual(op.samples.length, chart.rivers.edges[i].samples.length * 3, 'river op ' + i + ' samples are flat x, y, w');
  });
  const mouthOps = ops.filter(o => o.kind === 'river-mouths');
  assert.strictEqual(mouthOps.length, 1, 'one river-mouths op');
  assert.strictEqual(mouthOps[0].strokes.length, chart.rivers.mouths.length);
  const mouthAt = ops.indexOf(mouthOps[0]);
  assert.ok(mouthAt > ops.findLastIndex(o => o.kind === 'river'), 'mouths after rivers');
  assert.ok(mouthAt < ops.findIndex(o => o.kind === 'rail'), 'mouths before rails');
});

test('rail ops: built rails carry ties, unbuilt rails carry dots (seed 42 is all built; unbuilt pinned on a flipped copy)', () => {
  const { view, geom } = step9Chart(42);
  const rails = AshesMapCanvas.buildDrawOps(geom, view).filter(o => o.kind === 'rail');
  assert.strictEqual(rails.length, 16, '16 rail ops');
  assert.ok(rails.every(o => o.railState === 'built'), 'seed 42 has only built rail');
  rails.forEach((op, i) => {
    assert.ok(op.ties.length > 0 && op.ties.length % 4 === 0, 'built rail ' + i + ' ties ' + op.ties.length);
    assert.strictEqual(op.dots.length, 0, 'built rail ' + i + ' has no dots');
    assert.strictEqual(op.dashed, false);
  });
  // Unbuilt rail: flip one railed edge to building on a view copy.
  const viewCopy = JSON.parse(JSON.stringify(view));
  const railed = viewCopy.edges.find(e => e.railState === 'built');
  railed.railState = 'building';
  const geomCopy = AshesMapGeometry.buildGeometry(viewCopy);
  const flipped = AshesMapCanvas.buildDrawOps(geomCopy, viewCopy).filter(o => o.kind === 'rail');
  const unbuilt = flipped.filter(o => o.railState !== 'built');
  assert.strictEqual(unbuilt.length, 1, 'one unbuilt rail on the copy');
  unbuilt.forEach(op => {
    assert.ok(op.dots.length > 0 && op.dots.length % 2 === 0, 'unbuilt rail dots ' + op.dots.length);
    assert.strictEqual(op.ties.length, 0, 'unbuilt rail has no ties');
    assert.strictEqual(op.dashed, true);
  });
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const railCase = src.slice(src.indexOf("case 'rail':"), src.indexOf("case 'rail':") + 2000).split('break;')[0];
  assert.ok(railCase.indexOf('setLineDash') === -1, 'rail case uses no setLineDash');
});

// Relief tests (Cycle 23 Step 11, MAP_TREATMENT 3). Grid sizes are read from
// the chart (RELIEF_RES and relief.width/height), never hardcoded, because
// the 3.7 budget fallback can move RELIEF_RES from 24 to 16.

function step11Nearest(relief, x, y) {
  const i = Math.max(0, Math.min(relief.width - 1, Math.floor((x - relief.x0) * relief.res)));
  const j = Math.max(0, Math.min(relief.height - 1, Math.floor((y - relief.y0) * relief.res)));
  return j * relief.width + i;
}

function step11Luma(rgba, k) {
  return 0.2126 * rgba[k * 4] + 0.7152 * rgba[k * 4 + 1] + 0.0722 * rgba[k * 4 + 2];
}

test('relief shape: grid is 12 x 9 cells at RELIEF_RES, heights and rgba sized to it, every height in 0..1', () => {
  const { chart } = step9Chart(42);
  const RES = AshesChart.CHART_CONSTANTS.RELIEF_RES;
  const r = chart.relief;
  assert.ok(RES === 24 || RES === 16, 'RELIEF_RES is 24 or the 3.7 fallback 16, got ' + RES);
  assert.strictEqual(r.res, RES);
  assert.strictEqual(r.width, 12 * RES);
  assert.strictEqual(r.height, 9 * RES);
  assert.strictEqual(r.heights.length, r.width * r.height);
  assert.strictEqual(r.rgba.length, r.width * r.height * 4);
  assert.strictEqual(r.dC.length, r.width * r.height);
  assert.strictEqual(r.dR.length, r.width * r.height);
  assert.strictEqual(r.landMask.length, r.width * r.height);
  assert.strictEqual(r.nearestRiverDn.length, r.width * r.height);
  for (let k = 0; k < r.heights.length; k++) {
    assert.ok(r.heights[k] >= 0 && r.heights[k] <= 1, 'height ' + k + ' = ' + r.heights[k]);
  }
  const C = AshesChart.CHART_CONSTANTS;
  assert.strictEqual(C.LAND_HIGH, '#8A7A58');
  assert.strictEqual(C.CONTOUR, '#5A4A36');
  assert.strictEqual(C.SHADE_DARK, '#2B2620');
  assert.strictEqual(C.SHADE_LIGHT, '#F3EAD2');
  // The 0.2 table rounds by hand (SHADE_LIGHT computes to 234.18), so 0.25 slack.
  assert.ok(Math.abs(hexLuma(C.LAND_HIGH) - 123.0) < 0.25, 'LAND_HIGH luma ' + hexLuma(C.LAND_HIGH));
  assert.ok(Math.abs(hexLuma(C.CONTOUR) - 75.9) < 0.25, 'CONTOUR luma ' + hexLuma(C.CONTOUR));
  assert.ok(Math.abs(hexLuma(C.SHADE_LIGHT) - 234.0) < 0.25, 'SHADE_LIGHT luma ' + hexLuma(C.SHADE_LIGHT));
});

test('relief determinism: independent builds match by chartSeed, and relief does not vary by game seed', () => {
  const a = step9Chart(42);
  const geomB = AshesMapGeometry.buildGeometry(playerView(Sim.createGame(42)));
  const chartB = AshesChart.buildChart(geomB);
  // buildChart memoises, so also rebuild the relief from scratch twice.
  const fresh1 = AshesChart.buildRelief(geomB, chartB.coastline, chartB.rivers, chartB.chartSeed, chartB.neatline);
  const fresh2 = AshesChart.buildRelief(a.geom, a.chart.coastline, a.chart.rivers, a.chart.chartSeed, a.chart.neatline);
  [chartB.relief, fresh1, fresh2].forEach((r, i) => {
    assert.strictEqual(r.hash, a.chart.relief.hash, 'build ' + i + ' hash');
    assert.strictEqual(r.salt, a.chart.relief.salt, 'build ' + i + ' salt');
    assert.strictEqual(r.contours.length, a.chart.relief.contours.length, 'build ' + i + ' contour count');
  });
  assert.ok(/^[0-9a-f]{8}$/.test(a.chart.relief.hash), 'hash is 8 hex digits');
  const seed1 = step9Chart(1);
  const fresh3 = AshesChart.buildRelief(seed1.geom, seed1.chart.coastline, seed1.chart.rivers, seed1.chart.chartSeed, seed1.chart.neatline);
  assert.strictEqual(seed1.chart.relief.hash, a.chart.relief.hash, 'seed 1 and seed 42 relief hashes');
  assert.strictEqual(fresh3.hash, a.chart.relief.hash, 'fresh seed 1 relief hash');
});

test('relief coast: every land sample with dC 0 and dR above 0.60 has h exactly 0', () => {
  // The mouth valley keeps its river level at the coast (h = hv there), so
  // samples within 0.60 of the river network are scoped out by dR.
  const r = step9Chart(42).chart.relief;
  let pinned = 0;
  for (let k = 0; k < r.heights.length; k++) {
    if (!r.landMask[k] || r.dC[k] !== 0 || r.dR[k] <= 0.60) continue;
    assert.strictEqual(r.heights[k], 0, 'coast sample ' + k + ' h ' + r.heights[k]);
    pinned++;
  }
  assert.ok(pinned > 50, 'coast population pinned: ' + pinned);
});

test('relief rivers: river level rises monotonically with D, and the grid meets it at the source and mouth of the main component', () => {
  const { chart } = step9Chart(42);
  const rivers = chart.rivers;
  const r = chart.relief;
  // Components from nodes and edges.
  const parent = rivers.nodes.map((n, i) => i);
  const find = (a) => { while (parent[a] !== a) a = parent[a]; return a; };
  rivers.edges.forEach(e => { const ra = find(e.from); const rb = find(e.to); if (ra !== rb) parent[ra] = rb; });
  const comps = {};
  rivers.nodes.forEach((n, i) => { (comps[find(i)] = comps[find(i)] || []).push(i); });
  let main = null;
  let mainMax = -1;
  Object.keys(comps).forEach(c => {
    const members = comps[c];
    const maxD = Math.max.apply(null, members.map(i => rivers.nodes[i].D));
    const sorted = members.slice().sort((p, q) => rivers.nodes[p].D - rivers.nodes[q].D);
    let prev = -Infinity;
    sorted.forEach(i => {
      const hv = 0.06 + 0.24 * (maxD > 0 ? rivers.nodes[i].D / maxD : 0);
      assert.ok(hv >= prev, 'hv non decreasing at node ' + i);
      prev = hv;
    });
    if (maxD > mainMax) { mainMax = maxD; main = members; }
  });
  const source = main.find(i => rivers.nodes[i].source && rivers.nodes[i].D === mainMax);
  const mouth = main.find(i => rivers.nodes[i].mouth && rivers.nodes[i].D === 0);
  assert.ok(source !== undefined && mouth !== undefined, 'main component has a source and a mouth');
  [[source, 0.30], [mouth, 0.06]].forEach(([i, hv]) => {
    const n = rivers.nodes[i];
    const k = step11Nearest(r, n.x, n.y);
    assert.ok(Math.abs(r.heights[k] - hv) <= 0.06, 'node ' + i + ' grid h ' + r.heights[k].toFixed(4) + ' vs hv ' + hv);
  });
});

test('relief valley floor: at 0.55 to 0.65 cell from a river, h is never below the river level at its nearest point minus 0.03', () => {
  // Scoped to dC >= 0.45 (where the shore factor is 1). Within 0.45 cell of
  // the coast the 3.3 guarantee "h is 0 at the coast" wins over this one:
  // next to a river mouth the two cannot both hold, and the shore factor
  // brings the valley floor down to the sea.
  const r = step9Chart(42).chart.relief;
  let pinned = 0;
  for (let k = 0; k < r.heights.length; k++) {
    if (!r.landMask[k] || r.dR[k] < 0.55 || r.dR[k] > 0.65 || r.dC[k] < 0.45) continue;
    const hv = 0.06 + 0.24 * r.nearestRiverDn[k];
    assert.ok(r.heights[k] >= hv - 0.03, 'sample ' + k + ' h ' + r.heights[k].toFixed(4) + ' hv ' + hv.toFixed(4));
    pinned++;
  }
  assert.ok(pinned > 50, 'valley floor population pinned: ' + pinned);
});

test('relief fairness: salt 0..15, ruggedness in 0.25..1.0, starting nation means within 0.08, partition pinned to a fresh sim game', () => {
  const { geom, chart } = step9Chart(42);
  const r = chart.relief;
  assert.ok(Number.isInteger(r.salt) && r.salt >= 0 && r.salt <= 15, 'salt ' + r.salt);
  assert.strictEqual(Object.keys(r.ruggedness).length, geom.provinces.length);
  Object.keys(r.ruggedness).forEach(id => {
    assert.ok(r.ruggedness[id] >= 0.25 && r.ruggedness[id] <= 1.0, id + ' ruggedness ' + r.ruggedness[id]);
  });
  assert.ok(Math.abs(r.meanRuggedness.player - r.meanRuggedness.enemy) <= 0.08,
    'means ' + r.meanRuggedness.player + ' ' + r.meanRuggedness.enemy);
  const state = Sim.createGame(42);
  geom.provinces.forEach(p => {
    const expected = p.x < geom.mapW / 2 ? 'player' : 'enemy';
    assert.strictEqual(state.provinces[p.id].owner, expected, p.id + ' starting owner');
  });
  // Recompute the means from the partition.
  const sum = { player: 0, enemy: 0 };
  const cnt = { player: 0, enemy: 0 };
  geom.provinces.forEach(p => {
    const o = p.x < geom.mapW / 2 ? 'player' : 'enemy';
    sum[o] += r.ruggedness[p.id];
    cnt[o]++;
  });
  assert.ok(Math.abs(sum.player / cnt.player - r.meanRuggedness.player) < 1e-12);
  assert.ok(Math.abs(sum.enemy / cnt.enemy - r.meanRuggedness.enemy) < 1e-12);
});

test('relief contours: levels 0.30, 0.55, 0.80 only, each at least 0.25 cell long, clear of label reserves and of rivers by 0.06', () => {
  const r = step9Chart(42).chart.relief;
  assert.ok(r.contours.length > 0, 'some contours');
  r.contours.forEach((c, ci) => {
    assert.ok([0.30, 0.55, 0.80].indexOf(c.level) !== -1, 'contour ' + ci + ' level ' + c.level);
    assert.ok(c.points.length >= 4 && c.points.length % 2 === 0, 'contour ' + ci + ' flat points');
    let len = 0;
    for (let i = 2; i < c.points.length; i += 2) {
      len += Math.hypot(c.points[i] - c.points[i - 2], c.points[i + 1] - c.points[i - 1]);
    }
    assert.ok(len >= 0.25 - 1e-6, 'contour ' + ci + ' length ' + len);
    for (let i = 0; i < c.points.length; i += 2) {
      const x = c.points[i];
      const y = c.points[i + 1];
      r.labelReserves.forEach(lr => {
        const e = Math.pow((x - lr.x) / lr.rx, 2) + Math.pow((y - lr.y) / lr.ry, 2);
        assert.ok(e > 1 - 1e-6, 'contour ' + ci + ' point inside reserve ' + lr.id);
      });
      const k = step11Nearest(r, x, y);
      assert.ok(r.dR[k] >= 0.06, 'contour ' + ci + ' point dR ' + r.dR[k]);
      assert.strictEqual(r.landMask[k], 1, 'contour ' + ci + ' point on land');
    }
  });
});

test('relief label reserves: one per province, 0.45 by 0.11, anchored inside its own cell', () => {
  const { geom, chart } = step9Chart(42);
  const r = chart.relief;
  assert.strictEqual(r.labelReserves.length, geom.provinces.length);
  const byId = {};
  geom.provinces.forEach(p => { byId[p.id] = p; });
  r.labelReserves.forEach(lr => {
    const p = byId[lr.id];
    assert.ok(p, 'reserve for a real province ' + lr.id);
    assert.strictEqual(lr.rx, 0.45);
    assert.strictEqual(lr.ry, 0.11);
    assert.ok(lr.x >= p.x - 0.01 && lr.x <= p.x + 1.01, lr.id + ' anchor x ' + lr.x);
    assert.ok(lr.y >= p.y - 0.01 && lr.y <= p.y + 1.01, lr.id + ' anchor y ' + lr.y);
  });
  assert.strictEqual(new Set(r.labelReserves.map(lr => lr.id)).size, geom.provinces.length, 'ids unique');
});

test('relief raster bands: every land sample is opaque with luma 60 to 150, every sea sample is transparent', () => {
  const r = step9Chart(42).chart.relief;
  let land = 0;
  for (let k = 0; k < r.heights.length; k++) {
    if (r.landMask[k]) {
      assert.strictEqual(r.rgba[k * 4 + 3], 255, 'land sample ' + k + ' alpha');
      const l = step11Luma(r.rgba, k);
      assert.ok(l >= 60 && l <= 150, 'land sample ' + k + ' luma ' + l);
      land++;
    } else {
      assert.strictEqual(r.rgba[k * 4 + 3], 0, 'sea sample ' + k + ' alpha');
    }
  }
  assert.ok(land > r.heights.length / 2, 'most of the neatline is land: ' + land);
});

// Borders and ownership on chart paths (Cycle 23 Step 12a, MAP_TREATMENT 5.2 and 5.3)

function riverPairSet(geom) {
  const set = {};
  geom.riverSegments.forEach(function (rs) { set[rs.a + '|' + rs.b] = true; set[rs.b + '|' + rs.a] = true; });
  return set;
}

function viewOwnerLookup(view) {
  const lookup = {};
  view.provinces.forEach(function (p) {
    if (p.intel === 'live' && (p.owner === 'player' || p.owner === 'enemy')) lookup[p.id] = p.owner;
  });
  return lookup;
}

function flatOf(points) {
  const flat = [];
  points.forEach(function (q) { flat.push(q.x, q.y); });
  return flat;
}

test('border ops: one per non river chart edge (116 on seed 42), paths equal chart edge paths, none on a river edge, deterministic', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const ops = AshesMapCanvas.buildDrawOps(geom, view);
  const borders = ops.filter(function (op) { return op.kind === 'border'; });
  const rivers = riverPairSet(geom);

  const riverEdges = chart.chartEdges.filter(function (e) { return rivers[e.a + '|' + e.b]; }).length;
  assert.strictEqual(chart.chartEdges.length, 123, 'seed 42 chart edges');
  assert.strictEqual(geom.riverSegments.length, 7, 'seed 42 river segments');
  assert.strictEqual(borders.length, chart.chartEdges.length - riverEdges, 'border ops equal chart edges minus river edges');
  assert.strictEqual(borders.length, 116, 'measured seed 42 border op count');

  const byPair = {};
  chart.chartEdges.forEach(function (e) { byPair[e.a + '|' + e.b] = e; });
  borders.forEach(function (op) {
    assert.ok(!rivers[op.a + '|' + op.b], 'no border on river edge ' + op.a + ' ' + op.b);
    const e = byPair[op.a + '|' + op.b];
    assert.ok(e, 'border op matches a chart edge: ' + op.a + ' ' + op.b);
    assert.deepStrictEqual(op.path, flatOf(e.path), 'border path equals chart edge path for ' + op.a + ' ' + op.b);
  });

  // Borders come after every rail op, and no coast op remains.
  const lastRail = ops.findLastIndex(function (op) { return op.kind === 'rail'; });
  const firstBorder = ops.findIndex(function (op) { return op.kind === 'border'; });
  assert.ok(firstBorder > lastRail, 'border ops follow the rail ops');

  const again = AshesMapCanvas.buildDrawOps(geom, view);
  assert.deepStrictEqual(again, ops, 'two buildDrawOps calls are deep equal');
  assert.strictEqual(AshesMapCanvas.drawOpsHash(again), AshesMapCanvas.drawOpsHash(ops), 'hash stable');
});

test('state ops on chart paths: fills are hit polygons, boundary bands follow chart segments (sea ribbons on the coastline), extended edges carry extended paths', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const ops = AshesMapCanvas.buildStateOps(geom, view);
  const owners = viewOwnerLookup(view);

  // Fills: every fill polygon is the flattened hit polygon.
  const fills = ops.filter(function (op) { return op.kind === 'fill'; });
  assert.strictEqual(fills.length, 43, 'measured seed 42 fill count');
  fills.forEach(function (op) {
    assert.deepStrictEqual(op.polygon, flatOf(chart.hitPolygons[op.provinceId]), 'fill is hit polygon for ' + op.provinceId);
  });

  // Boundary bands, computed here from chart.boundarySegments and the view owners.
  const expectedSea = [];
  const expectedInland = [];
  chart.boundarySegments.forEach(function (seg) {
    if (!owners[seg.provinceId]) return;
    let pts = [seg.p1];
    if (seg.sea) pts = pts.concat(chart.coastline.slice(seg.coastStart, seg.coastEnd + 1));
    pts.push(seg.p2);
    (seg.sea ? expectedSea : expectedInland).push({ provinceId: seg.provinceId, path: flatOf(pts) });
  });
  const expectedBoundary = expectedSea.length + expectedInland.length;
  assert.ok(expectedBoundary > 0, 'boundary bands expected on seed 42');
  assert.strictEqual(expectedSea.length, 28, 'measured seed 42 sea boundary bands');
  assert.strictEqual(expectedInland.length, 10, 'measured seed 42 inland boundary bands');

  const bands = ops.filter(function (op) { return op.kind === 'band'; });
  const fronts = ops.filter(function (op) { return op.kind === 'front'; });
  assert.strictEqual(fronts.length, 7, 'measured seed 42 front count');
  let interiorExpected = 0;
  chart.chartEdges.forEach(function (e) {
    const oa = owners[e.a];
    const ob = owners[e.b];
    if (oa && ob && oa !== ob) interiorExpected += 2;
    else if ((oa && !ob) || (!oa && ob)) interiorExpected += 1;
  });
  assert.strictEqual(bands.length, interiorExpected + expectedBoundary, 'band count equals interior plus chart boundary segments');
  assert.strictEqual(bands.length, 61, 'measured seed 42 band count');

  function hasBand(provinceId, path) {
    return bands.some(function (op) {
      return op.provinceId === provinceId && op.path.length === path.length &&
        op.path.every(function (v, i) { return v === path[i]; });
    });
  }
  expectedSea.concat(expectedInland).forEach(function (eb) {
    assert.ok(hasBand(eb.provinceId, eb.path), 'boundary band present for ' + eb.provinceId);
  });

  // Every interior point of a sea ribbon is a coastline point at 4 decimals.
  const coastKeys = {};
  chart.coastline.forEach(function (q) { coastKeys[q.x.toFixed(4) + ',' + q.y.toFixed(4)] = true; });
  expectedSea.forEach(function (eb) {
    for (let i = 2; i < eb.path.length - 2; i += 2) {
      assert.ok(coastKeys[eb.path[i].toFixed(4) + ',' + eb.path[i + 1].toFixed(4)], 'sea ribbon point on the coastline for ' + eb.provinceId);
    }
  });

  // Every band clips to its province hit polygon.
  bands.forEach(function (op) {
    assert.deepStrictEqual(op.polygon, flatOf(chart.hitPolygons[op.provinceId]), 'band clip is hit polygon for ' + op.provinceId);
  });

  // Extended chart edges: fronts and interior bands carry the extended path.
  // Seed 42 measures 2 fronts on extended edges, so no staged state is needed.
  let extendedFronts = 0;
  chart.chartEdges.forEach(function (e) {
    if (!e.extended) return;
    const path = flatOf(e.path);
    const oa = owners[e.a];
    const ob = owners[e.b];
    if (oa && ob && oa !== ob) {
      const f = fronts.find(function (op) { return op.a === e.a && op.b === e.b; });
      assert.ok(f, 'front on extended edge ' + e.a + ' ' + e.b);
      assert.deepStrictEqual(f.path, path, 'front path is the extended chart edge path');
      extendedFronts++;
    }
    if (oa && oa !== ob) assert.ok(hasBand(e.a, path), 'band for ' + e.a + ' on extended edge ' + e.a + ' ' + e.b);
    if (ob && oa !== ob) assert.ok(hasBand(e.b, path), 'band for ' + e.b + ' on extended edge ' + e.a + ' ' + e.b);
  });
  assert.strictEqual(extendedFronts, 2, 'measured seed 42 fronts on extended chart edges');
});

test('front casing: each Ink front stroke follows a #E6D8B5 casing stroke at alpha 0.6 and frontW + 2', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildStateOps(geom, view);
  const scaleX = 160;
  const frontW = 0.025 * scaleX;
  const strokes = [];
  const ctx = {
    strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1, lineJoin: 'miter',
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, clip() {}, save() {}, restore() {},
    stroke() { strokes.push({ style: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha }); }
  };
  AshesMapCanvas.drawStateOps(ctx, ops, scaleX, scaleX);
  const fronts = ops.filter(function (op) { return op.kind === 'front'; }).length;
  assert.ok(fronts > 0, 'seed 42 has fronts');
  const inkFronts = [];
  strokes.forEach(function (st, i) {
    if (st.style === '#1e1a12' && st.width === frontW) inkFronts.push(i);
  });
  assert.strictEqual(inkFronts.length, fronts, 'one Ink front stroke per front op');
  inkFronts.forEach(function (i) {
    assert.strictEqual(strokes[i].alpha, 1, 'Ink front at alpha 1');
    const prev = strokes[i - 1];
    assert.ok(prev, 'casing stroke precedes the Ink front');
    assert.strictEqual(prev.style, '#E6D8B5', 'casing colour');
    assert.strictEqual(prev.alpha, 0.6, 'casing alpha');
    assert.strictEqual(prev.width, frontW + 2, 'casing width frontW + 2');
  });
  assert.strictEqual(ctx.globalAlpha, 1, 'alpha restored after the state pass');
});

test('border draw: dashed Ink at alpha 0.50, width 0.009 * scaleX, round cap, dash reset; polygons no longer stroke', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildDrawOps(geom, view).filter(function (op) { return op.kind === 'polygon' || op.kind === 'border'; });
  const scaleX = 160;
  const strokes = [];
  let dash = [];
  const ctx = {
    strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt',
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, save() {}, restore() {},
    setLineDash(d) { dash = d.slice(); },
    stroke() { strokes.push({ style: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha, cap: this.lineCap, dash: dash.slice() }); }
  };
  AshesMapCanvas.drawOps(ctx, ops, scaleX, scaleX);
  const borders = ops.filter(function (op) { return op.kind === 'border'; }).length;
  assert.strictEqual(strokes.length, borders, 'only border ops stroke; polygon ops fill only');
  strokes.forEach(function (st) {
    // Chart Ink (MAP_TREATMENT 0.2 palette), the same constant as the coastline and rail.
    assert.strictEqual(st.style, AshesChart.CHART_CONSTANTS.INK, 'border Ink');
    assert.strictEqual(st.style, '#2B2620', 'border Ink is #2B2620');
    assert.strictEqual(st.alpha, 0.5, 'border alpha');
    assert.strictEqual(st.width, 0.009 * scaleX, 'border width');
    assert.strictEqual(st.cap, 'round', 'border cap');
    assert.deepStrictEqual(st.dash, [0.040 * scaleX, 0.025 * scaleX], 'border dash');
  });
  assert.deepStrictEqual(dash, [], 'dash reset after the border pass');
  assert.strictEqual(ctx.globalAlpha, 1, 'alpha reset after the border pass');
});

// Cycle 23 Step 12b: the label reserves the province names sit on (MAP_TREATMENT 3.6 and 5.5).
test('label reserves: one per province at the polygon vertex centroid lifted 0.30 cell, half axes 0.45 by 0.11', () => {
  const view = playerView(Sim.createGame(42));
  const geom = AshesMapGeometry.buildGeometry(view);
  const chart = AshesChart.buildChart(geom);
  const reserves = chart.relief.labelReserves;
  assert.strictEqual(reserves.length, geom.provinces.length, 'one reserve per province');
  const byId = {};
  reserves.forEach(function (lr) { byId[lr.id] = lr; });
  assert.strictEqual(Object.keys(byId).length, geom.provinces.length, 'reserve ids are unique');
  geom.provinces.forEach(function (p) {
    const lr = byId[p.id];
    assert.ok(lr, 'reserve for ' + p.id);
    let cx = 0;
    let cy = 0;
    p.polygon.forEach(function (pt) { cx += pt.x; cy += pt.y; });
    cx /= p.polygon.length;
    cy /= p.polygon.length;
    assert.ok(Math.abs(lr.x - cx) < 1e-9, p.id + ' reserve x at the centroid');
    assert.ok(Math.abs(lr.y - (cy - 0.30)) < 1e-9, p.id + ' reserve y at the centroid lifted 0.30');
    assert.strictEqual(lr.rx, 0.45, p.id + ' rx');
    assert.strictEqual(lr.ry, 0.11, p.id + ' ry');
  });
});

test('label wiring: #map-labels in index.html, registered in main.js, tile name line and river bars retired, Fell face and layer rule in style.css', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  assert.ok(html.indexOf('id="map-labels"') !== -1, 'index.html has the #map-labels layer');
  assert.ok(main.indexOf("'map-labels'") !== -1, 'main.js registers map-labels');
  assert.strictEqual(main.indexOf('class="pname"'), -1, 'tile name line retired');
  assert.strictEqual(main.indexOf('riverBar'), -1, 'tile river bars retired');
  assert.ok(/@font-face\s*\{[^}]*font-family:\s*"IM Fell English SC"[^}]*IMFellEnglishSC-Regular\.ttf/.test(css),
    'style.css declares the IM Fell English SC face');
  assert.ok(/#map-labels\s*\{/.test(css), 'style.css has a #map-labels rule');
});

// Cycle 23 Step 13: graticule, degree border, scale bar, north arrow, legend
// (MAP_TREATMENT 4.1 to 4.4 and 5.6).
test('graticule data: meridians at 10 to 35 E and parallels at 50, 45, 40 N follow the 4.1 formulas, with degree labels', () => {
  const mer = AshesMapCanvas.GRATICULE_MERIDIANS;
  const par = AshesMapCanvas.GRATICULE_PARALLELS;
  assert.deepStrictEqual(mer.map(m => m.lon), [10, 15, 20, 25, 30, 35]);
  assert.deepStrictEqual(par.map(p => p.lat), [50, 45, 40]);
  const xs = [0.5357, 2.3214, 4.1071, 5.8929, 7.6786, 9.4643];
  mer.forEach(function (m, i) {
    assert.strictEqual(m.x.toFixed(4), ((m.lon - 8.5) / 2.8).toFixed(4), 'meridian ' + m.lon + ' x formula');
    assert.strictEqual(m.x.toFixed(4), xs[i].toFixed(4), 'meridian ' + m.lon + ' x value');
    assert.ok(Math.abs((8.5 + 2.8 * m.x) - m.lon) < 1e-9, 'longitude(x) round trips for ' + m.lon);
  });
  const ys = [0.75, 3.25, 5.75];
  par.forEach(function (p, i) {
    assert.strictEqual(p.y.toFixed(4), ((51.5 - p.lat) / 2).toFixed(4), 'parallel ' + p.lat + ' y formula');
    assert.strictEqual(p.y.toFixed(4), ys[i].toFixed(4), 'parallel ' + p.lat + ' y value');
  });
  assert.deepStrictEqual(mer.map(m => m.label), ['10°E', '15°E', '20°E', '25°E', '30°E', '35°E']);
  assert.deepStrictEqual(par.map(p => p.label), ['50°N', '45°N', '40°N']);
});

test('furniture ops: 9 graticule lines neatline to neatline, meridians west to east then parallels north to south, constant and view independent', () => {
  const { geom } = step9Chart(42);
  const ops = AshesMapCanvas.buildFurnitureOps(geom);
  assert.strictEqual(ops.length, 9);
  ops.forEach(function (op) { assert.strictEqual(op.kind, 'graticule'); assert.strictEqual(op.line.length, 4); });
  const x0 = -1, y0 = -1, x1 = geom.mapW + 1, y1 = geom.mapH + 1;
  assert.strictEqual(x1, 11);
  assert.strictEqual(y1, 8);
  AshesMapCanvas.GRATICULE_MERIDIANS.forEach(function (m, i) {
    assert.deepStrictEqual(ops[i].line, [m.x, y0, m.x, y1], 'meridian ' + m.lon + ' is vertical neatline to neatline');
  });
  AshesMapCanvas.GRATICULE_PARALLELS.forEach(function (p, i) {
    assert.deepStrictEqual(ops[6 + i].line, [x0, p.y, x1, p.y], 'parallel ' + p.lat + ' is horizontal neatline to neatline');
  });
  for (let i = 1; i < 6; i++) assert.ok(ops[i].line[0] > ops[i - 1].line[0], 'meridians run west to east');
  for (let i = 7; i < 9; i++) assert.ok(ops[i].line[1] > ops[i - 1].line[1], 'parallels run north to south');
  assert.deepStrictEqual(AshesMapCanvas.buildFurnitureOps(geom), ops, 'identical on a second call');
  // A different view (the worst case fixture, different fog) gives the same list.
  const fixtureGeom = AshesMapGeometry.buildGeometry(fogFixtureView());
  assert.deepStrictEqual(AshesMapCanvas.buildFurnitureOps(fixtureGeom), ops, 'geometry size alone decides the list');
});

test('furniture in the fog hash: fog ops plus furniture hash differently from fog ops alone; fog ops alone stay deterministic', () => {
  const view = fogFixtureView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const fog = AshesMapCanvas.buildFogOps(geom, view);
  const furniture = AshesMapCanvas.buildFurnitureOps(geom);
  assert.strictEqual(fog.length, 24, 'buildFogOps is unchanged by the furniture');
  const alone = AshesMapCanvas.fogOpsHash(fog);
  assert.strictEqual(AshesMapCanvas.fogOpsHash(AshesMapCanvas.buildFogOps(geom, view)), alone);
  const both = AshesMapCanvas.fogOpsHash(fog.concat(furniture));
  assert.notStrictEqual(both, alone);
  assert.strictEqual(AshesMapCanvas.fogOpsHash(fog.concat(AshesMapCanvas.buildFurnitureOps(geom))), both);
  assert.match(AshesMapCanvas.fogOpsHash(furniture), /^[0-9a-f]{8}$/, 'furniture alone hashes without a polygon');
});

test('graticule draw: one solid Ink stroke at alpha 0.20, 1 device px under scaleX 240 and 2 at 240 and up', () => {
  const { geom } = step9Chart(42);
  const furniture = AshesMapCanvas.buildFurnitureOps(geom);
  [[160, 1], [320, 2]].forEach(function (pair) {
    const strokes = [];
    let dash = null;
    const ctx = {
      strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1,
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, save() {}, restore() {}, clip() {},
      setLineDash(d) { dash = d.slice(); },
      stroke() { strokes.push({ style: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha, dash: dash }); }
    };
    AshesMapCanvas.drawFogOps(ctx, furniture, pair[0], pair[0]);
    assert.strictEqual(strokes.length, 1, 'one graticule stroke at scaleX ' + pair[0]);
    assert.strictEqual(strokes[0].style, '#2B2620');
    assert.strictEqual(strokes[0].alpha, 0.20);
    assert.strictEqual(strokes[0].width, pair[1]);
    assert.deepStrictEqual(strokes[0].dash, [], 'solid');
  });
});

test('chart furniture: frame, degree bar, scale bar, and north arrow ops on a third list; under and over unchanged', () => {
  const { chart } = step9Chart(42);
  const ops = AshesMapCanvas.buildChartOps(chart);
  assert.ok(Array.isArray(ops.furniture), 'buildChartOps returns a furniture list');
  assert.deepStrictEqual(ops.over.map(o => o.kind), ['chart-beach', 'chart-coastline', 'chart-edge-of-war']);
  ops.under.concat(ops.over).forEach(function (op) {
    assert.ok(['chart-degree-bar', 'chart-frame', 'chart-scale-bar', 'chart-north-arrow'].indexOf(op.kind) === -1, 'no furniture in under or over');
  });
  const neat = chart.neatline;
  const ext = chart.extent;
  const eps = 1e-9;

  const frames = ops.furniture.filter(o => o.kind === 'chart-frame');
  assert.strictEqual(frames.length, 2);
  assert.strictEqual(frames[0].widthCells, 0.008);
  assert.deepStrictEqual(frames[0].rect, [neat.x0, neat.y0, neat.x1 - neat.x0, neat.y1 - neat.y0], 'neatline rect');
  assert.strictEqual(frames[1].widthCells, 0.012);
  assert.deepStrictEqual(frames[1].rect, [ext.x0, ext.y0, ext.x1 - ext.x0, ext.y1 - ext.y0], 'outer frame rect');

  const bars = ops.furniture.filter(o => o.kind === 'chart-degree-bar');
  bars.forEach(function (b) {
    // Top and bottom bars lie outside the neatline in y; side bars in x.
    const horizontal = b.rect[1] < neat.y0 || b.rect[1] >= neat.y1 - eps;
    assert.ok(Math.abs((horizontal ? b.rect[3] : b.rect[2]) - 0.06) < eps, 'every degree bar rect is 0.06 thick');
    assert.ok(b.style === 'ink' || b.style === 'paper');
  });
  const top = bars.filter(b => Math.abs(b.rect[1] - (neat.y0 - 0.06)) < eps && Math.abs(b.rect[3] - 0.06) < eps);
  assert.ok(top.length >= 33, 'about 33.6 one degree segments along the top, got ' + top.length);
  assert.ok(Math.abs(top[0].rect[0] - neat.x0) < eps, 'top starts at the top left corner');
  top.forEach(function (b, i) {
    assert.strictEqual(b.style, i % 2 === 0 ? 'ink' : 'paper', 'top segment ' + i + ' alternates from ink');
    if (i < top.length - 1) assert.ok(Math.abs(b.rect[2] - 1 / 2.8) < eps, 'one degree is 1 / 2.8 cell');
  });
  const last = top[top.length - 1];
  assert.ok(Math.abs(last.rect[0] + last.rect[2] - neat.x1) < eps, 'last top segment clipped at the corner');
  const left = bars.filter(b => Math.abs(b.rect[0] - (neat.x0 - 0.06)) < eps && Math.abs(b.rect[2] - 0.06) < eps);
  assert.strictEqual(left.length, (neat.y1 - neat.y0) / 0.5, 'one degree is 0.5 cell along the sides');

  const scale = ops.furniture.filter(o => o.kind === 'chart-scale-bar');
  const widths = scale.map(s => s.rect[2]);
  assert.deepStrictEqual(widths.map(w => w.toFixed(4)), ['0.2250', '0.2250', '0.4500']);
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 0.90) < eps, 'parts sum to 0.90 cell (200 km)');
  assert.deepStrictEqual(scale.map(s => s.style), ['ink', 'paper', 'ink']);
  const SB = AshesMapCanvas.SCALE_BAR;
  assert.ok(Math.abs(SB.y - (neat.y1 + 0.10)) < eps, 'scale bar sits 0.10 into the foot strip');
  assert.ok(SB.y + SB.height < ext.y1, 'scale bar inside the foot strip');
  scale.forEach(function (s) {
    assert.strictEqual(s.rect[1], SB.y);
    assert.strictEqual(s.rect[3], 0.035);
  });
  assert.strictEqual(scale[0].rect[0], SB.x);
  assert.deepStrictEqual(SB.marks, [0, 0.225, 0.45, 0.90]);

  const arrows = ops.furniture.filter(o => o.kind === 'chart-north-arrow');
  assert.strictEqual(arrows.length, 1);
  assert.ok(Math.abs(arrows[0].baseY - arrows[0].tipY - 0.36) < eps, 'arrow is 0.36 cell tall');
  assert.deepStrictEqual(arrows[0], Object.assign({ kind: 'chart-north-arrow' }, AshesMapCanvas.NORTH_ARROW));
  assert.ok(arrows[0].tipY > neat.y1 && arrows[0].baseY < ext.y1, 'arrow inside the foot strip');
});

const STEP13_LEGEND = [
  'This is a map of the war. Blue is your nation, the Vessari Compact. Red is the Khessite Dominion.',
  'A coloured band along a border shows who holds the ground on that side: blue for yours, red for the Dominion. The black line where blue meets red is the front.',
  'Dashed lines are province borders. Click anywhere inside a province to select it.',
  'Rivers are drawn in blue gray. Crossing a river is harder for your troops.',
  'Provinces that touch the sea are coastal. Flotillas are built and sail there.',
  'Railways are drawn as ties on a line. A dotted line is a railway not yet built.',
  'A dash dot line at the edge of the map is the edge of the war. The land beyond it takes no part.',
  'Hills and shading make the map look like real land. They are scenery only. They do not slow armies or help defenders.',
  'The thin lines of latitude and longitude help you find your way. Distance in the game is counted in provinces, not degrees.',
  'Blank paper is land you have never seen, and paper sea is water you have not charted. A faded brown, hatched province is what you saw last time; it may have changed.'
];

test('legend: the first #map-legend list is the 5.6 treatment list word for word; the marks list keeps the other tokens', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const legendAt = html.indexOf('<div id="map-legend"');
  assert.ok(legendAt !== -1, '#map-legend present');
  const legend = html.slice(legendAt, html.indexOf('</div>', legendAt));
  const ulAt = legend.indexOf('<ul class="legend-list');
  const firstList = legend.slice(ulAt, legend.indexOf('</ul>', ulAt));
  const items = [];
  const re = /<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(firstList)) !== null) items.push(m[1].replace(/\s+/g, ' ').trim());
  assert.strictEqual(items.length, 10);
  assert.deepStrictEqual(items, STEP13_LEGEND);
  ['capital star', 'order marker', '2x24'].forEach(function (tok) {
    assert.ok(legend.indexOf(tok) !== -1, '#map-legend keeps ' + tok);
  });
});

test('chart label wiring: #map-chart-labels in index.html, registered in main.js from the MapCanvas exports, layer rule in style.css', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  assert.ok(html.indexOf('id="map-labels"></div>\n        <div id="map-chart-labels"></div>') !== -1, '#map-chart-labels follows #map-labels');
  assert.ok(main.indexOf("'map-chart-labels'") !== -1, 'main.js registers map-chart-labels');
  ['GRATICULE_MERIDIANS', 'GRATICULE_PARALLELS', 'SCALE_BAR', 'NORTH_ARROW', 'buildFurnitureOps'].forEach(function (name) {
    assert.ok(main.indexOf('MapCanvas.' + name) !== -1, 'main.js reads MapCanvas.' + name);
  });
  assert.ok(main.indexOf('furnitureOps') !== -1, 'AshesFogDebug reports furnitureOps');
  assert.ok(/#map-chart-labels\s*\{[^}]*z-index:\s*5/.test(css), 'style.css has the #map-chart-labels layer at z-index 5');
});

// Cycle 23 Step 14: fog on the chart (MAP_TREATMENT 6.2 to 6.4).

// Seed 42 view with p5_0 flipped to dark. Neither seed 42 nor the worst case
// fixture has a dark province holding river samples (the rivers run down the
// p5 column, live in both), so the river redraw is pinned on this view built
// from the real modules. p5_0 is also coastal, so it carries every redraw list.
function step14RiverView() {
  const view = playerView(Sim.createGame(42));
  const target = view.provinces.find(function (p) { return p.id === 'p5_0'; });
  assert.strictEqual(target.intel, 'live', 'p5_0 starts live on seed 42');
  target.intel = 'dark';
  return view;
}

function step14Recorder() {
  const rec = { fills: [], strokes: [], clips: 0, ellipses: 0, arcs: 0, dash: [] };
  const ctx = {
    strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1, lineJoin: 'miter', lineCap: 'butt',
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {},
    clip() { rec.clips++; },
    ellipse() { rec.ellipses++; },
    arc() { rec.arcs++; },
    setLineDash(d) { rec.dash = d.slice(); },
    fill() { rec.fills.push({ style: this.fillStyle, alpha: this.globalAlpha }); },
    stroke() { rec.strokes.push({ style: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth, cap: this.lineCap, dash: rec.dash.slice() }); }
  };
  return { ctx: ctx, rec: rec };
}

test('fog clip coverage: polygons[0] is the chart hit polygon and each further polygon is one of the province sea sector sea parts (seed 42 and fixture)', () => {
  [playerView(Sim.createGame(42)), fogFixtureView()].forEach(function (view) {
    const geom = AshesMapGeometry.buildGeometry(view);
    const chart = AshesChart.buildChart(geom);
    const ops = AshesMapCanvas.buildFogOps(geom, view);
    assert.ok(ops.length > 0);
    ops.forEach(function (op) {
      const hit = flatOf(chart.hitPolygons[op.id]);
      assert.deepStrictEqual(op.polygons[0], hit, 'polygons[0] is the hit polygon for ' + op.id);
      assert.deepStrictEqual(op.polygon, hit, 'polygon stays the hit polygon for ' + op.id);
      const seaParts = chart.sectors.filter(function (s) { return s.sea && s.provinceId === op.id; })
        .map(function (s) { return flatOf(s.seaPart); });
      assert.strictEqual(op.polygons.length, 1 + seaParts.length, 'one polygon plus one per sea sector for ' + op.id);
      const used = {};
      op.polygons.slice(1).forEach(function (poly) {
        const k = seaParts.findIndex(function (sp, i) { return !used[i] && JSON.stringify(sp) === JSON.stringify(poly); });
        assert.ok(k >= 0, op.id + ' sea polygon equals a chart sector sea part exactly');
        used[k] = true;
      });
    });
  });
});

test('fog ink redraw truth: river runs follow the chart river samples inside the hit polygon; border paths are the incident chart edge paths', () => {
  const views = [playerView(Sim.createGame(42)), fogFixtureView(), step14RiverView()];
  let riverOps = 0;
  views.forEach(function (view, vi) {
    const geom = AshesMapGeometry.buildGeometry(view);
    const chart = AshesChart.buildChart(geom);
    const ops = AshesMapCanvas.buildFogOps(geom, view);
    ops.filter(function (op) { return op.kind === 'unknown'; }).forEach(function (op) {
      const hitPts = chart.hitPolygons[op.id];
      const expectBorders = chart.chartEdges.filter(function (e) { return e.a === op.id || e.b === op.id; })
        .map(function (e) { return flatOf(e.path); });
      assert.deepStrictEqual(op.borderPaths, expectBorders, 'border paths for ' + op.id);
      let samplesInside = 0;
      chart.rivers.edges.forEach(function (e) {
        e.samples.forEach(function (q) { if (AshesChart.pointInPolygon(q, hitPts)) samplesInside++; });
      });
      if (vi < 2) assert.strictEqual(samplesInside, 0, 'no river sample in dark ' + op.id + ' on seed 42 or the fixture');
      assert.strictEqual(op.riverPaths.length > 0, samplesInside > 1, 'river paths exist where river samples do for ' + op.id);
      op.riverPaths.forEach(function (rp) {
        assert.ok(rp.length >= 4, 'a river run has at least 2 points');
        for (let i = 0; i < rp.length; i += 2) {
          assert.ok(AshesChart.pointInPolygon({ x: rp[i], y: rp[i + 1] }, hitPts), op.id + ' river point inside the hit polygon');
        }
        const run = JSON.stringify(rp).slice(1, -1);
        assert.ok(chart.rivers.edges.some(function (e) {
          return JSON.stringify(flatOf(e.samples)).indexOf(run) !== -1;
        }), op.id + ' river run is consecutive samples of one river edge');
      });
      if (op.riverPaths.length) riverOps++;
    });
    if (vi === 2) {
      const p50 = ops.find(function (op) { return op.id === 'p5_0'; });
      assert.ok(p50 && p50.kind === 'unknown', 'p5_0 is dark on the river view');
      assert.ok(p50.coastPaths.length > 0 && p50.waterLines.length === 3, 'p5_0 is coastal');
      assert.ok(p50.riverPaths.length > 0, 'p5_0 carries a river path');
    }
  });
  assert.ok(riverOps > 0, 'at least one dark coastal province draws a river');
});

test('fog draw rule: remembered fills #C2AE86 at 0.65 and hatches Ink at 0.30; unknown fills #DCCDA8 at 1 then coast 0.70, water 0.25, river 0.60, dashed borders 0.35; no ellipse or arc', () => {
  const scaleX = 160;
  const fixture = fogFixtureView();
  const fGeom = AshesMapGeometry.buildGeometry(fixture);
  const remembered = AshesMapCanvas.buildFogOps(fGeom, fixture).find(function (op) { return op.kind === 'remembered'; });
  const r = step14Recorder();
  AshesMapCanvas.drawFogOps(r.ctx, [remembered], scaleX, scaleX);
  assert.strictEqual(r.rec.fills.length, 1, 'one wash fill over the union clip');
  assert.deepStrictEqual(r.rec.fills[0], { style: '#C2AE86', alpha: 0.65 });
  const hatch = r.rec.strokes.filter(function (s) { return s.style === '#2B2620'; });
  assert.strictEqual(hatch.length, 1, 'one hatch stroke');
  assert.strictEqual(hatch[0].alpha, 0.30);
  assert.strictEqual(hatch[0].width, 1.5);
  const band = r.rec.strokes.filter(function (s) { return s.style === '#6E6E66'; });
  assert.strictEqual(band.length, 1, 'one gray owner band');
  assert.strictEqual(band[0].alpha, 0.5);

  const view = step14RiverView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const unknown = AshesMapCanvas.buildFogOps(geom, view).find(function (op) { return op.id === 'p5_0'; });
  const u = step14Recorder();
  AshesMapCanvas.drawFogOps(u.ctx, [unknown], scaleX, scaleX);
  assert.deepStrictEqual(u.rec.fills, [{ style: '#DCCDA8', alpha: 1 }], 'one opaque Unknown fill');
  assert.ok(u.rec.clips >= 1, 'the redraw is clipped');
  assert.strictEqual(u.rec.ellipses, 0, 'no wisps');
  assert.strictEqual(u.rec.arcs, 0, 'no puffs');
  assert.strictEqual(u.rec.strokes.length, 4, 'coast, water, river, border passes');
  u.rec.strokes.forEach(function (s) { assert.strictEqual(s.style, '#2B2620', 'redraw in chart Ink'); });
  const [coast, water, river, border] = u.rec.strokes;
  assert.strictEqual(coast.alpha, 0.70);
  assert.strictEqual(coast.width, 0.008 * scaleX);
  assert.deepStrictEqual(coast.dash, []);
  assert.strictEqual(water.alpha, 0.25);
  assert.strictEqual(water.width, 1);
  assert.strictEqual(river.alpha, 0.60);
  assert.strictEqual(river.width, 0.006 * scaleX);
  assert.deepStrictEqual(river.dash, []);
  assert.strictEqual(border.alpha, 0.35);
  assert.strictEqual(border.cap, 'round');
  assert.deepStrictEqual(border.dash, [0.040 * scaleX, 0.025 * scaleX], 'province border dash');
  assert.deepStrictEqual(u.rec.dash, [], 'dash reset after the border pass');
});

test('fog hash: covers the chart fog op shape, deterministic on the fixture, graticule furniture hash unchanged', () => {
  const view = fogFixtureView();
  const geom = AshesMapGeometry.buildGeometry(view);
  const ops = AshesMapCanvas.buildFogOps(geom, view);
  const base = AshesMapCanvas.fogOpsHash(ops);
  assert.strictEqual(AshesMapCanvas.fogOpsHash(AshesMapCanvas.buildFogOps(geom, view)), base, 'deterministic');
  const idx = ops.findIndex(function (op) { return op.kind === 'unknown' && op.waterLines.length === 3; });
  assert.ok(idx >= 0, 'fixture has a dark coastal op');
  ['waterLines', 'coastPaths', 'borderPaths'].forEach(function (field) {
    const cloned = JSON.parse(JSON.stringify(ops));
    cloned[idx][field][0][0] += 0.01;
    assert.notStrictEqual(AshesMapCanvas.fogOpsHash(cloned), base, 'editing ' + field + ' changes the hash');
  });
  const dropped = JSON.parse(JSON.stringify(ops));
  dropped[idx].polygons.pop();
  assert.notStrictEqual(AshesMapCanvas.fogOpsHash(dropped), base, 'dropping a sea sector polygon changes the hash');
  // Measured before Step 14 on the Step 13 module: furniture alone hashed 7077c178.
  assert.strictEqual(AshesMapCanvas.fogOpsHash(AshesMapCanvas.buildFurnitureOps(geom)), '7077c178');
});

// ---------- Cycle 23 Step 16a: attack beats (K-BEAT) ----------

const AshesBeats = require('../js/beats.js');

function beatNeighbors() {
  const s = Sim.createGame(42);
  const out = {};
  Object.keys(s.provinces).forEach(function (pid) {
    out[pid] = Sim.neighborsOf(s, s.provinces[pid]).map(function (p) { return p.id; });
  });
  return out;
}

function beatSnap(id, nation, provinceId, orderTarget) {
  return { id: id, nation: nation, provinceId: provinceId, orderTarget: orderTarget == null ? null : orderTarget };
}

function beatPost(id, nation, provinceId, lastCombatDay) {
  return { id: id, nation: nation, provinceId: provinceId, lastCombatDay: lastCombatDay };
}

function beatRecord(kind, targetId, aNation, bNation) {
  return { kind: kind, targetId: targetId, aNation: aNation, bNation: bNation };
}

test('beats: a player attack by snapshot order lights its edge once; the defender at the target gets no edge', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('battle', 'p5_3', 'player', 'enemy')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p5_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }]);
});

test('beats: a repelled enemy attacker lights its edge by post-position (post equals origin)', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', null), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('battle', 'p4_3', 'enemy', 'player')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p5_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }]);
});

test('beats: a capturing enemy attacker lights its edge by post-position (post equals target)', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', null), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('battle', 'p4_3', 'enemy', 'player')],
    postUnits: [beatPost(2, 'enemy', 'p4_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }]);
});

test('beats: a defender alone at the battle target gets no edge', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', null)],
    records: [beatRecord('battle', 'p4_3', 'enemy', 'player')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, []);
});

test('beats: a drawn defender ordered elsewhere gets no order edge (defense drawn first)', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p4_2'), beatSnap(2, 'enemy', 'p5_3', null), beatSnap(3, 'enemy', 'p4_2', null)],
    records: [beatRecord('battle', 'p4_3', 'enemy', 'player'), beatRecord('battle', 'p4_2', 'player', 'enemy')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p5_3', 5), beatPost(3, 'enemy', 'p4_2', 4)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }], 'only the enemy attack edge, never p4_2 to p4_3');
});

test('beats: a meeting lights one deduped edge from the snapshot order and the enemy pairing', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('meeting', null, 'player', 'enemy')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p5_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }]);
  const enemyOnly = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('meeting', null, 'enemy', 'player')],
    postUnits: [beatPost(2, 'enemy', 'p5_3', 5), beatPost(1, 'player', 'p4_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(enemyOnly, [{ a: 'p4_3', b: 'p5_3' }], 'record nation order does not matter');
});

test('beats: a destroyed ordered group still lights its edge', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p5_3', null)],
    records: [beatRecord('battle', 'p5_3', 'player', 'enemy')],
    postUnits: [beatPost(2, 'enemy', 'p5_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }]);
  const homeAttacked = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3')],
    records: [beatRecord('battle', 'p5_3', 'player', 'enemy'), beatRecord('battle', 'p4_3', 'enemy', 'player')],
    postUnits: [],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(homeAttacked, [], 'a unit lost at a home battle was a defender, not an attacker');
});

test('beats: a clash record lights both nations edges into the empty province', () => {
  const edges = AshesBeats.deriveBeatEdges({
    fightDay: 5,
    snapshot: [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p6_3', null)],
    records: [beatRecord('clash', 'p5_3', 'player', 'enemy')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p6_3', 5)],
    neighbors: beatNeighbors()
  });
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }, { a: 'p5_3', b: 'p6_3' }]);
});

test('beats: no records, or records with no matching fought units, give no edges; other kinds are ignored', () => {
  const neighbors = beatNeighbors();
  const snapshot = [beatSnap(1, 'player', 'p4_3', 'p5_3'), beatSnap(2, 'enemy', 'p5_3', null)];
  assert.deepStrictEqual(AshesBeats.deriveBeatEdges({
    fightDay: 5, snapshot: snapshot, records: [],
    postUnits: [beatPost(1, 'player', 'p5_3', null), beatPost(2, 'enemy', 'p6_3', null)], neighbors: neighbors
  }), []);
  assert.deepStrictEqual(AshesBeats.deriveBeatEdges({
    fightDay: 5, snapshot: snapshot, records: [beatRecord('battle', 'p0_0', 'enemy', 'player')],
    postUnits: [beatPost(1, 'player', 'p4_3', 3), beatPost(2, 'enemy', 'p5_3', 3)], neighbors: neighbors
  }), []);
  assert.deepStrictEqual(AshesBeats.deriveBeatEdges({
    fightDay: 5, snapshot: snapshot, records: [beatRecord('move', 'p5_3', 'player', 'enemy')],
    postUnits: [beatPost(1, 'player', 'p4_3', 5), beatPost(2, 'enemy', 'p5_3', 5)], neighbors: neighbors
  }), []);
});

test('beats: several units on one edge dedupe, and edges sort by a then b; the input is not mutated', () => {
  const input = {
    fightDay: 9,
    snapshot: [
      beatSnap(7, 'player', 'p5_4', 'p5_3'), beatSnap(3, 'player', 'p4_3', 'p5_3'),
      beatSnap(4, 'player', 'p4_3', 'p5_3'), beatSnap(5, 'player', 'p5_3', 'p4_3'),
      beatSnap(9, 'enemy', 'p5_3', null)
    ],
    records: [beatRecord('battle', 'p5_3', 'player', 'enemy')],
    postUnits: [beatPost(7, 'player', 'p5_4', 9), beatPost(3, 'player', 'p4_3', 9), beatPost(4, 'player', 'p4_3', 9), beatPost(9, 'enemy', 'p5_3', 9)],
    neighbors: beatNeighbors()
  };
  const before = JSON.stringify(input);
  const edges = AshesBeats.deriveBeatEdges(input);
  assert.deepStrictEqual(edges, [{ a: 'p4_3', b: 'p5_3' }, { a: 'p5_3', b: 'p5_4' }]);
  assert.strictEqual(JSON.stringify(input), before, 'input unchanged');
});

test('beat ops: buildBeatOps path is the chart edge path for a real pair, and nothing for a non pair', () => {
  const c = step9Chart(42);
  const edge = c.chart.chartEdges.find(function (e) { return (e.a === 'p4_3' && e.b === 'p5_3') || (e.a === 'p5_3' && e.b === 'p4_3'); });
  assert.ok(edge, 'p4_3 and p5_3 share a chart edge');
  const ops = AshesMapCanvas.buildBeatOps(c.geom, [{ a: 'p4_3', b: 'p5_3' }]);
  assert.strictEqual(ops.length, 1);
  assert.deepStrictEqual(ops[0], { kind: 'beat', a: 'p4_3', b: 'p5_3', path: flatOf(edge.path) });
  assert.deepStrictEqual(AshesMapCanvas.buildBeatOps(c.geom, [{ a: 'p0_0', b: 'p9_6' }]), []);
  const two = AshesMapCanvas.buildBeatOps(c.geom, [{ a: 'p5_3', b: 'p6_3' }, { a: 'p4_3', b: 'p5_3' }]);
  assert.deepStrictEqual(two.map(function (op) { return op.a + '|' + op.b; }), ['p4_3|p5_3', 'p5_3|p6_3'], 'sorted by a then b');
});

test('beat ops: drawBeatOps strokes wide then core in BEAT_COLOR at the phase alphas and widths', () => {
  const c = step9Chart(42);
  const ops = AshesMapCanvas.buildBeatOps(c.geom, [{ a: 'p4_3', b: 'p5_3' }]);
  const scaleX = 160;
  [[1, 0.35, 0.95], [2, 0.15, 0.45]].forEach(function (row) {
    const r = step14Recorder();
    AshesMapCanvas.drawBeatOps(r.ctx, ops, scaleX, scaleX, row[0]);
    assert.strictEqual(r.rec.strokes.length, 2, 'two strokes in phase ' + row[0]);
    const [wide, core] = r.rec.strokes;
    assert.strictEqual(wide.style, AshesMapCanvas.BEAT_COLOR);
    assert.strictEqual(core.style, AshesMapCanvas.BEAT_COLOR);
    assert.strictEqual(wide.alpha, row[1]);
    assert.strictEqual(core.alpha, row[2]);
    assert.strictEqual(wide.width, 0.09 * scaleX);
    assert.strictEqual(core.width, 0.03 * scaleX);
    assert.strictEqual(r.ctx.lineJoin, 'round');
    assert.strictEqual(r.ctx.globalAlpha, 1, 'alpha reset after');
    assert.strictEqual(r.rec.fills.length, 0, 'no fills');
  });
  assert.strictEqual(AshesMapCanvas.BEAT_COLOR, '#FFF3C4');
  assert.strictEqual(AshesMapCanvas.BEAT_WIDE_W, 0.09);
  assert.strictEqual(AshesMapCanvas.BEAT_CORE_W, 0.03);
});

test('beat color: BEAT_COLOR luma sits in the State lights band 225 to 255', () => {
  const l = hexLuma(AshesMapCanvas.BEAT_COLOR);
  assert.ok(l >= 225 && l <= 255, 'beat luma ' + l);
});

test('lint: js/beats.js contains no banned presentation strings and never requires the sim', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'beats.js'), 'utf8');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'beats.js must not contain ' + str);
  });
  assert.ok(src.indexOf('require(') === -1, 'beats.js requires nothing');
  assert.ok(!/[\u2013\u2014]/.test(src), 'no en or em dashes');
});

// Corner vignette (Cycle 23 Step 17a, K-ATM). AshesChart, step9Chart, flatOf,
// and hexLuma are defined above in this file.
function step17aAlphaAt(chart, r, x, y) {
  const ext = chart.extent;
  const px = Math.min(r.width - 1, Math.max(0, Math.floor((x - ext.x0) / (ext.x1 - ext.x0) * r.width)));
  const py = Math.min(r.height - 1, Math.max(0, Math.floor((y - ext.y0) / (ext.y1 - ext.y0) * r.height)));
  return r.rgba[(py * r.width + px) * 4 + 3];
}

function step17aInsideFlat(x, y, flat) {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[2 * i], yi = flat[2 * i + 1];
    const xj = flat[2 * j], yj = flat[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test('vignette: raster shape follows the extent formula and two builds are byte identical (seed 42)', () => {
  const c = step9Chart(42);
  const ext = c.chart.extent;
  const res = AshesMapCanvas.VIGNETTE_RES;
  const a = AshesMapCanvas.buildVignetteRaster(c.chart);
  const b = AshesMapCanvas.buildVignetteRaster(step9Chart(42).chart);
  assert.strictEqual(a.width, Math.round((ext.x1 - ext.x0) * res));
  assert.strictEqual(a.height, Math.round((ext.y1 - ext.y0) * res));
  assert.ok(a.rgba instanceof Uint8ClampedArray, 'rgba is a Uint8ClampedArray');
  assert.strictEqual(a.rgba.length, a.width * a.height * 4);
  assert.ok(Buffer.from(a.rgba.buffer).equals(Buffer.from(b.rgba.buffer)), 'byte identical rgba');
  assert.strictEqual(a.maxAlpha, b.maxAlpha);
  assert.strictEqual(AshesMapCanvas.VIGNETTE_MAX_ALPHA, 0.045);
  assert.strictEqual(AshesMapCanvas.VIGNETTE_RANGE, 1.6);
  assert.strictEqual(AshesMapCanvas.VIGNETTE_RES, 8);
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (a.rgba[i + 3] === 0) continue;
    assert.deepStrictEqual([a.rgba[i], a.rgba[i + 1], a.rgba[i + 2]], [43, 38, 32], 'ink rgb at ' + i);
  }
});

test('vignette: top-left corner pixel is darkest, the extent center is clear, maxAlpha is capped', () => {
  const c = step9Chart(42);
  const r = AshesMapCanvas.buildVignetteRaster(c.chart);
  assert.ok(r.rgba[3] >= 10, 'top-left corner alpha byte ' + r.rgba[3]);
  assert.ok(r.rgba[(r.width * r.height - 1) * 4 + 3] >= 10, 'bottom-right corner alpha byte');
  const cx = Math.floor(r.width / 2);
  const cy = Math.floor(r.height / 2);
  assert.strictEqual(r.rgba[(cy * r.width + cx) * 4 + 3], 0, 'extent center alpha 0');
  assert.ok(r.maxAlpha > 0.04, 'maxAlpha ' + r.maxAlpha);
  assert.ok(r.maxAlpha <= AshesMapCanvas.VIGNETTE_MAX_ALPHA, 'maxAlpha at most the cap');
});

test('vignette: every pixel whose center lies in a hit polygon is clear, and a sea margin point is darkened', () => {
  const c = step9Chart(42);
  const chart = c.chart;
  const ext = chart.extent;
  const r = AshesMapCanvas.buildVignetteRaster(chart);
  const flats = Object.keys(chart.hitPolygons).map(function (id) { return flatOf(chart.hitPolygons[id]); });
  const inAny = function (x, y) { return flats.some(function (f) { return step17aInsideFlat(x, y, f); }); };
  // p0_3 lattice center (0.5, 3.5) lies inside its own hit polygon.
  assert.ok(step17aInsideFlat(0.5, 3.5, flatOf(chart.hitPolygons.p0_3)), 'p0_3 contains (0.5, 3.5)');
  assert.strictEqual(step17aAlphaAt(chart, r, 0.5, 3.5), 0, 'p0_3 center alpha 0');
  // Sea margin inside the neatline near the top-left: (-0.9, -0.9).
  assert.ok(!inAny(-0.9, -0.9), '(-0.9, -0.9) is outside every hit polygon');
  assert.ok(step17aAlphaAt(chart, r, -0.9, -0.9) > 0, 'sea margin point darkened');
  // Full mask sweep over every raster pixel center.
  let masked = 0;
  for (let py = 0; py < r.height; py++) {
    const y = ext.y0 + (py + 0.5) * (ext.y1 - ext.y0) / r.height;
    for (let px = 0; px < r.width; px++) {
      const x = ext.x0 + (px + 0.5) * (ext.x1 - ext.x0) / r.width;
      if (!inAny(x, y)) continue;
      masked++;
      assert.strictEqual(r.rgba[(py * r.width + px) * 4 + 3], 0, 'province pixel clear at ' + px + ',' + py);
    }
  }
  assert.ok(masked > 0, 'some pixels fall inside provinces');
});

test('vignette cap math: VIGNETTE_MAX_ALPHA times the FRAME_PAPER to INK luma gap is at most 8 levels', () => {
  const K = AshesChart.CHART_CONSTANTS;
  const gap = hexLuma(K.FRAME_PAPER) - hexLuma(K.INK);
  // Exact product is 0.045 * 177.82 = 8.0019 (216.45 - 38.63), so the
  // nominal cap bound is 8.002; the written raster sits well under 8.
  const drop = AshesMapCanvas.VIGNETTE_MAX_ALPHA * gap;
  assert.ok(drop <= 8.002, 'nominal max luma drop ' + drop);
  assert.ok(drop > 7.9, 'cap is near 8, not trivially small: ' + drop);
  const r = AshesMapCanvas.buildVignetteRaster(step9Chart(42).chart);
  let maxByte = 0;
  for (let i = 3; i < r.rgba.length; i += 4) if (r.rgba[i] > maxByte) maxByte = r.rgba[i];
  assert.ok(maxByte / 255 * gap <= 8, 'written byte drop ' + (maxByte / 255 * gap));
  assert.ok(r.maxAlpha * gap <= 8, 'written maxAlpha drop ' + (r.maxAlpha * gap));
});

test('vignette wiring pin: renderBaseCanvas draws the vignette after the chart over ops and before the furniture', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const start = src.indexOf('function renderBaseCanvas(');
  assert.ok(start !== -1, 'renderBaseCanvas found');
  const end = src.indexOf('\n  }\n', start);
  const body = src.slice(start, end);
  const over = body.indexOf('drawChartOps(ctx, chartOps.over');
  const vig = body.indexOf('drawVignette(');
  const furn = body.indexOf('drawChartFurniture(');
  assert.ok(over !== -1 && vig !== -1 && furn !== -1, 'all three calls present in renderBaseCanvas');
  assert.ok(over < vig && vig < furn, 'over ops, then vignette, then furniture');
  BANNED_PRESENTATION_STRINGS.forEach(str => {
    assert.ok(src.indexOf(str) === -1, 'map-canvas.js must not contain ' + str);
  });
});

// Cycle 23 zoom pan step: the player can pan the board at high zoom.
test('pan css pin: #map-viewport scrolls horizontally and the pannable cursor rules exist', () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  const m = css.match(/#map-viewport\s*\{([^}]*)\}/);
  assert.ok(m, '#map-viewport rule found');
  assert.ok(/overflow-x:\s*auto/.test(m[1]), 'overflow-x auto: ' + m[1]);
  assert.ok(/overflow-y:\s*hidden/.test(m[1]), 'overflow-y hidden: ' + m[1]);
  assert.ok(!/overflow:\s*hidden/.test(m[1]), 'no blanket overflow hidden left');
  assert.ok(/#map-viewport\.pannable\s*\{[^}]*cursor:\s*grab;/.test(css), 'pannable cursor grab');
  assert.ok(/#map-viewport\.pannable\.dragging\s*\{[^}]*cursor:\s*grabbing;/.test(css), 'dragging cursor grabbing');
});

test('pan hint pin: index.html carries the pan sentence verbatim beside the zoom controls', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const zoomRow = html.indexOf('class="map-zoom"');
  const hint = html.indexOf('<span id="pan-hint">When zoomed in, drag the map or use the bar under it to pan.</span>');
  const viewport = html.indexOf('id="map-viewport"');
  assert.ok(zoomRow !== -1 && hint !== -1 && viewport !== -1, 'zoom row, hint, and viewport present');
  assert.ok(zoomRow < hint && hint < viewport, 'hint sits in the zoom row, above the map');
});

test('pan wiring pin: main.js drags past a 6 px threshold, swallows only the post-pan click, and keeps zoom intact', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  assert.ok(src.indexOf('var PAN_THRESHOLD_PX = 6;') !== -1, 'threshold 6 px');
  assert.ok(src.indexOf('var PAN_CLICK_SWALLOW_MS = 350;') !== -1, 'swallow window 350 ms');
  assert.ok(/el\.mapViewport\.addEventListener\('pointerdown', function \(e\) \{\s*if \(mapZoom <= 1/.test(src), 'no pan starts at zoom 1 or below');
  assert.ok(src.indexOf('Math.sqrt(dx * dx + dy * dy) <= PAN_THRESHOLD_PX') !== -1, 'threshold gates the pan');
  assert.ok(src.indexOf('el.mapViewport.scrollLeft = pan.startLeft - dx;') !== -1, 'scrollLeft follows the drag');
  assert.ok(src.indexOf('el.mapViewport.scrollTop = pan.startTop - dy;') !== -1, 'scrollTop follows the drag');
  assert.ok(src.indexOf('setPointerCapture(e.pointerId)') !== -1, 'pointer capture');
  assert.ok(src.indexOf("addEventListener('pointerup', endPan)") !== -1 && src.indexOf("addEventListener('pointercancel', endPan)") !== -1, 'pointerup and pointercancel end the gesture');
  // Only a real pan stamps panEndedAt, so a plain click is never swallowed.
  const endStart = src.indexOf('function endPan(e)');
  const endBody = src.slice(endStart, src.indexOf('\n  }\n', endStart));
  assert.ok(/if \(pan\.dragging\) \{\s*panEndedAt = Date\.now\(\);/.test(endBody), 'only a drag stamps panEndedAt');
  const clickAt = src.indexOf("el.mapViewport.addEventListener('click', function (e) {");
  assert.ok(clickAt !== -1, 'viewport click listener');
  const clickBody = src.slice(clickAt, src.indexOf('}, true);', clickAt) + 9);
  assert.ok(clickBody.indexOf('Date.now() - panEndedAt <= PAN_CLICK_SWALLOW_MS') !== -1, 'swallow window checked');
  assert.ok(clickBody.indexOf('e.stopPropagation();') !== -1 && clickBody.indexOf('e.preventDefault();') !== -1, 'stops the click');
  assert.ok(/\}, true\);$/.test(clickBody), 'capture phase');
  const az = src.indexOf('function applyZoom(newIndex)');
  const azBody = src.slice(az, src.indexOf('\n  }\n', az));
  assert.ok(azBody.indexOf("el.mapBoard.style.transform = 'scale(' + mapZoom + ')';") !== -1, 'transform unchanged');
  assert.ok(/if \(mapZoom <= 1\) \{\s*el\.mapViewport\.scrollLeft = 0;\s*el\.mapViewport\.scrollTop = 0;/.test(azBody), 'scroll resets at zoom 1 or below');
  assert.ok(azBody.indexOf("el.mapViewport.classList.toggle('pannable', mapZoom > 1);") !== -1, 'pannable exactly above 1');
  assert.ok(azBody.indexOf('scheduleSettle();') !== -1, 'settle still scheduled');
  assert.ok(src.indexOf('maxScrollLeft: Math.max(0, vp.scrollWidth - vp.clientWidth)') !== -1, 'debug maxScrollLeft clamped');
  assert.ok(src.indexOf("el.mapViewport.addEventListener('scroll', updatePanDebug);") !== -1, 'debug follows scroll');
});

// Step 18a: tools/master-sheet.js draws panel P2 in code and checks the
// master sheet v2 manifest.
const { describe } = require('node:test');
const zlibMs = require('node:zlib');
const MasterSheet = require('../tools/master-sheet.js');

// Decodes the PNG layout buildP2 writes: chunks after the signature, one
// IDAT, color type 2, filter byte 0 on every scanline.
function decodeMasterSheetPng(buf) {
  let off = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlibMs.inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 3;
  return {
    width, height, raw, stride,
    pixel(x, y) {
      const i = y * stride + 1 + x * 3;
      return [raw[i], raw[i + 1], raw[i + 2]];
    }
  };
}

describe('master sheet tool (tools/master-sheet.js)', () => {
  test('master sheet palette: PALETTE carries the five fixed hex values exactly, in order', () => {
    assert.deepStrictEqual(MasterSheet.PALETTE.map(p => [p.name, p.hex]), [
      ['Paper', '#E6D8B5'], ['Ink', '#2B2620'], ['Vessari blue', '#2E6FD8'],
      ['Khessite red', '#C8372D'], ['Ember', '#F29A2E']
    ]);
    assert.deepStrictEqual(MasterSheet.REQUIRED_PANELS, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']);
    assert.deepStrictEqual(MasterSheet.BANDS.map(b => b.name), ['Ink', 'Terrain', 'Last seen', 'Unknown', 'State lights']);
  });

  test('master sheet luma: Ink sits in the Ink band and Vessari blue in the Terrain band', () => {
    const band = name => MasterSheet.BANDS.find(b => b.name === name);
    const hex = name => MasterSheet.PALETTE.find(p => p.name === name).hex;
    const ink = MasterSheet.luma(MasterSheet.hexToRgb(hex('Ink')));
    const blue = MasterSheet.luma(MasterSheet.hexToRgb(hex('Vessari blue')));
    assert.deepStrictEqual(MasterSheet.hexToRgb('#2B2620'), { r: 43, g: 38, b: 32 });
    assert.ok(ink >= band('Ink').min && ink <= band('Ink').max, 'Ink luma ' + ink + ' in 0 to 40');
    assert.ok(blue >= band('Terrain').min && blue <= band('Terrain').max, 'Vessari blue luma ' + blue + ' in 60 to 150');
    assert.strictEqual(MasterSheet.luma({ r: 255, g: 255, b: 255 }), 255);
  });

  test('master sheet P2: buildP2 is a 768 x 768 PNG with swatches on top and a non-decreasing gray ramp below', () => {
    const png = MasterSheet.buildP2();
    assert.ok(Buffer.isBuffer(png));
    assert.deepStrictEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const img = decodeMasterSheetPng(png);
    assert.strictEqual(img.width, 768);
    assert.strictEqual(img.height, 768);
    assert.strictEqual(img.raw.length, 768 * (1 + 768 * 3), '768 scanlines of 1 + 768 * 3 bytes');
    for (let y = 0; y < 768; y++) assert.strictEqual(img.raw[y * img.stride], 0, 'filter byte 0');
    assert.deepStrictEqual(img.pixel(10, 10), [230, 216, 181], 'Paper');
    assert.deepStrictEqual(img.pixel(200, 10), [43, 38, 32], 'Ink');
    assert.deepStrictEqual(img.pixel(10, 400), [0, 0, 0], 'ramp starts black');
    assert.deepStrictEqual(img.pixel(760, 400), [255, 255, 255], 'ramp ends white');
    let prev = -1;
    const seen = new Set();
    for (let x = 0; x < 768; x++) {
      const [r, g, b] = img.pixel(x, 400);
      assert.ok(r === g && g === b, 'ramp is neutral gray');
      assert.ok(r >= prev, 'ramp non-decreasing at x ' + x);
      prev = r;
      seen.add(r);
    }
    assert.strictEqual(seen.size, 13, 'thirteen ramp steps');
    assert.ok(MasterSheet.buildP2().equals(png), 'deterministic');
  });

  test('master sheet manifest: the shipped v2 manifest validates with all ten panels', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'master-sheet', 'v2', 'manifest.json'), 'utf8'));
    const result = MasterSheet.validateManifest(manifest);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.panels.map(p => p.id), MasterSheet.REQUIRED_PANELS);
    assert.strictEqual(result.panels.find(p => p.id === 'P2').status, 'built');
    assert.strictEqual(result.panels.find(p => p.id === 'P6').status, 'built');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, manifest.panels.P2.file)), 'P2 file exists on disk');
    result.panels.forEach(p => {
      assert.ok(p.status === 'built' || p.status === 'sourced', p.id + ' is built or sourced, not ' + p.status);
      assert.ok(fs.existsSync(path.join(REPO_ROOT, p.file)), p.id + ' file exists on disk: ' + p.file);
    });
  });

  test('master sheet manifest: a manifest missing P6 and a built panel naming no file are both rejected', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'master-sheet', 'v2', 'manifest.json'), 'utf8'));
    const noP6 = JSON.parse(JSON.stringify(manifest));
    delete noP6.panels.P6;
    const r1 = MasterSheet.validateManifest(noP6);
    assert.strictEqual(r1.ok, false);
    assert.ok(r1.errors.length > 0 && r1.errors.some(e => e.indexOf('P6') !== -1));
    const noFile = JSON.parse(JSON.stringify(manifest));
    delete noFile.panels.P2.file;
    const r2 = MasterSheet.validateManifest(noFile);
    assert.strictEqual(r2.ok, false);
    assert.ok(r2.errors.length > 0 && r2.errors.some(e => e.indexOf('P2') !== -1));
    assert.strictEqual(MasterSheet.validateManifest(null).ok, false);
    assert.strictEqual(MasterSheet.validateManifest({ version: 'v1', panels: manifest.panels }).ok, false);
  });

  test('master sheet v2 images: every panel PNG is 768 x 768 and the composite is 3072 x 2304 by IHDR', () => {
    const v2 = path.join(REPO_ROOT, 'art-direction', 'master-sheet', 'v2');
    const ihdr = file => {
      const buf = fs.readFileSync(file);
      assert.strictEqual(buf.toString('ascii', 12, 16), 'IHDR', file + ' starts with IHDR');
      return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    };
    MasterSheet.REQUIRED_PANELS.forEach(id => {
      assert.deepStrictEqual(ihdr(path.join(v2, 'panels', id + '.png')), [768, 768], id + ' is 768 x 768');
    });
    assert.deepStrictEqual(ihdr(path.join(v2, 'master-sheet-v2.png')), [3072, 2304], 'composite is 3072 x 2304');
  });
});

// Cycle 23 Step 19a: the TX-LAND bake-off winner (Candidate B) wired into the
// live board.
test('TX-LAND data: js/tx-land-data.js decodes to the committed candidate-b.webp bytes', () => {
  const data = require('../js/tx-land-data.js');
  assert.strictEqual(typeof data, 'string');
  const bytes = Buffer.from(data, 'base64');
  const webp = fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'bakeoff', 'TX-LAND', 'candidate-b.webp'));
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.strictEqual(bytes.length, 165548);
  assert.strictEqual(sha(bytes), sha(webp));
  assert.strictEqual(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(bytes.toString('ascii', 8, 12), 'WEBP');
});

test('TX-LAND constants: alpha 0.35, size 1024, value scale 0.25 matching the source, node state unavailable', () => {
  assert.strictEqual(AshesMapCanvas.TX_LAND_ALPHA, 0.35);
  assert.strictEqual(AshesMapCanvas.TX_LAND_SIZE, 1024);
  assert.strictEqual(AshesMapCanvas.TX_LAND_VALUE_SCALE, 0.25);
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const m = src.match(/var TX_LAND_VALUE_SCALE = ([0-9.]+);/);
  assert.ok(m, 'TX_LAND_VALUE_SCALE is a named constant in js/map-canvas.js');
  assert.strictEqual(Number(m[1]), AshesMapCanvas.TX_LAND_VALUE_SCALE);
  assert.strictEqual(AshesMapCanvas.textureDebug.landState, 'unavailable');
  assert.strictEqual(AshesMapCanvas.textureDebug.landAlpha, 0.35);
  assert.strictEqual(AshesMapCanvas.textureDebug.landSize, 1024);
  assert.strictEqual(AshesMapCanvas.textureDebug.landValueScale, AshesMapCanvas.TX_LAND_VALUE_SCALE);
});

// Structural pin, not a render test: it checks the source text only. Index
// ordering on the file text is used to pin that drawRelief calls
// drawLandTexture after the relief raster drawImage and before the contour
// stroke, and that renderBaseCanvas no longer calls it directly.
test('TX-LAND structural pin: soft-light pattern, drawn inside drawRelief after the relief raster and before the contours', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  assert.ok(src.indexOf("'soft-light'") !== -1);
  assert.ok(src.indexOf('createPattern') !== -1);
  function bodyOf(name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start !== -1, name + ' is defined');
    return src.slice(start, src.indexOf('\n  }\n', start));
  }
  const relief = bodyOf('drawRelief');
  const raster = relief.indexOf('ctx.drawImage(reliefRaster(');
  const tex = relief.indexOf('drawLandTexture(ctx,');
  const contours = relief.indexOf('relief.contours.forEach(');
  assert.ok(raster !== -1 && tex !== -1 && contours !== -1);
  assert.ok(raster < tex, 'drawLandTexture follows the relief raster drawImage');
  assert.ok(tex < contours, 'drawLandTexture precedes the contour drawing');
  assert.strictEqual(relief.indexOf('drawLandTexture(ctx,', tex + 1), -1, 'drawLandTexture is called once in drawRelief');
  assert.strictEqual(bodyOf('renderBaseCanvas').indexOf('drawLandTexture(ctx,'), -1, 'renderBaseCanvas does not call drawLandTexture');
  const mentions = src.split('drawLandTexture(ctx,').length - 1;
  const defs = src.split('function drawLandTexture(ctx,').length - 1;
  assert.strictEqual(defs, 1);
  assert.strictEqual(mentions - defs, 1, 'drawLandTexture has exactly one call site');
});

// Cycle 23 Step 19b: TX-SEA and TX-PAPER, Blender route bakes (Candidate B),
// wired into the live board.
function txDataCheck(file, family, length) {
  const data = require('../js/' + file);
  assert.strictEqual(typeof data, 'string');
  const bytes = Buffer.from(data, 'base64');
  const webp = fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'textures', family, 'candidate-b.webp'));
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.strictEqual(bytes.length, length);
  assert.strictEqual(bytes.length, webp.length);
  assert.strictEqual(sha(bytes), sha(webp));
  assert.strictEqual(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(bytes.toString('ascii', 8, 12), 'WEBP');
}

test('TX-SEA data: js/tx-sea-data.js decodes to the committed candidate-b.webp bytes', () => {
  txDataCheck('tx-sea-data.js', 'TX-SEA', 79032);
});

test('TX-PAPER data: js/tx-paper-data.js decodes to the committed candidate-b.webp bytes', () => {
  txDataCheck('tx-paper-data.js', 'TX-PAPER', 74132);
});

test('TX-SEA and TX-PAPER constants: sea alpha 0.30, sizes 1024, sea value scale matching the source, node states unavailable', () => {
  assert.strictEqual(AshesMapCanvas.TX_SEA_ALPHA, 0.30);
  assert.strictEqual(AshesMapCanvas.TX_SEA_SIZE, 1024);
  assert.strictEqual(AshesMapCanvas.TX_PAPER_SIZE, 1024);
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const m = src.match(/var TX_SEA_VALUE_SCALE = ([0-9.]+);/);
  assert.ok(m, 'TX_SEA_VALUE_SCALE is a named constant in js/map-canvas.js');
  assert.strictEqual(Number(m[1]), AshesMapCanvas.TX_SEA_VALUE_SCALE);
  const dbg = AshesMapCanvas.textureDebug;
  assert.strictEqual(dbg.seaState, 'unavailable');
  assert.strictEqual(dbg.seaAlpha, 0.30);
  assert.strictEqual(dbg.seaSize, 1024);
  assert.strictEqual(dbg.seaValueScale, AshesMapCanvas.TX_SEA_VALUE_SCALE);
  assert.strictEqual(dbg.paperState, 'unavailable');
  assert.strictEqual(dbg.paperSize, 1024);
  // The land fields keep their names and meaning (tools/band-report.js reads landState).
  assert.strictEqual(dbg.landState, 'unavailable');
  assert.strictEqual(dbg.landAlpha, AshesMapCanvas.TX_LAND_ALPHA);
  // The sea is a soft-light overlay; the paper is a plain fill with no soft-light.
  function bodyOf(name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start !== -1, name + ' is defined');
    return src.slice(start, src.indexOf('\n  }\n', start));
  }
  assert.ok(bodyOf('drawSeaTexture').indexOf("'soft-light'") !== -1, 'drawSeaTexture uses soft-light');
  assert.ok(bodyOf('drawSeaTexture').indexOf("clip('evenodd')") !== -1, 'drawSeaTexture clips evenodd');
  assert.strictEqual(bodyOf('drawPaperTexture').indexOf('soft-light'), -1, 'drawPaperTexture has no soft-light');
  assert.ok(bodyOf('drawPaperTexture').indexOf("clip('evenodd')") !== -1, 'drawPaperTexture clips evenodd');
});

// Structural pins, not render tests: they check the source text only. Index
// ordering inside renderBaseCanvas pins that the sea texture follows the
// second drawOps pass and precedes the chart over draw, and that the paper
// texture follows the chart over draw and precedes the vignette.
function renderBaseBody() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const start = src.indexOf('function renderBaseCanvas(');
  assert.ok(start !== -1, 'renderBaseCanvas is defined');
  return { src: src, body: src.slice(start, src.indexOf('\n  }\n', start)) };
}

test('TX-SEA structural pin: drawn in renderBaseCanvas after the second drawOps pass and before the chart over ops', () => {
  const { src, body } = renderBaseBody();
  const second = body.indexOf("drawOps(ctx, opsOfKind(['river', 'river-mouths'])");
  const sea = body.indexOf('drawSeaTexture(ctx,');
  const over = body.indexOf('drawChartOps(ctx, chartOps.over,');
  assert.ok(second !== -1 && sea !== -1 && over !== -1);
  assert.ok(second < sea, 'drawSeaTexture follows the second drawOps pass');
  assert.ok(sea < over, 'drawSeaTexture precedes the chart over ops');
  const mentions = src.split('drawSeaTexture(ctx,').length - 1;
  const defs = src.split('function drawSeaTexture(ctx,').length - 1;
  assert.strictEqual(defs, 1);
  assert.strictEqual(mentions - defs, 1, 'drawSeaTexture has exactly one call site');
});

test('TX-PAPER structural pin: drawn in renderBaseCanvas after the chart over ops and before the vignette', () => {
  const { src, body } = renderBaseBody();
  const over = body.indexOf('drawChartOps(ctx, chartOps.over,');
  const paper = body.indexOf('drawPaperTexture(ctx,');
  const vignette = body.indexOf('drawVignette(ctx,');
  assert.ok(over !== -1 && paper !== -1 && vignette !== -1);
  assert.ok(over < paper, 'drawPaperTexture follows the chart over ops');
  assert.ok(paper < vignette, 'drawPaperTexture precedes the vignette');
  const mentions = src.split('drawPaperTexture(ctx,').length - 1;
  const defs = src.split('function drawPaperTexture(ctx,').length - 1;
  assert.strictEqual(defs, 1);
  assert.strictEqual(mentions - defs, 1, 'drawPaperTexture has exactly one call site');
});

// Cycle 23 Step 19c: TX-FOG-UK and TX-FOG-LS, Blender route bakes
// (Candidate B), wired as pattern fills in drawFogOps (MAP_TREATMENT 6.5).
function txDataHeaderCheck(file, family) {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', file), 'utf8');
  const webp = fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'textures', family, 'candidate-b.webp'));
  const len = src.match(/\/\/ Source byte length: (\d+)/);
  const sha = src.match(/\/\/ Source sha256: ([0-9a-f]{64})/);
  assert.ok(src.indexOf('// Source file: art-direction/textures/' + family + '/candidate-b.webp') !== -1);
  assert.ok(len && sha, file + ' header names byte length and sha256');
  assert.strictEqual(Number(len[1]), webp.length);
  assert.strictEqual(sha[1], crypto.createHash('sha256').update(webp).digest('hex'));
  txDataCheck(file, family, Number(len[1]));
}

test('TX-FOG-UK data: js/tx-foguk-data.js decodes to the committed candidate-b.webp bytes and matches its header', () => {
  txDataHeaderCheck('tx-foguk-data.js', 'TX-FOG-UK');
});

test('TX-FOG-LS data: js/tx-fogls-data.js decodes to the committed candidate-b.webp bytes and matches its header', () => {
  txDataHeaderCheck('tx-fogls-data.js', 'TX-FOG-LS');
});

test('TX-FOG constants: sizes 1024, node states unavailable, fog constants and earlier debug fields unchanged', () => {
  assert.strictEqual(AshesMapCanvas.TX_FOG_UK_SIZE, 1024);
  assert.strictEqual(AshesMapCanvas.TX_FOG_LS_SIZE, 1024);
  const dbg = AshesMapCanvas.textureDebug;
  assert.strictEqual(dbg.fogUkState, 'unavailable');
  assert.strictEqual(dbg.fogUkSize, 1024);
  assert.strictEqual(dbg.fogLsState, 'unavailable');
  assert.strictEqual(dbg.fogLsSize, 1024);
  assert.strictEqual(dbg.landState, 'unavailable');
  assert.strictEqual(dbg.seaState, 'unavailable');
  assert.strictEqual(dbg.paperState, 'unavailable');
  assert.strictEqual(dbg.paperSize, 1024);
  assert.strictEqual(AshesMapCanvas.FOG_UNKNOWN_FILL, '#DCCDA8');
  assert.strictEqual(AshesMapCanvas.FOG_REMEMBERED_FILL, '#C2AE86');
  assert.strictEqual(AshesMapCanvas.FOG_REMEMBERED_ALPHA, 0.65);
});

// Structural pin, not a render test: it checks the source text only. In
// drawFogOps the Unknown branch fills with the TX-FOG-UK pattern when its
// source is ready and the flat FOG_UNKNOWN_FILL otherwise, and the remembered
// branch fills with the TX-FOG-LS pattern at FOG_REMEMBERED_ALPHA and the
// flat FOG_REMEMBERED_FILL otherwise; renderFogCanvas starts both loaders.
test('TX-FOG structural pin: drawFogOps uses the UK pattern for unknown and the LS pattern for remembered, flat fills as the fallback', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  function bodyOf(name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start !== -1, name + ' is defined');
    return src.slice(start, src.indexOf('\n  }\n', start));
  }
  const fog = bodyOf('drawFogOps');
  const unknown = fog.indexOf("op.kind === 'unknown'");
  const remembered = fog.indexOf("op.kind === 'remembered'");
  assert.ok(unknown !== -1 && remembered !== -1 && unknown < remembered);
  const ukFill = "ctx.fillStyle = txFogUkSource ? ctx.createPattern(txFogUkSource, 'repeat') : FOG_UNKNOWN_FILL;";
  const lsFill = "ctx.fillStyle = txFogLsSource ? ctx.createPattern(txFogLsSource, 'repeat') : FOG_REMEMBERED_FILL;";
  const uk = fog.indexOf(ukFill);
  const ls = fog.indexOf(lsFill);
  assert.ok(uk > unknown && uk < remembered, 'the UK pattern fill sits in the unknown branch');
  assert.ok(ls > remembered, 'the LS pattern fill sits in the remembered branch');
  assert.strictEqual(fog.split(ukFill).length - 1, 1);
  assert.strictEqual(fog.split(lsFill).length - 1, 1);
  const ukAlpha = fog.lastIndexOf('ctx.globalAlpha = 1;', uk);
  assert.ok(ukAlpha > unknown, 'the UK fill is drawn at alpha 1');
  const lsAlpha = fog.lastIndexOf('ctx.globalAlpha = FOG_REMEMBERED_ALPHA;', ls);
  assert.ok(lsAlpha > remembered, 'the LS fill is drawn at FOG_REMEMBERED_ALPHA');
  assert.strictEqual(fog.indexOf('ctx.fillStyle = FOG_UNKNOWN_FILL;'), -1, 'no unconditional flat Unknown fill');
  assert.strictEqual(fog.indexOf('ctx.fillStyle = FOG_REMEMBERED_FILL;'), -1, 'no unconditional flat remembered fill');
  const render = bodyOf('renderFogCanvas');
  assert.ok(render.indexOf('startFogUkTexture();') !== -1 && render.indexOf('startFogLsTexture();') !== -1,
    'renderFogCanvas starts both fog texture loaders');
});

// Cycle 23 Step 19d-1: RX01 / RX02 micro relief tile, one Blender route bake
// (tools/bake-rx.py) shared by both, wired per MAP_TREATMENT 7.5.
test('RX data: js/rx-data.js decodes to the committed RX01 candidate-b.webp bytes and matches its header', () => {
  txDataHeaderCheck('rx-data.js', 'RX01');
});

test('RX constants: land alpha 0.5, beyond alpha 0.3, size 1024, 8 steps, value scale matching the source, node state unavailable', () => {
  assert.strictEqual(AshesMapCanvas.RX_ALPHA_LAND, 0.5);
  assert.strictEqual(AshesMapCanvas.RX_ALPHA_BEYOND, 0.3);
  assert.strictEqual(AshesMapCanvas.RX_SIZE, 1024);
  assert.strictEqual(AshesMapCanvas.RX_STEPS, 8);
  assert.strictEqual(AshesMapCanvas.RX_RUG_MIN, 0.25);
  assert.strictEqual(AshesMapCanvas.RX_RUG_MAX, 1.0);
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  const m = src.match(/var RX_VALUE_SCALE = ([0-9.]+);/);
  assert.ok(m, 'RX_VALUE_SCALE is a named constant in js/map-canvas.js');
  assert.strictEqual(Number(m[1]), AshesMapCanvas.RX_VALUE_SCALE);
  assert.ok([1, 0.5, 0.25].indexOf(AshesMapCanvas.RX_VALUE_SCALE) !== -1, 'RX_VALUE_SCALE is a ladder rung');
  const dbg = AshesMapCanvas.textureDebug;
  assert.strictEqual(dbg.rxState, 'unavailable');
  assert.strictEqual(dbg.rxSize, 1024);
  assert.strictEqual(dbg.rxAlphaLand, 0.5);
  assert.strictEqual(dbg.rxAlphaBeyond, 0.3);
  assert.strictEqual(dbg.rxValueScale, AshesMapCanvas.RX_VALUE_SCALE);
  // Earlier fields unchanged.
  assert.strictEqual(dbg.landState, 'unavailable');
  assert.strictEqual(dbg.landAlpha, 0.35);
  assert.strictEqual(dbg.seaAlpha, 0.30);
  assert.strictEqual(AshesMapCanvas.TX_LAND_VALUE_SCALE, 0.25);
  assert.strictEqual(AshesMapCanvas.TX_SEA_VALUE_SCALE, 1);
});

test('RX quantised alpha: exactly 8 distinct steps, monotonic in r, bucket midpoint rule, at most 0.5', () => {
  const C = AshesMapCanvas;
  const width = (C.RX_RUG_MAX - C.RX_RUG_MIN) / C.RX_STEPS;
  const seen = new Set();
  let prev = -Infinity;
  for (let i = 0; i <= 10000; i++) {
    const r = i / 10000;
    const a = C.rxLandAlpha(r);
    assert.ok(a >= prev, 'monotonic at r ' + r);
    assert.ok(a > 0 && a <= 0.5, 'alpha in (0, 0.5] at r ' + r);
    prev = a;
    seen.add(a);
    let k = Math.floor((r - C.RX_RUG_MIN) / width);
    k = Math.max(0, Math.min(C.RX_STEPS - 1, k));
    assert.strictEqual(C.rxBucket(r), k, 'bucket at r ' + r);
    assert.strictEqual(a, 0.5 * (C.RX_RUG_MIN + (k + 0.5) * width), 'midpoint rule at r ' + r);
  }
  assert.strictEqual(seen.size, 8);
  assert.strictEqual(C.rxLandAlpha(C.RX_RUG_MIN), 0.5 * 0.296875);
  assert.strictEqual(C.rxLandAlpha(C.RX_RUG_MAX), 0.5 * 0.953125);
  assert.strictEqual(C.rxLandAlpha(5), 0.5 * 0.953125);
  assert.strictEqual(C.rxLandAlpha(NaN), 0.5 * 0.296875);
  // On a real board every province lands in exactly one zone at its own step.
  const { geom, chart } = step9Chart(42);
  const zones = C.buildRxZones(chart);
  assert.ok(zones.length >= 1 && zones.length <= 8);
  let polys = 0;
  zones.forEach((z, i) => {
    if (i > 0) assert.ok(z.bucket > zones[i - 1].bucket, 'zones ascend by bucket');
    assert.strictEqual(z.alpha, 0.5 * (C.RX_RUG_MIN + (z.bucket + 0.5) * width));
    polys += z.polys.length;
  });
  assert.strictEqual(polys, geom.provinces.length);
  geom.provinces.forEach(p => {
    const z = zones.find(q => q.bucket === C.rxBucket(chart.relief.ruggedness[p.id]));
    assert.ok(z, p.id + ' has a zone');
  });
});

// Structural pins, not render tests: they check the source text only. RX01
// is called inside drawRelief after drawLandTexture and before the contour
// stroke; RX02 is called in renderBaseCanvas after the TX-SEA draw and
// before the chart over ops; renderBaseCanvas starts the RX loader.
test('RX structural pin: RX01 in drawRelief after TX-LAND and before the contours, RX02 after TX-SEA and before the chart over ops', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'map-canvas.js'), 'utf8');
  function bodyOf(name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start !== -1, name + ' is defined');
    return src.slice(start, src.indexOf('\n  }\n', start));
  }
  const relief = bodyOf('drawRelief');
  const land = relief.indexOf('drawLandTexture(ctx,');
  const rxLand = relief.indexOf('drawRxLand(ctx,');
  const contours = relief.indexOf('relief.contours.forEach(');
  const stroke = relief.indexOf('ctx.stroke();');
  assert.ok(land !== -1 && rxLand !== -1 && contours !== -1 && stroke !== -1);
  assert.ok(land < rxLand, 'drawRxLand follows drawLandTexture');
  assert.ok(rxLand < contours && rxLand < stroke, 'drawRxLand precedes the contour stroke');
  const { body } = renderBaseBody();
  const sea = body.indexOf('drawSeaTexture(ctx,');
  const rxBeyond = body.indexOf('drawRxBeyondLand(ctx,');
  const over = body.indexOf('drawChartOps(ctx, chartOps.over,');
  assert.ok(sea !== -1 && rxBeyond !== -1 && over !== -1);
  assert.ok(sea < rxBeyond, 'drawRxBeyondLand follows drawSeaTexture');
  assert.ok(rxBeyond < over, 'drawRxBeyondLand precedes the chart over ops');
  assert.ok(body.indexOf('startRxTexture();') !== -1, 'renderBaseCanvas starts the RX loader');
  assert.strictEqual(body.indexOf('drawRxLand(ctx,'), -1, 'renderBaseCanvas does not call drawRxLand directly');
  ['drawRxLand', 'drawRxBeyondLand'].forEach(name => {
    const mentions = src.split(name + '(ctx,').length - 1;
    const defs = src.split('function ' + name + '(ctx,').length - 1;
    assert.strictEqual(defs, 1);
    assert.strictEqual(mentions - defs, 1, name + ' has exactly one call site');
    const fn = bodyOf(name);
    assert.ok(fn.indexOf("'soft-light'") !== -1, name + ' uses soft-light');
    assert.ok(fn.indexOf('if (!rxSource) return false;') !== -1, name + ' draws nothing until the source is ready');
  });
  assert.ok(bodyOf('drawRxLand').indexOf('ctx.globalAlpha = z.alpha;') !== -1, 'RX01 uses the zone alpha');
  assert.ok(bodyOf('drawRxLand').indexOf('rxZones(chart)') !== -1, 'RX01 uses the cached zones');
  assert.ok(bodyOf('drawRxBeyondLand').indexOf('ctx.globalAlpha = RX_ALPHA_BEYOND;') !== -1, 'RX02 uses the flat beyond alpha');
  assert.ok(bodyOf('drawRxBeyondLand').indexOf("clip('evenodd')") !== -1, 'RX02 clips evenodd');
});

// Cycle 23 Step 20a: TX-PNL, the UI panel grain, a Blender route bake
// (Candidate B) wired onto the DOM panel surfaces as a soft-light background.
test('TX-PNL data: js/tx-pnl-data.js decodes to the committed candidate-b.webp bytes and matches its header', () => {
  txDataHeaderCheck('tx-pnl-data.js', 'TX-PNL');
  const bytes = Buffer.from(require('../js/tx-pnl-data.js'), 'base64');
  // RIFF size field covers the file after the first 8 bytes; first chunk is a WebP bitstream.
  assert.strictEqual(bytes.readUInt32LE(4), bytes.length - 8);
  assert.ok(['VP8 ', 'VP8L', 'VP8X'].indexOf(bytes.toString('ascii', 12, 16)) !== -1, 'first chunk is a WebP chunk');
});

test('TX-PNL wiring: index.html loads the data module once before js/main.js', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const tag = '<script src="js/tx-pnl-data.js"></script>';
  assert.strictEqual(html.split(tag).length - 1, 1);
  assert.ok(html.indexOf(tag) < html.indexOf('<script src="js/main.js"></script>'));
});

// Structural pins on the source text: every panel surface rule keeps its
// background colour and adds the var image with a none fallback and soft-light.
test('TX-PNL CSS pin: panel surfaces blend var(--tx-pnl-image, none) soft-light over their unchanged colour', () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  function ruleOf(selector) {
    const start = css.indexOf('\n' + selector + ' {');
    assert.ok(start !== -1, selector + ' rule exists');
    return css.slice(start, css.indexOf('}', start));
  }
  const colours = { '.card': '#22252a', '.progression-nation': '#1c1f23', '.event-card': '#22252a', '.codex': '#191b1e' };
  Object.keys(colours).forEach(sel => {
    const rule = ruleOf(sel);
    assert.ok(rule.indexOf('background: ' + colours[sel] + ';') !== -1, sel + ' keeps its colour');
    assert.ok(rule.indexOf('background-image: var(--tx-pnl-image, none);') !== -1, sel + ' uses the var image');
    assert.ok(rule.indexOf('background-blend-mode: soft-light;') !== -1, sel + ' blends soft-light');
    assert.ok(rule.indexOf('background-image') > rule.indexOf('background: '), sel + ' image follows the shorthand');
  });
  assert.strictEqual(css.split('var(--tx-pnl-image, none)').length - 1, 5, 'the four panel surfaces plus the Step 21a table rail');
});

test('TX-PNL main.js pin: --tx-pnl-image is set only in the onload of the TX-PNL Image', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  const start = src.indexOf('(function startPanelTexture() {');
  assert.ok(start !== -1, 'startPanelTexture exists');
  const body = src.slice(start, src.indexOf('\n  })();\n', start));
  assert.strictEqual(src.split("'--tx-pnl-image'").length - 1, 1, 'one place sets the var');
  assert.ok(body.indexOf('window.AshesTxPnlData') !== -1);
  assert.ok(body.indexOf("'data:image/webp;base64,' + data") !== -1);
  const onload = body.indexOf('img.onload = function () {');
  const set = body.indexOf("setProperty('--tx-pnl-image', 'url(\"' + uri + '\")')");
  const onerror = body.indexOf('img.onerror');
  assert.ok(onload !== -1 && set > onload && set < onerror, 'the var is set inside onload');
  assert.ok(body.indexOf('img.src = uri;') > onerror, 'src is assigned after both handlers');
  assert.ok(src.indexOf('(function startPanelTexture() {') < src.lastIndexOf('newGame();'), 'loader starts before the first newGame');
});

// Cycle 23 Step 20b: DC-xx decals. Scorch (DC01 to DC04) and crater (DC05 to
// DC07) stamps derived in js/decals.js from a pre-tick owner snapshot, drawn
// by js/map-canvas.js clipped to the hit polygons on #map-decals.
const AshesDecalsMod = require('../js/decals.js');
const DC_IDS = ['DC01', 'DC02', 'DC03', 'DC04', 'DC05', 'DC06', 'DC07'];

test('decals: a witnessed owner change gives exactly one event with the hashed variant and its kind', () => {
  const prev = { p1: 'player', p2: 'enemy' };
  const next = { p1: 'enemy', p2: 'enemy' };
  const events = AshesDecalsMod.deriveDecalEvents(prev, next, 12, ['p1', 'p2']);
  const variant = AshesDecalsMod.variantFor('p1', 12);
  assert.deepStrictEqual(events, [
    { provinceId: 'p1', day: 12, by: 'enemy', variant: variant, kind: AshesDecalsMod.kindFor(variant) }
  ]);
  // A Set works the same as an array.
  assert.deepStrictEqual(AshesDecalsMod.deriveDecalEvents(prev, next, 12, new Set(['p1'])), events);
});

test('decals: an unwitnessed change, an unchanged owner, and a province missing from either map give no event', () => {
  assert.deepStrictEqual(AshesDecalsMod.deriveDecalEvents({ p1: 'player' }, { p1: 'enemy' }, 3, ['p2']), []);
  assert.deepStrictEqual(AshesDecalsMod.deriveDecalEvents({ p1: 'player' }, { p1: 'player' }, 3, ['p1']), []);
  assert.deepStrictEqual(AshesDecalsMod.deriveDecalEvents({}, { p1: 'enemy' }, 3, ['p1']), []);
  assert.deepStrictEqual(AshesDecalsMod.deriveDecalEvents({ p1: 'player' }, {}, 3, ['p1']), []);
});

test('decals: events come out sorted by province id and the inputs are not mutated', () => {
  const prev = { p30: 'a', p04: 'a', p11: 'a' };
  const next = { p30: 'b', p04: 'b', p11: 'b' };
  const wit = ['p30', 'p11', 'p04'];
  const before = JSON.stringify([prev, next, wit]);
  const events = AshesDecalsMod.deriveDecalEvents(prev, next, 5, wit);
  assert.deepStrictEqual(events.map(e => e.provinceId), ['p04', 'p11', 'p30']);
  assert.strictEqual(JSON.stringify([prev, next, wit]), before);
});

test('decals: variantFor is deterministic and always DC01 to DC07; kindFor maps DC01-04 to scorch and DC05-07 to crater', () => {
  const seen = new Set();
  for (let d = 1; d <= 60; d++) {
    ['p00', 'p17', 'p42', 'p69'].forEach(pid => {
      const v = AshesDecalsMod.variantFor(pid, d);
      assert.strictEqual(v, AshesDecalsMod.variantFor(pid, d));
      assert.ok(DC_IDS.indexOf(v) !== -1, v + ' is a built variant');
      assert.strictEqual(v, 'DC0' + (1 + (AshesDecalsMod.fnv1a(pid + ':' + d) % 7)));
      seen.add(v);
    });
  }
  assert.strictEqual(seen.size, 7, 'all seven variants occur over 240 draws');
  ['DC01', 'DC02', 'DC03', 'DC04'].forEach(v => assert.strictEqual(AshesDecalsMod.kindFor(v), 'scorch'));
  ['DC05', 'DC06', 'DC07'].forEach(v => assert.strictEqual(AshesDecalsMod.kindFor(v), 'crater'));
  // Same algorithm as js/map-canvas.js fnv1a (the decal hash export).
  assert.strictEqual(AshesMapCanvas.decalOpsHash([{ provinceId: 'p1', day: 2, variant: 'DC03', cx: 1, cy: 2 }]),
    AshesDecalsMod.fnv1a('p1|2|DC03|1.0000|2.0000').toString(16).padStart(8, '0'));
});

test('decals: appendDecals dedupes by province and day, keeps the latest 3 per province, and mutates nothing', () => {
  const ev = (pid, day) => ({ provinceId: pid, day: day, by: 'x', variant: 'DC01', kind: 'scorch' });
  const existing = [ev('p1', 1), ev('p2', 1)];
  const events = [ev('p1', 1), ev('p1', 2)];
  const snap = JSON.stringify([existing, events]);
  const out = AshesDecalsMod.appendDecals(existing, events);
  assert.deepStrictEqual(out.map(e => e.provinceId + ':' + e.day), ['p1:1', 'p2:1', 'p1:2']);
  assert.notStrictEqual(out, existing);
  assert.strictEqual(JSON.stringify([existing, events]), snap, 'inputs unchanged');
  const many = AshesDecalsMod.appendDecals(out, [ev('p1', 3), ev('p1', 4), ev('p2', 4)]);
  assert.deepStrictEqual(many.map(e => e.provinceId + ':' + e.day), ['p2:1', 'p1:2', 'p1:3', 'p1:4', 'p2:4']);
  // Total cap: 210, oldest dropped.
  let rec = [];
  for (let d = 1; d <= 3; d++) {
    const batch = [];
    for (let i = 0; i < 80; i++) batch.push(ev('q' + String(i).padStart(2, '0'), d));
    rec = AshesDecalsMod.appendDecals(rec, batch);
  }
  assert.strictEqual(rec.length, 210);
  assert.deepStrictEqual(rec[0], ev('q30', 1));
  assert.deepStrictEqual(rec[209], ev('q79', 3));
});

// Minimal 8 bit RGBA PNG decoder (zlib inflate plus the five scanline filters).
function dcDecodeRgba(buf) {
  let off = 8;
  let width = 0, height = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  assert.strictEqual(colorType, 6, 'RGBA');
  const bpp = 4;
  const stride = width * bpp;
  const raw = require('node:zlib').inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[row - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[row - stride + x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
      }
      out[row + x] = (raw[src + x] + pred) & 255;
    }
  }
  return { width, height, data: out };
}

test('DC data: js/dc-data.js has exactly DC01 to DC07, each the committed alpha PNG bytes, 256 square, ink RGB, 8 px frame clear', () => {
  const data = require('../js/dc-data.js');
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'dc-data.js'), 'utf8');
  assert.deepStrictEqual(Object.keys(data), DC_IDS);
  DC_IDS.forEach(id => {
    const rel = 'art-direction/textures/' + id + '/candidate-b-alpha.png';
    const disk = fs.readFileSync(path.join(REPO_ROOT, rel));
    const prefix = 'data:image/png;base64,';
    assert.strictEqual(data[id].indexOf(prefix), 0, id + ' is a PNG data URI');
    const bytes = Buffer.from(data[id].slice(prefix.length), 'base64');
    assert.ok(bytes.equals(disk), id + ' payload is byte identical to ' + rel);
    const sha = crypto.createHash('sha256').update(disk).digest('hex');
    const block = '// Source file: ' + rel + '\n// Source byte length: ' + disk.length + '\n// Source sha256: ' + sha + '\n';
    assert.ok(src.indexOf(block) !== -1, id + ' header names its file, byte length, and sha256');
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), id + ' PNG signature');
    assert.strictEqual(bytes.toString('ascii', 12, 16), 'IHDR');
    assert.strictEqual(bytes.readUInt32BE(16), 256);
    assert.strictEqual(bytes.readUInt32BE(20), 256);
    const img = dcDecodeRgba(bytes);
    let opaque = 0, framed = 0, offInk = 0;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const k = (y * 256 + x) * 4;
        const a = img.data[k + 3];
        if (a === 255) opaque++;
        if ((x < 8 || y < 8 || x >= 248 || y >= 248) && a > 0) framed++;
        if (img.data[k] !== 43 || img.data[k + 1] !== 38 || img.data[k + 2] !== 32) offInk++;
      }
    }
    assert.ok(opaque > 0, id + ' has fully opaque ink');
    assert.strictEqual(framed, 0, id + ' outer 8 px alpha is all zero');
    assert.strictEqual(offInk, 0, id + ' RGB is the flat board ink 43, 38, 32');
  });
});

test('decal ops: on the seed 42 chart every op centre lies inside its hit polygon, ops sort by day then province, placement is deterministic', () => {
  const s = Sim.createGame(42);
  const geom = AshesMapGeometry.buildGeometry(playerView(s));
  const chart = AshesChart.buildChart(geom);
  const ids = Object.keys(chart.hitPolygons).sort();
  const decals = [];
  ids.forEach((pid, i) => {
    const day = 30 - (i % 5);
    const variant = AshesDecalsMod.variantFor(pid, day);
    decals.push({ provinceId: pid, day: day, by: 'enemy', variant: variant, kind: AshesDecalsMod.kindFor(variant) });
  });
  decals.push({ provinceId: 'no-such-province', day: 1, by: 'enemy', variant: 'DC01', kind: 'scorch' });
  const before = JSON.stringify(decals);
  const ops = AshesMapCanvas.buildDecalOps(chart, decals);
  assert.strictEqual(JSON.stringify(decals), before, 'decals not mutated');
  assert.strictEqual(ops.length, ids.length, 'one op per decal with a hit polygon');
  ops.forEach((op, i) => {
    assert.ok(AshesMapCanvas.pointInFlat(op.cx, op.cy, op.polygon), op.provinceId + ' centre inside its polygon');
    assert.strictEqual(op.size, 0.62);
    if (i > 0) {
      const p = ops[i - 1];
      assert.ok(p.day < op.day || (p.day === op.day && p.provinceId < op.provinceId), 'sorted by day then province');
    }
    const again = AshesMapCanvas.decalPlacement(op.polygon, op.provinceId, op.day);
    assert.deepStrictEqual(again, { cx: op.cx, cy: op.cy, size: op.size });
  });
  assert.deepStrictEqual(AshesMapCanvas.buildDecalOps(chart, decals), ops, 'two builds are deep equal');
});

test('decal canvas in node: renderDecalCanvas returns null and every decal state is unavailable', () => {
  assert.strictEqual(AshesMapCanvas.renderDecalCanvas({}, {}, [], 10, 10), null);
  assert.deepStrictEqual(AshesMapCanvas.textureDebug.decalStates, {
    DC01: 'unavailable', DC02: 'unavailable', DC03: 'unavailable', DC04: 'unavailable',
    DC05: 'unavailable', DC06: 'unavailable', DC07: 'unavailable'
  });
});

test('decal wiring: index.html has #map-decals between #map-base and #map-fog, and loads dc-data before map-canvas and decals before main', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const base = html.indexOf('<canvas id="map-base"');
  const dec = html.indexOf('<canvas id="map-decals" aria-hidden="true"></canvas>');
  const fog = html.indexOf('<canvas id="map-fog"');
  assert.ok(base !== -1 && dec > base && fog > dec, 'base, then decals, then fog');
  const tag = f => '<script src="js/' + f + '"></script>';
  ['dc-data.js', 'decals.js'].forEach(f => assert.strictEqual(html.split(tag(f)).length - 1, 1, f + ' loads once'));
  assert.ok(html.indexOf(tag('dc-data.js')) < html.indexOf(tag('map-canvas.js')));
  assert.ok(html.indexOf(tag('decals.js')) < html.indexOf(tag('main.js')));
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  assert.ok(css.indexOf('#map-decals { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }') !== -1);
  assert.ok(css.indexOf('#map-decals {') < css.indexOf('#map-fog {'), 'decal rule sits beside the fog rule');
});

test('decal sources: js/decals.js is pure (no sim require or call, no randomness) and has no em or en dashes', () => {
  ['decals.js', 'dc-data.js'].forEach(f => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'js', f), 'utf8');
    assert.ok(!/require\(['"]\.\/sim\.js['"]\)/.test(src), f + ' must not require sim.js');
    assert.ok(!/\bSim\./.test(src), f + ' must not call the sim');
    assert.ok(!/Math\.random\(\)/.test(src), f + ' must not use Math.random');
    assert.ok(!/[\u2013\u2014]/.test(src), f + ' must not contain em or en dashes');
    BANNED_PRESENTATION_STRINGS.forEach(str => assert.ok(src.indexOf(str) === -1, f + ' must not contain ' + str));
  });
});

// Cycle 23 MAP_TREATMENT Step 21a: TF interim table frame (UI01), DC09 stains
// on the frame, and the UI02 HUD card frame. All code and CSS, no assets.
test('TF frame markup: #tf-frame wraps #map-viewport unchanged, with four corner fittings and the DC09 stains after it', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const frame = html.indexOf('<div id="tf-frame">');
  const vp = html.indexOf('<div id="map-viewport">');
  const board = html.indexOf('<div id="map-board">');
  assert.strictEqual(html.split('id="tf-frame"').length - 1, 1, 'one tf-frame');
  assert.ok(frame !== -1 && vp > frame && board > vp, 'tf-frame, then map-viewport, then map-board');
  assert.ok(html.indexOf('class="map-zoom"') < frame, 'zoom row stays above the frame');
  const order = ['map-base', 'map-decals', 'map-fog', 'map-state'].map(id => html.indexOf('<canvas id="' + id + '" aria-hidden="true"></canvas>'));
  order.forEach((at, i) => assert.ok(at > board && (i === 0 || at > order[i - 1]), 'canvas ' + i + ' in order inside the board'));
  const beats = html.indexOf('<canvas id="map-beats" aria-hidden="true"></canvas>');
  assert.ok(beats > order[3], 'beats canvas still last in the board');
  ['tl', 'tr', 'bl', 'br'].forEach(k => {
    const tag = '<span class="tf-corner tf-corner-' + k + '" aria-hidden="true"></span>';
    assert.strictEqual(html.split(tag).length - 1, 1, 'corner ' + k + ' once');
    assert.ok(html.indexOf(tag) > beats, 'corner ' + k + ' sits outside the board, after the viewport');
  });
  assert.strictEqual(html.split('class="tf-corner ').length - 1, 4, 'exactly four corner fittings');
  ['dc09-ink', 'dc09-ring'].forEach(cls => {
    const tag = '<span class="' + cls + '" aria-hidden="true"></span>';
    assert.strictEqual(html.split(tag).length - 1, 1, cls + ' once');
    assert.ok(html.indexOf(tag) > beats && html.indexOf(tag) < html.indexOf('<div id="start-statement"'), cls + ' inside the frame, outside the board');
  });
});

test('TF frame order safety: stylesheets load in the head and every script still loads once, main.js last', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.indexOf('<link rel="stylesheet" href="css/style.css">') !== -1, 'style.css in the head');
  assert.ok(html.indexOf('<div id="tf-frame">') > html.indexOf('</head>'), 'frame markup in the body');
  const scripts = [];
  const re = /<script src="js\/([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(m[1]);
  assert.strictEqual(new Set(scripts).size, scripts.length, 'no script loads twice');
  assert.strictEqual(scripts[scripts.length - 1], 'main.js', 'main.js loads last');
  assert.ok(html.lastIndexOf('<script') > html.indexOf('<div id="tf-frame">'), 'scripts load after the frame markup');
});

test('TF frame legend: one plain sentence says the wooden frame is the table edge and carries no game information', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const legendAt = html.indexOf('<div id="map-legend"');
  const legend = html.slice(legendAt, html.indexOf('</div>', legendAt));
  assert.ok(legend.indexOf('<li>The wooden frame around the map is the edge of the war table. It carries no game information. It is scenery only.</li>') !== -1);
});

test('DC09 stains: classes live in index.html and css/style.css only, never in a canvas module', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  ['dc09-ink', 'dc09-ring'].forEach(cls => {
    assert.ok(html.indexOf('class="' + cls + '"') !== -1, cls + ' in index.html');
    assert.ok(css.indexOf('.' + cls + ' {') !== -1, cls + ' rule in style.css');
  });
  fs.readdirSync(path.join(REPO_ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'js', f), 'utf8');
    assert.ok(!/dc09|DC09/.test(src), f + ' must not draw or name DC09');
  });
});

test('TF frame CSS pin: rail takes TX-PNL soft-light over flat walnut, fixed RAIL and CORNER, no transform, corners and stains ignore the pointer', () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  function ruleOf(selector) {
    const start = css.indexOf('\n' + selector + ' {');
    assert.ok(start !== -1, selector + ' rule exists');
    return css.slice(start, css.indexOf('}', start));
  }
  const rail = ruleOf('#tf-frame');
  assert.ok(rail.indexOf('padding: 18px;') !== -1, 'RAIL 18px padding');
  assert.ok(rail.indexOf('background: #3a2c1e;') !== -1, 'flat walnut rail colour');
  assert.ok(rail.indexOf('background-image: var(--tx-pnl-image, none); background-blend-mode: soft-light;') !== -1, 'rail takes the TX-PNL grain soft-light');
  assert.ok(rail.indexOf('background-image') > rail.indexOf('background: '), 'image follows the shorthand');
  assert.ok(!/transform/.test(rail), 'the frame never transforms');
  assert.strictEqual(css.split(/var\(--tx-pnl-image,\s*none\)/).length - 1, 5, 'four panel surfaces plus the rail');
  assert.ok(/RAIL 18px/.test(css) && /CORNER 24px/.test(css) && /OVERHANG 6px/.test(css), 'constants named in a CSS comment');
  const corner = ruleOf('.tf-corner');
  ['width: 24px;', 'height: 24px;', 'background: #b08d3e;', 'pointer-events: none;'].forEach(d => assert.ok(corner.indexOf(d) !== -1, '.tf-corner ' + d));
  assert.ok(!/gradient/.test(corner), 'corners are flat brass');
  ['tl', 'tr', 'bl', 'br'].forEach(k => assert.ok(new RegExp('\\.tf-corner-' + k + ' \\{[^}]*-6px[^}]*-6px').test(css), 'corner ' + k + ' overhangs 6px'));
  ['.dc09-ink', '.dc09-ring'].forEach(sel => {
    const r = ruleOf(sel);
    assert.ok(r.indexOf('#2B2620') !== -1 && r.indexOf('pointer-events: none;') !== -1 && /opacity: 0\.\d+;/.test(r), sel + ' board ink, low opacity, no pointer');
  });
  // The frame is markup and CSS only: no JS module builds or styles it.
  fs.readdirSync(path.join(REPO_ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'js', f), 'utf8');
    assert.ok(src.indexOf('tf-frame') === -1 && src.indexOf('tf-corner') === -1, f + ' does not touch the frame');
  });
});

test('UI02 card frame pin: .card gains outline and box-shadow only; its border, padding, colour and TX-PNL wiring are unchanged', () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  assert.ok(css.indexOf('\n.card { background: #22252a; border: 1px solid #4a4232; border-radius: 4px; padding: 12px; background-image: var(--tx-pnl-image, none); background-blend-mode: soft-light; }\n') !== -1, 'original .card rule byte identical');
  const frame = '\n.card { outline: 2px solid #2a1f15; outline-offset: 0; box-shadow: inset 0 0 0 1px #8a7034; }\n';
  assert.ok(css.indexOf(frame) !== -1, 'UI02 frame rule present');
  assert.strictEqual(css.split('\n.card {').length - 1, 2, 'exactly the base rule and the frame rule');
  const decls = frame.slice(frame.indexOf('{') + 1, frame.indexOf('}')).split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(':')[0].trim());
  assert.deepStrictEqual(decls, ['outline', 'outline-offset', 'box-shadow'], 'frame rule sets outline and box-shadow only');
});

test('Step 21a no art-direction reference: index.html and css/style.css never point at art-direction/', () => {
  ['index.html', path.join('css', 'style.css')].forEach(rel => {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.ok(src.indexOf('art-direction') === -1, rel + ' must not reference art-direction/');
    assert.ok(!/[\u2013\u2014]/.test(src), rel + ' must not contain em or en dashes');
  });
});

// ---------- Cycle 23 Step 21b-3: F01 interim title screen ----------

const SC_TTL_SHA256 = '690e576aec22e2e3f509750a53d3435bb4d9a89eebba0e506fd7d0a41385d856';

test('Step 21b-3 SC-TTL scene: assets/scenes/sc-ttl-interim.png is byte identical to the R5 c2 rendition', () => {
  const scene = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'scenes', 'sc-ttl-interim.png'));
  const rendition = fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'renditions', 'SC-TTL', 'R5-SC-TTL-c2.png'));
  assert.ok(scene.equals(rendition), 'scene bytes equal the rendition bytes');
  assert.strictEqual(crypto.createHash('sha256').update(scene).digest('hex'), SC_TTL_SHA256);
});

test('Step 21b-3 asset log: checkAssets returns zero failures on the final tree', () => {
  const result = assetCheck.checkAssets(REPO_ROOT);
  assert.deepStrictEqual(result.failures, []);
});

test('Step 21b-3 title markup and styles: ids, F01 button texts, scene url, no art-direction reference', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(REPO_ROOT, 'css', 'style.css'), 'utf8');
  ['title-overlay', 'title-wordmark', 'title-buttons', 'btn-title-new', 'btn-title-how', 'title-how', 'btn-title-back'].forEach(id => {
    assert.ok(html.indexOf('id="' + id + '"') !== -1, 'index.html carries #' + id);
  });
  assert.ok(html.indexOf('<div id="title-overlay" class="overlay title-overlay" role="dialog" aria-modal="true" aria-labelledby="title-wordmark">') !== -1, 'overlay markup');
  assert.ok(html.indexOf('<button id="btn-title-new" type="button" class="primary">New game</button>') !== -1, 'New game button text');
  assert.ok(html.indexOf('<button id="btn-title-how" type="button">How to play</button>') !== -1, 'How to play button text');
  assert.ok(html.indexOf('<div id="title-how" class="hidden">') !== -1, 'how-to panel starts hidden');
  assert.ok(html.indexOf('id="title-overlay"') < html.indexOf('<script'), 'overlay sits before the script tags');
  assert.ok(css.indexOf('url("../assets/scenes/sc-ttl-interim.png")') !== -1, 'title background is the admitted scene');
  assert.ok(css.indexOf('#title-overlay.hidden { display: none; }') !== -1, 'hidden state pinned at id specificity');
  [html, css].forEach((src, i) => assert.ok(src.indexOf('art-direction') === -1, (i ? 'css/style.css' : 'index.html') + ' must not reference art-direction/'));
});

test('Step 21b-3 title wiring pins in js/main.js', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  assert.ok(src.indexOf("'title-overlay', 'title-buttons', 'btn-title-new', 'btn-title-how', 'title-how', 'btn-title-back'") !== -1, 'element ids registered');
  assert.ok(src.indexOf("!el.titleOverlay.classList.contains('hidden');\n  }") !== -1, 'overlayOpen counts the title');
  const ng = src.slice(src.indexOf('function newGame() {'), src.indexOf('// ---------- Save and load'));
  assert.ok(ng.indexOf("el.titleOverlay.classList.add('hidden');") !== -1, 'newGame hides the title');
  assert.ok(ng.indexOf("el.titleHow.classList.add('hidden');") !== -1 && ng.indexOf("el.titleButtons.classList.remove('hidden');") !== -1, 'newGame resets the how-to state');
  assert.ok(src.indexOf("el.btnTitleNew.addEventListener('click', function () {") !== -1, 'New game handler');
  assert.ok(src.indexOf("urlSeed = titleSeed;\n    titleSeed = null;\n    newGame();") !== -1, 'New game keeps the ?seed=N campaign and starts it');
  assert.ok(src.indexOf("el.btnTitleHow.addEventListener('click', function () {\n    el.titleButtons.classList.add('hidden');\n    el.titleHow.classList.remove('hidden');") !== -1, 'How to play handler');
  assert.ok(src.indexOf("el.btnTitleBack.addEventListener('click', function () {\n    el.titleHow.classList.add('hidden');\n    el.titleButtons.classList.remove('hidden');") !== -1, 'Back handler');
  const init = src.slice(src.lastIndexOf('  newGame();\n  updateSlotMeta();'));
  assert.ok(init.indexOf("el.titleOverlay.classList.remove('hidden');\n  setPaused(true);\n  el.btnTitleNew.focus();") !== -1, 'init shows the title, pauses, focuses New game');
});

test('labels: capital labels skip the fit font-size downgrade', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'js', 'main.js'), 'utf8');
  const fn = src.slice(src.indexOf('  function renderLabels() {'), src.indexOf('labelFitCache[key] = {'));
  assert.ok(fn.indexOf("if (bw > maxX - minX && !item.p.isCapital) {\n        span.style.fontSize = '11px';") !== -1, 'the 11px stage is guarded so capitals skip it');
  assert.ok(fn.split("span.style.fontSize = '11px';").length === 2, 'the 11px stage is the only font-size downgrade');
  assert.ok(fn.indexOf("if (bw > maxX - minX) {\n        span.style.letterSpacing = '0.02em';") !== -1, 'capitals still get the spacing stage');
  assert.ok(src.indexOf('Capital labels skip\n  // the 11px stage') !== -1, 'the fit pass comment states the capital exemption');
});

// Cycle 23 Step 22a: the pinned sprite rig (VISUAL_STRATEGY 4.1), the golden
// frame (4.2), the swatch card round trip (4.5 A3, STRATEGY G10 to G12), and
// the golden test unit's three passes (4.4). Built on local Blender 5.2.2 CPU
// by tools/build-sprite-rig.py; the A100 and L4 pass is owed.
const SPRITE_GOLDEN_DIR = path.join(REPO_ROOT, 'blender', 'golden');

function pngHeader(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25] };
}

test('Step 22a sprite rig build script pins CAM_SPRITE, KEY, render settings, and the Blender 5.2.2 assert', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'build-sprite-rig.py'), 'utf8');
  [
    'PINNED_VERSION = (5, 2, 2)',
    'if tuple(bpy.app.version) != PINNED_VERSION or not bpy.app.version_string.startswith(PINNED_VERSION_PREFIX):',
    '    sys.exit(1)',
    'CAM_SPRITE_LOCATION = (0.0, -10.0, 10.0)',
    'CAM_SPRITE_ROTATION_DEG = (45.0, 0.0, 0.0)',
    'CAM_SPRITE_ORTHO_SCALE = 2.0',
    'CAM_SPRITE_SHIFT_X = 0.0',
    'CAM_SPRITE_SHIFT_Y = 0.25',
    'CAM_TEX_LOCATION = (0.0, 0.0, 10.0)',
    'FRAME = 224',
    'ANCHOR_PX = (112, 168)',
    'KEY_LOCATION = (-5.5, 4.5, 7.0)',
    'KEY_STRENGTH = 3.0',
    'KEY_ANGLE_DEG = 2.0',
    'WORLD_STRENGTH = 0.3',
    'SEED = 0',
    'FILTER_WIDTH = 1.5',
    'TINT_SRGB = 128',
    'TINT_ROUGHNESS = 0.6',
    'cy.use_adaptive_sampling = False',
    'scene.view_settings.view_transform = "Standard"',
    'con = key.constraints.new("TRACK_TO")',
    'RIG = os.path.join(ROOT, "blender", "rig", "aoe_rig_sprite_v1.blend")'
  ].forEach(s => assert.ok(src.indexOf(s) !== -1, 'build script carries: ' + s));
  assert.ok(src.indexOf('A100 and L4 pass remains owed') !== -1, 'route substitution recorded in the header');
});

test('Step 22a golden manifest parses, names Blender 5.2.2, records both tolerance sets, and states the owed GPU pass', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SPRITE_GOLDEN_DIR, 'golden_v1.json'), 'utf8'));
  assert.strictEqual(m.id, 'BL00');
  assert.deepStrictEqual(m.blender.version, [5, 2, 2]);
  assert.ok(m.blender.version_string.indexOf('5.2.2') === 0);
  assert.strictEqual(m.rig.file, 'blender/rig/aoe_rig_sprite_v1.blend');
  assert.ok(/^[0-9a-f]{64}$/.test(m.rig.sha256_at_save));
  assert.ok(m.route_substitution.indexOf('A100 and L4 pass remains owed') !== -1);
  assert.ok(m.golden_png.established_on.indexOf('local CPU') === 0);
  assert.deepStrictEqual(m.golden_png.frame, [224, 224]);
  assert.strictEqual(m.tolerances.visual_strategy_4_2.mean_abs_diff_max_levels, 1.0);
  assert.strictEqual(m.tolerances.visual_strategy_4_2.pixels_within_8_levels_min_fraction, 0.995);
  assert.strictEqual(m.tolerances.strategy_g11.mean_abs_error_max_levels, 0.5);
  assert.strictEqual(m.tolerances.strategy_g11.p99_5_max_levels, 3);
  const pngSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(SPRITE_GOLDEN_DIR, 'golden_v1.png'))).digest('hex');
  assert.strictEqual(m.golden_png.sha256, pngSha, 'manifest names the archived golden');
  assert.ok(m.measured && m.measured.all_pass === true, 'check tool measured block recorded and passing');
  assert.strictEqual(m.measured.golden_png_sha256, pngSha);
  assert.ok(Math.abs(m.measured.g10_swatch_mask.mean - 128) <= 1);
  assert.ok(m.measured.a3_delta_e_2000.Vessari <= 2.0 && m.measured.a3_delta_e_2000.Khessite <= 2.0);
  assert.strictEqual(m.measured.g12_highlight.quadrant, 'upper left');
  const h = pngHeader(path.join(SPRITE_GOLDEN_DIR, 'golden_v1.png'));
  assert.deepStrictEqual(h, { width: 224, height: 224, bitDepth: 16, colorType: 6 });
});

test('Step 22a passes manifest: 224 frame, anchor (112, 168), four outputs present at 16 bit RGBA with matching sha256', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SPRITE_GOLDEN_DIR, 'passes', 'testunit.json'), 'utf8'));
  assert.deepStrictEqual(m.frame_px, [224, 224]);
  assert.deepStrictEqual(m.anchor_px, [112, 168]);
  assert.deepStrictEqual(m.anchor_projected_px, [112, 168]);
  assert.strictEqual(m.rig, 'blender/rig/aoe_rig_sprite_v1.blend');
  assert.strictEqual(m.render.bit_depth, 16);
  ['beauty', 'mask', 'shadow', 'swatchmask'].forEach(k => {
    const o = m.outputs[k];
    assert.strictEqual(o.file, 'blender/golden/passes/testunit_' + k + '.png');
    const file = path.join(REPO_ROOT, o.file);
    assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), o.sha256, k + ' sha256');
    assert.deepStrictEqual(pngHeader(file), { width: 224, height: 224, bitDepth: 16, colorType: 6 }, k + ' header');
  });
});

test('Step 22a asset log admits BL00 at the golden location, and the new files carry no em or en dash', () => {
  const lines = fs.readFileSync(path.join(REPO_ROOT, 'art-direction', 'asset-log.jsonl'), 'utf8').split('\n').filter(Boolean);
  const bl = lines.map(l => JSON.parse(l)).filter(e => e.id === 'BL00');
  assert.strictEqual(bl.length, 1);
  assert.strictEqual(bl[0].status, 'admitted');
  assert.strictEqual(bl[0].location, 'blender/golden/golden_v1.png');
  ['tools/build-sprite-rig.py', 'tools/sprite-rig-check.py', 'blender/golden/golden_v1.json',
    'blender/golden/passes/testunit.json'].forEach(f => {
    const s = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    assert.ok(s.indexOf('\u2014') === -1 && s.indexOf('\u2013') === -1, f + ' has no em or en dash');
  });
});

// Cycle 23 Step 22b: silhouette battery tool (VISUAL_STRATEGY 4.6, gate A2, gate R-d).
const SILHOUETTE_BATTERY = path.join(REPO_ROOT, 'tools', 'silhouette-battery.py');
const SILHOUETTE_CHECK = path.join(REPO_ROOT, 'tools', 'silhouette-check.py');

test('Step 22b silhouette battery and its check tool exist', () => {
  assert.ok(fs.existsSync(SILHOUETTE_BATTERY), 'tools/silhouette-battery.py exists');
  assert.ok(fs.existsSync(SILHOUETTE_CHECK), 'tools/silhouette-check.py exists');
});

test('Step 22b battery names all seven family IDs, the plain names, and terrain for T- pieces', () => {
  const src = fs.readFileSync(SILHOUETTE_BATTERY, 'utf8');
  ['U-INF', 'U-DRN', 'U-FLT', 'S-CTY', 'S-CAP', 'S-FAC', 'S-FRT'].forEach(id =>
    assert.ok(src.indexOf('"' + id + '"') !== -1, 'battery names family ' + id));
  ['infantry', 'drone', 'flotilla', 'city', 'capital', 'factory', 'fort', 'terrain'].forEach(n =>
    assert.ok(src.indexOf('"' + n + '"') !== -1, 'battery names plain name ' + n));
  assert.ok(src.indexOf('TERRAIN_NAME = "terrain"') !== -1);
  assert.ok(src.indexOf('fid.startswith("T-")') !== -1, 'every T- piece answers terrain');
});

test('Step 22b battery pins the gate A2 scoring rule, the alpha above 0.5 mask, and the display sizes', () => {
  const src = fs.readFileSync(SILHOUETTE_BATTERY, 'utf8');
  [
    'MIN_JUDGES = 3',
    'PASS_PERCENT = 100',
    'ALPHA_THRESHOLD = 128',
    'COPIES = 2',
    'DISPLAY = {"S-CAP": 64}',
    'DISPLAY_DEFAULT = 56',
    'LEGEND_SCALE = 4',
    'enough = len(judges) >= MIN_JUDGES',
    'a >= ALPHA_THRESHOLD'
  ].forEach(s => assert.ok(src.indexOf(s) !== -1, 'battery carries: ' + s));
});

test('Step 22b battery uses the fixed Ink and Paper hex values', () => {
  const src = fs.readFileSync(SILHOUETTE_BATTERY, 'utf8');
  assert.ok(src.indexOf('PAPER_HEX = "#E6D8B5"') !== -1);
  assert.ok(src.indexOf('INK_HEX = "#2B2620"') !== -1);
  assert.ok(src.indexOf('PAPER = (0xE6, 0xD8, 0xB5)') !== -1);
  assert.ok(src.indexOf('INK = (0x2B, 0x26, 0x20)') !== -1);
});

test('Step 22b battery header serves VISUAL_STRATEGY 4.6, gate A2 and gate R-d, and states its honest limits; no em or en dash', () => {
  const src = fs.readFileSync(SILHOUETTE_BATTERY, 'utf8');
  const header = src.slice(0, src.indexOf('"""', 3));
  ['4.6', 'gate A2', 'gate R-d', 'at least 3 independent fresh-eyes', 'does not create models'].forEach(s =>
    assert.ok(header.indexOf(s) !== -1, 'battery header mentions ' + s));
  const check = fs.readFileSync(SILHOUETTE_CHECK, 'utf8');
  assert.ok(check.indexOf('NOT GAME ART') !== -1, 'check header marks fixtures as tool fixtures');
  [SILHOUETTE_BATTERY, SILHOUETTE_CHECK].forEach(f => {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(s.indexOf('\u2014') === -1 && s.indexOf('\u2013') === -1, f + ' has no em or en dash');
  });
});
