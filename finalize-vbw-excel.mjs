import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - LV - Preisvergleich 2023 vs 2026 - Beispiel-Berechnungen & Vorschläge Material.xlsx';
const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-27 VBW - Materialvorschläge und Preisvergleich.xlsx';

// Supabase-Vergleichsdaten (aus der Abfrage)
const vergleichsDaten = {
  1: [
    { art: 'GWS.LV23-20.02.1', bez: 'Elektroneuinstallation (ohne UV, Keller, Balkon, Bad)', preis: '2.500€', typ: 'GWS' }
  ],
  2: [
    { art: 'GWS.LV23-20.01.5', bez: 'Unterverteilung (ohne Aufputz-Wanne)', preis: '459€', typ: 'GWS' },
    { art: 'CV24.GS53.01.01.0164', bez: 'Unterverteilung 4-reihig u.P.', preis: '302€', typ: 'covivio' }
  ],
  3: [
    { art: 'Elektrik-Badlüfter', bez: 'Elektrischer Lüfter Bad', preis: '125€', typ: 'Privat' }
  ],
  5: [
    { art: 'WBG-24d0a6ae', bez: 'Wohnungszuleitung (Kamin/auf Putz)', preis: '503€', typ: 'WBG Lünen' },
    { art: 'Elektrik-Mieterkeller', bez: 'Elektroneuinstallation Mieterkeller', preis: '263€', typ: 'neurealis' }
  ],
  7: [
    { art: 'CV24.GS53.01.01.0360', bez: 'Brennstelle Untertischgerät/Thermofix', preis: '36€', typ: 'covivio' }
  ],
  10: [
    { art: '90606364', bez: 'Brause-AP-Thermostat (concept 100)', preis: '2.305€ (Artikel)', typ: 'Artikel' }
  ],
  11: [
    { art: '91015993', bez: 'WOLF Gasbrennwert-Heiztherme CGB-2-75', preis: '9.465€ (Artikel)', typ: 'Artikel' },
    { art: 'Sanitär-HeizungInst...', bez: 'Installation Gasbrennwerttherme', preis: '5.796€', typ: 'Privat' }
  ],
  12: [
    { art: 'CV24.LS44.11.01.0040', bez: 'Therme/MAG außer Betrieb nehmen', preis: '111€', typ: 'covivio' }
  ],
  13: [
    { art: 'Fliesen-Lackierung', bez: 'Lackieren von Wandfliesen', preis: '35€/m²', typ: 'Privat' },
    { art: 'GWS.LV23-06.01.21', bez: 'Verfugung Wandfliesenbelag', preis: '10€/m²', typ: 'GWS' }
  ],
  15: [
    { art: 'Boden-Ausgleichsmasse-Weichmachersperre', bez: 'Nivellierausgleich mit Weichmachersperre', preis: '1.085€ (pauschal)', typ: 'neurealis' },
    { art: 'Boden-BodenAusgleichsmasseNivve', bez: 'Ausgleichsmasse (Nivellierausgleich)', preis: '13,35€/m²', typ: 'Privat' }
  ],
  16: [
    { art: '532140014', bez: 'Bodenbelag Vinyl Planken', preis: '352€', typ: 'neurealis' },
    { art: 'Treppe-Verkleidung-Vinyl', bez: 'Treppenstufe mit Vinyl', preis: '80€/Stufe', typ: 'Privat' }
  ],
  17: [
    { art: 'Rückbau-Innentür', bez: 'Rückbau Innentür', preis: '67€', typ: 'Privat' },
    { art: 'CV24.GS27.01.08.0300', bez: 'Glasausschnitt Innentüren verschließen', preis: '62€', typ: 'covivio' }
  ],
  18: [
    { art: 'CV24.GS27.01.05.0050', bez: 'WE-Tür RC2 86/198,5', preis: '1.203€', typ: 'covivio' },
    { art: 'CV24.GS27.01.05.0020', bez: 'WE-Tür Kassette 98,5/198,5', preis: '1.170€', typ: 'covivio' },
    { art: 'CV24.GS27.01.05.0010', bez: 'WE-Tür Kassette 86,5/198,5', preis: '1.105€', typ: 'covivio' }
  ],
  19: [
    { art: 'CV24.GS27.01.08.0370', bez: 'Drückergarnitur Hoppe Amsterdam', preis: '24€', typ: 'covivio' },
    { art: 'CV24.GS27.01.08.0380', bez: 'Drückergarnitur Messing Langschild', preis: '29€', typ: 'covivio' },
    { art: 'CV24.GS27.01.01.0140', bez: 'Zulage Drückergarnitur Hoppe Amsterdam', preis: '16€', typ: 'covivio' }
  ]
};

