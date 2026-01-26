# Session Log 2026-01-26 - Elektro Preisvergleich Schaltermaterial

## Zusammenfassung

Erstellung eines detaillierten Preisvergleichs für Busch-Jäger Schaltermaterial (Reflex SI vs Future Linear) für Covivio 3-Zi-Wohnungen basierend auf aktuellen Hornbach-Preisen.

---

## Durchgeführte Arbeiten

### 1. Covivio LV-Analyse
- Covivio Elektro-LV (GS53) gelesen
- Covivio Qualitätshandbuch ausgewertet
- Grundausstattung für 3-Zi-Wohnung (62,5m²) ermittelt

### 2. Hornbach-Preisrecherche
- Aktuelle Hornbach-Preise für alle Artikel recherchiert
- Brutto-Preise in Netto umgerechnet (÷1,19)
- Produktlinks für jeden Artikel erfasst

### 3. Preiskalkulation erstellt

**Ergebnis für 3-Zi-Wohnung (62,5m²):**

| Schalterprogramm | Netto-Summe | Differenz |
|------------------|-------------|-----------|
| Reflex SI (LEG) | 264,58 € | Basis |
| Future Linear (Covivio) | 342,49 € | +77,91 € (+29,4%) |

### 4. Dokumentation erstellt
- Excel mit Artikelliste und Hornbach-Links
- E-Mail-Vorlage für Preisvergleich
- Markdown-Dokumentation für ERP

### 5. Datenbank aktualisiert
- 15 neue Busch-Jäger Artikel in `bestellartikel` eingefügt
- Lieferant: HORNBACH
- Kategorie: Elektro / Schaltermaterial

---

## Erstellte/Geänderte Dateien

### Dokumentation
- `docs/ARTIKEL_BUSCH_JAEGER.md` - Artikelstamm mit Preisen und Links
- `docs/SESSION_LOG_2026-01-26_Elektro_Preisvergleich.md` - Dieses Log

### Excel-Dateien (SharePoint)
- `Elektrik - Wladimir Kusnezow/2026-01 covivio Rechnungen vergleich/`
  - `Covivio_3Zi_Artikelliste_Vergleich.xlsx` - Detaillierte Preisliste mit Links
  - `Email_Materialpreisvergleich.txt` - E-Mail-Vorlage

### Hilfsskripte (temporär)
- `calc_feininstallation.py`
- `artikel_liste.py`
- `update_excel_korrekt.py`

---

## Datenbank-Änderungen

### Neue Artikel in `bestellartikel`

**Reflex SI (9 Artikel):**
- 2506-214 - Wippe universal
- 2505-214 - Wippe Serie
- 2000/6 US - Einsatz Aus-/Wechsel
- 2000/5 US - Einsatz Serie
- 2000/6 USK - Einsatz Kontroll
- 20 EUC-214 - Steckdose
- 2511-214 - Rahmen 1-fach
- 2512-214 - Rahmen 2-fach
- 2513-214 - Rahmen 3-fach

**Future Linear (6 Artikel):**
- 1786-84 - Wippe universal
- 1785-84 - Wippe Serie
- 20EUC-84 - Steckdose
- 1721-184K - Rahmen 1-fach
- 1722-184K - Rahmen 2-fach
- 1723-184K - Rahmen 3-fach

---

## Erkenntnisse

1. **Future Linear ist 29,4% teurer als Reflex SI** (nicht nur 17% wie initial geschätzt)
2. **Größter Preistreiber: Steckdosen** (+44,80 € bei 35 Stück)
3. **Einsätze sind serienübergreifend identisch** - nur Wippen/Rahmen unterscheiden sich
4. **Covivio schreibt Future Linear vor**, LEG schreibt Reflex SI vor

---

## Nächste Schritte

- [ ] Zander-Preise für Vergleich recherchieren
- [ ] Eldis-Rechnungen von Wladi analysieren (Einkaufspreise)
- [ ] Preisvereinbarung mit Kusnetzow basierend auf Marktpreisen

---

*Session beendet: 2026-01-26*
