import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('./docs/softr_amounts_backup.json', 'utf8'));

// Filtere: Nur Dokumente mit echten Netto ODER Brutto Werten (nicht 0 und nicht null)
const withRealAmounts = data.filter(d =>
  (d.betrag_netto && d.betrag_netto !== 0) ||
  (d.betrag_brutto && d.betrag_brutto !== 0)
);

console.log('Dokumente mit echten Netto/Brutto-Werten:', withRealAmounts.length);

// Gruppiere nach Prefix
const byPrefix = {};
withRealAmounts.forEach(d => {
  const prefix = d.dokument_nr.split('-')[0] || d.dokument_nr.substring(0, 3);
  byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
});

console.log('\nNach Dokumenttyp:');
Object.entries(byPrefix).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([p, c]) => {
  console.log(`  ${p}: ${c}`);
});

// Summen
let totalNetto = 0;
let totalBrutto = 0;
withRealAmounts.forEach(d => {
  if (d.betrag_netto) totalNetto += d.betrag_netto;
  if (d.betrag_brutto) totalBrutto += d.betrag_brutto;
});

console.log(`\nGesamtsummen:`);
console.log(`  Netto: ${totalNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
console.log(`  Brutto: ${totalBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);

// Exportiere die Daten für SQL-Update
fs.writeFileSync('./docs/softr_restore_data.json', JSON.stringify(withRealAmounts, null, 2));
console.log('\nExportiert: docs/softr_restore_data.json');
