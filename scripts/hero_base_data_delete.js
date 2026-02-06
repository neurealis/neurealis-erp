/**
 * Hero Software: base_data.is_deleted auf true setzen
 *
 * Problem: ALT/DUPLIKAT-Positionen haben is_deleted: true auf Version-Level,
 * aber base_data.is_deleted: false. Die Hero UI zeigt Positionen basierend
 * auf base_data.is_deleted an, daher sind sie noch sichtbar.
 *
 * Lösung: Für alle 623 ALT/DUPLIKAT-Positionen base_data.is_deleted: true setzen.
 *
 * Verwendung: node scripts/hero_base_data_delete.js [--dry-run]
 */

const HERO_API = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_KEY = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';
const BACKUP_FILE = 'docs/backups/2026-02-06_hero_alt_duplikat_backup.json';

const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');

async function heroQuery(query) {
  const resp = await fetch(HERO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HERO_KEY}`
    },
    body: JSON.stringify({ query })
  });
  const data = await resp.json();
  if (data.errors) {
    throw new Error(`Hero API Error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function setBaseDataDeleted(productId, name) {
  const escapedName = name.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const mutation = `mutation {
    update_supply_product_version(supply_product_version: {
      product_id: "${productId}",
      is_deleted: true,
      base_data: {
        name: "${escapedName}",
        is_deleted: true
      }
    }) {
      product_id
      nr
      is_deleted
      base_data { name is_deleted }
    }
  }`;

  return await heroQuery(mutation);
}

async function main() {
  console.log(`\n=== Hero base_data.is_deleted Fix ===`);
  console.log(`Modus: ${isDryRun ? 'DRY-RUN (keine Änderungen)' : 'LIVE'}\n`);

  // Backup laden
  const backupPath = path.resolve(__dirname, '..', BACKUP_FILE);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const positions = backup.positions;

  console.log(`Positionen geladen: ${positions.length}`);

  // Zuerst Stichprobe prüfen: Wie viele haben bereits base_data.is_deleted: true?
  const sampleIds = positions.slice(0, 5).map(p => `"${p.product_id}"`).join(', ');
  const sampleQuery = `{ supply_product_versions(first: 5, product_ids: [${sampleIds}]) { product_id nr is_deleted base_data { name is_deleted } } }`;
  const sampleResult = await heroQuery(sampleQuery);

  const alreadyDeleted = sampleResult.supply_product_versions.filter(v => v.base_data.is_deleted === true).length;
  const needsFix = sampleResult.supply_product_versions.filter(v => v.base_data.is_deleted === false).length;

  console.log(`\nStichprobe (5 Positionen):`);
  console.log(`  base_data.is_deleted = true:  ${alreadyDeleted}`);
  console.log(`  base_data.is_deleted = false: ${needsFix} (müssen gefixt werden)`);

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Würde ${positions.length} Positionen aktualisieren.`);
    console.log(`[DRY-RUN] Keine Änderungen durchgeführt.`);
    return;
  }

  // Alle Positionen updaten
  let success = 0;
  let errors = 0;
  let skipped = 0;
  const errorList = [];

  // In Batches von 10, mit 500ms Pause zwischen Batches
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 500;

  for (let i = 0; i < positions.length; i += BATCH_SIZE) {
    const batch = positions.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (pos) => {
      try {
        const name = pos.base_data?.name || pos.nr;
        await setBaseDataDeleted(pos.product_id, name);
        success++;
        return { success: true };
      } catch (err) {
        errors++;
        errorList.push({ product_id: pos.product_id, nr: pos.nr, error: err.message });
        return { success: false, error: err.message };
      }
    });

    await Promise.all(promises);

    // Fortschritt anzeigen
    const progress = Math.min(i + BATCH_SIZE, positions.length);
    process.stdout.write(`\rFortschritt: ${progress}/${positions.length} (${success} OK, ${errors} Fehler)`);

    // Pause zwischen Batches
    if (i + BATCH_SIZE < positions.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  console.log(`\n\n=== Ergebnis ===`);
  console.log(`Erfolgreich: ${success}`);
  console.log(`Fehler:      ${errors}`);

  if (errorList.length > 0) {
    console.log(`\nFehler-Details:`);
    errorList.forEach(e => console.log(`  ${e.nr}: ${e.error}`));

    // Fehler-Log speichern
    const errorLogPath = path.resolve(__dirname, '..', 'docs/backups/2026-02-06_hero_delete_errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(errorList, null, 2));
    console.log(`\nFehler-Log: ${errorLogPath}`);
  }

  // Verifizierung
  console.log(`\nVerifizierung (Stichprobe)...`);
  const verifyResult = await heroQuery(sampleQuery);
  const allFixed = verifyResult.supply_product_versions.every(v => v.base_data.is_deleted === true);
  console.log(`Stichprobe: ${allFixed ? 'ALLE KORREKT (base_data.is_deleted = true)' : 'FEHLER - Nicht alle gefixt!'}`);
  verifyResult.supply_product_versions.forEach(v => {
    console.log(`  ${v.nr}: base_data.is_deleted = ${v.base_data.is_deleted}`);
  });
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
