# Status Quo - neurealis ERP

**Stand:** 2026-01-31 22:30 (aktualisiert)

---

## Aktueller Projektstatus

### Telegram-Bot v54 (✅ CODE FERTIG - Deployment ausstehend)

**Implementiert:** 2026-01-31 (4 parallele Subagenten)

**Neue Features:**
| Feature | Status |
|---------|--------|
| Phasen-Filter (0-4) beim Projekt-Öffnen | ✅ |
| ATBS-Schnellzugriff im Hauptmenü | ✅ |
| Vollständige Projektnamen (Wohnungsnummer sichtbar) | ✅ |
| Kompakte Projekt-Info (Phase, BL, NU, Termine, offene Mängel) | ✅ |
| Gewerk-Status-Tabelle (9 Gewerke mit Emojis) | ✅ |
| Ausführungsarten-Tabelle (kombiniert: Gewerk/Ausführung/Status) | ✅ |
| Brandschutz-Nachweis (neu) | ✅ |
| Multi-Foto-Upload (media_group_id Gruppierung) | ✅ |
| Abnahmeprotokolle (QM-ABN-NU, QM-ABN-KU) | ✅ |

**Nächster Schritt:** Deployment! Dann Phase 3+4 (Termine, Sprach-Befehle)

**Konzept-Dokument:** `docs/TELEGRAM_BOT_ERWEITERUNG_KONZEPT.md`
**Nacht-Plan:** `docs/implementation/telegram_phase3_4_nachtplan.md`

---

### CPQ-Verbesserungen (✅ FERTIG)

**Abgeschlossen:** 2026-01-31
**Koordinationsdatei:** `docs/implementation/cpq_verbesserungen_koordination.md`

**Implementierte Features:**
| # | Thema | Status |
|---|-------|--------|
| 1 | LV-Priorisierung | ✅ Priority-LV aus Request |
| 2 | Freitextsuche | ✅ Hybrid: pg_trgm + Embedding Fallback |
| 3 | Preisanzeige | ✅ Nur VK-Preis (listenpreis) |
| 4 | Sortierung | ✅ Similarity DESC, dann Preis DESC |
| 5 | Mehrfachauswahl | ✅ "+" Button neben Vorschlägen |
| 6 | LV-Filter | ✅ Initial auf ausgewähltes LV |
| 7 | Lern-System | ✅ Hierarchisch (LV-spezifisch → global) |

**Deployments:**
- `transcription-parse` v5 (Supabase Edge Function)
- Migration `20260131213758_cpq_hybrid_search` (pg_trgm, RPCs)
- Netlify UI: https://neurealis-erp.netlify.app

### UI-Migration Softr → SvelteKit

| Komponente | Status | Supabase | Details |
|------------|--------|----------|---------|
| **Bestellsystem** | ✅ Fertig | ✅ | Login, Liste, Detail, Formular |
| **LV-Export** | ✅ Fertig | ✅ | Export-Seite vorhanden |
| **Layout-System** | ✅ Fertig | - | AppShell, Sidebar, Header, BottomNav |
| **Dashboard** | ✅ Fertig | ✅ | KPIs, Aktivitäten, Aufgaben aus DB |
| **BV-Übersicht** | ✅ Fertig | ✅ | Phasen-Tabs, phasenspezifische Tabellen wie Softr |
| **Mängelmanagement** | ✅ Fertig | ✅ | maengel_fertigstellung mit Filter/Statistiken |
| **Nachträge** | ✅ Fertig | ✅ | nachtraege Tabelle mit Summen |
| **Finanzen** | ✅ Fertig | ✅ | 2000 Dokumente aus softr_dokumente (NEU) |
| **Kontakte** | ✅ Fertig | ✅ | 1.379 Kontakte, Karten/Tabellen-Ansicht |
| **Einkauf** | ✅ Fertig | ✅ | Lieferanten, Artikel, LV-Positionen (3.057), KI-Suche |
| **Aufgaben** | ✅ Fertig | ✅ | 1.755 Tasks, Fälligkeits-Filter |
| **Nachunternehmer** | ✅ Fertig | ✅ | 39 NUs, Nachweise-Status |
| **Leads** | ✅ Fertig | ✅ | Kanban-Pipeline (8 Leads) |
| **Marketing** | ✅ Fertig | ✅ | Social Media, Blog, Analytics (NEU) |
| **Kalender** | ✅ Fertig | ✅ | Monatsansicht, BV-Zeiträume |
| **Angebote-CPQ** | ✅ Fertig | ✅ | 8-Schritt Wizard, Drag&Drop, KI-Analyse, Lern-System (NEU) |
| **Kundenportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |
| **Partnerportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |

### CRUD-Status (NEU)

| Seite | Create | Update | Delete |
|-------|--------|--------|--------|
| Mängel | ✅ | ✅ | ✅ |
| Nachträge | ✅ | ✅ | ✅ |
| Aufgaben | ✅ | ✅ | ✅ |
| Kontakte | ✅ | ✅ | ✅ (Soft) |
| Nachunternehmer | ✅ | ✅ | ✅ (Soft) |
| BV-Detail | - | ✅ | - |

### Deployment

**Netlify:** https://neurealis-erp.netlify.app (Live)
**Auth:** Microsoft OAuth via Supabase (funktioniert)

### Supabase-Datenquellen (angebunden)

