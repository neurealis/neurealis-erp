# UI-Analyse: neurealis Kundenportal (Softr)

**Analysiert am:** 2026-01-27
**URL:** https://kundenportal.neurealis.de/
**Plattform:** Softr (No-Code)
**Zielgruppe:** Kunden (Auftraggeber / Eigentümer)

---

## 1. Übersicht & Navigation

### 1.1 Sidebar Navigation
| Icon | Menüpunkt | URL | Beschreibung |
|------|-----------|-----|--------------|
| 🏠 | Startseite | `/` | Dashboard mit aktuellen BVs |
| 🏗️ | Bauvorhaben | `/bauvrhaben` | Übersicht aller BVs + Bauzeitenplan |
| ✉️ | Angebote | `/angebote` | Offene Angebote annehmen/ablehnen |
| 📄 | Rechnungen | `/rechnungen` | Offene & alle Rechnungen |
| 👤 | Ansprechpartner | `/ansprechpartner` | Kontaktdaten Team |

### 1.2 User-Profil (Footer Sidebar)
- Firmenname + E-Mail
- Profilbild
- Dropdown für Einstellungen/Logout

### 1.3 Design-System
- **Primärfarbe:** Rot (#C41E3A)
- **Sidebar:** Hellrosa Hintergrund (#FFF5F5)
- **Aktiver Menüpunkt:** Rötlicher Hintergrund
- **Buttons:** Rot mit weißer Schrift
- **Status-Badges:** Farbcodiert nach Phase
- **Header-Bilder:** Architektur-/Büro-Fotos

---

## 2. Seiten-Struktur

### 2.1 Startseite (`/`)

**Titel:** "Willkommen [Firmenname]"
**Beschreibung:** Dashboard mit aktuellen Bauvorhaben und offenen Rechnungen

**Bereich 1: Aktuelle Bauvorhaben**
- Karten-Layout mit Projektbild
- Klick → BV-Details

**Karten-Felder:**
| Feld | Beschreibung |
|------|--------------|
| Projektname | Adresse + Lage |
| Status | Badge (z.B. "(4) Umsetzung") |
| Thumbnail | Projektbild |

**Bereich 2: Offene Rechnungen**
- Liste der unbezahlten Rechnungen
- Quick-Link zu Rechnungen-Seite

---

### 2.2 Bauvorhaben (`/bauvrhaben`)

**Titel:** "Alle Infos zu Ihren Bauvorhaben an einem Platz"
**Beschreibung:** Übersicht der aktiven Projekte, Bauzeitenplan und Karte mit Adressen

**Anchor-Links:**
- Bauzeitenplan
- Übersicht BVs

**Bereich 1: Übersicht Bauvorhaben**

**Suchfeld:** "Zum Suchen, hier den Namen des BV eingeben"
**Filter:** Status BV (Dropdown)
**Button:** "Neues Projekt anfragen" → monday.com Formular

**Karten-Layout:**
| Feld | Beschreibung |
|------|--------------|
| Projektname | Adresse + Lage (z.B. "Schreberstraße 55, 44627 Herne \| 2. OG") |
| Status | Badge mit Phase |
| Angebotssumme (brutto) | Betrag in € |
| Start BV | Datum |
| Termin Endabnahme | Datum oder "-" |
| Bauleiter | Name |
| Thumbnail | Projektbild |

**Bereich 2: Bauzeitenplan**

**Beschreibung:** "Übersicht aller geplanten und aktiven Bauvorhaben"

**Suchfeld:** Projekte durchsuchen
**Filter-Buttons:**
- (3) BV in Planung
- (4) BV in Umsetzung
- (6) BV abgeschlossen
- (6) Rechnungsstellung

**Kalender:**
- Monatsansicht (Mo-Fr)
- Navigation: < Today >
- Ansicht: Month (Dropdown)
- BV als farbige Balken über Zeitraum
- Klick auf BV → Details

---

### 2.3 BV-Detailseite (`/bauvorhaben-details?recordId=XXX`)

**Header-Bereich:**
- Projektadresse als Titel
- Zurück-Button

**Info-Karten (4 Spalten):**

| Karte 1 | Karte 2 | Karte 3 | Karte 4 |
|---------|---------|---------|---------|
| Projekt-Nr. (ATBS-XXX) | Bauleiter | Beginn | Angebotssumme |
| Status | Handynummer (klickbar) | Fertigstellung Plan | - |
| - | 3D Rundgang (Link) | - | - |

**Dokumente-Bereich:**
| Dokumenttyp | Beschreibung |
|-------------|--------------|
| ANG-Ku | Kundenangebot |
| AB | Auftragsbestätigung |
| NUA-S | Nachunternehmer-Auftrag Schluss |
| RE | Rechnungen |

**Tab: Gewerke | Status**
Liste aller Gewerke mit Status:
- Entkernung
- Maurer & Trockenbau
- Elektrik
- Bad & Sanitär
- Heizung
- Tischler
- Wände & Decken
- Boden
- Endreinigung
- Abnahme mit Bauleiter

**Status-Optionen:** Geplant / In Arbeit / Erledigt

**Tab: Nachträge**
Tabelle mit Nachtrags-Anfragen:
| Spalte | Beschreibung |
|--------|--------------|
| Nr | Nachtragsnummer |
| Status | Offen/Genehmigt/Abgelehnt |
| Titel | Kurzbezeichnung |
| Beschreibung | Details |
| Budget | Betrag in € |

**Action-Buttons:**
- 🔴 "Nachtrag stellen"
- 🔴 "Mangel melden"

---

### 2.4 Angebote (`/angebote`)

**Titel:** "Ihre Angebote"
**Beschreibung:** "Auf dieser Seite finden Sie alle Angebote zu Ihren Bauvorhaben übersichtlich dargestellt. Mit nur einem Klick können Sie jedes Angebot direkt annehmen oder bei Bedarf ablehnen – einfach, schnell und unkompliziert."

**Bereich: Offene Angebote**

**Suchfeld:** "Zum Suchen, Namen des BV oder Angebotsnummer hier eingeben"

**Karten-Felder (bei vorhandenen Angeboten):**
| Feld | Beschreibung |
|------|--------------|
| Projektname | BV-Adresse |
| Angebotsnummer | ANG-XXXX |
| Betrag | Angebotssumme |
| Datum | Angebotsdatum |
| Aktionen | Annehmen / Ablehnen |

**Empty State:** "Keine offenen Rechnungen vorhanden. Vielen Dank! :-)"
*(Hinweis: Textfehler - sollte "Angebote" statt "Rechnungen" heißen)*

---

### 2.5 Rechnungen (`/rechnungen`)

**Titel:** "Rechnungen"
**Beschreibung:** "Auf dieser Seite finden Sie sowohl vergangene als auch aktuelle bzw. offene Rechnungen."

**Anchor-Links:**
- Offene Rechnungen
- Alle Rechnungen

**Bereich 1: Offene Rechnungen**

**Suchfeld:** "Zum Suchen, Namen des BV oder Rechnungsnummer hier eingeben"

**Karten-Layout:**
| Feld | Beschreibung |
|------|--------------|
| Projektname | BV-Adresse |
| RE-Nr | Rechnungsnummer (z.B. "RE-0015101") |
| Betrag | Rechnungssumme (z.B. "24.021,45 €") |
| Fälligkeitsdatum | Datum |
| Status | Badge (z.B. "(7) Bezahlt, zu wenig", "(0) Noch erstellen") |
| Datei | PDF-Download |

**Bereich 2: Alle Rechnungen**

**Beschreibung:** "Hier können Sie alle Rechnungen (offen & bezahlt) einsehen und durchsuchen."

**Suchfeld:** "Zum Suchen, Namen des BV oder Rechnungsnummer hier eingeben"

**Empty State:** "Keine offenen Rechnungen vorhanden. Vielen Dank! :-)"

---

### 2.6 Ansprechpartner (`/ansprechpartner`)

**Titel:** "Ihre Ansprechpartner bei neurealis"
**Beschreibung:** "Wir sind für Sie da: Ob Fragen, Beratung oder Unterstützung – wir möchten Ihr Anliegen schnell und unkompliziert klären. Unser Ziel ist es, Ihnen den besten Service zu bieten und Sie optimal zu beraten. Kontaktieren Sie uns – wir helfen gerne weiter. 😊"

**Karten-Layout (6 Mitarbeiter):**

| Name | Rolle | Bereich | Kontakt |
|------|-------|---------|---------|
| Dirk Jansen | Bauleiter | Private & wohnwirtschaftliche Kunden | E-Mail + Mobil |
| Aki Wege | Bauleiter | Wohnwirtschaftliche Kunden | E-Mail + Mobil |
| Dietmar Theiling | Betriebsleiter SHK | Private & wohnwirtschaftliche Kunden | E-Mail + Mobil |
| Hannah Bennemann | Kaufmännische Leiterin | Kaufmännische Themen | E-Mail + Tel. |
| Sabine Camps-Mirau | Kaufmännische Mitarbeiterin | Kaufmännische Themen | E-Mail + Tel. |
| Holger Neumann | Geschäftsführer | Alle anderen Themen | E-Mail + Mobil |

**Karten-Features:**
- Profilbild
- Name + Rolle
- Zuständigkeitsbereich
- E-Mail (mailto-Link)
- Telefon (tel-Link)
- Social Media Icons (LinkedIn, X, Instagram) bei manchen

---

## 3. Status-Badges & Farben

### BV-Phasen (Kundenportal)
| Phase | Label | Farbe |
|-------|-------|-------|
| 0 | Bedarfsanalyse | Grau |
| 3 | BV in Planung | Blau |
| 4 | Umsetzung | Orange |
| 5 | Rechnungsstellung | Gelb |
| 6 | BV abgeschlossen | Grün |
| 7 | Projekt abgeschlossen | Dunkelgrün |

### Rechnungs-Status
| Status | Label |
|--------|-------|
| 0 | Noch erstellen |
| 7 | Bezahlt, zu wenig |
| (weitere) | Offen, Bezahlt |

---

## 4. Vergleich: Kundenportal vs. Partnerportal

| Feature | Kundenportal | Partnerportal |
|---------|--------------|---------------|
| **Zielgruppe** | Auftraggeber/Eigentümer | Nachunternehmer/Partner |
| **Navigation** | 5 Menüpunkte | 8 Menüpunkte |
| **BV-Ansicht** | Karten + Kalender | Tabelle |
| **Mängel** | Nur melden | Verwalten + Fotos |
| **Nachträge** | Nur stellen | Vollständiger Workflow |
| **Rechnungen** | Empfangen/Bezahlen | Erstellen/Hochladen |
| **LVs** | Nicht vorhanden | Vollständiger Katalog |
| **Nachweise** | Nicht vorhanden | Vollständiges Management |
| **Bauzeitenplan** | Vorhanden | Nicht vorhanden |
| **Ansprechpartner** | Vorhanden | Nicht vorhanden |
| **Sprache** | Nur Deutsch | Deutsch + Russisch |

---

## 5. Besonderheiten

### 5.1 Bauzeitenplan (Kalender)
- Monatsansicht mit Wochentagen (Mo-Fr)
- BV-Zeiträume als farbige Balken
- Filter nach Status
- Navigation: Heute / Monat vor/zurück

### 5.2 Neues Projekt anfragen
- Button verlinkt zu monday.com Formular
- Externes Formular für Projektanfragen

### 5.3 Mängel/Nachträge aus Kundensicht
- Vereinfachte Ansicht
- "Mangel melden" Button
- "Nachtrag stellen" Button
- Keine Verwaltungsfunktionen

### 5.4 Ansprechpartner-Seite
- Persönliche Kontakte mit Fotos
- Direkte Kontaktmöglichkeiten (mailto, tel)
- Freundliche, einladende Texte mit Emoji

---

## 6. Datenquellen

- **monday.com:** Hauptdatenbank für BVs, Dokumente
- **Softr:** Frontend-Rendering
- **S3 (monday.com):** Dokumentenspeicher

---

## 7. Empfehlungen für neurealis ERP (Kunden-Bereich)

### Zu übernehmende Features:
1. **Bauzeitenplan/Kalender** mit Monatsansicht
2. **BV-Karten** mit Thumbnail und Kerndaten
3. **Ansprechpartner-Seite** mit Fotos und Kontakt
4. **Vereinfachte Mängel/Nachtrags-Eingabe**
5. **Rechnungsübersicht** mit Status

### Verbesserungspotential:
1. Textfehler beheben ("Rechnungen" statt "Angebote")
2. Mehr Filteroptionen für Rechnungen
3. Dokumenten-Vorschau ohne Download
4. Push-Benachrichtigungen bei neuen Rechnungen
5. Chat-Funktion mit Bauleiter

---

*Dokumentation erstellt: 2026-01-27*
