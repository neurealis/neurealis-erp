async function checkSchema() {
  // Introspection query für verfügbare Felder
  const query = `
    query {
      __schema {
        queryType {
          fields {
            name
            description
          }
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

  const fields = data.data?.__schema?.queryType?.fields || [];
  console.log('Verfügbare Query-Felder:');
  fields.forEach(f => {
    console.log(`  - ${f.name}: ${f.description || 'keine Beschreibung'}`);
  });
}

checkSchema().catch(console.error);
