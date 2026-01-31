# T7 - WordPress Upload Report

**Erstellt:** 2026-01-31
**Agent:** wordpress-upload-agent
**Status:** done

---

## Zusammenfassung

Beide Artikel wurden erfolgreich nach WordPress hochgeladen:

| Artikel | Aktion | Status | WordPress-ID | URL |
|---------|--------|--------|--------------|-----|
| Leerstand-Artikel | UPDATE | publish | 12235 | https://neurealis.de/leerstand-wohnung-kosten-pro-monat-so-rechnen-vermieter-2026/ |
| Eigenheim Dortmund | CREATE | draft | 12245 | https://neurealis.de/?p=12245 (Preview) |

---

## Artikel 1: Leerstand-Artikel (UPDATE)

**WordPress-ID:** 12235
**URL:** https://neurealis.de/leerstand-wohnung-kosten-pro-monat-so-rechnen-vermieter-2026/
**Status:** publish (veröffentlicht)

### Änderungen durchgeführt:
- [x] Titel aktualisiert: "Leerstandskosten berechnen: Vollständige Kalkulation für Vermieter 2026 (mit Praxisbeispiel)"
- [x] Vollständiger neuer Inhalt aus `t1_leerstand_revision.md` eingespielt
- [x] Kategorie zugewiesen: Vermieter-Wissen (ID 209)
- [x] Tags zugewiesen: NRW, Kosten, Vermieter, Mietwohnung, Leerstand
- [x] Excerpt/Meta-Description gesetzt

### Neue Inhaltsstruktur:
1. Einleitung: Warum klassische Berechnung nicht reicht
2. Die 3-Block-Methode (Block 1-3 erklärt)
3. Praxisbeispiel: 65 m² Wohnung mit vollständiger Kalkulation
4. Strategische Implikationen: ROI von Sanierungen
5. Die drei häufigsten Vermietungshindernisse
6. Praktische Handlungsempfehlungen
7. Leerstandskosten als Steuerungsgröße
8. neurealis-Lösung
9. Fazit mit CTA

**Wortanzahl:** ca. 2.100 Wörter

---

## Artikel 2: Eigenheim Dortmund (NEU)

**WordPress-ID:** 12245
**Slug:** sanierung-eigenheim-dortmund
**URL (Preview):** https://neurealis.de/?p=12245
**Status:** draft (Entwurf - NICHT veröffentlicht)

### Erstellt mit:
- [x] Titel: "Eigenheim sanieren in Dortmund - Kosten, Ablauf & Förderung 2026"
- [x] Vollständiger korrigierter Inhalt aus `t6_eigenheim_korrigiert.md`
- [x] Kategorien zugewiesen: Regional, Sanierungsarten
- [x] Tags zugewiesen: Dortmund, Kernsanierung, Komplettsanierung, Ruhrgebiet, NRW, Kosten, Förderung, KfW
- [x] Excerpt/Meta-Description gesetzt

### Inhaltsstruktur:
1. Einleitung mit Lead-Paragraph
2. Warum Eigenheim-Sanierung in Dortmund jetzt sinnvoll ist
3. Typische Sanierungsarbeiten (Elektrik, Bad, Heizung, Wände, Trockenbau)
4. Kosten einer Eigenheim-Sanierung (korrigiert!)
5. Kostenrahmen nach Sanierungstiefe
6. **Beispielrechnung: 121.000 EUR für 110 m² Reihenhaus** (korrigiert von 75.000 EUR)
7. Fixpreis vs. Einzelgewerk-Vergabe
8. Ablauf einer Komplettsanierung (7 Phasen)
9. Förderungen 2026 (KfW, BAFA, Steuer, NRW)
10. neurealis-Lösung (Fixpreis, Digital, Koordination, Regional)
11. FAQ-Sektion (7 Fragen)
12. CTA mit Kontaktdaten

**Wortanzahl:** ca. 2.500 Wörter

---

## Layout-Analyse: MFH-Vorlage

