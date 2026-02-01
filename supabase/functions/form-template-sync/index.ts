/**
 * Edge Function: form-template-sync
 *
 * Bidirektionaler Template-Sync zwischen neurealis ERP und LifeOps.
 *
 * Endpoints:
 * - POST /webhook: Empfängt eingehende Sync-Requests von LifeOps
 * - POST /push: Sendet lokale Templates an LifeOps
 * - POST /pull: Holt Templates von LifeOps
 * - POST /sync-all: Vollständiger bidirektionaler Sync
 *
 * Konfliktauflösung: Neuestes Template (updated_at) gewinnt
 *
 * Erstellt: 2026-02-01
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Typen
interface FormTemplate {
  id: string;
  sync_id: string;
  name: string;
  category: string | null;
  pdf_hash: string | null;
  visual_hash: string | null;
  fields_schema: Record<string, unknown>;
  page_count: number | null;
  source_project: string | null;
  confidence_score: number | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  sync_source: string | null;
  sync_status: string;
}

interface SyncPayload {
  templates: FormTemplate[];
  source: 'lifeops' | 'neurealis';
  timestamp: string;
}

interface SyncResult {
  success: boolean;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Konfiguration
const NEUREALIS_SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const NEUREALIS_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const LIFEOPS_SUPABASE_URL = Deno.env.get('LIFEOPS_SUPABASE_URL') || 'https://rlqkhsgulyyozhetlrqy.supabase.co';
const LIFEOPS_SERVICE_KEY = Deno.env.get('LIFEOPS_SERVICE_ROLE_KEY') || '';
const SYNC_SECRET = Deno.env.get('FORM_SYNC_SECRET') || '';

// Clients initialisieren
function getNeurealisClient(): SupabaseClient {
  return createClient(NEUREALIS_SUPABASE_URL, NEUREALIS_SERVICE_KEY);
}

function getLifeOpsClient(): SupabaseClient {
  return createClient(LIFEOPS_SUPABASE_URL, LIFEOPS_SERVICE_KEY);
}

// Sync-Secret validieren
function validateSyncSecret(request: Request): boolean {
  const authHeader = request.headers.get('X-Sync-Secret');
  if (!SYNC_SECRET) {
    console.warn('FORM_SYNC_SECRET nicht konfiguriert - Sync-Authentifizierung deaktiviert');
    return true;
  }
  return authHeader === SYNC_SECRET;
}

/**
 * Webhook: Empfängt eingehende Templates von LifeOps
 */
