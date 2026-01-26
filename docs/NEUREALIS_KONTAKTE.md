# Kontaktmanagement System

**Version:** 2.1
**Erstellt:** 2026-01-26
**Aktualisiert:** 2026-01-26
**Status:** Implementiert (Bidirektionaler Sync + Duplikat-Bereinigung)

---

## Übersicht

Das Kontaktmanagement nutzt **Supabase als Master** mit bidirektionalem Sync zu allen externen Systemen:

```
                    ┌─────────────────────────────────┐
                    │      SUPABASE (MASTER)          │
                    │   kontakte + sync_log           │
                    │                                 │
                    │  ┌───────────────────────────┐  │
                    │  │  DB-Trigger (SOFORT)      │  │
                    │  │  bei INSERT/UPDATE        │  │
                    │  └─────────────┬─────────────┘  │
                    └───────────────┬┼────────────────┘
                                    ││
           ┌────────────────────────┼┼────────────────────────┐
           │                        ││                        │
           ▼                        ▼▼                        ▼
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │   Monday    │◄────────►│   MS 365    │◄────────►│  Softr.io   │
    │  (MA/NU/LF) │          │ (Kontakte)  │          │    (UI)     │
    └─────────────┘          └─────────────┘          └─────────────┘
           ▲                        ▲                        ▲
           │                        │                        │
    Inbound: 04:00           Inbound: 03:00          Inbound: Manuell

    ┌─────────────┐
    │    Hero     │─────────► Inbound: 02:00
    │  (Kunden)   │
    └─────────────┘
```

### Sync-Architektur

| Richtung | Trigger | Zeitpunkt |
|----------|---------|-----------|
| **Outbound** (Supabase → extern) | DB-Trigger | **Sofort** bei Änderung |
| **Inbound** (extern → Supabase) | Cron-Job | Täglich (02:00-04:00) |
| **AutoMerge** | Cron-Job | Täglich 05:00 |

---

## Tabellenstruktur

### 1. `kontakte` (Haupttabelle)

Die zentrale Kontakttabelle mit allen Stammdaten.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primary Key |
| `kontakt_nr` | SERIAL | Interne Nummer (K-0001) |
| `aktiv` | BOOLEAN | Soft-Delete Flag |
| `parent_kontakt_id` | UUID | Firma für Ansprechpartner |
| `kontaktarten` | TEXT[] | Mehrfachauswahl (siehe unten) |
| `anrede` | TEXT | Herr, Frau, Firma, Familie, EG |
| `titel` | TEXT | Dr., Prof., etc. |
| `vorname` | TEXT | - |
| `nachname` | TEXT | - |
| `firma_kurz` | TEXT | Kurzname |
| `firma_lang` | TEXT | Vollständiger Name |
| `position` | TEXT | Jobtitel |
| `email` | TEXT | Primäre E-Mail |
| `telefon_mobil` | TEXT | Handynummer |
| `telefon_festnetz` | TEXT | Festnetz |
| `strasse` | TEXT | Straße + Hausnr. |
| `plz` | TEXT | Postleitzahl |
| `ort` | TEXT | Stadt |
| `iban` | TEXT | Bankverbindung |
| `bic` | TEXT | - |
| `kontoinhaber` | TEXT | - |
| `hero_id` | INTEGER | Hero Software ID (unique) |
| `monday_mitarbeiter_id` | TEXT | Monday Board ID |
| `monday_sub_id` | TEXT | Monday Board ID |
| `monday_lieferant_id` | TEXT | Monday Board ID |
| `ms365_contact_id` | TEXT | Graph API ID |
| `visibility` | TEXT | company, private, team |
| `owner_email` | TEXT | Bei private: Besitzer |
| `compliance_docs` | JSONB | §13b, §48, Versicherung |
| `sync_source` | TEXT | Letzte Sync-Quelle |
| `sync_mailbox` | TEXT | MS365 Postfach |
| `last_synced_at` | TIMESTAMPTZ | Letzte Synchronisierung (Inbound) |
| `last_local_update` | TIMESTAMPTZ | Letzte lokale Änderung (für Push-Trigger) |

#### Kontaktarten

