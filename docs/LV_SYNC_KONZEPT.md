# LV-Positionen Sync-Konzept

**Erstellt:** 2026-01-30
**Status:** Entwurf - Zur Freigabe

---

## 1. Ziel-Architektur

```
                           ┌─────────────────────────────────────┐
                           │         SUPABASE (MASTER)           │
                           │         lv_positionen               │
                           │                                     │
                           │  ┌─────────────────────────────┐   │
                           │  │  KI-Positionserstellung     │   │
                           │  │  - Beschreibung generieren  │   │
                           │  │  - Ähnliche finden          │   │
                           │  │  - Preis vorschlagen        │   │
                           │  └─────────────────────────────┘   │
                           └───────────────┬───────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │      HERO       │          │     SOFTR       │          │  NEUREALIS ERP  │
    │  (Lieferanten)  │          │    (Backup)     │          │   (SvelteKit)   │
    │                 │          │                 │          │                 │
    │ ✅ Import LVs   │          │ ✅ Read-only    │          │ ✅ UI für CRUD  │
    │ ✅ Export neue  │          │ ✅ Auto-sync    │          │ ✅ KI-Features  │
    └─────────────────┘          └─────────────────┘          └─────────────────┘
```

### Datenfluss-Übersicht

| Richtung | Trigger | Frequenz | Edge Function |
|----------|---------|----------|---------------|
| Hero → Supabase | Cron | Täglich 03:00 | `hero-lv-sync` (existiert) |
| Supabase → Softr | DB-Trigger | Bei INSERT/UPDATE | `lv-softr-push` (NEU) |
| Supabase → Hero | DB-Trigger | Bei INSERT (neue Pos.) | `lv-hero-push` (NEU) |
| ERP → Supabase | API | Direkt | Standard Supabase Client |

---

## 2. Komponenten-Übersicht

### 2.1 Bestehende Komponenten

| Komponente | Status | Funktion |
|------------|--------|----------|
| `hero-lv-sync` | ✅ Aktiv | Hero → Supabase (täglich 03:00) |
| `search-lv` | ✅ Aktiv | Semantische Suche via Embeddings |
| `lv_positionen` | ✅ Aktiv | 3.057 Positionen, alle mit Embeddings |

### 2.2 Neue Komponenten

| Komponente | Typ | Funktion |
|------------|-----|----------|
| `lv-softr-push` | Edge Function + Trigger | Supabase → Softr sync |
| `lv-hero-push` | Edge Function + Trigger | Supabase → Hero (neue Positionen) |
| `lv-generate` | Edge Function | KI-Positionserstellung |
| `lv-extract-transcript` | Edge Function | Transkript → LV-Positionen |

---

## 3. Phase 1: Bidirektionaler Sync

### 3.1 Initial-Push Supabase → Softr

**Umfang:** 1.485 Positionen ohne `softr_record_id`

| LV-Typ | Anzahl | Aktion |
|--------|--------|--------|
| GWS | 528 | Push |
| covivio | 488 | Push |
| Privat | 247 | Push |
| VBW | 157 | Push |
| WBG Lünen | 43 | Push |
| neurealis | 22 | Push |

**Softr Tabelle:** `WdY5U4LHNzDAsW` (Leistungsverzeichnisse)

**Field-Mapping Supabase → Softr:**

| Supabase | Softr Field | Softr Field ID |
|----------|-------------|----------------|
| `artikelnummer` | Artikelnummer | `fX6z9` |
| `lv_typ` | LV (Kundenname) | `WusrR` |
| `gewerk` | Kategorie | `l8T6y` |
| `bezeichnung` | Positionsname | `NKqqp` |
| `beschreibung` | Beschreibung | `qhXBj` |
| `listenpreis` | Listenpreis | `NdeN1` |
| `preis` | EK | `BQUj5` |
| `einheit` | Einheit | `zcJHy` |
| `aktiv` | Status | `UlFn5` |

### 3.2 Edge Function: lv-softr-push

```typescript
// Trigger: AFTER INSERT OR UPDATE ON lv_positionen
// Aktion: Upsert zu Softr via API

Endpoint: POST https://tables-api.softr.io/api/v1/databases/{DB_ID}/tables/WdY5U4LHNzDAsW/records
Header: Softr-Api-Key: {SOFTR_API_KEY}

// Bei INSERT: POST neuen Record
// Bei UPDATE: PATCH bestehenden Record (via softr_record_id)
```

