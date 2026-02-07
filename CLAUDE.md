# CLAUDE.md - neurealis ERP

```
╔══════════════════════════════════════════════════════════════════╗
║  ⚠️ WICHTIG: Globale Regeln beachten!                            ║
║                                                                  ║
║  ZUSÄTZLICH zu dieser Datei gilt IMMER:                          ║
║  → C:\Users\holge\CLAUDE.md (globale Regeln)                     ║
║  → C:\Users\holge\docs\ (globale Wissens-Dateien)                ║
║  → C:\Users\holge\wissen\ (globales Wissen)                      ║
║                                                                  ║
║  /pre und /post lesen BEIDE: global + projekt                    ║
╚══════════════════════════════════════════════════════════════════╝
```

**Letzte Aktualisierung:** 2026-02-05
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
| **Hero LV Sync** | **Fertig** | v7: Kategorie, EK+Listenpreis, 2.028 Positionen |
| **Bestellsystem** | **In Entwicklung** | SvelteKit UI, mehrsprachige KI-Eingabe |
| **Rechnungserinnerung** | **Fertig** | Abschlag (Cron 7d) + Schlussrechnung (Trigger) |
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

### Marketing & Analytics

| Service | ID | Details |
|---------|-----|---------|
| **Google Marketing Platform** | `WYNbqcgpQW-4aKG6Ev4R5w` | Organisation: neurealis GmbH |
| **Google Ads** | `701-532-3684` | neurealis GmbH (aktiv) |
| **Google Ads MCC** | `192-718-7833` | Verwaltungskonto (wird eingerichtet) |
| **Google Tag Manager** | `GTM-MPNTT5L6` | Account: 6274929090, Container: 209549337 |
| **Meta Business** | `107280884964000` | ⏳ Verifizierung ausstehend |
| **GA4 Konto** | `256407471` | neurealis Marketing |
| **GA4 Property** | `352559138` | neurealis Marketing (aktiv) |
| **GA4 Property (alt)** | `312966090` | neurealis.de (inaktiv) |

**Marketing-Account:** marketing@neurealis.de (GTM Veröffentlichen, GA4 Admin)
**Marketing-Agentur:** Optimerch (optimerch.connect.100@gmail.com) - Lesezugriff

**Links:**
- Meta Security Center: https://business.facebook.com/latest/settings/security_center/?business_id=107280884964000
- Google Analytics: https://analytics.google.com/analytics/web/#/a256407471p352559138
- Google Tag Manager: https://tagmanager.google.com/#/container/accounts/256407471/containers/GTM-MPNTT5L6
- Google Ads: https://ads.google.com/aw/overview?ocid=701-532-3684
- Google Marketing Platform: https://marketingplatform.google.com/

### Team-Kontakte (WICHTIG)

| Name | E-Mail | Rolle |
|------|--------|-------|
| **Tobias Rangol** | tobias.rangol@neurealis.de | Buchhaltung/Rechnungswesen |
| Holger Neumann | holger.neumann@neurealis.de | Geschäftsführer |

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

**Deployment:** GitHub-basiert (Auto-Deploy bei Push auf `main`)
- Netlify ist mit GitHub verknüpft: `neurealis/neurealis-erp`, Base: `ui/`
- **Standard-Workflow:** `git push origin main` → Netlify baut + deployed automatisch
- **NIEMALS** `netlify deploy --dir build` verwenden (deployed keine Edge Functions!)
- **Fallback** (nur wenn GitHub-Deploy fehlschlägt): `cd ui && npx netlify-cli deploy --prod --build`

**Design-System:**
- `ui/src/lib/styles/tokens.css` - Zentrale Design-Variablen
- `ui/src/lib/styles/global.css` - Globale Styles

**Emoji-Regel (WICHTIG):**
- NUR professionelle, dezente Emojis im Stil der Sidebar verwenden
- KEINE bunten/verspielten Emojis - wirkt unprofessionell
- Erlaubt: Strukturelle Icons wie in der Navigation

**Bestellformular:**
- Nur Textbox (keine UI-Spracherkennung)
- Nutzer verwenden Google-Tastatur-Spracheingabe am Handy
- Mehrsprachige Texte (DE, HU, RU, RO) werden im Backend geparst
- Edge Function `parse-bestellung` nutzt gpt-5.2 für KI-Parsing

---

## ⚠️ PFLICHT: Dokumentation & Hilfe aktuell halten ⚠️

```
╔════════════════════════════════════════════════════════════════╗
║  📖 BEI NEUENTWICKLUNGEN: HILFE-SEITE AKTUALISIEREN!          ║
║                                                                ║
║  Wenn Telegram-Bot, UI oder Prozesse geändert werden:         ║
║  1. docs/TELEGRAM_BOT_USER_GUIDE.html aktualisieren           ║
║  2. PDF neu generieren (Puppeteer)                            ║
║  3. Nach ui/static/docs/ kopieren                             ║
║  4. Commit mit "docs:" Präfix                                 ║
║                                                                ║
║  Hilfe-Seite im ERP: /hilfe (für alle Rollen sichtbar)        ║
╚════════════════════════════════════════════════════════════════╝
```

**Hilfe-Dokumentation Pfade:**
| Quelle | Ziel | Zweck |
|--------|------|-------|
| `docs/TELEGRAM_BOT_USER_GUIDE.html` | Bearbeitung | Master-Dokument |
| `docs/TELEGRAM_BOT_USER_GUIDE.pdf` | PDF-Export | Offline-Nutzung |
| `ui/static/docs/` | Web-Zugriff | Im ERP unter /hilfe |
| `docs/logo-neurealis.png` | PDF-Assets | Logo für PDFs |

**PDF-Generierung:**
```bash
node -e "const puppeteer = require('puppeteer'); ..."
# Siehe LOG-069 für vollständiges Script
```

**Regel:** Jede Feature-Änderung am Bot → User Guide aktualisieren!

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
| **LV-Positionen** | 2.028 | 6 LV-Typen, 23 Gewerke |
| **Artikel** | 76 | Einkaufsware (Zander, etc.) |
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
| `docs/NEUREALIS_INVOICE_REMINDER.md` | **Rechnungserinnerungen** |

---

*Erstellt am 2026-01-26*
