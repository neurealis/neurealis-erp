import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * mangel-notify v2
 *
 * Zentrale E-Mail-Function für alle Mangel-Benachrichtigungen:
 * - nu_fixed: NU meldet behoben -> BL (mit Fotos + Approve/Reject-Buttons)
 * - accepted: BL nimmt ab -> NU (Bestätigung)
 * - rejection: Behebung nicht abgenommen -> NU
 * - new: Neuer Mangel erfasst -> NU
 *
 * v2: Fotos und Approve/Reject-Buttons bei nu_fixed
 * Erstellt: 2026-01-26
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const MS_CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const MS_CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';
const SENDER_EMAIL = Deno.env.get('SMTP_FROM') || 'partner@neurealis.de';

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
  fotos_nachweis_nu: any;
  kommentar_nu: string | null;
}

const ACTION_BASE_URL = "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/mangel-action";

function renderPhotos(photos: any): string {
  if (!photos) return '';

  let photoArray: string[] = [];

  // Handle different photo formats from Softr
  if (Array.isArray(photos)) {
    photoArray = photos.map((p: any) => typeof p === 'string' ? p : p.url || p.publicUrl || '').filter(Boolean);
  } else if (typeof photos === 'object' && photos.url) {
    photoArray = [photos.url];
  } else if (typeof photos === 'string') {
    try {
      const parsed = JSON.parse(photos);
      if (Array.isArray(parsed)) {
        photoArray = parsed.map((p: any) => typeof p === 'string' ? p : p.url || '').filter(Boolean);
      }
    } catch {
      photoArray = [photos];
    }
  }

  if (photoArray.length === 0) return '';

  return `
    <h3 style="margin-top: 25px;">📷 Nachweis-Fotos vom Nachunternehmer:</h3>
    <table style="width: 100%;">
      <tr>
        ${photoArray.slice(0, 4).map(url => `
          <td style="padding: 5px; text-align: center;">
            <img src="${url}" alt="Nachweis" style="max-width: 140px; max-height: 140px; border: 1px solid #ddd; border-radius: 4px;">
          </td>
        `).join('')}
      </tr>
    </table>
  `;
}

