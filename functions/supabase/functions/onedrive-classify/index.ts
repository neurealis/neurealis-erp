import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { getValidAccessToken } from "../_shared/ms365-auth.ts";

// Microsoft Graph API
const GRAPH_BETA_URL = 'https://graph.microsoft.com/beta';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Batch-Size für Klassifizierung
const BATCH_SIZE = 20;

// Dokumentklassen
const DOCUMENT_CLASSES = [
  'Eingangsrechnung',
  'Ausgangsrechnung',
  'Lieferschein',
  'Vertrag',
  'Protokoll',
  'Angebot',
  'Auftragsbestätigung',
  'Mahnung',
  'Sonstiges',
] as const;

type DocumentClass = typeof DOCUMENT_CLASSES[number];

interface OneDriveFile {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  mime_type: string | null;
  raw_text: string | null;
}

interface ClassificationResult {
  id: string;
  document_class: DocumentClass;
  confidence: number;
  error?: string;
}

async function getUnclassifiedFiles(limit: number): Promise<OneDriveFile[]> {
  const { data, error } = await supabase
    .from('onedrive_files')
    .select('id, drive_item_id, name, path, mime_type, raw_text')
    .is('document_class', null)
    .eq('is_folder', false)
    .order('onedrive_modified_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`DB query error: ${error.message}`);
  }

  return data || [];
}

function buildClassificationPrompt(file: OneDriveFile): string {
  const validClasses = DOCUMENT_CLASSES.join(', ');

  let context = `Dateiname: ${file.name}\nPfad: ${file.path}`;

  if (file.raw_text) {
    // Ersten 2000 Zeichen des Textes nutzen
    const textPreview = file.raw_text.substring(0, 2000);
    context += `\n\nTextinhalt (Auszug):\n${textPreview}`;
  }

  return `Klassifiziere das folgende Dokument in GENAU EINE der folgenden Kategorien:
${validClasses}

${context}

Antworte NUR mit einem JSON-Objekt in diesem Format:
{"class": "KATEGORIE", "confidence": 0.XX}

Wobei KATEGORIE eine der obigen Kategorien sein muss und confidence ein Wert zwischen 0 und 1 ist.
Bei Unsicherheit wähle "Sonstiges" mit niedriger Konfidenz.`;
}

/**
 * Klassifiziert ein Dokument mit Microsoft Copilot Chat API.
 * Nutzt Delegated Permissions über den gespeicherten Refresh Token.
 */
