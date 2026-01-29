import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * mangel-reminder v5
 *
 * Sendet automatische Erinnerungen für Mängel alle 2 Tage
 * - Nur Mängel mit erinnerung_status = 'Aktiv' werden verarbeitet
 * - NEU v5: KEINE Erinnerung wenn status_mangel geschlossen ist
 *   (Abgenommen, Abgeschlossen, Erledigt, Geschlossen)
 * - Softr One-Click Edit setzt 'Aktiv' → Erinnerungen starten
 * - Trackt letzte_erinnerung_am und erinnerung_count
 * - Nutzt Microsoft Graph API für E-Mail-Versand
 * - Farbliche Status-Hervorhebung im Body
 * - Hinweis zur Schlussrechnung
 *
 * Aktualisiert: 2026-01-29
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

const REMINDER_INTERVAL_DAYS = 2;

// Geschlossene Status-Werte - KEINE Erinnerung wenn status_mangel einen dieser Werte hat
const CLOSED_STATUS_VALUES = ['Abgenommen', 'Abgeschlossen', 'Erledigt', 'Geschlossen'];

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
  status_mangel: string;
  status_mangel_nu: string | null;
  datum_meldung: string | null;
  datum_frist: string | null;
  letzte_erinnerung_am: string | null;
  erinnerung_count: number;
  erinnerung_status: string | null;
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
img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
p { display: block; margin: 13px 0; }
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

