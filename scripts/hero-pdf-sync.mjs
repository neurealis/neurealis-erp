#!/usr/bin/env node
/**
 * Hero PDF Sync - Effizientes Batch-Download und Upload
 * Lädt alle Hero-PDFs und synct sie zu Supabase Storage
 */

const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_KEY = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODkxNzE5MCwiZXhwIjoyMDQ0NDkzMTkwfQ.Ej8x7lMsnflVJqJXfL8shiqUFcqajBgN2Cp0v-w7zqM';
const BUCKET = 'softr-files';

// Stats
let stats = { fetched: 0, downloaded: 0, uploaded: 0, updated: 0, errors: [] };

async function fetchAllHeroDocs() {
  console.log('📥 Hole alle Hero-Dokumente mit PDFs...');
  const allDocs = [];

  for (let offset = 0; offset < 2000; offset += 500) {
    const query = `{
      customer_documents(first: 500, offset: ${offset}) {
        nr
        type
        date
        value
        vat
        metadata { invoice_style }
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

    console.log(`  Offset ${offset}: ${docs.length} Dokumente`);
    if (docs.length < 500) break;
  }

  // Filter: 2025+, mit PDF, gültige Nr
  const filtered = allDocs.filter(d =>
    d.date >= '2025-01-01' &&
    d.file_upload?.temporary_url &&
    d.nr &&
    !d.nr.includes('xxxx')
  );

  stats.fetched = filtered.length;
  console.log(`✅ ${filtered.length} Dokumente mit PDFs gefunden\n`);
  return filtered;
}

async function downloadAndUpload(doc) {
  const { nr, file_upload } = doc;
  const filename = file_upload.filename || `${nr}.pdf`;
  const tempUrl = file_upload.temporary_url;

  try {
    // 1. Download von Hero
    const pdfRes = await fetch(tempUrl);
    if (!pdfRes.ok) throw new Error(`Download failed: ${pdfRes.status}`);
    const pdfBuffer = await pdfRes.arrayBuffer();
    stats.downloaded++;

    // 2. Upload zu Supabase Storage
    const storagePath = `hero-docs/${filename}`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/pdf',
          'x-upsert': 'true'
        },
        body: pdfBuffer
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload failed: ${err}`);
    }
    stats.uploaded++;

    return {
      nr,
      url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`,
      size: pdfBuffer.byteLength
    };

  } catch (err) {
    stats.errors.push(`${nr}: ${err.message}`);
    return null;
  }
}

async function batchUpdateDatabase(updates) {
  console.log(`\n📝 Update ${updates.length} Einträge in softr_dokumente...`);

  // Baue CASE-Statement für Batch-Update
  const cases = updates.map(u =>
    `WHEN '${u.nr}' THEN '${u.url}'`
  ).join('\n    ');

  const nrs = updates.map(u => `'${u.nr}'`).join(', ');

  const sql = `
    UPDATE softr_dokumente
    SET datei_url = CASE dokument_nr
    ${cases}
    END
    WHERE dokument_nr IN (${nrs});
  `;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  // Alternativ: Einzelne Updates wenn RPC nicht existiert
  if (!res.ok) {
    console.log('  RPC nicht verfügbar, nutze Einzel-Updates...');
    for (const u of updates) {
      await fetch(`${SUPABASE_URL}/rest/v1/softr_dokumente?dokument_nr=eq.${encodeURIComponent(u.nr)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ datei_url: u.url })
      });
      stats.updated++;
    }
  } else {
    stats.updated = updates.length;
  }

  console.log(`✅ ${stats.updated} Einträge aktualisiert`);
}

async function main() {
  console.log('🚀 Hero PDF Sync gestartet\n');
  const startTime = Date.now();

  // 1. Alle Dokumente holen
  const docs = await fetchAllHeroDocs();

  // 2. Parallel downloaden und uploaden (10 gleichzeitig)
  console.log('📤 Lade und uploade PDFs (10 parallel)...');
  const updates = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(downloadAndUpload));

    for (const r of results) {
      if (r) updates.push(r);
    }

    // Progress
    const pct = Math.round((i + batch.length) / docs.length * 100);
    process.stdout.write(`\r  ${i + batch.length}/${docs.length} (${pct}%) - ✓${stats.uploaded} ✗${stats.errors.length}`);
  }
  console.log('\n');

  // 3. Datenbank updaten
  if (updates.length > 0) {
    await batchUpdateDatabase(updates);
  }

  // 4. Report
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`
═══════════════════════════════
📊 SYNC ABGESCHLOSSEN
═══════════════════════════════
Dauer:      ${duration}s
Gefunden:   ${stats.fetched}
Downloaded: ${stats.downloaded}
Uploaded:   ${stats.uploaded}
DB Updated: ${stats.updated}
Fehler:     ${stats.errors.length}
═══════════════════════════════
`);

  if (stats.errors.length > 0) {
    console.log('Fehler:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`  ... und ${stats.errors.length - 10} weitere`);
    }
  }
}

main().catch(console.error);
