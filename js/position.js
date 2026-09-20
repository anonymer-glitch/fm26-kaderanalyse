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
  var perNinetyAttributes = data.perNinetyAttributes || [];
  var blend = data.blend !== false;
  var rows = data.records || []; // { raw, totalMinutes }

  // Wie performanceValueOf in performance.js: absolute Zähler werden auf "pro
  // 90 Minuten" umgerechnet, alles andere (Raten, Noten, bereits-pro-90-Werte)
  // unverändert übernommen.
  function valueOf(row, attrName) {
    var raw = parseDecimalLocal(row.raw[attrName]);
    if (raw == null) return null;
    if (perNinetyAttributes.indexOf(attrName) !== -1) {
      return row.totalMinutes ? (raw * 90 / row.totalMinutes) : null;
    }
    return raw;
  }

  function averageOf(row) {
    var sum = 0;
    var count = 0;
    attributes.forEach(function (a) {
      var val = valueOf(row, a);
      if (val != null) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  }

  // Ohne "blend" (unterschiedlich skalierte Leistungskennzahlen) gibt es keinen
  // sinnvollen Gesamtwert - dann wird nach der ersten gewählten Kennzahl sortiert.
  var sortAttr = attributes[0];
  var sortedRows = rows
    .map(function (row) {
      return { row: row, average: blend ? averageOf(row) : null, sortValue: sortAttr ? valueOf(row, sortAttr) : null };
    })
    .sort(function (a, b) {
      var av = blend ? a.average : a.sortValue;
      var bv = blend ? b.average : b.sortValue;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = 'Position: ' + code;
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = rows.length + ' Spieler' +
    (attributes.length ? ' · Kennzahlen: ' + attributes.join(', ') : ' · keine Kennzahlen ausgewählt') +
    (perNinetyAttributes.length ? ' (davon pro 90 Min. umgerechnet: ' + perNinetyAttributes.join(', ') + ')' : '');
  container.appendChild(subtitle);

  var baseColumns = ['Spieler', 'Position', 'Alter', 'Endet', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];
  var baseLabels = ['Spieler', 'Position', 'Alter', 'Vertragsende', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  baseLabels.concat(attributes).concat(blend ? ['Ø Wert'] : []).forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  sortedRows.forEach(function (entry) {
    var record = entry.row.raw;
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
      var val = valueOf(entry.row, a);
      var td = document.createElement('td');
      td.textContent = val == null ? '' : (perNinetyAttributes.indexOf(a) !== -1 ? val.toFixed(2) : val);
      tr.appendChild(td);
    });
    if (blend) {
      var avgTd = document.createElement('td');
      avgTd.textContent = entry.average != null ? entry.average.toFixed(2) : '–';
      tr.appendChild(avgTd);
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  var wrapper = document.createElement('div');
  wrapper.id = 'table-wrapper';
  wrapper.appendChild(table);
  container.appendChild(wrapper);
});
