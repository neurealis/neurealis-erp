# CLAUDE.md - neurealis ERP

**Letzte Aktualisierung:** 2026-01-26
**Projekt:** neurealis ERP - Wohnungssanierung
**Portal:** https://neurealis.softr.app

---

## Projekt-Übersicht

neurealis ERP ist das Backend-System für die Wohnungssanierung der neurealis GmbH:
- **SvelteKit UI** als neues Frontend (ersetzt langfristig Softr.io)
- Softr.io als No-Code Frontend (Migration geplant)
- Monday.com für Projektmanagement
- Supabase als Backend (DB, Auth, Edge Functions)
- Telegram Bot für Baustellen-Kommunikation
- Hero Software für Leistungsverzeichnis

---

## Supabase

| Eigenschaft | Wert |
|-------------|------|
| **Projekt-ID** | `mfpuijttdgkllnvhvjlu` |
| **URL** | `https://mfpuijttdgkllnvhvjlu.supabase.co` |
| **Dashboard** | https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu |

**MCP-Integration:** Supabase MCP Server mit Personal Access Token ist konfiguriert.
- **SQL-Migrationen direkt via MCP ausführen** - kein manuelles UI nötig!
- Nutze `mcp__supabase__apply_migration` für DDL-Operationen
- Nutze `mcp__supabase__execute_sql` für Queries

---

## Komponenten-Status

| Komponente | Status | Details |
|------------|--------|---------|
| Supabase Backend | Aktiv | 30 Tabellen, Edge Functions, Cron Jobs |
| Softr.io Frontend | Aktiv | No-Code Portal, 16 Tabellen, 725+ Felder |
| Monday.com Sync | Aktiv | Bauprozess-Board, 193 Items |
| File Sync | Aktiv | 910 Dateien (~333 MB) |
| **Nachtragsmanagement** | **Fertig** | v17: HTML-Template, Graph API, Auto-E-Mails |
| **Mängelmanagement** | **Fertig** | v6.1: Trigger-basiert, Approve/Reject-Buttons |
| **Kontaktmanagement** | **Fertig** | v1.0: 5 Tabellen, 3 Sync-Functions (Hero, Monday, MS365) |
| **Hero Document Sync** | **Fertig** | v1.0: Cron alle 15 Min, 639 Dokumente, Dokumenttyp-Logik |
| **Bestellsystem** | **In Entwicklung** | SvelteKit UI, mehrsprachige KI-Eingabe |
| Telegram Bot | Konfiguriert | Separater Bot (nicht @LifeOps2026Bot) |

---

## Angebundene Services

