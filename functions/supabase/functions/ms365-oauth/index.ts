import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * MS365 OAuth2 Authorization Code Flow
 *
 * Endpunkte:
 * - GET ?action=login     → Redirect zu Microsoft Login
 * - GET ?action=callback  → Empfängt Authorization Code, tauscht gegen Tokens
 * - GET ?action=status    → Prüft ob gültiger Token vorhanden
 * - POST ?action=refresh  → Erneuert Access Token mit Refresh Token
 */

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft 365 Credentials
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// OAuth URLs
const AUTHORIZE_URL = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;

// Redirect URI (diese Edge Function)
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/ms365-oauth?action=callback`;

// Scopes für Graph API (explizit angefordert)
// - Files.ReadWrite.All: OneDrive Zugriff (lesen, schreiben, verschieben)
// - Mail.Read: E-Mails lesen (auch freigegebene Postfächer)
// - Mail.ReadWrite: E-Mails verwalten
// - User.Read: Benutzerinformationen
// - offline_access: Refresh Token erhalten
const SCOPES = [
  'https://graph.microsoft.com/Files.ReadWrite.All',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
].join(' ');

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface TokenRecord {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
}

/**
 * Generiert die Microsoft Login URL
 */
function generateLoginUrl(): string {
  const params = new URLSearchParams({
    client_id: MS365_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_mode: 'query',
    // State für CSRF-Schutz (in Produktion: zufälligen Wert generieren und in Session speichern)
    state: 'neurealis-erp-oauth',
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Tauscht Authorization Code gegen Access Token + Refresh Token
 */
async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Erneuert Access Token mit Refresh Token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Speichert Tokens in der Datenbank
 */
async function saveTokens(tokens: TokenResponse, tokenId: string = 'default'): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const { error } = await supabase
    .from('ms365_tokens')
    .upsert({
      id: tokenId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to save tokens: ${error.message}`);
  }
}

/**
 * Lädt Tokens aus der Datenbank
 */
async function loadTokens(tokenId: string = 'default'): Promise<TokenRecord | null> {
  const { data, error } = await supabase
    .from('ms365_tokens')
    .select('*')
    .eq('id', tokenId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Kein Eintrag gefunden
      return null;
    }
    throw new Error(`Failed to load tokens: ${error.message}`);
  }

  return data;
}

/**
 * Prüft ob Token gültig ist und erneuert bei Bedarf
 */
async function getValidToken(tokenId: string = 'default'): Promise<{ valid: boolean; accessToken?: string; expiresAt?: string; needsLogin?: boolean }> {
  const tokens = await loadTokens(tokenId);

  if (!tokens) {
    return { valid: false, needsLogin: true };
  }

  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 Minuten Puffer

  // Token noch gültig?
  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return {
      valid: true,
      accessToken: tokens.access_token,
      expiresAt: tokens.expires_at,
    };
  }

  // Token abgelaufen, aber Refresh Token vorhanden -> erneuern
  if (tokens.refresh_token) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      await saveTokens(newTokens, tokenId);

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      return {
        valid: true,
        accessToken: newTokens.access_token,
        expiresAt: newExpiresAt.toISOString(),
      };
    } catch (err) {
      console.error('Token refresh failed:', err);
      return { valid: false, needsLogin: true };
    }
  }

  return { valid: false, needsLogin: true };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'login': {
        // Redirect zur Microsoft Login-Seite
        const loginUrl = generateLoginUrl();

        return new Response(null, {
          status: 302,
          headers: {
            'Location': loginUrl,
          },
        });
      }

      case 'callback': {
        // Authorization Code von Microsoft empfangen
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error,
            error_description: errorDescription,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }

        if (!code) {
          return new Response(JSON.stringify({
            success: false,
            error: 'missing_code',
            message: 'Authorization code fehlt in der Callback-URL',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }

        // Code gegen Tokens tauschen
        const tokens = await exchangeCodeForTokens(code);

        // Tokens speichern
        await saveTokens(tokens);

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        return new Response(JSON.stringify({
          success: true,
          message: 'OAuth erfolgreich! Tokens wurden gespeichert.',
          expires_at: expiresAt.toISOString(),
          scope: tokens.scope,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      case 'status': {
        // Token-Status prüfen
        const tokenId = url.searchParams.get('id') || 'default';
        const result = await getValidToken(tokenId);

        if (result.valid) {
          return new Response(JSON.stringify({
            valid: true,
            expires_at: result.expiresAt,
            message: 'Token ist gültig',
          }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        } else {
          const loginUrl = generateLoginUrl();
          return new Response(JSON.stringify({
            valid: false,
            needs_login: true,
            login_url: loginUrl,
            message: 'Kein gültiger Token. Bitte über login_url anmelden.',
          }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }
      }

      case 'refresh': {
        // Token manuell erneuern
        const tokenId = url.searchParams.get('id') || 'default';
        const tokens = await loadTokens(tokenId);

        if (!tokens || !tokens.refresh_token) {
          return new Response(JSON.stringify({
            success: false,
            error: 'no_refresh_token',
            message: 'Kein Refresh Token vorhanden. Neuanmeldung erforderlich.',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }

        const newTokens = await refreshAccessToken(tokens.refresh_token);
        await saveTokens(newTokens, tokenId);

        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

        return new Response(JSON.stringify({
          success: true,
          message: 'Token erfolgreich erneuert',
          expires_at: expiresAt.toISOString(),
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      case 'token': {
        // Access Token abrufen (für andere Edge Functions)
        // ACHTUNG: Nur intern nutzen, nicht öffentlich exponieren!
        const tokenId = url.searchParams.get('id') || 'default';
        const result = await getValidToken(tokenId);

        if (!result.valid || !result.accessToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'no_valid_token',
            needs_login: true,
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          access_token: result.accessToken,
          expires_at: result.expiresAt,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      default: {
        // Hilfe-Seite
        return new Response(JSON.stringify({
          name: 'ms365-oauth',
          description: 'Microsoft 365 OAuth2 Authorization Code Flow',
          endpoints: {
            'GET ?action=login': 'Redirect zu Microsoft Login',
            'GET ?action=callback&code=xxx': 'OAuth Callback (von Microsoft)',
            'GET ?action=status': 'Prüft ob gültiger Token vorhanden',
            'POST ?action=refresh': 'Erneuert Access Token mit Refresh Token',
            'GET ?action=token': 'Holt gültigen Access Token (intern)',
          },
          redirect_uri: REDIRECT_URI,
          scopes: SCOPES,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }
  } catch (error) {
    console.error('MS365 OAuth Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