Die MFH-Seite (https://neurealis.de/sanierung-mehrfamilienhaus-nrw/) wurde analysiert:

### Verwendete Technologie:
- **Page Builder:** Elementor Pro
- **Struktur:** Elementor-Sections mit data-id Attributen
- **Typ:** WordPress Page (nicht Post)

### Layout-Elemente identifiziert:

| Element | Widget-Type | Beschreibung |
|---------|-------------|--------------|
| Hero-Section | section + heading | Vollbreite mit Background-Overlay, H1 mit Link |
| CTA-Button | button.default | Zentriert, mit Icon (Kalender) |
| Text-Blöcke | text-editor.default | Absolute Positionierung für Tagline |
| Columns | column | 100% Breite für Hero |

### Elementor-Struktur (vereinfacht):
```
- Section (Hero, min-height, background-overlay)
  - Container (column-gap-no)
    - Column (100%)
      - Heading (H1)
      - Button (CTA)
- Section (Tagline)
  - Text-Editor (absolute positioned)
```

### Layout-Übertragung auf Blog-Posts:

**Nicht direkt übertragbar:**
- Elementor-Pages nutzen proprietäres JSON-Format für Layouts
- Blog-Posts verwenden Gutenberg-Editor oder Classic Editor
- Elementor-Sections sind Page-spezifisch

**Workaround für zukünftige Artikel:**
1. Blog-Posts mit HTML-Tabellen (wie im Eigenheim-Artikel)
2. FAQ-Accordions mit CSS-Klassen (`faq-section`)
3. CTA-Boxes mit Inline-Styling
4. Elementor nur für Landing Pages verwenden

---

## Technische Details

### API-Konfiguration:
```
Endpoint: https://neurealis.de/wp-json/wp/v2/posts
Auth: JWT Token via X-WP-Auth Header
Method: POST (Update existing: POST /posts/{id})
```

### Verwendete Kategorie-IDs:
| Kategorie | ID |
|-----------|-----|
| Allgemein | 45 |
| Vermieter-Wissen | 209 |
| Regional | 210 |
| Sanierungsarten | 211 |

### Verwendete Tag-IDs:
| Tag | ID |
|-----|-----|
| Dortmund | 180 |
| Kernsanierung | 195 |
| Komplettsanierung | 196 |
| Badsanierung | 197 |
| Ruhrgebiet | 199 |
| NRW | 200 |
| Kosten | 201 |
| Förderung | 202 |
| KfW | 203 |
| Vermieter | 204 |
| Mietwohnung | 205 |
| Leerstand | 206 |

---

## Was funktioniert hat

1. **JWT-Authentifizierung:** Token erfolgreich geholt und verwendet
2. **X-WP-Auth Header:** Korrekt für neurealis.de WordPress-Setup
3. **POST-Updates:** Bestehende Artikel können aktualisiert werden
4. **Draft-Erstellung:** Neue Artikel als Entwurf möglich
5. **Kategorien/Tags:** Zuordnung über IDs funktioniert
6. **HTML-Content:** Wird korrekt in WordPress übernommen
7. **Tabellen:** HTML-Tabellen werden korrekt gerendert

---

## Was nicht funktioniert / Einschränkungen

1. **Elementor-Layout nicht übertragbar:**
   - Blog-Posts nutzen Classic/Gutenberg Editor
   - Elementor-Strukturen sind Page-spezifisch
   - Kein automatisches Template-Matching

2. **Featured Images:**
   - Nicht via API gesetzt (erfordert Media-Upload)
   - Manuell im WordPress-Backend hinzufügen

3. **Yoast SEO Meta:**
   - Meta-Description nicht über Standard-API setzbar
   - Erfordert Yoast REST API Extension oder manuelle Eingabe

4. **Schema-Markup:**
   - FAQ-Schema muss manuell oder via Plugin hinzugefügt werden

---

## Nächste Schritte (manuell)

Für den Eigenheim-Artikel (ID 12245, Draft):

1. [ ] WordPress-Backend öffnen: https://neurealis.de/wp-admin/post.php?post=12245&action=edit
2. [ ] Featured Image hinzufügen (Eigenheim-Vorher/Nachher)
3. [ ] Yoast SEO: Meta-Description eintragen
4. [ ] Yoast SEO: Fokus-Keyword eintragen
5. [ ] Preview prüfen
6. [ ] Bei Bedarf: Veröffentlichen

Für den Leerstand-Artikel (ID 12235, Published):

1. [ ] Featured Image prüfen/aktualisieren
2. [ ] Yoast SEO: Meta-Description aktualisieren
3. [ ] Interne Verlinkung prüfen

---

## Dateien

| Datei | Pfad |
|-------|------|
| Upload-Script | `C:\Users\holge\neurealis-ERP\upload-wordpress.mjs` |
| Leerstand-Revision | `docs/implementation/t1_leerstand_revision.md` |
| Eigenheim-Korrigiert | `docs/implementation/t6_eigenheim_korrigiert.md` |
| Dieser Report | `docs/implementation/t7_upload_report.md` |

---

*Report erstellt: 2026-01-31 | Agent: wordpress-upload-agent*
