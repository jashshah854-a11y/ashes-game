// Instrumented sim for the Cycle 16 blockade measure. It wraps tick and,
// after each tick, counts per nation the days a sea is controlled against
// it, the days steel is actually cut, the days a sea is held against it
// with no coastal steel of its own there (nothing to cut), the coastal
// steel the blockade takes (blockade(state, nation)) in all and at most in
// one campaign, and the share of that nation's gross steel income lost.
// Usage: REAL_SIM=$PWD/js/sim.js OUT=/tmp/out.json \
//   node tools/balance.js --sim tools/measure/blockade.js --seeds 1-200 --profile factories
// It changes no rule; the result is appended to OUT as one JSON line.
const real = require(process.env.REAL_SIM);
const fs = require('fs');
const st = { days: 0, player: { blockadedDays: 0, cutDays: 0, emptyHeldDays: 0, lost: 0, gross: 0, maxCampaign: 0 }, enemy: { blockadedDays: 0, cutDays: 0, emptyHeldDays: 0, lost: 0, gross: 0, maxCampaign: 0 } };
// Each campaign has its own state object; losses are summed per state.
const perCampaign = new Map();
function tick(s) {
  if (!perCampaign.has(s)) perCampaign.set(s, { player: 0, enemy: 0 });
  const campaign = perCampaign.get(s);
  const r = real.tick(s);
  st.days++;
  ['player', 'enemy'].forEach(n => {
    const b = real.blockade(s, n);
    const against = Object.keys(b).some(sea => b[sea].control && b[sea].control !== n);
    if (against) st[n].blockadedDays++;
    const lostToday = Object.keys(b).reduce((a, sea) => a + b[sea].lost, 0);
    if (lostToday > 0) st[n].cutDays++;
    // A sea held against this nation where it holds no coastal steel: nothing to cut.
    if (Object.keys(b).some(sea => b[sea].control && b[sea].control !== n && b[sea].steel === 0)) st[n].emptyHeldDays++;
    st[n].lost += lostToday;
    campaign[n] += lostToday;
    st[n].gross += Object.values(s.provinces).filter(p => p.owner === n).reduce((a, p) => a + p.steel, 0);
  });
  return r;
}
process.on('exit', () => {
  const out = { days: st.days };
  ['player', 'enemy'].forEach(n => {
    perCampaign.forEach(c => { st[n].maxCampaign = Math.max(st[n].maxCampaign, c[n]); });
    out[n] = { blockadedDaysPct: Math.round(1000 * st[n].blockadedDays / st.days) / 10, cutDaysPct: Math.round(1000 * st[n].cutDays / st.days) / 10,
      emptyHeldDays: st[n].emptyHeldDays, heldDays: st[n].blockadedDays, lostSteel: st[n].lost, maxLostInACampaign: st[n].maxCampaign,
      lostPctOfIncome: st[n].gross ? Math.round(1000 * st[n].lost / st[n].gross) / 10 : 0 };
  });
  fs.appendFileSync(process.env.OUT, JSON.stringify(out) + '\n');
});
module.exports = Object.assign({}, real, { tick });
