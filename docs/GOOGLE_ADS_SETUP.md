# Google Ads API Setup - Anleitung

---

## Schritt 1: MCC Account erstellen

1. Gehe zu: https://ads.google.com/home/tools/manager-accounts/
2. "Create a manager account" klicken
3. Account-Name: `neurealis MCC`
4. E-Mail bestätigen

---

## Schritt 2: Bestehendes Ads-Konto verknüpfen

1. Im MCC: "Accounts" → "Link existing accounts"
2. Customer ID des bestehenden Ads-Kontos eingeben
3. Verknüpfungsanfrage senden
4. Im Standard-Ads-Konto: Anfrage akzeptieren

---

## Schritt 3: Developer Token beantragen

1. Im MCC: Tools & Settings → Setup → API Center
2. "Apply for access" klicken
3. Formular ausfüllen:
   - **Tool name:** neurealis Marketing Dashboard
   - **Tool description:** Internal marketing analytics and campaign management
   - **Tool URL:** https://neurealis-erp.netlify.app
   - **Tool type:** Internal tool
4. Absenden → Developer Token wird angezeigt

**Hinweis:** Zuerst "Test Account" Zugang (Explorer), dann "Basic Access" beantragen

---

## Schritt 4: Google Cloud Project einrichten

1. Gehe zu: https://console.cloud.google.com
2. Neues Projekt erstellen: `neurealis-marketing`
3. APIs & Services → Library → "Google Ads API" aktivieren

---

## Schritt 5: OAuth2 Credentials erstellen

1. APIs & Services → Credentials → "Create Credentials" → "OAuth client ID"
2. Application type: **Web application**
3. Name: `neurealis-erp`
4. Authorized redirect URIs:
   - `https://neurealis-erp.netlify.app/auth/callback`
   - `http://localhost:5173/auth/callback` (für Dev)
5. **Client ID** und **Client Secret** notieren

---

## Schritt 6: OAuth Consent Screen

1. APIs & Services → OAuth consent screen
2. User Type: **External** (oder Internal wenn Workspace)
3. App name: `neurealis Marketing`
4. Support email: `holger.neumann@neurealis.de`
5. Scopes hinzufügen:
   - `https://www.googleapis.com/auth/adwords`
6. Test users hinzufügen (für Development)

---

## Schritt 7: Refresh Token generieren (einmalig)

### Option A: OAuth Playground
1. Gehe zu: https://developers.google.com/oauthplayground/
2. Settings (Zahnrad) → "Use your own OAuth credentials" ✅
3. Client ID + Secret eingeben
4. Scope eingeben: `https://www.googleapis.com/auth/adwords`
5. Authorize APIs → Mit Google-Account einloggen
6. "Exchange authorization code for tokens"
7. **Refresh Token** kopieren

### Option B: Manuell via curl
```bash
# 1. Authorization URL öffnen (im Browser)
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:5173/auth/callback&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline

# 2. Code aus Redirect-URL kopieren

# 3. Code gegen Tokens tauschen
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=AUTH_CODE" \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:5173/auth/callback" \
  -d "grant_type=authorization_code"
```

---

## Schritt 8: Credentials an Claude geben

Nach Abschluss diese Werte bereitstellen:

```
GOOGLE_ADS_DEVELOPER_TOKEN=XXXXXXXXXXXXXXXXXXXXXX
GOOGLE_ADS_CLIENT_ID=XXXXXXXXXX.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-XXXXXXXXX
GOOGLE_ADS_REFRESH_TOKEN=1//XXXXXXXXX
GOOGLE_ADS_CUSTOMER_ID=XXX-XXX-XXXX (ohne Bindestriche: XXXXXXXXXX)
GOOGLE_ADS_MCC_ID=XXX-XXX-XXXX (MCC Customer ID)
```

---

## Wichtige Links

- MCC erstellen: https://ads.google.com/home/tools/manager-accounts/
- Google Cloud Console: https://console.cloud.google.com
- OAuth Playground: https://developers.google.com/oauthplayground/
- API Dokumentation: https://developers.google.com/google-ads/api/docs/start
- GAQL Builder: https://developers.google.com/google-ads/api/docs/query/overview

---

## Troubleshooting

### "Developer token not approved"
→ Zuerst Test Account nutzen, dann Basic Access beantragen

### "Customer not enabled"
→ MCC muss mit Ads-Konto verknüpft sein

### "Invalid refresh token"
→ Neuen Token generieren (Schritt 7 wiederholen)

### Rate Limit Errors
→ Requests verlangsamen, Batch-Requests nutzen

---

*Erstellt: 2026-02-02*