| Wert | Beschreibung |
|------|--------------|
| `kunde_privat` | Privatkunde |
| `kunde_gewerblich` | Gewerbekunde |
| `lead` | Interessent |
| `mitarbeiter` | Interner Mitarbeiter |
| `mitarbeiter_baustelle` | Baustellen-Mitarbeiter |
| `bewerber` | Jobbewerber |
| `nachunternehmer` | Subunternehmer |
| `nu_mitarbeiter` | Mitarbeiter eines NU |
| `partner` | Geschäftspartner |
| `lieferant` | Großhändler, Hersteller |
| `ansprechpartner` | Ansprechpartner bei Firma |
| `eigentuemer` | Immobilien-Eigentümer |
| `hausverwaltung` | Hausverwaltung |
| `behoerde` | Behörde, Amt |

### 2. `adressen` (Mehrere Adressen pro Kontakt)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primary Key |
| `kontakt_id` | UUID | FK → kontakte |
| `adresstyp` | TEXT | rechnung, lieferung, bauvorhaben |
| `strasse` | TEXT | - |
| `plz` | TEXT | - |
| `ort` | TEXT | - |
| `ist_hauptadresse` | BOOLEAN | - |
| `projekt_id` | UUID | Bei Bauvorhaben-Adressen |

### 3. `kontakte_lieferanten` (Erweiterung)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `kontakt_id` | UUID | FK → kontakte (1:1) |
| `lieferanten_typ` | TEXT | grosshandel, hersteller |
| `sortiment` | TEXT[] | sanitaer, heizung, elektro |
| `rabatt_prozent` | NUMERIC | Unser Rabatt |
| `mindestbestellwert` | NUMERIC | - |
| `shop_url` | TEXT | Online-Shop |

### 4. `kontakte_nachunternehmer` (Erweiterung)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `kontakt_id` | UUID | FK → kontakte (1:1) |
| `gewerke` | TEXT[] | sanitaer, heizung, maler |
| `hauptgewerk` | TEXT | Primäres Gewerk |
| `compliance_status` | TEXT | vollstaendig, unvollstaendig |
| `stundensatz_geselle` | NUMERIC | €/Stunde |
| `stundensatz_meister` | NUMERIC | €/Stunde |
| `bewertung_qualitaet` | INTEGER | 1-5 Sterne |
| `bewertung_termintreue` | INTEGER | 1-5 Sterne |

### 5. `kontakte_sync_log` (Audit)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | SERIAL | Primary Key |
| `source` | TEXT | hero, monday, ms365, manual |
| `action` | TEXT | created, updated, merged, error |
| `kontakt_id` | UUID | FK → kontakte |
| `external_id` | TEXT | ID in Quellsystem |
| `details` | JSONB | Zusätzliche Infos |
| `error_message` | TEXT | Bei Fehlern |
| `synced_at` | TIMESTAMPTZ | Zeitstempel |

---

## Edge Functions

### Outbound (Push zu externen Systemen)

#### `kontakte-push` (NEU)

**Trigger:** DB-Trigger bei INSERT/UPDATE auf `kontakte`
**Ziele:** Monday.com, MS365, Softr.io

Die zentrale Push-Function wird automatisch vom DB-Trigger aufgerufen und synchronisiert Änderungen sofort zu allen verbundenen Systemen.

```bash
# Manueller Test-Aufruf
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-push \
  -H "Content-Type: application/json" \
  -d '{"kontakt_id": "uuid-hier", "targets": ["monday", "ms365", "softr"]}'
```

**Logik:**
- Pusht zu Monday wenn `monday_*_id` vorhanden oder Kontaktart = mitarbeiter/nachunternehmer/lieferant
- Pusht zu MS365 wenn `ms365_contact_id` vorhanden
- Pusht zu Softr wenn `softr_record_id` vorhanden
- Erstellt neue Einträge in externen Systemen wenn noch keine ID vorhanden

**DB-Trigger:**
```sql
-- Trigger wird bei INSERT/UPDATE automatisch ausgelöst
-- Ignoriert reine Sync-Updates (verhindert Loops)
CREATE TRIGGER trg_kontakte_push
  BEFORE INSERT OR UPDATE ON kontakte
  FOR EACH ROW
  EXECUTE FUNCTION kontakte_push_trigger();
```

#### `kontakte-auto-merge` (NEU)

**Trigger:** Cron (täglich 05:00) oder manuell
**Schwellwert:** 0.8 (konfigurierbar)

