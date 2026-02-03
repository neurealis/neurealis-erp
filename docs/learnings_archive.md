# Learnings Archive - neurealis ERP

Letzte Aktualisierung: 2026-02-03

Diese Learnings sind entweder erledigt, veraltet oder wurden durch neuere ersetzt.

---

## Claude Code / Subagenten (Allgemein - in globale CLAUDE.md verschoben)

### L024: Subagenten vs. Batch-Scripts
**Status:** Archiviert - Allgemeine Best Practice
**Datum:** 2026-01-28
**Learning:** Bei Batch-Operationen (z.B. 600+ PDFs) ein Script schreiben statt Subagenten

---

### L029: Subagenten für Recherche
**Status:** Archiviert - In globale CLAUDE.md v2.2 dokumentiert
**Datum:** 2026-01-28
**Learning:** Task-Tool mit Explore-Subagent für Recherche nutzen

---

### L049: Explore-Subagent und lokale Dateien (KORRIGIERT)
**Status:** Archiviert - Korrigierte Erkenntnis
**Datum:** 2026-01-28
**Korrektur:** Subagenten KÖNNEN lokal synchronisierte Dateien lesen

---

### L050: Wissens-Struktur für Blog-Pipeline
**Status:** Archiviert - Allgemeine Struktur
**Datum:** 2026-01-28
**Learning:** `wissen/` Ordner mit thematischen Markdown-Dateien

---

### L059: Parallele Subagenten für Implementierungen
**Status:** Archiviert - In L141/L142 konsolidiert
**Datum:** 2026-01-29

---

### L127: 6 parallele Subagenten
**Status:** Archiviert - In L141/L142 konsolidiert
**Datum:** 2026-01-31

---

### L134: Subagenten-Koordination über Tracker
**Status:** Archiviert - In L141/L142 konsolidiert
**Datum:** 2026-01-31

---

### L141: Subagenten-Entwicklungsmodell (STANDARD)
**Status:** Aktiv - Aber in globaler CLAUDE.md dokumentiert
**Datum:** 2026-01-31
**Learning:** PM → T1-T3 parallel → T4 QA

---

### L142: Kontext-Schonung durch Subagenten (STANDARD)
**Status:** Aktiv - Aber in globaler CLAUDE.md dokumentiert
**Datum:** 2026-01-31
**Learning:** ALLES in Subagenten auslagern was möglich ist

---

## OpenAI API (Allgemein)

### L028: max_completion_tokens
**Status:** Bestätigt durch L137 - Allgemein bekannt
**Datum:** 2026-01-28
**Learning:** GPT-5.2 verwendet `max_completion_tokens` statt `max_tokens`

---

### L046: OpenAI Responses API web_search_preview
**Status:** Ersetzt durch L062
**Datum:** 2026-01-28
**Learning:** Responses API funktioniert nicht zuverlässig

---

### L047: Agenten-Kommunikation via JSON
**Status:** Archiviert - Allgemeine Best Practice
**Datum:** 2026-01-28

---

### L062: Chat Completions API statt Responses API
**Status:** Aktiv - Allgemein gültig
**Datum:** 2026-01-29
**Learning:** Standard Chat Completions API verwenden

---

## Marketing-Ads APIs

### L170: Meta App-Struktur Use Cases
**Status:** Archiviert - Einmalige Einrichtung
**Datum:** 2026-02-02
**Learning:** App → Use Cases → Anpassen → Berechtigungen

---

### L171: Meta Business Verification nicht immer nötig
**Status:** Archiviert - Einmalige Prüfung
**Datum:** 2026-02-02

---

### L172: Meta System User Token Permissions
**Status:** Archiviert - Einmalige Einrichtung
**Datum:** 2026-02-02
**Learning:** Marketing API Product in App aktivieren

---

## WordPress / IONOS (Spezifisch)

### L083: IONOS strippt Authorization Header
**Status:** Gelöst durch L130
**Datum:** 2026-01-29

---

### L084: .htaccess Auth-Fixes können 500 Error verursachen
**Status:** Archiviert - Warnung
**Datum:** 2026-01-29

---

