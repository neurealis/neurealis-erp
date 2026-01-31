# Analyse: LV-spezifische Prompts für transcription-parse

**Datum:** 2026-01-30
**Empfehlung:** Ein Prompt mit LV-spezifischen Parametern (Hybrid-Ansatz)

## 1. Aktueller Prompt

Die `transcription-parse` Edge Function verwendet einen generischen Prompt:

```
Du bist ein Experte für Wohnungssanierung. Analysiere den folgenden Text
und extrahiere alle genannten Bauleistungen.
```

Der Prompt extrahiert:
- `beschreibung`: Was gemacht werden soll
- `gewerk`: Maler|Elektrik|Sanitär|Boden|Heizung|Tischler|Trockenbau|Fliesen|Sonstiges
- `oberflaeche`: wand|decke|boden|null
- `raum`: Raumname
- `qualitaet`: Q2|Q3|Standard|null
- `suchbegriffe`: Keywords für semantische Suche

**Problem:** Der Prompt kennt weder die LV-spezifischen Gewerke-Namen noch die typischen Formulierungen.

## 2. LV-Typ Vergleich

### Anzahl Positionen pro LV-Typ

| LV-Typ | Positionen | Anteil |
|--------|------------|--------|
| covivio | 1.299 | 41% |
| GWS | 710 | 22% |
| neurealis | 693 | 22% |
| VBW | 313 | 10% |
| WBG Lünen | 73 | 2% |
| Artikel | 78 | 2% |

### Gewerke-Verteilung

| LV-Typ | Top-Gewerke | Anzahl Gewerke |
|--------|-------------|----------------|
| **GWS** | Elektroarbeiten (41), Fliesen/Plattenarbeiten (40), Fenster (39), Sanitär (38), Demontage (34), Heizung (33) | 42 verschiedene |
| **VBW** | Heizung (32), Decken/Wände (27), Bad (26), Fliesen (23), Boden (22), Maler (22) | 24 verschiedene |
| **neurealis** | Sonstiges (335), neurealis (198), Fenster (21), Maler (14), Elektro (14) | 36 verschiedene |
| **covivio** | (null) (131), Reparatur Türanlagen (99), Duschwannen/Armaturen (88), Heizflächen (54) | 91 verschiedene |

**Beobachtung:** Die Gewerke-Namen sind **signifikant unterschiedlich**:
- GWS: "Elektroarbeiten", "Fliesen,u. Plattenarbeiten"
- VBW: "Elektroarbeiten", "Fliesen", "Decken und Wände"
- neurealis: "Elektro", "Fliesen", "Sonstiges"
- covivio: Sehr granulare Kategorien ("Duschwannen, Armaturen, Brausesets, Zubehör")

### Artikelnummer-Formate

| LV-Typ | Format | Beispiele |
|--------|--------|----------|
| **GWS** | `GWS.LV{YY}-{Abschnitt}.{Pos}` | `GWS.LV23-08.04.2`, `GWS.LV23-01.01.1` |
| **VBW** | `VBW.LV{YY}-{Pos}` oder UUID | `VBW.LV25-2.12`, `VBW-e984272e` |
| **neurealis** | Numerisch oder Datensystem-ID | `201476014`, `532140014`, `NR-cc67ef05` |
| **covivio** | `CV{YY}.{Bereich}.{Sub}.{Pos}` | `CV24.LS44.11.09.0030`, `CV24.GS24.03.05.0040` |

### Langtext-Stil

| LV-Typ | Besonderheiten |
|--------|----------------|
| **GWS** | - Viele "Zulage"-Positionen ("Zulage Duschtasse Superplan") |
|         | - Verweise auf andere Positionen ("wie vor Position", "Pos 1", "Pos 2") |
|         | - Hersteller-Spezifikationen ("Lindner/Hörmann/BOS od. gleichw.") |
|         | - Minderleistungen als negative Positionen |
| **VBW** | - Prozessbeschreibungen ("ist zu demontieren, aus der Wohnung zu schaffen") |
|         | - Geförderte Wohnungen erwähnt ("öffentl. geförderten Wohnungen bis 45 m2") |
|         | - Herstellerbezug (Jeld-Wen, BETEC-Verfahren) |
| **neurealis** | - HTML-formatierte Beschreibungen (`<p>`, `<ul>`) |
|               | - KfW-Standards erwähnt ("KfW-Effizienzhaus 40") |
|               | - Freiere Formulierungen (B2C-orientiert) |
| **covivio** | - Sehr technisch/präzise ("wie vor, jedoch Bauhöhe: 900mm") |
|             | - Viele Varianten-Positionen mit "wie vor"-Verweisen |
|             | - Hersteller: Kaldewei, Villeroy&Boch, Doyma |

