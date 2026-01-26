-- ============================================================
-- Nachtrags-Benachrichtigungen v3
-- NEU: Bestätigungs-E-Mail an NU bei Einreichung
-- ============================================================

-- 1. Neue Tracking-Spalte für Eingangsbestätigung
ALTER TABLE nachtraege
ADD COLUMN IF NOT EXISTS notified_confirmation_nu boolean DEFAULT false;

-- 2. Erweiterte Hauptfunktion mit Bestätigung für NU
CREATE OR REPLACE FUNCTION queue_nachtrag_notifications_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_notification_type text;
    v_recipient_email text;
    v_recipient_type text;
    v_subject text;
BEGIN
    -- ============================================================
    -- WICHTIG: Keine Benachrichtigung ohne Nachtrag-Nummer!
    -- ============================================================
    IF NEW.nachtrag_nr IS NULL THEN
        RETURN NEW;
    END IF;

    -- ============================================================
    -- FALL 1: NU erstellt Nachtrag -> BL informieren (wenn Budget da)
    -- ============================================================
    IF NEW.gemeldet_von = 'nu'
       AND NEW.betrag_kunde_netto IS NOT NULL
       AND NEW.notified_new_bl = false
       AND NEW.bauleiter_email IS NOT NULL
    THEN
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
    -- FALL 1b: NU erstellt Nachtrag -> NU Bestätigung senden
    -- ============================================================
    IF NEW.gemeldet_von = 'nu'
       AND NEW.betrag_kunde_netto IS NOT NULL
       AND NEW.notified_confirmation_nu = false
       AND NEW.nu_email IS NOT NULL
    THEN
        v_notification_type := 'confirmation_for_nu';
        v_recipient_email := NEW.nu_email;
        v_recipient_type := 'nu';
        v_subject := 'Nachtrag eingereicht: ' || NEW.nachtrag_nr;

        INSERT INTO nachtrag_notifications (
            nachtrag_id, recipient_type, recipient_email, recipient_name,
            subject, body, status, notification_type
        ) VALUES (
            NEW.id, v_recipient_type, v_recipient_email, NEW.nu_name,
            v_subject, '', 'pending', v_notification_type
        );

        NEW.notified_confirmation_nu := true;
    END IF;

    -- ============================================================
    -- FALL 2: BL erstellt Nachtrag -> NU informieren (wenn genehmigt + Budget)
    -- ============================================================
    IF NEW.gemeldet_von = 'bauleiter'
       AND NEW.status = '(1) Genehmigt'
       AND NEW.betrag_kunde_netto IS NOT NULL
       AND NEW.notified_new_nu = false
       AND NEW.nu_email IS NOT NULL
    THEN
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
    -- FALL 3: Nachtrag wird genehmigt -> NU informieren
    -- (nur wenn NU noch nicht ueber Genehmigung informiert wurde)
    -- ============================================================
    IF NEW.status = '(1) Genehmigt'
       AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != '(1) Genehmigt')
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
    -- FALL 4: Nachtrag wird abgelehnt -> NU informieren
    -- ============================================================
    IF NEW.status = '(2) Abgelehnt'
       AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != '(2) Abgelehnt')
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

-- Trigger bleibt bestehen (wird automatisch die neue Funktion nutzen)
