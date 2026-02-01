import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * monday-push v1 - Push Supabase-Änderungen zu Monday.com
 *
 * Features:
 * - Liest Items mit sync_status = 'pending_push' ODER last_supabase_change_at > last_monday_push_at
 * - Nur Items mit sync_source != 'monday' pushen (Loop-Vermeidung!)
 * - Monday GraphQL Mutation: change_multiple_column_values
 * - Nach erfolgreichem Push: last_monday_push_at = NOW(), sync_status = 'synced'
 * - Error-Handling: push_error_count inkrementieren bei Fehlern
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
// Reverse Column Mapping (Supabase → Monday)
// ============================================

/**
 * Mapping von Supabase-Spaltennamen auf Monday-Spalten-IDs
 * NUR die wichtigsten Felder die bidirektional sync werden sollen
 */
const REVERSE_COLUMN_MAPPING: Record<string, { monday_col: string; type: 'text' | 'number' | 'date' | 'status' | 'email' | 'link' }> = {
  // === Identifikation ===
  'atbs_nummer': { monday_col: 'text49__1', type: 'text' },
  'status_projekt': { monday_col: 'status06__1', type: 'status' },
  'auftraggeber': { monday_col: 'text_mkm11jca', type: 'text' },
  'projektname_komplett': { monday_col: 'text_mkn18mxg', type: 'text' },

  // === Adressen ===
  'adresse': { monday_col: 'text51__1', type: 'text' },

  // === Personen ===
  'bauleiter': { monday_col: 'text_mkn8ggev', type: 'text' },
  'nachunternehmer': { monday_col: 'text57__1', type: 'text' },
  'ansprechpartner': { monday_col: 'text573__1', type: 'text' },

  // === Budget & Finanzen ===
  'budget': { monday_col: 'zahlen1__1', type: 'number' },
  'nua_netto': { monday_col: 'numeric65__1', type: 'number' },

  // === Termine ===
  'baustart': { monday_col: 'datum2__1', type: 'date' },
  'bauende': { monday_col: 'datum7__1', type: 'date' },
  'datum_erstbegehung': { monday_col: 'datum0__1', type: 'date' },
  'datum_endbegehung': { monday_col: 'datum1__1', type: 'date' },
  'datum_auszug': { monday_col: 'datum_mkkz2c8r', type: 'date' },
  'datum_uebergabe': { monday_col: 'datum_mkm1m451', type: 'date' },
  'datum_kundenabnahme': { monday_col: 'datum_mkm7qwag', type: 'date' },

  // === Gewerk-Status (bidirektional wichtig!) ===
  'status_elektrik': { monday_col: 'color_mkkh1mw9', type: 'status' },
  'status_sanitaer': { monday_col: 'color_mkkh7fp6', type: 'status' },
  'status_maler': { monday_col: 'color427__1', type: 'status' },
  'status_boden': { monday_col: 'color78__1', type: 'status' },
  'status_tischler': { monday_col: 'color97__1', type: 'status' },
  'status_abbruch': { monday_col: 'dup__of_entkernung__1', type: 'status' },
  'status_heizung': { monday_col: 'color49__1', type: 'status' },
  'status_fliesen': { monday_col: 'color_mkn5z0hs', type: 'status' },

  // === Zahlen ===
  'anzahl_zimmer': { monday_col: 'numeric__1', type: 'number' },
  'wohnflaeche': { monday_col: 'zahlen4__1', type: 'number' },

  // === Links ===
  'hero_link': { monday_col: 'link__1', type: 'link' },
  'sharepoint_link': { monday_col: 'link_mkn32ss7', type: 'link' },
  'matterport_link': { monday_col: 'link_mkn3a98q', type: 'link' },

  // === Sonstiges ===
  'bemerkungen': { monday_col: 'text27__1', type: 'text' },
  'notizen': { monday_col: 'text71__1', type: 'text' },
};

// ============================================
// Status Label Mapping (Supabase Text → Monday Label)
// ============================================

/**
 * Mapping von Status-Text zu Monday-Status-Labels
 * Monday erwartet exakte Label-Namen
 */
