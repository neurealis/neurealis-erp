# Softr.io Database Schema - neurealis Portal

**Database ID:** `e74de047-f727-4f98-aa2a-7bda298672d3`
**Letzte Aktualisierung:** 2026-01-25

---

## Änderungsprotokoll

### 2026-01-25: Mängelmanagement Unified

**7 neue Felder** in Tabelle `J563LaZ43bZSQy` (Mängel nach Fertigstellung) via API erstellt:

| Feld | Typ | ID | Beschreibung |
|------|-----|----|----|
| NUA-Nr | SINGLE_LINE_TEXT | `qxHu4` | Nachunternehmer-Auftragsnummer |
| Projektname komplett | SINGLE_LINE_TEXT | `FF4FP` | Interner Projektname |
| Kommentar NU | LONG_TEXT | `LQPDA` | Antwort vom Nachunternehmer |
| Status Mangel NU | SELECT | `mhgIW` | `Offen`, `Behoben` |
| Fotos Nachweis NU | ATTACHMENT | `zBq5l` | Fotos als Beweis der Behebung |
| Mangel behoben Datum | DATETIME | `3v0hM` | Wann behoben |
| NU E-Mail | EMAIL | `TFj9o` | Für automatische Erinnerungen |

**Art des Mangels** (Feld `4qiAo`) erweitert um: `Ausführung`

---

## Inhaltsverzeichnis

