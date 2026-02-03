/**
 * Intent Detection für Telegram Universal Voice
 *
 * Erkennt Befehle aus natürlicher Sprache (DE, RU, HU, RO, PL)
 * und extrahiert Projekt-Referenzen, Entities und Korrektur-Anweisungen.
 */

import { OPENAI_API_KEY } from '../constants.ts';

// ============================================
// Interfaces
// ============================================

export interface IntentAnalysis {
  intent: 'MANGEL_MELDEN' | 'NACHTRAG_ERFASSEN' | 'NACHWEIS_HOCHLADEN' |
          'PROJEKT_OEFFNEN' | 'LISTE_MAENGEL' | 'LISTE_NACHTRAEGE' |
          'STATUS_ABFRAGEN' | 'FOTO_HINZUFUEGEN' | 'KORREKTUR' |
          'ABBRECHEN' | 'UNBEKANNT';
  confidence: number;  // 0.0 - 1.0

  projekt?: {
    atbs?: string;         // "ATBS-456"
    search_term?: string;  // "Werner Hellweg" für Fuzzy-Suche
  };

  entities: Array<{
    beschreibung: string;
    gewerk?: string;       // Elektrik, Sanitär, etc.
    raum?: string;         // Bad, Küche, etc.
    menge?: number;
    einheit?: string;
  }>;

  nachweis_typ?: string;   // e-check, abdichtung, etc.
  detected_language: 'DE' | 'RU' | 'HU' | 'RO' | 'PL';
  is_followup: boolean;    // "noch einer" erkannt

  correction?: {
    field: string;         // "raum", "gewerk"
    new_value: string;
  };
}

// ============================================
// Intent-Trigger Keywords (mehrsprachig)
// ============================================

const INTENT_TRIGGERS = {
  MANGEL_MELDEN: {
    DE: ['mangel', 'defekt', 'kaputt', 'fehler', 'problem', 'schaden', 'reparatur', 'beschädigt'],
    RU: ['дефект', 'проблема', 'сломан', 'повреждение', 'неисправность'],
    HU: ['hiba', 'defekt', 'probléma', 'törött', 'rongált'],
    RO: ['defect', 'problemă', 'stricat', 'deteriorat'],
    PL: ['usterka', 'defekt', 'problem', 'zepsuty', 'uszkodzony']
  },
  NACHTRAG_ERFASSEN: {
    DE: ['nachtrag', 'zusätzlich', 'extra', 'mehr', 'weitere', 'ergänzung', 'zusatzleistung'],
    RU: ['дополнительно', 'ещё', 'добавить'],
    HU: ['pótmunka', 'további', 'kiegészítés'],
    RO: ['suplimentar', 'adițional', 'în plus'],
    PL: ['dodatkowy', 'więcej', 'uzupełnienie']
  },
  NACHWEIS_HOCHLADEN: {
    DE: ['nachweis', 'e-check', 'abdichtung', 'protokoll', 'prüfung', 'dokumentation', 'zertifikat'],
    RU: ['протокол', 'проверка', 'документ', 'сертификат'],
    HU: ['igazolás', 'jegyzőkönyv', 'tanúsítvány'],
    RO: ['certificat', 'protocol', 'document'],
    PL: ['protokół', 'certyfikat', 'dokument']
  },
  PROJEKT_OEFFNEN: {
    DE: ['öffne', 'zeige', 'gehe zu', 'projekt', 'baustelle', 'wechsel zu'],
    RU: ['открой', 'покажи', 'проект'],
    HU: ['nyisd meg', 'mutasd', 'projekt'],
    RO: ['deschide', 'arată', 'proiect'],
    PL: ['otwórz', 'pokaż', 'projekt']
  },
  LISTE_MAENGEL: {
    DE: ['mängel', 'mängelliste', 'offene mängel', 'zeige mängel'],
    RU: ['дефекты', 'список дефектов'],
    HU: ['hibák', 'hibalista'],
    RO: ['defecte', 'lista defecte'],
    PL: ['usterki', 'lista usterek']
  },
  LISTE_NACHTRAEGE: {
    DE: ['nachträge', 'nachtragsliste', 'offene nachträge', 'zeige nachträge'],
    RU: ['дополнения', 'список дополнений'],
    HU: ['pótmunkák', 'pótmunkalista'],
    RO: ['suplimente', 'lista suplimente'],
    PL: ['dodatki', 'lista dodatków']
  },
  STATUS_ABFRAGEN: {
    DE: ['status', 'wie weit', 'stand', 'fortschritt'],
    RU: ['статус', 'прогресс'],
    HU: ['állapot', 'státusz'],
    RO: ['status', 'stare'],
    PL: ['status', 'stan']
  },
  FOTO_HINZUFUEGEN: {
    DE: ['foto', 'bild', 'hinzufügen', 'anhängen'],
    RU: ['фото', 'фотография', 'добавить'],
    HU: ['fotó', 'kép', 'hozzáadás'],
    RO: ['foto', 'poză', 'adăugare'],
    PL: ['zdjęcie', 'foto', 'dodaj']
  },
  KORREKTUR: {
    DE: ['nein', 'falsch', 'korrigiere', 'ändere', 'nicht richtig', 'korrektur'],
    RU: ['нет', 'неправильно', 'исправь'],
    HU: ['nem', 'rossz', 'javítsd'],
    RO: ['nu', 'greșit', 'corectează'],
    PL: ['nie', 'źle', 'popraw']
  },
  ABBRECHEN: {
    DE: ['abbrechen', 'stopp', 'stop', 'beenden', 'zurück', 'cancel'],
    RU: ['отмена', 'стоп', 'назад'],
    HU: ['mégse', 'stop', 'vissza'],
    RO: ['anulează', 'stop', 'înapoi'],
    PL: ['anuluj', 'stop', 'cofnij']
  }
};

