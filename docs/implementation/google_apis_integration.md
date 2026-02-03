# Google APIs Integration für neurealis ERP

**Status:** 📋 GEPLANT
**Erstellt:** 2026-02-03
**Ziel:** Google Search Console, Google Analytics 4 und Google Ads vollständig in das neurealis ERP integrieren - mit OAuth-Flow, automatischem Daten-Sync und Dashboard-Visualisierung.

---

## Bestandsanalyse

### Bereits vorhanden:
- ✅ **OAuth-Pattern:** `ms365-oauth` Edge Function (perfekte Vorlage für Google OAuth)
- ✅ **Sync-Pattern:** `meta-ads-sync` Edge Function (Vorlage für Kampagnen-Sync)
- ✅ **Marketing-Koordination:** `docs/implementation/marketing_integration_koordination.md`
- ✅ **Marketing-UI:** `/marketing` Seite mit Analytics-Tab (aktuell Placeholder)
- ✅ **DB-Schema teilweise:** `ad_platforms`, `marketing_campaigns`, `campaign_metrics_daily` existieren

### Was fehlt:
- ❌ Google OAuth Edge Function
- ❌ Google API Token-Speicher (Tabelle)
- ❌ Search Console Sync Function
- ❌ Analytics 4 Sync Function
- ❌ Google Ads Sync Function
- ❌ UI-Integration für echte Daten

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                  SvelteKit UI (/marketing)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Search       │ │ Analytics    │ │ Google Ads   │        │
│  │ Console Tab  │ │ Tab          │ │ Tab          │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Edge Functions                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ google-oauth │ │ google-sc-   │ │ google-ads-  │        │
│  │ (login/cb/   │ │ sync (Cron)  │ │ sync (Cron)  │        │
│  │ refresh)     │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                   ┌──────────────┐                          │
│                   │ google-ga4-  │                          │
│                   │ sync (Cron)  │                          │
│                   └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Postgres                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ google_      │ │ search_      │ │ analytics_   │        │
│  │ tokens       │ │ console_     │ │ metrics_     │        │
│  │              │ │ metrics      │ │ daily        │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Search      │ │ Analytics   │ │ Google      │
   │ Console API │ │ Data API    │ │ Ads API     │
   └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Implementierungsplan

### Phase 1: Vorbereitung (User-Aufgaben)

**Holger muss erledigen:**

| # | Aufgabe | Dauer | Anleitung |
|---|---------|-------|-----------|
| 1 | Google Cloud Projekt erstellen | 10 Min | console.cloud.google.com |
| 2 | APIs aktivieren: Search Console API, Analytics Data API, Google Ads API | 5 Min | APIs & Services → Enable |
| 3 | OAuth 2.0 Client ID erstellen (Web Application) | 10 Min | Credentials → Create |
| 4 | Redirect URI eintragen: `https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/google-oauth?action=callback` | 2 Min | OAuth Client bearbeiten |
| 5 | Search Console Property verifizieren (falls noch nicht) | 5 Min | search.google.com/search-console |
| 6 | Google Ads Developer Token beantragen (MCC) | 5+ Tage | ads.google.com → API Center |

**Ergebnis:** Client ID, Client Secret, Property URL (sc-domain:neurealis.de)

---

### Phase 2: Backend - OAuth & Token-Management

**2.1 DB-Migration: `google_tokens` Tabelle**

```sql
CREATE TABLE google_tokens (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON google_tokens
  FOR ALL USING (auth.role() = 'service_role');
```

**2.2 Edge Function: `google-oauth`**

Analog zu `ms365-oauth` mit:
- `?action=login` → Redirect zu Google OAuth
- `?action=callback` → Code gegen Tokens tauschen
- `?action=status` → Token-Gültigkeit prüfen
- `?action=refresh` → Token erneuern
- `?action=token` → Gültigen Token zurückgeben (intern)

**Scopes:**
```
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/adwords
```

**Dateien:**
- `functions/supabase/functions/google-oauth/index.ts`

---

### Phase 3: Backend - Search Console Sync

**3.1 DB-Migration: `search_console_metrics`**

```sql
CREATE TABLE search_console_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  query TEXT,
  page TEXT,
  country TEXT DEFAULT 'DEU',
  device TEXT DEFAULT 'ALL',
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, query, page, country, device)
);

CREATE INDEX idx_sc_metrics_date ON search_console_metrics(date);
CREATE INDEX idx_sc_metrics_query ON search_console_metrics(query);
```

**3.2 Edge Function: `google-searchconsole-sync`**

- Cron: täglich 07:00 UTC
- API: Search Console API v1 (`searchAnalytics.query`)
- Daten: Letzte 7 Tage, nach Query und Page
- Upsert in `search_console_metrics`

**Dateien:**
- `functions/supabase/functions/google-searchconsole-sync/index.ts`

---

### Phase 4: Backend - Google Analytics 4 Sync

**4.1 DB-Migration: `analytics_metrics_daily`**

```sql
CREATE TABLE analytics_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  source TEXT,
  medium TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, source, medium)
);
```

**4.2 Edge Function: `google-analytics-sync`**

- Cron: täglich 07:00 UTC
- API: Analytics Data API v1 (`runReport`)
- Property ID: G-VMYJ4MYVDG (bereits vorhanden)
- Metriken: sessions, users, pageviews, bounceRate, conversions
- Dimensionen: date, sessionSource, sessionMedium

