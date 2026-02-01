import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * monday-label-sync v1 - Lädt alle Status-Labels von Monday.com
 *
 * Features:
 * - Lädt Board-Schema mit allen Spalten
 * - Extrahiert Labels aus Status/Color-Spalten
 * - Bulk-Upsert in monday_label_mapping
 * - Unterstützt ~64 Status/Color-Spalten
 *
 * Board-ID: 1545426536 (Bauprozess)
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY')!;
const BOARD_ID = '1545426536';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface MondayLabel {
  column_id: string;
  column_title: string;
  label_index: number;
  label_text: string;
  label_color: string;
}

/**
 * Lädt das Board-Schema von Monday.com
 */
async function fetchBoardSchema(): Promise<any> {
  const query = `
    query {
      boards(ids: ${BOARD_ID}) {
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;

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
    throw new Error(`Monday API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Monday GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  return result.data?.boards?.[0]?.columns || [];
}

/**
 * Extrahiert Labels aus Status/Color-Spalten
 */
function extractLabels(columns: any[]): MondayLabel[] {
  const labels: MondayLabel[] = [];

  for (const column of columns) {
    // Nur Status und Color Spalten haben Labels
    if (column.type !== 'color' && column.type !== 'status') {
      continue;
    }

    try {
      const settings = JSON.parse(column.settings_str || '{}');
      const columnLabels = settings.labels || {};

      // Labels sind als { "0": "Label1", "1": "Label2", ... } gespeichert
      for (const [indexStr, labelText] of Object.entries(columnLabels)) {
        if (typeof labelText !== 'string') continue;

        const labelIndex = parseInt(indexStr, 10);
        if (isNaN(labelIndex)) continue;

        // Farbe aus labels_colors wenn vorhanden
        let labelColor = 'grey';
        if (settings.labels_colors && settings.labels_colors[indexStr]) {
          labelColor = settings.labels_colors[indexStr].color || 'grey';
        }

        labels.push({
          column_id: column.id,
          column_title: column.title,
          label_index: labelIndex,
          label_text: labelText,
          label_color: labelColor
        });
      }
    } catch (e) {
      console.warn(`Failed to parse settings for column ${column.id}:`, e);
    }
  }

  return labels;
}

/**
 * Speichert Labels in Supabase
 */
async function upsertLabels(labels: MondayLabel[]): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0, updated = 0, errors = 0;

  // Batch-Upsert in Chunks von 100
  const chunkSize = 100;
  for (let i = 0; i < labels.length; i += chunkSize) {
    const chunk = labels.slice(i, i + chunkSize);

    const records = chunk.map(label => ({
      column_id: label.column_id,
      column_title: label.column_title,
      label_index: label.label_index,
      label_text: label.label_text,
      label_color: label.label_color,
      supabase_value: label.label_text, // Default: gleicher Wert
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('monday_label_mapping')
      .upsert(records, {
        onConflict: 'column_id,label_index',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`Error upserting chunk ${i}:`, error);
      errors += chunk.length;
    } else {
      // Alle in diesem Chunk sind inserted/updated
      inserted += data?.length || 0;
    }
  }

  return { inserted, updated, errors };
}

// Main Handler
Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    console.log('monday-label-sync v1 starting...');

    // 1. Board-Schema laden
    console.log('Fetching board schema...');
    const columns = await fetchBoardSchema();
    console.log(`Found ${columns.length} columns in board`);

    // Zähle Status/Color Spalten
    const statusColorColumns = columns.filter(
      (c: any) => c.type === 'color' || c.type === 'status'
    );
    console.log(`Found ${statusColorColumns.length} status/color columns`);

    // 2. Labels extrahieren
    console.log('Extracting labels...');
    const labels = extractLabels(columns);
    console.log(`Extracted ${labels.length} labels total`);

    if (labels.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        version: 'v1',
        message: 'No labels found in board schema',
        columns_checked: columns.length,
        status_color_columns: statusColorColumns.length,
        labels_found: 0,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. In Supabase speichern
    console.log('Upserting labels to Supabase...');
    const result = await upsertLabels(labels);

    // 4. Statistiken pro Spalte
    const columnStats: Record<string, { title: string; count: number }> = {};
    for (const label of labels) {
      if (!columnStats[label.column_id]) {
        columnStats[label.column_id] = { title: label.column_title, count: 0 };
      }
      columnStats[label.column_id].count++;
    }

    console.log('monday-label-sync v1 completed');

    return new Response(JSON.stringify({
      success: true,
      version: 'v1',
      board_id: BOARD_ID,
      columns_checked: columns.length,
      status_color_columns: statusColorColumns.length,
      labels_found: labels.length,
      labels_inserted: result.inserted,
      labels_errors: result.errors,
      column_stats: columnStats,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('monday-label-sync v1 error:', error);
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
