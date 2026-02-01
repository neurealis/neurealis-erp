/**
 * bewerbung-process: Automatische Verarbeitung von Bewerbungs-E-Mails
 *
 * Funktionen:
 * - Verarbeitet E-Mails von bewerbungen@neurealis.de
 * - Erkennt Quelle (Direkt, Stepstone, Indeed, Vermittler)
 * - Erstellt Bewerber-Datensätze mit KI-geparstem Lebenslauf
 * - Verknüpft Kontakte und Dokumente
 *
 * Trigger: Cron alle 10 Min (versetzt zu email-fetch)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI API
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

// ============== INTERFACES ==============

interface QuellenInfo {
  quelle: string;
  vermittler_name: string | null;
  vermittler_aktiv: boolean | null;
}

interface LebenslaufData {
  name: string | null;
  telefon: string | null;
  berufserfahrung_jahre: number | null;
  fuehrerschein: string | null;
  qualifikationen: {
    ausbildung?: string;
    meister?: boolean;
    zertifikate?: string[];
    letzte_position?: string;
    sprachen?: string[];
  };
  zusammenfassung: string | null;
}

interface ProcessResult {
  processed: number;
  created: number;
  duplicates: number;
  errors: string[];
}

interface EmailRecord {
  id: string;
  dokument_id: string;
  from_address: string;
  from_name: string | null;
  received_at: string;
  dokumente: {
    id: string;
    datei_name: string;
    raw_text: string | null;
    metadata: Record<string, any>;
  };
}

// ============== QUELLEN-ERKENNUNG ==============

const GENERIC_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'web.de', 'gmx.de', 'gmx.net',
  'yahoo.de', 'yahoo.com',
  'outlook.de', 'outlook.com', 'hotmail.com', 'hotmail.de',
  't-online.de', 'freenet.de', 'arcor.de', 'aol.com',
  'icloud.com', 'me.com', 'live.de', 'live.com',
  'posteo.de', 'mailbox.org', 'protonmail.com'
];

function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length > 1 ? parts[1] : '';
}

function toTitleCase(str: string): string {
  return str
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function erkenneQuelle(fromAddress: string, subject: string): QuellenInfo {
  const domain = extractDomain(fromAddress);
  const subjectLower = subject.toLowerCase();

  // Generische E-Mail-Provider → Direktbewerbung
  if (GENERIC_DOMAINS.includes(domain)) {
    return { quelle: 'Direkt', vermittler_name: null, vermittler_aktiv: null };
  }

  // Job-Portale
  if (domain.includes('stepstone')) {
    return { quelle: 'Stepstone', vermittler_name: null, vermittler_aktiv: null };
  }

  if (domain.includes('indeed')) {
    return { quelle: 'Indeed', vermittler_name: null, vermittler_aktiv: null };
  }

  if (domain.includes('linkedin')) {
    return { quelle: 'LinkedIn', vermittler_name: null, vermittler_aktiv: null };
  }

  if (domain.includes('xing')) {
    return { quelle: 'XING', vermittler_name: null, vermittler_aktiv: null };
  }

  // Bekannte Vermittler
  if (domain.includes('dibefa') || subjectLower.includes('dibefa')) {
    return { quelle: 'Vermittler', vermittler_name: 'DIBEFA', vermittler_aktiv: false };
  }

  if (domain.includes('zeitkraftsolutions')) {
    return { quelle: 'Vermittler', vermittler_name: 'zeitkraftsolutions', vermittler_aktiv: false };
  }

  if (domain.includes('tebb-talent') || domain.includes('tebb')) {
    return { quelle: 'Vermittler', vermittler_name: 'TEBB Talent', vermittler_aktiv: false };
  }

  if (domain.includes('handwerkspersonal') || domain.includes('abacent')) {
    return { quelle: 'Vermittler', vermittler_name: 'abacent personalservice', vermittler_aktiv: false };
  }

  // Unbekannte Firmen-Domain → wahrscheinlich Vermittler
  const firmenName = domain.split('.')[0];
  return {
    quelle: 'Vermittler',
    vermittler_name: toTitleCase(firmenName),
    vermittler_aktiv: false
  };
}

// ============== NAME & POSITION EXTRAKTION ==============

function extrahiereName(fromName: string | null, fromAddress: string, subject: string): string {
  // 1. Priorität: from_name (wenn nicht leer und nicht gleich E-Mail)
  if (fromName && fromName.trim().length > 2 && !fromName.includes('@')) {
    // Bereinige typische Prefixe
    return fromName
      .replace(/^(Bewerbung|Herr|Frau|Dr\.|Prof\.)\s*/i, '')
      .trim();
  }

  // 2. Priorität: Betreff parsen
  const betreffMatch = subject.match(/von\s+([A-ZÄÖÜa-zäöüß]+\s+[A-ZÄÖÜa-zäöüß]+)/i);
  if (betreffMatch) {
    return betreffMatch[1].trim();
  }

  // 3. Fallback: E-Mail-Prefix
  const prefix = fromAddress.split('@')[0];
  return prefix
    .replace(/[._-]/g, ' ')
    .split(' ')
    .filter(p => p.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extrahierePosition(subject: string, bodyText: string): string | null {
  // Patterns im Betreff
  const patterns = [
    /Bewerbung\s+als\s+([A-ZÄÖÜa-zäöüß\s\-\/]+?)(?:\s*[\(\[m\/wWdD]|$)/i,
    /Bewerbung\s+für\s+(?:die\s+Stelle\s+)?([A-ZÄÖÜa-zäöüß\s\-\/]+?)(?:\s*[\(\[m\/wWdD]|$)/i,
    /Stelle:\s*([A-ZÄÖÜa-zäöüß\s\-\/]+)/i,
    /Position:\s*([A-ZÄÖÜa-zäöüß\s\-\/]+)/i,
    /Bewerbung[:\s]+([A-ZÄÖÜa-zäöüß\s\-\/]+?)(?:\s*[\(\[m\/wWdD]|$)/i
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      let position = match[1].trim().substring(0, 100);
      // Entferne m/w/d und ähnliches
      position = position.replace(/\s*(m\/w\/d|m\/w|w\/m\/d|m\/w\/x|d\/m\/w)\s*/gi, '').trim();
      // Entferne Klammern am Ende
      position = position.replace(/\s*[\(\[].*$/, '').trim();
      if (position.length > 2) {
        return position;
      }
    }
  }

  // Fallback: Bekannte Positionen im Text suchen
  const BEKANNTE_POSITIONEN = [
    'Elektriker', 'Elektroniker', 'Elektroinstallateur', 'Elektrofachkraft',
    'Sanitärinstallateur', 'Anlagenmechaniker', 'Klempner', 'SHK',
    'Maler', 'Lackierer', 'Maler und Lackierer',
    'Fliesenleger', 'Bodenleger', 'Trockenbauer', 'Estrichleger',
    'Bauleiter', 'Projektleiter', 'Vorarbeiter', 'Polier',
    'Hausmeister', 'Objektbetreuer', 'Facility Manager',
    'Kaufmann', 'Kauffrau', 'Buchhalter', 'Bürokraft',
    'Servicetechniker', 'Monteur', 'Techniker'
  ];

  const fullText = `${subject} ${bodyText || ''}`.toLowerCase();
  for (const pos of BEKANNTE_POSITIONEN) {
    if (fullText.includes(pos.toLowerCase())) {
      return pos;
    }
  }

  // Kein Match gefunden - Betreff als Fallback (gekürzt)
  if (subject && subject.length > 5 && !subject.startsWith('(Kein Betreff)')) {
    return subject.substring(0, 80);
  }

  return null;
}

// ============== DUPLIKAT-CHECK ==============

async function findeDuplikat(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bewerber')
    .select('id')
    .eq('email', email.toLowerCase())
    .order('erstellt_am', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].id;
}

// ============== KONTAKT ERSTELLEN/VERKNÜPFEN ==============

async function erstelleOderVerknuepfeKontakt(
  bewerber: { name: string; email: string; telefon?: string | null }
): Promise<string> {
  // 1. Prüfe ob Kontakt existiert
  const { data: existingKontakt } = await supabase
    .from('kontakte')
    .select('id, kontaktarten')
    .eq('email', bewerber.email.toLowerCase())
    .limit(1);

  if (existingKontakt && existingKontakt.length > 0) {
    const kontakt = existingKontakt[0];
    // Füge 'Bewerber' zu kontaktarten hinzu falls nicht vorhanden
    const arten = kontakt.kontaktarten || [];
    if (!arten.includes('Bewerber')) {
      await supabase
        .from('kontakte')
        .update({
          kontaktarten: [...arten, 'Bewerber'],
          aktualisiert_am: new Date().toISOString()
        })
        .eq('id', kontakt.id);
    }
    return kontakt.id;
  }

  // 2. Parse Name
  const nameParts = bewerber.name.split(' ');
  const vorname = nameParts.length > 1 ? nameParts[0] : null;
  const nachname = nameParts.length > 1
    ? nameParts.slice(1).join(' ')
    : nameParts[0];

  // 3. Erstelle neuen Kontakt
  const { data: newKontakt, error } = await supabase
    .from('kontakte')
    .insert({
      vorname,
      nachname,
      email: bewerber.email.toLowerCase(),
      telefon_mobil: bewerber.telefon || null,
      kontaktarten: ['Bewerber'],
      notizen: `Automatisch aus Bewerbung erstellt am ${new Date().toISOString().split('T')[0]}`
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Kontakt-Erstellung fehlgeschlagen: ${error.message}`);
    throw new Error(`Kontakt-Erstellung fehlgeschlagen: ${error.message}`);
  }

  return newKontakt.id;
}

// ============== ANHÄNGE FINDEN ==============

async function findeAlleAnhaenge(parentDokumentId: string): Promise<string[]> {
  // Finde alle Dokumente mit parent_dokument_id = diese E-Mail
  const { data: anhaenge } = await supabase
    .from('dokumente')
    .select('id')
    .eq('metadata->>parent_dokument_id', parentDokumentId);

  const ids = [parentDokumentId];
  if (anhaenge) {
    ids.push(...anhaenge.map(a => a.id));
  }

  return ids;
}

// ============== LEBENSLAUF PDF FINDEN ==============

function isLebenslauf(filename: string): boolean {
  const lower = filename.toLowerCase();
  const patterns = [
    /lebenslauf/,
    /cv/,
    /curriculum/,
    /resume/,
    /bewerbung/,
    /profil/
  ];
  return patterns.some(p => p.test(lower));
}

async function findLebenslaufPdf(dokumentIds: string[]): Promise<{
  dokumentId: string;
  dateiUrl: string;
} | null> {
  // Hole alle PDF-Dokumente
  const { data: docs } = await supabase
    .from('dokumente')
    .select('id, datei_name, datei_url')
    .in('id', dokumentIds)
    .ilike('datei_name', '%.pdf');

  if (!docs || docs.length === 0) return null;

  // Priorisiere nach Dateinamen
  const lebenslauf = docs.find(d => isLebenslauf(d.datei_name || ''));
  if (lebenslauf && lebenslauf.datei_url) {
    return { dokumentId: lebenslauf.id, dateiUrl: lebenslauf.datei_url };
  }

  // Fallback: Erstes PDF (außer AGB etc.)
  const excludePatterns = ['agb', 'bedingung', 'vertrag', 'zeugnis', 'schulzeugnis'];
  const firstPdf = docs.find(d => {
    const name = (d.datei_name || '').toLowerCase();
    return d.datei_url && !excludePatterns.some(p => name.includes(p));
  });

  if (firstPdf) {
    return { dokumentId: firstPdf.id, dateiUrl: firstPdf.datei_url };
  }

  // Fallback: Irgendein PDF
  const anyPdf = docs.find(d => d.datei_url);
  if (anyPdf) {
    return { dokumentId: anyPdf.id, dateiUrl: anyPdf.datei_url };
  }

  return null;
}

// ============== PDF TEXT EXTRAKTION ==============

async function extractPdfText(pdfUrl: string): Promise<string> {
  try {
    // Lade PDF von Storage
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`PDF-Download fehlgeschlagen: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Nutze unpdf für Text-Extraktion
    const { getResolvedPDFJS } = await import('npm:unpdf@0.12.1');
    const pdfjs = await getResolvedPDFJS();

    const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';

    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { // Max 10 Seiten
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  } catch (err) {
    console.error('PDF-Extraktion fehlgeschlagen:', err);
    return '';
  }
}

// ============== KI-PARSING (LEBENSLAUF) ==============

async function parseLebenslaufMitKI(pdfText: string): Promise<LebenslaufData | null> {
  if (!pdfText || pdfText.length < 50) {
    console.log('PDF-Text zu kurz für KI-Parsing');
    return null;
  }

  const prompt = `Analysiere diesen Lebenslauf und extrahiere strukturierte Informationen.

LEBENSLAUF-TEXT:
${pdfText.substring(0, 12000)}

Extrahiere folgende Informationen im JSON-Format:

{
  "name": "Vor- und Nachname (null wenn nicht gefunden)",
  "telefon": "Mobilnummer oder Festnetz (null wenn nicht gefunden)",
  "berufserfahrung_jahre": 0,
  "fuehrerschein": "B, BE etc. (null wenn nicht gefunden)",
  "qualifikationen": {
    "ausbildung": "Hauptausbildung (z.B. Elektrikergeselle, Meister SHK)",
    "meister": false,
    "zertifikate": ["Staplerschein", "Schweißerschein", etc.],
    "letzte_position": "Letzte berufliche Position",
    "sprachen": ["Deutsch (Muttersprache)", "Englisch (Grundkenntnisse)"]
  },
  "zusammenfassung": "2-3 Sätze Zusammenfassung der wichtigsten Qualifikationen für Wohnungssanierung/Handwerk"
}

WICHTIG:
- Fokus auf handwerkliche Qualifikationen (Elektrik, Sanitär, Maler, Fliesen, Trockenbau)
- Berufserfahrung im Baugewerbe besonders hervorheben
- Führerschein ist wichtig (Baustellen erreichbar)
- Bei fehlenden Infos: null setzen, nicht erfinden
- zusammenfassung: Kurz und prägnant, auf Deutsch`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein HR-Assistent für ein Wohnungssanierungsunternehmen. Extrahiere strukturierte Daten aus Lebensläufen. Antworte NUR mit validem JSON.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Fehler:', errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Keine Antwort von OpenAI');
      return null;
    }

    const parsed = JSON.parse(content) as LebenslaufData;
    console.log('Lebenslauf geparst:', JSON.stringify(parsed, null, 2).substring(0, 500));
    return parsed;

  } catch (err) {
    console.error('KI-Parsing fehlgeschlagen:', err);
    return null;
  }
}

// ============== HAUPT-VERARBEITUNG ==============

async function verarbeiteBewerbungen(batchSize: number = 10): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    duplicates: 0,
    errors: []
  };

  // 1. Finde unverarbeitete Bewerbungs-E-Mails
  // Suche E-Mails die NOCH NICHT in bewerber.dokument_ids referenziert sind
  const { data: bewerbungsEmails, error: fetchError } = await supabase
    .from('email_details')
    .select(`
      id,
      dokument_id,
      from_address,
      from_name,
      received_at,
      dokumente!inner(
        id,
        datei_name,
        raw_text,
        metadata
      )
    `)
    .eq('dokumente.metadata->>postfach', 'bewerbungen@neurealis.de')
    .is('parent_email_id', null) // Nur Haupt-E-Mails, keine Anhänge
    .order('received_at', { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    result.errors.push(`Query-Fehler: ${fetchError.message}`);
    return result;
  }

  if (!bewerbungsEmails || bewerbungsEmails.length === 0) {
    console.log('Keine neuen Bewerbungen zu verarbeiten');
    return result;
  }

  console.log(`Prüfe ${bewerbungsEmails.length} Bewerbungen auf unverarbeitete...`);

  // Filtere bereits verarbeitete E-Mails (bewerber_id in metadata)
  const unverarbeitete = bewerbungsEmails.filter((email: EmailRecord) => {
    const metadata = email.dokumente?.metadata || {};
    return !metadata.bewerber_id;
  });

  if (unverarbeitete.length === 0) {
    console.log('Alle Bewerbungen bereits verarbeitet');
    return result;
  }

  console.log(`Verarbeite ${unverarbeitete.length} unverarbeitete Bewerbungen...`);

  for (const email of unverarbeitete as EmailRecord[]) {
    try {
      result.processed++;

      const dokument = email.dokumente;
      if (!dokument) {
        result.errors.push(`Kein Dokument für E-Mail ${email.id}`);
        continue;
      }

      const subject = dokument.metadata?.email_subject || dokument.datei_name || '';
      const bodyText = dokument.raw_text || '';

      console.log(`\nVerarbeite: ${email.from_address} - ${subject.substring(0, 50)}...`);

      // 2. Quellen-Erkennung
      const quellenInfo = erkenneQuelle(email.from_address, subject);
      console.log(`  Quelle: ${quellenInfo.quelle}${quellenInfo.vermittler_name ? ` (${quellenInfo.vermittler_name})` : ''}`);

      // 3. Name & Position extrahieren
      const name = extrahiereName(email.from_name, email.from_address, subject);
      const position = extrahierePosition(subject, bodyText);
      console.log(`  Name: ${name}, Position: ${position || '(nicht erkannt)'}`);

      // 4. Duplikat-Check
      const ursprungsId = await findeDuplikat(email.from_address);
      if (ursprungsId) {
        result.duplicates++;
        console.log(`  Duplikat erkannt (ursprungs_bewerber_id: ${ursprungsId})`);
      }

      // 5. Alle Anhänge sammeln
      const dokumentIds = await findeAlleAnhaenge(dokument.id);
      console.log(`  ${dokumentIds.length} Dokument(e) verknüpft`);

      // 6. Kontakt erstellen/verknüpfen
      let kontaktId: string | null = null;
      try {
        kontaktId = await erstelleOderVerknuepfeKontakt({
          name,
          email: email.from_address,
          telefon: null // Wird später aus Lebenslauf extrahiert
        });
        console.log(`  Kontakt: ${kontaktId}`);
      } catch (kontaktErr) {
        console.error(`  Kontakt-Fehler: ${kontaktErr}`);
        // Fahre trotzdem fort ohne Kontakt-Verknüpfung
      }

      // 7. Bewerber erstellen
      const { data: bewerber, error: bewerberError } = await supabase
        .from('bewerber')
        .insert({
          name,
          email: email.from_address.toLowerCase(),
          position,
          status: '(0) Erhalten',
          quelle: quellenInfo.quelle,
          vermittler_name: quellenInfo.vermittler_name,
          vermittler_aktiv: quellenInfo.vermittler_aktiv,
          ursprungs_bewerber_id: ursprungsId,
          kontakt_id: kontaktId,
          dokument_ids: dokumentIds,
          bewerbung_am: email.received_at ? email.received_at.split('T')[0] : new Date().toISOString().split('T')[0],
          erstellt_von: 'bewerbung-process'
        })
        .select('id')
        .single();

      if (bewerberError) {
        result.errors.push(`${email.from_address}: Bewerber-Erstellung fehlgeschlagen - ${bewerberError.message}`);
        continue;
      }

      result.created++;
      console.log(`  Bewerber erstellt: ${bewerber.id}`);

      // 8. Lebenslauf parsen (wenn PDF vorhanden)
      const lebenslaufPdf = await findLebenslaufPdf(dokumentIds);

      if (lebenslaufPdf) {
        console.log(`  Lebenslauf gefunden: ${lebenslaufPdf.dokumentId}`);
        try {
          const pdfText = await extractPdfText(lebenslaufPdf.dateiUrl);

          if (pdfText.length > 100) {
            const lebenslaufData = await parseLebenslaufMitKI(pdfText);

            if (lebenslaufData) {
              // Update Bewerber mit KI-Daten
              const updateData: Record<string, any> = {
                aktualisiert_am: new Date().toISOString()
              };

              if (lebenslaufData.telefon) {
                updateData.telefon = lebenslaufData.telefon;
              }
              if (lebenslaufData.zusammenfassung) {
                updateData.zusammenfassung = lebenslaufData.zusammenfassung;
              }
              if (lebenslaufData.qualifikationen) {
                updateData.qualifikationen = lebenslaufData.qualifikationen;
              }
              if (lebenslaufData.berufserfahrung_jahre !== null && lebenslaufData.berufserfahrung_jahre > 0) {
                updateData.berufserfahrung_jahre = lebenslaufData.berufserfahrung_jahre;
              }
              if (lebenslaufData.fuehrerschein) {
                updateData.fuehrerschein = lebenslaufData.fuehrerschein;
              }

              await supabase
                .from('bewerber')
                .update(updateData)
                .eq('id', bewerber.id);

              console.log(`  KI-Daten hinzugefügt`);

              // Update Kontakt mit Telefon
              if (kontaktId && lebenslaufData.telefon) {
                await supabase
                  .from('kontakte')
                  .update({
                    telefon_mobil: lebenslaufData.telefon,
                    aktualisiert_am: new Date().toISOString()
                  })
                  .eq('id', kontaktId);
              }
            }
          }
        } catch (pdfError) {
          console.error(`  PDF-Parsing fehlgeschlagen:`, pdfError);
          // Kein throw - Bewerbung wurde erstellt, nur PDF-Parsing fehlgeschlagen
        }
      }

      // 9. Dokumente mit Bewerber verknüpfen
      for (const docId of dokumentIds) {
        const { data: existingDoc } = await supabase
          .from('dokumente')
          .select('metadata')
          .eq('id', docId)
          .single();

        if (existingDoc) {
          await supabase
            .from('dokumente')
            .update({
              metadata: {
                ...(existingDoc.metadata || {}),
                bewerber_id: bewerber.id
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', docId);
        }
      }

      console.log(`  ✓ Bewerbung verarbeitet: ${name}`);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${email.from_address}: ${errMsg}`);
      console.error(`Fehler bei ${email.from_address}:`, errMsg);
    }

    // Rate Limiting (für OpenAI API)
    await new Promise(r => setTimeout(r, 500));
  }

  return result;
}

// ============== HTTP HANDLER ==============

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '10');

    console.log(`\n========================================`);
    console.log(`bewerbung-process gestartet`);
    console.log(`Batch-Size: ${batchSize}`);
    console.log(`Zeit: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    const startTime = Date.now();

    const result = await verarbeiteBewerbungen(batchSize);

    const response = {
      success: true,
      ...result,
      duration_ms: Date.now() - startTime
    };

    console.log(`\n========================================`);
    console.log(`Ergebnis:`);
    console.log(`  Verarbeitet: ${result.processed}`);
    console.log(`  Erstellt: ${result.created}`);
    console.log(`  Duplikate: ${result.duplicates}`);
    console.log(`  Fehler: ${result.errors.length}`);
    console.log(`  Dauer: ${response.duration_ms}ms`);
    console.log(`========================================\n`);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('bewerbung-process Fehler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
