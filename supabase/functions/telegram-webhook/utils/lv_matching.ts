/**
 * LV-Matching Utilities für Nachträge
 * Wiederverwendbare Funktionen für LV-Position-Matching
 */

import { supabase, OPENAI_API_KEY } from "../constants.ts";
import type { NachtragPosition } from "../types.ts";

// Re-export für externe Nutzung
export type { NachtragPosition };

export interface ParsedNachtragResult {
  positionen: NachtragPosition[];
  summe_netto: number;
  lv_typ: string;
}

// ============================================
// LV-Typ Mapping: Auftraggeber → lv_typ in DB
// ============================================

const AUFTRAGGEBER_LV_TYP_MAPPING: Record<string, string> = {
  // Exakte Matches (case-insensitive)
  'vbw': 'VBW',
  'gws': 'GWS',
  'covivio': 'covivio',
  'vonovia': 'VBW',  // Vonovia nutzt VBW-LV
  'neurealis': 'neurealis',
  'privat': 'Privat',
  'wbg': 'WBG Lünen',
  'wbg lünen': 'WBG Lünen',

  // Weitere bekannte Auftraggeber → Fallback auf GWS oder neurealis
  'allbau': 'GWS',
  'd.i.m.': 'neurealis',
  'dim': 'neurealis',
  'eigenbestand': 'neurealis',
  'forte capital': 'neurealis',
  'hug bochum': 'neurealis',
  'hv bach': 'neurealis',
  'isrichter': 'neurealis',
  'quadrat': 'neurealis',
  'stadtimmobilien ruhrgebiet': 'neurealis',
  'vilico immo': 'neurealis',
  'wvb centuria': 'neurealis',
  'gewobag': 'GWS',  // Berlin, ähnlich wie GWS
  'degewo': 'GWS',   // Berlin, ähnlich wie GWS
};

// ============================================
// getLvTypFromProjekt - Auftraggeber → LV-Typ ermitteln
// ============================================

export async function getLvTypFromProjekt(atbsNummer: string): Promise<string> {
  try {
    // Projekt aus monday_bauprozess laden
    const { data: projekt, error } = await supabase
      .from('monday_bauprozess')
      .select('auftraggeber')
      .eq('atbs_nummer', atbsNummer)
      .single();

    if (error || !projekt?.auftraggeber) {
      console.log(`[LV-Matching] Kein Auftraggeber für ${atbsNummer}, Fallback: GWS`);
      return 'GWS';
    }

    const auftraggeber = projekt.auftraggeber.toLowerCase().trim();

    // Exaktes Mapping prüfen
    if (AUFTRAGGEBER_LV_TYP_MAPPING[auftraggeber]) {
      const lvTyp = AUFTRAGGEBER_LV_TYP_MAPPING[auftraggeber];
      console.log(`[LV-Matching] ${atbsNummer}: Auftraggeber "${projekt.auftraggeber}" → LV-Typ "${lvTyp}"`);
      return lvTyp;
    }

    // Partial Match versuchen (z.B. "VBW Bochum" → "vbw")
    for (const [key, value] of Object.entries(AUFTRAGGEBER_LV_TYP_MAPPING)) {
      if (auftraggeber.includes(key) || key.includes(auftraggeber)) {
        console.log(`[LV-Matching] ${atbsNummer}: Auftraggeber "${projekt.auftraggeber}" (partial) → LV-Typ "${value}"`);
        return value;
      }
    }

    // Fallback
    console.log(`[LV-Matching] ${atbsNummer}: Auftraggeber "${projekt.auftraggeber}" unbekannt, Fallback: GWS`);
    return 'GWS';
  } catch (e) {
    console.error(`[LV-Matching] Fehler bei LV-Typ-Ermittlung für ${atbsNummer}:`, e);
    return 'GWS';
  }
}

// ============================================
// parseNachtragPositionen - GPT-Parsing mit gpt-5.2
// ============================================

export async function parseNachtragPositionen(
  beschreibung: string,
  lvTyp: string
): Promise<NachtragPosition[]> {
  try {
    const systemPrompt = `Du bist ein Experte für Wohnungssanierung und analysierst Nachtragsbeschreibungen.

LV-Typ: ${lvTyp}

Aufgabe: Extrahiere alle Leistungen/Positionen aus dem Text.

Regeln:
1. JEDE Leistung als separates Objekt
2. Gewerk muss erkennbar sein (Elektrik, Sanitär, Maler, Boden, Türen, Fenster, Heizung, Trockenbau, Entkernung, Bad, Fliesen, Sonstiges)
3. Beschreibung kurz und präzise auf Deutsch
4. Menge schätzen wenn möglich, sonst 1
5. Einheit passend wählen (Stk, m², lfm, psch, Std)
6. Bei Unsicherheit: Beschreibung ausführlicher machen

Antworte NUR mit JSON:
{
  "positionen": [
    {
      "original_text": "Original-Text aus Beschreibung",
      "beschreibung": "Klare Beschreibung der Leistung",
      "gewerk": "Gewerk-Name",
      "menge": 1,
      "einheit": "Stk"
    }
  ]
}

WICHTIG: Nur JSON zurückgeben, keine Erklärungen!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 2000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Nachtragsbeschreibung:\n\n${beschreibung}` }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LV-Matching] GPT-Fehler:', response.status, errorText);
      return [{
        original_text: beschreibung,
        beschreibung: beschreibung,
        gewerk: 'Sonstiges',
        menge: 1,
        einheit: 'psch'
      }];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('GPT lieferte keine Antwort');
    }

    const parsed = JSON.parse(content);
    const positionen = Array.isArray(parsed) ? parsed : (parsed.positionen || []);

    console.log(`[LV-Matching] GPT extrahierte ${positionen.length} Positionen`);
    return positionen;
  } catch (e) {
    console.error('[LV-Matching] Parse-Fehler:', e);
    // Fallback: Eine Position mit der kompletten Beschreibung
    return [{
      original_text: beschreibung,
      beschreibung: beschreibung,
      gewerk: 'Sonstiges',
      menge: 1,
      einheit: 'psch'
    }];
  }
}