// Excel laden
const workbook = XLSX.readFile(filePath, { cellStyles: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Alle Kommentare extrahieren
const commentsMap = {};
for (const cellAddr in sheet) {
  if (cellAddr.startsWith('!')) continue;
  const cell = sheet[cellAddr];
  if (cell && cell.c && cell.c.length > 0) {
    const match = cellAddr.match(/([A-Z]+)(\d+)/);
    if (match) {
      const row = parseInt(match[2]);
      const comments = cell.c.map(c => {
        if (c.a && c.a.includes('ADA24A63')) return null;
        return c.t;
      }).filter(Boolean);
      if (comments.length > 0) {
        commentsMap[row] = { value: cell.v, comments: comments.join('\n---\n') };
      }
    }
  }
}

const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

// Mapping: VBW-Position → Vergleichs-Index
const posToIdx = {
  '2.1': 1, '2.3': 2, '2.7': 3, '2.8': 4, '2.13': 5, '3.1': 6, '3.15': 7,
  '4.1': 8, '4.2': 9, '4.6': 10, '4.8': 11, '4.9': 12, '5.9': 13,
  '6.1': 14, '6.2': 15, '6.3': 16, '7.1': 17, '7.2': 18, '7.3': 19
};

// Ausgabedaten erstellen
const outputData = [];

outputData.push([
  'Pos. NEU',
  'Kurztext NEU (2026)',
  'Gewerk',
  'Preis LV 2026',
  'Unser Vorschlag',
  'Begründung / Kommentar',
  'Material-Vorschlag',
  'Vergleich andere Kunden'
]);

function extractMaterial(comment) {
  const patterns = [/Vorschlag:\s*([^,\n]+)/gi, /Vorschlag\s+([^\n,]+(?:\([^)]+\))?)/gi];
  const materials = [];
  for (const p of patterns) {
    for (const m of comment.matchAll(p)) {
      let mat = m[1].trim();
      // Cleanup
      mat = mat.replace(/^Material\s+/i, '').replace(/^bei\s+/i, '');
      if (mat.length > 3 && !mat.match(/^\d+/)) materials.push(mat);
    }
  }
  return [...new Set(materials)].join('\n');
}

function extractPrice(comment) {
  const hints = [];
  // EK-Hinweise
  if (comment.match(/EK[:\s]/i)) {
    const m = comment.match(/EK[:\s]+([^\n,]+)/i);
    if (m) hints.push('EK: ' + m[1].trim());
  }
  // Preisbezogene Sätze
  const sentences = comment.split(/[.\n]/);
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (lower.includes('preis') || lower.includes('teuer') || lower.includes('niedrig') || lower.includes('auskömmlich') || lower.includes('auskömm')) {
      hints.push(s.trim());
    }
  }
  // Direkte €-Preise mit Kontext
  const priceMatch = comment.match(/(\d+(?:[.,]\d+)?)\s*€(?:\/m²)?[^€\n]*/g);
  if (priceMatch) {
    for (const pm of priceMatch) {
      if (!hints.some(h => h.includes(pm.trim()))) hints.push(pm.trim());
    }
  }
  return [...new Set(hints)].join('\n');
}

