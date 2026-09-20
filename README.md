# FM26 Kaderanalyse

Lokale Web-App zur Analyse des eigenen Football-Manager-26-Kaders auf Basis von CSV-Exporten. Unterstützt Entscheidungen zu Kaderplanung, Einsatz, Verträgen und Verkäufen. Läuft komplett lokal im Browser, kein Konto, keine Cloud, keine laufenden Kosten.

## Status

Projekt in Planung/früher Aufbau. Noch kein Feature-Code, aktuell nur Projektstruktur und Dokumentation.

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
  - Verkaufskandidat (hohes Alter + niedriger Einsatzstatus + hohes Gehalt)
  - Verleihkandidat (junger Spieler + niedriger Einsatzstatus)
  - Positionslücke (Position im Kader dünn besetzt)
- Positionslücken-Übersicht

### Explizit nicht in V1

Transfer-Scouting (Spieler außerhalb des eigenen Kaders), Taktik-Analyse, Verlaufsspeicherung über mehrere Importe, marktwertbasierte Bewertung (Marktwert fehlt aktuell im Export), echte Spielminuten-Statistiken.

## Erweiterungspunkte (für später, nicht in V1 umgesetzt)

- Verlaufs-Import: mehrere Zeitpunkte pro Spieler speichern und vergleichen
- Marktwert-Daten ergänzen, sobald im Export verfügbar
- Echte Spielminuten/Statistiken statt nur Einsatzstatus-Kategorien
- Transfer-Scouting (Spieler außerhalb des eigenen Kaders)
- Taktik-Analyse
- Einstellbare Schwellenwerte für Entscheidungs-Hinweise über die Oberfläche
