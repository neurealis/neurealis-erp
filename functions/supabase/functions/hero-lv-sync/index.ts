import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY') || 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Lieferanten die NICHT importiert werden (nur Artikel, keine LV)
const EXCLUDED_OPERATORS = [
  'G.U.T. Glaser',
  'J.W. Zander GmbH & Co. KG'
];

// Artikelnummer-Präfixe die ausgeschlossen werden (bereinigte Duplikate)
const EXCLUDED_NR_PREFIXES = ['DUPLIKAT-', 'ALT-'];

// Mapping: supply_operator.name → lv_typ
const OPERATOR_TO_LV_TYP: Record<string, string> = {
  'Covivio 2024-10': 'covivio',
  'GWS 2025-01': 'GWS',
  'VBW 2025-01': 'VBW',
  'Forte Capital 2025-01': 'Freundlieb Quadrat',
  'Freundlieb Quadrat Immo': 'Freundlieb Quadrat',
  'WBG Lünen': 'WBG Lünen'
};

// Mapping: Artikelnummer-Präfix → lv_typ
const PREFIX_TO_LV_TYP: Record<string, string> = {
  'GWS': 'GWS',
  'covivio': 'covivio',
  'VBW': 'VBW',
  'WBG': 'WBG Lünen',
  'FLQ': 'Freundlieb Quadrat',
  'CV24': 'covivio',
  'LV23': 'GWS'
};

// Neurealis-Präfixe für eigene Positionen
const NEUREALIS_PREFIXES = [
  'Allgemein', 'Anstrich', 'Asbest', 'Asbestsanierung', 'Bad', 'Balkon', 'Boden',
  'Dach', 'Daemmung', 'Dämmung', 'Decke', 'Elektrik', 'Endreinigung', 'Entkernung',
  'Entsorgung', 'Fassade', 'Fenster', 'Fliesen', 'frei', 'freie', 'GästeWC',
  'Geschosszulage', 'Gutschrift', 'Heizkörper', 'Heizung', 'IVT', 'Maler',
  'Montage', 'Neurealis', 'Reinigung', 'Rollo', 'Rückbau', 'Sanitär', 'Schlüter',
  'Sonstiges', 'Tischler', 'Trenner', 'Treppe', 'Tür', 'UP', 'Verleistung', 'Wand'
];

// Gewerk-Keywords für Artikelnummer-Generierung
const GEWERK_KEYWORDS: Record<string, string[]> = {
  'Elektrik': ['elektr', 'steckdose', 'schalter', 'kabel', 'leitung', 'dose', 'lampe', 'licht'],
  'Fenster': ['fenster', 'glas', 'scheibe', 'rahmen'],
  'Tür': ['tür', 'zarge', 'türblatt', 'schloss'],
  'Decke': ['decke', 'deckendurch'],
  'Wand': ['wand', 'trockenbau', 'gipskarton', 'tapete'],
  'Boden': ['boden', 'vinyl', 'parkett', 'laminat', 'estrich', 'fußboden'],
  'Fliesen': ['fliesen', 'keramik'],
  'Bad': ['bad', 'dusch', 'wanne', 'wc', 'waschtisch', 'armatur'],
  'Sanitär': ['sanitär', 'wasser', 'abfluss', 'strang', 'rohr', 'abwasser'],
  'Heizung': ['heiz', 'heizkörper', 'therme', 'wärmepumpe'],
  'Treppe': ['treppe', 'stufe', 'handlauf', 'geländer'],
  'Maler': ['maler', 'anstrich', 'lackier', 'streichen', 'farbe'],
  'Maurer': ['putz', 'mauer', 'verputz', 'beton'],
  'Asbest': ['asbest'],
  'Rückbau': ['rückbau', 'demontage', 'abriss', 'entfernen'],
  'Entsorgung': ['entsorgu', 'container', 'müll'],
  'Reinigung': ['reinig', 'säubern'],
  'Rollo': ['rollo', 'rollladen', 'gurt'],
  'Brandschutz': ['brand', 'feuer'],
  'Dach': ['dach', 'sparren', 'ziegel'],
  'Zulage': ['zulage', 'mehrpreis', 'aufpreis']
};

