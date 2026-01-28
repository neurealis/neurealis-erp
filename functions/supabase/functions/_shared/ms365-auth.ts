/**
 * Microsoft 365 Authentifizierung mit Refresh Token
 * Verwendung: import { getValidAccessToken, isTokenExpired } from "../_shared/ms365-auth.ts";
 *
 * Nutzt Delegated Permissions mit Refresh Token für Microsoft Graph API.
 * Tokens werden in der Tabelle `ms365_tokens` gespeichert (id = 'default').
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Microsoft 365 Credentials aus Umgebungsvariablen
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// Token-Buffer: 5 Minuten vor Ablauf erneuern
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// Datentypen
// ============================================================================

/**
 * Token-Zeile aus der Datenbank
 */
interface TokenRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Antwort vom Microsoft Token-Endpoint
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

// ============================================================================
// Hilfsfunktionen (exportiert für Wiederverwendung)
// ============================================================================

/**
 * Prüft ob der Token abgelaufen ist (inkl. 5 Min Buffer)
 *
 * @param expiresAt - ISO-Datum-String des Ablaufdatums
 * @returns true wenn Token abgelaufen oder bald abläuft
 */
export function isTokenExpired(expiresAt: string): boolean {
  const expiresAtDate = new Date(expiresAt);
  const now = new Date();

  // Token gilt als abgelaufen wenn er in weniger als 5 Minuten abläuft
  return expiresAtDate.getTime() - now.getTime() < TOKEN_BUFFER_MS;
}

/**
 * Erneuert den Access Token mit dem Refresh Token
 *
 * Token Refresh Request:
 * POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 * Content-Type: application/x-www-form-urlencoded
 *
 * client_id=xxx
 * client_secret=xxx
 * refresh_token=xxx
 * grant_type=refresh_token
 * scope=https://graph.microsoft.com/.default offline_access
 *
 * @param refreshToken - Gültiger Refresh Token
 * @returns Neue Token-Daten (access_token, refresh_token, expires_in)
 * @throws Error bei fehlgeschlagenem Refresh
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default offline_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data as TokenResponse;
}

/**
 * Speichert neue Tokens in der Datenbank
 *
 * @param supabase - Supabase Client mit Service Role
 * @param tokens - Token-Response vom Microsoft Endpoint
 * @param oldRefreshToken - Fallback falls kein neuer Refresh Token zurückkommt
 */
export async function saveTokens(
  supabase: SupabaseClient,
  tokens: TokenResponse,
  oldRefreshToken?: string
): Promise<void> {
  // expires_at berechnen: jetzt + expires_in Sekunden
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Manchmal gibt Microsoft keinen neuen refresh_token zurück
  const refreshToken = tokens.refresh_token || oldRefreshToken;

  if (!refreshToken) {
    throw new Error('Kein Refresh Token vorhanden - kann Token nicht speichern');
  }

  const { error } = await supabase
    .from('ms365_tokens')
    .upsert({
      id: 'default',
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scope: tokens.scope || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Token speichern fehlgeschlagen:', error);
    throw new Error(`Token speichern fehlgeschlagen: ${error.message}`);
  }
}

// ============================================================================
// Hauptfunktionen
// ============================================================================

/**
 * Holt einen gültigen Access Token (erneuert automatisch wenn nötig)
 *
 * Ablauf:
 * 1. Token aus `ms365_tokens` Tabelle laden (id = 'default')
 * 2. Prüfen ob `expires_at` in der Zukunft liegt (mit 5 Min Buffer)
 * 3. Falls abgelaufen: Refresh Token nutzen um neuen Access Token zu holen
 * 4. Neue Tokens speichern
 * 5. Access Token zurückgeben
 *
 * @param supabase - Supabase Client (mit Service Role Key)
 * @param tokenId - ID des Tokens in ms365_tokens (default: "default")
 * @returns Gültiger Access Token für Microsoft Graph API
 * @throws Error wenn kein Token vorhanden oder Erneuerung fehlschlägt
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  tokenId: string = "default"
): Promise<string> {
  // 1. Token aus Datenbank laden
  const { data: tokenRow, error } = await supabase
    .from('ms365_tokens')
    .select('*')
    .eq('id', tokenId)
    .single();

  if (error || !tokenRow) {
    throw new Error(`Kein MS365-Token gefunden (id: ${tokenId}): ${error?.message || 'Token nicht vorhanden'}`);
  }

  const token = tokenRow as TokenRow;

  // 2. Prüfen ob Token noch gültig ist
  if (!isTokenExpired(token.expires_at)) {
    console.log('MS365 Token noch gültig, verwende cached Token');
    return token.access_token;
  }

  // 3. Token ist abgelaufen - erneuern
  console.log(`MS365 Access Token abgelaufen (${token.expires_at}), erneuere...`);

  const newTokens = await refreshAccessToken(token.refresh_token);

  // 4. Neue Tokens speichern (mit altem refresh_token als Fallback)
  await saveTokens(supabase, newTokens, token.refresh_token);

  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
  console.log(`MS365 Access Token erfolgreich erneuert, gültig bis ${newExpiresAt}`);

  // 5. Access Token zurückgeben
  return newTokens.access_token;
}

/**
 * Holt einen Access Token mit Client Credentials (Application Permissions).
 * Für APIs die keine Delegated Permissions benötigen.
 *
 * Hinweis: Dieser Flow benötigt keinen Refresh Token und nutzt nicht die
 * ms365_tokens Tabelle.
 *
 * @returns Access Token für Microsoft Graph API
 */
export async function getApplicationAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Application Token fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================================
// Utility-Funktionen
// ============================================================================

/**
 * Berechnet expires_at aus expires_in (Sekunden)
 *
 * @param expiresInSeconds - Gültigkeit in Sekunden
 * @returns ISO-Datum-String
 */
export function calculateExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