// Erinnerungs-E-Mail Template für NU
function templateReminderNU(m: Mangel, reminderCount: number): string {
  const now = new Date();
  const fristDate = m.datum_frist ? new Date(m.datum_frist) : null;
  const isOverdue = fristDate && fristDate < now;

  // Dringlichkeit: 1-2 = gelb, 3-4 = orange, 5+ oder überfällig = rot
  let urgencyColor = '#ffc107'; // gelb
  let urgencyText = 'Mangel offen';
  let urgencyIcon = '⚠️';

  if (reminderCount >= 5 || isOverdue) {
    urgencyColor = '#dc3545'; // rot
    urgencyText = isOverdue ? 'FRIST ÜBERSCHRITTEN' : 'DRINGEND - Wiederholte Mahnung';
    urgencyIcon = '🔴';
  } else if (reminderCount >= 3) {
    urgencyColor = '#fd7e14'; // orange
    urgencyText = 'Erhöhte Dringlichkeit';
    urgencyIcon = '🟠';
  }

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

    <!-- Status-Box mit Farbcodierung -->
    <table style="width: 100%; margin: 20px 0;">
      <tr>
        <td style="background-color: ${urgencyColor}; padding: 15px 20px; color: ${urgencyColor === '#ffc107' ? '#000' : '#fff'};">
          <strong style="font-size: 16px;">${urgencyIcon} Erinnerung #${reminderCount}: ${urgencyText}</strong>
        </td>
      </tr>
    </table>

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
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${isOverdue
            ? `<span style="background-color: #dc3545; color: white; padding: 3px 8px; font-weight: bold;">${fristText} - ÜBERFÄLLIG</span>`
            : fristDate
              ? `<strong>${fristText}</strong>`
              : fristText
          }
        </td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Gemeldet am:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.datum_meldung ? new Date(m.datum_meldung).toLocaleDateString('de-DE') : 'Unbekannt'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Bauleiter:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${m.bauleiter || '-'}</td>
      </tr>
    </table>

    <p>Bitte behebe den Mangel so schnell wie möglich und melde dich bei der Bauleitung.</p>

    <!-- Hinweis zur Schlussrechnung -->
    <table style="width: 100%; margin: 25px 0;">
      <tr>
        <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px;">
          <strong>💰 Hinweis zur Schlussrechnung:</strong><br>
          Die Zahlung der Schlussrechnung erfolgt erst, wenn alle bis dahin gemeldeten Mängel behoben wurden.
        </td>
      </tr>
    </table>

    <p style="margin-top: 20px; color: #999; font-size: 12px;">
      Du erhältst diese Erinnerung automatisch alle 2 Tage bis der Mangel behoben ist.
    </p>
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

    // 1. Finde Mängel mit erinnerung_status = 'Aktiv' die eine Erinnerung brauchen
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - REMINDER_INTERVAL_DAYS);

    // v5: Nur Mängel mit erinnerung_status = 'Aktiv' UND status_mangel NICHT geschlossen
    const { data: maengel, error: fetchError } = await supabase
      .from('maengel_fertigstellung')
      .select('*')
      .eq('erinnerung_status', 'Aktiv')
      .not('status_mangel', 'in', `(${CLOSED_STATUS_VALUES.map(s => `"${s}"`).join(',')})`)
      .or(`letzte_erinnerung_am.is.null,letzte_erinnerung_am.lt.${twoDaysAgo.toISOString()}`);

    if (fetchError) {
      throw new Error(`Failed to fetch Maengel: ${fetchError.message}`);
    }

    if (!maengel || maengel.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No reminders needed', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${maengel.length} Maengel with erinnerung_status='Aktiv' needing reminders`);
    const results = [];

    for (const mangel of maengel as Mangel[]) {
      let nuEmail = mangel.nu_email;
      let nuName = mangel.nachunternehmer;

      try {
        // Wenn keine nu_email vorhanden, hole sie aus monday_bauprozess (via projekt_nr)
        if (!nuEmail && mangel.projekt_nr) {
          const { data: projekt } = await supabase
            .from('monday_bauprozess')
            .select('column_values')
            .eq('projekt_nr', mangel.projekt_nr)
            .limit(1)
            .single();

          if (projekt?.column_values) {
            const cv = projekt.column_values as Record<string, any>;
            const nuEmailFromProject = cv['e_mail4__1']?.value?.email || cv['e_mail4__1']?.text;
            const nuNameFromProject = cv['text57__1']?.value || cv['text57__1']?.text;

            if (nuEmailFromProject) {
              nuEmail = nuEmailFromProject;
              nuName = nuNameFromProject || nuName;
              console.log(`Found NU data from monday_bauprozess for ${mangel.projekt_nr}: ${nuEmail}`);
            }
          }
        }

        // Skip wenn immer noch keine E-Mail
        if (!nuEmail) {
          console.log(`Skipping ${mangel.id} - no NU email found`);
          results.push({
            mangel_id: mangel.id,
            projekt: mangel.projekt_nr,
            status: 'skipped',
            reason: 'no_nu_email'
          });
          continue;
        }

        const mangelWithNU = { ...mangel, nu_email: nuEmail, nachunternehmer: nuName };
        const newCount = (mangel.erinnerung_count || 0) + 1;
        const mangelRef = mangel.mangel_nr || mangel.projekt_nr;
        const subject = `Erinnerung #${newCount}: Offener Mangel ${mangelRef}`;
        const bodyContent = templateReminderNU(mangelWithNU, newCount);

        // E-Mail senden
        await sendEmailViaGraph(nuEmail, subject, bodyContent);

        // Mangel aktualisieren
        await supabase
          .from('maengel_fertigstellung')
          .update({
            letzte_erinnerung_am: new Date().toISOString(),
            erinnerung_count: newCount,
            nu_email: nuEmail,
            nachunternehmer: nuName,
          })
          .eq('id', mangel.id);

        // Notification loggen
        await supabase
          .from('mangel_notifications')
          .insert({
            mangel_id: mangel.id,
            notification_type: 'reminder',
            recipient_type: 'nu',
            recipient_email: nuEmail,
            recipient_name: nuName,
            subject: subject,
            body: wrapEmail(subject, bodyContent),
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

        results.push({
          mangel_id: mangel.id,
          projekt: mangel.projekt_nr,
          to: nuEmail,
          reminder_count: newCount,
          status: 'sent'
        });

        console.log(`Sent reminder #${newCount} to ${nuEmail} for ${mangel.projekt_nr}`);

      } catch (sendError) {
        console.error(`Failed to send reminder for ${mangel.id}:`, sendError);

        await supabase
          .from('mangel_notifications')
          .insert({
            mangel_id: mangel.id,
            notification_type: 'reminder',
            recipient_type: 'nu',
            recipient_email: nuEmail || 'unknown',
            recipient_name: nuName,
            subject: `Erinnerung - ${mangel.projekt_nr}`,
            status: 'failed',
            error_message: String(sendError),
          });

        results.push({
          mangel_id: mangel.id,
          projekt: mangel.projekt_nr,
          status: 'failed',
          error: String(sendError)
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reminders processed',
        total: maengel.length,
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
