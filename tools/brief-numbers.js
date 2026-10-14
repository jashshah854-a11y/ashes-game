'use strict';
// Regenerates every measured number quoted in the brief at the top of
// DECISIONS_FOR_JASH.md and in its option tables (items 15, 20, 24, 27,
// 30), from the current js/sim.js, so the brief can be refreshed from one
// run instead of copied by hand (Cycle 15; the Cycle 14 judge found the
// brief's item 20 numbers predating the river crossing).
// Each variant is the current sim with exact text replacements; a
// replacement that does not match stops the script, so a variant can
// never silently measure the unchanged game. Campaigns run through
// tools/balance.js --json over the seeds given (default 1 to 200).
// Produces, and only these (Cycle 16 lists them exactly): item 20's lever
// rows (drone and mixed medians, the lead, the rulings); item 24's research
// days, recon flights blinded (intended play, and both sides jamming
// first), and the research order row that loses rationed seed 108; item
// 27's scout and control medians, slowest wins, and how many campaigns
// acting on sight makes faster and slower; item 30's Dominion flotilla
// rulings and the flotilla report against factories (medians, faster,
// slower, the same); item 15's siege arithmetic. Anything else quoted in
// DECISIONS was measured once and is marked with its cycle there.
// Usage: node tools/brief-numbers.js [--seeds 1-200]
// Prints a plain text report headed with the commit it was measured at.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(REPO, 'js/sim.js'), 'utf8');
const args = process.argv.slice(2);
const SEEDS = args.indexOf('--seeds') !== -1 ? args[args.indexOf('--seeds') + 1] : '1-200';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-'));

function variant(name, edits) {
  let src = SIM;
  edits.forEach(([from, to]) => {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error('variant ' + name + ': expected one match for ' + JSON.stringify(from) + ', found ' + n);
    src = src.replace(from, to);
  });
  const file = path.join(TMP, name + '.js');
  fs.writeFileSync(file, src);
  return file;
}

function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Runs the harness and summarizes each profile: wins, median win day,
// and, for ruling profiles, whether the ruling passes and which seeds fail.
function run(simFile, profiles, extra) {
  const argv = [path.join(REPO, 'tools/balance.js'), '--json', '--seeds', SEEDS];
  if (simFile) argv.push('--sim', simFile);
  profiles.forEach(p => argv.push('--profile', p));
  (extra || []).forEach(a => argv.push(a));
  let out;
  try { out = execFileSync('node', argv, { encoding: 'utf8', maxBuffer: 1 << 30 }); } catch (e) { out = e.stdout; }
  const all = JSON.parse(out);
  const sum = { _raw: all };
  Object.keys(all).forEach(p => {
    if (p === '_raw') return;
    const rs = all[p].results;
    const wins = rs.filter(r => r.winner === 'player');
    sum[p] = { wins: wins.length, of: rs.length, median: median(wins.map(r => r.day)),
      pass: all[p].pass, losses: rs.filter(r => r.winner !== 'player').map(r => r.seed + ' (day ' + r.day + ')'),
      maxDay: wins.length ? Math.max.apply(null, wins.map(r => r.day)) : null,
      recon: rs.reduce((a, r) => a + (r.reconFlights || []).length, 0),
      blinded: rs.reduce((a, r) => a + (r.reconFlights || []).filter(f => f.blinded).length, 0) };
  });
  return sum;
}

const RULINGS = ['passive', 'factories', 'fortress', 'reckless', 'rationed', 'direct'];
// Campaign by campaign: how many of b's are faster, slower, the same as a's
// (a loss counts as slower than any win).
function compare(raw, a, b) {
  const day = r => (r.winner === 'player' ? r.day : 10000);
  let faster = 0, slower = 0, same = 0;
  raw[a].results.forEach((r, i) => {
    const d = day(raw[b].results[i]) - day(r);
    if (d < 0) faster++; else if (d > 0) slower++; else same++;
  });
  return { faster, slower, same };
}
function rulingText(sum) {
  const bad = RULINGS.filter(p => sum[p] && !sum[p].pass);
  return bad.length ? 'rulings FAIL: ' + bad.map(p => p + ' ' + sum[p].wins + ' of ' + sum[p].of + (p === 'rationed' || p === 'factories' || p === 'fortress'
    ? ' (lost ' + sum[p].losses.join(', ') + ')' : '')).join('; ') : 'rulings pass';
}

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const commit = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
say('Brief numbers, measured at commit ' + commit + ' over seeds ' + SEEDS + '.');

// Item 20: the drone lead and the measured levers.
const D = (a1, a2, a3) => [["drone:    { label: 'Drone Wing',        attack: 3,", "drone:    { label: 'Drone Wing',        attack: " + a1 + ','],
  ['droneGen2: { attack: 5,', 'droneGen2: { attack: ' + a2 + ','], ['droneGen3: { attack: 7,', 'droneGen3: { attack: ' + a3 + ',']];
