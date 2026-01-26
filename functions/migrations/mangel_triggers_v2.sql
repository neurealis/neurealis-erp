-- Migration: mangel_triggers_v2
-- Projekt: neurealis ERP (mfpuijttdgkllnvhvjlu)
-- Datum: 2026-01-25
--
-- Fügt Trigger hinzu die direkt via pg_net Edge Functions aufrufen
-- (kein Cron Job mehr nötig für E-Mail-Versand)

-- 1. Funktion: mangel_nr automatisch generieren (falls nicht vorhanden)
CREATE OR REPLACE FUNCTION calculate_mangel_nr()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Nur wenn mangel_nr noch nicht gesetzt und projekt_nr vorhanden
  IF NEW.mangel_nr IS NULL AND NEW.projekt_nr IS NOT NULL THEN
    -- Nächste Nummer für dieses Projekt ermitteln
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(mangel_nr FROM 'M([0-9]+)$') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM maengel_fertigstellung
    WHERE projekt_nr = NEW.projekt_nr
      AND mangel_nr IS NOT NULL;

    -- mangel_nr setzen
    NEW.mangel_nr := NEW.projekt_nr || '-M' || next_num;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für Auto-Nummer (nur wenn nicht existiert)
DROP TRIGGER IF EXISTS trg_mangel_auto_nr ON maengel_fertigstellung;
CREATE TRIGGER trg_mangel_auto_nr
  BEFORE INSERT ON maengel_fertigstellung
  FOR EACH ROW
  EXECUTE FUNCTION calculate_mangel_nr();


-- 2. Funktion: Neuer Mangel → E-Mail an NU (direkt via pg_net)
CREATE OR REPLACE FUNCTION handle_new_mangel()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur wenn NU-E-Mail vorhanden
  IF NEW.nu_email IS NOT NULL AND NEW.nu_email != '' THEN
    -- Notification in Queue
    INSERT INTO mangel_notifications (
      mangel_id, mangel_mangel_nr, notification_type, recipient_type,
      recipient_email, recipient_name, subject, status, created_at
    ) VALUES (
      NEW.id, NEW.mangel_nr, 'new', 'nu',
      NEW.nu_email, NEW.nachunternehmer,
      'Neuer Mangel erfasst: ' || COALESCE(NEW.mangel_nr, NEW.projekt_nr),
      'pending', NOW()
    );

    -- Edge Function direkt aufrufen via pg_net (async)
    PERFORM net.http_post(
      url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-notify',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('mangel_id', NEW.id::text, 'type', 'new')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für neuen Mangel
DROP TRIGGER IF EXISTS trg_new_mangel ON maengel_fertigstellung;
CREATE TRIGGER trg_new_mangel
  AFTER INSERT ON maengel_fertigstellung
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_mangel();


-- 3. Funktion: Status-Änderungen (Behoben → BL, Abgenommen → NU)
CREATE OR REPLACE FUNCTION handle_mangel_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- NU meldet "Behoben" → E-Mail an Bauleiter
  IF NEW.status_mangel_nu = '(1) Behoben'
     AND (OLD.status_mangel_nu IS DISTINCT FROM NEW.status_mangel_nu) THEN

    INSERT INTO mangel_notifications (
      mangel_id, mangel_mangel_nr, notification_type, recipient_type,
      recipient_email, recipient_name, subject, status, created_at
    ) VALUES (
      NEW.id, NEW.mangel_nr, 'nu_fixed', 'bauleiter',
      'bauleitung@neurealis.de', NEW.bauleiter,
      'Mängelbehebung gemeldet: ' || COALESCE(NEW.mangel_nr, NEW.projekt_nr),
      'pending', NOW()
    );

    -- Edge Function direkt aufrufen
    PERFORM net.http_post(
      url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-notify',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('mangel_id', NEW.id::text, 'type', 'nu_fixed')
    );
  END IF;

  -- BL nimmt ab → E-Mail an NU
  IF NEW.status_mangel = '(4) Abgenommen'
     AND (OLD.status_mangel IS DISTINCT FROM NEW.status_mangel)
     AND NEW.nu_email IS NOT NULL THEN

    INSERT INTO mangel_notifications (
      mangel_id, mangel_mangel_nr, notification_type, recipient_type,
      recipient_email, recipient_name, subject, status, created_at
    ) VALUES (
      NEW.id, NEW.mangel_nr, 'accepted', 'nu',
      NEW.nu_email, NEW.nachunternehmer,
      'Mangel abgenommen: ' || COALESCE(NEW.mangel_nr, NEW.projekt_nr),
      'pending', NOW()
    );

    -- Edge Function direkt aufrufen
    PERFORM net.http_post(
      url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-notify',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('mangel_id', NEW.id::text, 'type', 'accepted')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für Status-Änderungen
DROP TRIGGER IF EXISTS trg_mangel_status_change ON maengel_fertigstellung;
CREATE TRIGGER trg_mangel_status_change
  AFTER UPDATE ON maengel_fertigstellung
  FOR EACH ROW
  EXECUTE FUNCTION handle_mangel_status_change();


-- 4. Bestehenden Rejection-Trigger aktualisieren (falls nötig)
-- Der existiert bereits und ruft mangel-rejection-notify auf


-- Überprüfung: Alle Trigger anzeigen
SELECT tgname, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'maengel_fertigstellung'::regclass
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;
