# FM26 Kaderanalyse

Lokale Web-App zur Analyse des eigenen Football-Manager-26-Kaders auf Basis von CSV-Exporten. Unterstützt Entscheidungen zu Kaderplanung, Einsatz, Verträgen und Verkäufen. Läuft komplett lokal im Browser, kein Konto, keine Cloud, keine laufenden Kosten.

## Status

V1-Funktionsumfang umgesetzt: CSV-Import, Dashboard (Kadertiefe, Entscheidungs-Hinweise, Qualität je Position, Leistung je Position, Standardsituationen & Führung), Kaderübersicht mit Filtern/Sortierung/Marktwert, Spielerprofil.

Der Export ist mittlerweile deutlich reichhaltiger als beim V1-Start (113 statt 46 Spalten): u. a. echte Saison-Leistungsdaten (`Durchschnittsnote – Verein`, xG, ...) und Marktwert (`Transferwert`) sind jetzt dabei. `Lsp Eins`/`Lsp Tore`/`U-Lsp`/`U-Tore` bleiben Länderspiele über die Gesamtkarriere (weiterhin ungeeignet für Saison-Leistung).

## Navigation

Nach dem Import zeigt die App zwei umschaltbare Ansichten (Buttons oben, kein Seitenwechsel, da beide dieselben Daten im Speicher brauchen):

- **Dashboard** – Startansicht: Kadertiefe, Entscheidungs-Hinweise, Qualität je Position
- **Kaderübersicht** – die filterbare/sortierbare Tabelle

Weitere Ansichten (z. B. später eine Verlaufs-Ansicht) lassen sich als zusätzlicher Button ergänzen, ohne Bestehendes umzubauen.

## Grundsatzentscheidungen

- **Technik:** reine clientseitige Browser-App (HTML/JS), kein Server, keine Installation nötig. Ein späterer Wechsel zu einem Python-Backend (z. B. bei deutlich höherem Rechenaufwand) bleibt offen, ist aber keine V1-Anforderung.
- **CSV-Parsing:** eigener kleiner Parser (keine externe Bibliothek), da das FM26-Exportformat (Semikolon-getrennt, sauber) bereits bekannt ist.
- **Datenimport:** generisches Einlesen aller vorhandenen CSV-Spalten (Rohdaten bleiben erhalten), unabhängig davon, welche Spalten der Nutzer im Export ausgewählt hat. Die Oberfläche nutzt in V1 nur eine kuratierte Teilmenge ("Kernspalten"); zusätzliche Spalten stehen für spätere Auswertungen bereit, ohne dass ein Re-Import nötig ist.
- **Schlüssel:** jeder Spieler wird über die Spalte `Unique ID` aus dem Export identifiziert.
- **Persistenz:** V1 wertet nur den aktuell importierten Kaderstand aus (kein Speichern über mehrere Importe hinweg). Das Datenmodell wird aber so gestaltet, dass ein späterer Verlaufs-Import (mehrere Zeitpunkte, Formkurven) ergänzt werden kann, ohne die bestehende Struktur umzubauen.

## Architekturprinzip

Drei getrennte Bereiche, damit spätere Erweiterungen bestehende Bereiche nicht anfassen müssen:

- **Import** – CSV → generisches Datenmodell (spaltenname-basiert, tolerant gegenüber wechselnder Spaltenauswahl)
- **Logik** – reine Auswertungsfunktionen (Filter, Kennzahlen, regelbasierte Entscheidungs-Hinweise): Daten rein, Ergebnis raus, unabhängig von der Oberfläche
- **UI** – Anzeige/Ansichten (Kaderübersicht, Spielerprofil, Vergleich, Hinweise)

## V1-Funktionsumfang

