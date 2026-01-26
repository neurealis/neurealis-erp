-- ============================================================
-- Kontaktmanagement System v1.0
-- Master-Tabellen für zentrale Kontaktverwaltung
-- Supabase = Single Source of Truth
-- ============================================================

-- ============================================================
-- 1. ADRESSEN-TABELLE (für alle Adresstypen)
-- ============================================================
CREATE TABLE IF NOT EXISTS adressen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referenz auf Kontakt (optional, für Bauvorhaben-Adressen NULL)
  kontakt_id UUID,

  -- Adresstyp
  adresstyp TEXT NOT NULL DEFAULT 'rechnung',
  -- Werte: 'rechnung', 'lieferung', 'bauvorhaben', 'privat', 'geschaeftlich'

  -- Adressdaten
  strasse TEXT,
  hausnummer TEXT,
  adresszusatz TEXT,
  plz TEXT,
  ort TEXT,
  bundesland TEXT,
  land TEXT DEFAULT 'Deutschland',

  -- Geo-Koordinaten (für Karte/Routing)
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  -- Bei Bauvorhaben: Projekt-Referenz
  projekt_id UUID,

  -- Metadaten
  ist_hauptadresse BOOLEAN DEFAULT false,
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adressen_kontakt ON adressen(kontakt_id);
CREATE INDEX idx_adressen_typ ON adressen(adresstyp);
CREATE INDEX idx_adressen_plz ON adressen(plz);
CREATE INDEX idx_adressen_projekt ON adressen(projekt_id) WHERE projekt_id IS NOT NULL;

COMMENT ON TABLE adressen IS 'Zentrale Adresstabelle für alle Adresstypen (Kontakte, Bauvorhaben, etc.)';

-- ============================================================
-- 2. KONTAKTE-HAUPTTABELLE
-- ============================================================
CREATE TABLE IF NOT EXISTS kontakte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifikation
  kontakt_nr SERIAL UNIQUE,  -- Interne ID (K-0001)
  aktiv BOOLEAN DEFAULT true,

  -- Parent-Child Struktur (Unternehmen → Ansprechpartner)
  parent_kontakt_id UUID REFERENCES kontakte(id),

  -- Kontaktart (Mehrfachauswahl)
  kontaktarten TEXT[] NOT NULL DEFAULT '{}',
  -- Werte: 'kunde_privat', 'kunde_gewerblich', 'lead', 'mitarbeiter',
  --        'mitarbeiter_baustelle', 'bewerber', 'nachunternehmer',
  --        'nu_mitarbeiter', 'partner', 'lieferant', 'ansprechpartner',
  --        'eigentuemer', 'hausverwaltung', 'behoerde'

  -- Stammdaten Person
  anrede TEXT,  -- 'Herr', 'Frau', 'Firma', 'Familie', 'EG'
  titel TEXT,
  vorname TEXT,
  nachname TEXT,

  -- Stammdaten Firma
  firma_kurz TEXT,
  firma_lang TEXT,
  position TEXT,
  abteilung TEXT,

  -- Kommunikation
  email TEXT,
  email_rechnung TEXT,
  email_privat TEXT,
  telefon_mobil TEXT,
  telefon_festnetz TEXT,
  telefon_privat TEXT,
  fax TEXT,
  website TEXT,

  -- Rechnungsadresse (Hauptadresse, Legacy-Kompatibilität)
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  land TEXT DEFAULT 'Deutschland',

  -- Bankdaten
  iban TEXT,
  bic TEXT,
  kontoinhaber TEXT,
  bank_name TEXT,

  -- Finanzen
  zahlungsziel_tage INTEGER,
  skonto_prozent NUMERIC(5,2),
  skonto_tage INTEGER,
  kreditlimit NUMERIC(12,2),
  kundennummer TEXT,  -- Bei Lieferanten: unsere Kundennr beim Lieferanten
  steuernummer TEXT,
  ust_id TEXT,

  -- DSGVO
  dsgvo_einwilligung BOOLEAN,
  dsgvo_datum TIMESTAMPTZ,
  dsgvo_quelle TEXT,
  kommunikation_erlaubt BOOLEAN DEFAULT true,

  -- Externe IDs (für Sync)
  hero_id INTEGER UNIQUE,
  monday_mitarbeiter_id TEXT UNIQUE,
  monday_sub_id TEXT UNIQUE,
  monday_lieferant_id TEXT UNIQUE,
  softr_record_id TEXT UNIQUE,
  ms365_contact_id TEXT,

  -- Sichtbarkeit/Berechtigungen
  visibility TEXT DEFAULT 'company',  -- 'company', 'private', 'team'
  owner_email TEXT,  -- Bei private: E-Mail des Besitzers
  shared_with TEXT[],  -- Array von E-Mails oder Gruppen-IDs

  -- Compliance-Dokumente (für Nachunternehmer)
  compliance_docs JSONB DEFAULT '{}',
  -- Struktur:
  -- {
  --   "§13b": { "status": "gültig", "gueltig_bis": "2026-12-31", "supabase_path": "...", "onedrive_url": "..." },
  --   "§48": { ... },
  --   "versicherung": { ... },
  --   "gewerbeschein": { ... }
  -- }

  -- Metadaten
  notizen TEXT,
  foto_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_source TEXT,  -- 'hero', 'monday', 'ms365', 'softr', 'manual'
  sync_mailbox TEXT,  -- Bei MS365: welches Postfach
  last_synced_at TIMESTAMPTZ
);

