-- Migration: match_form_template_by_embedding RPC-Funktion
-- Erstellt: 2026-02-01
-- Beschreibung: RPC-Funktion für Embedding-basierte Template-Suche (aufgerufen von form-analyzer Edge Function)

-- =============================================================================
-- RPC-Funktion für Edge Function Aufrufe
-- =============================================================================

-- Diese Funktion wird von der form-analyzer Edge Function in LifeOps aufgerufen
-- um ähnliche Templates zu finden

CREATE OR REPLACE FUNCTION match_form_template_by_embedding(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.92,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  pdf_hash TEXT,
  visual_hash TEXT,
  fields_schema JSONB,
  page_count INTEGER,
  source_project TEXT,
  confidence_score FLOAT,
  usage_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.id,
    ft.name,
    ft.category,
    ft.pdf_hash,
    ft.visual_hash,
    ft.fields_schema,
    ft.page_count,
    ft.source_project,
    ft.confidence_score,
    ft.usage_count,
    ft.created_at,
    ft.updated_at,
    (1 - (ft.embedding <=> query_embedding))::FLOAT AS similarity
  FROM form_templates ft
  WHERE ft.embedding IS NOT NULL
    AND (1 - (ft.embedding <=> query_embedding)) > match_threshold
  ORDER BY ft.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Kommentar
COMMENT ON FUNCTION match_form_template_by_embedding IS
  'Findet ähnliche Templates via pgvector Embedding-Suche. Wird von form-analyzer Edge Function aufgerufen.';

-- Grant für Service Role (für Cross-Project API Calls)
GRANT EXECUTE ON FUNCTION match_form_template_by_embedding TO service_role;
GRANT EXECUTE ON FUNCTION match_form_template_by_embedding TO authenticated;
