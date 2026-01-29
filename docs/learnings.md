# Learnings - neurealis ERP

**Stand:** 2026-01-28

---

## UX/Design

### L001 - Softr Tab-Überladung vermeiden
**Datum:** 2026-01-27
**Problem:** Das interne Softr-Portal hat 20+ Tabs pro Bauvorhaben → kognitive Überlastung
**Lösung:** Progressive Disclosure, Accordion-Pattern, nur relevante Infos je nach Phase zeigen

### L002 - Horizontales Scrollen ist Gift
**Datum:** 2026-01-27
**Problem:** Tabellen mit 15+ Spalten sind auf Mobile unbrauchbar
**Lösung:** Spalten-Konfigurator, wichtige Spalten fixieren, Card-Layout für Mobile

### L003 - Redundanz eliminieren
**Datum:** 2026-01-27
**Problem:** Gleiche Infos in mehreren Tabs führen zu Inkonsistenzen
**Lösung:** Single Source of Truth, nur an einer Stelle editierbar

---

## Technisch

### L004 - Supabase MCP direkt nutzen
**Datum:** 2026-01-26
**Problem:** Manuelle SQL-Migrations sind fehleranfällig
**Lösung:** `mcp__supabase__apply_migration` für DDL, `mcp__supabase__execute_sql` für Queries

### L005 - gpt-5.2 nicht gpt-5.2-mini
**Datum:** 2026-01-26
**Problem:** GPT-5.2-mini hat schlechtere Ergebnisse beim Parsen
**Lösung:** Immer gpt-5.2 (Hauptmodell) verwenden

### L006 - Umlaute korrekt verwenden
**Datum:** 2026-01-26
**Problem:** ae/oe/ue sieht unprofessionell aus
**Lösung:** UTF-8 überall, deutsche Umlaute (ä, ö, ü, ß) verwenden

---

## Workflow

### L007 - Edge Functions in functions/supabase/functions/
**Datum:** 2026-01-26
**Problem:** Verschiedene Pfade für Functions
**Lösung:** Alle Edge Functions unter `functions/supabase/functions/`

### L008 - Parallele Subagenten für schnelle UI-Entwicklung
**Datum:** 2026-01-27
**Problem:** Sequentielle Seitenentwicklung ist langsam
**Lösung:** Task-Tool mit mehreren parallelen Subagenten (bis zu 6 gleichzeitig)
**Ergebnis:** 11 Seiten in ~30 Minuten statt mehreren Stunden

### L009 - Svelte 5 Snippet-Namen ohne Bindestriche
**Datum:** 2026-01-27
**Problem:** `{#snippet user-info()}` verursacht Syntax-Fehler
**Lösung:** Keine Bindestriche in Snippet-Namen, oder Props statt Snippets verwenden

### L010 - Windows-Pfade in Bash problematisch
**Datum:** 2026-01-27
**Problem:** `cd C:\Users\...` funktioniert nicht in Bash-Umgebung
**Lösung:** Dev-Server manuell in PowerShell starten: `cd ui && npm run dev`

---

## Hero API

### L011 - Hero invoice_style für Teil/Schlussrechnungen
**Datum:** 2026-01-27
**Problem:** Bisherige Fallback-Logik (Projekt-Phase, höchste RE-Nr) war unzuverlässig
**Lösung:** `metadata.invoice_style` direkt aus Hero API nutzen:
- `full` → AR-S (Schlussrechnung)
- `parted`/`cumulative`/`downpayment` → AR-A (Abschlag)
- `null` → Ignorieren (Entwurf)
**Doku:** `docs/HERO_RECHNUNGSSYNC_API.md`

### L012 - Hero Schlussrechnung = Restbetrag
**Datum:** 2026-01-27
**Problem:** Annahme dass Schlussrechnung Gesamtbetrag enthält
**Wahrheit:** Bei vorherigen Teilrechnungen enthält die Schlussrechnung nur den **Differenzbetrag**
**Beispiel:** Projekt mit 2 Teilrechnungen (4.500€ + 5.000€) hat Schlussrechnung von nur 8.900€ (Rest)

---

## Business / Wohnungssanierung

### L013 - Leerstandskosten als Verhandlungsargument
**Datum:** 2026-01-27
**Kontext:** VBW-Preisverhandlung LV 2026
**Erkenntnis:** Leerstandskosten sind ein starkes Argument für Prozessoptimierung
**Formel:** `Wohnungen/Jahr × Verzögerungswochen × Ø-Fläche × €/m²/Monat ÷ 4`
**Beispiel VBW:** 280 WE × 3 Wochen × 60m² × 8,50€ ÷ 4 = **357.000€/Jahr**

### L014 - Ausreißer-Analyse für LV-Verhandlungen
**Datum:** 2026-01-27
**Kontext:** VBW LV 2026 vs. GWS-Marktpreise
**Methode:**
1. Altes LV (2023) gegen neues LV (2026) vergleichen
2. Referenz-BVs als Praxistest (verschiedene Größen)
3. Markt-LV (z.B. GWS) als externe Benchmark
4. Ausreißer sortiert nach Abweichung präsentieren
**Kritische Schwellen:** >25% Abweichung = Gesprächsbedarf

### L015 - Materialvorschläge dokumentieren
**Datum:** 2026-01-27
**Erkenntnis:** Bei LV-Verhandlungen immer konkrete Alternativen nennen
**Wichtige Kriterien:**
- Verfügbarkeit (Lieferzeiten)
- EK-Preis
- Qualität (z.B. DK02 nicht rutschhemmend → Kermos)
- Markenakzeptanz beim Auftraggeber

### L016 - Prozessoptimierung bei Wohnungssanierung
**Datum:** 2026-01-27
**Problem:** 3 Wochen Verzögerung zwischen Auszug und Baustart
**Ursache:** BL-Zuweisung erst nach Auszug, dann erst Begehung/Budget
**Lösung:**
- BL direkt bei Kündigung zuweisen (nach Straßen/Regionen)
- Erstbegehung 1-2 Wochen nach Kündigung (bewohnte Wohnung)
- Budget-Freigabe vor Auszug
- Direkter Baustart nach Auszug
**Risiko:** Mängel bei Begehung nicht sichtbar → Nachträge einplanen

### L017 - VBW Zahlungsziel-Argumentation
**Datum:** 2026-01-27
**Ziel:** 14 Tage netto beibehalten (statt 30 netto / 14-3%)
**Argumente:**
- NUs sind kleine Betriebe, brauchen schnelle Zahlung
- Gute NUs durch pünktliche Zahlung halten
- Vorleistung bei Material (Lagerware) ermöglicht bessere EK-Konditionen
- Funktionierendes System nicht ändern
**Red Line:** Maximal 21 Tage netto ohne Skonto

### L018 - VBW LV 2026 - Kritische Positionen
**Datum:** 2026-01-27
**Top-Ausreißer (Unterdeckung):**
| Pos. | Position | Abweichung | Mindestpreis |
|------|----------|------------|--------------|
| 3.3 | Küchenstränge | -72% | 800€ |
| 1.5 | Elektroschlitze | -54% | - |
| 2.1 | E-Anlage | -44% | 3.800€ |
| 6.3 | Vinyl-Boden | -40% | 28€/m² |
| 7.2 | WE-Tür | -25% | 1.260€ |