async function classifyWithCopilot(file: OneDriveFile, accessToken: string): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(file);

  try {
    // 1. Conversation erstellen
    const convResponse = await fetch(`${GRAPH_BETA_URL}/copilot/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!convResponse.ok) {
      const errorText = await convResponse.text();
      throw new Error(`Copilot conversation error: ${convResponse.status} - ${errorText}`);
    }

    const convData = await convResponse.json();
    const conversationId = convData.id;

    if (!conversationId) {
      throw new Error('Keine conversationId erhalten');
    }

    // 2. Chat-Nachricht senden
    const chatResponse = await fetch(`${GRAPH_BETA_URL}/copilot/conversations/${conversationId}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { text: prompt },
        locationHint: { timeZone: 'Europe/Berlin' },
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Copilot chat error: ${chatResponse.status} - ${errorText}`);
    }

    const data = await chatResponse.json();
    const content = data.messages?.[0]?.text || '';

    // JSON aus der Antwort extrahieren
    const jsonMatch = content.match(/\{[\s\S]*?"class"[\s\S]*?"confidence"[\s\S]*?\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const documentClass = parsed.class as DocumentClass;
      const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.5));

      // Validieren dass die Klasse gültig ist
      if (DOCUMENT_CLASSES.includes(documentClass)) {
        return {
          id: file.id,
          document_class: documentClass,
          confidence,
        };
      }
    }

    // Fallback wenn Parsing fehlschlägt
    console.log(`Copilot JSON parsing failed for ${file.name}, using fallback`);
    return classifyByFileName(file);

  } catch (err) {
    console.error(`Copilot classification error for ${file.name}:`, err);

    // Bei Fehler Fallback nutzen
    const fallback = classifyByFileName(file);
    fallback.error = String(err);
    return fallback;
  }
}

function classifyByFileName(file: OneDriveFile): ClassificationResult {
  const nameLower = file.name.toLowerCase();
  const pathLower = file.path.toLowerCase();

  // Muster für verschiedene Dokumenttypen
  const patterns: Array<{ pattern: RegExp; class: DocumentClass; confidence: number }> = [
    // Eingangsrechnung
    { pattern: /eingangsrechnung|er[-_]?\d|lieferantenrechnung|vendor[-_]?invoice/i, class: 'Eingangsrechnung', confidence: 0.8 },
    { pattern: /rechnungen[-_]?eingang|creditor/i, class: 'Eingangsrechnung', confidence: 0.7 },

    // Ausgangsrechnung
    { pattern: /ausgangsrechnung|ar[-_]?\d|kundenrechnung|customer[-_]?invoice/i, class: 'Ausgangsrechnung', confidence: 0.8 },
    { pattern: /rechnungen[-_]?ausgang|debitor|schlussrechnung|abschlagsrechnung/i, class: 'Ausgangsrechnung', confidence: 0.7 },
    { pattern: /rechnung[-_]?\d+.*\.pdf$/i, class: 'Ausgangsrechnung', confidence: 0.6 },

    // Lieferschein
    { pattern: /lieferschein|delivery[-_]?note|ls[-_]?\d/i, class: 'Lieferschein', confidence: 0.85 },
    { pattern: /wareneingang|ware.*eingang/i, class: 'Lieferschein', confidence: 0.7 },

    // Vertrag
    { pattern: /vertrag|contract|vereinbarung|agreement/i, class: 'Vertrag', confidence: 0.85 },
    { pattern: /rahmenvertrag|werkvertrag|dienstleistungsvertrag/i, class: 'Vertrag', confidence: 0.9 },

    // Protokoll
    { pattern: /protokoll|minutes|meeting[-_]?notes/i, class: 'Protokoll', confidence: 0.85 },
    { pattern: /besprechung|sitzung|abnahme[-_]?protokoll/i, class: 'Protokoll', confidence: 0.8 },

    // Angebot
    { pattern: /angebot|quote|quotation|offer/i, class: 'Angebot', confidence: 0.85 },
    { pattern: /ang[-_]?\d|kostenvoranschlag/i, class: 'Angebot', confidence: 0.8 },

    // Auftragsbestätigung
    { pattern: /auftragsbestätigung|auftragsbest|order[-_]?confirm|ab[-_]?\d/i, class: 'Auftragsbestätigung', confidence: 0.85 },
    { pattern: /bestellung|purchase[-_]?order/i, class: 'Auftragsbestätigung', confidence: 0.7 },

    // Mahnung
    { pattern: /mahnung|mahnschreiben|reminder|dunning/i, class: 'Mahnung', confidence: 0.9 },
    { pattern: /zahlungserinnerung|payment[-_]?reminder/i, class: 'Mahnung', confidence: 0.85 },
  ];

  // Kombinierte Suche in Dateiname und Pfad
  const combinedText = `${nameLower} ${pathLower}`;

  for (const { pattern, class: docClass, confidence } of patterns) {
    if (pattern.test(combinedText)) {
      return {
        id: file.id,
        document_class: docClass,
        confidence,
      };
    }
  }

  // Wenn der Textinhalt vorhanden ist, versuche dort zu klassifizieren
  if (file.raw_text) {
    const textLower = file.raw_text.toLowerCase();

    // Typische Schlüsselwörter im Text
    const textPatterns: Array<{ pattern: RegExp; class: DocumentClass; confidence: number }> = [
      { pattern: /gesamtbetrag.*€|summe.*eur|rechnung.*nr|invoice.*number/i, class: 'Ausgangsrechnung', confidence: 0.6 },
      { pattern: /wir bieten ihnen.*€|angebotspreis|gültig bis/i, class: 'Angebot', confidence: 0.6 },
      { pattern: /hiermit bestätigen wir.*auftrag|ihre bestellung/i, class: 'Auftragsbestätigung', confidence: 0.6 },
      { pattern: /lieferung.*erfolgt|warensendung|paketinhalt/i, class: 'Lieferschein', confidence: 0.6 },
      { pattern: /vertragsgegenstand|vertragspartner|unterschrift.*parteien/i, class: 'Vertrag', confidence: 0.6 },
      { pattern: /teilnehmer.*besprechung|tagesordnung|top \d/i, class: 'Protokoll', confidence: 0.6 },
      { pattern: /zahlungsverzug|mahngebühr|letzte mahnung/i, class: 'Mahnung', confidence: 0.7 },
    ];

    for (const { pattern, class: docClass, confidence } of textPatterns) {
      if (pattern.test(textLower)) {
        return {
          id: file.id,
          document_class: docClass,
          confidence,
        };
      }
    }
  }

  // Fallback: Sonstiges
  return {
    id: file.id,
    document_class: 'Sonstiges',
    confidence: 0.3,
  };
}

async function saveClassificationResult(result: ClassificationResult): Promise<void> {
  const updateData: Record<string, unknown> = {
    document_class: result.document_class,
    classification_confidence: result.confidence,
    classified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (result.error) {
    updateData.extraction_error = result.error;
  }

  const { error } = await supabase
    .from('onedrive_files')
    .update(updateData)
    .eq('id', result.id);

  if (error) {
    console.error(`Save error for ${result.id}:`, error);
    throw error;
  }
}

async function markAsError(fileId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('onedrive_files')
    .update({
      extraction_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam), 100) : BATCH_SIZE;
    const useFallbackOnly = url.searchParams.get('fallback') === 'true';

    // Unklassifizierte Dateien holen
    const files = await getUnclassifiedFiles(limit);

    if (files.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Keine unklassifizierten Dateien gefunden',
        processed: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    console.log(`Klassifiziere ${files.length} Dateien...`);

    // Access Token nur holen wenn Copilot genutzt werden soll
    let accessToken: string | null = null;
    if (!useFallbackOnly) {
      try {
        accessToken = await getValidAccessToken(supabase);
        console.log('Copilot Access Token erfolgreich geholt');
      } catch (err) {
        console.log('Token-Fehler, nutze Fallback:', err);
      }
    }

    const results = {
      processed: 0,
      classified: 0,
      errors: 0,
      byClass: {} as Record<string, number>,
    };

    for (const file of files) {
      try {
        let result: ClassificationResult;

        if (!useFallbackOnly && accessToken) {
          result = await classifyWithCopilot(file, accessToken);
        } else {
          result = classifyByFileName(file);
        }

        await saveClassificationResult(result);

        results.processed++;
        results.classified++;
        results.byClass[result.document_class] = (results.byClass[result.document_class] || 0) + 1;

        console.log(`✓ ${file.name} → ${result.document_class} (${(result.confidence * 100).toFixed(0)}%)`);

      } catch (err) {
        console.error(`✗ Fehler bei ${file.name}:`, err);
        await markAsError(file.id, String(err));
        results.processed++;
        results.errors++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      mode: accessToken ? 'copilot' : 'fallback',
      processed: results.processed,
      classified: results.classified,
      errors: results.errors,
      by_class: results.byClass,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Classification error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
