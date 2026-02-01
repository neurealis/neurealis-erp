# Konzept: Edge Function `bewerbung-process`

**Version:** 1.0
**Erstellt:** 2026-02-01
**Status:** Konzept

---

## 1. Übersicht

Die Edge Function `bewerbung-process` verarbeitet automatisch Bewerbungs-E-Mails, die bereits über `email-fetch` importiert wurden. Sie erstellt Bewerber-Datensätze, verknüpft Kontakte, parst Lebensläufe mit KI und ordnet Dokumente zu.

### 1.1 Datenfluss

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        E-MAIL-IMPORT (bereits vorhanden)                │
├─────────────────────────────────────────────────────────────────────────┤
│  email-fetch                                                             │
│  └→ dokumente (art='E-MAIL' oder 'E-ANH')                               │
│  └→ email_details (from_address, from_name, account_email, etc.)        │
│  └→ Storage: email-attachments/{year}/{message_id}/{file}               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BEWERBUNG-PROCESS (NEU)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Finde unverarbeitete Bewerbungs-E-Mails                             │
│  2. Erkenne Quelle (Direkt, Stepstone, Indeed, Vermittler)              │
│  3. Erstelle/Aktualisiere Bewerber                                       │
│  4. Erstelle/Verknüpfe Kontakt                                          │
│  5. Parse Lebenslauf mit GPT-5.2                                         │
│  6. Verknüpfe alle Dokumente                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ERGEBNIS                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  bewerber                                                                │
│  ├── name, email, position, quelle, vermittler                          │
│  ├── kontakt_id → kontakte                                              │
│  ├── qualifikationen (JSONB)                                            │
│  ├── zusammenfassung (Text)                                             │
│  └── dokument_ids[] → dokumente                                         │
│                                                                          │
│  kontakte                                                                │
│  └── kontaktarten: ['Bewerber']                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DB-Schema

### 2.1 Neue Tabelle: `bewerber`

```sql
CREATE TABLE bewerber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bewerber_nr SERIAL UNIQUE,

  -- Stammdaten
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  telefon TEXT,

  -- Bewerbung
  position TEXT,
  quelle TEXT NOT NULL,  -- 'direkt', 'stepstone', 'indeed', 'vermittler'
  vermittler TEXT,       -- Name des Vermittlers (z.B. 'DIBEFA', 'zeitkraftsolutions')
  aktiv BOOLEAN DEFAULT true,

  -- Duplikat-Handling
  ursprungs_bewerber_id UUID REFERENCES bewerber(id),

  -- KI-Extraktion aus Lebenslauf
  qualifikationen JSONB DEFAULT '{}',
  zusammenfassung TEXT,

  -- Verknüpfungen
  kontakt_id UUID REFERENCES kontakte(id),
  dokument_ids TEXT[] DEFAULT '{}',  -- Array von dokumente.id

  -- Status
  status TEXT DEFAULT 'neu',
  status_updated_at TIMESTAMPTZ,

  -- Metadaten
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX idx_bewerber_email ON bewerber(email);
CREATE INDEX idx_bewerber_status ON bewerber(status);
CREATE INDEX idx_bewerber_quelle ON bewerber(quelle);
CREATE INDEX idx_bewerber_created ON bewerber(created_at DESC);

-- RLS
ALTER TABLE bewerber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read bewerber" ON bewerber
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage bewerber" ON bewerber
  FOR ALL TO service_role USING (true);
```

### 2.2 Qualifikationen-Schema (JSONB)

```json
{
  "ausbildung": [
    {
      "bezeichnung": "Elektrikermeister",
      "institution": "HWK Dortmund",
      "jahr": 2015
    }
  ],
  "zertifikate": [
    "Führerschein Klasse B",
    "Staplerschein",
    "Schweißerschein"
  ],
  "berufserfahrung_jahre": 8,
  "fuehrerschein": "B, BE",
  "sprachen": ["Deutsch (Muttersprache)", "Englisch (Grundkenntnisse)"],
  "letzte_position": "Vorarbeiter Elektrik bei XYZ GmbH",
  "gehaltsvorstellung": "3.500 € brutto"
}
```

### 2.3 Status-Werte

| Status | Bedeutung |
|--------|-----------|
| `neu` | Neue Bewerbung, noch nicht gesichtet |
| `gesichtet` | HR hat Bewerbung angeschaut |
| `eingeladen` | Bewerber wurde zum Gespräch eingeladen |
| `abgesagt` | Absage erteilt |
| `eingestellt` | Bewerber wurde eingestellt |
| `pool` | Für spätere Positionen vormerken |

---

## 3. Quellen-Erkennung

