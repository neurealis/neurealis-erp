/**
 * neurealis PDF Generator
 *
 * Generiert PDFs aus HTML-Templates für:
 * - Angebote (ANG)
 * - Rechnungen (RE)
 * - Auftragsbestätigungen (AB)
 * - Nachträge (NUA)
 * - Beliebige HTML-Dokumente
 *
 * Verwendung:
 *   import { generatePDF, generatePDFFromHTML, generatePDFFromFile } from './lib/pdf-generator.mjs';
 *
 *   // Von HTML-String
 *   await generatePDFFromHTML('<h1>Rechnung</h1>', 'rechnung.pdf');
 *
 *   // Von HTML-Datei
 *   await generatePDFFromFile('template.html', 'output.pdf');
 *
 *   // Mit Template und Daten
 *   await generatePDF('rechnung', { kunde: 'VBW', betrag: 1500 }, 'rechnung.pdf');
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Corporate Design Farben
const colors = {
  primary: '#C41E3A',      // neurealis Rot
  primaryDark: '#A31830',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
};

/**
 * Standard PDF-Optionen
 */
const defaultOptions = {
  format: 'A4',
  margin: {
    top: '20mm',
    right: '15mm',
    bottom: '20mm',
    left: '15mm',
  },
  printBackground: true,
  preferCSSPageSize: true,
};

/**
 * Generiert PDF aus HTML-String
 * @param {string} html - HTML-Inhalt
 * @param {string} outputPath - Ausgabepfad für PDF
 * @param {object} options - PDF-Optionen (optional)
 */
export async function generatePDFFromHTML(html, outputPath, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      ...defaultOptions,
      ...options,
    });

    console.log(`PDF erstellt: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Generiert PDF aus HTML-Datei
 * @param {string} htmlPath - Pfad zur HTML-Datei
 * @param {string} outputPath - Ausgabepfad für PDF
 * @param {object} options - PDF-Optionen (optional)
 */
export async function generatePDFFromFile(htmlPath, outputPath, options = {}) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  return generatePDFFromHTML(html, outputPath, options);
}

/**
 * Generiert PDF aus URL
 * @param {string} url - URL der Seite
 * @param {string} outputPath - Ausgabepfad für PDF
 * @param {object} options - PDF-Optionen (optional)
 */
export async function generatePDFFromURL(url, outputPath, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      ...defaultOptions,
      ...options,
    });

    console.log(`PDF erstellt: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Konvertiert DOCX zu PDF (via HTML-Zwischenschritt)
 * Hinweis: Für komplexe DOCX besser direkt aus Word exportieren
 * @param {string} docxPath - Pfad zur DOCX-Datei
 * @param {string} outputPath - Ausgabepfad für PDF
 */
export async function convertDocxToPDF(docxPath, outputPath) {
  // Mammoth für DOCX → HTML
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ path: docxPath });

  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Calibri, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: ${colors.text};
          max-width: 100%;
        }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th { background-color: ${colors.primary}; color: white; padding: 8px; text-align: left; }
        td { border: 1px solid ${colors.border}; padding: 8px; }
        h1 { color: ${colors.primaryDark}; }
        h2 { color: ${colors.primary}; }
      </style>
    </head>
    <body>${result.value}</body>
    </html>
  `;

  return generatePDFFromHTML(html, outputPath);
}

/**
 * Basis-Template für neurealis Dokumente
 */
export function getBaseTemplate(content, options = {}) {
  const {
    title = 'neurealis Dokument',
    showHeader = true,
    showFooter = true,
    date = new Date().toLocaleDateString('de-DE'),
  } = options;

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', Calibri, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: ${colors.text};
      margin: 0;
      padding: 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 15px;
      border-bottom: 3px solid ${colors.primary};
      margin-bottom: 20px;
    }

    .logo {
      font-size: 24pt;
      font-weight: bold;
      color: ${colors.primary};
    }

    .logo-subtitle {
      font-size: 9pt;
      color: ${colors.textMuted};
    }

    .company-info {
      text-align: right;
      font-size: 8pt;
      color: ${colors.textMuted};
    }

    .document-title {
      font-size: 18pt;
      color: ${colors.primaryDark};
      margin: 20px 0 10px;
    }

    .document-meta {
      color: ${colors.textMuted};
      font-size: 9pt;
      margin-bottom: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }

    th {
      background-color: ${colors.primary};
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
    }

    td {
      border: 1px solid ${colors.border};
      padding: 6px 10px;
    }

    tr:nth-child(even) { background-color: ${colors.background}; }

    .sum-row {
      background-color: ${colors.background} !important;
      font-weight: bold;
    }

    .amount { text-align: right; }

    .total-section {
      margin-top: 20px;
      border-top: 2px solid ${colors.primary};
      padding-top: 15px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }

    .total-row.grand-total {
      font-size: 14pt;
      font-weight: bold;
      color: ${colors.primaryDark};
      border-top: 1px solid ${colors.border};
      padding-top: 10px;
      margin-top: 10px;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 15mm;
      border-top: 1px solid ${colors.border};
      font-size: 7pt;
      color: ${colors.textMuted};
      display: flex;
      justify-content: space-between;
    }

    .bank-info {
      font-size: 7pt;
      color: ${colors.textMuted};
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid ${colors.border};
    }

    .highlight-box {
      background-color: ${colors.background};
      border-left: 4px solid ${colors.primary};
      padding: 10px 15px;
      margin: 15px 0;
    }

    .warning { border-left-color: #f59e0b; }
    .success { border-left-color: #10b981; }

    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${showHeader ? `
  <div class="header">
    <div>
      <div class="logo">neurealis</div>
      <div class="logo-subtitle">Komplettsanierung NRW</div>
    </div>
    <div class="company-info">
      neurealis GmbH<br>
      Grüner Weg 3<br>
      44795 Bochum<br>
      Tel: 0234 / XXX XXX<br>
      holger.neumann@neurealis.de
    </div>
  </div>
  ` : ''}

  <div class="content">
    ${content}
  </div>

  ${showFooter ? `
  <div class="footer">
    <div>neurealis GmbH | Grüner Weg 3 | 44795 Bochum</div>
    <div>Seite <span class="pageNumber"></span></div>
    <div>${date}</div>
  </div>
  ` : ''}
</body>
</html>
`;
}