```bash
# Standard (Threshold 0.8)
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-auto-merge

# Mit angepasstem Threshold
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-auto-merge?threshold=0.9"
```

**Schwellwerte:**
| Match-Typ | Confidence | Aktion |
|-----------|------------|--------|
| Email | 1.0 | Auto-Merge |
| Firma + PLZ | 0.8 | Auto-Merge |
| Name + PLZ | 0.7 | Manueller Review |

---

### Inbound (Import von externen Systemen)

#### `kontakte-sync-hero`

**Trigger:** Cron (täglich 02:00) oder manuell
**Quelle:** Hero Software GraphQL API

```bash
# Manueller Aufruf
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero
```

**Mapping:**
- Hero `type` → `kontaktarten`
- Hero `category_name` → zusätzliche `kontaktarten`
- Duplikat-Erkennung via Email-Match

#### `kontakte-sync-monday`

**Trigger:** Cron (täglich 04:00) oder manuell
**Boards:**
- `1828539808` - Mitarbeiter
- `1545125471` - Subunternehmer
- `1547308184` - Lieferanten

```bash
# Alle Boards
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday

# Nur ein Board
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday?board=mitarbeiter"
```

**Features:**
- Hero-ID Matching (bei Mitarbeitern)
- Compliance-Docs aus Monday-Spalten
- Erweiterungstabellen automatisch befüllt

#### `kontakte-sync-ms365`

**Trigger:** Cron (täglich 03:00) oder manuell
**Postfächer:**

| Postfach | Visibility | Owner | Hinweis |
|----------|------------|-------|---------|
| holger.neumann@neurealis.de | private | holger.neumann@... | Persönliche Kontakte |
| service@neurealis.de | company | - | Firmen-Kontakte (kontakt@ ist Alias) |

```bash
# Alle Postfächer
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365

# Nur ein Postfach
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365?mailbox=holger.neumann@neurealis.de"
```

**Sichtbarkeits-Logik:**
- `private`: Nur für Owner sichtbar
- `company`: Für alle Mitarbeiter sichtbar

---

## RPC Functions

### `kontakte_find_duplicates()`

Findet potenzielle Duplikate:

```sql
SELECT * FROM kontakte_find_duplicates();
```

| match_type | confidence | Beschreibung |
|------------|------------|--------------|
| email | 1.0 | Exakter Email-Match |
| firma_plz | 0.8 | Firma + PLZ gleich |
| name_plz | 0.7 | Vorname + Nachname + PLZ |

### `kontakte_visible_for(user_email)`

Gibt alle für einen User sichtbaren Kontakte zurück:

```sql
SELECT * FROM kontakte_visible_for('holger.neumann@neurealis.de');
```

### `kontakte_merge(primary_id, secondary_id)`

Führt zwei Kontakte zusammen:

```sql
SELECT kontakte_merge(
  'uuid-primary',
  'uuid-secondary'
);
```

- Primary behält alle Daten
- Felder von Secondary werden übernommen wenn Primary leer
- Kontaktarten werden vereinigt
- Adressen und Kind-Kontakte werden zu Primary verschoben
- Secondary wird deaktiviert (nicht gelöscht)
- Sync-Log Eintrag wird erstellt

### `kontakte_auto_merge(confidence_threshold)` (NEU)

Führt automatisch alle Duplikate mit Confidence >= Schwellwert zusammen:

```sql
-- Standard (Threshold 0.8)
SELECT * FROM kontakte_auto_merge(0.8);

-- Ergebnis:
-- merged_count | skipped_count | error_count | details
-- 3            | 1             | 0           | [{"action": "merged", ...}]
```

**Ablauf:**
1. Findet alle Duplikate über dem Schwellwert
2. Wählt den älteren Kontakt (niedrigere kontakt_nr) als Primary
3. Führt Merge für jedes Paar durch
4. Überspringt bereits verarbeitete Kontakte
5. Loggt Batch-Run in `kontakte_sync_log`

### `kontakte_statistiken()`

Gibt Anzahl pro Kontaktart zurück:

```sql
SELECT * FROM kontakte_statistiken();
```

---

## Views

### `v_kontakte_aktiv`

Alle aktiven Kontakte mit:
- `anzeigename` (Firma oder "Anrede Titel Vorname Nachname")
- `kontakt_nr_formatiert` (K-0001)
- `parent_firma` (bei Ansprechpartnern)
- `anzahl_ansprechpartner` (bei Firmen)
- Lieferanten/Nachunternehmer-Erweiterungsdaten

