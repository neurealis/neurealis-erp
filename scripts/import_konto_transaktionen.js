/**
 * Batch-Import: Konto-Transaktionen von Softr nach Supabase
 * Umgeht Edge Function Timeout durch lokale Ausführung
 *
 * Ausführung: node scripts/import_konto_transaktionen.js
 */

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'XXJFvICfFvbXkY';
const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Field mapping: Softr field ID -> Supabase column
const FIELD_MAPPING = {
  'Yk5Kj': 'softr_record_id',
  'ISiEe': 'auto_nummer',
  'QblUD': 'transaktions_uid',
  'qlVAr': 'verknuepft_mit_re',
  'KcZFn': 'konto_uid',
  'Tg6df': 'bankkonto_uid',
  '6b4XF': 'buchungsdatum',
  'N3HtC': 'verwendungszweck_rohtext',
  'VTmwO': 'betrag',
  't6ybB': 'waehrungscode',
  'LVqOI': 'kontoname',
  '11kT1': 'transaktionsstatus',
  'iI47E': 'glaeubigerid',
  'fTiZI': 'zahlungspartner_name',
  'v9qkS': 'tags',
  'cAzLD': 'verarbeitet_am',
  'YfcGr': 'atbs_nr',
  '7J0YZ': 're_nr',
  '4CNE4': 're_nr_zahl',
  'RXGvn': 'nua_nr',
  'GBdNE': 'ki_notizen',
  'sQN1W': 'dokument_softr_record_id',
  '1TGLx': 'rohdaten_json'
};

async function fetchSoftrRecords(offset = 0, limit = 100) {
  const url = `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'Softr-Api-Key': SOFTR_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Softr API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    records: data.data || [],
    total: data.metadata?.total || 0
  };
}

function convertSoftrToSupabase(record) {
  const fields = record.fields || {};
  const converted = {};

  for (const [softrId, supabaseCol] of Object.entries(FIELD_MAPPING)) {
    let value = fields[softrId];

    if (value === null || value === undefined) continue;

    // Handle SELECT fields (object with label)
    if (value && typeof value === 'object' && 'label' in value) {
      value = value.label;
    }
    // Handle array of SELECT fields (tags)
    else if (Array.isArray(value) && value.length > 0 && value[0]?.label) {
      value = value.map(v => v.label).join(', ');
    }
    // Handle linked records (array of IDs)
    else if (Array.isArray(value) && supabaseCol === 'dokument_softr_record_id') {
      value = value.length > 0 ? value[0] : null;
    }
    // Handle JSON fields
    else if (supabaseCol === 'rohdaten_json' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    if (value !== null && value !== undefined) {
      converted[supabaseCol] = value;
    }
  }

  // Add metadata
  converted.sync_source = 'softr';
  converted.last_modified_at = new Date().toISOString();

  return converted;
}

async function upsertToSupabase(records) {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nicht gesetzt! Setze: $env:SUPABASE_SERVICE_ROLE_KEY="..."');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/konto_transaktionen`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(records)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  return true;
}

async function main() {
  console.log('🚀 Starte Import: Konto-Transaktionen Softr → Supabase\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY nicht gesetzt!');
    console.log('   PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    process.exit(1);
  }

  let offset = 0;
  const limit = 100;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalFailed = 0;

  // First fetch to get total count
  const { total } = await fetchSoftrRecords(0, 1);
  console.log(`📊 Gefunden: ${total} Transaktionen in Softr\n`);

  while (true) {
    console.log(`📥 Hole Records ${offset + 1} - ${offset + limit}...`);

    const { records } = await fetchSoftrRecords(offset, limit);
    if (records.length === 0) break;

    // Convert records
    const converted = records.map(r => convertSoftrToSupabase(r));

    // Upsert to Supabase in batches of 50
    const batchSize = 50;
    for (let i = 0; i < converted.length; i += batchSize) {
      const batch = converted.slice(i, i + batchSize);
      try {
        await upsertToSupabase(batch);
        totalCreated += batch.length;
        process.stdout.write('.');
      } catch (err) {
        console.error(`\n❌ Batch-Fehler: ${err.message}`);
        totalFailed += batch.length;
      }
    }

    totalProcessed += records.length;
    console.log(` ✅ ${totalProcessed}/${total}`);

    offset += records.length;
    if (records.length < limit) break;

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Import abgeschlossen:');
  console.log(`   ✅ Verarbeitet: ${totalProcessed}`);
  console.log(`   ✅ Importiert:  ${totalCreated}`);
  console.log(`   ❌ Fehlerhaft:  ${totalFailed}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('💥 Fehler:', err.message);
  process.exit(1);
});
