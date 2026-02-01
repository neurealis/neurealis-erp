# Monday Bidirektional Sync - Koordination

**Status:** ✅ FERTIG
**Erstellt:** 2026-02-01
**Abgeschlossen:** 2026-02-01

---

## Anforderungen - ALLE ERFÜLLT

| # | Feature | Status |
|---|---------|--------|
| 1 | Alle Monday-Spalten auslesen | ✅ 338 Spalten dokumentiert |
| 2 | Supabase-Spalten erweitern | ✅ 97 Spalten vorhanden |
| 3 | monday-sync v2: Volles Column-Mapping | ✅ 81 Spalten gemappt |
| 4 | monday-push v3: Supabase → Monday | ✅ 17 sichere Spalten |
| 5 | Trigger für Supabase-Änderungen | ✅ `trg_monday_bauprozess_change` |
| 6 | Cron-Job für regelmäßigen Sync | ✅ Beide aktiv |
| 7 | Loop-Vermeidung (sync_source) | ✅ Implementiert |
| 8 | Testen | ✅ 201 Items synced, 50 pushed |

---

## Implementierte Komponenten

### Edge Functions

| Function | Version | Richtung | Spalten | Beschreibung |
|----------|---------|----------|---------|--------------|
| `monday-sync` | v2 (16) | Monday → Supabase | 81 | Vollständiges Column-Mapping |
| `monday-push` | v3 (8) | Supabase → Monday | 17 | Nur sichere Spalten (Text, Number, Date, Link) |

### Cron-Jobs

| Job | Schedule | Beschreibung |
|-----|----------|--------------|
| `monday-sync-job` | `*/5 * * * *` | Alle 5 Min: Monday → Supabase |
| `monday-push-job` | `2,7,12,...` | Alle 5 Min (versetzt): Supabase → Monday |

### DB-Trigger

```sql
CREATE TRIGGER trg_monday_bauprozess_change
  BEFORE UPDATE ON monday_bauprozess
  FOR EACH ROW
  EXECUTE FUNCTION monday_bauprozess_change_trigger();
```

**Funktion:** Setzt `sync_source = 'supabase'` und `last_supabase_change_at = NOW()` bei lokalen Updates.

---

## Column Mapping

### Monday → Supabase (81 Spalten)

**Kategorien:**
- Identifikation: atbs_nummer, status_projekt, auftraggeber, adresse, bauleiter
- Budget/Finanzen: budget, nua_netto, wohnflaeche, anzahl_zimmer
- Termine: baustart, bauende, datum_erstbegehung, datum_endbegehung, etc.
- Gewerk-Status: status_elektrik, status_sanitaer, status_maler, etc.
- Ausführungsarten: ausfuehrung_elektrik, ausfuehrung_sanitaer, etc.
- Links: hero_link, sharepoint_link, matterport_link, etc.
- Dateien: datei_angebot, datei_ab, datei_nua, etc.

### Supabase → Monday (17 sichere Spalten)

**Nur Text, Number, Date, Link** (keine Status-Spalten wegen Label-Mismatch):

```typescript
const REVERSE_COLUMN_MAPPING = {
  // Text
  'atbs_nummer': 'text49__1',
  'auftraggeber': 'text_mkm11jca',
  'adresse': 'text51__1',
  'bauleiter': 'text_mkn8ggev',
  'nachunternehmer': 'text57__1',
  'notizen': 'text71__1',

  // Number
  'budget': 'zahlen1__1',
  'nua_netto': 'numeric65__1',
  'anzahl_zimmer': 'zahlen2__1',
  'wohnflaeche': 'zahlen4__1',

  // Date
  'baustart': 'datum2__1',
  'bauende': 'datum7__1',

  // Link
  'hero_link': 'link__1',
  'sharepoint_link': 'link_mkn32ss7',
  'matterport_link': 'link_mkn3a98q',
};
```

---

## Loop-Vermeidung

```
┌──────────────┐     sync_source='monday'      ┌──────────────┐
│   Monday     │ ─────────────────────────────▶│   Supabase   │
│   Board      │                               │   Tabelle    │
│              │◀───────────────────────────── │              │
└──────────────┘     sync_source='supabase'    └──────────────┘
                     (nur wenn != 'monday')
```

**Trigger-Logik:**
- Wenn `sync_source` auf `'monday'` gesetzt wird → Trigger ignoriert
- Bei anderen Updates → `sync_source = 'supabase'`, `last_supabase_change_at = NOW()`

**Push-Logik:**
- Nur Items mit `sync_source = 'supabase'` werden gepusht
- Nach Push: `last_monday_push_at = NOW()`

---

## Test-Ergebnisse

### monday-sync v2
```json
{
  "success": true,
  "version": "v2",
  "total_items": 201,
  "created": 4,
  "updated": 0,
  "errors": 0,
  "mapped_columns": 81,
  "duration_ms": 42660
}
```

### monday-push v3
```json
{
  "success": true,
  "version": "v3",
  "items_checked": 50,
  "items_pushed": 50,
  "items_failed": 0,
  "mapped_columns": 17,
  "duration_ms": 104932
}
```

---

## Dokumentation

- `docs/MONDAY_COLUMN_MAPPING.md` - Vollständige Mapping-Dokumentation
- `docs/monday_column_mapping.json` - Maschinenlesbares Mapping

---

## Bekannte Einschränkungen

1. **Status-Spalten nicht bidirektional:** Monday Status-Labels sind strikt definiert und stimmen nicht immer mit Supabase-Werten überein → nur Monday → Supabase
2. **Rate Limiting:** Monday API limitiert Requests → ~2 Min für 50 Items
3. **338 vs 81 Spalten:** Nur ~24% der Monday-Spalten werden gemappt (Rest in column_values JSONB)

---

*Erstellt: 2026-02-01*
*Abgeschlossen: 2026-02-01*
