# Telegram-Bot Universelle Sprachbefehle - Koordination

**Status:** ✅ FERTIG
**Datum:** 2026-02-01
**Deployed:** telegram-webhook v58
**Ziel:** Sprachbefehle für ALLE Aspekte (außer Bedarfsanalyse/Aufmaß) aus Haupt- und Untermenüs

---

## Anforderungen

| # | Feature | Status | Beschreibung |
|---|---------|--------|--------------|
| 1 | Status alle Gewerke | ⏳ | STATUS_MAPPING für alle 9 Gewerke (nicht nur Elektrik/Sanitär) |
| 2 | Sprache aus Hauptmenü | ⏳ | Befehle ohne vorher Projekt zu öffnen (ATBS aus Sprache extrahieren) |
| 3 | Termin-Befehle erweitert | ⏳ | "in 3 Wochen", "KW 12", "Ende März" |
| 4 | Mängel per Sprache | ⏳ | "Mangel Elektrik Steckdose Wohnzimmer locker" |
| 5 | Nachträge per Sprache | ⏳ | "Nachtrag Sanitär zusätzlicher Wasseranschluss" |
| 6 | Projekt-Suche per Sprache | ⏳ | "Öffne Projekt Bollwerkstraße" / "Zeige 456" |
| 7 | Hilfe-System | ⏳ | Verbesserte Hilfe mit Beispielen |

---

## Aktueller Stand (v57)

### GEWERK_SPALTEN (12 Einträge)
```typescript
'entkernung': 'gg2On',
'maurer': '67n4J',
'elektrik': '06reu',
'sanitär': 'GnADf',
'bad': 'GnADf',
'estrich': 'R2rLm',
'tischler': 'xhsH6',
'maler': 'uJfDu',
'boden': 'SqOwb',
'küche': 'fDlPT',
'reinigung': '5l7Rp',
'schlüssel': 'ZCX8v'
```

### STATUS_MAPPING (NUR 2 Gewerke!)
- `elektrik`: Fertig (Feininstallation), In Arbeit (Schlitze & Rohinstallation), Geplant, Verspätet
- `sanitär`: Fertig (Feininstallation), In Arbeit (Rohinstallation), Geplant, Verspätet
- `_default`: Fertig, In Arbeit, Geplant, Verspätet

**PROBLEM:** Monday lehnt Status-Änderungen ab wenn Label nicht exakt stimmt!

---

## Subagenten-Tasks

### T1: STATUS_MAPPING + GEWERK_SPALTEN korrigieren
**Dateien:** `functions/supabase/functions/telegram-webhook/index.ts`
**Aufgaben:**
- [ ] GEWERK_SPALTEN mit korrekten Monday-IDs aktualisieren
- [ ] STATUS_MAPPING für alle Gewerke erweitern
- [ ] mapStatusToMonday() für alle Gewerke korrekt implementieren

**Korrekte Monday Spalten-IDs (aus MONDAY_COLUMN_MAPPING.md):**
| Gewerk | Monday ID | Status-Labels |
|--------|-----------|---------------|
| Elektrik | `color58__1` | Geplant, In Arbeit (Rohinstallation), Fertig (Feininstallation), Verspätet |
| Sanitär | `color65__1` | Geplant, In Arbeit (Rohinstallation), Fertig (Feininstallation), Verspätet |
| Maler | `color63__1` | Geplant, In Arbeit, Fertig, Verspätet |
| Boden | `color8__1` | Geplant, Fertig, Verspätet |
| Tischler | `color98__1` | Geplant, In Arbeit, Fertig |
| Entkernung/Abbruch | `color05__1` | Geplant, In Arbeit, Fertig, Verspätet |

**Hinweis:** Die alten IDs (gg2On, 67n4J, etc.) sind FALSCH!

### T2: Sprach-Befehle aus Hauptmenü
**Dateien:** `functions/supabase/functions/telegram-webhook/index.ts`
**Aufgaben:**
- [ ] handleTextMessage() erweitern: Sprach-Befehl auch OHNE offenes Projekt erkennen
- [ ] ATBS-Nummer aus Spracheingabe extrahieren (z.B. "Setze 456 Elektrik auf fertig")
- [ ] Projekt automatisch aus ATBS laden wenn nicht in Session
- [ ] Projekt-Suche per Name: "Öffne Bollwerkstraße" → fuzzy match auf monday_bauprozess

### T3: Erweiterte Befehls-Parser
**Dateien:** `functions/supabase/functions/telegram-webhook/index.ts`
**Aufgaben:**
- [ ] parseDatum() erweitern: "in 3 Wochen", "KW 12", "Ende März"
- [ ] parseSprachBefehl() erweitern: Mangel, Nachtrag mit Gewerk+Beschreibung
- [ ] GPT-Prompt verbessern für komplexe Befehle
- [ ] Beispiele in SprachBefehl-Hilfe aktualisieren

### T4: QA-Agent (nach T1-T3)
**Aufgaben:**
- [ ] Code-Review aller Änderungen
- [ ] TypeScript-Typen prüfen
- [ ] Edge Cases identifizieren
- [ ] Test-Szenarien dokumentieren

---

## Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1 | ✅ | GEWERK_SPALTEN korrigiert (6 IDs), STATUS_MAPPING erweitert (7 Gewerke), GEWERK_ALIASES + normalizeGewerk() |
| T2 | ✅ | extractAtbsFromText verbessert, loadProjektByAtbs, searchProjektByName, handleSprachBefehl erweitert |
| T3 | ✅ | parseDatum erweitert (Wochen, KW, Monat), parseSprachBefehl erweitert (Mängel, Nachträge, Status-Abfrage) |
| T4 | ✅ | QA: 2 Fixes (Version, TERMIN_TYPEN-Duplikat), Test-Szenarien dokumentiert |

---

## Monday Status-Labels (Referenz aus Analyse)

Aus `monday_bauprozess.column_values` müssen die exakten Labels extrahiert werden.
Typische Pattern:
- "Geplant"
- "In Arbeit" / "In Arbeit (Details)"
- "Fertig" / "Fertig (Details)"
- "Verspätet"
- "Nicht beauftragt"
- "Wartend"

---

*Erstellt: 2026-02-01*
