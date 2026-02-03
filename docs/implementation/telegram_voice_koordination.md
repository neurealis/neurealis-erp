# Telegram Universal Voice - Koordination

**Status:** ✅ FERTIG
**Datum:** 2026-02-04
**Konzept:** `telegram_universal_voice_konzept.md`

---

## Anforderungen

| # | Feature | Status |
|---|---------|--------|
| 1 | Intent-Detection (GPT-basiert) | ✅ |
| 2 | One-Shot Commands (Projekt aus Text) | ✅ |
| 3 | Kontext-Awareness (Folge-Eingaben) | ✅ |
| 4 | Multi-Language Templates (vorbereitet) | ✅ |

---

## Subagenten-Tasks

### T1: DEV-INTENT (Intent-Detection)
**Dateien:**
- `supabase/functions/telegram-webhook/utils/intent_detection.ts` (NEU)

**Aufgaben:**
- [x] Interface `IntentAnalysis` definieren
- [x] GPT-Prompt für Intent-Erkennung
- [x] `analyzeIntent(text, session)` Funktion
- [x] Projekt-Extraktion aus Text
- [x] Entity-Extraction (Gewerk, Raum, Menge)

---

### T2: DEV-SESSION (Session-Erweiterung)
**Dateien:**
- `supabase/functions/telegram-webhook/utils/session.ts`
- `supabase/functions/telegram-webhook/types.ts`

**Aufgaben:**
- [x] `ExtendedSession` Interface erweitern
- [x] `letzte_aktion` Feld hinzufügen
- [x] `projekt_historie` Feld hinzufügen
- [x] `user_sprache` Feld hinzufügen
- [x] `pending_foto` Feld hinzufügen
- [x] Helper: `updateLetztAktion()`, `addProjektToHistorie()`

---

### T3: DEV-RESPONSES (Multi-Language Templates)
**Dateien:**
- `supabase/functions/telegram-webhook/utils/responses.ts` (NEU)

**Aufgaben:**
- [x] Template-Objekte mit Sprach-Keys
- [x] `t(key, lang, vars)` Helper-Funktion
- [x] Alle DE-Texte für Mangel/Nachtrag/Status
- [x] Gewerk-Emojis Mapping
- [x] Kompakte Erfolgs-Templates

---

### T4: DEV-HANDLERS (Handler-Anpassung)
**Dateien:**
- `supabase/functions/telegram-webhook/handlers/mangel.ts`
- `supabase/functions/telegram-webhook/handlers/nachtrag.ts`
- `supabase/functions/telegram-webhook/handlers/start.ts`

**Aufgaben:**
- [x] `createMangelFromIntent(intent, chatId)` - Mangel ohne Projekt-Vorauswahl
- [x] `createNachtragFromIntent(intent, chatId)` - Nachtrag ohne Projekt-Vorauswahl
- [x] `findProjektFuzzy(searchTerm)` - Verbesserte Projekt-Suche
- [x] Korrektur-Handler ("nein, im Bad") - Vorbereitet, Phase 2
- [x] Folge-Eingaben Handler ("noch einer") - Vorbereitet

**Abhängigkeit:** T1, T2, T3 müssen fertig sein

---

### T5: DEV-ROUTER (Index Integration)
**Dateien:**
- `supabase/functions/telegram-webhook/index.ts`

**Aufgaben:**
- [x] Intent-Detection VOR Modus-Routing einbauen
- [x] Bei erkanntem Intent: Direkt Action ausführen
- [x] Bei unklarem Intent: Fallback auf Button-Menü
- [x] Foto ohne Text: Kontext-basierte Zuordnung

**Abhängigkeit:** T1, T4 müssen fertig sein

---

### T6: QA-AGENT (Quality & Deploy)
**Aufgaben:**
- [x] Code-Review aller Änderungen
- [x] TypeScript-Kompilierung prüfen (via Supabase Deploy)
- [x] Edge Cases testen (kein Projekt, mehrdeutig, etc.)
- [x] Deploy: `npx supabase functions deploy telegram-webhook --no-verify-jwt`
- [x] Dokumentation aktualisieren

**Abhängigkeit:** T1-T5 müssen fertig sein

---

## Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1: DEV-INTENT | ✅ Fertig | intent_detection.ts (497 Zeilen) |
| T2: DEV-SESSION | ✅ Fertig | types.ts + session.ts erweitert |
| T3: DEV-RESPONSES | ✅ Fertig | responses.ts (462 Zeilen) |
| T4: DEV-HANDLERS | ✅ Fertig | mangel.ts, nachtrag.ts, start.ts |
| T5: DEV-ROUTER | ✅ Fertig | index.ts v90-intent-routing |
| T6: QA-AGENT | ✅ Fertig | Deploy erfolgreich |

---

## Kritische Entscheidungen

| Entscheidung | Wert |
|--------------|------|
| Bestätigung | NIE - sofort speichern |
| Sprache | DE (Multi-Language vorbereitet) |
| Fotos | Optional mit Empfehlung |
| GPT-Modell | gpt-5.2 |

---

## Implementierte Features

### Intent-Detection System
- **Datei:** `utils/intent_detection.ts`
- Intents: MANGEL_MELDEN, NACHTRAG_ERFASSEN, NACHWEIS_HOCHLADEN, PROJEKT_OEFFNEN, LISTE_MAENGEL, LISTE_NACHTRAEGE, STATUS_ABFRAGEN, FOTO_HINZUFUEGEN, KORREKTUR, ABBRECHEN, UNBEKANNT
- Mehrsprachig: DE, RU, HU, RO, PL
- Quick-Check ohne GPT fuer eindeutige Patterns
- GPT-5.2 fuer komplexere Analyse mit Session-Kontext

### One-Shot Commands
- **Mangel:** "456 Steckdose locker Bad" → erstellt direkt Mangel fuer ATBS-456
- **Nachtrag:** "Nachtrag 3 Steckdosen Kuche fuer 448" → erstellt Nachtrag mit LV-Matching
- **Projekt:** "Oeffne Bollwerkstrasse" → Fuzzy-Suche nach Name/Adresse

### Session-Erweiterung
- `letzte_aktion`: Speichert Typ, ID, Projekt fuer Kontext-Awareness
- `projekt_historie`: Letzte 5 Projekte (FIFO)
- `user_sprache`: Erkannte Eingabesprache
- `pending_foto`: Foto ohne Text zwischenspeichern

### Multi-Language Templates
- **Datei:** `utils/responses.ts`
- 40+ Templates mit Variablen-Ersetzung: `t('MANGEL_ERFASST', 'DE', { nr, raum, gewerk })`
- Gewerk-Emojis: 25 Mappings
- Inline-Keyboard Builder: `btn()`, `urlBtn()`, `createInlineKeyboard()`
- Vordefinierte Button-Sets: MANGEL_FOLLOWUP, NACHTRAG_FOLLOWUP, etc.

### Projekt-Suche
- **Datei:** `handlers/start.ts`
- `findProjektFuzzy(searchTerm)`: ATBS-Match, dann Name/Adresse Fuzzy
- Unterstuetzt: "448", "ATBS-448", "Bollwerkstrasse", "Werner Hellweg"

---

*Letzte Aktualisierung: 2026-02-04*
