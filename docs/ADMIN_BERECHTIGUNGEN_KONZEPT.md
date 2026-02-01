# Admin & Berechtigungen - Konzept

**Stand:** 2026-02-01
**Status:** Konzept
**Priorität:** 🟡 Mittel

---

## Ziel

Nutzer- und Berechtigungsverwaltung für das neurealis ERP:
1. Admin kann Nutzer verwalten (MS365-Accounts)
2. Rollen-basierte Zugriffskontrolle
3. CRUD-Berechtigungen pro Kategorie
4. Freischaltung/Sperrung von Nutzern

---

## Aktueller Stand

| Komponente | Status |
|------------|--------|
| Supabase Auth | ✅ Aktiv (Microsoft OAuth) |
| RLS Policies | ✅ Basis vorhanden |
| Admin-UI | ❌ Nicht vorhanden |
| Rollen-System | ❌ Nicht vorhanden |
| CRUD-Matrix | ❌ Nicht vorhanden |

---

## Rollen-Modell

### Definierte Rollen

| Rolle | Kürzel | Beschreibung | Beispiel |
|-------|--------|--------------|----------|
| **Administrator** | ADM | Volle Rechte, Nutzerverwaltung | holger.neumann@neurealis.de |
| **Geschäftsführer** | GF | Alle Daten lesen, wichtige Entscheidungen | - |
| **Bauleiter** | BL | Projekte, Mängel, Nachträge, Nachweise | dirk.jansen@neurealis.de |
| **Buchhaltung** | BH | Finanzen, Rechnungen, Zahlungen | tobias.rangol@neurealis.de |
| **Sachbearbeiter** | SB | Eingeschränkter Zugriff | - |
| **Nachunternehmer** | NU | Nur eigene Projekte (via Telegram) | - |
| **Kunde** | KU | Nur eigenes Projekt (via Portal) | - |

### Rollen-Hierarchie

```
Administrator (ADM)
    ↓
Geschäftsführer (GF)
    ↓
┌───────────┬───────────┐
Bauleiter   Buchhaltung
(BL)        (BH)
    ↓
Sachbearbeiter (SB)
    ↓
┌───────────┬───────────┐
Nachunternehmer  Kunde
(NU)             (KU)
```

---

## CRUD-Matrix

### Kategorien

| # | Kategorie | Tabellen |
|---|-----------|----------|
| 1 | **Projekte** | monday_bauprozess, aufmass_data |
| 2 | **Mängel** | maengel_fertigstellung |
| 3 | **Nachträge** | nachtraege |
| 4 | **Nachweise** | dokumente (Typ: NACHWEIS-*) |
| 5 | **Finanzen** | softr_dokumente, konto_transaktionen |
| 6 | **Kontakte** | kontakte |
| 7 | **Angebote** | angebote, angebots_positionen |
| 8 | **LV-Positionen** | lv_positionen |
| 9 | **Blog/Marketing** | blog_posts, social_media_posts |
| 10 | **Nutzer** | auth.users, nutzer_rollen |

### Matrix

| Kategorie | ADM | GF | BL | BH | SB | NU | KU |
|-----------|-----|----|----|----|----|----|----|
| **Projekte** | CRUD | CRUD | CRUD | R | R | R* | R* |
| **Mängel** | CRUD | CRUD | CRUD | R | CR | CR* | CR* |
| **Nachträge** | CRUD | CRUD | CRUD | R | R | R* | R* |
| **Nachweise** | CRUD | CRUD | CRUD | R | CR | CR* | - |
| **Finanzen** | CRUD | CRUD | R | CRUD | - | - | - |
| **Kontakte** | CRUD | CRUD | CRU | R | R | - | - |
| **Angebote** | CRUD | CRUD | CRUD | R | R | - | R* |
| **LV-Positionen** | CRUD | CRUD | R | R | R | - | - |
| **Blog/Marketing** | CRUD | CRUD | R | - | R | - | - |
| **Nutzer** | CRUD | R | - | - | - | - | - |

**Legende:**
- C = Create
- R = Read
- U = Update
- D = Delete
- \* = Nur eigene Daten (gefiltert)
- \- = Kein Zugriff

---

## Datenmodell

### Neue Tabellen

