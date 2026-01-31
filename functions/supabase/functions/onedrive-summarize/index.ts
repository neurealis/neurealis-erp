import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { getValidAccessToken } from "../_shared/ms365-auth.ts";

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Batch-Größe (wegen Download-Limit)
const BATCH_SIZE = 10;

// Summary-Prompt für Copilot
const SUMMARY_PROMPT = "Fasse dieses Dokument in 2-3 Sätzen auf Deutsch zusammen. Nenne die wichtigsten Fakten (Beträge, Daten, Namen).";

interface OneDriveFile {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  mime_type: string | null;
  download_url: string | null;
  raw_text: string | null;
  document_class: string;
}

interface SummaryResult {
  id: string;
  name: string;
  status: 'success' | 'error' | 'skipped';
  summary?: string;
  error?: string;
}

/**
 * Holt eine frische Download-URL für eine Datei
 */
async function getFreshDownloadUrl(accessToken: string, driveItemId: string): Promise<string | null> {
  const response = await fetch(
    `${GRAPH_API_URL}/me/drive/items/${driveItemId}?$select=id,@microsoft.graph.downloadUrl`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`Fehler beim Abrufen der Download-URL für ${driveItemId}: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data['@microsoft.graph.downloadUrl'] || null;
}

/**
 * Lädt eine Datei herunter und gibt den Inhalt als ArrayBuffer zurück
 */
async function downloadFile(downloadUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen: ${response.status}`);
  }

  return await response.arrayBuffer();
}

/**
 * Extrahiert Text aus einem PDF mit unpdf (pdfjs)
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const { getResolvedPDFJS } = await import('npm:unpdf@0.12.1');
  const pdfjs = await getResolvedPDFJS();

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str || '')
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Extrahiert Text aus einer Textdatei (TXT, CSV, etc.)
 */
function extractTextFromTextFile(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(buffer);
}

/**
 * Extrahiert Text basierend auf MIME-Type
 */
async function extractText(buffer: ArrayBuffer, mimeType: string | null): Promise<string | null> {
  if (!mimeType) return null;

  try {
    // PDF
    if (mimeType === 'application/pdf') {
      return await extractTextFromPdf(buffer);
    }

    // Text-Dateien
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml') {
      return extractTextFromTextFile(buffer);
    }

    // Word-Dokumente (.docx) - vereinfachte Extraktion
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Für .docx bräuchten wir zusätzliche Bibliotheken
      // Vorerst überspringen
      return null;
    }

    // Unbekannter Typ
    return null;
  } catch (error) {
    console.error(`Fehler bei Text-Extraktion: ${error}`);
    return null;
  }
}

/**
 * Ruft Microsoft Copilot Chat API für die Zusammenfassung auf
 */
