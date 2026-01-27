# Neurealis Portal - Technische Dokumentation

**Version:** 1.0
**Stand:** 2026-01-27
**Autor:** neurealis GmbH

---

## 1. Übersicht

### 1.1 Plattform-Informationen

| Eigenschaft | Wert |
|-------------|------|
| **Plattform** | Softr.io (No-Code) |
| **Datenquelle** | Monday.com |
| **Authentifizierung** | Magic Link (E-Mail-basiert) |
| **Hosting** | Softr Cloud |
| **URL** | portal.neurealis.de |

### 1.2 Zweck des Portals

Das Neurealis Portal dient als zentrale Plattform für:
- Bauvorhaben-Management über alle Phasen (0-6)
- Nachunternehmer-Verwaltung und Qualifizierung
- Finanz-Übersicht und Forecast
- Dokumenten-Management
- Kunden- und Lead-Verwaltung
- Personal- und Inventar-Tracking

---

## 2. Hauptnavigation

### 2.1 Navigationsstruktur

| Menüpunkt | Beschreibung | Untermenüs |
|-----------|--------------|------------|
| **Startseite** | Dashboard mit Übersicht | KI-Sprachassistent, Bauvorhaben-Tabelle, Kalender |
| **Bauvorhaben** | Projektübersicht nach Phasen | Dropdown: Phasen 0-5 |
| **Aufgaben** | Task-Management | - |
| **Leads** | Vertriebspipeline | - |
| **Kunden** | Kundenverwaltung | Aktive, Alle, Portal-Nutzung, Produktkataloge, LVs |
| **Nachunternehmer** | NU-Management | Alle NUs, Aktive, In Qualifizierung, Nachweise |
| **Finanzen** | Buchhaltung & Controlling | Eingangs-/Ausgangsrechnungen, Zahlungsabgleich, Kontostände, Forecast, Margen |
| **Einkauf** | Beschaffung | Lieferanten, Artikel |
| **Personal** | HR-Bereich | Bewerber |
| **Inventar** | Betriebsmittel | - |
| **Test** | Beta-Features | Experimentelle Funktionen |
| **Marketing** | Social Media | Social Media, Baustellen-Posts |

### 2.2 Startseite-Komponenten

1. **KI-Sprachassistent**
   - Integration für Sprachbefehle
   - Schnellzugriff auf häufige Aktionen

2. **Bauvorhaben-Tabelle**
   - Übersicht aller aktiven Projekte
   - Filterung nach Status/Phase
   - Sortierung nach Priorität

3. **Kalender**
   - Termine und Meilensteine
   - Synchronisation mit externen Kalendern

---

## 3. Bauvorhaben-Detail Struktur

### 3.1 Allgemeine Info Tabs

#### Übersicht-Tab
| Feld | Beschreibung |
|------|--------------|
| Bauleiter | Zugewiesener Projektleiter |
| NU | Anzahl/Liste Nachunternehmer |
| Grundfläche | Projektgröße in m² |
| Umsatz | Geplanter/Aktueller Umsatz |
| Rohertrag | Berechnete Marge |
| Externe Links | Verknüpfungen zu Drittsystemen |

#### Kunde-Tab
- Vollständige Kundendaten
- Ansprechpartner
- Zugehörige Dokumente
- Kommunikationshistorie

#### NU-Tab (Nachunternehmer)
- Zugewiesene Nachunternehmer
- Budget-Übersicht pro NU
- Leistungsverzeichnisse
- Vertragsstand

#### Dokumente-Tab
- Dokumententabelle mit Volltextsuche
- Kategorisierung nach Dokumenttyp
- Upload-Funktion
- Versionierung

#### Aufgaben-Tab
- Projekt-bezogene Tasks
- **KI-Fragen Button** für intelligente Abfragen
- Status-Tracking
- Verantwortlichkeiten

#### Termine-Tab
- Projekttermine
- Meilensteine
- Kalenderintegration

