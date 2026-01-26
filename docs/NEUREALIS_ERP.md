# neurealis ERP - Vollständige Dokumentation

**Letzte Aktualisierung:** 2026-01-26 (Mängelmanagement v6.1: Trigger-basiert, Approve/Reject-Buttons, Fotos in E-Mail)

---

## Inhaltsverzeichnis

1. [Projekt-Übersicht](#projekt-übersicht)
2. [Infrastruktur](#infrastruktur)
3. [API-Credentials](#api-credentials-neurealis-erp)
4. [Datenbank-Schema](#datenbank-schema)
5. [Edge Functions](#edge-functions)
6. [Externe Integrationen](#externe-integrationen)
7. [Nachtragsmanagement](#nachtragsmanagement)
8. [Mängelmanagement](#mängelmanagement)
9. [API-Referenz](#api-referenz)
10. [Troubleshooting](#troubleshooting)

---

## Projekt-Übersicht

### Beschreibung

neurealis ERP ist das Backend-System für die Wohnungssanierung der neurealis GmbH. Es integriert:
- Softr.io als No-Code Frontend
- Monday.com für Projektmanagement
- Supabase als Backend (DB, Auth, Edge Functions)
- Telegram Bot für Baustellen-Kommunikation

### Projekt-Verbindungen

| Projekt | Ref | Status | Beschreibung |
|---------|-----|--------|--------------|
| **ERP** | `mfpuijttdgkllnvhvjlu` | **Aktiv** | Wohnungssanierung ERP (Default) |
| Immobilien | `xqtqyqdqcxyjdkiazezs` | Inaktiv/DNS | Immobilienverwaltung |
| Privat | `zapfwqzmwshwebgnftty` | Inaktiv/DNS | Private Projekte |
| Management | `jvudihyndyhoxljewtde` | Inaktiv/DNS | Administration |

### Quick Links

| Ressource | URL |
|-----------|-----|
| Supabase Dashboard | https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu |
| REST API | https://mfpuijttdgkllnvhvjlu.supabase.co/rest/v1 |
| Softr Portal | https://neurealis.softr.app |
| Monday.com Board | https://neurealis.monday.com |

### Aktuelle Statistiken (Stand: 2026-01-26)

| Komponente | Anzahl | Details |
|------------|--------|---------|
| **Tabellen** | 25 | + 2 Views + 1 neue (mangel_notifications) |
| **RPC Functions** | 14 | Supabase Server-Funktionen |
| **LV-Positionen** | 1.572 | Leistungsverzeichnis |
| **Monday Items** | 193 | Bauprozess-Board |
| **Matterport Spaces** | 25 | 3D-Scans |
| **Bedarfsanalysen** | 22 | 21 needs_review, 1 pending |
| **Nachträge** | 3 | Trigger-basiert, Approve/Reject Buttons |
| **Mängel (unified)** | 57 | 34 Ausführung + 23 Fertigstellung, 2-Tage-Erinnerungen |
| **File Sync** | 910 | Synced Files |
| **Konto-Transaktionen** | 1.051 | **100% mit Softr synced** (seit 25.01.2026) |
| **ER-Zahl/AR-Zahl Dokumente** | 284 | Aus hist. Transaktionen (<28.05.2025) erstellt |

### Zahlungsabgleich (ER-Zahl / AR-Zahl)

> **Dokumentation:** [NEUREALIS_TRANSAKTIONEN_DOKUMENTE.md](./NEUREALIS_TRANSAKTIONEN_DOKUMENTE.md)

**Status:** TRIGGER-BASIERT (seit 2026-01-25)

| Typ | Gesamt | Mit ATBS | Zugeordnet |
|-----|--------|----------|------------|
| ER-Zahl | 829 | 163 | 19,7% |
| AR-Zahl | 194 | 107 | 55,2% |

**Architektur:** Trigger bei INSERT auf `softr_dokumente` (ressourceneffizient, kein Cron-Job)

**Matching-Logik (priorisiert):**
1. **Priorität 1:** ATBS direkt aus Verwendungszweck (`ATBS-421`)
2. **Priorität 2:** RE-Nr → Rechnung → ATBS übernehmen
3. **Priorität 3:** Betrags-Matching (Zahlung = Rechnung, nur eindeutige)
4. Zahlungsbeträge auf Rechnungen aggregieren, Status setzen

**Trigger:**
- `trg_payment_reconciliation_on_insert` - Bei neuem ER-Zahl/AR-Zahl Dokument
- `trg_payment_reconciliation_on_update` - Bei ATBS-Zuweisung → Rechnung aktualisieren

### Telegram Bot Status

| Eigenschaft | Wert |
|-------------|------|
| Bot | Konfiguriert (State-Tabelle existiert) |
| Aktive Sessions | 0 |
| telegram-webhook | v33 (dokumentiert) |
| Modi | bedarfsanalyse, aufmass, review, edit, remap |

---

## Infrastruktur

### Supabase

| Eigenschaft | Wert |
|-------------|------|
| **Projekt-ID** | `mfpuijttdgkllnvhvjlu` |
| **URL** | `https://mfpuijttdgkllnvhvjlu.supabase.co` |
| **Dashboard** | https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu |
| **Region** | eu-west-1 |

---

## Weitere Dokumentation

| Datei | Inhalt |
|-------|--------|
| [NEUREALIS_SUPABASE_SCHEMA.md](./NEUREALIS_SUPABASE_SCHEMA.md) | Detailliertes DB-Schema |
| [SOFTR_SCHEMA.md](./SOFTR_SCHEMA.md) | Softr.io Tabellen & Felder |
| [SOFTR_SUPABASE_MIGRATION.md](./SOFTR_SUPABASE_MIGRATION.md) | Migration & Sync-Status |
| [NEUREALIS_MAENGELMANAGEMENT.md](./NEUREALIS_MAENGELMANAGEMENT.md) | Mängel-System |
| [NEUREALIS_TRANSAKTIONEN_DOKUMENTE.md](./NEUREALIS_TRANSAKTIONEN_DOKUMENTE.md) | Zahlungsabgleich |
| [NEUREALIS_GROSSHAENDLER.md](./NEUREALIS_GROSSHAENDLER.md) | Großhändler-Integration |
| [MATERIALVORGABE_ANLEITUNG.md](./MATERIALVORGABE_ANLEITUNG.md) | Material-Workflow |

---

*Reorganisiert am 2026-01-26*
