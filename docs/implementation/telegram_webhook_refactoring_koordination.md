# Telegram-Webhook Refactoring - Koordination

**Status:** ✅ FERTIG
**Gestartet:** 2026-02-02
**Ziel:** Monolithische telegram-webhook.ts in modulare Struktur aufteilen

---

## Anforderungen

| # | Feature | Status |
|---|---------|--------|
| 1 | Modularisierung in Handler-Dateien | 🔄 |
| 2 | Shared Utilities extrahieren | 🔄 |
| 3 | Types zentral definieren | 🔄 |
| 4 | Router in index.ts | 🔄 |
| 5 | Alle Features erhalten | ⏳ |
| 6 | verify_jwt: false beibehalten | ⏳ |

---

## Ziel-Struktur

```
supabase/functions/telegram-webhook/
├── index.ts              # Router/Entry (~100 Zeilen)
├── types.ts              # Shared Types & Interfaces
├── handlers/
│   ├── start.ts          # /start, Hauptmenü, Dashboard
│   ├── mangel.ts         # Mangel-Erfassung & KI-Splitting
│   ├── nachtrag.ts       # Nachtrag-Erfassung & LV-Matching
│   ├── nachweis.ts       # Nachweis-Upload (Elektrik, Sanitär, etc.)
│   ├── gewerke.ts        # Status & Gewerke-Tabelle
│   ├── termine.ts        # Termin-Änderungen (Baustart, Ende, etc.)
│   ├── aufmass.ts        # Aufmaß-Modus
│   ├── bedarfsanalyse.ts # Bedarfsanalyse-Modus
│   ├── foto.ts           # Multi-Foto-Upload & Verarbeitung
│   └── sprache.ts        # Sprach-Befehle & GPT-Parsing
├── utils/
│   ├── telegram.ts       # sendMessage, answerCallback, editMessage, etc.
│   ├── session.ts        # Session-CRUD (get, update, clear)
│   ├── auth.ts           # istBerechtigt, getRolle
│   ├── monday.ts         # pushToMonday, Monday GraphQL
│   └── openai.ts         # Whisper, GPT-Calls
└── constants.ts          # GEWERK_SPALTEN, STATUS_MAPPING, etc.
```

---

## Subagenten-Tasks

### T1: Core Infrastructure
**Dateien:** `types.ts`, `constants.ts`, `utils/telegram.ts`, `utils/session.ts`, `utils/auth.ts`
**Status:** ⏳ Wartend

**Aufgaben:**
- [ ] Types & Interfaces definieren (Session, Projekt, Mangel, etc.)
- [ ] Telegram API Helpers extrahieren
- [ ] Session Management extrahieren
- [ ] Auth-Funktionen extrahieren
- [ ] Alle Konstanten sammeln (GEWERK_SPALTEN, STATUS_MAPPING, etc.)

### T2: Handlers Part 1 (Kern-Features)
**Dateien:** `handlers/start.ts`, `handlers/mangel.ts`, `handlers/nachtrag.ts`, `handlers/nachweis.ts`
**Status:** ⏳ Wartend
**Abhängig von:** T1

**Aufgaben:**
- [ ] Start-Handler (Hauptmenü, Dashboard, Favoriten)
- [ ] Mangel-Handler (Erfassung, KI-Splitting, Foto-Zuordnung)
- [ ] Nachtrag-Handler (Erfassung, LV-Matching)
- [ ] Nachweis-Handler (Upload, Typ-Auswahl)

### T3: Handlers Part 2 (Erweiterte Features)
**Dateien:** `handlers/gewerke.ts`, `handlers/termine.ts`, `handlers/foto.ts`, `handlers/sprache.ts`
**Status:** ⏳ Wartend
**Abhängig von:** T1

**Aufgaben:**
- [ ] Gewerke-Handler (Status-Tabelle, Änderungen)
- [ ] Termine-Handler (Baustart, Ende, Kalender)
- [ ] Foto-Handler (Multi-Upload, media_group_id)
- [ ] Sprach-Handler (Befehle parsen, GPT-Fallback)

### T4: Legacy Handlers & Integration
**Dateien:** `handlers/aufmass.ts`, `handlers/bedarfsanalyse.ts`, `utils/monday.ts`, `utils/openai.ts`, `index.ts`
**Status:** ⏳ Wartend
**Abhängig von:** T1, T2, T3

**Aufgaben:**
- [ ] Aufmaß-Handler (Matterport, CSV, Excel)
- [ ] Bedarfsanalyse-Handler (OCR, Review, Export)
- [ ] Monday-Utils (GraphQL, Push)
- [ ] OpenAI-Utils (Whisper, GPT)
- [ ] Router in index.ts

### T5: QA & Deploy
**Status:** ⏳ Wartend
**Abhängig von:** T4

**Aufgaben:**
- [ ] Alle Handler importieren und testen
- [ ] Edge Function deployen mit verify_jwt: false
- [ ] /start testen
- [ ] Mangel-Flow testen
- [ ] Nachtrag-Flow testen

---

## Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| Analyse | ✅ Fertig | 60 Funktionen identifiziert |
| T1: Core Utils | ✅ Fertig | types.ts, constants.ts, utils/* (6 Dateien) |
| T2: Kern-Handler | ✅ Fertig | start, mangel, nachtrag, nachweis |
| T3: Erweitert | ✅ Fertig | gewerke, foto, bericht, abnahme |
| T4: Legacy+Router | ✅ Fertig | aufmass, bedarfsanalyse, index.ts |
| T5: QA+Deploy | ✅ Fertig | v86 deployed, Health-Check OK |

## Deploy-Statistiken (2026-02-03)

| Metrik | Wert |
|--------|------|
| Dateien deployed | 18 |
| Handler | 10 (start, mangel, nachtrag, nachweis, gewerke, foto, aufmass, bedarfsanalyse, abnahme, bericht) |
| Utils | 6 (telegram, session, auth, helpers, openai, index) |
| Core | 2 (types.ts, constants.ts) |
| Router | 1 (index.ts) |
| Version | v86-projektNr-check |
| verify_jwt | false ✅ |

---

## Wichtige Hinweise

1. **verify_jwt: false** - MUSS beibehalten werden (Telegram sendet kein JWT)
2. **Session-State** - Wird in Supabase gespeichert, nicht im Speicher
3. **Präfix-Konvention** - nu_*, bl_*, ag_* für Monday-Spalten
4. **Alle Features erhalten** - Kein Feature darf verloren gehen!

---

*Erstellt: 2026-02-02*
