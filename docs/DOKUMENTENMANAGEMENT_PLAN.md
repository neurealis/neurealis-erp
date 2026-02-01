# Dokumentenmanagement-System - neurealis ERP

**Stand:** 2026-01-28 (AKTUALISIERT)
**Status:** Erweiterter Plan - Multi-Quellen-Integration

---

## 1. Übersicht & Prioritäten

| Prio | Komponente | Status | Beschreibung |
|------|------------|--------|--------------|
| **1** | **Telegram-Bot** | 🔲 NEU | Baustellen-Kommunikation, Fotos, Mängel, Nachträge |
| **2** | SharePoint-Sync | 🔲 NEU | ~90 GB synchronisieren (parallel) |
| **3** | Teams-Transkripte | 🔲 NEU | Graph API |
| - | E-Mail (MS365) | ✅ Existiert | 77 Docs |
| - | Hero Software | ✅ Existiert | 1.864 Docs |

---

## 2. Telegram-Bot

### 2.1 Bot-Info
- **Bot:** @neurealis_bedarfsanalyse_bot
- **Token:** Secret `TELEGRAM_NEUREALIS_BOT` in Supabase

### 2.2 Nutzergruppen (Phasen)
1. **Phase 1:** Mitarbeiter (Bauleiter, Handwerker)
2. **Phase 2:** Nachunternehmer
3. **Phase 3:** Endkunden (perspektivisch)

### 2.3 Kernfunktionen
- Projekt öffnen via ATBS-Nr ODER Adresse
- Sprach-zu-Text (mehrsprachig: DE, RU, HU, RO, PL)
- Foto-Upload mit Kategorisierung
- Mängel/Nachträge erfassen
- Gewerke-Status updaten
- Termine pflegen
- Erinnerungen
- Morgen-Briefing
- Freitextsuche

### 2.4 Rollen-System
- **Bauleiter:** Alles sehen
- **Handwerker (intern):** Nur Fotos, keine Preise
- **NU:** Keine internen Daten
- **NIEMALS Preise über Telegram!**

---

## 3. SharePoint-Sync

### 3.1 Sites (alle Wohnungssanierung-*)

| Site | Sicherheitsstufe | Zugriff |
|------|------------------|---------|
| Wohnungssanierung | 1 | Intern |
| Wohnungssanierung-Projekte | 1-2 | Intern |
| Wohnungssanierung-Kunden | 1 | Intern |
| Wohnungssanierung-Marketing | 1 | Intern |
| Wohnungssanierung-00-Vertrieb | 2 | Vertraulich |
| Wohnungssanierung-04-Personal | **4** | **Nur holger.neumann@** |
| Wohnungssanierung-11-Nachunternehmer | 1 | Intern |
| Wohnungssanierung-15-Großhandel | 2 | Vertraulich |
| Wohnungssanierung-30-Technik | 1 | Intern |
| Wohnungssanierung-60-Operations | 1 | Intern |
| Wohnungssanierung-Finanzen | **3** | **holger@ + tobias.rangol@** |
| Wohnungssanierung-Management | **4** | **Nur holger.neumann@** |

### 3.2 Sync-Strategie
- **Fotos (JPG, PNG):** RUNTERLADEN → Supabase Storage
- **PDFs, DOCX, XLSX:** RUNTERLADEN → Supabase Storage
- **Videos (MP4, MOV):** NUR VERLINKEN → Metadaten in DB

---

## 4. Neue Datenbank-Tabellen

### 4.1 kontakt_typen
```sql
-- Lookup für Rollen
(ADM, GF, BL, HW, BH, NU, LI, KU, AP)
```

### 4.2 dokument_typen
```sql
-- Lookup für Dokumentarten (Umlaute korrigiert)
```

### 4.3 fotos
```sql
-- Foto-Verwaltung mit Kategorien (mangel, nachtrag, nachweis, doku, etc.)
```

### 4.4 telegram_sessions
```sql
-- Bot-State pro Chat
```

### 4.5 erinnerungen
```sql
-- Erinnerungen für Bot
```

---

## 5. Role-Level Security

| Stufe | Zugriff | Daten |
|-------|---------|-------|
| 0 | Öffentlich | - |
| 1 | Intern | Projekte, Mängel |
| 2 | Vertraulich | Preise, Margen |
| 3 | Sensibel | Finanzen |
| 4 | Streng | Personal, Management |

---

## 6. Implementierung

Wird durch Subagenten parallel durchgeführt:
1. **Agent 1:** DB-Migrationen
2. **Agent 2:** Telegram-Bot Basis
3. **Agent 3:** SharePoint-Sync (parallel im Hintergrund)

---

*Aktualisiert: 2026-01-28*
