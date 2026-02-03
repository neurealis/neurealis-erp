/**
 * Session Management Utilities
 */
import { supabase } from "../constants.ts";
import type { Session, TelegramUser } from "../types.ts";

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
