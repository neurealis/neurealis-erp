import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, BorderStyle, AlignmentType, ShadingType } from 'docx';
import * as fs from 'fs';

const outputPath = 'C:\\Users\\holge\\neurealis GmbH\\Wohnungssanierung - Kunden - Kunden\\16 VBW - neu\\00 LVs\\2026 VBW - Neues LV mit 10er Schritten\\2026-01-28 VBW Preisverhandlung - Entscheidungsgrundlage.docx';

// Farben
const colors = {
  primary: '2c5282',
  primaryDark: '1a365d',
  success: '276749',
  warning: '975a16',
  error: 'c53030',
  gray: '4a5568',
  grayLight: 'f7fafc',
  white: 'ffffff',
};

// Helper für Tabellenzellen
const createCell = (text, options = {}) => {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text: text,
        bold: options.bold || false,
        color: options.color || '333333',
        size: options.size || 20,
      })],
      alignment: options.align || AlignmentType.LEFT,
    })],
    shading: options.shading ? { fill: options.shading, type: ShadingType.CLEAR } : undefined,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
  });
};

const createHeaderCell = (text, color = colors.primary) => {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: colors.white, size: 20 })],
    })],
    shading: { fill: color, type: ShadingType.CLEAR },
  });
};

// Dokument erstellen
const doc = new Document({
  creator: 'neurealis GmbH',
  title: 'VBW Leistungsverzeichnis 2026 - Entscheidungsgrundlage',
  styles: {
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: { font: 'Calibri', size: 22 },
        paragraph: { spacing: { after: 120 } },
      },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
    children: [
      // Titel
      new Paragraph({
        children: [new TextRun({ text: 'VBW Leistungsverzeichnis 2026', bold: true, size: 44, color: colors.primaryDark })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Entscheidungsgrundlage', size: 32, color: colors.gray })],
        spacing: { after: 300 },
      }),

      // Header Info
      new Paragraph({ children: [new TextRun({ text: 'Datum: ', bold: true }), new TextRun({ text: '28. Januar 2026' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Teilnehmer: ', bold: true }), new TextRun({ text: 'VBW, neurealis GmbH' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Ziel: ', bold: true }), new TextRun({ text: 'Gemeinsame Anpassung LV 2026 für langfristige Partnerschaft' })], spacing: { after: 400 } }),

      // 1. Zusammenfassung
      new Paragraph({ text: '1. Zusammenfassung der Analyse', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),

      new Paragraph({ text: 'Vorgehen', heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
      new Paragraph({ text: '1. Preisvergleich 2023 → 2026: Alle Positionen des neuen LV gegen das bestehende LV verglichen' }),
      new Paragraph({ text: '2. Praxistest: Bereits sanierte Wohnungen als Vergleichsbasis:' }),

      // Beispielwohnungen Tabelle
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [createHeaderCell('Größe'), createHeaderCell('Bauvorhaben')] }),
          new TableRow({ children: [createCell('37m²'), createCell('In der Delle 6')] }),
          new TableRow({ children: [createCell('58m²'), createCell('ATBS-432 Schulenburgstr. 25, Bochum | EG rechts')] }),
          new TableRow({ children: [createCell('76m²'), createCell('ATBS-362 Gorch-Fock 31')] }),
        ],
      }),

      new Paragraph({ text: '3. Fokus auf häufige Wohnungsgrößen: 50m² und 60m² (höchste Relevanz im Bestand)', spacing: { before: 200 } }),
      new Paragraph({ text: '4. Marktvergleich: GWS-Leistungsverzeichnis als Referenz' }),

      new Paragraph({ text: 'Ergebnis', heading: HeadingLevel.HEADING_3, spacing: { before: 300 } }),
      new Paragraph({ text: 'Bei mehreren Positionen besteht eine Diskrepanz zwischen dem neuen LV 2026 und den aktuellen Marktpreisen. Wir möchten diese Punkte gemeinsam besprechen, um eine für beide Seiten tragfähige Lösung zu finden.', spacing: { after: 400 } }),

      // 2. Übersicht
      new Paragraph({ text: '2. Übersicht - Positionen mit Gesprächsbedarf', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Sortiert nach Abweichung (größte zuerst)', italics: true })], spacing: { after: 200 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            createHeaderCell('Pos.'), createHeaderCell('Gewerk'), createHeaderCell('Position'),
            createHeaderCell('VBW 2026'), createHeaderCell('Markt/GWS'), createHeaderCell('Abweichung')
          ]}),
          new TableRow({ children: [
            createCell('3.3'), createCell('Sanitär'), createCell('Küchenstränge erneuern'),
            createCell('350 €'), createCell('1.268 €'), createCell('-72%', { bold: true, color: colors.error })
          ]}),
          new TableRow({ children: [
            createCell('1.5'), createCell('Maurer'), createCell('Elektroschlitze verputzen'),
            createCell('250 €'), createCell('543 €'), createCell('-54%', { bold: true, color: colors.error })
          ]}),
          new TableRow({ children: [
            createCell('2.1'), createCell('Elektro'), createCell('E-Anlage erneuern inkl. Baufassungen'),
            createCell('2.740 €'), createCell('4.929 €'), createCell('-44%', { bold: true, color: colors.error })
          ]}),
          new TableRow({ children: [
            createCell('6.3'), createCell('Böden'), createCell('Vinyl-Designboden liefern + verlegen'),
            createCell('1.565 €'), createCell('2.617 €'), createCell('-40%', { bold: true, color: colors.error })
          ]}),
          new TableRow({ children: [
            createCell('-'), createCell('Maler'), createCell('Decken tapezieren und streichen'),
            createCell('770 €'), createCell('1.077 €'), createCell('-29%', { color: colors.warning })
          ]}),
          new TableRow({ children: [
            createCell('6.1'), createCell('Böden'), createCell('Bodenbeläge entfernen'),
            createCell('350 €'), createCell('470 €'), createCell('-26%', { color: colors.warning })
          ]}),
          new TableRow({ children: [
            createCell('-'), createCell('Maler'), createCell('Malerarbeiten komplett'),
            createCell('2.820 €'), createCell('3.753 €'), createCell('-25%', { color: colors.warning })
          ]}),
          new TableRow({ children: [
            createCell('7.2'), createCell('Türen'), createCell('Wohnungseingangstür (WE-Tür)'),
            createCell('950 €'), createCell('1.260 €'), createCell('-25%', { color: colors.warning })
          ]}),
          new TableRow({ children: [
            createCell('-'), createCell('Maler'), createCell('Tapeten entfernen'),
            createCell('638-690 €'), createCell('805-840 €'), createCell('-18% bis -21%', { color: colors.warning })
          ]}),
          new TableRow({ children: [
            createCell('6.2'), createCell('Böden'), createCell('Ausgleichsestrich / Nivellierung'),
            createCell('530 €'), createCell('592 €'), createCell('-10%', { color: colors.warning })
          ]}),
        ],
      }),

      // 3. Detailanalyse
      new Paragraph({ text: '3. Detailanalyse der kritischen Positionen', heading: HeadingLevel.HEADING_2, spacing: { before: 500, after: 200 } }),

      // Pos 3.3
      new Paragraph({ children: [new TextRun({ text: 'Pos. 3.3 - Küchenstränge erneuern (-72%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• Problem: Position deckt nur Oberflächenarbeiten, nicht die komplette Strangerneuerung' }),
      new Paragraph({ text: '• Realität: Saubere Umsetzung erfordert Koordination mit darunterliegendem Mieter und Nacharbeiten zum Verfliesen' }),
      new Paragraph({ text: '• Brandschutz: Bei Durchbrüchen ist Brandschutzabschottung erforderlich (zusätzliche Kosten)' }),
      new Paragraph({ children: [new TextRun({ text: 'GWS-Vergleich - Empfehlung Aufteilung:', bold: true, color: colors.success })], spacing: { before: 150 } }),
      new Paragraph({ text: '• Abwasserstrang erneuern: separate Position' }),
      new Paragraph({ text: '• Frischwasserstrang erneuern: separate Position' }),
      new Paragraph({ text: '• Brandschutzabschottung: separate Position' }),

      // Pos 1.5
      new Paragraph({ children: [new TextRun({ text: 'Pos. 1.5 - Elektroschlitze verputzen (-54%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• VBW 2026: 250 € (50m²)' }),
      new Paragraph({ text: '• Markt: 543 €' }),
      new Paragraph({ children: [new TextRun({ text: 'GWS-Vergleich:', bold: true, color: colors.success })], spacing: { before: 150 } }),
      new Paragraph({ text: '• GWS.LV23-02.02.13: Laibungen verputzen, Q2 gefilzt: 12,54 €/m²' }),
      new Paragraph({ text: '• Bei ca. 40 lfm Schlitze à 0,15m Breite = 6m² → ca. 75 € Material' }),

      // Pos 2.1
      new Paragraph({ children: [new TextRun({ text: 'Pos. 2.1 - E-Anlage erneuern inkl. Baufassungen (-44%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• Enthält im Marktpreis: E-Check, Zuleitungsverlängerung, Mieterkeller, Balkon, Waschmaschinenanschluss, Renovierfassungen' }),
      new Paragraph({ children: [new TextRun({ text: 'Vergleich VBW vs. GWS:', bold: true, color: colors.success })], spacing: { before: 150 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            createHeaderCell('VBW Position'), createHeaderCell('EP'),
            createHeaderCell('GWS Artikel', colors.success), createHeaderCell('Beschreibung', colors.success), createHeaderCell('EP', colors.success)
          ]}),
          new TableRow({ children: [
            createCell('2.1 E-Anlage erneuern'), createCell('2.740 €'),
            createCell('GWS.LV23-20.02.1'), createCell('Elektroneuinstallation (ohne UV, Keller, Balkon, Bäder)'), createCell('2.500 €')
          ]}),
          new TableRow({ children: [
            createCell(''), createCell(''),
            createCell('GWS.LV23-20.01.8'), createCell('Waschmaschinenanschluss'), createCell('82 €')
          ]}),
          new TableRow({ children: [
            createCell(''), createCell(''),
            createCell('GWS.LV23-20.02.2'), createCell('Unterverteilung 3-reihig'), createCell('485 €')
          ]}),
          new TableRow({ children: [
            createCell(''), createCell(''),
            createCell('GWS.LV23-20.01.5'), createCell('Kelleranschluss'), createCell('145 €')
          ]}),
          new TableRow({ children: [
            createCell('Summe VBW', { bold: true, shading: 'bee3f8' }), createCell('2.740 €', { bold: true, shading: 'bee3f8' }),
            createCell('Summe GWS', { bold: true, shading: 'c6f6d5' }), createCell('(ohne Schlitze)', { shading: 'c6f6d5' }), createCell('3.212 €', { bold: true, shading: 'c6f6d5' })
          ]}),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: 'Delta: -15%', bold: true, color: colors.error })], spacing: { before: 100 } }),
      new Paragraph({ text: 'Hinweis: Günstigeres Schaltermaterial (Gira Standard 55 statt E2) + Position "Schlitze verputzen" separat ausweisen' }),

      // Pos 6.3
      new Paragraph({ children: [new TextRun({ text: 'Pos. 6.3 - Vinyl-Designboden liefern + verlegen (-40%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• VBW 2026: 31,30 €/m² (1.565 € bei 50m²)' }),
      new Paragraph({ children: [new TextRun({ text: 'Vergleich VBW vs. GWS:', bold: true, color: colors.success })], spacing: { before: 150 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            createHeaderCell('VBW Position'), createHeaderCell('EP'),
            createHeaderCell('GWS Artikel', colors.success), createHeaderCell('Beschreibung', colors.success), createHeaderCell('EP', colors.success)
          ]}),
          new TableRow({ children: [
            createCell('6.3 Vinyl-Designboden'), createCell('31,30 €/m²'),
            createCell('GWS.LV23-07.01.10'), createCell('Bodenbelag Vinyl Bahnen'), createCell('28,33 €/m²')
          ]}),
          new TableRow({ children: [
            createCell('6.4 Sockelleisten'), createCell('18,50 €/lfm'),
            createCell('GWS.LV23-07.01.12'), createCell('Sockelleiste Hart-PVC'), createCell('5,14 €/lfm')
          ]}),
          new TableRow({ children: [
            createCell(''), createCell(''),
            createCell('GWS.LV23-07.01.13'), createCell('Sockelleiste Holz'), createCell('16,25 €/lfm')
          ]}),
          new TableRow({ children: [
            createCell('Summe VBW (50m² + 30 lfm)', { bold: true, shading: 'bee3f8' }), createCell('2.120 €', { bold: true, shading: 'bee3f8' }),
            createCell('Summe GWS (PVC)', { bold: true, shading: 'c6f6d5' }), createCell(''), createCell('1.571 €', { bold: true, shading: 'c6f6d5' })
          ]}),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: 'Delta: -26% (bei PVC-Sockel)', bold: true, color: colors.error })], spacing: { before: 100 } }),
      new Paragraph({ text: 'Vorschlag: KSO-Sockelleisten (Kunststoff) anstatt Holz vom Meister - günstigere Alternative bei guter Qualität' }),

      // Pos 6.2
      new Paragraph({ children: [new TextRun({ text: 'Pos. 6.2 - Ausgleichsestrich / Nivellierung (-10%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• Problem: Position gilt nur bis 3mm Dicke' }),
      new Paragraph({ text: '• Realität: Nach Asbestsanierung oft 1,5cm Dicke erforderlich' }),
      new Paragraph({ children: [new TextRun({ text: 'GWS-Vergleich:', bold: true, color: colors.success })], spacing: { before: 150 } }),
      new Paragraph({ text: '• GWS.LV23-07.01.5: Untergrund säubern: 1,02 €/m²' }),
      new Paragraph({ text: '• GWS.LV23-07.01.6: Grundierung: 2,36 €/m²' }),
      new Paragraph({ text: '• GWS.LV23-07.01.7: Spachtelmasse 3-5mm: 8,77 €/m²' }),
      new Paragraph({ text: 'Hinweis: Bei GWS sind Säubern + Grundierung separat ausgewiesen. Bei VBW NICHT in Position 6.2 enthalten.' }),

      // Pos 7.2
      new Paragraph({ children: [new TextRun({ text: 'Pos. 7.2 - Wohnungseingangstür (WE-Tür) (-25%)', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• VBW 2026: 950 €' }),
      new Paragraph({ text: '• Unser EK Material: 1.060 € (Angebot Holz Becher)' }),
      new Paragraph({ children: [new TextRun({ text: '• Mindestens 1.260 € für kostendeckende Ausführung erforderlich', bold: true, color: colors.error })] }),

      // 4. Materialvorschläge
      new Paragraph({ text: '4. Materialvorschläge', heading: HeadingLevel.HEADING_2, spacing: { before: 500, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Bessere Verfügbarkeit und/oder günstigere Einkaufspreise', italics: true })], spacing: { after: 200 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            createHeaderCell('Pos.'), createHeaderCell('Position'), createHeaderCell('Aktuell'),
            createHeaderCell('Vorschlag neurealis'), createHeaderCell('Vorteil')
          ]}),
          new TableRow({ children: [
            createCell('2.1, 2.8'), createCell('E-Anlage / Schalter+Steckdosen'), createCell('Gira E2'),
            createCell('Gira Standard 55', { bold: true }), createCell('Günstiger bei gleicher Qualität')
          ]}),
          new TableRow({ children: [
            createCell('2.7'), createCell('Badentlüfter'), createCell('-'),
            createCell('Maico ECA 100 ipro K', { bold: true }), createCell('Mit Nachlauf, bessere Verfügbarkeit')
          ]}),
          new TableRow({ children: [
            createCell('3.1'), createCell('Sanitärinstallation komplett'), createCell('diverse'),
            createCell('Vigour One', { bold: true }), createCell('Gutes Preis-Leistungs-Verhältnis')
          ]}),
          new TableRow({ children: [
            createCell('5.9'), createCell('BAD Wandfliesen Dünnbett'), createCell('DK02'),
            createCell('Kermos Wand-/Bodenfliesen 8mm', { bold: true }), createCell('Bessere Qualität, DK02 nicht rutschhemmend')
          ]}),
          new TableRow({ children: [
            createCell('6.3'), createCell('Vinyl-Designboden'), createCell('Holz-Sockelleisten'),
            createCell('KSO Sockelleisten (Kunststoff)', { bold: true }), createCell('Günstiger als Holz, gute Qualität')
          ]}),
          new TableRow({ children: [
            createCell('7.1'), createCell('Türerneuerung Innentür'), createCell('Jeld-Wen'),
            createCell('Prüm Röhrenspahn (Wabe)', { bold: true }), createCell('Kostenoptimiert')
          ]}),
          new TableRow({ children: [
            createCell('7.2'), createCell('WE-Tür'), createCell('Jeld-Wen'),
            createCell('Prüm KK2 RC2', { bold: true }), createCell('EK Material: 1.060 € → EP mind. 1.260 €')
          ]}),
          new TableRow({ children: [
            createCell('7.3'), createCell('Beschläge erneuern'), createCell('Griffwerk'),
            createCell('Becher Eigenmarke (Hoppe Amsterdam)', { bold: true }), createCell('Qualität bei besserem Preis')
          ]}),
        ],
      }),

      new Paragraph({ children: [new TextRun({ text: 'Sonderfall Thermostatköpfe (Pos. 4.6):', bold: true })], spacing: { before: 300 } }),
      new Paragraph({ text: '• Standard-Thermostatköpfe: Position wie kalkuliert' }),
      new Paragraph({ text: '• Bei Danfoss/Verschraubung: 2x Position ansetzen (deutlich höherer EK bei alten Gewinden)' }),

      // 5. Zahlungsziel
      new Paragraph({ text: '5. Zahlungsziel', heading: HeadingLevel.HEADING_2, spacing: { before: 500, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Aktuell: 14 Tage netto', bold: true }), new TextRun({ text: ' - Beibehalten' })], spacing: { after: 200 } }),

      new Paragraph({ children: [new TextRun({ text: 'Argument für zeitnahe Zahlung:', bold: true })], spacing: { before: 200 } }),
      new Paragraph({ text: '• Wir gehen in Vorleistung mit Material (z.B. Palette Forbo Vinyl auf Lager)' }),
      new Paragraph({ text: '• Lagerware ermöglicht bessere Einkaufskonditionen und schnellere Verfügbarkeit' }),
      new Paragraph({ children: [new TextRun({ text: '• Gute Nachunternehmer können durch pünktliche Zahlung gehalten werden', bold: true })] }),
      new Paragraph({ text: '• Cashflow-Stabilität ermöglicht bessere Konditionen bei Material-Einkauf' }),

      // 6. Prozessoptimierung
      new Paragraph({ text: '6. Prozessoptimierung', heading: HeadingLevel.HEADING_2, spacing: { before: 500, after: 200 } }),

      new Paragraph({ text: 'Aktueller Prozess (Ist-Zustand)', heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
      new Paragraph({ text: 'Monat 0: Kündigung Mieter → Monat 3: Auszug → +1-2 Wochen: BL-Zuweisung → +weitere Tage: Erstbegehung, LEB, Freigabe' }),
      new Paragraph({ children: [new TextRun({ text: 'Probleme: Verzögerung nach Auszug ca. 3 Wochen bis Baustart', bold: true, color: colors.error })], spacing: { before: 150 } }),

      new Paragraph({ children: [new TextRun({ text: 'Leerstandskosten bei 3 Wochen Verzögerung:', bold: true, color: colors.error })], spacing: { before: 300 } }),
      new Paragraph({ text: '280 Wohnungen/Jahr × 3 Wochen × 60m² × 8,50 €/m²/Monat ÷ 4 Wochen' }),
      new Paragraph({ children: [new TextRun({ text: '= 357.000 € pro Jahr', bold: true, size: 28, color: colors.error })], spacing: { after: 300 } }),

      new Paragraph({ text: 'Vorgeschlagener Prozess (Soll-Zustand)', heading: HeadingLevel.HEADING_3, spacing: { before: 300 } }),
      new Paragraph({ text: 'Monat 0: Kündigung + BL direkt zugewiesen (nach Regionen)' }),
      new Paragraph({ text: 'Monat 1-2: Erstbegehung (bewohnte Wohnung) - VBW + neurealis' }),
      new Paragraph({ text: 'Monat 2-3: Budgetfreigabe & Einplanung neurealis' }),
      new Paragraph({ children: [new TextRun({ text: 'Monat 3: Auszug → Direkter Baustart', bold: true, color: colors.success })] }),

      new Paragraph({ text: 'Vorteile', heading: HeadingLevel.HEADING_3, spacing: { before: 300 } }),
      new Paragraph({ text: '• Reduktion Leerstandskosten: bis zu 357.000 €/Jahr Einsparung' }),
      new Paragraph({ text: '• Bessere Planbarkeit: BL kennt "seine" Straßen/Regionen' }),
      new Paragraph({ text: '• Frühere Budgetklarheit: 6-8 Wochen vor Baustart' }),
      new Paragraph({ text: '• Kürzere Durchlaufzeit: 3 Wochen Verzögerung → 0' }),
      new Paragraph({ text: '• Weniger Fahrzeit: BL mit festen Regionen → mehr Zeit vor Ort für Qualitätssicherung' }),

      // 7. Entscheidungspunkte
      new Paragraph({ text: '7. Entscheidungspunkte', heading: HeadingLevel.HEADING_2, spacing: { before: 500, after: 200 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [createHeaderCell('Nr.'), createHeaderCell('Thema'), createHeaderCell('Entscheidung erforderlich')] }),
          new TableRow({ children: [createCell('1', { bold: true }), createCell('Positionen mit Gesprächsbedarf'), createCell('Preisanpassung oder Leistungsumfang klären')] }),
          new TableRow({ children: [createCell('2', { bold: true }), createCell('Materialvorgaben'), createCell('Freigabe der vorgeschlagenen Alternativen')] }),
          new TableRow({ children: [createCell('3', { bold: true }), createCell('Zahlungsziel'), createCell('14 Tage netto beibehalten')] }),
          new TableRow({ children: [createCell('4', { bold: true }), createCell('Prozessoptimierung'), createCell('Umsetzung des neuen Ablaufs')] }),
          new TableRow({ children: [createCell('5', { bold: true }), createCell('BL-Zuordnung'), createCell('Feste Zuordnung nach Straßen/Regionen')] }),
        ],
      }),

      // Footer
      new Paragraph({ text: '', spacing: { before: 600 } }),
      new Paragraph({ text: 'Dokument erstellt: 28. Januar 2026', spacing: { before: 400 } }),
      new Paragraph({ children: [new TextRun({ text: 'neurealis GmbH', bold: true }), new TextRun({ text: ' - Komplettsanierung NRW' })] }),
    ],
  }],
});

// Speichern
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log('Word-Dokument erstellt:', outputPath);
});
