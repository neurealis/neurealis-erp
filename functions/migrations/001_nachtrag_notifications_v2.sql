-- ============================================================
-- Nachtrags-Benachrichtigungen v2
-- Neue Logik: BL <-> NU Kommunikation mit Bedingungen
-- ============================================================

-- 1. Neue Spalte für Notification-Typ
ALTER TABLE nachtrag_notifications
ADD COLUMN IF NOT EXISTS notification_type text;

COMMENT ON COLUMN nachtrag_notifications.notification_type IS
'Typ: new_for_bl, new_for_nu, approved, rejected';

-- 2. Tracking welche Benachrichtigungen schon gesendet wurden
ALTER TABLE nachtraege
ADD COLUMN IF NOT EXISTS notified_new_bl boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_new_nu boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_rejected boolean DEFAULT false;

-- 3. Hauptfunktion: Entscheidet welche Benachrichtigungen nötig sind
CREATE OR REPLACE FUNCTION queue_nachtrag_notifications_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- ============================================================
    -- WICHTIG: Keine Benachrichtigung ohne Nachtrag-Nummer!
    -- ============================================================
    IF NEW.nachtrag_nr IS NULL THEN
        RETURN NEW;
    END IF;

    -- ============================================================
    -- FALL 1: NU erstellt Nachtrag → BL informieren (wenn Budget da)
    -- ============================================================
    IF NEW.gemeldet_von = 'nu'
       AND NEW.betrag_kunde_netto IS NOT NULL
       AND NEW.notified_new_bl = false
       AND NEW.bauleiter_email IS NOT NULL
    THEN
        v_should_notify := true;
        v_notification_type := 'new_for_bl';
        v_recipient_email := NEW.bauleiter_email;
        v_recipient_type := 'bauleiter';
        v_subject := 'Neuer Nachtrag vom NU: ' || NEW.nachtrag_nr;

        INSERT INTO nachtrag_notifications (
            nachtrag_id, recipient_type, recipient_email, recipient_name,
            subject, body, status, notification_type
        ) VALUES (
            NEW.id, v_recipient_type, v_recipient_email, NEW.bauleiter_name,
            v_subject, '', 'pending', v_notification_type
        );

        NEW.notified_new_bl := true;
    END IF;

    -- ============================================================
    -- FALL 2: BL erstellt Nachtrag → NU informieren (wenn genehmigt + Budget)
    -- ============================================================
    IF NEW.gemeldet_von = 'bauleiter'
       AND NEW.status = '(2) Genehmigt'
       AND NEW.betrag_kunde_netto IS NOT NULL
       AND NEW.notified_new_nu = false
       AND NEW.nu_email IS NOT NULL
    THEN
        v_should_notify := true;
        v_notification_type := 'new_for_nu';
        v_recipient_email := NEW.nu_email;
        v_recipient_type := 'nu';
        v_subject := 'Neuer Nachtrag genehmigt: ' || NEW.nachtrag_nr;

        INSERT INTO nachtrag_notifications (
            nachtrag_id, recipient_type, recipient_email, recipient_name,
            subject, body, status, notification_type
        ) VALUES (
            NEW.id, v_recipient_type, v_recipient_email, NEW.nu_name,
            v_subject, '', 'pending', v_notification_type
        );

        NEW.notified_new_nu := true;
    END IF;

    -- ============================================================
    -- FALL 3: Nachtrag wird genehmigt → NU informieren
    -- (nur wenn NU noch nicht über Genehmigung informiert wurde)
    -- ============================================================
    IF NEW.status = '(2) Genehmigt'
       AND (OLD.status IS NULL OR OLD.status != '(2) Genehmigt')
       AND NEW.notified_approved = false
       AND NEW.nu_email IS NOT NULL
       -- Nicht doppelt benachrichtigen wenn gerade als new_for_nu gesendet
       AND NEW.notified_new_nu = false
    THEN
        v_notification_type := 'approved';
        v_recipient_email := NEW.nu_email;
        v_recipient_type := 'nu';
        v_subject := 'Nachtrag genehmigt: ' || NEW.nachtrag_nr;

        INSERT INTO nachtrag_notifications (
            nachtrag_id, recipient_type, recipient_email, recipient_name,
            subject, body, status, notification_type
        ) VALUES (
            NEW.id, v_recipient_type, v_recipient_email, NEW.nu_name,
            v_subject, '', 'pending', v_notification_type
        );

        NEW.notified_approved := true;
    END IF;

    -- ============================================================
    -- FALL 4: Nachtrag wird abgelehnt → NU informieren
    -- ============================================================
    IF NEW.status = '(3) Abgelehnt'
       AND (OLD.status IS NULL OR OLD.status != '(3) Abgelehnt')
       AND NEW.notified_rejected = false
       AND NEW.nu_email IS NOT NULL
    THEN
        v_notification_type := 'rejected';
        v_recipient_email := NEW.nu_email;
        v_recipient_type := 'nu';
        v_subject := 'Nachtrag abgelehnt: ' || NEW.nachtrag_nr;

        INSERT INTO nachtrag_notifications (
            nachtrag_id, recipient_type, recipient_email, recipient_name,
            subject, body, status, notification_type
        ) VALUES (
            NEW.id, v_recipient_type, v_recipient_email, NEW.nu_name,
            v_subject, '', 'pending', v_notification_type
        );

        NEW.notified_rejected := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger ersetzen
DROP TRIGGER IF EXISTS trg_queue_nachtrag_notifications ON nachtraege;
DROP TRIGGER IF EXISTS trg_queue_nachtrag_notifications_v2 ON nachtraege;

CREATE TRIGGER trg_queue_nachtrag_notifications_v2
    BEFORE INSERT OR UPDATE ON nachtraege
    FOR EACH ROW
    EXECUTE FUNCTION queue_nachtrag_notifications_v2();

-- 5. Index für schnellere Queue-Abfragen
CREATE INDEX IF NOT EXISTS idx_nachtrag_notifications_pending
ON nachtrag_notifications(status) WHERE status = 'pending';