#### Abnahmen-Tab
- Abnahmeprotokolle
- Formular für neue Abnahme
- Historische Abnahmen
- Mängeldokumentation

#### Mängel-Tab
- Mängelliste
- Status-Tracking (offen/behoben)
- Zuordnung zu Gewerken/NUs
- Fotodokumentation

#### Nachweise-Tab
- Zertifikate
- Bescheinigungen
- Prüfprotokolle

#### Gewerke-Tab
- Gewerkeliste
- Zuordnung zu NUs
- Fortschritts-Tracking

### 3.2 Bauphasen-Tabs (0-6) - Detaillierte Feldübersicht

#### (0) Bedarfsanalyse
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Bedarfsanalyse \| Datum | Datum | Termin der Bedarfsanalyse |
| Besprechung Angebot Kunde \| Datum | Datum | Kundentermin |
| BV Start (geschätzt) | Datum | Geplanter Baustart |
| BV Ende (geschätzt) | Datum | Geplantes Bauende |
| Matterport vorher | Link | 3D-Scan vor Baustart |
| Titelfoto BV | Datei | Hauptbild des Projekts |
| Bedarfsanalyse \| Fotos | Galerie | Fotos sichtbar für BL & SUB |
| Grundfläche (m²) | Zahl | Projektgröße |
| Badplan | Datei | Badezimmer-Planung |
| **Checkliste Upload** | Formular | Test-Feature für Admin |

#### (1) Angebot
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Status | Badge | (1) Erstellt |
| Deadline \| Angebot | Datum | Frist für Angebotserstellung |
| Angebots Nr. | Text | Angebotsnummer |
| Angebot Kunde gesendet \| Datum | Datum | Versanddatum |
| Datei | PDF-Link | Angebotsdokument (S3) |
| Link | URL | SharePoint-Link |
| Umsatz (netto) | Währung | z.B. €17.500,01 |
| Umsatz (brutto) | Währung | z.B. €20.825,01 |
| **Buttons** | | Bearbeiten, Angebot senden |

#### (2.1) AB (Auftragsbestätigung)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Status | Badge | (0) Offen |
| BV Start / BV Ende Kunde | Datum | Baubeginn und -ende |
| Auftrag Kunde \| Nr/Datum/Datei/Link/Infos | Diverse | Kundenauftrag |
| AB Nr. | Text | z.B. AB-013103 |
| Datum | Datum | AB-Erstellungsdatum |
| Datei | PDF-Link | AB-Dokument |
| Link | URL | SharePoint-Link |
| AB verschickt am | Datum | Versanddatum |
| **Buttons** | | Auftrag hochladen, AB senden |

#### (2.2) NU zuweisen
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Status | Badge | NU-Auftrag offen |
| BV Start / Fertigstellung NU / BV Ende | Datum | Zeitplan |
| NU-Auftrag \| Nr./Datum/Link/Datei | Diverse | z.B. NUA-358 |
| NUA angenommen am | Datum | Annahmedatum |
| Budget (bei Annahme NUA) | Währung | Vereinbartes Budget |
| **Gewerke-Ausführung:** | | |
| - Asbest | Auswahl | Ohne/Mit |
| - Bad | Auswahl | Komplett/Teilweise/Ohne |
| - Boden | Auswahl | Vinyl (Planken)/Fliesen/... |
| - Elektrik | Auswahl | Komplett/Teilweise/Ohne |
| - Elektrik Zähler | Auswahl | Offen/Erledigt |
| - Gastherme | Auswahl | Ohne Therme/Mit Therme |
| - Wände/Decken | Auswahl | Raufaser & Anstrich/... |
| - Türen | Auswahl | Türblätter: neu \| Zarge: neu |
| **Kalkulation:** | | |
| - Umsatz (netto) | Währung | Kundenpreis |
| - Andere NUs/Einkäufe | Währung | Zusatzkosten |
| - Marge (%) | Prozent | z.B. 0,0% |
| - Budget NU (netto) | Währung | Berechnet |
| - Budget/m² | Währung | z.B. 330,19€/m² |
| **Margen-Übersicht:** | Info | Privat: 42%, WBG Lünen: 37%, GWS: 35%, VBW: 25%, Vonovia: 24%, Covivio: 22% |
| **Buttons** | | NU zuweisen, Bauzeit anpassen, Marge anpassen |

