# FM26 Kaderanalyse

Lokale Web-App zur Analyse des eigenen Football-Manager-26-Kaders auf Basis von CSV-Exporten. Unterstützt Entscheidungen zu Kaderplanung, Einsatz, Verträgen und Verkäufen. Läuft komplett lokal im Browser, kein Konto, keine Cloud, keine laufenden Kosten.

## Status

V1-Funktionsumfang umgesetzt: CSV-Import, Dashboard (Kadertiefe, Handlungsbedarf, Qualität je Position, Leistung je Position, Standardsituationen & Führung), Kaderübersicht mit Filtern/Sortierung/Marktwert, Spielerprofil.

Der Export ist mittlerweile deutlich reichhaltiger als beim V1-Start (113 statt 46 Spalten): u. a. echte Saison-Leistungsdaten (`Durchschnittsnote – Verein`, xG, ...) und Marktwert (`Transferwert`) sind jetzt dabei. `Lsp Eins`/`Lsp Tore`/`U-Lsp`/`U-Tore` bleiben Länderspiele über die Gesamtkarriere (weiterhin ungeeignet für Saison-Leistung).

## Navigation

Nach dem Import zeigt die App eine einzige, flache Reiter-Leiste (kein Seitenwechsel, alle Reiter teilen sich dieselben Daten im Speicher):

- **Übersicht** – Vergleich zum letzten Import
- **Handlungsbedarf** (früher "Entscheidungs-Hinweise" genannt - das klang nach passiven Denkanstößen, tatsächlich sind es konkrete Handlungsaufforderungen)
- **Taktik & Kadertiefe** – das Taktik-Board mit direkt daneben der resultierenden Kadertiefe-Analyse
- **Qualität je Position**
- **Leistung je Position**
- **Standardsituationen & Führung**
- **Kaderübersicht** – die filterbare/sortierbare Tabelle

Bewusst eine einzige Reiter-Ebene statt verschachtelter Unterreiter (so vorher kurz ausprobiert) - das wirkte schnell verwirrend, wenn zwei Reiter-Leisten übereinander standen. Reine Sichtbarkeits-Umschaltung (`switchTab` in `app.js`) - jede Sektion rendert unabhängig davon weiter, ob ihr Reiter gerade sichtbar ist. Weitere Reiter (z. B. später eine Verlaufs-Ansicht) lassen sich als zusätzlicher Button ergänzen, ohne Bestehendes umzubauen.

## Grundsatzentscheidungen

- **Technik:** reine clientseitige Browser-App (HTML/JS), kein Server, keine Installation nötig. Ein späterer Wechsel zu einem Python-Backend (z. B. bei deutlich höherem Rechenaufwand) bleibt offen, ist aber keine V1-Anforderung.
- **CSV-Parsing:** eigener kleiner Parser (keine externe Bibliothek), da das FM26-Exportformat (Semikolon-getrennt, sauber) bereits bekannt ist.
- **Datenimport:** generisches Einlesen aller vorhandenen CSV-Spalten (Rohdaten bleiben erhalten), unabhängig davon, welche Spalten der Nutzer im Export ausgewählt hat. Die Oberfläche nutzt in V1 nur eine kuratierte Teilmenge ("Kernspalten"); zusätzliche Spalten stehen für spätere Auswertungen bereit, ohne dass ein Re-Import nötig ist.
- **Schlüssel:** jeder Spieler wird über die Spalte `Unique ID` aus dem Export identifiziert.
- **Design:** ein Satz CSS-Variablen in `css/styles.css` (`:root`) statt verstreuter Hex-Werte - Farben, Radien, Schatten, Abstände an einer Stelle. Akzentfarbe ist dasselbe validierte Blau wie im Spielervergleich-Chart (siehe unten), damit App und Chart als ein System wirken statt als Einzelteile. Bewusst nur ein (heller) Modus - ohne echten Dark Mode wäre ein halbfertiger inkonsistenter als gar keiner.
- **Persistenz:** der zuletzt importierte Kader, das Taktik-Board und das Spieldatum werden automatisch im Browser (`localStorage`) gespeichert und beim nächsten Öffnen direkt geladen - kein erneuter Upload nötig, auch nach Wochen/Monaten Pause (kein Ablaufdatum, aber gebunden an denselben Browser/dasselbe Gerät). Zusätzlich als Sicherheitsnetz: Export/Import einer Sicherungsdatei (JSON), die der Nutzer selbst z. B. in einem Cloud-Ordner ablegen kann - für Rechnerwechsel oder falls der Browser-Speicher verloren geht. V1 wertet weiterhin nur einen Kaderstand aus (kein Verlauf über mehrere Zeitpunkte); das Datenmodell ist aber so gestaltet, dass ein späterer Verlaufs-Import ergänzt werden kann, ohne die bestehende Struktur umzubauen.

