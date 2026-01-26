import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY') || 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';
const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_DOKUMENTE_TABLE = 'kNjsEhYYcNjAsj';

// Hero Dokumenttyp -> Softr Art des Dokuments
const HERO_TO_SOFTR_TYPE: Record<string, string> = {
  'invoice': 'AR-S  Ausgangsrechnung - Schluss',  // Default, wird durch Logik überschrieben
  'offer': 'ANG-Ku Angebot Kunde',
  'confirmation': 'AB Auftragsbestaetigung',
  'measurement': 'NUA-S NU-Auftrag Schluss',
  'calculation': 'KALK Kalkulation',
  'reversal_invoice': 'AR-X  Ausgangsrechnung - Storno',
  'letter': 'BRIEF Brief',
  'delivery_note': 'LS Lieferschein',
  'generic': 'SONST Sonstiges',
  'invoice_notice': 'AVIS Avis',
  'information': 'INFO Information',
  'repair': 'REP Reparatur',
  'order_form': 'BEST Bestellformular'
};

// Softr Feld-IDs
const SOFTR_FIELDS = {
  DOKUMENT_NR: '8Ae7U',
  ART_DOKUMENT: '6tf0K',
  RECHNUNGSSTELLER: 'CplA5',
  ATBS_NR: 'GBc7t',
  NUA_NR: '7xrdk',
  BAUVORHABEN: '1sWGL',
  BETRAG_NETTO: 'QuHkO',
  BETRAG_BRUTTO: 'kukJI',
  DATUM_ERSTELLT: 'DAXGa',
  STATUS_PRUEFUNG: 'VQ6v9',
  NOTIZEN: 'iHzHD'
};

interface HeroDocument {
  id: number;
  nr: string;
  type: string;
  value: number;
  vat: number;
  date: string;
  status_name: string;
  project_match_id?: number;
}

interface SyncResult {
  total_fetched: number;
  created: number;
  updated: number;
  skipped_duplicates: number;
  errors: string[];
}

// ============== HERO API ==============

