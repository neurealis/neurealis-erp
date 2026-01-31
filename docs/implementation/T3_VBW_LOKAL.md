# T3: LV-Analyse VBW (Lokal)

**Status:** Erfolg
**Datum:** 2026-01-30
**Durchgeführt von:** Claude (LV-Analyse-Agent)

---

## Analysierte Positionen

- **VBW-Positionen mit Langtext:** 100 (erste 100 von VBW.LV25-*)
- **Manuell analysiert:** 100
- **Abhängigkeiten erkannt:** 39

---

## Erkannte Abhängigkeiten

### Aus Langtext-Verweisen (4 Einträge)

| Source | Target | Zitat aus Langtext | Confidence |
|--------|--------|-------------------|------------|
| VBW.LV25-1.2 | VBW.LV25-1.1 | "wie in der vorangehenden Position (1.1) auszuführen" | 0.95 |
| VBW.LV25-1.3 | VBW.LV25-1.1 | "wie in der vorangehenden Position (1.1) auszuführen" | 0.95 |
| VBW.LV25-1.4 | VBW.LV25-1.1 | "wie in der vorangehenden Position (1.1) auszuführen" | 0.95 |
| VBW.LV25-3.3 | VBW.LV25-3.1 | "Der Strangaustausch erfolgt analog zu Position 3.1" | 0.90 |

### Required (Zulagen, 2 Einträge)

| Source (Zulage) | Target (Basis) | Begründung |
|-----------------|----------------|------------|
| VBW.LV25-3.10 | VBW.LV25-3.1 | Duschabtrennung freistehend - erfordert Bad-Komplett |
| VBW.LV25-3.11 | VBW.LV25-3.1 | Duschabtrennung Eckvariante - erfordert Bad-Komplett |

### Often Together (21 Einträge)

| Source | Target | Begründung | Confidence |
|--------|--------|------------|------------|
| VBW.LV25-1.9 | VBW.LV25-4.1 | Heizungsnische + Heizkörper (explizit im Text) | 0.90 |
| VBW.LV25-1.9 | VBW.LV25-4.2 | Heizungsnische + Heizkörper | 0.90 |
| VBW.LV25-1.9 | VBW.LV25-4.3 | Heizungsnische + Heizkörper | 0.90 |
| VBW.LV25-1.9 | VBW.LV25-4.10 | Heizungsnische + Heizkörper | 0.90 |
| VBW.LV25-10.1 | VBW.LV25-1.5 | Reinigung (45m²) + Flick/Schönheit (45m²) | 0.90 |
| VBW.LV25-10.2 | VBW.LV25-1.6 | Reinigung (45-75m²) + Flick/Schönheit (45-75m²) | 0.90 |
| VBW.LV25-10.3 | VBW.LV25-1.7 | Reinigung (75-110m²) + Flick/Schönheit (75-110m²) | 0.90 |
| VBW.LV25-2.4 | VBW.LV25-2.1 | DLE + E-Anlage (bis 45m²) | 0.80 |
| VBW.LV25-2.4 | VBW.LV25-2.2 | DLE + E-Anlage (45-75m²) | 0.80 |
| VBW.LV25-2.4 | VBW.LV25-2.3 | DLE + E-Anlage (75-110m²) | 0.80 |
| VBW.LV25-2.6 | VBW.LV25-3.1 | Badentlüfter + Bad-Komplett | 0.85 |
| VBW.LV25-2.10 | VBW.LV25-2.1 | Unterverteilung + E-Anlage (bis 45m²) | 0.80 |
| VBW.LV25-2.10 | VBW.LV25-2.2 | Unterverteilung + E-Anlage (45-75m²) | 0.80 |
| VBW.LV25-2.10 | VBW.LV25-2.3 | Unterverteilung + E-Anlage (75-110m²) | 0.80 |
| VBW.LV25-2.12 | VBW.LV25-2.1 | 6er Zählerschrank + E-Anlage | 0.80 |
| VBW.LV25-2.14 | VBW.LV25-2.1 | 10er Zählerschrank + E-Anlage | 0.80 |
| VBW.LV25-2.19 | VBW.LV25-2.12 | Blitzschutz + 6er Zählerschrank | 0.85 |
| VBW.LV25-2.19 | VBW.LV25-2.14 | Blitzschutz + 10er Zählerschrank | 0.85 |

**Deaktivierte Varianten-Exclusions (3):**
| Source | Target | Begründung |
|--------|--------|------------|
| VBW.LV25-1.12 | VBW.LV25-1.13 | Demontage-Varianten schließen sich aus |
| VBW.LV25-1.12 | VBW.LV25-1.14 | Demontage-Varianten schließen sich aus |
| VBW.LV25-1.13 | VBW.LV25-1.14 | Demontage-Varianten schließen sich aus |

