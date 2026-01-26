# Session Log - Kontaktsync Implementierung

**Datum:** 2026-01-26
**Aktualisiert:** 2026-01-26 (Softr bidirektionaler Sync)
**Thema:** Kontaktmanagement Sync-System fertiggestellt

---

## Implementierte Features

### Edge Functions (Inbound)
- `kontakte-sync-hero` - Hero Software GraphQL API Sync
- `kontakte-sync-monday` - Monday.com Boards (Mitarbeiter, Subunternehmer, Lieferanten)
- `kontakte-sync-ms365` - Microsoft 365 Kontakte (3 Postfächer)
- `softr-sync` (v20) - Softr.io bidirektionaler Sync (Pull + Push)

### Edge Functions (Outbound)
- `kontakte-push` - Push zu externen Systemen bei Änderungen
- `kontakte-auto-merge` - Automatisches Zusammenführen von Duplikaten
- `softr-sync?direction=push` - Push von Supabase zu Softr

### Fixes
- Push-Trigger von BEFORE auf AFTER geändert (FK-Constraint Problem)
- RLS-Policies für Edge Functions angepasst
- Hero GraphQL Query an v7 Schema angepasst (zipcode, country.name)
- `kontakte_find_duplicates()` - Leere Emails werden jetzt ignoriert

### Softr Bidirektionaler Sync (NEU)
- TABLE_MAPPING korrigiert: `'VzvQUdlHStrRtN': 'kontakte'`
- Field-Mapping mit Softr Feld-IDs konfiguriert
- Cron-Job `kontakte-push-softr` (alle 5 Min)

---

## Statistiken nach Sync

| Quelle | Anzahl |
|--------|--------|
| Softr | 141 |
| MS365 | 723 |
| Hero | 272 |
| Monday | 60 |
| **Gesamt aktiv** | **1.096** |
| Deaktiviert (gemerged) | 100 |

---

## Cron-Jobs (aktiv)

| Zeit | Job | Beschreibung |
|------|-----|--------------|
| */2 * * * * | softr-sync-job | Softr → Supabase (alle Tabellen) |
| DB-Trigger | trg_kontakte_softr_push | Supabase → Softr (sofort) |
| 02:00 | kontakte-sync-hero | Hero Kunden importieren |
| 03:00 | kontakte-sync-ms365 | Outlook Kontakte importieren |
| 04:00 | kontakte-sync-monday | MA/NU/Lieferanten aus Monday |
| 05:00 | kontakte-auto-merge | Duplikate zusammenführen |

---

## Secrets konfiguriert

- `HERO_API_KEY` - Hero Software API
- `MS365_TENANT_ID` - Microsoft 365 Tenant
- `MS365_CLIENT_ID` - Azure App Registration
- `MS365_CLIENT_SECRET` - Azure Client Secret

---

## Geänderte/Erstellte Dateien

### Edge Functions
- `functions/supabase/functions/kontakte-sync-hero/index.ts`
- `functions/supabase/functions/kontakte-sync-monday/index.ts`
- `functions/supabase/functions/kontakte-sync-ms365/index.ts`

### Migrationen
- `20260126*_fix_kontakte_rls_for_edge_functions`
- `20260126*_fix_kontakte_push_trigger_to_after`

### Dokumentation
- `docs/NEUREALIS_KONTAKTE.md` (v2.0)
- `docs/SESSION_LOG_2026-01-26_KONTAKTSYNC.md`

---

## Test-Befehle

```bash
# Softr Pull (alle Tabellen)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync?direction=pull" \
  -H "Authorization: Bearer <anon_key>"

# Softr Pull (nur Kontakte)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync?table=VzvQUdlHStrRtN&direction=pull" \
  -H "Authorization: Bearer <anon_key>"

# Kontakte Push zu Softr
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync?direction=push&mode=new" \
  -H "Authorization: Bearer <anon_key>"

# Hero Sync
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-hero

# AutoMerge manuell ausführen
SELECT * FROM kontakte_auto_merge(1.0);

# Statistiken prüfen
SELECT sync_source, COUNT(*) FROM kontakte WHERE aktiv = true GROUP BY sync_source;
```

---

## Softr Feld-IDs

| Supabase | Softr ID |
|----------|----------|
| vorname | TEJzA |
| nachname | 5q31T |
| firma_kurz | fSaxT |
| firma_lang | M4pSo |
| email | GequE |
| telefon_mobil | JeRgU |
| telefon_festnetz | 6z8Bf |
| strasse | xeS8Y |
| plz | aATaA |
| ort | FnmcX |

---

## Erledigte Aufgaben

- [x] Softr.io bidirektionaler Sync für Kontakte
- [x] AutoMerge Bug gefixt (leere Emails)
- [x] 100 Duplikate automatisch gemerged
- [x] Outbound-Push zu Monday/MS365 (via DB-Trigger)
- [x] Push zu Softr (via Cron-Job alle 5 Min)

## Offene Punkte

- [ ] 314 Duplikate mit hero_id Konflikt manuell prüfen
- [ ] Softr Push für weitere Tabellen implementieren

---

*Session abgeschlossen am 2026-01-26*