### 3.3 Edge Function: lv-hero-push

```typescript
// Trigger: AFTER INSERT ON lv_positionen WHERE source != 'hero'
// Aktion: Neue Position in Hero anlegen

Mutation: createSupplyProductVersion {
  nr: artikelnummer
  name: bezeichnung
  description: beschreibung
  base_price: preis
  list_price: listenpreis
  supply_operator: { name: lv_typ_to_operator_mapping }
}
```

**Operator-Mapping (Reverse):**

| lv_typ | Hero supply_operator |
|--------|---------------------|
| GWS | GWS 2025-01 |
| VBW | VBW 2025-01 |
| covivio | Covivio 2024-10 |
| WBG Lünen | WBG Lünen |
| Privat/neurealis | (kein Operator) |

---

## 4. Phase 2: KI-Positionserstellung

### 4.1 Workflow

```
┌────────────────────────────────────────────────────────────┐
│                    NEUREALIS ERP UI                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Neue LV-Position erstellen                           │ │
│  │                                                      │ │
│  │ Kurzname: [Duschrinne Edelstahl 80cm____________]   │ │
│  │                                                      │ │
│  │ LV-Typ:   [GWS ▼]  Gewerk: [Bad ▼]                  │ │
│  │                                                      │ │
│  │ [🤖 KI-Vorschlag generieren]                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ KI-Vorschlag:                                        │ │
│  │                                                      │ │
│  │ Artikelnummer: Bad-DuschrinneEdelstahl80cm          │ │
│  │                                                      │ │
│  │ Beschreibung:                                        │ │
│  │ Duschrinne aus Edelstahl, Länge 80 cm, inkl.        │ │
│  │ Ablaufgarnitur DN 50, seitlicher Ablauf,            │ │
│  │ Fliesenmulde für bündigen Einbau. Material:         │ │
│  │ V4A Edelstahl gebürstet.                            │ │
│  │                                                      │ │
│  │ Einheit: Stück                                       │ │
│  │                                                      │ │
│  │ Preisvorschlag: 185,00 € (basierend auf 3           │ │
│  │ ähnlichen Positionen)                                │ │
│  │                                                      │ │
│  │ Ähnliche Positionen gefunden:                        │ │
│  │ • GWS.LV25-03.12 Duschrinne 70cm (165€) - 89%       │ │
│  │ • CV24.LS44.03.15 Duschablauf (142€) - 76%          │ │
│  │ • VBW.LV25-3.8 Bodenablauf (98€) - 71%              │ │
│  │                                                      │ │
│  │ [✓ Übernehmen]  [✏️ Anpassen]  [❌ Verwerfen]        │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Edge Function: lv-generate

**Input:**
```json
{
  "kurzname": "Duschrinne Edelstahl 80cm",
  "lv_typ": "GWS",
  "gewerk": "Bad"
}
```

**Prozess:**
1. **Embedding generieren** für Kurzname
2. **Ähnliche Positionen finden** via `search_lv_positions()` (Top 10)
3. **KI-Prompt** mit Kontext der ähnlichen Positionen:

```
Du bist ein Experte für Leistungsverzeichnisse in der Wohnungssanierung.

Erstelle eine vollständige LV-Position für:
Kurzname: {kurzname}
LV-Typ: {lv_typ}
Gewerk: {gewerk}

Ähnliche bestehende Positionen:
{similar_positions}

Generiere:
1. artikelnummer: Gewerk-CamelCaseName (max. 35 Zeichen)
2. bezeichnung: Vollständiger Positionsname (max. 100 Zeichen)
3. beschreibung: Technische Beschreibung (2-4 Sätze, inkl. Material, Maße, Normen)
4. einheit: Stück/m²/m/Psch/kg
5. preis_vorschlag: Basierend auf ähnlichen Positionen (gewichteter Durchschnitt nach Ähnlichkeit)
6. preis_begründung: Kurze Erklärung der Preisfindung

