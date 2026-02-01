import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * telegram-webhook v57 - Verbessertes Fehler-Handling & Hilfe
 *
 * NEU in v57: Fehler-Handling & Hilfe-System
 * - ❓ showSprachBefehlHilfe: Ausführliche Hilfe für Sprach-Befehle
 * - 🔘 Hilfe-Button im Hauptmenü: "❓ Hilfe Sprach-Befehle"
 * - 📝 Verbessertes Fehler-Handling: Hilfe-Button bei nicht erkannten Befehlen
 * - 📊 Vollständiges Logging in telegram_befehle_log
 *
 * v56: Monday-Sync Integration
 * - 🔄 pushToMonday: GraphQL API für Spalten-Updates
 * - 📊 executeStatusBefehl: Gewerk-Status ändern (Supabase + Monday)
 * - 📅 executeTerminBefehl: Termine ändern (Supabase + Monday)
 *
 * v55: Sprach-Befehl-Parser + Termine-Menü
 * - 🎤 Natürliche Spracheingabe für Befehle
 * - Pattern-Matching für Status, Termine, Nachträge, Mängel
 * - GPT-5.2 Fallback für komplexe Befehle
 * - Termine-Menü: BV Start, BV Ende NU Plan, BV Ende Mängelfrei, BV Ende Kunde
 * - Berechtigungsprüfung: Nur BL/GF können Termine ändern
 *
 * v54: Kompakte Projekt-Info & Gewerk-Status-Tabelle
 *
 * KOMPLETT NEUER Bot: @neurealis_bedarfsanalyse_bot
 *
 * NEU in v54: Kompakte Projekt-Info & Gewerk-Status-Tabelle
 * - Beim Öffnen: BL, NU, Termine (Start, Ende NU Plan, Mängelfrei, Kunde)
 * - Zählt offene Mängel und Nachträge
 * - 🏗️ Gewerk-Status: Tabelle mit allen 9 Gewerken und Status-Emojis
 * - Callback: bau:gewerke:{projektId}
 *
 * v53: Multi-Foto-Upload & Abnahmeprotokolle
 * - Multi-Foto-Upload: Erkennt media_group_id und sammelt alle Fotos einer Gruppe
 * - pending_fotos in Session speichern, nach 2s Delay verarbeiten
 * - 📄 Abnahmeprotokoll hochladen: NU-Abnahme (QM-ABN-NU) oder Kunden-Abnahme (QM-ABN-KU)
 * - Speicherung in dokumente-Tabelle
 *
 * v52: Ausführungsarten-Tabelle & Brandschutz-Nachweis
 * - 📐 Ausführungsarten: Kombinierte Tabelle aller Gewerke mit Status
 * - 🔥 Brandschutz-Nachweis: Neuer Nachweis-Typ hinzugefügt
 *
 * v51: Phasen-Filter & ATBS-Schnellzugriff
 * - 🏗️ Baustelle öffnen: Auswahl-Methode (Phase/ATBS/Alle)
 * - Phasen-Filter: Projekte nach Phase (0-4) filtern
 * - ATBS-Schnellzugriff: ATBS-Nummer direkt im Hauptmenü eingeben
 * - Projekt-Liste: Vollständiger Name (AG | Adresse | Wohnung)
 *
 * v50: Dynamische gemeldet_von Erkennung für Nachträge
 * - Lookup: chat_id in kontakte-Tabelle (telegram_chat_id)
 * - NU (Nachunternehmer) → gemeldet_von='nu'
 * - BL (Bauleiter) oder Holger Neumann → gemeldet_von='bauleiter'
 * - Fallback: 'telegram'
 *
 * v49: Baustellen-Features
 * - 🔧 Mangel melden: Text/Sprache, KI-Splitting, mehrsprachig (DE, RU, HU, RO, PL)
 * - 📋 Nachtrag erfassen: Beschreibung + Foto
 * - 📸 Nachweis hochladen: Typ-Auswahl (Rohinstallation Elektrik/Sanitär, Abdichtung, E-Check)
 * - 📊 Status anzeigen: Projekt-Status, offene Mängel, Nachträge
 *
 * BESTEHENDE Features (aus v47):
 * - /start -> Hauptmenü: Aufmaß / Bedarfsanalyse / Baustelle
 * - Aufmaß-Modus: ATBS-Suche, Matterport-Link, CSV-Upload -> Excel
 * - Bedarfsanalyse-Modus: Foto -> OCR -> Review -> Odoo-Export
 * - /sync, /help, /status, /abbrechen
 */

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_NEUREALIS_BOT")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// Telegram API Helpers
// ============================================

async function sendMessage(chatId: number, text: string, options?: { reply_markup?: any; parse_mode?: string }) {
  const body: any = { chat_id: chatId, text, parse_mode: options?.parse_mode || "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) console.error("Telegram sendMessage error:", await response.text());
  return response;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}

async function sendDocument(chatId: number, fileBuffer: Uint8Array, filename: string, caption?: string) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([fileBuffer]), filename);
  if (caption) formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
    method: 'POST', body: formData,
  });
  if (!response.ok) console.error('Telegram sendDocument error:', await response.text());
  return response;
}

async function editMessageText(chatId: number, messageId: number, text: string, options?: { reply_markup?: any }) {
  const body: any = { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

async function downloadTelegramFile(fileId: string): Promise<{base64: string, mimeType: string} | null> {
  try {
    const fileResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileResp.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) return null;

    const downloadResp = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`);
    const arrayBuffer = await downloadResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return { base64, mimeType };
  } catch (e) {
    console.error('Error downloading file:', e);
    return null;
  }
}

// ============================================
// Datum & Berechtigungs-Helper
// ============================================

/**
 * Flexibler Datum-Parser für natürliche Eingaben
 * Unterstützt: "17.03.", "heute", "morgen", "in 2 Tagen", "nächsten Montag", "ende der woche"
 */
function parseDatum(text: string): Date | null {
  if (!text) return null;
  const input = text.toLowerCase().trim();
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  // Relativ: "heute"
  if (input === 'heute') {
    return heute;
  }

  // Relativ: "morgen"
  if (input === 'morgen') {
    const d = new Date(heute);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // Relativ: "übermorgen"
  if (input === 'übermorgen' || input === 'uebermorgen') {
    const d = new Date(heute);
    d.setDate(d.getDate() + 2);
    return d;
  }

  // Relativ mit Zahl: "in 2 tagen", "in 5 Tagen"
  const inTageMatch = input.match(/^in\s+(\d+)\s*tage?n?$/);
  if (inTageMatch) {
    const tage = parseInt(inTageMatch[1], 10);
    const d = new Date(heute);
    d.setDate(d.getDate() + tage);
    return d;
  }

  // Wochentag: "nächsten montag", "nächster dienstag"
  const wochentage: Record<string, number> = {
    'sonntag': 0, 'montag': 1, 'dienstag': 2, 'mittwoch': 3,
    'donnerstag': 4, 'freitag': 5, 'samstag': 6
  };
  const wochentagMatch = input.match(/^n[äa]chste[rn]?\s+(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)$/);
  if (wochentagMatch) {
    const zielTag = wochentage[wochentagMatch[1]];
    const aktuellerTag = heute.getDay();
    let diff = zielTag - aktuellerTag;
    if (diff <= 0) diff += 7; // Nächste Woche
    const d = new Date(heute);
    d.setDate(d.getDate() + diff);
    return d;
  }

  // Spezial: "ende der woche" (Sonntag)
  if (input === 'ende der woche' || input === 'wochenende') {
    const d = new Date(heute);
    const diff = 7 - d.getDay(); // Tage bis Sonntag
    d.setDate(d.getDate() + (diff === 7 ? 0 : diff));
    return d;
  }

  // Spezial: "ende des monats"
  if (input === 'ende des monats' || input === 'monatsende') {
    const d = new Date(heute.getFullYear(), heute.getMonth() + 1, 0); // Letzter Tag des Monats
    return d;
  }

  // Explizit: "17.03.", "17.03.2026", "17.3.", "17.3.2026"
  const datumMatch = input.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/);
  if (datumMatch) {
    const tag = parseInt(datumMatch[1], 10);
    const monat = parseInt(datumMatch[2], 10) - 1; // 0-basiert
    let jahr = datumMatch[3] ? parseInt(datumMatch[3], 10) : heute.getFullYear();

    const d = new Date(jahr, monat, tag);

    // Wenn Datum in der Vergangenheit, nächstes Jahr nehmen
    if (d < heute && !datumMatch[3]) {
      d.setFullYear(d.getFullYear() + 1);
    }

    return d;
  }

  return null;
}

/**
 * Prüft ob ein User für kritische Aktionen berechtigt ist
 * Lookup über telegram_chat_id in kontakte-Tabelle
 */
async function istBerechtigt(chatId: number): Promise<boolean> {
  const berechtigteEmails = [
    'holger.neumann@neurealis.de',
    'dirk.jansen@neurealis.de'
  ];

  try {
    const { data, error } = await supabase
      .from('kontakte')
      .select('email')
      .eq('telegram_chat_id', chatId)
      .single();

    if (error || !data) {
      console.log(`istBerechtigt: Kein Kontakt für chat_id ${chatId} gefunden`);
      return false;
    }

    const email = data.email?.toLowerCase();
    return berechtigteEmails.includes(email);
  } catch (e) {
    console.error('istBerechtigt error:', e);
    return false;
  }
}

/**
 * Formatiert ein Datum als "DD.MM.YYYY" für Anzeige
 */
function formatDatum(date: Date): string {
  const tag = date.getDate().toString().padStart(2, '0');
  const monat = (date.getMonth() + 1).toString().padStart(2, '0');
  const jahr = date.getFullYear();
  return `${tag}.${monat}.${jahr}`;
}

// ============================================
// Session Management
// ============================================

async function getOrCreateSession(chatId: number, from?: any) {
  const { data } = await supabase.from("telegram_sessions").select("*").eq("chat_id", chatId).single();
  if (data) return data;
  const { data: newSession, error } = await supabase.from("telegram_sessions").insert({
    chat_id: chatId, user_id: from?.id?.toString(), username: from?.username,
    first_name: from?.first_name, last_name: from?.last_name,
  }).select().single();
  if (error) console.error("Error creating session:", error);
  return newSession;
}

async function updateSession(chatId: number, updates: Record<string, any>) {
  const { error } = await supabase.from("telegram_sessions").update({
    ...updates, last_activity: new Date().toISOString()
  }).eq("chat_id", chatId);
  if (error) console.error("Error updating session:", error);
}

// ============================================
// Helper: Extract ATBS from Monday column_values
// ============================================

function extractATBS(columnValues: any): string | null {
  if (!columnValues) return null;
  const text49 = columnValues.text49__1;
  if (!text49) return null;
  if (typeof text49 === 'string') return text49;
  if (typeof text49 === 'object' && text49.value) return text49.value;
  if (typeof text49 === 'object' && text49.text) return text49.text;
  return null;
}

// ============================================
// Monday.com API Integration
// ============================================

const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY');
const MONDAY_BOARD_ID = '1750073517'; // Bauprozess-Board

// Gewerk zu Monday Spalten-ID Mapping
const GEWERK_SPALTEN: Record<string, string> = {
  'entkernung': 'gg2On',
  'maurer': '67n4J',
  'elektrik': '06reu',
  'sanitär': 'GnADf',
  'bad': 'GnADf',
  'bad & sanitär': 'GnADf',
  'heizung': 'aJKmD',
  'tischler': 'tSYWD',
  'wände': 'Fl8Za',
  'decken': 'Fl8Za',
  'wände & decken': 'Fl8Za',
  'trockenbau': 'Fl8Za',
  'maler': 'Fl8Za',
  'boden': 'qAUvS',
  'endreinigung': 'Nygjn',
};

// Termin-Typen zu Monday Spalten-ID Mapping
const TERMIN_SPALTEN: Record<string, string> = {
  'start': 'f55yA',        // BV Start
  'plan': '25nEy',         // BV Ende NU Plan
  'maengelfrei': '7hwYG',  // BV Ende Mängelfrei
  'kunde': '8pRus',        // BV Ende Kunde
};

// Status-Mapping: Vereinfachter Status → Monday Status-Label
const STATUS_MAPPING: Record<string, Record<string, string>> = {
  elektrik: {
    'fertig': 'Fertig (Feininstallation)',
    'läuft': 'In Arbeit (Schlitze & Rohinstallation)',
    'geplant': 'Geplant',
    'verspätet': 'Verspätet',
  },
  sanitär: {
    'fertig': 'Fertig (Feininstallation)',
    'läuft': 'In Arbeit (Rohinstallation)',
    'geplant': 'Geplant',
    'verspätet': 'Verspätet',
  },
  _default: {
    'fertig': 'Fertig',
    'läuft': 'In Arbeit',
    'geplant': 'Geplant',
    'verspätet': 'Verspätet',
  }
};

/**
 * Pusht Änderungen zu Monday.com via GraphQL API
 */
async function pushToMonday(mondayItemId: string, changes: Record<string, any>): Promise<boolean> {
  if (!MONDAY_API_KEY) {
    console.error('MONDAY_API_KEY nicht konfiguriert');
    return false;
  }

  try {
    // Konvertiere changes zu Monday column_values Format
    const columnValues = JSON.stringify(changes);

    const mutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${MONDAY_BOARD_ID},
          item_id: ${mondayItemId},
          column_values: ${JSON.stringify(columnValues)}
        ) {
          id
          name
        }
      }
    `;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query: mutation })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('Monday API Fehler:', result.errors);
      return false;
    }

    console.log('Monday Update erfolgreich:', result.data);
    return true;
  } catch (error) {
    console.error('Monday API Fehler:', error);
    return false;
  }
}

/**
 * Mapped vereinfachten Status auf Monday Status-Label
 */
function mapStatusToMonday(gewerk: string, status: string): string {
  const gewerkLower = gewerk.toLowerCase();
  const statusLower = status.toLowerCase();

  // Spezifisches Mapping für Elektrik/Sanitär
  if (gewerkLower === 'elektrik' && STATUS_MAPPING.elektrik[statusLower]) {
    return STATUS_MAPPING.elektrik[statusLower];
  }
  if ((gewerkLower === 'sanitär' || gewerkLower === 'bad') && STATUS_MAPPING.sanitär[statusLower]) {
    return STATUS_MAPPING.sanitär[statusLower];
  }

  // Default Mapping
  return STATUS_MAPPING._default[statusLower] || status;
}

function extractProjectName(columnValues: any): string | null {
  if (!columnValues) return null;
  const text23 = columnValues.text23__1;
  if (typeof text23 === 'string') return text23;
  if (typeof text23 === 'object' && text23.value) return text23.value;
  return null;
}

function extractPhase(columnValues: any): string | null {
  if (!columnValues) return null;
  const dropdown = columnValues.dropdown0__1;
  if (typeof dropdown === 'object' && dropdown.text) return dropdown.text;
  if (typeof dropdown === 'string') return dropdown;
  return null;
}

