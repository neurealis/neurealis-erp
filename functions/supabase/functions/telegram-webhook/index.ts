import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * telegram-webhook v50 - Dynamische gemeldet_von Erkennung
 *
 * KOMPLETT NEUER Bot: @neurealis_bedarfsanalyse_bot
 *
 * NEU in v50: Dynamische gemeldet_von Erkennung für Nachträge
 * - Lookup: chat_id in kontakte-Tabelle (telegram_chat_id)
 * - NU (Nachunternehmer) → gemeldet_von='nu'
 * - BL (Bauleiter) oder Holger Neumann → gemeldet_von='bauleiter'
 * - Fallback: 'telegram'
 *
 * v49: Baustellen-Features
 * - 🏗️ Baustelle öffnen: ATBS-Nummer eingeben oder aus Liste wählen
 * - 🔧 Mangel melden: Text/Sprache, KI-Splitting, mehrsprachig (DE, RU, HU, RO, PL)
 * - 📋 Nachtrag erfassen: Beschreibung + Foto
 * - 📸 Nachweis hochladen: Typ-Auswahl (Rohinstallation Elektrik/Sanitär, Abdichtung, E-Check)
 * - 📊 Status anzeigen: Projekt-Status, offene Mängel, Nachträge
 *
 * BESTEHENDE Features (aus v47):
 * - /start -> Hauptmenü: Aufmaß / Bedarfsanalyse / Baustelle
 * - Aufmaß-Modus: ATBS-Suche, Matterport-Link, CSV-Upload -> Excel
 * - Bedarfsanalyse-Modus: Foto -> OCR -> Review -> Odoo-Export
 * - /sync, /help, /status, /abbrechen
 */

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_NEUREALIS_BOT")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// Telegram API Helpers
// ============================================

async function sendMessage(chatId: number, text: string, options?: { reply_markup?: any; parse_mode?: string }) {
  const body: any = { chat_id: chatId, text, parse_mode: options?.parse_mode || "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) console.error("Telegram sendMessage error:", await response.text());
  return response;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}

async function sendDocument(chatId: number, fileBuffer: Uint8Array, filename: string, caption?: string) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([fileBuffer]), filename);
  if (caption) formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
    method: 'POST', body: formData,
  });
  if (!response.ok) console.error('Telegram sendDocument error:', await response.text());
  return response;
}