## Architekturprinzip

Drei getrennte Bereiche, damit spätere Erweiterungen bestehende Bereiche nicht anfassen müssen:

- **Import** – CSV → generisches Datenmodell (spaltenname-basiert, tolerant gegenüber wechselnder Spaltenauswahl)
- **Logik** – reine Auswertungsfunktionen (Filter, Kennzahlen, regelbasierter Handlungsbedarf): Daten rein, Ergebnis raus, unabhängig von der Oberfläche
- **UI** – Anzeige/Ansichten (Kaderübersicht, Spielerprofil, Vergleich, Hinweise)

## V1-Funktionsumfang

- CSV-Import per Datei-Auswahl
- Kaderübersicht: Tabelle mit Kernspalten (Position, Alter, Vertragsende, Gehalt, Einsatzstatus, ausgewählte Attribute)
- Spielerprofil: Detailansicht mit allen verfügbaren Feldern
- Filter & Sortierung (Position, Alter, Vertrag, Gehalt, Einsatzstatus, Attribute)
- Spielervergleich: in der Kaderübersicht 2-4 Spieler per Häkchen auswählen (eigene Spalte "Vgl.", stört den normalen Zeilenklick zum Profil nicht), öffnet als eigene Seite mit Spielern als Spalten und Kernwerten als Zeilen (Position, Alter, Vertragsende, Gehalt, Marktwert, Einsatzstatus Ist/Soll, Durchschnittsnote), weitere Spalten aus dem Export bei Bedarf dazuwählbar (inkl. "Alle auswählen"). Grün markiert den besten Wert einer Zeile - aber nur bei echten Leistungswerten (Durchschnittsnote, dazugewählte Attribute), bewusst NICHT bei Gehalt/Marktwert/Alter/Vertragsende, da "hoch" dort nicht eindeutig gut oder schlecht ist (bei den wenigen Kennzahlen, wo weniger besser ist, z. B. Fouls/Karten, dreht sich die Markierung entsprechend um). Zusätzlich ein grafischer Vergleich als horizontale Mini-Balkendiagramme je Kennzahl (Alter, Gehalt, Marktwert, Durchschnittsnote, dazugewählte Attribute), pro Zeile auf ihr eigenes Maximum skaliert (unterschiedliche Skalen wie Note/Gehalt/Attribut-Punkte lassen sich nicht in einem Chart mischen), feste Spielerfarbe über alle Zeilen hinweg. Auswahl ist rein für die aktuelle Sitzung (nicht gespeichert, wird bei neuem Import geleert)
- Handlungsbedarf (regelbasiert, transparent, alle Schwellenwerte direkt in der Oberfläche einstellbar - siehe unten):
  - Vertrag prüfen (Vertragsende bald + Spieler wichtig für die Mannschaft)
  - Verkaufskandidat: Status "Nicht benötigt" (immer) ODER hohes Gehalt für eine kleine Rolle ("Ergänzungsspieler", unabhängig vom Alter) ODER [hohes Gehalt ODER hoher Marktwert] + unterdurchschnittliche Leistungsnote ("verkaufen solange der Wert hoch ist")
  - Verleihkandidat: Alter ≤ 21 (einstellbar) + Status aus einer frei wählbaren Checkbox-Liste (Standard: alles niedriger als "Rotationsspieler", der bleibt im Kader). "Nicht benötigt" steht dort bewusst nicht zur Wahl - der ist immer Verkaufskandidat, nie gleichzeitig Verleihkandidat
  - Status-Diskrepanz: `Tatsächliche Einsatzzeiten` und `Einsatzzeiten` (vereinbarter/erwarteter Status) liegen mindestens 3 Stufen auseinander - unabhängig von der Richtung, da die Daten keine eindeutig "problematische" Richtung zeigen
  - Auslaufende Verträge: alle Spieler, deren Vertrag in derselben Saison wie das gesetzte Spieldatum endet (früher "Vertragsballung" genannt - der Name suggerierte fälschlich einen Schwellenwert, tatsächlich werden einfach alle aufgelistet)
  - Position: Handlungsbedarf (Positionslücke und/oder auffällig schwache Qualität/Leistung relativ zum Kader-Ø) - beschränkt sich strikt auf die aktuell auf dem Taktik-Board eingestellten Positionen (siehe unten), damit z. B. ein nicht ausgewählter Flügelverteidiger nicht fälschlich als Handlungsbedarf auftaucht
  - Spieler ohne Position in der Taktik: listet Spieler, die auf keiner aktuell benötigten Position spielen können (z. B. ein reiner zentraler Mittelfeldspieler bei einer Taktik ohne M-Position) - diese Spieler tauchen sonst nirgends mehr auf, seit Qualität/Leistung/Position: Handlungsbedarf auf die Taktik beschränkt sind
  - Jede Zeile hat ein Häkchen zum Markieren als "erledigt" (durchgestrichen, bleibt aber sichtbar) - gilt nur für den aktuellen Import, wird beim nächsten Import automatisch geleert, da sich die Datenbasis dann ohnehin ändert
  - Positionslücke (Kadertiefe reicht nicht für die auf dem Taktik-Board eingestellte Formation, siehe unten)
  - Schwellenwerte (z. B. "Vertrag prüfen ab wie vielen Monaten Restlaufzeit", "oberste X % Gehalt/Marktwert für Verkaufskandidat", "Ziel-Kadertiefe = Starter × wie viel", plus eine Checkbox-Liste, welche Einsatzstatus als Verleihkandidat gelten) über ein aufklappbares Einstellungs-Panel direkt im Reiter anpassbar - Startwerte sind nur eine erste Einschätzung. Wirkt sofort auf alle betroffenen Regeln und Tabellen, bleibt dauerhaft gespeichert (unabhängig vom Kaderstand, wandert mit in die Sicherungsdatei) und ist per Klick auf Standardwerte zurücksetzbar
