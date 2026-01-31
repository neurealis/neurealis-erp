# T3: LV-Analyse GWS (Lokal)

**Status:** ✅ Erfolg
**Datum:** 2026-01-30
**Methode:** Manuelle Langtext-Analyse + semantische Abhängigkeiten

---

## Analysierte Positionen

| Metrik | Wert |
|--------|------|
| GWS-Positionen gesamt | 711 |
| Mit Langtext (>50 Zeichen) | 561 |
| Analysiert für Abhängigkeiten | ~150 |
| Zulage-Positionen identifiziert | 68 |

---

## Erkannte Abhängigkeiten

### Zusammenfassung

| Typ | Anzahl | Beschreibung |
|-----|--------|--------------|
| `referenced_in_text` | 42 | Explizite Verweise im Langtext ("zu Pos X", "wie Pos X") |
| `often_together` | 15 | Semantisch häufig zusammen beauftragt |
| `required` | 10 | Technisch zwingend erforderlich |
| `suggested` | 7 | Empfohlen, aber nicht zwingend |
| **Total** | **74** | |

---

## Aus Langtext-Verweisen (referenced_in_text)

### Lackiearbeiten (09.05.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-09.05.3 (Zulage Oberlicht) | GWS.LV23-09.05.1 (Lackierung Innentürblatt) | "Lackierung wie Pos 09.05.1" |
| GWS.LV23-09.05.4 (Zulage Seitenelement) | GWS.LV23-09.05.1 (Lackierung Innentürblatt) | "Lackierung wie Pos 09.05.1" |

### Estricharbeiten (05.01.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-05.01.3 (Mehr-/Minderstärken) | GWS.LV23-05.01.2 (Zement-Estrich) | "zu Vorposition" |
| GWS.LV23-05.01.4 (Zulage Abbindebeschleuniger) | GWS.LV23-05.01.2 (Zement-Estrich) | "Zulage zu Pos 2" |

### Heizung - Heizkörper (21.01.01.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-21.01.01.8 (Zulage Breite bis 1m) | GWS.LV23-21.01.01.4-7 | "zu Pos 4, Pos 5, Pos 6, Pos 7" |
| GWS.LV23-21.01.01.9 (Zulage Breite bis 1,5m) | GWS.LV23-21.01.01.4-7 | "zu Pos 4, Pos 5, Pos 6, Pos 7" |
| GWS.LV23-21.01.01.10 (Zulage Breite bis 2m) | GWS.LV23-21.01.01.4-7 | "zu Pos 4, Pos 5, Pos 6, Pos 7" |
| GWS.LV23-21.01.01.14 (Zulage 450x1800) | GWS.LV23-21.01.01.12-13 | "zu Pos 12, Pos 13" |

### Holzreparaturen - Türbekleidung (08.03.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-08.03.7 (Zulage profiliert) | GWS.LV23-08.03.6 (Türbekleidung reparieren) | "Zulage zu Pos 08.03.6" |
| GWS.LV23-08.03.8 (Zulage Sockelstück) | GWS.LV23-08.03.6 | "Zulage zu Pos 08.03.6" |
| GWS.LV23-08.03.9 (Zulage Futter richten) | GWS.LV23-08.03.6 | "Zulage zu Pos 08.03.6" |
| GWS.LV23-08.03.10 (Zulage Futter erneuern) | GWS.LV23-08.03.6 | "Zulage zu Pos 08.03.6" |

### Wohnungs-/Zimmertüren (08.04.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-08.04.8 (Zulage Lichtausschnitt) | GWS.LV23-08.04.1 (Zimmertür inkl. Zarge) | "Zulage zu Pos 08.04.1" |
| GWS.LV23-08.04.9 (Zulage Lüftungsgitter) | GWS.LV23-08.04.1 | "Zulage zu Pos 08.04.1" |
| GWS.LV23-08.04.14 (Zulage Türöffnung anpassen) | GWS.LV23-08.04.11 (WE-Tür RC2) | "Zulage zu Pos 08.04.11" |
| GWS.LV23-08.04.15 (Zulage Sicherheitsdrücker) | GWS.LV23-08.04.11 | Sicherheitsdrücker für WE-Tür |

### Sanitär - Duschtassen-Zulagen (21.02.01.x)

| Source | Target | Begründung |
|--------|--------|------------|
| GWS.LV23-21.02.01.9-13 (Superplan Größen) | GWS.LV23-21.02.01.8 (Duschtasse Superplan 800x800) | Größen-Zulagen |
| GWS.LV23-21.02.01.15-19 (Duschplan Größen) | GWS.LV23-21.02.01.14 (Duschtasse Duschplan 800x800) | Größen-Zulagen |

---

## Semantische Abhängigkeiten (Maler)

