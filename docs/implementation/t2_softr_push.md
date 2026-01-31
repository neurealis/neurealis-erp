# T2: Softr-Push Implementation

**Status:** Abgeschlossen
**Datum:** 2026-01-30
**Subagent:** T2

---

## Zusammenfassung

- **Edge Function:** `lv-softr-push` deployed
- **Initial-Push:** 1.485 Positionen erfolgreich zu Softr gepusht
- **Finaler Status:** 3.057/3.057 Positionen synchronisiert (100%)
- **DB-Trigger:** `trg_lv_softr_push` erstellt

---

## Edge Function: lv-softr-push

**URL:** `https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-softr-push`

**verify_jwt:** `false` (fuer Trigger-Aufrufe)

### Modi

| Mode | Methode | Beschreibung |
|------|---------|--------------|
| `push` | POST | Einzelne Position pushen (fuer Trigger) |
| `initial` | GET | Batch-Push aller Positionen ohne softr_record_id |
| `status` | GET | Aktuellen Sync-Status abrufen |

### Beispiel-Aufrufe

```bash
# Status abfragen
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-softr-push?mode=status"

# Batch-Push (100 Positionen)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-softr-push?mode=initial&batch_size=100"

# Einzelne Position pushen
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-softr-push?mode=push" \
  -H "Content-Type: application/json" \
  -d '{"position_id": "uuid-hier"}'
```

### Field-Mapping

| Supabase Column | Softr Field ID |
|-----------------|----------------|
| artikelnummer | fX6z9 |
| lv_typ | WusrR |
| gewerk | l8T6y |
| bezeichnung | NKqqp |
| beschreibung | qhXBj |
| listenpreis | NdeN1 |
| preis | BQUj5 |
| einheit | zcJHy |

---

## DB-Trigger

**Migration:** `add_lv_softr_push_trigger`

```sql
-- Trigger Function fuer automatischen Softr-Push bei INSERT/UPDATE
CREATE OR REPLACE FUNCTION trigger_lv_softr_push()
RETURNS TRIGGER AS $$
DECLARE
  response_status INT;
  response_body TEXT;
BEGIN
  -- Nur pushen wenn es relevante Aenderungen gab
  IF TG_OP = 'UPDATE' THEN
    IF OLD.artikelnummer = NEW.artikelnummer
       AND OLD.lv_typ IS NOT DISTINCT FROM NEW.lv_typ
       AND OLD.gewerk IS NOT DISTINCT FROM NEW.gewerk
       AND OLD.bezeichnung IS NOT DISTINCT FROM NEW.bezeichnung
       AND OLD.beschreibung IS NOT DISTINCT FROM NEW.beschreibung
       AND OLD.listenpreis IS NOT DISTINCT FROM NEW.listenpreis
       AND OLD.preis IS NOT DISTINCT FROM NEW.preis
       AND OLD.einheit IS NOT DISTINCT FROM NEW.einheit
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Async HTTP Call zur Edge Function
  PERFORM net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-softr-push?mode=push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('position_id', NEW.id)::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Softr-Push Trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE TRIGGER trg_lv_softr_push
  AFTER INSERT OR UPDATE ON lv_positionen
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lv_softr_push();
```

**Verhalten:**
- Bei INSERT: Immer pushen
- Bei UPDATE: Nur wenn relevante Felder geaendert wurden (artikelnummer, lv_typ, gewerk, bezeichnung, beschreibung, listenpreis, preis, einheit)
- Verwendet `pg_net` fuer asynchronen HTTP-Call (nicht-blockierend)
- Fehler werden geloggt aber brechen die Transaktion nicht ab

---

## Initial-Push Ergebnis

**Ausgangslage:**
- 3.057 Positionen total
- 1.572 bereits mit softr_record_id
- 1.485 ohne softr_record_id (pending)

**Push-Batches:**

| Batch | Offset | Size | Created | Failed |
|-------|--------|------|---------|--------|
| 1 | 0 | 10 | 10 | 0 |
| 2 | 10 | 100 | 100 | 0 |
| 3 | 110 | 200 | 200 | 0 |
| 4 | 310 | 200 | 200 | 0 |
| 5 | 510 | 200 | 200 | 0 |
| 6 | 710 | 200 | 65 | 0 |
| 7 | 0 | 200 | 200 | 0 |
| 8 | 200 | 200 | 200 | 0 |
| 10 | 0 | 200 | 200 | 0 |
| 11 | 0 | 200 | 110 | 0 |

**Endergebnis:**
```json
{
  "total_positions": 3057,
  "synced_to_softr": 3057,
  "pending_sync": 0
}
```

---

## Softr API Details

- **Database ID:** `e74de047-f727-4f98-aa2a-7bda298672d3`
- **Table ID:** `WdY5U4LHNzDAsW` (Leistungsverzeichnisse)
- **API Key:** Aus Supabase Secret `SOFTR_API_KEY`
- **Rate Limiting:** 100ms zwischen Requests (10 req/s)

---

## Edge Function Code

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Softr API Configuration
const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = Deno.env.get('SOFTR_DATABASE_ID') || 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'WdY5U4LHNzDAsW'; // Leistungsverzeichnisse
const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';

// Supabase Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Field Mapping: Supabase Column -> Softr Field ID
const FIELD_MAPPING: Record<string, string> = {
  'artikelnummer': 'fX6z9',
  'lv_typ': 'WusrR',
  'gewerk': 'l8T6y',
  'bezeichnung': 'NKqqp',
  'beschreibung': 'qhXBj',
  'listenpreis': 'NdeN1',
  'preis': 'BQUj5',
  'einheit': 'zcJHy'
};

// ... (vollstaendiger Code in deployed Function)
```

---

## Naechste Schritte

1. **Monitoring:** Trigger-Logs pruefen bei neuen INSERT/UPDATE
2. **Softr UI:** Pruefen ob alle 3.057 Positionen in Softr sichtbar sind
3. **T3:** Hero-Push fuer neue Positionen implementieren

---

*Erstellt: 2026-01-30 ~12:00*
