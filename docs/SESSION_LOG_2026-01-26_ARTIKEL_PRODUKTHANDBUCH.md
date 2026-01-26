# Session Log: Artikel-Import aus Produkthandbuch

**Datum:** 2026-01-26
**Status:** Pausiert - Artikelnummern-Suche läuft noch

---

## Zusammenfassung

Import von ~205 Artikeln aus dem Produkthandbuch (Google Sheets) für die Auftraggeber GWS, covivio und WBG Lünen.

---

## Durchgeführte Änderungen

### 1. Datenbank-Schema erweitert

| Änderung | Status |
|----------|--------|
| `bild_url` Feld hinzugefügt | ✅ |
| `shop_url` Feld hinzugefügt | ✅ |
| `artikel_grosshaendler` n:m Tabelle erstellt | ✅ |
| `artikelnummer` darf NULL sein | ✅ |
| Großhändler JORDAN angelegt | ✅ |

### 2. Artikel importiert

| Metrik | Wert |
|--------|------|
| **Artikel vorher** | 520 |
| **Artikel nachher** | 753 |
| **Neu importiert** | 233 |

### 3. Neue Kategorien angelegt

- Trockenbau (15 Artikel)
- Dämmung (3 Artikel)
- Maurer (1 Artikel)

### 4. Auftraggeber-Verknüpfungen

| Auftraggeber | Anzahl |
|--------------|--------|
| GWS | 389 |
| covivio | 198 |
| WBG Lünen | 145 |

### 5. Großhändler-Verknüpfungen

| Großhändler | Anzahl | Zuständig für |
|-------------|--------|---------------|
| ABEX/G.U.T. | 176 | Sanitär, Heizung (Standard) |
| ZANDER | 111 | Elektro (Standard) |
| MEG/MEGA | 85 | Maler, Gerflor |
| KERAMUNDO | 49 | Fliesen (Standard) |
| Raab Karcher | 47 | Trockenbau, Maurer, Dämmung, Tischler (Rest) |
| BAUPARTE | 7 | Türen |
| JORDAN | 3 | Joka Boden |

---

## Aktueller Datenstand

| Metrik | Anzahl | Prozent |
|--------|--------|---------|
| Artikel gesamt | 753 | 100% |
| Mit Artikelnummer | 589 | 78% |
| Mit EAN | 111 | 15% |
| Mit Foto | 42 | 6% |
| Mit Shop-Link | 31 | 4% |

---

## Online-Suche: Bereits ergänzte Daten

| Hersteller | Artikel | Artikelnr | EAN |
|------------|---------|-----------|-----|
| Knauf | Rotband Pro | 10264 | 4003982185440 |
| Knauf | MP 75 Diamant | 10258 | - |
| Knauf | MP 75 L | 10257 | - |
| Brillux | Superlux ELF 3000 | 3000001095 | 4006559359718 |
| Ideal Standard | i.life B Wand-WC | T461401 | 8014140486008 |
| Stiebel Eltron | ETS 300 PLUS | 236425 | 4017212364253 |
| Stiebel Eltron | ETS 400 PLUS | 236426 | 4017212364260 |
| Stiebel Eltron | ETS 500 PLUS | 236427 | 4017212364277 |
| Stiebel Eltron | ETS 600 PLUS | 236428 | 4017212364284 |
| PCI | Nanofug Premium | 3004 | 4083200030042 |
| Geberit | Renova Comfort | 500694011 | 4025410598950 |
| Hoppe | Amsterdam Drückergarnitur | 3289719 | 4012789523744 |
| IMI Heimeier | Eclipse 1/2" Eck | 3931-02.000 | 4024052929412 |
| IMI Heimeier | Eclipse 3/8" | 3932-01.000 | 4024052929511 |
| HM Heizkörper | Thetis 600x1500 | 64-15060 | - |
| Kermi | LIGA Walk-In | KILITWF | - |

---

## Offene Aufgaben (Nächste Session)

