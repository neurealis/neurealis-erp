import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * nachtrag-notify v17
 *
 * Verarbeitet pending Notifications mit HTML-Templates
 * - **v17:** Bauleitung-Kontaktzeile aus allen NU-E-Mails entfernt
 * - **v16:** Bestätigungs-E-Mail für NU bei neuer Einreichung (confirmation_for_nu)
 *            Hinweis: Ausführung nicht empfohlen bis Genehmigung, Wiedervorlage aktiv
 * - **v15:** Direkte Softr-Refresh für projektname_komplett, projektname_extern, nua_nr
 *            Entfernt: Nachtrag-Nr Zeile (bereits im Betreff)
 * - Direkte Microsoft Graph API (nicht über email-send)
 * - neurealis Branding (Logo, Header, Footer)
 * - Inline-Bilder für Fotos
 * - UI-Link für Bauleitung
 * - Beträge nur bei Genehmigung für NU
 * - Vollständiger Projektname in E-Mails
 * - Du-Form für NU, Projektname in Betreff
 * - NUA-Nr in NU-E-Mails wenn vorhanden
 *
 * Aktualisiert: 2026-01-25
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UI URLs
const SOFTR_BASE_URL = 'https://neurealis.softr.app';
const NACHTRAG_DETAIL_PATH = '/nachtraege-detail';

interface Nachtrag {
  id: string;
  nachtrag_nr: string;
  atbs_nummer: string;
  titel: string;
  beschreibung: string;
  foto_urls: string[];
  betrag_kunde_netto: number | null;
  betrag_nu_netto: number | null;
  marge_prozent: number | null;
  verzoegerung_tage: number | null;
  gemeldet_von: string;
  melder_name: string;
  nu_name: string;
  nu_email: string;
  bauleiter_name: string;
  bauleiter_email: string;
  status: string;
  // Projektname direkt aus Softr
  projektname_komplett: string | null;
  projektname_extern: string | null;
  nua_nr: string | null;
}

interface Notification {
  id: string;
  nachtrag_id: string;
  recipient_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  notification_type: string;
}

// Währungsformat
function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

// Projektname formatieren - INTERN für Bauleitung (aus Softr: projektname_komplett)
function formatProjektNameIntern(n: Nachtrag): string {
  return n.projektname_komplett || n.atbs_nummer;
}

// Projektname formatieren - EXTERN für Nachunternehmer (aus Softr: projektname_extern)
function formatProjektNameExtern(n: Nachtrag): string {
  return n.projektname_extern || n.atbs_nummer;
}

// Dynamischen Betreff generieren
function generateSubject(n: Nachtrag, notificationType: string, recipientType: string): string {
  const projektName = recipientType === 'bauleiter'
    ? formatProjektNameIntern(n)
    : formatProjektNameExtern(n);

  switch (notificationType) {
    case 'new_for_bl':
      return `Neuer Nachtrag ${n.nachtrag_nr} – ${projektName}`;
    case 'new_for_nu':
      return `Neuer Nachtrag ${n.nachtrag_nr} – ${projektName}`;
    case 'confirmation_for_nu':
      return `Nachtrag ${n.nachtrag_nr} eingereicht – ${projektName}`;
    case 'approved':
      return `Nachtrag ${n.nachtrag_nr} genehmigt – ${projektName}`;
    case 'rejected':
      return `Nachtrag ${n.nachtrag_nr} abgelehnt – ${projektName}`;
    default:
      return `Nachtrag ${n.nachtrag_nr} – ${projektName}`;
  }
}

// Fotos als Inline-Bilder
function renderPhotos(urls: string[]): string {
  if (!urls || urls.length === 0) return '';

  const images = urls.map((url, i) => `
    <div style="margin: 10px 0;">
      <img src="${url}" alt="Foto ${i + 1}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #ddd;" />
    </div>
  `).join('');

  return `
    <div style="margin-top: 20px;">
      <h3 style="color: #333; margin-bottom: 10px;">Fotos</h3>
      ${images}
    </div>
  `;
}

