#!/usr/bin/env node
/**
 * Hero PDF Upload Script
 * Lädt Hero-Dokumente (offset 150-300) und lädt sie in Supabase Storage hoch
 */

const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_TOKEN = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';
const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODkxNzE5MCwiZXhwIjoyMDQ0NDkzMTkwfQ.Ej8x7lMsnflVJqJXfL8shiqUFcqajBgN2Cp0v-w7zqM';
const STORAGE_BUCKET = 'softr-files';
const STORAGE_PATH = 'hero-docs';

async function fetchHeroDocuments() {
  // 2025-Dokumente liegen ab Index 729, wir holen 350 Stück ab offset 700
  const query = `{ customer_documents(first: 350, offset: 700) { nr type date file_upload { filename temporary_url } } }`;

  const response = await fetch(HERO_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  return data.data.customer_documents;
}

async function downloadPDF(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  return await response.arrayBuffer();
}

async function uploadToStorage(filename, data) {
  const path = `${STORAGE_PATH}/${filename}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true'
    },
    body: data
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

async function updateSoftrDokumente(nr, dateiUrl) {
  if (!nr) return false;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/softr_dokumente?dokument_nr=eq.${encodeURIComponent(nr)}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ datei_url: dateiUrl })
  });

  return response.ok;
}

async function main() {
  console.log('Hero PDF Upload Script gestartet...\n');

  // 1. Dokumente von Hero laden
  console.log('1. Lade Dokumente von Hero API (offset 700-1050)...');
  const documents = await fetchHeroDocuments();
  console.log(`   ${documents.length} Dokumente geladen\n`);

  // 2. Filtern: nur Dokumente mit file_upload.temporary_url und date >= 2025-01-01
  const filtered = documents.filter(doc => {
    if (!doc.file_upload?.temporary_url) return false;
    if (!doc.date) return false;
    return doc.date >= '2025-01-01';
  });

  console.log(`2. Filter: date >= 2025-01-01 und temporary_url vorhanden`);
  console.log(`   ${filtered.length} Dokumente nach Filter\n`);

  // 3. Verarbeitung
  const results = {
    uploaded: 0,
    updated: 0,
    errors: []
  };

  console.log('3. Verarbeite Dokumente...\n');

  for (const doc of filtered) {
    const filename = doc.file_upload.filename;
    const safeFilename = filename.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]/g, '_');

    try {
      // Download
      process.stdout.write(`   [${doc.nr || 'ohne-nr'}] ${filename.substring(0, 50)}... `);
      const pdfData = await downloadPDF(doc.file_upload.temporary_url);

      // Upload
      const publicUrl = await uploadToStorage(safeFilename, pdfData);
      results.uploaded++;

      // Update DB
      if (doc.nr) {
        const updated = await updateSoftrDokumente(doc.nr, publicUrl);
        if (updated) results.updated++;
      }

      console.log('OK');
    } catch (error) {
      console.log(`FEHLER: ${error.message}`);
      results.errors.push({ nr: doc.nr, filename, error: error.message });
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // 4. Report
  console.log('\n════════════════════════════════════════');
  console.log('ERGEBNIS');
  console.log('════════════════════════════════════════');
  console.log(`Dokumente gefunden:    ${documents.length}`);
  console.log(`Nach Filter (>=2025):  ${filtered.length}`);
  console.log(`Erfolgreich hochgeladen: ${results.uploaded}`);
  console.log(`DB-Updates:            ${results.updated}`);
  console.log(`Fehler:                ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nFehler-Details:');
    results.errors.forEach(e => {
      console.log(`  - ${e.nr || 'ohne-nr'}: ${e.error}`);
    });
  }
}

main().catch(console.error);
