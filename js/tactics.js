// Logik-Schicht: Taktik-Board für die Positionslücken-Analyse. Der Nutzer stellt
// seine Formation auf einem Fußballfeld zusammen (Preset oder frei per Drag & Drop) -
// daraus leiten wir die "benötigten Positionen" ab, die computePositionGaps
// (siehe hints.js) für die Lücken-Analyse nutzt.

// Reihenfolge, in der die Preset-Buttons angezeigt werden.
var FORMATION_ORDER = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2 (Dreierkette)', '5-3-2', '4-1-4-1'];

// Koordinaten in Prozent (x: 0=links, 100=rechts; y: 0=Angriff/oben, 100=eigenes Tor/unten) -
// passend zu einem hochkant dargestellten Feld wie im FM-Taktikbildschirm. Nur ein
// Startpunkt pro Formation, danach frei per Drag & Drop anpassbar.
var FORMATIONS = {
  '4-4-2': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 15, y: 78 }, { code: 'V', x: 38, y: 78 }, { code: 'V', x: 62, y: 78 }, { code: 'V', x: 85, y: 78 },
    { code: 'M', x: 15, y: 48 }, { code: 'M', x: 38, y: 48 }, { code: 'M', x: 62, y: 48 }, { code: 'M', x: 85, y: 48 },
    { code: 'ST', x: 38, y: 18 }, { code: 'ST', x: 62, y: 18 }
  ],
  '4-3-3': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 15, y: 78 }, { code: 'V', x: 38, y: 78 }, { code: 'V', x: 62, y: 78 }, { code: 'V', x: 85, y: 78 },
    { code: 'DM', x: 50, y: 58 }, { code: 'M', x: 32, y: 50 }, { code: 'M', x: 68, y: 50 },
    { code: 'OM', x: 15, y: 22 }, { code: 'ST', x: 50, y: 15 }, { code: 'OM', x: 85, y: 22 }
  ],
  '4-2-3-1': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 15, y: 78 }, { code: 'V', x: 38, y: 78 }, { code: 'V', x: 62, y: 78 }, { code: 'V', x: 85, y: 78 },
    { code: 'DM', x: 35, y: 58 }, { code: 'DM', x: 65, y: 58 },
    { code: 'OM', x: 15, y: 32 }, { code: 'OM', x: 50, y: 28 }, { code: 'OM', x: 85, y: 32 },
    { code: 'ST', x: 50, y: 15 }
  ],
  '3-5-2 (Dreierkette)': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 30, y: 80 }, { code: 'V', x: 50, y: 84 }, { code: 'V', x: 70, y: 80 },
    { code: 'FV', x: 10, y: 60 }, { code: 'FV', x: 90, y: 60 },
    { code: 'M', x: 30, y: 48 }, { code: 'M', x: 50, y: 52 }, { code: 'M', x: 70, y: 48 },
    { code: 'ST', x: 38, y: 18 }, { code: 'ST', x: 62, y: 18 }
  ],
  '5-3-2': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 30, y: 80 }, { code: 'V', x: 50, y: 84 }, { code: 'V', x: 70, y: 80 },
    { code: 'FV', x: 12, y: 60 }, { code: 'FV', x: 88, y: 60 },
    { code: 'M', x: 30, y: 50 }, { code: 'M', x: 50, y: 50 }, { code: 'M', x: 70, y: 50 },
    { code: 'ST', x: 38, y: 18 }, { code: 'ST', x: 62, y: 18 }
  ],
  '4-1-4-1': [
    { code: 'TW', x: 50, y: 95 },
    { code: 'V', x: 15, y: 78 }, { code: 'V', x: 38, y: 78 }, { code: 'V', x: 62, y: 78 }, { code: 'V', x: 85, y: 78 },
    { code: 'DM', x: 50, y: 60 },
    { code: 'M', x: 15, y: 42 }, { code: 'M', x: 38, y: 45 }, { code: 'M', x: 62, y: 45 }, { code: 'M', x: 85, y: 42 },
    { code: 'ST', x: 50, y: 18 }
  ]
};

// Positionscodes, bei denen die Seite (links/zentral/rechts) für die Lücken-Analyse
// eine Rolle spielt - TW/DM/ST kommen in den FM26-Daten üblicherweise ohne
// Seitenangabe vor (siehe extractPositionSlots in players.js).
var TACTICS_SIDED_CODES = ['V', 'FV', 'M', 'OM'];

