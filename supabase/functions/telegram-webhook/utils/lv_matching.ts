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
  original_eingabe?: string;  // Original-Text vor KI-Parsing
  lv_override_detected?: boolean;  // LV-Override aus Text erkannt
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
// LV-Override Keywords für Spracheingabe
// Erkennt: "nutze LV der GWS", "such im VBW Katalog"
// ============================================

const LV_OVERRIDE_KEYWORDS: Record<string, string[]> = {
  'GWS': ['gws', 'gws-lv', 'gws leistungsverzeichnis', 'gws katalog'],
  'VBW': ['vbw', 'vbw-lv', 'vbw leistungsverzeichnis', 'vbw katalog'],
  'neurealis': ['neurealis', 'neurealis-lv', 'privat', 'privatkundenlv', 'privatkundenleistungsverzeichnis'],
  'covivio': ['covivio', 'covivio-lv', 'covivio katalog'],
  'WBG Lünen': ['wbg', 'wbg lünen', 'wbg-lv'],
};

/**
 * Erkennt expliziten LV-Typ-Override aus Spracheingabe
 * Beispiel: "nutze LV der GWS" oder "such im VBW Katalog"
 * @returns LV-Typ oder null wenn kein Override erkannt
 */
export function detectLvOverride(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Patterns für explizite LV-Nennung
  const overridePatterns = [
    /nutze\s+(?:das\s+)?lv\s+(?:der\s+|von\s+)?(\w+)/i,
    /such(?:e)?\s+(?:im|in)\s+(\w+)[\s-]?(?:lv|katalog|leistungsverzeichnis)?/i,
    /(?:mit|aus)\s+dem?\s+(\w+)[\s-]?lv/i,
    /lv[\s-]?typ[:\s]+(\w+)/i,
    /(?:im|in)\s+(\w+)[\s-]?(?:lv|katalog)\s+(?:suchen|nachschauen|schauen)/i,
  ];

  for (const pattern of overridePatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const keyword = match[1].toLowerCase();
      for (const [lvTyp, keywords] of Object.entries(LV_OVERRIDE_KEYWORDS)) {
        if (keywords.some(k => k.includes(keyword) || keyword.includes(k.split(' ')[0]))) {
          console.log(`[LV-Matching] Override erkannt: "${match[0]}" → LV-Typ "${lvTyp}"`);
          return lvTyp;
        }
      }
    }
  }

  return null;
}

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
  lvTyp: string,
  searchAllLvs: boolean = false  // Cross-LV-Suche wenn true
): Promise<NachtragPosition[]> {
  const matchedPositionen: NachtragPosition[] = [];
  const SIMILARITY_THRESHOLD = 0.6; // L098-L100: Threshold 0.6
  const LEARNING_THRESHOLD = 0.8;   // Höherer Threshold für Learnings

  for (const pos of positionen) {
    try {
      // Suchtext erstellen
      const searchText = `${pos.gewerk}: ${pos.beschreibung}`;
      const embedding = await createEmbedding(searchText);

      // ========================================
      // STEP 0: Erst in Learnings/Korrekturen suchen
      // ========================================
      try {
        const { data: corrections } = await supabase.rpc('search_telegram_corrections', {
          p_embedding: embedding,
          p_lv_typ: lvTyp,
          p_gewerk: pos.gewerk,
          p_threshold: LEARNING_THRESHOLD
        });

        if (corrections && corrections.length > 0 && corrections[0].similarity_score >= LEARNING_THRESHOLD) {
          const correction = corrections[0];
          console.log(`[LV-Matching] 🎓 Learning gefunden: "${pos.beschreibung.substring(0, 30)}..." (sim=${correction.similarity_score.toFixed(3)})`);

          // Position aus Korrektur laden
          const { data: lvPos } = await supabase
            .from('lv_positionen')
            .select('id, artikelnummer, bezeichnung, listenpreis, preis')
            .eq('id', correction.korrekte_position_id)
            .single();

          if (lvPos) {
            // angewendet_count erhöhen (async, nicht blockierend)
            supabase.rpc('increment_correction_count', {
              p_correction_id: correction.correction_id
            }).then(() => {}).catch(() => {});

            const einzelpreis = Number(lvPos.listenpreis) || Number(lvPos.preis) || 0;
            matchedPositionen.push({
              ...pos,
              lv_position_id: lvPos.id,
              artikelnummer: lvPos.artikelnummer,
              bezeichnung: lvPos.bezeichnung,
              einzelpreis: einzelpreis,
              gesamtpreis: einzelpreis * pos.menge,
              similarity: correction.similarity_score,
              matched_via: 'learning'
            });
            continue;  // Nächste Position
          }
        }
      } catch (learningError) {
        // Learning-Suche fehlgeschlagen - weiter mit normalem Matching
        console.log(`[LV-Matching] Learning-Suche übersprungen:`, learningError);
      }

      // ========================================
      // STEP 1: Im spezifischen LV-Typ suchen
      // ========================================
      let { data: lvResults } = await supabase.rpc('search_lv_positions', {
        query_embedding: embedding,
        match_count: 1,
        filter_lv_typ: lvTyp,
        filter_gewerk: null
      });

      let matchedLvTyp = lvTyp;

      // ========================================
      // STEP 2: Cross-LV-Suche oder Fallback
      // ========================================
      if (!lvResults || lvResults.length === 0 || lvResults[0].similarity < SIMILARITY_THRESHOLD) {

        if (searchAllLvs) {
          // Cross-LV-Suche: In ALLEN LVs suchen und bestes Ergebnis nehmen
          console.log(`[LV-Matching] Cross-LV-Suche für: ${searchText.substring(0, 50)}...`);
          const { data: allResults } = await supabase.rpc('search_lv_positions', {
            query_embedding: embedding,
            match_count: 3,
            filter_lv_typ: null,  // Kein Filter = alle LVs
            filter_gewerk: null
          });

          if (allResults && allResults.length > 0 && allResults[0].similarity >= SIMILARITY_THRESHOLD) {
            lvResults = [allResults[0]];  // Bestes Ergebnis
            matchedLvTyp = allResults[0].lv_typ || 'unbekannt';
            console.log(`[LV-Matching] Cross-LV Match in "${matchedLvTyp}": sim=${allResults[0].similarity.toFixed(3)}`);
          }
        } else {
          // Standard-Fallback: GWS → neurealis
          if (lvTyp !== 'GWS') {
            console.log(`[LV-Matching] Fallback auf GWS für: ${searchText.substring(0, 50)}...`);
            const { data: gwsResults } = await supabase.rpc('search_lv_positions', {
              query_embedding: embedding,
              match_count: 1,
              filter_lv_typ: 'GWS',
              filter_gewerk: null
            });

            if (gwsResults && gwsResults.length > 0 && gwsResults[0].similarity >= SIMILARITY_THRESHOLD) {
              lvResults = gwsResults;
              matchedLvTyp = 'GWS';
            }
          }

          // Fallback auf neurealis wenn immer noch kein Match
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
              matchedLvTyp = 'neurealis';
            }
          }
        }
      }

      // ========================================
      // Ergebnis verarbeiten
      // ========================================
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
          similarity: Number(best.similarity),
          matched_via: 'embedding',
          matched_lv_typ: matchedLvTyp
        });

        console.log(`[LV-Matching] Match gefunden: "${pos.beschreibung.substring(0, 30)}..." → "${best.bezeichnung?.substring(0, 30)}..." (${matchedLvTyp}, sim=${best.similarity.toFixed(3)}, EP=${einzelpreis}€)`);
      } else {
        // Kein Match - Position ohne Preis hinzufügen
        console.log(`[LV-Matching] Kein Match für: "${pos.beschreibung.substring(0, 50)}..."`);
        matchedPositionen.push({
          ...pos,
          einzelpreis: 0,
          gesamtpreis: 0,
          similarity: lvResults?.[0]?.similarity || 0,
          matched_via: 'none'
        });
      }
    } catch (e) {
      console.error(`[LV-Matching] Fehler bei Position "${pos.beschreibung}":`, e);
      matchedPositionen.push({
        ...pos,
        einzelpreis: 0,
        gesamtpreis: 0,
        matched_via: 'error'
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
  atbsNummer: string,
  originalEingabe?: string  // Optional: Original-Spracheingabe
): Promise<ParsedNachtragResult> {
  // 0. Original-Eingabe speichern
  const origText = originalEingabe || beschreibung;

  // 1. LV-Override aus Text erkennen (z.B. "nutze LV der GWS")
  const lvOverride = detectLvOverride(beschreibung);
  let lvOverrideDetected = false;

  // 2. LV-Typ ermitteln (Override hat Priorität)
  let lvTyp: string;
  if (lvOverride) {
    lvTyp = lvOverride;
    lvOverrideDetected = true;
    console.log(`[LV-Matching] LV-Override aus Text erkannt: "${lvTyp}"`);
  } else {
    lvTyp = await getLvTypFromProjekt(atbsNummer);
  }

  console.log(`[LV-Matching] Starte Verarbeitung für ${atbsNummer} mit LV-Typ: ${lvTyp}`);

  // 3. Cross-LV-Suche aktivieren? (wenn "in allen LVs" oder "überall" im Text)
  const searchAllLvs = /(?:in\s+allen|alle)\s+lv|überall\s+(?:suchen|nachschauen)|cross[\s-]?lv/i.test(beschreibung);
  if (searchAllLvs) {
    console.log(`[LV-Matching] Cross-LV-Suche aktiviert`);
  }

  // 4. Positionen parsen
  const parsedPositionen = await parseNachtragPositionen(beschreibung, lvTyp);

  // 5. LV-Matching (mit Learning-Support und optionaler Cross-LV-Suche)
  const matchedPositionen = await matchLvPositionen(parsedPositionen, lvTyp, searchAllLvs);

  // 6. Summe berechnen
  const summeNetto = matchedPositionen.reduce((sum, pos) => sum + (pos.gesamtpreis || 0), 0);

  console.log(`[LV-Matching] Fertig: ${matchedPositionen.length} Positionen, Summe: ${summeNetto.toFixed(2)}€`);

  return {
    positionen: matchedPositionen,
    summe_netto: summeNetto,
    lv_typ: lvTyp,
    original_eingabe: origText,
    lv_override_detected: lvOverrideDetected
  };
}