### 3.1 Mapping-Tabelle

| Absender-Pattern | Quelle | Vermittler | Aktiv |
|------------------|--------|------------|-------|
| `@gmail.com`, `@web.de`, `@gmx.de`, `@yahoo.de`, `@outlook.de`, `@t-online.de` | `direkt` | - | true |
| `@email.stepstone.de` | `stepstone` | - | true |
| `@indeed.com`, `@indeedemail.com` | `indeed` | - | true |
| `@dibefa.de`, "DIBEFA" im Betreff | `vermittler` | DIBEFA | false |
| `@zeitkraftsolutions.com` | `vermittler` | zeitkraftsolutions | false |
| Sonstige Firmen-Domains | `vermittler` | (aus Domain extrahiert) | false |

### 3.2 Pseudocode: Quellen-Erkennung

```typescript
interface QuellenInfo {
  quelle: 'direkt' | 'stepstone' | 'indeed' | 'vermittler';
  vermittler: string | null;
  aktiv: boolean;
}

function erkenneQuelle(fromAddress: string, subject: string): QuellenInfo {
  const domain = extractDomain(fromAddress).toLowerCase();
  const subjectLower = subject.toLowerCase();

  // Generische E-Mail-Provider → Direktbewerbung
  const GENERIC_DOMAINS = [
    'gmail.com', 'googlemail.com',
    'web.de', 'gmx.de', 'gmx.net',
    'yahoo.de', 'yahoo.com',
    'outlook.de', 'outlook.com', 'hotmail.com', 'hotmail.de',
    't-online.de', 'freenet.de', 'arcor.de', 'aol.com'
  ];

  if (GENERIC_DOMAINS.includes(domain)) {
    return { quelle: 'direkt', vermittler: null, aktiv: true };
  }

  // Job-Portale
  if (domain.includes('stepstone')) {
    return { quelle: 'stepstone', vermittler: null, aktiv: true };
  }

  if (domain.includes('indeed')) {
    return { quelle: 'indeed', vermittler: null, aktiv: true };
  }

  // Bekannte Vermittler
  if (domain.includes('dibefa') || subjectLower.includes('dibefa')) {
    return { quelle: 'vermittler', vermittler: 'DIBEFA', aktiv: false };
  }

  if (domain.includes('zeitkraftsolutions')) {
    return { quelle: 'vermittler', vermittler: 'zeitkraftsolutions', aktiv: false };
  }

  // Unbekannte Firmen-Domain → wahrscheinlich Vermittler
  // Extrahiere Firmenname aus Domain (z.B. "personal-muller.de" → "personal-muller")
  const firmenName = domain.split('.')[0].replace(/-/g, ' ');
  return {
    quelle: 'vermittler',
    vermittler: toTitleCase(firmenName),
    aktiv: false
  };
}
```

---

## 4. Bewerber-Erstellung

### 4.1 Name-Extraktion

```typescript
function extrahiereName(fromName: string | null, fromAddress: string, subject: string): string {
  // 1. Priorität: from_name
  if (fromName && fromName.trim().length > 2) {
    // Bereinige typische Prefixe
    return fromName
      .replace(/^(Bewerbung|Herr|Frau|Dr\.|Prof\.)\s*/i, '')
      .trim();
  }

  // 2. Priorität: Betreff parsen
  // Pattern: "Bewerbung als X von Max Mustermann"
  const betreffMatch = subject.match(/von\s+([A-ZÄÖÜa-zäöüß]+\s+[A-ZÄÖÜa-zäöüß]+)/i);
  if (betreffMatch) {
    return betreffMatch[1].trim();
  }

  // 3. Fallback: E-Mail-Prefix
  // max.mustermann@gmail.com → Max Mustermann
  const prefix = fromAddress.split('@')[0];
  return prefix
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
```

### 4.2 Position-Extraktion

