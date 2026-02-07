import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Marketing Data Sync - Google Search Console & GA4
 *
 * Ruft Daten von Google APIs ab und speichert sie in Supabase.
 * - Search Console: Keywords, Klicks, Impressionen, Position
 * - GA4: Sessions, Users, Pageviews, Traffic-Quellen
 *
 * Trigger: Cron Job (täglich um 6:00 Uhr)
 *
 * Secrets benötigt:
 * - GOOGLE_SERVICE_ACCOUNT_JSON (komplette JSON als String)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Google API Konfiguration
const GA4_PROPERTY_ID = '352559138';
const SEARCH_CONSOLE_SITE = 'sc-domain:neurealis.de';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface SyncResult {
  searchConsole: { rows: number; error?: string };
  analytics: { rows: number; error?: string };
}

// ============================================================
// JWT Erstellung für Google Service Account (RS256)
// ============================================================

function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textToBase64url(text: string): string {
  const encoder = new TextEncoder();
  return base64urlEncode(encoder.encode(text));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // PEM Header/Footer entfernen und Base64 dekodieren
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createGoogleJWT(serviceAccount: ServiceAccount, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 Stunde gültig
  };

  const headerB64 = textToBase64url(JSON.stringify(header));
  const payloadB64 = textToBase64url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(serviceAccount: ServiceAccount, scopes: string[]): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccount, scopes);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token-Fehler: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================
// Search Console API
// ============================================================

interface SearchConsoleRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function fetchSearchConsoleData(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<SearchConsoleRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_CONSOLE_SITE)}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query', 'page', 'date', 'device', 'country'],
      rowLimit: 10000, // Maximale Anzahl Zeilen
      startRow: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search Console API Fehler: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.rows || [];
}

// ============================================================
// GA4 Data API
// ============================================================

interface GA4Row {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

async function fetchGA4Data(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'conversions' },
      ],
      limit: 10000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GA4 API Fehler: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.rows || [];
}

// ============================================================
// Daten-Sync Funktionen
// ============================================================

async function syncSearchConsole(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ rows: number; error?: string }> {
  const startTime = Date.now();

  try {
    const rows = await fetchSearchConsoleData(accessToken, startDate, endDate);
    console.log(`[Search Console] ${rows.length} Zeilen abgerufen`);

    if (rows.length === 0) {
      return { rows: 0 };
    }

    // Daten für Upsert vorbereiten
    const records = rows.map((row: SearchConsoleRow) => ({
      date: row.keys[2], // date
      query: row.keys[0] || null, // query
      page: row.keys[1] || null, // page
      device: row.keys[3] || 'DESKTOP', // device
      country: row.keys[4] || 'deu', // country
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    // Upsert in Batches von 500
    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from('marketing_search_console')
        .upsert(batch, {
          onConflict: 'date,query,page,country,device',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[Search Console] Batch ${i}-${i + batch.length} Fehler:`, error);
      } else {
        totalUpserted += batch.length;
      }
    }

    // Sync Log schreiben
    await supabase.from('marketing_sync_log').insert({
      sync_type: 'search_console',
      sync_date: new Date().toISOString().split('T')[0],
      rows_synced: totalUpserted,
      status: 'success',
      duration_ms: Date.now() - startTime,
    });

    return { rows: totalUpserted };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Search Console] Fehler:', errorMsg);

    await supabase.from('marketing_sync_log').insert({
      sync_type: 'search_console',
      sync_date: new Date().toISOString().split('T')[0],
      rows_synced: 0,
      status: 'error',
      error_message: errorMsg,
      duration_ms: Date.now() - startTime,
    });

    return { rows: 0, error: errorMsg };
  }
}

async function syncGA4(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ rows: number; error?: string }> {
  const startTime = Date.now();

  try {
    const rows = await fetchGA4Data(accessToken, startDate, endDate);
    console.log(`[GA4] ${rows.length} Zeilen abgerufen`);

    if (rows.length === 0) {
      return { rows: 0 };
    }

    // Daten für Upsert vorbereiten
    // GA4 Datumformat: YYYYMMDD -> YYYY-MM-DD
    const records = rows.map((row: GA4Row) => {
      const dateRaw = row.dimensionValues[0].value;
      const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

      return {
        date,
        source: row.dimensionValues[1].value || '(direct)',
        medium: row.dimensionValues[2].value || '(none)',
        page_path: row.dimensionValues[3].value || '/',
        sessions: parseInt(row.metricValues[0].value) || 0,
        total_users: parseInt(row.metricValues[1].value) || 0,
        new_users: parseInt(row.metricValues[2].value) || 0,
        pageviews: parseInt(row.metricValues[3].value) || 0,
        avg_session_duration: parseFloat(row.metricValues[4].value) || 0,
        bounce_rate: parseFloat(row.metricValues[5].value) || 0,
        conversions: parseInt(row.metricValues[6].value) || 0,
      };
    });

    // Upsert in Batches von 500
    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from('marketing_analytics')
        .upsert(batch, {
          onConflict: 'date,page_path,source,medium',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[GA4] Batch ${i}-${i + batch.length} Fehler:`, error);
      } else {
        totalUpserted += batch.length;
      }
    }

    // Sync Log schreiben
    await supabase.from('marketing_sync_log').insert({
      sync_type: 'analytics',
      sync_date: new Date().toISOString().split('T')[0],
      rows_synced: totalUpserted,
      status: 'success',
      duration_ms: Date.now() - startTime,
    });

    return { rows: totalUpserted };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GA4] Fehler:', errorMsg);

    await supabase.from('marketing_sync_log').insert({
      sync_type: 'analytics',
      sync_date: new Date().toISOString().split('T')[0],
      rows_synced: 0,
      status: 'error',
      error_message: errorMsg,
      duration_ms: Date.now() - startTime,
    });

    return { rows: 0, error: errorMsg };
  }
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Service Account JSON aus Secret laden
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON Secret nicht konfiguriert');
    }

    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    console.log(`[Auth] Service Account: ${serviceAccount.client_email}`);

    // Zeitraum: Letzte 7 Tage (Search Console hat 2-3 Tage Verzögerung)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // 2 Tage Verzögerung
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`[Sync] Zeitraum: ${startDateStr} bis ${endDateStr}`);

    // Access Token holen (beide Scopes)
    const accessToken = await getAccessToken(serviceAccount, [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ]);
    console.log('[Auth] Access Token erhalten');

    // Daten parallel abrufen
    const [searchConsoleResult, ga4Result] = await Promise.all([
      syncSearchConsole(supabase, accessToken, startDateStr, endDateStr),
      syncGA4(supabase, accessToken, startDateStr, endDateStr),
    ]);

    const result: SyncResult = {
      searchConsole: searchConsoleResult,
      analytics: ga4Result,
    };

    console.log('[Sync] Abgeschlossen:', JSON.stringify(result));

    return new Response(
      JSON.stringify({
        success: true,
        dateRange: { start: startDateStr, end: endDateStr },
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Sync] Fehler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