### L019 - VBW Material-Freigaben
**Datum:** 2026-01-27
**Genehmigte Alternativen:**
| Position | Aktuell | Vorschlag | Vorteil |
|----------|---------|-----------|---------|
| Schalter | Gira E2 | Gira Standard 55 | Günstiger, gleiche Qualität |
| Badlüfter | Ritzer Limodor | Maico ECA 100 ipro K | Nachlauf, Verfügbarkeit |
| Sanitär | diverse | Vigour One | Preis-Leistung |
| Fliesen | DK02 | Kermos 8mm | Rutschhemmend! |
| Sockelleisten | Holz | KSO Kunststoff | Günstiger |
| Innentüren | Jeld-Wen | Prüm Röhrenspahn | Kostenoptimiert |
| WE-Tür | Jeld-Wen | Prüm KK2 RC2 | - |
| Beschläge | Griffwerk | Becher/Hoppe Amsterdam | Preis |

---

## Deployment

### L020 - Svelte 5 @const Placement
**Datum:** 2026-01-28
**Problem:** `{@const}` direkt in `<div>` verursacht Build-Fehler
**Lösung:** `{@const}` muss innerhalb von `{#if}`, `{#each}`, `{:else}`, etc. sein
**Beispiel:**
```svelte
<!-- FALSCH -->
<div>
  {@const wert = berechnung()}
  {wert}
</div>

<!-- RICHTIG -->
{#if true}
  {@const wert = berechnung()}
  <div>{wert}</div>
{/if}
```

### L021 - Netlify adapter-netlify: Edge Functions bevorzugen
**Datum:** 2026-01-28
**Problem:** 404 nach Deploy trotz korrekter Functions
**Ursache:** Regular Functions (`edge: false`) funktionierten nicht zuverlässig
**Lösung:** `edge: true` in svelte.config.js verwenden
```javascript
adapter: adapter({
  edge: true,  // <- wichtig!
  split: false
})
```
**Vorteil:** Edge Functions sind schneller und zuverlässiger

---

## Supabase Storage

### L022 - Dateinamen für Storage sanitizen
**Datum:** 2026-01-28
**Problem:** Upload schlägt fehl mit "Invalid key" bei Umlauten/Leerzeichen
**Lösung:** Dateinamen vor Upload bereinigen:
```javascript
filename
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_.-]/g, '');
```

### L023 - Edge Functions für Batch-Prozesse
**Datum:** 2026-01-28
**Problem:** Lokale Scripts brauchen Service Role Key, der abläuft
**Lösung:** Edge Functions nutzen - haben automatisch Zugriff auf `SUPABASE_SERVICE_ROLE_KEY`
**Vorteil:** Keine lokalen Credentials, als Cron-Job nutzbar

---

## Claude Code / Subagenten

### L024 - Subagenten vs. Batch-Scripts
**Datum:** 2026-01-28
**Problem:** Subagenten für Datei-Operationen sind ineffizient (1 Tool-Call pro Datei)
**Lösung:** Bei Batch-Operationen (z.B. 600+ PDFs):
1. Ein Script/Edge Function schreiben
2. Parallel processing im Script (nicht parallel Subagenten)
**Beispiel:** 642 PDFs in 80s statt geschätzt 30+ Minuten mit Subagenten

---

### L025 - Unified Documents Table für RAG
**Datum:** 2026-01-28
**Problem:** Zwei separate Dokumenten-Tabellen (softr_dokumente, dokumente) erschweren RAG-Integration
**Lösung:** Eine `dokumente` Tabelle mit allen Feldern:
- `is_native_pdf` - Klassifizierung für OCR-Entscheidung
- `raw_text` - Extrahierter Text
- `summary` - KI-generierte Zusammenfassung
- `embedding` - vector(1536) für Similarity-Search
**Ergebnis:** Single Source of Truth für alle Dokumente

### L026 - OpenAI Batch API für Kostenersparnis
**Datum:** 2026-01-28
**Problem:** Einzelne API-Calls für 1.800+ Dokumente sind teuer
**Lösung:** OpenAI Batch API nutzen (50% günstiger)
- JSONL-Format für Batch-Requests
- Asynchrone Verarbeitung (bis 24h)
- Ergebnisse als JSONL abrufbar
**Implementierung:** Edge Function `document-batch` mit modes: create, status, process

### L027 - S3 Signed URLs verfallen
**Datum:** 2026-01-28
**Problem:** Softr S3-URLs haben `X-Amz-Expires=3600` (1 Stunde)
**Auswirkung:** 447 Dokumente mit abgelaufenen URLs
**Lösung:** PDFs zu Supabase Storage kopieren mit permanenten public URLs
**Edge Function:** `hero-pdf-sync` bereits vorhanden

---

## Claude Code / Effizienz

### L029 - Subagenten für Recherche (Kontext-Schonung)
**Datum:** 2026-01-28
**Problem:** Recherche (API-Doku, Produkte, Codebase) füllt Kontext-Window mit Suchprozess
**Lösung:** Task-Tool mit Explore-Subagent nutzen
- Subagent hat eigenes Kontext-Window
- Nur kompakte Antwort kommt zurück
- Bei mehreren Fragen: Parallele Subagenten
**Regel:** In globaler CLAUDE.md v2.2 dokumentiert - gilt projektübergreifend

---

## OpenAI API

### L028 - GPT-5.2 verwendet max_completion_tokens
**Datum:** 2026-01-28
**Problem:** API-Fehler 400: "Unsupported parameter: 'max_tokens' is not supported with this model"
**Lösung:** Bei GPT-5.2 `max_completion_tokens` statt `max_tokens` verwenden
```javascript
// FALSCH für GPT-5.2
{ model: 'gpt-5.2', max_tokens: 200 }

// RICHTIG für GPT-5.2
{ model: 'gpt-5.2', max_completion_tokens: 200 }
```
**Hinweis:** Ältere Modelle (gpt-4o, gpt-3.5) nutzen weiterhin `max_tokens`

---

## Hero API

### L030 - Hero hat keine Webhook-API
**Datum:** 2026-01-28
**Problem:** Annahme dass Make.com "Watch Documents" echte Webhooks nutzt
**Wahrheit:** Hero Software bietet **keine native Webhook-Funktionalität**
- GraphQL API v7 hat nur Queries/Mutations, keine Subscriptions
- Make.com Integration basiert auf **Polling** (periodisches Abfragen)
- Alle Partner-Integrationen (DAA, Leveto, ContactsforHERO) sind spezifische Anbindungen
**Konsequenz:** Cron-Job ist die richtige Lösung, kein Umstellungs-Vorteil
**Quellen:**
- https://hero-software.de/api-doku/graphql-guide
- https://hero-software.de/features/schnittstellen

---

## Monday.com Integration

