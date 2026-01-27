# Session Log: Bestellnummer & E-Mail Optimierung

**Datum:** 2026-01-27
**Thema:** Neues Bestellnummern-Format und E-Mail Corporate Design

---

## Zusammenfassung

Anpassung der Bestellnummern auf Projekt-bezogenes Format (ATBS-XXX-B1) und Neugestaltung der E-Mail im Corporate Design (Rot).

---

## Implementierte Features

### 1. Neues Bestellnummern-Format
- **Vorher:** B-1, B-2, B-3 (globale Sequenz)
- **Nachher:** ATBS-463-B1, ATBS-463-B2, ATBS-371-B1 (pro Projekt)

**Datenbank-Änderungen:**
- Neue Spalte `projekt_bestell_nr` in `bestellungen`
- Trigger `trg_set_projekt_bestell_nr` für automatische Nummerierung
- Funktion `get_next_projekt_bestell_nr()` ermittelt nächste Nummer pro Projekt
- View `bestellungen_view` mit berechnetem `bestellung_code`

### 2. E-Mail Corporate Design
- **Farben:** Rot (#E53935) statt Blau
- **Header:** Dunkelrot mit Bestellnummer + Großhändler
- **Vermerk:** "Bitte die Projektnummer ATBS-XXX auf allen Dokumenten angeben!"
- **Projekt:** Nur ATBS-Nummer, kein Projektname
- **Ansprechpartner:** Telefonnummer prominent in Rot mit Telefon-Link
- **Layout:** E-Mail-kompatible Table-Struktur

### 3. E-Mail-Betreff
- **Vorher:** `Bestellung B-1 - ZANDER - ATBS-463`
- **Nachher:** `Bestellung ATBS-463-B1 - ZANDER`

---

## Datenbank-Migration

```sql
-- Neue Spalte
ALTER TABLE bestellungen ADD COLUMN projekt_bestell_nr INTEGER;

-- Trigger für automatische Nummerierung
CREATE TRIGGER trg_set_projekt_bestell_nr
  BEFORE INSERT ON bestellungen
  FOR EACH ROW
  EXECUTE FUNCTION set_projekt_bestell_nr();
```

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `functions/supabase/functions/bestellung-submit/index.ts` | Neues E-Mail-Template im Corporate Design |

---

## E-Mail-Struktur

```
┌────────────────────────────────────────────────┐
│  [ROT] Bestellung ATBS-463-B1                  │
│        ZANDER                      [Material]  │
├────────────────────────────────────────────────┤
│  [DUNKELROT] Wichtig: Projektnummer ATBS-463   │
│              auf allen Dokumenten angeben!     │
├────────────────────────────────────────────────┤
│  LIEFERINFORMATIONEN                           │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Projekt      │  │ Lieferort    │           │
│  │ ATBS-463     │  │ Baustelle    │           │
│  │ [rot border] │  │ Adresse...   │           │
│  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Lieferdatum  │  │ Ansprechpart.│           │
│  │ Mo, 27.01.   │  │ Max Mustermann           │
│  │ Vormittag    │  │ ☎ 0123-456789 [rot]     │
│  └──────────────┘  └──────────────┘           │
├────────────────────────────────────────────────┤
│  BESTELLPOSITIONEN (3)                         │
│  ┌────┬──────────────┬───────┬───────┬───────┐│
│  │Pos.│ Artikel      │ Menge │ EP    │ Gesamt││
│  ├────┼──────────────┼───────┼───────┼───────┤│
│  │ 1  │ Kabel NYM    │ 100 m │ 1,50€ │ 150€  ││
│  │ 2  │ Steckdose    │ 10 St │ 5,00€ │  50€  ││
│  ├────┴──────────────┴───────┼───────┼───────┤│
│  │                    Gesamt │       │ 200€  ││
│  └───────────────────────────┴───────┴───────┘│
├────────────────────────────────────────────────┤
│  [GRAU] Bestellt von: Holger Neumann           │
│         27. Januar 2026, 02:15 Uhr             │
└────────────────────────────────────────────────┘
```

---

## Test

Um eine Test-Bestellung mit dem neuen Format zu erstellen:
1. Gehe zu https://neurealis-erp.netlify.app/bestellung
2. Erstelle neue Bestellung für ein Projekt
3. E-Mail wird mit neuem Format gesendet

---

## Nächste Schritte

- [ ] UI: Bestellnummer im neuen Format anzeigen (Übersicht, Detail)
- [ ] PDF-Export mit gleichem Layout
- [ ] Automatischer Versand an Großhändler (nicht nur Holger)

---

*Erstellt am 2026-01-27*