### Suggested (12 Einträge)

| Source | Target | Begründung | Confidence |
|--------|--------|------------|------------|
| VBW.LV25-2.5 | VBW.LV25-2.4 | DLE versetzen setzt DLE voraus | 0.70 |
| VBW.LV25-2.7 | VBW.LV25-2.1 | Schalter/Steckdosen (45m²) + E-Anlage | 0.85 |
| VBW.LV25-2.8 | VBW.LV25-2.2 | Schalter/Steckdosen (45-75m²) + E-Anlage | 0.85 |
| VBW.LV25-2.9 | VBW.LV25-2.3 | Schalter/Steckdosen (75-110m²) + E-Anlage | 0.85 |
| VBW.LV25-3.12 | VBW.LV25-3.1 | WC+Waschtisch erneuern alternativ zu Bad-Komplett | 0.70 |
| VBW.LV25-3.13 | VBW.LV25-3.1 | Spülkasten erneuern | 0.70 |
| VBW.LV25-3.14 | VBW.LV25-3.1 | Umbau Druckspüler | 0.70 |
| VBW.LV25-3.15 | VBW.LV25-3.1 | Badearmatur erneuern | 0.70 |
| VBW.LV25-3.16 | VBW.LV25-3.1 | Brausearmatur erneuern | 0.70 |
| VBW.LV25-3.17 | VBW.LV25-3.1 | Untertischgerät | 0.60 |
| VBW.LV25-11.1 | VBW.LV25-1.5 | Zuschlag bis 5000€ bei Kleinaufträgen | 0.50 |
| VBW.LV25-11.2 | VBW.LV25-1.5 | Zuschlag bis 10000€ bei Kleinaufträgen | 0.50 |

---

## Gespeicherte Abhängigkeiten

| Metrik | Wert |
|--------|------|
| **Total eingefügt** | 39 |
| **In DB eingefügt** | Ja |
| **LV-Typ** | VBW |
| **Source** | text_analysis |

### Nach Dependency-Typ

| Typ | Anzahl | Ø Confidence |
|-----|--------|--------------|
| often_together | 21 | 0.73 |
| suggested | 12 | 0.70 |
| referenced_in_text | 4 | 0.94 |
| required | 2 | 0.95 |

---

## Erkannte Muster im VBW-LV

### 1. Wohnungsgrößen-Staffeln
VBW-LV verwendet konsequent drei Größenstufen:
- **bis 45 m²** (kleine Wohnung)
- **45-75 m²** (mittlere Wohnung)
- **75-110 m²** (große Wohnung)

**Betroffene Gewerke:**
- Maurerarbeiten (Demontage, Flick+Schönheit)
- Elektro (E-Anlage, Schalter/Steckdosen)
- Reinigung (Endreinigung)
- Türen (Innentüren nach Wohnungstyp)

### 2. Zulagen-System
Zulagen sind immer an Basis-Positionen gebunden:
- Duschabtrennungen → Bad-Komplett (3.1)
- Blitzschutz → Zählerschrank

### 3. Gewerks-Cluster

**Elektro-Cluster (Gewerk 2):**
```
E-Anlage (2.1-2.3)
├── Unterverteilung (2.10)
├── Zählerschrank (2.12, 2.14)
│   └── Blitzschutz (2.19)
├── Schalter/Steckdosen (2.7-2.9)
└── DLE (2.4)
    └── DLE versetzen (2.5)
```

**Sanitär-Cluster (Gewerk 3):**
```
Bad-Komplett (3.1)
├── Gäste-WC (3.3) [verweist auf 3.1]
├── Zulagen
│   ├── Duschabtrennung frei (3.10)
│   └── Duschabtrennung Ecke (3.11)
└── Einzelleistungen
    ├── WC+Waschtisch (3.12)
    ├── Spülkasten (3.13, 3.14)
    ├── Armaturen (3.15, 3.16)
    └── Untertischgerät (3.17)
```

**Maurer-Cluster (Gewerk 1):**
```
Rückbau (1.1)
├── Rückbau 7,5m² (1.2) [verweist auf 1.1]
├── Rückbau 10m² (1.3) [verweist auf 1.1]
└── Rückbau 25m² (1.4) [verweist auf 1.1]

Heizungsnische (1.9)
└── oft mit Heizkörper (4.1-4.3, 4.10)
```

---

## Nächste Schritte

1. **GWS-LV analysieren** - Gleiche Methodik auf GWS anwenden
2. **Heizungs-Positionen (4.x) laden** - Für vollständige Heizungs-Cluster
3. **Fliesen/Boden-Positionen analysieren** - Abhängigkeiten zu Bad-Komplett
4. **UI für Abhängigkeiten** - Admin-Oberfläche zum Verwalten

---

*Erstellt: 2026-01-30 23:30*
