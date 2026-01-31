# T2: transcription-parse Edge Function - Implementierung

**Datum:** 2026-01-31
**Version:** v2
**Status:** DEPLOYED

---

## Zusammenfassung

Die `transcription-parse` Edge Function wurde implementiert mit:
- Hybrid-Prompt basierend auf `lv_config` Tabelle
- Lern-System via `position_corrections` Tabelle
- Fallback-Suche über alle LVs bei schlechten Treffern
- Top 5 Alternativen pro Position

---

## Endpoint

**URL:** `https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/transcription-parse`

**Methode:** POST

**Auth:** Bearer Token (JWT oder Service Role Key)

---

## Request-Parameter

```typescript
interface ParseRequest {
  transcription: string;      // Pflicht: Baubesprechungs-Text (min. 10 Zeichen)
  lv_typ: string;            // Pflicht: "GWS", "VBW", oder "neurealis"
  projekt_nr?: string;        // Optional: ATBS-Nummer
  include_alternatives?: boolean; // Optional: Top 5 Alternativen (default: true)
}
```

**Beispiel-Request:**
```json
{
  "lv_typ": "GWS",
  "transcription": "Im Bad brauchen wir neue Fliesen, ca. 12 Quadratmeter. Die Elektrik muss komplett erneuert werden, 15 Steckdosen. Der Boden im Wohnzimmer, ungefähr 25 qm, bekommt Laminat.",
  "include_alternatives": true
}
```

---

## Response-Struktur

```typescript
interface ParseResponse {
  success: boolean;
  lv_typ: string;
  positionen: ParsedPosition[];
  statistik: {
    total: number;              // Anzahl extrahierter Positionen
    mit_match: number;          // Positionen mit LV-Zuordnung
    ohne_match: number;         // Positionen ohne Match
    korrekturen_angewendet: number; // Gelernte Korrekturen verwendet
    fallbacks: number;          // Fallback auf andere LVs
  };
  error?: string;
}

interface ParsedPosition {
  original_text: string;        // Text aus Transkription
  gewerk: string;               // Zugeordnetes Gewerk
  beschreibung: string;         // Deutsche Beschreibung
  menge: number;                // Geschätzte Menge
  einheit: string;              // Stk, m², lfm, psch

  lv_position?: {
    id: string;
    artikelnummer: string;
    bezeichnung: string;
    beschreibung?: string;
    einzelpreis: number;        // EK (preis)
    listenpreis: number;        // VK (listenpreis)
    similarity: number;         // 0-1 Ähnlichkeit
    is_fallback: boolean;       // true wenn aus anderem LV
  };

  alternativen?: Array<{        // Top 4 weitere Treffer
    id: string;
    artikelnummer: string;
    bezeichnung: string;
    einzelpreis: number;
    listenpreis: number;
    similarity: number;
  }>;

  korrektur_angewendet?: boolean; // Gelernte Korrektur verwendet
  korrektur_id?: string;          // ID der Korrektur
}
```

---

## Workflow

### 1. LV-Config laden
- Tabelle: `lv_config`
- Filter: `lv_typ` + `aktiv = true`
- Inhalt: Gewerke-Liste, Besonderheiten, Prompt-Hints

### 2. GPT Positions-Extraktion
- Modell: `gpt-5.2`
- Dynamischer Prompt mit LV-spezifischen Gewerken
- Mehrsprachige Eingabe wird zu Deutsch normalisiert
- Output: JSON-Array mit extrahierten Positionen

### 3. Für jede Position: Matching

**3a. Korrektur-Suche (Priorität)**
- RPC: `search_position_corrections`
- Threshold: 0.92 Similarity
- Bei Match: Gelernte Position direkt verwenden
- Counter `angewendet_count` wird erhöht

**3b. LV-Suche (Normal)**
- RPC: `search_lv_positions`
- Filter: `lv_typ`, kein Gewerk-Filter
- Return: Top 5 Treffer

**3c. Fallback-Suche**
- Trigger: Bester Match < 0.7 Similarity
- Suche: Alle LVs ohne Filter
- Markierung: `is_fallback: true`

---

## Tabellen-Abhängigkeiten

| Tabelle | Verwendung |
|---------|------------|
| `lv_config` | LV-spezifische Konfiguration |
| `lv_positionen` | Haupttabelle mit Embeddings |
| `position_corrections` | Gelernte Korrekturen |

---

## RPC-Funktionen

### search_lv_positions
```sql
search_lv_positions(
  query_embedding vector(1536),
  match_count integer,
  filter_lv_typ text,
  filter_gewerk text
)
```

### search_position_corrections
```sql
search_position_corrections(
  query_embedding vector(1536),
  p_lv_typ text,
  match_threshold numeric,
  match_count integer
)
```

---

## Test-Anleitung

### 1. cURL Test

```bash
curl -X POST \
  'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/transcription-parse' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "lv_typ": "GWS",
    "transcription": "Bad komplett fliesen, 12 qm. Elektrik neu, 15 Steckdosen."
  }'
```

### 2. JavaScript Test

```javascript
const { data, error } = await supabase.functions.invoke('transcription-parse', {
  body: {
    lv_typ: 'GWS',
    transcription: 'Bad komplett fliesen, 12 qm. Elektrik neu, 15 Steckdosen.',
    include_alternatives: true
  }
});

console.log('Positionen:', data.positionen.length);
console.log('Mit Match:', data.statistik.mit_match);
```

### 3. Erwartetes Ergebnis

```json
{
  "success": true,
  "lv_typ": "GWS",
  "positionen": [
    {
      "original_text": "Bad komplett fliesen, 12 qm",
      "gewerk": "Fliesen,u. Plattenarbeiten",
      "beschreibung": "Wandfliesen Bad verlegen",
      "menge": 12,
      "einheit": "m²",
      "lv_position": {
        "artikelnummer": "GWS.LV23-05.01.01",
        "bezeichnung": "Wandfliesen liefern und verlegen",
        "listenpreis": 45.50,
        "similarity": 0.89
      },
      "alternativen": [...]
    },
    ...
  ],
  "statistik": {
    "total": 2,
    "mit_match": 2,
    "ohne_match": 0,
    "korrekturen_angewendet": 0,
    "fallbacks": 0
  }
}
```

---

## Fehlerbehandlung

| HTTP Code | Fehler | Lösung |
|-----------|--------|--------|
| 400 | Transkription zu kurz | Min. 10 Zeichen |
| 400 | lv_typ fehlt | GWS, VBW, oder neurealis angeben |
| 400 | LV-Config nicht gefunden | In `lv_config` Tabelle prüfen |
| 500 | OpenAI API Key fehlt | In Supabase Secrets konfigurieren |
| 500 | GPT-Anfrage fehlgeschlagen | API-Limits prüfen |

---

## Performance

- **Durchschnittliche Laufzeit:** 5-15 Sekunden (abhängig von Textlänge)
- **Embedding-Calls:** 1 pro extrahierte Position
- **GPT-Calls:** 1 pro Request

**Empfehlung:** Bei langen Transkripten (>5000 Zeichen) vorher in Abschnitte teilen.

---

## Dateipfad

```
C:\Users\holge\neurealis-erp\functions\supabase\functions\transcription-parse\index.ts
```

---

*Erstellt: 2026-01-31*
