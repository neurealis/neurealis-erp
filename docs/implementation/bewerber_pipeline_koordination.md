# Bewerber-Pipeline - Implementierungs-Koordination

**Erstellt:** 2026-02-01
**Status:** 📋 KONZEPT FERTIG

---

## Übersicht

Automatisierte Verarbeitung von Bewerbungen aus `bewerbungen@neurealis.de` mit:
- KI-Parsing von Lebensläufen
- Vermittler-Erkennung (inaktiv by default)
- Duplikat-Handling per E-Mail-Match
- Kontakt-Anlage mit Label "Bewerber"
- Bidirektionaler Softr-Sync

---

## Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BEWERBUNGS-PIPELINE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ E-Mail      │     │ email-fetch  │     │ dokumente +         │  │
│  │ eingeht     │ ──► │ (existiert)  │ ──► │ email_details       │  │
│  └─────────────┘     └──────────────┘     └─────────┬───────────┘  │
│                                                     │              │
│                                           ┌─────────▼───────────┐  │
│                                           │ bewerbung-process   │  │
│                                           │ (NEU)               │  │
│                                           │                     │  │
│                                           │ • Quellen-Erkennung │  │
│                                           │ • KI: Lebenslauf    │  │
│                                           │ • Kontakt anlegen   │  │
│                                           └─────────┬───────────┘  │
│                                                     │              │
│                    ┌────────────────────────────────┼──────────┐   │
│                    │                                │          │   │
│          ┌─────────▼─────────┐    ┌─────────────────▼────┐     │   │
│          │ bewerber          │    │ kontakte             │     │   │
│          │ (Supabase)        │◄──►│ + Label "Bewerber"   │     │   │
│          └─────────┬─────────┘    └──────────────────────┘     │   │
│                    │                                           │   │
│          ┌─────────▼─────────┐    ┌─────────────────────┐      │   │
│          │ Softr Sync        │◄──►│ Personal - Bewerber │      │   │
│          │ (bidirektional)   │    │ (bl0tRF2R7aMLYC)    │      │   │
│          └───────────────────┘    └─────────────────────┘      │   │
│                    │                                           │   │
│          ┌─────────▼─────────┐                                 │   │
│          │ SvelteKit UI      │                                 │   │
│          │ /bewerber         │                                 │   │
│          └───────────────────┘                                 │   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### T1: DB-Migration ✅ FERTIG

**Ergebnis:** Migration `create_bewerber_table` angewendet

| Komponente | Details |
|------------|---------|
| **Tabelle** | `bewerber` mit 31 Spalten |
| **Provision** | `provision_typ`, `provision_pauschal`, `provision_prozent` |
| **Duplikate** | `ursprungs_bewerber_id` für Verknüpfung |
| **KI-Felder** | `qualifikationen` (JSONB), `zusammenfassung`, `berufserfahrung_jahre`, `fuehrerschein` |
| **Bewertungen** | `kultur_rating`, `kommunikation_rating`, `skills_rating` (1-5) |
| **RLS** | 4 Policies für authenticated Users |
| **Indizes** | 9 Indizes inkl. GIN auf JSONB |
| **View** | `v_bewerber_uebersicht` mit Duplikat-Zählung |

### T2: Edge Function `bewerbung-process` ⏳ OFFEN

**Konzept:** `docs/BEWERBUNG_PROCESS_KONZEPT.md`

**Quellen-Erkennung:**
| Pattern | Quelle | Vermittler | Aktiv |
|---------|--------|------------|-------|
| @gmail.com, @web.de, @gmx.de | Direkt | - | ✅ |
| @email.stepstone.de | Stepstone | - | ✅ |
| @indeed.com | Indeed | - | ✅ |
| @dibefa.de, "DIBEFA" im Betreff | Vermittler | DIBEFA | ❌ |
| @zeitkraftsolutions.com | Vermittler | zeitkraftsolutions | ❌ |
| Andere Firmen-Domains | Vermittler | (aus Domain) | ❌ |

