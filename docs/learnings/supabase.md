# Learnings: Supabase

Letzte Aktualisierung: 2026-02-03

---

## Edge Functions

### L177: Telegram-Webhook verify_jwt MUSS false sein
**Kategorie:** Technisch
**Datum:** 2026-02-02
**Problem:** Bot reagierte nicht, Logs zeigten 401 Unauthorized
**Lösung:** Deploy mit `verify_jwt: false`
**Merkregel:** Externe Webhooks (Telegram, Stripe) → IMMER `verify_jwt: false`

---

### L179: Edge Function Spaltenreferenzen nach DB-Umbenennung prüfen
**Kategorie:** Technisch
**Datum:** 2026-02-03
**Problem:** `bauleiter_email` verwendet, aber Spalte heißt jetzt `bl_email`
**Lösung:** Nach DB-Spalten-Umbenennungen ALLE Edge Functions prüfen!
**Betroffene Stellen:** 6 Referenzen in `audio-briefing-generate`

---

### L178: Edge Function Modularisierung mit Subagenten
**Kategorie:** Workflow
**Datum:** 2026-02-02
**Kontext:** telegram-webhook war ~3.500 Zeilen
**Ansatz:** 4 parallele Subagenten:
- T1: Core (types, utils/) - Basis zuerst
- T2+T3: Handler parallel
- T4: Router + Legacy
- T5: QA + Deploy

---

### L146: verify_jwt für Cron-Jobs = false
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Problem:** Cron-basierte Functions scheitern mit 401
**Regel:**
- `verify_jwt: true` → User-aufgerufene Functions
- `verify_jwt: false` → Cron, Trigger, interne Calls

---

### L043: verify_jwt für interne Function-Calls
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** Edge Function A ruft B auf → 401 Invalid JWT
**Lösung:** `verify_jwt: false` für interne Functions

---

### L052: Performance - Daten einmal laden
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Problem:** WORKER_LIMIT wenn DB-Abfrage in Schleife
**Lösung:** DB-Abfragen VOR Schleife, dann in-memory filtern
```javascript
// RICHTIG: Einmal laden
const allData = await supabase.from('tabelle').select('*');
for (const item of items) {
  const match = allData.find(x => x.id === item.id);
}
```

---

### L115: Timeout bei Batch-GPT-Calls
**Kategorie:** Technisch
**Datum:** 2026-01-30
**Problem:** 504 Gateway Timeout nach ~150s
**Ursache:** Hard-Limit von 150 Sekunden
**Lösung:** Max 50 Positionen pro Call

---

### L154: pg_net Trigger ohne Auth bei verify_jwt=false
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Lösung:** Kein Vault-Secret nötig bei `verify_jwt: false`
```sql
PERFORM net.http_post(
  url := '...functions/v1/function-name',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := jsonb_build_object('item_id', NEW.id)
);
```

---

### L177: Redeploy für neue Secrets
**Kategorie:** Technisch
**Datum:** 2026-02-02
**Problem:** Neues Secret wird nicht erkannt
**Ursache:** Edge Functions cachen Environment Variables
**Lösung:** Nach Secret-Änderung Function redeployen

---

## Datenbank / PostgreSQL

### L033: Upsert benötigt Unique Constraint
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Fehler:** `there is no unique or exclusion constraint matching ON CONFLICT`
**Lösung:**
```sql
ALTER TABLE dokumente ADD CONSTRAINT dokumente_dokument_nr_unique UNIQUE (dokument_nr);
```

---

### L034: Default UUID für NOT NULL Spalten
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Lösung:**
```sql
ALTER TABLE dokumente ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
```

---

### L035: UNIQUE Constraint mit NULL-Werten
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** UNIQUE(a, b) erlaubt mehrere NULL-Zeilen
**Lösung:** COALESCE in Index:
```sql
CREATE UNIQUE INDEX email_details_unique_idx
  ON email_details (message_id, account_email, COALESCE(attachment_id, ''));
```

---