// Status-Badge (Softr Master: (0) Offen / Preis eingeben, (1) Genehmigt, (2) Abgelehnt)
function getStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    '(0) Offen / Preis eingeben': '#ffc107',
    '(1) Genehmigt': '#28a745',
    '(2) Abgelehnt': '#dc3545',
  };
  const color = colors[status] || '#6c757d';
  return `<span style="background: ${color}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${status}</span>`;
}

// Action URLs
const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';

// E-Mail-Template für Bauleiter (neuer Nachtrag vom NU)
function templateForBauleiter(n: Nachtrag): string {
  const uiLink = `${SOFTR_BASE_URL}${NACHTRAG_DETAIL_PATH}?recordId=${n.id}`;
  const approveLink = `${SUPABASE_URL}/functions/v1/nachtrag-action?id=${n.id}&action=approve`;
  const rejectLink = `${SUPABASE_URL}/functions/v1/nachtrag-action?id=${n.id}&action=reject`;

  return `
    <p>Hallo ${n.bauleiter_name || 'Bauleitung'},</p>

    <p>Der Nachunternehmer <strong>${n.nu_name || n.melder_name || 'NU'}</strong> hat einen neuen Nachtrag gemeldet:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${formatProjektNameIntern(n)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Beschreibung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.beschreibung || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Gemeldet von:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.melder_name || 'NU'} (${n.nu_email || '-'})</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Betrag Kunde (netto):</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${formatCurrency(n.betrag_kunde_netto)}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Verzögerung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.verzoegerung_tage || 0} Tage</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    ${renderPhotos(n.foto_urls)}

    <div style="margin-top: 30px; text-align: center;">
      <a href="${approveLink}" style="background: #28a745; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 5px;">
        ✓ Nachtrag genehmigen
      </a>
      <a href="${rejectLink}" style="background: #dc3545; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 5px;">
        ✗ Nachtrag ablehnen
      </a>
    </div>

    <div style="margin-top: 20px; text-align: center;">
      <a href="${uiLink}" style="color: #007bff; text-decoration: underline;">
        Im Portal öffnen
      </a>
    </div>

    <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">
      Klicken Sie auf einen Button um den Nachtrag direkt zu bearbeiten.<br>
      Der Nachunternehmer wird automatisch per E-Mail benachrichtigt.
    </p>
  `;
}

// E-Mail-Template für NU (Genehmigung) - Du-Form
function templateForNuApproved(n: Nachtrag): string {
  const nuaRow = n.nua_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${n.nua_nr}</strong></td>
      </tr>` : '';

  return `
    <p>Hallo ${n.nu_name || 'Nachunternehmer'},</p>

    <p>gute Nachrichten! Dein Nachtrag wurde <strong style="color: #28a745;">genehmigt</strong>.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${formatProjektNameExtern(n)}</strong></td>
      </tr>${nuaRow}
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Beschreibung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.beschreibung || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Verzögerung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.verzoegerung_tage || 0} Tage</td>
      </tr>
      <tr style="background: #e8f5e9;">
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Dein Betrag (netto):</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 18px; color: #28a745;">${formatCurrency(n.betrag_nu_netto)}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    ${renderPhotos(n.foto_urls)}
  `;
}

// E-Mail-Template für NU (Ablehnung) - Du-Form
function templateForNuRejected(n: Nachtrag): string {
  const nuaRow = n.nua_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${n.nua_nr}</strong></td>
      </tr>` : '';

  return `
    <p>Hallo ${n.nu_name || 'Nachunternehmer'},</p>

    <p>leider wurde dein Nachtrag <strong style="color: #dc3545;">abgelehnt</strong>.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${formatProjektNameExtern(n)}</strong></td>
      </tr>${nuaRow}
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Beschreibung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.beschreibung || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    ${renderPhotos(n.foto_urls)}
  `;
}

