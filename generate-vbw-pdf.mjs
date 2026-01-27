import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const fs = require('fs');

// Corporate Design Farben
const colors = {
  primary: '#C41E3A',      // neurealis Rot
  primaryDark: '#A31830',
  success: '#10b981',      // Grün für positive Werte
  error: '#ef4444',        // Rot für negative Werte
  gray: '#6b7280',
  grayLight: '#f3f4f6',
  grayDark: '#1f2937',
  white: '#ffffff',
};

// Original-Excel laden
const originalPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV 2026 - Preisvergleich vs 2023 - Beispiel-Berechnungen & Vorschläge Material.xlsx';
const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV 2026 - Preisvorschläge neurealis.pdf';

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
        commentsMap[row] = fixUmlaute(comments.join(' | '));
      }
    }
  }
}

// Daten
const materialMap = {
  '2.1': 'Gira Standard 55 (statt S2)',
  '2.7': 'Emco (mit Nachlauf) ca. 100€',
  '2.8': 'Gira Standard 55 (statt S2)',
  '3.1': 'Vigour One',
  '4.6': 'Bei Danfoss → 2x Position',
  '5.9': 'Kermos Wand-/Bodenfliesen 8mm',
  '6.2': 'bis 3mm, sonst mehrfach',
  '7.1': 'Prüm Röhrenspahn',
  '7.2': 'Prüm KK2 RC2 (EK: 1.050€)',
  '7.3': 'Becher/Hoppe Amsterdam',
};

const posToExcelRow = {
  '2.1': 18, '2.3': 20, '2.7': 24, '2.8': 25, '2.13': 30,
  '3.1': 36, '3.15': 50,
  '4.1': 54, '4.2': 55, '4.6': 59, '4.8': 61, '4.9': 62,
  '5.9': 72,
  '6.1': 80, '6.2': 81, '6.3': 82,
  '7.1': 85, '7.2': 86, '7.3': 87,
};

const positionen = [
  { pos: '2.1', kurztext: 'E-Anlage erneuern inkl. Baufassungen', gewerk: 'Elektro' },
  { pos: '2.3', kurztext: 'Unterverteilung 4-reihig', gewerk: 'Elektro' },
  { pos: '2.7', kurztext: 'Badentlüfter liefern und montieren', gewerk: 'Elektro' },
  { pos: '2.8', kurztext: 'Schalter und Steckdosen erneuern', gewerk: 'Elektro' },
  { pos: '2.13', kurztext: 'Zuleitung Keller oder Dach Strom', gewerk: 'Elektro' },
  { pos: '3.1', kurztext: 'Sanitärinstallation komplett (inkl. Fliesen)', gewerk: 'Sanitär' },
  { pos: '3.15', kurztext: 'Untertischgerät AEG/Vaillant', gewerk: 'Sanitär' },
  { pos: '4.1', kurztext: 'Heizungsarbeiten komplett', gewerk: 'Heizung' },
  { pos: '4.2', kurztext: 'HZ-Leisten liefern und montieren', gewerk: 'Heizung' },
  { pos: '4.6', kurztext: 'Thermostatköpfe erneuern', gewerk: 'Heizung' },
  { pos: '4.8', kurztext: 'Therme VAILLANT tauschen kompl.', gewerk: 'Heizung' },
  { pos: '4.9', kurztext: 'Rückbau MAG/Gaszählerdem.', gewerk: 'Heizung' },
  { pos: '5.9', kurztext: 'BAD Wandfliesen Dünnbett', gewerk: 'Fliesen' },
  { pos: '6.1', kurztext: 'Bodenbeläge entfernen', gewerk: 'Böden' },
  { pos: '6.2', kurztext: 'Ausgleichsestrich', gewerk: 'Böden' },
  { pos: '6.3', kurztext: 'Vinyl-Designboden liefern/verlegen', gewerk: 'Böden' },
  { pos: '7.1', kurztext: 'Türerneuerung Innentür', gewerk: 'Türen' },
  { pos: '7.2', kurztext: 'WE-Tür', gewerk: 'Türen' },
  { pos: '7.3', kurztext: 'Beschläge erneuern', gewerk: 'Türen' },
];

// PDF erstellen
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 40, right: 40 },
  info: {
    Title: 'VBW LV 2026 - Preisvergleich & Materialvorschläge',
    Author: 'neurealis GmbH',
  }
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Header mit Logo-Bereich
doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);

doc.fillColor(colors.white)
   .fontSize(24)
   .font('Helvetica-Bold')
   .text('neurealis', 40, 25);

doc.fontSize(10)
   .font('Helvetica')
   .text('Komplettsanierung NRW', 40, 52);

doc.fillColor(colors.white)
   .fontSize(12)
   .font('Helvetica')
   .text('VBW LV 2026 - Preisvergleich & Materialvorschläge', 300, 35, { align: 'right', width: 220 });

doc.fontSize(10)
   .text('Stand: 27.01.2026', 300, 52, { align: 'right', width: 220 });

// Abstand nach Header
doc.y = 100;

// Einleitung
doc.fillColor(colors.grayDark)
   .fontSize(11)
   .font('Helvetica')
   .text('Übersicht der kommentierten Positionen mit Preisvergleich 2023 vs. 2026 (Basis: 50m² Wohnung, alle Preise netto)', 40, doc.y, { width: 515 });

doc.moveDown(0.8);

// Tabellen-Header
const tableTop = doc.y;
const colWidths = [35, 180, 70, 70, 50, 110];
const colX = [40, 75, 255, 325, 395, 445];

