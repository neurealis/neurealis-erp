# T3: LV-Analyse neurealis (Lokal)

**Status:** Erfolg
**Datum:** 2026-01-30
**Ausgeführt von:** Claude (LV-Analyse-Agent)

---

## Analysierte Positionen

| Metrik | Wert |
|--------|------|
| **neurealis Positionen gesamt** | 693 |
| **Positionen mit Beschreibung** | 236 |
| **Davon HTML-formatiert** | 176 |
| **Mit "inkl/Inklusive" (Pakete)** | 86 |
| **Mit KfW-Erwähnung** | 1 |
| **Gewerke** | 35 verschiedene |

### Top-Gewerke (neurealis)

| Gewerk | Anzahl |
|--------|--------|
| Sonstiges | 335 |
| neurealis | 198 |
| Fenster | 21 |
| Elektro/Elektrik | 26 |
| Maler | 14 |
| Heizung | 11 |
| Boden | 11 |
| Tischler | 10 |
| Bad/Sanitär | 20 |

---

## Erkannte Abhängigkeiten

### Gespeichert in `position_dependencies`

**Total: 25 Abhängigkeiten**

| Typ | Anzahl | Bedeutung |
|-----|--------|-----------|
| `required` | 6 | Muss zwingend hinzugefügt werden |
| `often_together` | 14 | Wird häufig zusammen bestellt |
| `suggested` | 5 | Alternative oder optionales Upgrade |

---

### Required (Pflicht-Abhängigkeiten)

| Source | Target | Confidence | Begründung |
|--------|--------|------------|------------|
| Elektrik-ElektrikKompletteModernis-3 | Elektrik-ElektrikDurchfuehrungEche | 95% | E-Check nach VDE ist Pflicht bei Elektro-Komplettmod |
| Sanitär-KompaktheizkoerperFuerWae-22 | Elektrik-WärmepumpenHZK | 95% | WP-Heizkörper braucht Stromanschluss |
| Elektrik-BadezimmerKernsanierungBi-1 | Elektrik-ElektrikDurchfuehrungEche | 90% | Bad-Kernsanierung erfordert E-Check |
| GästeWC-Kernsanierung | Elektrik-ElektrikDurchfuehrungEche | 90% | Gäste-WC Kernsanierung erfordert E-Check |
| Sanitär-LieferungUndMontageBoschB-2 | Sanitär-KompaktheizkoerperFuerWae-22 | 90% | Bosch Wärmepumpe braucht passende Heizkörper |
| Dach-Ausbau-Schrage-MW160-GKB | Decke-DeckeSpachtelStreichen | 85% | Gipskarton muss gespachtelt/gestrichen werden |

---

### Often Together (Häufig kombiniert)

| Source | Target | Confidence | Begründung |
|--------|--------|------------|------------|
| Elektrik-ElektrikKompletteModernis-3 | Elektrik-ElektrikKompletteModernis | 95% | Basis + je m² Skalierung |
| Elektrik-BadezimmerKernsanierungBi-1 | Elektrik-BadezimmerKernsanierungJe-2 | 95% | Basis + je m² Skalierung |
| Elektrik-BadezimmerRenovierungBis3-1 | Wand-BadezimmerRenovierungJede | 90% | Basis + je m² Skalierung |
| Wand-Außen-KfW40 | Fassade-WDVS-14cm | 90% | KfW40 braucht WDVS |
| Wand-Außen-KfW40 | Fenster-1Flügel-MitRollo-1150x1335 | 85% | KfW40 braucht gute Fenster |
| Wand-Außen-KfW40 | Daemmung-Kellerdecke-MW-100mm | 85% | KfW40 Gesamtkonzept |
| Fräsung Estrich | Boden-BodenVinylVerklebenInklNi-30 | 80% | FBH braucht Bodenbelag |
| Boden-FussbodenheizungHerstellu-23 | Boden-BodenVinylVerklebenInklNi-30 | 80% | FBH braucht Bodenbelag |
| Boden-BodenVinylVerklebenInklNi-30 | Boden-Ausgleichsmasse-Weichmachersperre | 70% | Vinyl auf Altbelag braucht Sperre |
| Elektrik-BadezimmerRenovierungBis3-1 | Fliesen-Lackierung | 70% | Renovierung oft mit Fliesenlack |
| Treppe-Verkleidung-Vinyl | Sonstiges-HolzuntergrundAusbessernV | 70% | Treppe vorbereiten |
| Elektrik-Durchlauferhitzer | Elektrik-ElektrikKompletteModernis-3 | 60% | DLE oft mit E-Modernisierung |
| Bad-SpiegelschrankLeuchte-60-Weiss | Elektrik-Steckdose-1fach | 60% | Spiegelschrank braucht Strom |
| Fenster-TuerWohnungseingangstuerE-2 | Elektrik-ElektrikKompletteModernis-3 | 50% | Komplettsanierung |