-- Indizes für Kontakte
CREATE INDEX idx_kontakte_email ON kontakte(email);
CREATE INDEX idx_kontakte_email_lower ON kontakte(LOWER(email));
CREATE INDEX idx_kontakte_arten ON kontakte USING GIN(kontaktarten);
CREATE INDEX idx_kontakte_hero ON kontakte(hero_id) WHERE hero_id IS NOT NULL;
CREATE INDEX idx_kontakte_firma ON kontakte(firma_kurz);
CREATE INDEX idx_kontakte_parent ON kontakte(parent_kontakt_id) WHERE parent_kontakt_id IS NOT NULL;
CREATE INDEX idx_kontakte_visibility ON kontakte(visibility);
CREATE INDEX idx_kontakte_aktiv ON kontakte(aktiv) WHERE aktiv = true;
CREATE INDEX idx_kontakte_tags ON kontakte USING GIN(tags);

-- Foreign Key für Adressen
ALTER TABLE adressen ADD CONSTRAINT fk_adressen_kontakt
  FOREIGN KEY (kontakt_id) REFERENCES kontakte(id) ON DELETE CASCADE;

COMMENT ON TABLE kontakte IS 'Zentrale Kontakttabelle - Single Source of Truth für alle Kontakte';

-- ============================================================
-- 3. KONTAKTE_LIEFERANTEN (Erweiterungstabelle)
-- ============================================================
CREATE TABLE IF NOT EXISTS kontakte_lieferanten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,

  -- Lieferanten-spezifische Daten
  lieferanten_typ TEXT,  -- 'grosshandel', 'hersteller', 'fachhandel'
  sortiment TEXT[],  -- ['sanitaer', 'heizung', 'elektro', 'baustoffe']

  -- Konditionen
  rabatt_prozent NUMERIC(5,2),
  mindestbestellwert NUMERIC(10,2),
  versandkostenfrei_ab NUMERIC(10,2),
  lieferzeit_tage INTEGER,

  -- Kontaktpersonen (Referenzen auf Ansprechpartner)
  hauptansprechpartner_id UUID REFERENCES kontakte(id),

  -- Bewertung
  bewertung_sterne INTEGER CHECK (bewertung_sterne BETWEEN 1 AND 5),
  bewertung_notiz TEXT,

  -- Online-Shop
  shop_url TEXT,
  shop_login TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(kontakt_id)
);

