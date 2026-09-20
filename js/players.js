// Logik-Schicht: wandelt generische CSV-Records in typisierte Spieler-Objekte um
// und liefert Hilfsfunktionen für Filter/Sortierung. Kennt keine UI-Details.

function parseGermanDate(str) {
  if (!str) return null;
  var parts = str.split('.');
  if (parts.length !== 3) return null;
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

// Wandelt FM26-Gehaltstexte wie "3,99Mio. €/J." oder "768K €/J." in eine Zahl (€/Jahr) um.
function parseGehalt(str) {
  if (!str) return null;
  var cleaned = str.replace('€/J.', '').trim();
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
  if (isNaN(num)) return null;
  return Math.round(num * multiplier);
}

function isIntegerString(str) {
  return /^-?\d+$/.test((str || '').trim());
}

// Spalten, die zwar rein numerisch aussehen, aber keine Spieler-Attribute/Leistungswerte sind.
var NON_ATTRIBUTE_COLUMNS = ['Unique ID', 'Alter'];

// Erkennt automatisch alle numerischen Spalten (Attribute, Leistungsdaten wie "Lsp Eins" etc.),
// ohne eine feste Spaltenliste vorauszusetzen.
function detectNumericColumns(headers, records) {
  return headers.filter(function (h) {
    if (NON_ATTRIBUTE_COLUMNS.indexOf(h) !== -1) return false;
    return records.length > 0 && records.every(function (r) {
      return isIntegerString(r[h]);
    });
  });
}

function buildPlayers(records) {
  return records.map(function (record) {
    var age = parseInt(record['Alter'], 10);
    return {
      id: record['Unique ID'] || null,
      raw: record,
      name: record['Spieler'] || '',
      position: record['Position'] || '',
      idealPosition: record['Idealpos'] || '',
      age: isNaN(age) ? null : age,
      contractEnd: parseGermanDate(record['Endet']),
      contractEndRaw: record['Endet'] || '',
      salary: parseGehalt(record['Gehalt']),
      salaryRaw: record['Gehalt'] || '',
      statusActual: record['Tatsächliche Einsatzzeiten'] || '',
      statusExpected: record['Einsatzzeiten'] || ''
    };
  });
}

function uniqueValues(records, column) {
  var seen = {};
  var result = [];
  records.forEach(function (r) {
    var v = r[column];
    if (v && !seen[v]) {
      seen[v] = true;
      result.push(v);
    }
  });
  return result.sort();
}

function filterPlayers(players, filters) {
  return players.filter(function (p) {
    if (filters.position) {
      var needle = filters.position.toLowerCase();
      var hay = (p.position + ' ' + p.idealPosition).toLowerCase();
      if (hay.indexOf(needle) === -1) return false;
    }
    if (filters.ageMin != null && (p.age == null || p.age < filters.ageMin)) return false;
    if (filters.ageMax != null && (p.age == null || p.age > filters.ageMax)) return false;
    if (filters.contractBefore && (!p.contractEnd || p.contractEnd > filters.contractBefore)) return false;
    if (filters.salaryMin != null && (p.salary == null || p.salary < filters.salaryMin)) return false;
    if (filters.salaryMax != null && (p.salary == null || p.salary > filters.salaryMax)) return false;
    if (filters.status && p.statusActual !== filters.status) return false;
    if (filters.attrColumn && filters.attrMin != null) {
      var val = parseInt(p.raw[filters.attrColumn], 10);
      if (isNaN(val) || val < filters.attrMin) return false;
    }
    return true;
  });
}

function sortPlayers(players, sortKey, sortDir, columns) {
  var col = columns.filter(function (c) { return c.key === sortKey; })[0];
  if (!col) return players.slice();
  var sorted = players.slice().sort(function (a, b) {
    var av = col.get(a);
    var bv = col.get(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (sortDir === 'desc') sorted.reverse();
  return sorted;
}
