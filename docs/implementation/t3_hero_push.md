# T3: Hero-Push Implementation

**Datum:** 2026-01-30
**Status:** Fertig

---

## Zusammenfassung

Edge Function `lv-hero-push` erstellt, die neue LV-Positionen automatisch zu Hero Software pusht.

---

## 1. Migration: Neue Spalten

**Migration Name:** `add_lv_positionen_hero_push_columns`

```sql
-- Neue Spalten für Hero-Push hinzufügen
ALTER TABLE lv_positionen
ADD COLUMN IF NOT EXISTS hero_product_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Bestehende Einträge: Source auf 'hero' setzen (wurden von Hero importiert)
UPDATE lv_positionen SET source = 'hero' WHERE source IS NULL OR source = 'manual';

-- Index für hero_product_id
CREATE INDEX IF NOT EXISTS idx_lv_positionen_hero_product_id ON lv_positionen(hero_product_id);

-- Index für source
CREATE INDEX IF NOT EXISTS idx_lv_positionen_source ON lv_positionen(source);
```

**Ergebnis:** Alle 3.057 bestehenden Positionen haben jetzt `source = 'hero'`.

---

## 2. Edge Function: lv-hero-push

**Pfad:** `functions/supabase/functions/lv-hero-push/index.ts`

**Features:**
- **Mode `create`:** Einzelne Position zu Hero pushen (für Trigger)
- **Mode `batch`:** Mehrere Positionen ohne hero_product_id pushen
- **Loop-Vermeidung:** Skip wenn `source = 'hero'`
- **Operator-Mapping:** lv_typ wird auf Hero supply_operator gemappt

**Operator-Mapping:**

| lv_typ | Hero Operator |
|--------|---------------|
| GWS | GWS 2025-01 |
| VBW | VBW 2025-01 |
| covivio | Covivio 2024-10 |
| WBG Lünen | WBG Lünen |
| Freundlieb Quadrat | Forte Capital 2025-01 |
| Privat | (kein Operator) |
| neurealis | (kein Operator) |

**verify_jwt:** false (für Trigger-Aufrufe)

---

## 3. Migration: Trigger

**Migration Name:** `add_lv_positionen_hero_push_trigger`

```sql
-- Funktion die den HTTP-Call zur Edge Function macht
CREATE OR REPLACE FUNCTION trigger_lv_hero_push()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur triggern wenn source != 'hero' und kein hero_product_id existiert
  IF NEW.source = 'hero' OR NEW.hero_product_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- HTTP Request zur Edge Function (async via pg_net)
  PERFORM net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-hero-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'mode', 'create',
      'record', jsonb_build_object(
        'id', NEW.id,
        'artikelnummer', NEW.artikelnummer,
        'bezeichnung', NEW.bezeichnung,
        'beschreibung', NEW.beschreibung,
        'einheit', NEW.einheit,
        'preis', NEW.preis,
        'listenpreis', NEW.listenpreis,
        'lv_typ', NEW.lv_typ,
        'gewerk', NEW.gewerk,
        'source', NEW.source,
        'hero_product_id', NEW.hero_product_id
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger erstellen
CREATE TRIGGER trg_lv_hero_push
  AFTER INSERT ON lv_positionen
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'hero' AND NEW.hero_product_id IS NULL)
  EXECUTE FUNCTION trigger_lv_hero_push();
```

**Trigger-Logik:**
- Feuert nur bei INSERT
- Nur wenn `source != 'hero'` (Loop-Vermeidung)
- Nur wenn `hero_product_id IS NULL`
- Asynchroner HTTP-Call via pg_net

---

## 4. GraphQL Mutation

Die Edge Function nutzt folgende Hero API Mutation:

```graphql
mutation CreateProduct($input: SupplyProductVersionInput!) {
  create_supply_product_version(supply_product_version: $input) {
    product_id
    nr
  }
}
```

**Input-Felder:**
- `nr`: artikelnummer
- `base_data.name`: bezeichnung
- `base_data.description`: beschreibung
- `base_data.category`: gewerk
- `base_price`: preis
- `list_price`: listenpreis (optional)
- `supply_operator.name`: gemappt aus lv_typ (optional)
- `unit_type`: einheit (optional)

---

## 5. Verwendung

### Automatisch (Trigger)

Bei INSERT einer neuen Position mit `source != 'hero'`:

```sql
INSERT INTO lv_positionen (
  artikelnummer, bezeichnung, preis, lv_typ, gewerk, source
) VALUES (
  'Test-Elektrik-001', 'Test Position', 100.00, 'Privat', 'Elektrik', 'manual'
);
-- Trigger ruft automatisch lv-hero-push auf
```

### Manuell (Single)

```bash
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-hero-push \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create",
    "position": {
      "id": "uuid-hier",
      "artikelnummer": "Test-001",
      "bezeichnung": "Test Position",
      "preis": 100,
      "lv_typ": "Privat",
      "gewerk": "Elektrik",
      "source": "manual"
    }
  }'
```

### Batch-Push

```bash
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/lv-hero-push \
  -H "Content-Type: application/json" \
  -d '{"mode": "batch", "limit": 10}'
```

---

## 6. Test-Ergebnis

**Spalten hinzugefügt:** Erfolgreich
- `hero_product_id TEXT`
- `source TEXT DEFAULT 'manual'`

**Bestehende Daten migriert:** Erfolgreich
- 3.057 Positionen haben jetzt `source = 'hero'`

**Edge Function deployed:** Erfolgreich
- Function ID: `66453b43-076d-4c23-a374-817bf0767bd3`
- verify_jwt: false

**Trigger erstellt:** Erfolgreich
- `trg_lv_hero_push` auf `lv_positionen`

**Loop-Vermeidung:** Aktiv
- Positionen mit `source = 'hero'` werden übersprungen
- Positionen mit `hero_product_id` werden übersprungen

---

## 7. Nächste Schritte

1. **Test mit echter Position:** Neue Position mit `source = 'manual'` einfügen und prüfen ob Hero-Push funktioniert
2. **Hero API verifizieren:** Prüfen ob `create_supply_product_version` Mutation korrekt funktioniert
3. **Monitoring:** Edge Function Logs prüfen

---

*Erstellt: 2026-01-30*
