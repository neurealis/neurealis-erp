# UI-Migrationsplan: Softr → SvelteKit

**Version:** 1.0
**Stand:** 2026-01-27
**Architektur:** Ein Portal + Rollen (Supabase RLS)

---

## Übersicht

### Ziel
Migration der drei Softr-Portale (Intern, Kunden, Partner) zu einer einheitlichen SvelteKit-Anwendung mit rollenbasierter Zugriffskontrolle.

### Stack
| Komponente | Technologie |
|------------|-------------|
| Frontend | SvelteKit + TypeScript |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Styling | CSS Custom Properties (Design Tokens) |
| Hosting | Netlify |
| Auth | Supabase Auth (Magic Link) |

---

## Rollen-Konzept

| Rolle | Zugriff | Beschreibung |
|-------|---------|--------------|
| `admin` | Alles | Geschäftsführung, IT |
| `mitarbeiter` | Internes Portal | Bauleiter, Buchhaltung |
| `kunde` | Kundenportal | Auftraggeber, Eigentümer |
| `nachunternehmer` | Partnerportal | Handwerksbetriebe |

### Supabase RLS Policies (Beispiel)
```sql
-- Bauvorhaben: Mitarbeiter sehen alle, Kunden nur ihre
CREATE POLICY "bauvorhaben_select" ON bauvorhaben
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'mitarbeiter')
  OR kunde_id = auth.uid()
);
```

---

## Phasen-Übersicht

| Phase | Komponenten | Dauer |
|-------|-------------|-------|
| **1** | Layout, Navigation, Auth | Basis |
| **2** | Dashboard + BV-Übersicht | Kern |
| **3** | Mängelmanagement | Feature |
| **4** | Nachtragsmanagement | Feature |
| **5** | Rechnungen/Budget | Feature |
| **6** | Weitere Features | Erweiterung |

---

## Phase 1: Grundstruktur

### 1.1 Layout-System

**Komponenten:**
- `AppShell.svelte` - Hauptcontainer mit Sidebar/Header
- `Sidebar.svelte` - Responsive Navigation
- `Header.svelte` - User-Info, Benachrichtigungen
- `Breadcrumb.svelte` - Navigationspfad

**Responsive Breakpoints:**
```css
--breakpoint-mobile: 640px;
--breakpoint-tablet: 1024px;
--breakpoint-desktop: 1280px;
```

**Design:**
```
┌─────────────────────────────────────────────┐
│ Header: Logo | Suche | User-Menü            │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Main Content                    │
│          │                                  │
│ ○ Start  │  ┌────────────────────────────┐  │
│ ○ BVs    │  │  Breadcrumb                │  │
│ ○ Mängel │  │  Content...                │  │
│ ...      │  └────────────────────────────┘  │
│          │                                  │
│ ─────    │                                  │
│ User     │                                  │
└──────────┴──────────────────────────────────┘
```

**Mobile (< 640px):**
```
┌─────────────────┐
│ ☰ Logo    👤    │
├─────────────────┤
│                 │
│  Main Content   │
│                 │
│                 │
├─────────────────┤
│ 🏠  📋  ⚠️  💰 │  ← Bottom Navigation
└─────────────────┘
```

### 1.2 Navigation nach Rolle

**Mitarbeiter (Intern):**
| Icon | Label | Route |
|------|-------|-------|
| 🏠 | Startseite | `/` |
| 🏗️ | Bauvorhaben | `/bauvorhaben` |
| ⚠️ | Mängel | `/maengel` |
| 📝 | Nachträge | `/nachtraege` |
| 💰 | Finanzen | `/finanzen` |
| 📦 | Einkauf | `/einkauf` |
| 👥 | Kontakte | `/kontakte` |
| 📋 | Aufgaben | `/aufgaben` |

