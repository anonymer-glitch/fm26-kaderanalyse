// Logik-Schicht: Rangliste für Standardsituationen (Eckbälle, Freistöße,
// Elfmeter) und Führung (Kapitän/Stellvertreter). FM kennt eigene Attribute für
// Freistöße, Elfmeter und Führungsqualität - die sind in vielen Exports (auch
// diesem) nicht enthalten. Die Vorschläge unten sind deshalb eine Näherung mit
// ähnlichen, tatsächlich vorhandenen Attributen - über die Oberfläche anpassbar,
// keine feste Bewertungsformel.
var STANDARDS_ATTRIBUTE_DEFAULTS = {
  corners: ['Ecken'],
  freeKicks: ['Weitschüsse', 'Technik'],
  penalties: ['Abschluss', 'Nervenstärke'],
  leadership: ['Nervenstärke', 'Entscheidungen', 'Teamwork', 'Antizipation']
};

var STANDARDS_CATEGORIES = [
  { key: 'corners', label: 'Eckbälle' },
  { key: 'freeKicks', label: 'Freistöße (Näherung, kein Freistoß-Attribut im Export)' },
  { key: 'penalties', label: 'Elfmeter (Näherung, kein Elfmeter-Attribut im Export)' },
  { key: 'leadership', label: 'Führung / Kapitän (Näherung, kein Führungsqualität-Attribut im Export)' }
];

function defaultStandardsAttributes(category, availableColumns) {
  var suggested = STANDARDS_ATTRIBUTE_DEFAULTS[category] || [];
  return suggested.filter(function (a) { return availableColumns.indexOf(a) !== -1; });
}

// Rangliste (höchster Ø-Wert zuerst) der Spieler nach Ø der gewählten Attribute.
// Spieler ohne gültigen Wert für keines der Attribute werden ausgelassen.
function computeStandardsRanking(players, attrs, topN) {
  var ranked = players.map(function (p) {
    var sum = 0;
    var count = 0;
    attrs.forEach(function (a) {
      var val = parseInt(p.raw[a], 10);
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    });
    return { player: p, average: count > 0 ? sum / count : null };
  }).filter(function (r) { return r.average != null; });

  ranked.sort(function (a, b) { return b.average - a.average; });
  return topN ? ranked.slice(0, topN) : ranked;
}
