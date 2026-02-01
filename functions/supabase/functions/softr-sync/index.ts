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
  'bl0tRF2R7aMLYC': 'bewerber',
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
  },
  'maengel_fertigstellung': {
    'mangel_nr': '1UqYa',
    'datum_meldung': '2la7j',
    'mangel_behoben_datum': '3v0hM',
    'art_des_mangels': '4qiAo',
    'nachunternehmer': '4uDJM',
    'erinnerung_bl_count': '6wh4n',
    'letzte_erinnerung_am': 'DMs3N',
    'projektname_komplett': 'FF4FP',
    'kommentar_nu': 'LQPDA',
    'kunde_email': 'Nv4yH',
    'projekt_nr': 'QEcc2',
    'letzte_erinnerung_bl_am': 'QXYZN',
    'nu_email': 'TFj9o',
    'status_mangel': 'YUT8c',
    'erinnerung_count': 'Z6zHO',
    'datum_frist': 'aGWIf',
    'fotos_mangel': 'aScwq',
    'kunde_name': 'bC4R6',
    'bauleiter': 'ctNAI',
    'kosten': 'jFILZ',
    'kunde_telefon': 'kgCJK',
    'status_mangel_nu': 'mhgIW',
    'beschreibung_mangel': 'ozrIj',
    'nua_nr': 'qxHu4',
    'erinnerung_status': 'w9hbN',
    'fotos_nachweis_nu': 'zBq5l'
  },
  'bewerber': {
    // Stamm-Felder (Supabase-Spalte → Softr-Feld-ID)
    'name': 'qtiHG',
    'email': 'L4Gai',
    'telefon': 'wJsq7',
    'position': 'fzgN8',
    'status': '5XRlb',
    'bewerbung_am': '6NqwI',           // Softr: "Eingang Bewerbung" → Supabase: bewerbung_am
    'beginn_ab': 'S5wp3',
    'gehaltsvorstellung': 'S78Ry',
    'kultur_rating': 'iRw0a',
    'kommunikation_rating': '6nxYX',
    'skills_rating': 'pRRtz',
    'anschreiben': 'uxkU0',
    'email_inhalt': 'lRlel',
    'zusammenfassung': '5YJRl',
    'notizen': '89Log',
    // Neue Felder
    'quelle': '6xMsv',
    'vermittler_name': 'V9R4A',
    'vermittler_aktiv': 'VpuNI',
    'provision_typ': '3N3KS',
    'provision_pauschal': 'lHfxE',
    'provision_prozent': 'LJJr4',
    'berufserfahrung_jahre': 'tm1ME',
    'fuehrerschein': 'RWZAn'
  }
};

// Rating fields that need special handling (Softr returns 0-5, Supabase expects 1-5 or NULL)
const RATING_FIELDS = new Set(['kultur_rating', 'kommunikation_rating', 'skills_rating']);

// Fields that are stored as SELECT in Softr but TEXT in Supabase
const SELECT_FIELDS = new Set(['status', 'quelle', 'provision_typ', 'position']);

// Checkbox/Boolean fields
const CHECKBOX_FIELDS = new Set(['vermittler_aktiv', 'fuehrerschein']);

// Helper: Create inverse field mapping (Softr field ID -> Supabase column)
function getInverseFieldMapping(tableName: string): Record<string, string> {
  const mapping = FIELD_MAPPINGS[tableName];
  if (!mapping) return {};
  return Object.fromEntries(
    Object.entries(mapping).map(([supabaseCol, softrFieldId]) => [softrFieldId, supabaseCol])
  );
}

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

  // Get field mapping from softr_sync_config OR from FIELD_MAPPINGS
  const { data: configData } = await supabase
    .from('softr_sync_config')
    .select('field_mapping')
    .eq('softr_table_id', softrTableId)
    .single();

  // Use inverse of FIELD_MAPPINGS if config not found (Softr field ID -> Supabase column)
  let fieldMapping: Record<string, string> = configData?.field_mapping || {};
  if (Object.keys(fieldMapping).length === 0) {
    fieldMapping = getInverseFieldMapping(supabaseTableName);
  }
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
              convertedFields[supabaseCol] = (value as {label: string}).label;
            }
            // Handle RATING fields (Softr returns number 0-5, Supabase expects 1-5 or NULL)
            // 0 in Softr means "not rated" -> NULL in Supabase
            else if (RATING_FIELDS.has(supabaseCol)) {
              const rating = typeof value === 'number' ? value : (parseInt(String(value)) || 0);
              convertedFields[supabaseCol] = rating === 0 ? null : rating;
            }
            // Handle CHECKBOX fields (Softr returns boolean)
            else if (CHECKBOX_FIELDS.has(supabaseCol)) {
              convertedFields[supabaseCol] = Boolean(value);
            }
            else {
              convertedFields[supabaseCol] = value;
            }
          }
        }

        convertedFields.softr_record_id = softrRecordId;
        convertedFields.softr_synced_at = new Date().toISOString();
        // Mark sync source for loop prevention (for tables that support it)
        if (supabaseTableName === 'bewerber') {
          convertedFields.sync_source = 'softr';
        }

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

