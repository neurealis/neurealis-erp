# WordPress REST API - neurealis.de

**Stand:** 2026-01-31
**URL:** https://neurealis.de/wp-json/

---

## Uebersicht

Die WordPress-Installation auf neurealis.de bietet **485 API-Routen** in **22 Namespaces**.

### Installierte Plugins mit API

| Namespace | Plugin | Hauptfunktion |
|-----------|--------|---------------|
| `wp/v2` | WordPress Core | Posts, Pages, Media, Users |
| `jwt-auth/v1` | JWT Authentication | Token-basierte Authentifizierung |
| `elementor/v1` | Elementor | Page Builder, Templates |
| `elementor-pro/v1` | Elementor Pro | Extended Features |
| `elementor-ai/v1` | Elementor AI | KI-Integration |
| `yoast/v1` | Yoast SEO | SEO-Optimierung, Schema |
| `google-site-kit/v1` | Google Site Kit | Analytics, Search Console |
| `redirection/v1` | Redirection | URL-Weiterleitungen |
| `frase/v1` | Frase | Content-Optimierung |
| `wpvr/v1` | WP VR | Virtual Reality |
| `real-cookie-banner/v1` | Real Cookie Banner | DSGVO-Cookies |
| `siteground-optimizer/v1` | SiteGround Optimizer | Caching, Performance |

---

## Quick Links

- [Core API (wp/v2)](./core.md) - Posts, Pages, Media
- [Elementor API](./elementor.md) - Page Builder
- [Yoast SEO API](./yoast.md) - SEO-Metadaten
- [JWT Auth](./jwt_auth.md) - Authentifizierung
- [Weitere Plugins](./plugins.md) - Redirection, Frase, WPVR

---

## Authentifizierung

### JWT Token (Empfohlen)

```bash
# Token holen
curl -X POST https://neurealis.de/wp-json/jwt-auth/v1/token \
  -d "username=USER" \
  -d "password=PASS"

# Response: { "token": "eyJ0eXAi...", "user_email": "...", ... }

# Token verwenden
curl -X POST https://neurealis.de/wp-json/wp/v2/posts \
  -H "Authorization: Bearer eyJ0eXAi..." \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "status": "draft"}'
```

### Application Passwords (Alternative)

WordPress 5.6+ unterstuetzt Application Passwords:
- Erstellen unter: WP-Admin -> Benutzer -> Profil -> Anwendungspasswoerter
- Verwendung: Basic Auth mit `username:app-password`

**BEKANNTES PROBLEM:** IONOS Hosting stripped den Authorization Header im CGI-Modus. Siehe L083-L084 in learnings.md.

---

## Datenstruktur

### Post-Objekt (Auszug)

```json
{
  "id": 12235,
  "date": "2026-01-31T01:05:09",
  "slug": "leerstand-wohnung-kosten-...",
  "status": "publish",
  "title": { "rendered": "Leerstandskosten berechnen..." },
  "content": { "rendered": "<h1>..." },
  "excerpt": { "rendered": "<p>..." },
  "author": 1,
  "featured_media": 12028,
  "categories": [209],
  "tags": [201, 206, 205, 200, 204]
}
```

### Kategorien

| ID | Name | Slug | Beschreibung |
|----|------|------|--------------|
| 45 | Allgemein | allgemein | Blog-Hauptkategorie |
| 209 | Vermieter-Wissen | vermieter-wissen | Ratgeber fuer Vermieter |
| 210 | Regional | regional | Lokale Sanierungsthemen |
| 211 | Sanierungsarten | sanierungsarten | Kern-/Bad-/Komplettsanierung |

### Tags (Beispiele)

| ID | Name | Count |
|----|------|-------|
| 180 | Dortmund | 5 |
| 197 | Badsanierung | 1 |
| 198 | Bochum | 1 |
| 200 | NRW | - |
| 201 | Kosten | - |

---

## Wichtige Einschraenkungen

### 1. Schreibzugriff erfordert Authentifizierung
- Alle GET-Requests auf Posts/Pages/Media sind oeffentlich
- POST/PUT/DELETE erfordern JWT oder Application Password
- `elementor_library` ist gesperrt (401)

### 2. Yoast-Metadaten
- Yoast-Daten werden als `yoast_head_json` im Post-Objekt geliefert (read-only via REST)
- Zum Setzen von SEO-Meta muss das Post-Meta `_yoast_wpseo_*` verwendet werden

### 3. Elementor-Content
- Elementor speichert Content als `_elementor_data` Post-Meta
- Direktes Bearbeiten ueber API ist komplex (JSON-Struktur)
- Empfehlung: Seiten im Editor bearbeiten, nicht via API

---

## Statistiken

| Ressource | Anzahl |
|-----------|--------|
| **Routes total** | 485 |
| **Namespaces** | 22 |
| **Elementor Routes** | 79 |
| **wp/v2 Routes** | 132 |
| **Blog-Posts** | 10+ |
| **Pages** | 50+ |
| **Kategorien** | 5 |
| **Media** | 100+ |

---

*Letzte Aktualisierung: 2026-01-31*
