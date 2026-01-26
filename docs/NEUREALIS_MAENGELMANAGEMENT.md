# Mängelmanagement - neurealis ERP

**Version:** 7.2
**Stand:** 2026-01-26
**Status:** Live
**Projekt:** mfpuijttdgkllnvhvjlu

---

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Status-Optionen](#status-optionen)
3. [E-Mail-Szenarien](#e-mail-szenarien)
4. [Workflow](#workflow)
5. [Datenbank](#datenbank)
6. [Edge Functions](#edge-functions)
7. [Cron Jobs](#cron-jobs)
8. [Trigger](#trigger)
9. [Softr Integration](#softr-integration)
10. [Troubleshooting](#troubleshooting)

---

## Übersicht

Das Mängelmanagement verwaltet alle Mängel während und nach der Bauphase.

> **WICHTIG (v7.0):** Ab sofort wird nur noch die **einheitliche Tabelle "Mängel nach Fertigstellung"** verwendet.
> Die alte Tabelle "Ausführungsmängel" wurde migriert und wird **nicht mehr synchronisiert**.

### Softr Tabellen

| Tabelle | Table-ID | Status | Hinweis |
|---------|----------|--------|---------|
| **Mängel nach Fertigstellung** | `J563LaZ43bZSQy` | ✅ Aktiv | Einzige Mängeltabelle, wird mit Supabase synchronisiert |
| ~~Ausführungsmängel~~ | `0xZkAxDadNyOMI` | ⛔ Deprecated | Nicht mehr verwenden! |

### Migration am 2026-01-26

| Aktion | Anzahl | Details |
|--------|--------|---------|
| Ausführungsmängel migriert | 34 | Von alter Tabelle in "Mängel nach Fertigstellung" kopiert |
| BV-Feld nachgefüllt | 25 | Projektname → BV-Feld |
| Test-Einträge gelöscht (Softr) | 18 | Test-Projekte, ungültige Beschreibungen |
| Test-Einträge gelöscht (Supabase) | 7 | Synchronisiert |
| **Mängel (Softr + Supabase)** | **26** | 100% synchron, alle mit `mangel_nr` |

### Mängel-ID Schema

Format: `ATBS-XXX-M1`, `ATBS-XXX-M2`, etc.

- **ATBS-XXX** = Projekt-Nummer
- **M1, M2, ...** = Fortlaufende Nummer pro Projekt (nach Erstelldatum)

### Features (v7.0)

| Feature | Status | Beschreibung |
|---------|--------|--------------|
| **Unified Tabelle** | ✅ | `maengel_fertigstellung` für **alle** Mängeltypen (Ausführung + Fertigstellung) |
| **Art des Mangels** | ✅ | Unterscheidung über Feld `art_des_mangels`: `Ausführung`, `Endabnahme`, `Gewährleistung` |
| **mangel_nr (Auto)** | ✅ | Format `ATBS-XXX-M1` via Trigger |
| **5 Status-Stufen** | ✅ | Offen → In Bearbeitung → Nicht abgenommen/Überfällig → Abgenommen |
| **Automatische Überfällig-Markierung** | ✅ | Cron Job täglich 0:30 Uhr |
| **2-Tage-Erinnerungen** | ✅ | Cron Job alle 2 Tage 9:00 Uhr |
| **E-Mail bei Mangel-Erfassung** | ✅ | **SOFORT** via Trigger → NU |
| **E-Mail bei "Behoben"** | ✅ | **SOFORT** via Trigger → BL |
| **E-Mail bei Ablehnung** | ✅ | **SOFORT** via Trigger → NU + Zusatzkosten-Hinweis |
| **E-Mail bei Abnahme** | ✅ | **SOFORT** via Trigger → NU |
| **Schlussrechnungs-Prüfung** | ✅ | Buchhaltung prüft vor Zahlungsfreigabe |
| **Trigger-basierter E-Mail-Versand** | ✅ | **NEU v6:** Alle E-Mails sofort via pg_net (kein Cron-Delay) |

---

## Status-Optionen

### Status Mangel (Bauleitung)

| Status | Beschreibung | E-Mail |
|--------|--------------|--------|
| **(0) Offen** | Mangel wurde erfasst | → NU (neuer Mangel) |
| **(1) In Bearbeitung** | NU arbeitet daran | - |
| **(2) Nicht abgenommen** | Behebung abgelehnt | → NU (Ablehnung + Zusatzkosten) |
| **(3) Überfällig** | Frist verstrichen (automatisch) | → NU (Erinnerung ROT) |
| **(4) Abgenommen** | Mangel behoben | → NU (Bestätigung) |

### Status Mangel NU (Nachunternehmer)

| Status | Beschreibung | E-Mail |
|--------|--------------|--------|
| **(0) Offen** | NU muss noch beheben | - |
| **(1) Behoben** | NU meldet Behebung | → BL (zur Prüfung) |

---

## E-Mail-Szenarien

### Vollständige Matrix

| Ereignis | Empfänger | Betreff | Farbe |
|----------|-----------|---------|-------|
| **Mangel erfasst** | NU | "Neuer Mangel erfasst: ATBS-XXX-M1" | Gelb |
| **Erinnerung 1-2** | NU | "Erinnerung #X: Offener Mangel..." | Gelb |
| **Erinnerung 3-4** | NU | "Erinnerung #X: Offener Mangel..." | Orange |
| **Erinnerung 5+** | NU | "Erinnerung #X: Offener Mangel..." | Rot |
| **Frist überschritten** | NU | "Erinnerung: FRIST ÜBERSCHRITTEN" | Rot |
| **NU meldet behoben** | BL | "Mängelbehebung gemeldet: ATBS-XXX-M1" + **Fotos + Buttons** | Blau |
| **BL lehnt ab** | NU | "Mängelbehebung nicht abgenommen: ATBS-XXX-M1" | Rot |
| **BL nimmt ab** | NU | "Mangel abgenommen: ATBS-XXX-M1" | Grün |

### E-Mail-Inhalte

**Bei Ablehnung (NU):**
- Rote Status-Box: "Mängelbehebung nicht abgenommen"
- Mangel-Details
- ⚠️ Zusatzkosten-Hinweis: "Aufwand für erneute Prüfung kann von Schlussrechnung abgezogen werden"
- 💰 Schlussrechnungs-Hinweis

**Bei Abnahme (NU):**
- Grüne Status-Box: "Mängelbehebung abgenommen"
- Mangel-Details
- "Vielen Dank für die Behebung!"

---

## Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. MANGEL ERFASST (Bauleitung in Softr)                                │
│     └─► Trigger: trg_mangel_auto_nr → mangel_nr generieren              │
│     └─► Trigger: trg_new_mangel → E-Mail an NU                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. ERINNERUNGEN (Cron: alle 2 Tage 07:00)                              │
│     └─► mangel-reminder: E-Mail an NU (Gelb → Orange → Rot)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. ÜBERFÄLLIG-CHECK (Cron: täglich 00:30)                              │
│     └─► mangel-overdue: Status → "(3) Überfällig" wenn Frist vorbei     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. NU MELDET BEHOBEN (status_mangel_nu = "(1) Behoben")                 │
│     └─► Trigger: trg_mangel_status_change → E-Mail an BL                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  5a. BL NIMMT AB              │   │  5b. BL LEHNT AB              │
│      Status = "(4) Abgenommen"│   │      Status = "(2) Nicht      │
│      └─► E-Mail an NU (grün)  │   │               abgenommen"     │
│      └─► FERTIG               │   │      └─► Trigger: reset NU    │
└───────────────────────────────┘   │      └─► E-Mail an NU (rot)   │
                                    │      └─► Zurück zu Schritt 2  │
                                    └───────────────────────────────┘
```

### Schlussrechnung

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCHLUSSRECHNUNG EINGANG (Buchhaltung)                                  │
│                                                                         │
│  SQL-Prüfung:                                                           │
│  SELECT COUNT(*) FROM maengel_fertigstellung                            │
│  WHERE projekt_nr = 'ATBS-XXX'                                          │
│    AND status_mangel != '(4) Abgenommen';                               │
│                                                                         │
│  Ergebnis = 0  →  Zahlungsfreigabe möglich                              │
│  Ergebnis > 0  →  Keine Zahlungsfreigabe, Rückfrage an BL               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Datenbank

### maengel_fertigstellung

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | Primary Key |
| `mangel_nr` | text | Auto: ATBS-XXX-M1 |
| `projekt_nr` | text | ATBS-Nummer |
| `status_mangel` | text | (0)-(4) siehe oben |
| `status_mangel_nu` | text | (0) Offen, (1) Behoben |
| `beschreibung_mangel` | text | Beschreibung |
| `bauleiter` | text | Name BL |
| `nachunternehmer` | text | Name NU |
| `nu_email` | text | E-Mail NU |
| `datum_frist` | timestamptz | Frist |
| `datum_meldung` | timestamptz | Meldedatum |
| `fotos_mangel` | jsonb | Fotos vom Mangel |
| `fotos_nachweis_nu` | jsonb | Nachweis-Fotos (Multi) |
| `kommentar_nu` | text | Kommentar NU |
| `letzte_erinnerung_am` | timestamptz | Letzte Erinnerung |
| `erinnerung_count` | integer | Anzahl Erinnerungen |

### mangel_notifications

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | Primary Key |
| `mangel_id` | uuid | FK → maengel_fertigstellung |
| `notification_type` | text | new, reminder, nu_fixed, rejection, accepted |
| `recipient_type` | text | nu, bauleiter |
| `recipient_email` | text | E-Mail |
| `status` | text | pending, sent, failed |
| `sent_at` | timestamptz | Gesendet am |

---

## Edge Functions

| Function | Version | JWT | Aufruf | Beschreibung |
|----------|---------|-----|--------|--------------|
| `mangel-notify` | **v2** | Nein | **Trigger** | Zentrale E-Mail-Function (new, nu_fixed mit Fotos+Buttons, accepted) |
| `mangel-action` | **v1** | Nein | **Button-Klick** | Approve/Reject aus E-Mail, setzt Status im Portal |
| `mangel-rejection-notify` | v1 | Nein | **Trigger** | E-Mail bei Ablehnung + Zusatzkosten-Hinweis |
| `mangel-reminder` | v5 | Nein | Cron | 2-Tage-Erinnerungen (Gelb→Orange→Rot) |
| `mangel-overdue` | v1 | Nein | Cron | Setzt überfällige auf "(3) Überfällig" |

### Architektur (v6.0)

```
┌─────────────────────────────────────────────────────────────────┐
│  EREIGNIS-BASIERT (sofort via Trigger + pg_net)                 │
├─────────────────────────────────────────────────────────────────┤
│  Mangel erfasst    → trg_new_mangel          → mangel-notify    │
│  NU meldet behoben → trg_mangel_status_change → mangel-notify   │
│  BL nimmt ab       → trg_mangel_status_change → mangel-notify   │
│  BL lehnt ab       → trg_mangel_rejection     → mangel-rejection│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ZEIT-BASIERT (Cron Jobs)                                       │
├─────────────────────────────────────────────────────────────────┤
│  Erinnerungen      → mangel-reminder-job (alle 2 Tage 09:00)    │
│  Überfällig setzen → mangel-overdue-job  (täglich 00:30)        │
└─────────────────────────────────────────────────────────────────┘
```

### API-Aufrufe

```bash
# Erinnerungen manuell auslösen
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-reminder

# Überfällig-Check manuell
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-overdue

# Pending Notifications verarbeiten
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-notify
```

---

## Cron Jobs

| Job | Schedule | Beschreibung |
|-----|----------|--------------|
| `mangel-reminder-job` | `0 9 */2 * *` | Alle 2 Tage um 09:00 UTC (Erinnerungen) |
| `mangel-overdue-job` | `30 0 * * *` | Täglich um 00:30 UTC (Überfällig setzen) |

> **Hinweis v6.0:** Der `mangel-notify-job` wurde entfernt. E-Mails werden jetzt **sofort** via Trigger gesendet (kein 5-Minuten-Delay mehr).

```sql
-- Jobs anzeigen
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'mangel%';
```

---

## Trigger

| Trigger | Event | Function | Beschreibung |
|---------|-------|----------|--------------|
| `trg_mangel_auto_nr` | INSERT | `calculate_mangel_nr()` | mangel_nr generieren |
| `trg_new_mangel` | INSERT | `handle_new_mangel()` | E-Mail an NU (neuer Mangel) |
| `trg_mangel_status_change` | UPDATE | `handle_mangel_status_change()` | E-Mail bei Behoben/Abgenommen |
| `trg_mangel_rejection` | UPDATE | `handle_mangel_rejection()` | E-Mail + status_mangel_nu reset |

### Trigger-Logik (v6.0 - mit pg_net)

**trg_new_mangel:**
```sql
-- Bei INSERT: E-Mail an NU wenn nu_email vorhanden
INSERT INTO mangel_notifications (...) VALUES ('new', 'nu', ...);
-- SOFORT Edge Function aufrufen:
PERFORM net.http_post(
  url := '.../mangel-notify',
  body := jsonb_build_object('mangel_id', NEW.id, 'type', 'new')
);
```

**trg_mangel_status_change:**
```sql
-- Bei status_mangel_nu = '(1) Behoben': E-Mail an BL
INSERT INTO mangel_notifications (...) VALUES ('nu_fixed', 'bauleiter', ...);
PERFORM net.http_post(..., 'type', 'nu_fixed');

-- Bei status_mangel = '(4) Abgenommen': E-Mail an NU
INSERT INTO mangel_notifications (...) VALUES ('accepted', 'nu', ...);
PERFORM net.http_post(..., 'type', 'accepted');
```

**trg_mangel_rejection:**
```sql
-- Bei status_mangel = '(2) Nicht abgenommen':
-- 1. status_mangel_nu auf '(0) Offen' zurücksetzen
NEW.status_mangel_nu := '(0) Offen';
-- 2. E-Mail an NU mit Zusatzkosten-Hinweis
INSERT INTO mangel_notifications (...) VALUES ('rejection', 'nu', ...);
PERFORM net.http_post(..., 'mangel-rejection-notify');
```

> **Vorteil v6.0:** E-Mails werden **sofort** gesendet, nicht erst beim nächsten Cron-Lauf.

---

## Softr Integration

### Einzige aktive Tabelle

**Softr Table ID:** `J563LaZ43bZSQy` (Mängel nach Fertigstellung)
**Supabase Tabelle:** `maengel_fertigstellung`

### Feld-Mapping (vollständig)

| Softr Feld-ID | Supabase Spalte | Typ | Beschreibung |
|---------------|-----------------|-----|--------------|
| `1UqYa` | mangel_nr | TEXT | **NEU v7.2:** Mangel-ID (ATBS-XXX-M1), von Supabase gesetzt |
| `QEcc2` | projekt_nr | TEXT | ATBS-Nummer |
| `qxHu4` | nua_nr | TEXT | NU-Auftragsnummer |
| `ctNAI` | bauleiter | TEXT | Name BL |
| `4uDJM` | nachunternehmer | TEXT | Name NU |
| `FF4FP` | projektname_komplett | TEXT | Projektname |
| `4qiAo` | art_des_mangels | SELECT | Ausführung/Endabnahme/Gewährleistung |
| `YUT8c` | status_mangel | SELECT | Status BL |
| `mhgIW` | status_mangel_nu | SELECT | Status NU |
| `ozrIj` | beschreibung_mangel | LONG_TEXT | Beschreibung |
| `LQPDA` | kommentar_nu | LONG_TEXT | Kommentar NU |
| `aScwq` | fotos_mangel | ATTACHMENT | Fotos vom Mangel |
| `zBq5l` | fotos_nachweis_nu | ATTACHMENT | Nachweis-Fotos NU |
| `2la7j` | datum_meldung | DATETIME | Meldedatum |
| `aGWIf` | datum_frist | DATETIME | Frist |
| `3v0hM` | mangel_behoben_datum | DATETIME | Behoben am |
| `TFj9o` | nu_email | EMAIL | E-Mail NU |
| `bC4R6` | kunde_name | TEXT | Kundenname |
| `Nv4yH` | kunde_email | EMAIL | Kunden-E-Mail |
| `kgCJK` | kunde_telefon | PHONE | Kundentelefon |
| `jFILZ` | kosten | CURRENCY | Kosten |

---

## Troubleshooting

### E-Mails werden nicht gesendet

```sql
-- Pending Notifications prüfen
SELECT * FROM mangel_notifications
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Fehler prüfen
SELECT * FROM mangel_notifications
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Manuell verarbeiten
SELECT net.http_post(
  url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-notify',
  headers := '{}'::jsonb
);
```

### Mangel wird nicht auf Überfällig gesetzt

```sql
-- Prüfen welche überfällig sein sollten
SELECT id, mangel_nr, status_mangel, datum_frist
FROM maengel_fertigstellung
WHERE datum_frist < NOW()
  AND status_mangel IN ('(0) Offen', '(1) In Bearbeitung');

-- Manuell Edge Function aufrufen
SELECT net.http_post(
  url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-overdue',
  headers := '{}'::jsonb
);
```

### Trigger prüfen

```sql
-- Alle Trigger auf maengel_fertigstellung
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'maengel_fertigstellung'::regclass
AND tgname NOT LIKE 'RI_%';
```

---

## Changelog

| Version | Datum | Änderungen |
|---------|-------|------------|
| **v7.2** | 2026-01-26 | **Softr Mangel-ID schreibbar**: Feld `1UqYa` von FORMULA auf TEXT geändert. 26 Mängel mit `mangel_nr` aus Supabase befüllt. Script: `functions/scripts/set-mangel-id.ps1` |
| v7.1 | 2026-01-26 | **Bereinigung**: 18 Test-Einträge in Softr und 7 in Supabase gelöscht. Mängel-IDs neu generiert (Schema: ATBS-XXX-M1). BV-Feld für alle migrierten Mängel ausgefüllt. |
| v7.0 | 2026-01-26 | **Unified Mängel-Tabelle**: Alle 34 Ausführungsmängel in "Mängel nach Fertigstellung" migriert. Alte Tabelle "Ausführungsmängel" wird nicht mehr synchronisiert. |
| v6.1 | 2026-01-26 | **Approve/Reject-Buttons**: Bei "Behoben"-Meldung erhält BL E-Mail mit Nachweis-Fotos + Buttons (Abgenommen/Nicht abgenommen). `mangel-action` Edge Function für Button-Klicks. |
| v6.0 | 2026-01-26 | **Trigger-basierter E-Mail-Versand**: Alle Trigger rufen jetzt direkt via `pg_net.http_post()` die Edge Functions auf → E-Mails werden SOFORT gesendet (kein Cron-Delay mehr). |
| v5.0 | 2026-01-25 | Vollständige E-Mail-Abdeckung: new, nu_fixed, accepted, rejection. 4 Trigger, 4 Edge Functions |
| v4.0 | 2026-01-25 | 5 Status-Stufen, Überfällig-Check, Ablehnungs-Workflow |
| v3.0 | 2026-01-25 | mangel_nr (ATBS-XXX-M1), Trigger |
| v2.0 | 2026-01-25 | Farbliche Status-Boxen, Schlussrechnungs-Hinweis |
| v1.0 | 2026-01-25 | Unified Tabelle, 2-Tage-Erinnerungen |

---

*Dokumentation aktualisiert am 2026-01-26 (v7.1 - Bereinigung und Mängel-IDs)*
