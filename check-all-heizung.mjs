import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

console.log('=== ALLE HEIZUNGS-POSITIONEN ===\n');
console.log('Spalte 5 = Preis 2023 (bis 40m²)');
console.log('Spalte 6 = Preis 2026 (bis 40m²)');
console.log('Spalte 8 = Preis 2023 (bis 50m²)');
console.log('Spalte 9 = Preis 2026 (bis 50m²)\n');

data.forEach((row, i) => {
  const gewerk = String(row[4] || '').toLowerCase();
  if (gewerk.includes('heizung') || gewerk.includes('therme')) {
    console.log(`\nZeile ${i+1}: Pos ${row[0]} → ${row[1]}`);
    console.log(`  Kurztext: ${row[3]}`);
    console.log(`  Preis 2023 (40m²): ${row[5]}€`);
    console.log(`  Preis 2026 (40m²): ${row[6]}€`);
    console.log(`  Preis 2026 (50m²): ${row[9]}€`);
    console.log(`  Preis 2026 (80m²): ${row[18]}€`);
  }
});

// Suche nach 4300
console.log('\n\n=== SUCHE NACH WERTEN UM 4300 ===');
data.forEach((row, i) => {
  for (let c = 5; c < 35; c++) {
    const val = parseFloat(row[c]);
    if (val >= 4200 && val <= 4400) {
      console.log(`Zeile ${i+1}, Spalte ${c}: ${val} - "${row[3]}"`);
    }
  }
});
