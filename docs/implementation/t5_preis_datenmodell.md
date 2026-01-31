# T5: Erweitertes Preis-Datenmodell

**Status:** Konzept fertig - Klärungsbedarf
**Datum:** 2026-01-30
**Autor:** Subagent T5

---

## Analyse der bestehenden Struktur

### Aktuelle Tabellen

| Tabelle | Zweck | Relevante Felder |
|---------|-------|------------------|
| `lv_positionen` | 3.057 Positionen | artikelnummer, preis (EK), listenpreis, lv_typ, gewerk |
| `auftraggeber` | 7 Kunden | id, kurzname (VBW, GWS, covivio, etc.) |
| `kontakte` | Alle Kontakte | kontaktarten (Array mit "Nachunternehmer") |
| `kontakte_nachunternehmer` | NU-Details | 0 Einträge aktuell, stundensatz_geselle/meister |
| `lv_preis_historie` | Preisänderungen | T1 bereits implementiert |
| `angebots_drafts` | Angebote | lv_typ als Text |

### Aktueller lv_typ-Ansatz (Problem)

```
lv_positionen.lv_typ = TEXT ('GWS', 'VBW', 'covivio', etc.)
```

**Problem:** Eine Position kann nur EINEM Auftraggeber zugeordnet werden. In der Realität kann dieselbe Leistung (z.B. "Zimmertür einbauen") für verschiedene Auftraggeber mit unterschiedlichen Preisen angeboten werden.

### Preisstruktur (aktuell)

| Feld | Bedeutung | Beispiel GWS |
|------|-----------|--------------|
| `preis` | EK-Preis (neurealis zahlt an NU) | 215.57 |
| `listenpreis` | EP (Kunde zahlt an neurealis) | 365.00 |

**Implizite Marge:** (365 - 215.57) / 365 = **40.9%**

---

## Anforderungen zusammengefasst

1. **Position m:n Auftraggeber** - Eine Position kann mehreren AGs zugeordnet sein
2. **Auftraggeber-spezifische Margen** - VBW: 25%, GWS: 31%
3. **NU-spezifische Margen** - Teambau: 35%, Top Handwerker: 31%
4. **NU-Marge kann pro AG unterschiedlich sein** - Komplexeste Anforderung!
5. **Angebotserstellung:** NU auswählen -> Marge wird berechnet

---

## ER-Diagramm (textuell)

```
┌───────────────────┐
│   auftraggeber    │
├───────────────────┤
│ id (PK)           │
│ kurzname          │
│ name              │
│ ist_aktiv         │
│ default_marge_%   │◄─── NEU: Standard-Marge
└────────┬──────────┘
         │
         │ 1:n
         ▼
┌────────────────────────────┐
│  lv_positionen_auftraggeber │ ◄─── NEU: m:n Zuordnung
├────────────────────────────┤
│ id (PK)                    │
│ lv_position_id (FK)        │───────┐
│ auftraggeber_id (FK)       │       │
│ ep_netto (Einheitspreis)   │       │
│ gueltig_ab                 │       │
│ gueltig_bis                │       │
│ ist_aktiv                  │       │
└────────────────────────────┘       │
                                     │
         ┌───────────────────────────┘
         │
         ▼
┌───────────────────┐
│   lv_positionen   │
├───────────────────┤
│ id (PK)           │
│ artikelnummer     │
│ bezeichnung       │
│ beschreibung      │
│ einheit           │
│ preis (EK-Basis)  │◄─── Bleibt: EK an Standard-NU
│ listenpreis       │◄─── Deprecated, ersetzt durch EP pro AG
│ gewerk            │
│ lv_typ            │◄─── Wird: source ('GWS', 'Hero', 'Manual')
│ aktiv             │
└────────┬──────────┘
         │
         │ n:m (via Zuordnung)
         ▼
┌───────────────────────────────┐
│ nachunternehmer_konditionen   │ ◄─── NEU: NU-Konditionen
├───────────────────────────────┤
│ id (PK)                       │
│ kontakt_id (FK -> kontakte)   │ ◄── NU-Kontakt
│ auftraggeber_id (FK)          │ ◄── Optional: AG-spezifisch
│ gewerk                        │ ◄── Für welches Gewerk
│ marge_prozent                 │ ◄── z.B. 35% für Teambau
│ stundensatz                   │ ◄── Optional: Stundensatz
│ gueltig_ab                    │
│ gueltig_bis                   │
│ ist_aktiv                     │
│ notiz                         │
└───────────────────────────────┘
         │
         │ Optional: Positions-spezifisch
         ▼
┌─────────────────────────────────────┐
│ nachunternehmer_position_preise     │ ◄─── NEU: Optional
├─────────────────────────────────────┤
│ id (PK)                             │
│ kontakt_id (FK -> kontakte)         │ ◄── NU-Kontakt
│ lv_position_id (FK)                 │ ◄── Konkrete Position
│ auftraggeber_id (FK)                │ ◄── Optional: AG-spezifisch
│ ek_preis                            │ ◄── Individueller EK
│ gueltig_ab                          │
│ gueltig_bis                         │
│ ist_aktiv                           │
└─────────────────────────────────────┘
```

