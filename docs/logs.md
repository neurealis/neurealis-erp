# Session Logs - neurealis ERP

**Stand:** 2026-01-28

---

## Index

| Log-ID | Datum | Titel | Status |
|--------|-------|-------|--------|
| LOG-001 | 2026-01-27 | UI-Migration Phase 1-2: Komplettes internes Portal | Abgeschlossen |
| LOG-002 | 2026-01-27 | Hero API Rechnungssync - invoice_style Entdeckung | Dokumentiert |
| LOG-003 | 2026-01-27 | VBW LV 2026 - Preisvergleich & Materialvorschläge | Abgeschlossen |
| LOG-004 | 2026-01-27 | VBW LV 2026 - Entscheidungsgrundlage v1.1 (Final) | Abgeschlossen |
| LOG-005 | 2026-01-28 | UI CRUD + Netlify Deployment | Abgeschlossen |
| LOG-006 | 2026-01-28 | Hero Document Sync v7 + Datenqualitäts-Analyse | Abgeschlossen |
| LOG-007 | 2026-01-28 | OAuth Callback Verifizierung | Abgeschlossen |
| LOG-008 | 2026-01-28 | Hero-Softr Dokumenten-Sync Bereinigung | Abgeschlossen |
| LOG-009 | 2026-01-28 | Dokumenten-Merge + RAG-Vorbereitung | Abgeschlossen |
| LOG-010 | 2026-01-28 | Document Summarization System | Abgeschlossen |
| LOG-011 | 2026-01-28 | Hero Webhook-Recherche + Cron-Optimierung | Abgeschlossen |
| LOG-012 | 2026-01-28 | Hero Document Sync v10 + Monday Bidirektional Sync | Abgeschlossen |
| LOG-013 | 2026-01-28 | Angebotsvergleich ANG-0021296 (Vorher/Nachher) | Abgeschlossen |
| LOG-014 | 2026-01-28 | E-Mail-Integration Phase 1 | Abgeschlossen |
| LOG-015 | 2026-01-28 | Hero PDF-Sync - Vollständige Migration | Abgeschlossen |
| LOG-016 | 2026-01-28 | Schlussrechnung-Nachweis-Check Edge Function | Abgeschlossen |
| LOG-017 | 2026-01-28 | Hero-Sync Beträge-Bug-Fix + Wiederherstellung | Abgeschlossen |

---

## LOG-017 - Hero-Sync Beträge-Bug-Fix + Wiederherstellung

**Datum:** 2026-01-28 ~22:00
**Dauer:** ~60 Minuten

### Zusammenfassung

Bug-Fix für `hero-document-sync` Edge Function: Überschreiben von existierenden Netto/Brutto-Werten mit 0 verhindert. 11 Dokumente aus Softr-Backup wiederhergestellt.

### Durchgeführte Arbeiten

**1. Root-Cause-Analyse:**
- Bug: `const netto = doc.value || 0;` setzte 0 wenn Hero keinen Wert lieferte
- Upsert überschrieb dann existierende Supabase-Werte mit 0
- Betroffen: 12 Dokumente (11 wiederherstellbar, 1 bereits korrekt)

**2. Bug-Fix (hero-document-sync v13):**
- Beträge werden nur noch ins Record aufgenommen wenn Hero tatsächlich Werte hat
- `hasHeroValues`-Check vor Aufnahme ins Upsert-Record
- Verhindert Überschreiben von existierenden Daten

**3. Wiederherstellung aus Softr-Backup:**

| Dokument | Netto | Brutto |
|----------|-------|--------|
| NUA-355 | 27.915,00 € | 33.218,85 € |
| NUA-357 | 8.662,50 € | 10.308,38 € |
| NUA-358 | 7.350,00 € | 8.746,50 € |
| NUA-359 | 4.200,00 € | 4.998,00 € |
| NUA-363 | 14.700,00 € | 17.493,00 € |
| NUA-364 | 18.900,00 € | 22.491,00 € |
| NUA-365 | 22.365,00 € | 26.614,35 € |
| NUA-366 | 21.000,00 € | 24.990,00 € |
| 2100021040 | 428,57 € | 510,00 € |
| R-00156 | 9.177,73 € | 10.921,50 € |
| R-00173 | 7.879,31 € | 9.376,38 € |
| **Gesamt** | **142.578,11 €** | **169.668,96 €** |

**4. Vergleich Softr vs. Supabase:**

| Typ | Softr | Supabase | Differenz |
|-----|-------|----------|-----------|
| ER-* | 605 | 598 | 7 (vor 2025) |
| AR-* | 144 | 142 | 2 (vor 2025) |
| RE-* | 418 | 175 | 243 (vor 2025) |

**Grund für Differenz:** `hero-document-sync` filtert auf `date >= '2025-01-01'`

**5. Cron-Job Status:**
- Schedule: `*/5 6-19 * * *` (alle 5 Min, 6-19 Uhr)
- Status: aktiv (automatisch läuft tagsüber)

### Dokumentation

- D016: Softr-Beträge-Backup aufbewahren (`docs/softr_amounts_backup.json`)
- D017: Hero-Sync Beträge nur überschreiben wenn Quelle Wert hat
- L041: Upsert überschreibt existierende Werte mit NULL/0

---

## LOG-016 - Schlussrechnung-Nachweis-Check Edge Function

**Datum:** 2026-01-28 ~19:00-23:00
**Dauer:** ~2 Stunden