async function editMessageText(chatId: number, messageId: number, text: string, options?: { reply_markup?: any }) {
  const body: any = { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

async function downloadTelegramFile(fileId: string): Promise<{base64: string, mimeType: string} | null> {
  try {
    const fileResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileResp.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) return null;

    const downloadResp = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`);
    const arrayBuffer = await downloadResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return { base64, mimeType };
  } catch (e) {
    console.error('Error downloading file:', e);
    return null;
  }
}

// ============================================
// Session Management
// ============================================

async function getOrCreateSession(chatId: number, from?: any) {
  const { data } = await supabase.from("telegram_sessions").select("*").eq("chat_id", chatId).single();
  if (data) return data;
  const { data: newSession, error } = await supabase.from("telegram_sessions").insert({
    chat_id: chatId, user_id: from?.id?.toString(), username: from?.username,
    first_name: from?.first_name, last_name: from?.last_name,
  }).select().single();
  if (error) console.error("Error creating session:", error);
  return newSession;
}

async function updateSession(chatId: number, updates: Record<string, any>) {
  const { error } = await supabase.from("telegram_sessions").update({
    ...updates, last_activity: new Date().toISOString()
  }).eq("chat_id", chatId);
  if (error) console.error("Error updating session:", error);
}

// ============================================
// Helper: Extract ATBS from Monday column_values
// ============================================

function extractATBS(columnValues: any): string | null {
  if (!columnValues) return null;
  const text49 = columnValues.text49__1;
  if (!text49) return null;
  if (typeof text49 === 'string') return text49;
  if (typeof text49 === 'object' && text49.value) return text49.value;
  if (typeof text49 === 'object' && text49.text) return text49.text;
  return null;
}

function extractProjectName(columnValues: any): string | null {
  if (!columnValues) return null;
  const text23 = columnValues.text23__1;
  if (typeof text23 === 'string') return text23;
  if (typeof text23 === 'object' && text23.value) return text23.value;
  return null;
}

function extractPhase(columnValues: any): string | null {
  if (!columnValues) return null;
  const dropdown = columnValues.dropdown0__1;
  if (typeof dropdown === 'object' && dropdown.text) return dropdown.text;
  if (typeof dropdown === 'string') return dropdown;
  return null;
}

// ============================================
// OpenAI Whisper Integration (Sprache-zu-Text)
// ============================================

async function transcribeVoice(base64Audio: string, mimeType: string = 'audio/ogg'): Promise<string | null> {
  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const formData = new FormData();
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp3') ? 'mp3' : 'm4a';
    formData.append('file', new Blob([bytes], { type: mimeType }), `voice.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'de');

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

// ============================================
// OpenAI GPT-5.2 für Mangel-Splitting + Übersetzung
// ============================================

async function parseAndTranslateMaengel(text: string): Promise<{maengel: Array<{beschreibung_de: string, gewerk?: string}>, detected_language: string}> {
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

// ============================================
// Baustellen-Features: Projekt öffnen
// ============================================

async function showBaustellenMenu(chatId: number, session: any) {
  const bvId = session?.aktuelles_bv_id;
  const projektNr = session?.modus_daten?.projekt_nr;
  const projektName = session?.modus_daten?.projekt_name;

  if (bvId && projektNr) {
    await sendMessage(chatId,
      `<b>🏗️ Baustelle: ${projektNr}</b>\n` +
      `${projektName || ''}\n\n` +
      `Was möchtest du tun?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
        [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
        [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
        [{ text: "📊 Status anzeigen", callback_data: "bau:status" }],
        [{ text: "❌ Projekt schließen", callback_data: "bau:close" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  } else {
    await updateSession(chatId, { aktueller_modus: 'baustelle_suche', modus_daten: {} });
    await sendMessage(chatId,
      `<b>🏗️ Baustelle öffnen</b>\n\n` +
      `Gib eine ATBS-Nummer ein (z.B. ATBS-448) oder wähle aus der Liste:`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📋 Aktive Projekte anzeigen", callback_data: "bau:list" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  }
}

async function listActiveProjekte(chatId: number) {
  const { data: projekte, error } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Projekte gefunden.');
    return;
  }

  const aktiveProjekte = projekte.filter(p => {
    const phase = extractPhase(p.column_values);
    return phase && ['2', '3', '4'].some(ph => phase.includes(ph));
  }).slice(0, 10);

  if (aktiveProjekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Baustellen gefunden.');
    return;
  }

  const buttons = aktiveProjekte.map(p => {
    const atbs = extractATBS(p.column_values) || p.id.substring(0, 8);
    const name = (p.name || '').substring(0, 30);
    return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
  });
  buttons.push([{ text: "⬅️ Zurück", callback_data: "mode_baustelle" }]);

  await sendMessage(chatId,
    `<b>Aktive Baustellen (${aktiveProjekte.length}):</b>`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function searchAndOpenProjekt(chatId: number, searchTerm: string) {
  const term = searchTerm.trim().toUpperCase();

  const { data: projekte } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .limit(100);

  if (!projekte) {
    await sendMessage(chatId, 'Fehler bei der Projektsuche.');
    return;
  }

  const matches = projekte.filter(p => {
    const atbs = extractATBS(p.column_values) || '';
    const name = (p.name || '').toUpperCase();
    return atbs.includes(term) || name.includes(term);
  });

  if (matches.length === 0) {
    await sendMessage(chatId, `Kein Projekt gefunden für "${searchTerm}".\n\nVersuche eine ATBS-Nummer (z.B. ATBS-448).`);
    return;
  }

  if (matches.length === 1) {
    await openProjekt(chatId, matches[0]);
  } else {
    const buttons = matches.slice(0, 8).map(p => {
      const atbs = extractATBS(p.column_values) || p.id.substring(0, 8);
      const name = (p.name || '').substring(0, 30);
      return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
    });
    buttons.push([{ text: "⬅️ Abbrechen", callback_data: "mode_baustelle" }]);

    await sendMessage(chatId,
      `<b>${matches.length} Projekte gefunden:</b>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
}

async function openProjekt(chatId: number, projekt: any) {
  const atbs = extractATBS(projekt.column_values) || projekt.id.substring(0, 8);
  const projektName = projekt.name || extractProjectName(projekt.column_values) || '';
  const phase = extractPhase(projekt.column_values) || '?';

  await updateSession(chatId, {
    aktuelles_bv_id: projekt.id,
    aktueller_modus: 'baustelle',
    modus_daten: {
      projekt_nr: atbs,
      projekt_name: projektName,
      projekt_phase: phase
    }
  });

  await sendMessage(chatId,
    `<b>✅ Projekt geöffnet:</b>\n\n` +
    `ATBS: <b>${atbs}</b>\n` +
    `Name: ${projektName}\n` +
    `Phase: ${phase}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
      [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
      [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "📊 Status anzeigen", callback_data: "bau:status" }],
      [{ text: "❌ Projekt schließen", callback_data: "bau:close" }]
    ] } }
  );
}

async function closeProjekt(chatId: number) {
  await updateSession(chatId, {
    aktuelles_bv_id: null,
    aktueller_modus: null,
    modus_daten: {}
  });
  await sendMessage(chatId, '✅ Projekt geschlossen.\n\n/start für Hauptmenü.');
}

// ============================================
// Baustellen-Features: Mangel melden
// ============================================

async function startMangelMeldung(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'mangel_erfassen',
    modus_daten: {
      ...session?.modus_daten,
      mangel_fotos: []
    }
  });

  await sendMessage(chatId,
    `<b>🔧 Mangel melden für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Beschreibe den Mangel per Text oder Sprachnachricht.\n\n` +
    `💡 <i>Tipp: Du kannst mehrere Mängel auf einmal beschreiben - die werden automatisch getrennt.</i>\n` +
    `🌍 <i>Sprachen: Deutsch, Russisch, Ungarisch, Rumänisch, Polnisch</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleMangelText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  await sendMessage(chatId, '⏳ Mängel werden analysiert...');

  const { maengel, detected_language } = await parseAndTranslateMaengel(text);

  if (maengel.length === 0) {
    await sendMessage(chatId, 'Kein Mangel erkannt. Bitte beschreibe den Mangel genauer.');
    return;
  }

  const frist = new Date();
  frist.setDate(frist.getDate() + 7);

  const createdMaengel = [];
  for (const m of maengel) {
    const { data: newMangel, error } = await supabase
      .from('maengel_fertigstellung')
      .insert({
        projekt_nr: projektNr,
        beschreibung_mangel: m.beschreibung_de,
        art_des_mangels: m.gewerk || 'Sonstiges',
        status_mangel: 'Offen',
        datum_meldung: new Date().toISOString(),
        datum_frist: frist.toISOString(),
        erinnerung_status: 'Aktiv'
      })
      .select('id, mangel_id')
      .single();

    if (!error && newMangel) {
      createdMaengel.push({ ...newMangel, beschreibung: m.beschreibung_de, gewerk: m.gewerk });
    }
  }

  if (createdMaengel.length === 0) {
    await sendMessage(chatId, 'Fehler beim Speichern der Mängel. Bitte versuche es erneut.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'mangel_foto',
    modus_daten: {
      ...session?.modus_daten,
      created_maengel: createdMaengel
    }
  });

  let text_response = `<b>✅ ${createdMaengel.length} Mangel/Mängel erfasst:</b>\n\n`;
  if (detected_language !== 'DE') {
    text_response += `<i>(Erkannte Sprache: ${detected_language})</i>\n\n`;
  }
  for (const m of createdMaengel) {
    text_response += `• ${m.beschreibung} (${m.gewerk || 'Sonstiges'})\n`;
  }
  text_response += `\nFrist: ${frist.toLocaleDateString('de-DE')}\n\n`;
  text_response += `Möchtest du ein Foto hinzufügen?`;

  await sendMessage(chatId, text_response, {
    reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "mangel:add_foto" }],
      [{ text: "✅ Fertig (ohne Foto)", callback_data: "bau:menu" }]
    ] }
  });
}

async function handleMangelFoto(chatId: number, session: any, photos: any[]) {
  const createdMaengel = session?.modus_daten?.created_maengel || [];
  const projektNr = session?.modus_daten?.projekt_nr;

  if (createdMaengel.length === 0) {
    await sendMessage(chatId, '⚠️ Kein Mangel zum Verknüpfen. Bitte erst Mangel beschreiben.');
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${projektNr}_mangel_${Date.now()}.jpg`;
  const filePath = `maengel/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  const targetMangel = createdMaengel[0];
  await supabase
    .from('maengel_fertigstellung')
    .update({
      fotos_mangel: [{ url: publicUrl.publicUrl, filename }]
    })
    .eq('id', targetMangel.id);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    kategorie: 'mangel',
    mangel_id: targetMangel.id,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `✅ Foto gespeichert und mit Mangel verknüpft.\n\n` +
    `Weiteres Foto hinzufügen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Noch ein Foto", callback_data: "mangel:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Helper: Ermittle gemeldet_von basierend auf Kontakt
// ============================================

async function getGemeldetVon(chatId: number, session: any): Promise<{gemeldet_von: string, melder_name: string}> {
  try {
    // Lookup in kontakte-Tabelle via telegram_chat_id
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    if (kontakt) {
      const vollname = [kontakt.vorname, kontakt.nachname].filter(Boolean).join(' ');
      const rolle = (kontakt.rolle || '').toUpperCase();

      // Nachunternehmer
      if (rolle === 'NU') {
        return { gemeldet_von: 'nu', melder_name: vollname || 'Nachunternehmer' };
      }

      // Bauleiter oder Holger Neumann
      if (rolle === 'BL' ||
          (kontakt.vorname?.toLowerCase() === 'holger' && kontakt.nachname?.toLowerCase() === 'neumann')) {
        return { gemeldet_von: 'bauleiter', melder_name: vollname || 'Bauleiter' };
      }

      // Andere bekannte Kontakte
      return { gemeldet_von: 'telegram', melder_name: vollname || 'Telegram' };
    }
  } catch (e) {
    console.error('Error looking up kontakt:', e);
  }

  // Fallback: Telegram-Session Daten
  const sessionName = [session?.first_name, session?.last_name].filter(Boolean).join(' ');
  return { gemeldet_von: 'telegram', melder_name: sessionName || 'Telegram' };
}

// ============================================
// Baustellen-Features: Nachtrag erfassen
// ============================================

async function startNachtragErfassung(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachtrag_erfassen',
    modus_daten: {
      ...session?.modus_daten,
      nachtrag_fotos: []
    }
  });

  await sendMessage(chatId,
    `<b>📋 Nachtrag erfassen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Beschreibe den Nachtrag (was wurde zusätzlich beauftragt?):`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachtragText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  const { count } = await supabase
    .from('nachtraege')
    .select('id', { count: 'exact', head: true })
    .eq('atbs_nummer', projektNr);

  const nachtragNr = `NT-${projektNr}-${(count || 0) + 1}`;

  // Dynamische Ermittlung von gemeldet_von basierend auf Kontakt
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);
  console.log(`[v50] Nachtrag von chat_id=${chatId}: gemeldet_von=${gemeldet_von}, melder_name=${melder_name}`);

  const { data: newNachtrag, error } = await supabase
    .from('nachtraege')
    .insert({
      atbs_nummer: projektNr,
      nachtrag_nr: nachtragNr,
      beschreibung: text,
      status: 'Gemeldet',
      gemeldet_von: gemeldet_von,
      melder_name: melder_name
    })
    .select('id, nachtrag_nr')
    .single();

  if (error || !newNachtrag) {
    console.error('Nachtrag error:', error);
    await sendMessage(chatId, 'Fehler beim Speichern des Nachtrags.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachtrag_foto',
    modus_daten: {
      ...session?.modus_daten,
      nachtrag_id: newNachtrag.id,
      nachtrag_nr: newNachtrag.nachtrag_nr
    }
  });

  await sendMessage(chatId,
    `<b>✅ Nachtrag erfasst:</b>\n\n` +
    `Nr: <b>${nachtragNr}</b>\n` +
    `Beschreibung: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n\n` +
    `Möchtest du ein Foto hinzufügen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig (ohne Foto)", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachtragFoto(chatId: number, session: any, photos: any[]) {
  const nachtragId = session?.modus_daten?.nachtrag_id;
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachtragNr = session?.modus_daten?.nachtrag_nr;

  if (!nachtragId) {
    await sendMessage(chatId, '⚠️ Kein Nachtrag zum Verknüpfen. Bitte erst Nachtrag beschreiben.');
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${nachtragNr}_${Date.now()}.jpg`;
  const filePath = `nachtraege/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  const { data: nachtrag } = await supabase
    .from('nachtraege')
    .select('foto_urls')
    .eq('id', nachtragId)
    .single();

  const existingUrls = nachtrag?.foto_urls || [];
  await supabase
    .from('nachtraege')
    .update({ foto_urls: [...existingUrls, publicUrl.publicUrl] })
    .eq('id', nachtragId);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    kategorie: 'nachtrag',
    nachtrag_id: nachtragId,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `✅ Foto zum Nachtrag hinzugefügt.\n\n` +
    `Weiteres Foto?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Noch ein Foto", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Baustellen-Features: Nachweis hochladen
// ============================================

async function showNachweisTypen(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachweis_typ_wahl',
    modus_daten: session?.modus_daten
  });

  await sendMessage(chatId,
    `<b>📸 Nachweis hochladen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Welchen Nachweis möchtest du hochladen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⚡ Rohinstallation Elektrik", callback_data: "nachweis:rohinstall_elektrik" }],
      [{ text: "🚿 Rohinstallation Sanitär", callback_data: "nachweis:rohinstall_sanitaer" }],
      [{ text: "🛁 Abdichtung Bad", callback_data: "nachweis:abdichtung_bad" }],
      [{ text: "✅ E-Check Protokoll", callback_data: "nachweis:e_check" }],
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachweisTyp(chatId: number, session: any, typ: string) {
  const typLabels: Record<string, string> = {
    'rohinstall_elektrik': 'Rohinstallation Elektrik',
    'rohinstall_sanitaer': 'Rohinstallation Sanitär',
    'abdichtung_bad': 'Abdichtung Bad',
    'e_check': 'E-Check Protokoll'
  };

  await updateSession(chatId, {
    aktueller_modus: 'nachweis_foto',
    modus_daten: {
      ...session?.modus_daten,
      nachweis_typ: typ
    }
  });

  await sendMessage(chatId,
    `<b>📸 ${typLabels[typ] || typ}</b>\n\n` +
    `Sende jetzt das Foto des Nachweises:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:nachweis" }]
    ] } }
  );
}

async function handleNachweisFoto(chatId: number, session: any, photos: any[]) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachweisTyp = session?.modus_daten?.nachweis_typ;

  if (!nachweisTyp) {
    await sendMessage(chatId, '⚠️ Kein Nachweis-Typ gewählt. Bitte erst Typ auswählen.');
    await showNachweisTypen(chatId, session);
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${projektNr}_${nachweisTyp}_${Date.now()}.jpg`;
  const filePath = `nachweise/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'nachweis',
    nachweis_typ: nachweisTyp,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  const typLabels: Record<string, string> = {
    'rohinstall_elektrik': 'Rohinstallation Elektrik',
    'rohinstall_sanitaer': 'Rohinstallation Sanitär',
    'abdichtung_bad': 'Abdichtung Bad',
    'e_check': 'E-Check Protokoll'
  };

  await sendMessage(chatId,
    `<b>✅ Nachweis gespeichert!</b>\n\n` +
    `Typ: ${typLabels[nachweisTyp] || nachweisTyp}\n` +
    `Projekt: ${projektNr}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📸 Weiteren Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );

  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      nachweis_typ: null
    }
  });
}

// ============================================
// Baustellen-Features: Status anzeigen
// ============================================

async function showProjektStatus(chatId: number, session: any) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  if (!bvId || !projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

  const { count: maengelOffen } = await supabase
    .from('maengel_fertigstellung')
    .select('id', { count: 'exact', head: true })
    .eq('projekt_nr', projektNr)
    .not('status_mangel', 'ilike', '%abgenommen%');

  const { count: maengelGesamt } = await supabase
    .from('maengel_fertigstellung')
    .select('id', { count: 'exact', head: true })
    .eq('projekt_nr', projektNr);

  const { count: nachtraegeOffen } = await supabase
    .from('nachtraege')
    .select('id', { count: 'exact', head: true })
    .eq('atbs_nummer', projektNr)
    .in('status', ['Gemeldet', 'In Prüfung']);

  const { count: nachtraegeGesamt } = await supabase
    .from('nachtraege')
    .select('id', { count: 'exact', head: true })
    .eq('atbs_nummer', projektNr);

  const { count: nachweiseCount } = await supabase
    .from('fotos')
    .select('id', { count: 'exact', head: true })
    .eq('atbs_nummer', projektNr)
    .eq('kategorie', 'nachweis');

  const projektName = session?.modus_daten?.projekt_name || '';
  const phase = session?.modus_daten?.projekt_phase || '?';

  await sendMessage(chatId,
    `<b>📊 Status: ${projektNr}</b>\n` +
    `${projektName}\n\n` +
    `<b>Phase:</b> ${phase}\n\n` +
    `<b>🔧 Mängel:</b>\n` +
    `• Offen: ${maengelOffen || 0}\n` +
    `• Gesamt: ${maengelGesamt || 0}\n\n` +
    `<b>📋 Nachträge:</b>\n` +
    `• Offen: ${nachtraegeOffen || 0}\n` +
    `• Gesamt: ${nachtraegeGesamt || 0}\n\n` +
    `<b>📸 Nachweise:</b> ${nachweiseCount || 0}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Phase 2: Bedarfsanalyse Helpers (BESTEHEND)
// ============================================

function countCheckboxes(obj: Record<string, unknown>): number {
  let count = 0;
  for (const [key, value] of Object.entries(obj)) {
    if (['auftraggeber', 'pauschal_groesse', '_meta', 'header', 'eigentuemer', 'immobilie', 'zeitrahmen', 'budget', 'termin', 'sanierungsqualitaet', 'anforderungen_freitext'].includes(key)) continue;
    if (typeof value === 'boolean' && value === true) count++;
    else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countCheckboxes(value as Record<string, unknown>);
    }
  }
  return count;
}

async function handleOcrResult(chatId: number, bedarfsanalyseId: string) {
  const { data: ba, error } = await supabase
    .from('bedarfsanalysen')
    .select('id, auftraggeber, pauschal_groesse, status, ocr_structured')
    .eq('id', bedarfsanalyseId).single();
  if (error || !ba) { await sendMessage(chatId, `Fehler beim Laden der Bedarfsanalyse.`); return; }

  if (ba.status === 'needs_auftraggeber' || !ba.auftraggeber) {
    await sendMessage(chatId,
      `<b>OCR abgeschlossen</b>\n\nDer Auftraggeber konnte nicht erkannt werden.\nBitte wähle den Auftraggeber:`,
      { reply_markup: { inline_keyboard: [
        [{ text: "VBW", callback_data: `set_auftraggeber:${bedarfsanalyseId}:VBW` },
         { text: "GWS", callback_data: `set_auftraggeber:${bedarfsanalyseId}:GWS` },
         { text: "Privat", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Privat` }],
        [{ text: "Covivio", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Covivio` },
         { text: "Zander", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Zander` },
         { text: "WBG Lünen", callback_data: `set_auftraggeber:${bedarfsanalyseId}:WBG Lünen` }]
      ] } }
    );
    return;
  }

  const props = ba.ocr_structured?.properties || ba.ocr_structured || {};
  const atbs = props.header?.atbs_nr || '?';
  const checkboxCount = countCheckboxes(props);
  const ag = (ba.auftraggeber || '').toUpperCase();
  let abrechnungsart = 'Aufmaß';
  if (ag === 'VBW') abrechnungsart = 'Pauschal';
  else if ((ag === 'GWS' || ag === 'COVIVIO') && ba.pauschal_groesse) abrechnungsart = `Pauschal (${ba.pauschal_groesse})`;
  else if (ag === 'PRIVAT') abrechnungsart = 'Nach Aufmaß';
  else if (!ba.pauschal_groesse) abrechnungsart = 'Nach Aufmaß';
  else abrechnungsart = `Pauschal (${ba.pauschal_groesse})`;

  let aufmassWarnung = '';
  if (abrechnungsart.includes('Aufmaß') && atbs !== '?') {
    const { data: aufmass } = await supabase.from('aufmass_data').select('id').eq('atbs_nummer', atbs).limit(1).single();
    if (!aufmass) aufmassWarnung = `\n\n⚠️ <b>WARNUNG:</b> Keine Aufmaßdaten für ${atbs} vorhanden! Mengen werden geschätzt.`;
  }

  await sendMessage(chatId,
    `<b>OCR abgeschlossen</b>\n\n` +
    `Auftraggeber: <b>${ba.auftraggeber}</b>\n` +
    `ATBS: ${atbs}\nPauschal-Größe: ${ba.pauschal_groesse || 'nicht angekreuzt'}\n` +
    `Abrechnungsart: <b>${abrechnungsart}</b>\n` +
    `Erkannte Checkboxen: ${checkboxCount}` + aufmassWarnung +
    `\n\nAngebot wird erstellt...`
  );

  await callFinalizeAngebot(chatId, bedarfsanalyseId);
}

