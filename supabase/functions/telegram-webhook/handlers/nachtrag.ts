/**
 * Nachtrag-Handler
 * Nachtrag-Erfassung mit dynamischer gemeldet_von Erkennung und LV-Matching
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import { showBaustellenMenu } from './start.ts';
import { getGemeldetVon, generateNachtragNummer } from '../utils/auth.ts';
import { processNachtragBeschreibung } from '../utils/lv_matching.ts';
import { getProjektStammdaten } from '../utils/helpers.ts';
import type { Session, NachtragPosition } from '../types.ts';

// ============================================
// startNachtragErfassung - Nachtrag-Erfassung starten
// ============================================

export async function startNachtragErfassung(chatId: number, session: any) {
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

// ============================================
// handleNachtragText - Nachtrag-Beschreibung verarbeiten mit LV-Matching
// ============================================

export async function handleNachtragText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  // Status-Nachricht senden
  await sendMessage(chatId, '⏳ Analysiere Nachtrag und suche passende LV-Positionen...');

  // Generiere Nachtrag-Nummer im Format ATBS-XXX-N1
  const nachtragNr = await generateNachtragNummer(projektNr);

  // Dynamische Ermittlung von gemeldet_von basierend auf Kontakt
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);
  console.log(`[Nachtrag] chat_id=${chatId}: gemeldet_von=${gemeldet_von}, melder_name=${melder_name}, nr=${nachtragNr}`);

  // LV-Matching durchführen
  let positionen: NachtragPosition[] = [];
  let summeNetto = 0;
  let lvTyp = 'GWS';

  try {
    const result = await processNachtragBeschreibung(text, projektNr);
    positionen = result.positionen;
    summeNetto = result.summe_netto;
    lvTyp = result.lv_typ;
    console.log(`[Nachtrag] LV-Matching: ${positionen.length} Positionen, Summe: ${summeNetto.toFixed(2)}€, LV-Typ: ${lvTyp}`);
  } catch (e) {
    console.error('[Nachtrag] LV-Matching Fehler:', e);
    // Bei Fehler: Nachtrag trotzdem speichern, aber ohne Positionen
  }

  // Projekt-Stammdaten laden (BL, NU, NUA-Nr, Marge, etc.)
  const stammdaten = await getProjektStammdaten(projektNr);

  // Nachtrag in DB speichern
  const { data: newNachtrag, error } = await supabase
    .from('nachtraege')
    .insert({
      atbs_nummer: projektNr,
      nachtrag_nr: nachtragNr,
      beschreibung: text,
      status: 'Gemeldet',
      gemeldet_von: gemeldet_von,
      melder_name: melder_name,
      positionen: positionen.length > 0 ? positionen : null,
      summe_netto: summeNetto > 0 ? summeNetto : null,
      // Stammdaten aus monday_bauprozess
      projektname_komplett: stammdaten?.projektname_komplett || null,
      nua_nr: stammdaten?.nua_nr || null,
      marge_prozent: stammdaten?.marge_prozent || null,
      nu_name: stammdaten?.nu_firma || null,
      nu_email: stammdaten?.nu_email || null,
      bauleiter_name: stammdaten?.bl_name || null,
      bauleiter_email: stammdaten?.bl_email || null
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

  // Formatierte Antwort mit LV-Positionen
  let positionenText = '';
  if (positionen.length > 0) {
    const matchedCount = positionen.filter(p => p.lv_position_id).length;
    positionenText = `\n\n<b>📊 LV-Analyse (${lvTyp}):</b>\n`;
    positionenText += `Positionen: ${positionen.length} (${matchedCount} mit LV-Match)\n`;

    // Positionen auflisten (max. 5)
    const displayPositionen = positionen.slice(0, 5);
    for (const pos of displayPositionen) {
      const preis = pos.gesamtpreis ? ` → ${pos.gesamtpreis.toFixed(2)}€` : '';
      const match = pos.lv_position_id ? '✅' : '⚠️';
      positionenText += `${match} ${pos.menge} ${pos.einheit} ${pos.beschreibung.substring(0, 30)}${pos.beschreibung.length > 30 ? '...' : ''}${preis}\n`;
    }

    if (positionen.length > 5) {
      positionenText += `... und ${positionen.length - 5} weitere\n`;
    }

    if (summeNetto > 0) {
      positionenText += `\n<b>Geschätzte Netto-Summe: ${summeNetto.toFixed(2)}€</b>`;
    } else {
      positionenText += `\n<i>Keine Preise ermittelt - manuelle Prüfung erforderlich</i>`;
    }
  }

  await sendMessage(chatId,
    `<b>✅ Nachtrag erfasst:</b>\n\n` +
    `Nr: <b>${nachtragNr}</b>\n` +
    `Beschreibung: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}` +
    positionenText +
    `\n\nMöchtest du ein Foto hinzufügen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig (ohne Foto)", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// handleNachtragFoto - Foto zu Nachtrag hinzufügen
// ============================================

export async function handleNachtragFoto(chatId: number, session: any, photos: any[]) {
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
// saveNachtrag - Nachtrag speichern (für Callback-Handler)
// ============================================

export async function saveNachtrag(chatId: number, session: Session): Promise<void> {
  const modus_daten = session?.modus_daten || {};
  const projektNr = modus_daten.projekt_nr;
  const beschreibung = modus_daten.nachtrag_beschreibung;
  const nachtragNummer = modus_daten.nachtrag_nummer;
  const gemeldetVon = modus_daten.gemeldet_von || 'telegram';

  if (!projektNr || !beschreibung) {
    await sendMessage(chatId, '⚠️ Fehlende Daten für Nachtrag.');
    return;
  }

  // LV-Matching auch hier durchführen
  let positionen: NachtragPosition[] = [];
  let summeNetto = 0;

  try {
    const result = await processNachtragBeschreibung(beschreibung, projektNr);
    positionen = result.positionen;
    summeNetto = result.summe_netto;
  } catch (e) {
    console.error('[Nachtrag/saveNachtrag] LV-Matching Fehler:', e);
  }

  // Projekt-Stammdaten laden (BL, NU, NUA-Nr, Marge, etc.)
  const stammdaten = await getProjektStammdaten(projektNr);

  const { error } = await supabase
    .from('nachtraege')
    .insert({
      atbs_nummer: projektNr,
      nachtrag_nr: nachtragNummer,
      beschreibung: beschreibung,
      status: 'Gemeldet',
      gemeldet_von: gemeldetVon,
      positionen: positionen.length > 0 ? positionen : null,
      summe_netto: summeNetto > 0 ? summeNetto : null,
      // Stammdaten aus monday_bauprozess
      projektname_komplett: stammdaten?.projektname_komplett || null,
      nua_nr: stammdaten?.nua_nr || null,
      marge_prozent: stammdaten?.marge_prozent || null,
      nu_name: stammdaten?.nu_firma || null,
      nu_email: stammdaten?.nu_email || null,
      bauleiter_name: stammdaten?.bl_name || null,
      bauleiter_email: stammdaten?.bl_email || null
    })
    .select('id')
    .single();

  if (error) {
    await sendMessage(chatId, `❌ Fehler beim Speichern: ${error.message}`);
    return;
  }

  // Formatierte Antwort
  let summeText = '';
  if (summeNetto > 0) {
    summeText = `\nGeschätzte Summe: ${summeNetto.toFixed(2)}€ netto`;
  }

  await sendMessage(chatId,
    `✅ <b>Nachtrag gespeichert!</b>\n\n` +
    `Nummer: ${nachtragNummer}\n` +
    `Projekt: ${projektNr}\n` +
    `Status: Gemeldet` +
    `${positionen.length > 0 ? `\nPositionen: ${positionen.length}` : ''}` +
    summeText
  );

  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: { projekt_nr: projektNr, projekt_name: modus_daten.projekt_name }
  });
  await showBaustellenMenu(chatId, session);
}