---

## Neue Tabellen

### 1. `lv_positionen_auftraggeber` (m:n Zuordnung + EP)

**Zweck:** Eine Position mehreren Auftraggebern mit individuellem EP zuordnen.

```sql
CREATE TABLE lv_positionen_auftraggeber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lv_position_id UUID NOT NULL REFERENCES lv_positionen(id) ON DELETE CASCADE,
  auftraggeber_id UUID NOT NULL REFERENCES auftraggeber(id) ON DELETE RESTRICT,

  -- Preis
  ep_netto NUMERIC NOT NULL,                    -- Einheitspreis (Kunde zahlt)

  -- Gültigkeit
  gueltig_ab DATE DEFAULT CURRENT_DATE,
  gueltig_bis DATE,                             -- NULL = unbefristet
  ist_aktiv BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_position_auftraggeber_aktiv
    UNIQUE (lv_position_id, auftraggeber_id, gueltig_ab)
);

-- Indexes
CREATE INDEX idx_lv_pos_ag_position ON lv_positionen_auftraggeber(lv_position_id);
CREATE INDEX idx_lv_pos_ag_auftraggeber ON lv_positionen_auftraggeber(auftraggeber_id);
CREATE INDEX idx_lv_pos_ag_aktiv ON lv_positionen_auftraggeber(ist_aktiv) WHERE ist_aktiv = true;
```

### 2. `auftraggeber` erweitern

```sql
ALTER TABLE auftraggeber
ADD COLUMN default_marge_prozent NUMERIC DEFAULT 25.0,
ADD COLUMN zahlungsziel_tage INTEGER DEFAULT 30,
ADD COLUMN skonto_prozent NUMERIC DEFAULT 0,
ADD COLUMN notizen TEXT;

COMMENT ON COLUMN auftraggeber.default_marge_prozent IS 'Standard-Marge für diesen AG (VBW: 25%, GWS: 31%)';
```

### 3. `nachunternehmer_konditionen` (NU-Margen)

**Zweck:** Margen pro NU, optional pro Auftraggeber und Gewerk.

