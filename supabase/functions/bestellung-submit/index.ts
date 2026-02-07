import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Native base64 encoding for Uint8Array
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * bestellung-submit v9
 *
 * Verarbeitet Bestellungen und Angebotsanfragen:
 * 1. Generiert HTML für E-Mail-Body (unterschiedlich je nach Typ)
 * 2. Versucht PDF-Generierung via generate-bestellung-pdf (optional/graceful)
 * 3. Holt PDF aus Storage und fügt als Anhang hinzu (falls verfügbar)
 * 4. Sendet E-Mail via MS Graph (mit CC an Bauleitung, ohne PDF wenn Generierung fehlschlägt)
 * 5. Erstellt Eintrag in dokumente-Tabelle (Bestellung oder Sonstiges)
 * 6. Markiert Bestellung als "gesendet"
 *
 * Dokumentennummer: ATBS-***-B* (Bestellung) oder ATBS-***-A* (Anfrage)
 * Parameter: { bestellung_id, empfaenger_email? }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Microsoft Graph API Config
const TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';

// Standard-Empfänger für Bestellungen (Fallback)
const DEFAULT_EMPFAENGER = 'holger.neumann@neurealis.de';
const CC_BAULEITUNG = 'bauleitung@neurealis.de';
const SENDER_EMAIL = 'partner@neurealis.de';

