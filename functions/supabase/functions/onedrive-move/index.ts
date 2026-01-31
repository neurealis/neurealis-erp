import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { getValidAccessToken } from "../_shared/ms365-auth.ts";

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Zielordner-Mapping basierend auf document_class
const FOLDER_MAPPING: Record<string, string> = {
  'Eingangsrechnung': '/neurealis/Buchhaltung/Eingangsrechnungen',
  'Ausgangsrechnung': '/neurealis/Buchhaltung/Ausgangsrechnungen',
  'Vertrag': '/neurealis/Verträge',
  'Protokoll': '/neurealis/Protokolle',
  'Angebot': '/neurealis/Angebote',
  'Auftragsbestätigung': '/neurealis/Aufträge',
  'Sonstiges': '/neurealis/Sonstiges',
};

interface OneDriveFile {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  document_class: string;
  onedrive_created_at: string | null;
}

interface MoveResult {
  total_pending: number;
  moved: number;
  errors: number;
  details: Array<{
    name: string;
    from: string;
    to: string;
    status: 'moved' | 'error';
    error?: string;
  }>;
}

/**
 * Ermittelt das Jahr aus dem Erstellungsdatum der Datei
 */
function getYearFromDate(dateString: string | null): string {
  if (!dateString) {
    return new Date().getFullYear().toString();
  }
  const date = new Date(dateString);
  return date.getFullYear().toString();
}

/**
 * Ermittelt den Zielordner basierend auf document_class
 */
function getTargetFolder(documentClass: string, year: string): string {
  const baseFolder = FOLDER_MAPPING[documentClass] || FOLDER_MAPPING['Sonstiges'];

  // Rechnungen bekommen Jahres-Unterordner
  if (documentClass === 'Eingangsrechnung' || documentClass === 'Ausgangsrechnung') {
    return `${baseFolder}/${year}`;
  }

  return baseFolder;
}

/**
 * Stellt sicher, dass der Zielordner existiert (erstellt ihn rekursiv falls nötig)
 */
async function ensureFolderExists(
  accessToken: string,
  folderPath: string
): Promise<boolean> {
  const parts = folderPath.split('/').filter(p => p);
  let currentPath = '';

  for (const part of parts) {
    const parentPath = currentPath || 'root';
    currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

    // Prüfen ob Ordner existiert
    const checkUrl = `${GRAPH_API_URL}/me/drive/root:${currentPath}`;
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (checkResponse.status === 404) {
      // Ordner erstellen
      const parentRef = parentPath === 'root'
        ? `${GRAPH_API_URL}/me/drive/root/children`
        : `${GRAPH_API_URL}/me/drive/root:${currentPath.substring(0, currentPath.lastIndexOf('/'))}:/children`;

      const createResponse = await fetch(parentRef, {
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
        // 409 = Ordner existiert schon (Race Condition), das ist OK
        console.error(`Fehler beim Erstellen von ${currentPath}:`, await createResponse.text());
        return false;
      }

      console.log(`Ordner erstellt: ${currentPath}`);
    }
  }

  return true;
}

/**
 * Verschiebt eine Datei in OneDrive
 */
async function moveFile(
  accessToken: string,
  itemId: string,
  targetFolderPath: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  // Zielordner sicherstellen
  const folderExists = await ensureFolderExists(accessToken, targetFolderPath);
  if (!folderExists) {
    return { success: false, error: `Konnte Zielordner nicht erstellen: ${targetFolderPath}` };
  }

  // Datei verschieben via PATCH
  const moveUrl = `${GRAPH_API_URL}/me/drive/items/${itemId}`;

  const response = await fetch(moveUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parentReference: {
        path: `/drive/root:${targetFolderPath}`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Graph API error: ${response.status} - ${errorText}` };
  }

  const data = await response.json();

  // Neuen Pfad aus Response extrahieren
  const newPath = data.parentReference?.path
    ? `${data.parentReference.path.replace(/^\/drive\/root:?/, '')}/${data.name}`
    : `${targetFolderPath}/${data.name}`;

  return { success: true, newPath };
}

/**
 * Holt alle Dateien die verschoben werden müssen
 */
async function getPendingFiles(): Promise<OneDriveFile[]> {
  const { data, error } = await supabase
    .from('onedrive_files')
    .select('id, drive_item_id, name, path, document_class, onedrive_created_at')
    .eq('is_inbox', true)
    .eq('is_folder', false)
    .not('document_class', 'is', null)
    .is('processed_at', null)
    .order('onedrive_created_at', { ascending: true })
    .limit(50); // Batch-Größe begrenzen

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return data || [];
}

/**
 * Aktualisiert die Datei in Supabase nach dem Verschieben
 */
async function updateFileRecord(
  fileId: string,
  movedToPath: string,
  newParentPath: string
): Promise<void> {
  const { error } = await supabase
    .from('onedrive_files')
    .update({
      processed_at: new Date().toISOString(),
      moved_to_path: movedToPath,
      path: movedToPath,
      parent_path: newParentPath,
      is_inbox: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // Access Token holen (Delegated Token)
    const accessToken = await getValidAccessToken(supabase);

    // Dateien zum Verschieben holen
    const pendingFiles = await getPendingFiles();
    const filesToProcess = pendingFiles.slice(0, limit);

    const result: MoveResult = {
      total_pending: pendingFiles.length,
      moved: 0,
      errors: 0,
      details: [],
    };

    for (const file of filesToProcess) {
      const year = getYearFromDate(file.onedrive_created_at);
      const targetFolder = getTargetFolder(file.document_class, year);
      const targetPath = `${targetFolder}/${file.name}`;

      if (dryRun) {
        // Im Dry-Run nur loggen, nicht verschieben
        result.details.push({
          name: file.name,
          from: file.path,
          to: targetPath,
          status: 'moved',
        });
        result.moved++;
        continue;
      }

      try {
        const moveResult = await moveFile(accessToken, file.drive_item_id, targetFolder);

        if (moveResult.success) {
          await updateFileRecord(file.id, moveResult.newPath!, targetFolder);

          result.details.push({
            name: file.name,
            from: file.path,
            to: moveResult.newPath!,
            status: 'moved',
          });
          result.moved++;

          console.log(`Verschoben: ${file.name} → ${moveResult.newPath}`);
        } else {
          result.details.push({
            name: file.name,
            from: file.path,
            to: targetPath,
            status: 'error',
            error: moveResult.error,
          });
          result.errors++;

          console.error(`Fehler bei ${file.name}: ${moveResult.error}`);
        }
      } catch (err) {
        result.details.push({
          name: file.name,
          from: file.path,
          to: targetPath,
          status: 'error',
          error: String(err),
        });
        result.errors++;

        console.error(`Exception bei ${file.name}:`, err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      result,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('OneDrive move error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
