import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = Deno.env.get('SOFTR_DATABASE_ID') || 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Table mapping: Softr table ID -> Supabase table name
const TABLE_MAPPING: Record<string, string> = {
  'baeVoaT73WSuFr': 'protokolle_abnahmen',
  'J563LaZ43bZSQy': 'maengel_fertigstellung',
  'RJGAYKFdDDxosc': 'softr_aufgaben',
  'kNjsEhYYcNjAsj': 'softr_dokumente',
  'XXJFvICfFvbXkY': 'konto_transaktionen',
  'VzvQUdlHStrRtN': 'softr_kontakte',
  '0xZkAxDadNyOMI': 'ausfuehrungsmaengel',
  'bLgAqseB1AgVeu': 'einzelgewerke',
  'bl0tRF2R7aMLYC': 'personal_bewerber',
  'gGcyZx01A4bDuH': 'logs_vapi',
  'ORCDcA1wFrCzu2': 'softr_angebotserstellung',
  'va3BbWTn101BXJ': 'softr_leads',
  'xvtJVrb2An6wwl': 'inventar',
  'trBGeNEBfm2Jf7': 'projekt_umsatz'
};

// Reverse mapping for push operations
const REVERSE_TABLE_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(TABLE_MAPPING).map(([k, v]) => [v, k])
);

// Field mappings: Supabase column -> Softr field ID (for push)
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  'konto_transaktionen': {
    'transaktions_uid': 'QblUD',
    'buchungsdatum': '6b4XF',
    'verwendungszweck': 'N3HtC',
    'betrag': 'VTmwO',
    'waehrungscode': 't6ybB',
    'kontoname': 'LVqOI',
    'transaktionsstatus': '11kT1',
    'glaeubiger_id': 'iI47E',
    'zahlungspartner_name': 'fTiZI',
    'ki_notizen': 'GBdNE',
    'rohdaten_json': '1TGLx',
    'atbs_nr': 'YfcGr',
    're_nr': '7J0YZ',
    're_nr_zahl': '4CNE4',
    'nua_nr': 'RXGvn'
  }
};

// ============== PULL: Softr -> Supabase ==============