- Taktik-Board: Fußballfeld zum Zusammenstellen der benötigten Positionen samt Starter-Anzahl, als sichtbares Raster aus Zeilen (TW/V/DM·FV/M/OM/ST) und Spalten (links/zentral/rechts). Formations-Presets (4-4-2, 4-3-3, 4-2-3-1, 3-5-2/Dreierkette, 5-3-2, 4-1-4-1) setzen automatisch passende Marker; danach frei per Drag & Drop verschiebbar. Zieht man einen Marker in eine andere Zeile, wandelt er sich in den dortigen Positions-Typ um (z.B. Stürmer nach hinten ins Mittelfeld gezogen wird zu "M"); die Spalte bestimmt die Seite. Sonderfall DM-Zeile: zentral bleibt es "DM", außen wird automatisch daraus ein Flügelverteidiger ("FV") - DM ist dadurch immer rein zentral. Marker-Beschriftung aktualisiert sich live. Mehrere Marker im selben Feld (z.B. 2x "V" zentral) zählen als 2 Innenverteidiger-Starter. Die Lücken-Prüfung zählt bei seitenlosen Positionen (TW/DM/ST) jeden Spieler mit passendem Wurzel-Code, auch wenn der Export ihm zusätzlich eine Seite gibt (z.B. "ST (RL)")
- Vergleich zum letzten Import: zeigt zuerst, mit welchem Zeitpunkt verglichen wird (Datum/Uhrzeit des vorherigen Uploads), dann Neuzugänge, Abgänge, Status- und Vertragsänderungen gegenüber dem direkt vorherigen Import (verknüpft über `Unique ID`), plus eine sortierbare (Klick auf Tabellenkopf) Ansicht des kompletten letzten Imports zum Nachschlagen. Zusätzlich: ist "Einsätze" bei einem Spieler 0 oder leer (Saison hat noch keine Pflichtspiele), wird übergangsweise seine Durchschnittsnote der Vorsaison übernommen, erkennbar am angehängten "*" (z. B. im Spielerprofil) - verschwindet automatisch, sobald echte neue Daten da sind
- Kadertiefe-Übersicht (direkt neben dem Taktik-Board): Ziel-Kadertiefe je Position = Starter-Anzahl aus der Taktik × 2 (Rotation/Ausfallsicherheit), 4-stufige Ampel (fehlt / dünn = Formation nicht mal bespielbar / knapp = Starter gedeckt, keine Rotation / ok = Zieltiefe erreicht). Jede Kachel ist anklickbar und zeigt darunter die passenden Spieler als normale Tabelle (dieselbe Zuordnung wie die Zählung selbst) - nochmal anklicken blendet sie wieder aus
- Qualität je Position: Ø-Wert frei wählbarer Attribute je Position (Vorschlag aus FM-Community-Guides als editierbarer Startpunkt, keine feste Bewertungsformel), standardmäßig nach der Positionsspalte sortiert (Feldreihenfolge TW → ST). Zeigt nur die aktuell auf dem Taktik-Board benötigten Positionen (keine Position aus dem Kader, die in der eingestellten Taktik gar nicht vorkommt) - passende Spieler ohne Positions-Treffer werden stattdessen als Vermerk über der Tabelle gezählt und tauchen im Handlungsbedarf-Reiter als eigene Liste auf
- Leistung je Position: Durchschnittsnote fest je Position (reicht als Überblick, da FM sie schon positionsbewusst berechnet); bei Bedarf zusätzliche Leistungskennzahlen manuell zuwählbar, je Position thematisch sortiert (Verteidiger: Zweikampf zuerst, Stürmer: Offensive zuerst, ...) - eine Spalte pro Kennzahl statt einem Blend-Wert (unterschiedliche Skalen wie Note/Prozent/Pro-90-Rate lassen sich nicht sinnvoll mitteln). Absolute Zähler (z. B. Gewonnene Zweikämpfe) werden automatisch auf "pro 90 Minuten" umgerechnet. Standardmäßig ebenfalls nach der Positionsspalte sortiert (Feldreihenfolge TW → ST). Dieselbe Taktik-Beschränkung und derselbe Vermerk wie bei Qualität je Position
- Standardsituationen & Führung: Top-5-Vorschläge für Eckbälle, Freistöße, Elfmeter und Führung (Kapitän/Stellvertreter), je Kategorie frei wählbare Attribute. Freistöße/Elfmeter/Führung nutzen mangels eigener FM-Attribute im Export eine Näherung aus ähnlichen Attributen (klar gekennzeichnet)

