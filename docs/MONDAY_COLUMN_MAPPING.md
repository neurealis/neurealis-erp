# Monday.com Board Column Mapping

**Board ID:** 1545426536
**Board Name:** Bauprozess
**Stand:** 2026-02-01

---

## Uebersicht

| Metrik | Wert |
|--------|------|
| **Monday-Spalten Total** | 338 |
| **Supabase-Spalten Total** | 97 |
| **Gemappte Spalten** | ~45 |
| **Strategie** | D039 - Nur wichtige Spalten flattenen |

### Strategie

Basierend auf Decision D039 werden nur die wichtigsten Monday-Spalten als echte Supabase-Spalten synchronisiert. Der Rest bleibt im `column_values` JSONB-Feld verfuegbar und kann bei Bedarf abgefragt werden.

**Grund:** 338 Spalten in eine relationale Struktur zu replizieren waere zu aufwendig und schwer wartbar. Die JSONB-Struktur ermoeglicht flexible Abfragen ohne Schema-Aenderungen.

---

## Kernfelder (Core Identification)

| Monday ID | Monday Titel | Typ | Supabase Spalte | Sync |
|-----------|--------------|-----|-----------------|------|
| `text49__1` | ATBS-Nummer | text | `atbs_nummer` | Monday -> Supabase |
| `status06__1` | Status Projekt (Phase 0-9) | status | `status_projekt` | Bidirektional |
| `text_mkm11jca` | Auftraggeber | text | `auftraggeber` | Monday -> Supabase |
| `text51__1` | Adresse | text | `adresse` | Monday -> Supabase |
| `text_mkn8ggev` | Bauleiter | text | `bauleiter` | Monday -> Supabase |
| `text57__1` | Nachunternehmer | text | `nachunternehmer` | Monday -> Supabase |

### Status Projekt Werte

```
(0) Lead
(1) Erstbegehung
(2) Angebot
(3) Vorbereitung
(4) Umsetzung
(5) Abnahme
(6) Abrechnungsphase
(9) Auftrag nicht erhalten
```

---

## Finanzen

| Monday ID | Monday Titel | Typ | Supabase Spalte | Sync |
|-----------|--------------|-----|-----------------|------|
| `zahlen1__1` | Budget (Netto) | numeric | `budget` | Bidirektional |
| `zahlen77__1` | Budget (Brutto) | numeric | - | Berechnet |
| `zahlen4__1` | Wohnflaeche (qm) | numeric | `wohnflaeche` | Monday -> Supabase |
| `zahlen2__1` | Anzahl Zimmer | numeric | `anzahl_zimmer` | Monday -> Supabase |

---

## Datum-Felder

| Monday ID | Monday Titel | Typ | Supabase Spalte | Sync |
|-----------|--------------|-----|-----------------|------|
| `datum2__1` | Baustart | date | `baustart` | Bidirektional |
| `datum7__1` | Bauende | date | `bauende` | Bidirektional |
| `date_mkna2sbd` | Erstbegehung | date | `datum_erstbegehung` | Monday -> Supabase |
| `date_mkna9vad` | Auszug | date | `datum_auszug` | Monday -> Supabase |
| `date_mknaefc4` | Uebergabe | date | `datum_uebergabe` | Monday -> Supabase |
| `date_mkpg9y5s` | Endbegehung | date | `datum_endbegehung` | Monday -> Supabase |

---

## Links

| Monday ID | Monday Titel | Typ | Supabase Spalte | Sync |
|-----------|--------------|-----|-----------------|------|
| `link__1` | Hero Link | link | `hero_link` | Monday -> Supabase |
| `link_mkn3rkcq` | OneDrive Link | link | `onedrive_link` | Monday -> Supabase |
| `link_mknhrdg0` | Matterport Link | link | `matterport_link` | Monday -> Supabase |

### Link-Extraktion

Links sind in Monday als JSON gespeichert. Extraktion:
```sql
(column_values->>'link__1'->>'value')::jsonb->>'url'
```

---

## Gewerk-Status

