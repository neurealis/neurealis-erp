import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft 365 Credentials (Application Permissions für Mail, Delegated für OneDrive)
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// SharePoint Konfiguration (alle Sites mit Drive IDs)
const SHAREPOINT_HOSTNAME = 'neurealisde.sharepoint.com';

const SHAREPOINT_DRIVES = {
  finanzen: {
    sitePath: '/sites/Wohnungssanierung-Finanzen',
    driveId: 'b!5hbdLWjWs02-7DbHvZTifCrGtHlZK7NNtWaOVKCDypCbGzApWPvMTIHF6WMi9Jfi',
    buchhaltungPath: '/50 Finanzen/22 Buchhaltung',
  },
  projekte: {
    sitePath: '/sites/Wohnungssanierung-Projekte',
    driveId: 'b!AJA2WqVlU0ShRyU7No39N0T4zKXsA3BCnJ5jPgSc7iJVnlF9e4HZQoDJ3gNl6qpI',
  },
  management: {
    sitePath: '/sites/Wohnungssanierung-Management',
    driveId: 'b!svk3l4TNoU6LRZB0tGjuwBn0YrHtR15OvMD0QSuTXuTPCt7HjPhDSJ46tCDGjnDf',
    grosshandelPath: '/15 Großhandel',
    nachunternehmerPath: '/60 Nachunternehmer',
  },
};

// Standard-Pfade
const SHAREPOINT_DRIVE_ID = SHAREPOINT_DRIVES.finanzen.driveId;
const SHAREPOINT_BASE_PATH = `${SHAREPOINT_DRIVES.finanzen.buchhaltungPath}/${new Date().getFullYear()}`;

// Dokumenttyp-Mapping (korrigiert nach DB-Schema)
const DOC_TYPES = {
  // Eingangsrechnungen
  'ER-M': 'ER-M Eingangsrechnung Material',
  'ER-NU-S': 'ER-NU-S  Eingangsrechnung NU - Schluss',
  'ER-NU-A': 'ER-NU-A  Eingangsrechnung NU - Abschlag',
  'ER-NU-M': 'ER-NU-M  Eingangsrechnung - Material NU Abzug',
  // Angebote & Aufträge
  'ANG-LI': 'ANG-LI Angebot Lieferant',
  'AB': 'AB Auftragsbestätigung',
  'Bestellung': 'Bestellung',
  // Lieferscheine
  'LS': 'LS Lieferschein',
  // Sonstiges
  'AVIS': 'AVIS Avis',
  'S': 'S Sonstiges',
} as const;

// Pattern für Nummern-Erkennung
const ATBS_PATTERN = /20\d{2}-\d{4}/;
const NUA_PATTERN = /NUA-(\d+)/i;
const RECHNUNGS_PATTERN = /(?:RE|RG|Rechnung|Invoice)[:\s#-]*(\d{6,})/i;
const BESTELLUNG_PATTERN = /(?:Bestellung|Best|Order)[:\s#-]*(\d+)/i;

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
}

interface ContactMatch {
  id: string;
  name: string;
  types: string[];
  matchType: 'exact' | 'domain';
}

interface ClassificationResult {
  docType: keyof typeof DOC_TYPES;
  confidence: number;
  atbsNummer?: string;
  nuaNummer?: string;
  rechnungsNummer?: string;
  bestellNummer?: string;
  lieferantName?: string;
}

interface ImportResult {
  emailId: string;
  from: string;
  subject: string;
  pdfsImported: string[];
  dokumenteCreated: string[];
  sharePointPath: string;
  errors: string[];
  contact?: ContactMatch;
  classification?: ClassificationResult;
  erkannteNummern?: {
    atbs?: string;
    nua?: string;
    rechnung?: string;
    bestellung?: string;
  };
}

/**
 * Holt Application Token für Mail-Zugriff
 */
async function getMailAccessToken(): Promise<string> {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mail token error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Holt Delegated Token für OneDrive-Zugriff aus ms365_tokens
 */
async function getOneDriveAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from('ms365_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    throw new Error('Kein OneDrive-Token gefunden. Bitte über ms365-oauth?action=login einloggen.');
  }

  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  // Token noch gültig?
  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return data.access_token;
  }

  // Token erneuern
  if (!data.refresh_token) {
    throw new Error('Token abgelaufen und kein Refresh Token vorhanden.');
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
      scope: 'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
    }),
  });

  if (!response.ok) {
    throw new Error('Token-Refresh fehlgeschlagen. Bitte neu einloggen.');
  }

  const newTokens = await response.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  // Speichern
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

