# Telegram-Bot Phase 3+4 - Nacht-Implementierungsplan

**Erstellt:** 2026-01-31
**Für:** Autonome Nacht-Implementierung ohne Rückfragen
**Geschätzter Aufwand:** ~12h

---

## PREFLIGHT für Nacht-Agent

```
PFLICHT VOR START:
1. /pre ausführen
2. Diese Datei komplett lesen
3. docs/TELEGRAM_BOT_ERWEITERUNG_KONZEPT.md lesen
4. Aktuellen Bot-Code prüfen: functions/supabase/functions/telegram-webhook/index.ts
5. ZUERST v54 deployen (siehe unten) - das ist noch ausstehend!
```

---

## ⚠️ WICHTIG: Erst v54 deployen!

Die heutigen Änderungen (v54) sind noch NICHT deployed:
- Phasen-Filter
- Gewerk-Status-Tabelle
- Ausführungsarten
- Brandschutz-Nachweis
- Multi-Foto-Upload
- Abnahmeprotokolle

**ERSTE AKTION:** Deploy telegram-webhook v54 bevor du Phase 3+4 implementierst!

---

## Entscheidungen (bereits geklärt)

| Thema | Entscheidung |
|-------|--------------|
| **Termine änderbar** | Alle 4: BV Start, BV Ende NU Plan, BV Ende Mängelfrei, BV Ende Kunde |
| **Monday-Sync** | Sofort bei jeder Änderung in `monday_bauprozess` |
| **Berechtigung** | NUR Dirk Jansen + Holger Neumann dürfen ändern |
| **Sprach-Befehle** | Alle: Status, Termine, Nachtrag, Mangel |
| **Sprache** | Nur Deutsch für Sprach-Befehle |
| **Parsing** | Tolerant + Bestätigung (GPT interpretiert, User bestätigt) |
| **Status-Werte** | Vereinfacht UND exakt möglich |
| **LV-Matching** | Voll automatisch (ohne Bestätigung) |
| **Bestätigung** | Inline-Buttons [✅ Ausführen] [❌ Abbrechen] |
| **Fehler-Handling** | Hilfe anbieten mit Beispiel-Befehlen |
| **Logging** | Alle Befehle in DB protokollieren |

---

## Berechtigte Personen

| Name | E-Mail | Telegram | Rolle |
|------|--------|----------|-------|
| **Holger Neumann** | holger.neumann@neurealis.de | - | GF |
| **Dirk Jansen** | dirk.jansen@neurealis.de | +49 1515 632 1931 | BL |

**Prüfung:** Über `kontakte.email` oder `kontakte.telegram_chat_id` verifizieren.

---

## Phase 3: Termine anpassen (~4.5h)

### 3.1 Flexible Datum-Parser (1.5h)

**Funktion:** `parseDatum(text: string): Date | null`

**Unterstützte Formate:**
```typescript
const DATUM_PATTERNS = {
  // Explizit
  explizit: /(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/,  // 17.03. oder 17.03.2026

  // Relativ
  relativ: {
    'heute': () => new Date(),
    'morgen': () => addDays(new Date(), 1),
    'übermorgen': () => addDays(new Date(), 2),
    'in (\\d+) tagen?': (match) => addDays(new Date(), parseInt(match[1])),
    'nächste?n? (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)': (match) => getNextWeekday(match[1]),
    'ende der woche': () => getEndOfWeek(),
    'ende des monats': () => getEndOfMonth(),
  }
};
```

**Helper-Funktionen:**
```typescript
function addDays(date: Date, days: number): Date
function getNextWeekday(weekday: string): Date
function getEndOfWeek(): Date
function getEndOfMonth(): Date
function formatDatum(date: Date): string  // → "17.03.2026"
```

### 3.2 Termine-Menü (2h)

**Neuer Callback:** `bau:termine:{projektId}`

**Anzeige:**
```
📅 Termine anpassen ATBS-456

Aktuelle Termine:
• BV Start: 15.01.2026
• BV Ende NU Plan: 28.02.2026
• BV Ende Mängelfrei: -
• BV Ende Kunde: 15.03.2026

[BV Start ändern        ]
[BV Ende NU Plan ändern ]
[BV Ende Mängelfrei     ]
[BV Ende Kunde ändern   ]
[⬅️ Zurück              ]
```

**Callbacks:**
- `termin:start:{projektId}` → BV Start
- `termin:plan:{projektId}` → BV Ende NU Plan
- `termin:maengelfrei:{projektId}` → BV Ende Mängelfrei
- `termin:kunde:{projektId}` → BV Ende Kunde