function extractPhaseNumber(columnValues: any): number | null {
  const phase = extractPhase(columnValues);
  if (!phase) return null;
  const match = phase.match(/^\((\d+)\)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

// Phase-Labels für die Anzeige
const PHASE_LABELS: Record<number, string> = {
  0: '(0) Bedarfsanalyse',
  1: '(1) Angebotsstellung',
  2: '(2) Auftrag erhalten',
  3: '(3) Vorbereitung',
  4: '(4) Umsetzung'
};

// Monday-Spalten für Projekt-Info (GEWERK_SPALTEN ist oben im Monday-API-Bereich definiert)
const PROJEKT_SPALTEN = {
  bauleiter: ['people__1', 'FPlQB'],
  nachunternehmer: ['mirror__1', 'sQkwj'],
  bv_start: ['date_bvstart', 'f55yA'],
  bv_ende_plan: '25nEy',
  bv_ende_maengelfrei: '7hwYG',
  bv_ende_kunde: '8pRus',
};

// Helper: Extrahiere Feld-Text aus verschiedenen Monday-Formaten
function extractFieldText(columnValues: any, ...fieldIds: string[]): string {
  if (!columnValues) return '';
  for (const fieldId of fieldIds) {
    const field = columnValues[fieldId];
    if (!field) continue;
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      if (field.text) return field.text;
      if (field.value) {
        try {
          const parsed = JSON.parse(field.value);
          return parsed.text || parsed.value || '';
        } catch {
          return field.value;
        }
      }
    }
  }
  return '';
}

// Helper: Extrahiere Datum aus Monday-Feld
function extractDate(columnValues: any, fieldId: string): string {
  if (!columnValues) return '-';
  const field = columnValues[fieldId];
  if (!field) return '-';
  let dateStr = '';
  if (typeof field === 'string') {
    dateStr = field;
  } else if (typeof field === 'object') {
    if (field.text) dateStr = field.text;
    else if (field.date) dateStr = field.date;
    else if (field.value) {
      try {
        const parsed = JSON.parse(field.value);
        dateStr = parsed.date || parsed.text || '';
      } catch {
        dateStr = field.value;
      }
    }
  }
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr.substring(0, 10);
  }
}

// Status-zu-Emoji-Mapping für Gewerke
function gewerkStatusEmoji(status: string): string {
  if (!status) return '-';
  const s = status.toLowerCase();
  if (s.includes('fertig') || s.includes('erledigt') || s.includes('komplett')) return '✅';
  if (s.includes('arbeit') || s.includes('läuft') || s.includes('rohinstall')) return '🔨';
  if (s.includes('geplant') || s.includes('offen')) return '⏳';
  if (s.includes('verspätet') || s.includes('verzug')) return '⚠️';
  return '-';
}

// ============================================
// Sprach-Befehl-Parser (NEU v55)
// ============================================

interface SprachBefehl {
  typ: 'status' | 'termin' | 'nachtrag' | 'mangel';
  atbs?: string;          // z.B. "456"
  gewerk?: string;        // z.B. "Elektrik"
  status?: string;        // z.B. "Fertig"
  terminTyp?: string;     // z.B. "plan", "maengelfrei"
  datum?: Date;
  beschreibung?: string;  // Für Nachtrag/Mangel
  raw: string;            // Original-Text
}

// Gewerke für Pattern-Matching
const GEWERK_NAMEN = [
  'elektrik', 'elektro', 'sanitär', 'sanitar', 'bad', 'heizung', 'maler', 'malerarbeiten',
  'boden', 'bodenbelag', 'fliesen', 'trockenbau', 'wände', 'wande', 'decken',
  'türen', 'turen', 'fenster', 'tischler', 'entkernung', 'endreinigung', 'reinigung'
];

// Status-Werte für Pattern-Matching
const STATUS_WERTE = [
  'fertig', 'erledigt', 'abgeschlossen', 'komplett',
  'läuft', 'lauft', 'arbeit', 'in arbeit', 'begonnen',
  'geplant', 'offen', 'ausstehend',
  'verspätet', 'verspatet', 'verzug', 'verzögert', 'verzogert'
];

// Termin-Typen für Pattern-Matching
const TERMIN_TYPEN = [
  { pattern: /ende\s*(nu\s*)?plan/i, typ: 'plan' },
  { pattern: /mängelfrei|maengelfrei|mangelfrei/i, typ: 'maengelfrei' },
  { pattern: /ende\s*kunde|kundenübergabe|kundenubergabe/i, typ: 'kunde' },
  { pattern: /start|beginn|anfang/i, typ: 'start' },
  { pattern: /bv\s*ende/i, typ: 'plan' }
];

/**
 * Prüft ob ein Text wie ein Sprach-Befehl aussieht
 */
function siehtAusWieBefehl(text: string): boolean {
  const t = text.toLowerCase().trim();
  // Beginnt mit ATBS oder 3-stelliger Zahl
  if (/^(atbs[- ]?)?\d{3}\b/i.test(t)) return true;
  // Enthält Schlüsselwörter
  if (/\b(nachtrag|mangel|status|termin|setze|verschiebe|melde|erstelle)\b/i.test(t)) return true;
  return false;
}

/**
 * Parst ein Datum aus verschiedenen Formaten
 */
function parseDatum(text: string): Date | null {
  const heute = new Date();
  const t = text.toLowerCase();

  // "heute"
  if (t.includes('heute')) return heute;

  // "morgen"
  if (t.includes('morgen')) {
    const d = new Date(heute);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // "übermorgen"
  if (t.includes('übermorgen') || t.includes('ubermorgen')) {
    const d = new Date(heute);
    d.setDate(d.getDate() + 2);
    return d;
  }

  // "in X Tagen/Wochen"
  const relMatch = t.match(/in\s+(\d+)\s+(tag|tage|woche|wochen)/i);
  if (relMatch) {
    const anzahl = parseInt(relMatch[1]);
    const einheit = relMatch[2].toLowerCase();
    const d = new Date(heute);
    if (einheit.startsWith('woche')) {
      d.setDate(d.getDate() + anzahl * 7);
    } else {
      d.setDate(d.getDate() + anzahl);
    }
    return d;
  }

  // "um X Tage"
  const umMatch = t.match(/um\s+(\d+)\s+(tag|tage)/i);
  if (umMatch) {
    const anzahl = parseInt(umMatch[1]);
    const d = new Date(heute);
    d.setDate(d.getDate() + anzahl);
    return d;
  }

  // Deutsche Datumsformate: 17.03., 17.03.2026, 17.3.26
  const deMatch = text.match(/(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/);
  if (deMatch) {
    const tag = parseInt(deMatch[1]);
    const monat = parseInt(deMatch[2]) - 1;
    let jahr = deMatch[3] ? parseInt(deMatch[3]) : heute.getFullYear();
    if (jahr < 100) jahr += 2000;
    const d = new Date(jahr, monat, tag);
    // Wenn Datum in Vergangenheit liegt und kein Jahr angegeben, nächstes Jahr nehmen
    if (!deMatch[3] && d < heute) {
      d.setFullYear(d.getFullYear() + 1);
    }
    return d;
  }

  return null;
}

/**
 * Extrahiert ATBS-Nummer aus Text
 */
function extractAtbsFromText(text: string): string | null {
  // "ATBS-456", "ATBS 456", "atbs456", "456" am Anfang
  const match = text.match(/(?:atbs[- ]?)?(\d{3})\b/i);
  return match ? match[1] : null;
}

/**
 * Extrahiert Gewerk aus Text
 */
function extractGewerkFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const g of GEWERK_NAMEN) {
    if (t.includes(g)) {
      // Normalisiere Gewerk-Namen
      if (g === 'elektro') return 'Elektrik';
      if (g === 'sanitar' || g === 'bad') return 'Sanitär';
      if (g === 'malerarbeiten') return 'Maler';
      if (g === 'bodenbelag') return 'Boden';
      if (g === 'wande') return 'Wände';
      if (g === 'turen') return 'Türen';
      if (g === 'reinigung') return 'Endreinigung';
      // Kapitalisiere ersten Buchstaben
      return g.charAt(0).toUpperCase() + g.slice(1);
    }
  }
  return null;
}

/**
 * Extrahiert Status aus Text
 */
function extractStatusFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const s of STATUS_WERTE) {
    if (t.includes(s)) {
      // Normalisiere Status-Werte
      if (['fertig', 'erledigt', 'abgeschlossen', 'komplett'].includes(s)) return 'Fertig';
      if (['läuft', 'lauft', 'arbeit', 'in arbeit', 'begonnen'].includes(s)) return 'Läuft';
      if (['geplant', 'offen', 'ausstehend'].includes(s)) return 'Geplant';
      if (['verspätet', 'verspatet', 'verzug', 'verzögert', 'verzogert'].includes(s)) return 'Verspätet';
    }
  }
  return null;
}

/**
 * Extrahiert Termin-Typ aus Text
 */
function extractTerminTypFromText(text: string): string | null {
  for (const { pattern, typ } of TERMIN_TYPEN) {
    if (pattern.test(text)) return typ;
  }
  return null;
}

/**
 * Hauptfunktion: Parst Sprach-Befehl via Pattern-Matching
 */
function parseSprachBefehl(text: string): SprachBefehl | null {
  const t = text.toLowerCase().trim();

  // ATBS extrahieren (optional, kann fehlen wenn Projekt bereits offen)
  const atbs = extractAtbsFromText(text);

  // STATUS-BEFEHLE
  // Patterns: "ATBS 450 setze Status Elektrik auf Fertig", "450 Elektrik fertig", "Sanitär ist fertig"
  if (/\b(status|setze|ist|auf)\b.*\b(fertig|erledigt|läuft|lauft|geplant|verspätet|verspatet)\b/i.test(t) ||
      /\b(fertig|erledigt|läuft|lauft|geplant|verspätet|verspatet)\b.*\b(status|setze)\b/i.test(t) ||
      (extractGewerkFromText(text) && extractStatusFromText(text))) {
    const gewerk = extractGewerkFromText(text);
    const status = extractStatusFromText(text);
    if (gewerk && status) {
      return {
        typ: 'status',
        atbs: atbs || undefined,
        gewerk,
        status,
        raw: text
      };
    }
  }

  // TERMIN-BEFEHLE
  // Patterns: "ATBS 450 BV Ende Plan auf 17.03.", "verschiebe Ende um 2 Tage", "setze Mängelfrei auf heute"
  const terminTyp = extractTerminTypFromText(text);
  if (terminTyp || /\b(termin|verschiebe|setze.*auf|ende|datum)\b/i.test(t)) {
    const datum = parseDatum(text);
    if (terminTyp || datum) {
      return {
        typ: 'termin',
        atbs: atbs || undefined,
        terminTyp: terminTyp || 'plan',
        datum: datum || undefined,
        raw: text
      };
    }
  }

  // NACHTRAG-BEFEHLE
  // Patterns: "ATBS 450 erstelle Nachtrag: 2 Heizkörper tauschen", "Nachtrag für 456: Bad neu fliesen"
  if (/\b(nachtrag|nachträge|nachtrage)\b/i.test(t)) {
    // Beschreibung extrahieren (nach : oder nach "Nachtrag")
    let beschreibung = '';
    const colonMatch = text.match(/(?:nachtrag[^:]*:\s*)(.+)/i);
    if (colonMatch) {
      beschreibung = colonMatch[1].trim();
    } else {
      // Alles nach "Nachtrag" nehmen
      const nachMatch = text.match(/nachtrag\s+(?:für\s+\d+\s*)?(.+)/i);
      if (nachMatch) beschreibung = nachMatch[1].trim();
    }

    return {
      typ: 'nachtrag',
      atbs: atbs || undefined,
      beschreibung: beschreibung || text,
      raw: text
    };
  }

  // MANGEL-BEFEHLE
  // Patterns: "ATBS 456 melde Mangel: Riss in Fliese", "Mangel bei 450: Steckdose locker"
  if (/\b(mangel|mängel|maengel|melde)\b/i.test(t)) {
    // Beschreibung extrahieren
    let beschreibung = '';
    const colonMatch = text.match(/(?:mangel[^:]*:\s*)(.+)/i);
    if (colonMatch) {
      beschreibung = colonMatch[1].trim();
    } else {
      const mangelMatch = text.match(/(?:melde\s+)?mangel\s+(?:bei\s+\d+\s*)?(.+)/i);
      if (mangelMatch) beschreibung = mangelMatch[1].trim();
    }

    // Gewerk aus Beschreibung extrahieren
    const gewerk = extractGewerkFromText(beschreibung || text);

    return {
      typ: 'mangel',
      atbs: atbs || undefined,
      gewerk: gewerk || undefined,
      beschreibung: beschreibung || text,
      raw: text
    };
  }

  return null;
}

/**
 * GPT-Fallback für komplexe Befehle
 */
async function parseWithGPT(text: string): Promise<SprachBefehl | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Du bist ein Parser für Baustellen-Befehle. Extrahiere:
- typ: status | termin | nachtrag | mangel
- atbs: ATBS-Nummer (nur die Zahl, z.B. "456")
- gewerk: Falls Status-Änderung (Elektrik, Sanitär, Maler, Boden, Heizung, Trockenbau, Türen, Fenster, Entkernung, Endreinigung)
- status: Zielstatus (Fertig, Läuft, Geplant, Verspätet)
- terminTyp: start | plan | maengelfrei | kunde
- datum: Falls Termin (ISO-Format YYYY-MM-DD)
- beschreibung: Falls Nachtrag/Mangel

Wenn du den Befehl nicht verstehst, antworte mit {"typ": null}.
Antworte NUR mit JSON.`
          },
          {
            role: 'user',
            content: text
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error('GPT parse error:', await response.text());
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.typ) return null;

      return {
        typ: parsed.typ,
        atbs: parsed.atbs || undefined,
        gewerk: parsed.gewerk || undefined,
        status: parsed.status || undefined,
        terminTyp: parsed.terminTyp || undefined,
        datum: parsed.datum ? new Date(parsed.datum) : undefined,
        beschreibung: parsed.beschreibung || undefined,
        raw: text
      };
    }

    return null;
  } catch (e) {
    console.error('GPT parse error:', e);
    return null;
  }
}

/**
 * Haupt-Parser: Versucht erst Pattern-Matching, dann GPT-Fallback
 */
async function parseSprachBefehlMitFallback(text: string): Promise<SprachBefehl | null> {
  // Erst Pattern-Matching versuchen
  const befehl = parseSprachBefehl(text);
  if (befehl) {
    console.log('Sprach-Befehl via Pattern erkannt:', JSON.stringify(befehl));
    return befehl;
  }

  // GPT-Fallback für komplexe Befehle
  console.log('Pattern-Matching fehlgeschlagen, versuche GPT...');
  const gptBefehl = await parseWithGPT(text);
  if (gptBefehl) {
    console.log('Sprach-Befehl via GPT erkannt:', JSON.stringify(gptBefehl));
  }
  return gptBefehl;
}

/**
 * Loggt Sprach-Befehl in die Datenbank
 */
async function logSprachBefehl(chatId: number, befehl: SprachBefehl | null, erfolg: boolean, fehlerMeldung?: string) {
  try {
    await supabase.from('telegram_befehle_log').insert({
      chat_id: chatId,
      befehl_typ: befehl?.typ || 'unbekannt',
      atbs_nummer: befehl?.atbs || null,
      raw_text: befehl?.raw || '',
      parsed_data: befehl ? JSON.stringify(befehl) : null,
      erfolg,
      fehler_meldung: fehlerMeldung || null
    });
  } catch (e) {
    console.error('Fehler beim Logging:', e);
  }
}

/**
 * Zeigt die Hilfe für Sprach-Befehle an
 */
async function showSprachBefehlHilfe(chatId: number) {
  const hilfeText = `❓ <b>Sprach-Befehle Hilfe</b>

Beispiele für Sprach-Befehle:

📊 <b>Status ändern:</b>
   "ATBS 450 setze Status Elektrik auf Fertig"
   "ATBS-456 Sanitär ist fertig"

📅 <b>Termin ändern:</b>
   "ATBS 450 BV Ende Plan auf 17.03."
   "ATBS-456 verschiebe Ende um 2 Tage"

📋 <b>Nachtrag erstellen:</b>
   "ATBS 450 erstelle Nachtrag: 2 Heizkörper tauschen"

🔧 <b>Mangel melden:</b>
   "ATBS 456 melde Mangel: Riss in Badezimmerfliese"

