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

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
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
  bodyPreview: string;
  body?: {
    content: string;
    contentType: string;
  };
}

interface InvoiceEmail {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  received: string;
  preview: string;
  attachments: EmailAttachment[];
  pdfAttachments: EmailAttachment[];
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
 * Holt E-Mails mit Anhängen aus einem Postfach (ALLE Ordner inkl. Archive)
 *
 * HINWEIS: /users/{email}/messages durchsucht automatisch ALLE Ordner:
 * - Inbox, Sent, Drafts, Archive, Deleted Items, etc.
 */
async function getEmailsWithAttachments(
  accessToken: string,
  mailbox: string,
  fromDate: string,
  count: number = 50
): Promise<InvoiceEmail[]> {
  // Filter für Datum und Anhänge
  const filter = `receivedDateTime ge ${fromDate} and hasAttachments eq true`;

  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}/messages?$filter=${encodeURIComponent(filter)}&$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email fetch error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const emails: InvoiceEmail[] = [];

  for (const msg of data.value || []) {
    // Anhänge für jede E-Mail abrufen
    const attachments = await getAttachments(accessToken, mailbox, msg.id);
    const pdfAttachments = attachments.filter(a =>
      a.contentType === 'application/pdf' ||
      a.name.toLowerCase().endsWith('.pdf')
    );

    emails.push({
      id: msg.id,
      subject: msg.subject || '(Kein Betreff)',
      from: msg.from?.emailAddress?.address || 'Unbekannt',
      fromName: msg.from?.emailAddress?.name || '',
      received: msg.receivedDateTime,
      preview: msg.bodyPreview || '',
      attachments,
      pdfAttachments,
    });
  }

  return emails;
}

/**
 * Holt Anhänge einer E-Mail
 */
async function getAttachments(
  accessToken: string,
  mailbox: string,
  messageId: string
): Promise<EmailAttachment[]> {
  const response = await fetch(
    `${GRAPH_API_URL}/users/${mailbox}/messages/${messageId}/attachments?$select=id,name,contentType,size`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.value || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    contentType: a.contentType,
    size: a.size,
  }));
}

/**
 * Prüft ob ein Kontakt in der Datenbank existiert
 * Sucht zuerst nach exakter E-Mail, dann nach Domain-Match
 */
async function checkContact(email: string): Promise<{
  exists: boolean;
  types?: string[];
  name?: string;
  id?: string;
  matchType?: 'exact' | 'domain';
}> {
  // 1. Exakte E-Mail-Suche
  const { data: exactData } = await supabase
    .from('kontakte')
    .select('id, firma_kurz, firma_lang, vorname, nachname, kontaktarten')
    .or(`email.ilike.%${email}%,email_rechnung.ilike.%${email}%,email_privat.ilike.%${email}%`)
    .limit(1);

  if (exactData && exactData.length > 0) {
    const contact = exactData[0];
    const name = contact.firma_kurz || contact.firma_lang ||
      [contact.vorname, contact.nachname].filter(Boolean).join(' ') || 'Unbekannt';
    return {
      exists: true,
      types: contact.kontaktarten || [],
      name,
      id: contact.id,
      matchType: 'exact',
    };
  }

  // 2. Domain-Match (z.B. rechnung@mega.de → matcht bochum@mega.de)
  const domain = email.split('@')[1];
  if (domain) {
    const { data: domainData } = await supabase
      .from('kontakte')
      .select('id, firma_kurz, firma_lang, vorname, nachname, kontaktarten')
      .or(`email.ilike.%@${domain},email_rechnung.ilike.%@${domain},email_privat.ilike.%@${domain}`)
      .eq('aktiv', true)
      .limit(1);

    if (domainData && domainData.length > 0) {
      const contact = domainData[0];
      const name = contact.firma_kurz || contact.firma_lang ||
        [contact.vorname, contact.nachname].filter(Boolean).join(' ') || 'Unbekannt';
      return {
        exists: true,
        types: contact.kontaktarten || [],
        name,
        id: contact.id,
        matchType: 'domain',
      };
    }
  }

  return { exists: false };
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const mailbox = url.searchParams.get('mailbox') || 'rechnungen@neurealis.de';
    const fromDate = url.searchParams.get('from') || '2026-01-14T00:00:00Z';
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam) : 20;

    // Access Token holen
    const accessToken = await getAccessToken();

    // E-Mails mit Anhängen abrufen
    const emails = await getEmailsWithAttachments(accessToken, mailbox, fromDate, count);

    // Nur E-Mails mit PDF-Anhängen filtern
    const invoiceEmails = emails.filter(e => e.pdfAttachments.length > 0);

    // Kontakte prüfen
    const results = await Promise.all(invoiceEmails.map(async (email) => {
      const contact = await checkContact(email.from);

      return {
        received: email.received,
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        pdfCount: email.pdfAttachments.length,
        pdfs: email.pdfAttachments.map(p => p.name),
        contactExists: contact.exists,
        contactMatchType: contact.matchType || null,
        contactTypes: contact.types || [],
        contactName: contact.name || null,
        contactId: contact.id || null,
        emailId: email.id,
      };
    }));

    return new Response(JSON.stringify({
      success: true,
      mailbox,
      fromDate,
      totalEmails: emails.length,
      emailsWithPdf: invoiceEmails.length,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Invoice scan error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