async function callFinalizeAngebot(chatId: number, bedarfsanalyseId: string) {
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/finalize-angebot`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ bedarfsanalyse_id: bedarfsanalyseId }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.draft_id) {
        if (result.aufmass_missing) {
          await sendMessage(chatId,
            `⚠️ <b>Achtung:</b> Aufmaß-Abrechnung gewählt, aber keine Aufmaßdaten vorhanden!\nMengen werden auf 1 geschätzt.`);
        }
        await updateSession(chatId, {
          aktueller_modus: 'bedarfsanalyse_review',
          modus_daten: { draft_id: result.draft_id, bedarfsanalyse_id: bedarfsanalyseId }
        });
        await showAngebotSummary(chatId, result.draft_id);
      } else {
        await sendMessage(chatId, `Fehler bei Angebotserstellung: ${result.error || 'Unbekannt'}`);
      }
    } else {
      await sendMessage(chatId, `Fehler bei Angebotserstellung (HTTP ${response.status})`);
    }
  } catch (e) {
    console.error('Error calling finalize-angebot:', e);
    await sendMessage(chatId, `Fehler beim Aufruf von finalize-angebot`);
  }
}

async function showAngebotSummary(chatId: number, draftId: string) {
  const { data: draft } = await supabase
    .from('angebots_drafts')
    .select('*, bedarfsanalysen!inner(auftraggeber, pauschal_groesse, ocr_structured)')
    .eq('id', draftId).single();
  if (!draft) { await sendMessage(chatId, `Angebot nicht gefunden.`); return; }

  const ba = (draft as any).bedarfsanalysen;
  const ag = (ba?.auftraggeber || '').toUpperCase();
  let abrechnungsInfo = '';
  if (ag === 'VBW') abrechnungsInfo = 'Pauschal (VBW)';
  else if ((ag === 'GWS' || ag === 'COVIVIO') && ba?.pauschal_groesse) abrechnungsInfo = `Pauschal ${ba.pauschal_groesse}`;
  else if (ag === 'PRIVAT') abrechnungsInfo = 'Nach Aufmaß';
  else abrechnungsInfo = ba?.pauschal_groesse ? `Pauschal ${ba.pauschal_groesse}` : 'Nach Aufmaß';

  const { count: posCount } = await supabase
    .from('angebots_positionen').select('id', { count: 'exact', head: true }).eq('draft_id', draftId);

  await sendMessage(chatId,
    `<b>Angebots-Zusammenfassung</b>\n\n` +
    `Auftraggeber: <b>${ba?.auftraggeber || draft.lv_typ}</b>\n` +
    `Abrechnungsart: <b>${abrechnungsInfo}</b>\n` +
    `Positionen: ${posCount || 0}\n` +
    `Netto: ${Number(draft.summe_netto).toFixed(2)} €\n` +
    `Brutto: ${Number(draft.summe_brutto).toFixed(2)} € (19% MwSt)\n` +
    `Status: ${draft.status}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📝 Alle Positionen anzeigen", callback_data: `angebot:list:${draftId}` }],
      [{ text: "✅ Angebot bestätigen", callback_data: `angebot:confirm:${draftId}` }],
      [{ text: "❌ Angebot verwerfen", callback_data: `angebot:discard:${draftId}` }],
    ] } }
  );
}