| Tabelle | Seite | Datensätze |
|---------|-------|------------|
| `monday_bauprozess` | Dashboard, BV, Kalender | 193 Bauvorhaben |
| `maengel_fertigstellung` | Mängel, BV-Detail | 57 Mängel |
| `nachtraege` | Nachträge, Dashboard | aktive Nachträge |
| `softr_dokumente` | Finanzen | 1.777 Dokumente (bereinigt, 642 mit PDF) |
| `tasks` | Dashboard, Aufgaben | 1.755 Tasks |
| `dokumente` | Dashboard, BV-Detail | Aktivitäten |
| `kontakte` | Kontakte, Nachunternehmer | 1.379 Kontakte |
| `kontakte_nachunternehmer` | Nachunternehmer | NU-spezifische Daten |
| `grosshaendler` | Einkauf | 39 Lieferanten |
| `bestellartikel` | Einkauf | 768 Artikel |
| `lv_positionen` | Einkauf | 3.167 LV-Positionen (alle mit Embeddings, neurealis: 693) |
| `leads` | Leads | 8 Leads |
| `social_media_posts` | Marketing | 4 Posts |
| `blog_posts` | Marketing | 9 Artikel (7 KI-generiert via Batch API) |
| `email_details` | E-Mail-Sync | 77 E-Mail-Metadaten (NEU) |
| `email_accounts` | E-Mail-Sync | 6 Postfächer konfiguriert (NEU) |
| `kontakt_domains` | E-Mail-Sync | Domain→Kontakt Mapping (NEU) |
| `kontakt_typen` | Rollen | 9 Rollen (ADM, GF, BL, HW, BH, NU, LI, KU, AP) |
| `fotos` | Telegram-Bot | Baustellen-Fotos mit Kategorien |
| `telegram_sessions` | Telegram-Bot | Bot-Sessions |
| `erinnerungen` | Telegram-Bot | Erinnerungs-System |
| `lv_config` | Angebote-CPQ | 3 LV-Typen mit Gewerken (NEU) |
| `angebots_bausteine` | Angebote-CPQ | 44 Vorlagen (Texte, Bedarfspositionen) (NEU) |
| `position_corrections` | Angebote-CPQ | Lern-System für KI-Korrekturen (NEU) |

### Architektur

**Ein Portal + Rollen** - Eine SvelteKit-App mit Supabase RLS für rollenbasierte Zugriffskontrolle.

### Komponenten-Bibliothek

**Layout:**
- `AppShell.svelte` - Hauptcontainer mit Sidebar
- `Sidebar.svelte` - Responsive Navigation (rollenbasiert)
- `Header.svelte` - Breadcrumb, Suche, User-Menü
- `BottomNav.svelte` - Mobile Navigation

**UI:**
- `Button.svelte` - Primary, Secondary, Ghost, Danger
- `Card.svelte` - Container mit Header/Footer
- `Badge.svelte` - Status-Anzeige mit Phasen-Farben
- `Accordion.svelte` - Aufklappbare Bereiche
- `KPICard.svelte` - Dashboard-Kennzahlen (mit subvalue)

**CPQ (NEU):**
- `DraggableList.svelte` - Generische Drag&Drop Liste
- `PositionItem.svelte` - LV-Position mit Inline-Edit
- `PositionGroup.svelte` - Gewerk-Gruppe (collapsible)
- `PositionGroupList.svelte` - Container mit Toolbar

### Aktuelle Seiten-Struktur

```
ui/src/routes/
├── +page.svelte              # Dashboard (Supabase)
├── +layout.svelte            # AppShell Layout
├── login/+page.svelte
├── bauvorhaben/
│   ├── +page.svelte          # BV-Liste (Supabase)
│   └── [id]/+page.svelte     # BV-Detail (Supabase)
├── kalender/+page.svelte     # Kalender/Bauzeitenplan (NEU)
├── maengel/+page.svelte      # Mängel (Supabase)
├── nachtraege/+page.svelte   # Nachträge (Supabase)
├── finanzen/+page.svelte     # Finanzen (Supabase)
├── einkauf/+page.svelte      # Lieferanten, Artikel, LV (NEU)
├── kontakte/+page.svelte     # Kontakte (NEU)
├── leads/+page.svelte        # Vertriebspipeline (NEU)
├── marketing/+page.svelte    # Social Media, Blog, Analytics (NEU)
├── aufgaben/+page.svelte     # Task-Management (NEU)
├── nachunternehmer/+page.svelte # NU-Verwaltung (NEU)
├── angebote/
│   ├── +page.svelte          # Angebotsübersicht (NEU)
│   └── neu/+page.svelte      # 8-Schritt Wizard (NEU)
├── bestellung/+page.svelte
├── bestellungen/
│   ├── +page.svelte
│   └── [id]/+page.svelte
└── lv-export/+page.svelte
```

---

## Nächster Schritt

→ **Hero-Konflikte manuell korrigieren:** FC.LV25.8.x (6 vertauschte Nummern), GWS Stand/Wand-WC
→ **Vonovia-LV importieren:** Aktuell 0 Positionen für LV-Typ 'vonovia'
→ **AHREFS-Analyse:** Wenn Keywords verfügbar, SEO-Optimierung durchführen
→ **CPQ End-to-End Test:** Manueller Test mit echter Transkription empfohlen

---

## Letzte Session (2026-01-31)

**CPQ-Verbesserungen IMPLEMENTIERT (7 Features):**

- T1: Backend Edge Function `transcription-parse` v5 (hierarchisches Lern-System)
- T2: SQL-Migration mit pg_trgm, 2 neue RPCs (hybrid, hierarchical)
- T3: UI-Updates (listenpreis, "+"-Button, LV-Filter, Sortierung)
- T4: QA bestanden (12/12 Checks, 0 Fehler)
- Beide Deployments erfolgreich (Supabase + Netlify)

**Details:** `docs/implementation/cpq_verbesserungen_koordination.md`
- **3 Verbesserungswünsche dokumentiert:**
  1. GWS-LV priorisieren (erst GWS, dann andere LVs im Dropdown)
  2. Freitextsuche über alle LV-Positionen ergänzen
  3. Mehrere Artikel pro erkannter Leistung ermöglichen

---

## Vorherige Session (2026-01-31 ~23:55)

**CPQ-Workflow Fix - 2 kritische Fehler behoben:**

**1. UI-Fehlerbehandlung:**
- Problem: `err instanceof Error` schlug bei Supabase FunctionsHttpError fehl
- Fix: Neue `getErrorMessage()` Utility-Funktion in `+page.svelte`

**2. transcription-parse v7:**
- Problem: GPT-5.2 API gab 400 wegen `max_tokens` Parameter
- Fix: `max_completion_tokens: 4000` statt `max_tokens: 4000`
- Test erfolgreich: 2 Positionen aus "Bad fliesen 12 qm, 3 Steckdosen" erkannt

**Neue Learnings:** L137-L138

---

## Vorherige Session (2026-01-31 ~23:00)

**WordPress-Sync IONOS-Fix + Blog-Optimierung (T1-T13):**

**IONOS Auth-Problem gelöst:**
- JWT Plugin + X-WP-Auth Header Workaround
- 8 Blog-Artikel erfolgreich nach WordPress veröffentlicht

