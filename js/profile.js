// Eigenständige Seite für ein Spielerprofil. Bekommt die Daten eines einzelnen
// Spielers per URL-Hash von der Kaderübersicht übergeben (kein Server nötig).
// Die Notiz ist die eine Ausnahme, die tatsächlich geteilten Speicher braucht
// (localStorage, siehe storage.js) - damit sie auch beim nächsten Import bzw.
// im Dashboard-Tab sichtbar bleibt.
//
// Felder werden in thematische Abschnitte gebündelt statt einer langen
// flachen Liste (siehe classifyFields): Basis, Leistung, Attribute, Weitere
// Felder. Läuft eigenständig (wie position.js/compare.js), deshalb eigene
// kleine Erkennung statt eines Imports aus players.js/performance.js.

// Kuratierte Kernfelder - dieselbe Auswahl wie im Spielervergleich (compare.js),
// plus Geburtsdatum/Größe (beide Schreibweisen des Geburtsdatums als Fallback,
// je nachdem wie der Export die Spalte nennt - fehlende Spalten werden weiter
// unten beim Filtern auf tatsächlich vorhandene Header ohnehin aussortiert).
var PROFILE_BASIS_FIELDS = [
  'Position', 'Idealpos', 'Nation', 'Geburtsdatum', 'Geburtstag', 'Alter', 'Größe',
  'Endet', 'Gehalt', 'Transferwert', 'Tatsächliche Einsatzzeiten', 'Einsatzzeiten'
];

// Mögliche Spaltennamen fürs Geburtsdatum - nur als Fallback, um "Alter" zu
// berechnen, falls der Export ausnahmsweise kein eigenes Alter-Feld liefert
// (normalerweise ist "Alter" immer da und wird direkt angezeigt).
var PROFILE_BIRTHDATE_FIELDS = ['Geburtsdatum', 'Geburtstag'];

// Durchschnittsnote/Einsatzzeit-Kennzahlen immer zuerst in "Leistung", auch
// wenn sie nicht Teil der Kategorien-Listen unten sind.
var PROFILE_PINNED_PERFORMANCE_FIELDS = ['Durchschnittsnote – Verein', 'Einsätze', 'Min/Sp'];

// Dieselben real existierenden Leistungsspalten wie PERFORMANCE_CATEGORIES in
// performance.js (dort mit Kategorien-Überschriften, hier nur zur Erkennung
// "das ist ein Leistungswert, kein freies FM-Attribut").
var PROFILE_PERFORMANCE_FIELDS = [
  'Anteil erfolgreicher Zweikämpfe', 'Gewonnene Zweikämpfe', 'Entscheidende Zweikämpfe',
  'Geklärte Bälle pro 90 Minuten', 'Prozentual gewonnene Kopfbälle', 'Versuchte Kopfballduelle',
  'Ballgewinne pro 90 Minuten', 'Blk', 'Fehler mit Torfolge', 'PrsErf', 'PrsV',
  'Anteil angekommener Flanken aus dem Spiel', 'Versuchte Flanken',
  'Tore', 'Anteil Schüsse aufs Tor', 'Schüsse', 'xG', 'Erspielte Großchancen',
  'Dribblings / 90', 'Sprints/90', 'Elfmeter insgesamt', 'Elfmeterquote',
  'Abgewehrte Bälle pro 90 Minuten', 'Zu-Null-Spiele', 'Parierte Elfmeter',
  'Lauf/90', 'Gefoult worden', 'Fouls', 'Gelbe Karten', 'Rote Karten',
  'Gewonnene Spiele (%)', 'Spieler des Spiels', 'Start11'
];

// Zähler, die zufällig im 1-20-Bereich liegen können (z.B. 3 Länderspiele),
// aber keine FM-Attribute auf der 1-20-Skala sind - sonst würde z.B. "Lsp
// Eins: 3" fälschlich als schwacher Attributwert dargestellt. Landen in
// "Weitere Felder" statt in "Attribute" (siehe README zu Länderspiel-Spalten).
var PROFILE_NON_ATTRIBUTE_COUNTS = ['Lsp Eins', 'Lsp Tore', 'U-Lsp', 'U-Tore'];

function isIntegerStringLocal(str) {
  return /^-?\d+$/.test((str || '').trim());
}

function parsePercentLocal(str) {
  if (str == null || str === '') return null;
  var num = parseFloat(String(str).replace(',', '.').replace('%', '').trim());
  return isNaN(num) ? null : num;
}

// Spaltenname deutet auf einen Prozentwert hin (0-100, sichere Skala für
// einen Balken) - unabhängig davon, ob der Rohwert selbst ein "%" enthält.
function looksLikePercentColumn(name) {
  return /anteil|prozent|quote|\(%\)|%$/i.test(name);
}