### 1. Artikelnummern/EANs weiter suchen

Hersteller mit den meisten fehlenden Artikelnummern:

| Hersteller | Fehlend | Priorität |
|------------|---------|-----------|
| Knauf | ~20 | Hoch |
| Ideal Standard | ~12 | Hoch |
| Brillux | ~8 | Mittel |
| Kermi | ~8 | Mittel |
| PCI | ~10 | Mittel |
| KEUCO | ~4 | Niedrig |
| Gerflor | ~4 | Niedrig |
| diverse | ~8 | Niedrig (generisch) |

### 2. Fotos ergänzen

Viele Artikel haben bereits Foto-URLs aus dem Import. Fehlende Fotos können über Herstellerseiten oder Zander/GUT-Shops gesucht werden.

### 3. Shop-Links ergänzen

Primäre Quellen:
- zander.online (Elektro, Sanitär)
- knauf.com (Trockenbau)
- brillux.de (Maler)
- idealstandard.de (Sanitär)

---

## Abfragen für Fortsetzung

```sql
-- Artikel ohne Artikelnummer nach Hersteller
SELECT hersteller, COUNT(*) as anzahl
FROM bestellartikel
WHERE (artikelnummer IS NULL OR artikelnummer = '')
AND ist_aktiv = true
AND hersteller IS NOT NULL
GROUP BY hersteller
ORDER BY anzahl DESC;

-- Artikel ohne EAN
SELECT bezeichnung, hersteller, artikelnummer
FROM bestellartikel
WHERE (ean IS NULL OR ean = '')
AND artikelnummer IS NOT NULL
AND ist_aktiv = true
ORDER BY hersteller, bezeichnung;

-- Artikel ohne Foto
SELECT bezeichnung, hersteller, shop_url
FROM bestellartikel
WHERE (bild_url IS NULL OR bild_url = '')
AND ist_aktiv = true
ORDER BY hersteller, bezeichnung;
```

---

## Großhändler-Zuordnung (Referenz)

| Kategorie | Standard-Großhändler | Alternative |
|-----------|---------------------|-------------|
| Sanitär | ABEX/G.U.T. | ZANDER |
| Heizung | ABEX/G.U.T. | ZANDER |
| Elektro | ZANDER | HORNBACH |
| Trockenbau | Raab Karcher | BAUPARTE |
| Maurer | Raab Karcher | - |
| Dämmung | Raab Karcher | - |
| Fliesen | KERAMUNDO | LINNENBECKER |
| Boden (Joka) | JORDAN | - |
| Boden (Gerflor) | MEG/MEGA | - |
| Maler | MEG/MEGA | - |
| Tischler (Türen) | BAUPARTE | - |
| Tischler (Rest) | Raab Karcher | - |

---

## Wichtige IDs (Referenz)

### Auftraggeber
- GWS: `d4d38371-7249-4a8b-b604-df497bbb8f59`
- covivio: `79a19cd1-4dd6-4dfc-8857-aba956419084`
- WBG Lünen: `a03299b8-a8e3-49c2-951b-ab96346c617a`

### Großhändler
- ABEX/G.U.T.: `07860bbc-f86d-495e-acbd-b3c7b8b589a0`
- ZANDER: `77269be6-497e-445d-a46f-37b0e2d20115`
- MEG/MEGA: `db3b9444-9064-4bcf-9b86-66e466d60b46`
- KERAMUNDO: `b1ca6fc5-c0eb-4242-84dd-6f7d447a5cb2`
- Raab Karcher: `32e400d0-6f43-4a96-8582-5fb4e6a87fd1`
- BAUPARTE: `b8ce5295-9ce0-49d3-a3d2-1ed4f12ea26a`
- JORDAN: `3b373d8d-b369-47f1-9bbe-b1195490bc27`
- HORNBACH: `3a8d018f-636d-4f8f-966a-998c0c9a0f36`

---

*Erstellt: 2026-01-26*