| Service | Account/Config | Details |
|---------|----------------|---------|
| **Supabase** | mfpuijttdgkllnvhvjlu | PostgreSQL, Auth, Storage, Edge Functions |
| **Softr.io** | neurealis.softr.app | No-Code Portal |
| **Monday.com** | neurealis.monday.com | Bauprozess-Board |
| **Microsoft 365** | holger.neumann@neurealis.de | Graph API, Ordner: /neurealis/* |
| **Google Cloud** | holger.neumann@neurealis.de | Contacts, Calendar |
| **Hero Software** | GWS Preissync | Leistungsverzeichnis |
| **Netlify** | neurealis-* Sites | UI Hosting |
| **Telegram Bot** | Separater Bot | Baustellen-Kommunikation |

### E-Mail Accounts (neurealis)

| Adresse | Verwendung |
|---------|------------|
| holger.neumann@neurealis.de | Hauptkonto |
| kontakt@neurealis.de | Allgemein |
| rechnungen@neurealis.de | Eingangsrechnungen |
| bewerbungen@neurealis.de | HR |
| auftraege@neurealis.de | Aufträge |
| + weitere freigegebene Postfächer | |

---

## Hero Software (GWS Preissync)

| Eigenschaft | Wert |
|-------------|------|
| **Endpoint** | `https://login.hero-software.de/api/external/v7/graphql` |
| **API Key** | `ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz` |
| **Auth** | `Authorization: Bearer {API_KEY}` |

### Hero Document Sync (NEU)

**Edge Function:** `hero-document-sync` (Cron alle 15 Min)

**Dokumenttyp-Logik:**
- Storno (negativer Betrag) → AR-X / ER-X
- Rechnung + Phase 5 → AR-S (Schluss)
- Rechnung + Phase 4 → AR-A (Abschlag)
- Fallback: Höchste RE-Nr → AR-S, andere → AR-A
- Angebote → ANG-Ku, AB → AB, NUA → NUA-S

**Duplikat-Prüfung:**
- Rechnungen: Nicht erneut hochladen
- Andere (ANG, AB, NUA): Update erlaubt (Revisionen)

> Details: `docs/NEUREALIS_HERO_SYNC.md`

---

## SvelteKit UI (neues Frontend)

| Eigenschaft | Wert |
|-------------|------|
| **GitHub** | https://github.com/neurealis/neurealis-erp |
| **Netlify URL** | https://neurealis-erp.netlify.app |
| **Pfad** | `ui/` |
| **Framework** | SvelteKit mit TypeScript |

**Entwicklung:**
```bash
cd ui && npm run dev    # Lokaler Dev-Server auf http://localhost:5173
```

**Deployment:** Nur auf explizite Anweisung via `netlify deploy --prod`

**Design-System:**
- `ui/src/lib/styles/tokens.css` - Zentrale Design-Variablen
- `ui/src/lib/styles/global.css` - Globale Styles

**Bestellformular:**
- Nur Textbox (keine UI-Spracherkennung)
- Nutzer verwenden Google-Tastatur-Spracheingabe am Handy
- Mehrsprachige Texte (DE, HU, RU, RO) werden im Backend geparst
- Edge Function `parse-bestellung` nutzt gpt-5.2 für KI-Parsing

---

## Wichtige Pfade

| Pfad | Beschreibung |
|------|--------------|
| `ui/` | SvelteKit Frontend (NEU) |
| `functions/` | Edge Functions (Supabase) |
| `functions/supabase/functions/` | Deno Functions |
| `docs/` | Dokumentation |

---

## Aktuelle Statistiken

| Komponente | Anzahl | Details |
|------------|--------|---------|
| **Tabellen** | 25 | + 2 Views |
| **RPC Functions** | 14 | Supabase Server-Funktionen |
| **LV-Positionen** | 1.572 | Leistungsverzeichnis |
| **Monday Items** | 193 | Bauprozess-Board |
| **Matterport Spaces** | 25 | 3D-Scans |
| **Nachträge** | 3 | Trigger-basiert |
| **Mängel (unified)** | 57 | 34 Ausführung + 23 Fertigstellung |
| **File Sync** | 910 | Synced Files |
| **Konto-Transaktionen** | 1.051 | 100% mit Softr synced |
| **Softr Dokumente** | 1.166 | Hero-Sync aktiv (ANG, AB, NUA, RE) |
| **Hero Dokumente** | 639 | Ab 2025, alle 15 Min synchronisiert |

---

## Quick Links

- **Softr Portal:** https://neurealis.softr.app
- **Monday.com:** https://neurealis.monday.com
- **Supabase Dashboard:** https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| `docs/NEUREALIS_ERP.md` | Hauptdokumentation |
| `docs/NEUREALIS_SUPABASE_SCHEMA.md` | Detailliertes DB-Schema |
| `docs/NEUREALIS_KONTAKTE.md` | **Kontaktmanagement-System** |
| `docs/SOFTR_SCHEMA.md` | Softr.io Tabellen & Felder |
| `docs/SOFTR_SUPABASE_MIGRATION.md` | Migration & Sync-Status |
| `docs/NEUREALIS_MAENGELMANAGEMENT.md` | Mängel-System |
| `docs/NEUREALIS_TRANSAKTIONEN_DOKUMENTE.md` | Zahlungsabgleich |
| `docs/NEUREALIS_HERO_SYNC.md` | **Hero → Softr Document Sync** |

---

*Erstellt am 2026-01-26*