/**
 * Generiert Rechnung
 * @param {object} data - Rechnungsdaten
 * @param {string} outputPath - Ausgabepfad
 */
export async function generateInvoice(data, outputPath) {
  const {
    rechnungsnummer,
    datum = new Date().toLocaleDateString('de-DE'),
    kunde,
    positionen = [],
    zahlungsziel = '14 Tage netto',
  } = data;

  const netto = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
  const mwst = netto * 0.19;
  const brutto = netto + mwst;

  const positionenHTML = positionen.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.beschreibung}</td>
      <td class="amount">${p.menge}</td>
      <td>${p.einheit || 'Stk'}</td>
      <td class="amount">${p.einzelpreis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
      <td class="amount">${(p.menge * p.einzelpreis).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
    </tr>
  `).join('');

  const content = `
    <h1 class="document-title">Rechnung ${rechnungsnummer}</h1>
    <div class="document-meta">Datum: ${datum}</div>

    <div style="margin-bottom: 30px;">
      <strong>${kunde.firma || kunde.name}</strong><br>
      ${kunde.strasse || ''}<br>
      ${kunde.plz || ''} ${kunde.ort || ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%;">Pos.</th>
          <th style="width: 45%;">Beschreibung</th>
          <th style="width: 10%;">Menge</th>
          <th style="width: 10%;">Einheit</th>
          <th style="width: 15%;">Einzelpreis</th>
          <th style="width: 15%;">Gesamtpreis</th>
        </tr>
      </thead>
      <tbody>
        ${positionenHTML}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <span>Nettobetrag:</span>
        <span>${netto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="total-row">
        <span>MwSt. 19%:</span>
        <span>${mwst.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="total-row grand-total">
        <span>Gesamtbetrag:</span>
        <span>${brutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
    </div>

    <div class="highlight-box" style="margin-top: 30px;">
      <strong>Zahlungsziel:</strong> ${zahlungsziel}<br>
      Bitte überweisen Sie den Betrag auf das unten angegebene Konto.
    </div>

    <div class="bank-info">
      <strong>Bankverbindung:</strong><br>
      IBAN: DE XX XXXX XXXX XXXX XXXX XX | BIC: XXXXX | Sparkasse Bochum
    </div>
  `;

  const html = getBaseTemplate(content, { title: `Rechnung ${rechnungsnummer}`, date: datum });
  return generatePDFFromHTML(html, outputPath);
}

/**
 * Generiert Angebot
 * @param {object} data - Angebotsdaten
 * @param {string} outputPath - Ausgabepfad
 */
export async function generateQuote(data, outputPath) {
  const {
    angebotsnummer,
    datum = new Date().toLocaleDateString('de-DE'),
    gueltigBis,
    kunde,
    bauvorhaben,
    positionen = [],
    bemerkungen = '',
  } = data;

  const netto = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
  const mwst = netto * 0.19;
  const brutto = netto + mwst;

  const positionenHTML = positionen.map((p, i) => `
    <tr>
      <td>${p.pos || (i + 1)}</td>
      <td>${p.beschreibung}</td>
      <td class="amount">${p.menge}</td>
      <td>${p.einheit || 'Stk'}</td>
      <td class="amount">${p.einzelpreis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
      <td class="amount">${(p.menge * p.einzelpreis).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
    </tr>
  `).join('');

  const content = `
    <h1 class="document-title">Angebot ${angebotsnummer}</h1>
    <div class="document-meta">
      Datum: ${datum}${gueltigBis ? ` | Gültig bis: ${gueltigBis}` : ''}
    </div>

    <div style="margin-bottom: 20px;">
      <strong>${kunde.firma || kunde.name}</strong><br>
      ${kunde.ansprechpartner ? kunde.ansprechpartner + '<br>' : ''}
      ${kunde.strasse || ''}<br>
      ${kunde.plz || ''} ${kunde.ort || ''}
    </div>

    ${bauvorhaben ? `
    <div class="highlight-box">
      <strong>Bauvorhaben:</strong> ${bauvorhaben.name || bauvorhaben}<br>
      ${bauvorhaben.adresse ? `<strong>Adresse:</strong> ${bauvorhaben.adresse}` : ''}
    </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th style="width: 5%;">Pos.</th>
          <th style="width: 45%;">Beschreibung</th>
          <th style="width: 10%;">Menge</th>
          <th style="width: 10%;">Einheit</th>
          <th style="width: 15%;">Einzelpreis</th>
          <th style="width: 15%;">Gesamtpreis</th>
        </tr>
      </thead>
      <tbody>
        ${positionenHTML}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <span>Nettobetrag:</span>
        <span>${netto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="total-row">
        <span>MwSt. 19%:</span>
        <span>${mwst.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="total-row grand-total">
        <span>Angebotssumme:</span>
        <span>${brutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
    </div>

    ${bemerkungen ? `
    <div style="margin-top: 30px;">
      <strong>Bemerkungen:</strong><br>
      ${bemerkungen}
    </div>
    ` : ''}

    <div style="margin-top: 40px; font-size: 9pt; color: ${colors.textMuted};">
      Wir freuen uns auf Ihre Beauftragung und stehen für Rückfragen gerne zur Verfügung.
    </div>
  `;

  const html = getBaseTemplate(content, { title: `Angebot ${angebotsnummer}`, date: datum });
  return generatePDFFromHTML(html, outputPath);
}

// CLI-Unterstützung
if (process.argv[1] && process.argv[1].includes('pdf-generator')) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
neurealis PDF Generator

Verwendung:
  node lib/pdf-generator.mjs <input> <output> [options]

Beispiele:
  node lib/pdf-generator.mjs dokument.html ausgabe.pdf
  node lib/pdf-generator.mjs https://example.com seite.pdf

Optionen:
  --landscape    Querformat
  --no-header    Ohne Kopfzeile
  --no-footer    Ohne Fußzeile
`);
    process.exit(0);
  }

  const [input, output] = args;
  const isURL = input.startsWith('http://') || input.startsWith('https://');
  const isHTML = input.endsWith('.html') || input.endsWith('.htm');

  try {
    if (isURL) {
      await generatePDFFromURL(input, output);
    } else if (isHTML) {
      await generatePDFFromFile(input, output);
    } else {
      console.error('Unbekanntes Eingabeformat. Unterstützt: .html, .htm, URLs');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fehler:', error.message);
    process.exit(1);
  }
}

export default {
  generatePDFFromHTML,
  generatePDFFromFile,
  generatePDFFromURL,
  generateInvoice,
  generateQuote,
  getBaseTemplate,
  colors,
};