/**
 * Sucht Kontakt anhand E-Mail (exakt oder Domain-Match)
 */
async function findContact(email: string): Promise<ContactMatch | null> {
  // 1. Exakte E-Mail-Suche
  const { data: exactData } = await supabase
    .from('kontakte')
    .select('id, firma_kurz, firma_lang, vorname, nachname, kontaktarten')
    .or(`email.ilike.%${email}%,email_rechnung.ilike.%${email}%,email_privat.ilike.%${email}%`)
    .eq('aktiv', true)
    .limit(1);

  if (exactData && exactData.length > 0) {
    const c = exactData[0];
    const name = c.firma_kurz || c.firma_lang || `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    return {
      id: c.id,
      name,
      types: c.kontaktarten || [],
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
      const c = domainData[0];
      const name = c.firma_kurz || c.firma_lang || `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
      return {
        id: c.id,
        name,
        types: c.kontaktarten || [],
        matchType: 'domain',
      };
    }
  }

  return null;
}

/**
 * Klassifiziert Dokument anhand Betreff, Dateiname und Kontakttyp
 */
function classifyDocument(
  subject: string,
  filename: string,
  contact: ContactMatch | null
): ClassificationResult {
  const subjectLower = subject.toLowerCase();
  const filenameLower = filename.toLowerCase();
  const combined = `${subjectLower} ${filenameLower}`;
  const combinedOriginal = `${subject} ${filename}`;

  // Nummern extrahieren
  const atbsMatch = combinedOriginal.match(ATBS_PATTERN);
  const atbsNummer = atbsMatch ? atbsMatch[0] : undefined;

  const nuaMatch = combinedOriginal.match(NUA_PATTERN);
  const nuaNummer = nuaMatch ? `NUA-${nuaMatch[1]}` : undefined;

  const reMatch = combinedOriginal.match(RECHNUNGS_PATTERN);
  const rechnungsNummer = reMatch ? reMatch[1] : undefined;

  const bestMatch = combinedOriginal.match(BESTELLUNG_PATTERN);
  const bestellNummer = bestMatch ? bestMatch[1] : undefined;

  // Dokumenttyp bestimmen
  let docType: keyof typeof DOC_TYPES = 'S';
  let confidence = 0.5;

  // Keywords definieren
  const rechnungKeywords = ['rechnung', 'invoice', 're-nr', 'rg-nr', 'rechnungsnr', 're nr'];
  const angebotKeywords = ['angebot', 'offerte', 'quote', 'quotation', 'preisanfrage'];
  const lieferscheinKeywords = ['lieferschein', 'delivery', 'ls-nr', 'warenbegleitschein'];
  const abKeywords = ['auftragsbestätigung', 'ab-nr', 'order confirmation', 'bestellbestätigung'];
  const bestellungKeywords = ['bestellung', 'order', 'best-nr', 'bestellnummer'];
  const avisKeywords = ['avis', 'zahlungsavis', 'payment advice'];
  const abschlagKeywords = ['abschlag', 'anzahlung', 'teilrechnung', 'a-rechnung'];
  const schlussKeywords = ['schluss', 'schlußrechnung', 'schlussrechnung', 'endrechnung'];

  const isRechnung = rechnungKeywords.some(k => combined.includes(k));
  const isAngebot = angebotKeywords.some(k => combined.includes(k));
  const isLieferschein = lieferscheinKeywords.some(k => combined.includes(k));
  const isAB = abKeywords.some(k => combined.includes(k));
  const isBestellung = bestellungKeywords.some(k => combined.includes(k));
  const isAvis = avisKeywords.some(k => combined.includes(k));
  const isAbschlag = abschlagKeywords.some(k => combined.includes(k));
  const isSchluss = schlussKeywords.some(k => combined.includes(k));

  // Kontakttyp-basierte Klassifizierung
  const isNachunternehmer = contact?.types?.includes('Nachunternehmer');
  const isLieferant = contact?.types?.includes('Lieferant') || contact?.types?.includes('Großhandel');

  // Spezialfall: NUA-Nummer erkannt → wahrscheinlich NU-Rechnung
  const hasNuaContext = nuaNummer !== undefined;

  // PRIORITÄT 1: AVIS hat Vorrang - "Zahlungsavis" enthält oft auch "Rechnung"
  if (isAvis) {
    docType = 'AVIS';
    confidence = 0.85;
  }
  // PRIORITÄT 2: Rechnungen klassifizieren
  else if (isRechnung) {
    // Lieferanten haben IMMER ATBS (Projektnummern), NIE NUA
    // Nachunternehmer haben NUA-Nummern
    if (isLieferant) {
      // Lieferant: Standard = Material-Rechnung (ER-M)
      // Spezialfall: Expliziter "NU-Abzug" im Text → Material wird vom NU abgezogen
      if (combined.includes('nu-abzug')) {
        docType = 'ER-NU-M';
        confidence = 0.88;
      } else {
        docType = 'ER-M';
        confidence = 0.9;
      }
    } else if (isNachunternehmer || hasNuaContext) {
      // NU-Rechnung: Abschlag oder Schluss?
      // NUA-Kontext OHNE bekannten Lieferanten = immer Nachunternehmer
      if (isAbschlag) {
        docType = 'ER-NU-A';
        confidence = 0.92;
      } else {
        docType = 'ER-NU-S';
        confidence = 0.9;
      }
    } else {
      // Kein Kontakt bekannt → Standard Material-Rechnung
      docType = 'ER-M';
      confidence = 0.7;
    }
  } else if (isAngebot) {
    docType = 'ANG-LI';
    confidence = 0.85;
  } else if (isLieferschein) {
    docType = 'LS';
    confidence = 0.85;
  } else if (isAB) {
    docType = 'AB';
    confidence = 0.85;
  } else if (isBestellung) {
    docType = 'Bestellung';
    confidence = 0.85;
  } else {
    // PDF aus rechnungen@-Mailbox → wahrscheinlich Material-Rechnung
    docType = 'ER-M';
    confidence = 0.6;
  }

  return {
    docType,
    confidence,
    atbsNummer,
    nuaNummer,
    rechnungsNummer,
    bestellNummer,
    lieferantName: contact?.name,
  };
}

