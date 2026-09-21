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

function saveCsvToStorage(fileName, csvText) {
  storageSet('csvFileName', fileName);
  storageSet('csvText', csvText);
}

// Gibt null zurück, wenn kein gespeicherter Kader vorliegt.
function loadCsvFromStorage() {
  var csvText = storageGet('csvText');
  if (!csvText) return null;
  return { fileName: storageGet('csvFileName') || 'gespeicherter-kader.csv', csvText: csvText };
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
  storageRemove('tacticMarkers');
  storageRemove('referenceDate');
}

// Backup-Datei: fasst den gesamten gespeicherten Stand in einem JSON-Objekt
// zusammen, das der Nutzer selbst sichern kann (z.B. in einem Cloud-Ordner) -
// unabhängig vom Browser-Speicher, für Rechnerwechsel oder falls der
// Browser-Speicher mal verloren geht.
function buildBackupPayload() {
  var csv = loadCsvFromStorage();
  return JSON.stringify({
    format: 'fm26-kaderanalyse-backup',
    version: 1,
    csvFileName: csv ? csv.fileName : null,
    csvText: csv ? csv.csvText : null,
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