CREATE INDEX idx_kontakte_lieferanten_kontakt ON kontakte_lieferanten(kontakt_id);
CREATE INDEX idx_kontakte_lieferanten_sortiment ON kontakte_lieferanten USING GIN(sortiment);

COMMENT ON TABLE kontakte_lieferanten IS 'Erweiterungsdaten für Lieferanten-Kontakte';

-- ============================================================
-- 4. KONTAKTE_NACHUNTERNEHMER (Erweiterungstabelle)
-- ============================================================
CREATE TABLE IF NOT EXISTS kontakte_nachunternehmer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,

  -- Gewerke
  gewerke TEXT[],  -- ['sanitaer', 'heizung', 'elektro', 'trockenbau', 'maler', 'boden']
  hauptgewerk TEXT,

  -- Kapazität
  mitarbeiter_anzahl INTEGER,
  max_parallele_projekte INTEGER,
  aktuelle_projekte INTEGER DEFAULT 0,

  -- Qualifikation
  qualifikationen TEXT[],
  zertifizierungen TEXT[],

  -- Compliance-Status (Zusammenfassung aus kontakte.compliance_docs)
  compliance_status TEXT DEFAULT 'unvollstaendig',  -- 'vollstaendig', 'unvollstaendig', 'abgelaufen'
  compliance_geprueft_am TIMESTAMPTZ,

  -- Preisgestaltung
  stundensatz_geselle NUMERIC(8,2),
  stundensatz_meister NUMERIC(8,2),
  preisliste_url TEXT,

  -- Bewertung
  bewertung_qualitaet INTEGER CHECK (bewertung_qualitaet BETWEEN 1 AND 5),
  bewertung_termintreue INTEGER CHECK (bewertung_termintreue BETWEEN 1 AND 5),
  bewertung_kommunikation INTEGER CHECK (bewertung_kommunikation BETWEEN 1 AND 5),
  bewertung_notiz TEXT,

  -- Einsatzgebiet
  einsatzradius_km INTEGER,
  regionen TEXT[],  -- ['berlin', 'brandenburg', 'sachsen']

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(kontakt_id)
);

CREATE INDEX idx_kontakte_nu_kontakt ON kontakte_nachunternehmer(kontakt_id);
CREATE INDEX idx_kontakte_nu_gewerke ON kontakte_nachunternehmer USING GIN(gewerke);
CREATE INDEX idx_kontakte_nu_status ON kontakte_nachunternehmer(compliance_status);

COMMENT ON TABLE kontakte_nachunternehmer IS 'Erweiterungsdaten für Nachunternehmer-Kontakte';

