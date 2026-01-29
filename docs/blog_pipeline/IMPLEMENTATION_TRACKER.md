# Blog-Pipeline Implementation Tracker

**Stand:** 2026-01-29 08:30
**Ziel:** Vollständige Blog-Pipeline bis AHREFS-Import implementieren

---

## Konfiguration

- **OpenAI Key:** ✓ In Supabase Secrets (OPENAI_API_KEY)
- **Review-Modus:** Confidence-basiert (>0.8 = auto-publish, sonst draft)
- **Test-Keywords:** Erstellen (keine AHREFS CSV vorhanden)

---

## Task-Übersicht

| ID | Task | Status | Subagent | Output-Datei |
|----|------|--------|----------|--------------|
| T1 | DB-Migrationen | ✅ done | main | - |
| T2 | blog-editor Function | ✅ done | subagent-1 | implementation/T2_T5_editor_orchestrate.md |
| T3 | blog-research Function | ✅ done | subagent-2 | implementation/T3_blog_research.md |
| T4 | blog-writer Function | ✅ done | subagent-3 | implementation/T4_blog_writer.md |
| T5 | blog-orchestrate Function | ✅ done | subagent-1 | implementation/T2_T5_editor_orchestrate.md |
| T6 | blog-crosslink Function | ✅ done | subagent-4 | implementation/T6_blog_crosslink.md |
| T7 | Test-Keywords erstellen | ✅ done | main | - (23 Keywords eingefügt) |
| T8 | Cron-Jobs einrichten | ✅ done | main | - (blog-orchestrate-daily, blog-crosslink-weekly) |
| T9 | End-to-End Test | pending | - | implementation/T9_e2e_test.md |

---

## Abhängigkeiten

```
T1 (DB) ──┬──> T2 (editor)
          ├──> T3 (research)
          ├──> T4 (writer)
          └──> T7 (keywords)

T2, T3, T4 ──> T5 (orchestrate)

T5 ──> T6 (crosslink)
    ──> T8 (cron)
    ──> T9 (test)
```

---

## Gemeinsame Ressourcen

### Supabase Projekt
- **ID:** mfpuijttdgkllnvhvjlu
- **URL:** https://mfpuijttdgkllnvhvjlu.supabase.co

### Wissens-Dateien (für System-Prompts)
- `wissen/marketing_strategie.md` - Content-Cluster, Positionierung
- `wissen/business_strategie.md` - Zielgruppen, Leistungen
- `wissen/vertrieb_prozesse.md` - USPs, Kennzahlen
- `wissen/wettbewerber_analyse.md` - Differenzierung

### Brand Voice Guidelines
- Sachlich-kompetent, keine reißerischen Claims
- Praktisch-orientiert mit konkreten Zahlen
- Digital-forward, Innovation betonen
- VERBOTEN: "Wir sind die Besten", "Günstig", unbelegte Superlative

### Pflicht-Elemente pro Artikel
- Lokaler Bezug (NRW/Ruhrgebiet)
- Mindestens 2 konkrete Zahlen
- 1x USP natürlich einweben
- CTA: Sanierungskompass oder Erstberatung
- Mindestens 2 interne Links

### USPs (für Content)
| USP | Formulierung |
|-----|-------------|
| 98% Termintreue | "Mit durchschnittlich ±2 Tagen Abweichung..." |
| 95% Fixpreis-Quote | "Bei 95% der Projekte bleibt der vereinbarte Preis..." |
| Kundenportal | "Per Live-Dashboard den Baufortschritt verfolgen..." |
| 3D-Visualisierung | "Noch vor dem ersten Handgriff sehen..." |
| Dreiklang-Prinzip | "Bausubstanz, Budget und Mietmarkt ganzheitlich..." |

---

## Themen-Cluster

| Cluster-ID | Name | Keywords-Fokus |
|------------|------|----------------|
| pillar-1-sanierung | Wohnungssanierung Komplett | Kosten, Dauer, Prozess |
| pillar-2-vermieter | Vermieter-Ratgeber | ROI, Leerstand, Mieterhöhung |
| pillar-3-regional | Regionale Landing Pages | [Stadt] + Leistung |
| pillar-4-kompass | Sanierungskompass | Beratung, Entscheidungshilfe |

---

## Confidence-Score Logik

Artikel erhält confidence_score 0.0-1.0 basierend auf:
- word_count >= 1500: +0.2
- internal_links >= 2: +0.2
- external_sources >= 2: +0.2
- local_mention vorhanden: +0.1
- usp_integrated: +0.1
- no_forbidden_phrases: +0.2

**Schwellenwert:** >= 0.8 → auto-publish, sonst draft

---

## Fortschritts-Log

### 2026-01-29 08:30
- Tracker erstellt
- Subagenten werden gestartet

### 2026-01-29 09:00
- **T3 blog-research:** Deployed (Function ID: 6045c493-0695-4697-a0cf-269c888a00dd)
  - OpenAI Responses API mit web_search_preview
  - Recherchiert Fakten, Trends, Regionaldaten, Wettbewerber
  - Confidence-basierte Quellengewichtung
  - Fallback-Logik bei API-Fehlern

### 2026-01-29 09:15
- **T4 blog-writer:** Deployed (Function ID: 3b972ceb-43bb-4c94-9fd0-be37aea41e27)
  - GPT-5.2 mit umfangreichem Brand Voice System-Prompt
  - 19 verbotene Formulierungen implementiert
  - 5 USP-Formulierungen für natürliche Integration
  - Confidence-Score Berechnung (6 Kriterien, max 1.0)
  - Quality-Checks: local_mention, numbers, usp, cta, forbidden_phrases
  - Automatische Slug-Generierung (Umlaute → ASCII)
  - JSON-Parsing mit Fallback für Raw-HTML

### 2026-01-29 09:05
- **T2 blog-editor:** Deployed (Function ID: f1de9b66-6c31-4bb1-9d1b-04858a08e524)
  - Redaktionschef-Agent mit umfangreichem System-Prompt
  - Inhalte aus wissen/marketing_strategie.md und wissen/vertrieb_prozesse.md
  - Holt existierende blog_posts für Verlinkungsvorschläge
  - GPT-5.2 mit max_completion_tokens: 2000
  - Output: strukturiertes Briefing-JSON

- **T5 blog-orchestrate:** Deployed (Function ID: 42705910-65a5-4889-abae-8dd7c1a39ca8)
  - Koordinator für gesamten Pipeline-Durchlauf
  - Ruft get_next_blog_keyword() RPC auf
  - Erstellt pipeline_run, ruft editor→research→writer
  - Confidence-Score Berechnung (6 Kriterien)
  - Auto-publish bei score >= 0.8, sonst draft
  - Fehlerbehandlung mit pipeline_run status tracking