#### (2.3) Bauvertrag
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Status | Badge | Lade hoch... |
| Verschickt am | Datum | Versanddatum |
| Unterzeichnet am | Datum | Unterschriftsdatum |
| Datei / Link | Diverse | Vertragsdokument |
| **Button** | | Bauvertrag senden |

#### (3) Vorbereitung
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| **Ausführung wichtiger Gewerke** | | Asbest, Gastherme, Elektrik Zähler, Elektrik, Notizen |
| **Schlüssel-Status:** | | |
| - Deadline \| Schlüssel | Datum | z.B. 22.01.2026 |
| - Status \| Schlüssel | Auswahl | Offen/Erhalten |
| **Buttons** | | Ausführung festlegen, Status & Datum aktualisieren |

#### (4) Umsetzung - Umfangreichster Tab
| Sektion | Felder |
|---------|--------|
| **Ausführung** | Alle Gewerke mit Ausführungsart |
| **Status der Gewerke** | Entkernung, Maurer & Trockenbau, Elektrik, E-Check, Bad & Sanitär, Heizung, Wände & Decken, Boden, Tischler, Endreinigung, Vorabnahme intern, Endabnahme Kunde (jeweils mit Status: Geplant/In Arbeit/Erledigt/Offen) |
| **Termine-Tabelle** | BV Start, BV Ende NU \| Plan, Vorabnahme intern, BV Ende NU \| Mängelfrei, Verspätung, Endabnahme Kunde |
| **Nachträge-Tabelle** | Nr, Status, Titel, Beschreibung, Kunde, NU, Dauer, Fotos + Button "Neuer Nachtrag" |
| **Ausführungsmängel-Tabelle** | Mangel Nr., Status BL, Beschreibung, Fotos, Frist, Behoben, Dauer, Status NU, Nachweise, Kommentar NU + Filter + Button "Neuer Mangel" |
| **Einkäufe andere NUs** | RE-Nr, Steller, Art, Zahlung, Betrag, Spät, Strafe, Bezahlt, Offen, Erstellt, NU Fertig, Fällig, RE, Notizen + Button "RE hinzufügen" |

#### (5.1) Rechnungen Kunde
| Sektion | Beschreibung |
|---------|--------------|
| **Abschlagsrechnung** | Abschlag vereinbart (Ja/Nein), Abschlag % (z.B. 40%), Erstellen bis |
| **Nachträge** | Suche, Button "Nachtrag erstellen" |
| **Rechnungen-Tabelle** | RE-Nr, Steller, Art, Prüfung, Zahlung, Brutto, Netto, Bezahlt, Offen, Erstellt, Verschickt, Fällig, Bezahlt, RE, Notizen |
| **Summen-Übersicht** | Teil-RE, Schluss-RE, Gesamt für: Rechnungen, Zahlungen, Offene Beträge |

#### (5.2) Rechnung NU
| Sektion | Beschreibung |
|---------|--------------|
| **Rechnungen-Tabelle** | RE-Nr, Steller, Art (NUA-S/NUA-A), Prüfung, Zahlung, Brutto, Netto, Bezahlt, Offen, Erstellt, NU Fertig, Fällig, Bezahlt, Datei, Notizen |
| **NUA-Übersicht** | Typ, NUA-Nr., Prüfung, Erstellt, Brutto, Netto, Abschlag, Ende Plan, Ende mängelfrei, Verspätung, Strafe/Tag (0,25%), Strafe, Notizen |
| **Summen-Tabelle** | Budget, Rechnungen, Zahlungen, Offene Beträge (nach Schluss/Verzögerung/Material/Final) |
| **Info** | "Betrag für Deine Schlussrechnung: X €" |

