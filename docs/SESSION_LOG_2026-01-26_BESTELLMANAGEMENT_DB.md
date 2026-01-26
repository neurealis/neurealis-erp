# Session Log - Bestellmanagement Datenbank

**Datum:** 2026-01-26
**Thema:** Bestellmanagement-Tabellen und KI-Parsing

---

## Implementiert

### 1. Datenbank-Tabellen (Migration: `create_bestellmanagement_tables`)

| Tabelle | Beschreibung | RLS |
|---------|--------------|-----|
| `grosshaendler` | Großhändler-Stammdaten (Name, Kontakt, Konditionen) | ✅ |
| `bestellartikel` | Artikelkatalog mit Embedding für KI-Suche | ✅ |
| `bestellungen` | Bestellkopfdaten mit KI-Parsing-Info | ✅ |
| `bestellpositionen` | Einzelpositionen mit Lieferstatus | ✅ |
| `mitarbeiter` | Mitarbeiter mit Supabase Auth-Verknüpfung | ✅ |

**Features:**
- Alle Tabellen mit RLS aktiviert
- Trigger für `updated_at`
- Indizes für Volltextsuche und Embeddings
- Verknüpfung zu `kontakte` und `projekte`

### 2. RPC-Funktion (Migration: `add_match_bestellartikel_rpc`)

```sql
match_bestellartikel(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_grosshaendler uuid
)
```

Semantische Artikelsuche via Embedding für das KI-Parsing.

### 3. Edge Function `parse-bestellung` (v2)

**Pfad:** `supabase/functions/parse-bestellung/index.ts`

**Features:**
- Mehrsprachiges Parsing (DE, HU, RU, RO)
- OpenAI gpt-5.2 für Artikelerkennung
- Embedding-basierte Artikelsuche
- Großhändler-Erkennung aus Text
- Confidence-Werte für jede Position

**Endpoint:**
```
POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/parse-bestellung
Authorization: Bearer <anon_key>
Content-Type: application/json

{
  "text": "10 Dreifachrahmen, 5 Steckdosen für Würth",
  "grosshaendler_id": "optional-uuid",
  "projekt_id": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "bezeichnung": "Dreifachrahmen",
      "menge": 10,
      "einheit": "Stück",
      "confidence": 0.95,
      "artikel_id": "uuid-if-matched",
      "einzelpreis": 4.50
    }
  ],
  "unerkannt": [],
  "grosshaendler_vorschlag": "Würth"
}
```

---

## Offene Punkte

1. **Artikellisten importieren** - Excel-Dateien vom User bereitstellen
2. **Großhändler-Stammdaten** - Initial-Daten eintragen
3. **SvelteKit UI** - Bestellformular erstellen
4. **Auth-Flow** - Mitarbeiter-Login implementieren

---

## Test-Befehle

```bash
# Tabellen prüfen
supabase db dump --schema public | grep -E "grosshaendler|bestellartikel|bestellungen|bestellpositionen|mitarbeiter"

# Edge Function testen
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/parse-bestellung" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"text": "10 Dreifachrahmen und 5 Steckdosen"}'
```

---

*Erstellt: 2026-01-26*
