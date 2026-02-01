import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * monday-sync v2 - Vollständiges Column-Mapping
 *
 * Änderungen gegenüber v1:
 * - Mappt alle Monday-Spalten auf dedizierte Supabase-Spalten
 * - Typ-Konvertierung: dates, numbers, status-text
 * - sync_source = 'monday' für Loop-Vermeidung
 * - Logging in monday_sync_log
 *
 * Board-ID: 1545426536 (Bauprozess)
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY')!;
const BOARD_ID = '1545426536';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// Type Definitions
// ============================================

interface MondayColumnValue {
  text: string | null;
  value: string | null;
}

interface MondayItem {
  id: string;
  name: string;
  group: { id: string; title: string };
  created_at: string;
  updated_at: string;
  column_values: { id: string; text: string; value: string }[];
}

// ============================================
// Column Mapping Configuration
// ============================================

/**
 * Mapping von Monday-Spalten-IDs auf Supabase-Spaltennamen
 * Basiert auf D039 (14 wichtige Spalten + erweitert)
 */
const COLUMN_MAPPING: Record<string, { target: string; type: 'text' | 'number' | 'date' | 'status' | 'email' | 'phone' | 'link' | 'file' | 'location' }> = {
  // === Identifikation ===
  'text49__1': { target: 'atbs_nummer', type: 'text' },
  'status06__1': { target: 'status_projekt', type: 'status' },
  'text_mkm11jca': { target: 'auftraggeber', type: 'text' },
  'text_mkn18mxg': { target: 'projektname_komplett', type: 'text' },

  // === Adressen & Standort ===
  'text51__1': { target: 'adresse', type: 'text' },
  'standort__1': { target: 'adresse', type: 'location' }, // Fallback aus Location

  // === Personen - NU (Nachunternehmer) ===
  'text57__1': { target: 'nu_firma', type: 'text' },
  'text573__1': { target: 'nu_ansprechpartner', type: 'text' },
  // nu_telefon und nu_email werden über People-Spalte gemappt (text573__1)

  // === Personen - BL (Bauleiter) ===
  'text_mkn8ggev': { target: 'bl_name', type: 'text' },
  // bl_email und bl_telefon separat (falls Monday-Spalten existieren)

  // === Personen - AG (Auftraggeber/Kunde) ===
  'e_mail4__1': { target: 'ag_email', type: 'email' },
  'telefon___kunde__1': { target: 'ag_telefon', type: 'phone' },
  'text_1__1': { target: 'ag_name', type: 'text' }, // Anrede (Herr/Frau)

  // === Budget & Finanzen ===
  'zahlen1__1': { target: 'budget', type: 'number' },
  'zahlen77__1': { target: 'budget', type: 'number' }, // Brutto (Fallback)
  'numeric65__1': { target: 'nua_netto', type: 'number' },
  'zahlen_mkn5xrd0': { target: 'budget', type: 'number' }, // Alternative Budget-Spalte

  // === Termine ===
  'datum2__1': { target: 'baustart', type: 'date' },
  'datum7__1': { target: 'bauende', type: 'date' },
  'datum0__1': { target: 'datum_erstbegehung', type: 'date' },
  'datum1__1': { target: 'datum_endbegehung', type: 'date' },
  'datum_mkkz2c8r': { target: 'datum_auszug', type: 'date' },
  'datum_mkm1m451': { target: 'datum_uebergabe', type: 'date' },
  'datum_mkm7qwag': { target: 'datum_kundenabnahme', type: 'date' },
  'date_mkna2sbd': { target: 'datum_angebot', type: 'date' },
  'date_mkna9vad': { target: 'datum_ab', type: 'date' },
  'date_mknac5ez': { target: 'datum_schlussrechnung', type: 'date' },
  'date_mknaefc4': { target: 'datum_nua', type: 'date' },

  // === Gewerk-Status ===
  'color_mkkh1mw9': { target: 'status_elektrik', type: 'status' },
  'color_mkkh7fp6': { target: 'status_sanitaer', type: 'status' },
  'color427__1': { target: 'status_maler', type: 'status' },
  'color78__1': { target: 'status_boden', type: 'status' },
  'color97__1': { target: 'status_tischler', type: 'status' },
  'dup__of_entkernung__1': { target: 'status_abbruch', type: 'status' },
  'color49__1': { target: 'status_heizung', type: 'status' },
  'color_mkn5z0hs': { target: 'status_fliesen', type: 'status' },
  'color_mkkh8me7': { target: 'status_putz', type: 'status' },
  'color_mkkhmrtf': { target: 'status_kuechenmontage', type: 'status' },
  'color_mkkhz1a9': { target: 'status_rolladen', type: 'status' },
  'color_mkmn2d3v': { target: 'status_fenster', type: 'status' },
  'color_mkmn41pw': { target: 'status_brandschutz', type: 'status' },

  // === Ausführungsarten ===
  'color590__1': { target: 'ausfuehrung_elektrik', type: 'status' },
  'status23__1': { target: 'ausfuehrung_sanitaer', type: 'status' },
  'dup__of_gastherme__1': { target: 'ausfuehrung_bad', type: 'status' },
  'color_mkmnt1kd': { target: 'ausfuehrung_kueche', type: 'status' },
  'color_mkmnkrmf': { target: 'ausfuehrung_flur', type: 'status' },
  'color_mkmnn1kc': { target: 'ausfuehrung_wohnzimmer', type: 'status' },

  // === Status-Felder ===
  'status__1': { target: 'status_vorabfrage', type: 'status' },
  'color0__1': { target: 'status_abschlag', type: 'status' },
  'color2__1': { target: 'status_schlussrechnung', type: 'status' },
  'color6__1': { target: 'status_nachtraege', type: 'status' },
  'color7__1': { target: 'status_maengel', type: 'status' },
  'color4__1': { target: 'status_nua', type: 'status' },
  'color9__1': { target: 'status_abnahme', type: 'status' },

  // === Zahlen/Mengen ===
  'numeric__1': { target: 'anzahl_zimmer', type: 'number' },
  'zahlen2__1': { target: 'anzahl_zimmer', type: 'number' }, // Alternative
  'zahlen4__1': { target: 'wohnflaeche', type: 'number' },
  'zahlen5__1': { target: 'anzahl_nachtraege', type: 'number' },
  'zahlen6__1': { target: 'summe_nachtraege', type: 'number' },
  'zahlen7__1': { target: 'anzahl_maengel_offen', type: 'number' },

  // === Links ===
  'link__1': { target: 'hero_link', type: 'link' },
  'link_mkn32ss7': { target: 'sharepoint_link', type: 'link' },
  'link_mkn3a98q': { target: 'matterport_link', type: 'link' },
  'link_mkn3aemx': { target: 'onedrive_link', type: 'link' },
  'link_mkn3pnqa': { target: 'angebot_link', type: 'link' },
  'link_mkn3rkcq': { target: 'ab_link', type: 'link' },
  'link_mkn8k6sr': { target: 'nua_link', type: 'link' },
  'link_mknhrdg0': { target: 'bautagebuch_link', type: 'link' },

  // === Dateien ===
  'datei1__1': { target: 'datei_angebot', type: 'file' },
  'datei2__1': { target: 'datei_ab', type: 'file' },
  'datei_mkkd1j0f': { target: 'datei_bedarfsanalyse', type: 'file' },
  'datei_mkkg3whb': { target: 'datei_aufmass', type: 'file' },
  'datei_mkkgvsec': { target: 'datei_lv', type: 'file' },
  'datei_mkn5ac8z': { target: 'datei_nua', type: 'file' },
  'datei_mkknjx28': { target: 'datei_schlussrechnung', type: 'file' },

  // === Fortschritt ===
  'fortschritt__1': { target: 'fortschritt_gesamt', type: 'number' },
  'fortschritt6__1': { target: 'fortschritt_elektrik', type: 'number' },
  'fortschritt8__1': { target: 'fortschritt_sanitaer', type: 'number' },
  'fortschritt_2__1': { target: 'fortschritt_maler', type: 'number' },

  // === Sonstiges ===
  'text27__1': { target: 'bemerkungen', type: 'text' },
  'text71__1': { target: 'notizen', type: 'text' },
  'long_text_mkkz5xzc': { target: 'notizen', type: 'text' },
};