💡 <b>Tipp:</b> Immer mit ATBS-Nummer beginnen!`;

  await sendMessage(chatId, hilfeText, {
    reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
    ] }
  });
}

/**
 * Verarbeitet einen erkannten Sprach-Befehl
 */
async function handleSprachBefehl(chatId: number, session: any, befehl: SprachBefehl) {
  // ATBS aus Session holen wenn nicht im Befehl
  const atbs = befehl.atbs || session?.modus_daten?.projekt_nr?.replace(/^ATBS[- ]?/i, '');

  if (!atbs) {
    await sendMessage(chatId,
      `⚠️ Keine ATBS-Nummer erkannt.\n\n` +
      `Bitte öffne zuerst ein Projekt oder gib die ATBS-Nummer an:\n` +
      `z.B. "ATBS 450 Elektrik fertig"`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🏗️ Projekt öffnen", callback_data: "mode_baustelle" }]
      ] } }
    );
    await logSprachBefehl(chatId, befehl, false, 'Keine ATBS-Nummer');
    return;
  }

  switch (befehl.typ) {
    case 'status':
      await handleStatusBefehl(chatId, session, befehl, atbs);
      break;
    case 'termin':
      await handleTerminBefehl(chatId, session, befehl, atbs);
      break;
    case 'nachtrag':
      await handleNachtragBefehl(chatId, session, befehl, atbs);
      break;
    case 'mangel':
      await handleMangelBefehl(chatId, session, befehl, atbs);
      break;
  }
}

/**
 * Verarbeitet Status-Änderungen
 */
async function handleStatusBefehl(chatId: number, session: any, befehl: SprachBefehl, atbs: string) {
  if (!befehl.gewerk || !befehl.status) {
    await sendMessage(chatId, `⚠️ Gewerk oder Status nicht erkannt.\n\nBeispiel: "ATBS ${atbs} Elektrik auf Fertig setzen"`);
    await logSprachBefehl(chatId, befehl, false, 'Gewerk/Status fehlt');
    return;
  }

  // Bestätigung anfordern
  await updateSession(chatId, {
    aktueller_modus: 'befehl_bestaetigung',
    modus_daten: {
      ...session?.modus_daten,
      pending_befehl: befehl,
      pending_atbs: atbs
    }
  });

  await sendMessage(chatId,
    `<b>📝 Status-Änderung bestätigen</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `Gewerk: ${befehl.gewerk}\n` +
    `Neuer Status: ${befehl.status}\n\n` +
    `Soll ich diese Änderung durchführen?`,
    { reply_markup: { inline_keyboard: [
      [
        { text: "✅ Ja, ändern", callback_data: "befehl:bestaetigen" },
        { text: "❌ Abbrechen", callback_data: "befehl:abbrechen" }
      ]
    ] } }
  );
}

/**
 * Verarbeitet Termin-Änderungen
 */
async function handleTerminBefehl(chatId: number, session: any, befehl: SprachBefehl, atbs: string) {
  const terminTypNamen: Record<string, string> = {
    'start': 'Start',
    'plan': 'Ende NU Plan',
    'maengelfrei': 'Ende Mängelfrei',
    'kunde': 'Ende Kunde'
  };

  const terminName = terminTypNamen[befehl.terminTyp || 'plan'] || befehl.terminTyp;
  const datumStr = befehl.datum
    ? befehl.datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '(nicht angegeben)';

  if (!befehl.datum) {
    await sendMessage(chatId,
      `⚠️ Kein Datum erkannt.\n\n` +
      `Beispiele:\n` +
      `• "ATBS ${atbs} Ende Plan auf 17.03."\n` +
      `• "ATBS ${atbs} verschiebe Mängelfrei um 3 Tage"\n` +
      `• "ATBS ${atbs} setze Kunde auf morgen"`
    );
    await logSprachBefehl(chatId, befehl, false, 'Datum fehlt');
    return;
  }

  // Bestätigung anfordern
  await updateSession(chatId, {
    aktueller_modus: 'befehl_bestaetigung',
    modus_daten: {
      ...session?.modus_daten,
      pending_befehl: befehl,
      pending_atbs: atbs
    }
  });

  await sendMessage(chatId,
    `<b>📅 Termin-Änderung bestätigen</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `Termin: ${terminName}\n` +
    `Neues Datum: ${datumStr}\n\n` +
    `Soll ich diesen Termin setzen?`,
    { reply_markup: { inline_keyboard: [
      [
        { text: "✅ Ja, setzen", callback_data: "befehl:bestaetigen" },
        { text: "❌ Abbrechen", callback_data: "befehl:abbrechen" }
      ]
    ] } }
  );
}

/**
 * Verarbeitet Nachtrag-Erfassung
 */
async function handleNachtragBefehl(chatId: number, session: any, befehl: SprachBefehl, atbs: string) {
  if (!befehl.beschreibung || befehl.beschreibung.length < 5) {
    await sendMessage(chatId,
      `⚠️ Beschreibung zu kurz.\n\n` +
      `Beispiel: "ATBS ${atbs} Nachtrag: 2 zusätzliche Heizkörper einbauen"`
    );
    await logSprachBefehl(chatId, befehl, false, 'Beschreibung zu kurz');
    return;
  }

  // Bestätigung anfordern
  await updateSession(chatId, {
    aktueller_modus: 'befehl_bestaetigung',
    modus_daten: {
      ...session?.modus_daten,
      pending_befehl: befehl,
      pending_atbs: atbs
    }
  });

  await sendMessage(chatId,
    `<b>📋 Nachtrag erfassen</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `Beschreibung: ${befehl.beschreibung}\n\n` +
    `Soll ich diesen Nachtrag anlegen?`,
    { reply_markup: { inline_keyboard: [
      [
        { text: "✅ Ja, anlegen", callback_data: "befehl:bestaetigen" },
        { text: "❌ Abbrechen", callback_data: "befehl:abbrechen" }
      ]
    ] } }
  );
}

/**
 * Verarbeitet Mangel-Meldung
 */
async function handleMangelBefehl(chatId: number, session: any, befehl: SprachBefehl, atbs: string) {
  if (!befehl.beschreibung || befehl.beschreibung.length < 5) {
    await sendMessage(chatId,
      `⚠️ Beschreibung zu kurz.\n\n` +
      `Beispiel: "ATBS ${atbs} Mangel: Riss in Badezimmerfliese"`
    );
    await logSprachBefehl(chatId, befehl, false, 'Beschreibung zu kurz');
    return;
  }

  // Bestätigung anfordern
  await updateSession(chatId, {
    aktueller_modus: 'befehl_bestaetigung',
    modus_daten: {
      ...session?.modus_daten,
      pending_befehl: befehl,
      pending_atbs: atbs
    }
  });

  const gewerkStr = befehl.gewerk ? `\nGewerk: ${befehl.gewerk}` : '';

  await sendMessage(chatId,
    `<b>🔧 Mangel melden</b>\n\n` +
    `Projekt: ATBS-${atbs}${gewerkStr}\n` +
    `Beschreibung: ${befehl.beschreibung}\n\n` +
    `Soll ich diesen Mangel anlegen?`,
    { reply_markup: { inline_keyboard: [
      [
        { text: "✅ Ja, melden", callback_data: "befehl:bestaetigen" },
        { text: "❌ Abbrechen", callback_data: "befehl:abbrechen" }
      ]
    ] } }
  );
}

/**
 * Führt einen bestätigten Sprach-Befehl aus
 */
async function executeSprachBefehl(chatId: number, session: any) {
  const befehl = session?.modus_daten?.pending_befehl as SprachBefehl | undefined;
  const atbs = session?.modus_daten?.pending_atbs as string | undefined;

  if (!befehl || !atbs) {
    await sendMessage(chatId, '⚠️ Kein Befehl zum Ausführen gefunden.');
    return;
  }

  try {
    switch (befehl.typ) {
      case 'status':
        await executeStatusBefehl(chatId, befehl, atbs);
        break;
      case 'termin':
        await executeTerminBefehl(chatId, befehl, atbs);
        break;
      case 'nachtrag':
        await executeNachtragBefehl(chatId, befehl, atbs);
        break;
      case 'mangel':
        await executeMangelBefehl(chatId, befehl, atbs);
        break;
    }

    await logSprachBefehl(chatId, befehl, true);

    // Session zurücksetzen
    await updateSession(chatId, {
      aktueller_modus: session?.aktuelles_bv_id ? 'baustelle' : null,
      modus_daten: {
        projekt_nr: session?.modus_daten?.projekt_nr,
        projekt_name: session?.modus_daten?.projekt_name
      }
    });

  } catch (error) {
    console.error('Fehler bei Befehl-Ausführung:', error);
    await sendMessage(chatId, `❌ Fehler: ${(error as Error).message}`);
    await logSprachBefehl(chatId, befehl, false, (error as Error).message);
  }
}

/**
 * Führt Status-Änderung aus
 */
async function executeStatusBefehl(chatId: number, befehl: SprachBefehl, atbs: string) {
  // Finde das Projekt in Monday
  const { data: projekte } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .limit(200);

  if (!projekte) {
    throw new Error('Projekt nicht gefunden');
  }

  const match = projekte.find(p => {
    const pAtbs = extractATBS(p.column_values);
    return pAtbs === atbs || pAtbs === `ATBS-${atbs}`;
  });

  if (!match) {
    throw new Error(`Projekt ATBS-${atbs} nicht gefunden`);
  }

  // Finde die Monday-Spalten-ID für das Gewerk
  const gewerkLower = (befehl.gewerk || '').toLowerCase();
  const spalteId = GEWERK_SPALTEN[gewerkLower];

  if (!spalteId) {
    throw new Error(`Gewerk "${befehl.gewerk}" nicht zugeordnet`);
  }

  // Map Status zu Monday-Label
  const mondayStatus = mapStatusToMonday(gewerkLower, befehl.status || 'geplant');

  // 1. Supabase: column_values updaten
  const updatedColumnValues = { ...match.column_values };
  updatedColumnValues[spalteId] = { label: mondayStatus };

  const { error: dbError } = await supabase
    .from('monday_bauprozess')
    .update({
      column_values: updatedColumnValues,
      updated_at: new Date().toISOString()
    })
    .eq('id', match.id);

  if (dbError) {
    throw new Error(`Supabase Update fehlgeschlagen: ${dbError.message}`);
  }

  // 2. Monday: Status-Spalte via API ändern
  const mondayChanges: Record<string, any> = {};
  mondayChanges[spalteId] = { label: mondayStatus };

  const mondaySuccess = await pushToMonday(match.id, mondayChanges);

  // Erfolgsmeldung
  const syncStatus = mondaySuccess ? '✅ Monday synchronisiert' : '⚠️ Monday-Sync fehlgeschlagen (lokal gespeichert)';

  await sendMessage(chatId,
    `✅ <b>Status geändert</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `Gewerk: ${befehl.gewerk}\n` +
    `Neuer Status: ${mondayStatus}\n\n` +
    `${syncStatus}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🏗️ Zurück zur Baustelle", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Führt Termin-Änderung aus
 */
async function executeTerminBefehl(chatId: number, befehl: SprachBefehl, atbs: string) {
  // Finde das Projekt
  const { data: projekte } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .limit(200);

  if (!projekte) {
    throw new Error('Keine Projekte gefunden');
  }

  const match = projekte.find(p => {
    const pAtbs = extractATBS(p.column_values);
    return pAtbs === atbs || pAtbs === `ATBS-${atbs}`;
  });

  if (!match) {
    throw new Error(`Projekt ATBS-${atbs} nicht gefunden`);
  }

  const terminTypNamen: Record<string, string> = {
    'start': 'BV Start',
    'plan': 'BV Ende NU Plan',
    'maengelfrei': 'BV Ende Mängelfrei',
    'kunde': 'BV Ende Kunde'
  };

  // Finde die Monday-Spalten-ID für den Termin-Typ
  const terminTyp = befehl.terminTyp || 'plan';
  const spalteId = TERMIN_SPALTEN[terminTyp];

  if (!spalteId) {
    throw new Error(`Termin-Typ "${terminTyp}" nicht zugeordnet`);
  }

  if (!befehl.datum) {
    throw new Error('Kein Datum angegeben');
  }

  // Datum als ISO-String formatieren für Monday (YYYY-MM-DD)
  const isoDate = befehl.datum.toISOString().split('T')[0];
  const datumStr = befehl.datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // 1. Supabase: column_values updaten
  const updatedColumnValues = { ...match.column_values };
  updatedColumnValues[spalteId] = { date: isoDate };

  const { error: dbError } = await supabase
    .from('monday_bauprozess')
    .update({
      column_values: updatedColumnValues,
      updated_at: new Date().toISOString()
    })
    .eq('id', match.id);

  if (dbError) {
    throw new Error(`Supabase Update fehlgeschlagen: ${dbError.message}`);
  }

  // 2. Monday: Datum-Spalte via API ändern
  const mondayChanges: Record<string, any> = {};
  mondayChanges[spalteId] = { date: isoDate };

  const mondaySuccess = await pushToMonday(match.id, mondayChanges);

  // Erfolgsmeldung
  const syncStatus = mondaySuccess ? '✅ Monday synchronisiert' : '⚠️ Monday-Sync fehlgeschlagen (lokal gespeichert)';

  await sendMessage(chatId,
    `✅ <b>Termin geändert</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `Termin: ${terminTypNamen[terminTyp]}\n` +
    `Neues Datum: ${datumStr}\n\n` +
    `${syncStatus}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🏗️ Zurück zur Baustelle", callback_data: "bau:menu" }]
    ] } }
  );
}

/**
 * Führt Nachtrag-Erfassung aus
 */