### L031 - Monday Bidirektional Sync
**Datum:** 2026-01-28
**Problem:** monday-sync pullt nur von Monday, aber pusht nicht zurück
**Lösung:** Separate `monday-push` Edge Function erstellen
**Workflow:**
1. Supabase-Daten aktualisieren
2. `sync_status = 'pending_push'` setzen
3. monday-push Function triggern
**Feld-Mapping (JSONB column_values):**
- `zahlen1__1` = Projektvolumen netto
- `zahlen77__1` = Projektvolumen brutto
- `numeric65__1` = NU-Budget netto
- `text23__1` = NUA-Nr
- `text49__1` = ATBS-Nr

### L032 - NUA-Budget-Berechnung
**Datum:** 2026-01-28
**Kontext:** VBW-Projekte brauchen automatische NUA-Budget-Berechnung
**Formel:** `NUA_Netto = SUM(AB_Netto) * 0.75`
**Rohertrag:** 25% Marge (standardmäßig)
**Zuordnung:** Über ATBS-Nummer (bv_id in dokumente)

---

## Supabase

### L033 - Upsert benötigt Unique Constraint
**Datum:** 2026-01-28
**Problem:** Supabase upsert mit onConflict schlägt fehl ohne Constraint
**Fehler:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`
**Lösung:** Unique Constraint vor Upsert erstellen:
```sql
ALTER TABLE dokumente ADD CONSTRAINT dokumente_dokument_nr_unique UNIQUE (dokument_nr);
```

### L034 - Default UUID für NOT NULL Spalten
**Datum:** 2026-01-28
**Problem:** Insert schlägt fehl mit "null value in column 'id' violates not-null constraint"
**Lösung:** Default-Wert setzen:
```sql
ALTER TABLE dokumente ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
```

### L035 - UNIQUE Constraint mit NULL-Werten
**Datum:** 2026-01-28
**Problem:** UNIQUE(a, b) erlaubt mehrere Zeilen wenn b NULL ist (PostgreSQL NULL-Semantik)
**Kontext:** email_details mit UNIQUE(message_id, account_email) - Anhänge haben gleiche message_id
**Lösung:** COALESCE in Index verwenden:
```sql
CREATE UNIQUE INDEX email_details_unique_idx
  ON email_details (message_id, account_email, COALESCE(attachment_id, ''));
```
**Grund:** COALESCE wandelt NULL in leeren String um, macht Vergleich deterministisch

### L036 - Graph API Attachments: contentBytes einzeln abrufen
**Datum:** 2026-01-28
**Problem:** GET /messages/{id}/attachments liefert KEINE contentBytes (Base64-Inhalt)
**Lösung:** Zwei-Schritt-Verfahren:
1. Liste abrufen: `/attachments?$select=id,name,contentType,size,isInline`
2. Pro Anhang einzeln: `/attachments/{att.id}` → enthält contentBytes

### L037 - Supabase Storage: Pfad-Sanitization für Message-IDs
**Datum:** 2026-01-28
**Problem:** internetMessageId enthält `<xxx@yyy.com>` - Sonderzeichen verursachen 400-Fehler
**Fehler:** Storage-Pfade wie `/2026/%3Cxxx/...` (URL-encoded `<`)
**Lösung:** Sonderzeichen entfernen:
```typescript
const safeMessageId = emailMessageId.replace(/[<>@.]/g, '').substring(0, 12);
```

---

## E-Mail Integration

### L038 - E-Mail-Import Architektur
**Datum:** 2026-01-28
**Kontext:** MS365 Graph API → Supabase Integration
**Architektur:**
- `email-fetch`: Holt E-Mails, speichert Anhänge in Storage, erstellt dokumente + email_details
- `email-process`: Matching-Kaskade (Domain → ATBS-Pattern → Postfach → Kontakt-Anlage)
**Tabellen:**
- `dokumente`: E-MAIL (E-Mails), E-ANH (Anhänge)
- `email_details`: E-Mail-spezifische Metadaten, verknüpft mit dokumente
- `kontakt_domains`: Domain → Kontakt Mapping für Auto-Zuordnung
**Cron:** email-fetch alle 10 Min, email-process alle 15 Min (versetzt)

---

## Hero API (Fortsetzung)

### L039 - Hero GraphQL: temporary_url explizit abfragen
**Datum:** 2026-01-28
**Problem:** PDF-Download schlägt fehl obwohl Dokumente in Hero existieren
**Ursache:** GraphQL Query hatte nur `file_upload { filename }` ohne `temporary_url`
**Lösung:** Immer alle benötigten Felder explizit abfragen:
```graphql
file_upload {
  filename
  temporary_url  # <- MUSS dabei sein für Downloads!
}
```
**Konsequenz:** OTC-URLs (temporary_url) verfallen nach kurzer Zeit, sofort nach Abruf verarbeiten

### L040 - Supabase Storage: Umlaute in Dateinamen
**Datum:** 2026-01-28
**Problem:** Upload schlägt fehl: "Invalid key: hero-docs/Auftragsbestätigung-..."
**Ursache:** Supabase Storage akzeptiert keine Umlaute oder Sonderzeichen im Pfad
**Lösung:** Filename-Sanitization vor Upload:
```javascript
function sanitizeFilename(filename) {
  return filename
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}
```
**Hinweis:** Gilt für alle Storage-Operationen, nicht nur Hero-Sync

---

---

## Daten-Sync

### L041 - Upsert überschreibt existierende Werte mit NULL/0
**Datum:** 2026-01-28
**Problem:** `hero-document-sync` überschrieb existierende Netto/Brutto-Werte mit 0
**Ursache:** Code `const netto = doc.value || 0;` setzt 0 wenn Hero keinen Wert hat
**Lösung:** Felder nur ins Record aufnehmen wenn Quelle tatsächlich Werte hat:
```javascript
// FALSCH: Überschreibt immer
const record = {
  betrag_netto: doc.value || 0,  // 0 bei fehlendem Wert!
  ...
};

// RICHTIG: Nur setzen wenn vorhanden
const record = { ... };
if (doc.value !== null && doc.value !== 0) {
  record.betrag_netto = doc.value;
}
```
**Konsequenz:** 11 Dokumente mussten aus Softr-Backup wiederhergestellt werden
**Regel:** Bei Upsert prüfen ob Source-Wert existiert bevor Feld ins Record kommt

---

## Supabase Client / PostgREST

### L042 - Supabase Client JSONB-Filter funktionieren nicht zuverlässig
**Datum:** 2026-01-28
**Problem:** `.filter('column_values', 'cs', '{"text49__1":...}')` verursacht JSON-Parse-Fehler
**Fehler:** `invalid input syntax for type json`
**Ursache:** Supabase Client übersetzt `cs` (contains) nicht korrekt für JSONB-Spalten
**Lösung:** Alle Datensätze laden und in JavaScript filtern:
```javascript
// FALSCH: Supabase client filter auf JSONB
const { data } = await supabase
  .from('monday_bauprozess')
  .select('*')
  .filter('column_values', 'cs', JSON.stringify({text49__1: 'ATBS-445'}));