// Deutsches Datumsformat "TT.MM.JJJJ" - läuft eigenständig (wie der Rest
// dieser Seite), deshalb ein eigener kleiner Parser statt eines Imports aus
// players.js (parseGermanDate dort).
function parseGermanDateLocal(str) {
  if (!str) return null;
  var parts = String(str).trim().split('.');
  if (parts.length !== 3) return null;
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (!day || !month || !year) return null;
  var date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

// Alter in vollen Jahren zu einem Stichtag (das gesetzte Spieldatum, falls
// vorhanden - sonst das heutige Datum als bester verfügbarer Ersatz).
function computeAgeLocal(birthDate, referenceDate) {
  var ref = referenceDate || new Date();
  var age = ref.getFullYear() - birthDate.getFullYear();
  var beforeBirthday = ref.getMonth() < birthDate.getMonth() ||
    (ref.getMonth() === birthDate.getMonth() && ref.getDate() < birthDate.getDate());
  return beforeBirthday ? age - 1 : age;
}

// Ordnet jede Kopfzeile genau einem Abschnitt zu - "Attribute" sind alle
// übrig gebliebenen glatten Ganzzahlen 1-20 (die klassische FM-Attributskala),
// alles andere Unbekannte landet in "Weitere Felder" statt zu verschwinden.
function classifyFields(headers, record) {
  var used = { 'Spieler': true, 'Unique ID': true };

  var basis = PROFILE_BASIS_FIELDS.filter(function (h) { return headers.indexOf(h) !== -1; });
  basis.forEach(function (h) { used[h] = true; });

  var leistungCandidates = PROFILE_PINNED_PERFORMANCE_FIELDS.concat(PROFILE_PERFORMANCE_FIELDS);
  var seenLeistung = {};
  var leistung = leistungCandidates.filter(function (h) {
    if (used[h] || seenLeistung[h] || headers.indexOf(h) === -1) return false;
    seenLeistung[h] = true;
    return true;
  });
  leistung.forEach(function (h) { used[h] = true; });

  var attribute = [];
  var weitere = [];
  headers.forEach(function (h) {
    if (used[h]) return;
    var raw = record[h];
    var val = parseInt(raw, 10);
    if (PROFILE_NON_ATTRIBUTE_COUNTS.indexOf(h) === -1 && isIntegerStringLocal(raw) && val >= 1 && val <= 20) {
      attribute.push(h);
    } else {
      weitere.push(h);
    }
  });

  return { basis: basis, leistung: leistung, attribute: attribute, weitere: weitere };
}

// items: [{ label, value }] - zwei Spalten nebeneinander, wenn die Breite
// reicht (siehe .profile-field-grid in styles.css), fällt auf schmalen
// Bildschirmen automatisch auf eine Spalte zurück.
function makeFieldGrid(items) {
  var grid = document.createElement('div');
  grid.className = 'profile-field-grid';
  items.forEach(function (it) {
    var row = document.createElement('div');
    row.className = 'profile-field-item';
    var label = document.createElement('span');
    label.className = 'profile-field-label';
    label.textContent = it.label;
    var value = document.createElement('span');
    value.className = 'profile-field-value';
    value.textContent = it.value;
    row.appendChild(label);
    row.appendChild(value);
    grid.appendChild(row);
  });
  return grid;
}

// items: [{ label, value, max, displayText }] - derselbe Balken-Baustein wie
// im Spielervergleich (.compare-chart-bar-*, siehe compare.js/css).
function makeBarGrid(items) {
  var grid = document.createElement('div');
  grid.className = 'profile-bar-grid';
  items.forEach(function (it) {
    var item = document.createElement('div');
    item.className = 'compare-chart-bar-item';

    var name = document.createElement('span');
    name.className = 'compare-chart-bar-name';
    name.textContent = it.label;
    name.title = it.label;
    item.appendChild(name);

    var track = document.createElement('div');
    track.className = 'compare-chart-bar-track';
    var fill = document.createElement('div');
    fill.className = 'compare-chart-bar-fill';
    var pct = it.max > 0 ? Math.max(0, Math.min(100, it.value / it.max * 100)) : 0;
    fill.style.width = pct + '%';
    fill.style.background = 'var(--color-accent)';
    track.appendChild(fill);
    item.appendChild(track);

    var value = document.createElement('span');
    value.className = 'compare-chart-bar-value';
    value.textContent = it.displayText;
    item.appendChild(value);

    grid.appendChild(item);
  });
  return grid;
}

// Ein Abschnitt = eine Karte. Felder, deren Name auf einen Prozentwert
// hindeutet, bekommen einen Balken (sichere 0-100-Skala); der Rest bleibt
// eine schlichte Werteliste. extraPlainItems (optional) sind bereits fertige
// {label, value}-Paare, die vorne mit reinkommen - z.B. ein berechnetes Alter,
// das keiner echten Kopfzeile entspricht (siehe computeAgeLocal weiter unten).
function renderSection(container, title, fields, record, extraPlainItems) {
  extraPlainItems = extraPlainItems || [];
  if (fields.length === 0 && extraPlainItems.length === 0) return;
  var box = document.createElement('div');
  box.className = 'hint-summary-box profile-section';

  var heading = document.createElement('div');
  heading.className = 'hint-summary-title';
  heading.textContent = title;
  box.appendChild(heading);

  var plainItems = extraPlainItems.slice();
  var barItems = [];
  fields.forEach(function (h) {
    var raw = record[h];
    var pct = looksLikePercentColumn(h) ? parsePercentLocal(raw) : null;
    if (pct != null) {
      barItems.push({ label: h, value: pct, max: 100, displayText: raw || (pct + '%') });
    } else {
      plainItems.push({ label: h, value: raw || '' });
    }
  });

  if (plainItems.length > 0) box.appendChild(makeFieldGrid(plainItems));
  if (barItems.length > 0) box.appendChild(makeBarGrid(barItems));
  container.appendChild(box);
}

// Attribute sind IMMER Balken (feste 1-20-Skala, siehe classifyFields) -
// eigene Funktion statt renderSection, da hier nie eine plaine Liste nötig ist.
function renderAttributeSection(container, fields, record) {
  if (fields.length === 0) return;
  var box = document.createElement('div');
  box.className = 'hint-summary-box profile-section';

  var heading = document.createElement('div');
  heading.className = 'hint-summary-title';
  heading.textContent = 'Attribute';
  box.appendChild(heading);

  var items = fields.map(function (h) {
    var val = parseInt(record[h], 10);
    return { label: h, value: val, max: 20, displayText: String(val) };
  });
  box.appendChild(makeBarGrid(items));
  container.appendChild(box);
}

// Catch-all für alles Unklassifizierte - eingeklappt, damit die Seite nicht
// wieder in einer riesigen Liste endet, aber ohne dass Daten verschwinden.
function renderWeitereFelder(container, fields, record) {
  if (fields.length === 0) return;
  var details = document.createElement('details');
  details.className = 'quality-settings profile-weitere';
  var summary = document.createElement('summary');
  summary.textContent = 'Weitere Felder (' + fields.length + ')';
  details.appendChild(summary);
  var items = fields.map(function (h) { return { label: h, value: record[h] || '' }; });
  details.appendChild(makeFieldGrid(items));
  container.appendChild(details);
}

document.addEventListener('DOMContentLoaded', function () {
  var container = document.getElementById('profile-content');
  var hash = window.location.hash.slice(1);

  if (!hash) {
    container.textContent = 'Kein Spielerprofil übergeben. Bitte einen Spieler in der Kaderübersicht anklicken.';
    return;
  }

  var data;
  try {
    data = JSON.parse(decodeURIComponent(hash));
  } catch (e) {
    container.textContent = 'Spielerprofil konnte nicht gelesen werden.';
    return;
  }

  var headers = data.headers || [];
  var record = data.record || {};

  container.innerHTML = '';

  var title = document.createElement('h1');
  title.textContent = record['Spieler'] || 'Unbekannter Spieler';
  container.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.className = 'profile-subtitle';
  subtitle.textContent = [record['Position'], record['Nation']].filter(Boolean).join(' · ');
  container.appendChild(subtitle);

  var playerId = record['Unique ID'] || null;
  if (playerId) {
    var noteLabel = document.createElement('label');
    noteLabel.className = 'profile-note-label';
    noteLabel.textContent = 'Notiz (z. B. "beobachten", "auf keinen Fall verkaufen")';
    noteLabel.setAttribute('for', 'profile-note');
    container.appendChild(noteLabel);

    var noteField = document.createElement('textarea');
    noteField.id = 'profile-note';
    noteField.className = 'profile-note';
    noteField.value = loadNotesMap()[playerId] || '';
    noteField.addEventListener('change', function () {
      saveNoteForPlayer(playerId, noteField.value.trim());
    });
    container.appendChild(noteField);
  }

  var sections = classifyFields(headers, record);

  // "Alter" fehlt praktisch nie im Export (der Rest der App setzt es sogar
  // voraus) - dieser Zweig greift nur im Ausnahmefall, dann aus dem
  // Geburtsdatum berechnet, zum gesetzten Spieldatum (referenceDate) oder
  // ersatzweise zum heutigen Datum.
  var basisExtra = [];
  if (headers.indexOf('Alter') === -1) {
    var birthField = PROFILE_BIRTHDATE_FIELDS.filter(function (f) { return headers.indexOf(f) !== -1; })[0];
    var birthDate = birthField ? parseGermanDateLocal(record[birthField]) : null;
    if (birthDate) {
      var referenceDate = data.referenceDate ? new Date(data.referenceDate) : null;
      basisExtra.push({ label: 'Alter (berechnet)', value: String(computeAgeLocal(birthDate, referenceDate)) });
    }
  }

  var sectionsWrap = document.createElement('div');
  sectionsWrap.className = 'profile-sections';
  renderSection(sectionsWrap, 'Basis', sections.basis, record, basisExtra);
  renderAttributeSection(sectionsWrap, sections.attribute, record);
  renderSection(sectionsWrap, 'Leistung', sections.leistung, record);
  renderWeitereFelder(sectionsWrap, sections.weitere, record);
  container.appendChild(sectionsWrap);
});