---

### Suggested (Alternativen/Upgrades)

| Source | Target | Confidence | Begründung |
|--------|--------|------------|------------|
| Elektrik-ZimmertuerErneuerungZarge-1 | Elektrik-TuerAustauschTuerblattInk-1 | 90% | Komplett vs. nur Türblatt |
| Bad-Badewanne-Austausch | Bad-Badewanne-Upgrade | 80% | Standard vs. Upgrade-Wanne |
| GästeWC-Renovierung | Elektrik-ElektrikDurchfuehrungEche | 70% | E-Check empfohlen |
| Fenster-BodenClickvinylVerlegenIn-40 | Boden-Zulage-Sockelleiste-Kiefer | 60% | Upgrade Sockelleiste |
| Boden-Parkett-Schleifen | Boden-Zulage-Sockelleiste-Kiefer | 50% | Optional neue Leisten |

---

## B2C-Paket-Logik (neurealis-spezifisch)

### Kernsanierung Bad/Gäste-WC
- **Enthält implizit:** Rückbau, Rohinstallation, Abdichtung, Fliesen, Sanitärobjekte
- **Pflicht-Zusatz:** E-Check (bei Elektroarbeiten)
- **Skalierung:** Basis bis 3,5m² + je weiterer m²

### Elektrik Komplettmodernisierung
- **Enthält:** Neue Leitungen, UV, FI-Schalter, Feininstallation
- **Pflicht-Zusatz:** E-Check nach VDE
- **Skalierung:** Basis bis 40m² + je weiterer m²

### Energetische Sanierung (KfW40)
- **Paket:** Außenwand + WDVS + Fenster + Kellerdeckendämmung
- **KfW-Förderung:** Nur als Gesamtpaket förderfähig

### Fußbodenheizung
- **Varianten:** Fräsung im Estrich ODER BEKOTEC-System
- **Pflicht-Zusatz:** Bodenbelag (Vinyl empfohlen)

### Wärmepumpen-Heizung
- **Paket:** Bosch BOPA CS778 + WP-Heizkörper + Elektrik-Anschluss
- **Ausschluss:** Nicht mit Gasbrennwerttherme kombinieren

---

## SQL-Queries zur Nutzung

### Abhängigkeiten für eine Position abrufen
```sql
SELECT target_artikelnummer, dependency_type, confidence
FROM position_dependencies
WHERE source_artikelnummer = 'Elektrik-BadezimmerKernsanierungBi-1'
  AND lv_typ = 'neurealis'
  AND is_active = true
ORDER BY
  CASE dependency_type
    WHEN 'required' THEN 1
    WHEN 'often_together' THEN 2
    ELSE 3
  END,
  confidence DESC;
```

### Alle Pflicht-Abhängigkeiten
```sql
SELECT source_artikelnummer, target_artikelnummer, confidence
FROM position_dependencies
WHERE lv_typ = 'neurealis'
  AND dependency_type = 'required'
  AND is_active = true;
```

---

## Nächste Schritte

1. **GWS-LV analysieren** (T2) - Langtext-Verweise aus GWS extrahieren
2. **UI für Abhängigkeiten** - Im Angebots-CPQ Wizard anzeigen
3. **Confidence-Learning** - Aus tatsächlichen Angeboten lernen und Confidence anpassen

---

*Erstellt: 2026-01-30 23:30*