**13 Subagenten-Tasks:**
| Task | Ergebnis |
|------|----------|
| T1-T3 | Artikel überarbeitet, Struktur analysiert, Eigenheim-Template |
| T4 | WordPress Backup → Git (82 Dateien, 1,3 MB) |
| T5 | SEO-Lücken geschlossen (Tags, Kategorien, Images) |
| T6-T8 | Kostenkorrektur, Upload, alle 7 Artikel verbessert |
| T9 | 23 Broken Links gefixt |
| T10 | WordPress API dokumentiert (485 Routen, 22 Namespaces) |
| T11-T13 | 🔄 Noch aktiv |

**Neue Dokumentation:**
- `docs/wordpress_api/` - Vollständige API-Referenz
- `docs/wordpress_backup/` - Git-basiertes CMS-Backup

**7 neue Learnings:** L130-L136

---

## Vorherige Session (2026-01-31 ~02:30)

**CPQ-Bugfixes - 3 kritische Probleme behoben:**

**1. Projektauswahl-Fix:**
- Problem: Dropdown zeigte "[object Object]" statt Projektnamen
- Ursache: JSONB-Struktur `column_values?.status__1` ist verschachtelt
- Fix: Korrektes Parsing mit `column_values?.status__1?.text`

**2. transcription-parse v3:**
- Problem: Status 400 wegen inkonsistentem Response-Format
- Fix: Prompt und `response_format` konsistent gemacht
- TypeScript Error-Handling verbessert

**3. Umlaute-Korrektur (18 Dateien, ~100 Fixes):**
- UI-Texte: "prüfen", "für", "Übersicht" statt "pruefen", "fuer", "Uebersicht"
- CLAUDE.md v2.4: Umlaut-Anforderung verstärkt und in VERBOTEN-Tabelle

---

## Vorherige Session (2026-01-31 ~01:30)

**CPQ-System vollständig implementiert (6 parallele Subagenten):**

- T1: DB-Schema (lv_config, angebots_bausteine, position_corrections)
- T2: transcription-parse v2 (Hybrid-Prompt, Fallback, Lernen)
- T3: UI-Wizard (8 Schritte unter /angebote/neu)
- T4: Drag&Drop Komponenten (4 Svelte-Komponenten)
- T5: Angebotsbausteine (44 Einträge)
- T6: QA bestanden, Build erfolgreich

**Ergebnis:** `docs/implementation/cpq_koordination.md`

---

## Vorherige Session (2026-01-30 ~22:30)

**Angebots-CPQ Backend - IMPLEMENTIERUNG FERTIG:**

**T1: DB-Migration (6 Tabellen):**
- `pricing_profiles` - 6 Profile (GWS Basis 25%, VBW 22%, neurealis 30%, Privataufschlag)
- `kunde_pricing` - Kundenspezifische Aufschlaege
- `position_dependencies` - LV-Abhaengigkeiten
- `angebote` + `angebots_positionen` - Haupttabellen
- `dokument_sequenzen` + `get_next_dokument_nr()` RPC

**T3: LV-Abhaengigkeiten analysiert (lokal via Subagenten):**
| LV-Typ | Positionen | Abhaengigkeiten |
|--------|------------|----------------|
| GWS | 561 | 74 |
| VBW | 100 | 39 |
| neurealis | 236 | 25 |
| **TOTAL** | 897 | **138** |

**T4: transcription-parse Edge Function:**
- Deployed, GPT-5.2 + Embedding-basierte LV-Suche funktioniert
- Abhaengigkeiten aus `position_dependencies` laden

**LV-Prompt-Analyse:**
- Gewerke-Namen sind pro LV komplett unterschiedlich (GWS: "Elektroarbeiten" vs. neurealis: "Elektro")
- Empfehlung: Hybrid-Prompt (Ein Template + LV-Parameter)
- Neue Decision D034 dokumentiert

**Problem geloest:** Edge Function Timeout (150s) → Lokale Subagenten ohne Timeout

**Vom User bereitgestellte Texte:**
1. Angebotsannahme - Auftragsschreiben mit Unterschriftsfeld (HTML)
2. NUA-Vertragswerk - Paragraf 1-12 Vertragsbedingungen (HTML)
3. Bedarfspositionen - Eventualpositionen 22.001-22.013 (Preise aus aktuellem LV!)

---

## Vorherige Session (2026-01-31 ~04:15)

**Hero LV-Bereinigung - ABGESCHLOSSEN:**

**Durchgeführte Bereinigungen:**
| Aktion | Anzahl |
|--------|--------|
| DUPLIKAT-* gelöscht | 190 |
| ALT-* gelöscht | 436 |
| Niedrigere Preise bei Duplikaten gelöscht | 195 |
| Generische Artikelnummern ersetzt | 7 |
| **Total bereinigt** | **828** |

**Supabase:**
- Position `LV23-01.01.24` gelöscht, mit `GWS.LV23-01.01.24` zusammengeführt
- Preis-Historie für 100 € → 115,87 € eingefügt

**Neue Artikelnummer-Schema:** `Gewerk-Bauteil-Aspekt` (Title Case)
- Beispiel: `Sanitaer-Dusche-Zulage`, `Elektrik-Sat-Anschluss`

**Ignorierte Konflikte (manuelle Korrektur nötig):**
- FC.LV25.8.x Forte Capital - 6 vertauschte Artikelnummern
- GWS.LV23-21.02.01.34 - Stand-WC vs. Wand-WC gleiche Nummer

**Backups:** `docs/backups/2026-01-31_hero_*.json` (3 Dateien)

**Neue Learnings:** L105-L108

---

## Vorherige Session (2026-01-31 ~03:45)

**Angebot aus Baubesprechungs-Transkription - ABGESCHLOSSEN:**

**Workflow etabliert:**
- Plaud-Transkription (45 Min Baubesprechung) → Leistungen extrahiert
- 9 Gewerke, 41 Positionen automatisch GWS-LV zugeordnet
- HTML-Angebot mit korrekten Listenpreisen erstellt

**Wichtige Preiskorrektur:**
- `preis` = EK (Einkaufspreis) - NICHT für Kundenangebote!
- `listenpreis` = VK (Verkaufspreis) - IMMER für Angebote verwenden
- Differenz war 41% (10.230 € EK vs. 14.427 € VK)

