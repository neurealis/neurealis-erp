import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * telegram-webhook v60 - Audio-Briefing für Bauleiter
 *
 * KOMPLETT NEUER Bot: @neurealis_bedarfsanalyse_bot
 *
 * NEU in v60: Audio-Briefing Feature
 * - 🎙️ /briefing Befehl: Generiert Audio-Briefing für Bauleiter
 *   - Nur für Bauleiter (Rolle BL) oder Holger Neumann verfügbar
 *   - Ruft audio-briefing-generate Edge Function auf
 *   - Audio wird direkt als Telegram-Sprachnachricht gesendet
 * - 🎙️ Button im Hauptmenü für Bauleiter: "Audio-Briefing abrufen"
 *
 * v59: Phase 4 - Baustellenberichte & NU-Kommunikation
 * - 📝 Bericht erstellen: Baustellenbegehungsberichte via Text/Sprache
 *   - Speicherung in dokumente-Tabelle (Dokumenttyp: BERICHT)
 *   - Session-State für Bericht-Eingabe
 * - 📨 Nachricht an NU: Schnell-Nachrichten an Nachunternehmer
 *   - Vordefinierte Templates (Termin, Material, Dringend)
 *   - Eigene Nachricht schreiben
 *   - NU-Chat-ID aus monday_bauprozess → kontakte ermitteln
 *
 * v58: Tages-Dashboard, ATBS-Nummerierung, Favoriten
 * - 📊 Tages-Dashboard: Bei /start für Bauleiter überfällige Mängel + offene Nachträge
 * - 🔢 Nummerierung ATBS-XXX-M1/N1: Fortlaufende Nummern pro Projekt
 * - ⭐ Projekt-Favoriten: Top 3 aktive Projekte im Hauptmenü
 *
 * v54: Kompakte Projekt-Info & Gewerk-Status-Tabelle
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
// Helper: Datum formatieren
// ============================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ============================================
// Helper: Extract ATBS from Monday column_values (Legacy - kann entfernt werden)
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

function extractProjectName(columnValues: any): string | null {
  if (!columnValues) return null;
  const text23 = columnValues.text23__1;
  if (typeof text23 === 'string') return text23;
  if (typeof text23 === 'object' && text23.value) return text23.value;
  return null;
}

function extractPhase(columnValues: any): string | null {
  if (!columnValues) return null;
  // "Status | Projekt" ist in status06__1!
  const status = columnValues.status06__1;
  if (typeof status === 'object' && status.text) return status.text;
  if (typeof status === 'string') return status;
  return null;
}