```sql
CREATE TABLE nachunternehmer_konditionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,
  auftraggeber_id UUID REFERENCES auftraggeber(id) ON DELETE SET NULL,  -- NULL = gilt für alle
  gewerk TEXT,                                   -- NULL = gilt für alle Gewerke

  -- Konditionen
  marge_prozent NUMERIC NOT NULL,               -- z.B. 35 für 35%
  stundensatz_geselle NUMERIC,
  stundensatz_meister NUMERIC,

  -- Gültigkeit
  gueltig_ab DATE DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  ist_aktiv BOOLEAN DEFAULT true,

  -- Audit
  notiz TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints: Nur eine aktive Kondition pro Kombination
  CONSTRAINT uq_nu_kondition_kombination
    UNIQUE NULLS NOT DISTINCT (kontakt_id, auftraggeber_id, gewerk, gueltig_ab)
);

-- Indexes
CREATE INDEX idx_nu_kond_kontakt ON nachunternehmer_konditionen(kontakt_id);
CREATE INDEX idx_nu_kond_auftraggeber ON nachunternehmer_konditionen(auftraggeber_id);
CREATE INDEX idx_nu_kond_gewerk ON nachunternehmer_konditionen(gewerk);
CREATE INDEX idx_nu_kond_aktiv ON nachunternehmer_konditionen(ist_aktiv) WHERE ist_aktiv = true;
```

### 4. `nachunternehmer_position_preise` (Optional: individuelle EK-Preise)

**Zweck:** Wenn ein NU für eine bestimmte Position einen anderen EK-Preis hat.

```sql
CREATE TABLE nachunternehmer_position_preise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,
  lv_position_id UUID NOT NULL REFERENCES lv_positionen(id) ON DELETE CASCADE,
  auftraggeber_id UUID REFERENCES auftraggeber(id) ON DELETE SET NULL,  -- NULL = Standard

  -- Preis
  ek_preis NUMERIC NOT NULL,                    -- Individueller EK für diesen NU

  -- Gültigkeit
  gueltig_ab DATE DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  ist_aktiv BOOLEAN DEFAULT true,

  -- Audit
  notiz TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_nu_pos_preis_kombination
    UNIQUE NULLS NOT DISTINCT (kontakt_id, lv_position_id, auftraggeber_id, gueltig_ab)
);

-- Indexes
CREATE INDEX idx_nu_pos_preis_kontakt ON nachunternehmer_position_preise(kontakt_id);
CREATE INDEX idx_nu_pos_preis_position ON nachunternehmer_position_preise(lv_position_id);
```

---

## Preisberechnung (Logik)

### Angebotserstellung: EP -> EK -> Marge

```
Eingabe:
  - lv_position_id (welche Position)
  - auftraggeber_id (welcher Kunde)
  - kontakt_id (welcher NU)

Schritte:
1. EP holen:
   SELECT ep_netto FROM lv_positionen_auftraggeber
   WHERE lv_position_id = ? AND auftraggeber_id = ?
   AND ist_aktiv = true AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
   ORDER BY gueltig_ab DESC LIMIT 1;

2. EK holen (Priorität):
   a) Individueller NU-Position-Preis (nachunternehmer_position_preise)
   b) Standard EK aus lv_positionen.preis

3. Marge holen (Priorität):
   a) NU + AG + Gewerk spezifisch
   b) NU + AG (alle Gewerke)
   c) NU + Gewerk (alle AGs)
   d) NU global (alle AGs, alle Gewerke)
   e) Fallback: auftraggeber.default_marge_prozent

4. Berechnung:
   marge_betrag = EK * (marge_prozent / 100)
   verkaufspreis_nu = EK + marge_betrag

   -- Prüfung: verkaufspreis_nu sollte <= EP sein
   IF verkaufspreis_nu > EP THEN
     warnung = 'Marge nicht erreichbar!'
```

### SQL-Funktion: `fn_get_position_preis`