// ============================================
// Value Extraction Helpers
// ============================================

/**
 * Extrahiert den Text-Wert aus einem Monday Column-Objekt
 * Status-Spalten haben verschachtelte Struktur: {text: "...", value: "{\"index\":...}"}
 */
function extractTextValue(colValue: any): string | null {
  if (!colValue) return null;

  // Direkt String
  if (typeof colValue === 'string') return colValue || null;

  // Object mit text
  if (typeof colValue === 'object') {
    // Für Status: text enthält den lesbaren Wert
    if (colValue.text && colValue.text !== 'null') return colValue.text;

    // Für einfache Texte: value kann JSON-String sein
    if (colValue.value) {
      try {
        const parsed = JSON.parse(colValue.value);
        // Wenn es ein einfacher String ist
        if (typeof parsed === 'string') return parsed;
        // Wenn es ein Object mit label ist (Status)
        if (parsed.label) return parsed.label;
      } catch {
        // Nicht JSON, direkt verwenden
        return colValue.value;
      }
    }
  }

  return null;
}

/**
 * Extrahiert Nummer aus Monday Column-Objekt
 */
function extractNumberValue(colValue: any): number | null {
  const text = extractTextValue(colValue);
  if (!text) return null;

  const num = parseFloat(text);
  return isNaN(num) ? null : num;
}

