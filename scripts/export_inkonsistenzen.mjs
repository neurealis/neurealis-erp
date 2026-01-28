import * as XLSX from 'xlsx';

const SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_TABLE_ID = 'kNjsEhYYcNjAsj';

async function fetchAllRecords() {
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

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.error('Lade alle Softr Dokumente...\n');
  const records = await fetchAllRecords();
  console.error(`${records.length} Dokumente geladen.\n`);

  const startDate = new Date('2025-01-01');

  const rechnungen = records.filter(r => {
    const art = r.fields['6tf0K']?.label || '';
    const isRechnung = art.includes('rechnung') || art.includes('Rechnung') ||
           art.startsWith('AR-') || art.startsWith('ER-');
    if (!isRechnung) return false;

    const datumStr = r.fields['DAXGa'] || r.createdAt;
    if (!datumStr) return true;
    const datum = new Date(datumStr);
    return datum >= startDate;
  });

  console.error(`${rechnungen.length} Rechnungsdokumente ab 2025 gefunden.\n`);

  const rows = [];

  rechnungen.forEach(r => {
    const dokNr = r.fields['8Ae7U'] || r.id;
    const atbsNr = r.fields['GBc7t'] || '';
    const art = r.fields['6tf0K']?.label || '-';
    const projekt = r.fields['1sWGL'] || '-';
    const datumStr = r.fields['DAXGa'] || '';

    const netto = parseFloat(r.fields['QuHkO']) || 0;
    const brutto = parseFloat(r.fields['kukJI']) || 0;
    const bezahlt = parseFloat(r.fields['vVD6w']) || 0;
    const offen = parseFloat(r.fields['ptIjX']) || 0;

    const problems = [];

    // 1. MwSt-Abweichung
    if (netto !== 0 && brutto !== 0) {
      const expectedBrutto19 = round2(netto * 1.19);
      const expectedBrutto7 = round2(netto * 1.07);
      const diff19 = Math.abs(expectedBrutto19 - brutto);
      const diff7 = Math.abs(expectedBrutto7 - brutto);
      const tolerance = Math.max(Math.abs(brutto * 0.01), 2);

      if (diff19 > tolerance && diff7 > tolerance) {
        problems.push({
          typ: 'MwSt-Abweichung',
          kommentar: `Netto(${netto}) × 1.19 = ${expectedBrutto19}, aber Brutto = ${brutto} (Diff: ${round2(diff19)}€)`
        });
      }
    }

    // 2. Brutto - Bezahlt ≠ Offen
    if (brutto !== 0 && bezahlt !== 0) {
      const expectedOffen = round2(brutto - bezahlt);
      if (Math.abs(expectedOffen - offen) > 0.02) {
        problems.push({
          typ: 'Brutto-Bezahlt≠Offen',
          kommentar: `${brutto} - ${bezahlt} = ${expectedOffen}, aber Offen = ${offen}`
        });
      }
    }

    // 3. Überzahlung
    if (bezahlt > 0 && brutto > 0 && bezahlt > brutto + 0.02 && !art.includes('Storno')) {
      problems.push({
        typ: 'Überzahlung',
        kommentar: `Bezahlt(${bezahlt}) > Brutto(${brutto}), Differenz: ${round2(bezahlt - brutto)}€`
      });
    }

    // 4. Negativer offener Betrag
    if (offen < -0.02 && !art.includes('Storno') && !art.includes('Gutschrift')) {
      problems.push({
        typ: 'Negativer-Offen',
        kommentar: `Offener Betrag ist negativ: ${offen}€`
      });
    }

    // 5. Brutto vorhanden, aber Netto fehlt
    if (brutto !== 0 && netto === 0) {
      problems.push({
        typ: 'Brutto-ohne-Netto',
        kommentar: `Brutto(${brutto}) vorhanden, aber Netto fehlt`
      });
    }

    // 6. Netto vorhanden, aber Brutto fehlt
    if (netto !== 0 && brutto === 0) {
      problems.push({
        typ: 'Netto-ohne-Brutto',
        kommentar: `Netto(${netto}) vorhanden, aber Brutto fehlt`
      });
    }

    // 7. Bezahlt vorhanden, aber Brutto fehlt
    if (bezahlt !== 0 && brutto === 0) {
      problems.push({
        typ: 'Bezahlt-ohne-Brutto',
        kommentar: `Bezahlt(${bezahlt}) vorhanden, aber Brutto fehlt`
      });
    }

    // 8. Brutto = 0 aber Offen != 0
    if (brutto === 0 && offen !== 0) {
      problems.push({
        typ: 'Offen-ohne-Brutto',
        kommentar: `Brutto = 0, aber Offen = ${offen}`
      });
    }

    problems.forEach(p => {
      rows.push({
        'ATBS-Nr': atbsNr,
        'Dokument-Nr': dokNr,
        'Dokumenttyp': art,
        'Datum': datumStr,
        'Netto': netto,
        'Brutto': brutto,
        'Bezahlt': bezahlt,
        'Offen': offen,
        'Problem-Typ': p.typ,
        'Kommentar': p.kommentar,
        'Projekt': projekt
      });
    });
  });

  // Sortieren
  rows.sort((a, b) => {
    if (a['Problem-Typ'] !== b['Problem-Typ']) return a['Problem-Typ'].localeCompare(b['Problem-Typ']);
    return (b['Datum'] || '').localeCompare(a['Datum'] || '');
  });

  // Excel erstellen
  const ws = XLSX.utils.json_to_sheet(rows);

  // Spaltenbreiten setzen
  ws['!cols'] = [
    { wch: 12 },  // ATBS-Nr
    { wch: 18 },  // Dokument-Nr
    { wch: 35 },  // Dokumenttyp
    { wch: 12 },  // Datum
    { wch: 12 },  // Netto
    { wch: 12 },  // Brutto
    { wch: 12 },  // Bezahlt
    { wch: 12 },  // Offen
    { wch: 20 },  // Problem-Typ
    { wch: 60 },  // Kommentar
    { wch: 50 },  // Projekt
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inkonsistenzen');

  // Speichern
  const outputPath = './docs/rechnungen_inkonsistenzen_2025.xlsx';
  XLSX.writeFile(wb, outputPath);

  console.log(`\n=== EXCEL-EXPORT ABGESCHLOSSEN ===`);
  console.log(`Datei: ${outputPath}`);
  console.log(`Zeilen: ${rows.length} Probleme`);
  console.log(`\nProbleme nach Typ:`);

  const byType = {};
  rows.forEach(r => {
    byType[r['Problem-Typ']] = (byType[r['Problem-Typ']] || 0) + 1;
  });
  Object.entries(byType).sort((a,b) => b[1] - a[1]).forEach(([typ, count]) => {
    console.log(`  ${count}x ${typ}`);
  });
}

main().catch(console.error);
