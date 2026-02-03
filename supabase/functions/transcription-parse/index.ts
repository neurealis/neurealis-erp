/**
 * transcription-parse - Transkriptions-Parser mit Hybrid-Prompt und Lern-System
 * v6 - Wohnungsgröße-Kontext für VBW-Staffelpreise
 *
 * Parst Baubesprechungs-Transkripte und ordnet Leistungen LV-Positionen zu.
 * Nutzt GPT-5.2 für Textanalyse und Embedding-basierte LV-Suche.
 *
 * Neu in v6:
 * - Wohnungsgröße aus Text extrahieren (GPT)
 * - Manuell übergebene Wohnungsgröße (wohnungsgroesse_m2 Parameter)
 * - VBW-Staffelpositionen werden basierend auf Wohnungsgröße priorisiert
 * - Staffeln: bis 45 m², 45-75 m², 75-110 m², über 110 m²
 * - Kontext-Extraktion: Wohnungsgröße, Raumanzahl, Stockwerk, Baujahr
 * - Response enthält 'kontext' Objekt mit extrahierten Informationen
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
  wohnungsgroesse_m2?: number; // Bekannte Wohnungsgröße in m²
}

// Wohnungsgröße-Staffeln für VBW
interface WohnungsgroesseStaffel {
  min: number;
  max: number;
  bezeichnung: string;
  pattern: RegExp;
}

const WOHNUNGSGROESSE_STAFFELN: WohnungsgroesseStaffel[] = [
  { min: 0, max: 45, bezeichnung: 'bis 45 m²', pattern: /bis\s*45\s*m[²2]?/i },
  { min: 45, max: 75, bezeichnung: '45-75 m²', pattern: /(von\s*)?45[\s–-]*(bis\s*)?(75|110)\s*m[²2]?/i },
  { min: 75, max: 110, bezeichnung: '75-110 m²', pattern: /(von\s*)?75[\s–-]*(bis\s*)?(110)\s*m[²2]?/i },
  { min: 110, max: 999, bezeichnung: 'über 110 m²', pattern: /über\s*110\s*m[²2]?/i }
];

function getWohnungsgroesseStaffel(m2: number): WohnungsgroesseStaffel {
  if (m2 <= 45) return WOHNUNGSGROESSE_STAFFELN[0];
  if (m2 <= 75) return WOHNUNGSGROESSE_STAFFELN[1];
  if (m2 <= 110) return WOHNUNGSGROESSE_STAFFELN[2];
  return WOHNUNGSGROESSE_STAFFELN[3];
}

// Kontext-Informationen aus Transkription
interface KontextInfo {
  wohnungsgroesse_m2?: number;
  wohnungsgroesse_staffel?: string;
  raumanzahl?: number;
  stockwerk?: number;
  baujahr?: number;
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
  kontext?: KontextInfo; // NEU: Extrahierter Kontext
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

// Extrahiert Wohnungsgröße und andere Kontext-Infos aus dem Text
async function extractKontextWithGPT(
  transcription: string,
  apiKey: string
): Promise<KontextInfo> {
  const systemPrompt = `Du bist ein Experte für Wohnungssanierung. Extrahiere Kontext-Informationen aus dem Text.

Suche nach:
1. Wohnungsgröße in m² (z.B. "60 qm Wohnung", "45 m² groß", "zwischen 45 und 75 Quadratmeter")
2. Raumanzahl (z.B. "3-Zimmer-Wohnung", "2 Räume")
3. Stockwerk (z.B. "3. OG", "Erdgeschoss", "Dachgeschoss")
4. Baujahr (z.B. "Baujahr 1960", "aus den 70ern")

Antworte mit einem JSON-Objekt:
{
  "wohnungsgroesse_m2": <Zahl oder null wenn nicht erkannt>,
  "raumanzahl": <Zahl oder null>,
  "stockwerk": <Zahl oder null (0 = EG, -1 = Keller)>,
  "baujahr": <Zahl oder null>
}

WICHTIG: Nur das JSON-Objekt zurückgeben, keine Erklärungen!`;

  try {
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
          { role: 'user', content: transcription }
        ],
        temperature: 0.1,
        max_completion_tokens: 200,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('GPT Kontext-Fehler:', response.status);
      return {};
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) return {};

    const parsed = JSON.parse(content);
    const kontext: KontextInfo = {};

    if (parsed.wohnungsgroesse_m2 && typeof parsed.wohnungsgroesse_m2 === 'number') {
      kontext.wohnungsgroesse_m2 = parsed.wohnungsgroesse_m2;
      kontext.wohnungsgroesse_staffel = getWohnungsgroesseStaffel(parsed.wohnungsgroesse_m2).bezeichnung;
    }
    if (parsed.raumanzahl && typeof parsed.raumanzahl === 'number') {
      kontext.raumanzahl = parsed.raumanzahl;
    }
    if (parsed.stockwerk !== null && typeof parsed.stockwerk === 'number') {
      kontext.stockwerk = parsed.stockwerk;
    }
    if (parsed.baujahr && typeof parsed.baujahr === 'number') {
      kontext.baujahr = parsed.baujahr;
    }

    return kontext;
  } catch (err) {
    console.error('Kontext-Extraktion fehlgeschlagen:', err);
    return {};
  }
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

    const { transcription, lv_typ, projekt_nr, include_alternatives = true, prioritize_lv_typ = 'gws', wohnungsgroesse_m2: requestWohnungsgroesse } = body;

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

    // ============ 2. Kontext extrahieren (Wohnungsgröße etc.) ============
    let kontext: KontextInfo = {};

    // Wenn Wohnungsgröße im Request übergeben wurde, nutze diese
    if (requestWohnungsgroesse && typeof requestWohnungsgroesse === 'number') {
      kontext.wohnungsgroesse_m2 = requestWohnungsgroesse;
      kontext.wohnungsgroesse_staffel = getWohnungsgroesseStaffel(requestWohnungsgroesse).bezeichnung;
      console.log(`[transcription-parse] Wohnungsgröße aus Request: ${requestWohnungsgroesse} m² (${kontext.wohnungsgroesse_staffel})`);
    } else {
      // Sonst aus Text extrahieren
      kontext = await extractKontextWithGPT(transcription, openaiKey);
      if (kontext.wohnungsgroesse_m2) {
        console.log(`[transcription-parse] Wohnungsgröße aus Text extrahiert: ${kontext.wohnungsgroesse_m2} m² (${kontext.wohnungsgroesse_staffel})`);
      }
    }

    // ============ 3. GPT: Positionen extrahieren ============
    const extractedPositions = await extractPositionsWithGPT(transcription, lvConfig, openaiKey);
    console.log(`[transcription-parse] GPT extrahierte ${extractedPositions.length} Positionen`);

    // ============ 4. Für jede Position: Korrektur prüfen + LV-Match suchen ============
    const parsedPositions: ParsedPosition[] = [];
    let korrekturenAngewendet = 0;
    let fallbacks = 0;
    let mitMatch = 0;
    let ohneMatch = 0;
    let fromPriorityLv = 0;

    // Schwellenwert für "guten Match" aus priorisiertem LV
    const PRIORITY_LV_THRESHOLD = 0.65;

    // Hilfsfunktion: Bei VBW Staffelpositionen die richtige Größe priorisieren
    function priorisierteStaffelPosition(results: LvMatch[], wohnungsgroesseM2: number | undefined): LvMatch[] {
      if (!wohnungsgroesseM2 || lv_typ !== 'VBW' || !results || results.length === 0) {
        return results;
      }

      const staffel = getWohnungsgroesseStaffel(wohnungsgroesseM2);
      console.log(`[transcription-parse] Priorisiere Staffel: ${staffel.bezeichnung}`);

      // Prüfe ob es Staffelpositionen gibt (bezeichnung enthält "m²" oder "m2")
      const hatStaffelPositionen = results.some(r =>
        r.bezeichnung?.includes('m²') || r.bezeichnung?.includes('m2')
      );

      if (!hatStaffelPositionen) {
        return results;
      }

      // Sortiere: Passende Staffel zuerst, dann nach Similarity
      return [...results].sort((a, b) => {
        const aMatchesStaffel = staffel.pattern.test(a.bezeichnung || '');
        const bMatchesStaffel = staffel.pattern.test(b.bezeichnung || '');

        if (aMatchesStaffel && !bMatchesStaffel) return -1;
        if (!aMatchesStaffel && bMatchesStaffel) return 1;

        // Bei gleicher Staffel: Nach Similarity sortieren
        return (b.similarity || 0) - (a.similarity || 0);
      });
    }

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
            match_count: include_alternatives ? 10 : 3, // Mehr holen für Staffel-Filterung
            filter_lv_typ: prioritize_lv_typ,
            filter_gewerk: null
          });

          // Bei VBW: Staffelpositionen priorisieren basierend auf Wohnungsgröße
          const prioResults = priorisierteStaffelPosition(priorityResults || [], kontext.wohnungsgroesse_m2);

          // Guter Match gefunden? (similarity > 0.65)
          if (prioResults && prioResults.length > 0 && prioResults[0].similarity >= PRIORITY_LV_THRESHOLD) {
            console.log(`[transcription-parse] Priorisierter LV-Match (${prioritize_lv_typ}): ${prioResults[0].bezeichnung?.substring(0, 40)}... (sim=${prioResults[0].similarity.toFixed(3)})`);
            // Limitiere auf gewünschte Anzahl
            const limitedResults = prioResults.slice(0, include_alternatives ? 5 : 1);
            lvResults = limitedResults.map((r: LvMatch) => ({
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
            match_count: include_alternatives ? 10 : 3, // Mehr holen für Staffel-Filterung
            filter_lv_typ: lv_typ,
            filter_gewerk: null
          });

          // Bei VBW: Staffelpositionen priorisieren
          const prioResults = priorisierteStaffelPosition(requestedResults || [], kontext.wohnungsgroesse_m2);

          if (prioResults && prioResults.length > 0 && prioResults[0].similarity >= 0.7) {
            const limitedResults = prioResults.slice(0, include_alternatives ? 5 : 1);
            lvResults = limitedResults.map((r: LvMatch) => ({
              ...r,
              from_priority_lv: false,
              is_fallback: false
            }));
          }
        }

        // SCHRITT 3: Fallback - im aktuellen LV-Typ suchen (nicht alle LVs!)
        if (!lvResults || (lvResults[0] && lvResults[0].similarity < 0.7)) {
          console.log(`[transcription-parse] Fallback-Suche im ${lv_typ} für: ${searchText.substring(0, 50)}...`);

          const { data: fallbackResults } = await supabase.rpc('search_lv_positions', {
            query_embedding: embedding,
            match_count: include_alternatives ? 10 : 3, // Mehr holen für Staffel-Filterung
            filter_lv_typ: lv_typ, // Nur im aktuellen LV suchen (FIX: war vorher null)
            filter_gewerk: null
          });

          // Bei VBW: Staffelpositionen priorisieren
          const prioResults = priorisierteStaffelPosition(fallbackResults || [], kontext.wohnungsgroesse_m2);

          if (prioResults && prioResults.length > 0) {
            const limitedResults = prioResults.slice(0, include_alternatives ? 5 : 1);
            // Prüfen ob Fallback-Ergebnis aus priorisiertem LV stammt
            lvResults = limitedResults.map((r: LvMatch) => ({
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
      },
      kontext: Object.keys(kontext).length > 0 ? kontext : undefined
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
