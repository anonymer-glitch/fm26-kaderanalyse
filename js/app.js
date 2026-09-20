document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.getElementById('csv-file');
  var statusEl = document.getElementById('import-status');
  var dataSection = document.getElementById('data-section');
  var rowCountEl = document.getElementById('row-count');
  var filtersEl = document.getElementById('filters');
  var tableWrapper = document.getElementById('table-wrapper');

  var COLUMNS = [
    { key: 'name', label: 'Spieler', get: function (p) { return p.name; } },
    { key: 'position', label: 'Position', get: function (p) { return p.position; } },
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
    { key: 'statusExpected', label: 'Einsatzzeiten', get: function (p) { return p.statusExpected; } }
  ];

  var defaultFilters = function () {
    return {
      positions: [], ageMin: null, ageMax: null, contractBefore: null,
      status: '', attrColumns: [], attrMin: null
    };
  };

  var state = {
    players: [],
    numericColumns: [],
    positionCodes: [],
    statusOptions: [],
    filters: defaultFilters(),
    sortKey: 'name',
    sortDir: 'asc'
  };

  fileInput.addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;

    statusEl.textContent = 'Lese Datei...';
    dataSection.hidden = true;

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
      dataSection.hidden = true;
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

    state.players = buildPlayers(result.records);
    state.numericColumns = detectNumericColumns(result.headers, result.records);
    state.positionCodes = sortByPositionOrder(collectPositionCodes(state.players));
    state.statusOptions = sortByPlayingTime(uniqueValues(result.records, 'Tatsächliche Einsatzzeiten'));
    state.filters = defaultFilters();
    state.sortKey = 'name';
    state.sortDir = 'asc';

    renderFilters();
    renderTable();
    dataSection.hidden = false;
  }

  function renderFilters() {
    filtersEl.innerHTML = '';

    filtersEl.appendChild(makeCheckboxGroupField('Position', state.positionCodes, state.filters.positions, function (selected) {
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
