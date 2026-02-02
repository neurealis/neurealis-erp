# Marketing-Integration - Koordination

**Status:** 🔄 IN ARBEIT
**Erstellt:** 2026-02-02
**Ziel:** Google Ads + Meta Ads Integration mit Lead-Funnel-Tracking

---

## 1. Projekt-Übersicht

### Ziele
1. **Kampagnen-Tracking:** Google Ads + Meta Ads Performance in Supabase
2. **Lead-Funnel:** Touchpoints tracken, Absprungpunkte identifizieren
3. **ROI-Berechnung:** Marketing-Kosten → Lead → Angebot → Auftrag → Umsatz
4. **ICP-Scoring:** Leads automatisch bewerten (passt zu uns oder nicht)
5. **Landingpages:** Pro Kampagne/Zielgruppe mit A/B-Testing
6. **Kampagnen-Management:** Erstellen, pausieren, optimieren aus ERP

### Zielgruppen (Priorität)

| # | Segment | Name | Kampagnen-Fokus |
|---|---------|------|-----------------|
| 1 | `b2c_vermieter` | Private Vermieter | Mietwohnungen 1-10 WE |
| 2 | `b2c_eigentuemer` | Eigentumswohnungen | ETW in MFH, WEG |
| 3 | `b2c_eigenheim` | Eigenheimbesitzer | DHH, RH, EFH |
| 4 | `b2b_hausverwaltung` | Hausverwaltungen | 50+ WE (später) |
| 5 | `b2b_architekt` | Architekten | Multiplikatoren (später) |
| 6 | `b2b_energieberater` | Energieberater | GEG-Partner (später) |

---

## 2. Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                         neurealis ERP (SvelteKit)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Kampagnen   │  │ Lead-Funnel │  │ ROI-Report  │  │ Landingpage │ │
│  │ Dashboard   │  │ Analyse     │  │ Attribution │  │ Builder     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase Edge Functions                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │google-ads-  │  │ meta-ads-   │  │ lead-score  │  │ attribution │ │
│  │sync (Cron)  │  │ sync (Cron) │  │ (Trigger)   │  │ (Cron)      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Supabase Postgres                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ campaigns   │  │ metrics     │  │ leads       │  │ touchpoints │ │
│  │ platforms   │  │ (daily)     │  │ funnel      │  │ attribution │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│      Google Ads API      │    │     Meta Marketing API   │
│  - Kampagnen CRUD        │    │  - Kampagnen CRUD        │
│  - GAQL Queries          │    │  - Insights API          │
│  - Conversion Import     │    │  - CAPI (Server-Side)    │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 3. Voraussetzungen & Credentials

### 3.1 Google Ads

| Credential | Status | Wie beschaffen |
|------------|--------|----------------|
| MCC Account | ❌ Fehlt | ads.google.com/home/tools/manager-accounts/ |
| Developer Token | ❌ Fehlt | MCC → Tools → API Center |
| OAuth Client ID | ❌ Fehlt | Google Cloud Console |
| OAuth Client Secret | ❌ Fehlt | Google Cloud Console |
| Refresh Token | ❌ Fehlt | OAuth Flow einmalig durchführen |
| Customer ID | ✅ Vorhanden | Aus bestehendem Ads-Konto |

**Anleitung:** Siehe `docs/GOOGLE_ADS_SETUP.md`

### 3.2 Meta Ads

| Credential | Status | Wie beschaffen |
|------------|--------|----------------|
| Business Manager | ✅ Vorhanden | business.facebook.com |
| Business Verification | ❌ **BLOCKER** | Security Center → Verify |
| System User | ❌ Fehlt | Nach Verification erstellen |
| System User Token | ❌ Fehlt | Permanent Token generieren |
| Ad Account ID | ✅ Vorhanden | act_XXXXXXXXX |
| Pixel ID | ❌ Fehlt | Events Manager erstellen |

**Anleitung:** Siehe `docs/META_ADS_SETUP.md`

### 3.3 neurealis.de Tracking

| Tool | Status | ID |
|------|--------|-----|
| Google Tag Manager | ✅ | GTM-MPNTT5L6 |
| Google Analytics 4 | ✅ | G-VMYJ4MYVDG |
| Google Ads Conversion | ✅ | AW-16693451427 |
| Meta Pixel | ❌ **Fehlt** | - |
| Cookie-Banner | ✅ | Real Cookie Banner Pro |

---

## 4. DB-Schema

### 4.1 Tabellen-Übersicht

| Tabelle | Zweck | Zeilen (Est.) |
|---------|-------|---------------|
| `ad_platforms` | Google + Meta Config | 2 |
| `marketing_campaigns` | Alle Kampagnen | 50-200 |
| `campaign_metrics_daily` | Performance pro Tag | 10.000+ |
| `target_audiences` | Zielgruppen-Segmente | 6 |
| `landingpages` | Landing Pages + A/B | 20-50 |
| `form_submissions` | Formular-Einreichungen | 500+ |
| `marketing_leads` | Leads mit Status | 500+ |
| `touchpoints` | Multi-Touch-Tracking | 2.000+ |
| `attribution_models` | Attribution-Typen | 5 |
| `campaign_attribution` | Attribution pro Lead | 2.000+ |

### 4.2 ERD (Vereinfacht)

```
ad_platforms (1) ──┬──< marketing_campaigns (n)
                   │
                   └──< campaign_metrics_daily (n)

target_audiences (1) ──< marketing_campaigns (n)
                    └──< landingpages (n)

landingpages (1) ──< form_submissions (n)
              └──< marketing_leads (n)

marketing_leads (1) ──< touchpoints (n)
                  └──< campaign_attribution (n)

attribution_models (1) ──< campaign_attribution (n)
```

