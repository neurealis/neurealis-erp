# SharePoint-Struktur Muster-Analyse

**Erstellt:** 2026-02-01
**Analysierte Dokumente:** 155 SharePoint-Links + 45 OneDrive-Pfade

---

## Zusammenfassung

Die SharePoint-Struktur ist grundsätzlich gut organisiert, aber es gibt mehrere Inkonsistenzen, die die automatische Verarbeitung und Zuordnung erschweren.

| Kategorie | Status | Handlungsbedarf |
|-----------|--------|-----------------|
| Site-Struktur | Gut | Gering |
| Auftraggeber-Ordner | Inkonsistent | Mittel |
| Projekt-Ordner (ATBS) | Teilweise inkonsistent | Mittel |
| Dokumenttyp-Ordner | Gut | Gering |
| Datumsformate | Gemischt | Mittel |
| Altlasten (Google Drive) | Vorhanden | Niedrig |

---

## 1. Erkannte Muster (Was funktioniert gut)

### 1.1 SharePoint Sites (3 Sites)

| Site | Dokumente | Zweck |
|------|-----------|-------|
| `Wohnungssanierung-Projekte` | 117 | Aktive und abgeschlossene Projekte |
| `Wohnungssanierung-Kunden` | 25 | Kunden-Stammdaten, LVs, Angebote |
| `Wohnungssanierung` | 13 | Allgemeine Dokumente, Marketing |

**Bewertung:** Klare Trennung zwischen Projekten und Kunden-Stammdaten.

### 1.2 Dokumenttyp-Ordner (Nummeriert)

Die Dokumenttyp-Ordner folgen einem konsistenten Schema:

| Ordner | Anzahl | Beschreibung |
|--------|--------|--------------|
| `00 LVs` | 1 | Leistungsverzeichnisse |
| `01 Angebot - SUB` | 1 | NU-Angebote |
| `02 Angebot - Peter` | - | Angebote (alt) |
| `03 Auftrag` | 6 | Auftragsbestätigungen |
| `06 Rechnung - Kunde` | 83 | Ausgangsrechnungen |
| `07 Rechnung - SUB` | 22 | Eingangsrechnungen NU |

**Bewertung:** Sehr gut strukturiert mit klarer Nummerierung.

### 1.3 ATBS-Nummern in Projekt-Ordnern

93 von 155 SharePoint-Links (60%) enthalten eine ATBS-Nummer im Pfad.

**Standard-Format:** `ATBS-XXX [auftraggeber] - [adresse] - [wohnungslage]`

**Beispiele korrekter Pfade:**
- `ATBS-430 gws - Langobardenstrasse 33 - Dortmund - EG mitte`
- `ATBS-414 covivio - Hiesfelderstr.25 - Oberhausen - EG links`
- `ATBS-376 VBW - Rebhuhnweg 1 Bochum - 2.OG links`

### 1.4 Datumsformate

| Format | Anzahl | Anteil |
|--------|--------|--------|
| `YYYY-MM-DD` (ISO) | 85 | 55% |
| Kein Datum | 61 | 39% |
| `DD.MM.YYYY` (deutsch) | 9 | 6% |

**Bewertung:** ISO-Format dominiert - gut fur Sortierung.

---

## 2. Inkonsistenzen (Was korrigiert werden sollte)

### 2.1 Auftraggeber-Schreibweisen

**Problem:** Gleiche Auftraggeber werden unterschiedlich geschrieben.

| Auftraggeber | Varianten | Empfehlung |
|--------------|-----------|------------|
| GWS | `gws`, `GWS` | `GWS` (uppercase) |
| Covivio | `covivio`, `Covivio` | `Covivio` (Title Case) |
| Vonovia | `vonovia` | `Vonovia` (Title Case) |
| VBW | `VBW` | `VBW` (konsistent) |
| Privat | `privat`, `Privat` | `Privat` (Title Case) |

**Betroffene Pfade:** ~50 Dokumente

### 2.2 Auftraggeber-Ordner Nummern

**Problem:** Verschiedene Nummern-Schemata zwischen Sites.

**Site: Wohnungssanierung-Projekte:**
| Ordner | Auftraggeber |
|--------|--------------|
| `10 GWS` | GWS Wohnen |
| `12 Covivio` | Covivio |
| `15 vonovia` | Vonovia |
| `16 VBW` | VBW Bauen und Wohnen |
| `18 WBG Lunen` | WBG Lunen |
| `21 Quadrat` | Quadrat |
| `23 ISRichter` | IS Richter |
| `50 Privat` | Privatkunden |
| `51 Holger` | Testprojekte |
| `61 Abgeschlossen` | Archiv |

