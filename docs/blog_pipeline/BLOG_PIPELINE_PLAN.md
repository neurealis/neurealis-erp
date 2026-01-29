# Blog-Pipeline Plan - neurealis Komplettsanierung

**Stand:** 2026-01-29
**Status:** In Planung - wartet auf Genehmigung

---

## Executive Summary

Automatisierte Content-Pipeline für SEO-optimierte Blogartikel, die neurealis als **digitalen Innovationsführer im Sanierungsmarkt** positionieren.

**Ziel:** 2-3 hochwertige Artikel pro Woche, die organischen Traffic generieren und Leads für Sanierungskompass/Komplettsanierung konvertieren.

---

## 1. Architektur: 3-Agenten-System

```
┌─────────────────────────────────────────────────────────────┐
│                    blog-orchestrate                          │
│            (Cron: täglich 08:00 UTC)                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │    blog-editor        │
        │  (Redaktionschef)     │
        │                       │
        │ - Keyword auswählen   │
        │ - Briefing erstellen  │
        │ - Cluster zuordnen    │
        └───────────┬───────────┘
                    │ JSON: { keyword, cluster, briefing, interne_links }
        ┌───────────▼───────────┐
        │   blog-research       │
        │ (Recherche-Agent)     │
        │                       │
        │ - Web-Recherche       │
        │ - Aktuelle Zahlen     │
        │ - Wettbewerber-Check  │
        └───────────┬───────────┘
                    │ JSON: { facts, sources, trends, local_data }
        ┌───────────▼───────────┐
        │    blog-writer        │
        │  (Schreib-Agent)      │
        │                       │
        │ - Artikel schreiben   │
        │ - SEO-Optimierung     │
        │ - Interne Verlinkung  │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │   blog-crosslink      │
        │ (Wöchentlicher Job)   │
        │                       │
        │ - Ähnliche Artikel    │
        │ - Lücken füllen       │
        └───────────────────────┘
```

---

## 2. Themen-Cluster (SEO-Struktur)

### Pillar 1: "Wohnungssanierung Komplett" (Hauptseite)
**Ziel:** Rankings für High-Volume Keywords

| Supporting Content | Keyword-Beispiele | Suchvolumen* |
|-------------------|-------------------|--------------|
| Sanierungskosten pro m² | "wohnung sanieren kosten", "kernsanierung kosten" | 1.000-3.000 |
| Bad-Sanierung komplett | "bad sanieren kosten", "badsanierung dauer" | 500-1.500 |
| Elektrik modernisieren | "elektrik erneuern altbau kosten" | 200-500 |
| Boden-Ratgeber | "vinyl vs parkett mietwohnung" | 300-800 |

### Pillar 2: "Vermieter-Ratgeber" (B2B/Anleger)
**Ziel:** Qualifizierte Leads von privaten Vermietern

| Supporting Content | Keyword-Beispiele | Intent |
|-------------------|-------------------|--------|
| Leerstandskosten berechnen | "leerstand wohnung kosten monat" | Informational → Conversion |
| ROI Sanierung ermitteln | "sanierung mietwohnung lohnt sich" | Decision |
| Mieterhöhung nach Sanierung | "modernisierungsumlage berechnen" | Educational |
| Energetische Pflichten | "geg sanierungspflicht vermieter 2026" | Urgent/Aktuell |

### Pillar 3: "Regionale Landing Pages" (Local SEO)
**Ziel:** Top 3 für "[Leistung] + [Stadt]" in NRW

| Stadt | Keywords | Priorität |
|-------|----------|-----------|
| **Dortmund** | wohnungssanierung dortmund, badsanierung dortmund | Hoch (HQ) |
| **Bochum** | komplettsanierung bochum, sanierungsfirma bochum | Hoch |
| **Essen** | wohnung sanieren essen, kernsanierung essen | Mittel |
| **Gelsenkirchen** | sanierung mietwohnung gelsenkirchen | Mittel |

### Pillar 4: "Sanierungskompass" (Produkt-Marketing)
**Ziel:** Leads für Sanierungskompass-Beratung (499-999€)

| Content | Keyword | CTA |
|---------|---------|-----|
| "Sanierung oder Verkauf?" | "haus sanieren oder verkaufen rechner" | Kompass bestellen |
| "Was kostet eine Erstberatung?" | "sanierungsberatung kosten" | Basic-Paket |
| "5 Zeichen dass Sanierung nötig ist" | "wann sanierung notwendig" | Check anfragen |

---

## 3. Content-Regeln (Brand Voice)

### Tonalität
- **Sachlich-kompetent** (keine reißerischen Claims)
- **Praktisch-orientiert** (konkrete Zahlen, Beispiele)
- **Digital-forward** (Innovation betonen, nicht anbiedern)

### Verbotene Formulierungen
- "Wir sind die Besten" (stattdessen: Kennzahlen zeigen)
- "Günstig" (stattdessen: "kosteneffizient", "wirtschaftlich")
- Superlative ohne Beleg

