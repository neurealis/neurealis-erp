/**
 * Hero Price Sync Script
 * Liest aktuelle Preise aus Hero, vergleicht mit Supabase und pusht Änderungen.
 *
 * Usage:
 *   node scripts/hero_price_sync.js              # Dry-Run
 *   node scripts/hero_price_sync.js --execute    # Live-Push
 */

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg';

// --- Helper: Hero GraphQL call ---
async function heroQuery(query) {
  const resp = await fetch(HERO_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Hero HTTP ${resp.status}: ${text}`);
  }
  const json = await resp.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Hero GraphQL: ${json.errors[0].message}`);
  }
  return json.data;
}

// --- Helper: Supabase REST call ---
async function supabaseQuery(table, select, filters = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;
  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase HTTP ${resp.status}: ${text}`);
  }
  return resp.json();
}

// --- Step 1: Read Hero price for a product_id ---
async function readHeroPrice(heroProductId) {
  // Hero API benoetigt product_ids (Plural, als Array)
  const query = `query { supply_product_versions(product_ids: ["${heroProductId}"]) { product_id nr base_price list_price base_data { name unit_type } } }`;
  try {
    const data = await heroQuery(query);
    const versions = data.supply_product_versions;
    if (versions && versions.length > 0) {
      return { found: true, type: 'product_version', data: versions[0] };
    }
    return { found: false };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

// --- Step 2: Update Hero price ---
async function updateHeroPrice(heroProductId, bezeichnung, ekPreis, vkPreis) {
  // base_data mit name ist PFLICHT bei update_supply_product_version
  const basePriceVal = parseFloat(ekPreis) || 0;
  const listPriceVal = parseFloat(vkPreis) || 0;
  const safeName = bezeichnung.replace(/"/g, '\\"').replace(/\n/g, ' ');

  const mutation = `mutation { update_supply_product_version(supply_product_version: { product_id: "${heroProductId}", base_price: ${basePriceVal}, list_price: ${listPriceVal}, base_data: { name: "${safeName}" } }) { product_id nr base_price list_price } }`;

  try {
    const data = await heroQuery(mutation);
    if (data.update_supply_product_version) {
      return { success: true, data: data.update_supply_product_version };
    }
    return { success: false, error: 'Kein Ergebnis' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Preisvergleich mit Toleranz ---
function pricesMatch(a, b) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return Math.abs(numA - numB) < 0.01;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('════════════════════════════════════════════════════');
  console.log('  HERO PRICE SYNC - Supabase → Hero');
  console.log('════════════════════════════════════════════════════');
  console.log(`Modus: ${dryRun ? 'DRY-RUN (keine Aenderungen)' : 'LIVE PUSH'}`);
  console.log(`Datum: ${new Date().toISOString()}`);
  console.log('');

  // 1. Lade alle GWS-Positionen mit hero_product_id aus Supabase
  console.log('[1/3] Lade Positionen aus Supabase...');
  const positions = await supabaseQuery(
    'lv_positionen',
    'artikelnummer,bezeichnung,preis,listenpreis,hero_product_id',
    '&lv_typ=eq.GWS&aktiv=eq.true&hero_product_id=not.is.null&order=artikelnummer'
  );
  console.log(`     ${positions.length} Positionen mit hero_product_id geladen`);
  console.log('');

  // 2. Fuer jede Position: Hero-Preis lesen
  console.log('[2/3] Lese aktuelle Hero-Preise...');
  const results = [];
  let heroFound = 0;
  let heroNotFound = 0;
  let heroErrors = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    process.stdout.write(`\r     ${i + 1}/${positions.length}: ${pos.artikelnummer}...`);

    const heroResult = await readHeroPrice(pos.hero_product_id);

    if (heroResult.found) {
      heroFound++;
      results.push({
        artikelnummer: pos.artikelnummer,
        bezeichnung: pos.bezeichnung,
        hero_product_id: pos.hero_product_id,
        supabase_ek: parseFloat(pos.preis) || 0,
        supabase_vk: parseFloat(pos.listenpreis) || 0,
        hero_ek: parseFloat(heroResult.data.base_price) || 0,
        hero_vk: parseFloat(heroResult.data.list_price) || 0,
        hero_name: heroResult.data.base_data?.name || '',
        status: 'found'
      });
    } else {
      if (heroResult.error) {
        heroErrors++;
        results.push({
          artikelnummer: pos.artikelnummer,
          bezeichnung: pos.bezeichnung,
          hero_product_id: pos.hero_product_id,
          supabase_ek: parseFloat(pos.preis) || 0,
          supabase_vk: parseFloat(pos.listenpreis) || 0,
          hero_ek: null,
          hero_vk: null,
          status: 'error',
          error: heroResult.error
        });
      } else {
        heroNotFound++;
        results.push({
          artikelnummer: pos.artikelnummer,
          bezeichnung: pos.bezeichnung,
          hero_product_id: pos.hero_product_id,
          supabase_ek: parseFloat(pos.preis) || 0,
          supabase_vk: parseFloat(pos.listenpreis) || 0,
          hero_ek: null,
          hero_vk: null,
          status: 'not_found'
        });
      }
    }

    // Rate limiting: 200ms zwischen Requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\r     Ergebnis: ${heroFound} gefunden, ${heroNotFound} nicht gefunden, ${heroErrors} Fehler`);
  console.log('');

  // 3. Vergleiche und update
  console.log('[3/3] Vergleiche Preise und pushe Aenderungen...');
  console.log('');

  const changes = [];
  const alreadyCorrect = [];
  const errors = [];
  const notFoundItems = [];

  for (const item of results) {
    if (item.status === 'not_found') {
      notFoundItems.push(item);
      continue;
    }
    if (item.status === 'error') {
      errors.push(item);
      continue;
    }

    const ekMatch = pricesMatch(item.supabase_ek, item.hero_ek);
    const vkMatch = pricesMatch(item.supabase_vk, item.hero_vk);

    if (ekMatch && vkMatch) {
      alreadyCorrect.push(item);
      continue;
    }

    // Preise weichen ab - updaten
    const change = {
      artikelnummer: item.artikelnummer,
      bezeichnung: item.bezeichnung,
      hero_product_id: item.hero_product_id,
      hero_ek_alt: item.hero_ek,
      hero_vk_alt: item.hero_vk,
      hero_ek_neu: item.supabase_ek,
      hero_vk_neu: item.supabase_vk,
      delta_ek: item.supabase_ek - item.hero_ek,
      delta_vk: item.supabase_vk - item.hero_vk
    };

    if (dryRun) {
      change.status = 'dry-run';
      console.log(`  [DRY] ${item.artikelnummer}: EK ${item.hero_ek.toFixed(2)} -> ${item.supabase_ek.toFixed(2)} | VK ${item.hero_vk.toFixed(2)} -> ${item.supabase_vk.toFixed(2)}`);
    } else {
      process.stdout.write(`  [PUSH] ${item.artikelnummer}...`);
      const updateResult = await updateHeroPrice(
        item.hero_product_id,
        item.bezeichnung,
        item.supabase_ek,
        item.supabase_vk
      );

      if (updateResult.success) {
        change.status = 'updated';
        console.log(' OK');
      } else {
        change.status = 'error';
        change.error = updateResult.error;
        console.log(` FEHLER: ${updateResult.error}`);
        errors.push({ ...item, error: updateResult.error });
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    changes.push(change);
  }

  // Zusammenfassung
  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log('  ZUSAMMENFASSUNG');
  console.log('════════════════════════════════════════════════════');
  console.log(`Positionen mit hero_product_id:  ${positions.length}`);
  console.log(`In Hero gefunden:                ${heroFound}`);
  console.log(`Nicht in Hero gefunden:          ${heroNotFound}`);
  console.log(`Preisaenderungen:                ${changes.length}`);
  console.log(`Bereits korrekt:                 ${alreadyCorrect.length}`);
  console.log(`Fehler:                          ${errors.length}`);
  console.log('');

  if (changes.length > 0) {
    console.log('--- Aenderungen ---');
    console.log('Artikelnr'.padEnd(30) + 'Bezeichnung'.padEnd(45) + 'Hero EK alt'.padEnd(14) + 'Hero EK neu'.padEnd(14) + 'Hero VK alt'.padEnd(14) + 'Hero VK neu'.padEnd(14));
    console.log('-'.repeat(131));
    for (const c of changes) {
      console.log(
        c.artikelnummer.padEnd(30) +
        c.bezeichnung.substring(0, 43).padEnd(45) +
        (c.hero_ek_alt?.toFixed(2) || '-').padStart(11).padEnd(14) +
        c.hero_ek_neu.toFixed(2).padStart(11).padEnd(14) +
        (c.hero_vk_alt?.toFixed(2) || '-').padStart(11).padEnd(14) +
        c.hero_vk_neu.toFixed(2).padStart(11).padEnd(14)
      );
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log('--- Fehler ---');
    for (const e of errors) {
      console.log(`  ${e.artikelnummer}: ${e.error}`);
    }
  }

  if (notFoundItems.length > 0) {
    console.log('');
    console.log('--- Nicht in Hero gefunden ---');
    for (const nf of notFoundItems) {
      console.log(`  ${nf.artikelnummer} (${nf.hero_product_id})`);
    }
  }

  if (dryRun && changes.length > 0) {
    console.log('');
    console.log('Fuer echten Push: node scripts/hero_price_sync.js --execute');
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
