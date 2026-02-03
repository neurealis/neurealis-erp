/**
 * search-lv - Semantische LV-Positions-Suche für CPQ-Wizard
 * v1 - Embedding-basierte Similarity-Suche mit Fallback auf ILIKE
 *
 * Nimmt eine Suchanfrage + LV-Typ und findet die ähnlichsten LV-Positionen
 * via Cosine-Similarity (pgvector) oder ILIKE-Fallback.
 *
 * Request Body:
 * {
 *   query: string,       // Suchtext
 *   lv_typ: string,      // LV-Typ Filter (z.B. 'gws', 'vbw', 'neurealis')
 *   limit?: number       // Max. Ergebnisse (default: 10)
 * }
 *
 * Response:
 * {
 *   positionen: [{
 *     id: string,
 *     artikelnummer: string,
 *     bezeichnung: string,
 *     einzelpreis: number,   // EK-Preis (preis Feld)
 *     listenpreis: number,   // VK-Preis
 *     lv_typ: string,
 *     similarity?: number
 *   }]
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS-Header für Cross-Origin Requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SearchRequest {
  query: string;
  lv_typ?: string | null;
  limit?: number;
}

interface LvPosition {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  einzelpreis: number | null;
  listenpreis: number | null;
  lv_typ: string;
  similarity?: number;
}

/**
 * Erstellt ein Embedding via OpenAI API
 */
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

/**
 * Fallback-Suche mit ILIKE wenn Embedding fehlschlägt
 */
async function searchWithILike(
  supabase: ReturnType<typeof createClient>,
  query: string,
  lvTyp: string | null,
  limit: number
): Promise<LvPosition[]> {
  console.log('Fallback: ILIKE-Suche für:', query);

  let dbQuery = supabase
    .from('lv_positionen')
    .select('id, artikelnummer, bezeichnung, preis, listenpreis, lv_typ')
    .eq('aktiv', true)
    .ilike('bezeichnung', `%${query}%`)
    .order('listenpreis', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (lvTyp) {
    dbQuery = dbQuery.eq('lv_typ', lvTyp);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error('ILIKE-Suche Fehler:', error);
    return [];
  }

  return (data || []).map((item) => ({
    id: item.id,
    artikelnummer: item.artikelnummer,
    bezeichnung: item.bezeichnung,
    einzelpreis: item.preis,
    listenpreis: item.listenpreis,
    lv_typ: item.lv_typ,
    similarity: 0.5 // Standardwert für ILIKE-Treffer
  }));
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Request-Body parsen
    const body: SearchRequest = await req.json();
    const { query, lv_typ, limit = 10 } = body;

    // Validierung
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Suchanfrage muss mindestens 2 Zeichen haben',
          positionen: []
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('search-lv: Suche gestartet', { query, lv_typ, limit });

    // Supabase Client initialisieren
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // OpenAI API Key prüfen
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    let positionen: LvPosition[] = [];

    if (openaiKey) {
      try {
        // Embedding für Suchanfrage erstellen
        const queryEmbedding = await createEmbedding(query, openaiKey);

        // Semantische Suche via search_lv_positions RPC
        const { data: results, error: searchError } = await supabase
          .rpc('search_lv_positions', {
            query_embedding: queryEmbedding,
            match_count: Math.min(limit, 100),
            filter_lv_typ: lv_typ || null,
            filter_gewerk: null // Kein Gewerk-Filter im CPQ
          });

        if (searchError) {
          console.error('RPC-Suche Fehler:', searchError);
          // Fallback auf ILIKE
          positionen = await searchWithILike(supabase, query, lv_typ, limit);
        } else {
          // Ergebnisse in erwartetes Format transformieren
          positionen = (results || []).map((item: {
            id: string;
            artikelnummer: string;
            bezeichnung: string;
            preis: number | null;
            listenpreis: number | null;
            lv_typ: string;
            similarity: number;
          }) => ({
            id: item.id,
            artikelnummer: item.artikelnummer,
            bezeichnung: item.bezeichnung,
            einzelpreis: item.preis,
            listenpreis: item.listenpreis,
            lv_typ: item.lv_typ,
            similarity: item.similarity
          }));
        }
      } catch (embeddingError) {
        console.error('Embedding-Fehler, Fallback auf ILIKE:', embeddingError);
        positionen = await searchWithILike(supabase, query, lv_typ, limit);
      }
    } else {
      // Kein OpenAI Key: Nur ILIKE-Suche
      console.warn('OpenAI API Key fehlt, nutze ILIKE-Suche');
      positionen = await searchWithILike(supabase, query, lv_typ, limit);
    }

    console.log(`search-lv: ${positionen.length} Ergebnisse gefunden`);

    return new Response(
      JSON.stringify({
        positionen,
        count: positionen.length,
        lv_typ: lv_typ || 'alle'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );

  } catch (error) {
    console.error('search-lv: Unerwarteter Fehler:', error);
    return new Response(
      JSON.stringify({
        error: `Interner Fehler: ${(error as Error).message}`,
        positionen: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