- CSV-Import per Datei-Auswahl
- Kaderübersicht: Tabelle mit Kernspalten (Position, Alter, Vertragsende, Gehalt, Einsatzstatus, ausgewählte Attribute)
- Spielerprofil: Detailansicht mit allen verfügbaren Feldern
- Filter & Sortierung (Position, Alter, Vertrag, Gehalt, Einsatzstatus, Attribute)
- Vergleichsansicht mehrerer Spieler
- Entscheidungs-Hinweise (regelbasiert, transparent, Schwellenwerte später einstellbar):
  - Vertrag prüfen (Vertragsende bald + Spieler wichtig für die Mannschaft)
  - Verkaufskandidat: Status "Nicht benötigt" (immer) ODER hohes Gehalt für eine kleine Rolle ("Ergänzungsspieler", unabhängig vom Alter) ODER [hohes Gehalt ODER hoher Marktwert] + unterdurchschnittliche Leistungsnote ("verkaufen solange der Wert hoch ist")
  - Verleihkandidat: Alter ≤ 21 + Status niedriger als "Rotationsspieler" (der bleibt im Kader), aber nicht "Nicht benötigt" (der ist immer Verkaufskandidat, nie gleichzeitig Verleihkandidat)
  - Status-Diskrepanz: `Tatsächliche Einsatzzeiten` und `Einsatzzeiten` (vereinbarter/erwarteter Status) liegen mindestens 3 Stufen auseinander - unabhängig von der Richtung, da die Daten keine eindeutig "problematische" Richtung zeigen
  - Positionslücke (Kadertiefe reicht nicht für die auf dem Taktik-Board eingestellte Formation, siehe unten)
- Taktik-Board: Fußballfeld zum Zusammenstellen der benötigten Positionen samt Starter-Anzahl, als sichtbares Raster aus Zeilen (TW/V/DM·FV/M/OM/ST) und Spalten (links/zentral/rechts). Formations-Presets (4-4-2, 4-3-3, 4-2-3-1, 3-5-2/Dreierkette, 5-3-2, 4-1-4-1) setzen automatisch passende Marker; danach frei per Drag & Drop verschiebbar. Zieht man einen Marker in eine andere Zeile, wandelt er sich in den dortigen Positions-Typ um (z.B. Stürmer nach hinten ins Mittelfeld gezogen wird zu "M"); die Spalte bestimmt die Seite. Sonderfall DM-Zeile: zentral bleibt es "DM", außen wird automatisch daraus ein Flügelverteidiger ("FV") - DM ist dadurch immer rein zentral. Marker-Beschriftung aktualisiert sich live. Mehrere Marker im selben Feld (z.B. 2x "V" zentral) zählen als 2 Innenverteidiger-Starter. Die Lücken-Prüfung zählt bei seitenlosen Positionen (TW/DM/ST) jeden Spieler mit passendem Wurzel-Code, auch wenn der Export ihm zusätzlich eine Seite gibt (z.B. "ST (RL)")
- Kadertiefe-Übersicht: Ziel-Kadertiefe je Position = Starter-Anzahl aus der Taktik × 2 (Rotation/Ausfallsicherheit), 4-stufige Ampel (fehlt / dünn = Formation nicht mal bespielbar / knapp = Starter gedeckt, keine Rotation / ok = Zieltiefe erreicht)
- Qualität je Position: Ø-Wert frei wählbarer Attribute je Position (Vorschlag aus FM-Community-Guides als editierbarer Startpunkt, keine feste Bewertungsformel)
- Leistung je Position: Durchschnittsnote fest je Position (reicht als Überblick, da FM sie schon positionsbewusst berechnet); bei Bedarf zusätzliche Leistungskennzahlen manuell zuwählbar, je Position thematisch sortiert (Verteidiger: Zweikampf zuerst, Stürmer: Offensive zuerst, ...) - eine Spalte pro Kennzahl statt einem Blend-Wert (unterschiedliche Skalen wie Note/Prozent/Pro-90-Rate lassen sich nicht sinnvoll mitteln). Absolute Zähler (z. B. Gewonnene Zweikämpfe) werden automatisch auf "pro 90 Minuten" umgerechnet
- Standardsituationen & Führung: Top-5-Vorschläge für Eckbälle, Freistöße, Elfmeter und Führung (Kapitän/Stellvertreter), je Kategorie frei wählbare Attribute. Freistöße/Elfmeter/Führung nutzen mangels eigener FM-Attribute im Export eine Näherung aus ähnlichen Attributen (klar gekennzeichnet)

