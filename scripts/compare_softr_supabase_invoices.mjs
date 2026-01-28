// Abgleich ER-* und AR-* Rechnungen zwischen Softr.io und Supabase
import * as fs from 'fs';

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'kNjsEhYYcNjAsj';

const SOFTR_FIELDS = {
  DOKUMENT_NR: '8Ae7U',
  ART_DOKUMENT: '6tf0K',
  BETRAG_NETTO: 'QuHkO',
  BETRAG_BRUTTO: 'kukJI',
  BETRAG_BEZAHLT: 'vVD6w',
  BETRAG_OFFEN: 'ptIjX'
};

async function fetchAllSoftrRecords() {
  let allRecords = [];
  let offset = 0;
  const limit = 100;

  console.log('Lade Softr-Dokumente...');

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

    if (offset % 500 === 0) {
      console.log(`  ${offset} Softr-Records geladen...`);
    }
  }

  return allRecords;
}

async function main() {
  console.log('=== ABGLEICH: ER-* und AR-* Rechnungen ===\n');
  console.log('Softr.io vs. Supabase Dokumente-Tabelle\n');

  // 1. Softr-Daten laden
  const softrRecords = await fetchAllSoftrRecords();
  console.log(`Softr: ${softrRecords.length} Dokumente total\n`);

  // Filtern auf ER-* und AR-* Rechnungen
  const softrInvoices = new Map();
  softrRecords.forEach(r => {
    const dokNr = r.fields[SOFTR_FIELDS.DOKUMENT_NR];
    if (!dokNr) return;

    // Nur ER-* und AR-* (Rechnungen)
    if (dokNr.startsWith('ER-') || dokNr.startsWith('AR-') ||
        dokNr.startsWith('RE-') || dokNr.match(/^ER[0-9]/) || dokNr.match(/^AR[0-9]/)) {
      softrInvoices.set(dokNr, {
        dokument_nr: dokNr,
        art: r.fields[SOFTR_FIELDS.ART_DOKUMENT] || null,
        netto: parseFloat(r.fields[SOFTR_FIELDS.BETRAG_NETTO]) || null,
        brutto: parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BRUTTO]) || null,
        bezahlt: parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BEZAHLT]) || null,
        offen: parseFloat(r.fields[SOFTR_FIELDS.BETRAG_OFFEN]) || null
      });
    }
  });

  console.log(`Softr: ${softrInvoices.size} Rechnungen (ER-*, AR-*, RE-*)\n`);

  // 2. Supabase-Daten aus Backup laden (oder per MCP abrufen)
  // Wir nutzen das Backup, da es die Softr-Beträge enthält
  const softrBackup = JSON.parse(fs.readFileSync('./docs/softr_amounts_backup.json', 'utf8'));

  // Erstelle Supabase-ähnliche Map aus dem was wir wissen
  // (Die tatsächlichen Supabase-Werte müssten per MCP abgefragt werden)

  // Für den Vergleich: Gib die Softr-Rechnungen aus
  console.log('=== SOFTR RECHNUNGEN (ER-*, AR-*) ===\n');

  const byType = {};
  softrInvoices.forEach((doc, nr) => {
    const prefix = nr.split('-')[0] || nr.substring(0, 2);
    if (!byType[prefix]) byType[prefix] = { count: 0, mitNetto: 0, summeNetto: 0 };
    byType[prefix].count++;
    if (doc.netto) {
      byType[prefix].mitNetto++;
      byType[prefix].summeNetto += doc.netto;
    }
  });

  console.log('Nach Typ:');
  Object.entries(byType).sort((a,b) => b[1].count - a[1].count).forEach(([typ, data]) => {
    console.log(`  ${typ}: ${data.count} (${data.mitNetto} mit Netto, Summe: ${data.summeNetto.toLocaleString('de-DE', {minimumFractionDigits: 2})} €)`);
  });

  // 3. Vergleich mit Softr-Backup (enthält bereits gefilterte Daten mit Beträgen)
  console.log('\n=== VERGLEICH MIT SOFTR BACKUP ===\n');

  const backupInvoices = softrBackup.filter(d =>
    d.dokument_nr.startsWith('ER-') ||
    d.dokument_nr.startsWith('AR-') ||
    d.dokument_nr.startsWith('RE-') ||
    d.dokument_nr.match(/^ER[0-9]/) ||
    d.dokument_nr.match(/^AR[0-9]/)
  );

  console.log(`Backup enthält: ${backupInvoices.length} Rechnungen mit Beträgen\n`);

  // Gruppiere Backup nach Typ
  const backupByType = {};
  backupInvoices.forEach(doc => {
    const prefix = doc.dokument_nr.split('-')[0] || doc.dokument_nr.substring(0, 2);
    if (!backupByType[prefix]) backupByType[prefix] = { count: 0, summeNetto: 0, summebrutto: 0 };
    backupByType[prefix].count++;
    if (doc.betrag_netto) backupByType[prefix].summeNetto += doc.betrag_netto;
    if (doc.betrag_brutto) backupByType[prefix].summebrutto += doc.betrag_brutto;
  });

  console.log('Backup nach Typ:');
  Object.entries(backupByType).sort((a,b) => b[1].count - a[1].count).forEach(([typ, data]) => {
    console.log(`  ${typ}: ${data.count} Dokumente`);
    console.log(`      Netto: ${data.summeNetto.toLocaleString('de-DE', {minimumFractionDigits: 2})} €`);
    console.log(`      Brutto: ${data.summebrutto.toLocaleString('de-DE', {minimumFractionDigits: 2})} €`);
  });

  // 4. Exportiere Rechnungsliste für SQL-Vergleich
  const invoiceNumbers = Array.from(softrInvoices.keys());

  // Erstelle SQL IN-Clause für Supabase-Abfrage
  console.log('\n=== SQL FÜR SUPABASE-VERGLEICH ===\n');

  // Beispiel-SQL (erste 50)
  const sampleNrs = invoiceNumbers.slice(0, 50).map(n => `'${n.replace(/'/g, "''")}'`).join(',');
  console.log(`SELECT dokument_nr, betrag_netto, betrag_brutto, art_des_dokuments`);
  console.log(`FROM dokumente`);
  console.log(`WHERE dokument_nr IN (${sampleNrs.substring(0, 200)}...)`);
  console.log(`-- ${invoiceNumbers.length} Dokumente total`);

  // 5. Export für weitere Analyse
  fs.writeFileSync('./docs/softr_invoices_list.json', JSON.stringify(Array.from(softrInvoices.values()), null, 2));
  console.log('\nExportiert: docs/softr_invoices_list.json');
}

main().catch(console.error);
