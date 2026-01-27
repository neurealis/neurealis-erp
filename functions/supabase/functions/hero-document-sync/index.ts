import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HERO_API_URL = 'https://login.hero-software.de/api/external/v7/graphql';
const HERO_API_KEY = Deno.env.get('HERO_API_KEY') || 'ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz';

const SOFTR_API_URL = 'https://tables-api.softr.io/api/v1';
const SOFTR_API_KEY = Deno.env.get('SOFTR_API_KEY') || 'dWhawF85Rw7tqSsaaqmavvmkE';
const SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3';
const SOFTR_DOKUMENTE_TABLE = 'kNjsEhYYcNjAsj';

// Hero Dokumenttyp -> Softr Art des Dokuments
const HERO_TO_SOFTR_TYPE: Record<string, string> = {
  'invoice': 'AR-S  Ausgangsrechnung - Schluss',  // Default, wird durch invoice_style überschrieben
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

// invoice_style -> Softr Dokumenttyp (NEU!)
const INVOICE_STYLE_TO_SOFTR: Record<string, string> = {
  'full': 'AR-S  Ausgangsrechnung - Schluss',
  'parted': 'AR-A  Ausgangsrechnung - Abschlag',
  'cumulative': 'AR-A  Ausgangsrechnung - Abschlag',
  'downpayment': 'AR-A  Ausgangsrechnung - Abschlag'
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
  NOTIZEN: 'iHzHD',
  DATEINAME: 'yK3dP',     // Dateiname-Feld
  DATEI_URL: 'pR7sQ'      // Datei-URL-Feld (falls vorhanden)
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
  metadata?: {
    invoice_style?: string | null;
    positions?: Array<{
      name: string;
      net_value: number;
      vat: number;
    }>;
  };
  file_upload?: {
    url?: string;
    filename?: string;
    temporary_url?: string;
  };
}

interface SyncResult {
  total_fetched: number;
  created: number;
  updated: number;
  skipped_drafts: number;
  skipped_duplicates: number;
  corrected_types: number;
  errors: string[];
}

// ============== HERO API ==============

async function fetchHeroDocuments(modifiedSince?: string): Promise<HeroDocument[]> {
  const allDocs: HeroDocument[] = [];

  for (let offset = 0; offset < 3000; offset += 100) {
    // Kleinere Batches (100) mit metadata und file_upload
    const query = `{
      customer_documents(first: 100, offset: ${offset}) {
        id
        nr
        type
        value
        vat
        date
        status_name
        project_match_id
        metadata {
          invoice_style
          positions {
            name
            net_value
            vat
          }
        }
        file_upload {
          url
          filename
          temporary_url
        }
      }
    }`;

    try {
      const response = await fetch(HERO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HERO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        console.error(`Hero API error at offset ${offset}: ${response.status}`);
        break;
      }

      const result = await response.json();
      const docs = result.data?.customer_documents || [];
      allDocs.push(...docs);

      console.log(`Fetched ${docs.length} docs at offset ${offset}`);

      if (docs.length < 100) break;

      // Rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`Error fetching at offset ${offset}:`, err);
      break;
    }
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
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    console.log(`Fetching Softr documents page ${page + 1} (offset: ${offset})...`);

    const response = await fetch(
      `${SOFTR_API_URL}/databases/${SOFTR_DATABASE_ID}/tables/${SOFTR_DOKUMENTE_TABLE}/records?limit=${PAGE_SIZE}&offset=${offset}`,
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
    const records = result.data || [];

    for (const record of records) {
      const dokNr = record.fields?.[SOFTR_FIELDS.DOKUMENT_NR] || '';
      const nuaNr = record.fields?.[SOFTR_FIELDS.NUA_NR] || '';

      if (dokNr) {
        docs.set(dokNr, record);
      }
      if (nuaNr && !docs.has(nuaNr)) {
        docs.set(nuaNr, record);
      }
    }

    if (records.length < PAGE_SIZE) {
      console.log(`Softr pagination complete. Total unique documents: ${docs.size}`);
      break;
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

// ============== DOKUMENTTYP-LOGIK (NEU mit invoice_style) ==============

function determineDocumentType(doc: HeroDocument): string | null {
  const netto = doc.value || 0;
  const isRechnung = doc.nr.startsWith('RE-') || doc.nr.startsWith('RE');
  const invoiceStyle = doc.metadata?.invoice_style;

  // 1. STORNO: Negativer Betrag
  if (netto < 0) {
    if (isRechnung) {
      return 'AR-X  Ausgangsrechnung - Storno';
    }
    return 'ER-X  Eingangsrechnung - Storno';
  }

  // 2. RECHNUNGEN mit invoice_style (primäre Logik!)
  if (doc.type === 'invoice' && isRechnung) {
    // Entwürfe ignorieren (invoice_style ist null)
    if (!invoiceStyle) {
      return null; // null = nicht synchronisieren
    }

    // invoice_style -> Softr Typ
    const softrType = INVOICE_STYLE_TO_SOFTR[invoiceStyle];
    if (softrType) {
      return softrType;
    }

    // Unbekannter Style -> Default Schlussrechnung
    console.warn(`Unknown invoice_style: ${invoiceStyle} for ${doc.nr}`);
    return 'AR-S  Ausgangsrechnung - Schluss';
  }

  // 3. EINGANGSRECHNUNGEN (von Nachunternehmern)
  if (doc.type === 'invoice' && !isRechnung) {
    return 'ER-NU-S  Eingangsrechnung NU - Schluss';
  }

  // 4. ANDERE DOKUMENTTYPEN
  return HERO_TO_SOFTR_TYPE[doc.type] || 'SONST Sonstiges';
}

function extractPositionsText(positions?: Array<{name: string; net_value: number; vat: number}>): string {
  if (!positions || positions.length === 0) return '';

  return positions
    .map(p => `${p.name}: ${p.net_value.toFixed(2)} EUR`)
    .join('\n');
}

function isRechnungDokument(heroType: string, dokNr: string): boolean {
  return heroType === 'invoice' && (dokNr.startsWith('RE-') || dokNr.startsWith('RE'));
}

// ============== SYNC LOGIK ==============

async function syncDocuments(forceUpdate: boolean = false): Promise<SyncResult> {
  const result: SyncResult = {
    total_fetched: 0,
    created: 0,
    updated: 0,
    skipped_drafts: 0,
    skipped_duplicates: 0,
    corrected_types: 0,
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

        // Dokumenttyp bestimmen
        const artDokument = determineDocumentType(heroDoc);

        // Entwürfe überspringen (null = nicht synchronisieren)
        if (artDokument === null) {
          result.skipped_drafts++;
          continue;
        }

        // Duplikat-Prüfung: Rechnungen nicht erneut hochladen (außer forceUpdate)
        if (existsInSoftr && isRechnung && !forceUpdate) {
          // Bei forceUpdate trotzdem updaten um Typ zu korrigieren
          const existingRecord = softrDocs.get(dokNr);
          const existingType = existingRecord?.fields?.[SOFTR_FIELDS.ART_DOKUMENT];

          // Typ-Korrektur wenn nötig
          if (existingType !== artDokument) {
            const netto = heroDoc.value || 0;
            const brutto = netto + (heroDoc.vat || 0);

            const updateFields: Record<string, any> = {
              [SOFTR_FIELDS.ART_DOKUMENT]: artDokument,
              [SOFTR_FIELDS.BETRAG_NETTO]: netto,
              [SOFTR_FIELDS.BETRAG_BRUTTO]: brutto
            };

            // Dateiname ergänzen wenn vorhanden
            if (heroDoc.file_upload?.filename) {
              updateFields[SOFTR_FIELDS.DATEINAME] = heroDoc.file_upload.filename;
            }

            const success = await updateSoftrRecord(existingRecord.id, updateFields);
            if (success) {
              result.corrected_types++;
              console.log(`Corrected type for ${dokNr}: ${existingType} -> ${artDokument}`);
            }
          }

          result.skipped_duplicates++;
          continue;
        }

        // Softr-Felder vorbereiten
        const netto = heroDoc.value || 0;
        const brutto = netto + (heroDoc.vat || 0);
        const importTimestamp = new Date().toISOString();

        // Basis-Felder
        const baseFields: Record<string, any> = {
          [SOFTR_FIELDS.DOKUMENT_NR]: dokNr,
          [SOFTR_FIELDS.ART_DOKUMENT]: artDokument,
          [SOFTR_FIELDS.BETRAG_NETTO]: netto,
          [SOFTR_FIELDS.BETRAG_BRUTTO]: brutto,
          [SOFTR_FIELDS.DATUM_ERSTELLT]: heroDoc.date
        };

        // Dateiname ergänzen wenn vorhanden
        if (heroDoc.file_upload?.filename) {
          baseFields[SOFTR_FIELDS.DATEINAME] = heroDoc.file_upload.filename;
        }

        // NUA-Nr setzen für NUAs
        if (dokNr.startsWith('NUA-')) {
          baseFields[SOFTR_FIELDS.NUA_NR] = dokNr;
        }

        if (existsInSoftr) {
          // Update: Notizen NICHT überschreiben
          const existingRecord = softrDocs.get(dokNr);
          const success = await updateSoftrRecord(existingRecord.id, baseFields);
          if (success) {
            result.updated++;
          } else {
            result.errors.push(`Update failed: ${dokNr}`);
          }
        } else {
          // Create: Notizen-Feld mit Import-Timestamp setzen
          const createFields = {
            ...baseFields,
            [SOFTR_FIELDS.NOTIZEN]: `Hero-Import: ${importTimestamp}`
          };
          const newId = await createSoftrRecord(createFields);
          if (newId) {
            result.created++;
            softrDocs.set(dokNr, { id: newId, fields: createFields });
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
    const forceUpdate = url.searchParams.get('force_update') === 'true';

    console.log(`Hero Document Sync started (dry_run: ${dryRun}, force_update: ${forceUpdate})`);
    const startTime = Date.now();

    if (dryRun) {
      // Nur Statistiken anzeigen
      const heroDocs = await fetchHeroDocuments();
      const softrDocs = await fetchSoftrDocuments();

      let newDocs = 0;
      let duplicates = 0;
      let updates = 0;
      let drafts = 0;
      let typeCorrections = 0;

      for (const doc of heroDocs) {
        const artDokument = determineDocumentType(doc);

        if (artDokument === null) {
          drafts++;
          continue;
        }

        const exists = softrDocs.has(doc.nr);
        const isRechnung = isRechnungDokument(doc.type, doc.nr);

        if (!exists) {
          newDocs++;
        } else if (isRechnung) {
          duplicates++;

          // Prüfe ob Typ-Korrektur nötig
          const existingRecord = softrDocs.get(doc.nr);
          const existingType = existingRecord?.fields?.[SOFTR_FIELDS.ART_DOKUMENT];
          if (existingType !== artDokument) {
            typeCorrections++;
          }
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
        would_skip_drafts: drafts,
        would_skip_duplicates: duplicates,
        type_corrections_needed: typeCorrections,
        duration_ms: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Echter Sync
    const result = await syncDocuments(forceUpdate);

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
