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

// Gibt null zurück, wenn kein gespeicherter Kader vorliegt.
function loadCsvFromStorage() {
  var csvText = storageGet('csvText');
  if (!csvText) return null;
  return { fileName: storageGet('csvFileName') || 'gespeicherter-kader.csv', csvText: csvText };
}

function loadPreviousCsvFromStorage() {
  var csvText = storageGet('previousCsvText');
  if (!csvText) return null;
  return { fileName: storageGet('previousCsvFileName') || 'vorheriger-import.csv', csvText: csvText };
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
  }
  storageSet('csvFileName', fileName);
  storageSet('csvText', csvText);
  return old;
}

// Für die Sicherungsdatei: setzt beide Stände exakt so, wie sie in der Datei
// stehen (keine Rotation) - ein Restore soll den exportierten Stand 1:1 wiederherstellen.
function restoreCsvSlotsFromBackup(current, previous) {
  if (current && current.csvText) {
    storageSet('csvFileName', current.fileName || '');
    storageSet('csvText', current.csvText);
  }
  if (previous && previous.csvText) {
    storageSet('previousCsvFileName', previous.fileName || '');
    storageSet('previousCsvText', previous.csvText);
  } else {
    storageRemove('previousCsvFileName');
    storageRemove('previousCsvText');
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

function clearStoredKader() {
  storageRemove('csvFileName');
  storageRemove('csvText');
  storageRemove('previousCsvFileName');
  storageRemove('previousCsvText');
  storageRemove('tacticMarkers');
  storageRemove('referenceDate');
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
    previousCsvFileName: previous ? previous.fileName : null,
    previousCsvText: previous ? previous.csvText : null,
    tacticMarkers: loadTacticMarkersFromStorage(),
    referenceDate: loadReferenceDateFromStorage()
  }, null, 2);
}

function parseBackupPayload(text) {
  var data = JSON.parse(text);
  if (!data || data.format !== 'fm26-kaderanalyse-backup') {
    throw new Error('Keine gültige Sicherungsdatei.');
  }
  return data;
}
