// Ashes of Empires, browser glue for Iteration 1.
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
   'btn-factory', 'btn-train-inf', 'btn-train-drone', 'prov-explain', 'unit-details',
   'stat-enemy-provs', 'stat-enemy-units', 'stat-enemy-gen', 'log', 'banner'
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

  function renderMap() {
    var reach = reachableIds();
    var html = '';
    for (var y = 0; y < state.mapH; y++) {
      for (var x = 0; x < state.mapW; x++) {
        var p = state.provinces[Sim.provinceId(x, y)];
        var cls = 'province owner-' + p.owner;
        if (p.id === selectedProvinceId) cls += ' selected';
        if (reach[p.id]) cls += ' reachable';
        html += '<button type="button" class="' + cls + '" data-prov="' + p.id + '">';
        html += '<span class="pname">' + (p.isCapital ? '<span class="capital-mark">&#9733;</span> ' : '') + p.name + '</span>';
        html += '<span class="steel">Steel ' + p.steel + '</span>';
        if (p.factoryLevel > 0) {
          html += ' <span class="factory-badge lvl' + p.factoryLevel + '">Factory ' + p.factoryLevel + '</span>';
        }
        var units = Sim.unitsIn(state, p.id);
        if (units.length) {
          html += '<span class="units">';
          units.forEach(function (u) {
            var st = Sim.unitStats(state, u);
            var label = (u.type === 'drone' ? 'Drone' : 'Inf') + ' ' + u.strength + 'hp A' + st.attack;
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
    el.statFactories.textContent = Sim.factoryLevels(state, 'player');
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

    renderProvinceCard();
    renderUnitCard();
  }

  function renderProvinceCard() {
    var p = selectedProvinceId ? state.provinces[selectedProvinceId] : null;
    var btnF = el.btnFactory, btnI = el.btnTrainInf, btnD = el.btnTrainDrone;
    if (!p) {
      el.provName.textContent = 'No province selected';
      el.provDetails.textContent = 'Click any province to inspect it.';
      btnF.disabled = btnI.disabled = btnD.disabled = true;
      el.provExplain.textContent = '';
      return;
    }
    el.provName.textContent = p.name + (p.isCapital ? ' (capital)' : '');
    var ownerName = p.owner === 'player' ? 'Yours' : 'Dominion';
    el.provDetails.innerHTML =
      'Owner: ' + ownerName + '<br>' +
      'Steel output: ' + p.steel + ' per day<br>' +
      'Factory level: ' + p.factoryLevel + ' of ' + Sim.CFG.maxFactoryLevel + '<br>' +
      'Units here: ' + Sim.unitsIn(state, p.id).length;
    var mine = p.owner === 'player';
    var cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
    btnF.disabled = !(mine && p.factoryLevel < Sim.CFG.maxFactoryLevel && state.nations.player.equipment >= cost);
    btnF.textContent = p.factoryLevel >= Sim.CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + cost + ' eq)';
    btnI.disabled = !(mine && p.factoryLevel >= 1 && state.nations.player.equipment >= Sim.CFG.infantryCost);
    btnD.disabled = !(mine && p.factoryLevel >= 1 && state.nations.player.equipment >= Sim.CFG.droneCost);
    el.provExplain.textContent = mine
      ? 'Factories turn steel into equipment every day. Higher levels show bigger on the map and produce more.'
      : 'Enemy province. March a unit in to take it.';
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
    if (u.order) orderText = 'Marching to ' + state.provinces[u.order.target].name + ' at dawn.';
    el.unitDetails.innerHTML =
      base.label + ' (strength ' + u.strength + ' of ' + u.maxStrength + ')<br>' +
      'Attack ' + st.attack + ', Defense ' + st.defense +
      (u.type === 'drone' ? ' (Drone ' + (state.nations.player.droneGen2 ? 'Gen 2' : 'Gen 1') + ')' : '') + '<br>' +
      'Stationed in ' + state.provinces[u.provinceId].name + '.<br>' + orderText;
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
  el.btnTrainInf.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.trainUnit(state, 'player', 'infantry', selectedProvinceId); render(); }
  });
  el.btnTrainDrone.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.trainUnit(state, 'player', 'drone', selectedProvinceId); render(); }
  });

  newGame();
})();
