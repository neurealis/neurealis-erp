// Export Softr-Beträge für MCP-basierte Wiederherstellung
import * as fs from 'fs';

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'kNjsEhYYcNjAsj';

const SOFTR_FIELDS = {
  DOKUMENT_NR: '8Ae7U',
  BETRAG_NETTO: 'QuHkO',
  BETRAG_BRUTTO: 'kukJI',
  BETRAG_BEZAHLT: 'vVD6w',
  BETRAG_OFFEN: 'ptIjX'
};

async function fetchAllSoftrRecords() {
  let allRecords = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    const records = data.data || [];
    allRecords = allRecords.concat(records);

    if (records.length < limit) break;
    offset += limit;
  }

  return allRecords;
}

async function main() {
  console.log('Lade Softr-Dokumente...');
  const softrRecords = await fetchAllSoftrRecords();
  console.log(`${softrRecords.length} Softr-Dokumente geladen.\n`);

  // Extrahiere nur Dokumente mit Beträgen
  const withAmounts = [];

  softrRecords.forEach(r => {
    const dokNr = r.fields[SOFTR_FIELDS.DOKUMENT_NR];
    if (!dokNr) return;

    const netto = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_NETTO]) || null;
    const brutto = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BRUTTO]) || null;
    const bezahlt = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BEZAHLT]) || null;
    const offen = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_OFFEN]) || null;

    // Nur wenn mindestens Netto oder Brutto vorhanden
    if (netto || brutto) {
      withAmounts.push({
        dokument_nr: dokNr,
        betrag_netto: netto,
        betrag_brutto: brutto,
        betrag_bezahlt: bezahlt,
        betrag_offen: offen
      });
    }
  });

  console.log(`${withAmounts.length} Dokumente mit Beträgen.`);

  // Speichern
  fs.writeFileSync('./docs/softr_amounts_backup.json', JSON.stringify(withAmounts, null, 2));
  console.log('Gespeichert: docs/softr_amounts_backup.json');

  // Statistik
  const byPrefix = {};
  let totalNetto = 0;
  let totalBrutto = 0;

  withAmounts.forEach(item => {
    const prefix = item.dokument_nr.split('-')[0] || item.dokument_nr.substring(0, 3);
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    if (item.betrag_netto) totalNetto += item.betrag_netto;
    if (item.betrag_brutto) totalBrutto += item.betrag_brutto;
  });

  console.log('\n--- NACH DOKUMENTTYP ---');
  Object.entries(byPrefix).sort((a, b) => b[1] - a[1]).forEach(([prefix, count]) => {
    console.log(`  ${prefix}: ${count}`);
  });

  console.log(`\n--- GESAMTSUMMEN ---`);
  console.log(`  Netto: ${totalNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
  console.log(`  Brutto: ${totalBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
}

main().catch(console.error);