```sql
CREATE OR REPLACE FUNCTION fn_get_position_preis(
  p_lv_position_id UUID,
  p_auftraggeber_id UUID,
  p_nu_kontakt_id UUID DEFAULT NULL
)
RETURNS TABLE (
  ep_netto NUMERIC,
  ek_netto NUMERIC,
  marge_prozent NUMERIC,
  verkaufspreis_nu NUMERIC,
  marge_betrag NUMERIC,
  marge_realisierbar BOOLEAN
) AS $$
DECLARE
  v_ep NUMERIC;
  v_ek NUMERIC;
  v_marge NUMERIC;
  v_gewerk TEXT;
BEGIN
  -- 1. EP holen
  SELECT pa.ep_netto INTO v_ep
  FROM lv_positionen_auftraggeber pa
  WHERE pa.lv_position_id = p_lv_position_id
    AND pa.auftraggeber_id = p_auftraggeber_id
    AND pa.ist_aktiv = true
  ORDER BY pa.gueltig_ab DESC LIMIT 1;

  -- Fallback: lv_positionen.listenpreis
  IF v_ep IS NULL THEN
    SELECT lp.listenpreis INTO v_ep
    FROM lv_positionen lp WHERE lp.id = p_lv_position_id;
  END IF;

  -- 2. Gewerk holen
  SELECT lp.gewerk INTO v_gewerk
  FROM lv_positionen lp WHERE lp.id = p_lv_position_id;

  -- 3. EK holen (individuell oder Standard)
  IF p_nu_kontakt_id IS NOT NULL THEN
    SELECT npp.ek_preis INTO v_ek
    FROM nachunternehmer_position_preise npp
    WHERE npp.lv_position_id = p_lv_position_id
      AND npp.kontakt_id = p_nu_kontakt_id
      AND (npp.auftraggeber_id = p_auftraggeber_id OR npp.auftraggeber_id IS NULL)
      AND npp.ist_aktiv = true
    ORDER BY npp.auftraggeber_id NULLS LAST, npp.gueltig_ab DESC
    LIMIT 1;
  END IF;

  -- Fallback: Standard-EK
  IF v_ek IS NULL THEN
    SELECT lp.preis INTO v_ek
    FROM lv_positionen lp WHERE lp.id = p_lv_position_id;
  END IF;

  -- 4. Marge holen (Kaskade)
  IF p_nu_kontakt_id IS NOT NULL THEN
    SELECT nk.marge_prozent INTO v_marge
    FROM nachunternehmer_konditionen nk
    WHERE nk.kontakt_id = p_nu_kontakt_id
      AND (nk.auftraggeber_id = p_auftraggeber_id OR nk.auftraggeber_id IS NULL)
      AND (nk.gewerk = v_gewerk OR nk.gewerk IS NULL)
      AND nk.ist_aktiv = true
    ORDER BY
      nk.auftraggeber_id NULLS LAST,
      nk.gewerk NULLS LAST,
      nk.gueltig_ab DESC
    LIMIT 1;
  END IF;

  -- Fallback: AG Default-Marge
  IF v_marge IS NULL THEN
    SELECT ag.default_marge_prozent INTO v_marge
    FROM auftraggeber ag WHERE ag.id = p_auftraggeber_id;
  END IF;

  -- 5. Berechnung
  RETURN QUERY SELECT
    v_ep AS ep_netto,
    v_ek AS ek_netto,
    v_marge AS marge_prozent,
    ROUND(v_ek * (1 + COALESCE(v_marge, 0) / 100), 2) AS verkaufspreis_nu,
    ROUND(v_ek * COALESCE(v_marge, 0) / 100, 2) AS marge_betrag,
    (v_ek * (1 + COALESCE(v_marge, 0) / 100)) <= v_ep AS marge_realisierbar;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration bestehender Daten

### lv_typ -> source umbenennen

Das Feld `lv_typ` wird aktuell als Auftraggeber-Zuordnung missbraucht.

**Vorschlag:**
1. Neues Feld `source` für die Datenquelle (GWS-Import, Hero, Manual)
2. Bestehende Daten in `lv_positionen_auftraggeber` migrieren

```sql
-- 1. Source-Feld hinzufügen
ALTER TABLE lv_positionen ADD COLUMN source TEXT;
UPDATE lv_positionen SET source = lv_typ;

-- 2. Bestehende Zuordnungen migrieren
INSERT INTO lv_positionen_auftraggeber (lv_position_id, auftraggeber_id, ep_netto)
SELECT
  lp.id,
  ag.id,
  COALESCE(lp.listenpreis, lp.preis * 1.35) -- Fallback: 35% Aufschlag
