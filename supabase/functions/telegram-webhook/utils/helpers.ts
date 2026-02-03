/**
 * Allgemeine Hilfsfunktionen
 */
import type { AusfuehrungStatus } from "../types.ts";
import { supabase } from "../constants.ts";

// ============================================
// Projekt-Stammdaten Lookup
// ============================================

/**
 * Projekt-Stammdaten aus monday_bauprozess
 */
export interface ProjektStammdaten {
  projektname_komplett: string | null;
  bl_name: string | null;
  bl_email: string | null;
  nu_firma: string | null;
  nu_email: string | null;
  ag_name: string | null;
  ag_email: string | null;
  ag_telefon: string | null;
  nua_nr: string | null;
  marge_prozent: number | null;
}

/**
 * Lädt Projekt-Stammdaten aus monday_bauprozess basierend auf ATBS-Nummer
 * Inkl. NUA-Nr und Marge aus column_values
 */
export async function getProjektStammdaten(atbsNummer: string): Promise<ProjektStammdaten | null> {
  try {
    const { data, error } = await supabase
      .from('monday_bauprozess')
      .select(`
        projektname_komplett,
        bl_name,
        bl_email,
        nu_firma,
        nu_email,
        ag_name,
        ag_email,
        ag_telefon,
        column_values
      `)
      .eq('atbs_nummer', atbsNummer)
      .single();

    if (error || !data) {
      console.log(`[getProjektStammdaten] Kein Projekt gefunden für ${atbsNummer}`);
      return null;
    }

    // NUA-Nr und Marge aus column_values extrahieren
    let nua_nr: string | null = null;
    let marge_prozent: number | null = null;

    if (data.column_values) {
      const cv = data.column_values as Record<string, unknown>;

      // NUA-Nr aus text23__1
      const nuaField = cv.text23__1;
      if (nuaField && typeof nuaField === 'object') {
        const nuaObj = nuaField as { text?: string };
        if (nuaObj.text && nuaObj.text.trim()) {
          nua_nr = nuaObj.text.trim();
        }
      }

      // Marge aus zahlen0__1
      const margeField = cv.zahlen0__1;
      if (margeField && typeof margeField === 'object') {
        const margeObj = margeField as { text?: string };
        if (margeObj.text && margeObj.text.trim()) {
          const parsed = parseFloat(margeObj.text.trim());
          if (!isNaN(parsed)) {
            marge_prozent = parsed;
          }
        }
      }
    }

    console.log(`[getProjektStammdaten] ${atbsNummer}: BL=${data.bl_name}, NU=${data.nu_firma}, NUA=${nua_nr}, Marge=${marge_prozent}%`);

    return {
      projektname_komplett: data.projektname_komplett,
      bl_name: data.bl_name,
      bl_email: data.bl_email,
      nu_firma: data.nu_firma,
      nu_email: data.nu_email,
      ag_name: data.ag_name,
      ag_email: data.ag_email,
      ag_telefon: data.ag_telefon,
      nua_nr,
      marge_prozent
    };
  } catch (e) {
    console.error(`[getProjektStammdaten] Fehler für ${atbsNummer}:`, e);
    return null;
  }
}

/**
 * Formatiert ein Datum im deutschen Format (DD.MM.YYYY)
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Extrahiert ATBS-Nummer aus Monday column_values (Legacy)
 */
export function extractATBS(columnValues: Record<string, unknown> | null): string | null {
  if (!columnValues) return null;
  const text49 = columnValues.text49__1;
  if (!text49) return null;
  if (typeof text49 === 'string') return text49;
  if (typeof text49 === 'object' && text49 !== null) {
    const obj = text49 as { value?: string; text?: string };
    if (obj.value) return obj.value;
    if (obj.text) return obj.text;
  }
  return null;
}

/**
 * Extrahiert Projekt-Name aus Monday column_values
 */
export function extractProjectName(columnValues: Record<string, unknown> | null): string | null {
  if (!columnValues) return null;
  const text23 = columnValues.text23__1;
  if (typeof text23 === 'string') return text23;
  if (typeof text23 === 'object' && text23 !== null) {
    const obj = text23 as { value?: string };
    if (obj.value) return obj.value;
  }
  return null;
}

/**
 * Extrahiert Phase aus Monday column_values
 * "Status | Projekt" ist in status06__1
 */
export function extractPhase(columnValues: Record<string, unknown> | null): string | null {
  if (!columnValues) return null;
  const status = columnValues.status06__1;
  if (typeof status === 'object' && status !== null) {
    const obj = status as { text?: string };
    if (obj.text) return obj.text;
  }
  if (typeof status === 'string') return status;
  return null;
}

/**
 * Extrahiert Phase-Nummer aus Monday column_values
 */
export function extractPhaseNumber(columnValues: Record<string, unknown> | null): number | null {
  const phase = extractPhase(columnValues);
  if (!phase) return null;
  const match = phase.match(/^\((\d+)\)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Extrahiert Feld-Text aus verschiedenen Monday-Formaten
 */
export function extractFieldText(
  columnValues: Record<string, unknown> | null,
  ...fieldIds: string[]
): string {
  if (!columnValues) return '';
  for (const fieldId of fieldIds) {
    const field = columnValues[fieldId];
    if (!field) continue;
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field !== null) {
      const obj = field as { text?: string; value?: string };
      if (obj.text) return obj.text;
      if (obj.value) {
        try {
          const parsed = JSON.parse(obj.value);
          return parsed.text || parsed.value || '';
        } catch {
          return obj.value;
        }
      }
    }
  }
  return '';
}

/**
 * Extrahiert Datum aus Monday-Feld
 */
export function extractDate(
  columnValues: Record<string, unknown> | null,
  fieldId: string
): string {
  if (!columnValues) return '-';
  const field = columnValues[fieldId];
  if (!field) return '-';
  let dateStr = '';

  if (typeof field === 'string') {
    dateStr = field;
  } else if (typeof field === 'object' && field !== null) {
    const obj = field as { text?: string; date?: string; value?: string };
    if (obj.text) {
      dateStr = obj.text;
    } else if (obj.date) {
      dateStr = obj.date;
    } else if (obj.value) {
      try {
        const parsed = JSON.parse(obj.value);
        dateStr = parsed.date || parsed.text || '';
      } catch {
        dateStr = obj.value;
      }
    }
  }

  if (!dateStr) return '-';

  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr.substring(0, 10);
  }
}

