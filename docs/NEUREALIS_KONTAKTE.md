# Kontaktmanagement System

**Version:** 1.0
**Erstellt:** 2026-01-26
**Status:** Implementiert

---

## Übersicht

Das Kontaktmanagement konsolidiert alle Kontaktdaten aus verschiedenen Quellen in Supabase als Single Source of Truth:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Hero      │     │  Monday.com │     │   MS 365    │
│  (Kunden)   │     │ (MA/NU/Lief)│     │ (Postfächer)│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    ┌──────────────┴───────────────┐   │
       └────►     SUPABASE (MASTER)        ◄───┘
             │    kontakte + sync_log      │
             └──────────────┬──────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ Softr.io │  │ Projekte │
              │   (UI)   │  │   (FK)   │
              └──────────┘  └──────────┘
```

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
| `last_synced_at` | TIMESTAMPTZ | Letzte Synchronisierung |

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

### `kontakte-sync-hero`

**Trigger:** Cron (täglich) oder manuell
**Quelle:** Hero Software GraphQL API

```bash
# Manueller Aufruf
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero
```

**Mapping:**
- Hero `type` → `kontaktarten`
- Hero `category_name` → zusätzliche `kontaktarten`
- Duplikat-Erkennung via Email-Match

### `kontakte-sync-monday`

**Trigger:** Cron (alle 30 Min) oder manuell
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

### `kontakte-sync-ms365`

**Trigger:** Cron (täglich) oder manuell
**Postfächer:**

| Postfach | Visibility | Owner |
|----------|------------|-------|
| holger.neumann@neurealis.de | private | holger.neumann@... |
| kontakt@neurealis.de | company | - |
| service@neurealis.de | company | - |

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
- Secondary wird deaktiviert (nicht gelöscht)

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
| `functions/migrations/003_kontakte_system.sql` | SQL-Migration für alle Tabellen |
| `functions/supabase/functions/kontakte-sync-hero/index.ts` | Hero Software Sync |
| `functions/supabase/functions/kontakte-sync-monday/index.ts` | Monday.com Sync (3 Boards) |
| `functions/supabase/functions/kontakte-sync-ms365/index.ts` | Microsoft 365 Kontakte Sync |

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
-- Hero: Täglich um 02:00
SELECT cron.schedule('kontakte-sync-hero', '0 2 * * *',
  $$SELECT net.http_get('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero')$$
);

-- Monday: Alle 30 Minuten
SELECT cron.schedule('kontakte-sync-monday', '*/30 * * * *',
  $$SELECT net.http_get('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday')$$
);

-- MS365: Täglich um 03:00
SELECT cron.schedule('kontakte-sync-ms365', '0 3 * * *',
  $$SELECT net.http_get('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365')$$
);
```

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

```sql
-- Gesamtzahl prüfen
SELECT COUNT(*) FROM kontakte WHERE aktiv = true;

-- Verteilung nach Quelle
SELECT sync_source, COUNT(*) FROM kontakte GROUP BY sync_source;

-- Verteilung nach Kontaktart
SELECT unnest(kontaktarten) AS art, COUNT(*)
FROM kontakte WHERE aktiv = true
GROUP BY art ORDER BY 2 DESC;

-- Sync-Log der letzten 24h
SELECT source, action, COUNT(*)
FROM kontakte_sync_log
WHERE synced_at > NOW() - INTERVAL '24 hours'
GROUP BY source, action;

-- Duplikate prüfen
SELECT COUNT(*) FROM kontakte_find_duplicates();
```

---

*Dokumentation aktualisiert am 2026-01-26*
