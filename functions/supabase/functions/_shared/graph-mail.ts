/**
 * Microsoft Graph API Mail-Funktionen
 *
 * Zentrale Funktionen für E-Mail-Abfragen mit standardmäßiger Archive-Suche.
 * Verwendung: import { fetchMessages, searchMessages, listMailFolders } from "../_shared/graph-mail.ts";
 *
 * WICHTIG: Standardmäßig werden ALLE Ordner durchsucht (Inbox + Archive + weitere).
 */

// Microsoft Graph API Base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// ============================================================================
// Datentypen
// ============================================================================

export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  toRecipients?: Array<{ emailAddress: { address: string; name: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string; name: string } }>;
  receivedDateTime: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  hasAttachments: boolean;
  importance?: string;
  conversationId?: string;
  categories?: string[];
  flag?: { flagStatus: string };
  isRead?: boolean;
  parentFolderId?: string;
}

export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface FetchMessagesOptions {
  /** Anzahl der E-Mails (default: 50) */
  top?: number;
  /** Nur E-Mails nach diesem Datum */
  receivedAfter?: Date | string;
  /** Nur E-Mails mit Anhängen */
  hasAttachments?: boolean;
  /** Felder die zurückgegeben werden sollen */
  select?: string[];
  /** Sortierung (default: receivedDateTime desc) */
  orderBy?: string;
  /**
   * Suchbereich:
   * - 'all' = Alle Ordner inkl. Archive (default)
   * - 'inbox' = Nur Inbox
   * - 'archive' = Nur Archive
   * - string = Spezifische Folder-ID
   */
  scope?: 'all' | 'inbox' | 'archive' | string;
}

export interface SearchMessagesOptions extends FetchMessagesOptions {
  /** Freitext-Suche (durchsucht alle Ordner) */
  query: string;
}

// Standard-Felder für E-Mail-Abfragen
const DEFAULT_SELECT = [
  'id', 'internetMessageId', 'subject', 'from', 'toRecipients', 'ccRecipients',
  'receivedDateTime', 'bodyPreview', 'body', 'hasAttachments', 'importance',
  'conversationId', 'categories', 'flag', 'isRead', 'parentFolderId'
];

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/**
 * Baut OData $filter String
 */
function buildFilter(options: FetchMessagesOptions): string {
  const filters: string[] = [];

  if (options.receivedAfter) {
    const date = typeof options.receivedAfter === 'string'
      ? options.receivedAfter
      : options.receivedAfter.toISOString();
    filters.push(`receivedDateTime gt ${date}`);
  }

  if (options.hasAttachments === true) {
    filters.push('hasAttachments eq true');
  }

  return filters.length > 0 ? filters.join(' and ') : '';
}

/**
 * Holt die Folder-ID für einen Ordner-Namen
 */
async function getFolderId(
  accessToken: string,
  mailbox: string,
  folderName: 'inbox' | 'archive' | 'sentitems' | 'drafts' | 'deleteditems'
): Promise<string | null> {
  const wellKnownFolders: Record<string, string> = {
    inbox: 'inbox',
    archive: 'archive',
    sentitems: 'sentitems',
    drafts: 'drafts',
    deleteditems: 'deleteditems'
  };

  // Microsoft Graph unterstützt Well-Known Folder Namen direkt
  return wellKnownFolders[folderName] || null;
}

// ============================================================================
// Hauptfunktionen
// ============================================================================

/**
 * Listet alle Mail-Ordner eines Postfachs
 */
