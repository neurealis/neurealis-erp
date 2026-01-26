# Session Log: Mängel-Synchronisation

**Datum:** 2026-01-26
**Thema:** Mängelmanagement - Softr/Supabase Synchronisation

---

## Durchgeführte Arbeiten

### 1. Softr Mangel-ID Feld umgestellt
- Feld `1UqYa` von FORMULA auf SINGLE_LINE_TEXT geändert
- Ermöglicht Schreibzugriff von Supabase

### 2. Mangel-IDs aus Supabase nach Softr übertragen
- 26 Mängel mit `mangel_nr` (Format: ATBS-XXX-M*) befüllt
- Script: `functions/scripts/set-mangel-id.ps1`

### 3. Test-Mangel ATBS-456-M1 gelöscht
- War in Softr bereits gelöscht
- Aus Supabase entfernt (inkl. zugehöriger Notifications)

### 4. BV-Feld für alle Mängel ausgefüllt
- 21 Mängel ohne `projektname_komplett` identifiziert
- Projektnamen aus `monday_bauprozess` via ATBS-Nummer gematcht
- Supabase und Softr aktualisiert
- Script: `functions/scripts/update-mangel-bv.ps1`

### 5. Fehlende Mangel-IDs in Softr ergänzt
- 22 Mängel ohne Mangel-ID gefunden
- 19 produktive Mängel mit neuen IDs versehen
- 3 Test-Einträge gelöscht
- Script: `functions/scripts/set-missing-mangel-ids.ps1`

---

## Endstatus

| Komponente | Anzahl | Status |
|------------|--------|--------|
| Mängel in Softr | 48 | ✅ Alle mit Mangel-ID |
| Mängel in Supabase | 26 | ✅ Alle mit mangel_nr |
| BV-Feld | 100% | ✅ Ausgefüllt |

---

## Neue Scripts

| Script | Beschreibung |
|--------|--------------|
| `set-mangel-id.ps1` | Setzt Mangel-IDs von Supabase nach Softr |
| `update-mangel-bv.ps1` | Aktualisiert BV-Feld in Softr |
| `check-missing-mangel-id.ps1` | Prüft fehlende Mangel-IDs |
| `set-missing-mangel-ids.ps1` | Generiert fehlende IDs nach Schema |
| `delete-test-maengel.ps1` | Löscht Test-Einträge |

---

## Dokumentation aktualisiert

- `docs/SOFTR_SCHEMA.md` - Mangel-ID Feldtyp: FORMULA → SINGLE_LINE_TEXT
- `docs/NEUREALIS_MAENGELMANAGEMENT.md` - Version 7.2, Feld-Mapping ergänzt

---

## Mangel-ID Schema

Format: `ATBS-XXX-M*`

Beispiele:
- ATBS-299-M1, ATBS-299-M2, ATBS-299-M3
- ATBS-383-M1 bis ATBS-383-M7
- ATBS-438-M1 bis ATBS-438-M5

---

*Session abgeschlossen: 2026-01-26*