// ============================================
// Phase 1: Aufmaß Helpers (BESTEHEND)
// ============================================

async function searchMatterportProject(chatId: number, searchTerm: string) {
  const term = searchTerm.trim();
  const { data: results, error } = await supabase
    .from('matterport_spaces')
    .select('*')
    .or(`atbs_nummer.ilike.%${term}%,project_name.ilike.%${term}%,address.ilike.%${term}%`)
    .limit(5);

  if (error || !results || results.length === 0) {
    await sendMessage(chatId, `Kein Matterport-Projekt gefunden für "${term}".\n\nVersuche es mit einer ATBS-Nummer (z.B. ATBS-448) oder Adresse.`);
    return;
  }

  if (results.length === 1) {
    const p = results[0];
    await updateSession(chatId, {
      aktueller_modus: 'aufmass_projekt',
      modus_daten: { space_id: p.id, atbs_nummer: p.atbs_nummer, project_name: p.project_name, model_id: p.matterport_model_id }
    });
    const matterportUrl = p.direct_link || `https://my.matterport.com/show/?m=${p.matterport_model_id}`;
    await sendMessage(chatId,
      `<b>Projekt gefunden:</b>\n\n` +
      `ATBS: <b>${p.atbs_nummer}</b>\n` +
      `Name: ${p.project_name || '-'}\n` +
      `Adresse: ${p.address || '-'}, ${p.city || ''}\n` +
      `Auftraggeber: ${p.client_type || '-'}\n\n` +
      `Matterport: ${matterportUrl}`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📋 Aufmaß erstellen", callback_data: `aufmass:create:${p.atbs_nummer}` }],
        [{ text: "📊 Aufmaß ansehen", callback_data: `aufmass:view:${p.atbs_nummer}` }],
        [{ text: "⬅️ Zurück", callback_data: "main_menu" }]
      ] } }
    );
  } else {
    const buttons = results.map(p => [
      { text: `${p.atbs_nummer}: ${(p.project_name || p.address || '').substring(0, 35)}`, callback_data: `aufmass:select:${p.atbs_nummer}` }
    ]);
    buttons.push([{ text: "⬅️ Zurück", callback_data: "main_menu" }]);
    await sendMessage(chatId,
      `<b>${results.length} Projekte gefunden:</b>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
}

// ============================================
// Photo Handler (Bedarfsanalyse) - BESTEHEND
// ============================================

async function handleBedarfsanalysePhoto(chatId: number, session: any, photos: any[]) {
  const modus_daten = session?.modus_daten || {};
  const existingPhotos = modus_daten.photo_file_ids || [];
  const largestPhoto = photos[photos.length - 1];
  existingPhotos.push(largestPhoto.file_id);

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_fotos',
    modus_daten: { ...modus_daten, photo_file_ids: existingPhotos }
  });

  await sendMessage(chatId,
    `📷 Foto ${existingPhotos.length} empfangen.\n\n` +
    `Sende weitere Fotos oder tippe auf "Analyse starten":`,
    { reply_markup: { inline_keyboard: [
      [{ text: `🔍 Analyse starten (${existingPhotos.length} Foto${existingPhotos.length > 1 ? 's' : ''})`, callback_data: "ba:start_ocr" }],
      [{ text: "❌ Abbrechen", callback_data: "main_menu" }]
    ] } }
  );
}

async function startOcrProcessing(chatId: number, session: any) {
  const modus_daten = session?.modus_daten || {};
  const photoFileIds = modus_daten.photo_file_ids || [];
  if (photoFileIds.length === 0) {
    await sendMessage(chatId, `Keine Fotos vorhanden. Bitte sende zuerst ein Foto.`);
    return;
  }

  await sendMessage(chatId, `⏳ OCR-Verarbeitung gestartet für ${photoFileIds.length} Foto(s)...\nDies kann 15-30 Sekunden dauern.`);

  const images: { base64: string }[] = [];
  for (const fileId of photoFileIds) {
    const fileData = await downloadTelegramFile(fileId);
    if (fileData) {
      images.push({ base64: `data:${fileData.mimeType};base64,${fileData.base64}` });
    }
  }

  if (images.length === 0) {
    await sendMessage(chatId, `Fehler: Konnte keine Fotos herunterladen.`);
    return;
  }

  const { data: ba, error: baError } = await supabase
    .from('bedarfsanalysen')
    .insert({ status: 'processing', telegram_message_id: chatId.toString() })
    .select('id').single();

  if (baError || !ba) {
    await sendMessage(chatId, `Fehler beim Erstellen der Bedarfsanalyse: ${baError?.message}`);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_processing',
    modus_daten: { bedarfsanalyse_id: ba.id, photo_file_ids: photoFileIds }
  });

  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/process-bedarfsanalyse`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ images, bedarfsanalyse_id: ba.id }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('process-bedarfsanalyse error:', errText);
      await sendMessage(chatId, `Fehler bei OCR-Verarbeitung (HTTP ${response.status}).`);
      return;
    }

    const result = await response.json();
    if (!result.success) {
      await sendMessage(chatId, `OCR-Fehler: ${result.error || 'Unbekannt'}`);
      return;
    }

    console.log(`[v49] OCR done for ${ba.id}, auftraggeber_missing=${result.auftraggeber_missing}`);
    await handleOcrResult(chatId, ba.id);

  } catch (e) {
    console.error('Error calling process-bedarfsanalyse:', e);
    await sendMessage(chatId, `Fehler beim OCR-Aufruf: ${(e as Error).message}`);
  }
}

