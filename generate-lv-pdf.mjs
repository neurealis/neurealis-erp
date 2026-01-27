/**
 * neurealis Leistungsverzeichnis PDF Generator
 * Generiert ein professionelles PDF aus den LV-Positionen mit Typ "neurealis"
 */

import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Supabase Konfiguration
const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Datum und Version
const heute = new Date();
const datumFormatiert = heute.toLocaleDateString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});
const version = `v${heute.getFullYear()}.${String(heute.getMonth() + 1).padStart(2, '0')}.${String(heute.getDate()).padStart(2, '0')}`;

// Ausgabepfad
const outputDir = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\01 Preise & Kalkulationen\\neurealis Leistungsverzeichnis';
const outputFileName = `neurealis_Leistungsverzeichnis_${version}.pdf`;
const outputPath = path.join(outputDir, outputFileName);

// HTML-Tags entfernen für sauberen Text
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '  • ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Preis formatieren
function formatPreis(preis) {
  if (!preis) return '-';
  const num = parseFloat(preis);
  if (isNaN(num)) return '-';
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

async function generatePDF() {
  console.log('📋 neurealis Leistungsverzeichnis PDF Generator');
  console.log('=' .repeat(50));

  // Daten aus Supabase holen
  console.log('\n📥 Lade LV-Positionen aus Supabase...');

  const { data, error } = await supabase
    .from('lv_positionen')
    .select('artikelnummer, bezeichnung, beschreibung, preis, listenpreis, einheit, gewerk')
    .eq('lv_typ', 'neurealis')
    .eq('aktiv', true)
    .order('gewerk')
    .order('artikelnummer');

  if (error) {
    console.error('❌ Fehler beim Laden:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${data.length} Positionen geladen`);

  // Nach Gewerk gruppieren
  const gewerke = {};
  for (const pos of data) {
    const gewerk = pos.gewerk || 'Sonstiges';
    if (!gewerke[gewerk]) gewerke[gewerk] = [];
    gewerke[gewerk].push(pos);
  }

  console.log(`📂 ${Object.keys(gewerke).length} Gewerke gefunden`);

  // PDF erstellen
  console.log('\n📄 Erstelle PDF...');

  // Prüfen ob Ausgabeverzeichnis existiert
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Erstelle Verzeichnis: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 50, right: 50 },
    info: {
      Title: 'neurealis Leistungsverzeichnis',
      Author: 'neurealis GmbH',
      Subject: 'Leistungsverzeichnis für Wohnungssanierung',
      Keywords: 'Leistungsverzeichnis, Sanierung, neurealis',
      CreationDate: heute
    }
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Farben
  const primaryColor = '#1a365d';    // Dunkelblau
  const secondaryColor = '#2b6cb0';  // Mittelblau
  const accentColor = '#4299e1';     // Hellblau
  const textColor = '#2d3748';       // Dunkelgrau
  const lightGray = '#e2e8f0';       // Hellgrau

  // === TITELSEITE ===
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7fafc');

  // Oberer Balken
  doc.rect(0, 0, doc.page.width, 200).fill(primaryColor);

  // Titel
  doc.fillColor('#ffffff')
     .fontSize(42)
     .font('Helvetica-Bold')
     .text('LEISTUNGSVERZEICHNIS', 50, 80, { align: 'center' });

  doc.fontSize(24)
     .font('Helvetica')
     .text('Wohnungssanierung', 50, 135, { align: 'center' });

  // Firmenname groß
  doc.fillColor(primaryColor)
     .fontSize(48)
     .font('Helvetica-Bold')
     .text('neurealis GmbH', 50, 280, { align: 'center' });

  // Trennlinie
  doc.moveTo(150, 350).lineTo(445, 350).strokeColor(accentColor).lineWidth(3).stroke();

  // Info-Box
  const infoBoxY = 400;
  doc.rect(100, infoBoxY, 395, 180).fillAndStroke('#ffffff', lightGray);

  doc.fillColor(textColor)
     .fontSize(14)
     .font('Helvetica');

  doc.text(`Version:`, 130, infoBoxY + 30);
  doc.font('Helvetica-Bold').text(version, 250, infoBoxY + 30);

  doc.font('Helvetica').text(`Datum:`, 130, infoBoxY + 60);
  doc.font('Helvetica-Bold').text(datumFormatiert, 250, infoBoxY + 60);

  doc.font('Helvetica').text(`Positionen:`, 130, infoBoxY + 90);
  doc.font('Helvetica-Bold').text(`${data.length}`, 250, infoBoxY + 90);

  doc.font('Helvetica').text(`Gewerke:`, 130, infoBoxY + 120);
  doc.font('Helvetica-Bold').text(`${Object.keys(gewerke).length}`, 250, infoBoxY + 120);

  doc.font('Helvetica').text(`LV-Typ:`, 130, infoBoxY + 150);
  doc.font('Helvetica-Bold').text(`neurealis`, 250, infoBoxY + 150);

  // Kontakt unten
  doc.fillColor('#718096')
     .fontSize(11)
     .font('Helvetica')
     .text('neurealis GmbH', 50, 680, { align: 'center' })
     .text('Wohnungssanierung & Modernisierung', 50, 695, { align: 'center' })
     .text('www.neurealis.de', 50, 710, { align: 'center' });

  // === INHALTSVERZEICHNIS ===
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
  doc.fillColor('#ffffff')
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('INHALTSVERZEICHNIS', 50, 35, { align: 'center' });

  let yPos = 120;
  let seitenNr = 3; // Starten bei Seite 3 (nach Titel und Inhalt)

  doc.fillColor(textColor).font('Helvetica').fontSize(12);

  const gewerkSeiten = {};
  for (const gewerk of Object.keys(gewerke).sort()) {
    gewerkSeiten[gewerk] = seitenNr;

    // Gewerk-Name links, Seite rechts
    doc.text(gewerk, 60, yPos);
    doc.text(seitenNr.toString(), 480, yPos, { width: 30, align: 'right' });

    // Punktlinie
    doc.moveTo(200, yPos + 7).lineTo(470, yPos + 7).dash(1, { space: 3 }).stroke();
    doc.undash();

    yPos += 25;

    // Seiten pro Gewerk schätzen (ca. 3 Positionen pro Seite)
    seitenNr += Math.ceil(gewerke[gewerk].length / 3);
  }

  // Footer auf Inhaltsseite
  doc.fillColor('#718096')
     .fontSize(9)
     .text(`neurealis Leistungsverzeichnis ${version}`, 50, doc.page.height - 40, { align: 'center' });

  // === LEISTUNGSPOSITIONEN ===
  let aktuelleSeite = 2;

  for (const gewerk of Object.keys(gewerke).sort()) {
    doc.addPage();
    aktuelleSeite++;
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

    // Gewerk-Header
    doc.rect(0, 0, doc.page.width, 70).fill(primaryColor);
    doc.fillColor('#ffffff')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(gewerk.toUpperCase(), 50, 30, { align: 'center' });

    doc.fillColor('#a0aec0')
       .fontSize(11)
       .font('Helvetica')
       .text(`${gewerke[gewerk].length} Position${gewerke[gewerk].length !== 1 ? 'en' : ''}`, 50, 52, { align: 'center' });

    yPos = 90;

    for (let i = 0; i < gewerke[gewerk].length; i++) {
      const pos = gewerke[gewerk][i];

      // Neue Seite wenn zu wenig Platz
      if (yPos > doc.page.height - 200) {
        // Footer
        doc.fillColor('#718096')
           .fontSize(9)
           .font('Helvetica')
           .text(`Seite ${aktuelleSeite}`, 50, doc.page.height - 40, { align: 'center' });

        doc.addPage();
        aktuelleSeite++;
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

        // Mini-Header
        doc.rect(0, 0, doc.page.width, 50).fill(primaryColor);
        doc.fillColor('#ffffff')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`${gewerk} (Fortsetzung)`, 50, 20, { align: 'center' });

        yPos = 70;
      }

      // Positionsbox
      const boxHeight = 100;
      const beschreibungText = stripHtml(pos.beschreibung);
      const hatBeschreibung = beschreibungText.length > 0;
      const berechneteHoehe = hatBeschreibung ? Math.min(180, 100 + beschreibungText.length / 3) : 80;

      // Abwechselnde Hintergrundfarbe
      if (i % 2 === 0) {
        doc.rect(40, yPos, doc.page.width - 80, berechneteHoehe).fill('#f8fafc');
      }

      // Artikelnummer (blauer Tag)
      doc.rect(50, yPos + 10, 120, 22).fillAndStroke(accentColor, accentColor);
      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(pos.artikelnummer || '-', 55, yPos + 15, { width: 110 });

      // Preis rechts
      const preisText = formatPreis(pos.listenpreis || pos.preis);
      doc.fillColor(primaryColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(preisText, 400, yPos + 12, { width: 100, align: 'right' });

      if (pos.einheit) {
        doc.fillColor('#718096')
           .fontSize(9)
           .font('Helvetica')
           .text(`pro ${pos.einheit}`, 400, yPos + 28, { width: 100, align: 'right' });
      }

      // Bezeichnung
      doc.fillColor(textColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(pos.bezeichnung || '-', 50, yPos + 42, { width: 450 });

      // Beschreibung (gekürzt)
      if (hatBeschreibung) {
        const kurztext = beschreibungText.length > 300
          ? beschreibungText.substring(0, 300) + '...'
          : beschreibungText;

        doc.fillColor('#4a5568')
           .fontSize(9)
           .font('Helvetica')
           .text(kurztext, 50, yPos + 60, { width: 450, height: berechneteHoehe - 70 });
      }

      yPos += berechneteHoehe + 10;
    }

    // Footer
    doc.fillColor('#718096')
       .fontSize(9)
       .font('Helvetica')
       .text(`Seite ${aktuelleSeite}`, 50, doc.page.height - 40, { align: 'center' });
  }

  // === LETZTE SEITE / FOOTER ===
  doc.addPage();
  aktuelleSeite++;
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7fafc');

  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fillColor('#ffffff')
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('HINWEISE & KONTAKT', 50, 45, { align: 'center' });

  yPos = 140;
  doc.fillColor(textColor).fontSize(11).font('Helvetica');

  const hinweise = [
    '• Alle Preise verstehen sich als Nettopreise zzgl. gesetzlicher MwSt.',
    '• Preise gültig ab dem Ausstellungsdatum dieses Dokuments.',
    '• Änderungen und Irrtümer vorbehalten.',
    '• Für Großprojekte und Rahmenverträge gelten separate Konditionen.',
    '• Technische Änderungen der Leistungsbeschreibungen vorbehalten.'
  ];

  for (const hinweis of hinweise) {
    doc.text(hinweis, 50, yPos, { width: 495 });
    yPos += 22;
  }

  // Kontakt-Box
  yPos += 30;
  doc.rect(100, yPos, 395, 140).fillAndStroke('#ffffff', lightGray);

  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('neurealis GmbH', 130, yPos + 20);

  doc.fillColor(textColor)
     .fontSize(10)
     .font('Helvetica')
     .text('Ihr Partner für Wohnungssanierung', 130, yPos + 40)
     .text('', 130, yPos + 60)
     .text('E-Mail: kontakt@neurealis.de', 130, yPos + 75)
     .text('Web: www.neurealis.de', 130, yPos + 90)
     .text('', 130, yPos + 105)
     .text(`Dokumentversion: ${version}`, 130, yPos + 120);

  // Footer letzte Seite
  doc.fillColor('#718096')
     .fontSize(9)
     .text(`© ${heute.getFullYear()} neurealis GmbH - Alle Rechte vorbehalten`, 50, doc.page.height - 50, { align: 'center' })
     .text(`Seite ${aktuelleSeite}`, 50, doc.page.height - 35, { align: 'center' });

  // PDF abschließen
  doc.end();

  await new Promise((resolve) => stream.on('finish', resolve));

  console.log('\n✅ PDF erfolgreich erstellt!');
  console.log(`📁 Speicherort: ${outputPath}`);
  console.log(`📊 Statistik:`);
  console.log(`   - ${data.length} Positionen`);
  console.log(`   - ${Object.keys(gewerke).length} Gewerke`);
  console.log(`   - ${aktuelleSeite} Seiten`);
}

// Ausführen
generatePDF().catch(console.error);