**Ergebnis ANG-ATBS-472:**
- Netto: 14.427,46 €
- Brutto: 17.168,68 €
- Dateien: `docs/angebote/ANG-ATBS-472_Bollwerkstr9_GWS.html`

**Neue Learnings:** L103-L104 (preis vs. listenpreis, Transkription-Workflow)

---

## Vorherige Session (2026-01-31 ~01:15)

**Nachtrag-Bug-Fix + gemeldet_von + LV-Konsolidierung - ABGESCHLOSSEN:**

**Bug-Fixes:**
- Nachtrag speichern scheiterte wegen CHECK constraint (status, gemeldet_von)
- Fix v56: Status auf `'(0) Offen / Preis eingeben'`, `'telegram'` zu CHECK hinzugefügt

**telegram-webhook v57-v58:**
- Dynamische gemeldet_von Erkennung (kontakte-Lookup via telegram_chat_id)
- Embedding-basierte LV-Position-Suche via `search_lv_positions` RPC
- Positionen nur anzeigen wenn gefunden (keine leeren Listen)

**LV-Konsolidierung:**
- LV-Typ "Privat" → "neurealis" umbenannt (281 Positionen)
- neurealis hat jetzt 693 Positionen für B2C-Privatkundenangebote
- Alle 2.214 Embeddings mit kombiniertem Text regeneriert (bezeichnung + beschreibung)

**Neue Learnings:** L101-L102 (CHECK constraints, LV-Typen konsolidieren)
**Neue Decision:** D029 (Privat → neurealis Migration)

---

## Vorherige Session (2026-01-30 ~23:30)

**Telegram-Bot v55 - Nachtrag LV-Position-Matching - ABGESCHLOSSEN:**

**Neue Features:**
- Auftraggeber-Extraktion aus Projektname (Format: "AG | Adresse")
- LV-Typ-Mapping basierend auf Auftraggeber (VBW, GWS, Covivio, Vonovia, etc.)
- GPT-5.2 parst Nachtrag-Texte zu Positionen (Beschreibung, Menge, Einheit, Gewerk)
- Score-basiertes LV-Position-Matching mit Preisen
- Ausgabe: Roh-Text + gefundene Positionen mit EP und Summe

**Vonovia-Korrektur:**
- Ursprünglich Vonovia → GWS (falsch!)
- Korrigiert: Vonovia → 'vonovia' (eigener LV-Typ)
- Hinweis: Vonovia-LV noch nicht importiert

**Neue DB-Spalten:**
- `nachtraege.positionen` (JSONB)
- `nachtraege.summe_netto` (NUMERIC)

**Neue Learnings:** L096-L097 (Score-basiertes Matching, Auftraggeber-Extraktion)

---

## Vorherige Session (2026-01-30 ~21:45)

**Softr-Sync mangel_nr Fix + Duplikate-Bereinigung - ABGESCHLOSSEN:**

**Fixes:**
- softr-sync v28: `mangel_nr` zu FIELD_MAPPINGS hinzugefügt (Feld-ID: 1UqYa)
- 13 fehlende Mängelnummern für ATBS-456 nachgetragen (M1-M13)
- 16 fehlende projektname_komplett aus Monday ergänzt

**Duplikate-Bereinigung ATBS-456:**
- 22 Test-Mängel aus Supabase + Softr gelöscht
- Nur M1 bleibt übrig

**Neue Learnings:** L092-L095

---

## Vorherige Session (2026-01-30 ~20:30)

**GWS LV-Import 2026 Baupreisindex - ABGESCHLOSSEN:**

**Import-Ergebnis:**
- **363 Preiserhöhungen** importiert (Ø +26.22%)
- **110 neue Positionen** angelegt (Fenster, HLS, Weißware)
- **8 Preissenkungen** NICHT importiert (alte Preise behalten)
- **74 Überschriften** ignoriert
- GWS hat jetzt 711 Positionen (vorher 601)

**Dry-Run-Workflow:**
1. Excel einlesen mit Node.js (`xlsx` Package)
2. Artikelnummer-Transformation (z.B. `01.01.1` → `GWS.LV23-01.01.1`)
3. Dry-Run mit Kategorisierung (Preiserhöhungen, Senkungen, Neue, Keine Match)
4. User-Bestätigung vor echtem Import
5. Preissenkungen separat behandeln (nicht automatisch!)

**Fallback-Matching deaktiviert:**
- Problem: Stundenlohn-Positionen existieren 12x in Excel (pro Gewerk)
- Fallback über Namen führte zu falschen Zuordnungen
- Lösung: Nur exaktes Artikelnummer-Matching

**Backup:** `docs/backups/2026-01-30_lv_positionen_gws_import.json`

---

## Vorherige Session (2026-01-30 ~18:30)

**Telegram-Bot v51 - Verbesserte Mängel-Erfassung - ABGESCHLOSSEN:**

**Verbesserungen:**
- Mangelnummern: ATBS-XXX-M1, ATBS-XXX-M2 Format (automatisch fortlaufend)
- KI-Prompt für Wohnungssanierung optimiert (Gewerke, TRENNUNGS-REGELN)
- Frist auf 3 Tage geändert (war 7 Tage)
- Neuer Foto-Zuordnungs-Workflow für mehrere Mängel

**Neue Funktionen:**
- `generateMangelNummer()` - Automatische Mangelnummer-Generierung
- `selectMangelForFoto()` - Foto-Mangel-Zuordnung bei mehreren Mängeln
- Callbacks: `mangel:foto:{id}`, `mangel:assign:{id}`

**Deployment:** telegram-webhook v51 (Supabase Edge Function)

---

## Vorherige Session (2026-01-30 ~15:00)

**LV-Sync Implementierung (T1-T4) - ABGESCHLOSSEN:**

**5 Parallele Subagenten:**
- T1: `lv_preis_historie` Tabelle + Trigger für automatische Protokollierung
- T2: `lv-softr-push` Edge Function + Initial-Sync (1.485 → 3.057 = 100%)
- T3: `lv-hero-push` Edge Function mit Loop-Vermeidung (source='hero')
- T4: LV-Import Konzept-Dokument mit UI-Mockups
- T5: Erweitertes Preis-Datenmodell (m:n AG, NU-Margen) - Klärungsbedarf!

