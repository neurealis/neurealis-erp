/**
 * handlers/foto.ts - Foto-Verarbeitung Handler
 *
 * Funktionen:
 * - handleMultiFotoUpload: Verarbeitet Multi-Foto-Uploads (media_group_id)
 * - processPendingFotos: Verarbeitet gesammelte Fotos nach Timeout
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import type { Session, PendingFoto, TelegramUpdate } from '../types.ts';

/**
 * Verarbeitet Multi-Foto-Uploads
 * Sammelt Fotos mit gleicher media_group_id und verarbeitet sie nach Timeout
 *
 * @returns PendingFoto[] wenn alle Fotos einer Gruppe bereit sind
 * @returns 'pending' wenn noch auf weitere Fotos gewartet wird
 * @returns null wenn es ein Einzelfoto ist (soll normal verarbeitet werden)
 */
export async function handleMultiFotoUpload(
  chatId: number,
  session: Session,
  update: TelegramUpdate
): Promise<PendingFoto[] | 'pending' | null> {
  const mediaGroupId = update.message?.media_group_id;
  const photos = update.message?.photo || [];
  const largestPhoto = photos[photos.length - 1];
  const modus = session?.aktueller_modus;

  // Falls kein media_group_id, ist es ein einzelnes Foto
  if (!mediaGroupId) {
    return null; // null = Einzelfoto, soll normal verarbeitet werden
  }

  // Foto zur pending-Liste hinzufügen
  const pendingFotos: PendingFoto[] = session?.pending_fotos || [];
  pendingFotos.push({
    file_id: largestPhoto.file_id,
    media_group_id: mediaGroupId,
    received_at: Date.now()
  });

  await updateSession(chatId, { pending_fotos: pendingFotos });

  // Zählen wie viele Fotos dieser Gruppe schon da sind
  const groupFotos = pendingFotos.filter(f => f.media_group_id === mediaGroupId);

  // Beim ersten Foto der Gruppe: Hinweis senden und Timer starten
  if (groupFotos.length === 1) {
    console.log(`[v53] Multi-Foto-Gruppe ${mediaGroupId} gestartet für Modus ${modus}`);

    await updateSession(chatId, {
      pending_fotos: pendingFotos,
      modus_daten: {
        ...session?.modus_daten,
        pending_media_group_id: mediaGroupId,
        pending_media_group_start: Date.now()
      }
    });

    return 'pending';
  }

  // Bei weiteren Fotos: Prüfen ob Timeout (1.5s nach erstem Foto)
  const groupStart = session?.modus_daten?.pending_media_group_start;
  const elapsed = Date.now() - (groupStart || Date.now());

  if (elapsed < 1500) {
    return 'pending';
  }

  // Timeout erreicht - alle Fotos der Gruppe verarbeiten
  console.log(`[v53] Multi-Foto-Gruppe ${mediaGroupId} verarbeiten: ${groupFotos.length} Fotos`);

  const remainingFotos = pendingFotos.filter(f => f.media_group_id !== mediaGroupId);
  await updateSession(chatId, {
    pending_fotos: remainingFotos,
    modus_daten: {
      ...session?.modus_daten,
      pending_media_group_id: null,
      pending_media_group_start: null
    }
  });

  return groupFotos;
}

/**
 * Verarbeitet gesammelte Fotos und lädt sie hoch
 *
 * @returns Anzahl erfolgreich hochgeladener Fotos
 */
export async function processPendingFotos(
  chatId: number,
  session: Session,
  fotos: PendingFoto[]
): Promise<number> {
  const modus = session?.aktueller_modus;
  const projektNr = session?.modus_daten?.projekt_nr;

  let successCount = 0;

  for (const foto of fotos) {
    const fileData = await downloadTelegramFile(foto.file_id);
    if (!fileData) continue;

    const timestamp = Date.now();
    let filePath: string;
    let kategorie: string;

    if (modus === 'mangel_foto') {
      filePath = `maengel/${projektNr}/${projektNr}_mangel_${timestamp}_${successCount}.jpg`;
      kategorie = 'mangel';
    } else if (modus === 'nachtrag_foto') {
      filePath = `nachtraege/${projektNr}/${projektNr}_nachtrag_${timestamp}_${successCount}.jpg`;
      kategorie = 'nachtrag';
    } else if (modus === 'nachweis_foto') {
      const nachweisTyp = session?.modus_daten?.nachweis_typ || 'allgemein';
      filePath = `nachweise/${projektNr}/${projektNr}_${nachweisTyp}_${timestamp}_${successCount}.jpg`;
      kategorie = 'nachweis';
    } else if (modus === 'abnahme_foto') {
      const dokumentTyp = session?.modus_daten?.abnahme_dokumenttyp || 'QM-ABN';
      filePath = `abnahmeprotokolle/${projektNr}/${projektNr}_${dokumentTyp}_${timestamp}_${successCount}.jpg`;
      kategorie = 'abnahmeprotokoll';
    } else {
      filePath = `allgemein/${projektNr}/${projektNr}_foto_${timestamp}_${successCount}.jpg`;
      kategorie = 'allgemein';
    }

    const binaryString = atob(fileData.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(filePath, bytes, { contentType: fileData.mimeType });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

      await supabase.from('fotos').insert({
        atbs_nummer: projektNr,
        bauvorhaben_id: session?.aktuelles_bv_id,
        kategorie,
        datei_url: publicUrl.publicUrl,
        datei_name: filePath.split('/').pop(),
        mime_type: fileData.mimeType,
        quelle: 'telegram'
      });

      successCount++;
    }
  }

  if (successCount > 0) {
    await sendMessage(chatId, `✅ ${successCount} Fotos gespeichert!`);
  }

  return successCount;
}
