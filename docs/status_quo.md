# Status Quo - neurealis ERP

**Stand:** 2026-01-28 23:00 (aktualisiert)

---

## Aktueller Projektstatus

### UI-Migration Softr → SvelteKit

| Komponente | Status | Supabase | Details |
|------------|--------|----------|---------|
| **Bestellsystem** | ✅ Fertig | ✅ | Login, Liste, Detail, Formular |
| **LV-Export** | ✅ Fertig | ✅ | Export-Seite vorhanden |
| **Layout-System** | ✅ Fertig | - | AppShell, Sidebar, Header, BottomNav |
| **Dashboard** | ✅ Fertig | ✅ | KPIs, Aktivitäten, Aufgaben aus DB |
| **BV-Übersicht** | ✅ Fertig | ✅ | Phasen-Tabs, phasenspezifische Tabellen wie Softr |
| **Mängelmanagement** | ✅ Fertig | ✅ | maengel_fertigstellung mit Filter/Statistiken |
| **Nachträge** | ✅ Fertig | ✅ | nachtraege Tabelle mit Summen |
| **Finanzen** | ✅ Fertig | ✅ | 2000 Dokumente aus softr_dokumente (NEU) |
| **Kontakte** | ✅ Fertig | ✅ | 1.379 Kontakte, Karten/Tabellen-Ansicht |
| **Einkauf** | ✅ Fertig | ✅ | Lieferanten, Artikel, LV-Positionen (3.057), KI-Suche |
| **Aufgaben** | ✅ Fertig | ✅ | 1.755 Tasks, Fälligkeits-Filter |
| **Nachunternehmer** | ✅ Fertig | ✅ | 39 NUs, Nachweise-Status |
| **Leads** | ✅ Fertig | ✅ | Kanban-Pipeline (8 Leads) |
| **Marketing** | ✅ Fertig | ✅ | Social Media, Blog, Analytics (NEU) |
| **Kalender** | ✅ Fertig | ✅ | Monatsansicht, BV-Zeiträume |
| **Kundenportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |
| **Partnerportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |

### CRUD-Status (NEU)

| Seite | Create | Update | Delete |
|-------|--------|--------|--------|
| Mängel | ✅ | ✅ | ✅ |
| Nachträge | ✅ | ✅ | ✅ |
| Aufgaben | ✅ | ✅ | ✅ |
| Kontakte | ✅ | ✅ | ✅ (Soft) |
| Nachunternehmer | ✅ | ✅ | ✅ (Soft) |
| BV-Detail | - | ✅ | - |

### Deployment

**Netlify:** https://neurealis-erp.netlify.app (Live)
**Auth:** Microsoft OAuth via Supabase (funktioniert)

### Supabase-Datenquellen (angebunden)

| Tabelle | Seite | Datensätze |
|---------|-------|------------|
| `monday_bauprozess` | Dashboard, BV, Kalender | 193 Bauvorhaben |
| `maengel_fertigstellung` | Mängel, BV-Detail | 57 Mängel |
| `nachtraege` | Nachträge, Dashboard | aktive Nachträge |
| `softr_dokumente` | Finanzen | 1.777 Dokumente (bereinigt, 642 mit PDF) |
| `tasks` | Dashboard, Aufgaben | 1.755 Tasks |
| `dokumente` | Dashboard, BV-Detail | Aktivitäten |
| `kontakte` | Kontakte, Nachunternehmer | 1.379 Kontakte |
| `kontakte_nachunternehmer` | Nachunternehmer | NU-spezifische Daten |
| `grosshaendler` | Einkauf | 39 Lieferanten |
| `bestellartikel` | Einkauf | 768 Artikel |
| `lv_positionen` | Einkauf | 3.057 LV-Positionen (alle mit Embeddings) |
| `leads` | Leads | 8 Leads |
| `social_media_posts` | Marketing | 4 Posts |
| `blog_posts` | Marketing | 3 Artikel |
| `email_details` | E-Mail-Sync | 77 E-Mail-Metadaten (NEU) |
| `email_accounts` | E-Mail-Sync | 6 Postfächer konfiguriert (NEU) |
| `kontakt_domains` | E-Mail-Sync | Domain→Kontakt Mapping (NEU) |

### Architektur

**Ein Portal + Rollen** - Eine SvelteKit-App mit Supabase RLS für rollenbasierte Zugriffskontrolle.

### Komponenten-Bibliothek

**Layout:**
- `AppShell.svelte` - Hauptcontainer mit Sidebar
- `Sidebar.svelte` - Responsive Navigation (rollenbasiert)
- `Header.svelte` - Breadcrumb, Suche, User-Menü
- `BottomNav.svelte` - Mobile Navigation

**UI:**
- `Button.svelte` - Primary, Secondary, Ghost, Danger
- `Card.svelte` - Container mit Header/Footer
- `Badge.svelte` - Status-Anzeige mit Phasen-Farben
- `Accordion.svelte` - Aufklappbare Bereiche
- `KPICard.svelte` - Dashboard-Kennzahlen (mit subvalue)

