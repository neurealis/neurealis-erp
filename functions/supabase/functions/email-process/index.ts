/**
 * email-process: E-Mail-Matching und Dokumenten-Klassifizierung
 *
 * Funktionen:
 * - Domain-Matching: Absender-Domain -> Kontakt
 * - Pattern-Matching: ATBS-Nr, RE-Nr aus Betreff/Body
 * - Postfach-Logik: rechnungen@ -> ER-*, etc.
 * - Kontakt-Anlage fuer unbekannte Absender
 *
 * Cron: alle 15 Min (versetzt)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Regex-Patterns für Matching
const PATTERNS = {
  ATBS: /ATBS[- ]?(\d{3,4})/i,
  BV_NR: /BV[- ]?(\d{3,})/i,
  RE_NR: /RE[- ]?(\d{4,})/i,
  ANG_NR: /ANG[- ]?(\d{4,})/i,
  NUA_NR: /NUA[- ]?(\d{4,})/i
};

// Dokumenttyp-Mapping nach Postfach
const POSTFACH_DEFAULTS: Record<string, { art: string; tags?: string[] }> = {
  'rechnungen@neurealis.de': { art: 'ER-S', tags: ['Eingangsrechnung'] },
  'auftraege@neurealis.de': { art: 'AB', tags: ['Auftrag'] },
  'bewerbungen@neurealis.de': { art: 'SONST', tags: ['Bewerbung', 'HR'] },
  'service@neurealis.de': { art: 'E-MAIL', tags: ['Anfrage', 'Service'] },
  'kontakt@neurealis.de': { art: 'E-MAIL', tags: ['Kontaktanfrage'] },
  'holger.neumann@neurealis.de': { art: 'E-MAIL', tags: [] }
};

// Keywords für Dokumenttyp-Erkennung
const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
  'ER-S': ['Rechnung', 'Invoice', 'Faktura', 'Rechnungsnummer', 'Zahlungsziel'],
  'ER-A': ['Abschlagsrechnung', 'Teilrechnung', 'Anzahlung', 'Abschlag'],
  'ANG-Li': ['Angebot', 'Offerte', 'Quotation', 'Preisanfrage'],
  'AB': ['Auftragsbestätigung', 'Bestellbestätigung', 'Order Confirmation'],
  'AVIS': ['Zahlungsavis', 'Zahlung', 'Überweisung', 'Payment'],
  'NACH': ['§13b', '§48', 'Nachweis', 'Freistellungsbescheinigung', 'Unbedenklichkeit'],
  'PROT': ['Protokoll', 'Besprechung', 'Meeting', 'Termin']
};

interface UnprocessedDocument {
  id: string;
  dokument_nr: string;
  art_des_dokuments: string;
  datei_name: string | null;
  raw_text: string | null;
  absender_email_erkannt: string | null;
  absender_name_erkannt: string | null;
  metadata: Record<string, any> | null;
  kontakt_id: string | null;
  bauvorhaben_id: string | null;
}

interface EmailDetail {
  id: string;
  dokument_id: string;
  from_address: string;
  from_name: string | null;
  account_email: string;
  body_preview: string | null;
}

interface KontaktDomain {
  domain: string;
  kontakt_id: string | null;
  firma_kurz: string | null;
  kontaktart: string | null;
  is_generic: boolean;
}

interface ProcessResult {
  documents_processed: number;
  matched_by_domain: number;
  matched_by_pattern: number;
  matched_by_postfach: number;
  kontakte_created: number;
  types_updated: number;
  errors: string[];
}

// ============== MATCHING-FUNKTIONEN ==============

/**
 * Extrahiert Domain aus E-Mail-Adresse
 */
