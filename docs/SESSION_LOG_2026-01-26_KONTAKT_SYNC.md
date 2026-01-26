# Session Log: Kontakt-Sync & Duplikat-Bereinigung

**Datum:** 2026-01-26
**Thema:** MS365 Kontakt-Sync für service@neurealis.de + Duplikat-Bereinigung

---

## Zusammenfassung

- MS365 Kontakt-Sync erweitert um `service@neurealis.de` (company visibility)
- Duplikate erkannt und bereinigt (632 deaktiviert)
- 1.354 aktive Kontakte verbleiben

---

## Durchgeführte Änderungen

### 1. Edge Function `kontakte-sync-ms365` (v6)

**Datei:** `functions/supabase/functions/kontakte-sync-ms365/index.ts`

**Änderungen:**
- `kontakt@neurealis.de` durch `service@neurealis.de` ersetzt (kontakt@ ist nur Alias)
- JWT-Verifizierung deaktiviert für Cron-Aufrufe
- Hinweis im Code dokumentiert

**Konfigurierte Postfächer:**
| Postfach | Visibility | Owner |
|----------|------------|-------|
| `holger.neumann@neurealis.de` | private | holger.neumann@neurealis.de |
| `service@neurealis.de` | **company** | null (für alle sichtbar) |

### 2. Sync durchgeführt

**Ergebnis:**
- 725 Kontakte von `holger.neumann@` (private)
- 386 Kontakte von `service@` (company)
- 243 Kontakte von anderen Quellen (Hero, Monday)

### 3. Duplikat-Bereinigung

**AutoMerge mit Threshold 0.8:**
- 632 Duplikate zusammengeführt und deaktiviert
- Merge-Strategie: Älterer Kontakt (niedrigere kontakt_nr) = Primary

**Verbleibende Duplikate:** 107
- Grund: Unique-Constraint-Konflikte (beide Kontakte haben hero_id oder softr_record_id)
- Status: Manueller Review erforderlich

---

## Aktuelle Statistiken

| Metrik | Wert |
|--------|------|
| **Aktive Kontakte** | 1.354 |
| Deaktivierte (Duplikate) | 632 |
| Verbleibende Duplikate | 107 |
| Von holger.neumann@ | 725 (private) |
| Von service@ | 386 (company) |
| Von anderen Quellen | 243 (company) |

---

## Offene Punkte

### 1. Manueller Review der 107 verbleibenden Duplikate

**Problem:** Beide Kontakte im Duplikat-Paar haben bereits externe IDs (hero_id, softr_record_id), die unique sind.

**Query zum Anzeigen:**
```sql
SELECT
  k1.kontakt_nr, k1.firma_kurz, k1.email, k1.hero_id, k1.softr_record_id,
  k2.kontakt_nr, k2.firma_kurz, k2.email, k2.hero_id, k2.softr_record_id,
  d.match_type, d.confidence
FROM kontakte_find_duplicates() d
JOIN kontakte k1 ON d.kontakt_id = k1.id
JOIN kontakte k2 ON d.potential_duplicate_id = k2.id
WHERE d.confidence >= 0.8
  AND k1.aktiv = true AND k2.aktiv = true
ORDER BY d.confidence DESC;
```

**Lösung:** Manuell entscheiden welcher Kontakt der Primary ist, dann:
```sql
-- Option 1: Secondary deaktivieren (ohne Merge)
UPDATE kontakte SET aktiv = false WHERE id = 'secondary-uuid';

-- Option 2: Merge erzwingen (externe ID vom Secondary löschen)
UPDATE kontakte SET hero_id = NULL WHERE id = 'secondary-uuid';
SELECT kontakte_merge('primary-uuid', 'secondary-uuid');
```

### 2. Cron-Job Dokumentation aktualisieren

Der Cron-Job `kontakte-sync-ms365` synchronisiert jetzt beide Postfächer (täglich 03:00).

### 3. Softr-Integration prüfen

Kontakte mit `visibility = 'company'` sollten in Softr für alle Nutzer sichtbar sein.

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `functions/supabase/functions/kontakte-sync-ms365/index.ts` | service@ statt kontakt@, verify_jwt=false |
| `docs/NEUREALIS_KONTAKTE.md` | Version 2.1 |
| `docs/SESSION_LOG_2026-01-26_KONTAKT_SYNC.md` | NEU |

---

## Test-Befehle

```bash
# Manueller Sync (beide Postfächer)
curl https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365

# Nur service@
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/kontakte-sync-ms365?mailbox=service@neurealis.de"

# Duplikate anzeigen
SELECT * FROM kontakte_find_duplicates() WHERE confidence >= 0.8;

# AutoMerge (Threshold 0.8)
SELECT * FROM kontakte_auto_merge(0.8);
```

---

---

## Nachtrag: Softr View

### View `v_kontakte_softr` erstellt

**Zweck:** Lesbare Kontaktarten für Softr UI

**Spalten:**
- `kontaktart_text` → Lesbar: "Privatkunde", "Nachunternehmer", etc.
- `kontaktarten` → Original-Array für Filter
- `anzeigename` → Automatisch generiert (Name oder Firma)
- Alle Stammdaten, Kontaktdaten, Adressen

**Softr Konfiguration:**
- Schema: `public`
- View: `v_kontakte_softr`
- Filter-Spalte: `kontaktart_text`

**Dropdown-Werte für Softr:**
```
Privatkunde, Gewerbekunde, Interessent, Mitarbeiter, Baustellen-Mitarbeiter, Bewerber, Nachunternehmer, NU-Mitarbeiter, Partner, Lieferant, Ansprechpartner, Eigentümer, Hausverwaltung, Behörde
```

---

*Dokumentiert am 2026-01-26*
