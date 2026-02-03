# Learnings: Monday.com

Letzte Aktualisierung: 2026-02-03

---

## Sync / Integration

### L031: Bidirektional Sync
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** monday-sync pullt nur, pusht nicht
**Lösung:** Separate `monday-push` Edge Function
**Workflow:**
1. Supabase-Daten aktualisieren
2. `sync_status = 'pending_push'` setzen
3. monday-push triggern

---

### L148: sync_source Spalte für bidirektionalen Sync
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Werte:**
- `'monday'` - Pull von Monday
- `'supabase'` - Lokale Änderung
- `'pending'` - Push gesendet
- `'synced'` - Bestätigt synchron

---

### L149: Status-Spalten NICHT bidirektional pushen
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Fehler:** `ColumnValueException: This status label doesn't exist`
**Regel:** Status-Spalten NUR Monday → Supabase
**Sichere Spalten für Push:** Text, Number, Date, Link
**Unsichere Spalten:** Status/Color (color*, status*)

---

### L159: Last-Write-Wins für Konfliktlösung
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Implementierung:**
```sql
IF remote.updated_at > local.updated_at THEN UPDATE;
```
**Benötigt:** `last_modified_at` Spalte
**Wichtig:** UTC überall verwenden

---

## Column Values

### L128: column_values ist verschachtelt
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Problem:** `[object Object]` statt Projektnamen
```json
{
  "status__1": {"text": "(0) Offen", "value": null}
}
```
**Lösung:** `.text` für Anzeigewert
```javascript
const phase = row.column_values?.status__1?.text;
```

---

### L144: column_values Struktur variiert je Feldtyp
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Lösung:** Flexible Extraktion mit Fallbacks
```typescript
function extractFieldText(columnValues: any, ...fieldIds: string[]): string {
  for (const id of fieldIds) {
    const field = columnValues?.[id];
    if (!field) continue;
    if (typeof field === 'string') return field;
    if (field.text) return field.text;
    if (field.value) return field.value;
    if (field.label) return field.label;
  }
  return '';
}
```

---

### L146: "Status | Projekt" ist status06__1 (NICHT status__1)
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Problem:** Bot fand keine Projekte bei Phasen-Auswahl
**Monday hat 338 column_value Keys!**
**Regel:** Immer in DB verifizieren
```sql
SELECT DISTINCT column_values->'status06__1'->>'text', COUNT(*)
FROM monday_bauprozess GROUP BY 1;
```

---

### L147: JSONB-Felder in echte Spalten flattenen
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Problem:** JSONB-Zugriff umständlich und langsam
**Lösung:**
```sql
ALTER TABLE monday_bauprozess
ADD COLUMN atbs_nummer TEXT,
ADD COLUMN status_projekt TEXT;

UPDATE monday_bauprozess SET
  atbs_nummer = column_values->'text49__1'->>'text';

CREATE INDEX idx_monday_status ON monday_bauprozess(status_projekt);
```

---

### L152: Gewerk-Status-Spalten IDs
**Kategorie:** Technisch
**Datum:** 2026-02-01
**Referenz:** docs/MONDAY_COLUMN_MAPPING.md
| Gewerk | Korrekte ID |
|--------|-------------|
| Elektrik | `color58__1` |
| Sanitär | `color65__1` |
| Maler | `color63__1` |
| Boden | `color8__1` |
| Tischler | `color98__1` |
| Entkernung | `color05__1` |

---

## Feld-Mappings

### L144: Präfix-Konvention nu_/bl_/ag_
**Kategorie:** Business
**Datum:** 2026-02-01

**NU (Nachunternehmer):**
| Monday-Spalte | Supabase |
|---------------|----------|
| Nachunternehmer | `nu_firma` |
| Ansprechpartner \| NU | `nu_ansprechpartner` |
| Telefon \| NU | `nu_telefon` |
| E-Mail \| NU | `nu_email` |

**BL (Bauleiter):**
- `bl_name`, `bl_email`, `bl_telefon`

**AG (Auftraggeber):**
- `ag_name`, `ag_nummer`, `ag_email`, `ag_telefon`

---

### L032: NUA-Budget-Berechnung
**Kategorie:** Business
**Datum:** 2026-01-28
**Formel:** `NUA_Netto = SUM(AB_Netto) * 0.75`
**Rohertrag:** 25% Marge

---

### L051: Ausführungsarten und Nachweis-Anforderungen
**Kategorie:** Business
**Datum:** 2026-01-28

**Elektrik (color590__1):**
| Ausführung | Rohinstallation | E-Check |
|------------|-----------------|---------|
| Komplett | ja | ja |
| Teil-Mod | nein | ja |
| Nur E-Check | nein | ja |
| Ohne | nein | nein |

**Bad (status23__1):**
| Ausführung | Rohinstallation | Abdichtung |
|------------|-----------------|------------|
| Komplett | ja | ja |
| Fliese auf Fliese | nein | ja |
| Nur Austausch | nein | nein |

---

### L097: Auftraggeber aus Projektnamen extrahieren
**Kategorie:** Technisch
**Datum:** 2026-01-30
**Format:** "AG | Adresse | Details"
```typescript
const firstPart = projektName.split('|')[0].trim().toLowerCase();
if (firstPart === 'vbw') return 'VBW';
if (firstPart === 'gws') return 'GWS';
```

---

*Vollständige Learnings siehe docs/learnings.md*
