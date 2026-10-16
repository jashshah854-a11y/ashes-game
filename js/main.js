// Ashes of Empires, browser glue.
// All rules live in js/sim.js. This file only draws and listens.
(function () {
  'use strict';
  var Sim = window.AshesSim;
  var Lore = window.AshesLore;

  var state = null;
  var selectedProvinceId = null;
  var selectedUnitId = null;
  var paused = false;
  var speed = 1; // 1x or 2x
  var timer = null;
  // Lore overlays. A card or the codex pauses the war; closing the last
  // one puts the pause back the way the player had it.
  var shownBeats = {};       // beat ids whose card has been shown this game
  var cardQueue = [];        // card entries waiting: { kind: 'beat' or 'texture', ... }
  var shownTextureCount = 0; // texture records already queued this game (an index into state.textures)
  var pauseBeforeOverlay = null;
  var codexEntryId = 'ashwater';
  var prodNotice = ''; // the last refused queue or retool reason, shown in the production panel until the next attempt
  var provNotice = ''; // the last refused agent planting reason, shown in the province card until the next attempt

  var el = {};
  ['map', 'day-counter', 'day-max', 'btn-pause', 'btn-speed1', 'btn-speed2', 'btn-new',
   'stat-equipment', 'stat-steel', 'stat-steel-income', 'stat-factories', 'stat-research',
   'stat-manpower', 'stat-manpower-intake', 'manpower-explain',
   'stat-drone-gen', 'stat-jamming-gen', 'stat-interceptors', 'interceptor-explain',
   'stat-intel-live', 'stat-agents', 'agent-explain',
   'btn-research', 'research-explain', 'btn-research-gen3', 'research-gen3-explain',
   'btn-research-jamming', 'research-jamming-explain', 'prov-name', 'prov-details',
   'btn-factory', 'btn-fort', 'btn-agent', 'prov-notice', 'stat-enemy-forts', 'ai-fort-eq', 'prov-explain', 'unit-details',
   'stat-enemy-provs', 'stat-enemy-units', 'stat-enemy-gen', 'stat-enemy-jamming',
   'stat-enemy-interceptors', 'log', 'banner', 'rail-actions',
   'prod-summary', 'prod-notice', 'production-lines', 'stat-enemy-factories', 'stat-enemy-lines',
   'stat-enemy-manpower', 'stat-enemy-manpower-intake',
   'ex-player-destroyed', 'ex-player-lost', 'ex-player-forced', 'ex-player-suffered', 'ex-player-net',
   'ex-enemy-destroyed', 'ex-enemy-lost', 'ex-enemy-forced', 'ex-enemy-suffered', 'ex-enemy-net',
   'ex-headline', 'ex-explain',
   'btn-codex', 'event-overlay', 'event-kicker', 'event-title', 'event-body', 'event-why',
   'event-noeffect', 'btn-event-codex', 'btn-event-continue', 'codex-overlay', 'codex-nav',
   'codex-article', 'btn-codex-close'
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
      else checkLoreCards(); // no card over the end banner; the codex still lists what fired
    }, ms);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // A first game may be replayed with ?seed=N in the address (used by
  // tools/lore-check.js); New Game always draws a fresh random seed.
  var urlSeed = (function () {
    var m = /[?&]seed=(\d{1,9})(?:&|$)/.exec(window.location.search || '');
    return m ? parseInt(m[1], 10) : null;
  })();

  function newGame() {
    var seed = urlSeed != null ? urlSeed : Math.floor(Math.random() * 100000);
    urlSeed = null;
    state = Sim.createGame(seed);
    selectedProvinceId = null;
    selectedUnitId = null;
    paused = false;
    el.btnPause.textContent = 'Pause';
    el.banner.classList.add('hidden');
    shownBeats = {};
    cardQueue = [];
    shownTextureCount = 0;
    prodNotice = '';
    provNotice = '';
    codexEntryId = 'ashwater';
    pauseBeforeOverlay = null;
    el.eventOverlay.classList.add('hidden');
    el.codexOverlay.classList.add('hidden');
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

  // Snapshot unit groups as ghost figures, marked with their day:
  // the only unit figures a remembered province may show.
  function ghostChips(snap) {
    if (!snap || !snap.units.length) return '';
    var html = '<span class="units">';
    snap.units.forEach(function (g) {
      var label = (g.type === 'drone' ? 'Drone' : g.type === 'infantry' ? 'Inf' : g.type) +
        (g.count > 1 ? ' x' + g.count : '') + ' ' + g.totalStrength + 'hp';
      html += '<span class="unit-chip ghost">Day ' + snap.day + ' ghost: ' + label + '</span>';
    });
    return html + '</span>';
  }

  function renderMap() {
    var reach = reachableIds();
    var playerSupply = Sim.computeSupply(state, 'player');
    var html = '';
    for (var y = 0; y < state.mapH; y++) {
      for (var x = 0; x < state.mapW; x++) {
        var p = state.provinces[Sim.provinceId(x, y)];
        // Fog (Cycle 13 step 2): every tile's state comes from the
        // sim's one intel readout. Owned provinces are live by that
        // readout and render exactly as before. A remembered province
        // keeps its snapshot's owner color, dimmed and hatched, and
        // shows only its snapshot's badges and ghost figures. A dark
        // province shows no owner color, badges, rail, or units at
        // all: the theater map itself (name, ground, steel) is known,
        // the military facts are not.
        var intel = Sim.intelState(state, 'player', p.id);
        var snap = intel === 'remembered' ? Sim.intelSnapshot(state, 'player', p.id) : null;
        var shownOwner = intel === 'dark' ? 'fog' : (snap ? snap.owner : p.owner);
        var cls = 'province owner-' + shownOwner + ' intel-' + intel;
        if (p.id === selectedProvinceId) cls += ' selected';
        if (reach[p.id]) cls += ' reachable';
        if (p.owner === 'player' && playerSupply[p.id] && !playerSupply[p.id].supplied) cls += ' unsupplied';
        html += '<button type="button" class="' + cls + '" data-prov="' + p.id + '" data-intel="' + intel + '">';
        html += '<span class="pname">' + (p.isCapital ? '<span class="capital-mark">&#9733;</span> ' : '') + p.name + '</span>';
        html += '<span class="steel">Steel ' + p.steel + '</span>';
        if (intel === 'live') {
          if (p.factoryLevel > 0) {
            html += ' <span class="factory-badge lvl' + p.factoryLevel + '">Factory ' + p.factoryLevel + '</span>';
          }
          if (p.fortLevel > 0) html += ' <span class="fort-badge lvl' + p.fortLevel + '">Fort ' + p.fortLevel + '</span>';
          if (p.fortBuild) html += ' <span class="fort-badge building">Fort ' + p.fortBuild.toLevel + ' in ' + p.fortBuild.daysLeft + 'd</span>';
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
        } else if (intel === 'remembered' && snap) {
          if (snap.factoryLevel > 0) {
            html += ' <span class="factory-badge lvl' + snap.factoryLevel + '">Factory ' + snap.factoryLevel + '</span>';
          }
          if (snap.fortLevel > 0) html += ' <span class="fort-badge lvl' + snap.fortLevel + '">Fort ' + snap.fortLevel + '</span>';
          if (snap.fortBuild) html += ' <span class="fort-badge building">Fort ' + snap.fortBuild.toLevel + ' in ' + snap.fortBuild.daysLeft + 'd</span>';
          html += ghostChips(snap);
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
    // Manpower, from the sim's readouts only: the pool new units are
    // queued from, and the intake, which is provinces held times the
    // per province rate, stated in plain words under the rows.
    var playerProvs = Object.keys(state.provinces).filter(function (k) {
      return state.provinces[k].owner === 'player';
    }).length;
    el.statManpower.textContent = Sim.manpowerPool(state, 'player');
    el.statManpowerIntake.textContent = Sim.manpowerIntake(state, 'player');
    el.manpowerExplain.textContent =
      'Manpower is the pool new units are queued from, paid in full when you queue an order. ' +
      'It grows by ' + Sim.CFG.manpowerPerProvincePerDay + ' per day for each province you hold ' +
      '(you hold ' + playerProvs + ', so ' + Sim.manpowerIntake(state, 'player') + ' per day). ' +
      'Taking ground raises the intake, losing ground lowers it.';
    el.statDroneGen.textContent = 'Gen ' + Sim.droneGeneration(state, 'player');
    el.statJammingGen.textContent = 'Gen ' + Sim.jammingGeneration(state, 'player');
    el.statInterceptors.textContent = Sim.interceptorStock(state, 'player');
    el.interceptorExplain.textContent =
      'Interceptors launch on their own when enemy drone wings attack a province you defend: ' +
      'one per attacking drone wing, up to the stock on hand, and each launch costs ' +
      Sim.interceptorCost() + ' steel on the exchange scoreboard. Build more by retooling a ' +
      'production line to Interceptors (' + Sim.CFG.unitTypes.interceptor.steelCost + ' steel over ' +
      Sim.CFG.unitTypes.interceptor.buildDays + ' days, plus ' + Sim.manpowerCost('interceptor') +
      ' manpower paid when queued); a finished Interceptor joins this stockpile instead of deploying.';
    // Intel headline and agent stock, from the sim's intel readouts
    // only: provinces under live observation now, of the whole map,
    // and the agents waiting to be planted.
    el.statIntelLive.textContent = Sim.intelLiveCount(state, 'player') + ' of ' +
      Object.keys(state.provinces).length;
    el.statAgents.textContent = Sim.agentStock(state, 'player');
    el.agentExplain.textContent =
      'Agents are your deep eye: an agent watches one province you do not hold, live, until that ' +
      'province changes owner. Build one by retooling a production line to Agent (' +
      Sim.CFG.unitTypes.agent.steelCost + ' steel over ' + Sim.CFG.unitTypes.agent.buildDays +
      ' days, plus ' + Sim.manpowerCost('agent') + ' manpower paid when queued); a finished Agent ' +
      'joins this stockpile instead of deploying. Plant one from the card of any province you do ' +
      'not hold, with its Plant agent button. An agent reveals its province only, never its neighbors; ' +
      'drone wings are the wide eye, seeing two provinces away. Fog gates information, never orders.';
    el.btnResearch.disabled = n.droneGen2 || n.researchPoints < Sim.CFG.droneGen2Cost;
    el.btnResearch.textContent = n.droneGen2
      ? 'Drone Gen 2 fielded'
      : 'Research Drone Gen 2 (' + Sim.CFG.droneGen2Cost + ' pts)';
    // Drone Gen 3, in the Gen 2 button pattern: cost, prerequisite, and
    // current state are all stated on the button and its explain line.
    el.btnResearchGen3.disabled = !!n.droneGen3 || !n.droneGen2 || n.researchPoints < Sim.CFG.droneGen3Cost;
    el.btnResearchGen3.textContent = n.droneGen3
      ? 'Drone Gen 3 fielded'
      : (!n.droneGen2
        ? 'Research Drone Gen 3 (' + Sim.CFG.droneGen3Cost + ' pts, requires Drone Gen 2 first)'
        : 'Research Drone Gen 3 (' + Sim.CFG.droneGen3Cost + ' pts)');
    el.researchGen3Explain.textContent = n.droneGen3
      ? 'Drone Gen 3 is fielded: every drone wing is attack ' + Sim.CFG.droneGen3.attack +
        ', defense ' + Sim.CFG.droneGen3.defense + ', and your drone generation is 3.'
      : 'Gen 3 raises every drone wing to attack ' + Sim.CFG.droneGen3.attack + ', defense ' +
        Sim.CFG.droneGen3.defense + ', and raises your drone generation to 3 for the ' +
        'effectiveness counter. It requires Drone Gen 2 first.';
    // Jamming, bought in order through the one research path: the
    // button names the next generation, its cost, and its state.
    var jamGen = Sim.jammingGeneration(state, 'player');
    var jamDone = jamGen >= Sim.CFG.jammingCosts.length;
    el.btnResearchJamming.disabled = jamDone || n.researchPoints < Sim.CFG.jammingCosts[Math.min(jamGen, Sim.CFG.jammingCosts.length - 1)];
    el.btnResearchJamming.textContent = jamDone
      ? 'Jamming Gen ' + jamGen + ' fielded'
      : 'Research Jamming Gen ' + (jamGen + 1) + ' (' + Sim.CFG.jammingCosts[jamGen] + ' pts)';
    el.researchJammingExplain.textContent = jamDone
      ? 'Jamming is at Gen ' + jamGen + ', the highest generation. Enemy drone wings fight at the ' +
        'effectiveness the shared readout gives against it.'
      : 'Jamming Gen ' + (jamGen + 1) + ' costs ' + Sim.CFG.jammingCosts[jamGen] + ' pts' +
        (jamGen > 0 ? ', bought after Jamming Gen ' + jamGen : '') +
        '. Each jamming generation lowers enemy drone effectiveness through the shared readout. ' +
        'Jamming does not blunt interceptor launches.';

    var e = state.nations.enemy;
    var enemyProvs = Object.keys(state.provinces).filter(function (k) {
      return state.provinces[k].owner === 'enemy';
    }).length;
    el.statEnemyProvs.textContent = enemyProvs;
    el.statEnemyUnits.textContent = Sim.unitsOf(state, 'enemy').length;
    el.statEnemyGen.textContent = 'Gen ' + Sim.droneGeneration(state, 'enemy');
    el.statEnemyJamming.textContent = 'Gen ' + Sim.jammingGeneration(state, 'enemy');
    el.statEnemyInterceptors.textContent = Sim.interceptorStock(state, 'enemy');
    // The Dominion opens lines by the same factory thresholds you do, so its
    // factory total says when its next line arrives.
    var enemyLines = (e.productionLines || []).length;
    var enemyNext = Sim.lineLockInfo(state, 'enemy', enemyLines + 1);
    el.statEnemyFactories.textContent = Sim.factoryLevels(state, 'enemy');
    el.aiFortEq.textContent = Sim.CFG.aiFortifyEquipment;
    var forts = Object.keys(state.provinces).map(function (k) { return state.provinces[k]; })
      .filter(function (p) { return p.owner === 'enemy' && (p.fortLevel > 0 || p.fortBuild); })
      .map(function (p) { return p.name + ' ' + (p.fortLevel || 0) + (p.fortBuild ? ' (to ' + p.fortBuild.toLevel + ' in ' + p.fortBuild.daysLeft + 'd)' : ''); });
    el.statEnemyForts.textContent = forts.length ? forts.join(', ') : 'none';
    el.statEnemyLines.textContent = enemyLines + ' of ' + Sim.CFG.maxProductionLines +
      (enemyNext ? ' (next at ' + enemyNext.required + ' factory levels)' : '');
    // The Dominion queues from the same kind of pool, fed by the same
    // per province intake, so its numbers sit beside yours.
    el.statEnemyManpower.textContent = Sim.manpowerPool(state, 'enemy');
    el.statEnemyManpowerIntake.textContent = Sim.manpowerIntake(state, 'enemy');

    renderExchange();
    renderProduction();
    renderProvinceCard();
    renderUnitCard();
  }

  // Cost exchange scoreboard: every figure comes from the sim's
  // exchange readouts on every render, and nothing here (or anywhere
  // in the UI) writes to the ledger. The headline states the net in
  // plain words: whose net is positive is destroying and forcing more
  // than it loses, so the other side is bleeding steel faster.
  function renderExchange() {
    var p = Sim.exchangeRecord(state, 'player');
    var e = Sim.exchangeRecord(state, 'enemy');
    el.exPlayerDestroyed.textContent = p.destroyed;
    el.exPlayerLost.textContent = p.lost;
    el.exPlayerForced.textContent = p.forced;
    el.exPlayerSuffered.textContent = p.suffered;
    el.exPlayerNet.textContent = p.net;
    el.exEnemyDestroyed.textContent = e.destroyed;
    el.exEnemyLost.textContent = e.lost;
    el.exEnemyForced.textContent = e.forced;
    el.exEnemySuffered.textContent = e.suffered;
    el.exEnemyNet.textContent = e.net;
    if (p.net > 0) {
      el.exHeadline.textContent = 'The Dominion is bleeding faster: your net exchange is +' + p.net +
        ' steel, so you have destroyed and forced ' + p.net + ' steel more than you have lost and been forced to spend.';
    } else if (p.net < 0) {
      el.exHeadline.textContent = 'You are bleeding faster: your net exchange is ' + p.net +
        ' steel, so the Dominion has destroyed and forced ' + (-p.net) + ' steel more than it has lost and been forced to spend.';
    } else {
      el.exHeadline.textContent = 'The exchange is even: neither side is bleeding faster, and both net exchanges are 0 steel.';
    }
    el.exExplain.textContent = 'Net is destroyed plus launches forced, minus lost and launches suffered, all in steel. ' +
      'A drone wing costs ' + Sim.CFG.unitTypes.drone.steelCost + ' steel and an interceptor launch costs ' +
      Sim.interceptorCost() + ' steel, so a drone that dies forcing a launch still wins its exchange. ' +
      'This board records steel only: it decides nothing, pays for nothing, and changes no win condition.';
  }

  // Small helper: a div with a class and plain text content.
  function textDiv(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  }

  // Funded working days until this line reaches the efficiency cap,
  // from the sim's own CFG numbers. Presentation only: the effect of
  // efficiency itself is computed only in Sim's readouts.
  function fundedDaysToCap(line) {
    var eff = Sim.lineEfficiency(line);
    if (eff >= Sim.CFG.lineEfficiencyCap) return 0;
    return Math.ceil((Sim.CFG.lineEfficiencyCap - eff) / Sim.CFG.lineEfficiencyRisePerDay);
  }

  function dayWord(n) { return n === 1 ? 'day' : 'days'; }

  // Efficiency in plain words for one line: the percent, what it does
  // (the live build days from Sim.lineBuildDays against the base days),
  // and how far the cap is. A fresh line and a capped line each say so.
  function efficiencyLine(line, t) {
    var eff = Sim.lineEfficiency(line);
    var floor = Sim.CFG.lineEfficiencyFloor;
    var cap = Sim.CFG.lineEfficiencyCap;
    var live = Sim.lineBuildDays(line);
    if (eff >= cap) {
      return 'Efficiency ' + eff + '%: full efficiency. A fresh unit takes ' +
        live + ' ' + dayWord(live) + ' here instead of the base ' + t.buildDays + ' ' + dayWord(t.buildDays) + '.';
    }
    if (eff <= floor) {
      var toCap = fundedDaysToCap(line);
      return 'Efficiency ' + eff + '%, the starting level: this line has not practiced yet. ' +
        'A fresh unit takes the base ' + t.buildDays + ' ' + dayWord(t.buildDays) + ' here. ' +
        'It gains +' + Sim.CFG.lineEfficiencyRisePerDay + '% per funded working day and reaches ' +
        'full efficiency (' + cap + '%) after ' + toCap + ' funded working ' + dayWord(toCap) + '.';
    }
    var left = fundedDaysToCap(line);
    return 'Efficiency ' + eff + '% and rising: a fresh unit takes ' + live + ' ' + dayWord(live) +
      ' here instead of the base ' + t.buildDays + ' ' + dayWord(t.buildDays) + '. ' +
      left + ' funded working ' + dayWord(left) + ' to full efficiency (' + cap + '%).';
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
      'Manpower pool: ' + Sim.manpowerPool(state, 'player') + ' (queueing draws from this pool). ' +
      'Interceptor stock: ' + Sim.interceptorStock(state, 'player') + ' (finished Interceptors join this stockpile). ' +
      'Agent stock: ' + Sim.agentStock(state, 'player') + ' (finished Agents join this stockpile). ' +
      'Finished units deploy at ' + capName + '.';
    // A refused queue or retool attempt shows its reason here, in the
    // open, until the next attempt replaces or clears it.
    el.prodNotice.textContent = prodNotice;
    el.prodNotice.className = prodNotice ? 'prod-rejected' : 'hidden';

    el.productionLines.innerHTML = '';
    (n.productionLines || []).forEach(function (line) {
      var t = Sim.CFG.unitTypes[line.template];
      var otherTemplates = Object.keys(Sim.CFG.unitTypes).filter(function (x) { return x !== line.template; });

      var row = document.createElement('div');
      row.className = 'prod-line';

      row.appendChild(textDiv('prod-title', 'Line ' + line.id + ': ' + t.label));
      row.appendChild(textDiv('prod-row', t.steelCost + ' steel over ' + Sim.lineBuildDays(line) +
        ' ' + dayWord(Sim.lineBuildDays(line)) + ' at current efficiency (base ' + t.buildDays + ' ' + dayWord(t.buildDays) + '), plus ' +
        Sim.manpowerCost(line.template) + ' manpower paid in full when queued'));
      row.appendChild(textDiv('prod-row prod-eff', efficiencyLine(line, t)));
      row.appendChild(textDiv('prod-row', line.queue + ' in queue (max ' + Sim.CFG.maxQueuePerLine + ')'));

      if (line.queue <= 0) {
        row.appendChild(textDiv('prod-row prod-idle', 'Idle. Queue a unit to start building.'));
      } else {
        var daysLeft = Sim.lineDaysLeft(line);
        row.appendChild(textDiv('prod-row',
          line.progressDays + ' funded ' + dayWord(line.progressDays) + ' paid, ' + daysLeft +
          ' ' + dayWord(daysLeft) + ' left at the current efficiency'));
        row.appendChild(textDiv('prod-row',
          Sim.lineSteelPerDay(line.template) + ' steel per day while working'));
      }

      if (line.stalled) {
        row.appendChild(textDiv('prod-stalled', 'Stalled: not enough steel today. No progress made.'));
      }
      // Retool warning, computed live and shown before any click: the
      // steel already spent on the unit in progress, and the efficiency
      // the retool drops back to the floor, beside each other.
      var effNow = Sim.lineEfficiency(line);
      var effLost = effNow - Sim.CFG.lineEfficiencyFloor;
      if (line.progressDays > 0 || effLost > 0) {
        var note = '';
        if (line.progressDays > 0) {
          var steelSpent = line.progressDays * Sim.lineSteelPerDay(line.template);
          note = 'Retooling scraps the unit in progress and loses the ' + steelSpent + ' steel already spent on it.';
          note += effLost > 0
            ? ' It also drops efficiency from ' + effNow + '% back to ' + Sim.CFG.lineEfficiencyFloor + '%, losing ' + effLost + ' points of efficiency.'
            : ' Efficiency is at its starting ' + Sim.CFG.lineEfficiencyFloor + '%, so retooling loses no efficiency.';
        } else {
          note = 'Retooling drops efficiency from ' + effNow + '% back to ' + Sim.CFG.lineEfficiencyFloor +
            '%, losing ' + effLost + ' points of efficiency. No unit is in progress, so no steel is lost.';
        }
        row.appendChild(textDiv('prod-note', note));
      }

      var btns = document.createElement('div');
      btns.className = 'prod-btns';

      var qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.textContent = 'Queue ' + t.label + ' (+1)';
      qBtn.disabled = line.queue >= Sim.CFG.maxQueuePerLine;
      qBtn.addEventListener('click', function () {
        var res = Sim.queueProduction(state, 'player', line.id);
        prodNotice = res && !res.ok ? res.reason : '';
        render();
      });
      btns.appendChild(qBtn);

      otherTemplates.forEach(function (tpl) {
        var rBtn = document.createElement('button');
        rBtn.type = 'button';
        rBtn.textContent = 'Retool to ' + Sim.CFG.unitTypes[tpl].label;
        rBtn.addEventListener('click', function () {
          var res = Sim.assignLineTemplate(state, 'player', line.id, tpl);
          prodNotice = res && !res.ok ? res.reason : '';
          render();
        });
        btns.appendChild(rBtn);
      });

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

  // Fortification in plain words: level, the exact bonus, work under way.
  function fortLine(p) {
    var lvl = p.fortLevel || 0;
    var holder = p.owner === 'player' ? 'your' : 'Dominion';
    var line = 'Fortification: level ' + lvl + ' of ' + Sim.CFG.fortMaxLevel;
    if (lvl > 0) line += ', +' + (lvl * Sim.CFG.fortDefensePctPerLevel) + '% defense for ' + holder + ' units defending here';
    if (p.fortBuild) line += '. Being raised to level ' + p.fortBuild.toLevel + ', ' + p.fortBuild.daysLeft + (p.fortBuild.daysLeft === 1 ? ' day' : ' days') + ' left';
    return line;
  }

  function renderFortButton(p, mine) {
    var b = el.btnFort, lvl = p.fortLevel || 0;
    var cost = Sim.CFG.fortCostPerLevel * (lvl + 1);
    if (!mine) { b.disabled = true; b.textContent = 'Fortify (only your own provinces)'; return; }
    if (lvl >= Sim.CFG.fortMaxLevel) { b.disabled = true; b.textContent = 'Fortification at max level'; return; }
    if (p.fortBuild) { b.disabled = true; b.textContent = 'Fortifying: ' + p.fortBuild.daysLeft + ' days left'; return; }
    var have = state.nations.player.equipment;
    b.disabled = have < cost;
    b.textContent = 'Fortify to level ' + (lvl + 1) + ' (' + cost + ' eq, ' + Sim.CFG.fortBuildDays + ' days, +' +
      Sim.CFG.fortDefensePctPerLevel + '% defense)' + (have < cost ? ': need ' + cost + ', you have ' + have : '');
  }

  // How a hidden province becomes known, in plain words, stated
  // wherever a hidden province is looked at.
  function revealText(name) {
    return 'To see ' + name + ' live: bring one of your units next to it, bring a drone wing ' +
      'within two provinces of it, or plant an agent there.';
  }

  // A snapshot's unit groups in plain words, for the inspector and
  // the attack preview: counts and total strength, as recorded.
  function snapshotUnitsText(snap) {
    if (!snap || !snap.units.length) return 'none seen';
    return snap.units.map(function (g) {
      return g.count + ' ' + Sim.CFG.unitTypes[g.type].label + ' (' + g.totalStrength + ' total strength, ' +
        (g.nation === 'player' ? 'yours' : 'Dominion') + ')';
    }).join(', ');
  }

  function snapshotFortLine(snap) {
    var line = 'Fortification when last seen: level ' + snap.fortLevel + ' of ' + Sim.CFG.fortMaxLevel;
    if (snap.fortLevel > 0) line += ', +' + (snap.fortLevel * Sim.CFG.fortDefensePctPerLevel) + '% defense for its holder then';
    if (snap.fortBuild) line += '. Was being raised to level ' + snap.fortBuild.toLevel + ', ' + snap.fortBuild.daysLeft + ' days left then';
    return line;
  }

  // The Plant agent control: present on every province card, stated
  // plainly. On a province the player does not hold it stays enabled
  // even with an empty stock, so a click surfaces the sim's refusal
  // reason in the card notice instead of silently doing nothing.
  function renderAgentButton(p) {
    var b = el.btnAgent;
    if (!p) { b.disabled = true; b.textContent = 'Plant agent'; return; }
    if (p.owner === 'player') {
      b.disabled = true;
      b.textContent = 'Plant agent (your own provinces need none)';
      return;
    }
    b.disabled = false;
    b.textContent = 'Plant agent in ' + p.name + ' (stock: ' + Sim.agentStock(state, 'player') + ')';
  }

  function renderProvinceCard() {
    var p = selectedProvinceId ? state.provinces[selectedProvinceId] : null;
    var btnF = el.btnFactory;
    el.provNotice.textContent = provNotice;
    el.provNotice.className = provNotice ? 'prod-rejected' : 'hidden';
    if (!p) {
      el.provName.textContent = 'No province selected';
      el.provDetails.textContent = 'Click any province to inspect it.';
      btnF.disabled = true;
      el.btnFort.disabled = true;
      el.btnFort.textContent = 'Fortify';
      renderAgentButton(null);
      el.provExplain.textContent = '';
      el.railActions.innerHTML = '';
      return;
    }
    el.provName.textContent = p.name + (p.isCapital ? ' (capital)' : '');
    var mine = p.owner === 'player';
    var intel = Sim.intelState(state, 'player', p.id);
    if (intel === 'live') {
      var ownerName = mine ? 'Yours' : 'Dominion';
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
        'Intel: live, seen today (day ' + state.day + '). What follows is current.<br>' +
        'Owner: ' + ownerName + '<br>' +
        'Steel output: ' + p.steel + ' per day<br>' +
        'Factory level: ' + p.factoryLevel + ' of ' + Sim.CFG.maxFactoryLevel + '<br>' +
        fortLine(p) + '<br>' +
        supplyLine + '<br>' +
        'Units here: ' + Sim.unitsIn(state, p.id).length;
      el.provExplain.textContent = mine
        ? 'Factories turn steel into equipment every day. Higher levels show bigger on the map and produce more. ' +
          'Each day your production lines are paid first; factories run on the steel left, and a level with no steel sits idle. ' +
          lineUnlockText()
        : 'Enemy province, seen live today. March a unit in to take it.';
    } else if (intel === 'remembered') {
      var snap = Sim.intelSnapshot(state, 'player', p.id);
      el.provDetails.innerHTML =
        'Last seen on day ' + snap.day + ': this may have changed since.<br>' +
        'Owner when last seen: ' + (snap.owner === 'player' ? 'Yours' : 'Dominion') + '<br>' +
        'Factory level when last seen: ' + snap.factoryLevel + ' of ' + Sim.CFG.maxFactoryLevel + '<br>' +
        snapshotFortLine(snap) + '<br>' +
        'Rail when last seen: ' + (snap.rail ? 'rail touched this province' : 'no rail touched this province') + '<br>' +
        'Units when last seen: ' + snapshotUnitsText(snap);
      el.provExplain.textContent =
        'These figures are from day ' + snap.day + ', not today, and nothing here is current. ' +
        revealText(p.name) + ' You may still march or attack into it: fog gates information, never orders.';
    } else {
      el.provDetails.innerHTML =
        'Nothing is known beyond the map: this province has never been seen, so no owner, units, ' +
        'factories, forts, or rail state is shown for it.<br>' + revealText(p.name);
      el.provExplain.textContent =
        'Fog gates information, never orders: you may still march or attack toward it, but you will ' +
        'be moving blind until something sees it.';
    }
    renderRailActions(p);
    var cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
    btnF.disabled = !(mine && p.factoryLevel < Sim.CFG.maxFactoryLevel && state.nations.player.equipment >= cost);
    btnF.textContent = p.factoryLevel >= Sim.CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + cost + ' eq)';
    renderFortButton(p, mine);
    renderAgentButton(p);
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
      // Fog gates the preview, never the order (Cycle 13 step 2):
      // exact shared numbers only for a target seen live today. A
      // remembered target shows its snapshot, labelled with its day;
      // a dark target shows no enemy figures at all. Both state in
      // plain words that the true numbers are not known and how to
      // make them known.
      var npIntel = Sim.intelState(state, 'player', np.id);
      if (npIntel !== 'live') {
        var npSnap = Sim.intelSnapshot(state, 'player', np.id);
        var snapDefended = npSnap && npSnap.units.some(function (g) { return g.nation === 'enemy'; });
        if (!defs.length && !snapDefended) return;
        if (npIntel === 'remembered' && npSnap) {
          preview += '<br>Attack ' + np.name + ': last seen on day ' + npSnap.day + '. Defenders then: ' +
            snapshotUnitsText(npSnap) + '; fort level then: ' + npSnap.fortLevel +
            '. The true numbers today are not known. ' + revealText(np.name);
        } else {
          preview += '<br>Attack ' + np.name + ': nothing is known about its defenders today; ' +
            'no enemy figures are shown for a province you have never seen. ' +
            'The true numbers today are not known. ' + revealText(np.name);
        }
        return;
      }
      if (!defs.length) return;
      preview += '<br>Attack ' + np.name + ': your stack power ' + myPower +
        ' vs their defense ' + Sim.stackPower(state, defs, 'defense') + ' (supply effects included' +
        (np.fortLevel > 0 ? '; includes +' + (np.fortLevel * Sim.CFG.fortDefensePctPerLevel) + '% from level ' + np.fortLevel + ' fortifications' : '') + ').';
      preview += '<br>If they march out and meet you on the road: your attack ' + myPower +
        ' vs their attack ' + Sim.stackPower(state, defs, 'attack') + '.';
      // Drone and EW lines, from the same readouts the battle uses:
      // effectiveness for each side that fields drones in this fight,
      // with the two generation numbers that produced it, and the
      // interceptor launches an attack with drones would trigger.
      var myDrones = stack.filter(function (x) { return x.type === 'drone'; }).length;
      var theirDrones = defs.filter(function (x) { return x.type === 'drone'; }).length;
      if (myDrones > 0) {
        preview += '<br>Your drone wings fight at ' + Sim.droneEffectiveness(state, 'player', 'enemy') +
          '% effectiveness (your drone generation ' + Sim.droneGeneration(state, 'player') +
          ' against their jamming generation ' + Sim.jammingGeneration(state, 'enemy') + ').';
        var enemyStock = Sim.interceptorStock(state, 'enemy');
        if (enemyStock > 0) {
          var launches = Math.min(enemyStock, myDrones);
          preview += '<br>Attacking with ' + myDrones + (myDrones === 1 ? ' drone wing' : ' drone wings') +
            ' triggers ' + launches + (launches === 1 ? ' interceptor launch' : ' interceptor launches') +
            ' from their stock of ' + enemyStock + ', costing them ' + (launches * Sim.interceptorCost()) +
            ' steel. The targeted drone wings die to the interceptors before the battle and their attack never counts.';
        } else {
          preview += '<br>Attacking with ' + myDrones + (myDrones === 1 ? ' drone wing' : ' drone wings') +
            ' triggers no interceptor launches: their stock is empty.';
        }
      }
      if (theirDrones > 0) {
        preview += '<br>Their drone wings fight at ' + Sim.droneEffectiveness(state, 'enemy', 'player') +
          '% effectiveness (their drone generation ' + Sim.droneGeneration(state, 'enemy') +
          ' against your jamming generation ' + Sim.jammingGeneration(state, 'player') + ').';
      }
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
      (st.fortBonus > 0 ? ' (includes +' + st.fortBonus + '% from fortifications here)' : '') +
      (u.type === 'drone' ? ' (Drone generation ' + Sim.droneGeneration(state, u.nation) +
        ', fighting at ' + Sim.droneEffectiveness(state, u.nation) + '% effectiveness)' : '') + '<br>' +
      'Cost to build: ' + base.steelCost + ' steel over ' + base.buildDays + ' days at base speed on a production line (a practiced line builds faster; the Production panel shows each line\'s live days), plus ' + Sim.manpowerCost(u.type) + ' manpower paid in full from the pool when queued.<br>' +
      supplyText + '<br>' +
      'Stationed in ' + state.provinces[u.provinceId].name + '.<br>' + orderText + preview;
  }

  function renderLog() {
    var items = state.log.slice(-12).reverse();
    el.log.innerHTML = items.map(function (entry) {
      return '<li><span class="day-tag">Day ' + entry.day + '</span>' + entry.msg + '</li>';
    }).join('');
  }

  // ---------- Lore: event cards and the codex ----------
  function setPaused(p) {
    paused = p;
    el.btnPause.textContent = paused ? 'Resume' : 'Pause';
  }
  function overlayOpen() {
    return !el.eventOverlay.classList.contains('hidden') || !el.codexOverlay.classList.contains('hidden');
  }
  // The player's own pause is remembered once, when the first overlay of a
  // run opens, and kept until the last one closes; a second card on the
  // same day or the codex opened from a card must not overwrite it.
  function openOverlayPause() {
    if (pauseBeforeOverlay === null) pauseBeforeOverlay = paused;
    setPaused(true);
  }
  function closeOverlayPause() {
    if (overlayOpen()) return;
    if (pauseBeforeOverlay !== null) setPaused(pauseBeforeOverlay);
    pauseBeforeOverlay = null;
  }

  var WHO = {
    player: 'The Vessari reached it first.',
    enemy: 'The Khessites reached it first.',
    both: 'Both sides reached it on the same day.'
  };

  function ordinal(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return n + 'th';
    if (n % 10 === 1) return n + 'st';
    if (n % 10 === 2) return n + 'nd';
    if (n % 10 === 3) return n + 'rd';
    return n + 'th';
  }
  var SIDE_NAME = { player: 'the Vessari', enemy: 'the Khessites' };

  // Turning points come from the sim (state.beats) and recurring texture
  // from state.textures; their words come from js/lore.js. A beat queues
  // its card once; every texture occurrence queues its own card, in the
  // order it happened, with its occurrence count for its side. Textures
  // happen during the day and beats are recorded at the end of the tick,
  // so a tick's texture cards queue before its beat cards.
  function checkLoreCards() {
    var textures = state.textures || [];
    while (shownTextureCount < textures.length) {
      var rec = textures[shownTextureCount];
      var occ = 0;
      for (var i = 0; i <= shownTextureCount; i++) {
        if (textures[i].id === rec.id && textures[i].by === rec.by) occ++;
      }
      shownTextureCount++;
      cardQueue.push({ kind: 'texture', id: rec.id, day: rec.day, by: rec.by, occurrence: occ });
    }
    var beats = state.beats || {};
    Sim.BEAT_IDS.forEach(function (id) {
      if (beats[id] && !shownBeats[id]) { shownBeats[id] = true; cardQueue.push({ kind: 'beat', id: id }); }
    });
    if (cardQueue.length && el.eventOverlay.classList.contains('hidden')) showNextCard();
  }

  function showNextCard() {
    var card = cardQueue.shift();
    var whyText;
    if (card.kind === 'texture') {
      var tx = Lore.textures[card.id];
      el.eventKicker.textContent = 'Recurring texture, day ' + card.day +
        (card.occurrence > 1 ? ', ' + ordinal(card.occurrence) + ' time for ' + SIDE_NAME[card.by] : '');
      el.eventTitle.textContent = tx.title;
      el.eventBody.textContent = tx.variants[card.by];
      whyText = 'on day ' + card.day + ' ' + tx.trigger + '. ' +
        (card.by === 'player' ? 'The Vessari did this. ' : 'The Khessites did this. ') +
        (card.occurrence === 1
          ? 'This is the first time for ' + SIDE_NAME[card.by] + ' in this war.'
          : 'This is the ' + ordinal(card.occurrence) + ' time for ' + SIDE_NAME[card.by] + ' in this war.');
    } else {
      var beat = state.beats[card.id];
      var text = Lore.beats[card.id];
      el.eventKicker.textContent = 'Turning point, day ' + beat.day;
      el.eventTitle.textContent = text.title;
      el.eventBody.textContent = text.variants[beat.by];
      whyText = 'on day ' + beat.day + ' ' + text.trigger + '. ' + WHO[beat.by];
    }
    el.eventWhy.innerHTML = '';
    var label = document.createElement('span');
    label.className = 'why-label';
    label.textContent = 'Why this card: ';
    el.eventWhy.appendChild(label);
    el.eventWhy.appendChild(document.createTextNode(whyText));
    el.eventNoeffect.textContent = Lore.noEffect;
    openOverlayPause();
    el.eventOverlay.classList.remove('hidden');
    el.btnEventContinue.focus();
  }

  function closeCard() {
    el.eventOverlay.classList.add('hidden');
    if (cardQueue.length) { showNextCard(); return; }
    closeOverlayPause();
  }

  function openCodex(entryId) {
    if (entryId) codexEntryId = entryId;
    el.eventOverlay.classList.add('hidden');
    openOverlayPause();
    el.codexOverlay.classList.remove('hidden');
    renderCodex();
    el.btnCodexClose.focus();
  }

  function closeCodex() {
    el.codexOverlay.classList.add('hidden');
    if (cardQueue.length) { showNextCard(); return; } // cards waiting behind the codex
    closeOverlayPause();
  }

  function renderCodex() {
    el.codexNav.innerHTML = '';
    var head = textDiv('kicker', 'History');
    el.codexNav.appendChild(head);
    Lore.codexOrder.forEach(function (id) {
      var entry = Lore.entries[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'codex-entry';
      b.setAttribute('aria-pressed', id === codexEntryId ? 'true' : 'false');
      var t = document.createElement('span'); t.className = 'entry-title'; t.textContent = entry.title;
      var k = document.createElement('span'); k.className = 'entry-kind'; k.textContent = entry.kind;
      b.appendChild(t); b.appendChild(k);
      b.addEventListener('click', function () { codexEntryId = id; renderCodex(); });
      el.codexNav.appendChild(b);
    });
    el.codexNav.appendChild(textDiv('kicker later', 'Turning points so far'));
    // Reached turning points in the order they happened, then the rest.
    var beats = state.beats || {};
    Sim.BEAT_IDS.slice().sort(function (a, b) {
      var da = beats[a] ? beats[a].day : Infinity, db = beats[b] ? beats[b].day : Infinity;
      return da - db || Sim.BEAT_IDS.indexOf(a) - Sim.BEAT_IDS.indexOf(b);
    }).forEach(function (id) {
      var beat = beats[id];
      if (!beat) {
        el.codexNav.appendChild(textDiv('codex-beat pending', Lore.beats[id].title + ': not yet'));
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'codex-entry';
      b.setAttribute('aria-pressed', codexEntryId === 'beat:' + id ? 'true' : 'false');
      var t = document.createElement('span'); t.className = 'entry-title';
      var d = document.createElement('span'); d.className = 'beat-day'; d.textContent = 'Day ' + beat.day + ' ';
      t.appendChild(d); t.appendChild(document.createTextNode(Lore.beats[id].title));
      var k = document.createElement('span'); k.className = 'entry-kind'; k.textContent = WHO[beat.by];
      b.appendChild(t); b.appendChild(k);
      b.addEventListener('click', function () { codexEntryId = 'beat:' + id; renderCodex(); });
      el.codexNav.appendChild(b);
    });
    el.codexNav.appendChild(textDiv('kicker later', 'Recurring texture so far'));
    // Recurring texture reached so far: one button per card that has
    // fired, with its total count and latest day; the rest marked not yet.
    var texturesAll = state.textures || [];
    function textureRecords(id) {
      return texturesAll.filter(function (r) { return r.id === id; });
    }
    Sim.TEXTURE_IDS.forEach(function (id) {
      var recs = textureRecords(id);
      if (!recs.length) {
        el.codexNav.appendChild(textDiv('codex-texture pending', Lore.textures[id].title + ': not yet'));
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'codex-entry';
      b.setAttribute('aria-pressed', codexEntryId === 'texture:' + id ? 'true' : 'false');
      var t = document.createElement('span'); t.className = 'entry-title'; t.textContent = Lore.textures[id].title;
      var k = document.createElement('span'); k.className = 'entry-kind';
      k.textContent = recs.length + (recs.length === 1 ? ' time' : ' times') + ', latest day ' + recs[recs.length - 1].day;
      b.appendChild(t); b.appendChild(k);
      b.addEventListener('click', function () { codexEntryId = 'texture:' + id; renderCodex(); });
      el.codexNav.appendChild(b);
    });
    var entry;
    if (codexEntryId.indexOf('texture:') === 0 && textureRecords(codexEntryId.slice(8)).length) {
      var tid = codexEntryId.slice(8), trecs = textureRecords(tid), lt = Lore.textures[tid];
      var paras = [];
      ['player', 'enemy'].forEach(function (side) {
        var rs = trecs.filter(function (r) { return r.by === side; });
        if (!rs.length) return;
        var days = rs.map(function (r) { return r.day; });
        paras.push((side === 'player' ? 'The Vessari' : 'The Khessites') + ': ' + rs.length +
          (rs.length === 1 ? ' time' : ' times') + ', on ' +
          (days.length === 1 ? 'day ' + days[0] : 'days ' + days.join(', ')) + '.');
        paras.push(lt.variants[side]);
      });
      entry = { kind: 'Recurring texture, ' + trecs.length + (trecs.length === 1 ? ' time' : ' times') + ' so far',
        title: lt.title,
        text: ['Why these cards: ' + lt.trigger + '.'].concat(paras).concat([Lore.noEffect]) };
    } else if (codexEntryId.indexOf('beat:') === 0 && beats[codexEntryId.slice(5)]) {
      var bid = codexEntryId.slice(5), rec = beats[bid], lb = Lore.beats[bid];
      entry = { kind: 'Turning point, day ' + rec.day, title: lb.title,
        text: [lb.variants[rec.by], 'Why this card: on day ' + rec.day + ' ' + lb.trigger + '. ' + WHO[rec.by], Lore.noEffect] };
    } else {
      // A beat selection from an earlier game (or one not reached yet in
      // this game) falls back to the first history entry, never a crash.
      entry = Lore.entries[codexEntryId] || Lore.entries.ashwater;
    }
    el.codexArticle.innerHTML = '';
    el.codexArticle.appendChild(textDiv('kicker', entry.kind));
    var h = document.createElement('h3'); h.textContent = entry.title;
    el.codexArticle.appendChild(h);
    el.codexArticle.appendChild(textDiv('rule', ''));
    entry.text.forEach(function (para) {
      var p = document.createElement('p'); p.textContent = para;
      el.codexArticle.appendChild(p);
    });
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
    if (overlayOpen()) return; // a card or the codex holds the pause until closed
    setPaused(!paused);
  });
  el.btnCodex.addEventListener('click', function () { openCodex(); });
  el.btnCodexClose.addEventListener('click', closeCodex);
  el.btnEventContinue.addEventListener('click', closeCard);
  el.btnEventCodex.addEventListener('click', function () { openCodex('ashwater'); });
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
  el.btnResearchGen3.addEventListener('click', function () {
    Sim.researchDroneGen3(state, 'player');
    render();
  });
  el.btnResearchJamming.addEventListener('click', function () {
    Sim.researchJamming(state, 'player');
    render();
  });
  el.btnFort.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildFortification(state, 'player', selectedProvinceId); render(); }
  });
  el.btnFactory.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildFactory(state, 'player', selectedProvinceId); render(); }
  });
  el.btnAgent.addEventListener('click', function () {
    if (!selectedProvinceId) return;
    var res = Sim.plantAgent(state, 'player', selectedProvinceId);
    provNotice = res && !res.ok ? res.reason : '';
    render();
  });

  newGame();
})();
