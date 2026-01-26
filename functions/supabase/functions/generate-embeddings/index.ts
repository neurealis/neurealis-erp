/**
 * generate-embeddings - Batch-Generierung von Embeddings für bestellartikel
 * v2 - JWT deaktiviert für einmalige Batch-Jobs
 *
 * Generiert Embeddings für bezeichnung und kurzbezeichnung via OpenAI API.
 * Unterstützt Batch-Verarbeitung für bis zu 2048 Texte gleichzeitig.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbeddingResult {
  total: number;
  processed: number;
  errors: string[];
}

// Batch-Embeddings erstellen via OpenAI (bis zu 2048 Texte)
async function createBatchEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  // Leere Texte durch Placeholder ersetzen
  const cleanTexts = texts.map(t => t?.trim() || 'unbekannt');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  // Sortiere nach Index um Reihenfolge sicherzustellen
  const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
  return sorted.map((item: any) => item.embedding);
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { dry_run = false, limit = 500 } = await req.json().catch(() => ({}));

    console.log('Starte Embedding-Generierung, dry_run:', dry_run, 'limit:', limit);

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // OpenAI API Key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API Key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Artikel ohne Embeddings holen
    const { data: artikel, error: fetchError } = await supabase
      .from('bestellartikel')
      .select('id, bezeichnung, kurzbezeichnung')
      .or('embedding.is.null,embedding_kurz.is.null')
      .limit(limit);

    if (fetchError) {
      console.error('DB Fehler:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Datenbankfehler: ' + fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!artikel || artikel.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Alle Artikel haben bereits Embeddings', total: 0, processed: 0, errors: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${artikel.length} Artikel ohne Embeddings gefunden`);

    if (dry_run) {
      return new Response(
        JSON.stringify({
          message: 'Dry run - keine Änderungen',
          total: artikel.length,
          sample: artikel.slice(0, 5).map(a => ({ id: a.id, bezeichnung: a.bezeichnung }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: EmbeddingResult = { total: artikel.length, processed: 0, errors: [] };

    // Batch-Verarbeitung in Chunks von 100 (um API-Limits zu respektieren)
    const BATCH_SIZE = 100;

    for (let i = 0; i < artikel.length; i += BATCH_SIZE) {
      const batch = artikel.slice(i, i + BATCH_SIZE);
      console.log(`Verarbeite Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(artikel.length/BATCH_SIZE)}`);

      try {
        // Texte für Embeddings vorbereiten
        const bezeichnungen = batch.map(a => a.bezeichnung || 'unbekannt');
        const kurzbezeichnungen = batch.map(a => a.kurzbezeichnung || a.bezeichnung || 'unbekannt');

        // Alle Texte in einem API-Call (beide Arrays zusammen)
        const allTexts = [...bezeichnungen, ...kurzbezeichnungen];
        const allEmbeddings = await createBatchEmbeddings(allTexts, openaiKey);

        // Embeddings aufteilen
        const bezeichnungEmbeddings = allEmbeddings.slice(0, batch.length);
        const kurzEmbeddings = allEmbeddings.slice(batch.length);

        // In DB speichern
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('bestellartikel')
            .update({
              embedding: bezeichnungEmbeddings[j],
              embedding_kurz: kurzEmbeddings[j],
              updated_at: new Date().toISOString()
            })
            .eq('id', batch[j].id);

          if (updateError) {
            result.errors.push(`${batch[j].id}: ${updateError.message}`);
          } else {
            result.processed++;
          }
        }

        // Kurze Pause zwischen Batches
        if (i + BATCH_SIZE < artikel.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (batchError) {
        console.error('Batch-Fehler:', batchError);
        result.errors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchError.message}`);
      }
    }

    console.log(`Fertig: ${result.processed}/${result.total} verarbeitet, ${result.errors.length} Fehler`);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );

  } catch (error) {
    console.error('Unerwarteter Fehler:', error);
    return new Response(
      JSON.stringify({ error: `Interner Fehler: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
