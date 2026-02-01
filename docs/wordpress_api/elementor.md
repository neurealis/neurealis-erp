# Elementor API

**Namespaces:**
- `elementor/v1` - Core Elementor
- `elementor-pro/v1` - Pro Features
- `elementor-ai/v1` - KI-Integration
- `elementor-one/v1` - Connect/License

**Basis-URL:** https://neurealis.de/wp-json/elementor/v1/

---

## Uebersicht

Elementor bietet **79 API-Routen** fuer Page Builder Funktionen.

**WICHTIG:** Elementor speichert Seiteninhalte als JSON in Post-Meta `_elementor_data`. Direktes Bearbeiten ueber API ist komplex. Empfehlung: Elementor-Editor verwenden.

---

## Site Editor / Templates

### GET /elementor/v1/site-editor

Site-Editor Konfiguration abrufen.

```bash
curl "https://neurealis.de/wp-json/elementor/v1/site-editor"
```

### GET /elementor/v1/site-editor/templates

Alle Templates auflisten. **Auth erforderlich!**

```bash
curl "https://neurealis.de/wp-json/elementor/v1/site-editor/templates" \
  -H "Authorization: Bearer TOKEN"
```

### POST /elementor/v1/site-editor/templates

Template erstellen. **Auth erforderlich!**

### PUT /elementor/v1/site-editor/templates/{id}

Template aktualisieren. **Auth erforderlich!**

### DELETE /elementor/v1/site-editor/templates/{id}

Template loeschen. **Auth erforderlich!**

---

## Template Conditions

### GET /elementor/v1/site-editor/conditions-config

Verfuegbare Bedingungen fuer Templates.

```bash
curl "https://neurealis.de/wp-json/elementor/v1/site-editor/conditions-config"
```

### GET /elementor/v1/site-editor/templates-conditions/{id}

Bedingungen fuer ein Template abrufen.

### POST /elementor/v1/site-editor/templates-conditions/{id}

Bedingungen setzen. **Auth erforderlich!**

### GET /elementor/v1/site-editor/templates-conditions-conflicts

Konflikte zwischen Template-Bedingungen pruefen.

---

## Global Styles

### GET /elementor/v1/globals

Alle globalen Styles abrufen.

```bash
curl "https://neurealis.de/wp-json/elementor/v1/globals"
```

### GET /elementor/v1/globals/colors

Globale Farben.

```bash
curl "https://neurealis.de/wp-json/elementor/v1/globals/colors"
```

### GET /elementor/v1/globals/typography

Globale Typografie.

```bash
curl "https://neurealis.de/wp-json/elementor/v1/globals/typography"
```

### POST /elementor/v1/globals/colors/{id}

Farbe aktualisieren. **Auth erforderlich!**

### POST /elementor/v1/globals/typography/{id}

Typografie aktualisieren. **Auth erforderlich!**

---

## Post/Term Suche

### GET /elementor/v1/post

Posts durchsuchen (fuer Elementor UI).

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| term | string | Suchbegriff |
| included_types | array | Zu suchende Post-Types |
| excluded_types | array | Auszuschliessende Post-Types |
| items_count | int | Max. Ergebnisse (default: 100) |

```bash
curl "https://neurealis.de/wp-json/elementor/v1/post?term=Sanierung"
```

### GET /elementor/v1/term

Taxonomie-Terms durchsuchen.

---

## Documents

### GET /elementor/v1/documents

Elementor-Dokumente Namespace.

### POST /elementor/v1/documents/{id}/media/import

Medien in ein Dokument importieren. **Auth erforderlich!**

---

## Cache

### DELETE /elementor/v1/cache

Elementor-Cache leeren. **Auth erforderlich!**

```bash
curl -X DELETE "https://neurealis.de/wp-json/elementor/v1/cache" \
  -H "Authorization: Bearer TOKEN"
```

---

## Settings

### GET /elementor/v1/settings/{key}

Einstellung abrufen.

### POST /elementor/v1/settings/{key}

Einstellung setzen. **Auth erforderlich!**

---

## Template Library

### GET /elementor/v1/template-library/templates

Templates aus der Library abrufen.

---

## Forms (Pro)

### GET /elementor/v1/form-submissions

Formular-Einsendungen abrufen. **Auth erforderlich!**

### GET /elementor/v1/form-submissions/{id}

Einzelne Einsendung abrufen.

### DELETE /elementor/v1/form-submissions/{id}

Einsendung loeschen.

### GET /elementor/v1/form-submissions/export

Einsendungen exportieren.

### GET /elementor/v1/forms

Formular-Definitionen.

---

## Elementor Pro

### GET /elementor-pro/v1/license/tier-features

Verfuegbare Pro-Features.

### GET /elementor-pro/v1/license/get-license-status

Lizenz-Status pruefen.

### GET /elementor-pro/v1/posts-widget

Posts-Widget Konfiguration.

### POST /elementor-pro/v1/get-post-type-taxonomies

Taxonomien fuer Post-Type abrufen.

**Parameter:**
- `post_type` (required): Post-Type Name

### POST /elementor-pro/v1/refresh-loop

Loop-Widget aktualisieren.

**Parameter:**
- `post_id` (required): Page-ID
- `widget_id` (required): Widget-ID
- `widget_filters` (required): Filter-Objekt

### POST /elementor-pro/v1/refresh-search

Such-Widget aktualisieren.

---

## Elementor Library (wp/v2)

Elementor-Templates sind auch ueber die Core-API erreichbar:

### GET /wp/v2/elementor_library

Templates auflisten. **ACHTUNG:** Liefert 401 ohne Auth!

```bash
curl "https://neurealis.de/wp-json/wp/v2/elementor_library" \
  -H "Authorization: Bearer TOKEN"
```

### GET /wp/v2/elementor_snippet

Code-Snippets.

---

## Elementor Content Structure

Elementor speichert Inhalte als JSON im Post-Meta `_elementor_data`:

```json
[
  {
    "id": "abc123",
    "elType": "section",
    "settings": {
      "structure": "20"
    },
    "elements": [
      {
        "id": "def456",
        "elType": "column",
        "elements": [
          {
            "id": "ghi789",
            "elType": "widget",
            "widgetType": "heading",
            "settings": {
              "title": "Willkommen",
              "size": "xl"
            }
          }
        ]
      }
    ]
  }
]
```

**Struktur:**
- `elType`: section, column, widget
- `widgetType`: heading, text-editor, image, button, etc.
- `settings`: Widget-spezifische Einstellungen
- `elements`: Verschachtelte Elemente

---

## Seiten mit Elementor erstellen

**Empfohlener Workflow:**

1. Seite ueber wp/v2 API erstellen (nur Titel/Slug)
2. Im Elementor-Editor bearbeiten
3. Template exportieren/importieren fuer Wiederverwendung

**Direkter API-Ansatz (komplex):**

```bash
# 1. Seite erstellen
curl -X POST "https://neurealis.de/wp-json/wp/v2/pages" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Neue Seite", "status": "draft"}'

# 2. Elementor-Data via Post-Meta setzen (komplexe JSON-Struktur!)
# Nicht empfohlen - Editor verwenden
```

---

*Letzte Aktualisierung: 2026-01-31*
