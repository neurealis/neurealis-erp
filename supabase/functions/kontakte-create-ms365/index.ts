import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * kontakte-create-ms365
 *
 * Erstellt oder aktualisiert Kontakte in MS365 (service@ Postfach).
 * Verwendet Client Credentials Flow (Application Permissions).
 *
 * POST /kontakte-create-ms365
 * Body: { kontakte: [{ vorname, nachname, email, telefon, firma?, position? }] }
 *
 * Oder:
 * GET /kontakte-create-ms365?action=sync-mitarbeiter
 * → Synchronisiert vordefinierte Mitarbeiter
 */

// Microsoft Graph API
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const MAILBOX = 'service@neurealis.de';

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Microsoft 365 Credentials
const MS365_TENANT_ID = Deno.env.get('MS365_TENANT_ID')!;
const MS365_CLIENT_ID = Deno.env.get('MS365_CLIENT_ID')!;
const MS365_CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET')!;

interface Kontakt {
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  firma?: string;
  position?: string;
}

interface MS365Contact {
  id: string;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  companyName: string | null;
  jobTitle: string | null;
  emailAddresses: Array<{ address: string; name: string | null }>;
  mobilePhone: string | null;
  businessPhones: string[];
}

interface SyncResult {
  name: string;
  email: string;
  action: 'created' | 'updated' | 'unchanged' | 'error';
  ms365_id?: string;
  fields?: string[];
  error?: string;
}

// Vordefinierte Mitarbeiter für sync-mitarbeiter Action
const MITARBEITER: Kontakt[] = [
  {
    vorname: 'Zoltan',
    nachname: 'Barsony',
    email: 'zoltan.barsony@neurealis.de',
    telefon: '+49 176 63866874',
    firma: 'neurealis GmbH',
    position: 'Mitarbeiter'
  },
  {
    vorname: 'David',
    nachname: 'Hajdu',
    email: 'david.hajdu@neurealis.de',
    telefon: '+49 162 9497448',
    firma: 'neurealis GmbH',
    position: 'Mitarbeiter'
  },
  {
    vorname: 'Imre',
    nachname: 'Péntek',
    email: '029pentek@gmail.com',
    telefon: '+36 70 624 0950',
    firma: 'neurealis GmbH',
    position: 'Mitarbeiter'
  }
];

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

async function searchContactByEmail(accessToken: string, email: string): Promise<MS365Contact | null> {
  // Suche nach E-Mail-Adresse mit OData Filter
  const filterQuery = encodeURIComponent(`emailAddresses/any(e:e/address eq '${email}')`);
  const url = `${GRAPH_API_URL}/users/${MAILBOX}/contacts?$filter=${filterQuery}&$select=id,displayName,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    console.error(`Suche fehlgeschlagen für ${email}: ${response.status} - ${error}`);
    return null;
  }

  const data = await response.json();
  return data.value && data.value.length > 0 ? data.value[0] : null;
}

async function createContact(accessToken: string, kontakt: Kontakt): Promise<MS365Contact> {
  const contactData = {
    givenName: kontakt.vorname,
    surname: kontakt.nachname,
    displayName: `${kontakt.vorname} ${kontakt.nachname}`,
    emailAddresses: [
      {
        address: kontakt.email,
        name: `${kontakt.vorname} ${kontakt.nachname}`
      }
    ],
    mobilePhone: kontakt.telefon || null,
    companyName: kontakt.firma || null,
    jobTitle: kontakt.position || null
  };

  const url = `${GRAPH_API_URL}/users/${MAILBOX}/contacts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kontakt erstellen fehlgeschlagen: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function updateContact(
  accessToken: string,
  contactId: string,
  kontakt: Kontakt,
  existingContact: MS365Contact
): Promise<{ updated: boolean; fields: string[] }> {
  const updates: Record<string, string | null> = {};

  // Nur fehlende/unterschiedliche Felder aktualisieren
  if (!existingContact.mobilePhone && kontakt.telefon) {
    updates.mobilePhone = kontakt.telefon;
  }
  if (!existingContact.companyName && kontakt.firma) {
    updates.companyName = kontakt.firma;
  }
  if (!existingContact.jobTitle && kontakt.position) {
    updates.jobTitle = kontakt.position;
  }
  if (!existingContact.givenName && kontakt.vorname) {
    updates.givenName = kontakt.vorname;
  }
  if (!existingContact.surname && kontakt.nachname) {
    updates.surname = kontakt.nachname;
  }

  // Wenn keine Updates nötig
  if (Object.keys(updates).length === 0) {
    return { updated: false, fields: [] };
  }

  const url = `${GRAPH_API_URL}/users/${MAILBOX}/contacts/${contactId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kontakt aktualisieren fehlgeschlagen: ${response.status} - ${error}`);
  }

  return { updated: true, fields: Object.keys(updates) };
}

