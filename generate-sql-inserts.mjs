/**
 * Generate SQL INSERT statements from Softr JSON
 */

import { readFileSync, writeFileSync } from 'fs';

// Escape SQL string
function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// Map document to SQL values
function mapDocument(doc) {
  const f = doc.fields || {};
  const artDok = f['6tf0K'];
  const status = f['DRCKl'];
  const freigabe = f['VQ6v9'];
  const attachments = f['MRwYN'];
  const dateiUrl = Array.isArray(attachments) && attachments.length > 0 ? attachments[0].url : null;

  let betragOffen = f['ptIjX'];
  if (typeof betragOffen === 'string') {
    betragOffen = parseFloat(betragOffen.replace(',', '.')) || null;
  }

  return {
    id: doc.id,
    dokument_nr: f['8Ae7U'] || null,
    atbs_nummer: f['GBc7t'] || null,
    art_des_dokuments: artDok?.label || null,
    art_des_dokuments_id: artDok?.id || null,
    betrag_netto: f['QuHkO'] || null,
    betrag_brutto: f['kukJI'] || null,
    betrag_bezahlt: f['vVD6w'] || null,
    betrag_offen: betragOffen,
    status: status?.label || null,
    status_id: status?.id || null,
    datum_erstellt: f['DAXGa'] || null,
    datum_zahlungsfrist: f['MG2bx'] || null,
    rechnungssteller: f['CplA5'] || null,
    projektname: f['1sWGL'] || null,
    nua_nr: f['7xrdk'] || null,
    datei_url: dateiUrl,
    notizen: f['iHzHD'] || null,
    softr_link: f['xMHBE'] || null,
    sharepoint_link: f['cIP4K'] || null,
    freigabe_status: freigabe?.label || null,
    softr_created_at: doc.createdAt || null,
    softr_updated_at: doc.updatedAt || null
  };
}

// Read both JSON files
const files = [
  'C:\\Users\\holge\\neurealis-erp\\softr_docs_1.json',
  'C:\\Users\\holge\\neurealis-erp\\softr_docs_2.json'
];

let allDocs = [];
for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8');
    const json = JSON.parse(content);
    allDocs = allDocs.concat(json.data || []);
    console.log(`${file}: ${json.data?.length || 0} Dokumente`);
  } catch (e) {
    console.error(`Fehler bei ${file}: ${e.message}`);
  }
}

console.log(`\nGesamt: ${allDocs.length} Dokumente`);

// Map all documents
const mapped = allDocs.map(mapDocument);

// Generate SQL
const columns = [
  'id', 'dokument_nr', 'atbs_nummer', 'art_des_dokuments', 'art_des_dokuments_id',
  'betrag_netto', 'betrag_brutto', 'betrag_bezahlt', 'betrag_offen',
  'status', 'status_id', 'datum_erstellt', 'datum_zahlungsfrist',
  'rechnungssteller', 'projektname', 'nua_nr', 'datei_url', 'notizen',
  'softr_link', 'sharepoint_link', 'freigabe_status', 'softr_created_at', 'softr_updated_at'
];

// Output first 5 for testing
console.log('\n--- Erste 5 Dokumente (Test) ---');
for (const doc of mapped.slice(0, 5)) {
  console.log(`\n${doc.id}:`);
  console.log(`  Nr: ${doc.dokument_nr}`);
  console.log(`  ATBS: ${doc.atbs_nummer}`);
  console.log(`  Art: ${doc.art_des_dokuments}`);
  console.log(`  Brutto: ${doc.betrag_brutto}`);
  console.log(`  Status: ${doc.status}`);
}

// Count by type
const typeCounts = {};
for (const doc of mapped) {
  const art = doc.art_des_dokuments || 'Unbekannt';
  typeCounts[art] = (typeCounts[art] || 0) + 1;
}

console.log('\n--- Dokumenttypen ---');
Object.entries(typeCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([art, count]) => {
    console.log(`  ${art}: ${count}`);
  });

// Count Rechnungen (AR, ER)
const rechnungen = mapped.filter(d =>
  d.art_des_dokuments &&
  (d.art_des_dokuments.startsWith('AR-') || d.art_des_dokuments.startsWith('ER-'))
);
console.log(`\nRechnungen (AR/ER): ${rechnungen.length}`);

// Offen vs Bezahlt
const offene = rechnungen.filter(d => d.status && d.status !== '(5) Bezahlt');
const bezahlte = rechnungen.filter(d => d.status === '(5) Bezahlt');
console.log(`  Offen: ${offene.length}`);
console.log(`  Bezahlt: ${bezahlte.length}`);

// Export as JSON for easier import
writeFileSync('softr_docs_mapped.json', JSON.stringify(mapped, null, 2));
console.log('\nGemappte Daten gespeichert in: softr_docs_mapped.json');
