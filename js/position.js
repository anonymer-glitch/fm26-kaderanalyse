// Eigenständige Seite: alle Spieler einer Position, aus dem Dashboard heraus per
// Klick auf eine Zeile der "Qualität je Position"- oder "Leistung je Position"-
// Tabelle geöffnet. Bekommt die Daten wie beim Spielerprofil per URL-Hash
// übergeben (kein Server nötig). Läuft eigenständig, deshalb ein eigener
// kleiner Dezimal-Parser statt eines Imports aus players.js.
function parseDecimalLocal(str) {
  if (!str) return null;
  var num = parseFloat(String(str).replace(',', '.'));
  return isNaN(num) ? null : num;
}

document.addEventListener('DOMContentLoaded', function () {
  var container = document.getElementById('position-content');
  var hash = window.location.hash.slice(1);

  if (!hash) {
    container.textContent = 'Keine Positionsdaten übergeben. Bitte über das Dashboard öffnen.';
    return;
  }

  var data;
  try {
    data = JSON.parse(decodeURIComponent(hash));
  } catch (e) {
    container.textContent = 'Positionsdaten konnten nicht gelesen werden.';
    return;
  }

  var code = data.code;
  var attributes = data.attributes || [];
  var records = data.records || [];

  function averageOf(record) {
    var sum = 0;
    var count = 0;
    attributes.forEach(function (a) {
      var val = parseDecimalLocal(record[a]);
      if (val != null) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  }

  var rows = records
    .map(function (record) { return { record: record, average: averageOf(record) }; })
    .sort(function (a, b) {
      if (a.average == null && b.average == null) return 0;
      if (a.average == null) return 1;
      if (b.average == null) return -1;
      return b.average - a.average;
    });

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = 'Position: ' + code;
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = records.length + ' Spieler' +
    (attributes.length ? ' · Kennzahlen: ' + attributes.join(', ') : ' · keine Kennzahlen ausgewählt');
  container.appendChild(subtitle);

  var baseColumns = ['Spieler', 'Position', 'Alter', 'Endet', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];
  var baseLabels = ['Spieler', 'Position', 'Alter', 'Vertragsende', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  baseLabels.concat(attributes).concat(['Ø Wert']).forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  rows.forEach(function (row) {
    var record = row.record;
    var tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.addEventListener('click', function () {
      var payload = JSON.stringify({ headers: Object.keys(record), record: record });
      window.open('profile.html#' + encodeURIComponent(payload), '_blank');
    });

    baseColumns.forEach(function (col) {
      var td = document.createElement('td');
      td.textContent = record[col] || '';
      tr.appendChild(td);
    });
    attributes.forEach(function (a) {
      var val = parseDecimalLocal(record[a]);
      var td = document.createElement('td');
      td.textContent = val == null ? '' : val;
      tr.appendChild(td);
    });
    var avgTd = document.createElement('td');
    avgTd.textContent = row.average != null ? row.average.toFixed(2) : '–';
    tr.appendChild(avgTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  var wrapper = document.createElement('div');
  wrapper.id = 'table-wrapper';
  wrapper.appendChild(table);
  container.appendChild(wrapper);
});