const STATUS_LABEL_MAPPING: Record<string, Record<string, string>> = {
  // Projekt-Status (status06__1)
  'status_projekt': {
    '(0) Lead': '(0) Lead',
    '(1) Anfrage erhalten': '(1) Anfrage erhalten',
    '(2) Terminiert': '(2) Terminiert',
    '(3) Vorbereitung': '(3) Vorbereitung',
    '(4) Umsetzung': '(4) Umsetzung',
    '(5) Abgenommen': '(5) Abgenommen',
    '(6) Abgeschlossen': '(6) Abgeschlossen',
    '(7) Gewährleistung': '(7) Gewährleistung',
    '(8) Pausiert': '(8) Pausiert',
    '(9) Auftrag nicht erhalten': '(9) Auftrag nicht erhalten',
  },

  // Gewerk-Status (allgemein)
  '_gewerk': {
    'Geplant': 'Geplant',
    'In Arbeit': 'In Arbeit',
    'Fertig': 'Fertig',
    'Verspätet': 'Verspätet',
    'Offen': 'Offen',
    'Keine': 'Keine',
    // Spezial-Status
    'Fertig (Feininstallation)': 'Fertig (Feininstallation)',
    'In Arbeit (Schlitze & Rohinstallation)': 'In Arbeit (Schlitze & Rohinstallation)',
    'In Arbeit (Rohinstallation)': 'In Arbeit (Rohinstallation)',
  },
};

// ============================================
// Value Formatting for Monday API
// ============================================

/**
 * Formatiert einen Wert für die Monday API
 * Gibt den column_values JSON-String zurück
 */
function formatValueForMonday(
  supabaseCol: string,
  value: any,
  config: { monday_col: string; type: string }
): Record<string, any> | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (config.type) {
    case 'text':
      return { [config.monday_col]: String(value) };

    case 'number':
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return null;
      return { [config.monday_col]: String(num) };

    case 'date':
      // Monday erwartet: { "date": "2026-02-01" }
      let dateStr = value;
      if (value instanceof Date) {
        dateStr = value.toISOString().split('T')[0];
      } else if (typeof value === 'string' && value.includes('T')) {
        dateStr = value.split('T')[0];
      }
      return { [config.monday_col]: { date: dateStr } };

    case 'status':
      // Monday erwartet: { "label": "Status Name" }
      // Lookup im Mapping oder direkt verwenden
      const mapping = STATUS_LABEL_MAPPING[supabaseCol] || STATUS_LABEL_MAPPING['_gewerk'];
      const label = mapping?.[value] || value;
      return { [config.monday_col]: { label } };

    case 'email':
      return { [config.monday_col]: { email: String(value), text: String(value) } };

    case 'link':
      return { [config.monday_col]: { url: String(value), text: 'Link' } };

    default:
      return { [config.monday_col]: String(value) };
  }
}

// ============================================
// Monday API Functions
// ============================================

/**
 * Pusht Änderungen zu einem Monday Item
 */