```sql
-- Rollen-Definition
CREATE TABLE nutzer_rollen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rolle TEXT NOT NULL UNIQUE,
  beschreibung TEXT,
  hierarchie_level INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed-Daten
INSERT INTO nutzer_rollen (rolle, beschreibung, hierarchie_level) VALUES
  ('ADM', 'Administrator', 100),
  ('GF', 'Geschäftsführer', 90),
  ('BL', 'Bauleiter', 70),
  ('BH', 'Buchhaltung', 70),
  ('SB', 'Sachbearbeiter', 50),
  ('NU', 'Nachunternehmer', 20),
  ('KU', 'Kunde', 10);

-- Nutzer-Rollen-Zuweisung
CREATE TABLE nutzer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  rolle TEXT REFERENCES nutzer_rollen(rolle),
  aktiv BOOLEAN DEFAULT FALSE,
  telegram_chat_id BIGINT,
  kontakt_id UUID REFERENCES kontakte(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  activated_at TIMESTAMPTZ,
  activated_by UUID
);

-- Berechtigungs-Matrix
CREATE TABLE berechtigungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rolle TEXT REFERENCES nutzer_rollen(rolle),
  kategorie TEXT NOT NULL,
  can_create BOOLEAN DEFAULT FALSE,
  can_read BOOLEAN DEFAULT FALSE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  filter_eigene BOOLEAN DEFAULT FALSE, -- Nur eigene Daten
  UNIQUE(rolle, kategorie)
);

-- Seed Berechtigungen (Beispiel für BL)
INSERT INTO berechtigungen (rolle, kategorie, can_create, can_read, can_update, can_delete) VALUES
  ('BL', 'projekte', TRUE, TRUE, TRUE, TRUE),
  ('BL', 'maengel', TRUE, TRUE, TRUE, TRUE),
  ('BL', 'nachtraege', TRUE, TRUE, TRUE, TRUE),
  ('BL', 'nachweise', TRUE, TRUE, TRUE, TRUE),
  ('BL', 'finanzen', FALSE, TRUE, FALSE, FALSE),
  ('BL', 'kontakte', TRUE, TRUE, TRUE, FALSE),
  ('BL', 'angebote', TRUE, TRUE, TRUE, TRUE),
  ('BL', 'lv_positionen', FALSE, TRUE, FALSE, FALSE),
  ('BL', 'blog', FALSE, TRUE, FALSE, FALSE),
  ('BL', 'nutzer', FALSE, FALSE, FALSE, FALSE);
```

### RLS-Policies

```sql
-- Beispiel: Mängel für NU (nur eigene Projekte)
CREATE POLICY "NU sieht nur eigene Mängel"
ON maengel_fertigstellung
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM nutzer n
    JOIN kontakte k ON n.kontakt_id = k.id
    JOIN monday_bauprozess mb ON mb.nachunternehmer ILIKE '%' || k.firma || '%'
    WHERE n.email = auth.jwt()->>'email'
      AND n.rolle = 'NU'
      AND mb.atbs_nummer = maengel_fertigstellung.projekt_nr
  )
  OR
  EXISTS (
    SELECT 1 FROM nutzer n
    WHERE n.email = auth.jwt()->>'email'
      AND n.rolle IN ('ADM', 'GF', 'BL', 'BH', 'SB')
  )
);
```

---

## Admin-UI

### Seite: `/admin`

**Zugriff:** Nur ADM-Rolle

### Tabs

#### 1. Nutzer-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│ 👥 NUTZER-VERWALTUNG                          [+ Neu]       │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Suche...                    Filter: [Alle Rollen ▼]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ E-Mail                    │ Name           │ Rolle │ Status │
│ ─────────────────────────────────────────────────────────── │
│ holger.neumann@neurealis  │ Holger Neumann │ ADM   │ ✅     │
│ dirk.jansen@neurealis     │ Dirk Jansen    │ BL    │ ✅     │
│ tobias.rangol@neurealis   │ Tobias Rangol  │ BH    │ ✅     │
│ service@neurealis.de      │ -              │ -     │ ⏳     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Nutzer bearbeiten