### Aktuelle Seiten-Struktur

```
ui/src/routes/
├── +page.svelte              # Dashboard (Supabase)
├── +layout.svelte            # AppShell Layout
├── login/+page.svelte
├── bauvorhaben/
│   ├── +page.svelte          # BV-Liste (Supabase)
│   └── [id]/+page.svelte     # BV-Detail (Supabase)
├── kalender/+page.svelte     # Kalender/Bauzeitenplan (NEU)
├── maengel/+page.svelte      # Mängel (Supabase)
├── nachtraege/+page.svelte   # Nachträge (Supabase)
├── finanzen/+page.svelte     # Finanzen (Supabase)
├── einkauf/+page.svelte      # Lieferanten, Artikel, LV (NEU)
├── kontakte/+page.svelte     # Kontakte (NEU)
├── leads/+page.svelte        # Vertriebspipeline (NEU)
├── marketing/+page.svelte    # Social Media, Blog, Analytics (NEU)
├── aufgaben/+page.svelte     # Task-Management (NEU)
├── nachunternehmer/+page.svelte # NU-Verwaltung (NEU)
├── bestellung/+page.svelte
├── bestellungen/
│   ├── +page.svelte
│   └── [id]/+page.svelte
└── lv-export/+page.svelte
```

---

## Nächster Schritt

→ **Nachweis-Trigger:** Automatische Ausführung bei neuen ER-NU-S Dokumenten
→ **S3-Migration:** 447 Legacy-PDFs von S3 nach Supabase Storage migrieren
→ **E-Mail Phase 2:** Cron-Jobs aktivieren (email-fetch alle 10 Min, email-process alle 15 Min)
→ **Embeddings:** document_summaries mit vector(1536) erweitern für RAG
→ Kundenportal-Seiten: /angebote, /ansprechpartner, /rechnungen

---

## Letzte Session (2026-01-28 ~23:00)

**Hero-Sync Beträge-Bug-Fix + Wiederherstellung:**
- **Bug-Fix:** `hero-document-sync` v13 - Beträge werden nur gesetzt wenn Hero Werte hat
- **Problem:** `const netto = doc.value || 0;` überschrieb existierende Werte mit 0
- **Wiederherstellung:** 11 Dokumente aus Softr-Backup (~142.578 € netto)
  - NUA-355, NUA-357, NUA-358, NUA-359, NUA-363, NUA-364, NUA-365, NUA-366
  - 2100021040, R-00156, R-00173
- **Backup:** `docs/softr_amounts_backup.json` (2.515 Dokumente mit Beträgen)
- **Vergleich:** ER-*/AR-*/RE-* stimmen zwischen Softr und Supabase überein
  - Differenz nur durch Datumsfilter (`date >= '2025-01-01'`) in hero-document-sync

**Cron-Job Status:**
- `hero-document-sync`: `*/5 6-19 * * *` (alle 5 Min, nur 6-19 Uhr)
- Status: aktiv, läuft automatisch tagsüber

---

## Vorherige Session (2026-01-28 ~22:00)

**Schlussrechnung-Nachweis-Check Edge Function:**
- **Edge Function:** `schlussrechnung-nachweis-check` v14 deployed
- **Funktion:** Prüft bei NU-Schlussrechnungen (ER-NU-S) ob Nachweise fehlen
- **Nachweise:** Rohinstallation Elektrik, Rohinstallation Sanitär, Abdichtung Bad, E-Check Protokoll
- **Features:**
  - Automatische E-Mail an NU mit personalisierter Anrede
  - 2-Werktage-Deadline mit roter Warnung
  - Test-Modus für sichere Entwicklung
- **Test erfolgreich:** 2 E-Mails für ATBS-445 und ATBS-447 gesendet
- **email-send v15:** Mit verify_jwt: false für interne Calls

**Gelöste technische Probleme:**
- Supabase Client JSONB-Filter funktioniert nicht → Manuelles Filtern
- PostgREST LIKE-Syntax: %25 statt *
- Edge Function zu Edge Function: verify_jwt: false nötig

---

## Vorherige Session (2026-01-28 ~21:00)

**Beträge-Wiederherstellung & Bug-Fix:**
- **Root Cause:** `hero-document-sync` überschrieb existierende Netto/Brutto-Werte mit 0 wenn Hero keinen Wert hatte
- **Bug-Fix:** `upsertToSupabase()` aktualisiert - Beträge werden nur noch gesetzt wenn Hero tatsächlich Werte hat
- **Wiederherstellung:** 11 Dokumente aus Softr-Backup wiederhergestellt (~159.000 € Gesamtwert)
  - NUA-355 bis NUA-366 (8 Nachunternehmer-Aufträge)
  - 2100021040, R-00156, R-00173 (3 Rechnungen)
