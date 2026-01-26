import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Monday.com API
const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY')!;

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Board-IDs aus der Dokumentation
const BOARDS = {
  mitarbeiter: '1828539808',
  subunternehmer: '1545125471',
  lieferanten: '1547308184',
};

// Mapping Monday-Board zu Kontaktarten
const BOARD_KONTAKTARTEN: Record<string, string[]> = {
  mitarbeiter: ['mitarbeiter'],
  subunternehmer: ['nachunternehmer'],
  lieferanten: ['lieferant'],
};

interface MondayItem {
  id: string;
  name: string;
  group: { id: string; title: string };
  created_at: string;
  updated_at: string;
  column_values: { id: string; text: string; value: string }[];
}

interface BoardResult {
  board_name: string;
  board_id: string;
  total_fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

async function fetchMondayItems(boardId: string): Promise<MondayItem[]> {
  const allItems: MondayItem[] = [];
  let cursor: string | null = null;

  while (true) {
    const query = cursor
      ? `query { next_items_page(cursor: "${cursor}", limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } }`
      : `query { boards(ids: ${boardId}) { items_page(limit: 100) { cursor items { id name group { id title } created_at updated_at column_values { id text value } } } } }`;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2024-10',
      },
      body: JSON.stringify({ query }),
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

function getColumnValue(item: MondayItem, columnId: string): string | null {
  const col = item.column_values.find(c => c.id === columnId);
  return col?.text || null;
}

function getColumnJSON(item: MondayItem, columnId: string): any | null {
  const col = item.column_values.find(c => c.id === columnId);
  if (!col?.value) return null;
  try {
    return JSON.parse(col.value);
  } catch {
    return null;
  }
}

// Mitarbeiter-Board Mapping
function mapMitarbeiter(item: MondayItem) {
  // Typische Spalten-IDs für Mitarbeiter-Board (müssen ggf. angepasst werden)
  const email = getColumnValue(item, 'email') || getColumnValue(item, 'e_mail');
  const telefon = getColumnValue(item, 'telefon') || getColumnValue(item, 'phone');
  const heroId = getColumnValue(item, 'hero_id');

  // Name parsen (Format: "Vorname Nachname" oder "Nachname, Vorname")
  let vorname = '';
  let nachname = '';
  const nameParts = item.name.split(' ');
  if (nameParts.length >= 2) {
    vorname = nameParts[0];
    nachname = nameParts.slice(1).join(' ');
  } else {
    nachname = item.name;
  }

  return {
    monday_mitarbeiter_id: item.id,
    kontaktarten: ['mitarbeiter'],
    vorname,
    nachname,
    email,
    telefon_mobil: telefon,
    position: getColumnValue(item, 'position') || getColumnValue(item, 'rolle'),
    hero_id: heroId ? parseInt(heroId, 10) : null,
    sync_source: 'monday',
    last_synced_at: new Date().toISOString(),
  };
}

// Subunternehmer-Board Mapping
function mapSubunternehmer(item: MondayItem) {
  const email = getColumnValue(item, 'email') || getColumnValue(item, 'e_mail');
  const telefon = getColumnValue(item, 'telefon') || getColumnValue(item, 'phone');
  const gewerke = getColumnValue(item, 'gewerk') || getColumnValue(item, 'gewerke');

  // Compliance-Dokumente aus Monday-Spalten
  const compliance: Record<string, any> = {};

  // §13b Bescheinigung
  const par13b = getColumnValue(item, 'par_13b') || getColumnValue(item, '13b');
  const par13bDate = getColumnValue(item, 'par_13b_bis') || getColumnValue(item, '13b_gueltig_bis');
  if (par13b || par13bDate) {
    compliance['§13b'] = {
      status: par13b ? 'vorhanden' : 'fehlt',
      gueltig_bis: par13bDate,
    };
  }

  // §48 Freistellung
  const par48 = getColumnValue(item, 'par_48') || getColumnValue(item, '48');
  const par48Date = getColumnValue(item, 'par_48_bis') || getColumnValue(item, '48_gueltig_bis');
  if (par48 || par48Date) {
    compliance['§48'] = {
      status: par48 ? 'vorhanden' : 'fehlt',
      gueltig_bis: par48Date,
    };
  }

  // Versicherung
  const versicherung = getColumnValue(item, 'versicherung') || getColumnValue(item, 'haftpflicht');
  const versicherungDate = getColumnValue(item, 'versicherung_bis');
  if (versicherung || versicherungDate) {
    compliance['versicherung'] = {
      status: versicherung ? 'vorhanden' : 'fehlt',
      gueltig_bis: versicherungDate,
    };
  }

  return {
    monday_sub_id: item.id,
    kontaktarten: ['nachunternehmer'],
    firma_kurz: item.name,
    email,
    telefon_mobil: telefon,
    strasse: getColumnValue(item, 'strasse') || getColumnValue(item, 'adresse'),
    plz: getColumnValue(item, 'plz'),
    ort: getColumnValue(item, 'ort') || getColumnValue(item, 'stadt'),
    iban: getColumnValue(item, 'iban'),
    bic: getColumnValue(item, 'bic'),
    compliance_docs: Object.keys(compliance).length > 0 ? compliance : {},
    notizen: getColumnValue(item, 'notizen') || getColumnValue(item, 'notes'),
    sync_source: 'monday',
    last_synced_at: new Date().toISOString(),
    // Für kontakte_nachunternehmer Tabelle
    _gewerke: gewerke ? gewerke.split(',').map((g: string) => g.trim().toLowerCase()) : [],
  };
}

// Lieferanten-Board Mapping
function mapLieferant(item: MondayItem) {
  const email = getColumnValue(item, 'email') || getColumnValue(item, 'e_mail');
  const telefon = getColumnValue(item, 'telefon') || getColumnValue(item, 'phone');

  return {
    monday_lieferant_id: item.id,
    kontaktarten: ['lieferant'],
    firma_kurz: item.name,
    email,
    telefon_festnetz: telefon,
    website: getColumnValue(item, 'website') || getColumnValue(item, 'homepage'),
    strasse: getColumnValue(item, 'strasse') || getColumnValue(item, 'adresse'),
    plz: getColumnValue(item, 'plz'),
    ort: getColumnValue(item, 'ort') || getColumnValue(item, 'stadt'),
    kundennummer: getColumnValue(item, 'kundennummer') || getColumnValue(item, 'kunden_nr'),
    notizen: getColumnValue(item, 'notizen') || getColumnValue(item, 'notes'),
    sync_source: 'monday',
    last_synced_at: new Date().toISOString(),
    // Für kontakte_lieferanten Tabelle
    _rabatt: getColumnValue(item, 'rabatt') || getColumnValue(item, 'skonto'),
    _sortiment: getColumnValue(item, 'sortiment') || getColumnValue(item, 'kategorie'),
  };
}

async function syncBoard(boardName: keyof typeof BOARDS): Promise<BoardResult> {
  const boardId = BOARDS[boardName];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const items = await fetchMondayItems(boardId);

  for (const item of items) {
    try {
      // Mapping je nach Board-Typ
      let kontakt: any;
      let mondayIdField: string;

      switch (boardName) {
        case 'mitarbeiter':
          kontakt = mapMitarbeiter(item);
          mondayIdField = 'monday_mitarbeiter_id';
          break;
        case 'subunternehmer':
          kontakt = mapSubunternehmer(item);
          mondayIdField = 'monday_sub_id';
          break;
        case 'lieferanten':
          kontakt = mapLieferant(item);
          mondayIdField = 'monday_lieferant_id';
          break;
        default:
          throw new Error(`Unknown board: ${boardName}`);
      }

      // Erweiterungsdaten extrahieren (für separate Tabellen)
      const gewerke = kontakt._gewerke;
      const rabatt = kontakt._rabatt;
      const sortiment = kontakt._sortiment;
      delete kontakt._gewerke;
      delete kontakt._rabatt;
      delete kontakt._sortiment;

      // Prüfen ob Kontakt existiert (nach Monday-ID)
      const { data: existing } = await supabase
        .from('kontakte')
        .select('id')
        .eq(mondayIdField, item.id)
        .single();

      // Oder Hero-ID Match prüfen (bei Mitarbeitern)
      let heroMatch: any = null;
      if (boardName === 'mitarbeiter' && kontakt.hero_id) {
        const { data } = await supabase
          .from('kontakte')
          .select('id')
          .eq('hero_id', kontakt.hero_id)
          .is(mondayIdField, null)
          .single();
        heroMatch = data;
      }

      // Oder Email-Match prüfen
      let emailMatch: any = null;
      if (kontakt.email && !existing && !heroMatch) {
        const { data } = await supabase
          .from('kontakte')
          .select('id')
          .ilike('email', kontakt.email)
          .is(mondayIdField, null)
          .single();
        emailMatch = data;
      }

      const matchedId = existing?.id || heroMatch?.id || emailMatch?.id;

      if (matchedId) {
        // Update existierenden Kontakt
        const { error } = await supabase
          .from('kontakte')
          .update(kontakt)
          .eq('id', matchedId);

        if (error) throw error;
        updated++;

        // Log
        await supabase.from('kontakte_sync_log').insert({
          source: 'monday',
          action: heroMatch || emailMatch ? 'merged' : 'updated',
          kontakt_id: matchedId,
          external_id: item.id,
          external_type: `monday_${boardName}`,
          details: { board: boardName, item_name: item.name },
        });

        // Erweiterungstabellen aktualisieren
        if (boardName === 'subunternehmer' && gewerke?.length > 0) {
          await supabase.from('kontakte_nachunternehmer').upsert({
            kontakt_id: matchedId,
            gewerke,
            hauptgewerk: gewerke[0],
          }, { onConflict: 'kontakt_id' });
        }

        if (boardName === 'lieferanten') {
          await supabase.from('kontakte_lieferanten').upsert({
            kontakt_id: matchedId,
            rabatt_prozent: rabatt ? parseFloat(rabatt) : null,
            sortiment: sortiment ? sortiment.split(',').map((s: string) => s.trim().toLowerCase()) : [],
          }, { onConflict: 'kontakt_id' });
        }

      } else {
        // Neuen Kontakt erstellen
        const { data: newKontakt, error } = await supabase
          .from('kontakte')
          .insert(kontakt)
          .select('id')
          .single();

        if (error) throw error;
        created++;

        await supabase.from('kontakte_sync_log').insert({
          source: 'monday',
          action: 'created',
          kontakt_id: newKontakt.id,
          external_id: item.id,
          external_type: `monday_${boardName}`,
          details: { board: boardName, item_name: item.name },
        });

        // Erweiterungstabellen erstellen
        if (boardName === 'subunternehmer' && gewerke?.length > 0) {
          await supabase.from('kontakte_nachunternehmer').insert({
            kontakt_id: newKontakt.id,
            gewerke,
            hauptgewerk: gewerke[0],
          });
        }

        if (boardName === 'lieferanten') {
          await supabase.from('kontakte_lieferanten').insert({
            kontakt_id: newKontakt.id,
            rabatt_prozent: rabatt ? parseFloat(rabatt) : null,
            sortiment: sortiment ? sortiment.split(',').map((s: string) => s.trim().toLowerCase()) : [],
          });
        }
      }
    } catch (err) {
      errors++;
      await supabase.from('kontakte_sync_log').insert({
        source: 'monday',
        action: 'error',
        external_id: item.id,
        external_type: `monday_${boardName}`,
        error_message: String(err),
        details: { board: boardName, item_name: item.name },
      });
    }
  }

  return {
    board_name: boardName,
    board_id: boardId,
    total_fetched: items.length,
    created,
    updated,
    skipped,
    errors,
  };
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();

    // URL-Parameter prüfen für selektiven Sync
    const url = new URL(req.url);
    const boardParam = url.searchParams.get('board');

    const results: BoardResult[] = [];

    if (boardParam && boardParam in BOARDS) {
      // Nur ein Board syncen
      const result = await syncBoard(boardParam as keyof typeof BOARDS);
      results.push(result);
    } else {
      // Alle Boards syncen
      for (const board of Object.keys(BOARDS) as (keyof typeof BOARDS)[]) {
        const result = await syncBoard(board);
        results.push(result);
      }
    }

    // Gesamtstatistiken
    const totals = {
      fetched: results.reduce((sum, r) => sum + r.total_fetched, 0),
      created: results.reduce((sum, r) => sum + r.created, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.reduce((sum, r) => sum + r.errors, 0),
    };

    return new Response(JSON.stringify({
      success: true,
      source: 'monday',
      boards: results,
      totals,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    await supabase.from('kontakte_sync_log').insert({
      source: 'monday',
      action: 'error',
      error_message: String(error),
      details: { phase: 'global' },
    });

    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
