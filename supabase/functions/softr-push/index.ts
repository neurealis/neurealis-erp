/**
 * softr-push Edge Function v3
 *
 * Pusht Supabase-Änderungen nach Softr.io
 * Wird per DB-Trigger aufgerufen bei INSERT/UPDATE
 *
 * Rate-Limiting: Max 50 Requests/Minute (Softr API Limit)
 * Loop-Vermeidung: Nur pushen wenn sync_source != 'softr'
 *
 * Deployed: 2026-02-01
 * verify_jwt: false (für Trigger-Calls ohne Auth)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Softr Tables API Configuration (wie in softr-sync)
const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = Deno.env.get('SOFTR_DATABASE_ID') || 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_API_BASE = 'https://tables-api.softr.io/api/v1';

// Supabase Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Table Configuration - aus softr_sync_config
interface TableConfig {
  softr_table_id: string;
  supabase_table_name: string;
  field_mapping: Record<string, string>;
}

// Softr Record Interface
interface SoftrRecord {
  recordId: string;
  fields: Record<string, any>;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { table, record_id, softr_record_id, operation } = await req.json();

    console.log(`[softr-push] ${operation} auf ${table}, Record: ${record_id}`);

    // Supabase Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Tabellenkonfiguration laden
    const { data: config, error: configError } = await supabase
      .from('softr_sync_config')
      .select('*')
      .eq('supabase_table_name', table)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.log(`[softr-push] Keine Konfiguration für Tabelle ${table}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Keine Sync-Konfiguration für ${table}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Record aus Supabase laden
    const { data: record, error: recordError } = await supabase
      .from(table)
      .select('*')
      .eq('id', record_id)
      .single();

    if (recordError || !record) {
      console.error(`[softr-push] Record nicht gefunden: ${record_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Record ${record_id} nicht gefunden`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 3. Loop-Vermeidung: Nicht pushen wenn von Softr
    if (record.sync_source === 'softr') {
      console.log(`[softr-push] Übersprungen - sync_source = 'softr'`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'sync_source is softr'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Feld-Mapping: Supabase → Softr
    const softrFields: Record<string, any> = {};
    const fieldMapping = config.field_mapping as Record<string, string>;

    for (const [softrFieldId, supabaseColumn] of Object.entries(fieldMapping)) {
      const value = record[supabaseColumn];
      if (value !== undefined && value !== null) {
        softrFields[softrFieldId] = value;
      }
    }

    // 5. Softr API Call
    let softrResponse: Response;
    let softrResult: any;

    if (softr_record_id || record.softr_record_id) {
      // UPDATE: Existierender Softr-Record
      const recordIdToUpdate = softr_record_id || record.softr_record_id;

      console.log(`[softr-push] PATCH ${config.softr_table_id}/${recordIdToUpdate}`);

      softrResponse = await fetch(
        `${SOFTR_API_BASE}/databases/${SOFTR_DATABASE_ID}/tables/${config.softr_table_id}/records/${recordIdToUpdate}`,
        {
          method: 'PATCH',
          headers: {
            'Softr-Api-Key': SOFTR_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: softrFields })
        }
      );
    } else {
      // CREATE: Neuer Softr-Record
      console.log(`[softr-push] POST ${config.softr_table_id}`);

      softrResponse = await fetch(
        `${SOFTR_API_BASE}/databases/${SOFTR_DATABASE_ID}/tables/${config.softr_table_id}/records`,
        {
          method: 'POST',
          headers: {
            'Softr-Api-Key': SOFTR_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: softrFields })
        }
      );
    }

    // 6. Response verarbeiten
    const responseText = await softrResponse.text();

    try {
      softrResult = JSON.parse(responseText);
    } catch {
      softrResult = { raw: responseText };
    }

    if (!softrResponse.ok) {
      console.error(`[softr-push] Softr API Fehler:`, softrResult);

      // Rate Limit?
      if (softrResponse.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Rate limit exceeded',
            retry_after: softrResponse.headers.get('Retry-After') || 60
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: softrResult.message || 'Softr API error',
          details: softrResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: softrResponse.status }
      );
    }

    // 7. Bei neuem Record: softr_record_id in Supabase speichern
    if (!softr_record_id && !record.softr_record_id && softrResult.recordId) {
      await supabase
        .from(table)
        .update({
          softr_record_id: softrResult.recordId,
          sync_source: 'supabase' // Markieren als von Supabase erstellt
        })
        .eq('id', record_id);

      console.log(`[softr-push] Softr Record ID gespeichert: ${softrResult.recordId}`);
    }

    // 8. Sync-Log aktualisieren (Batch-Format)
    await supabase
      .from('softr_sync_log')
      .insert({
        sync_type: 'trigger',
        direction: 'push',
        table_name: table,
        records_processed: 1,
        records_created: operation === 'INSERT' ? 1 : 0,
        records_updated: operation === 'UPDATE' ? 1 : 0,
        records_failed: 0,
        details: {
          record_id: record_id,
          softr_record_id: softr_record_id || record.softr_record_id || softrResult.recordId,
          fields_synced: Object.keys(softrFields).length
        },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });

    const durationMs = Date.now() - startTime;
    console.log(`[softr-push] Erfolgreich in ${durationMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        operation: operation,
        table: table,
        record_id: record_id,
        softr_record_id: softr_record_id || record.softr_record_id || softrResult.recordId,
        fields_synced: Object.keys(softrFields).length,
        duration_ms: durationMs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[softr-push] Fehler:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