/**
 * Extrahiert Datum aus Monday Column-Objekt
 * Format: "YYYY-MM-DD" oder ISO-String
 */
function extractDateValue(colValue: any): string | null {
  const text = extractTextValue(colValue);
  if (!text) return null;

  // Bereits im richtigen Format
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // ISO-String parsen
  try {
    const date = new Date(text);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignorieren
  }

  return null;
}

/**
 * Extrahiert E-Mail aus Monday Column-Objekt
 */
function extractEmailValue(colValue: any): string | null {
  if (!colValue) return null;

  if (typeof colValue === 'object') {
    // email-Feld in value-JSON
    if (colValue.value) {
      try {
        const parsed = JSON.parse(colValue.value);
        if (parsed.email) return parsed.email;
      } catch {
        // Ignorieren
      }
    }
    if (colValue.text) return colValue.text;
  }

  return extractTextValue(colValue);
}

/**
 * Extrahiert Link-URL aus Monday Column-Objekt
 */
function extractLinkValue(colValue: any): string | null {
  if (!colValue) return null;

  if (typeof colValue === 'object') {
    if (colValue.value) {
      try {
        const parsed = JSON.parse(colValue.value);
        if (parsed.url) return parsed.url;
      } catch {
        // Ignorieren
      }
    }
    // text kann "Label - URL" Format haben
    if (colValue.text) {
      const urlMatch = colValue.text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) return urlMatch[0];
    }
  }

  return null;
}

/**
 * Extrahiert File-URL aus Monday Column-Objekt
 */
function extractFileValue(colValue: any): string | null {
  if (!colValue) return null;

  if (typeof colValue === 'object') {
    // text enthält direkt die URL
    if (colValue.text && colValue.text.startsWith('http')) {
      return colValue.text;
    }

    // value kann files-Array enthalten
    if (colValue.value) {
      try {
        const parsed = JSON.parse(colValue.value);
        if (parsed.files && parsed.files.length > 0) {
          // Erste Datei nehmen
          return `https://neurealis.monday.com/protected_static/23933403/resources/${parsed.files[0].assetId}/${parsed.files[0].name}`;
        }
      } catch {
        // Ignorieren
      }
    }
  }

  return null;
}

/**
 * Extrahiert Location/Adresse aus Monday Column-Objekt
 */
function extractLocationValue(colValue: any): string | null {
  if (!colValue) return null;

  if (typeof colValue === 'object') {
    // text enthält lesbare Adresse
    if (colValue.text) return colValue.text;

    if (colValue.value) {
      try {
        const parsed = JSON.parse(colValue.value);
        if (parsed.address) return parsed.address;
      } catch {
        // Ignorieren
      }
    }
  }

  return extractTextValue(colValue);
}

// ============================================
// Monday API Functions
// ============================================

async function fetchMondayItems(): Promise<MondayItem[]> {
  const allItems: MondayItem[] = [];
  let cursor: string | null = null;

  while (true) {
    const query = cursor
      ? `query { next_items_page(cursor: "${cursor}", limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } }`
      : `query { boards(ids: ${BOARD_ID}) { items_page(limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } } }`;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2024-10'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Monday API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Monday GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    let items: MondayItem[];
    let newCursor: string | null;

    if (cursor) {
      items = result.data?.next_items_page?.items || [];
      newCursor = result.data?.next_items_page?.cursor || null;
    } else {
      items = result.data?.boards?.[0]?.items_page?.items || [];
      newCursor = result.data?.boards?.[0]?.items_page?.cursor || null;
    }

    allItems.push(...items);

    if (!newCursor || items.length === 0) break;
    cursor = newCursor;
  }

  return allItems;
}

// ============================================
// Sync Logic
// ============================================

