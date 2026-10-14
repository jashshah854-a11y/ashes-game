// Instrumented sim for the Cycle 16 blockade measure. It wraps tick and,
// after each tick, counts per nation the days a sea is controlled against
// it and the coastal steel the blockade takes (blockade(state, nation)),
// and the share of that nation's gross steel income lost.
// Usage: REAL_SIM=$PWD/js/sim.js OUT=/tmp/out.json \
//   node tools/balance.js --sim tools/measure/blockade.js --seeds 1-200 --profile factories
// It changes no rule; the result is appended to OUT as one JSON line.
const real = require(process.env.REAL_SIM);
const fs = require('fs');
const st = { days: 0, player: { blockadedDays: 0, lost: 0, gross: 0 }, enemy: { blockadedDays: 0, lost: 0, gross: 0 } };
function tick(s) {
  const r = real.tick(s);
  st.days++;
  ['player', 'enemy'].forEach(n => {
    const b = real.blockade(s, n);
    const against = Object.keys(b).some(sea => b[sea].control && b[sea].control !== n);
    if (against) st[n].blockadedDays++;
    st[n].lost += Object.keys(b).reduce((a, sea) => a + b[sea].lost, 0);
    st[n].gross += Object.values(s.provinces).filter(p => p.owner === n).reduce((a, p) => a + p.steel, 0);
  });
  return r;
}
process.on('exit', () => {
  const out = { days: st.days };
  ['player', 'enemy'].forEach(n => {
    out[n] = { blockadedDaysPct: Math.round(1000 * st[n].blockadedDays / st.days) / 10, lostSteel: st[n].lost,
      lostPctOfIncome: st[n].gross ? Math.round(1000 * st[n].lost / st[n].gross) / 10 : 0 };
  });
  fs.appendFileSync(process.env.OUT, JSON.stringify(out) + '\n');
});
module.exports = Object.assign({}, real, { tick });
