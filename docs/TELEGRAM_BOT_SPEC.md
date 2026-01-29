# Telegram-Bot Spezifikation - neurealis ERP

**Stand:** 2026-01-29
**Bot:** @neurealis_bedarfsanalyse_bot
**Secret:** TELEGRAM_NEUREALIS_BOT

---

## WICHTIG: Bestehende Funktionen NICHT überschreiben!

Es gab bereits Funktionen für:
- Bedarfsanalyse
- Aufmaßerstellung

Diese müssen erhalten/wiederhergestellt werden!

---

## Tabellenstrukturen

### maengel_fertigstellung
```
projekt_nr          TEXT        -- ATBS-Nummer (z.B. "ATBS-383")
art_des_mangels     TEXT        -- "Ausführung", "Fertigstellung", etc.
beschreibung_mangel TEXT        -- Freitext-Beschreibung
status_mangel       TEXT        -- DEFAULT "(0) Offen"
datum_meldung       TIMESTAMPTZ -- Erstelldatum
datum_frist         TIMESTAMPTZ -- Meldung + 2 Tage
projektname_komplett TEXT       -- z.B. "vonovia | Adresse | OG | Name"
bauleiter           TEXT
nachunternehmer     TEXT
fotos_mangel        JSONB       -- Array von Foto-URLs
nua_nr              TEXT
mangel_nr           TEXT        -- Auto-generiert
```

### nachtraege
```
atbs_nummer         TEXT        -- ATBS-Nummer (REQUIRED)
nachtrag_nr         TEXT
status              TEXT        -- DEFAULT "(0) Offen"
titel               TEXT
beschreibung        TEXT
foto_urls           TEXT[]      -- Array von Foto-URLs
projektname_komplett TEXT
gemeldet_von        TEXT
melder_name         TEXT
bauleiter_name      TEXT
bauleiter_email     TEXT
nu_name             TEXT
nu_email            TEXT
```

### monday_bauprozess (für Projekt-Suche)
```
id                  TEXT        -- Item-ID
name                TEXT        -- Projektname mit Adresse
column_values       JSONB       -- Enthält text49__1 = ATBS-Nr
```

---

## Kernfunktionen

### 1. Projekt öffnen (PRIO 1)
- Per ATBS-Nummer: `/projekt ATBS-445` oder Sprache "Öffne Projekt ATBS 445"
- Per Adresse: `/projekt Werner Hellweg 114` oder Sprache "Öffne Werner Hellweg"
- Bei mehreren Treffern: Inline-Buttons zur Auswahl (OG, ATBS, Startdatum anzeigen)
- Session speichern: `aktuelles_bv_id`, `aktueller_modus`

### 2. Mangel erfassen (PRIO 1)
**Trigger:** `/mangel` oder Sprache "Mangel melden" oder Foto mit Text

**Flow:**
1. Prüfen ob Projekt geöffnet → wenn nicht, fragen
2. Beschreibung per Text oder Sprache empfangen
3. KI analysiert und extrahiert:
   - Einzelne Mängel (bei mehreren → mehrere DB-Einträge)
   - Art des Mangels (Ausführung/Fertigstellung)
   - Gewerk wenn möglich
4. In `maengel_fertigstellung` speichern:
   - projekt_nr = Session.aktuelles_bv_id (ATBS)
   - datum_meldung = NOW()
   - datum_frist = NOW() + 2 DAYS
   - status_mangel = "(0) Offen"
   - projektname_komplett = aus monday_bauprozess.name
5. Bestätigung mit Mangel-Nr senden

**Bei Foto + Text:**
- Text = Beschreibung des Mangels
- Foto in Supabase Storage hochladen
- URL in fotos_mangel speichern

### 3. Nachtrag erfassen
**Trigger:** `/nachtrag` oder Sprache "Nachtrag melden"

**Flow:**
1. Prüfen ob Projekt geöffnet
2. Beschreibung empfangen
3. In `nachtraege` speichern:
   - atbs_nummer = Session.aktuelles_bv_id
   - status = "(0) Offen"
   - projektname_komplett = aus monday_bauprozess

### 4. Nachweis hochladen
**Trigger:** `/nachweis` oder Foto mit Kategorie "Nachweis"

**Nachweis-Typen:**
- Rohinstallation Elektrik
- Rohinstallation Sanitär
- Abdichtung Bad
- E-Check Protokoll
- Brandschutz

### 5. Foto-Upload
**Bei Foto-Empfang:**
1. Fragen: Mangel, Nachtrag, Nachweis, Doku, Bedarfsanalyse?
2. Bei begleitendem Text: Text als Beschreibung verwenden
3. Foto in Storage hochladen
4. Je nach Kategorie in richtige Tabelle speichern

---

## Sprach-zu-Text

**Workflow:**
1. Voice-Message empfangen
2. File von Telegram downloaden
3. An OpenAI Whisper senden
4. Transkription speichern
5. Bei Nicht-Deutsch: GPT übersetzen

**Sprachen:** DE, RU, HU, RO, PL

---

## Session-Management

**telegram_sessions Felder:**
```
chat_id             BIGINT      -- Telegram Chat ID
kontakt_id          UUID        -- Verknüpfter Kontakt
aktuelles_bv_id     TEXT        -- ATBS-Nummer des offenen Projekts
aktueller_modus     TEXT        -- 'idle', 'mangel', 'nachtrag', 'foto', etc.
kontext             JSONB       -- Zwischenspeicher
sprache             TEXT        -- 'de', 'ru', 'hu', 'ro', 'pl'
```

---

## Hilfsfunktionen

### ATBS aus monday_bauprozess extrahieren
```typescript
function extractATBS(columnValues: any): string | null {
  const text49 = columnValues?.text49__1;
  if (typeof text49 === 'string') return text49;
  if (text49?.text) return text49.text;
  return null;
}
```

### Projektname aus monday_bauprozess
```typescript
function getProjectName(item: any): string {
  return item.name; // z.B. "vonovia | Adresse | OG | Name"
}
```

---

## API-Referenz

### Telegram Bot API
- `sendMessage(chat_id, text, reply_markup?)`
- `getFile(file_id)` → file_path
- `downloadFile(file_path)` → Buffer

### OpenAI Whisper
```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
});
```

---

## Sicherheit

- **Niemals Preise** über Telegram ausgeben!
- Rollen prüfen bevor sensible Daten gezeigt werden
- Nur verifizierte Kontakte dürfen Daten ändern