// ============================================
// Gewerk-Keywords (für Klassifizierung)
// ============================================

const GEWERK_KEYWORDS: Record<string, string[]> = {
  'Elektrik': ['steckdose', 'licht', 'kabel', 'strom', 'schalter', 'lampe', 'sicherung', 'elektro', 'leitung', 'dose', 'verteiler'],
  'Sanitär': ['wc', 'dusche', 'waschbecken', 'rohr', 'tropft', 'wasserhahn', 'abfluss', 'toilette', 'bad', 'armatur', 'siphon', 'klospülung'],
  'Maler': ['farbe', 'anstrich', 'tapete', 'streichen', 'weiß', 'malen', 'lack', 'grundierung', 'spachteln'],
  'Boden': ['fliese', 'boden', 'vinyl', 'laminat', 'parkett', 'estrich', 'fußboden', 'sockelleiste', 'bodenfliese'],
  'Türen': ['tür', 'zarge', 'schloss', 'drücker', 'klinke', 'türblatt', 'schwelle', 'türrahmen'],
  'Fenster': ['fenster', 'rolladen', 'jalousie', 'fensterbrett', 'verglasung', 'griff', 'dichtung'],
  'Heizung': ['heizung', 'heizkörper', 'therme', 'thermostat', 'ventil', 'heizungsrohr', 'radiator'],
  'Trockenbau': ['wand', 'decke', 'riss', 'rigips', 'gipskarton', 'abhängen', 'spachtel', 'profil'],
  'Abbruch': ['abriss', 'entkernung', 'demontage', 'abbruch', 'entfernen']
};

// ============================================
// Raum-Keywords
// ============================================

const RAUM_KEYWORDS = ['bad', 'küche', 'flur', 'wohnzimmer', 'schlafzimmer', 'keller', 'balkon', 'kinderzimmer', 'arbeitszimmer', 'diele', 'abstellraum', 'gäste-wc', 'wc'];

