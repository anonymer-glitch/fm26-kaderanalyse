document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.getElementById('csv-file');
  var statusEl = document.getElementById('import-status');
  var referenceDateInput = document.getElementById('reference-date');
  var backupExportBtn = document.getElementById('backup-export-btn');
  var backupImportBtn = document.getElementById('backup-import-btn');
  var backupImportInput = document.getElementById('backup-import-input');
  var resetKaderBtn = document.getElementById('reset-kader-btn');

  var navEl = document.getElementById('view-nav');
  var dashboardViewEl = document.getElementById('dashboard-view');
  var kaderViewEl = document.getElementById('kader-view');
  var dashboardTabNavEl = document.getElementById('dashboard-tab-nav');

  var importComparisonEl = document.getElementById('import-comparison');
  var tacticsPresetsEl = document.getElementById('tactics-presets');
  var tacticsBoardEl = document.getElementById('tactics-board');
  var positionGapsEl = document.getElementById('position-gaps');
  var hintsSummaryEl = document.getElementById('hints-summary');
  var qualitySettingsBodyEl = document.getElementById('quality-settings-body');
  var qualityTableWrapperEl = document.getElementById('quality-table-wrapper');
  var standardsSettingsBodyEl = document.getElementById('standards-settings-body');
  var standardsResultsEl = document.getElementById('standards-results');
  var performanceSettingsBodyEl = document.getElementById('performance-settings-body');
  var performanceTableWrapperEl = document.getElementById('performance-table-wrapper');

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
    {
      key: 'marketValue', label: 'Marktwert',
      get: function (p) { return p.marketValue; },
      display: function (p) { return p.marketValueRaw; }
    },
    { key: 'statusActual', label: 'Tatsächliche Einsatzzeiten', get: function (p) { return p.statusActual; } },
    { key: 'statusExpected', label: 'Einsatzzeiten', get: function (p) { return p.statusExpected; } },
    {
      key: 'note', label: 'Notiz',
      get: function (p) { return p.id != null ? (state.notes[p.id] || '') : ''; }
    },
    {
      key: 'hints', label: 'Hinweise',
      get: function (p) { return p.hints && p.hints.length ? p.hints.join(', ') : ''; }
    }
  ];

  var QUALITY_COLUMNS = [
    { key: 'code', label: 'Position', get: function (r) { return r.code; }, compare: comparePositionSlots },
    { key: 'playerCount', label: 'Spieler', get: function (r) { return r.playerCount; } },
    { key: 'attributeCount', label: 'Attribute', get: function (r) { return r.attributeCount; } },
    {
      key: 'average', label: 'Ø Qualität',
      get: function (r) { return r.average; },
      format: function (r) { return r.average != null ? r.average.toFixed(1) : '–'; }
    }
  ];

  // Basisspalten für "Leistung je Position" - je gewählter Kennzahl kommt eine
  // eigene Spalte dazu (siehe renderPerformanceTable). Keine Blend-Spalte: die
  // Kennzahlen haben unterschiedliche Skalen (Note, Prozent, Pro-90-Rate) und
  // lassen sich nicht sinnvoll zu einem Wert mitteln.
  var PERFORMANCE_BASE_COLUMNS = [
    { key: 'code', label: 'Position', get: function (r) { return r.code; }, compare: comparePositionSlots },
    { key: 'playerCount', label: 'Spieler', get: function (r) { return r.playerCount; } }
  ];

  var HINT_CATEGORIES = [
    { label: 'Vertrag prüfen', key: 'Vertrag prüfen' },
    { label: 'Verkaufskandidaten', key: 'Verkaufskandidat' },
    { label: 'Verleihkandidaten', key: 'Verleihkandidat' },
    { label: 'Status-Diskrepanz', key: 'Status-Diskrepanz' }
  ];

  var defaultFilters = function () {
    return {
      positions: [], ageMin: null, ageMax: null, contractBefore: null,
      status: '', attrColumns: [], attrMin: null
    };
  };

  var state = {
    players: [],
    notes: loadNotesMap(),
    previousPlayers: [],
    previousImportedAt: null,
    previousImportSortKey: 'name',
    previousImportSortDir: 'asc',
    headers: [],
    numericColumns: [],
    positionSlots: [],
    neededPositionCounts: [],
    tacticMarkers: [],
    activeFormation: null,
    statusOptions: [],
    qualityAttributes: {},
    standardsAttributes: {},
    performanceAttributes: {},
    referenceDate: null,
    filters: defaultFilters(),
    sortKey: 'name',
    sortDir: 'asc',
    qualitySortKey: 'average',
    qualitySortDir: 'desc',
    performanceSortKey: 'average',
    performanceSortDir: 'desc',
    activeView: 'dashboard',
    activeDashboardTab: 'taktik'
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

  // Dashboard-Unterreiter: Taktik & Kadertiefe / Qualität / Leistung /
  // Standardsituationen. Trennt "was muss ich gerade wissen" (Vergleich +
  // Hinweise, immer sichtbar) von "damit will ich mich gezielt beschäftigen"
  // (die vier Reiter). Reine Sichtbarkeits-Umschaltung - die Render-Funktionen
  // jeder Sektion bleiben unverändert und laufen unabhängig davon weiter.
  function switchDashboardTab(tab) {
    state.activeDashboardTab = tab;
    Array.from(document.querySelectorAll('.dashboard-tab')).forEach(function (section) {
      section.hidden = section.id !== 'dashboard-tab-' + tab;
    });
    Array.from(dashboardTabNavEl.querySelectorAll('.dashboard-tab-btn')).forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }

  Array.from(dashboardTabNavEl.querySelectorAll('.dashboard-tab-btn')).forEach(function (btn) {
    btn.addEventListener('click', function () { switchDashboardTab(btn.dataset.tab); });
  });
  switchDashboardTab('taktik');

  Array.from(navEl.querySelectorAll('.view-nav-btn')).forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.dataset.view); });
  });

  // Notizen werden im separaten Spielerprofil-Tab bearbeitet (siehe profile.js) -
  // dieses "storage"-Event feuert nur in ANDEREN Tabs, wenn sich localStorage
  // ändert, und hält so die Notiz-Spalte hier aktuell, ohne dass man neu laden muss.
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_PREFIX + 'notes') {
      state.notes = loadNotesMap();
      if (state.players.length > 0) renderTable();
    }
  });

  referenceDateInput.addEventListener('change', function () {
    state.referenceDate = parseGermanDate(referenceDateInput.value);
    saveReferenceDateToStorage(referenceDateInput.value);
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
      var oldCurrent = rotateAndSaveCsvToStorage(file.name, e.target.result);
      loadCurrentIntoApp(file.name, e.target.result, oldCurrent);
    };
    reader.onerror = function () {
      statusEl.textContent = 'Fehler beim Lesen der Datei.';
    };
    reader.readAsText(file, 'UTF-8');
  });

  // Baut ggf. den vorherigen Import auf (für Vergleich + Durchschnittsnote-
  // Fallback) und importiert dann den aktuellen. previousInfo ist { fileName,
  // csvText } oder null - kommt entweder vom Rotieren beim Upload, aus dem
  // Speicher beim Öffnen, oder aus einer Sicherungsdatei.
  function loadCurrentIntoApp(fileName, csvText, previousInfo) {
    var previousPlayers = [];
    var previousRatingById = null;
    if (previousInfo && previousInfo.csvText) {
      var previousResult = parseCSV(previousInfo.csvText);
      fixMinutesPerGameColumn(previousResult.records);
      previousPlayers = buildPlayers(previousResult.records);
      previousRatingById = {};
      previousPlayers.forEach(function (p) {
        if (p.id != null && p.rating != null) previousRatingById[p.id] = p.rating;
      });
    }
    handleImport(parseCSV(csvText), fileName, previousRatingById);
    state.previousPlayers = previousPlayers;
    state.previousImportedAt = previousInfo ? previousInfo.importedAt : null;
    renderImportComparison();
  }

  backupExportBtn.addEventListener('click', function () {
    if (state.players.length === 0) {
      alert('Erst einen Kader importieren, dann gibt es etwas zu sichern.');
      return;
    }
    var blob = new Blob([buildBackupPayload()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fm26-kaderanalyse-sicherung.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  backupImportBtn.addEventListener('click', function () {
    backupImportInput.click();
  });

  backupImportInput.addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var data;
      try {
        data = parseBackupPayload(e.target.result);
      } catch (err) {
        alert('Sicherungsdatei konnte nicht gelesen werden: ' + err.message);
        return;
      }
      if (data.csvText) {
        var fileName = data.csvFileName || 'kader.csv';
        var previousInfo = data.previousCsvText
          ? { fileName: data.previousCsvFileName, csvText: data.previousCsvText, importedAt: data.previousCsvImportedAt }
          : null;
        restoreCsvSlotsFromBackup({ fileName: fileName, csvText: data.csvText, importedAt: data.csvImportedAt }, previousInfo);
        loadCurrentIntoApp(fileName, data.csvText, previousInfo);
      }
      if (data.notes) {
        storageSet('notes', JSON.stringify(data.notes));
        state.notes = data.notes;
        if (state.players.length > 0) renderTable();
      }
      applyLoadedTacticAndDate(data.tacticMarkers, data.referenceDate);
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  });

  resetKaderBtn.addEventListener('click', function () {
    if (!confirm('Gespeicherten Kader wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return;
    clearStoredKader();
    location.reload();
  });

  // Wendet einen geladenen Taktik-Stand + Spieldatum an (aus dem Browser-Speicher
  // beim Start, oder aus einer importierten Sicherungsdatei) - überschreibt die
  // Standard-4-4-2-Formation, die handleImport sonst setzt.
  function applyLoadedTacticAndDate(tacticMarkers, referenceDateValue) {
    if (tacticMarkers && tacticMarkers.length) {
      advanceTacticsMarkerIdCounterPast(tacticMarkers);
      state.tacticMarkers = tacticMarkers;
      state.activeFormation = null;
      renderTacticsPresets();
      updateTactics();
    }
    if (referenceDateValue) {
      referenceDateInput.value = referenceDateValue;
      state.referenceDate = parseGermanDate(referenceDateValue);
      applyHints(state.players, state.referenceDate);
      renderHintsSummary();
      renderTable();
    }
  }

  // Für die "Letzten Import ansehen"-Tabelle: dieselben Spalten wie die
  // Kaderübersicht, nur ohne "Hinweise" (die werden für den alten Import nicht
  // berechnet - kein Spieldatum-Kontext von damals gespeichert).
  var PREVIOUS_IMPORT_COLUMNS = COLUMNS.filter(function (c) { return c.key !== 'hints'; });

  // Formatiert den ISO-Zeitstempel eines gespeicherten Imports für die Anzeige
  // (z.B. "03.01.2026, 14:32 Uhr") - null bei fehlendem/ungültigem Zeitstempel
  // (z.B. Speicherstände von vor dieser Funktion).
  function formatImportTimestamp(isoString) {
    if (!isoString) return null;
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() +
      ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' Uhr';
  }

  function renderImportComparison() {
    importComparisonEl.innerHTML = '';
    if (state.previousPlayers.length === 0) {
      var note = document.createElement('p');
      note.className = 'standards-note';
      note.textContent = 'Noch kein vorheriger Import zum Vergleichen vorhanden - erscheint automatisch ab dem nächsten Import.';
      importComparisonEl.appendChild(note);
      return;
    }

    var previousDate = formatImportTimestamp(state.previousImportedAt);
    var dateNote = document.createElement('p');
    dateNote.className = 'standards-note';
    dateNote.textContent = previousDate
      ? 'Vergleich mit dem Import vom ' + previousDate + '.'
      : 'Vergleich mit dem vorherigen Import (Zeitpunkt unbekannt).';
    importComparisonEl.appendChild(dateNote);

    var comparison = computeImportComparison(state.players, state.previousPlayers);

    function makeBox(title, items, renderItem) {
      var box = document.createElement('div');
      box.className = 'hint-summary-box';
      var boxTitle = document.createElement('div');
      boxTitle.className = 'hint-summary-title';
      boxTitle.textContent = title + ' (' + items.length + ')';
      box.appendChild(boxTitle);
      if (items.length > 0) {
        var list = document.createElement('ul');
        items.forEach(function (item) {
          var li = document.createElement('li');
          renderItem(li, item);
          list.appendChild(li);
        });
        box.appendChild(list);
      }
      return box;
    }

    function playerLink(li, player) {
      var link = document.createElement('a');
      link.href = '#';
      link.textContent = player.name;
      link.addEventListener('click', function (event) {
        event.preventDefault();
        openProfile(player);
      });
      li.appendChild(link);
    }

    var summaryRow = document.createElement('div');
    summaryRow.className = 'hints-summary';
    summaryRow.appendChild(makeBox('Neuzugänge', comparison.newArrivals, function (li, p) { playerLink(li, p); }));
    summaryRow.appendChild(makeBox('Abgänge', comparison.departures, function (li, p) { playerLink(li, p); }));
    summaryRow.appendChild(makeBox('Status-Änderungen', comparison.statusChanges, function (li, c) {
      playerLink(li, c.player);
      li.appendChild(document.createTextNode(': ' + c.from + ' → ' + c.to));
    }));
    summaryRow.appendChild(makeBox('Vertragsänderungen', comparison.contractChanges, function (li, c) {
      playerLink(li, c.player);
      li.appendChild(document.createTextNode(': ' + c.from + ' → ' + c.to));
    }));
    importComparisonEl.appendChild(summaryRow);

    var details = document.createElement('details');
    details.className = 'quality-settings';
    var summary = document.createElement('summary');
    summary.textContent = 'Letzten Import ansehen (' + state.previousPlayers.length + ' Spieler' +
      (previousDate ? ', vom ' + previousDate : '') + ')';
    details.appendChild(summary);
    var tableHolder = document.createElement('div');
    tableHolder.id = 'previous-import-table-wrapper';
    details.appendChild(tableHolder);
    importComparisonEl.appendChild(details);

    renderPreviousImportTable(tableHolder);
  }

  function renderPreviousImportTable(wrapper) {
    var sorted = sortPlayers(state.previousPlayers, state.previousImportSortKey, state.previousImportSortDir, PREVIOUS_IMPORT_COLUMNS);

    wrapper.innerHTML = '';
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    PREVIOUS_IMPORT_COLUMNS.forEach(function (col) {
      var th = document.createElement('th');
      th.className = 'sortable';
      var arrow = state.previousImportSortKey === col.key ? (state.previousImportSortDir === 'asc' ? ' ▲' : ' ▼') : '';
      th.textContent = col.label + arrow;
      th.addEventListener('click', function () {
        if (state.previousImportSortKey === col.key) {
          state.previousImportSortDir = state.previousImportSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.previousImportSortKey = col.key;
          state.previousImportSortDir = 'asc';
        }
        renderPreviousImportTable(wrapper);
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
      PREVIOUS_IMPORT_COLUMNS.forEach(function (col) {
        var td = document.createElement('td');
        var text = col.display ? col.display(p) : col.get(p);
        td.textContent = text == null ? '' : text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
  }

  function handleImport(result, fileName, previousRatingById) {
    if (result.records.length === 0) {
      statusEl.textContent = 'Keine Datensätze in "' + fileName + '" gefunden.';
      return;
    }

    fixMinutesPerGameColumn(result.records);
    applyPreviousSeasonRatingFallback(result.records, previousRatingById);

    // Notizen frisch aus dem Speicher laden statt der beim App-Start geladenen
    // Kopie zu vertrauen - der "storage"-Event für Cross-Tab-Sync feuert nur in
    // ANDEREN Tabs, nie im eigenen, ein Import hier muss trotzdem den aktuellen
    // Stand sehen (z.B. nach einer Notiz im selben Tab kurz zuvor).
    state.notes = loadNotesMap();

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
    // Taktik-Board ist Sache des Nutzers, nicht der CSV - bei einem erneuten
    // Import (z.B. neue Saison) bleibt die bestehende Formation deshalb
    // erhalten. Nur beim allerersten Import einer Session (noch keine Marker
    // gesetzt) wird der Standard 4-4-2 vorbelegt.
    if (state.tacticMarkers.length === 0) {
      state.activeFormation = '4-4-2';
      state.tacticMarkers = formationMarkers(state.activeFormation);
    }
    state.neededPositionCounts = neededPositionCountsFromMarkers(state.tacticMarkers);
    state.statusOptions = sortByPlayingTime(uniqueValues(result.records, 'Tatsächliche Einsatzzeiten'));
    state.filters = defaultFilters();
    state.sortKey = 'name';
    state.sortDir = 'asc';

    state.qualityAttributes = {};
    collectRootPositionCodes(state.players).forEach(function (code) {
      state.qualityAttributes[code] = defaultQualityAttributes(code, state.numericColumns);
    });

    state.standardsAttributes = {};
    STANDARDS_CATEGORIES.forEach(function (cat) {
      state.standardsAttributes[cat.key] = defaultStandardsAttributes(cat.key, state.numericColumns);
    });

    // Keine Vorauswahl mehr - die Durchschnittsnote (fixe Spalte) reicht als
    // Standard, alles Weitere wählt man bei Bedarf selbst dazu.
    state.performanceAttributes = {};

    applyHints(state.players, state.referenceDate);

    renderTacticsPresets();
    renderTacticsBoard();
    renderPositionGaps();
    renderHintsSummary();
    renderQualitySettings();
    renderQualityTable();
    renderPerformanceSettings();
    renderPerformanceTable();
    renderStandardsSettings();
    renderStandardsResults();
    renderFilters();
    renderTable();

    navEl.hidden = false;
    switchView('dashboard');
  }

  // Nach jeder Änderung am Taktik-Board (Preset, hinzugefügter/entfernter Marker,
  // Drag & Drop) neu berechnen und alles betroffene neu rendern - die Positions-
  // lücken und der "Handlungsbedarf"-Hinweis hängen direkt an state.neededPositionCounts.
  function updateTactics() {
    state.neededPositionCounts = neededPositionCountsFromMarkers(state.tacticMarkers);
    saveTacticMarkersToStorage(state.tacticMarkers);
    renderTacticsBoard();
    renderPositionGaps();
    renderHintsSummary();
  }

  function applyFormation(name) {
    state.activeFormation = name;
    state.tacticMarkers = formationMarkers(name);
    updateTactics();
  }

  function addTacticsMarker(code) {
    state.activeFormation = null;
    state.tacticMarkers.push({ id: nextTacticsMarkerId(), code: code, x: 50, y: 50 });
    renderTacticsPresets();
    updateTactics();
  }

  function removeTacticsMarker(id) {
    state.activeFormation = null;
    state.tacticMarkers = state.tacticMarkers.filter(function (m) { return m.id !== id; });
    renderTacticsPresets();
    updateTactics();
  }

  function renderTacticsPresets() {
    tacticsPresetsEl.innerHTML = '';
    FORMATION_ORDER.forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tactics-preset-btn' + (state.activeFormation === name ? ' active' : '');
      btn.textContent = name;
      btn.addEventListener('click', function () { applyFormation(name); });
      tacticsPresetsEl.appendChild(btn);
    });

    var addWrap = document.createElement('span');
    addWrap.className = 'tactics-add';
    var select = document.createElement('select');
    collectRootPositionCodes(state.players).forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      select.appendChild(opt);
    });
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Position hinzufügen';
    addBtn.addEventListener('click', function () { addTacticsMarker(select.value); });
    addWrap.appendChild(select);
    addWrap.appendChild(addBtn);
    tacticsPresetsEl.appendChild(addWrap);
  }

  // Verschiebt einen Marker per Pointer-Capture: einfacher als Document-weite
  // Listener, da das Event auch dann am Marker ankommt, wenn der Zeiger kurz
  // das Feld verlässt (z.B. schnelle Bewegung an den Rand).
  function makeMarkerDraggable(el, marker) {
    el.addEventListener('pointerdown', function (event) {
      if (event.target.classList.contains('tactic-marker-remove')) return; // nicht beim Klick auf den Entfernen-Button
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      var rect = tacticsBoardEl.getBoundingClientRect();

      function onMove(moveEvent) {
        var x = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
        var y = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100));
        marker.x = x;
        marker.y = y;
        // Zeile (y) bestimmt den Positions-Typ (z.B. ST -> M, wenn man ihn ins
        // Mittelfeld zieht); in der DM-Zeile verfeinert die Spalte (x) das noch
        // weiter zu FV außen. Danach bestimmt die Spalte zusätzlich die Seite
        // (siehe markerToSlot).
        marker.code = tacticsCodeForPosition(x, y);
        el.style.left = x + '%';
        el.style.top = y + '%';
        // Live-Update, damit sofort sichtbar ist, wie sich die Position beim
        // Zonenwechsel verändert (z.B. "V (L)" -> "V (Z)", "ST" -> "M (Z)").
        el.querySelector('.tactic-marker-label').textContent = markerToSlot(marker);
        el.title = markerToSlot(marker);
      }
      function onUp() {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        state.activeFormation = null;
        renderTacticsPresets();
        updateTactics();
      }
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
    });
  }

  function renderTacticsBoard() {
    tacticsBoardEl.innerHTML = '';

    var halfway = document.createElement('div');
    halfway.className = 'tactics-halfway-line';
    var circle = document.createElement('div');
    circle.className = 'tactics-center-circle';
    var boxTop = document.createElement('div');
    boxTop.className = 'tactics-box tactics-box-top';
    var boxBottom = document.createElement('div');
    boxBottom.className = 'tactics-box tactics-box-bottom';
    tacticsBoardEl.appendChild(halfway);
    tacticsBoardEl.appendChild(circle);
    tacticsBoardEl.appendChild(boxTop);
    tacticsBoardEl.appendChild(boxBottom);

    // Zonenlinien + Beschriftung (links/zentral/rechts) - macht sichtbar, welche
    // Zone ein verschobener Marker gerade zugeordnet bekommt (siehe markerToSlot).
    TACTICS_ZONE_BOUNDARIES.forEach(function (boundary) {
      var line = document.createElement('div');
      line.className = 'tactics-zone-line';
      line.style.left = boundary + '%';
      tacticsBoardEl.appendChild(line);
    });
    var zoneMidpoints = [TACTICS_ZONE_BOUNDARIES[0] / 2, 50, (TACTICS_ZONE_BOUNDARIES[1] + 100) / 2];
    ['L', 'Z', 'R'].forEach(function (label, i) {
      var zoneLabel = document.createElement('div');
      zoneLabel.className = 'tactics-zone-label';
      zoneLabel.style.left = zoneMidpoints[i] + '%';
      zoneLabel.textContent = label;
      tacticsBoardEl.appendChild(zoneLabel);
    });

    // Zeilen-Raster (y-Achse) - macht sichtbar, in welche Zeile ein Marker beim
    // Verschieben umgewandelt wird (siehe tacticsCodeForPosition).
    TACTICS_Y_ROWS.slice(0, -1).forEach(function (row) {
      var hLine = document.createElement('div');
      hLine.className = 'tactics-row-line';
      hLine.style.top = row.min + '%';
      tacticsBoardEl.appendChild(hLine);
    });
    TACTICS_Y_ROWS.forEach(function (row, i) {
      var upper = i > 0 ? TACTICS_Y_ROWS[i - 1].min : 100;
      var rowLabel = document.createElement('div');
      rowLabel.className = 'tactics-row-label';
      rowLabel.style.top = ((row.min + upper) / 2) + '%';
      rowLabel.textContent = row.label;
      tacticsBoardEl.appendChild(rowLabel);
    });

    state.tacticMarkers.forEach(function (marker) {
      var el = document.createElement('div');
      el.className = 'tactic-marker';
      el.style.left = marker.x + '%';
      el.style.top = marker.y + '%';
      el.title = markerToSlot(marker);

      var label = document.createElement('span');
      label.className = 'tactic-marker-label';
      label.textContent = markerToSlot(marker);
      el.appendChild(label);

      var removeBtn = document.createElement('span');
      removeBtn.className = 'tactic-marker-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
      removeBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        removeTacticsMarker(marker.id);
      });
      el.appendChild(removeBtn);

      makeMarkerDraggable(el, marker);
      tacticsBoardEl.appendChild(el);
    });
  }

  function renderPositionGaps() {
    positionGapsEl.innerHTML = '';
    var gaps = computePositionGaps(state.players, state.neededPositionCounts);
    gaps.forEach(function (gap) {
      var chip = document.createElement('span');
      chip.className = 'position-gap-chip' + (gap.severity !== 'ok' ? ' ' + gap.severity : '');
      chip.title = gap.neededStarters + ' Starter benötigt, Zieltiefe ' + gap.target;
      chip.textContent = gap.code + ': ' + gap.count + '/' + gap.target;
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
          var reason = p.hintReasons && p.hintReasons[cat.key];
          if (reason) {
            li.appendChild(document.createTextNode(' – ' + reason));
          }
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

    var gapResults = computePositionGaps(state.players, state.neededPositionCounts);
    var qualityResults = computePositionQuality(state.players, state.qualityAttributes);
    var ratingResults = computePositionRatings(state.players);
    var actionItems = computePositionActionItems(gapResults, qualityResults, ratingResults);

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
            openPositionDetail(item.slot, state.qualityAttributes[parsePositionSlot(item.slot).code] || []);
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

  // Gemeinsame Render-Logik für "Qualität je Position" und "Leistung je Position"
  // (gleiche Tabellenform: Position/Spieler/Anzahl-Kennzahlen/Ø-Wert, sortierbar).
  function renderRankingTable(wrapperEl, columns, results, sortKey, sortDir, onHeaderClick, onRowClick) {
    var col = columns.filter(function (c) { return c.key === sortKey; })[0];
    var sorted = !col ? results.slice() : results.slice().sort(function (a, b) {
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
    if (col && sortDir === 'desc') sorted.reverse();

    wrapperEl.innerHTML = '';
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    columns.forEach(function (c) {
      var th = document.createElement('th');
      th.className = 'sortable';
      var arrow = sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      th.textContent = c.label + arrow;
      th.addEventListener('click', function () { onHeaderClick(c.key); });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    sorted.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'clickable-row';
      tr.addEventListener('click', function () { onRowClick(r); });
      columns.forEach(function (c) {
        var td = document.createElement('td');
        var val = c.format ? c.format(r) : c.get(r);
        td.textContent = val == null ? '' : val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapperEl.appendChild(table);
  }

  function renderQualityTable() {
    var results = computePositionQuality(state.players, state.qualityAttributes);
    renderRankingTable(qualityTableWrapperEl, QUALITY_COLUMNS, results, state.qualitySortKey, state.qualitySortDir,
      function (key) {
        if (state.qualitySortKey === key) {
          state.qualitySortDir = state.qualitySortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.qualitySortKey = key;
          state.qualitySortDir = 'asc';
        }
        renderQualityTable();
      },
      function (r) { openPositionDetail(r.code, state.qualityAttributes[parsePositionSlot(r.code).code] || []); }
    );
  }

  function renderPerformanceSettings() {
    performanceSettingsBodyEl.innerHTML = '';
    collectRootPositionCodes(state.players).forEach(function (code) {
      var options = performanceAttributeOptionsForPosition(state.headers, code);
      performanceSettingsBodyEl.appendChild(makeCheckboxGroupField(
        code,
        options,
        state.performanceAttributes[code] || [],
        function (selected) {
          state.performanceAttributes[code] = selected;
          renderPerformanceTable();
        }
      ));
    });
  }

  function renderPerformanceTable() {
    // Durchschnittsnote ist für jede Position fest dabei (eigene Spalte unten),
    // zusätzlich zu den je Position gewählten Kennzahlen.
    var attrsByCode = {};
    var extraMetrics = [];
    collectRootPositionCodes(state.players).forEach(function (code) {
      var extra = state.performanceAttributes[code] || [];
      attrsByCode[code] = [PERFORMANCE_PINNED_ATTRIBUTE].concat(extra);
      extra.forEach(function (a) {
        if (extraMetrics.indexOf(a) === -1) extraMetrics.push(a);
      });
    });

    var results = computePositionMetrics(state.players, attrsByCode, performanceValueOf);

    function metricColumn(attrName) {
      var isPerNinety = PERFORMANCE_PER90_STATS.indexOf(attrName) !== -1;
      return {
        key: 'metric:' + attrName,
        label: attrName + (isPerNinety ? ' (pro 90)' : ''),
        get: function (r) { return r.metrics[attrName]; },
        format: function (r) {
          var v = r.metrics[attrName];
          return v != null ? v.toFixed(2) : '–';
        }
      };
    }

    var columns = PERFORMANCE_BASE_COLUMNS
      .concat([metricColumn(PERFORMANCE_PINNED_ATTRIBUTE)])
      .concat(extraMetrics.map(metricColumn));

    if (columns.filter(function (c) { return c.key === state.performanceSortKey; }).length === 0) {
      state.performanceSortKey = 'code';
      state.performanceSortDir = 'asc';
    }

    renderRankingTable(performanceTableWrapperEl, columns, results, state.performanceSortKey, state.performanceSortDir,
      function (key) {
        if (state.performanceSortKey === key) {
          state.performanceSortDir = state.performanceSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.performanceSortKey = key;
          state.performanceSortDir = 'asc';
        }
        renderPerformanceTable();
      },
      function (r) { openPositionDetail(r.code, attrsByCode[parsePositionSlot(r.code).code] || [], false); }
    );
  }

  // blend: true (Standard) zeigt eine Ø-Wert-Spalte auf position.html - sinnvoll
  // bei gleich skalierten Werten (Qualitäts-Attribute, 1-20). false unterdrückt
  // das (Leistungskennzahlen haben unterschiedliche Skalen, siehe performance.js).
  function openPositionDetail(slot, attrs, blend) {
    attrs = attrs || [];
    blend = blend !== false;
    var relevantPlayers = state.players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    });
    var payload = JSON.stringify({
      code: slot,
      attributes: attrs,
      blend: blend,
      perNinetyAttributes: attrs.filter(function (a) { return PERFORMANCE_PER90_STATS.indexOf(a) !== -1; }),
      records: relevantPlayers.map(function (p) { return { raw: p.raw, totalMinutes: p.totalMinutes }; })
    });
    window.open('position.html#' + encodeURIComponent(payload), '_blank');
  }

  function renderStandardsSettings() {
    standardsSettingsBodyEl.innerHTML = '';
    STANDARDS_CATEGORIES.forEach(function (cat) {
      standardsSettingsBodyEl.appendChild(makeCheckboxGroupField(
        cat.label,
        state.numericColumns,
        state.standardsAttributes[cat.key] || [],
        function (selected) {
          state.standardsAttributes[cat.key] = selected;
          renderStandardsResults();
        }
      ));
    });
  }

  function renderStandardsResults() {
    standardsResultsEl.innerHTML = '';
    STANDARDS_CATEGORIES.forEach(function (cat) {
      var attrs = state.standardsAttributes[cat.key] || [];
      var ranking = computeStandardsRanking(state.players, attrs, 5);

      var box = document.createElement('div');
      box.className = 'standards-category';

      var title = document.createElement('h4');
      title.textContent = cat.label;
      box.appendChild(title);

      if (attrs.length === 0) {
        var note = document.createElement('p');
        note.className = 'standards-role';
        note.textContent = 'Keine Attribute ausgewählt.';
        box.appendChild(note);
      } else if (ranking.length === 0) {
        var noData = document.createElement('p');
        noData.className = 'standards-role';
        noData.textContent = 'Keine Daten für diese Attribute.';
        box.appendChild(noData);
      } else {
        var ol = document.createElement('ol');
        ranking.forEach(function (entry, index) {
          var li = document.createElement('li');
          var link = document.createElement('a');
          link.href = '#';
          link.textContent = entry.player.name;
          link.addEventListener('click', function (event) {
            event.preventDefault();
            openProfile(entry.player);
          });
          li.appendChild(link);
          li.appendChild(document.createTextNode(' (Ø ' + entry.average.toFixed(1) + ')'));

          if (cat.key === 'leadership' && index < 2) {
            var role = document.createElement('span');
            role.className = 'standards-role';
            role.textContent = ' – ' + (index === 0 ? 'Kapitän-Vorschlag' : 'Stellvertreter-Vorschlag');
            li.appendChild(role);
          }

          ol.appendChild(li);
        });
        box.appendChild(ol);
      }

      standardsResultsEl.appendChild(box);
    });
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

  // Beim Öffnen automatisch den zuletzt gespeicherten Kader laden, falls
  // vorhanden (siehe storage.js) - kein erneuter CSV-Upload nötig.
  (function loadSavedKaderOnStartup() {
    var saved = loadCsvFromStorage();
    if (!saved) return;
    loadCurrentIntoApp(saved.fileName, saved.csvText, loadPreviousCsvFromStorage());
    applyLoadedTacticAndDate(loadTacticMarkersFromStorage(), loadReferenceDateFromStorage());
  })();
});
