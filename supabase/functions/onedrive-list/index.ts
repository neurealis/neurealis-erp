import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { getValidAccessToken } from "../_shared/ms365-auth.ts";

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ordner die katalogisiert werden sollen (leer = alles)
const TARGET_FOLDERS = [
  '/neurealis',  // Hauptordner für Unternehmensdaten
];

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  parentReference?: {
    driveId: string;
    id: string;
    path: string;
  };
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  '@microsoft.graph.downloadUrl'?: string;
}

interface ListResult {
  folders_found: number;
  files_found: number;
  created: number;
  updated: number;
  errors: number;
}

async function listFolder(
  accessToken: string,
  folderPath: string,
  result: ListResult
): Promise<DriveItem[]> {
  const allItems: DriveItem[] = [];

  // Encode path für Graph API
  const encodedPath = folderPath === '/'
    ? 'root'
    : `root:${folderPath}:`;

  // Nutze /me/drive für Delegated Token
  let nextLink: string | null = `${GRAPH_API_URL}/me/drive/${encodedPath}/children?$top=200&$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,parentReference,folder,file`;

  while (nextLink) {
    const response = await fetch(nextLink, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Ordner nicht gefunden: ${folderPath}`);
        return [];
      }
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    allItems.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return allItems;
}

async function getItemWithDownloadUrl(accessToken: string, itemId: string): Promise<DriveItem | null> {
  const response = await fetch(
    `${GRAPH_API_URL}/me/drive/items/${itemId}?$select=id,name,@microsoft.graph.downloadUrl`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;
  return await response.json();
}

function extractPath(item: DriveItem): string {
  if (!item.parentReference?.path) return `/${item.name}`;

  // parentReference.path ist z.B. "/drive/root:/neurealis/Projekte"
  const parentPath = item.parentReference.path.replace(/^\/drive\/root:?/, '') || '/';
  return parentPath === '/' ? `/${item.name}` : `${parentPath}/${item.name}`;
}

function extractParentPath(item: DriveItem): string {
  if (!item.parentReference?.path) return '/';
  return item.parentReference.path.replace(/^\/drive\/root:?/, '') || '/';
}

async function processItem(
  item: DriveItem,
  result: ListResult
): Promise<void> {
  const isFolder = !!item.folder;
  const path = extractPath(item);
  const parentPath = extractParentPath(item);

  // Check ob Scanner-Inbox
  const isInbox = path.toLowerCase().includes('scanner') ||
                  path.toLowerCase().includes('eingang') ||
                  path.toLowerCase().includes('inbox');

  const record = {
    drive_item_id: item.id,
    drive_id: item.parentReference?.driveId,
    name: item.name,
    path: path,
    parent_path: parentPath,
    parent_id: item.parentReference?.id,
    is_folder: isFolder,
    mime_type: item.file?.mimeType || null,
    size_bytes: item.size || null,
    onedrive_created_at: item.createdDateTime,
    onedrive_modified_at: item.lastModifiedDateTime,
    web_url: item.webUrl,
    download_url: item['@microsoft.graph.downloadUrl'] || null,
    is_inbox: isInbox,
    updated_at: new Date().toISOString(),
  };

  if (isFolder) {
    result.folders_found++;
  } else {
    result.files_found++;
  }

  // Upsert in Supabase
  const { data: existing } = await supabase
    .from('onedrive_files')
    .select('id, onedrive_modified_at')
    .eq('drive_item_id', item.id)
    .single();

  if (existing) {
    // Update nur wenn OneDrive-Daten neuer
    const existingModified = existing.onedrive_modified_at ? new Date(existing.onedrive_modified_at) : new Date(0);
    const itemModified = new Date(item.lastModifiedDateTime);

    if (itemModified > existingModified) {
      const { error } = await supabase
        .from('onedrive_files')
        .update(record)
        .eq('id', existing.id);

      if (error) {
        console.error(`Update error for ${path}:`, error);
        result.errors++;
      } else {
        result.updated++;
      }
    }
  } else {
    const { error } = await supabase
      .from('onedrive_files')
      .insert({
        ...record,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Insert error for ${path}:`, error);
      result.errors++;
    } else {
      result.created++;
    }
  }
}

async function processFolder(
  accessToken: string,
  folderPath: string,
  result: ListResult,
  depth: number = 0,
  maxDepth: number = 10
): Promise<void> {
  if (depth > maxDepth) {
    console.log(`Max depth reached at: ${folderPath}`);
    return;
  }

  console.log(`Scanning: ${folderPath} (depth: ${depth})`);

  const items = await listFolder(accessToken, folderPath, result);

  for (const item of items) {
    await processItem(item, result);

    // Rekursiv in Unterordner
    if (item.folder) {
      const subPath = extractPath(item);
      await processFolder(accessToken, subPath, result, depth + 1, maxDepth);
    }
  }
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const folderParam = url.searchParams.get('folder');
    const maxDepthParam = url.searchParams.get('max_depth');
    const maxDepth = maxDepthParam ? parseInt(maxDepthParam) : 10;

    // Access Token holen (Delegated Token aus ms365_tokens)
    const accessToken = await getValidAccessToken(supabase);

    const result: ListResult = {
      folders_found: 0,
      files_found: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };

    if (folderParam) {
      // Nur einen Ordner scannen
      await processFolder(accessToken, folderParam, result, 0, maxDepth);
    } else if (TARGET_FOLDERS.length > 0) {
      // Konfigurierte Ordner scannen
      for (const folder of TARGET_FOLDERS) {
        await processFolder(accessToken, folder, result, 0, maxDepth);
      }
    } else {
      // Alles scannen (Root)
      await processFolder(accessToken, '/', result, 0, maxDepth);
    }

    return new Response(JSON.stringify({
      success: true,
      scanned_folders: folderParam ? [folderParam] : TARGET_FOLDERS,
      max_depth: maxDepth,
      result: {
        folders: result.folders_found,
        files: result.files_found,
        total: result.folders_found + result.files_found,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('OneDrive list error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