**Ergebnisse:**
- Alle LV-Positionen jetzt in Supabase UND Softr synchronisiert
- Neue Positionen werden automatisch zu Hero gepusht (wenn source != 'hero')
- Preisänderungen werden historisch protokolliert
- Import-Konzept + Preis-Datenmodell dokumentiert für nächste Phase

**Dokumentation:** `docs/LV_SYNC_IMPLEMENTATION.md`, `docs/implementation/t1-t5*.md`

---

## Vorherige Session (2026-01-30 ~10:30)

**LV-Export PDF Styling Fix - ABGESCHLOSSEN:**

**Problem:** PDF zeigte Artikelnummer zuerst, dann Name
**Lösung:**
- Reihenfolge geändert: Name → Artikelnummer → Langtext
- Name jetzt fett gedruckt
- Artikelnummer ohne eckige Klammern, mittelgrau
- Custom-Rendering via `didDrawCell` Hook

**Neue Learnings:** L085 (jsPDF didDrawCell für gemischte Styles)

---

## Vorherige Session (2026-01-30 ~01:15)

**Telegram-Bot v50 Debugging - ABGESCHLOSSEN:**

**Ausgangspunkt:** User meldete Baustellen-Features funktionieren nicht

**Analyse-Ergebnis:**
- Code war vollständig (alle Handler implementiert)
- Deployter Code enthielt alle Callbacks (bau:mangel, bau:nachtrag, etc.)
- Problem: User muss erst Projekt öffnen bevor Mangel/Nachtrag funktioniert

**Maßnahmen:**
- telegram-webhook v50 deployed mit zusätzlichem Debug-Logging
- Version-Bump für klare Identifikation
- console.log für jeden Callback-Handler

**Test-Workflow:**
```
/start → "🏗️ Baustelle öffnen" → Projekt wählen → DANN Mangel/Nachtrag/Nachweis
```

**Neue Learnings:** L085-L086 (Projekt-Öffnung erforderlich, Debug-Logging)

---

## Vorherige Session (2026-01-29 ~19:45)

**WordPress-Sync IONOS Auth-Problem - BLOCKIERT:**

**Cornerstone-Artikel fertig:**
- OpenAI Batch erfolgreich abgeschlossen
- "Kernsanierung Komplettsanierung Dortmund 2026" (2.999 Wörter)
- 9 Artikel bereit für WordPress-Veröffentlichung

**WordPress-Sync Troubleshooting:**
- API-Verbindung funktioniert (Test-Mode erfolgreich)
- Authentication teilweise erfolgreich (Error wechselte)
- **Problem:** IONOS Hosting stripped Authorization Header im CGI-Modus

**.htaccess Fix gescheitert:**
- Standard-Fix für Auth-Header verursachte 500 Error
- .htaccess zurück auf Original gesetzt

**Neue Learnings:** L083-L084 (IONOS Auth-Problem, .htaccess Risiken)

---

## Vorherige Session (2026-01-29 ~16:00)

**Telegram-Bot v49 + Mängel-Reminder Fix - FERTIG:**

**Mängel-Reminder v5:**
- Fix: Keine Erinnerung wenn `status_mangel` geschlossen ist
- Prüfung: NICHT in ['Abgenommen', 'Abgeschlossen', 'Erledigt', 'Geschlossen']

**Telegram-Bot v49 (Baustellen-Features):**
- Neues Hauptmenü: "🏗️ Baustelle öffnen"
- Mangel melden: Text/Sprache, mehrsprachig, Auto-Splitting, Foto
- Nachtrag erfassen: Text + Foto, automatische Nummern (NT-ATBS-001)
- Nachweis hochladen: Typ-Auswahl (Elektrik/Sanitär/Abdichtung/E-Check)
- Status anzeigen: Offene Mängel/Nachträge/Nachweise
- Bestehende Features (Aufmaß, Bedarfsanalyse) unverändert

**Deployment:**
- GitHub Commit `17a2a6d` auf main (26 Dateien, +9.336 Zeilen)
- Netlify Auto-Deploy aktiv

---

## Vorherige Session (2026-01-29 ~18:30)

**WordPress-Sync v3 + Marketing-RLS-Fix - FERTIG:**

**WordPress-Sync v3 deployed:**
- Mode `freigeben`: Push + sofort veröffentlichen (für ERP-Freigabe)
- Mode `draft`: Nur als Entwurf zur Vorschau
- Mode `unpublish`: Zurück auf Draft setzen
- Mode `test`: Verbindung prüfen
- Username korrigiert (lowercase)
- API-Verbindung funktioniert ✅

**Marketing-Seite RLS-Fix:**
- Problem: Seite war leer (RLS blockierte anon User)
- Lösung: Policy `Anon users can read blog_posts` hinzugefügt
- Marketing-Seite zeigt jetzt alle 9 Blog-Artikel ✅

**WordPress-Auth Problem:**
- 401 bei POST: User hat keine Schreibrechte
- **Fix benötigt:** WordPress Admin → User → Rolle "Redakteur" geben

**9 Artikel bereit für WordPress:**
- Kernsanierung Komplettsanierung Dortmund 2026 (2.999 Wörter)
- GEG Sanierungspflicht Vermieter 2026 (1.123 Wörter)
- Wohnungssanierung Dortmund 2026
- + 6 weitere Artikel

---

## Vorherige Session (2026-01-29 ~16:45)

**Blog-Pipeline Cornerstone-Artikel - FERTIG:**

**Erreicht:**
- 3000-Wörter Cornerstone-Artikel via OpenAI Batch API erstellt
- "Kernsanierung & Komplettsanierung in Dortmund 2026" (2.999 Wörter!)
- blog-batch-submit v6 mit 12000 max_completion_tokens
- Cornerstone-Detection: priority >= 100 oder expliziter Parameter

**9 Blog-Artikel erstellt (7 KI-generiert):**
| Artikel | Wörter | Typ |
|---------|--------|-----|
| Kernsanierung Komplettsanierung Dortmund 2026 | 2.999 | Cornerstone |
| GEG Sanierungspflicht Vermieter 2026 | 1.123 | Standard |
| Wohnung sanieren Kosten 2026 | 975 | Standard |
| + 4 weitere Regional-Artikel | 743-893 | Standard |

