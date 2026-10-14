// Instrumented sim for the Cycle 15 river crossing measure. It wraps tick:
// before each tick, for every stack (units of one nation sharing an origin
// and a target) ordered across a river edge, it records the stack's attack
// with the crossing (attackPower with the target) and without it (no
// target), and reports the effective penalty per side: the mean of
// 1 - with / without over those stacks, and over all their attack summed.
// Usage: REAL_SIM=$PWD/js/sim.js OUT=/tmp/out.json \
//   node tools/balance.js --sim tools/measure/river-penalty.js --seeds 1-200 --profile factories
// It changes no rule; the result is appended to OUT as one JSON line.
const real = require(process.env.REAL_SIM);
// Sims before Cycle 15 rounded the crossing per unit and had no attackPower.
if (!real.attackPower) real.attackPower = (s, g, t) => g.reduce((a, u) => a + real.unitStats(s, u, t).attack, 0);
const fs = require('fs');
const st = { player: { stacks: 0, with: 0, without: 0, ratios: [] }, enemy: { stacks: 0, with: 0, without: 0, ratios: [] } };
function tick(s) {
  const groups = {};
  s.units.forEach(u => {
    if (!u.order || u.strength <= 0) return;
    const e = real.edgeBetween(s, u.provinceId, u.order.target);
    if (!e || e.terrain !== 'river') return;
    if (s.provinces[u.order.target].owner === u.nation) return; // a move, not an attack
    const k = u.nation + '|' + u.provinceId + '|' + u.order.target;
    (groups[k] = groups[k] || []).push(u);
  });
  Object.keys(groups).forEach(k => {
    const [nation, , target] = k.split('|');
    const g = groups[k];
    const w = real.attackPower(s, g, target), wo = real.attackPower(s, g, null);
    if (w === wo) return; // a flotilla carried it
    const t = st[nation];
    t.stacks++; t.with += w; t.without += wo; t.ratios.push(1 - w / wo);
  });
  return real.tick(s);
}
process.on('exit', () => {
  const out = {};
  ['player', 'enemy'].forEach(n => {
    const t = st[n];
    out[n] = { stacks: t.stacks, meanPct: t.stacks ? Math.round(1000 * t.ratios.reduce((a, b) => a + b, 0) / t.stacks) / 10 : null,
      pooledPct: t.without ? Math.round(1000 * (1 - t.with / t.without)) / 10 : null };
  });
  fs.appendFileSync(process.env.OUT, JSON.stringify(out) + '\n');
});
module.exports = Object.assign({}, real, { tick });
