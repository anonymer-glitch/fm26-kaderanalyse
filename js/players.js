// Logik-Schicht: wandelt generische CSV-Records in typisierte Spieler-Objekte um
// und liefert Hilfsfunktionen für Filter/Sortierung. Kennt keine UI-Details.

// Bekannter Fehler im "Min/Sp"-Export (FM26PlayerExport): der Wert ist eine
// Ganzzahl (Minuten pro Spiel), aber es werden fälschlich lange, bedeutungslose
// Nachkommastellen mit exportiert (z.B. "77.2424242424242" statt "77"). Wird
// direkt beim Import bereinigt, damit die Spalte überall als saubere Zahl
// ankommt (Sortierung, Attribut-Filter, Qualität je Position, ...).
function fixMinutesPerGameColumn(records) {
  records.forEach(function (r) {
    if (r['Min/Sp'] != null && r['Min/Sp'] !== '') {
      var truncated = parseInt(r['Min/Sp'], 10);
      if (!isNaN(truncated)) {
        r['Min/Sp'] = String(truncated);
      }
    }
  });
}

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

// Wandelt FM26-Geldbeträge wie "3,99Mio. €/J.", "768K €/J." oder "24Mio. €" in
// eine Zahl um (der "/J."-Jahres-Zusatz beim Gehalt wird einfach mit entfernt).
function parseMoneyAmount(str) {
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
  if (isNaN(num)) return null;
  return Math.round(num * multiplier);
}

function parseGehalt(str) {
  return parseMoneyAmount(str);
}

// "Transferwert" ist entweder ein einzelner Betrag ("24Mio. €") oder eine Spanne
// ("23Mio. € - 29Mio. €", auch mit gemischten K/Mio.-Einheiten je Seite). Nimmt
// den Mittelwert der Spanne als Näherungswert für den Marktwert.
function parseMarketValue(str) {
  if (!str) return null;
  var parts = str.split('-').map(function (s) { return s.trim(); }).filter(Boolean);
  var values = parts.map(parseMoneyAmount).filter(function (v) { return v != null; });
  if (values.length === 0) return null;
  return Math.round(values.reduce(function (a, b) { return a + b; }, 0) / values.length);
}

// Deutsches Dezimalformat ("7,02", "0,96") in eine Zahl umwandeln.
function parseGermanDecimal(str) {
  if (!str) return null;
  var num = parseFloat(String(str).replace(',', '.'));
  return isNaN(num) ? null : num;
}

function isIntegerString(str) {
  return /^-?\d+$/.test((str || '').trim());
}

// Annahme zur fußballerisch sinnvollen Reihenfolge der Positionscodes
// (TW -> Abwehr -> Mittelfeld -> Sturm). Unbekannte Codes landen alphabetisch am Ende.
var POSITION_ORDER = ['TW', 'V', 'FV', 'DM', 'M', 'OM', 'ST'];

// Zerlegt FM26-Positionsangaben wie "DM, M/OM (Z)" oder "V/FV (R)" in einzelne
// Positions-"Slots" inkl. Seitenangabe (z.B. "V/FV (R)" -> "V (R)", "FV (R)";
// "DM, M/OM (Z)" -> "DM", "M (Z)", "OM (Z)"). Wird aus den Daten abgeleitet statt
// einer festen Liste von FM-Positionscodes - nur die Reihenfolge (POSITION_ORDER)
// ist eine Annahme.
function extractPositionSlots(positionStr) {
  if (!positionStr) return [];
  var slots = [];
  positionStr.split(',').forEach(function (segment) {
    var trimmedSegment = segment.trim();
    var sideMatch = trimmedSegment.match(/\(([^)]*)\)/);
    var side = sideMatch ? sideMatch[1].trim() : null;
    var codesPart = trimmedSegment.replace(/\([^)]*\)/g, '').trim();
    codesPart.split('/').forEach(function (code) {
      var trimmedCode = code.trim();
      if (!trimmedCode) return;
      slots.push(side ? (trimmedCode + ' (' + side + ')') : trimmedCode);
    });
  });
  return slots;
}

function collectPositionSlots(players) {
  var seen = {};
  var result = [];
  players.forEach(function (p) {
    p.positionSlots.forEach(function (slot) {
      if (!seen[slot]) {
        seen[slot] = true;
        result.push(slot);
      }
    });
  });
  return result;
}

// Links -> Zentral -> Rechts, passend zur Leserichtung eines Formationsbilds.
var SIDE_ORDER = ['L', 'Z', 'R'];