**Kunde:**
| Icon | Label | Route |
|------|-------|-------|
| 🏠 | Startseite | `/` |
| 🏗️ | Bauvorhaben | `/bauvorhaben` |
| ✉️ | Angebote | `/angebote` |
| 💰 | Rechnungen | `/rechnungen` |
| 👤 | Ansprechpartner | `/ansprechpartner` |

**Nachunternehmer:**
| Icon | Label | Route |
|------|-------|-------|
| 🏠 | Startseite | `/` |
| ➕ | Aufträge | `/auftraege` |
| ⚠️ | Mängel | `/maengel` |
| 💰 | Rechnungen | `/rechnungen` |
| 📋 | LVs | `/lvs` |
| 📄 | Nachweise | `/nachweise` |

### 1.3 Auth-Flow

```
1. User öffnet App → Login-Seite
2. E-Mail eingeben → Magic Link senden
3. Klick auf Link → Session erstellen
4. Session prüfen → Rolle aus DB laden
5. Redirect zu Dashboard (rollenbasiert)
```

---

## Phase 2: Dashboard + BV-Übersicht

### 2.1 Dashboard-Komponenten

**Mitarbeiter-Dashboard:**
```
┌──────────────────────────────────────────────────┐
│  Guten Morgen, Holger                            │
├─────────────┬─────────────┬─────────────┬────────┤
│  4 BVs      │  3 Mängel   │  2 Nachträge│ 156k € │
│  aktiv      │  offen      │  offen      │ offen  │
└─────────────┴─────────────┴─────────────┴────────┘

┌─────────────────────────────────────────────────┐
│  📅 Bauzeitenplan (Kalender)                    │
│  ┌─────┬─────┬─────┬─────┬─────┐                │
│  │ Mo  │ Di  │ Mi  │ Do  │ Fr  │                │
│  │ ███ │ ███ │ ███ │     │     │  BV-123       │
│  │     │ ███████████████ │     │  BV-124       │
│  └─────┴─────┴─────┴─────┴─────┘                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  🔥 Dringende Aufgaben                          │
│  □ Mangel BV-123 beheben (Frist: heute)         │
│  □ Nachtrag BV-124 genehmigen                   │
└─────────────────────────────────────────────────┘
```

**KPI-Cards:**
```svelte
<KPICard
  label="Aktive BVs"
  value={4}
  trend="+1"
  color="blue"
/>
```

### 2.2 BV-Übersicht (Liste)

**Desktop-Tabelle:**
| Projekt-Nr | Adresse | Phase | Bauleiter | Start | Ende | Budget |
|------------|---------|-------|-----------|-------|------|--------|
| ATBS-123 | Schreberstr. 55 | (4) Umsetzung | Dirk Jansen | 15.01. | 28.02. | 45.000 € |

**Mobile-Cards:**
```
┌─────────────────────────────┐
│ ATBS-123                    │
│ Schreberstraße 55, Herne    │
│ ━━━━━━━━━━━━━━━━━━━━━ 75%  │
│ 🟢 (4) Umsetzung            │
│ 15.01. - 28.02.2026         │
│ 👤 Dirk Jansen   💰 45.000€ │
└─────────────────────────────┘
```

**Filter:**
- Status/Phase (Multi-Select)
- Bauleiter
- Kunde
- Zeitraum

**Sortierung:**
- Nach Phase (Standard)
- Nach Start-Datum
- Nach Budget

### 2.3 BV-Detailseite

**Statt 20 Tabs: Phasen-basierte Accordion-Struktur**

