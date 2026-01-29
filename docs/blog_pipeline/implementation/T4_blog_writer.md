# T4: blog-writer Edge Function

**Status:** Deployed
**Deployt am:** 2026-01-29
**Function ID:** 3b972ceb-43bb-4c94-9fd0-be37aea41e27
**Version:** 1

---

## Zusammenfassung

Die `blog-writer` Edge Function ist der Schreib-Agent der Blog-Pipeline. Sie nimmt das Briefing vom Editor und die Recherche-Ergebnisse und generiert einen vollständigen SEO-optimierten Blogartikel.

---

## Endpoint

```
POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-writer
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

## Input

```json
{
  "editor_output": {
    "keyword": "badsanierung kosten pro qm",
    "cluster": "pillar-1-sanierung",
    "title_suggestion": "Bad sanieren: Kosten pro m² in 2026",
    "meta_description": "Was kostet eine Badsanierung pro m²?...",
    "outline": ["H2: Kosten-Überblick", "H2: Faktoren", "..."],
    "internal_links": ["wohnungssanierung-komplett", "vinyl-vs-parkett"],
    "cta": "sanierungskompass",
    "local_mention": "Ruhrgebiet"
  },
  "research_output": {
    "facts": [
      { "claim": "Fliesenpreise 2026: 25-80€/m²", "source": "baustoffwissen.de" }
    ],
    "trends": ["Walk-in-Duschen stark nachgefragt"],
    "local_data": {
      "region": "Ruhrgebiet",
      "specifics": "Altbauquote 68%, durchschnittliche Bad-Größe 4,2 m²"
    }
  },
  "pipeline_run_id": "uuid-optional"
}
```

---

## Output

```json
{
  "title": "Bad sanieren: Kosten pro m² in 2026 [mit Rechenbeispiel]",
  "slug": "bad-sanieren-kosten-pro-qm-2026",
  "meta_description": "Was kostet eine Badsanierung pro m²? Aktuelle Preise...",
  "content_html": "<h2>Kosten-Überblick 2026</h2><p>...</p>",
  "word_count": 1850,
  "internal_links_used": ["wohnungssanierung-komplett", "vinyl-vs-parkett"],
  "external_sources": ["baustoffwissen.de", "handwerkskammer.de"],
  "confidence_score": 0.85,
  "quality_checks": {
    "has_local_mention": true,
    "has_numbers": true,
    "has_usp": true,
    "has_cta": true,
    "no_forbidden": true,
    "forbidden_found": []
  },
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 2800,
    "total_tokens": 4000
  }
}
```

---

## Confidence-Score Berechnung

| Kriterium | Punkte | Beschreibung |
|-----------|--------|--------------|
| word_count >= 1500 | +0.2 | Mindestlänge erreicht |
| internal_links >= 2 | +0.2 | Interne Verlinkung vorhanden |
| external_sources >= 2 | +0.2 | Externe Quellen zitiert |
| local_mention vorhanden | +0.1 | NRW/Ruhrgebiet erwähnt |
| usp_integrated | +0.1 | neurealis USP eingewebt |
| no_forbidden_phrases | +0.2 | Keine verbotenen Phrasen |

**Maximum:** 1.0
**Schwellenwert für Auto-Publish:** >= 0.8

---

## Brand Voice Guidelines (integriert)

### Tonalität
- Sachlich-kompetent (keine reißerischen Claims)
- Praktisch-orientiert (konkrete Zahlen)
- Digital-forward (Innovation betonen)

### Verbotene Formulierungen
- "Wir sind die Besten"
- "günstig", "billig"
- Unbelegte Superlative
- "Marktführer", "Nr. 1"
- "garantiert", "100% Zufriedenheit"

### USP-Formulierungen (zur natürlichen Integration)
| USP | Formulierung |
|-----|-------------|
| Termintreue | "Mit durchschnittlich ±2 Tagen Abweichung..." |
| Fixpreis | "Bei 95% der Projekte bleibt der vereinbarte Preis..." |
| Kundenportal | "Per Live-Dashboard den Baufortschritt verfolgen..." |
| 3D-Visualisierung | "Noch vor dem ersten Handgriff sehen..." |
| Dreiklang | "Bausubstanz, Budget und Mietmarkt ganzheitlich..." |

---

## Pflicht-Elemente pro Artikel

- [x] Lokaler Bezug (NRW/Ruhrgebiet) - wird geprüft
- [x] 2+ konkrete Zahlen - wird geprüft
- [x] 1x USP eingewebt - wird geprüft
- [x] CTA am Ende - wird geprüft
- [x] 2+ interne Links - wird geprüft
- [x] Keine verbotenen Phrasen - wird geprüft

---

## Technische Details

- **Model:** gpt-5.2
- **max_completion_tokens:** 4000
- **temperature:** 0.7
- **JWT-Verifizierung:** Aktiviert

### Slug-Generierung
- Umlaute werden konvertiert (ä→ae, ö→oe, ü→ue, ß→ss)
- Sonderzeichen entfernt
- Max. 80 Zeichen

### HTML-Output
- Sauberes HTML (h2, h3, p, ul, li, strong, a)
- Keine div-Container oder Inline-Styles
- Interne Links als `/blog/slug`
- Externe Links mit vollständiger URL

---

## Abhängigkeiten

- Benötigt Output von `blog-editor` (T2)
- Benötigt Output von `blog-research` (T3)
- Wird aufgerufen von `blog-orchestrate` (T5)

---

## Test-Aufruf

```bash
curl -X POST \
  'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-writer' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "editor_output": {
      "keyword": "badsanierung kosten",
      "cluster": "pillar-1-sanierung",
      "title_suggestion": "Badsanierung: Was kostet es 2026?",
      "meta_description": "Aktuelle Kosten für Badsanierungen...",
      "outline": ["H2: Kostenübersicht", "H2: Faktoren", "H2: Fazit"],
      "internal_links": ["wohnungssanierung-komplett"],
      "cta": "sanierungskompass",
      "local_mention": "Dortmund"
    },
    "research_output": {
      "facts": [{"claim": "Badsanierung kostet 800-2500€/m²", "source": "test.de"}],
      "trends": ["Walk-in-Duschen"],
      "local_data": {"region": "Dortmund", "specifics": "Altbauquote 60%"}
    }
  }'
```

---

## Nächste Schritte

1. Integration in `blog-orchestrate` (T5)
2. End-to-End Test mit echtem Keyword (T9)
3. Review-Workflow für Artikel mit confidence < 0.8

---

*Erstellt: 2026-01-29*