async function summarizeWithCopilot(text: string, copilotAccessToken: string): Promise<string> {
  // Text auf sinnvolle Länge kürzen
  const maxChars = 15000;
  const truncatedText = text.length > maxChars
    ? text.substring(0, maxChars) + '\n\n[... Text gekürzt ...]'
    : text;

  // 1. Conversation erstellen
  const convResponse = await fetch('https://graph.microsoft.com/beta/copilot/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${copilotAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!convResponse.ok) {
    const errorText = await convResponse.text();
    throw new Error(`Copilot Conversation erstellen fehlgeschlagen: ${convResponse.status} - ${errorText}`);
  }

  const convData = await convResponse.json();
  const conversationId = convData.id;

  if (!conversationId) {
    throw new Error('Keine Conversation ID in Copilot-Antwort gefunden');
  }

  // 2. Chat-Nachricht senden
  const chatResponse = await fetch(`https://graph.microsoft.com/beta/copilot/conversations/${conversationId}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${copilotAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: { text: `${SUMMARY_PROMPT}\n\n---\n\n${truncatedText}` },
      locationHint: { timeZone: 'Europe/Berlin' },
    }),
  });

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text();
    throw new Error(`Copilot Chat fehlgeschlagen: ${chatResponse.status} - ${errorText}`);
  }

  const chatData = await chatResponse.json();

  // Antwort extrahieren
  const summary = chatData.messages?.[0]?.text || '';

  if (!summary) {
    throw new Error('Keine Zusammenfassung in der Copilot-Antwort gefunden');
  }

  return summary;
}

/**
 * Verarbeitet eine einzelne Datei
 * @param file - Die zu verarbeitende Datei
 * @param accessToken - Delegierter User Token für OneDrive und Copilot API
 */
async function processFile(
  file: OneDriveFile,
  accessToken: string
): Promise<SummaryResult> {
  try {
    let text = file.raw_text;

    // Falls kein raw_text vorhanden, Datei herunterladen und Text extrahieren
    if (!text) {
      // Frische Download-URL holen (alte URLs laufen ab)
      const downloadUrl = await getFreshDownloadUrl(accessToken, file.drive_item_id);

      if (!downloadUrl) {
        return {
          id: file.id,
          name: file.name,
          status: 'error',
          error: 'Keine Download-URL verfügbar',
        };
      }

      // Datei herunterladen
      const buffer = await downloadFile(downloadUrl);

      // Text extrahieren
      text = await extractText(buffer, file.mime_type);

      if (!text || text.trim().length < 50) {
        return {
          id: file.id,
          name: file.name,
          status: 'skipped',
          error: 'Kein ausreichender Text extrahierbar',
        };
      }

      // raw_text speichern für spätere Verwendung
      await supabase
        .from('onedrive_files')
        .update({
          raw_text: text,
          is_extracted: true,
          extracted_at: new Date().toISOString(),
        })
        .eq('id', file.id);
    }

    // Zusammenfassung mit Copilot generieren
    try {
      const summary = await summarizeWithCopilot(text, accessToken);

      // Ergebnis speichern
      const { error: updateError } = await supabase
        .from('onedrive_files')
        .update({
          summary: summary,
          summarized_at: new Date().toISOString(),
        })
        .eq('id', file.id);

      if (updateError) {
        throw new Error(`DB Update fehlgeschlagen: ${updateError.message}`);
      }

      return {
        id: file.id,
        name: file.name,
        status: 'success',
        summary: summary.substring(0, 200) + (summary.length > 200 ? '...' : ''),
      };
    } catch (copilotError) {
      // Copilot-Fehler loggen aber Datei überspringen (nicht crashen)
      console.error(`Copilot Fehler bei ${file.name}:`, copilotError);
      return {
        id: file.id,
        name: file.name,
        status: 'error',
        error: `Copilot Fehler: ${String(copilotError)}`,
      };
    }

  } catch (error) {
    console.error(`Fehler bei ${file.name}:`, error);

    return {
      id: file.id,
      name: file.name,
      status: 'error',
      error: String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : BATCH_SIZE;
    const documentClass = url.searchParams.get('class'); // Optional: nur bestimmte Klasse

    // Dateien holen die klassifiziert aber noch keine Summary haben
    let query = supabase
      .from('onedrive_files')
      .select('id, drive_item_id, name, path, mime_type, download_url, raw_text, document_class')
      .not('document_class', 'is', null)  // Muss klassifiziert sein
      .is('summary', null)                 // Noch keine Summary
      .eq('is_folder', false)              // Nur Dateien
      .order('onedrive_modified_at', { ascending: false })
      .limit(limit);

    // Optional: nach Dokumentklasse filtern
    if (documentClass) {
      query = query.eq('document_class', documentClass);
    }

    const { data: files, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Fehler beim Abrufen der Dateien: ${fetchError.message}`);
    }

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Keine Dateien zur Verarbeitung gefunden',
        processed: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    console.log(`Verarbeite ${files.length} Dateien...`);

    // Access Token holen (Delegated Token für OneDrive und Copilot)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabase);
    } catch (tokenError) {
      console.error('Token Fehler:', tokenError);
      return new Response(JSON.stringify({
        success: false,
        error: `Token nicht verfügbar: ${String(tokenError)}`,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Dateien sequentiell verarbeiten (wegen Rate Limits)
    const results: SummaryResult[] = [];

    for (const file of files) {
      const result = await processFile(file as OneDriveFile, accessToken);
      results.push(result);

      // Kleine Pause zwischen Anfragen (Rate Limiting)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Statistiken
    const stats = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return new Response(JSON.stringify({
      success: true,
      stats,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('OneDrive Summarize Fehler:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