```typescript
function extrahierePosition(subject: string, bodyText: string): string | null {
  // Pattern im Betreff
  const patterns = [
    /Bewerbung\s+als\s+([A-ZÄÖÜa-zäöüß\s\-\/]+)/i,
    /Bewerbung\s+für\s+(?:die\s+Stelle\s+)?([A-ZÄÖÜa-zäöüß\s\-\/]+)/i,
    /Stelle:\s*([A-ZÄÖÜa-zäöüß\s\-\/]+)/i,
    /Position:\s*([A-ZÄÖÜa-zäöüß\s\-\/]+)/i
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      // Bereinige Ergebnis (max 50 Zeichen, keine Sonderzeichen)
      let position = match[1].trim().substring(0, 50);
      position = position.replace(/\s*(m\/w\/d|m\/w|w\/m\/d)\s*/gi, '').trim();
      return position || null;
    }
  }

  // Fallback: Bekannte Positionen im Text suchen
  const BEKANNTE_POSITIONEN = [
    'Elektriker', 'Elektroniker', 'Elektroinstallateur',
    'Sanitärinstallateur', 'Anlagenmechaniker', 'Klempner',
    'Maler', 'Lackierer', 'Maler und Lackierer',
    'Fliesenleger', 'Bodenleger', 'Trockenbauer',
    'Bauleiter', 'Projektleiter', 'Vorarbeiter',
    'Hausmeister', 'Objektbetreuer', 'Facility Manager',
    'Kaufmann', 'Kauffrau', 'Buchhalter', 'Bürokraft'
  ];

  const fullText = `${subject} ${bodyText}`.toLowerCase();
  for (const pos of BEKANNTE_POSITIONEN) {
    if (fullText.includes(pos.toLowerCase())) {
      return pos;
    }
  }

  return null;
}
```

### 4.3 Duplikat-Check

```typescript
async function findeDuplikat(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bewerber')
    .select('id')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.id;
}
```

---

## 5. Kontakt-Erstellung

### 5.1 Pseudocode

```typescript
async function erstelleOderVerknuepfeKontakt(
  bewerber: { name: string; email: string; telefon?: string }
): Promise<string> {
  // 1. Prüfe ob Kontakt existiert
  const { data: existingKontakt } = await supabase
    .from('kontakte')
    .select('id, kontaktarten')
    .eq('email', bewerber.email.toLowerCase())
    .single();

  if (existingKontakt) {
    // Füge 'Bewerber' zu kontaktarten hinzu falls nicht vorhanden
    const arten = existingKontakt.kontaktarten || [];
    if (!arten.includes('Bewerber')) {
      await supabase
        .from('kontakte')
        .update({
          kontaktarten: [...arten, 'Bewerber'],
          updated_at: new Date().toISOString()
        })
        .eq('id', existingKontakt.id);
    }
    return existingKontakt.id;
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
      quelle: 'Bewerbung',
      notizen: `Automatisch aus Bewerbung erstellt am ${new Date().toISOString().split('T')[0]}`
    })
    .select('id')
    .single();

  if (error) throw new Error(`Kontakt-Erstellung fehlgeschlagen: ${error.message}`);
  return newKontakt.id;
}
```

---

## 6. KI-Parsing (Lebenslauf)

### 6.1 PDF-Erkennung

```typescript
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

  // Fallback: Erstes PDF
  const firstPdf = docs.find(d => d.datei_url);
  if (firstPdf) {
    return { dokumentId: firstPdf.id, dateiUrl: firstPdf.datei_url };
  }

  return null;
}
```

### 6.2 PDF-Text-Extraktion

```typescript
async function extractPdfText(pdfUrl: string): Promise<string> {
  // Lade PDF von Storage
  const response = await fetch(pdfUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Nutze unpdf für Text-Extraktion
  const { getResolvedPDFJS } = await import('npm:unpdf@0.12.1');
  const pdfjs = await getResolvedPDFJS();

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText;
}
```

### 6.3 GPT-5.2 Parsing

```typescript
interface LebenslaufData {
  name_vollstaendig: string;
  telefon: string | null;
  mobil: string | null;
  qualifikationen: {
    ausbildung: Array<{ bezeichnung: string; institution?: string; jahr?: number }>;
    zertifikate: string[];
    berufserfahrung_jahre: number;
    fuehrerschein: string | null;
    sprachen: string[];
    letzte_position: string | null;
  };
  zusammenfassung: string;
}

async function parseLebenslaufMitKI(pdfText: string): Promise<LebenslaufData | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  const prompt = `Analysiere diesen Lebenslauf und extrahiere strukturierte Informationen.

LEBENSLAUF-TEXT:
${pdfText.substring(0, 15000)}

Extrahiere folgende Informationen im JSON-Format:

{
  "name_vollstaendig": "Vor- und Nachname",
  "telefon": "Festnetznummer (null wenn nicht gefunden)",
  "mobil": "Mobilnummer (null wenn nicht gefunden)",
  "qualifikationen": {
    "ausbildung": [
      {
        "bezeichnung": "z.B. Elektrikermeister, Gesellenbrief Sanitär",
        "institution": "z.B. HWK Dortmund",
        "jahr": 2015
      }
    ],
    "zertifikate": ["Staplerschein", "Schweißerschein", etc.],
    "berufserfahrung_jahre": 8,
    "fuehrerschein": "B, BE (null wenn nicht gefunden)",
    "sprachen": ["Deutsch (Muttersprache)", "Englisch (Grundkenntnisse)"],
    "letzte_position": "Letzte berufliche Position mit Firma"
  },
  "zusammenfassung": "2-3 Sätze Zusammenfassung der wichtigsten Qualifikationen und Erfahrungen für Wohnungssanierung/Handwerk"
}

