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
import { getOrCreateSession, updateSession, resetSession, updateLetzteAktion, addProjektToHistorie, getExtendedSession, setPendingFoto } from './utils/session.ts';
import { transcribeVoice } from './utils/openai.ts';
import { t, createInlineKeyboard } from './utils/responses.ts';
import { analyzeIntent, quickIntentCheck, type IntentAnalysis } from './utils/intent_detection.ts';

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
  closeProjekt,
  findProjektFuzzy
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
  handleMangelFoto,
  createMangelFromIntent
} from './handlers/mangel.ts';

// Nachtrag Handlers
import {
  startNachtragErfassung,
  handleNachtragText,
  handleNachtragFoto,
  saveNachtrag,
  createNachtragFromIntent
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

// Auth imports
import { checkTelegramAccess, getKontaktByChatId } from './utils/auth.ts';

// ============================================
// Intent-Based Routing (One-Shot Commands)
// ============================================

/**
 * Intent-basierte Verarbeitung (One-Shot Commands)
 * Wird VOR dem Modus-Routing aufgerufen
 * @returns true wenn Intent verarbeitet wurde, false für Fallback auf Modus-Routing
 */
async function handleIntentBasedRouting(
  chatId: number,
  session: Session,
  text: string
): Promise<boolean> {
  // 1. Quick-Check für eindeutige Patterns (kein GPT)
  const quickIntent = quickIntentCheck(text);

  if (quickIntent === 'ABBRECHEN') {
    await resetSession(chatId);
    await sendMessage(chatId, t('AKTION_ABGEBROCHEN', 'DE'));
    await showBaustellenMenu(chatId, session);
    return true;
  }

  if (quickIntent === 'LISTE_MAENGEL') {
    await listMaengelCommand(chatId, session);
    return true;
  }

  if (quickIntent === 'LISTE_NACHTRAEGE') {
    await listNachtraegeCommand(chatId, session);
    return true;
  }

  if (quickIntent === 'STATUS_ABFRAGEN') {
    await showProjektStatus(chatId, session);
    return true;
  }

  // 2. Full Intent-Detection für komplexere Eingaben
  // Nur wenn Text "interessant" genug ist (nicht nur einzelne Wörter)
  if (text.length < 5 || /^\//.test(text)) {
    return false; // Zu kurz oder Command → Modus-Routing
  }

  // Wenn bereits in einem Modus (außer baustelle), kein Intent-Routing
  // um laufende Workflows nicht zu unterbrechen
  const modus = session?.aktueller_modus;
  if (modus && !['baustelle', 'baustelle_auswahl', null].includes(modus)) {
    console.log(`[Router] Modus aktiv (${modus}), kein Intent-Routing`);
    return false;
  }

  try {
    console.log(`[Router] Intent-Detection für: "${text.substring(0, 50)}..."`);

    const intent = await analyzeIntent(text, {
      aktuelles_bv_id: session?.aktuelles_bv_id || undefined,
      letzte_aktion: session?.letzte_aktion || undefined
    });

    console.log(`[Router] Intent: ${intent.intent} (confidence: ${intent.confidence})`);

    // Nur verarbeiten wenn Confidence hoch genug
    if (intent.confidence < 0.5) {
      console.log('[Router] Confidence zu niedrig, Fallback auf Modus-Routing');
      return false;
    }

    // Followup-Logging
    if (intent.is_followup) {
      console.log(`[Router] Followup-Eingabe erkannt für ${intent.intent}`);
    }

    // Intent-basierte Aktionen
    switch (intent.intent) {
      case 'MANGEL_MELDEN': {
        // Projekt prüfen - NEU: Bei Followup aus Session
        let projektNr = intent.projekt?.atbs;

        if (!projektNr && intent.is_followup) {
          // Followup: Projekt aus letzter Aktion oder Historie
          projektNr = session?.letzte_aktion?.projekt_nr || session?.projekt_historie?.[0]?.atbs;
          if (projektNr) {
            console.log(`[Router] Followup erkannt, nutze Projekt ${projektNr} aus Session`);
            if (!intent.projekt) intent.projekt = {};
            intent.projekt.atbs = projektNr;
          }
        }

        if (!projektNr) {
          projektNr = session?.modus_daten?.projekt_nr;
        }

        if (!projektNr && intent.projekt?.search_term) {
          // Projekt aus Text suchen falls search_term vorhanden
          const result = await findProjektFuzzy(intent.projekt.search_term);
          if (result.found && result.projekt) {
            projektNr = result.projekt.atbs_nummer;
            // Intent mit gefundenem Projekt updaten
            if (!intent.projekt) intent.projekt = {};
            intent.projekt.atbs = projektNr;
          } else if (result.multiple) {
            // Mehrere Projekte - User fragen
            const buttons = result.multiple.slice(0, 3).map(p => ([{
              text: `${p.atbs_nummer} ${p.name?.substring(0, 20) || ''}`,
              callback_data: `bau:open:${p.id}`
            }]));
            await sendMessage(chatId, t('PROJEKT_MEHRDEUTIG', 'DE'), createInlineKeyboard(buttons));
            return true;
          }
        }

        if (!projektNr) {
          await sendMessage(chatId, t('PROJEKT_BENOETIGT', 'DE'));
          return true;
        }

        await createMangelFromIntent(chatId, session, intent);
        return true;
      }

      case 'NACHTRAG_ERFASSEN': {
        // Projekt prüfen - NEU: Bei Followup aus Session
        let projektNr = intent.projekt?.atbs;

        if (!projektNr && intent.is_followup) {
          // Followup: Projekt aus letzter Aktion oder Historie
          projektNr = session?.letzte_aktion?.projekt_nr || session?.projekt_historie?.[0]?.atbs;
          if (projektNr) {
            console.log(`[Router] Followup erkannt, nutze Projekt ${projektNr} aus Session`);
            if (!intent.projekt) intent.projekt = {};
            intent.projekt.atbs = projektNr;
          }
        }

        if (!projektNr) {
          projektNr = session?.modus_daten?.projekt_nr;
        }

        if (!projektNr && intent.projekt?.search_term) {
          const result = await findProjektFuzzy(intent.projekt.search_term);
          if (result.found && result.projekt) {
            projektNr = result.projekt.atbs_nummer;
            if (!intent.projekt) intent.projekt = {};
            intent.projekt.atbs = projektNr;
          } else if (result.multiple) {
            const buttons = result.multiple.slice(0, 3).map(p => ([{
              text: `${p.atbs_nummer} ${p.name?.substring(0, 20) || ''}`,
              callback_data: `bau:open:${p.id}`
            }]));
            await sendMessage(chatId, t('PROJEKT_MEHRDEUTIG', 'DE'), createInlineKeyboard(buttons));
            return true;
          }
        }

        if (!projektNr) {
          await sendMessage(chatId, t('PROJEKT_BENOETIGT', 'DE'));
          return true;
        }

        await createNachtragFromIntent(chatId, session, intent);
        return true;
      }

      case 'PROJEKT_OEFFNEN': {
        const searchTerm = intent.projekt?.atbs || intent.projekt?.search_term;
        if (searchTerm) {
          const result = await findProjektFuzzy(searchTerm);
          if (result.found && result.projekt) {
            // Projekt öffnen (bestehende Logik nutzen)
            await openProjekt(chatId, result.projekt);
            return true;
          } else if (result.multiple) {
            const buttons = result.multiple.slice(0, 5).map(p => ([{
              text: `${p.atbs_nummer} ${p.name?.substring(0, 20) || ''}`,
              callback_data: `bau:open:${p.id}`
            }]));
            await sendMessage(chatId, t('PROJEKT_MEHRDEUTIG', 'DE'), createInlineKeyboard(buttons));
            return true;
          } else {
            await sendMessage(chatId, t('PROJEKT_NICHT_GEFUNDEN', 'DE', { search: searchTerm }));
            return true;
          }
        }
        return false;
      }

      case 'STATUS_ABFRAGEN': {
        // Status für aktuelles Projekt oder aus Intent
        const projektNr = intent.projekt?.atbs || session?.modus_daten?.projekt_nr;
        if (projektNr || session?.aktuelles_bv_id) {
          await showProjektStatus(chatId, session);
          return true;
        }
        // Kein Projekt - zeige Hauptmenü
        await sendMessage(chatId, t('PROJEKT_KEIN_AKTIVES', 'DE'));
        return true;
      }

      case 'LISTE_MAENGEL': {
        await listMaengelCommand(chatId, session);
        return true;
      }

      case 'LISTE_NACHTRAEGE': {
        await listNachtraegeCommand(chatId, session);
        return true;
      }

      case 'KORREKTUR': {
        const letzteAktion = session?.letzte_aktion;

        if (!letzteAktion || !intent.correction) {
          await sendMessage(chatId, 'Keine vorherige Aktion zum Korrigieren gefunden.');
          return true;
        }

        // Prüfe ob Aktion nicht zu alt (max 30 Min)
        const aktionTime = new Date(letzteAktion.timestamp).getTime();
        const now = Date.now();
        if (now - aktionTime > 30 * 60 * 1000) {
          await sendMessage(chatId, 'Die letzte Aktion ist zu lange her für eine Korrektur.');
          return true;
        }

        const { field, new_value } = intent.correction;
        console.log(`[Router] Korrektur: ${letzteAktion.typ} ${letzteAktion.id}, ${field} → ${new_value}`);

        try {
          // Je nach Typ unterschiedliche Tabelle
          const table = letzteAktion.typ === 'mangel' ? 'maengel_unified' :
                        letzteAktion.typ === 'nachtrag' ? 'nachtraege' : null;

          if (!table) {
            await sendMessage(chatId, `Korrektur für "${letzteAktion.typ}" nicht unterstützt.`);
            return true;
          }

          // Feld-Mapping (was darf korrigiert werden)
          const allowedFields: Record<string, string> = {
            'raum': 'raum',
            'zimmer': 'raum',
            'gewerk': 'gewerk',
            'beschreibung': 'beschreibung',
            'text': 'beschreibung'
          };

          const dbField = allowedFields[field.toLowerCase()];
          if (!dbField) {
            await sendMessage(chatId, `Feld "${field}" kann nicht korrigiert werden. Erlaubt: Raum, Gewerk, Beschreibung`);
            return true;
          }

          // Alten Wert für Anzeige holen
          const idField = letzteAktion.typ === 'mangel' ? 'mangel_nr' : 'nachtrag_nr';
          const { data: existingRecord } = await supabase
            .from(table)
            .select(dbField)
            .eq(idField, letzteAktion.id)
            .single();

          const altWert = existingRecord?.[dbField] || '(unbekannt)';

          // Update durchführen
          const { error } = await supabase
            .from(table)
            .update({ [dbField]: new_value })
            .eq(idField, letzteAktion.id);

          if (error) {
            console.error('[Router] Korrektur-Fehler:', error);
            await sendMessage(chatId, t('KORREKTUR_FEHLGESCHLAGEN', 'DE', { grund: error.message }));
            return true;
          }

          // Erfolg
          await sendMessage(chatId, t('KORREKTUR_ERFOLGREICH', 'DE', {
            nr: String(letzteAktion.id || ''),
            feld: dbField,
            alt: altWert,
            neu: new_value
          }));

          console.log(`[Router] Korrektur erfolgreich: ${letzteAktion.id} ${dbField}=${new_value}`);
          return true;

        } catch (e) {
          console.error('[Router] Korrektur Exception:', e);
          await sendMessage(chatId, t('KORREKTUR_FEHLGESCHLAGEN', 'DE', { grund: 'Interner Fehler' }));
          return true;
        }
      }

      case 'UNBEKANNT':
      default:
        // Fallback auf Modus-Routing
        return false;
    }
  } catch (error) {
    console.error('[Router] Intent-Fehler:', error);
    return false; // Fallback auf Modus-Routing
  }
}

// ============================================
// Callback Query Handler
// ============================================

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const chatId = update.callback_query!.message!.chat.id;
  const data = update.callback_query!.data!;
  const callbackId = update.callback_query!.id;
  const session = await getOrCreateSession(chatId) as Session;

  // ============================================
  // ACCESS CONTROL für Callbacks
  // ============================================
  const accessResult = await checkTelegramAccess(chatId);
  if (!accessResult.allowed) {
    await answerCallbackQuery(callbackId, 'Zugriff nicht berechtigt');
    return;
  }

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

  // Foto zur letzten Aktion hinzufügen (Kontext-basiert)
  if (data === 'foto:zu_letzter_aktion') {
    const letzteAktion = session?.letzte_aktion;
    const pendingFoto = session?.pending_foto;

    if (!letzteAktion || !pendingFoto) {
      await answerCallbackQuery(callbackId, 'Fehler');
      await sendMessage(chatId, '❌ Keine Aktion oder Foto gefunden. Bitte erneut versuchen.');
      return;
    }

    await answerCallbackQuery(callbackId, 'Foto wird hinzugefügt...');

    try {
      const fileId = pendingFoto.file_id;
      const typ = letzteAktion.typ;
      const id = letzteAktion.id;

      if (typ === 'mangel' && id) {
        // Foto zu Mangel hinzufügen
        await addFotoToMangel(chatId, session, id, fileId);
      } else if (typ === 'nachtrag' && id) {
        // Foto zu Nachtrag hinzufügen
        await addFotoToNachtrag(chatId, session, id, fileId);
      } else {
        await sendMessage(chatId, '❌ Unbekannter Aktionstyp.');
      }

      // Pending Foto löschen
      await setPendingFoto(chatId, null);

    } catch (error) {
      console.error('[Callback] Fehler bei foto:zu_letzter_aktion:', error);
      await sendMessage(chatId, '❌ Fehler beim Hinzufügen des Fotos.');
      await setPendingFoto(chatId, null);
    }
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
      version: 'v91-phase2'
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

      // ============================================
      // ACCESS CONTROL - Prüfe ob User berechtigt ist
      // ============================================
      // /start erlauben um Verifizierungs-Info anzuzeigen
      if (!text.startsWith('/start')) {
        const accessResult = await checkTelegramAccess(chatId);

        if (!accessResult.allowed) {
          // User nicht berechtigt - Grund-spezifische Nachricht
          if (accessResult.reason === 'disabled') {
            await sendMessage(chatId,
              '🔒 <b>Zugriff deaktiviert</b>\n\n' +
              'Dein Telegram-Zugang wurde vom Administrator deaktiviert.\n\n' +
              'Bitte kontaktiere die neurealis GmbH falls du Zugriff benötigst.'
            );
          } else {
            await sendMessage(chatId,
              '🔒 <b>Zugriff nicht berechtigt</b>\n\n' +
              'Du bist nicht für den neurealis Bot freigeschaltet.\n\n' +
              'Bitte kontaktiere die neurealis GmbH um Zugriff zu erhalten.'
            );
          }
          return new Response('OK', { status: 200 });
        }
      }

      // Text Commands
      if (text.startsWith('/start')) {
        // Bei /start: Access prüfen und ggf. Verifizierungs-Info anzeigen
        const accessResult = await checkTelegramAccess(chatId);

        if (!accessResult.allowed) {
          if (accessResult.reason === 'disabled') {
            await sendMessage(chatId,
              '🔒 <b>Zugriff deaktiviert</b>\n\n' +
              'Dein Telegram-Zugang wurde vom Administrator deaktiviert.\n\n' +
              'Bitte kontaktiere die neurealis GmbH falls du wieder Zugriff benötigst.'
            );
          } else {
            await sendMessage(chatId,
              '🔒 <b>neurealis Bot - Zugriff erforderlich</b>\n\n' +
              'Um diesen Bot zu nutzen, musst du in der neurealis-Datenbank registriert sein.\n\n' +
              '<b>So erhältst du Zugriff:</b>\n' +
              '1. Kontaktiere die neurealis GmbH\n' +
              '2. Teile deine Telegram-Telefonnummer mit\n' +
              '3. Ein Administrator schaltet dich frei\n\n' +
              '💡 <i>Deine Chat-ID: ' + chatId + '</i>'
            );
          }
          return;
        }

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

        // Transkription für alle Sprachnachrichten
        await sendMessage(chatId, '⏳ Sprachnachricht wird transkribiert...');
        const fileData = await downloadTelegramFile(update.message.voice.file_id);

        if (!fileData) {
          await sendMessage(chatId, 'Fehler beim Herunterladen der Sprachnachricht.');
        } else {
          const transcript = await transcribeVoice(fileData.base64, 'audio/ogg');

          if (!transcript) {
            await sendMessage(chatId, 'Fehler bei der Transkription. Bitte versuche es erneut.');
          } else {
            console.log(`[Voice] Transkription: "${transcript.substring(0, 100)}..."`);

            // Modus-spezifische Verarbeitung
            if (modus === 'mangel_erfassen') {
              await handleMangelText(chatId, session, transcript);
            } else if (modus === 'nachtrag_erfassen') {
              await handleNachtragText(chatId, session, transcript);
            } else if (modus === 'bericht_erfassen') {
              await handleBerichtText(chatId, session, transcript);
            } else if (modus === 'nu_nachricht_eigene') {
              await handleEigeneNachrichtNU(chatId, session, transcript);
            }
            // NEU: Intent-Routing für Sprachnachrichten ohne aktiven Modus
            else if (!modus || ['baustelle', 'baustelle_auswahl'].includes(modus)) {
              const intentHandled = await handleIntentBasedRouting(chatId, session, transcript);
              if (!intentHandled) {
                // Fallback: Intent nicht erkannt
                await sendMessage(chatId, t('INTENT_UNKLAR', 'DE') ||
                  `Ich habe deine Sprachnachricht nicht verstanden.\n\n` +
                  `/start - Hauptmenü\n/hilfe - Alle Befehle`);
              }
            }
            else {
              // Anderer Modus aktiv, der keine Sprachnachrichten unterstützt
              await sendMessage(chatId,
                'Sprachnachrichten werden im aktuellen Modus nicht unterstützt.\n\n' +
                'Nutze /start für das Hauptmenü oder /abbrechen um den aktuellen Vorgang zu beenden.'
              );
            }
          }
        }
      }

      // Photo Messages
      else if (update.message.photo) {
        const modus = session?.aktueller_modus;
        const photos = update.message.photo;
        const caption = update.message.caption;

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
          await handleMangelFoto(chatId, session, photos);
        }
        else if (modus === 'nachtrag_foto') {
          await handleNachtragFoto(chatId, session, photos);
        }
        else if (modus === 'nachweis_foto') {
          await handleNachweisFoto(chatId, session, photos);
        }
        else if (modus === 'abnahme_foto') {
          await handleAbnahmeFoto(chatId, session, photos);
        }
        else if (modus === 'bedarfsanalyse' || modus === 'bedarfsanalyse_fotos') {
          await handleBedarfsanalysePhoto(chatId, session, photos);
        }
        // Foto-Warte-Modi für weiteres Foto zu bestehendem Nachtrag/Mangel
        else if (modus === 'foto_warte_nachtrag' || modus === 'foto_warte_mangel') {
          await handleFotoInWarteModus(chatId, session, photos);
        }
        // ============================================
        // NEU: Foto ohne Text - Kontext-basierte Zuweisung
        // ============================================
        else if (!caption && session?.letzte_aktion) {
          // Prüfe ob letzte Aktion nicht zu alt (max 10 Min)
          const aktionTime = new Date(session.letzte_aktion.timestamp).getTime();
          const now = Date.now();

          if (now - aktionTime < 10 * 60 * 1000) {
            // Letzte Aktion ist aktuell - Kontext-basierte Zuweisung anbieten
            const typ = session.letzte_aktion.typ;
            const id = session.letzte_aktion.id;

            // Nur für Mängel und Nachträge relevant
            if ((typ === 'mangel' || typ === 'nachtrag') && id) {
              // Foto in Session speichern für spätere Zuweisung
              await setPendingFoto(chatId, photos[photos.length - 1].file_id);

              const typLabel = typ === 'mangel' ? 'Mangel' : 'Nachtrag';
              const buttons = [
                [{ text: `✅ Ja, zu ${id}`, callback_data: 'foto:zu_letzter_aktion' }],
                [{ text: '❌ Nein, anderes Ziel', callback_data: 'foto:menu' }]
              ];

              await sendMessage(
                chatId,
                `📷 Foto zu ${typLabel} <b>${id}</b> hinzufügen?`,
                { reply_markup: { inline_keyboard: buttons } }
              );
            } else {
              // Letzte Aktion war kein Mangel/Nachtrag - Standard-Menu
              await showFotoAuswahlMenu(chatId, session, photos);
            }
          } else {
            // Letzte Aktion ist zu alt - Standard-Menu
            await showFotoAuswahlMenu(chatId, session, photos);
          }
        }
        // Default: Wenn Projekt geöffnet ist, zeige Auswahl-Menü
        else if (session?.aktuelles_bv_id) {
          await showFotoAuswahlMenu(chatId, session, photos);
        }
        else {
          // Kein Projekt geöffnet: Trotzdem Auswahl-Menü zeigen (mit eingeschränkten Optionen)
          await showFotoAuswahlMenu(chatId, session, photos);
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

        // ============================================
        // INTENT-ROUTING VOR MODUS-ROUTING
        // ============================================
        // Versuche Intent-Detection für One-Shot Commands
        // nur wenn kein aktiver Workflow läuft
        if (!modus || ['baustelle', 'baustelle_auswahl'].includes(modus)) {
          const intentHandled = await handleIntentBasedRouting(chatId, session, text);
          if (intentHandled) {
            return new Response('OK', { status: 200 });
          }
        }

        // ============================================
        // MODUS-BASIERTES ROUTING (Bestehend)
        // ============================================
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
          // Fallback: Intent nicht erkannt, kein Modus aktiv
          await sendMessage(chatId, t('INTENT_UNKLAR', 'DE') ||
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