async function executeNachtragBefehl(chatId: number, befehl: SprachBefehl, atbs: string) {
  // Ermittle gemeldet_von basierend auf chat_id
  let gemeldetVon = 'telegram';
  const { data: kontakt } = await supabase
    .from('kontakte')
    .select('kontakt_typ, nachname, vorname')
    .eq('telegram_chat_id', chatId.toString())
    .single();

  if (kontakt) {
    if (kontakt.kontakt_typ === 'NU') {
      gemeldetVon = 'nu';
    } else if (kontakt.kontakt_typ === 'BL' || kontakt.nachname === 'Neumann') {
      gemeldetVon = 'bauleiter';
    }
  }

  // Nachtrag in DB anlegen
  const { data: nachtrag, error } = await supabase
    .from('nachtraege')
    .insert({
      atbs_nummer: `ATBS-${atbs}`,
      beschreibung: befehl.beschreibung,
      status: 'Gemeldet',
      gemeldet_von: gemeldetVon,
      gemeldet_am: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Fehler beim Anlegen: ${error.message}`);
  }

  await sendMessage(chatId,
    `✅ <b>Nachtrag angelegt</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `ID: ${nachtrag.id}\n` +
    `Beschreibung: ${befehl.beschreibung}\n` +
    `Gemeldet von: ${gemeldetVon}\n\n` +
    `<i>Möchtest du ein Foto hinzufügen?</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );

  // Session aktualisieren für Foto-Upload
  await updateSession(chatId, {
    modus_daten: {
      ...befehl,
      nachtrag_id: nachtrag.id,
      projekt_nr: `ATBS-${atbs}`
    }
  });
}

/**
 * Führt Mangel-Meldung aus
 */
async function executeMangelBefehl(chatId: number, befehl: SprachBefehl, atbs: string) {
  const frist = new Date();
  frist.setDate(frist.getDate() + 7);

  // Mangel in DB anlegen
  const { data: mangel, error } = await supabase
    .from('maengel_fertigstellung')
    .insert({
      projekt_nr: `ATBS-${atbs}`,
      beschreibung_mangel: befehl.beschreibung,
      art_des_mangels: befehl.gewerk || 'Sonstiges',
      status_mangel: 'Offen',
      datum_meldung: new Date().toISOString(),
      datum_frist: frist.toISOString(),
      erinnerung_status: 'Aktiv'
    })
    .select('id, mangel_id')
    .single();

  if (error) {
    throw new Error(`Fehler beim Anlegen: ${error.message}`);
  }

  await sendMessage(chatId,
    `✅ <b>Mangel gemeldet</b>\n\n` +
    `Projekt: ATBS-${atbs}\n` +
    `ID: ${mangel.mangel_id || mangel.id}\n` +
    `Gewerk: ${befehl.gewerk || 'Sonstiges'}\n` +
    `Beschreibung: ${befehl.beschreibung}\n` +
    `Frist: ${frist.toLocaleDateString('de-DE')}\n\n` +
    `<i>Möchtest du ein Foto hinzufügen?</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "mangel:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );

  // Session aktualisieren für Foto-Upload
  await updateSession(chatId, {
    aktueller_modus: 'mangel_foto',
    modus_daten: {
      created_maengel: [{ id: mangel.id, mangel_id: mangel.mangel_id, beschreibung: befehl.beschreibung, gewerk: befehl.gewerk }],
      projekt_nr: `ATBS-${atbs}`
    }
  });
}

// ============================================
// OpenAI Whisper Integration (Sprache-zu-Text)
// ============================================

async function transcribeVoice(base64Audio: string, mimeType: string = 'audio/ogg'): Promise<string | null> {
  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const formData = new FormData();
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp3') ? 'mp3' : 'm4a';
    formData.append('file', new Blob([bytes], { type: mimeType }), `voice.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'de');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      console.error('Whisper error:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (e) {
    console.error('Transcribe error:', e);
    return null;
  }
}

// ============================================
// OpenAI GPT-5.2 für Mangel-Splitting + Übersetzung
// ============================================

async function parseAndTranslateMaengel(text: string): Promise<{maengel: Array<{beschreibung_de: string, gewerk?: string}>, detected_language: string}> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `Du bist ein Assistent für Baustellen-Mängelerfassung.
Der Benutzer beschreibt Mängel auf Deutsch, Russisch, Ungarisch, Rumänisch oder Polnisch.

Deine Aufgabe:
1. Erkenne die Sprache des Inputs
2. Trenne mehrere Mängel in einzelne Einträge
3. Übersetze alles auf Deutsch
4. Erkenne das Gewerk wenn möglich (Elektrik, Sanitär, Maler, Boden, Türen, Fenster, Heizung, Trockenbau, Sonstiges)

Antworte NUR mit JSON im Format:
{
  "detected_language": "DE|RU|HU|RO|PL",
  "maengel": [
    {"beschreibung_de": "Deutsche Beschreibung", "gewerk": "Elektrik"},
    ...
  ]
}`
          },
          {
            role: 'user',
            content: text
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error('GPT error:', await response.text());
      return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        maengel: parsed.maengel || [{ beschreibung_de: text }],
        detected_language: parsed.detected_language || 'DE'
      };
    }

    return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
  } catch (e) {
    console.error('Parse error:', e);
    return { maengel: [{ beschreibung_de: text }], detected_language: 'DE' };
  }
}

// ============================================
// Baustellen-Features: Projekt öffnen
// ============================================

async function showBaustellenMenu(chatId: number, session: any) {
  const bvId = session?.aktuelles_bv_id;
  const projektNr = session?.modus_daten?.projekt_nr;
  const projektName = session?.modus_daten?.projekt_name;

  if (bvId && projektNr) {
    await sendMessage(chatId,
      `<b>🏗️ Baustelle: ${projektNr}</b>\n` +
      `${projektName || ''}\n\n` +
      `Was möchtest du tun?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
        [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
        [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
        [{ text: "📄 Abnahmeprotokoll", callback_data: "bau:abnahme" }],
        [{ text: "📊 Status anzeigen", callback_data: "bau:status" }],
        [{ text: "❌ Projekt schließen", callback_data: "bau:close" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  } else {
    // NEU v51: Auswahl-Methode anzeigen
    await updateSession(chatId, { aktueller_modus: 'baustelle_auswahl', modus_daten: {} });
    await sendMessage(chatId,
      `<b>🏗️ Baustelle öffnen</b>\n\n` +
      `Wie möchtest du ein Projekt finden?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📁 Nach Phase filtern", callback_data: "bau:select_method:phase" }],
        [{ text: "🔍 ATBS-Nummer eingeben", callback_data: "bau:select_method:atbs" }],
        [{ text: "📋 Alle aktiven Projekte", callback_data: "bau:list" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  }
}

// NEU v51: Phasen-Auswahl anzeigen
async function showPhaseSelection(chatId: number) {
  await updateSession(chatId, { aktueller_modus: 'baustelle_phase_wahl', modus_daten: {} });
  await sendMessage(chatId,
    `<b>📁 Phase auswählen</b>\n\n` +
    `Welche Phase möchtest du filtern?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "(0) Bedarfsanalyse", callback_data: "phase:0" }],
      [{ text: "(1) Angebotsstellung", callback_data: "phase:1" }],
      [{ text: "(2) Auftrag erhalten", callback_data: "phase:2" }],
      [{ text: "(3) Vorbereitung", callback_data: "phase:3" }],
      [{ text: "(4) Umsetzung", callback_data: "phase:4" }],
      [{ text: "⬅️ Zurück", callback_data: "mode_baustelle" }]
    ] } }
  );
}

// NEU v51: Projekte nach Phase filtern
async function listProjekteByPhase(chatId: number, phaseNumber: number, page: number = 0) {
  const PAGE_SIZE = 15;

  const { data: projekte, error } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId, 'Keine Projekte gefunden.');
    return;
  }

  // Nach Phase filtern
  const gefiltert = projekte.filter(p => {
    const pNum = extractPhaseNumber(p.column_values);
    return pNum === phaseNumber;
  });

  if (gefiltert.length === 0) {
    await sendMessage(chatId,
      `Keine Projekte in Phase ${PHASE_LABELS[phaseNumber] || phaseNumber} gefunden.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Andere Phase wählen", callback_data: "bau:select_method:phase" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  // Pagination
  const totalPages = Math.ceil(gefiltert.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = gefiltert.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = extractATBS(p.column_values) || p.id.substring(0, 8);
    // VOLLSTÄNDIGER Name - nicht abschneiden!
    const name = p.name || extractProjectName(p.column_values) || '';
    return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
  });

  // Pagination-Buttons
  const navButtons: any[] = [];
  if (page > 0) {
    navButtons.push({ text: "⬅️ Zurück", callback_data: `phase:${phaseNumber}:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: "Weiter ➡️", callback_data: `phase:${phaseNumber}:${page + 1}` });
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([{ text: "📁 Andere Phase", callback_data: "bau:select_method:phase" }]);
  buttons.push([{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]);

  const pageInfo = totalPages > 1 ? ` (Seite ${page + 1}/${totalPages})` : '';
  await sendMessage(chatId,
    `<b>${PHASE_LABELS[phaseNumber] || `Phase ${phaseNumber}`}</b>\n` +
    `${gefiltert.length} Projekte${pageInfo}:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// NEU v51: ATBS-Schnellzugriff Modus
async function startAtbsDirectInput(chatId: number) {
  await updateSession(chatId, { aktueller_modus: 'atbs_direkt', modus_daten: {} });
  await sendMessage(chatId,
    `<b>🔍 ATBS direkt eingeben</b>\n\n` +
    `Gib die ATBS-Nummer ein (z.B. ATBS-448 oder nur 448):`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
    ] } }
  );
}

async function listActiveProjekte(chatId: number, page: number = 0) {
  const PAGE_SIZE = 15;

  const { data: projekte, error } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Projekte gefunden.');
    return;
  }

  // Filter auf aktive Phasen (2, 3, 4)
  const aktiveProjekte = projekte.filter(p => {
    const phaseNum = extractPhaseNumber(p.column_values);
    return phaseNum !== null && [2, 3, 4].includes(phaseNum);
  });

  if (aktiveProjekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Baustellen gefunden.');
    return;
  }

  // Pagination
  const totalPages = Math.ceil(aktiveProjekte.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = aktiveProjekte.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = extractATBS(p.column_values) || p.id.substring(0, 8);
    // VOLLSTÄNDIGER Name - nicht abschneiden!
    const name = p.name || extractProjectName(p.column_values) || '';
    return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
  });

  // Pagination-Buttons
  const navButtons: any[] = [];
  if (page > 0) {
    navButtons.push({ text: "⬅️ Zurück", callback_data: `bau:list:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: "Weiter ➡️", callback_data: `bau:list:${page + 1}` });
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([{ text: "📁 Nach Phase filtern", callback_data: "bau:select_method:phase" }]);
  buttons.push([{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]);

  const pageInfo = totalPages > 1 ? ` (Seite ${page + 1}/${totalPages})` : '';
  await sendMessage(chatId,
    `<b>Aktive Baustellen (${aktiveProjekte.length})${pageInfo}:</b>`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function searchAndOpenProjekt(chatId: number, searchTerm: string) {
  // Normalisiere Suchbegriff: "448", "ATBS-448", "ATBS 448" -> "448"
  let term = searchTerm.trim().toUpperCase();
  term = term.replace(/^ATBS[- ]?/i, '');

  const { data: projekte } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .limit(200);

  if (!projekte) {
    await sendMessage(chatId, 'Fehler bei der Projektsuche.');
    return;
  }

  const matches = projekte.filter(p => {
    const atbs = (extractATBS(p.column_values) || '').toUpperCase();
    const name = (p.name || '').toUpperCase();
    // Suche auch nach reiner Nummer im ATBS
    const atbsNum = atbs.replace(/^ATBS[- ]?/i, '');
    return atbs.includes(term) || atbsNum === term || name.includes(term);
  });

  if (matches.length === 0) {
    await sendMessage(chatId,
      `Kein Projekt gefunden für "${searchTerm}".\n\nVersuche eine ATBS-Nummer (z.B. ATBS-448 oder 448).`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🔍 Nochmal suchen", callback_data: "bau:select_method:atbs" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  if (matches.length === 1) {
    await openProjekt(chatId, matches[0]);
  } else {
    // VOLLSTÄNDIGER Name - nicht abschneiden!
    const buttons = matches.slice(0, 15).map(p => {
      const atbs = extractATBS(p.column_values) || p.id.substring(0, 8);
      const name = p.name || extractProjectName(p.column_values) || '';
      return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
    });
    buttons.push([{ text: "⬅️ Abbrechen", callback_data: "mode_baustelle" }]);

    await sendMessage(chatId,
      `<b>${matches.length} Projekte gefunden:</b>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
}

async function openProjekt(chatId: number, projekt: any) {
  const atbs = extractATBS(projekt.column_values) || projekt.id.substring(0, 8);
  const projektName = projekt.name || extractProjectName(projekt.column_values) || '';
  const phase = extractPhase(projekt.column_values) || '?';
  const columnValues = projekt.column_values || {};

  // Extrahiere zusätzliche Projekt-Infos aus Monday
  const bauleiter = extractFieldText(columnValues, ...PROJEKT_SPALTEN.bauleiter) || '-';
  const nachunternehmer = extractFieldText(columnValues, ...PROJEKT_SPALTEN.nachunternehmer) || '-';
  const bvStart = extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0]) !== '-'
    ? extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0])
    : extractDate(columnValues, PROJEKT_SPALTEN.bv_start[1]);
  const bvEndePlan = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_plan);
  const bvEndeMaengelfrei = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_maengelfrei);
  const bvEndeKunde = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_kunde);

  // Zähle offene Mängel und Nachträge
  const { count: mangelCount } = await supabase
    .from('maengel_fertigstellung')
    .select('*', { count: 'exact', head: true })
    .eq('projekt_nr', atbs)
    .not('status_mangel', 'in', '(Abgenommen,Geschlossen)');

  const { count: nachtragCount } = await supabase
    .from('nachtraege')
    .select('*', { count: 'exact', head: true })
    .eq('atbs_nummer', atbs)
    .in('status', ['Gemeldet', 'In Prüfung']);

  await updateSession(chatId, {
    aktuelles_bv_id: projekt.id,
    aktueller_modus: 'baustelle',
    modus_daten: {
      projekt_nr: atbs,
      projekt_name: projektName,
      projekt_phase: phase
    }
  });

  // Kompakte Projekt-Info Anzeige
  let infoText = `<b>Projekt: ${atbs}</b>\n`;
  infoText += `${projektName}\n\n`;
  infoText += `━━━━━━━━━━━━━━━━━━━━\n`;
  infoText += `📍 Phase: ${phase}\n`;
  infoText += `👷 BL: ${bauleiter}\n`;
  infoText += `🔧 NU: ${nachunternehmer}\n\n`;
  infoText += `📅 Termine:\n`;
  infoText += `   Start: ${bvStart}\n`;
  infoText += `   Ende NU Plan: ${bvEndePlan}\n`;
  infoText += `   Ende Mängelfrei: ${bvEndeMaengelfrei}\n`;
  infoText += `   Ende Kunde: ${bvEndeKunde}\n\n`;
  infoText += `⚠️ Offen: ${mangelCount || 0} Mängel | ${nachtragCount || 0} Nachträge\n`;
  infoText += `━━━━━━━━━━━━━━━━━━━━`;

  await sendMessage(chatId, infoText, {
    reply_markup: { inline_keyboard: [
      [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
      [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
      [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "🏗️ Gewerk-Status", callback_data: `bau:gewerke:${projekt.id}` }],
      [{ text: "📄 Abnahmeprotokoll", callback_data: "bau:abnahme" }],
      [{ text: "📊 Status anzeigen", callback_data: "bau:status" }],
      [{ text: "📅 Termine", callback_data: `bau:termine:${projekt.id}` }],
      [{ text: "❌ Projekt schließen", callback_data: "bau:close" }]
    ] }
  });
}

// ============================================
// Baustellen-Features: Termine anpassen (NEU v55)
// ============================================

// Termin-Typen Konfiguration
const TERMIN_TYPEN: Record<string, { label: string; mondayField: string }> = {
  start: { label: 'BV Start', mondayField: 'bv_start_plan' },
  plan: { label: 'BV Ende NU Plan', mondayField: 'bv_ende_nu_plan' },
  maengelfrei: { label: 'BV Ende Mängelfrei', mondayField: 'bv_ende_maengelfrei' },
  kunde: { label: 'BV Ende Kunde', mondayField: 'bv_ende_kunde' },
};

// Termine-Menü anzeigen
async function showTermineMenu(chatId: number, projektId: string) {
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('id, name, column_values')
    .eq('id', projektId)
    .single();

  if (!projekt) {
    await sendMessage(chatId, '⚠️ Projekt nicht gefunden.');
    return;
  }

  const atbs = extractATBS(projekt.column_values) || projektId.substring(0, 8);
  const columnValues = projekt.column_values || {};

  // Termine aus Monday extrahieren
  const bvStart = extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0]) !== '-'
    ? extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0])
    : extractDate(columnValues, PROJEKT_SPALTEN.bv_start[1]);
  const bvEndePlan = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_plan);
  const bvEndeMaengelfrei = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_maengelfrei);
  const bvEndeKunde = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_kunde);

  let text = `<b>📅 Termine anpassen ${atbs}</b>\n\n`;
  text += `<b>Aktuelle Termine:</b>\n`;
  text += `• BV Start: ${bvStart}\n`;
  text += `• BV Ende NU Plan: ${bvEndePlan}\n`;
  text += `• BV Ende Mängelfrei: ${bvEndeMaengelfrei}\n`;
  text += `• BV Ende Kunde: ${bvEndeKunde}\n`;

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: [
      [{ text: "📅 BV Start ändern", callback_data: `termin:start:${projektId}` }],
      [{ text: "📅 BV Ende NU Plan ändern", callback_data: `termin:plan:${projektId}` }],
      [{ text: "📅 BV Ende Mängelfrei ändern", callback_data: `termin:maengelfrei:${projektId}` }],
      [{ text: "📅 BV Ende Kunde ändern", callback_data: `termin:kunde:${projektId}` }],
      [{ text: "⬅️ Zurück", callback_data: `bau:open:${projektId}` }]
    ] }
  });
}

// Termin-Eingabe starten
async function startTerminEingabe(chatId: number, session: any, terminTyp: string, projektId: string) {
  // Berechtigungsprüfung
  const berechtigt = await istBerechtigt(chatId);
  if (!berechtigt) {
    await sendMessage(chatId,
      '⚠️ <b>Keine Berechtigung</b>\n\n' +
      'Nur Bauleiter und Geschäftsführung können Termine ändern.',
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Zurück", callback_data: `bau:termine:${projektId}` }]
      ] } }
    );
    return;
  }

  const config = TERMIN_TYPEN[terminTyp];
  if (!config) {
    await sendMessage(chatId, '⚠️ Unbekannter Termin-Typ.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: `await_termin_${terminTyp}_${projektId}`,
    modus_daten: {
      ...session?.modus_daten,
      termin_typ: terminTyp,
      termin_projekt_id: projektId
    }
  });

  await sendMessage(chatId,
    `<b>📅 ${config.label} ändern</b>\n\n` +
    `Neues Datum eingeben:\n\n` +
    `<i>Beispiele:</i>\n` +
    `• "17.03." oder "17.03.2026"\n` +
    `• "in 2 tagen", "in 1 woche"\n` +
    `• "heute", "morgen", "übermorgen"`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: `termin:cancel:${projektId}` }]
    ] } }
  );
}

// Termin-Eingabe verarbeiten
async function handleTerminEingabe(chatId: number, session: any, text: string) {
  const modus = session?.aktueller_modus || '';
  const match = modus.match(/^await_termin_(\w+)_(.+)$/);

  if (!match) {
    await sendMessage(chatId, '⚠️ Ungültiger Modus.');
    return;
  }

  const terminTyp = match[1];
  const projektId = match[2];
  const config = TERMIN_TYPEN[terminTyp];

  if (!config) {
    await sendMessage(chatId, '⚠️ Unbekannter Termin-Typ.');
    return;
  }

  // Datum parsen
  const neuesDatum = parseDatum(text);

  if (!neuesDatum) {
    await sendMessage(chatId,
      '⚠️ <b>Ungültiges Datum</b>\n\n' +
      `"${text}" konnte nicht als Datum erkannt werden.\n\n` +
      `Bitte verwende:\n` +
      `• "17.03." oder "17.03.2026"\n` +
      `• "in 2 tagen", "in 1 woche"\n` +
      `• "heute", "morgen"`,
      { reply_markup: { inline_keyboard: [
        [{ text: "❌ Abbrechen", callback_data: `termin:cancel:${projektId}` }]
      ] } }
    );
    return;
  }

  // Alten Wert laden für Vorschau
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('column_values')
    .eq('id', projektId)
    .single();

  const columnValues = projekt?.column_values || {};
  let alterWert = '-';

  // Passenden alten Wert basierend auf Termin-Typ extrahieren
  if (terminTyp === 'start') {
    alterWert = extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0]) !== '-'
      ? extractDate(columnValues, PROJEKT_SPALTEN.bv_start[0])
      : extractDate(columnValues, PROJEKT_SPALTEN.bv_start[1]);
  } else if (terminTyp === 'plan') {
    alterWert = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_plan);
  } else if (terminTyp === 'maengelfrei') {
    alterWert = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_maengelfrei);
  } else if (terminTyp === 'kunde') {
    alterWert = extractDate(columnValues, PROJEKT_SPALTEN.bv_ende_kunde);
  }

  const neuerWert = neuesDatum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const datumIso = neuesDatum.toISOString().split('T')[0]; // YYYY-MM-DD

  await sendMessage(chatId,
    `<b>📅 Termin ändern</b>\n\n` +
    `${config.label}: ${alterWert} → <b>${neuerWert}</b>\n\n` +
    `Änderung speichern?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "✅ Speichern", callback_data: `termin:confirm:${terminTyp}:${projektId}:${datumIso}` }],
      [{ text: "❌ Abbrechen", callback_data: `termin:cancel:${projektId}` }]
    ] } }
  );
}