// ============================================
// createEmbedding - OpenAI Embedding erstellen
// ============================================

async function createEmbedding(text: string): Promise<number[]> {
  const cleanText = text?.trim() || 'unbekannt';

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: cleanText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LV-Matching] Embedding-Fehler:', response.status, errorText);
    throw new Error(`Embedding-Erstellung fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================
// matchLvPositionen - Embedding-Match mit Fallback
// ============================================

export async function matchLvPositionen(
  positionen: NachtragPosition[],
  lvTyp: string
): Promise<NachtragPosition[]> {
  const matchedPositionen: NachtragPosition[] = [];
  const SIMILARITY_THRESHOLD = 0.6; // L098-L100: Threshold 0.6

  for (const pos of positionen) {
    try {
      // Suchtext erstellen
      const searchText = `${pos.gewerk}: ${pos.beschreibung}`;
      const embedding = await createEmbedding(searchText);

      // 1. Zuerst im spezifischen LV-Typ suchen
      let { data: lvResults } = await supabase.rpc('search_lv_positions', {
        query_embedding: embedding,
        match_count: 1,
        filter_lv_typ: lvTyp,
        filter_gewerk: null
      });

      // 2. Fallback auf GWS wenn kein guter Match
      if ((!lvResults || lvResults.length === 0 || lvResults[0].similarity < SIMILARITY_THRESHOLD) && lvTyp !== 'GWS') {
        console.log(`[LV-Matching] Fallback auf GWS für: ${searchText.substring(0, 50)}...`);
        const { data: gwsResults } = await supabase.rpc('search_lv_positions', {
          query_embedding: embedding,
          match_count: 1,
          filter_lv_typ: 'GWS',
          filter_gewerk: null
        });

        if (gwsResults && gwsResults.length > 0 && gwsResults[0].similarity >= SIMILARITY_THRESHOLD) {
          lvResults = gwsResults;
        }
      }

      // 3. Fallback auf neurealis wenn immer noch kein Match
      if ((!lvResults || lvResults.length === 0 || lvResults[0].similarity < SIMILARITY_THRESHOLD) && lvTyp !== 'neurealis') {
        console.log(`[LV-Matching] Fallback auf neurealis für: ${searchText.substring(0, 50)}...`);
        const { data: neurealisResults } = await supabase.rpc('search_lv_positions', {
          query_embedding: embedding,
          match_count: 1,
          filter_lv_typ: 'neurealis',
          filter_gewerk: null
        });

        if (neurealisResults && neurealisResults.length > 0 && neurealisResults[0].similarity >= SIMILARITY_THRESHOLD) {
          lvResults = neurealisResults;
        }
      }

      // Ergebnis verarbeiten
      if (lvResults && lvResults.length > 0 && lvResults[0].similarity >= SIMILARITY_THRESHOLD) {
        const best = lvResults[0];
        // L103: preis vs. listenpreis - für Nachträge nutzen wir listenpreis
        const einzelpreis = Number(best.listenpreis) || Number(best.preis) || 0;

        matchedPositionen.push({
          ...pos,
          lv_position_id: best.id,
          artikelnummer: best.artikelnummer,
          bezeichnung: best.bezeichnung,
          einzelpreis: einzelpreis,
          gesamtpreis: einzelpreis * pos.menge,
          similarity: Number(best.similarity)
        });

        console.log(`[LV-Matching] Match gefunden: "${pos.beschreibung.substring(0, 30)}..." → "${best.bezeichnung?.substring(0, 30)}..." (sim=${best.similarity.toFixed(3)}, EP=${einzelpreis}€)`);
      } else {
        // Kein Match - Position ohne Preis hinzufügen
        console.log(`[LV-Matching] Kein Match für: "${pos.beschreibung.substring(0, 50)}..."`);
        matchedPositionen.push({
          ...pos,
          einzelpreis: 0,
          gesamtpreis: 0,
          similarity: lvResults?.[0]?.similarity || 0
        });
      }
    } catch (e) {
      console.error(`[LV-Matching] Fehler bei Position "${pos.beschreibung}":`, e);
      matchedPositionen.push({
        ...pos,
        einzelpreis: 0,
        gesamtpreis: 0
      });
    }
  }

  return matchedPositionen;
}

// ============================================
// processNachtragBeschreibung - Kompletter Workflow
// ============================================

export async function processNachtragBeschreibung(
  beschreibung: string,
  atbsNummer: string
): Promise<ParsedNachtragResult> {
  // 1. LV-Typ ermitteln
  const lvTyp = await getLvTypFromProjekt(atbsNummer);
  console.log(`[LV-Matching] Starte Verarbeitung für ${atbsNummer} mit LV-Typ: ${lvTyp}`);

  // 2. Positionen parsen
  const parsedPositionen = await parseNachtragPositionen(beschreibung, lvTyp);

  // 3. LV-Matching
  const matchedPositionen = await matchLvPositionen(parsedPositionen, lvTyp);

  // 4. Summe berechnen
  const summeNetto = matchedPositionen.reduce((sum, pos) => sum + (pos.gesamtpreis || 0), 0);

  console.log(`[LV-Matching] Fertig: ${matchedPositionen.length} Positionen, Summe: ${summeNetto.toFixed(2)}€`);

  return {
    positionen: matchedPositionen,
    summe_netto: summeNetto,
    lv_typ: lvTyp
  };
}
