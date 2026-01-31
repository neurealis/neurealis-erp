# Blog-Optimierung Tracker V2

**Erstellt:** 2026-01-31
**Status:** In Arbeit

---

## Abgeschlossene Aufgaben (V1)

- [x] T1 - Leerstand-Artikel überarbeiten → `t1_leerstand_revision.md`
- [x] T2 - WordPress-Struktur analysieren → `t2_wordpress_struktur.md`
- [x] T3 - Eigenheim-Template erstellen → `t3_eigenheim_template.md`

---

## Neue Aufgaben (V2)

### T4 - WordPress → GitHub Backup
**Status:** done
**Subagent:** wordpress-backup-agent
**Output:** `docs/wordpress_backup/` + `t4_backup_report.md`
**Abgeschlossen:** 2026-01-31

**Ergebnis:**
- [x] 11 Posts als Markdown exportiert (132 KB)
- [x] 71 Pages als Markdown exportiert (1,2 MB)
- [x] metadata.json mit Kategorien/Tags erstellt
- [x] Frontmatter mit allen Metadaten
- [x] Keine Bilder (nur URLs dokumentiert)

---

### T5 - SEO-Lücken schließen
**Status:** done
**Subagent:** seo-fix-agent
**Output:** `t5_seo_fixes.md`
**Abgeschlossen:** 2026-01-31

**Ergebnis:**
- [x] 14 neue Tags erstellt (Kernsanierung, Komplettsanierung, Badsanierung, Bochum, Ruhrgebiet, NRW, Kosten, Förderung, KfW, Vermieter, Mietwohnung, Leerstand, GEG, Sanierungspflicht)
- [x] 3 neue Kategorien erstellt (Vermieter-Wissen, Regional, Sanierungsarten)
- [x] Alle 8 KI-Artikel mit Tags versehen
- [x] Alle 8 KI-Artikel in passende Kategorien eingeordnet
- [x] Featured Image für alle 8 Artikel gesetzt (ID 12028: qohnzimmer-quer.webp)
- [x] Interne Verlinkung dokumentiert (10 Empfehlungen für Content-Updates)

---

### T6 - Eigenheim-Template Kostenkorrektur
**Status:** done
**Subagent:** content-fix-agent
**Output:** `t6_eigenheim_korrigiert.md`
**Abgeschlossen:** 2026-01-31

**Korrektur durchgeführt:**
- [x] Kosten: 1.000-1.200 EUR/m² (war 682 EUR/m²)
- [x] Reihenhaus 110 m² = **121.000 EUR** (war 75.000 EUR)
- [x] Beispielrechnung komplett neu berechnet
- [x] Alle Preisangaben im Artikel geprüft und korrigiert
- [x] Neue FAQ zu Quadratmeterpreisen hinzugefügt
- [x] Fenster (18.000 EUR) als typische Maßnahme ergänzt

---

### T7 - Artikel nach WordPress hochladen (mit Layout)
**Status:** done
**Subagent:** wordpress-upload-agent
**Output:** `t7_upload_report.md`
**Abgeschlossen:** 2026-01-31

**Ergebnis:**
- [x] Leerstand-Artikel (ID 12235) aktualisiert → **PUBLISHED**
  - URL: https://neurealis.de/leerstand-wohnung-kosten-pro-monat-so-rechnen-vermieter-2026/
  - Kategorie: Vermieter-Wissen
  - Tags: NRW, Kosten, Vermieter, Mietwohnung, Leerstand
- [x] Eigenheim-Artikel (ID 12245) erstellt → **DRAFT**
  - URL (Preview): https://neurealis.de/?p=12245
  - Kategorien: Regional, Sanierungsarten
  - Tags: Dortmund, Kernsanierung, Komplettsanierung, Ruhrgebiet, NRW, Kosten, Förderung, KfW
- [x] MFH-Vorlage analysiert (Elementor, nicht direkt auf Posts übertragbar)

**Noch manuell erforderlich:**
- [ ] Featured Images für beide Artikel
- [ ] Yoast SEO Meta-Descriptions eintragen
- [ ] Eigenheim-Artikel reviewen und veröffentlichen

---

### T8 - Alle KI-Artikel nach Qualitätsstandard überarbeiten
**Status:** done
**Subagent:** quality-improvement-agent
**Output:** `t8_artikel_ueberarbeitung.md`, `t8_artikel_ueberarbeitung_teil2.md`
**Abgeschlossen:** 2026-01-31

**Ergebnis:**
- [x] 7 Artikel analysiert und überarbeitet (Leerstand bereits in T1)
- [x] Alle Bullet-Listen in Fließtext umgewandelt
- [x] Preise auf 1.000-1.200 EUR/m² korrigiert
- [x] Konkrete Beispielrechnungen für jeden Artikel
- [x] Mindestens 1.700 Wörter pro Artikel
- [x] neurealis-USPs subtil integriert
- [x] CTAs als logische Konsequenz formuliert

