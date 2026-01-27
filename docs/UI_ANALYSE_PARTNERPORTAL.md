# UI-Analyse: neurealis Partnerportal (Softr)

**Analysiert am:** 2026-01-27
**URL:** https://neurealis-partnerportal.preview.softr.app/
**Plattform:** Softr (No-Code)
**Zielgruppe:** Nachtunternehmer / Partner (Handwerksbetriebe)

---

## 1. Übersicht & Navigation

### 1.1 Sidebar Navigation
| Icon | Menüpunkt | URL | Beschreibung |
|------|-----------|-----|--------------|
| 🏠 | Startseite | `/` | Dashboard mit aktuellen BVs |
| ➕ | Aufträge | `/auftraege` | Neue Aufträge annehmen |
| ⚠️ | Offene Mängel | `/offene-maengel` | Mängelliste über alle BVs |
| € | Rechnungen | `/rechnungen` | Rechnungsübersicht & Upload |
| 📋 | Fertige BV | `/fertige-bauvorhaben` | Abgeschlossene Projekte |
| 📝 | LVs | `/lvs` | Leistungsverzeichnisse |
| 📄 | Vorlagen | `/vorlagen-lvs` | Dokument-Vorlagen |
| 📎 | Deine Nachweise | `/nachweise` | Firmen-Nachweise verwalten |

### 1.2 User-Profil (Footer Sidebar)
- Firmenname + E-Mail
- Profilbild
- Dropdown für Einstellungen/Logout

