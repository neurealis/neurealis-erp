/**
 * Mangel-Handler
 * Mängelerfassung mit KI-Splitting und mehrsprachiger Unterstützung
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession, updateLetzteAktion, addProjektToHistorie } from '../utils/session.ts';
import { supabase, OPENAI_API_KEY } from '../constants.ts';
import { showBaustellenMenu } from './start.ts';
import { getProjektStammdaten } from '../utils/helpers.ts';
import { getGemeldetVon, generateMangelNummer as generateMangelNr } from '../utils/auth.ts';
import { t, getGewerkEmoji, BUTTONS, createInlineKeyboard } from '../utils/responses.ts';
import { extractDescriptionFromText } from '../utils/intent_detection.ts';
import type { IntentAnalysis } from '../utils/intent_detection.ts';

// ============================================
// OpenAI GPT für Mangel-Splitting + Übersetzung
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
// Mangel-Nummer generieren: ATBS-XXX-M1
// ============================================

async function generateMangelNummer(atbs: string): Promise<string> {
  // Zähle bestehende Mängel für dieses Projekt
  const { count } = await supabase
    .from('maengel_fertigstellung')
    .select('*', { count: 'exact', head: true })
    .eq('projekt_nr', atbs);

  const nextNum = (count || 0) + 1;
  return `${atbs}-M${nextNum}`;
}

// ============================================
// startMangelMeldung - Mangel-Erfassung starten
// ============================================

export async function startMangelMeldung(chatId: number, session: any) {
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

// ============================================
// handleMangelText - Mangel-Beschreibung verarbeiten
// ============================================

export async function handleMangelText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  // Prüfe ob Projekt geöffnet
  if (!projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet. Bitte zuerst ein Projekt öffnen über "🏗️ Baustelle öffnen".');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await sendMessage(chatId, '⏳ Mängel werden analysiert...');

  const { maengel, detected_language } = await parseAndTranslateMaengel(text);

  if (maengel.length === 0) {
    await sendMessage(chatId, 'Kein Mangel erkannt. Bitte beschreibe den Mangel genauer.');
    return;
  }

  const frist = new Date();
  frist.setDate(frist.getDate() + 3);

  // Projekt-Stammdaten laden (BL, NU, Mieter-Daten, NUA-Nr)
  const stammdaten = await getProjektStammdaten(projektNr);

  const createdMaengel = [];
  for (const m of maengel) {
    // Generiere Mangel-Nummer im Format ATBS-XXX-M1
    const mangelNummer = await generateMangelNummer(projektNr);

    // Logging VOR dem Insert
    console.log('[Mangel] handleMangelText Insert-Daten:', JSON.stringify({
      projekt_nr: projektNr,
      mangel_nr: mangelNummer,
      beschreibung: m.beschreibung_de?.substring(0, 50),
      gewerk: m.gewerk || 'Sonstiges',
      status: 'Offen',
      hat_stammdaten: !!stammdaten
    }, null, 2));

    const { data: newMangel, error } = await supabase
      .from('maengel_fertigstellung')
      .insert({
        projekt_nr: projektNr,
        mangel_nr: mangelNummer,
        beschreibung_mangel: m.beschreibung_de,
        art_des_mangels: m.gewerk || 'Sonstiges',
        status_mangel: 'Offen',
        datum_meldung: new Date().toISOString(),
        datum_frist: frist.toISOString(),
        erinnerung_status: 'Aktiv',
        // Stammdaten aus monday_bauprozess
        projektname_komplett: stammdaten?.projektname_komplett || null,
        nua_nr: stammdaten?.nua_nr || null,
        bauleiter: stammdaten?.bl_name || null,
        nachunternehmer: stammdaten?.nu_firma || null,
        nu_email: stammdaten?.nu_email || null,
        kunde_name: stammdaten?.ag_name || null,
        kunde_email: stammdaten?.ag_email || null,
        kunde_telefon: stammdaten?.ag_telefon || null
      })
      .select('id, mangel_nr')
      .single();

    // Detailliertes Error-Logging
    if (error) {
      console.error('[Mangel] handleMangelText DB-Fehler:', JSON.stringify({
        error_message: error?.message,
        error_code: error?.code,
        error_details: error?.details,
        error_hint: error?.hint
      }, null, 2));
    }

    if (!error && newMangel) {
      createdMaengel.push({ ...newMangel, beschreibung: m.beschreibung_de, gewerk: m.gewerk });
    }
  }

  if (createdMaengel.length === 0) {
    await sendMessage(chatId, '❌ Fehler beim Speichern der Mängel. Bitte versuche es erneut oder wende dich an den Support.');
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

// ============================================
// handleMangelFoto - Foto zu Mangel hinzufügen
// ============================================

export async function handleMangelFoto(chatId: number, session: any, photos: any[]) {
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
// createMangelFromIntent - One-Shot Command
// Erstellt Mangel direkt aus Intent (ohne Projekt-Vorauswahl)
// ============================================

/**
 * Erstellt Mangel direkt aus Intent (One-Shot Command)
 * Wird aufgerufen wenn Intent MANGEL_MELDEN und Projekt erkannt
 */
