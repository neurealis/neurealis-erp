# CPQ-Verbesserungen - Koordination

**Erstellt:** 2026-01-31 ~00:30
**Abgeschlossen:** 2026-01-31
**Status:** ✅ FERTIG (QA bestanden)
**Projekt:** neurealis-erp

---

## 📋 Anforderungen (vom User bestätigt)

| # | Anforderung | Entscheidung | Details |
|---|-------------|--------------|---------|
| 1 | LV-Priorisierung | **1A** | Ausgewähltes LV = Priority-LV (aus Kundenname erkannt, änderbar) |
| 2 | Freitextsuche | **2C** | Hybrid: pg_trgm Fuzzy → Embedding Fallback bei wenig Treffern |
| 3 | Preisanzeige | **3A** | Nur VK-Preis (listenpreis) anzeigen |
| 4 | Sortierung | **4B** | Similarity first, bei gleicher Similarity nach VK-Preis |
| 5 | Mehrfachauswahl | **5A** | "+" Button neben jedem Vorschlag |
| 6 | LV-Filter Init | **6A** | Initial auf ausgewähltes LV gesetzt |
| 7 | Lern-System | **C** | Hierarchisch: erst LV-spezifisch, dann global Fallback |

---

## 🏗️ Architektur

### Betroffene Dateien

| Datei | Änderungen |
|-------|------------|
| `functions/supabase/functions/transcription-parse/index.ts` | Priority-LV aus Request, Lern-System hierarchisch |
| `ui/src/routes/angebote/neu/+page.svelte` | UI: Preise, "+"-Button, LV-Filter Init |
| `ui/src/routes/api/position-correction/+server.ts` | Lern-System erweitern |
| **NEU:** `supabase/migrations/20260131_cpq_search_functions.sql` | pg_trgm + Hybrid-Search RPC |

### Neue RPC-Funktionen

1. `search_lv_positions_hybrid(query_text, query_embedding, lv_typ, limit)` - Hybrid-Suche
2. `search_position_corrections_hierarchical(embedding, lv_typ, threshold)` - Hierarchisches Lernen

---

## 👥 Subagenten-Aufgaben

### T1: DEV-BACKEND (Edge Function + Lern-System)
**Status:** ⏳ PENDING
**Dateien:**
- `functions/supabase/functions/transcription-parse/index.ts`
- `ui/src/routes/api/position-correction/+server.ts`

**Aufgaben:**
1. [ ] `prioritize_lv_typ` aus Request-Body `lv_typ` nehmen (nicht hartkodiert 'gws')
2. [ ] Lern-System hierarchisch machen:
   - Erst: `search_position_corrections WHERE lv_typ = aktuelles_lv`
   - Fallback: `search_position_corrections` ohne lv_typ Filter
   - Bei Fallback-Treffer: Nutze als Hinweis, suche dann im aktuellen LV
3. [ ] Sortierung: Similarity DESC, bei gleicher Similarity nach listenpreis DESC

**Ergebnis:** _(wird vom Agenten ausgefüllt)_

---

### T2: DEV-SEARCH (RPC-Funktionen für Hybrid-Suche)
**Status:** ⏳ PENDING
**Dateien:**
- `supabase/migrations/20260131_cpq_hybrid_search.sql`

**Aufgaben:**
1. [ ] `pg_trgm` Extension aktivieren (falls nicht vorhanden)
2. [ ] `search_lv_positions_hybrid()` RPC erstellen:
   - Parameter: `p_query_text`, `p_query_embedding`, `p_lv_typ`, `p_limit`
   - Schritt 1: pg_trgm Similarity auf `bezeichnung` + `beschreibung`
   - Schritt 2: Falls < 3 Treffer mit Similarity > 0.3: Embedding-Suche
   - Rückgabe: UNION mit Deduplizierung, sortiert nach Score
3. [ ] `search_position_corrections_hierarchical()` RPC erstellen:
   - Parameter: `p_embedding`, `p_lv_typ`, `p_threshold`
   - Schritt 1: Suche mit `lv_typ = p_lv_typ`
   - Schritt 2: Falls keine Treffer → Suche ohne lv_typ Filter
   - Rückgabe: Match + Flag `is_global_fallback`
4. [ ] GIN-Index auf `bezeichnung` für pg_trgm

**Ergebnis:** _(wird vom Agenten ausgefüllt)_

---

### T3: DEV-UI (Frontend-Änderungen)
**Status:** ⏳ PENDING
**Dateien:**
- `ui/src/routes/angebote/neu/+page.svelte`

**Aufgaben:**
1. [ ] Preisanzeige: `listenpreis` statt `einzelpreis` (VK statt EK)
2. [ ] Format: `{formatCurrency(pos.listenpreis)} €/Einheit`
3. [ ] "+" Button neben jedem Vorschlag (statt nur Checkbox)
4. [ ] LV-Filter initial auf `lvTyp` setzen (das ausgewählte LV)
5. [ ] Bei Freitextsuche: Hybrid-RPC aufrufen statt ILIKE
6. [ ] Sortierung in UI: Similarity DESC, bei gleich nach Preis DESC

**Ergebnis:** _(wird vom Agenten ausgefüllt)_

---

### T4: QA-AGENT (Qualitätssicherung)
**Status:** ⏳ PENDING

**Aufgaben:**
1. [ ] Code-Review aller Änderungen
2. [ ] Test-Szenarien durchspielen:
   - GWS-Projekt → Vorschläge aus GWS zuerst
   - VBW-Projekt → Vorschläge aus VBW zuerst
   - Freitextsuche "Decke streichen" → Fuzzy + Semantic
   - Lern-System: Korrektur in GWS → hilft bei neuem Vonovia-Projekt
3. [ ] Edge Cases prüfen:
   - Leere Suche
   - Keine Treffer
   - LV-Typ ohne Positionen
4. [ ] TypeScript-Fehler prüfen
5. [ ] Build testen: `cd ui && npm run build`

**Ergebnis:** _(wird vom Agenten ausgefüllt)_

---

## 📊 Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1: DEV-BACKEND | ✅ | transcription-parse v5, hierarchisches Lern-System |
| T2: DEV-SEARCH | ✅ | pg_trgm + 2 neue RPCs (hybrid, hierarchical) |
| T3: DEV-UI | ✅ | listenpreis, "+"-Button, Sortierung |
| T4: QA-AGENT | ✅ | 12 Checks OK, 4 Warnungen (nicht kritisch), 0 Fehler |

---

## 📝 Notizen

_(Hier dokumentieren die Agenten ihre Erkenntnisse)_

---

## ✅ Abschluss-Checkliste

- [x] Alle T1-T4 abgeschlossen
- [x] QA bestanden (12 Checks OK, 0 Fehler)
- [x] Build erfolgreich
- [x] Migration ausgeführt (20260131213758_cpq_hybrid_search)
- [x] Edge Function deployed (transcription-parse v5 → Supabase v9)
- [x] Netlify UI deployed (https://neurealis-erp.netlify.app)
- [ ] docs/status_quo.md aktualisiert
- [ ] docs/learnings.md aktualisiert (falls neue Erkenntnisse)

---

*Koordination durch PM-Agent*
