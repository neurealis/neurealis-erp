# Rechnungserinnerungen - neurealis ERP

**Erstellt:** 2026-02-05
**Status:** ✅ Aktiv

---

## Übersicht

Automatische E-Mail-Erinnerungen für die Buchhaltung zur Erstellung von Rechnungen.

| Typ | Trigger | Empfänger | Pro Projekt |
|-----|---------|-----------|-------------|
| **Abschlagsrechnung** | Cron (7 Tage nach Baustart) | buchhaltung@neurealis.de | 1x |
| **Schlussrechnung** | DB-Trigger (Phase 5) | buchhaltung@ + bauleitung@ | 1x |

---

## 1. Abschlagsrechnung-Erinnerung

### Bedingungen
- Phase = `(4) Umsetzung`
- Baustart vor genau 7 Tagen
- `Teil-Rechnung Kunde | Vereinbart` = "Ja" (Monday-Spalte `status_mkm1nqts`)
- Noch keine Erinnerung gesendet

### Trigger
**Cron-Job:** `invoice-reminder-daily`
- Schedule: `0 6 * * *` (täglich 7:00 MEZ)
- Edge Function: `invoice-reminder`

### E-Mail-Inhalt
```
An: buchhaltung@neurealis.de
Betreff: Erinnerung: Abschlagsrechnung erstellen - [Projektname]

Hallo Hannah,

das BV: [Projektname] hat begonnen.

Dies ist eine freundliche Erinnerung, die Teil-Rechnung zu erstellen.

Link zu HERO: [Hero-Link]
Abschlagszahlung: [X]%

Vielen Dank
Holger
```

---

## 2. Schlussrechnung-Erinnerung

### Bedingungen
- Status wechselt auf Phase `(5)` (Rechnungsstellung)
- Noch keine Erinnerung gesendet

### Trigger
**DB-Trigger:** `trg_schlussrechnung_reminder`
- Function: `notify_schlussrechnung()`
- Feuert: Bei UPDATE von `status_projekt` auf `monday_bauprozess`

### E-Mail-Inhalt
```
An: buchhaltung@neurealis.de, bauleitung@neurealis.de
Betreff: Erinnerung: Schlussrechnung erstellen - [Projektname]

Hallo zusammen,

das BV: [Projektname] ist nun in Phase (5) Rechnungsstellung.

Bitte die Schlussrechnung erstellen.

Link zu HERO: [Hero-Link]
Bauportal: [SharePoint-Link]

Vielen Dank
Holger
```

---

## Technische Details

### Tabellen

#### `invoice_reminder_log`
Verhindert doppelte Erinnerungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primary Key |
| projekt_id | TEXT | Monday Item ID |
| projektname | TEXT | Projektname |
| reminder_type | TEXT | 'abschlag' oder 'schlussrechnung' |
| sent_to | TEXT | Empfänger-Adressen |
| sent_at | TIMESTAMPTZ | Zeitpunkt |

**Constraint:** `UNIQUE (projekt_id, reminder_type)` - Pro Projekt nur 1x pro Typ

### Monday-Spalten (column_values)

| Spalten-ID | Bedeutung |
|------------|-----------|
| `status_mkm1nqts` | Teil-Rechnung Kunde \| Vereinbart (Ja/Nein) |
| `zahlen0__1` | Teil-Rechnung Kunde \| % Abschlag |

### Edge Functions

| Function | Zweck |
|----------|-------|
| `invoice-reminder` | Abschlagsrechnung-Prüfung (Cron) |
| `email-send` | E-Mail-Versand via MS Graph API |

### DB-Funktionen

| Function | Zweck |
|----------|-------|
| `notify_schlussrechnung()` | Schlussrechnung-Trigger |

---

## Cron-Jobs

```sql
-- Aktive Jobs anzeigen
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%invoice%';
```

| Job | Schedule | Beschreibung |
|-----|----------|--------------|
| `invoice-reminder-daily` | `0 6 * * *` | Täglich 7:00 MEZ |

---

## Manueller Test

### Abschlagsrechnung testen
```bash
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/invoice-reminder \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json"
```

### Schlussrechnung testen
```sql
-- Projekt auf Phase 5 setzen (löst Trigger aus)
UPDATE monday_bauprozess
SET status_projekt = '(5) Rechnungsstellung'
WHERE id = '[PROJEKT_ID]';
```

### Log prüfen
```sql
SELECT * FROM invoice_reminder_log ORDER BY sent_at DESC LIMIT 10;
```

---

## Fehlerbehebung

### E-Mail wurde nicht gesendet
1. Prüfe `invoice_reminder_log` - bereits gesendet?
2. Prüfe Bedingungen (Phase, Vereinbart-Status, Baustart-Datum)
3. Prüfe Edge Function Logs im Supabase Dashboard

### Erinnerung erneut senden
```sql
-- Log-Eintrag löschen (VORSICHT!)
DELETE FROM invoice_reminder_log
WHERE projekt_id = '[PROJEKT_ID]'
AND reminder_type = 'abschlag';
```

---

## Änderungshistorie

| Datum | Änderung |
|-------|----------|
| 2026-02-05 | Initial: Abschlag (Cron) + Schlussrechnung (Trigger) |
