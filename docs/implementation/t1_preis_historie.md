# T1: Preis-Historie - Implementierung

**Status:** Fertig
**Datum:** 2026-01-30 12:03
**Migration:** `create_lv_preis_historie`

---

## Was wurde erstellt

### 1. Tabelle `lv_preis_historie`

Speichert automatisch alle Preisänderungen in `lv_positionen`.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primary Key |
| artikelnummer | TEXT | Referenz zur Position |
| preis_alt | NUMERIC | Alter EK-Preis |
| preis_neu | NUMERIC | Neuer EK-Preis |
| listenpreis_alt | NUMERIC | Alter Listenpreis |
| listenpreis_neu | NUMERIC | Neuer Listenpreis |
| aenderung_prozent | NUMERIC | Prozentuale Änderung |
| gueltig_ab | DATE | Datum der Änderung |
| quelle | TEXT | 'hero', 'manual', etc. |
| created_at | TIMESTAMPTZ | Zeitstempel |

### 2. Indexes

- `idx_lv_preis_historie_artikelnummer` - Schnelle Suche nach Artikelnummer
- `idx_lv_preis_historie_gueltig_ab` - Suche nach Zeitraum
- `idx_lv_preis_historie_created_at` - Neueste Einträge zuerst

### 3. Trigger `trg_lv_preis_historie`

- Feuert bei UPDATE auf `lv_positionen`
- Nur wenn `preis` ODER `listenpreis` sich ändert
- Berechnet `aenderung_prozent` automatisch
- Quelle wird via `SET LOCAL app.change_source = 'hero'` gesetzt

---

## SQL Code

```sql
-- Tabelle
CREATE TABLE lv_preis_historie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artikelnummer TEXT NOT NULL,
  preis_alt NUMERIC,
  preis_neu NUMERIC,
  listenpreis_alt NUMERIC,
  listenpreis_neu NUMERIC,
  aenderung_prozent NUMERIC,
  gueltig_ab DATE NOT NULL DEFAULT CURRENT_DATE,
  quelle TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lv_preis_historie_artikelnummer ON lv_preis_historie(artikelnummer);
CREATE INDEX idx_lv_preis_historie_gueltig_ab ON lv_preis_historie(gueltig_ab);
CREATE INDEX idx_lv_preis_historie_created_at ON lv_preis_historie(created_at DESC);

-- Trigger-Funktion
CREATE OR REPLACE FUNCTION fn_lv_preis_historie_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_aenderung_prozent NUMERIC;
  v_preis_geaendert BOOLEAN;
  v_listenpreis_geaendert BOOLEAN;
BEGIN
  v_preis_geaendert := (OLD.preis IS DISTINCT FROM NEW.preis);
  v_listenpreis_geaendert := (OLD.listenpreis IS DISTINCT FROM NEW.listenpreis);

  IF v_preis_geaendert OR v_listenpreis_geaendert THEN
    IF v_preis_geaendert AND OLD.preis IS NOT NULL AND OLD.preis > 0 THEN
      v_aenderung_prozent := ROUND(((NEW.preis - OLD.preis) / OLD.preis * 100)::NUMERIC, 2);
    ELSIF v_listenpreis_geaendert AND OLD.listenpreis IS NOT NULL AND OLD.listenpreis > 0 THEN
      v_aenderung_prozent := ROUND(((NEW.listenpreis - OLD.listenpreis) / OLD.listenpreis * 100)::NUMERIC, 2);
    ELSE
      v_aenderung_prozent := NULL;
    END IF;

    INSERT INTO lv_preis_historie (
      artikelnummer, preis_alt, preis_neu, listenpreis_alt, listenpreis_neu,
      aenderung_prozent, gueltig_ab, quelle
    ) VALUES (
      NEW.artikelnummer,
      CASE WHEN v_preis_geaendert THEN OLD.preis ELSE NULL END,
      CASE WHEN v_preis_geaendert THEN NEW.preis ELSE NULL END,
      CASE WHEN v_listenpreis_geaendert THEN OLD.listenpreis ELSE NULL END,
      CASE WHEN v_listenpreis_geaendert THEN NEW.listenpreis ELSE NULL END,
      v_aenderung_prozent,
      CURRENT_DATE,
      COALESCE(current_setting('app.change_source', true), 'unknown')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trg_lv_preis_historie
AFTER UPDATE ON lv_positionen
FOR EACH ROW
EXECUTE FUNCTION fn_lv_preis_historie_trigger();
```

---

## Testabfragen

```sql
-- Alle Preisänderungen einer Position
SELECT * FROM lv_preis_historie
WHERE artikelnummer = 'GWS.LV23-06.01.15'
ORDER BY created_at DESC;

-- Preisänderungen der letzten 30 Tage
SELECT artikelnummer, preis_alt, preis_neu, aenderung_prozent, quelle
FROM lv_preis_historie
WHERE gueltig_ab >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Größte Preiserhöhungen
SELECT artikelnummer, preis_alt, preis_neu, aenderung_prozent, quelle
FROM lv_preis_historie
WHERE aenderung_prozent IS NOT NULL
ORDER BY aenderung_prozent DESC
LIMIT 10;

-- Anzahl Änderungen pro Quelle
SELECT quelle, COUNT(*) as anzahl
FROM lv_preis_historie
GROUP BY quelle;
```

---

## Test durchgeführt

| Test | Ergebnis |
|------|----------|
| Tabelle erstellt | OK |
| Trigger aktiv | OK |
| Preisänderung +0.01 | Historie-Eintrag erstellt |
| Quelle gesetzt | 'test_trigger' korrekt gespeichert |
| aenderung_prozent | 0.02% korrekt berechnet |
| Rollback -0.01 | -0.02% korrekt berechnet |

---

## Nutzung in Edge Functions

```typescript
// Quelle setzen vor Update
await supabase.rpc('set_config', {
  setting: 'app.change_source',
  value: 'hero'
});

// Oder direkt in SQL
await supabase.from('lv_positionen').update({ preis: 99.99 })...
```

---

*Erstellt: 2026-01-30 12:03*
