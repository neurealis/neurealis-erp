/**
 * email-fetch: E-Mail-Abruf von Microsoft Graph API
 *
 * Funktionen:
 * - Holt E-Mails von konfigurierten Postfächern (email_accounts)
 * - Erstellt Dokumente für E-Mails und Anhänge
 * - Speichert Anhänge in Supabase Storage
 *
 * WICHTIG: Durchsucht ALLE Ordner inkl. Archive (Inbox, Sent, Archive, etc.)
 * Der /messages Endpoint ohne Folder-ID gibt E-Mails aus allen Ordnern zurück.
 *
 * Cron: alle 10 Min (6-20 Uhr)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Microsoft Graph API
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Storage Bucket
const STORAGE_BUCKET = 'email-attachments';

// Microsoft 365 Credentials
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

/**
 * Holt Access Token mit Client Credentials (Application Permissions)
 */
async function getApplicationAccessToken(): Promise<string> {
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

// Dokument-Nummern Sequenz
const CURRENT_YEAR = new Date().getFullYear();

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string;
  account_type: string;
  sync_folders: string[];
  last_sync_at: string | null;
  last_message_date: string | null;
}

interface GraphMessage {
  id: string;
  internetMessageId: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  toRecipients: Array<{ emailAddress: { address: string; name: string } }>;
  ccRecipients: Array<{ emailAddress: { address: string; name: string } }>;
  receivedDateTime: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  hasAttachments: boolean;
  importance: string;
  conversationId: string;
  categories: string[];
  flag: { flagStatus: string };
  isRead: boolean;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  isInline: boolean;
}

interface FetchResult {
  accounts_processed: number;
  emails_fetched: number;
  emails_created: number;
  attachments_created: number;
  attachments_uploaded: number;
  skipped_duplicates: number;
  errors: string[];
}

// ============== HILFSFUNKTIONEN ==============

/**
 * Generiert fortlaufende Dokument-Nummer
 */
