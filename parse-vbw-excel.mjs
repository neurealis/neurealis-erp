import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';

// Excel-Datei laden
const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true, cellHTML: true });

console.log('=== SHEET NAMES ===');
console.log(workbook.SheetNames);

// Alle Sheets durchgehen
for (const sheetName of workbook.SheetNames) {
  console.log(`\n\n=== SHEET: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];

  // Range ermitteln
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  console.log(`Range: ${sheet['!ref']}`);

  // Header-Zeile ausgeben (erste Zeile)
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = sheet[cellAddr];
    headers.push(cell ? cell.v : '');
  }
  console.log('\nHeaders:', headers.slice(0, 20));

  // Kommentare in der Datei finden
  if (sheet['!comments']) {
    console.log('\nComments found:', Object.keys(sheet['!comments']).length);
  }

  // Nach Zellen mit Kommentaren suchen
  const cellsWithComments = [];
  for (const cellAddr in sheet) {
    if (cellAddr.startsWith('!')) continue;
    const cell = sheet[cellAddr];
    if (cell && cell.c) {
      cellsWithComments.push({ addr: cellAddr, comment: cell.c, value: cell.v });
    }
  }

  if (cellsWithComments.length > 0) {
    console.log(`\nZellen mit Kommentaren: ${cellsWithComments.length}`);
    cellsWithComments.forEach(c => {
      console.log(`  ${c.addr}: "${c.value}" -> Kommentar: ${JSON.stringify(c.comment)}`);
    });
  }

  // Erste 30 Zeilen als JSON ausgeben
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  console.log(`\nErste 50 Zeilen (${data.length} total):`);
  data.slice(0, 50).forEach((row, i) => {
    const nonEmpty = row.filter(c => c !== '').slice(0, 15);
    if (nonEmpty.length > 0) {
      console.log(`${i}: ${JSON.stringify(nonEmpty)}`);
    }
  });
}
