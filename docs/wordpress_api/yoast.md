# Yoast SEO API

**Namespace:** `yoast/v1`
**Basis-URL:** https://neurealis.de/wp-json/yoast/v1/

---

## Uebersicht

Yoast SEO bietet APIs fuer SEO-Analyse, Indexierung und Konfiguration.

**WICHTIG:** Yoast-Metadaten werden bei Posts als `yoast_head_json` zurueckgegeben, aber das Setzen erfolgt ueber Post-Meta.

---

## SEO-Daten in Posts

Yoast-Daten sind im Post-Response enthalten:

```json
{
  "id": 12235,
  "title": {...},
  "yoast_head_json": {
    "title": "Leerstandskosten berechnen | neurealis",
    "description": "Echte Leerstandskosten berechnen...",
    "robots": {
      "index": "index",
      "follow": "follow"
    },
    "og_locale": "de_DE",
    "og_type": "article",
    "og_title": "Leerstandskosten berechnen...",
    "og_description": "...",
    "og_url": "https://neurealis.de/...",
    "og_site_name": "neurealis Komplettsanierung",
    "article_published_time": "2026-01-31T01:05:09+00:00",
    "twitter_card": "summary_large_image",
    "schema": {
      "@context": "https://schema.org",
      "@graph": [...]
    }
  }
}
```

---

## SEO-Meta setzen

SEO-Metadaten werden ueber Post-Meta gesetzt:

| Meta-Key | Beschreibung |
|----------|--------------|
| `_yoast_wpseo_title` | SEO-Titel |
| `_yoast_wpseo_metadesc` | Meta-Description |
| `_yoast_wpseo_focuskw` | Focus Keyphrase |
| `_yoast_wpseo_canonical` | Canonical URL |
| `_yoast_wpseo_meta-robots-noindex` | NoIndex (0/1) |
| `_yoast_wpseo_meta-robots-nofollow` | NoFollow (0/1) |
| `_yoast_wpseo_opengraph-title` | OG Title |
| `_yoast_wpseo_opengraph-description` | OG Description |
| `_yoast_wpseo_opengraph-image` | OG Image URL |
| `_yoast_wpseo_twitter-title` | Twitter Title |
| `_yoast_wpseo_twitter-description` | Twitter Description |

**Beispiel:**
```bash
curl -X POST "https://neurealis.de/wp-json/wp/v2/posts/12235" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "_yoast_wpseo_title": "Leerstandskosten berechnen 2026 | neurealis",
      "_yoast_wpseo_metadesc": "Berechnen Sie Ihre echten Leerstandskosten mit der 3-Block-Methode.",
      "_yoast_wpseo_focuskw": "Leerstandskosten berechnen"
    }
  }'
```

---

## Yoast API Endpoints

### GET /yoast/v1/statistics

SEO-Statistiken abrufen. **Auth erforderlich!**

### GET /yoast/v1/seo_scores

SEO-Scores nach Content-Type.

**Parameter:**
| Parameter | Typ | Required | Beschreibung |
|-----------|-----|----------|--------------|
| contentType | string | Ja | post, page, etc. |
| taxonomy | string | Nein | Filter nach Taxonomie |
| term | int | Nein | Filter nach Term-ID |

```bash
curl "https://neurealis.de/wp-json/yoast/v1/seo_scores?contentType=post" \
  -H "Authorization: Bearer TOKEN"
```

### GET /yoast/v1/readability_scores

Lesbarkeits-Scores nach Content-Type.

**Parameter:** Gleich wie seo_scores

```bash
curl "https://neurealis.de/wp-json/yoast/v1/readability_scores?contentType=post" \
  -H "Authorization: Bearer TOKEN"
```

### GET /yoast/v1/available_posts

Posts fuer internes Linking suchen.

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| search | string | Suchbegriff |
| postType | string | Post-Type (default: page) |

```bash
curl "https://neurealis.de/wp-json/yoast/v1/available_posts?search=Sanierung&postType=post"
```

---

## Configuration

### POST /yoast/v1/configuration/site_representation

Site-Repraesentation setzen. **Auth erforderlich!**

**Parameter:**
| Parameter | Typ | Required | Beschreibung |
|-----------|-----|----------|--------------|
| company_or_person | string | Ja | "company" oder "person" |
| company_name | string | Nein | Firmenname |
| company_logo | string | Nein | Logo-URL |
| company_logo_id | int | Nein | Media-ID |
| description | string | Nein | Beschreibung |

