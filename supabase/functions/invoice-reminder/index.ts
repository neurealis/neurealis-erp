import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Invoice Reminder Edge Function - NUR ABSCHLAGSRECHNUNG
 *
 * Sendet E-Mail-Erinnerung für Abschlagsrechnungen:
 * - 7 Tage nach Baustart
 * - Phase "(4) Umsetzung"
 * - Teil-Rechnung vereinbart = "Ja"
 * - Pro Projekt nur 1x (via invoice_reminder_log)
 *
 * Trigger: Cron Job (täglich um 7:00 Uhr)
 *
 * HINWEIS: Schlussrechnung-Erinnerungen werden per DB-Trigger
 * ausgelöst (siehe trg_schlussrechnung_reminder)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface ReminderResult {
  projektId: string;
  projektname: string;
  emailSent: boolean;
  error?: string;
}

// Hilfsfunktion: JSON-Text aus Monday column_values extrahieren
function extractColumnText(columnValue: string | null): string | null {
  if (!columnValue) return null;
  try {
    const parsed = JSON.parse(columnValue);
    return parsed.text || null;
  } catch {
    return null;
  }
}

// Hero-Link bereinigen (manchmal ist "HERO - " Prefix drin)
function cleanHeroLink(link: string | null): string {
  if (!link) return '';
  const match = link.match(/https:\/\/login\.hero-software\.de\/partner\/Projects\/view\/\d+/);
  return match ? match[0] : link;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: ReminderResult[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // ================================================================
    // ABSCHLAGSRECHNUNG ERINNERUNG
    // Bedingungen:
    // - Phase "(4) Umsetzung"
    // - Baustart vor genau 7 Tagen
    // - Teil-Rechnung vereinbart = "Ja" (status_mkm1nqts)
    // - Noch keine Erinnerung gesendet (1x pro Projekt)
    // ================================================================

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    console.log(`[Abschlag] Suche Projekte mit Baustart = ${sevenDaysAgoStr}`);

    const { data: abschlagProjekte, error: abschlagError } = await supabase
      .from('monday_bauprozess')
      .select('id, name, status_projekt, baustart, hero_link, column_values')
      .eq('status_projekt', '(4) Umsetzung')
      .eq('baustart', sevenDaysAgoStr);

    if (abschlagError) {
      console.error('Fehler bei Abschlag-Query:', abschlagError);
      throw abschlagError;
    }

    if (!abschlagProjekte || abschlagProjekte.length === 0) {
      console.log('[Abschlag] Keine passenden Projekte gefunden');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Keine Projekte mit Baustart vor 7 Tagen in Phase (4)',
          remindersSent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const projekt of abschlagProjekte) {
      // Prüfe ob Teilrechnung vereinbart = "Ja"
      const vereinbart = extractColumnText(projekt.column_values?.status_mkm1nqts);
      if (vereinbart !== 'Ja') {
        console.log(`[Abschlag] ${projekt.name}: Teilrechnung nicht vereinbart, überspringe`);
        continue;
      }

      // Prüfe ob bereits Erinnerung gesendet
      const { data: existingReminder } = await supabase
        .from('invoice_reminder_log')
        .select('id')
        .eq('projekt_id', projekt.id)
        .eq('reminder_type', 'abschlag')
        .single();

      if (existingReminder) {
        console.log(`[Abschlag] ${projekt.name}: Bereits erinnert, überspringe`);
        continue;
      }

      // Extrahiere Abschlagsprozent
      const abschlagProzent = extractColumnText(projekt.column_values?.zahlen0__1) || '0';
      const heroLink = cleanHeroLink(projekt.hero_link);

      // Sende E-Mail
      const emailBody = `
<p>Hallo Hannah,</p>

<p>das BV: <strong>${projekt.name}</strong> hat begonnen.</p>

<p>Dies ist eine freundliche Erinnerung, die Teil-Rechnung zu erstellen.</p>

<table style="margin: 20px 0; border-collapse: collapse;">
  <tr>
    <td style="padding: 8px 16px 8px 0; font-weight: bold;">Link zu HERO:</td>
    <td style="padding: 8px 0;"><a href="${heroLink}" style="color: #0066cc;">${heroLink}</a></td>
  </tr>
  <tr>
    <td style="padding: 8px 16px 8px 0; font-weight: bold;">Abschlagszahlung:</td>
    <td style="padding: 8px 0;">${abschlagProzent}%</td>
  </tr>
</table>

<p>Vielen Dank<br>Holger</p>
`;

      try {
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/email-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            to: 'buchhaltung@neurealis.de',
            subject: `Erinnerung: Abschlagsrechnung erstellen - ${projekt.name}`,
            body: emailBody,
            html: true,
          }),
        });

        if (emailResponse.ok) {
          await supabase.from('invoice_reminder_log').insert({
            projekt_id: projekt.id,
            projektname: projekt.name,
            reminder_type: 'abschlag',
            sent_to: 'buchhaltung@neurealis.de',
          });

          results.push({
            projektId: projekt.id,
            projektname: projekt.name,
            emailSent: true,
          });
          console.log(`[Abschlag] ✓ E-Mail gesendet für: ${projekt.name}`);
        } else {
          const errorText = await emailResponse.text();
          results.push({
            projektId: projekt.id,
            projektname: projekt.name,
            emailSent: false,
            error: errorText,
          });
          console.error(`[Abschlag] ✗ E-Mail Fehler für ${projekt.name}:`, errorText);
        }
      } catch (emailError) {
        results.push({
          projektId: projekt.id,
          projektname: projekt.name,
          emailSent: false,
          error: String(emailError),
        });
      }
    }

    const sentCount = results.filter(r => r.emailSent).length;

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent: sentCount,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fehler in invoice-reminder:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
