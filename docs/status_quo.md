# Status Quo - neurealis ERP

**Stand:** 2026-01-27 22:30 (aktualisiert)

---

## Aktueller Projektstatus

### UI-Migration Softr → SvelteKit

| Komponente | Status | Supabase | Details |
|------------|--------|----------|---------|
| **Bestellsystem** | ✅ Fertig | ✅ | Login, Liste, Detail, Formular |
| **LV-Export** | ✅ Fertig | ✅ | Export-Seite vorhanden |
| **Layout-System** | ✅ Fertig | - | AppShell, Sidebar, Header, BottomNav |
| **Dashboard** | ✅ Fertig | ✅ | KPIs, Aktivitäten, Aufgaben aus DB |
| **BV-Übersicht** | ✅ Fertig | ✅ | Phasen-Tabs, phasenspezifische Tabellen wie Softr |
| **Mängelmanagement** | ✅ Fertig | ✅ | maengel_fertigstellung mit Filter/Statistiken |
| **Nachträge** | ✅ Fertig | ✅ | nachtraege Tabelle mit Summen |
| **Finanzen** | ✅ Fertig | ✅ | 2000 Dokumente aus softr_dokumente (NEU) |
| **Kontakte** | ✅ Fertig | ✅ | 1.379 Kontakte, Karten/Tabellen-Ansicht |
| **Einkauf** | ✅ Fertig | ✅ | Lieferanten, Artikel, LV-Positionen (3.057), KI-Suche |
| **Aufgaben** | ✅ Fertig | ✅ | 1.755 Tasks, Fälligkeits-Filter |
| **Nachunternehmer** | ✅ Fertig | ✅ | 39 NUs, Nachweise-Status |
| **Leads** | ✅ Fertig | ✅ | Kanban-Pipeline (8 Leads) |
| **Marketing** | ✅ Fertig | ✅ | Social Media, Blog, Analytics (NEU) |
| **Kalender** | ✅ Fertig | ✅ | Monatsansicht, BV-Zeiträume |
| **Kundenportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |
| **Partnerportal** | ⏳ Geplant | - | Gleiche Komponenten, andere Navigation |

### Supabase-Datenquellen (angebunden)

| Tabelle | Seite | Datensätze |
|---------|-------|------------|
| `monday_bauprozess` | Dashboard, BV, Kalender | 193 Bauvorhaben |
| `maengel_fertigstellung` | Mängel, BV-Detail | 57 Mängel |
| `nachtraege` | Nachträge, Dashboard | aktive Nachträge |
| `softr_dokumente` | Finanzen | 2.000 Rechnungen |
| `tasks` | Dashboard, Aufgaben | 1.755 Tasks |
| `dokumente` | Dashboard, BV-Detail | Aktivitäten |
| `kontakte` | Kontakte, Nachunternehmer | 1.379 Kontakte |
| `kontakte_nachunternehmer` | Nachunternehmer | NU-spezifische Daten |
| `grosshaendler` | Einkauf | 39 Lieferanten |
| `bestellartikel` | Einkauf | 768 Artikel |
| `lv_positionen` | Einkauf | 3.057 LV-Positionen (alle mit Embeddings) |
| `leads` | Leads | 8 Leads |
| `social_media_posts` | Marketing | 4 Posts (NEU) |
| `blog_posts` | Marketing | 3 Artikel (NEU) |

### Architektur

**Ein Portal + Rollen** - Eine SvelteKit-App mit Supabase RLS für rollenbasierte Zugriffskontrolle.

### Komponenten-Bibliothek

**Layout:**
- `AppShell.svelte` - Hauptcontainer mit Sidebar
- `Sidebar.svelte` - Responsive Navigation (rollenbasiert)
- `Header.svelte` - Breadcrumb, Suche, User-Menü
- `BottomNav.svelte` - Mobile Navigation

**UI:**
- `Button.svelte` - Primary, Secondary, Ghost, Danger
- `Card.svelte` - Container mit Header/Footer
- `Badge.svelte` - Status-Anzeige mit Phasen-Farben
- `Accordion.svelte` - Aufklappbare Bereiche
- `KPICard.svelte` - Dashboard-Kennzahlen (mit subvalue)

### Aktuelle Seiten-Struktur

```
ui/src/routes/
├── +page.svelte              # Dashboard (Supabase)
├── +layout.svelte            # AppShell Layout
├── login/+page.svelte
├── bauvorhaben/
│   ├── +page.svelte          # BV-Liste (Supabase)
│   └── [id]/+page.svelte     # BV-Detail (Supabase)
├── kalender/+page.svelte     # Kalender/Bauzeitenplan (NEU)
├── maengel/+page.svelte      # Mängel (Supabase)
├── nachtraege/+page.svelte   # Nachträge (Supabase)
├── finanzen/+page.svelte     # Finanzen (Supabase)
├── einkauf/+page.svelte      # Lieferanten, Artikel, LV (NEU)
├── kontakte/+page.svelte     # Kontakte (NEU)
├── leads/+page.svelte        # Vertriebspipeline (NEU)
├── marketing/+page.svelte    # Social Media, Blog, Analytics (NEU)
├── aufgaben/+page.svelte     # Task-Management (NEU)
├── nachunternehmer/+page.svelte # NU-Verwaltung (NEU)
├── bestellung/+page.svelte
├── bestellungen/
│   ├── +page.svelte
│   └── [id]/+page.svelte
└── lv-export/+page.svelte
```

---

## Nächster Schritt

→ **VBW Verhandlung (28.01.):** Entscheidungsgrundlage v1.1 finalisiert (PDF/DOCX)
→ **Hero Rechnungssync optimieren:** `invoice_style` statt Fallback-Logik
→ Kundenportal-Seiten: /angebote, /ansprechpartner, /rechnungen
→ Partnerportal-Seiten: /auftraege, /lvs, /nachweise, /vorlagen

---

## Letzte Session (2026-01-27)

**Einkauf-Erweiterung & Sidebar-Restructuring:**
- Sidebar: Einkauf als aufklappbares Untermenü (Übersicht, Bestellung, Bestellungen, LV-Export)
- LV-Export: Kunden-LV Auswahl mit farbigen Badges (GWS, VBW, Covivio, neurealis)
- Design auf eckig (border-radius: 0) umgestellt für Softr-Rot Look
- pgvector Similarity-Suche für LV-Positionen (3.057 mit Embeddings)
- Edge Function `search-lv` deployed für semantische KI-Suche
- Einkauf-UI: Text/KI-Suche Toggle für LV-Positionen

**Neue SQL-Funktion:**
```sql
search_lv_positions(query_embedding, match_count, filter_lv_typ, filter_gewerk)
```

**Neue Edge Function:**
- `search-lv` - Nimmt Suchanfrage, generiert Embedding, findet ähnliche LV-Positionen

---

## Session davor (2026-01-28)

**BV-Übersicht Redesign:**
- Phasen-Tabs (0-6) mit Anzahl-Badges
- Phasenspezifische Tabellenspalten wie in Softr-Original
- Suchfeld über alle Projekte
- Mobile Cards-Ansicht
- Mängel/Nachträge-Badges in Tabelle

---

*Aktualisiert: 2026-01-27 23:30*
