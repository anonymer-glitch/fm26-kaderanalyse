// Eigenständige Seite: alle Spieler einer Position, aus dem Dashboard heraus per
// Klick auf eine Zeile der "Qualität je Position"-Tabelle geöffnet. Bekommt die
// Daten wie beim Spielerprofil per URL-Hash übergeben (kein Server nötig).
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
  var qualityAttributes = data.qualityAttributes || [];
  var records = data.records || [];

  function qualityOf(record) {
    var sum = 0;
    var count = 0;
    qualityAttributes.forEach(function (a) {
      var val = parseInt(record[a], 10);
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  }

  var rows = records
    .map(function (record) { return { record: record, quality: qualityOf(record) }; })
    .sort(function (a, b) {
      if (a.quality == null && b.quality == null) return 0;
      if (a.quality == null) return 1;
      if (b.quality == null) return -1;
      return b.quality - a.quality;
    });

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = 'Position: ' + code;
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = records.length + ' Spieler' +
    (qualityAttributes.length ? ' · Qualitäts-Attribute: ' + qualityAttributes.join(', ') : ' · keine Qualitäts-Attribute ausgewählt');
  container.appendChild(subtitle);

  var baseColumns = ['Spieler', 'Position', 'Alter', 'Endet', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];
  var baseLabels = ['Spieler', 'Position', 'Alter', 'Vertragsende', 'Gehalt', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'];

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  baseLabels.concat(qualityAttributes).concat(['Ø Qualität']).forEach(function (h) {
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
    qualityAttributes.forEach(function (a) {
      var val = parseInt(record[a], 10);
      var td = document.createElement('td');
      td.textContent = isNaN(val) ? '' : val;
      tr.appendChild(td);
    });
    var avgTd = document.createElement('td');
    avgTd.textContent = row.quality != null ? row.quality.toFixed(1) : '–';
    tr.appendChild(avgTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  var wrapper = document.createElement('div');
  wrapper.id = 'table-wrapper';
  wrapper.appendChild(table);
  container.appendChild(wrapper);
});
