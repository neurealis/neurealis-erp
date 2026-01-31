import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// SharePoint Site - Default, kann per Parameter überschrieben werden
const SHAREPOINT_HOSTNAME = 'neurealisde.sharepoint.com';
const DEFAULT_SHAREPOINT_SITE_PATH = '/sites/Wohnungssanierung-Finanzen';

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

  // Refresh
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Sites.ReadWrite.All offline_access',
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
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'site-info';
    const sitePath = url.searchParams.get('site') || DEFAULT_SHAREPOINT_SITE_PATH;

    const accessToken = await getAccessToken();

    // Neue Action: list-sites - Listet alle zugänglichen SharePoint Sites
    if (action === 'list-sites') {
      const searchUrl = `${GRAPH_API_URL}/sites?search=*`;
      const response = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(JSON.stringify({
          success: false,
          error: `Sites-Suche fehlgeschlagen: ${response.status}`,
          details: error,
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const sites = await response.json();

      return new Response(JSON.stringify({
        success: true,
        count: (sites.value || []).length,
        sites: (sites.value || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName,
          webUrl: s.webUrl,
          siteCollection: s.siteCollection,
        })),
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (action === 'site-info') {
      // SharePoint Site Info abrufen - mit parametrisiertem Pfad
      const siteUrl = `${GRAPH_API_URL}/sites/${SHAREPOINT_HOSTNAME}:${sitePath}`;
      const response = await fetch(siteUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(JSON.stringify({
          success: false,
          error: `Site nicht gefunden: ${response.status}`,
          details: error,
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const site = await response.json();

      // Drives abrufen
      const drivesUrl = `${GRAPH_API_URL}/sites/${site.id}/drives`;
      const drivesResponse = await fetch(drivesUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const drivesData = await drivesResponse.json();

      return new Response(JSON.stringify({
        success: true,
        site: {
          id: site.id,
          name: site.name,
          displayName: site.displayName,
          webUrl: site.webUrl,
        },
        drives: (drivesData.value || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          driveType: d.driveType,
          webUrl: d.webUrl,
        })),
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (action === 'list-folder') {
      const folderPath = url.searchParams.get('path') || '/';

      // Erst Site-ID holen - mit parametrisiertem Pfad
      const siteUrl = `${GRAPH_API_URL}/sites/${SHAREPOINT_HOSTNAME}:${sitePath}`;
      const siteResponse = await fetch(siteUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const site = await siteResponse.json();

      // Dann Default Drive (Freigegebene Dokumente)
      const driveUrl = `${GRAPH_API_URL}/sites/${site.id}/drive`;
      const driveResponse = await fetch(driveUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const drive = await driveResponse.json();

      // Ordner-Inhalt abrufen - bei "/" den Root-Ordner nutzen
      let listUrl: string;
      if (folderPath === '/' || folderPath === '') {
        listUrl = `${GRAPH_API_URL}/drives/${drive.id}/root/children`;
      } else {
        listUrl = `${GRAPH_API_URL}/drives/${drive.id}/root:${folderPath}:/children`;
      }
      const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const error = await listResponse.text();
        return new Response(JSON.stringify({
          success: false,
          error: `Ordner nicht gefunden: ${listResponse.status}`,
          details: error,
          folderPath,
        }), {
          status: listResponse.status,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const items = await listResponse.json();

      return new Response(JSON.stringify({
        success: true,
        siteId: site.id,
        driveId: drive.id,
        folderPath,
        items: (items.value || []).map((i: any) => ({
          name: i.name,
          isFolder: !!i.folder,
          size: i.size,
          lastModified: i.lastModifiedDateTime,
        })),
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify({
      actions: ['list-sites', 'site-info', 'list-folder'],
      usage: [
        '?action=list-sites - Alle zugänglichen Sites auflisten',
        '?action=site-info&site=/sites/SiteName - Site-Info abrufen',
        '?action=list-folder&site=/sites/SiteName&path=/Ordner - Ordner auflisten',
      ],
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