```sql
SELECT * FROM v_kontakte_aktiv WHERE 'nachunternehmer' = ANY(kontaktarten);
```

---

## Compliance-Dokumente

Für Nachunternehmer werden Compliance-Dokumente in `kontakte.compliance_docs` gespeichert:

```json
{
  "§13b": {
    "status": "gültig",
    "gueltig_bis": "2026-12-31",
    "supabase_path": "compliance-docs/firma-abc/13b.pdf",
    "onedrive_url": "https://..."
  },
  "§48": {
    "status": "gültig",
    "gueltig_bis": "2026-06-30"
  },
  "versicherung": {
    "status": "abgelaufen",
    "gueltig_bis": "2025-12-31"
  }
}
```

**Status-Werte:**
- `gültig` - Dokument vorhanden und nicht abgelaufen
- `abgelaufen` - Gültigkeitsdatum überschritten
- `fehlt` - Kein Dokument vorhanden

---

## Implementierte Dateien

| Datei | Beschreibung |
|-------|--------------|
| **Migrationen** | |
| `20260126103532_kontakte_system` | Basis-Tabellen (kontakte, adressen) |
| `20260126103551_kontakte_erweiterungen` | Erweiterungstabellen (lieferanten, nachunternehmer) |
| `20260126103618_kontakte_functions_views` | RPC Functions und Views |
| `20260126*_kontakte_push_trigger` | Trigger für automatischen Push |
| `20260126*_auto_merge` | AutoMerge Funktion |
| **Edge Functions (Inbound)** | |
| `kontakte-sync-hero/index.ts` | Hero Software Sync |
| `kontakte-sync-monday/index.ts` | Monday.com Sync (3 Boards) |
| `kontakte-sync-ms365/index.ts` | Microsoft 365 Kontakte Sync |
| **Edge Functions (Outbound/Neu)** | |
| `kontakte-push/index.ts` | **Zentraler Push zu Monday/MS365/Softr** |
| `kontakte-auto-merge/index.ts` | **AutoMerge Wrapper** |

---

## Secrets (Supabase)

| Secret | Verwendung |
|--------|------------|
| `HERO_API_KEY` | Hero Software API |
| `MONDAY_API_KEY` | Monday.com API |
| `MS365_TENANT_ID` | Microsoft Graph |
| `MS365_CLIENT_ID` | Microsoft Graph |
| `MS365_CLIENT_SECRET` | Microsoft Graph |

---

## Migration

### Phase 1: Tabellen erstellen

```bash
# SQL-Migration im Supabase Dashboard ausführen
# Oder via psql:
psql $DATABASE_URL < functions/migrations/003_kontakte_system.sql
```

### Phase 2: Hero-Import

```bash
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero
```

### Phase 3: Monday-Import

```bash
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday
```

### Phase 4: Duplikat-Review

```sql
SELECT
  k1.id, k1.firma_kurz, k1.email,
  k2.id, k2.firma_kurz, k2.email,
  d.match_type, d.confidence
FROM kontakte_find_duplicates() d
JOIN kontakte k1 ON d.kontakt_id = k1.id
JOIN kontakte k2 ON d.potential_duplicate_id = k2.id
ORDER BY d.confidence DESC;
```

### Phase 5: MS365-Import (optional)

```bash
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365
```

---

## Cron-Jobs (pg_cron)

```sql
-- Hero Inbound: Täglich um 02:00
SELECT cron.schedule('kontakte-sync-hero', '0 2 * * *',
  $$SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb, timeout_milliseconds := 120000
  )$$
);

-- MS365 Inbound: Täglich um 03:00
SELECT cron.schedule('kontakte-sync-ms365', '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb, timeout_milliseconds := 120000
  )$$
);

-- Monday Inbound: Täglich um 04:00 (geändert von alle 30 Min)
SELECT cron.schedule('kontakte-sync-monday', '0 4 * * *',
  $$SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb, timeout_milliseconds := 120000
  )$$
);

-- AutoMerge: Täglich um 05:00
SELECT cron.schedule('kontakte-auto-merge', '0 5 * * *',
  $$SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-auto-merge',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"threshold": 0.8}'::jsonb, timeout_milliseconds := 60000
  )$$
);
```