// ============================================
// Followup-Keywords
// ============================================

const FOLLOWUP_KEYWORDS = {
  DE: ['noch einer', 'auch noch', 'und', 'außerdem', 'zusätzlich noch', 'dazu noch'],
  RU: ['ещё один', 'также', 'и', 'кроме того'],
  HU: ['még egy', 'és', 'ezen kívül'],
  RO: ['încă unul', 'și', 'de asemenea'],
  PL: ['jeszcze jeden', 'i', 'ponadto']
};

// ============================================
// Nachweis-Typ Keywords
// ============================================

const NACHWEIS_TYP_KEYWORDS: Record<string, string[]> = {
  'e-check': ['e-check', 'echeck', 'e check', 'elektroprüfung', 'elektro-check'],
  'abdichtung': ['abdichtung', 'dichtigkeit', 'dichtung bad', 'badabdichtung'],
  'rohinstallation_elektrik': ['rohinstallation elektrik', 'rohinstall elektrik', 'elektro rohinstall'],
  'rohinstallation_sanitaer': ['rohinstallation sanitär', 'rohinstall sanitär', 'sanitär rohinstall'],
  'brandschutz': ['brandschutz', 'feuerschutz', 'brandschutzprotokoll']
};

// ============================================
// Hilfsfunktionen
// ============================================

function detectLanguage(text: string): 'DE' | 'RU' | 'HU' | 'RO' | 'PL' {
  const lowerText = text.toLowerCase();

  // Russisch erkennen (kyrillische Zeichen)
  if (/[\u0400-\u04FF]/.test(text)) return 'RU';

  // Ungarisch erkennen (spezifische Zeichen)
  if (/[őűáéíóúüöÁÉÍÓÚÜÖŐŰ]/.test(text) && /\b(és|van|nem|igen)\b/i.test(text)) return 'HU';

  // Rumänisch erkennen
  if (/[ăîâșț]/i.test(text) || /\b(și|este|nu|da)\b/i.test(text)) return 'RO';

  // Polnisch erkennen
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text) || /\b(jest|nie|tak|czy)\b/i.test(text)) return 'PL';

  // Default: Deutsch
  return 'DE';
}

function extractAtbsNummer(text: string): string | undefined {
  // ATBS-Pattern: "ATBS-456", "ATBS 456", "atbs456"
  const atbsMatch = text.match(/ATBS[- ]?(\d{3,4})/i);
  if (atbsMatch) {
    return `ATBS-${atbsMatch[1]}`;
  }

  // Nur Nummer am Anfang: "456 Elektrik fertig"
  const numMatch = text.match(/^(\d{3,4})\b/);
  if (numMatch) {
    return `ATBS-${numMatch[1]}`;
  }

  return undefined;
}

function extractGewerk(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const [gewerk, keywords] of Object.entries(GEWERK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return gewerk;
      }
    }
  }

  return undefined;
}

function extractRaum(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const raum of RAUM_KEYWORDS) {
    if (lowerText.includes(raum)) {
      // Capitalize first letter
      return raum.charAt(0).toUpperCase() + raum.slice(1);
    }
  }

  return undefined;
}

function extractNachweisTyp(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const [typ, keywords] of Object.entries(NACHWEIS_TYP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return typ;
      }
    }
  }

  return undefined;
}

function checkFollowup(text: string, language: 'DE' | 'RU' | 'HU' | 'RO' | 'PL'): boolean {
  const lowerText = text.toLowerCase();
  const keywords = FOLLOWUP_KEYWORDS[language];

  return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
}

