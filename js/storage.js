// Logik-Schicht: automatische Speicherung im Browser (localStorage) + manuelles
// Backup als Datei. Rein browserseitig, keine Cloud/kein Server (siehe README
// "Persistenz"-Entscheidung). Jeder Zugriff ist try/catch-abgesichert, da
// localStorage z.B. im privaten Modus oder bei vollem Speicher werfen kann -
// ein Fehler hier darf die App nie zum Absturz bringen, nur die
// Auto-Speicherung fällt dann eben aus.
var STORAGE_PREFIX = 'fm26-kaderanalyse:';

function storageSet(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch (e) {
    // Speicher nicht verfügbar - ignorieren, App läuft einfach ohne Auto-Speicherung weiter.
  }
}

function storageGet(key) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch (e) {
    return null;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    // ignorieren
  }
}

// Gibt null zurück, wenn kein gespeicherter Kader vorliegt. importedAt ist ein
// ISO-Zeitstempel (wann diese Datei hochgeladen wurde) oder null bei ganz alten
// Speicherständen von vor dieser Funktion.
function loadCsvFromStorage() {
  var csvText = storageGet('csvText');
  if (!csvText) return null;
  return {
    fileName: storageGet('csvFileName') || 'gespeicherter-kader.csv',
    csvText: csvText,
    importedAt: storageGet('csvImportedAt') || null
  };
}

function loadPreviousCsvFromStorage() {
  var csvText = storageGet('previousCsvText');
  if (!csvText) return null;
  return {
    fileName: storageGet('previousCsvFileName') || 'vorheriger-import.csv',
    csvText: csvText,
    importedAt: storageGet('previousCsvImportedAt') || null
  };
}

// Bei einem NEUEN Import (nicht beim bloßen Wiederladen aus dem Speicher): der
// bisherige "aktuelle" Stand rückt eine Stufe zurück zum "vorherigen" Stand (nur
// diese eine Stufe, kein voller Verlauf), der neue Import wird "aktuell". Gibt
// den alten Stand zurück, damit der Aufrufer ihn direkt als Vergleichs-/
// Fallback-Basis für den neuen Import nutzen kann, ohne den Speicher doppelt zu lesen.
function rotateAndSaveCsvToStorage(fileName, csvText) {
  var old = loadCsvFromStorage();
  if (old) {
    storageSet('previousCsvFileName', old.fileName);
    storageSet('previousCsvText', old.csvText);
    storageSet('previousCsvImportedAt', old.importedAt || '');
  }
  storageSet('csvFileName', fileName);
  storageSet('csvText', csvText);
  storageSet('csvImportedAt', new Date().toISOString());
  // Abgehakte Entscheidungs-Hinweise gehören zum aktuellen Import - bei einem
  // neuen Import ändert sich die Datenbasis ohnehin, alte Häkchen wären nicht
  // mehr aussagekräftig (siehe loadResolvedHintsSet weiter unten).
  storageRemove('resolvedHints');
  return old;
}

// Für die Sicherungsdatei: setzt beide Stände exakt so, wie sie in der Datei
// stehen (keine Rotation) - ein Restore soll den exportierten Stand 1:1 wiederherstellen.
function restoreCsvSlotsFromBackup(current, previous) {
  if (current && current.csvText) {
    storageSet('csvFileName', current.fileName || '');
    storageSet('csvText', current.csvText);
    storageSet('csvImportedAt', current.importedAt || '');
  }
  if (previous && previous.csvText) {
    storageSet('previousCsvFileName', previous.fileName || '');
    storageSet('previousCsvText', previous.csvText);
    storageSet('previousCsvImportedAt', previous.importedAt || '');
  } else {
    storageRemove('previousCsvFileName');
    storageRemove('previousCsvText');
    storageRemove('previousCsvImportedAt');
  }
}

function saveTacticMarkersToStorage(markers) {
  storageSet('tacticMarkers', JSON.stringify(markers));
}

function loadTacticMarkersFromStorage() {
  var raw = storageGet('tacticMarkers');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveReferenceDateToStorage(value) {
  storageSet('referenceDate', value || '');
}

function loadReferenceDateFromStorage() {
  return storageGet('referenceDate') || '';
}

// Notizen je Spieler, verknüpft über "Unique ID" - bleiben über Re-Importe
// hinweg erhalten (anders als der Kaderstand selbst, der bei jedem Import
// überschrieben wird). Wird sowohl vom Dashboard-Tab als auch vom separaten
// Spielerprofil-Tab genutzt (siehe profile.js) - beide teilen sich denselben
// localStorage, ein "storage"-Event hält den Dashboard-Tab bei Änderungen im
// Profil-Tab auf dem Laufenden (siehe app.js).
function loadNotesMap() {
  var raw = storageGet('notes');
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function saveNoteForPlayer(id, text) {
  if (id == null) return;
  var notes = loadNotesMap();
  if (text) {
    notes[id] = text;
  } else {
    delete notes[id];
  }
  storageSet('notes', JSON.stringify(notes));
}

// Abgehakte Entscheidungs-Hinweise ("erledigt für diesen Import") - anders als
// Notizen NICHT über Re-Importe hinweg gültig, da sich die Datenbasis dann
// ändert (siehe rotateAndSaveCsvToStorage, das dies bei jedem neuen Import
// leert). Schlüssel sind z.B. "Vertrag prüfen:123" oder "handlungsbedarf:TW".
function loadResolvedHintsSet() {
  var raw = storageGet('resolvedHints');
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function saveResolvedHintsSet(set) {
  storageSet('resolvedHints', JSON.stringify(set));
}

function clearStoredKader() {
  storageRemove('csvFileName');
  storageRemove('csvText');
  storageRemove('csvImportedAt');
  storageRemove('previousCsvFileName');
  storageRemove('previousCsvText');
  storageRemove('previousCsvImportedAt');
  storageRemove('tacticMarkers');
  storageRemove('referenceDate');
  storageRemove('notes');
  storageRemove('resolvedHints');
}

// Backup-Datei: fasst den gesamten gespeicherten Stand in einem JSON-Objekt
// zusammen, das der Nutzer selbst sichern kann (z.B. in einem Cloud-Ordner) -
// unabhängig vom Browser-Speicher, für Rechnerwechsel oder falls der
// Browser-Speicher mal verloren geht.
function buildBackupPayload() {
  var csv = loadCsvFromStorage();
  var previous = loadPreviousCsvFromStorage();
  return JSON.stringify({
    format: 'fm26-kaderanalyse-backup',
    version: 2,
    csvFileName: csv ? csv.fileName : null,
    csvText: csv ? csv.csvText : null,
    csvImportedAt: csv ? csv.importedAt : null,
    previousCsvFileName: previous ? previous.fileName : null,
    previousCsvText: previous ? previous.csvText : null,
    previousCsvImportedAt: previous ? previous.importedAt : null,
    tacticMarkers: loadTacticMarkersFromStorage(),
    referenceDate: loadReferenceDateFromStorage(),
    notes: loadNotesMap(),
    resolvedHints: loadResolvedHintsSet()
  }, null, 2);
}

function parseBackupPayload(text) {
  var data = JSON.parse(text);
  if (!data || data.format !== 'fm26-kaderanalyse-backup') {
    throw new Error('Keine gültige Sicherungsdatei.');
  }
  return data;
}
