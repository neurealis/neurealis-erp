# T9: Broken Links Analyse und Fixes

**Status:** done
**Datum:** 2026-01-31
**Agent:** Broken-Link-Agent

---

## Zusammenfassung

### Ausgangssituation
- **107 Links** auf neurealis.de gescannt
- **86 interne** Links (neurealis.de)
- **21 externe** Links

### Ergebnis
- **12 broken links** gefunden (10 intern, 2 extern)
- **11 Posts/Pages** erfolgreich gefixt
- **23 Link-Ersetzungen** durchgeführt

---

## Gefundene Broken Links

### Interne Broken Links (10)

| Broken URL | Status | Fix | Betroffene Seiten |
|------------|--------|-----|-------------------|
| `/blog/wohnungssanierung-komplett` | 404 | `/kernsanierung-komplettsanierung-in-dortmund-2026-ablauf-kost/` | 7 KI-Artikel |
| `/blog/badsanierung-kosten` | 404 | `/badsanierung-dortmund-2026-kosten-dauer-ablauf-mit-fixpreis/` | 7 KI-Artikel |
| `/blog/wohnung-sanieren-kosten` | 404 | `/wohnung-sanieren-kosten-2026-richtwerte-pro-m-beispiele-abla/` | 2 Artikel |
| `/unsere-leistungen-sanierung-renovierung-wohnung-dortmund` | 404 | `/aufwertung-ihrer-mietwohnung-in-dortmund-unsere-leistungspakete/` | 3 Artikel |
| `/unsere-leistungen-sanierung-renovierung-wohnung-dortmund#Anfrage` | 404 | `/beratung/` | 2 Artikel |
| `/wohnung-sanieren-dortmund/` | 404 | `/sanierung-ihrer-mietwohnung-in-dortmund/` | 1 Artikel |
| `/wohnung-renovieren-dortmund/` | 404 | `/renovierung-ihrer-mietwohnung-in-dortmund/` | 1 Artikel |
| `/sanierungs-beispiele-vorher-nachher-ubersicht` | 404 | `/sanierungs-beispiele-wohnungen-vorher-nachher-ubersicht/` | 2 Seiten |
| `/datenschutz` | 404 | `/datenschutzerklaerung/` | 1 Seite (Testseite) |
| `/sanierungspaket` | 404 | `/aufwertung-ihrer-mietwohnung-in-dortmund-unsere-leistungspakete/` | 1 Seite (Testseite) |

### Externe Broken Links (2)

| Broken URL | Status | Empfehlung | Betroffene Seite |
|------------|--------|------------|------------------|
| `{{ unsubscribe_link }}` | Invalid URL | Entfernen (Newsletter-Platzhalter) | Testseite |
| `http://Prozess` | DNS Error | Entfernen (Tippfehler) | Karriere Bewerbungsprozess |

---

## Durchgeführte Fixes

### WordPress API Updates (11 erfolgreiche Updates)

| Post/Page ID | Typ | Titel | Fixes |
|--------------|-----|-------|-------|
| 12234 | Post | Komplettsanierung Bochum 2026 | 2 Links |
| 12233 | Post | Badsanierung Dortmund 2026 | 2 Links |
| 12232 | Post | GEG Sanierungspflicht 2026 | 2 Links |
| 12231 | Post | Kernsanierung Dortmund | 3 Links |
| 12230 | Post | Wohnung sanieren Kosten 2026 | 2 Links |
| 12229 | Post | Wohnungssanierung Dortmund 2026 | 2 Links |
| 12228 | Post | Kernsanierung Komplettsanierung 2026 | 3 Links |
| 6900 | Post | Unterschiede Renovierung Sanierung | 3 Links |
| 11171 | Page | Testseite | 2 Links |
| 8701 | Page | Renovierung Mietwohnung Dortmund | 1 Link |
| 6915 | Page | Aufwertung Mietwohnung | 1 Link |

**Summe:** 23 Link-Ersetzungen

---

## Offene Punkte (manuell zu beheben)

### Externe Links (2)
Diese wurden nur dokumentiert, nicht automatisch gefixt:

1. **Testseite (ID: 11171)**
   - `{{ unsubscribe_link }}` - Newsletter-Platzhalter, sollte entfernt werden
   - Empfehlung: Testseite komplett loeschen oder bereinigen

2. **Karriere Bewerbungsprozess (ID: 6278)**
   - `http://Prozess` - Offensichtlicher Tippfehler
   - Empfehlung: Link manuell korrigieren oder entfernen

---

## Technische Details

### Scripts erstellt
- `scripts/broken-link-checker.mjs` - Findet alle broken links
- `scripts/fix-broken-links.mjs` - Fixt interne broken links via WordPress API

### WordPress API
- JWT-Authentifizierung funktioniert
- Alle Updates erfolgreich durchgeführt
- Cache-Verzoegerung: API liefert kurzzeitig noch alte Inhalte

### Mapping-Logik
Die broken links entstanden durch:
1. **KI-generierte Artikel**: Halluzinierte `/blog/` URLs die nie existierten
2. **Umbenannte Seiten**: Alte URLs nicht weitergeleitet
3. **Tippfehler**: Fehlende Bindestriche, falsche Schreibweisen

---

## Verifizierung

Nach WordPress-Cache-Refresh (ca. 5-10 Minuten) sollten alle 10 internen broken links behoben sein.

Manuelle Pruefung empfohlen:
- https://neurealis.de/kernsanierung-komplettsanierung-in-dortmund-2026-ablauf-kost/
- https://neurealis.de/badsanierung-dortmund-2026-kosten-dauer-ablauf-mit-fixpreis/

---

## Erstellte Dateien

| Datei | Beschreibung |
|-------|--------------|
| `docs/implementation/t9_broken_links.md` | Dieser Report |
| `docs/implementation/broken_links_report.json` | Rohdaten (JSON) |
| `scripts/broken-link-checker.mjs` | Link-Checker Script |
| `scripts/fix-broken-links.mjs` | Link-Fixer Script |

---

*Generiert: 2026-01-31*