**KI-Parsing:**
- PDF mit "Lebenslauf", "CV", "Bewerbung" im Namen finden
- GPT-5.2 extrahiert: Name, Qualifikationen, Berufserfahrung, Führerschein
- Speichert in `qualifikationen` (JSONB) + `zusammenfassung`

**Trigger:** Cron alle 10 Min

### T3: SvelteKit UI `/bewerber` ⏳ OFFEN

**Seite:** `ui/src/routes/bewerber/+page.svelte`

**Features:**
- KPI-Cards: Gesamt, Neu (Woche), In Bearbeitung, Eingestellt
- Tabs: "Aktive Bewerber" vs "Vermittler (inaktiv)"
- Tabellen- und Karten-Ansicht
- Filter: Status, Quelle, Position, Zeitraum
- Detail-Modal mit Tabs:
  - Übersicht (Kontaktdaten, Quelle)
  - Qualifikationen (KI-geparst)
  - Dokumente (PDF-Download)
  - Bewertung (3x Rating + Notizen)
  - Historie (Timeline)

**Neue Komponenten:**
- `StarRating.svelte` - 5-Sterne-Bewertung
- `Avatar.svelte` - Initial-Kreis
- `Timeline.svelte` - Historie
- `BewerberCard.svelte`, `BewerberModal.svelte`, etc.

### T4: Softr-Sync Mapping ⏳ OFFEN

**Field-Mapping konfigurieren:**
```typescript
'bewerber': {
  'name': 'qtiHG',
  'email': 'L4Gai',
  'telefon': 'wJsq7',
  'position': 'fzgN8',
  'status': '5XRlb',
  'eingang_am': '6NqwI',
  'beginn_ab': 'S5wp3',
  'gehaltsvorstellung': 'S78Ry',
  'kultur_rating': 'iRw0a',
  'kommunikation_rating': '6nxYX',
  'skills_rating': 'pRRtz',
  'anschreiben': 'uxkU0',
  'email_inhalt': 'lRlel',
  'zusammenfassung': '5YJRl',
  'notizen': '89Log'
}
```

**Neue Softr-Felder anlegen (empfohlen):**
- Quelle (SELECT)
- Vermittler (TEXT)
- Vermittler aktiv (CHECKBOX)
- Provision Typ (SELECT)
- Provision Pauschal (NUMBER)
- Provision Prozent (NUMBER)

---

## Status-Workflow

```
(0) Erhalten → (1) Unterlagen gesichtet → (2) Telefonisch erreicht →
(3) 1. Gespräch → (4) 2. Gespräch → (5) Referenzen einholen →
(6) Arbeitsvertrag erstellen → (7) Eingestellt | (10) Disqualifiziert
```

---

## Vermittler-Handling

1. **Erkennung:** Firmen-Domain (nicht gmail/web.de/etc.) → `vermittler_aktiv = false`
2. **Pool:** Erscheint im Tab "Vermittler (inaktiv)"
3. **Aktivierung:** Button "Aktivieren" → `vermittler_aktiv = true`
4. **Provision:** `provision_typ` + `provision_pauschal` ODER `provision_prozent`

---

## Duplikat-Handling

1. **Prüfung:** Bei jeder neuen Bewerbung E-Mail-Match prüfen
2. **Verknüpfung:** `ursprungs_bewerber_id` zeigt auf erste Bewerbung
3. **UI-Anzeige:** Hinweis "Weitere Bewerbung von [Name]" + Link

---

## Kontakt-Integration

Jeder Bewerber wird auch als Kontakt angelegt:
- `kontaktarten: ['Bewerber']`
- `kontakt_id` in bewerber gespeichert
- Bidirektionaler Sync möglich

---

## Nächste Schritte

1. [ ] **T2: Edge Function implementieren** - `bewerbung-process`
2. [ ] **T3: UI entwickeln** - `/bewerber` Seite
3. [ ] **T4: Softr-Sync konfigurieren** - Field-Mapping + neue Felder
4. [ ] **Cron-Job einrichten** - `bewerbung-process-job`
5. [ ] **Bestehende Bewerbungen migrieren** - Aus `dokumente` nach `bewerber`

---

*Erstellt: 2026-02-01*
