/**
 * search-lv - Semantische Suche in LV-Positionen via pgvector
 * v1 - Embedding-basierte Similarity-Suche
 *
 * Nimmt eine Suchanfrage, generiert ein Embedding und findet die
 * aehnlichsten LV-Positionen via Cosine-Similarity.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  lv_typ?: string | null;
  gewerk?: string | null;
  limit?: number;
}

interface SearchResult {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  beschreibung: string | null;
  lv_typ: string;
  gewerk: string | null;
  einheit: string | null;
  preis: number | null;
  listenpreis: number | null;
  similarity: number;
}

// Embedding erstellen via OpenAI
async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const cleanText = text?.trim() || 'unbekannt';

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: cleanText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI Embedding Fehler:', response.status, errorText);
    throw new Error(`Embedding-Erstellung fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const { query, lv_typ, gewerk, limit = 30 } = body;

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Suchanfrage muss mindestens 2 Zeichen haben', results: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Semantische Suche:', { query, lv_typ, gewerk, limit });

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // OpenAI API Key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API Key nicht konfiguriert', results: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Embedding fuer Suchanfrage erstellen
    const queryEmbedding = await createEmbedding(query, openaiKey);

    // Semantische Suche via SQL-Funktion
    const { data: results, error: searchError } = await supabase
      .rpc('search_lv_positions', {
        query_embedding: queryEmbedding,
        match_count: Math.min(limit, 100),
        filter_lv_typ: lv_typ || null,
        filter_gewerk: gewerk || null
      });

    if (searchError) {
      console.error('Suche fehlgeschlagen:', searchError);
      return new Response(
        JSON.stringify({ error: 'Datenbankfehler: ' + searchError.message, results: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${results?.length || 0} Ergebnisse gefunden`);

    return new Response(
      JSON.stringify({
        query,
        results: results || [],
        count: results?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );

  } catch (error) {
    console.error('Unerwarteter Fehler:', error);
    return new Response(
      JSON.stringify({ error: `Interner Fehler: ${error.message}`, results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
