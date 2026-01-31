# LV-Sync Implementation Tracker

**Erstellt:** 2026-01-30 ~11:30
**Status:** Abgeschlossen
**Abgeschlossen:** 2026-01-30 ~15:00

---

## Tasks

| ID | Task | Status | Subagent | Output |
|----|------|--------|----------|--------|
| T1 | Preis-Historie: Tabelle + Trigger | **done** | T1 | `implementation/t1_preis_historie.md` |
| T2 | Softr-Push: Edge Function + Initial-Push 1.485 Pos. | **done** | T2 | `implementation/t2_softr_push.md` |
| T3 | Hero-Push: Edge Function für neue Positionen | **done** | T3 | `implementation/t3_hero_push.md` |
| T4 | LV-Import: Konzept-Dokument | **done** | T4 | `implementation/t4_lv_import_konzept.md` |
| T5 | Preis-Datenmodell: m:n AG + NU-Margen | **done** | T5 | `implementation/t5_preis_datenmodell.md` |

---

## Kontext für Subagenten

### Supabase Projekt
- **Projekt-ID:** `mfpuijttdgkllnvhvjlu`
- **URL:** `https://mfpuijttdgkllnvhvjlu.supabase.co`

### Tabellen
- **lv_positionen:** 3.057 Positionen, Spalten: id, artikelnummer (UNIQUE), lv_typ, bezeichnung, beschreibung, einheit, preis, listenpreis, embedding, softr_record_id, gewerk, preis_datum, aktiv, created_at, updated_at

### Softr
- **Table ID:** `WdY5U4LHNzDAsW` (Leistungsverzeichnisse)
- **API:** `https://tables-api.softr.io/api/v1/databases/{DB_ID}/tables/WdY5U4LHNzDAsW/records`
- **Field-Mapping:**
  - artikelnummer → fX6z9
  - lv_typ → WusrR
  - gewerk → l8T6y
  - bezeichnung → NKqqp
  - beschreibung → qhXBj
  - listenpreis → NdeN1
  - preis → BQUj5
  - einheit → zcJHy

### Hero API
- **Endpoint:** `https://login.hero-software.de/api/external/v7/graphql`
- **API Key:** `ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz`
- **Mutations:**
  - `create_supply_product_version` - Neue Position
  - `update_supply_product_version` - Position aktualisieren

### Operator Mapping (lv_typ → Hero supply_operator.name)
| lv_typ | Hero Operator |
|--------|---------------|
| GWS | GWS 2025-01 |
| VBW | VBW 2025-01 |
| covivio | Covivio 2024-10 |
| WBG Lünen | WBG Lünen |
| Privat/neurealis | (kein Operator) |

---

## T1: Preis-Historie

**Ziel:** Tabelle `lv_preis_historie` + Trigger für automatische Protokollierung bei Preisänderungen

**Schema:**
```sql
CREATE TABLE lv_preis_historie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artikelnummer TEXT NOT NULL,
  preis_alt NUMERIC,
  preis_neu NUMERIC,
  listenpreis_alt NUMERIC,
  listenpreis_neu NUMERIC,
  aenderung_prozent NUMERIC,
  gueltig_ab DATE NOT NULL DEFAULT CURRENT_DATE,
  quelle TEXT,  -- 'hero', 'manual', 'lv_update_2025'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Abfragen
CREATE INDEX idx_lv_preis_historie_artikelnummer ON lv_preis_historie(artikelnummer);
CREATE INDEX idx_lv_preis_historie_gueltig_ab ON lv_preis_historie(gueltig_ab);
```

---

## T2: Softr-Push

**Ziel:**
1. Edge Function `lv-softr-push`
2. Initial-Push: 1.485 Positionen ohne softr_record_id
3. DB-Trigger bei INSERT/UPDATE

**Positionen ohne softr_record_id:**
| lv_typ | Anzahl |
|--------|--------|
| GWS | 528 |
| covivio | 488 |
| Privat | 247 |
| VBW | 157 |
| WBG Lünen | 43 |
| neurealis | 22 |

