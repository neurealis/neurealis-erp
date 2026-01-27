import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * dokument-sync-softr v1
 *
 * Syncs Supabase dokumente to Softr Dokumente table
 * Called by database trigger when new document is created
 */

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_DOKUMENTE_TABLE_ID = 'kNjsEhYYcNjAsj';

// Softr Field IDs for Dokumente table
const SOFTR_FIELDS = {
  dokument_nr: '8Ae7U',       // Dokument-Nr (SINGLE_LINE_TEXT)
  art_des_dokuments: '6tf0K', // Art des Dokuments (SELECT)
  atbs_nr: 'GBc7t',           // ATBS-Nr (SINGLE_LINE_TEXT)
  status_pruefung: 'VQ6v9',   // Status Prüfung (SELECT)
  notizen: 'iHzHD',           // Notizen (LONG_TEXT)
  datum_erstellt: 'Nupzi'     // Datum erstellt (DATETIME) - von Aufgaben, falls vorhanden
};

// Mapping von dok_typ zu Softr "Art des Dokuments"
const DOK_TYP_MAPPING: Record<string, string> = {
  'bestellung': 'Bestellung',
  'nachtrag': 'Nachtrag',
  'mangel': 'Mängelprotokoll',
  'rechnung': 'ER-M  Eingangsrechnung - Material'
};

interface DokumentPayload {
  dok_id: string;
  dok_typ: string;
  atbs_nummer: string;
  bezeichnung?: string;
  beschreibung?: string;
  status?: string;
  erstellt_am?: string;
}

async function findSoftrRecordByDokId(dokId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE_ID}/records?limit=100`,
      { headers: { 'Softr-Api-Key': SOFTR_API_KEY } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const records = data.data || [];

    const record = records.find((r: any) =>
      r.fields?.[SOFTR_FIELDS.dokument_nr] === dokId
    );
    return record?.id || null;
  } catch (err) {
    console.error('Error finding Softr record:', err);
    return null;
  }
}

async function createSoftrDokument(dokument: DokumentPayload): Promise<boolean> {
  const artDesDokuments = DOK_TYP_MAPPING[dokument.dok_typ] || 'Sonstiges';

  const fields: Record<string, any> = {
    [SOFTR_FIELDS.dokument_nr]: dokument.dok_id,
    [SOFTR_FIELDS.atbs_nr]: dokument.atbs_nummer,
    [SOFTR_FIELDS.art_des_dokuments]: artDesDokuments,
    [SOFTR_FIELDS.status_pruefung]: '(1) Erhalten / Erfasst'
  };

  // Optionale Felder
  if (dokument.beschreibung || dokument.bezeichnung) {
    fields[SOFTR_FIELDS.notizen] = dokument.beschreibung || dokument.bezeichnung;
  }

  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE_ID}/records`,
      {
        method: 'POST',
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Softr create failed:', error);
      return false;
    }

    console.log(`Created Softr document: ${dokument.dok_id}`);
    return true;
  } catch (err) {
    console.error('Softr create error:', err);
    return false;
  }
}

async function updateSoftrDokument(recordId: string, dokument: DokumentPayload): Promise<boolean> {
  const fields: Record<string, any> = {
    [SOFTR_FIELDS.atbs_nr]: dokument.atbs_nummer
  };

  if (dokument.status) {
    // Map status to Softr format
    if (dokument.status === 'gesendet') {
      fields[SOFTR_FIELDS.status_pruefung] = '(1) Erhalten / Erfasst';
    }
  }

  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE_ID}/records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Softr update failed:', error);
      return false;
    }

    console.log(`Updated Softr document: ${dokument.dok_id}`);
    return true;
  } catch (err) {
    console.error('Softr update error:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await req.json();

    // Kann als einzelnes Dokument oder Array kommen
    const dokumente: DokumentPayload[] = Array.isArray(body) ? body : [body];

    const results = [];

    for (const dokument of dokumente) {
      if (!dokument.dok_id || !dokument.atbs_nummer) {
        results.push({ dok_id: dokument.dok_id, error: 'Missing dok_id or atbs_nummer' });
        continue;
      }

      console.log(`Syncing ${dokument.dok_id} to Softr...`);

      // Prüfen ob bereits existiert
      const existingId = await findSoftrRecordByDokId(dokument.dok_id);

      let success: boolean;
      if (existingId) {
        success = await updateSoftrDokument(existingId, dokument);
      } else {
        success = await createSoftrDokument(dokument);
      }

      results.push({
        dok_id: dokument.dok_id,
        success,
        action: existingId ? 'updated' : 'created'
      });
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
