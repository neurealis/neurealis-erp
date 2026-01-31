# T1: DB-Schema für CPQ-System - Ergebnis

**Datum:** 2026-01-30
**Status:** Erfolgreich abgeschlossen

---

## Erstellte Tabellen

### 1. lv_config

Konfiguration pro LV-Typ mit Gewerken und Besonderheiten.

```sql
CREATE TABLE lv_config (
  id SERIAL PRIMARY KEY,
  lv_typ TEXT UNIQUE NOT NULL,
  gewerke JSONB NOT NULL,
  besonderheiten JSONB,
  prompt_hints TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Befüllte Daten:**

| LV-Typ | Anzahl Gewerke | Aktiv |
|--------|----------------|-------|
| GWS | 46 | true |
| VBW | 23 | true |
| neurealis | 35 | true |

**GWS-Gewerke (Auszug):**
- Abbruch,- u. Rückbauarbeiten
- Asbestsanierung
- Bodenbelagsarbeiten
- Elektrik / Elektroarbeiten
- Fliesen,u. Plattenarbeiten
- Heizung / HLS
- Maler- u. Lackierarbeiten
- Sanitär (+ Wahlpositionen: Kermi, Ideal Standard, Vitra)
- Tischler / Tischlerarbeiten
- Wohnungs- u. Zimmertüren

**VBW-Gewerke (Auszug):**
- Allgemein, Bad, Boden, Böden
- Elektrik, Elektro, Elektroarbeiten
- Fenster, Fliesen, Heizung
- Maler, Maurerarbeiten, Reinigung
- Sanitär, Tischler, Türen
- WBG-Elektro-Zulage-Ventilator, Zulagen

**neurealis-Gewerke (Auszug):**
- Alle Standard-Gewerke plus:
- Balkon, Dach, Dämmung, Fassade
- Entsorgung, Rollladen/Rollo
- Teilarbeiten Silikon

---

### 2. angebots_bausteine

Bausteine für Angebote: Angebotsannahme, NUA-Vertragswerk, Bedarfspositionen, Textbausteine.

```sql
CREATE TABLE angebots_bausteine (
  id SERIAL PRIMARY KEY,
  typ TEXT NOT NULL,
  name TEXT NOT NULL,
  beschreibung TEXT,
  inhalt TEXT,
  artikelnummer TEXT,
  einheit TEXT,
  preis NUMERIC(12,2),
  mwst_satz NUMERIC(5,2) DEFAULT 19.00,
  sortierung INT DEFAULT 0,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Befüllte Daten:**

| Typ | Anzahl |
|-----|--------|
| angebotsannahme | 2 |
| bedarfsposition | 10 |
| nua_vertragswerk | 1 |
| textbaustein | 4 |

**Bedarfspositionen:**
| Artikelnummer | Name | Einheit | Preis |
|---------------|------|---------|-------|
| BED-001 | Baustelleneinrichtung | psch | 450,00 € |
| BED-002 | Baustrom-Pauschale | psch | 150,00 € |
| BED-003 | Bauwasser-Pauschale | psch | 100,00 € |
| BED-004 | Containerpauschale 7m³ | Stk | 380,00 € |
| BED-005 | Containerpauschale 10m³ | Stk | 480,00 € |
| BED-006 | Fahrtkosten-Pauschale | psch | 85,00 € |
| BED-007 | Stundenlohn Facharbeiter | Std | 52,00 € |
| BED-008 | Stundenlohn Helfer | Std | 38,00 € |
| BED-009 | Aufmaß-Pauschale | psch | 120,00 € |
| BED-010 | Sperrmüllentsorgung | m³ | 95,00 € |

---

### 3. position_corrections

Lern-System für KI-Positions-Korrekturen mit Embedding-basierter Similarity-Suche.

```sql
CREATE TABLE position_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  original_text_embedding vector(1536),
  falsche_position_id UUID REFERENCES lv_positionen(id),
  korrekte_position_id UUID REFERENCES lv_positionen(id) NOT NULL,
  lv_typ TEXT,
  korrigiert_von UUID REFERENCES auth.users(id),
  korrigiert_am TIMESTAMPTZ DEFAULT now(),
  angewendet_count INT DEFAULT 0,
  confidence NUMERIC(3,2) DEFAULT 1.0
);
```

**Indizes:**
- `idx_position_corrections_embedding` - IVFFlat für Vector-Similarity (lists=100)
- `idx_position_corrections_lv_typ` - für LV-Typ-Filterung
- `idx_position_corrections_korrekte_position` - für Positions-Lookup

---

### 4. RPC-Funktion: search_position_corrections

```sql
CREATE OR REPLACE FUNCTION search_position_corrections(
  query_embedding vector(1536),
  p_lv_typ TEXT DEFAULT NULL,
  match_threshold NUMERIC DEFAULT 0.92,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  original_text TEXT,
  korrekte_position_id UUID,
  similarity NUMERIC
)
```

**Verwendung:**
```sql
SELECT * FROM search_position_corrections(
  '[0.1, 0.2, ...]'::vector(1536),  -- Query-Embedding
  'GWS',                              -- LV-Typ (optional)
  0.92,                               -- Similarity-Threshold
  5                                   -- Max Ergebnisse
);
```

---

## RLS Policies

| Tabelle | Policy | Berechtigung |
|---------|--------|--------------|
| lv_config | lv_config_read_policy | SELECT für authenticated |
| angebots_bausteine | angebots_bausteine_read_policy | SELECT für authenticated |
| position_corrections | position_corrections_read_policy | SELECT für authenticated |
| position_corrections | position_corrections_insert_policy | INSERT für authenticated |
| position_corrections | position_corrections_update_policy | UPDATE für authenticated |

---

## Migrationen

1. `create_lv_config_table` - Tabelle + Index + RLS
2. `create_angebots_bausteine_table` - Tabelle + Indizes + RLS
3. `create_position_corrections_table` - Tabelle + Vector-Index + RLS
4. `create_search_position_corrections_function` - RPC-Funktion

---

## Nächste Schritte

1. **Edge Function** `angebots-cpq` erstellen für KI-basierte Positionssuche
2. **UI-Komponente** für Angebotserstellung mit LV-Auswahl
3. **Korrektur-Workflow** in UI integrieren für Lern-System
4. **Embedding-Service** für position_corrections aufsetzen

---

## Fehler / Probleme

Keine Fehler aufgetreten. Alle Migrationen erfolgreich.
