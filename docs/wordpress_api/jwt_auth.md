# JWT Authentication API

**Namespace:** `jwt-auth/v1`
**Basis-URL:** https://neurealis.de/wp-json/jwt-auth/v1/

---

## Uebersicht

JWT Authentication fuer WordPress ermoeglicht Token-basierte API-Zugriffe.

**BEKANNTES PROBLEM (L083-L084):**
IONOS Hosting stripped den Authorization Header im CGI-Modus. Das kann zu 401-Fehlern fuehren, obwohl das Token korrekt ist.

---

## Token erhalten

### POST /jwt-auth/v1/token

JWT-Token anfordern.

**Parameter:**
| Parameter | Typ | Required | Beschreibung |
|-----------|-----|----------|--------------|
| username | string | Ja | WordPress-Username |
| password | string | Ja | Passwort |

**Beispiel:**
```bash
curl -X POST "https://neurealis.de/wp-json/jwt-auth/v1/token" \
  -d "username=holger.neumann" \
  -d "password=PASSWORT"
```

**Response (Erfolg):**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user_email": "holger.neumann@neurealis.de",
  "user_nicename": "holger-neumann",
  "user_display_name": "Holger Neumann"
}
```

**Response (Fehler):**
```json
{
  "code": "jwt_auth_failed",
  "message": "The username or password you entered is incorrect.",
  "data": {
    "status": 403
  }
}
```

---

## Token validieren

### POST /jwt-auth/v1/token/validate

Token auf Gueltigkeit pruefen.

**Header:**
- `Authorization: Bearer TOKEN`

```bash
curl -X POST "https://neurealis.de/wp-json/jwt-auth/v1/token/validate" \
  -H "Authorization: Bearer eyJ0eXAi..."
```

**Response (gueltig):**
```json
{
  "code": "jwt_auth_valid_token",
  "data": {
    "status": 200
  }
}
```

**Response (ungueltig):**
```json
{
  "code": "jwt_auth_invalid_token",
  "message": "Wrong number of segments",
  "data": {
    "status": 403
  }
}
```

---

## Token verwenden

Das Token wird im `Authorization`-Header mitgeschickt:

```bash
curl -X POST "https://neurealis.de/wp-json/wp/v2/posts" \
  -H "Authorization: Bearer eyJ0eXAi..." \
  -H "Content-Type: application/json" \
  -d '{"title": "Test-Post", "status": "draft"}'
```

---

## Admin Endpoints

### GET /jwt-auth/v1/admin/settings

JWT-Auth-Einstellungen abrufen. **Admin erforderlich!**

### POST /jwt-auth/v1/admin/settings

Einstellungen aendern. **Admin erforderlich!**

### GET /jwt-auth/v1/admin/status

Plugin-Status pruefen.

### GET /jwt-auth/v1/admin/dashboard

Dashboard-Infos abrufen.

### POST /jwt-auth/v1/admin/notices/dismiss

Admin-Hinweise ausblenden.

**Parameter:**
- `notice_id` (required): ID des Hinweises

---

## Token-Ablauf

JWT-Tokens haben ein Ablaufdatum. Standard ist oft 7 Tage.

**Token-Struktur (Base64-dekodiert):**
```json
{
  "iss": "https://neurealis.de",
  "iat": 1706666400,
  "nbf": 1706666400,
  "exp": 1707271200,
  "data": {
    "user": {
      "id": 1
    }
  }
}
```

- `iss`: Issuer (Website-URL)
- `iat`: Issued At (Unix-Timestamp)
- `exp`: Expiration (Unix-Timestamp)
- `data.user.id`: WordPress User-ID

---

## Troubleshooting

### 401 Unauthorized trotz korrektem Token

**Moegliche Ursachen:**

1. **IONOS CGI-Modus (L083):**
   - Authorization Header wird entfernt
   - Workaround: .htaccess anpassen (VORSICHT!)

   ```apache
   # In .htaccess (kann 500 Error verursachen!)
   RewriteEngine On
   RewriteCond %{HTTP:Authorization} ^(.*)
   RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
   ```

2. **Token abgelaufen:**
   - Neues Token anfordern
   - `exp` im Token pruefen

3. **Falscher User/keine Berechtigung:**
   - User muss ausreichende Rolle haben
   - Fuer Posts: mindestens "Autor"
   - Fuer Seiten: mindestens "Autor"
   - Fuer Settings: "Administrator"

### Alternative: Application Passwords

WordPress 5.6+ unterstuetzt Application Passwords als Alternative:

1. WP-Admin -> Benutzer -> Profil
2. "Anwendungspasswoerter" -> Neues hinzufuegen
3. Name eingeben -> "Neues Anwendungspasswort hinzufuegen"
4. Passwort kopieren (wird nur einmal angezeigt!)

**Verwendung:**
```bash
curl -X POST "https://neurealis.de/wp-json/wp/v2/posts" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'
```

---

## Edge Function Integration

Fuer Supabase Edge Functions:

```typescript
// Token als Environment Variable
const WP_JWT_TOKEN = Deno.env.get('WORDPRESS_JWT_TOKEN');

// API-Call
const response = await fetch('https://neurealis.de/wp-json/wp/v2/posts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${WP_JWT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Neuer Post',
    content: '<p>Inhalt</p>',
    status: 'draft'
  })
});

if (!response.ok) {
  // Token erneuern bei 401
  if (response.status === 401) {
    // Neues Token anfordern...
  }
}
```

---

*Letzte Aktualisierung: 2026-01-31*