// ============================================
// Review Flow (Phase 1) - BESTEHEND (verkürzt)
// ============================================

async function listPositionen(chatId: number, draftId: string) {
  const { data: positionen } = await supabase
    .from('angebots_positionen')
    .select('*, lv_positionen:lv_position_id (bezeichnung, artikelnummer, lv_typ, einheit, preis)')
    .eq('draft_id', draftId)
    .order('position_nr');

  if (!positionen || positionen.length === 0) {
    await sendMessage(chatId, `Keine Positionen gefunden.`);
    return;
  }

  let text = `<b>Angebots-Positionen (${positionen.length}):</b>\n\n`;
  for (const pos of positionen) {
    const lv = pos.lv_positionen as any;
    const bez = lv?.bezeichnung || pos.checkbox_key || '?';
    const confIcon = pos.confidence >= 0.8 ? '✅' : pos.confidence >= 0.6 ? '⚠️' : '❌';
    const preis = Number(pos.gesamtpreis).toFixed(2);
    text += `<b>${pos.position_nr}.</b> ${bez}\n`;
    text += `   ${pos.menge} ${pos.einheit || 'Stk'} × ${Number(pos.einzelpreis).toFixed(2)}€ = <b>${preis}€</b> ${confIcon}\n\n`;
  }
  text += `Gib eine Positionsnummer ein um Details zu sehen.`;

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_positionen',
    modus_daten: { draft_id: draftId }
  });

  if (text.length > 4000) {
    const mid = text.lastIndexOf('\n\n', 2000);
    await sendMessage(chatId, text.substring(0, mid));
    await sendMessage(chatId, text.substring(mid));
  } else {
    await sendMessage(chatId, text);
  }
}