/**
 * Status-zu-Emoji-Mapping für Gewerke
 */
export function gewerkStatusEmoji(status: string): string {
  if (!status) return '-';
  const s = status.toLowerCase();
  if (s.includes('fertig') || s.includes('erledigt') || s.includes('komplett')) return '✅';
  if (s.includes('arbeit') || s.includes('läuft') || s.includes('rohinstall')) return '🔨';
  if (s.includes('geplant') || s.includes('offen')) return '⏳';
  if (s.includes('verspätet') || s.includes('verzug')) return '⚠️';
  return '-';
}

/**
 * Extrahiert Text aus Monday JSON-Value
 */
export function extractMondayText(jsonValue: unknown): string {
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

/**
 * Bestimmt Ausführungs-Status mit Emoji
 */
export function getAusfuehrungStatus(value: string): AusfuehrungStatus {
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

/**
 * Zählt angekreuzte Checkboxen in einem Objekt (rekursiv)
 */
export function countCheckboxes(obj: Record<string, unknown>): number {
  let count = 0;
  const skipKeys = [
    'auftraggeber', 'pauschal_groesse', '_meta', 'header',
    'eigentuemer', 'immobilie', 'zeitrahmen', 'budget',
    'termin', 'sanierungsqualitaet', 'anforderungen_freitext'
  ];

  for (const [key, value] of Object.entries(obj)) {
    if (skipKeys.includes(key)) continue;
    if (typeof value === 'boolean' && value === true) {
      count++;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countCheckboxes(value as Record<string, unknown>);
    }
  }
  return count;
}

/**
 * Normalisiert ATBS-Suchbegriff
 * "448", "ATBS-448", "ATBS 448" -> "ATBS-448"
 */
export function normalizeAtbsSearch(searchTerm: string): string {
  let term = searchTerm.trim().toUpperCase();
  term = term.replace(/^ATBS[- ]?/i, '');
  return `ATBS-${term}`;
}

/**
 * Erstellt Google Maps Link aus Adresse
 */
export function createMapsUrl(adresse: string): string {
  if (!adresse) return '';
  const adresseClean = adresse.split('|')[0]?.trim() || adresse;
  return adresseClean
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseClean)}`
    : '';
}

/**
 * Berechnet Tage überfällig
 */
export function getDaysOverdue(fristDate: string): number {
  const frist = new Date(fristDate);
  const heute = new Date();
  return Math.floor((heute.getTime() - frist.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Kürzt Text auf maximale Länge
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Erstellt Padding für Tabellen-Layout
 */
export function padText(text: string, length: number): string {
  return (text || '').padEnd(length).substring(0, length);
}

/**
 * Formatiert Währung im deutschen Format
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/**
 * Konvertiert Base64 zu Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generiert eine eindeutige Datei-ID
 */
export function generateFileId(prefix: string, projektNr: string): string {
  return `${projektNr}_${prefix}_${Date.now()}`;
}

/**
 * Formatiert Telefonnummer für Anzeige
 * "4915120244442" → "+49 151 20244442"
 * "494915120244442" → "+49 151 20244442" (doppelte 49 korrigiert)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  // Nur Ziffern behalten
  let digits = phone.replace(/\D/g, '');

  // Doppelte 49 am Anfang korrigieren (z.B. 494915... → 4915...)
  if (digits.startsWith('4949')) {
    digits = digits.substring(2);
  }

  // Deutsche Nummer ohne + am Anfang
  if (digits.startsWith('49')) {
    const rest = digits.substring(2);
    // Gruppierung: +49 XXX XXXXXXXX
    if (rest.length >= 10) {
      const vorwahl = rest.substring(0, 3);
      const nummer = rest.substring(3);
      return `+49 ${vorwahl} ${nummer}`;
    }
    return `+49 ${rest}`;
  }

  // Nummer beginnt mit 0 (lokale deutsche Nummer)
  if (digits.startsWith('0')) {
    const rest = digits.substring(1);
    if (rest.length >= 10) {
      const vorwahl = rest.substring(0, 3);
      const nummer = rest.substring(3);
      return `+49 ${vorwahl} ${nummer}`;
    }
    return `+49 ${rest}`;
  }

  // Unbekanntes Format - mit + zurückgeben
  return `+${digits}`;
}

/**
 * Erstellt klickbaren tel: Link für Telegram (HTML)
 * "4915120244442" → '<a href="tel:+4915120244442">+49 151 20244442</a>'
 */
export function formatPhoneLink(phone: string | null | undefined): string {
  if (!phone) return '';

  const formatted = formatPhoneNumber(phone);
  if (!formatted) return '';

  // tel: Link braucht Nummer ohne Leerzeichen
  const telNumber = formatted.replace(/\s/g, '');

  return `<a href="tel:${telNumber}">${formatted}</a>`;
}
