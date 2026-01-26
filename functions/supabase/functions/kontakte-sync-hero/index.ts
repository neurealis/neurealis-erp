import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// Hero Software API
const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY')!;

// Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Hero Kontakt-Typen zu unseren Kontaktarten mappen
const HERO_TYPE_MAPPING: Record<string, string[]> = {
  'customer': ['kunde_privat'],
  'commercial_customer': ['kunde_gewerblich'],
  'supplier': ['lieferant'],
  'partner': ['partner'],
  'contact_person': ['ansprechpartner'],
  'employee': ['mitarbeiter'],
};

// Hero Kategorien zu Kontaktarten mappen
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
  salutation: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  tax_number: string | null;
  vat_id: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  notes: string | null;
  category_name: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchHeroContacts(): Promise<HeroContact[]> {
  const allContacts: HeroContact[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const query = `
      query {
        contacts(first: ${perPage}, page: ${page}) {
          data {
            id
            type
            salutation
            title
            first_name
            last_name
            company_name
            email
            phone
            mobile
            fax
            website
            street
            zip
            city
            country
            tax_number
            vat_id
            iban
            bic
            bank_name
            notes
            category_name
            created_at
            updated_at
          }
          paginatorInfo {
            hasMorePages
            currentPage
            total
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

    const contacts = result.data?.contacts?.data || [];
    const pageInfo = result.data?.contacts?.paginatorInfo;

    allContacts.push(...contacts);

    if (!pageInfo?.hasMorePages) break;
    page++;
  }

  return allContacts;
}

function mapHeroToKontakt(hero: HeroContact) {
  // Kontaktarten ermitteln
  const kontaktarten: string[] = [];

  // Aus Hero-Type
  if (hero.type && HERO_TYPE_MAPPING[hero.type]) {
    kontaktarten.push(...HERO_TYPE_MAPPING[hero.type]);
  }

  // Aus Hero-Kategorie (zusätzlich)
  if (hero.category_name && HERO_CATEGORY_MAPPING[hero.category_name]) {
    const art = HERO_CATEGORY_MAPPING[hero.category_name];
    if (!kontaktarten.includes(art)) {
      kontaktarten.push(art);
    }
  }

  // Fallback
  if (kontaktarten.length === 0) {
    kontaktarten.push('kunde_privat');
  }

  // Anrede mappen
  let anrede = hero.salutation;
  if (anrede === 'mr') anrede = 'Herr';
  else if (anrede === 'mrs' || anrede === 'ms') anrede = 'Frau';
  else if (anrede === 'company') anrede = 'Firma';

  return {
    hero_id: hero.id,
    kontaktarten,
    anrede,
    titel: hero.title,
    vorname: hero.first_name,
    nachname: hero.last_name,
    firma_kurz: hero.company_name,
    email: hero.email,
    telefon_festnetz: hero.phone,
    telefon_mobil: hero.mobile,
    fax: hero.fax,
    website: hero.website,
    strasse: hero.street,
    plz: hero.zip,
    ort: hero.city,
    land: hero.country || 'Deutschland',
    steuernummer: hero.tax_number,
    ust_id: hero.vat_id,
    iban: hero.iban,
    bic: hero.bic,
    bank_name: hero.bank_name,
    notizen: hero.notes,
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
      // Prüfen ob Kontakt existiert (nach hero_id)
      const { data: existing } = await supabase
        .from('kontakte')
        .select('id, last_synced_at')
        .eq('hero_id', hero.id)
        .single();

      const kontakt = mapHeroToKontakt(hero);

      if (existing) {
        // Update nur wenn Hero-Daten neuer sind
        const heroUpdated = new Date(hero.updated_at);
        const lastSynced = existing.last_synced_at ? new Date(existing.last_synced_at) : new Date(0);

        if (heroUpdated > lastSynced) {
          const { error } = await supabase
            .from('kontakte')
            .update(kontakt)
            .eq('id', existing.id);

          if (error) throw error;
          updated++;

          // Log
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
        // Duplikat-Check via Email
        let duplicateId: string | null = null;

        if (hero.email) {
          const { data: emailMatch } = await supabase
            .from('kontakte')
            .select('id')
            .ilike('email', hero.email)
            .is('hero_id', null)
            .single();

          if (emailMatch) {
            duplicateId = emailMatch.id;
          }
        }

        if (duplicateId) {
          // Existierenden Kontakt mit hero_id verknüpfen
          const { error } = await supabase
            .from('kontakte')
            .update({
              hero_id: hero.id,
              kontaktarten: kontakt.kontaktarten,
              sync_source: 'hero',
              last_synced_at: kontakt.last_synced_at,
            })
            .eq('id', duplicateId);

          if (error) throw error;
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
          // Neuen Kontakt erstellen
          const { data: newKontakt, error } = await supabase
            .from('kontakte')
            .insert(kontakt)
            .select('id')
            .single();

          if (error) throw error;
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

    // Hero-Kontakte abrufen
    const contacts = await fetchHeroContacts();

    // Sync durchführen
    const { created, updated, skipped, errors } = await syncContacts(contacts);

    // Statistiken
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
    // Fehler loggen
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
