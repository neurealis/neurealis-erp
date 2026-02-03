/**
 * Authentifizierung und Autorisierung Utilities
 */
import { supabase } from "../constants.ts";
import type { Session, GemeldetVonResult, Kontakt } from "../types.ts";

/**
 * Ermittle gemeldet_von basierend auf Kontakt
 *
 * Lookup: chat_id in kontakte-Tabelle (telegram_chat_id)
 * - NU (Nachunternehmer) → gemeldet_von='nu'
 * - BL (Bauleiter) oder Holger Neumann → gemeldet_von='bauleiter'
 * - Fallback: 'telegram'
 */
export async function getGemeldetVon(
  chatId: number,
  session: Session | null
): Promise<GemeldetVonResult> {
  try {
    // Lookup in kontakte-Tabelle via telegram_chat_id
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    if (kontakt) {
      const vollname = [kontakt.vorname, kontakt.nachname].filter(Boolean).join(' ');
      const rolle = (kontakt.rolle || '').toUpperCase();

      // Nachunternehmer
      if (rolle === 'NU') {
        return { gemeldet_von: 'nu', melder_name: vollname || 'Nachunternehmer' };
      }

      // Bauleiter oder Holger Neumann
      if (rolle === 'BL' ||
          (kontakt.vorname?.toLowerCase() === 'holger' && kontakt.nachname?.toLowerCase() === 'neumann')) {
        return { gemeldet_von: 'bauleiter', melder_name: vollname || 'Bauleiter' };
      }

      // Andere bekannte Kontakte
      return { gemeldet_von: 'telegram', melder_name: vollname || 'Telegram' };
    }
  } catch (e) {
    console.error('Error looking up kontakt:', e);
  }

  // Fallback: Telegram-Session Daten
  const sessionName = [session?.first_name, session?.last_name].filter(Boolean).join(' ');
  return { gemeldet_von: 'telegram', melder_name: sessionName || 'Telegram' };
}

/**
 * Generiert eine fortlaufende Mangel-Nummer im Format ATBS-XXX-M1
 */
export async function generateMangelNummer(atbs: string): Promise<string> {
  // Zähle bestehende Mängel für dieses Projekt
  const { count } = await supabase
    .from('maengel_fertigstellung')
    .select('*', { count: 'exact', head: true })
    .eq('projekt_nr', atbs);

  const nextNum = (count || 0) + 1;
  return `${atbs}-M${nextNum}`;
}

/**
 * Generiert eine fortlaufende Nachtrag-Nummer im Format ATBS-XXX-N1
 */
export async function generateNachtragNummer(atbs: string): Promise<string> {
  // Zähle bestehende Nachträge für dieses Projekt
  const { count } = await supabase
    .from('nachtraege')
    .select('*', { count: 'exact', head: true })
    .eq('atbs_nummer', atbs);

  const nextNum = (count || 0) + 1;
  return `${atbs}-N${nextNum}`;
}

/**
 * Prüft ob der User ein Bauleiter ist
 */
export async function isBauleiter(chatId: number): Promise<boolean> {
  try {
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!kontakt) return false;

    return kontakt.rolle?.toUpperCase() === 'BL' ||
      (kontakt.vorname?.toLowerCase() === 'holger' && kontakt.nachname?.toLowerCase() === 'neumann');
  } catch {
    return false;
  }
}

/**
 * Holt Kontakt-Daten per Chat-ID
 */
export async function getKontaktByChatId(chatId: number): Promise<Kontakt | null> {
  try {
    const { data } = await supabase
      .from('kontakte')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single();

    return data as Kontakt | null;
  } catch {
    return null;
  }
}

/**
 * Holt Kontakt-Daten per E-Mail
 */
export async function getKontaktByEmail(email: string): Promise<Kontakt | null> {
  try {
    const { data } = await supabase
      .from('kontakte')
      .select('*')
      .eq('email', email)
      .single();

    return data as Kontakt | null;
  } catch {
    return null;
  }
}

/**
 * Sucht NU-Kontakt per Firma-Name
 */
export async function findNuKontakt(nuName: string): Promise<Kontakt | null> {
  try {
    const { data } = await supabase
      .from('kontakte')
      .select('*')
      .or(`nachname.ilike.%${nuName}%,firma.ilike.%${nuName}%`)
      .eq('rolle', 'NU')
      .limit(1)
      .single();

    return data as Kontakt | null;
  } catch {
    return null;
  }
}
