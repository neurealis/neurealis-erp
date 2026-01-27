import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV 2026 - Preisvorschläge neurealis.xlsx';

// Original-Excel laden
const originalPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';
const origWorkbook = XLSX.readFile(originalPath, { cellStyles: true });
const origSheet = origWorkbook.Sheets[origWorkbook.SheetNames[0]];
const origData = XLSX.utils.sheet_to_json(origSheet, { header: 1, raw: true, defval: '' });

// Umlaute korrigieren
function fixUmlaute(text) {
  if (!text) return '';
  return String(text)
    .replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä').replace(/Ã–/g, 'Ö').replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß').replace(/Ã/g, 'ß')
    .replace(/â¬/g, '€').replace(/Â²/g, '²').replace(/&amp;/g, '&');
}

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
        commentsMap[row] = fixUmlaute(comments.join('\n---\n'));
      }
    }
  }
}

// Materialvorschläge
const materialMap = {
  '2.1': 'Gira Standard 55 (statt S2)',
  '2.3': '',
  '2.7': 'Emco (mit Nachlauf) ca. 100€',
  '2.8': 'Gira Standard 55 (statt S2)',
  '2.13': '',
  '3.1': 'Vigour One',
  '3.15': '',
  '4.1': '',
  '4.2': '',
  '4.6': 'Bei Danfoss (Verschraubung) → 2x Position',
  '4.8': '',
  '4.9': '',
  '5.9': 'Kermos Wand- und Bodenfliesen 8mm\n(DK02 nicht rutschhemmend)',
  '6.1': '',
  '6.2': 'bis 3mm, sonst mehrfach',
  '6.3': '',
  '7.1': 'Prüm Röhrenspahn (Wabe wo möglich)\n2x Lichtausschnitt: +85€/Tür',
  '7.2': 'Prüm KK2 RC2\n(EK Material: 1.050€)',
  '7.3': 'Becher Eigenmarke (Hoppe Amsterdam)',
};

// Preisvorschläge (nur wenn explizit erwähnt)
const preisVorschlagMap = {
  '4.9': '250 €',
  '7.2': '1.200 €',
};

// Vergleichspositionen
const vergleichsPositionen = {
  '2.1': 'GWS.LV23-20.02.1\nElektroneuinstallation (ohne UV)\n2.500 € (GWS)',
  '2.3': 'GWS.LV23-20.01.5\nUnterverteilung (ohne Aufputz)\n459 € (GWS)\n\nCV24.GS53.01.01.0164\nUnterverteilung 4-reihig u.P.\n302 € (covivio)',
  '2.7': 'Elektrik-Badlüfter\nElektrischer Lüfter Bad\n125 € (Privat)',
  '2.8': '',
  '2.13': 'WBG-24d0a6ae\nWohnungszuleitung\n503 € (WBG Lünen)',
  '3.1': '',
  '3.15': 'CV24.GS53.01.01.0360\nBrennstelle Untertischgerät\n36 € (covivio)',
  '4.1': '',
  '4.2': '',
  '4.6': '',
  '4.8': '91015993\nWOLF Gasbrennwert-Heiztherme\n9.465 € (Artikel EK)\n\nSanitär-HeizungInst...\nInstallation Gasbrennwerttherme\n5.796 € (Privat)',
  '4.9': 'CV24.LS44.11.01.0040\nTherme/MAG außer Betrieb\n111 € (covivio)',
  '5.9': 'GWS.LV23-06.01.21\nVerfugung Wandfliesenbelag\n10 €/m² (GWS)',
  '6.1': '',
  '6.2': 'Boden-Ausgleichsmasse\nNivellierausgleich\n13,35 €/m² (Privat)',
  '6.3': '532140014\nBodenbelag Vinyl Planken\n352 € (neurealis)',
  '7.1': 'Rückbau-Innentür\nRückbau Innentür\n67 € (Privat)',
  '7.2': 'CV24.GS27.01.05.0050\nWE-Tür RC2 86/198,5\n1.203 € (covivio)\n\nCV24.GS27.01.05.0010\nWE-Tür Kassette 86,5/198,5\n1.105 € (covivio)',
  '7.3': 'CV24.GS27.01.08.0370\nDrückergarnitur Hoppe Amsterdam\n24 € (covivio)',
};

// Mapping Pos NEU → Excel-Zeile
const posToExcelRow = {
  '2.1': 18, '2.3': 20, '2.7': 24, '2.8': 25, '2.13': 30,
  '3.1': 36, '3.15': 50,
  '4.1': 54, '4.2': 55, '4.6': 59, '4.8': 61, '4.9': 62,
  '5.9': 72,
  '6.1': 80, '6.2': 81, '6.3': 82,
  '7.1': 85, '7.2': 86, '7.3': 87,
};