// Grenzen der drei Zonen in Prozent der Feldbreite - z.B. macht ein "V"-Marker
// links von TACTICS_ZONE_BOUNDARIES[0] einen Außenverteidiger ("V (L)"), einer
// dazwischen einen Innenverteidiger ("V (Z)"). Auch fürs Einzeichnen der
// Zonenlinien auf dem Board genutzt (siehe renderTacticsBoard in app.js).
var TACTICS_ZONE_BOUNDARIES = [38, 62];

function tacticsSideForX(x) {
  if (x < TACTICS_ZONE_BOUNDARIES[0]) return 'L';
  if (x > TACTICS_ZONE_BOUNDARIES[1]) return 'R';
  return 'Z';
}

// Zeilen-Raster (y-Achse): welche Linie auf dem Feld welchen Code ergibt, wenn man
// einen Marker dorthin zieht. "resolveCode(zone)" liefert den Code für die Spalte
// (L/Z/R) innerhalb dieser Zeile - z.B. ergibt die DM-Zeile in der Mitte "DM", außen
// aber "FV" (Flügelverteidiger sitzen auf Höhe des defensiven Mittelfelds, aber
// außen; DM bleibt dadurch rein zentral). Nur für Drag & Drop relevant (siehe
// makeMarkerDraggable in app.js) - Formations-Presets setzen ihren Code direkt und
// unabhängig davon.
var TACTICS_Y_ROWS = [
  { min: 84, label: 'TW', resolveCode: function () { return 'TW'; } },
  { min: 64, label: 'V', resolveCode: function () { return 'V'; } },
  { min: 50, label: 'DM / FV', resolveCode: function (zone) { return zone === 'Z' ? 'DM' : 'FV'; } },
  { min: 33, label: 'M', resolveCode: function () { return 'M'; } },
  { min: 18, label: 'OM', resolveCode: function () { return 'OM'; } },
  { min: 0, label: 'ST', resolveCode: function () { return 'ST'; } }
];

function tacticsRowForY(y) {
  for (var i = 0; i < TACTICS_Y_ROWS.length; i++) {
    if (y >= TACTICS_Y_ROWS[i].min) return TACTICS_Y_ROWS[i];
  }
  return TACTICS_Y_ROWS[TACTICS_Y_ROWS.length - 1];
}

// Code für einen Marker, der nach (x,y) gezogen wurde - Zeile (y) legt die
// Positions-Art fest, Spalte (x) innerhalb der Zeile kann sie weiter verfeinern
// (z.B. DM-Zeile: zentral -> "DM", außen -> "FV").
function tacticsCodeForPosition(x, y) {
  var row = tacticsRowForY(y);
  return row.resolveCode(tacticsSideForX(x));
}

// Wandelt einen Marker in den Positions-Slot-String, den computePositionGaps &
// Co. erwarten (z.B. "V (L)", "DM").
function markerToSlot(marker) {
  if (TACTICS_SIDED_CODES.indexOf(marker.code) === -1) return marker.code;
  return marker.code + ' (' + tacticsSideForX(marker.x) + ')';
}

var tacticsMarkerIdCounter = 0;
function nextTacticsMarkerId() {
  tacticsMarkerIdCounter += 1;
  return 'marker-' + tacticsMarkerIdCounter;
}

// Erzeugt frische Marker-Objekte (mit eigener ID) für ein Formations-Preset.
function formationMarkers(name) {
  var preset = FORMATIONS[name] || [];
  return preset.map(function (m) {
    return { id: nextTacticsMarkerId(), code: m.code, x: m.x, y: m.y };
  });
}

// Wie viele Starter pro Positions-Slot aktuell auf dem Board stehen (mehrere
// Marker im selben Slot, z.B. 2x "V" in der Zentral-Zone, zählen als 2 Starter
// auf "V (Z)") - Grundlage für die Kadertiefe-Prüfung in computePositionGaps.
function neededPositionCountsFromMarkers(markers) {
  var counts = {};
  markers.forEach(function (m) {
    var slot = markerToSlot(m);
    counts[slot] = (counts[slot] || 0) + 1;
  });
  return sortBySlotOrder(Object.keys(counts)).map(function (slot) {
    return { slot: slot, count: counts[slot] };
  });
}