async function pushToMondayItem(
  itemId: string,
  columnValues: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Konvertiere zu Monday column_values JSON
    const columnValuesJson = JSON.stringify(columnValues);

    const mutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_ID},
          item_id: "${itemId}",
          column_values: ${JSON.stringify(columnValuesJson)}
        ) {
          id
          name
        }
      }
    `;

    console.log(`Pushing to Monday item ${itemId}:`, columnValuesJson);

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2024-10'
      },
      body: JSON.stringify({ query: mutation })
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
    }

    const result = await response.json();

    if (result.errors) {
      return { success: false, error: JSON.stringify(result.errors) };
    }

    console.log(`Successfully pushed to Monday item ${itemId}`);
    return { success: true };

  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// Main Push Logic
// ============================================

interface SupabaseItem {
  id: string;
  sync_status: string | null;
  sync_source: string | null;
  last_supabase_change_at: string | null;
  last_monday_push_at: string | null;
  push_error_count: number | null;
  [key: string]: any;
}

async function findItemsToPush(): Promise<SupabaseItem[]> {
  // Finde Items die gepusht werden müssen:
  // 1. sync_status = 'pending_push' ODER
  // 2. last_supabase_change_at > last_monday_push_at
  // UND sync_source != 'monday' (Loop-Vermeidung!)

  const { data, error } = await supabase
    .from('monday_bauprozess')
    .select('*')
    .or('sync_status.eq.pending_push,last_supabase_change_at.gt.last_monday_push_at')
    .neq('sync_source', 'monday')
    .limit(50); // Max 50 pro Durchlauf

  if (error) {
    console.error('Error fetching items to push:', error);
    return [];
  }

  // Filter nochmal für last_supabase_change_at > last_monday_push_at
  // (Supabase OR mit GT auf zwei Spalten ist tricky)
  return (data || []).filter((item: SupabaseItem) => {
    if (item.sync_status === 'pending_push') return true;

    if (item.last_supabase_change_at) {
      if (!item.last_monday_push_at) return true;
      return new Date(item.last_supabase_change_at) > new Date(item.last_monday_push_at);
    }

    return false;
  });
}

async function processItemForPush(item: SupabaseItem): Promise<{
  success: boolean;
  pushed_columns: number;
  error?: string;
}> {
  // Sammle alle geänderten Spalten
  const columnValues: Record<string, any> = {};
  let pushedColumns = 0;

  for (const [supabaseCol, config] of Object.entries(REVERSE_COLUMN_MAPPING)) {
    const value = item[supabaseCol];

    // Nur nicht-leere Werte pushen
    if (value === null || value === undefined || value === '') continue;

    const formatted = formatValueForMonday(supabaseCol, value, config);
    if (formatted) {
      Object.assign(columnValues, formatted);
      pushedColumns++;
    }
  }

  if (pushedColumns === 0) {
    console.log(`Item ${item.id}: No columns to push`);
    return { success: true, pushed_columns: 0 };
  }

  // Push zu Monday
  const result = await pushToMondayItem(item.id, columnValues);

  if (result.success) {
    // Update Supabase: last_monday_push_at, sync_status, reset error count
    await supabase
      .from('monday_bauprozess')
      .update({
        last_monday_push_at: new Date().toISOString(),
        sync_status: 'synced',
        push_error_count: 0,
      })
      .eq('id', item.id);

    return { success: true, pushed_columns: pushedColumns };
  } else {
    // Inkrementiere error count
    const newErrorCount = (item.push_error_count || 0) + 1;

    await supabase
      .from('monday_bauprozess')
      .update({
        push_error_count: newErrorCount,
        sync_status: newErrorCount >= 3 ? 'push_failed' : 'pending_push',
      })
      .eq('id', item.id);

    return { success: false, pushed_columns: 0, error: result.error };
  }
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    console.log('monday-push v1 starting...');

    // Optionaler Parameter: force_item_id für einzelnes Item
    let forceItemId: string | null = null;
    try {
      const body = await req.json();
      forceItemId = body.item_id || null;
    } catch {
      // Kein JSON Body, ok
    }

    let itemsToPush: SupabaseItem[];

    if (forceItemId) {
      // Einzelnes Item pushen (z.B. von Trigger)
      const { data } = await supabase
        .from('monday_bauprozess')
        .select('*')
        .eq('id', forceItemId)
        .single();

      itemsToPush = data ? [data] : [];
    } else {
      // Alle pending Items finden
      itemsToPush = await findItemsToPush();
    }

    console.log(`Found ${itemsToPush.length} items to push`);

    if (itemsToPush.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        version: 'v1',
        message: 'No items to push',
        items_checked: 0,
        items_pushed: 0,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verarbeite alle Items
    let pushed = 0, failed = 0, skipped = 0;
    const errors: string[] = [];

    for (const item of itemsToPush) {
      const result = await processItemForPush(item);

      if (result.success) {
        if (result.pushed_columns > 0) {
          pushed++;
        } else {
          skipped++;
        }
      } else {
        failed++;
        if (result.error) {
          errors.push(`Item ${item.id}: ${result.error}`);
        }
      }
    }

    // Log in monday_sync_log
    await supabase.from('monday_sync_log').insert({
      board_id: BOARD_ID,
      sync_direction: 'push',
      items_synced: itemsToPush.length,
      items_created: 0,
      items_updated: pushed,
      errors: failed,
      error_details: errors.slice(0, 10),
      completed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      version: 'v1',
      board_id: BOARD_ID,
      items_checked: itemsToPush.length,
      items_pushed: pushed,
      items_skipped: skipped,
      items_failed: failed,
      errors: failed > 0 ? errors.slice(0, 5) : undefined,
      mapped_columns: Object.keys(REVERSE_COLUMN_MAPPING).length,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('monday-push v1 error:', error);
    return new Response(JSON.stringify({
      success: false,
      version: 'v1',
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
