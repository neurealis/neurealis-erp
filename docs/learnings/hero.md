# Learnings: Hero Software

Letzte Aktualisierung: 2026-02-03

---

## API / GraphQL

### L011: invoice_style für Teil/Schlussrechnungen
**Kategorie:** Technisch
**Datum:** 2026-01-27
**Problem:** Fallback-Logik war unzuverlässig
**Lösung:** `metadata.invoice_style` direkt nutzen:
- `full` → AR-S (Schlussrechnung)
- `parted`/`cumulative`/`downpayment` → AR-A (Abschlag)
- `null` → Ignorieren (Entwurf)

---

### L012: Schlussrechnung = Restbetrag
**Kategorie:** Business
**Datum:** 2026-01-27
**Problem:** Annahme dass Schlussrechnung Gesamtbetrag enthält
**Wahrheit:** Bei Teilrechnungen enthält Schluss nur den Differenzbetrag
**Beispiel:** 2 Teilrechnungen (4.500EUR + 5.000EUR) → Schluss nur 8.900EUR (Rest)

---

### L030: Hero hat KEINE Webhook-API
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** Annahme dass Make.com echte Webhooks nutzt
**Wahrheit:** Nur Polling möglich - GraphQL hat keine Subscriptions
**Konsequenz:** Cron-Job ist die richtige Lösung

---

### L039: temporary_url explizit abfragen
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** PDF-Download schlägt fehl obwohl Dokumente existieren
**Lösung:** Immer alle Felder abfragen:
```graphql
file_upload {
  filename
  temporary_url  # <- MUSS dabei sein!
}
```
**Wichtig:** OTC-URLs verfallen schnell, sofort verarbeiten

---

### L105: GraphQL Soft-Delete für Artikel
**Kategorie:** Technisch
**Datum:** 2026-01-31
```graphql
mutation {
  update_supply_product_version(
    supply_product_version: {
      product_id: "xxx",
      is_deleted: true
    }
  ) { product_id }
}
```
**Vorteil:** Wiederherstellung möglich

---

## LV-Sync

### L169: Hero-LV-Sync nur noch manuell (D048)
**Kategorie:** Business
**Datum:** 2026-02-02
**Problem:** Hero überschrieb korrigierte Supabase-Preise mit veralteten Werten
**Lösung:**
1. Cron deaktiviert: `SELECT cron.unschedule('hero-lv-sync-daily')`
2. Supabase ist jetzt LV-Master
**Manueller Sync:**
```bash
curl "https://xxx.supabase.co/functions/v1/hero-lv-sync?dry_run=true"
```

---

### L168: Preishistorie-Trigger protokolliert automatisch
**Kategorie:** Technisch
**Datum:** 2026-02-02
**Tabelle:** `lv_preis_historie`
- `listenpreis_alt`, `listenpreis_neu` (VK)
- `preis_alt`, `preis_neu` (EK)
- `aenderung_prozent`, `gueltig_ab`, `quelle`

---

### L167: GWS Preisimport-Workflow
**Kategorie:** Workflow
**Datum:** 2026-02-02
1. Excel einlesen: `xlsx` Package
2. Artikelnummer-Mapping: `GWS.LV23-` Präfix
3. Vergleich erstellen
4. Supabase aktualisieren
5. Hero manuell prüfen

---

### L107: LV-Duplikate - höheren Preis behalten
**Kategorie:** Business
**Datum:** 2026-01-31
**Grund:**
- Niedrigerer Preis = oft veraltet
- Höherer Preis = aktueller Marktpreis
- Lieber zu hoch kalkuliert (Marge!)

---

### L108: Hero LV-Datenqualität - Typische Probleme
**Kategorie:** Business
**Datum:** 2026-01-31
| Problem | Anzahl | Lösung |
|---------|--------|--------|
| DUPLIKAT-* Marker | 190 | Löschen |
| ALT-* mit alten Preisen | 436 | Löschen |
| Generische Nummern | 7 | Schema zuweisen |

---

## Artikelnummern

### L106: Artikelnummer-Schema für neue Positionen
**Kategorie:** Business
**Datum:** 2026-01-31
**Format:** `{Gewerk}-{Bauteil}-{Aspekt}` in Title Case
**Beispiele:**
- `Sanitaer-Dusche-Zulage`
- `Boden-Platten-Rueckbau`
- `Elektrik-Sat-Anschluss`
**Gewerke:** Elektrik, Sanitaer, Maler, Boden, Tueren, Fenster, Trockenbau, Kueche, Heizung, Allgemein
**Regel:** Keine Umlaute (ae, oe, ue)

---

### L087: Artikelnummer-Transformation bei Imports
**Kategorie:** Workflow
**Datum:** 2026-01-30
**Beispiel GWS:**
- Kunden-Format: `01.01.1`
- neurealis-Format: `GWS.LV23-01.01.1`
```javascript
const TRANSFORMATIONS = {
  'GWS': (nr) => 'GWS.LV23-' + nr,
  'VBW': (nr) => 'VBW-' + nr,
};
```

---

## Document Sync

### L040: Umlaute in Dateinamen
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** "Invalid key: hero-docs/Auftragsbestätigung-..."
**Lösung:** Filename-Sanitization vor Upload
```javascript
function sanitizeFilename(filename) {
  return filename
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}
```

---

*Vollständige Learnings siehe docs/learnings.md*