async function showPositionDetail(chatId: number, draftId: string, positionNr: number) {
  const { data: pos } = await supabase
    .from('angebots_positionen')
    .select('*, lv_positionen:lv_position_id (bezeichnung, artikelnummer, lv_typ, einheit, preis)')
    .eq('draft_id', draftId)
    .eq('position_nr', positionNr)
    .single();

  if (!pos) { await sendMessage(chatId, `Position ${positionNr} nicht gefunden.`); return; }

  const lv = pos.lv_positionen as any;
  const confPercent = Math.round((pos.confidence || 0) * 100);
  const confIcon = confPercent >= 80 ? '✅' : confPercent >= 60 ? '⚠️' : '❌';

  await sendMessage(chatId,
    `<b>Position ${positionNr}:</b>\n\n` +
    `<b>${lv?.bezeichnung || pos.checkbox_key}</b>\n` +
    `LV-Typ: ${lv?.lv_typ || '-'} | Art.Nr: ${lv?.artikelnummer || '-'}\n` +
    `Checkbox: ${pos.checkbox_key}\n\n` +
    `Menge: ${pos.menge} ${pos.einheit || 'Stk'}\n` +
    `Einzelpreis: ${Number(pos.einzelpreis).toFixed(2)} €\n` +
    `Gesamtpreis: <b>${Number(pos.gesamtpreis).toFixed(2)} €</b>\n` +
    `Konfidenz: ${confPercent}% ${confIcon}\n` +
    (pos.notiz ? `Notiz: ${pos.notiz}\n` : ''),
    { reply_markup: { inline_keyboard: [
      [{ text: "✅ OK", callback_data: `pos:ok:${pos.id}` },
       { text: "❌ Entfernen", callback_data: `pos:remove:${pos.id}` }],
      [{ text: "⬅️ Zurück zur Liste", callback_data: `angebot:list:${draftId}` }]
    ] } }
  );
}

// ============================================
// CSV Upload Handler (Aufmaß) - BESTEHEND
// ============================================

async function handleCsvUpload(chatId: number, session: any, document: any) {
  const modus_daten = session?.modus_daten || {};
  const atbs = modus_daten.atbs_nummer;
  const projectName = modus_daten.project_name || '';

  if (!document.file_name?.toLowerCase().endsWith('.csv')) {
    await sendMessage(chatId, `Bitte sende eine CSV-Datei (Matterport-Export).`);
    return;
  }

  await sendMessage(chatId, `⏳ CSV wird verarbeitet...`);

  try {
    const fileData = await downloadTelegramFile(document.file_id);
    if (!fileData) throw new Error('Could not download file');

    const fnUrl = `${SUPABASE_URL}/functions/v1/process-aufmass-complete`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ csv_base64: fileData.base64, project_name: projectName, atbs_nummer: atbs }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Unknown error');

    const excelBytes = Uint8Array.from(atob(result.excel.base64), c => c.charCodeAt(0));
    const filename = result.excel.filename || `${atbs}_Aufmass.xlsx`;

    const parsed = result.parsed;
    const caption = `<b>Aufmaß: ${atbs}</b>\n\n` +
      `Räume: ${parsed.total_rooms}\n` +
      `Netto: ${parsed.total_netto} m²\n` +
      `Brutto: ${parsed.total_brutto} m²\n` +
      (result.warnings?.length ? `\n⚠️ ${result.warnings.length} Hinweise` : '');

    await sendDocument(chatId, excelBytes, filename, caption);

    if (atbs && result.rooms) {
      const totalNetto = result.parsed?.total_netto || 0;
      const totalBrutto = result.parsed?.total_brutto || 0;
      await supabase.from('aufmass_data').upsert({
        atbs_nummer: atbs,
        total_netto_m2: totalNetto,
        total_brutto_m2: totalBrutto,
        rooms: result.rooms,
      }, { onConflict: 'atbs_nummer' });
    }

    await updateSession(chatId, { aktueller_modus: 'aufmass_projekt', modus_daten });

  } catch (e) {
    console.error('CSV processing error:', e);
    await sendMessage(chatId, `Fehler bei CSV-Verarbeitung: ${(e as Error).message}`);
  }
}

// ============================================
// Command Handlers
// ============================================

async function handleStart(chatId: number, session: any) {
  const name = session?.first_name || "Benutzer";
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });
  await sendMessage(chatId,
    `<b>Willkommen beim neurealis Bot!</b>\n\n` +
    `Hallo ${name}! Was möchtest du tun?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📊 Aufmaß erstellen/ansehen", callback_data: "mode_aufmass" }],
      [{ text: "📝 Bedarfsanalyse → Angebot", callback_data: "mode_bedarfsanalyse" }],
      [{ text: "🏗️ Baustelle öffnen", callback_data: "mode_baustelle" }],
    ] } }
  );
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId,
    `<b>Befehle:</b>\n\n` +
    `/start - Hauptmenü\n` +
    `/hilfe - Diese Hilfe\n` +
    `/status - Aktueller Status\n` +
    `/abbrechen - Aktuellen Vorgang abbrechen\n` +
    `/sync - Matterport-Projekte synchronisieren\n\n` +
    `<b>Aufmaß-Modus:</b>\n` +
    `ATBS-Nummer oder Adresse eingeben → Projekt suchen\n` +
    `CSV hochladen → Excel-Aufmaß\n\n` +
    `<b>Bedarfsanalyse-Modus:</b>\n` +
    `Foto(s) senden → OCR → Angebot → Review → Odoo-Export\n\n` +
    `<b>Baustellen-Modus:</b>\n` +
    `Projekt öffnen → Mängel, Nachträge, Nachweise erfassen`
  );
}

async function handleSync(chatId: number) {
  await sendMessage(chatId, `⏳ Synchronisiere Matterport-Projekte...`);
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/sync-matterport-projects`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: '{}',
    });
    const result = await response.json();
    if (result.success) {
      await sendMessage(chatId,
        `<b>Sync abgeschlossen</b>\n\n` +
        `Gesamt in Matterport: ${result.total_in_matterport}\n` +
        `Neu: ${result.created}\n` +
        `Aktualisiert: ${result.updated}\n` +
        `Unverändert: ${result.synced}`);
    } else {
      await sendMessage(chatId, `Sync-Fehler: ${result.error}`);
    }
  } catch (e) {
    await sendMessage(chatId, `Sync-Fehler: ${(e as Error).message}`);
  }
}

async function handleStatus(chatId: number, session: any) {
  const modus = session?.aktueller_modus || 'keiner';
  const daten = session?.modus_daten || {};
  const bvId = session?.aktuelles_bv_id;
  let text = `<b>Status:</b>\n\nModus: ${modus}\n`;
  if (bvId) text += `Geöffnetes Projekt: ${daten.projekt_nr || bvId}\n`;
  if (daten.atbs_nummer) text += `ATBS: ${daten.atbs_nummer}\n`;
  if (daten.draft_id) text += `Angebot-Draft: ${daten.draft_id}\n`;
  if (daten.bedarfsanalyse_id) text += `Bedarfsanalyse: ${daten.bedarfsanalyse_id}\n`;
  if (daten.photo_file_ids) text += `Fotos: ${daten.photo_file_ids.length}\n`;
  await sendMessage(chatId, text);
}

async function handleAbbrechen(chatId: number) {
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });
  await sendMessage(chatId, `Vorgang abgebrochen.\n\n/start für Hauptmenü.`);
}

// ============================================
// Callback Query Handler
// ============================================