### 1.3 Design-System
- **Primärfarbe:** Rot (#C41E3A)
- **Sidebar:** Hellrosa Hintergrund (#FFF5F5)
- **Aktiver Menüpunkt:** Rötlicher Hintergrund
- **Buttons:** Rot mit weißer Schrift
- **Status-Badges:** Farbcodiert (Rot=Offen, Grün=Erledigt, Lila=Phase)

---

## 2. Seiten-Struktur

### 2.1 Startseite (`/`)

**Titel:** "Aktuelle BV"
**Beschreibung:** "Hier erscheinen alle von dir bestätigten BVs. Falls ein Projekt fehlt, schaue im Abschnitt 'Aufträge'."

**Tabelle - Spalten:**
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| ProjektNr | Text | ATBS-XXX Format |
| NUA | Text | NUA-XXX Format |
| Projekt | Text | Adresse + Beschreibung |
| Kunde | Text | Auftraggeber (z.B. "covivio", "privat") |
| Phase | Badge | Status-Badge (z.B. "(2) Auftrag erhalten") |
| BV Start | Datum | Baubeginn |
| BV Ende | Datum | Geplantes Ende |
| Budget Start | Währung | Ursprüngliches Budget |
| Budget Final | Währung | Aktuelles Budget |
| 3D-Rundg. | Link | Matterport-Link (wenn vorhanden) |
| NUA | Dateien | PDF-Downloads (NUA-Dokumente) |

**Features:**
- Suchfeld
- Filter "Status BV"
- Klick auf Zeile → BV-Details

---

### 2.2 BV-Detailseite (`/bauvorhaben-details?recordId=XXX`)

**Header-Bereich:**
- Projektadresse als Titel
- Status-Badge
- Budget-Anzeige

**Info-Karten (4 Spalten):**

| Karte 1 | Karte 2 | Karte 3 | Karte 4 |
|---------|---------|---------|---------|
| Projekt-Nr. | Bauleiter | Beginn | Auftrag angenommen am |
| NUA-Nr. | Handynummer (klickbar) | Fertigstellung Plan | Budget (bei Annahme) |
| Grundfläche | 3D Rundgang (vorher) | Fertigstellung Tatsächlich | - |
| Badplan | 3D Rundgang (nachher) | - | - |

**Budget-Berechnung:**
| Feld | Beschreibung |
|------|--------------|
| Aktuelles Budget | Nach Nachträgen |
| Verspätung | X Tag(e) |
| Vertragsstrafe | Berechnet |
| Finales Budget | Nach allen Abzügen |

**Nachweise-Status:**
- Abdichtung Bad: Keine/Vorhanden
- Elektrik (Roh): Keine/Vorhanden
- Heizung & Sanitär (Roh): Keine/Vorhanden
- E-Check Protokoll: Offen/Erledigt

**Action-Buttons:**
- 🔴 "Nachweise hochladen"
- 🔴 "RE hochladen" (Rechnung)
- ⋯ Weitere Optionen

**Tab-Navigation:**

#### Tab: Gewerke | Status
Liste aller Gewerke mit Status:
- Entkernung → Geplant/In Arbeit/Erledigt
- Maurer & Trockenbau
- Elektrik
- Bad & Sanitär
- Heizung
- Tischler
- Wände & Decken
- Boden
- Endreinigung
- Abnahme mit Bauleiter

#### Tab: Mängel
**Tabelle:**
| Spalte | Beschreibung |
|--------|--------------|
| Mangel-Nr. | ATBS-XXX-M## |
| Status BL | Bauleiter-Status |
| Frist | Behebungsfrist |
| Beschreibung | Mangelbeschreibung |
| Fotos BL | Fotos vom Bauleiter |
| Dein Status | NU-Status (editierbar) |
| Deine Fotos | Upload möglich |
| Mieter | Kontaktdaten |
| Rufnummer | Telefon |
| Notizen | Freitext |

#### Tab: Nachträge
**Button:** "Neuer Nachtrag"

**Tabelle:**
| Spalte | Beschreibung |
|--------|--------------|
| Nr | ATBS-XXX-N# |
| Status BL | (0) Offen, (1) Genehmigt, (2) Abgelehnt |
| Dein Status | (0) Offen, (2) Angenommen |
| Titel | Kurzbezeichnung |
| Beschreibung | Details |
| Budget | Betrag in € |
| Dauer | X Tag(e) |
| Fotos | Bild-Upload |

#### Tab: Alle Dokumente
**Tabelle:**
| Spalte | Beschreibung |
|--------|--------------|
| Dokument | Typ (z.B. "NUA-S NU-Auftrag Schluss") |
| Dok-Nr | Dokumentnummer |
| Betrag (netto) | Wert |
| Datei | PDF-Download |

#### Tab: Deine Rechnungen
**Bereich 1: Offene Mängel** (Warnung)

**Button:** "RE hochladen"

**Tabelle Rechnungen:**
| Spalte | Beschreibung |
|--------|--------------|
| Dokument | Typ |
| Dok-Nr | Nummer |
| Betrag (brutto) | - |
| Betrag (netto) | - |
| Status Prüfung | (0) Offen |
| Status Zahlung | (0) Offen |
| BV Ende | Datum |
| Zahlungsziel | X Tag(e) |
| RE fällig | Fälligkeitsdatum |
| Bezahlt | Betrag |
| Offen | Restbetrag |
| Datei | PDF |

**Zusammenfassung:**
| Kategorie | Abschlag | Schluss | Verzögerung | Material | Final |
|-----------|----------|---------|-------------|----------|-------|
| Budget | X € | X € | -X € | -X € | X € |
| Rechnungen | X € | X € | - | - | X € |
| Zahlungen | X € | X € | - | - | X € |
| Offene Beträge | X € | X € | - | - | X € |

**Hinweis:** "Betrag für Deine Schlussrechnung: X €"

---

### 2.3 Aufträge (`/auftraege`)

**Titel:** "Neue Aufträge"

**Suchfeld:** "Zum Suchen, hier Namen des BV, Projekt-Nr. oder Auftrags-Nr. eingeben"

**Empty State:** "Keine offenen Rechnungen vorhanden. Vielen Dank! :-)"

---

### 2.4 Offene Mängel (`/offene-maengel`)

**Titel:** "Offene Mängel"
**Warnung:** "⚠️ Erst wenn alle gemeldeten Mängel behoben wurden, kann die Schlussrechnung überwiesen werden."

**Tabelle:** (Gleiche Struktur wie BV-Detail Mängel-Tab)

---

### 2.5 Rechnungen (`/rechnungen`)

**Titel:** "Deine Rechnungen"

**Info-Box (2-sprachig DE/RU):**
```
🧾 Erklärung Rechnungslauf (Neuerung)

1. Zahlungsziel
   Ab mängelfreier Fertigstellung

2. Zwei Phasen der Rechnungsstellung
   Phase 1: Rechnungen in Vorbereitung (Budget noch nicht final)
   Phase 2: Rechnungen mit finalem Budget

Wichtig: Zahlungsziel startet immer ab mängelfreier Fertigstellung
```

**Tabelle 1: "(1) Rechnungen in Vorbereitung"**
| Spalte | Beschreibung |
|--------|--------------|
| BV Nr. | ATBS-XXX |
| NUA Nr. | NUA-XXX |
| BV | Projektadresse |
| Budget (Start) | Ursprünglich |
| Budget (aktuell) | Nach Nachträgen |
| BV Ende (Plan) | Geplant |
| BV Ende (mängelfrei) | Tatsächlich |
| Verspätung | X Tag(e) |
| Abzug | Vertragsstrafe |
| Budget (nach Verspätung) | Final |

**Tabelle 2: "(2) Rechnungen mit finalem Budget"**
| Spalte | Beschreibung |
|--------|--------------|
| BV Nr. | ATBS-XXX |
| NUA Nr. | NUA-XXX |
| BV | Projektadresse |
| Status | (0) Noch nicht erhalten, (1) Erhalten |
| Budget | Betrag |
| BV Ende (Plan) | Geplant |
| BV Ende (mängelfrei) | Tatsächlich |
| Verspätung | X Tag(e) |
| Abzug | Vertragsstrafe |
| Budget (final) | Endbetrag |

---

### 2.6 Fertige BV (`/fertige-bauvorhaben`)

**Titel:** "Fertige Bauvorhaben"

**Tabelle:**
| Spalte | Beschreibung |
|--------|--------------|
| BV Nr. | ATBS-XXX |
| NUA Nr. | NUA-XXX |
| BV | Projektadresse |
| BV Ende (Plan) | Geplant |
| BV Ende | Tatsächlich |
| Budget | Endbetrag |

---

### 2.7 LVs (`/lvs`)

**Titel:** "Leistungsverzeichnisse"

**Features:**
- Suchfeld: "LVs durchsuchen"
- Dropdown: "LV auswählen"
- Button: "KI fragen" (rot, mit Icon)

**Karten-Layout:**
Jede LV-Position als Karte:
- **Titel:** z.B. "Handbrause-Set Dusche"
- **LV-Nummer:** z.B. "GWS.LV23-21.02.02.18"
- **Kategorie-Badge:** z.B. "GWS 2025-01", "Covivio 2024-10"
- **Button:** "Details" (rot)

---

### 2.8 Vorlagen (`/vorlagen-lvs`)

**Titel:** "Vorlagen & LVs"

**Beschreibung:** Informationen zu Bau-Standards, Leistungsverzeichnissen

**Warnung:** "Bitte beachte, dass alle Inhalte nur für den internen Gebrauch bestimmt sind"

**Abschnitt: "Interne Unterlagen"**
- ⚠️ "Nur für den internen Gebrauch – Weitergabe an Dritte ist nicht gestattet."

**Dokumente (Accordion):**
- neurealis | Protokoll Endabnahme Wohnungssanierung
- Vorlage | Bescheinigung Einhaltung Mindestlohn
- Vonovia | Produkthandbuch 2.7
- Covivio | Qualitätshandbuch

---

### 2.9 Deine Nachweise (`/nachweise`)

**Titel:** "Übersicht Nachweise"

**Beschreibung:** Überblick über alle Nachweise mit Status

**Status-Übersicht (Tabelle):**
| §13b UStG | §48 EStG | Versicherung | Mindestlohn | Gewerbeschein | Konzession Gas | Konzession Elektro | UB Krankenkasse |
|-----------|----------|--------------|-------------|---------------|----------------|-------------------|-----------------|
| Offen | Offen | Offen | Offen | Offen | Offen | Offen | Offen |

**Nachweis-Abschnitte:**

| Nachweis | Beschreibung |
|----------|--------------|
| §13b UStG | Steuerschuldnerschaft bei Bauleistungen |
| §48 EStG | Freistellungsbescheinigung Steuerabzug |
| Betriebshaftpflichtversicherung | Min. 500k Personen, 250k Sach, 100k Vermögen |
| Mindestlohn | Verpflichtungserklärung |
| Gewerbeschein | Gewerbeanmeldung |
| Konzession Gas | Handwerksnachweis |
| Konzession Elektro | Handwerksnachweis |
| UB Krankenkasse | Unbedenklichkeitsbescheinigung |

**Pro Nachweis:**
- Status-Badge
- Ablaufdatum
- Dokument-Link
- Button: "Aktualisieren" (rot)

---

## 3. Status-Badges & Farben

### BV-Phasen
| Phase | Label | Farbe |
|-------|-------|-------|
| 1 | Angebot | Grau |
| 2 | Auftrag erhalten | Lila |
| 3 | In Arbeit | Blau |
| 4 | Abnahme | Orange |
| 5 | Rechnungsstellung | Grün |
| 6 | Abgeschlossen | Dunkelgrün |

### Mängel-Status
| Status | Label | Farbe |
|--------|-------|-------|
| 0 | Offen | Rot |
| 1 | In Bearbeitung | Orange |
| 2 | Erledigt | Grün |

### Nachtrags-Status BL
| Status | Label |
|--------|-------|
| 0 | Offen / Preis eingeben |
| 1 | Genehmigt |
| 2 | Abgelehnt |

### Nachtrags-Status NU
| Status | Label |
|--------|-------|
| 0 | Offen |
| 2 | Angenommen |

### Rechnungs-Status
| Status | Label |
|--------|-------|
| 0 | Noch nicht erhalten / Offen |
| 1 | Erhalten |

### Nachweis-Status
| Status | Label | Farbe |
|--------|-------|-------|
| Offen | Offen | Grau/Rot |
| Gültig | Gültig | Grün |
| Abgelaufen | Abgelaufen | Rot |

---

## 4. Besonderheiten

### 4.1 Mehrsprachigkeit
- Rechnungs-Erklärung: Deutsch + Russisch (für russischsprachige Partner)

### 4.2 Vertragsstrafen-Berechnung
- Automatische Berechnung bei Verspätung
- Tagesbasierte Abzüge
- Transparente Darstellung

### 4.3 Dokument-Management
- PDF-Upload für Rechnungen
- PDF-Upload für Nachweise
- Foto-Upload für Mängel/Nachträge
- Dokumente von monday.com S3

### 4.4 KI-Integration
- "KI fragen" Button bei LVs
- Vermutlich für LV-Positionen-Suche

### 4.5 3D-Rundgänge
- Matterport-Integration
- Vorher/Nachher Vergleich

---

## 5. Datenquellen

- **monday.com:** Hauptdatenbank für BVs, Mängel, Nachträge
- **Softr Tables:** Vermutlich für Nachweise
- **S3 (monday.com):** Dokumentenspeicher

---

## 6. Empfehlungen für neurealis ERP

### Zu übernehmende Features:
1. **Gewerke-Tracking** mit Status pro Gewerk
2. **Nachtrags-Workflow** mit Genehmigungsprozess
3. **Vertragsstrafen-Berechnung** automatisch
4. **Nachweise-Management** mit Ablaufdaten
5. **LV-Katalog** mit Suchfunktion
6. **Mängel-Tracking** mit Foto-Upload

### Verbesserungspotential:
1. Einheitliche Sprache (komplett Deutsch)
2. Bessere Mobile-Optimierung
3. Echtzeit-Benachrichtigungen
4. Dashboard mit KPIs
5. Kalender-Integration

---

*Dokumentation erstellt: 2026-01-27*