```
┌─────────────────────────────────────────────────┐
│ ← Zurück   ATBS-123 - Schreberstraße 55         │
│ 🟢 (4) Umsetzung                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─ Übersicht ────────────────────────────────┐  │
│ │ Bauleiter: Dirk Jansen    📞 0171-xxx      │  │
│ │ Grundfläche: 55 m²        🔗 Matterport    │  │
│ │ Budget: 45.000 €          Marge: 35%       │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ▼ Gewerke-Status (5/9 erledigt)                │
│ ┌────────────────────────────────────────────┐  │
│ │ ✅ Entkernung                              │  │
│ │ ✅ Maurer & Trockenbau                     │  │
│ │ 🔄 Elektrik (in Arbeit)                    │  │
│ │ ⏳ Bad & Sanitär                           │  │
│ │ ...                                        │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ▶ Mängel (2 offen)                             │
│ ▶ Nachträge (1 offen)                          │
│ ▶ Dokumente (8)                                │
│ ▶ Rechnungen                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Accordion öffnet Details:**
```
▼ Mängel (2 offen)
┌────────────────────────────────────────────────┐
│ M-001 │ 🔴 Offen │ Fliesenbruch Bad │ Frist: 20.01 │
│ M-002 │ 🟡 In Arbeit │ Steckdose locker │          │
│                                                │
│ [+ Neuer Mangel]                               │
└────────────────────────────────────────────────┘
```

---

## Phase 3: Mängelmanagement

### 3.1 Mängel-Übersicht

**Filter:**
- Status: Offen / In Arbeit / Behoben
- BV (Dropdown)
- Frist überschritten (Checkbox)
- Gewerk

**Ansichten:**
- Liste (alle Mängel)
- Kanban (Offen → In Arbeit → Behoben)
- Nach BV gruppiert

### 3.2 Mangel-Detail

```
┌─────────────────────────────────────────────────┐
│ M-001 - Fliesenbruch Bad                        │
│ BV: ATBS-123 │ Gewerk: Bad & Sanitär            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Status: 🔴 Offen                                │
│ Frist: 20.01.2026 (in 3 Tagen)                  │
│ Erstellt: 15.01.2026 von Dirk Jansen            │
│                                                 │
│ Beschreibung:                                   │
│ Fliese im Duschbereich gebrochen, muss          │
│ ausgetauscht werden.                            │
│                                                 │
│ Fotos (BL):                                     │
│ [📷] [📷] [📷]                                  │
│                                                 │
│ ──────────────────────────────────────────      │
│ NU-Bereich (editierbar):                        │
│                                                 │
│ Dein Status: [Dropdown: Offen/In Arbeit/Erledigt] │
│ Deine Fotos: [+ Foto hochladen]                 │
│ Kommentar: [_________________________]          │
│                                                 │
│ [Speichern]                                     │
└─────────────────────────────────────────────────┘
```

### 3.3 Neuer Mangel (Formular)

```
Bauvorhaben: [Dropdown]
Gewerk: [Dropdown]
Beschreibung: [Textarea]
Frist: [Datepicker]
Fotos: [Drag & Drop Upload]

[Mangel erstellen]
```

---

## Phase 4: Nachtragsmanagement

### 4.1 Workflow

```
NU erstellt → BL prüft → Genehmigt/Abgelehnt → NU nimmt an/ab
     │            │              │                    │
     ▼            ▼              ▼                    ▼
  (0) Offen   (1) Prüfung   (2) Entschieden    (3) Final
```

### 4.2 Nachtrag-Detail

```
┌─────────────────────────────────────────────────┐
│ N-001 - Zusätzliche Steckdosen Küche            │
│ BV: ATBS-123                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Status BL: 🟢 Genehmigt                         │
│ Status NU: 🟡 Offen (wartet auf Annahme)        │
│                                                 │
│ Budget: 350,00 €                                │
│ Dauer: +2 Tage                                  │
│                                                 │
│ Beschreibung:                                   │
│ Kunde wünscht 4 zusätzliche Steckdosen...       │
│                                                 │
│ [NU: Annehmen] [NU: Ablehnen]                   │
└─────────────────────────────────────────────────┘
```

---

## Phase 5: Rechnungen/Budget

### 5.1 Rechnungs-Übersicht

**Tabs:**
- Offene Rechnungen
- Alle Rechnungen
- Zahlungsabgleich

**Tabelle:**
| RE-Nr | BV | Typ | Betrag | Status | Fällig |
|-------|-----|-----|--------|--------|--------|
| RE-001 | ATBS-123 | Kunde-RE | 24.000 € | Offen | 15.02. |

### 5.2 Budget-Dashboard (pro BV)

```
┌─────────────────────────────────────────────────┐
│ Budget-Übersicht ATBS-123                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Ursprüngliches Budget:     45.000 €             │
│ + Nachträge:               +1.200 €             │
│ - Vertragsstrafe:            -500 €             │
│ ─────────────────────────────────────           │
│ Finales Budget:            45.700 €             │
│                                                 │
│ Rechnungen:                                     │
│ - Abschlagsrechnung:       18.000 € (bezahlt)   │
│ - Schlussrechnung:         27.700 € (offen)     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Phase 6: Weitere Features

