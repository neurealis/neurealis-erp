import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * mangel-overdue v1
 *
 * Prüft täglich um 0:30 Uhr ob Mängel-Fristen überschritten sind
 * und setzt status_mangel auf "(3) Überfällig"
 *
 * Status-Optionen:
 * - (0) Offen
 * - (1) In Bearbeitung
 * - (2) Nicht abgenommen
 * - (3) Überfällig
 * - (4) Abgenommen
 *
 * Erstellt: 2026-01-25
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const now = new Date().toISOString();

    // Finde alle offenen/in Bearbeitung Mängel mit überschrittener Frist
    // Nur (0) Offen und (1) In Bearbeitung können überfällig werden
    const { data: maengel, error: fetchError } = await supabase
      .from('maengel_fertigstellung')
      .select('id, mangel_nr, projekt_nr, datum_frist, status_mangel')
      .in('status_mangel', ['(0) Offen', '(1) In Bearbeitung'])
      .not('datum_frist', 'is', null)
      .lt('datum_frist', now);

    if (fetchError) {
      throw new Error(`Failed to fetch Maengel: ${fetchError.message}`);
    }

    if (!maengel || maengel.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'Keine überfälligen Mängel gefunden',
          processed: 0,
          timestamp: now
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${maengel.length} overdue Maengel`);

    // Update alle auf "(3) Überfällig"
    const ids = maengel.map(m => m.id);
    const { error: updateError } = await supabase
      .from('maengel_fertigstellung')
      .update({
        status_mangel: '(3) Überfällig',
        updated_at: now
      })
      .in('id', ids);

    if (updateError) {
      throw new Error(`Failed to update Maengel: ${updateError.message}`);
    }

    const results = maengel.map(m => ({
      id: m.id,
      mangel_nr: m.mangel_nr,
      projekt_nr: m.projekt_nr,
      frist: m.datum_frist,
      previous_status: m.status_mangel
    }));

    console.log(`Updated ${maengel.length} Maengel to "(3) Überfällig"`);

    return new Response(
      JSON.stringify({
        message: 'Überfällige Mängel aktualisiert',
        processed: maengel.length,
        timestamp: now,
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
