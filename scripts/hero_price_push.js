/**
 * Hero Price Push Script
 * Pusht aktualisierte GWS-Preise von Supabase nach Hero
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateHeroProduct(productId, artikelnummer, bezeichnung, preis, listenpreis) {
  const mutation = `
    mutation UpdateProduct($productId: String!, $name: String!, $basePrice: Float!, $listPrice: Float) {
      update_supply_product_version(supply_product_version: {
        product_id: $productId,
        base_data: { name: $name },
        base_price: $basePrice,
        list_price: $listPrice
      }) {
        product_id
        nr
        base_price
        list_price
      }
    }
  `;

  const variables = {
    productId: productId,
    name: bezeichnung,
    basePrice: preis || 0,
    listPrice: listenpreis || null
  };

  try {
    const response = await fetch(HERO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return { success: false, error: result.errors[0].message };
    }

    return {
      success: !!result.data?.update_supply_product_version,
      data: result.data?.update_supply_product_version
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 999;

  console.log('=== HERO PRICE PUSH ===');
  console.log(`Modus: ${dryRun ? 'DRY-RUN (keine Änderungen)' : '🔴 LIVE PUSH'}`);
  console.log(`Limit: ${limit}`);
  console.log('');

  // 1. Lade Positionen mit preis_datum = 2026-02-02 und hero_product_id
  console.log('Lade Positionen aus Supabase...');
  const { data: positions, error } = await supabase
    .from('lv_positionen')
    .select('id, artikelnummer, bezeichnung, preis, listenpreis, hero_product_id')
    .eq('lv_typ', 'GWS')
    .eq('preis_datum', '2026-02-02')
    .not('hero_product_id', 'is', null)
    .limit(limit);

  if (error) {
    console.error('Supabase Fehler:', error.message);
    process.exit(1);
  }

  console.log(`Gefunden: ${positions.length} Positionen mit hero_product_id`);
  console.log('');

  // 2. Lade Hero-Vergleich für zusätzliche Info
  let heroComparison = [];
  try {
    const compData = fs.readFileSync('C:/Users/holge/neurealis-erp/docs/hero_gws_price_comparison.json', 'utf8');
    heroComparison = JSON.parse(compData).diskrepanzen || [];
  } catch (e) {
    console.log('Hinweis: hero_gws_price_comparison.json nicht gefunden');
  }
  const heroMap = new Map(heroComparison.map(d => [d.artikelnummer, d]));

  // 3. Statistiken sammeln
  const stats = {
    total: positions.length,
    wouldUpdate: 0,
    wouldSkip: 0,
    updated: 0,
    errors: 0,
    totalDelta: 0
  };

  const results = [];

  // 4. Verarbeite jede Position
  console.log('Verarbeite Positionen...');
  console.log('');

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const heroInfo = heroMap.get(pos.artikelnummer);
    const heroVk = heroInfo?.hero_vk || 0;
    const supaVk = pos.listenpreis || 0;
    const delta = supaVk - heroVk;

    // Nur updaten wenn Supabase höher ist
    if (delta <= 0.01) {
      stats.wouldSkip++;
      continue;
    }

    stats.wouldUpdate++;
    stats.totalDelta += delta;

    const line = `${i+1}. ${pos.artikelnummer}: Hero ${heroVk.toFixed(2)}€ → Supabase ${supaVk.toFixed(2)}€ (+${delta.toFixed(2)}€)`;

    if (dryRun) {
      console.log(`[DRY] ${line}`);
      results.push({ artikelnummer: pos.artikelnummer, status: 'dry-run', delta });
    } else {
      process.stdout.write(`[PUSH] ${line}...`);

      const result = await updateHeroProduct(
        pos.hero_product_id,
        pos.artikelnummer,
        pos.bezeichnung,
        pos.preis,
        pos.listenpreis
      );

      if (result.success) {
        console.log(' ✓');
        stats.updated++;
        results.push({ artikelnummer: pos.artikelnummer, status: 'updated', delta });
      } else {
        console.log(` ✗ (${result.error})`);
        stats.errors++;
        results.push({ artikelnummer: pos.artikelnummer, status: 'error', error: result.error });
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 5. Zusammenfassung
  console.log('');
  console.log('=== ZUSAMMENFASSUNG ===');
  console.log(`Total Positionen: ${stats.total}`);
  console.log(`Würden aktualisiert: ${stats.wouldUpdate}`);
  console.log(`Übersprungen (Hero >= Supabase): ${stats.wouldSkip}`);
  console.log(`Gesamte Preisdifferenz: ${stats.totalDelta.toFixed(2)} €`);

  if (!dryRun) {
    console.log('');
    console.log(`✓ Erfolgreich aktualisiert: ${stats.updated}`);
    console.log(`✗ Fehler: ${stats.errors}`);
  }

  // 6. Ergebnis speichern
  const outputFile = `C:/Users/holge/neurealis-erp/docs/hero_push_result_${dryRun ? 'dryrun' : 'live'}_${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'live',
    stats,
    results
  }, null, 2));
  console.log('');
  console.log(`Ergebnis gespeichert: ${outputFile}`);

  if (dryRun) {
    console.log('');
    console.log('💡 Für echten Push: node scripts/hero_price_push.js --execute');
  }
}

main().catch(console.error);