1. [Protokolle Abnahmen](#protokolle-abnahmen)
2. [Maengel nach Fertigstellung](#maengel-nach-fertigstellung)
3. [Aufgaben NEU](#aufgaben-neu)
4. [Dokumente](#dokumente)
5. [Konto - Transaktionen](#konto---transaktionen)
6. [Kontakte](#kontakte)
7. [Ausfuehrungsmaengel](#ausfuehrungsmaengel)
8. [Leistungsverzeichnisse](#leistungsverzeichnisse)
9. [Einzelgewerke](#einzelgewerke)
10. [Personal - Bewerber](#personal---bewerber)
11. [Logs - VAPI](#logs---vapi)
12. [Angebotserstellung](#angebotserstellung)
13. [2025 08 04 Monday Backup Bau ](#2025-08-04-monday-backup-bau-)
14. [Leads](#leads)
15. [Inventar](#inventar)
16. [Projekt - Umsatz](#projekt---umsatz)

---

## Protokolle Abnahmen

**Table ID:** `baeVoaT73WSuFr`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| ID Abnahme | AUTONUMBER | `oQuGk` | - | Ja |
| ProjektNr | SINGLE_LINE_TEXT | `l2ydM` | - | - |
| recordId | NUMBER | `bWRss` | - | - |
| Art Protokoll | SELECT | `S9NCF` | - | - |
| Status | SELECT | `9dDnr` | - | - |
| Datum | DATETIME | `LSzyK` | - | - |
| Bauleiter | SINGLE_LINE_TEXT | `4xvj4` | - | - |
| Projektname_extern | SINGLE_LINE_TEXT | `EqBeQ` | - | - |
| Adresse | SINGLE_LINE_TEXT | `mvANO` | - | - |
| Kunde | SINGLE_LINE_TEXT | `v2KwI` | - | - |
| Elektrik - Vollständige & korrekte Verlegung aller Leitungen | SELECT | `BcGme` | - | - |
| Elektrik - Verlegetiefen und Mindestabstände eingehalten | SELECT | `kv8MV` | - | - |
| Elektrik - Schutz gegen mechanische Beschädigung / Leitungen abgedeckt | SELECT | `jfe7O` | - | - |
| Elektrik - Kontrolle Unterverteilungen/Anschlüsse vollständig/ordnungsgemäß | SELECT | `0nJYS` | - | - |
| Elektrik - Ist die Unterverteilung vorverdrahtet? | SELECT | `mR72z` | - | - |
| Elektrik - Einhaltung VDE-Normen & Sicherheitsvorschriften | SELECT | `9luss` | - | - |
| Elektrik - FI-Schutzschalter vorhanden und ordnungsgemäß | SELECT | `0WvcX` | - | - |
| Elektrik - Erdung und Potentialausgleich vorhanden & geprüft | SELECT | `UDE1f` | - | - |
| Elektrik - Funktionaler Überspannungsschutz geprüft | SELECT | `jxF3p` | - | - |
| Beschreibung festgestellter Mängel | LONG_TEXT | `fM5fx` | - | - |
| Fotos | ATTACHMENT | `IExFL` | - | - |
| Sanitär - Fachgerechte Verlegung und Befestigung aller Sanitärleitungen und Rohre | SELECT | `09rit` | - | - |
| Sanitär - Verwendung zugelassener Materialien in korrekter Dimensionierung | SELECT | `jlc1A` | - | - |
| Sanitär - Durchführung der Dichtheitsprüfung (Druckprobe) | SELECT | `wdp01` | - | - |
| Sanitär - Überprüfung der Maßhaltigkeit und korrekten Lage aller Anschlüsse (WC, Waschbecken, Dusche etc.) | SELECT | `usYN1` | - | - |
| Sanitär - Funktionierende Absperrarmaturen an allen relevanten Stellen | SELECT | `Ruxqc` | - | - |
| Sanitär - Sicherstellung der ordnungsgemäßen Belüftung und Entwässerung (Gefälle einhalten) | SELECT | `LOAsm` | - | - |
| Abdichtung – Sauberer, trockener, ebener und tragfähiger Untergrund ohne lose Teile oder Verschmutzungen | SELECT | `IiqWi` | - | - |
| Abdichtung – Vollständige, lückenlose Abdichtung nach DIN 18534 | SELECT | `8JsIM` | - | - |
| Abdichtung – Korrekte Ausführung an Ecken, Durchdringungen und Anschlüssen mit Dichtmanschetten und Dichtbändern | SELECT | `82hAc` | - | - |
| Abdichtung – Berücksichtigung und Abdichtung von Bewegungsfugen | SELECT | `KLVR4` | - | - |
| Abdichtung – Einhaltung der Trocknungszeiten vor Beginn weiterer Arbeiten (z. B. Fliesenlegen) | SELECT | `FnhzT` | - | - |
| Abdichtung – Schutz der Abdichtung vor Beschädigungen während der Folgearbeiten | SELECT | `0USgN` | - | - |
| Abdichtung – Bei Verwendung von Flüssigabdichtungen: Sichtkontrolle durch zweifarbige Applikation | SELECT | `aYNwo` | - | - |
| Allgemein - Art der Teilabnahme | SELECT | `9Tdw2` | - | - |
| Allgemein – Bauzeitenplan einhalten und dokumentieren | SELECT | `3zZ7T` | - | - |
| Allgemein – Baustellensicherheit und Ordnung prüfe | SELECT | `USon9` | - | - |
| Allgemein – Einhaltung von Arbeitsschutz- und Umweltvorschriften kontrollieren | SELECT | `iyGk8` | - | - |
| Allgemein – Vollständigkeit und Qualität der eingesetzten Materialien prüfen | SELECT | `zCeUg` | - | - |
| Rohbau – Fertigstellung der Mauerwerksarbeiten gemäß Plan | SELECT | `VSiM2` | - | - |
| Rohbau – Kontrolle der Öffnungen (Fenster, Türen) auf Maßhaltigkeit und Ausführung | SELECT | `KlUBh` | - | - |
| Rohbau – Einhaltung der Schalldämm- und Wärmedämmvorgaben | SELECT | `RhfnQ` | - | - |
| Rohbau – Sichtprüfung auf Risse, Beschädigungen und saubere Verarbeitung | SELECT | `TxsfB` | - | - |
| Fliesen – Untergrundvorbereitung prüfen (eben, trocken, sauber) | SELECT | `IGfj2` | - | - |
| Fliesen – Fachgerechte Verlegung gemäß Material- und Herstellervorgaben | SELECT | `mIu76` | - | - |
| Fliesen – Fugenausbildung und Fugenbreite kontrollieren | SELECT | `qeDqN` | - | - |
| Fliesen – Saubere und beschädigungsfreie Oberfläche | SELECT | `W9meQ` | - | - |
| Maler – Vorbereitung der Flächen (z.B. Spachtelarbeiten, Schleifen) | SELECT | `qfBco` | - | - |
| Maler – Ordnungsgemäße Ausführung der Anstriche und Beschichtungen | SELECT | `0MLh2` | - | - |
| Maler – Einhaltung der Farbvorgaben und Qualitätsstandards | SELECT | `NrX8b` | - | - |
| Maler – Sauberkeit und Schutz angrenzender Bauteile | SELECT | `BWCyL` | - | - |
| Boden – Untergrund auf Ebenheit, Trockenheit und Sauberkeit geprüft | SELECT | `ghGFT` | - | - |
| Boden – Korrekte Verlegung und Befestigung des Bodenbelags nach Herstellervorgaben | SELECT | `PwDe0` | - | - |
| Boden – Einhaltung der Dehnungsfugen und Anschlussfugen gemäß Planung | SELECT | `ADt4c` | - | - |
| Boden – Saubere, gleichmäßige Oberfläche ohne Beschädigungen oder Verschmutzungen | SELECT | `9bDYb` | - | - |
| Tischler – Passgenaue Montage der Einbauteile (z. B. Türen, Zargen, Möbel) geprüft | SELECT | `nsToJ` | - | - |
| Tischler – Kontrolle der Beschläge und Funktionalität (z. B. Scharniere, Schlösser, Griffe) | SELECT | `Uq5ye` | - | - |
| Tischler – Prüfung der Oberflächen auf Beschädigungen und fachgerechte Endbehandlung | SELECT | `7xIxI` | - | - |
| Tischler – Fugen und Übergänge zu angrenzenden Bauteilen sauber und gleichmäßig ausgeführt | SELECT | `xwRey` | - | - |
| Endabnahme - Weitere Beteiligte | LONG_TEXT | `q7u0r` | - | - |
| Art des Mangels (Maengel) | LOOKUP | `G7aT6` | - | Ja |
| ProjektNr (Maengel) | LOOKUP | `naNIP` | - | Ja |
| Endabnahme - Mängel Übersicht | LOOKUP | `oOFI4` | - | Ja |
| Endabnahme - Beschreibung der abgenommenen Leistungen gemäß  AB-Nr. | SINGLE_LINE_TEXT | `HCK1h` | - | - |
| Endabnahme - Weitere Notizen | LONG_TEXT | `QZXCI` | - | - |
| Endabnahme - Datum Nachabnahme | DATETIME | `xyxVu` | - | - |
| Endabnahme - Unterschrift Auftraggeber | ATTACHMENT | `h8GfQ` | - | - |
| Endabnahme - Unterschrift Bauleiter neurealis | ATTACHMENT | `mwVq2` | - | - |

**Select-Optionen:**

- **Art Protokoll:** `Rohinstallation Elektrik`, `Rohinstallation Sanitär`, `Abdichtung Bad`, `Kontrolle des Baufortschritts`, `Interne Vorabnahme`, `Endabnahme Kunde`
- **Status:** `Bestanden`, `Bestanden, vorbehaltlich der Mangelbehebung`, `Nicht bestanden`
- **Elektrik - Vollständige & korrekte Verlegung aller Leitungen:** `Ja`, `Nein`
- **Elektrik - Verlegetiefen und Mindestabstände eingehalten:** `Ja`, `Nein`
- **Elektrik - Schutz gegen mechanische Beschädigung / Leitungen abgedeckt:** `Ja`, `Nein`
- **Elektrik - Kontrolle Unterverteilungen/Anschlüsse vollständig/ordnungsgemäß:** `Ja`, `Nein`
- **Elektrik - Ist die Unterverteilung vorverdrahtet?:** `Ja, verdrahtet`, `Nein, nicht verdrahtet`
- **Elektrik - Einhaltung VDE-Normen & Sicherheitsvorschriften:** `Ja`, `Nein`
- **Elektrik - FI-Schutzschalter vorhanden und ordnungsgemäß:** `Ja`, `Nein`
- **Elektrik - Erdung und Potentialausgleich vorhanden & geprüft:** `Ja`, `Nein`
- **Elektrik - Funktionaler Überspannungsschutz geprüft:** `Ja`, `Nein`
- **Sanitär - Fachgerechte Verlegung und Befestigung aller Sanitärleitungen und Rohre:** `Ja`, `Nein`
- **Sanitär - Verwendung zugelassener Materialien in korrekter Dimensionierung:** `Ja`, `Nein`
- **Sanitär - Durchführung der Dichtheitsprüfung (Druckprobe):** `Ja`, `Nein`
- **Sanitär - Überprüfung der Maßhaltigkeit und korrekten Lage aller Anschlüsse (WC, Waschbecken, Dusche etc.):** `Ja`, `Nein`
- **Sanitär - Funktionierende Absperrarmaturen an allen relevanten Stellen:** `Ja`, `Nein`
- **Sanitär - Sicherstellung der ordnungsgemäßen Belüftung und Entwässerung (Gefälle einhalten):** `Ja`, `Nein`
- **Abdichtung – Sauberer, trockener, ebener und tragfähiger Untergrund ohne lose Teile oder Verschmutzungen:** `Ja`, `Nein`
- **Abdichtung – Vollständige, lückenlose Abdichtung nach DIN 18534:** `Ja`, `Nein`
- **Abdichtung – Korrekte Ausführung an Ecken, Durchdringungen und Anschlüssen mit Dichtmanschetten und Dichtbändern:** `Ja`, `Nein`
- **Abdichtung – Berücksichtigung und Abdichtung von Bewegungsfugen:** `Ja`, `Nein`
- **Abdichtung – Einhaltung der Trocknungszeiten vor Beginn weiterer Arbeiten (z. B. Fliesenlegen):** `Ja`, `Nein`
- **Abdichtung – Schutz der Abdichtung vor Beschädigungen während der Folgearbeiten:** `Ja`, `Nein`
- **Abdichtung – Bei Verwendung von Flüssigabdichtungen: Sichtkontrolle durch zweifarbige Applikation:** `Ja`, `Nein`
- **Allgemein - Art der Teilabnahme:** `Rohbau`, `Fliesen`, `Maler`, `Boden`, `Tischler`
- **Allgemein – Bauzeitenplan einhalten und dokumentieren:** `Ja`, `Nein`
- **Allgemein – Baustellensicherheit und Ordnung prüfe:** `Ja`, `Nein`
- **Allgemein – Einhaltung von Arbeitsschutz- und Umweltvorschriften kontrollieren:** `Ja`, `Nein`
- **Allgemein – Vollständigkeit und Qualität der eingesetzten Materialien prüfen:** `Ja`, `Nein`
- **Rohbau – Fertigstellung der Mauerwerksarbeiten gemäß Plan:** `Ja`, `Nein`
- **Rohbau – Kontrolle der Öffnungen (Fenster, Türen) auf Maßhaltigkeit und Ausführung:** `Ja`, `Nein`
- **Rohbau – Einhaltung der Schalldämm- und Wärmedämmvorgaben:** `Ja`, `Nein`
- **Rohbau – Sichtprüfung auf Risse, Beschädigungen und saubere Verarbeitung:** `Ja`, `Nein`
- **Fliesen – Untergrundvorbereitung prüfen (eben, trocken, sauber):** `Ja`, `Nein`
- **Fliesen – Fachgerechte Verlegung gemäß Material- und Herstellervorgaben:** `Ja`, `Nein`
- **Fliesen – Fugenausbildung und Fugenbreite kontrollieren:** `Ja`, `Nein`
- **Fliesen – Saubere und beschädigungsfreie Oberfläche:** `Ja`, `Nein`
- **Maler – Vorbereitung der Flächen (z.B. Spachtelarbeiten, Schleifen):** `Ja`, `Nein`
- **Maler – Ordnungsgemäße Ausführung der Anstriche und Beschichtungen:** `Ja`, `Nein`
- **Maler – Einhaltung der Farbvorgaben und Qualitätsstandards:** `Ja`, `Nein`
- **Maler – Sauberkeit und Schutz angrenzender Bauteile:** `Ja`, `Nein`
- **Boden – Untergrund auf Ebenheit, Trockenheit und Sauberkeit geprüft:** `Bestanden`, `Nicht bestanden`
- **Boden – Korrekte Verlegung und Befestigung des Bodenbelags nach Herstellervorgaben:** `Bestanden`, `Nicht bestanden`
- **Boden – Einhaltung der Dehnungsfugen und Anschlussfugen gemäß Planung:** `Bestanden`, `Nicht bestanden`
- **Boden – Saubere, gleichmäßige Oberfläche ohne Beschädigungen oder Verschmutzungen:** `Bestanden`, `Nicht bestanden`
- **Tischler – Passgenaue Montage der Einbauteile (z. B. Türen, Zargen, Möbel) geprüft:** `Bestanden`, `Nicht bestanden`
- **Tischler – Kontrolle der Beschläge und Funktionalität (z. B. Scharniere, Schlösser, Griffe):** `Bestanden`, `Nicht bestanden`
- **Tischler – Prüfung der Oberflächen auf Beschädigungen und fachgerechte Endbehandlung:** `Bestanden`, `Nicht bestanden`
- **Tischler – Fugen und Übergänge zu angrenzenden Bauteilen sauber und gleichmäßig ausgeführt:** `Bestanden`, `Nicht bestanden`

---

## Maengel nach Fertigstellung

**Table ID:** `J563LaZ43bZSQy`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Mangel-ID | SINGLE_LINE_TEXT | `1UqYa` | - | - |
| Id | AUTONUMBER | `XUtl4` | - | Ja |
| ProjektNr | SINGLE_LINE_TEXT | `QEcc2` | - | - |
| Status Mangel | SELECT | `YUT8c` | - | - |
| Art des Mangels | SELECT | `4qiAo` | - | - |
| BV | SINGLE_LINE_TEXT | `uaDbm` | - | - |
| Kunde | Name | SINGLE_LINE_TEXT | `bC4R6` | - | - |
| Kunde  E-Mail | EMAIL | `Nv4yH` | - | - |
| Kunde | Telefon | PHONE | `kgCJK` | - | - |
| Datum_meldung | DATETIME | `2la7j` | - | - |
| Datum_Frist | DATETIME | `aGWIf` | - | - |
| Beschreibung_mangel | LONG_TEXT | `ozrIj` | - | - |
| Bauleiter | SINGLE_LINE_TEXT | `ctNAI` | - | - |
| Fotos_Mangel | ATTACHMENT | `aScwq` | - | - |
| Klassifizierung_berechtigt | SELECT | `ajOOV` | - | - |
| Benoetigte_Abnahmen_VorOrt | NUMBER | `NEaCG` | - | - |
| Begründung_klassifizierung | LONG_TEXT | `eKqU2` | - | - |
| Protokoll_datum_kunde | DATETIME | `mEyLK` | - | - |
| Ergebnis_Besprechung | LONG_TEXT | `wAP8D` | - | - |
| Maßnahmen_zur_behebung | LONG_TEXT | `WVchQ` | - | - |
| Nachunternehmer | SINGLE_LINE_TEXT | `4uDJM` | - | - |
| Mieter | Name | SINGLE_LINE_TEXT | `v4wjk` | - | - |
| Mieter | Rufnummer | PHONE | `1erul` | - | - |
| Mieter | E-Mail | EMAIL | `l18Kt` | - | - |
| Mieter | Status | SELECT | `s8fdT` | - | - |
| Mieter | Notizen | LONG_TEXT | `9PPnm` | - | - |
| Aufgaben | SINGLE_LINE_TEXT | `8JQ5m` | - | - |
| Kosten | CURRENCY | `jFILZ` | - | - |
| URL_BV | URL | `Oj9Gp` | - | - |
| URL_BV_Tab | FORMULA | `ejH6T` | - | Ja |
| Verknüpftes Protokoll | LINKED_RECORD | `EQr7h` | - | - |

**Select-Optionen:**

- **Status Mangel:** `(0) Offen`, `(1) In Bearbeitung`, `(2) Abgeschlossen`, `(3) Abgelehnt`
- **Art des Mangels:** `Endabnahme`, `Gewährleistung`
- **Klassifizierung_berechtigt:** `(1) Mangel berechtigt`, `(0) Mangel unberechtigt`
- **Mieter | Status:** `(0) Mieter noch kontaktieren`, `(1) Mieter nicht erreicht`, `(2) Termin vereinbart`, `(3) Termin ausgefallen`, `(4) Erdledigt`

**Verknuepfungen:**

- **Verknüpftes Protokoll** -> Tabelle `baeVoaT73WSuFr`

---

## Aufgaben NEU

**Table ID:** `RJGAYKFdDDxosc`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Aufgaben-id | FORMULA | `z1S89` | - | Ja |
| AutoNummer | AUTONUMBER | `0C7tH` | - | Ja |
| Aufgabentyp | SELECT | `Z6VCn` | - | - |
| Titel | SINGLE_LINE_TEXT | `NCBBu` | - | - |
| Beschreibung | SINGLE_LINE_TEXT | `cXMQO` | - | - |
| Atbs nummer | SINGLE_LINE_TEXT | `mN8E1` | - | - |
| Nua nummer | SINGLE_LINE_TEXT | `674G4` | - | - |
| Name bv | SINGLE_LINE_TEXT | `eCiaq` | - | - |
| Link zum bv | URL | `uHvRd` | - | - |
| Bauvorhaben (record/related) | SINGLE_LINE_TEXT | `i0lrG` | - | - |
| Nachunternehmer (kontakt) | LINKED_RECORD | `ef9tt` | - | - |
| Verantwortlicher (kontakt) | LINKED_RECORD | `OW3M8` | - | - |
| Sichtbarkeit | SELECT | `o9r1Z` | - | - |
| Status | SELECT | `dsqhX` | - | - |
| Priorität | SELECT | `6SW43` | - | - |
| Datum erstellt | DATETIME | `Nupzi` | - | - |
| Datum Fälligkeit | DATETIME | `D1YfP` | - | - |
| Datum erledigt | DATETIME | `EsGyy` | - | - |
| Dokument | LINKED_RECORD | `IRSq7` | - | - |
| Dokument Datei (Dokumente) | LOOKUP | `Fjv8k` | - | Ja |
| Dokument | Link (Dokumente) | LOOKUP | `4MeUe` | - | Ja |
| RE Ansicht URL Link | LOOKUP | `S6iTH` | - | Ja |
| Mangel (related record) | SINGLE_LINE_TEXT | `nEGu8` | - | - |
| Freigabe erforderlich | SELECT | `pDNY3` | - | - |
| Freigabe-typ | SELECT | `p3DRi` | - | - |
| Freigabe status | SELECT | `ulnJE` | - | - |
| Freigegeben von (kontakt) | SINGLE_LINE_TEXT | `IlG1L` | - | - |
| Freigegeben am | DATETIME | `pYyt5` | - | - |
| Notizen | SINGLE_LINE_TEXT | `35ZWn` | - | - |
| Interne notizen | SINGLE_LINE_TEXT | `WxkDy` | - | - |
| Record id | RECORD_ID | `b7yNB` | - | Ja |

**Select-Optionen:**

- **Aufgabentyp:** `AR-A – Ausgangsrechnung Abschlag`, `AR-S – Ausgangsrechnung Schluss`, `AR-Si – Ausgangsrechnung Sicherheitseinbehalt`, `ER-NU-A – Eingangsrechnung NU Abschlag`, `ER-NU-S – Eingangsrechnung NU Schluss`, `ER-M – Eingangsrechnung Material`, `ER-NU-M – Eingangsrechnung Material Nachunternehmer Abzug`, `Budget-NU-P – NU-Budget Plan bei Start`, `Budget-NU-F – NU-Budget Final nach Abschluss`, `AB – Auftragsbestätigung` ... (+31 weitere)
- **Sichtbarkeit:** `intern`, `extern`
- **Status:** `(0) offen`, `(1) wartend`, `(2) in Arbeit`, `(3) erledigt`
- **Priorität:** `(0) niedrig`, `(1) mittel`, `(2) hoch`, `(3) kritisch`
- **Freigabe erforderlich:** `ja`, `nein`
- **Freigabe-typ:** `FR-BL`, `FR-BS`, `FR-AZ`
- **Freigabe status:** `ausstehend`, `in Prüfung`

**Verknuepfungen:**

- **Nachunternehmer (kontakt)** -> Tabelle `VzvQUdlHStrRtN`
- **Verantwortlicher (kontakt)** -> Tabelle `VzvQUdlHStrRtN`
- **Dokument** -> Tabelle `kNjsEhYYcNjAsj`

---

## Dokumente

**Table ID:** `kNjsEhYYcNjAsj`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Dokument Beschreibung | FORMULA | `QLC75` | - | Ja |
| Dokument-Nr | SINGLE_LINE_TEXT | `8Ae7U` | - | - |
| Art des Dokuments | SELECT | `6tf0K` | - | - |
| Rechnungssteller | SINGLE_LINE_TEXT | `CplA5` | - | - |
| Rechnungssteller E-Mail | EMAIL | `IjdAH` | - | - |
| ATBS-Nr | SINGLE_LINE_TEXT | `GBc7t` | - | - |
| NUA-Nr | SINGLE_LINE_TEXT | `7xrdk` | - | - |
| Bauvorhaben | SINGLE_LINE_TEXT | `1sWGL` | - | - |
| Status Prüfung | SELECT | `VQ6v9` | - | - |
| Status Zahlung | SELECT | `DRCKl` | - | - |
| Betrag (brutto) | NUMBER | `kukJI` | - | - |
| Dokument Datei | ATTACHMENT | `MRwYN` | - | - |
| Betrag (netto) | NUMBER | `QuHkO` | - | - |
| Verspätung NU in Tagen | FORMULA | `qonjK` | - | Ja |
| Vertragsstrafe in % je Kalendertag | NUMBER | `fwus5` | - | - |
| Vertragsstrafe gesamt | FORMULA | `YUDGn` | - | Ja |
| Einkäufe für NU | NUMBER | `OYQZu` | - | - |
| Betrag bezahlt | NUMBER | `vVD6w` | - | - |
| Betrag offen | FORMULA | `ptIjX` | - | Ja |
| Abschlag in % | NUMBER | `ng7OV` | - | - |
| Datum erstellt | DATETIME | `DAXGa` | - | - |
| Datum verschickt | DATETIME | `ItPKa` | - | - |
| BV Ende NU | Plan | DATETIME | `25nEy` | - | - |
| BV Ende NU | Mängelfrei | DATETIME | `7hwYG` | - | - |
| Zahlungsziel | NUMBER | `OGaBK` | - | - |
| Datum fällig | DATETIME | `46NkV` | - | - |
| Datum bezahlt | DATETIME | `MG2bx` | - | - |
| Notizen | LONG_TEXT | `iHzHD` | - | - |
| Dokument | Link | URL | `cIP4K` | - | - |
| BV Link | URL | `H7KEI` | - | - |
| Inhalt (raw) | LONG_TEXT | `GyRzg` | - | - |
| Upload zu OneDrive | CHECKBOX | `P51Jw` | - | - |
| KI Infos | LONG_TEXT | `OKcBc` | - | - |
| Aufgaben NEU | LINKED_RECORD | `lnULt` | - | - |
| RE ansicht LINK URL | FORMULA | `xMHBE` | - | Ja |
| RecordID | RECORD_ID | `6j7NP` | - | Ja |
| Projekt - Umsatz | LINKED_RECORD | `8bo0T` | - | - |
| Projekt - Umsatz 2 | LINKED_RECORD | `mM3ao` | - | - |
| Projekt - Umsatz 3 | LINKED_RECORD | `qzjOr` | - | - |

**Select-Optionen:**

- **Art des Dokuments:** `AR-A  Ausgangsrechnung - Abschlag`, `AR-S  Ausgangsrechnung - Schluss`, `AR-Si Ausgangsrechnung - Sicherheitseinbehalt`, `AR-Zahl Zahlungseingang Ausgangsrechnung`, `ER-NU-A  Eingangsrechnung NU - Abschlag`, `ER-NU-S  Eingangsrechnung NU - Schluss`, `ER-M  Eingangsrechnung - Material`, `ER-NU-M  Eingangsrechnung - Material NU Abzug`, `ER-Zahl Zahlungsausgang Eingangsrechnung`, `A Avis` ... (+16 weitere)
- **Status Prüfung:** `(0) Offen`, `(1) Erhalten / Erfasst`, `(2) Prüfung BL`, `(3) Prüfung Kfm`, `(4) Freigegeben`, `(5) Abgewiesen`, `(7) Ausblenden`
- **Status Zahlung:** `(0) Offen`, `(1) Zahlung geplant`, `(2) Teilzahlung`, `(2) KI Import`, `(3) Überfällig`, `(4) In Mahnung`, `(5) Bezahlt`, `(5) Bezahlt mit Abzug / Skonto`, `(5) Bezahlt, zu viel`, `(6) Uneinbringlich / Inkasso` ... (+1 weitere)

**Verknuepfungen:**

- **Aufgaben NEU** -> Tabelle `RJGAYKFdDDxosc`
- **Projekt - Umsatz** -> Tabelle `trBGeNEBfm2Jf7`
- **Projekt - Umsatz 2** -> Tabelle `trBGeNEBfm2Jf7`
- **Projekt - Umsatz 3** -> Tabelle `trBGeNEBfm2Jf7`

---

## Konto - Transaktionen

**Table ID:** `XXJFvICfFvbXkY`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Transaktions-uid | NUMBER | `QblUD` | - | - |
| Auto Nummer | AUTONUMBER | `ISiEe` | - | Ja |
| Verknüpft mit RE | SELECT | `qlVAr` | - | - |
| Record id | RECORD_ID | `Yk5Kj` | - | Ja |
| Konto-uid (gmi) | NUMBER | `KcZFn` | - | - |
| Bankkonto-uid | NUMBER | `Tg6df` | - | - |
| Buchungsdatum | DATETIME | `6b4XF` | - | - |
| Verwendungszweck (rohtext) | SINGLE_LINE_TEXT | `N3HtC` | - | - |
| Betrag | CURRENCY | `VTmwO` | - | - |
| Währungscode | SELECT | `t6ybB` | - | - |
| Kontoname | SELECT | `LVqOI` | - | - |
| Transaktionsstatus | SINGLE_LINE_TEXT | `11kT1` | - | - |
| Gläubiger-id / creditor id | SINGLE_LINE_TEXT | `iI47E` | - | - |
| Zahlungspartner name | SINGLE_LINE_TEXT | `fTiZI` | - | - |
| Tags | SELECT | `v9qkS` | - | - |
| Verarbeitet am | DATETIME | `cAzLD` | - | - |
| Atbs-nr | SINGLE_LINE_TEXT | `YfcGr` | - | - |
| RE-Nr | SINGLE_LINE_TEXT | `7J0YZ` | - | - |
| RE-Nr Zahl | SINGLE_LINE_TEXT | `4CNE4` | - | - |
| NUA-Nr | SINGLE_LINE_TEXT | `RXGvn` | - | - |
| Ki notizen | SINGLE_LINE_TEXT | `GBdNE` | - | - |
| Dokujment | LINKED_RECORD | `sQN1W` | - | - |
| Rohdaten (json) | LONG_TEXT | `1TGLx` | - | - |
| Datei | LOOKUP | `SEXMc` | - | Ja |

**Select-Optionen:**

- **Verknüpft mit RE:** `(0) Nein`, `(1) Ja`
- **Währungscode:** `EUR`
- **Kontoname:** `NationalBank Stammkonto`, `DoVoBa - Stammkonto`
- **Tags:** `Einnahme`, `Fahrzeug`, `Gehalt`, `Leasing`, `Sonstiges`

**Verknuepfungen:**

- **Dokujment** -> Tabelle `kNjsEhYYcNjAsj`

---

## Kontakte

**Table ID:** `VzvQUdlHStrRtN`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Name Gesamt | FORMULA | `c9q0c` | - | Ja |
| Interne kontakt-id | AUTONUMBER | `Or2O1` | - | Ja |
| Kontakt aktiv | SELECT | `FiJ0o` | - | - |
| Kontaktarten | SELECT | `XedRB` | - | - |
| Anrede | SELECT | `syHos` | - | - |
| Titel | SINGLE_LINE_TEXT | `5m0sz` | - | - |
| Unternehmensname kurz | SINGLE_LINE_TEXT | `fSaxT` | - | - |
| Unternehmensname lang | SINGLE_LINE_TEXT | `M4pSo` | - | - |
| Vorname | SINGLE_LINE_TEXT | `TEJzA` | - | - |
| Nachname | SINGLE_LINE_TEXT | `5q31T` | - | - |
| E-mail | EMAIL | `GequE` | - | - |
| E-mail rechnung | EMAIL | `FZau1` | - | - |
| Telefon mobil | PHONE | `JeRgU` | - | - |
| Telefon festnetz | PHONE | `6z8Bf` | - | - |
| Website | URL | `VcT47` | - | - |
| Foto/logo | ATTACHMENT | `hBQBB` | - | - |
| Notizen | LONG_TEXT | `F0YSy` | - | - |
| Rechnungsname | SINGLE_LINE_TEXT | `eTFGu` | - | - |
| Rechnungsadresse (gesamt) | SINGLE_LINE_TEXT | `EcQuK` | - | - |
| Rechnungsadresse straße | SINGLE_LINE_TEXT | `xeS8Y` | - | - |
| Rechnungsadresse plz | NUMBER | `aATaA` | - | - |
| Rechnungsadresse ort | SINGLE_LINE_TEXT | `FnmcX` | - | - |
| Rechnungsadresse land | SELECT | `exjbh` | - | - |
| Zahlungsziel tage | NUMBER | `zvkwD` | - | - |
| Abschlagszahlung prozent | NUMBER | `p7a81` | - | - |
| Dsgvo einwilligung | SELECT | `IMC4H` | - | - |
| Dsgvo datum | DATETIME | `szZca` | - | - |
| Dsgvo quelle | SINGLE_LINE_TEXT | `CYAji` | - | - |
| Dsgvo notiz | SINGLE_LINE_TEXT | `Hvkfe` | - | - |
| Erstellt am | DATETIME | `TZda3` | - | - |
| Zuletzt aktualisiert am | DATETIME | `VfNSa` | - | - |
| RecordID | RECORD_ID | `TNR2z` | - | Ja |
| Leads | LINKED_RECORD | `OD7Di` | - | - |
| Aufgaben NEU | LINKED_RECORD | `gHVOe` | - | - |
| Aufgaben NEU 2 | LINKED_RECORD | `fR4DJ` | - | - |

**Select-Optionen:**

- **Kontakt aktiv:** `(0) nein`, `(1) ja`
- **Kontaktarten:** `Kunde (Privat)`, `Kunde (gewerblich)`, `Lead`, `Mitarbeiter`, `Mitarbeiter Baustelle`, `Bewerber`, `Nachunternehmer`, `Nachunternehmer Mitarbeiter`, `Partner`, `Lieferant` ... (+4 weitere)
- **Anrede:** `Firma`, `Frau`, `Herr`, `Eigentümergemeinschaft`, `Anrede`, `Familie`
- **Rechnungsadresse land:** `Deutschland`
- **Dsgvo einwilligung:** `ja`, `nein`

**Verknuepfungen:**

- **Leads** -> Tabelle `va3BbWTn101BXJ`
- **Aufgaben NEU** -> Tabelle `RJGAYKFdDDxosc`
- **Aufgaben NEU 2** -> Tabelle `RJGAYKFdDDxosc`

---

## Ausfuehrungsmaengel

**Table ID:** `0xZkAxDadNyOMI`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Ausführungsmangel-ID | FORMULA | `IvkMt` | - | Ja |
| Mangel Nummer | AUTONUMBER | `M991G` | - | Ja |
| ProjektNr (ATBS) | SINGLE_LINE_TEXT | `OejLi` | - | - |
| NUA | Nr | SINGLE_LINE_TEXT | `C9YbR` | - | - |
| Name | Bauleiter | SINGLE_LINE_TEXT | `wxHLj` | - | - |
| Nachunternehmer | SINGLE_LINE_TEXT | `apm1H` | - | - |
| Projektname komplett | SINGLE_LINE_TEXT | `pJBBw` | - | - |
| Beschreibung BL | LONG_TEXT | `Zyn8m` | - | - |
| Kommentar NU | LONG_TEXT | `RtJ9X` | - | - |
| Status Mangel | BL | SELECT | `8HFir` | - | - |
| Status Mangel | NU | SELECT | `qJEpT` | - | - |
| Fotos des Mangels | BL | ATTACHMENT | `V7etW` | - | - |
| Fotos als Nachweise | NU | ATTACHMENT | `X7P67` | - | - |
| Mangel erstellt | Datum | DATETIME | `3ElMV` | - | - |
| Frist zur Behebung durch NU | Datum | DATETIME | `3nzTU` | - | - |
| Mangel behoben | Datum | DATETIME | `RFYoe` | - | - |
| Dauer Mangelbehebung NU | FORMULA | `3rF8W` | - | Ja |

**Select-Optionen:**

- **Status Mangel | BL:** `(0) Offen`, `(1) Nicht abgenommen`, `(2) Abgenommen`
- **Status Mangel | NU:** `Offen`, `Behoben`

---

## Leistungsverzeichnisse

**Table ID:** `WdY5U4LHNzDAsW`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Artikelnummer | SINGLE_LINE_TEXT | `fX6z9` | - | - |
| LV (Kundenname) | SINGLE_LINE_TEXT | `WusrR` | - | - |
| Kategorie | SINGLE_LINE_TEXT | `l8T6y` | - | - |
| Positionsname | SINGLE_LINE_TEXT | `NKqqp` | - | - |
| Beschreibung | LONG_TEXT | `qhXBj` | - | - |
| Listenpreis | CURRENCY | `NdeN1` | - | - |
| EK | CURRENCY | `BQUj5` | - | - |
| Einheit | SINGLE_LINE_TEXT | `zcJHy` | - | - |
| MwSt. | PERCENT | `zp3Z3` | - | - |
| Gewichtung | NUMBER | `j6T5O` | - | - |
| Status | SELECT | `UlFn5` | - | - |

**Select-Optionen:**

- **Status:** `Todo`, `In progress`, `Done`

---

## Einzelgewerke

**Table ID:** `bLgAqseB1AgVeu`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| ID | FORMULA | `irYu4` | - | Ja |
| ProjektNr | SINGLE_LINE_TEXT | `00BdN` | - | - |
| Status | SELECT | `uYMzn` | - | - |
| Gewerke | SELECT | `o3wrE` | - | - |
| Auftrags Nr. | Kunde | SINGLE_LINE_TEXT | `723cl` | - | - |
| Auftrag Kunde | Datei | ATTACHMENT | `VgaBH` | - | - |
| Rechnung Nr | Kunde | SINGLE_LINE_TEXT | `lCJIh` | - | - |
| Notizen | LONG_TEXT | `w4afU` | - | - |
| Rechnung Kunde | Datei | ATTACHMENT | `NULcB` | - | - |
| §13b USt | SELECT | `JG7zQ` | - | - |
| Rechnung Kunde | Betrag (brutto) | CURRENCY | `YsAd2` | - | - |
| Rechnung Kunde | Betrag (netto) Formel | FORMULA | `cDQmR` | - | Ja |
| Rechnung Kunde | Datum | DATETIME | `jSovs` | - | - |
| Zahlungsavis Kunde | Datei | ATTACHMENT | `9aEXU` | - | - |
| Zahlung Kunde | Datum | DATETIME | `MeAyA` | - | - |
| Gezahlt (netto) | CURRENCY | `EcWjZ` | - | - |
| Offen (brutto) | FORMULA | `E9YKG` | - | Ja |
| Dauer Zahlung | FORMULA | `u8gW1` | - | Ja |
| Kunde | SINGLE_LINE_TEXT | `HwMPY` | - | - |
| Marge | PERCENT | `x2nLd` | - | - |
| Nachunternehmer | SINGLE_LINE_TEXT | `2PCtw` | - | - |
| NU Budget (netto) | FORMULA | `Cl1D8` | - | Ja |
| RE NU | Nr. | SINGLE_LINE_TEXT | `NH1ym` | - | - |
| RE NU | Datum | DATETIME | `dVd3Q` | - | - |
| RE NU | Datei | ATTACHMENT | `8cOP0` | - | - |

**Select-Optionen:**

- **Status:** `(0) Auftrag erhalten`, `(1) Rechnung erhalten`, `(2) Zahlung offen`, `(3) Rechnung bezahlt, zu wenig`, `(4) Rechnung voll beglichen`
- **Gewerke:** `Alle Gewerke`, `Demontage`, `Sanitär`, `Heizung`, `Elektrik`, `Maler`, `Tischler`, `Boden`, `Fliesen`, `Reinigung`
- **§13b USt:** `Mit USt`, `Ohne USt`

---

## Personal - Bewerber

**Table ID:** `bl0tRF2R7aMLYC`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Name Bewerber | SINGLE_LINE_TEXT | `qtiHG` | - | - |
| Bewerber-ID | FORMULA | `UXdZj` | - | Ja |
| ID | NUMBER | `tmFd9` | - | - |
| ID_auto | AUTONUMBER | `qUvBv` | - | Ja |
| Eingang Bewerbung | DATETIME | `6NqwI` | - | - |
| Mobil | PHONE | `wJsq7` | - | - |
| E-Mail | EMAIL | `L4Gai` | - | - |
| Anschreiben | LONG_TEXT | `uxkU0` | - | - |
| Link zur E-Mail | URL | `fvGET` | - | - |
| Anlagen | ATTACHMENT | `vtbpv` | - | - |
| Position | SINGLE_LINE_TEXT | `fzgN8` | - | - |
| Status | SELECT | `5XRlb` | - | - |
| Zusammenfassung E-Mail | LONG_TEXT | `5YJRl` | - | - |
| Inhalt E-Mail | LONG_TEXT | `lRlel` | - | - |
| Gehaltsvorstellung | SINGLE_LINE_TEXT | `S78Ry` | - | - |
| Beginn ab | DATETIME | `S5wp3` | - | - |
| Interne Notizen | LONG_TEXT | `89Log` | - | - |
| Kultur | RATING | `iRw0a` | - | - |
| Kommunikation | RATING | `6nxYX` | - | - |
| Skills | RATING | `pRRtz` | - | - |
| Anhänge | ATTACHMENT | `Ddncc` | - | - |

**Select-Optionen:**

- **Status:** `(0) Erhalten`, `(1) Unterlagen gesichtet`, `(2) Telefonisch erreicht`, `(3) 1. Gespräch`, `(4) 2. Gespräch`, `(5) Referenzen einholen`, `(6) Arbeitsvertrag erstellen`, `(7) Eingestellt`, `(10) Disqualifiziert`

---

## Logs - VAPI

**Table ID:** `gGcyZx01A4bDuH`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Name | SINGLE_LINE_TEXT | `VHZRV` | - | - |
| Description | LONG_TEXT | `kVdtn` | - | - |
| Status | SELECT | `ZLjJX` | - | - |

**Select-Optionen:**

- **Status:** `Todo`, `In progress`, `Done`

---

## Angebotserstellung

**Table ID:** `ORCDcA1wFrCzu2`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| ProjektNr (ATBS) | SINGLE_LINE_TEXT | `05UH6` | - | - |
| Angebotserstelllung | Status | SELECT | `7wKqO` | - | - |
| Checkliste | Status | SELECT | `Sm684` | - | - |
| Checkliste | Fotos | ATTACHMENT | `38q0Q` | - | - |
| Matterport | Status | SELECT | `J2pdq` | - | - |
| Matterport | Link vorher | URL | `xt7r3` | - | - |
| Angebot Kunde | Nr. | SINGLE_LINE_TEXT | `cpeHq` | - | - |
| Angebot Kunde | Link zu Odoo | URL | `EZ049` | - | - |

**Select-Optionen:**

- **Angebotserstelllung | Status:** `Offen`, `Alle Daten vorhanden`, `Verarbeitung läuft`, `Klärungsbedarf`, `Erstellt`
- **Checkliste | Status:** `Offen`, `In Arbeit`, `Vedrarbeitet`
- **Matterport | Status:** `Offen`, `Suchen anstoßen`, `Vedrarbeitet`

---

## 2025 08 04 Monday Backup Bau 

**Table ID:** `D2axyHap039f3o`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| ﻿name | SINGLE_LINE_TEXT | `XPUqS` | - | - |
| Projektmanager | SELECT | `vRApr` | - | - |
| Name | Bauleiter | SELECT | `FPlQB` | - | - |
| Telefon | Bauleiter | PHONE | `xVvHJ` | - | - |
| E-mail | bauleiter | EMAIL | `bqmuO` | - | - |
| Kunde | typ | SELECT | `unvuj` | - | - |
| Projektnr | SINGLE_LINE_TEXT | `siKRx` | - | - |
| Status | projekt | SELECT | `ABSfN` | - | - |
| Status | onedrive download | SELECT | `3jJta` | - | - |
| Bedarfsanalyse | datei | URL | `R4sNg` | - | - |
| Projektname | extern | SINGLE_LINE_TEXT | `ZY5ew` | - | - |
| Bedarfsanalyse details | fotos | URL | `Llr75` | - | - |
| Notizen | ausführung | SINGLE_LINE_TEXT | `wpoLG` | - | - |
| Bedarfsanalyse details | fotos | intern | status | SELECT | `bvvcw` | - | - |
| Projektname komplett | SINGLE_LINE_TEXT | `hSp0X` | - | - |
| Firmenname | kunde | SELECT | `rV8PC` | - | - |
| Bauleiter | SELECT | `ASn1o` | - | - |
| Nachunternehmer | SELECT | `sQkwj` | - | - |
| Projekt-volumen | angebot / rechnung | betrag (netto) | NUMBER | `BAhGy` | - | - |
| Adresse | SINGLE_LINE_TEXT | `ZkCVp` | - | - |
| Hero | link | SINGLE_LINE_TEXT | `XQurN` | - | - |
| In hero | SELECT | `kLp2Q` | - | - |
| Onedrive | link | SINGLE_LINE_TEXT | `KJgON` | - | - |
| Matterport vorher | link | SINGLE_LINE_TEXT | `T1XNS` | - | - |
| Angebot | link | SINGLE_LINE_TEXT | `Zc4mp` | - | - |
| Nua | datei | URL | `sOehS` | - | - |
| Angebot nu | datei | URL | `m4fRL` | - | - |
| Kunde verknüpfen | button | SELECT | `EmXyU` | - | - |
| Kunde | SINGLE_LINE_TEXT | `26BHD` | - | - |
| (2.1) erstellung ab | status | SELECT | `rQ4UT` | - | - |
| Ab kunde | datei | URL | `iPr8V` | - | - |
| Ab kunde | nr | SINGLE_LINE_TEXT | `Ic4TS` | - | - |
| Angebot kunde | datum | DATETIME | `IMM08` | - | - |
| Ab kunde | datum | DATETIME | `ULPsS` | - | - |
| Ab kunde verschickt | datum | DATETIME | `Y6FIq` | - | - |
| Bauvertrag kunde erstellen | button | SELECT | `HkQR3` | - | - |
| Bauvertrag kunde verschickt | datum | DATETIME | `POnss` | - | - |
| Bauvertrag kunde entwurf | datei | URL | `9CJNW` | - | - |
| Bauvertrag kunde unterzeichnet | datei | URL | `jWBsQ` | - | - |
| Bauvertrag kunde unterzeichnet | datum | DATETIME | `WWnog` | - | - |
| Nua | nr | SINGLE_LINE_TEXT | `bD7IG` | - | - |
| Angebot nu | nr | SINGLE_LINE_TEXT | `kHKFr` | - | - |
| Angebot nu | datum | DATETIME | `krBRF` | - | - |
| Angebot nu | betrag (netto) | NUMBER | `GI8oC` | - | - |
| ___ ab hier: infos bv | SINGLE_LINE_TEXT | `ZFltL` | - | - |
| Bv abfrage sub | SELECT | `6P6vw` | - | - |
| Vorabfrage b'analyse | status | SELECT | `Vzq6X` | - | - |
| Vorbereitung b'analyse | button | SELECT | `YXON2` | - | - |
| Bedarfsanalye | datum | DATETIME | `i78I2` | - | - |
| Kundeninfos | status | SELECT | `bhMhf` | - | - |
| Anrede | kunde | SELECT | `1VdJQ` | - | - |
| Vorname | kunde | SINGLE_LINE_TEXT | `HU8yC` | - | - |
| Nachname | kunde | SINGLE_LINE_TEXT | `Rqx1c` | - | - |
| Adresse | kunde | SELECT | `FAiJF` | - | - |
| Adresse | bv | SINGLE_LINE_TEXT | `Zmawb` | - | - |
| E-mail | kunde | EMAIL | `nZrl5` | - | - |
| Handynummer | kunde | SINGLE_LINE_TEXT | `u0Qey` | - | - |
| ___ ab hier: bedarfsanalyse | SINGLE_LINE_TEXT | `rf2AT` | - | - |
| Bedarsanalyse & angebot | fortschritt | SELECT | `BZkjK` | - | - |
| Bedarfsanalyse | status | SELECT | `cAhYr` | - | - |
| Matterport vorher | status | SELECT | `RlaBP` | - | - |
| Aufmaß | SELECT | `EQNuF` | - | - |
| Angebot kunde | status | SELECT | `C0AJO` | - | - |
| Titelfoto bv | foto | URL | `INkN3` | - | - |
| Angebot kunde | datei | URL | `KSZQ2` | - | - |
| Shk | beschreibung | SINGLE_LINE_TEXT | `Xh1XA` | - | - |
| Alle leistungen | beschreibung | SINGLE_LINE_TEXT | `S7jy4` | - | - |
| Bad | ausführung | SELECT | `aMe5q` | - | - |
| Elektrik | ausführung | SELECT | `hpLnL` | - | - |
| Elektrik zähler | ausführung | SELECT | `j0y60` | - | - |
| Gastherme | ausführung | SELECT | `Qq83B` | - | - |
| Asbest | ausführung | SELECT | `dZ3Lr` | - | - |
| Wände | ausführung | SELECT | `3TACg` | - | - |
| Decken | ausführung | SELECT | `GeXL5` | - | - |
| Boden | ausführung | SELECT | `lTckU` | - | - |
| Türen | ausführung | SELECT | `lAEHv` | - | - |
| Auswahl nu | status | SELECT | `Evr9z` | - | - |
| Angebot kunde | nr. | SINGLE_LINE_TEXT | `ynItE` | - | - |
| Grundfläche (m²) | NUMBER | `PPcQT` | - | - |
| Projekt-volumen | angebot / rechnung | betrag (brutto) | NUMBER | `pfDfq` | - | - |
| €/m² (netto) | NUMBER | `it45a` | - | - |
| €/m² (brutto) | NUMBER | `Qs25j` | - | - |
| Ust | NUMBER | `IXT0m` | - | - |
| Teil-rechnung kunde | betrag (brutto) | NUMBER | `unBLU` | - | - |
| Rechnung kunde | nr. | SINGLE_LINE_TEXT | `X469c` | - | - |
| Marge (von oben) % | NUMBER | `2FToy` | - | - |
| Budget berechnet | sub | NUMBER | `Pk1Fz` | - | - |
| Rechnung nu | datei | URL | `CB5bL` | - | - |
| Rechnung nu | betrag (netto) | NUMBER | `bS9dt` | - | - |
| Rohertrag (formel) | NUMBER | `r7ISl` | - | - |
| Budget nu | NUMBER | `xGKfV` | - | - |
| Marge (absolut) | NUMBER | `7IRXt` | - | - |
| Rohertrag (€) | NUMBER | `mpHPw` | - | - |
| Rohertrag (%) | NUMBER | `Dp4z1` | - | - |
| Dauer erstellung | angebot | NUMBER | `0ckg5` | - | - |
| Deadline | angebot | DATETIME | `byz0C` | - | - |
| _ | SINGLE_LINE_TEXT | `C7Hyx` | - | - |
| Fortschritt | beauftragung | SELECT | `zWsng` | - | - |
| E-mail | sub (mirror) | EMAIL | `457ZK` | - | - |
| Sub verknüpfen | button | SELECT | `PAeZM` | - | - |
| Nu darf teil-rechnungen stellen | check | SELECT | `FVWzp` | - | - |
| Ansprechpartner | sub | SELECT | `suRcJ` | - | - |
| Facharbeiter sub | stundenlohn | NUMBER | `Mdf3l` | - | - |
| Helfer sub | stundenlohn | NUMBER | `l3bBg` | - | - |
| Adresse | sub | SELECT | `bROk4` | - | - |
| E-mail | sub | EMAIL | `aJOpV` | - | - |
| Telefon | sub | SELECT | `YMvag` | - | - |
| Ansprechpartner | nu | SELECT | `TSEgX` | - | - |
| Nua | status | SELECT | `g8GGz` | - | - |
| (2.2) auftragsvergabe nu | status | SELECT | `cxCtW` | - | - |
| Einkauf | sub | SELECT | `y9wEH` | - | - |
| Entsorgung | sub | SELECT | `FUGeR` | - | - |
| (2.4.) bauvertrag nu | status | SELECT | `QhkHL` | - | - |
| Sende auftrag an sub | SELECT | `ZTLtP` | - | - |
| Auftrag an sub geschickt | datum | DATETIME | `axZIp` | - | - |
| Bv start & dauer | status | SELECT | `dWv7P` | - | - |
| Bv start & ende | zeitleiste - start | DATETIME | `8V1ac` | - | - |
| Bv start & ende | zeitleiste - end | DATETIME | `Dwxv3` | - | - |
| Bv start | datum | DATETIME | `f55yA` | - | - |
| Vertrag sub senden | SELECT | `fGEd1` | - | - |
| Vertrag sub | datei | URL | `fld4b` | - | - |
| Vertrag sub unterzeichnet | datei | URL | `NFVNo` | - | - |
| Bv ende | kunde | datum | DATETIME | `8pRus` | - | - |
| Angebot überarbeitet | status | SELECT | `kjuXp` | - | - |
| (2.3) bauvertrag kunde | status | SELECT | `Sumgw` | - | - |
| ___ ab hier: bv in vorbereitung | SINGLE_LINE_TEXT | `MMP2X` | - | - |
| Fortschritt | vorbereitung | SELECT | `2ze5c` | - | - |
| Status | schlüssel | SELECT | `cqlbl` | - | - |
| 4 tage vor start klären | schlüssel | NUMBER | `suTVi` | - | - |
| Deadline | schlüssel | DATETIME | `CWmgh` | - | - |
| Abholung schlüssel anfragen | button | SELECT | `mmed2` | - | - |
| ___ab hier: backoffice bauphase | SINGLE_LINE_TEXT | `5giUO` | - | - |
| Baubeginnanzeige | status | SELECT | `G22St` | - | - |
| Teil-rechnung kunde | status | SELECT | `6CAm9` | - | - |
| Nachtrag kunde | status | SELECT | `pqR4c` | - | - |
| ___ ab hier: bauphase | SINGLE_LINE_TEXT | `UhweI` | - | - |
| Fortschritt | umsetzung | SELECT | `C9jpB` | - | - |
| Entkernung | status | SELECT | `gg2On` | - | - |
| Entkernung | fotos | URL | `VIdAh` | - | - |
| Maurer + trockenbau | status | SELECT | `67n4J` | - | - |
| Maurer & trockenbau | fotos | URL | `WLqp2` | - | - |
| Elektrik | status | SELECT | `06reu` | - | - |
| Elektrik | fotos | URL | `UBxmR` | - | - |
| E-check | status | SELECT | `7qH6f` | - | - |
| E-check | datei | URL | `8d5Qz` | - | - |
| Bad & sanitär | status | SELECT | `GnADf` | - | - |
| Bad & sanitär | fotos | URL | `5NyTt` | - | - |
| Heizung | status | SELECT | `aJKmD` | - | - |
| Heizung | fotos | URL | `ccvbz` | - | - |
| Tischler | status | SELECT | `tSYWD` | - | - |
| Tischler | fotos | URL | `sERxl` | - | - |
| Wände & decken | status | SELECT | `Fl8Za` | - | - |
| Wände & decken | fotos | URL | `OSxO4` | - | - |
| Boden | status | SELECT | `qAUvS` | - | - |
| Boden | fotos | URL | `nvW8u` | - | - |
| Endreinigung | status | SELECT | `Nygjn` | - | - |
| Kommentare zum bautenstand | SINGLE_LINE_TEXT | `6ac5o` | - | - |
| Baufortschritt kunde | fotos | URL | `7p0lx` | - | - |
| ___ ab hier: abnahme & endabnahme ___ | SINGLE_LINE_TEXT | `hsLBB` | - | - |
| Interne vorabnahme | 7 tage vor endabnahme mit kunden | NUMBER | `bTwPj` | - | - |
| Fertigstellung sub | status | SELECT | `XcPKY` | - | - |
| Fertigstellung sub | datum | DATETIME | `C12ZU` | - | - |
| Nacharbeiten sub | status | SELECT | `PmeWS` | - | - |
| Fertigstellung nacharbeiten | 5 tage vor endabnahmne | NUMBER | `X5Ry7` | - | - |
| Nacharbeiten intern | deadline | DATETIME | `MW0jR` | - | - |
| Endabnahme kunde | status | SELECT | `MRuh1` | - | - |
| Endabnahme kunde | deadline | DATETIME | `YfxUc` | - | - |
| Nacharbeiten kunde | status | SELECT | `fGRMu` | - | - |
| Baufortschritt fotos kunde | intern | status | SELECT | `D7gF1` | - | - |
| Nacharbeiten kunde e-mail senden | button | SELECT | `DFKmm` | - | - |
| Fertigstellung nacharbeiten | 2 tage nach endabnahme mit kunden | NUMBER | `42u8Z` | - | - |
| Endabnahme kunde | mängel nacharbeiten | deadline | DATETIME | `mXBTR` | - | - |
| _____ ab hier: dokumentation ____ | SINGLE_LINE_TEXT | `mccFG` | - | - |
| Fortschritt | fotos | SELECT | `0DhK6` | - | - |
| Entkernung | matterport | SELECT | `AicVv` | - | - |
| Fertigstellung | matterport | SELECT | `GHv89` | - | - |
| Nachträge fotos | status | SELECT | `DqlSA` | - | - |
| Mängel endabnahme kunde fotos | status | SELECT | `J50Ar` | - | - |
| Mängel behoben | fotos | SELECT | `dB0O2` | - | - |
| ___ ab hier: rechnungsstellung ____ | SINGLE_LINE_TEXT | `0jGfm` | - | - |
| Baufertigstellungsanzeige | SELECT | `ettUo` | - | - |
| Rechnung nu | status | SELECT | `IGQtK` | - | - |
| Rechnung kunde | status | SELECT | `9tej7` | - | - |
| Ar | link hero | URL | `mpKSl` | - | - |
| Rechnung kunde | datei | URL | `WyO1K` | - | - |
| Rechnung kunde | datum | DATETIME | `4reEp` | - | - |
| Rechnung kunde | zahlung | deadline | DATETIME | `7bnDl` | - | - |
| Teil-rechnung kunde | datum | DATETIME | `tSXa1` | - | - |
| Teil-rechnung kunde | zahlung | deadline | DATETIME | `wD0rQ` | - | - |
| Rechnung kunde | 3 tage nach endabnahme | NUMBER | `9MBa4` | - | - |
| Deadline | ar kunde | DATETIME | `d1Tj5` | - | - |
| Rechnung kunde verschickt | datum | DATETIME | `zOmRN` | - | - |
| ___ ab hier: links zu anderen boards ___ | SINGLE_LINE_TEXT | `cdRhJ` | - | - |
| Link zu projektübersicht | SINGLE_LINE_TEXT | `x9zpv` | - | - |
| Link to beschaffung_board | SINGLE_LINE_TEXT | `gkQ4g` | - | - |
| Summe | material & arbeit | SINGLE_LINE_TEXT | `JFsIF` | - | - |
| Outlook calendar event | SINGLE_LINE_TEXT | `jb78P` | - | - |
| Angebot kunde senden | button | SELECT | `11Gge` | - | - |
| Anrede | kunde (mirror) | SELECT | `0wVdH` | - | - |
| Nachname | kunde (mirror) | SINGLE_LINE_TEXT | `XYVn2` | - | - |
| E-mail | kunde (mirror) | EMAIL | `1vCgl` | - | - |
| Vertrag sub unterzeichnet | datum | SINGLE_LINE_TEXT | `NpeiL` | - | - |
| Vertrag sub unterzeichnet bauleitung | datum | SINGLE_LINE_TEXT | `mHAts` | - | - |
| ___ ab hier: interne felder für integrationen | SINGLE_LINE_TEXT | `yiYU4` | - | - |
| Intern | pandadocid | nu-vertrag | SINGLE_LINE_TEXT | `R4jcy` | - | - |
| Intern | eventid bedarfsanalyse | SINGLE_LINE_TEXT | `48GMN` | - | - |
| Intern | eventid besprechung angebot | SINGLE_LINE_TEXT | `qZDGn` | - | - |
| Intern | eventid bv start | SINGLE_LINE_TEXT | `4uNhZ` | - | - |
| Intern | eventid fertigstellung sub | SINGLE_LINE_TEXT | `HYnNx` | - | - |
| Intern | eventid endabnahme kunde | SINGLE_LINE_TEXT | `7jmLJ` | - | - |
| Intern | ordnerid onedrive | SINGLE_LINE_TEXT | `GmmHc` | - | - |
| Intern | hero projekt-id | NUMBER | `lTJSi` | - | - |
| Intern | pandadocid | bauvertrag kunde | SINGLE_LINE_TEXT | `xSjVN` | - | - |
| Zustand we | vorher | SINGLE_LINE_TEXT | `guOIO` | - | - |
| Abdichtung bad kunde | fotos | URL | `QMmKq` | - | - |
| Abdichtung bad fotos kunde | intern | status | SELECT | `dnej5` | - | - |
| Matterport nachher | link | URL | `M9taR` | - | - |
| 3d-rundgang (nachher) versenden | SELECT | `LEEzT` | - | - |
| Elektrik rohinstallation kunde | fotos | URL | `1yveM` | - | - |
| Elektrik rohinstallation fotos kunde | intern | status | SELECT | `u1P1o` | - | - |
| Sanitär rohinstallation fotos kunde | fotos | URL | `5vp06` | - | - |
| Sanitär rohinstallation fotos kunde | intern | status | SELECT | `iVmaP` | - | - |
| Vorabnahme neurealis | mängel | fotos | URL | `ihzDZ` | - | - |
| Vorabnahme neurealis | mängel | fotos | intern | status | SELECT | `3xL7Y` | - | - |
| Nacharbeiten endabnahme kunde erledigt | fotos | intern | status | SELECT | `Oszqf` | - | - |
| Rechnung nu | nr. | SINGLE_LINE_TEXT | `efey4` | - | - |
| Teil-rechnung nu | nr. | SELECT | `VZRCd` | - | - |
| Rechnung nu | gezahlter betrag | NUMBER | `R1z6v` | - | - |
| Rechnung nu | offener betrag (num) | NUMBER | `E0zSw` | - | - |
| Teil-rechnung nu | datei | URL | `rFX7j` | - | - |
| Teil-rechnung nu | betrag | NUMBER | `Y2vLy` | - | - |
| Teil-rechnung sub | gezahlter betrag | NUMBER | `fAdFn` | - | - |
| Teil-rechnung nu | offener betrag (num) | NUMBER | `qIxDI` | - | - |
| Teil-rechnung kunde | datei | URL | `izGGv` | - | - |
| Teil-rechnung kunde verschickt | datum | DATETIME | `AcPpa` | - | - |
| Teil-rechnung kunde | nr. | SINGLE_LINE_TEXT | `e1ILm` | - | - |
| Teil-rechnung kunde | gezahlter betrag (brutto) | NUMBER | `56hKZ` | - | - |
| Teil-rechnung nu | status | SELECT | `8eP56` | - | - |
| Abweichung zum angebot | rechnung sub | formel | NUMBER | `qYgUz` | - | - |
| Nua | datum | DATETIME | `LTQrx` | - | - |
| Rechnung kunde | gezahlter betrag | NUMBER | `hr6sy` | - | - |
| Rechnung kunde | offener betrag (brutto) | SINGLE_LINE_TEXT | `p2ybQ` | - | - |
| Mängel endabnahme kunde | beschreibung | SINGLE_LINE_TEXT | `9h5DJ` | - | - |
| Fremdleistung | betrag | NUMBER | `WEXBC` | - | - |
| Besprechung angebot kunde | datum | DATETIME | `1k3Jk` | - | - |
| Angebot kunde gesendet  | datum | DATETIME | `eWmle` | - | - |
| Bv dauer | tage | NUMBER | `FY7ff` | - | - |
| Vorabnahme intern | datum | DATETIME | `nyaM9` | - | - |
| Vorabnahme intern | status | SELECT | `S6UuR` | - | - |
| Intern | eventid | vorabnahme intern | SINGLE_LINE_TEXT | `3bW7I` | - | - |
| Rechnung sub | berechnet | betrag (netto) | NUMBER | `fu6dN` | - | - |
| Aufwendungen andere nu | betrag (netto) | NUMBER | `xz00v` | - | - |
| Erledigte nacharbeiten | vorabnahme neurealis | fotos | URL | `ulovX` | - | - |
| Erledigte nacharbeiten | vorabnahme neurealis | fotos | intern | status | SELECT | `4k8gb` | - | - |
| Endabnahme kunde | mängel | fotos | SINGLE_LINE_TEXT | `naKzq` | - | - |
| Endabnahme kunde | mängel | fotos | intern | status | SELECT | `icpiH` | - | - |
| Erledigte nacharbeiten | endabnahme kunde | mängel | fotos | URL | `ZIAn9` | - | - |
| Erledigte nacharbeiten | endabnahme kunde | mängel | fotos | intern | status | SELECT | `iX7Rc` | - | - |
| Erledigte nacharbeiten vorabnahme neurealis | fotos | intern | status | SELECT | `rbivG` | - | - |
| Angebot kunde | intern | link | SINGLE_LINE_TEXT | `a7p2T` | - | - |
| Ab kunde | intern | link | SINGLE_LINE_TEXT | `DTacJ` | - | - |
| Nua | link | SINGLE_LINE_TEXT | `i9RCa` | - | - |
| Teil-rechnung kunde | intern | link | SINGLE_LINE_TEXT | `Hbwnh` | - | - |
| Rechnung kunde | intern | link | SINGLE_LINE_TEXT | `rO1Nt` | - | - |
| Endoskop / sauberkeit abflüsse | fotos | SINGLE_LINE_TEXT | `mn7aQ` | - | - |
| Endoskop / sauberkeit abflüsse | fotos | status | SELECT | `Qpf6A` | - | - |
| Google maps | link | SINGLE_LINE_TEXT | `WsPdk` | - | - |
| Onenote | pageid | intern | SINGLE_LINE_TEXT | `Ij8m8` | - | - |
| Onenote | link | intern | LONG_TEXT | `plw38` | - | - |
| Marketings | posts | status | SELECT | `hN1ed` | - | - |
| Marketing | post vorher | status | SELECT | `dIRY7` | - | - |
| Marketing | post vorher | text | LONG_TEXT | `fVcGW` | - | - |
| Marketing | post nachher | text | LONG_TEXT | `jFkqP` | - | - |
| Marketing | post vorhernachher | text | LONG_TEXT | `5RR5e` | - | - |
| Marketing | post nachher | status | SELECT | `snTHt` | - | - |
| Marketing | post voerher/nachher | status | SELECT | `DEryN` | - | - |
| Marketing | kommentare | text | SINGLE_LINE_TEXT | `BZCfu` | - | - |
| Rechnung nu | link | LONG_TEXT | `PY4Bs` | - | - |
| Teil-rechnung nu | link | LONG_TEXT | `MGkmK` | - | - |
| Rechnung nu | datum | DATETIME | `tlC6j` | - | - |
| Teil-rechnung nu | datum | DATETIME | `6UQMK` | - | - |
| Teil-rechnung nu | offener betrag (formel) | NUMBER | `tre49` | - | - |
| Angebot nu | link | SINGLE_LINE_TEXT | `vMSWm` | - | - |
| Projekt-volumen | ohne andere nus | betrag (netto) | NUMBER | `DJYN5` | - | - |
| Teil-rechnung kunde | betrag (netto) | NUMBER | `jEXHt` | - | - |
| Teil-rechnung kunde | vereinbart | check | SELECT | `KjDK3` | - | - |
| Budget nu | betrag angenommen | NUMBER | `fF79Z` | - | - |
| Budget nu | datum angenommen | DATETIME | `zqbzC` | - | - |
| Marge / rohertrag (absolut) € | NUMBER | `JK9kl` | - | - |
| Teil-rechnung kunde | offener betrag | NUMBER | `XJdYq` | - | - |
| Rechnung kunde | offener betrag (num) | NUMBER | `VwIUn` | - | - |
| Vorabnahme intern | protokoll | pdf | link | LONG_TEXT | `QZqLd` | - | - |
| Vorabnahme intern | protokoll | formular | link | LONG_TEXT | `i7dH8` | - | - |
| Orabnahme intern | protokoll | status | SELECT | `FtCN2` | - | - |
| Teil-rechnung kunde | erstellung | deadline | DATETIME | `yukFw` | - | - |
| Rechnung kunde | erstellung | deadline | DATETIME | `SxD0a` | - | - |
| Intern | softr record id | SINGLE_LINE_TEXT | `8uYT8` | - | - |
| Intern | softr record | link | URL | `G9E4s` | - | - |
| Orabnahme intern | protokoll | datum | DATETIME | `WAtqS` | - | - |
| Zahlen | NUMBER | `VtPgB` | - | - |
| Teil-rechnung kunde | % abschlag | NUMBER | `zFA2S` | - | - |
| Zahlungsziel in tagen | NUMBER | `pf1ug` | - | - |
| Bauvertrag kunde unterzeichnet | link | SINGLE_LINE_TEXT | `yJLLC` | - | - |
| Bauvertrag kunde entwurf | link | SINGLE_LINE_TEXT | `Wq3rK` | - | - |
| Link foto upload | URL | `6z12V` | - | - |
| Formel social media beitrag | URL | `PbRHK` | - | - |
| Intern | link | formular social media beitrag | SINGLE_LINE_TEXT | `DWBCZ` | - | - |
| Intern | anzahl nachträge | NUMBER | `astej` | - | - |
| Intern | anzahl einkäufe | NUMBER | `dCEQi` | - | - |
| Intern | anzahl mängel | NUMBER | `50Ijc` | - | - |
| Rechnung | notizen | SINGLE_LINE_TEXT | `2HaU7` | - | - |
| Teil-rechnung | notizen | SINGLE_LINE_TEXT | `RxxEj` | - | - |
| Auftrag kunde | datei | URL | `lhHjX` | - | - |
| Auftrag kunde | link | URL | `SMRzJ` | - | - |
| Rechnung nu | datum upload | DATETIME | `6eobt` | - | - |
| Teil-rechnung nu | datum upload | DATETIME | `XJzS1` | - | - |
| Baufortschritt für bwa | formel | NUMBER | `pGW2B` | - | - |
| Auftrag kunde | datum | DATETIME | `85pAj` | - | - |
| Auftrag kunde | nr | SINGLE_LINE_TEXT | `Q5WZZ` | - | - |
| Auftrag kunde | infos lang | SINGLE_LINE_TEXT | `oHayl` | - | - |
| Badplan | foto | SINGLE_LINE_TEXT | `BBVBv` | - | - |

**Select-Optionen:**

- **Projektmanager:** `Hannah Bennemann`, `Aki Wege`
- **Name | Bauleiter:** `Aki Wege`, `Dirk Jansen`, `Holger Neumann`
- **Kunde | typ:** `Noch zuweisen`, `Geschäftskunde`, `Privatkunde`
- **Status | projekt:** `(7) Projekt abgeschlossen`, `(9) Auftrag nicht erhalten`, `(4) Umsetzung`, `(5) Rechnungsstellung`, `(1) Angebotsphase`, `(2) Auftrag erhalten`, `(0) Bedarfsanalyse`, `(5) Zahlung erhalten`
- **Status | onedrive download:** `(0) Offen`
- **Bedarfsanalyse details | fotos | intern | status:** `Verfügbar`, `Offen`
- **Firmenname | kunde:** `gws`, `VBW`, `Privat`, `covivio`, `Forte Capital`, `vonovia`, `Quadrat`, `D.I.M.`, `Eigenbestand`, `WVB Centuria` ... (+8 weitere)
- **Bauleiter:** `Aki Wege`, `Dirk Jansen`, `Holger Neumann`
- **Nachunternehmer:** `Vitazem / Mennza`, `TOP Handwerker GmbH`, `Dimitri Figura`, `neurealis GmbH`, `Ghafurov Bau`, `Jurislav Knezevic Bau`, `Gebäudemanagement Antonio Pepe`, `Igor Maliy`, `neurealis | Dirk Jansen`
- **In hero:** `Offen`, `Fertig`
- **Kunde verknüpfen | button:** `Kunde verknüpfen`
- **(2.1) erstellung ab | status:** `(0) Offen`, `(3) Verschickt`, `(2) Erstellt noch verschicken`, `(1) Auftrag Kunde erhalten`
- **Bauvertrag kunde erstellen | button:** `Vertrag erstellen & senden`
- **Bv abfrage sub:** `Click me`
- **Vorabfrage b'analyse | status:** `(0) Offen`, `(1) Geplant`, `(2) Vorabfrage verschickt / nicht erforderlich`
- **Vorbereitung b'analyse | button:** `Formular Vorbereitung versenden`
- **Kundeninfos | status:** `Noch verknüpfen`, `Verknüpft`
- **Anrede | kunde:** `Herr`, `Frau`, `Familie`
- **Adresse | kunde:** `Hörder Bahnhofstraße 1 Dortmund Deutschland`, `Nestorstraße 8-9 10709 Berlin Deutschland`, `Essener Straße 66 46047 Oberhausen`, `Am Schallacker 23 44263 Dortmund`, `Torgauer Str. 7 44263 Dortmund`, `Zechenstraße 67 59425 Unna`, `Kirchstr. 1 40227 Düsseldorf`, `Hainallee 64a Dortmund Innenstadt-Ost Deutschland`, `Platanenweg 58 44801 Bochum`, `Mozartstraße 23 59077 Hamm` ... (+5 weitere)
- **Bedarsanalyse & angebot | fortschritt:** `0%`, `80%`, `20%`, `100%`, `40%`, `60%`, `53%`
- **Bedarfsanalyse | status:** `(0) Termin planen`, `(2) Abgeschlossen`
- **Matterport vorher | status:** `(0) Noch hochladen`, `(1) Hochgeladen`
- **Aufmaß:** `Offen`, `Abgeglichen & OK`, `nur Aufmaß Kunde vorhanden`, `Abgeglichen nicht OK`
- **Angebot kunde | status:** `(1) Erstellt`, `(3) Verschickt`, `(0) Ausstehend`, `(2) 4-Augen-Check`
- **Bad | ausführung:** `Komplett`, `Offen`, `Ohne Bad`, `Nur Austausch Sanitärartikel`, `Fliese auf Fliese`
- **Elektrik | ausführung:** `Komplett`, `Ohne`, `Teil-Mod`, `Austausch Feininstallaiton`, `Nur E-Check`
- **Elektrik zähler | ausführung:** `Offen`, `Ohne`, `Zählertausch (Drehstrom)`, `Versetzen`
- **Gastherme | ausführung:** `Ohne Therme`, `Offen`, `Therme versetzen`, `Neue Therme`
- **Asbest | ausführung:** `Ohne`, `Offen`, `Asbestsanierung`
- **Wände | ausführung:** `Ohne`, `Raufaser & Anstrich`, `2x Anstrich`, `Nur Spachteln`, `Q2 & Anstrich`, `1x Anstrich (Makulatur/Sauberkeitsanstrich)`
- **Decken | ausführung:** `Ohne`, `Raufaser`, `2x Anstrich`, `Q2`, `Sauberkeitsanstrich`
- **Boden | ausführung:** `Ohne`, `Vinyl (Planken)`, `Ausgleich`, `Laminat`, `Vinyl (Planken+ Weichmachersperre))`, `Vinyl (Click)`, `Holz schleifen`, `Fliesen`
- **Türen | ausführung:** `Ohne`, `Türblätter: neu | Zarge: neu`, `Türblätter: lackieren | Zarge: lackieren`, `Türblätter: neu | Zarge: lackieren`
- **Auswahl nu | status:** `(2) Zugewiesen`, `(0) Noch zuweisen`, `(1) Verknüpfe ...`
- **Fortschritt | beauftragung:** `40%`, `20%`, `0%`, `60%`, `100%`, `80%`, `4%`
- **Sub verknüpfen | button:** `SUB verknüpfen`
- **Nu darf teil-rechnungen stellen | check:** `Nein`, `Ja`
- **Ansprechpartner | sub:** `Vitali Balan`, `Petru Plesca`, `Dimitri Figura`, `Holger Neumann`, `Ghafurov Abdughafor`, `Jurislav Knezevic`, `Antonio Pepe`, `Igor Maliy`, `Dirk Jansen`
- **Adresse | sub:** `Heßlerstraße 231 Essen-Stadtbezirke V Deutschland`, `Borgmannshof 24 45888 Gelsenkirchen Deutschland`, `Hatzfelder Str. 39 Wuppertal Barmen Deutschland`, `Torgauer Str. 7 Dortmund-Hörde Deutschland`, `Eickeler Bruch 107 44652 Herne-Wanne-Eickel Deutschland`, `Liegnitzer Str. 3 42277 Wuppertal`
- **Telefon | sub:** `491577E+12`, `15773413255`, `491701E+11`, `491512E+12`, `491786E+11`
- **Ansprechpartner | nu:** `Vitali Balan`, `Petru Plesca`, `Holger Neumann`, `Ghafurov Abdughafor`, `Jurislav Knezevic`, `Fazli Gökcen`, `Antonio Pepe`
- **Nua | status:** `Fertig`, `Offen`, `4-Augen Prüfung`, `In Bearbeitung`
- **(2.2) auftragsvergabe nu | status:** `Angenommen / nicht erforderlich`, `NU-Auftrag offen`, `Angebot SUB erhalten noch zu prüfen`, `Erinnerung geschickt`, `LV verschickt Angebot angefragt`
- **Einkauf | sub:** `Offen`, `Ja SUB kauft ein`, `Nein alles durch neurealis`, `SUB kauft zum Teil ein`
- **Entsorgung | sub:** `Offen`, `Ja SUB entsorgt`
- **(2.4.) bauvertrag nu | status:** `Offen`, `An SUB geschickt`, `Unterzeichnet`, `Warten auf Unterschriftuntersc`, `Erstelle...`, `In Abstimmung`
- **Sende auftrag an sub:** `Auftrag an SUB senden`
- **Bv start & dauer | status:** `(3) Bestätigt durch SUB`, `(0) Offen`
- **Vertrag sub senden:** `Vertrag SUB senden`
- **Angebot überarbeitet | status:** `Offen`, `Erledigt`
- **(2.3) bauvertrag kunde | status:** `Offen`, `Lade hoch ...`, `Geschlossen`, `AB gesendet`, `nicht notw.`, `AB hinterlegt / erledigt`
- **Fortschritt | vorbereitung:** `0%`, `100%`, `3%`
- **Status | schlüssel:** `Offen`, `Erhalten / BauZi eingebaut`, `Schlüssel erhalten`, `Kunden über Einwurf Schlüssel informieren`, `Schlüssel abholen`
- **Abholung schlüssel anfragen | button:** `E-Mail Schlüsselabholung versenden`
- **Baubeginnanzeige | status:** `(0) Offen`, `(3) Erstellt & aus HERO verschickt`, `(3) nicht notw.`, `(2) Unterzeichnet`
- **Teil-rechnung kunde | status:** `(0) Offen`, `(4) Bezahlt`, `(2) Erstellt & verschickt`, `(3) Bezahlt zu wenig`, `(3) Überfällig`
- **Nachtrag kunde | status:** `Offen`, `Genehmigt / nicht erforderlich`, `In Bearbeitung`
- **Fortschritt | umsetzung:** `0%`, `100%`, `86%`, `8%`, `79%`, `93%`, `72%`, `64%`, `92%`, `78%` ... (+7 weitere)
- **Entkernung | status:** `Fertig`, `Geplant`, `In Arbeit`
- **Maurer + trockenbau | status:** `Fertig`, `Geplant`, `In Arbeit`
- **Elektrik | status:** `Fertig (Feininstallation)`, `Geplant`, `In Arbeit (Schlitze & Rohinstallation)`
- **E-check | status:** `Offen`, `Erhalten`, `Beauftragt`
- **Bad & sanitär | status:** `Fertig (Feininstallation)`, `Geplant`, `In Arbeit (Rohinstallation)`
- **Heizung | status:** `Geplant`, `Fertig (Feininstallation)`, `In Arbeit (Rohinstallation)`, `Verspätet`
- **Tischler | status:** `Fertig`, `Geplant`, `In Arbeit`, `Verspätet`
- **Wände & decken | status:** `Fertig`, `Geplant`, `In Arbeit`
- **Boden | status:** `Geplant`, `Fertig`, `In Arbeit`
- **Endreinigung | status:** `Geplant`, `Fertig`
- **Fertigstellung sub | status:** `Termin vereinbart`, `Bestanden`, `Termin abstimmen`, `Mängel`
- **Nacharbeiten sub | status:** `Offen`, `Ausgeführt & kontrolliert`, `In Arbeit (NU in Umsetzung)`, `Zu kontrollieren`
- **Endabnahme kunde | status:** `Termin vereinbaren`, `Bestanden / Nacharbeiten behoben`, `Termin vereinbart`, `Mängel`
- **Nacharbeiten kunde | status:** `Offen`, `Ausgeführt & kontrolliert`, `In Arbeit`, `Zu kontrollieren`
- **Baufortschritt fotos kunde | intern | status:** `Keine`, `Verfügbar`
- **Nacharbeiten kunde e-mail senden | button:** `Nacharbeiten erledigt`
- **Fortschritt | fotos:** `0%`, `34%`, `15%`
- **Entkernung | matterport:** `Offen`, `Fotos In OneDrive hochgeladen`, `Aufgenommen`
- **Fertigstellung | matterport:** `Offen`, `Fotos In OneDrive hochgeladen`
- **Nachträge fotos | status:** `Offen`
- **Mängel endabnahme kunde fotos | status:** `Offen`, `Verfügbar`
- **Mängel behoben | fotos:** `Offen`, `Fotos In OneDrive bzw. nicht erforderlich`
- **Baufertigstellungsanzeige:** `Offen`, `Erstellt & aus HERO verschickt`, `unterzeichnet`, `nicht notw.`
- **Rechnung nu | status:** `(6) Bezahlt`, `(0) Noch nicht erhalten`, `(1) Erhalten`, `(2) Mit Angebot verglichen (Preise & Mengen)`, `(4) Zahlung freigegeben`
- **Rechnung kunde | status:** `(0) Noch erstellen`, `(8) Bezahlt`, `(7) Bezahlt zu wenig`, `(7) Überfällig`, `(6) Unbezahlt verschickt`
- **Angebot kunde senden | button:** `Angebot senden`
- **Anrede | kunde (mirror):** `Herr`, `Frau`, `Familie`
- **Abdichtung bad fotos kunde | intern | status:** `Keine`, `Verfügbar`
- **3d-rundgang (nachher) versenden:** `3D-Rundgang nachher senden`
- **Elektrik rohinstallation fotos kunde | intern | status:** `Keine`, `Verfügbar`
- **Sanitär rohinstallation fotos kunde | intern | status:** `Keine`, `Verfügbar`
- **Vorabnahme neurealis | mängel | fotos | intern | status:** `Keine`
- **Nacharbeiten endabnahme kunde erledigt | fotos | intern | status:** `Keine`, `Verfügbar`
- **Teil-rechnung nu | nr.:** `No result`, `RE2025000610006`, `NUA-299`, `RE202500091000622`, `RE0207`, `1094`, `1072`, `1093`, `1092`, `2100021016` ... (+6 weitere)
- **Teil-rechnung nu | status:** `(0) Noch nicht erhalten`, `(6) Bezahlt`, `(1) Erhalten`, `(3) Zahlung freigegeben`
- **Vorabnahme intern | status:** `Termin vereinbaren`, `Bestanden / Nacharbeiten behoben`, `Termin vereinbart`
- **Erledigte nacharbeiten | vorabnahme neurealis | fotos | intern | status:** `Keine`, `Verfügbar`
- **Endabnahme kunde | mängel | fotos | intern | status:** `Keine`
- **Erledigte nacharbeiten | endabnahme kunde | mängel | fotos | intern | status:** `Keine`, `Verfügbar`
- **Erledigte nacharbeiten vorabnahme neurealis | fotos | intern | status:** `Keine`
- **Endoskop / sauberkeit abflüsse | fotos | status:** `Noch hochladen`, `Verfügbar`
- **Marketings | posts | status:** `(0) Offen`, `(1) In Bearbeitung`
- **Marketing | post vorher | status:** `(0) Offen`, `(5) Erstellt`
- **Marketing | post nachher | status:** `(0) Offen`
- **Marketing | post voerher/nachher | status:** `(0) Offen`
- **Teil-rechnung kunde | vereinbart | check:** `Nein`, `Ja`
- **Orabnahme intern | protokoll | status:** `(0) Offen`, `(1) Erstellt`

---

## Leads

**Table ID:** `va3BbWTn101BXJ`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Lead_id | SINGLE_LINE_TEXT | `csWBO` | - | - |
| Status | SELECT | `CObX1` | - | - |
| Bv_beschreibung | SINGLE_LINE_TEXT | `WlNCx` | - | - |
| Bv_art | SELECT | `BPfCP` | - | - |
| Bv_adresse | SINGLE_LINE_TEXT | `OIB4D` | - | - |
| Bv_adresse_strassenr | SINGLE_LINE_TEXT | `5Hn0w` | - | - |
| Bv_adresse_lage | SINGLE_LINE_TEXT | `Gy1nU` | - | - |
| Bv_adresse_stadt | SELECT | `eV9rB` | - | - |
| Bv_adresse_plz | SINGLE_LINE_TEXT | `o5vm0` | - | - |
| Bv_beginn | SINGLE_LINE_TEXT | `Y9IyS` | - | - |
| Kunde_vorname | SINGLE_LINE_TEXT | `bUgCd` | - | - |
| Kunde_nachnam | SINGLE_LINE_TEXT | `f1Os0` | - | - |
| Kunde_unternehmen | SINGLE_LINE_TEXT | `aowqg` | - | - |
| Kunde_segment | SINGLE_LINE_TEXT | `TZOQZ` | - | - |
| Kunde_telefonnr_1 | PHONE | `slZjp` | - | - |
| Kunde_telefonnr_2 | PHONE | `8ovtX` | - | - |
| Kunde_erreichbarkeit | SINGLE_LINE_TEXT | `lGb8g` | - | - |
| Kunde_email | EMAIL | `J1kAH` | - | - |
| Anmerkungen / sonstiges | SINGLE_LINE_TEXT | `VoYbK` | - | - |
| Bedarfsanalye_datum_zeit | DATETIME | `J12Un` | - | - |
| Quelle | SELECT | `cGy4r` | - | - |
| Lead_datum_zeit | DATETIME | `f1gcK` | - | - |
| Lead_datum_konvertiert | DATETIME | `X530q` | - | - |
| Dauer_kontaktierung | SINGLE_LINE_TEXT | `zyaBG` | - | - |
| Crm-status | SINGLE_LINE_TEXT | `43Piq` | - | - |
| Vorname (Kontakte) | LOOKUP | `JOgTX` | - | Ja |
| Nachname (Kontakte) | LOOKUP | `vB6Fw` | - | Ja |
| Telefon mobil (Kontakte) | LOOKUP | `EHdB2` | - | Ja |
| Notizen öffentlich (Kontakte) | LOOKUP | `qSOqj` | - | Ja |
| E-mail (Kontakte) | LOOKUP | `AIWZQ` | - | Ja |
| Unternehmensname kurz (Kontakte) | LOOKUP | `Rsi4G` | - | Ja |
| Kontakt | LINKED_RECORD | `nrF0C` | - | - |
| 🔐 softr record id | SINGLE_LINE_TEXT | `tOF8l` | - | - |

**Select-Optionen:**

- **Status:** `(4) Nicht passend`, `(5) Konvertiert`, `(2) Bedarfsanalyse`, `(0) Anfrage erhalten`, `(3) Cold Lead`, `(1) Kontaktiert`
- **Bv_art:** `Komplett-Sanierung`, `Renovierung`, `Einzelmaßnahme`, `Badsanierung + ggf. Extras`
- **Bv_adresse_stadt:** `Dortmund`, `Bochum`, `Essen`, `Gelsenkirchen`, `Castrop-Rauxel`, `Herne`, `Kamen`, `Wetter`
- **Quelle:** `Anruf`, `Website`, `Web-Formular`

**Verknuepfungen:**

- **Kontakt** -> Tabelle `VzvQUdlHStrRtN`

---

## Inventar

**Table ID:** `xvtJVrb2An6wwl`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| Inventar-id | FORMULA | `PJTpa` | - | Ja |
| AutoNumber | AUTONUMBER | `LZXvm` | - | Ja |
| Kategorie | SELECT | `rooTv` | - | - |
| Hersteller | SINGLE_LINE_TEXT | `Hf2uE` | - | - |
| Modell/Typ | SINGLE_LINE_TEXT | `2pyki` | - | - |
| Seriennummer | SINGLE_LINE_TEXT | `26KYe` | - | - |
| Status | SELECT | `wT9WQ` | - | - |
| Zustand (frei text) | SINGLE_LINE_TEXT | `xM2zM` | - | - |
| Standort Kategorie | SELECT | `x5kuu` | - | - |
| Standort Bezeichnung | SINGLE_LINE_TEXT | `PBHOD` | - | - |
| Aktueller Besitzer | SINGLE_LINE_TEXT | `J3fVA` | - | - |
| Übergabedatum an Besitzer | DATETIME | `t5KYS` | - | - |
| Rückgabedatum (optional) | SINGLE_LINE_TEXT | `YOTux` | - | - |
| Quittierung unterschrieben | SELECT | `IkynS` | - | - |
| Unterschrift/quittung (datei/url) | ATTACHMENT | `yoxLq` | - | - |
| Eigentümer | SELECT | `MNcME` | - | - |
| Beschaffungstyp | SELECT | `Pubmo` | - | - |
| Lieferant (kontakt) | SELECT | `oM5Mq` | - | - |
| Anschaffungsdatum | DATETIME | `A6mgg` | - | - |
| Kaufpreis eur | NUMBER | `VPYoD` | - | - |
| Garantie bis | DATETIME | `vdMtD` | - | - |
| Leasing/miete ende | DATETIME | `yDuLO` | - | - |
| Abschreibedatum | DATETIME | `qM8vr` | - | - |
| Wartungspflicht aktiv | SELECT | `wlhJF` | - | - |
| Wartungsintervall tage | NUMBER | `lNJlL` | - | - |
| Letzte wartung | DATETIME | `dxYNC` | - | - |
| Nächste wartung | DATETIME | `3Jqy7` | - | - |
| Sicherheitsprüfung erforderlich | SELECT | `kWUvc` | - | - |
| Prüfintervall tage | NUMBER | `yKyHV` | - | - |
| Letzte sicherheitsprüfung | DATETIME | `OvJ1V` | - | - |
| Nächste sicherheitsprüfung | DATETIME | `Hr1VL` | - | - |
| Verantwortlicher (kontakt) | SELECT | `yWI4V` | - | - |
| Kostenstelle | SINGLE_LINE_TEXT | `0fj0P` | - | - |
| Abschreibungsmethode | SELECT | `4ibJU` | - | - |
| Wiederbeschaffungswert eur | NUMBER | `D84m9` | - | - |
| Interne verrechnungssatz eur/tag | NUMBER | `a763z` | - | - |
| Foto (url) | ATTACHMENT | `kyR7U` | - | - |
| Prüfprotokoll (datei/url) | URL | `elnEP` | - | - |
| Weitere dokumente (datei/url) | SINGLE_LINE_TEXT | `YQhiq` | - | - |
| Notizen | SINGLE_LINE_TEXT | `bNbkg` | - | - |
| Interne notizen | SINGLE_LINE_TEXT | `LJgPz` | - | - |
| Erstellt am | DATETIME | `tzmvp` | - | - |
| Zuletzt aktualisiert am | DATETIME | `OEnSG` | - | - |
| QR Code Link | FORMULA | `OV5Jk` | - | Ja |
| Link zum Werkzeug | FORMULA | `ay9JK` | - | Ja |
| RecordID | RECORD_ID | `uDNAD` | - | Ja |

**Select-Optionen:**

- **Kategorie:** `Fahrzeug`, `Maschine`, `Elektrowerkzeug`, `IT/Elektronik`, `Handwerkzeug`, `Messgerät`, `Sonstiges`
- **Status:** `einsatzbereit`, `in Benutzung`, `defekt`, `in Wartung`, `verloren`, `ausgesondert`
- **Standort Kategorie:** `Lager`, `Mitarbeiter`, `Projekt`, `Frei`, `Fahrzeug`
- **Quittierung unterschrieben:** `nein`, `ja`
- **Eigentümer:** `neurealis GmbH`
- **Beschaffungstyp:** `Kauf`, `Miete`, `Leasing`
- **Lieferant (kontakt):** `Großhandel ElektroGross (Kontakt)`, `BauProfi (Kontakt)`, `IT Store (Kontakt)`, `Autohaus Beispiel (Kontakt)`, `Mietpark Beispiel (Kontakt)`
- **Wartungspflicht aktiv:** `ja`, `nein`
- **Sicherheitsprüfung erforderlich:** `ja`, `nein`
- **Verantwortlicher (kontakt):** `Werkstatt (Kontakt)`, `Fuhrpark (Kontakt)`, `IT Admin (Kontakt)`
- **Abschreibungsmethode:** `linear`

---

## Projekt - Umsatz

**Table ID:** `trBGeNEBfm2Jf7`

| Feld | Typ | ID | Pflicht | Readonly |
|------|-----|----|---------|----------|
| ATBS-Nr | SINGLE_LINE_TEXT | `urAKM` | - | - |
| Status | SELECT | `o5lB1` | - | - |
| Bauvorhaben | SINGLE_LINE_TEXT | `4SrAS` | - | - |
| BV Umsatz (brutto) | CURRENCY | `K6k0x` | - | - |
| BV Umsatz (netto) | CURRENCY | `gcy6R` | - | - |
| AR-* Link | LINKED_RECORD | `bQH7y` | - | - |
| AR-* | Summe | Betrag (brutto) | ROLLUP | `ypx2m` | - | Ja |
| AR-* | Summe | Betrag (netto) | ROLLUP | `ABcEN` | - | Ja |
| ER-NU-* Link | LINKED_RECORD | `HbhZj` | - | - |
| ER-NU-A/S | Summe | Betrag (brutto) | ROLLUP | `rOTPX` | - | Ja |
| ER-NU-A/S | Summe | Betrag (netto) | ROLLUP | `yVykl` | - | Ja |
| ER-NU-M | Summe | Betrag (netto) | ROLLUP | `dupTA` | - | Ja |

**Select-Optionen:**

- **Status:** `Todo`, `In progress`, `Done`

**Verknuepfungen:**

- **AR-* Link** -> Tabelle `kNjsEhYYcNjAsj`
- **ER-NU-* Link** -> Tabelle `kNjsEhYYcNjAsj`

---

