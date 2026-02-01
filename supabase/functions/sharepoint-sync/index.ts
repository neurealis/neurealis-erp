import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * SharePoint-Sync Edge Function v11
 *
 * Synchronisiert Dateien von SharePoint Sites nach Supabase Storage.
 * Nutzt Delta-Queries für inkrementellen Sync.
 *
 * Features:
 * - PDF, DOCX, XLSX, JPG, PNG → Download zu Supabase Storage
 * - MP4, MOV → Nur Link speichern (keine Download)
 * - Sicherheitsstufen basierend auf Site
 * - Delta-Query Support für effizientes Polling
 * - v11: Parallele Verarbeitung (3 Items concurrent, Sites nacheinander)
 * - v11: Batch-Upserts für DB-Operationen
 * - v11: lastModified-Check - unveränderte Dateien überspringen
 *
 * Aufruf:
 * - GET ?action=sync - Synchronisiert alle konfigurierten Sites
 * - GET ?action=sync&site=/sites/Wohnungssanierung-Projekte - Einzelne Site
 * - GET ?action=status - Zeigt Sync-Status
 * - GET ?action=reset - Setzt Delta-Links zurück (Full-Sync beim nächsten Mal)
 */

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const SHAREPOINT_HOSTNAME = 'neurealisde.sharepoint.com';

