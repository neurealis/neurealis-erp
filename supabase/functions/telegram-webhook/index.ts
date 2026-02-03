/**
 * telegram-webhook router.ts - Haupt-Router
 *
 * Deno.serve Entry-Point und Routing-Logik
 * Importiert alle Handler und routet basierend auf:
 * - Text-Commands (/start, /help, /sync, /status, /abbrechen, /briefing)
 * - Callback-Data (bau:*, mangel:*, nachtrag:*, etc.)
 * - Session-Modus (aufmass, bedarfsanalyse, etc.)
 * - Photos/Documents
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Constants & Utils
import { supabase, SUPABASE_URL, SUPABASE_KEY, NACHWEIS_TYP_LABELS, ABNAHME_TYP_LABELS } from './constants.ts';
import { sendMessage, answerCallbackQuery, downloadTelegramFile } from './utils/telegram.ts';
import { getOrCreateSession, updateSession } from './utils/session.ts';
import { transcribeVoice } from './utils/openai.ts';

// Start & Navigation Handlers
import {
  handleStart,
  handleHelp,
  handleSync,
  handleStatus,
  handleAbbrechen,
  handleBriefingCommand,
  showBaustellenMenu,
  showPhaseSelection,
  listProjekteByPhase,
  listActiveProjekte,
  startAtbsDirectInput,
  searchAndOpenProjekt,
  openProjekt,
  closeProjekt
} from './handlers/start.ts';

// Aufmaß Handlers
import {
  searchMatterportProject,
  handleCsvUpload,
  handleAufmassSelect,
  handleAufmassCreate,
  handleAufmassView
} from './handlers/aufmass.ts';

// Bedarfsanalyse Handlers
import {
  handleBedarfsanalysePhoto,
  startOcrProcessing,
  handleOcrResult,
  callFinalizeAngebot,
  showAngebotSummary,
  listPositionen,
  showPositionDetail,
  handleSetAuftraggeber,
  handleAngebotConfirm,
  handleAngebotDiscard,
  handleAngebotExport,
  handlePositionOk,
  handlePositionRemove
} from './handlers/bedarfsanalyse.ts';

// Mangel Handlers
import {
  startMangelMeldung,
  handleMangelText,
  handleMangelFoto
} from './handlers/mangel.ts';

// Nachtrag Handlers
import {
  startNachtragErfassung,
  handleNachtragText,
  handleNachtragFoto,
  saveNachtrag
} from './handlers/nachtrag.ts';

// Nachweis Handlers
import {
  showNachweisTypen,
  handleNachweisTyp,
  handleNachweisFoto
} from './handlers/nachweis.ts';

// Abnahme Handlers
import {
  showAbnahmeTypen,
  handleAbnahmeTyp,
  handleAbnahmeFoto
} from './handlers/abnahme.ts';

// Gewerke/Status Handlers
import {
  showGewerkStatus,
  showAusfuehrungsarten,
  showProjektStatus
} from './handlers/gewerke.ts';

// Bericht & NU-Kommunikation Handlers
import {
  startBerichtErstellung,
  handleBerichtText,
  showNachrichtNuMenu,
  handleNuNachrichtTemplate,
  startEigeneNachrichtNU,
  handleEigeneNachrichtNU
} from './handlers/bericht.ts';

// Foto Handler
import {
  handleMultiFotoUpload,
  processPendingFotos
} from './handlers/foto.ts';

// Foto zu bestehendem Nachtrag/Mangel hinzufügen
import {
  showFotoAuswahlMenu,
  listOffeneNachtraege,
  listOffeneMaengel,
  addFotoToNachtrag,
  addFotoToMangel,
  setFotoWarteModus,
  handleFotoInWarteModus,
  reshowFotoMenu,
  listMaengelCommand,
  listNachtraegeCommand,
  promptFotoForMangel,
  promptFotoForNachtrag
} from './handlers/foto_hinzufuegen.ts';

// Type imports
import type { Session, TelegramUpdate } from './types.ts';

// ============================================
// Callback Query Handler
// ============================================

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const chatId = update.callback_query!.message!.chat.id;
  const data = update.callback_query!.data!;
  const callbackId = update.callback_query!.id;
  const session = await getOrCreateSession(chatId) as Session;

  // Main Menu
  if (data === 'main_menu') {
    await answerCallbackQuery(callbackId);
    await handleStart(chatId, session);
    return;
  }

  // Noop für dekorative Buttons
  if (data === 'noop') {
    await answerCallbackQuery(callbackId);
    return;
  }

  // Mode Selection
  if (data === 'mode_aufmass') {
    await answerCallbackQuery(callbackId, 'Aufmaß-Modus');
    await updateSession(chatId, { aktueller_modus: 'aufmass', modus_daten: {} });
    await sendMessage(chatId, `<b>Aufmaß-Modus</b>\n\nGib eine ATBS-Nummer oder Adresse ein:`);
    return;
  }

  if (data === 'mode_bedarfsanalyse') {
    await answerCallbackQuery(callbackId, 'Bedarfsanalyse-Modus');
    await updateSession(chatId, { aktueller_modus: 'bedarfsanalyse', modus_daten: {} });
    await sendMessage(chatId, `<b>Bedarfsanalyse-Modus</b>\n\nSende ein oder mehrere Fotos des ausgefüllten Bedarfsanalysebogens.`);
    return;
  }

  if (data === 'mode_baustelle') {
    await answerCallbackQuery(callbackId, 'Baustellen-Modus');
    await showBaustellenMenu(chatId, session);
    return;
  }

  if (data === 'mode_atbs_direkt') {
    await answerCallbackQuery(callbackId);
    await startAtbsDirectInput(chatId);
    return;
  }

  // Baustellen-Navigation
  if (data === 'bau:menu') {
    await answerCallbackQuery(callbackId);
    await showBaustellenMenu(chatId, session);
    return;
  }

  if (data === 'bau:list') {
    await answerCallbackQuery(callbackId, 'Lade Projekte...');
    await listActiveProjekte(chatId, 0);
    return;
  }

  if (data.startsWith('bau:list:')) {
    const page = parseInt(data.replace('bau:list:', ''), 10);
    await answerCallbackQuery(callbackId);
    await listActiveProjekte(chatId, page);
    return;
  }

  if (data === 'bau:select_method:phase') {
    await answerCallbackQuery(callbackId);
    await showPhaseSelection(chatId);
    return;
  }

  if (data === 'bau:select_method:atbs') {
    await answerCallbackQuery(callbackId);
    await updateSession(chatId, { aktueller_modus: 'baustelle_suche', modus_daten: {} });
    await sendMessage(chatId,
      `<b>🔍 ATBS-Nummer eingeben</b>\n\n` +
      `Gib die ATBS-Nummer ein (z.B. ATBS-448 oder nur 448):`,
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Zurück", callback_data: "mode_baustelle" }]
      ] } }
    );
    return;
  }

  // Phase-Filter
  if (data.match(/^phase:\d+$/)) {
    const phaseNum = parseInt(data.replace('phase:', ''), 10);
    await answerCallbackQuery(callbackId, `Phase ${phaseNum}...`);
    await listProjekteByPhase(chatId, phaseNum, 0);
    return;
  }

  if (data.match(/^phase:\d+:\d+$/)) {
    const parts = data.split(':');
    const phaseNum = parseInt(parts[1], 10);
    const page = parseInt(parts[2], 10);
    await answerCallbackQuery(callbackId);
    await listProjekteByPhase(chatId, phaseNum, page);
    return;
  }

  // Projekt öffnen/schließen
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

  // Baustellen-Aktionen
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

  if (data === 'bau:bericht') {
    await answerCallbackQuery(callbackId);
    await startBerichtErstellung(chatId, session);
    return;
  }

  if (data === 'bau:nachricht:nu') {
    await answerCallbackQuery(callbackId);
    await showNachrichtNuMenu(chatId, session);
    return;
  }

  if (data.startsWith('nu:msg:')) {
    const templateKey = data.replace('nu:msg:', '');
    await answerCallbackQuery(callbackId);
    if (templateKey === 'eigene') {
      await startEigeneNachrichtNU(chatId, session);
    } else {
      await handleNuNachrichtTemplate(chatId, session, templateKey);
    }
    return;
  }

  if (data === 'bau:abnahme') {
    await answerCallbackQuery(callbackId);
    await showAbnahmeTypen(chatId, session);
    return;
  }

  if (data.startsWith('abnahme:')) {
    const typ = data.replace('abnahme:', '');
    await answerCallbackQuery(callbackId);
    await handleAbnahmeTyp(chatId, session, typ);
    return;
  }

  if (data === 'bau:status') {
    await answerCallbackQuery(callbackId);
    await showProjektStatus(chatId, session);
    return;
  }

  if (data === 'briefing:generate') {
    await answerCallbackQuery(callbackId);
    await handleBriefingCommand(chatId);
    return;
  }

  if (data.startsWith('bau:gewerke:')) {
    const projektId = data.replace('bau:gewerke:', '');
    await answerCallbackQuery(callbackId, 'Lade Gewerk-Status...');
    await showGewerkStatus(chatId, projektId);
    return;
  }

  if (data.startsWith('bau:ausfuehrung:')) {
    const projektId = data.replace('bau:ausfuehrung:', '');
    await answerCallbackQuery(callbackId, 'Lade Ausführungsarten...');
    await showAusfuehrungsarten(chatId, session, projektId);
    return;
  }

  // Mangel/Nachtrag Foto
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

  // Mangel Foto hinzufügen (aus /maengel Liste)
  if (data.startsWith('mangel:foto:')) {
    const mangelId = data.replace('mangel:foto:', '');
    await answerCallbackQuery(callbackId);
    await promptFotoForMangel(chatId, session, mangelId);
    return;
  }

  // Nachtrag Foto hinzufügen (aus /nachtraege Liste)
  if (data.startsWith('nachtrag:foto:')) {
    const nachtragId = data.replace('nachtrag:foto:', '');
    await answerCallbackQuery(callbackId);
    await promptFotoForNachtrag(chatId, session, nachtragId);
    return;
  }

  if (data === 'nachtrag:save') {
    await answerCallbackQuery(callbackId);
    await saveNachtrag(chatId, session);
    return;
  }

  // Nachweis
  if (data.startsWith('nachweis:')) {
    const typ = data.replace('nachweis:', '');
    await answerCallbackQuery(callbackId);
    await handleNachweisTyp(chatId, session, typ);
    return;
  }

  // ============================================
  // Foto zu bestehendem Nachtrag/Mangel Callbacks
  // ============================================

  // Foto-Auswahl Menü erneut anzeigen
  if (data === 'foto:menu') {
    await answerCallbackQuery(callbackId);
    await reshowFotoMenu(chatId, session);
    return;
  }

  // Neuen Nachtrag mit Foto erstellen
  if (data === 'foto:new_nachtrag') {
    await answerCallbackQuery(callbackId);
    await updateSession(chatId, { aktueller_modus: 'nachtrag_erfassen' });
    await sendMessage(chatId,
      `<b>📋 Nachtrag erfassen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
      `Beschreibe den Nachtrag (was wurde zusätzlich beauftragt?):`,
      { reply_markup: { inline_keyboard: [
        [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
      ] } }
    );
    return;
  }

  // Neuen Mangel mit Foto erstellen
  if (data === 'foto:new_mangel') {
    await answerCallbackQuery(callbackId);
    await updateSession(chatId, { aktueller_modus: 'mangel_erfassen' });
    await sendMessage(chatId,
      `<b>🔧 Mangel melden für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
      `Beschreibe den Mangel per Text oder Sprachnachricht.\n\n` +
      `💡 <i>Tipp: Du kannst mehrere Mängel auf einmal beschreiben.</i>`,
      { reply_markup: { inline_keyboard: [
        [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
      ] } }
    );
    return;
  }

  // Liste offene Nachträge
  if (data === 'foto:list_nachtraege') {
    await answerCallbackQuery(callbackId, 'Lade Nachträge...');
    await listOffeneNachtraege(chatId, session);
    return;
  }

  // Liste offene Mängel
  if (data === 'foto:list_maengel') {
    await answerCallbackQuery(callbackId, 'Lade Mängel...');
    await listOffeneMaengel(chatId, session);
    return;
  }

  // Foto zu bestehendem Nachtrag hinzufügen
  if (data.startsWith('foto:nachtrag:')) {
    const nachtragId = data.replace('foto:nachtrag:', '');
    await answerCallbackQuery(callbackId, 'Foto wird hinzugefügt...');
    await addFotoToNachtrag(chatId, session, nachtragId);
    return;
  }

  // Foto zu bestehendem Mangel hinzufügen
  if (data.startsWith('foto:mangel:')) {
    const mangelId = data.replace('foto:mangel:', '');
    await answerCallbackQuery(callbackId, 'Foto wird hinzugefügt...');
    await addFotoToMangel(chatId, session, mangelId);
    return;
  }

  // Weiteres Foto zu Nachtrag hinzufügen (Warte-Modus)
  if (data.startsWith('foto:more:nachtrag:')) {
    const nachtragId = data.replace('foto:more:nachtrag:', '');
    await answerCallbackQuery(callbackId);
    await setFotoWarteModus(chatId, session, 'nachtrag', nachtragId);
    return;
  }

  // Weiteres Foto zu Mangel hinzufügen (Warte-Modus)
  if (data.startsWith('foto:more:mangel:')) {
    const mangelId = data.replace('foto:more:mangel:', '');
    await answerCallbackQuery(callbackId);
    await setFotoWarteModus(chatId, session, 'mangel', mangelId);
    return;
  }

  // Aufmaß Callbacks
  if (data.startsWith('aufmass:select:')) {
    const atbs = data.replace('aufmass:select:', '');
    await answerCallbackQuery(callbackId);
    await handleAufmassSelect(chatId, atbs);
    return;
  }

  if (data.startsWith('aufmass:create:')) {
    const atbs = data.replace('aufmass:create:', '');
    await answerCallbackQuery(callbackId, 'Aufmaß erstellen');
    await handleAufmassCreate(chatId, session, atbs);
    return;
  }

  if (data.startsWith('aufmass:view:')) {
    const atbs = data.replace('aufmass:view:', '');
    await answerCallbackQuery(callbackId);
    await handleAufmassView(chatId, atbs);
    return;
  }

  // Bedarfsanalyse Callbacks
  if (data === 'ba:start_ocr') {
    await answerCallbackQuery(callbackId, 'OCR wird gestartet...');
    await startOcrProcessing(chatId, session);
    return;
  }

  if (data.startsWith('set_auftraggeber:')) {
    const parts = data.split(':');
    const bedarfsanalyseId = parts[1];
    const auftraggeber = parts.slice(2).join(':');
    await answerCallbackQuery(callbackId, `Auftraggeber: ${auftraggeber}`);
    await handleSetAuftraggeber(chatId, bedarfsanalyseId, auftraggeber);
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
    await handleAngebotConfirm(chatId, draftId);
    return;
  }

  if (data.startsWith('angebot:discard:')) {
    const draftId = data.replace('angebot:discard:', '');
    await answerCallbackQuery(callbackId, 'Angebot verworfen');
    await handleAngebotDiscard(chatId, draftId);
    return;
  }

  if (data.startsWith('angebot:export:')) {
    const draftId = data.replace('angebot:export:', '');
    await answerCallbackQuery(callbackId, 'Export wird gestartet...');
    await handleAngebotExport(chatId, draftId);
    return;
  }

  if (data.startsWith('pos:ok:')) {
    const posId = data.replace('pos:ok:', '');
    await answerCallbackQuery(callbackId, 'OK');
    await handlePositionOk(chatId, posId);
    return;
  }

  if (data.startsWith('pos:remove:')) {
    const posId = data.replace('pos:remove:', '');
    await answerCallbackQuery(callbackId, 'Entfernt');
    await handlePositionRemove(chatId, posId);
    return;
  }

  // Default
  await answerCallbackQuery(callbackId);
}

// ============================================
// Main Handler (Deno.serve)
// ============================================

Deno.serve(async (req) => {
  // GET Request - Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      bot: 'neurealis-bot',
      version: 'v89-nachtrag-preisberechnung'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Nur POST erlauben
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('Telegram update:', JSON.stringify(update).substring(0, 500));

    // Internal OCR Done Callback
    if ((update as any)._internal === 'ocr_done' && (update as any).bedarfsanalyse_id && (update as any).chat_id) {
      await handleOcrResult((update as any).chat_id, (update as any).bedarfsanalyse_id);
      return new Response('OK', { status: 200 });
    }

    // Message Handling
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      const from = update.message.from;
      const session = await getOrCreateSession(chatId, from) as Session;
      await updateSession(chatId, {});

      // Text Commands
      if (text.startsWith('/start')) {
        await handleStart(chatId, session);
      }
      else if (text.startsWith('/hilfe') || text.startsWith('/help')) {
        await handleHelp(chatId);
      }
      else if (text.startsWith('/sync')) {
        await handleSync(chatId);
      }
      else if (text.startsWith('/status')) {
        await handleStatus(chatId, session);
      }
      else if (text.startsWith('/abbrechen')) {
        await handleAbbrechen(chatId);
      }
      else if (text.startsWith('/briefing')) {
        await handleBriefingCommand(chatId);
      }
      // /maengel Command + Sprachbefehle
      else if (text === '/maengel' ||
               text.toLowerCase().includes('zeige mängel') ||
               text.toLowerCase().includes('offene mängel') ||
               text.toLowerCase().includes('alle mängel')) {
        await listMaengelCommand(chatId, session);
      }
      // /nachtraege Command + Sprachbefehle
      else if (text === '/nachtraege' ||
               text.toLowerCase().includes('zeige nachträge') ||
               text.toLowerCase().includes('offene nachträge') ||
               text.toLowerCase().includes('alle nachträge')) {
        await listNachtraegeCommand(chatId, session);
      }

      // Voice Messages
      else if (update.message.voice) {
        const modus = session?.aktueller_modus;
        if (modus === 'mangel_erfassen' || modus === 'nachtrag_erfassen' || modus === 'bericht_erfassen' || modus === 'nu_nachricht_eigene') {
          await sendMessage(chatId, '⏳ Sprachnachricht wird transkribiert...');
          const fileData = await downloadTelegramFile(update.message.voice.file_id);
          if (fileData) {
            const transcript = await transcribeVoice(fileData.base64, 'audio/ogg');
            if (transcript) {
              if (modus === 'mangel_erfassen') {
                await handleMangelText(chatId, session, transcript);
              } else if (modus === 'nachtrag_erfassen') {
                await handleNachtragText(chatId, session, transcript);
              } else if (modus === 'bericht_erfassen') {
                await handleBerichtText(chatId, session, transcript);
              } else if (modus === 'nu_nachricht_eigene') {
                await handleEigeneNachrichtNU(chatId, session, transcript);
              }
            } else {
              await sendMessage(chatId, 'Fehler bei der Transkription. Bitte versuche es erneut.');
            }
          } else {
            await sendMessage(chatId, 'Fehler beim Herunterladen der Sprachnachricht.');
          }
        } else {
          await sendMessage(chatId, 'Sprachnachrichten werden nur im Mangel-, Nachtrag-, Bericht- oder Nachricht-Modus unterstützt.');
        }
      }

      // Photo Messages
      else if (update.message.photo) {
        const modus = session?.aktueller_modus;

        // Multi-Foto-Upload Check
        const mediaGroupId = update.message?.media_group_id;
        if (mediaGroupId) {
          const multiResult = await handleMultiFotoUpload(chatId, session, update);
          if (multiResult === 'pending') {
            return new Response('OK', { status: 200 });
          }
          if (Array.isArray(multiResult) && multiResult.length > 1) {
            await processPendingFotos(chatId, session, multiResult);
            return new Response('OK', { status: 200 });
          }
        }

        // Single photo handling based on mode
        if (modus === 'mangel_foto') {
          await handleMangelFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'nachtrag_foto') {
          await handleNachtragFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'nachweis_foto') {
          await handleNachweisFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'abnahme_foto') {
          await handleAbnahmeFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'bedarfsanalyse' || modus === 'bedarfsanalyse_fotos') {
          await handleBedarfsanalysePhoto(chatId, session, update.message.photo);
        }
        // Foto-Warte-Modi für weiteres Foto zu bestehendem Nachtrag/Mangel
        else if (modus === 'foto_warte_nachtrag' || modus === 'foto_warte_mangel') {
          await handleFotoInWarteModus(chatId, session, update.message.photo);
        }
        // Default: Wenn Projekt geöffnet ist, zeige Auswahl-Menü
        else if (session?.aktuelles_bv_id) {
          await showFotoAuswahlMenu(chatId, session, update.message.photo);
        }
        else {
          // Kein Projekt geöffnet: Trotzdem Auswahl-Menü zeigen (mit eingeschränkten Optionen)
          await showFotoAuswahlMenu(chatId, session, update.message.photo);
        }
      }

      // Document Messages
      else if (update.message.document) {
        const modus = session?.aktueller_modus;
        if (modus === 'aufmass_csv_upload' || modus === 'aufmass_projekt') {
          await handleCsvUpload(chatId, session, update.message.document);
        } else {
          await sendMessage(chatId, `Dokument empfangen: ${update.message.document.file_name}\n\nWechsle zuerst in den Aufmaß-Modus über /start.`);
        }
      }

      // Text Messages (non-command)
      else if (text && !text.startsWith('/')) {
        const modus = session?.aktueller_modus;

        if (modus === 'baustelle_suche' || modus === 'atbs_direkt') {
          await searchAndOpenProjekt(chatId, text);
        }
        else if (modus === 'mangel_erfassen') {
          await handleMangelText(chatId, session, text);
        }
        else if (modus === 'nachtrag_erfassen') {
          await handleNachtragText(chatId, session, text);
        }
        else if (modus === 'bericht_erfassen') {
          await handleBerichtText(chatId, session, text);
        }
        else if (modus === 'nu_nachricht_eigene') {
          await handleEigeneNachrichtNU(chatId, session, text);
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

    // Callback Query Handling
    if (update.callback_query) {
      await handleCallbackQuery(update);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