**Flow nach Auswahl:**
1. Bot fragt: "Neues Datum eingeben (z.B. '17.03.', 'in 2 Tagen', 'heute'):"
2. User antwortet mit Text
3. Bot parsed Datum
4. Bot zeigt Vorschau: "BV Ende NU Plan: 28.02.2026 → 17.03.2026"
5. [✅ Speichern] [❌ Abbrechen]

**Speichern:**
```typescript
// 1. In Supabase speichern
await supabase.from('monday_bauprozess')
  .update({ [terminSpalte]: neuesDatum })
  .eq('id', projektId);

// 2. Sofort nach Monday pushen (existierende monday-push Logik nutzen)
await pushToMonday(projektId, { [mondaySpaltenId]: neuesDatum });
```

### 3.3 Spracheingabe für Termine (1h)

**Integration in Sprach-Befehl-System (Phase 4)**

Beispiel-Befehle:
- "ATBS 450 BV Ende Plan auf 17.03."
- "ATBS-456 verschiebe Ende auf in 2 Tagen"
- "ATBS 450 setze Mängelfrei auf heute"

---

## Phase 4: Sprach-Befehle (~7.5h)

### 4.1 Berechtigungs-Prüfung (1h)

**Funktion:** `istBerechtigt(chatId: number): Promise<boolean>`

```typescript
async function istBerechtigt(chatId: number): Promise<boolean> {
  const { data: kontakt } = await supabase
    .from('kontakte')
    .select('email, telegram_chat_id')
    .or(`telegram_chat_id.eq.${chatId},email.eq.holger.neumann@neurealis.de,email.eq.dirk.jansen@neurealis.de`)
    .single();

  if (!kontakt) return false;

  const berechtigteEmails = [
    'holger.neumann@neurealis.de',
    'dirk.jansen@neurealis.de'
  ];

  return berechtigteEmails.includes(kontakt.email?.toLowerCase());
}
```

**Bei Nicht-Berechtigung:**
```
⚠️ Keine Berechtigung

Diese Aktion ist nur für Bauleiter verfügbar.
Aktuell berechtigt: Holger Neumann, Dirk Jansen

Wende dich an deinen Bauleiter.
```

### 4.2 Sprach-Befehl-Parser (2h)

**Funktion:** `parseSprachBefehl(text: string): SprachBefehl | null`

```typescript
interface SprachBefehl {
  typ: 'status' | 'termin' | 'nachtrag' | 'mangel';
  atbs?: string;          // z.B. "ATBS-456"
  gewerk?: string;        // z.B. "Elektrik"
  status?: string;        // z.B. "Fertig"
  terminTyp?: string;     // z.B. "plan", "maengelfrei"
  datum?: Date;
  beschreibung?: string;  // Für Nachtrag/Mangel
  raw: string;            // Original-Text
}
```

**Pattern-Matching:**
```typescript
const SPRACH_PATTERNS = {
  // Status ändern
  status: [
    /(?:atbs[- ]?)?(\d+)\s+(?:setze?\s+)?status\s+(\w+)\s+(?:auf|=|:)\s*(.+)/i,
    /(?:atbs[- ]?)?(\d+)\s+(\w+)\s+(?:ist|auf|=)\s*(fertig|läuft|geplant|verspätet)/i,
  ],

  // Termin ändern
  termin: [
    /(?:atbs[- ]?)?(\d+)\s+(?:bv\s*)?ende\s*(?:nu\s*)?(plan|mängelfrei|kunde)?\s*(?:auf|:)?\s*(.+)/i,
    /(?:atbs[- ]?)?(\d+)\s+(?:verschiebe?|ändere?|setze?)\s+(?:bv\s*)?(?:ende\s*)?(plan|mängelfrei|kunde|start)?\s*(?:auf|um)?\s*(.+)/i,
  ],

  // Nachtrag erstellen
  nachtrag: [
    /(?:atbs[- ]?)?(\d+)\s+(?:erstelle?\s+)?(?:neuen?\s+)?nachtrag[:\s]+(.+)/i,
    /nachtrag\s+(?:für\s+)?(?:atbs[- ]?)?(\d+)[:\s]+(.+)/i,
  ],

  // Mangel melden
  mangel: [
    /(?:atbs[- ]?)?(\d+)\s+(?:melde?\s+)?(?:neuen?\s+)?mangel[:\s]+(.+)/i,
    /mangel\s+(?:bei\s+)?(?:atbs[- ]?)?(\d+)[:\s]+(.+)/i,
  ],
};
```