// MS365 Credentials
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// MS365 Auth (inline)
// ============================================================================

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getValidAccessToken(client: SupabaseClient): Promise<string> {
  const { data: tokenRow, error } = await client
    .from('ms365_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .single();

  if (error || !tokenRow) {
    throw new Error('Kein MS365-Token gefunden');
  }

  const token = tokenRow as TokenRow;
  const expiresAt = new Date(token.expires_at);
  const now = new Date();

  // Token noch gültig? (5 Min Buffer)
  if (expiresAt.getTime() - 5 * 60 * 1000 > now.getTime()) {
    return token.access_token;
  }

  // Token erneuern
  console.log('MS365 Token abgelaufen, erneuere...');
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default offline_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh fehlgeschlagen: ${response.status} - ${errorText}`);
  }

  const newTokens = await response.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  await client
    .from('ms365_tokens')
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default');

  return newTokens.access_token;
}

// ============================================================================
// Konfiguration
// ============================================================================

// Sites die synchronisiert werden sollen
const SYNC_SITES = [
  // Stufe 1: Alle Mitarbeiter
  '/sites/Wohnungssanierung',
  '/sites/Wohnungssanierung-Projekte',
  '/sites/Wohnungssanierung-Kunden',
  '/sites/Wohnungssanierung-Marketing',
  // Stufe 2: Bauleiter + GF
  '/sites/Wohnungssanierung-60Operations',
  '/sites/Wohnungssanierung-11Nachunternehmer',
  '/sites/Wohnungssanierung-15Grohandel',
  '/sites/Wohnungssanierung-00Vertrieb',
  '/sites/Wohnungssanierung-30Technik',
  // Stufe 3: GF + Buchhaltung
  '/sites/Wohnungssanierung-Finanzen',
  // Stufe 4: Nur GF
  '/sites/Wohnungssanierung-Management',
  '/sites/Wohnungssanierung-04Personal',
];

// Sicherheitsstufen pro Site
// Stufe 1: Alle Mitarbeiter
// Stufe 2: Bauleiter + GF
// Stufe 3: GF + Buchhaltung (holger@ + tobias.rangol@)
// Stufe 4: Nur GF (holger.neumann@)
const SITE_SECURITY: Record<string, number> = {
  // Stufe 1: Alle Mitarbeiter
  '/sites/Wohnungssanierung': 1,
  '/sites/Wohnungssanierung-Projekte': 1,
  '/sites/Wohnungssanierung-Kunden': 1,
  '/sites/Wohnungssanierung-Marketing': 1,
  // Stufe 2: Bauleiter + GF
  '/sites/Wohnungssanierung-60Operations': 2,
  '/sites/Wohnungssanierung-11Nachunternehmer': 2,
  '/sites/Wohnungssanierung-15Grohandel': 2,
  '/sites/Wohnungssanierung-00Vertrieb': 2,
  '/sites/Wohnungssanierung-30Technik': 2,
  // Stufe 3: GF + Buchhaltung
  '/sites/Wohnungssanierung-Finanzen': 3,
  // Stufe 4: Nur GF
  '/sites/Wohnungssanierung-Management': 4,
  '/sites/Wohnungssanierung-04Personal': 4,
};

// Sites die NICHT synchronisiert werden (Privat-Daten)
const EXCLUDED_SITES = [
  '/sites/HNPrivat',
  '/sites/HHPrivat',
  '/sites/Mieterservice',
];

// Dateitypen die heruntergeladen werden
const DOWNLOAD_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.doc', '.jpg', '.jpeg', '.png'];

// Dateitypen die nur als Link gespeichert werden (zu groß)
const LINK_ONLY_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.wmv'];

// Maximale Dateigröße für Download (50 MB)
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024;

// ============================================================================
// Typen
// ============================================================================

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  parentReference?: {
    driveId: string;
    driveType: string;
    id: string;
    path: string;
  };
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  deleted?: {
    state: string;
  };
  '@microsoft.graph.downloadUrl'?: string;
}

interface DeltaResponse {
  value: DriveItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

interface SyncResult {
  site: string;
  driveId: string;
  itemsProcessed: number;
  filesDownloaded: number;
  linksStored: number;
  foldersSkipped: number;
  deletedItems: number;
  skipped: number;  // v11: Unveränderte Dateien
  errors: number;
  errorDetails: string[];
}

// v11: Concurrency-Limits
const ITEM_CONCURRENCY = 3;   // Parallele Item-Verarbeitung (reduziert wegen Worker-Limit)
const SITE_CONCURRENCY = 1;   // Sites nacheinander (große Sites brauchen viel RAM)
const BATCH_SIZE = 20;        // DB Batch-Upsert Größe (reduziert für Stabilität)

// v11: Pending Records für Batch-Upsert
interface PendingRecord {
  record: Record<string, unknown>;
  isUpdate: boolean;
  existingId?: string;
}

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/**
 * Sanitized Dateinamen für Supabase Storage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Extrahiert Pfad aus parentReference
 */
function extractPath(item: DriveItem): string {
  if (!item.parentReference?.path) return `/${item.name}`;

  // parentReference.path ist z.B. "/drive/root:/10 GWS/ATBS-123"
  const parentPath = item.parentReference.path.replace(/^\/drives\/[^/]+\/root:?/, '') || '/';
  return parentPath === '/' ? `/${item.name}` : `${parentPath}/${item.name}`;
}

/**
 * Prüft ob Datei heruntergeladen werden soll
 */
function shouldDownload(item: DriveItem): boolean {
  if (!item.file) return false;
  if (item.size && item.size > MAX_DOWNLOAD_SIZE) return false;

  const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
  return DOWNLOAD_EXTENSIONS.includes(ext);
}

/**
 * Prüft ob Datei nur als Link gespeichert werden soll (Videos)
 */
function isLinkOnly(item: DriveItem): boolean {
  if (!item.file) return false;

  const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
  return LINK_ONLY_EXTENSIONS.includes(ext);
}

/**
 * Bestimmt art_des_dokuments basierend auf Dateityp und Pfad
 */
function determineDocumentType(item: DriveItem, sitePath: string): string {
  const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
  const path = extractPath(item).toLowerCase();

  // Videos
  if (LINK_ONLY_EXTENSIONS.includes(ext)) return 'VIDEO';

  // Bilder
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'FOTO';

  // Excel
  if (['.xlsx', '.xls'].includes(ext)) return 'TABELLE';

  // Word
  if (['.docx', '.doc'].includes(ext)) return 'WORD';

  // PDF - versuche anhand Pfad zu klassifizieren
  if (ext === '.pdf') {
    if (path.includes('rechnung') || path.includes('invoice')) return 'PDF-RE';
    if (path.includes('angebot') || path.includes('quote')) return 'PDF-ANG';
    if (path.includes('vertrag') || path.includes('contract')) return 'PDF-VTR';
    if (path.includes('protokoll')) return 'PDF-PROT';
    return 'PDF';
  }

  return 'DATEI';
}

/**
 * Extrahiert ATBS-Nummer aus Pfad
 */
function extractATBS(path: string): string | null {
  const match = path.match(/ATBS-(\d+)/i);
  return match ? `ATBS-${match[1]}` : null;
}

// ============================================================================
// v11: Batch-Upsert Funktion für DB-Operationen
// ============================================================================

/**
 * Führt Batch-Upsert für gesammelte Records aus
 */
async function flushBatchUpsert(pendingRecords: PendingRecord[], result: SyncResult): Promise<void> {
  if (pendingRecords.length === 0) return;

  // Gruppiere nach Insert/Update
  const inserts = pendingRecords.filter(p => !p.isUpdate).map(p => ({
    ...p.record,
    created_at: new Date().toISOString(),
  }));
  const updates = pendingRecords.filter(p => p.isUpdate);

  // Batch-Insert
  if (inserts.length > 0) {
    const { error } = await supabase
      .from('dokumente')
      .insert(inserts);

    if (error) {
      console.error(`Batch-Insert fehlgeschlagen für ${inserts.length} Records:`, error);
      result.errors += inserts.length;
      result.errorDetails.push(`Batch-Insert: ${error.message}`);
    }
  }

  // Updates einzeln (wegen verschiedener IDs)
  for (const upd of updates) {
    const { error } = await supabase
      .from('dokumente')
      .update(upd.record)
      .eq('id', upd.existingId);

    if (error) {
      console.error(`Update fehlgeschlagen:`, error);
      result.errors++;
      result.errorDetails.push(`Update: ${error.message}`);
    }
  }

  // Leeren
  pendingRecords.length = 0;
}

// ============================================================================
// Graph API Funktionen
// ============================================================================

/**
 * Holt Site-ID für einen Site-Pfad
 */
async function getSiteId(accessToken: string, sitePath: string): Promise<string> {
  const url = `${GRAPH_API_URL}/sites/${SHAREPOINT_HOSTNAME}:${sitePath}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Site nicht gefunden: ${sitePath} (${response.status})`);
  }

  const site = await response.json();
  return site.id;
}

/**
 * Holt Drive-ID (Dokumentenbibliothek) für eine Site
 */
async function getDriveId(accessToken: string, siteId: string): Promise<string> {
  const url = `${GRAPH_API_URL}/sites/${siteId}/drive`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Drive nicht gefunden für Site: ${siteId} (${response.status})`);
  }

  const drive = await response.json();
  return drive.id;
}

