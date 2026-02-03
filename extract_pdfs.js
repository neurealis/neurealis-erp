const fs = require('fs');
const path = require('path');

// Zielordner
const TARGET_DIR = 'C:\\Users\\holge\\neurealis GmbH\\Mieter-Service neurealis - Verwaltung\\50 Immoverwaltung Bach\\Mieteingänge';

// JSON-Daten laden
const data = JSON.parse(fs.readFileSync('C:\\Users\\holge\\neurealis-erp\\temp_attachments.json', 'utf-8'));

// Sicherstellen dass Zielordner existiert
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  console.log(`Ordner erstellt: ${TARGET_DIR}`);
}

const savedFiles = [];

// Durch alle E-Mails iterieren
for (const email of data.results) {
  console.log(`\nE-Mail: ${email.subject}`);

  // Durch alle Anhänge iterieren
  for (const attachment of email.attachments) {
    // Nur PDFs speichern
    if (attachment.contentType === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf')) {
      const filePath = path.join(TARGET_DIR, attachment.name);

      // Base64 dekodieren und speichern
      const buffer = Buffer.from(attachment.contentBytes, 'base64');
      fs.writeFileSync(filePath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`  -> ${attachment.name} (${sizeKB} KB)`);

      savedFiles.push({
        name: attachment.name,
        size: buffer.length,
        sizeKB: parseFloat(sizeKB),
        email: email.subject
      });
    }
  }
}

console.log(`\n=== ZUSAMMENFASSUNG ===`);
console.log(`Gespeicherte PDFs: ${savedFiles.length}`);
console.log(`Zielordner: ${TARGET_DIR}\n`);

// Sortierte Liste ausgeben
savedFiles.sort((a, b) => a.name.localeCompare(b.name));
for (const file of savedFiles) {
  console.log(`${file.name} | ${file.sizeKB} KB`);
}

// Gesamtgröße
const totalKB = savedFiles.reduce((sum, f) => sum + f.sizeKB, 0);
console.log(`\nGesamtgröße: ${totalKB.toFixed(1)} KB (${(totalKB/1024).toFixed(2)} MB)`);
