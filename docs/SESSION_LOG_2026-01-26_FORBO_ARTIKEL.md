# Session Log: Forbo Artikel-Import

**Datum:** 2026-01-26
**Thema:** Import Forbo Flooring Einkaufspreise 2026

---

## Zusammenfassung

Import von 113 Forbo-Artikeln aus der Preisliste 2026 in den Artikelstamm. Nur die Kategorie "Designbeläge Enduro" ist mit dem Auftraggeber VBW Bauen und Wohnen verknüpft.

---

## Durchgeführte Aktionen

### 1. PDF-Analyse
- **Quelle:** `Forbo Flooring Einkaufspreise 2026.pdf`
- **Kundennummer:** 524093968
- **Gültigkeit:** 01.01.2026 - 31.12.2026
- **Repräsentant:** Oliver Dickel (92050431)

### 2. Artikel-Import (113 Artikel)

| Kategorie | Anzahl | Preisspanne (€) |
|-----------|--------|-----------------|
| Linoleum Bahnen | 18 | 10,65 - 22,90 |
| Sauberlaufzonen Coral | 21 | 49,26 - 156,23 |
| Vinyl-Spezialbeläge | 15 | 17,00 - 36,60 |
| Textilfliesen Tessera | 13 | 16,05 - 29,65 |
| Designbeläge Allura | 10 | 13,80 - 54,50 |
| Textile Beläge Flotex | 8 | 37,30 - 42,45 |
| Leitfähige Vinylbeläge | 7 | 26,55 - 114,20 |
| Zubehör | 7 | 4,70 - 900,00 |
| Homogene Vinylbeläge | 5 | 18,80 - 27,60 |
| Textile Beläge Nadelvlies | 5 | 9,30 - 18,15 |
| Designbeläge Enduro | 2 | 11,40 - 25,70 |
| Natürliche Designbeläge | 2 | 28,20 - 48,50 |

### 3. Verknüpfungen

**Großhändler:** Forbo Flooring GmbH (bereits vorhanden)
- ID: `eaf00f54-6ea8-482f-a00e-97dea746fcbf`

**Auftraggeber VBW** (nur Enduro):
| Artikelnummer | Bezeichnung | EK-Preis |
|---------------|-------------|----------|
| FORBO-ENDURO-DRYBACK-0.30 | Enduro Dryback 0.30 | 11,40 €/m² |
| FORBO-ENDURO-CLICK-DECIBEL-0.55 | Enduro Click Decibel 0.55 | 25,70 €/m² |

---

## Artikelnummern-Schema

Format: `FORBO-{PRODUKTLINIE}-{VARIANTE}`

Beispiele:
- `FORBO-REAL-FRESCO-2.0` - Linoleum Real/Fresco 2,0mm
- `FORBO-ALLURA-DR7-0.70` - Allura Dryback 0.70
- `FORBO-CORAL-CLASSIC-VINYL` - Coral Classic mit Vinyl-Rücken
- `FORBO-TESSERA-BASIS-PRO-FLIESEN` - Tessera Basis Pro Fliesen

---

## Technische Details

### Tabellen
- `bestellartikel` - 113 neue Einträge
- `artikel_auftraggeber` - 2 Verknüpfungen (nur Enduro → VBW)

### SQL-Abfrage zur Verifizierung
```sql
-- Alle Forbo-Artikel
SELECT artikelnummer, bezeichnung, unterkategorie, einkaufspreis, einheit
FROM bestellartikel
WHERE artikelnummer LIKE 'FORBO-%'
ORDER BY unterkategorie, artikelnummer;

-- VBW-verknüpfte Artikel
SELECT b.artikelnummer, b.bezeichnung, a.name as auftraggeber
FROM bestellartikel b
JOIN artikel_auftraggeber aa ON b.id = aa.artikel_id
JOIN auftraggeber a ON aa.auftraggeber_id = a.id
WHERE b.artikelnummer LIKE 'FORBO-%';
```

---

## Hinweise

- Preise verstehen sich zzgl. MwSt.
- Servicepauschale: 79,95 € bei Lieferung < 750 m²
- Zahlungskondition: 2% Skonto bei Zahlung innerhalb 10 Tagen, 30 Tage netto

---

*Erstellt: 2026-01-26*
