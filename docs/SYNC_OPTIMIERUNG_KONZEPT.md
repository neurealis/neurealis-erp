# Sync-Optimierung Konzept - neurealis ERP

**Erstellt:** 2026-02-01
**Version:** 1.0
**Status:** Genehmigt - Implementierung geplant

---

## Executive Summary

### Ziele

1. **Echtzeitnähe verbessern:** Supabase-Änderungen werden sofort gepusht (Trigger-basiert)
2. **Bidirektionaler Softr-Sync:** Alle 16 Tabellen Last-Write-Wins statt nur Supabase→Softr
3. **Monday Status-Mapping:** 64 Status-Spalten mit Label-Mapping synchronisieren
4. **Kontakt-Automatisierung:** Rollen-basierte Zuweisung mit manueller Überschreibung
5. **E-Mail-Intelligence:** Auto-Matching mit Review-Queue für unsichere Matches
6. **WordPress-Content:** Portfolio + Services + regionale Landingpages via Elementor

### Scope

| System | Sync-Richtung | Mechanismus | Priorität |
|--------|---------------|-------------|-----------|
| SharePoint | → Supabase | Debugging Token-Problem | P1 (Blocker) |
| Softr ↔ Supabase | Bidirektional | Last-Write-Wins | P1 |
| Monday ↔ Supabase | Bidirektional | Label-Mapping | P1 |
| Kontakte | Auto-Zuweisung | Rollen-basiert | P2 |
| E-Mails | Auto-Match | Confidence-basiert | P2 |
| WordPress | ← Supabase | Elementor Templates | P3 |
| Hero LV | Status quo | Keine Erweiterung | - |

### Grundprinzip

```
╔═══════════════════════════════════════════════════════════════╗
║  SYNC-PHILOSOPHIE                                             ║
║                                                               ║
║  Supabase-Änderung  →  SOFORT per DB-Trigger pushen           ║
║  Externe Systeme    →  Regelmäßiger Cron Pull (5/15 Min)      ║
║                                                               ║
║  Konflikte: Last-Write-Wins (neuester Timestamp gewinnt)      ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Architektur-Übersicht

### Aktuelle vs. Neue Architektur

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                        AKTUELLE ARCHITEKTUR                               ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌─────────┐      Cron 5min       ┌────────────┐                          ║
║  │ Monday  │ ────────────────────▶│            │                          ║
║  └─────────┘                      │            │      Trigger             ║
║                                   │  SUPABASE  │ ─────────────▶ Monday    ║
║  ┌─────────┐      Cron 5min       │            │                          ║
║  │  Softr  │ ────────────────────▶│            │                          ║
║  └─────────┘                      │            │      Trigger             ║
║       ▲                           │            │ ─────────────▶ Softr (!) ║
║       │                           └────────────┘                          ║
║       │      Push nur auf                                                 ║
║       └───── Teilbereiche (LV)                                            ║
║                                                                           ║
║  ❌ Problem: Softr→Supabase nur 12 von 16 Tabellen                        ║
║  ❌ Problem: Supabase→Softr nur für LV-Positionen, nicht für Stammdaten   ║
║  ❌ Problem: Monday Status-Labels nicht zurück-synchronisiert             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║                         NEUE ARCHITEKTUR                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌─────────┐      Cron 5min       ┌────────────┐      Trigger (sofort)   ║
║  │ Monday  │ ◀───────────────────▶│            │◀─────────────────────▶   ║
║  └─────────┘   + Label-Mapping    │            │                          ║
║                                   │  SUPABASE  │      (17 sichere Felder) ║
║  ┌─────────┐      Cron 5min       │   (SoT)    │                          ║
║  │  Softr  │ ◀───────────────────▶│            │      Trigger (sofort)   ║
║  └─────────┘   Last-Write-Wins    │            │◀─────────────────────▶   ║
║                (16 Tabellen!)     └────────────┘   (alle 16 Tabellen)     ║
║                                         │                                 ║
║  ┌─────────┐      Fix Tokens            │                                 ║
║  │SharePnt │ ◀──────────────────────────┤                                 ║
║  └─────────┘                            │                                 ║
║                                         ▼                                 ║
║  ┌─────────┐      Elementor API   ┌────────────┐                          ║
║  │WordPress│ ◀────────────────────│  Content   │                          ║
║  └─────────┘   (Portfolio, SEO)   │ Generator  │                          ║
║                                   └────────────┘                          ║
║                                                                           ║
║  ✅ Alle 16 Softr-Tabellen bidirektional                                  ║
║  ✅ Monday Status-Labels mit Mapping                                      ║
║  ✅ Trigger-basierter Push (< 2 Sekunden)                                 ║
║  ✅ SharePoint wieder funktionsfähig                                      ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Detaillierter Datenfluss

```
                    ┌─────────────────────────────────────────┐
                    │            SUPABASE (SoT)               │
                    │                                         │
                    │  ┌─────────────────────────────────┐   │
                    │  │  DB-Trigger bei UPDATE/INSERT   │   │
                    │  │  • trg_monday_push (aktiv)      │   │
                    │  │  • trg_softr_push (NEU)         │   │
                    │  │  • trg_sharepoint_push (geplant)│   │
                    │  └─────────────────────────────────┘   │
                    │                  │                      │
                    └──────────────────┼──────────────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
    ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
    │  MONDAY.COM │            │  SOFTR.IO   │            │ SHAREPOINT  │
    │             │            │             │            │             │
    │ 193 Items   │            │ 16 Tabellen │            │ Dokumente   │
    │ 338 Spalten │            │ 725+ Felder │            │ 910 Dateien │
    └─────────────┘            └─────────────┘            └─────────────┘
           │                           │                           │
           │ Cron 5min                 │ Cron 5min                 │ Cron 15min
           ▼                           ▼                           ▼
    ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
    │monday-sync  │            │ softr-sync  │            │sharepoint-  │
    │   (Pull)    │            │   (Pull)    │            │   sync      │
    └─────────────┘            └─────────────┘            └─────────────┘
