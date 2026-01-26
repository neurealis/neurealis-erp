# Materialvorgabe aus Leistungsverzeichnis erstellen

## Ziel
Aus einem LV (Leistungsverzeichnis) für Wohnungssanierung alle Positionen mit Materialvorgaben extrahieren und als strukturierte Excel/PDF für Nachunternehmer erstellen.

---

## Eingabe-Dateien

### 1. Haupt-LV (Excel)
- Format: `.xlsx`
- Spalten: `Artikelnummer`, `Kategorie`, `Positionsname`, `Beschreibung`, `Einheit`
- **Nur Artikel mit Präfix filtern** (z.B. `GWS.LV23` für GWS-Kunde)

### 2. Fabrikatliste (optional, CSV)
- Enthält Standardprodukte für Pauschalpositionen
- Wird bei Positionen mit Verweis "Liste zu verbauender Fabrikate" verwendet

---

## Extraktions-Regeln

### Produktvorgaben in Beschreibungen finden

**Muster 1: `Produkt: XYZ`**
```
Produkt: Knauf Rotband Pro
od. gleichw.
```

**Muster 2: `Hersteller/Fabrikat: XYZ`**
```
Hersteller/ Fabrikat:
PCI Seccoral
oder gleichwertig
```

**Muster 3: Hersteller + Serie + Artikel-Nr.**
```
Hersteller: Kerateam
Serie: gws weiß glz.
Artikel Nr.: 3659681
```
→ Ergebnis: `Kerateam gws weiß glz. (Art. 3659681)`

**Muster 4: Bekannte Marken mit Produktlinien**
Direkt im Text suchen nach:
- Brillux + Produktname + Artikelnummer (z.B. `Brillux Superlux ELF 3000`)
- Knauf + Produkt (z.B. `Knauf MP 75 Diamant`)
- PCI + Produkt (z.B. `PCI Flexmörtel S`)
- etc.

---

## Bekannte Hersteller und Produkte (Wohnungssanierung)

### Putz/Trockenbau
| Hersteller | Produkte |
|------------|----------|
| Knauf | Rotband Pro, MP 75 Diamant, UP 210, Betokontakt, Aufbrennsperre, Uniflott, Sperrgrund, Rotkalk Glätte, Tiefengrund |
| Rigips | Rigidur Ausgleichsschüttung, Rigidur Estrichelement, VARIO Fugenspachtel, Mineralwolldämmstreifen |

### Fliesen/Abdichtung
| Hersteller | Produkte |
|------------|----------|
| PCI | Seccoral, Lastogum, Pecitape (120, 90°), Flexmörtel S, Nanofug Premium, Silcofug E, Pericret, Gisogrund |
| Schlüter | Ditra, Rondec, QUADEC-EB |
| Sakret | (Schnittschutzband) |

### Fliesen-Hersteller
| Hersteller | Serien |
|------------|--------|
| Kerateam | Bianco BCO90A |
| Meißen Keramik | Evolution Berlin |
| Nord Ceram | Klint KLI930A |
| Vitra | Sense |

### Sanitär
| Hersteller | Produkte |
|------------|----------|
| GEBERIT | Renova Plan (Waschtisch), Renova (WC), Sigma01 (Betätigungsplatte), Duofix Element, Omega UP-Spülkasten, Silent-db 20, Silent-PP |
| KALDEWEI | Saniform Plus (Badewanne), Superplan (Duschwanne), Duschplan |
| Ideal Standard | i.life Serie, Ultra Flat S, Ceraplan, Ceratherm T50 |
| Kermi | Basic-50 (Handtuchheizkörper), LIGA (Duschabtrennungen: LI TWF, LI 1O, LI D2, LI TWD), Nova 2000 |

### Armaturen
| Hersteller | Produkte |
|------------|----------|
| HANSA | Polo (Waschtisch/Wanne), Hansaunita (Thermostat), Hansabasicjet, Hansamedipro |
| Grohe | Eurosmart, Tempesta, Grohtherm |