| Monday ID | Monday Titel | Supabase Spalte | Werte |
|-----------|--------------|-----------------|-------|
| `color58__1` | Status Elektrik | `status_elektrik` | Geplant, In Arbeit (Rohinstallation), Fertig (Feininstallation), Verspaetet |
| `color65__1` | Status Sanitaer | `status_sanitaer` | Geplant, In Arbeit (Rohinstallation), Fertig (Feininstallation), Verspaetet |
| `color63__1` | Status Maler | `status_maler` | Geplant, In Arbeit, Fertig, Verspaetet |
| `color8__1` | Status Boden | `status_boden` | Geplant, Fertig, Verspaetet |
| `color98__1` | Status Tischler | `status_tischler` | Geplant, In Arbeit, Fertig |
| `color05__1` | Status Abbruch | `status_abbruch` | Geplant, In Arbeit, Fertig, Verspaetet |

---

## Ausfuehrungsart

| Monday ID | Monday Titel | Supabase Spalte | Werte |
|-----------|--------------|-----------------|-------|
| `color590__1` | Ausfuehrung Elektrik | `ausfuehrung_elektrik` | Komplett, Teil-Mod, Nur E-Check, Ohne |
| `color49__1` | Ausfuehrung Heizung | `ausfuehrung_sanitaer` | Neue Therme, Therme versetzen, Ohne Therme |
| `color427__1` | Ausfuehrung Waende | column_values | Raufaser & Anstrich, Q2 & Anstrich, 2x Anstrich |
| `color78__1` | Ausfuehrung Boden | column_values | Laminat, Vinyl (Click), Fliesen, Holz schleifen |
| `color97__1` | Ausfuehrung Tueren | column_values | Neu, Lackieren, Ohne |

---

## Dokument-Status

| Monday ID | Monday Titel | Supabase Spalte | Werte |
|-----------|--------------|-----------------|-------|
| `status__1` | Status Vorabfrage | `status_vorabfrage` | (0) Offen, (2) Verschickt/nicht erforderlich |
| `color6__1` | Status Abschlag | `status_abschlag` | (0) Offen, (2) Verschickt, (3) Ueberfaellig, (4) Bezahlt |
| `color2__1` | Status Schlussrechnung | `status_schlussrechnung` | (0) Noch erstellen, (6) Unbezahlt, (8) Bezahlt |
| `color4__1` | Status NUA | `status_nua` | Offen, An NU geschickt, Unterzeichnet |

---

## Kontakt

| Monday ID | Monday Titel | Typ | Supabase Spalte | Extraktion |
|-----------|--------------|-----|-----------------|------------|
| `e_mail4__1` | E-Mail Kunde | email | `email_kunde` | `->>'value')::jsonb->>'email'` |
| `telefon___kunde__1` | Telefon Kunde | phone | `telefon_kunde` | `->>'value')::jsonb->>'phone'` |
| `text573__1` | Ansprechpartner Vorname | text | `ansprechpartner` | `->>'text'` |
| `text_1__1` | Anrede Kunde | text | column_values | Herr/Frau |

---

## Monday Spalten-Typen (Zusammenfassung)

| Typ | Anzahl | Beispiele |
|-----|--------|-----------|
| **text** | 46 | ATBS-Nummer, Adresse, Bauleiter |
| **status/color** | 71 | Phasen, Gewerk-Status, Ausfuehrungsart |
| **date** | 46 | Baustart, Bauende, Auszug |
| **numeric** | 35 | Budget, Wohnflaeche, Zimmer |
| **link** | 26 | Hero, OneDrive, Matterport |
| **formula** | 26 | Berechnete Werte |
| **file** | 5 | Angebot, Aufmass |
| **button** | 13 | Workflows |
| **duplicate** | 16 | Spiegel-Spalten |
| **other** | 54 | Board Relations, Personen, etc. |

---

## Unmapped Supabase-Spalten

Folgende Supabase-Spalten haben kein direktes Monday-Mapping und werden entweder berechnet oder manuell befuellt:

