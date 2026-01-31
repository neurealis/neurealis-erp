import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft 365 Credentials (Application Permissions)
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// Bekannte E-Mail-Adressen bei neurealis
const KNOWN_MAILBOXES = [
  'holger.neumann@neurealis.de',
  'rechnungen@neurealis.de',
  'service@neurealis.de',      // kontakt@ ist Alias davon
  'bewerbungen@neurealis.de',
];

interface EmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  bodyPreview: string;
}

/**
 * Holt einen Access Token via Client Credentials Flow (Application Permissions)
 */
async function getAccessToken(): Promise<string> {
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
    const error = await response.text();
    throw new Error(`Token error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Holt die neuesten E-Mails aus einem Postfach
 */
async function getRecentEmails(
  accessToken: string,
  mailbox: string,
  count: number = 2
): Promise<{ emails: EmailMessage[]; error?: string }> {
  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}/messages?$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { emails: [], error: `${response.status}: ${error}` };
  }

  const data = await response.json();
  return { emails: data.value || [] };
}

/**
 * Prüft ob ein Postfach existiert und zugänglich ist
 */
async function checkMailboxAccess(
  accessToken: string,
  mailbox: string
): Promise<boolean> {
  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}?$select=id,mail`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  return response.ok;
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam) : 2;
    const mailboxParam = url.searchParams.get('mailbox'); // Optional: nur ein Postfach

    // Access Token holen (Client Credentials)
    const accessToken = await getAccessToken();

    // Postfächer zu prüfen
    const mailboxesToCheck = mailboxParam
      ? [mailboxParam]
      : KNOWN_MAILBOXES;

    // E-Mails aus jedem Postfach abrufen
    const results: Array<{
      mailbox: string;
      accessible: boolean;
      emails: Array<{
        subject: string;
        from: string;
        received: string;
        isRead: boolean;
        hasAttachments: boolean;
        preview: string;
      }>;
      error?: string;
    }> = [];

    for (const mailbox of mailboxesToCheck) {
      // Prüfen ob Postfach zugänglich
      const accessible = await checkMailboxAccess(accessToken, mailbox);

      if (!accessible) {
        results.push({
          mailbox,
          accessible: false,
          emails: [],
          error: 'Postfach nicht zugänglich oder existiert nicht',
        });
        continue;
      }

      // E-Mails abrufen
      const { emails, error } = await getRecentEmails(accessToken, mailbox, count);

      results.push({
        mailbox,
        accessible: true,
        emails: emails.map(e => ({
          subject: e.subject || '(Kein Betreff)',
          from: e.from?.emailAddress?.address || 'Unbekannt',
          received: e.receivedDateTime,
          isRead: e.isRead,
          hasAttachments: e.hasAttachments,
          preview: e.bodyPreview?.substring(0, 100) || '',
        })),
        error,
      });
    }

    const accessibleCount = results.filter(r => r.accessible).length;

    return new Response(JSON.stringify({
      success: true,
      mode: 'application_permissions',
      mailboxes_checked: mailboxesToCheck.length,
      mailboxes_accessible: accessibleCount,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Email list error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