export async function listMailFolders(
  accessToken: string,
  mailbox: string
): Promise<MailFolder[]> {
  const url = `${GRAPH_API_BASE}/users/${mailbox}/mailFolders?$select=id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`listMailFolders fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Holt E-Mails aus einem Postfach
 *
 * WICHTIG: Standardmäßig werden ALLE Ordner durchsucht (scope: 'all'),
 * inkl. Inbox, Archive, und alle anderen Ordner.
 *
 * @param accessToken - Gültiger Microsoft Graph Access Token
 * @param mailbox - E-Mail-Adresse des Postfachs
 * @param options - Optionen für die Abfrage
 * @returns Array von E-Mail-Nachrichten
 */
export async function fetchMessages(
  accessToken: string,
  mailbox: string,
  options: FetchMessagesOptions = {}
): Promise<GraphMessage[]> {
  const {
    top = 50,
    select = DEFAULT_SELECT,
    orderBy = 'receivedDateTime desc',
    scope = 'all'
  } = options;

  const filter = buildFilter(options);
  const selectStr = select.join(',');

  // Bei scope 'all' nutzen wir /messages (durchsucht alle Ordner)
  // Bei spezifischem Scope nutzen wir /mailFolders/{id}/messages
  let endpoint: string;

  if (scope === 'all') {
    // /messages durchsucht automatisch ALLE Ordner inkl. Archive
    endpoint = `${GRAPH_API_BASE}/users/${mailbox}/messages`;
  } else if (scope === 'inbox' || scope === 'archive') {
    // Well-known Folder Namen
    endpoint = `${GRAPH_API_BASE}/users/${mailbox}/mailFolders/${scope}/messages`;
  } else {
    // Spezifische Folder-ID
    endpoint = `${GRAPH_API_BASE}/users/${mailbox}/mailFolders/${scope}/messages`;
  }

  // Query-Parameter zusammenbauen
  const params = new URLSearchParams();
  params.set('$top', String(top));
  params.set('$orderby', orderBy);
  params.set('$select', selectStr);

  if (filter) {
    params.set('$filter', filter);
  }

  const url = `${endpoint}?${params.toString()}`;

  console.log(`[graph-mail] Fetching from ${mailbox}, scope: ${scope}, filter: ${filter || 'none'}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[graph-mail] Error: ${response.status} - ${errorText}`);
    throw new Error(`fetchMessages fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messages = data.value || [];

  console.log(`[graph-mail] Fetched ${messages.length} messages from ${mailbox}`);

  return messages;
}

/**
 * Durchsucht E-Mails mit Freitext-Suche ($search)
 *
 * HINWEIS: $search durchsucht AUTOMATISCH alle Ordner (Inbox, Archive, etc.)
 * und kann nicht mit $filter kombiniert werden.
 *
 * @param accessToken - Gültiger Microsoft Graph Access Token
 * @param mailbox - E-Mail-Adresse des Postfachs
 * @param options - Optionen für die Suche (query ist Pflicht)
 * @returns Array von E-Mail-Nachrichten
 */
export async function searchMessages(
  accessToken: string,
  mailbox: string,
  options: SearchMessagesOptions
): Promise<GraphMessage[]> {
  const {
    query,
    top = 50,
    select = DEFAULT_SELECT,
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error('searchMessages benötigt einen Suchbegriff (query)');
  }

  const selectStr = select.join(',');

  // $search durchsucht automatisch ALLE Ordner
  // WICHTIG: $search kann NICHT mit $filter kombiniert werden!
  const params = new URLSearchParams();
  params.set('$top', String(top));
  params.set('$select', selectStr);
  params.set('$search', `"${query}"`);

  const url = `${GRAPH_API_BASE}/users/${mailbox}/messages?${params.toString()}`;

  console.log(`[graph-mail] Searching in ${mailbox} for: ${query}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // ConsistencyLevel: eventual ist für $search erforderlich
      'ConsistencyLevel': 'eventual'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[graph-mail] Search error: ${response.status} - ${errorText}`);
    throw new Error(`searchMessages fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messages = data.value || [];

  console.log(`[graph-mail] Found ${messages.length} messages for query: ${query}`);

  return messages;
}

/**
 * Holt E-Mails aus ALLEN Ordnern (Inbox + Archive kombiniert)
 *
 * Diese Funktion holt E-Mails aus beiden Ordnern separat und kombiniert sie,
 * sortiert nach receivedDateTime. Nützlich wenn $filter benötigt wird
 * (da $search kein $filter unterstützt).
 *
 * @param accessToken - Gültiger Microsoft Graph Access Token
 * @param mailbox - E-Mail-Adresse des Postfachs
 * @param options - Optionen für die Abfrage
 * @returns Array von E-Mail-Nachrichten aus allen Ordnern
 */
export async function fetchMessagesFromAllFolders(
  accessToken: string,
  mailbox: string,
  options: Omit<FetchMessagesOptions, 'scope'> = {}
): Promise<GraphMessage[]> {
  const foldersToSearch = ['inbox', 'archive'];

  console.log(`[graph-mail] Fetching from all folders: ${foldersToSearch.join(', ')}`);

  // Parallel aus beiden Ordnern holen
  const results = await Promise.all(
    foldersToSearch.map(async (folder) => {
      try {
        return await fetchMessages(accessToken, mailbox, {
          ...options,
          scope: folder as 'inbox' | 'archive'
        });
      } catch (err) {
        // Archive-Ordner existiert möglicherweise nicht
        console.warn(`[graph-mail] Ordner ${folder} nicht verfügbar: ${err}`);
        return [];
      }
    })
  );

  // Kombinieren und nach Datum sortieren
  const allMessages = results.flat();
  allMessages.sort((a, b) =>
    new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
  );

  // Top-Limit anwenden
  const limit = options.top || 50;
  const limitedMessages = allMessages.slice(0, limit);

  console.log(`[graph-mail] Combined ${allMessages.length} messages, returning top ${limitedMessages.length}`);

  return limitedMessages;
}

/**
 * Holt Anhänge einer E-Mail
 */
export async function fetchAttachments(
  accessToken: string,
  mailbox: string,
  messageId: string,
  includeContent: boolean = false
): Promise<Array<{
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string;
}>> {
  const select = includeContent
    ? 'id,name,contentType,size,isInline,contentBytes'
    : 'id,name,contentType,size,isInline';

  const url = `${GRAPH_API_BASE}/users/${mailbox}/messages/${messageId}/attachments?$select=${select}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fetchAttachments fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Lädt den Inhalt eines einzelnen Anhangs
 */
export async function fetchAttachmentContent(
  accessToken: string,
  mailbox: string,
  messageId: string,
  attachmentId: string
): Promise<{ name: string; contentType: string; contentBytes: string }> {
  const url = `${GRAPH_API_BASE}/users/${mailbox}/messages/${messageId}/attachments/${attachmentId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fetchAttachmentContent fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  return await response.json();
}
