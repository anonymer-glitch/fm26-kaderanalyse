// Logik-Schicht: durchschnittliche "Qualität" je Position, basierend auf frei
// wählbaren Attributen. Es gibt keine feste Bewertungsformel - der Nutzer legt
// über die Oberfläche fest, welche Attribute je Position zählen. Die Werte
// unten sind nur ein Vorschlag/Startpunkt (aus FM-Community-Guides, angepasst
// an das, was im jeweiligen Export tatsächlich vorhanden ist).
var QUALITY_ATTRIBUTE_DEFAULTS = {
  TW: ['Reflexe', 'Eins gegen Eins', 'Sprunghöhe', 'Strafraumkontrolle', 'Entscheidungen'],
  V: ['Sprunghöhe', 'Tackling', 'Nervenstärke', 'Kraft', 'Deckung'],
  FV: ['Ausdauer', 'Schnelligkeit', 'Tackling', 'Passen'],
  DM: ['Ballannahme', 'Teamwork', 'Nervenstärke', 'Passen', 'Tackling'],
  M: ['Passen', 'Entscheidungen', 'Übersicht', 'Ausdauer'],
  OM: ['Übersicht', 'Ballannahme', 'Technik', 'Dribbling', 'Balance', 'Schnelligkeit'],
  ST: ['Abschluss', 'Ballannahme', 'Nervenstärke', 'Kopfballtechnik']
};

// Beschränkt den Vorschlag auf Attribute, die im aktuellen Export tatsächlich vorhanden sind.
function defaultQualityAttributes(rootCode, availableColumns) {
  var suggested = QUALITY_ATTRIBUTE_DEFAULTS[rootCode] || [];
  return suggested.filter(function (a) { return availableColumns.indexOf(a) !== -1; });
}

function rootCodesForPlayer(player) {
  var seen = {};
  var result = [];
  player.positionSlots.forEach(function (slot) {
    var code = parsePositionSlot(slot).code;
    if (!seen[code]) {
      seen[code] = true;
      result.push(code);
    }
  });
  return result;
}

function collectRootPositionCodes(players) {
  var seen = {};
  var result = [];
  players.forEach(function (p) {
    rootCodesForPlayer(p).forEach(function (code) {
      if (!seen[code]) {
        seen[code] = true;
        result.push(code);
      }
    });
  });
  return result.sort(function (a, b) {
    var ia = POSITION_ORDER.indexOf(a);
    var ib = POSITION_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// qualityAttributesByCode ist je Wurzel-Position (z.B. "V"), gilt also für alle
// Seiten gleich ("V (L)"/"V (Z)"/"V (R)" nutzen dieselbe Attributauswahl) - nur
// die Ergebnis-Aufschlüsselung erfolgt je Seite, da z.B. "V" als Ganzes eine
// dünne linke Seite verstecken kann (siehe Positionslücken).
// valueOf(player, attributeName) liest optional einen anderen Wert als den
// rohen Spaltenwert aus (z.B. Pro-90-Umrechnung bei Leistungsdaten, siehe
// performance.js) - Standard: einfach die Spalte als Dezimalzahl lesen.
// Ergebnis pro Positions-Slot: Spieleranzahl, Anzahl genutzter Attribute, Ø-Wert
// (1-20, wie FM-Attribute selbst), sortiert von stärkster zu schwächster Position.
function computePositionQuality(players, qualityAttributesByCode, valueOf) {
  valueOf = valueOf || function (p, a) { return parseGermanDecimal(p.raw[a]); };
  var slots = sortBySlotOrder(collectPositionSlots(players));

  var results = slots.map(function (slot) {
    var rootCode = parsePositionSlot(slot).code;
    var attrs = qualityAttributesByCode[rootCode] || [];
    var relevantPlayers = players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    });

    var playerAverages = relevantPlayers.map(function (p) {
      var sum = 0;
      var count = 0;
      attrs.forEach(function (a) {
        var val = valueOf(p, a);
        if (val != null) {
          sum += val;
          count++;
        }
      });
      return count > 0 ? sum / count : null;
    }).filter(function (v) { return v != null; });

    var average = playerAverages.length > 0
      ? playerAverages.reduce(function (a, b) { return a + b; }, 0) / playerAverages.length
      : null;

    return { code: slot, playerCount: relevantPlayers.length, attributeCount: attrs.length, average: average };
  });

  results.sort(function (a, b) {
    if (a.average == null && b.average == null) return 0;
    if (a.average == null) return 1;
    if (b.average == null) return -1;
    return b.average - a.average;
  });

  return results;
}