### Berechnete Werte (aus anderen Tabellen)
- `anzahl_nachtraege` - COUNT aus `nachtraege` Tabelle
- `summe_nachtraege` - SUM aus `nachtraege` Tabelle
- `anzahl_maengel_offen` - COUNT aus `maengel_fertigstellung` Tabelle
- `status_nachtraege` - Aggregiert aus `nachtraege`
- `status_maengel` - Aggregiert aus `maengel_fertigstellung`
- `nua_netto` - 75% von Budget (D012)
- `abschlag_summe` - SUM aus `softr_dokumente`
- `fortschritt_gesamt` - Berechnet aus Gewerk-Status

### Extrahierte Werte
- `hero_projekt_id` - Aus `hero_link` URL extrahiert
- `kundenname` - Aus `name` (Teil vor `|`)
- `projektname_komplett` - Entspricht `name`

### Noch nicht identifiziert in Monday
- `status_heizung`, `status_fliesen`, `status_putz`
- `status_kuechenmontage`, `status_rolladen`, `status_fenster`, `status_brandschutz`
- `ausfuehrung_bad`, `ausfuehrung_kueche`, `ausfuehrung_flur`
- `ausfuehrung_wohnzimmer`, `ausfuehrung_schlafzimmer`
- `datum_kundenabnahme`, `datum_angebot`, `datum_ab`, `datum_schlussrechnung`, `datum_nua`
- `bauleiter_email`, `bauleiter_telefon` (via Kontakt-Lookup)

---

## Sync-Implementation

### Extraktion aus column_values

**Einfache Text/Status-Werte:**
```sql
column_values->>'text49__1'->>'text'
```

**Numerische Werte:**
```sql
(column_values->>'zahlen1__1'->>'text')::numeric
```

**Datum-Werte:**
```sql
(column_values->>'datum2__1'->>'text')::date
```

**JSON-verschachtelte Werte (Links, E-Mails):**
```sql
(column_values->>'link__1'->>'value')::jsonb->>'url'
(column_values->>'e_mail4__1'->>'value')::jsonb->>'email'
```

### Loop-Vermeidung

Bidirektionaler Sync nutzt `sync_source` Spalte:
- `'monday'` - Aenderung kam von Monday
- `'supabase'` - Aenderung kam von Supabase

```sql
-- Nur updaten wenn source != monday
UPDATE monday_bauprozess
SET ...
WHERE sync_source != 'monday' OR sync_source IS NULL;
```

### Bidirektionale Spalten

Nur diese Spalten werden in beide Richtungen synchronisiert:
- `status_projekt` (status06__1)
- `budget` (zahlen1__1)
- `baustart` (datum2__1)
- `bauende` (datum7__1)

Alle anderen sind Monday -> Supabase only.

---

## Verwendung des Mappings

### JSON-Mapping laden

```javascript
const mapping = await import('./monday_column_mapping.json');

// Alle gemappten Spalten durchgehen
for (const category of Object.keys(mapping.mapped_columns)) {
  for (const col of mapping.mapped_columns[category]) {
    if (col.supabase_column) {
      console.log(`${col.monday_id} -> ${col.supabase_column}`);
    }
  }
}
```

### SQL-Beispiel: Flattening

```sql
UPDATE monday_bauprozess SET
  atbs_nummer = column_values->'text49__1'->>'text',
  status_projekt = column_values->'status06__1'->>'text',
  auftraggeber = column_values->'text_mkm11jca'->>'text',
  adresse = column_values->'text51__1'->>'text',
  bauleiter = column_values->'text_mkn8ggev'->>'text',
  nachunternehmer = column_values->'text57__1'->>'text',
  budget = (column_values->'zahlen1__1'->>'text')::numeric,
  baustart = (column_values->'datum2__1'->>'text')::date,
  bauende = (column_values->'datum7__1'->>'text')::date
WHERE column_values IS NOT NULL;
```

---

## Naechste Schritte

1. **monday-sync Function erweitern:** Flattening beim Sync
2. **monday-push Function:** Bidirektionale Spalten zurueckschreiben
3. **Trigger:** Automatisches Flattening bei INSERT/UPDATE
4. **Noch fehlende Spalten identifizieren:** Monday Board inspizieren

---

*Erstellt: 2026-02-01*
*Maschinenlesbares Mapping: `docs/monday_column_mapping.json`*