### 6.1 Kontakte/CRM
- Kunden, Lieferanten, NUs verwalten
- Sync mit Hero, Microsoft 365

### 6.2 Aufgaben
- Task-Management
- Zuweisungen

### 6.3 Inventar
- Werkzeuge, Fahrzeuge
- QR-Code Tracking

### 6.4 Marketing
- Social Media Posts
- Matterport Vorher/Nachher

---

## Komponenten-Bibliothek

### Basis-Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| `Button.svelte` | Primary, Secondary, Ghost, Danger |
| `Input.svelte` | Text, Number, Date, Textarea |
| `Select.svelte` | Single, Multi, Searchable |
| `Card.svelte` | Container mit Shadow |
| `Badge.svelte` | Status-Anzeige |
| `Modal.svelte` | Dialog/Popup |
| `Toast.svelte` | Benachrichtigungen |
| `Table.svelte` | Responsive Tabelle |
| `Accordion.svelte` | Aufklappbare Bereiche |

### Spezial-Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| `KPICard.svelte` | Dashboard-Kennzahlen |
| `StatusBadge.svelte` | Phase/Status mit Farbe |
| `FileUpload.svelte` | Drag & Drop Upload |
| `ImageGallery.svelte` | Foto-Vorschau |
| `Calendar.svelte` | Bauzeitenplan |
| `GewerkeStatus.svelte` | Gewerke-Fortschritt |

---

## Datei-Struktur

```
ui/src/
├── routes/
│   ├── +layout.svelte          # Root Layout
│   ├── +page.svelte            # Dashboard
│   ├── login/+page.svelte      # Login
│   ├── bauvorhaben/
│   │   ├── +page.svelte        # Liste
│   │   └── [id]/+page.svelte   # Detail
│   ├── maengel/
│   │   ├── +page.svelte        # Übersicht
│   │   └── [id]/+page.svelte   # Detail
│   ├── nachtraege/
│   │   ├── +page.svelte
│   │   └── [id]/+page.svelte
│   └── finanzen/
│       └── +page.svelte
│
├── lib/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── Header.svelte
│   │   │   └── Breadcrumb.svelte
│   │   ├── ui/
│   │   │   ├── Button.svelte
│   │   │   ├── Input.svelte
│   │   │   ├── Card.svelte
│   │   │   └── ...
│   │   └── features/
│   │       ├── KPICard.svelte
│   │       ├── StatusBadge.svelte
│   │       └── ...
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   └── ui.ts
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── api.ts
│   └── styles/
│       ├── tokens.css          # Design-Variablen
│       └── global.css          # Globale Styles
│
└── app.html
```

---

## Nächste Schritte

1. [ ] Layout-Komponenten erstellen (AppShell, Sidebar, Header)
2. [ ] Responsive Navigation implementieren
3. [ ] Auth-Flow mit Supabase einrichten
4. [ ] Dashboard mit KPI-Cards bauen
5. [ ] BV-Übersicht (Liste + Filter)
6. [ ] BV-Detailseite mit Accordions

---

*Erstellt: 2026-01-27*
