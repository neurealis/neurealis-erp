import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!response.ok) throw new Error(`Token error: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

/**
 * Formatiert einen Suchbegriff für KQL (Keyword Query Language) in Microsoft Graph.
 *
 * WICHTIG: Microsoft Graph $search verwendet KQL, wobei:
 * - Der gesamte Suchstring in DOPPELTEN Anführungszeichen steht: $search="..."
 * - Phrasen (mehrteilige Begriffe) in EINFACHEN Anführungszeichen (Apostrophe) stehen
 *
 * Beispiele:
 * - "subject:Abrechnung" → "subject:Abrechnung" (einzelnes Wort, OK)
 * - "subject:Abrechnung Mietobjekte" → "subject:'Abrechnung Mietobjekte'" (Phrase!)
 * - "from:test@example.com" → "from:test@example.com" (keine Leerzeichen, OK)
 * - "body:wichtiger Text" → "body:'wichtiger Text'" (Phrase!)
 */
function formatKqlQuery(query: string): string {
  // Regex findet Feldoperatoren wie subject:, from:, body:, to:, etc.
  // Gefolgt von einem Wert der Leerzeichen enthalten kann
  const fieldPattern = /(\w+):(\S+(?:\s+\S+)*?)(?=\s+\w+:|$)/g;

  let formatted = query;
  const matches = [...query.matchAll(fieldPattern)];

  for (const match of matches) {
    const [fullMatch, field, value] = match;

    // Prüfen ob der Wert bereits in Anführungszeichen ist
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      continue; // Bereits korrekt formatiert
    }

    // Prüfen ob der Wert Leerzeichen enthält (= mehrteiliger Begriff)
    if (value.includes(' ')) {
      // Wert in EINFACHEN Anführungszeichen setzen für Phrase-Suche
      // (Doppelte Anführungszeichen würden mit den äußeren $search="..." kollidieren)
      const newValue = `${field}:'${value}'`;
      formatted = formatted.replace(fullMatch, newValue);
    }
  }

  return formatted;
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    // Unterstütze sowohl GET (Query-Parameter) als auch POST (JSON body)
    let rawQuery = '';
    let mailbox = 'holger.neumann@neurealis.de';
    let count = 25;

    if (req.method === 'POST') {
      // POST: Parameter aus JSON body
      const body = await req.json();
      rawQuery = body.query || body.q || '';
      mailbox = body.mailbox || 'holger.neumann@neurealis.de';
      count = parseInt(body.top || body.count || '25');
    } else {
      // GET: Parameter aus URL
      rawQuery = url.searchParams.get('q') || url.searchParams.get('query') || '';
      mailbox = url.searchParams.get('mailbox') || 'holger.neumann@neurealis.de';
      count = parseInt(url.searchParams.get('count') || url.searchParams.get('top') || '25');
    }

    if (!rawQuery) {
      return new Response(JSON.stringify({ error: 'Parameter q/query (Suchbegriff) fehlt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // KQL-Formatierung: Mehrteilige Begriffe in Anführungszeichen setzen
    const formattedQuery = formatKqlQuery(rawQuery);

    const accessToken = await getAccessToken();

    // $search durchsucht ALLE Ordner inkl. Archive
    // Die inneren Anführungszeichen für Phrasen werden URL-encoded
    const searchUrl = `${GRAPH_API_URL}/users/${mailbox}/messages?$search="${encodeURIComponent(formattedQuery)}"&$top=${count}&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,parentFolderId`;

    console.log(`[email-search] Original query: "${rawQuery}"`);
    console.log(`[email-search] Formatted KQL: "${formattedQuery}"`);
    console.log(`[email-search] Search URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ConsistencyLevel': 'eventual',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[email-search] Graph API error: ${response.status} - ${error}`);
      return new Response(JSON.stringify({
        error: `Graph API: ${response.status} - ${error}`,
        query: rawQuery,
        formattedQuery,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const emails = (data.value || []).map((e: any) => ({
      id: e.id,
      subject: e.subject || '(Kein Betreff)',
      from: e.from?.emailAddress?.address || 'Unbekannt',
      fromName: e.from?.emailAddress?.name || '',
      received: e.receivedDateTime,
      hasAttachments: e.hasAttachments,
      preview: e.bodyPreview?.substring(0, 150) || '',
      folderId: e.parentFolderId,
    }));

    return new Response(JSON.stringify({
      success: true,
      query: rawQuery,
      formattedQuery,
      mailbox,
      count: emails.length,
      emails,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error(`[email-search] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