### Explizit nicht in V1

Transfer-Scouting (Spieler außerhalb des eigenen Kaders), automatische Taktik-/Formationserkennung, Verlaufsspeicherung über mehrere Importe.

Jeder Handlungsbedarf-Eintrag zeigt direkt in der Liste, welche Werte ihn ausgelöst haben (z. B. Gehalt + Note vs. Kader-Ø beim Verkaufskandidat), statt nur den Spielernamen.

## Erweiterungspunkte (für später, nicht in V1 umgesetzt)

- Transfer-Scouting (Spieler außerhalb des eigenen Kaders)
- Weitere Design-Politur: responsiveres Layout für schmale Bildschirme, evtl. Dark Mode (aktuell bewusst nicht umgesetzt, siehe unten); Diagramme für Kaderweite Auswertungen statt nur Tabellen (z. B. Altersverteilung, Gehaltsstruktur, Vertragslaufzeiten) - das Balken-Chart-Muster aus dem Spielervergleich ließe sich dafür wiederverwenden
- Druck-/Exportansicht: Dashboard oder Kaderübersicht sauber als PDF/Bild ausgeben, z. B. zum Teilen oder Ausdrucken

### Backlog – vage Ideen, wahrscheinlich nicht umgesetzt

Diese zwei sind bewusst nur als "mal drüber nachgedacht" festgehalten, nicht als geplante Erweiterung - eher zum Verwerfen als zum Umsetzen tendiert, aber der Vollständigkeit halber notiert:

