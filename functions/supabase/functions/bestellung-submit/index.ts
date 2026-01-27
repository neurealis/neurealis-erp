import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Microsoft Graph API Config
const TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';

// Empfänger für Bestellungen (vorerst nur Holger)
const BESTELLUNG_EMPFAENGER = 'holger.neumann@neurealis.de';
const SENDER_EMAIL = 'kontakt@neurealis.de';

// Corporate Design Farben
const BRAND_RED = '#E53935';
const BRAND_RED_DARK = '#C62828';
const GRAY_800 = '#1f2937';
const GRAY_600 = '#4b5563';
const GRAY_500 = '#6b7280';
const SUCCESS_GREEN = '#059669';

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
  anzahl_positionen: number;
  notizen: string | null;
  bestellt_von_email: string;
  bestellt_von_name: string;
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

// Bestellnummer formatieren: ATBS-463-B1
function formatBestellNr(bestellung: Bestellung): string {
  return `${bestellung.atbs_nummer}-B${bestellung.projekt_bestell_nr}`;
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

// E-Mail senden via Graph API
async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;

  const message = {
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

// HTML generieren - Clean Design mit einheitlichem Rahmen
function generateHtml(bestellung: Bestellung, positionen: Position[]): string {
  const bestellNr = formatBestellNr(bestellung);
  const haendler = bestellung.grosshaendler;

  const positionenHtml = positionen.map(p => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${GRAY_500}; width: 50px;">${p.position_nr}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; width: 120px;">${p.artikelnummer || '-'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: ${GRAY_800};">${p.bezeichnung}</strong>
        ${p.hersteller ? `<br><span style="color: ${GRAY_500}; font-size: 13px;">${p.hersteller}</span>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap; width: 80px;">${p.menge} ${p.einheit}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; width: 100px;">${formatPreis(p.einzelpreis)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; width: 100px;">${formatPreis(p.gesamtpreis)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bestellung ${bestellNr}</title>
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
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${GRAY_800};">Bestellung ${bestellNr}</h1>
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
            <td style="background: #4b5563; padding: 12px 24px;">
              <p style="margin: 0; color: #ffffff; font-size: 13px;">
                <strong>Hinweis:</strong> Bitte die Projektnummer <strong>${bestellung.atbs_nummer}</strong> auf allen Dokumenten (Lieferschein, Rechnung) angeben.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background: white; padding: 24px;">

              <!-- Lieferinformationen - eine Zeile -->
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
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">EP</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: ${GRAY_500}; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  ${positionenHtml}
                </tbody>
                <tfoot>
                  <tr style="background: #f9fafb;">
                    <td colspan="5" style="padding: 14px 12px; text-align: right; font-weight: 600; border-top: 2px solid #e5e7eb;">Summe netto</td>
                    <td style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 16px; color: ${GRAY_800}; border-top: 2px solid #e5e7eb;">${formatPreis(bestellung.summe_netto)}</td>
                  </tr>
                </tfoot>
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
                    Bestellt von: <strong style="color: ${GRAY_600};">${bestellung.bestellt_von_name}</strong> (${bestellung.bestellt_von_email}) · ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
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
    const { bestellung_id } = await req.json();

    if (!bestellung_id) {
      return new Response(
        JSON.stringify({ error: 'bestellung_id fehlt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verarbeite Bestellung: ${bestellung_id}`);

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Bestellung laden (mit projekt_bestell_nr)
    const { data: bestellung, error: bestellError } = await supabase
      .from('bestellungen')
      .select(`
        id, bestell_nr, projekt_bestell_nr, atbs_nummer, projekt_name,
        lieferadresse, lieferort, gewuenschtes_lieferdatum, zeitfenster,
        ansprechpartner_name, ansprechpartner_telefon,
        summe_netto, anzahl_positionen, notizen,
        bestellt_von_email, bestellt_von_name,
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

    const bestellNr = formatBestellNr(bestellung as unknown as Bestellung);
    console.log(`Bestellung ${bestellNr} mit ${positionen?.length || 0} Positionen geladen`);

    // HTML generieren
    const htmlContent = generateHtml(bestellung as unknown as Bestellung, positionen || []);

    // HTML in DB speichern
    await supabase
      .from('bestellungen')
      .update({ html_content: htmlContent })
      .eq('id', bestellung_id);

    // E-Mail senden
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      console.warn('Microsoft Graph nicht konfiguriert - E-Mail wird übersprungen');
      return new Response(
        JSON.stringify({
          success: true,
          bestellung_id,
          bestell_nr: bestellNr,
          email_sent: false,
          message: 'HTML generiert, E-Mail-Versand nicht konfiguriert'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getAccessToken();
    const haendler = bestellung.grosshaendler as { kurzname?: string; name: string };
    const subject = `Bestellung ${bestellNr} - ${haendler.kurzname || haendler.name}`;

    await sendEmail(accessToken, BESTELLUNG_EMPFAENGER, subject, htmlContent);

    // E-Mail-Status in DB speichern
    await supabase
      .from('bestellungen')
      .update({
        email_gesendet_an: BESTELLUNG_EMPFAENGER,
        email_gesendet_am: new Date().toISOString()
      })
      .eq('id', bestellung_id);

    console.log(`E-Mail gesendet an ${BESTELLUNG_EMPFAENGER}`);

    return new Response(
      JSON.stringify({
        success: true,
        bestellung_id,
        bestell_nr: bestellNr,
        email_sent: true,
        email_to: BESTELLUNG_EMPFAENGER
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