async function fetchHeroDocuments(modifiedSince?: string): Promise<HeroDocument[]> {
  const allDocs: HeroDocument[] = [];

  for (let offset = 0; offset < 2000; offset += 500) {
    const query = `{
      customer_documents(first: 500, offset: ${offset}) {
        id
        nr
        type
        value
        vat
        date
        status_name
        project_match_id
      }
    }`;

    const response = await fetch(HERO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Hero API error: ${response.status}`);
    }

    const result = await response.json();
    const docs = result.data?.customer_documents || [];
    allDocs.push(...docs);

    if (docs.length < 500) break;
  }

  // Filter: nur Dokumente ab 2025 mit gültiger Nummer
  return allDocs.filter(d =>
    d.nr &&
    !d.nr.includes('xxxx') &&
    d.date &&
    d.date >= '2025-01-01'
  );
}

// ============== SOFTR API ==============

async function fetchSoftrDocuments(): Promise<Map<string, any>> {
  const docs = new Map<string, any>();

  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE}/records?limit=1000`,
    {
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Softr API error: ${response.status}`);
  }

  const result = await response.json();

  for (const record of result.data || []) {
    const dokNr = record.fields?.[SOFTR_FIELDS.DOKUMENT_NR] || '';
    const nuaNr = record.fields?.[SOFTR_FIELDS.NUA_NR] || '';

    if (dokNr) {
      docs.set(dokNr, record);
    }
    if (nuaNr && !docs.has(nuaNr)) {
      docs.set(nuaNr, record);
    }
  }

  return docs;
}

async function createSoftrRecord(fields: Record<string, any>): Promise<string | null> {
  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE}/records`,
    {
      method: 'POST',
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Softr create error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.data?.id || null;
}

async function updateSoftrRecord(recordId: string, fields: Record<string, any>): Promise<boolean> {
  const response = await fetch(
    `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Softr-Api-Key': SOFTR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );

  return response.ok;
}

// ============== PROJEKT-PHASE AUS MONDAY ==============

async function getProjectPhase(atbsNr: string): Promise<string | null> {
  // Hier könnte man die Phase aus monday_bauprozess holen
  // Für jetzt: null zurückgeben, wird später implementiert
  return null;
}

// ============== DOKUMENTTYP-LOGIK ==============

function determineDocumentType(
  doc: HeroDocument,
  existingDocs: Map<string, any>,
  projectPhase: string | null
): string {
  const netto = doc.value || 0;
  const brutto = netto + (doc.vat || 0);
  const isRechnung = doc.nr.startsWith('RE-') || doc.nr.startsWith('RE');

  // 1. STORNO: Negativer Betrag
  if (netto < 0) {
    if (isRechnung) {
      // Prüfe ob Ausgangs- oder Eingangsrechnung
      // Für jetzt: AR-X als Default
      return 'AR-X  Ausgangsrechnung - Storno';
    }
    return 'ER-X  Eingangsrechnung - Storno';
  }

  // 2. RECHNUNGEN
  if (doc.type === 'invoice' && isRechnung) {
    // Extrahiere ATBS-Nr aus Projekt oder Dokumentdaten
    // Für jetzt: basierend auf Projekt-Phase

    if (projectPhase === 'Phase 5' || projectPhase === '(5)') {
      return 'AR-S  Ausgangsrechnung - Schluss';
    }

    if (projectPhase === 'Phase 4' || projectPhase === '(4)') {
      return 'AR-A  Ausgangsrechnung - Abschlag';
    }

    // Fallback: Höchste RE-Nr Logik
    // Prüfe ob es bereits Rechnungen für dieselbe ATBS gibt
    const reNumber = extractReNumber(doc.nr);
    let isHighestForAtbs = true;

    // Durchsuche existierende Dokumente nach höherer RE-Nr
    for (const [nr, existing] of existingDocs) {
      if (nr.startsWith('RE-') || nr.startsWith('RE')) {
        const existingReNum = extractReNumber(nr);
        if (existingReNum > reNumber) {
          isHighestForAtbs = false;
          break;
        }
      }
    }

    return isHighestForAtbs
      ? 'AR-S  Ausgangsrechnung - Schluss'
      : 'AR-A  Ausgangsrechnung - Abschlag';
  }

  // 3. EINGANGSRECHNUNGEN (von Nachunternehmern)
  if (doc.type === 'invoice' && !isRechnung) {
    return 'ER-NU-S  Eingangsrechnung NU - Schluss';
  }

  // 4. ANDERE DOKUMENTTYPEN
  return HERO_TO_SOFTR_TYPE[doc.type] || 'SONST Sonstiges';
}

function extractReNumber(dokNr: string): number {
  const match = dokNr.match(/RE-?0*(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function isRechnungDokument(heroType: string, dokNr: string): boolean {
  return heroType === 'invoice' && (dokNr.startsWith('RE-') || dokNr.startsWith('RE'));
}

// ============== SYNC LOGIK ==============

async function syncDocuments(): Promise<SyncResult> {
  const result: SyncResult = {
    total_fetched: 0,
    created: 0,
    updated: 0,
    skipped_duplicates: 0,
    errors: []
  };

  try {
    // 1. Hole alle Hero-Dokumente
    console.log('Fetching Hero documents...');
    const heroDocs = await fetchHeroDocuments();
    result.total_fetched = heroDocs.length;
    console.log(`Fetched ${heroDocs.length} documents from Hero`);

    // 2. Hole existierende Softr-Dokumente
    console.log('Fetching Softr documents...');
    const softrDocs = await fetchSoftrDocuments();
    console.log(`Found ${softrDocs.size} existing documents in Softr`);

    // 3. Verarbeite jedes Hero-Dokument
    for (const heroDoc of heroDocs) {
      try {
        const dokNr = heroDoc.nr;
        const existsInSoftr = softrDocs.has(dokNr);
        const isRechnung = isRechnungDokument(heroDoc.type, dokNr);

        // Duplikat-Prüfung: Rechnungen nicht erneut hochladen
        if (existsInSoftr && isRechnung) {
          result.skipped_duplicates++;
          continue;
        }

        // Projekt-Phase holen (wenn ATBS bekannt)
        const projectPhase = null; // await getProjectPhase(atbsNr);

        // Dokumenttyp bestimmen
        const artDokument = determineDocumentType(heroDoc, softrDocs, projectPhase);

        // Softr-Felder vorbereiten
        const netto = heroDoc.value || 0;
        const brutto = netto + (heroDoc.vat || 0);

        const softrFields: Record<string, any> = {
          [SOFTR_FIELDS.DOKUMENT_NR]: dokNr,
          [SOFTR_FIELDS.ART_DOKUMENT]: artDokument,
          [SOFTR_FIELDS.BETRAG_NETTO]: netto,
          [SOFTR_FIELDS.BETRAG_BRUTTO]: brutto,
          [SOFTR_FIELDS.DATUM_ERSTELLT]: heroDoc.date,
          [SOFTR_FIELDS.NOTIZEN]: `Hero-Import: ${new Date().toISOString()}`
        };

        // NUA-Nr setzen für NUAs
        if (dokNr.startsWith('NUA-')) {
          softrFields[SOFTR_FIELDS.NUA_NR] = dokNr;
        }

        if (existsInSoftr) {
          // Update (für Revisionen von Angeboten, AB, NUA, etc.)
          const existingRecord = softrDocs.get(dokNr);
          const success = await updateSoftrRecord(existingRecord.id, softrFields);
          if (success) {
            result.updated++;
          } else {
            result.errors.push(`Update failed: ${dokNr}`);
          }
        } else {
          // Create
          const newId = await createSoftrRecord(softrFields);
          if (newId) {
            result.created++;
            // Füge zum Cache hinzu für Duplikat-Prüfung
            softrDocs.set(dokNr, { id: newId, fields: softrFields });
          } else {
            result.errors.push(`Create failed: ${dokNr}`);
          }
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 50));

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${heroDoc.nr}: ${errMsg}`);
      }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Sync error: ${errMsg}`);
  }

  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';

    console.log(`Hero Document Sync started (dry_run: ${dryRun})`);
    const startTime = Date.now();

    if (dryRun) {
      // Nur Statistiken anzeigen, keine Änderungen
      const heroDocs = await fetchHeroDocuments();
      const softrDocs = await fetchSoftrDocuments();

      let newDocs = 0;
      let duplicates = 0;
      let updates = 0;

      for (const doc of heroDocs) {
        const exists = softrDocs.has(doc.nr);
        const isRechnung = isRechnungDokument(doc.type, doc.nr);

        if (!exists) {
          newDocs++;
        } else if (isRechnung) {
          duplicates++;
        } else {
          updates++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        hero_documents: heroDocs.length,
        softr_documents: softrDocs.size,
        would_create: newDocs,
        would_update: updates,
        would_skip_duplicates: duplicates,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Echter Sync
    const result = await syncDocuments();

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: Date.now() - startTime
    }), {
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