/**
 * Führt Delta-Query aus für inkrementellen Sync
 */
async function fetchDelta(
  accessToken: string,
  driveId: string,
  deltaLink: string | null
): Promise<DeltaResponse> {
  // Wenn wir einen deltaLink haben, nutzen wir diesen
  // Sonst starten wir mit dem initialen Delta-Endpoint
  const url = deltaLink || `${GRAPH_API_URL}/drives/${driveId}/root/delta?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,parentReference,folder,file,deleted`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delta-Query fehlgeschlagen: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Lädt Datei direkt herunter über /content Endpoint
 * WICHTIG: Bei SharePoint funktioniert @microsoft.graph.downloadUrl nicht immer!
 * Stattdessen direkt /content verwenden mit redirect:manual um Download-URL zu bekommen.
 */
async function downloadFile(accessToken: string, driveId: string, itemId: string, fileName: string): Promise<ArrayBuffer | null> {
  // /content Endpoint gibt einen 302 Redirect zur Download-URL zurück
  const url = `${GRAPH_API_URL}/drives/${driveId}/items/${itemId}/content`;

  try {
    // Erster Versuch: Redirect manuell behandeln für bessere Kontrolle
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      redirect: 'manual',
    });

    // 302 = Redirect zur Download-URL
    if (response.status === 302) {
      const downloadUrl = response.headers.get('Location');
      if (!downloadUrl) {
        console.error(`[Download] Kein Location-Header für ${fileName}`);
        return null;
      }

      // Download von der Redirect-URL (ohne Auth, da temporäre URL)
      const downloadResponse = await fetch(downloadUrl);
      if (!downloadResponse.ok) {
        console.error(`[Download] Redirect-URL fehlgeschlagen für ${fileName}: ${downloadResponse.status}`);
        return null;
      }
      return await downloadResponse.arrayBuffer();
    }

    // Direkte Antwort (kein Redirect)
    if (response.ok) {
      return await response.arrayBuffer();
    }

    // Fehler
    const errorText = await response.text().catch(() => 'Kein Error-Body');
    console.error(`[Download] Fehlgeschlagen für ${fileName}: ${response.status} - ${errorText.substring(0, 300)}`);
    return null;
  } catch (error) {
    console.error(`[Download] Exception für ${fileName}:`, error);
    return null;
  }
}