#### (6) Nachkalkulation
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Ausgangsrechnungen | Währung | Summe Kunden-RE |
| Eingangsrechnungen | Währung | Summe NU-RE |
| Rohertrag | Währung + % | Differenz und Marge |
| **Wasserfalldiagramm** | Grafik | Visuelle Nachkalkulation |

### 3.3 Phasen-Workflow

```
Bedarfsanalyse (0)
        │
        ▼
    Angebot (1)
        │
        ▼
┌───────┴───────┐
│   AB (2.1)    │
├───────────────┤
│ NU zuweisen   │
│    (2.2)      │
├───────────────┤
│ Bauvertrag    │
│    (2.3)      │
└───────┬───────┘
        │
        ▼
  Vorbereitung (3)
        │
        ▼
   Umsetzung (4)
        │
        ▼
┌───────┴───────┐
│ Rechnungen    │
│ Kunde (5.1)   │
├───────────────┤
│ Rechnung NU   │
│    (5.2)      │
└───────┬───────┘
        │
        ▼
 Nachkalkulation (6)
```

---

## 4. Integrationen

### 4.1 Übersicht

| System | Funktion | Verbindungsart |
|--------|----------|----------------|
| **HERO Software** | Handwerkersoftware | API |
| **OneDrive/SharePoint** | Dokumentenspeicher | Microsoft Graph API |
| **OneNote** | Notizen & Protokolle | Microsoft Graph API |
| **Matterport** | 3D-Scans | Embed/iFrame |
| **Monday.com** | Datenquelle | Native Softr-Integration |
| **AWS S3** | Datei-Storage | S3 API |

### 4.2 HERO Software

- **Zweck:** Synchronisation von Projekten, Rechnungen, Kontakten
- **Datenfluss:** Bidirektional
- **Sync-Intervall:** Echtzeit/Webhook-basiert
- **Synchronisierte Entitäten:**
  - Bauvorhaben
  - Leistungsverzeichnisse
  - Rechnungen
  - Kontakte

### 4.3 Microsoft 365 (OneDrive/SharePoint/OneNote)

- **Authentifizierung:** OAuth 2.0 / Microsoft Graph
- **Funktionen:**
  - Dokumentenablage pro Bauvorhaben
  - Projektnotizen in OneNote
  - Freigabe für Kunden/NUs
- **Ordnerstruktur:** Automatische Erstellung pro Projekt

### 4.4 Matterport

- **Integration:** iFrame-Einbettung
- **Verwendung:** 3D-Rundgänge für Baustellen
- **Zugriff:** Über Bauvorhaben-Detail

### 4.5 Monday.com

- **Rolle:** Primäre Datenquelle für Softr
- **Boards:**
  - Bauvorhaben
  - Aufgaben
  - Kontakte
  - Nachunternehmer
- **Sync:** Automatisch durch Softr

### 4.6 AWS S3

- **Verwendung:** Datei-Uploads und -Archivierung
- **Bucket-Struktur:** Nach Projekt organisiert
- **Zugriffssteuerung:** IAM-basiert

---

## 5. UI/UX Bewertung (Expertenanalyse)

### 5.1 Executive Summary

Das Neurealis Portal ist ein funktional solides No-Code-System auf Softr-Basis, das die komplexen Anforderungen der Wohnungssanierungsbranche abbildet. Die Tab-basierte Navigation innerhalb der Bauvorhaben-Details ermöglicht eine gute Strukturierung der umfangreichen Datenmenge (10+ Allgemeine Tabs, 10 Bauphasen-Tabs).

**Gesamtbewertung: 6,5/10**

### 5.2 Stärken