**Überarbeitete Artikel:**

| # | WordPress-ID | Wörter vorher | Wörter nachher |
|---|--------------|---------------|----------------|
| 1 | 12228 | ~2.999 | ~3.200 |
| 2 | 12229 | ~893 | ~1.850 |
| 3 | 12230 | ~975 | ~1.900 |
| 4 | 12231 | ~2.100 | ~1.700 |
| 5 | 12232 | ~1.123 | ~1.800 |
| 6 | 12233 | ~850 | ~1.850 |
| 7 | 12234 | ~950 | ~1.900 |

**Hinweis:** WordPress-Upload der überarbeiteten Inhalte ausstehend (separate Aufgabe)

---

### T9 - Broken Links finden und fixen
**Status:** done
**Subagent:** broken-link-agent
**Output:** `t9_broken_links.md`, `broken_links_report.json`
**Abgeschlossen:** 2026-01-31

**Analyse:**
- [x] 107 Links auf neurealis.de gescannt (86 intern, 21 extern)
- [x] 12 broken links gefunden (10 intern, 2 extern)

**Durchgeführte Fixes (11 Posts/Pages, 23 Link-Ersetzungen):**
- [x] `/blog/wohnungssanierung-komplett` → `/kernsanierung-komplettsanierung-in-dortmund-2026-ablauf-kost/` (7 Artikel)
- [x] `/blog/badsanierung-kosten` → `/badsanierung-dortmund-2026-kosten-dauer-ablauf-mit-fixpreis/` (7 Artikel)
- [x] `/blog/wohnung-sanieren-kosten` → `/wohnung-sanieren-kosten-2026-richtwerte-pro-m-beispiele-abla/` (2 Artikel)
- [x] `/unsere-leistungen-sanierung-renovierung-wohnung-dortmund` → `/aufwertung-ihrer-mietwohnung-in-dortmund-unsere-leistungspakete/` (3 Artikel)
- [x] `/wohnung-sanieren-dortmund/` → `/sanierung-ihrer-mietwohnung-in-dortmund/` (1 Artikel)
- [x] `/wohnung-renovieren-dortmund/` → `/renovierung-ihrer-mietwohnung-in-dortmund/` (1 Artikel)
- [x] `/sanierungs-beispiele-vorher-nachher-ubersicht` → `/sanierungs-beispiele-wohnungen-vorher-nachher-ubersicht/` (2 Seiten)
- [x] `/datenschutz` → `/datenschutzerklaerung/` (1 Seite)
- [x] `/sanierungspaket` → `/aufwertung-ihrer-mietwohnung-in-dortmund-unsere-leistungspakete/` (1 Seite)

**Offene externe Links (nur dokumentiert):**
- `{{ unsubscribe_link }}` auf Testseite - Newsletter-Platzhalter
- `http://Prozess` auf Karriere-Seite - Tippfehler

**Scripts erstellt:**
- `scripts/broken-link-checker.mjs` - Findet alle broken links
- `scripts/fix-broken-links.mjs` - Fixt interne broken links via WordPress API

---

## Koordination

**Reihenfolge:**
1. T4 + T6 können parallel starten
2. T5 nach T4 (braucht Struktur-Übersicht)
3. T7 nach T6 (braucht korrigierten Eigenheim-Text)
4. T8 kann parallel zu allem laufen

**Kommunikation:**
- Jeder Agent schreibt in seine Output-Datei
- Status-Updates in diesem Tracker
- Bei Fehlern: Error-Log in Output-Datei

---

## WordPress API Credentials

```
URL: https://neurealis.de
JWT Token Endpoint: /wp-json/jwt-auth/v1/token
Username: wcksjjdrwwtx6cona4pc
Password: [aus WORDPRESS_APP_PASSWORD Secret]
Header: X-WP-Auth: Bearer {token}
```

---

## Qualitätsrichtlinien (für alle Artikel)

### Schreibstil
- Professionell, aber nicht steif
- Fachlich fundiert mit konkreten Zahlen
- Keine generischen Füllsätze
- Aktive Sprache, direkte Ansprache
- Absätze statt Bullet-Listen

### Preise (WICHTIG!)
- Komplettsanierung: 1.000-1.200 EUR/m²
- Badsanierung: 800-1.200 EUR/m² (je nach Ausstattung)
- Elektrik komplett: 80-120 EUR/m²
- Nicht zu günstige Preise nennen!

### SEO
- Keyword natürlich im Text
- H2/H3-Struktur sinnvoll
- Meta-Description 150-160 Zeichen
- Interne Verlinkung

### neurealis-Bezug
- USPs: 98% Termintreue, Fixpreis-Garantie, Live-Dashboard
- CTA: Sanierungskompass, Erstberatung
- Lokaler Bezug Ruhrgebiet/Dortmund

---

*Tracker V2 erstellt: 2026-01-31*