### Pflicht-Elemente pro Artikel
- [ ] **Lokaler Bezug:** Mindestens 1x NRW/Ruhrgebiet erwähnen
- [ ] **Zahlen:** Mindestens 2 konkrete Werte (Kosten, Dauer, m²)
- [ ] **USP-Integration:** 1x neurealis-Vorteil natürlich einweben
- [ ] **CTA:** Sanierungskompass oder Erstberatung am Ende
- [ ] **Interne Links:** Mindestens 2 zu anderen Artikeln

### USPs für Content (aus wissen/)
| USP | Formulierung für Artikel |
|-----|-------------------------|
| 98% Termintreue | "Mit durchschnittlich ±2 Tagen Abweichung..." |
| 95% Fixpreis-Quote | "Bei 95% der Projekte bleibt der vereinbarte Preis..." |
| Kundenportal | "Per Live-Dashboard den Baufortschritt verfolgen..." |
| 3D-Visualisierung | "Noch vor dem ersten Handgriff sehen, wie es aussieht..." |
| Dreiklang-Prinzip | "Bausubstanz, Budget und Mietmarkt ganzheitlich betrachten..." |

---

## 4. Datenbank-Schema (Erweiterungen)

### blog_posts (erweitert)
```sql
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cluster TEXT; -- pillar-id
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS target_keyword TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS word_count INTEGER;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS internal_links TEXT[]; -- Array von Slugs
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS pipeline_run_id UUID;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'draft';
-- review_status: draft → pending_review → approved → published

CREATE INDEX IF NOT EXISTS idx_blog_posts_embedding ON blog_posts USING ivfflat (embedding vector_cosine_ops);
```

### blog_keywords (NEU)
```sql
CREATE TABLE IF NOT EXISTS blog_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  search_volume INTEGER,
  keyword_difficulty INTEGER, -- 0-100
  cpc DECIMAL(10,2),
  cluster TEXT, -- pillar zuordnung
  priority INTEGER DEFAULT 50, -- 0-100
  status TEXT DEFAULT 'new', -- new, planned, in_progress, published, skipped
  assigned_post_id UUID REFERENCES blog_posts(id),
  ahrefs_data JSONB, -- Raw AHREFS export
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_keywords_status ON blog_keywords(status);
CREATE INDEX idx_blog_keywords_priority ON blog_keywords(priority DESC);
```

### blog_pipeline_runs (NEU)
```sql
CREATE TABLE IF NOT EXISTS blog_pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- running, completed, failed
  keyword_id UUID REFERENCES blog_keywords(id),
  post_id UUID REFERENCES blog_posts(id),
  editor_output JSONB,
  research_output JSONB,
  writer_output JSONB,
  error_message TEXT,
  duration_ms INTEGER
);
```

### RPC: search_similar_blog_posts
```sql
CREATE OR REPLACE FUNCTION search_similar_blog_posts(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  cluster TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.title,
    bp.slug,
    bp.cluster,
    1 - (bp.embedding <=> query_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.status = 'published'
    AND bp.embedding IS NOT NULL
    AND (exclude_id IS NULL OR bp.id != exclude_id)
  ORDER BY bp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 5. Edge Functions

### 5.1 blog-orchestrate (Orchestrator)
**Trigger:** Cron täglich 08:00 UTC

```typescript
// Pseudo-Code
async function orchestrate() {
  // 1. Nächstes Keyword mit höchster Priorität holen
  const keyword = await getNextKeyword();
  if (!keyword) return { message: 'Keine Keywords verfügbar' };

  // 2. Pipeline-Run starten
  const run = await createPipelineRun(keyword.id);

  // 3. Editor aufrufen
  const editorResult = await callEditorAgent(keyword, run.id);

  // 4. Research aufrufen
  const researchResult = await callResearchAgent(editorResult, run.id);

  // 5. Writer aufrufen
  const writerResult = await callWriterAgent(editorResult, researchResult, run.id);

  // 6. Post erstellen (draft)
  const post = await createBlogPost(writerResult, keyword, run.id);

  // 7. Run abschließen
  await completePipelineRun(run.id, post.id);

  return { success: true, post_id: post.id };
}
```

### 5.2 blog-editor (Redaktionschef)
**Input:** Keyword-Objekt aus blog_keywords
**Output:** JSON mit Briefing

```typescript
// System-Prompt enthält:
// - wissen/marketing_strategie.md (Cluster, USPs)
// - wissen/business_strategie.md (Zielgruppen, Leistungen)
// - Existierende Artikel-Titel für Verlinkung