function extractPhaseNumber(columnValues: any): number | null {
  const phase = extractPhase(columnValues);
  if (!phase) return null;
  const match = phase.match(/^\((\d+)\)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

// Phase-Labels für die Anzeige (Monday "Status | Projekt" = status06__1)
const PHASE_LABELS: Record<number, string> = {
  0: '(0) Bedarfsanalyse',
  1: '(1) Angebotsphase',
  2: '(2) Auftrag erhalten',
  3: '(3) Vorbereitung',
  4: '(4) Umsetzung',
  5: '(5) Rechnungsstellung',
  7: '(7) Abgeschlossen',
  9: '(9) Nicht erhalten'
};

// Gewerk-Spalten-Mapping (Monday column IDs)
const GEWERK_SPALTEN: Record<string, string> = {
  'Entkernung': 'gg2On',
  'Maurer': '67n4J',
  'Elektrik': '06reu',
  'Bad & Sanitär': 'GnADf',
  'Heizung': 'aJKmD',
  'Tischler': 'tSYWD',
  'Wände & Decken': 'Fl8Za',
  'Boden': 'qAUvS',
  'Endreinigung': 'Nygjn',
};

// Monday-Spalten für Projekt-Info
const PROJEKT_SPALTEN = {
  bl_name: ['people__1', 'FPlQB'],
  nu_firma: ['mirror__1', 'sQkwj'],
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
// NEU v58: Mangel/Nachtrag Nummerierung ATBS-XXX-M1/N1
// ============================================

async function generateMangelNummer(atbs: string): Promise<string> {
  // Zähle bestehende Mängel für dieses Projekt
  const { count } = await supabase
    .from('maengel_fertigstellung')
    .select('*', { count: 'exact', head: true })
    .eq('projekt_nr', atbs);

  const nextNum = (count || 0) + 1;
  return `${atbs}-M${nextNum}`;
}

async function generateNachtragNummer(atbs: string): Promise<string> {
  // Zähle bestehende Nachträge für dieses Projekt
  const { count } = await supabase
    .from('nachtraege')
    .select('*', { count: 'exact', head: true })
    .eq('atbs_nummer', atbs);

  const nextNum = (count || 0) + 1;
  return `${atbs}-N${nextNum}`;
}

// ============================================
// NEU v58: Tages-Dashboard für Bauleiter
// ============================================

async function getBauleiterDashboard(chatId: number): Promise<string | null> {
  try {
    // Prüfe ob der User ein Bauleiter ist
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    // Nur für Bauleiter (BL) oder Holger Neumann Dashboard zeigen
    const isBauleiter = kontakt?.rolle?.toUpperCase() === 'BL' ||
      (kontakt?.vorname?.toLowerCase() === 'holger' && kontakt?.nachname?.toLowerCase() === 'neumann');

    if (!isBauleiter) return null;

    // Überfällige Mängel abfragen
    const { data: ueberfaelligeMaengel, count: mangelCount } = await supabase
      .from('maengel_fertigstellung')
      .select('id, projekt_nr, beschreibung_mangel, datum_frist', { count: 'exact' })
      .lt('datum_frist', new Date().toISOString().split('T')[0])
      .not('status_mangel', 'in', '(Abgenommen,Abgeschlossen,Erledigt,Geschlossen)')
      .order('datum_frist', { ascending: true })
      .limit(3);

    // Offene Nachträge abfragen
    const { data: offeneNachtraege, count: nachtragCount } = await supabase
      .from('nachtraege')
      .select('id, atbs_nummer, beschreibung, betrag_netto', { count: 'exact' })
      .in('status', ['Gemeldet', 'In Prüfung']);

    // Summe der offenen Nachträge
    const summaNetto = (offeneNachtraege || []).reduce((sum, n) => sum + (Number(n.betrag_netto) || 0), 0);

    // Dashboard-Text erstellen
    let dashboard = `<b>📊 Tages-Dashboard</b>\n`;
    dashboard += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Überfällige Mängel
    dashboard += `<b>⚠️ Überfällige Mängel: ${mangelCount || 0}</b>\n`;
    if (ueberfaelligeMaengel && ueberfaelligeMaengel.length > 0) {
      for (const m of ueberfaelligeMaengel) {
        const frist = new Date(m.datum_frist);
        const heute = new Date();
        const tageUeberfaellig = Math.floor((heute.getTime() - frist.getTime()) / (1000 * 60 * 60 * 24));
        const beschreibung = (m.beschreibung_mangel || '').substring(0, 30);
        dashboard += `  • ${m.projekt_nr}: ${beschreibung}${beschreibung.length >= 30 ? '...' : ''}\n`;
        dashboard += `    <i>(${tageUeberfaellig} Tage überfällig)</i>\n`;
      }
      if ((mangelCount || 0) > 3) {
        dashboard += `  <i>... und ${(mangelCount || 0) - 3} weitere</i>\n`;
      }
    } else {
      dashboard += `  <i>Keine überfälligen Mängel 🎉</i>\n`;
    }

    dashboard += `\n`;

    // Offene Nachträge
    dashboard += `<b>📋 Offene Nachträge: ${nachtragCount || 0}</b>\n`;
    if (summaNetto > 0) {
      dashboard += `  Summe netto: <b>${summaNetto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</b>\n`;
    } else {
      dashboard += `  <i>Keine offenen Nachträge</i>\n`;
    }

    dashboard += `\n━━━━━━━━━━━━━━━━━━━━\n`;

    return dashboard;
  } catch (e) {
    console.error('Dashboard error:', e);
    return null;
  }
}

// ============================================
// NEU v58: Projekt-Favoriten (Top 3 aktive Projekte)
// ============================================

async function getProjektFavoriten(): Promise<Array<{id: string, atbs: string, name: string}>> {
  try {
    // Letzte Aktivität basierend auf neuesten Mängeln und Nachträgen
    // Phase 3-4 bevorzugen (Vorbereitung/Umsetzung)

    // Hole Projekte mit aktueller Aktivität
    const { data: maengelProjekte } = await supabase
      .from('maengel_fertigstellung')
      .select('projekt_nr')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: nachtragProjekte } = await supabase
      .from('nachtraege')
      .select('atbs_nummer')
      .order('created_at', { ascending: false })
      .limit(10);

    // Sammle einzigartige ATBS-Nummern nach Aktivität
    const aktiveProjekte = new Map<string, number>();

    (maengelProjekte || []).forEach((m, idx) => {
      const atbs = m.projekt_nr;
      if (atbs && !aktiveProjekte.has(atbs)) {
        aktiveProjekte.set(atbs, idx);
      }
    });

    (nachtragProjekte || []).forEach((n, idx) => {
      const atbs = n.atbs_nummer;
      if (atbs) {
        const existing = aktiveProjekte.get(atbs);
        if (existing === undefined || idx < existing) {
          aktiveProjekte.set(atbs, idx);
        }
      }
    });

    // Sortiere nach Aktivität und nimm Top 3
    const sortedAtbs = Array.from(aktiveProjekte.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([atbs]) => atbs);

    if (sortedAtbs.length === 0) return [];

    // Hole Projekt-Details aus monday_bauprozess
    const { data: projekte } = await supabase
      .from('monday_bauprozess')
      .select('id, atbs_nummer, name, status_projekt')
      .in('atbs_nummer', sortedAtbs)
      .or('status_projekt.like.(3)%,status_projekt.like.(4)%'); // Phase 3-4 bevorzugen

    if (!projekte || projekte.length === 0) return [];

    // Sortiere nach Original-Aktivitätsreihenfolge und nimm Top 3
    const result = projekte
      .sort((a, b) => {
        const idxA = sortedAtbs.indexOf(a.atbs_nummer || '');
        const idxB = sortedAtbs.indexOf(b.atbs_nummer || '');
        return idxA - idxB;
      })
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        atbs: p.atbs_nummer || p.id.substring(0, 8),
        name: p.name || ''
      }));

    return result;
  } catch (e) {
    console.error('Favoriten error:', e);
    return [];
  }
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
        [{ text: "📝 Bericht erstellen", callback_data: "bau:bericht" }],
        [{ text: "📨 Nachricht an NU", callback_data: "bau:nachricht:nu" }],
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
      [{ text: "🔍 (0) Bedarfsanalyse", callback_data: "phase:0" }],
      [{ text: "📝 (1) Angebotsphase", callback_data: "phase:1" }],
      [{ text: "✅ (2) Auftrag erhalten", callback_data: "phase:2" }],
      [{ text: "🔧 (3) Vorbereitung", callback_data: "phase:3" }],
      [{ text: "🏗️ (4) Umsetzung", callback_data: "phase:4" }],
      [{ text: "💰 (5) Rechnungsstellung", callback_data: "phase:5" }],
      [{ text: "🏁 (7) Abgeschlossen", callback_data: "phase:7" }],
      [{ text: "❌ (9) Nicht erhalten", callback_data: "phase:9" }],
      [{ text: "⬅️ Zurück", callback_data: "mode_baustelle" }]
    ] } }
  );
}

