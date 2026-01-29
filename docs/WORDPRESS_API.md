# WordPress REST API - neurealis.de

**Stand:** 2026-01-29
**Website:** https://neurealis.de
**API-Basis:** https://neurealis.de/wp-json/

---

## Authentifizierung

| Secret | Wert |
|--------|------|
| **WORDPRESS_API_TOKEN** | In Supabase Secrets |
| **Username** | `wCkSjJdRWWTx6CONA4pc` |

**Auth-Header:**
```
Authorization: Basic base64(username:application_password)
```

---

## Content Types

### Öffentliche Post Types

| Slug | API-Endpunkt | Beschreibung | Aktuell |
|------|--------------|--------------|---------|
| `post` | `/wp/v2/posts` | Blog-Artikel | 3 Posts |
| `page` | `/wp/v2/pages` | Seiten | - |
| `attachment` | `/wp/v2/media` | Medien/Bilder | - |

### Interne Post Types

| Slug | API-Endpunkt | Plugin |
|------|--------------|--------|
| `elementor_library` | `/wp/v2/elementor_library` | Elementor Templates |
| `elementor_snippet` | `/wp/v2/elementor_snippet` | Elementor Custom Code |
| `wp_block` | `/wp/v2/blocks` | Wiederverwendbare Blöcke |
| `wp_template` | `/wp/v2/templates` | Theme Templates |
| `wp_navigation` | `/wp/v2/navigation` | Navigation Menus |

---

## Taxonomien

| Taxonomie | Endpunkt | Post Types | Anzahl |
|-----------|----------|------------|--------|
| `category` | `/wp/v2/categories` | post | 2 |
| `post_tag` | `/wp/v2/tags` | post | 10+ |
| `nav_menu` | `/wp/v2/menus` | nav_menu_item | - |

### Kategorien

| ID | Name | Slug | Posts |
|----|------|------|-------|
| 45 | Allgemein | allgemein | 3 |
| 1 | Uncategorized | uncategorized | 0 |

### Tags (Auswahl)

| ID | Name | Slug |
|----|------|------|
| 180 | Dortmund | dortmund |
| 175 | Wohnungssanierung | wohnungssanierung |
| 176 | Wohnungsrenovierung | wohnungsrenovierung |
| 177 | Sanierung Wohnung Dortmund | sanierung-wohnung-dortmund |
| 178 | Wohnungsmodernisierung | wohnungsmodernisierung |
| 179 | Renovierung Wohnung Dortmund | renovierung-wohnung-dortmund |
| 181 | Sanierung Wohnung | sanierung-wohnung |
| 182 | Renovierung Wohnung | renovierung-wohnung |

---

## Post-Struktur

### Felder bei GET /wp/v2/posts

```typescript
interface WordPressPost {
  // Basis
  id: number;
  slug: string;
  status: 'publish' | 'draft' | 'pending' | 'private';
  type: 'post';
  link: string;

  // Inhalt (als Objects mit .rendered)
  title: { rendered: string };
  content: { rendered: string; protected: boolean };
  excerpt: { rendered: string; protected: boolean };

  // Datum
  date: string;        // ISO 8601
  date_gmt: string;
  modified: string;
  modified_gmt: string;

  // Autor & Media
  author: number;      // User-ID
  featured_media: number;  // Attachment-ID

  // Taxonomien
  categories: number[];
  tags: number[];

  // Meta
  meta: Record<string, any>;
  template: string;
  format: 'standard' | 'aside' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio' | 'chat';

  // Kommentare
  comment_status: 'open' | 'closed';
  ping_status: 'open' | 'closed';
  sticky: boolean;
}
```

### Felder bei POST/PUT (Create/Update)

```typescript
interface WordPressPostCreate {
  title: string;           // Nur der Text
  content: string;         // HTML
  excerpt?: string;
  slug?: string;
  status?: 'publish' | 'draft' | 'pending' | 'private';
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, any>;
}
```

---

## Seiten-Struktur

Zusätzliche Felder für Pages:

```typescript
interface WordPressPage extends WordPressPost {
  parent: number;      // Parent Page ID (Hierarchie)
  menu_order: number;  // Sortierung
  template: string;    // Page Template
}
```

---

