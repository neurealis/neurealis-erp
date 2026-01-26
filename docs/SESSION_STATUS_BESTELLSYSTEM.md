# Session Status - Bestellsystem

**Stand:** 2026-01-26 (Session 3)
**Für Chat-Fortsetzung**

---

## Zusammenfassung

Bestellformular funktionsfähig mit Großhändler-Filter. UI zeigt nur Artikel des ausgewählten Lieferanten. KI-Erkennung matcht semantisch nur innerhalb des Lieferanten-Katalogs. Mobile-optimierte Eingabe mit +/- Buttons.

---

## Was ist fertig

### Datenbank (Supabase)

| Tabelle | Zeilen | Beschreibung |
|---------|--------|--------------|
| `grosshaendler` | 20 | Großhändler mit erweiterten Feldern |
| `bestellartikel` | 225 | Artikelkatalog **mit Embeddings** |
| `bestellungen` | 0 | Bestellkopfdaten |
| `bestellpositionen` | 0 | Einzelpositionen |

**Embeddings:**
- `embedding` - Vektor für `bezeichnung` (225/225)
- `embedding_kurz` - Vektor für `kurzbezeichnung` (225/225)

**RPC-Funktion:** `match_bestellartikel` für semantische Artikelsuche

### Edge Functions

| Function | Version | Status |
|----------|---------|--------|
| `parse-bestellung` | **v9** | ✅ Mit `grosshaendler_id` Filter |
| `generate-embeddings` | v2 | ✅ Batch-Generierung für Artikel |

### SvelteKit UI (`ui/src/routes/bestellung/+page.svelte`)

| Feature | Status |
|---------|--------|
| Projekt-Dropdown | ✅ `monday_bauprozess` (Phasen 2,3,4) |
| Großhändler-Dropdown | ✅ Lädt Artikel bei Wechsel neu |
| Artikel-Filter | ✅ Nur Artikel des ausgewählten Händlers |
| KI-Erkennung | ✅ Mit `grosshaendler_id` (semantische Suche gefiltert) |
| +/- Buttons | ✅ Mobile-optimierte Mengeneingabe |
| Kurzname-Toggle | ✅ Langname bei Klick anzeigen |
| Bestellung speichern | ❌ Noch nicht implementiert |

---

## UI-Struktur (aktuell)

```
┌─────────────────────────────────────────────────────────┐
│ Neue Bestellung                          Holger Neumann │
├─────────────────────────────────────────────────────────┤
│ Projekt & Lieferung                                     │
│ ┌──────────────────┐  ┌──────────────────┐              │
│ │ ATBS-Nr / Projekt│  │ Großhändler ▼    │              │
│ └──────────────────┘  │ → lädt Artikel   │              │
│                       └──────────────────┘              │
│ ┌──────────────────┐  ┌──────────────────┐              │
│ │ Lieferort ▼      │  │ Lieferdatum      │              │
│ └──────────────────┘  └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│ Artikel eingeben                                        │
│ ┌─────────────────────────────────┐ ┌─────────────────┐ │
│ │ Freitext-Eingabe (mehrsprachig) │ │ ✨ KI-Erkennung │ │
│ └─────────────────────────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Artikelkatalog [ZANDER]                                 │
│ ┌───────────────────┬────────┬─────────┬──────────────┐ │
│ │ Bezeichnung       │ Einheit│ EK netto│    Menge     │ │
│ ├───────────────────┼────────┼─────────┼──────────────┤ │
│ │ Kurzname ▶        │ Stk    │ 5,87 €  │ [−] 0 [+]   │ │
│ │ (Klick→Langname)  │        │         │              │ │
│ └───────────────────┴────────┴─────────┴──────────────┘ │
├─────────────────────────────────────────────────────────┤
│ [← Zurück]    Summe: 0,00 €    [Weiter zur Bestätigung]│
└─────────────────────────────────────────────────────────┘
```

---

## Datenfluss

```
1. Großhändler auswählen
   ↓
2. loadArtikelFuerHaendler(haendlerId)
   → SELECT * FROM bestellartikel WHERE grosshaendler_id = ?
   ↓
3. Artikel-Tabelle zeigt nur diese Artikel
   ↓
4. KI-Erkennung: parseArtikelText(text, grosshaendler_id)
   → Edge Function matcht nur Artikel dieses Händlers
   ↓
5. Erkannte Artikel werden in bestellpositionen Map gesetzt
```

---

## Wichtige Code-Stellen

### `ui/src/lib/supabase.ts`
```typescript
export async function parseArtikelText(
  text: string,
  grosshaendler_id?: string  // NEU: Filter
): Promise<{...}>
```

### `ui/src/routes/bestellung/+page.svelte`
```typescript
// State
let expandedArtikel = $state<Set<string>>(new Set());

// Bei Händler-Wechsel
async function onHaendlerChange(event: Event) {
  selectedHaendler = select.value;
  await loadArtikelFuerHaendler(selectedHaendler);
}

// Kurzname-Toggle
function toggleBezeichnung(artikelId: string) {...}
```

---

## Was fehlt (Nächste Session)

### Priorität 1 - Bestellung speichern
- [ ] Button "Weiter zur Bestätigung" implementieren
- [ ] INSERT in `bestellungen` Tabelle
- [ ] INSERT in `bestellpositionen` für jede Position
- [ ] Erfolgsmeldung anzeigen

### Priorität 2 - UX-Verbesserungen
- [ ] Suchfeld für Artikel
- [ ] Kategorien-Filter
- [ ] Letzte Bestellungen anzeigen

### Priorität 3 - Großhändler-Daten
- [ ] Kundennummern eintragen
- [ ] Konditionen (Rabatt, Skonto)

---

## Quick Commands

```bash
# Dev-Server starten
cd /c/Users/holge/neurealis-erp/ui && npm run dev
# → http://localhost:5173/bestellung

# KI-Erkennung testen (mit Großhändler-Filter)
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/parse-bestellung" \
  -H "Content-Type: application/json" \
  -d '{"text": "10 Schalter", "grosshaendler_id": "UUID-hier"}'

# Embeddings neu generieren (falls neue Artikel)
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/generate-embeddings" \
  -H "Content-Type: application/json" \
  -d '{"limit": 500}'
```

---

## Relevante Dateien

| Pfad | Beschreibung |
|------|--------------|
| `ui/src/routes/bestellung/+page.svelte` | Bestellformular (Haupt-UI) |
| `ui/src/lib/supabase.ts` | Supabase Client + parseArtikelText |
| `functions/supabase/functions/parse-bestellung/index.ts` | KI-Parsing Edge Function |
| `functions/supabase/functions/generate-embeddings/index.ts` | Embedding-Generator |
| `docs/NEUREALIS_BESTELLSYSTEM.md` | Hauptdokumentation |

---

## Änderungen dieser Session

1. **Großhändler-Filter**: Artikel werden nach Händler gefiltert
2. **KI mit Filter**: `parseArtikelText` akzeptiert `grosshaendler_id`
3. **+/- Buttons**: Ersetzt Zahlen-Input für mobile Nutzung
4. **Kurzname-Toggle**: Langname nur bei Klick sichtbar
5. **Spalte "Summe" entfernt**: Cleaner UI
6. **Artikelnummer ausgeblendet**: Nur Bezeichnung sichtbar

---

## Artikel-Verteilung nach Großhändler

Die meisten Artikel (225) sind **Zander** zugeordnet. Bei anderen Händlern ist die Liste leer, bis Artikel importiert werden.

---

*Aktualisiert: 2026-01-26 Session 3*