**Neue Learnings:** L076-L077 (Token-Limits für lange Artikel, Cornerstone-Detection)

---

## Vorherige Session (2026-01-29 ~02:05)

**Blog-Pipeline mit OpenAI Batch API - FERTIG:**

**Problem gelöst:** Writer-Timeout (60s Edge Function Limit)
**Lösung:** OpenAI Batch API (async, 24h Fenster, 50% günstiger)

**Neue Edge Functions:**
- `blog-batch-submit` v3: Keywords → Editor → Batch-Request erstellen
- `blog-batch-poll` v4: Batch-Status prüfen, Posts erstellen

**Neue DB-Tabelle:** `blog_batches` (Batch-Tracking)

**Cron-Jobs:**
- `blog-batch-submit-daily`: 08:00 UTC (5 Keywords/Tag)
- `blog-batch-poll`: Alle 10 Minuten

**Erster erfolgreicher Durchlauf:**
- 2 Artikel automatisch erstellt:
  - "Wohnungssanierung Dortmund 2026" (893 Wörter)
  - "Wohnung sanieren: Kosten 2026" (975 Wörter)
- Confidence 1.00 → Status "veroeffentlicht"

**Fixes während Entwicklung:**
- `max_completion_tokens: 1800 → 4000` (leere Responses)
- Status-Werte: `draft/published → entwurf/veroeffentlicht`
- `blog_pipeline_runs_status_check` erweitert um `batch_pending`, `batch_processing`

**Neue Learnings:** L072 (Batch API Pflicht)

---

## Vorherige Session (2026-01-29 ~12:15)

**Mängel-Erinnerungssystem - 2-Phasen-Logik:**

**Implementiert:**
- `mangel-reminder` v13 deployed mit automatischem Phasenwechsel
- Neue Spalten: `erinnerung_status`, `letzte_erinnerung_bl_am`, `erinnerung_bl_count`
- 5 neue Felder in Softr via API erstellt
- Field-Mapping für bidirektionalen Sync konfiguriert (25 Felder)

**Logik:**
```
Phase 1: NU-Erinnerung (fotos_nachweis_nu LEER)
  → E-Mail an NU alle 2 Tage: "Mangel beheben + Foto hochladen"

Phase 2: BL-Erinnerung (fotos_nachweis_nu BEFÜLLT)
  → E-Mail an Bauleiter alle 2 Tage: "Bitte abnehmen"

Stopp: status_mangel = 'Abgenommen' ODER erinnerung_status = 'Pausiert'
```

**Default:** Neue Mängel haben `erinnerung_status = 'Aktiv'`

**Neue Learnings:** L067-L068 (Softr API, 2-Phasen-Erinnerung)

---

## Vorherige Session (2026-01-29 ~16:00)

**Blog-Pipeline Implementierung (T1-T8 fertig, T9 in Arbeit):**

- **T1 DB-Migrationen:** ✅ blog_keywords, blog_pipeline_runs, blog_posts erweitert
- **T2-T6 Edge Functions:** ✅ Alle 5 Functions deployed:
  - `blog-editor` (Redaktionschef) - Briefing erstellen
  - `blog-research` (Recherche-Agent) - Web-Fakten sammeln
  - `blog-writer` (Schreib-Agent) - Artikel schreiben
  - `blog-orchestrate` (Koordinator) - Pipeline steuern
  - `blog-crosslink` (Verlinkung) - Wöchentliche Nachvernetzung
- **T7 Test-Keywords:** ✅ 23 Keywords in 4 Clustern eingefügt
- **T8 Cron-Jobs:** ✅ blog-orchestrate-daily (8:00), blog-crosslink-weekly (So 6:00)
- **T9 E2E-Test:** ⚠️ Einzelne Functions funktionieren, Orchestrator timeout

**Einzeltests erfolgreich:**
- blog-editor: Vollständiges Briefing JSON
- blog-research: 6 Fakten, Trends, Lokaldaten
- blog-writer: 1.126 Wörter, 6 interne Links, Confidence 0.6

**Problem:** blog-orchestrate Chain (editor→research→writer) hat timeout bei writer

**Neue Learnings:** L062-L065 (OpenAI API, Supabase Edge Functions)

---

## Vorherige Session (2026-01-29 ~11:30)

**Edge Function Backups + Klarstellung:**

- Bedarfsanalyse/Aufmaß sind **separate** Edge Functions (nicht überschrieben!)
- Backups erstellt in `backups/edge-functions/`
- SharePoint-Sync hat Download-Fehler (Token-Problem) - Fix in Arbeit
- 4 neue Learnings dokumentiert (L058-L061)

**Bestehende Edge Functions verifiziert:**
- `process-bedarfsanalyse` v31 ✅
- `process-aufmass-complete` v29 ✅
- `telegram-webhook` v46 ✅

---

## Vorherige Session (2026-01-29 ~10:30)

**Telegram-Bot v2.0 - Vollständige Implementierung:**

**Neue Features:**
- **Mangel erfassen:** KI-Analyse splittet mehrere Mängel automatisch
- **Nachtrag erfassen:** Mit Foto-Upload und Beschreibung
- **Foto-Upload:** In Supabase Storage (neuer `fotos` Bucket)
- **Sprach-zu-Text:** Whisper-Integration für mehrsprachige Eingabe
- **Nachweis-Upload:** Typ-Auswahl (Rohinstallation, E-Check, etc.)

**Kritische Regel umgesetzt:** Mängel/Nachträge/Fotos NUR wenn Projekt geöffnet!

**Edge Function:** `telegram-webhook` v45 deployed

**Technisch:**
- `fotos` Storage-Bucket erstellt (public, 50 MB, JPEG/PNG/HEIC)
- OpenAI Whisper für Transkription
- GPT-5.2 für Mangel-Analyse (splittet automatisch)
- Mehrsprachig: DE, RU, HU, RO, PL (automatische Übersetzung)

**DB-Speicherung:**
- Mängel → `maengel_fertigstellung` mit projekt_nr, datum_frist
- Nachträge → `nachtraege` mit atbs_nummer
- Fotos → `fotos` Tabelle + Storage

---

## Vorherige Session (2026-01-29 ~02:00)

**Dokumentenmanagement-System - Telegram-Bot + SharePoint-Sync:**