### POST /yoast/v1/configuration/social_profiles

Social-Media-Profile setzen. **Auth erforderlich!**

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| facebook_site | string | Facebook-URL |
| twitter_site | string | Twitter-Handle |
| other_social_urls | array | Weitere URLs |

---

## Indexierung

### POST /yoast/v1/indexing/posts

Posts neu indexieren. **Auth erforderlich!**

### POST /yoast/v1/indexing/terms

Terms neu indexieren. **Auth erforderlich!**

### POST /yoast/v1/indexing/prepare

Indexierung vorbereiten.

### POST /yoast/v1/indexing/complete

Indexierung abschliessen.

---

## Link-Indexierung

### POST /yoast/v1/link-indexing/posts

Interne Links in Posts indexieren. **Auth erforderlich!**

### POST /yoast/v1/link-indexing/terms

Interne Links in Terms indexieren. **Auth erforderlich!**

---

## SEMrush Integration

### POST /yoast/v1/semrush/authenticate

SEMrush-Authentifizierung.

**Parameter:**
- `code` (required): Auth-Code

### POST /yoast/v1/semrush/country_code

Land setzen.

**Parameter:**
- `country_code` (required): z.B. "de"

### GET /yoast/v1/semrush/related_keyphrases

Verwandte Keywords abrufen.

**Parameter:**
- `keyphrase` (required): Suchbegriff
- `country_code` (required): z.B. "de"

```bash
curl "https://neurealis.de/wp-json/yoast/v1/semrush/related_keyphrases?keyphrase=Wohnungssanierung&country_code=de" \
  -H "Authorization: Bearer TOKEN"
```

---

## Wincher Integration

### GET /yoast/v1/wincher/authorization-url

Wincher-Auth-URL abrufen.

### POST /yoast/v1/wincher/authenticate

Wincher authentifizieren.

### POST /yoast/v1/wincher/keyphrases/track

Keywords tracken.

**Parameter:**
- `keyphrases` (required): Array von Keywords

### POST /yoast/v1/wincher/keyphrases

Keyword-Daten abrufen.

### DELETE /yoast/v1/wincher/keyphrases/untrack

Keywords vom Tracking entfernen.

### GET /yoast/v1/wincher/account/limit

Account-Limits pruefen.

---

## Wistia Embed

### GET /yoast/v1/wistia_embed_permission

Wistia-Berechtigung pruefen.

### POST /yoast/v1/wistia_embed_permission

Wistia-Berechtigung setzen.

---

## Schema.org

Yoast generiert automatisch Schema.org-Markup. Das Schema ist im `yoast_head_json.schema` enthalten:

```json
{
  "schema": {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://neurealis.de/page/#webpage",
        "url": "https://neurealis.de/page/",
        "name": "Titel",
        "isPartOf": {"@id": "https://neurealis.de/#website"}
      },
      {
        "@type": "Organization",
        "@id": "https://neurealis.de/#organization",
        "name": "neurealis Komplettsanierung",
        "url": "https://neurealis.de/"
      },
      {
        "@type": "Article",
        "@id": "https://neurealis.de/post/#article",
        "headline": "Titel",
        "datePublished": "2026-01-31T01:05:09+00:00"
      }
    ]
  }
}
```

---

## Best Practices fuer Blog-Posts

1. **Focus Keyphrase setzen:**
   ```json
   {"meta": {"_yoast_wpseo_focuskw": "Wohnungssanierung Dortmund"}}
   ```

2. **SEO-Titel optimieren (max 60 Zeichen):**
   ```json
   {"meta": {"_yoast_wpseo_title": "Wohnungssanierung Dortmund 2026 | neurealis"}}
   ```

3. **Meta-Description (max 155 Zeichen):**
   ```json
   {"meta": {"_yoast_wpseo_metadesc": "Professionelle Wohnungssanierung in Dortmund. Komplettsanierung aus einer Hand. Jetzt unverbindlich anfragen!"}}
   ```

4. **OG-Image setzen:**
   ```json
   {"meta": {"_yoast_wpseo_opengraph-image": "https://neurealis.de/wp-content/uploads/image.jpg"}}
   ```

---

*Letzte Aktualisierung: 2026-01-31*
