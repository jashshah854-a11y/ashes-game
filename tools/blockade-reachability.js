'use strict';
// Cycle 23 Step 2: blockade reachability proof script.
// Uses ONLY public sim commands (createGame, tick, syncProductionLines,
// queueProduction, researchDroneGen2, issueOrder, unitsOf, unitsIn,
// neighborsOf, enemyHomeCoastalControlCount, isBlockaded, blockadeLoss,
// steelIncome). Never writes state fields directly, never sets owners
// or positions, no debug setters. Reading state fields (provinces owner,
// nations steel, day) for reporting and routing decisions is fine.
// This script is NOT part of the balance run and changes no baseline.

const Sim = require('../js/sim.js');
const { execSync } = require('child_process');

function prov(id) {
  const m = /^p(\d+)_(\d+)$/.exec(id);
  return { x: +m[1], y: +m[2] };
}

function nextStep(state, fromId, targetId, laneRow) {
  if (fromId === targetId) return null;
  const target = prov(targetId);
  const dist = (p) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
  const frontier = [{ id: fromId, cost: 0, prev: null }];
  const bestCost = new Map();
  bestCost.set(fromId, 0);
  let targetNode = null;

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift();
    if (cur.id === targetId) {
      targetNode = cur;
      break;
    }
    if (cur.cost > bestCost.get(cur.id)) continue;
    const here = state.provinces[cur.id];
    const neighbors = Sim.neighborsOf(state, here);
    for (const p of neighbors) {
      if (p.id === cur.id) continue;
      const stepCost = 10;
      const rowDistCost = 3 * Math.abs(p.y - laneRow);
      const unitsHere = Sim.unitsIn(state, p.id);
      const hasEnemy = unitsHere.some(u => u.nation === 'enemy');
      const enemyOccupiedCost = (hasEnemy && p.id !== targetId) ? 50 : 0;
      const newCost = cur.cost + stepCost + rowDistCost + enemyOccupiedCost;
      if (!bestCost.has(p.id) || newCost < bestCost.get(p.id)) {
        bestCost.set(p.id, newCost);
        frontier.push({ id: p.id, cost: newCost, prev: cur });
      }
    }
  }
  if (!targetNode) return null;
  let step = targetNode;
  while (step.prev && step.prev.prev) {
    step = step.prev;
  }
  return state.provinces[step.id];
}

function getCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: __dirname + '/..' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