```

---

## Implementierungsplan

### 1. SharePoint: Debugging Token-Problem (P1)

**Status:** Blockiert - Credentials aktuell, Admin Consent erteilt

**Problem-Analyse:**

Das Token-Problem liegt NICHT an abgelaufenen Credentials. Mögliche Ursachen:

| Symptom | Mögliche Ursache | Debugging-Schritt |
|---------|------------------|-------------------|
| Token-Request fehlschlägt | Falscher Scope | Prüfen: `https://graph.microsoft.com/.default` |
| 401 Unauthorized | App-Registrierung | Azure Portal → App registrations prüfen |
| 403 Forbidden | Fehlende Permissions | API Permissions → Admin consent status |
| CORS-Fehler | Edge Function Konfiguration | Response Headers prüfen |

**Debugging-Schritte:**

```typescript
// 1. Token-Request isoliert testen
const debugSharepointAuth = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  console.log('1. Requesting token...');
  console.log('   Tenant:', TENANT_ID);
  console.log('   Client:', CLIENT_ID);
  console.log('   Scope:', 'https://graph.microsoft.com/.default');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
      })
    });

    console.log('2. Response status:', response.status);
    const data = await response.json();

    if (data.access_token) {
      console.log('3. Token obtained! Length:', data.access_token.length);
      console.log('   Expires in:', data.expires_in, 'seconds');

      // 4. Test Graph API Call
      const testResponse = await fetch(
        'https://graph.microsoft.com/v1.0/sites?search=*',
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      );
      console.log('4. Graph API test:', testResponse.status);

    } else {
      console.log('3. ERROR:', data.error_description);
    }
  } catch (error) {
    console.log('EXCEPTION:', error.message);
  }
};
```

**Neue Edge Function:** `sharepoint-debug`