-- ============================================================
-- 5. KONTAKTE_SYNC_LOG (Audit-Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS kontakte_sync_log (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,  -- 'hero', 'monday', 'ms365', 'softr', 'manual'
  action TEXT NOT NULL,  -- 'created', 'updated', 'merged', 'skipped', 'error'
  kontakt_id UUID REFERENCES kontakte(id) ON DELETE SET NULL,
  external_id TEXT,
  external_type TEXT,  -- 'hero_contact', 'monday_mitarbeiter', 'monday_sub', 'monday_lieferant', 'ms365_contact'
  details JSONB,
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_source ON kontakte_sync_log(source);
CREATE INDEX idx_sync_log_kontakt ON kontakte_sync_log(kontakt_id) WHERE kontakt_id IS NOT NULL;
CREATE INDEX idx_sync_log_action ON kontakte_sync_log(action);
CREATE INDEX idx_sync_log_date ON kontakte_sync_log(synced_at);

COMMENT ON TABLE kontakte_sync_log IS 'Audit-Trail für alle Sync-Operationen';

-- ============================================================
-- 6. HILFSFUNKTIONEN
-- ============================================================

-- Automatisches Updated-At
CREATE OR REPLACE FUNCTION update_kontakte_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kontakte_updated_at
  BEFORE UPDATE ON kontakte
  FOR EACH ROW EXECUTE FUNCTION update_kontakte_updated_at();

CREATE TRIGGER trigger_adressen_updated_at
  BEFORE UPDATE ON adressen
  FOR EACH ROW EXECUTE FUNCTION update_kontakte_updated_at();

CREATE TRIGGER trigger_kontakte_lieferanten_updated_at
  BEFORE UPDATE ON kontakte_lieferanten
  FOR EACH ROW EXECUTE FUNCTION update_kontakte_updated_at();

CREATE TRIGGER trigger_kontakte_nachunternehmer_updated_at
  BEFORE UPDATE ON kontakte_nachunternehmer
  FOR EACH ROW EXECUTE FUNCTION update_kontakte_updated_at();

-- ============================================================
-- 7. RPC: Duplikat-Erkennung
-- ============================================================
CREATE OR REPLACE FUNCTION kontakte_find_duplicates()
RETURNS TABLE (
  kontakt_id UUID,
  potential_duplicate_id UUID,
  match_type TEXT,
  confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  -- Email-Match (höchste Priorität)
  SELECT k1.id, k2.id, 'email'::TEXT, 1.0::NUMERIC
  FROM kontakte k1
  JOIN kontakte k2 ON LOWER(TRIM(k1.email)) = LOWER(TRIM(k2.email))
                  AND k1.id < k2.id
  WHERE k1.email IS NOT NULL AND k1.email != ''

  UNION ALL

  -- Firma + PLZ Match
  SELECT k1.id, k2.id, 'firma_plz'::TEXT, 0.8::NUMERIC
  FROM kontakte k1
  JOIN kontakte k2 ON LOWER(TRIM(k1.firma_kurz)) = LOWER(TRIM(k2.firma_kurz))
                  AND k1.plz = k2.plz
                  AND k1.id < k2.id
  WHERE k1.firma_kurz IS NOT NULL AND k1.firma_kurz != ''
        AND k1.plz IS NOT NULL

  UNION ALL

  -- Vorname + Nachname + PLZ Match
  SELECT k1.id, k2.id, 'name_plz'::TEXT, 0.7::NUMERIC
  FROM kontakte k1
  JOIN kontakte k2 ON LOWER(TRIM(k1.vorname)) = LOWER(TRIM(k2.vorname))
                  AND LOWER(TRIM(k1.nachname)) = LOWER(TRIM(k2.nachname))
                  AND k1.plz = k2.plz
                  AND k1.id < k2.id
  WHERE k1.vorname IS NOT NULL AND k1.nachname IS NOT NULL
        AND k1.plz IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kontakte_find_duplicates() IS 'Findet potenzielle Duplikate basierend auf Email, Firma+PLZ oder Name+PLZ';

-- ============================================================
-- 8. RPC: Sichtbarkeits-Filter
-- ============================================================
CREATE OR REPLACE FUNCTION kontakte_visible_for(user_email TEXT)
RETURNS SETOF kontakte AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM kontakte
  WHERE visibility = 'company'
     OR (visibility = 'private' AND owner_email = user_email)
     OR user_email = ANY(shared_with)
  ORDER BY
    CASE WHEN firma_kurz IS NOT NULL THEN firma_kurz
         ELSE COALESCE(nachname, '') || ' ' || COALESCE(vorname, '')
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION kontakte_visible_for(TEXT) IS 'Gibt alle Kontakte zurück, die für den angegebenen User sichtbar sind';

-- ============================================================
-- 9. RPC: Kontakte zusammenführen (Merge)
-- ============================================================
CREATE OR REPLACE FUNCTION kontakte_merge(
  p_primary_id UUID,
  p_secondary_id UUID
) RETURNS UUID AS $$
DECLARE
  v_primary kontakte%ROWTYPE;
  v_secondary kontakte%ROWTYPE;
BEGIN
  -- Beide Kontakte laden
  SELECT * INTO v_primary FROM kontakte WHERE id = p_primary_id;
  SELECT * INTO v_secondary FROM kontakte WHERE id = p_secondary_id;

  IF v_primary.id IS NULL THEN
    RAISE EXCEPTION 'Primary Kontakt nicht gefunden: %', p_primary_id;
  END IF;
  IF v_secondary.id IS NULL THEN
    RAISE EXCEPTION 'Secondary Kontakt nicht gefunden: %', p_secondary_id;
  END IF;

  -- Felder vom Secondary übernehmen, wenn Primary leer
  UPDATE kontakte SET
    vorname = COALESCE(v_primary.vorname, v_secondary.vorname),
    nachname = COALESCE(v_primary.nachname, v_secondary.nachname),
    firma_kurz = COALESCE(v_primary.firma_kurz, v_secondary.firma_kurz),
    firma_lang = COALESCE(v_primary.firma_lang, v_secondary.firma_lang),
    email_rechnung = COALESCE(v_primary.email_rechnung, v_secondary.email_rechnung),
    telefon_mobil = COALESCE(v_primary.telefon_mobil, v_secondary.telefon_mobil),
    telefon_festnetz = COALESCE(v_primary.telefon_festnetz, v_secondary.telefon_festnetz),
    strasse = COALESCE(v_primary.strasse, v_secondary.strasse),
    plz = COALESCE(v_primary.plz, v_secondary.plz),
    ort = COALESCE(v_primary.ort, v_secondary.ort),
    iban = COALESCE(v_primary.iban, v_secondary.iban),
    bic = COALESCE(v_primary.bic, v_secondary.bic),
    -- Kontaktarten zusammenführen
    kontaktarten = ARRAY(SELECT DISTINCT UNNEST(v_primary.kontaktarten || v_secondary.kontaktarten)),
    -- External IDs übernehmen
    hero_id = COALESCE(v_primary.hero_id, v_secondary.hero_id),
    monday_mitarbeiter_id = COALESCE(v_primary.monday_mitarbeiter_id, v_secondary.monday_mitarbeiter_id),
    monday_sub_id = COALESCE(v_primary.monday_sub_id, v_secondary.monday_sub_id),
    monday_lieferant_id = COALESCE(v_primary.monday_lieferant_id, v_secondary.monday_lieferant_id),
    ms365_contact_id = COALESCE(v_primary.ms365_contact_id, v_secondary.ms365_contact_id),
    -- Notizen zusammenführen
    notizen = CASE
      WHEN v_primary.notizen IS NOT NULL AND v_secondary.notizen IS NOT NULL
      THEN v_primary.notizen || E'\n---\n' || v_secondary.notizen
      ELSE COALESCE(v_primary.notizen, v_secondary.notizen)
    END,
    updated_at = NOW()
  WHERE id = p_primary_id;

  -- Adressen umhängen
  UPDATE adressen SET kontakt_id = p_primary_id WHERE kontakt_id = p_secondary_id;

  -- Ansprechpartner umhängen
  UPDATE kontakte SET parent_kontakt_id = p_primary_id WHERE parent_kontakt_id = p_secondary_id;

  -- Lieferanten-Daten mergen (falls vorhanden)
  UPDATE kontakte_lieferanten
  SET kontakt_id = p_primary_id
  WHERE kontakt_id = p_secondary_id
  AND NOT EXISTS (SELECT 1 FROM kontakte_lieferanten WHERE kontakt_id = p_primary_id);

  -- Nachunternehmer-Daten mergen (falls vorhanden)
  UPDATE kontakte_nachunternehmer
  SET kontakt_id = p_primary_id
  WHERE kontakt_id = p_secondary_id
  AND NOT EXISTS (SELECT 1 FROM kontakte_nachunternehmer WHERE kontakt_id = p_primary_id);

  -- Log schreiben
  INSERT INTO kontakte_sync_log (source, action, kontakt_id, details)
  VALUES ('manual', 'merged', p_primary_id, jsonb_build_object(
    'merged_from', p_secondary_id,
    'merged_at', NOW()
  ));

  -- Secondary deaktivieren (nicht löschen für Audit)
  UPDATE kontakte SET
    aktiv = false,
    notizen = COALESCE(notizen, '') || E'\n[Zusammengeführt mit ' || p_primary_id || ' am ' || NOW() || ']'
  WHERE id = p_secondary_id;

  RETURN p_primary_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kontakte_merge(UUID, UUID) IS 'Führt zwei Kontakte zusammen. Primary behält alle Daten, Secondary wird deaktiviert.';

-- ============================================================
-- 10. RPC: Kontakt-Statistiken
-- ============================================================
CREATE OR REPLACE FUNCTION kontakte_statistiken()
RETURNS TABLE (
  kategorie TEXT,
  anzahl BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Gesamt'::TEXT, COUNT(*)::BIGINT FROM kontakte WHERE aktiv = true
  UNION ALL
  SELECT unnest(kontaktarten)::TEXT, COUNT(*)::BIGINT
  FROM kontakte
  WHERE aktiv = true
  GROUP BY unnest(kontaktarten)
  ORDER BY 2 DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. VIEW: Aktive Kontakte mit allen Details
-- ============================================================
CREATE OR REPLACE VIEW v_kontakte_aktiv AS
SELECT
  k.*,
  -- Anzeigename
  CASE
    WHEN k.firma_kurz IS NOT NULL THEN k.firma_kurz
    WHEN k.nachname IS NOT NULL THEN
      COALESCE(k.anrede || ' ', '') ||
      COALESCE(k.titel || ' ', '') ||
      COALESCE(k.vorname || ' ', '') ||
      k.nachname
    ELSE 'Unbenannt'
  END AS anzeigename,
  -- Formatierte Kontakt-Nummer
  'K-' || LPAD(k.kontakt_nr::TEXT, 4, '0') AS kontakt_nr_formatiert,
  -- Parent-Firma (falls Ansprechpartner)
  p.firma_kurz AS parent_firma,
  -- Anzahl Ansprechpartner
  (SELECT COUNT(*) FROM kontakte child WHERE child.parent_kontakt_id = k.id) AS anzahl_ansprechpartner,
  -- Lieferanten-Erweiterung
  l.lieferanten_typ,
  l.rabatt_prozent,
  -- Nachunternehmer-Erweiterung
  n.gewerke,
  n.compliance_status
FROM kontakte k
LEFT JOIN kontakte p ON k.parent_kontakt_id = p.id
LEFT JOIN kontakte_lieferanten l ON k.id = l.kontakt_id
LEFT JOIN kontakte_nachunternehmer n ON k.id = n.kontakt_id
WHERE k.aktiv = true;

COMMENT ON VIEW v_kontakte_aktiv IS 'Alle aktiven Kontakte mit Anzeigename und Erweiterungsdaten';

-- ============================================================
-- 12. Row Level Security (RLS)
-- ============================================================
ALTER TABLE kontakte ENABLE ROW LEVEL SECURITY;
ALTER TABLE adressen ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontakte_lieferanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontakte_nachunternehmer ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontakte_sync_log ENABLE ROW LEVEL SECURITY;

-- Service Role hat vollen Zugriff
CREATE POLICY "Service Role Full Access" ON kontakte
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access" ON adressen
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access" ON kontakte_lieferanten
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access" ON kontakte_nachunternehmer
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access" ON kontakte_sync_log
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated Users: Sichtbarkeitsregeln
CREATE POLICY "Authenticated Read Visible Kontakte" ON kontakte
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      visibility = 'company'
      OR (visibility = 'private' AND owner_email = auth.jwt()->>'email')
      OR (auth.jwt()->>'email' = ANY(shared_with))
    )
  );

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Kontaktmanagement-Tabellen erfolgreich erstellt!' AS status;
