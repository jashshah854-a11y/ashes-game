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