**GPT-Fallback für komplexe Befehle:**
```typescript
async function parseWithGPT(text: string): Promise<SprachBefehl | null> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [{
      role: 'system',
      content: `Du bist ein Parser für Baustellen-Befehle. Extrahiere:
- typ: status | termin | nachtrag | mangel
- atbs: ATBS-Nummer (z.B. "456")
- gewerk: Falls Status-Änderung (Elektrik, Sanitär, etc.)
- status: Zielstatus (Fertig, Läuft, Geplant, Verspätet)
- terminTyp: start | plan | maengelfrei | kunde
- datum: Falls Termin (ISO-Format)
- beschreibung: Falls Nachtrag/Mangel

Antworte NUR mit JSON.`
    }, {
      role: 'user',
      content: text
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 500
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 4.3 Status per Sprache ändern (2h)

**Flow:**
1. User sendet Sprach-Befehl (Text oder Voice→Whisper)
2. Parser extrahiert Befehl
3. Berechtigung prüfen
4. Vorschau anzeigen:
```
🎤 Verstanden:

Projekt: ATBS-456
Aktion: Status ändern

Elektrik: Läuft → Fertig

[✅ Ausführen] [❌ Abbrechen]
```
5. Bei Bestätigung:
   - Supabase updaten
   - Monday pushen
   - Erfolgs-Meldung

**Status-Mapping (vereinfacht → Monday):**
```typescript
const STATUS_MAPPING: Record<string, Record<string, string>> = {
  elektrik: {
    'fertig': 'Fertig (Feininstallation)',
    'läuft': 'In Arbeit (Schlitze & Rohinstallation)',
    'geplant': 'Geplant',
  },
  sanitär: {
    'fertig': 'Fertig (Feininstallation)',
    'läuft': 'In Arbeit (Rohinstallation)',
    'geplant': 'Geplant',
  },
  // ... weitere Gewerke
};
```

### 4.4 Nachtrag per Sprache (2.5h)

**Flow:**
1. User: "ATBS 450 erstelle Nachtrag: 2 Heizkörper tauschen mit Thermostatventil"
2. Parser extrahiert ATBS + Beschreibung
3. GPT analysiert Beschreibung → LV-Positionen
4. Automatisch Nachtrag erstellen:
```typescript
// LV-Matching (bestehende search_lv_positions RPC nutzen)
const positionen = await supabase.rpc('search_lv_positions', {
  query_embedding: embedding,
  match_count: 5,
  filter_lv_typ: lvTyp  // Aus Projekt-Auftraggeber ableiten
});

// Nachtrag erstellen
const { data: nachtrag } = await supabase.from('nachtraege').insert({
  projekt_nr: atbsNummer,
  beschreibung: beschreibung,
  positionen: positionen,
  summe_netto: berechneSumme(positionen),
  status: '(0) Offen / Preis eingeben',
  gemeldet_von: 'telegram',
  erstellt_am: new Date().toISOString()
}).select().single();
```

5. Erfolgs-Meldung:
```
✅ Nachtrag erstellt

NT-ATBS-450-003
2 Heizkörper tauschen mit Thermostatventil

Gefundene Positionen:
• GWS.LV23-06.01.01 - Heizkörper (2 Stk, 890,00 €)
• GWS.LV23-06.01.05 - Thermostatventil (2 Stk, 89,00 €)