// RICHTIG: Alle laden und manuell filtern
const { data } = await supabase.from('monday_bauprozess').select('*');
const match = data.find(p => extractText(p.column_values?.['text49__1']) === 'ATBS-445');
```
**Alternative:** Raw SQL mit `@>` Operator oder RPC-Function nutzen

### L043 - Edge Functions: verify_jwt für interne Calls
**Datum:** 2026-01-28
**Problem:** Edge Function A ruft Edge Function B auf → 401 Invalid JWT
**Ursache:** Edge Function B hat `verify_jwt: true` und erwartet User-JWT
**Lösung:** Zwei Optionen:
1. **verify_jwt: false** - Für interne Functions die nur von anderen Functions aufgerufen werden
2. **Service Role Key** - Authorization Header mit Service Role Key forwarden
```javascript
// Edge Function B mit verify_jwt: false deployen:
await mcp__supabase__deploy_edge_function({
  name: 'email-send',
  verify_jwt: false,  // <- Erlaubt Calls ohne User-JWT
  ...
});
```
**Regel:** verify_jwt: true nur für User-facing Endpoints, false für interne Calls

### L044 - PostgREST LIKE-Pattern: %25 statt *
**Datum:** 2026-01-28
**Problem:** REST API Abfrage mit `like.ER-NU-S*` findet keine Ergebnisse
**Ursache:** PostgREST nutzt SQL LIKE-Syntax mit `%`, nicht `*`
**Lösung:** `%` URL-encoded als `%25` verwenden:
```javascript
// FALSCH
const url = `${supabaseUrl}/rest/v1/dokumente?art_des_dokuments=like.ER-NU-S*`;

// RICHTIG
const url = `${supabaseUrl}/rest/v1/dokumente?art_des_dokuments=like.ER-NU-S%25`;
```
**Hinweis:** Bei Supabase Client funktioniert `.like('art', 'ER-NU-S%')` korrekt

---

### L045 - PFLICHT: Backup vor DB-Änderungen mit KI
**Datum:** 2026-01-28 (erweitert 2026-01-29)
**Kontext:** Datenwiederherstellung nach hero-document-sync Bug
**REGEL (MUST-HAVE):** Vor JEDER direkten DB-Änderung mit Claude MUSS ein Backup erstellt werden:
1. **Query vorher ausführen:** `SELECT * FROM tabelle WHERE bedingung` → JSON exportieren
2. **Backup speichern:** `docs/backups/[datum]_[tabelle]_[aktion].json`
3. **Änderungsprotokoll in Backup-Datei:**
   ```json
   {
     "datum": "2026-01-29",
     "tabelle": "maengel_fertigstellung",
     "aktion": "UPDATE status_mangel",
     "where_clause": "WHERE id IN ('uuid1', 'uuid2')",
     "betroffene_records": 5,
     "rollback_query": "UPDATE maengel_fertigstellung SET status_mangel = 'Offen' WHERE id IN (...)",
     "backup_data": [...]
   }
   ```
4. **Erst dann:** UPDATE/DELETE/INSERT ausführen
5. **Verifizieren:** Nach Änderung kurzer SELECT um Erfolg zu prüfen

**Backup-Verzeichnis:** `docs/backups/` für alle Daten-Snapshots vor Änderungen
**Beispiel:** `docs/softr_amounts_backup.json` rettete 11 Dokumente (~142.578 €)
**Grund:** KI kann Fehler machen - Backups mit vollständigem Protokoll ermöglichen IMMER exakten Rollback

---

## Marketing / Blog-Pipeline

### L046 - OpenAI Responses API mit web_search_preview
**Datum:** 2026-01-28
**Kontext:** Blog-Pipeline benötigt Web-Recherche für aktuelle Trends
**Lösung:** OpenAI Responses API mit `web_search_preview` Tool:
```typescript
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: 'gpt-5.2',
    input: 'Aktuelle KfW-Förderungen 2026',
    tools: [{ type: 'web_search_preview' }]
  })
});
```
**Hinweis:** Responses API ist der neue Standard für Agenten-Funktionalität bei OpenAI

### L047 - Agenten-Kommunikation via JSON-Output
**Datum:** 2026-01-28
**Kontext:** Blog-Pipeline mit 3 Agenten (Editor → Recherche → Writer)
**Pattern:** Jeder Agent gibt strukturiertes JSON aus, das der nächste als Input erhält
**Vorteil:** Klar definierte Schnittstellen, einfaches Debugging, keine Tool-Calls zwischen Agenten nötig
**Implementierung:** Edge Function als Orchestrator koordiniert die Aufrufe sequentiell

### L048 - Embedding-basierte Querverlinkung für SEO
**Datum:** 2026-01-28
**Kontext:** Blog-Artikel sollen sich gegenseitig verlinken (SEO: Domain Rating)
**Lösung:**
1. Jeder Artikel erhält vector(1536) Embedding bei Erstellung
2. RPC `search_similar_blog_posts()` findet ähnliche Artikel
3. Writer-Agent erhält Top-5 ähnliche Posts als Verlinkungsvorschläge
4. Wöchentlicher Cron prüft alle Artikel auf fehlende Verlinkung
**Regel:** Minimum 2 interne Links pro Artikel

---

## Claude Code / Subagenten (Fortsetzung)

### L049 - Explore-Subagent und lokale Dateien (KORRIGIERT)
**Datum:** 2026-01-28 (korrigiert 2026-01-29)
**Ursprüngliche Annahme (FALSCH):** Subagenten können keine lokalen Dateien lesen
**RICHTIG:** Subagenten KÖNNEN lokal synchronisierte Dateien lesen (z.B. OneDrive-Ordner)
**Problem nur bei:** Unsynchronisierte Cloud-Dateien (Datei nur in der Cloud, nicht lokal)
**Fazit:** Bei synchronisierten OneDrive/SharePoint-Ordnern funktionieren Subagenten für PDFs

### L050 - Wissens-Struktur für Blog-Pipeline
**Datum:** 2026-01-28
**Kontext:** Extrahiertes Wissen aus internen Dokumenten für Content-Marketing
**Lösung:** `wissen/` Ordner mit thematischen Markdown-Dateien:
- `vertrieb_prozesse.md` - Sales-Ablauf, USPs, Kennzahlen
- `marketing_strategie.md` - Positionierung, Content-Cluster
- `README.md` - Index der Wissensdateien
**Nutzung:**
1. Blog-Pipeline liest relevante Wissensdateien als System-Prompt
2. Agenten haben Zugriff auf aktuelle Unternehmens-Infos
3. Einheitliche Terminologie und Zahlen über alle Artikel

---

## Bauprozess / Gewerke

### L051 - Monday Ausführungsarten und Nachweis-Anforderungen
**Datum:** 2026-01-28
**Kontext:** Automatische Nachweis-E-Mails bei NU-Schlussrechnungen

**Relevante Monday-Spalten für Ausführungsart:**

| Spalte | Gewerk | Mögliche Werte |
|--------|--------|----------------|
| `color590__1` | Elektrik | Komplett, Teil-Mod, Austausch Feininstallation, Nur E-Check, Ohne |
| `status23__1` | Bad | Komplett, Fliese auf Fliese, Nur Austausch Sanitärartikel, Ohne Bad |
| `color78__1` | Boden | Ohne, Vinyl (Planken), Ausgleich, Laminat, Vinyl (Click), Holz schleifen, Fliesen |
| `color427__1` | Wände | Ohne, Raufaser & Anstrich, 2x Anstrich, Q2 & Anstrich, Nur Spachteln |
| `color97__1` | Türen | Ohne, Türblätter: neu \| Zarge: neu, lackieren \| lackieren, neu \| lackieren |
| `color49__1` | Therme | Ohne Therme, Therme versetzen, Neue Therme, Asbestsanierung |

**Nachweis-Logik nach Ausführungsart:**

**Elektrik (color590__1):**
| Ausführung | Rohinstallation Elektrik | E-Check |
|------------|-------------------------|---------|
| Komplett | ✅ | ✅ |
| Teil-Mod (UV + Schalter) | ❌ | ✅ |
| Austausch Feininstallation | ❌ | ✅ |
| Nur E-Check | ❌ | ✅ |
| Ohne | ❌ | ❌ |

**Bad (status23__1):**
| Ausführung | Rohinstallation Sanitär | Abdichtung Bad |
|------------|------------------------|----------------|
| Komplett | ✅ | ✅ |
| Fliese auf Fliese | ❌ | ✅ |
| Nur Austausch Sanitärartikel | ❌ | ❌ |
| Ohne Bad | ❌ | ❌ |

**Nachweis-Felder in Monday:**
- `color_mkt2e02p`: Nachweis Rohinstallation Elektrik
- `color_mkt2hpg0`: Nachweis Rohinstallation Sanitär
- `color_mkt2t435`: Nachweis Abdichtung Bad
- `color_mkt2t62x`: E-Check Protokoll

**Status-Werte für "Erledigt":** Fertig, Erledigt, Komplett, OK, Ja, Erstellt

---

## Telegram-Bot

### L053 - Telegram Webhook mit Supabase Edge Functions
**Datum:** 2026-01-29
**Kontext:** Telegram-Bot für neurealis Baustellen-Kommunikation
**Lösung:** Edge Function mit verify_jwt: false (Telegram braucht keinen JWT)
**Webhook-URL:** `https://{project}.supabase.co/functions/v1/telegram-webhook`
**Registrierung:**
```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url={WEBHOOK_URL}"
```
**Bot-Token:** Als Secret in Supabase hinterlegen, NIEMALS in Code!