## 3. Unterschiede mit Relevanz für Prompts

### Kritische Unterschiede:

1. **Gewerke-Mapping ist inkompatibel**
   - Der aktuelle Prompt verwendet: `Maler|Elektrik|Sanitär|Boden|Heizung|Tischler|Trockenbau|Fliesen|Sonstiges`
   - GWS verwendet: `Elektroarbeiten`, `Fliesen,u. Plattenarbeiten`, `Bodenbelagsarbeiten`
   - covivio verwendet: `Duschwannen, Armaturen, Brausesets, Zubehör`
   - **Konsequenz:** Semantic Search findet oft keine Treffer wegen Gewerk-Filter

2. **Zulagen/Varianten-Logik**
   - GWS/covivio: Viele Positionen sind "Zulagen" oder "Varianten" zu Basispositionen
   - neurealis/VBW: Weniger Zulage-Struktur
   - **Konsequenz:** Prompt muss verstehen, wann Zulage vs. Hauptposition gemeint ist

3. **Qualitätsstufen**
   - GWS: Q2/Q3 wird verwendet
   - neurealis: KfW-Standards statt Q-Stufen
   - covivio: Keine expliziten Q-Stufen, aber Produkt-Varianten (Standard 1/2/3)
   - **Konsequenz:** `qualitaet`-Feld muss LV-spezifisch interpretiert werden

4. **Flächen-Logik**
   - VBW: Wohnungsgrößen-Staffeln ("bis 45 m2", "bis 65 m2")
   - covivio: Raumpauschalen
   - GWS: Einzelabrechnung
   - **Konsequenz:** Mengenschätzung braucht LV-spezifische Regeln

## 4. Empfehlung

### Option A: Ein Prompt für alle
**Pro:**
- Einfachere Wartung (1 Prompt statt 5+)
- Weniger Code-Duplizierung
- GPT ist gut genug, um Varianten zu erkennen

**Contra:**
- Gewerke-Mapping scheitert oft
- Semantic Search mit falschem Gewerk-Filter = schlechte Ergebnisse
- Keine LV-spezifischen Hinweise möglich

### Option B: LV-spezifische Prompts
**Pro:**
- Perfektes Gewerke-Mapping pro LV
- LV-spezifische Formulierungen werden erkannt
- Zulage-Logik kann eingebaut werden

**Contra:**
- 5-6 separate Prompts pflegen
- Mehr Token-Verbrauch (längere Prompts)
- Höhere Komplexität

### Finale Empfehlung: Hybrid-Ansatz

**Ein Basis-Prompt mit LV-spezifischen Parametern:**

```typescript
const LV_CONFIGS = {
  GWS: {
    gewerke: ["Elektroarbeiten", "Fliesen,u. Plattenarbeiten", "Fenster", ...],
    besonderheiten: "Achte auf Zulagen-Verweise (Zulage für...) und Positions-Verweise (wie vor Position, Pos 1)",
    qualitaeten: "Q2, Q3, Standard",
    beispiele: "Zulage Duschtasse Superplan → suche nach Basis-Duschtasse UND Zulage"
  },
  VBW: {
    gewerke: ["Heizung", "Decken und Wände", "Bad", "Fliesen", ...],
    besonderheiten: "Beachte Wohnungsgrößen-Staffeln (bis 45 m2, bis 65 m2)",
    qualitaeten: "Standard",
    beispiele: "Türerneuerung in geförderter Wohnung → prüfe m2-Staffel"
  },
  neurealis: {
    gewerke: ["Sonstiges", "neurealis", "Fenster", "Maler", ...],
    besonderheiten: "B2C-Kontext, KfW-Standards statt Q-Stufen, flexible Formulierungen",
    qualitaeten: "KfW 40, KfW 55, Standard",
    beispiele: "Energetische Sanierung → KfW-Position suchen"
  },
  covivio: {
    gewerke: ["Reparatur an Türanlagen", "Duschwannen, Armaturen, Brausesets, Zubehör", ...],
    besonderheiten: "Sehr granulare Kategorien, viele wie vor-Verweise",
    qualitaeten: "Standard 1 (Einfach), Standard 2 (Mittel), Standard 3 (Hoch)",
    beispiele: "Duschwanne 900x900 → CV24.LS44.11.09.0030"
  }
};

const buildPrompt = (lv_typ: string, text: string) => {
  const config = LV_CONFIGS[lv_typ] || LV_CONFIGS.neurealis;

  return `Du bist ein Experte für Wohnungssanierung im Kontext des LV-Typs "${lv_typ}".