| Aspekt | Bewertung | Analyse |
|--------|-----------|---------|
| **Phasen-Workflow** | ★★★★☆ | Logische 0-6 Phasenstruktur bildet Bauprozess korrekt ab |
| **Datentiefe** | ★★★★★ | Umfassende Datenerfassung pro Bauvorhaben (100+ Felder) |
| **Integrationen** | ★★★★☆ | Gute Anbindung an HERO, Monday, SharePoint, Matterport |
| **Kalkulations-Tools** | ★★★★☆ | Automatische Margenberechnung, Nachkalkulation |
| **KI-Features** | ★★★☆☆ | Sprachassistent und "KI fragen" Button vorhanden |
| **Schnellzugriff** | ★★★★☆ | Direktlinks zu wichtigen Phasen im Header |

### 5.3 Kritikpunkte & Verbesserungspotenzial

#### Kritisch (Priorität Hoch)

| Problem | Auswirkung | Empfehlung |
|---------|------------|------------|
| **Tab-Überladung** | 20+ Tabs pro BV → Kognitive Überlastung | Progressive Disclosure: Tabs nach Bedarf einblenden |
| **Horizontales Scrollen** | Tabellen mit 15+ Spalten schlecht bedienbar | Spalten-Konfigurator, wichtige Spalten fixieren |
| **Keine Batch-Operationen** | Jeder Datensatz einzeln bearbeitbar | Mehrfachauswahl für Status-Updates |
| **Redundante Daten** | Gleiche Infos in mehreren Tabs | Konsolidierung, Single Source of Truth |
| **Formular-UX** | Lange Formulare ohne Gruppierung | Wizard-Pattern, Schritt-für-Schritt |

#### Mittel (Priorität Mittel)

| Problem | Empfehlung |
|---------|------------|
| **Fehlende Breadcrumbs** | Navigationspfad anzeigen |
| **Inkonsistente Buttons** | Einheitliches Button-Design |
| **Keine Keyboard-Navigation** | Tastenkürzel für Power-User |
| **Unklare Pflichtfelder** | Visuelle Kennzeichnung (*) |
| **Langsame Ladezeiten** | Lazy Loading für Tabs |

#### Niedrig (Nice-to-Have)

- Dark Mode Option
- Dashboard-Widgets anpassbar
- Favoriten-Funktion für häufige BVs
- Bulk-Export (CSV/Excel)

### 5.4 Softr-spezifische Limitierungen

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **Keine Custom Components** | Eingeschränkte UX-Anpassung | CSS-Overrides wo möglich |
| **Limited Offline-Support** | Feldnutzung eingeschränkt | PWA nicht verfügbar |
| **Starre Tabellenstruktur** | Kein Drag & Drop | Akzeptieren |
| **Performance bei vielen Datensätzen** | Langsam bei 500+ Items | Pagination, Filter |

### 5.5 Positive Design-Elemente

- **Corporate Identity:** Logo und Farbschema konsistent
- **Statusanzeigen:** Farbige Badges für Phasen-Status
- **Externe Links:** Icons für HERO, OneDrive, OneNote, Matterport
- **Margen-Infobox:** Hilfreiche Referenzwerte in (2.2) NU zuweisen
- **Wasserfalldiagramm:** Visuelle Nachkalkulation in Phase 6

### 5.6 Empfohlene Maßnahmen für Migration

Bei einer Migration zu SvelteKit folgende UX-Verbesserungen priorisieren:

1. **Tab-Redesign:** Accordion-Pattern statt horizontale Tabs
2. **Smart Defaults:** Automatische Feldvorbefüllung basierend auf Projekttyp
3. **Inline-Editing:** Direktbearbeitung in Tabellen ohne Modal
4. **Real-time Sync:** Sofortige Updates ohne Page-Reload
5. **Mobile-First:** Responsive Design von Anfang an
6. **Suche:** Globale Suche über alle Entitäten
7. **Benachrichtigungen:** Push-Notifications für wichtige Events