```
┌─────────────────────────────────────────────────────────────┐
│ ✏️ NUTZER BEARBEITEN                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ E-Mail:     dirk.jansen@neurealis.de (nicht änderbar)       │
│                                                             │
│ Name:       [Dirk Jansen                    ]               │
│                                                             │
│ Rolle:      [Bauleiter (BL)              ▼]                 │
│                                                             │
│ Status:     [●] Aktiv  [ ] Gesperrt                         │
│                                                             │
│ Telegram:   7123456789 (verifiziert am 01.02.2026)          │
│                                                             │
│ Kontakt:    [Dirk Jansen - neurealis GmbH ▼]                │
│                                                             │
│                            [Abbrechen] [💾 Speichern]        │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Rollen & Berechtigungen

```
┌─────────────────────────────────────────────────────────────┐
│ 🔐 BERECHTIGUNGEN                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Rolle: [Bauleiter (BL)  ▼]                                  │
│                                                             │
│ Kategorie      │ Lesen │ Erstellen │ Bearbeiten │ Löschen  │
│ ──────────────────────────────────────────────────────────  │
│ Projekte       │  [✓]  │    [✓]    │    [✓]     │   [✓]    │
│ Mängel         │  [✓]  │    [✓]    │    [✓]     │   [✓]    │
│ Nachträge      │  [✓]  │    [✓]    │    [✓]     │   [✓]    │
│ Nachweise      │  [✓]  │    [✓]    │    [✓]     │   [✓]    │
│ Finanzen       │  [✓]  │    [ ]    │    [ ]     │   [ ]    │
│ Kontakte       │  [✓]  │    [✓]    │    [✓]     │   [ ]    │
│ Angebote       │  [✓]  │    [✓]    │    [✓]     │   [✓]    │
│ LV-Positionen  │  [✓]  │    [ ]    │    [ ]     │   [ ]    │
│ Blog/Marketing │  [✓]  │    [ ]    │    [ ]     │   [ ]    │
│ Nutzer         │  [ ]  │    [ ]    │    [ ]     │   [ ]    │
│                                                             │
│                                      [💾 Speichern]          │
└─────────────────────────────────────────────────────────────┘
```

---

## MS365-Integration

### Verfügbare E-Mail-Adressen

| E-Mail | Vorgeschlagene Rolle |
|--------|---------------------|
| holger.neumann@neurealis.de | ADM |
| dirk.jansen@neurealis.de | BL |
| tobias.rangol@neurealis.de | BH |
| service@neurealis.de | SB |
| kontakt@neurealis.de | SB |
| rechnungen@neurealis.de | BH |
| bewerbungen@neurealis.de | SB |
| auftraege@neurealis.de | SB |

### Auto-Provisioning

Bei erstem Login über Microsoft OAuth:
1. Nutzer wird in `nutzer` angelegt
2. Status = `inaktiv` (muss freigeschaltet werden)
3. Admin erhält Benachrichtigung
4. Admin weist Rolle zu und aktiviert

---

## Implementierungs-Reihenfolge

### Phase 6a: Basis (2 Tage)

1. **DB-Migration:** `nutzer_rollen`, `nutzer`, `berechtigungen`
2. **Seed-Daten:** Rollen + Standard-Berechtigungen
3. **holger.neumann@neurealis.de** als ADM anlegen

### Phase 6b: Admin-UI (2-3 Tage)

4. **Seite `/admin`** mit Tabs
5. **Nutzer-Liste** mit Filter/Suche
6. **Nutzer bearbeiten** (Rolle, Status)
7. **Berechtigungs-Matrix** (Checkboxen)

### Phase 6c: RLS-Policies (1-2 Tage)

8. **RLS für alle Tabellen** basierend auf `berechtigungen`
9. **Testen** mit verschiedenen Rollen

---

## Sicherheit

### Regeln

1. **ADM kann nicht gelöscht werden** (mindestens 1 Admin)
2. **Eigene Rolle kann nicht geändert werden** (Schutz vor Aussperrung)
3. **Inaktive Nutzer können sich nicht einloggen** (RLS blockiert)
4. **Alle Änderungen werden geloggt** (audit_log Tabelle)

### Audit-Log

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabelle TEXT NOT NULL,
  aktion TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  zeilen_id UUID,
  alte_werte JSONB,
  neue_werte JSONB,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Offene Fragen

- [ ] Welche Rollen genau? (ADM, GF, BL, BH, SB, NU, KU)
- [ ] Sollen NUs auch in der Admin-UI verwaltet werden?
- [ ] Auto-Provisioning bei erstem Login oder manuelle Anlage?
- [ ] Audit-Log für alle Änderungen?
- [ ] E-Mail-Benachrichtigung bei Freischaltung?

---

*Erstellt: 2026-02-01*