async function handleWebhook(payload: SyncPayload): Promise<SyncResult> {
  const client = getNeurealisClient();
  const result: SyncResult = {
    success: true,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const template of payload.templates) {
    result.processed++;

    try {
      // Upsert via RPC-Funktion (inkl. Konfliktauflösung)
      const { data, error } = await client.rpc('upsert_synced_template', {
        p_sync_id: template.sync_id,
        p_name: template.name,
        p_category: template.category,
        p_pdf_hash: template.pdf_hash,
        p_visual_hash: template.visual_hash,
        p_fields_schema: template.fields_schema,
        p_page_count: template.page_count,
        p_source_project: template.source_project,
        p_confidence_score: template.confidence_score,
        p_usage_count: template.usage_count,
        p_remote_updated_at: template.updated_at,
        p_sync_source: payload.source,
      });

      if (error) {
        result.errors.push(`Template ${template.name}: ${error.message}`);
      } else {
        result.updated++;
      }
    } catch (err) {
      result.errors.push(`Template ${template.name}: ${err.message}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Push: Sendet lokale Templates an LifeOps
 */
async function handlePush(): Promise<SyncResult> {
  const neurealisClient = getNeurealisClient();
  const lifeopsClient = getLifeOpsClient();

  const result: SyncResult = {
    success: true,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Templates abrufen, die synchronisiert werden müssen
  const { data: templates, error: fetchError } = await neurealisClient.rpc('get_templates_for_sync');

  if (fetchError) {
    return {
      ...result,
      success: false,
      errors: [`Fehler beim Abrufen der Templates: ${fetchError.message}`],
    };
  }

  if (!templates || templates.length === 0) {
    return { ...result, success: true };
  }

  // Templates an LifeOps senden
  try {
    for (const template of templates) {
      result.processed++;

      // Sync-ID generieren falls nicht vorhanden
      const syncId = template.sync_id || crypto.randomUUID();

      // In LifeOps upserten
      const { data: existingTemplate } = await lifeopsClient
        .from('form_templates')
        .select('id, updated_at')
        .eq('sync_id', syncId)
        .single();

      if (existingTemplate) {
        // Konfliktauflösung: Neuestes gewinnt
        const localUpdated = new Date(template.updated_at);
        const remoteUpdated = new Date(existingTemplate.updated_at);

        if (localUpdated > remoteUpdated) {
          // Lokal ist neuer -> Update
          const { error: updateError } = await lifeopsClient
            .from('form_templates')
            .update({
              name: template.name,
              category: template.category,
              pdf_hash: template.pdf_hash,
              visual_hash: template.visual_hash,
              fields_schema: template.fields_schema,
              page_count: template.page_count,
              source_project: template.source_project,
              confidence_score: template.confidence_score,
              usage_count: Math.max(template.usage_count, existingTemplate.usage_count || 0),
              updated_at: template.updated_at,
              synced_at: new Date().toISOString(),
              sync_source: 'neurealis',
              sync_status: 'synced',
            })
            .eq('id', existingTemplate.id);

          if (updateError) {
            result.errors.push(`Update ${template.name}: ${updateError.message}`);
          } else {
            result.updated++;
          }
        } else {
          result.skipped++;
        }
      } else {
        // Neues Template einfügen
        const { error: insertError } = await lifeopsClient
          .from('form_templates')
          .insert({
            sync_id: syncId,
            name: template.name,
            category: template.category,
            pdf_hash: template.pdf_hash,
            visual_hash: template.visual_hash,
            fields_schema: template.fields_schema,
            page_count: template.page_count,
            source_project: 'neurealis',
            confidence_score: template.confidence_score,
            usage_count: template.usage_count,
            synced_at: new Date().toISOString(),
            sync_source: 'neurealis',
            sync_status: 'synced',
          });

        if (insertError) {
          result.errors.push(`Insert ${template.name}: ${insertError.message}`);
        } else {
          result.inserted++;
        }
      }

      // Lokal als synced markieren
      await neurealisClient.rpc('mark_template_synced', {
        p_template_id: template.id,
        p_sync_id: syncId,
        p_sync_source: 'neurealis',
      });
    }
  } catch (err) {
    result.errors.push(`Push-Fehler: ${err.message}`);
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Pull: Holt Templates von LifeOps
 */
async function handlePull(): Promise<SyncResult> {
  const neurealisClient = getNeurealisClient();
  const lifeopsClient = getLifeOpsClient();

  const result: SyncResult = {
    success: true,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Alle Templates von LifeOps abrufen
  const { data: remoteTemplates, error: fetchError } = await lifeopsClient
    .from('form_templates')
    .select('*')
    .not('sync_id', 'is', null);

  if (fetchError) {
    return {
      ...result,
      success: false,
      errors: [`Fehler beim Abrufen von LifeOps: ${fetchError.message}`],
    };
  }

  // Auch Templates ohne sync_id abrufen (source_project = lifeops)
  const { data: lifeopsTemplates, error: fetchError2 } = await lifeopsClient
    .from('form_templates')
    .select('*')
    .eq('source_project', 'lifeops')
    .is('sync_id', null);

  if (!fetchError2 && lifeopsTemplates) {
    for (const template of lifeopsTemplates) {
      template.sync_id = crypto.randomUUID();

      // Sync-ID in LifeOps speichern
      await lifeopsClient
        .from('form_templates')
        .update({ sync_id: template.sync_id })
        .eq('id', template.id);
    }
    remoteTemplates?.push(...lifeopsTemplates);
  }

  if (!remoteTemplates || remoteTemplates.length === 0) {
    return { ...result, success: true };
  }

  // Templates lokal upserten
  for (const template of remoteTemplates) {
    result.processed++;

    try {
      const { data, error } = await neurealisClient.rpc('upsert_synced_template', {
        p_sync_id: template.sync_id,
        p_name: template.name,
        p_category: template.category,
        p_pdf_hash: template.pdf_hash,
        p_visual_hash: template.visual_hash,
        p_fields_schema: template.fields_schema,
        p_page_count: template.page_count,
        p_source_project: template.source_project,
        p_confidence_score: template.confidence_score,
        p_usage_count: template.usage_count,
        p_remote_updated_at: template.updated_at,
        p_sync_source: 'lifeops',
      });

      if (error) {
        result.errors.push(`Template ${template.name}: ${error.message}`);
      } else {
        result.updated++;
      }
    } catch (err) {
      result.errors.push(`Template ${template.name}: ${err.message}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Sync-All: Vollständiger bidirektionaler Sync
 */
async function handleSyncAll(): Promise<{ push: SyncResult; pull: SyncResult }> {
  // Erst Push (lokale Änderungen zu LifeOps)
  const pushResult = await handlePush();

  // Dann Pull (LifeOps Änderungen holen)
  const pullResult = await handlePull();

  return { push: pushResult, pull: pullResult };
}

// Main Handler
Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Nur POST erlaubt
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // URL parsen
  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    let result;

    switch (action) {
      case 'webhook':
        // Webhook von LifeOps - Sync-Secret validieren
        if (!validateSyncSecret(req)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const payload = await req.json() as SyncPayload;
        result = await handleWebhook(payload);
        break;

      case 'push':
        // Push lokale Templates zu LifeOps
        result = await handlePush();
        break;

      case 'pull':
        // Pull Templates von LifeOps
        result = await handlePull();
        break;

      case 'sync-all':
      case 'form-template-sync':  // Default wenn direkt aufgerufen
        // Vollständiger bidirektionaler Sync
        result = await handleSyncAll();
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Sync-Fehler:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