WICHTIG:
- Fokus auf handwerkliche Qualifikationen (Elektrik, Sanitär, Maler, Fliesen, Trockenbau)
- Berufserfahrung im Baugewerbe besonders hervorheben
- Führerschein ist wichtig (Baustellen erreichbar)
- Bei fehlenden Infos: null setzen, nicht erfinden
- Zusammenfassung: Kurz und prägnant, für HR optimiert`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: 'Du bist ein HR-Assistent für ein Wohnungssanierungsunternehmen. Extrahiere strukturierte Daten aus Lebensläufen.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    console.error('OpenAI API Fehler:', await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) return null;

  try {
    return JSON.parse(content) as LebenslaufData;
  } catch {
    console.error('JSON-Parsing fehlgeschlagen:', content);
    return null;
  }
}
```

---

## 7. Dokument-Verknüpfung

### 7.1 Anhänge finden

```typescript
async function findeAlleAnhaenge(emailDokumentId: string): Promise<string[]> {
  // Finde alle Dokumente mit parent_dokument_id = diese E-Mail
  const { data: anhaenge } = await supabase
    .from('dokumente')
    .select('id')
    .eq('metadata->>parent_dokument_id', emailDokumentId);

  const ids = [emailDokumentId];
  if (anhaenge) {
    ids.push(...anhaenge.map(a => a.id));
  }

  return ids;
}
```

---

## 8. Haupt-Workflow

### 8.1 Pseudocode

```typescript
interface ProcessResult {
  bewerbungen_verarbeitet: number;
  bewerber_erstellt: number;
  kontakte_erstellt: number;
  lebenslaeufe_geparst: number;
  duplikate_erkannt: number;
  fehler: string[];
}

async function verarbeiteBewerbungen(batchSize: number = 10): Promise<ProcessResult> {
  const result: ProcessResult = {
    bewerbungen_verarbeitet: 0,
    bewerber_erstellt: 0,
    kontakte_erstellt: 0,
    lebenslaeufe_geparst: 0,
    duplikate_erkannt: 0,
    fehler: []
  };

  // 1. Finde unverarbeitete Bewerbungs-E-Mails
  const { data: bewerbungsEmails } = await supabase
    .from('email_details')
    .select(`
      id, dokument_id, from_address, from_name,
      dokumente!inner(id, datei_name, raw_text, metadata)
    `)
    .eq('account_email', 'bewerbungen@neurealis.de')
    .is('dokumente.metadata->>bewerber_id', null)  // Noch nicht verarbeitet
    .order('received_at', { ascending: true })
    .limit(batchSize);

  if (!bewerbungsEmails || bewerbungsEmails.length === 0) {
    console.log('Keine neuen Bewerbungen zu verarbeiten');
    return result;
  }

  console.log(`Verarbeite ${bewerbungsEmails.length} Bewerbungen...`);

  for (const email of bewerbungsEmails) {
    try {
      result.bewerbungen_verarbeitet++;

      const dokument = email.dokumente;
      const subject = dokument.metadata?.email_subject || dokument.datei_name || '';
      const bodyText = dokument.raw_text || '';

      // 2. Quellen-Erkennung
      const quellenInfo = erkenneQuelle(email.from_address, subject);

      // 3. Name & Position extrahieren
      const name = extrahiereName(email.from_name, email.from_address, subject);
      const position = extrahierePosition(subject, bodyText);

      // 4. Duplikat-Check
      const ursprungsId = await findeDuplikat(email.from_address);
      if (ursprungsId) {
        result.duplikate_erkannt++;
        console.log(`Duplikat erkannt für ${email.from_address}`);
      }

      // 5. Alle Anhänge sammeln
      const dokumentIds = await findeAlleAnhaenge(dokument.id);

      // 6. Kontakt erstellen/verknüpfen
      const kontaktId = await erstelleOderVerknuepfeKontakt({
        name,
        email: email.from_address,
        telefon: undefined // Wird später aus Lebenslauf extrahiert
      });

      if (!ursprungsId) {
        result.kontakte_erstellt++;
      }

      // 7. Bewerber erstellen
      const { data: bewerber, error: bewerberError } = await supabase
        .from('bewerber')
        .insert({
          name,
          email: email.from_address.toLowerCase(),
          position,
          quelle: quellenInfo.quelle,
          vermittler: quellenInfo.vermittler,
          aktiv: quellenInfo.aktiv,
          ursprungs_bewerber_id: ursprungsId,
          kontakt_id: kontaktId,
          dokument_ids: dokumentIds,
          status: 'neu',
          metadata: {
            email_subject: subject,
            processed_at: new Date().toISOString()
          }
        })
        .select('id')
        .single();

      if (bewerberError) {
        throw new Error(`Bewerber-Erstellung fehlgeschlagen: ${bewerberError.message}`);
      }

      result.bewerber_erstellt++;

      // 8. Lebenslauf parsen (wenn PDF vorhanden)
      const lebenslaufPdf = await findLebenslaufPdf(dokumentIds);

      if (lebenslaufPdf) {
        try {
          const pdfText = await extractPdfText(lebenslaufPdf.dateiUrl);
          const lebenslaufData = await parseLebenslaufMitKI(pdfText);

          if (lebenslaufData) {
            // Update Bewerber mit KI-Daten
            await supabase
              .from('bewerber')
              .update({
                telefon: lebenslaufData.mobil || lebenslaufData.telefon,
                qualifikationen: lebenslaufData.qualifikationen,
                zusammenfassung: lebenslaufData.zusammenfassung,
                updated_at: new Date().toISOString()
              })
              .eq('id', bewerber.id);

            // Update Kontakt mit Telefon
            if (lebenslaufData.mobil || lebenslaufData.telefon) {
              await supabase
                .from('kontakte')
                .update({
                  telefon_mobil: lebenslaufData.mobil,
                  telefon_festnetz: lebenslaufData.telefon,
                  updated_at: new Date().toISOString()
                })
                .eq('id', kontaktId);
            }

            result.lebenslaeufe_geparst++;
          }
        } catch (pdfError) {
          console.error(`PDF-Parsing fehlgeschlagen für ${lebenslaufPdf.dokumentId}:`, pdfError);
          // Kein throw - Bewerbung wurde erstellt, nur PDF-Parsing fehlgeschlagen
        }
      }

      // 9. Dokumente mit Bewerber verknüpfen
      await supabase
        .from('dokumente')
        .update({
          metadata: {
            ...dokument.metadata,
            bewerber_id: bewerber.id
          },
          updated_at: new Date().toISOString()
        })
        .in('id', dokumentIds);

      console.log(`Bewerber erstellt: ${name} (${email.from_address})`);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.fehler.push(`${email.from_address}: ${errMsg}`);
      console.error(`Fehler bei ${email.from_address}:`, errMsg);
    }

    // Rate Limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return result;
}
```

