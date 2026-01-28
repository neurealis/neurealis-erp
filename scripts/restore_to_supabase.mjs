// Wiederherstellung der Beträge von Softr-Backup nach Supabase via MCP
import * as fs from 'fs';

// Lade Softr-Backup
const softrData = JSON.parse(fs.readFileSync('./docs/softr_amounts_backup.json', 'utf8'));
console.log(`Softr-Backup: ${softrData.length} Dokumente geladen\n`);

// Erstelle Map: dokument_nr -> Softr-Daten
const softrMap = new Map();
softrData.forEach(d => {
  // Nur wenn echte Werte vorhanden
  if (d.betrag_netto || d.betrag_brutto) {
    softrMap.set(d.dokument_nr, d);
  }
});

console.log(`${softrMap.size} Dokumente mit echten Beträgen in Softr\n`);

// Lade Supabase-Dokumente mit fehlenden Beträgen via Supabase REST API
const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NjAxNjgsImV4cCI6MjA2MTIzNjE2OH0.lPq9LY_J9h9MUTx44N8wxJNsjr_6qhOGJRmF8JgKLes';

async function fetchSupabaseDocs() {
  let allDocs = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/dokumente?select=dokument_nr,betrag_netto,betrag_brutto,betrag_bezahlt,betrag_offen&order=dokument_nr&offset=${offset}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const docs = await response.json();
    if (!Array.isArray(docs) || docs.length === 0) break;

    allDocs = allDocs.concat(docs);
    if (docs.length < limit) break;
    offset += limit;
  }

  return allDocs;
}

async function main() {
  console.log('Lade Supabase-Dokumente...');
  const supabaseDocs = await fetchSupabaseDocs();
  console.log(`${supabaseDocs.length} Dokumente in Supabase\n`);

  // Finde Dokumente zum Wiederherstellen
  const toRestore = [];

  for (const supDoc of supabaseDocs) {
    const softrDoc = softrMap.get(supDoc.dokument_nr);
    if (!softrDoc) continue;

    // Prüfe ob Supabase 0/NULL hat aber Softr echte Werte
    const supNetto = parseFloat(supDoc.betrag_netto) || 0;
    const supBrutto = parseFloat(supDoc.betrag_brutto) || 0;
    const softrNetto = softrDoc.betrag_netto || 0;
    const softrBrutto = softrDoc.betrag_brutto || 0;

    const needsNettoRestore = (supNetto === 0) && (softrNetto !== 0);
    const needsBruttoRestore = (supBrutto === 0) && (softrBrutto !== 0);

    if (needsNettoRestore || needsBruttoRestore) {
      toRestore.push({
        dokument_nr: supDoc.dokument_nr,
        supabase: { netto: supNetto, brutto: supBrutto },
        softr: {
          netto: softrNetto,
          brutto: softrBrutto,
          bezahlt: softrDoc.betrag_bezahlt,
          offen: softrDoc.betrag_offen
        }
      });
    }
  }

  console.log(`=== ${toRestore.length} DOKUMENTE ZUR WIEDERHERSTELLUNG ===\n`);

  if (toRestore.length === 0) {
    console.log('Keine Wiederherstellung nötig!');
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

  // Gesamtsummen
  let totalNetto = 0;
  let totalBrutto = 0;
  toRestore.forEach(d => {
    totalNetto += d.softr.netto || 0;
    totalBrutto += d.softr.brutto || 0;
  });

  console.log(`\nGesamtsummen wiederherzustellen:`);
  console.log(`  Netto: ${totalNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
  console.log(`  Brutto: ${totalBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);

  // Beispiele
  console.log('\nBeispiele (erste 15):');
  toRestore.slice(0, 15).forEach(d => {
    console.log(`${d.dokument_nr}:`);
    console.log(`  Supabase: Netto=${d.supabase.netto}, Brutto=${d.supabase.brutto}`);
    console.log(`  Softr:    Netto=${d.softr.netto}, Brutto=${d.softr.brutto}`);
  });

  // Export für MCP-Wiederherstellung
  fs.writeFileSync('./docs/restore_candidates_final.json', JSON.stringify(toRestore, null, 2));
  console.log('\nExportiert: docs/restore_candidates_final.json');

  // Generiere SQL UPDATE Statements
  console.log('\n=== SQL UPDATE STATEMENTS (für MCP) ===\n');

  // Batch-Update für Effizienz
  const sqlStatements = toRestore.map(d => {
    const netto = d.softr.netto !== null ? d.softr.netto : 'NULL';
    const brutto = d.softr.brutto !== null ? d.softr.brutto : 'NULL';
    const bezahlt = d.softr.bezahlt !== null ? d.softr.bezahlt : 'NULL';
    const offen = d.softr.offen !== null ? d.softr.offen : 'NULL';
    return `UPDATE dokumente SET betrag_netto = ${netto}, betrag_brutto = ${brutto}, betrag_bezahlt = ${bezahlt}, betrag_offen = ${offen} WHERE dokument_nr = '${d.dokument_nr.replace(/'/g, "''")}';`;
  });

  // Zeige erste 10
  sqlStatements.slice(0, 10).forEach(s => console.log(s));
  if (sqlStatements.length > 10) {
    console.log(`... und ${sqlStatements.length - 10} weitere`);
  }

  // Speichere alle SQL Statements
  fs.writeFileSync('./docs/restore_sql_statements.sql', sqlStatements.join('\n'));
  console.log('\nAlle SQL Statements: docs/restore_sql_statements.sql');
}

main().catch(console.error);