async function fetchSoftrRecords(tableId: string, offset = 0, limit = 100): Promise<{records: any[], total: number}> {
  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${tableId}/records?offset=${offset}&limit=${limit}`,
    {
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Softr API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    records: data.data || [],
    total: data.metadata?.total || 0
  };
}

function toSnakeCase(str: string): string {
  return str
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/([A-Z])/g, '_$1')
    .replace(/[\s\-\/\\]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

async function pullFromSoftr(softrTableId: string, supabaseTableName: string) {
  let processed = 0, created = 0, updated = 0, failed = 0;
  let offset = 0;
  const limit = 100;
  const errors: string[] = [];

  // Get field mapping from softr_sync_config
  const { data: configData } = await supabase
    .from('softr_sync_config')
    .select('field_mapping')
    .eq('softr_table_id', softrTableId)
    .single();

  const fieldMapping: Record<string, string> = configData?.field_mapping || {};
  const hasFieldMapping = Object.keys(fieldMapping).length > 0;

  while (true) {
    const { records } = await fetchSoftrRecords(softrTableId, offset, limit);
    if (records.length === 0) break;

    for (const record of records) {
      try {
        const softrRecordId = record.id;
        const fields = record.fields || {};

        const convertedFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(fields)) {
          // Use field mapping if available, otherwise use snake_case conversion
          const supabaseCol = hasFieldMapping ? fieldMapping[key] : toSnakeCase(key);
          if (supabaseCol) {
            // Extract label from Softr SELECT fields (they come as {id, label} objects)
            if (value && typeof value === 'object' && 'label' in value) {
              convertedFields[supabaseCol] = value.label;
            } else {
              convertedFields[supabaseCol] = value;
            }
          }
        }

        convertedFields.softr_record_id = softrRecordId;
        convertedFields.softr_synced_at = new Date().toISOString();

        const { data: existing } = await supabase
          .from(supabaseTableName)
          .select('id')
          .eq('softr_record_id', softrRecordId)
          .single();

        if (existing) {
          const { error: updateErr } = await supabase.from(supabaseTableName).update(convertedFields).eq('softr_record_id', softrRecordId);
          if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
          updated++;
        } else {
          const { error: insertErr } = await supabase.from(supabaseTableName).insert(convertedFields);
          if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
          created++;
        }
        processed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(errMsg);
        failed++;
      }
    }

    offset += records.length;
    if (records.length < limit) break;
  }

  return { processed, created, updated, failed, errors: errors.slice(0, 5) };
}

// ============== PUSH: Supabase -> Softr ==============

async function createSoftrRecord(tableId: string, fields: Record<string, any>): Promise<string | null> {
  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Softr API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.data?.id || null;
}

async function updateSoftrRecord(tableId: string, recordId: string, fields: Record<string, any>): Promise<boolean> {
  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );

  return response.ok;
}

function mapSupabaseToSoftr(supabaseRecord: Record<string, any>, fieldMapping: Record<string, string>): Record<string, any> {
  const softrFields: Record<string, any> = {};

  for (const [supabaseCol, softrFieldId] of Object.entries(fieldMapping)) {
    const value = supabaseRecord[supabaseCol];
    if (value !== null && value !== undefined) {
      // Handle date fields
      if (supabaseCol === 'buchungsdatum' && value) {
        softrFields[softrFieldId] = new Date(value).toISOString();
      }
      // Handle number fields
      else if (supabaseCol === 'transaktions_uid' && value) {
        softrFields[softrFieldId] = parseInt(value);
      }
      else if (supabaseCol === 'betrag' && value) {
        softrFields[softrFieldId] = parseFloat(value);
      }
      // Handle text fields - truncate if too long
      else if (typeof value === 'string' && value.length > 500) {
        softrFields[softrFieldId] = value.substring(0, 500);
      }
      else {
        softrFields[softrFieldId] = value;
      }
    }
  }

  return softrFields;
}

// Direct Postgres connection for push operations
const DATABASE_URL = Deno.env.get('DATABASE_URL') ||
  `postgresql://postgres.mfpuijttdgkllnvhvjlu:${Deno.env.get('DB_PASSWORD') || ''}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function fetchTransactionsForPush(mode: 'new' | 'all'): Promise<any[]> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const condition = mode === 'new' ? 'WHERE softr_record_id IS NULL' : '';
    const records = await sql.unsafe(`
      SELECT id, transaktions_uid, buchungsdatum, verwendungszweck, betrag,
             waehrungscode, kontoname, transaktionsstatus, glaeubiger_id,
             zahlungspartner_name, ki_notizen, atbs_nr, re_nr, re_nr_zahl,
             nua_nr, softr_record_id
      FROM konto_transaktionen
      ${condition}
      LIMIT 500
    `);
    return records;
  } finally {
    await sql.end();
  }
}

async function updateTransactionSoftrSync(id: string, softrRecordId: string | null): Promise<boolean> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    if (softrRecordId) {
      await sql.unsafe(`
        UPDATE konto_transaktionen
        SET softr_record_id = $1, softr_synced_at = NOW()
        WHERE id = $2
      `, [softrRecordId, id]);
    } else {
      await sql.unsafe(`
        UPDATE konto_transaktionen
        SET softr_synced_at = NOW()
        WHERE id = $1
      `, [id]);
    }
    return true;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
}