### L054 - Telegram Session-Management
**Datum:** 2026-01-29
**Kontext:** Mehrstufige Konversationen im Bot (z.B. Projekt öffnen → Mangel erfassen)
**Lösung:** `telegram_sessions` Tabelle mit:
- `aktuelles_bv_id` - Aktuell geöffnetes Projekt
- `aktueller_modus` - 'idle', 'mangel_erfassen', 'foto_upload', etc.
- `kontext` (JSONB) - Zwischenspeicher für mehrstufige Eingaben
**Pattern:** Session pro chat_id, bei jedem Update `last_activity` aktualisieren

---

## SharePoint-Sync

### L055 - SharePoint Delta-Queries für inkrementellen Sync
**Datum:** 2026-01-29
**Problem:** 90 GB SharePoint-Daten komplett zu synchen dauert ewig
**Lösung:** Microsoft Graph API Delta-Queries:
```typescript
// Erster Aufruf
GET /drives/{driveId}/root/delta

// Folge-Aufrufe mit deltaLink
GET {deltaLink aus vorheriger Response}
```
**Speicherung:** `sharepoint_sync_state` Tabelle für Delta-Links pro Site

### L056 - SharePoint-Sync: Videos nur verlinken
**Datum:** 2026-01-29
**Problem:** Videos (MP4, MOV) sind zu groß für Supabase Storage
**Lösung:** Differenzierte Sync-Strategie:
- **Download:** PDF, DOCX, XLSX, JPG, PNG (< 50 MB)
- **Link-Only:** MP4, MOV, AVI + alle > 50 MB
**Implementierung:** `datei_url = NULL`, `sharepoint_link = Original-URL`

---

## Sicherheit / RLS

### L057 - 4-Stufen-Sicherheitskonzept für Dokumente
**Datum:** 2026-01-29
**Kontext:** SharePoint-Sites mit unterschiedlicher Vertraulichkeit
**Lösung:** `sicherheitsstufe` INTEGER (1-4) in dokumente-Tabelle:
| Stufe | Zugriff | Beispiel |
|-------|---------|----------|
| 1 | Alle Mitarbeiter | Projekte, Marketing |
| 2 | Bauleiter + GF | Preise, Vertrieb |
| 3 | GF + Buchhaltung | Finanzen |
| 4 | Nur GF | Personal, Management |
**RLS-Policy:** `WHERE sicherheitsstufe <= user_level`

---

## Claude Code / Subagenten (Fortsetzung)

### L058 - NIEMALS bestehende Edge Functions überschreiben
**Datum:** 2026-01-29
**Problem:** Annahme dass Code überschrieben wurde (war nicht der Fall - separate Functions)
**Regel:** Bei Edge Function Updates IMMER:

### L060 - Backups von Edge Functions erstellen
**Datum:** 2026-01-29
**Problem:** Edge Functions die nur in Supabase existieren können verloren gehen
**Regel:** VOR jeder Änderung:
1. `mcp__supabase__get_edge_function` zum Abrufen des Codes
2. Backup speichern in `backups/edge-functions/[name]_v[version].ts`
3. Erst dann Änderungen vornehmen
**Backup-Pfad:** `C:\Users\holge\neurealis-erp\backups\edge-functions\`
**Wichtig:** Auch wenn Function im lokalen Repo ist - Supabase-Version kann abweichen!

### L061 - Edge Functions Struktur verstehen
**Datum:** 2026-01-29
**Kontext:** Annahme dass telegram-webhook Bedarfsanalyse enthielt
**Wahrheit:** Bedarfsanalyse und Aufmaß sind SEPARATE Edge Functions:
- `process-bedarfsanalyse` (v31) - OCR + Extraktion
- `process-aufmass-complete` (v29) - CSV→Excel mit Styles
- `generate-aufmass-excel` (v20) - Excel-Generierung
- `telegram-webhook` (v46) - Nur Bot-Handler
**Regel:** Bei Edge Function Updates IMMER:
1. Bestehenden Code LESEN
2. Nur ERGÄNZEN, nicht ersetzen
3. Bestehende Befehle erhalten
**Konsequenz:** Funktionalität verloren, musste neu implementiert werden

### L059 - Parallele Subagenten für komplexe Implementierungen
**Datum:** 2026-01-29
**Problem:** Große Implementierungen füllen Context-Window
**Lösung:** 3+ parallele Subagenten für unabhängige Aufgaben:
1. DB-Migrationen
2. Edge Function A
3. Edge Function B (im Hintergrund)
**Vorteil:** Jeder Agent hat eigenes Context-Window, Ergebnisse kompakt
**Best Practice:** `run_in_background: true` für lang laufende Tasks

---

## Edge Functions

### L052 - Edge Function Performance: Daten einmal laden
**Datum:** 2026-01-29
**Problem:** Edge Function läuft in WORKER_LIMIT wenn DB-Abfrage in Schleife
**Kontext:** `schlussrechnung-nachweis-check` lud Monday-Daten pro Schlussrechnung neu
**Ursache:** Supabase Edge Functions haben begrenzte Compute-Ressourcen
**Lösung:** DB-Abfragen VOR Schleife ausführen, dann in-memory filtern:
```javascript
// FALSCH: In Schleife
for (const item of items) {
  const data = await supabase.from('tabelle').select('*');  // N Abfragen!
  const match = data.find(x => x.id === item.id);
}