// Preisvorschläge basierend auf Kommentaren (alle netto)
const preisVorschlaege = {
  '2.1': '2.300 €', // E-Anlage - Gira S55 statt S2
  '2.3': '710 €', // UV 4-reihig - Preissteigerung +10,9%
  '2.7': '320 €', // Badentlüfter - Emco ca. 100€ EK + Montage
  '2.8': '430 €', // Schalter - Gira S55
  '2.13': '210 €', // Zuleitung - max 3m, exkl. Brandschutz
  '3.1': '6.500 €', // Sanitär komplett - Material Vigour One
  '3.15': '150 €', // Untertischgerät - EK prüfen
  '4.1': '3.100 €', // Heizung komplett - Preissteigerung Material/Lohn
  '4.2': '900 €', // HZ-Leisten - teuer im EK
  '4.6': '130 €', // Thermostatköpfe - bei Danfoss 2x Position
  '4.8': '4.300 €', // Therme - Preis zu niedrig, inkl. Raumregler, Anschlüsse
  '4.9': '250 €', // MAG Rückbau - Stadtwerke-Abmeldung aufwendig
  '5.9': '2.100 €', // Wandfliesen - Kermos 8mm bessere Qualität
  '6.1': '300 €', // Bodenbeläge entfernen - fest verlegt aufwendiger
  '6.2': '500 €', // Ausgleichsestrich - bis 3mm, sonst mehrfach
  '6.3': '1.400 €', // Vinyl - 12,75€/m² (7,5+2+2,75+0,5)
  '7.1': '1.450 €', // Innentür - Prüm Röhrenspahn + 2x LA
  '7.2': '1.200 €', // WE-Tür - EK 1.050€, Prüm KK2 RC2
  '7.3': '320 €', // Beschläge - Becher/Hoppe Amsterdam
};

function cleanComment(comment) {
  return comment
    .replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü').replace(/Ã/g, 'ß')
    .replace(/â¬/g, '€').replace(/Â²/g, '²').replace(/&amp;/g, '&');
}

// Zeilen verarbeiten
let rowCounter = 0;
for (let rowIdx = 4; rowIdx < data.length; rowIdx++) {
  const excelRow = rowIdx + 1;
  if (!commentsMap[excelRow]) continue;

  rowCounter++;
  const row = data[rowIdx];
  const comment = cleanComment(commentsMap[excelRow].comments);
  const posNeu = row[1] || '';
  const idx = posToIdx[posNeu];

  // Vergleichspositionen formatieren
  let vergleich = '';
  if (idx && vergleichsDaten[idx]) {
    vergleich = vergleichsDaten[idx].map(v =>
      `${v.art}\n${v.bez}\n${v.preis} (${v.typ})`
    ).join('\n\n');
  }

  const vorschlag = preisVorschlaege[posNeu] || '';

  outputData.push([
    posNeu,
    row[3] || '',  // Kurztext NEU
    row[4] || '',  // Gewerk
    row[6] || '',  // Preis LV 2026
    vorschlag,     // Unser Vorschlag
    comment,       // Begründung
    extractMaterial(comment),
    vergleich
  ]);
}

console.log(`\n=== ${rowCounter} Positionen mit Kommentaren extrahiert ===\n`);

// Bereinigte Tabelle ohne leere Zeilen
const cleanData = outputData.filter((row, i) => i === 0 || row[1] !== '');

// Excel erstellen
const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.aoa_to_sheet(cleanData);

// Spaltenbreiten
newSheet['!cols'] = [
  { wch: 8 },   // Pos
  { wch: 45 },  // Kurztext
  { wch: 18 },  // Gewerk
  { wch: 14 },  // Preis LV 2026
  { wch: 14 },  // Unser Vorschlag
  { wch: 55 },  // Begründung
  { wch: 35 },  // Material
  { wch: 50 },  // Vergleich
];

// Zeilenhöhen für bessere Lesbarkeit
newSheet['!rows'] = cleanData.map((_, i) => ({ hpt: i === 0 ? 30 : 80 }));

XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'VBW Materialvorschläge');
XLSX.writeFile(newWorkbook, outputPath);

console.log(`Datei gespeichert: ${outputPath}`);
console.log(`\nÜbersicht für Verhandlung morgen:`);
console.log(`- ${cleanData.length - 1} kritische Positionen mit Anmerkungen`);
console.log(`- Materialvorschläge: Gira Standard 55, Vigour One, Kermos Fliesen, Prüm Türen, etc.`);
console.log(`- Preisvergleiche von: GWS, covivio, WBG Lünen, neurealis, Privat`);
