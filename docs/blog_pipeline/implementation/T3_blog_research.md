# T3: blog-research Edge Function

**Status:** Deployed
**Datum:** 2026-01-29
**Function ID:** 6045c493-0695-4697-a0cf-269c888a00dd

---

## Übersicht

Die `blog-research` Edge Function ist der Recherche-Agent der Blog-Pipeline. Sie nutzt die OpenAI Responses API mit `web_search_preview` Tool, um aktuelle Fakten, Preise und Marktdaten für Blogartikel zu recherchieren.

---

## Endpoint

```
POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-research
```

**Auth:** Requires JWT (verify_jwt: true)

---

## Input-Format

```json
{
  "keyword": "badsanierung kosten pro qm",
  "cluster": "pillar-1-sanierung",
  "title_suggestion": "Bad sanieren: Kosten pro m² in 2026",
  "outline": ["H2: Kosten-Überblick", "H2: Faktoren"],
  "required_facts": [
    "Aktuelle Fliesenpreise 2026",
    "Handwerker-Stundenlöhne NRW",
    "Typische Bad-Größen in Mietwohnungen"
  ],
  "local_mention": "Ruhrgebiet"
}
```

### Pflichtfelder
- `keyword` (string): Das Ziel-Keyword für die Recherche
- `required_facts` (string[]): Array von Fakten die recherchiert werden sollen

### Optionale Felder
- `cluster` (string): Themen-Cluster ID
- `title_suggestion` (string): Vorgeschlagener Titel
- `outline` (string[]): Gliederung
- `local_mention` (string): Regionale Fokussierung (Default: "Ruhrgebiet/NRW")

---

## Output-Format

```json
{
  "facts": [
    {
      "claim": "Fliesenpreise 2026: 25-80€/m²",
      "source": "baustoffwissen.de",
      "confidence": 0.9
    },
    {
      "claim": "Handwerker-Stundenlohn NRW: 45-65€",
      "source": "handwerkskammer.de",
      "confidence": 0.85
    }
  ],
  "trends": [
    "Walk-in-Duschen stark nachgefragt",
    "Bodengleiche Duschen +15% Nachfrage",
    "Nachhaltiges Sanieren gewinnt an Bedeutung"
  ],
  "local_data": {
    "region": "Ruhrgebiet",
    "specifics": "Altbauquote 68%, durchschnittliche Bad-Größe 4,2 m²"
  },
  "competitor_angles": [
    "Bossmann wirbt mit Festpreis ab 4.999€",
    "Meiste Anbieter nennen keine konkreten Preise"
  ],
  "sources_used": [
    "baustoffwissen.de",
    "handwerkskammer.de",
    "bossmann.de"
  ]
}
```

### Confidence-Score Bedeutung
- **0.9+:** Offizielle Quellen (Statistisches Bundesamt, Handwerkskammern, Gesetze)
- **0.7-0.8:** Branchenportale (baustoffwissen.de, haustechnikdialog.de)
- **0.5-0.7:** Allgemeine Quellen (Blogs, Foren, News-Artikel)

---

## Technische Details

### OpenAI Responses API
- **Endpoint:** `https://api.openai.com/v1/responses`
- **Model:** `gpt-5.2`
- **Tool:** `web_search_preview`
- **Max Tokens:** 4000 (max_completion_tokens)

### Recherche-Fokus
1. **Aktuelle Preise/Zahlen** für das Jahr (automatisch ermittelt)
2. **Regionale Daten** für NRW/Ruhrgebiet
3. **Wettbewerber-Analyse** (Bossmann, lokale Anbieter)
4. **Gesetzliche Änderungen** (GEG, Förderungen)
5. **Markttrends** im Sanierungsbereich

### Fallback-Logik
Falls die API kein valides JSON liefert:
- Extraktion von Preisangaben aus dem Text
- Standard-Trends werden eingefügt
- Regionaldaten mit generischen Werten

---

## Beispiel-Aufruf

```bash
curl -X POST 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-research' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "keyword": "kernsanierung kosten",
    "required_facts": [
      "Durchschnittliche Kosten Kernsanierung pro m²",
      "Dauer einer Kernsanierung",
      "Förderungen 2026 für energetische Sanierung"
    ],
    "local_mention": "Dortmund"
  }'
```

---

## Integration in Pipeline

### Vorheriger Schritt
`blog-editor` liefert:
- keyword, cluster, required_facts, internal_links, outline

### Nächster Schritt
`blog-writer` erhält:
- Editor-Output + Research-Output
- Nutzt Fakten für Content-Erstellung
- Verlinkt Quellen als externe Links

---

## Error Handling

| HTTP Code | Bedeutung |
|-----------|-----------|
| 200 | Erfolg, JSON mit Recherche-Ergebnis |
| 400 | Ungültiger Input (keyword/required_facts fehlt) |
| 500 | API-Fehler oder interner Fehler |

### Error Response Format
```json
{
  "error": "Fehlerbeschreibung"
}
```

---

## Logs

Logs werden in Supabase Edge Function Logs geschrieben:
- `[blog-research] Starte Recherche für Keyword: ...`
- `[blog-research] Fakten zu recherchieren: X`
- `[blog-research] API Response Status: ...`
- `[blog-research] Gefundene Quellen: X`
- `[blog-research] Recherche abgeschlossen: X Fakten`

---

*Implementiert: 2026-01-29*
