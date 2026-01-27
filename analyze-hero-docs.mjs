import fs from 'fs';

const heroPath = 'C:\\Users\\holge\\.claude\\projects\\C--Users-holge-neurealis-erp\\c9aa9245-9e28-44f3-b25b-417cd33cd9ad\\tool-results\\toolu_012KFXXi9uULow2K1QFhKsqr.txt';
const heroData = JSON.parse(fs.readFileSync(heroPath, 'utf8'));
const docs = heroData.data.customer_documents;

// Filter for 2025
const docs2025 = docs.filter(d => d.date && d.date >= '2025-01-01');

// Kategorisiere nach Dokumenttyp
const statsANG = docs2025.filter(d => d.nr.startsWith('ANG-'));
const statsAB = docs2025.filter(d => d.nr.startsWith('AB-'));
const statsNUA = docs2025.filter(d => d.nr.startsWith('NUA-'));
const statsRE = docs2025.filter(d => d.nr.startsWith('RE-'));
const statsOTHER = docs2025.filter(d => {
  return d.nr &&
    !d.nr.startsWith('ANG-') &&
    !d.nr.startsWith('AB-') &&
    !d.nr.startsWith('NUA-') &&
    !d.nr.startsWith('RE-');
});

console.log('=== HERO DOKUMENTE AB 2025 ===');
console.log('Gesamt ab 2025:', docs2025.length);
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
console.log('');
console.log('ANDERE:', statsOTHER.length);
statsOTHER.forEach(d => console.log('  -', d.nr || '(leer)', '|', d.type, '|', d.date));

// Export for comparison
console.log('\n=== HERO DOC NRS (ab 2025) ===');
const heroNrs = {
  ANG: statsANG.map(d => d.nr),
  AB: statsAB.map(d => d.nr),
  NUA: statsNUA.map(d => d.nr),
  RE: statsRE.map(d => d.nr)
};
console.log(JSON.stringify(heroNrs, null, 2));