### 5.7 Design-Konsistenz-Analyse

| Element | Status | Anmerkung |
|---------|--------|-----------|
| **Farbschema** | ✅ Konsistent | neurealis Corporate Colors |
| **Typografie** | ✅ Einheitlich | Softr-Standard-Font |
| **Icons** | ⚠️ Teilweise | Mix aus verschiedenen Icon-Sets |
| **Spacing** | ✅ Standard | Softr-Grid |
| **Buttons** | ⚠️ Inkonsistent | Verschiedene Stile (Primary/Secondary/Icon) |
| **Formulare** | ⚠️ Verbesserbar | Lange Listen ohne Gruppierung |

---

## 5.8 Weitere Portal-Bereiche (Übersicht)

### Nachunternehmer-Bereich
| Seite | Funktion |
|-------|----------|
| **Alle NUs** | Vollständige Liste aller Nachunternehmer |
| **Aktive NUs** | Aktuell in Projekten eingesetzte NUs |
| **In Qualifizierung** | NUs im Bewertungsprozess |
| **Nachweise (Status)** | Übersicht aller NU-Zertifikate und -Nachweise |

### Finanzen-Bereich
| Seite | Funktion |
|-------|----------|
| **Eingangsrechnungen** | NU-Rechnungen mit Prüfstatus |
| **Ausgangsrechnungen** | Kundenrechnungen |
| **Zahlungsabgleich** | Kontoabgleich mit offenen Posten |
| **Kontostände** | Aktuelle Bankkonten |
| **Forecast** | Liquiditätsplanung |
| **Übersicht Bau-Phasen** | Finanz-Übersicht nach Phasen |
| **Margen der Projekte** | Rentabilitätsanalyse |

### Einkauf-Bereich (Detailliert)

#### Lieferanten
Filter auf Kontakte-Tabelle mit `Kontaktarten = "Lieferant"`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Unternehmensname kurz/lang | Text | Firmenname |
| Vorname/Nachname | Text | Ansprechpartner |
| E-Mail / E-Mail Rechnung | Email | Kontaktadressen |
| Telefon mobil/festnetz | Phone | Rufnummern |
| Website | URL | Firmenwebsite |
| Rechnungsadresse | Text | Straße, PLZ, Ort, Land |
| Zahlungsziel Tage | Zahl | Zahlungsbedingungen |
| DSGVO-Felder | Diverse | Einwilligung, Datum, Quelle |

#### Artikel (Leistungsverzeichnisse)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Artikelnummer | Text | z.B. "2000-0002" |
| LV (Kundenname) | Text | Welches LV |
| Kategorie | Text | Gewerkkategorie |
| Positionsname | Text | Artikelbezeichnung |
| Beschreibung | Long Text | Detailbeschreibung |
| Listenpreis | Währung | Verkaufspreis |
| EK | Währung | Einkaufspreis |
| Einheit | Text | Stück, m², Psch, etc. |
| MwSt. | Prozent | Mehrwertsteuersatz |

**Statistiken:** 2.028 LV-Positionen, 6 LV-Typen, 23 Gewerke, 76 Bestellartikel

### Inventar-Bereich (Detailliert)

| Feldgruppe | Felder |
|------------|--------|
| **Identifikation** | Inventar-ID, AutoNumber, Kategorie (Fahrzeug/Maschine/Elektrowerkzeug/IT/Handwerkzeug/Messgerät), Hersteller, Modell, Seriennummer |
| **Status** | Status (einsatzbereit/in Benutzung/defekt/in Wartung/verloren/ausgesondert), Zustand |
| **Standort** | Kategorie (Lager/Mitarbeiter/Projekt/Frei/Fahrzeug), Bezeichnung |
| **Besitzer** | Aktueller Besitzer, Übergabedatum, Rückgabedatum, Quittierung |
| **Kauf** | Eigentümer, Beschaffungstyp (Kauf/Miete/Leasing), Lieferant, Anschaffungsdatum, Kaufpreis, Garantie bis |
| **Wartung** | Wartungspflicht, Intervall, Letzte/Nächste Wartung |
| **Sicherheit** | Prüfung erforderlich, Prüfintervall, Letzte/Nächste Prüfung |
| **Finanzen** | Verantwortlicher, Kostenstelle, Abschreibungsmethode, Wiederbeschaffungswert |
| **Dokumente** | Foto, Prüfprotokoll, QR-Code Link |