### Ausstattung
| Hersteller | Produkte |
|------------|----------|
| KEUCO | Edition 11, Plan (Handtuchhalter, Papierhalter, Duschkorb) |
| HOPPE | Amsterdam, Stockholm (Drückergarnituren) |

### Elektro/Heizung
| Hersteller | Produkte |
|------------|----------|
| STIEBEL ELTRON | ETS 200-600 PLUS (Speicherheizung), DHB/DHE (Durchlauferhitzer), EBK 5K |
| Vaillant | VEN 5 U classic, atmoMag, VCW 194 |
| Merten | System M |
| DANFOSS/HEIMEIER | Thermostatventile |
| WILO | Star Z-Nova A (Zirkulationspumpe) |

### Boden/Estrich
| Hersteller | Produkte |
|------------|----------|
| UZIN | KR 516, SC 980, NC 160 |
| Sopro | EstrichRanddämmStreifen ERS 961 |
| wedi | Nonstep Plus, Fondo Plano |
| weber | weber.prim 803, weber.floor 4070 |
| Ardex | FA 20 |

### Maler
| Hersteller | Produkte |
|------------|----------|
| Brillux | Superlux ELF 3000, Mineral-Handspachtel ELF 1886, Tiefgrund ELF 595, Fondosil 1903, 2K-Aqua Durakett 2394, Hydro-PU-Tec Seidenmattlack 2088, Heizkörperlack 990, Aqualoma ELF 202, Isogrund 924, Silicon Grundierfarbe 917, Ultrasil HP 1901, Raufaser Nr. 52 |

### Installation
| Hersteller | Produkte |
|------------|----------|
| VIEGA | Raxinox (Mehrschichtverbundrohr) |
| ROCKWOOL | Conlit 150 U (Brandschutzschale) |
| PORESTA | Wannenträger |
| Fermacell | Tiefengrund |

---

## Fabrikatliste für Pauschalpositionen

Bei Positionen mit Verweis "Produktvorgabe siehe Liste zu verbauender Fabrikate" diese Standardprodukte einfügen:

### Dusch/Wannenbad Pauschalen
```
GEBERIT Renova Plan (Waschtisch 60x48)
GEBERIT Renova (Wand-WC)
GEBERIT Sigma01 (Betätigungsplatte)
HANSA Polo (Waschtischarmatur)
HANSA Hansaunita (Duscharmatur Thermostat)
KALDEWEI Superplan (Duschwanne)
Kermi Basic-50 (Handtuchheizkörper)
```

Bei Wannenbad zusätzlich:
```
KALDEWEI Saniform Plus (Badewanne 1700x750)
HANSA Polo (Wannenbatterie)
```

---

## Ausgabe

### Excel-Datei
- Spalten: Gewerk, Artikel-Nr., Position, Einheit, Marke/Fabrikat/Produkt
- Sortiert nach Artikelnummer
- Gruppiert nach Gewerk

### PDF-Datei
- Querformat A4
- Tabellen pro Gewerk
- Überschrift mit Gewerk und Anzahl Positionen

---

## Ungültige Werte (ignorieren)
- `''`
- `'.........'`
- `angeb. Fabrikat`
- `oder gleichwertig`
- `od. gleichw.`

---

## Workflow

1. **LV laden** - Excel mit Artikelnummer-Präfix filtern (z.B. `GWS.LV23`)
2. **Beschreibungen durchsuchen** - Alle Muster nach Produktvorgaben
3. **Fabrikatliste anwenden** - Bei Pauschalpositionen mit Verweis
4. **Filtern** - Nur Positionen MIT Produktvorgaben behalten
5. **Sortieren** - Nach Artikelnummer (ergibt Gewerk-Reihenfolge)
6. **Excel erstellen** - Formatiert mit Spaltenbreiten
7. **PDF erstellen** - Gruppiert nach Gewerk

---

## Python-Skripte

Speicherort: `C:\Users\holge\`
- `extract_material.py` - Extrahiert Materialvorgaben und erstellt Excel
- `create_pdf.py` - Erstellt PDF aus Excel

---

*Erstellt: 2026-01-23*
