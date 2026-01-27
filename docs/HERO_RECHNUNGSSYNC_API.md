# Hero Rechnungssync - API Dokumentation

**Stand:** 2026-01-27
**Quelle:** Chat-Analyse Hero GraphQL API

---

## Kernentdeckung: `metadata.invoice_style`

Die Hero API bietet ein `InvoiceStyle` Enum zur direkten Unterscheidung von Teil- und Schlussrechnungen.

### InvoiceStyle Enum

| Wert | Bedeutung | → Softr-Typ |
|------|-----------|-------------|
| `full` | Schlussrechnung | AR-S |
| `parted` | Teilrechnung | AR-A |
| `cumulative` | Kumulierte Rechnung | AR-A |
| `downpayment` | Abschlagsrechnung/Anzahlung | AR-A |
| `null` | Entwurf (nicht abgeschlossen) | **Ignorieren** |

---

## API-Konfiguration

| Eigenschaft | Wert |
|-------------|------|
| **Endpoint** | `https://login.hero-software.de/api/external/v7/graphql` |
| **API Key** | `ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz` |
| **Auth Header** | `Authorization: Bearer {API_KEY}` |

---

## GraphQL Queries

### Schema abfragen (InvoiceStyle Enum)

```graphql
{
  __type(name: "InvoiceStyle") {
    name
    enumValues { name }
  }
}
```

**Ergebnis:**
```json
{
  "data": {
    "__type": {
      "name": "InvoiceStyle",
      "enumValues": [
        { "name": "parted" },
        { "name": "full" },
        { "name": "cumulative" },
        { "name": "downpayment" }
      ]
    }
  }
}
```

### Dokumente mit allen relevanten Feldern

```graphql
{
  customer_documents(limit: 100, offset: 0) {
    id
    nr
    type
    value
    vat
    date
    status_name
    project_match_id
    document_type {
      name
      base_type
    }
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
}
```

### Nur Rechnungen mit invoice_style

```graphql
{
  customer_documents(
    limit: 100
    offset: 0
    type: invoice
  ) {
    id
    nr
    value
    vat
    date
    metadata {
      invoice_style
    }
    file_upload {
      filename
    }
  }
}
```

---

## Verfügbare Felder

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| `id` | Int | Hero-interne ID | `7476543` |
| `nr` | String | Dokumentnummer | `RE-0015105` |
| `type` | String | Dokumentart | `invoice`, `offer`, `information` |
| `value` | Float | Nettobetrag in EUR | `7294.98` |
| `vat` | Float | MwSt in EUR | `1386.05` |
| `date` | String | Dokumentdatum | `2025-02-07` |
| `status_name` | String | Status | `Erstellt`, `Versendet` |
| `project_match_id` | Int | Projekt-ID | `4277669` |
| `document_type.name` | String | Dokumenttyp-Name | `Rechnung - privat` |
| `document_type.base_type` | String | Basis-Typ | `invoice`, `offer` |
| `metadata.invoice_style` | Enum | Teil/Schluss | `full`, `parted`, `cumulative` |
| `metadata.positions[]` | Array | Rechnungspositionen | siehe unten |
| `file_upload.url` | String | Download-URL | Hero-URL |
| `file_upload.filename` | String | Dateiname | `Rechnung-RE-0015105-Deffge-07-02-2025.pdf` |

### Positionen (metadata.positions)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `name` | String | Positionsname |
| `net_value` | Float | Nettowert |
| `vat` | Float | MwSt-Betrag |

**Hinweis:** Positionen sind nur bei IN Hero erstellten Dokumenten verfügbar. Hochgeladene PDFs haben keine Positionen.

---

## Beispiel-Daten

### Schlussrechnung (full)

```json
{
  "nr": "RE-0015105",
  "metadata": { "invoice_style": "full" },
  "value": 7294.98,
  "vat": 1386.05,
  "date": "2025-02-07",
  "file_upload": {
    "filename": "Rechnung-RE-0015105-Deffge-07-02-2025.pdf"
  }
}
```

### Teilrechnung (parted)

```json
{
  "nr": "RE-0015154",
  "metadata": { "invoice_style": "parted" },
  "value": 2229.40,
  "vat": 423.59,
  "date": "2025-02-14",
  "file_upload": {
    "filename": "Rechnung-RE-0015154-Vonovia-14-02-2025.pdf"
  }
}
```

---

## Statistiken (Stand 2026-01-27)

| invoice_style | Anzahl | Anteil |
|---------------|--------|--------|
| `full` | 53 | 44% |
| `parted` | 16 | 13% |
| `cumulative` | 1 | 1% |
| `null` (Entwürfe) | 49 | 41% |
| **Gesamt** | 119 | 100% |

---

## Mapping-Logik für Edge Function

```typescript
function mapInvoiceStyle(invoiceStyle: string | null): string | null {
  switch (invoiceStyle) {
    case 'full':
      return 'AR-S'; // Schlussrechnung
    case 'parted':
    case 'cumulative':
    case 'downpayment':
      return 'AR-A'; // Abschlagsrechnung
    default:
      return null; // Ignorieren (Entwurf)
  }
}
```

### Positionen als Text extrahieren

```typescript
function extractPositionsText(positions: any[]): string {
  if (!positions || positions.length === 0) return '';

  return positions
    .map(p => `${p.name}: ${p.net_value.toFixed(2)} EUR`)
    .join('\n');
}
```

---

## Wichtige Erkenntnisse

1. **Schlussrechnung bei Teilrechnungen**: Wenn zuvor Teilrechnungen gestellt wurden, enthält die Schlussrechnung nur den **Restbetrag** (Differenzbetrag), nicht den Gesamtumsatz des Projekts.

2. **Dateinamen**: Hero liefert lesbare Dateinamen (`Rechnung-RE-0015105-Kunde-Datum.pdf`), Softr hat kryptische Namen.

3. **Beträge stimmen überein**: Netto/Brutto aus Hero stimmen 100% mit Softr überein.

4. **Entwürfe ignorieren**: Dokumente mit `invoice_style: null` sind Entwürfe und sollten nicht synchronisiert werden.

---

## cURL-Beispiel

```bash
curl -s -X POST https://login.hero-software.de/api/external/v7/graphql \
  -H "Authorization: Bearer ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ customer_documents(limit: 10, type: invoice) { nr metadata { invoice_style } value vat } }"}'
```

---

## Nächste Schritte

1. [ ] `hero-document-sync` Edge Function anpassen: `invoice_style` statt Fallback-Logik
2. [ ] Einmalig alle Hero-Daten durchlaufen und fehlende Netto/Brutto in Supabase ergänzen
3. [ ] Positionen als Text-Feld in `softr_dokumente` speichern (optional)

---

*Dokumentiert: 2026-01-27*
