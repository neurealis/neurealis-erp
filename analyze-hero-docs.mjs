import fs from 'fs';

const heroPath = 'C:\\Users\\holge\\.claude\\projects\\C--Users-holge-neurealis-erp\\c9aa9245-9e28-44f3-b25b-417cd33cd9ad\\tool-results\\toolu_012KFXXi9uULow2K1QFhKsqr.txt';
const heroData = JSON.parse(fs.readFileSync(heroPath, 'utf8'));
const docs = heroData.data.customer_documents;

// Alle Dokumente (nicht nur 2025)
const statsANG = docs.filter(d => d.nr && d.nr.startsWith('ANG-'));
const statsAB = docs.filter(d => d.nr && d.nr.startsWith('AB-'));
const statsNUA = docs.filter(d => d.nr && d.nr.startsWith('NUA-'));
const statsRE = docs.filter(d => d.nr && d.nr.startsWith('RE-'));

console.log('=== ALLE HERO DOKUMENTE ===');
console.log('Gesamt:', docs.length);
console.log('');
console.log('ANG (Angebote):', statsANG.length);
statsANG.forEach(d => console.log('  -', d.nr, '|', d.date, '| Netto:', d.value));
console.log('');
console.log('AB (Auftragsbestaetigung):', statsAB.length);
statsAB.forEach(d => console.log('  -', d.nr, '|', d.date, '| Netto:', d.value));
console.log('');
console.log('NUA (Nachtragsangebote):', statsNUA.length);
statsNUA.forEach(d => console.log('  -', d.nr, '|', d.date, '| Netto:', d.value));
console.log('');
console.log('RE (Rechnungen):', statsRE.length);
statsRE.forEach(d => console.log('  -', d.nr, '|', d.date, '| Netto:', d.value, '| Typ:', d.type));

// Export all nrs for comparison
console.log('\n=== HERO DOC NRS (ALLE) ===');
const heroNrs = {
  ANG: statsANG.map(d => d.nr).filter(nr => !nr.includes('xxxx')),
  AB: statsAB.map(d => d.nr).filter(nr => !nr.includes('xxxx')),
  NUA: statsNUA.map(d => d.nr).filter(nr => !nr.includes('xxxx')),
  RE: statsRE.map(d => d.nr).filter(nr => !nr.includes('xxxx'))
};
console.log(JSON.stringify(heroNrs, null, 2));
