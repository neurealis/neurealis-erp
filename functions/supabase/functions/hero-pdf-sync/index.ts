import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_KEY = Deno.env.get('HERO_API_KEY') || 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface HeroDoc {
  nr: string;
  type: string;
  date: string;
  file_upload?: {
    filename?: string;
    temporary_url?: string;
  };
}

interface SyncResult {
  fetched: number;
  downloaded: number;
  uploaded: number;
  updated: number;
  errors: string[];
  duration_ms: number;
}

async function fetchHeroDocs(): Promise<HeroDoc[]> {
  const allDocs: HeroDoc[] = [];

  for (let offset = 0; offset < 2000; offset += 500) {
    const query = `{
      customer_documents(first: 500, offset: ${offset}) {
        nr
        type
        date
        file_upload { filename temporary_url }
      }
    }`;

    const res = await fetch(HERO_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERO_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    const docs = data.data?.customer_documents || [];
    allDocs.push(...docs);

    if (docs.length < 500) break;
    await new Promise(r => setTimeout(r, 100));
  }

  // Filter: 2025+, mit PDF, gültige Nr
  return allDocs.filter((d: HeroDoc) =>
    d.date >= '2025-01-01' &&
    d.file_upload?.temporary_url &&
    d.nr &&
    !d.nr.includes('xxxx')
  );
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function syncPdf(
  supabase: ReturnType<typeof createClient>,
  doc: HeroDoc
): Promise<{ nr: string; url: string } | null> {
  const { nr, file_upload } = doc;
  if (!file_upload?.temporary_url) return null;

  const rawFilename = file_upload.filename || `${nr}.pdf`;
  const filename = sanitizeFilename(rawFilename);
  const storagePath = `hero-docs/${filename}`;

  try {
    // 1. Download von Hero
    const pdfRes = await fetch(file_upload.temporary_url);
    if (!pdfRes.ok) throw new Error(`Download: ${pdfRes.status}`);
    const pdfBuffer = await pdfRes.arrayBuffer();

    // 2. Upload zu Storage
    const { error: uploadError } = await supabase.storage
      .from('softr-files')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw new Error(`Upload: ${uploadError.message}`);

    // 3. Public URL
    const { data: urlData } = supabase.storage
      .from('softr-files')
      .getPublicUrl(storagePath);

    return { nr, url: urlData.publicUrl };

  } catch (err) {
    throw new Error(`${nr}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '0') || undefined;

  const result: SyncResult = {
    fetched: 0,
    downloaded: 0,
    uploaded: 0,
    updated: 0,
    errors: [],
    duration_ms: 0
  };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Hero Dokumente holen
    console.log('Fetching Hero documents...');
    let docs = await fetchHeroDocs();
    result.fetched = docs.length;

    if (limit) docs = docs.slice(0, limit);

    if (dryRun) {
      result.duration_ms = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        ...result,
        sample: docs.slice(0, 5).map(d => ({ nr: d.nr, filename: d.file_upload?.filename }))
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. PDFs synchen (5 parallel)
    console.log(`Syncing ${docs.length} PDFs...`);
    const updates: { nr: string; url: string }[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(doc => syncPdf(supabase, doc))
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          updates.push(r.value);
          result.downloaded++;
          result.uploaded++;
        } else if (r.status === 'rejected') {
          result.errors.push(r.reason?.message || String(r.reason));
        }
      }

      console.log(`Progress: ${i + batch.length}/${docs.length}`);
    }

    // 3. Datenbank updaten
    console.log(`Updating ${updates.length} database entries...`);
    for (const u of updates) {
      const { error } = await supabase
        .from('dokumente')
        .update({ datei_url: u.url })
        .eq('dokument_nr', u.nr);

      if (!error) result.updated++;
    }

    result.duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      ...result,
      errors: result.errors.slice(0, 20)
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    result.duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: false,
      ...result
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
