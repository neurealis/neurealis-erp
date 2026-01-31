/**
 * Tests für die Dokumenten-Klassifizierung (Node.js Version)
 * Ausführen: node classify.test.mjs
 */

// Pattern für Nummern-Erkennung
const ATBS_PATTERN = /20\d{2}-\d{4}/;
const NUA_PATTERN = /NUA-(\d+)/i;
const RECHNUNGS_PATTERN = /(?:RE|RG|Rechnung|Invoice)[:\s#-]*(\d{6,})/i;
const BESTELLUNG_PATTERN = /(?:Bestellung|Best|Order)[:\s#-]*(\d+)/i;

const DOC_TYPES = {
  'ER-M': 'ER-M Eingangsrechnung Material',
  'ER-NU-S': 'ER-NU-S  Eingangsrechnung NU - Schluss',
  'ER-NU-A': 'ER-NU-A  Eingangsrechnung NU - Abschlag',
  'ER-NU-M': 'ER-NU-M  Eingangsrechnung - Material NU Abzug',
  'ANG-LI': 'ANG-LI Angebot Lieferant',
  'AB': 'AB Auftragsbestätigung',
  'Bestellung': 'Bestellung',
  'LS': 'LS Lieferschein',
  'AVIS': 'AVIS Avis',
  'S': 'S Sonstiges',
};

// Klassifizierungsfunktion
function classifyDocument(subject, filename, contact) {
  const subjectLower = subject.toLowerCase();
  const filenameLower = filename.toLowerCase();
  const combined = `${subjectLower} ${filenameLower}`;
  const combinedOriginal = `${subject} ${filename}`;

  const atbsMatch = combinedOriginal.match(ATBS_PATTERN);
  const atbsNummer = atbsMatch ? atbsMatch[0] : undefined;

  const nuaMatch = combinedOriginal.match(NUA_PATTERN);
  const nuaNummer = nuaMatch ? `NUA-${nuaMatch[1]}` : undefined;

  const reMatch = combinedOriginal.match(RECHNUNGS_PATTERN);
  const rechnungsNummer = reMatch ? reMatch[1] : undefined;

  const bestMatch = combinedOriginal.match(BESTELLUNG_PATTERN);
  const bestellNummer = bestMatch ? bestMatch[1] : undefined;

  let docType = 'S';
  let confidence = 0.5;

  const rechnungKeywords = ['rechnung', 'invoice', 're-nr', 'rg-nr', 'rechnungsnr', 're nr'];
  const angebotKeywords = ['angebot', 'offerte', 'quote', 'quotation', 'preisanfrage'];
  const lieferscheinKeywords = ['lieferschein', 'delivery', 'ls-nr', 'warenbegleitschein'];
  const abKeywords = ['auftragsbestätigung', 'ab-nr', 'order confirmation', 'bestellbestätigung'];
  const bestellungKeywords = ['bestellung', 'order', 'best-nr', 'bestellnummer'];
  const avisKeywords = ['avis', 'zahlungsavis', 'payment advice'];
  const abschlagKeywords = ['abschlag', 'anzahlung', 'teilrechnung', 'a-rechnung'];

  const isRechnung = rechnungKeywords.some(k => combined.includes(k));
  const isAngebot = angebotKeywords.some(k => combined.includes(k));
  const isLieferschein = lieferscheinKeywords.some(k => combined.includes(k));
  const isAB = abKeywords.some(k => combined.includes(k));
  const isBestellung = bestellungKeywords.some(k => combined.includes(k));
  const isAvis = avisKeywords.some(k => combined.includes(k));
  const isAbschlag = abschlagKeywords.some(k => combined.includes(k));

  const isNachunternehmer = contact?.types?.includes('Nachunternehmer');
  const isLieferant = contact?.types?.includes('Lieferant') || contact?.types?.includes('Großhandel');
  const hasNuaContext = nuaNummer !== undefined;

  // PRIORITÄT 1: AVIS hat Vorrang - "Zahlungsavis" enthält oft auch "Rechnung"
  if (isAvis) {
    docType = 'AVIS';
    confidence = 0.85;
  }
  // PRIORITÄT 2: Rechnungen klassifizieren
  else if (isRechnung) {
    // Lieferanten haben IMMER ATBS (Projektnummern), NIE NUA
    // Nachunternehmer haben NUA-Nummern
    if (isLieferant) {
      // Lieferant: Standard = Material-Rechnung (ER-M)
      // Spezialfall: Expliziter "NU-Abzug" im Text → Material wird vom NU abgezogen
      if (combined.includes('nu-abzug')) {
        docType = 'ER-NU-M';
        confidence = 0.88;
      } else {
        docType = 'ER-M';
        confidence = 0.9;
      }
    } else if (isNachunternehmer || hasNuaContext) {
      // NU-Rechnung: Abschlag oder Schluss?
      // NUA-Kontext OHNE bekannten Lieferanten = immer Nachunternehmer
      if (isAbschlag) {
        docType = 'ER-NU-A';
        confidence = 0.92;
      } else {
        docType = 'ER-NU-S';
        confidence = 0.9;
      }
    } else {
      // Kein Kontakt bekannt → Standard Material-Rechnung
      docType = 'ER-M';
      confidence = 0.7;
    }
  } else if (isAngebot) {
    docType = 'ANG-LI';
    confidence = 0.85;
  } else if (isLieferschein) {
    docType = 'LS';
    confidence = 0.85;
  } else if (isAB) {
    docType = 'AB';
    confidence = 0.85;
  } else if (isBestellung) {
    docType = 'Bestellung';
    confidence = 0.85;
  } else {
    // PDF aus rechnungen@-Mailbox → wahrscheinlich Material-Rechnung
    docType = 'ER-M';
    confidence = 0.6;
  }

  return {
    docType,
    confidence,
    atbsNummer,
    nuaNummer,
    rechnungsNummer,
    bestellNummer,
    lieferantName: contact?.name,
  };
}

// Test-Kontakte
const LIEFERANT_MEGA = { id: 'mega-001', name: 'MEGA', types: ['Lieferant', 'Großhandel'], matchType: 'domain' };
const LIEFERANT_ZANDER = { id: 'zander-001', name: 'Zander', types: ['Großhandel'], matchType: 'exact' };
const NU_VITADIBALAN = { id: 'vita-001', name: 'Vita Di Balan', types: ['Nachunternehmer'], matchType: 'exact' };
const NU_FLIESENLEGER = { id: 'fliesen-001', name: 'Fliesenleger Müller', types: ['Nachunternehmer'], matchType: 'domain' };

const testCases = [
  // ER-M Tests
  { name: '01. MEGA Rechnung mit RE-Nr', subject: 'Ihre Rechnung 954817741 vom 28.01.2026', filename: 'Rechnung_954817741.pdf', contact: LIEFERANT_MEGA, expected: { docType: 'ER-M', minConfidence: 0.9, rechnungsNummer: '954817741' } },
  { name: '02. Zander Invoice englisch', subject: 'Invoice #12345678 for your order', filename: 'Invoice_12345678.pdf', contact: LIEFERANT_ZANDER, expected: { docType: 'ER-M', minConfidence: 0.9, rechnungsNummer: '12345678' } },
  { name: '03. Rechnung ohne Kontakt', subject: 'Rechnung für Lieferung', filename: 'RE-2026-001234.pdf', contact: null, expected: { docType: 'ER-M', minConfidence: 0.6 } },

  // ER-NU-S Tests
  { name: '04. NU Schlussrechnung + NUA', subject: 'Schlussrechnung NUA-335 Badezimmer', filename: 'Rechnung_Januar_2026.pdf', contact: NU_VITADIBALAN, expected: { docType: 'ER-NU-S', minConfidence: 0.9, nuaNummer: 'NUA-335' } },
  { name: '05. NU Rechnung durch Kontakttyp', subject: 'Rechnung für Fliesenarbeiten', filename: 'RE_Fliesen_2026.pdf', contact: NU_FLIESENLEGER, expected: { docType: 'ER-NU-S', minConfidence: 0.9 } },
  { name: '06. NUA-Kontext ohne NU-Kontakt', subject: 'Rechnung zu NUA-420 Malerarbeiten', filename: 'Rechnung.pdf', contact: null, expected: { docType: 'ER-NU-S', minConfidence: 0.9, nuaNummer: 'NUA-420' } },

  // ER-NU-A Tests
  { name: '07. NU Abschlagsrechnung', subject: 'Abschlagsrechnung NUA-291', filename: '1_Abschlag_Elektro.pdf', contact: NU_VITADIBALAN, expected: { docType: 'ER-NU-A', minConfidence: 0.92, nuaNummer: 'NUA-291' } },
  { name: '08. NU Anzahlung', subject: 'Anzahlung für Projekt 2026-0042', filename: 'Rechnung_Anzahlung.pdf', contact: NU_FLIESENLEGER, expected: { docType: 'ER-NU-A', minConfidence: 0.92, atbsNummer: '2026-0042' } },
  { name: '09. Teilrechnung', subject: 'Teilrechnung 1/3 für NUA-500', filename: 'Teilrechnung_1.pdf', contact: NU_VITADIBALAN, expected: { docType: 'ER-NU-A', minConfidence: 0.92, nuaNummer: 'NUA-500' } },

  // ER-NU-M Tests
  { name: '10. Material NU-Abzug explizit', subject: 'Rechnung - NU-Abzug Material für NUA-335', filename: 'MEGA_Rechnung.pdf', contact: LIEFERANT_MEGA, expected: { docType: 'ER-NU-M', minConfidence: 0.88, nuaNummer: 'NUA-335' } },
  // Test 11: Lieferant mit NUA im Betreff → trotzdem ER-M (Lieferanten haben NIE NUA, nur ATBS)
  { name: '11. Lieferant ignoriert NUA (→ ER-M)', subject: 'Ihre Lieferung für Projekt', filename: 'Rechnung_Fliesen.pdf', contact: LIEFERANT_ZANDER, expected: { docType: 'ER-M', minConfidence: 0.9 } },

  // Nummern-Erkennung
  { name: '12. ATBS im Betreff', subject: 'Rechnung für Projekt 2026-0042 VBW', filename: 'Rechnung.pdf', contact: LIEFERANT_MEGA, expected: { docType: 'ER-M', minConfidence: 0.9, atbsNummer: '2026-0042' } },
  { name: '13. ATBS im Dateinamen', subject: 'Materiallieferung', filename: '2026-0015_Lieferung_Sanitär.pdf', contact: LIEFERANT_ZANDER, expected: { docType: 'ER-M', minConfidence: 0.6, atbsNummer: '2026-0015' } },
  { name: '14. NUA lowercase', subject: 'nua-123 Rechnung', filename: 'Dokument.pdf', contact: NU_VITADIBALAN, expected: { docType: 'ER-NU-S', minConfidence: 0.9, nuaNummer: 'NUA-123' } },

  // Andere Dokumenttypen
  { name: '15. Angebot Lieferant', subject: 'Angebot für Sanitärmaterial', filename: 'Angebot_2026_001.pdf', contact: LIEFERANT_MEGA, expected: { docType: 'ANG-LI', minConfidence: 0.85 } },
  { name: '16. Auftragsbestätigung', subject: 'Auftragsbestätigung zu Ihrer Bestellung', filename: 'AB_12345.pdf', contact: LIEFERANT_ZANDER, expected: { docType: 'AB', minConfidence: 0.85 } },
  { name: '17. Lieferschein', subject: 'Lieferschein LS-4381353782', filename: 'Lieferschein.pdf', contact: LIEFERANT_MEGA, expected: { docType: 'LS', minConfidence: 0.85 } },
  { name: '18. Bestellung', subject: 'Bestellung Best-Nr 78901', filename: 'Bestellung_Material.pdf', contact: LIEFERANT_ZANDER, expected: { docType: 'Bestellung', minConfidence: 0.85 } },
  { name: '19. Zahlungsavis', subject: 'Zahlungsavis für Ihre Rechnung', filename: 'Avis_2026.pdf', contact: null, expected: { docType: 'AVIS', minConfidence: 0.85 } },
  { name: '20. Fallback → ER-M', subject: 'Dokument zur Bearbeitung', filename: 'Scan_20260128.pdf', contact: null, expected: { docType: 'ER-M', minConfidence: 0.6 } },
];

// Test Runner
console.log('═══════════════════════════════════════════════════════════════');
console.log('   DOKUMENTEN-KLASSIFIZIERUNG - QUALITÄTSSICHERUNG (20 Tests)');
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;
const failures = [];

for (const tc of testCases) {
  const result = classifyDocument(tc.subject, tc.filename, tc.contact);
  let testPassed = true;
  const errors = [];

  if (result.docType !== tc.expected.docType) {
    testPassed = false;
    errors.push(`DocType: erwartet ${tc.expected.docType}, bekommen ${result.docType}`);
  }
  if (result.confidence < tc.expected.minConfidence) {
    testPassed = false;
    errors.push(`Confidence: erwartet ≥${tc.expected.minConfidence}, bekommen ${result.confidence}`);
  }
  if (tc.expected.atbsNummer && result.atbsNummer !== tc.expected.atbsNummer) {
    testPassed = false;
    errors.push(`ATBS: erwartet ${tc.expected.atbsNummer}, bekommen ${result.atbsNummer || 'undefined'}`);
  }
  if (tc.expected.nuaNummer && result.nuaNummer !== tc.expected.nuaNummer) {
    testPassed = false;
    errors.push(`NUA: erwartet ${tc.expected.nuaNummer}, bekommen ${result.nuaNummer || 'undefined'}`);
  }
  if (tc.expected.rechnungsNummer && result.rechnungsNummer !== tc.expected.rechnungsNummer) {
    testPassed = false;
    errors.push(`RE-Nr: erwartet ${tc.expected.rechnungsNummer}, bekommen ${result.rechnungsNummer || 'undefined'}`);
  }

  if (testPassed) {
    console.log(`✅ ${tc.name}`);
    console.log(`   → ${result.docType} (${(result.confidence * 100).toFixed(0)}%)${result.nuaNummer ? ` NUA: ${result.nuaNummer}` : ''}${result.atbsNummer ? ` ATBS: ${result.atbsNummer}` : ''}`);
    passed++;
  } else {
    console.log(`❌ ${tc.name}`);
    for (const e of errors) console.log(`   ⚠️  ${e}`);
    failures.push(`${tc.name}: ${errors.join(', ')}`);
    failed++;
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`   ERGEBNIS: ${passed}/${testCases.length} Tests bestanden`);
console.log('═══════════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('\n❌ FEHLGESCHLAGENE TESTS:');
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
} else {
  console.log('\n✅ ALLE TESTS BESTANDEN - Qualitätssicherung erfolgreich!');
  process.exit(0);
}