function parsePositionSlot(slot) {
  var match = slot.match(/^(\S+)(?:\s*\(([^)]*)\))?$/);
  return match ? { code: match[1], side: match[2] || null } : { code: slot, side: null };
}

// Vergleicht zwei Positions-Slots nach Reihenfolge auf dem Feld (TW -> ST,
// innerhalb einer Position links -> zentral -> rechts). Wiederverwendet überall,
// wo nach Position sortiert wird (Slot-Listen, Tabellenspalten).
function comparePositionSlots(a, b) {
  var pa = parsePositionSlot(a);
  var pb = parsePositionSlot(b);
  var ia = POSITION_ORDER.indexOf(pa.code);
  var ib = POSITION_ORDER.indexOf(pb.code);
  if (ia === -1 && ib === -1) return pa.code === pb.code ? 0 : pa.code.localeCompare(pb.code);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  if (ia !== ib) return ia - ib;
  var sa = pa.side ? SIDE_ORDER.indexOf(pa.side) : -1;
  var sb = pb.side ? SIDE_ORDER.indexOf(pb.side) : -1;
  if (sa === -1 && sb === -1) return 0;
  if (sa === -1) return -1;
  if (sb === -1) return 1;
  return sa - sb;
}

function sortBySlotOrder(slots) {
  return slots.slice().sort(comparePositionSlots);
}

// Numerischer Rang für "Sortieren nach Position auf dem Feld" (TW -> Abwehr ->
// Mittelfeld -> Sturm, innerhalb einer Position links -> zentral -> rechts).
// Nutzt die Idealposition des Spielers (immer eine einzelne Position, anders als
// das oft mehrere Positionen umfassende Positionsfeld).
function positionSortRank(player) {
  var slot = parsePositionSlot(player.idealPosition || '');
  var codeRank = POSITION_ORDER.indexOf(slot.code);
  var sideRank = slot.side ? SIDE_ORDER.indexOf(slot.side) : -1;
  if (codeRank === -1) return POSITION_ORDER.length * 10;
  return codeRank * 10 + (sideRank === -1 ? 5 : sideRank);
}

// Annahme/Vermutung zur Reihenfolge der FM26-Einsatzstatus-Kategorien nach Einsatzzeit
// (viel -> wenig). Nicht offiziell bestätigt - bei Bedarf hier einfach anpassen.
var PLAYING_TIME_ORDER = [
  'Starspieler',
  'Schlüsselspieler',
  'Stammspieler',
  'Rotationsspieler',
  'Joker',
  'Ergänzungsspieler',
  'Talent vor Durchbruch',
  'Nachwuchsspieler',
  'Nicht benötigt'
];

// Rang eines Einsatzstatus in PLAYING_TIME_ORDER (0 = meiste Einsatzzeit).
// Unbekannte Werte bekommen den schlechtesten Rang.
function statusRank(status) {
  var idx = PLAYING_TIME_ORDER.indexOf(status);
  return idx === -1 ? PLAYING_TIME_ORDER.length : idx;
}

function sortByPlayingTime(values) {
  return values.slice().sort(function (a, b) {
    var ia = PLAYING_TIME_ORDER.indexOf(a);
    var ib = PLAYING_TIME_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
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
      positionSlots: extractPositionSlots(record['Position']),
      age: isNaN(age) ? null : age,
      contractEnd: parseGermanDate(record['Endet']),
      contractEndRaw: record['Endet'] || '',
      salary: parseGehalt(record['Gehalt']),
      salaryRaw: record['Gehalt'] || '',
      marketValue: parseMarketValue(record['Transferwert']),
      marketValueRaw: record['Transferwert'] || '',
      rating: parseGermanDecimal(record['Durchschnittsnote – Verein']),
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
    if (filters.positions && filters.positions.length > 0) {
      var matches = p.positionSlots.some(function (slot) {
        return filters.positions.indexOf(slot) !== -1;
      });
      if (!matches) return false;
    }
    if (filters.ageMin != null && (p.age == null || p.age < filters.ageMin)) return false;
    if (filters.ageMax != null && (p.age == null || p.age > filters.ageMax)) return false;
    if (filters.contractBefore && (!p.contractEnd || p.contractEnd > filters.contractBefore)) return false;
    if (filters.status && p.statusActual !== filters.status) return false;
    if (filters.attrColumns && filters.attrColumns.length > 0 && filters.attrMin != null) {
      var passesAll = filters.attrColumns.every(function (col) {
        var val = parseInt(p.raw[col], 10);
        return !isNaN(val) && val >= filters.attrMin;
      });
      if (!passesAll) return false;
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