```typescript
// functions/supabase/functions/sharepoint-debug/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const TENANT_ID = Deno.env.get('MS365_TENANT_ID');
  const CLIENT_ID = Deno.env.get('MS365_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET');

  const steps = [];

  // Step 1: Check environment
  steps.push({
    step: 1,
    name: 'Environment Check',
    tenant_id: TENANT_ID ? `${TENANT_ID.slice(0, 8)}...` : 'MISSING',
    client_id: CLIENT_ID ? `${CLIENT_ID.slice(0, 8)}...` : 'MISSING',
    client_secret: CLIENT_SECRET ? 'SET (hidden)' : 'MISSING'
  });

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ steps, error: 'Missing credentials' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Step 2: Token request
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
      })
    });

    const tokenData = await tokenResponse.json();

    steps.push({
      step: 2,
      name: 'Token Request',
      status: tokenResponse.status,
      has_token: !!tokenData.access_token,
      error: tokenData.error_description || null,
      expires_in: tokenData.expires_in || null
    });

    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ steps }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Graph API test - Sites
    const sitesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/sites?search=neurealis',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    const sitesData = await sitesResponse.json();

    steps.push({
      step: 3,
      name: 'Graph API - Sites Search',
      status: sitesResponse.status,
      sites_found: sitesData.value?.length || 0,
      error: sitesData.error?.message || null
    });

    // Step 4: Drive access
    if (sitesData.value?.[0]?.id) {
      const driveResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${sitesData.value[0].id}/drive`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );

      const driveData = await driveResponse.json();

      steps.push({
        step: 4,
        name: 'Graph API - Drive Access',
        status: driveResponse.status,
        drive_id: driveData.id?.slice(0, 20) + '...',
        error: driveData.error?.message || null
      });
    }

    return new Response(JSON.stringify({ steps, success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    steps.push({
      step: 'ERROR',
      name: 'Exception',
      message: error.message
    });

    return new Response(JSON.stringify({ steps }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

**Checkliste:**

- [ ] `sharepoint-debug` Edge Function deployen
- [ ] Credentials in Supabase Secrets verifizieren
- [ ] Token-Request isoliert testen
- [ ] Graph API Permissions in Azure Portal prüfen
- [ ] Sites.Read.All, Files.Read.All Permissions bestätigen
- [ ] Admin Consent Status verifizieren

---

### 2. Softr: Bidirektionaler Sync mit Last-Write-Wins (P1)

**Aktueller Stand:**
- Softr → Supabase: 12 von 16 Tabellen (Cron 5min)
- Supabase → Softr: Nur LV-Positionen (Trigger)

**Ziel:**
- Alle 16 Tabellen bidirektional
- Last-Write-Wins Konfliktlösung

**Softr-Tabellen für bidirektionalen Sync:**

| # | Softr Table ID | Softr Name | Supabase Tabelle | Bisheriger Sync | NEU |
|---|----------------|------------|------------------|-----------------|-----|
| 1 | `baeVoaT73WSuFr` | Protokolle Abnahmen | `protokolle_abnahmen` | Pull | ↔ Bidi |
| 2 | `J563LaZ43bZSQy` | Mängel Fertigstellung | `maengel_fertigstellung` | Pull | ↔ Bidi |
| 3 | `RJGAYKFdDDxosc` | Aufgaben NEU | `tasks` | Pull | ↔ Bidi |
| 4 | `kNjsEhYYcNjAsj` | Dokumente | `softr_dokumente` | Pull | ↔ Bidi |
| 5 | `XXJFvICfFvbXkY` | Konto Transaktionen | `konto_transaktionen` | Pull | ↔ Bidi |
| 6 | `VzvQUdlHStrRtN` | Kontakte | `kontakte` | Pull | ↔ Bidi |
| 7 | `0xZkAxDadNyOMI` | Ausführungsmängel | `ausfuehrungsmaengel` | Pull | ↔ Bidi |
| 8 | `bLgAqseB1AgVeu` | Einzelgewerke | `einzelgewerke` | Pull | ↔ Bidi |
| 9 | `bl0tRF2R7aMLYC` | Personal Bewerber | `personal_bewerber` | Pull | ↔ Bidi |
| 10 | `gGcyZx01A4bDuH` | Logs VAPI | `logs_vapi` | Pull | → nur Pull |
| 11 | `ORCDcA1wFrCzu2` | Angebotserstellung | `softr_angebotserstellung` | Pull | ↔ Bidi |
| 12 | `va3BbWTn101BXJ` | Leads | `leads` | Pull | ↔ Bidi |
| 13 | `xvtJVrb2An6wwl` | Inventar | `inventar` | Pull | ↔ Bidi |
| 14 | `trBGeNEBfm2Jf7` | Projekt Umsatz | `projekt_umsatz` | Pull | ↔ Bidi |
| 15 | `WdY5U4LHNzDAsW` | Leistungsverzeichnisse | `lv_positionen` | ↔ Bidi | ✅ bereits |
| 16 | `nachtraege_tbl` | Nachträge | `nachtraege` | Pull | ↔ Bidi |

**Implementierung:**

#### A. DB-Schema-Erweiterung

```sql
-- Migration: add_sync_metadata_columns
-- Fügt Sync-Metadaten zu allen synchronisierten Tabellen hinzu

DO $$
DECLARE
  tbl_name TEXT;
  tables_to_update TEXT[] := ARRAY[
    'protokolle_abnahmen', 'maengel_fertigstellung', 'tasks',
    'softr_dokumente', 'konto_transaktionen', 'kontakte',
    'ausfuehrungsmaengel', 'einzelgewerke', 'personal_bewerber',
    'softr_angebotserstellung', 'leads', 'inventar',
    'projekt_umsatz', 'nachtraege'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY tables_to_update
  LOOP
    -- Nur hinzufügen wenn Spalte noch nicht existiert
    EXECUTE format('
      ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS sync_source TEXT DEFAULT ''manual'',
      ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS softr_record_id TEXT
    ', tbl_name);

    -- Index für Sync-Abfragen
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS idx_%s_sync
      ON %I (softr_record_id, last_modified_at)
    ', tbl_name, tbl_name);
  END LOOP;
END $$;

-- Trigger-Funktion für automatisches Timestamp-Update
CREATE OR REPLACE FUNCTION fn_update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### B. Last-Write-Wins Logik

```typescript
// softr-sync.ts - Erweitert um bidirektionalen Sync

interface SyncRecord {
  softr_record_id: string;
  softr_updated_at: string;  // Softr's dateModified
  supabase_updated_at: string;  // last_modified_at
  data: Record<string, any>;
}

const resolveConflict = (softrRecord: SyncRecord, supabaseRecord: SyncRecord): 'softr' | 'supabase' | 'skip' => {
  const softrTime = new Date(softrRecord.softr_updated_at).getTime();
  const supabaseTime = new Date(supabaseRecord.supabase_updated_at).getTime();

  // Last-Write-Wins: Neuerer Timestamp gewinnt
  if (softrTime > supabaseTime) {
    return 'softr';  // Softr-Daten nach Supabase übernehmen
  } else if (supabaseTime > softrTime) {
    return 'supabase';  // Supabase-Daten nach Softr pushen
  } else {
    return 'skip';  // Identisch, keine Aktion
  }
};

const bidirectionalSync = async (tableConfig: TableConfig) => {
  // 1. Softr-Daten holen
  const softrRecords = await fetchSoftrTable(tableConfig.softr_table_id);

  // 2. Supabase-Daten holen
  const supabaseRecords = await supabase
    .from(tableConfig.supabase_table)
    .select('*, softr_record_id, last_modified_at')
    .not('softr_record_id', 'is', null);

  const stats = { softr_wins: 0, supabase_wins: 0, skipped: 0, new: 0 };

  for (const softrRecord of softrRecords) {
    const supabaseMatch = supabaseRecords.find(
      s => s.softr_record_id === softrRecord.recordId
    );

    if (!supabaseMatch) {
      // Neuer Record in Softr → nach Supabase
      await insertToSupabase(tableConfig, softrRecord);
      stats.new++;
      continue;
    }

    const winner = resolveConflict(
      {
        softr_record_id: softrRecord.recordId,
        softr_updated_at: softrRecord.dateModified,
        supabase_updated_at: supabaseMatch.last_modified_at,
        data: softrRecord
      },
      {
        softr_record_id: supabaseMatch.softr_record_id,
        softr_updated_at: softrRecord.dateModified,
        supabase_updated_at: supabaseMatch.last_modified_at,
        data: supabaseMatch
      }
    );

    switch (winner) {
      case 'softr':
        await updateSupabase(tableConfig, softrRecord, supabaseMatch.id);
        stats.softr_wins++;
        break;
      case 'supabase':
        await pushToSoftr(tableConfig, supabaseMatch);
        stats.supabase_wins++;
        break;
      case 'skip':
        stats.skipped++;
        break;
    }
  }

  // 3. Neue Supabase-Records (ohne softr_record_id) nach Softr pushen
  const newSupabaseRecords = supabaseRecords.filter(s => !s.softr_record_id);
  for (const record of newSupabaseRecords) {
    const softrId = await createInSoftr(tableConfig, record);
    await supabase
      .from(tableConfig.supabase_table)
      .update({ softr_record_id: softrId })
      .eq('id', record.id);
    stats.new++;
  }

  return stats;
};
```

#### C. Trigger für Push bei Supabase-Änderungen

```sql
-- Generischer Push-Trigger für alle Softr-sync Tabellen
CREATE OR REPLACE FUNCTION trigger_softr_push()
RETURNS TRIGGER AS $$
DECLARE
  table_config RECORD;
BEGIN
  -- Nur pushen wenn Änderung nicht von Softr kam
  IF NEW.sync_source = 'softr' THEN
    RETURN NEW;
  END IF;

  -- Konfiguration für diese Tabelle laden
  SELECT * INTO table_config
  FROM softr_sync_config
  WHERE supabase_table = TG_TABLE_NAME;

  IF table_config IS NULL THEN
    RETURN NEW;
  END IF;

  -- Asynchroner HTTP-Call an softr-push Edge Function
  PERFORM net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' ||
               current_setting('app.supabase_service_key', true) || '"}'::jsonb,
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record_id', NEW.id,
      'softr_record_id', NEW.softr_record_id,
      'operation', TG_OP
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 3. Monday: Label-Mapping für Status-Spalten (P1)

**Problem:**
Monday Status-Spalten haben feste Label-Definitionen. Ein direkter Wert-Push führt zu:
`ColumnValueException: This status label doesn't exist`

**Lösung:** Label-Mapping-Tabelle + Lookup bei Push

**Aktuelle Dokumentation:** `docs/MONDAY_COLUMN_MAPPING.md`

**Status-Spalten (64 Stück):**

```sql
-- Migration: create_monday_label_mapping
CREATE TABLE monday_label_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id TEXT NOT NULL,           -- z.B. 'status06__1'
  column_title TEXT,                 -- z.B. 'Status Projekt'
  label_index INTEGER NOT NULL,      -- Monday Label Index (0, 1, 2, ...)
  label_text TEXT NOT NULL,          -- z.B. 'In Bearbeitung'
  label_color TEXT,                  -- z.B. 'green'
  supabase_value TEXT,               -- Wie wir es in Supabase speichern
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(column_id, label_index)
);

-- Index für schnelle Lookups
CREATE INDEX idx_monday_label_column ON monday_label_mapping(column_id);
CREATE INDEX idx_monday_label_supabase ON monday_label_mapping(supabase_value);
```

**Label-Mapping Edge Function:**

```typescript
// monday-label-sync.ts - Einmaliges Laden aller Labels

const syncMondayLabels = async () => {
  // 1. Board-Schema laden
  const query = `
    query {
      boards(ids: [1545426536]) {
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': Deno.env.get('MONDAY_API_KEY')!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const { data } = await response.json();
  const columns = data.boards[0].columns;

  const labels = [];

  for (const col of columns) {
    if (col.type === 'color' || col.type === 'status') {
      const settings = JSON.parse(col.settings_str);

      if (settings.labels) {
        for (const [index, labelData] of Object.entries(settings.labels)) {
          labels.push({
            column_id: col.id,
            column_title: col.title,
            label_index: parseInt(index),
            label_text: typeof labelData === 'string' ? labelData : labelData.name,
            label_color: typeof labelData === 'object' ? labelData.color : null,
            supabase_value: typeof labelData === 'string' ? labelData : labelData.name
          });
        }
      }
    }
  }

  // Bulk upsert
  await supabase
    .from('monday_label_mapping')
    .upsert(labels, { onConflict: 'column_id,label_index' });

  return { labels_synced: labels.length };
};
```

**Angepasster monday-push mit Label-Lookup:**

```typescript
// monday-push.ts - Erweitert um Label-Mapping

const getLabelIndex = async (columnId: string, supabaseValue: string): Promise<number | null> => {
  const { data } = await supabase
    .from('monday_label_mapping')
    .select('label_index')
    .eq('column_id', columnId)
    .eq('supabase_value', supabaseValue)
    .single();

  return data?.label_index ?? null;
};

const buildColumnValues = async (record: Record<string, any>, columns: ColumnConfig[]) => {
  const columnValues: Record<string, any> = {};

  for (const col of columns) {
    const value = record[col.supabase_field];
    if (value === null || value === undefined) continue;

    if (col.type === 'status') {
      // Label-Index nachschlagen
      const labelIndex = await getLabelIndex(col.monday_id, value);
      if (labelIndex !== null) {
        columnValues[col.monday_id] = { index: labelIndex };
      }
    } else if (col.type === 'text') {
      columnValues[col.monday_id] = value;
    } else if (col.type === 'numbers') {
      columnValues[col.monday_id] = parseFloat(value) || 0;
    } else if (col.type === 'date') {
      columnValues[col.monday_id] = { date: value };
    }
  }

  return JSON.stringify(columnValues);
};
```

**Sync-Strategie für Status-Spalten:**

| Richtung | Mechanismus | Konfliktlösung |
|----------|-------------|----------------|
| Monday → Supabase | Cron 5min | Label-Text als String speichern |
| Supabase → Monday | Trigger | Label-Index per Mapping nachschlagen |

**Hinweis:** Die 64 Status-Spalten sind nur für Gewerk-Status relevant (Elektrik, Sanitär, etc.). Für den MVP reicht unidirektionaler Sync (Monday → Supabase). Bidirektional nur für kritische Spalten wie `status_projekt`.

---

### 4. Kontakte: Rollen-basierte Auto-Zuweisung (P2)

**Konzept:** Hybrid-Ansatz aus automatischer Basis-Zuweisung + manueller Überschreibung

**Kontakt-Rollen (kontakt_typen):**

| Kürzel | Rolle | Auto-Zuweisung |
|--------|-------|----------------|
| ADM | Admin | - |
| GF | Geschäftsführung | - |
| BL | Bauleiter | Projekt-Bauleiter |
| HW | Handwerker (intern) | - |
| BH | Buchhaltung | Rechnungs-Kontakte |
| NU | Nachunternehmer | Projekt-NU |
| LI | Lieferant | Bestellungen |
| KU | Kunde | Projekt-Auftraggeber |
| AP | Ansprechpartner | Domain-Match |

**Auto-Zuweisungs-Regeln:**

```typescript
// kontakt-auto-assign.ts

interface AutoAssignRule {
  trigger: 'projekt_erstellt' | 'dokument_erstellt' | 'email_empfangen';
  field_to_check: string;
  kontakt_typ: string;
  assign_to: string;  // Welches Feld wird befüllt
}

const AUTO_ASSIGN_RULES: AutoAssignRule[] = [
  // Bei Projekterstellung
  {
    trigger: 'projekt_erstellt',
    field_to_check: 'bauleiter',
    kontakt_typ: 'BL',
    assign_to: 'projekt_bauleiter_id'
  },
  {
    trigger: 'projekt_erstellt',
    field_to_check: 'auftraggeber',
    kontakt_typ: 'KU',
    assign_to: 'projekt_kunde_id'
  },

  // Bei Rechnungseingang
  {
    trigger: 'dokument_erstellt',
    field_to_check: 'absender_email',
    kontakt_typ: 'NU',
    assign_to: 'dokument_kontakt_id'
  },

  // Bei E-Mail-Eingang
  {
    trigger: 'email_empfangen',
    field_to_check: 'from_domain',
    kontakt_typ: 'AP',
    assign_to: 'email_kontakt_id'
  }
];

const autoAssignKontakt = async (
  trigger: string,
  context: Record<string, any>
): Promise<{ kontakt_id: string | null; confidence: number; needs_review: boolean }> => {

  const rule = AUTO_ASSIGN_RULES.find(r => r.trigger === trigger);
  if (!rule) return { kontakt_id: null, confidence: 0, needs_review: true };

  const searchValue = context[rule.field_to_check];
  if (!searchValue) return { kontakt_id: null, confidence: 0, needs_review: true };

  // Suche nach existierendem Kontakt
  const { data: matches } = await supabase
    .from('kontakte')
    .select('id, name, email, firma, rolle')
    .or(`email.ilike.%${searchValue}%,firma.ilike.%${searchValue}%,name.ilike.%${searchValue}%`)
    .eq('rolle', rule.kontakt_typ)
    .limit(5);

  if (!matches || matches.length === 0) {
    return { kontakt_id: null, confidence: 0, needs_review: true };
  }

  if (matches.length === 1) {
    // Eindeutiger Match
    return { kontakt_id: matches[0].id, confidence: 1.0, needs_review: false };
  }

  // Mehrere Kandidaten → Review-Queue
  return {
    kontakt_id: matches[0].id,  // Bester Kandidat
    confidence: 0.7,
    needs_review: true
  };
};
```

**DB-Schema für manuelle Überschreibung:**

```sql
-- Migration: add_kontakt_override
ALTER TABLE projekte
  ADD COLUMN IF NOT EXISTS bauleiter_id UUID REFERENCES kontakte(id),
  ADD COLUMN IF NOT EXISTS kunde_id UUID REFERENCES kontakte(id),
  ADD COLUMN IF NOT EXISTS bauleiter_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS kunde_override BOOLEAN DEFAULT false;

-- Kommentar: Bei override=true wird Auto-Zuweisung ignoriert
```

---

### 5. E-Mail: Review-Queue für unsichere Matches (P2)

**Konzept:** Auto-Match mit Confidence-Score + Review-Queue für Scores < 80%

**Matching-Kaskade (existierend, erweitert):**

```
1. Domain-Match (90-100%)
   → kontakt_domains.domain = email.from_domain

2. Exakter E-Mail-Match (100%)
   → kontakte.email = email.from_address

3. Pattern-Match ATBS-Nummer (80-95%)
   → email.subject LIKE '%ATBS-###%'
   → email.body LIKE '%ATBS-###%'

4. Postfach-Logik (70-85%)
   → rechnungen@ = ER-Dokumente
   → bewerbungen@ = HR-Kontakte

5. Fuzzy-Match Firma (60-80%)
   → similarity(kontakte.firma, email.from_name) > 0.6
```

**Review-Queue Schema:**

```sql
-- Migration: create_email_review_queue
CREATE TABLE email_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES email_details(id) ON DELETE CASCADE,

  -- Matching-Ergebnis
  suggested_kontakt_id UUID REFERENCES kontakte(id),
  confidence_score NUMERIC(3,2) NOT NULL,  -- 0.00 - 1.00
  match_method TEXT,  -- 'domain', 'email', 'pattern', 'postfach', 'fuzzy'
  match_details JSONB,  -- Debug-Infos

  -- Alternative Kandidaten
  alternative_kontakte UUID[],

  -- Review-Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'manual'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  final_kontakt_id UUID REFERENCES kontakte(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index für ausstehende Reviews
CREATE INDEX idx_email_review_pending ON email_review_queue(status)
  WHERE status = 'pending';

-- Konfidenz-basierte View
CREATE VIEW v_email_review_stats AS
SELECT
  date_trunc('day', created_at) AS tag,
  count(*) AS total,
  count(*) FILTER (WHERE confidence_score >= 0.8) AS auto_approved,
  count(*) FILTER (WHERE confidence_score < 0.8) AS needs_review,
  count(*) FILTER (WHERE status = 'approved') AS reviewed
FROM email_review_queue
GROUP BY 1
ORDER BY 1 DESC;
```

**Edge Function: email-match-process**

```typescript
// email-match-process.ts

const CONFIDENCE_THRESHOLD = 0.8;

const processEmailMatch = async (emailId: string) => {
  const { data: email } = await supabase
    .from('email_details')
    .select('*')
    .eq('id', emailId)
    .single();

  if (!email) return { error: 'Email not found' };

  // Matching-Kaskade durchlaufen
  const matchResult = await runMatchingCascade(email);

  if (matchResult.confidence >= CONFIDENCE_THRESHOLD) {
    // Auto-Approve: Direkt zuweisen
    await supabase
      .from('email_details')
      .update({
        kontakt_id: matchResult.kontakt_id,
        match_method: matchResult.method,
        match_confidence: matchResult.confidence
      })
      .eq('id', emailId);

    return {
      status: 'auto_approved',
      kontakt_id: matchResult.kontakt_id,
      confidence: matchResult.confidence
    };

  } else {
    // In Review-Queue einreihen
    await supabase
      .from('email_review_queue')
      .insert({
        email_id: emailId,
        suggested_kontakt_id: matchResult.kontakt_id,
        confidence_score: matchResult.confidence,
        match_method: matchResult.method,
        match_details: matchResult.details,
        alternative_kontakte: matchResult.alternatives
      });

    return {
      status: 'needs_review',
      confidence: matchResult.confidence,
      alternatives: matchResult.alternatives.length
    };
  }
};

const runMatchingCascade = async (email: EmailRecord) => {
  // 1. Domain-Match
  const domainMatch = await matchByDomain(email.from_domain);
  if (domainMatch.confidence >= 0.9) return domainMatch;

  // 2. Exakter E-Mail-Match
  const emailMatch = await matchByEmail(email.from_address);
  if (emailMatch.confidence === 1.0) return emailMatch;

  // 3. ATBS-Pattern
  const patternMatch = await matchByAtbsPattern(email.subject, email.body_preview);
  if (patternMatch.confidence >= 0.8) return patternMatch;

  // 4. Postfach-Logik
  const postfachMatch = await matchByPostfach(email.to_address);
  if (postfachMatch.confidence >= 0.7) return postfachMatch;

  // 5. Fuzzy-Match als Fallback
  return await fuzzyMatchFirma(email.from_name);
};
```

---

### 6. WordPress: Elementor Template-Generierung (P3)

**Ziel:** Portfolio + Services + regionale Landingpages automatisch generieren

**Content-Typen:**

| Typ | Template | Quelle | Frequenz |
|-----|----------|--------|----------|
| Portfolio/Referenzen | Projekt-Slider | `monday_bauprozess` (Phase 7) | Bei Projektabschluss |
| Service-Seiten | Gewerk-Template | `lv_positionen` (Gewerke) | Bei LV-Update |
| Regionale Landingpages | Stadt-Template | `blog_keywords` + Städte-Liste | Wöchentlich |

**Elementor REST API Integration:**

```typescript
// wordpress-elementor-sync.ts

interface ElementorTemplate {
  id: number;
  title: string;
  type: 'page' | 'section' | 'widget';
  content: string;  // JSON-encoded Elementor data
}

const TEMPLATES = {
  portfolio_item: 12345,    // Template ID in WordPress
  service_page: 12346,
  regional_landing: 12347
};

// Portfolio-Generierung aus abgeschlossenen Projekten
const generatePortfolioPages = async () => {
  // Projekte in Phase 7 (abgeschlossen) mit Fotos
  const { data: projekte } = await supabase
    .from('monday_bauprozess')
    .select(`
      *,
      fotos(url, kategorie)
    `)
    .eq('status_projekt', '(7) Projekt abgeschlossen')
    .not('hero_projekt_id', 'is', null)
    .order('bauende', { ascending: false })
    .limit(20);

  for (const projekt of projekte || []) {
    // Template-Daten aufbereiten
    const pageData = {
      title: `Referenz: ${projekt.adresse || projekt.atbs_nummer}`,
      content: buildPortfolioContent(projekt),
      status: 'draft',  // Erst als Entwurf
      template: TEMPLATES.portfolio_item,
      meta: {
        _elementor_template_type: 'page',
        atbs_nummer: projekt.atbs_nummer,
        fertigstellung: projekt.bauende
      }
    };

    // WordPress REST API
    const wpResponse = await fetch(
      'https://neurealis.de/wp-json/wp/v2/pages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WP_JWT_TOKEN}`
        },
        body: JSON.stringify(pageData)
      }
    );

    if (wpResponse.ok) {
      const wpPage = await wpResponse.json();

      // Elementor-Daten setzen
      await setElementorData(wpPage.id, buildElementorJson(projekt));

      // Referenz in Supabase speichern
      await supabase
        .from('monday_bauprozess')
        .update({ wordpress_page_id: wpPage.id })
        .eq('id', projekt.id);
    }
  }
};

// Regionale Landingpages
const STÄDTE_NRW = [
  'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Gelsenkirchen',
  'Mülheim', 'Oberhausen', 'Herne', 'Witten', 'Castrop-Rauxel',
  'Lünen', 'Unna', 'Schwerte', 'Kamen', 'Bergkamen'
];

const SERVICES = [
  'Wohnungssanierung', 'Badsanierung', 'Elektroinstallation',
  'Maler- und Lackierarbeiten', 'Bodenbeläge', 'Kernsanierung'
];

const generateRegionalPages = async () => {
  for (const stadt of STÄDTE_NRW) {
    for (const service of SERVICES) {
      const pageTitle = `${service} ${stadt} - neurealis`;
      const slug = `${service.toLowerCase().replace(/ /g, '-')}-${stadt.toLowerCase()}`;

      // Prüfen ob Seite existiert
      const existing = await checkWpPageExists(slug);
      if (existing) continue;

      // Content aus blog_posts für SEO
      const { data: relatedPosts } = await supabase
        .from('blog_posts')
        .select('title, slug')
        .ilike('title', `%${service}%`)
        .limit(3);

      const pageData = {
        title: pageTitle,
        slug: slug,
        content: buildRegionalContent(stadt, service, relatedPosts),
        status: 'draft',
        template: TEMPLATES.regional_landing
      };

      await createWpPage(pageData);
    }
  }
};
```

**Cron-Schedule:**

| Job | Schedule | Funktion |
|-----|----------|----------|
| `wp-portfolio-sync` | Täglich 06:00 | Neue Referenzen publizieren |
| `wp-regional-pages` | Sonntags 05:00 | Regionale Seiten generieren |
| `wp-service-update` | Bei LV-Änderung | Service-Seiten aktualisieren |

---

## Technische Details

### Edge Functions (Neu/Erweitert)

| Function | Version | Beschreibung | Trigger |
|----------|---------|--------------|---------|
| `sharepoint-debug` | v1 | Debugging Token-Problem | Manuell |
| `softr-sync` | v5 | Bidirektionaler Sync (16 Tabellen) | Cron 5min |
| `softr-push` | v1 | Push bei Supabase-Änderung | DB-Trigger |
| `monday-label-sync` | v1 | Label-Mapping laden | Manuell/Weekly |
| `monday-push` | v6 | Mit Label-Lookup | DB-Trigger |
| `kontakt-auto-assign` | v1 | Rollen-basierte Zuweisung | Trigger |
| `email-match-process` | v1 | Confidence-Matching | Cron/Trigger |
| `wp-elementor-sync` | v1 | Portfolio + Landingpages | Cron |

### DB-Trigger

| Trigger | Tabelle | Event | Aktion |
|---------|---------|-------|--------|
| `trg_monday_push` | `monday_bauprozess` | UPDATE | → monday-push |
| `trg_softr_push_*` | 14 Tabellen | INSERT/UPDATE | → softr-push |
| `trg_kontakt_assign` | `projekte`, `dokumente` | INSERT | → kontakt-auto-assign |
| `trg_email_match` | `email_details` | INSERT | → email-match-process |

### Cron-Jobs (Aktualisiert)

| Job | Schedule | Funktion | Status |
|-----|----------|----------|--------|
| `monday-sync-job` | `*/5 * * * *` | Pull von Monday | ✅ Aktiv |
| `monday-push-job` | - | - | ❌ Deaktiviert (Trigger) |
| `softr-sync-job` | `*/5 * * * *` | Bidirektionaler Sync | 🔄 Erweitern |
| `sharepoint-sync-job` | `*/15 * * * *` | Delta-Sync | ⏸️ Pausiert |
| `email-review-reminder` | `0 9 * * *` | Daily Digest | NEU |
| `wp-portfolio-sync` | `0 6 * * *` | Portfolio-Update | NEU |
| `wp-regional-pages` | `0 5 * * 0` | Landingpages | NEU |

---

## Priorisierte Roadmap

### Phase 1: Kritische Blocker (Woche 1)

| # | Task | Aufwand | Abhängigkeit |
|---|------|---------|--------------|
| 1.1 | SharePoint-Debug Edge Function deployen | 2h | - |
| 1.2 | Token-Problem identifizieren und fixen | 4h | 1.1 |
| 1.3 | Monday Label-Mapping laden | 2h | - |
| 1.4 | monday-push v6 mit Label-Lookup | 4h | 1.3 |

### Phase 2: Softr Bidirektional (Woche 2)

| # | Task | Aufwand | Abhängigkeit |
|---|------|---------|--------------|
| 2.1 | DB-Migration: sync_source + last_modified_at | 2h | - |
| 2.2 | softr-sync v5 mit Last-Write-Wins | 6h | 2.1 |
| 2.3 | softr-push Edge Function | 4h | 2.1 |
| 2.4 | Trigger für 14 Tabellen erstellen | 2h | 2.3 |
| 2.5 | E2E-Test bidirektionaler Sync | 4h | 2.4 |

### Phase 3: Kontakt-Automatisierung (Woche 3)

| # | Task | Aufwand | Abhängigkeit |
|---|------|---------|--------------|
| 3.1 | kontakt-auto-assign Logik | 4h | - |
| 3.2 | Override-Spalten in projekte | 1h | - |
| 3.3 | email_review_queue Tabelle | 2h | - |
| 3.4 | email-match-process Function | 4h | 3.3 |
| 3.5 | Review-Queue UI im ERP | 6h | 3.4 |

### Phase 4: WordPress Integration (Woche 4)

| # | Task | Aufwand | Abhängigkeit |
|---|------|---------|--------------|
| 4.1 | WordPress JWT Auth einrichten | 2h | - |
| 4.2 | Elementor Template erstellen | 4h | - |
| 4.3 | wp-elementor-sync Function | 6h | 4.1, 4.2 |
| 4.4 | Cron-Jobs einrichten | 2h | 4.3 |
| 4.5 | Regionale Landingpages testen | 4h | 4.4 |

**Gesamtaufwand geschätzt:** ~60h (4 Wochen bei halber Kapazität)

---

## Risiken & Mitigationen

### R1: SharePoint Token-Problem nicht lösbar

**Risiko:** Azure-seitige Konfiguration oder Netzwerk-Problem
**Wahrscheinlichkeit:** Mittel
**Impact:** Hoch (Dokumenten-Sync blockiert)

**Mitigation:**
- Eskalation an Microsoft Support wenn Debug erfolglos
- Alternative: Power Automate Flow als Zwischenlösung
- Fallback: Manuelle Synchronisation per Script

### R2: Softr API Rate Limits bei bidirektionalem Sync

**Risiko:** 429 Too Many Requests bei vollem Push
**Wahrscheinlichkeit:** Mittel
**Impact:** Mittel (Sync verzögert)

**Mitigation:**
- Exponential Backoff implementieren
- Batching auf 50 Records pro Minute
- Prioritäts-Queue für kritische Tabellen

### R3: Monday Label-Änderungen

**Risiko:** Labels in Monday werden geändert → Sync bricht
**Wahrscheinlichkeit:** Niedrig
**Impact:** Mittel

**Mitigation:**
- Wöchentlicher Cron für Label-Re-Sync
- Alert bei unbekannten Labels
- Fallback: Label-Text als String speichern

### R4: Last-Write-Wins Datenverlust

**Risiko:** Gleichzeitige Änderungen → ältere Änderung verloren
**Wahrscheinlichkeit:** Niedrig (bei 5min Sync)
**Impact:** Niedrig-Mittel

**Mitigation:**
- Audit-Log für alle Änderungen
- Soft-Delete statt Hard-Delete
- Konflikt-Report bei < 1min Differenz

### R5: WordPress/Elementor API-Änderungen

**Risiko:** Elementor-Update bricht Template-API
**Wahrscheinlichkeit:** Niedrig
**Impact:** Mittel

**Mitigation:**
- Template-Versioning
- Fallback auf Standard-WordPress-Blöcke
- Automatisierte Smoke-Tests nach WP-Updates

---

## Anhänge

### A. Softr Field-Mapping (Beispiel: Mängel)

```json
{
  "table_id": "J563LaZ43bZSQy",
  "supabase_table": "maengel_fertigstellung",
  "fields": [
    { "softr_id": "1UqYa", "supabase_col": "mangel_nr", "type": "text" },
    { "softr_id": "aScwq", "supabase_col": "fotos_mangel", "type": "attachment" },
    { "softr_id": "mSdP4", "supabase_col": "gewerk", "type": "text" },
    { "softr_id": "status", "supabase_col": "status_mangel", "type": "status" },
    { "softr_id": "dateModified", "supabase_col": "last_modified_at", "type": "datetime" }
  ]
}
```

### B. Monday Gewerk-Status-Spalten

| Gewerk | Monday Column ID | Supabase Spalte |
|--------|------------------|-----------------|
| Elektrik | `color58__1` | `status_elektrik` |
| Sanitär | `color59__1` | `status_sanitaer` |
| Maler | `color40__1` | `status_maler` |
| Boden | `color37__1` | `status_boden` |
| Türen | `color57__1` | `status_tueren` |
| Fenster | `color59` | `status_fenster` |
| Reinigung | `color85__1` | `status_reinigung` |

### C. Review-Queue UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  E-Mail Review-Queue                           [3 ausstehend]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Von: mueller@sanitaer-xyz.de                            │   │
│  │ Betreff: Rechnung 2026-001 ATBS-456                     │   │
│  │ Confidence: 72%  (Fuzzy-Match: "Sanitär XYZ GmbH")      │   │
│  │                                                         │   │
│  │ Vorgeschlagen: Müller Sanitär GmbH (NU)                 │   │
│  │                                                         │   │
│  │ Alternativen:                                           │   │
│  │   ○ XYZ Sanitärtechnik GmbH (NU)                        │   │
│  │   ○ Mueller Installations GmbH (LI)                     │   │
│  │   ○ [Neuen Kontakt anlegen]                             │   │
│  │                                                         │   │
│  │ [✅ Bestätigen]  [🔄 Alternative wählen]  [❌ Ablehnen]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Dokument erstellt: 2026-02-01*
*Genehmigt durch: User-Entscheidungen in Session LOG-057*
