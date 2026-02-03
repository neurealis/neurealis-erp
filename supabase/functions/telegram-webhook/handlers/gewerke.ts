/**
 * handlers/gewerke.ts - Status & Gewerke Handler
 *
 * Funktionen:
 * - showGewerkStatus: Gewerk-Status-Tabelle anzeigen
 * - showAusfuehrungsarten: Ausführungsarten-Tabelle anzeigen
 * - showProjektStatus: Kombinierter Projekt-Status mit Gewerken, Mängeln, Nachträgen
 */

import { sendMessage } from '../utils/telegram.ts';
import { supabase, GEWERK_SPALTEN, GEWERK_KOMBINIERT, AUSFUEHRUNGSART_SPALTEN } from '../constants.ts';
import { gewerkStatusEmoji, extractMondayText, getAusfuehrungStatus, extractATBS, extractFieldText } from '../utils/helpers.ts';
import type { Session } from '../types.ts';

/**
 * Zeigt die Gewerk-Status-Tabelle für ein Projekt
 */
export async function showGewerkStatus(chatId: number, projektId: string): Promise<void> {
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .eq('id', projektId)
    .single();

  if (!projekt) {
    await sendMessage(chatId, 'Projekt nicht gefunden.');
    return;
  }

  const atbs = extractATBS(projekt.column_values) || projektId.substring(0, 8);
  const columnValues = projekt.column_values || {};

  // Baue Gewerk-Status-Tabelle
  let tableText = `<b>🏗️ Gewerk-Status ${atbs}</b>\n\n`;
  tableText += `<pre>`;
  tableText += `┌─────────────────┬────────────┐\n`;
  tableText += `│ Gewerk          │ Status     │\n`;
  tableText += `├─────────────────┼────────────┤\n`;

  for (const [gewerkName, spalteId] of Object.entries(GEWERK_SPALTEN)) {
    const status = extractFieldText(columnValues, spalteId);
    const emoji = gewerkStatusEmoji(status);
    const statusDisplay = status ? `${emoji} ${status.substring(0, 8)}` : '-';
    // Padding für Tabellen-Layout
    const namePadded = gewerkName.padEnd(15);
    const statusPadded = statusDisplay.padEnd(10);
    tableText += `│ ${namePadded} │ ${statusPadded} │\n`;
  }

  tableText += `└─────────────────┴────────────┘\n`;
  tableText += `</pre>\n\n`;
  tableText += `<i>✅ Fertig | 🔨 In Arbeit | ⏳ Geplant | ⚠️ Verspätet</i>`;

  await sendMessage(chatId, tableText, {
    reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Zurück zum Projekt", callback_data: `bau:open:${projektId}` }]
    ] }
  });
}

/**
 * Zeigt die Ausführungsarten-Tabelle für ein Projekt
 */
export async function showAusfuehrungsarten(chatId: number, session: Session, projektId: string): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  if (!projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

  // Monday-Daten laden
  const { data: projekt, error } = await supabase
    .from('monday_bauprozess')
    .select('column_values')
    .eq('id', projektId)
    .single();

  if (error || !projekt) {
    await sendMessage(chatId, '⚠️ Projekt nicht gefunden.');
    return;
  }

  const columnValues = projekt.column_values as Record<string, unknown>;

  // Tabelle erstellen mit Unicode Box-Drawing
  let table = `<b>📐 Ausführungsarten ${projektNr}</b>\n\n`;
  table += `<pre>`;
  table += `┌──────────┬────────────────┬────────┐\n`;
  table += `│ Gewerk   │ Ausführung     │ Status │\n`;
  table += `├──────────┼────────────────┼────────┤\n`;

  for (const [_key, config] of Object.entries(AUSFUEHRUNGSART_SPALTEN)) {
    const rawValue = extractMondayText(columnValues[config.id]);
    const status = getAusfuehrungStatus(rawValue);

    // Formatierung für feste Spaltenbreiten
    const gewerk = (config.icon + ' ' + config.label).padEnd(8).substring(0, 8);
    const ausfuehrung = rawValue.padEnd(14).substring(0, 14);
    const statusText = status.emoji;

    table += `│ ${gewerk} │ ${ausfuehrung} │   ${statusText}   │\n`;
  }

  table += `└──────────┴────────────────┴────────┘`;
  table += `</pre>\n\n`;
  table += `<i>Legende: ✅ Fertig | 🔨 Läuft | ⏳ Geplant | ➖ Ohne</i>`;

  await sendMessage(chatId, table, {
    reply_markup: { inline_keyboard: [
      [{ text: "📊 Zurück zum Status", callback_data: "bau:status" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] }
  });
}

/**
 * Zeigt den kombinierten Projekt-Status mit Gewerken, Mängeln, Nachträgen
 */
export async function showProjektStatus(chatId: number, session: Session): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  if (!bvId || !projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

  // Mängel, Nachträge, Nachweise zählen
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

  // Monday-Daten für Gewerk-Status laden
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('column_values')
    .eq('id', bvId)
    .single();

  const columnValues = projekt?.column_values as Record<string, unknown> || {};
  const projektName = session?.modus_daten?.projekt_name || '';
  const phase = session?.modus_daten?.projekt_phase || '?';

  // Gewerk-Tabelle erstellen (Plan + Ist)
  let gewerkTable = `<pre>`;
  gewerkTable += `┌────────┬───────────┬──────────┐\n`;
  gewerkTable += `│Gewerk  │Plan       │Ist       │\n`;
  gewerkTable += `├────────┼───────────┼──────────┤\n`;

  for (const [_key, config] of Object.entries(GEWERK_KOMBINIERT)) {
    const planRaw = config.ausfuehrungId ? extractMondayText(columnValues[config.ausfuehrungId]) : '-';
    const istRaw = config.statusId ? extractMondayText(columnValues[config.statusId]) : '-';

    // Kürzen und Status-Emoji hinzufügen
    const istStatus = getAusfuehrungStatus(istRaw);
    const planDisplay = (planRaw === '-' ? '-' : planRaw.substring(0, 9)).padEnd(9);
    const istDisplay = (istStatus.emoji + ' ' + istRaw.substring(0, 6)).padEnd(8);
    const gewerkDisplay = (config.icon + config.label.substring(0, 5)).padEnd(6);

    gewerkTable += `│${gewerkDisplay}│${planDisplay}│${istDisplay}│\n`;
  }

  gewerkTable += `└────────┴───────────┴──────────┘`;
  gewerkTable += `</pre>`;

  await sendMessage(chatId,
    `<b>📊 Status: ${projektNr}</b>\n` +
    `${projektName}\n\n` +
    `<b>Phase:</b> ${phase}\n\n` +
    `<b>🏗️ Gewerke:</b>\n` +
    gewerkTable + `\n\n` +
    `<b>🔧 Mängel:</b> ${maengelOffen || 0} offen / ${maengelGesamt || 0} ges.\n` +
    `<b>📋 Nachträge:</b> ${nachtraegeOffen || 0} offen / ${nachtraegeGesamt || 0} ges.\n` +
    `<b>📸 Nachweise:</b> ${nachweiseCount || 0}\n\n` +
    `<i>Legende: ✅Fertig 🔨Läuft ⏳Geplant ➖Ohne</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );
}