---

## 9. Edge Function Handler

```typescript
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '10');

    console.log(`bewerbung-process gestartet (batch_size: ${batchSize})`);
    const startTime = Date.now();

    const result = await verarbeiteBewerbungen(batchSize);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: Date.now() - startTime
    }), {
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
```

---

## 10. Cron-Job

```sql
-- Cron: alle 10 Minuten (versetzt zu email-fetch)
SELECT cron.schedule(
  'bewerbung-process-job',
  '3,13,23,33,43,53 * * * *',  -- Minuten 3, 13, 23, etc. (versetzt zu email-fetch)
  $$
  SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/bewerbung-process',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"batch_size": 10}'
  );
  $$
);
```

**Alternative: Nach email-fetch triggern:**

```typescript
// In email-fetch nach erfolgreichem Sync:
if (account.email_address === 'bewerbungen@neurealis.de' && result.emails_created > 0) {
  // Trigger bewerbung-process
  await fetch(`${supabaseUrl}/functions/v1/bewerbung-process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ batch_size: result.emails_created })
  });
}
```

---

## 11. Abhängigkeiten

### 11.1 Npm-Packages (Deno Import)

```typescript
// PDF-Parsing
import { getResolvedPDFJS } from 'npm:unpdf@0.12.1';

// Supabase
import { createClient } from 'jsr:@supabase/supabase-js@2';
```

### 11.2 Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `SUPABASE_URL` | Supabase Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key |
| `OPENAI_API_KEY` | OpenAI API Key für GPT-5.2 |

---

## 12. Nächste Schritte

1. **Migration erstellen:** `bewerber` Tabelle anlegen
2. **Edge Function implementieren:** `bewerbung-process`
3. **Cron-Job einrichten:** Nach email-fetch triggern
4. **UI erstellen:** Bewerber-Übersicht in SvelteKit
5. **Softr-Sync:** Falls Softr-Integration gewünscht

---

*Erstellt: 2026-02-01*