Summe: 979,00 € netto
```

### 4.5 Monday-Sync für Änderungen (2h)

**Nutze bestehende `monday-push` Edge Function** oder integriere direkt:

```typescript
async function pushToMonday(projektId: string, changes: Record<string, any>) {
  const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY');

  // Projekt-Item-ID aus monday_bauprozess holen
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('monday_item_id')
    .eq('id', projektId)
    .single();

  if (!projekt?.monday_item_id) return;

  // Monday GraphQL Mutation
  const mutation = `
    mutation ($itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: ${MONDAY_BOARD_ID},
        item_id: $itemId,
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        itemId: projekt.monday_item_id,
        columnValues: JSON.stringify(changes)
      }
    })
  });
}
```

**Spalten-IDs für Monday:**
```typescript
const MONDAY_SPALTEN = {
  // Termine
  bvStart: 'date_bvstart',      // oder konkreter Spalten-ID aus Monday
  bvEndePlan: '25nEy',
  bvEndeMaengelfrei: '7hwYG',
  bvEndeKunde: '8pRus',

  // Gewerk-Status
  entkernung: 'gg2On',
  maurer: '67n4J',
  elektrik: '06reu',
  sanitaer: 'GnADf',
  heizung: 'aJKmD',
  tischler: 'tSYWD',
  waendeDecken: 'Fl8Za',
  boden: 'qAUvS',
  endreinigung: 'Nygjn',
};
```

---

## Logging-Tabelle

**Neue Tabelle:** `telegram_befehle_log`

```sql
CREATE TABLE telegram_befehle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  user_email TEXT,
  befehl_typ TEXT NOT NULL,  -- 'status', 'termin', 'nachtrag', 'mangel'
  raw_text TEXT NOT NULL,
  parsed_befehl JSONB,
  projekt_nr TEXT,
  erfolgreich BOOLEAN DEFAULT false,
  fehler_meldung TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Abfragen
CREATE INDEX idx_telegram_befehle_chat_id ON telegram_befehle_log(chat_id);
CREATE INDEX idx_telegram_befehle_projekt ON telegram_befehle_log(projekt_nr);
```

---

## Hilfe-Text bei Fehler

```
❓ Befehl nicht verstanden

Beispiele für Sprach-Befehle:

📊 Status ändern:
   "ATBS 450 setze Status Elektrik auf Fertig"
   "ATBS-456 Sanitär ist fertig"

📅 Termin ändern:
   "ATBS 450 BV Ende Plan auf 17.03."
   "ATBS-456 verschiebe Ende um 2 Tage"

📋 Nachtrag erstellen:
   "ATBS 450 erstelle Nachtrag: 2 Heizkörper tauschen"

🔧 Mangel melden:
   "ATBS 456 melde Mangel: Riss in Badezimmerfliese"

Tipp: Immer mit ATBS-Nummer beginnen!
```

---

## Implementierungs-Reihenfolge

| # | Task | Dateien | Aufwand |
|---|------|---------|---------|
| 1 | DB: `telegram_befehle_log` Tabelle | Migration via MCP | 15min |
| 2 | Helper: `parseDatum()` | index.ts | 1h |
| 3 | Helper: `istBerechtigt()` | index.ts | 30min |
| 4 | Termine-Menü + Callbacks | index.ts | 2h |
| 5 | Sprach-Parser + GPT-Fallback | index.ts | 2h |
| 6 | Status per Sprache | index.ts | 1.5h |
| 7 | Nachtrag per Sprache | index.ts | 2h |
| 8 | Monday-Sync Integration | index.ts | 1.5h |
| 9 | Logging + Fehler-Handling | index.ts | 1h |
| 10 | QA: Alle Flows testen | - | 1h |

**Gesamt:** ~12.5h

---

## Wichtige Hinweise für Nacht-Agent

1. **Bestehende Features NICHT ändern** - nur ergänzen!
2. **Deutsche Umlaute** überall verwenden (ä, ö, ü)
3. **GPT-5.2** verwenden (mit Punkt, nicht Bindestrich)
4. **monday_bauprozess** ist die Haupt-Tabelle für Projekt-Daten
5. **Berechtigung** immer prüfen vor Änderungen
6. **Inline-Buttons** für Bestätigungen
7. **Logging** für jeden Befehl
8. **Monday-Sync** sofort nach jeder Änderung

---

## Test-Szenarien

Nach Implementierung diese Szenarien testen:

1. **Termin ändern (berechtigt):**
   - Als Holger: "ATBS 456 BV Ende Plan auf 17.03."
   - Erwartung: Vorschau → Bestätigung → Update → Monday-Sync

2. **Termin ändern (nicht berechtigt):**
   - Als NU: Termin ändern versuchen
   - Erwartung: Fehlermeldung "Keine Berechtigung"

3. **Status ändern:**
   - "ATBS 450 setze Status Elektrik auf Fertig"
   - Erwartung: Vorschau → Bestätigung → Update → Monday-Sync

4. **Nachtrag per Sprache:**
   - "ATBS 450 erstelle Nachtrag: 2 Heizkörper tauschen"
   - Erwartung: Nachtrag erstellt mit LV-Positionen

5. **Fehlerfall:**
   - "Bla bla bla"
   - Erwartung: Hilfe-Text mit Beispielen

---

## Deployment

Nach Abschluss:
```bash
# Edge Function deployen
supabase functions deploy telegram-webhook --project-ref mfpuijttdgkllnvhvjlu

# Oder via MCP
mcp__supabase__deploy_edge_function(...)
```

---

*Plan erstellt: 2026-01-31*
*Für autonome Nacht-Implementierung*
