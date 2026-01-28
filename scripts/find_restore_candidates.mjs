// Finde Dokumente die in Softr Werte haben aber in Supabase nicht
import * as fs from 'fs';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';

// Lade Softr-Daten
const softrData = JSON.parse(fs.readFileSync('./docs/softr_restore_data.json', 'utf8'));
console.log(`Softr: ${softrData.length} Dokumente mit Beträgen geladen\n`);

// Lade Supabase-Daten über Public API
async function fetchSupabaseDocuments() {
  // Hole publishable key aus MCP
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dokumente?select=dokument_nr,betrag_netto,betrag_brutto`,
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NjAxNjgsImV4cCI6MjA2MTIzNjE2OH0.lPq9LY_J9h9MUTx44N8wxJNsjr_6qhOGJRmF8JgKLes',
        'Range': '0-4999'
      }
    }
  );

  if (!response.ok) {
    console.error('Supabase API Fehler:', await response.text());
    return null;
  }

  return await response.json();
}

async function main() {
  // Softr Map
  const softrMap = new Map();
  softrData.forEach(d => {
    softrMap.set(d.dokument_nr, d);
  });

  console.log('Lade Supabase-Dokumente...');
  const supabaseDocs = await fetchSupabaseDocuments();

  if (!supabaseDocs) {
    // Fallback: Erstelle SQL für MCP
    console.log('\n=== FALLBACK: SQL für MCP ===\n');

    // Erstelle Liste der Softr-Dokument-Nummern für SQL IN-Clause
    const dokNrs = softrData.slice(0, 100).map(d => `'${d.dokument_nr.replace(/'/g, "''")}'`).join(',');
    console.log(`SELECT dokument_nr, betrag_netto, betrag_brutto FROM dokumente WHERE dokument_nr IN (${dokNrs.substring(0, 500)}...)`);
    return;
  }

  console.log(`Supabase: ${supabaseDocs.length} Dokumente geladen\n`);

  // Finde Restore-Kandidaten
  const toRestore = [];

  for (const supDoc of supabaseDocs) {
    const softrDoc = softrMap.get(supDoc.dokument_nr);
    if (!softrDoc) continue;

    // Supabase hat 0/NULL, Softr hat echten Wert
    const needsNettoRestore =
      (supDoc.betrag_netto === 0 || supDoc.betrag_netto === null || supDoc.betrag_netto === '0.00') &&
      softrDoc.betrag_netto && softrDoc.betrag_netto !== 0;

    const needsBruttoRestore =
      (supDoc.betrag_brutto === 0 || supDoc.betrag_brutto === null || supDoc.betrag_brutto === '0.00') &&
      softrDoc.betrag_brutto && softrDoc.betrag_brutto !== 0;

    if (needsNettoRestore || needsBruttoRestore) {
      toRestore.push({
        dokument_nr: supDoc.dokument_nr,
        supabase_netto: supDoc.betrag_netto,
        supabase_brutto: supDoc.betrag_brutto,
        softr_netto: softrDoc.betrag_netto,
        softr_brutto: softrDoc.betrag_brutto,
        softr_bezahlt: softrDoc.betrag_bezahlt,
        softr_offen: softrDoc.betrag_offen
      });
    }
  }

  console.log(`=== RESTORE-KANDIDATEN: ${toRestore.length} ===\n`);

  if (toRestore.length === 0) {
    console.log('Keine Wiederherstellung nötig!');
    console.log('Die Supabase-Daten sind bereits konsistent mit Softr.');
    return;
  }

  // Gruppiere nach Prefix
  const byPrefix = {};
  toRestore.forEach(d => {
    const prefix = d.dokument_nr.split('-')[0] || d.dokument_nr.substring(0, 3);
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  });

  console.log('Nach Dokumenttyp:');
  Object.entries(byPrefix).sort((a,b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`  ${p}: ${c}`);
  });

  // Beispiele
  console.log('\nBeispiele (erste 10):');
  toRestore.slice(0, 10).forEach(d => {
    console.log(`${d.dokument_nr}:`);
    console.log(`  Supabase: Netto=${d.supabase_netto}, Brutto=${d.supabase_brutto}`);
    console.log(`  Softr:    Netto=${d.softr_netto}, Brutto=${d.softr_brutto}`);
  });

  // Export für Wiederherstellung
  fs.writeFileSync('./docs/restore_candidates.json', JSON.stringify(toRestore, null, 2));
  console.log('\nExportiert: docs/restore_candidates.json');

  // Erstelle SQL-Update Statements
  console.log('\n=== SQL UPDATE STATEMENTS ===\n');
  toRestore.slice(0, 5).forEach(d => {
    const n = d.softr_netto || 'NULL';
    const b = d.softr_brutto || 'NULL';
    const bez = d.softr_bezahlt || 'NULL';
    const o = d.softr_offen || 'NULL';
    console.log(`UPDATE dokumente SET betrag_netto = ${n}, betrag_brutto = ${b}, betrag_bezahlt = ${bez}, betrag_offen = ${o} WHERE dokument_nr = '${d.dokument_nr}';`);
  });
}

main().catch(console.error);
