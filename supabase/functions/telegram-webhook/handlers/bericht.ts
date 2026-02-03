/**
 * handlers/bericht.ts - Berichte & NU-Kommunikation Handler
 *
 * Funktionen:
 * - startBerichtErstellung: Bericht-Modus starten
 * - handleBerichtText: Bericht-Text verarbeiten und speichern
 * - showNachrichtNuMenu: NU-Nachricht-Menü anzeigen
 * - handleNuNachrichtTemplate: Vordefinierte NU-Nachricht senden
 * - startEigeneNachrichtNU: Eigene NU-Nachricht-Modus starten
 * - handleEigeneNachrichtNU: Eigene NU-Nachricht verarbeiten
 * - sendNachrichtAnNU: Nachricht an NU senden
 */

import { sendMessage } from '../utils/telegram.ts';
import { updateSession } from '../utils/session.ts';
import { supabase } from '../constants.ts';
import { getGemeldetVon } from '../utils/auth.ts';
import { showBaustellenMenu } from './start.ts';
import type { Session } from '../types.ts';

/**
 * Startet den Bericht-Erfassungsmodus
 */
export async function startBerichtErstellung(chatId: number, session: Session): Promise<void> {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'bericht_erfassen',
    modus_daten: {
      ...session?.modus_daten,
    }
  });

  await sendMessage(chatId,
    `<b>📝 Bericht erstellen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Beschreibe deine Begehung per Text oder Sprachnachricht.\n\n` +
    `💡 <i>Beispiel: "Estrich getrocknet, Elektrik Rohinstallation fertig, Sanitär beginnt morgen."</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Verarbeitet Bericht-Text und speichert ihn
 */
export async function handleBerichtText(chatId: number, session: Session, text: string): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;

  // Ermittle Ersteller basierend auf Kontakt
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);

  // Generiere Bericht-Titel mit Datum
  const heute = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const titel = `Baustellenbegehung ${heute}`;

  // Speichere in dokumente-Tabelle
  // Hinweis: 'titel' existiert nicht als Spalte, daher in datei_name speichern
  const { data: newDokument, error } = await supabase
    .from('dokumente')
    .insert({
      id: crypto.randomUUID(),
      atbs_nummer: projektNr,
      art_des_dokuments: 'BERICHT',
      dokument_nr: `BERICHT-${projektNr}-${Date.now()}`,
      datei_name: titel,
      notizen: text,
      quelle: 'telegram',
      datum_erstellt: new Date().toISOString().split('T')[0],
    })
    .select('id, dokument_nr')
    .single();

  if (error || !newDokument) {
    console.error('Bericht error:', error);
    await sendMessage(chatId, 'Fehler beim Speichern des Berichts.');
    return;
  }

  console.log(`[v59] Bericht erstellt: ${newDokument.dokument_nr} von ${melder_name} (${gemeldet_von})`);

  // Zurück zum Baustellen-Menü
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: session?.modus_daten
  });

  await sendMessage(chatId,
    `<b>✅ Bericht gespeichert!</b>\n\n` +
    `Titel: ${titel}\n` +
    `Projekt: ${projektNr}\n` +
    `Erstellt von: ${melder_name}\n\n` +
    `<i>${text.substring(0, 200)}${text.length > 200 ? '...' : ''}</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📝 Weiteren Bericht erstellen", callback_data: "bau:bericht" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Zeigt das NU-Nachricht-Menü
 */
export async function showNachrichtNuMenu(chatId: number, session: Session): Promise<void> {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  const projektNr = session?.modus_daten?.projekt_nr;

  await sendMessage(chatId,
    `<b>📨 Nachricht an NU für ${projektNr}</b>\n\n` +
    `Wähle eine vordefinierte Nachricht oder schreibe eine eigene:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📅 Termin verschieben", callback_data: "nu:msg:termin" }],
      [{ text: "🚚 Material morgen geliefert", callback_data: "nu:msg:material" }],
      [{ text: "⚠️ Bitte dringend anrufen", callback_data: "nu:msg:dringend" }],
      [{ text: "✏️ Eigene Nachricht", callback_data: "nu:msg:eigene" }],
      [{ text: "⬅️ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Verarbeitet vordefinierte NU-Nachricht-Templates
 */
export async function handleNuNachrichtTemplate(chatId: number, session: Session, templateKey: string): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;
  const _projektName = session?.modus_daten?.projekt_name || '';

  const templates: Record<string, string> = {
    'termin': `📅 Termin ${projektNr}: Der Termin muss leider verschoben werden. Bitte melde dich für eine Neuplanung.`,
    'material': `🚚 Material ${projektNr}: Das benötigte Material wird morgen geliefert. Bitte entsprechend einplanen.`,
    'dringend': `⚠️ Dringend ${projektNr}: Bitte ruf mich dringend zurück! Es gibt ein wichtiges Thema zu besprechen.`,
  };

  const nachricht = templates[templateKey];
  if (!nachricht) {
    await sendMessage(chatId, 'Unbekanntes Template.');
    return;
  }

  await sendNachrichtAnNU(chatId, session, nachricht);
}

/**
 * Startet den Modus für eigene NU-Nachricht
 */
export async function startEigeneNachrichtNU(chatId: number, session: Session): Promise<void> {
  await updateSession(chatId, {
    aktueller_modus: 'nu_nachricht_eigene',
    modus_daten: session?.modus_daten
  });

  await sendMessage(chatId,
    `<b>✏️ Eigene Nachricht an NU</b>\n\n` +
    `Gib deine Nachricht ein (Text oder Sprachnachricht):`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:nachricht:nu" }]
    ] } }
  );
}

/**
 * Verarbeitet eigene NU-Nachricht
 */
export async function handleEigeneNachrichtNU(chatId: number, session: Session, text: string): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachricht = `📨 ${projektNr}: ${text}`;
  await sendNachrichtAnNU(chatId, session, nachricht);
}

/**
 * Sendet eine Nachricht an den Nachunternehmer
 */
export async function sendNachrichtAnNU(chatId: number, session: Session, nachricht: string): Promise<void> {
  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  try {
    // 1. Hole Nachunternehmer aus monday_bauprozess (nu_ Präfix)
    const { data: projekt } = await supabase
      .from('monday_bauprozess')
      .select('nu_firma')
      .eq('id', bvId)
      .single();

    if (!projekt?.nu_firma) {
      await sendMessage(chatId,
        `⚠️ Kein Nachunternehmer für ${projektNr} hinterlegt.\n\n` +
        `Bitte in Monday.com einen NU zuweisen.`,
        { reply_markup: { inline_keyboard: [
          [{ text: "⬅️ Zurück", callback_data: "bau:menu" }]
        ] } }
      );
      return;
    }

    const nuName = projekt.nu_firma;

    // 2. Suche NU in kontakte-Tabelle und hole telegram_chat_id
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('id, vorname, nachname, telegram_chat_id')
      .or(`nachname.ilike.%${nuName}%,firma.ilike.%${nuName}%`)
      .eq('rolle', 'NU')
      .limit(1)
      .single();

    if (!kontakt?.telegram_chat_id) {
      const kontaktName = kontakt ? `${kontakt.vorname || ''} ${kontakt.nachname || ''}`.trim() : nuName;
      await sendMessage(chatId,
        `⚠️ Keine Telegram-Verknüpfung für NU "${kontaktName}" gefunden.\n\n` +
        `Der NU muss zuerst den Bot starten, damit Nachrichten gesendet werden können.`,
        { reply_markup: { inline_keyboard: [
          [{ text: "⬅️ Zurück", callback_data: "bau:menu" }]
        ] } }
      );
      return;
    }

    const nuChatId = kontakt.telegram_chat_id;
    const nuVollname = `${kontakt.vorname || ''} ${kontakt.nachname || ''}`.trim() || nuName;

    // 3. Sende Nachricht an NU
    const response = await sendMessage(nuChatId, nachricht);

    if (response.ok) {
      // Zurück zum Menü
      await updateSession(chatId, {
        aktueller_modus: 'baustelle',
        modus_daten: session?.modus_daten
      });

      await sendMessage(chatId,
        `<b>✅ Nachricht gesendet!</b>\n\n` +
        `An: ${nuVollname}\n` +
        `Projekt: ${projektNr}\n\n` +
        `<i>${nachricht.substring(0, 100)}${nachricht.length > 100 ? '...' : ''}</i>`,
        { reply_markup: { inline_keyboard: [
          [{ text: "📨 Weitere Nachricht", callback_data: "bau:nachricht:nu" }],
          [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
        ] } }
      );
    } else {
      await sendMessage(chatId, '❌ Fehler beim Senden der Nachricht.');
    }

  } catch (e) {
    console.error('Error sending message to NU:', e);
    await sendMessage(chatId,
      `❌ Fehler beim Senden der Nachricht.\n\n${(e as Error).message}`,
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Zurück", callback_data: "bau:menu" }]
      ] } }
    );
  }
}