// E-Mail-Template für NU (neuer Nachtrag von BL, genehmigt) - Du-Form
function templateForNuNew(n: Nachtrag): string {
  const nuaRow = n.nua_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${n.nua_nr}</strong></td>
      </tr>` : '';

  return `
    <p>Hallo ${n.nu_name || 'Nachunternehmer'},</p>

    <p>die Bauleitung hat einen neuen Nachtrag für dich angelegt und <strong style="color: #28a745;">genehmigt</strong>:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${formatProjektNameExtern(n)}</strong></td>
      </tr>${nuaRow}
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Beschreibung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.beschreibung || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Verzögerung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.verzoegerung_tage || 0} Tage</td>
      </tr>
      <tr style="background: #e8f5e9;">
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Dein Betrag (netto):</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 18px; color: #28a745;">${formatCurrency(n.betrag_nu_netto)}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    ${renderPhotos(n.foto_urls)}
  `;
}

// E-Mail-Template für NU (Bestätigung bei Einreichung) - Du-Form
function templateForNuConfirmation(n: Nachtrag): string {
  const nuaRow = n.nua_nr ? `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">NUA-Nr:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${n.nua_nr}</strong></td>
      </tr>` : '';

  return `
    <p>Hallo ${n.nu_name || 'Nachunternehmer'},</p>

    <p>vielen Dank für deine Nachtragsmeldung. Dein Nachtrag wurde erfolgreich eingereicht und wird nun von der Bauleitung geprüft.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${formatProjektNameExtern(n)}</strong></td>
      </tr>${nuaRow}
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Beschreibung:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.beschreibung || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #856404;">Wichtiger Hinweis:</p>
      <p style="margin: 0; color: #856404;">
        Die Ausführung dieses Nachtrags wird erst vergütet, sobald der Status auf <strong>„Genehmigt"</strong> gesetzt wurde.
        Bis dahin empfehlen wir, mit der Ausführung zu warten.
      </p>
      <p style="margin: 10px 0 0 0; color: #856404;">
        Wir haben eine Wiedervorlage eingerichtet und werden dich benachrichtigen, sobald sich der Status ändert.
      </p>
    </div>

    ${renderPhotos(n.foto_urls)}
  `;
}

// Fallback für alte Notifications ohne notification_type
function templateFallback(n: Nachtrag, recipientType: string): string {
  const uiLink = `${SOFTR_BASE_URL}${NACHTRAG_DETAIL_PATH}?recordId=${n.id}`;
  const projektName = recipientType === 'bauleiter'
    ? formatProjektNameIntern(n)
    : formatProjektNameExtern(n);

  return `
    <p>Ein Nachtrag wurde aktualisiert:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 150px; color: #666;">Projekt:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${projektName}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Titel:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${n.titel || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Status:</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${getStatusBadge(n.status)}</td>
      </tr>
    </table>

    ${recipientType === 'bauleiter' ? `
    <div style="margin-top: 20px; text-align: center;">
      <a href="${uiLink}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Im Portal öffnen
      </a>
    </div>` : ''}
  `;
}

// Template wählen
function getEmailBody(n: Nachtrag, notificationType: string, recipientType: string): string {
  switch (notificationType) {
    case 'new_for_bl':
      return templateForBauleiter(n);
    case 'new_for_nu':
      return templateForNuNew(n);
    case 'confirmation_for_nu':
      return templateForNuConfirmation(n);
    case 'approved':
      return templateForNuApproved(n);
    case 'rejected':
      return templateForNuRejected(n);
    default:
      return templateFallback(n, recipientType);
  }
}

// Microsoft Graph API Config
const MS_TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const MS_CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const MS_CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';
const SENDER_EMAIL = Deno.env.get('SMTP_FROM') || 'kontakt@neurealis.de';

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

// Softr Config
const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'XBbQjiFnPkmSE9';

// Field IDs für Felder
const SOFTR_FIELDS = {
  projektname_komplett: '3wDAW',
  projektname_extern: 'sDj4O',
  nua_nr: 'zQJJk',
  nachtrag_nr: 'nBEvh',
  foto_urls: '45hz6'
};

// Holt aktuelle Daten aus Softr für einen Nachtrag und updated Supabase
async function refreshFromSoftr(nachtragNr: string, supabase: any): Promise<Partial<Nachtrag> | null> {
  try {
    // Alle Nachträge aus Softr holen und nach nachtrag_nr filtern
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?limit=100`,
      { headers: { 'Softr-Api-Key': SOFTR_API_KEY } }
    );

    if (!response.ok) {
      console.error('Softr fetch failed:', response.status);
      return null;
    }

    const data = await response.json();
    const records = data.data || [];

    // Finde den passenden Record
    const softrRecord = records.find((r: any) => r.fields?.[SOFTR_FIELDS.nachtrag_nr] === nachtragNr);

    if (!softrRecord) {
      console.log(`Nachtrag ${nachtragNr} not found in Softr`);
      return null;
    }

    const fields = softrRecord.fields || {};
    const updates: Partial<Nachtrag> = {};

    // Extrahiere die Felder
    if (fields[SOFTR_FIELDS.projektname_komplett]) {
      updates.projektname_komplett = fields[SOFTR_FIELDS.projektname_komplett];
    }
    if (fields[SOFTR_FIELDS.projektname_extern]) {
      updates.projektname_extern = fields[SOFTR_FIELDS.projektname_extern];
    }
    if (fields[SOFTR_FIELDS.nua_nr]) {
      updates.nua_nr = fields[SOFTR_FIELDS.nua_nr];
    }

    // Foto URLs extrahieren (Softr speichert als Array von Objekten mit url property)
    const fotoField = fields[SOFTR_FIELDS.foto_urls];
    if (fotoField && Array.isArray(fotoField) && fotoField.length > 0) {
      updates.foto_urls = fotoField.map((f: any) => f.url).filter(Boolean);
    }

    // Update Supabase wenn es Updates gibt
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('nachtraege')
        .update(updates)
        .eq('nachtrag_nr', nachtragNr);

      if (error) {
        console.error('Failed to update Supabase:', error);
      } else {
        console.log(`Updated ${nachtragNr} with:`, updates);
      }
    }

    return updates;
  } catch (err) {
    console.error('refreshFromSoftr error:', err);
    return null;
  }
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

