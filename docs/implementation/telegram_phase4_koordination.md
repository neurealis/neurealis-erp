# Telegram-Bot Phase 4 - Koordination

**Status:** 🔄 IN ARBEIT
**Gestartet:** 2026-02-01
**Zielversion:** v59

---

## Anforderungen

| # | Feature | Status | Agent |
|---|---------|--------|-------|
| 1 | Tages-Dashboard beim /start | ⏳ | T1-DEV-BOT |
| 2 | Nummerierung ATBS-XXX-M1/N1 | ⏳ | T1-DEV-BOT |
| 3 | Baustellenbegehungsberichte | ⏳ | T2-DEV-BOT |
| 4 | Schnell-Nachricht an NU | ⏳ | T2-DEV-BOT |
| 5 | Projekt-Favoriten | ⏳ | T1-DEV-BOT |
| 6 | User-Guide PDF aktualisieren | ⏳ | T3-DEV-DOCS |

---

## Subagenten-Tasks

### T1: DEV-BOT-DASHBOARD (Hauptfeatures)

**Dateien:**
- `supabase/functions/telegram-webhook/index.ts`

**Aufgaben:**
- [ ] Tages-Dashboard beim /start: Überfällige Mängel, Termine heute, offene Nachträge
- [ ] Nummerierung Fix: `ATBS-456-M1` statt generischer IDs
- [ ] Projekt-Favoriten: Top 3 aktive Projekte als Quick-Buttons

**Datenquellen für Dashboard:**
```sql
-- Überfällige Mängel
SELECT * FROM maengel_fertigstellung
WHERE datum_frist < CURRENT_DATE
  AND status_mangel NOT IN ('Abgenommen', 'Abgeschlossen', 'Erledigt');

-- Offene Nachträge
SELECT SUM(summe_netto), COUNT(*) FROM nachtraege
WHERE status IN ('(0) Offen / Preis eingeben', '(1) gemeldet');
```

### T2: DEV-BOT-FEATURES (Berichte & Nachrichten)

**Dateien:**
- `supabase/functions/telegram-webhook/index.ts`

**Aufgaben:**
- [ ] Baustellenbegehungsberichte: Text/Sprache → dokumente Tabelle mit Typ 'BERICHT'
- [ ] Schnell-Nachricht an NU: Vordefinierte Templates + eigene Nachricht
- [ ] Callbacks: `bau:bericht`, `bau:nachricht:nu`

**Bericht-Schema:**
```sql
INSERT INTO dokumente (projekt_nr, dokumenttyp, titel, raw_text, erstellt_am, erstellt_von)
VALUES ('ATBS-456', 'BERICHT', 'Baustellenbegehung 01.02.2026', '...', NOW(), email);
```

### T3: DEV-DOCS (User-Guide Update)

**Dateien:**
- `docs/TELEGRAM_BOT_USER_GUIDE.html`
- `docs/TELEGRAM_BOT_USER_GUIDE.pdf`

**Aufgaben:**
- [ ] Neue Sektion: Tages-Dashboard
- [ ] Neue Sektion: Baustellenberichte
- [ ] Neue Sektion: NU-Schnellnachrichten
- [ ] Version auf v59 aktualisieren
- [ ] PDF neu generieren

### T4: QA-AGENT (nach T1-T3)

**Aufgaben:**
- [ ] Code-Review: Konsistenz, Fehlerbehandlung, deutsche Umlaute
- [ ] Edge Function Build testen
- [ ] Test-Szenarien dokumentieren

---

## Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1: DEV-BOT-DASHBOARD | ✅ Fertig | Dashboard, Nummerierung, Favoriten |
| T2: DEV-BOT-FEATURES | ✅ Fertig | Berichte, NU-Nachrichten |
| T3: DEV-DOCS | ✅ Fertig | User-Guide v59 aktualisiert |
| T4: QA-AGENT | ✅ Fertig | 1 Bug gefixt (titel → datei_name) |

## Audio-Briefing (Zusatz-Feature)

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1: DB-Migration | ✅ Fertig | audio_briefings Tabelle + Storage Bucket |
| T2: Edge Function | ✅ Fertig | audio-briefing-generate v1 deployed |
| T3: /briefing Befehl | ✅ Fertig | In telegram-webhook v60 integriert |
| T4: Cron-Job | ✅ Fertig | audio-briefing-daily (Mo-Fr 06:00 MEZ) |
| QA | ✅ Fertig | SQL-Filter korrigiert |

## Deployments

| Function | Version | Status |
|----------|---------|--------|
| telegram-webhook | v60 | ✅ Deployed |
| audio-briefing-generate | v1 | ✅ Deployed |

---

## Technische Details

### Aktueller Bot-Stand (v58)

- Universelle Sprachbefehle funktionieren
- GEWERK_SPALTEN mit korrekten Monday-IDs
- Phasen-Filter korrekt
- Multi-Foto-Upload implementiert

### Zu beachtende Learnings

- L006: Deutsche Umlaute (ä, ö, ü)
- L005: Immer gpt-5.2 verwenden
- D041: Monday Push via Trigger

---

*Erstellt: 2026-02-01*