// Corporate Design Farben (HTML)
const GRAY_800 = '#1f2937';
const GRAY_600 = '#4b5563';
const GRAY_500 = '#6b7280';

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
  bestelltyp: 'bestellung' | 'angebotsanfrage';
  grosshaendler: {
    name: string;
    kurzname: string;
    typ: string;
    bestell_email: string | null;
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

// Dokumentennummer formatieren: ATBS-463-B1 (Bestellung) oder ATBS-463-A1 (Anfrage)
function formatDokumentNr(bestellung: Bestellung): string {
  const prefix = bestellung.bestelltyp === 'angebotsanfrage' ? 'A' : 'B';
  return `${bestellung.atbs_nummer}-${prefix}${bestellung.projekt_bestell_nr}`;
}

// OAuth2 Token holen
async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token-Fehler: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

// E-Mail senden via Graph API (mit optionalem PDF-Anhang und CC)
async function sendEmailWithAttachment(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string,
  pdfBytes?: Uint8Array,
  pdfFileName?: string,
  ccRecipients?: string[]
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;

  const message: any = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };

  // CC-Empfänger hinzufügen
  if (ccRecipients && ccRecipients.length > 0) {
    message.message.ccRecipients = ccRecipients.map(email => ({
      emailAddress: { address: email }
    }));
  }

  // PDF-Anhang hinzufügen falls vorhanden
  if (pdfBytes && pdfFileName) {
    const contentBytes = uint8ArrayToBase64(pdfBytes);
    message.message.attachments = [{
      '@odata.type': '#microsoft.graph.fileAttachment',
      'name': pdfFileName,
      'contentType': 'application/pdf',
      'contentBytes': contentBytes
    }];
  }

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Graph API Fehler: ${response.status} - ${await response.text()}`);
  }
}

// Preis formatieren
function formatPreis(betrag: number): string {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

// Datum formatieren
function formatDatum(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

// HTML generieren für E-Mail
function generateHtml(bestellung: Bestellung, positionen: Position[]): string {
  const bestellNr = formatDokumentNr(bestellung);
  const haendler = bestellung.grosshaendler;
  const istAngebotsanfrage = bestellung.bestelltyp === 'angebotsanfrage';
  const typLabel = istAngebotsanfrage ? 'Angebotsanfrage' : 'Bestellung';

  const positionenHtml = positionen.map(p => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${GRAY_500}; width: 50px;">${p.position_nr}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; width: 120px;">${p.artikelnummer || '-'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: ${GRAY_800};">${p.bezeichnung}</strong>
        ${p.hersteller ? `<br><span style="color: ${GRAY_500}; font-size: 13px;">${p.hersteller}</span>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap; width: 80px;">${p.menge} ${p.einheit}</td>
      ${istAngebotsanfrage ? '' : `<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; width: 100px;">${formatPreis(p.einzelpreis)}</td>`}
      ${istAngebotsanfrage ? '' : `<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; width: 100px;">${formatPreis(p.gesamtpreis)}</td>`}
    </tr>
  `).join('');

  // Hinweistext je nach Typ
  const hinweisText = istAngebotsanfrage
    ? `Bitte senden Sie uns ein Angebot für die nachfolgenden Positionen. Projektnummer <strong>${bestellung.atbs_nummer}</strong> bitte auf allen Dokumenten angeben.`
    : `Bitte die Projektnummer <strong>${bestellung.atbs_nummer}</strong> auf allen Dokumenten (Lieferschein, Rechnung) angeben.`;

  // Hintergrundfarbe für Hinweis-Box
  const hinweisBackground = istAngebotsanfrage ? '#2563eb' : '#4b5563'; // Blau für Anfrage, Grau für Bestellung

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typLabel} ${bestellNr}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${GRAY_800}; line-height: 1.5; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table width="800" cellpadding="0" cellspacing="0" style="max-width: 800px; width: 100%; border: 1px solid #d1d5db;">

          <!-- Header -->
          <tr>
            <td style="background: #f3f4f6; padding: 20px 24px; border-bottom: 1px solid #d1d5db;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${GRAY_800};">${typLabel} ${bestellNr}</h1>
                    <p style="margin: 4px 0 0 0; color: ${GRAY_600}; font-size: 15px;">${haendler.kurzname || haendler.name} · ${haendler.typ || 'Großhändler'}</p>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="font-size: 12px; color: ${GRAY_500};">neurealis GmbH</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Wichtiger Hinweis -->
          <tr>
            <td style="background: ${hinweisBackground}; padding: 12px 24px;">
              <p style="margin: 0; color: #ffffff; font-size: 13px;">
                <strong>${istAngebotsanfrage ? 'Angebotsanfrage:' : 'Hinweis:'}</strong> ${hinweisText}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background: white; padding: 24px;">

              <!-- Lieferinformationen -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; background: #f9fafb; border: 1px solid #e5e7eb;">
                <tr>
                  <td width="25%" style="padding: 14px 16px; border-right: 1px solid #e5e7eb;">
                    <div style="font-size: 11px; color: ${GRAY_500}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Projekt</div>
                    <div style="font-weight: 700; font-size: 15px; color: ${GRAY_800};">${bestellung.atbs_nummer}</div>
                  </td>
                  <td width="25%" style="padding: 14px 16px; border-right: 1px solid #e5e7eb;">
                    <div style="font-size: 11px; color: ${GRAY_500}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Lieferort</div>
                    <div style="font-weight: 600; color: ${GRAY_800};">${formatLieferort(bestellung.lieferort)}</div>
                    <div style="font-size: 12px; color: ${GRAY_600};">${bestellung.lieferadresse || ''}</div>
                  </td>
                  <td width="25%" style="padding: 14px 16px; border-right: 1px solid #e5e7eb;">
                    <div style="font-size: 11px; color: ${GRAY_500}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Lieferdatum</div>
                    <div style="font-weight: 600; color: ${GRAY_800};">${formatDatum(bestellung.gewuenschtes_lieferdatum)}</div>
                    ${bestellung.zeitfenster ? `<div style="font-size: 12px; color: ${GRAY_600};">${formatZeitfenster(bestellung.zeitfenster)}</div>` : ''}
                  </td>
                  <td width="25%" style="padding: 14px 16px;">
                    <div style="font-size: 11px; color: ${GRAY_500}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Ansprechpartner</div>
                    <div style="font-weight: 600; color: ${GRAY_800};">${bestellung.ansprechpartner_name || '-'}</div>
                    ${bestellung.ansprechpartner_telefon ? `<div style="font-size: 13px; color: ${GRAY_800};"><a href="tel:${bestellung.ansprechpartner_telefon}" style="color: ${GRAY_800}; text-decoration: none;">${bestellung.ansprechpartner_telefon}</a></div>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Bestellpositionen -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Pos.</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Art.-Nr.</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Bezeichnung</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Menge</th>
                    ${istAngebotsanfrage ? '' : '<th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: ' + GRAY_500 + '; font-weight: 600; border-bottom: 2px solid #e5e7eb;">EP</th>'}
                    ${istAngebotsanfrage ? '' : '<th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: ' + GRAY_500 + '; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Gesamt</th>'}
                  </tr>
                </thead>
                <tbody>
                  ${positionenHtml}
                </tbody>
                ${istAngebotsanfrage ? '' : `
                <tfoot>
                  <tr style="background: #f9fafb;">
                    <td colspan="5" style="padding: 14px 12px; text-align: right; font-weight: 600; border-top: 2px solid #e5e7eb;">Summe netto</td>
                    <td style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 16px; color: ${GRAY_800}; border-top: 2px solid #e5e7eb;">${formatPreis(bestellung.summe_netto)}</td>
                  </tr>
                </tfoot>
                `}
              </table>

              ${bestellung.notizen ? `
              <!-- Lieferhinweise -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td style="background: #f9fafb; padding: 14px 16px; border: 1px solid #e5e7eb;">
                    <div style="font-weight: 600; color: ${GRAY_800}; margin-bottom: 4px; font-size: 13px;">Lieferhinweise</div>
                    <div style="color: ${GRAY_600}; font-size: 14px;">${bestellung.notizen}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f3f4f6; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 12px; color: ${GRAY_500};">
                    ${istAngebotsanfrage ? 'Angefragt' : 'Bestellt'} von: <strong style="color: ${GRAY_600};">${bestellung.bestellt_von_name}</strong> (${bestellung.bestellt_von_email}) · ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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
    const { bestellung_id, empfaenger_email } = await req.json();

    if (!bestellung_id) {
      return new Response(
        JSON.stringify({ error: 'bestellung_id fehlt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // E-Mail-Empfänger: Parameter oder Fallback
    const emailEmpfaenger = empfaenger_email || DEFAULT_EMPFAENGER;

    console.log(`Verarbeite Bestellung: ${bestellung_id}, Empfänger: ${emailEmpfaenger}`);

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
        bestellt_von_email, bestellt_von_name, bestellt_am, pdf_url, bestelltyp,
        grosshaendler:grosshaendler_id (name, kurzname, typ, bestell_email)
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

    const bestellNr = formatDokumentNr(bestellung as unknown as Bestellung);
    const haendler = bestellung.grosshaendler as { kurzname?: string; name: string };
    console.log(`Bestellung ${bestellNr} mit ${positionen?.length || 0} Positionen geladen`);

    // HTML generieren
    const htmlContent = generateHtml(bestellung as unknown as Bestellung, positionen || []);

    // TODO: generate-bestellung-pdf Edge Function erstellen
    // PDF-Generierung ist optional - Bestellung wird auch ohne PDF durchgeführt
    let pdfUrl: string | null = null;
    let pdfBytes: Uint8Array | undefined;
    let pdfFileName: string | undefined;

    try {
      console.log('Versuche PDF-Generierung via generate-bestellung-pdf...');
      const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-bestellung-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ bestellung_id })
      });

      if (!pdfResponse.ok) {
        const pdfError = await pdfResponse.text();
        console.warn(`PDF-Generierung fehlgeschlagen (${pdfResponse.status}): ${pdfError} - Bestellung wird ohne PDF fortgesetzt`);
      } else {
        const pdfResult = await pdfResponse.json();
        console.log('PDF generiert:', pdfResult);

        // Bestellung neu laden um pdf_url zu bekommen
        const { data: updatedBestellung } = await supabase
          .from('bestellungen')
          .select('pdf_url')
          .eq('id', bestellung_id)
          .single();

        pdfUrl = updatedBestellung?.pdf_url || null;

        // PDF aus Storage laden für E-Mail-Anhang
        if (pdfUrl) {
          const storageMatch = pdfUrl.match(/\/storage\/v1\/object\/public\/bestellungen\/(.+)$/);
          if (storageMatch) {
            const storagePath = decodeURIComponent(storageMatch[1]);
            pdfFileName = storagePath.split('/').pop() || `${bestellNr}.pdf`;

            console.log(`Lade PDF aus Storage: ${storagePath}`);
            const { data: pdfData, error: downloadError } = await supabase.storage
              .from('bestellungen')
              .download(storagePath);

            if (downloadError) {
              console.warn('PDF Download fehlgeschlagen:', downloadError);
            } else if (pdfData) {
              pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
              console.log(`PDF geladen: ${pdfBytes.length} bytes`);
            }
          }
        }
      }
    } catch (pdfErr) {
      console.warn('PDF-Generierung nicht verfügbar:', pdfErr instanceof Error ? pdfErr.message : String(pdfErr));
      console.warn('Bestellung wird ohne PDF-Anhang fortgesetzt');
    }

    // HTML in DB speichern
    await supabase
      .from('bestellungen')
      .update({ html_content: htmlContent })
      .eq('id', bestellung_id);

    // Typ-abhängiger Dokumenttyp
    const istAngebotsanfrage = (bestellung as any).bestelltyp === 'angebotsanfrage';
    const dokumentTyp = istAngebotsanfrage ? 'sonstiges' : 'bestellung';

    // Dokument in dokumente-Tabelle einfügen (wenn PDF vorhanden)
    if (pdfUrl) {
      const dokId = bestellNr; // z.B. "ATBS-456-B1"

      // Prüfen ob Dokument bereits existiert
      const { data: existingDoc } = await supabase
        .from('dokumente')
        .select('id')
        .eq('dok_id', dokId)
        .single();

      if (!existingDoc) {
        const { error: dokError } = await supabase
          .from('dokumente')
          .insert({
            dok_id: dokId,
            dok_typ: dokumentTyp,
            atbs_nummer: bestellung.atbs_nummer,
            bezeichnung: dokId,
            beschreibung: `${istAngebotsanfrage ? 'Angebotsanfrage' : 'Bestellung'} ${dokId} - ${haendler.kurzname || haendler.name}`,
            status: 'aktiv',
            erstellt_von: bestellung.bestellt_von_email,
            erstellt_am: new Date().toISOString(),
            bestellung_id: bestellung_id,
            datei_url: pdfUrl,
            datei_name: pdfFileName || `${dokId}.pdf`,
            datei_groesse: pdfBytes?.length || 0,
            metadata: {
              bestelltyp: bestellung.bestelltyp,
              grosshaendler: haendler.kurzname || haendler.name,
              summe_netto: bestellung.summe_netto,
              anzahl_positionen: bestellung.anzahl_positionen
            }
          });

        if (dokError) {
          console.error('Fehler beim Erstellen des Dokuments:', dokError);
        } else {
          console.log(`Dokument ${dokId} in dokumente-Tabelle erstellt (Typ: ${dokumentTyp})`);
        }
      } else {
        console.log(`Dokument ${dokId} existiert bereits`);
      }
    }

    // E-Mail senden
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      console.warn('Microsoft Graph nicht konfiguriert - E-Mail wird übersprungen');
      return new Response(
        JSON.stringify({
          success: true,
          bestellung_id,
          bestell_nr: bestellNr,
          pdf_url: pdfUrl,
          email_sent: false,
          dokument_typ: dokumentTyp,
          dokument_erstellt: !!pdfUrl,
          message: 'HTML und PDF generiert, E-Mail-Versand nicht konfiguriert'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getAccessToken();

    // Typ-abhängiger Betreff (istAngebotsanfrage bereits oben definiert)
    const typLabel = istAngebotsanfrage ? 'Angebotsanfrage' : 'Bestellung';
    const subject = `${typLabel} ${bestellNr} - ${haendler.kurzname || haendler.name}`;

    // CC an Bauleitung
    const ccRecipients = [CC_BAULEITUNG];

    // E-Mail mit PDF-Anhang und CC senden
    await sendEmailWithAttachment(accessToken, emailEmpfaenger, subject, htmlContent, pdfBytes, pdfFileName, ccRecipients);

    // E-Mail-Status in DB speichern
    await supabase
      .from('bestellungen')
      .update({
        email_gesendet_an: `${emailEmpfaenger}, CC: ${CC_BAULEITUNG}`,
        email_gesendet_am: new Date().toISOString()
      })
      .eq('id', bestellung_id);

    console.log(`E-Mail ${pdfBytes ? 'mit PDF-Anhang ' : 'ohne PDF '}gesendet an ${emailEmpfaenger} (CC: ${CC_BAULEITUNG})`);

    return new Response(
      JSON.stringify({
        success: true,
        bestellung_id,
        bestell_nr: bestellNr,
        pdf_url: pdfUrl,
        email_sent: true,
        email_to: emailEmpfaenger,
        email_cc: CC_BAULEITUNG,
        bestelltyp: istAngebotsanfrage ? 'angebotsanfrage' : 'bestellung',
        pdf_attached: !!pdfBytes,
        dokument_typ: dokumentTyp,
        dokument_erstellt: !!pdfUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fehler:', error);
    return new Response(
      JSON.stringify({
        error: 'Verarbeitung fehlgeschlagen',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
