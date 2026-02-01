# Weitere Plugin-APIs

---

## Redirection Plugin

**Namespace:** `redirection/v1`
**URL:** https://neurealis.de/wp-json/redirection/v1/

URL-Weiterleitungen verwalten.

### Redirects

#### GET /redirection/v1/redirect

Alle Weiterleitungen auflisten. **Auth erforderlich!**

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| per_page | int | Items pro Seite (5-200) |
| page | int | Seitennummer |
| orderby | string | source, last_count, last_access, position, id |
| direction | string | asc, desc |
| filterBy | object | Filter-Optionen |

```bash
curl "https://neurealis.de/wp-json/redirection/v1/redirect?per_page=50" \
  -H "Authorization: Bearer TOKEN"
```

#### POST /redirection/v1/redirect

Neue Weiterleitung erstellen.

#### PUT /redirection/v1/redirect/{id}

Weiterleitung aktualisieren.

### Bulk-Operationen

#### POST /redirection/v1/bulk/redirect/{action}

Aktionen: `delete`, `enable`, `disable`, `reset`

```bash
curl -X POST "https://neurealis.de/wp-json/redirection/v1/bulk/redirect/enable" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [1, 2, 3]}'
```

### Gruppen

#### GET /redirection/v1/group

Redirect-Gruppen auflisten.

#### POST /redirection/v1/group

Neue Gruppe erstellen.

**Parameter:**
- `name` (required): Gruppenname
- `moduleId` (required): Modul-ID (0-3)

### Logs

#### GET /redirection/v1/log

Redirect-Logs abrufen.

#### GET /redirection/v1/404

404-Fehler auflisten.

### Export/Import

#### GET /redirection/v1/export/{module}/{format}

Redirects exportieren.

**Parameter:**
- `module`: 1, 2, 3 oder "all"
- `format`: csv, apache, nginx, json

```bash
curl "https://neurealis.de/wp-json/redirection/v1/export/all/json" \
  -H "Authorization: Bearer TOKEN"
```

#### POST /redirection/v1/import/file/{group_id}

Redirects importieren.

---

## Frase SEO

**Namespace:** `frase/v1`
**URL:** https://neurealis.de/wp-json/frase/v1/

Content-Optimierung mit Frase.

### Endpoints

#### GET /frase/v1/settings

Frase-Einstellungen abrufen.

#### POST /frase/v1/settings

Einstellungen aktualisieren.

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| setting1 | string | - |
| setting2 | string | - |
| setting3 | boolean | - |
| setting4 | boolean | - |
| setting5 | string | - |
| deleteAll | boolean | Alle loeschen |

---

## WP VR (Virtual Reality)

**Namespace:** `wpvr/v1`
**URL:** https://neurealis.de/wp-json/wpvr/v1/

Virtual Reality / 360-Grad Panoramas.

### Endpoints

#### GET /wpvr/v1/panodata

Panorama-Daten abrufen.

```bash
curl "https://neurealis.de/wp-json/wpvr/v1/panodata"
```

---

## Real Cookie Banner

**Namespace:** `real-cookie-banner/v1`
**URL:** https://neurealis.de/wp-json/real-cookie-banner/v1/

DSGVO-konforme Cookie-Verwaltung.

### Endpoints

#### GET /real-cookie-banner/v1/plugin

Plugin-Informationen.

### Cookie-Verwaltung (wp/v2)

Cookies und Blocker werden auch ueber die Core-API verwaltet:

- `/wp/v2/rcb-cookie` - Cookie-Definitionen
- `/wp/v2/rcb-blocker` - Content-Blocker
- `/wp/v2/rcb-banner-link` - Banner-Links
- `/wp/v2/rcb-tcf-vendor-conf` - TCF-Vendor-Konfiguration
- `/wp/v2/rcb-cookie-group` - Cookie-Gruppen

---

## Google Site Kit