**DB-Migrationen (6 Stück):**
- `kontakt_typen` - 9 Rollen-Lookup
- `fotos` - Baustellen-Fotos mit Vision-Labels
- `telegram_sessions` - Bot-Sessions
- `erinnerungen` - Erinnerungssystem
- `kontakte` erweitert - telegram_chat_id, rolle, sprache
- `dokumente` - sicherheitsstufe (1-4) + Umlaute

**Edge Functions deployed:**
- `telegram-webhook` v44 - Bot-Grundgerüst
- `sharepoint-sync` v1 - Delta-Sync vorbereitet

**4-Stufen-Sicherheitskonzept:**
- Stufe 1: Alle Mitarbeiter (Projekte, Marketing)
- Stufe 3: GF + Buchhaltung (Finanzen)
- Stufe 4: Nur GF (Personal, Management)

**Parallele Subagenten:** 3 Agents für max. Effizienz

---

## Vorherige Session (2026-01-29 ~01:30)

**Blog-Pipeline Plan finalisiert:**
- Detaillierter Plan in `docs/blog_pipeline/BLOG_PIPELINE_PLAN.md`
- 3-Agenten-Architektur (Editor → Research → Writer)
- 4 Themen-Cluster (Sanierung, Vermieter, Regional, Sanierungskompass)
- Brand Voice Guidelines mit neurealis-USPs integriert
- DB-Schema, 5 Edge Functions, Erfolgskriterien definiert
- Basiert auf wissen/ Dateien (marketing, business, wettbewerb)

---

## Vorherige Session (2026-01-29 ~01:00)

**Ausführungsart-basierte Nachweis-Filterung v19:**
- Edge Function `schlussrechnung-nachweis-check` erweitert
- Nachweise werden basierend auf Elektrik/Bad-Ausführungsart gefiltert
- Elektrik: Komplett → beide, Teil-Mod/Feininstall → nur E-Check, Ohne → keine
- Bad: Komplett → beide, Fliese auf Fliese → nur Abdichtung, Ohne → keine
- Performance: Monday-Daten nur einmal laden
- **Ergebnis:** ~15% weniger falsche Nachweis-Anforderungen (295 statt 348)
- Git: Commit `0174b62` gepusht

---

## Vorherige Session (2026-01-29 ~00:45)

**Wissens-Indizierung Phase 2:**
- Wettbewerbsanalyse PDF indiziert → `wissen/wettbewerber_analyse.md`
- Business Plan (57k tokens) extrahiert → `wissen/business_strategie.md`
- L049 korrigiert: Subagenten KÖNNEN lokal synchronisierte Dateien lesen
- **Wissens-Ordner komplett:** 4 Dateien für Blog-Pipeline

**Wissens-Dateien:**
```
wissen/
├── vertrieb_prozesse.md    # Sales-Ablauf, USPs
├── marketing_strategie.md  # Sanierungskompass, Content
├── wettbewerber_analyse.md # 5 Gruppen, Differenzierung
└── business_strategie.md   # Vision, Zielgruppen, Wachstum
```

---

## Vorherige Session (2026-01-29 ~00:00)

**Nachweis-Logik Analyse:**
- Monday-Bauprozess-Spalten für Gewerks-Ausführungsarten analysiert
- L051 dokumentiert: Vollständige Logik wann welcher Nachweis nötig ist

---

## Vorherige Session (2026-01-28 ~23:50)

**Wissens-Indizierung für Blog-Pipeline:**
- 3 PDFs extrahiert und strukturiert (Angebotsbesprechungen + Sanierungskompass)
- `wissen/` Ordner erstellt mit 3 Markdown-Dateien
- **vertrieb_prozesse.md:** Sales-Ablauf (6 Phasen), USPs, Kennzahlen, Referenzen
- **marketing_strategie.md:** Sanierungskompass-Produkt, Content-Cluster, ICPs
- Extrahierte Zahlen: 98% Termintreue, 95% Fixpreis-Quote, 600€/Monat Leerstand

---

## Vorherige Session (2026-01-28 ~15:30)

**Blog-Pipeline Planung:**
- Vollständige Architektur für automatisierte Blog-Erstellung geplant
- **3-Agenten-System:** Redaktionschef → Recherche → Writer
- **5 Edge Functions:** blog-orchestrate, blog-editor, blog-research, blog-writer, blog-crosslink
- **DB-Erweiterungen geplant:** blog_posts.embedding, blog_keywords, blog_pipeline_runs
- **Web-Recherche:** OpenAI Responses API mit web_search_preview
- **Querverlinkung:** Embedding-basierte Similarity Search für SEO
- **Cron:** Täglich 08:00 UTC für automatische Artikel-Generierung
- **Status:** Plan erstellt, wartet auf Genehmigung

**Plan-Datei:** `C:\Users\holge\.claude\plans\tender-brewing-wigderson.md`

---

## Vorherige Session (2026-01-28 ~23:00)

**Hero-Sync Beträge-Bug-Fix + Wiederherstellung:**
- **Bug-Fix:** `hero-document-sync` v13 - Beträge werden nur gesetzt wenn Hero Werte hat
- **Problem:** `const netto = doc.value || 0;` überschrieb existierende Werte mit 0
- **Wiederherstellung:** 11 Dokumente aus Softr-Backup (~142.578 € netto)
  - NUA-355, NUA-357, NUA-358, NUA-359, NUA-363, NUA-364, NUA-365, NUA-366
  - 2100021040, R-00156, R-00173
- **Backup:** `docs/softr_amounts_backup.json` (2.515 Dokumente mit Beträgen)
- **Vergleich:** ER-*/AR-*/RE-* stimmen zwischen Softr und Supabase überein
  - Differenz nur durch Datumsfilter (`date >= '2025-01-01'`) in hero-document-sync

**Cron-Job Status:**
- `hero-document-sync`: `*/5 6-19 * * *` (alle 5 Min, nur 6-19 Uhr)
- Status: aktiv, läuft automatisch tagsüber

---

## Vorherige Session (2026-01-28 ~22:00)

**Schlussrechnung-Nachweis-Check Edge Function:**
- **Edge Function:** `schlussrechnung-nachweis-check` v14 deployed
- **Funktion:** Prüft bei NU-Schlussrechnungen (ER-NU-S) ob Nachweise fehlen
- **Nachweise:** Rohinstallation Elektrik, Rohinstallation Sanitär, Abdichtung Bad, E-Check Protokoll
- **Features:**
  - Automatische E-Mail an NU mit personalisierter Anrede
  - 2-Werktage-Deadline mit roter Warnung
  - Test-Modus für sichere Entwicklung
