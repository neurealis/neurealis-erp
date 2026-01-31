import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY') || 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Mapping: lv_typ → Hero supply_operator.name
const LV_TYP_TO_OPERATOR: Record<string, string | null> = {
  'GWS': 'GWS 2025-01',
  'VBW': 'VBW 2025-01',
  'covivio': 'Covivio 2024-10',
  'WBG Lünen': 'WBG Lünen',
  'Freundlieb Quadrat': 'Forte Capital 2025-01',
  'Privat': null,  // Kein Operator
  'neurealis': null  // Kein Operator
};

interface HeroProduct {
  product_id: string;
  nr: string;
  base_price?: number;
  list_price?: number;
}

interface LvPosition {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  beschreibung?: string;
  einheit?: string;
  preis?: number;
  listenpreis?: number;
  lv_typ: string;
  gewerk?: string;
  source?: string;
  hero_product_id?: string;
}

interface PushResult {
  success: boolean;
  position_id: string;
  artikelnummer: string;
  hero_product_id?: string;
  error?: string;
}

// ============== HERO API ==============

// Load ALL Hero products (paginated)
async function loadAllHeroProducts(): Promise<HeroProduct[]> {
  const allProducts: HeroProduct[] = [];
  let hasMore = true;
  let cursor: string | null = null;
  const pageSize = 100;

  while (hasMore) {
    const query = `
      query GetProducts($first: Int!, $after: String) {
        supply_product_versions(first: $first, after: $after) {
          edges {
            node {
              product_id
              nr
              base_price
              list_price
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      const response = await fetch(HERO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HERO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables: { first: pageSize, after: cursor }
        })
      });

      if (!response.ok) {
        console.error(`Hero API HTTP error: ${response.status}`);
        break;
      }

      const result = await response.json();

      if (result.errors) {
        console.error('Hero GraphQL errors:', JSON.stringify(result.errors));
        break;
      }

      const data = result.data?.supply_product_versions;
      if (!data) break;

      for (const edge of data.edges || []) {
        allProducts.push(edge.node);
      }

      hasMore = data.pageInfo?.hasNextPage || false;
      cursor = data.pageInfo?.endCursor || null;

      console.log(`Loaded ${allProducts.length} Hero products...`);

      // Rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error('Error loading Hero products:', error);
      break;
    }
  }

  return allProducts;
}

// Update Hero product price
async function updateHeroProduct(productId: string, position: LvPosition): Promise<boolean> {
  const operator = LV_TYP_TO_OPERATOR[position.lv_typ];

  const mutation = `
    mutation UpdateProduct($input: SupplyProductVersionInput!) {
      update_supply_product_version(supply_product_version: $input) {
        product_id
        nr
      }
    }
  `;

  const input: Record<string, unknown> = {
    product_id: productId,
    base_data: {
      name: position.bezeichnung,
      description: position.beschreibung || '',
      category: position.gewerk || 'Sonstiges'
    },
    base_price: position.preis || 0
  };

  if (position.listenpreis) {
    input.list_price = position.listenpreis;
  }

  if (operator) {
    input.supply_operator = { name: operator };
  }

  if (position.einheit) {
    input.unit_type = position.einheit;
  }

  try {
    const response = await fetch(HERO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input }
      })
    });

    if (!response.ok) {
      console.error(`Hero update HTTP error: ${response.status}`);
      return false;
    }

    const result = await response.json();

    if (result.errors) {
      console.error('Hero update errors:', JSON.stringify(result.errors));
      return false;
    }

    return !!result.data?.update_supply_product_version;
  } catch (error) {
    console.error('Hero update error:', error);
    return false;
  }
}

async function createHeroProduct(position: LvPosition): Promise<{ product_id: string; nr: string } | null> {
  const operator = LV_TYP_TO_OPERATOR[position.lv_typ];

  // GraphQL Mutation für create_supply_product_version
  const mutation = `
    mutation CreateProduct($input: SupplyProductVersionInput!) {
      create_supply_product_version(supply_product_version: $input) {
        product_id
        nr
      }
    }
  `;

  // Input aufbauen
  const input: Record<string, unknown> = {
    nr: position.artikelnummer,
    base_data: {
      name: position.bezeichnung,
      description: position.beschreibung || '',
      category: position.gewerk || 'Sonstiges'
    },
    base_price: position.preis || 0
  };

  // Listenpreis wenn vorhanden
  if (position.listenpreis) {
    input.list_price = position.listenpreis;
  }

  // Operator wenn lv_typ einen hat
  if (operator) {
    input.supply_operator = { name: operator };
  }

  // Einheit wenn vorhanden
  if (position.einheit) {
    input.unit_type = position.einheit;
  }

  console.log(`Creating Hero product: ${position.artikelnummer}`);
  console.log('Input:', JSON.stringify(input, null, 2));

  try {
    const response = await fetch(HERO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hero API HTTP error: ${response.status}`, errorText);
      return null;
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('Hero GraphQL errors:', JSON.stringify(result.errors));
      return null;
    }

    const created = result.data?.create_supply_product_version;
    if (created) {
      console.log(`Created Hero product: ${created.product_id} (${created.nr})`);
      return created;
    }

    console.error('No data returned from Hero API');
    return null;

  } catch (error) {
    console.error('Hero API error:', error);
    return null;
  }
}

