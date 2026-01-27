/**
 * Import Softr Dokumente JSON nach Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_KEY nicht gesetzt!');
  console.log('Setze: $env:SUPABASE_SERVICE_KEY="..."');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Feld-Mapping Softr -> Supabase
function mapDocument(doc) {
  const fields = doc.fields || {};

  // Art des Dokuments extrahieren
  const artDok = fields['6tf0K'];
  const status = fields['DRCKl'];
  const freigabe = fields['VQ6v9'];

  // Datei-URL extrahieren (erstes Attachment)
  const attachments = fields['MRwYN'];
  const dateiUrl = Array.isArray(attachments) && attachments.length > 0
    ? attachments[0].url
    : null;

  // Betrag offen kann String sein
  let betragOffen = fields['ptIjX'];
  if (typeof betragOffen === 'string') {
    betragOffen = parseFloat(betragOffen.replace(',', '.')) || null;
  }

  return {
    id: doc.id,
    dokument_nr: fields['8Ae7U'] || null,
    atbs_nummer: fields['GBc7t'] || null,
    art_des_dokuments: artDok?.label || null,
    art_des_dokuments_id: artDok?.id || null,
    betrag_netto: fields['QuHkO'] || null,
    betrag_brutto: fields['kukJI'] || null,
    betrag_bezahlt: fields['vVD6w'] || null,
    betrag_offen: betragOffen,
    status: status?.label || null,
    status_id: status?.id || null,
    datum_erstellt: fields['DAXGa'] || null,
    datum_zahlungsfrist: fields['MG2bx'] || null,
    rechnungssteller: fields['CplA5'] || null,
    projektname: fields['1sWGL'] || null,
    nua_nr: fields['7xrdk'] || null,
    datei_url: dateiUrl,
    notizen: fields['iHzHD'] || null,
    softr_link: fields['xMHBE'] || null,
    sharepoint_link: fields['cIP4K'] || null,
    freigabe_status: freigabe?.label || null,
    softr_created_at: doc.createdAt || null,
    softr_updated_at: doc.updatedAt || null
  };
}

async function importFile(filename) {
  console.log(`\nImportiere: ${filename}`);

  const content = readFileSync(filename, 'utf8');
  const json = JSON.parse(content);
  const documents = json.data || [];

  console.log(`  ${documents.length} Dokumente gefunden`);

  const mapped = documents.map(mapDocument);

  // Batch-Insert (max 1000 pro Request)
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('softr_dokumente')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`  Fehler bei Batch ${i}-${i + batch.length}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`  Batch ${i}-${i + batch.length}: OK`);
    }
  }

  console.log(`  Ergebnis: ${inserted} importiert, ${errors} Fehler`);
  return { inserted, errors };
}

async function main() {
  console.log('=== Softr Dokumente Import ===\n');

  const files = [
    'C:\\Users\\holge\\neurealis-erp\\softr_docs_1.json',
    'C:\\Users\\holge\\neurealis-erp\\softr_docs_2.json'
  ];

  let totalInserted = 0;
  let totalErrors = 0;

  for (const file of files) {
    try {
      const result = await importFile(file);
      totalInserted += result.inserted;
      totalErrors += result.errors;
    } catch (err) {
      console.error(`Fehler bei ${file}:`, err.message);
    }
  }

  console.log(`\n=== Fertig ===`);
  console.log(`Gesamt: ${totalInserted} importiert, ${totalErrors} Fehler`);

  // Statistik
  const { data: stats } = await supabase
    .from('softr_dokumente')
    .select('art_des_dokuments')
    .not('art_des_dokuments', 'is', null);

  if (stats) {
    const counts = {};
    stats.forEach(d => {
      const art = d.art_des_dokuments || 'Unbekannt';
      counts[art] = (counts[art] || 0) + 1;
    });

    console.log('\nDokumenttypen:');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([art, count]) => {
        console.log(`  ${art}: ${count}`);
      });
  }
}

main().catch(console.error);
