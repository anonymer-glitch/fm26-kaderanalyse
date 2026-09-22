// Eigenständige Seite: 2-4 Spieler direkt nebeneinander vergleichen, aus der
// Kaderübersicht heraus per Häkchen ausgewählt (siehe renderTable/compare-bar
// in app.js). Bekommt die Daten wie Spielerprofil/Position per URL-Hash
// übergeben (kein Server nötig). Spieler als Spalten, Merkmale als Zeilen -
// bewusst OHNE "bester Wert"-Hervorhebung: bei Gehalt/Marktwert ist "hoch"
// nicht eindeutig gut oder schlecht, das bleibt der Einschätzung des Nutzers
// überlassen (keine Blackbox-Bewertung, wie beim Handlungsbedarf).

// Kuratierte Startauswahl an Merkmalen (Rohspalten-Namen aus dem Export) -
// dieselben Kernwerte wie in der Kaderübersicht. Weitere Spalten lassen sich
// über "Weitere Attribute hinzufügen" darunter dazuwählen.
var COMPARE_DEFAULT_FIELDS = [
  { column: 'Position', label: 'Position' },
  { column: 'Alter', label: 'Alter' },
  { column: 'Endet', label: 'Vertragsende' },
  { column: 'Gehalt', label: 'Gehalt' },
  { column: 'Transferwert', label: 'Marktwert' },
  { column: 'Tatsächliche Einsatzzeiten', label: 'Tatsächliche Einsatzzeiten' },
  { column: 'Einsatzzeiten', label: 'Einsatzzeiten (vereinbart)' },
  { column: 'Durchschnittsnote – Verein', label: 'Durchschnittsnote' }
];

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

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = 'Spielervergleich';
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = records.map(function (r) { return r['Spieler'] || 'Unbekannt'; }).join(' · ');
  container.appendChild(subtitle);

  var settingsDetails = document.createElement('details');
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

  var tableWrapper = document.createElement('div');
  tableWrapper.id = 'table-wrapper';
  container.appendChild(tableWrapper);

  function renderTable() {
    tableWrapper.innerHTML = '';
    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var cornerTh = document.createElement('th');
    cornerTh.textContent = 'Merkmal';
    headRow.appendChild(cornerTh);
    records.forEach(function (r) {
      var th = document.createElement('th');
      th.textContent = r['Spieler'] || 'Unbekannt';
      th.style.cursor = 'pointer';
      th.title = 'Profil öffnen';
      th.addEventListener('click', function () {
        var payload = JSON.stringify({ headers: headers, record: r });
        window.open('profile.html#' + encodeURIComponent(payload), '_blank');
      });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var fields = COMPARE_DEFAULT_FIELDS.concat(selectedExtra.map(function (c) { return { column: c, label: c }; }));
    fields.forEach(function (field) {
      var tr = document.createElement('tr');
      var rowTh = document.createElement('th');
      rowTh.scope = 'row';
      rowTh.textContent = field.label;
      tr.appendChild(rowTh);
      records.forEach(function (r) {
        var td = document.createElement('td');
        td.textContent = r[field.column] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableWrapper.appendChild(table);
  }

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
      renderTable();
    });
    chip.appendChild(box);
    chip.appendChild(document.createTextNode(col));
    settingsGroup.appendChild(chip);
  });

  renderTable();
});