**Namespace:** `google-site-kit/v1`
**URL:** https://neurealis.de/wp-json/google-site-kit/v1/

Google Analytics, Search Console Integration.

### Site Connection

#### GET /google-site-kit/v1/core/site/data/connection

Verbindungsstatus pruefen.

#### POST /google-site-kit/v1/core/site/data/setup-tag

Setup-Tag konfigurieren.

### User Authentication

#### GET /google-site-kit/v1/core/user/data/authentication

Auth-Status pruefen.

#### POST /google-site-kit/v1/core/user/data/disconnect

Verbindung trennen.

### User Settings

#### GET /google-site-kit/v1/core/user/data/user-input-settings

User-Einstellungen abrufen.

#### POST /google-site-kit/v1/core/user/data/user-input-settings

Einstellungen setzen.

### Modules

#### GET /google-site-kit/v1/core/modules/data/list

Verfuegbare Module auflisten.

---

## SiteGround Optimizer

**Namespace:** `siteground-optimizer/v1`
**URL:** https://neurealis.de/wp-json/siteground-optimizer/v1/

Caching und Performance-Optimierung.

### Cache-Verwaltung

#### POST /siteground-optimizer/v1/purge-cache

Cache leeren.

#### POST /siteground-optimizer/v1/purge-rest-cache

REST-Cache leeren.

### Feature-Toggle

#### POST /siteground-optimizer/v1/enable-option

Feature aktivieren.

#### POST /siteground-optimizer/v1/disable-option

Feature deaktivieren.

### Optimierungen

| Endpoint | Beschreibung |
|----------|--------------|
| `/combine-css` | CSS kombinieren |
| `/optimize-css` | CSS optimieren |
| `/optimize-javascript` | JS optimieren |
| `/combine-javascript` | JS kombinieren |
| `/optimize-html` | HTML optimieren |
| `/optimize-web-fonts` | Webfonts optimieren |
| `/remove-query-strings` | Query-Strings entfernen |
| `/disable-emojis` | Emojis deaktivieren |
| `/lazyload-images` | Lazy Loading |

### Server-Features

| Endpoint | Beschreibung |
|----------|--------------|
| `/enable-cache` | Caching aktivieren |
| `/enable-gzip-compression` | GZIP aktivieren |
| `/enable-browser-caching` | Browser-Caching |
| `/memcached` | Memcached-Status |
| `/webp-support` | WebP-Unterstuetzung |

---

## Real Queue

**Namespace:** `real-queue/v1`
**URL:** https://neurealis.de/wp-json/real-queue/v1/

Background-Jobs und Queue-Management.

### Endpoints

#### GET /real-queue/v1/status

Queue-Status abrufen.

#### GET /real-queue/v1/jobs

Jobs auflisten.

#### GET /real-queue/v1/job/{id}

Einzelnen Job abrufen.

#### GET /real-queue/v1/job/{id}/result

Job-Ergebnis abrufen.

#### POST /real-queue/v1/jobs/retry

Fehlgeschlagene Jobs wiederholen.

#### POST /real-queue/v1/jobs/skip

Jobs ueberspringen.

---

## SiteGround Settings

**Namespace:** `siteground-settings/v1`

#### POST /siteground-settings/v1/update-settings

SiteGround-spezifische Einstellungen aktualisieren.

---

## Real Product Manager

**Namespace:** `real-product-manager-wp-client/v1`

Lizenz- und Update-Management fuer devowl.io Plugins.

### Lizenz

#### GET /real-product-manager-wp-client/v1/plugin-update/{slug}

Update-Info fuer Plugin.

#### POST /real-product-manager-wp-client/v1/plugin-update/{slug}/license/{blogId}

Lizenz aktivieren/deaktivieren.

### Announcements

#### GET /real-product-manager-wp-client/v1/announcement/{slug}/active

Aktive Ankuendigungen.

---

*Letzte Aktualisierung: 2026-01-31*