- **Test erfolgreich:** 2 E-Mails für ATBS-445 und ATBS-447 gesendet
- **email-send v15:** Mit verify_jwt: false für interne Calls

**Gelöste technische Probleme:**
- Supabase Client JSONB-Filter funktioniert nicht → Manuelles Filtern
- PostgREST LIKE-Syntax: %25 statt *
- Edge Function zu Edge Function: verify_jwt: false nötig

---

## Vorherige Session (2026-01-28 ~21:00)

**Beträge-Wiederherstellung & Bug-Fix:**
- **Root Cause:** `hero-document-sync` überschrieb existierende Netto/Brutto-Werte mit 0 wenn Hero keinen Wert hatte
- **Bug-Fix:** `upsertToSupabase()` aktualisiert - Beträge werden nur noch gesetzt wenn Hero tatsächlich Werte hat
- **Wiederherstellung:** 11 Dokumente aus Softr-Backup wiederhergestellt (~159.000 € Gesamtwert)
  - NUA-355 bis NUA-366 (8 Nachunternehmer-Aufträge)
  - 2100021040, R-00156, R-00173 (3 Rechnungen)
- **Analyse-Scripts:** `scripts/compare_and_restore.mjs`, `docs/softr_amounts_backup.json` (2.515 Dokumente)
- **Erkenntnis:** Die meisten Dokumente mit 0/NULL-Werten sind korrekt (E-Mails, Aufmaße, etc. haben keine Beträge)

---

## Vorherige Session (2026-01-28 ~18:30)

**Hero PDF-Sync - Vollständige Migration:**
- `hero-document-sync` v11: temporary_url zur GraphQL-Query hinzugefügt
- `hero-pdf-sync` v4: Filename-Sanitization für Umlaute/Sonderzeichen
- **653 PDFs** von Hero → Supabase Storage migriert (100% Erfolg)
- **686 PDFs** total in Supabase Storage
- 447 S3-Legacy-PDFs noch zu migrieren

---

## Vorherige Session (2026-01-28 ~16:00)

**E-Mail-Integration Phase 1 - FERTIG:**
- `email-fetch` Edge Function v4: Holt E-Mails von MS365 Graph API
- `email-process` Edge Function: Matching-Kaskade (Domain, ATBS, Postfach)
- **50 E-Mails** importiert aus 5 Postfächern
- **27 Anhänge** in Supabase Storage hochgeladen
- Neue Tabellen: `email_details`, `email_accounts`, `kontakt_domains`, `email_sync_log`
- Fixes: UNIQUE-Constraint mit COALESCE, Storage-Pfad-Sanitization, Graph API contentBytes

**Postfächer aktiv:**
- holger.neumann@, service@, rechnungen@, bewerbungen@, kontakt@ @neurealis.de

**Vorherige Session (~11:00):**
- `hero-document-sync` v10: 651 Dokumente synchronisiert
- `monday-push` Edge Function (NEU): Pusht nach Monday.com

**Vorherige Session (~09:00):**
- Hero Webhook-Recherche: Keine native Webhook-API (nur Polling)
- Cron optimiert: `*/5 6-19 * * *` (alle 5 Min, nur tagsüber)

**Vorherige Session (~04:15):**
- `softr_dokumente` + `dokumente` → einheitliche Tabelle (1.835 Docs)
- 642 PDFs von Hero → Supabase Storage synchronisiert
- Edge Functions: `classify-pdf`, `summarize-document`, `hero-pdf-sync`

**Vorherige Session (VBW LV 2026):**
- VBW Entscheidungsgrundlage HTML + PDF erstellt
- Preisvergleich 2023 vs. 2026 mit GWS-Referenzpreisen
- Leerstandskosten-Berechnung: 357.000 €/Jahr bei 3 Wochen Verzögerung

**PDF-Generator (global nutzbar):**
- Puppeteer-basierte HTML→PDF Konvertierung
- Templates für Rechnungen und Angebote
- neurealis Corporate Design integriert
- Pfad: `C:\Users\holge\shared\lib\pdf-generator.mjs`

**Verwendung:**
```javascript
import { generateInvoice, generateQuote, generatePDFFromHTML } from 'C:/Users/holge/shared/lib/pdf-generator.mjs';

await generateInvoice({ rechnungsnummer: 'RE-2026-001', kunde: {...}, positionen: [...] }, 'rechnung.pdf');
await generateQuote({ angebotsnummer: 'ANG-2026-001', ... }, 'angebot.pdf');
await generatePDFFromHTML('<h1>Dokument</h1>', 'output.pdf');
```

**CLI:**
```bash
node C:\Users\holge\shared\lib\pdf-generator.mjs input.html output.pdf
```

---

## Session davor (2026-01-27)

**Einkauf-Erweiterung & Sidebar-Restructuring:**
- Sidebar: Einkauf als aufklappbares Untermenü (Übersicht, Bestellung, Bestellungen, LV-Export)
- LV-Export: Kunden-LV Auswahl mit farbigen Badges (GWS, VBW, Covivio, neurealis)
- Design auf eckig (border-radius: 0) umgestellt für Softr-Rot Look
- pgvector Similarity-Suche für LV-Positionen (3.057 mit Embeddings)
- Edge Function `search-lv` deployed für semantische KI-Suche
- Einkauf-UI: Text/KI-Suche Toggle für LV-Positionen

**Neue SQL-Funktion:**
```sql
search_lv_positions(query_embedding, match_count, filter_lv_typ, filter_gewerk)
```

**Neue Edge Function:**
- `search-lv` - Nimmt Suchanfrage, generiert Embedding, findet ähnliche LV-Positionen

---

## Session davor (2026-01-28)

**BV-Übersicht Redesign:**
- Phasen-Tabs (0-6) mit Anzahl-Badges
- Phasenspezifische Tabellenspalten wie in Softr-Original
- Suchfeld über alle Projekte
- Mobile Cards-Ansicht
- Mängel/Nachträge-Badges in Tabelle

---

*Aktualisiert: 2026-01-28 23:00*