// Header-Zeile
doc.rect(40, tableTop, 515, 22).fill(colors.primary);

doc.fillColor(colors.white)
   .fontSize(9)
   .font('Helvetica-Bold');

doc.text('Pos.', colX[0] + 3, tableTop + 6);
doc.text('Kurztext', colX[1] + 3, tableTop + 6);
doc.text('LV 2023', colX[2] + 3, tableTop + 6);
doc.text('LV 2026', colX[3] + 3, tableTop + 6);
doc.text('Δ %', colX[4] + 3, tableTop + 6);
doc.text('Material', colX[5] + 3, tableTop + 6);

let y = tableTop + 22;
let rowIndex = 0;

// Daten-Zeilen
for (const p of positionen) {
  const excelRow = posToExcelRow[p.pos];
  const origRow = origData[excelRow - 1];

  let preis2023 = parseFloat(origRow?.[8]) || 0;
  let preis2026 = parseFloat(origRow?.[9]) || 0;
  let diff = 0;
  let diffStr = '';

  if (preis2023 > 0 && preis2026 > 0) {
    diff = ((preis2026 - preis2023) / preis2023) * 100;
    diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  }

  const material = materialMap[p.pos] || '';
  const rowHeight = material.length > 25 ? 28 : 20;

  // Neue Seite wenn nötig
  if (y + rowHeight > doc.page.height - 80) {
    doc.addPage();
    y = 50;

    // Header auf neuer Seite
    doc.rect(40, y, 515, 22).fill(colors.primary);
    doc.fillColor(colors.white).fontSize(9).font('Helvetica-Bold');
    doc.text('Pos.', colX[0] + 3, y + 6);
    doc.text('Kurztext', colX[1] + 3, y + 6);
    doc.text('LV 2023', colX[2] + 3, y + 6);
    doc.text('LV 2026', colX[3] + 3, y + 6);
    doc.text('Δ %', colX[4] + 3, y + 6);
    doc.text('Material', colX[5] + 3, y + 6);
    y += 22;
  }

  // Zebra-Streifen
  if (rowIndex % 2 === 1) {
    doc.rect(40, y, 515, rowHeight).fill(colors.grayLight);
  }

  doc.fillColor(colors.grayDark).fontSize(8).font('Helvetica');

  // Position
  doc.text(p.pos, colX[0] + 3, y + 5, { width: 30 });

  // Kurztext
  doc.text(p.kurztext, colX[1] + 3, y + 5, { width: 175 });

  // Preise
  doc.text(preis2023 > 0 ? preis2023.toLocaleString('de-DE') + ' €' : '-', colX[2] + 3, y + 5, { width: 65 });
  doc.text(preis2026 > 0 ? preis2026.toLocaleString('de-DE') + ' €' : '-', colX[3] + 3, y + 5, { width: 65 });

  // Diff mit Farbe
  if (diffStr) {
    doc.fillColor(diff >= 0 ? colors.success : colors.error)
       .font('Helvetica-Bold')
       .text(diffStr, colX[4] + 3, y + 5, { width: 45 });
  }

  // Material
  doc.fillColor(colors.primaryDark)
     .font('Helvetica')
     .fontSize(7)
     .text(material, colX[5] + 3, y + 5, { width: 105 });

  y += rowHeight;
  rowIndex++;
}

// Linie unter Tabelle
doc.strokeColor(colors.primary).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();

// Zusammenfassung
y += 20;
doc.fillColor(colors.grayDark).fontSize(11).font('Helvetica-Bold').text('Zusammenfassung', 40, y);
y += 18;

doc.fontSize(9).font('Helvetica');

const summaryItems = [
  '• Größte Preissteigerungen: Sanitär komplett (+92%), Therme Vaillant (+62%)',
  '• Preissenkungen: Vinyl (-25%), Ausgleichsestrich (-15%), Bodenbeläge entfernen (-27%)',
  '• Hinweis: Position 6.2 (Ausgleichsestrich) enthält NICHT Säubern + Grundieren',
  '• Empfohlene Materialstandards: Gira Standard 55, Vigour One, Kermos Fliesen, Prüm Türen',
];

for (const item of summaryItems) {
  doc.text(item, 40, y, { width: 515 });
  y += 14;
}

// Verhandlungspunkte
y += 15;
doc.fillColor(colors.primary).fontSize(11).font('Helvetica-Bold').text('Verhandlungspunkte', 40, y);
y += 18;

doc.fillColor(colors.grayDark).fontSize(9).font('Helvetica');

const verhandlungItems = [
  '• Zahlungskonditionen: 14 Tage -3% Skonto, 30 Tage netto',
  '• Beauftragungsmenge klären',
  '• Materialstandards verbindlich festlegen',
  '• Separate Position für Untergrundvorbereitung (Säubern, Grundieren) aufnehmen',
];

for (const item of verhandlungItems) {
  doc.text(item, 40, y, { width: 515 });
  y += 14;
}

// Footer
const footerY = doc.page.height - 40;
doc.rect(0, footerY - 10, doc.page.width, 50).fill(colors.grayLight);

doc.fillColor(colors.gray)
   .fontSize(8)
   .font('Helvetica')
   .text('neurealis GmbH | Komplettsanierung NRW | holger.neumann@neurealis.de', 40, footerY, { width: 300 });

doc.text('Seite 1 | Vertraulich', 400, footerY, { align: 'right', width: 155 });

// PDF abschließen
doc.end();

writeStream.on('finish', () => {
  console.log('PDF erstellt:', outputPath);
});
