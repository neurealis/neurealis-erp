/**
 * Telegram Bot Response Templates
 * Multi-Language vorbereitet (erstmal nur DE)
 */

export type Language = 'DE' | 'RU' | 'HU' | 'RO' | 'PL';

interface ResponseTemplates {
  [key: string]: {
    [lang in Language]?: string;
  };
}

// =============================================================================
// RESPONSE TEMPLATES
// =============================================================================

export const RESPONSES: ResponseTemplates = {
  // -------------------------------------------------------------------------
  // Mangel
  // -------------------------------------------------------------------------
  MANGEL_ERFASST: {
    DE: '✅ Mangel {nr} erfasst\n📍 {raum} | {gewerk_emoji} {gewerk}\n{beschreibung}',
  },
  MANGEL_BUTTONS: {
    DE: '[📷 Foto] [➕ Noch einer] [📊 Status]',
  },
  MANGEL_FOTO_HINZUGEFUEGT: {
    DE: '📷 Foto zu Mangel {nr} hinzugefügt.',
  },
  MANGEL_NICHT_GEFUNDEN: {
    DE: '❓ Mangel {nr} nicht gefunden.',
  },
  MANGEL_KORRIGIERT: {
    DE: '✏️ Mangel {nr} korrigiert:\n{feld}: {alt} → {neu}',
  },

  // -------------------------------------------------------------------------
  // Nachtrag
  // -------------------------------------------------------------------------
  NACHTRAG_ERFASST: {
    DE: '✅ Nachtrag {nr} erfasst\n{gewerk_emoji} {gewerk} | {menge} {einheit}\n\n📊 LV-Match ({lv_typ}):\n{positionen}\n\n💰 Summe: {summe}€',
  },
  NACHTRAG_OHNE_LV: {
    DE: '✅ Nachtrag {nr} erfasst\n{gewerk_emoji} {gewerk} | {menge} {einheit}\n{beschreibung}\n\n⚠️ Kein LV-Match gefunden',
  },
  NACHTRAG_FOTO_HINZUGEFUEGT: {
    DE: '📷 Foto zu Nachtrag {nr} hinzugefügt.',
  },
  NACHTRAG_NICHT_GEFUNDEN: {
    DE: '❓ Nachtrag {nr} nicht gefunden.',
  },
  NACHTRAG_KORRIGIERT: {
    DE: '✏️ Nachtrag {nr} korrigiert:\n{feld}: {alt} → {neu}',
  },

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  STATUS_HEADER: {
    DE: '📊 Status {projekt}\n{name}',
  },
  STATUS_MAENGEL: {
    DE: '🔴 Mängel: {offen} offen, {erledigt} erledigt',
  },
  STATUS_NACHTRAEGE: {
    DE: '📝 Nachträge: {anzahl} ({summe}€)',
  },
  STATUS_LEER: {
    DE: '✅ Keine offenen Punkte',
  },

  // -------------------------------------------------------------------------
  // Projekt
  // -------------------------------------------------------------------------
  PROJEKT_GEOEFFNET: {
    DE: '📂 Projekt {atbs} geöffnet\n{name}',
  },
  PROJEKT_NICHT_GEFUNDEN: {
    DE: '❓ Projekt "{search}" nicht gefunden.\n\nMeintest du:',
  },
  PROJEKT_MEHRDEUTIG: {
    DE: '❓ Mehrere Projekte gefunden:',
  },
  PROJEKT_BENOETIGT: {
    DE: 'Für welches Projekt?\n\nGib die ATBS-Nummer ein oder wähle:',
  },
  PROJEKT_KEIN_AKTIVES: {
    DE: '❓ Kein aktives Projekt.\n\nÖffne zuerst ein Projekt mit /projekt oder ATBS-Nummer.',
  },

  // -------------------------------------------------------------------------
  // Korrektur
  // -------------------------------------------------------------------------
  KORREKTUR_ERFOLGREICH: {
    DE: '✏️ Korrigiert: {nr}\n{feld}: {alt} → {neu}',
  },
  KORREKTUR_FEHLGESCHLAGEN: {
    DE: '❌ Korrektur fehlgeschlagen: {grund}',
  },

  // -------------------------------------------------------------------------
  // Foto
  // -------------------------------------------------------------------------
  FOTO_FRAGE: {
    DE: 'Möchtest du ein Foto hinzufügen?',
  },
  FOTO_GESPEICHERT: {
    DE: '📷 Foto zu {typ} {nr} hinzugefügt.',
  },
  FOTO_WOZU: {
    DE: 'Wozu gehört das Foto?',
  },
  FOTO_OHNE_KONTEXT: {
    DE: '❓ Foto erhalten, aber kein Kontext.\n\nWozu gehört das Foto?',
  },
  FOTO_HOCHGELADEN: {
    DE: '📷 Foto hochgeladen.',
  },

  // -------------------------------------------------------------------------
  // Nachweis
  // -------------------------------------------------------------------------
  NACHWEIS_ERFASST: {
    DE: '✅ Nachweis erfasst\n{gewerk_emoji} {gewerk}\n{beschreibung}',
  },

  // -------------------------------------------------------------------------
  // Aufmaß
  // -------------------------------------------------------------------------
  AUFMASS_ERFASST: {
    DE: '✅ Aufmaß erfasst\n📍 {raum} | {gewerk_emoji} {gewerk}\n📐 {laenge}m × {breite}m = {flaeche}m²',
  },

  // -------------------------------------------------------------------------
  // Bericht
  // -------------------------------------------------------------------------
  BERICHT_ERFASST: {
    DE: '✅ Tagesbericht erfasst\n📅 {datum}\n{inhalt}',
  },

  // -------------------------------------------------------------------------
  // Abnahme
  // -------------------------------------------------------------------------
  ABNAHME_ERFASST: {
    DE: '✅ Abnahme erfasst\n{gewerk_emoji} {gewerk}\n{status_emoji} {status}',
  },

  // -------------------------------------------------------------------------
  // Bedarfsanalyse
  // -------------------------------------------------------------------------
  BEDARF_ERFASST: {
    DE: '✅ Bedarf erfasst\n{artikel} | {menge} {einheit}\n📍 {ort}',
  },

  // -------------------------------------------------------------------------
  // Fehler
  // -------------------------------------------------------------------------
  INTENT_UNKLAR: {
    DE: 'Das habe ich nicht verstanden.\n\nWas möchtest du tun?',
  },
  FEHLER_ALLGEMEIN: {
    DE: '❌ Fehler: {message}',
  },
  FEHLER_DATENBANK: {
    DE: '❌ Datenbankfehler. Bitte erneut versuchen.',
  },
  FEHLER_KI: {
    DE: '❌ KI-Analyse fehlgeschlagen. Bitte erneut versuchen.',
  },
  NICHT_AUTORISIERT: {
    DE: '🔒 Du bist nicht berechtigt, diesen Bot zu nutzen.\n\nBitte wende dich an einen Administrator.',
  },

  // -------------------------------------------------------------------------
  // Bot-Permissions
  // -------------------------------------------------------------------------
  PERMISSION_KEINE_MAENGEL: {
    DE: '🔒 Du hast keine Berechtigung, Mängel zu melden.\n\nBitte wende dich an deinen Bauleiter.',
  },
  PERMISSION_KEINE_NACHTRAEGE: {
    DE: '🔒 Du hast keine Berechtigung, Nachträge zu erfassen.\n\nBitte wende dich an deinen Bauleiter.',
  },
  PERMISSION_KEINE_BESTELLUNGEN: {
    DE: '🔒 Du hast keine Berechtigung, Bestellungen aufzugeben.\n\nBitte wende dich an deinen Bauleiter.',
  },
  PERMISSION_KEINE_FOTOS: {
    DE: '🔒 Du hast keine Berechtigung, Fotos hochzuladen.\n\nBitte wende dich an deinen Bauleiter.',
  },
  PERMISSION_KEIN_STATUS: {
    DE: '🔒 Du hast keine Berechtigung, den Status abzufragen.\n\nBitte wende dich an deinen Bauleiter.',
  },

  // -------------------------------------------------------------------------
  // Listen
  // -------------------------------------------------------------------------
  LISTE_LEER: {
    DE: 'Keine {typ} gefunden.',
  },
  LISTE_MAENGEL_HEADER: {
    DE: '🔴 Offene Mängel ({anzahl}):',
  },
  LISTE_NACHTRAEGE_HEADER: {
    DE: '📝 Nachträge ({anzahl}):',
  },

  // -------------------------------------------------------------------------
  // Start / Hilfe
  // -------------------------------------------------------------------------
  START_WILLKOMMEN: {
    DE: '👋 Willkommen beim neurealis Baustellen-Bot!\n\nDu kannst:\n• Mängel melden\n• Nachträge erfassen\n• Fotos dokumentieren\n• Status abfragen\n\nÖffne zuerst ein Projekt mit /projekt',
  },
  HILFE: {
    DE: '📖 Befehle:\n\n/projekt [ATBS] - Projekt öffnen\n/mangel - Mangel melden\n/nachtrag - Nachtrag erfassen\n/status - Projektstatus\n/maengel - Mängelliste\n/nachtraege - Nachtragsliste\n\nOder einfach eine Sprachnachricht senden!',
  },

  // -------------------------------------------------------------------------
  // Bestätigungen
  // -------------------------------------------------------------------------
  BESTAETIGUNG_JA: {
    DE: '✅ Bestätigt.',
  },
  BESTAETIGUNG_NEIN: {
    DE: '❌ Abgebrochen.',
  },
  AKTION_ABGEBROCHEN: {
    DE: '↩️ Aktion abgebrochen.',
  },
};