async function pushToSoftr(supabaseTableName: string, softrTableId: string, mode: 'new' | 'all' = 'new') {
  let processed = 0, created = 0, updated = 0, failed = 0;
  const errors: string[] = [];

  const fieldMapping = FIELD_MAPPINGS[supabaseTableName];
  if (!fieldMapping) {
    return { processed: 0, created: 0, updated: 0, failed: 0, error: `No field mapping for ${supabaseTableName}` };
  }

  // Only konto_transaktionen is supported for push via RPC
  if (supabaseTableName !== 'konto_transaktionen') {
    return { processed: 0, created: 0, updated: 0, failed: 0, error: `Push not yet implemented for ${supabaseTableName}` };
  }

  // Fetch records to push via RPC function
  let records: any[];
  try {
    records = await fetchTransactionsForPush(mode);
  } catch (err) {
    return { processed: 0, created: 0, updated: 0, failed: 0, error: String(err) };
  }

  if (!records || records.length === 0) {
    return { processed: 0, created: 0, updated: 0, failed: 0, message: 'No records to push' };
  }

  for (const record of records) {
    try {
      const softrFields = mapSupabaseToSoftr(record, fieldMapping);

      if (record.softr_record_id) {
        // Update existing record
        const success = await updateSoftrRecord(softrTableId, record.softr_record_id, softrFields);
        if (success) {
          await updateTransactionSoftrSync(record.id, null);
          updated++;
        } else {
          failed++;
        }
      } else {
        // Create new record
        const newSoftrId = await createSoftrRecord(softrTableId, softrFields);
        if (newSoftrId) {
          await updateTransactionSoftrSync(record.id, newSoftrId);
          created++;
        } else {
          failed++;
        }
      }
      processed++;

      // Rate limiting: 50ms between requests
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      failed++;
      errors.push(`Record ${record.id}: ${String(err)}`);
    }
  }

  return { processed, created, updated, failed, errors: errors.length > 0 ? errors.slice(0, 10) : undefined };
}

// ============== HTTP Handler ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const tableFilter = url.searchParams.get('table');
    const direction = url.searchParams.get('direction') || 'pull';
    const mode = url.searchParams.get('mode') as 'new' | 'all' || 'new';

    const results: any[] = [];
    let totalProcessed = 0, totalCreated = 0, totalUpdated = 0, totalFailed = 0;

    if (direction === 'pull') {
      // PULL: Softr -> Supabase
      const tablesToSync = tableFilter
        ? { [tableFilter]: TABLE_MAPPING[tableFilter] }
        : TABLE_MAPPING;

      for (const [softrId, supabaseTable] of Object.entries(tablesToSync)) {
        if (!supabaseTable) continue;

        try {
          const result = await pullFromSoftr(softrId, supabaseTable);
          results.push({
            softr_table_id: softrId,
            supabase_table: supabaseTable,
            direction: 'pull',
            ...result
          });
          totalProcessed += result.processed;
          totalCreated += result.created;
          totalUpdated += result.updated;
          totalFailed += result.failed;
        } catch (err) {
          results.push({
            softr_table_id: softrId,
            supabase_table: supabaseTable,
            direction: 'pull',
            error: String(err)
          });
        }
      }
    } else if (direction === 'push') {
      // PUSH: Supabase -> Softr
      const tablesToPush = tableFilter
        ? { [tableFilter]: REVERSE_TABLE_MAPPING[tableFilter] || tableFilter }
        : REVERSE_TABLE_MAPPING;

      for (const [supabaseTable, softrId] of Object.entries(tablesToPush)) {
        if (!softrId || !FIELD_MAPPINGS[supabaseTable]) continue;

        try {
          const result = await pushToSoftr(supabaseTable, softrId, mode);
          results.push({
            supabase_table: supabaseTable,
            softr_table_id: softrId,
            direction: 'push',
            mode,
            ...result
          });
          totalProcessed += result.processed;
          totalCreated += result.created;
          totalUpdated += result.updated;
          totalFailed += result.failed;
        } catch (err) {
          results.push({
            supabase_table: supabaseTable,
            softr_table_id: softrId,
            direction: 'push',
            error: String(err)
          });
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid direction. Use "pull" or "push"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      direction,
      summary: {
        tables_synced: results.length,
        total_processed: totalProcessed,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_failed: totalFailed
      },
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
