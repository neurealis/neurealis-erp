import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * email-attachments: Sucht E-Mails und gibt Anhänge als Base64 zurück
 *
 * Query-Parameter:
 * - mailbox: E-Mail-Adresse (default: holger.neumann@neurealis.de)
 * - from: Absender-Filter (substring)
 * - subject: Betreff-Filter (substring)
 * - limit: Max. Anzahl E-Mails (default: 10)
 */

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Microsoft 365 Credentials (Application Permissions)
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string; // Base64
}

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
  hasAttachments: boolean;
}

/**
 * Holt einen Access Token via Client Credentials Flow
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
 * Listet alle Mail-Ordner eines Postfachs
 */
async function listFolders(
  accessToken: string,
  mailbox: string
): Promise<Array<{ id: string; displayName: string; totalItemCount: number }>> {
  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}/mailFolders?$select=id,displayName,totalItemCount`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Folder list error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Sucht E-Mails in allen Ordnern mit lokalem Filter
 */
async function searchEmails(
  accessToken: string,
  mailbox: string,
  fromFilter?: string,
  subjectFilter?: string,
  limit: number = 50,
  searchAllFolders: boolean = false
): Promise<EmailMessage[]> {
  let allEmails: EmailMessage[] = [];

  if (searchAllFolders) {
    // Alle Ordner durchsuchen
    const folders = await listFolders(accessToken, mailbox);
    console.log(`Durchsuche ${folders.length} Ordner...`);

    for (const folder of folders) {
      if (folder.totalItemCount === 0) continue;

      const url = `${GRAPH_API_URL}/users/${mailbox}/mailFolders/${folder.id}/messages?$top=${Math.min(limit, 999)}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const emails = data.value || [];
        console.log(`  ${folder.displayName}: ${emails.length} E-Mails`);
        allEmails = allEmails.concat(emails);
      }
    }
  } else {
    // Nur Posteingang
    const url = `${GRAPH_API_URL}/users/${mailbox}/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments`;

    console.log(`Abrufe E-Mails: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email search error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    allEmails = data.value || [];
  }

  // Lokale Filterung
  if (fromFilter) {
    const fromLower = fromFilter.toLowerCase();
    allEmails = allEmails.filter(e =>
      e.from?.emailAddress?.address?.toLowerCase().includes(fromLower) ||
      e.from?.emailAddress?.name?.toLowerCase().includes(fromLower)
    );
  }

  if (subjectFilter) {
    const subjectLower = subjectFilter.toLowerCase();
    allEmails = allEmails.filter(e =>
      e.subject?.toLowerCase().includes(subjectLower)
    );
  }

  // Nach Datum sortieren
  allEmails.sort((a, b) =>
    new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
  );

  console.log(`Nach Filter: ${allEmails.length} E-Mails`);
  return allEmails.slice(0, limit);
}

/**
 * Holt Anhänge einer E-Mail
 */
async function getAttachments(
  accessToken: string,
  mailbox: string,
  messageId: string
): Promise<Attachment[]> {
  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}/messages/${messageId}/attachments`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Attachments error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.value || [];
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const mailbox = url.searchParams.get('mailbox') || 'holger.neumann@neurealis.de';
    const fromFilter = url.searchParams.get('from') || undefined;
    const subjectFilter = url.searchParams.get('subject') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 10;

    const searchAllFolders = url.searchParams.get('allFolders') === 'true';

    console.log(`Parameter: mailbox=${mailbox}, from=${fromFilter}, subject=${subjectFilter}, limit=${limit}, allFolders=${searchAllFolders}`);

    // Access Token holen
    const accessToken = await getAccessToken();

    // E-Mails suchen
    const emails = await searchEmails(accessToken, mailbox, fromFilter, subjectFilter, limit, searchAllFolders);

    console.log(`Gefunden: ${emails.length} E-Mails`);

    // Anhänge für E-Mails mit hasAttachments=true holen
    const results: Array<{
      messageId: string;
      subject: string;
      from: string;
      received: string;
      attachments: Array<{
        name: string;
        contentType: string;
        size: number;
        contentBytes: string;
      }>;
    }> = [];

    for (const email of emails) {
      if (!email.hasAttachments) {
        continue;
      }

      const attachments = await getAttachments(accessToken, mailbox, email.id);

      // Nur File-Attachments (keine Item-Attachments)
      const fileAttachments = attachments.filter(
        (a: any) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && a.contentBytes
      );

      if (fileAttachments.length > 0) {
        results.push({
          messageId: email.id,
          subject: email.subject,
          from: email.from?.emailAddress?.address || 'Unbekannt',
          received: email.receivedDateTime,
          attachments: fileAttachments.map(a => ({
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            contentBytes: a.contentBytes || '',
          })),
        });
      }
    }

    const totalAttachments = results.reduce((sum, r) => sum + r.attachments.length, 0);

    // Auch E-Mails ohne Anhänge für Übersicht
    const allEmailsInfo = emails.map(e => ({
      subject: e.subject,
      from: e.from?.emailAddress?.address || 'Unbekannt',
      received: e.receivedDateTime,
      hasAttachments: e.hasAttachments,
    }));

    return new Response(JSON.stringify({
      success: true,
      mailbox,
      filters: { from: fromFilter, subject: subjectFilter },
      emails_found: emails.length,
      emails_with_attachments: results.length,
      total_attachments: totalAttachments,
      all_emails: allEmailsInfo,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Email attachments error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