**Site: Wohnungssanierung-Kunden:**
| Ordner | Auftraggeber |
|--------|--------------|
| `10 Kunden` | Alle Kunden |
| `50 Privatkunden` | Privatkunden |
| `60 DOGEWO` | DOGEWO |
| `61 Spar & Bauverein` | Spar & Bauverein |

**Inkonsistenz:** `50 Privat` vs. `50 Privatkunden`

### 2.3 Projekt-Ordner ohne ATBS-Nummer

**Problem:** Altere Projekte verwenden Datumsformat statt ATBS.

**Beispiele:**
- `/61 Abgeschlossen/2023-08 Friedrich Ebert Str. 1 - 2, OG links/`
- `/61 Abgeschlossen/2024-04 gws - Seekante 13 - 3. OG rechts mitte/`
- `/10 Kunden/50 Privatkunden/2023-04-13 Fr Kempkes - Emkraft Dortmund/`
- `/10 Kunden/50 Privatkunden/2023-11-17 Flurstr. 4, Hagen - Rita Bleiker/`

**Anzahl:** ~20 Projekte ohne ATBS

### 2.4 Wohnungslage-Schreibweisen

**Problem:** Inkonsistente Schreibweisen fur Stockwerk und Position.

| Variante | Haufigkeit | Empfehlung |
|----------|------------|------------|
| `1.OG` | Haufig | Standard |
| `1. OG` | Manchmal | Zu `1.OG` |
| `1OG` | Selten | Zu `1.OG` |
| `2OG` | Selten | Zu `2.OG` |
| `EG links` | Standard | Beibehalten |
| `EG mitte` | Standard | Beibehalten |

### 2.5 Adress-Formate

**Problem:** Unterschiedliche Adress-Schreibweisen.

| Variante | Beispiel |
|----------|----------|
| Mit PLZ | `Friedrich-Ebert-Str.3,44263 Dortmund` |
| Ohne PLZ | `Friedrich-Ebert-Strasse 3 Dortmund` |
| Mit Komma | `Flurstrasse 13, Essen` |
| Ohne Komma | `Flurstrasse 13 Essen` |
| Straße | `Aldinghofer Strasse 6` |
| Str. | `Aldinghofer Str. 6` |

### 2.6 Dateien im Root-Verzeichnis

**Problem:** Einige Dateien liegen direkt im Root ohne Ordnerstruktur.

**Betroffene Dateien (OneDrive-Pfade):**
- `/Screenshot 2025-12-15 123630.png`
- `/Screenshot 2026-01-07 145623.png`
- `/PXL_20260108_181110687.MP2.jpg`
- `/Whitepaper-5-kostspieligste-Fehler-Sanierung.docx`
- `/Zielgruppen-Private-Vermieter-Eigentumer.docx`

**Empfehlung:** In `/Marketing/` oder `/Dokumente/` verschieben.

### 2.7 Sonderzeichen in Pfaden

**Problem:** URL-Encoding fuhrt zu unleserlichen Pfaden.

**Beispiele:**
- `%C3%9F` = `ss` (z.B. `Oberstrae` statt `Oberstrasse`)
- `%C3%BC` = `u` (z.B. `Dusseldorf` statt `Dusseldorf`)
- `%20` = Leerzeichen
- `UTF-8%27` = Fehlerhaftes Encoding in Dateinamen

**Betroffene Dateien:**
- `UTF-8'RE-0015242%20-%20Oberstrae%2046...`
- `UTF-8'Rechnung%205100009925.pdf`

### 2.8 Legacy Google Drive Links

**Problem:** 163 Dokumente haben noch Google Drive Links in `sharepoint_link`.

**Anzahl:** 163 von 308 Links (53%) sind Google Drive

**Empfehlung:** Diese Dokumente zu SharePoint migrieren oder `sharepoint_link` bereinigen.

---

## 3. Empfehlungen fur Standardisierung

### 3.1 Sofort umsetzen (Quick Wins)

1. **Auftraggeber-Schreibweise vereinheitlichen:**
   ```
   gws → GWS
   covivio → Covivio
   vonovia → Vonovia
   privat → Privat
   ```

2. **Root-Dateien in Ordner verschieben:**
   ```
   /Screenshot*.png → /Marketing/Screenshots/
   /Whitepaper*.docx → /Marketing/Whitepaper/
   ```