### Explizit nicht in V1

Transfer-Scouting (Spieler außerhalb des eigenen Kaders), automatische Taktik-/Formationserkennung, Verlaufsspeicherung über mehrere Importe.

Jeder Entscheidungs-Hinweis zeigt direkt in der Liste, welche Werte ihn ausgelöst haben (z. B. Gehalt + Note vs. Kader-Ø beim Verkaufskandidat), statt nur den Spielernamen.

## Erweiterungspunkte (für später, nicht in V1 umgesetzt)

- Transfer-Scouting (Spieler außerhalb des eigenen Kaders)
- Einstellbare Schwellenwerte für Entscheidungs-Hinweise über die Oberfläche
- Design/Optik-Überarbeitung: Typografie, Farbschema, evtl. Dark Mode, responsiveres Layout; Diagramme statt nur Tabellen (z. B. Altersverteilung, Gehaltsstruktur, Vertragslaufzeiten)
- Druck-/Exportansicht: Dashboard oder Kaderübersicht sauber als PDF/Bild ausgeben, z. B. zum Teilen oder Ausdrucken
- Spieler-Vergleich: 2-3 Spieler explizit nebeneinander gegenüberstellen (bisher nur implizit über die Kaderübersicht-Tabelle möglich)

### Braucht zuerst eine persistente Speicherung (Entscheidung bereits getroffen)

- Verlaufs-Import: mehrere Zeitpunkte pro Spieler speichern und vergleichen. Wichtiger Anwendungsfall: die Durchschnittsnote wird zum Saisonwechsel zurückgesetzt - direkt im neuen Transferfenster ist sie deshalb kaum aussagekräftig (zu wenige Spiele). Mit gespeicherten alten Importen könnte man dort übergangsweise die Note der Vorsaison als Referenz heranziehen, statt ganz ohne Leistungsdaten dazustehen
- Notizen/eigene Tags je Spieler (z. B. "beobachten", "auf keinen Fall verkaufen"), über Re-Importe hinweg erhalten, verknüpft über `Unique ID`
- "Neu seit letztem Import"-Erkennung / einfacher Versionsvergleich zwischen zwei Importen (Vorstufe zum vollen Verlaufs-Import)
- Letzten Import automatisch merken: App zeigt beim Öffnen direkt den Stand vom letzten Mal, ohne dass die CSV erneut ausgewählt werden muss

**Warum diese vier zusammengehören und wie sie gelöst werden:** Die App merkt sich aktuell nichts über das Schließen/Neuladen hinweg (komplett zustandslos, jeder Import startet bei null). Geplante Lösung:

- **Automatisch, ohne Zutun:** Browser-eigener lokaler Speicher (localStorage/IndexedDB) hält Kaderstand, Notizen und Verlauf. Beim Öffnen ist alles direkt wieder da - kein manuelles Hochladen, kein Klicken.
- **Zusätzlich als Sicherheitsnetz:** ein Exportieren/Importieren-Button für eine Sicherungsdatei - nicht für den Alltag gedacht, sondern für Rechnerwechsel, Backup, oder falls der Browser-Speicher mal geleert wird/verloren geht. Diese Datei kann der Nutzer selbst z. B. in einen OneDrive-Ordner legen, ganz ohne dass die App eine eigene Cloud-Anbindung braucht.
- **Bewusst nicht:** eine echte OneDrive-/Cloud-Anmeldung direkt in der App (Microsoft-Login, Azure-App-Registrierung, Internetzugriff nötig). Deutlich mehr Aufwand/Fragilität (Token-Ablauf, Login-Fehler, keine Offline-Nutzung mehr) für denselben Alltagsnutzen, den die automatische lokale Speicherung bereits liefert. Bleibt als Option offen, falls der Bedarf sich mal ändert.
- Bleibt an diesen einen Browser/dieses Profil auf diesem Rechner gebunden - bei Browserwechsel oder gelöschten Browserdaten ist der automatisch gespeicherte Stand weg (dafür ist die Export-Datei da).
