/**
 * handlers/bedarfsanalyse.ts - Bedarfsanalyse-Modus Handler
 *
 * Funktionen:
 * - handleBedarfsanalysePhoto: Foto-Upload für Bedarfsanalyse
 * - startOcrProcessing: OCR-Verarbeitung starten
 * - handleOcrResult: OCR-Ergebnis verarbeiten
 * - callFinalizeAngebot: Angebot finalisieren
 * - showAngebotSummary: Angebots-Zusammenfassung anzeigen
 * - listPositionen: Alle Positionen auflisten
 * - showPositionDetail: Einzelne Position anzeigen
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../constants.ts';
import { sendMessage, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { countCheckboxes } from './aufmass.ts';

// ============================================
// Photo Handler (Bedarfsanalyse)
// ============================================

export async function handleBedarfsanalysePhoto(chatId: number, session: any, photos: any[]): Promise<void> {
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

// ============================================
// OCR Processing
// ============================================

export async function startOcrProcessing(chatId: number, session: any): Promise<void> {
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

    console.log(`[bedarfsanalyse] OCR done for ${ba.id}, auftraggeber_missing=${result.auftraggeber_missing}`);
    await handleOcrResult(chatId, ba.id);

  } catch (e) {
    console.error('Error calling process-bedarfsanalyse:', e);
    await sendMessage(chatId, `Fehler beim OCR-Aufruf: ${(e as Error).message}`);
  }
}

// ============================================
// OCR Result Handler
// ============================================

export async function handleOcrResult(chatId: number, bedarfsanalyseId: string): Promise<void> {
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

// ============================================
// Angebot Finalisieren
// ============================================

export async function callFinalizeAngebot(chatId: number, bedarfsanalyseId: string): Promise<void> {
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

// ============================================
// Angebot Zusammenfassung
// ============================================

export async function showAngebotSummary(chatId: number, draftId: string): Promise<void> {
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
// Positionen Liste
// ============================================

export async function listPositionen(chatId: number, draftId: string): Promise<void> {
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

// ============================================
// Position Detail
// ============================================

export async function showPositionDetail(chatId: number, draftId: string, positionNr: number): Promise<void> {
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
// Callback Handler für Angebot-Aktionen
// ============================================

export async function handleSetAuftraggeber(chatId: number, bedarfsanalyseId: string, auftraggeber: string): Promise<void> {
  const { error } = await supabase
    .from('bedarfsanalysen')
    .update({ auftraggeber, status: 'ocr_done' })
    .eq('id', bedarfsanalyseId);

  if (error) {
    await sendMessage(chatId, `Fehler: ${error.message}`);
    return;
  }

  await sendMessage(chatId, `Auftraggeber gesetzt: <b>${auftraggeber}</b>\n\nAngebot wird erstellt...`);
  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_processing',
    modus_daten: { bedarfsanalyse_id: bedarfsanalyseId }
  });
  await callFinalizeAngebot(chatId, bedarfsanalyseId);
}

export async function handleAngebotConfirm(chatId: number, draftId: string): Promise<void> {
  await supabase.from('angebots_drafts').update({ status: 'confirmed' }).eq('id', draftId);
  await sendMessage(chatId,
    `✅ <b>Angebot bestätigt!</b>\n\nWas möchtest du tun?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📤 Nach Odoo exportieren", callback_data: `angebot:export:${draftId}` }],
      [{ text: "📝 Positionen ansehen", callback_data: `angebot:list:${draftId}` }],
      [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
    ] } }
  );
}

export async function handleAngebotDiscard(chatId: number, draftId: string): Promise<void> {
  await supabase.from('angebots_drafts').update({ status: 'discarded' }).eq('id', draftId);
  await sendMessage(chatId, `Angebot verworfen.\n\n/start für Hauptmenü.`);
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {} });
}

export async function handleAngebotExport(chatId: number, draftId: string): Promise<void> {
  const { data: draft } = await supabase
    .from('angebots_drafts')
    .select('odoo_order_id, odoo_url')
    .eq('id', draftId)
    .single();

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
}

export async function handlePositionOk(chatId: number, posId: string): Promise<void> {
  await supabase
    .from('angebots_positionen')
    .update({ needs_review: false, review_status: 'approved' })
    .eq('id', posId);
  await sendMessage(chatId, `✅ Position bestätigt.`);
}

export async function handlePositionRemove(chatId: number, posId: string): Promise<void> {
  const { data: pos } = await supabase
    .from('angebots_positionen')
    .select('draft_id, gesamtpreis')
    .eq('id', posId)
    .single();

  await supabase.from('angebots_positionen').delete().eq('id', posId);

  if (pos?.draft_id) {
    const { data: remaining } = await supabase
      .from('angebots_positionen')
      .select('gesamtpreis')
      .eq('draft_id', pos.draft_id);

    const summeNetto = (remaining || []).reduce((s, p) => s + Number(p.gesamtpreis), 0);
    await supabase
      .from('angebots_drafts')
      .update({ summe_netto: summeNetto, summe_brutto: Math.round(summeNetto * 1.19 * 100) / 100 })
      .eq('id', pos.draft_id);
  }

  await sendMessage(chatId, `❌ Position entfernt.`);
}
