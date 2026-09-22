// Eigenständige Seite: 2-4 Spieler direkt nebeneinander vergleichen, aus der
// Kaderübersicht heraus per Häkchen ausgewählt (siehe renderTable/compare-bar
// in app.js). Bekommt die Daten wie Spielerprofil/Position per URL-Hash
// übergeben (kein Server nötig). Spieler als Spalten, Merkmale als Zeilen,
// plus ein grafischer Balken-Vergleich darunter.
//
// Grün markiert wird NUR bei echten Leistungs-/Attributwerten (Durchschnitts-
// note + frei dazugewählte Attribute) - bei Gehalt/Marktwert/Alter/Vertragsende
// ist "hoch" nicht eindeutig gut oder schlecht, das bleibt bewusst neutral
// (keine Blackbox-Bewertung, wie beim Handlungsbedarf). Aus demselben Grund
// tragen die wenigen Kennzahlen, bei denen WENIGER besser ist (Fouls, Karten),
// ihre Markierung umgekehrt (siehe COMPARE_LOWER_IS_BETTER).
var COMPARE_LOWER_IS_BETTER = ['Fouls', 'Gelbe Karten', 'Rote Karten', 'Fehler mit Torfolge'];

// Kuratierte Startauswahl an Merkmalen (Rohspalten-Namen aus dem Export) -
// dieselben Kernwerte wie in der Kaderübersicht. Weitere Spalten lassen sich
// über "Weitere Attribute hinzufügen" darunter dazuwählen. "stat" markiert
// Felder, die grün hervorgehoben UND im Balken-Vergleich gezeigt werden
// (echte Leistungswerte); die übrigen Default-Felder sind rein informativ.
var COMPARE_DEFAULT_FIELDS = [
  { column: 'Position', label: 'Position' },
  { column: 'Alter', label: 'Alter', parse: parseIntLocal },
  { column: 'Endet', label: 'Vertragsende' },
  { column: 'Gehalt', label: 'Gehalt', parse: parseMoneyLocal },
  { column: 'Transferwert', label: 'Marktwert', parse: parseMoneyLocal },
  { column: 'Tatsächliche Einsatzzeiten', label: 'Tatsächliche Einsatzzeiten' },
  { column: 'Einsatzzeiten', label: 'Einsatzzeiten (vereinbart)' },
  { column: 'Durchschnittsnote – Verein', label: 'Durchschnittsnote', parse: parseDecimalLocal, stat: true }
];

