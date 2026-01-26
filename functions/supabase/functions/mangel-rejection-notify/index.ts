import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * mangel-rejection-notify v1
 *
 * Sendet E-Mail an Nachunternehmer wenn Mängelbehebung nicht abgenommen wurde
 * - Wird via Trigger aufgerufen wenn status_mangel = "(2) Nicht abgenommen"
 * - Enthält Hinweis auf Zusatzkosten bei erneuter Prüfung
 *
 * Erstellt: 2026-01-25
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Microsoft Graph API Config
const MS_TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const MS_CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const MS_CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';
const SENDER_EMAIL = Deno.env.get('SMTP_FROM') || 'kontakt@neurealis.de';

interface Mangel {
  id: string;
  mangel_nr: string | null;
  projekt_nr: string;
  beschreibung_mangel: string;
  bauleiter: string | null;
  nachunternehmer: string | null;
  nu_email: string | null;
  projektname_komplett: string | null;
  nua_nr: string | null;
  datum_frist: string | null;
  fotos_mangel: any;
}

// HTML Email Template wrapper (neurealis Branding)
function wrapEmail(betreff: string, inhalt: string): string {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${betreff}</title>
<style type="text/css">
body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7f7f7; }
table, td { border-collapse: collapse !important; }
</style>
</head>
<body style="margin:0; padding:0;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding: 10px 0 30px 0;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border: 1px solid #cccccc; background-color: #ffffff;">
<tr><td align="center" style="padding: 0;">
<img src="https://neurealis.de/wp-content/uploads/2024/07/neurealis20-20Logo20-20Zuschnitt20-20klein1.png" alt="neurealis Logo" width="200" style="display: block; margin: 40px auto;">
<img src="https://neurealis.de/wp-content/uploads/2025/03/neurealisKomplettsanierung-header-email_V4.jpg" alt="Header" width="600" style="display: block;">
</td></tr>
<tr><td align="left" bgcolor="#a3a3a3" style="padding: 10px 30px;">
<h2 style="color: black; margin: 0;">${betreff}</h2>
</td></tr>
<tr><td bgcolor="#ffffff" style="padding: 20px 30px 30px 30px;">
${inhalt}
</td></tr>
<tr><td align="center" bgcolor="#a3a3a3" style="padding: 20px 30px; text-align: center; font-size: 14px; color: #000;">
neurealis GmbH, Kleyer Weg 40, 44149 Dortmund<br>
<a href="tel:023158688560" style="color: #000000; text-decoration: underline;">0231 / 5868 8560</a> | <a href="https://www.neurealis.de" style="color: #000000; text-decoration: underline;">www.neurealis.de</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Ablehnungs-E-Mail Template
function templateRejectionNU(m: Mangel): string {
  const fristText = m.datum_frist
    ? new Date(m.datum_frist).toLocaleDateString('de-DE')
    : 'Keine Frist gesetzt';

  const mangelNrRow = m.mangel_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.mangel_nr}</strong></td>
      </tr>` : '';

  const nuaRow = m.nua_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.nua_nr}</strong></td>
      </tr>` : '';

  return `
    <p>Hallo ${m.nachunternehmer || 'Nachunternehmer'},</p>

    <!-- Status-Box ROT -->
    <table style="width: 100%; margin: 20px 0;">
      <tr>
        <td style="background-color: #dc3545; padding: 15px 20px; color: #fff;">
          <strong style="font-size: 16px;">❌ Mängelbehebung nicht abgenommen</strong>
        </td>
      </tr>
    </table>

    <p>Die Behebung des folgenden Mangels wurde von der Bauleitung <strong>nicht abgenommen</strong>. Der Mangel besteht weiterhin.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.projektname_komplett || m.projekt_nr}</strong></td>
      </tr>${mangelNrRow}${nuaRow}
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.beschreibung_mangel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Frist:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${fristText}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Bauleiter:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.bauleiter || '-'}</td>
      </tr>
    </table>

    <p><strong>Bitte behebe den Mangel vollständig und melde dich erneut bei der Bauleitung.</strong></p>

    <!-- Hinweis Zusatzkosten - ROT -->
    <table style="width: 100%; margin: 25px 0;">
      <tr>
        <td style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px 20px;">
          <strong>⚠️ Hinweis zu Zusatzkosten:</strong><br>
          Der Aufwand für die erneute Prüfung durch die Bauleitung kann von der Schlussrechnung abgezogen werden.
        </td>
      </tr>
    </table>

    <!-- Hinweis Schlussrechnung - GELB -->
    <table style="width: 100%; margin: 25px 0;">
      <tr>
        <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px;">
          <strong>💰 Hinweis zur Schlussrechnung:</strong><br>
          Die Zahlung der Schlussrechnung erfolgt erst, wenn alle bis dahin gemeldeten Mängel behoben wurden.
        </td>
      </tr>
    </table>
  `;
}

// Get Microsoft Graph access token
async function getGraphAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph token error: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via Microsoft Graph API
async function sendEmailViaGraph(
  to: string,
  subject: string,
  bodyContent: string
): Promise<void> {
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Microsoft Graph API not configured');
  }

  const accessToken = await getGraphAccessToken();
  const htmlBody = wrapEmail(subject, bodyContent);

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

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph send error: ${error}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Hole mangel_id aus Request oder verarbeite alle pending
    let mangelId: string | null = null;
    try {
      const body = await req.json();
      mangelId = body.mangel_id;
    } catch {
      // Kein JSON body - verarbeite alle pending
    }

    // Query bauen
    let query = supabase
      .from('mangel_notifications')
      .select(`
        id,
        mangel_id,
        recipient_email,
        recipient_name,
        subject,
        maengel_fertigstellung!inner (
          id,
          mangel_nr,
          projekt_nr,
          beschreibung_mangel,
          bauleiter,
          nachunternehmer,
          nu_email,
          projektname_komplett,
          nua_nr,
          datum_frist,
          fotos_mangel
        )
      `)
      .eq('notification_type', 'rejection')
      .eq('status', 'pending');

    if (mangelId) {
      query = query.eq('mangel_id', mangelId);
    }

    const { data: notifications, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending rejection notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const notif of notifications) {
      const mangel = (notif as any).maengel_fertigstellung as Mangel;
      const nuEmail = notif.recipient_email || mangel.nu_email;

      if (!nuEmail) {
        // Kein E-Mail - als failed markieren
        await supabase
          .from('mangel_notifications')
          .update({ status: 'failed', error_message: 'No NU email' })
          .eq('id', notif.id);

        results.push({ id: notif.id, status: 'failed', reason: 'no_email' });
        continue;
      }

      try {
        const subject = `Mängelbehebung nicht abgenommen: ${mangel.mangel_nr || mangel.projekt_nr}`;
        const bodyContent = templateRejectionNU(mangel);

        await sendEmailViaGraph(nuEmail, subject, bodyContent);

        // Als gesendet markieren
        await supabase
          .from('mangel_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            body: wrapEmail(subject, bodyContent)
          })
          .eq('id', notif.id);

        results.push({
          id: notif.id,
          mangel_nr: mangel.mangel_nr,
          to: nuEmail,
          status: 'sent'
        });

        console.log(`Sent rejection email to ${nuEmail} for ${mangel.mangel_nr}`);

      } catch (sendError) {
        await supabase
          .from('mangel_notifications')
          .update({ status: 'failed', error_message: String(sendError) })
          .eq('id', notif.id);

        results.push({
          id: notif.id,
          status: 'failed',
          error: String(sendError)
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Rejection notifications processed',
        total: notifications.length,
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
