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
**Datum:** 2026-01-28
**Kontext:** Datenwiederherstellung nach hero-document-sync Bug
**REGEL (MUST-HAVE):** Vor JEDER direkten DB-Änderung mit Claude MUSS ein Backup erstellt werden:
1. **Query vorher ausführen:** `SELECT * FROM tabelle WHERE bedingung` → JSON exportieren
2. **Backup speichern:** `docs/backups/[datum]_[tabelle]_[aktion].json`
3. **Erst dann:** UPDATE/DELETE/INSERT ausführen
4. **Dokumentieren:** Was wurde geändert, wie kann es rückgängig gemacht werden

**Backup-Verzeichnis:** `docs/backups/` für alle Daten-Snapshots vor Änderungen
**Beispiel:** `docs/softr_amounts_backup.json` rettete 11 Dokumente (~142.578 €)
**Grund:** KI kann Fehler machen - Backups ermöglichen IMMER Rollback

---

*Aktualisiert: 2026-01-28 23:00*
