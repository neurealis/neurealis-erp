/**
 * parse-bestellung - Mehrsprachiges KI-Parsing für Bestellungen
 * v9 - Fix: max_completion_tokens statt max_tokens für gpt-5.2
 *
 * Parst Freitext-Eingaben (DE, HU, RU, RO) und extrahiert Artikel + Mengen.
 * Nutzt OpenAI gpt-5.2 für die Erkennung und Embedding-Suche für Artikelabgleich.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedItem {
  bezeichnung: string;
  menge: number;
  einheit: string;
  confidence: number;
  originalText: string;
  artikel_id?: string;
  artikelnummer?: string;
  einzelpreis?: number;
}

interface ParseResult {
  success: boolean;
  items: ParsedItem[];
  unerkannt: string[];
  grosshaendler_vorschlag?: string;
  error?: string;
}

// Embedding erstellen via OpenAI
async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Embedding API Fehler:', response.status, errorText);
    throw new Error(`Embedding-Erstellung fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Artikelsuche via Embedding
async function findArtikelByEmbedding(
  supabase: any,
  searchText: string,
  embedding: number[],
  grosshaendlerId?: string
): Promise<any | null> {
  // Zuerst: Exakte Suche nach Artikelnummer oder Bezeichnung
  let query = supabase
    .from('bestellartikel')
    .select('id, artikelnummer, bezeichnung, einheit, einkaufspreis, grosshaendler_id')
    .eq('ist_aktiv', true)
    .or(`artikelnummer.ilike.%${searchText}%,bezeichnung.ilike.%${searchText}%`)
    .limit(1);

  if (grosshaendlerId) {
    query = query.eq('grosshaendler_id', grosshaendlerId);
  }

  const { data: exactMatch } = await query;

  if (exactMatch && exactMatch.length > 0) {
    return { ...exactMatch[0], match_type: 'exact' };
  }

  // Sonst: Embedding-basierte Suche (semantisch)
  const { data: semanticMatch, error } = await supabase.rpc('match_bestellartikel', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 1,
    filter_grosshaendler: grosshaendlerId || null
  });

  if (semanticMatch && semanticMatch.length > 0) {
    return { ...semanticMatch[0], match_type: 'semantic' };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, grosshaendler_id, projekt_id, atbs_nummer } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'Kein Text angegeben' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing Text:', text.substring(0, 100));

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // OpenAI API Key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('OPENAI_API_KEY nicht gesetzt!');
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'OpenAI API Key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hole Großhändler-Liste für Kontext
    const { data: grosshaendler } = await supabase
      .from('grosshaendler')
      .select('id, name, kurzname, typ')
      .eq('ist_aktiv', true);

    const ghNamen = grosshaendler?.map(g => g.kurzname || g.name).join(', ') || 'Keine Großhändler angelegt';

    // GPT-5.2 für mehrsprachiges Parsing
    const prompt = `Du bist ein Experte für Baustellen-Materialbestellungen. Extrahiere Artikel und Mengen aus dem folgenden Text.

Der Text kann auf Deutsch, Ungarisch, Russisch oder Rumänisch sein. Bauarbeiter sprechen oft diese Sprachen.

Bekannte Großhändler: ${ghNamen}

WICHTIG:
- Erkenne Mengen in jeder Sprache: zehn=10, tíz=10, десять=10, zece=10
- Erkenne typische Baumarkt-Artikel: Steckdosen, Schalter, Kabel, Rohre, Fliesen, Farbe, etc.
- Bei Unsicherheit: confidence < 0.8 setzen
- Einheiten erkennen: Stück, m, m², Liter, kg, Rolle, Packung, etc.
- Wenn ein Großhändler erwähnt wird, gib ihn als "grosshaendler" zurück

Antworte NUR mit validem JSON in diesem Format:
{
  "items": [
    {
      "bezeichnung": "Dreifachrahmen weiß",
      "menge": 10,
      "einheit": "Stück",
      "confidence": 0.95,
      "originalText": "10 Dreifachrahmen"
    }
  ],
  "unerkannt": ["unverständlicher Begriff"],
  "grosshaendler": "Würth" oder null
}

TEXT: "${text}"`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: 'Du antwortest nur mit validem JSON. Keine Erklärungen, nur das JSON-Objekt.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI Fehler:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          unerkannt: [],
          error: `KI-Verarbeitung fehlgeschlagen: ${openaiResponse.status} - ${errorText.substring(0, 200)}`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0]?.message?.content || '{}';

    // Parse JSON Antwort
    let parsed: { items: any[]; unerkannt: string[]; grosshaendler?: string };
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON Parse Fehler:', content);
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'Ungültige KI-Antwort' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Großhändler aus Text oder Parameter
    let effectiveGrosshaendlerId = grosshaendler_id;
    let grosshaendlerVorschlag: string | undefined;

    if (parsed.grosshaendler && grosshaendler) {
      const matchedGH = grosshaendler.find(g =>
        g.name.toLowerCase().includes(parsed.grosshaendler!.toLowerCase()) ||
        (g.kurzname && g.kurzname.toLowerCase().includes(parsed.grosshaendler!.toLowerCase()))
      );
      if (matchedGH) {
        grosshaendlerVorschlag = matchedGH.name;
        if (!effectiveGrosshaendlerId) {
          effectiveGrosshaendlerId = matchedGH.id;
        }
      }
    }

    // Für jeden erkannten Artikel: Embedding erstellen und in DB suchen
    const enrichedItems: ParsedItem[] = [];
    const unerkannt: string[] = [...(parsed.unerkannt || [])];

    for (const item of parsed.items) {
      try {
        // Embedding für semantische Suche
        const embedding = await createEmbedding(item.bezeichnung, openaiKey);

        // Artikelsuche
        const matchedArtikel = await findArtikelByEmbedding(
          supabase,
          item.bezeichnung,
          embedding,
          effectiveGrosshaendlerId
        );

        if (matchedArtikel) {
          enrichedItems.push({
            bezeichnung: matchedArtikel.bezeichnung,
            menge: item.menge,
            einheit: item.einheit || matchedArtikel.einheit || 'Stück',
            confidence: matchedArtikel.match_type === 'exact' ? 1.0 : item.confidence * 0.9,
            originalText: item.originalText,
            artikel_id: matchedArtikel.id,
            artikelnummer: matchedArtikel.artikelnummer,
            einzelpreis: matchedArtikel.einkaufspreis,
          });
        } else {
          // Artikel nicht in DB - als Freitext-Position übernehmen
          enrichedItems.push({
            bezeichnung: item.bezeichnung,
            menge: item.menge,
            einheit: item.einheit || 'Stück',
            confidence: item.confidence * 0.7, // Niedrigere Confidence ohne DB-Match
            originalText: item.originalText,
          });
        }
      } catch (embeddingError) {
        console.error('Embedding-Fehler für:', item.bezeichnung, embeddingError);
        // Trotzdem als Freitext übernehmen
        enrichedItems.push({
          bezeichnung: item.bezeichnung,
          menge: item.menge,
          einheit: item.einheit || 'Stück',
          confidence: item.confidence * 0.5,
          originalText: item.originalText,
        });
      }
    }

    const result: ParseResult = {
      success: true,
      items: enrichedItems,
      unerkannt: [...new Set(unerkannt)],
      grosshaendler_vorschlag: grosshaendlerVorschlag,
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );

  } catch (error) {
    console.error('Unerwarteter Fehler:', error);
    return new Response(
      JSON.stringify({ success: false, items: [], unerkannt: [], error: `Interner Fehler: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