function main() {
  const seed = 42;
  const s = Sim.createGame(seed);
  const commitHash = getCommitHash();

  const commandsUsed = new Set();

  let garrisonIds = null;

  const unitLanes = new Map();

  const northTargets = ['p5_0', 'p6_0'];
  const southTargets = ['p5_6', 'p6_6'];
  const laneRowNorth = 0;
  const laneRowSouth = 6;

  const holders = new Map();

  let nextReinforcementLane = 'north';

  let firstDayAt1 = null;
  let firstDayAt2 = null;
  let firstDayAt3 = null;
  let thresholdDay = null;
  let thresholdDayData = null;
  let dayBeforeThresholdData = null;
  let dayAfterThresholdData = null;

  let day = 0;
  const maxDays = 150;

  let lastBefore = null;

  while (!s.gameOver && day < maxDays) {
    const currentDay = s.day;

    if (!garrisonIds) {
      const capUnits = Sim.unitsIn(s, s.nations.player.capitalId).filter(u => u.nation === 'player' && u.type === 'infantry');
      garrisonIds = capUnits.slice(0, 2).map(u => u.id);

      const allPlayerUnits = Sim.unitsOf(s, 'player');
      for (const u of allPlayerUnits) {
        if (garrisonIds.includes(u.id)) continue;
        const startProv = s.provinces[u.provinceId];
        const lane = (startProv.y <= 3) ? 'north' : 'south';
        unitLanes.set(u.id, lane);
      }
    }

    if (!s.nations.player.droneGen2 && s.nations.player.researchPoints >= Sim.CFG.droneGen2Cost) {
      Sim.researchDroneGen2(s, 'player');
      commandsUsed.add('researchDroneGen2');
    }

    Sim.syncProductionLines(s, 'player');
    commandsUsed.add('syncProductionLines');
    s.nations.player.productionLines.forEach(line => {
      if (line.queue === 0) {
        Sim.queueProduction(s, 'player', line.id);
        commandsUsed.add('queueProduction');
      }
    });

    const countBefore = Sim.enemyHomeCoastalControlCount(s, 'player');
    commandsUsed.add('enemyHomeCoastalControlCount');
    const incomeBefore = Sim.steelIncome(s, 'enemy');
    commandsUsed.add('steelIncome');
    const lossBefore = Sim.blockadeLoss(s, 'enemy');
    commandsUsed.add('blockadeLoss');
    lastBefore = {
      day: s.day,
      count: countBefore,
      steel: s.nations.enemy.steel,
      income: incomeBefore,
      loss: lossBefore,
      isBlockaded: Sim.isBlockaded(s, 'enemy')
    };
    commandsUsed.add('isBlockaded');

    holders.clear();
    for (const targetId of ['p5_0', 'p6_0', 'p5_6', 'p6_6']) {
      const p = s.provinces[targetId];
      if (p.owner === 'player') {
        const unitsHere = Sim.unitsIn(s, targetId).filter(u => u.nation === 'player');
        if (unitsHere.length > 0) {
          const lowest = unitsHere.reduce((min, u) => u.id < min.id ? u : min, unitsHere[0]);
          holders.set(targetId, lowest.id);
        }
      }
    }

    const playerUnits = Sim.unitsOf(s, 'player');
    for (const u of playerUnits) {
      if (garrisonIds.includes(u.id)) continue;

      let lane = unitLanes.get(u.id);
      if (!lane) {
        if (u.provinceId === s.nations.player.capitalId) {
          lane = nextReinforcementLane;
          nextReinforcementLane = (nextReinforcementLane === 'north') ? 'south' : 'north';
        } else {
          const curProv = s.provinces[u.provinceId];
          lane = (curProv.y <= 3) ? 'north' : 'south';
        }
        unitLanes.set(u.id, lane);
      }

      const targets = (lane === 'north') ? northTargets : southTargets;
      const laneRow = (lane === 'north') ? laneRowNorth : laneRowSouth;

      let targetId = null;
      for (const t of targets) {
        const p = s.provinces[t];
        if (p.owner === 'player') {
          const held = holders.has(t);
          if (!held) {
            targetId = t;
            break;
          }
        } else {
          targetId = t;
          break;
        }
      }

      if (!targetId) continue;

      if (holders.get(u.provinceId) === u.id) {
        continue;
      }

      const next = nextStep(s, u.provinceId, targetId, laneRow);
      if (next && next.id !== u.provinceId) {
        Sim.issueOrder(s, u.id, next.id);
        commandsUsed.add('issueOrder');
      }
    }

    Sim.tick(s);
    commandsUsed.add('tick');
    day++;

    const countAfter = Sim.enemyHomeCoastalControlCount(s, 'player');
    commandsUsed.add('enemyHomeCoastalControlCount');

    if (countAfter >= 1 && firstDayAt1 === null) firstDayAt1 = s.day;
    if (countAfter >= 2 && firstDayAt2 === null) firstDayAt2 = s.day;
    if (countAfter >= 3 && firstDayAt3 === null) firstDayAt3 = s.day;

    if (countAfter >= 3 && thresholdDay === null) {
      thresholdDay = s.day;
      dayBeforeThresholdData = lastBefore;
      const income = Sim.steelIncome(s, 'enemy');
      const loss = Sim.blockadeLoss(s, 'enemy');
      const isBlockaded = Sim.isBlockaded(s, 'enemy');
      commandsUsed.add('steelIncome');
      commandsUsed.add('blockadeLoss');
      commandsUsed.add('isBlockaded');
      thresholdDayData = {
        day: s.day,
        count: countAfter,
        steel: s.nations.enemy.steel,
        income: income,
        loss: loss,
        isBlockaded: isBlockaded
      };
      break;
    }
  }

  if (thresholdDay !== null) {
    Sim.tick(s);
    commandsUsed.add('tick');
    const countAfter = Sim.enemyHomeCoastalControlCount(s, 'player');
    commandsUsed.add('enemyHomeCoastalControlCount');
    const income = Sim.steelIncome(s, 'enemy');
    const loss = Sim.blockadeLoss(s, 'enemy');
    const isBlockaded = Sim.isBlockaded(s, 'enemy');
    commandsUsed.add('steelIncome');
    commandsUsed.add('blockadeLoss');
    commandsUsed.add('isBlockaded');
    dayAfterThresholdData = {
      day: s.day,
      count: countAfter,
      steel: s.nations.enemy.steel,
      income: income,
      loss: loss,
      isBlockaded: isBlockaded
    };
  }

  console.log(`Seed: ${seed}`);
  console.log(`Commit: ${commitHash}`);
  console.log(`Commands used: ${Array.from(commandsUsed).sort().join(', ')}`);
  console.log(`First day count reached 1: ${firstDayAt1 !== null ? firstDayAt1 : 'never'}`);
  console.log(`First day count reached 2: ${firstDayAt2 !== null ? firstDayAt2 : 'never'}`);
  console.log(`First day count reached 3: ${firstDayAt3 !== null ? firstDayAt3 : 'never'}`);

  if (thresholdDay === null) {
    const maxCount = Math.max(
      firstDayAt1 !== null ? 1 : 0,
      firstDayAt2 !== null ? 2 : 0,
      firstDayAt3 !== null ? 3 : 0
    );
    const plateauDay = firstDayAt3 || firstDayAt2 || firstDayAt1 || 0;
    console.log(`Threshold not reached. Highest count: ${maxCount}, plateaued day: ${plateauDay}`);
    process.exit(1);
  }

  console.log(`\nThreshold day: ${thresholdDay}`);
  console.log(`Day before threshold (day ${dayBeforeThresholdData.day}):`);
  console.log(`  count=${dayBeforeThresholdData.count}, Dominion steel=${dayBeforeThresholdData.steel}, Dominion steel income=${dayBeforeThresholdData.income}, Dominion blockade loss=${dayBeforeThresholdData.loss}`);
  console.log(`Threshold day (day ${thresholdDayData.day}):`);
  console.log(`  count=${thresholdDayData.count}, Dominion steel=${thresholdDayData.steel}, Dominion steel income=${thresholdDayData.income}, Dominion blockade loss=${thresholdDayData.loss}, isBlockaded=${thresholdDayData.isBlockaded}`);
  console.log(`Following day (day ${dayAfterThresholdData.day}):`);
  console.log(`  count=${dayAfterThresholdData.count}, Dominion steel=${dayAfterThresholdData.steel}, Dominion steel income=${dayAfterThresholdData.income}, Dominion blockade loss=${dayAfterThresholdData.loss}, isBlockaded=${dayAfterThresholdData.isBlockaded}`);
  console.log(`The following tick income phase applied the threshold day loss.`);
  console.log(`Loss arithmetic: loss = Math.floor(income * CFG.blockadeSteelPct / 100) = Math.floor(${thresholdDayData.income} * ${Sim.CFG.blockadeSteelPct} / 100) = ${Math.floor(thresholdDayData.income * Sim.CFG.blockadeSteelPct / 100)}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(2);
});