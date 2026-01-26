# Session-Status: Kontaktmanagement

**Datum:** 2026-01-26
**Status:** ABGESCHLOSSEN

---

## Was wurde implementiert

### 1. Supabase-Tabellen (via MCP Migration)

| Tabelle | Status | Migration |
|---------|--------|-----------|
| `kontakte` | ✅ Erstellt | `kontakte_system` |
| `adressen` | ✅ Erstellt | `kontakte_system` |
| `kontakte_lieferanten` | ✅ Erstellt | `kontakte_erweiterungen` |
| `kontakte_nachunternehmer` | ✅ Erstellt | `kontakte_erweiterungen` |
| `kontakte_sync_log` | ✅ Erstellt | `kontakte_erweiterungen` |

### 2. RPC Functions

| Function | Status |
|----------|--------|
| `kontakte_find_duplicates()` | ✅ Erstellt |
| `kontakte_visible_for(email)` | ✅ Erstellt |
| `kontakte_statistiken()` | ✅ Erstellt |

### 3. Views

| View | Status |
|------|--------|
| `v_kontakte_aktiv` | ✅ Erstellt |

### 4. Edge Functions (Code erstellt, Deploy ausstehend)

| Function | Pfad | Status |
|----------|------|--------|
| `kontakte-sync-hero` | `functions/supabase/functions/kontakte-sync-hero/index.ts` | ✅ Code fertig |
| `kontakte-sync-monday` | `functions/supabase/functions/kontakte-sync-monday/index.ts` | ✅ Code fertig |
| `kontakte-sync-ms365` | `functions/supabase/functions/kontakte-sync-ms365/index.ts` | ✅ Code fertig |

---

## Nächste Schritte

### 1. Edge Functions deployen

```bash
supabase functions deploy kontakte-sync-hero
supabase functions deploy kontakte-sync-monday
supabase functions deploy kontakte-sync-ms365
```

### 2. Secrets prüfen/setzen

Benötigte Secrets in Supabase:
- `HERO_API_KEY` - Hero Software (bereits vorhanden: `ac_YDji...`)
- `MONDAY_API_KEY` - Monday.com
- `MS365_TENANT_ID` - Microsoft Graph
- `MS365_CLIENT_ID` - Microsoft Graph
- `MS365_CLIENT_SECRET` - Microsoft Graph

### 3. Initial-Import ausführen

```bash
# Hero-Kontakte importieren (~50)
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero

# Monday-Boards importieren (62 Kontakte: 6 MA + 40 NU + 16 Lief)
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday

# MS365 Kontakte (optional)
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365
```

### 4. Duplikate prüfen

```sql
SELECT * FROM kontakte_find_duplicates();
```

### 5. Cron-Jobs einrichten

```sql
-- Hero: Täglich 02:00
SELECT cron.schedule('kontakte-sync-hero', '0 2 * * *',
  $$SELECT net.http_get('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero')$$);

-- Monday: Alle 30 Min
SELECT cron.schedule('kontakte-sync-monday', '*/30 * * * *',
  $$SELECT net.http_get('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-monday')$$);
```

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `functions/migrations/003_kontakte_system.sql` | SQL-Migration (Backup, wurde via MCP ausgeführt) |
| `functions/supabase/functions/kontakte-sync-hero/index.ts` | Hero Sync Function |
| `functions/supabase/functions/kontakte-sync-monday/index.ts` | Monday Sync Function |
| `functions/supabase/functions/kontakte-sync-ms365/index.ts` | MS365 Sync Function |
| `docs/NEUREALIS_KONTAKTE.md` | Vollständige Dokumentation |

---

## Wichtige Hinweise

1. **Supabase MCP:** SQL-Migrationen können direkt via MCP ausgeführt werden (kein UI nötig)
2. **Monday Board-IDs:**
   - Mitarbeiter: `1828539808`
   - Subunternehmer: `1545125471`
   - Lieferanten: `1547308184`
3. **Sichtbarkeit:** Private MS365-Kontakte nur für Owner sichtbar
4. **Duplikat-Merge:** Automatisch bei Email-Match, manuell bei Fuzzy-Match

---

*Erstellt: 2026-01-26*