function extractDomain(email: string): string {
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Domain-Matching: Sucht Kontakt anhand der Absender-Domain
 */
async function matchByDomain(fromAddress: string): Promise<{
  kontaktId: string | null;
  kontaktart: string | null;
  firmaKurz: string | null;
  confidence: number;
} | null> {
  const domain = extractDomain(fromAddress);
  if (!domain) return null;

  // Suche in kontakt_domains
  const { data, error } = await supabase
    .from('kontakt_domains')
    .select('kontakt_id, firma_kurz, kontaktart, is_generic')
    .eq('domain', domain)
    .single();

  if (error || !data) return null;

  // Generische Domains (gmail, web.de) nicht automatisch matchen
  if (data.is_generic) return null;

  return {
    kontaktId: data.kontakt_id,
    kontaktart: data.kontaktart,
    firmaKurz: data.firma_kurz,
    confidence: 0.9
  };
}

/**
 * Pattern-Matching: Sucht ATBS-Nr, RE-Nr etc. im Text
 */
async function matchByPattern(subject: string, bodyText: string): Promise<{
  bauvorhabenId: string | null;
  bauvorhabenName: string | null;
  atbsNummer: string | null;
  rechnungsnummer: string | null;
  confidence: number;
} | null> {
  const fullText = `${subject} ${bodyText}`.substring(0, 10000);
  const result: {
    bauvorhabenId: string | null;
    bauvorhabenName: string | null;
    atbsNummer: string | null;
    rechnungsnummer: string | null;
    confidence: number;
  } = {
    bauvorhabenId: null,
    bauvorhabenName: null,
    atbsNummer: null,
    rechnungsnummer: null,
    confidence: 0
  };

  // ATBS-Nummer suchen
  const atbsMatch = fullText.match(PATTERNS.ATBS);
  if (atbsMatch) {
    const atbsNr = atbsMatch[1];
    result.atbsNummer = `ATBS-${atbsNr}`;

    // Suche BV in monday_bauprozess
    const { data: bvData } = await supabase
      .from('monday_bauprozess')
      .select('id, name')
      .or(`atbs_nr.eq.ATBS-${atbsNr},atbs_nr.eq.${atbsNr}`)
      .limit(1)
      .single();

    if (bvData) {
      result.bauvorhabenId = bvData.id;
      result.bauvorhabenName = bvData.name;
      result.confidence = 0.95;
    }
  }

  // Rechnungsnummer suchen
  const reMatch = fullText.match(PATTERNS.RE_NR);
  if (reMatch) {
    result.rechnungsnummer = `RE-${reMatch[1]}`;
    if (result.confidence === 0) result.confidence = 0.7;
  }

  return result.confidence > 0 ? result : null;
}

/**
 * Bestimmt Dokumenttyp basierend auf Keywords
 */
function determineDocTypeByContent(subject: string, bodyText: string): string | null {
  const fullText = `${subject} ${bodyText}`.toLowerCase();

  for (const [docType, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        return docType;
      }
    }
  }

  return null;
}

/**
 * Erstellt neuen Kontakt für unbekannten Absender
 */