function detectIntentFromKeywords(text: string, language: 'DE' | 'RU' | 'HU' | 'RO' | 'PL'): { intent: IntentAnalysis['intent']; confidence: number } {
  const lowerText = text.toLowerCase();

  // Prüfe jeden Intent-Typ
  for (const [intentName, triggers] of Object.entries(INTENT_TRIGGERS)) {
    const langTriggers = triggers[language] || triggers.DE;

    for (const trigger of langTriggers) {
      if (lowerText.includes(trigger.toLowerCase())) {
        return {
          intent: intentName as IntentAnalysis['intent'],
          confidence: 0.7 // Keyword-basiert = mittlere Confidence
        };
      }
    }
  }

  return { intent: 'UNBEKANNT', confidence: 0 };
}

// ============================================
// Haupt-Funktion: analyzeIntent
// ============================================

export async function analyzeIntent(
  text: string,
  session: { aktuelles_bv_id?: string; letzte_aktion?: Record<string, unknown> }
): Promise<IntentAnalysis> {
  console.log('[Intent] Analysiere Text:', text);

  // Sprache erkennen
  const detected_language = detectLanguage(text);
  console.log('[Intent] Erkannte Sprache:', detected_language);

  // Fallback-Analyse mit Keywords
  const keywordAnalysis = detectIntentFromKeywords(text, detected_language);
  const is_followup = checkFollowup(text, detected_language);

  // Projekt-Extraktion
  const atbs = extractAtbsNummer(text);

  // Wenn ATBS am Anfang und Rest ist Beschreibung → Projekt-Kontext
  let search_term: string | undefined;
  if (!atbs) {
    // Versuche Adresse/Name zu extrahieren (alles was kein ATBS ist)
    const potentialSearchTerm = text.replace(/^(öffne|zeige|gehe zu|projekt|baustelle)\s*/i, '').trim();
    if (potentialSearchTerm.length > 2 && !/^\d+$/.test(potentialSearchTerm)) {
      search_term = potentialSearchTerm;
    }
  }

  // Lokale Extraktion für schnelle Fälle
  const localGewerk = extractGewerk(text);
  const localRaum = extractRaum(text);
  const nachweis_typ = extractNachweisTyp(text);

  // Wenn Keyword-Analyse gut genug ist (z.B. klare Keywords), nutze sie direkt
  if (keywordAnalysis.confidence >= 0.7 && keywordAnalysis.intent !== 'UNBEKANNT') {
    console.log('[Intent] Keyword-basierte Erkennung:', keywordAnalysis.intent);

    return {
      intent: keywordAnalysis.intent,
      confidence: keywordAnalysis.confidence,
      projekt: atbs || search_term ? { atbs, search_term } : undefined,
      entities: [{
        beschreibung: text,
        gewerk: localGewerk,
        raum: localRaum
      }],
      nachweis_typ,
      detected_language,
      is_followup
    };
  }

  // GPT-5.2 für komplexere Analyse
  try {
    console.log('[Intent] GPT-5.2 Analyse wird gestartet...');

    const systemPrompt = `Du bist ein Intent-Erkennungs-System für einen Telegram-Bot auf deutschen Baustellen (Wohnungssanierung).

AUFGABE: Analysiere die Eingabe und extrahiere strukturierte Informationen.

INTENTS:
- MANGEL_MELDEN: Defekt, Problem, Schaden melden
- NACHTRAG_ERFASSEN: Zusätzliche Leistung erfassen
- NACHWEIS_HOCHLADEN: Prüfprotokoll, E-Check, Abdichtung
- PROJEKT_OEFFNEN: Zu einem Projekt wechseln
- LISTE_MAENGEL: Mängelliste anzeigen
- LISTE_NACHTRAEGE: Nachtragsliste anzeigen
- STATUS_ABFRAGEN: Projektstatus abfragen
- FOTO_HINZUFUEGEN: Foto zu bestehendem Eintrag
- KORREKTUR: Vorherige Eingabe korrigieren
- ABBRECHEN: Aktion abbrechen
- UNBEKANNT: Nicht erkennbar

GEWERKE: Elektrik, Sanitär, Maler, Boden, Türen, Fenster, Heizung, Trockenbau, Abbruch

RÄUME: Bad, Küche, Flur, Wohnzimmer, Schlafzimmer, Keller, Balkon, Kinderzimmer

PROJEKT-KONTEXT:
${session.aktuelles_bv_id ? `Aktuell geöffnetes Projekt: ${session.aktuelles_bv_id}` : 'Kein Projekt geöffnet'}
${session.letzte_aktion ? `Letzte Aktion: ${JSON.stringify(session.letzte_aktion)}` : ''}

SPRACHEN: Der Input kann auf DE, RU, HU, RO oder PL sein. Übersetze intern und antworte auf Deutsch im JSON.

WICHTIG für "beschreibung" in entities:
- NUR den inhaltlichen Teil speichern, NICHT den Intent-Teil oder Projekt-Referenzen
- "Ergänze Mangel zu ATBS 456. Heizkörper wackelt" → beschreibung: "Heizkörper wackelt"
- "Mangel melden für 448: Steckdose locker" → beschreibung: "Steckdose locker"
- "Nachtrag 3 Steckdosen Küche für 448" → beschreibung: "3 Steckdosen Küche"
- Intent-Wörter (Mangel, Nachtrag, ergänze, melde, etc.) und Projekt-Referenzen WEGLASSEN
- NUR die eigentliche Beschreibung des Problems/der Leistung zurückgeben

BEISPIELE:
- "456 Steckdose locker Bad" → MANGEL_MELDEN, ATBS-456, Elektrik, Bad, beschreibung: "Steckdose locker Bad"
- "Ergänze Mangel zu ATBS 456. Heizkörper im Bad wackelt" → MANGEL_MELDEN, ATBS-456, Heizung, Bad, beschreibung: "Heizkörper im Bad wackelt"
- "Nachtrag 3 Steckdosen Küche" → NACHTRAG_ERFASSEN, Elektrik, Küche, Menge 3, Einheit Stk, beschreibung: "3 Steckdosen Küche"
- "Öffne Bollwerkstraße" → PROJEKT_OEFFNEN, search_term: "Bollwerkstraße"
- "noch einer im Flur" → is_followup: true, Raum: Flur
- "nein, das war im Bad nicht Küche" → KORREKTUR, field: "raum", new_value: "Bad"

Antworte NUR mit validem JSON im folgenden Format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "projekt": { "atbs": "ATBS-XXX" oder null, "search_term": "..." oder null },
  "entities": [{ "beschreibung": "...", "gewerk": "...", "raum": "...", "menge": ..., "einheit": "..." }],
  "nachweis_typ": "..." oder null,
  "detected_language": "DE|RU|HU|RO|PL",
  "is_followup": true/false,
  "correction": { "field": "...", "new_value": "..." } oder null
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Intent] OpenAI API Fehler:', response.status, errorText);
      throw new Error(`OpenAI API Fehler: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Intent] Keine Antwort von GPT');
      throw new Error('Keine Antwort von GPT');
    }

    console.log('[Intent] GPT Antwort:', content);

    const parsed = JSON.parse(content);

    // Validierung und Normalisierung
    const validIntents = [
      'MANGEL_MELDEN', 'NACHTRAG_ERFASSEN', 'NACHWEIS_HOCHLADEN',
      'PROJEKT_OEFFNEN', 'LISTE_MAENGEL', 'LISTE_NACHTRAEGE',
      'STATUS_ABFRAGEN', 'FOTO_HINZUFUEGEN', 'KORREKTUR',
      'ABBRECHEN', 'UNBEKANNT'
    ];

    const result: IntentAnalysis = {
      intent: validIntents.includes(parsed.intent) ? parsed.intent : 'UNBEKANNT',
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      detected_language: ['DE', 'RU', 'HU', 'RO', 'PL'].includes(parsed.detected_language)
        ? parsed.detected_language
        : detected_language,
      is_followup: Boolean(parsed.is_followup)
    };

    // Optionale Felder
    if (parsed.projekt?.atbs || parsed.projekt?.search_term) {
      result.projekt = {
        atbs: parsed.projekt.atbs || undefined,
        search_term: parsed.projekt.search_term || undefined
      };
    }

    if (parsed.nachweis_typ) {
      result.nachweis_typ = parsed.nachweis_typ;
    }

    if (parsed.correction?.field && parsed.correction?.new_value) {
      result.correction = {
        field: parsed.correction.field,
        new_value: parsed.correction.new_value
      };
    }

    console.log('[Intent] Ergebnis:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('[Intent] Fehler bei GPT-Analyse:', error);

    // Fallback auf Keyword-Analyse
    console.log('[Intent] Fallback auf Keyword-Analyse');

    return {
      intent: keywordAnalysis.intent,
      confidence: keywordAnalysis.confidence * 0.8, // Reduziere Confidence im Fallback
      projekt: atbs || search_term ? { atbs, search_term } : undefined,
      entities: [{
        beschreibung: text,
        gewerk: localGewerk,
        raum: localRaum
      }],
      nachweis_typ,
      detected_language,
      is_followup
    };
  }
}

