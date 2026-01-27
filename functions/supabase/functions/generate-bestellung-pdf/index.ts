import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

/**
 * generate-bestellung-pdf v1
 *
 * Generiert PDF für eine Bestellung und speichert es in Supabase Storage.
 * Aktualisiert bestellungen.pdf_url und dokumente.datei_url
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Corporate Design
const BRAND_RED = rgb(229/255, 57/255, 53/255);
const GRAY_800 = rgb(31/255, 41/255, 55/255);
const GRAY_600 = rgb(75/255, 85/255, 99/255);
const GRAY_400 = rgb(156/255, 163/255, 175/255);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(243/255, 244/255, 246/255);

interface Bestellung {
  id: string;
  bestell_nr: number;
  projekt_bestell_nr: number;
  atbs_nummer: string;
  projekt_name: string;
  lieferadresse: string;
  lieferort: string;
  gewuenschtes_lieferdatum: string | null;
  zeitfenster: string | null;
  ansprechpartner_name: string | null;
  ansprechpartner_telefon: string | null;
  summe_netto: number;
  summe_brutto: number;
  anzahl_positionen: number;
  notizen: string | null;
  bestellt_von_email: string;
  bestellt_von_name: string;
  bestellt_am: string;
  grosshaendler: {
    name: string;
    kurzname: string;
    typ: string;
  };
}

interface Position {
  position_nr: number;
  artikelnummer: string | null;
  bezeichnung: string;
  hersteller: string | null;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
}

// Bestellnummer formatieren: ATBS-463-B1
function formatBestellNr(bestellung: Bestellung): string {
  return `${bestellung.atbs_nummer}-B${bestellung.projekt_bestell_nr}`;
}

// Preis formatieren
function formatPreis(betrag: number): string {
  return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Datum formatieren
function formatDatum(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Zeitfenster formatieren
function formatZeitfenster(zf: string | null): string {
  if (!zf) return '';
  const fenster: Record<string, string> = {
    'vormittag': 'Vormittag (7-12 Uhr)',
    'nachmittag': 'Nachmittag (12-17 Uhr)',
    'ganztags': 'Ganztags'
  };
  return fenster[zf] || zf;
}

// Lieferort formatieren
function formatLieferort(ort: string): string {
  const orte: Record<string, string> = {
    'baustelle': 'Baustelle',
    'lager': 'Lager',
    'abholung': 'Abholung'
  };
  return orte[ort] || ort;
}

// Text kürzen wenn zu lang
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

async function generatePdf(bestellung: Bestellung, positionen: Position[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const bestellNr = formatBestellNr(bestellung);
  const haendler = bestellung.grosshaendler;

  // A4 Seite
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // === HEADER ===
  // Logo/Firmenname
  page.drawText('neurealis GmbH', {
    x: margin,
    y: y,
    size: 10,
    font: helvetica,
    color: GRAY_400,
  });

  // Bestellnummer als Titel
  y -= 25;
  page.drawText(`Bestellung ${bestellNr}`, {
    x: margin,
    y: y,
    size: 22,
    font: helveticaBold,
    color: GRAY_800,
  });

  // Großhändler
  y -= 18;
  page.drawText(`${haendler.kurzname || haendler.name} · ${haendler.typ || 'Großhändler'}`, {
    x: margin,
    y: y,
    size: 11,
    font: helvetica,
    color: GRAY_600,
  });

  // === HINWEIS-BOX ===
  y -= 30;
  const hinweisHeight = 35;
  page.drawRectangle({
    x: margin,
    y: y - hinweisHeight,
    width: contentWidth,
    height: hinweisHeight,
    color: rgb(75/255, 85/255, 99/255),
  });

  page.drawText(`Hinweis: Bitte die Projektnummer ${bestellung.atbs_nummer} auf allen Dokumenten angeben.`, {
    x: margin + 12,
    y: y - 22,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  // === LIEFERINFORMATIONEN ===
  y -= hinweisHeight + 25;

  // Info-Box Hintergrund
  const infoBoxHeight = 70;
  page.drawRectangle({
    x: margin,
    y: y - infoBoxHeight,
    width: contentWidth,
    height: infoBoxHeight,
    color: LIGHT_GRAY,
    borderColor: rgb(229/255, 231/255, 235/255),
    borderWidth: 1,
  });

  // 4 Spalten für Infos
  const colWidth = contentWidth / 4;
  const infoY = y - 18;
  const valueY = y - 35;

  // Projekt
  page.drawText('PROJEKT', { x: margin + 12, y: infoY, size: 8, font: helveticaBold, color: GRAY_400 });
  page.drawText(bestellung.atbs_nummer, { x: margin + 12, y: valueY, size: 11, font: helveticaBold, color: GRAY_800 });

  // Lieferort
  page.drawText('LIEFERORT', { x: margin + colWidth + 12, y: infoY, size: 8, font: helveticaBold, color: GRAY_400 });
  page.drawText(formatLieferort(bestellung.lieferort), { x: margin + colWidth + 12, y: valueY, size: 10, font: helveticaBold, color: GRAY_800 });
  if (bestellung.lieferadresse) {
    page.drawText(truncateText(bestellung.lieferadresse, 30), { x: margin + colWidth + 12, y: valueY - 14, size: 9, font: helvetica, color: GRAY_600 });
  }

  // Lieferdatum
  page.drawText('LIEFERDATUM', { x: margin + colWidth * 2 + 12, y: infoY, size: 8, font: helveticaBold, color: GRAY_400 });
  page.drawText(formatDatum(bestellung.gewuenschtes_lieferdatum), { x: margin + colWidth * 2 + 12, y: valueY, size: 10, font: helveticaBold, color: GRAY_800 });
  if (bestellung.zeitfenster) {
    page.drawText(formatZeitfenster(bestellung.zeitfenster), { x: margin + colWidth * 2 + 12, y: valueY - 14, size: 9, font: helvetica, color: GRAY_600 });
  }

  // Ansprechpartner
  page.drawText('ANSPRECHPARTNER', { x: margin + colWidth * 3 + 12, y: infoY, size: 8, font: helveticaBold, color: GRAY_400 });
  page.drawText(bestellung.ansprechpartner_name || '-', { x: margin + colWidth * 3 + 12, y: valueY, size: 10, font: helveticaBold, color: GRAY_800 });
  if (bestellung.ansprechpartner_telefon) {
    page.drawText(bestellung.ansprechpartner_telefon, { x: margin + colWidth * 3 + 12, y: valueY - 14, size: 9, font: helvetica, color: GRAY_600 });
  }

  // === POSITIONEN TABELLE ===
  y -= infoBoxHeight + 25;

  // Tabellen-Header
  const headerHeight = 25;
  page.drawRectangle({
    x: margin,
    y: y - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: LIGHT_GRAY,
  });

  // Spaltenbreiten
  const cols = {
    pos: 35,
    artNr: 80,
    bezeichnung: 220,
    menge: 60,
    ep: 70,
    gesamt: 70,
  };

  let colX = margin + 8;
  const headerY = y - 17;

  page.drawText('Pos.', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });
  colX += cols.pos;
  page.drawText('Art.-Nr.', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });
  colX += cols.artNr;
  page.drawText('Bezeichnung', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });
  colX += cols.bezeichnung;
  page.drawText('Menge', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });
  colX += cols.menge;
  page.drawText('EP', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });
  colX += cols.ep;
  page.drawText('Gesamt', { x: colX, y: headerY, size: 8, font: helveticaBold, color: GRAY_400 });

  y -= headerHeight;

  // Positionen
  const rowHeight = 32;
  for (const pos of positionen) {
    // Neue Seite wenn nötig
    if (y - rowHeight < margin + 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    // Zeilen-Trennlinie
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: margin + contentWidth, y: y },
      thickness: 0.5,
      color: rgb(229/255, 231/255, 235/255),
    });

    const rowY = y - 14;
    const rowY2 = y - 26;

    colX = margin + 8;
    page.drawText(String(pos.position_nr), { x: colX, y: rowY, size: 9, font: helvetica, color: GRAY_400 });
    colX += cols.pos;
    page.drawText(pos.artikelnummer || '-', { x: colX, y: rowY, size: 9, font: helvetica, color: GRAY_600 });
    colX += cols.artNr;
    page.drawText(truncateText(pos.bezeichnung, 45), { x: colX, y: rowY, size: 10, font: helveticaBold, color: GRAY_800 });
    if (pos.hersteller) {
      page.drawText(truncateText(pos.hersteller, 40), { x: colX, y: rowY2, size: 8, font: helvetica, color: GRAY_400 });
    }
    colX += cols.bezeichnung;
    page.drawText(`${pos.menge} ${pos.einheit}`, { x: colX, y: rowY, size: 9, font: helvetica, color: GRAY_800 });
    colX += cols.menge;
    page.drawText(formatPreis(pos.einzelpreis), { x: colX, y: rowY, size: 9, font: helvetica, color: GRAY_600 });
    colX += cols.ep;
    page.drawText(formatPreis(pos.gesamtpreis), { x: colX, y: rowY, size: 10, font: helveticaBold, color: GRAY_800 });

    y -= rowHeight;
  }

  // Summenzeile
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: margin + contentWidth, y: y },
    thickness: 1.5,
    color: rgb(229/255, 231/255, 235/255),
  });

  // Summen-Hintergrund
  page.drawRectangle({
    x: margin,
    y: y - 30,
    width: contentWidth,
    height: 30,
    color: LIGHT_GRAY,
  });

  page.drawText('Summe netto', { x: margin + contentWidth - 180, y: y - 20, size: 10, font: helveticaBold, color: GRAY_800 });
  page.drawText(formatPreis(bestellung.summe_netto), { x: margin + contentWidth - 70, y: y - 20, size: 12, font: helveticaBold, color: GRAY_800 });

  y -= 30;

  // === NOTIZEN ===
  if (bestellung.notizen) {
    y -= 25;

    // Neue Seite wenn nötig
    if (y < margin + 100) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawRectangle({
      x: margin,
      y: y - 50,
      width: contentWidth,
      height: 50,
      color: LIGHT_GRAY,
      borderColor: rgb(229/255, 231/255, 235/255),
      borderWidth: 1,
    });

    page.drawText('Lieferhinweise', { x: margin + 12, y: y - 18, size: 10, font: helveticaBold, color: GRAY_800 });
    page.drawText(truncateText(bestellung.notizen, 100), { x: margin + 12, y: y - 35, size: 9, font: helvetica, color: GRAY_600 });

    y -= 50;
  }

  // === FOOTER ===
  const footerY = margin;
  page.drawLine({
    start: { x: margin, y: footerY + 20 },
    end: { x: margin + contentWidth, y: footerY + 20 },
    thickness: 0.5,
    color: rgb(229/255, 231/255, 235/255),
  });

  const bestellDatum = bestellung.bestellt_am
    ? new Date(bestellung.bestellt_am).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('de-DE');

  page.drawText(`Bestellt von: ${bestellung.bestellt_von_name} (${bestellung.bestellt_von_email}) · ${bestellDatum}`, {
    x: margin,
    y: footerY + 5,
    size: 8,
    font: helvetica,
    color: GRAY_400,
  });

  return await pdfDoc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { bestellung_id } = await req.json();

    if (!bestellung_id) {
      return new Response(
        JSON.stringify({ error: 'bestellung_id fehlt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generiere PDF für Bestellung: ${bestellung_id}`);

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Bestellung laden
    const { data: bestellung, error: bestellError } = await supabase
      .from('bestellungen')
      .select(`
        id, bestell_nr, projekt_bestell_nr, atbs_nummer, projekt_name,
        lieferadresse, lieferort, gewuenschtes_lieferdatum, zeitfenster,
        ansprechpartner_name, ansprechpartner_telefon,
        summe_netto, summe_brutto, anzahl_positionen, notizen,
        bestellt_von_email, bestellt_von_name, bestellt_am,
        grosshaendler:grosshaendler_id (name, kurzname, typ)
      `)
      .eq('id', bestellung_id)
      .single();

    if (bestellError || !bestellung) {
      console.error('Bestellung nicht gefunden:', bestellError);
      return new Response(
        JSON.stringify({ error: 'Bestellung nicht gefunden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Positionen laden
    const { data: positionen, error: posError } = await supabase
      .from('bestellpositionen')
      .select('position_nr, artikelnummer, bezeichnung, hersteller, menge, einheit, einzelpreis, gesamtpreis')
      .eq('bestellung_id', bestellung_id)
      .order('position_nr', { ascending: true });

    if (posError) {
      console.error('Positionen nicht geladen:', posError);
      return new Response(
        JSON.stringify({ error: 'Positionen nicht gefunden' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bestellNr = formatBestellNr(bestellung as unknown as Bestellung);
    console.log(`Bestellung ${bestellNr} mit ${positionen?.length || 0} Positionen geladen`);

    // PDF generieren
    const pdfBytes = await generatePdf(bestellung as unknown as Bestellung, positionen || []);
    console.log(`PDF generiert: ${pdfBytes.length} bytes`);

    // Dateiname (Sonderzeichen bereinigen)
    const datum = new Date().toISOString().split('T')[0];
    const haendler = bestellung.grosshaendler as { kurzname?: string; name: string };
    const haendlerName = (haendler.kurzname || haendler.name)
      .replace(/[\/\\:*?"<>|]/g, '-')  // Ungültige Dateinamen-Zeichen ersetzen
      .replace(/\s+/g, '_');
    const fileName = `${datum}_${bestellNr}_${haendlerName}.pdf`;

    // In Storage hochladen
    const storagePath = `${bestellung.atbs_nummer}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('bestellungen')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload fehlgeschlagen:', uploadError);
      return new Response(
        JSON.stringify({ error: 'PDF Upload fehlgeschlagen', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Public URL generieren
    const { data: { publicUrl } } = supabase.storage
      .from('bestellungen')
      .getPublicUrl(storagePath);

    console.log(`PDF hochgeladen: ${publicUrl}`);

    // bestellungen.pdf_url aktualisieren
    await supabase
      .from('bestellungen')
      .update({ pdf_url: publicUrl })
      .eq('id', bestellung_id);

    // dokumente.datei_url aktualisieren
    await supabase
      .from('dokumente')
      .update({
        datei_url: publicUrl,
        datei_name: fileName,
        datei_groesse: pdfBytes.length
      })
      .eq('bestellung_id', bestellung_id);

    console.log(`Datenbank aktualisiert für ${bestellNr}`);

    return new Response(
      JSON.stringify({
        success: true,
        bestellung_id,
        bestell_nr: bestellNr,
        pdf_url: publicUrl,
        file_name: fileName,
        file_size: pdfBytes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fehler:', error);
    return new Response(
      JSON.stringify({
        error: 'PDF-Generierung fehlgeschlagen',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
