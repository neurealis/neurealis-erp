/**
 * Authentifizierung und Autorisierung Utilities
 */
import { supabase } from "../constants.ts";
import type { Session, GemeldetVonResult, Kontakt, BotPermissions, BotPermissionKey, TelegramAccessResult } from "../types.ts";

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

// =============================================================================
// BOT PERMISSIONS
// =============================================================================

/**
 * Default-Permissions (wenn Kontakt nicht gefunden oder Felder NULL)
 */
const DEFAULT_PERMISSIONS: BotPermissions = {
  bot_kann_maengel: true,
  bot_kann_nachtraege: true,
  bot_kann_bestellungen: true,
  bot_kann_fotos: true,
  bot_kann_status: true,
};

/**
 * Holt die Bot-Permissions für einen User anhand der Chat-ID
 * Fallback auf Default-Permissions wenn Kontakt nicht gefunden
 */
export async function getBotPermissions(chatId: number): Promise<BotPermissions> {
  try {
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('bot_kann_maengel, bot_kann_nachtraege, bot_kann_bestellungen, bot_kann_fotos, bot_kann_status')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!kontakt) {
      console.log(`[Permissions] Kein Kontakt für chatId ${chatId}, nutze Defaults`);
      return DEFAULT_PERMISSIONS;
    }

    // NULL-Werte mit Defaults ersetzen (true = erlaubt)
    return {
      bot_kann_maengel: kontakt.bot_kann_maengel ?? true,
      bot_kann_nachtraege: kontakt.bot_kann_nachtraege ?? true,
      bot_kann_bestellungen: kontakt.bot_kann_bestellungen ?? true,
      bot_kann_fotos: kontakt.bot_kann_fotos ?? true,
      bot_kann_status: kontakt.bot_kann_status ?? true,
    };
  } catch (e) {
    console.error('[Permissions] Fehler beim Laden:', e);
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Prüft eine einzelne Permission für einen User
 * @returns true wenn erlaubt, false wenn nicht
 */
export async function checkBotPermission(
  chatId: number,
  permission: BotPermissionKey
): Promise<boolean> {
  const permissions = await getBotPermissions(chatId);
  return permissions[permission];
}

/**
 * Mapping von Permission-Key zu Response-Template-Key
 */
export const PERMISSION_ERROR_MESSAGES: Record<BotPermissionKey, string> = {
  bot_kann_maengel: 'PERMISSION_KEINE_MAENGEL',
  bot_kann_nachtraege: 'PERMISSION_KEINE_NACHTRAEGE',
  bot_kann_bestellungen: 'PERMISSION_KEINE_BESTELLUNGEN',
  bot_kann_fotos: 'PERMISSION_KEINE_FOTOS',
  bot_kann_status: 'PERMISSION_KEIN_STATUS',
};

// =============================================================================
// TELEGRAM ACCESS CONTROL
// =============================================================================

/**
 * Normalisiert eine Telefonnummer zu E.164 Format (+49...)
 * Muss identisch zur DB-Funktion normalize_phone() sein!
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Entferne alle Leerzeichen, Bindestriche, Klammern
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Wenn mit + beginnt, behalte es und entferne nur nicht-numerische Zeichen
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/[^0-9]/g, '');
  }

  // Wenn mit 0 beginnt (deutsche Nummer), ersetze durch +49
  if (cleaned.startsWith('0')) {
    return '+49' + cleaned.slice(1).replace(/[^0-9]/g, '');
  }

  // Fallback: Füge +49 hinzu
  return '+49' + cleaned.replace(/[^0-9]/g, '');
}

/**
 * Prüft ob ein Telegram-User den Bot nutzen darf
 *
 * Access-Logik:
 * 1. Kontakt muss existieren
 * 2. telegram_enabled muss true sein
 * 3. ENTWEDER telegram_verified = true (bereits verifiziert)
 *    ODER Telefonnummer stimmt überein (Erstverifizierung)
 *
 * Bei erfolgreicher Telefonnummer-Verifizierung:
 * - Setze telegram_chat_id
 * - Setze telegram_verified = true
 * - Setze telegram_verified_at
 */
export async function checkTelegramAccess(
  chatId: number,
  telegramPhone?: string | null
): Promise<TelegramAccessResult> {
  try {
    // 1. Prüfe ob bereits verifizierter Kontakt existiert
    const { data: existingKontakt } = await supabase
      .from('kontakte')
      .select('id, vorname, nachname, rolle, email, firma, telefon_mobil, telegram_chat_id, telegram_verified, telegram_enabled')
      .eq('telegram_chat_id', chatId)
      .single();

    if (existingKontakt) {
      // Kontakt gefunden via chat_id
      if (!existingKontakt.telegram_enabled) {
        console.log(`[Auth] Chat ${chatId}: Kontakt ${existingKontakt.id} gefunden, aber telegram_enabled=false`);
        return { allowed: false, kontakt: existingKontakt as Kontakt, reason: 'disabled' };
      }

      console.log(`[Auth] Chat ${chatId}: Zugriff erlaubt (bereits verifiziert)`);
      return { allowed: true, kontakt: existingKontakt as Kontakt, reason: 'ok' };
    }

    // 2. Kein Kontakt via chat_id - versuche Telefonnummer-Match
    if (!telegramPhone) {
      console.log(`[Auth] Chat ${chatId}: Kein Kontakt gefunden, keine Telefonnummer angegeben`);
      return { allowed: false, reason: 'not_found' };
    }

    const normalizedPhone = normalizePhone(telegramPhone);
    if (!normalizedPhone) {
      console.log(`[Auth] Chat ${chatId}: Telefonnummer konnte nicht normalisiert werden: ${telegramPhone}`);
      return { allowed: false, reason: 'phone_mismatch' };
    }

    // Suche Kontakt mit passender Telefonnummer
    const { data: kontakte } = await supabase
      .from('kontakte')
      .select('id, vorname, nachname, rolle, email, firma, telefon_mobil, telegram_chat_id, telegram_verified, telegram_enabled')
      .eq('telegram_enabled', true)
      .is('telegram_chat_id', null); // Nur noch nicht verifizierte

    if (!kontakte || kontakte.length === 0) {
      console.log(`[Auth] Chat ${chatId}: Keine passenden Kontakte gefunden`);
      return { allowed: false, reason: 'not_found' };
    }

    // Suche Match über normalisierte Telefonnummer
    const matchedKontakt = kontakte.find(k =>
      normalizePhone(k.telefon_mobil) === normalizedPhone
    );

    if (!matchedKontakt) {
      console.log(`[Auth] Chat ${chatId}: Telefonnummer ${normalizedPhone} nicht gefunden`);
      return { allowed: false, reason: 'phone_mismatch' };
    }

    // Verifiziere den Kontakt
    await verifyKontakt(matchedKontakt.id, chatId);

    console.log(`[Auth] Chat ${chatId}: Kontakt ${matchedKontakt.id} via Telefon verifiziert`);
    return {
      allowed: true,
      kontakt: { ...matchedKontakt, telegram_chat_id: chatId, telegram_verified: true } as Kontakt,
      reason: 'ok'
    };

  } catch (e) {
    console.error('[Auth] Fehler bei Access-Check:', e);
    return { allowed: false, reason: 'not_found' };
  }
}

/**
 * Verifiziert einen Kontakt nach erfolgreicher Telefonnummer-Prüfung
 */
async function verifyKontakt(kontaktId: string, chatId: number): Promise<void> {
  const { error } = await supabase
    .from('kontakte')
    .update({
      telegram_chat_id: chatId,
      telegram_verified: true,
      telegram_verified_at: new Date().toISOString()
    })
    .eq('id', kontaktId);

  if (error) {
    console.error(`[Auth] Fehler beim Verifizieren von Kontakt ${kontaktId}:`, error);
    throw error;
  }
}

/**
 * Hilfsfunktion: Prüft ob ein User bereits verifiziert ist (ohne Access-Check)
 */
export async function isVerified(chatId: number): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('kontakte')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .eq('telegram_verified', true)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Entzieht einem Kontakt den Telegram-Zugriff
 * (Setzt telegram_enabled auf false)
 */
export async function revokeTelegramAccess(kontaktId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('kontakte')
      .update({ telegram_enabled: false })
      .eq('id', kontaktId);

    if (error) {
      console.error(`[Auth] Fehler beim Entziehen des Zugriffs für ${kontaktId}:`, error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Gewährt einem Kontakt Telegram-Zugriff
 * (Setzt telegram_enabled auf true)
 */
export async function grantTelegramAccess(kontaktId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('kontakte')
      .update({ telegram_enabled: true })
      .eq('id', kontaktId);

    if (error) {
      console.error(`[Auth] Fehler beim Gewähren des Zugriffs für ${kontaktId}:`, error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
