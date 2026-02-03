# Telegram Nachtrag LV-Matching - Koordination

**Status:** 🔄 IN ARBEIT
**Datum:** 2026-02-03
**Ticket:** Telegram Bot Erweiterung v87

## Anforderungen

| # | Feature | Status | Subagent |
|---|---------|--------|----------|
| 1 | LV-Matching bei Nachträgen (GPT + Preise) | ⏳ | T1 |
| 2 | Foto zu bestehendem Nachtrag hinzufügen | ⏳ | T2 |
| 3 | Foto zu bestehendem Mangel hinzufügen | ⏳ | T2 |
| 4 | Mangel Standard-Frist: 3 Tage (statt 7) | ⏳ | T3 |
| 5 | LV-Auswahl wie CPQ (Funktionen wiederverwenden) | ⏳ | T1 |

## Auftraggeber → LV-Typ Mapping

```typescript
const LV_TYP_MAPPING: Record<string, string> = {
  'VBW': 'vbw',
  'Vonovia': 'vonovia',
  'GWS': 'gws',
  'Covivio': 'covivio',
  'GEWOBAG': 'gewobag',
  'degewo': 'degewo'
};

// Ermittlung aus projekt.name oder projekt.auftraggeber
function getLvTypFromProjekt(projekt: any): string | null {
  const name = projekt.name?.toUpperCase() || '';
  const auftraggeber = projekt.auftraggeber?.toUpperCase() || '';

  for (const [key, value] of Object.entries(LV_TYP_MAPPING)) {
    if (name.includes(key.toUpperCase()) || auftraggeber.includes(key.toUpperCase())) {
      return value;
    }
  }
  return null; // Kein spezifischer LV-Typ → alle LV-Typen
}
```

## Subagenten-Tasks

### T1: DEV-NACHTRAG-LV (Backend-Logik)

**Dateien:**
- `supabase/functions/telegram-webhook/handlers/nachtrag.ts`
- `supabase/functions/telegram-webhook/utils/lv_matching.ts` (NEU)

**Aufgaben:**
- [ ] Auftraggeber aus Projekt ermitteln (JOIN bauprojekte)
- [ ] LV-Typ-Mapping implementieren
- [ ] GPT-Parsing für Positionen (Menge, Einheit, Gewerk)
- [ ] LV-Position-Matching mit Embedding-Fallback (wie CPQ)
- [ ] Netto-Summe berechnen und in nachtraege speichern
- [ ] Wiederverwendbare Funktionen aus transcription-parse nutzen

### T2: DEV-FOTO-AUSWAHL (Callback-Handler)

**Dateien:**
- `supabase/functions/telegram-webhook/handlers/foto_hinzufuegen.ts` (NEU)
- `supabase/functions/telegram-webhook/index.ts` (Router erweitern)

**Aufgaben:**
- [ ] `/foto_hinzufuegen` Command oder Callback
- [ ] Liste offene Nachträge des Projekts anzeigen (Inline-Buttons)
- [ ] Liste offene Mängel des Projekts anzeigen (Inline-Buttons)
- [ ] Foto-Upload zu ausgewähltem Eintrag
- [ ] Session-Modus für Foto-Sammlung

### T3: DEV-MANGEL-FRIST (Quick Fix)

**Dateien:**
- `supabase/functions/telegram-webhook/handlers/mangel.ts`

**Aufgaben:**
- [ ] Standard-Frist von 7 auf 3 Tage ändern
- [ ] Prüfen ob frist_bis korrekt berechnet wird

## Datenbank-Kontext

```sql
-- nachtraege Tabelle
CREATE TABLE nachtraege (
  id UUID PRIMARY KEY,
  bv_id UUID REFERENCES bauprojekte(id),
  nachtragsnummer TEXT,
  beschreibung TEXT,
  foto_urls TEXT[],
  gemeldet_von TEXT, -- NU/BL/telegram
  positionen JSONB, -- [{menge, einheit, lv_position_id, preis}]
  netto_summe NUMERIC,
  status TEXT DEFAULT 'offen',
  created_at TIMESTAMPTZ
);

-- lv_positionen für Matching
CREATE TABLE lv_positionen (
  id UUID PRIMARY KEY,
  lv_typ TEXT, -- vbw, gws, vonovia, etc.
  position_nr TEXT,
  bezeichnung TEXT,
  einheit TEXT,
  preis NUMERIC,
  embedding vector(1536)
);
```

## Fortschritt

| Agent | Status | Ergebnis |
|-------|--------|----------|
| T1: DEV-NACHTRAG-LV | ✅ Fertig | utils/lv_matching.ts + nachtrag.ts erweitert |
| T2: DEV-FOTO-AUSWAHL | ✅ Fertig | handlers/foto_hinzufuegen.ts + index.ts Callbacks |
| T3: DEV-MANGEL-FRIST | ✅ Fertig | mangel.ts: 7→3 Tage |

## Deployment

**Version:** v87-foto-hinzufuegen
**Status:** ⏳ Bereit für Deploy

---
*Koordination erstellt: 2026-02-03*
