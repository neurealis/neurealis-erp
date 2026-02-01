# WordPress Seiten & Content - neurealis.de

**Stand:** 2026-01-29
**Export:** `neurealiskomplettsanierungnrw.WordPress.2026-01-29.xml`

---

## Live-Seiten (via API)

| ID | Titel | Slug | Modified |
|----|-------|------|----------|
| 12135 | Kostenrechner für Ihre Sanierung oder Renovierung | kostenrechner-sanierung-renovierung-wohnung-eigenheim | 2025-12-16 |
| 12061 | Sackrechner | sackrechner | 2025-11-18 |
| 12008 | Modernisierung Ihrer Eigentumswohnung in NRW | modernisierung-ihrer-eigentumswohnung-in-nrw | 2025-11-05 |

**Hinweis:** Alle Seiten sind auf oberster Hierarchie-Ebene (parent = 0).

---

## Live-Posts (via API)

| ID | Titel | Datum | Kategorie |
|----|-------|-------|-----------|
| 7110 | Ablauf einer Wohnungssanierung bei neurealis | 2024-01-12 | Allgemein |
| - | Unterschiede Renovierung vs. Sanierung | 2024-01-02 | Allgemein |
| - | Leistungsangebot zur Wohnungssanierung | 2024-01-02 | Allgemein |

---

## WordPress Export Analyse

**Datei:** `Wordpress Exporte/neurealiskomplettsanierungnrw.WordPress.2026-01-29.xml`

| Post-Type | Anzahl | Beschreibung |
|-----------|--------|--------------|
| `attachment` | 730 | Medien/Bilder |
| `bafg` | 10 | Custom Post Type (Förderungs-Infos?) |
| `elementor_library` | 2 | Elementor Templates |
| `custom_css` | 1 | Benutzerdefiniertes CSS |
| **Gesamt** | **743** | Items |

**Fehlend im Export:** Posts und Pages - nur Medien/Attachments exportiert!

---

## Taxonomien (aus Export)

### Kategorien

| ID | Name | Slug |
|----|------|------|
| 45 | Allgemein | allgemein |
| 1 | Uncategorized | uncategorized |

### Tags (21 Stück)

| ID | Name | Relevanz |
|----|------|----------|
| 175 | Wohnungssanierung | Haupt-Keyword |
| 176 | Wohnungsrenovierung | Haupt-Keyword |
| 177 | Wohnungsmodernisierung | Haupt-Keyword |
| 178 | Sanierung Wohnung | SEO-Keyword |
| 179 | Renovierung Wohnung | SEO-Keyword |
| 180 | Dortmund | Regional |
| 181 | Sanierung Wohnung Dortmund | Regional+SEO |
| 182 | Renovierung Wohnung Dortmund | Regional+SEO |
| 42 | Hausverwaltung Dortmund | B2B-Zielgruppe |
| 48 | Rendite | Vermieter-Zielgruppe |
| 49 | Vermietung | Vermieter-Zielgruppe |
| 50 | Heizkosten | Thema |
| 51 | Energiesparen | Thema |
| 52 | Mieter | Zielgruppe |
| 53 | Eigentümer | Zielgruppe |
| 54 | Betriebskosten | Thema |
| 55 | Mietrecht | Thema |

---

## Elementor Templates

| Typ | Beschreibung |
|-----|--------------|
| header | Kopfzeile |
| footer | Fußzeile |
| section | Wiederverwendbare Abschnitte |
| page | Seiten-Templates |
| loop-item | Blog-Post-Template |
| single-page | Einzelseiten-Template |
| container | Container-Template |
| error-404 | Fehlerseite |

---

## Content-Strategie

### Bestehende Themen
- Wohnungssanierung (Ablauf, Unterschiede, Leistungen)
- Kostenrechner (interaktiv)
- Modernisierung Eigentumswohnung

### Geplante Blog-Themen (aus blog_keywords)
- Wohnungssanierung Dortmund 2026 ✅ (KI-generiert)
- Wohnung sanieren Kosten ✅ (KI-generiert)
- Weitere 20+ Keywords in Pipeline

### Tag-Nutzung für Blog-Pipeline
Die bestehenden Tags sollten für neue Artikel verwendet werden:
- Regional: Dortmund, NRW
- Zielgruppe: Vermieter, Eigentümer, Hausverwaltung
- Thema: Sanierung, Renovierung, Modernisierung

---

## Empfehlungen

1. **Vollständigen Export erstellen:**
   - Aktueller Export enthält nur Medien
   - Neuer Export mit Posts + Pages nötig

2. **Tags in Supabase spiegeln:**
   - WordPress Tag-IDs in `blog_keywords` speichern
   - Automatisches Mapping bei WordPress-Sync

3. **Kategorie-Erweiterung:**
   - Neue Kategorien für Blog-Cluster erstellen
   - Mapping zu `blog_posts.cluster`

---

*Erstellt: 2026-01-29*
