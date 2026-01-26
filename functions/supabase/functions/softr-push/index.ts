import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * softr-push v1
 *
 * Syncs Supabase nachtraege changes back to Softr
 * Called by database trigger when status changes
 */

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'XBbQjiFnPkmSE9';

// Softr Status Option IDs (from Softr database)
const STATUS_OPTIONS: Record<string, { id: string; label: string }> = {
  '(0) Offen': { id: 'c2566784-2b2f-4144-9c06-2bf3873939ee', label: '(0) Offen / Preis eingeben' },
  '(2) Genehmigt': { id: '7a8b9c0d-1234-5678-90ab-cdef12345678', label: '(2) Genehmigt' },
  '(3) Abgelehnt': { id: 'dc24515d-80f8-48d8-88f6-1717a7df1a07', label: '(2) Abgelehnt' }
};

// Field IDs
const SOFTR_FIELDS = {
  nachtrag_nr: 'nBEvh',
  status: 'BwLca'
};

interface PushRequest {
  nachtrag_nr: string;
  status: string;
}

async function findSoftrRecordId(nachtragNr: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?limit=100`,
      { headers: { 'Softr-Api-Key': SOFTR_API_KEY } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const records = data.data || [];

    const record = records.find((r: any) => r.fields?.[SOFTR_FIELDS.nachtrag_nr] === nachtragNr);
    return record?.id || null;
  } catch {
    return null;
  }
}

async function updateSoftrStatus(recordId: string, status: string): Promise<boolean> {
  // Map Supabase status to Softr status label
  // Softr options: (0) Offen / Preis eingeben, (1) Genehmigt, (2) Abgelehnt
  let softrStatus = status;
  if (status.includes('Genehmigt')) softrStatus = '(1) Genehmigt';
  else if (status.includes('Abgelehnt')) softrStatus = '(2) Abgelehnt';
  else if (status.includes('Offen')) softrStatus = '(0) Offen / Preis eingeben';

  try {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            [SOFTR_FIELDS.status]: softrStatus
          }
        })
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
    const { nachtrag_nr, status } = body;

    if (!nachtrag_nr || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing nachtrag_nr or status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing ${nachtrag_nr} status "${status}" to Softr...`);

    // Find Softr record ID
    const softrRecordId = await findSoftrRecordId(nachtrag_nr);
    if (!softrRecordId) {
      return new Response(
        JSON.stringify({ error: `Record ${nachtrag_nr} not found in Softr` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update Softr
    const success = await updateSoftrStatus(softrRecordId, status);

    if (success) {
      console.log(`Successfully synced ${nachtrag_nr} to Softr`);
      return new Response(
        JSON.stringify({ ok: true, nachtrag_nr, status }),
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
