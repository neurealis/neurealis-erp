# Session Log: Hero LV-Sync & Bereinigung

**Datum:** 2026-01-26
**Thema:** Hero ↔ Supabase LV-Sync, Duplikat-Bereinigung, Gewerk-Kategorisierung

---

## Zusammenfassung

Komplette Überarbeitung des Hero LV-Sync mit:
- Kategorie-Import aus Hero (`base_data.category`)
- EK + Listenpreis Import
- Duplikat-Bereinigung (635 Positionen)
- Generische Gewerk-Kategorisierung
- LV-Typ Bereinigung (Artikel vs. Leistungen)

---

## Durchgeführte Änderungen

### 1. Edge Function `hero-lv-sync` (v7)

**Neue Features:**
- `base_data.category` → `gewerk` Feld
- `list_price` → `listenpreis` Feld
- Vergleich inkl. `gewerk` und `listenpreis` für Updates

**Pfad:** `functions/supabase/functions/hero-lv-sync/index.ts`

### 2. Datenbank-Migrationen

```sql
-- Listenpreis-Spalte hinzugefügt
ALTER TABLE lv_positionen ADD COLUMN listenpreis NUMERIC;

-- LV-Typ Constraint erweitert
ALTER TABLE lv_positionen ADD CONSTRAINT lv_positionen_lv_typ_check
CHECK (lv_typ IN ('covivio', 'GWS', 'Privat', 'VBW', 'WBG Lünen', 'neurealis', 'Artikel'));
```

### 3. Hero Duplikat-Bereinigung

| Aktion | Anzahl |
|--------|--------|
| Identische Duplikate (DUPLIKAT-*) | 196 |
| GWS Preis-Duplikate (ALT-*) | 439 |
| **Gesamt bereinigt** | **635** |

**Backup:** `backup_deaktivierte_positionen_20260126_221547.csv`

### 4. Gewerk-Kategorisierung

**Vorher:** 140+ verschiedene Hero-Kategorien
**Nachher:** 23 generische Gewerke

| Gewerk | Anzahl |
|--------|--------|
| Bad | 317 |
| Tischler | 267 |
| Boden | 219 |
| Heizung | 175 |
| Elektro | 174 |
| Sanitär | 168 |
| Fliesen | 164 |
| Maler | 145 |
| Rückbau | 116 |
| Maurer | 98 |
| Trockenbau | 53 |
| Fenster | 47 |
| Rollo | 39 |
| Sonstiges | 29 |
| Brandschutz | 22 |
| Reinigung | 20 |
| Asbest | 18 |
| Allgemein | 18 |
| Dämmung | 5 |
| Entsorgung | 4 |
| Balkon | 3 |
| Dach | 2 |
| Treppe | 1 |

### 5. LV-Typ Bereinigung

**Finale LV-Typen:**

| LV-Typ | Anzahl | Beschreibung |
|--------|--------|--------------|
| covivio | 1.168 | Covivio Auftraggeber |
| VBW | 313 | VBW Auftraggeber |
| neurealis | 234 | Eigene Leistungen |
| Privat | 143 | Privataufträge |
| GWS | 112 | GWS Auftraggeber |
| WBG Lünen | 58 | WBG Lünen Auftraggeber |
| **Artikel** | **76** | Einkaufsware (kein LV) |

**Entfernt:**
- `Zander` → zu `Artikel` verschoben (Einkaufsware)
- 331 "Ohne Bezeichnung" Positionen → deaktiviert

### 6. Statistik

| Kategorie | Anzahl |
|-----------|--------|
| Aktive LV-Positionen | 2.028 |
| Artikel (Einkaufsware) | 76 |
| Inaktive Positionen | 953 |
| Mit Listenpreis | 1.550 |

---

## Softr Dropdown-Werte

### LV-Typ (ohne Artikel)
```
covivio
GWS
neurealis
Privat
VBW
WBG Lünen
```

### Gewerk
```
Allgemein
Asbest
Bad
Balkon
Boden
Brandschutz
Dach
Dämmung
Elektro
Entsorgung
Fenster
Fliesen
Heizung
Maler
Maurer
Reinigung
Rollo
Rückbau
Sanitär
Sonstiges
Tischler
Treppe
Trockenbau
```

---

## Hero API Erkenntnisse

**Verfügbare Felder in `supply_product_versions`:**
- `product_id`, `nr`, `internal_identifier`
- `base_data { name, description, category }`
- `supply_operator { name, id }`
- `base_price` (Einkaufspreis)
- `list_price` (Listenpreis)

**Keine DELETE Mutation** - Duplikate werden mit Präfix umbenannt:
- `DUPLIKAT-[nr]-[id]` für identische Duplikate
- `ALT-[nr]-[id]` für niedrigere Preise

---

## Erstellte Dateien

| Datei | Beschreibung |
|-------|--------------|
| `find_hero_duplicates.ps1` | Duplikate in Hero finden |
| `cleanup_hero_duplicates.ps1` | Duplikate umbenennen |
| `export_and_deactivate_duplicates.ps1` | Export & Deaktivierung |
| `check_hero_fields.ps1` | Hero API Schema prüfen |
| `run_sync_batches.ps1` | Batch-Sync ausführen |
| `backup_deaktivierte_positionen_*.csv` | Backup |

---

## Nächste Schritte

1. Softr Dropdowns mit neuen Werten konfigurieren
2. Filter `lv_typ != 'Artikel'` für LV-Ansicht
3. Optional: Artikel-Tabelle für Bestellsystem nutzen

---

*Dokumentiert am 2026-01-26*