// ============================================================================
// Sync-Funktionen
// ============================================================================

/**
 * Lädt Sync-State aus der Datenbank
 */
async function getSyncState(sitePath: string): Promise<{ deltaLink: string | null; driveId: string | null }> {
  const { data } = await supabase
    .from('sharepoint_sync_state')
    .select('delta_link, drive_id')
    .eq('site_path', sitePath)
    .single();

  return {
    deltaLink: data?.delta_link || null,
    driveId: data?.drive_id || null,
  };
}

/**
 * Speichert Sync-State in der Datenbank
 */
async function saveSyncState(
  sitePath: string,
  driveId: string,
  deltaLink: string,
  itemsSynced: number
): Promise<void> {
  const id = `sp-${sitePath.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  await supabase
    .from('sharepoint_sync_state')
    .upsert({
      id,
      site_path: sitePath,
      drive_id: driveId,
      delta_link: deltaLink,
      last_sync_at: new Date().toISOString(),
      items_synced: itemsSynced,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
}

/**
 * Lädt Datei herunter und speichert in Supabase Storage
 */
async function downloadAndStore(
  accessToken: string,
  driveId: string,
  item: DriveItem,
  sitePath: string
): Promise<string | null> {
  try {
    // Datei direkt über /content herunterladen
    const fileData = await downloadFile(accessToken, driveId, item.id, item.name);
    if (!fileData) {
      console.error(`[Sync] Download fehlgeschlagen für: ${item.name}`);
      return null;
    }

    const blob = new Blob([fileData], { type: item.file?.mimeType || 'application/octet-stream' });

    // Storage-Pfad generieren
    const siteName = sitePath.replace('/sites/', '').toLowerCase();
    const path = extractPath(item);
    const safeFilename = sanitizeFilename(item.name);
    const storagePath = `sharepoint/${siteName}${path.substring(0, path.lastIndexOf('/'))}/${safeFilename}`.replace(/\/+/g, '/');

    // In Supabase Storage hochladen
    const { error: uploadError } = await supabase.storage
      .from('dokumente')
      .upload(storagePath, blob, {
        contentType: item.file?.mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload fehlgeschlagen für ${item.name}:`, uploadError);
      return null;
    }

    // Public URL generieren
    const { data: urlData } = supabase.storage
      .from('dokumente')
      .getPublicUrl(storagePath);

    return urlData.publicUrl;

  } catch (error) {
    console.error(`Fehler beim Download/Upload von ${item.name}:`, error);
    return null;
  }
}

/**
 * Verarbeitet ein einzelnes Item (Datei oder Ordner)
 * v11: Nutzt pendingRecords für Batch-Upsert und lastModified-Check
 */
