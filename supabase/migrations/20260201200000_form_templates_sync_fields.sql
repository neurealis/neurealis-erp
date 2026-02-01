-- ============================================================================
-- Migration: form_templates_sync_fields
-- Beschreibung: Sync-Felder zu form_templates hinzufügen (bidirektionaler Sync)
-- Datum: 2026-02-01
-- Referenz: Bidirektionaler Template-Sync zwischen neurealis ERP und LifeOps
-- ============================================================================

-- =============================================================================
-- 1. EXTENSION: pg_net (für HTTP-Requests im Trigger)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 2. SYNC-FELDER HINZUFÜGEN
-- =============================================================================

-- sync_id: Gemeinsame UUID für Deduplizierung über beide Systeme
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS sync_id UUID;

-- synced_at: Letzter Sync-Zeitpunkt
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- sync_source: Quelle des letzten Updates
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('lifeops', 'neurealis'));

-- sync_status: Status des Syncs
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'synced', 'pending', 'conflict'));

-- =============================================================================
-- 3. INDIZES FÜR SYNC
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_form_templates_sync_id
ON form_templates (sync_id)
WHERE sync_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_templates_sync_status
ON form_templates (sync_status);

CREATE INDEX IF NOT EXISTS idx_form_templates_synced_at
ON form_templates (synced_at DESC);

-- =============================================================================
-- 4. SYNC-FUNKTIONEN
-- =============================================================================

