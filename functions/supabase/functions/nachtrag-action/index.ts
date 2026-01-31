import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * nachtrag-action v2
 *
 * Handles approve/reject actions via URL click from email
 * Redirects to Softr portal after action
 */

const PORTAL_URL = 'https://neurealis.softr.app/nachtraege';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const url = new URL(req.url);
    const nachtragId = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    if (!nachtragId || !action) {
      return Response.redirect(PORTAL_URL + '?error=missing_params', 302);
    }

    if (!['approve', 'reject'].includes(action)) {
      return Response.redirect(PORTAL_URL + '?error=invalid_action', 302);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Nachtrag holen
    const { data: nachtrag, error: fetchError } = await supabase
      .from('nachtraege')
      .select('id, nachtrag_nr, status')
      .eq('id', nachtragId)
      .single();

    if (fetchError || !nachtrag) {
      return Response.redirect(PORTAL_URL + '?error=not_found', 302);
    }

    // Prüfen ob bereits bearbeitet
    if (nachtrag.status?.includes('Genehmigt') || nachtrag.status?.includes('Abgelehnt')) {
      return Response.redirect(PORTAL_URL + '?info=already_processed&nr=' + encodeURIComponent(nachtrag.nachtrag_nr), 302);
    }

    // Status updaten - Softr: (0) Offen, (1) Genehmigt, (2) Abgelehnt
    const newStatus = action === 'approve' ? '(1) Genehmigt' : '(2) Abgelehnt';

    const { error: updateError } = await supabase
      .from('nachtraege')
      .update({ status: newStatus })
      .eq('id', nachtragId);

    if (updateError) {
      return Response.redirect(PORTAL_URL + '?error=update_failed', 302);
    }

    // Erfolg - Redirect zum Portal mit Erfolgsmeldung
    const actionText = action === 'approve' ? 'approved' : 'rejected';
    return Response.redirect(
      PORTAL_URL + '?success=' + actionText + '&nr=' + encodeURIComponent(nachtrag.nachtrag_nr),
      302
    );

  } catch (error) {
    console.error('Error:', error);
    return Response.redirect(PORTAL_URL + '?error=server_error', 302);
  }
});
