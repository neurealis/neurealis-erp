const fs = require('fs');

// Lese gws_price_comparison.json
const comparison = JSON.parse(fs.readFileSync('docs/gws_price_comparison.json'));
const matchedDiff = comparison.matched_diff || [];

// Erstelle SQL für Updates
const sqlStatements = matchedDiff.map(entry => {
  const sb_nr = entry.sb_original_nr;
  const newPrice = entry.excel_preis;
  return `UPDATE lv_positionen SET listenpreis = ${newPrice}, updated_at = NOW() WHERE artikelnummer = '${sb_nr}';`;
});

// Speichere SQL-Statements
fs.writeFileSync('docs/backups/2026-02-02_gws_price_updates.sql', sqlStatements.join('\n'));

console.log('SQL-Statements erstellt:', sqlStatements.length);
console.log('\nErste 5:');
sqlStatements.slice(0, 5).forEach(s => console.log(s));
console.log('\nLetzte 5:');
sqlStatements.slice(-5).forEach(s => console.log(s));

// Erstelle auch ein JSON mit den Updates für Dokumentation
const updateDoc = matchedDiff.map(entry => ({
  artikelnummer: entry.sb_original_nr,
  name: entry.name,
  alter_preis: entry.sb_preis,
  neuer_preis: entry.excel_preis,
  diff: entry.diff,
  diff_pct: entry.diff_pct
}));

fs.writeFileSync('docs/backups/2026-02-02_gws_price_updates.json', JSON.stringify(updateDoc, null, 2));
console.log('\nJSON-Dokumentation gespeichert');
