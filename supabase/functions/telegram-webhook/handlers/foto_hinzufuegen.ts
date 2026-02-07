/**
 * handlers/foto_hinzufuegen.ts - Foto zu bestehendem Nachtrag/Mangel hinzufügen
 *
 * Flow:
 * 1. User sendet Foto (ohne aktiven Modus)
 * 2. Bot fragt: "Foto hinzufügen zu:" mit Inline-Buttons
 * 3. Bei "Bestehender Nachtrag/Mangel": Liste offene Einträge
 * 4. User wählt → Foto wird hinzugefügt
 */

import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import { checkBotPermission, PERMISSION_ERROR_MESSAGES } from '../utils/auth.ts';
import { t } from '../utils/responses.ts';
import type { Session, TelegramPhoto, Nachtrag, Mangel } from '../types.ts';

// ============================================
// Foto-Auswahl Menü anzeigen
// ============================================

/**
 * Zeigt das Auswahlmenü für ein empfangenes Foto
 * Wird aufgerufen wenn ein Foto ohne aktiven Modus gesendet wird
 */
export async function showFotoAuswahlMenu(
  chatId: number,
  session: Session,
  photos: TelegramPhoto[]
): Promise<void> {
  // Permission-Check für Fotos
  const hasPermission = await checkBotPermission(chatId, 'bot_kann_fotos');
  if (!hasPermission) {
    await sendMessage(chatId, t(PERMISSION_ERROR_MESSAGES.bot_kann_fotos, 'DE'));
    return;
  }

  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  // Foto-ID speichern für spätere Verarbeitung
  const largestPhoto = photos[photos.length - 1];
  await updateSession(chatId, {
    aktueller_modus: 'foto_auswahl',
    modus_daten: {
      ...session?.modus_daten,
      pending_foto_file_id: largestPhoto.file_id
    }
  });

  // Buttons für Auswahl
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "🔧 Neuer Nachtrag", callback_data: "foto:new_nachtrag" }],
    [{ text: "⚠️ Neuer Mangel", callback_data: "foto:new_mangel" }]
  ];

  // Nur bestehende Einträge anzeigen wenn Projekt geöffnet
  if (projektNr && bvId) {
    buttons.push(
      [{ text: "📋 Bestehender Nachtrag...", callback_data: "foto:list_nachtraege" }],
      [{ text: "📋 Bestehender Mangel...", callback_data: "foto:list_maengel" }]
    );
  }

  buttons.push([{ text: "❌ Abbrechen", callback_data: "bau:menu" }]);

  const text = projektNr
    ? `<b>📷 Foto empfangen für ${projektNr}</b>\n\nWozu soll das Foto hinzugefügt werden?`
    : `<b>📷 Foto empfangen</b>\n\nBitte öffne zuerst ein Projekt, um Fotos zu bestehenden Einträgen hinzuzufügen.\n\nOder erstelle einen neuen Eintrag:`;

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ============================================
// Offene Nachträge des Projekts auflisten
// ============================================