## Installierte Plugins

| Plugin | API-Endpunkte | Funktion |
|--------|---------------|----------|
| **Elementor** | `/elementor/v1/*` | Page Builder |
| **Elementor Pro** | `/elementor-pro/v1/*` | Erweiterte Features |
| **Yoast SEO** | `/yoast/v1/*` | SEO-Optimierung |
| **Google Site Kit** | `/google-site-kit/v1/*` | Analytics |
| **Redirection** | `/redirection/v1/*` | URL-Weiterleitungen |
| **Real Cookie Banner** | `/real-cookie-banner/v1/*` | DSGVO-Cookies |

### Elementor-Endpunkte

```
/elementor/v1/site-editor/templates  - Templates
/elementor/v1/post                   - Post-Daten
/elementor/v1/globals/colors         - Globale Farben
/elementor/v1/globals/typography     - Typografie
/elementor/v1/form-submissions       - Formulare
```

### Yoast SEO-Endpunkte

```
/yoast/v1/statistics        - SEO-Statistiken
/yoast/v1/readability_scores - Lesbarkeit
/yoast/v1/seo_scores        - SEO-Bewertungen
```

---

## API-Beispiele

### Posts abrufen

```bash
# Alle Posts
curl "https://neurealis.de/wp-json/wp/v2/posts"

# Mit eingebetteten Daten (Kategorien, Tags, Featured Image)
curl "https://neurealis.de/wp-json/wp/v2/posts?_embed"

# Gefiltert nach Kategorie
curl "https://neurealis.de/wp-json/wp/v2/posts?categories=45"

# Nur Entwürfe (Auth erforderlich!)
curl "https://neurealis.de/wp-json/wp/v2/posts?status=draft" \
  -H "Authorization: Basic ${AUTH}"
```

### Post erstellen (Auth erforderlich)

```bash
curl -X POST "https://neurealis.de/wp-json/wp/v2/posts" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Neuer Blog-Artikel",
    "content": "<p>Artikel-Inhalt...</p>",
    "status": "draft",
    "categories": [45],
    "tags": [175, 180]
  }'
```

### Post aktualisieren

```bash
curl -X PUT "https://neurealis.de/wp-json/wp/v2/posts/123" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Aktualisierter Titel",
    "status": "publish"
  }'
```

### Bild hochladen

```bash
curl -X POST "https://neurealis.de/wp-json/wp/v2/media" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Disposition: attachment; filename=bild.jpg" \
  --data-binary @bild.jpg
```

---

## Sync-Strategie: Supabase → WordPress

### Empfohlener Flow

```
1. Blog-Artikel in Supabase mit status='veröffentlicht' und confidence_score >= 0.8
2. Edge Function 'wordpress-sync' prüft auf neue Artikel
3. Artikel zu WordPress pushen (erst als draft)
4. featured_media hochladen falls vorhanden
5. Status auf 'publish' setzen
6. wordpress_post_id in Supabase speichern
```

### Feld-Mapping

| Supabase (blog_posts) | WordPress |
|-----------------------|-----------|
| titel | title |
| inhalt | content |
| excerpt | excerpt |
| slug | slug |
| meta_description | excerpt (oder Yoast meta) |
| keywords | tags (IDs ermitteln/erstellen) |
| cluster | category (ID ermitteln) |
| bild_url | featured_media (erst upload) |

### Zu erstellende Edge Function

```
wordpress-sync
├── Neue Posts holen (status=veröffentlicht, wp_post_id=null)
├── Tags erstellen falls nicht vorhanden
├── Featured Image uploaden
├── Post erstellen/updaten
└── wp_post_id in Supabase speichern
```

---

## Bestehende Posts (3 Artikel)

| Datum | Titel | Tags |
|-------|-------|------|
| 2024-01-12 | Ablauf einer Wohnungssanierung bei neurealis | 7 Tags |
| 2024-01-02 | Unterschiede Renovierung vs. Sanierung | 6 Tags |
| 2024-01-02 | Leistungsangebot zur Wohnungssanierung | 6 Tags |

**Thema:** Alle 3 Posts behandeln Wohnungssanierung in Dortmund - perfekt für die Blog-Pipeline!

---

*Erstellt: 2026-01-29*