// Läuft eigenständig (wie position.js), deshalb eigene kleine Parser statt
// eines Imports aus players.js - siehe dort für die Originale.
function parseDecimalLocal(str) {
  if (!str) return null;
  var num = parseFloat(String(str).replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parseIntLocal(str) {
  if (!str) return null;
  var num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function parseMoneyLocal(str) {
  if (!str) return null;
  var cleaned = str.replace('€/J.', '').replace('€', '').trim();
  var multiplier = 1;
  if (/Mio\.?$/i.test(cleaned)) {
    multiplier = 1000000;
    cleaned = cleaned.replace(/Mio\.?$/i, '').trim();
  } else if (/K$/i.test(cleaned)) {
    multiplier = 1000;
    cleaned = cleaned.replace(/K$/i, '').trim();
  }
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  var num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * multiplier);
}

// Best-effort-Parser für frei dazugewählte Attribute (unbekannte Spalten) -
// deutsche Kommazahl, Prozentwerte ("72%"), einfache Ganzzahlen (FM-Attribute
// 1-20). Liefert null, wenn nichts Numerisches erkennbar ist - solche Spalten
// bleiben dann unmarkiert/ungechartet statt eine falsche Zahl zu erfinden.
function parseCompareNumber(str) {
  if (str == null || str === '') return null;
  var match = String(str).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Feste Reihenfolge/Farben je Spieler (Spalte), unabhängig davon, wer in
// welcher Zeile gerade vorn liegt - Farbe folgt der Person, nie dem Rang.
// Dark-Mode-Schritte der validierten 4er-Palette (adjacent CVD-Check + alle
// Kontrast-Checks gegen die dunkle Fläche #1a1a19 bestanden, siehe dataviz-Skill).
var COMPARE_PLAYER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500'];

document.addEventListener('DOMContentLoaded', function () {
  var container = document.getElementById('compare-content');
  var hash = window.location.hash.slice(1);

  if (!hash) {
    container.textContent = 'Keine Spieler zum Vergleichen übergeben. Bitte über die Kaderübersicht auswählen.';
    return;
  }

  var data;
  try {
    data = JSON.parse(decodeURIComponent(hash));
  } catch (e) {
    container.textContent = 'Vergleichsdaten konnten nicht gelesen werden.';
    return;
  }

  var headers = data.headers || [];
  var records = data.records || [];

  if (records.length < 2) {
    container.textContent = 'Für einen Vergleich werden mindestens 2 Spieler benötigt.';
    return;
  }

  var defaultColumns = COMPARE_DEFAULT_FIELDS.map(function (f) { return f.column; });
  var extraColumns = headers.filter(function (h) {
    return h !== 'Spieler' && h !== 'Unique ID' && defaultColumns.indexOf(h) === -1;
  });
  var selectedExtra = [];
  var playerColors = records.map(function (r, i) { return COMPARE_PLAYER_COLORS[i % COMPARE_PLAYER_COLORS.length]; });

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = 'Spielervergleich';
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = records.map(function (r) { return r['Spieler'] || 'Unbekannt'; }).join(' · ');
  container.appendChild(subtitle);

  var settingsDetails = document.createElement('details');
  settingsDetails.id = 'compare-attribute-picker';
  settingsDetails.className = 'quality-settings';
  var summary = document.createElement('summary');
  summary.textContent = 'Weitere Attribute hinzufügen';
  settingsDetails.appendChild(summary);

  var settingsField = document.createElement('div');
  settingsField.className = 'filter-field';
  var settingsLabel = document.createElement('label');
  settingsLabel.textContent = 'Zusätzliche Spalten aus dem Export';
  settingsField.appendChild(settingsLabel);
  var settingsGroup = document.createElement('div');
  settingsGroup.className = 'checkbox-group';
  settingsField.appendChild(settingsGroup);
  settingsDetails.appendChild(settingsField);
  container.appendChild(settingsDetails);

  var note = document.createElement('p');
  note.className = 'standards-note';
  note.textContent = 'Grün markiert den jeweils besten Wert einer Zeile - nur bei echten Leistungswerten (Durchschnittsnote, dazugewählte Attribute), nicht bei Gehalt/Marktwert/Alter/Vertragsende, da "hoch" dort nicht eindeutig gut oder schlecht ist.';
  container.appendChild(note);

  var tableWrapper = document.createElement('div');
  tableWrapper.id = 'table-wrapper';
  container.appendChild(tableWrapper);

  var chartTitle = document.createElement('h2');
  chartTitle.textContent = 'Grafischer Vergleich';
  container.appendChild(chartTitle);

  var chartLegend = document.createElement('div');
  chartLegend.className = 'compare-chart-legend';
  records.forEach(function (r, i) {
    var item = document.createElement('span');
    item.className = 'compare-chart-legend-item';
    var swatch = document.createElement('span');
    swatch.className = 'compare-chart-swatch';
    swatch.style.background = playerColors[i];
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(r['Spieler'] || 'Unbekannt'));
    chartLegend.appendChild(item);
  });
  container.appendChild(chartLegend);

  var chartWrapper = document.createElement('div');
  chartWrapper.id = 'compare-chart';
  container.appendChild(chartWrapper);

  // Alle Felder, die eine Zahl je Spieler liefern können: die dafür markierten
  // Default-Felder (Alter/Gehalt/Marktwert/Durchschnittsnote) plus alle gerade
  // dazugewählten Zusatz-Attribute (Best-Effort-Zahlenerkennung).
  function numericFields() {
    var defaults = COMPARE_DEFAULT_FIELDS.filter(function (f) { return f.parse; });
    var extras = selectedExtra.map(function (c) {
      return { column: c, label: c, parse: parseCompareNumber, stat: true };
    });
    return defaults.concat(extras);
  }

  // Für eine "stat"-Zeile (Leistungswert): Menge der Spielerindizes, die den
  // besten Wert dieser Zeile halten (mehrfach bei Gleichstand). Berücksichtigt
  // die wenige Kennzahlen, bei denen weniger besser ist (Fouls, Karten, ...).
  function bestIndicesFor(field) {
    var values = records.map(function (r) { return field.parse(r[field.column]); });
    var real = values.filter(function (v) { return v != null; });
    if (real.length === 0) return [];
    var lowerIsBetter = COMPARE_LOWER_IS_BETTER.indexOf(field.column) !== -1;
    var best = lowerIsBetter ? Math.min.apply(null, real) : Math.max.apply(null, real);
    var indices = [];
    values.forEach(function (v, i) { if (v === best) indices.push(i); });
    return indices;
  }

  function renderTable() {
    tableWrapper.innerHTML = '';
    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var cornerTh = document.createElement('th');
    cornerTh.textContent = 'Merkmal';
    headRow.appendChild(cornerTh);
    records.forEach(function (r, i) {
      var th = document.createElement('th');
      th.style.cursor = 'pointer';
      th.title = 'Profil öffnen';
      var swatch = document.createElement('span');
      swatch.className = 'compare-chart-swatch';
      swatch.style.background = playerColors[i];
      th.appendChild(swatch);
      th.appendChild(document.createTextNode(r['Spieler'] || 'Unbekannt'));
      th.addEventListener('click', function () {
        var payload = JSON.stringify({ headers: headers, record: r, referenceDate: data.referenceDate || null });
        window.open('profile.html#' + encodeURIComponent(payload), '_blank');
      });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var fields = COMPARE_DEFAULT_FIELDS
      .concat(selectedExtra.map(function (c) { return { column: c, label: c, parse: parseCompareNumber, stat: true }; }));
    fields.forEach(function (field) {
      var tr = document.createElement('tr');
      var rowTh = document.createElement('th');
      rowTh.scope = 'row';
      rowTh.textContent = field.label;
      tr.appendChild(rowTh);

      var bestIndices = field.stat ? bestIndicesFor(field) : [];
      records.forEach(function (r, i) {
        var td = document.createElement('td');
        td.textContent = r[field.column] || '';
        if (bestIndices.indexOf(i) !== -1) td.className = 'compare-best';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableWrapper.appendChild(table);
  }

  // Ein horizontaler Mini-Balken je Spieler und Zeile, pro Merkmal auf dessen
  // eigenes Maximum skaliert (0 = Basislinie) - unterschiedliche Skalen
  // (Note ~6-8, Alter, Gehalt in Millionen, Attribute 1-20) lassen sich nicht
  // sinnvoll in einem gemeinsamen Chart mischen, siehe performance.js für
  // dieselbe Überlegung bei "Leistung je Position".
  function renderChart() {
    chartWrapper.innerHTML = '';
    var fields = numericFields();

    fields.forEach(function (field) {
      var values = records.map(function (r) { return field.parse(r[field.column]); });
      var real = values.filter(function (v) { return v != null; });
      if (real.length === 0) return;
      var max = Math.max.apply(null, real.map(function (v) { return Math.abs(v); }));
      if (max <= 0) return;
      var bestIndices = field.stat ? bestIndicesFor(field) : [];

      var row = document.createElement('div');
      row.className = 'compare-chart-row';
      var rowLabel = document.createElement('div');
      rowLabel.className = 'compare-chart-row-label';
      rowLabel.textContent = field.label;
      row.appendChild(rowLabel);

      var bars = document.createElement('div');
      bars.className = 'compare-chart-bars';
      records.forEach(function (r, i) {
        var val = values[i];
        var item = document.createElement('div');
        item.className = 'compare-chart-bar-item';

        var name = document.createElement('span');
        name.className = 'compare-chart-bar-name';
        name.textContent = r['Spieler'] || 'Unbekannt';
        item.appendChild(name);

        var track = document.createElement('div');
        track.className = 'compare-chart-bar-track';
        var fill = document.createElement('div');
        fill.className = 'compare-chart-bar-fill';
        fill.style.width = (val != null ? Math.max(0, Math.abs(val) / max * 100) : 0) + '%';
        fill.style.background = playerColors[i];
        track.appendChild(fill);
        item.appendChild(track);

        var valueLabel = document.createElement('span');
        valueLabel.className = 'compare-chart-bar-value';
        if (bestIndices.indexOf(i) !== -1) valueLabel.classList.add('compare-best-text');
        valueLabel.textContent = val != null ? (r[field.column] || String(val)) : '–';
        item.appendChild(valueLabel);

        bars.appendChild(item);
      });
      row.appendChild(bars);
      chartWrapper.appendChild(row);
    });

    if (!chartWrapper.children.length) {
      var empty = document.createElement('p');
      empty.className = 'standards-note';
      empty.textContent = 'Keine numerischen Werte für den grafischen Vergleich verfügbar.';
      chartWrapper.appendChild(empty);
    }
  }

  function renderAll() {
    renderTable();
    renderChart();
  }

  // "Alle auswählen" ganz oben - markiert/entfernt alle Zusatzspalten auf
  // einmal, hält sich aber selbst synchron (angehakt nur wenn wirklich alle
  // gewählt sind, "indeterminate" bei einer Teilauswahl).
  var selectAllChip = document.createElement('label');
  selectAllChip.className = 'checkbox-chip';
  var selectAllBox = document.createElement('input');
  selectAllBox.type = 'checkbox';
  selectAllChip.appendChild(selectAllBox);
  selectAllChip.appendChild(document.createTextNode('Alle auswählen'));
  settingsGroup.appendChild(selectAllChip);

  var extraBoxes = [];
  function syncSelectAllBox() {
    selectAllBox.checked = selectedExtra.length === extraColumns.length && extraColumns.length > 0;
    selectAllBox.indeterminate = selectedExtra.length > 0 && selectedExtra.length < extraColumns.length;
  }

  selectAllBox.addEventListener('change', function () {
    selectedExtra = selectAllBox.checked ? extraColumns.slice() : [];
    extraBoxes.forEach(function (box) { box.checked = selectAllBox.checked; });
    selectAllBox.indeterminate = false;
    renderAll();
  });

  extraColumns.forEach(function (col) {
    var chip = document.createElement('label');
    chip.className = 'checkbox-chip';
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', function () {
      if (box.checked) {
        selectedExtra.push(col);
      } else {
        selectedExtra = selectedExtra.filter(function (c) { return c !== col; });
      }
      syncSelectAllBox();
      renderAll();
    });
    chip.appendChild(box);
    chip.appendChild(document.createTextNode(col));
    settingsGroup.appendChild(chip);
    extraBoxes.push(box);
  });

  renderAll();
});
