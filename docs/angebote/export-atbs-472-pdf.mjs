/**
 * PDF-Export für Angebot ATBS-472
 */

import { generatePDFFromHTML, getBaseTemplate, colors } from 'file:///C:/Users/holge/shared/lib/pdf-generator.mjs';

const angebot = {
  nummer: 'ANG-ATBS-472',
  projekt: 'Bollwerkstraße 9, 4. OG',
  auftraggeber: 'GWS Wohnungsgesellschaft mbH',
  mieter: 'Minner',
  datum: new Date().toLocaleDateString('de-DE'),
  gewerke: [
    {
      name: 'Demontage / Abriss',
      positionen: [
        { pos: '1.1', artikelnr: 'GWS.LV23-01.01.1', bezeichnung: 'Demontage Gardinenleisten u. Kleinteile, WE 30-90m²', einheit: 'psch', ep: 45.81, menge: 1 },
        { pos: '1.2', artikelnr: 'GWS.LV23-01.01.2', bezeichnung: 'Demontage Sockelleisten, WE 30-90m²', einheit: 'psch', ep: 119.00, menge: 1 },
        { pos: '1.3', artikelnr: 'GWS.LV23-09.01.4', bezeichnung: 'Tapeten ablösen, Wandfl., 2 lagig (Küche)', einheit: 'm²', ep: 2.42, menge: 25 },
        { pos: '1.4', artikelnr: 'GWS.LV23-09.01.4', bezeichnung: 'Tapeten ablösen, Wandfl., 2 lagig (Schlafzimmer)', einheit: 'm²', ep: 2.42, menge: 35 },
        { pos: '1.5', artikelnr: 'GWS.LV23-01.01.13', bezeichnung: 'Rückbau Fliesenspiegel Küche', einheit: 'm²', ep: 16.59, menge: 4 },
        { pos: '1.6', artikelnr: 'GWS.LV23-02.02.7', bezeichnung: 'Gips-Leichtputz als Wandputz Q2 (nach Fliesenspiegel)', einheit: 'm²', ep: 15.42, menge: 4 },
        { pos: '1.7', artikelnr: 'GWS.LV23-01.01.11', bezeichnung: 'Demontage Deckenbekleidungen (abgehängte Decke Küche)', einheit: 'm²', ep: 9.04, menge: 8 },
        { pos: '1.8', artikelnr: 'GWS.LV23-01.01.11', bezeichnung: 'Demontage Deckenpaneele (Schlafzimmer)', einheit: 'm²', ep: 9.04, menge: 14 },
        { pos: '1.9', artikelnr: 'GWS.LV23-01.01.3', bezeichnung: 'Rückbau Altbelag lose (Teppich Schlafzimmer)', einheit: 'psch', ep: 250.00, menge: 0.5 },
      ]
    },
    {
      name: 'Boden',
      positionen: [
        { pos: '2.1', artikelnr: 'GWS.LV23-07.01.4', bezeichnung: 'Dampfbremse/Weichmachersperre PE Folie', einheit: 'm²', ep: 2.52, menge: 60 },
        { pos: '2.2', artikelnr: 'GWS.LV23-07.01.3', bezeichnung: 'Nivellierausgleich', einheit: 'm²', ep: 10.00, menge: 60 },
        { pos: '2.3', artikelnr: 'GWS.LV23-07.01.9', bezeichnung: 'Bodenbelag Vinyl Planken (Gerflor Creation 30)', einheit: 'm²', ep: 30.00, menge: 60 },
        { pos: '2.4', artikelnr: 'GWS.LV23-07.01.20', bezeichnung: 'Übergangsschienen', einheit: 'Stk', ep: 14.17, menge: 2 },
        { pos: '2.5', artikelnr: 'GWS.LV23-07.01.12', bezeichnung: 'Sockelleiste Hart-PVC weiß', einheit: 'lfm', ep: 5.14, menge: 74 },
      ]
    },
    {
      name: 'Sanitär',
      positionen: [
        { pos: '3.1', artikelnr: 'GWS.LV23-21.02.01.33', bezeichnung: 'Wand-WC komplett', einheit: 'Stk', ep: 230.00, menge: 1 },
        { pos: '3.2', artikelnr: 'GWS.LV23-21.02.01.32', bezeichnung: 'Spülkasten AP', einheit: 'Stk', ep: 72.92, menge: 1 },
        { pos: '3.3', artikelnr: 'GWS.LV23-21.02.01.26', bezeichnung: 'Waschtischanlage 60cm (inkl. Armatur)', einheit: 'Stk', ep: 308.33, menge: 1 },
        { pos: '3.4', artikelnr: 'GWS.LV23-07.01.16', bezeichnung: 'Silikonfugen Wanne dauerelastisch', einheit: 'lfm', ep: 4.04, menge: 8 },
        { pos: '3.5', artikelnr: 'GWS.LV23-07.01.16', bezeichnung: 'Silikonfugen Boden dauerelastisch', einheit: 'lfm', ep: 4.04, menge: 6 },
        { pos: '3.6', artikelnr: 'GWS.LV23-21.02.01.30', bezeichnung: 'Brausebatterie/Duscharmatur neu', einheit: 'Stk', ep: 133.33, menge: 1 },
        { pos: '3.7', artikelnr: 'GWS.LV23-01.99.05.23', bezeichnung: 'Kombieckventil Küche, selbstdichtend', einheit: 'Stk', ep: 35.00, menge: 1 },
        { pos: '3.8', artikelnr: 'GWS.LV23-21.02.01.1', bezeichnung: 'Waschmaschinenanschluss prüfen/erneuern', einheit: 'Stk', ep: 104.17, menge: 0.5 },
        { pos: '3.9', artikelnr: 'GWS.LV23-01.99.05.4', bezeichnung: 'WC-Rollenhalter + Handtuchhalter', einheit: 'Stk', ep: 25.00, menge: 2 },
      ]
    },
    {
      name: 'Heizung',
      positionen: [
        { pos: '4.1', artikelnr: 'GWS.LV23-20.01.38', bezeichnung: 'Thermostatkopf erneuern', einheit: 'Stk', ep: 31.17, menge: 6 },
      ]
    },
    {
      name: 'Elektro',
      positionen: [
        { pos: '5.1', artikelnr: 'GWS.LV23-20.01.5', bezeichnung: 'Unterverteilung (Automaten erneuern)', einheit: 'Stk', ep: 458.53, menge: 1 },
        { pos: '5.2', artikelnr: 'GWS.LV23-20.01.7', bezeichnung: 'FI/LS-Schalter 4-polig 30mA', einheit: 'Stk', ep: 62.50, menge: 1 },
        { pos: '5.3', artikelnr: 'GWS.LV23-01.99.05.21', bezeichnung: 'Baufassung E27', einheit: 'Stk', ep: 8.00, menge: 6 },
        { pos: '5.4', artikelnr: 'GWS.LV23-20.01.10', bezeichnung: 'Erneuerung Schalter-/Steckdosen WE (Feininstallation)', einheit: 'psch', ep: 450.00, menge: 1 },
        { pos: '5.5', artikelnr: 'GWS.LV23-20.01.37', bezeichnung: 'E-Check nach VDE', einheit: 'Stk', ep: 332.47, menge: 1 },
      ]
    },
    {
      name: 'Maler',
      positionen: [
        { pos: '6.1', artikelnr: 'GWS.LV23-09.05.8', bezeichnung: 'Lackierung Plattenheizkörper bis 1m', einheit: 'Stk', ep: 29.84, menge: 5 },
        { pos: '6.2', artikelnr: 'GWS.LV23-09.05.8', bezeichnung: 'Lackierung Plattenheizkörper bis 2m', einheit: 'Stk', ep: 29.84, menge: 1 },
        { pos: '6.2a', artikelnr: 'GWS.LV23-09.05.10', bezeichnung: 'Zulage Breite bis 2m', einheit: 'Stk', ep: 15.42, menge: 1 },
        { pos: '6.3', artikelnr: 'GWS.LV23-09.05.1', bezeichnung: 'Lackierung Innentürblatt', einheit: 'Stk', ep: 70.00, menge: 7 },
        { pos: '6.4', artikelnr: 'GWS.LV23-09.05.2', bezeichnung: 'Lackierung Umfassungszarge', einheit: 'Stk', ep: 40.00, menge: 7 },
        { pos: '6.5', artikelnr: 'GWS.LV23-09.06.1', bezeichnung: 'Renovierungsanstrich Eingangstür/Abschnittstür', einheit: 'Stk', ep: 64.58, menge: 1 },
        { pos: '6.6', artikelnr: 'GWS.LV23-09.04.1', bezeichnung: 'Raufaser tapezieren (Küche)', einheit: 'm²', ep: 4.75, menge: 25 },
        { pos: '6.7', artikelnr: 'GWS.LV23-09.04.1', bezeichnung: 'Raufaser tapezieren (Schlafzimmer)', einheit: 'm²', ep: 4.75, menge: 35 },
        { pos: '6.8', artikelnr: 'GWS.LV23-09.04.2', bezeichnung: 'Dispersionsanstrich Wände + Decken ganze WE', einheit: 'm²', ep: 3.76, menge: 280 },
        { pos: '6.9', artikelnr: 'GWS.LV23-09.04.3', bezeichnung: 'Dispersionsanstrich Fensterleibungen', einheit: 'lfm', ep: 2.43, menge: 25 },
      ]
    },
    {
      name: 'Tischler',
      positionen: [
        { pos: '7.1', artikelnr: 'GWS.LV23-08.04.10', bezeichnung: 'Drückergarnitur Zimmertür', einheit: 'Stk', ep: 35.00, menge: 5 },
        { pos: '7.2', artikelnr: 'GWS.LV23-08.04.15', bezeichnung: 'Sicherheitsbeschlag WE-Tür', einheit: 'Stk', ep: 83.33, menge: 1 },
        { pos: '7.3', artikelnr: 'GWS.LV23-08.01.5', bezeichnung: 'Einsteckschloss Zimmertür erneuern', einheit: 'Stk', ep: 25.83, menge: 5 },
        { pos: '7.4', artikelnr: 'GWS.LV23-08.01.16', bezeichnung: 'Zylinder WE-Tür erneuern', einheit: 'Stk', ep: 40.24, menge: 1 },
      ]
    },
    {
      name: 'Reinigung',
      positionen: [
        { pos: '8.1', artikelnr: 'GWS.LV23-11.02.6', bezeichnung: 'Bauendreinigung Wohnung bis 65m², 2 Zi', einheit: 'psch', ep: 172.92, menge: 1 },
        { pos: '8.2', artikelnr: 'GWS.LV23-11.01.1', bezeichnung: 'Grundreinigung Treppenhaus EG', einheit: 'Woche', ep: 31.25, menge: 2 },
        { pos: '8.3', artikelnr: 'GWS.LV23-11.01.2', bezeichnung: 'Reinigung je weitere Etage (4 Etagen)', einheit: 'Woche', ep: 17.65, menge: 8 },
      ]
    },
    {
      name: 'Sonstiges',
      positionen: [
        { pos: '9.1', artikelnr: '-', bezeichnung: 'Kleinteile-Pauschale (Haken, Halter, Dübel, etc.)', einheit: 'psch', ep: 200.00, menge: 4 },
      ]
    },
  ]
};