async function generateDokumentNr(prefix: string): Promise<string> {
  // Hole höchste Nummer für dieses Präfix und Jahr
  const pattern = `${prefix}-${CURRENT_YEAR}-%`;
  const { data, error } = await supabase
    .from('dokumente')
    .select('dokument_nr')
    .like('dokument_nr', pattern)
    .order('dokument_nr', { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0) {
    const lastNr = data[0].dokument_nr;
    const match = lastNr.match(/-(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  return `${prefix}-${CURRENT_YEAR}-${String(seq).padStart(5, '0')}`;
}

/**
 * Sanitize Dateiname für Storage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
}

/**
 * Extrahiert Text aus HTML
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============== GRAPH API ==============

/**
 * Holt E-Mails von einem Postfach (ALLE Ordner inkl. Archive)
 *
 * HINWEIS: /users/{email}/messages durchsucht automatisch ALLE Ordner:
 * - Inbox, Sent, Drafts, Archive, Deleted Items, etc.
 * Kein Folder-Filter nötig für Archive-Suche.
 */
async function fetchMessagesFromAccount(
  accessToken: string,
  account: EmailAccount,
  limit: number = 50
): Promise<GraphMessage[]> {
  const messages: GraphMessage[] = [];

  // Filter: nur E-Mails seit letztem Sync
  let filter = '';
  if (account.last_message_date) {
    const lastDate = new Date(account.last_message_date).toISOString();
    filter = `&$filter=receivedDateTime gt ${lastDate}`;
  }

  const endpoint = account.account_type === 'shared'
    ? `${GRAPH_API_BASE}/users/${account.email_address}/messages`
    : `${GRAPH_API_BASE}/users/${account.email_address}/messages`;

  const url = `${endpoint}?$top=${limit}&$orderby=receivedDateTime desc&$select=id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments,importance,conversationId,categories,flag,isRead${filter}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Graph API error for ${account.email_address}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    messages.push(...(data.value || []));
    console.log(`Fetched ${messages.length} messages from ${account.email_address}`);

  } catch (err) {
    console.error(`Error fetching messages from ${account.email_address}:`, err);
  }

  return messages;
}

/**
 * Holt Anhänge einer E-Mail (mit contentBytes für jeden Anhang einzeln)
 */
async function fetchAttachments(
  accessToken: string,
  accountEmail: string,
  messageId: string
): Promise<GraphAttachment[]> {
  const attachments: GraphAttachment[] = [];

  // Erst Liste der Anhänge holen (ohne contentBytes)
  const listUrl = `${GRAPH_API_BASE}/users/${accountEmail}/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`;

  try {
    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      console.error(`Failed to list attachments: ${listResponse.status}`);
      return [];
    }

    const listData = await listResponse.json();
    const attachmentList = (listData.value || []).filter((a: GraphAttachment) => !a.isInline);

    // Für jeden Anhang einzeln contentBytes abrufen
    for (const att of attachmentList) {
      try {
        const detailUrl = `${GRAPH_API_BASE}/users/${accountEmail}/messages/${messageId}/attachments/${att.id}`;
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          if (detailData.contentBytes) {
            attachments.push({
              id: detailData.id,
              name: detailData.name,
              contentType: detailData.contentType,
              size: detailData.size,
              contentBytes: detailData.contentBytes,
              isInline: false
            });
          }
        }
      } catch (attErr) {
        console.error(`Error fetching attachment ${att.name}:`, attErr);
      }
    }

    console.log(`Fetched ${attachments.length}/${attachmentList.length} attachments with content`);
    return attachments;

  } catch (err) {
    console.error(`Error fetching attachments:`, err);
    return [];
  }
}

/**
 * Lädt Anhang zu Supabase Storage hoch
 */
async function uploadAttachmentToStorage(
  attachment: GraphAttachment,
  emailMessageId: string
): Promise<string | null> {
  try {
    // Dekodiere Base64-Content
    const binaryString = atob(attachment.contentBytes!);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Sanitize filename und erstelle Pfad
    const safeName = sanitizeFilename(attachment.name);
    const timestamp = Date.now();
    // Message-ID bereinigen: <xxx@yyy> -> xxx (ohne Sonderzeichen)
    const safeMessageId = emailMessageId.replace(/[<>@.]/g, '').substring(0, 12);
    const path = `${CURRENT_YEAR}/${safeMessageId}/${timestamp}_${safeName}`;

    // Upload zu Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, {
        contentType: attachment.contentType,
        upsert: false
      });

    if (error) {
      console.error(`Storage upload error: ${error.message}`);
      return null;
    }

    // Public URL generieren
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return urlData.publicUrl;

  } catch (err) {
    console.error(`Error uploading attachment:`, err);
    return null;
  }
}

// ============== DOKUMENT-ERSTELLUNG ==============

/**
 * Prüft ob E-Mail bereits importiert wurde
 */
async function emailExists(messageId: string, accountEmail: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('email_details')
    .select('id')
    .eq('message_id', messageId)
    .eq('account_email', accountEmail)
    .single();

  return !error && data !== null;
}

/**
 * Erstellt Dokument für E-Mail
 */
async function createEmailDocument(
  message: GraphMessage,
  account: EmailAccount
): Promise<{ dokumentId: string; emailDetailId: string } | null> {
  try {
    // Generiere Dokument-Nr
    const dokumentNr = await generateDokumentNr('E-MAIL');

    // Extrahiere Text aus Body
    const bodyText = message.body.contentType === 'html'
      ? htmlToText(message.body.content)
      : message.body.content;

    // Erstelle Dokument
    const { data: dokument, error: dokError } = await supabase
      .from('dokumente')
      .insert({
        dokument_nr: dokumentNr,
        art_des_dokuments: 'E-MAIL',
        quelle: 'E-Mail',
        datei_name: message.subject || '(Kein Betreff)',
        raw_text: bodyText.substring(0, 50000), // Max 50k Zeichen
        datum_erstellt: message.receivedDateTime.split('T')[0],
        metadata: {
          email_subject: message.subject,
          email_from: message.from.emailAddress.address,
          email_message_id: message.internetMessageId,
          postfach: account.email_address,
          has_attachments: message.hasAttachments,
          imported_at: new Date().toISOString()
        },
        absender_email_erkannt: message.from.emailAddress.address,
        absender_name_erkannt: message.from.emailAddress.name
      })
      .select('id')
      .single();

    if (dokError) {
      console.error(`Error creating email document: ${dokError.message}`);
      return null;
    }

    // Erstelle email_details
    const { data: emailDetail, error: edError } = await supabase
      .from('email_details')
      .insert({
        dokument_id: dokument.id,
        message_id: message.internetMessageId,
        graph_id: message.id,
        conversation_id: message.conversationId,
        from_address: message.from.emailAddress.address,
        from_name: message.from.emailAddress.name,
        to_addresses: message.toRecipients.map(r => r.emailAddress),
        cc_addresses: message.ccRecipients?.map(r => r.emailAddress) || [],
        body_html: message.body.contentType === 'html' ? message.body.content : null,
        body_preview: message.bodyPreview?.substring(0, 255),
        received_at: message.receivedDateTime,
        importance: message.importance,
        categories: message.categories || [],
        flag_status: message.flag?.flagStatus || 'notFlagged',
        is_read: message.isRead,
        has_attachments: message.hasAttachments,
        account_email: account.email_address,
        folder: 'inbox'
      })
      .select('id')
      .single();

    if (edError) {
      console.error(`Error creating email_details: ${edError.message}`);
      // Lösche das erstellte Dokument wieder
      await supabase.from('dokumente').delete().eq('id', dokument.id);
      return null;
    }

    return { dokumentId: dokument.id, emailDetailId: emailDetail.id };

  } catch (err) {
    console.error(`Error in createEmailDocument:`, err);
    return null;
  }
}

/**
 * Erstellt Dokument für Anhang
 */
async function createAttachmentDocument(
  attachment: GraphAttachment,
  storageUrl: string,
  parentEmailDetailId: string,
  parentDokumentId: string,
  account: EmailAccount,
  message: GraphMessage
): Promise<boolean> {
  try {
    // Generiere Dokument-Nr
    const dokumentNr = await generateDokumentNr('E-ANH');

    // Bestimme vorläufigen Dokumenttyp basierend auf Postfach
    let artDokument = 'E-ANH';
    if (account.email_address === 'rechnungen@neurealis.de') {
      artDokument = 'ER-S'; // Wird später durch email-process verfeinert
    } else if (account.email_address === 'auftraege@neurealis.de') {
      artDokument = 'AB';
    }

    // Erstelle Dokument
    const { data: dokument, error: dokError } = await supabase
      .from('dokumente')
      .insert({
        dokument_nr: dokumentNr,
        art_des_dokuments: artDokument,
        quelle: 'E-Mail',
        datei_name: attachment.name,
        datei_url: storageUrl,
        datei_groesse: attachment.size,
        datum_erstellt: message.receivedDateTime.split('T')[0],
        metadata: {
          email_subject: message.subject,
          email_from: message.from.emailAddress.address,
          email_message_id: message.internetMessageId,
          postfach: account.email_address,
          content_type: attachment.contentType,
          parent_dokument_id: parentDokumentId,
          imported_at: new Date().toISOString()
        },
        absender_email_erkannt: message.from.emailAddress.address,
        absender_name_erkannt: message.from.emailAddress.name
      })
      .select('id')
      .single();

    if (dokError) {
      console.error(`Error creating attachment document: ${dokError.message}`);
      return false;
    }

    // Erstelle email_details für Anhang
    const { error: edError } = await supabase
      .from('email_details')
      .insert({
        dokument_id: dokument.id,
        message_id: message.internetMessageId,
        graph_id: message.id,
        from_address: message.from.emailAddress.address,
        from_name: message.from.emailAddress.name,
        received_at: message.receivedDateTime,
        account_email: account.email_address,
        parent_email_id: parentEmailDetailId,
        attachment_id: attachment.id
      });

    if (edError) {
      console.error(`Error creating attachment email_details: ${edError.message}`);
      // Lösche das erstellte Dokument
      await supabase.from('dokumente').delete().eq('id', dokument.id);
      return false;
    }

    return true;

  } catch (err) {
    console.error(`Error in createAttachmentDocument:`, err);
    return false;
  }
}

// ============== SYNC-LOG ==============

async function logSync(
  accountId: string,
  dokumentId: string | null,
  action: string,
  status: string,
  errorMessage?: string,
  details?: Record<string, any>
): Promise<void> {
  await supabase.from('email_sync_log').insert({
    account_id: accountId,
    dokument_id: dokumentId,
    action,
    status,
    error_message: errorMessage,
    details
  });
}

// ============== HAUPT-SYNC ==============

async function syncEmails(limit: number = 50): Promise<FetchResult> {
  const result: FetchResult = {
    accounts_processed: 0,
    emails_fetched: 0,
    emails_created: 0,
    attachments_created: 0,
    attachments_uploaded: 0,
    skipped_duplicates: 0,
    errors: []
  };

  try {
    // 1. Hole Access Token (Application Permissions)
    const accessToken = await getApplicationAccessToken();

    // 2. Lade aktive E-Mail-Accounts
    const { data: accounts, error: accError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('vertical', 'erp')
      .eq('is_active', true);

    if (accError || !accounts) {
      result.errors.push(`Failed to load accounts: ${accError?.message}`);
      return result;
    }

    console.log(`Processing ${accounts.length} email accounts...`);

    // 3. Verarbeite jedes Postfach
    for (const account of accounts as EmailAccount[]) {
      result.accounts_processed++;

      // Status setzen
      await supabase
        .from('email_accounts')
        .update({ sync_status: 'syncing' })
        .eq('id', account.id);

      try {
        // Hole E-Mails
        const messages = await fetchMessagesFromAccount(accessToken, account, limit);
        result.emails_fetched += messages.length;

        let latestMessageDate: string | null = null;

        // Verarbeite jede E-Mail
        for (const message of messages) {
          // Duplikat-Check
          if (await emailExists(message.internetMessageId, account.email_address)) {
            result.skipped_duplicates++;
            continue;
          }

          // Erstelle E-Mail-Dokument
          const emailResult = await createEmailDocument(message, account);
          if (!emailResult) {
            result.errors.push(`Failed to create email: ${message.subject?.substring(0, 50)}`);
            continue;
          }
          result.emails_created++;

          // Tracke letztes Datum
          if (!latestMessageDate || message.receivedDateTime > latestMessageDate) {
            latestMessageDate = message.receivedDateTime;
          }

          // Verarbeite Anhänge
          if (message.hasAttachments) {
            const attachments = await fetchAttachments(accessToken, account.email_address, message.id);

            for (const attachment of attachments) {
              // Größenlimit: 25 MB
              if (attachment.size > 25 * 1024 * 1024) {
                result.errors.push(`Attachment too large (${attachment.size} bytes): ${attachment.name}`);
                continue;
              }

              // Upload zu Storage
              const storageUrl = await uploadAttachmentToStorage(attachment, message.internetMessageId);
              if (!storageUrl) {
                result.errors.push(`Failed to upload: ${attachment.name}`);
                continue;
              }
              result.attachments_uploaded++;

              // Erstelle Anhang-Dokument
              const attachSuccess = await createAttachmentDocument(
                attachment,
                storageUrl,
                emailResult.emailDetailId,
                emailResult.dokumentId,
                account,
                message
              );
              if (attachSuccess) {
                result.attachments_created++;
              }
            }
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 100));
        }

        // Update Account
        await supabase
          .from('email_accounts')
          .update({
            last_sync_at: new Date().toISOString(),
            last_message_date: latestMessageDate || account.last_message_date,
            sync_status: 'idle',
            sync_error: null
          })
          .eq('id', account.id);

        await logSync(account.id, null, 'fetch', 'success', undefined, {
          emails_fetched: messages.length,
          emails_created: result.emails_created
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Account ${account.email_address}: ${errMsg}`);

        await supabase
          .from('email_accounts')
          .update({
            sync_status: 'error',
            sync_error: errMsg
          })
          .eq('id', account.id);

        await logSync(account.id, null, 'fetch', 'error', errMsg);
      }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Sync error: ${errMsg}`);
  }

  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    console.log(`Email Fetch started (limit: ${limit})`);
    const startTime = Date.now();

    // Prüfe ob Storage-Bucket existiert
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      // Erstelle Bucket
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 26214400, // 25 MB
        allowedMimeTypes: ['application/pdf', 'image/*', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      });

      if (createError) {
        console.error(`Failed to create bucket: ${createError.message}`);
      } else {
        console.log(`Created storage bucket: ${STORAGE_BUCKET}`);
      }
    }

    const result = await syncEmails(limit);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
