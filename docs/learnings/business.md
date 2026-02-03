# Learnings: Business / Wohnungssanierung

Letzte Aktualisierung: 2026-02-03

---

## Preise / Kalkulation

### L103: preis = EK, listenpreis = VK - IMMER VK verwenden!
**Kategorie:** Business
**Datum:** 2026-01-31
**Problem:** Angebot war 41% zu niedrig
**DB-Struktur:**
- `preis` = EK (Einkaufspreis)
- `listenpreis` = VK (Verkaufspreis)
| Position | EK | VK | Marge |
|----------|---:|---:|------:|
| Wand-WC | 230 EUR | 352 EUR | +53% |
| E-Check | 332 EUR | 538 EUR | +62% |
**Regel:** Bei Angeboten IMMER `listenpreis`!

---

### L136: Komplettsanierung 1.000-1.200 EUR/m²
**Kategorie:** Business
**Datum:** 2026-01-31
**Korrekte Preise 2026:**
- Komplettsanierung: 1.000-1.200 EUR/m²
- Badsanierung: 12.000-25.000 EUR
- Elektrik komplett: 80-120 EUR/m²
- Heizungsanlage: 15.000-25.000 EUR
**Beispiel:** 110 m² = 121.000 EUR (nicht 75.000!)

---

### L113: Pricing-Profile für Kundengruppen
**Kategorie:** Business
**Datum:** 2026-01-30
**Zwei Ebenen:**
1. Profile: "GWS Basis", "Privataufschlag 15%"
   - `base_lv_typ`
   - `markup_percent`
   - `per_trade_overrides`
2. Kunde: Individuelle Überschreibung
**Regel:** Aufschläge NICHT im Stamm-LV

---

## LV / Leistungsverzeichnis

### L102: LV-Typen konsolidieren
**Kategorie:** Business
**Datum:** 2026-01-31
**Problem:** "Privat" und "neurealis" waren getrennt
**Lösung:**
```sql
UPDATE lv_positionen SET lv_typ = 'neurealis' WHERE lv_typ = 'Privat';
```
**Ergebnis:** 693 Positionen statt 412+281 getrennt

---

### L117: LV-spezifische Gewerke-Namen inkompatibel
**Kategorie:** Technisch
**Datum:** 2026-01-30
| LV-Typ | Gewerk-Beispiele |
|--------|------------------|
| GWS | Elektroarbeiten, Fliesen,u. Plattenarbeiten |
| VBW | Elektroarbeiten, Decken und Wände |
| neurealis | Elektro, Sonstiges |
**Lösung:** Gewerke aus DB laden, nicht hardcoden

---

### L119: LV-Abhängigkeiten Typen
**Kategorie:** Technisch
**Datum:** 2026-01-30
| Typ | Bedeutung | Beispiel |
|-----|-----------|----------|
| `referenced_in_text` | Expliziter Verweis | "zu Pos. 02.03.7" |
| `required` | Technisch zwingend | Fliesen → Abdichtung |
| `suggested` | Empfohlen | Raufaser → Streichen |
| `often_together` | Häufig zusammen | Tür + Zarge |

---

### L094: Dry-Run-Pflicht für LV-Imports
**Kategorie:** Workflow
**Datum:** 2026-01-30
**IMMER mit Dry-Run:**
1. Kategorisieren: Erhöhungen, Senkungen, Neue, Kein Match
2. Preissenkungen SEPARAT: NIEMALS automatisch
3. User-Bestätigung vor echtem Import
4. Backup der betroffenen Datensätze

---

## Verhandlung / VBW

### L013: Leerstandskosten als Argument
**Kategorie:** Business
**Datum:** 2026-01-27
**Formel:** `WE/Jahr × Verzögerungswochen × Fläche × EUR/m²/Monat ÷ 4`
**Beispiel VBW:** 280 WE × 3 Wochen × 60m² × 8,50EUR = 357.000 EUR/Jahr

---

### L014: Ausreißer-Analyse für LV-Verhandlungen
**Kategorie:** Business
**Datum:** 2026-01-27
**Methode:**
1. Alt-LV vs. Neu-LV vergleichen
2. Referenz-BVs als Praxistest
3. Markt-LV (GWS) als Benchmark
**Kritisch:** >25% Abweichung = Gesprächsbedarf

---

### L015: Materialvorschläge dokumentieren
**Kategorie:** Business
**Datum:** 2026-01-27
**Kriterien:**
- Verfügbarkeit (Lieferzeiten)
- EK-Preis
- Qualität
- Markenakzeptanz

