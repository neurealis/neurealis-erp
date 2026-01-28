import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Alle möglichen Nachweise
const NACHWEIS_FELDER: Record<string, string> = {
  'color_mkt2e02p': 'Nachweis Rohinstallation Elektrik',
  'color_mkt2hpg0': 'Nachweis Rohinstallation Sanitär',
  'color_mkt2t435': 'Nachweis Abdichtung Bad',
  'color_mkt2t62x': 'E-Check Protokoll',
};

// Ausführungsart-Spalten in Monday
const AUSFUEHRUNGSART_FELDER = {
  elektrik: 'color590__1',
  bad: 'status23__1',
};

const ERLEDIGT_STATUS = ['Fertig', 'Erledigt', 'Komplett', 'OK', 'Ja', 'Erstellt'];

// Mapping: Ausführungsart → erforderliche Nachweise (basierend auf L051)
function ermittleErforderlicheNachweise(columnValues: Record<string, unknown>): string[] {
  const erforderlich: string[] = [];

  // Elektrik-Ausführungsart auslesen
  const elektrikRaw = extractText(columnValues[AUSFUEHRUNGSART_FELDER.elektrik]);
  const elektrik = elektrikRaw.toLowerCase();

  // Bad-Ausführungsart auslesen
  const badRaw = extractText(columnValues[AUSFUEHRUNGSART_FELDER.bad]);
  const bad = badRaw.toLowerCase();

  // Elektrik-Nachweise gemäß L051
  if (elektrik.includes('komplett')) {
    // Komplett → Rohinstallation + E-Check
    erforderlich.push('color_mkt2e02p', 'color_mkt2t62x');
  } else if (elektrik.includes('teil') || elektrik.includes('feininstall') || elektrik.includes('e-check')) {
    // Teil-Mod, Feininstallation (auch mit Typo "Feininstallaiton"), Nur E-Check → nur E-Check
    erforderlich.push('color_mkt2t62x');
  }
  // "Ohne" → keine Elektrik-Nachweise

  // Bad-Nachweise gemäß L051
  if (bad.includes('komplett')) {
    // Komplett → Rohinstallation Sanitär + Abdichtung
    erforderlich.push('color_mkt2hpg0', 'color_mkt2t435');
  } else if (bad.includes('fliese auf fliese') || bad.includes('fliese-auf-fliese')) {
    // Fliese auf Fliese → nur Abdichtung
    erforderlich.push('color_mkt2t435');
  }
  // "Nur Austausch Sanitärartikel" oder "Ohne Bad" → keine Bad-Nachweise

  // Duplikate entfernen
  return [...new Set(erforderlich)];
}

interface NachweisStatus { feld: string; name: string; status: string; istOffen: boolean; }
interface Ausfuehrungsart { elektrik: string; bad: string; }
interface CheckResult { atbs_nr: string; nua_nr: string; nu_name: string; nu_anrede: string; nu_email: string; dokument_nr: string; ausfuehrungsart: Ausfuehrungsart; erforderliche_nachweise: number; offene_nachweise: NachweisStatus[]; alle_erledigt: boolean; }

function extractText(jsonValue: unknown): string {
  if (!jsonValue) return '';
  if (typeof jsonValue === 'string') {
    try {
      const parsed = JSON.parse(jsonValue);
      return parsed?.text || '';
    } catch {
      return jsonValue;
    }
  }
  if (typeof jsonValue === 'object' && jsonValue !== null) {
    return (jsonValue as { text?: string }).text || '';
  }
  return '';
}

function istErledigt(status: string): boolean {
  if (!status) return false;
  const cleanStatus = status.replace(/^\(\d+\)\s*/, '').trim();
  return ERLEDIGT_STATUS.some(s => cleanStatus.toLowerCase().includes(s.toLowerCase()));
}

function generiereAnrede(nuName: string): string {
  if (!nuName) return 'Hallo';
  const nameParts = nuName.trim().split(/\s+/);
  const vorname = nameParts[0];
  return `Hallo ${vorname}`;
}