/**
 * Generiert strukturierten Dateinamen
 * Format: YYYY-MM-DD_DOCTYPE_ABSENDER_DOKID_ORIGINAL.pdf
 */
function generateStructuredFilename(
  originalName: string,
  docType: string,
  senderName: string,
  docId: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0];

  // Absendername bereinigen (nur alphanumerisch + Umlaute)
  const cleanSender = senderName
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);

  // Original-Name bereinigen
  const cleanOriginal = originalName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\s_-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);

  // Kurze Dok-ID (erste 8 Zeichen)
  const shortDocId = docId.substring(0, 8);

  return `${dateStr}_${docType}_${cleanSender}_${shortDocId}_${cleanOriginal}.pdf`;
}

/**
 * Sucht zugehörige NUA oder Bestellung in der DB
 */
async function findRelatedDocument(
  nuaNummer?: string,
  bestellNummer?: string
): Promise<{ nuaId?: string; bestellungId?: string }> {
  const result: { nuaId?: string; bestellungId?: string } = {};

  if (nuaNummer) {
    const { data } = await supabase
      .from('dokumente')
      .select('id')
      .eq('nua_nr', nuaNummer)
      .limit(1);
    if (data && data.length > 0) {
      result.nuaId = data[0].id;
    }
  }

  if (bestellNummer) {
    const { data } = await supabase
      .from('dokumente')
      .select('id')
      .eq('art_des_dokuments', 'Bestellung')
      .ilike('dokument_nr', `%${bestellNummer}%`)
      .limit(1);
    if (data && data.length > 0) {
      result.bestellungId = data[0].id;
    }
  }

  return result;
}