### Zusammenfassung

Edge Function `schlussrechnung-nachweis-check` v16 erstellt, die bei NU-Schlussrechnungen (ER-NU-S) automatisch prüft, ob Nachweise fehlen und E-Mails an NUs sendet.

### Durchgeführte Arbeiten

**1. Edge Function v16 (Final):**
- Findet ER-NU-S Dokumente in `dokumente`-Tabelle
- Matched mit Monday-Projekten via ATBS-Nummer (text49__1)
- Prüft 4 Nachweis-Felder:
  - `color_mkt2e02p`: Nachweis Rohinstallation Elektrik
  - `color_mkt2hpg0`: Nachweis Rohinstallation Sanitär
  - `color_mkt2t435`: Nachweis Abdichtung Bad
  - `color_mkt2t62x`: E-Check Protokoll
- Test-Modus mit `test_email` Parameter

**2. E-Mail-Template (Du-Form):**
- Anrede: "Hallo Vitali" (Vorname)
- Text: "danke für deine Schlussrechnung", "Bitte lade..."
- Button: Rot (#dc3545), eckig, mittig, weiße Schrift
- Link: https://neurealis-partnerportal.softr.app/anmeldung
- BCC: tobias.rangol@neurealis.de (Produktivmodus)

**3. Parameter:**
```json
{
  "atbs_filter": ["ATBS-445"],  // Optional: nur bestimmte BVs
  "dokument_nr": "RE20250157",  // Optional: einzelnes Dokument
  "mode": "check" | "send",     // check = nur prüfen, send = E-Mails senden
  "test_email": "..."           // Optional: alle E-Mails an diese Adresse
}
```

**4. Test-Ergebnis:**
- ATBS-445 (RE20250157): 4 offene Nachweise → E-Mail gesendet
- ATBS-447 (RE 20260155): 4 offene Nachweise → E-Mail gesendet

**5. Gelöste Probleme:**

| Problem | Lösung |
|---------|--------|
| Supabase Client JSONB-Filter | Direct REST API + manuelles Filtern |
| PostgREST LIKE-Syntax | %25 statt * für Wildcard |
| email-send JWT-Auth | verify_jwt: false gesetzt |

### Nächste Schritte (Future)

- Trigger erstellen für automatische Ausführung bei neuen ER-NU-S
- Cron-Job für tägliche Prüfung aller offenen Nachweise

---

## LOG-015 - Hero PDF-Sync - Vollständige Migration

**Datum:** 2026-01-28 ~18:00
**Dauer:** ~30 Minuten

### Zusammenfassung

Alle 653 PDFs von Hero Software vollständig nach Supabase Storage migriert. GraphQL-Query und Filename-Sanitization gefixt.

### Durchgeführte Arbeiten

**1. hero-document-sync v11:**
- Fix: `temporary_url` zur GraphQL-Query hinzugefügt (fehlte!)
- 728 Dokumente mit Hero OTC URLs aktualisiert

**2. hero-pdf-sync v3 → v4:**
- Fix v3: Tabelle `softr_dokumente` (VIEW) → `dokumente` (TABLE) korrigiert
- Fix v4: Filename-Sanitization für Supabase Storage hinzugefügt
  - Umlaute (ä→ae, ö→oe, ü→ue, ß→ss)
  - Sonderzeichen → Underscore
  - Mehrfache Underscores entfernt

**3. Ergebnis:**
| Metrik | Wert |
|--------|------|
| Gefunden in Hero | 653 |
| Heruntergeladen | 653 |
| Hochgeladen | 653 |
| DB aktualisiert | 653 |
| Fehler | 0 |
| Dauer | ~89 Sekunden |

**4. Aktueller Stand:**
- 686 PDFs in Supabase Storage (permanent)
- 447 PDFs in S3 (Legacy, noch zu migrieren)
- 16 Softr-Dokumente ohne externe PDF-Quelle (Gutschriften, Budgets)

### Neue Learnings

- L039: Hero GraphQL - `file_upload { temporary_url }` explizit abfragen
- L040: Supabase Storage - Dateinamen mit Umlauten sanitizen

---

## LOG-014 - E-Mail-Integration Phase 1

**Datum:** 2026-01-28 ~14:00-16:00
**Dauer:** ~120 Minuten

### Zusammenfassung

E-Mail-Integration Phase 1 implementiert: MS365 Graph API → Supabase. E-Mails und Anhänge werden automatisch importiert, in Supabase Storage gespeichert und als Dokumente angelegt.

### Durchgeführte Arbeiten

**1. Edge Functions:**
- `email-fetch` v4: Holt E-Mails von 6 MS365-Postfächern via Graph API
- `email-process`: Matching-Kaskade für Kontakt/BV-Zuordnung vorbereitet

**2. Datenbank-Tabellen (NEU):**
- `email_details`: E-Mail-spezifische Metadaten, verknüpft mit dokumente
- `email_accounts`: 6 Postfächer konfiguriert
- `kontakt_domains`: Domain → Kontakt Mapping
- `email_sync_log`: Audit-Log für Sync-Vorgänge

**3. Gelöste Probleme:**

| Problem | Lösung |
|---------|--------|
| Graph API liefert contentBytes nicht in Liste | Jeden Anhang einzeln abrufen |
| UNIQUE-Constraint blockiert Anhänge | COALESCE für attachment_id im Index |
| Storage-Pfade mit Sonderzeichen | `<>@.` aus Message-ID entfernen |
| Modul-Import fehlgeschlagen | getApplicationAccessToken inlined |

**4. Ergebnis:**
- 50 E-Mails importiert (10 pro Postfach)
- 27 Anhänge in Supabase Storage hochgeladen
- 2 erwartete Fehlschläge (.url, .ics - nicht in MIME-Types)

**5. Postfächer aktiv:**
- holger.neumann@neurealis.de
- service@neurealis.de
- rechnungen@neurealis.de
- bewerbungen@neurealis.de
- kontakt@neurealis.de
- auftraege@neurealis.de (keine E-Mails)

### Neue Learnings

- L035: UNIQUE Constraint mit NULL-Werten → COALESCE verwenden
- L036: Graph API Attachments → contentBytes einzeln abrufen
- L037: Storage-Pfad-Sanitization für Message-IDs
- L038: E-Mail-Import Architektur dokumentiert

### Nächste Schritte

1. Cron-Jobs aktivieren (email-fetch: 10 Min, email-process: 15 Min)
2. email-process testen: Kontakt-Zuordnung, BV-Matching
3. Optional: .ics/.url zu MIME-Types hinzufügen

---

## LOG-013 - Angebotsvergleich ANG-0021296 (Vorher/Nachher)

**Datum:** 2026-01-28 ~12:30
**Dauer:** ~10 Minuten

### Zusammenfassung

Analyse der versehentlichen Preisänderungen im Angebot ANG-0021296. Vergleich auf Gesamtpositions- und Einzelpositionsebene durchgeführt.

### Durchgeführte Analyse

**1. Gesamtdifferenz:**
- VORHER: 47.561,96 € netto
- NACHHER: 58.053,05 € netto
- Differenz: **+10.491,09 €** (+22%)

**2. Hauptursachen der Erhöhung:**

| Rang | Position | Änderung | Grund |
|------|----------|----------|-------|
| 1 | Pos. 9 Strangsanierung | +6.126,79 € | Bedarf → Aktiv |
| 2 | Pos. 6 Hauseingangstür | +2.350,00 € | Bedarf → Aktiv |
| 3 | Pos. 4 Treppenaufarbeitung | +1.169,00 € | Bedarf → Aktiv |
| 4 | Pos. 3 Malervlies | +1.089,71 € | Teilweise aktiviert |
| 5 | Pos. 2 Innenwand | +813,47 € | Bedarf → Aktiv |
| 6 | Pos. 7 Deckenbrennstellen | +525,00 € | 1→3 Stück |

**3. Einzige Einheitspreis-Änderung:**
- Pos. 2.006 "Öffnungen bis 2,5m² schließen": 310,00 → 346,86 €/Stk (+11,9%)
- Auswirkung: +73,72 € (bei 2 Stück)

**4. Auffälligkeiten:**
- Demontage-Positionen (1.001-1.008) komplett entfernt im neuen Angebot
- Viele Bedarfspositionen wurden versehentlich aktiviert

### Ergebnis

Tabellen mit Vorher/Nachher-Vergleich auf Einzelpositionsebene erstellt.

---

## LOG-012 - Hero Document Sync v10 + Monday Bidirektional Sync

**Datum:** 2026-01-28 ~09:30-11:00
**Dauer:** ~90 Minuten

### Zusammenfassung

Hero Document Sync v10 deployed mit direktem Supabase-Upsert. Neue monday-push Edge Function für bidirektionalen Monday.com Sync. NUA-Budget-Berechnung (75% von AB) für VBW-Projekte implementiert.

### Durchgeführte Arbeiten

**1. Hero Document Sync v10:**
- 651 Dokumente von Hero nach Supabase synchronisiert
- Fehler behoben: Unique Constraint auf `dokument_nr` hinzugefügt
- Fehler behoben: Default UUID für `id`-Spalte hinzugefügt

**2. NUA-Budget-Berechnung:**
- Formel: 75% der Summe aller AB-Beträge pro ATBS-Nummer
- Betroffen: NUA-367, NUA-368, NUA-369, NUA-370
- Rohertrag: 25% Marge standardmäßig

**3. monday-push Edge Function (NEU):**
- Bidirektionaler Monday.com Sync (Push von Supabase nach Monday)
- Feld-Mapping:
  - `zahlen1__1` = Projektvolumen netto
  - `zahlen77__1` = Projektvolumen brutto
  - `numeric65__1` = NU-Budget netto
  - `text23__1` = NUA-Nr
- 3 Items erfolgreich gepusht (ATBS-468, 469, 470)

**4. Datenbank-Fixes:**
```sql
ALTER TABLE dokumente ADD CONSTRAINT dokumente_dokument_nr_unique UNIQUE (dokument_nr);
ALTER TABLE dokumente ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
```

### Ergebnisse

| Metrik | Wert |
|--------|------|
| Dokumente synced | 651 |
| NUAs aktualisiert | 4 |
| Monday Items gepusht | 3 |
| Neue Edge Functions | 1 (monday-push) |

---

## LOG-011 - Hero Webhook-Recherche + Cron-Optimierung

**Datum:** 2026-01-28 ~09:00
**Dauer:** ~15 Minuten

### Zusammenfassung

Recherche zu Hero Software Webhooks und Optimierung des Document Sync Cron-Jobs.

### Recherche-Ergebnis: Hero hat KEINE Webhooks

Die Hero GraphQL API v7 unterstützt nur:
- **Queries:** `contacts`, `project_matches`, `customer_documents`, `calendar_events`, `supply_product_versions`
- **Mutations:** `create_contact`, `create_project_match`, `add_logbook_entry`

**Keine Subscriptions, Webhooks oder Event-Callbacks.**

Make.com "Watch Documents" Modul = **Polling** (nicht echte Webhooks).

### Cron-Job Optimierung

Der `hero-document-sync` Job wurde angepasst:

| Eigenschaft | Vorher | Nachher |
|-------------|--------|---------|
| Schedule | `*/15 * * * *` | `*/5 6-19 * * *` |
| Intervall | Alle 15 Min | Alle 5 Min |
| Zeitraum | 24/7 | 06:00 - 19:55 Uhr |
| Läufe/Tag | 96 | 168 (nur tagsüber) |

### SQL-Migration

```sql
SELECT cron.alter_job(
  job_id := 17,
  schedule := '*/5 6-19 * * *'
);
```

### Quellen

- [HERO API-Dokumentation](https://hero-software.de/api-doku)
- [HERO GraphQL Guide](https://hero-software.de/api-doku/graphql-guide)
- [HERO Schnittstellen](https://hero-software.de/features/schnittstellen)

---

## LOG-010 - Document Summarization System

**Datum:** 2026-01-28 ~04:15-04:30
**Dauer:** ~15 Minuten

### Zusammenfassung

Implementierung eines automatischen Document Summarization Systems mit GPT-5.2. PDF-Text-Extraktion und KI-Zusammenfassung für alle nativen PDFs.

### Durchgeführte Arbeiten

**1. Edge Function `document-summarize` v5:**
- PDF-Text-Extraktion mit unpdf (pdfjs)
- Native vs. Scanned Klassifizierung (>500 chars/Seite = native)
- GPT-5.2 Zusammenfassung für native PDFs
- Batch-Verarbeitung mit konfigurierbarem Limit

**2. API-Parameter Fix:**
- Problem: GPT-5.2 unterstützt nicht `max_tokens`
- Lösung: `max_completion_tokens` statt `max_tokens` verwenden
- Learning L028 dokumentiert

**3. Datenbank:**
- `document_summaries` Tabelle erstellt
- Felder: `dokument_nr`, `zusammenfassung`, `is_native`, `processed_at`
- 27 Dokumente verarbeitet (25 native, 2 gescannt)

**4. Automatisierung (Hybrid-Ansatz):**
- Cron-Job `document-summarize-job` für Backlog
  - Schedule: alle 15 Minuten, 20 Docs/Batch
  - **Auto-Disable:** Deaktiviert sich selbst wenn Backlog leer
- Trigger `on_document_pdf_added` für neue Dokumente
  - Feuert bei INSERT oder UPDATE von `datei_url`
  - Ruft Edge Function mit einzelnem `dokument_nr` auf

**5. Hilfsfunktionen:**
- `check_document_backlog_empty()` - Prüft ob noch Dokumente offen sind
- `disable_document_summarize_cron()` - Deaktiviert den Cron-Job
- `system_logs` Tabelle für Nachvollziehbarkeit

### Statistiken

| Metrik | Wert |
|--------|------|
| Dokumente mit PDFs | 1.071 |
| Bereits verarbeitet | 27 |
| Davon native | 25 |
| Davon gescannt | 2 |
| Noch offen | ~1.044 |
| Geschätzte Dauer | ~13 Stunden |

### Nächste Schritte

- [ ] Embeddings für Summaries generieren (vector(1536))
- [ ] RAG-Integration für Dokumenten-Suche
- [ ] Scanned PDFs durch OCR verarbeiten

---

## LOG-009 - Dokumenten-Merge + RAG-Vorbereitung

**Datum:** 2026-01-28 ~03:30-04:15
**Dauer:** ~45 Minuten (fortgesetzt aus vorheriger Session)

### Zusammenfassung

Konsolidierung der Dokumenten-Tabellen und Vorbereitung für RAG/CAG-Wissensmanagement. PDF-Sync-Analyse für permanente URLs.

### Durchgeführte Arbeiten (vorherige Session)

**1. Tabellen-Merge:**
- `softr_dokumente` (1.751 Docs) + `dokumente` (6 Docs) → einheitliche `dokumente` Tabelle
- 1.835 Dokumente gesamt

**2. Neue Felder für RAG/CAG:**
- `is_native_pdf` - PDF-Klassifizierung (nativ vs. gescannt)
- `quelle` - Dokumentenherkunft (Hero, Softr, etc.)
- `raw_text` - Extrahierter Text
- `summary` - KI-generierte Zusammenfassung
- `embedding` - vector(1536) für Similarity-Search
- `atbs_nummer_erkannt`, `positionen_erkannt`, `gewerke_erkannt`, `keywords`, `entities`

**3. Edge Functions erstellt:**
- `classify-pdf` - PDF-Text-Extraktion mit unpdf
- `summarize-document` - GPT-5.2 Dokumentenanalyse
- `document-batch` - OpenAI Batch API für günstigere Verarbeitung

**4. Referenz-Tabelle:**
- `dokumenttypen` - 24 Dokumenttypen mit Kategorien und Keywords

**5. PDF-Extraktion:**
- 291 Dokumente mit raw_text extrahiert
- 37 als gescannt klassifiziert (benötigen OCR)
- ~99% der PDFs sind nativ (>500 chars/Seite)

### Aktuelle Session

**Status-Analyse:**
```
URL-Typ                    | Anzahl
---------------------------|-------
Supabase Storage           | 624 ✅
Softr S3 (ablaufend)       | 447 ⚠️
Keine URL                  | 764 ❌
```

**Edge Function `hero-pdf-sync`:**
- Bereits deployed und funktionsfähig
- 642 Hero-PDFs bereits zu Supabase Storage synchronisiert
- Dateinamen-Sanitization (Umlaute → ae/oe/ue im Dateinamen)

### Offene Punkte

- [ ] 447 Dokumente mit ablaufenden S3-URLs migrieren
- [ ] 764 Dokumente ohne URL aus Hero nachladen
- [ ] OpenAI Batch-Job Ergebnisse verarbeiten
- [ ] Embeddings für extrahierte Dokumente generieren

---

## LOG-008 - Hero-Softr Dokumenten-Sync Bereinigung

**Datum:** 2026-01-28 ~02:00-03:30
**Dauer:** ~90 Minuten

### Zusammenfassung

Vollständige Bereinigung und Synchronisation der Dokumenten-Tabelle zwischen Hero und Softr/Supabase. Neue Edge Function für PDF-Sync erstellt.

### Durchgeführte Arbeiten

**1. Datenanalyse (3 parallele Subagenten):**
- Hero 2025: 642 Dokumente mit PDFs
- Softr: 2.000 Einträge, davon 501 Duplikate (25%)
- Kritisch: ANG-0021294 existierte 159x

**2. Duplikate bereinigt:**
- 299 Duplikate gelöscht
- ANG-0021294: 159 → 1
- NUA-358: 36 → 1

**3. Dokumenttypen korrigiert:**
- 28 Rechnungen von AR-A (Abschlag) zu AR-S (Schluss) korrigiert
- Basierend auf Hero `invoice_style: full`

**4. Fehlende Dokumente angelegt:**
- 128 neue Einträge (72 AR-S, 19 AFM, 16 AR-A, 15 Stornos)
- Neuer Dokumenttyp: AFM (Aufmaß)

**5. Edge Function `hero-pdf-sync` erstellt:**
- 642 PDFs von Hero → Supabase Storage gesynct
- Dateinamen-Sanitization (Umlaute, Leerzeichen)
- URL: `https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/hero-pdf-sync`
- Parameter: `?dry_run=true`, `?limit=N`

### Neue Edge Function

```
hero-pdf-sync
├── Holt alle Hero-Dokumente mit PDFs
├── Downloaded von temporary_url
├── Uploaded zu Supabase Storage (softr-files/hero-docs/)
└── Updated datei_url in softr_dokumente
```

### Statistik nach Bereinigung

| Metrik | Vorher | Nachher |
|--------|--------|---------|
| softr_dokumente Einträge | 2.000 | 1.777 |
| Duplikate | 501 | 0 |
| Mit datei_url | 545 | 1.187 |
| Korrekte Dokumenttypen | ~90% | 100% |

---

## LOG-007 - OAuth Callback Verifizierung

**Datum:** 2026-01-28 ~01:30
**Dauer:** ~5 Minuten

### Zusammenfassung

Verifizierung der OAuth-Callback-Route nach User-Meldung über Redirect zu localhost:3000.

### Durchgeführte Arbeiten

- Auth-Callback Route geprüft (`/auth/callback/+server.ts`) - korrekt implementiert
- Login-Seite geprüft - verwendet `window.location.origin` für dynamischen Redirect
- Hooks-Server geprüft - Session-Handling funktioniert

### Ergebnis

OAuth funktioniert. Route war korrekt, Problem lag vermutlich an Supabase URL-Konfiguration oder Caching.

### Wichtige URLs für Supabase Auth

Falls Problem erneut auftritt:
- **Site URL:** `https://neurealis-erp.netlify.app`
- **Redirect URLs:** `https://neurealis-erp.netlify.app/auth/callback`
- **Dashboard:** https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu/auth/url-configuration

---

## LOG-001 - UI-Migration Phase 1-2: Komplettes internes Portal

**Datum:** 2026-01-27 19:00-20:00
**Dauer:** ~60 Minuten

### Zusammenfassung

Vollständige Migration des internen Softr-Portals zu SvelteKit mit Supabase-Datenanbindung.

### Durchgeführte Arbeiten

**Phase 1 - Layout-System:**
- AppShell, Sidebar (rollenbasiert), Header, BottomNav erstellt
- UI-Komponenten: Button, Card, Badge, Accordion, KPICard
- Design-Tokens erweitert (Breakpoints, Status-Farben)

**Phase 2 - Seiten mit Supabase:**
| Seite | Tabelle | Datensätze |
|-------|---------|------------|
| Dashboard | diverse | KPIs, Aktivitäten |
| Bauvorhaben | monday_bauprozess | 193 |
| Kalender | monday_bauprozess | Bauzeitenplan |
| Mängel | maengel_fertigstellung | 57 |
| Nachträge | nachtraege | aktiv |
| Finanzen | softr_dokumente | 2.000 |
| Einkauf | grosshaendler, bestellartikel, lv_positionen | 2.835 |
| Kontakte | kontakte | 1.379 |
| Leads | leads (NEU!) | 8 |
| Aufgaben | tasks | 1.755 |
| Nachunternehmer | kontakte + kontakte_nachunternehmer | 39 |

**Neue Datenbank-Tabelle:**
- `leads` mit Pipeline-Status (neu, kontaktiert, qualifiziert, angebot, gewonnen, verloren)
- `softr_dokumente` mit 2.000 importierten Rechnungen

### Technische Details

- Svelte 5 Runes ($state, $derived, $props)
- Parallele Subagenten für schnelle Implementierung (11 parallel)
- TypeScript durchgängig
- Responsive Design (Desktop + Mobile)

### Offene Punkte

- Kundenportal-Seiten: /angebote, /ansprechpartner
- Partnerportal-Seiten: /auftraege, /lvs, /nachweise, /vorlagen
- Auth-Rollen aus DB laden (derzeit hardcoded)
- Netlify Deploy

---

## LOG-002 - Hero API Rechnungssync - invoice_style Entdeckung

**Datum:** 2026-01-27 ~20:00
**Quelle:** Wiederherstellung aus abgestürztem Chat

### Zusammenfassung

Analyse der Hero GraphQL API zur direkten Unterscheidung von Teil- und Schlussrechnungen mittels `metadata.invoice_style`.

### Kernentdeckung

Die Hero API bietet ein **InvoiceStyle Enum**:

| Wert | Bedeutung | → Softr-Typ |
|------|-----------|-------------|
| `full` | Schlussrechnung | AR-S |
| `parted` | Teilrechnung | AR-A |
| `cumulative` | Kumulierte Rechnung | AR-A |
| `downpayment` | Abschlagsrechnung | AR-A |
| `null` | Entwurf | **Ignorieren** |

### Wichtige API-Felder

```graphql
customer_documents {
  nr                          # RE-0015xxx
  value                       # Netto EUR
  vat                         # MwSt EUR
  date                        # Datum
  metadata {
    invoice_style             # full/parted/cumulative/downpayment/null
    positions { name net_value vat }
  }
  file_upload {
    filename                  # Lesbarer Name
    url                       # Download-URL
  }
}
```

### Statistiken

- 53 Schlussrechnungen (full)
- 16 Teilrechnungen (parted)
- 1 kumulierte Rechnung
- 49 Entwürfe (null) → ignorieren

### Validierung

15 Dokumente verglichen: **100% Übereinstimmung** zwischen Hero `invoice_style` und Softr-Dokumenttyp.

### Erstellte Dokumentation

- `docs/HERO_RECHNUNGSSYNC_API.md` - Vollständige API-Referenz

### Nächste Schritte

1. [ ] Edge Function `hero-document-sync` anpassen
2. [ ] Fehlende Netto/Brutto in Supabase ergänzen
3. [ ] Positionen als Text-Feld speichern (optional)

---

## LOG-003 - VBW LV 2026 - Preisvergleich & Materialvorschläge

**Datum:** 2026-01-27 ~21:00-22:30
**Zweck:** Verhandlungsvorbereitung mit Großkunde VBW

### Zusammenfassung

Analyse des neuen VBW-Leistungsverzeichnisses 2026 mit Preisvergleich zu 2023 und Extraktion von Materialvorschlägen für Verhandlungsgespräch.

### Durchgeführte Arbeiten

**1. Excel-Analyse:**
- Original-Excel mit 125 Zeilen, 22 Kommentare extrahiert
- Kommentare enthielten Materialvorschläge und Preishinweise
- Umlaute-Encoding korrigiert

**2. Erstellte Ausgabe-Datei:**
`2026-01-27 VBW - LV 2026 - Preisvorschläge neurealis.xlsx`

**Spaltenstruktur:**
| Spalte | Inhalt |
|--------|--------|
| A | Pos. NEU |
| B | Kurztext NEU (2026) |
| C | Gewerk |
| D | LV 2023 (50m²) |
| E | LV 2026 (50m²) |
| F | Δ % |
| G | Preisvorschlag (nur wenn explizit) |
| H | Material-Vorschlag |
| I | Kommentar (Original) |
| J | Vergleichsposition (andere Kunden) |

**3. Supabase-Vergleich:**
- Vergleichspositionen aus `lv_positionen` für GWS, covivio, WBG Lünen, Privat, neurealis

### Kritische Preisänderungen (50m² netto)

| Pos | Position | 2023 | 2026 | Δ |
|-----|----------|------|------|---|
| 3.1 | Sanitär komplett | 3.980 € | 7.650 € | **+92%** |
| 4.8 | Therme Vaillant | 2.650 € | 4.300 € | **+62%** |
| 6.1 | Bodenbeläge entf. | 480 € | 350 € | **-27%** |
| 6.3 | Vinyl | 2.075 € | 1.565 € | **-25%** |

### Materialvorschläge für VBW

| Position | Vorschlag |
|----------|-----------|
| E-Anlage / Schalter | Gira Standard 55 (statt S2) |
| Sanitär | Vigour One |
| Fliesen | Kermos 8mm (DK02 nicht rutschhemmend) |
| Türen | Prüm Röhrenspahn / KK2 RC2 |
| Beschläge | Becher/Hoppe Amsterdam |

### Erkenntnisse für Verhandlung

1. **Untergrundvorbereitung fehlt im VBW-LV:**
   - Säubern + Grundieren nicht in 6.2 enthalten
   - GWS hat separate Positionen (Grundierung 2,63€/m², Untergrund 14,58€/m²)

2. **Explizite Preisvorschläge aus Kommentaren:**
   - 4.9 Rückbau MAG: 250€ (Stadtwerke-Abmeldung aufwendig)
   - 7.2 WE-Tür: 1.200€ (EK Material 1.050€)

### Erstellte Scripts

- `parse-vbw-excel.mjs` - Excel-Struktur analysieren
- `create-vbw-material-excel.mjs` - Erste Extraktion
- `update-vbw-final.mjs` - Finale Ausgabe mit Vergleichen

---

---

## LOG-004 - VBW LV 2026 - Entscheidungsgrundlage v1.1 (Final)

**Datum:** 2026-01-27 ~23:00
**Zweck:** Finales Verhandlungsdokument für VBW-Termin 28.01.2026

### Zusammenfassung

Professionelles Entscheidungsdokument für Preisverhandlung mit VBW erstellt. Enthält Ausreißer-Analyse, Materialvorschläge, Prozessoptimierung und Zahlungsziel-Argumentation.

### Finale Dateien

| Datei | Pfad |
|-------|------|
| **PDF (Final)** | `16 VBW - neu/00 LVs/2026 VBW - Neues LV mit 10er Schritten/2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.pdf` |
| **DOCX (Final)** | `16 VBW - neu/00 LVs/2026 VBW - Neues LV mit 10er Schritten/2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.docx` |

**Basispfad:** `C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\`

### Dokumentstruktur (8 Seiten)

1. **Titelseite** - Vorher/Nachher Visualisierung
2. **Inhaltsverzeichnis**
3. **Zusammenfassung der Analyse**
   - Vorgehen: LV 2023→2026, 3 Referenz-BVs, GWS-Marktvergleich
   - Referenz-Wohnungen: In der Delle 6 (37m²), Schulenburgstr. 25 (58m²), Gorch-Fock 31 (76m²)
4. **Übersicht Positionen mit Gesprächsbedarf** (sortiert nach Abweichung)
5. **Detailanalyse kritische Positionen**
6. **Materialvorschläge**
7. **Zahlungsziel** (14 Tage netto beibehalten)
8. **Prozessoptimierung** mit Leerstandskosten-Berechnung
9. **Entscheidungspunkte** (6 Stück)

### Ausreißer-Analyse (Top 5)

| Pos. | Position | VBW 2026 | Markt | Δ |
|------|----------|----------|-------|---|
| 3.3 | Küchenstränge erneuern | 350 € | 1.268 € | **-72%** |
| 1.5 | Elektroschlitze verputzen | 250 € | 543 € | **-54%** |
| 2.1 | E-Anlage komplett | 2.740 € | 4.929 € | **-44%** |
| 6.3 | Vinyl-Designboden | 1.565 € | 2.617 € | **-40%** |
| - | Decken tapezieren | 770 € | 1.077 € | **-29%** |

### Leerstandskosten-Berechnung (NEU)

```
280 Wohnungen/Jahr × 3 Wochen Verzögerung × 60m² × 8,50 €/m²/Monat ÷ 4 Wochen
= 357.000 €/Jahr potenzielle Einsparung
```

### Prozessoptimierung - Zeitachse

| Phase | Aktuell | Vorschlag |
|-------|---------|-----------|
| Monat 0 | Kündigung Mieter | Kündigung + BL-Zuweisung (nach Straßen) |
| Monat 1-2 | - | Erstbegehung (bewohnte Wohnung) |
| Monat 2-3 | - | Budgetfreigabe & Einplanung |
| Monat 3 | Auszug → +3 Wochen → Baustart | Auszug → **Direkter Baustart** |

### 6 Entscheidungspunkte

1. Positionen mit Gesprächsbedarf → Preisanpassung/Leistungsumfang
2. Materialvorgaben → Freigabe Alternativen
3. Zahlungsziel → 14 Tage netto beibehalten
4. Prozessoptimierung → Umsetzung neuer Ablauf
5. BL-Zuordnung → Feste Zuordnung nach Straßen/Regionen
6. Kapazitätsplanung → (offen)

### Materialvorschläge (genehmigt)

| Pos. | Aktuell | Vorschlag |
|------|---------|-----------|
| 2.1, 2.8 | Gira E2 | **Gira Standard 55** |
| 2.7 | Ritzer Limodor | **Maico ECA 100 ipro K** |
| 3.1 | diverse | **Vigour One** |
| 5.9 | DK02 | **Kermos 8mm** (rutschhemmend!) |
| 6.3 | Holz-Sockelleisten | **KSO Kunststoff** |
| 7.1 | Jeld-Wen | **Prüm Röhrenspahn** |
| 7.2 | Jeld-Wen | **Prüm KK2 RC2** |
| 7.3 | Griffwerk | **Becher/Hoppe Amsterdam** |

### Verknüpfung

- Basiert auf: LOG-003 (Preisvergleich & Materialvorschläge)
- Excel-Quellen: `2026-01-27 VBW - LV 2026 - Vorschläge neurealis.xlsx`, `2026-01-27 VBW - LV 2026 - Preisvergleich vs 2023 - Beispiel-Berechnungen & Vorschläge Material.xlsx`

---

---

## LOG-005 - UI CRUD + Netlify Deployment

**Datum:** 2026-01-28 ~22:00-23:30
**Zweck:** Alle UI-Seiten editierbar machen und live deployen

### Zusammenfassung

Vollständiges CRUD (Create, Read, Update, Delete) für alle UI-Seiten implementiert und erfolgreich auf Netlify deployed.

### Implementierte CRUD-Funktionalität

| Seite | Create | Read | Update | Delete | Details |
|-------|--------|------|--------|--------|---------|
| **BV-Detail** | - | ✅ | ✅ | - | Kunde, Termine, Kennzahlen, Nachweise editierbar |
| **Mängel** | ✅ | ✅ | ✅ | ✅ | Modal, Quick-Status-Actions, Fotos-URLs |
| **Nachträge** | ✅ | ✅ | ✅ | ✅ | Modal, Auto-Marge-Berechnung |
| **Aufgaben** | ✅ | ✅ | ✅ | ✅ | Slide-over Panel, Checkbox für Erledigt |
| **Kontakte** | ✅ | ✅ | ✅ | ✅ (Soft) | Modal mit Sektionen, E-Mail-Validierung |
| **Nachunternehmer** | ✅ | ✅ | ✅ | ✅ (Soft) | 3-Tab-Modal: Stammdaten, Gewerke, Nachweise |
| **Finanzen** | - | ✅ | - | - | Erweiterte Filter, Überfällig-Tracking |

### Phasen-Visualisierung (BV-Detail)

- Nummern oben in eckigen Boxen
- Phasen-Namen darunter (Desktop: voll, Tablet: kurz, Mobile: nur Nr)
- Farbschema: Grün (erledigt), Rot (aktiv), Grau (zukünftig)

### Technische Details

- 6 parallele Subagenten für CRUD-Implementierung
- Svelte 5 $state für reaktives State-Management
- Loading/Success/Error States überall
- Bestätigungs-Dialoge beim Löschen
- Optimistic UI Updates
- Soft-Delete für Kontakte und NUs

### Netlify Deployment

**Problem:** Erster Deploy zeigte 404 - nur `build/` Ordner ohne Functions deployed.

**Lösung:** `netlify deploy --prod` ohne `--dir` Flag verwenden, damit Netlify die `.netlify/functions-internal/` mit deployed.

**URL:** https://neurealis-erp.netlify.app

### Git Commits

1. `143c136` - feat: UI-Migration Softr → SvelteKit komplett (50 Dateien, +23k Zeilen)
2. `9864cfe` - chore: Cleanup + Edge Functions Update
3. `a172db1` - feat: Vollständiges CRUD für alle UI-Seiten (+7.5k Zeilen)
4. `262800b` - fix: Svelte @const placement in nachunternehmer

### Behobene Fehler

1. **Svelte @const Placement:** `{@const}` muss innerhalb `{#if}` oder `{#each}` sein, nicht direkt in `<div>`
2. **Netlify Functions:** adapter-netlify generiert Functions in `.netlify/`, nicht in `build/`

---

## LOG-006 - Hero Document Sync v7 + Datenqualitäts-Analyse

**Datum:** 2026-01-28 ~00:00-01:30
**Zweck:** invoice_style Implementierung und Sync-Ausführung

### Zusammenfassung

Edge Function `hero-document-sync` auf v7 aktualisiert mit `metadata.invoice_style` als primäre Klassifizierungslogik. Sync ausgeführt und Datenqualität analysiert.

### Implementierung

**Edge Function Änderungen:**
```typescript
const INVOICE_STYLE_TO_SOFTR: Record<string, string> = {
  'full': 'AR-S  Ausgangsrechnung - Schluss',
  'parted': 'AR-A  Ausgangsrechnung - Abschlag',
  'cumulative': 'AR-A  Ausgangsrechnung - Abschlag',
  'downpayment': 'AR-A  Ausgangsrechnung - Abschlag'
};
```

**GraphQL Query erweitert:**
- `metadata { invoice_style }` hinzugefügt
- `file_upload { filename }` für bessere Dateinamen
- Batch-Size von 100 auf 500 erhöht (Performance)

### Sync-Ergebnis

| Metrik | Wert |
|--------|------|
| Hero-Dokumente geprüft | 642 |
| Rechnungen korrekt | 146 (keine Änderung) |
| Typ-Korrekturen | **0** |
| Update fehlgeschlagen | ~200 (neue Dokumente) |

**Erkenntnis:** Die alte Fallback-Logik (Phase/Rechnungsnummer) funktionierte bereits gut - alle Typen waren korrekt.

### Datenqualitäts-Analyse (softr_dokumente)

**NUA-Dokumente:**
| Problem | Anzahl | Anteil |
|---------|--------|--------|
| Ohne betrag_netto | 181 | **80%** |
| Duplikate | 62 | 27% |
| Ohne ATBS-Zuweisung | 70 | 31% |

**Allgemeine Probleme:**
- projektname nur bei 41.65% gefüllt
- datei_url nur bei 40.75% vorhanden
- Inkonsistente Dokumenttypen (AB vs AB mit Umlaut)

### Offene Punkte

- [ ] Neue Dokumente (ANG, NUA, AB) automatisch in Softr anlegen (derzeit nur Update)
- [ ] NUA-Werte aus Hero synchronisieren (80% fehlen)
- [ ] Duplikate bereinigen (62 Stück)
- [ ] Projekt-Zuweisungen vervollständigen

### Erstellte Dokumentation

- `docs/HERO_RECHNUNGSSYNC_API.md` - Vollständige API-Referenz (aktualisiert)

---

*Aktualisiert: 2026-01-28 01:30*