FROM lv_positionen lp
JOIN auftraggeber ag ON ag.kurzname = lp.lv_typ
WHERE lp.lv_typ IN ('GWS', 'VBW', 'covivio', 'Privat', 'WBG Lünen');

-- 3. Später: lv_typ deprecaten
-- ALTER TABLE lv_positionen DROP COLUMN lv_typ;
```

---

## Offene Fragen (Klärungsbedarf!)

### 1. Preisberechnungs-Richtung?

**Option A: EP -> EK (aktuell vermutet)**
- EP ist fix (vom Kunden vorgegeben)
- EK = EP / (1 + marge%)
- Problem: EK variiert je nach NU-Marge

**Option B: EK -> EP**
- EK ist fix (was der NU kostet)
- EP = EK * (1 + marge%)
- Problem: EP variiert je nach NU-Marge

**Frage:** Welche Richtung ist korrekt? Oder beides parallel?

### 2. Was bedeutet "Marge"?

**Option A: Aufschlag auf EK**
```
EP = EK * (1 + 35/100) = EK * 1.35
```

**Option B: Marge vom EP**
```
EK = EP * (1 - 35/100) = EP * 0.65
```

**Frage:** Ist die Marge ein Aufschlag auf den EK oder ein Abzug vom EP?

### 3. Sind alle Positionen für alle AGs verfügbar?

Aktuell: Jede Position hat einen festen `lv_typ`.

**Frage:** Sollen GWS-Positionen auch für VBW angeboten werden können (mit anderem Preis)?

### 4. Eigene Leute vs. NU

**Erwähnt:** "Eigene Leute: Artikelstamm mit Materialkosten"

**Frage:**
- Gibt es einen internen "NU" (neurealis selbst)?
- Wie werden Materialkosten vs. Lohnkosten getrennt?
- Brauchen wir eine `lv_positionen_zusammensetzung`-Tabelle?

### 5. Zeitaufwand pro Position

**Erwähnt:** "Später: Zeitaufwand pro Position"

**Frage:** Soll das jetzt schon im Modell berücksichtigt werden?

```sql
-- Mögliche Erweiterung:
ALTER TABLE lv_positionen ADD COLUMN zeitaufwand_minuten INTEGER;
-- Oder komplexer:
CREATE TABLE lv_positionen_zeitaufwand (
  id UUID PRIMARY KEY,
  lv_position_id UUID REFERENCES lv_positionen(id),
  qualifikation TEXT, -- 'geselle', 'meister', 'helfer'
  minuten INTEGER,
  ist_standard BOOLEAN DEFAULT true
);
```

---

## Empfehlung: Phasen-Ansatz

### Phase 1: Kern-Modell (Sofort)

1. `lv_positionen_auftraggeber` erstellen
2. `auftraggeber.default_marge_prozent` hinzufügen
3. `nachunternehmer_konditionen` erstellen
4. Migration bestehender Daten

### Phase 2: Feintuning (Nach Klärung)

1. `nachunternehmer_position_preise` (wenn nötig)
2. SQL-Funktionen für Preisberechnung
3. Views für Angebotserstellung

### Phase 3: Erweiterungen (Später)

1. Zeitaufwand pro Position
2. Materiallisten / Zusammensetzung
3. Historisierung aller Preise (nicht nur lv_positionen)

---

## Zusammenfassung

| Was | Status | Aufwand |
|-----|--------|---------|
| Datenmodell-Konzept | Fertig | - |
| ER-Diagramm | Fertig | - |
| SQL-Entwürfe | Fertig | - |
| Klärung offener Fragen | **AUSSTEHEND** | User-Input |
| Migration erstellen | Nach Klärung | 1h |
| SQL-Funktionen | Nach Klärung | 2h |
| UI-Anpassungen | Nach Klärung | 4h+ |

---

*Erstellt: 2026-01-30 von Subagent T5*
