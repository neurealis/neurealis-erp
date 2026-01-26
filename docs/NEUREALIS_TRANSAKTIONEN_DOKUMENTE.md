# Zahlungsabgleich (ER-Zahl / AR-Zahl)

**Letzte Aktualisierung:** 2026-01-25

---

## Status: TRIGGER-BASIERT (ressourceneffizient)

### Architektur

| Komponente | Status | Beschreibung |
|------------|--------|--------------|
| Cron-Job | **Deaktiviert** | War: alle 15 Min (ineffizient) |
| Trigger INSERT | **Aktiv** | `trg_payment_reconciliation_on_insert` |
| Trigger UPDATE | **Aktiv** | `trg_payment_reconciliation_on_update` |

**Vorteil:** Verarbeitung erfolgt **sofort bei INSERT** eines neuen ER-Zahl/AR-Zahl Dokuments, nicht mehr periodisch.

### Aktueller Stand

| Typ | Gesamt | Mit ATBS | Ohne ATBS | Zugeordnet |
|-----|--------|----------|-----------|------------|
| **ER-Zahl** | 829 | 163 | 666 | 19,7% |
| **AR-Zahl** | 194 | 107 | 87 | 55,2% |

---

## Funktionsweise

### Matching-Logik (Priorisiert)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VERWENDUNGSZWECK / BETRAG                        │
│          "ReNr RE20260161, Sanierung ATBS-421, Cimbernstr..."      │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐
│   PRIORITÄT 1     │  │   PRIORITÄT 2     │  │   PRIORITÄT 3         │
│   ATBS direkt     │  │   RE-Nr Fallback  │  │   Betrags-Matching    │
├───────────────────┤  ├───────────────────┤  ├───────────────────────┤
│                   │  │                   │  │                       │
│  Regex:           │  │  Regex:           │  │  Betrag der Zahlung   │
│  ATBS[- ]?(\d{3,4})│  │  RE[- ]?(00\d{5}) │  │  = Brutto der Rechnung│
│                   │  │  RE[- ]?(\d{8})   │  │                       │
│  "ATBS-421"       │  │  RE(\d{4})        │  │  NUR wenn eindeutig!  │
│  → Sofort ATBS    │  │  → Rechnung → ATBS│  │  (1 Betrag = 1 RE)    │
└───────────────────┘  └───────────────────┘  └───────────────────────┘
```

### Trigger-Ablauf

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│ Neues Doku-  │     │         trg_reconcile_payment_document()     │
│ ment eingefügt│────▶│                                              │
│ (ER-Zahl/    │     │  1. Prüfe: ATBS bereits vorhanden?           │
│  AR-Zahl)    │     │     → JA: Abbruch                            │
│              │     │     → NEIN: Weiter                           │
└──────────────┘     │                                              │
                     │  2. ATBS direkt suchen (Priorität 1)         │
                     │     "ATBS-421" im Verwendungszweck           │
                     │                                              │
                     │  3. RE-Nr Fallback (Priorität 2)             │
                     │     RE-Nr → Rechnung → ATBS                  │
                     │                                              │
                     │  4. ATBS zuweisen + Rechnung aktualisieren   │
                     └──────────────────────────────────────────────┘
```

### Zahlungsbeträge aggregieren

Für jede Rechnung werden alle verknüpften Zahlungen (ER-Zahl/AR-Zahl) summiert:

```sql
betrag_bezahlt = SUM(ABS(zahlung_betrag))
betrag_offen = MAX(0, betrag_brutto - betrag_bezahlt)
```

### Zahlungsstatus automatisch setzen

| Bedingung | Status |
|-----------|--------|
| `betrag_bezahlt >= betrag_brutto` | **(5) Bezahlt** |
| `betrag_bezahlt > 0` | **(2) Teilzahlung** |
| Sonst | Unverändert |

---

## Datenbank-Funktionen

### Trigger-Funktionen (automatisch)

| Funktion | Beschreibung |
|----------|--------------|
| `trg_reconcile_payment_document()` | Trigger bei INSERT auf softr_dokumente |
| `trg_update_invoice_on_payment_assigned()` | Trigger bei UPDATE von atbs_nr |
| `reconcile_single_payment_document(uuid)` | Verarbeitet ein einzelnes Dokument |
| `update_invoice_payment_status(text)` | Aktualisiert Zahlungsstatus einer Rechnung |

### Direkte ATBS-Matching (Priorität 1)