**Dateien:**
- `functions/supabase/functions/google-analytics-sync/index.ts`

---

### Phase 5: Backend - Google Ads Sync

**5.1 Edge Function: `google-ads-sync`**

- Cron: täglich 06:00 UTC
- API: Google Ads API v17 (GAQL)
- Nutzt bestehende Tabellen: `marketing_campaigns`, `campaign_metrics_daily`
- Analog zu `meta-ads-sync` Pattern

**GAQL Query:**
```sql
SELECT campaign.id, campaign.name, campaign.status,
       metrics.impressions, metrics.clicks, metrics.cost_micros,
       metrics.conversions, segments.date
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
```

**Dateien:**
- `functions/supabase/functions/google-ads-sync/index.ts`

---

### Phase 6: Frontend - Dashboard Integration

**6.1 Analytics-Tab erweitern**

Ersetze Placeholder in `/marketing` Analytics-Tab mit:

1. **KPI-Cards (oben):**
   - Besucher (30 Tage) - aus `analytics_metrics_daily`
   - Organische Klicks - aus `search_console_metrics`
   - Top-Position - aus `search_console_metrics`
   - Conversions - aus `analytics_metrics_daily`

2. **Search Console Section:**
   - Top 10 Keywords mit Klicks, Impressionen, CTR, Position
   - Trend-Chart (7 Tage)

3. **Analytics Section:**
   - Traffic-Quellen Pie-Chart
   - Sessions-Trend (30 Tage)

4. **Google Ads Section (falls aktiv):**
   - Kampagnen-Performance
   - Kosten/Conversions

**6.2 Settings-Page für OAuth**

Neue Route `/einstellungen/integrationen`:
- Google-Verbindungsstatus anzeigen
- "Mit Google verbinden" Button
- Token-Ablauf anzeigen
- Manueller Sync-Button

**Dateien:**
- `ui/src/routes/marketing/+page.svelte` (erweitern)
- `ui/src/routes/einstellungen/integrationen/+page.svelte` (neu)

---

## Credentials (Supabase Secrets)

Nach Phase 1 in Supabase Dashboard → Edge Functions → Secrets eintragen:

| Secret | Wert |
|--------|------|
| `GOOGLE_CLIENT_ID` | Aus Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Aus Google Cloud Console |
| `GOOGLE_SEARCH_CONSOLE_PROPERTY` | `sc-domain:neurealis.de` |
| `GOOGLE_ANALYTICS_PROPERTY_ID` | `properties/XXXXXXXXX` (aus GA4) |
| `GOOGLE_ADS_CUSTOMER_ID` | `XXX-XXX-XXXX` |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Aus MCC API Center |

---

## Reihenfolge der Implementierung

| # | Task | Abhängigkeit | Geschätzte Zeit |
|---|------|--------------|-----------------|
| 1 | User: Google Cloud Setup | - | 30 Min |
| 2 | DB-Migration: google_tokens | - | 5 Min |
| 3 | Edge Function: google-oauth | 2 | 1h |
| 4 | Test: OAuth-Flow | 1, 3 | 15 Min |
| 5 | DB-Migration: search_console_metrics | - | 5 Min |
| 6 | Edge Function: google-searchconsole-sync | 4, 5 | 1.5h |
| 7 | Test: SC-Sync | 6 | 15 Min |
| 8 | DB-Migration: analytics_metrics_daily | - | 5 Min |
| 9 | Edge Function: google-analytics-sync | 4, 8 | 1.5h |
| 10 | Test: GA4-Sync | 9 | 15 Min |
| 11 | Edge Function: google-ads-sync | 4, User MCC | 2h |
| 12 | UI: Analytics-Tab mit echten Daten | 7, 10 | 2h |
| 13 | UI: Einstellungen/Integrationen | 3 | 1h |

**Gesamt: ~10h Entwicklungszeit** (nach Google Cloud Setup)

---

## Verifikation

### Nach jeder Phase testen:

1. **OAuth-Flow:**
   - `https://...supabase.co/functions/v1/google-oauth?action=login` aufrufen
   - Google-Login durchführen
   - Callback prüfen: Token in DB gespeichert?

2. **Search Console Sync:**
   - Function manuell aufrufen
   - `search_console_metrics` Tabelle prüfen
   - Mindestens 7 Tage Daten vorhanden?

3. **Analytics Sync:**
   - Function manuell aufrufen
   - `analytics_metrics_daily` Tabelle prüfen

4. **UI:**
   - `/marketing` → Analytics-Tab öffnen
   - Echte Zahlen statt Placeholder?
   - Charts laden korrekt?

---

## Kontext: AHREFS-Recherche

Dieses Feature wurde motiviert durch die AHREFS-SEO-Analyse (2026-02-02), die zeigte:
- neurealis.de hat nur 4 organische Besucher/Monat (AHREFS-Schätzung)
- Lokale SEO-Konkurrenz ist schwach
- USP-Keywords ("aus einer Hand") haben niedrige KD
- Echte Daten aus Search Console sind nötig, um AHREFS-Schätzungen zu validieren

**Verwandte Dokumente:**
- `wissen/AHREFS-RECHERCHE-NEUREALIS.md`
- `docs/implementation/marketing_integration_koordination.md`

---

*Erstellt: 2026-02-03*