async function syncKontakte(kontakte: Kontakt[]): Promise<SyncResult[]> {
  const accessToken = await getAccessToken();
  const results: SyncResult[] = [];

  for (const kontakt of kontakte) {
    const name = `${kontakt.vorname} ${kontakt.nachname}`;

    try {
      // Suche nach bestehendem Kontakt
      const existingContact = await searchContactByEmail(accessToken, kontakt.email);

      if (existingContact) {
        // Prüfen ob Update nötig
        const updateResult = await updateContact(accessToken, existingContact.id, kontakt, existingContact);

        if (!updateResult.updated) {
          results.push({
            name,
            email: kontakt.email,
            action: 'unchanged',
            ms365_id: existingContact.id
          });
        } else {
          results.push({
            name,
            email: kontakt.email,
            action: 'updated',
            ms365_id: existingContact.id,
            fields: updateResult.fields
          });
        }
      } else {
        // Neuen Kontakt erstellen
        const newContact = await createContact(accessToken, kontakt);
        results.push({
          name,
          email: kontakt.email,
          action: 'created',
          ms365_id: newContact.id
        });
      }

      // Supabase aktualisieren: ms365_contact_id setzen
      const { error: updateError } = await supabase
        .from('kontakte')
        .update({
          ms365_contact_id: existingContact?.id || results[results.length - 1].ms365_id,
          sync_mailbox: MAILBOX,
          last_synced_at: new Date().toISOString(),
        })
        .eq('email', kontakt.email);

      if (updateError) {
        console.warn(`Supabase Update für ${kontakt.email} fehlgeschlagen:`, updateError);
      }

    } catch (err) {
      results.push({
        name,
        email: kontakt.email,
        action: 'error',
        error: String(err)
      });
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let kontakte: Kontakt[];

    if (action === 'sync-mitarbeiter') {
      // Vordefinierte Mitarbeiter synchronisieren
      kontakte = MITARBEITER;
    } else if (req.method === 'POST') {
      // Kontakte aus Request Body
      const body = await req.json();
      kontakte = body.kontakte || [];

      if (!Array.isArray(kontakte) || kontakte.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Keine Kontakte angegeben. Erwartet: { "kontakte": [...] }',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    } else {
      // Hilfe-Seite
      return new Response(JSON.stringify({
        name: 'kontakte-create-ms365',
        description: 'Erstellt oder aktualisiert Kontakte in MS365',
        usage: {
          'GET ?action=sync-mitarbeiter': 'Synchronisiert vordefinierte Mitarbeiter (Zoltan, David, Imre)',
          'POST': 'Erstellt/aktualisiert Kontakte aus Request Body',
        },
        postBody: {
          kontakte: [
            { vorname: 'Max', nachname: 'Mustermann', email: 'max@example.com', telefon: '+49 123 456789', firma: 'Firma GmbH', position: 'Mitarbeiter' }
          ]
        },
        mailbox: MAILBOX,
        predefinedMitarbeiter: MITARBEITER.map(m => `${m.vorname} ${m.nachname} (${m.email})`),
      }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Kontakte synchronisieren
    const results = await syncKontakte(kontakte);

    // Statistiken
    const stats = {
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      unchanged: results.filter(r => r.action === 'unchanged').length,
      errors: results.filter(r => r.action === 'error').length,
    };

    return new Response(JSON.stringify({
      success: stats.errors === 0,
      mailbox: MAILBOX,
      stats,
      results,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Fehler:', error);

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