Ausgabe als JSON.
```

**Output:**
```json
{
  "artikelnummer": "Bad-DuschrinneEdelstahl80cm",
  "bezeichnung": "Duschrinne Edelstahl 80 cm mit Ablaufgarnitur",
  "beschreibung": "Duschrinne aus V4A Edelstahl gebürstet, Länge 80 cm. Inkl. Ablaufgarnitur DN 50 mit seitlichem Ablauf und Geruchsverschluss. Fliesenmulde für bündigen Einbau, Belastbarkeit Klasse K3.",
  "einheit": "Stück",
  "preis_vorschlag": 185.00,
  "preis_begründung": "Gewichteter Durchschnitt aus 3 ähnlichen Positionen: GWS.LV25-03.12 (165€, 89%), CV24.LS44.03.15 (142€, 76%), Aufschlag für 80cm Länge.",
  "aehnliche_positionen": [
    {"artikelnummer": "GWS.LV25-03.12", "similarity": 0.89, "preis": 165},
    {"artikelnummer": "CV24.LS44.03.15", "similarity": 0.76, "preis": 142},
    {"artikelnummer": "VBW.LV25-3.8", "similarity": 0.71, "preis": 98}
  ]
}
```

---

## 5. Phase 3: Sprach-Transkription → LV

### 5.1 Workflow

```
┌────────────────────────────────────────────────────────────┐
│              BEGEHUNGS-TRANSKRIPT HOCHLADEN                │
│                                                            │
│  Basis-LV: [GWS 2025-01 ▼]                                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Transkript:                                          │ │
│  │                                                      │ │
│  │ "Also im Bad müssen wir komplett neu machen.        │ │
│  │ Die Fliesen sind alle kaputt, ca. 12 Quadrat-       │ │
│  │ meter Wand und 6 Quadratmeter Boden. Die alte       │ │
│  │ Wanne muss raus, wir machen eine bodengleiche       │ │
│  │ Dusche rein. Waschbecken ist ok, kann bleiben.      │ │
│  │ Neuer Heizkörper, der alte ist verrostet.           │ │
│  │ Elektrik auch checken, mindestens 3 neue            │ │
│  │ Steckdosen brauchen wir im Bad."                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [🔍 LV-Positionen extrahieren]                           │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│              EXTRAHIERTE LV-POSITIONEN                     │
│                                                            │
│  ┌─────┬───────────────────────────┬────────┬───────────┐ │
│  │  ✓  │ Position                  │ Menge  │ EP (GWS)  │ │
│  ├─────┼───────────────────────────┼────────┼───────────┤ │
│  │ [x] │ Fliesen Wand entfernen    │ 12 m²  │ 18,50 €   │ │
│  │ [x] │ Fliesen Boden entfernen   │ 6 m²   │ 22,00 €   │ │
│  │ [x] │ Wandfliesen neu verlegen  │ 12 m²  │ 45,00 €   │ │
│  │ [x] │ Bodenfliesen neu verlegen │ 6 m²   │ 52,00 €   │ │
│  │ [x] │ Badewanne demontieren     │ 1 Stk  │ 85,00 €   │ │
│  │ [x] │ Bodengl. Dusche komplett  │ 1 Stk  │ 1.850,00€ │ │
│  │ [x] │ Heizkörper Bad neu        │ 1 Stk  │ 420,00 €  │ │
│  │ [x] │ Steckdose UP neu          │ 3 Stk  │ 45,00 €   │ │
│  │ [ ] │ ❓ E-Check (empfohlen)    │ 1 Psch │ 120,00 €  │ │
│  └─────┴───────────────────────────┴────────┴───────────┘ │
│                                                            │
│  Summe ausgewählt: 3.291,00 € netto                       │
│                                                            │
│  [📋 Als Angebot übernehmen]  [💾 Als Vorlage speichern]  │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Edge Function: lv-extract-transcript

**Input:**
```json
{
  "transcript": "Also im Bad müssen wir komplett neu machen...",
  "basis_lv": "GWS",
  "projekt_typ": "wohnungssanierung"
}
```

**LV-Spezifischer System-Prompt (GWS):**

