/**
 * parse-bestellung - Mehrsprachiges KI-Parsing für Bestellungen
 *
 * Parst Freitext-Eingaben (DE, HU, RU, RO) und extrahiert Artikel + Mengen.
 * Nutzt OpenAI gpt-5.2 für die Erkennung.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedItem {
  artikel: string;
  menge: number;
  confidence: number;
  originalText?: string;
}

interface ParseResult {
  success: boolean;
  items: ParsedItem[];
  unerkannt: string[];
  error?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'Kein Text angegeben' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase Client für Artikel-Abgleich
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hole verfügbare Artikel aus der Datenbank
    const { data: artikelListe, error: dbError } = await supabase
      .from('artikel')
      .select('id, name, synonyme, kategorie')
      .eq('aktiv', true);

    const verfuegbareArtikel = artikelListe || [
      // Fallback Demo-Daten falls Tabelle nicht existiert
      { name: 'Dreifachrahmen', synonyme: ['3er Rahmen', 'Triple frame', 'hármas keret', 'тройная рамка'] },
      { name: 'Zweifachrahmen', synonyme: ['2er Rahmen', 'Double frame', 'kettes keret', 'двойная рамка'] },
      { name: 'Einfachrahmen', synonyme: ['1er Rahmen', 'Single frame', 'egyes keret', 'одинарная рамка'] },
      { name: 'Steckdose', synonyme: ['Socket', 'Outlet', 'konnektor', 'розетка'] },
      { name: 'Wechselschalter', synonyme: ['Switch', 'váltókapcsoló', 'выключатель'] },
      { name: 'Serienschalter', synonyme: ['Series switch', 'soros kapcsoló', 'серийный выключатель'] },
      { name: 'Kreuzschalter', synonyme: ['Cross switch', 'keresztkapcsoló', 'крестовой выключатель'] },
    ];

    // OpenAI API für mehrsprachiges Parsing
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'OpenAI API Key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const artikelNamen = verfuegbareArtikel.map(a => a.name).join(', ');

    const prompt = `Du bist ein Experte für Baustellen-Bestellungen. Extrahiere Artikel und Mengen aus dem folgenden Text.
Der Text kann auf Deutsch, Ungarisch, Russisch oder Rumänisch sein.

Verfügbare Artikel: ${artikelNamen}

WICHTIG:
- Ordne jeden erkannten Artikel dem passenden Namen aus der Liste zu
- Zahlwörter in jeder Sprache erkennen (zehn=10, tíz=10, десять=10, zece=10)
- Bei Unsicherheit: confidence < 0.8
- Artikel die nicht zugeordnet werden können: in "unerkannt" auflisten

Antworte NUR mit JSON in diesem Format:
{
  "items": [
    {"artikel": "Dreifachrahmen", "menge": 10, "confidence": 0.95, "originalText": "10 Dreifachrahmen"}
  ],
  "unerkannt": ["unbekannter Begriff"]
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
          { role: 'system', content: 'Du antwortest nur mit validem JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI Fehler:', errorText);
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'KI-Verarbeitung fehlgeschlagen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0]?.message?.content || '{}';

    // Parse JSON Antwort
    let parsed: { items: ParsedItem[]; unerkannt: string[] };
    try {
      // Entferne eventuelle Markdown-Codeblocks
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON Parse Fehler:', content);
      return new Response(
        JSON.stringify({ success: false, items: [], unerkannt: [], error: 'Ungültige KI-Antwort' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validiere erkannte Artikel gegen Datenbank
    const validatedItems = parsed.items.filter(item => {
      const exists = verfuegbareArtikel.some(
        a => a.name.toLowerCase() === item.artikel.toLowerCase()
      );
      if (!exists) {
        parsed.unerkannt.push(item.artikel);
      }
      return exists;
    });

    const result: ParseResult = {
      success: true,
      items: validatedItems,
      unerkannt: [...new Set(parsed.unerkannt)], // Deduplizieren
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
    console.error('Fehler:', error);
    return new Response(
      JSON.stringify({ success: false, items: [], unerkannt: [], error: 'Interner Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
