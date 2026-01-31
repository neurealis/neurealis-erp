/**
 * lv-embed-regenerate v1 - Regeneriert LV-Embeddings mit kombiniertem Text
 *
 * Kombiniert: bezeichnung + ' - ' + strip_html(beschreibung)
 * Generiert neue Embeddings mit text-embedding-3-small
 * Speichert kombinierten Text in embedding_text zur Nachvollziehbarkeit
 *
 * Parameter:
 * - lv_typ: Optional, nur bestimmter LV-Typ (z.B. 'GWS', 'VBW')
 * - batch_size: Anzahl pro Batch (default: 100)
 * - force: Auch wenn embedding_text bereits gesetzt (default: false)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegenerateRequest {
  lv_typ?: string;
  batch_size?: number;
  force?: boolean;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// HTML-Tags entfernen (Client-Side, da wir die SQL-Funktion nicht direkt aufrufen können)
function stripHtml(text: string | null): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Kombinierten Embedding-Text generieren
function generateEmbeddingText(bezeichnung: string, beschreibung: string | null): string {
  const cleanBeschreibung = stripHtml(beschreibung);
  if (cleanBeschreibung) {
    return `${bezeichnung} - ${cleanBeschreibung}`.trim();
  }
  return bezeichnung.trim();
}

// Embeddings via OpenAI erstellen (Batch-Verarbeitung)
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const cleanTexts = texts.map(t => t?.trim() || 'unbekannt');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: cleanTexts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI Embedding Fehler:', response.status, errorText);
    throw new Error(`Embedding-Erstellung fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RegenerateRequest = req.method === 'POST' ? await req.json() : {};
    const { lv_typ, batch_size = 100, force = false } = body;

    console.log('[lv-embed-regenerate] Start:', { lv_typ, batch_size, force });

    // Positionen laden die regeneriert werden sollen
    let query = supabase
      .from('lv_positionen')
      .select('id, artikelnummer, bezeichnung, beschreibung, lv_typ, embedding_text')
      .eq('aktiv', true);

    if (lv_typ) {
      query = query.eq('lv_typ', lv_typ);
    }

    if (!force) {
      // Nur Positionen ohne embedding_text oder mit leerem embedding_text
      query = query.or('embedding_text.is.null,embedding_text.eq.');
    }

    query = query.order('artikelnummer').limit(batch_size);

    const { data: positionen, error: fetchError } = await query;

    if (fetchError) {
      console.error('Fehler beim Laden:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!positionen || positionen.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Keine Positionen zum Regenerieren gefunden',
          processed: 0,
          remaining: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[lv-embed-regenerate] ${positionen.length} Positionen zu verarbeiten`);

    // Kombinierte Texte generieren
    const embeddingTexts = positionen.map(p => generateEmbeddingText(p.bezeichnung, p.beschreibung));

    // Embeddings in Batches von max. 20 generieren (OpenAI Limit)
    const OPENAI_BATCH_SIZE = 20;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < embeddingTexts.length; i += OPENAI_BATCH_SIZE) {
      const batchTexts = embeddingTexts.slice(i, i + OPENAI_BATCH_SIZE);
      console.log(`[lv-embed-regenerate] OpenAI Batch ${Math.floor(i / OPENAI_BATCH_SIZE) + 1}: ${batchTexts.length} Texte`);
      const batchEmbeddings = await createEmbeddings(batchTexts);
      allEmbeddings.push(...batchEmbeddings);
    }

    // Updates durchführen
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < positionen.length; i++) {
      const pos = positionen[i];
      const embeddingText = embeddingTexts[i];
      const embedding = allEmbeddings[i];

      const { error: updateError } = await supabase
        .from('lv_positionen')
        .update({
          embedding: embedding,
          embedding_text: embeddingText,
          updated_at: new Date().toISOString()
        })
        .eq('id', pos.id);

      if (updateError) {
        console.error(`Update-Fehler für ${pos.artikelnummer}:`, updateError);
        errors++;
      } else {
        updated++;
      }
    }

    // Zähle verbleibende Positionen
    let remainingQuery = supabase
      .from('lv_positionen')
      .select('id', { count: 'exact', head: true })
      .eq('aktiv', true);

    if (lv_typ) {
      remainingQuery = remainingQuery.eq('lv_typ', lv_typ);
    }

    if (!force) {
      remainingQuery = remainingQuery.or('embedding_text.is.null,embedding_text.eq.');
    }

    const { count: remaining } = await remainingQuery;

    console.log(`[lv-embed-regenerate] Fertig: ${updated} aktualisiert, ${errors} Fehler, ${remaining || 0} verbleibend`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: positionen.length,
        updated,
        errors,
        remaining: remaining || 0,
        lv_typ: lv_typ || 'alle',
        message: remaining && remaining > 0
          ? `${updated} Positionen aktualisiert, ${remaining} verbleibend. Erneut aufrufen für weitere.`
          : `Alle ${updated} Positionen erfolgreich aktualisiert.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lv-embed-regenerate] Fehler:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
