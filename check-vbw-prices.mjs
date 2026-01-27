import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

console.log('=== HEADER-ZEILEN ===');
console.log('Zeile 0:', data[0]);
console.log('Zeile 1:', data[1]);
console.log('Zeile 2:', data[2]);

console.log('\n=== ALLE ZEILEN MIT THERME ===');
data.forEach((row, i) => {
  const rowStr = row.join(' ').toLowerCase();
  if (rowStr.includes('therme')) {
    console.log(`\nZeile ${i}:`);
    row.forEach((cell, j) => {
      if (cell !== '' && cell !== null && cell !== undefined) {
        console.log(`  [${j}] = "${cell}"`);
      }
    });
  }
});

console.log('\n\n=== ZEILEN MIT KOMMENTAREN - ALLE SPALTEN ===');

// Kommentierte Zeilen finden
const commentRows = [18, 20, 24, 25, 30, 36, 50, 54, 55, 59, 61, 62, 72, 80, 81, 82, 85, 86, 87];

for (const excelRow of commentRows) {
  const idx = excelRow - 1; // 0-basiert
  if (data[idx]) {
    const row = data[idx];
    console.log(`\n--- Excel-Zeile ${excelRow} ---`);
    console.log(`Pos ALT: ${row[0]}, Pos NEU: ${row[1]}`);
    console.log(`Kurztext ALT: ${row[2]}`);
    console.log(`Kurztext NEU: ${row[3]}`);
    console.log(`Gewerk: ${row[4]}`);

    // Alle Preis-Spalten anzeigen
    for (let c = 5; c < Math.min(row.length, 20); c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
        console.log(`  Spalte ${c}: ${row[c]}`);
      }
    }
  }
}
