import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY')!;
const BOARD_ID = '1545426536';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface MondayItem {
  id: string;
  name: string;
  group: { id: string; title: string };
  created_at: string;
  updated_at: string;
  column_values: { id: string; text: string; value: string }[];
}

async function fetchMondayItems(): Promise<MondayItem[]> {
  const allItems: MondayItem[] = [];
  let cursor: string | null = null;

  while (true) {
    const query = cursor
      ? `query { next_items_page(cursor: "${cursor}", limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } }`
      : `query { boards(ids: ${BOARD_ID}) { items_page(limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } } }`;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2024-10'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Monday API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Monday GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    let items: MondayItem[];
    let newCursor: string | null;

    if (cursor) {
      items = result.data?.next_items_page?.items || [];
      newCursor = result.data?.next_items_page?.cursor || null;
    } else {
      items = result.data?.boards?.[0]?.items_page?.items || [];
      newCursor = result.data?.boards?.[0]?.items_page?.cursor || null;
    }

    allItems.push(...items);

    if (!newCursor || items.length === 0) break;
    cursor = newCursor;
  }

  return allItems;
}

async function syncItems(items: MondayItem[]) {
  let created = 0, updated = 0, errors = 0;

  for (const item of items) {
    try {
      const columnValuesObj: Record<string, any> = {};
      for (const col of item.column_values) {
        columnValuesObj[col.id] = { text: col.text, value: col.value };
      }

      const record = {
        id: item.id,
        name: item.name,
        board_id: BOARD_ID,
        group_id: item.group.id,
        group_title: item.group.title,
        column_values: columnValuesObj,
        created_at: item.created_at,
        updated_at: item.updated_at,
        monday_synced_at: new Date().toISOString(),
        sync_status: 'synced'
      };

      const { data: existing } = await supabase
        .from('monday_bauprozess')
        .select('id')
        .eq('id', item.id)
        .single();

      if (existing) {
        await supabase.from('monday_bauprozess').update(record).eq('id', item.id);
        updated++;
      } else {
        await supabase.from('monday_bauprozess').insert(record);
        created++;
      }
    } catch (err) {
      errors++;
    }
  }

  return { created, updated, errors };
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    const items = await fetchMondayItems();
    const { created, updated, errors } = await syncItems(items);

    await supabase.from('monday_sync_log').insert({
      board_id: BOARD_ID,
      items_synced: items.length,
      items_created: created,
      items_updated: updated,
      completed_at: new Date().toISOString()
    });

    const groups: Record<string, number> = {};
    for (const item of items) {
      const key = `${item.group.id}: ${item.group.title}`;
      groups[key] = (groups[key] || 0) + 1;
    }

    return new Response(JSON.stringify({
      success: true,
      board_id: BOARD_ID,
      total_items: items.length,
      created,
      updated,
      errors,
      groups,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