// Output-Format:
{
  "keyword": "badsanierung kosten pro qm",
  "cluster": "pillar-1-sanierung",
  "title_suggestion": "Bad sanieren: Kosten pro m² in 2026 [mit Rechenbeispiel]",
  "meta_description": "Was kostet eine Badsanierung pro m²? Aktuelle Preise...",
  "outline": [
    "H2: Kosten-Überblick 2026",
    "H2: Faktoren die den Preis beeinflussen",
    "H2: Beispielrechnung 3,5 m² Bad",
    "H2: Spartipps ohne Qualitätsverlust",
    "H2: Fazit & nächste Schritte"
  ],
  "internal_links": ["wohnungssanierung-komplett", "vinyl-vs-parkett"],
  "cta": "sanierungskompass",
  "local_mention": "Ruhrgebiet",
  "required_facts": [
    "Aktuelle Fliesenpreise 2026",
    "Handwerker-Stundenlöhne NRW",
    "Typische Bad-Größen in Mietwohnungen"
  ]
}
```

### 5.3 blog-research (Recherche-Agent)
**Input:** Editor-Output + required_facts
**Technologie:** OpenAI Responses API mit web_search_preview

```typescript
// Führt Web-Suchen aus für:
// - Aktuelle Preise/Zahlen
// - Gesetzliche Änderungen (GEG, Förderungen)
// - Lokale Marktdaten NRW

// Output-Format:
{
  "facts": [
    { "claim": "Fliesenpreise 2026: 25-80€/m²", "source": "baustoffwissen.de" },
    { "claim": "Handwerker-Stundenlohn NRW: 45-65€", "source": "handwerkskammer.de" }
  ],
  "trends": [
    "Walk-in-Duschen stark nachgefragt",
    "Bodengleiche Duschen +15% Nachfrage"
  ],
  "local_data": {
    "region": "Ruhrgebiet",
    "specifics": "Altbauquote 68%, durchschnittliche Bad-Größe 4,2 m²"
  },
  "competitor_angles": [
    "Bossmann wirbt mit Festpreis ab 4.999€",
    "Meiste Anbieter nennen keine konkreten Preise"
  ]
}
```

### 5.4 blog-writer (Schreib-Agent)
**Input:** Editor-Briefing + Research-Output
**System-Prompt enthält:** Brand Voice Guidelines, USPs, Verbotene Formulierungen

```typescript
// Output-Format:
{
  "title": "Bad sanieren: Kosten pro m² in 2026 [mit Rechenbeispiel]",
  "slug": "bad-sanieren-kosten-pro-qm-2026",
  "meta_description": "...",
  "content_html": "<h2>Kosten-Überblick 2026</h2><p>...</p>",
  "word_count": 1850,
  "internal_links_used": ["wohnungssanierung-komplett", "vinyl-vs-parkett"],
  "external_sources": ["baustoffwissen.de", "handwerkskammer.de"],
  "featured_image_prompt": "Modern renovated bathroom, walk-in shower, grey tiles..."
}
```

### 5.5 blog-crosslink (Wöchentlich)
**Trigger:** Cron sonntags 06:00 UTC

```typescript
// 1. Alle Artikel ohne ausreichende interne Links finden
// 2. Für jeden: Ähnliche Artikel via Embedding suchen
// 3. Link-Vorschläge in Pipeline-Log speichern
// 4. Optional: Auto-Update wenn confidence > 0.8
```

---

## 6. Implementierungs-Reihenfolge

### Phase 1: Datenbank (1 Session)
1. [ ] Migrations für blog_keywords, blog_pipeline_runs
2. [ ] blog_posts erweitern (embedding, cluster, etc.)
3. [ ] RPC search_similar_blog_posts erstellen

### Phase 2: Edge Functions (2-3 Sessions)
4. [ ] blog-editor implementieren
5. [ ] blog-research implementieren (mit web_search_preview)
6. [ ] blog-writer implementieren
7. [ ] blog-orchestrate als Koordinator
8. [ ] blog-crosslink für Nachvernetzung

### Phase 3: Integration (1 Session)
9. [ ] AHREFS-CSV Import Script
10. [ ] Cron-Jobs einrichten
11. [ ] Test-Durchlauf mit 3 Artikeln

### Phase 4: Monitoring (Optional)
12. [ ] Dashboard in Marketing-Seite (UI)
13. [ ] Slack/Telegram Notifications

---

## 7. Erfolgskriterien

| Metrik | Ziel (3 Monate) |
|--------|-----------------|
| Artikel veröffentlicht | 30+ |
| Organische Impressionen | +50% |
| Top-10 Keywords | 10+ |
| Sanierungskompass-Leads via Blog | 5/Monat |
| Durchschnittliche Artikelqualität | >80% (manueller Review) |

---

## 8. Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| KI-Content erkennbar | Manueller Review vor Publish, Human Touch |
| Falsche Zahlen | Research-Agent verifiziert, Quellen angeben |
| Duplicate Content | Embedding-Check vor Erstellung |
| Google Penalty | Qualität > Quantität, keine Keyword-Stuffing |
| Brand Voice inkonsistent | Strenge Guidelines, Beispiel-Artikel als Few-Shot |

---

## 9. Nächste Schritte (nach Genehmigung)

1. **Heute:** DB-Migrationen ausführen
2. **Morgen:** blog-editor + blog-research implementieren
3. **Übermorgen:** blog-writer + blog-orchestrate
4. **Tag 4:** Test-Run mit 3 echten Artikeln
5. **Tag 5:** Cron aktivieren, Monitoring einrichten

---

*Plan erstellt: 2026-01-29*
*Basierend auf: D018-D020, L046-L048, wissen/*
