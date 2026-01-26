# Session-Log: Artikel-Import & Auftraggeber-System

**Datum:** 2026-01-26
**Thema:** Import von Bestellartikeln aus Excel + Auftraggeber-Verknüpfung

---

## Zusammenfassung

1. **Neue Tabellen erstellt:**
   - `auftraggeber` - Stammdaten der Kunden/Auftraggeber
   - `artikel_auftraggeber` - Junction-Tabelle (n:m Verknüpfung)

2. **Neue Spalten in `bestellartikel`:**
   - `unterkategorie` - Detaillierte Kategorie (Spachtel, Abdichtung, HT Rohr, etc.)
   - `anwendung` - Anwendungsbereich (Boden, Bad, Rohinstallation, etc.)

3. **Artikel importiert aus Excel:**
   - Hornbach: 69 Artikel (HB-001 bis HB-069)
   - Prosol: 30 Artikel (PS-001 bis PS-030)
   - Linnenbecker: 13 Artikel (LB-001 bis LB-013)
   - Zander: 40 Artikel (ZA-001 bis ZA-040)
   - **Gesamt neu:** 152 Artikel

4. **Auftraggeber angelegt:**
   - VBW, GWS, covivio, Privat, LEG, Vonovia, WBG Lünen

5. **Verknüpfungen:**
   - Neue Artikel (HB, PS, LB, ZA) mit GWS + Privat verknüpft

---

## Finale Statistiken

| Metrik | Wert |
|--------|------|
| Artikel gesamt | 443 |
| Artikel vorher | 225 (+ 66 ohne Artikelnummer) |
| Artikel neu importiert | 152 |
| Auftraggeber | 7 |
| Verknüpfungen | 864 |

### Artikel nach Großhändler

| Präfix | Großhändler | Anzahl |
|--------|-------------|--------|
| HB- | Hornbach | 69 |
| PS- | Prosol | 30 |
| LB- | Linnenbecker | 13 |
| ZA- | Zander | 40 |

### Artikel nach Auftraggeber

| Auftraggeber | Artikel |
|--------------|---------|
| GWS | 152 |
| Privat | 152 |
| covivio | 112 |
| VBW | 112 |
| Vonovia | 112 |
| LEG | 112 |
| WBG Lünen | 112 |

---

## Kategorien (für Softr.io Dropdowns)

### Hauptkategorien
```
Boden
Elektro
Fliesen
Heizung
Maler
Montage
Sanitär
Tischler
Wände
Werkzeug
```

### Unterkategorien (Auswahl)
```
Abdichtung, Abschlussprofil, Acryl, Bad-Ausstattung, Badkeramik,
Bauchemie, Bodenfliese, Design-PVC / Vinyl, Dichtungssystem,
Drückergarnitur, Durchlauferhitzer, Dusche/Wanne, Farbe,
Feininstallation, Fliesenkleber, Glaseinsatz, Heizkörper Bad,
HT Rohr, Kleber, Kupfer, Lacke, Laminat, Lüftungsgitter, Putz,
Sockelleiste, Spachtel, Türband, Türblatt, Unterverteilung,
Ventilator, Wandfliese, Waschmaschine, Wasserzähler, WC, Zarge
```

### Hersteller
```
Allmess, Botament, Casonic, concept, Conel, Emco, Evolution,
Fränkische, Geberit, Gerflor, Gira, Grohe, Heimeier, Henkel,
Heso, HME, Ideal Standard, JOKA, Kera, Keramag, Mapei, Mega,
OSTENDORF, Profis am Werk, Prosol, Relius, Resol, Sanibel,
Schönox, Sika, Stiebel Eltron, Tece, Tectite, TORREY, Vaillant,
VIEGA, WALRAVEN
```

### Auftraggeber (Kurzname)
```
VBW
GWS
covivio
Privat
LEG
Vonovia
WBG Lünen
```

---

## Migrationen ausgeführt

1. `create_auftraggeber_tabellen` - Neue Tabellen + RLS
2. `add_unterkategorie_anwendung` - Neue Spalten

---

## Quelldateien

Excel-Vorlagen (importiert):
- `C:\Users\holge\neurealis GmbH\Wohnungssanierung - 15 Großhandel\10 Bestelllisten\Vorlagen\2024-02-05 neurealis - Materialliste - Hornbach.xlsx`
- `C:\Users\holge\neurealis GmbH\Wohnungssanierung - 15 Großhandel\10 Bestelllisten\Vorlagen\2024-07-16 neurealis - Materialliste - Prosol Linnenbecker Zander.xlsx`

Generierte Dateien (können gelöscht werden):
- `artikel_import_new.json`
- `import_artikel.sql`
- `import_batch_*.sql`
- `read_excel*.ps1`
- `export_excel.ps1`
- `import_to_db.ps1`
- `run_import.ps1`
- `find_files.ps1`

---

## Nächste Schritte

1. **Softr.io konfigurieren:**
   - Tabelle `auftraggeber` als Datenquelle hinzufügen
   - Tabelle `artikel_auftraggeber` für Linked Records nutzen
   - Filter nach `kurzname` für Auftraggeber

2. **Weitere LVs importieren:**
   - LEG, Vonovia, covivio LVs hochladen
   - Artikel entsprechend zuordnen

3. **Preise aktualisieren:**
   - Viele importierte Artikel haben Preis 0
   - Preise aus Großhändler-Listen nachpflegen

---

## SQL-Befehle zum Überprüfen

```sql
-- Artikel-Statistik
SELECT grosshaendler_name, COUNT(*)
FROM bestellartikel
WHERE artikelnummer LIKE 'HB-%'
   OR artikelnummer LIKE 'PS-%'
   OR artikelnummer LIKE 'LB-%'
   OR artikelnummer LIKE 'ZA-%'
GROUP BY grosshaendler_name;

-- Verknüpfungen pro Auftraggeber
SELECT ag.kurzname, COUNT(aa.artikel_id)
FROM auftraggeber ag
LEFT JOIN artikel_auftraggeber aa ON ag.id = aa.auftraggeber_id
GROUP BY ag.kurzname;

-- Kategorien mit Unterkategorien
SELECT DISTINCT kategorie, unterkategorie
FROM bestellartikel
WHERE unterkategorie IS NOT NULL
ORDER BY kategorie, unterkategorie;
```

---

*Erstellt: 2026-01-26 20:30*