// ============================================
// Beschreibungs-Extraktion (Intent-Patterns entfernen)
// ============================================

/**
 * Extrahiert die reine Beschreibung aus Text, entfernt Intent-Patterns
 * "Ergänze Mangel zu ATBS 456. Heizkörper wackelt" → "Heizkörper wackelt"
 * "Nachtrag 3 Steckdosen Küche für 448" → "3 Steckdosen Küche"
 */
export function extractDescriptionFromText(text: string): string {
  let result = text;

  // Intent-Patterns die entfernt werden (in Reihenfolge anwenden)
  const patterns = [
    // Mangel-Intents
    /^(ergänze|neuer?|melde|erstelle)?\s*mangel\s*(zu|für|bei|in)?\s*/gi,
    // Nachtrag-Intents
    /^(ergänze|neuer?|erfasse|erstelle)?\s*nachtrag\s*(zu|für|bei|in)?\s*/gi,
    // ATBS-Referenzen am Anfang
    /^(für\s+)?(projekt\s+)?atbs[- ]?\d{3,4}[.,:;]?\s*/gi,
    /^\d{3,4}[.,:;]?\s+/gi,
    // Followup-Patterns
    /^(noch\s*(ein(er)?|einen?)|und\s+noch|außerdem|dazu|zusätzlich)[.,:;]?\s*/gi,
    // Allgemeine Präfixe
    /^(bitte\s+)?(erfasse|speichere|notiere)[.,:;]?\s*/gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }

  // Führende Satzzeichen entfernen
  result = result.replace(/^[.,:;!?\s]+/, '');

  return result.trim() || text; // Fallback auf Original wenn leer
}

// ============================================
// Hilfsfunktion: Quick Intent (ohne GPT)
// ============================================

export function quickIntentCheck(text: string): IntentAnalysis['intent'] | null {
  const lowerText = text.toLowerCase();

  // Schnelle Checks für eindeutige Fälle
  if (/^\/?(abbrechen|cancel|stop)/i.test(text)) return 'ABBRECHEN';
  if (/^\/?(mängel|maengel)$/i.test(text)) return 'LISTE_MAENGEL';
  if (/^\/?(nachträge|nachtraege)$/i.test(text)) return 'LISTE_NACHTRAEGE';
  if (/^\/?(status)$/i.test(text)) return 'STATUS_ABFRAGEN';
  if (/^(nein|falsch|korrigier)/i.test(text)) return 'KORREKTUR';

  // Projekt öffnen Pattern
  if (/^(öffne|zeige|gehe zu)\s+/i.test(text)) return 'PROJEKT_OEFFNEN';
  if (/^(status|zeige)\s+\d{3,4}/i.test(text)) return 'PROJEKT_OEFFNEN';

  return null;
}
