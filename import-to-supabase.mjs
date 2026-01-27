/**
 * Import mapped Softr documents to Supabase via REST API
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg';

// Read mapped data
const mapped = JSON.parse(readFileSync('softr_docs_mapped.json', 'utf8'));
console.log(`Lade ${mapped.length} Dokumente...`);

// Batch insert via PostgREST
async function insertBatch(docs) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/softr_dokumente`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Prefer': 'resolution=merge-duplicates'  // Upsert
    },
    body: JSON.stringify(docs)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.status;
}

async function main() {
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);

    try {
      await insertBatch(batch);
      inserted += batch.length;
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${mapped.length}`);
    } catch (err) {
      console.error(`Fehler bei Batch ${Math.floor(i / batchSize) + 1}: ${err.message}`);
      errors += batch.length;
    }
  }

  console.log(`\nFertig: ${inserted} importiert, ${errors} Fehler`);
}

main().catch(console.error);