/**
 * Erstellt Eintrag in dokumente-Tabelle
 */
async function createDokumentEntry(
  docId: string,
  filename: string,
  originalFilename: string,
  fileSize: number,
  classification: ClassificationResult,
  contact: ContactMatch | null,
  sharePointPath: string,
  sharePointLink: string,
  emailData: { from: string; subject: string; received: string }
): Promise<boolean> {
  // Zugehörige Dokumente suchen
  const related = await findRelatedDocument(
    classification.nuaNummer,
    classification.bestellNummer
  );

  const { error } = await supabase
    .from('dokumente')
    .insert({
      id: docId,
      datei_name: filename,
      datei_groesse: fileSize,
      art_des_dokuments: DOC_TYPES[classification.docType],
      doktyp_erkannt: classification.docType,
      lieferant_erkannt: classification.lieferantName,
      // Erkannte Nummern
      atbs_nummer_erkannt: classification.atbsNummer,
      nua_nr_erkannt: classification.nuaNummer,
      rechnungsnummer_erkannt: classification.rechnungsNummer,
      // Verknüpfung zu NUA falls gefunden
      nua_nr: classification.nuaNummer,
      // Kontakt
      ki_confidence: classification.confidence,
      kontakt_id: contact?.id || null,
      rechnungssteller: contact?.name || emailData.from,
      // SharePoint
      sharepoint_link: sharePointLink,
      onedrive_path: sharePointPath,
      onedrive_synced_at: new Date().toISOString(),
      // Import-Metadaten
      quelle: 'email-import',
      status: classification.confidence >= 0.9 ? 'importiert' : 'review_erforderlich',
      match_methode: contact?.matchType || 'keine',
      match_confidence: contact ? (contact.matchType === 'exact' ? 1.0 : 0.8) : 0,
      metadata: {
        email_from: emailData.from,
        email_subject: emailData.subject,
        email_received: emailData.received,
        original_filename: originalFilename,
        import_timestamp: new Date().toISOString(),
        // Zuordnungen
        related_nua_id: related.nuaId,
        related_bestellung_id: related.bestellungId,
        bestellung_nr_erkannt: classification.bestellNummer,
      },
      datum_erstellt: new Date(emailData.received).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Dokument-Eintrag fehlgeschlagen:', error);
    return false;
  }

  return true;
}

/**
 * Berechnet den wöchentlichen Ordnernamen (Montag als Start)
 */
function getWeeklyFolderName(date: Date): string {
  // Finde den Montag dieser Woche
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sonntag = 6, sonst dayOfWeek - 1
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');

  return `${year}-${month}-${day} Auto-Import`;
}

/**
 * Erstellt SharePoint-Ordner falls nicht vorhanden
 */
async function ensureSharePointFolder(accessToken: string, folderPath: string): Promise<void> {
  // Prüfen ob Ordner existiert
  const checkUrl = `${GRAPH_API_URL}/drives/${SHAREPOINT_DRIVE_ID}/root:${folderPath}`;
  const checkResponse = await fetch(checkUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (checkResponse.ok) {
    return; // Ordner existiert
  }

  // Ordner erstellen (rekursiv über Graph API)
  const parts = folderPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath += '/' + part;

    const exists = await fetch(`${GRAPH_API_URL}/drives/${SHAREPOINT_DRIVE_ID}/root:${currentPath}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!exists.ok) {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      const createUrl = parentPath === '/'
        ? `${GRAPH_API_URL}/drives/${SHAREPOINT_DRIVE_ID}/root/children`
        : `${GRAPH_API_URL}/drives/${SHAREPOINT_DRIVE_ID}/root:${parentPath}:/children`;

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: part,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      });

      if (!createResponse.ok && createResponse.status !== 409) {
        const error = await createResponse.text();
        console.error(`Ordner-Erstellung fehlgeschlagen: ${currentPath}`, error);
      }
    }
  }
}

/**
 * Lädt PDF-Anhang aus E-Mail herunter
 */
async function downloadAttachment(
  accessToken: string,
  mailbox: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array | null> {
  const url = `${GRAPH_API_URL}/users/${mailbox}/messages/${messageId}/attachments/${attachmentId}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`Attachment download failed: ${response.status}`);
    return null;
  }

  const data = await response.json();

  if (!data.contentBytes) {
    return null;
  }

  // Base64 zu Uint8Array
  const binaryString = atob(data.contentBytes);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * Lädt Datei zu SharePoint hoch
 */
async function uploadToSharePoint(
  accessToken: string,
  filePath: string,
  content: Uint8Array
): Promise<boolean> {
  const url = `${GRAPH_API_URL}/drives/${SHAREPOINT_DRIVE_ID}/root:${filePath}:/content`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/pdf',
    },
    body: content,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`SharePoint upload failed for ${filePath}:`, error);
    return false;
  }

  return true;
}

