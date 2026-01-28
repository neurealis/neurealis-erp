// Wiederherstellung der Beträge aus Softr nach Supabase
// Führt UPDATE nur aus wenn Softr echte Werte hat und Supabase 0/NULL

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'kNjsEhYYcNjAsj';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NjAxNjgsImV4cCI6MjA2MTIzNjE2OH0.lPq9LY_J9h9MUTx44N8wxJNsjr_6qhOGJRmF8JgKLes';

// Softr Felder
const SOFTR_FIELDS = {
  DOKUMENT_NR: '8Ae7U',
  BETRAG_NETTO: 'QuHkO',
  BETRAG_BRUTTO: 'kukJI',
  BETRAG_BEZAHLT: 'vVD6w',
  BETRAG_OFFEN: 'ptIjX'
};

async function fetchAllSoftrRecords() {
  let allRecords = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://tables-api.softr.io/api/v1/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_TABLE_ID}/records?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Softr-Api-Key': SOFTR_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    const records = data.data || [];
    allRecords = allRecords.concat(records);

    if (records.length < limit) break;
    offset += limit;
  }

  return allRecords;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== WIEDERHERSTELLUNG DER BETRÄGE AUS SOFTR ===\n');
  console.log(`Modus: ${dryRun ? 'DRY RUN (keine Änderungen)' : 'LIVE'}\n`);

  // 1. Lade Softr-Daten
  console.log('Lade Softr-Dokumente...');
  const softrRecords = await fetchAllSoftrRecords();
  console.log(`${softrRecords.length} Softr-Dokumente geladen.\n`);

  // Map: dokument_nr -> Softr-Beträge (nur mit echten Werten)
  const softrMap = new Map();
  let withValues = 0;

  softrRecords.forEach(r => {
    const dokNr = r.fields[SOFTR_FIELDS.DOKUMENT_NR];
    if (!dokNr) return;

    const netto = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_NETTO]) || null;
    const brutto = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BRUTTO]) || null;
    const bezahlt = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_BEZAHLT]) || null;
    const offen = parseFloat(r.fields[SOFTR_FIELDS.BETRAG_OFFEN]) || null;

    // Nur wenn mindestens Netto oder Brutto vorhanden
    if (netto || brutto) {
      softrMap.set(dokNr, { netto, brutto, bezahlt, offen });
      withValues++;
    }
  });

  console.log(`${softrMap.size} Dokumente mit Beträgen in Softr.\n`);

  // 2. Lade ALLE Supabase-Dokumente und filtere lokal
  console.log('Lade Supabase-Dokumente...');

  let allSupabaseDocs = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/dokumente?select=dokument_nr,betrag_netto,betrag_brutto,betrag_bezahlt,betrag_offen&order=dokument_nr&offset=${offset}&limit=${limit}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const docs = await response.json();
    if (!Array.isArray(docs)) {
      console.error('Fehler beim Laden:', docs);
      break;
    }

    allSupabaseDocs = allSupabaseDocs.concat(docs);
    if (docs.length < limit) break;
    offset += limit;
  }

  // Filtere lokal: Netto oder Brutto ist 0/NULL
  const supabaseDocs = allSupabaseDocs.filter(d =>
    (d.betrag_netto === 0 || d.betrag_netto === null) ||
    (d.betrag_brutto === 0 || d.betrag_brutto === null)
  );

  console.log(`${allSupabaseDocs.length} Dokumente in Supabase total.`);
  console.log(`${supabaseDocs.length} Dokumente mit 0/NULL Beträgen.\n`);

  // 3. Finde wiederherstellbare Dokumente
  const toRestore = [];

  for (const doc of supabaseDocs) {
    const softrData = softrMap.get(doc.dokument_nr);
    if (!softrData) continue;

    // Prüfe ob Wiederherstellung sinnvoll
    const needsNetto = (doc.betrag_netto === 0 || doc.betrag_netto === null) && softrData.netto;
    const needsBrutto = (doc.betrag_brutto === 0 || doc.betrag_brutto === null) && softrData.brutto;

    if (needsNetto || needsBrutto) {
      toRestore.push({
        dokument_nr: doc.dokument_nr,
        old: {
          netto: doc.betrag_netto,
          brutto: doc.betrag_brutto,
          bezahlt: doc.betrag_bezahlt,
          offen: doc.betrag_offen
        },
        new: {
          netto: softrData.netto,
          brutto: softrData.brutto,
          bezahlt: softrData.bezahlt,
          offen: softrData.offen
        }
      });
    }
  }

  console.log(`${toRestore.length} Dokumente können wiederhergestellt werden.\n`);

  if (toRestore.length === 0) {
    console.log('Keine Wiederherstellung nötig.');
    return;
  }

  // 4. Statistik
  const byPrefix = {};
  let totalNetto = 0;
  let totalBrutto = 0;

  toRestore.forEach(item => {
    const prefix = item.dokument_nr.split('-')[0] || item.dokument_nr.substring(0, 3);
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    if (item.new.netto) totalNetto += item.new.netto;
    if (item.new.brutto) totalBrutto += item.new.brutto;
  });

  console.log('--- NACH DOKUMENTTYP ---');
  Object.entries(byPrefix).sort((a, b) => b[1] - a[1]).forEach(([prefix, count]) => {
    console.log(`  ${prefix}: ${count}`);
  });

  console.log(`\n--- GESAMTSUMMEN ---`);
  console.log(`  Netto: ${totalNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
  console.log(`  Brutto: ${totalBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €\n`);

  // 5. Beispiele anzeigen
  console.log('--- BEISPIELE (erste 10) ---\n');
  toRestore.slice(0, 10).forEach(item => {
    console.log(`${item.dokument_nr}:`);
    console.log(`  ALT: Netto=${item.old.netto}, Brutto=${item.old.brutto}`);
    console.log(`  NEU: Netto=${item.new.netto}, Brutto=${item.new.brutto}, Bezahlt=${item.new.bezahlt}, Offen=${item.new.offen}`);
    console.log('');
  });

  if (dryRun) {
    console.log('=== DRY RUN - Keine Änderungen vorgenommen ===');
    console.log('Führe mit --execute aus um die Wiederherstellung durchzuführen.');
    return;
  }

  // 6. Wiederherstellung durchführen
  if (!process.argv.includes('--execute')) {
    console.log('=== PREVIEW - Führe mit --execute aus um fortzufahren ===');
    return;
  }

  console.log('=== STARTE WIEDERHERSTELLUNG ===\n');

  let success = 0;
  let errors = 0;

  for (const item of toRestore) {
    try {
      const updateData = {};
      if (item.new.netto !== null) updateData.betrag_netto = item.new.netto;
      if (item.new.brutto !== null) updateData.betrag_brutto = item.new.brutto;
      if (item.new.bezahlt !== null) updateData.betrag_bezahlt = item.new.bezahlt;
      if (item.new.offen !== null) updateData.betrag_offen = item.new.offen;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/dokumente?dokument_nr=eq.${encodeURIComponent(item.dokument_nr)}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (response.ok) {
        success++;
        if (success % 50 === 0) {
          console.log(`Fortschritt: ${success}/${toRestore.length}`);
        }
      } else {
        const errorText = await response.text();
        console.error(`Fehler bei ${item.dokument_nr}: ${response.status} - ${errorText}`);
        errors++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 20));

    } catch (err) {
      console.error(`Fehler bei ${item.dokument_nr}:`, err.message);
      errors++;
    }
  }

  console.log(`\n=== WIEDERHERSTELLUNG ABGESCHLOSSEN ===`);
  console.log(`Erfolgreich: ${success}`);
  console.log(`Fehler: ${errors}`);
}

main().catch(console.error);