export async function createMangelFromIntent(
  chatId: number,
  session: any,
  intent: IntentAnalysis
): Promise<void> {
  // Projekt-Nummer aus Intent oder Session
  const projektNr = intent.projekt?.atbs || session?.modus_daten?.projekt_nr;

  if (!projektNr) {
    await sendMessage(chatId, t('PROJEKT_BENOETIGT', 'DE'));
    return;
  }

  // Entity extrahieren (erstes Element) und Beschreibung bereinigen
  const entity = intent.entities[0] || { beschreibung: 'Kein Detail' };
  const cleanBeschreibung = extractDescriptionFromText(entity.beschreibung);

  // Mangel-Nummer generieren
  const mangelNr = await generateMangelNr(projektNr);

  // Gemeldet-Von ermitteln
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);

  // Projekt-Stammdaten laden
  const stammdaten = await getProjektStammdaten(projektNr);

  // Frist: +3 Tage
  const frist = new Date();
  frist.setDate(frist.getDate() + 3);

  // Logging VOR dem Insert
  console.log('[Mangel] One-Shot Insert-Daten:', JSON.stringify({
    atbs_nummer: projektNr,
    mangel_nr: mangelNr,
    beschreibung: cleanBeschreibung?.substring(0, 50),
    gewerk: entity.gewerk,
    raum: entity.raum,
    status: 'Offen',
    gemeldet_von,
    melder_name,
    hat_stammdaten: !!stammdaten
  }, null, 2));

  // In DB speichern (maengel_fertigstellung wie handleMangelText)
  const { data: newMangel, error } = await supabase
    .from('maengel_fertigstellung')
    .insert({
      projekt_nr: projektNr,
      mangel_nr: mangelNr,
      beschreibung_mangel: cleanBeschreibung,
      art_des_mangels: entity.gewerk || 'Sonstiges',
      status_mangel: 'Offen',
      datum_meldung: new Date().toISOString(),
      datum_frist: frist.toISOString(),
      erinnerung_status: 'Aktiv',
      // Stammdaten aus monday_bauprozess
      projektname_komplett: stammdaten?.projektname_komplett || null,
      nua_nr: stammdaten?.nua_nr || null,
      bauleiter: stammdaten?.bl_name || null,
      nachunternehmer: stammdaten?.nu_firma || null,
      nu_email: stammdaten?.nu_email || null,
      kunde_name: stammdaten?.ag_name || null,
      kunde_email: stammdaten?.ag_email || null,
      kunde_telefon: stammdaten?.ag_telefon || null
    })
    .select('id, mangel_nr')
    .single();

  // Detailliertes Error-Handling
  if (error || !newMangel) {
    console.error('[Mangel] One-Shot DB-Fehler:', JSON.stringify({
      error_message: error?.message,
      error_code: error?.code,
      error_details: error?.details,
      error_hint: error?.hint
    }, null, 2));

    // Besseres User-Feedback basierend auf Fehlercode
    let userMsg = '❌ Fehler beim Speichern des Mangels.';
    if (error?.code === '23502') {
      userMsg += ' Ein Pflichtfeld fehlt.';
    } else if (error?.code === '23514') {
      userMsg += ' Ungültiger Wert für ein Feld.';
    } else if (error?.code === '23505') {
      userMsg += ' Dieser Mangel existiert bereits.';
    }
    await sendMessage(chatId, userMsg);
    return;
  }

  // Session aktualisieren für Kontext-Awareness
  await updateLetzteAktion(chatId, {
    typ: 'mangel',
    id: newMangel.mangel_nr,
    projekt_nr: projektNr
  });

  await addProjektToHistorie(chatId, {
    atbs: projektNr,
    name: stammdaten?.projektname_komplett || undefined
  });

  // Session für Foto-Modus vorbereiten
  await updateSession(chatId, {
    aktueller_modus: 'mangel_foto',
    modus_daten: {
      projekt_nr: projektNr,
      projekt_name: stammdaten?.projektname_komplett || '',
      created_maengel: [{
        id: newMangel.id,
        mangel_nr: newMangel.mangel_nr,
        beschreibung: cleanBeschreibung,
        gewerk: entity.gewerk || 'Sonstiges'
      }]
    }
  });

  // Erfolgs-Nachricht
  const gewerkEmoji = getGewerkEmoji(entity.gewerk || 'Sonstiges');
  const msg = t('MANGEL_ERFASST', 'DE', {
    nr: newMangel.mangel_nr,
    raum: entity.raum || '-',
    gewerk_emoji: gewerkEmoji,
    gewerk: entity.gewerk || 'Sonstiges',
    beschreibung: cleanBeschreibung.substring(0, 50)
  });

  await sendMessage(chatId, msg, createInlineKeyboard(BUTTONS.MANGEL_FOLLOWUP));

  console.log(`[Mangel] One-Shot erstellt: ${newMangel.mangel_nr} für ${projektNr}`);
}
