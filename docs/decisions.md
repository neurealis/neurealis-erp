# Decisions - neurealis ERP

**Stand:** 2026-01-27

---

## Architektur

### D001 - Ein Portal statt drei
**Datum:** 2026-01-27
**Entscheidung:** Eine SvelteKit-App mit Supabase RLS für rollenbasierte Zugriffskontrolle
**Grund:** Weniger Wartungsaufwand, gemeinsame Komponenten, konsistente UX
**Alternativen verworfen:** 3 separate Apps (zu viel Duplikation), Hybrid (unnötige Komplexität)

### D002 - Internes Portal zuerst migrieren
**Datum:** 2026-01-27
**Entscheidung:** Das interne Mitarbeiter-Portal wird als erstes migriert
**Grund:** Umfangreichste Funktionalität, wenn das funktioniert, sind Kunden/NU-Portale einfacher
**Reihenfolge:** Intern → Kunden → Partner

### D003 - Responsive Design von Anfang an
**Datum:** 2026-01-27
**Entscheidung:** Desktop und Mobile gleichwertig entwickeln
**Grund:** Bauleiter nutzen Handy auf Baustelle, Büro arbeitet am Desktop

---

## Features

### D004 - Feature-Reihenfolge
**Datum:** 2026-01-27
**Entscheidung:** Priorisierte Reihenfolge der Feature-Migration
**Reihenfolge:**
1. BV-Übersicht + Dashboard (Basis)
2. Mängelmanagement (täglich genutzt)
3. Nachträge (Budget-relevant)
4. Rechnungen/Budget (Controlling)

### D005 - Tab-Struktur neu denken
**Datum:** 2026-01-27
**Entscheidung:** Statt 20 horizontaler Tabs: Phasen-basierte Ansicht mit Accordion
**Grund:** Progressive Disclosure reduziert kognitive Last
**Umsetzung:** Nur relevante Felder je nach BV-Phase anzeigen

---

## Technisch

### D006 - Supabase als einziges Backend
**Datum:** 2026-01-27
**Entscheidung:** Alle Daten in Supabase, Monday.com/Softr nur noch für Sync (Legacy)
**Grund:** Eine Wahrheitsquelle, RLS für Zugriffskontrolle, Edge Functions für Logik

### D007 - Netlify für Hosting
**Datum:** 2026-01-27
**Entscheidung:** SvelteKit UI auf Netlify hosten
**URL:** https://neurealis-erp.netlify.app

---

## Hero Integration

### D008 - invoice_style statt Fallback-Logik
**Datum:** 2026-01-27
**Entscheidung:** Hero `metadata.invoice_style` für Dokumenttyp-Klassifizierung nutzen
**Mapping:**
- `full` → AR-S (Schlussrechnung)
- `parted`, `cumulative`, `downpayment` → AR-A (Abschlag)
- `null` → Nicht synchronisieren (Entwurf)
**Grund:** Direkte API-Information ist zuverlässiger als Fallback-Heuristik
**Verworfen:** Alte Logik über Projekt-Phase oder höchste Rechnungsnummer

---

## Dokumente / RAG

### D009 - Separate document_summaries Tabelle
**Datum:** 2026-01-28
**Entscheidung:** Summaries in eigener Tabelle statt in softr_dokumente
**Grund:** `softr_dokumente` ist ein VIEW, keine Tabelle - Spalten können nicht hinzugefügt werden
**Struktur:** `dokument_nr` (PK), `zusammenfassung`, `is_native`, `processed_at`

### D010 - Hybrid: Cron + Trigger für Summarization
**Datum:** 2026-01-28
**Entscheidung:** Cron-Job für Backlog + Trigger für neue Dokumente
**Implementierung:**
1. **Cron-Job** (`document-summarize-job`): Verarbeitet bestehende ~1.044 Dokumente
   - Schedule: alle 15 Min, 20 Docs/Batch
   - Kann nach Abschluss deaktiviert werden
2. **Trigger** (`on_document_pdf_added`): Für neue Dokumente
   - Feuert bei INSERT oder UPDATE von `datei_url`
   - Ruft Edge Function mit einzelnem `dokument_nr` auf
**Grund:** Trigger auf `dokumente` Tabelle (nicht VIEW), Cron für initialen Backlog

---

## Monday.com Integration

### D011 - Bidirektionaler Monday-Sync
**Datum:** 2026-01-28
**Entscheidung:** Separate Functions für Pull und Push
**Implementierung:**
- `monday-sync`: Pullt Daten VON Monday nach Supabase (existierend)
- `monday-push`: Pusht Daten VON Supabase nach Monday (NEU)
**Grund:** Trennung der Zuständigkeiten, einfacheres Debugging
**Alternative verworfen:** Bidirektionale Sync in einer Function (zu komplex)

