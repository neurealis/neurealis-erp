import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from('ms365_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    throw new Error('Kein Token gefunden');
  }

  const expiresAt = new Date(data.expires_at);
  const now = new Date();

  if (expiresAt.getTime() - 5 * 60 * 1000 > now.getTime()) {
    return data.access_token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.ReadWrite.All offline_access',
    }),
  });

  if (!response.ok) {
    throw new Error('Token-Refresh fehlgeschlagen');
  }

  const newTokens = await response.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  await supabase
    .from('ms365_tokens')
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || data.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default');

  return newTokens.access_token;
}

Deno.serve(async (req: Request) => {
  try {
    const accessToken = await getAccessToken();

    // Alle Sites auflisten, auf die der User Zugriff hat
    const sitesUrl = `${GRAPH_API_URL}/sites?search=*`;
    const sitesResponse = await fetch(sitesUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!sitesResponse.ok) {
      const error = await sitesResponse.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Sites-Abfrage fehlgeschlagen: ${sitesResponse.status}`,
        details: error,
      }), {
        status: sitesResponse.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const sitesData = await sitesResponse.json();
    const sites = [];

    for (const site of sitesData.value || []) {
      // Drives für jede Site abrufen
      const drivesUrl = `${GRAPH_API_URL}/sites/${site.id}/drives`;
      const drivesResponse = await fetch(drivesUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      let drives: any[] = [];
      if (drivesResponse.ok) {
        const drivesData = await drivesResponse.json();
        drives = (drivesData.value || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          driveType: d.driveType,
          webUrl: d.webUrl,
          quota: d.quota ? {
            total: d.quota.total,
            used: d.quota.used,
            remaining: d.quota.remaining,
          } : null,
        }));
      }

      sites.push({
        id: site.id,
        name: site.name,
        displayName: site.displayName,
        webUrl: site.webUrl,
        drives,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      totalSites: sites.length,
      sites,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