- **Analyse-Scripts:** `scripts/compare_and_restore.mjs`, `docs/softr_amounts_backup.json` (2.515 Dokumente)
- **Erkenntnis:** Die meisten Dokumente mit 0/NULL-Werten sind korrekt (E-Mails, Aufmaße, etc. haben keine Beträge)

---

## Vorherige Session (2026-01-28 ~18:30)

**Hero PDF-Sync - Vollständige Migration:**
- `hero-document-sync` v11: temporary_url zur GraphQL-Query hinzugefügt
- `hero-pdf-sync` v4: Filename-Sanitization für Umlaute/Sonderzeichen
- **653 PDFs** von Hero → Supabase Storage migriert (100% Erfolg)
- **686 PDFs** total in Supabase Storage
- 447 S3-Legacy-PDFs noch zu migrieren

---

## Vorherige Session (2026-01-28 ~16:00)

**E-Mail-Integration Phase 1 - FERTIG:**
- `email-fetch` Edge Function v4: Holt E-Mails von MS365 Graph API
- `email-process` Edge Function: Matching-Kaskade (Domain, ATBS, Postfach)
- **50 E-Mails** importiert aus 5 Postfächern
- **27 Anhänge** in Supabase Storage hochgeladen
- Neue Tabellen: `email_details`, `email_accounts`, `kontakt_domains`, `email_sync_log`
- Fixes: UNIQUE-Constraint mit COALESCE, Storage-Pfad-Sanitization, Graph API contentBytes

**Postfächer aktiv:**
- holger.neumann@, service@, rechnungen@, bewerbungen@, kontakt@ @neurealis.de

**Vorherige Session (~11:00):**
- `hero-document-sync` v10: 651 Dokumente synchronisiert
- `monday-push` Edge Function (NEU): Pusht nach Monday.com

**Vorherige Session (~09:00):**
- Hero Webhook-Recherche: Keine native Webhook-API (nur Polling)
- Cron optimiert: `*/5 6-19 * * *` (alle 5 Min, nur tagsüber)

**Vorherige Session (~04:15):**
- `softr_dokumente` + `dokumente` → einheitliche Tabelle (1.835 Docs)
- 642 PDFs von Hero → Supabase Storage synchronisiert
- Edge Functions: `classify-pdf`, `summarize-document`, `hero-pdf-sync`

**Vorherige Session (VBW LV 2026):**
- VBW Entscheidungsgrundlage HTML + PDF erstellt
- Preisvergleich 2023 vs. 2026 mit GWS-Referenzpreisen
- Leerstandskosten-Berechnung: 357.000 €/Jahr bei 3 Wochen Verzögerung

**PDF-Generator (global nutzbar):**
- Puppeteer-basierte HTML→PDF Konvertierung
- Templates für Rechnungen und Angebote
- neurealis Corporate Design integriert
- Pfad: `C:\Users\holge\shared\lib\pdf-generator.mjs`

**Verwendung:**
```javascript
import { generateInvoice, generateQuote, generatePDFFromHTML } from 'C:/Users/holge/shared/lib/pdf-generator.mjs';

await generateInvoice({ rechnungsnummer: 'RE-2026-001', kunde: {...}, positionen: [...] }, 'rechnung.pdf');
await generateQuote({ angebotsnummer: 'ANG-2026-001', ... }, 'angebot.pdf');
await generatePDFFromHTML('<h1>Dokument</h1>', 'output.pdf');
```

**CLI:**
```bash
node C:\Users\holge\shared\lib\pdf-generator.mjs input.html output.pdf
```

---

## Session davor (2026-01-27)

**Einkauf-Erweiterung & Sidebar-Restructuring:**
- Sidebar: Einkauf als aufklappbares Untermenü (Übersicht, Bestellung, Bestellungen, LV-Export)
- LV-Export: Kunden-LV Auswahl mit farbigen Badges (GWS, VBW, Covivio, neurealis)
- Design auf eckig (border-radius: 0) umgestellt für Softr-Rot Look
- pgvector Similarity-Suche für LV-Positionen (3.057 mit Embeddings)
- Edge Function `search-lv` deployed für semantische KI-Suche
- Einkauf-UI: Text/KI-Suche Toggle für LV-Positionen

**Neue SQL-Funktion:**
```sql
search_lv_positions(query_embedding, match_count, filter_lv_typ, filter_gewerk)
```

**Neue Edge Function:**
- `search-lv` - Nimmt Suchanfrage, generiert Embedding, findet ähnliche LV-Positionen

---

## Session davor (2026-01-28)

**BV-Übersicht Redesign:**
- Phasen-Tabs (0-6) mit Anzahl-Badges
- Phasenspezifische Tabellenspalten wie in Softr-Original
- Suchfeld über alle Projekte
- Mobile Cards-Ansicht
- Mängel/Nachträge-Badges in Tabelle

---

*Aktualisiert: 2026-01-28 23:00*
