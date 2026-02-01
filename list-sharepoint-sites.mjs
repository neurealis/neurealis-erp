/**
 * SharePoint Sites - Übersichtliche Auflistung
 *
 * Liest die von der Edge Function abgerufenen Sites und erstellt
 * eine übersichtliche Tabelle mit allen relevanten Informationen.
 */

import { readFileSync, writeFileSync } from 'fs';

// JSON einlesen
const data = JSON.parse(readFileSync('docs/sharepoint_sites.json', 'utf-8'));

console.log('═'.repeat(80));
console.log('  SHAREPOINT SITES - neurealis.de');
console.log('═'.repeat(80));
console.log(`\nGesamt: ${data.totalSites} Sites\n`);

// Formatierte Ausgabe
const siteSummary = [];

data.sites.forEach((site, index) => {
  const totalQuotaGB = site.drives[0]?.quota?.total
    ? (site.drives[0].quota.total / (1024**3)).toFixed(1)
    : 'N/A';
  const usedQuotaGB = site.drives[0]?.quota?.used
    ? (site.drives[0].quota.used / (1024**3)).toFixed(2)
    : 'N/A';
  const usedPercent = site.drives[0]?.quota?.total && site.drives[0]?.quota?.used
    ? ((site.drives[0].quota.used / site.drives[0].quota.total) * 100).toFixed(2)
    : 'N/A';

  siteSummary.push({
    nr: index + 1,
    name: site.name,
    displayName: site.displayName,
    webUrl: site.webUrl,
    id: site.id,
    drives: site.drives.length,
    usedGB: usedQuotaGB,
    usedPercent: usedPercent,
    driveDetails: site.drives.map(d => ({
      name: d.name,
      type: d.driveType,
      webUrl: d.webUrl,
      driveId: d.id,
      usedGB: d.quota?.used ? (d.quota.used / (1024**3)).toFixed(2) : 'N/A'
    }))
  });

  console.log(`${index + 1}. ${site.displayName || site.name}`);
  console.log(`   URL: ${site.webUrl}`);
  console.log(`   ID: ${site.id}`);
  console.log(`   Drives: ${site.drives.length}`);

  site.drives.forEach(drive => {
    const driveUsedGB = drive.quota?.used
      ? (drive.quota.used / (1024**3)).toFixed(2)
      : 'N/A';
    console.log(`     - ${drive.name} (${drive.driveType}): ${driveUsedGB} GB`);
    console.log(`       Drive-ID: ${drive.id}`);
  });

  console.log();
});

// Als übersichtliches JSON speichern
const outputData = {
  generatedAt: new Date().toISOString(),
  totalSites: data.totalSites,
  sites: siteSummary
};

writeFileSync('docs/sharepoint_sites_summary.json', JSON.stringify(outputData, null, 2), 'utf-8');
console.log('═'.repeat(80));
console.log(`\nZusammenfassung gespeichert in: docs/sharepoint_sites_summary.json`);

// Markdown-Dokumentation erstellen
const mdContent = `# SharePoint Sites - neurealis.de

**Generiert:** ${new Date().toISOString()}
**Gesamt:** ${data.totalSites} Sites

## Übersicht

| # | Name | Display Name | Drives | Speichernutzung |
|---|------|--------------|--------|-----------------|
${siteSummary.map(s =>
  `| ${s.nr} | ${s.name} | ${s.displayName || '-'} | ${s.drives} | ${s.usedGB} GB (${s.usedPercent}%) |`
).join('\n')}

## Details

${siteSummary.map(s => `
### ${s.nr}. ${s.displayName || s.name}

- **URL:** ${s.webUrl}
- **Site-ID:** \`${s.id}\`
- **Drives:** ${s.drives}

${s.driveDetails.map(d => `
#### Drive: ${d.name}
- **Typ:** ${d.driveType}
- **URL:** ${d.webUrl}
- **Drive-ID:** \`${d.driveId}\`
- **Genutzt:** ${d.usedGB} GB
`).join('\n')}
`).join('\n---\n')}

## Nutzung in Code

\`\`\`javascript
// Site-ID für Graph API
const siteId = 'neurealisde.sharepoint.com,GUID1,GUID2';

// Drive-ID für Dateizugriff
const driveId = 'b!...';

// Dateien auflisten
const url = \`https://graph.microsoft.com/v1.0/drives/\${driveId}/root/children\`;
\`\`\`
`;

writeFileSync('docs/SHAREPOINT_SITES.md', mdContent, 'utf-8');
console.log(`Dokumentation gespeichert in: docs/SHAREPOINT_SITES.md`);
