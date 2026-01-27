/**
 * Beispiel: Rechnung generieren
 */
import { generateInvoice, generateQuote } from '../lib/pdf-generator.mjs';

// Rechnung erstellen
await generateInvoice({
  rechnungsnummer: 'RE-2026-0042',
  datum: '28.01.2026',
  zahlungsziel: '14 Tage netto',
  kunde: {
    firma: 'VBW Bauen und Wohnen GmbH',
    strasse: 'Musterstraße 123',
    plz: '44795',
    ort: 'Bochum',
  },
  positionen: [
    { beschreibung: 'Komplettsanierung 2-Zimmer-Wohnung, In der Delle 6', menge: 1, einheit: 'psch', einzelpreis: 12500 },
    { beschreibung: 'Zusatzleistung: Therme Vaillant tauschen', menge: 1, einheit: 'Stk', einzelpreis: 4300 },
    { beschreibung: 'Materialzuschlag WE-Tür RC2', menge: 1, einheit: 'Stk', einzelpreis: 310 },
  ],
}, 'beispiel-rechnung.pdf');

// Angebot erstellen
await generateQuote({
  angebotsnummer: 'ANG-2026-0015',
  datum: '28.01.2026',
  gueltigBis: '28.02.2026',
  kunde: {
    firma: 'VBW Bauen und Wohnen GmbH',
    ansprechpartner: 'Herr Müller',
    strasse: 'Musterstraße 123',
    plz: '44795',
    ort: 'Bochum',
  },
  bauvorhaben: {
    name: 'Schulenburgstr. 25',
    adresse: '44795 Bochum, EG rechts',
  },
  positionen: [
    { pos: '1', beschreibung: 'Elektroinstallation komplett', menge: 1, einheit: 'psch', einzelpreis: 2740 },
    { pos: '2', beschreibung: 'Sanitärinstallation komplett inkl. Fliesen', menge: 1, einheit: 'psch', einzelpreis: 6500 },
    { pos: '3', beschreibung: 'Vinyl-Designboden liefern und verlegen', menge: 58, einheit: 'm²', einzelpreis: 31.30 },
    { pos: '4', beschreibung: 'Innentüren erneuern', menge: 3, einheit: 'Stk', einzelpreis: 450 },
    { pos: '5', beschreibung: 'WE-Tür RC2', menge: 1, einheit: 'Stk', einzelpreis: 1260 },
  ],
  bemerkungen: 'Material nach Absprache: Gira Standard 55, Vigour One Sanitär, Prüm Türen.',
}, 'beispiel-angebot.pdf');

console.log('Beispiel-Dokumente erstellt!');