### D012 - NUA-Budget = 75% von AB
**Datum:** 2026-01-28
**Entscheidung:** NUA-Nettobeträge werden automatisch auf 75% der AB-Summe gesetzt
**Grund:** Standardmarge von 25% bei VBW-Projekten
**Zuordnung:** Über ATBS-Nummer (eindeutig pro Projekt)
**Implementierung:** SQL-Update bei neuen VBW-Projekten

---

## E-Mail Integration

### D013 - E-Mail-Import in dokumente-Tabelle
**Datum:** 2026-01-28
**Entscheidung:** E-Mails und Anhänge werden als Dokumente in `dokumente` gespeichert
**Dokumenttypen:**
- `E-MAIL` - E-Mail-Körper (raw_text = Body)
- `E-ANH` - E-Mail-Anhang (datei_url = Storage URL)
**Grund:** Einheitliche Dokumenten-Pipeline, RAG-kompatibel, bestehende Summarization nutzbar
**Alternative verworfen:** Separate `emails`-Tabelle (zu viel Duplikation)

### D014 - Separate email_details Tabelle
**Datum:** 2026-01-28
**Entscheidung:** E-Mail-spezifische Metadaten in eigener Tabelle `email_details`
**Felder:** message_id, from_address, body_html, received_at, etc.
**Verknüpfung:** 1:1 mit dokumente via dokument_id
**Grund:** dokumente-Tabelle bleibt schlank, E-Mail-Metadaten bei Bedarf zugreifbar

### D015 - Matching-Kaskade für Kontakt-Zuordnung
**Datum:** 2026-01-28
**Entscheidung:** 4-stufige Kaskade für automatische Zuordnung
**Reihenfolge:**
1. Domain-Matching (Absender-Domain → kontakt_domains)
2. Pattern-Matching (ATBS-Nr, RE-Nr aus Betreff/Body)
3. Postfach-Logik (rechnungen@ → ER-*, bewerbungen@ → Tag)
4. Kontakt-Anlage (unbekannte Absender → neuer Kontakt)
**Grund:** Maximale Automatisierung, minimaler manueller Aufwand

---

## Daten-Backup / Wiederherstellung

### D016 - Softr-Beträge-Backup aufbewahren
**Datum:** 2026-01-28
**Entscheidung:** `docs/softr_amounts_backup.json` wird dauerhaft aufbewahrt
**Inhalt:** 2.515 Dokumente mit Netto/Brutto/Bezahlt/Offen aus Softr.io
**Zweck:** Backup für eventuelle Wiederherstellung bei Sync-Fehlern
**Dokumenttypen enthalten:**
- RE-* (418 Rechnungen)
- ANG-* (860 Angebote)
- ER-* (605 Eingangsrechnungen)
- AB-* (301 Auftragsbestätigungen)
- AR-* (144 Ausgangsrechnungen-Zahlungen)
- NUA-* (50 Nachunternehmer-Aufträge)
**Pfad:** `docs/softr_amounts_backup.json`
**Erstellt:** 2026-01-28 durch Softr.io API Export

### D017 - Hero-Sync: Beträge nur überschreiben wenn Quelle Wert hat
**Datum:** 2026-01-28
**Entscheidung:** `hero-document-sync` überschreibt Beträge NUR wenn Hero tatsächlich Werte liefert
**Grund:** Bug-Fix - vorherige Version überschrieb mit 0 wenn Hero keinen Wert hatte
**Implementierung:** Bedingte Feld-Aufnahme ins Upsert-Record
**Betroffene Datei:** `functions/supabase/functions/hero-document-sync/index.ts`

---

## Marketing / Blog

### D018 - 3-Agenten-Blog-Pipeline
**Datum:** 2026-01-28
**Entscheidung:** Automatisierte Blog-Erstellung mit 3-Agenten-Hierarchie
**Agenten:**
1. **Redaktionschef** (blog-editor): Themenwahl basierend auf AHREFS-Keywords + Trends
2. **Recherche-Agent** (blog-research): Web-Recherche via OpenAI Responses API
3. **Writer-Agent** (blog-writer): Artikel schreiben mit Querverlinkung
**Trigger:** Täglicher Cron-Job (08:00 UTC)
**Grund:** Skalierbare SEO-Content-Erstellung für B2C-Markt-Eroberung
**Alternative verworfen:** Manuelles Schreiben (nicht skalierbar), Single-Agent (zu komplex)

### D019 - Embedding-basierte Querverlinkung
**Datum:** 2026-01-28
**Entscheidung:** Blog-Posts erhalten vector(1536) Embeddings für Similarity Search
**Implementierung:**
- `search_similar_blog_posts()` RPC für ähnliche Artikel
- Writer-Agent erhält Top-5 ähnliche Posts für interne Verlinkung
- Wöchentlicher `blog-crosslink` Job für Nachvernetzung
**Grund:** SEO-Boost durch interne Verlinkung, Domain Rating erhöhen

