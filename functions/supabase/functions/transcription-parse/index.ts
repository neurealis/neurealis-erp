/**
 * transcription-parse - Transkriptions-Parser mit Hybrid-Prompt und Lern-System
 * v5 - Hierarchisches Lern-System, verbesserte Sortierung
 *
 * Parst Baubesprechungs-Transkripte und ordnet Leistungen LV-Positionen zu.
 * Nutzt GPT-5.2 für Textanalyse und Embedding-basierte LV-Suche.
 *
 * Neu in v5:
 * - prioritize_lv_typ aus Request-Body (Default: 'gws')
 * - Hierarchisches Lern-System: Erst LV-spezifisch, dann globaler Fallback
 * - Bei globalem Treffer: Nutzt Hinweis, sucht aber im aktuellen LV
 * - Sortierung: Similarity DESC, bei gleicher Similarity: Listenpreis DESC
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ Interfaces ============

interface ParseRequest {
  transcription: string;
  lv_typ: string;
  projekt_nr?: string;
  include_alternatives?: boolean; // Top 5 Alternativen zurückgeben
  prioritize_lv_typ?: string; // LV-Typ der priorisiert wird (default: 'gws')
}

interface LvConfig {
  id: number;
  lv_typ: string;
  gewerke: Gewerk[];
  besonderheiten: Record<string, unknown>;
  prompt_hints: string | null;
  aktiv: boolean;
}

interface Gewerk {
  id: string;
  name: string;
  kurzname: string;
}

interface ExtractedPosition {
  original_text: string;
  gewerk: string;
  beschreibung: string;
  menge: number;
  einheit: string;
}

interface LvMatch {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  beschreibung?: string;
  einzelpreis: number;
  listenpreis: number;
  similarity: number;
  is_fallback?: boolean;
  from_priority_lv?: boolean; // Stammt aus priorisiertem LV-Typ
}

interface ParsedPosition {
  original_text: string;
  gewerk: string;
  beschreibung: string;
  menge: number;
  einheit: string;
  lv_position?: LvMatch;
  alternativen?: LvMatch[];
  korrektur_angewendet?: boolean;
  korrektur_id?: string;
}

interface ParseResponse {
  success: boolean;
  lv_typ: string;
  prioritize_lv_typ?: string;
  positionen: ParsedPosition[];
  statistik: {
    total: number;
    mit_match: number;
    ohne_match: number;
    korrekturen_angewendet: number;
    fallbacks: number;
    from_priority_lv: number; // Anzahl Positionen aus priorisiertem LV
  };
  error?: string;
}

// ============ OpenAI Functions ============

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

async function extractPositionsWithGPT(
  transcription: string,
  lvConfig: LvConfig,
  apiKey: string
): Promise<ExtractedPosition[]> {
  const gewerkeList = lvConfig.gewerke.map(g => g.name).join(', ');
  const besonderheitenJson = JSON.stringify(lvConfig.besonderheiten || {}, null, 2);
  const promptHints = lvConfig.prompt_hints || '';

  const systemPrompt = `Du bist ein Experte für Wohnungssanierung und analysierst Baubesprechungs-Transkripte.

LV-Typ: ${lvConfig.lv_typ}
Verfügbare Gewerke: ${gewerkeList}

${promptHints}

Aufgabe: Extrahiere alle Leistungen aus dem Text und ordne sie Gewerken zu.

Besonderheiten für ${lvConfig.lv_typ}:
${besonderheitenJson}

Regeln:
1. JEDE Leistung als separates Objekt
2. Gewerk muss aus der Liste oben sein (verwende exakte Namen!)
3. Beschreibung in Deutsch (auch bei mehrsprachigem Input)
4. Menge schätzen wenn möglich, sonst 1
5. Einheit passend wählen (Stk, m², lfm, psch)
6. Bei Unsicherheit: Beschreibung ausführlicher machen
7. Zulagen/Staffeln als separate Positionen wenn erwähnt

Antworte mit einem JSON-Objekt in diesem Format:
{
  "positionen": [
    {
      "original_text": "Text aus Transkript",
      "gewerk": "Exakter Gewerk-Name aus Liste",
      "beschreibung": "Klare Beschreibung der Leistung",
      "menge": 1,
      "einheit": "Stk"
    }
  ]
}

WICHTIG: Nur JSON-Objekt mit "positionen"-Array zurückgeben, keine Erklärungen!`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transkription:\n\n${transcription}` }
      ],
      temperature: 0.2,
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GPT Fehler:', response.status, errorText);
    throw new Error(`GPT-Anfrage fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('GPT lieferte keine Antwort');
  }

  try {
    const parsed = JSON.parse(content);
    // GPT kann {positionen: [...]} oder direkt [...] zurückgeben
    const positions = Array.isArray(parsed) ? parsed : (parsed.positionen || parsed.items || []);
    return positions;
  } catch (parseError) {
    console.error('JSON Parse Fehler:', content);
    throw new Error('GPT-Antwort ist kein gültiges JSON');
  }
}

// ============ Main Handler ============

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Debug: Request Body loggen
    let body: ParseRequest;
    try {
      body = await req.json();
      console.log(`[transcription-parse] Request erhalten: lv_typ=${body.lv_typ}, transcription_length=${body.transcription?.length || 0}`);
    } catch (parseError) {
      console.error('[transcription-parse] JSON Parse Error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Ungültiger JSON-Body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcription, lv_typ, projekt_nr, include_alternatives = true, prioritize_lv_typ = 'gws' } = body;

    // Validierung
    if (!transcription || transcription.length < 10) {
      console.log(`[transcription-parse] Validierungsfehler: transcription zu kurz (${transcription?.length || 0} Zeichen)`);
      return new Response(
        JSON.stringify({ success: false, error: 'Transkription muss mindestens 10 Zeichen haben' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lv_typ) {
      console.log('[transcription-parse] Validierungsfehler: lv_typ fehlt');
      return new Response(
        JSON.stringify({ success: false, error: 'lv_typ ist erforderlich (z.B. GWS, VBW, neurealis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[transcription-parse] Start: lv_typ=${lv_typ}, prioritize_lv_typ=${prioritize_lv_typ}, ${transcription.length} Zeichen`);

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // OpenAI API Key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API Key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ 1. LV-Config laden ============
    const { data: lvConfig, error: configError } = await supabase
      .from('lv_config')
      .select('*')
      .eq('lv_typ', lv_typ)
      .eq('aktiv', true)
      .single();

    if (configError || !lvConfig) {
      console.error('LV-Config nicht gefunden:', configError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Keine aktive LV-Config für Typ '${lv_typ}' gefunden`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[transcription-parse] LV-Config geladen: ${lvConfig.gewerke?.length || 0} Gewerke`);

    // ============ 2. GPT: Positionen extrahieren ============
    const extractedPositions = await extractPositionsWithGPT(transcription, lvConfig, openaiKey);
    console.log(`[transcription-parse] GPT extrahierte ${extractedPositions.length} Positionen`);

    // ============ 3. Für jede Position: Korrektur prüfen + LV-Match suchen ============
    const parsedPositions: ParsedPosition[] = [];
    let korrekturenAngewendet = 0;
    let fallbacks = 0;
    let mitMatch = 0;
    let ohneMatch = 0;
    let fromPriorityLv = 0;

    // Schwellenwert für "guten Match" aus priorisiertem LV
    const PRIORITY_LV_THRESHOLD = 0.75;

    for (const pos of extractedPositions) {
      const searchText = `${pos.gewerk}: ${pos.beschreibung}`;
      const embedding = await createEmbedding(searchText, openaiKey);

      const parsedPos: ParsedPosition = {
        original_text: pos.original_text,
        gewerk: pos.gewerk,
        beschreibung: pos.beschreibung,
        menge: pos.menge || 1,
        einheit: pos.einheit || 'Stk',
      };

      // 3a. Korrektur-Suche (gelernte Mappings) - Hierarchisch: erst LV-spezifisch, dann global
      const { data: corrections } = await supabase.rpc('search_position_corrections', {
        query_embedding: embedding,
        p_lv_typ: lv_typ,
        match_threshold: 0.92,
        match_count: 1
      });

      if (corrections && corrections.length > 0) {
        const correction = corrections[0];
        const isGlobalMatch = correction.is_global_match;

        if (isGlobalMatch) {
          // Globaler Treffer: Nutze als Hinweis, suche aber im aktuellen LV
          console.log(`[transcription-parse] Globaler Korrektur-Hinweis (aus ${correction.lv_typ}): ${searchText.substring(0, 50)}...`);

          // Lade die korrekte Position, um deren Bezeichnung als Suchbegriff zu nutzen
          const { data: hinweisPos } = await supabase
            .from('lv_positionen')
            .select('bezeichnung, beschreibung')
            .eq('id', correction.korrekte_position_id)
            .single();

          if (hinweisPos) {
            // Erstelle neues Embedding basierend auf der korrekten Bezeichnung
            const hinweisSearchText = `${pos.gewerk}: ${hinweisPos.bezeichnung}`;
            const hinweisEmbedding = await createEmbedding(hinweisSearchText, openaiKey);

            // Suche im aktuellen LV mit dem Hinweis-Embedding
            const { data: lvHinweisResults } = await supabase.rpc('search_lv_positions', {
              query_embedding: hinweisEmbedding,
              match_count: 1,
              filter_lv_typ: lv_typ,
              filter_gewerk: null
            });

            if (lvHinweisResults && lvHinweisResults.length > 0 && lvHinweisResults[0].similarity >= 0.7) {
              const best = lvHinweisResults[0];
              console.log(`[transcription-parse] Hinweis-basierter Match im ${lv_typ}: ${best.bezeichnung?.substring(0, 40)}... (sim=${best.similarity.toFixed(3)})`);
              parsedPos.lv_position = {
                id: best.id,
                artikelnummer: best.artikelnummer,
                bezeichnung: best.bezeichnung,
                beschreibung: best.beschreibung,
                einzelpreis: Number(best.preis) || 0,
                listenpreis: Number(best.listenpreis) || Number(best.preis) || 0,
                similarity: Number(best.similarity),
                is_fallback: false
              };
              parsedPos.korrektur_angewendet = true;
              parsedPos.korrektur_id = correction.id;
              korrekturenAngewendet++;
              mitMatch++;

              // angewendet_count erhöhen
              await supabase
                .from('position_corrections')
                .update({ angewendet_count: (correction.angewendet_count || 0) + 1 })
                .eq('id', correction.id);
            }
          }
        } else {
          // LV-spezifischer Treffer - direkt anwenden
          console.log(`[transcription-parse] Korrektur angewendet für: ${searchText.substring(0, 50)}...`);

          // Korrekte Position laden
          const { data: korrekteLvPos } = await supabase
            .from('lv_positionen')
            .select('id, artikelnummer, bezeichnung, beschreibung, preis, listenpreis')
            .eq('id', correction.korrekte_position_id)
            .single();

          if (korrekteLvPos) {
            parsedPos.lv_position = {
              id: korrekteLvPos.id,
              artikelnummer: korrekteLvPos.artikelnummer,
              bezeichnung: korrekteLvPos.bezeichnung,
              beschreibung: korrekteLvPos.beschreibung,
              einzelpreis: Number(korrekteLvPos.preis) || 0,
              listenpreis: Number(korrekteLvPos.listenpreis) || Number(korrekteLvPos.preis) || 0,
              similarity: Number(correction.similarity),
              is_fallback: false
            };
            parsedPos.korrektur_angewendet = true;
            parsedPos.korrektur_id = correction.id;
            korrekturenAngewendet++;
            mitMatch++;

            // angewendet_count erhöhen
            await supabase
              .from('position_corrections')
              .update({ angewendet_count: (correction.angewendet_count || 0) + 1 })
              .eq('id', correction.id);
          }
        }
      }

      // 3b. Falls keine Korrektur: LV-Suche mit Priorisierung
      if (!parsedPos.lv_position) {
        let lvResults: LvMatch[] | null = null;
        let usedPriorityLv = false;

        // SCHRITT 1: Zuerst im priorisierten LV-Typ suchen (z.B. GWS)
        if (prioritize_lv_typ) {
          const { data: priorityResults } = await supabase.rpc('search_lv_positions', {
            query_embedding: embedding,
            match_count: include_alternatives ? 5 : 1,
            filter_lv_typ: prioritize_lv_typ,
            filter_gewerk: null
          });

          // Guter Match gefunden? (similarity > 0.75)
          if (priorityResults && priorityResults.length > 0 && priorityResults[0].similarity >= PRIORITY_LV_THRESHOLD) {
            console.log(`[transcription-parse] Priorisierter LV-Match (${prioritize_lv_typ}): ${priorityResults[0].bezeichnung?.substring(0, 40)}... (sim=${priorityResults[0].similarity.toFixed(3)})`);
            lvResults = priorityResults.map((r: LvMatch) => ({
              ...r,
              from_priority_lv: true,
              is_fallback: false
            }));
            usedPriorityLv = true;
          }
        }

        // SCHRITT 2: Wenn kein guter Priorisierungs-Match, dann im angeforderten LV-Typ suchen
        if (!lvResults && lv_typ !== prioritize_lv_typ) {
          const { data: requestedResults } = await supabase.rpc('search_lv_positions', {
            query_embedding: embedding,
            match_count: include_alternatives ? 5 : 1,
            filter_lv_typ: lv_typ,
            filter_gewerk: null
          });

          if (requestedResults && requestedResults.length > 0 && requestedResults[0].similarity >= 0.7) {
            lvResults = requestedResults.map((r: LvMatch) => ({
              ...r,
              from_priority_lv: false,
              is_fallback: false
            }));
          }
        }

        // SCHRITT 3: Fallback - alle LV-Typen durchsuchen wenn immer noch kein guter Match
        if (!lvResults || (lvResults[0] && lvResults[0].similarity < 0.7)) {
          console.log(`[transcription-parse] Fallback-Suche für: ${searchText.substring(0, 50)}...`);

          const { data: fallbackResults } = await supabase.rpc('search_lv_positions', {
            query_embedding: embedding,
            match_count: include_alternatives ? 5 : 1,
            filter_lv_typ: null, // Alle LVs
            filter_gewerk: null
          });

          if (fallbackResults && fallbackResults.length > 0) {
            // Prüfen ob Fallback-Ergebnis aus priorisiertem LV stammt
            lvResults = fallbackResults.map((r: LvMatch) => ({
              ...r,
              is_fallback: true,
              from_priority_lv: r.lv_typ === prioritize_lv_typ
            }));
            fallbacks++;
          }
        }

        if (lvResults && lvResults.length > 0) {
          const best = lvResults[0];
          parsedPos.lv_position = {
            id: best.id,
            artikelnummer: best.artikelnummer,
            bezeichnung: best.bezeichnung,
            beschreibung: best.beschreibung,
            einzelpreis: Number(best.preis) || 0,
            listenpreis: Number(best.listenpreis) || Number(best.preis) || 0,
            similarity: Number(best.similarity),
            is_fallback: best.is_fallback || false,
            from_priority_lv: usedPriorityLv || best.from_priority_lv || false
          };
          mitMatch++;

          if (usedPriorityLv || best.from_priority_lv) {
            fromPriorityLv++;
          }

          // Alternativen hinzufügen (wenn gewünscht)
          if (include_alternatives && lvResults.length > 1) {
            parsedPos.alternativen = lvResults.slice(1).map((r: LvMatch) => ({
              id: r.id,
              artikelnummer: r.artikelnummer,
              bezeichnung: r.bezeichnung,
              einzelpreis: Number(r.preis) || 0,
              listenpreis: Number(r.listenpreis) || Number(r.preis) || 0,
              similarity: Number(r.similarity),
              from_priority_lv: r.from_priority_lv || false
            }));
          }
        } else {
          ohneMatch++;
        }
      }

      parsedPositions.push(parsedPos);
    }

    const duration = Date.now() - startTime;
    console.log(`[transcription-parse] Fertig: ${parsedPositions.length} Positionen in ${duration}ms`);

    const response: ParseResponse = {
      success: true,
      lv_typ,
      prioritize_lv_typ,
      positionen: parsedPositions,
      statistik: {
        total: parsedPositions.length,
        mit_match: mitMatch,
        ohne_match: ohneMatch,
        korrekturen_angewendet: korrekturenAngewendet,
        fallbacks,
        from_priority_lv: fromPriorityLv
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[transcription-parse] Fehler:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Interner Fehler: ${errorMessage}`,
        positionen: [],
        statistik: { total: 0, mit_match: 0, ohne_match: 0, korrekturen_angewendet: 0, fallbacks: 0, from_priority_lv: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