// RICHTIG: Einmal laden
const allData = await supabase.from('tabelle').select('*');  // 1 Abfrage
for (const item of items) {
  const match = allData.find(x => x.id === item.id);  // In-memory
}
```
**Ergebnis:** Function läuft erfolgreich statt WORKER_LIMIT Fehler

### L053 - Matching mit Typo-Toleranz
**Datum:** 2026-01-29
**Problem:** Exaktes String-Matching findet keine Treffer bei Tippfehlern in Daten
**Kontext:** Monday-Feld enthält "Feininstallaiton" statt "Feininstallation"
**Lösung:** Prefix-Matching statt exaktem Match:
```javascript
// FALSCH: Exakt
if (text.includes('feininstallation')) { ... }

// RICHTIG: Prefix (toleriert Tippfehler am Ende)
if (text.includes('feininstall')) { ... }
```
**Regel:** Bei Matching gegen User-eingepflegte Daten Typo-Toleranz einbauen

---

## Subagenten-Koordination

### L054 - Subagenten über Markdown-Dateien koordinieren
**Datum:** 2026-01-29
**Problem:** Parallele Subagenten füllen das Haupt-Context-Window wenn sie direkt berichten
**Lösung:** Koordination über zentrale Markdown-Datei:
1. **Tracker-Datei erstellen:** z.B. `docs/IMPLEMENTATION_TRACKER.md`
2. **Struktur:** Tasks mit Status (pending/in_progress/done/failed), Output-Pfade
3. **Subagenten lesen:** Tracker am Start, verstehen Gesamtkontext
4. **Subagenten schreiben:** Ergebnisse in separate Dateien, Status in Tracker updaten
5. **Hauptagent:** Liest nur Tracker für Fortschritt, Details bei Bedarf
**Vorteile:**
- Context-Window bleibt schlank
- Qualität bleibt gleich (vollständiger Kontext in Dateien)
- Parallelisierung möglich
- Nachvollziehbarkeit durch persistente Logs
**Pattern:**
```
docs/
├── IMPLEMENTATION_TRACKER.md  # Zentrale Koordination
├── implementation/
│   ├── task1_output.md        # Subagent 1 Output
│   ├── task2_output.md        # Subagent 2 Output
│   └── ...
```
**Regel:** Bei komplexen Multi-Step-Tasks IMMER Tracker-Datei verwenden

---

## Blog-Pipeline

### L062 - OpenAI Responses API vs. Chat Completions
**Datum:** 2026-01-29
**Problem:** OpenAI `/v1/responses` Endpoint mit `web_search_preview` gibt 400-Fehler
**Kontext:** blog-research sollte Web-Recherche via Responses API machen
**Lösung:** Standard Chat Completions API verwenden (`/v1/chat/completions`)
```javascript
// FALSCH: Responses API (gibt 400)
fetch('https://api.openai.com/v1/responses', {
  body: JSON.stringify({
    model: 'gpt-5.2',
    input: query,
    tools: [{ type: 'web_search_preview' }]
  })
});

// RICHTIG: Chat Completions API
fetch('https://api.openai.com/v1/chat/completions', {
  body: JSON.stringify({
    model: 'gpt-5.2',
    messages: [{ role: 'user', content: query }],
    max_completion_tokens: 2000
  })
});
```
**Hinweis:** Responses API ist für Agenten-Funktionalität gedacht, aber web_search_preview funktioniert nicht zuverlässig

### L063 - Edge Functions verify_jwt für interne Calls
**Datum:** 2026-01-29
**Problem:** Cron-Jobs und interne Function-Calls scheitern mit 401 wenn verify_jwt: true
**Lösung:** Bei Functions die intern oder via Cron aufgerufen werden: `verify_jwt: false`
```javascript
// Bei Deployment
await mcp__supabase__deploy_edge_function({
  name: 'blog-research',
  verify_jwt: false,  // <- Wichtig für Cron/interne Calls
  files: [...]
});
```
**Regel:**
- `verify_jwt: true` → User-facing APIs (erfordern Supabase Auth)
- `verify_jwt: false` → Cron-Jobs, interne Function-Calls, Webhooks

### L064 - Edge Function Timeouts bei Chain-Calls
**Datum:** 2026-01-29
**Problem:** Orchestrator ruft Editor→Research→Writer sequentiell auf, Writer timeouted
**Kontext:** Jede Function braucht ~10-20s, Supabase Edge Function Timeout = 60s
**Symptom:** Einzelne Functions funktionieren, Chain scheitert
**Mögliche Lösungen:**
1. **Async/Callback-Pattern:** Orchestrator startet Tasks, pollt Status
2. **Kürzere Prompts:** Weniger Tokens pro Agent
3. **Background-Processing:** Queue-basierte Verarbeitung
4. **Timeout erhöhen:** Supabase Pro Plan (150s statt 60s)
**Regel:** Bei Multi-Agent-Chains: Max 2-3 sequentielle API-Calls pro Edge Function

### L065 - Supabase Cron mit pg_cron
**Datum:** 2026-01-29
**Kontext:** Tägliche/wöchentliche Blog-Jobs einrichten
**Lösung:** `cron.schedule()` direkt in PostgreSQL
```sql
-- Täglich um 8:00 UTC
SELECT cron.schedule(
  'blog-orchestrate-daily',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/blog-orchestrate',
    headers := '{"Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- Sonntags um 6:00 UTC
SELECT cron.schedule(
  'blog-crosslink-weekly',
  '0 6 * * 0',
  $$SELECT net.http_post(...);$$
);
```
**Verwaltung:** `SELECT * FROM cron.job;` für alle Jobs
**Deaktivieren:** `SELECT cron.unschedule('job-name');`

---

## Meta / Prozess

### L066 - Subagenten für Overnight-Tasks (KRITISCH)
**Datum:** 2026-01-29
**Problem:** Hauptchat-Kontext wurde mit Edge Function Code gefüllt, Context Window voll nach ~7 Stunden
**Ursprüngliche Anforderung:** User wollte autonome Overnight-Implementierung
**Was schief lief:**
1. Edge Functions direkt im Hauptchat geschrieben statt via Subagenten
2. Tracker-Datei erstellt, aber nicht konsequent genutzt
3. Hauptchat musste /compact ausführen → Kontext-Verlust

**RICHTIGE Vorgehensweise für lange autonome Tasks:**
```
1. TRACKER-DATEI erstellen (z.B. docs/IMPLEMENTATION_TRACKER.md)
   - Alle Tasks mit IDs und Status (pending/in_progress/done)
   - Output-Pfade für jeden Task

2. PRO TASK einen SUBAGENTEN starten:
   Task-Tool mit subagent_type="general-purpose"
   Prompt: "Lies docs/IMPLEMENTATION_TRACKER.md, bearbeite Task TX,
            schreibe Output nach implementation/TX_output.md,
            aktualisiere Tracker wenn fertig."

3. HAUPTCHAT nur für:
   - Tracker lesen
   - Subagenten starten
   - Kurze Status-Updates

4. PARALLELE Subagenten wenn Tasks unabhängig

5. BACKGROUND-MODE für lang laufende Tasks:
   run_in_background: true
```

**Vorteile:**
- Jeder Subagent hat eigenes Context Window
- Hauptchat bleibt schlank
- Nachvollziehbarkeit durch Output-Dateien
- Kann stundenlang ohne Context-Overflow laufen

**REGEL:** Bei Tasks > 2h IMMER dieses Pattern verwenden!

---

## Softr API

### L067 - Softr Tables API: Felder erstellen
**Datum:** 2026-01-29
**Kontext:** Erinnerungs-Felder mussten in Softr angelegt werden
**Lösung:** POST-Request an `/api/v1/databases/{db}/tables/{table}/fields`
```bash
curl -X POST "https://tables-api.softr.io/api/v1/databases/{DB_ID}/tables/{TABLE_ID}/fields" \
  -H "Softr-Api-Key: {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Erinnerung Status",
    "type": "SELECT",
    "options": {
      "choices": [
        {"label": "Aktiv", "color": "#20956f"},
        {"label": "Pausiert", "color": "#727272"}
      ]
    }
  }'
