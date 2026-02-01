-- Migration: form_templates
-- Erstellt: 2026-02-01
-- Beschreibung: Schema für KI-gestützte PDF-Formular-Ausfüllung (Template-Master)
-- Referenz: C:\Users\holge\docs\konzept_pdf_formulare.md (Abschnitt 3.1)

-- =============================================================================
-- 1. EXTENSION: pgvector (falls noch nicht aktiv)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. TABELLE: form_templates
-- =============================================================================
-- Zentrale Template-Verwaltung für beide Projekte (neurealis ERP + LifeOps)
-- neurealis ERP ist der Template-Master

CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifikation
  name TEXT NOT NULL,                          -- z.B. "Finanzamt Umsatzsteuer-Voranmeldung"
  category TEXT,                               -- finanzamt, versicherung, bauamt, leasing, intern, sonstige

  -- PDF-Fingerprinting für Wiedererkennung
  pdf_hash TEXT,                               -- SHA-256 des PDF (exakte Matches)
  visual_hash TEXT,                            -- pHash für visuelle Ähnlichkeit
  embedding VECTOR(1536),                      -- OpenAI Embedding für Fuzzy-Match

  -- Erkannte Struktur
  fields_schema JSONB NOT NULL,                -- Array der Felder (siehe Konzept 3.2)
  page_count INTEGER,

  -- Metadaten
  source_project TEXT,                         -- 'lifeops' | 'neurealis' | NULL (shared)
  confidence_score FLOAT,                      -- Wie sicher war die Erkennung? (0.0 - 1.0)
  usage_count INTEGER DEFAULT 0,               -- Wie oft wurde das Template verwendet?

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- 3. INDIZES
-- =============================================================================

-- Index für Embedding-Suche (pgvector mit IVFFlat)
-- Hinweis: IVFFlat benötigt mindestens 1 Datensatz vor der Erstellung
-- Bei leerer Tabelle: Index wird beim ersten INSERT automatisch genutzt
CREATE INDEX IF NOT EXISTS idx_form_templates_embedding
ON form_templates USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index für Hash-Lookups (exakte Matches)
CREATE INDEX IF NOT EXISTS idx_form_templates_pdf_hash
ON form_templates (pdf_hash)
WHERE pdf_hash IS NOT NULL;

-- Index für visuelle Hash-Suche
CREATE INDEX IF NOT EXISTS idx_form_templates_visual_hash
ON form_templates (visual_hash)
WHERE visual_hash IS NOT NULL;

-- Index für Kategorie-Filter
CREATE INDEX IF NOT EXISTS idx_form_templates_category
ON form_templates (category)
WHERE category IS NOT NULL;

-- Index für source_project Filter
CREATE INDEX IF NOT EXISTS idx_form_templates_source_project
ON form_templates (source_project);

-- =============================================================================
-- 4. TRIGGER: updated_at automatisch aktualisieren
-- =============================================================================

-- Trigger-Funktion (wiederverwendbar)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für form_templates
DROP TRIGGER IF EXISTS trg_form_templates_updated_at ON form_templates;
CREATE TRIGGER trg_form_templates_updated_at
  BEFORE UPDATE ON form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. RLS POLICIES
-- =============================================================================

-- RLS aktivieren
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Beide Projekte können ALLE Templates lesen
-- (Authentifizierte User + Service Role)
CREATE POLICY "Authenticated users can read all templates"
ON form_templates
FOR SELECT
TO authenticated
USING (true);

-- Policy: Service Role kann alles (für Cross-Project API Calls)
CREATE POLICY "Service role has full access"
ON form_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authentifizierte User können Templates erstellen
CREATE POLICY "Authenticated users can insert templates"
ON form_templates
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authentifizierte User können ihre eigenen Templates aktualisieren
-- ODER Templates ohne created_by (System-Templates)
CREATE POLICY "Authenticated users can update templates"
ON form_templates
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL)
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- Policy: Nur eigene Templates löschen (oder System-Templates mit Service Role)
CREATE POLICY "Users can delete own templates"
ON form_templates
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- =============================================================================
-- 6. HILFSFUNKTIONEN
-- =============================================================================

-- Funktion: Ähnlichste Templates finden (via Embedding)
CREATE OR REPLACE FUNCTION search_similar_templates(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.92,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  fields_schema JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.id,
    ft.name,
    ft.category,
    ft.fields_schema,
    (1 - (ft.embedding <=> query_embedding))::FLOAT AS similarity
  FROM form_templates ft
  WHERE ft.embedding IS NOT NULL
    AND (1 - (ft.embedding <=> query_embedding)) > match_threshold
  ORDER BY ft.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funktion: Template by Hash finden (exakt)
CREATE OR REPLACE FUNCTION find_template_by_hash(
  search_pdf_hash TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  fields_schema JSONB,
  page_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.id,
    ft.name,
    ft.category,
    ft.fields_schema,
    ft.page_count
  FROM form_templates ft
  WHERE ft.pdf_hash = search_pdf_hash
  LIMIT 1;
END;
$$;

-- Funktion: Usage Count erhöhen
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE form_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$;

-- =============================================================================
-- 7. KOMMENTARE (Dokumentation)
-- =============================================================================

COMMENT ON TABLE form_templates IS 'Zentrale Template-Verwaltung für PDF-Formular-Ausfüllung. neurealis ERP ist Template-Master, LifeOps liest via API.';

COMMENT ON COLUMN form_templates.pdf_hash IS 'SHA-256 Hash des Original-PDFs für exakte Wiedererkennung';
COMMENT ON COLUMN form_templates.visual_hash IS 'Perceptual Hash (pHash) für visuelle Ähnlichkeit trotz unterschiedlicher Metadaten';
COMMENT ON COLUMN form_templates.embedding IS 'OpenAI text-embedding-3-small (1536 dim) für semantische Suche';
COMMENT ON COLUMN form_templates.fields_schema IS 'JSON-Array der erkannten Formularfelder mit Position, Typ, Validierung';
COMMENT ON COLUMN form_templates.source_project IS 'Welches Projekt hat das Template erstellt? NULL = shared';
COMMENT ON COLUMN form_templates.confidence_score IS 'Konfidenz der KI-Erkennung (0.0 - 1.0)';

COMMENT ON FUNCTION search_similar_templates IS 'Findet ähnliche Templates via pgvector Embedding-Suche';
COMMENT ON FUNCTION find_template_by_hash IS 'Exakte Template-Suche via SHA-256 Hash';
COMMENT ON FUNCTION increment_template_usage IS 'Erhöht den Usage-Counter eines Templates (für Priorisierung)';
