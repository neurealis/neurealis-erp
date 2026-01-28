// Vergleiche Softr-Originaldaten mit Supabase um überschriebene Beträge zu finden
import { createClient } from '@supabase/supabase-js';

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'kNjsEhYYcNjAsj';

const supabaseUrl = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Felder in Softr:
// QuHkO = Betrag Netto
// kukJI = Betrag Brutto
// vVD6w = Betrag Bezahlt
// ptIjX = Betrag Offen
// 8Ae7U = Dokument-Nr

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
  console.log('=== ANALYSE: Überschriebene Beträge ===\n');

  // 1. Lade Softr-Daten (Quelle der Wahrheit für alte Einträge)
  console.log('Lade Softr-Dokumente...');
  const softrRecords = await fetchAllSoftrRecords();
  console.log(`${softrRecords.length} Softr-Dokumente geladen.\n`);

  // Map: dokument_nr -> Softr-Beträge
  const softrMap = new Map();
  softrRecords.forEach(r => {
    const dokNr = r.fields['8Ae7U'];
    if (dokNr) {
      softrMap.set(dokNr, {
        netto: parseFloat(r.fields['QuHkO']) || null,
        brutto: parseFloat(r.fields['kukJI']) || null,
        bezahlt: parseFloat(r.fields['vVD6w']) || null,
        offen: parseFloat(r.fields['ptIjX']) || null
      });
    }
  });

  console.log(`${softrMap.size} eindeutige Dokument-Nummern in Softr.\n`);

  // 2. Lade Supabase-Daten
  console.log('Lade Supabase-Dokumente...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: supabaseDocs, error } = await supabase
    .from('dokumente')
    .select('dokument_nr, betrag_netto, betrag_brutto, betrag_bezahlt, betrag_offen, quelle, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Supabase Fehler:', error);
    return;
  }

  console.log(`${supabaseDocs.length} Supabase-Dokumente geladen.\n`);

  // 3. Finde überschriebene Beträge
  const overwrites = [];
  const canRestore = [];
  const cannotRestore = [];

  for (const doc of supabaseDocs) {
    const softrData = softrMap.get(doc.dokument_nr);

    if (!softrData) continue; // Nicht in Softr vorhanden

    // Prüfe ob Supabase 0 hat, aber Softr einen echten Wert
    const nettoOverwritten = (doc.betrag_netto === 0 || doc.betrag_netto === null) && softrData.netto && softrData.netto !== 0;
    const bruttoOverwritten = (doc.betrag_brutto === 0 || doc.betrag_brutto === null) && softrData.brutto && softrData.brutto !== 0;

    if (nettoOverwritten || bruttoOverwritten) {
      const entry = {
        dokument_nr: doc.dokument_nr,
        supabase_netto: doc.betrag_netto,
        supabase_brutto: doc.betrag_brutto,
        softr_netto: softrData.netto,
        softr_brutto: softrData.brutto,
        softr_bezahlt: softrData.bezahlt,
        softr_offen: softrData.offen,
        quelle: doc.quelle,
        updated_at: doc.updated_at
      };

      overwrites.push(entry);

      if (softrData.netto || softrData.brutto) {
        canRestore.push(entry);
      } else {
        cannotRestore.push(entry);
      }
    }
  }

  // 4. Ausgabe
  console.log('=== ERGEBNIS ===\n');
  console.log(`Überschriebene Dokumente gefunden: ${overwrites.length}`);
  console.log(`Davon wiederherstellbar aus Softr: ${canRestore.length}`);
  console.log(`Nicht wiederherstellbar: ${cannotRestore.length}`);

  if (canRestore.length > 0) {
    console.log('\n--- WIEDERHERSTELLBAR (erste 20) ---\n');
    canRestore.slice(0, 20).forEach(e => {
      console.log(`${e.dokument_nr}:`);
      console.log(`  Supabase: Netto=${e.supabase_netto}, Brutto=${e.supabase_brutto}`);
      console.log(`  Softr:    Netto=${e.softr_netto}, Brutto=${e.softr_brutto}, Bezahlt=${e.softr_bezahlt}, Offen=${e.softr_offen}`);
      console.log('');
    });

    // Statistik nach Dokumenttyp
    const byPrefix = {};
    canRestore.forEach(e => {
      const prefix = e.dokument_nr.split('-')[0] || e.dokument_nr.substring(0, 3);
      byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    });

    console.log('\n--- NACH DOKUMENTTYP ---\n');
    Object.entries(byPrefix).sort((a, b) => b[1] - a[1]).forEach(([prefix, count]) => {
      console.log(`${prefix}: ${count}`);
    });

    // Gesamtsumme der verlorenen Beträge
    let totalNetto = 0;
    let totalBrutto = 0;
    canRestore.forEach(e => {
      if (e.softr_netto) totalNetto += e.softr_netto;
      if (e.softr_brutto) totalBrutto += e.softr_brutto;
    });

    console.log('\n--- GESAMTSUMMEN DER FEHLENDEN BETRÄGE ---\n');
    console.log(`Netto gesamt: ${totalNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
    console.log(`Brutto gesamt: ${totalBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
  }

  // 5. Export für Wiederherstellung
  if (canRestore.length > 0) {
    const restoreData = canRestore.map(e => ({
      dokument_nr: e.dokument_nr,
      betrag_netto: e.softr_netto,
      betrag_brutto: e.softr_brutto,
      betrag_bezahlt: e.softr_bezahlt,
      betrag_offen: e.softr_offen
    }));

    const fs = await import('fs');
    fs.writeFileSync('./docs/restore_amounts.json', JSON.stringify(restoreData, null, 2));
    console.log('\n✅ Wiederherstellungs-Daten gespeichert: docs/restore_amounts.json');
  }
}

main().catch(console.error);
