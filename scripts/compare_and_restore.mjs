import * as fs from 'fs';

const softr = JSON.parse(fs.readFileSync('./docs/softr_amounts_backup.json', 'utf8'));

// Supabase-Dokumente mit 0/NULL (aus der MCP-Abfrage)
const supabaseZero = [
  'NUA-355', 'NUA-357', 'NUA-358', 'NUA-359', 'NUA-363', 'NUA-364', 'NUA-365', 'NUA-366',
  '2100021040', 'R-00156', 'R-00173', 'R-00189',
  'ANG-0021155', 'ANG-0021217', 'AB-013113',
  '100002583/0122', '100002584/0122', '100002586/0122', '100002587/0122',
  '5100003032/C392', '5100003035/C392'
];

// Softr Map - nehme den ersten Eintrag mit echten Werten
const softrMap = new Map();
softr.forEach(d => {
  const existing = softrMap.get(d.dokument_nr);
  if (!existing || (!existing.betrag_netto && d.betrag_netto)) {
    softrMap.set(d.dokument_nr, d);
  }
});

console.log('=== VERGLEICH: Supabase 0/NULL vs Softr ===\n');

const canRestore = [];

supabaseZero.forEach(nr => {
  const softrDoc = softrMap.get(nr);
  if (softrDoc && (softrDoc.betrag_netto || softrDoc.betrag_brutto)) {
    console.log('✅ ' + nr + ' - WIEDERHERSTELLBAR');
    console.log('   Softr: Netto=' + softrDoc.betrag_netto + ', Brutto=' + softrDoc.betrag_brutto);
    canRestore.push({ dokument_nr: nr, ...softrDoc });
  } else {
    console.log('❌ ' + nr + ' - Nicht in Softr oder keine Werte');
  }
});

console.log('\n=== ' + canRestore.length + ' DOKUMENTE WIEDERHERSTELLBAR ===');

if (canRestore.length > 0) {
  console.log('\nSQL UPDATE Statements:\n');
  canRestore.forEach(d => {
    const n = d.betrag_netto !== null && d.betrag_netto !== undefined ? d.betrag_netto : 'NULL';
    const b = d.betrag_brutto !== null && d.betrag_brutto !== undefined ? d.betrag_brutto : 'NULL';
    const bez = d.betrag_bezahlt !== null && d.betrag_bezahlt !== undefined ? d.betrag_bezahlt : 'NULL';
    const o = d.betrag_offen !== null && d.betrag_offen !== undefined ? d.betrag_offen : 'NULL';
    const escapedNr = d.dokument_nr.replace(/'/g, "''");
    console.log(`UPDATE dokumente SET betrag_netto = ${n}, betrag_brutto = ${b}, betrag_bezahlt = ${bez}, betrag_offen = ${o} WHERE dokument_nr = '${escapedNr}';`);
  });

  // Speichere für MCP
  fs.writeFileSync('./docs/restore_final.json', JSON.stringify(canRestore, null, 2));
  console.log('\nGespeichert: docs/restore_final.json');
}