GEWERKE für dieses LV (verwende NUR diese exakten Namen):
${config.gewerke.join(", ")}

BESONDERHEITEN dieses LV:
${config.besonderheiten}

QUALITÄTSSTUFEN:
${config.qualitaeten}

BEISPIEL-INTERPRETATION:
${config.beispiele}

Analysiere den folgenden Text und extrahiere alle Bauleistungen:
${text}

...`;
};
```

**Vorteile:**
1. Ein Prompt-Template, aber LV-spezifische Parameter
2. Gewerke-Liste wird exakt aus DB geladen (keine Mismatch)
3. LV-Besonderheiten werden berücksichtigt
4. Wartbar: Parameter können in DB gespeichert werden

## 5. Vorgeschlagene Prompt-Anpassungen

### Schritt 1: Gewerke-Liste aus DB laden

```sql
-- Pro LV-Typ die Top-20 Gewerke laden
SELECT DISTINCT gewerk
FROM lv_positionen
WHERE lv_typ = $1 AND gewerk IS NOT NULL
GROUP BY gewerk
ORDER BY COUNT(*) DESC
LIMIT 20;
```

### Schritt 2: LV-Konfiguration als JSON in DB speichern

Neue Tabelle `lv_config`:
```sql
CREATE TABLE lv_config (
  lv_typ TEXT PRIMARY KEY,
  besonderheiten TEXT,
  qualitaeten TEXT[],
  beispiele TEXT,
  prompt_hints JSONB
);
```

### Schritt 3: Angepasster Prompt

```typescript
const systemPrompt = `Du extrahierst Bauleistungen aus Texten für das LV "${lv_typ}".

WICHTIG:
1. Verwende NUR Gewerke aus dieser Liste: ${gewerke.join(", ")}
2. ${config.besonderheiten}
3. Bei "Zulage" oder "wie vor": Notiere dies im Feld "ist_zulage" oder "bezug_auf"

Antworte nur mit validem JSON.`;

const userPrompt = `Analysiere folgenden Text:
${text}

Gib die Ergebnisse als JSON zurück:
{
  "positionen": [
    {
      "beschreibung": "Was gemacht werden soll",
      "gewerk": "Exakter Name aus Liste",
      "ist_zulage": true/false,
      "bezug_auf": "Basisposition wenn Zulage",
      "oberflaeche": "wand|decke|boden|null",
      "raum": "Raumname oder null",
      "qualitaet": "${config.qualitaeten.join('|')}|null",
      "suchbegriffe": ["keyword1", "keyword2"],
      "mengenhinweis": "Falls Menge erkennbar"
    }
  ]
}`;
```

### Schritt 4: Semantic Search ohne Gewerk-Filter als Fallback

```typescript
// Erste Suche: Mit Gewerk-Filter
let matches = await supabase.rpc("search_lv_positions", {
  query_embedding: embedding,
  match_count: 3,
  filter_lv_typ: lv_typ,
  filter_gewerk: pos.gewerk
});

// Fallback: Ohne Gewerk-Filter wenn keine Treffer
if (!matches || matches.length === 0) {
  matches = await supabase.rpc("search_lv_positions", {
    query_embedding: embedding,
    match_count: 5,
    filter_lv_typ: lv_typ,
    filter_gewerk: null  // Alle Gewerke
  });
}
```

## 6. Zusammenfassung

| Aspekt | Aktuell | Empfehlung |
|--------|---------|------------|
| Gewerke-Liste | Hardcoded, generisch | Aus DB pro LV-Typ laden |
| Zulagen-Logik | Nicht vorhanden | Neues Feld `ist_zulage` + `bezug_auf` |
| Qualitätsstufen | Q2/Q3/Standard | LV-spezifisch (Q2/Q3, KfW, Standard 1-3) |
| Prompt | Ein generischer | Ein Template + LV-Parameter |
| Semantic Search | Mit Gewerk-Filter | Mit Filter + Fallback ohne |

**Aufwand:** ~2-3 Stunden Implementierung
**Erwartete Verbesserung:** 30-50% bessere Match-Rate durch korrektes Gewerke-Mapping