export async function listOffeneNachtraege(chatId: number, session: Session): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  if (!projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

  const { data: nachtraege, error } = await supabase
    .from('nachtraege')
    .select('id, nachtrag_nr, beschreibung')
    .eq('atbs_nummer', projektNr)
    .in('status', ['Gemeldet', 'In Prüfung', 'Genehmigt'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Nachtraege load error:', error);
    await sendMessage(chatId, 'Fehler beim Laden der Nachträge.');
    return;
  }

  if (!nachtraege || nachtraege.length === 0) {
    await sendMessage(chatId,
      `<b>📋 Keine offenen Nachträge</b>\n\nFür ${projektNr} gibt es keine offenen Nachträge.\n\nMöchtest du einen neuen erstellen?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Neuer Nachtrag", callback_data: "foto:new_nachtrag" }],
            [{ text: "⬅️ Zurück", callback_data: "foto:menu" }]
          ]
        }
      }
    );
    return;
  }

  // Buttons für jeden Nachtrag erstellen
  const buttons: Array<Array<{ text: string; callback_data: string }>> = nachtraege.map(n => {
    const kurz = n.beschreibung
      ? n.beschreibung.substring(0, 25) + (n.beschreibung.length > 25 ? '...' : '')
      : 'Ohne Beschreibung';
    return [{ text: `${n.nachtrag_nr}: ${kurz}`, callback_data: `foto:nachtrag:${n.id}` }];
  });

  buttons.push([{ text: "⬅️ Zurück", callback_data: "foto:menu" }]);

  await sendMessage(chatId,
    `<b>📋 Offene Nachträge für ${projektNr}</b>\n\nWähle einen Nachtrag:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ============================================
// Offene Mängel des Projekts auflisten
// ============================================

export async function listOffeneMaengel(chatId: number, session: Session): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  if (!projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

  // Mängel aus maengel_fertigstellung laden
  const { data: maengel, error } = await supabase
    .from('maengel_fertigstellung')
    .select('id, mangel_nr, beschreibung_mangel')
    .eq('projekt_nr', projektNr)
    .in('status_mangel', ['Offen', 'In Bearbeitung'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Maengel load error:', error);
    await sendMessage(chatId, 'Fehler beim Laden der Mängel.');
    return;
  }

  if (!maengel || maengel.length === 0) {
    await sendMessage(chatId,
      `<b>⚠️ Keine offenen Mängel</b>\n\nFür ${projektNr} gibt es keine offenen Mängel.\n\nMöchtest du einen neuen melden?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Neuer Mangel", callback_data: "foto:new_mangel" }],
            [{ text: "⬅️ Zurück", callback_data: "foto:menu" }]
          ]
        }
      }
    );
    return;
  }

  // Buttons für jeden Mangel erstellen
  const buttons: Array<Array<{ text: string; callback_data: string }>> = maengel.map(m => {
    const kurz = m.beschreibung_mangel
      ? m.beschreibung_mangel.substring(0, 25) + (m.beschreibung_mangel.length > 25 ? '...' : '')
      : 'Ohne Beschreibung';
    return [{ text: `${m.mangel_nr}: ${kurz}`, callback_data: `foto:mangel:${m.id}` }];
  });

  buttons.push([{ text: "⬅️ Zurück", callback_data: "foto:menu" }]);

  await sendMessage(chatId,
    `<b>⚠️ Offene Mängel für ${projektNr}</b>\n\nWähle einen Mangel:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ============================================
// Foto zu bestehendem Nachtrag hinzufügen
// ============================================

export async function addFotoToNachtrag(
  chatId: number,
  session: Session,
  nachtragId: string,
  fileId?: string // Optional: Explizite file_id (z.B. von pending_foto)
): Promise<void> {
  const pendingFotoFileId = fileId || session?.modus_daten?.pending_foto_file_id;
  const projektNr = session?.modus_daten?.projekt_nr;

  if (!pendingFotoFileId) {
    await sendMessage(chatId, '⚠️ Kein Foto vorhanden. Bitte sende zuerst ein Foto.');
    return;
  }

  // Nachtrag laden für Anzeige
  const { data: nachtrag, error: loadError } = await supabase
    .from('nachtraege')
    .select('id, nachtrag_nr, beschreibung, foto_urls')
    .eq('id', nachtragId)
    .single();

  if (loadError || !nachtrag) {
    await sendMessage(chatId, '⚠️ Nachtrag nicht gefunden.');
    return;
  }

  // Foto herunterladen und hochladen
  const fileData = await downloadTelegramFile(pendingFotoFileId);
  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${nachtrag.nachtrag_nr}_${Date.now()}.jpg`;
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

  // Foto-URL zu Nachtrag hinzufügen
  const existingUrls = nachtrag.foto_urls || [];
  await supabase
    .from('nachtraege')
    .update({ foto_urls: [...existingUrls, publicUrl.publicUrl] })
    .eq('id', nachtragId);

  // Foto in fotos-Tabelle speichern
  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'nachtrag',
    nachtrag_id: nachtragId,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  // Session zurücksetzen
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      pending_foto_file_id: null
    }
  });

  const fotoCount = existingUrls.length + 1;
  await sendMessage(chatId,
    `<b>✅ Foto zu Nachtrag hinzugefügt!</b>\n\n` +
    `<b>Nr:</b> ${nachtrag.nachtrag_nr}\n` +
    `<b>Fotos:</b> ${fotoCount} insgesamt\n\n` +
    `Weiteres Foto hinzufügen?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📷 Noch ein Foto", callback_data: `foto:more:nachtrag:${nachtragId}` }],
          [{ text: "✅ Fertig", callback_data: "bau:menu" }]
        ]
      }
    }
  );
}

// ============================================
// Foto zu bestehendem Mangel hinzufügen
// ============================================

export async function addFotoToMangel(
  chatId: number,
  session: Session,
  mangelId: string,
  fileId?: string // Optional: Explizite file_id (z.B. von pending_foto)
): Promise<void> {
  const pendingFotoFileId = fileId || session?.modus_daten?.pending_foto_file_id;
  const projektNr = session?.modus_daten?.projekt_nr;

  if (!pendingFotoFileId) {
    await sendMessage(chatId, '⚠️ Kein Foto vorhanden. Bitte sende zuerst ein Foto.');
    return;
  }

  // Mangel laden für Anzeige
  const { data: mangel, error: loadError } = await supabase
    .from('maengel_fertigstellung')
    .select('id, mangel_nr, beschreibung_mangel, fotos_mangel')
    .eq('id', mangelId)
    .single();

  if (loadError || !mangel) {
    await sendMessage(chatId, '⚠️ Mangel nicht gefunden.');
    return;
  }

  // Foto herunterladen und hochladen
  const fileData = await downloadTelegramFile(pendingFotoFileId);
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

  // Fotos zu Mangel hinzufügen (Array von Objekten)
  const existingFotos = mangel.fotos_mangel || [];
  const newFoto = { url: publicUrl.publicUrl, filename };
  await supabase
    .from('maengel_fertigstellung')
    .update({ fotos_mangel: [...existingFotos, newFoto] })
    .eq('id', mangelId);

  // Foto in fotos-Tabelle speichern
  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'mangel',
    mangel_id: mangelId,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  // Session zurücksetzen
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      pending_foto_file_id: null
    }
  });

  const fotoCount = existingFotos.length + 1;
  await sendMessage(chatId,
    `<b>✅ Foto zu Mangel hinzugefügt!</b>\n\n` +
    `<b>Nr:</b> ${mangel.mangel_nr}\n` +
    `<b>Fotos:</b> ${fotoCount} insgesamt\n\n` +
    `Weiteres Foto hinzufügen?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📷 Noch ein Foto", callback_data: `foto:more:mangel:${mangelId}` }],
          [{ text: "✅ Fertig", callback_data: "bau:menu" }]
        ]
      }
    }
  );
}

// ============================================
// Modus für "noch ein Foto" setzen
// ============================================

export async function setFotoWarteModus(
  chatId: number,
  session: Session,
  typ: 'nachtrag' | 'mangel',
  id: string
): Promise<void> {
  await updateSession(chatId, {
    aktueller_modus: `foto_warte_${typ}`,
    modus_daten: {
      ...session?.modus_daten,
      pending_target_typ: typ,
      pending_target_id: id
    }
  });

  await sendMessage(chatId,
    `📷 Sende jetzt das nächste Foto für den ${typ === 'nachtrag' ? 'Nachtrag' : 'Mangel'}:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
        ]
      }
    }
  );
}

