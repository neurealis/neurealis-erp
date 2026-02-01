# Hero vs. Softr Dokumentenvergleich 2025

**Erstellt:** 2026-01-28
**Zeitraum:** 2025-01-01 bis heute

---

## Zusammenfassung

| Metrik | Hero 2025 | Softr 2025 | Differenz |
|--------|-----------|------------|-----------|
| **Rechnungen (RE)** | 119 | 71 | -48 fehlen in Softr |
| **Angebote (ANG)** | 176 | 176 | OK |
| **Auftragsbestätigungen (AB)** | 80 | 79 | -1 |
| **NU-Aufträge (NUA)** | 165 | 165 | OK |
| **Aufmaße (AFM)** | 22 | 4 | -18 fehlen in Softr |

---

## 1. Hero 2025 Dokumente nach Typ

### Rechnungen (invoice + reversal_invoice)

| Typ | Anzahl | Summe |
|-----|--------|-------|
| invoice (full) | 74 | ~1.200.000 EUR |
| invoice (parted/cumulative) | 28 | ~450.000 EUR |
| reversal_invoice | 17 | negative Beträge |
| **Gesamt** | **119** | |

### Angebote (offer)

| Typ | Anzahl | Kommentar |
|-----|--------|-----------|
| ANG-0021xxx (gültige Nr) | 176 | Hauptkategorie |
| ANG-0021xxxx (Entwürfe) | ~50 | value=0, ignorieren |

### Auftragsbestätigungen (confirmation)

| Typ | Anzahl | Kommentar |
|-----|--------|-----------|
| AB-013xx (gültige Nr) | 80 | |
| AB-013xxxx (Entwürfe) | ~15 | value=0, ignorieren |

### NU-Aufträge (measurement)

| Typ | Anzahl | Kommentar |
|-----|--------|-----------|
| NUA-xxx (gültige Nr) | 165 | NUA-203 bis NUA-367 |
| NUA-xxxx (Entwürfe) | ~30 | value=0, ignorieren |

### Aufmaße (measurement)

| Typ | Anzahl | Kommentar |
|-----|--------|-----------|
| AFM-xx (gültige Nr) | 22 | AFM-1 bis AFM-22 |
| AFM-xxxx (Entwürfe) | ~10 | value=0, ignorieren |

---

## 2. Duplikate in softr_dokumente (2025)

**KRITISCH: Massive Duplikate gefunden!**

| Dokument-Nr | Anzahl | Typen | Problem |
|-------------|--------|-------|---------|
| **ANG-0021294** | **159** | ANG-Ku Angebot Kunde | Massives Duplikat! |
| **NUA-358** | **36** | NUA-S, NUA-A | Viele Duplikate |
| **NUA-365** | **7** | NUA-A, NUA-S | |
| **NUA-357** | **5** | NUA-S, NUA-A, Budget-NU-P | |
| **ANG-0021284** | **5** | ANG-Ku, A Avis | |
| NUA-363 | 3 | NUA-A, NUA-S | |
| NUA-208 | 2 | NUA-S | |
| NUA-209 | 2 | NUA-S | |
| NUA-214 | 2 | NUA-S | |
| NUA-324 | 2 | - | |
| NUA-288 | 2 | - | |
| NUA-359 | 2 | NUA-S | |
| AB-01340 | 2 | AB | |
| AB-01335 | 2 | AB | |
| AB-01344 | 2 | AB | |
| AB-01345 | 2 | AB | |
| AB-01346 | 2 | AB | |
| AB-01347 | 2 | AB | |
| AB-013110 | 2 | AB | |

**Duplikat-Analyse:**
- 159 Einträge für ANG-0021294 ist ein massiver Bug!
- NUA-Duplikate entstehen durch NUA-A (Anfang) und NUA-S (Schluss) Einträge
- AB-Duplikate sind unkritisch (Revisionen)

---

## 3. Fehlende Dokumente in Softr

### 3.1 Fehlende Rechnungen (RE)

Die folgenden RE-Nummern sind in Hero vorhanden, aber NICHT in softr_dokumente (2025):

**Hero hat (119 RE), Softr hat (71 RE) = 48 fehlen**

Fehlende Nummernbereiche:
- RE-0015103, RE-0015134-0015147 (Storno-Kette)
- RE-0015149-0015153
- RE-0015155-0015160, RE-0015162-0015163
- RE-0015165-0015170, RE-0015173-0015174
- RE-0015177, RE-0015179-0015189, RE-0015191-0015199
- RE-0015201-0015208, RE-0015210-0015215, RE-0015217-0015218
- RE-0015220-0015231, RE-0015233, RE-0015235-0015267

### 3.2 Fehlende Aufmaße (AFM)

**Hero hat 22 AFMs (AFM-1 bis AFM-22), Softr hat nur 4**

