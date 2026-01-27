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

## Business / Wohnungssanierung

### L013 - Leerstandskosten als Verhandlungsargument
**Datum:** 2026-01-27
**Kontext:** VBW-Preisverhandlung LV 2026
**Erkenntnis:** Leerstandskosten sind ein starkes Argument für Prozessoptimierung
**Formel:** `Wohnungen/Jahr × Verzögerungswochen × Ø-Fläche × €/m²/Monat ÷ 4`
**Beispiel VBW:** 280 WE × 3 Wochen × 60m² × 8,50€ ÷ 4 = **357.000€/Jahr**

### L014 - Ausreißer-Analyse für LV-Verhandlungen
**Datum:** 2026-01-27
**Kontext:** VBW LV 2026 vs. GWS-Marktpreise
**Methode:**
1. Altes LV (2023) gegen neues LV (2026) vergleichen
2. Referenz-BVs als Praxistest (verschiedene Größen)
3. Markt-LV (z.B. GWS) als externe Benchmark
4. Ausreißer sortiert nach Abweichung präsentieren
**Kritische Schwellen:** >25% Abweichung = Gesprächsbedarf

### L015 - Materialvorschläge dokumentieren
**Datum:** 2026-01-27
**Erkenntnis:** Bei LV-Verhandlungen immer konkrete Alternativen nennen
**Wichtige Kriterien:**
- Verfügbarkeit (Lieferzeiten)
- EK-Preis
- Qualität (z.B. DK02 nicht rutschhemmend → Kermos)
- Markenakzeptanz beim Auftraggeber

### L016 - Prozessoptimierung bei Wohnungssanierung
**Datum:** 2026-01-27
**Problem:** 3 Wochen Verzögerung zwischen Auszug und Baustart
**Ursache:** BL-Zuweisung erst nach Auszug, dann erst Begehung/Budget
**Lösung:**
- BL direkt bei Kündigung zuweisen (nach Straßen/Regionen)
- Erstbegehung 1-2 Wochen nach Kündigung (bewohnte Wohnung)
- Budget-Freigabe vor Auszug
- Direkter Baustart nach Auszug
**Risiko:** Mängel bei Begehung nicht sichtbar → Nachträge einplanen

### L017 - VBW Zahlungsziel-Argumentation
**Datum:** 2026-01-27
**Ziel:** 14 Tage netto beibehalten (statt 30 netto / 14-3%)
**Argumente:**
- NUs sind kleine Betriebe, brauchen schnelle Zahlung
- Gute NUs durch pünktliche Zahlung halten
- Vorleistung bei Material (Lagerware) ermöglicht bessere EK-Konditionen
- Funktionierendes System nicht ändern
**Red Line:** Maximal 21 Tage netto ohne Skonto

### L018 - VBW LV 2026 - Kritische Positionen
**Datum:** 2026-01-27
**Top-Ausreißer (Unterdeckung):**
| Pos. | Position | Abweichung | Mindestpreis |
|------|----------|------------|--------------|
| 3.3 | Küchenstränge | -72% | 800€ |
| 1.5 | Elektroschlitze | -54% | - |
| 2.1 | E-Anlage | -44% | 3.800€ |
| 6.3 | Vinyl-Boden | -40% | 28€/m² |
| 7.2 | WE-Tür | -25% | 1.260€ |

### L019 - VBW Material-Freigaben
**Datum:** 2026-01-27
**Genehmigte Alternativen:**
| Position | Aktuell | Vorschlag | Vorteil |
|----------|---------|-----------|---------|
| Schalter | Gira E2 | Gira Standard 55 | Günstiger, gleiche Qualität |
| Badlüfter | Ritzer Limodor | Maico ECA 100 ipro K | Nachlauf, Verfügbarkeit |
| Sanitär | diverse | Vigour One | Preis-Leistung |
| Fliesen | DK02 | Kermos 8mm | Rutschhemmend! |
| Sockelleisten | Holz | KSO Kunststoff | Günstiger |
| Innentüren | Jeld-Wen | Prüm Röhrenspahn | Kostenoptimiert |
| WE-Tür | Jeld-Wen | Prüm KK2 RC2 | - |
| Beschläge | Griffwerk | Becher/Hoppe Amsterdam | Preis |

---

## Deployment

### L020 - Svelte 5 @const Placement
**Datum:** 2026-01-28
**Problem:** `{@const}` direkt in `<div>` verursacht Build-Fehler
**Lösung:** `{@const}` muss innerhalb von `{#if}`, `{#each}`, `{:else}`, etc. sein
**Beispiel:**
```svelte
<!-- FALSCH -->
<div>
  {@const wert = berechnung()}
  {wert}
</div>

<!-- RICHTIG -->
{#if true}
  {@const wert = berechnung()}
  <div>{wert}</div>
{/if}
```

### L021 - Netlify adapter-netlify: Edge Functions bevorzugen
**Datum:** 2026-01-28
**Problem:** 404 nach Deploy trotz korrekter Functions
**Ursache:** Regular Functions (`edge: false`) funktionierten nicht zuverlässig
**Lösung:** `edge: true` in svelte.config.js verwenden
```javascript
adapter: adapter({
  edge: true,  // <- wichtig!
  split: false
})
```
**Vorteil:** Edge Functions sind schneller und zuverlässiger

---

*Aktualisiert: 2026-01-28 23:30*