// NEU v71: Projekte nach Phase filtern (mit echten DB-Spalten)
async function listProjekteByPhase(chatId: number, phaseNumber: number, page: number = 0) {
  const PAGE_SIZE = 15;
  const phaseLabel = PHASE_LABELS[phaseNumber] || `(${phaseNumber})`;

  // Direkt in DB filtern mit LIKE auf Phase-Nummer
  const { data: projekte, error, count } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, auftraggeber, adresse', { count: 'exact' })
    .like('status_projekt', `(${phaseNumber})%`)
    .order('updated_at', { ascending: false });

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId,
      `Keine Projekte in Phase ${phaseLabel} gefunden.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Andere Phase wählen", callback_data: "bau:select_method:phase" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  // Pagination
  const totalPages = Math.ceil(projekte.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = projekte.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = p.atbs_nummer || p.id.substring(0, 8);
    const name = p.name || p.adresse || '';
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
    `<b>${phaseLabel}</b>\n` +
    `${projekte.length} Projekte${pageInfo}:`,
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

  // Aktive Phasen: (2) Auftrag, (3) Vorbereitung, (4) Umsetzung - direkt in DB filtern
  const { data: projekte, error } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, adresse')
    .or('status_projekt.like.(2)%,status_projekt.like.(3)%,status_projekt.like.(4)%')
    .order('updated_at', { ascending: false });

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Baustellen gefunden.');
    return;
  }

  // Pagination
  const totalPages = Math.ceil(projekte.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = projekte.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = p.atbs_nummer || p.id.substring(0, 8);
    const name = p.name || p.adresse || '';
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
    `<b>Aktive Baustellen (${projekte.length})${pageInfo}:</b>`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function searchAndOpenProjekt(chatId: number, searchTerm: string) {
  // Normalisiere Suchbegriff: "448", "ATBS-448", "ATBS 448" -> "ATBS-448"
  let term = searchTerm.trim().toUpperCase();
  term = term.replace(/^ATBS[- ]?/i, '');
  const atbsSearch = `ATBS-${term}`;

  // Direkt in DB suchen nach ATBS oder Name
  const { data: matches } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, auftraggeber, adresse, bl_name, nu_firma, nu_ansprechpartner, nu_telefon, nu_email, ag_telefon, datum_kundenabnahme, budget, baustart, bauende, bl_email, bl_telefon, sharepoint_link, hero_projekt_id')
    .or(`atbs_nummer.ilike.%${term}%,name.ilike.%${term}%`)
    .limit(20);

  if (!matches || matches.length === 0) {
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
    const buttons = matches.slice(0, 15).map(p => {
      const atbs = p.atbs_nummer || p.id.substring(0, 8);
      const name = p.name || p.adresse || '';
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
  // v74: Umbenannte Spalten mit Präfixen: nu_ (NU), bl_ (BL), ag_ (AG)
  const atbs = projekt.atbs_nummer || projekt.id.substring(0, 8);
  const projektName = projekt.name || projekt.adresse || '';
  const phase = projekt.status_projekt || '?';
  const nuFirma = projekt.nu_firma || '-';           // NU Firmenname
  const nuAnsprechpartner = projekt.nu_ansprechpartner || ''; // NU Ansprechpartner-Name
  const nuTelefon = projekt.nu_telefon || '';        // NU Telefon
  const nuEmail = projekt.nu_email || '';            // NU E-Mail
  const auftraggeber = (projekt.auftraggeber || '-').toLowerCase();
  const telefonKunde = projekt.ag_telefon || '';
  const bvStart = projekt.baustart ? formatDate(projekt.baustart) : '-';
  const bvEndeNuPlan = projekt.bauende ? formatDate(projekt.bauende) : '-';
  const bvEndeKunde = projekt.datum_kundenabnahme ? formatDate(projekt.datum_kundenabnahme) : '-';
  const adresse = projekt.adresse || '';

  // Erstelle Google Maps Link aus der Adresse
  const adresseClean = adresse.split('|')[0]?.trim() || adresse;
  const mapsUrl = adresseClean ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseClean)}` : '';

  // Kunde-Anzeige: Geschäftskunde vs. Privatkunde
  let kundeDisplay = '';
  const isPrivat = auftraggeber === 'privat' || auftraggeber === 'neurealis';
  if (isPrivat) {
    // Privat: Name aus Projektname extrahieren (Format: "Vorname Nachname | Adresse")
    const namePart = projektName.split('|')[0]?.trim() || projektName;
    kundeDisplay = telefonKunde ? `${namePart} (${telefonKunde})` : namePart;
  } else {
    // Geschäftskunde: "gws Stefan Fromme (Telefon)" - AG + Name aus Projektname
    const namePart = projektName.split('|')[0]?.trim() || '';
    const agDisplay = projekt.auftraggeber || auftraggeber;
    kundeDisplay = telefonKunde ? `${agDisplay} ${namePart} (${telefonKunde})` : `${agDisplay} ${namePart}`;
  }

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
  infoText += `${projektName}\n`;
  if (mapsUrl) {
    infoText += `📍 <a href="${mapsUrl}">Route öffnen</a>\n`;
  }
  infoText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  infoText += `📍 Phase: ${phase}\n`;
  // Kunde (bereits oben berechnet)
  infoText += `👤 Kunde: ${kundeDisplay}\n`;
  // NU: Firma - Ansprechpartner (Telefon)
  let nuDisplay = nuFirma;
  if (nuAnsprechpartner) nuDisplay += ` - ${nuAnsprechpartner}`;
  if (nuTelefon) nuDisplay += ` (${nuTelefon})`;
  infoText += `🔧 NU: ${nuDisplay}\n\n`;
  infoText += `📅 Termine:\n`;
  infoText += `   BV Start: ${bvStart}\n`;
  infoText += `   BV Ende NU Plan: ${bvEndeNuPlan}\n`;
  infoText += `   BV Ende Kunde: ${bvEndeKunde}\n\n`;
  infoText += `⚠️ Offen: ${mangelCount || 0} Mängel | ${nachtragCount || 0} Nachträge\n`;
  infoText += `━━━━━━━━━━━━━━━━━━━━`;

  await sendMessage(chatId, infoText, {
    reply_markup: { inline_keyboard: [
      [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
      [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
      [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "📝 Bericht erstellen", callback_data: "bau:bericht" }],
      [{ text: "📨 Nachricht an NU", callback_data: "bau:nachricht:nu" }],
      [{ text: "🏗️ Gewerk-Status", callback_data: `bau:gewerke:${projekt.id}` }],
      [{ text: "📄 Abnahmeprotokoll", callback_data: "bau:abnahme" }],
      [{ text: "📊 Status anzeigen", callback_data: "bau:status" }],
      [{ text: "❌ Projekt schließen", callback_data: "bau:close" }]
    ] }
  });
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
// Baustellen-Features: Baustellenbegehungsbericht (NEU v59)
// ============================================

async function startBerichtErstellung(chatId: number, session: any) {
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

async function handleBerichtText(chatId: number, session: any, text: string) {
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

// ============================================
// Baustellen-Features: Schnell-Nachricht an NU (NEU v59)
// ============================================

async function showNachrichtNuMenu(chatId: number, session: any) {
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

async function handleNuNachrichtTemplate(chatId: number, session: any, templateKey: string) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const projektName = session?.modus_daten?.projekt_name || '';

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

async function startEigeneNachrichtNU(chatId: number, session: any) {
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

async function handleEigeneNachrichtNU(chatId: number, session: any, text: string) {
  const projektNr = session?.modus_daten?.projekt_nr;
  const nachricht = `📨 ${projektNr}: ${text}`;
  await sendNachrichtAnNU(chatId, session, nachricht);
}

async function sendNachrichtAnNU(chatId: number, session: any, nachricht: string) {
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
    // NEU v58: Generiere Mangel-Nummer im Format ATBS-XXX-M1
    const mangelNummer = await generateMangelNummer(projektNr);

    const { data: newMangel, error } = await supabase
      .from('maengel_fertigstellung')
      .insert({
        projekt_nr: projektNr,
        mangel_id: mangelNummer,
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

  // NEU v58: Generiere Nachtrag-Nummer im Format ATBS-XXX-N1
  const nachtragNr = await generateNachtragNummer(projektNr);

  // Dynamische Ermittlung von gemeldet_von basierend auf Kontakt
  const { gemeldet_von, melder_name } = await getGemeldetVon(chatId, session);
  console.log(`[v58] Nachtrag von chat_id=${chatId}: gemeldet_von=${gemeldet_von}, melder_name=${melder_name}, nr=${nachtragNr}`);

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

  // NEU v58: Tages-Dashboard für Bauleiter
  const dashboard = await getBauleiterDashboard(chatId);

  // NEU v58: Projekt-Favoriten laden
  const favoriten = await getProjektFavoriten();

  // Basis-Buttons
  const buttons: any[][] = [];

  // Favoriten als Top-Buttons (wenn vorhanden)
  if (favoriten.length > 0) {
    buttons.push([{ text: "⭐ Letzte Projekte:", callback_data: "noop" }]);
    for (const fav of favoriten) {
      const displayName = fav.name ? `${fav.atbs}: ${fav.name.substring(0, 25)}` : fav.atbs;
      buttons.push([{ text: `  ${displayName}`, callback_data: `bau:open:${fav.id}` }]);
    }
  }

  // Standard-Menü-Buttons
  buttons.push([{ text: "📊 Aufmaß erstellen/ansehen", callback_data: "mode_aufmass" }]);
  buttons.push([{ text: "📝 Bedarfsanalyse → Angebot", callback_data: "mode_bedarfsanalyse" }]);
  buttons.push([{ text: "🏗️ Baustelle öffnen", callback_data: "mode_baustelle" }]);
  buttons.push([{ text: "🔍 ATBS direkt eingeben", callback_data: "mode_atbs_direkt" }]);

  // NEU v60: Audio-Briefing Button (nur für Bauleiter - wenn Dashboard angezeigt wird)
  if (dashboard) {
    buttons.push([{ text: "🎙️ Audio-Briefing abrufen", callback_data: "briefing:generate" }]);
  }

  // Nachricht zusammenbauen
  let messageText = `<b>Willkommen beim neurealis Bot!</b>\n\n`;
  messageText += `Hallo ${name}!\n\n`;

  if (dashboard) {
    messageText += dashboard + `\n`;
  }

  messageText += `Was möchtest du tun?`;

  await sendMessage(chatId, messageText, { reply_markup: { inline_keyboard: buttons } });
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId,
    `<b>Befehle:</b>\n\n` +
    `/start - Hauptmenü\n` +
    `/hilfe - Diese Hilfe\n` +
    `/status - Aktueller Status\n` +
    `/abbrechen - Aktuellen Vorgang abbrechen\n` +
    `/sync - Matterport-Projekte synchronisieren\n` +
    `/briefing - Audio-Briefing abrufen (nur Bauleiter)\n\n` +
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
// NEU v60: Audio-Briefing für Bauleiter
// ============================================

async function handleBriefingCommand(chatId: number): Promise<void> {
  try {
    // 1. User ermitteln via telegram_chat_id
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('email, vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    // Prüfe ob Bauleiter (BL) oder Holger Neumann
    const isBauleiter = kontakt?.rolle?.toUpperCase() === 'BL' ||
      (kontakt?.vorname?.toLowerCase() === 'holger' && kontakt?.nachname?.toLowerCase() === 'neumann');

    if (!kontakt || !isBauleiter) {
      await sendMessage(chatId, '❌ Dieser Befehl ist nur für Bauleiter verfügbar.');
      return;
    }

    if (!kontakt.email) {
      await sendMessage(chatId, '❌ Für dein Konto ist keine E-Mail hinterlegt. Bitte kontaktiere den Administrator.');
      return;
    }

    // 2. Statusmeldung senden
    await sendMessage(chatId,
      '🎙️ <b>Audio-Briefing wird generiert...</b>\n\n' +
      'Das dauert ca. 30-60 Sekunden.\n' +
      'Du erhältst eine Sprachnachricht sobald es fertig ist.'
    );

    // 3. Edge Function aufrufen
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/audio-briefing-generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bauleiter_email: kontakt.email,
          force: true // Bei manuellem Abruf immer neu generieren
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Audio-Briefing error:', errorText);
      await sendMessage(chatId, '❌ Fehler beim Generieren des Briefings. Bitte versuche es später erneut.');
    }
    // Audio wird von der Edge Function direkt an Telegram gesendet
  } catch (e) {
    console.error('handleBriefingCommand error:', e);
    await sendMessage(chatId, '❌ Ein unerwarteter Fehler ist aufgetreten.');
  }
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

  // NEU v58: Noop für dekorative Buttons (z.B. Favoriten-Überschrift)
  if (data === 'noop') {
    await answerCallbackQuery(callbackId);
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

  // NEU v59: Baustellenbegehungsbericht
  if (data === 'bau:bericht') {
    await answerCallbackQuery(callbackId);
    await startBerichtErstellung(chatId, session);
    return;
  }

  // NEU v59: Nachricht an NU
  if (data === 'bau:nachricht:nu') {
    await answerCallbackQuery(callbackId);
    await showNachrichtNuMenu(chatId, session);
    return;
  }

  // NEU v59: NU-Nachricht Templates
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

  // NEU v60: Audio-Briefing abrufen
  if (data === 'briefing:generate') {
    await answerCallbackQuery(callbackId);
    await handleBriefingCommand(chatId);
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
    return new Response(JSON.stringify({ status: 'ok', bot: 'neurealis-bot', version: 'v59-berichte-nu-nachrichten' }), {
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
      else if (text.startsWith('/briefing')) { await handleBriefingCommand(chatId); }

      else if (update.message.voice) {
        const modus = session?.aktueller_modus;
        // Erweitert für Berichte und NU-Nachrichten (v59)
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
        // NEU v59: Bericht erstellen
        else if (modus === 'bericht_erfassen') {
          await handleBerichtText(chatId, session, text);
        }
        // NEU v59: Eigene Nachricht an NU
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