// Positionen
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

// Ausgabe erstellen
const outputData = [];

// Header - neue Reihenfolge
outputData.push([
  'Pos. NEU',           // A
  'Kurztext NEU (2026)',// B
  'Gewerk',             // C
  'LV 2023\n(50m²)',    // D
  'LV 2026\n(50m²)',    // E
  'Δ %',                // F
  'Preisvorschlag',     // G
  'Material-Vorschlag', // H
  'Kommentar (Original)',// I
  'Vergleichsposition\n(Artikel / Preis / Kunde)', // J
]);

// Zellen für bedingte Formatierung speichern
const diffCells = [];

// Daten
for (const p of positionen) {
  const excelRow = posToExcelRow[p.pos];
  const origRow = origData[excelRow - 1];

  // Preis 2023 (50m²) = Spalte 8, Preis 2026 (50m²) = Spalte 9
  let preis2023 = 0, preis2026 = 0;
  let preis2023Str = '', preis2026Str = '', diffStr = '';

  if (origRow) {
    preis2023 = parseFloat(origRow[8]) || 0;
    preis2026 = parseFloat(origRow[9]) || 0;

    if (preis2023 > 0) {
      preis2023Str = preis2023.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
    if (preis2026 > 0) {
      preis2026Str = preis2026.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
    if (preis2023 > 0 && preis2026 > 0) {
      const diff = ((preis2026 - preis2023) / preis2023) * 100;
      diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
      diffCells.push({ row: outputData.length, diff: diff });
    }
  }

  const kommentar = commentsMap[excelRow] || '';
  const preisVorschlag = preisVorschlagMap[p.pos] || '';
  const material = materialMap[p.pos] || '';
  const vergleich = vergleichsPositionen[p.pos] || '';

  outputData.push([
    p.pos,
    p.kurztext,
    p.gewerk,
    preis2023Str,
    preis2026Str,
    diffStr,
    preisVorschlag,
    material,
    kommentar,
    vergleich,
  ]);
}

console.log('=== VORSCHAU ===\n');
outputData.slice(1).forEach((row, i) => {
  console.log(`${row[0]}: 2023: ${row[3]} → 2026: ${row[4]} (${row[5]})`);
});

// Excel erstellen
const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.aoa_to_sheet(outputData);

// Spaltenbreiten
newSheet['!cols'] = [
  { wch: 10 },  // A Pos
  { wch: 48 },  // B Kurztext
  { wch: 16 },  // C Gewerk
  { wch: 14 },  // D LV 2023
  { wch: 14 },  // E LV 2026
  { wch: 10 },  // F Diff %
  { wch: 14 },  // G Preisvorschlag
  { wch: 38 },  // H Material
  { wch: 60 },  // I Kommentar
  { wch: 42 },  // J Vergleich
];

// Zeilenhöhen
newSheet['!rows'] = outputData.map((_, i) => ({ hpt: i === 0 ? 35 : 65 }));

// Bedingte Formatierung für Diff-Spalte (F) - Farben setzen
for (const dc of diffCells) {
  const cellRef = XLSX.utils.encode_cell({ r: dc.row, c: 5 }); // Spalte F = Index 5
  if (!newSheet[cellRef]) continue;

  // Hintergrundfarbe setzen
  if (dc.diff < 0) {
    // Negativ = Rot
    newSheet[cellRef].s = {
      fill: { fgColor: { rgb: 'FFCCCC' } },
      font: { color: { rgb: 'CC0000' } }
    };
  } else if (dc.diff > 0) {
    // Positiv = Grün
    newSheet[cellRef].s = {
      fill: { fgColor: { rgb: 'CCFFCC' } },
      font: { color: { rgb: '006600' } }
    };
  }
}

XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'VBW Preisvorschläge');

// Mit Styles speichern
XLSX.writeFile(newWorkbook, outputPath, { cellStyles: true });

console.log('\n=== GESPEICHERT ===');
console.log(outputPath);
console.log('\nHinweis: xlsx-js unterstützt keine Zellfarben direkt.');
console.log('Bitte in Excel die Spalte F manuell formatieren:');
console.log('- Bedingte Formatierung → Regeln zum Hervorheben');
console.log('- Negativ (mit -): Rot hinterlegt');
console.log('- Positiv (mit +): Grün hinterlegt');