### D020 - OpenAI Responses API für Web-Recherche
**Datum:** 2026-01-28
**Entscheidung:** `web_search_preview` Tool in OpenAI Responses API nutzen
**Grund:** Native Integration, keine zusätzliche API (z.B. Tavily) nötig
**Einschränkung:** Abhängig von OpenAI-Verfügbarkeit des Tools

---

## Dokumentenmanagement

### D021 - Telegram-Bot als primäre Baustellen-Kommunikation
**Datum:** 2026-01-29
**Entscheidung:** @neurealis_bedarfsanalyse_bot für Fotos, Mängel, Nachträge, Sprache
**Nutzergruppen (Phasen):**
1. Mitarbeiter (Bauleiter, Handwerker)
2. Nachunternehmer
3. Endkunden (perspektivisch)
**Grund:** Mobile-first, mehrsprachig (DE, RU, HU, RO, PL), keine App-Installation nötig
**Alternative verworfen:** Native App (zu aufwendig), WhatsApp (DSGVO-Probleme)

### D022 - 4-Stufen-Sicherheitskonzept
**Datum:** 2026-01-29
**Entscheidung:** Dokumente erhalten `sicherheitsstufe` (1-4):
| Stufe | Zugriff | SharePoint-Sites |
|-------|---------|------------------|
| 1 | Alle Mitarbeiter | Projekte, Marketing, Kunden |
| 2 | Bauleiter + GF | Vertrieb, Großhandel |
| 3 | GF + Buchhaltung | Finanzen |
| 4 | Nur GF | Personal, Management |
**Grund:** RLS-basierte Zugriffskontrolle ohne manuelle Rechtevergabe
**Implementierung:** Automatisch beim SharePoint-Sync basierend auf Site

### D023 - Fotos-Tabelle für strukturierte Verwaltung
**Datum:** 2026-01-29
**Entscheidung:** Eigene `fotos`-Tabelle statt nur in `dokumente`
**Felder:** kategorie, nachweis_typ, gewerk, mangel_id, nachtrag_id, GPS, Vision-Labels
**Kategorien:** mangel, nachtrag, nachweis, doku, bedarfsanalyse, kunde, bauplan
**Grund:** Strukturierte Foto-Verwaltung, Rollen-basierter Zugriff, Vision-AI vorbereitet
**Alternative verworfen:** Alles in dokumente (zu unstrukturiert für Fotos)

### D024 - SharePoint-Sync: Videos nur verlinken
**Datum:** 2026-01-29
**Entscheidung:** Videos (MP4, MOV) werden NICHT nach Supabase kopiert
**Stattdessen:** Nur SharePoint-Link in `sharepoint_link` speichern
**Download:** PDF, DOCX, XLSX, JPG, PNG (< 50 MB)
**Grund:** Videos zu groß (~25 GB allein Marketing-Videos), Storage-Kosten
**Vorteil:** Metadaten + Suche trotzdem möglich

### D025 - 2-Phasen-Erinnerung für Mängelmanagement
**Datum:** 2026-01-29
**Entscheidung:** Automatischer Phasenwechsel basierend auf Nachweis-Foto
**Phasen:**
- Phase 1: NU erhält Erinnerungen bis `fotos_nachweis_nu` befüllt
- Phase 2: Bauleiter erhält Erinnerungen zur Abnahme
**Trigger:** Foto-Upload durch NU wechselt automatisch zu Phase 2
**Stopp:** `status_mangel` = 'Abgenommen' oder `erinnerung_status` = 'Pausiert'
**Default:** Neue Mängel starten mit `erinnerung_status = 'Aktiv'`
**Grund:** Kein manueller Statuswechsel nötig, Workflow folgt natürlichem Ablauf
**Alternative verworfen:** Manuelles Umschalten zwischen NU/BL-Erinnerung

### D026 - WordPress-Sync: Sofort-Veröffentlichung bei Freigabe
**Datum:** 2026-01-29
**Entscheidung:** Bei Freigabe im ERP wird Artikel direkt auf WordPress veröffentlicht
**Modi der Edge Function:**
- `freigeben`: Push + sofort `status: 'publish'`
- `draft`: Nur Entwurf zur Vorschau
- `unpublish`: Zurück auf Draft setzen
**Grund:** Kein manuelles Zwischenschalten in WordPress nötig
**Alternative verworfen:** Erst Draft pushen, dann manuell veröffentlichen (zu viele Schritte)

---

## LV-Synchronisation