| Funktion | Beschreibung |
|----------|--------------|
| `match_ar_zahl_direct_atbs()` | AR-Zahl direkt über ATBS im Verwendungszweck |
| `match_er_zahl_direct_atbs()` | ER-Zahl direkt über ATBS im Verwendungszweck |

### RE-Nr Fallback (Priorität 2)

| Funktion | Beschreibung |
|----------|--------------|
| `match_ar_zahl_to_rechnung()` | AR-Zahl über RE-Nr mit Ausgangsrechnung (AR-S, AR-A) |
| `match_er_zahl_to_rechnung()` | ER-Zahl über RE-Nr mit Eingangsrechnung NU (ER-NU-S, ER-NU-A) |

### Betrags-Matching (Priorität 3)

| Funktion | Beschreibung |
|----------|--------------|
| `match_ar_zahl_by_amount()` | AR-Zahl über eindeutigen Betrag (1 Betrag = 1 Rechnung) |
| `match_er_zahl_by_amount()` | ER-Zahl über eindeutigen Betrag (nur sichere Matches) |

### Aggregation & Statistik

| Funktion | Beschreibung |
|----------|--------------|
| `aggregate_payments_to_invoices()` | Zahlungen auf Rechnungen aggregieren |
| `run_payment_reconciliation()` | Manueller Komplett-Abgleich (für Batch) |
| `get_payment_reconciliation_stats()` | Statistiken abrufen |

---

## Manueller Aufruf

```sql
-- Einzelnes Dokument manuell verarbeiten
SELECT reconcile_single_payment_document('uuid-hier');

-- Komplett-Abgleich (Batch, z.B. nach Migration)
SELECT run_payment_reconciliation();

-- Statistiken
SELECT * FROM get_payment_reconciliation_stats();

-- Direkte ATBS-Matches prüfen
SELECT * FROM match_ar_zahl_direct_atbs();
SELECT * FROM match_er_zahl_direct_atbs();

-- RE-Nr Fallback-Matches prüfen
SELECT * FROM match_ar_zahl_to_rechnung();
SELECT * FROM match_er_zahl_to_rechnung();
```

---

## Warum viele ohne ATBS bleiben

Viele ER-Zahl/AR-Zahl Dokumente gehören zu **keinem Bauprojekt**:

- **Betriebskosten:** ADWORDS, Amazon, Avis, Versicherung, Leasing
- **Sozialabgaben:** Krankenkasse, Rentenversicherung, Beiträge
- **Interne Transfers:** neurealis GmbH Umbuchungen, Ausgleich
- **Ohne Kontext:** Ältere Zahlungen ohne RE-Nr/ATBS im Verwendungszweck

Diese brauchen keine ATBS-Nr und werden ignoriert.

---

## Datenbank-Details

| Tabelle | Beschreibung |
|---------|--------------|
| `konto_transaktionen` | Bank-Transaktionen (aus Softr) |
| `softr_dokumente` | Alle Dokumente inkl. ER-Zahl, AR-Zahl, Rechnungen |
| `payment_reconciliation_log` | Protokoll der Batch-Abgleich-Läufe |

**Supabase Projekt:** `mfpuijttdgkllnvhvjlu` (neurealis ERP)

---

## Dokumentation für Buchhaltung

Für die Buchhaltung gibt es eine separate, nicht-technische Dokumentation:

| Datei | Beschreibung |
|-------|--------------|
| `ZAHLUNGSABGLEICH_BUCHHALTUNG.md` | Markdown-Version |
| `ZAHLUNGSABGLEICH_BUCHHALTUNG.html` | HTML (druckbar als PDF) |
| `ZAHLUNGSABGLEICH_BUCHHALTUNG.pdf` | PDF-Version |

**Storage:** Auch im Supabase Storage verfügbar unter `softr-files/zahlungsabgleich/`

---

## Changelog

| Datum | Änderung |
|-------|----------|
| 2026-01-25 | **Buchhaltungs-Doku:** PDF/HTML für Tobias erstellt und versendet |
| 2026-01-25 | **Betrags-Matching:** Priorität 3 - eindeutige Beträge matchen |
| 2026-01-25 | **Trigger-basiert:** Cron-Job deaktiviert, INSERT-Trigger aktiv |
| 2026-01-25 | **Direkte ATBS-Suche:** Priorität 1 vor RE-Nr Fallback |
| 2026-01-25 | Initiale Automatisierung mit Cron-Job |

---

*Dokumentation aktualisiert: 2026-01-25 - Umstellung auf Trigger-basierte Verarbeitung*
