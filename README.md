# FM26 Kaderanalyse

Lokale Web-App zur Analyse des eigenen Football-Manager-26-Kaders auf Basis von CSV-Exporten. Unterstützt Entscheidungen zu Kaderplanung, Einsatz, Verträgen und Verkäufen. Läuft komplett lokal im Browser, kein Konto, keine Cloud, keine laufenden Kosten.

## Status

V1-Funktionsumfang umgesetzt: CSV-Import, Dashboard (Positionslücken, Entscheidungs-Hinweise, Qualität je Position, Leistung je Position, Standardsituationen & Führung), Kaderübersicht mit Filtern/Sortierung/Marktwert, Spielerprofil.

Der Export ist mittlerweile deutlich reichhaltiger als beim V1-Start (113 statt 46 Spalten): u. a. echte Saison-Leistungsdaten (`Durchschnittsnote – Verein`, xG, ...) und Marktwert (`Transferwert`) sind jetzt dabei. `Lsp Eins`/`Lsp Tore`/`U-Lsp`/`U-Tore` bleiben Länderspiele über die Gesamtkarriere (weiterhin ungeeignet für Saison-Leistung).

## Navigation

Nach dem Import zeigt die App zwei umschaltbare Ansichten (Buttons oben, kein Seitenwechsel, da beide dieselben Daten im Speicher brauchen):

- **Dashboard** – Startansicht: Positionslücken, Entscheidungs-Hinweise, Qualität je Position
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
  - Verkaufskandidat (hohes Gehalt + [hohes Alter + niedriger Einsatzstatus ODER unterdurchschnittliche Leistungsnote])
  - Verleihkandidat (junger Spieler + niedriger Einsatzstatus)
  - Positionslücke (Position im Kader dünn besetzt/fehlend, nur für manuell als "benötigt" markierte Positionen)
- Positionslücken-Übersicht (3-stufig: fehlt / dünn / ok)
- Qualität je Position: Ø-Wert frei wählbarer Attribute je Position (Vorschlag aus FM-Community-Guides als editierbarer Startpunkt, keine feste Bewertungsformel)
- Leistung je Position: Durchschnittsnote fest je Position, plus je Position frei wählbare, standardmäßig unterschiedliche Leistungskennzahlen (z. B. Verteidiger: Zweikampfquote/Klärungen, Stürmer: Tore/Chancenverwertung) - eine Spalte pro Kennzahl statt einem Blend-Wert (unterschiedliche Skalen wie Note/Prozent/Pro-90-Rate lassen sich nicht sinnvoll mitteln). Absolute Zähler (z. B. Gewonnene Zweikämpfe) werden automatisch auf "pro 90 Minuten" umgerechnet, damit Vielspieler nicht automatisch besser dastehen
- Standardsituationen & Führung: Top-5-Vorschläge für Eckbälle, Freistöße, Elfmeter und Führung (Kapitän/Stellvertreter), je Kategorie frei wählbare Attribute. Freistöße/Elfmeter/Führung nutzen mangels eigener FM-Attribute im Export eine Näherung aus ähnlichen Attributen (klar gekennzeichnet)

### Explizit nicht in V1

Transfer-Scouting (Spieler außerhalb des eigenen Kaders), automatische Taktik-/Formationserkennung, Verlaufsspeicherung über mehrere Importe.

Jeder Entscheidungs-Hinweis zeigt direkt in der Liste, welche Werte ihn ausgelöst haben (z. B. Gehalt + Note vs. Kader-Ø beim Verkaufskandidat), statt nur den Spielernamen.

## Erweiterungspunkte (für später, nicht in V1 umgesetzt)

- Verlaufs-Import: mehrere Zeitpunkte pro Spieler speichern und vergleichen
- Gehalt-vs-Marktwert-Hinweis (Marktwert ist jetzt als Spalte da, aber noch kein automatischer Hinweis daraus - bewusst keine geratene Ratio-Schwelle ohne Rückmeldung)
- Transfer-Scouting (Spieler außerhalb des eigenen Kaders)
- Formations-Presets (z. B. "3er-Kette", "4-3-3"), die die benötigten Positionen automatisch vorauswählen, statt sie manuell anzuhaken
- Einstellbare Schwellenwerte für Entscheidungs-Hinweise über die Oberfläche
