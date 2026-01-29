# T2 & T5: blog-editor & blog-orchestrate Implementation

**Stand:** 2026-01-29 09:05
**Status:** Deployed

---

## Zusammenfassung

Beide Edge Functions wurden erfolgreich deployed und sind aktiv:

| Function | Version | Status | Zweck |
|----------|---------|--------|-------|
| `blog-editor` | v1 | ACTIVE | Redaktionschef-Agent - erstellt Briefings |
| `blog-orchestrate` | v1 | ACTIVE | Koordinator - orchestriert Pipeline |

---

## blog-editor (T2)

### Funktion
Der Redaktionschef-Agent nimmt ein Keyword-Objekt und erstellt ein strukturiertes Briefing.

### Input
```json
{
  "keyword": {
    "id": "uuid",
    "keyword": "wohnungssanierung dortmund",
    "cluster": "pillar-3-regional",
    "search_volume": 1000,
    "priority": 98
  }
}
```

### Output
```json
{
  "success": true,
  "briefing": {
    "keyword": "wohnungssanierung dortmund",
    "cluster": "pillar-3-regional",
    "title_suggestion": "Wohnungssanierung Dortmund: Kosten, Ablauf & Tipps 2026",
    "meta_description": "Professionelle Wohnungssanierung in Dortmund...",
    "outline": ["H2: Kostenübersicht", "H2: Ablauf", ...],
    "internal_links": ["badsanierung-dortmund", "kernsanierung-kosten"],
    "cta": "sanierungskompass",
    "local_mention": "Dortmund",
    "required_facts": ["Sanierungskosten pro m² in Dortmund", ...]
  },
  "tokens_used": 1234
}
```

### System-Prompt Inhalte
Der System-Prompt enthält:
- Markenidentität (Claim, Tonalität, Verbote)
- USPs mit konkreten Formulierungen
- Zielgruppen-Segmentierung (B2B, B2C)
- Themen-Cluster (4 Pillars)
- Leistungsspektrum (Gewerke)
- Pflicht-Elemente pro Artikel

### Technische Details
- **Model:** gpt-5.2
- **max_completion_tokens:** 2000
- **temperature:** 0.7
- Holt existierende blog_posts für Verlinkungsvorschläge
- Parst JSON-Response (mit Markdown-Cleanup)

---

## blog-orchestrate (T5)

### Funktion
Der Koordinator orchestriert den gesamten Pipeline-Durchlauf.

### Ablauf
1. Nächstes Keyword via `get_next_blog_keyword()` RPC holen
2. Pipeline-Run in `blog_pipeline_runs` erstellen
3. `blog-editor` aufrufen und Output speichern
4. `blog-research` aufrufen und Output speichern
5. `blog-writer` aufrufen und Output speichern
6. Confidence-Score berechnen
7. Blog-Post erstellen mit entsprechendem Status
8. Keyword-Status auf 'published' setzen
9. Pipeline-Run abschließen

### Input
Kein Input erforderlich - holt automatisch nächstes Keyword.

### Output (Erfolg)
```json
{
  "success": true,
  "post_id": "uuid",
  "keyword": "wohnungssanierung dortmund",
  "title": "Wohnungssanierung Dortmund: Kosten, Ablauf & Tipps 2026",
  "slug": "wohnungssanierung-dortmund-2026",
  "confidence_score": 0.85,
  "status": "published",
  "review_status": "approved",
  "word_count": 1650,
  "duration_ms": 45000,
  "pipeline_run_id": "uuid"
}
```

### Confidence-Score Berechnung
| Kriterium | Punkte |
|-----------|--------|
| word_count >= 1500 | +0.2 |
| word_count >= 1000 | +0.1 |
| internal_links >= 2 | +0.2 |
| internal_links >= 1 | +0.1 |
| external_sources >= 2 | +0.2 |
| external_sources >= 1 | +0.1 |
| local_mention vorhanden | +0.1 |
| USP integriert | +0.1 |
| Keine verbotenen Phrasen | +0.2 |

**Schwellenwert:** >= 0.8 = auto-publish, sonst draft

### Fehlerbehandlung
- Bei Fehler: Pipeline-Run wird als 'failed' markiert
- Error-Message wird in `blog_pipeline_runs.error_message` gespeichert
- Keyword-Status bleibt 'in_progress' (kann manuell zurückgesetzt werden)
- Research-Fehler werden toleriert (Pipeline läuft mit leeren Fakten weiter)

---

## Abhängigkeiten

### Benötigte Edge Functions
- `blog-research` (T3) - muss deployed sein
- `blog-writer` (T4) - muss deployed sein

### Datenbank-Tabellen
- `blog_keywords` - Keywords mit Status und Priorität
- `blog_posts` - Erstellte Artikel
- `blog_pipeline_runs` - Pipeline-Logs

### RPC Functions
- `get_next_blog_keyword()` - Holt nächstes Keyword

### Secrets
- `OPENAI_API_KEY` - Für GPT-5.2 Aufrufe

---

## Aufruf-Beispiele

### blog-editor testen
```bash
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-editor \
  -H "Content-Type: application/json" \
  -d '{"keyword": {"id": "test", "keyword": "badsanierung dortmund", "cluster": "pillar-3-regional", "priority": 95}}'
```

### blog-orchestrate ausführen
```bash
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-orchestrate \
  -H "Content-Type: application/json"
```

---

## Nächste Schritte

1. [x] blog-editor deployed
2. [x] blog-orchestrate deployed
3. [ ] blog-research deployen (T3)
4. [ ] blog-writer deployen (T4)
5. [ ] End-to-End Test durchführen
6. [ ] Cron-Job einrichten (täglich 08:00 UTC)

---

*Erstellt: 2026-01-29*