function wrapEmail(betreff: string, inhalt: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${betreff}</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f7f7f7;">
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
0231 / 5868 8560 | www.neurealis.de
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function getEmailTemplate(type: string, m: Mangel, recipientName: string): { subject: string, body: string } {
  const fristText = m.datum_frist ? new Date(m.datum_frist).toLocaleDateString('de-DE') : 'Keine Frist';
  const mangelRef = m.mangel_nr || m.projekt_nr;

  const templates: Record<string, { subject: string, body: string }> = {
    // NU meldet behoben -> E-Mail an Bauleiter (mit Fotos + Buttons)
    nu_fixed: {
      subject: `Mängelbehebung gemeldet: ${mangelRef}`,
      body: `
        <p>Hallo ${recipientName || 'Bauleitung'},</p>
        <table style="width: 100%; margin: 20px 0;">
          <tr><td style="background-color: #17a2b8; padding: 15px 20px; color: #fff;">
            <strong>🔧 Nachunternehmer meldet: Mangel behoben</strong>
          </td></tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.projektname_komplett || m.projekt_nr}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel-Nr:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.mangel_nr || '-'}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.beschreibung_mangel || '-'}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Nachunternehmer:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.nachunternehmer || '-'}</strong></td></tr>
          ${m.kommentar_nu ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Kommentar NU:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.kommentar_nu}</td></tr>` : ''}
        </table>

        ${renderPhotos(m.fotos_nachweis_nu)}

        <p style="margin-top: 25px;"><strong>Bitte prüfe die Mängelbehebung:</strong></p>

        <table style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; text-align: center;">
              <a href="${ACTION_BASE_URL}?id=${m.id}&action=approve"
                 style="display: inline-block; padding: 15px 40px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                ✓ Abgenommen
              </a>
            </td>
            <td style="padding: 10px; text-align: center;">
              <a href="${ACTION_BASE_URL}?id=${m.id}&action=reject"
                 style="display: inline-block; padding: 15px 40px; background-color: #dc3545; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                ✗ Nicht abgenommen
              </a>
            </td>
          </tr>
        </table>

        <p style="color: #666; font-size: 12px;">Der Nachunternehmer wird automatisch über deine Entscheidung informiert.</p>
      `
    },

    // BL nimmt ab -> Bestätigung an NU
    accepted: {
      subject: `Mangel abgenommen: ${mangelRef}`,
      body: `
        <p>Hallo ${recipientName || 'Nachunternehmer'},</p>
        <table style="width: 100%; margin: 20px 0;">
          <tr><td style="background-color: #28a745; padding: 15px 20px; color: #fff;">
            <strong>✅ Mängelbehebung abgenommen</strong>
          </td></tr>
        </table>
        <p>Die Behebung des folgenden Mangels wurde von der Bauleitung <strong>abgenommen</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Projekt:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.projektname_komplett || m.projekt_nr}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel-Nr:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.mangel_nr || '-'}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.beschreibung_mangel || '-'}</td></tr>
        </table>
        <p style="color: #28a745;"><strong>Vielen Dank für die Behebung!</strong></p>
      `
    },

    // Ablehnung -> NU (existiert bereits in mangel-rejection-notify, hier als Fallback)
    rejection: {
      subject: `Mängelbehebung nicht abgenommen: ${mangelRef}`,
      body: `
        <p>Hallo ${recipientName || 'Nachunternehmer'},</p>
        <table style="width: 100%; margin: 20px 0;">
          <tr><td style="background-color: #dc3545; padding: 15px 20px; color: #fff;">
            <strong>❌ Mängelbehebung nicht abgenommen</strong>
          </td></tr>
        </table>
        <p>Die Behebung wurde von der Bauleitung <strong>nicht abgenommen</strong>. Der Mangel besteht weiterhin.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Projekt:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.projektname_komplett || m.projekt_nr}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel-Nr:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.mangel_nr || '-'}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.beschreibung_mangel || '-'}</td></tr>
        </table>
        <table style="width: 100%; margin: 25px 0;">
          <tr><td style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px 20px;">
            <strong>⚠️ Hinweis zu Zusatzkosten:</strong><br>
            Der Aufwand für die erneute Prüfung kann von der Schlussrechnung abgezogen werden.
          </td></tr>
        </table>
        <table style="width: 100%; margin: 25px 0;">
          <tr><td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px;">
            <strong>💰 Hinweis zur Schlussrechnung:</strong><br>
            Die Zahlung erfolgt erst, wenn alle Mängel behoben wurden.
          </td></tr>
        </table>
      `
    },

    // Neuer Mangel erfasst -> NU
    new: {
      subject: `Neuer Mangel erfasst: ${mangelRef}`,
      body: `
        <p>Hallo ${recipientName || 'Nachunternehmer'},</p>
        <table style="width: 100%; margin: 20px 0;">
          <tr><td style="background-color: #ffc107; padding: 15px 20px; color: #000;">
            <strong>⚠️ Neuer Mangel erfasst</strong>
          </td></tr>
        </table>
        <p>Es wurde ein neuer Mangel in deinem Gewerk erfasst:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Projekt:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.projektname_komplett || m.projekt_nr}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel-Nr:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.mangel_nr || '-'}</strong></td></tr>
          ${m.nua_nr ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.nua_nr}</strong></td></tr>` : ''}
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Mangel:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.beschreibung_mangel || '-'}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Frist:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${fristText}</strong></td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Bauleiter:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.bauleiter || '-'}</td></tr>
        </table>
        <p><strong>Bitte behebe den Mangel bis zur angegebenen Frist.</strong></p>
        <table style="width: 100%; margin: 25px 0;">
          <tr><td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px;">
            <strong>💰 Hinweis zur Schlussrechnung:</strong><br>
            Die Zahlung erfolgt erst, wenn alle Mängel behoben wurden.
          </td></tr>
        </table>
      `
    }
  };

  return templates[type] || templates['new'];
}

async function getGraphAccessToken(): Promise<string> {
  const response = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const accessToken = await getGraphAccessToken();
  const htmlBody = wrapEmail(subject, body);

  await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
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

    // Hole alle pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('mangel_notifications')
      .select(`
        id, mangel_id, notification_type, recipient_type, recipient_email, recipient_name,
        maengel_fertigstellung!inner (
          id, mangel_nr, projekt_nr, beschreibung_mangel, bauleiter, nachunternehmer,
          nu_email, projektname_komplett, nua_nr, datum_frist, fotos_mangel,
          fotos_nachweis_nu, kommentar_nu
        )
      `)
      .eq('status', 'pending')
      .in('notification_type', ['nu_fixed', 'accepted', 'rejection', 'new'])
      .limit(50);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    for (const notif of notifications) {
      const mangel = (notif as any).maengel_fertigstellung as Mangel;
      const email = notif.recipient_email || (notif.recipient_type === 'nu' ? mangel.nu_email : null);

      if (!email) {
        await supabase.from('mangel_notifications').update({ status: 'failed', error_message: 'No email' }).eq('id', notif.id);
        results.push({ id: notif.id, status: 'failed', reason: 'no_email' });
        continue;
      }

      try {
        const template = getEmailTemplate(notif.notification_type, mangel, notif.recipient_name || '');
        await sendEmail(email, template.subject, template.body);

        await supabase.from('mangel_notifications').update({
          status: 'sent', sent_at: new Date().toISOString()
        }).eq('id', notif.id);

        results.push({ id: notif.id, type: notif.notification_type, to: email, status: 'sent' });
      } catch (err) {
        await supabase.from('mangel_notifications').update({ status: 'failed', error_message: String(err) }).eq('id', notif.id);
        results.push({ id: notif.id, status: 'failed', error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      message: 'Notifications processed',
      total: notifications.length,
      sent: results.filter(r => r.status === 'sent').length,
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
