import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const inputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - Materialvorschläge und Preisvergleich.xlsx';
const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV 2026 - Preisvorschläge neurealis.xlsx';

// Aktuelle Datei laden
const workbook = XLSX.readFile(inputPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

console.log('=== AKTUELLE STRUKTUR ===');
console.log('Header:', data[0]);
console.log('Zeile 2:', data[1]);
console.log(`Gesamt: ${data.length} Zeilen`);

// Original-Excel mit Kommentaren laden
const originalPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';
const origWorkbook = XLSX.readFile(originalPath, { cellStyles: true });
const origSheet = origWorkbook.Sheets[origWorkbook.SheetNames[0]];

// Kommentare extrahieren
const commentsMap = {};
for (const cellAddr in origSheet) {
  if (cellAddr.startsWith('!')) continue;
  const cell = origSheet[cellAddr];
  if (cell && cell.c && cell.c.length > 0) {
    const match = cellAddr.match(/([A-Z]+)(\d+)/);
    if (match) {
      const row = parseInt(match[2]);
      const comments = cell.c.map(c => {
        if (c.a && c.a.includes('ADA24A63')) return null;
        return c.t;
      }).filter(Boolean);
      if (comments.length > 0) {
        // Umlaute korrigieren
        let comment = comments.join('\n---\n');
        comment = comment
          .replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü').replace(/Ã/g, 'ß')
          .replace(/â¬/g, '€').replace(/Â²/g, '²').replace(/&amp;/g, '&');
        commentsMap[row] = comment;
      }
    }
  }
}

console.log('\n=== KOMMENTARE GEFUNDEN ===');
Object.keys(commentsMap).forEach(row => {
  console.log(`Zeile ${row}: ${commentsMap[row].substring(0, 50)}...`);
});

// Original-Daten für Preise (50m² = Spalte 9)
const origData = XLSX.utils.sheet_to_json(origSheet, { header: 1, raw: true, defval: '' });

// Preisvorschläge (alle netto)
const preisVorschlaege = {
  '2.1': '2.300 €',
  '2.3': '710 €',
  '2.7': '320 €',
  '2.8': '430 €',
  '2.13': '210 €',
  '3.1': '6.500 €',
  '3.15': '150 €',
  '4.1': '3.100 €',
  '4.2': '900 €',
  '4.6': '130 €',
  '4.8': '4.300 €',
  '4.9': '250 €',
  '5.9': '2.100 €',
  '6.1': '300 €',
  '6.2': '500 €',
  '6.3': '1.400 €',
  '7.1': '1.450 €',
  '7.2': '1.200 €',
  '7.3': '320 €',
};

// Materialvorschläge
const materialVorschlaege = {
  '2.1': 'Gira Standard 55 (statt S2)',
  '2.3': '',
  '2.7': 'Emco ca. 100€ (mit Nachlauf)',
  '2.8': 'Gira Standard 55 (statt S2)',
  '2.13': 'max. 3m, exkl. Brandschutz',
  '3.1': 'Vigour One',
  '3.15': '',
  '4.1': '',
  '4.2': '',
  '4.6': 'Bei Danfoss (Verschraubung) → 2x Position',
  '4.8': 'inkl. Raumregler, Anschlüsse',
  '4.9': '',
  '5.9': 'Kermos Wand- und Bodenfliesen 8mm (statt DK02)',
  '6.1': '',
  '6.2': 'bis 3mm, sonst mehrfach',
  '6.3': '7,5€ Vinyl + 2€ Sockel + 2,75€ Kleber + 0,5€ Grundierung = 12,75€/m²',
  '7.1': 'Prüm Röhrenspahn (Wabe wo möglich)',
  '7.2': 'Prüm KK2 RC2 (EK Material: 1.050€)',
  '7.3': 'Becher Eigenmarke (Hoppe Amsterdam)',
};

// Neue Ausgabe erstellen
const outputData = [];

// Header
outputData.push([
  'Pos. NEU',
  'Kurztext NEU (2026)',
  'Gewerk',
  'Preis LV 2026 (50m²)',
  'Unser Preisvorschlag',
  'Kommentar (Original)',
  'Material-Vorschlag',
]);

// Mapping Pos NEU → Excel-Zeile für Kommentare
const posToExcelRow = {
  '2.1': 18, '2.3': 20, '2.7': 24, '2.8': 25, '2.13': 30,
  '3.1': 36, '3.15': 50,
  '4.1': 54, '4.2': 55, '4.6': 59, '4.8': 61, '4.9': 62,
  '5.9': 72,
  '6.1': 80, '6.2': 81, '6.3': 82,
  '7.1': 85, '7.2': 86, '7.3': 87,
};

// Positionen aus Original-Excel extrahieren (Zeile mit Kommentar)
const positionen = [
  { pos: '2.1', kurztext: 'E-Anlage erneuern inkl. Baufassungen', gewerk: 'Elektroarbeiten' },
  { pos: '2.3', kurztext: 'Unterverteilung 4-reihig', gewerk: 'Elektroarbeiten' },
  { pos: '2.7', kurztext: 'Badentlüfter liefern und montieren', gewerk: 'Elektroarbeiten' },
  { pos: '2.8', kurztext: 'Schalter und Steckdosen erneuern', gewerk: 'Elektroarbeiten' },
  { pos: '2.13', kurztext: 'Zuleitung Keller oder Dach Strom', gewerk: 'Elektroarbeiten' },
  { pos: '3.1', kurztext: 'Sanitärinstallation komplett (inkl. Fliesenarbeiten)', gewerk: 'Sanitärinstallation' },
  { pos: '3.15', kurztext: 'Untertischgerät AEG oder Vaillant', gewerk: 'Sanitärinstallation' },
  { pos: '4.1', kurztext: 'Heizungsarbeiten komplett', gewerk: 'Heizung' },
  { pos: '4.2', kurztext: 'HZ-Leisten liefern und montieren bis', gewerk: 'Heizung' },
  { pos: '4.6', kurztext: 'Thermostatköpfe erneuern', gewerk: 'Heizung' },
  { pos: '4.8', kurztext: 'Therme VAILLANT tauschen kompl.', gewerk: 'Heizung' },
  { pos: '4.9', kurztext: 'Rückbau MAG /Gaszählerdem. u. Abgabe', gewerk: 'Heizung' },
  { pos: '5.9', kurztext: 'BAD Wandfliesen Dünnbett', gewerk: 'Fliesen' },
  { pos: '6.1', kurztext: 'Bodenbeläge entfernen', gewerk: 'Böden' },
  { pos: '6.2', kurztext: 'Ausgleichsestrich', gewerk: 'Böden' },
  { pos: '6.3', kurztext: 'Vinyl-Designboden liefern und verlegen', gewerk: 'Böden' },
  { pos: '7.1', kurztext: 'Türerneuerung Innentür', gewerk: 'Türen' },
  { pos: '7.2', kurztext: 'WE-Tür', gewerk: 'Türen' },
  { pos: '7.3', kurztext: 'Beschläge erneuern', gewerk: 'Türen' },
];

// Daten zusammenstellen
for (const p of positionen) {
  const excelRow = posToExcelRow[p.pos];
  const origRow = origData[excelRow - 1]; // 0-basiert

  // Preis LV 2026 (50m²) = Spalte 9
  let preisLV = '';
  if (origRow && origRow[9]) {
    const val = parseFloat(origRow[9]);
    if (!isNaN(val)) {
      preisLV = val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
  }

  // Kommentar 1:1
  const kommentar = commentsMap[excelRow] || '';

  outputData.push([
    p.pos,
    p.kurztext,
    p.gewerk,
    preisLV,
    preisVorschlaege[p.pos] || '',
    kommentar,
    materialVorschlaege[p.pos] || '',
  ]);
}

console.log('\n=== AUSGABE VORSCHAU ===');
outputData.forEach((row, i) => {
  if (i === 0) {
    console.log('HEADER:', row.join(' | '));
  } else {
    console.log(`${row[0]}: LV ${row[3]} → Vorschlag ${row[4]}`);
  }
});

// Excel erstellen
const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.aoa_to_sheet(outputData);

// Spaltenbreiten
newSheet['!cols'] = [
  { wch: 10 },  // Pos
  { wch: 50 },  // Kurztext
  { wch: 18 },  // Gewerk
  { wch: 18 },  // Preis LV 2026
  { wch: 18 },  // Unser Vorschlag
  { wch: 70 },  // Kommentar
  { wch: 45 },  // Material
];

// Zeilenhöhen
newSheet['!rows'] = outputData.map((_, i) => ({ hpt: i === 0 ? 25 : 60 }));

XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'VBW Preisvorschläge');
XLSX.writeFile(newWorkbook, outputPath);

console.log(`\n\n=== DATEI GESPEICHERT ===`);
console.log(outputPath);