// =============================================================================
// GEWERK EMOJIS
// =============================================================================

export const GEWERK_EMOJIS: Record<string, string> = {
  'Elektrik': '⚡',
  'Elektro': '⚡',
  'Sanitär': '🚿',
  'Maler': '🎨',
  'Malerarbeiten': '🎨',
  'Boden': '🟫',
  'Bodenbelag': '🟫',
  'Fliesen': '🟦',
  'Fliesenarbeiten': '🟦',
  'Türen': '🚪',
  'Türarbeiten': '🚪',
  'Fenster': '🪟',
  'Heizung': '🔥',
  'Trockenbau': '🧱',
  'Entkernung': '🔨',
  'Abbruch': '🔨',
  'Küche': '🍳',
  'Bad': '🛁',
  'Lüftung': '💨',
  'Klima': '❄️',
  'Dach': '🏠',
  'Fassade': '🏢',
  'Außenanlagen': '🌳',
  'Sonstiges': '🔧',
};

/**
 * Gibt das Emoji für ein Gewerk zurück
 */
export function getGewerkEmoji(gewerk: string): string {
  if (!gewerk) return '🔧';

  // Exakter Match
  if (GEWERK_EMOJIS[gewerk]) {
    return GEWERK_EMOJIS[gewerk];
  }

  // Teilmatch (case-insensitive)
  const gewerkLower = gewerk.toLowerCase();
  for (const [key, emoji] of Object.entries(GEWERK_EMOJIS)) {
    if (gewerkLower.includes(key.toLowerCase()) || key.toLowerCase().includes(gewerkLower)) {
      return emoji;
    }
  }

  return '🔧';
}

