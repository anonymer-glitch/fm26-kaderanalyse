// Generischer CSV-Parser für FM26-Exports (Semikolon-getrennt, quote-aware).
// Kein externes Paket: das Format ist bekannt und sauber (siehe README).
function parseCSV(text, delimiter) {
  delimiter = delimiter || ';';

  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  var i = 0;
  var len = text.length;

  function pushField() {
    row.push(field);
    field = '';
  }

  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  // Leere Zeilen (z.B. abschließende Leerzeile im Export) verwerfen.
  rows = rows.filter(function (r) {
    return !(r.length === 1 && r[0] === '');
  });

  if (rows.length === 0) {
    return { headers: [], records: [], warnings: ['Datei enthält keine Daten.'] };
  }

  var headers = rows[0];
  var dataRows = rows.slice(1);
  var warnings = [];

  var records = dataRows.map(function (r, idx) {
    if (r.length !== headers.length) {
      warnings.push(
        'Zeile ' + (idx + 2) + ': ' + r.length + ' Felder statt ' + headers.length + ' erwartet.'
      );
    }
    var record = {};
    headers.forEach(function (h, colIdx) {
      record[h] = r[colIdx] !== undefined ? r[colIdx] : '';
    });
    return record;
  });

  return { headers: headers, records: records, warnings: warnings };
}