// ============================================
// Foto im Warte-Modus verarbeiten
// ============================================

export async function handleFotoInWarteModus(
  chatId: number,
  session: Session,
  photos: TelegramPhoto[]
): Promise<void> {
  const typ = session?.modus_daten?.pending_target_typ as 'nachtrag' | 'mangel';
  const id = session?.modus_daten?.pending_target_id;

  if (!typ || !id) {
    await sendMessage(chatId, '⚠️ Kein Ziel für das Foto definiert.');
    return;
  }

  // Foto-ID speichern
  const largestPhoto = photos[photos.length - 1];
  await updateSession(chatId, {
    modus_daten: {
      ...session?.modus_daten,
      pending_foto_file_id: largestPhoto.file_id
    }
  });

  // Session neu laden um pending_foto_file_id zu haben
  const updatedSession = {
    ...session,
    modus_daten: {
      ...session?.modus_daten,
      pending_foto_file_id: largestPhoto.file_id
    }
  };

  if (typ === 'nachtrag') {
    await addFotoToNachtrag(chatId, updatedSession, id);
  } else {
    await addFotoToMangel(chatId, updatedSession, id);
  }
}

// ============================================
// Re-show Foto Menü (für Zurück-Button)
// ============================================

export async function reshowFotoMenu(chatId: number, session: Session): Promise<void> {
  const pendingFotoFileId = session?.modus_daten?.pending_foto_file_id;

  if (!pendingFotoFileId) {
    await sendMessage(chatId, '⚠️ Kein Foto mehr vorhanden. Bitte sende ein neues Foto.');
    return;
  }

  // Menü erneut anzeigen mit dem gespeicherten Foto
  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "🔧 Neuer Nachtrag", callback_data: "foto:new_nachtrag" }],
    [{ text: "⚠️ Neuer Mangel", callback_data: "foto:new_mangel" }]
  ];

  if (projektNr && bvId) {
    buttons.push(
      [{ text: "📋 Bestehender Nachtrag...", callback_data: "foto:list_nachtraege" }],
      [{ text: "📋 Bestehender Mangel...", callback_data: "foto:list_maengel" }]
    );
  }

  buttons.push([{ text: "❌ Abbrechen", callback_data: "bau:menu" }]);

  await sendMessage(chatId,
    `<b>📷 Foto für ${projektNr || 'Projekt'}</b>\n\nWozu soll das Foto hinzugefügt werden?`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ============================================
// /maengel Command - Liste offene Mängel
// Wenn Projekt offen: nur dieses Projekt
// Sonst: alle Projekte
// ============================================

export async function listMaengelCommand(chatId: number, session: Session): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  let query = supabase
    .from('maengel_fertigstellung')
    .select('id, mangel_nr, beschreibung_mangel, projekt_nr, status_mangel, datum_frist')
    .in('status_mangel', ['Offen', 'In Bearbeitung'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (projektNr) {
    query = query.eq('projekt_nr', projektNr);
  }

  const { data: maengel, error } = await query;

  if (error) {
    console.error('Maengel load error:', error);
    await sendMessage(chatId, '❌ Fehler beim Laden der Mängel.');
    return;
  }

  if (!maengel || maengel.length === 0) {
    const scope = projektNr ? `für ${projektNr}` : 'insgesamt';
    await sendMessage(chatId, `✅ Keine offenen Mängel ${scope}.`);
    return;
  }

  // Header
  const scope = projektNr ? `${projektNr}` : 'Alle Projekte';
  let text = `<b>⚠️ Offene Mängel (${scope})</b>\n\n`;

  // Liste mit Buttons
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const m of maengel) {
    const kurz = m.beschreibung_mangel?.substring(0, 20) || '-';
    const frist = m.datum_frist ? new Date(m.datum_frist).toLocaleDateString('de-DE') : '-';
    const projektInfo = projektNr ? '' : ` [${m.projekt_nr}]`;

    text += `• <b>${m.mangel_nr}</b>${projektInfo}: ${kurz}...\n`;
    text += `  Frist: ${frist} | Status: ${m.status_mangel}\n\n`;

    buttons.push([{
      text: `📷 ${m.mangel_nr}: Foto hinzufügen`,
      callback_data: `mangel:foto:${m.id}`
    }]);
  }

  buttons.push([{ text: "🔙 Zurück", callback_data: "bau:menu" }]);

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ============================================
// /nachtraege Command - Liste offene Nachträge
// Wenn Projekt offen: nur dieses Projekt
// Sonst: alle Projekte
// ============================================

export async function listNachtraegeCommand(chatId: number, session: Session): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  let query = supabase
    .from('nachtraege')
    .select('id, nachtrag_nr, beschreibung, atbs_nummer, status, summe_netto')
    .in('status', ['Gemeldet', 'In Prüfung', 'Genehmigt', '(0) Offen / Preis eingeben', '(1) Kunde informieren / freigeben'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (projektNr) {
    query = query.eq('atbs_nummer', projektNr);
  }

  const { data: nachtraege, error } = await query;

  if (error) {
    console.error('Nachtraege load error:', error);
    await sendMessage(chatId, '❌ Fehler beim Laden der Nachträge.');
    return;
  }

  if (!nachtraege || nachtraege.length === 0) {
    const scope = projektNr ? `für ${projektNr}` : 'insgesamt';
    await sendMessage(chatId, `✅ Keine offenen Nachträge ${scope}.`);
    return;
  }

  // Header
  const scope = projektNr ? `${projektNr}` : 'Alle Projekte';
  let text = `<b>📋 Offene Nachträge (${scope})</b>\n\n`;

  // Liste mit Buttons
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const n of nachtraege) {
    const kurz = n.beschreibung?.substring(0, 20) || '-';
    const summe = n.summe_netto ? `${n.summe_netto.toFixed(2)} €` : '-';
    const projektInfo = projektNr ? '' : ` [${n.atbs_nummer}]`;

    text += `• <b>${n.nachtrag_nr}</b>${projektInfo}: ${kurz}...\n`;
    text += `  Summe: ${summe} | Status: ${n.status}\n\n`;

    buttons.push([{
      text: `📷 ${n.nachtrag_nr}: Foto hinzufügen`,
      callback_data: `nachtrag:foto:${n.id}`
    }]);
  }

  buttons.push([{ text: "🔙 Zurück", callback_data: "bau:menu" }]);

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ============================================
// Prompt-Funktionen für Foto zu Mangel/Nachtrag
// ============================================

/**
 * Prompt für Foto-Upload zu einem Mangel (aus /maengel Liste)
 */
export async function promptFotoForMangel(chatId: number, session: Session, mangelId: string): Promise<void> {
  // Mangel laden für Info
  const { data: mangel } = await supabase
    .from('maengel_fertigstellung')
    .select('mangel_nr, beschreibung_mangel')
    .eq('id', mangelId)
    .single();

  // Session setzen für Foto-Empfang
  await updateSession(chatId, {
    aktueller_modus: 'foto_warte_mangel',
    modus_daten: {
      ...session?.modus_daten,
      pending_target_typ: 'mangel',
      pending_target_id: mangelId
    }
  });

  await sendMessage(chatId,
    `<b>📷 Foto für Mangel ${mangel?.mangel_nr || mangelId}</b>\n\n` +
    `${mangel?.beschreibung_mangel?.substring(0, 50) || '-'}...\n\n` +
    `Sende jetzt das Foto:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Abbrechen", callback_data: "bau:menu" }]]
      }
    }
  );
}

/**
 * Prompt für Foto-Upload zu einem Nachtrag (aus /nachtraege Liste)
 */
export async function promptFotoForNachtrag(chatId: number, session: Session, nachtragId: string): Promise<void> {
  // Nachtrag laden für Info
  const { data: nachtrag } = await supabase
    .from('nachtraege')
    .select('nachtrag_nr, beschreibung')
    .eq('id', nachtragId)
    .single();

  // Session setzen für Foto-Empfang
  await updateSession(chatId, {
    aktueller_modus: 'foto_warte_nachtrag',
    modus_daten: {
      ...session?.modus_daten,
      pending_target_typ: 'nachtrag',
      pending_target_id: nachtragId
    }
  });

  await sendMessage(chatId,
    `<b>📷 Foto für Nachtrag ${nachtrag?.nachtrag_nr || nachtragId}</b>\n\n` +
    `${nachtrag?.beschreibung?.substring(0, 50) || '-'}...\n\n` +
    `Sende jetzt das Foto:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Abbrechen", callback_data: "bau:menu" }]]
      }
    }
  );
}
