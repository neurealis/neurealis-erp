# Session Log: Microsoft 365 Login

**Datum:** 2026-01-27
**Thema:** Microsoft 365 (Azure AD) Login für neurealis ERP implementieren

---

## Zusammenfassung

Implementierung von Microsoft 365 Single Sign-On für das neurealis ERP SvelteKit UI. Mitarbeiter mit @neurealis.de Microsoft-Konten können sich jetzt anmelden.

---

## Implementierte Features

### 1. Azure OAuth Integration
- Azure App Registration erstellt (Single Tenant, nur @neurealis.de)
- Supabase Azure Provider konfiguriert
- PKCE-Flow für sicheren Token-Austausch

### 2. SvelteKit Auth-System
- Server-Side Session Handling via `hooks.server.ts`
- Login-Seite mit Microsoft-Button (`/login`)
- OAuth Callback Handler (`/auth/callback`)
- Logout-Funktion (`/logout`)
- Automatische Weiterleitung zu Login wenn nicht authentifiziert

### 3. UI-Verbesserungen
- Header mit Navigation (Bestellung, Übersicht, LV-Export)
- User-Email-Anzeige im Header
- Abmelden-Button
- Corporate Design angepasst (Grau statt Blau)

### 4. Bestellformular-Integration
- Eingeloggter User wird automatisch als Ansprechpartner vorausgewählt
- User-Email aus Layout-Session statt separatem API-Call

---

## Neue/Geänderte Dateien

### Neue Dateien
| Datei | Beschreibung |
|-------|--------------|
| `ui/src/lib/supabase-server.ts` | Server-Side Supabase Client für SSR |
| `ui/src/hooks.server.ts` | Server Hooks für Session-Handling |
| `ui/src/routes/+layout.server.ts` | Session-Daten an alle Seiten |
| `ui/src/routes/+layout.ts` | Browser Supabase Client |
| `ui/src/routes/login/+page.svelte` | Login-Seite |
| `ui/src/routes/login/+page.ts` | Login Page Load |
| `ui/src/routes/auth/callback/+server.ts` | OAuth Callback |
| `ui/src/routes/logout/+server.ts` | Logout Handler |
| `ui/src/routes/bestellung/+page.ts` | Bestellung Page Load |

### Geänderte Dateien
| Datei | Änderung |
|-------|----------|
| `ui/src/app.d.ts` | TypeScript-Typen für Auth |
| `ui/src/routes/+layout.svelte` | Auth-Guard, Header, Navigation |
| `ui/src/routes/bestellung/+page.svelte` | User aus Layout-Session nutzen |
| `ui/package.json` | `@supabase/ssr` hinzugefügt |

---

## Konfiguration

### Azure App Registration
- **App Name:** neurealis ERP
- **Client ID:** 5c8e8ae1-8992-40b5-b57a-e73158319644
- **Tenant ID:** d4d5edaf-e2b5-4ee4-9604-a41ec21164b6
- **Redirect URI:** `https://mfpuijttdgkllnvhvjlu.supabase.co/auth/v1/callback`
- **Supported Account Types:** Single Tenant (nur @neurealis.de)

### Supabase Auth
- **Azure Provider:** Aktiviert
- **Tenant URL:** `https://login.microsoftonline.com/d4d5edaf-e2b5-4ee4-9604-a41ec21164b6`
- **Redirect URLs:**
  - `http://localhost:5173/**`
  - `https://neurealis-erp.netlify.app/**`

---

## Test-Anleitung

### Lokal testen
```bash
cd ui && npm run dev
# Öffne http://localhost:5173
# Klicke "Mit Microsoft anmelden"
# Melde dich mit @neurealis.de Konto an
```

### Produktion
- URL: https://neurealis-erp.netlify.app
- Login mit Microsoft 365 Konto (@neurealis.de)

---

## Technische Details

### Auth-Flow
1. User öffnet App → Layout prüft Session
2. Keine Session → Weiterleitung zu `/login`
3. User klickt "Mit Microsoft anmelden"
4. → Redirect zu Microsoft Login
5. → Redirect zu Supabase Callback
6. → Supabase tauscht Code gegen Token
7. → Redirect zurück zur App (`/auth/callback`)
8. → App speichert Session in Cookies
9. → Weiterleitung zur Startseite

### Session-Handling
- Server-Side: `hooks.server.ts` erstellt Supabase Client pro Request
- Client-Side: `+layout.ts` erstellt Browser Client
- Session wird via Cookies persistiert
- `safeGetSession()` verifiziert User-Token

---

## Offene Punkte / Nächste Schritte

- [ ] Benutzer-Rollen implementieren (Admin, Bauleiter, Handwerker)
- [ ] RLS Policies für benutzerbasierte Daten
- [ ] Session-Timeout konfigurieren
- [ ] Logout aus allen Tabs (Broadcast Channel)

---

## Deployment

- **Netlify URL:** https://neurealis-erp.netlify.app
- **Deploy:** `cd ui && npx netlify deploy --prod`

---

*Erstellt am 2026-01-27*
