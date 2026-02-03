/**
 * handlers/aufmass.ts - Aufmaß-Modus Handler
 *
 * Funktionen:
 * - searchMatterportProject: Sucht Matterport-Projekte nach ATBS/Name/Adresse
 * - handleCsvUpload: Verarbeitet CSV-Upload und erstellt Excel-Aufmaß
 * - countCheckboxes: Zählt aktivierte Checkboxen (für Bedarfsanalyse)
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../constants.ts';
import { sendMessage, sendDocument, downloadTelegramFile } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';

// ============================================
// Checkbox Counter (auch für Bedarfsanalyse genutzt)
// ============================================

export function countCheckboxes(obj: Record<string, unknown>): number {
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

// ============================================
// Matterport-Projekt Suche
// ============================================

export async function searchMatterportProject(chatId: number, searchTerm: string): Promise<void> {
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
// CSV Upload Handler
// ============================================

export async function handleCsvUpload(chatId: number, session: any, document: any): Promise<void> {
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
// Aufmaß-Callback Handler
// ============================================

export async function handleAufmassSelect(chatId: number, atbs: string): Promise<void> {
  await searchMatterportProject(chatId, atbs);
}

export async function handleAufmassCreate(chatId: number, session: any, atbs: string): Promise<void> {
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
}

export async function handleAufmassView(chatId: number, atbs: string): Promise<void> {
  const { data: aufmass } = await supabase
    .from('aufmass_data')
    .select('*')
    .eq('atbs_nummer', atbs)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

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
}
