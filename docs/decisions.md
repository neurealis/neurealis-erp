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

*Aktualisiert: 2026-01-28*
