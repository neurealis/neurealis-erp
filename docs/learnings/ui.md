# Learnings: UI / SvelteKit

Letzte Aktualisierung: 2026-02-03

---

## Rollen / Zugriffsrechte

### L175: WIP-Badge für Admin-only Seiten-Status
**Kategorie:** UX
**Datum:** 2026-02-02
**Lösung:**
- `releasedPages` Set definiert freigegebene Seiten
- `isWorkInProgress(href)` prüft Badge-Anzeige
- `isHolger` prüft User-E-Mail
- Badge: 8x8px gelb (#f59e0b), border-radius: 2px
```svelte
{#if isHolger && isWorkInProgress(entry.href)}
  <span class="wip-badge"></span>
{/if}
```

---

### L176: Sidebar Rollen-System mit roles-Array
**Kategorie:** Technisch
**Datum:** 2026-02-02
```typescript
navItems = [
  { label: 'Seite', href: '/seite', roles: ['admin', 'mitarbeiter'] },
]
```
**Rollen-Mapping:**
- `admin` → ADM (Vollzugriff)
- `mitarbeiter` → BL, HW
- `kunde` → KU
- `nachunternehmer` → NU

---

## SvelteKit / Svelte 5

### L009: Snippet-Namen ohne Bindestriche
**Kategorie:** Technisch
**Datum:** 2026-01-27
**Problem:** `{#snippet user-info()}` → Syntax-Fehler
**Lösung:** Keine Bindestriche in Snippet-Namen

---

### L020: @const Placement
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** `{@const}` direkt in `<div>` → Build-Fehler
**Lösung:** Innerhalb von `{#if}`, `{#each}`, `{:else}`
```svelte
{#if true}
  {@const wert = berechnung()}
  <div>{wert}</div>
{/if}
```

---

### L126: Type-Exports in separater Datei
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Problem:** Import von Typen aus .svelte funktioniert nicht
**Lösung:** Typen in `types.ts` auslagern
```typescript
// types.ts
export interface Position { id: string; ... }

// Component.svelte
import type { Position } from './types';
```

---

## Design / UX

### L001: Softr Tab-Überladung vermeiden
**Kategorie:** UX
**Datum:** 2026-01-27
**Problem:** 20+ Tabs → kognitive Überlastung
**Lösung:** Progressive Disclosure, Accordion-Pattern

---

### L002: Horizontales Scrollen ist Gift
**Kategorie:** UX
**Datum:** 2026-01-27
**Problem:** 15+ Spalten unbrauchbar auf Mobile
**Lösung:** Spalten-Konfigurator, Card-Layout für Mobile

---

### L003: Redundanz eliminieren
**Kategorie:** UX
**Datum:** 2026-01-27
**Problem:** Gleiche Infos in mehreren Tabs → Inkonsistenzen
**Lösung:** Single Source of Truth

---

### L006: Umlaute korrekt verwenden
**Kategorie:** UX
**Datum:** 2026-01-26
**Regel:** UTF-8 überall, ä/ö/ü/ß verwenden
**Ausnahme:** Technische Variablennamen

---

## Deployment / Netlify

### L021: adapter-netlify: Edge Functions bevorzugen
**Kategorie:** Technisch
**Datum:** 2026-01-28
**Problem:** 404 nach Deploy trotz korrekter Functions
**Lösung:** `edge: true` in svelte.config.js
```javascript
adapter: adapter({
  edge: true,
  split: false
})
```

---

## Windows / Development

### L010: Windows-Pfade in Bash problematisch
**Kategorie:** Workflow
**Datum:** 2026-01-27
**Problem:** `cd C:\Users\...` funktioniert nicht
**Lösung:** Dev-Server manuell in PowerShell: `cd ui && npm run dev`

---

## Formulare / Eingabe

### L111: Aufmaß-Mengen-Zuweisung UI-Pattern
**Kategorie:** UX
**Datum:** 2026-01-30
**Layout:**
- Links: Position
- Rechts: Tabelle Räume × Maßtypen
- Ein-/Ausklicken pro Raum
- Summe mit Faktor

---

### L109: CPQ-Wizard Reihenfolge
**Kategorie:** UX
**Datum:** 2026-01-30
1. Projekt
2. Positionen
3. Mengen
4. Kalkulation
5. Freigabe
6. Versand

---

## PDF-Generierung

### L085: jsPDF-autotable didDrawCell für gemischte Styles
**Kategorie:** Technisch
**Datum:** 2026-01-30
**Problem:** Keine verschiedenen Schriftarten innerhalb Zelle
**Lösung:** `didDrawCell` Hook für manuelles Zeichnen

---

### L155: HTML→PDF mit Puppeteer
**Kategorie:** Workflow
**Datum:** 2026-02-01
```javascript
const page = await browser.newPage();
await page.goto('file://' + htmlPath);
await page.pdf({ path: 'output.pdf', format: 'A4', printBackground: true });
```

---

*Vollständige Learnings siehe docs/learnings.md*
