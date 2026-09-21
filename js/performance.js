// Logik-Schicht: "Leistung je Position" - im Unterschied zu Qualität je Position
// (Attribute/Potenzial, alle auf derselben 1-20-Skala) geht es hier um echte
// Saison-Leistungsdaten auf ganz unterschiedlichen Skalen (Note ~6-8, Prozentwerte
// 0-100, Pro-90-Raten 0-10). Diese Werte lassen sich NICHT sinnvoll zu einem
// einzigen Ø mitteln (unterschiedliche Skalen würden sich gegenseitig verzerren).
// Deshalb: jede gewählte Kennzahl bekommt ihre eigene Spalte/ihren eigenen
// Positions-Durchschnitt, statt in einen Blend-Wert einzufließen.
//
// Die Durchschnittsnote ist immer und für jede Position fest dabei (fixe Spalte
// in app.js, siehe PERFORMANCE_PINNED_ATTRIBUTE) - sie ist bereits ein von FM
// positionsbewusst berechneter Wert und reicht für den schnellen Überblick.
// Alles andere hier ist rein manuell zuwählbar (kein Startpunkt mehr
// vorausgewählt), nur die Reihenfolge der Checkboxen ist je Position thematisch
// sortiert (z.B. Zweikampf-Werte zuerst bei Verteidigern), damit man bei Bedarf
// schnell die passende Kennzahl findet.

var PERFORMANCE_PINNED_ATTRIBUTE = 'Durchschnittsnote – Verein';

// Echte Saison-Leistungsdaten - bewusst getrennt von den FM-Attributen (Technik,
// Tackling, Freistöße, Führungsqualitäten, ...), die zu Qualität je Position und
// Standardsituationen gehören, nicht hierher. Thematisch gruppiert; die
// Reihenfolge INNERHALB einer Gruppe ist die Anzeige-Reihenfolge in der Auswahl.
var PERFORMANCE_CATEGORIES = [
  {
    key: 'zweikampf',
    label: 'Zweikampf & Verteidigung',
    columns: [
      'Anteil erfolgreicher Zweikämpfe', 'Gewonnene Zweikämpfe', 'Entscheidende Zweikämpfe',
      'Geklärte Bälle pro 90 Minuten', 'Prozentual gewonnene Kopfbälle', 'Versuchte Kopfballduelle',
      'Ballgewinne pro 90 Minuten', 'Blk', 'Fehler mit Torfolge', 'PrsErf', 'PrsV'
    ]
  },
  {
    key: 'fluegel',
    label: 'Flügel & Flanken',
    columns: ['Anteil angekommener Flanken aus dem Spiel', 'Versuchte Flanken']
  },
  {
    key: 'offensive',
    label: 'Offensive & Torgefahr',
    columns: [
      'Tore', 'Anteil Schüsse aufs Tor', 'Schüsse', 'xG', 'Erspielte Großchancen',
      'Dribblings / 90', 'Sprints/90', 'Elfmeter insgesamt', 'Elfmeterquote'
    ]
  },
  {
    key: 'torwart',
    label: 'Torwart',
    columns: ['Abgewehrte Bälle pro 90 Minuten', 'Zu-Null-Spiele', 'Parierte Elfmeter']
  },
  {
    key: 'allgemein',
    label: 'Allgemein',
    columns: [
      'Lauf/90', 'Gefoult worden', 'Fouls', 'Gelbe Karten', 'Rote Karten',
      'Gewonnene Spiele (%)', 'Spieler des Spiels', 'Start11'
    ]
  }
];

// Je Wurzel-Position, welche Kategorie zuerst in der Checkbox-Liste steht (Rest
// folgt in der Reihenfolge oben). Eine Annahme zur fußballerischen Relevanz -
// über die Kategorien-Zuordnung oben jederzeit anpassbar.
var PERFORMANCE_CATEGORY_PRIORITY = {
  TW: ['torwart', 'allgemein', 'zweikampf', 'fluegel', 'offensive'],
  V: ['zweikampf', 'allgemein', 'fluegel', 'offensive', 'torwart'],
  FV: ['fluegel', 'zweikampf', 'allgemein', 'offensive', 'torwart'],
  DM: ['zweikampf', 'allgemein', 'offensive', 'fluegel', 'torwart'],
  M: ['zweikampf', 'offensive', 'allgemein', 'fluegel', 'torwart'],
  OM: ['offensive', 'fluegel', 'zweikampf', 'allgemein', 'torwart'],
  ST: ['offensive', 'allgemein', 'zweikampf', 'fluegel', 'torwart']
};

// Alle echten Leistungsspalten (unabhängig von Position), sofern im Export vorhanden.
function performanceAttributeOptions(headers) {
  var options = [];
  PERFORMANCE_CATEGORIES.forEach(function (cat) {
    cat.columns.forEach(function (col) {
      if (headers.indexOf(col) !== -1 && options.indexOf(col) === -1) {
        options.push(col);
      }
    });
  });
  return options;
}

// Dieselben Spalten wie performanceAttributeOptions, aber je Position so
// sortiert, dass die für diese Position wichtigste Kategorie zuerst kommt.
function performanceAttributeOptionsForPosition(headers, rootCode) {
  var order = PERFORMANCE_CATEGORY_PRIORITY[rootCode] || PERFORMANCE_CATEGORIES.map(function (c) { return c.key; });
  var byKey = {};
  PERFORMANCE_CATEGORIES.forEach(function (cat) { byKey[cat.key] = cat; });

  var options = [];
  order.forEach(function (key) {
    var cat = byKey[key];
    if (!cat) return;
    cat.columns.forEach(function (col) {
      if (headers.indexOf(col) !== -1 && options.indexOf(col) === -1) {
        options.push(col);
      }
    });
  });
  return options;
}

// Absolute Zähler (keine Rate/kein Prozentwert), die vor der Mittelwertbildung
// auf "pro 90 Minuten" umgerechnet werden - sonst hätte ein Vielspieler allein
// durch mehr Einsatzzeit automatisch höhere Werte als ein Teilzeitspieler.
var PERFORMANCE_PER90_STATS = [
  'Gewonnene Zweikämpfe', 'Entscheidende Zweikämpfe', 'Schüsse', 'Erspielte Großchancen',
  'Versuchte Flanken', 'Fouls', 'Gefoult worden', 'Tore', 'Zu-Null-Spiele', 'Spieler des Spiels'
];

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

// attrsByCode ist je Wurzel-Position eine eigene Kennzahlen-Liste. Für jeden
// Positions-Slot: Spieleranzahl plus je Kennzahl deren eigener Positions-
// Durchschnitt (kein Blend-Wert über mehrere Kennzahlen). neededSlots kommt
// vom Taktik-Board (state.neededPositionCounts) - siehe computePositionQuality
// in quality.js für dieselbe Einschränkung/Begründung.
function computePositionMetrics(players, attrsByCode, neededSlots, valueOf) {
  var slots = sortBySlotOrder(neededSlots.map(function (n) { return n.slot; }));

  return slots.map(function (slot) {
    var rootCode = parsePositionSlot(slot).code;
    var attrs = attrsByCode[rootCode] || [];
    var relevantPlayers = playersMatchingSlot(players, slot);

    var metrics = {};
    attrs.forEach(function (a) {
      var values = relevantPlayers.map(function (p) { return valueOf(p, a); }).filter(function (v) { return v != null; });
      metrics[a] = values.length > 0 ? values.reduce(function (x, y) { return x + y; }, 0) / values.length : null;
    });

    return { code: slot, playerCount: relevantPlayers.length, metrics: metrics };
  });
}
