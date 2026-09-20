// Logik-Schicht: "Leistung je Position" - im Unterschied zu Qualität je Position
// (Attribute/Potenzial, alle auf derselben 1-20-Skala) geht es hier um echte
// Saison-Leistungsdaten auf ganz unterschiedlichen Skalen (Note ~6-8, Prozentwerte
// 0-100, Pro-90-Raten 0-10). Diese Werte lassen sich NICHT sinnvoll zu einem
// einzigen Ø mitteln (unterschiedliche Skalen würden sich gegenseitig verzerren).
// Deshalb: jede gewählte Kennzahl bekommt ihre eigene Spalte/ihren eigenen
// Positions-Durchschnitt, statt in einen Blend-Wert einzufließen.
var PERFORMANCE_ATTRIBUTE_DEFAULTS = ['Durchschnittsnote – Verein'];

// Spalten, die (auch) Dezimalwerte enthalten können und deshalb nicht sicher in
// den generisch erkannten Ganzzahl-Spalten (numericColumns) landen - werden für
// die Kennzahlen-Auswahl trotzdem angeboten, sofern im Export vorhanden.
var PERFORMANCE_DECIMAL_COLUMNS = [
  'Durchschnittsnote – Verein', 'Abgewehrte Bälle pro 90 Minuten', 'Geklärte Bälle pro 90 Minuten',
  'Ballgewinne pro 90 Minuten', 'Lauf/90', 'Dribblings / 90', 'Sprints/90', 'xG', 'Elfmeterquote'
];

// Absolute Zähler (keine Rate/kein Prozentwert), die vor der Mittelwertbildung
// auf "pro 90 Minuten" umgerechnet werden - sonst hätte ein Vielspieler allein
// durch mehr Einsatzzeit automatisch höhere Werte als ein Teilzeitspieler.
var PERFORMANCE_PER90_STATS = [
  'Gewonnene Zweikämpfe', 'Entscheidende Zweikämpfe', 'Schüsse', 'Erspielte Großchancen',
  'Versuchte Flanken', 'Fouls', 'Gefoult worden', 'Tore', 'Zu-Null-Spiele', 'Spieler des Spiels'
];

function performanceAttributeOptions(headers, numericColumns) {
  var options = numericColumns.slice();
  PERFORMANCE_DECIMAL_COLUMNS.forEach(function (col) {
    if (headers.indexOf(col) !== -1 && options.indexOf(col) === -1) {
      options.push(col);
    }
  });
  return options;
}

function defaultPerformanceAttributes(availableColumns) {
  return PERFORMANCE_ATTRIBUTE_DEFAULTS.filter(function (a) { return availableColumns.indexOf(a) !== -1; });
}

// Liest den Wert eines Spielers für eine Leistungskennzahl - rechnet absolute
// Zähler (PERFORMANCE_PER90_STATS) auf "pro 90 Minuten" um, alles andere
// (Raten, Prozentwerte, Durchschnittsnote, bereits-pro-90-Werte) unverändert.
function performanceValueOf(player, attrName) {
  var raw = parseGermanDecimal(player.raw[attrName]);
  if (raw == null) return null;
  if (PERFORMANCE_PER90_STATS.indexOf(attrName) !== -1) {
    return player.totalMinutes ? (raw * 90 / player.totalMinutes) : null;
  }
  return raw;
}

// Für jeden Positions-Slot: Spieleranzahl plus je gewählter Kennzahl deren
// eigener Positions-Durchschnitt (kein Blend-Wert über mehrere Kennzahlen).
function computePositionMetrics(players, attrs, valueOf) {
  var slots = sortBySlotOrder(collectPositionSlots(players));

  return slots.map(function (slot) {
    var relevantPlayers = players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    });

    var metrics = {};
    attrs.forEach(function (a) {
      var values = relevantPlayers.map(function (p) { return valueOf(p, a); }).filter(function (v) { return v != null; });
      metrics[a] = values.length > 0 ? values.reduce(function (x, y) { return x + y; }, 0) / values.length : null;
    });

    return { code: slot, playerCount: relevantPlayers.length, metrics: metrics };
  });
}