async function processItem(
  accessToken: string,
  driveId: string,
  item: DriveItem,
  sitePath: string,
  result: SyncResult,
  pendingRecords: PendingRecord[]
): Promise<void> {
  // Gelöschte Items
  if (item.deleted) {
    // Markiere als gelöscht in der Datenbank
    await supabase
      .from('dokumente')
      .update({
        status: 'geloescht',
        updated_at: new Date().toISOString(),
      })
      .eq('onedrive_item_id', item.id);

    result.deletedItems++;
    return;
  }

  // Ordner überspringen (für Delta-Tracking aber wichtig zu loggen)
  if (item.folder) {
    result.foldersSkipped++;
    return;
  }

  // Nur Dateien mit relevanten Endungen verarbeiten
  const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
  if (!DOWNLOAD_EXTENSIONS.includes(ext) && !LINK_ONLY_EXTENSIONS.includes(ext)) {
    return;
  }

  // v11: lastModified-Check - Existierendes Dokument prüfen
  const { data: existing } = await supabase
    .from('dokumente')
    .select('id, onedrive_synced_at')
    .eq('onedrive_item_id', item.id)
    .single();

  // v11: Überspringe wenn Datei unverändert (bei vorhandenem Sync)
  if (existing?.onedrive_synced_at) {
    const lastSyncedAt = new Date(existing.onedrive_synced_at);
    const lastModifiedAt = new Date(item.lastModifiedDateTime);
    if (lastSyncedAt >= lastModifiedAt) {
      result.skipped++;
      return;
    }
  }

  const path = extractPath(item);
  const sicherheitsstufe = SITE_SECURITY[sitePath] || 1;
  const atbsNummer = extractATBS(path);
  const artDesDokuments = determineDocumentType(item, sitePath);

  let dateiUrl: string | null = null;

  // Download oder nur Link?
  if (shouldDownload(item)) {
    dateiUrl = await downloadAndStore(accessToken, driveId, item, sitePath);
    if (dateiUrl) {
      result.filesDownloaded++;
    } else {
      result.errors++;
      result.errorDetails.push(`Download fehlgeschlagen: ${item.name}`);
      return;
    }
  } else if (isLinkOnly(item)) {
    // Für Videos: Nur SharePoint-Link speichern
    dateiUrl = null; // Kein lokaler Download
    result.linksStored++;
  } else {
    // Weder Download noch Link-Only - überspringen
    return;
  }

  // Dokument-Record erstellen/aktualisieren
  const dokumentNr = `SP-${item.id.substring(0, 8)}`.toUpperCase();

  const record: Record<string, unknown> = {
    dokument_nr: dokumentNr,
    art_des_dokuments: artDesDokuments,
    datei_name: item.name,
    datei_groesse: item.size || null,
    datei_url: dateiUrl,
    sharepoint_link: item.webUrl,
    onedrive_item_id: item.id,
    onedrive_path: path,
    onedrive_synced_at: new Date().toISOString(),
    quelle: 'sharepoint',
    sicherheitsstufe,
    datum_erstellt: new Date(item.createdDateTime).toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
    metadata: {
      sharepoint_site: sitePath,
      drive_id: driveId,
      mime_type: item.file?.mimeType,
      last_modified: item.lastModifiedDateTime,
    },
  };

  // ATBS-Nummer zuordnen wenn gefunden
  if (atbsNummer) {
    record.atbs_nummer = atbsNummer;
  }

  // v11: Zu Batch hinzufügen statt sofort schreiben
  pendingRecords.push({
    record,
    isUpdate: !!existing,
    existingId: existing?.id,
  });

  result.itemsProcessed++;
}

/**
 * Synchronisiert eine einzelne SharePoint Site
 * v11: Parallele Item-Verarbeitung + Batch-Upserts
 */