// Termin bestätigen und speichern
async function confirmTerminAenderung(chatId: number, terminTyp: string, projektId: string, datumIso: string) {
  const config = TERMIN_TYPEN[terminTyp];
  if (!config) {
    await sendMessage(chatId, '⚠️ Unbekannter Termin-Typ.');
    return;
  }

  // Projekt laden
  const { data: projekt } = await supabase
    .from('monday_bauprozess')
    .select('id, column_values')
    .eq('id', projektId)
    .single();

  if (!projekt) {
    await sendMessage(chatId, '⚠️ Projekt nicht gefunden.');
    return;
  }

  // Monday-Spalten-IDs für Termine
  const MONDAY_TERMIN_SPALTEN: Record<string, string> = {
    start: PROJEKT_SPALTEN.bv_start[1], // f55yA
    plan: PROJEKT_SPALTEN.bv_ende_plan, // 25nEy
    maengelfrei: PROJEKT_SPALTEN.bv_ende_maengelfrei, // 7hwYG
    kunde: PROJEKT_SPALTEN.bv_ende_kunde, // 8pRus
  };

  const mondaySpalteId = MONDAY_TERMIN_SPALTEN[terminTyp];
  if (!mondaySpalteId) {
    await sendMessage(chatId, '⚠️ Spalten-ID nicht gefunden.');
    return;
  }

  // column_values aktualisieren
  const columnValues = projekt.column_values || {};
  columnValues[mondaySpalteId] = { date: datumIso, text: datumIso };

  const { error } = await supabase
    .from('monday_bauprozess')
    .update({
      column_values: columnValues,
      updated_at: new Date().toISOString()
    })
    .eq('id', projektId);

  if (error) {
    console.error('Error updating termin:', error);
    await sendMessage(chatId, `⚠️ Fehler beim Speichern: ${error.message}`);
    return;
  }

  const neuerWert = new Date(datumIso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const atbs = extractATBS(projekt.column_values) || projektId.substring(0, 8);

  // Session zurücksetzen
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {}
  });

  await sendMessage(chatId,
    `✅ <b>Termin gespeichert!</b>\n\n` +
    `${config.label}: <b>${neuerWert}</b>\n\n` +
    `<i>Hinweis: Die Änderung wird beim nächsten Monday-Sync übertragen.</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📅 Weitere Termine ändern", callback_data: `bau:termine:${projektId}` }],
      [{ text: "⬅️ Zurück zum Projekt", callback_data: `bau:open:${projektId}` }]
    ] } }
  );
}

// NEU: Gewerk-Status-Tabelle anzeigen
async function showGewerkStatus(chatId: number, projektId: string) {
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

async function closeProjekt(chatId: number) {
  await updateSession(chatId, {
    aktuelles_bv_id: null,
    aktueller_modus: null,
    modus_daten: {}
  });
  await sendMessage(chatId, '✅ Projekt geschlossen.\n\n/start für Hauptmenü.');
}

// ============================================
// Baustellen-Features: Mangel melden
// ============================================

async function startMangelMeldung(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'mangel_erfassen',
    modus_daten: {
      ...session?.modus_daten,
      mangel_fotos: []
    }
  });

  await sendMessage(chatId,
    `<b>🔧 Mangel melden für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Beschreibe den Mangel per Text oder Sprachnachricht.\n\n` +
    `💡 <i>Tipp: Du kannst mehrere Mängel auf einmal beschreiben - die werden automatisch getrennt.</i>\n` +
    `🌍 <i>Sprachen: Deutsch, Russisch, Ungarisch, Rumänisch, Polnisch</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleMangelText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  await sendMessage(chatId, '⏳ Mängel werden analysiert...');

  const { maengel, detected_language } = await parseAndTranslateMaengel(text);

  if (maengel.length === 0) {
    await sendMessage(chatId, 'Kein Mangel erkannt. Bitte beschreibe den Mangel genauer.');
    return;
  }

  const frist = new Date();
  frist.setDate(frist.getDate() + 7);

  const createdMaengel = [];
  for (const m of maengel) {
    const { data: newMangel, error } = await supabase
      .from('maengel_fertigstellung')
      .insert({
        projekt_nr: projektNr,
        beschreibung_mangel: m.beschreibung_de,
        art_des_mangels: m.gewerk || 'Sonstiges',
        status_mangel: 'Offen',
        datum_meldung: new Date().toISOString(),
        datum_frist: frist.toISOString(),
        erinnerung_status: 'Aktiv'
      })
      .select('id, mangel_id')
      .single();

    if (!error && newMangel) {
      createdMaengel.push({ ...newMangel, beschreibung: m.beschreibung_de, gewerk: m.gewerk });
    }
  }

  if (createdMaengel.length === 0) {
    await sendMessage(chatId, 'Fehler beim Speichern der Mängel. Bitte versuche es erneut.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'mangel_foto',
    modus_daten: {
      ...session?.modus_daten,
      created_maengel: createdMaengel
    }
  });

  let text_response = `<b>✅ ${createdMaengel.length} Mangel/Mängel erfasst:</b>\n\n`;
  if (detected_language !== 'DE') {
    text_response += `<i>(Erkannte Sprache: ${detected_language})</i>\n\n`;
  }
  for (const m of createdMaengel) {
    text_response += `• ${m.beschreibung} (${m.gewerk || 'Sonstiges'})\n`;
  }
  text_response += `\nFrist: ${frist.toLocaleDateString('de-DE')}\n\n`;
  text_response += `Möchtest du ein Foto hinzufügen?`;

  await sendMessage(chatId, text_response, {
    reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "mangel:add_foto" }],
      [{ text: "✅ Fertig (ohne Foto)", callback_data: "bau:menu" }]
    ] }
  });
}

async function handleMangelFoto(chatId: number, session: any, photos: any[]) {
  const createdMaengel = session?.modus_daten?.created_maengel || [];
  const projektNr = session?.modus_daten?.projekt_nr;

  if (createdMaengel.length === 0) {
    await sendMessage(chatId, '⚠️ Kein Mangel zum Verknüpfen. Bitte erst Mangel beschreiben.');
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${projektNr}_mangel_${Date.now()}.jpg`;
  const filePath = `maengel/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  const targetMangel = createdMaengel[0];
  await supabase
    .from('maengel_fertigstellung')
    .update({
      fotos_mangel: [{ url: publicUrl.publicUrl, filename }]
    })
    .eq('id', targetMangel.id);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    kategorie: 'mangel',
    mangel_id: targetMangel.id,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `✅ Foto gespeichert und mit Mangel verknüpft.\n\n` +
    `Weiteres Foto hinzufügen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Noch ein Foto", callback_data: "mangel:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Helper: Ermittle gemeldet_von basierend auf Kontakt
// ============================================

async function getGemeldetVon(chatId: number, session: any): Promise<{gemeldet_von: string, melder_name: string}> {
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

// ============================================
// Baustellen-Features: Nachtrag erfassen
// ============================================

async function startNachtragErfassung(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachtrag_erfassen',
    modus_daten: {
      ...session?.modus_daten,
      nachtrag_fotos: []
    }
  });

  await sendMessage(chatId,
    `<b>📋 Nachtrag erfassen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Beschreibe den Nachtrag (was wurde zusätzlich beauftragt?):`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachtragText(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;

  const { count } = await supabase
    .from('nachtraege')
    .select('id', { count: 'exact', head: true })
    .eq('atbs_nummer', projektNr);

  const nachtragNr = `NT-${projektNr}-${(count || 0) + 1}`;

  // Dynamische Ermittlung von gemeldet_von basierend auf Kontakt
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);
  console.log(`[v50] Nachtrag von chat_id=${chatId}: gemeldet_von=${gemeldet_von}, melder_name=${melder_name}`);

  const { data: newNachtrag, error } = await supabase
    .from('nachtraege')
    .insert({
      atbs_nummer: projektNr,
      nachtrag_nr: nachtragNr,
      beschreibung: text,
      status: 'Gemeldet',
      gemeldet_von: gemeldet_von,
      melder_name: melder_name
    })
    .select('id, nachtrag_nr')
    .single();

  if (error || !newNachtrag) {
    console.error('Nachtrag error:', error);
    await sendMessage(chatId, 'Fehler beim Speichern des Nachtrags.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachtrag_foto',
    modus_daten: {
      ...session?.modus_daten,
      nachtrag_id: newNachtrag.id,
      nachtrag_nr: newNachtrag.nachtrag_nr
    }
  });

  await sendMessage(chatId,
    `<b>✅ Nachtrag erfasst:</b>\n\n` +
    `Nr: <b>${nachtragNr}</b>\n` +
    `Beschreibung: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n\n` +
    `Möchtest du ein Foto hinzufügen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Foto hinzufügen", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig (ohne Foto)", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachtragFoto(chatId: number, session: any, photos: any[]) {
  const nachtragId = session?.modus_daten?.nachtrag_id;
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachtragNr = session?.modus_daten?.nachtrag_nr;

  if (!nachtragId) {
    await sendMessage(chatId, '⚠️ Kein Nachtrag zum Verknüpfen. Bitte erst Nachtrag beschreiben.');
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${nachtragNr}_${Date.now()}.jpg`;
  const filePath = `nachtraege/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  const { data: nachtrag } = await supabase
    .from('nachtraege')
    .select('foto_urls')
    .eq('id', nachtragId)
    .single();

  const existingUrls = nachtrag?.foto_urls || [];
  await supabase
    .from('nachtraege')
    .update({ foto_urls: [...existingUrls, publicUrl.publicUrl] })
    .eq('id', nachtragId);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    kategorie: 'nachtrag',
    nachtrag_id: nachtragId,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `✅ Foto zum Nachtrag hinzugefügt.\n\n` +
    `Weiteres Foto?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📷 Noch ein Foto", callback_data: "nachtrag:add_foto" }],
      [{ text: "✅ Fertig", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Baustellen-Features: Nachweis hochladen
// ============================================

async function showNachweisTypen(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'nachweis_typ_wahl',
    modus_daten: session?.modus_daten
  });

  await sendMessage(chatId,
    `<b>📸 Nachweis hochladen für ${session?.modus_daten?.projekt_nr}</b>\n\n` +
    `Welchen Nachweis möchtest du hochladen?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⚡ Rohinstallation Elektrik", callback_data: "nachweis:rohinstall_elektrik" }],
      [{ text: "🚿 Rohinstallation Sanitär", callback_data: "nachweis:rohinstall_sanitaer" }],
      [{ text: "🛁 Abdichtung Bad", callback_data: "nachweis:abdichtung_bad" }],
      [{ text: "✅ E-Check Protokoll", callback_data: "nachweis:e_check" }],
      [{ text: "🔥 Brandschutz", callback_data: "nachweis:brandschutz" }],
      [{ text: "❌ Abbrechen", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleNachweisTyp(chatId: number, session: any, typ: string) {
  const typLabels: Record<string, string> = {
    'rohinstall_elektrik': 'Rohinstallation Elektrik',
    'rohinstall_sanitaer': 'Rohinstallation Sanitär',
    'abdichtung_bad': 'Abdichtung Bad',
    'e_check': 'E-Check Protokoll',
    'brandschutz': 'Brandschutz'
  };

  await updateSession(chatId, {
    aktueller_modus: 'nachweis_foto',
    modus_daten: {
      ...session?.modus_daten,
      nachweis_typ: typ
    }
  });

  await sendMessage(chatId,
    `<b>📸 ${typLabels[typ] || typ}</b>\n\n` +
    `Sende jetzt das Foto des Nachweises:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:nachweis" }]
    ] } }
  );
}

async function handleNachweisFoto(chatId: number, session: any, photos: any[]) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachweisTyp = session?.modus_daten?.nachweis_typ;

  if (!nachweisTyp) {
    await sendMessage(chatId, '⚠️ Kein Nachweis-Typ gewählt. Bitte erst Typ auswählen.');
    await showNachweisTypen(chatId, session);
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const filename = `${projektNr}_${nachweisTyp}_${Date.now()}.jpg`;
  const filePath = `nachweise/${projektNr}/${filename}`;

  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'nachweis',
    nachweis_typ: nachweisTyp,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  const typLabels: Record<string, string> = {
    'rohinstall_elektrik': 'Rohinstallation Elektrik',
    'rohinstall_sanitaer': 'Rohinstallation Sanitär',
    'abdichtung_bad': 'Abdichtung Bad',
    'e_check': 'E-Check Protokoll',
    'brandschutz': 'Brandschutz'
  };

  await sendMessage(chatId,
    `<b>✅ Nachweis gespeichert!</b>\n\n` +
    `Typ: ${typLabels[nachweisTyp] || nachweisTyp}\n` +
    `Projekt: ${projektNr}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📸 Weiteren Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );

  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      nachweis_typ: null
    }
  });
}

// ============================================
// Baustellen-Features: Status anzeigen
// ============================================

async function showProjektStatus(chatId: number, session: any) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const bvId = session?.aktuelles_bv_id;

  if (!bvId || !projektNr) {
    await sendMessage(chatId, '⚠️ Kein Projekt geöffnet.');
    return;
  }

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

  const projektName = session?.modus_daten?.projekt_name || '';
  const phase = session?.modus_daten?.projekt_phase || '?';

  await sendMessage(chatId,
    `<b>📊 Status: ${projektNr}</b>\n` +
    `${projektName}\n\n` +
    `<b>Phase:</b> ${phase}\n\n` +
    `<b>🔧 Mängel:</b>\n` +
    `• Offen: ${maengelOffen || 0}\n` +
    `• Gesamt: ${maengelGesamt || 0}\n\n` +
    `<b>📋 Nachträge:</b>\n` +
    `• Offen: ${nachtraegeOffen || 0}\n` +
    `• Gesamt: ${nachtraegeGesamt || 0}\n\n` +
    `<b>📸 Nachweise:</b> ${nachweiseCount || 0}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📐 Ausführungsarten", callback_data: `bau:ausfuehrung:${bvId}` }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );
}

// ============================================
// Baustellen-Features: Ausführungsarten anzeigen (NEU v52)
// ============================================

// Monday.com Spalten-IDs für Ausführungsarten
const AUSFUEHRUNGSART_SPALTEN: Record<string, { id: string; label: string; icon: string }> = {
  bad: { id: 'status23__1', label: 'Bad', icon: '🛁' },
  elektrik: { id: 'color590__1', label: 'Elektrik', icon: '⚡' },
  // Weitere Spalten können ergänzt werden wenn die IDs in Monday bekannt sind:
  // waende: { id: 'XXX', label: 'Wände', icon: '🧱' },
  // decken: { id: 'XXX', label: 'Decken', icon: '📐' },
  // boden: { id: 'XXX', label: 'Boden', icon: '🪵' },
  // tueren: { id: 'XXX', label: 'Türen', icon: '🚪' },
  // gastherme: { id: 'XXX', label: 'Gastherme', icon: '🔥' },
};

function extractMondayText(jsonValue: unknown): string {
  if (!jsonValue) return '-';
  if (typeof jsonValue === 'string') {
    try {
      const parsed = JSON.parse(jsonValue);
      return parsed?.text || '-';
    } catch {
      return jsonValue;
    }
  }
  if (typeof jsonValue === 'object' && jsonValue !== null) {
    return (jsonValue as { text?: string }).text || '-';
  }
  return '-';
}

function getAusfuehrungStatus(value: string): { emoji: string; text: string } {
  const lower = value.toLowerCase();
  if (lower === 'komplett' || lower === 'fertig' || lower === 'erledigt') {
    return { emoji: '✅', text: 'Fertig' };
  }
  if (lower.includes('läuft') || lower.includes('in arbeit') || lower.includes('teil')) {
    return { emoji: '🔨', text: 'Läuft' };
  }
  if (lower === 'ohne' || lower === 'nicht geplant' || lower === '-') {
    return { emoji: '➖', text: '-' };
  }
  if (lower === 'offen' || lower === 'geplant') {
    return { emoji: '⏳', text: 'Geplant' };
  }
  return { emoji: '📋', text: value.substring(0, 15) };
}

async function showAusfuehrungsarten(chatId: number, session: any, projektId: string) {
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

  for (const [key, config] of Object.entries(AUSFUEHRUNGSART_SPALTEN)) {
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

// ============================================
// Baustellen-Features: Abnahmeprotokolle (NEU v53)
// ============================================

async function showAbnahmeTypen(chatId: number, session: any) {
  if (!session?.aktuelles_bv_id) {
    await sendMessage(chatId, '⚠️ Bitte zuerst ein Projekt öffnen.');
    await showBaustellenMenu(chatId, session);
    return;
  }

  const projektNr = session?.modus_daten?.projekt_nr || '?';

  await sendMessage(chatId,
    `<b>📄 Abnahmeprotokoll hochladen für ${projektNr}</b>\n\n` +
    `Welche Art von Abnahme möchtest du dokumentieren?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "👷 NU-Abnahme (intern)", callback_data: "abnahme:nu" }],
      [{ text: "🏠 Kunden-Abnahme", callback_data: "abnahme:kunde" }],
      [{ text: "⬅️ Zurück", callback_data: "bau:menu" }]
    ] } }
  );
}

