// Instrumented sim for the Cycle 11 step 0 exit measure. It wraps tick:
// before each tick it records, for every Dominion air defense province
// with player drone wings ordered at it, the launches and downed wings the
// attacker's estimate counts (interceptPlan, the function the preview and
// stackPower use); after the tick it reads the launches and downed wings
// the battle logged, and counts the matches for single origin attacks.
// Usage: REAL_SIM=$PWD/js/sim.js OUT=/tmp/out.json \
//   node tools/balance.js --sim tools/measure/preview-vs-battle.js --seeds 1-200 --profile factories
// It changes no rule; the counts are appended to OUT as one JSON line.
const real = require(process.env.REAL_SIM);
const fs = require('fs');
const stats = { battles: 0, single: 0, launchMatch: 0, downedMatch: 0, mismatches: [] };
function tick(s) {
  const preds = [];
  Object.keys(s.provinces).forEach(pid => {
    const p = s.provinces[pid];
    if (!(p.airDefense > 0) || p.owner !== 'enemy') return;
    const att = s.units.filter(u => u.nation === 'player' && u.strength > 0 && u.order && u.order.target === pid);
    if (!att.some(u => u.type === 'drone')) return;
    const origins = new Set(att.map(u => u.provinceId));
    preds.push({ name: p.name, single: origins.size === 1, launches: real.interceptPlan(s, att, pid).length,
      power: real.stackPower(s, att, 'attack', pid), downed: real.interceptPlan(s, att, pid).filter(u => u.strength <= real.CFG.interceptStrength).length, day: s.day, ids: att.map(u => u.id) });
  });
  const seen = new Set(s.log);
  const r = real.tick(s);
  const fresh = s.log.filter(e => !seen.has(e));
  preds.forEach(pr => {
    const m = fresh.map(e => new RegExp('^Khessite air defense at ' + pr.name + ' (launches (\\d+) interceptor|cannot launch|was finished today)').exec(e.msg)).find(Boolean);
    if (!m) return; // no battle formed (a meeting, or the defenders left): nothing to compare
    const actual = m[2] ? +m[2] : 0;
    stats.battles++;
    if (!pr.single) return;
    stats.single++;
    const dm = /downing (\d+)/.exec(fresh.map(e => e.msg).find(x => x.indexOf('air defense at ' + pr.name + ' launches') !== -1) || '');
    const downed = dm ? +dm[1] : 0;
    if (downed === pr.downed) stats.downedMatch++;
    if (actual === pr.launches) stats.launchMatch++;
    else if (stats.mismatches.length < 10) stats.mismatches.push({ day: pr.day, pred: pr.launches, actual, msg: m[0] });
  });
  return r;
}
process.on('exit', () => fs.appendFileSync(process.env.OUT, JSON.stringify(stats) + '\n'));
module.exports = Object.assign({}, real, { tick });