const levers = [
  ['today (drone attack 3 / 5 / 7)', null],
  ['drone attack 2 / 3 / 4', variant('d234', D(2, 3, 4))],
  ['drone attack 2 / 4 / 6', variant('d246', D(2, 4, 6))],
  ['drone attack 2 / 3 / 4, defense 1 / 2 / 3', variant('d234def', D(2, 3, 4).concat([
    ["drone:    { label: 'Drone Wing',        attack: 2, defense: 2,", "drone:    { label: 'Drone Wing',        attack: 2, defense: 1,"],
    ['droneGen2: { attack: 3, defense: 3 }', 'droneGen2: { attack: 3, defense: 2 }'],
    ['droneGen3: { attack: 4, defense: 4 }', 'droneGen3: { attack: 4, defense: 3 }']]))],
  ['infantry attack 5', variant('inf5', [["infantry: { label: 'Infantry Division', attack: 4,", "infantry: { label: 'Infantry Division', attack: 5,"]])],
  ['jamming at 30 and 60 points', variant('jam3060', [["jamming1: { label: 'Jamming Gen 1', cost: 50,", "jamming1: { label: 'Jamming Gen 1', cost: 30,"],
    ["jamming2: { label: 'Jamming Gen 2', cost: 100,", "jamming2: { label: 'Jamming Gen 2', cost: 60,"]])]
];
say('');
say('Item 20, drone median win day against mixed factories (lead in days), and the rulings:');
levers.forEach(([label, file]) => {
  const sum = run(file, RULINGS.concat(['drones']));
  say('- ' + label + ': drones ' + sum.drones.median + ' against factories ' + sum.factories.median + ' (lead ' +
    (sum.factories.median - sum.drones.median) + '); ' + rulingText(sum));
});

// Item 24: the research clock and blinding.
say('');
const Sim = require(path.join(REPO, 'js/sim.js'));
const s = Sim.createGame(7);
for (let i = 0; i < 40; i++) s.units.push({ id: 9000 + i, nation: 'player', type: 'infantry', provinceId: s.nations.player.capitalId, strength: 12, maxStrength: 12, order: null, daysOut: 0, supplyPenalty: 0, attritionCarry: 0 });
const arrive = {};
while (!s.gameOver && s.day < 150) {
  const d = s.day; Sim.tick(s);
  Sim.CFG.aiResearchOrder.forEach(id => { if (arrive[id] == null && Sim.hasResearched(s, 'enemy', id)) arrive[id] = d; });
}
say('Item 24, the Dominion research days (seed 7, a long war): ' + Sim.CFG.aiResearchOrder.map(id => Sim.CFG.research[id].label + ' day ' + arrive[id]).join(', ') + '.');
const rc = run(null, ['recon']);
say('- recon flights blinded in intended play (recon report): ' + rc.recon.blinded + ' of ' + rc.recon.recon + '.');
const ro = run(null, ['rationed'], ['--research-order', 'droneGen2,jamming1,jamming2,droneGen3']);
say('- rationed researching Gen 2, Jamming 1, Jamming 2, then Gen 3: ' + ro.rationed.wins + ' of ' + ro.rationed.of +
  (ro.rationed.losses.length ? ' (lost ' + ro.rationed.losses.join(', ') + ')' : '') + '.');
const jf = variant('jamfirst', [["aiResearchOrder: ['droneGen2', 'jamming1', 'droneGen3', 'jamming2']", "aiResearchOrder: ['jamming1', 'droneGen2', 'jamming2', 'droneGen3']"]]);
const jfs = run(jf, ['scout']);
say('- with both sides researching jamming first: scout flights blinded ' + jfs.scout.blinded + ' of ' + jfs.scout.recon + '.');

// Item 27: sight with a consumer, against its control.
say('');
const sc = run(null, ['scout', 'scoutnohold']);
const scc = compare(sc._raw, 'scoutnohold', 'scout');
say('Item 27, the scout against its control: scout median ' + sc.scout.median + ' (slowest win ' + sc.scout.maxDay + '), control median ' +
  sc.scoutnohold.median + ' (slowest win ' + sc.scoutnohold.maxDay + '); acting on sight makes ' + scc.faster + ' campaigns faster, ' +
  scc.slower + ' slower, ' + scc.same + ' the same.');

// Item 30: the Dominion's flotilla rule.
say('');
const fl = variant('aiflot', [['aiBuildsFlotilla: false,', 'aiBuildsFlotilla: true,']]);
say('Item 30, the Dominion building flotillas at ' + Sim.CFG.aiFlotillaEquipment + ' equipment: ' + rulingText(run(fl, RULINGS)) + '.');
const ft = run(null, ['factories', 'flotilla']);
const ftc = compare(ft._raw, 'factories', 'flotilla');
say('- the flotilla report (built first) against factories: median ' + ft.flotilla.median + ' against ' + ft.factories.median + '; ' +
  ftc.faster + ' faster, ' + ftc.slower + ' slower, ' + ftc.same + ' the same.');

// Item 15: the siege arithmetic, from the sim itself.
say('');
const g = Sim.createGame(7);
const cap = g.nations.enemy.capitalId;
g.provinces[cap].fortLevel = Sim.CFG.fortMaxLevel;
const twelve = []; for (let i = 0; i < 12; i++) twelve.push({ id: 100 + i, nation: 'enemy', type: 'infantry', provinceId: cap, strength: 12, maxStrength: 12, supplyPenalty: 0 });
const def = Sim.stackPower(g, twelve, 'defense');
say('Item 15, the siege: twelve infantry behind level ' + Sim.CFG.fortMaxLevel + ' walls defend at ' + def + '; the 1.5x rule needs ' + Math.ceil(def * 1.5) + '.');
fs.rmSync(TMP, { recursive: true, force: true });