Fehlende AFMs:
- AFM-1 bis AFM-3 (teilweise vorhanden)
- AFM-5 bis AFM-22 (komplett fehlend)

---

## 4. Datenqualitätsprobleme

### 4.1 NUA ohne Beträge

| Metrik | Wert |
|--------|------|
| **NUA gesamt (2025)** | 227 |
| **Ohne Betrag (betrag_netto = 0 oder NULL)** | 181 |
| **Anteil ohne Betrag** | **80%** |

Das ist ein bekanntes Problem. NUAs haben in Hero immer `value: 0`, da der Betrag erst bei der Rechnung erscheint.

### 4.2 Falsche Dokumenttypen

| Problem | Anzahl | Beispiel |
|---------|--------|----------|
| `{id=null, label=null}` | 45 | Leere Typen |
| Kombinierte Typen | 1 | NUA-A NU-Auftrag AnfangS Sonstiges |

---

## 5. Sync-Status (Hero Document Sync)

**Aktueller Stand:** Cron alle 15 Min

| Dokument-Typ | Hero → Softr | Status |
|--------------|--------------|--------|
| Rechnungen (RE) | AR-S / AR-A / AR-X | Aktiv |
| Angebote (ANG) | ANG-Ku | Aktiv |
| Auftragsbestätigungen (AB) | AB | Aktiv |
| NU-Aufträge (NUA) | NUA-S / NUA-A | Aktiv |
| Aufmaße (AFM) | - | **NICHT IMPLEMENTIERT** |

### Sync-Logik Dokumenttypen (invoice_style)

| Hero invoice_style | Hero type | Softr art_des_dokuments |
|--------------------|-----------|-------------------------|
| `full` | invoice | AR-S (Schluss) |
| `parted` | invoice | AR-A (Abschlag) |
| `cumulative` | invoice | AR-A (Abschlag) |
| `downpayment` | invoice | AR-A (Abschlag) |
| `null` (negativ) | reversal_invoice | AR-X (Storno) |
| - | offer | ANG-Ku |
| - | confirmation | AB |
| - | measurement | NUA-S / NUA-A |

---

## 6. Empfehlungen

### 6.1 Sofort-Maßnahmen

1. **ANG-0021294 Duplikate bereinigen**
   - 159 Einträge auf 1 reduzieren
   - SQL: `DELETE FROM softr_dokumente WHERE dokument_nr = 'ANG-0021294' AND id NOT IN (SELECT MIN(id) FROM softr_dokumente WHERE dokument_nr = 'ANG-0021294')`

2. **AFM-Sync aktivieren**
   - Edge Function `hero-document-sync` erweitern
   - Typ `measurement` mit `AFM-` Präfix als eigenen Typ behandeln

3. **Fehlende RE nachsynchronisieren**
   - 48 Rechnungen fehlen
   - Einmalige Migration durchführen

### 6.2 Mittelfristig

1. **NUA-Duplikate konsolidieren**
   - NUA-358 (36 Einträge) analysieren
   - Entscheiden: Nur NUA-S behalten oder beide (A+S)?

2. **Dokumenttypen standardisieren**
   - `{id=null, label=null}` auf korrekten Typ setzen
   - Kombinierte Typen aufteilen

### 6.3 Langfristig

1. **Unique Constraint auf dokument_nr**
   - Oder: Composite Key (dokument_nr + art_des_dokuments)

2. **Automatische Duplikat-Erkennung**
   - Vor jedem Sync prüfen

---

## 7. SQL für Bereinigung

```sql
-- 1. ANG-0021294 Duplikate entfernen (behalte ältesten)
DELETE FROM softr_dokumente
WHERE dokument_nr = 'ANG-0021294'
  AND id NOT IN (
    SELECT MIN(id) FROM softr_dokumente WHERE dokument_nr = 'ANG-0021294'
  );

-- 2. Alle Duplikate finden
SELECT
  dokument_nr,
  COUNT(*) as anzahl,
  STRING_AGG(DISTINCT art_des_dokuments, ', ') as typen
FROM softr_dokumente
WHERE dokument_nr IS NOT NULL AND dokument_nr != ''
GROUP BY dokument_nr
HAVING COUNT(*) > 1
ORDER BY anzahl DESC;

-- 3. NUA ohne Beträge zählen
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE betrag_netto IS NULL OR betrag_netto = 0) as ohne_betrag,
  ROUND(100.0 * COUNT(*) FILTER (WHERE betrag_netto IS NULL OR betrag_netto = 0) / COUNT(*), 1) as prozent
FROM softr_dokumente
WHERE dokument_nr LIKE 'NUA-%'
  AND datum_erstellt >= '2025-01-01';
```

---

*Erstellt: 2026-01-28 | neurealis ERP*
