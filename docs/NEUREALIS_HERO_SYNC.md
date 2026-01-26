# Hero Software → Softr Document Sync

**Letzte Aktualisierung:** 2026-01-26
**Status:** AKTIV (Cron alle 15 Minuten)

---

## Übersicht

Automatischer Sync von Dokumenten aus Hero Software nach Softr.io:
- Rechnungen, Angebote, Auftragsbestätigungen, NUAs, Kalkulationen, etc.
- Intelligente Dokumenttyp-Erkennung
- Duplikat-Prüfung für Rechnungen
- Revisions-Support für andere Dokumente

---

## Edge Function

| Eigenschaft | Wert |
|-------------|------|
| **Name** | `hero-document-sync` |
| **URL** | `https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/hero-document-sync` |
| **Cron** | `*/15 * * * *` (alle 15 Minuten) |
| **Dry-Run** | `?dry_run=true` |

---

## Hero API

| Eigenschaft | Wert |
|-------------|------|
| **Endpoint** | `https://login.hero-software.de/api/external/v7/graphql` |
| **API Key** | `ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz` |
| **Auth** | `Authorization: Bearer {API_KEY}` |

### GraphQL Query

```graphql
{
  customer_documents(first: 500, offset: 0) {
    id
    nr
    type
    value      # Netto-Betrag
    vat        # MwSt
    date
    status_name
    project_match_id
  }
}
```

### Hero Dokumenttypen

| Hero Type | Beschreibung | Anzahl (ca.) |
|-----------|--------------|--------------|
| `offer` | Angebote | 488 |
| `invoice` | Rechnungen | 351 |
| `measurement` | NUA/Aufmaß | 310 |
| `generic` | Sonstiges | 275 |
| `confirmation` | Auftragsbestätigung | 163 |
| `reversal_invoice` | Storno | 44 |
| `invoice_notice` | Avis | 25 |
| `letter` | Brief | 11 |
| `calculation` | Kalkulation | 6 |
| `delivery_note` | Lieferschein | 5 |

---

## Dokumenttyp-Logik

### Mapping Hero → Softr

| Hero Type | Softr Art des Dokuments |
|-----------|-------------------------|
| `invoice` (RE-*) | AR-S / AR-A / AR-X (siehe Logik) |
| `invoice` (andere) | ER-NU-S (Eingangsrechnung NU) |
| `offer` | ANG-Ku Angebot Kunde |
| `confirmation` | AB Auftragsbestaetigung |
| `measurement` | NUA-S NU-Auftrag Schluss |
| `calculation` | KALK Kalkulation |
| `reversal_invoice` | AR-X Ausgangsrechnung - Storno |
| `letter` | BRIEF Brief |
| `delivery_note` | LS Lieferschein |
| `invoice_notice` | AVIS Avis |

### Rechnungs-Logik (AR-A / AR-S / AR-X)

```
FÜR JEDE RECHNUNG (RE-*):

1. STORNO?
   └─ Betrag (netto) < 0 → AR-X (Storno)

2. PROJEKT-PHASE? (aus Monday.com)
   └─ Phase 5 → AR-S (Schlussrechnung)
   └─ Phase 4 → AR-A (Abschlagsrechnung)

3. FALLBACK (höchste RE-Nummer)
   └─ Höchste RE-Nr für ATBS → AR-S (Schluss)
   └─ Alle anderen → AR-A (Abschlag)
```

### Kundenspezifische Regeln (GWS/Privat)

Nur für GWS und Privatkunden gilt:
- Letzte (höchste) Rechnungsnummer = AR-S (Schluss)
- Alle davor = AR-A (Abschlag)
- Negative Beträge = AR-X (Storno)

---

## Duplikat-Prüfung

| Dokumenttyp | Verhalten |
|-------------|-----------|
| **Rechnungen (RE-*)** | Nicht erneut hochladen wenn bereits in Softr |
| **Angebote (ANG-*)** | Update erlaubt (Revisionen) |
| **Auftragsbestätigungen (AB-*)** | Update erlaubt (Revisionen) |
| **NUAs (NUA-*)** | Update erlaubt (Revisionen) |
| **Andere** | Update erlaubt |

---

## Softr Feld-Mapping

| Softr Feld | Feld-ID | Hero Quelle |
|------------|---------|-------------|
| Dokument-Nr | `8Ae7U` | `nr` |
| Art des Dokuments | `6tf0K` | Logik-basiert |
| Betrag (netto) | `QuHkO` | `value` |
| Betrag (brutto) | `kukJI` | `value + vat` |
| Datum erstellt | `DAXGa` | `date` |
| NUA-Nr | `7xrdk` | `nr` (wenn NUA-*) |
| ATBS-Nr | `GBc7t` | aus Projekt |
| Notizen | `iHzHD` | Import-Timestamp |

---

## Sync-Statistiken (Stand: 2026-01-26)

| Metrik | Wert |
|--------|------|
| Hero-Dokumente (ab 2025) | 639 |
| Softr-Dokumente | 1.166 |
| Sync-Intervall | 15 Minuten |

### Manueller Sync

```bash
# Dry-Run (keine Änderungen)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/hero-document-sync?dry_run=true"

# Echter Sync
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/hero-document-sync"
```

---

## Logging

Sync-Logs werden in `hero_sync_log` gespeichert:

```sql
SELECT * FROM hero_sync_log ORDER BY started_at DESC LIMIT 10;
```

| Spalte | Beschreibung |
|--------|--------------|
| `started_at` | Start-Zeitpunkt |
| `completed_at` | Ende-Zeitpunkt |
| `total_fetched` | Hero-Dokumente abgerufen |
| `created` | Neu erstellt in Softr |
| `updated` | Aktualisiert in Softr |
| `skipped_duplicates` | Übersprungene Rechnungen |
| `errors` | Fehler-Array |
| `status` | running / completed / failed |

---

## Manuelle Korrekturen (2026-01-26)

### Durchgeführte Bereinigungen

| Aktion | Anzahl |
|--------|--------|
| Rechnungs-Beträge (Netto) synchronisiert | 23 |
| Rechnungs-Beträge (Brutto) ergänzt | 248 |
| Angebote neu erstellt | 176 |
| Auftragsbestätigungen neu erstellt | 75 |
| NUAs neu erstellt | 62 |
| NUAs Beträge aktualisiert | 68 |
| Erstelldaten synchronisiert | 139 |
| Storno-Rechnung (AR-X) korrigiert | 1 |
| GWS/Privat AR-A/AR-S korrigiert | 3 |
| Falscher Dokumenttyp korrigiert | 1 (RE0257 NUA-A → ER-NU-S) |

### Storno-Typ (neu)

- **AR-X** = Ausgangsrechnung - Storno (neurealis stellt Storno)
- **ER-X** = Eingangsrechnung - Storno (NU stellt Storno)

---

## Abhängigkeiten

- Hero Software API (GraphQL)
- Softr.io Tables API
- Monday.com (für Projekt-Phase, optional)
- Supabase pg_cron Extension

---

*Erstellt am 2026-01-26*