async function syncSite(accessToken: string, sitePath: string): Promise<SyncResult> {
  const result: SyncResult = {
    site: sitePath,
    driveId: '',
    itemsProcessed: 0,
    filesDownloaded: 0,
    linksStored: 0,
    foldersSkipped: 0,
    deletedItems: 0,
    skipped: 0,  // v11: Unveränderte Dateien
    errors: 0,
    errorDetails: [],
  };

  // v11: Pending Records für Batch-Upsert
  const pendingRecords: PendingRecord[] = [];

  try {
    // Site-ID und Drive-ID holen
    const siteId = await getSiteId(accessToken, sitePath);
    const driveId = await getDriveId(accessToken, siteId);
    result.driveId = driveId;

    // Bestehenden Sync-State laden
    const state = await getSyncState(sitePath);
    let deltaLink = state.deltaLink;

    console.log(`[${sitePath}] Sync starte, Delta-Link: ${deltaLink ? 'vorhanden' : 'neu'}`);

    // Delta-Query ausführen (mit Pagination)
    let hasMore = true;
    let nextLink: string | null = null;
    let newDeltaLink: string | null = null;
    let pageCount = 0;

    while (hasMore) {
      const deltaResponse = await fetchDelta(accessToken, driveId, nextLink || deltaLink);
      pageCount++;
      const items = deltaResponse.value;

      console.log(`[${sitePath}] Seite ${pageCount}: ${items.length} Items`);

      // v11: Parallele Verarbeitung mit Chunk-basiertem Concurrency
      for (let i = 0; i < items.length; i += ITEM_CONCURRENCY) {
        const chunk = items.slice(i, i + ITEM_CONCURRENCY);

        // Parallel verarbeiten
        await Promise.allSettled(
          chunk.map(item => processItem(accessToken, driveId, item, sitePath, result, pendingRecords))
        );

        // v11: Batch-Upsert wenn genug Records gesammelt
        if (pendingRecords.length >= BATCH_SIZE) {
          console.log(`[${sitePath}] Batch-Upsert: ${pendingRecords.length} Records`);
          await flushBatchUpsert(pendingRecords, result);
        }
      }

      // Pagination
      if (deltaResponse['@odata.nextLink']) {
        nextLink = deltaResponse['@odata.nextLink'];
      } else {
        hasMore = false;
        newDeltaLink = deltaResponse['@odata.deltaLink'] || null;
      }
    }

    // v11: Restliche Records flushen
    if (pendingRecords.length > 0) {
      console.log(`[${sitePath}] Finale Batch-Upsert: ${pendingRecords.length} Records`);
      await flushBatchUpsert(pendingRecords, result);
    }

    // Neuen Delta-Link speichern
    if (newDeltaLink) {
      await saveSyncState(sitePath, driveId, newDeltaLink, result.itemsProcessed);
    }

    console.log(`[${sitePath}] Sync abgeschlossen: ${result.itemsProcessed} verarbeitet, ${result.filesDownloaded} Downloads, ${result.skipped} übersprungen, ${result.errors} Fehler`);

  } catch (error) {
    console.error(`[${sitePath}] Sync fehlgeschlagen:`, error);
    result.errors++;
    result.errorDetails.push(`Site-Fehler: ${String(error)}`);
  }

  return result;
}

