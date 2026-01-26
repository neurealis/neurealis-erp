import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft 365 Credentials
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

// Postfächer für Sync
// service@ ist das Hauptpostfach (kontakt@ ist nur ein Alias davon)
const MAILBOXES = [
  { email: 'holger.neumann@neurealis.de', visibility: 'private' as const, owner: 'holger.neumann@neurealis.de' },
  { email: 'service@neurealis.de', visibility: 'company' as const, owner: null },
];

interface MS365Contact {
  id: string;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  emailAddresses: Array<{ address: string; name: string | null }>;
  mobilePhone: string | null;
  businessPhones: string[];
  homePhones: string[];
  businessAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    countryOrRegion: string | null;
  } | null;
  personalNotes: string | null;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

interface MailboxResult {
  mailbox: string;
  visibility: string;
  total_fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS365_CLIENT_ID,
      client_secret: MS365_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchContacts(accessToken: string, mailbox: string): Promise<MS365Contact[]> {
  const allContacts: MS365Contact[] = [];
  let nextLink: string | null = `${GRAPH_API_URL}/users/${mailbox}/contacts?$top=100&$select=id,displayName,givenName,surname,companyName,jobTitle,department,emailAddresses,mobilePhone,businessPhones,homePhones,businessAddress,personalNotes,createdDateTime,lastModifiedDateTime`;

  while (nextLink) {
    const response = await fetch(nextLink, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Wenn 404, hat das Postfach keine Kontakte oder kein Zugriff
      if (response.status === 404) {
        console.log(`Mailbox ${mailbox}: keine Kontakte oder kein Zugriff`);
        return [];
      }
      const error = await response.text();
      throw new Error(`Graph API error for ${mailbox}: ${response.status} - ${error}`);
    }

    const data = await response.json();
    allContacts.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return allContacts;
}

function mapMS365ToKontakt(contact: MS365Contact, mailbox: typeof MAILBOXES[number]) {
  const primaryEmail = contact.emailAddresses?.[0]?.address || null;
  const address = contact.businessAddress;

  // Anrede aus displayName ableiten (falls möglich)
  let anrede: string | null = null;
  if (contact.displayName?.startsWith('Herr ')) anrede = 'Herr';
  else if (contact.displayName?.startsWith('Frau ')) anrede = 'Frau';
  else if (contact.companyName && !contact.givenName) anrede = 'Firma';

  return {
    ms365_contact_id: contact.id,
    kontaktarten: ['ansprechpartner'],  // MS365 Kontakte sind meist Ansprechpartner
    anrede,
    vorname: contact.givenName,
    nachname: contact.surname,
    firma_kurz: contact.companyName,
    position: contact.jobTitle,
    abteilung: contact.department,
    email: primaryEmail,
    telefon_mobil: contact.mobilePhone,
    telefon_festnetz: contact.businessPhones?.[0] || null,
    telefon_privat: contact.homePhones?.[0] || null,
    strasse: address?.street,
    plz: address?.postalCode,
    ort: address?.city,
    land: address?.countryOrRegion || 'Deutschland',
    notizen: contact.personalNotes,
    visibility: mailbox.visibility,
    owner_email: mailbox.owner,
    sync_source: 'ms365',
    sync_mailbox: mailbox.email,
    last_synced_at: new Date().toISOString(),
  };
}

async function syncMailbox(accessToken: string, mailbox: typeof MAILBOXES[number]): Promise<MailboxResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const contacts = await fetchContacts(accessToken, mailbox.email);

  for (const contact of contacts) {
    try {
      const kontakt = mapMS365ToKontakt(contact, mailbox);

      // Skip wenn keine sinnvollen Daten
      if (!kontakt.email && !kontakt.firma_kurz && !kontakt.nachname) {
        skipped++;
        continue;
      }

      // Prüfen ob Kontakt existiert (nach MS365-ID + Mailbox)
      const { data: existing } = await supabase
        .from('kontakte')
        .select('id, last_synced_at')
        .eq('ms365_contact_id', contact.id)
        .eq('sync_mailbox', mailbox.email)
        .single();

      if (existing) {
        // Update nur wenn MS365-Daten neuer sind
        const ms365Updated = new Date(contact.lastModifiedDateTime);
        const lastSynced = existing.last_synced_at ? new Date(existing.last_synced_at) : new Date(0);

        if (ms365Updated > lastSynced) {
          const { error } = await supabase
            .from('kontakte')
            .update(kontakt)
            .eq('id', existing.id);

          if (error) throw error;
          updated++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'ms365',
            action: 'updated',
            kontakt_id: existing.id,
            external_id: contact.id,
            external_type: 'ms365_contact',
            details: { mailbox: mailbox.email, display_name: contact.displayName },
          });
        } else {
          skipped++;
        }
      } else {
        // Email-Duplikat prüfen (nur bei company visibility)
        let duplicateId: string | null = null;

        if (kontakt.email && mailbox.visibility === 'company') {
          const { data: emailMatch } = await supabase
            .from('kontakte')
            .select('id')
            .ilike('email', kontakt.email)
            .is('ms365_contact_id', null)
            .single();

          if (emailMatch) {
            duplicateId = emailMatch.id;
          }
        }

        if (duplicateId) {
          // Existierenden Kontakt mit MS365-ID verknüpfen
          const { error } = await supabase
            .from('kontakte')
            .update({
              ms365_contact_id: contact.id,
              sync_mailbox: mailbox.email,
              last_synced_at: kontakt.last_synced_at,
            })
            .eq('id', duplicateId);

          if (error) throw error;
          updated++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'ms365',
            action: 'merged',
            kontakt_id: duplicateId,
            external_id: contact.id,
            external_type: 'ms365_contact',
            details: { merged_by: 'email_match', email: kontakt.email, mailbox: mailbox.email },
          });
        } else {
          // Neuen Kontakt erstellen
          const { data: newKontakt, error } = await supabase
            .from('kontakte')
            .insert(kontakt)
            .select('id')
            .single();

          if (error) throw error;
          created++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'ms365',
            action: 'created',
            kontakt_id: newKontakt.id,
            external_id: contact.id,
            external_type: 'ms365_contact',
            details: { mailbox: mailbox.email, display_name: contact.displayName, visibility: mailbox.visibility },
          });
        }
      }
    } catch (err) {
      errors++;
      await supabase.from('kontakte_sync_log').insert({
        source: 'ms365',
        action: 'error',
        external_id: contact.id,
        external_type: 'ms365_contact',
        error_message: String(err),
        details: { mailbox: mailbox.email, display_name: contact.displayName },
      });
    }
  }

  return {
    mailbox: mailbox.email,
    visibility: mailbox.visibility,
    total_fetched: contacts.length,
    created,
    updated,
    skipped,
    errors,
  };
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter prüfen für selektiven Sync
    const url = new URL(req.url);
    const mailboxParam = url.searchParams.get('mailbox');

    // Access Token holen
    const accessToken = await getAccessToken();

    const results: MailboxResult[] = [];

    if (mailboxParam) {
      // Nur ein Postfach syncen
      const mailbox = MAILBOXES.find(m => m.email === mailboxParam);
      if (mailbox) {
        const result = await syncMailbox(accessToken, mailbox);
        results.push(result);
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: `Unbekanntes Postfach: ${mailboxParam}`,
          available_mailboxes: MAILBOXES.map(m => m.email),
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    } else {
      // Alle Postfächer syncen
      for (const mailbox of MAILBOXES) {
        try {
          const result = await syncMailbox(accessToken, mailbox);
          results.push(result);
        } catch (err) {
          // Fehler bei einzelnem Postfach loggen, aber weitermachen
          results.push({
            mailbox: mailbox.email,
            visibility: mailbox.visibility,
            total_fetched: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 1,
          });

          await supabase.from('kontakte_sync_log').insert({
            source: 'ms365',
            action: 'error',
            error_message: String(err),
            details: { mailbox: mailbox.email, phase: 'mailbox_fetch' },
          });
        }
      }
    }

    // Gesamtstatistiken
    const totals = {
      fetched: results.reduce((sum, r) => sum + r.total_fetched, 0),
      created: results.reduce((sum, r) => sum + r.created, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.reduce((sum, r) => sum + r.errors, 0),
    };

    return new Response(JSON.stringify({
      success: true,
      source: 'ms365',
      mailboxes: results,
      totals,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    await supabase.from('kontakte_sync_log').insert({
      source: 'ms365',
      action: 'error',
      error_message: String(error),
      details: { phase: 'global' },
    });

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
