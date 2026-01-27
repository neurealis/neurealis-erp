# Session Log 2026-01-27: Nachtragsmanagement NU-Annahme

## Übersicht

**Datum:** 2026-01-27
**Thema:** Erweiterung Nachtragsmanagement - NU-Annahme + Softr-Push Fix

---

## Implementierte Features

### 1. NU-Annahme für Nachträge

**Neue Spalten in `nachtraege`:**
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `status_nu` | text | NU-Entscheidung: "angenommen" |
| `datum_annahme_nu` | timestamptz | Automatisch gesetzt bei Statusänderung |
| `notified_nu_accepted` | boolean | Tracking: Benachrichtigung gesendet |

**Trigger:**
- `trg_status_nu_change` - Setzt automatisch `datum_annahme_nu` auf aktuellen Zeitpunkt wenn `status_nu` geändert wird
- `trg_queue_nachtrag_notifications_v3` - Erstellt Notifications bei NU-Annahme

**Workflow:**
1. NU setzt `status_nu = 'angenommen'` in Softr
2. Trigger setzt `datum_annahme_nu` auf aktuellen Zeitpunkt
3. Trigger erstellt zwei Notifications:
   - `nu_accepted_for_bl` → E-Mail an Bauleiter
   - `nu_accepted_for_nu` → Bestätigungs-E-Mail an NU
4. `nachtrag-notify` versendet E-Mails mit Betrag + Datum Annahme

### 2. Fix: nachtrag_nr Push zu Softr

**Problem:** Die `nachtrag_nr` wurde in Supabase generiert, aber nicht zu Softr gepusht.

**Lösung:**
- `softr-push` v2 erweitert:
  - Pusht jetzt auch `nachtrag_nr` zu Softr
  - Fallback-Suche über ATBS+Titel wenn nachtrag_nr in Softr leer
- `notify_nachtrag_change` Trigger erweitert:
  - Ruft `softr-push` bei INSERT auf
  - Ruft `softr-push` bei nachtrag_nr-Generierung auf

---

## Geänderte Dateien

### Datenbank (Migrationen)
- `add_status_nu_fields` - Neue Spalten + Trigger
- `fix_softr_push_nachtrag_nr` - Erweiterter notify_nachtrag_change Trigger
- `status_nu_only_accept` - Vereinfachter Trigger (nur Annahme)

### Edge Functions
| Function | Version | Status |
|----------|---------|--------|
| `softr-push` | v2 | ✅ Deployed |
| `nachtrag-notify` | v18 | ✅ Deployed (Version 25) |

### Lokale Dateien
- `functions/supabase/functions/softr-push/index.ts` - v2
- `functions/supabase/functions/nachtrag-notify/index.ts` - v18

---

## E-Mail Templates (v18)

### NU hat angenommen → Bauleiter
- Betreff: `NU hat Nachtrag {nachtrag_nr} angenommen – {projektname}`
- Inhalt: Projekt, Nachtrag-Nr, Titel, Betrag NU (grün), Datum Annahme, NU-Kontakt

### NU hat angenommen → NU (Bestätigung)
- Betreff: `Annahme bestätigt: {nachtrag_nr} – {projektname}`
- Inhalt: Projekt, NUA-Nr, Nachtrag-Nr, Titel, Betrag (grün), Datum Annahme
- Hinweis: "Die Ausführung kann beginnen. Der Nachtrag ist verbindlich bestätigt."

---

## Test-Befehle

```sql
-- NU-Annahme simulieren
UPDATE nachtraege
SET status_nu = 'angenommen'
WHERE nachtrag_nr = 'ATBS-456-N1';

-- Prüfen ob datum_annahme_nu gesetzt wurde
SELECT nachtrag_nr, status_nu, datum_annahme_nu
FROM nachtraege
WHERE status_nu IS NOT NULL;

-- Prüfen ob Notifications erstellt wurden
SELECT notification_type, recipient_type, recipient_email, status
FROM nachtrag_notifications
WHERE notification_type LIKE 'nu_accepted%'
ORDER BY created_at DESC;

-- Softr-Push testen
SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-push',
    headers := '{"Authorization": "Bearer ...", "Content-Type": "application/json"}'::jsonb,
    body := '{"nachtrag_nr": "ATBS-456-N1", "atbs_nummer": "ATBS-456", "titel": "Test"}'::jsonb
);
```

---

## Offene Punkte

Keine - alle Features deployed und verifiziert.

---

## Verifizierung

- [x] Spalten `status_nu`, `datum_annahme_nu` existieren
- [x] Trigger `trg_status_nu_change` aktiv
- [x] Trigger `trg_queue_nachtrag_notifications_v3` aktiv
- [x] `softr-push` v2 deployed
- [x] `notify_nachtrag_change` Trigger pusht nachtrag_nr

---

*Session beendet: 2026-01-27*