// ============== SUPABASE ==============

async function updateHeroProductId(supabase: ReturnType<typeof createClient>, positionId: string, heroProductId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lv_positionen')
    .update({
      hero_product_id: heroProductId,
      updated_at: new Date().toISOString()
    })
    .eq('id', positionId);

  if (error) {
    console.error(`Update error for ${positionId}:`, error.message);
    return false;
  }

  return true;
}

// ============== PUSH FUNCTION ==============

async function pushPositionToHero(position: LvPosition): Promise<PushResult> {
  const result: PushResult = {
    success: false,
    position_id: position.id,
    artikelnummer: position.artikelnummer
  };

  // Skip wenn bereits in Hero
  if (position.hero_product_id) {
    result.error = 'Already has hero_product_id';
    return result;
  }

  // Skip wenn source = hero (wurde von Hero importiert)
  if (position.source === 'hero') {
    result.error = 'Source is hero, skip to avoid loop';
    return result;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Zu Hero pushen
  const heroResult = await createHeroProduct(position);

  if (!heroResult) {
    result.error = 'Hero API create failed';
    return result;
  }

  // hero_product_id in Supabase speichern
  const updated = await updateHeroProductId(supabase, position.id, heroResult.product_id);

  if (!updated) {
    result.error = 'Supabase update failed';
    return result;
  }

  result.success = true;
  result.hero_product_id = heroResult.product_id;
  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Nur POST erlaubt
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const startTime = Date.now();

    // Mode: create (für Trigger oder manuellen Push)
    const mode = body.mode || 'create';

    if (mode === 'create') {
      // Einzelne Position aus Body oder Record (Trigger-Payload)
      const position: LvPosition = body.record || body.position;

      if (!position || !position.id || !position.artikelnummer) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing position data (id, artikelnummer required)'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Skip wenn source = hero
      if (position.source === 'hero') {
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Source is hero, skipping to avoid loop',
          position_id: position.id,
          duration_ms: Date.now() - startTime
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await pushPositionToHero(position);

      return new Response(JSON.stringify({
        ...result,
        duration_ms: Date.now() - startTime
      }), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mode: batch - Alle Positionen ohne hero_product_id und source != 'hero'
    if (mode === 'batch') {
      const limit = body.limit || 10;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Hole Positionen ohne hero_product_id und source != 'hero'
      const { data: positions, error } = await supabase
        .from('lv_positionen')
        .select('*')
        .is('hero_product_id', null)
        .neq('source', 'hero')
        .limit(limit);

      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: `Supabase query error: ${error.message}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const results: PushResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const pos of positions || []) {
        const result = await pushPositionToHero(pos);
        results.push(result);

        if (result.success) successCount++;
        else errorCount++;

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      return new Response(JSON.stringify({
        success: errorCount === 0,
        mode: 'batch',
        total: positions?.length || 0,
        success_count: successCount,
        error_count: errorCount,
        results,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mode: sync_ids - Load ALL Hero products and match with Supabase by artikelnummer
    if (mode === 'sync_ids') {
      const lvTyp = body.lv_typ || 'GWS';
      const dryRun = body.dry_run !== false;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      console.log(`sync_ids: Loading all Hero products...`);
      const heroProducts = await loadAllHeroProducts();
      console.log(`sync_ids: Loaded ${heroProducts.length} Hero products`);

      // Create lookup map: nr → product_id
      const heroMap = new Map<string, string>();
      for (const p of heroProducts) {
        if (p.nr) {
          heroMap.set(p.nr, p.product_id);
        }
      }

      // Get Supabase positions without hero_product_id
      const { data: positions, error } = await supabase
        .from('lv_positionen')
        .select('id, artikelnummer')
        .eq('lv_typ', lvTyp)
        .is('hero_product_id', null);

      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: `Supabase query error: ${error.message}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const matches: Array<{ id: string; artikelnummer: string; hero_product_id: string }> = [];
      const noMatch: string[] = [];

      for (const pos of positions || []) {
        const heroId = heroMap.get(pos.artikelnummer);
        if (heroId) {
          matches.push({
            id: pos.id,
            artikelnummer: pos.artikelnummer,
            hero_product_id: heroId
          });
        } else {
          noMatch.push(pos.artikelnummer);
        }
      }

      // If not dry run, update Supabase with hero_product_ids
      let updated = 0;
      if (!dryRun && matches.length > 0) {
        for (const m of matches) {
          const { error: updateError } = await supabase
            .from('lv_positionen')
            .update({ hero_product_id: m.hero_product_id, updated_at: new Date().toISOString() })
            .eq('id', m.id);

          if (!updateError) updated++;
          await new Promise(r => setTimeout(r, 50));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        mode: 'sync_ids',
        lv_typ: lvTyp,
        dry_run: dryRun,
        hero_products_total: heroProducts.length,
        supabase_positions_without_id: positions?.length || 0,
        matches_found: matches.length,
        no_match: noMatch.length,
        updated: updated,
        sample_matches: matches.slice(0, 10),
        sample_no_match: noMatch.slice(0, 10),
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mode: status - Show sync status
    if (mode === 'status') {
      const lvTyp = body.lv_typ || 'GWS';
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Total positions for lv_typ
      const { count: total } = await supabase
        .from('lv_positionen')
        .select('*', { count: 'exact', head: true })
        .eq('lv_typ', lvTyp);

      // With hero_product_id
      const { count: withHeroId } = await supabase
        .from('lv_positionen')
        .select('*', { count: 'exact', head: true })
        .eq('lv_typ', lvTyp)
        .not('hero_product_id', 'is', null);

      // From hero without hero_product_id
      const { count: fromHeroNoId } = await supabase
        .from('lv_positionen')
        .select('*', { count: 'exact', head: true })
        .eq('lv_typ', lvTyp)
        .eq('source', 'hero')
        .is('hero_product_id', null);

      // Changed today (preis_datum)
      const today = new Date().toISOString().split('T')[0];
      const { count: todayChanged } = await supabase
        .from('lv_positionen')
        .select('*', { count: 'exact', head: true })
        .eq('lv_typ', lvTyp)
        .eq('preis_datum', today);

      return new Response(JSON.stringify({
        success: true,
        mode: 'status',
        lv_typ: lvTyp,
        total_positions: total,
        with_hero_product_id: withHeroId,
        from_hero_without_id: fromHeroNoId,
        today_changed: todayChanged,
        ready_for_update: withHeroId,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mode: update_batch - Update prices in Hero for positions with hero_product_id
    if (mode === 'update_batch') {
      const lvTyp = body.lv_typ || 'GWS';
      const limit = body.limit || 50;
      const dryRun = body.dry_run !== false;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Get positions with hero_product_id that were updated today
      const today = new Date().toISOString().split('T')[0];
      const { data: positions, error } = await supabase
        .from('lv_positionen')
        .select('*')
        .eq('lv_typ', lvTyp)
        .not('hero_product_id', 'is', null)
        .eq('preis_datum', today)
        .limit(limit);

      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: `Supabase query error: ${error.message}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const results: Array<{
        artikelnummer: string;
        hero_product_id: string;
        preis: number;
        listenpreis: number;
        success?: boolean;
        error?: string;
      }> = [];

      let successCount = 0;
      let errorCount = 0;

      for (const pos of positions || []) {
        const item = {
          artikelnummer: pos.artikelnummer,
          hero_product_id: pos.hero_product_id,
          preis: pos.preis,
          listenpreis: pos.listenpreis
        };

        if (dryRun) {
          results.push({ ...item, success: true });
          successCount++;
        } else {
          const updated = await updateHeroProduct(pos.hero_product_id, pos);
          if (updated) {
            results.push({ ...item, success: true });
            successCount++;
          } else {
            results.push({ ...item, success: false, error: 'Hero update failed' });
            errorCount++;
          }
          // Rate limiting
          await new Promise(r => setTimeout(r, 200));
        }
      }

      return new Response(JSON.stringify({
        success: errorCount === 0,
        mode: 'update_batch',
        lv_typ: lvTyp,
        dry_run: dryRun,
        total: positions?.length || 0,
        success_count: successCount,
        error_count: errorCount,
        results: results.slice(0, 20),
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: `Unknown mode: ${mode}. Use 'create', 'batch', 'sync_ids', 'status', or 'update_batch'`
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
