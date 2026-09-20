document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.getElementById('csv-file');
  var statusEl = document.getElementById('import-status');
  var referenceDateInput = document.getElementById('reference-date');

  var navEl = document.getElementById('view-nav');
  var dashboardViewEl = document.getElementById('dashboard-view');
  var kaderViewEl = document.getElementById('kader-view');

  var neededPositionsEl = document.getElementById('needed-positions');
  var positionGapsEl = document.getElementById('position-gaps');
  var hintsSummaryEl = document.getElementById('hints-summary');
  var qualitySettingsBodyEl = document.getElementById('quality-settings-body');
  var qualityTableWrapperEl = document.getElementById('quality-table-wrapper');

  var rowCountEl = document.getElementById('row-count');
  var filtersEl = document.getElementById('filters');
  var tableWrapper = document.getElementById('table-wrapper');

  var COLUMNS = [
    { key: 'name', label: 'Spieler', get: function (p) { return p.name; } },
    {
      key: 'position', label: 'Position',
      get: function (p) { return positionSortRank(p); },
      display: function (p) { return p.position; }
    },
    { key: 'age', label: 'Alter', get: function (p) { return p.age; } },
    {
      key: 'contractEnd', label: 'Vertragsende',
      get: function (p) { return p.contractEnd; },
      display: function (p) { return p.contractEndRaw; }
    },
    {
      key: 'salary', label: 'Gehalt',
      get: function (p) { return p.salary; },
      display: function (p) { return p.salaryRaw; }
    },
    { key: 'statusActual', label: 'Tatsächliche Einsatzzeiten', get: function (p) { return p.statusActual; } },
    { key: 'statusExpected', label: 'Einsatzzeiten', get: function (p) { return p.statusExpected; } },
    {
      key: 'hints', label: 'Hinweise',
      get: function (p) { return p.hints && p.hints.length ? p.hints.join(', ') : ''; }
    }
  ];

  var QUALITY_COLUMNS = [
    { key: 'code', label: 'Position', get: function (r) { return r.code; }, compare: comparePositionSlots },
    { key: 'playerCount', label: 'Spieler', get: function (r) { return r.playerCount; } },
    { key: 'attributeCount', label: 'Attribute', get: function (r) { return r.attributeCount; } },
    { key: 'average', label: 'Ø Qualität', get: function (r) { return r.average; } }
  ];

  var HINT_CATEGORIES = [
    { label: 'Vertrag prüfen', key: 'Vertrag prüfen' },
    { label: 'Verkaufskandidaten', key: 'Verkaufskandidat' },
    { label: 'Verleihkandidaten', key: 'Verleihkandidat' }
  ];

  var defaultFilters = function () {
    return {
      positions: [], ageMin: null, ageMax: null, contractBefore: null,
      status: '', attrColumns: [], attrMin: null
    };
  };

  var state = {
    players: [],
    headers: [],
    numericColumns: [],
    positionSlots: [],
    neededPositions: [],
    statusOptions: [],
    qualityAttributes: {},
    referenceDate: null,
    filters: defaultFilters(),
    sortKey: 'name',
    sortDir: 'asc',
    qualitySortKey: 'average',
    qualitySortDir: 'desc',
    activeView: 'dashboard'
  };

  function openProfile(player) {
    var payload = JSON.stringify({ headers: state.headers, record: player.raw });
    window.open('profile.html#' + encodeURIComponent(payload), '_blank');
  }

  function switchView(view) {
    state.activeView = view;
    dashboardViewEl.hidden = view !== 'dashboard';
    kaderViewEl.hidden = view !== 'kader';
    Array.from(navEl.querySelectorAll('.view-nav-btn')).forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  }

  Array.from(navEl.querySelectorAll('.view-nav-btn')).forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.dataset.view); });
  });

  referenceDateInput.addEventListener('change', function () {
    state.referenceDate = parseGermanDate(referenceDateInput.value);
    if (state.players.length > 0) {
      applyHints(state.players, state.referenceDate);
      renderHintsSummary();
      renderTable();
    }
  });

  fileInput.addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;

    statusEl.textContent = 'Lese Datei...';
    navEl.hidden = true;
    dashboardViewEl.hidden = true;
    kaderViewEl.hidden = true;

    var reader = new FileReader();
    reader.onload = function (e) {
      var result = parseCSV(e.target.result);
      handleImport(result, file.name);
    };
    reader.onerror = function () {
      statusEl.textContent = 'Fehler beim Lesen der Datei.';
    };
    reader.readAsText(file, 'UTF-8');
  });

  function handleImport(result, fileName) {
    if (result.records.length === 0) {
      statusEl.textContent = 'Keine Datensätze in "' + fileName + '" gefunden.';
      return;
    }

    var hasIdColumn = result.headers.indexOf('Unique ID') !== -1;
    var statusLines = [];
    statusLines.push(
      '"' + fileName + '" importiert: ' + result.records.length + ' Spieler, ' +
      result.headers.length + ' Spalten.'
    );
    if (!hasIdColumn) {
      statusLines.push('Achtung: Keine Spalte "Unique ID" gefunden.');
    }
    if (result.warnings.length > 0) {
      statusLines.push(result.warnings.length + ' Warnung(en) beim Einlesen (siehe unten).');
    }

    statusEl.innerHTML = '';
    statusLines.forEach(function (line) {
      var div = document.createElement('div');
      div.textContent = line;
      statusEl.appendChild(div);
    });
    if (result.warnings.length > 0) {
      var warnList = document.createElement('ul');
      warnList.className = 'warnings';
      result.warnings.forEach(function (w) {
        var li = document.createElement('li');
        li.textContent = w;
        warnList.appendChild(li);
      });
      statusEl.appendChild(warnList);
    }

    state.headers = result.headers;
    state.players = buildPlayers(result.records);
    state.numericColumns = detectNumericColumns(result.headers, result.records);
    state.positionSlots = sortBySlotOrder(collectPositionSlots(state.players));
    state.neededPositions = state.positionSlots.slice();
    state.statusOptions = sortByPlayingTime(uniqueValues(result.records, 'Tatsächliche Einsatzzeiten'));
    state.filters = defaultFilters();
    state.sortKey = 'name';
    state.sortDir = 'asc';

    state.qualityAttributes = {};
    collectRootPositionCodes(state.players).forEach(function (code) {
      state.qualityAttributes[code] = defaultQualityAttributes(code, state.numericColumns);
    });

    applyHints(state.players, state.referenceDate);

    renderNeededPositions();
    renderPositionGaps();
    renderHintsSummary();
    renderQualitySettings();
    renderQualityTable();
    renderFilters();
    renderTable();

    navEl.hidden = false;
    switchView('dashboard');
  }

  function renderNeededPositions() {
    neededPositionsEl.innerHTML = '';
    neededPositionsEl.appendChild(makeCheckboxGroupField(
      'Benötigte Positionen (für Lücken-Analyse, z.B. bei 3er-Kette keine Außenverteidiger nötig)',
      state.positionSlots,
      state.neededPositions,
      function (selected) {
        state.neededPositions = selected;
        renderPositionGaps();
        renderHintsSummary();
      }
    ));
  }

  function renderPositionGaps() {
    positionGapsEl.innerHTML = '';
    var gaps = computePositionGaps(state.players, state.neededPositions);
    gaps.forEach(function (gap) {
      var chip = document.createElement('span');
      chip.className = 'position-gap-chip' + (gap.severity !== 'ok' ? ' ' + gap.severity : '');
      chip.textContent = gap.code + ': ' + gap.count;
      positionGapsEl.appendChild(chip);
    });
  }

  function renderHintsSummary() {
    hintsSummaryEl.innerHTML = '';
    HINT_CATEGORIES.forEach(function (cat) {
      var matches = state.players.filter(function (p) {
        return p.hints && p.hints.indexOf(cat.key) !== -1;
      });

      var box = document.createElement('div');
      box.className = 'hint-summary-box';

      var title = document.createElement('div');
      title.className = 'hint-summary-title';
      title.textContent = cat.label + ' (' + matches.length + ')';
      box.appendChild(title);

      if (matches.length > 0) {
        var list = document.createElement('ul');
        matches.forEach(function (p) {
          var li = document.createElement('li');
          var link = document.createElement('a');
          link.href = '#';
          link.textContent = p.name;
          link.addEventListener('click', function (event) {
            event.preventDefault();
            openProfile(p);
          });
          li.appendChild(link);
          list.appendChild(li);
        });
        box.appendChild(list);
      }

      hintsSummaryEl.appendChild(box);
    });

    var cluster = computeContractCluster(state.players, state.referenceDate);
    var clusterBox = document.createElement('div');
    clusterBox.className = 'hint-summary-box';

    var clusterTitle = document.createElement('div');
    clusterTitle.className = 'hint-summary-title';
    if (cluster) {
      clusterTitle.textContent = 'Vertragsballung Saison ' + (cluster.seasonEndYear - 1) + '/' + cluster.seasonEndYear +
        ' (' + cluster.players.length + ')';
    } else {
      clusterTitle.textContent = 'Vertragsballung (kein Spieldatum gesetzt)';
    }
    clusterBox.appendChild(clusterTitle);

    if (cluster && cluster.players.length > 0) {
      var clusterList = document.createElement('ul');
      cluster.players.forEach(function (p) {
        var li = document.createElement('li');
        var link = document.createElement('a');
        link.href = '#';
        link.textContent = p.name;
        link.addEventListener('click', function (event) {
          event.preventDefault();
          openProfile(p);
        });
        li.appendChild(link);
        clusterList.appendChild(li);
      });
      clusterBox.appendChild(clusterList);
    }
    hintsSummaryEl.appendChild(clusterBox);

    var gapResults = computePositionGaps(state.players, state.neededPositions);
    var qualityResults = computePositionQuality(state.players, state.qualityAttributes);
    var actionItems = computePositionActionItems(gapResults, qualityResults);

    var posBox = document.createElement('div');
    posBox.className = 'hint-summary-box';

    var posTitle = document.createElement('div');
    posTitle.className = 'hint-summary-title';
    posTitle.textContent = 'Position: Handlungsbedarf (' + actionItems.length + ')';
    posBox.appendChild(posTitle);

    if (actionItems.length > 0) {
      var posList = document.createElement('ul');
      actionItems.forEach(function (item) {
        var li = document.createElement('li');
        if (item.playerCount > 0) {
          var link = document.createElement('a');
          link.href = '#';
          link.textContent = item.slot;
          link.addEventListener('click', function (event) {
            event.preventDefault();
            openPositionDetail(item.slot);
          });
          li.appendChild(link);
        } else {
          li.appendChild(document.createTextNode(item.slot));
        }
        li.appendChild(document.createTextNode(' – ' + item.reasons.join(', ')));
        posList.appendChild(li);
      });
      posBox.appendChild(posList);
    }

    hintsSummaryEl.appendChild(posBox);
  }

  function renderQualitySettings() {
    qualitySettingsBodyEl.innerHTML = '';
    collectRootPositionCodes(state.players).forEach(function (code) {
      qualitySettingsBodyEl.appendChild(makeCheckboxGroupField(
        code,
        state.numericColumns,
        state.qualityAttributes[code] || [],
        function (selected) {
          state.qualityAttributes[code] = selected;
          renderQualityTable();
          renderHintsSummary();
        }
      ));
    });
  }

  function renderQualityTable() {
    qualityTableWrapperEl.innerHTML = '';
    var results = computePositionQuality(state.players, state.qualityAttributes);

    var col = QUALITY_COLUMNS.filter(function (c) { return c.key === state.qualitySortKey; })[0];
    var sorted = results.slice().sort(function (a, b) {
      if (col.compare) return col.compare(col.get(a), col.get(b));
      var av = col.get(a);
      var bv = col.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    if (state.qualitySortDir === 'desc') sorted.reverse();

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    QUALITY_COLUMNS.forEach(function (c) {
      var th = document.createElement('th');
      th.className = 'sortable';
      var arrow = state.qualitySortKey === c.key ? (state.qualitySortDir === 'asc' ? ' ▲' : ' ▼') : '';
      th.textContent = c.label + arrow;
      th.addEventListener('click', function () {
        if (state.qualitySortKey === c.key) {
          state.qualitySortDir = state.qualitySortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.qualitySortKey = c.key;
          state.qualitySortDir = 'asc';
        }
        renderQualityTable();
      });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    sorted.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'clickable-row';
      tr.addEventListener('click', function () { openPositionDetail(r.code); });
      [r.code, r.playerCount, r.attributeCount, r.average != null ? r.average.toFixed(1) : '–'].forEach(function (val) {
        var td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    qualityTableWrapperEl.appendChild(table);
  }

  function openPositionDetail(slot) {
    var rootCode = parsePositionSlot(slot).code;
    var relevantPlayers = state.players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    });
    var payload = JSON.stringify({
      code: slot,
      qualityAttributes: state.qualityAttributes[rootCode] || [],
      records: relevantPlayers.map(function (p) { return p.raw; })
    });
    window.open('position.html#' + encodeURIComponent(payload), '_blank');
  }

  function renderFilters() {
    filtersEl.innerHTML = '';

    filtersEl.appendChild(makeCheckboxGroupField('Position', state.positionSlots, state.filters.positions, function (selected) {
      state.filters.positions = selected;
      renderTable();
    }));

    filtersEl.appendChild(makeNumberField('Alter min', state.filters.ageMin, function (v) {
      state.filters.ageMin = v;
      renderTable();
    }));
    filtersEl.appendChild(makeNumberField('Alter max', state.filters.ageMax, function (v) {
      state.filters.ageMax = v;
      renderTable();
    }));

    filtersEl.appendChild(makeDateField('Vertrag endet bis', function (v) {
      state.filters.contractBefore = v;
      renderTable();
    }));

    filtersEl.appendChild(makeSelectField('Einsatzstatus', ['Alle'].concat(state.statusOptions), function (v) {
      state.filters.status = v === 'Alle' ? '' : v;
      renderTable();
    }));

    filtersEl.appendChild(makeCheckboxGroupField('Attribute', state.numericColumns, state.filters.attrColumns, function (selected) {
      state.filters.attrColumns = selected;
      renderTable();
    }));
    filtersEl.appendChild(makeNumberField('Mindestwert', state.filters.attrMin, function (v) {
      state.filters.attrMin = v;
      renderTable();
    }));

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Filter zurücksetzen';
    resetBtn.addEventListener('click', function () {
      state.filters = defaultFilters();
      renderFilters();
      renderTable();
    });
    filtersEl.appendChild(resetBtn);
  }

  function makeCheckboxGroupField(label, options, selected, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'filter-field';
    var lbl = document.createElement('label');
    lbl.textContent = label;
    var group = document.createElement('div');
    group.className = 'checkbox-group';

    function currentSelection() {
      return Array.from(group.querySelectorAll('input[type=checkbox]'))
        .filter(function (b) { return b.checked; })
        .map(function (b) { return b.dataset.value; });
    }

    options.forEach(function (opt) {
      var chip = document.createElement('label');
      chip.className = 'checkbox-chip';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.value = opt;
      box.checked = selected.indexOf(opt) !== -1;
      box.addEventListener('change', function () {
        onChange(currentSelection());
      });
      chip.appendChild(box);
      chip.appendChild(document.createTextNode(opt));
      group.appendChild(chip);
    });
    wrap.appendChild(lbl);
    wrap.appendChild(group);
    return wrap;
  }

  function makeNumberField(label, value, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'filter-field';
    var lbl = document.createElement('label');
    lbl.textContent = label;
    var input = document.createElement('input');
    input.type = 'number';
    if (value != null) input.value = value;
    input.addEventListener('input', function () {
      onChange(input.value === '' ? null : Number(input.value));
    });
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function makeDateField(label, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'filter-field';
    var lbl = document.createElement('label');
    lbl.textContent = label;
    var input = document.createElement('input');
    input.type = 'date';
    input.addEventListener('input', function () {
      onChange(input.value ? new Date(input.value) : null);
    });
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function makeSelectField(label, options, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'filter-field';
    var lbl = document.createElement('label');
    lbl.textContent = label;
    var select = document.createElement('select');
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    select.addEventListener('change', function () { onChange(select.value); });
    wrap.appendChild(lbl);
    wrap.appendChild(select);
    return wrap;
  }

  function renderTable() {
    var columns = COLUMNS.slice();
    state.filters.attrColumns.forEach(function (attrName) {
      columns.push({
        key: 'attr:' + attrName,
        label: attrName,
        get: function (p) {
          var val = parseInt(p.raw[attrName], 10);
          return isNaN(val) ? null : val;
        }
      });
    });

    var filtered = filterPlayers(state.players, state.filters);
    var sorted = sortPlayers(filtered, state.sortKey, state.sortDir, columns);

    rowCountEl.textContent = filtered.length + ' / ' + state.players.length;

    tableWrapper.innerHTML = '';
    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    columns.forEach(function (col) {
      var th = document.createElement('th');
      th.className = 'sortable';
      var arrow = state.sortKey === col.key ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      th.textContent = col.label + arrow;
      th.addEventListener('click', function () {
        if (state.sortKey === col.key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = col.key;
          state.sortDir = 'asc';
        }
        renderTable();
      });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    sorted.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.className = 'clickable-row';
      tr.addEventListener('click', function () { openProfile(p); });
      columns.forEach(function (col) {
        var td = document.createElement('td');
        var text = col.display ? col.display(p) : col.get(p);
        td.textContent = text == null ? '' : text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableWrapper.appendChild(table);
  }
});