-- Funktion: Templates für Sync abrufen (pending oder lokal geändert)
CREATE OR REPLACE FUNCTION get_templates_for_sync()
RETURNS TABLE (
  id UUID,
  sync_id UUID,
  name TEXT,
  category TEXT,
  pdf_hash TEXT,
  visual_hash TEXT,
  fields_schema JSONB,
  page_count INTEGER,
  source_project TEXT,
  confidence_score FLOAT,
  usage_count INTEGER,
  updated_at TIMESTAMPTZ,
  sync_source TEXT,
  sync_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.id,
    ft.sync_id,
    ft.name,
    ft.category,
    ft.pdf_hash,
    ft.visual_hash,
    ft.fields_schema,
    ft.page_count,
    ft.source_project,
    ft.confidence_score,
    ft.usage_count,
    ft.updated_at,
    ft.sync_source,
    ft.sync_status
  FROM form_templates ft
  WHERE ft.sync_status IN ('local', 'pending')
     OR (ft.sync_source = 'neurealis' AND ft.synced_at IS NULL);
END;
$$;

-- Funktion: Template nach Sync aktualisieren
CREATE OR REPLACE FUNCTION mark_template_synced(
  p_template_id UUID,
  p_sync_id UUID,
  p_sync_source TEXT DEFAULT 'neurealis'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE form_templates
  SET
    sync_id = p_sync_id,
    synced_at = NOW(),
    sync_source = p_sync_source,
    sync_status = 'synced'
  WHERE id = p_template_id;

  RETURN FOUND;
END;
$$;

-- Funktion: Eingehendes Template vom Partner-System verarbeiten
CREATE OR REPLACE FUNCTION upsert_synced_template(
  p_sync_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_pdf_hash TEXT,
  p_visual_hash TEXT,
  p_fields_schema JSONB,
  p_page_count INTEGER,
  p_source_project TEXT,
  p_confidence_score FLOAT,
  p_usage_count INTEGER,
  p_remote_updated_at TIMESTAMPTZ,
  p_sync_source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_updated_at TIMESTAMPTZ;
  v_result_id UUID;
BEGIN
  -- Prüfen ob Template mit dieser sync_id bereits existiert
  SELECT id, updated_at INTO v_existing_id, v_existing_updated_at
  FROM form_templates
  WHERE sync_id = p_sync_id;

  IF v_existing_id IS NOT NULL THEN
    -- Konfliktauflösung: Neuestes gewinnt
    IF p_remote_updated_at > v_existing_updated_at THEN
      -- Remote ist neuer -> Update
      UPDATE form_templates SET
        name = p_name,
        category = p_category,
        pdf_hash = p_pdf_hash,
        visual_hash = p_visual_hash,
        fields_schema = p_fields_schema,
        page_count = p_page_count,
        source_project = p_source_project,
        confidence_score = p_confidence_score,
        usage_count = GREATEST(usage_count, p_usage_count),  -- Behalte höheren Count
        synced_at = NOW(),
        sync_source = p_sync_source,
        sync_status = 'synced'
      WHERE id = v_existing_id;

      v_result_id := v_existing_id;
    ELSE
      -- Lokal ist neuer oder gleich -> Nur Sync-Status aktualisieren
      UPDATE form_templates SET
        synced_at = NOW(),
        sync_status = 'synced'
      WHERE id = v_existing_id;

      v_result_id := v_existing_id;
    END IF;
  ELSE
    -- Neues Template einfügen
    INSERT INTO form_templates (
      sync_id,
      name,
      category,
      pdf_hash,
      visual_hash,
      fields_schema,
      page_count,
      source_project,
      confidence_score,
      usage_count,
      synced_at,
      sync_source,
      sync_status
    ) VALUES (
      p_sync_id,
      p_name,
      p_category,
      p_pdf_hash,
      p_visual_hash,
      p_fields_schema,
      p_page_count,
      p_source_project,
      p_confidence_score,
      p_usage_count,
      NOW(),
      p_sync_source,
      'synced'
    )
    RETURNING id INTO v_result_id;
  END IF;

  RETURN v_result_id;
END;
$$;

-- Funktion: Template by Sync-ID finden
CREATE OR REPLACE FUNCTION find_template_by_sync_id(
  search_sync_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  fields_schema JSONB,
  page_count INTEGER,
  updated_at TIMESTAMPTZ,
  sync_source TEXT
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
    ft.page_count,
    ft.updated_at,
    ft.sync_source
  FROM form_templates ft
  WHERE ft.sync_id = search_sync_id
  LIMIT 1;
END;
$$;

-- =============================================================================
-- 5. TRIGGER FÜR AUTO-SYNC
-- =============================================================================

-- Trigger-Funktion: Bei INSERT/UPDATE Sync-Status aktualisieren
CREATE OR REPLACE FUNCTION trigger_form_template_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur triggern wenn:
  -- 1. Neues Template (INSERT) mit source_project = 'neurealis' oder NULL
  -- 2. Update eines lokalen Templates (nicht gerade vom Sync empfangen)
  IF (TG_OP = 'INSERT' AND (NEW.source_project = 'neurealis' OR NEW.source_project IS NULL))
     OR (TG_OP = 'UPDATE' AND NEW.sync_status != 'synced' AND OLD.updated_at != NEW.updated_at) THEN

    -- Sync-ID generieren falls nicht vorhanden
    IF NEW.sync_id IS NULL THEN
      NEW.sync_id := gen_random_uuid();
    END IF;

    -- Status auf pending setzen
    NEW.sync_status := 'pending';
    NEW.sync_source := 'neurealis';

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen
DROP TRIGGER IF EXISTS trg_form_template_sync ON form_templates;
CREATE TRIGGER trg_form_template_sync
  BEFORE INSERT OR UPDATE ON form_templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_form_template_sync();

-- =============================================================================
-- 6. KOMMENTARE
-- =============================================================================

COMMENT ON COLUMN form_templates.sync_id IS 'Gemeinsame UUID für Deduplizierung über beide Systeme hinweg';
COMMENT ON COLUMN form_templates.synced_at IS 'Zeitstempel des letzten erfolgreichen Syncs';
COMMENT ON COLUMN form_templates.sync_source IS 'Quelle des letzten Updates: lifeops oder neurealis';
COMMENT ON COLUMN form_templates.sync_status IS 'Sync-Status: local (neu/unsynced), synced (aktuell), pending (wartet), conflict (manuell lösen)';

COMMENT ON FUNCTION upsert_synced_template IS 'Verarbeitet eingehende Templates vom Partner-System mit Konfliktauflösung (neuestes gewinnt)';
COMMENT ON FUNCTION get_templates_for_sync IS 'Gibt alle Templates zurück, die synchronisiert werden müssen';
COMMENT ON FUNCTION mark_template_synced IS 'Markiert ein Template als erfolgreich synchronisiert';
COMMENT ON FUNCTION find_template_by_sync_id IS 'Findet ein Template anhand der Sync-ID';

-- =============================================================================
-- 7. GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_templates_for_sync TO service_role;
GRANT EXECUTE ON FUNCTION mark_template_synced TO service_role;
GRANT EXECUTE ON FUNCTION upsert_synced_template TO service_role;
GRANT EXECUTE ON FUNCTION find_template_by_sync_id TO authenticated, service_role;

-- =============================================================================
-- FERTIG
-- =============================================================================

-- Zusammenfassung:
-- ✅ Sync-Felder hinzugefügt (sync_id, synced_at, sync_source, sync_status)
-- ✅ pg_net Extension
-- ✅ Sync-Indizes
-- ✅ Sync-Funktionen (get_templates_for_sync, mark_template_synced, upsert_synced_template)
-- ✅ find_template_by_sync_id Funktion
-- ✅ Auto-Sync Trigger
