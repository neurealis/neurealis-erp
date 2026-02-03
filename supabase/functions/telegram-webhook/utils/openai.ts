/**
 * OpenAI API Utilities
 */
import { OPENAI_API_KEY } from "../constants.ts";
import type { ParsedMaengel } from "../types.ts";

/**
 * Transkribiert eine Sprachnachricht mit OpenAI Whisper
 */
export async function transcribeVoice(
  base64Audio: string,
  mimeType: string = 'audio/ogg'
): Promise<string | null> {
  try {
    // Base64 zu Uint8Array konvertieren
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // FormData erstellen
    const formData = new FormData();
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp3') ? 'mp3' : 'm4a';
    formData.append('file', new Blob([bytes], { type: mimeType }), `voice.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'de');

    // API-Aufruf
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      console.error('Whisper error:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (e) {
    console.error('Transcribe error:', e);
    return null;
  }
}

/**
 * Parst und übersetzt Mängel-Text mit GPT-5.2
 *
 * - Erkennt die Sprache des Inputs (DE, RU, HU, RO, PL)
 * - Trennt mehrere Mängel in einzelne Einträge
 * - Übersetzt alles auf Deutsch
 * - Erkennt das Gewerk wenn möglich
 */
export async function parseAndTranslateMaengel(text: string): Promise<ParsedMaengel> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `Du bist ein Assistent für Baustellen-Mängelerfassung.
Der Benutzer beschreibt Mängel auf Deutsch, Russisch, Ungarisch, Rumänisch oder Polnisch.

Deine Aufgabe:
1. Erkenne die Sprache des Inputs
2. Trenne mehrere Mängel in einzelne Einträge
3. Übersetze alles auf Deutsch
4. Erkenne das Gewerk wenn möglich (Elektrik, Sanitär, Maler, Boden, Türen, Fenster, Heizung, Trockenbau, Sonstiges)

Antworte NUR mit JSON im Format:
{
  "detected_language": "DE|RU|HU|RO|PL",
  "maengel": [
    {"beschreibung_de": "Deutsche Beschreibung", "gewerk": "Elektrik"},
    ...
  ]
}`
          },
          {
            role: 'user',
            content: text
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error('GPT error:', await response.text());
      return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // JSON extrahieren
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        maengel: parsed.maengel || [{ beschreibung_de: text }],
        detected_language: parsed.detected_language || 'DE'
      };
    }

    return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
  } catch (e) {
    console.error('Parse error:', e);
    return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
  }
}

/**
 * Allgemeine GPT Chat-Completion
 */
export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model || 'gpt-5.2',
        max_completion_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      }),
    });

    if (!response.ok) {
      console.error('ChatCompletion error:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('ChatCompletion error:', e);
    return null;
  }
}

/**
 * Analysiert Bild mit GPT Vision (für OCR)
 */
export async function analyzeImage(
  base64Image: string,
  prompt: string,
  options?: {
    maxTokens?: number;
  }
): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: options?.maxTokens || 2000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: base64Image }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error('Vision error:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('Vision error:', e);
    return null;
  }
}