### Tapezieren/Streichen Workflow

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Raufaser tapezieren (09.04.1) | Tiefengrund (09.03.1) | required | Untergrund muss grundiert sein |
| Raufaser tapezieren (09.04.1) | Wandspachtel Q2 (09.03.5) | suggested | Oft vorher gespachtelt |
| Dispersionsanstrich (09.04.2) | Raufaser tapezieren (09.04.1) | required | Raufaser muss zuerst tapeziert werden |

### Lackierungen

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Lackierung Türblatt (09.05.1) | Tiefengrund (09.03.1) | suggested | Grundierung bei Bedarf |
| Lackierung Zarge (09.05.2) | Tiefengrund (09.03.1) | suggested | Grundierung bei Bedarf |

---

## Semantische Abhängigkeiten (Fliesen/Bad)

### Abdichtung → Fliesen Workflow

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Wandbefliesung (06.01.15) | Wandabdichtung W1-I (06.01.6) | required | Nassraum muss abgedichtet sein |
| Bodenbefliesung (06.01.16) | Bodenabdichtung W2-I (06.01.5) | required | Nassraum muss abgedichtet sein |
| Bodenabdichtung (06.01.5) | Dichtbänder (06.01.8) | required | Ecken und Anschlüsse |
| Bodenabdichtung (06.01.5) | Dichtecken (06.01.9) | required | Ecken abdichten |
| Wandabdichtung (06.01.6) | Dichtbänder (06.01.8) | required | Ecken und Anschlüsse |
| Wandabdichtung (06.01.6) | Dichtecken (06.01.9) | required | Ecken abdichten |

### Abdichtung → Rohrdurchführungen

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Bodenabdichtung (06.01.5) | Manschette DN32 (06.01.10) | suggested | Bei Sanitär-Durchführungen |
| Bodenabdichtung (06.01.5) | Manschette DN100 (06.01.11) | suggested | Bei Abwasser-Durchführungen |

### Fliesen → Verfugung

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Wandverfugung (06.01.21) | Wandbefliesung (06.01.15) | required | Erst Fliesen, dann Fugen |
| Bodenverfugung (06.01.22) | Bodenbefliesung (06.01.16) | required | Erst Fliesen, dann Fugen |
| Silikonfugen (06.01.23) | Wandverfugung (06.01.21) | often_together | Anschlussfugen nach Verfugung |
| Silikonfugen (06.01.23) | Bodenverfugung (06.01.22) | often_together | Anschlussfugen nach Verfugung |

---

## Semantische Abhängigkeiten (Sanitär)

### Dusche/Wanne → Einmauerung

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Einmauern Duschwanne 2-seitig (06.01.26) | Duschtasse Superplan (21.02.01.8) | often_together | Schürze für Duschtasse |
| Einmauern Duschwanne 3-seitig (06.01.27) | Duschtasse Superplan (21.02.01.8) | often_together | Schürze für Duschtasse |
| Einmauern Badewanne 2-seitig (06.01.24) | Rechteck-Badewanne (21.02.01.5) | often_together | Schürze für Wanne |
| Einmauern Badewanne 3-seitig (06.01.25) | Rechteck-Badewanne (21.02.01.5) | often_together | Schürze für Wanne |

### Waschtisch → Armatur

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Einhandmischer (21.02.01.28) | Waschtischanlage (21.02.01.26) | often_together | Armatur für Waschtisch |
| Duschabtrennung (21.02.01.25) | Duschtasse (21.02.01.8) | suggested | Abtrennung für Dusche |

---

## Semantische Abhängigkeiten (Türen)

### Tür-Komplett-Paket

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| Drückergarnitur (08.04.10) | Zimmertür inkl. Zarge (08.04.1) | often_together | Garnitur für neue Tür |
| Drückergarnitur (08.04.10) | Zimmertür mit Stahlzarge (08.04.2) | often_together | Garnitur für neue Tür |
| Türlackierung (09.05.1) | Zimmertür (08.04.1) | often_together | Bei Renovierung |
| Zargenlackierung (09.05.2) | Zimmertür (08.04.1) | often_together | Bei Renovierung |

---

## Gespeicherte Abhängigkeiten

- **Total in DB:** 74 Abhängigkeiten
- **Tabelle:** `position_dependencies`
- **LV-Typ:** GWS
- **Source:** text_analysis
- **Confidence:** 0.70 - 0.95

### Verteilung nach Typ

```
referenced_in_text: 42 (56.8%)  - Explizite Langtext-Verweise
often_together:     15 (20.3%)  - Häufig zusammen beauftragt
required:           10 (13.5%)  - Technisch zwingend
suggested:           7 (9.5%)   - Empfohlen
```

---

## Nächste Schritte

1. **VBW LV analysieren** - Gleiche Methode für VBW-Positionen
2. **neurealis LV analysieren** - Eigene Positionen für B2C
3. **Admin-Regeln ergänzen** - Manuelle Regeln aus Projekterfahrung
4. **UI für Abhängigkeiten** - Anzeige im CPQ-Wizard

---

*Erstellt: 2026-01-30 durch LV-Analyse-Agent*