async function syncItems(items: MondayItem[]) {
  let created = 0, updated = 0, errors = 0;
  const errorDetails: string[] = [];

  for (const item of items) {
    try {
      // Konvertiere column_values Array zu Object
      const columnValuesObj: Record<string, any> = {};
      for (const col of item.column_values) {
        columnValuesObj[col.id] = { text: col.text, value: col.value };
      }

      // Basis-Record mit column_values JSONB (für Abwärtskompatibilität)
      const record: Record<string, any> = {
        id: item.id,
        name: item.name,
        board_id: BOARD_ID,
        group_id: item.group.id,
        group_title: item.group.title,
        column_values: columnValuesObj,
        created_at: item.created_at,
        updated_at: item.updated_at,
        monday_synced_at: new Date().toISOString(),
        sync_status: 'synced',
        sync_source: 'monday', // WICHTIG: Loop-Vermeidung!
      };

      // Mappe alle konfigurierten Spalten auf dedizierte Felder
      const mappedValues: Record<string, Set<string>> = {}; // Tracking für Duplikate

      for (const [mondayCol, config] of Object.entries(COLUMN_MAPPING)) {
        const colValue = columnValuesObj[mondayCol];
        if (!colValue) continue;

        let extractedValue: any = null;

        switch (config.type) {
          case 'text':
          case 'status':
            extractedValue = extractTextValue(colValue);
            break;
          case 'number':
            extractedValue = extractNumberValue(colValue);
            break;
          case 'date':
            extractedValue = extractDateValue(colValue);
            break;
          case 'email':
            extractedValue = extractEmailValue(colValue);
            break;
          case 'link':
            extractedValue = extractLinkValue(colValue);
            break;
          case 'file':
            extractedValue = extractFileValue(colValue);
            break;
          case 'phone':
            extractedValue = extractTextValue(colValue);
            break;
          case 'location':
            extractedValue = extractLocationValue(colValue);
            break;
        }

        // Nur setzen wenn Wert existiert
        if (extractedValue !== null && extractedValue !== undefined && extractedValue !== '') {
          // Bei mehreren Quellen für gleiches Ziel: Erster gewinnt (außer leer)
          if (!mappedValues[config.target]) {
            mappedValues[config.target] = new Set();
          }

          if (!record[config.target] || record[config.target] === null) {
            record[config.target] = extractedValue;
            mappedValues[config.target].add(mondayCol);
          }
        }
      }

      // Prüfen ob Item existiert
      const { data: existing } = await supabase
        .from('monday_bauprozess')
        .select('id, sync_source, last_supabase_change_at, last_monday_push_at')
        .eq('id', item.id)
        .single();

      if (existing) {
        // Loop-Vermeidung: Nicht überschreiben wenn kürzlich von Supabase geändert
        // und noch nicht nach Monday gepusht
        if (existing.sync_source === 'supabase' &&
            existing.last_supabase_change_at &&
            (!existing.last_monday_push_at ||
             new Date(existing.last_supabase_change_at) > new Date(existing.last_monday_push_at))) {
          // Skip - lokale Änderungen haben Vorrang bis gepusht
          console.log(`Skip update for ${item.id}: pending Supabase changes`);
          continue;
        }

        await supabase.from('monday_bauprozess').update(record).eq('id', item.id);
        updated++;
      } else {
        await supabase.from('monday_bauprozess').insert(record);
        created++;
      }
    } catch (err) {
      errors++;
      errorDetails.push(`Item ${item.id}: ${String(err)}`);
      console.error(`Error syncing item ${item.id}:`, err);
    }
  }

  return { created, updated, errors, errorDetails };
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    console.log('monday-sync v2 starting...');

    const items = await fetchMondayItems();
    console.log(`Fetched ${items.length} items from Monday`);

    const { created, updated, errors, errorDetails } = await syncItems(items);
    console.log(`Sync complete: ${created} created, ${updated} updated, ${errors} errors`);

    // Log in monday_sync_log
    await supabase.from('monday_sync_log').insert({
      board_id: BOARD_ID,
      items_synced: items.length,
      items_created: created,
      items_updated: updated,
      errors: errors,
      error_details: errorDetails.slice(0, 10), // Max 10 Fehler loggen
      completed_at: new Date().toISOString()
    });

    // Gruppierung für Response
    const groups: Record<string, number> = {};
    for (const item of items) {
      const key = `${item.group.id}: ${item.group.title}`;
      groups[key] = (groups[key] || 0) + 1;
    }

    return new Response(JSON.stringify({
      success: true,
      version: 'v2',
      board_id: BOARD_ID,
      total_items: items.length,
      created,
      updated,
      errors,
      error_details: errors > 0 ? errorDetails.slice(0, 5) : undefined,
      groups,
      mapped_columns: Object.keys(COLUMN_MAPPING).length,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('monday-sync v2 error:', error);
    return new Response(JSON.stringify({
      success: false,
      version: 'v2',
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
