/**
 * GWS Preisvergleich: Hero vs. Supabase
 *
 * Dieses Script:
 * 1. Lädt alle GWS-Produkte aus Hero (GraphQL API)
 * 2. Lädt alle GWS-Positionen aus Supabase (REST API)
 * 3. Vergleicht die Preise und erstellt einen Bericht
 *
 * Output: docs/hero_gws_price_comparison.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Supabase Config
const SUPABASE_URL = 'mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NTEwNjgsImV4cCI6MjA1OTAyNzA2OH0.4D0x68vpg7TthdQVSQpbJa4cV7RPE2S_tWdBjz_sPKY';

// Hero Config
const HERO_ENDPOINT = 'login.hero-software.de';
const HERO_API_KEY = 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

// Helper: HTTP Request
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

// 1. Hero GWS-Produkte laden
async function fetchHeroGWSProducts() {
  console.log('\n1. HERO GWS-PRODUKTE LADEN');
  console.log('==========================');

  const allProducts = [];
  let hasMore = true;
  let offset = 0;
  const batchSize = 500;

  while (hasMore && offset < 5000) {
    process.stdout.write(`   Batch offset ${offset}...`);

    const query = JSON.stringify({
      query: `{ supply_product_versions(first: ${batchSize}, offset: ${offset}) { nr list_price base_price is_deleted base_data { name } } }`
    });

    try {
      const response = await httpRequest({
        hostname: HERO_ENDPOINT,
        path: '/api/external/v7/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HERO_API_KEY}`,
          'Content-Length': Buffer.byteLength(query)
        },
        timeout: 30000
      }, query);

      if (response.errors) {
        console.log(' ERROR:', response.errors[0]?.message);
        break;
      }

      const products = response.data?.supply_product_versions || [];
      allProducts.push(...products);
      console.log(` ${products.length} Produkte`);

      if (products.length < batchSize) hasMore = false;
      else offset += batchSize;

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(' ERROR:', err.message);
      break;
    }
  }

  // Nur GWS, nicht gelöscht
  const gwsProducts = allProducts.filter(p => p.nr && p.nr.startsWith('GWS.') && !p.is_deleted);

  // Als Map mit Artikelnummer als Key
  const heroMap = new Map();
  for (const p of gwsProducts) {
    heroMap.set(p.nr, {
      artikelnummer: p.nr,
      bezeichnung: p.base_data?.name || '',
      hero_ek: p.base_price || 0,
      hero_vk: p.list_price || 0
    });
  }

  console.log(`   → ${allProducts.length} Produkte total, ${heroMap.size} GWS aktiv`);
  return heroMap;
}

// 2. Supabase GWS-Positionen laden
async function fetchSupabaseGWSPositions() {
  console.log('\n2. SUPABASE GWS-POSITIONEN LADEN');
  console.log('=================================');

  const allPositions = [];
  let offset = 0;
  const batchSize = 500;
  let hasMore = true;

  while (hasMore) {
    process.stdout.write(`   Batch offset ${offset}...`);

    try {
      const response = await httpRequest({
        hostname: SUPABASE_URL,
        path: `/rest/v1/lv_positionen?lv_typ=eq.GWS&select=artikelnummer,bezeichnung,preis,listenpreis&offset=${offset}&limit=${batchSize}`,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (Array.isArray(response)) {
        allPositions.push(...response);
        console.log(` ${response.length} Positionen`);

        if (response.length < batchSize) hasMore = false;
        else offset += batchSize;
      } else {
        console.log(' ERROR: Unexpected response');
        break;
      }
    } catch (err) {
      console.log(' ERROR:', err.message);
      break;
    }
  }

  // Als Map mit Artikelnummer als Key
  const supaMap = new Map();
  for (const p of allPositions) {
    supaMap.set(p.artikelnummer, {
      artikelnummer: p.artikelnummer,
      bezeichnung: p.bezeichnung || '',
      supa_ek: p.preis || 0,
      supa_vk: p.listenpreis || 0
    });
  }

  console.log(`   → ${supaMap.size} GWS-Positionen in Supabase`);
  return supaMap;
}

// 3. Preise vergleichen
function comparePreises(heroMap, supaMap) {
  console.log('\n3. PREISVERGLEICH');
  console.log('=================');

  const diskrepanzen = [];
  const nurInHero = [];
  const nurInSupabase = [];
  const identisch = [];

  // Hero-Positionen durchgehen
  for (const [nr, hero] of heroMap) {
    const supa = supaMap.get(nr);

    if (!supa) {
      nurInHero.push({
        artikelnummer: nr,
        bezeichnung: hero.bezeichnung,
        hero_ek: hero.hero_ek,
        hero_vk: hero.hero_vk
      });
      continue;
    }

    // VK vergleichen (listenpreis = VK)
    const deltaVK = hero.hero_vk - supa.supa_vk;
    const deltaEK = hero.hero_ek - supa.supa_ek;

    // Nur signifikante Abweichungen (> 0.01 EUR)
    if (Math.abs(deltaVK) > 0.01 || Math.abs(deltaEK) > 0.01) {
      diskrepanzen.push({
        artikelnummer: nr,
        bezeichnung: hero.bezeichnung,
        hero_ek: hero.hero_ek,
        supa_ek: supa.supa_ek,
        delta_ek: Math.round(deltaEK * 100) / 100,
        hero_vk: hero.hero_vk,
        supa_vk: supa.supa_vk,
        delta_vk: Math.round(deltaVK * 100) / 100,
        hero_hoeher: deltaVK > 0
      });
    } else {
      identisch.push(nr);
    }
  }

  // Positionen nur in Supabase
  for (const [nr, supa] of supaMap) {
    if (!heroMap.has(nr)) {
      nurInSupabase.push({
        artikelnummer: nr,
        bezeichnung: supa.bezeichnung,
        supa_ek: supa.supa_ek,
        supa_vk: supa.supa_vk
      });
    }
  }

  return { diskrepanzen, nurInHero, nurInSupabase, identisch };
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     GWS PREISVERGLEICH: HERO VS. SUPABASE                  ║');
  console.log('║     ' + new Date().toISOString() + '                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Daten laden
    const heroMap = await fetchHeroGWSProducts();
    const supaMap = await fetchSupabaseGWSPositions();

    // Vergleichen
    const { diskrepanzen, nurInHero, nurInSupabase, identisch } = comparePreises(heroMap, supaMap);

    // Sortieren nach größter VK-Abweichung
    diskrepanzen.sort((a, b) => Math.abs(b.delta_vk) - Math.abs(a.delta_vk));

    // Statistik
    const heroHoeher = diskrepanzen.filter(d => d.hero_hoeher).length;
    const supaHoeher = diskrepanzen.length - heroHoeher;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                        ERGEBNIS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Hero GWS-Produkte (aktiv):     ${heroMap.size}`);
    console.log(`   Supabase GWS-Positionen:       ${supaMap.size}`);
    console.log('');
    console.log(`   ✅ Identische Preise:          ${identisch.length}`);
    console.log(`   ⚠️  Diskrepanzen (> 0.01 EUR):  ${diskrepanzen.length}`);
    console.log(`      → Hero höher:               ${heroHoeher}`);
    console.log(`      → Supabase höher:           ${supaHoeher}`);
    console.log('');
    console.log(`   📦 Nur in Hero:                ${nurInHero.length}`);
    console.log(`   📦 Nur in Supabase:            ${nurInSupabase.length}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Top 10 größte Abweichungen
    if (diskrepanzen.length > 0) {
      console.log('\n🔴 TOP 10 GRÖSSTE ABWEICHUNGEN (nach VK):');
      console.log('─────────────────────────────────────────────────────────────────');
      console.log('Artikelnr.           | Bezeichnung                  | Hero VK | Supa VK | Diff');
      console.log('─────────────────────────────────────────────────────────────────');

      for (const d of diskrepanzen.slice(0, 10)) {
        const nr = d.artikelnummer.padEnd(20);
        const bez = (d.bezeichnung || '').substring(0, 28).padEnd(28);
        const heroVK = d.hero_vk.toFixed(2).padStart(7);
        const supaVK = d.supa_vk.toFixed(2).padStart(7);
        const delta = (d.delta_vk > 0 ? '+' : '') + d.delta_vk.toFixed(2);
        console.log(`${nr} | ${bez} | ${heroVK} | ${supaVK} | ${delta}`);
      }
    }

    // JSON speichern
    const result = {
      timestamp: new Date().toISOString(),
      statistik: {
        hero_gws_produkte: heroMap.size,
        supabase_gws_positionen: supaMap.size,
        identisch: identisch.length,
        diskrepanzen: diskrepanzen.length,
        hero_hoeher: heroHoeher,
        supabase_hoeher: supaHoeher,
        nur_in_hero: nurInHero.length,
        nur_in_supabase: nurInSupabase.length
      },
      diskrepanzen,
      nur_in_hero: nurInHero,
      nur_in_supabase: nurInSupabase
    };

    const outputPath = path.join(process.cwd(), 'docs', 'hero_gws_price_comparison.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Vollständiges Ergebnis: ${outputPath}`);

    // Hero-Daten auch separat speichern
    const heroArray = Array.from(heroMap.values());
    fs.writeFileSync(path.join(process.cwd(), 'docs', 'hero_gws_aktiv.json'), JSON.stringify(heroArray, null, 2));
    console.log('✅ Hero GWS-Daten: docs/hero_gws_aktiv.json');

  } catch (err) {
    console.error('\n❌ FEHLER:', err.message);
    process.exit(1);
  }
}

main();