async function handleAbnahmeTyp(chatId: number, session: any, typ: string) {
  const typLabels: Record<string, { label: string; dokumenttyp: string }> = {
    'nu': { label: 'NU-Abnahme (intern)', dokumenttyp: 'QM-ABN-NU' },
    'kunde': { label: 'Kunden-Abnahme', dokumenttyp: 'QM-ABN-KU' }
  };

  const config = typLabels[typ];
  if (!config) {
    await sendMessage(chatId, 'Unbekannter Abnahme-Typ.');
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'abnahme_foto',
    modus_daten: {
      ...session?.modus_daten,
      abnahme_typ: typ,
      abnahme_dokumenttyp: config.dokumenttyp,
      abnahme_label: config.label
    }
  });

  await sendMessage(chatId,
    `<b>📄 ${config.label}</b>\n\n` +
    `Sende jetzt ein oder mehrere Fotos des Abnahmeprotokolls.\n\n` +
    `<i>Tipp: Du kannst mehrere Fotos auf einmal senden - sie werden alle dem gleichen Protokoll zugeordnet.</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: "❌ Abbrechen", callback_data: "bau:abnahme" }]
    ] } }
  );
}

async function handleAbnahmeFoto(chatId: number, session: any, photos: any[]) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const abnahmeTyp = session?.modus_daten?.abnahme_typ;
  const dokumentTyp = session?.modus_daten?.abnahme_dokumenttyp;
  const label = session?.modus_daten?.abnahme_label;

  if (!abnahmeTyp || !dokumentTyp) {
    await sendMessage(chatId, '⚠️ Kein Abnahme-Typ gewählt. Bitte erst Typ auswählen.');
    await showAbnahmeTypen(chatId, session);
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  const fileData = await downloadTelegramFile(largestPhoto.file_id);

  if (!fileData) {
    await sendMessage(chatId, 'Fehler beim Herunterladen des Fotos.');
    return;
  }

  const timestamp = Date.now();
  const filename = `${projektNr}_${dokumentTyp}_${timestamp}.jpg`;
  const filePath = `abnahmeprotokolle/${projektNr}/${filename}`;

  // Base64 zu Uint8Array konvertieren
  const binaryString = atob(fileData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // In Storage hochladen
  const { error: uploadError } = await supabase.storage
    .from('fotos')
    .upload(filePath, bytes, { contentType: fileData.mimeType });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(chatId, 'Fehler beim Speichern des Fotos.');
    return;
  }

  const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

  // In dokumente-Tabelle speichern
  const { error: insertError } = await supabase.from('dokumente').insert({
    id: crypto.randomUUID(),
    atbs_nummer: projektNr,
    art_des_dokuments: dokumentTyp,
    dokument_nr: `${dokumentTyp}-${projektNr}-${new Date().toISOString().split('T')[0]}`,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    quelle: 'telegram',
    datum_erstellt: new Date().toISOString().split('T')[0],
    notizen: `Hochgeladen via Telegram Bot (${label})`
  });

  if (insertError) {
    console.error('Dokument insert error:', insertError);
  }

  // Auch in fotos-Tabelle speichern für Referenz
  await supabase.from('fotos').insert({
    atbs_nummer: projektNr,
    bauvorhaben_id: session?.aktuelles_bv_id,
    kategorie: 'abnahmeprotokoll',
    nachweis_typ: dokumentTyp,
    datei_url: publicUrl.publicUrl,
    datei_name: filename,
    mime_type: fileData.mimeType,
    quelle: 'telegram'
  });

  await sendMessage(chatId,
    `<b>✅ Abnahmeprotokoll gespeichert!</b>\n\n` +
    `Typ: ${label}\n` +
    `Projekt: ${projektNr}\n` +
    `Dokumenttyp: ${dokumentTyp}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📄 Weiteres Protokoll hochladen", callback_data: "bau:abnahme" }],
      [{ text: "⬅️ Zurück zum Menü", callback_data: "bau:menu" }]
    ] } }
  );

  // Modus zurücksetzen
  await updateSession(chatId, {
    aktueller_modus: 'baustelle',
    modus_daten: {
      ...session?.modus_daten,
      abnahme_typ: null,
      abnahme_dokumenttyp: null,
      abnahme_label: null
    }
  });
}

// ============================================
// Multi-Foto-Upload Handler (NEU v53)
// ============================================

interface PendingFoto {
  file_id: string;
  media_group_id: string;
  received_at: number;
}

async function handleMultiFotoUpload(chatId: number, session: any, update: any): Promise<PendingFoto[] | 'pending' | null> {
  const mediaGroupId = update.message?.media_group_id;
  const photos = update.message?.photo || [];
  const largestPhoto = photos[photos.length - 1];
  const modus = session?.aktueller_modus;

  // Falls kein media_group_id, ist es ein einzelnes Foto
  if (!mediaGroupId) {
    return null; // null = Einzelfoto, soll normal verarbeitet werden
  }

  // Foto zur pending-Liste hinzufügen
  const pendingFotos: PendingFoto[] = session?.pending_fotos || [];
  pendingFotos.push({
    file_id: largestPhoto.file_id,
    media_group_id: mediaGroupId,
    received_at: Date.now()
  });

  await updateSession(chatId, { pending_fotos: pendingFotos });

  // Zählen wie viele Fotos dieser Gruppe schon da sind
  const groupFotos = pendingFotos.filter(f => f.media_group_id === mediaGroupId);

  // Beim ersten Foto der Gruppe: Hinweis senden und Timer starten
  if (groupFotos.length === 1) {
    console.log(`[v53] Multi-Foto-Gruppe ${mediaGroupId} gestartet für Modus ${modus}`);

    await updateSession(chatId, {
      pending_fotos: pendingFotos,
      modus_daten: {
        ...session?.modus_daten,
        pending_media_group_id: mediaGroupId,
        pending_media_group_start: Date.now()
      }
    });

    return 'pending';
  }

  // Bei weiteren Fotos: Prüfen ob Timeout (1.5s nach erstem Foto)
  const groupStart = session?.modus_daten?.pending_media_group_start;
  const elapsed = Date.now() - (groupStart || Date.now());

  if (elapsed < 1500) {
    return 'pending';
  }

  // Timeout erreicht - alle Fotos der Gruppe verarbeiten
  console.log(`[v53] Multi-Foto-Gruppe ${mediaGroupId} verarbeiten: ${groupFotos.length} Fotos`);

  const remainingFotos = pendingFotos.filter(f => f.media_group_id !== mediaGroupId);
  await updateSession(chatId, {
    pending_fotos: remainingFotos,
    modus_daten: {
      ...session?.modus_daten,
      pending_media_group_id: null,
      pending_media_group_start: null
    }
  });

  return groupFotos;
}

async function processPendingFotos(chatId: number, session: any, fotos: PendingFoto[]): Promise<number> {
  const modus = session?.aktueller_modus;
  const projektNr = session?.modus_daten?.projekt_nr;

  let successCount = 0;

  for (const foto of fotos) {
    const fileData = await downloadTelegramFile(foto.file_id);
    if (!fileData) continue;

    const timestamp = Date.now();
    let filePath: string;
    let kategorie: string;

    if (modus === 'mangel_foto') {
      filePath = `maengel/${projektNr}/${projektNr}_mangel_${timestamp}_${successCount}.jpg`;
      kategorie = 'mangel';
    } else if (modus === 'nachtrag_foto') {
      filePath = `nachtraege/${projektNr}/${projektNr}_nachtrag_${timestamp}_${successCount}.jpg`;
      kategorie = 'nachtrag';
    } else if (modus === 'nachweis_foto') {
      const nachweisTyp = session?.modus_daten?.nachweis_typ || 'allgemein';
      filePath = `nachweise/${projektNr}/${projektNr}_${nachweisTyp}_${timestamp}_${successCount}.jpg`;
      kategorie = 'nachweis';
    } else if (modus === 'abnahme_foto') {
      const dokumentTyp = session?.modus_daten?.abnahme_dokumenttyp || 'QM-ABN';
      filePath = `abnahmeprotokolle/${projektNr}/${projektNr}_${dokumentTyp}_${timestamp}_${successCount}.jpg`;
      kategorie = 'abnahmeprotokoll';
    } else {
      filePath = `allgemein/${projektNr}/${projektNr}_foto_${timestamp}_${successCount}.jpg`;
      kategorie = 'allgemein';
    }

    const binaryString = atob(fileData.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(filePath, bytes, { contentType: fileData.mimeType });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from('fotos').getPublicUrl(filePath);

      await supabase.from('fotos').insert({
        atbs_nummer: projektNr,
        bauvorhaben_id: session?.aktuelles_bv_id,
        kategorie,
        datei_url: publicUrl.publicUrl,
        datei_name: filePath.split('/').pop(),
        mime_type: fileData.mimeType,
        quelle: 'telegram'
      });

      successCount++;
    }
  }

  if (successCount > 0) {
    await sendMessage(chatId, `✅ ${successCount} Fotos gespeichert!`);
  }

  return successCount;
}
// ============================================
// Phase 2: Bedarfsanalyse Helpers (BESTEHEND)
// ============================================