async function handleCallbackQuery(update: any) {
  const chatId = update.callback_query.message.chat.id;
  const data = update.callback_query.data;
  const callbackId = update.callback_query.id;
  const session = await getOrCreateSession(chatId);

  if (data === 'main_menu') {
    await answerCallbackQuery(callbackId);
    await handleStart(chatId, session);
    return;
  }

  if (data === 'mode_aufmass') {
    await answerCallbackQuery(callbackId, 'Aufmaß-Modus');
    await updateSession(chatId, { aktueller_modus: 'aufmass', modus_daten: {} });
    await sendMessage(chatId,
      `<b>Aufmaß-Modus</b>\n\nGib eine ATBS-Nummer oder Adresse ein:`);
    return;
  }

  if (data === 'mode_bedarfsanalyse') {
    await answerCallbackQuery(callbackId, 'Bedarfsanalyse-Modus');
    await updateSession(chatId, { aktueller_modus: 'bedarfsanalyse', modus_daten: {} });
    await sendMessage(chatId,
      `<b>Bedarfsanalyse-Modus</b>\n\nSende ein oder mehrere Fotos des ausgefüllten Bedarfsanalysebogens.`);
    return;
  }

  if (data === 'mode_baustelle') {
    await answerCallbackQuery(callbackId, 'Baustellen-Modus');
    await showBaustellenMenu(chatId, session);
    return;
  }

  if (data === 'bau:menu') {
    await answerCallbackQuery(callbackId);
    await showBaustellenMenu(chatId, session);
    return;
  }

  if (data === 'bau:list') {
    await answerCallbackQuery(callbackId, 'Lade Projekte...');
    await listActiveProjekte(chatId);
    return;
  }

  if (data.startsWith('bau:open:')) {
    const bvId = data.replace('bau:open:', '');
    await answerCallbackQuery(callbackId, 'Öffne Projekt...');
    const { data: projekt } = await supabase.from('monday_bauprozess').select('*').eq('id', bvId).single();
    if (projekt) {
      await openProjekt(chatId, projekt);
    } else {
      await sendMessage(chatId, 'Projekt nicht gefunden.');
    }
    return;
  }

  if (data === 'bau:close') {
    await answerCallbackQuery(callbackId, 'Projekt geschlossen');
    await closeProjekt(chatId);
    return;
  }

  if (data === 'bau:mangel') {
    await answerCallbackQuery(callbackId);
    await startMangelMeldung(chatId, session);
    return;
  }

  if (data === 'bau:nachtrag') {
    await answerCallbackQuery(callbackId);
    await startNachtragErfassung(chatId, session);
    return;
  }

  if (data === 'bau:nachweis') {
    await answerCallbackQuery(callbackId);
    await showNachweisTypen(chatId, session);
    return;
  }

  if (data === 'bau:status') {
    await answerCallbackQuery(callbackId);
    await showProjektStatus(chatId, session);
    return;
  }

  if (data === 'mangel:add_foto') {
    await answerCallbackQuery(callbackId);
    await updateSession(chatId, { aktueller_modus: 'mangel_foto' });
    await sendMessage(chatId, '📷 Sende jetzt das Foto des Mangels:');
    return;
  }

  if (data === 'nachtrag:add_foto') {
    await answerCallbackQuery(callbackId);
    await updateSession(chatId, { aktueller_modus: 'nachtrag_foto' });
    await sendMessage(chatId, '📷 Sende jetzt das Foto des Nachtrags:');
    return;
  }

  if (data.startsWith('nachweis:')) {
    const typ = data.replace('nachweis:', '');
    await answerCallbackQuery(callbackId);
    await handleNachweisTyp(chatId, session, typ);
    return;
  }

  if (data.startsWith('aufmass:select:')) {
    const atbs = data.replace('aufmass:select:', '');
    await answerCallbackQuery(callbackId);
    await searchMatterportProject(chatId, atbs);
    return;
  }

  if (data.startsWith('aufmass:create:')) {
    const atbs = data.replace('aufmass:create:', '');
    await answerCallbackQuery(callbackId, 'Aufmaß erstellen');
    const modus_daten = session?.modus_daten || {};
    await updateSession(chatId, {
      aktueller_modus: 'aufmass_csv_upload',
      modus_daten: { ...modus_daten, atbs_nummer: atbs }
    });
    const matterportUrl = modus_daten.model_id
      ? `https://my.matterport.com/show/?m=${modus_daten.model_id}`
      : `(Matterport-Link nicht verfügbar)`;
    await sendMessage(chatId,
      `<b>Aufmaß erstellen für ${atbs}</b>\n\n` +
      `1. Öffne den Matterport-Scan: ${matterportUrl}\n` +
      `2. Exportiere die Raumdaten als CSV\n` +
      `3. Sende die CSV-Datei hier im Chat\n\n` +
      `Warte auf CSV-Upload...`);
    return;
  }

  if (data.startsWith('aufmass:view:')) {
    const atbs = data.replace('aufmass:view:', '');
    await answerCallbackQuery(callbackId);
    const { data: aufmass } = await supabase.from('aufmass_data').select('*').eq('atbs_nummer', atbs).order('created_at', { ascending: false }).limit(1).single();
    if (!aufmass) {
      await sendMessage(chatId, `Kein Aufmaß vorhanden für ${atbs}.\nErstelle zuerst ein Aufmaß über CSV-Upload.`);
      return;
    }
    const rooms = aufmass.rooms || [];
    let text = `<b>Aufmaß ${atbs}</b>\n\n`;
    text += `Netto: ${aufmass.total_netto_m2} m²\nBrutto: ${aufmass.total_brutto_m2} m²\n\n`;
    text += `<b>Räume (${rooms.length}):</b>\n`;
    for (const r of rooms) {
      text += `  ${r.name}: ${r.area_netto} m² (${r.width}x${r.length}m)\n`;
    }
    await sendMessage(chatId, text);
    return;
  }

  if (data === 'ba:start_ocr') {
    await answerCallbackQuery(callbackId, 'OCR wird gestartet...');
    await startOcrProcessing(chatId, session);
    return;
  }

  if (data.startsWith('set_auftraggeber:')) {
    const parts = data.split(':');
    const bedarfsanalyseId = parts[1];
    const auftraggeber = parts.slice(2).join(':');
    const { error } = await supabase.from('bedarfsanalysen').update({ auftraggeber, status: 'ocr_done' }).eq('id', bedarfsanalyseId);
    if (error) { await answerCallbackQuery(callbackId, `Fehler: ${error.message}`); return; }
    await answerCallbackQuery(callbackId, `Auftraggeber: ${auftraggeber}`);
    await sendMessage(chatId, `Auftraggeber gesetzt: <b>${auftraggeber}</b>\n\nAngebot wird erstellt...`);
    await updateSession(chatId, {
      aktueller_modus: 'bedarfsanalyse_processing',
      modus_daten: { bedarfsanalyse_id: bedarfsanalyseId }
    });
    await callFinalizeAngebot(chatId, bedarfsanalyseId);
    return;
  }

  if (data.startsWith('angebot:list:')) {
    const draftId = data.replace('angebot:list:', '');
    await answerCallbackQuery(callbackId);
    await listPositionen(chatId, draftId);
    return;
  }

  if (data.startsWith('angebot:confirm:')) {
    const draftId = data.replace('angebot:confirm:', '');
    await answerCallbackQuery(callbackId, 'Angebot bestätigt');
    await supabase.from('angebots_drafts').update({ status: 'confirmed' }).eq('id', draftId);
    await sendMessage(chatId,
      `✅ <b>Angebot bestätigt!</b>\n\nWas möchtest du tun?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📤 Nach Odoo exportieren", callback_data: `angebot:export:${draftId}` }],
        [{ text: "📝 Positionen ansehen", callback_data: `angebot:list:${draftId}` }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  if (data.startsWith('angebot:discard:')) {
    const draftId = data.replace('angebot:discard:', '');
    await answerCallbackQuery(callbackId, 'Angebot verworfen');
    await supabase.from('angebots_drafts').update({ status: 'discarded' }).eq('id', draftId);
    await sendMessage(chatId, `Angebot verworfen.\n\n/start für Hauptmenü.`);
    await updateSession(chatId, { aktueller_modus: null, modus_daten: {} });
    return;
  }

  if (data.startsWith('angebot:export:')) {
    const draftId = data.replace('angebot:export:', '');
    await answerCallbackQuery(callbackId, 'Export wird gestartet...');

    const { data: draft } = await supabase.from('angebots_drafts').select('odoo_order_id, odoo_url').eq('id', draftId).single();
    if (draft?.odoo_order_id) {
      await sendMessage(chatId,
        `Bereits exportiert!\n\n` +
        `Odoo: ${draft.odoo_url || `Order #${draft.odoo_order_id}`}`);
      return;
    }

    await sendMessage(chatId, `⏳ Export nach Odoo läuft...`);
    try {
      const fnUrl = `${SUPABASE_URL}/functions/v1/export-to-odoo`;
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ angebot_id: draftId }),
      });
      const result = await response.json();
      if (result.success) {
        await sendMessage(chatId,
          `✅ <b>Erfolgreich nach Odoo exportiert!</b>\n\n` +
          `Order: S${String(result.odoo_order_id).padStart(5, '0')}\n` +
          `Positionen: ${result.positionen_count}\n` +
          `Netto: ${Number(result.summe_netto).toFixed(2)} €\n` +
          `Brutto: ${Number(result.summe_brutto).toFixed(2)} €\n\n` +
          `${result.odoo_url || ''}`);
      } else {
        await sendMessage(chatId, `Export-Fehler: ${result.error}`);
      }
    } catch (e) {
      await sendMessage(chatId, `Export-Fehler: ${(e as Error).message}`);
    }
    return;
  }

  if (data.startsWith('pos:ok:')) {
    const posId = data.replace('pos:ok:', '');
    await answerCallbackQuery(callbackId, 'OK');
    await supabase.from('angebots_positionen').update({ needs_review: false, review_status: 'approved' }).eq('id', posId);
    await sendMessage(chatId, `✅ Position bestätigt.`);
    return;
  }

  if (data.startsWith('pos:remove:')) {
    const posId = data.replace('pos:remove:', '');
    await answerCallbackQuery(callbackId, 'Entfernt');
    const { data: pos } = await supabase.from('angebots_positionen').select('draft_id, gesamtpreis').eq('id', posId).single();
    await supabase.from('angebots_positionen').delete().eq('id', posId);
    if (pos?.draft_id) {
      const { data: remaining } = await supabase.from('angebots_positionen').select('gesamtpreis').eq('draft_id', pos.draft_id);
      const summeNetto = (remaining || []).reduce((s, p) => s + Number(p.gesamtpreis), 0);
      await supabase.from('angebots_drafts').update({ summe_netto: summeNetto, summe_brutto: Math.round(summeNetto * 1.19 * 100) / 100 }).eq('id', pos.draft_id);
    }
    await sendMessage(chatId, `❌ Position entfernt.`);
    return;
  }

  await answerCallbackQuery(callbackId);
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', bot: 'neurealis-bot', version: 'v50-gemeldet_von' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update).substring(0, 500));

    if (update._internal === 'ocr_done' && update.bedarfsanalyse_id && update.chat_id) {
      await handleOcrResult(update.chat_id, update.bedarfsanalyse_id);
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      const from = update.message.from;
      const session = await getOrCreateSession(chatId, from);
      await updateSession(chatId, {});

      if (text.startsWith('/start')) { await handleStart(chatId, session); }
      else if (text.startsWith('/hilfe') || text.startsWith('/help')) { await handleHelp(chatId); }
      else if (text.startsWith('/sync')) { await handleSync(chatId); }
      else if (text.startsWith('/status')) { await handleStatus(chatId, session); }
      else if (text.startsWith('/abbrechen')) { await handleAbbrechen(chatId); }

      else if (update.message.voice) {
        const modus = session?.aktueller_modus;
        if (modus === 'mangel_erfassen' || modus === 'nachtrag_erfassen') {
          await sendMessage(chatId, '⏳ Sprachnachricht wird transkribiert...');
          const fileData = await downloadTelegramFile(update.message.voice.file_id);
          if (fileData) {
            const transcript = await transcribeVoice(fileData.base64, 'audio/ogg');
            if (transcript) {
              if (modus === 'mangel_erfassen') {
                await handleMangelText(chatId, session, transcript);
              } else {
                await handleNachtragText(chatId, session, transcript);
              }
            } else {
              await sendMessage(chatId, 'Fehler bei der Transkription. Bitte versuche es erneut.');
            }
          } else {
            await sendMessage(chatId, 'Fehler beim Herunterladen der Sprachnachricht.');
          }
        } else {
          await sendMessage(chatId, 'Sprachnachrichten werden nur im Mangel- oder Nachtrag-Modus unterstützt.');
        }
      }

      else if (update.message.photo) {
        const modus = session?.aktueller_modus;

        if (modus === 'mangel_foto') {
          await handleMangelFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'nachtrag_foto') {
          await handleNachtragFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'nachweis_foto') {
          await handleNachweisFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'bedarfsanalyse' || modus === 'bedarfsanalyse_fotos') {
          await handleBedarfsanalysePhoto(chatId, session, update.message.photo);
        } else {
          await updateSession(chatId, { aktueller_modus: 'bedarfsanalyse', modus_daten: {} });
          await handleBedarfsanalysePhoto(chatId, { ...session, modus_daten: {} }, update.message.photo);
        }
      }

      else if (update.message.document) {
        const modus = session?.aktueller_modus;
        if (modus === 'aufmass_csv_upload' || modus === 'aufmass_projekt') {
          await handleCsvUpload(chatId, session, update.message.document);
        } else {
          await sendMessage(chatId, `Dokument empfangen: ${update.message.document.file_name}\n\nWechsle zuerst in den Aufmaß-Modus über /start.`);
        }
      }

      else if (text && !text.startsWith('/')) {
        const modus = session?.aktueller_modus;

        if (modus === 'baustelle_suche') {
          await searchAndOpenProjekt(chatId, text);
        }
        else if (modus === 'mangel_erfassen') {
          await handleMangelText(chatId, session, text);
        }
        else if (modus === 'nachtrag_erfassen') {
          await handleNachtragText(chatId, session, text);
        }
        else if (modus === 'aufmass') {
          await searchMatterportProject(chatId, text);
        }
        else if (modus === 'bedarfsanalyse_positionen') {
          const num = parseInt(text.trim());
          if (!isNaN(num) && num > 0) {
            const draftId = session?.modus_daten?.draft_id;
            if (draftId) await showPositionDetail(chatId, draftId, num);
          } else {
            await sendMessage(chatId, `Bitte gib eine Positionsnummer ein (z.B. "3").`);
          }
        }
        else {
          await sendMessage(chatId,
            `Ich habe deine Nachricht nicht verstanden.\n\n` +
            `/start - Hauptmenü\n/hilfe - Alle Befehle`);
        }
      }
    }

    if (update.callback_query) {
      await handleCallbackQuery(update);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
