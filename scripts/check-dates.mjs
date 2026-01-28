import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('C:/Users/holge/neurealis-erp/temp_docs.json', 'utf-8'));
const docs = data.data.customer_documents;

const dates = docs.map(d => d.date).filter(Boolean).sort();
console.log('Anzahl Dokumente:', docs.length);
console.log('Datum-Range:', dates[0], '-', dates[dates.length-1]);
console.log('Dokumente >= 2025:', docs.filter(d => d.date >= '2025-01-01').length);
console.log('Dokumente ohne Datum:', docs.filter(d => !d.date).length);

// Show some sample dates
console.log('\nSample dates:');
docs.slice(0, 10).forEach(d => console.log(' -', d.date, d.type, d.nr));