// =============================================================================
// STATUS EMOJIS
// =============================================================================

export const STATUS_EMOJIS: Record<string, string> = {
  'offen': '🔴',
  'in_bearbeitung': '🟡',
  'erledigt': '🟢',
  'abgelehnt': '⚫',
  'genehmigt': '✅',
  'ausstehend': '⏳',
};

/**
 * Gibt das Emoji für einen Status zurück
 */
export function getStatusEmoji(status: string): string {
  if (!status) return '⏳';
  return STATUS_EMOJIS[status.toLowerCase()] || '⏳';
}

// =============================================================================
// TEMPLATE FUNKTION
// =============================================================================

/**
 * Template-Funktion mit Variable-Ersetzung
 * @param key - Template-Key aus RESPONSES
 * @param lang - Sprache (default: 'DE')
 * @param vars - Variablen zum Ersetzen {name} → vars.name
 */
export function t(
  key: string,
  lang: Language = 'DE',
  vars: Record<string, string | number> = {}
): string {
  const template = RESPONSES[key]?.[lang] || RESPONSES[key]?.['DE'] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// =============================================================================
// INLINE KEYBOARD HELPERS
// =============================================================================

interface InlineButton {
  text: string;
  callback_data: string;
}

interface UrlButton {
  text: string;
  url: string;
}

type Button = InlineButton | UrlButton;

/**
 * Erzeugt Inline-Keyboard für Telegram
 */
export function createInlineKeyboard(
  buttons: Array<Button | Button[]>
): { reply_markup: { inline_keyboard: Button[][] } } {
  const keyboard = buttons.map(row =>
    Array.isArray(row) ? row : [row]
  );
  return { reply_markup: { inline_keyboard: keyboard } };
}

/**
 * Erzeugt einen einzelnen Button
 */
export function btn(text: string, callback_data: string): InlineButton {
  return { text, callback_data };
}

/**
 * Erzeugt einen URL-Button
 */
export function urlBtn(text: string, url: string): UrlButton {
  return { text, url };
}

// =============================================================================
// VORDEFINIERTE BUTTON-SETS
// =============================================================================

export const BUTTONS = {
  // Nach Mangel-Erfassung
  MANGEL_FOLLOWUP: [
    [{ text: '📷 Foto', callback_data: 'mangel:add_foto' }],
    [
      { text: '➕ Noch einer', callback_data: 'mangel:neu' },
      { text: '📊 Status', callback_data: 'bau:status' },
    ],
  ],

  // Nach Nachtrag-Erfassung
  NACHTRAG_FOLLOWUP: [
    [{ text: '📷 Foto', callback_data: 'nachtrag:add_foto' }],
    [
      { text: '➕ Noch einer', callback_data: 'nachtrag:neu' },
      { text: '📊 Status', callback_data: 'bau:status' },
    ],
  ],

  // Foto-Zweck Auswahl
  FOTO_ZWECK: [
    [
      { text: 'Mangel', callback_data: 'foto:mangel' },
      { text: 'Nachtrag', callback_data: 'foto:nachtrag' },
    ],
    [
      { text: 'Nachweis', callback_data: 'foto:nachweis' },
      { text: 'Doku', callback_data: 'foto:doku' },
    ],
  ],

  // Ja/Nein Bestätigung
  JA_NEIN: [
    [
      { text: '✅ Ja', callback_data: 'confirm:yes' },
      { text: '❌ Nein', callback_data: 'confirm:no' },
    ],
  ],

  // Abbrechen
  ABBRECHEN: [
    [{ text: '↩️ Abbrechen', callback_data: 'action:cancel' }],
  ],

  // Hauptmenü
  HAUPTMENU: [
    [
      { text: '🔴 Mangel', callback_data: 'cmd:mangel' },
      { text: '📝 Nachtrag', callback_data: 'cmd:nachtrag' },
    ],
    [
      { text: '📊 Status', callback_data: 'cmd:status' },
      { text: '📂 Projekt', callback_data: 'cmd:projekt' },
    ],
  ],

  // Intent-Auswahl bei Unklarheit
  INTENT_AUSWAHL: [
    [
      { text: '🔴 Mangel', callback_data: 'intent:mangel' },
      { text: '📝 Nachtrag', callback_data: 'intent:nachtrag' },
    ],
    [
      { text: '📷 Foto', callback_data: 'intent:foto' },
      { text: '📊 Status', callback_data: 'intent:status' },
    ],
    [{ text: '📂 Projekt öffnen', callback_data: 'intent:projekt' }],
  ],
};

// =============================================================================
// FORMATIERUNG HELPERS
// =============================================================================

/**
 * Formatiert einen Geldbetrag
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatiert ein Datum
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Kürzt Text auf maximale Länge
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escaped Markdown-Sonderzeichen für Telegram
 */
export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
