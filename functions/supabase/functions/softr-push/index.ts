import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * softr-push v2
 *
 * Syncs Supabase nachtraege changes back to Softr
 * Called by database trigger when status or nachtrag_nr changes
 *
 * v2: Pusht auch nachtrag_nr zu Softr (war vorher fehlend)
 *     Sucht nach softr_record_id wenn nachtrag_nr nicht gefunden
 */

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'XBbQjiFnPkmSE9';

// Field IDs
const SOFTR_FIELDS = {
  nachtrag_nr: 'nBEvh',
  status: 'BwLca',
  atbs_nummer: 'zNnSQ',  // ATBS-Nummer Feld für Fallback-Suche
  titel: 'KSJH9'         // Titel Feld für Fallback-Suche
};

interface PushRequest {
  nachtrag_nr: string;
  status?: string;
  atbs_nummer?: string;
  titel?: string;
  softr_record_id?: string;
}

async function findSoftrRecordId(request: PushRequest): Promise<string | null> {
  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?limit=200`,
      { headers: { 'Softr-Api-Key': SOFTR_API_KEY } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const records = data.data || [];

    // Strategie 1: Nach nachtrag_nr suchen
    if (request.nachtrag_nr) {
      const record = records.find((r: any) => r.fields?.[SOFTR_FIELDS.nachtrag_nr] === request.nachtrag_nr);
      if (record) {
        console.log(`Found by nachtrag_nr: ${record.id}`);
        return record.id;
      }
    }

    // Strategie 2: Nach softr_record_id suchen
    if (request.softr_record_id) {
      const record = records.find((r: any) => r.id === request.softr_record_id);
      if (record) {
        console.log(`Found by softr_record_id: ${record.id}`);
        return record.id;
      }
    }

    // Strategie 3: Nach ATBS + Titel suchen (für neue Nachträge ohne nachtrag_nr in Softr)
    if (request.atbs_nummer && request.titel) {
      const record = records.find((r: any) =>
        r.fields?.[SOFTR_FIELDS.atbs_nummer] === request.atbs_nummer &&
        r.fields?.[SOFTR_FIELDS.titel] === request.titel &&
        !r.fields?.[SOFTR_FIELDS.nachtrag_nr]  // Nur Records ohne nachtrag_nr
      );
      if (record) {
        console.log(`Found by ATBS+Titel: ${record.id}`);
        return record.id;
      }
    }

    console.log('No matching Softr record found');
    return null;
  } catch (err) {
    console.error('findSoftrRecordId error:', err);
    return null;
  }
}

async function updateSoftrRecord(recordId: string, updates: Record<string, string>): Promise<boolean> {
  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: updates })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Softr update failed:', error);
      return false;
    }

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
    const body: PushRequest = await req.json();
    const { nachtrag_nr, status, atbs_nummer, titel, softr_record_id } = body;

    if (!nachtrag_nr && !softr_record_id && !(atbs_nummer && titel)) {
      return new Response(
        JSON.stringify({ error: 'Missing identifier (nachtrag_nr, softr_record_id, or atbs_nummer+titel)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing to Softr:`, { nachtrag_nr, status, atbs_nummer, titel, softr_record_id });

    // Find Softr record ID
    const foundRecordId = await findSoftrRecordId(body);
    if (!foundRecordId) {
      return new Response(
        JSON.stringify({ error: 'Record not found in Softr', searched: { nachtrag_nr, atbs_nummer, titel, softr_record_id } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build updates
    const updates: Record<string, string> = {};

    // Push nachtrag_nr if provided
    if (nachtrag_nr) {
      updates[SOFTR_FIELDS.nachtrag_nr] = nachtrag_nr;
    }

    // Push status if provided (with mapping)
    if (status) {
      let softrStatus = status;
      if (status.includes('Genehmigt')) softrStatus = '(1) Genehmigt';
      else if (status.includes('Abgelehnt')) softrStatus = '(2) Abgelehnt';
      else if (status.includes('Offen')) softrStatus = '(0) Offen / Preis eingeben';
      updates[SOFTR_FIELDS.status] = softrStatus;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No updates to push' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update Softr
    const success = await updateSoftrRecord(foundRecordId, updates);

    if (success) {
      console.log(`Successfully synced to Softr record ${foundRecordId}:`, updates);
      return new Response(
        JSON.stringify({ ok: true, softr_record_id: foundRecordId, updates }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Failed to update Softr' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
