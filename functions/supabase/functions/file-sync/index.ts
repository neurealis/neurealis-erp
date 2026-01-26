import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = Deno.env.get('SOFTR_DATABASE_ID') || 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_FILES_PER_RUN = 50;

function cleanFilename(filename: string): string {
  let clean = filename
    .replace(/\u00e4/g, 'ae').replace(/\u00f6/g, 'oe').replace(/\u00fc/g, 'ue').replace(/\u00df/g, 'ss')
    .replace(/\u00c4/g, 'Ae').replace(/\u00d6/g, 'Oe').replace(/\u00dc/g, 'Ue')
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (clean.length > 100) {
    const ext = clean.match(/\.[a-zA-Z0-9]+$/);
    clean = ext ? clean.substring(0, 96 - ext[0].length) + ext[0] : clean.substring(0, 100);
  }
  return clean || 'file_' + Date.now();
}

async function fetchSoftrRecords(tableId: string, offset = 0, limit = 100): Promise<any[]> {
  const res = await fetch(`${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${tableId}/records?offset=${offset}&limit=${limit}`, {
    headers: { 'Softr-Api-Key': SOFTR_API_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Softr API error: ' + res.status);
  const data = await res.json();
  return data.data || [];
}

async function downloadAndUpload(sourceUrl: string, storagePath: string) {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return { success: false, error: 'Download failed: ' + res.status };
    const blob = await res.blob();
    const arr = new Uint8Array(await blob.arrayBuffer());
    const ct = blob.type || 'application/octet-stream';
    const { error } = await supabase.storage.from('softr-files').upload(storagePath, arr, { contentType: ct, upsert: true });
    if (error) return { success: false, error: error.message };
    return { success: true, size: blob.size };
  } catch (e) { return { success: false, error: String(e) }; }
}

async function discoverFiles(config: any, maxRecords = 2000) {
  let found = 0, newEntries = 0, offset = 0;
  while (offset < maxRecords) {
    const records = await fetchSoftrRecords(config.softr_table_id, offset, 100);
    if (!records.length) break;
    for (const record of records) {
      const fieldValue = record.fields?.[config.softr_field_id];
      if (!fieldValue) continue;
      const attachments = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      for (const att of attachments) {
        if (!att?.url) continue;
        found++;
        const { data: existing } = await supabase.from('file_sync_log').select('id').eq('softr_record_id', record.id).eq('softr_field_id', config.softr_field_id).eq('source_url', att.url).single();
        if (!existing) {
          const filename = att.filename ? cleanFilename(att.filename) : cleanFilename(att.url.split('/').pop() || 'file');
          await supabase.from('file_sync_log').insert({
            softr_table_id: config.softr_table_id, softr_table_name: config.softr_table_name,
            softr_record_id: record.id, softr_field_id: config.softr_field_id, softr_field_name: config.softr_field_name,
            source_url: att.url, source_filename: filename, source_size: att.size, source_type: att.type,
            storage_path: `${config.supabase_table_name}/${record.id}/${filename}`, sync_status: 'pending'
          });
          newEntries++;
        }
      }
    }
    offset += records.length;
    if (records.length < 100) break;
  }
  return { found, new_entries: newEntries };
}

async function processPending(limit: number) {
  const { data: pending } = await supabase.from('file_sync_log').select('*').eq('sync_status', 'pending').order('created_at').limit(limit);
  if (!pending?.length) return { processed: 0, synced: 0, errors: 0 };
  let synced = 0, errors = 0;
  for (const f of pending) {
    await supabase.from('file_sync_log').update({ sync_status: 'downloading' }).eq('id', f.id);
    const tbl = f.softr_table_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const path = `${tbl}/${f.softr_record_id}/${cleanFilename(f.source_filename)}`;
    const r = await downloadAndUpload(f.source_url, path);
    if (r.success) {
      await supabase.from('file_sync_log').update({ storage_path: path, source_size: r.size, sync_status: 'synced', first_synced_at: new Date().toISOString(), last_synced_at: new Date().toISOString(), error_message: null }).eq('id', f.id);
      synced++;
    } else {
      await supabase.from('file_sync_log').update({ sync_status: 'error', error_message: r.error, retry_count: (f.retry_count||0)+1 }).eq('id', f.id);
      errors++;
    }
  }
  return { processed: pending.length, synced, errors };
}

async function retryFailed(limit: number) {
  const { data } = await supabase.from('file_sync_log').select('id').eq('sync_status', 'error').not('error_message', 'like', '%404%').lt('retry_count', 3).limit(limit);
  if (!data?.length) return { processed: 0, synced: 0, errors: 0 };
  await supabase.from('file_sync_log').update({ sync_status: 'pending' }).in('id', data.map(x=>x.id));
  return processPending(limit);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'process';
    const limit = parseInt(url.searchParams.get('limit') || String(MAX_FILES_PER_RUN));

    if (mode === 'stats') {
      const { data: stats } = await supabase.rpc('get_file_sync_stats');
      const { data: all } = await supabase.from('file_sync_log').select('sync_status');
      const totals = { pending: all?.filter(x=>x.sync_status==='pending').length||0, synced: all?.filter(x=>x.sync_status==='synced').length||0, error: all?.filter(x=>x.sync_status==='error').length||0 };
      return new Response(JSON.stringify({ success: true, stats, totals }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (mode === 'discover') {
      const { data: configs } = await supabase.from('file_sync_config').select('*').eq('is_active', true);
      let totalFound = 0, totalNew = 0;
      const results: any[] = [];
      for (const c of (configs || [])) {
        const r = await discoverFiles(c);
        totalFound += r.found; totalNew += r.new_entries;
        results.push({ table: c.softr_table_name, field: c.softr_field_name, ...r });
      }
      return new Response(JSON.stringify({ success: true, mode: 'discover', total_found: totalFound, new_entries: totalNew, results }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (mode === 'retry') {
      const r = await retryFailed(limit);
      return new Response(JSON.stringify({ success: true, mode: 'retry', ...r }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (mode === 'process') {
      const r = await processPending(limit);
      return new Response(JSON.stringify({ success: true, mode: 'process', ...r }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Use mode: stats, discover, process, retry' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
