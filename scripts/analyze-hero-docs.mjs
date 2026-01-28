// Analyse der Hero Dokumente im Bereich offset 450-600
const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_TOKEN = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

async function main() {
  const query = `{ customer_documents(first: 150, offset: 450) { nr date file_upload { filename temporary_url } } }`;

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

  console.log('═══ Hero Dokument-Analyse (offset 450-600) ═══\n');
  console.log('Total Dokumente:', docs.length);

  const dates = docs.map(x => x.date).filter(Boolean);
  console.log('Mit Datum:', dates.length);

  const sorted = [...dates].sort();
  console.log('Datum-Range:', sorted[0], 'bis', sorted[sorted.length - 1]);

  const with2025 = docs.filter(x => x.date >= '2025-01-01');
  console.log('Mit date >= 2025-01-01:', with2025.length);

  const withUrl = docs.filter(x => x.file_upload?.temporary_url);
  console.log('Mit temporary_url:', withUrl.length);

  const both = with2025.filter(x => x.file_upload?.temporary_url);
  console.log('Beides (Filter-Match):', both.length);

  if (both.length > 0) {
    console.log('\nErste 5 passende Dokumente:');
    both.slice(0, 5).forEach(d => {
      console.log(`  - ${d.nr || 'ohne-nr'}: ${d.date} - ${d.file_upload.filename}`);
    });
  }

  // Zeige auch Datum-Verteilung
  const years = {};
  dates.forEach(d => {
    const year = d.substring(0, 4);
    years[year] = (years[year] || 0) + 1;
  });
  console.log('\nDatum-Verteilung nach Jahr:', years);
}

main().catch(console.error);
