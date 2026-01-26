/**
 * Push neue Transaktionen von Supabase nach Softr.io
 * Ausführen: node push-to-softr.js
 */

const https = require('https');

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'XXJFvICfFvbXkY';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA2NDgxNSwiZXhwIjoyMDgzNjQwODE1fQ.KwqRKiPzh4ppoBRWlmI9APPGUwPnBUchTaPQAXxHnm0';

// Softr Field IDs
const FIELDS = {
  transaktions_uid: 'QblUD',
  buchungsdatum: '6b4XF',
  verwendungszweck: 'N3HtC',
  betrag: 'VTmwO',
  waehrungscode: 't6ybB',
  kontoname: 'LVqOI',
  glaeubiger_id: 'iI47E',
  zahlungspartner_name: 'fTiZI',
  ki_notizen: 'GBdNE'
};

async function fetchFromRPC(query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_transactions_for_push`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_mode: 'new' })
  });

  if (!response.ok) {
    // Fallback: Direkte SQL-Abfrage über die Admin API (nicht verfügbar)
    throw new Error(`RPC nicht verfügbar: ${response.status}`);
  }
  return response.json();
}

function createSoftrRecord(record) {
  return new Promise((resolve) => {
    const fields = {};

    if (record.transaktions_uid) fields[FIELDS.transaktions_uid] = parseInt(record.transaktions_uid);
    if (record.buchungsdatum) fields[FIELDS.buchungsdatum] = new Date(record.buchungsdatum).toISOString();
    if (record.betrag) fields[FIELDS.betrag] = parseFloat(record.betrag);
    if (record.waehrungscode) fields[FIELDS.waehrungscode] = record.waehrungscode;
    if (record.kontoname) fields[FIELDS.kontoname] = record.kontoname;
    if (record.zahlungspartner_name) fields[FIELDS.zahlungspartner_name] = record.zahlungspartner_name;
    if (record.verwendungszweck) fields[FIELDS.verwendungszweck] = record.verwendungszweck.substring(0, 500);
    if (record.glaeubiger_id) fields[FIELDS.glaeubiger_id] = record.glaeubiger_id;
    if (record.ki_notizen) fields[FIELDS.ki_notizen] = record.ki_notizen;

    const postData = JSON.stringify({ fields });

    const options = {
      hostname: 'tables-api.softr.io',
      port: 443,
      path: `/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve({ success: true, softrId: json.data?.id });
          } catch {
            resolve({ success: false, error: 'Parse error' });
          }
        } else {
          resolve({ success: false, error: `${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(postData);
    req.end();
  });
}

async function updateSupabaseRecord(id, softrRecordId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_transaction_softr_sync`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_id: id,
      p_softr_record_id: softrRecordId
    })
  });
  return response.ok;
}

async function main() {
  console.log('Fetching transactions without softr_record_id...');

  let records;
  try {
    records = await fetchFromRPC();
  } catch (err) {
    console.log('RPC nicht verfügbar, nutze manuellen Input');
    console.log('Bitte führe folgende SQL aus und speichere als transactions.json:');
    console.log(`
SELECT id, transaktions_uid, buchungsdatum, verwendungszweck, betrag,
       waehrungscode, kontoname, zahlungspartner_name, glaeubiger_id, ki_notizen
FROM konto_transaktionen
WHERE softr_record_id IS NULL
LIMIT 500;
    `);

    // Versuche lokale Datei zu laden
    try {
      const fs = require('fs');
      records = JSON.parse(fs.readFileSync('transactions.json', 'utf8'));
    } catch {
      console.log('Keine transactions.json gefunden. Abbruch.');
      return;
    }
  }

  if (!records || records.length === 0) {
    console.log('Keine neuen Transaktionen zu pushen.');
    return;
  }

  console.log(`${records.length} Transaktionen gefunden. Starte Push...`);

  let success = 0, failed = 0;
  const results = [];

  for (const record of records) {
    const result = await createSoftrRecord(record);

    if (result.success) {
      console.log(`✓ ID ${record.id} -> Softr ${result.softrId}`);
      results.push({ id: record.id, softrId: result.softrId });
      success++;
    } else {
      console.log(`✗ ID ${record.id}: ${result.error}`);
      failed++;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nPush abgeschlossen: ${success} erfolgreich, ${failed} fehlgeschlagen`);

  // Ergebnisse für manuelles Update speichern
  if (results.length > 0) {
    const fs = require('fs');
    fs.writeFileSync('softr_results.json', JSON.stringify(results, null, 2));
    console.log('\nErgebnisse in softr_results.json gespeichert.');
    console.log('Zum Aktualisieren in Supabase:');
    console.log(`
UPDATE konto_transaktionen
SET softr_record_id = r.softr_id, softr_synced_at = NOW()
FROM (VALUES
  ${results.map(r => `('${r.id}', '${r.softrId}')`).join(',\n  ')}
) AS r(id, softr_id)
WHERE konto_transaktionen.id = r.id::uuid;
    `);
  }
}

main().catch(console.error);
