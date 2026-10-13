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
  var cardQueue = [];        // beat ids waiting for their card
  var pauseBeforeOverlay = null;
  var codexEntryId = 'ashwater';

  var el = {};
  ['map', 'day-counter', 'day-max', 'btn-pause', 'btn-speed1', 'btn-speed2', 'btn-new',
   'stat-equipment', 'stat-steel', 'stat-steel-income', 'stat-factories', 'stat-research',
   'stat-drone-gen', 'stat-jamming', 'research-list', 'research-explain', 'stat-enemy-jam', 'stat-enemy-research', 'ai-research-order', 'prov-name', 'prov-details',
   'btn-factory', 'btn-fort', 'stat-enemy-forts', 'ai-fort-eq', 'ai-ad-eq', 'btn-ad', 'stat-enemy-ad',
   'xc-you', 'xc-them', 'xc-ratio', 'xc-you-lost', 'xc-you-launch', 'xc-them-lost', 'xc-them-launch', 'xc-explain', 'prov-explain', 'unit-details',
   'stat-enemy-provs', 'stat-enemy-units', 'stat-enemy-gen', 'log', 'banner', 'rail-actions',
   'prod-summary', 'production-lines', 'stat-enemy-factories', 'stat-enemy-lines',
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
      else checkBeats(); // no card over the end banner; the codex still lists the beat
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
        if (p.fortLevel > 0) html += ' <span class="fort-badge lvl' + p.fortLevel + '">Fort ' + p.fortLevel + '</span>';
        if (p.fortBuild) html += ' <span class="fort-badge building">Fort ' + p.fortBuild.toLevel + ' in ' + p.fortBuild.daysLeft + 'd</span>';
        if (p.airDefense > 0) html += ' <span class="ad-badge">AD</span>';
        if (p.airDefenseBuild) html += ' <span class="ad-badge building">AD in ' + p.airDefenseBuild.daysLeft + 'd</span>';
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
    el.statDroneGen.textContent = droneGenText('player');
    el.statJamming.textContent = jammingText('player');
    renderResearch();

    var e = state.nations.enemy;
    var enemyProvs = Object.keys(state.provinces).filter(function (k) {
      return state.provinces[k].owner === 'enemy';
    }).length;
    el.statEnemyProvs.textContent = enemyProvs;
    el.statEnemyUnits.textContent = Sim.unitsOf(state, 'enemy').length;
    el.statEnemyGen.textContent = droneGenText('enemy');
    el.statEnemyJam.textContent = jammingText('enemy');
    var aiNext = Sim.CFG.aiResearchOrder.filter(function (id) { return !Sim.hasResearched(state, 'enemy', id); })[0];
    el.statEnemyResearch.textContent = aiNext
      ? Sim.CFG.research[aiNext].label + ' at ' + Sim.CFG.research[aiNext].cost + ' points (it has ' + e.researchPoints + ', gaining ' +
        Sim.CFG.researchPerDay + ' a day): ' + (function () {
          var k = daysToAfford(e.researchPoints, Sim.CFG.research[aiNext].cost);
          return k === 0 ? 'it buys it at the start of day ' + state.day : 'day ' + (state.day + k) + ', in ' + k + (k === 1 ? ' day' : ' days');
        })()
      : 'all researched';
    el.aiResearchOrder.textContent = Sim.CFG.aiResearchOrder.map(function (id) { return Sim.CFG.research[id].label; }).join(', then ');
    // The Dominion opens lines by the same factory thresholds you do, so its
    // factory total says when its next line arrives.
    var enemyLines = (e.productionLines || []).length;
    var enemyNext = Sim.lineLockInfo(state, 'enemy', enemyLines + 1);
    el.statEnemyFactories.textContent = Sim.factoryLevels(state, 'enemy');
    el.aiFortEq.textContent = Sim.CFG.aiFortifyEquipment;
    el.aiAdEq.textContent = Sim.CFG.aiAirDefenseEquipment;
    var forts = Object.keys(state.provinces).map(function (k) { return state.provinces[k]; })
      .filter(function (p) { return p.owner === 'enemy' && (p.fortLevel > 0 || p.fortBuild); })
      .map(function (p) { return p.name + ' ' + (p.fortLevel || 0) + (p.fortBuild ? ' (to ' + p.fortBuild.toLevel + ' in ' + p.fortBuild.daysLeft + 'd)' : ''); });
    el.statEnemyForts.textContent = forts.length ? forts.join(', ') : 'none';
    var ads = Object.keys(state.provinces).map(function (k) { return state.provinces[k]; })
      .filter(function (p) { return p.owner === 'enemy' && (p.airDefense > 0 || p.airDefenseBuild); })
      .map(function (p) { return p.name + (p.airDefenseBuild ? ' (building, ' + p.airDefenseBuild.daysLeft + 'd)' : ''); });
    el.statEnemyAd.textContent = ads.length ? ads.join(', ') : 'none';
    renderExchange();
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

  // Fortification in plain words: level, the exact bonus, work under way.
  function fortLine(p) {
    var lvl = p.fortLevel || 0;
    var holder = p.owner === 'player' ? 'your' : 'Dominion';
    var line = 'Fortification: level ' + lvl + ' of ' + Sim.CFG.fortMaxLevel;
    if (lvl > 0) line += ', +' + (lvl * Sim.CFG.fortDefensePctPerLevel) + '% defense for ' + holder + ' units defending here';
    if (p.fortBuild) line += '. Being raised to level ' + p.fortBuild.toLevel + ', ' + p.fortBuild.daysLeft + (p.fortBuild.daysLeft === 1 ? ' day' : ' days') + ' left';
    return line;
  }

  // ---------- Research and jamming, in plain words from CFG ----------
  function otherSide(id) { return id === 'player' ? 'enemy' : 'player'; }
  function projectEffect(id) {
    var C = Sim.CFG;
    if (id === 'droneGen2') return 'Every drone wing fights at attack ' + C.droneGen2.attack + ', defense ' + C.droneGen2.defense +
      ' (Gen 1 is attack ' + C.unitTypes.drone.attack + ', defense ' + C.unitTypes.drone.defense + ').';
    if (id === 'droneGen3') return 'Every drone wing fights at attack ' + C.droneGen3.attack + ', defense ' + C.droneGen3.defense +
      ', and no jamming reaches Gen 3.';
    if (id === 'jamming1' || id === 'jamming2') {
      var reach = id === 'jamming1' ? 1 : 2;
      var theirs = Sim.droneGeneration(state, 'enemy');
      return 'Enemy drone wings of Gen ' + (reach === 1 ? '1' : '1 and 2') + ' fight at -' + C.jammingPct + '% attack and defense, rounded (' +
        'a Gen ' + reach + ' wing: ' + jammedChange(reach) + '). ' +
        (theirs <= reach ? 'Their wings are Gen ' + theirs + ' now: this would jam them.' : 'Their wings are Gen ' + theirs + ' now: this would not reach them.');
    }
    return '';
  }
  // Is this side's drone generation reached by the other side's jamming?
  function jammedBy(id) {
    var gen = Sim.droneGeneration(state, id);
    return (state.nations[otherSide(id)].jamming || 0) >= gen;
  }
  // The real jammed numbers, rounded the way combat rounds them.
  function jammedChange(gen) {
    var b = Sim.droneStatLine(gen);
    return 'attack ' + b.attack + ' to ' + Sim.jammedValue(b.attack) + ', defense ' + b.defense + ' to ' + Sim.jammedValue(b.defense);
  }
  function droneGenText(id) {
    var gen = Sim.droneGeneration(state, id);
    return 'Gen ' + gen + (jammedBy(id) ? ' (jammed: ' + jammedChange(gen) + ')' : '');
  }
  // Days until a side holding pts points, gaining researchPerDay a day, can
  // pay cost. Points arrive in each day's economy, after the day's
  // decisions, so a project is bought at the start of the day after.
  function daysToAfford(pts, cost) { return pts >= cost ? 0 : Math.ceil((cost - pts) / Sim.CFG.researchPerDay); }
  function jammingText(id) {
    var lvl = state.nations[id].jamming || 0;
    if (!lvl) return 'none';
    var reaches = jammedBy(otherSide(id));
    return 'Gen ' + lvl + (reaches ? ', jamming ' + (id === 'player' ? 'their' : 'your') + ' Gen ' + Sim.droneGeneration(state, otherSide(id)) + ' wings'
      : ', ' + (id === 'player' ? 'their' : 'your') + ' Gen ' + Sim.droneGeneration(state, otherSide(id)) + ' wings are beyond it');
  }
  function renderResearch() {
    var n = state.nations.player;
    var html = '';
    Object.keys(Sim.CFG.research).forEach(function (id) {
      var p = Sim.CFG.research[id];
      var done = Sim.hasResearched(state, 'player', id);
      var label = 'Research (' + p.cost + ' pts)', disabled = false;
      if (done) { label = 'Fielded'; disabled = true; }
      else if (p.requires && !Sim.hasResearched(state, 'player', p.requires)) { label = 'Needs ' + Sim.CFG.research[p.requires].label + ' first'; disabled = true; }
      else if (n.researchPoints < p.cost) {
        var wait = daysToAfford(n.researchPoints, p.cost);
        label = 'Research (' + p.cost + ' pts): need ' + p.cost + ', you have ' + n.researchPoints + ' (affordable in ' + wait + (wait === 1 ? ' day' : ' days') + ')';
        disabled = true;
      }
      html += '<div class="research-item' + (done ? ' done' : '') + '"><div class="research-title">' + p.label + ' <span class="research-cost">' +
        p.cost + ' pts</span></div><div class="research-effect">' + projectEffect(id) + '</div>' +
        '<button type="button" data-project="' + id + '" id="research-' + id + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button></div>';
    });
    el.researchList.innerHTML = html;
    el.researchExplain.textContent = 'You gain ' + Sim.CFG.researchPerDay + ' research points a day, as the Dominion does (you have ' + n.researchPoints + '). ' +
      'Each project is bought once, one at a time, from the points you have. Jamming of a generation works against enemy drone wings of that ' +
      'generation or lower; the Dominion researches in its stated order, shown on its card.';
  }

  // The steel exchange: what each side has bled, from the sim's ledger,
  // rounded to whole steel for display only.
  function bled(id) { var l = state.ledger[id]; return Math.round(l.lostSteel + l.launchSteel); }
  function renderExchange() {
    var you = bled('player'), them = bled('enemy');
    el.xcYou.textContent = you;
    el.xcThem.textContent = them;
    var ratio = 'No steel bled yet.';
    if (you > 0 && them > 0) {
      ratio = them >= you
        ? 'The Dominion bleeds ' + (them / you).toFixed(1) + ' steel for every 1 of yours.'
        : 'You bleed ' + (you / them).toFixed(1) + ' steel for every 1 of theirs.';
    } else if (you > 0) {
      ratio = 'Only you have bled so far.';
    } else if (them > 0) {
      ratio = 'Only the Dominion has bled so far.';
    }
    el.xcRatio.textContent = ratio;
    el.xcYouLost.textContent = Math.round(state.ledger.player.lostSteel);
    var launches = function (n) { return n + (n === 1 ? ' launch' : ' launches'); };
    el.xcYouLaunch.textContent = state.ledger.player.launchSteel + ' (' + launches(state.ledger.player.launches) + ')';
    el.xcThemLost.textContent = Math.round(state.ledger.enemy.lostSteel);
    el.xcThemLaunch.textContent = state.ledger.enemy.launchSteel + ' (' + launches(state.ledger.enemy.launches) + ')';
    var per = Object.keys(Sim.CFG.unitTypes).map(function (k) {
      var t = Sim.CFG.unitTypes[k];
      var name = t.label.toLowerCase();
      return (/^[aeiou]/.test(name) ? 'an ' : 'a ') + name + ' of ' + t.strength + ' strength costs ' + t.steelCost + ' steel, so ' +
        (t.steelCost / t.strength) + ' a point';
    });
    el.xcExplain.textContent = 'Who bleeds steel faster. Every point of strength a unit loses, in battle, to interceptors, ' +
      'or to attrition, is counted at its share of the unit\'s steel cost (' + per.join('; ') + '). Interceptor launches ' +
      'count the steel they burn, ' + Sim.CFG.interceptorSteel + ' each. The header shows both totals, rounded. ' +
      'The scoreboard informs; it does not decide the war.';
  }

  // Air defense in plain words: what stands, what it does, what it costs.
  function airDefenseLine(p) {
    var holder = p.owner === 'player' ? 'your' : 'the Dominion\'s';
    if (p.airDefenseBuild) return 'Air defense: being built, ' + p.airDefenseBuild.daysLeft + (p.airDefenseBuild.daysLeft === 1 ? ' day' : ' days') + ' left';
    if (!(p.airDefense > 0)) return 'Air defense: none';
    return 'Air defense: standing. When enemy drone wings attack troops here, it launches one interceptor per wing before the fight, ' +
      Sim.CFG.interceptorSteel + ' steel each from ' + holder + ' stockpile, -' + Sim.CFG.interceptStrength +
      ' strength per wing hit, while that steel lasts. It is lost if the province falls';
  }

  function renderAirDefenseButton(p, mine) {
    var b = el.btnAd, cost = Sim.CFG.airDefenseCost;
    if (!mine) { b.disabled = true; b.textContent = 'Air defense (only your own provinces)'; return; }
    if (p.airDefense > 0) { b.disabled = true; b.textContent = 'Air defense standing'; return; }
    if (p.airDefenseBuild) { b.disabled = true; b.textContent = 'Building air defense: ' + p.airDefenseBuild.daysLeft + ' days left'; return; }
    var have = state.nations.player.equipment;
    b.disabled = have < cost;
    b.textContent = 'Build air defense (' + cost + ' eq, ' + Sim.CFG.airDefenseBuildDays + ' days; ' + Sim.CFG.interceptorSteel +
      ' steel per launch)' + (have < cost ? ': need ' + cost + ', you have ' + have : '');
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

  function renderProvinceCard() {
    var p = selectedProvinceId ? state.provinces[selectedProvinceId] : null;
    var btnF = el.btnFactory;
    if (!p) {
      el.provName.textContent = 'No province selected';
      el.provDetails.textContent = 'Click any province to inspect it.';
      btnF.disabled = true;
      el.btnFort.disabled = true;
      el.btnFort.textContent = 'Fortify';
      el.btnAd.disabled = true;
      el.btnAd.textContent = 'Build air defense';
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
      fortLine(p) + '<br>' +
      airDefenseLine(p) + '<br>' +
      supplyLine + '<br>' +
      'Units here: ' + Sim.unitsIn(state, p.id).length;
    renderRailActions(p);
    var mine = p.owner === 'player';
    var cost = Sim.CFG.factoryCostPerLevel * (p.factoryLevel + 1);
    btnF.disabled = !(mine && p.factoryLevel < Sim.CFG.maxFactoryLevel && state.nations.player.equipment >= cost);
    btnF.textContent = p.factoryLevel >= Sim.CFG.maxFactoryLevel
      ? 'Factory at max level'
      : 'Build / Upgrade Factory (' + cost + ' eq)';
    renderFortButton(p, mine);
    renderAirDefenseButton(p, mine);
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
      // Air defense there strikes your drone wings before the fight; the
      // power below is what is left after the launches it can pay for.
      var hit = Sim.interceptPlan(state, stack, np.id);
      var vsHere = Sim.stackPower(state, stack, 'attack', np.id);
      var adText = '';
      if (np.airDefense > 0) {
        var wings = stack.filter(function (x) { return x.type === 'drone'; }).length;
        var downed = hit.filter(function (x) { return x.strength <= Sim.CFG.interceptStrength; }).length;
        var survive = hit.length - downed;
        adText = ' Their air defense there launches one interceptor per drone wing (' + Sim.CFG.interceptorSteel +
          ' steel each, -' + Sim.CFG.interceptStrength + ' strength) while their steel lasts: ';
        if (!wings) {
          adText += 'it strikes only drone wings, and this stack has none.';
        } else {
          adText += hit.length + ' of your ' + wings + (wings === 1 ? ' wing' : ' wings') + ' would be hit' +
            (hit.length ? ' (' + (hit.length * Sim.CFG.interceptorSteel) + ' of their steel)' : '') +
            (downed ? ', ' + downed + ' downed before the fight' : '') +
            (survive ? ', ' + survive + (survive === 1 ? ' fights on' : ' fight on') + ' at lower strength with full attack' : '') + '.';
        }
      }
      preview += '<br>Attack ' + np.name + ': your stack power ' + vsHere +
        (vsHere !== myPower ? ' (' + myPower + ' before interception)' : '') +
        (stack.some(function (x) { return Sim.unitStats(state, x).jamming > 0; }) ? ' (includes -' + Sim.CFG.jammingPct + '% on your jammed drone wings)' : '') +
        ' vs their defense ' + Sim.stackPower(state, defs, 'defense') + ' (supply effects included' +
        (defs.some(function (x) { return Sim.unitStats(state, x).jamming > 0; }) ? '; includes -' + Sim.CFG.jammingPct + '% on their jammed drone wings' : '') +
        (np.fortLevel > 0 ? '; includes +' + (np.fortLevel * Sim.CFG.fortDefensePctPerLevel) + '% from level ' + np.fortLevel + ' fortifications' : '') + ').' + adText;
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
      (st.fortBonus > 0 ? ' (includes +' + st.fortBonus + '% from fortifications here)' : '') +
      (u.type === 'drone' ? ' (Drone Gen ' + Sim.droneGeneration(state, 'player') + ')' : '') +
      (st.jamming > 0 ? ' (includes -' + st.jamming + '% from Dominion Jamming Gen ' + state.nations.enemy.jamming + ')' : '') + '<br>' +
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

  // Turning points come from the sim (state.beats); their words come from
  // js/lore.js. A beat recorded this tick queues its card once.
  function checkBeats() {
    var beats = state.beats || {};
    Sim.BEAT_IDS.forEach(function (id) {
      if (beats[id] && !shownBeats[id]) { shownBeats[id] = true; cardQueue.push(id); }
    });
    if (cardQueue.length && el.eventOverlay.classList.contains('hidden')) showNextCard();
  }

  function showNextCard() {
    var id = cardQueue.shift();
    var beat = state.beats[id];
    var text = Lore.beats[id];
    el.eventKicker.textContent = 'Turning point, day ' + beat.day;
    el.eventTitle.textContent = text.title;
    el.eventBody.textContent = text.variants[beat.by];
    el.eventWhy.innerHTML = '';
    var label = document.createElement('span');
    label.className = 'why-label';
    label.textContent = 'Why this card: ';
    el.eventWhy.appendChild(label);
    el.eventWhy.appendChild(document.createTextNode('on day ' + beat.day + ' ' + text.trigger + '. ' + WHO[beat.by]));
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
    var entry;
    if (codexEntryId.indexOf('beat:') === 0) {
      var bid = codexEntryId.slice(5), rec = beats[bid], lb = Lore.beats[bid];
      entry = { kind: 'Turning point, day ' + rec.day, title: lb.title,
        text: [lb.variants[rec.by], 'Why this card: on day ' + rec.day + ' ' + lb.trigger + '. ' + WHO[rec.by], Lore.noEffect] };
    } else {
      entry = Lore.entries[codexEntryId];
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
  el.researchList.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('button[data-project]') : null;
    if (!b || b.disabled) return;
    Sim.research(state, 'player', b.getAttribute('data-project'));
    render();
  });
  el.btnFort.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildFortification(state, 'player', selectedProvinceId); render(); }
  });
  el.btnAd.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildAirDefense(state, 'player', selectedProvinceId); render(); }
  });
  el.btnFactory.addEventListener('click', function () {
    if (selectedProvinceId) { Sim.buildFactory(state, 'player', selectedProvinceId); render(); }
  });

  newGame();
})();
