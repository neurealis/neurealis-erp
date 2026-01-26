# Session Log: Bidirektionaler Kontakt-Sync

**Datum:** 2026-01-26
**Projekt:** neurealis ERP
**Status:** Abgeschlossen

---

## Implementierte Features

### 1. DB-Trigger für sofortigen Push (Migration 004)

**Datei:** `20260126*_kontakte_push_trigger`

- Neue Spalte `last_local_update` in `kontakte`
- Neue Spalten `direction`, `targets` in `kontakte_sync_log`
- Trigger `trg_kontakte_push` bei INSERT/UPDATE
- Funktion `kontakte_push_trigger()` - ruft Edge Function via pg_net
- Funktion `kontakte_merge(uuid, uuid)` - führt zwei Kontakte zusammen

### 2. AutoMerge (Migration 005)

**Datei:** `20260126*_auto_merge`

- Funktion `kontakte_auto_merge(confidence_threshold)`
- Verbesserte `kontakte_find_duplicates()` mit aktiv-Filter
- Schwellwerte: Email=1.0, Firma+PLZ=0.8, Name+PLZ=0.7

### 3. Edge Functions

| Function | Status | Beschreibung |
|----------|--------|--------------|
| `kontakte-push` | ACTIVE | Zentraler Push zu Monday/MS365/Softr |
| `kontakte-auto-merge` | ACTIVE | Wrapper für RPC kontakte_auto_merge |

### 4. Cron-Jobs (pg_cron)

| Job-ID | Name | Schedule | Beschreibung |
|--------|------|----------|--------------|
| 13 | kontakte-sync-hero | 0 2 * * * | Hero Inbound täglich 02:00 |
| 14 | kontakte-sync-ms365 | 0 3 * * * | MS365 Inbound täglich 03:00 |
| 15 | kontakte-sync-monday | 0 4 * * * | Monday Inbound täglich 04:00 |
| 16 | kontakte-auto-merge | 0 5 * * * | AutoMerge täglich 05:00 |

---

## Architektur

```
                    SUPABASE (MASTER)
                          │
              ┌───────────┴───────────┐
              │  DB-Trigger (sofort)  │
              │  trg_kontakte_push    │
              └───────────┬───────────┘
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   Monday.com         MS 365          Softr.io
   (sofort)          (sofort)        (sofort)
        ▲                 ▲                 ▲
        │                 │                 │
   Inbound 04:00    Inbound 03:00    Manuell
```

---

## Verifizierung

### Trigger prüfen
```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_kontakte_push';
-- Ergebnis: trg_kontakte_push | O (enabled)
```

### Funktionen prüfen
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('kontakte_merge', 'kontakte_auto_merge', 'kontakte_push_trigger');
-- Ergebnis: kontakte_auto_merge, kontakte_merge, kontakte_push_trigger
```

### Cron-Jobs prüfen
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'kontakte%';
-- Ergebnis: 4 Jobs (02:00, 03:00, 04:00, 05:00)
```

### Edge Functions prüfen
- kontakte-push: ACTIVE (ID: f3c61b59-38d6-49f7-9513-74c14c020b39)
- kontakte-auto-merge: ACTIVE (ID: 9e3b624a-820f-4c9c-b96c-8b8dd2785b00)

---

## Test-Befehle

```bash
# Push manuell testen
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-push \
  -H "Content-Type: application/json" \
  -d '{"kontakt_id": "UUID-HIER", "targets": ["monday", "ms365", "softr"]}'

# AutoMerge testen
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-auto-merge

# AutoMerge mit Threshold
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-auto-merge?threshold=0.9"
```

```sql
-- Duplikate finden
SELECT * FROM kontakte_find_duplicates() WHERE confidence >= 0.8;

-- AutoMerge ausführen
SELECT * FROM kontakte_auto_merge(0.8);

-- Push-Log prüfen
SELECT * FROM kontakte_sync_log
WHERE direction = 'outbound'
ORDER BY synced_at DESC LIMIT 10;

-- Merge-Log prüfen
SELECT * FROM kontakte_sync_log
WHERE source = 'auto_merge'
ORDER BY synced_at DESC LIMIT 5;
```

---

## Aktualisierte Dokumentation

- `docs/NEUREALIS_KONTAKTE.md` - Version 2.0 (Bidirektionaler Sync)

---

## Offene Punkte / Nächste Schritte

1. **Softr Kontakte-Tabelle konfigurieren** - `SOFTR_KONTAKTE_TABLE_ID` Secret setzen
2. **MS365 Credentials prüfen** - Graph API Berechtigungen für Kontakt-Erstellung
3. **Monday Column-IDs verifizieren** - Mapping in kontakte-push ggf. anpassen
4. **End-to-End Test** - Kontakt ändern → Push prüfen → externe Systeme verifizieren

---

*Session abgeschlossen am 2026-01-26*
