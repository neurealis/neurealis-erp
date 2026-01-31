# T10: WordPress REST API Discovery

**Status:** ABGESCHLOSSEN
**Datum:** 2026-01-31
**Dauer:** ~30 Minuten

---

## Zusammenfassung

Vollstaendige Analyse der WordPress REST API auf neurealis.de durchgefuehrt. Alle 485 Routen in 22 Namespaces dokumentiert.

---

## Ergebnisse

### Gefundene Namespaces (22)

| Namespace | Plugin | Routen |
|-----------|--------|--------|
| `wp/v2` | WordPress Core | 132 |
| `elementor/v1` | Elementor | 35 |
| `elementor-pro/v1` | Elementor Pro | 7 |
| `elementor-one/v1` | Elementor Connect | 16 |
| `elementor-ai/v1` | Elementor AI | 2 |
| `elementor/v1/documents` | Elementor Documents | 2 |
| `yoast/v1` | Yoast SEO | 45 |
| `jwt-auth/v1` | JWT Authentication | 11 |
| `redirection/v1` | Redirection | 19 |
| `google-site-kit/v1` | Google Site Kit | 30+ |
| `siteground-optimizer/v1` | SG Optimizer | 22 |
| `siteground-settings/v1` | SG Settings | 1 |
| `real-cookie-banner/v1` | Cookie Banner | 10+ |
| `real-queue/v1` | Background Jobs | 6 |
| `real-utils/v1` | devowl Utilities | 3 |
| `real-product-manager-wp-client/v1` | License Manager | 9 |
| `frase/v1` | Frase SEO | 2 |
| `wpvr/v1` | WP VR | 2 |
| `oembed/1.0` | oEmbed | 3 |
| `wp-site-health/v1` | Site Health | - |
| `wp-block-editor/v1` | Block Editor | - |
| `wp-abilities/v1` | User Abilities | - |

**Total:** 485 Routen

---

## Dokumentation erstellt

| Datei | Inhalt |
|-------|--------|
| `docs/wordpress_api/README.md` | Uebersicht aller APIs |
| `docs/wordpress_api/core.md` | WordPress Core (Posts, Pages, Media) |
| `docs/wordpress_api/elementor.md` | Elementor Page Builder |
| `docs/wordpress_api/yoast.md` | Yoast SEO |
| `docs/wordpress_api/jwt_auth.md` | JWT Authentifizierung |
| `docs/wordpress_api/plugins.md` | Redirection, Frase, WPVR, etc. |

---

## Wichtige Erkenntnisse

### 1. Authentifizierung

- **JWT Auth** ist installiert und funktioniert
- **IONOS-Problem (L083-L084):** Authorization Header wird im CGI-Modus entfernt
- **Alternative:** Application Passwords (WP 5.6+)

### 2. Elementor

- 79 Elementor-Routen verfuegbar
- `elementor_library` ist geschuetzt (401 ohne Auth)
- Elementor speichert Content als JSON in Post-Meta `_elementor_data`
- **Empfehlung:** Seiten im Editor bearbeiten, nicht via API

### 3. Yoast SEO

- SEO-Daten werden als `yoast_head_json` in Posts ausgegeben (read-only)
- Zum Setzen: Post-Meta `_yoast_wpseo_*` verwenden
- Schema.org wird automatisch generiert

### 4. Blog-Posts

- Aktuell 10+ Posts veroeffentlicht
- 5 Kategorien: Allgemein, Regional, Sanierungsarten, Vermieter-Wissen, Uncategorized
- Posts enthalten bereits Yoast-Metadaten

### 5. Redirection

- Vollstaendige API fuer URL-Weiterleitungen
- Export/Import in CSV, JSON, Apache, Nginx
- Bulk-Operationen moeglich

---

## Test-Ergebnisse

### GET-Requests (oeffentlich)

| Endpoint | Status | Response |
|----------|--------|----------|
| `/wp-json/wp/v2/posts` | 200 OK | Posts-Liste |
| `/wp-json/wp/v2/pages` | 200 OK | Pages-Liste |
| `/wp-json/wp/v2/categories` | 200 OK | 5 Kategorien |
| `/wp-json/wp/v2/tags` | 200 OK | Tags-Liste |
| `/wp-json/wp/v2/media` | 200 OK | Media-Liste |
| `/wp-json/yoast/v1/` | 200 OK | Namespace-Info |
| `/wp-json/elementor/v1/` | 200 OK | Namespace-Info |

### Geschuetzte Endpoints

| Endpoint | Status | Grund |
|----------|--------|-------|
| `/wp-json/wp/v2/elementor_library` | 401 | Auth erforderlich |
| `/wp-json/yoast/v1/statistics` | 401 | Admin erforderlich |
| `/wp-json/redirection/v1/redirect` | 401 | Auth erforderlich |

---

## Naechste Schritte

1. **WordPress-Sync Edge Function reparieren:**
   - IONOS Auth-Problem loesen
   - Entweder .htaccess Fix oder Application Passwords

2. **Blog-Pipeline Integration:**
   - Posts via API erstellen
   - Yoast-Meta setzen
   - Featured Image hochladen

3. **Potenzielle Features:**
   - Redirection-Integration (Auto-Redirects bei Slug-Aenderungen)
   - Cookie-Consent-Tracking

---

## Beispiel: Post mit Yoast-Meta erstellen

```bash
# 1. Token holen
TOKEN=$(curl -s -X POST "https://neurealis.de/wp-json/jwt-auth/v1/token" \
  -d "username=USER" \
  -d "password=PASS" | jq -r '.token')

# 2. Post erstellen mit Yoast-Meta
curl -X POST "https://neurealis.de/wp-json/wp/v2/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Wohnungssanierung Dortmund 2026",
    "content": "<p>Inhalt...</p>",
    "excerpt": "Kurzbeschreibung...",
    "status": "draft",
    "categories": [210, 211],
    "tags": [180],
    "meta": {
      "_yoast_wpseo_title": "Wohnungssanierung Dortmund 2026 | neurealis",
      "_yoast_wpseo_metadesc": "Professionelle Wohnungssanierung in Dortmund...",
      "_yoast_wpseo_focuskw": "Wohnungssanierung Dortmund"
    }
  }'
```

---

*Erstellt: 2026-01-31*