// Send email via Microsoft Graph API (with HTML template)
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

    // 2. Pending Notifications holen
    const { data: notifications, error: fetchError } = await supabase
      .from('nachtrag_notifications')
      .select('*')
      .eq('status', 'pending')
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${notifications.length} notifications`);
    const results = [];

    for (const notif of notifications as Notification[]) {
      try {
        // Nachtrag-Details holen
        let { data: nachtrag, error: nErr } = await supabase
          .from('nachtraege')
          .select('*')
          .eq('id', notif.nachtrag_id)
          .single();

        if (nErr || !nachtrag) {
          throw new Error(`Nachtrag not found: ${notif.nachtrag_id}`);
        }

        // Immer aus Softr refreshen für aktuelle Daten
        console.log(`Refreshing ${nachtrag.nachtrag_nr} from Softr...`);
        const softrUpdates = await refreshFromSoftr(nachtrag.nachtrag_nr, supabase);
        if (softrUpdates) {
          nachtrag = { ...nachtrag, ...softrUpdates };
        }

        // Dynamischen Betreff generieren (mit Projektname)
        const emailSubject = generateSubject(
          nachtrag as Nachtrag,
          notif.notification_type,
          notif.recipient_type
        );

        // HTML-Body generieren (innerer Content)
        const bodyContent = getEmailBody(
          nachtrag as Nachtrag,
          notif.notification_type,
          notif.recipient_type
        );

        // Sende direkt via Microsoft Graph API (mit HTML Template wrapper)
        await sendEmailViaGraph(
          notif.recipient_email,
          emailSubject,
          bodyContent
        );

        // Mark as sent + HTML Body speichern
        const fullHtmlBody = wrapEmail(emailSubject, bodyContent);
        await supabase
          .from('nachtrag_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            body: fullHtmlBody
          })
          .eq('id', notif.id);

        // Update nachtrag
        await supabase
          .from('nachtraege')
          .update({
            benachrichtigung_gesendet: true,
            benachrichtigt_am: new Date().toISOString()
          })
          .eq('id', notif.nachtrag_id);

        results.push({
          id: notif.id,
          status: 'sent',
          to: notif.recipient_email,
          type: notif.notification_type
        });
        console.log(`Sent ${notif.notification_type || 'notification'} to ${notif.recipient_email}`);

      } catch (sendError) {
        console.error(`Failed to send to ${notif.recipient_email}:`, sendError);

        await supabase
          .from('nachtrag_notifications')
          .update({
            status: 'failed',
            error_message: String(sendError)
          })
          .eq('id', notif.id);

        results.push({ id: notif.id, status: 'failed', error: String(sendError) });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notifications processed',
        total: notifications.length,
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
