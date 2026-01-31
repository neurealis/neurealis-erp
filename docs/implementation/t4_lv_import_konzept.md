# T4: LV-Import Konzept

**Erstellt:** 2026-01-30
**Status:** Entwurf - Klärungsbedarf
**Subagent:** T4

---

## Inhaltsverzeichnis

1. [Kontext und Ist-Situation](#1-kontext-und-ist-situation)
2. [Workflow aus User-Sicht](#2-workflow-aus-user-sicht)
3. [Import-Modi](#3-import-modi)
4. [Spalten-Mapping](#4-spalten-mapping)
5. [Validierung](#5-validierung)
6. [Preis-Update-Logik](#6-preis-update-logik)
7. [UI-Mockup](#7-ui-mockup)
8. [Technische Architektur](#8-technische-architektur)
9. [Klärungsfragen](#9-klärungsfragen)

---

## 1. Kontext und Ist-Situation

### Aktuelle Datenstruktur

**Tabelle `lv_positionen`:**

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primary Key |
| artikelnummer | TEXT | UNIQUE, Pflicht |
| lv_typ | TEXT | Kunde/LV-Typ (GWS, VBW, covivio, etc.) |
| bezeichnung | TEXT | Positionsbezeichnung |
| beschreibung | TEXT | Detailbeschreibung |
| einheit | TEXT | m², Stk, psch, etc. |
| preis | NUMERIC | EK-Preis (neurealis) |
| listenpreis | NUMERIC | Listenpreis Kunde |
| gewerk | TEXT | Gewerk/Kategorie |
| aktiv | BOOLEAN | Position aktiv? |
| preis_datum | DATE | Datum der Preisänderung |
| source | TEXT | 'hero', 'manual', 'import' |
| hero_product_id | TEXT | Referenz zu Hero |
| softr_record_id | TEXT | Referenz zu Softr |

### Bestehende LV-Typen

| lv_typ | Anzahl | Quelle |
|--------|--------|--------|
| covivio | 1.299 | Hero / Excel |
| GWS | 601 | Hero / Excel |
| neurealis | 412 | Hero / manuell |
| VBW | 313 | Hero / Excel |
| Privat | 281 | Hero / manuell |
| Artikel | 78 | Hero (Zander, Glaser) |
| WBG Lünen | 73 | Hero / Excel |

### Artikelnummer-Konventionen

Aus der bestehenden `hero-lv-sync`:
- **GWS:** `GWS.LV23-01.01.1`, `GWS-LV24-05.5`
- **covivio:** `covivio-xxx`, `CV24-xxx`
- **VBW:** `VBW-xxx`
- **WBG Lünen:** `WBG-xxx`
- **neurealis intern:** `Elektrik-xxx`, `Sanitär-xxx`, `Maler-xxx`

---

## 2. Workflow aus User-Sicht

### Schritt-für-Schritt

```
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 1: Datei hochladen                                    │
├─────────────────────────────────────────────────────────────────┤
│  - Drag & Drop oder "Datei auswählen"                          │
│  - Unterstützte Formate: Excel (.xlsx), CSV, PDF               │
│  - System erkennt Format automatisch                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 2: LV-Typ auswählen                                   │
├─────────────────────────────────────────────────────────────────┤
│  A) Bestehender Kunde (Dropdown):                              │
│     - GWS (601 Positionen)                                     │
│     - VBW (313 Positionen)                                     │
│     - covivio (1.299 Positionen)                               │
│     - WBG Lünen (73 Positionen)                                │
│     - ...                                                       │
│                                                                 │
│  B) Neuer Kunde anlegen:                                       │
│     - Name eingeben (z.B. "Vonovia 2026")                      │
│     - Optionales Präfix für Artikelnummern                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 3: Spalten-Mapping                                    │
├─────────────────────────────────────────────────────────────────┤
│  - System zeigt Vorschau der Datei (erste 10 Zeilen)          │
│  - User ordnet Spalten zu:                                     │
│    • Artikelnummer ← [Spalte A / automatisch]                  │
│    • Bezeichnung   ← [Spalte B]                                │
│    • Beschreibung  ← [Spalte C]                                │
│    • Einheit       ← [Spalte D]                                │
│    • Preis (EK)    ← [Spalte E]                                │
│    • Listenpreis   ← [Spalte F]                                │
│    • Gewerk        ← [Spalte G / automatisch]                  │
│                                                                 │
│  - "Intelligentes Mapping": System erkennt Spalten automatisch │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 4: Validierung & Preview                              │
├─────────────────────────────────────────────────────────────────┤
│  System prüft und zeigt:                                       │
│                                                                 │
│  ✅ 245 neue Positionen                                         │
│  🔄 18 Preis-Updates (Details anzeigen)                        │
│  ⚠️ 3 Warnungen:                                                │
│     - Zeile 45: Preis fehlt                                    │
│     - Zeile 102: Artikelnummer "123" zu kurz                   │
│     - Zeile 187: Duplikat-Artikelnummer                        │
│  ❌ 1 Fehler (blockiert Import):                                │
│     - Zeile 56: Bezeichnung leer                               │
│                                                                 │
│  [Tabelle mit allen Änderungen zum Durchscrollen]              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 5: Bestätigung & Import                               │
├─────────────────────────────────────────────────────────────────┤
│  - "Import starten" Button (nur wenn keine Fehler)             │
│  - Optional: "Warnungen ignorieren" Checkbox                   │
│  - Progress-Anzeige während Import                             │
│  - Ergebnis-Zusammenfassung nach Abschluss                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Import-Modi

### Modus A: Neues LV (Neuer Kunde)

**Anwendungsfall:** Kunde liefert erstmals ein LV

**Verhalten:**
- Alle Positionen werden als NEU eingefügt
- `lv_typ` = Kundenname
- `source` = 'import'
- `preis_datum` = Heute
- Optional: Artikelnummer-Präfix generieren

### Modus B: Preis-Update (Bestehender Kunde)

**Anwendungsfall:** Jährliches Preis-Update von GWS, VBW, etc.

**Verhalten:**
- Matching über `artikelnummer`
- Nur `preis`, `listenpreis`, `preis_datum` werden aktualisiert
- Neue Positionen werden hinzugefügt
- Gelöschte Positionen: `aktiv = false` (nicht löschen!)
- Preis-Historie wird automatisch geschrieben (via T1-Trigger)

### Modus C: Komplett-Ersetzung

**Anwendungsfall:** Kunde liefert komplett neues LV-Format

**Verhalten:**
- Alle bestehenden Positionen des lv_typ: `aktiv = false`
- Alle neuen Positionen werden eingefügt
- Alte Artikelnummern bleiben erhalten (historische Angebote)

---

## 4. Spalten-Mapping

### Automatische Erkennung

Das System erkennt Spalten anhand von Header-Namen:

| Ziel-Feld | Erkannte Header (case-insensitive) |
|-----------|-----------------------------------|
| artikelnummer | Artikelnr, Art.Nr, Art-Nr, Position, Pos, Nr, Nummer |
| bezeichnung | Bezeichnung, Name, Beschreibung, Titel, Leistung |
| beschreibung | Beschreibung, Details, Langtext, Text |
| einheit | Einheit, EH, ME, Mengeneinheit, Unit |
| preis | Preis, EK, Einkaufspreis, Netto, EP |
| listenpreis | Listenpreis, LP, VP, Verkaufspreis, GP |
| gewerk | Gewerk, Kategorie, Bereich, Gruppe, Titel |

### Fallback-Logik

1. **Artikelnummer fehlt:** Auto-Generierung aus Bezeichnung + Gewerk (wie `hero-lv-sync`)
2. **Gewerk fehlt:** Auto-Erkennung aus Bezeichnung (Keyword-Matching)
3. **Einheit fehlt:** Default "Stk"
4. **Preis fehlt:** Warnung, aber Import möglich

### Gewerk-Erkennung (aus hero-lv-sync)

```javascript
const GEWERK_KEYWORDS = {
  'Elektrik': ['elektr', 'steckdose', 'schalter', 'kabel'],
  'Sanitär': ['sanitär', 'wasser', 'abfluss', 'rohr'],
  'Maler': ['maler', 'anstrich', 'lackier', 'farbe'],
  'Fliesen': ['fliesen', 'keramik'],
  'Boden': ['boden', 'vinyl', 'parkett', 'laminat'],
  // ... weitere
};
```

---

## 5. Validierung

### Pflichtfelder

| Feld | Pflicht? | Validierung |
|------|----------|-------------|
| artikelnummer | Ja (oder auto) | Min. 3 Zeichen, Unique pro lv_typ |
| bezeichnung | Ja | Min. 5 Zeichen |
| lv_typ | Ja | Aus Dropdown oder neu |
| preis | Nein | Wenn vorhanden: >= 0 |
| listenpreis | Nein | Wenn vorhanden: >= 0 |
| einheit | Nein | Bekannte Werte oder frei |

### Validierungsregeln

```
FEHLER (blockieren Import):
- Bezeichnung leer
- Artikelnummer doppelt in der Import-Datei
- Preis negativ

WARNUNGEN (Import möglich):
- Artikelnummer kürzer als 5 Zeichen
- Preis leer (Position ohne Preis)
- Gewerk nicht erkannt (wird "Sonstiges")
- Listenpreis < Preis (ungewöhnlich)
```

### Duplikat-Handling

**Szenario:** Import-Artikelnummer existiert bereits

| Modus | Verhalten |
|-------|-----------|
| Neues LV | Fehler: "Position existiert bereits" |
| Preis-Update | Update: Nur Preise ändern |
| Komplett-Ersetzung | Update: Position überschreiben |

---

## 6. Preis-Update-Logik

### Bei Preisänderung

```sql
-- Trigger schreibt automatisch in lv_preis_historie (via T1)
INSERT INTO lv_preis_historie (
  artikelnummer,
  preis_alt,
  preis_neu,
  listenpreis_alt,
  listenpreis_neu,
  aenderung_prozent,
  gueltig_ab,
  quelle
) VALUES (
  'GWS.LV23-01.01.1',
  45.81,
  48.00,
  73.02,
  76.00,
  4.78,
  CURRENT_DATE,
  'import'
);
```

### Änderungs-Preview

Vor dem Import zeigen:

```
┌─────────────────────────────────────────────────────────────────┐
│  Preis-Updates für GWS (18 Positionen)                         │
├─────────────────────────────────────────────────────────────────┤
│  Artikelnummer      │ Preis alt │ Preis neu │ Differenz        │
│  GWS.LV23-01.01.1   │   45.81   │   48.00   │  +4.78%          │
│  GWS.LV23-01.01.5   │   13.88   │   14.50   │  +4.47%          │
│  GWS.LV23-02.03.2   │  215.57   │  225.00   │  +4.37%          │
│  ...                │           │           │                   │
├─────────────────────────────────────────────────────────────────┤
│  Durchschnittliche Preisänderung: +4.54%                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. UI-Mockup

### Screen 1: Datei-Upload

```
┌─────────────────────────────────────────────────────────────────┐
│  LV-Import                                           [X Schließen]
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │              📁  Datei hierher ziehen                     │ │
│  │                                                           │ │
│  │           oder [Datei auswählen] klicken                  │ │
│  │                                                           │ │
│  │      Unterstützt: Excel (.xlsx), CSV, PDF                │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Letzte Imports:                                               │
│  • GWS_Preise_2026.xlsx (vor 2 Wochen)                        │
│  • VBW_LV_Update.csv (vor 1 Monat)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Screen 2: LV-Typ & Modus

```
┌─────────────────────────────────────────────────────────────────┐
│  LV-Import > GWS_Preise_2026.xlsx                   [< Zurück] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Erkannte Datei: Excel, 345 Zeilen, 8 Spalten                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ LV-Typ / Kunde:                                         │   │
│  │ [▼ GWS                                               ]  │   │
│  │    ○ GWS (601 bestehende Positionen)                    │   │
│  │    ○ VBW (313 bestehende Positionen)                    │   │
│  │    ○ covivio (1.299 bestehende Positionen)              │   │
│  │    ○ WBG Lünen (73 bestehende Positionen)               │   │
│  │    ──────────────────────────────────────               │   │
│  │    + Neuen Kunden anlegen...                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Import-Modus:                                           │   │
│  │ ● Preis-Update (nur Preise ändern)                      │   │
│  │ ○ Neues LV (alle als neue Positionen)                   │   │
│  │ ○ Komplett ersetzen (altes LV deaktivieren)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                          [Weiter >]            │
└─────────────────────────────────────────────────────────────────┘
```

### Screen 3: Spalten-Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│  LV-Import > Spalten-Mapping                        [< Zurück] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ordne die Spalten deiner Datei den LV-Feldern zu:            │
│                                                                 │
│  Datei-Spalte          →    LV-Feld                            │
│  ──────────────────────────────────────────────────            │
│  [A: Art.Nr      ▼]    →    Artikelnummer ✅                   │
│  [B: Bezeichnung ▼]    →    Bezeichnung ✅                     │
│  [C: Langtext    ▼]    →    Beschreibung                       │
│  [D: EH          ▼]    →    Einheit                            │
│  [E: EK-Preis    ▼]    →    Preis (EK)                         │
│  [F: LP          ▼]    →    Listenpreis                        │
│  [G: Gewerk      ▼]    →    Gewerk                             │
│  [- ignorieren   ▼]    →    (nicht importieren)                │
│                                                                 │
│  Vorschau (erste 5 Zeilen):                                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Art.Nr          │ Bezeichnung           │ EK    │ LP   │    │
│  │ GWS.LV23-01.01 │ Demontage Gardinen... │ 45.81 │ 73.02│    │
│  │ GWS.LV23-01.02 │ Rückbau Wände MW...   │ 13.88 │ 22.12│    │
│  │ ...             │ ...                   │ ...   │ ...  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│                                          [Weiter >]            │
└─────────────────────────────────────────────────────────────────┘
```

### Screen 4: Validierung & Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  LV-Import > Prüfung                                [< Zurück] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✅ 327 Positionen unverändert                           │   │
│  │ 🔄 18 Preis-Updates                                     │   │
│  │    ↳ Durchschnitt: +4.54%                               │   │
│  │ ➕ 12 neue Positionen                                    │   │
│  │ ⚠️ 3 Warnungen                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Tab: Preis-Updates] [Tab: Neue Positionen] [Tab: Warnungen] │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Artikelnummer      │ Preis alt │ Preis neu │    %       │   │
│  │ GWS.LV23-01.01.1   │   45.81   │   48.00   │  +4.78%    │   │
│  │ GWS.LV23-01.01.5   │   13.88   │   14.50   │  +4.47%    │   │
│  │ GWS.LV23-02.03.2   │  215.57   │  225.00   │  +4.37%    │   │
│  │ ... (mehr anzeigen)│           │           │            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ☐ Warnungen ignorieren und trotzdem importieren              │
│                                                                 │
│                              [Abbrechen]  [Import starten]     │
└─────────────────────────────────────────────────────────────────┘
```

### Screen 5: Import-Ergebnis

```
┌─────────────────────────────────────────────────────────────────┐
│  LV-Import > Abgeschlossen                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│             ✅ Import erfolgreich!                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Zusammenfassung:                                        │   │
│  │                                                         │   │
│  │ • 18 Preise aktualisiert                               │   │
│  │ • 12 neue Positionen hinzugefügt                       │   │
│  │ • Preis-Historie geschrieben                           │   │
│  │                                                         │   │
│  │ Dauer: 3.2 Sekunden                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Import-Log herunterladen]    [Neuer Import]    [Schließen]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Technische Architektur

### Komponenten

```
┌────────────────────┐     ┌────────────────────┐
│   SvelteKit UI     │     │   Edge Functions   │
│   /lv/import       │────▶│   lv-import-parse  │
│                    │     │   lv-import-exec   │
└────────────────────┘     └────────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │     Supabase       │
                           │   lv_positionen    │
                           │  lv_preis_historie │
                           └────────────────────┘
```

### Edge Functions

**1. `lv-import-parse`**
- Input: Datei (Base64 oder URL)
- Output: Geparste Daten + Validierungsergebnis
- Bibliotheken: `xlsx` für Excel, `csv-parse` für CSV, `unpdf` für PDF-OCR

**2. `lv-import-execute`**
- Input: Validierte Daten + Import-Modus
- Output: Import-Ergebnis
- Batch-Insert/Update mit Transaktion

### PDF-Handling

Für PDF-LVs (oft gescannt):
1. PDF mit `unpdf` laden
2. Text extrahieren (Native oder OCR)
3. Tabellenstruktur erkennen (Regex-basiert)
4. Falls strukturiert: Direkt parsen
5. Falls unstrukturiert: KI-Extraktion (gpt-5.2)

---

## 9. Klärungsfragen

### Frage 1: Artikelnummer-Generierung

**Kontext:** Manche Kunden-LVs haben keine eindeutigen Artikelnummern (nur Zeilennummern wie "1", "2", "3" oder "1.1.1", "1.1.2").

**Optionen:**
- A) Präfix aus Kundenname + laufende Nummer (z.B. `GWS-001`, `GWS-002`)
- B) Automatisch aus Gewerk + Bezeichnung generieren (wie hero-lv-sync)
- C) User muss Spalte mit eindeutiger ID auswählen

**Frage:** Wie sollen Artikelnummern generiert werden, wenn das Kunden-LV keine mitliefert?

---

### Frage 2: Preis-Spalten

**Kontext:** Die Tabelle hat zwei Preis-Spalten: `preis` (EK) und `listenpreis` (Kundenpreis).

**Frage:** Liefern alle Kunden beide Preise? Oder nur den Listenpreis? Wie ist das Verhältnis typischerweise (z.B. immer 40% Marge)?

---

### Frage 3: Gelöschte Positionen

**Kontext:** Was passiert, wenn ein Preis-Update weniger Positionen hat als vorher?

**Optionen:**
- A) Alte Positionen auf `aktiv = false` setzen
- B) Alte Positionen komplett löschen
- C) Nur warnen, nichts ändern

**Frage:** Sollen Positionen, die im neuen LV fehlen, deaktiviert oder beibehalten werden?

---

### Frage 4: PDF-Qualität

**Kontext:** PDFs von Kunden können sein:
- Native PDFs (Text direkt extrahierbar)
- Gescannte PDFs (OCR nötig)
- Schlecht formatierte PDFs (Tabellen nicht erkennbar)

**Frage:** Wie häufig kommen PDF-LVs vor? Lohnt sich die OCR-Integration oder reicht "nur Excel/CSV"?

---

### Frage 5: Synchronisation zu anderen Systemen

**Kontext:** Aktuell gibt es Syncs zu:
- Hero Software (lv-hero-push)
- Softr.io (lv-softr-push, geplant)

**Frage:** Sollen importierte LV-Positionen automatisch zu Hero/Softr gepusht werden, oder nur manuell auf Anfrage?

---

## Nächste Schritte (nach Klärung)

1. **UI implementieren** - SvelteKit Seite `/lv/import`
2. **Edge Function `lv-import-parse`** - Datei-Parsing
3. **Edge Function `lv-import-execute`** - Daten-Import
4. **Integration mit T1** - Preis-Historie-Trigger prüfen
5. **Testen** mit echten Kunden-LVs

---

*Konzept erstellt: 2026-01-30*
*Autor: T4 Subagent*
