import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY')!;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HERO_TYPE_MAPPING: Record<string, string[]> = {
  'customer': ['kunde_privat'],
  'commercial_customer': ['kunde_gewerblich'],
  'supplier': ['lieferant'],
  'partner': ['partner'],
  'contact_person': ['ansprechpartner'],
  'employee': ['mitarbeiter'],
};

const HERO_CATEGORY_MAPPING: Record<string, string> = {
  'Kunde': 'kunde_privat',
  'Gewerbekunde': 'kunde_gewerblich',
  'Lieferant': 'lieferant',
  'Partner': 'partner',
  'Ansprechpartner': 'ansprechpartner',
  'Mitarbeiter': 'mitarbeiter',
  'Nachunternehmer': 'nachunternehmer',
  'Eigentümer': 'eigentuemer',
  'Hausverwaltung': 'hausverwaltung',
};

interface HeroContact {
  id: number;
  type: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone_home: string | null;
  phone_mobile: string | null;
  phone_fax: string | null;
  url: string | null;
  category: string | null;
  category_name: string | null;
  position: string | null;
  partner_notes: string | null;
  is_deleted: boolean;
  created: string;
  modified: string;
  address: {
    street: string | null;
    zipcode: string | null;
    city: string | null;
    country: { name: string } | null;
  } | null;
}

async function fetchHeroContacts(): Promise<HeroContact[]> {
  const allContacts: HeroContact[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const query = `
      query {
        contacts(first: ${limit}, offset: ${offset}) {
          id
          type
          title
          first_name
          last_name
          company_name
          email
          phone_home
          phone_mobile
          phone_fax
          url
          category
          category_name
          position
          partner_notes
          is_deleted
          created
          modified
          address {
            street
            zipcode
            city
            country { name }
          }
        }
      }
    `;

    const response = await fetch(HERO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HERO_API_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Hero API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Hero GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    const contacts = result.data?.contacts || [];
    const activeContacts = contacts.filter((c: HeroContact) => !c.is_deleted);
    allContacts.push(...activeContacts);

    if (contacts.length < limit) break;
    offset += limit;
  }

  return allContacts;
}

function mapHeroToKontakt(hero: HeroContact) {
  const kontaktarten: string[] = [];

  if (hero.type && HERO_TYPE_MAPPING[hero.type]) {
    kontaktarten.push(...HERO_TYPE_MAPPING[hero.type]);
  }

  if (hero.category_name && HERO_CATEGORY_MAPPING[hero.category_name]) {
    const art = HERO_CATEGORY_MAPPING[hero.category_name];
    if (!kontaktarten.includes(art)) {
      kontaktarten.push(art);
    }
  }

  if (kontaktarten.length === 0) {
    kontaktarten.push('kunde_privat');
  }

  let anrede: string | null = null;
  if (hero.title === 'Herr' || hero.title === 'Mr') anrede = 'Herr';
  else if (hero.title === 'Frau' || hero.title === 'Mrs' || hero.title === 'Ms') anrede = 'Frau';
  else if (hero.company_name && !hero.first_name) anrede = 'Firma';

  return {
    hero_id: hero.id,
    kontaktarten,
    anrede,
    titel: hero.title !== 'Herr' && hero.title !== 'Frau' ? hero.title : null,
    vorname: hero.first_name,
    nachname: hero.last_name,
    firma_kurz: hero.company_name,
    position: hero.position,
    email: hero.email,
    telefon_festnetz: hero.phone_home,
    telefon_mobil: hero.phone_mobile,
    fax: hero.phone_fax,
    website: hero.url,
    strasse: hero.address?.street,
    plz: hero.address?.zipcode,
    ort: hero.address?.city,
    land: hero.address?.country?.name || 'Deutschland',
    notizen: hero.partner_notes,
    sync_source: 'hero',
    last_synced_at: new Date().toISOString(),
  };
}

async function syncContacts(contacts: HeroContact[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const hero of contacts) {
    try {
      const { data: existing } = await supabase
        .from('kontakte')
        .select('id, last_synced_at')
        .eq('hero_id', hero.id)
        .single();

      const kontakt = mapHeroToKontakt(hero);

      if (existing) {
        const heroUpdated = new Date(hero.modified);
        const lastSynced = existing.last_synced_at ? new Date(existing.last_synced_at) : new Date(0);

        if (heroUpdated > lastSynced) {
          const { error } = await supabase
            .from('kontakte')
            .update(kontakt)
            .eq('id', existing.id);

          if (error) throw new Error(`Update: ${error.message}`);
          updated++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'hero',
            action: 'updated',
            kontakt_id: existing.id,
            external_id: hero.id.toString(),
            external_type: 'hero_contact',
            details: { hero_type: hero.type, category: hero.category_name },
          });
        } else {
          skipped++;
        }
      } else {
        let duplicateId: string | null = null;

        if (hero.email) {
          const { data: emailMatch } = await supabase
            .from('kontakte')
            .select('id')
            .ilike('email', hero.email)
            .is('hero_id', null)
            .single();

          if (emailMatch) duplicateId = emailMatch.id;
        }

        if (duplicateId) {
          const { error } = await supabase
            .from('kontakte')
            .update({
              hero_id: hero.id,
              kontaktarten: kontakt.kontaktarten,
              sync_source: 'hero',
              last_synced_at: kontakt.last_synced_at,
            })
            .eq('id', duplicateId);

          if (error) throw new Error(`Merge: ${error.message}`);
          updated++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'hero',
            action: 'merged',
            kontakt_id: duplicateId,
            external_id: hero.id.toString(),
            external_type: 'hero_contact',
            details: { merged_by: 'email_match', email: hero.email },
          });
        } else {
          const { data: newKontakt, error } = await supabase
            .from('kontakte')
            .insert(kontakt)
            .select('id')
            .single();

          if (error) throw new Error(`Insert: ${error.message}`);
          created++;

          await supabase.from('kontakte_sync_log').insert({
            source: 'hero',
            action: 'created',
            kontakt_id: newKontakt.id,
            external_id: hero.id.toString(),
            external_type: 'hero_contact',
            details: { hero_type: hero.type, category: hero.category_name },
          });
        }
      }
    } catch (err) {
      errors++;
      await supabase.from('kontakte_sync_log').insert({
        source: 'hero',
        action: 'error',
        external_id: hero.id.toString(),
        external_type: 'hero_contact',
        error_message: String(err),
        details: { hero_email: hero.email, hero_name: hero.company_name || `${hero.first_name} ${hero.last_name}` },
      });
    }
  }

  return { created, updated, skipped, errors };
}

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();
    const contacts = await fetchHeroContacts();
    const { created, updated, skipped, errors } = await syncContacts(contacts);

    const typeStats: Record<string, number> = {};
    for (const c of contacts) {
      const key = c.type || 'unknown';
      typeStats[key] = (typeStats[key] || 0) + 1;
    }

    return new Response(JSON.stringify({
      success: true,
      source: 'hero',
      total_fetched: contacts.length,
      created,
      updated,
      skipped,
      errors,
      type_distribution: typeStats,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    await supabase.from('kontakte_sync_log').insert({
      source: 'hero',
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