function berechneDeadline(): string {
  const heute = new Date();
  let tage = 0;
  const deadline = new Date(heute);
  while (tage < 2) { deadline.setDate(deadline.getDate() + 1); if (deadline.getDay() !== 0 && deadline.getDay() !== 6) tage++; }
  return deadline.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pruefeNachweise(columnValues: Record<string, unknown>, erforderlicheNachweise: string[]): NachweisStatus[] {
  // Nur die erforderlichen Nachweise prüfen (basierend auf Ausführungsart)
  return erforderlicheNachweise
    .filter(feld => NACHWEIS_FELDER[feld]) // Sicherstellen dass Feld existiert
    .map(feld => {
      const name = NACHWEIS_FELDER[feld];
      const status = extractText(columnValues[feld]);
      return { feld, name, status: status || 'Nicht gesetzt', istOffen: !istErledigt(status) };
    });
}

function generiereEmailBody(result: CheckResult): string {
  const deadline = berechneDeadline();
  const offeneNachweise = result.offene_nachweise.filter(n => n.istOffen);

  // Falls keine offenen Nachweise → sollte nicht aufgerufen werden, aber Fallback
  if (offeneNachweise.length === 0) {
    return `<p>${result.nu_anrede},</p>
<p>danke für deine Schlussrechnung <strong>${result.dokument_nr}</strong>. Alle erforderlichen Nachweise sind vorhanden.</p>
<p>Viele Grüße<br><strong>neurealis GmbH</strong></p>`;
  }

  const nachweisListe = offeneNachweise.map(n => `<tr><td style="padding:8px 15px 8px 0;border-bottom:1px solid #eee">${n.name}</td><td style="padding:8px 0;border-bottom:1px solid #eee;color:#dc3545;font-weight:bold">${n.status}</td></tr>`).join('');

  return `<p>${result.nu_anrede},</p>
<p>danke für deine Schlussrechnung <strong>${result.dokument_nr}</strong>.</p>
<table style="margin:20px 0;border-collapse:collapse;background:#f8f9fa;padding:15px">
  <tr><td style="padding:8px 20px 8px 15px;font-weight:bold">ATBS-Nr:</td><td>${result.atbs_nr}</td></tr>
  <tr><td style="padding:8px 20px 8px 15px;font-weight:bold">NUA-Nr:</td><td>${result.nua_nr}</td></tr>
  <tr><td style="padding:8px 20px 8px 15px;font-weight:bold">Elektrik:</td><td>${result.ausfuehrungsart.elektrik}</td></tr>
  <tr><td style="padding:8px 20px 8px 15px;font-weight:bold">Bad:</td><td>${result.ausfuehrungsart.bad}</td></tr>
</table>
<p>Basierend auf der Ausführungsart fehlen uns noch folgende <strong>Nachweise</strong>:</p>
<table style="margin:20px 0;border-collapse:collapse;width:100%">
  <thead><tr style="background:#f1f1f1"><th style="padding:10px 15px 10px 0;text-align:left;border-bottom:2px solid #dee2e6">Nachweis</th><th style="padding:10px 0;text-align:left;border-bottom:2px solid #dee2e6">Status</th></tr></thead>
  <tbody>${nachweisListe}</tbody>
</table>
<div style="background:#f8d7da;border:1px solid #f5c6cb;border-left:5px solid #dc3545;padding:20px;margin:25px 0">
  <p style="margin:0 0 10px 0;font-size:18px"><span style="color:#dc3545;font-size:22px">⚠️</span> <strong style="color:#721c24">Frist: ${deadline}</strong></p>
  <p style="margin:0;color:#721c24">Bitte lade die fehlenden Nachweise <strong>innerhalb von 2 Werktagen</strong> im Portal hoch.<br>Ohne vollständige Nachweise können wir die Schlussrechnung nicht zur Zahlung freigeben.</p>
</div>
<p style="text-align:center"><a href="https://neurealis-partnerportal.softr.app/anmeldung" style="display:inline-block;background:#dc3545;color:white;padding:12px 25px;text-decoration:none;font-weight:bold">Zum Partner-Portal</a></p>
<p>Viele Grüße<br><strong>neurealis GmbH</strong><br>Buchhaltung<br><a href="mailto:rechnungen@neurealis.de">rechnungen@neurealis.de</a></p>`;
}

async function sendeEmail(supabaseUrl: string, supabaseKey: string, to: string, subject: string, body: string, bcc?: string): Promise<boolean> {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, html: true, from_email: 'rechnungen@neurealis.de', ...(bcc ? { bcc } : {}) }),
  });
  return response.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json().catch(() => ({}));
    const { dokument_nr, mode, atbs_filter, test_email } = body as { dokument_nr?: string; mode?: 'check' | 'send'; atbs_filter?: string[]; test_email?: string; };

    // REST API für dokumente
    let restUrl = `${supabaseUrl}/rest/v1/dokumente?select=dokument_nr,art_des_dokuments,atbs_nummer,nua_nr,rechnungssteller,datum_erstellt,betrag_netto&art_des_dokuments=like.ER-NU-S%25`;

    if (atbs_filter && atbs_filter.length > 0) {
      restUrl += `&atbs_nummer=in.(${atbs_filter.join(',')})`;
    }
    if (dokument_nr) {
      restUrl += `&dokument_nr=eq.${encodeURIComponent(dokument_nr)}`;
    }

    const restResponse = await fetch(restUrl, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });

    if (!restResponse.ok) {
      throw new Error(`REST API Fehler: ${restResponse.status} - ${await restResponse.text()}`);
    }

    const schlussrechnungen = await restResponse.json();

    if (!schlussrechnungen || schlussrechnungen.length === 0) {
      return new Response(JSON.stringify({ message: 'Keine Schlussrechnungen gefunden', results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: CheckResult[] = [];
    const emailsSent: string[] = [];

    // Monday-Daten EINMAL laden (Performance-Optimierung)
    const allMondayUrl = `${supabaseUrl}/rest/v1/monday_bauprozess?select=name,column_values`;
    const allMondayResp = await fetch(allMondayUrl, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });

    if (!allMondayResp.ok) {
      throw new Error(`Monday API Fehler: ${allMondayResp.status}`);
    }

    const allMondayData = await allMondayResp.json();

    for (const sr of schlussrechnungen) {
      const atbsNr = sr.atbs_nummer;
      if (!atbsNr) continue;

      // Match im bereits geladenen Monday-Array finden
      const match = allMondayData.find((p: { column_values: Record<string, unknown> }) => {
        const atbsFeld = p.column_values?.['text49__1'];
        return extractText(atbsFeld) === atbsNr;
      });

      if (!match) continue;

      const columnValues = match.column_values as Record<string, unknown>;
      const nuaText = extractText(columnValues['text23__1']);
      const nuNameText = extractText(columnValues['text47__1']);
      let nuEmail = '';
      const nuEmailRaw = columnValues['e_mail9__1'];
      if (nuEmailRaw && typeof nuEmailRaw === 'object') {
        const emailObj = nuEmailRaw as { text?: string; value?: string; email?: string };
        nuEmail = emailObj.text || emailObj.email || '';
        if (!nuEmail && emailObj.value) try { nuEmail = JSON.parse(emailObj.value).email || ''; } catch {}
      }

      // Ausführungsart auslesen
      const ausfuehrungsart: Ausfuehrungsart = {
        elektrik: extractText(columnValues[AUSFUEHRUNGSART_FELDER.elektrik]) || 'Nicht gesetzt',
        bad: extractText(columnValues[AUSFUEHRUNGSART_FELDER.bad]) || 'Nicht gesetzt',
      };

      // Nur erforderliche Nachweise basierend auf Ausführungsart ermitteln
      const erforderlicheNachweise = ermittleErforderlicheNachweise(columnValues);

      // Prüfe nur die erforderlichen Nachweise
      const nachweisStatus = pruefeNachweise(columnValues, erforderlicheNachweise);
      const alleErledigt = nachweisStatus.length === 0 || nachweisStatus.filter(n => n.istOffen).length === 0;

      const result: CheckResult = {
        atbs_nr: atbsNr,
        nua_nr: nuaText || sr.nua_nr || '',
        nu_name: nuNameText,
        nu_anrede: generiereAnrede(nuNameText),
        nu_email: nuEmail,
        dokument_nr: sr.dokument_nr,
        ausfuehrungsart,
        erforderliche_nachweise: erforderlicheNachweise.length,
        offene_nachweise: nachweisStatus,
        alle_erledigt: alleErledigt
      };
      results.push(result);

      if (mode !== 'check' && !alleErledigt) {
        const targetEmail = test_email || nuEmail;
        if (!targetEmail) continue;
        const bccEmail = test_email ? undefined : 'tobias.rangol@neurealis.de';
        const sent = await sendeEmail(supabaseUrl, supabaseKey, targetEmail, `[${atbsNr}] Schlussrechnung erhalten - Offene Nachweise`, generiereEmailBody(result), bccEmail);
        if (sent) emailsSent.push(test_email ? `${atbsNr} → ${targetEmail} (TEST)` : `${atbsNr} → ${targetEmail}`);
      }
    }

    // Statistik über gefilterte Nachweise
    const totalErforderlich = results.reduce((sum, r) => sum + r.erforderliche_nachweise, 0);
    const totalOffen = results.reduce((sum, r) => sum + r.offene_nachweise.filter(n => n.istOffen).length, 0);

    return new Response(JSON.stringify({
      summary: {
        geprueft: results.length,
        mit_offenen_nachweisen: results.filter(r => !r.alle_erledigt).length,
        alle_erledigt: results.filter(r => r.alle_erledigt).length,
        erforderliche_nachweise_total: totalErforderlich,
        offene_nachweise_total: totalOffen,
        emails_gesendet: emailsSent.length,
        test_modus: !!test_email,
        hinweis: 'Nachweise werden basierend auf Ausführungsart (Elektrik/Bad) gefiltert'
      },
      results,
      emails_sent: emailsSent,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Fehler', details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
