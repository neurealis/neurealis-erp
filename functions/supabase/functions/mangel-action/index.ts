import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * mangel-action v1
 *
 * Verarbeitet Approve/Reject-Klicks aus E-Mails
 * - GET /mangel-action?id=xxx&action=approve → Status auf "(4) Abgenommen"
 * - GET /mangel-action?id=xxx&action=reject → Status auf "(2) Nicht abgenommen"
 *
 * Nach Status-Änderung wird der NU automatisch via Trigger benachrichtigt.
 *
 * Projekt: neurealis ERP (mfpuijttdgkllnvhvjlu)
 * Erstellt: 2026-01-26
 */

const PORTAL_URL = "https://neurealis.softr.app/maengel-fertigstellung";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const mangelId = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  if (!mangelId || !action) {
    return new Response(
      `<html><body><h1>Fehler</h1><p>Ungültige Parameter.</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (action !== "approve" && action !== "reject") {
    return new Response(
      `<html><body><h1>Fehler</h1><p>Ungültige Aktion: ${action}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Mangel laden
    const { data: mangel, error: fetchError } = await supabase
      .from("maengel_fertigstellung")
      .select("id, mangel_nr, projekt_nr, status_mangel, nachunternehmer")
      .eq("id", mangelId)
      .single();

    if (fetchError || !mangel) {
      return new Response(
        `<html><body><h1>Fehler</h1><p>Mangel nicht gefunden.</p></body></html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Status bereits gesetzt?
    if (mangel.status_mangel === "(4) Abgenommen" || mangel.status_mangel === "(2) Nicht abgenommen") {
      const statusText = mangel.status_mangel === "(4) Abgenommen" ? "abgenommen" : "nicht abgenommen";
      return new Response(
        `<html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="3;url=${PORTAL_URL}">
          <style>body{font-family:Arial,sans-serif;text-align:center;padding:50px;}</style>
        </head>
        <body>
          <h1>Bereits verarbeitet</h1>
          <p>Der Mangel <strong>${mangel.mangel_nr || mangel.projekt_nr}</strong> wurde bereits als <strong>${statusText}</strong> markiert.</p>
          <p>Du wirst in 3 Sekunden zum Portal weitergeleitet...</p>
          <p><a href="${PORTAL_URL}">Zum Portal</a></p>
        </body>
        </html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Status setzen
    const newStatus = action === "approve" ? "(4) Abgenommen" : "(2) Nicht abgenommen";
    const { error: updateError } = await supabase
      .from("maengel_fertigstellung")
      .update({ status_mangel: newStatus })
      .eq("id", mangelId);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    // Erfolgs-Seite
    const actionText = action === "approve" ? "abgenommen" : "nicht abgenommen";
    const actionColor = action === "approve" ? "#28a745" : "#dc3545";
    const actionEmoji = action === "approve" ? "✅" : "❌";

    return new Response(
      `<html>
      <head>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="3;url=${PORTAL_URL}">
        <style>
          body{font-family:Arial,sans-serif;text-align:center;padding:50px;}
          .status{background:${actionColor};color:white;padding:20px;border-radius:10px;display:inline-block;margin:20px 0;}
        </style>
      </head>
      <body>
        <div class="status">
          <h1>${actionEmoji} Mängelbehebung ${actionText}</h1>
        </div>
        <p>Der Mangel <strong>${mangel.mangel_nr || mangel.projekt_nr}</strong> wurde als <strong>${actionText}</strong> markiert.</p>
        <p>Der Nachunternehmer <strong>${mangel.nachunternehmer || ""}</strong> wird automatisch benachrichtigt.</p>
        <p>Du wirst in 3 Sekunden zum Portal weitergeleitet...</p>
        <p><a href="${PORTAL_URL}">Zum Portal</a></p>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      `<html><body><h1>Fehler</h1><p>${String(error)}</p></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
