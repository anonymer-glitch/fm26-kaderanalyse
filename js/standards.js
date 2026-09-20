// Logik-Schicht: Rangliste für Standardsituationen (Eckbälle, Freistöße,
// Elfmeter) und Führung (Kapitän/Stellvertreter). Nutzt die echten FM-Attribute
// dafür (Freistöße, Elfmeter, Führungsqualitäten), sofern im Export vorhanden -
// fehlen sie (ältere/kleinere Exports), bleibt die Vorauswahl einfach leer und
// kann unten manuell (z.B. mit Ersatz-Attributen) gefüllt werden. Keine feste
// Bewertungsformel, alles über die Oberfläche anpassbar.
var STANDARDS_ATTRIBUTE_DEFAULTS = {
  corners: ['Ecken'],
  freeKicks: ['Freistöße'],
  penalties: ['Elfmeter'],
  leadership: ['Führungsqualitäten']
};

var STANDARDS_CATEGORIES = [
  { key: 'corners', label: 'Eckbälle' },
  { key: 'freeKicks', label: 'Freistöße' },
  { key: 'penalties', label: 'Elfmeter' },
  { key: 'leadership', label: 'Führung / Kapitän' }
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
      var val = parseGermanDecimal(p.raw[a]);
      if (val != null) {
        sum += val;
        count++;
      }
    });
    return { player: p, average: count > 0 ? sum / count : null };
  }).filter(function (r) { return r.average != null; });

  ranked.sort(function (a, b) { return b.average - a.average; });
  return topN ? ranked.slice(0, topN) : ranked;
}