---

### L017: Zahlungsziel-Argumentation
**Kategorie:** Business
**Datum:** 2026-01-27
**Ziel:** 14 Tage netto beibehalten
**Argumente:**
- NUs sind kleine Betriebe
- Gute NUs durch pünktliche Zahlung halten
- Vorleistung bei Material
**Red Line:** Max 21 Tage ohne Skonto

---

### L018: VBW LV 2026 - Kritische Positionen
**Kategorie:** Business
**Datum:** 2026-01-27
| Pos. | Position | Abweichung | Mindestpreis |
|------|----------|------------|--------------|
| 3.3 | Küchenstränge | -72% | 800 EUR |
| 1.5 | Elektroschlitze | -54% | - |
| 2.1 | E-Anlage | -44% | 3.800 EUR |
| 6.3 | Vinyl-Boden | -40% | 28 EUR/m² |

---

### L019: VBW Material-Freigaben
**Kategorie:** Business
**Datum:** 2026-01-27
| Position | Vorschlag | Vorteil |
|----------|-----------|---------|
| Schalter | Gira Standard 55 | Günstiger |
| Badlüfter | Maico ECA 100 ipro K | Nachlauf |
| Sanitär | Vigour One | Preis-Leistung |
| Fliesen | Kermos 8mm | Rutschhemmend! |

---

## Prozessoptimierung

### L016: BL direkt bei Kündigung zuweisen
**Kategorie:** Business
**Datum:** 2026-01-27
**Problem:** 3 Wochen Verzögerung zwischen Auszug und Baustart
**Lösung:**
- BL bei Kündigung zuweisen (nach Regionen)
- Erstbegehung 1-2 Wochen nach Kündigung
- Budget-Freigabe vor Auszug

---

### L068: 2-Phasen-Erinnerungslogik
**Kategorie:** Business
**Datum:** 2026-01-29
**Phase 1 (NU-Erinnerung):**
- Bedingung: `erinnerung_status='Aktiv'` UND `fotos_nachweis_nu` LEER
- E-Mail an NU alle 2 Tage

**Phase 2 (BL-Erinnerung):**
- Bedingung: `fotos_nachweis_nu` BEFÜLLT
- E-Mail an Bauleiter

**Stopp:** status_mangel = 'Abgenommen'

---

## Dokumente / Nummernlogik

### L112: Dokument-Nummern mit Revisionen
**Kategorie:** Business
**Datum:** 2026-01-30
**Format:** `{ATBS}-{TYP}{LAUFEND}`
**Workflow:**
- ANG01 → Änderung → ANG02 (neue Nummer!)
- Auftrag erteilt → AB01
- NU ausgewählt → NUA01
**Regel:** Gleiche Nr NIE wiederverwenden

---

### L121: NUA-Vertragswerk 12 Paragraphen
**Kategorie:** Business
**Datum:** 2026-01-30
**Wichtige:**
- §4 Nachträge (Partner-Portal Pflicht!)
- §5 Zahlungen (7 Tage Vorschuss, 14 Tage Schluss)
- §6 Vertragsstrafe (0,25%/Tag, max 5%)
- §8 Kundenschutzklausel (12 Monate, 25.000 EUR)
**Dreimal betont:** Partner-Portal Pflicht

---

## Marketing / Blog

### L122: Blog-Schreibstil für B2B-Vermieter
**Kategorie:** Marketing
**Datum:** 2026-01-31
1. Fließtext statt Bullet-Listen
2. Konkrete Zahlen durchrechnen
3. Betriebswirtschaftliche Argumentation
4. 1.500+ Wörter für Cornerstone

---

### L123: 3-Block-Methode Leerstandskalkulation
**Kategorie:** Marketing
**Datum:** 2026-01-31
```
Block 1 - Fixkosten: Hausgeld, Grundsteuer, Versicherung, Heizung
Block 2 - Entgangene Miete: Marktmiete (nicht Altmiete!)
Block 3 - Vermarktung & Risiko: Inserate, Puffer
```
**Beispiel 65m²:** 1.014 EUR/Monat (vs. 682 EUR bei reiner Mietbetrachtung)

---

### L125: CTA als logische Konsequenz
**Kategorie:** Marketing
**Datum:** 2026-01-31
**FALSCH:** "Kontaktieren Sie neurealis!"
**RICHTIG:** "Sie möchten Ihre Leerstandskosten analysieren lassen? neurealis bietet eine kostenfreie Ersteinschätzung."

---

*Vollständige Learnings siehe docs/learnings.md*
