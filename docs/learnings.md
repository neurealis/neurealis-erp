# Learnings - neurealis ERP

**Stand:** 2026-01-27

---

## UX/Design

### L001 - Softr Tab-Überladung vermeiden
**Datum:** 2026-01-27
**Problem:** Das interne Softr-Portal hat 20+ Tabs pro Bauvorhaben → kognitive Überlastung
**Lösung:** Progressive Disclosure, Accordion-Pattern, nur relevante Infos je nach Phase zeigen

### L002 - Horizontales Scrollen ist Gift
**Datum:** 2026-01-27
**Problem:** Tabellen mit 15+ Spalten sind auf Mobile unbrauchbar
**Lösung:** Spalten-Konfigurator, wichtige Spalten fixieren, Card-Layout für Mobile

### L003 - Redundanz eliminieren
**Datum:** 2026-01-27
**Problem:** Gleiche Infos in mehreren Tabs führen zu Inkonsistenzen
**Lösung:** Single Source of Truth, nur an einer Stelle editierbar

---

## Technisch

### L004 - Supabase MCP direkt nutzen
**Datum:** 2026-01-26
**Problem:** Manuelle SQL-Migrations sind fehleranfällig
**Lösung:** `mcp__supabase__apply_migration` für DDL, `mcp__supabase__execute_sql` für Queries

### L005 - gpt-5.2 nicht gpt-5.2-mini
**Datum:** 2026-01-26
**Problem:** GPT-5.2-mini hat schlechtere Ergebnisse beim Parsen
**Lösung:** Immer gpt-5.2 (Hauptmodell) verwenden

### L006 - Umlaute korrekt verwenden
**Datum:** 2026-01-26
**Problem:** ae/oe/ue sieht unprofessionell aus
**Lösung:** UTF-8 überall, deutsche Umlaute (ä, ö, ü, ß) verwenden

---

## Workflow

### L007 - Edge Functions in functions/supabase/functions/
**Datum:** 2026-01-26
**Problem:** Verschiedene Pfade für Functions
**Lösung:** Alle Edge Functions unter `functions/supabase/functions/`

### L008 - Parallele Subagenten für schnelle UI-Entwicklung
**Datum:** 2026-01-27
**Problem:** Sequentielle Seitenentwicklung ist langsam
**Lösung:** Task-Tool mit mehreren parallelen Subagenten (bis zu 6 gleichzeitig)
**Ergebnis:** 11 Seiten in ~30 Minuten statt mehreren Stunden

### L009 - Svelte 5 Snippet-Namen ohne Bindestriche
**Datum:** 2026-01-27
**Problem:** `{#snippet user-info()}` verursacht Syntax-Fehler
**Lösung:** Keine Bindestriche in Snippet-Namen, oder Props statt Snippets verwenden

### L010 - Windows-Pfade in Bash problematisch
**Datum:** 2026-01-27
**Problem:** `cd C:\Users\...` funktioniert nicht in Bash-Umgebung
**Lösung:** Dev-Server manuell in PowerShell starten: `cd ui && npm run dev`

---

## Hero API

### L011 - Hero invoice_style für Teil/Schlussrechnungen
**Datum:** 2026-01-27
**Problem:** Bisherige Fallback-Logik (Projekt-Phase, höchste RE-Nr) war unzuverlässig
**Lösung:** `metadata.invoice_style` direkt aus Hero API nutzen:
- `full` → AR-S (Schlussrechnung)
- `parted`/`cumulative`/`downpayment` → AR-A (Abschlag)
- `null` → Ignorieren (Entwurf)
**Doku:** `docs/HERO_RECHNUNGSSYNC_API.md`

### L012 - Hero Schlussrechnung = Restbetrag
**Datum:** 2026-01-27
**Problem:** Annahme dass Schlussrechnung Gesamtbetrag enthält
**Wahrheit:** Bei vorherigen Teilrechnungen enthält die Schlussrechnung nur den **Differenzbetrag**
**Beispiel:** Projekt mit 2 Teilrechnungen (4.500€ + 5.000€) hat Schlussrechnung von nur 8.900€ (Rest)

---

*Aktualisiert: 2026-01-27*
