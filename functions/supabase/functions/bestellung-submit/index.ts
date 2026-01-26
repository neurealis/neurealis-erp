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

interface Bestellung {
  id: string;
  bestell_nr: number;
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

// HTML generieren
function generateHtml(bestellung: Bestellung, positionen: Position[]): string {
  const positionenHtml = positionen.map(p => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.position_nr}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
        <strong>${p.bezeichnung}</strong>
        ${p.hersteller ? `<br><small style="color: #6b7280;">${p.hersteller}</small>` : ''}
        ${p.artikelnummer ? `<br><small style="color: #9ca3af;">Art.-Nr.: ${p.artikelnummer}</small>` : ''}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${p.menge} ${p.einheit}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPreis(p.einzelpreis)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatPreis(p.gesamtpreis)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Bestellung B-${bestellung.bestell_nr}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { background: #2563eb; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 8px; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
    th:nth-child(1) { width: 50px; text-align: center; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    .total-row td { border-top: 2px solid #e5e7eb; padding-top: 12px; font-weight: 600; }
    .total-value { font-size: 18px; color: #059669; }
    .footer { background: #f9fafb; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
    .notes { background: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 16px; }
    .notes-title { font-weight: 600; color: #92400e; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bestellung B-${bestellung.bestell_nr}</h1>
      <p>${bestellung.grosshaendler.kurzname || bestellung.grosshaendler.name} - ${bestellung.grosshaendler.typ}</p>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">Lieferinformationen</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Projekt</div>
            <div class="info-value">${bestellung.atbs_nummer}</div>
            <div style="font-size: 14px; color: #6b7280;">${bestellung.projekt_name?.split('|')[1]?.trim() || bestellung.projekt_name || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Lieferort</div>
            <div class="info-value">${formatLieferort(bestellung.lieferort)}</div>
            <div style="font-size: 14px; color: #6b7280;">${bestellung.lieferadresse || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Lieferdatum</div>
            <div class="info-value">${formatDatum(bestellung.gewuenschtes_lieferdatum)}</div>
            ${bestellung.zeitfenster ? `<div style="font-size: 14px; color: #6b7280;">${formatZeitfenster(bestellung.zeitfenster)}</div>` : ''}
          </div>
          <div class="info-item">
            <div class="info-label">Ansprechpartner vor Ort</div>
            <div class="info-value">${bestellung.ansprechpartner_name || '-'}</div>
            ${bestellung.ansprechpartner_telefon ? `<div style="font-size: 14px; color: #6b7280;">${bestellung.ansprechpartner_telefon}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Bestellpositionen (${bestellung.anzahl_positionen})</div>
        <table>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Artikel</th>
              <th>Menge</th>
              <th>Einzelpreis</th>
              <th>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            ${positionenHtml}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4" style="text-align: right; padding: 12px 8px;">Gesamtsumme (netto)</td>
              <td style="text-align: right; padding: 12px 8px;" class="total-value">${formatPreis(bestellung.summe_netto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${bestellung.notizen ? `
      <div class="notes">
        <div class="notes-title">Lieferhinweise</div>
        <div>${bestellung.notizen}</div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      Bestellt von: ${bestellung.bestellt_von_name} (${bestellung.bestellt_von_email})<br>
      Datum: ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
    </div>
  </div>
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

    // Bestellung laden
    const { data: bestellung, error: bestellError } = await supabase
      .from('bestellungen')
      .select(`
        id, bestell_nr, atbs_nummer, projekt_name,
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

    console.log(`Bestellung B-${bestellung.bestell_nr} mit ${positionen?.length || 0} Positionen geladen`);

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
          bestell_nr: bestellung.bestell_nr,
          email_sent: false,
          message: 'HTML generiert, E-Mail-Versand nicht konfiguriert'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getAccessToken();
    const subject = `Bestellung B-${bestellung.bestell_nr} - ${(bestellung.grosshaendler as { kurzname?: string; name: string }).kurzname || (bestellung.grosshaendler as { name: string }).name} - ${bestellung.atbs_nummer}`;

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
        bestell_nr: bestellung.bestell_nr,
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