// ============================================================================
// HTTP Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'help';
    const siteParam = url.searchParams.get('site');

    // Access Token holen
    const accessToken = await getValidAccessToken(supabase);

    switch (action) {
      case 'sync': {
        const startTime = Date.now();
        const results: SyncResult[] = [];

        // Welche Sites synchronisieren?
        const sitesToSync = siteParam
          ? [siteParam]
          : SYNC_SITES.filter(s => !EXCLUDED_SITES.includes(s));

        console.log(`[SharePoint-Sync v11] Starte Sync für ${sitesToSync.length} Sites (${SITE_CONCURRENCY} parallel)`);

        // v11: Parallele Site-Verarbeitung mit Chunk-basiertem Concurrency
        for (let i = 0; i < sitesToSync.length; i += SITE_CONCURRENCY) {
          const chunk = sitesToSync.slice(i, i + SITE_CONCURRENCY);
          console.log(`[SharePoint-Sync v11] Site-Chunk ${Math.floor(i / SITE_CONCURRENCY) + 1}: ${chunk.map(s => s.replace('/sites/', '')).join(', ')}`);

          const chunkResults = await Promise.allSettled(
            chunk.map(site => syncSite(accessToken, site))
          );

          // Erfolgreiche Ergebnisse sammeln
          for (const r of chunkResults) {
            if (r.status === 'fulfilled') {
              results.push(r.value);
            } else {
              console.error('[SharePoint-Sync v11] Site-Sync Fehler:', r.reason);
              // Dummy-Result für fehlgeschlagene Sites
              results.push({
                site: 'unknown',
                driveId: '',
                itemsProcessed: 0,
                filesDownloaded: 0,
                linksStored: 0,
                foldersSkipped: 0,
                deletedItems: 0,
                skipped: 0,
                errors: 1,
                errorDetails: [String(r.reason)],
              });
            }
          }
        }

        // Gesamtstatistik (v11: mit skipped)
        const totals = results.reduce((acc, r) => ({
          itemsProcessed: acc.itemsProcessed + r.itemsProcessed,
          filesDownloaded: acc.filesDownloaded + r.filesDownloaded,
          linksStored: acc.linksStored + r.linksStored,
          foldersSkipped: acc.foldersSkipped + r.foldersSkipped,
          deletedItems: acc.deletedItems + r.deletedItems,
          skipped: acc.skipped + r.skipped,
          errors: acc.errors + r.errors,
        }), {
          itemsProcessed: 0,
          filesDownloaded: 0,
          linksStored: 0,
          foldersSkipped: 0,
          deletedItems: 0,
          skipped: 0,
          errors: 0,
        });

        const duration = Date.now() - startTime;
        console.log(`[SharePoint-Sync v11] Fertig in ${duration}ms: ${totals.itemsProcessed} verarbeitet, ${totals.skipped} übersprungen, ${totals.filesDownloaded} Downloads`);

        return new Response(JSON.stringify({
          success: true,
          version: 'v11',
          duration_ms: duration,
          sites_synced: results.length,
          totals,
          details: results,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      case 'status': {
        const { data: states } = await supabase
          .from('sharepoint_sync_state')
          .select('*')
          .order('last_sync_at', { ascending: false });

        return new Response(JSON.stringify({
          success: true,
          sync_states: states || [],
          configured_sites: SYNC_SITES,
          excluded_sites: EXCLUDED_SITES,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      case 'reset': {
        // Delta-Links zurücksetzen für Full-Sync
        const sitesToReset = siteParam ? [siteParam] : SYNC_SITES;

        for (const site of sitesToReset) {
          const id = `sp-${site.replace(/[^a-zA-Z0-9-]/g, '-')}`;
          await supabase
            .from('sharepoint_sync_state')
            .update({ delta_link: null, updated_at: new Date().toISOString() })
            .eq('id', id);
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Delta-Links zurückgesetzt für ${sitesToReset.length} Sites`,
          sites: sitesToReset,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      default: {
        return new Response(JSON.stringify({
          name: 'sharepoint-sync',
          description: 'Synchronisiert SharePoint-Dateien nach Supabase Storage',
          actions: {
            'sync': 'Synchronisiert alle konfigurierten Sites (oder ?site=/sites/xxx für einzelne)',
            'status': 'Zeigt aktuellen Sync-Status',
            'reset': 'Setzt Delta-Links zurück (erzwingt Full-Sync)',
          },
          configured_sites: SYNC_SITES,
          excluded_sites: EXCLUDED_SITES,
          security_levels: SITE_SECURITY,
          file_types: {
            download: DOWNLOAD_EXTENSIONS,
            link_only: LINK_ONLY_EXTENSIONS,
          },
          max_file_size_mb: MAX_DOWNLOAD_SIZE / 1024 / 1024,
        }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }

  } catch (error) {
    console.error('SharePoint-Sync Fehler:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