### Marketing-Bereich (Detailliert)

#### Social Media Beiträge
| Feld | Beschreibung |
|------|--------------|
| Posts Status | Workflow-Status |
| Post Vorher Text/Status | Vorher-Content |
| Post Nachher Text/Status | Nachher-Content |
| Post Vorher/Nachher Text | Kombinierter Vergleich |
| Kommentare | Interne Notizen |
| Formular-Link | Social Media Eingabe |

#### Baustellen-Posts (Matterport)
- Verknüpfung mit Bauvorhaben
- Titelfoto BV
- Matterport Vorher/Nachher Links
- Baufortschritt-Fotos
- 25 Matterport Spaces verfügbar

### Sonstige Bereiche
| Seite | Funktion |
|-------|----------|
| **Personal → Bewerber** | HR-Bewerbermanagement |
| **Test** | Beta-Features (Kontakte beta, Finanzen NEU) |

---

## 6. Technische Details

### 6.1 Softr-Konfiguration

```
Plattform: Softr.io
Plan: Business (oder höher)
Custom Domain: portal.neurealis.de
SSL: Aktiv
```

### 6.2 Datenbank-Struktur (Monday.com)

| Board | Primäre Spalten |
|-------|-----------------|
| **Bauvorhaben** | Name, Phase, Bauleiter, Kunde, Status |
| **Aufgaben** | Titel, Projekt, Verantwortlicher, Fälligkeit |
| **Kontakte** | Name, Firma, Typ (Kunde/NU/Lieferant) |
| **Nachunternehmer** | Firma, Gewerk, Status, Bewertung |
| **Dokumente** | Name, Projekt, Kategorie, Upload-Datum |

### 6.3 Authentifizierung

- **Methode:** Magic Link (passwortlos)
- **Ablauf:**
  1. Benutzer gibt E-Mail ein
  2. System sendet Login-Link
  3. Klick auf Link authentifiziert Session
- **Session-Dauer:** 7 Tage (konfigurierbar)
- **Berechtigungen:** Rollenbasiert (Admin, Mitarbeiter, Extern)

---

## 7. Wartung & Support

### 7.1 Regelmäßige Aufgaben

| Aufgabe | Intervall | Verantwortlich |
|---------|-----------|----------------|
| Daten-Sync prüfen | Täglich | Automatisch |
| Benutzer-Review | Monatlich | Admin |
| Integration-Health | Wöchentlich | IT |
| Backup-Kontrolle | Monatlich | IT |

### 7.2 Fehlerbehandlung

- **Monday.com Sync-Fehler:** Board-Verbindung prüfen
- **Login-Probleme:** Magic Link Spam-Ordner prüfen
- **Langsame Ladezeiten:** Datenfilter optimieren

---

## 8. Anhang

### 8.1 Glossar

| Begriff | Definition |
|---------|------------|
| **AB** | Auftragsbestätigung |
| **NU** | Nachunternehmer |
| **LV** | Leistungsverzeichnis |
| **Magic Link** | Passwortloser Login per E-Mail-Link |
| **Softr** | No-Code Plattform für Web-Apps |

### 8.2 Referenzen

- Softr Dokumentation: https://docs.softr.io
- Monday.com API: https://developer.monday.com
- HERO API: (intern)

### 8.3 Änderungshistorie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-01-27 | Initiale Dokumentation |

---

*Erstellt mit Claude Code - neurealis GmbH*
