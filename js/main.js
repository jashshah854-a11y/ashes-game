// Ashes of Empires, browser glue.
// All rules live in js/sim.js. This file only draws and listens.
(function () {
  'use strict';
  var Sim = window.AshesSim;

  var state = null;
  var selectedProvinceId = null;
  var selectedUnitId = null;
  var paused = false;
  var speed = 1; // 1x or 2x
  var timer = null;

  var el = {};
  ['map', 'day-counter', 'day-max', 'btn-pause', 'btn-speed1', 'btn-speed2', 'btn-new',
   'stat-equipment', 'stat-steel', 'stat-steel-income', 'stat-factories', 'stat-research',
   'stat-drone-gen', 'btn-research', 'research-explain', 'prov-name', 'prov-details',
   'btn-factory', 'prov-explain', 'unit-details',
   'stat-enemy-provs', 'stat-enemy-units', 'stat-enemy-gen', 'log', 'banner', 'rail-actions',
   'prod-summary', 'production-lines', 'stat-enemy-factories', 'stat-enemy-lines'
  ].forEach(function (id) { el[id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = document.getElementById(id); });

  function selectedUnit() {
    if (selectedUnitId == null) return null;
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].id === selectedUnitId) return state.units[i];
    }
    return null;
  }

  function reachableIds() {
    var u = selectedUnit();
    if (!u) return {};
    var out = {};
    Sim.neighborsOf(state, state.provinces[u.provinceId]).forEach(function (p) { out[p.id] = true; });
    return out;
  }

  function startTimer() {
    stopTimer();
    var ms = speed === 1 ? 900 : 300;
    timer = setInterval(function () {
      if (paused || state.gameOver) return;
      Sim.tick(state);
      render();
      if (state.gameOver) showBanner();
    }, ms);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function newGame() {
    var seed = Math.floor(Math.random() * 100000);
    state = Sim.createGame(seed);
    selectedProvinceId = null;
    selectedUnitId = null;
    paused = false;
    el.btnPause.textContent = 'Pause';
    el.banner.classList.add('hidden');
    render();
    startTimer();
  }

  function showBanner() {
    el.banner.classList.remove('hidden');
    el.banner.classList.toggle('lost', state.winner !== 'player');
    el.banner.textContent = (state.winner === 'player' ? 'Victory. ' : 'Defeat. ') + state.endReason;
  }

  // ---------- Rendering ----------
  function render() {
    el.dayCounter.textContent = state.day;
    el.dayMax.textContent = Sim.CFG.campaignEndDay;
    renderMap();
    renderPanel();
    renderLog();
  }

  // Rail state of the edge from this province toward a neighbor id, as a
  // little track bar on the shared border. Presentation only: the rules
  // all live in the graph inside sim.js.
  function railBar(p, neighborId, side) {
    var e = Sim.edgeBetween(state, p.id, neighborId);
    if (!e || !e.rail) return '';
    if (e.rail.daysLeft > 0) {
      return '<span class="rail-bar ' + side + ' building"></span>' +
        '<span class="rail-tag">Rail ' + e.rail.daysLeft + 'd</span>';
    }
    if (e.rail.converting) {
      return '<span class="rail-bar ' + side + ' building"></span>' +
        '<span class="rail-tag">Converting ' + e.rail.converting.daysLeft + 'd</span>';
    }
    return '<span class="rail-bar ' + side + '"></span>';
  }

  function renderMap() {
    var reach = reachableIds();
    var playerSupply = Sim.computeSupply(state, 'player');
    var html = '';
    for (var y = 0; y < state.mapH; y++) {
      for (var x = 0; x < state.mapW; x++) {
        var p = state.provinces[Sim.provinceId(x, y)];
        var cls = 'province owner-' + p.owner;
        if (p.id === selectedProvinceId) cls += ' selected';
        if (reach[p.id]) cls += ' reachable';
        if (p.owner === 'player' && playerSupply[p.id] && !playerSupply[p.id].supplied) cls += ' unsupplied';
        html += '<button type="button" class="' + cls + '" data-prov="' + p.id + '">';
        html += '<span class="pname">' + (p.isCapital ? '<span class="capital-mark">&#9733;</span> ' : '') + p.name + '</span>';
        html += '<span class="steel">Steel ' + p.steel + '</span>';
        if (p.factoryLevel > 0) {
          html += ' <span class="factory-badge lvl' + p.factoryLevel + '">Factory ' + p.factoryLevel + '</span>';
        }
        if (x + 1 < state.mapW) html += railBar(p, Sim.provinceId(x + 1, y), 'r');
        if (y + 1 < state.mapH) html += railBar(p, Sim.provinceId(x, y + 1), 'b');
        var units = Sim.unitsIn(state, p.id);
        if (units.length) {
          html += '<span class="units">';
          units.forEach(function (u) {
            var st = Sim.unitStats(state, u);
            var label = (u.type === 'drone' ? 'Drone' : 'Inf') + ' ' + u.strength + 'hp A' + st.attack;
            if (st.supplyPenalty > 0) label += ' <span class="sup-tag">-' + st.supplyPenalty + '%</span>';
            var c = 'unit-chip ' + (u.nation === 'player' ? 'mine' : 'theirs');
            if (u.id === selectedUnitId) c += ' picked';
            html += '<span class="' + c + '">' + label + '</span>';
          });
          html += '</span>';
        }
        html += '</button>';
      }
    }
    el.map.innerHTML = html;
    Array.prototype.forEach.call(el.map.querySelectorAll('.province'), function (node) {
      node.addEventListener('click', function () { onProvinceClick(node.getAttribute('data-prov')); });
    });
  }

  function renderPanel() {
    var n = state.nations.player;
    el.statEquipment.textContent = n.equipment;
    el.statSteel.textContent = n.steel;
    el.statSteelIncome.textContent = Sim.steelIncome(state, 'player');
    var idle = n.factoryLevelsIdle || 0;
    el.statFactories.textContent = Sim.factoryLevels(state, 'player') +
      (idle > 0 ? ' (' + idle + ' idle today: production lines are paid first and the steel ran out)' : '');
    el.statResearch.textContent = n.researchPoints;
    el.statDroneGen.textContent = n.droneGen2 ? 'Gen 2' : 'Gen 1';
    el.btnResearch.disabled = n.droneGen2 || n.researchPoints < Sim.CFG.droneGen2Cost;
    el.btnResearch.textContent = n.droneGen2
      ? 'Drone Gen 2 fielded'
      : 'Research Drone Gen 2 (' + Sim.CFG.droneGen2Cost + ' pts)';

    var e = state.nations.enemy;
    var enemyProvs = Object.keys(state.provinces).filter(function (k) {
      return state.provinces[k].owner === 'enemy';
    }).length;
    el.statEnemyProvs.textContent = enemyProvs;
    el.statEnemyUnits.textContent = Sim.unitsOf(state, 'enemy').length;
    el.statEnemyGen.textContent = e.droneGen2 ? 'Gen 2' : 'Gen 1';
    // The Dominion opens lines by the same factory thresholds you do, so its
    // factory total says when its next line arrives.
    var enemyLines = (e.productionLines || []).length;
    var enemyNext = Sim.lineLockInfo(state, 'enemy', enemyLines + 1);
    el.statEnemyFactories.textContent = Sim.factoryLevels(state, 'enemy');
    el.statEnemyLines.textContent = enemyLines + ' of ' + Sim.CFG.maxProductionLines +
      (enemyNext ? ' (next at ' + enemyNext.required + ' factory levels)' : '');

    renderProduction();
    renderProvinceCard();
    renderUnitCard();
  }

  // Small helper: a div with a class and plain text content.
  function textDiv(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  }

  // Production panel: one row per line, every number the sim uses shown
  // in plain words (what it builds, how long is left, what it drains).
  function renderProduction() {
    Sim.syncProductionLines(state, 'player');
    var n = state.nations.player;
    var cap = state.provinces[n.capitalId];
    var capName = cap ? cap.name : 'your capital';
    el.prodSummary.textContent =
      'Production drain: ' + Sim.productionDrain(state, 'player') + ' steel per day. ' +
      Sim.queuedUnits(state, 'player') + ' units in queues. ' +
      'Finished units deploy at ' + capName + '.';

    el.productionLines.innerHTML = '';
    (n.productionLines || []).forEach(function (line) {
      var t = Sim.CFG.unitTypes[line.template];
      var otherTemplate = line.template === 'infantry' ? 'drone' : 'infantry';
      var other = Sim.CFG.unitTypes[otherTemplate];

      var row = document.createElement('div');
      row.className = 'prod-line';

      row.appendChild(textDiv('prod-title', 'Line ' + line.id + ': ' + t.label));
      row.appendChild(textDiv('prod-row', t.steelCost + ' steel over ' + t.buildDays + ' days'));
      row.appendChild(textDiv('prod-row', line.queue + ' in queue (max ' + Sim.CFG.maxQueuePerLine + ')'));

      if (line.queue <= 0) {
        row.appendChild(textDiv('prod-row prod-idle', 'Idle. Queue a unit to start building.'));
      } else {
        var daysLeft = t.buildDays - line.progressDays;
        row.appendChild(textDiv('prod-row',
          line.progressDays + ' of ' + t.buildDays + ' days paid, ' + daysLeft + ' days left'));
        row.appendChild(textDiv('prod-row',
          Sim.lineSteelPerDay(line.template) + ' steel per day while working'));
      }

      if (line.stalled) {
        row.appendChild(textDiv('prod-stalled', 'Stalled: not enough steel today. No progress made.'));
      }
      if (line.progressDays > 0) {
        var steelSpent = line.progressDays * Sim.lineSteelPerDay(line.template);
        row.appendChild(textDiv('prod-note',
          'Retooling scraps the unit in progress and loses the ' + steelSpent + ' steel already spent on it.'));
      }

      var btns = document.createElement('div');
      btns.className = 'prod-btns';

      var qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.textContent = 'Queue ' + t.label + ' (+1)';
      qBtn.disabled = line.queue >= Sim.CFG.maxQueuePerLine;
      qBtn.addEventListener('click', function () {
        Sim.queueProduction(state, 'player', line.id);
        render();
      });
      btns.appendChild(qBtn);

      var rBtn = document.createElement('button');
      rBtn.type = 'button';
      rBtn.textContent = 'Retool to ' + other.label;
      rBtn.addEventListener('click', function () {
        Sim.assignLineTemplate(state, 'player', line.id, otherTemplate);
        render();
      });
      btns.appendChild(rBtn);

      row.appendChild(btns);
      el.productionLines.appendChild(row);
    });

    // Locked slots: shown, never silently absent, with the exact unlock condition.
    var realCount = (n.productionLines || []).length;
    for (var lineId = realCount + 1; lineId <= Sim.CFG.maxProductionLines; lineId++) {
      var info = Sim.lineLockInfo(state, 'player', lineId);
      if (!info) continue;
      var lockedRow = document.createElement('div');
      lockedRow.className = 'prod-line locked';
      lockedRow.appendChild(textDiv('prod-title', 'Line ' + lineId + ': Locked'));
      lockedRow.appendChild(textDiv('prod-row prod-locked',
        'Line ' + lineId + ' locked. Build ' + info.missing +
        (info.missing === 1 ? ' more factory level' : ' more factory levels') +
        ' anywhere to unlock it (needs ' + info.required + ' total factory levels, you have ' +
        info.current + ').'));
      lockedRow.appendChild(textDiv('prod-note',
        'This line appears here on its own the day your factories reach the total. Nothing to click yet.'));
      el.productionLines.appendChild(lockedRow);
    }
  }

  // The line unlock rule in plain words, built from the same CFG thresholds
  // the sim uses, for example "Line 3 opens at 16, line 4 opens at 24".
  function lineUnlockText() {
    var parts = [];
    for (var id = 1; id <= Sim.CFG.maxProductionLines; id++) {
      var need = Sim.CFG.lineUnlockFactoryLevels[id - 1];
      if (need > 0) parts.push((parts.length ? 'line ' : 'Line ') + id + ' opens at ' + need);
    }
    if (!parts.length) return '';
    return 'Your total factory levels across all provinces also unlock production lines: ' +
      parts.join(', ') + ' (you have ' + Sim.factoryLevels(state, 'player') + '). ' +
      'An unlocked line stays open even if you later lose factories.';
  }

  function renderProvinceCard() {
    var p = selectedProvinceId ? state.provinces[selectedProvinceId] : null;
    var btnF = el.btnFactory;
    if (!p) {
      el.provName.textContent = 'No province selected';
      el.provDetails.textContent = 'Click any province to inspect it.';
      btnF.disabled = true;
      el.provExplain.textContent = '';
      el.railActions.innerHTML = '';
      return;
    }
    el.provName.textContent = p.name + (p.isCapital ? ' (capital)' : '');
    var ownerName = p.owner === 'player' ? 'Yours' : 'Dominion';
    var sup = Sim.computeSupply(state, p.owner)[p.id];
    var supplyLine = 'Supply: ';
    if (sup && sup.supplied) {
      supplyLine += 'fed by rail, ' + sup.hops + ' of ' + Sim.CFG.supplyMaxHops + ' hops from the capital';
    } else if (sup) {
      supplyLine += 'NOT supplied (' + sup.reason + '). Units here weaken daily.';
    } else {
      supplyLine += 'unknown';
    }
    el.provDetails.innerHTML =
      'Owner: ' + ownerName + '<br>' +
      'Steel output: ' + p.steel + ' per day<br>' +
      'Factory level: ' + p.factoryLevel + ' of ' + Sim.CFG.maxFactoryLevel + '<br>' +
      supplyLine + '<br>' +
      'Units here: ' + Sim.unitsIn(state, p.id).length;
    renderRailActions(p);
    var mine = p.owner === 'player';
    var cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
    btnF.disabled = !(mine && p.factoryLevel < Sim.CFG.maxFactoryLevel && state.nations.player.equipment >= cost);
    btnF.textContent = p.factoryLevel >= Sim.CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + cost + ' eq)';
    el.provExplain.textContent = mine
      ? 'Factories turn steel into equipment every day. Higher levels show bigger on the map and produce more. ' +
        'Each day your production lines are paid first; factories run on the steel left, and a level with no steel sits idle. ' +
        lineUnlockText()
      : 'Enemy province. March a unit in to take it.';
  }

  // Rail build buttons for the selected province: one per neighbor that
  // is yours, unrailed, and reachable. Building rail is how new ground
  // gets fed, so it lives right next to the supply line in this card.
  function renderRailActions(p) {
    el.railActions.innerHTML = '';
    if (!p || p.owner !== 'player') return;
    Sim.neighborEdges(state, p).forEach(function (ne) {
      if (ne.province.owner !== 'player' || ne.edge.rail) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Build rail to ' + ne.province.name + ' (' + Sim.CFG.railCostSteel + ' steel, ' + Sim.CFG.railBuildDays + ' days)';
      btn.disabled = state.nations.player.steel < Sim.CFG.railCostSteel;
      btn.addEventListener('click', function () {
        Sim.buildRail(state, 'player', p.id, ne.province.id);
        render();
      });
      el.railActions.appendChild(btn);
    });
  }

  function renderUnitCard() {
    var u = selectedUnit();
    if (!u) {
      el.unitDetails.textContent = 'No unit selected. Click a province holding your troops.';
      return;
    }
    var st = Sim.unitStats(state, u);
    var base = Sim.CFG.unitTypes[u.type];
    var orderText = 'Holding position.';
    if (u.order) {
      orderText = 'Marching to ' + state.provinces[u.order.target].name + ' at dawn. ' +
        'If an enemy column marches on ' + state.provinces[u.provinceId].name +
        ' the same day, this unit stays to defend it and the order is cancelled.';
    }
    var supplyText = 'In supply. The rail net feeds this unit.';
    if ((u.daysOut || 0) > 0) {
      supplyText = 'OUT OF SUPPLY for ' + u.daysOut + (u.daysOut === 1 ? ' day' : ' days') +
        ': attack and defense -' + st.supplyPenalty + '%.';
      if (u.daysOut > Sim.CFG.supplyGraceDays) supplyText += ' It is losing strength to attrition.';
    }
    // Attack preview: the same stackPower the combat and the AI use, so
    // the numbers here are the numbers the war is fought with.
    var stack = Sim.unitsIn(state, u.provinceId).filter(function (x) { return x.nation === 'player'; });
    var myPower = Sim.stackPower(state, stack, 'attack');
    var preview = '';
    Sim.neighborsOf(state, state.provinces[u.provinceId]).forEach(function (np) {
      if (np.owner !== 'enemy') return;
      var defs = Sim.unitsIn(state, np.id).filter(function (d) { return d.nation === 'enemy'; });
      if (!defs.length) return;
      preview += '<br>Attack ' + np.name + ': your stack power ' + myPower +
        ' vs their defense ' + Sim.stackPower(state, defs, 'defense') + ' (supply effects included).';
      preview += '<br>If they march out and meet you on the road: your attack ' + myPower +
        ' vs their attack ' + Sim.stackPower(state, defs, 'attack') + '.';
      // If taking this province would start rail conversions, say so
      // before the player commits, never as a surprise after the fact.
      var converting = Sim.neighborEdges(state, np).filter(function (ne) {
        return ne.edge.rail && ne.edge.rail.daysLeft === 0 && !ne.edge.rail.converting &&
          ne.edge.rail.owner === 'enemy' && ne.province.owner === 'player';
      }).length;
      if (converting > 0) {
        preview += '<br>Taking ' + np.name + ' starts converting ' + converting +
          (converting === 1 ? ' rail edge' : ' rail edges') + ' to your net for ' +
          Sim.CFG.railConvertDays + ' days. Units pushing beyond it will be out of supply.';
      }
    });
    el.unitDetails.innerHTML =
      base.label + ' (strength ' + u.strength + ' of ' + u.maxStrength + ')<br>' +
      'Attack ' + st.attack + ', Defense ' + st.defense +
      (u.type === 'drone' ? ' (Drone ' + (state.nations.player.droneGen2 ? 'Gen 2' : 'Gen 1') + ')' : '') + '<br>' +
      'Cost to build: ' + base.steelCost + ' steel over ' + base.buildDays + ' days on a production line.<br>' +
      supplyText + '<br>' +
      'Stationed in ' + state.provinces[u.provinceId].name + '.<br>' + orderText + preview;
  }

  function renderLog() {
    var items = state.log.slice(-12).reverse();
    el.log.innerHTML = items.map(function (entry) {
      return '<li><span class="day-tag">Day ' + entry.day + '</span>' + entry.msg + '</li>';
    }).join('');
  }

  // ---------- Interaction ----------
  function onProvinceClick(provId) {
    if (state.gameOver) return;
    var u = selectedUnit();
    // If a unit is picked and this is a highlighted neighbor, order it.
    if (u && reachableIds()[provId]) {
      var res = Sim.issueOrder(state, u.id, provId);
      if (res.ok) {
        selectedProvinceId = provId;
        render();
      }
      return;
    }
    selectedProvinceId = provId;
    // Select a player unit here; repeated clicks cycle through stacked units.
    var mine = Sim.unitsIn(state, provId).filter(function (x) { return x.nation === 'player'; });
    if (mine.length) {
      var idx = mine.findIndex(function (x) { return x.id === selectedUnitId; });
      selectedUnitId = mine[(idx + 1) % mine.length].id;
    }
    render();
  }

  el.btnPause.addEventListener('click', function () {
    paused = !paused;
    el.btnPause.textContent = paused ? 'Resume' : 'Pause';
  });
  el.btnSpeed1.addEventListener('click', function () {
    speed = 1;
    el.btnSpeed1.classList.add('active'); el.btnSpeed2.classList.remove('active');
    startTimer();
  });
  el.btnSpeed2.addEventListener('click', function () {
    speed = 2;
    el.btnSpeed2.classList.add('active'); el.btnSpeed1.classList.remove('active');
    startTimer();
  });
  el.btnNew.addEventListener('click', newGame);
  el.btnResearch.addEventListener('click', function () {
    Sim.researchDroneGen2(state, 'player');
    render();
  });
  el.btnFactory.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildFactory(state, 'player', selectedProvinceId); render(); }
  });

  newGame();
})();