function mapSupabaseToSoftr(supabaseRecord: Record<string, any>, fieldMapping: Record<string, string>, tableName?: string): Record<string, any> {
  const softrFields: Record<string, any> = {};

  for (const [supabaseCol, softrFieldId] of Object.entries(fieldMapping)) {
    const value = supabaseRecord[supabaseCol];
    if (value !== null && value !== undefined) {
      // Handle date fields
      if ((supabaseCol === 'buchungsdatum' || supabaseCol === 'bewerbung_am' || supabaseCol === 'beginn_ab') && value) {
        softrFields[softrFieldId] = new Date(value).toISOString();
      }
      // Handle number fields
      else if (supabaseCol === 'transaktions_uid' && value) {
        softrFields[softrFieldId] = parseInt(value);
      }
      else if (supabaseCol === 'betrag' && value) {
        softrFields[softrFieldId] = parseFloat(value);
      }
      // Handle RATING fields (Supabase stores 0-5, Softr expects 0-5)
      else if (RATING_FIELDS.has(supabaseCol)) {
        softrFields[softrFieldId] = Math.max(0, Math.min(5, typeof value === 'number' ? value : (parseInt(String(value)) || 0)));
      }
      // Handle CHECKBOX fields (boolean -> boolean)
      else if (CHECKBOX_FIELDS.has(supabaseCol)) {
        softrFields[softrFieldId] = Boolean(value);
      }
      // Handle numeric fields for bewerber
      else if ((supabaseCol === 'provision_pauschal' || supabaseCol === 'provision_prozent' || supabaseCol === 'berufserfahrung_jahre') && value) {
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

async function fetchMaengelForPush(mode: 'new' | 'changed' | 'all'): Promise<any[]> {
  let query = supabase
    .from('maengel_fertigstellung')
    .select('id, mangel_nr, datum_meldung, mangel_behoben_datum, art_des_mangels, nachunternehmer, erinnerung_bl_count, letzte_erinnerung_am, projektname_komplett, kommentar_nu, kunde_email, projekt_nr, letzte_erinnerung_bl_am, nu_email, status_mangel, erinnerung_count, datum_frist, fotos_mangel, kunde_name, bauleiter, kosten, kunde_telefon, status_mangel_nu, beschreibung_mangel, nua_nr, erinnerung_status, fotos_nachweis_nu, softr_record_id, softr_synced_at, updated_at')
    .limit(100);

  if (mode === 'new') {
    query = query.is('softr_record_id', null);
  } else if (mode === 'changed') {
    // Fetch all and filter client-side for softr_synced_at < updated_at
    query = query.not('softr_record_id', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Fetch error: ${error.message}`);

  // For changed mode, filter records where updated_at > softr_synced_at
  if (mode === 'changed' && data) {
    return data.filter(r => !r.softr_synced_at || new Date(r.updated_at) > new Date(r.softr_synced_at));
  }

  return data || [];
}

async function updateMaengelSoftrSync(id: string, softrRecordId: string | null): Promise<boolean> {
  const updateData: Record<string, any> = {
    softr_synced_at: new Date().toISOString()
  };
  if (softrRecordId) {
    updateData.softr_record_id = softrRecordId;
  }

  const { error } = await supabase
    .from('maengel_fertigstellung')
    .update(updateData)
    .eq('id', id);

  return !error;
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

async function fetchBewerberForPush(mode: 'new' | 'changed' | 'all'): Promise<any[]> {
  let query = supabase
    .from('bewerber')
    .select('id, name, email, telefon, position, status, bewerbung_am, beginn_ab, gehaltsvorstellung, kultur_rating, kommunikation_rating, skills_rating, anschreiben, email_inhalt, zusammenfassung, notizen, quelle, vermittler_name, vermittler_aktiv, provision_typ, provision_pauschal, provision_prozent, berufserfahrung_jahre, fuehrerschein, softr_record_id, softr_synced_at, aktualisiert_am, sync_source')
    .limit(200);

  if (mode === 'new') {
    query = query.is('softr_record_id', null);
  } else if (mode === 'changed') {
    // Fetch records where sync_source is not 'softr' (to avoid loops)
    query = query.not('softr_record_id', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Fetch bewerber error: ${error.message}`);

  // For changed mode, filter records where:
  // 1. aktualisiert_am > softr_synced_at
  // 2. sync_source is not 'softr' (loop prevention)
  if (mode === 'changed' && data) {
    return data.filter(r =>
      r.sync_source !== 'softr' &&
      (!r.softr_synced_at || new Date(r.aktualisiert_am) > new Date(r.softr_synced_at))
    );
  }

  return data || [];
}

async function updateBewerberSoftrSync(id: string, softrRecordId: string | null): Promise<boolean> {
  const updateData: Record<string, any> = {
    softr_synced_at: new Date().toISOString(),
    sync_source: 'supabase'  // Mark as synced from Supabase to prevent loops
  };
  if (softrRecordId) {
    updateData.softr_record_id = softrRecordId;
  }

  const { error } = await supabase
    .from('bewerber')
    .update(updateData)
    .eq('id', id);

  return !error;
}

async function pushToSoftr(supabaseTableName: string, softrTableId: string, mode: 'new' | 'changed' | 'all' = 'new') {
  let processed = 0, created = 0, updated = 0, failed = 0;
  const errors: string[] = [];

  const fieldMapping = FIELD_MAPPINGS[supabaseTableName];
  if (!fieldMapping) {
    return { processed: 0, created: 0, updated: 0, failed: 0, error: `No field mapping for ${supabaseTableName}` };
  }

  // Fetch records based on table type
  let records: any[];
  let updateSyncFn: (id: string, softrRecordId: string | null) => Promise<boolean>;

  try {
    if (supabaseTableName === 'konto_transaktionen') {
      records = await fetchTransactionsForPush(mode === 'changed' ? 'all' : mode);
      updateSyncFn = updateTransactionSoftrSync;
    } else if (supabaseTableName === 'maengel_fertigstellung') {
      records = await fetchMaengelForPush(mode);
      updateSyncFn = updateMaengelSoftrSync;
    } else if (supabaseTableName === 'bewerber') {
      records = await fetchBewerberForPush(mode);
      updateSyncFn = updateBewerberSoftrSync;
    } else {
      return { processed: 0, created: 0, updated: 0, failed: 0, error: `Push not implemented for ${supabaseTableName}` };
    }
  } catch (err) {
    return { processed: 0, created: 0, updated: 0, failed: 0, error: String(err) };
  }

  if (!records || records.length === 0) {
    return { processed: 0, created: 0, updated: 0, failed: 0, message: 'No records to push' };
  }

  for (const record of records) {
    try {
      const softrFields = mapSupabaseToSoftr(record, fieldMapping, supabaseTableName);

      if (record.softr_record_id) {
        // Update existing record
        const success = await updateSoftrRecord(softrTableId, record.softr_record_id, softrFields);
        if (success) {
          await updateSyncFn(record.id, null);
          updated++;
        } else {
          failed++;
          errors.push(`Update failed for ${record.id}`);
        }
      } else {
        // Create new record
        const newSoftrId = await createSoftrRecord(softrTableId, softrFields);
        if (newSoftrId) {
          await updateSyncFn(record.id, newSoftrId);
          created++;
        } else {
          failed++;
          errors.push(`Create failed for ${record.id}`);
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
    const mode = url.searchParams.get('mode') as 'new' | 'changed' | 'all' || 'new';

    // Support friendly table names
    const TABLE_ALIASES: Record<string, string> = {
      'maengel': 'maengel_fertigstellung',
      'transaktionen': 'konto_transaktionen',
      'bewerber': 'bewerber'
    };

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
      // Resolve table alias if provided
      const resolvedTable = tableFilter ? (TABLE_ALIASES[tableFilter] || tableFilter) : null;

      // Build tables to push
      let tablesToPush: Record<string, string>;
      if (resolvedTable) {
        const softrId = REVERSE_TABLE_MAPPING[resolvedTable];
        if (softrId) {
          tablesToPush = { [resolvedTable]: softrId };
        } else {
          return new Response(JSON.stringify({ error: `Unknown table: ${tableFilter}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else {
        // Push all tables that have field mappings
        tablesToPush = {};
        for (const [supabaseTable, softrId] of Object.entries(REVERSE_TABLE_MAPPING)) {
          if (FIELD_MAPPINGS[supabaseTable]) {
            tablesToPush[supabaseTable] = softrId;
          }
        }
      }

      for (const [supabaseTable, softrId] of Object.entries(tablesToPush)) {
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
