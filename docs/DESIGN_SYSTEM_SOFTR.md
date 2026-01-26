# neurealis ERP - Design-System (Softr-Referenz)

**Basiert auf:** Softr.io Portal Screenshots (Januar 2026)
**Ziel:** Konsistentes Layout für alle SvelteKit-Seiten

---

## 1. Farben

### Primärfarben
```css
--color-brand-red: #E53935;        /* Akzent, Buttons, aktiver Tab */
--color-brand-red-dark: #C62828;   /* Hover-State */
--color-brand-red-light: #FFEBEE;  /* Hintergrund für aktive Items */
```

### Neutralfarben
```css
--color-white: #FFFFFF;
--color-gray-50: #FAFAFA;          /* Page Background */
--color-gray-100: #F5F5F5;         /* Card Background */
--color-gray-200: #EEEEEE;         /* Borders */
--color-gray-400: #BDBDBD;         /* Placeholder */
--color-gray-500: #9E9E9E;         /* Labels, Timestamps */
--color-gray-700: #616161;         /* Secondary Text */
--color-gray-900: #212121;         /* Headings */
```

### Status-Farben
```css
--color-status-red: #E53935;       /* Bedarfsanalyse, Fehler */
--color-status-yellow: #FFC107;    /* In Arbeit, Warnung */
--color-status-green: #43A047;     /* Abgeschlossen, Erfolg */
--color-status-blue: #1E88E5;      /* Info */
```

### Farbschema-Regel
**Hauptfarben:** Mittelgrau, Hellgrau, Weiß
**Akzent:** Rot (#E53935) - nur für wichtige Aktionen und Highlights

### Ecken (WICHTIG)
**Alle Elemente sind eckig - keine Rundungen!**
```css
--radius-sm: 0;
--radius-md: 0;
--radius-lg: 0;
--radius-xl: 0;
--radius-full: 0;
```

---

## 2. Typografie

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Größen */
--text-xs: 0.75rem;    /* 12px - Timestamps, Labels */
--text-sm: 0.875rem;   /* 14px - Body Text */
--text-base: 1rem;     /* 16px - Standard */
--text-lg: 1.125rem;   /* 18px - Section Titles */
--text-xl: 1.25rem;    /* 20px - Page Titles */
--text-2xl: 1.5rem;    /* 24px - KPI Values */
--text-3xl: 2rem;      /* 32px - Dashboard Numbers */
```

---

## 3. Layout-Struktur

### Sidebar Navigation
```
┌──────────────────────────────────────────────────────┐
│ [Logo] neurealis    [🔍] [📱]                        │
├──────────────────┬───────────────────────────────────┤
│                  │                                   │
│  🏠 Startseite   │        CONTENT AREA               │
│  📋 Bauvorhaben >│                                   │
│  ✓ Aufgaben      │                                   │
│  📞 Leads        │                                   │
│  👤 Kunden     > │                                   │
│  🔧 Nachuntern. >│                                   │
│  📊 Finanzen   > │                                   │
│  🛒 Einkauf    > │                                   │
│     Lieferanten  │                                   │
│     Artikel      │                                   │
│  👥 Personal   > │                                   │
│  📦 Inventar     │                                   │
│                  │                                   │
└──────────────────┴───────────────────────────────────┘
```

- **Sidebar-Breite:** 240px (Desktop), versteckt (Mobile)
- **Aktiver Menüpunkt:** Rote Hintergrundfarbe, weißer Text
- **Untermenüs:** Eingerückt mit 16px padding-left

### Page Header
```
┌───────────────────────────────────────────────────────┐
│ Seitentitel                                           │
│ Untertitel / Breadcrumb                               │
├───────────────────────────────────────────────────────┤
│ [Filter 1 ▼] [Filter 2 ▼]        [🔍 Suche...]       │
└───────────────────────────────────────────────────────┘
```

---

## 4. Komponenten

### KPI-Card (Dashboard)
```html
<div class="kpi-card">
  <span class="kpi-label">Umsatz (Phasen 2-4)</span>
  <span class="kpi-value">126.321,98€</span>
  <span class="kpi-timestamp">Last updated at 23:48 ⟳</span>
</div>
```

```css
.kpi-card {
  background: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.kpi-label { font-size: 12px; color: #757575; }
.kpi-value { font-size: 24px; font-weight: 600; color: #212121; }
.kpi-timestamp { font-size: 11px; color: #9E9E9E; }
```

### Status-Badge
```html
<span class="badge badge-red">Bedarfsanalyse</span>
<span class="badge badge-yellow">Angebotsphase</span>
<span class="badge badge-green">Abgeschlossen</span>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.badge-red { background: #FFEBEE; color: #C62828; }
.badge-yellow { background: #FFF8E1; color: #F57F17; }
.badge-green { background: #E8F5E9; color: #2E7D32; }
```

### Action-Button (Primary)
```css
.btn-primary {
  background: #E53935;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-primary:hover {
  background: #C62828;
}
```

### Tabs (Horizontal)
```html
<div class="tabs">
  <button class="tab active">
    <span class="tab-icon">📋</span>
    <span class="tab-label">(0) Bedarfsanalyse</span>
  </button>
  <button class="tab">
    <span class="tab-icon">📝</span>
    <span class="tab-label">(1) Angebot</span>
  </button>
</div>
```

```css
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #EEEEEE;
  overflow-x: auto;
}
.tab {
  padding: 12px 16px;
  border: none;
  background: none;
  color: #616161;
  cursor: pointer;
  white-space: nowrap;
}
.tab.active {
  color: #E53935;
  border-bottom: 2px solid #E53935;
}
```

### Schnellzugriff-Buttons
```css
.quick-access {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #FAFAFA;
  border-radius: 8px;
}
.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: white;
  border: 1px solid #EEEEEE;
  border-radius: 8px;
  min-width: 100px;
}
.quick-btn:hover {
  border-color: #E53935;
}
```

### Tabelle
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #757575;
  border-bottom: 1px solid #EEEEEE;
}
.data-table td {
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid #F5F5F5;
}
.data-table tr:hover {
  background: #FAFAFA;
}
```

---

## 5. Icons

**Verwendung:** Lucide Icons (https://lucide.dev)

| Icon | Verwendung |
|------|-----------|
| `home` | Startseite |
| `building-2` | Bauvorhaben |
| `check-square` | Aufgaben |
| `phone` | Leads |
| `user` | Kunden |
| `wrench` | Nachunternehmer |
| `bar-chart-2` | Finanzen |
| `shopping-cart` | Einkauf |
| `users` | Personal |
| `package` | Inventar |
| `edit-3` | Bearbeiten |
| `camera` | Fotos |
| `message-circle` | Kommentare |

---

## 6. Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) {
  .sidebar { display: none; }
  .content { padding: 16px; }
}

/* Tablet */
@media (max-width: 1024px) {
  .sidebar { width: 64px; } /* Icons only */
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop */
@media (min-width: 1025px) {
  .sidebar { width: 240px; }
  .kpi-grid { grid-template-columns: repeat(4, 1fr); }
}
```

---

## 7. Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

---

## 8. Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1);
```

---

*Erstellt: 2026-01-27*
*Basiert auf: Softr.io Portal neurealis.softr.app*
