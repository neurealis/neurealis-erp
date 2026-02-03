const fs = require('fs');

async function queryHero() {
  // Hole alle Rechnungen von Hero (ab 2025)
  const query = `
    query {
      invoices(filter: { date: { gte: "2025-01-01" } }, first: 500) {
        edges {
          node {
            id
            number
            date
            value
            project {
              id
              name
              number
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const response = await fetch('https://login.hero-software.de/api/external/v7/graphql', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();

  if (data.errors) {
    console.log('ERRORS:', JSON.stringify(data.errors, null, 2));
    return;
  }

  const invoices = data.data?.invoices?.edges?.map(e => e.node) || [];
  console.log('Hero Rechnungen ab 2025:', invoices.length);

  // Zeige Nummernformat
  console.log('\nNummernformat (erste 20):');
  invoices.slice(0, 20).forEach(inv => {
    console.log(`  ${inv.number} -> Projekt: ${inv.project?.name || 'KEIN PROJEKT'}`);
  });

  // Prüfe ob RE-0015xxx Format vorkommt
  const reFormat = invoices.filter(i => i.number && i.number.startsWith('RE-'));
  console.log('\nMit RE- Präfix:', reFormat.length);

  // Statistik
  const mitProjekt = invoices.filter(i => i.project);
  console.log('Mit Projekt:', mitProjekt.length);
  console.log('Ohne Projekt:', invoices.length - mitProjekt.length);

  // Speichern für weitere Analyse
  fs.writeFileSync('docs/hero_invoices_2025.json', JSON.stringify(invoices, null, 2));
  console.log('\nGespeichert in docs/hero_invoices_2025.json');
}

queryHero().catch(console.error);
