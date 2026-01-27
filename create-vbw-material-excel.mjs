import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';
const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - Materialvorschläge und Preisvergleich.xlsx';

// Excel-Datei laden
const workbook = XLSX.readFile(filePath, { cellStyles: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Alle Kommentare extrahieren
const commentsMap = {};
for (const cellAddr in sheet) {
  if (cellAddr.startsWith('!')) continue;
  const cell = sheet[cellAddr];
  if (cell && cell.c && cell.c.length > 0) {
    // Zellenadresse parsen (z.B. D18 -> row 18)
    const match = cellAddr.match(/([A-Z]+)(\d+)/);
    if (match) {
      const row = parseInt(match[2]);
      // Kommentare zusammenfassen
      const comments = cell.c.map(c => {
        // Thread-Kommentare ignorieren
        if (c.a && c.a.includes('ADA24A63')) return null;
        return c.t;
      }).filter(Boolean);

      if (comments.length > 0) {
        commentsMap[row] = {
          value: cell.v,
          comments: comments.join('\n---\n')
        };
      }
    }
  }
}

// Daten als Array laden
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

// Ausgabedaten erstellen - nur Zeilen mit Kommentaren
const outputData = [];

// Header
outputData.push([
  'Pos. ALT',
  'Pos. NEU',
  'Kurztext ALT (2023)',
  'Kurztext NEU (2026)',
  'Gewerk',
  'Preis 2023 (bis 50m²)',
  'Preis 2026 (bis 50m²)',
  'Δ %',
  'Kommentar',
  'Material-Vorschlag',
  'Preis-Vorschlag/Hinweis',
  'Vergleichsposition (andere Kunden)'
]);

// Funktion zum Extrahieren von Materialvorschlägen
function extractMaterial(comment) {
  const materialPatterns = [
    /Vorschlag:\s*([^,\n]+)/gi,
    /Vorschlag\s+([^,\n]+)/gi,
    /Material\s+([^,\n]+)/gi,
  ];

  const materials = [];
  for (const pattern of materialPatterns) {
    const matches = comment.matchAll(pattern);
    for (const match of matches) {
      materials.push(match[1].trim());
    }
  }
  return [...new Set(materials)].join(', ');
}

// Funktion zum Extrahieren von Preisvorschlägen
function extractPrice(comment) {
  const priceHints = [];

  // Preise mit € Symbol
  const priceMatches = comment.matchAll(/(\d+(?:,\d+)?)\s*€/g);
  for (const match of priceMatches) {
    priceHints.push(match[0]);
  }

  // EK-Preise
  if (comment.includes('EK:')) {
    const ekMatch = comment.match(/EK:\s*([^\n,]+)/);
    if (ekMatch) priceHints.push('EK: ' + ekMatch[1].trim());
  }

  // Preissteigerung/Preis-Hinweise
  if (comment.toLowerCase().includes('preis') || comment.toLowerCase().includes('teuer') || comment.toLowerCase().includes('niedrig')) {
    // Sätze mit Preis-Bezug extrahieren
    const sentences = comment.split(/[.\n]/);
    for (const s of sentences) {
      if (s.toLowerCase().includes('preis') || s.toLowerCase().includes('teuer') || s.toLowerCase().includes('niedrig') || s.toLowerCase().includes('auskömm')) {
        priceHints.push(s.trim());
      }
    }
  }

  return [...new Set(priceHints)].join('\n');
}

// Zeilen mit Kommentaren verarbeiten
for (let rowIdx = 4; rowIdx < data.length; rowIdx++) {
  const excelRow = rowIdx + 1; // Excel ist 1-basiert

  if (commentsMap[excelRow]) {
    const row = data[rowIdx];
    const comment = commentsMap[excelRow].comments;

    // Umlaute korrigieren (aus Excel kommen sie manchmal falsch)
    const cleanComment = comment
      .replace(/Ã¤/g, 'ä')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ã/g, 'ß')
      .replace(/â¬/g, '€')
      .replace(/Â²/g, '²')
      .replace(/&amp;/g, '&');

    const materialSuggestion = extractMaterial(cleanComment);
    const priceHint = extractPrice(cleanComment);

    outputData.push([
      row[0] || '',  // Pos. ALT
      row[1] || '',  // Pos. NEU
      row[2] || '',  // Kurztext ALT
      row[3] || '',  // Kurztext NEU
      row[4] || '',  // Gewerk
      row[5] || '',  // Preis 2023
      row[6] || '',  // Preis 2026
      row[7] || '',  // Δ %
      cleanComment,
      materialSuggestion,
      priceHint,
      ''  // Vergleichsposition - wird später gefüllt
    ]);
  }
}

console.log(`\nExtrahierte Positionen mit Kommentaren: ${outputData.length - 1}`);
console.log('\n=== VORSCHAU DER DATEN ===\n');

outputData.forEach((row, i) => {
  if (i === 0) {
    console.log('HEADER:', row.slice(0, 6).join(' | '));
    console.log('-'.repeat(80));
  } else {
    console.log(`\n[${i}] Pos ${row[1]}: ${row[3]}`);
    console.log(`    Gewerk: ${row[4]}, Preis 2023: ${row[5]}, Preis 2026: ${row[6]}, Δ: ${row[7]}`);
    console.log(`    Kommentar: ${row[8].substring(0, 100)}...`);
    console.log(`    Material: ${row[9] || '-'}`);
    console.log(`    Preis-Hinweis: ${row[10] || '-'}`);
  }
});

// Excel-Datei erstellen
const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.aoa_to_sheet(outputData);

// Spaltenbreiten setzen
newSheet['!cols'] = [
  { wch: 8 },   // Pos ALT
  { wch: 8 },   // Pos NEU
  { wch: 35 },  // Kurztext ALT
  { wch: 40 },  // Kurztext NEU
  { wch: 18 },  // Gewerk
  { wch: 12 },  // Preis 2023
  { wch: 12 },  // Preis 2026
  { wch: 8 },   // Δ %
  { wch: 50 },  // Kommentar
  { wch: 40 },  // Material-Vorschlag
  { wch: 40 },  // Preis-Vorschlag
  { wch: 50 },  // Vergleichsposition
];

XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Materialvorschläge');
XLSX.writeFile(newWorkbook, outputPath);

console.log(`\n\n=== DATEI GESPEICHERT ===`);
console.log(`Pfad: ${outputPath}`);

// JSON für Supabase-Abfrage ausgeben
console.log('\n\n=== DATEN FÜR SUPABASE-VERGLEICH ===');
const searchTerms = outputData.slice(1).map((row, i) => ({
  idx: i + 1,
  pos: row[1],
  kurztext: row[3],
  gewerk: row[4]
}));
console.log(JSON.stringify(searchTerms, null, 2));
