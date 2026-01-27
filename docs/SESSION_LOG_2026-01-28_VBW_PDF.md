# Session Log - 2026-01-28

## Thema: VBW LV 2026 Preisverhandlung & PDF-Generator

---

## Implementiert

### 1. VBW Entscheidungsgrundlage

**Dokumente erstellt:**
- `2026-01-28 VBW Entscheidungsgrundlage.pdf` - Finale Version für Verhandlung
- `2026-01-28 VBW Preisverhandlung - Entscheidungsgrundlage.docx` - Word-Version

**Inhalte:**
- Preisvergleich VBW LV 2023 vs. 2026
- Beispielwohnungen: In der Delle 6 (37m²), Schulenburgstr. 25 (58m²), Gorch-Fock 31 (76m²)
- GWS-Vergleichspreise mit Artikelnummern in Tabellenform
- Kritische Positionen: Küchenstränge (-72%), Elektroschlitze (-54%), E-Anlage (-44%)
- WE-Tür: Mindestpreis 1.260 € für kostendeckende Ausführung
- Materialvorschläge: Gira Standard 55, Vigour One, Prüm Türen
- Leerstandskosten: 280 Whg × 3 Wochen × 60m² × 8,50€ = **357.000 €/Jahr**
- Prozessoptimierung: Direkter Baustart nach Auszug

### 2. PDF-Generator (Global)

**Pfad:** `C:\Users\holge\shared\lib\pdf-generator.mjs`

**Funktionen:**
| Funktion | Beschreibung |
|----------|--------------|
| `generatePDFFromHTML(html, outputPath)` | HTML-String → PDF |
| `generatePDFFromFile(htmlPath, outputPath)` | HTML-Datei → PDF |
| `generatePDFFromURL(url, outputPath)` | Webseite → PDF |
| `generateInvoice(data, outputPath)` | Rechnung mit Positionen |
| `generateQuote(data, outputPath)` | Angebot mit Bauvorhaben |
| `getBaseTemplate(content, options)` | neurealis Basis-Template |

**Features:**
- Puppeteer (Headless Chrome) für beste Qualität
- neurealis Corporate Design (#C41E3A)
- A4 Format mit korrekten Rändern
- Header mit Logo, Footer mit Seitenzahl
- MwSt-Berechnung automatisch
- CLI-Unterstützung

**Beispiel Rechnung:**
```javascript
await generateInvoice({
  rechnungsnummer: 'RE-2026-0042',
  kunde: { firma: 'VBW', strasse: '...', plz: '44795', ort: 'Bochum' },
  positionen: [
    { beschreibung: 'Komplettsanierung', menge: 1, einheit: 'psch', einzelpreis: 12500 },
  ],
  zahlungsziel: '14 Tage netto',
}, 'rechnung.pdf');
```

### 3. Installierte Pakete

- `puppeteer` - Headless Chrome für PDF-Rendering
- `docx` - Word-Dokument Generierung
- `pandoc` - Universal Document Converter (via winget)

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `C:\Users\holge\shared\lib\pdf-generator.mjs` | **Globale PDF-Bibliothek** |
| `lib/pdf-generator.mjs` | Lokale Kopie in neurealis-erp |
| `examples/generate-invoice-example.mjs` | Beispiele für Rechnungen/Angebote |
| `generate-vbw-docx.mjs` | VBW Word-Dokument Generator |
| `vbw-entscheidungsgrundlage.html` | HTML-Quelle für VBW PDF |

---

## Verifizierung

```bash
# PDF aus HTML generieren
node C:\Users\holge\shared\lib\pdf-generator.mjs input.html output.pdf

# Beispiel-Dokumente erstellen
node examples/generate-invoice-example.mjs
```

---

## Offene Punkte

- [ ] PDF-Generator in Edge Function für serverseitige Generierung (Puppeteer-Limits beachten)
- [ ] Hero Rechnungssync: `invoice_style` Feld nutzen
- [ ] Integration in SvelteKit UI für Download-Buttons

---

*Erstellt: 2026-01-28 01:00*