async function createKontakt(fromAddress: string, fromName: string | null): Promise<string | null> {
  try {
    // Parse Name
    let vorname = '';
    let nachname = '';
    if (fromName) {
      const parts = fromName.trim().split(/\s+/);
      if (parts.length >= 2) {
        vorname = parts[0];
        nachname = parts.slice(1).join(' ');
      } else {
        nachname = fromName;
      }
    }

    // Erstelle Kontakt
    const { data, error } = await supabase
      .from('kontakte')
      .insert({
        vorname: vorname || null,
        nachname: nachname || fromAddress.split('@')[0],
        email: fromAddress,
        kontaktarten: ['unbekannt'],
        quelle: 'E-Mail-Import',
        notizen: `Automatisch angelegt aus E-Mail am ${new Date().toISOString().split('T')[0]}`
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Failed to create kontakt: ${error.message}`);
      return null;
    }

    // Füge Domain zu kontakt_domains hinzu
    const domain = extractDomain(fromAddress);
    if (domain) {
      await supabase.from('kontakt_domains').upsert({
        domain,
        kontakt_id: data.id,
        kontaktart: 'unbekannt',
        is_generic: false
      }, { onConflict: 'domain' });
    }

    return data.id;

  } catch (err) {
    console.error(`Error creating kontakt:`, err);
    return null;
  }
}

// ============== HAUPT-VERARBEITUNG ==============

async function processDocuments(batchSize: number = 20): Promise<ProcessResult> {
  const result: ProcessResult = {
    documents_processed: 0,
    matched_by_domain: 0,
    matched_by_pattern: 0,
    matched_by_postfach: 0,
    kontakte_created: 0,
    types_updated: 0,
    errors: []
  };

  try {
    // Hole unverarbeitete E-Mail-Dokumente (ohne Kontakt-Zuordnung)
    const { data: documents, error: docError } = await supabase
      .from('dokumente')
      .select(`
        id, dokument_nr, art_des_dokuments, datei_name, raw_text,
        absender_email_erkannt, absender_name_erkannt, metadata,
        kontakt_id, bauvorhaben_id
      `)
      .in('art_des_dokuments', ['E-MAIL', 'E-ANH', 'ER-S', 'AB'])
      .is('kontakt_id', null)
      .eq('quelle', 'E-Mail')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (docError || !documents) {
      result.errors.push(`Failed to load documents: ${docError?.message}`);
      return result;
    }

    console.log(`Processing ${documents.length} unmatched documents...`);

    for (const doc of documents as UnprocessedDocument[]) {
      result.documents_processed++;

      // Hole email_details für zusätzliche Infos
      const { data: emailDetail } = await supabase
        .from('email_details')
        .select('id, from_address, from_name, account_email, body_preview')
        .eq('dokument_id', doc.id)
        .single();

      const fromAddress = emailDetail?.from_address || doc.absender_email_erkannt || '';
      const fromName = emailDetail?.from_name || doc.absender_name_erkannt || '';
      const accountEmail = emailDetail?.account_email || doc.metadata?.postfach || '';
      const subject = doc.metadata?.email_subject || doc.datei_name || '';
      const bodyText = doc.raw_text || emailDetail?.body_preview || '';

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      // 1. DOMAIN-MATCHING (Priorität 1)
      if (fromAddress) {
        const domainMatch = await matchByDomain(fromAddress);
        if (domainMatch && domainMatch.kontaktId) {
          updates.kontakt_id = domainMatch.kontaktId;
          updates.match_methode = 'domain';
          updates.match_confidence = domainMatch.confidence;
          result.matched_by_domain++;
        }
      }

      // 2. PATTERN-MATCHING (Priorität 2)
      const patternMatch = await matchByPattern(subject, bodyText);
      if (patternMatch) {
        if (patternMatch.bauvorhabenId) {
          updates.bauvorhaben_id = patternMatch.bauvorhabenId;
          updates.bauvorhaben_name = patternMatch.bauvorhabenName;
        }
        if (patternMatch.atbsNummer) {
          updates.atbs_nummer_erkannt = patternMatch.atbsNummer;
        }
        if (patternMatch.rechnungsnummer) {
          updates.rechnungsnummer_erkannt = patternMatch.rechnungsnummer;
        }
        if (!updates.match_methode) {
          updates.match_methode = 'atbs';
          updates.match_confidence = patternMatch.confidence;
          result.matched_by_pattern++;
        }
      }

      // 3. POSTFACH-LOGIK (Priorität 3)
      if (accountEmail && POSTFACH_DEFAULTS[accountEmail]) {
        const postfachConfig = POSTFACH_DEFAULTS[accountEmail];

        // Dokumenttyp verfeinern wenn noch generisch
        if (['E-MAIL', 'E-ANH'].includes(doc.art_des_dokuments)) {
          // Prüfe Keywords für genaueren Typ
          const contentType = determineDocTypeByContent(subject, bodyText);
          if (contentType) {
            updates.art_des_dokuments = contentType;
            result.types_updated++;
          } else if (doc.art_des_dokuments === 'E-ANH' && postfachConfig.art !== 'E-MAIL') {
            // Anhänge bekommen Postfach-Default (z.B. ER-S für rechnungen@)
            updates.art_des_dokuments = postfachConfig.art;
            result.types_updated++;
          }
        }

        // Tags hinzufügen
        if (postfachConfig.tags && postfachConfig.tags.length > 0) {
          const existingKeywords = doc.metadata?.keywords || [];
          updates.keywords = [...new Set([...existingKeywords, ...postfachConfig.tags])];
        }

        if (!updates.match_methode) {
          updates.match_methode = 'postfach';
          updates.match_confidence = 0.7;
          result.matched_by_postfach++;
        }
      }

      // 4. KONTAKT-ANLAGE (falls kein Domain-Match)
      if (!updates.kontakt_id && fromAddress && !extractDomain(fromAddress).match(/(gmail|web\.de|gmx|yahoo|outlook|hotmail)/i)) {
        const newKontaktId = await createKontakt(fromAddress, fromName);
        if (newKontaktId) {
          updates.kontakt_id = newKontaktId;
          if (!updates.match_methode) {
            updates.match_methode = 'neu';
            updates.match_confidence = 0.5;
          }
          result.kontakte_created++;
        }
      }

      // 5. Update Dokument
      const { error: updateError } = await supabase
        .from('dokumente')
        .update(updates)
        .eq('id', doc.id);

      if (updateError) {
        result.errors.push(`Update failed for ${doc.dokument_nr}: ${updateError.message}`);
      }

      // Log
      await supabase.from('email_sync_log').insert({
        dokument_id: doc.id,
        action: 'process',
        status: updateError ? 'error' : 'success',
        error_message: updateError?.message,
        details: {
          match_methode: updates.match_methode,
          kontakt_id: updates.kontakt_id,
          bauvorhaben_id: updates.bauvorhaben_id,
          type_updated: updates.art_des_dokuments !== doc.art_des_dokuments
        }
      });

      // Rate limiting
      await new Promise(r => setTimeout(r, 50));
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Process error: ${errMsg}`);
  }

  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '20');

    console.log(`Email Process started (batch_size: ${batchSize})`);
    const startTime = Date.now();

    const result = await processDocuments(batchSize);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email process error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
