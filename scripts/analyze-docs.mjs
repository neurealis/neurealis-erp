import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('C:/Users/holge/neurealis-erp/temp_all_docs.json', 'utf-8'));
const docs = data.data.customer_documents;

console.log('Gesamt Dokumente:', docs.length);

// Filter >= 2025 mit temporary_url
const filtered = docs.filter(d => d.date >= '2025-01-01' && d.file_upload?.temporary_url);
console.log('Dokumente >= 2025 mit URL:', filtered.length);

// Per Type breakdown
const byType = {};
filtered.forEach(d => {
  byType[d.type] = (byType[d.type] || 0) + 1;
});
console.log('\nNach Typ:');
Object.entries(byType).forEach(([type, count]) => console.log(`  ${type}: ${count}`));

// Show indices of 2025 documents
console.log('\nIndizes der 2025-Dokumente (für offset/limit):');
const indices = [];
docs.forEach((d, i) => {
  if (d.date >= '2025-01-01' && d.file_upload?.temporary_url) {
    indices.push(i);
  }
});
console.log('  First:', indices[0], 'Last:', indices[indices.length - 1]);
console.log('  Sample:', indices.slice(0, 10).join(', '));
