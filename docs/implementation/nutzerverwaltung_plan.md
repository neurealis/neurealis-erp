# Nutzerverwaltung - Implementierungsplan

**Erstellt:** 2026-02-04
**Status:** Planung
**Verantwortlich:** Claude Code

---

## 1. Übersicht

### Ziel

Implementierung einer vollständigen Nutzerverwaltung für das neurealis ERP mit:
- Automatischer MS365-User-Synchronisation
- Rollenbasierter Zugriffskontrolle (RBAC)
- Menü-Berechtigungen pro Rolle
- Aktivitäts-Logging
- Admin-UI zur Verwaltung

### Scope

| Komponente | Beschreibung |
|------------|--------------|
| DB-Schema | 3 neue Tabellen (nutzer, menu_berechtigungen, nutzer_logs) |
| Edge Function | ms365-users-sync für User-Import |
| UI-Seiten | Admin-Bereich unter /admin/* |
| Sidebar | Dynamische Filterung nach Rolle |
| RLS | Row-Level Security für alle Tabellen |

### Entscheidungen

| Entscheidung | Wert | Grund |
|--------------|------|-------|
| Auto-Aktivierung | **NEIN** | Admin muss jeden User freigeben |
| Default-Rolle | **HW** (Handwerker) | Niedrigste Berechtigungsstufe |
| Shared Accounts | **IGNORIEREN** | Nur persönliche Accounts (service@, rechnungen@, etc. werden nicht importiert) |

---

## 2. Datenbankschema

### 2.1 Tabelle: nutzer

Zentrale Nutzertabelle, verknüpft mit Supabase Auth und MS365.

```sql
-- Migration: create_nutzer_table
CREATE TABLE IF NOT EXISTS nutzer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Supabase Auth Verknüpfung
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

    -- MS365 Verknüpfung
    ms365_id TEXT UNIQUE,
    ms365_upn TEXT UNIQUE,  -- User Principal Name (E-Mail)

    -- Stammdaten
    email TEXT NOT NULL UNIQUE,
    vorname TEXT,
    nachname TEXT,
    anzeigename TEXT GENERATED ALWAYS AS (
        COALESCE(vorname || ' ' || nachname, vorname, nachname, email)
    ) STORED,
    telefon TEXT,
    position TEXT,  -- z.B. "Bauleiter", "Geschäftsführer"
    abteilung TEXT,

    -- Profilbild
    avatar_url TEXT,

    -- Rolle (FK auf kontakt_typen)
    rolle_id UUID REFERENCES kontakt_typen(id),
    rolle_kuerzel TEXT GENERATED ALWAYS AS (
        (SELECT kuerzel FROM kontakt_typen WHERE id = rolle_id)
    ) STORED,

    -- Status
    ist_aktiv BOOLEAN DEFAULT FALSE,  -- WICHTIG: Default FALSE, Admin muss aktivieren
    aktiviert_am TIMESTAMPTZ,
    aktiviert_von UUID REFERENCES nutzer(id),
    deaktiviert_am TIMESTAMPTZ,
    deaktiviert_von UUID REFERENCES nutzer(id),
    deaktivierungs_grund TEXT,

    -- Telegram-Verknüpfung (optional)
    telegram_chat_id TEXT,
    telegram_username TEXT,

    -- Präferenzen
    sprache TEXT DEFAULT 'de' CHECK (sprache IN ('de', 'en')),
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    benachrichtigungen_email BOOLEAN DEFAULT TRUE,
    benachrichtigungen_telegram BOOLEAN DEFAULT TRUE,

    -- Sync-Metadaten
    ms365_synced_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für häufige Abfragen
CREATE INDEX idx_nutzer_email ON nutzer(email);
CREATE INDEX idx_nutzer_rolle ON nutzer(rolle_id);
CREATE INDEX idx_nutzer_aktiv ON nutzer(ist_aktiv) WHERE ist_aktiv = TRUE;
CREATE INDEX idx_nutzer_ms365_id ON nutzer(ms365_id) WHERE ms365_id IS NOT NULL;

-- Trigger für updated_at
CREATE TRIGGER trg_nutzer_updated_at
    BEFORE UPDATE ON nutzer
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Kommentar
COMMENT ON TABLE nutzer IS 'Zentrale Nutzerverwaltung - verknüpft Supabase Auth, MS365 und Rollen';
COMMENT ON COLUMN nutzer.ist_aktiv IS 'User muss von Admin aktiviert werden (kein Auto-Login)';
COMMENT ON COLUMN nutzer.rolle_id IS 'Verweist auf kontakt_typen (ADM, GF, BL, BH, HW, NU, KU, LI, AP)';
```

### 2.2 Tabelle: menu_berechtigungen

Mapping zwischen Rollen und Menü-Einträgen.

```sql
-- Migration: create_menu_berechtigungen_table
CREATE TABLE IF NOT EXISTS menu_berechtigungen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Rolle
    rolle_id UUID NOT NULL REFERENCES kontakt_typen(id) ON DELETE CASCADE,

    -- Menü-Eintrag
    menu_key TEXT NOT NULL,  -- z.B. 'dashboard', 'bauvorhaben', 'finanzen'
    menu_label TEXT NOT NULL,  -- Anzeigename
    menu_pfad TEXT NOT NULL,  -- URL-Pfad, z.B. '/finanzen'
    menu_icon TEXT,  -- Icon-Key für Sidebar
    menu_parent TEXT,  -- Für Untermenüs, z.B. 'einkauf'
    menu_reihenfolge INTEGER DEFAULT 0,

    -- Berechtigungen
    kann_lesen BOOLEAN DEFAULT TRUE,
    kann_erstellen BOOLEAN DEFAULT FALSE,
    kann_bearbeiten BOOLEAN DEFAULT FALSE,
    kann_loeschen BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique pro Rolle + Menu
    UNIQUE(rolle_id, menu_key)
);

-- Index
CREATE INDEX idx_menu_berechtigungen_rolle ON menu_berechtigungen(rolle_id);

-- Kommentar
COMMENT ON TABLE menu_berechtigungen IS 'Rollenbasierte Menü-Berechtigungen für Sidebar-Filterung';
```

### 2.3 Tabelle: nutzer_logs

Aktivitäts-Logging für Audit-Trail.

```sql
-- Migration: create_nutzer_logs_table
CREATE TABLE IF NOT EXISTS nutzer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Wer
    nutzer_id UUID REFERENCES nutzer(id) ON DELETE SET NULL,
    nutzer_email TEXT,  -- Backup falls User gelöscht

    -- Was
    aktion TEXT NOT NULL,  -- z.B. 'login', 'logout', 'create', 'update', 'delete', 'view'
    entitaet TEXT,  -- z.B. 'bauvorhaben', 'mangel', 'nachtrag'
    entitaet_id TEXT,  -- ID des betroffenen Objekts

    -- Details
    details JSONB,  -- Zusätzliche Infos (alte/neue Werte, etc.)
    ip_adresse TEXT,
    user_agent TEXT,

    -- Timestamp
    erstellt_am TIMESTAMPTZ DEFAULT NOW()
);

-- Partitionierung nach Monat für Performance (optional, später)
-- CREATE TABLE nutzer_logs_2026_02 PARTITION OF nutzer_logs
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Index für häufige Abfragen
CREATE INDEX idx_nutzer_logs_nutzer ON nutzer_logs(nutzer_id);
CREATE INDEX idx_nutzer_logs_aktion ON nutzer_logs(aktion);
CREATE INDEX idx_nutzer_logs_entitaet ON nutzer_logs(entitaet, entitaet_id);
CREATE INDEX idx_nutzer_logs_datum ON nutzer_logs(erstellt_am DESC);

-- Kommentar
COMMENT ON TABLE nutzer_logs IS 'Aktivitäts-Logging für Audit-Trail und Compliance';
```

### 2.4 RLS Policies

```sql
-- RLS für nutzer
ALTER TABLE nutzer ENABLE ROW LEVEL SECURITY;

-- Admin kann alles
CREATE POLICY "Admins können alle Nutzer verwalten"
    ON nutzer FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM nutzer n
            JOIN kontakt_typen kt ON n.rolle_id = kt.id
            WHERE n.auth_user_id = auth.uid()
            AND kt.kuerzel IN ('ADM', 'GF')
            AND n.ist_aktiv = TRUE
        )
    );

-- User kann eigenes Profil lesen/bearbeiten
CREATE POLICY "User kann eigenes Profil sehen"
    ON nutzer FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

CREATE POLICY "User kann eigenes Profil bearbeiten"
    ON nutzer FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (
        -- Kann nur bestimmte Felder ändern
        auth_user_id = auth.uid()
    );

-- RLS für menu_berechtigungen
ALTER TABLE menu_berechtigungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle können Berechtigungen lesen"
    ON menu_berechtigungen FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Nur Admins können Berechtigungen ändern"
    ON menu_berechtigungen FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM nutzer n
            JOIN kontakt_typen kt ON n.rolle_id = kt.id
            WHERE n.auth_user_id = auth.uid()
            AND kt.kuerzel = 'ADM'
            AND n.ist_aktiv = TRUE
        )
    );

-- RLS für nutzer_logs
ALTER TABLE nutzer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins können alle Logs sehen"
    ON nutzer_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM nutzer n
            JOIN kontakt_typen kt ON n.rolle_id = kt.id
            WHERE n.auth_user_id = auth.uid()
            AND kt.kuerzel IN ('ADM', 'GF')
            AND n.ist_aktiv = TRUE
        )
    );

CREATE POLICY "User kann eigene Logs sehen"
    ON nutzer_logs FOR SELECT
    TO authenticated
    USING (nutzer_id = (SELECT id FROM nutzer WHERE auth_user_id = auth.uid()));
```

### 2.5 Helper Functions

```sql
-- Funktion: Aktuellen Nutzer holen
CREATE OR REPLACE FUNCTION get_current_nutzer()
RETURNS nutzer AS $$
    SELECT * FROM nutzer
    WHERE auth_user_id = auth.uid()
    AND ist_aktiv = TRUE
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Funktion: Nutzer-Rolle prüfen
CREATE OR REPLACE FUNCTION has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM nutzer n
        JOIN kontakt_typen kt ON n.rolle_id = kt.id
        WHERE n.auth_user_id = auth.uid()
        AND n.ist_aktiv = TRUE
        AND kt.kuerzel = ANY(required_roles)
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Funktion: Menü-Berechtigungen für aktuellen User
CREATE OR REPLACE FUNCTION get_menu_berechtigungen()
RETURNS SETOF menu_berechtigungen AS $$
    SELECT mb.* FROM menu_berechtigungen mb
    JOIN nutzer n ON n.rolle_id = mb.rolle_id
    WHERE n.auth_user_id = auth.uid()
    AND n.ist_aktiv = TRUE
    ORDER BY mb.menu_reihenfolge;
$$ LANGUAGE sql SECURITY DEFINER;

-- Funktion: Log-Eintrag erstellen
CREATE OR REPLACE FUNCTION log_nutzer_aktion(
    p_aktion TEXT,
    p_entitaet TEXT DEFAULT NULL,
    p_entitaet_id TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_nutzer RECORD;
    v_log_id UUID;
BEGIN
    SELECT id, email INTO v_nutzer
    FROM nutzer WHERE auth_user_id = auth.uid();

    INSERT INTO nutzer_logs (
        nutzer_id, nutzer_email, aktion, entitaet, entitaet_id, details
    ) VALUES (
        v_nutzer.id, v_nutzer.email, p_aktion, p_entitaet, p_entitaet_id, p_details
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Edge Function: ms365-users-sync

### 3.1 Übersicht

| Eigenschaft | Wert |
|-------------|------|
| Name | `ms365-users-sync` |
| Trigger | Cron täglich 06:00 + Manuell |
| Auth | Service Role (verify_jwt: false für Cron) |
| Abhängigkeiten | MS365 Graph API |

### 3.2 Shared Accounts Filter

Diese Accounts werden NICHT importiert:

```typescript
const SHARED_ACCOUNTS_FILTER = [
    // Service-Postfächer
    'service@neurealis.de',
    'kontakt@neurealis.de',
    'rechnungen@neurealis.de',
    'bewerbungen@neurealis.de',
    'auftraege@neurealis.de',
    'partner@neurealis.de',
    // Generische Accounts
    'info@neurealis.de',
    'noreply@neurealis.de',
    // Pattern für Shared Mailboxes
    /^shared[-_]/i,
    /[-_]shared@/i,
    // Service Accounts
    /^svc[-_]/i,
    /^service[-_]/i,
];

function isSharedAccount(email: string): boolean {
    const emailLower = email.toLowerCase();

    for (const filter of SHARED_ACCOUNTS_FILTER) {
        if (typeof filter === 'string') {
            if (emailLower === filter.toLowerCase()) return true;
        } else if (filter instanceof RegExp) {
            if (filter.test(emailLower)) return true;
        }
    }

    return false;
}
```

### 3.3 Implementation

```typescript
// supabase/functions/ms365-users-sync/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const TENANT_ID = Deno.env.get('MS365_TENANT_ID');
const CLIENT_ID = Deno.env.get('MS365_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('MS365_CLIENT_SECRET');

// Shared Accounts die ignoriert werden
const SHARED_ACCOUNTS = new Set([
    'service@neurealis.de',
    'kontakt@neurealis.de',
    'rechnungen@neurealis.de',
    'bewerbungen@neurealis.de',
    'auftraege@neurealis.de',
    'partner@neurealis.de',
    'info@neurealis.de',
    'noreply@neurealis.de',
]);

interface MS365User {
    id: string;
    userPrincipalName: string;
    displayName: string;
    givenName?: string;
    surname?: string;
    mail?: string;
    jobTitle?: string;
    department?: string;
    mobilePhone?: string;
    accountEnabled: boolean;
}

async function getAccessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID!,
            client_secret: CLIENT_SECRET!,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
        }),
    });

    const data = await response.json();
    return data.access_token;
}

async function getMS365Users(token: string): Promise<MS365User[]> {
    const users: MS365User[] = [];
    let nextLink = `${GRAPH_API_URL}/users?$select=id,userPrincipalName,displayName,givenName,surname,mail,jobTitle,department,mobilePhone,accountEnabled&$filter=accountEnabled eq true`;

    while (nextLink) {
        const response = await fetch(nextLink, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        users.push(...data.value);
        nextLink = data['@odata.nextLink'];
    }

    return users;
}

function isSharedAccount(email: string): boolean {
    const emailLower = email.toLowerCase();

    // Exakte Matches
    if (SHARED_ACCOUNTS.has(emailLower)) return true;

    // Pattern Matches
    if (/^shared[-_]/i.test(emailLower)) return true;
    if (/[-_]shared@/i.test(emailLower)) return true;
    if (/^svc[-_]/i.test(emailLower)) return true;
    if (/^service[-_]/i.test(emailLower)) return true;

    return false;
}

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. MS365 Access Token holen
        const token = await getAccessToken();

        // 2. Alle MS365 User abrufen
        const ms365Users = await getMS365Users(token);
        console.log(`MS365: ${ms365Users.length} User gefunden`);

        // 3. Filtern: Nur persönliche Accounts
        const personalUsers = ms365Users.filter(u => !isSharedAccount(u.userPrincipalName));
        console.log(`Nach Filter: ${personalUsers.length} persönliche User`);

        // 4. Default-Rolle (HW = Handwerker) holen
        const { data: defaultRolle } = await supabase
            .from('kontakt_typen')
            .select('id')
            .eq('kuerzel', 'HW')
            .single();

        // 5. Existierende Nutzer laden
        const { data: existingUsers } = await supabase
            .from('nutzer')
            .select('id, ms365_id, email');

        const existingByMs365Id = new Map(
            existingUsers?.map(u => [u.ms365_id, u]) || []
        );
        const existingByEmail = new Map(
            existingUsers?.map(u => [u.email?.toLowerCase(), u]) || []
        );

        // 6. Sync durchführen
        const stats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        };

        for (const user of personalUsers) {
            try {
                const email = user.mail || user.userPrincipalName;
                const existing = existingByMs365Id.get(user.id) ||
                                 existingByEmail.get(email.toLowerCase());

                const userData = {
                    ms365_id: user.id,
                    ms365_upn: user.userPrincipalName,
                    email: email,
                    vorname: user.givenName,
                    nachname: user.surname,
                    telefon: user.mobilePhone,
                    position: user.jobTitle,
                    abteilung: user.department,
                    ms365_synced_at: new Date().toISOString(),
                };

                if (existing) {
                    // Update
                    await supabase
                        .from('nutzer')
                        .update(userData)
                        .eq('id', existing.id);
                    stats.updated++;
                } else {
                    // Create (mit Default-Rolle HW, NICHT aktiv)
                    await supabase
                        .from('nutzer')
                        .insert({
                            ...userData,
                            rolle_id: defaultRolle?.id,
                            ist_aktiv: false,  // WICHTIG: Muss von Admin aktiviert werden
                        });
                    stats.created++;
                }
            } catch (err) {
                console.error(`Fehler bei User ${user.userPrincipalName}:`, err);
                stats.errors++;
            }
        }

        // 7. Log erstellen
        await supabase.from('nutzer_logs').insert({
            aktion: 'ms365_sync',
            details: {
                ms365_total: ms365Users.length,
                personal_total: personalUsers.length,
                ...stats,
            },
        });

        return new Response(JSON.stringify({
            success: true,
            ms365_users: ms365Users.length,
            personal_users: personalUsers.length,
            stats,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('ms365-users-sync error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
```

### 3.4 Cron-Job

```sql
-- Cron: Täglich um 06:00 UTC
SELECT cron.schedule(
    'ms365-users-sync-daily',
    '0 6 * * *',
    $$
    SELECT net.http_post(
        url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/ms365-users-sync',
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
);
```

---

## 4. UI-Seiten

### 4.1 /admin/nutzer - Nutzerliste

**Funktionen:**
- Tabellenansicht aller Nutzer
- Filter: Aktiv/Inaktiv, Rolle, Suche
- Bulk-Aktionen: Aktivieren, Deaktivieren, Rolle ändern
- Neuen Nutzer anlegen (manuell)
- MS365-Sync manuell auslösen

**Spalten:**
| Spalte | Beschreibung |
|--------|--------------|
| Avatar | Profilbild oder Initialen |
| Name | Anzeigename |
| E-Mail | Mit mailto-Link |
| Rolle | Badge mit Farbe |
| Status | Aktiv (grün) / Inaktiv (grau) |
| Letzter Login | Datum/Uhrzeit |
| Aktionen | Bearbeiten, Aktivieren/Deaktivieren |

### 4.2 /admin/nutzer/[id] - Nutzer-Detail

**Tabs:**
1. **Profil** - Stammdaten bearbeiten
2. **Berechtigungen** - Individuelle Überschreibungen
3. **Aktivität** - Log der letzten Aktionen
4. **Einstellungen** - Benachrichtigungen, Sprache, Theme

**Felder Profil:**
- Vorname, Nachname
- E-Mail (readonly wenn MS365)
- Telefon
- Position, Abteilung
- Rolle (Dropdown)
- Status (Toggle)
- Telegram-Verknüpfung

### 4.3 /admin/berechtigungen - Berechtigungsmatrix

**Matrix-Ansicht:**
| Menü | ADM | GF | BL | BH | HW | NU | KU | LI | AP |
|------|-----|----|----|----|----|----|----|----|----|
| Dashboard | CRUD | CRUD | R | R | R | R | R | R | R |
| Bauvorhaben | CRUD | CRUD | CRUD | R | R | - | R | - | - |
| Finanzen | CRUD | CRUD | - | CRUD | - | - | - | - | - |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Legende:**
- C = Create, R = Read, U = Update, D = Delete
- `-` = Kein Zugriff

---

## 5. Rollen & Standard-Berechtigungen

### 5.1 Rollen-Übersicht

Die Rollen sind bereits in `kontakt_typen` definiert:

| Kürzel | Name | Kategorie | Beschreibung |
|--------|------|-----------|--------------|
| **ADM** | Administrator | intern | Vollzugriff auf alles |
| **GF** | Geschäftsführer | intern | Vollzugriff + Finanzen + Personal |
| **BL** | Bauleiter | intern | Projekte, Mängel, Nachträge, Preise |
| **BH** | Buchhaltung | intern | Finanzen, Dokumente |
| **HW** | Handwerker | intern | Fotos, Mängel (nur lesen) |
| **NU** | Nachunternehmer | extern | Eigene Projekte, Nachweise, eigene Mängel |
| **KU** | Kunde | extern | Eigene Projekte, eigene Dokumente |
| **LI** | Lieferant | extern | Eigene Bestellungen |
| **AP** | Ansprechpartner | extern | Nur lesen |

### 5.2 Standard-Berechtigungen

```sql
-- Seed: Standard-Berechtigungen für alle Rollen
INSERT INTO menu_berechtigungen (rolle_id, menu_key, menu_label, menu_pfad, menu_icon, menu_reihenfolge, kann_lesen, kann_erstellen, kann_bearbeiten, kann_loeschen)
SELECT
    kt.id,
    m.menu_key,
    m.menu_label,
    m.menu_pfad,
    m.menu_icon,
    m.menu_reihenfolge,
    m.kann_lesen,
    m.kann_erstellen,
    m.kann_bearbeiten,
    m.kann_loeschen
FROM kontakt_typen kt
CROSS JOIN (
    VALUES
    -- Dashboard (alle)
    ('dashboard', 'Startseite', '/', 'home', 10, TRUE, FALSE, FALSE, FALSE),

    -- Bauvorhaben
    ('bauvorhaben', 'Bauvorhaben', '/bauvorhaben', 'building', 20, TRUE, FALSE, FALSE, FALSE),

    -- Kalender
    ('kalender', 'Kalender', '/kalender', 'calendar', 30, TRUE, FALSE, FALSE, FALSE),

    -- Angebote
    ('angebote', 'Angebote', '/angebote', 'file-text', 40, TRUE, FALSE, FALSE, FALSE),

    -- Mängel
    ('maengel', 'Mängel', '/maengel', 'alert', 50, TRUE, FALSE, FALSE, FALSE),

    -- Nachträge
    ('nachtraege', 'Nachträge', '/nachtraege', 'file-plus', 60, TRUE, FALSE, FALSE, FALSE),

    -- Finanzen
    ('finanzen', 'Finanzen', '/finanzen', 'euro', 70, TRUE, FALSE, FALSE, FALSE),

    -- Einkauf
    ('einkauf', 'Einkauf', '/einkauf', 'package', 80, TRUE, FALSE, FALSE, FALSE),
    ('bestellung', 'Bestellung', '/bestellung', 'cart', 81, TRUE, FALSE, FALSE, FALSE),
    ('bestellungen', 'Bestellungen', '/bestellungen', 'clipboard', 82, TRUE, FALSE, FALSE, FALSE),
    ('lv-export', 'LV-Export', '/lv-export', 'chart', 83, TRUE, FALSE, FALSE, FALSE),

    -- Kontakte
    ('kontakte', 'Kontakte', '/kontakte', 'users', 90, TRUE, FALSE, FALSE, FALSE),

    -- Leads
    ('leads', 'Leads', '/leads', 'target', 100, TRUE, FALSE, FALSE, FALSE),

    -- Marketing
    ('marketing', 'Marketing', '/marketing', 'megaphone', 110, TRUE, FALSE, FALSE, FALSE),

    -- Aufgaben
    ('aufgaben', 'Aufgaben', '/aufgaben', 'checklist', 120, TRUE, FALSE, FALSE, FALSE),

    -- Nachunternehmer
    ('nachunternehmer', 'Nachunternehmer', '/nachunternehmer', 'wrench', 130, TRUE, FALSE, FALSE, FALSE),

    -- Bewerber
    ('bewerber', 'Bewerber', '/bewerber', 'user-check', 140, TRUE, FALSE, FALSE, FALSE),

    -- Admin (nur ADM/GF)
    ('admin-nutzer', 'Nutzer', '/admin/nutzer', 'users', 200, TRUE, FALSE, FALSE, FALSE),
    ('admin-berechtigungen', 'Berechtigungen', '/admin/berechtigungen', 'shield', 210, TRUE, FALSE, FALSE, FALSE),

    -- Hilfe (alle)
    ('hilfe', 'Hilfe', '/hilfe', 'help', 999, TRUE, FALSE, FALSE, FALSE)
) AS m(menu_key, menu_label, menu_pfad, menu_icon, menu_reihenfolge, kann_lesen, kann_erstellen, kann_bearbeiten, kann_loeschen);

-- Spezifische Berechtigungen pro Rolle anpassen

-- ADM: Vollzugriff
UPDATE menu_berechtigungen SET
    kann_lesen = TRUE,
    kann_erstellen = TRUE,
    kann_bearbeiten = TRUE,
    kann_loeschen = TRUE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'ADM');

-- GF: Fast alles
UPDATE menu_berechtigungen SET
    kann_lesen = TRUE,
    kann_erstellen = TRUE,
    kann_bearbeiten = TRUE,
    kann_loeschen = TRUE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'GF');

-- BL: Projekte, Mängel, Nachträge voll, Rest lesen
UPDATE menu_berechtigungen SET
    kann_erstellen = TRUE,
    kann_bearbeiten = TRUE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'BL')
AND menu_key IN ('bauvorhaben', 'maengel', 'nachtraege', 'aufgaben', 'kontakte');

-- BH: Finanzen voll
UPDATE menu_berechtigungen SET
    kann_erstellen = TRUE,
    kann_bearbeiten = TRUE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'BH')
AND menu_key IN ('finanzen', 'kontakte');

-- HW: Nur lesen + Fotos hochladen
UPDATE menu_berechtigungen SET
    kann_lesen = FALSE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'HW')
AND menu_key NOT IN ('dashboard', 'bauvorhaben', 'maengel', 'aufgaben', 'hilfe');

-- NU: Nur eigene Sachen
UPDATE menu_berechtigungen SET
    kann_lesen = FALSE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'NU')
AND menu_key NOT IN ('dashboard', 'maengel', 'nachtraege', 'hilfe');

-- KU: Nur eigene Projekte
UPDATE menu_berechtigungen SET
    kann_lesen = FALSE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'KU')
AND menu_key NOT IN ('dashboard', 'bauvorhaben', 'angebote', 'hilfe');

-- LI: Nur Bestellungen
UPDATE menu_berechtigungen SET
    kann_lesen = FALSE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'LI')
AND menu_key NOT IN ('dashboard', 'bestellungen', 'hilfe');

-- AP: Nur lesen
UPDATE menu_berechtigungen SET
    kann_erstellen = FALSE,
    kann_bearbeiten = FALSE,
    kann_loeschen = FALSE
WHERE rolle_id = (SELECT id FROM kontakt_typen WHERE kuerzel = 'AP');

-- Admin-Bereich nur für ADM
UPDATE menu_berechtigungen SET
    kann_lesen = FALSE
WHERE menu_key LIKE 'admin-%'
AND rolle_id NOT IN (SELECT id FROM kontakt_typen WHERE kuerzel = 'ADM');
```

---

## 6. Sidebar-Integration

### 6.1 Dynamische Filterung

Die bestehende Sidebar.svelte muss angepasst werden, um Berechtigungen aus der Datenbank zu laden.

```typescript
// ui/src/lib/stores/berechtigungen.ts

import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';

export interface MenuBerechtigung {
    menu_key: string;
    menu_label: string;
    menu_pfad: string;
    menu_icon: string;
    menu_parent?: string;
    menu_reihenfolge: number;
    kann_lesen: boolean;
    kann_erstellen: boolean;
    kann_bearbeiten: boolean;
    kann_loeschen: boolean;
}

export const berechtigungen = writable<MenuBerechtigung[]>([]);
export const isLoading = writable(true);

export async function loadBerechtigungen() {
    isLoading.set(true);

    const { data, error } = await supabase
        .rpc('get_menu_berechtigungen');

    if (!error && data) {
        berechtigungen.set(data);
    }

    isLoading.set(false);
}

// Derived: Nur lesbare Menüs
export const lesbareMenus = derived(berechtigungen, ($b) =>
    $b.filter(m => m.kann_lesen).map(m => m.menu_pfad)
);

// Derived: Kann erstellen?
export const kannErstellen = derived(berechtigungen, ($b) =>
    (menuKey: string) => $b.find(m => m.menu_key === menuKey)?.kann_erstellen ?? false
);

// Derived: Kann bearbeiten?
export const kannBearbeiten = derived(berechtigungen, ($b) =>
    (menuKey: string) => $b.find(m => m.menu_key === menuKey)?.kann_bearbeiten ?? false
);

// Derived: Kann löschen?
export const kannLoeschen = derived(berechtigungen, ($b) =>
    (menuKey: string) => $b.find(m => m.menu_key === menuKey)?.kann_loeschen ?? false
);
```

### 6.2 Sidebar-Anpassung

```svelte
<!-- Sidebar.svelte Änderungen -->
<script lang="ts">
    import { berechtigungen, loadBerechtigungen, lesbareMenus } from '$lib/stores/berechtigungen';
    import { onMount } from 'svelte';

    onMount(() => {
        loadBerechtigungen();
    });

    // Gefilterte Entries basierend auf DB-Berechtigungen
    let filteredEntries = $derived(
        menuEntries.filter(entry => {
            if (isMenuGroup(entry)) {
                const hasVisibleChildren = entry.children.some(
                    child => $lesbareMenus.includes(child.href)
                );
                return hasVisibleChildren;
            }
            return $lesbareMenus.includes(entry.href);
        })
    );
</script>
```

---

## 7. Implementierungs-Reihenfolge

### Phase 1: Datenbank (Tag 1)

| Task | Priorität | Abhängigkeiten |
|------|-----------|----------------|
| 1.1 Migration: nutzer Tabelle | Hoch | - |
| 1.2 Migration: menu_berechtigungen Tabelle | Hoch | 1.1 |
| 1.3 Migration: nutzer_logs Tabelle | Mittel | 1.1 |
| 1.4 RLS Policies | Hoch | 1.1-1.3 |
| 1.5 Helper Functions | Mittel | 1.1 |
| 1.6 Seed: Standard-Berechtigungen | Hoch | 1.2 |

### Phase 2: Edge Function (Tag 2)

| Task | Priorität | Abhängigkeiten |
|------|-----------|----------------|
| 2.1 ms365-users-sync implementieren | Hoch | Phase 1 |
| 2.2 Shared Account Filter | Hoch | 2.1 |
| 2.3 Cron-Job einrichten | Mittel | 2.1 |
| 2.4 Initial-Sync ausführen | Hoch | 2.1-2.3 |

### Phase 3: UI-Seiten (Tag 3-4)

| Task | Priorität | Abhängigkeiten |
|------|-----------|----------------|
| 3.1 /admin/nutzer Liste | Hoch | Phase 2 |
| 3.2 /admin/nutzer/[id] Detail | Hoch | 3.1 |
| 3.3 /admin/berechtigungen Matrix | Mittel | Phase 1 |
| 3.4 Berechtigungs-Store | Hoch | Phase 1 |
| 3.5 Sidebar-Integration | Hoch | 3.4 |

### Phase 4: Testing & Rollout (Tag 5)

| Task | Priorität | Abhängigkeiten |
|------|-----------|----------------|
| 4.1 E2E Tests | Hoch | Phase 3 |
| 4.2 Admin-Nutzer aktivieren | Hoch | 4.1 |
| 4.3 Dokumentation | Mittel | - |
| 4.4 Go-Live | Hoch | 4.1-4.3 |

---

## 8. Offene Fragen

| # | Frage | Status | Entscheidung |
|---|-------|--------|--------------|
| 1 | Sollen externe User (NU, KU, LI) auch über MS365 synced werden? | Offen | Vermutlich nein - separate Registrierung |
| 2 | Wie lange sollen Logs aufbewahrt werden? | Offen | 90 Tage vorgeschlagen |
| 3 | Brauchen wir ein Passwort-Reset für lokale User? | Offen | Nein, nur MS365 OAuth |
| 4 | Soll es eine "Stellvertretung" geben (User A agiert als User B)? | Offen | Nicht in Phase 1 |

---

## 9. Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| MS365 API Rate-Limiting | Mittel | Niedrig | Cron nur 1x täglich, Retry-Logic |
| User kann sich nicht einloggen | Mittel | Hoch | Klare Fehlermeldung "Warten auf Admin-Freigabe" |
| Performance bei vielen Nutzern | Niedrig | Mittel | Indizes, Pagination |
| RLS zu restriktiv | Mittel | Hoch | Ausgiebig testen, Notfall-Admin-Bypass |

---

## 10. Abhängigkeiten

### Externe

- MS365 Graph API (Client Credentials Flow)
- Supabase Auth (OAuth Provider)

### Interne

- `kontakt_typen` Tabelle (bereits vorhanden, 9 Rollen)
- Sidebar.svelte (bereits vorhanden)
- supabase.ts Client (bereits vorhanden)

---

*Erstellt: 2026-02-04*
*Version: 1.0*
