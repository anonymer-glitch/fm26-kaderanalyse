document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.getElementById('csv-file');
  var statusEl = document.getElementById('import-status');
  var dataSection = document.getElementById('data-section');
  var rowCountEl = document.getElementById('row-count');
  var tableWrapper = document.getElementById('table-wrapper');

  fileInput.addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;

    statusEl.textContent = 'Lese Datei...';
    dataSection.hidden = true;

    var reader = new FileReader();
    reader.onload = function (e) {
      var result = parseCSV(e.target.result);
      renderResult(result, file.name);
    };
    reader.onerror = function () {
      statusEl.textContent = 'Fehler beim Lesen der Datei.';
    };
    reader.readAsText(file, 'UTF-8');
  });

  function renderResult(result, fileName) {
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

    rowCountEl.textContent = result.records.length;
    tableWrapper.innerHTML = '';
    tableWrapper.appendChild(buildTable(result.headers, result.records));
    dataSection.hidden = false;
  }

  function buildTable(headers, records) {
    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    headers.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    records.forEach(function (record) {
      var tr = document.createElement('tr');
      headers.forEach(function (h) {
        var td = document.createElement('td');
        td.textContent = record[h];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }
});
