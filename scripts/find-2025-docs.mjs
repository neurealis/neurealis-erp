// Finde den Offset-Bereich mit 2025er Dokumenten
const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_TOKEN = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

async function checkOffset(offset, size = 50) {
  const query = `{ customer_documents(first: ${size}, offset: ${offset}) { nr date file_upload { temporary_url } } }`;

  const response = await fetch(HERO_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  const docs = data.data.customer_documents;

  if (docs.length === 0) return null;

  const dates = docs.map(x => x.date).filter(Boolean).sort();
  const with2025 = docs.filter(x => x.date >= '2025-01-01');
  const withBoth = with2025.filter(x => x.file_upload?.temporary_url);

  return {
    offset,
    count: docs.length,
    dateRange: dates.length > 0 ? `${dates[0]} - ${dates[dates.length - 1]}` : 'keine',
    count2025: with2025.length,
    countBoth: withBoth.length
  };
}

async function main() {
  console.log('═══ Suche nach 2025er Dokumenten ═══\n');
  console.log('Offset\t\tDokumente\tDatum-Range\t\t\t2025+\tMit URL');
  console.log('─'.repeat(80));

  // Teste verschiedene Offsets
  const offsets = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700];

  for (const offset of offsets) {
    const result = await checkOffset(offset);
    if (!result) {
      console.log(`${offset}\t\tKeine Daten mehr`);
      break;
    }
    console.log(`${result.offset}\t\t${result.count}\t\t${result.dateRange}\t${result.count2025}\t${result.countBoth}`);
  }
}

main().catch(console.error);