### Sync-Zeitplan

| Zeit | Job | Beschreibung |
|------|-----|--------------|
| 02:00 | Hero Inbound | Kunden aus Hero importieren |
| 03:00 | MS365 Inbound | Kontakte aus Outlook importieren |
| 04:00 | Monday Inbound | MA/NU/Lieferanten aus Monday |
| 05:00 | AutoMerge | Duplikate automatisch zusammenführen |
| **Sofort** | Push-Trigger | Bei Änderung → Monday/MS365/Softr |

---

## Softr Integration

Die Kontakte-Tabelle kann direkt in Softr eingebunden werden:

1. **Neue Datenquelle:** Supabase → `kontakte` Tabelle
2. **Filter:** `aktiv = true`
3. **Sichtbarkeit:** RLS oder View `v_kontakte_aktiv`

**Kontakt-Formular Felder:**
- Kontaktart (Mehrfachauswahl)
- Anrede, Titel, Vorname, Nachname
- Firma
- Email, Telefon
- Adresse
- Notizen

---

## Verifizierung

### Basis-Checks

```sql
-- Gesamtzahl prüfen
SELECT COUNT(*) FROM kontakte WHERE aktiv = true;

-- Verteilung nach Quelle
SELECT sync_source, COUNT(*) FROM kontakte GROUP BY sync_source;

-- Verteilung nach Kontaktart
SELECT unnest(kontaktarten) AS art, COUNT(*)
FROM kontakte WHERE aktiv = true
GROUP BY art ORDER BY 2 DESC;
```

### Sync-Monitoring

```sql
-- Sync-Log der letzten 24h
SELECT source, action, direction, COUNT(*)
FROM kontakte_sync_log
WHERE synced_at > NOW() - INTERVAL '24 hours'
GROUP BY source, action, direction
ORDER BY COUNT(*) DESC;

-- Outbound Push-Log (Trigger-basiert)
SELECT * FROM kontakte_sync_log
WHERE direction = 'outbound'
ORDER BY synced_at DESC LIMIT 10;

-- Letzte AutoMerge-Läufe
SELECT * FROM kontakte_sync_log
WHERE source = 'auto_merge'
ORDER BY synced_at DESC LIMIT 5;
```

### Duplikat-Analyse

```sql
-- Alle Duplikate finden
SELECT * FROM kontakte_find_duplicates();

-- Nur Auto-Merge fähige (confidence >= 0.8)
SELECT * FROM kontakte_find_duplicates() WHERE confidence >= 0.8;

-- AutoMerge Dry-Run (ohne tatsächlichen Merge)
SELECT
  k1.kontakt_nr, k1.firma_kurz, k1.email,
  k2.kontakt_nr, k2.firma_kurz, k2.email,
  d.match_type, d.confidence
FROM kontakte_find_duplicates() d
JOIN kontakte k1 ON d.kontakt_id = k1.id
JOIN kontakte k2 ON d.potential_duplicate_id = k2.id
WHERE d.confidence >= 0.8
ORDER BY d.confidence DESC;
```

### Push-Trigger testen

```sql
-- pg_net Extension prüfen
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Trigger prüfen
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_kontakte_push';

-- Manueller Push-Test (nach Kontakt-Update)
UPDATE kontakte SET notizen = 'Test ' || NOW() WHERE id = 'uuid-hier';

-- Push-Log prüfen
SELECT * FROM kontakte_sync_log
WHERE source = 'trigger_push'
ORDER BY synced_at DESC LIMIT 5;
```

### Cron-Jobs prüfen

```sql
-- Alle Kontakte-Jobs
SELECT jobid, jobname, schedule
FROM cron.job
WHERE jobname LIKE 'kontakte%'
ORDER BY schedule;

-- Letzte Ausführungen
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'kontakte%')
ORDER BY start_time DESC LIMIT 10;
```

---

## Konflikt-Lösung

**Strategie:** Supabase gewinnt (Master)

| Szenario | Lösung |
|----------|--------|
| Änderung in Supabase | → Push zu externen Systemen (sofort) |
| Änderung extern | → Inbound-Sync überschreibt nur wenn `updated_at > last_synced_at` |
| Echter Konflikt | → Sync-Log Status = `conflict` für manuellen Review |

---

*Dokumentation aktualisiert am 2026-01-26 (v2.0 - Bidirektionaler Sync)*