### L078: WordPress Application Passwords
**Status:** Aktiv aber allgemein WordPress
**Datum:** 2026-01-29

---

### L079: WordPress REST API POST für Create/Update
**Status:** Archiviert - Allgemein WordPress
**Datum:** 2026-01-29

---

### L080: WordPress Slug-basierte Duplikat-Prüfung
**Status:** Archiviert - Allgemein WordPress
**Datum:** 2026-01-29

---

### L082: WordPress User-Rollen für API
**Status:** Archiviert - Allgemein WordPress
**Datum:** 2026-01-29

---

### L130: IONOS X-WP-Auth Workaround
**Status:** Aktiv - IONOS-spezifisch
**Datum:** 2026-01-31

---

### L131: WordPress API Discovery
**Status:** Archiviert - Einmalige Analyse
**Datum:** 2026-01-31

---

### L132: Elementor _elementor_data Struktur
**Status:** Aktiv - In ui.md oder business.md besser
**Datum:** 2026-01-31

---

### L133: Yoast SEO Meta Felder
**Status:** Archiviert - WordPress-spezifisch
**Datum:** 2026-01-31

---

### L174: Markdown→Elementor Konvertierung
**Status:** Aktiv - Aber sehr spezifisch
**Datum:** 2026-02-02

---

### L175 (WordPress): JWT Auth vs. Application Passwords
**Status:** Aktiv - WordPress-spezifisch
**Datum:** 2026-02-02

---

## E-Mail / MS365 (Allgemein)

### L036: Graph API Attachments einzeln abrufen
**Status:** Archiviert - Technisches Detail
**Datum:** 2026-01-28

---

### L038: E-Mail-Import Architektur
**Status:** Archiviert - Einmalige Architektur
**Datum:** 2026-01-28

---

### L069: Client Credentials Flow
**Status:** Archiviert - Allgemein MS365
**Datum:** 2026-01-29

---

### L070: Graph API 404 statt 403
**Status:** Archiviert - Allgemein MS365
**Datum:** 2026-01-29

---

### L071: Admin Consent
**Status:** Archiviert - Einmalige Einrichtung
**Datum:** 2026-01-29

---

## SharePoint-Sync (Allgemein)

### L055: Delta-Queries
**Status:** Archiviert - Technisches Detail
**Datum:** 2026-01-29

---

### L056: Videos nur verlinken
**Status:** Archiviert - Spezifische Regel
**Datum:** 2026-01-29

---

### L160-L164: SharePoint Sites/Ordner/Delta
**Status:** Archiviert - Einmalige Analyse
**Datum:** 2026-02-01

---

## Sonstige erledigte Learnings

### L025: Unified Documents Table für RAG
**Status:** Archiviert - Implementiert
**Datum:** 2026-01-28

---

### L026: OpenAI Batch API
**Status:** In L072 konsolidiert
**Datum:** 2026-01-28

---

### L027: S3 Signed URLs verfallen
**Status:** Archiviert - Hero-spezifisch
**Datum:** 2026-01-28

---

### L048: Embedding-basierte Querverlinkung SEO
**Status:** Archiviert - Blog-Pipeline
**Datum:** 2026-01-28

---

### L063-L065: Blog-Pipeline Edge Functions
**Status:** Archiviert - Blog-Pipeline spezifisch
**Datum:** 2026-01-29

---

### L076-L077: Blog Cornerstone Token-Limits
**Status:** Archiviert - Blog-Pipeline spezifisch
**Datum:** 2026-01-29

---

### L135: Blog-Schreibstil (Duplikat von L122)
**Status:** Archiviert - Duplikat
**Datum:** 2026-01-31

---

## Finanzen/Rechnungen Analyse

### L170-L173 (Finanzen): ER-NU Vollständigkeitsprüfung
**Status:** Archiviert - Einmalige Analyse
**Datum:** 2026-02-02
**Learning:** Methoden zur Rechnungssuche in SharePoint/E-Mail

---

*Learnings werden archiviert wenn:*
- *In globale CLAUDE.md verschoben*
- *Durch neuere Learnings ersetzt*
- *Einmalige Erkenntnisse (Einrichtung, Analyse)*
- *Zu allgemein für projektspezifisches Lernen*