/**
 * Holt E-Mails mit PDF-Anhängen (ALLE Ordner inkl. Archive)
 *
 * HINWEIS: /users/{email}/messages durchsucht automatisch ALLE Ordner:
 * - Inbox, Sent, Drafts, Archive, Deleted Items, etc.
 */
async function getEmailsWithPdfs(
  accessToken: string,
  mailbox: string,
  fromDate: string,
  count: number
): Promise<Array<{
  id: string;
  subject: string;
  from: string;
  received: string;
  attachments: EmailAttachment[];
}>> {
  const filter = `receivedDateTime ge ${fromDate} and hasAttachments eq true`;
  const url = `${GRAPH_API_URL}/users/${mailbox}/messages?$filter=${encodeURIComponent(filter)}&$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email fetch error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const emails = [];

  for (const msg of data.value || []) {
    // Anhänge abrufen
    const attUrl = `${GRAPH_API_URL}/users/${mailbox}/messages/${msg.id}/attachments?$select=id,name,contentType,size`;
    const attResponse = await fetch(attUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!attResponse.ok) continue;

    const attData = await attResponse.json();
    const pdfAttachments = (attData.value || []).filter((a: any) =>
      a.contentType === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf')
    );

    if (pdfAttachments.length > 0) {
      emails.push({
        id: msg.id,
        subject: msg.subject || '(Kein Betreff)',
        from: msg.from?.emailAddress?.address || 'Unbekannt',
        received: msg.receivedDateTime,
        attachments: pdfAttachments,
      });
    }
  }

  return emails;
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const mailbox = url.searchParams.get('mailbox') || 'rechnungen@neurealis.de';
    const fromDate = url.searchParams.get('from') || '2026-01-14T00:00:00Z';
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam) : 10;
    const dryRun = url.searchParams.get('dry_run') === 'true';

    // Tokens holen
    const mailToken = await getMailAccessToken();
    const sharepointToken = await getOneDriveAccessToken(); // Gleicher Token für SharePoint

    // E-Mails mit PDFs abrufen
    const emails = await getEmailsWithPdfs(mailToken, mailbox, fromDate, count);

    const results: ImportResult[] = [];

    for (const email of emails) {
      const result: ImportResult = {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        pdfsImported: [],
        dokumenteCreated: [],
        sharePointPath: '',
        errors: [],
      };

      // Kontakt suchen
      const contact = await findContact(email.from);
      result.contact = contact || undefined;

      // Wöchentlichen Ordner berechnen
      const emailDate = new Date(email.received);
      const weeklyFolder = getWeeklyFolderName(emailDate);
      const targetPath = `${SHAREPOINT_BASE_PATH}/${weeklyFolder}`;
      result.sharePointPath = targetPath;

      if (!dryRun) {
        // Ordner sicherstellen
        try {
          await ensureSharePointFolder(sharepointToken, targetPath);
        } catch (e) {
          result.errors.push(`Ordner-Fehler: ${e}`);
        }
      }

      // PDFs verarbeiten
      for (const att of email.attachments) {
        // Dokument klassifizieren
        const classification = classifyDocument(email.subject, att.name, contact);
        result.classification = classification;
        result.erkannteNummern = {
          atbs: classification.atbsNummer,
          nua: classification.nuaNummer,
          rechnung: classification.rechnungsNummer,
          bestellung: classification.bestellNummer,
        };

        // Eindeutige Dokument-ID generieren
        const docId = crypto.randomUUID();

        // Strukturierten Dateinamen generieren
        const senderName = contact?.name || email.from.split('@')[0];
        const structuredFilename = generateStructuredFilename(
          att.name,
          classification.docType,
          senderName,
          docId,
          emailDate
        );

        if (dryRun) {
          result.pdfsImported.push(structuredFilename);
          continue;
        }

        // PDF herunterladen
        const pdfContent = await downloadAttachment(mailToken, mailbox, email.id, att.id);

        if (!pdfContent) {
          result.errors.push(`Download fehlgeschlagen: ${att.name}`);
          continue;
        }

        const filePath = `${targetPath}/${structuredFilename}`;

        // Zu SharePoint hochladen
        const uploaded = await uploadToSharePoint(sharepointToken, filePath, pdfContent);

        if (!uploaded) {
          result.errors.push(`Upload fehlgeschlagen: ${structuredFilename}`);
          continue;
        }

        result.pdfsImported.push(structuredFilename);

        // SharePoint-Link generieren
        const sharePointLink = `https://${SHAREPOINT_HOSTNAME}${SHAREPOINT_DRIVES.finanzen.sitePath}/Shared%20Documents${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;

        // Dokument-Eintrag in Supabase erstellen
        const docCreated = await createDokumentEntry(
          docId,
          structuredFilename,
          att.name,
          att.size,
          classification,
          contact,
          filePath,
          sharePointLink,
          {
            from: email.from,
            subject: email.subject,
            received: email.received,
          }
        );

        if (docCreated) {
          result.dokumenteCreated.push(docId);
        } else {
          result.errors.push(`Dokument-DB-Eintrag fehlgeschlagen: ${docId}`);
        }
      }

      results.push(result);
    }

    // Statistiken
    const totalPdfs = results.reduce((sum, r) => sum + r.pdfsImported.length, 0);
    const totalDokumente = results.reduce((sum, r) => sum + r.dokumenteCreated.length, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const contactMatches = results.filter(r => r.contact).length;
    const highConfidence = results.filter(r => r.classification && r.classification.confidence >= 0.9).length;
    const needsReview = results.filter(r => r.classification && r.classification.confidence < 0.9).length;

    // Nummern-Statistiken
    const atbsErkannt = results.filter(r => r.erkannteNummern?.atbs).length;
    const nuaErkannt = results.filter(r => r.erkannteNummern?.nua).length;
    const rechnungErkannt = results.filter(r => r.erkannteNummern?.rechnung).length;

    // Dokumenttyp-Verteilung
    const docTypeStats: Record<string, number> = {};
    for (const r of results) {
      if (r.classification) {
        const dt = r.classification.docType;
        docTypeStats[dt] = (docTypeStats[dt] || 0) + 1;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      mailbox,
      fromDate,
      statistics: {
        emailsProcessed: emails.length,
        pdfsImported: totalPdfs,
        dokumenteCreated: totalDokumente,
        contactMatches,
        highConfidence,
        needsReview,
        errors: totalErrors,
        nummernErkannt: {
          atbs: atbsErkannt,
          nua: nuaErkannt,
          rechnung: rechnungErkannt,
        },
        dokumentTypen: docTypeStats,
      },
      targetBasePath: SHAREPOINT_BASE_PATH,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Invoice import error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