```
**Unterstützte Typen:** SELECT, SINGLE_LINE_TEXT, NUMBER, DATETIME, etc.
**Einschränkung:** PATCH für Feld-Updates wird NICHT unterstützt (nur für Records)

### L068 - 2-Phasen-Erinnerungslogik für Mängelmanagement
**Datum:** 2026-01-29
**Kontext:** NU soll Erinnerungen bekommen bis Foto hochgeladen, dann BL zur Abnahme
**Lösung:** Automatischer Phasenwechsel basierend auf `fotos_nachweis_nu`:
```
Phase 1 (NU-Erinnerung):
  Bedingung: erinnerung_status='Aktiv' UND fotos_nachweis_nu LEER
  → E-Mail an NU alle 2 Tage

Phase 2 (BL-Erinnerung):
  Bedingung: fotos_nachweis_nu BEFÜLLT UND status_mangel ≠ 'Abgenommen'
  → E-Mail an Bauleiter alle 2 Tage

Stopp:
  - status_mangel enthält 'Abgenommen' oder 'Abgeschlossen'
  - erinnerung_status = 'Pausiert' oder NULL
```
**Vorteil:** Kein manueller Statuswechsel nötig, Foto-Upload triggert automatisch Phase 2
**Implementierung:** mangel-reminder v13 mit `hasNachweisPhoto()` Prüfung

---

## MS365 Graph API

### L069 - Client Credentials Flow (Application Permissions)
**Datum:** 2026-01-29
**Problem:** refresh_token-basierter Flow erfordert User-Login
**Lösung:** Client Credentials Flow für Server-zu-Server:
```javascript
// Kein User-Login nötig!
const response = await fetch(tokenUrl, {
  method: 'POST',
  body: new URLSearchParams({
    client_id: MS365_CLIENT_ID,
    client_secret: MS365_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',  // <-- Wichtig!
  }),
});
```
**Voraussetzung:** Application Permissions (nicht Delegated) + Admin Consent

### L070 - Graph API: 404 statt 403 bei Permission-Fehlern
**Datum:** 2026-01-29
**Problem:** Download gibt 404 obwohl Datei existiert
**Ursache:** Microsoft versteckt Existenz wenn Permissions fehlen (Sicherheits-Feature)
**Fazit:** Bei 404 IMMER auch Permissions prüfen, nicht nur ob Datei existiert

### L071 - Admin Consent für Application Permissions
**Datum:** 2026-01-29
**Problem:** Application Permissions funktionieren nicht ohne Admin Consent
**Lösung:** Azure Portal → App Registrations → API Permissions → "Administratorzustimmung erteilen"
**Rollen die Consent geben können:** Global Administrator, Cloud Application Administrator

---

## Cloud-Dienste / Performance

### L072 - PFLICHT: Batch API für langläufige KI-Tasks
**Datum:** 2026-01-29
**Kontext:** Blog-Pipeline Writer-Schritt timeouted bei Supabase Edge Functions (60s Limit)
**REGEL:** Bei Cloud-Diensten (Supabase Edge Functions, Netlify Functions, etc.) IMMER Batch-Processing verwenden wenn:
1. API-Calls > 30 Sekunden dauern können
2. Mehrere Items verarbeitet werden
3. Kosten eine Rolle spielen (Batch ist 50% günstiger)

**OpenAI Batch API Pattern:**
```
1. SUBMIT: POST /batches mit JSONL-File von Requests
2. POLL: GET /batches/{id} alle 5-10 Min bis status='completed'
3. PROCESS: GET /files/{output_file_id}/content → Ergebnisse verarbeiten
```

**Implementierung für Blog-Pipeline:**
```
blog-batch-submit: Erstellt Batch mit 5-10 Artikeln
blog-batch-poll: Cron alle 10 Min, prüft Status
blog-batch-process: Verarbeitet fertige Ergebnisse
```

**Vorteile:**
- Kein Timeout-Problem (async Verarbeitung)
- 50% günstiger als synchrone API
- Skaliert auf 100+ Artikel/Tag
- Retry bei Fehlern automatisch

**Regel:** Bei JEDER neuen Integration mit KI/LLMs ZUERST prüfen ob Batch-Processing möglich

---

## Supabase Storage

### L073 - Storage-Bucket muss existieren
**Datum:** 2026-01-29
**Problem:** Edge Function Upload scheitert mit "Bucket not found"
**Kontext:** sharepoint-sync versuchte in `dokumente` Bucket zu schreiben, der nicht existierte
**Lösung:** VOR Deployment prüfen ob Bucket existiert:
```javascript
// Buckets auflisten
const buckets = await mcp__supabase__list_storage_buckets();
// Bucket erstellen oder existierenden verwenden
```
**Debugging:** "Bucket not found" Fehler kommt vom Upload, nicht vom Download!
**Regel:** Bei neuen Edge Functions die Storage nutzen IMMER erst Buckets prüfen

### L074 - Unique-Constraints bei generierten IDs
**Datum:** 2026-01-29
**Problem:** DB-Insert scheiterte mit Unique-Constraint-Verletzung
**Kontext:** `dokument_nr = SP-${item.id.substring(0, 8)}` - mehrere SharePoint-Items begannen mit `01VBIR76`
**Ursache:** 8 Zeichen zu wenig für Eindeutigkeit bei SharePoint-IDs
**Lösung:** Mehr Zeichen verwenden:
```javascript
// FALSCH: Nur 8 Zeichen
const dokumentNr = `SP-${item.id.substring(0, 8)}`;  // SP-01VBIR76 (Kollision!)