function countCheckboxes(obj: Record<string, unknown>): number {
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

async function handleOcrResult(chatId: number, bedarfsanalyseId: string) {
  const { data: ba, error } = await supabase
    .from('bedarfsanalysen')
    .select('id, auftraggeber, pauschal_groesse, status, ocr_structured')
    .eq('id', bedarfsanalyseId).single();
  if (error || !ba) { await sendMessage(chatId, `Fehler beim Laden der Bedarfsanalyse.`); return; }

  if (ba.status === 'needs_auftraggeber' || !ba.auftraggeber) {
    await sendMessage(chatId,
      `<b>OCR abgeschlossen</b>\n\nDer Auftraggeber konnte nicht erkannt werden.\nBitte wähle den Auftraggeber:`,
      { reply_markup: { inline_keyboard: [
        [{ text: "VBW", callback_data: `set_auftraggeber:${bedarfsanalyseId}:VBW` },
         { text: "GWS", callback_data: `set_auftraggeber:${bedarfsanalyseId}:GWS` },
         { text: "Privat", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Privat` }],
        [{ text: "Covivio", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Covivio` },
         { text: "Zander", callback_data: `set_auftraggeber:${bedarfsanalyseId}:Zander` },
         { text: "WBG Lünen", callback_data: `set_auftraggeber:${bedarfsanalyseId}:WBG Lünen` }]
      ] } }
    );
    return;
  }

  const props = ba.ocr_structured?.properties || ba.ocr_structured || {};
  const atbs = props.header?.atbs_nr || '?';
  const checkboxCount = countCheckboxes(props);
  const ag = (ba.auftraggeber || '').toUpperCase();
  let abrechnungsart = 'Aufmaß';
  if (ag === 'VBW') abrechnungsart = 'Pauschal';
  else if ((ag === 'GWS' || ag === 'COVIVIO') && ba.pauschal_groesse) abrechnungsart = `Pauschal (${ba.pauschal_groesse})`;
  else if (ag === 'PRIVAT') abrechnungsart = 'Nach Aufmaß';
  else if (!ba.pauschal_groesse) abrechnungsart = 'Nach Aufmaß';
  else abrechnungsart = `Pauschal (${ba.pauschal_groesse})`;

  let aufmassWarnung = '';
  if (abrechnungsart.includes('Aufmaß') && atbs !== '?') {
    const { data: aufmass } = await supabase.from('aufmass_data').select('id').eq('atbs_nummer', atbs).limit(1).single();
    if (!aufmass) aufmassWarnung = `\n\n⚠️ <b>WARNUNG:</b> Keine Aufmaßdaten für ${atbs} vorhanden! Mengen werden geschätzt.`;
  }

  await sendMessage(chatId,
    `<b>OCR abgeschlossen</b>\n\n` +
    `Auftraggeber: <b>${ba.auftraggeber}</b>\n` +
    `ATBS: ${atbs}\nPauschal-Größe: ${ba.pauschal_groesse || 'nicht angekreuzt'}\n` +
    `Abrechnungsart: <b>${abrechnungsart}</b>\n` +
    `Erkannte Checkboxen: ${checkboxCount}` + aufmassWarnung +
    `\n\nAngebot wird erstellt...`
  );

  await callFinalizeAngebot(chatId, bedarfsanalyseId);
}

async function callFinalizeAngebot(chatId: number, bedarfsanalyseId: string) {
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/finalize-angebot`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ bedarfsanalyse_id: bedarfsanalyseId }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.draft_id) {
        if (result.aufmass_missing) {
          await sendMessage(chatId,
            `⚠️ <b>Achtung:</b> Aufmaß-Abrechnung gewählt, aber keine Aufmaßdaten vorhanden!\nMengen werden auf 1 geschätzt.`);
        }
        await updateSession(chatId, {
          aktueller_modus: 'bedarfsanalyse_review',
          modus_daten: { draft_id: result.draft_id, bedarfsanalyse_id: bedarfsanalyseId }
        });
        await showAngebotSummary(chatId, result.draft_id);
      } else {
        await sendMessage(chatId, `Fehler bei Angebotserstellung: ${result.error || 'Unbekannt'}`);
      }
    } else {
      await sendMessage(chatId, `Fehler bei Angebotserstellung (HTTP ${response.status})`);
    }
  } catch (e) {
    console.error('Error calling finalize-angebot:', e);
    await sendMessage(chatId, `Fehler beim Aufruf von finalize-angebot`);
  }
}

async function showAngebotSummary(chatId: number, draftId: string) {
  const { data: draft } = await supabase
    .from('angebots_drafts')
    .select('*, bedarfsanalysen!inner(auftraggeber, pauschal_groesse, ocr_structured)')
    .eq('id', draftId).single();
  if (!draft) { await sendMessage(chatId, `Angebot nicht gefunden.`); return; }

  const ba = (draft as any).bedarfsanalysen;
  const ag = (ba?.auftraggeber || '').toUpperCase();
  let abrechnungsInfo = '';
  if (ag === 'VBW') abrechnungsInfo = 'Pauschal (VBW)';
  else if ((ag === 'GWS' || ag === 'COVIVIO') && ba?.pauschal_groesse) abrechnungsInfo = `Pauschal ${ba.pauschal_groesse}`;
  else if (ag === 'PRIVAT') abrechnungsInfo = 'Nach Aufmaß';
  else abrechnungsInfo = ba?.pauschal_groesse ? `Pauschal ${ba.pauschal_groesse}` : 'Nach Aufmaß';

  const { count: posCount } = await supabase
    .from('angebots_positionen').select('id', { count: 'exact', head: true }).eq('draft_id', draftId);

  await sendMessage(chatId,
    `<b>Angebots-Zusammenfassung</b>\n\n` +
    `Auftraggeber: <b>${ba?.auftraggeber || draft.lv_typ}</b>\n` +
    `Abrechnungsart: <b>${abrechnungsInfo}</b>\n` +
    `Positionen: ${posCount || 0}\n` +
    `Netto: ${Number(draft.summe_netto).toFixed(2)} €\n` +
    `Brutto: ${Number(draft.summe_brutto).toFixed(2)} € (19% MwSt)\n` +
    `Status: ${draft.status}`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📝 Alle Positionen anzeigen", callback_data: `angebot:list:${draftId}` }],
      [{ text: "✅ Angebot bestätigen", callback_data: `angebot:confirm:${draftId}` }],
      [{ text: "❌ Angebot verwerfen", callback_data: `angebot:discard:${draftId}` }],
    ] } }
  );
}

// ============================================
// Phase 1: Aufmaß Helpers (BESTEHEND)
// ============================================

async function searchMatterportProject(chatId: number, searchTerm: string) {
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
// Photo Handler (Bedarfsanalyse) - BESTEHEND
// ============================================

async function handleBedarfsanalysePhoto(chatId: number, session: any, photos: any[]) {
  const modus_daten = session?.modus_daten || {};
  const existingPhotos = modus_daten.photo_file_ids || [];
  const largestPhoto = photos[photos.length - 1];
  existingPhotos.push(largestPhoto.file_id);

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_fotos',
    modus_daten: { ...modus_daten, photo_file_ids: existingPhotos }
  });

  await sendMessage(chatId,
    `📷 Foto ${existingPhotos.length} empfangen.\n\n` +
    `Sende weitere Fotos oder tippe auf "Analyse starten":`,
    { reply_markup: { inline_keyboard: [
      [{ text: `🔍 Analyse starten (${existingPhotos.length} Foto${existingPhotos.length > 1 ? 's' : ''})`, callback_data: "ba:start_ocr" }],
      [{ text: "❌ Abbrechen", callback_data: "main_menu" }]
    ] } }
  );
}

async function startOcrProcessing(chatId: number, session: any) {
  const modus_daten = session?.modus_daten || {};
  const photoFileIds = modus_daten.photo_file_ids || [];
  if (photoFileIds.length === 0) {
    await sendMessage(chatId, `Keine Fotos vorhanden. Bitte sende zuerst ein Foto.`);
    return;
  }

  await sendMessage(chatId, `⏳ OCR-Verarbeitung gestartet für ${photoFileIds.length} Foto(s)...\nDies kann 15-30 Sekunden dauern.`);

  const images: { base64: string }[] = [];
  for (const fileId of photoFileIds) {
    const fileData = await downloadTelegramFile(fileId);
    if (fileData) {
      images.push({ base64: `data:${fileData.mimeType};base64,${fileData.base64}` });
    }
  }

  if (images.length === 0) {
    await sendMessage(chatId, `Fehler: Konnte keine Fotos herunterladen.`);
    return;
  }

  const { data: ba, error: baError } = await supabase
    .from('bedarfsanalysen')
    .insert({ status: 'processing', telegram_message_id: chatId.toString() })
    .select('id').single();

  if (baError || !ba) {
    await sendMessage(chatId, `Fehler beim Erstellen der Bedarfsanalyse: ${baError?.message}`);
    return;
  }

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_processing',
    modus_daten: { bedarfsanalyse_id: ba.id, photo_file_ids: photoFileIds }
  });

  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/process-bedarfsanalyse`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ images, bedarfsanalyse_id: ba.id }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('process-bedarfsanalyse error:', errText);
      await sendMessage(chatId, `Fehler bei OCR-Verarbeitung (HTTP ${response.status}).`);
      return;
    }

    const result = await response.json();
    if (!result.success) {
      await sendMessage(chatId, `OCR-Fehler: ${result.error || 'Unbekannt'}`);
      return;
    }

    console.log(`[v49] OCR done for ${ba.id}, auftraggeber_missing=${result.auftraggeber_missing}`);
    await handleOcrResult(chatId, ba.id);

  } catch (e) {
    console.error('Error calling process-bedarfsanalyse:', e);
    await sendMessage(chatId, `Fehler beim OCR-Aufruf: ${(e as Error).message}`);
  }
}

// ============================================
// Review Flow (Phase 1) - BESTEHEND (verkürzt)
// ============================================

async function listPositionen(chatId: number, draftId: string) {
  const { data: positionen } = await supabase
    .from('angebots_positionen')
    .select('*, lv_positionen:lv_position_id (bezeichnung, artikelnummer, lv_typ, einheit, preis)')
    .eq('draft_id', draftId)
    .order('position_nr');

  if (!positionen || positionen.length === 0) {
    await sendMessage(chatId, `Keine Positionen gefunden.`);
    return;
  }

  let text = `<b>Angebots-Positionen (${positionen.length}):</b>\n\n`;
  for (const pos of positionen) {
    const lv = pos.lv_positionen as any;
    const bez = lv?.bezeichnung || pos.checkbox_key || '?';
    const confIcon = pos.confidence >= 0.8 ? '✅' : pos.confidence >= 0.6 ? '⚠️' : '❌';
    const preis = Number(pos.gesamtpreis).toFixed(2);
    text += `<b>${pos.position_nr}.</b> ${bez}\n`;
    text += `   ${pos.menge} ${pos.einheit || 'Stk'} × ${Number(pos.einzelpreis).toFixed(2)}€ = <b>${preis}€</b> ${confIcon}\n\n`;
  }
  text += `Gib eine Positionsnummer ein um Details zu sehen.`;

  await updateSession(chatId, {
    aktueller_modus: 'bedarfsanalyse_positionen',
    modus_daten: { draft_id: draftId }
  });

  if (text.length > 4000) {
    const mid = text.lastIndexOf('\n\n', 2000);
    await sendMessage(chatId, text.substring(0, mid));
    await sendMessage(chatId, text.substring(mid));
  } else {
    await sendMessage(chatId, text);
  }
}

async function showPositionDetail(chatId: number, draftId: string, positionNr: number) {
  const { data: pos } = await supabase
    .from('angebots_positionen')
    .select('*, lv_positionen:lv_position_id (bezeichnung, artikelnummer, lv_typ, einheit, preis)')
    .eq('draft_id', draftId)
    .eq('position_nr', positionNr)
    .single();

  if (!pos) { await sendMessage(chatId, `Position ${positionNr} nicht gefunden.`); return; }

  const lv = pos.lv_positionen as any;
  const confPercent = Math.round((pos.confidence || 0) * 100);
  const confIcon = confPercent >= 80 ? '✅' : confPercent >= 60 ? '⚠️' : '❌';

  await sendMessage(chatId,
    `<b>Position ${positionNr}:</b>\n\n` +
    `<b>${lv?.bezeichnung || pos.checkbox_key}</b>\n` +
    `LV-Typ: ${lv?.lv_typ || '-'} | Art.Nr: ${lv?.artikelnummer || '-'}\n` +
    `Checkbox: ${pos.checkbox_key}\n\n` +
    `Menge: ${pos.menge} ${pos.einheit || 'Stk'}\n` +
    `Einzelpreis: ${Number(pos.einzelpreis).toFixed(2)} €\n` +
    `Gesamtpreis: <b>${Number(pos.gesamtpreis).toFixed(2)} €</b>\n` +
    `Konfidenz: ${confPercent}% ${confIcon}\n` +
    (pos.notiz ? `Notiz: ${pos.notiz}\n` : ''),
    { reply_markup: { inline_keyboard: [
      [{ text: "✅ OK", callback_data: `pos:ok:${pos.id}` },
       { text: "❌ Entfernen", callback_data: `pos:remove:${pos.id}` }],
      [{ text: "⬅️ Zurück zur Liste", callback_data: `angebot:list:${draftId}` }]
    ] } }
  );
}

// ============================================
// CSV Upload Handler (Aufmaß) - BESTEHEND
// ============================================

async function handleCsvUpload(chatId: number, session: any, document: any) {
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
// Command Handlers
// ============================================

async function handleStart(chatId: number, session: any) {
  const name = session?.first_name || "Benutzer";
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });
  await sendMessage(chatId,
    `<b>Willkommen beim neurealis Bot!</b>\n\n` +
    `Hallo ${name}! Was möchtest du tun?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📊 Aufmaß erstellen/ansehen", callback_data: "mode_aufmass" }],
      [{ text: "📝 Bedarfsanalyse → Angebot", callback_data: "mode_bedarfsanalyse" }],
      [{ text: "🏗️ Baustelle öffnen", callback_data: "mode_baustelle" }],
      [{ text: "🔍 ATBS direkt eingeben", callback_data: "mode_atbs_direkt" }],
      [{ text: "❓ Hilfe Sprach-Befehle", callback_data: "hilfe:sprachbefehle" }],
    ] } }
  );
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId,
    `<b>Befehle:</b>\n\n` +
    `/start - Hauptmenü\n` +
    `/hilfe - Diese Hilfe\n` +
    `/status - Aktueller Status\n` +
    `/abbrechen - Aktuellen Vorgang abbrechen\n` +
    `/sync - Matterport-Projekte synchronisieren\n\n` +
    `<b>Aufmaß-Modus:</b>\n` +
    `ATBS-Nummer oder Adresse eingeben → Projekt suchen\n` +
    `CSV hochladen → Excel-Aufmaß\n\n` +
    `<b>Bedarfsanalyse-Modus:</b>\n` +
    `Foto(s) senden → OCR → Angebot → Review → Odoo-Export\n\n` +
    `<b>Baustellen-Modus:</b>\n` +
    `Projekt öffnen → Mängel, Nachträge, Nachweise erfassen`
  );
}

async function handleSync(chatId: number) {
  await sendMessage(chatId, `⏳ Synchronisiere Matterport-Projekte...`);
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/sync-matterport-projects`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: '{}',
    });
    const result = await response.json();
    if (result.success) {
      await sendMessage(chatId,
        `<b>Sync abgeschlossen</b>\n\n` +
        `Gesamt in Matterport: ${result.total_in_matterport}\n` +
        `Neu: ${result.created}\n` +
        `Aktualisiert: ${result.updated}\n` +
        `Unverändert: ${result.synced}`);
    } else {
      await sendMessage(chatId, `Sync-Fehler: ${result.error}`);
    }
  } catch (e) {
    await sendMessage(chatId, `Sync-Fehler: ${(e as Error).message}`);
  }
}

async function handleStatus(chatId: number, session: any) {
  const modus = session?.aktueller_modus || 'keiner';
  const daten = session?.modus_daten || {};
  const bvId = session?.aktuelles_bv_id;
  let text = `<b>Status:</b>\n\nModus: ${modus}\n`;
  if (bvId) text += `Geöffnetes Projekt: ${daten.projekt_nr || bvId}\n`;
  if (daten.atbs_nummer) text += `ATBS: ${daten.atbs_nummer}\n`;
  if (daten.draft_id) text += `Angebot-Draft: ${daten.draft_id}\n`;
  if (daten.bedarfsanalyse_id) text += `Bedarfsanalyse: ${daten.bedarfsanalyse_id}\n`;
  if (daten.photo_file_ids) text += `Fotos: ${daten.photo_file_ids.length}\n`;
  await sendMessage(chatId, text);
}

async function handleAbbrechen(chatId: number) {
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });
  await sendMessage(chatId, `Vorgang abgebrochen.\n\n/start für Hauptmenü.`);
}

// ============================================
// Callback Query Handler
// ============================================