### D027 - Supabase als LV-Master
**Datum:** 2026-01-30
**Entscheidung:** Supabase `lv_positionen` ist die Single Source of Truth für alle LV-Positionen
**Synchronisation:**
- **Hero Software:** Bidirektional (hero-lv-sync pull, lv-hero-push push)
- **Softr.io:** Bidirektional (lv-softr-push push, softr-poll geplant)
**Loop-Vermeidung:** `source` Spalte verhindert Ping-Pong-Syncs
**Grund:** Zentrale Verwaltung, alle Features (Embeddings, KI-Suche) in Supabase

### D028 - Automatische Preis-Historisierung
**Datum:** 2026-01-30
**Entscheidung:** Alle Preisänderungen werden automatisch in `lv_preis_historie` protokolliert
**Trigger:** `trg_lv_preis_historie` bei UPDATE auf lv_positionen
**Inhalt:** Alter/neuer Preis, prozentuale Änderung, Quelle, Datum
**Grund:** Nachvollziehbarkeit für LV-Verhandlungen, keine manuelle Dokumentation nötig

### D029 - LV-Typ "Privat" in "neurealis" konsolidiert
**Datum:** 2026-01-31
**Entscheidung:** LV-Typ "Privat" wird nicht mehr verwendet - alle Positionen sind jetzt "neurealis"
**Migration:** 281 Positionen von "Privat" → "neurealis"
**Ergebnis:** neurealis LV hat 693 Positionen für B2C-Privatkundenangebote
**Grund:** Embedding-Suche funktioniert besser mit einem konsolidierten LV-Typ
**Backup:** `docs/backups/2026-01-30_lv_positionen_privat_to_neurealis.json`

---

## Angebots-CPQ

### D030 - Angebots-Struktur: Gewerk-basiert als Standard
**Datum:** 2026-01-30
**Entscheidung:** MVP strukturiert Angebote nach Gewerken (nicht Räumen)
**Optionen:**
- Nach Gewerken: Elektrik, Sanitär, Maler, Boden, etc.
- Nach Räumen: Wohnzimmer, Schlafzimmer, Bad, etc.
**Grund:** Gewerk-Struktur entspricht LV-Struktur, einfachere Implementierung
**Phase 2:** Raum-basierte Struktur als Option hinzufügen

### D031 - Abhängigkeiten: Regelbasiert vor ML
**Datum:** 2026-01-30
**Entscheidung:** MVP nutzt deterministische Regeln, ML-Lernen in Phase 3
**Regelquellen:**
1. LV-Langtext-Analyse (automatisch via GPT)
2. Admin-Regeln (manuell gepflegt)
3. Kundenspezifische Regeln (per Textfeld eingeben)
**Verworfen für MVP:** Association Rules aus Rechnungshistorie (zu komplex)
**Grund:** Kontrollierte Qualität, schnellere Implementierung

### D032 - Dokument-Workflow: ANG → AB → NUA → RE
**Datum:** 2026-01-30
**Entscheidung:** Dokumente werden sequentiell aus Vorgänger generiert
**Workflow:**
1. Angebot (ANG) erstellen mit Positionen, Mengen, Preisen
2. Auftrag erteilt → Auftragsbestätigung (AB) aus letztem ANG
3. NU auswählen → NUA aus AB (ohne Preise, mit Budget)
4. Fertigstellung → Rechnung (RE)
**NUA-Besonderheit:** Keine Preise, aber: Budget, Start/End, Abschlag, Vertragswerk
**Grund:** Konsistente Daten durch Vererbung, weniger Fehler

### D033 - PDF-Generierung: jsPDF wiederverwenden
**Datum:** 2026-01-30
**Entscheidung:** Bestehende PDF-Generierung aus LV-Export für Angebote nutzen
**Technologie:** jsPDF + autotable (Browser-seitig)
**Anpassungen:**
- Deckblatt mit Kunde/Projekt
- Positionen gruppiert nach Gewerk
- Zusammenfassung mit Netto/MwSt/Brutto
- Annahme-Formular (letzte Seite)
**Verworfen:** PandaDoc (externe Abhängigkeit), Puppeteer (Server-seitig zu langsam)

### D034 - Hybrid-Prompt-Ansatz für transcription-parse
**Datum:** 2026-01-30
**Entscheidung:** Ein Prompt-Template mit LV-spezifischen Parametern statt komplett separate Prompts
**Implementierung:**
- Neue Tabelle `lv_config` für LV-spezifische Konfiguration
- Gewerke-Liste dynamisch aus DB laden
- LV-Besonderheiten (Zulagen, Staffeln) als Parameter
- Fallback-Suche ohne Gewerk-Filter wenn keine Treffer
**Grund:** Beste Balance zwischen Wartbarkeit und Genauigkeit
**Alternative verworfen:**
- Ein generischer Prompt (Gewerke-Mismatch, schlechte Treffer)
- 5+ komplett separate Prompts (zu viel Wartungsaufwand)

---

*Aktualisiert: 2026-01-30*