// RICHTIG: 16 Zeichen
const dokumentNr = `SP-${item.id.substring(0, 16)}`;  // SP-01VBIR76AYC2DRVZ (eindeutig)
```
**Regel:** Bei IDs aus externen Systemen: Mindestens 12-16 Zeichen für Eindeutigkeit

### L075 - Error-Handling für DB-Operationen in Edge Functions
**Datum:** 2026-01-29
**Problem:** Edge Function meldete Erfolg obwohl DB-Inserts scheiterten
**Kontext:** `itemsProcessed++` wurde IMMER erhöht, auch wenn Insert fehlschlug
**Lösung:** Fehler prüfen und zählen:
```javascript
// FALSCH: Kein Error-Handling
await supabase.from('tabelle').insert(record);
result.itemsProcessed++;  // Zählt auch bei Fehler!

// RICHTIG: Mit Error-Handling
const { error } = await supabase.from('tabelle').insert(record);
if (error) {
  result.errors++;
  result.errorDetails.push(`${item.name}: ${error.message}`);
  return;  // Nicht als Erfolg zählen!
}
result.itemsProcessed++;
```
**Regel:** ALLE DB-Operationen in Edge Functions müssen error-geprüft werden

---

## Blog-Pipeline / Cornerstone-Content

### L076 - max_completion_tokens für lange Artikel
**Datum:** 2026-01-29
**Kontext:** 3000-Wörter Cornerstone-Artikel mit OpenAI Batch API
**Problem:** Artikel waren mit 4000 Tokens nur ~800-1200 Wörter
**Lösung:** Token-Limits nach Wortanzahl staffeln:
```javascript
// Wort-zu-Token Verhältnis: ~1.3 Tokens pro Wort (Deutsch)
// 3000 Wörter ≈ 4000 Tokens für Content
// + Strukturierung + Redundanz = 12000 Tokens sicher

const maxTokens = isCornerstone ? 12000 : 4000;
```
**Faustregel:** Für 3000 Wörter → mindestens 10.000-12.000 max_completion_tokens
**Ergebnis:** 2.999 Wörter erreicht (praktisch Zielwert)

### L077 - Cornerstone-Detection in Blog-Pipeline
**Datum:** 2026-01-29
**Kontext:** Unterscheidung normale Artikel vs. Pillar-Content
**Lösung:** Zwei Erkennungsmethoden:
1. **Explizit:** `cornerstone: true` Parameter beim Submit
2. **Automatisch:** `priority >= 100` in blog_keywords
**Implementierung:**
```javascript
const isCornerstone = cornerstone || kw.priority >= 100;
if (isCornerstone) {
  // Längerer Prompt mit 10-Sektionen-Struktur
  // 12000 max_completion_tokens statt 4000
}
```
**Prompt-Struktur für Cornerstone:**
1. Einleitung (300 Wörter)
2. Definition & Abgrenzung (250 Wörter)
3. Kosten-Überblick (400 Wörter)
4. Ablauf Schritt-für-Schritt (500 Wörter)
5. Lokaler Fokus Ruhrgebiet (300 Wörter)
6. Förderungen & Finanzierung (300 Wörter)
7. Häufige Fehler (250 Wörter)
8. Checkliste (200 Wörter)
9. FAQ (300 Wörter)
10. Fazit + CTA (200 Wörter)

---

## WordPress REST API

### L078 - WordPress Application Passwords für API-Zugriff
**Datum:** 2026-01-29
**Kontext:** Blog-Artikel von Supabase nach WordPress synchronisieren
**Lösung:** WordPress Application Passwords (seit WP 5.6):
```javascript
// Basic Auth mit Application Password
const credentials = `${username}:${appPassword}`;
const authHeader = `Basic ${btoa(credentials)}`;

// POST erstellen
await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
  method: 'POST',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Titel',
    content: '<p>Inhalt</p>',
    status: 'publish',
    slug: 'mein-slug'
  })
});
```
**Erstellen:** WordPress Admin → Benutzer → Profil → "Anwendungspasswörter"
**Hinweis:** Generiertes Passwort nur einmal sichtbar!

### L079 - WordPress REST API: POST für Create und Update
**Datum:** 2026-01-29
**Problem:** Annahme dass PUT für Updates nötig ist
**Wahrheit:** WordPress REST API verwendet POST für beides:
- `POST /wp-json/wp/v2/posts` → Neuen Post erstellen
- `POST /wp-json/wp/v2/posts/{id}` → Bestehenden Post aktualisieren
**Alternative:** PUT funktioniert auch für Updates, aber POST ist konsistenter

### L080 - WordPress Slug-basierte Duplikat-Prüfung
**Datum:** 2026-01-29
**Kontext:** Prüfen ob Blog-Post bereits in WordPress existiert
**Lösung:** Zwei-Schritt-Verfahren:
1. Wenn `wordpress_post_id` vorhanden: GET `/wp-json/wp/v2/posts/{id}`
2. Fallback: GET `/wp-json/wp/v2/posts?slug={slug}&status=any`
**Wichtig:** `status=any` um auch Entwürfe und private Posts zu finden
**Ergebnis:** Keine Duplikate, bestehende Posts werden aktualisiert

---

## Supabase RLS

### L081 - RLS-Policies für anonyme User bei öffentlichen Seiten
**Datum:** 2026-01-29
**Problem:** Marketing-Seite war leer obwohl 9 Blog-Posts existierten
**Ursache:** RLS-Policies nur für `authenticated` Rolle, Seite nutzt `anon` Key ohne Login
**Lösung:** Explizite Policy für anonyme Leser hinzufügen:
```sql
CREATE POLICY "Anon users can read blog_posts"
ON blog_posts FOR SELECT TO anon USING (true);
```
**Regel:** Bei öffentlichen Seiten ohne Login IMMER prüfen ob `anon` Rolle SELECT-Rechte hat

### L082 - WordPress Application Password User-Rollen
**Datum:** 2026-01-29
**Problem:** WordPress API gibt 401 "nicht berechtigt, Beiträge zu erstellen"
**Ursache:** Der WordPress-User hat keine ausreichenden Rechte (nur "Abonnent" o.ä.)
**Lösung:** User muss mindestens Rolle "Redakteur" oder "Administrator" haben
**Prüfung:** WordPress Admin → Benutzer → Rolle ändern
**Hinweis:** Application Password allein reicht nicht - der User dahinter braucht Schreibrechte

---

*Aktualisiert: 2026-01-29 18:30*