async function handleCallbackQuery(update: any) {
  const chatId = update.callback_query.message.chat.id;
  const data = update.callback_query.data;
  const callbackId = update.callback_query.id;
  const session = await getOrCreateSession(chatId);

  if (data === 'main_menu') {
    await answerCallbackQuery(callbackId);
    await handleStart(chatId, session);
    return;
  }

  // NEU v55: Hilfe Sprach-Befehle
  if (data === 'hilfe:sprachbefehle') {
    await answerCallbackQuery(callbackId);
    await showSprachBefehlHilfe(chatId);
    return;
  }

  if (data === 'mode_aufmass') {
    await answerCallbackQuery(callbackId, 'Aufmaß-Modus');
    await updateSession(chatId, { aktueller_modus: 'aufmass', modus_daten: {} });
    await sendMessage(chatId,
      `<b>Aufmaß-Modus</b>\n\nGib eine ATBS-Nummer oder Adresse ein:`);
    return;
  }

  if (data === 'mode_bedarfsanalyse') {
    await answerCallbackQuery(callbackId, 'Bedarfsanalyse-Modus');
    await updateSession(chatId, { aktueller_modus: 'bedarfsanalyse', modus_daten: {} });
    await sendMessage(chatId,
      `<b>Bedarfsanalyse-Modus</b>\n\nSende ein oder mehrere Fotos des ausgefüllten Bedarfsanalysebogens.`);
    return;
  }

  if (data === 'mode_baustelle') {
    await answerCallbackQuery(callbackId, 'Baustellen-Modus');
    await showBaustellenMenu(chatId, session);
    return;
  }

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

  // NEU v51: Pagination für Projekt-Liste
  if (data.startsWith('bau:list:')) {
    const page = parseInt(data.replace('bau:list:', ''), 10);
    await answerCallbackQuery(callbackId);
    await listActiveProjekte(chatId, page);
    return;
  }

  // NEU v51: Auswahl-Methode Handler
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

  // NEU v51: Phasen-Filter Handler
  if (data.match(/^phase:\d+$/)) {
    const phaseNum = parseInt(data.replace('phase:', ''), 10);
    await answerCallbackQuery(callbackId, `Phase ${phaseNum}...`);
    await listProjekteByPhase(chatId, phaseNum, 0);
    return;
  }

  // NEU v51: Phasen-Filter mit Pagination
  if (data.match(/^phase:\d+:\d+$/)) {
    const parts = data.split(':');
    const phaseNum = parseInt(parts[1], 10);
    const page = parseInt(parts[2], 10);
    await answerCallbackQuery(callbackId);
    await listProjekteByPhase(chatId, phaseNum, page);
    return;
  }

  // NEU v51: ATBS-Schnellzugriff im Hauptmenü
  if (data === 'mode_atbs_direkt') {
    await answerCallbackQuery(callbackId);
    await startAtbsDirectInput(chatId);
    return;
  }

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

  // NEU v53: Abnahmeprotokoll
  if (data === 'bau:abnahme') {
    await answerCallbackQuery(callbackId);
    await showAbnahmeTypen(chatId, session);
    return;
  }

  // NEU v53: Abnahme-Typ gewählt
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

  // NEU: Gewerk-Status-Tabelle
  if (data.startsWith('bau:gewerke:')) {
    const projektId = data.replace('bau:gewerke:', '');
    await answerCallbackQuery(callbackId, 'Lade Gewerk-Status...');
    await showGewerkStatus(chatId, projektId);
    return;
  }

  // NEU v52: Ausführungsarten-Tabelle
  if (data.startsWith('bau:ausfuehrung:')) {
    const projektId = data.replace('bau:ausfuehrung:', '');
    await answerCallbackQuery(callbackId, 'Lade Ausführungsarten...');
    await showAusfuehrungsarten(chatId, session, projektId);
    return;
  }

  // NEU v55: Termine-Menü
  if (data.startsWith('bau:termine:')) {
    const projektId = data.replace('bau:termine:', '');
    await answerCallbackQuery(callbackId, 'Lade Termine...');
    await showTermineMenu(chatId, projektId);
    return;
  }

  // NEU v55: Termin-Typ gewählt (start, plan, maengelfrei, kunde)
  if (data.match(/^termin:(start|plan|maengelfrei|kunde):/)) {
    const parts = data.split(':');
    const terminTyp = parts[1];
    const projektId = parts[2];
    await answerCallbackQuery(callbackId);
    await startTerminEingabe(chatId, session, terminTyp, projektId);
    return;
  }

  // NEU v55: Termin bestätigen
  if (data.match(/^termin:confirm:/)) {
    const parts = data.split(':');
    // termin:confirm:typ:projektId:datum
    const terminTyp = parts[2];
    const projektId = parts[3];
    const datumIso = parts[4];
    await answerCallbackQuery(callbackId, 'Speichere...');
    await confirmTerminAenderung(chatId, terminTyp, projektId, datumIso);
    return;
  }

  // NEU v55: Termin abbrechen
  if (data.match(/^termin:cancel:/)) {
    const projektId = data.replace('termin:cancel:', '');
    await answerCallbackQuery(callbackId, 'Abgebrochen');
    await updateSession(chatId, { aktueller_modus: 'baustelle', modus_daten: {} });
    await showTermineMenu(chatId, projektId);
    return;
  }

  // NEU v55: Sprach-Befehl bestätigen
  if (data === 'befehl:bestaetigen') {
    await answerCallbackQuery(callbackId, 'Wird ausgeführt...');
    await executeSprachBefehl(chatId, session);
    return;
  }

  // NEU v55: Sprach-Befehl abbrechen
  if (data === 'befehl:abbrechen') {
    await answerCallbackQuery(callbackId, 'Abgebrochen');
    const pendingBefehl = session?.modus_daten?.pending_befehl;
    await logSprachBefehl(chatId, pendingBefehl, false, 'Vom Benutzer abgebrochen');
    await updateSession(chatId, {
      aktueller_modus: session?.aktuelles_bv_id ? 'baustelle' : null,
      modus_daten: {
        projekt_nr: session?.modus_daten?.projekt_nr,
        projekt_name: session?.modus_daten?.projekt_name
      }
    });
    await sendMessage(chatId, '❌ Befehl abgebrochen.',
      { reply_markup: { inline_keyboard: [
        [{ text: "🏗️ Baustelle", callback_data: "mode_baustelle" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

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

  if (data.startsWith('nachweis:')) {
    const typ = data.replace('nachweis:', '');
    await answerCallbackQuery(callbackId);
    await handleNachweisTyp(chatId, session, typ);
    return;
  }

  if (data.startsWith('aufmass:select:')) {
    const atbs = data.replace('aufmass:select:', '');
    await answerCallbackQuery(callbackId);
    await searchMatterportProject(chatId, atbs);
    return;
  }

  if (data.startsWith('aufmass:create:')) {
    const atbs = data.replace('aufmass:create:', '');
    await answerCallbackQuery(callbackId, 'Aufmaß erstellen');
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
    return;
  }

  if (data.startsWith('aufmass:view:')) {
    const atbs = data.replace('aufmass:view:', '');
    await answerCallbackQuery(callbackId);
    const { data: aufmass } = await supabase.from('aufmass_data').select('*').eq('atbs_nummer', atbs).order('created_at', { ascending: false }).limit(1).single();
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
    return;
  }

  if (data === 'ba:start_ocr') {
    await answerCallbackQuery(callbackId, 'OCR wird gestartet...');
    await startOcrProcessing(chatId, session);
    return;
  }

  if (data.startsWith('set_auftraggeber:')) {
    const parts = data.split(':');
    const bedarfsanalyseId = parts[1];
    const auftraggeber = parts.slice(2).join(':');
    const { error } = await supabase.from('bedarfsanalysen').update({ auftraggeber, status: 'ocr_done' }).eq('id', bedarfsanalyseId);
    if (error) { await answerCallbackQuery(callbackId, `Fehler: ${error.message}`); return; }
    await answerCallbackQuery(callbackId, `Auftraggeber: ${auftraggeber}`);
    await sendMessage(chatId, `Auftraggeber gesetzt: <b>${auftraggeber}</b>\n\nAngebot wird erstellt...`);
    await updateSession(chatId, {
      aktueller_modus: 'bedarfsanalyse_processing',
      modus_daten: { bedarfsanalyse_id: bedarfsanalyseId }
    });
    await callFinalizeAngebot(chatId, bedarfsanalyseId);
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
    await supabase.from('angebots_drafts').update({ status: 'confirmed' }).eq('id', draftId);
    await sendMessage(chatId,
      `✅ <b>Angebot bestätigt!</b>\n\nWas möchtest du tun?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📤 Nach Odoo exportieren", callback_data: `angebot:export:${draftId}` }],
        [{ text: "📝 Positionen ansehen", callback_data: `angebot:list:${draftId}` }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  if (data.startsWith('angebot:discard:')) {
    const draftId = data.replace('angebot:discard:', '');
    await answerCallbackQuery(callbackId, 'Angebot verworfen');
    await supabase.from('angebots_drafts').update({ status: 'discarded' }).eq('id', draftId);
    await sendMessage(chatId, `Angebot verworfen.\n\n/start für Hauptmenü.`);
    await updateSession(chatId, { aktueller_modus: null, modus_daten: {} });
    return;
  }

  if (data.startsWith('angebot:export:')) {
    const draftId = data.replace('angebot:export:', '');
    await answerCallbackQuery(callbackId, 'Export wird gestartet...');

    const { data: draft } = await supabase.from('angebots_drafts').select('odoo_order_id, odoo_url').eq('id', draftId).single();
    if (draft?.odoo_order_id) {
      await sendMessage(chatId,
        `Bereits exportiert!\n\n` +
        `Odoo: ${draft.odoo_url || `Order #${draft.odoo_order_id}`}`);
      return;
    }

    await sendMessage(chatId, `⏳ Export nach Odoo läuft...`);
    try {
      const fnUrl = `${SUPABASE_URL}/functions/v1/export-to-odoo`;
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ angebot_id: draftId }),
      });
      const result = await response.json();
      if (result.success) {
        await sendMessage(chatId,
          `✅ <b>Erfolgreich nach Odoo exportiert!</b>\n\n` +
          `Order: S${String(result.odoo_order_id).padStart(5, '0')}\n` +
          `Positionen: ${result.positionen_count}\n` +
          `Netto: ${Number(result.summe_netto).toFixed(2)} €\n` +
          `Brutto: ${Number(result.summe_brutto).toFixed(2)} €\n\n` +
          `${result.odoo_url || ''}`);
      } else {
        await sendMessage(chatId, `Export-Fehler: ${result.error}`);
      }
    } catch (e) {
      await sendMessage(chatId, `Export-Fehler: ${(e as Error).message}`);
    }
    return;
  }

  if (data.startsWith('pos:ok:')) {
    const posId = data.replace('pos:ok:', '');
    await answerCallbackQuery(callbackId, 'OK');
    await supabase.from('angebots_positionen').update({ needs_review: false, review_status: 'approved' }).eq('id', posId);
    await sendMessage(chatId, `✅ Position bestätigt.`);
    return;
  }

  if (data.startsWith('pos:remove:')) {
    const posId = data.replace('pos:remove:', '');
    await answerCallbackQuery(callbackId, 'Entfernt');
    const { data: pos } = await supabase.from('angebots_positionen').select('draft_id, gesamtpreis').eq('id', posId).single();
    await supabase.from('angebots_positionen').delete().eq('id', posId);
    if (pos?.draft_id) {
      const { data: remaining } = await supabase.from('angebots_positionen').select('gesamtpreis').eq('draft_id', pos.draft_id);
      const summeNetto = (remaining || []).reduce((s, p) => s + Number(p.gesamtpreis), 0);
      await supabase.from('angebots_drafts').update({ summe_netto: summeNetto, summe_brutto: Math.round(summeNetto * 1.19 * 100) / 100 }).eq('id', pos.draft_id);
    }
    await sendMessage(chatId, `❌ Position entfernt.`);
    return;
  }

  await answerCallbackQuery(callbackId);
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', bot: 'neurealis-bot', version: 'v57-hilfe-system' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update).substring(0, 500));

    if (update._internal === 'ocr_done' && update.bedarfsanalyse_id && update.chat_id) {
      await handleOcrResult(update.chat_id, update.bedarfsanalyse_id);
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      const from = update.message.from;
      const session = await getOrCreateSession(chatId, from);
      await updateSession(chatId, {});

      if (text.startsWith('/start')) { await handleStart(chatId, session); }
      else if (text.startsWith('/hilfe') || text.startsWith('/help')) { await handleHelp(chatId); }
      else if (text.startsWith('/sync')) { await handleSync(chatId); }
      else if (text.startsWith('/status')) { await handleStatus(chatId, session); }
      else if (text.startsWith('/abbrechen')) { await handleAbbrechen(chatId); }

      else if (update.message.voice) {
        const modus = session?.aktueller_modus;
        if (modus === 'mangel_erfassen' || modus === 'nachtrag_erfassen') {
          await sendMessage(chatId, '⏳ Sprachnachricht wird transkribiert...');
          const fileData = await downloadTelegramFile(update.message.voice.file_id);
          if (fileData) {
            const transcript = await transcribeVoice(fileData.base64, 'audio/ogg');
            if (transcript) {
              if (modus === 'mangel_erfassen') {
                await handleMangelText(chatId, session, transcript);
              } else {
                await handleNachtragText(chatId, session, transcript);
              }
            } else {
              await sendMessage(chatId, 'Fehler bei der Transkription. Bitte versuche es erneut.');
            }
          } else {
            await sendMessage(chatId, 'Fehler beim Herunterladen der Sprachnachricht.');
          }
        } else {
          await sendMessage(chatId, 'Sprachnachrichten werden nur im Mangel- oder Nachtrag-Modus unterstützt.');
        }
      }

      else if (update.message.photo) {
        const modus = session?.aktueller_modus;

        // NEU v53: Multi-Foto-Upload Check
        const mediaGroupId = update.message?.media_group_id;
        if (mediaGroupId) {
          // Multi-Foto-Upload: Fotos sammeln
          const multiResult = await handleMultiFotoUpload(chatId, session, update);
          if (multiResult === 'pending') {
            // Warte auf weitere Fotos der Gruppe
            return new Response('OK', { status: 200 });
          }
          if (Array.isArray(multiResult) && multiResult.length > 1) {
            // Mehrere Fotos verarbeiten
            await processPendingFotos(chatId, session, multiResult);
            return new Response('OK', { status: 200 });
          }
          // Einzelnes Foto (obwohl media_group_id vorhanden) - normal verarbeiten
        }

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
          // NEU v53: Abnahmeprotokoll-Foto
          await handleAbnahmeFoto(chatId, session, update.message.photo);
        }
        else if (modus === 'bedarfsanalyse' || modus === 'bedarfsanalyse_fotos') {
          await handleBedarfsanalysePhoto(chatId, session, update.message.photo);
        } else {
          await updateSession(chatId, { aktueller_modus: 'bedarfsanalyse', modus_daten: {} });
          await handleBedarfsanalysePhoto(chatId, { ...session, modus_daten: {} }, update.message.photo);
        }
      }

      else if (update.message.document) {
        const modus = session?.aktueller_modus;
        if (modus === 'aufmass_csv_upload' || modus === 'aufmass_projekt') {
          await handleCsvUpload(chatId, session, update.message.document);
        } else {
          await sendMessage(chatId, `Dokument empfangen: ${update.message.document.file_name}\n\nWechsle zuerst in den Aufmaß-Modus über /start.`);
        }
      }

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
        // NEU v55: Termin-Eingabe
        else if (modus?.startsWith('await_termin_')) {
          await handleTerminEingabe(chatId, session, text);
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
          // NEU v55: Sprach-Befehl-Erkennung
          if (siehtAusWieBefehl(text)) {
            await sendMessage(chatId, '⏳ Befehl wird analysiert...');
            const befehl = await parseSprachBefehlMitFallback(text);
            if (befehl) {
              await handleSprachBefehl(chatId, session, befehl);
            } else {
              // Befehl nicht erkannt - zeige Hilfe-Button
              await sendMessage(chatId,
                `❓ <b>Befehl nicht erkannt</b>\n\n` +
                `Ich konnte deinen Befehl leider nicht verstehen.\n\n` +
                `<b>Kurze Beispiele:</b>\n` +
                `• "ATBS 450 Elektrik fertig"\n` +
                `• "Mangel bei 450: Riss in Fliese"`,
                { reply_markup: { inline_keyboard: [
                  [{ text: "❓ Ausführliche Hilfe", callback_data: "hilfe:sprachbefehle" }],
                  [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
                ] } }
              );
              await logSprachBefehl(chatId, null, false, 'Befehl nicht erkannt: ' + text);
            }
          } else {
            await sendMessage(chatId,
              `Ich habe deine Nachricht nicht verstanden.\n\n` +
              `/start - Hauptmenü\n/hilfe - Alle Befehle`);
          }
        }
      }
    }

    if (update.callback_query) {
      await handleCallbackQuery(update);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