interface HeroService {
  id: number;
  internal_identifier: string;
  name: string;
  description: string;
  manufacturer: string;
  unit_type: string;
  net_price_per_unit: number;
}

interface HeroProduct {
  product_id: string;
  nr: string;
  internal_identifier: string;
  base_data: { name: string; description?: string; category?: string };
  supply_operator: { name: string } | null;
  base_price: number;
  list_price?: number;
}

interface LvPosition {
  artikelnummer: string;
  bezeichnung: string;
  beschreibung?: string;
  einheit?: string;
  preis?: number;
  listenpreis?: number;
  lv_typ: string;
  gewerk?: string;
}

interface SyncResult {
  hero_services: number;
  hero_products: number;
  supabase_positions: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ============== ARTIKELNUMMER-GENERIERUNG ==============

function determineGewerk(name: string, beschreibung: string = ''): string {
  const text = `${name} ${beschreibung}`.toLowerCase();

  for (const [gewerk, keywords] of Object.entries(GEWERK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return gewerk;
      }
    }
  }

  return 'Sonstiges';
}

function cleanString(s: string): string {
  // Umlaute und Sonderzeichen
  let clean = s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();

  // Nur Wörter > 2 Zeichen, CamelCase
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function generateArtikelnummer(name: string, beschreibung: string = '', existingNr: string = ''): string {
  // Wenn bereits eine gültige Artikelnummer existiert (mit Buchstaben startend), behalten
  if (existingNr && /^[A-Za-z]/.test(existingNr)) {
    return existingNr;
  }

  const gewerk = determineGewerk(name, beschreibung);
  let cleanName = cleanString(name);

  // Max 25 Zeichen für den Namen
  if (cleanName.length > 25) {
    cleanName = cleanName.substring(0, 25);
  }

  // Einzigartig machen bei Duplikaten durch Anhängen von Details aus Beschreibung
  if (beschreibung) {
    const descDetails = beschreibung.match(/\d+(?:mm|cm|m²|kW|qmm)?/g);
    if (descDetails && descDetails.length > 0) {
      const detail = descDetails[0].replace(/[^\w]/g, '');
      if (detail && cleanName.length + detail.length < 35) {
        cleanName = `${cleanName}-${detail}`;
      }
    }
  }

  return `${gewerk}-${cleanName}`;
}

// ============== HERO API ==============

async function fetchWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(HERO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HERO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 502 || response.status === 503) {
        console.log(`Retry ${i + 1}/${retries} after ${response.status}...`);
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }

      throw new Error(`Hero API error: ${response.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function fetchHeroServices(): Promise<HeroService[]> {
  const query = `{
    supply_services(first: 500) {
      id
      internal_identifier
      name
      description
      manufacturer
      unit_type
      net_price_per_unit
    }
  }`;

  const result = await fetchWithRetry(query);
  return result.data?.supply_services || [];
}

async function fetchHeroProducts(): Promise<HeroProduct[]> {
  const allProducts: HeroProduct[] = [];

  for (let offset = 0; offset < 4000; offset += 500) {
    console.log(`Fetching products offset ${offset}...`);

    const query = `{
      supply_product_versions(first: 500, offset: ${offset}) {
        product_id
        nr
        internal_identifier
        base_data { name description category }
        supply_operator { name }
        base_price
        list_price
      }
    }`;

    const result = await fetchWithRetry(query);
    const products = result.data?.supply_product_versions || [];
    allProducts.push(...products);

    if (products.length < 500) break;

    // Rate limiting zwischen Batches
    await new Promise(r => setTimeout(r, 500));
  }

  return allProducts;
}

// ============== HELPER FUNCTIONS ==============

function determineLvTyp(product: HeroProduct): string | null {
  const operatorName = product.supply_operator?.name;
  const artikelNr = product.nr || '';

  // 0. Ausgeschlossene Artikelnummer-Präfixe (bereinigte Duplikate)
  if (EXCLUDED_NR_PREFIXES.some(prefix => artikelNr.startsWith(prefix))) {
    return null;
  }

  // 1. Ausschluss-Liste
  if (operatorName && EXCLUDED_OPERATORS.includes(operatorName)) {
    return null;
  }

  // 2. Bekannter Lieferant
  if (operatorName && OPERATOR_TO_LV_TYP[operatorName]) {
    return OPERATOR_TO_LV_TYP[operatorName];
  }

  // 3. Artikelnummer-Präfix
  for (const [prefix, lvTyp] of Object.entries(PREFIX_TO_LV_TYP)) {
    if (artikelNr.startsWith(prefix)) {
      return lvTyp;
    }
  }

  // 4. Neurealis-Präfixe
  const firstPart = artikelNr.split(/[\.\-_0-9]/)[0];
  if (NEUREALIS_PREFIXES.some(p => firstPart.toLowerCase().startsWith(p.toLowerCase()))) {
    return 'Privat';
  }

  // 5. Buchstaben-Start ohne bekannten Präfix → neurealis
  if (/^[A-Za-z]/.test(artikelNr)) {
    return 'Privat';
  }

  // 6. Numerisch ohne Lieferant → auch importieren als neurealis (mit neuer Artikelnummer)
  if (!operatorName && /^\d/.test(artikelNr)) {
    return 'Privat';
  }

  // 7. Unbekannter Lieferant
  if (operatorName) {
    return operatorName;
  }

  return null;
}

function serviceToLvPosition(service: HeroService): LvPosition {
  const manufacturer = service.manufacturer?.trim() || 'neurealis';

  let lvTyp = 'Privat';
  if (manufacturer.toLowerCase().includes('wbg')) {
    lvTyp = 'WBG Lünen';
  } else if (manufacturer.toLowerCase().includes('covivio')) {
    lvTyp = 'covivio';
  }

  // Artikelnummer generieren wenn leer
  const artikelnummer = service.internal_identifier ||
    generateArtikelnummer(service.name, service.description || '');

  return {
    artikelnummer,
    bezeichnung: service.name,
    beschreibung: service.description || undefined,
    einheit: service.unit_type || undefined,
    preis: service.net_price_per_unit || undefined,
    lv_typ: lvTyp,
    gewerk: 'neurealis'
  };
}

function productToLvPosition(product: HeroProduct, lvTyp: string): LvPosition {
  const isNumeric = /^\d/.test(product.nr || '');
  const needsNewNr = isNumeric && !product.supply_operator;

  // Artikelnummer generieren für numerische ohne Lieferant
  const artikelnummer = needsNewNr
    ? generateArtikelnummer(product.base_data?.name || '', product.base_data?.description || '', product.internal_identifier)
    : (product.nr || product.internal_identifier || `HERO-PRD-${product.product_id}`);

  // Gewerk aus Hero-Kategorie oder Fallback auf determineGewerk
  let gewerk: string | undefined = product.base_data?.category?.trim();
  if (!gewerk && lvTyp === 'Privat') {
    gewerk = 'neurealis';
  } else if (!gewerk) {
    // Fallback: Gewerk aus Name ableiten
    gewerk = determineGewerk(product.base_data?.name || '', product.base_data?.description || '');
  }

  return {
    artikelnummer,
    bezeichnung: product.base_data?.name || '',
    beschreibung: product.base_data?.description || undefined,
    preis: product.base_price || undefined,
    listenpreis: product.list_price || undefined,
    lv_typ: lvTyp,
    gewerk
  };
}

// ============== SUPABASE ==============

async function fetchSupabaseLvPositionen(supabase: any): Promise<Map<string, any>> {
  const positions = new Map<string, any>();

  const { data, error } = await supabase
    .from('lv_positionen')
    .select('id, artikelnummer, bezeichnung, beschreibung, einheit, preis, listenpreis, lv_typ, gewerk, updated_at');

  if (error) {
    throw new Error(`Supabase fetch error: ${error.message}`);
  }

  for (const row of data || []) {
    positions.set(row.artikelnummer, row);
  }

  return positions;
}

async function upsertLvPosition(supabase: any, position: LvPosition): Promise<boolean> {
  const { error } = await supabase
    .from('lv_positionen')
    .upsert({
      artikelnummer: position.artikelnummer,
      bezeichnung: position.bezeichnung,
      beschreibung: position.beschreibung,
      einheit: position.einheit,
      preis: position.preis,
      listenpreis: position.listenpreis,
      lv_typ: position.lv_typ,
      gewerk: position.gewerk,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'artikelnummer'
    });

  if (error) {
    console.error(`Upsert error for ${position.artikelnummer}:`, error.message);
  }

  return !error;
}

// ============== SYNC ==============

async function syncHeroToSupabase(): Promise<SyncResult> {
  const result: SyncResult = {
    hero_services: 0,
    hero_products: 0,
    supabase_positions: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Hole Hero-Daten
    console.log('Fetching Hero services...');
    const services = await fetchHeroServices();
    result.hero_services = services.length;
    console.log(`Fetched ${services.length} Hero services`);

    await new Promise(r => setTimeout(r, 1000));

    console.log('Fetching Hero products...');
    const products = await fetchHeroProducts();
    result.hero_products = products.length;
    console.log(`Fetched ${products.length} Hero products`);

    // 2. Hole Supabase-Daten
    console.log('Fetching Supabase lv_positionen...');
    const existingPositions = await fetchSupabaseLvPositionen(supabase);
    result.supabase_positions = existingPositions.size;
    console.log(`Found ${existingPositions.size} existing positions in Supabase`);

    // 3. Services → Supabase
    console.log('Syncing services...');
    for (const service of services) {
      try {
        const position = serviceToLvPosition(service);
        const existing = existingPositions.get(position.artikelnummer);

        if (existing) {
          if (existing.bezeichnung !== position.bezeichnung ||
              existing.preis !== position.preis) {
            const success = await upsertLvPosition(supabase, position);
            if (success) result.updated++;
            else result.errors.push(`Update failed: ${position.artikelnummer}`);
          } else {
            result.skipped++;
          }
        } else {
          const success = await upsertLvPosition(supabase, position);
          if (success) {
            result.created++;
            existingPositions.set(position.artikelnummer, position);
          } else {
            result.errors.push(`Create failed: ${position.artikelnummer}`);
          }
        }
      } catch (err) {
        result.errors.push(`Service ${service.id}: ${err}`);
      }
    }

    // 4. Products → Supabase
    console.log('Syncing products...');
    let processedCount = 0;

    for (const product of products) {
      try {
        const lvTyp = determineLvTyp(product);

        if (!lvTyp) {
          result.skipped++;
          continue;
        }

        const position = productToLvPosition(product, lvTyp);

        // Duplikat-Check mit generierter Artikelnummer
        if (existingPositions.has(position.artikelnummer)) {
          const existing = existingPositions.get(position.artikelnummer);
          if (existing.bezeichnung !== position.bezeichnung ||
              existing.preis !== position.preis ||
              existing.listenpreis !== position.listenpreis ||
              existing.lv_typ !== position.lv_typ ||
              existing.gewerk !== position.gewerk) {
            const success = await upsertLvPosition(supabase, position);
            if (success) result.updated++;
            else result.errors.push(`Update failed: ${position.artikelnummer}`);
          } else {
            result.skipped++;
          }
        } else {
          const success = await upsertLvPosition(supabase, position);
          if (success) {
            result.created++;
            existingPositions.set(position.artikelnummer, position);
          } else {
            result.errors.push(`Create failed: ${position.artikelnummer}`);
          }
        }

        processedCount++;

        // Rate limiting
        if (processedCount % 50 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }

      } catch (err) {
        result.errors.push(`Product ${product.product_id}: ${err}`);
      }
    }

  } catch (err) {
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

// ============== BATCH SYNC ==============

async function syncServicesOnly(): Promise<SyncResult> {
  const result: SyncResult = {
    hero_services: 0,
    hero_products: 0,
    supabase_positions: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('Fetching Hero services...');
    const services = await fetchHeroServices();
    result.hero_services = services.length;

    console.log('Fetching existing Supabase positions...');
    const existingPositions = await fetchSupabaseLvPositionen(supabase);
    result.supabase_positions = existingPositions.size;

    console.log(`Syncing ${services.length} services...`);
    for (const service of services) {
      try {
        const position = serviceToLvPosition(service);
        const existing = existingPositions.get(position.artikelnummer);

        if (existing) {
          if (existing.bezeichnung !== position.bezeichnung || existing.preis !== position.preis) {
            const success = await upsertLvPosition(supabase, position);
            if (success) result.updated++;
            else result.errors.push(`Update failed: ${position.artikelnummer}`);
          } else {
            result.skipped++;
          }
        } else {
          const success = await upsertLvPosition(supabase, position);
          if (success) result.created++;
          else result.errors.push(`Create failed: ${position.artikelnummer}`);
        }
      } catch (err) {
        result.errors.push(`Service ${service.id}: ${err}`);
      }
    }
  } catch (err) {
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

async function syncProductsBatch(offset: number, limit: number): Promise<SyncResult> {
  const result: SyncResult = {
    hero_services: 0,
    hero_products: 0,
    supabase_positions: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log(`Fetching products offset=${offset}, limit=${limit}...`);
    const query = `{
      supply_product_versions(first: ${limit}, offset: ${offset}) {
        product_id
        nr
        internal_identifier
        base_data { name description category }
        supply_operator { name }
        base_price
        list_price
      }
    }`;

    const apiResult = await fetchWithRetry(query);
    const products = apiResult.data?.supply_product_versions || [];
    result.hero_products = products.length;

    console.log('Fetching existing Supabase positions...');
    const existingPositions = await fetchSupabaseLvPositionen(supabase);
    result.supabase_positions = existingPositions.size;

    console.log(`Processing ${products.length} products...`);
    for (const product of products) {
      try {
        const lvTyp = determineLvTyp(product);
        if (!lvTyp) {
          result.skipped++;
          continue;
        }

        const position = productToLvPosition(product, lvTyp);

        if (existingPositions.has(position.artikelnummer)) {
          const existing = existingPositions.get(position.artikelnummer);
          if (existing.bezeichnung !== position.bezeichnung ||
              existing.preis !== position.preis ||
              existing.listenpreis !== position.listenpreis ||
              existing.lv_typ !== position.lv_typ ||
              existing.gewerk !== position.gewerk) {
            const success = await upsertLvPosition(supabase, position);
            if (success) result.updated++;
            else result.errors.push(`Update failed: ${position.artikelnummer}`);
          } else {
            result.skipped++;
          }
        } else {
          const success = await upsertLvPosition(supabase, position);
          if (success) {
            result.created++;
            existingPositions.set(position.artikelnummer, position);
          } else {
            result.errors.push(`Create failed: ${position.artikelnummer}`);
          }
        }
      } catch (err) {
        result.errors.push(`Product ${product.product_id}: ${err}`);
      }
    }
  } catch (err) {
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const syncType = url.searchParams.get('type') || 'all';
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '500');
    const dryRun = url.searchParams.get('dry_run') === 'true';

    console.log(`Hero LV Sync started (type: ${syncType}, offset: ${offset}, limit: ${limit}, dry_run: ${dryRun})`);
    const startTime = Date.now();

    // Services only
    if (syncType === 'services') {
      const result = await syncServicesOnly();
      return new Response(JSON.stringify({
        success: result.errors.length === 0 || result.created > 0 || result.updated > 0,
        type: 'services',
        ...result,
        duration_ms: Date.now() - startTime
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Products batch
    if (syncType === 'products') {
      const result = await syncProductsBatch(offset, limit);
      return new Response(JSON.stringify({
        success: result.errors.length === 0 || result.created > 0 || result.updated > 0,
        type: 'products',
        offset,
        limit,
        has_more: result.hero_products === limit,
        ...result,
        duration_ms: Date.now() - startTime
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Dry run
    if (dryRun) {
      const services = await fetchHeroServices();
      await new Promise(r => setTimeout(r, 500));
      const products = await fetchHeroProducts();

      let wouldImport = services.length;
      let wouldSkip = 0;
      const byLvTyp: Record<string, number> = { 'Privat (Services)': services.length };

      for (const product of products) {
        const lvTyp = determineLvTyp(product);
        if (lvTyp) {
          wouldImport++;
          byLvTyp[lvTyp] = (byLvTyp[lvTyp] || 0) + 1;
        } else {
          wouldSkip++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        hero_services: services.length,
        hero_products: products.length,
        would_import: wouldImport,
        would_skip: wouldSkip,
        by_lv_typ: byLvTyp,
        duration_ms: Date.now() - startTime
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Full sync (all) - may timeout with large datasets
    const result = await syncHeroToSupabase();

    return new Response(JSON.stringify({
      success: result.errors.length === 0 || result.created > 0 || result.updated > 0,
      ...result,
      duration_ms: Date.now() - startTime
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