---

## 5. Edge Functions

### 5.1 google-ads-sync

**Trigger:** Cron täglich 06:00 UTC
**Funktion:**
1. OAuth Token refreshen
2. GAQL Query für alle aktiven Kampagnen
3. Metriken in `campaign_metrics_daily` upserten
4. Neue Kampagnen in `marketing_campaigns` anlegen

### 5.2 meta-ads-sync

**Trigger:** Cron täglich 06:00 UTC
**Funktion:**
1. System User Token verwenden
2. Insights API für alle aktiven Kampagnen
3. Metriken in `campaign_metrics_daily` upserten
4. Lead Ads Forms abrufen → `form_submissions`

### 5.3 lead-score

**Trigger:** DB-Trigger bei INSERT auf `marketing_leads`
**Funktion:**
1. Lead-Daten mit ICP-Kriterien vergleichen
2. Score 0-100 berechnen
3. `icp_match_score` + `icp_match_reasons` setzen
4. `lead_quality` (hot/warm/cold) ableiten

### 5.4 attribution-calculate

**Trigger:** Cron wöchentlich Sonntag 03:00 UTC
**Funktion:**
1. Alle Leads mit `status = 'auftrag'` laden
2. Touchpoints pro Lead aggregieren
3. Attribution nach Modell berechnen (First/Last/Linear/Time-Decay)
4. `campaign_attribution` befüllen

---

## 6. Landingpage-Strategie

### Option A: WordPress + Elementor (Empfohlen)

**Pro:**
- Bereits vorhanden (Elementor Pro)
- SEO-optimiert
- Cookie-Banner integriert

**Contra:**
- Keine native API für Seitenerstellung
- Manuelle Duplikation nötig

**Automatisierung:**
- Template pro Zielgruppe in Elementor
- WordPress REST API für Seiten-Metadaten
- Formular-Submissions via Webhook → Supabase

### Option B: SvelteKit Landingpages

**Pro:**
- Volle Kontrolle
- Direkte Supabase-Integration
- A/B-Testing eingebaut

**Contra:**
- Separates Hosting nötig
- SEO-Setup erforderlich
- Mehr Entwicklungsaufwand

### Option C: Externes Tool (Unbounce/Leadpages)

**Pro:**
- Drag&Drop Builder
- Integriertes A/B-Testing
- Schnell einsatzbereit

**Contra:**
- Zusätzliche Kosten (99-299€/Monat)
- Externe Dependency
- Daten-Export nötig

**Entscheidung:** Option A (WordPress + Elementor) mit Webhook-Integration

---

## 7. Implementierungsreihenfolge

### Phase 1: Vorbereitung (SOFORT - Parallel)

| Task | Wer | Dauer | Blocker |
|------|-----|-------|---------|
| Meta Business Verification starten | Holger | 5+ Tage | - |
| Google MCC Account erstellen | Holger | 1-2 Tage | - |
| Meta Pixel im GTM einrichten | Claude | 30 Min | - |

### Phase 2: Backend (Diese Woche)

| Task | Wer | Dauer | Blocker |
|------|-----|-------|---------|
| DB-Schema migrieren | Claude | 1-2h | - |
| google-ads-sync Function | Claude | 2-3h | MCC + Token |
| meta-ads-sync Function | Claude | 2-3h | Verification |
| lead-score Function | Claude | 1h | Schema |

### Phase 3: Frontend (Nächste Woche)

| Task | Wer | Dauer | Blocker |
|------|-----|-------|---------|
| Marketing-Dashboard erweitern | Claude | 3-4h | Backend |
| Kampagnen-Übersicht | Claude | 2h | Backend |
| Lead-Funnel Visualisierung | Claude | 2h | Backend |
| ROI-Report | Claude | 2h | Backend |

### Phase 4: Landingpages (Woche 3)

| Task | Wer | Dauer | Blocker |
|------|-----|-------|---------|
| Elementor Templates erstellen | Holger | 4-8h | - |
| Webhook-Integration | Claude | 1h | Templates |
| A/B-Test-Tracking | Claude | 2h | Webhooks |

---

## 8. Metriken & KPIs

### Dashboard-KPIs

| KPI | Formel | Ziel |
|-----|--------|------|
| CPL (Cost per Lead) | Kosten / Leads | < 50€ |
| CTR | Klicks / Impressionen | > 2% |
| Conversion Rate | Leads / Klicks | > 5% |
| ICP-Match-Rate | Qualified / Total Leads | > 60% |
| Lead-to-Offer | Angebote / Leads | > 30% |
| Offer-to-Close | Aufträge / Angebote | > 40% |
| CAC (Customer Acquisition Cost) | Kosten / Aufträge | < 500€ |
| ROAS | Umsatz / Kosten | > 5x |

### Funnel-Stufen

```
Impression → Klick → Landingpage → Formular → Lead → Qualifiziert → Angebot → Auftrag
   100%       2%        1.5%         0.5%      0.3%     0.2%         0.1%      0.04%
```

---

## 9. Nächste Schritte (HEUTE)

1. **Holger:** Meta Business Verification starten (KRITISCH!)
2. **Holger:** Google MCC Account erstellen
3. **Claude:** DB-Schema migrieren
4. **Claude:** Meta Pixel Anleitung für GTM

---

*Erstellt: 2026-02-02*