// Berechne Summen pro Gewerk
angebot.gewerke.forEach(g => {
  g.summe = g.positionen.reduce((sum, p) => sum + (p.ep * p.menge), 0);
});

const netto = angebot.gewerke.reduce((sum, g) => sum + g.summe, 0);
const mwst = netto * 0.19;
const brutto = netto + mwst;

// HTML generieren
function formatCurrency(value) {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let gewerkHTML = '';
angebot.gewerke.forEach((gewerk, gIdx) => {
  gewerkHTML += `
    <h3 style="color: ${colors.primary}; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 5px;">
      ${gIdx + 1}. ${gewerk.name}
    </h3>
    <table>
      <thead>
        <tr>
          <th style="width: 6%;">Pos.</th>
          <th style="width: 14%;">Art.-Nr.</th>
          <th style="width: 40%;">Bezeichnung</th>
          <th style="width: 8%;">Einheit</th>
          <th style="width: 10%; text-align: right;">EP</th>
          <th style="width: 8%; text-align: right;">Menge</th>
          <th style="width: 14%; text-align: right;">Gesamt</th>
        </tr>
      </thead>
      <tbody>
  `;

  gewerk.positionen.forEach(p => {
    const gesamt = p.ep * p.menge;
    gewerkHTML += `
        <tr>
          <td>${p.pos}</td>
          <td style="font-size: 8pt; color: #666;">${p.artikelnr}</td>
          <td>${p.bezeichnung}</td>
          <td>${p.einheit}</td>
          <td class="amount">${formatCurrency(p.ep)} €</td>
          <td class="amount">${p.menge}</td>
          <td class="amount">${formatCurrency(gesamt)} €</td>
        </tr>
    `;
  });

  gewerkHTML += `
        <tr class="sum-row">
          <td colspan="6" style="text-align: right;"><strong>Summe ${gewerk.name}:</strong></td>
          <td class="amount"><strong>${formatCurrency(gewerk.summe)} €</strong></td>
        </tr>
      </tbody>
    </table>
  `;
});

const content = `
  <h1 class="document-title">Angebot ${angebot.nummer}</h1>
  <div class="document-meta">Datum: ${angebot.datum}</div>

  <div style="display: flex; justify-content: space-between; margin: 20px 0 30px;">
    <div>
      <strong>Auftraggeber:</strong><br>
      ${angebot.auftraggeber}<br>
      z.Hd. Herrn Fromme
    </div>
    <div style="text-align: right;">
      <strong>Bauvorhaben:</strong><br>
      ${angebot.projekt}<br>
      Dortmund<br>
      <em>Mieter: ${angebot.mieter}</em>
    </div>
  </div>

  <div class="highlight-box">
    <strong>Leistungsumfang:</strong> Instandsetzung Mietwohnung 4. OG nach Auszug<br>
    <strong>Ausführungszeitraum:</strong> ca. 3-4 Wochen nach Auftragseingang
  </div>

  ${gewerkHTML}

  <div style="margin-top: 30px; page-break-inside: avoid;">
    <h3 style="color: ${colors.primary}; border-bottom: 2px solid ${colors.primary}; padding-bottom: 5px;">
      Gesamtübersicht
    </h3>
    <table>
      <thead>
        <tr>
          <th style="width: 10%;">Nr.</th>
          <th style="width: 70%;">Gewerk</th>
          <th style="width: 20%; text-align: right;">Netto EUR</th>
        </tr>
      </thead>
      <tbody>
        ${angebot.gewerke.map((g, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${g.name}</td>
            <td class="amount">${formatCurrency(g.summe)} €</td>
          </tr>
        `).join('')}
        <tr class="sum-row">
          <td colspan="2" style="text-align: right;"><strong>SUMME NETTO:</strong></td>
          <td class="amount"><strong>${formatCurrency(netto)} €</strong></td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right;">zzgl. 19% MwSt:</td>
          <td class="amount">${formatCurrency(mwst)} €</td>
        </tr>
        <tr class="sum-row" style="background-color: ${colors.primary} !important; color: white;">
          <td colspan="2" style="text-align: right;"><strong>SUMME BRUTTO:</strong></td>
          <td class="amount"><strong>${formatCurrency(brutto)} €</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top: 30px; font-size: 9pt; page-break-inside: avoid;">
    <h4>Hinweise:</h4>
    <ol style="margin: 0; padding-left: 20px;">
      <li>Alter PVC-Boden bleibt als Untergrund (asbestfrei lt. Begehung). Weichmachersperre wird aufgetragen.</li>
      <li>Stuckleisten bleiben und werden mitgestrichen.</li>
      <li>Balkon-Beschichtung erfolgt im Sommer separat (nicht enthalten).</li>
      <li>Mengen sind geschätzt für Standard 2-Zi-Wohnung ca. 60m². Anpassung nach Aufmaß möglich.</li>
    </ol>
  </div>

  <div style="margin-top: 40px; font-size: 9pt; color: ${colors.textMuted};">
    Wir freuen uns auf Ihre Beauftragung und stehen für Rückfragen gerne zur Verfügung.<br><br>
    Mit freundlichen Grüßen<br><br>
    <strong>Holger Neumann</strong><br>
    Geschäftsführer
  </div>
`;

const html = getBaseTemplate(content, {
  title: `Angebot ${angebot.nummer}`,
  date: angebot.datum
});

const outputPath = 'C:/Users/holge/neurealis-erp/docs/angebote/ANG-ATBS-472_Bollwerkstr9_GWS.pdf';

try {
  await generatePDFFromHTML(html, outputPath);
  console.log(`\n✅ PDF erstellt: ${outputPath}`);
  console.log(`\n   Netto:  ${formatCurrency(netto)} €`);
  console.log(`   Brutto: ${formatCurrency(brutto)} €`);
} catch (error) {
  console.error('Fehler beim PDF-Export:', error.message);
  process.exit(1);
}
