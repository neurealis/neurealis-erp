# Decisions - neurealis ERP

**Stand:** 2026-01-27

---

## Architektur

### D001 - Ein Portal statt drei
**Datum:** 2026-01-27
**Entscheidung:** Eine SvelteKit-App mit Supabase RLS für rollenbasierte Zugriffskontrolle
**Grund:** Weniger Wartungsaufwand, gemeinsame Komponenten, konsistente UX
**Alternativen verworfen:** 3 separate Apps (zu viel Duplikation), Hybrid (unnötige Komplexität)

### D002 - Internes Portal zuerst migrieren
**Datum:** 2026-01-27
**Entscheidung:** Das interne Mitarbeiter-Portal wird als erstes migriert
**Grund:** Umfangreichste Funktionalität, wenn das funktioniert, sind Kunden/NU-Portale einfacher
**Reihenfolge:** Intern → Kunden → Partner

### D003 - Responsive Design von Anfang an
**Datum:** 2026-01-27
**Entscheidung:** Desktop und Mobile gleichwertig entwickeln
**Grund:** Bauleiter nutzen Handy auf Baustelle, Büro arbeitet am Desktop

---

## Features

### D004 - Feature-Reihenfolge
**Datum:** 2026-01-27
**Entscheidung:** Priorisierte Reihenfolge der Feature-Migration
**Reihenfolge:**
1. BV-Übersicht + Dashboard (Basis)
2. Mängelmanagement (täglich genutzt)
3. Nachträge (Budget-relevant)
4. Rechnungen/Budget (Controlling)

### D005 - Tab-Struktur neu denken
**Datum:** 2026-01-27
**Entscheidung:** Statt 20 horizontaler Tabs: Phasen-basierte Ansicht mit Accordion
**Grund:** Progressive Disclosure reduziert kognitive Last
**Umsetzung:** Nur relevante Felder je nach BV-Phase anzeigen

---

## Technisch

### D006 - Supabase als einziges Backend
**Datum:** 2026-01-27
**Entscheidung:** Alle Daten in Supabase, Monday.com/Softr nur noch für Sync (Legacy)
**Grund:** Eine Wahrheitsquelle, RLS für Zugriffskontrolle, Edge Functions für Logik

### D007 - Netlify für Hosting
**Datum:** 2026-01-27
**Entscheidung:** SvelteKit UI auf Netlify hosten
**URL:** https://neurealis-erp.netlify.app

---

## Hero Integration

### D008 - invoice_style statt Fallback-Logik
**Datum:** 2026-01-27
**Entscheidung:** Hero `metadata.invoice_style` für Dokumenttyp-Klassifizierung nutzen
**Mapping:**
- `full` → AR-S (Schlussrechnung)
- `parted`, `cumulative`, `downpayment` → AR-A (Abschlag)
- `null` → Nicht synchronisieren (Entwurf)
**Grund:** Direkte API-Information ist zuverlässiger als Fallback-Heuristik
**Verworfen:** Alte Logik über Projekt-Phase oder höchste Rechnungsnummer

---

*Aktualisiert: 2026-01-27*