3. **UTF-8 Encoding-Fehler in Dateinamen korrigieren:**
   ```
   UTF-8'Rechnung... → Rechnung...
   ```

### 3.2 Mittelfristig umsetzen

1. **ATBS-Nummern nachtragen fur Altprojekte:**
   - `2023-08 Friedrich Ebert Str...` → `ATBS-XXX GWS - Friedrich-Ebert-Str...`
   - Mapping erstellen: Altes Format → ATBS-Nummer

2. **Ordner-Nummern vereinheitlichen:**
   ```
   Projekte-Site:      Kunden-Site:
   10 GWS              10 GWS
   12 Covivio          12 Covivio
   15 Vonovia          15 Vonovia
   16 VBW              16 VBW
   50 Privat           50 Privat (nicht "Privatkunden")
   ```

3. **Adress-Format standardisieren:**
   ```
   Standard: [Strasse] [Hausnummer], [PLZ] [Stadt]
   Beispiel: Aldinghofer Str. 6, 44263 Dortmund
   ```

### 3.3 Langfristig umsetzen

1. **Google Drive Migration abschliessen:**
   - Alle 163 Google Drive Dokumente nach SharePoint verschieben
   - `sharepoint_link` Spalte bereinigen

2. **Automatische Validierung einrichten:**
   - SharePoint-Sync soll Pfade beim Import validieren
   - Warnungen bei fehlender ATBS-Nummer
   - Automatische Korrektur von Schreibweisen

---

## 4. Projekt-Ordner Standard-Schema

### 4.1 Empfohlenes Format

```
[Site]/Freigegebene Dokumente/[AG-Nr] [AG-Name]/[ATBS-Nr] [AG] - [Adresse] - [Lage]/[DokTyp-Nr] [DokTyp]/
```

**Beispiel:**
```
Wohnungssanierung-Projekte/
  Freigegebene Dokumente/
    10 GWS/
      ATBS-430 GWS - Langobardenstr. 33, 44263 Dortmund - EG mitte/
        01 Angebot - SUB/
        02 Angebot - Kunde/
        03 Auftrag/
        04 NUA/
        05 Fotos/
        06 Rechnung - Kunde/
        07 Rechnung - SUB/
        08 Nachweise/
        09 Protokolle/
```

### 4.2 Dokumenttyp-Ordner (Standard)

| Nr | Name | Inhalt |
|----|------|--------|
| 00 | LVs | Leistungsverzeichnisse |
| 01 | Angebot - SUB | Angebote von Nachunternehmern |
| 02 | Angebot - Kunde | Angebote an Auftraggeber |
| 03 | Auftrag | Auftragsbestatigungen |
| 04 | NUA | Nachunternehmer-Auftrage |
| 05 | Fotos | Baustellen-Fotos |
| 06 | Rechnung - Kunde | Ausgangsrechnungen |
| 07 | Rechnung - SUB | Eingangsrechnungen NU |
| 08 | Nachweise | E-Check, Abdichtung, etc. |
| 09 | Protokolle | Abnahme, Bautagebuch |

---

## 5. Statistiken

### 5.1 Dokumente nach Quelle

| Quelle | Anzahl |
|--------|--------|
| SharePoint-Links | 155 |
| OneDrive-Pfade | 45 |
| Google Drive (Legacy) | 163 |
| **Gesamt in Supabase** | 1.995 |

### 5.2 SharePoint-Dokumente nach Auftraggeber

| Auftraggeber | Anzahl |
|--------------|--------|
| Covivio | 37 |
| VBW | 33 |
| GWS | 10 |
| Privat | 9 |
| Vonovia | 5 |
| Abgeschlossen | 6 |
| Andere | 55 |

### 5.3 Dokumente nach Typ

| Dokumenttyp | Anzahl |
|-------------|--------|
| Rechnung - Kunde | 83 |
| Rechnung - SUB | 22 |
| Direktlinks (_layouts) | 22 |
| Unstrukturiert | 20 |
| Auftrag | 6 |
| Andere | 2 |

---

## 6. Nachste Schritte

1. **Backup erstellen** vor Anderungen
2. **Auftraggeber-Schreibweise** per Script korrigieren
3. **ATBS-Mapping** fur Altprojekte erstellen
4. **Google Drive Migration** planen
5. **Validierungsregeln** in SharePoint-Sync implementieren

---

*Generiert aus Supabase-Analyse am 2026-02-01*
