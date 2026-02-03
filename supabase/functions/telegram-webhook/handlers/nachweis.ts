/**
 * Nachweis-Handler
 * Nachweis-Upload für verschiedene Gewerke (Elektrik, Sanitär, etc.)
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import { showBaustellenMenu } from './start.ts';

// Nachweis-Typ Labels
const NACHWEIS_TYP_LABELS: Record<string, string> = {
  'rohinstall_elektrik': 'Rohinstallation Elektrik',
  'rohinstall_sanitaer': 'Rohinstallation Sanitär',
  'abdichtung_bad': 'Abdichtung Bad',
  'e_check': 'E-Check Protokoll',
  'brandschutz': 'Brandschutz'
};

// ============================================
// showNachweisTypen - Nachweis-Typ-Auswahl anzeigen
// ============================================

export async function showNachweisTypen(chatId: number, session: any) {
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
      [{ text: "🔥 Brandschutz", callback_data: "nachweis:brandschutz" }],
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// handleNachweisTyp - Nachweis-Typ auswählen
// ============================================

export async function handleNachweisTyp(chatId: number, session: any, typ: string) {
  await updateSession(chatId, {
    aktueller_modus: 'nachweis_foto',
    modus_daten: {
      ...session?.modus_daten,
      nachweis_typ: typ
    }
  });

  await sendMessage(chatId,
    `<b>📸 ${NACHWEIS_TYP_LABELS[typ] || typ}</b>\n\n` +
    `Sende jetzt das Foto des Nachweises:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:nachweis" }]
    ] } }
  );
}

// ============================================
// handleNachweisFoto - Nachweis-Foto hochladen
// ============================================

export async function handleNachweisFoto(chatId: number, session: any, photos: any[]) {
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

  await sendMessage(chatId,
    `<b>✅ Nachweis gespeichert!</b>\n\n` +
    `Typ: ${NACHWEIS_TYP_LABELS[nachweisTyp] || nachweisTyp}\n` +
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