- **U18-/U21-/Reserve-Team:** Technisch machbar (siehe unten), aber der Nutzen ist fraglich gegenüber dem Aufwand. Kadertiefe, Qualität/Leistung je Position und die meisten Handlungsbedarf-Regeln gehen aktuell implizit von einem reinen Erste-Mannschaft-Import aus - bei einem gemischten Import müsste vorher nach Team gefiltert werden, sonst verwässern Jugendspieler diese Auswertungen. Das wäre mehr Umbau als der Nutzen (gelegentlich einen Jugendspieler hochziehen) hergibt.
- **Leihspieler:** Ginge technisch einfach (falls der Export dafür überhaupt Noten/Stats liefert), aber der praktische Nutzen ist gering - so wenige Leihspieler lassen sich auch einfach im Spiel selbst kurz überblicken, ohne eigenen Report dafür.
- **Trainerkarriere-Historie/Titel:** Anders als die anderen beiden kein CSV-Import, sondern manuelle Eingabe (Saison, Titel/Ereignis, freier Kommentar) - technisch simpel, dieselbe Persistenz wie bei den Notizen (dauerhaft in `localStorage`, wandert in die Sicherungsdatei, nur manuell löschbar statt automatisch überschrieben). Inhaltlich aber losgelöst vom Kaderanalyse-Zweck der App (Karriere-Tagebuch statt Kaderauswertung) - technisch kein Hindernis, eher eine Scope-Frage, noch nicht entschieden.

### Persistenz (umgesetzt)

Kaderstand (die importierte CSV), Taktik-Board, Spieldatum und die Handlungsbedarf-Schwellenwerte werden automatisch in `localStorage` gespeichert und beim Öffnen direkt geladen (`js/storage.js`) - kein manuelles Hochladen, kein Klicken. Zusätzlich als Sicherheitsnetz: Export/Import einer Sicherungsdatei (JSON) über die Buttons "Sicherung speichern"/"Sicherung laden" - für Rechnerwechsel, Backup, oder falls der Browser-Speicher mal geleert wird/verloren geht. Diese Datei kann der Nutzer selbst z. B. in einen Cloud-Ordner legen, ganz ohne dass die App eine eigene Cloud-Anbindung braucht. Ein "Gespeicherten Kader löschen"-Button setzt alles zurück.

Bewusst nicht umgesetzt: eine echte Cloud-Anmeldung direkt in der App (Login, Token, Internetzugriff nötig) - deutlich mehr Aufwand/Fragilität für denselben Alltagsnutzen, den die automatische lokale Speicherung bereits liefert.

Bleibt an diesen einen Browser/dieses Profil auf diesem Rechner gebunden - bei Browserwechsel oder gelöschten Browserdaten ist der automatisch gespeicherte Stand weg (dafür ist die Sicherungsdatei da). Kein Ablaufdatum - eine Pause von Wochen/Monaten macht keinen Unterschied.

### Baut auf der Persistenz auf

**Umgesetzt:** Vergleich zum letzten Import (Neuzugänge/Abgänge/Status-/Vertragsänderungen) und Durchschnittsnote-Fallback aus der Vorsaison - siehe oben im Funktionsumfang. Bewusst nur *einen* Schritt zurück (kein voller Verlauf über mehrere Zeitpunkte) - reicht für "was hat sich seit dem letzten Mal geändert" und den Saisonwechsel-Fall, ohne die Komplexität einer echten Historie.

**Ebenfalls umgesetzt:** Notizen je Spieler (Freitext, z. B. "beobachten", "auf keinen Fall verkaufen") - editierbar im Spielerprofil, sichtbar als eigene Spalte in der Kaderübersicht. Verknüpft über `Unique ID`, bleiben deshalb über Re-Importe hinweg erhalten (anders als der Kaderstand selbst) und wandern mit in die Sicherungsdatei. Werden beim "Gespeicherten Kader löschen" mit zurückgesetzt. Ein `storage`-Event hält die Kaderübersicht aktuell, wenn eine Notiz im separaten Spielerprofil-Tab geändert wird.

**Nächste Schritte, falls gewünscht:**

- Voller Verlaufs-Import: mehr als einen Zeitpunkt zurück speichern und durchblättern/vergleichen (statt nur "aktuell vs. direkt davor")
