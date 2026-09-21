// Eigenständige Seite für ein Spielerprofil. Bekommt die Daten eines einzelnen
// Spielers per URL-Hash von der Kaderübersicht übergeben (kein Server nötig).
// Die Notiz ist die eine Ausnahme, die tatsächlich geteilten Speicher braucht
// (localStorage, siehe storage.js) - damit sie auch beim nächsten Import bzw.
// im Dashboard-Tab sichtbar bleibt.
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

  var dl = document.createElement('dl');
  dl.className = 'profile-fields';
  headers.forEach(function (h) {
    var dt = document.createElement('dt');
    dt.textContent = h;
    var dd = document.createElement('dd');
    dd.textContent = record[h] || '';
    dl.appendChild(dt);
    dl.appendChild(dd);
  });
  container.appendChild(dl);
});
