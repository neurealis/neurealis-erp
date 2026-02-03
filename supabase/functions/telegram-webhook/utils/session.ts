/**
 * Session Management Utilities
 */
import { supabase } from "../constants.ts";
import type { Session, TelegramUser, LetzteAktion, UserSprache } from "../types.ts";

/**
 * Holt oder erstellt eine Session für einen Chat
 */
export async function getOrCreateSession(
  chatId: number,
  from?: TelegramUser
): Promise<Session | null> {
  // Versuche bestehende Session zu laden
  const { data } = await supabase
    .from("telegram_sessions")
    .select("*")
    .eq("chat_id", chatId)
    .single();

  if (data) return data as Session;

  // Erstelle neue Session
  const { data: newSession, error } = await supabase
    .from("telegram_sessions")
    .insert({
      chat_id: chatId,
      user_id: from?.id?.toString(),
      username: from?.username,
      first_name: from?.first_name,
      last_name: from?.last_name,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    return null;
  }

  return newSession as Session;
}

/**
 * Aktualisiert eine Session
 */
export async function updateSession(
  chatId: number,
  updates: Partial<Session>
): Promise<void> {
  const { error } = await supabase
    .from("telegram_sessions")
    .update({
      ...updates,
      last_activity: new Date().toISOString()
    })
    .eq("chat_id", chatId);

  if (error) {
    console.error("Error updating session:", error);
  }
}

/**
 * Setzt die Session auf Ausgangszustand zurück
 */
export async function resetSession(chatId: number): Promise<void> {
  await updateSession(chatId, {
    aktueller_modus: null,
    modus_daten: {},
    aktuelles_bv_id: null,
    pending_fotos: []
  });
}

/**
 * Prüft ob eine Session aktiv ist
 */
export function isSessionActive(session: Session | null): boolean {
  if (!session) return false;
  return session.aktueller_modus !== null || session.aktuelles_bv_id !== null;
}

/**
 * Speichert die letzte Aktion für Kontext-Awareness
 * Ermöglicht "noch einer" oder "nein, im Bad" Eingaben
 */
export async function updateLetzteAktion(
  chatId: number,
  aktion: {
    typ: 'mangel' | 'nachtrag' | 'nachweis' | 'status';
    id?: string;
    projekt_nr?: string;
  }
): Promise<void> {
  const letzteAktion: LetzteAktion = {
    ...aktion,
    timestamp: new Date().toISOString()
  };

  console.log(`[Session] Letzte Aktion gespeichert: ${aktion.typ}${aktion.id ? ` (${aktion.id})` : ''} für Chat ${chatId}`);

  await updateSession(chatId, {
    letzte_aktion: letzteAktion
  } as Partial<Session>);
}

/**
 * Fügt Projekt zur Historie hinzu (max 5, neueste zuerst)
 * FIFO: Ältester Eintrag wird entfernt wenn > 5
 */
export async function addProjektToHistorie(
  chatId: number,
  projekt: { atbs: string; name?: string }
): Promise<void> {
  // Hole aktuelle Session
  const session = await getExtendedSession(chatId);
  if (!session) {
    console.error(`[Session] Keine Session für Chat ${chatId} gefunden`);
    return;
  }

  // Aktuelle Historie oder leeres Array
  let historie = session.projekt_historie || [];

  // Entferne existierenden Eintrag mit gleichem ATBS (um Duplikate zu vermeiden)
  historie = historie.filter(p => p.atbs !== projekt.atbs);

  // Neuen Eintrag an den Anfang
  historie.unshift({
    atbs: projekt.atbs,
    name: projekt.name,
    timestamp: new Date().toISOString()
  });

  // Max 5 Einträge behalten (FIFO)
  if (historie.length > 5) {
    historie = historie.slice(0, 5);
  }

  console.log(`[Session] Projekt ${projekt.atbs} zur Historie hinzugefügt (${historie.length} Einträge)`);

  await updateSession(chatId, {
    projekt_historie: historie
  } as Partial<Session>);
}

/**
 * Setzt User-Sprache basierend auf erkannter Eingabesprache
 */
export async function setUserSprache(
  chatId: number,
  sprache: UserSprache
): Promise<void> {
  console.log(`[Session] Sprache auf ${sprache} gesetzt für Chat ${chatId}`);

  await updateSession(chatId, {
    user_sprache: sprache
  } as Partial<Session>);
}

/**
 * Speichert pending Foto (Foto ohne Text)
 * Wird verwendet wenn User erst Foto schickt, dann Text
 * @param fileId - Die Telegram file_id oder null zum Löschen
 */
export async function setPendingFoto(
  chatId: number,
  fileId: string | null
): Promise<void> {
  if (fileId) {
    console.log(`[Session] Pending Foto gespeichert für Chat ${chatId}`);
    await updateSession(chatId, {
      pending_foto: {
        file_id: fileId,
        timestamp: new Date().toISOString()
      }
    } as Partial<Session>);
  } else {
    console.log(`[Session] Pending Foto gelöscht für Chat ${chatId}`);
    await updateSession(chatId, {
      pending_foto: undefined
    } as Partial<Session>);
  }
}

/**
 * Holt aktuelle Session mit allen erweiterten Feldern
 */
export async function getExtendedSession(chatId: number): Promise<Session | null> {
  const { data, error } = await supabase
    .from("telegram_sessions")
    .select("*")
    .eq("chat_id", chatId)
    .single();

  if (error) {
    console.error(`[Session] Fehler beim Laden der Session für Chat ${chatId}:`, error);
    return null;
  }

  return data as Session;
}
