/**
 * handlers/abnahme.ts - Abnahmeprotokolle Handler
 *
 * Funktionen:
 * - showAbnahmeTypen: Abnahme-Typ-Auswahl anzeigen
 * - handleAbnahmeTyp: Abnahme-Typ verarbeiten und Foto-Modus starten
 * - handleAbnahmeFoto: Abnahme-Foto verarbeiten und speichern
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import { showBaustellenMenu } from './start.ts';
import type { Session, TelegramPhoto } from '../types.ts';

/**
 * Zeigt die Abnahme-Typ-Auswahl
 */
export async function showAbnahmeTypen(chatId: number, session: Session): Promise<void> {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  const projektNr = session?.modus_daten?.projekt_nr || '?';

  await sendMessage(chatId,
    `<b>📄 Abnahmeprotokoll hochladen für ${projektNr}</b>\n\n` +
    `Welche Art von Abnahme möchtest du dokumentieren?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "👷 NU-Abnahme (intern)", callback_data: "abnahme:nu" }],
      [{ text: "🏠 Kunden-Abnahme", callback_data: "abnahme:kunde" }],
      [{ text: "⬅️ Zurück", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Verarbeitet die Abnahme-Typ-Auswahl und startet den Foto-Modus
 */
export async function handleAbnahmeTyp(chatId: number, session: Session, typ: string): Promise<void> {
  const typLabels: Record<string, { label: string; dokumenttyp: string }> = {
    'nu': { label: 'NU-Abnahme (intern)', dokumenttyp: 'QM-ABN-NU' },
    'kunde': { label: 'Kunden-Abnahme', dokumenttyp: 'QM-ABN-KU' }
  };

  const config = typLabels[typ];
  if (!config) {
    await sendMessage(chatId, 'Unbekannter Abnahme-Typ.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'abnahme_foto',
    modus_daten: {
      ...session?.modus_daten,
      abnahme_typ: typ,
      abnahme_dokumenttyp: config.dokumenttyp,
      abnahme_label: config.label
    }
  });

  await sendMessage(chatId,
    `<b>📄 ${config.label}</b>\n\n` +
    `Sende jetzt ein oder mehrere Fotos des Abnahmeprotokolls.\n\n` +
    `<i>Tipp: Du kannst mehrere Fotos auf einmal senden - sie werden alle dem gleichen Protokoll zugeordnet.</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:abnahme" }]
    ] } }
  );
}

/**
 * Verarbeitet ein Abnahme-Foto und speichert es
 */
export async function handleAbnahmeFoto(chatId: number, session: Session, photos: TelegramPhoto[]): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;
  const abnahmeTyp = session?.modus_daten?.abnahme_typ;
  const dokumentTyp = session?.modus_daten?.abnahme_dokumenttyp;
  const label = session?.modus_daten?.abnahme_label;

  if (!abnahmeTyp || !dokumentTyp) {
    await sendMessage(chatId, '⚠️ Kein Abnahme-Typ gewählt. Bitte erst Typ auswählen.');
    await showAbnahmeTypen(chatId, session);
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const timestamp = Date.now();
  const filename = `${projektNr}_${dokumentTyp}_${timestamp}.jpg`;
  const filePath = `abnahmeprotokolle/${projektNr}/${filename}`;

  // Base64 zu Uint8Array konvertieren
  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // In Storage hochladen
  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  // In dokumente-Tabelle speichern
  const { error: insertError } = await supabase.from('dokumente').insert({
    id: crypto.randomUUID(),
    atbs_nummer: projektNr,
    art_des_dokuments: dokumentTyp,
    dokument_nr: `${dokumentTyp}-${projektNr}-${new Date().toISOString().split('T')[0]}`,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    quelle: 'telegram',
    datum_erstellt: new Date().toISOString().split('T')[0],
    notizen: `Hochgeladen via Telegram Bot (${label})`
  });

  if (insertError) {
    console.error('Dokument insert error:', insertError);
  }

  // Auch in fotos-Tabelle speichern für Referenz
  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'abnahmeprotokoll',
    nachweis_typ: dokumentTyp,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `<b>✅ Abnahmeprotokoll gespeichert!</b>\n\n` +
    `Typ: ${label}\n` +
    `Projekt: ${projektNr}\n` +
    `Dokumenttyp: ${dokumentTyp}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📄 Weiteres Protokoll hochladen", callback_data: "bau:abnahme" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );

  // Modus zurücksetzen
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      abnahme_typ: null,
      abnahme_dokumenttyp: null,
      abnahme_label: null
    }
  });
}