---

## T3: Hero-Push

**Ziel:** Edge Function `lv-hero-push` für neue Positionen

**Trigger:** Bei INSERT in lv_positionen WHERE source != 'hero'

**Mutation:**
```graphql
mutation {
  create_supply_product_version(supply_product_version: {
    nr: $artikelnummer
    base_data: {
      name: $bezeichnung
      description: $beschreibung
      category: $gewerk
    }
    base_price: $preis
    list_price: $listenpreis
  }) {
    product_id
    nr
  }
}
```

---

## Ergebnisse

### T1 Output
**Status:** Fertig

**Migration:** `create_lv_preis_historie`
- Tabelle `lv_preis_historie` mit automatischem Trigger
- Erfasst Preisänderungen mit prozentualem Delta
- Quelle setzbar via `SET LOCAL app.change_source`

**Dokumentation:** `docs/implementation/t1_preis_historie.md`

### T2 Output
**Status:** Fertig

**Edge Function:** `lv-softr-push`
- Modes: push (single), initial (batch), status
- verify_jwt: false

**Initial-Push Ergebnis:**
- Ausgangslage: 1.485 Positionen ohne softr_record_id
- Endergebnis: 3.057/3.057 (100%) synchronisiert

**Trigger:** `trg_lv_softr_push` für automatischen Sync bei INSERT/UPDATE

**Dokumentation:** `docs/implementation/t2_softr_push.md`

### T4 Output
**Status:** Fertig

**Konzept-Dokument:** `docs/implementation/t4_lv_import_konzept.md`
- 5-Schritt-Workflow: Upload → LV-Typ → Mapping → Validierung → Import
- 3 Import-Modi: Neues LV, Preis-Update, Komplett-Ersetzung
- UI-Mockups für alle Screens
- Klärungsfragen dokumentiert (Artikelnummern, Preise, etc.)

### T5 Output
**Status:** Fertig - Klärungsbedarf

**Konzept-Dokument:** `docs/implementation/t5_preis_datenmodell.md`

**Neue Tabellen (Entwurf):**
- `lv_positionen_auftraggeber` - m:n Zuordnung Position ↔ Auftraggeber mit EP
- `nachunternehmer_konditionen` - Margen pro NU (optional pro AG + Gewerk)
- `nachunternehmer_position_preise` - Optional: individuelle EK-Preise pro NU+Position

**Erweiterung bestehender Tabellen:**
- `auftraggeber` + `default_marge_prozent` (VBW: 25%, GWS: 31%)

**SQL-Funktion:** `fn_get_position_preis()` für Preisberechnung mit Kaskade

**Offene Klärungsfragen:**
1. Preisrichtung: EP → EK oder EK → EP?
2. Marge-Definition: Aufschlag auf EK oder Abzug vom EP?
3. Cross-AG-Positionen: Sollen GWS-Positionen auch für VBW verfügbar sein?
4. Eigene Leute: Wie werden interne Arbeiten abgebildet?
5. Zeitaufwand: Jetzt schon modellieren oder später?

### T3 Output
**Status:** Fertig

**Migrationen:**
1. `add_lv_positionen_hero_push_columns` - Neue Spalten hero_product_id + source
2. `add_lv_positionen_hero_push_trigger` - Trigger für Auto-Push

**Edge Function:** `lv-hero-push`
- Function ID: `66453b43-076d-4c23-a374-817bf0767bd3`
- verify_jwt: false
- Modes: create (single), batch

**Trigger:** `trg_lv_hero_push`
- Feuert bei INSERT wenn source != 'hero' AND hero_product_id IS NULL
- Asynchroner HTTP-Call via pg_net

**Loop-Vermeidung:** Aktiv
- Alle 3.057 bestehenden Positionen haben source = 'hero'
- Trigger ignoriert source = 'hero'

**Dokumentation:** `docs/implementation/t3_hero_push.md`

---

*Tracker erstellt: 2026-01-30*