```
Du bist ein Experte für das GWS-Leistungsverzeichnis (Wohnungssanierung).

KONTEXT:
Das GWS-LV ist strukturiert nach Gewerken:
- 01: Abbruch- und Rückbauarbeiten
- 02: Maurerarbeiten, Putz
- 03: Sanitär, Bad
- 04: Wandsysteme (Trockenbau)
- 05: Estrich, Boden-Vorarbeiten
- 06: Fliesen- und Plattenarbeiten
- 07: Bodenbelagsarbeiten
- 08: Heizung
- 09: Elektroarbeiten
- 10: Maler- und Lackierarbeiten
- 11: Tischlerarbeiten
- 12: Reinigung

AUFGABE:
Analysiere das Transkript einer Wohnungsbegehung und extrahiere alle benötigten LV-Positionen.

REGELN:
1. Nur Positionen verwenden die im GWS-LV existieren
2. Mengen aus Kontext schätzen (Flächenangaben, Stückzahlen)
3. Bei Unsicherheit: Position mit "❓" markieren
4. Zusammenhängende Arbeiten erkennen (z.B. "Bad neu" = Fliesen + Sanitär + Elektrik)
5. Notwendige Vorarbeiten ergänzen (z.B. Demontage vor Neubau)
6. Nachweise/Prüfungen nicht vergessen (E-Check, Abdichtungsprotokoll)

AUSGABE als JSON:
{
  "positionen": [
    {
      "artikelnummer": "GWS.LV25-...",
      "bezeichnung": "...",
      "menge": 12,
      "einheit": "m²",
      "einzelpreis": 45.00,
      "gewerk": "Fliesen",
      "confidence": 0.95,
      "quelle_im_text": "ca. 12 Quadratmeter Wand"
    }
  ],
  "empfehlungen": [
    {
      "artikelnummer": "GWS.LV25-...",
      "grund": "E-Check empfohlen bei Elektroarbeiten"
    }
  ],
  "unklare_stellen": [
    "Waschbecken bleibt - Armatur auch prüfen?"
  ]
}
```

### 5.3 LV-Spezifische Prompts

Für jeden LV-Typ wird ein spezialisierter Prompt hinterlegt:

| LV-Typ | Prompt-Fokus | Besonderheiten |
|--------|--------------|----------------|
| **GWS** | Standard-Sanierung | 12 Gewerke, Pauschalpositionen |
| **VBW** | Bestandshalter | Kostenoptimiert, weniger Luxus |
| **covivio** | Premium-Standard | Höhere Qualität, mehr Optionen |
| **WBG Lünen** | Regional spezifisch | Lokale Besonderheiten |

---

## 6. Datenbank-Erweiterungen

### 6.1 Neue Spalten für lv_positionen

```sql
ALTER TABLE lv_positionen ADD COLUMN IF NOT EXISTS
  source TEXT DEFAULT 'manual',  -- 'hero', 'manual', 'ki_generated'
  hero_product_id TEXT,          -- Für bidirektionalen Sync
  created_by TEXT,               -- User der Position erstellt hat
  ki_generated BOOLEAN DEFAULT false,
  ki_confidence NUMERIC(3,2);    -- 0.00 - 1.00
```

### 6.2 Neue Tabelle: lv_prompts

```sql
CREATE TABLE lv_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lv_typ TEXT NOT NULL,
  prompt_type TEXT NOT NULL,  -- 'extraction', 'generation'
  system_prompt TEXT NOT NULL,
  gewerk_struktur JSONB,
  beispiele JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Implementierungs-Reihenfolge

### Schritt 1: Softr-Sync (1-2h)
- [ ] Edge Function `lv-softr-push` erstellen
- [ ] Initial-Push: 1.485 Positionen
- [ ] DB-Trigger für automatischen Sync

### Schritt 2: Hero-Push (2-3h)
- [ ] Hero GraphQL Mutation recherchieren
- [ ] Edge Function `lv-hero-push` erstellen
- [ ] Reverse-Mapping lv_typ → supply_operator
- [ ] DB-Trigger für neue Positionen

### Schritt 3: KI-Generierung (3-4h)
- [ ] Edge Function `lv-generate`
- [ ] UI-Komponente in SvelteKit
- [ ] Preisvorschlag-Algorithmus
- [ ] Testing mit Beispielpositionen

### Schritt 4: Transkript-Extraktion (4-6h)
- [ ] LV-spezifische Prompts erstellen
- [ ] Edge Function `lv-extract-transcript`
- [ ] UI für Transkript-Upload
- [ ] Angebots-Übernahme

---

## 8. Offene Fragen

1. **Hero API:** Hat Hero eine Mutation zum Anlegen von Positionen? (Muss recherchiert werden)

2. **Softr API Rate Limits:** Bei 1.485 Positionen initial - Batch-Verarbeitung nötig?

3. **Preisvorschlag:**
   - Gewichteter Durchschnitt nach Ähnlichkeit?
   - Oder Median der Top-3?
   - Aufschläge für Größe/Qualität berücksichtigen?

4. **Transkript-Qualität:**
   - Wie mit unvollständigen Transkripten umgehen?
   - Nachfrage-Dialog einbauen?

---

*Erstellt: 2026-01-30*
*Nächster Schritt: Freigabe durch Holger, dann Implementierung Phase 1*