### L139: pg_trgm für Fuzzy-Suche
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Extension:** `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
**Index:**
```sql
CREATE INDEX idx_bezeichnung_trgm ON lv_positionen USING GIN (bezeichnung gin_trgm_ops);
```
**Threshold:** 0.3 für sinnvolle Treffer

---

### L065: Cron mit pg_cron
**Kategorie:** Technisch
**Datum:** 2026-01-29
```sql
SELECT cron.schedule(
  'job-name',
  '0 8 * * *',  -- Täglich 8:00 UTC
  $$SELECT net.http_post(...)$$
);
```
**Verwaltung:** `SELECT * FROM cron.job;`

---

## Client / PostgREST

### L042: JSONB-Filter funktionieren nicht zuverlässig
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** `.filter('column_values', 'cs', '{...}')` verursacht JSON-Parse-Fehler
**Lösung:** Alle laden + JS-Filter
```javascript
const { data } = await supabase.from('monday_bauprozess').select('*');
const match = data.find(p => extractText(p.column_values?.['text49__1']) === 'ATBS-445');
```

---

### L044: PostgREST LIKE-Pattern: %25 statt *
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Lösung:** `%` URL-encoded als `%25`
```javascript
const url = `${supabaseUrl}/rest/v1/dokumente?art_des_dokuments=like.ER-NU-S%25`;
```

---

### L150: .or() mit Spaltenvergleich funktioniert nicht
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Problem:** `col_a.gt.col_b` wird nicht unterstützt
**Lösung:** Einfache Bedingung + JS-Filter

---

### L138: FunctionsHttpError ist kein echtes Error-Objekt
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Lösung:** Robuste Fehlerbehandlung:
```typescript
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    if ('message' in err) return (err as any).message;
    if ('context' in err) return (err as any).context?.message;
  }
  return String(err);
}
```

---

## Storage

### L022: Dateinamen sanitizen
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** Upload schlägt fehl bei Umlauten/Leerzeichen
**Lösung:**
```javascript
filename
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_.-]/g, '');
```

---

### L037: Pfad-Sanitization für Message-IDs
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** `internetMessageId` enthält `<xxx@yyy.com>` - 400-Fehler
**Lösung:**
```typescript
const safeMessageId = emailMessageId.replace(/[<>@.]/g, '').substring(0, 12);
```

---

### L073: Storage-Bucket muss existieren
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Problem:** "Bucket not found" beim Upload
**Regel:** Vor Deployment Buckets prüfen

---

### L074: Unique-Constraints bei generierten IDs
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Problem:** 8 Zeichen zu wenig für Eindeutigkeit
**Lösung:** Mindestens 12-16 Zeichen verwenden

---

### L075: Error-Handling für DB-Operationen
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Problem:** Function meldete Erfolg obwohl Inserts scheiterten
**Regel:** ALLE DB-Operationen error-prüfen
```javascript
const { error } = await supabase.from('tabelle').insert(record);
if (error) {
  result.errors++;
  return;
}
result.itemsProcessed++;
```

---

## RLS / Sicherheit

### L081: RLS-Policies für anonyme User
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Problem:** Marketing-Seite war leer trotz 9 Blog-Posts
**Ursache:** RLS nur für `authenticated`, Seite nutzt `anon`
**Lösung:**
```sql
CREATE POLICY "Anon users can read blog_posts"
ON blog_posts FOR SELECT TO anon USING (true);
```

---

### L057: 4-Stufen-Sicherheitskonzept
**Kategorie:** Business
**Datum:** 2026-01-29
| Stufe | Zugriff | Beispiel |
|-------|---------|----------|
| 1 | Alle Mitarbeiter | Projekte, Marketing |
| 2 | Bauleiter + GF | Preise, Vertrieb |
| 3 | GF + Buchhaltung | Finanzen |
| 4 | Nur GF | Personal |

---

## Migrations / RPCs

### L004: Supabase MCP direkt nutzen
**Kategorie:** Workflow
**Datum:** 2026-01-26
**Lösung:** `mcp__supabase__apply_migration` für DDL, `mcp__supabase__execute_sql` für Queries

---

### L005: gen_random_uuid() statt uuid_generate_v4()
**Kategorie:** Technisch
**Datum:** 2026-01-26

---

### L140: Hierarchisches Lern-System für KI-Korrekturen
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Lösung:** 2-stufige Suche:
1. Erst im aktuellen `lv_typ`
2. Falls keine Treffer: Globaler Fallback
**Rückgabe:** `is_global_match` Flag

---

*Vollständige Learnings siehe docs/learnings.md*
