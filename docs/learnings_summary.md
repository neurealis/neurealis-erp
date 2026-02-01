# Learnings Summary - neurealis ERP

**Generiert:** 2026-02-01
**Volltext:** docs/learnings.md

> Diese Datei ist ein kompakter Index. Bei Bedarf Volltext lesen.

---

## Kritische Feld-Mappings

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L147 | Learnings Summary für Preflight (PFLICHT!) | Summary als kompakter Index, Volltext bei Bedarf mit offset/limit |
| L143 | Audio-Generierung NUR auf Edge Functions | OpenAI Key nur in Supabase Secrets, niemals lokal |
| L144 | Präfix-Konvention in monday_bauprozess | nu_*, bl_*, ag_* für eindeutige Felder (NU/BL/AG) |
| L145 | DB-Spalten mit Präfixen für Eindeutigkeit | Spalten nach Entität benennen (nu_email, bl_name, ag_telefon) |
| L146 | Edge Functions: verify_jwt für Cron-Jobs | verify_jwt: false für Cron/Trigger, true nur für User-APIs |

---

## UX/Design

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L001 | Softr Tab-Überladung vermeiden | Progressive Disclosure statt 20+ Tabs |
| L002 | Horizontales Scrollen ist Gift | Spalten-Konfigurator, Card-Layout für Mobile |
| L003 | Redundanz eliminieren | Single Source of Truth, nur an einer Stelle editieren |

---

## Technisch

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L004 | Supabase MCP direkt nutzen | apply_migration für DDL, execute_sql für Queries |
| L005 | gpt-5.2 nicht gpt-5.2-mini | Hauptmodell immer gpt-5.2 verwenden |
| L006 | Umlaute korrekt verwenden | UTF-8 überall, ä/ö/ü/ß statt ae/oe/ue/ss |

---

## Workflow

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L007 | Edge Functions in functions/supabase/functions/ | Einheitlicher Pfad für alle Edge Functions |
| L008 | Parallele Subagenten für schnelle UI-Entwicklung | Bis zu 6 parallele Agents, 11 Seiten in ~30 Min |
| L009 | Svelte 5 Snippet-Namen ohne Bindestriche | Keine Bindestriche in Snippet-Namen erlaubt |
| L010 | Windows-Pfade in Bash problematisch | Dev-Server manuell in PowerShell starten |

---

## Hero API

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L011 | Hero invoice_style für Teil/Schlussrechnungen | full→AR-S, parted/cumulative/downpayment→AR-A |
| L012 | Hero Schlussrechnung = Restbetrag | Bei Teilrechnungen enthält Schluss nur Differenz |
| L030 | Hero hat keine Webhook-API | Nur Polling möglich, Make.com nutzt auch Polling |
| L039 | Hero GraphQL: temporary_url explizit abfragen | Ohne temporary_url kein PDF-Download möglich |
| L040 | Supabase Storage: Umlaute in Dateinamen | Filename-Sanitization vor Upload erforderlich |
| L105 | Hero GraphQL Soft-Delete für Artikel | update_supply_product_version mit is_deleted: true |
| L106 | Artikelnummer-Schema für neue Positionen | {Gewerk}-{Bauteil}-{Aspekt} ohne Umlaute |
| L107 | LV-Duplikate: Immer höheren Preis behalten | Niedrigerer Preis oft veraltet |
| L108 | Hero LV-Datenqualität: Typische Probleme | DUPLIKAT-*, ALT-*, generische Nummern erkennen |

---

## Business / Wohnungssanierung

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L013 | Leerstandskosten als Verhandlungsargument | 280 WE × 3 Wochen × 60m² × 8,50€ = 357.000€/Jahr |
| L014 | Ausreißer-Analyse für LV-Verhandlungen | >25% Abweichung = Gesprächsbedarf |
| L015 | Materialvorschläge dokumentieren | Verfügbarkeit, EK, Qualität, Markenakzeptanz prüfen |
| L016 | Prozessoptimierung bei Wohnungssanierung | BL bei Kündigung zuweisen, nicht nach Auszug |
| L017 | VBW Zahlungsziel-Argumentation | 14 Tage netto halten, max 21 Tage ohne Skonto |
| L018 | VBW LV 2026 - Kritische Positionen | Küchenstränge -72%, E-Anlage -44%, Vinyl -40% |
| L019 | VBW Material-Freigaben | Gira Standard 55, Maico ECA, Vigour One, Kermos |

---

## Deployment

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L020 | Svelte 5 @const Placement | @const nur in {#if}, {#each}, {:else} Blöcken |
| L021 | Netlify adapter-netlify: Edge Functions | edge: true in svelte.config.js für Zuverlässigkeit |

---

## Supabase Storage

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L022 | Dateinamen für Storage sanitizen | Umlaute/Leerzeichen durch ASCII ersetzen |
| L023 | Edge Functions für Batch-Prozesse | Automatischer Service Role Key Zugriff |
| L073 | Storage-Bucket muss existieren | Vor Upload Bucket-Existenz prüfen |
| L074 | Unique-Constraints bei generierten IDs | Mind. 12-16 Zeichen für Eindeutigkeit |
| L075 | Error-Handling für DB-Operationen | ALLE DB-Ops in Edge Functions error-prüfen |

---

## Claude Code / Subagenten

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L024 | Subagenten vs. Batch-Scripts | Ein Script mit parallel processing statt n Subagenten |
| L029 | Subagenten für Recherche (Kontext-Schonung) | Task-Tool mit Explore-Subagent, kompakte Antwort |
| L049 | Explore-Subagent und lokale Dateien | Subagenten können synchronisierte Dateien lesen |
| L050 | Wissens-Struktur für Blog-Pipeline | wissen/ Ordner mit thematischen Markdown-Dateien |
| L058 | NIEMALS bestehende Edge Functions überschreiben | Immer erst lesen, dann ergänzen |
| L059 | Parallele Subagenten für komplexe Implementierungen | 3+ Agents für unabhängige Tasks, run_in_background |
| L060 | Backups von Edge Functions erstellen | Vor Änderung get_edge_function, Backup speichern |
| L061 | Edge Functions Struktur verstehen | Separate Functions, nicht alles in telegram-webhook |
| L066 | Subagenten für Overnight-Tasks (KRITISCH) | Tracker-Datei + parallele Agents für lange Tasks |
| L127 | 6 parallele Subagenten für große Features | PM + T1-T5 + QA für komplette Features |
| L134 | Subagenten-Koordination über Tracker-Dateien | docs/implementation/ für Task-Status und Outputs |
| L141 | Subagenten-Entwicklungsmodell (STANDARD) | PM → T1-T3 parallel → T4 (QA) sequentiell |
| L142 | Kontext-Schonung durch Subagenten (STANDARD) | ALLES auslagern was möglich ist |
| L151 | 3-Agenten-Modell für komplexe Implementierungen | Schema + Sync + Trigger parallel |
| L156 | Feature-Analyse mit 3 Perspektiven | Code + Konzept + Business für vollständiges Bild |

---

## Daten-Sync

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L025 | Unified Documents Table für RAG | Eine dokumente Tabelle mit embedding vector(1536) |
| L026 | OpenAI Batch API für Kostenersparnis | JSONL-Format, 50% günstiger, async bis 24h |
| L027 | S3 Signed URLs verfallen | X-Amz-Expires=3600 (1h), PDFs zu Supabase kopieren |
| L041 | Upsert überschreibt existierende Werte | Nur Felder mit Wert ins Record aufnehmen |
| L148 | sync_source Spalte für bidirektionalen Sync | monday/supabase/pending/synced Status |
| L159 | Last-Write-Wins für bidirektionalen Sync | Timestamps vergleichen, UTC überall |

---

## Supabase Client / PostgREST

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L042 | Supabase Client JSONB-Filter unzuverlässig | Alle laden + JS-Filter statt .filter() |
| L043 | Edge Functions: verify_jwt für interne Calls | verify_jwt: false für Function-zu-Function |
| L044 | PostgREST LIKE-Pattern: %25 statt * | SQL % muss URL-encoded werden |
| L045 | PFLICHT: Backup vor DB-Änderungen mit KI | docs/backups/ mit Datum, Tabelle, Rollback-Query |

---

## Supabase

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L033 | Upsert benötigt Unique Constraint | Constraint vor Upsert erstellen |
| L034 | Default UUID für NOT NULL Spalten | gen_random_uuid()::text als Default |
| L035 | UNIQUE Constraint mit NULL-Werten | COALESCE in Index für NULL-Handling |
| L036 | Graph API Attachments: contentBytes einzeln | Pro Anhang /attachments/{id} abrufen |
| L037 | Supabase Storage: Pfad-Sanitization | Sonderzeichen aus Message-IDs entfernen |
| L081 | RLS-Policies für anonyme User | anon Rolle braucht SELECT für öffentliche Seiten |
| L150 | Supabase .or() mit Spaltenvergleich | JS-Filter statt col_a.gt.col_b verwenden |

---

## OpenAI API

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L028 | GPT-5.2 verwendet max_completion_tokens | max_tokens funktioniert nicht bei GPT-5.2 |
| L137 | GPT-5.2 erfordert max_completion_tokens (bestätigt) | Auch mit response_format: json_object |

---

## Marketing / Blog-Pipeline

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L046 | OpenAI Responses API mit web_search_preview | Neuer Standard für Agenten-Funktionalität |
| L047 | Agenten-Kommunikation via JSON-Output | Strukturiertes JSON zwischen Agenten |
| L048 | Embedding-basierte Querverlinkung für SEO | Min 2 interne Links pro Artikel |
| L062 | OpenAI Responses API vs. Chat Completions | Chat Completions API zuverlässiger |
| L063 | Edge Functions verify_jwt für interne Calls | verify_jwt: false für Cron/interne Calls |
| L064 | Edge Function Timeouts bei Chain-Calls | Max 2-3 sequentielle API-Calls pro Function |
| L065 | Supabase Cron mit pg_cron | cron.schedule() für tägliche/wöchentliche Jobs |
| L076 | max_completion_tokens für lange Artikel | 3000 Wörter → 10.000-12.000 Tokens |
| L077 | Cornerstone-Detection in Blog-Pipeline | priority >= 100 oder explizit cornerstone: true |
| L122 | Blog-Schreibstil für B2B-Vermieter | Fließtext, konkrete Zahlen, 1.500+ Wörter |
| L123 | 3-Block-Methode für Leerstandskalkulation | Fixkosten + Miete + Risiko = vollständige Kosten |
| L124 | Content-Tiefe statt Content-Breite | Ein Framework tiefgehend statt 7 Tipps oberflächlich |
| L125 | CTA-Integration in Fachartikeln | CTA als logische Konsequenz, nicht Werbung |
| L135 | Blog-Schreibstil für B2B-Vermieter | Keine Bullet-Listen, konkrete Rechenbeispiele |
| L136 | Komplettsanierung Kosten: 1.000-1.200 EUR/m² | 110m² = 121.000€, nicht zu günstig kalkulieren |

---

## E-Mail Integration

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L038 | E-Mail-Import Architektur | email-fetch + email-process mit Matching-Kaskade |

---

## Monday.com Integration

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L031 | Monday Bidirektional Sync | Separate monday-push Function, sync_status pending |
| L032 | NUA-Budget-Berechnung | NUA_Netto = SUM(AB_Netto) * 0.75 |
| L128 | Monday JSONB column_values ist verschachtelt | .text für Anzeigewert verwenden |
| L144 | Monday column_values Struktur variiert | Flexible Extraktion mit Fallbacks |
| L146 | Monday "Status | Projekt" ist status06__1 | Nicht status__1, immer in DB verifizieren |
| L147 | JSONB-Felder in echte Spalten flattenen | Wichtige Felder + Index für Performance |
| L149 | Monday Status-Spalten nicht bidirektional | Nur Monday→Supabase, Labels müssen exakt matchen |
| L152 | Monday Gewerk-Status-Spalten IDs | docs/MONDAY_COLUMN_MAPPING.md als Referenz |

---

## Softr API

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L067 | Softr Tables API: Felder erstellen | POST /fields mit type und options |
| L068 | 2-Phasen-Erinnerungslogik | NU-Phase bis Foto, dann BL-Phase bis Abnahme |
| L093 | Softr-Sync: mangel_nr Feldmapping | Softr-Feld-ID via API ermitteln |
| L094 | Dry-Run-Pflicht für LV-Imports | Kategorisieren, Preissenkungen warnen, Backup |
| L095 | Fallback-Matching deaktivieren bei Mehrdeutigkeit | Nur exaktes Artikelnummer-Matching |

---

## MS365 Graph API

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L069 | Client Credentials Flow | grant_type: client_credentials, kein User-Login |
| L070 | Graph API: 404 statt 403 bei Permission-Fehlern | Bei 404 immer auch Permissions prüfen |
| L071 | Admin Consent für Application Permissions | Global/Cloud Admin muss Consent erteilen |

---

## Cloud-Dienste / Performance

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L072 | PFLICHT: Batch API für langläufige KI-Tasks | Submit→Poll→Process Pattern, kein Timeout |

---

## Bauprozess / Gewerke

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L051 | Monday Ausführungsarten und Nachweis-Anforderungen | Elektrik, Bad, Boden Nachweis-Matrix |

---

## Telegram-Bot

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L053 | Telegram Webhook mit Supabase Edge Functions | verify_jwt: false, Bot-Token als Secret |
| L054 | Telegram Session-Management | telegram_sessions mit Modus und Kontext |
| L089 | Mangelnummer-Pattern für Bauleitung | {PROJEKT_NR}-M{laufend}, z.B. ATBS-456-M1 |
| L090 | KI-Prompt für Gewerke-spezifische Mängel | Gewerke, Trennungsregeln, Beispiele, Übersetzung |
| L091 | Multi-Mangel Foto-Workflow | Mangel zuerst oder Foto zuerst, Callback-Buttons |
| L092 | Bauvorhaben-Pflichtfelder bei Telegram-Bot | projektname_komplett aus Monday holen |
| L143 | Telegram media_group_id für Multi-Foto-Upload | Gruppen-Fotos mit Timeout sammeln |
| L145 | Berechtigungs-Prüfung für Telegram-Bot-Aktionen | Berechtigte E-Mails/IDs in Code oder DB |
| L153 | Sprach-Befehle ohne Projekt-Kontext | ATBS aus Text extrahieren, Projekt auto-laden |
| L155 | HTML→PDF mit Puppeteer für User Guides | @page, page-break-before für Print-Layout |
| L157 | Nummerierungsformat für Mängel/Nachträge | ATBS-456-M1, ATBS-456-N1 |

---

## SharePoint-Sync

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L055 | SharePoint Delta-Queries für inkrementellen Sync | delta statt full sync, deltaLink speichern |
| L056 | SharePoint-Sync: Videos nur verlinken | Download <50MB, Link-Only für Videos |
| L160 | SharePoint Sites via MS Graph API katalogisieren | sites?search=* für alle Sites |
| L161 | SharePoint Ordnerstruktur-Muster | 01 Angebot-SUB bis 30 Qualitätssicherung |
| L162 | SharePoint Delta-Query braucht Initial-Sync | Erst Full-Sync für delta_link |
| L163 | Microsoft Graph API Rate-Limiting (429) | Sequentiell, 500ms Delay, Retry-After Header |
| L164 | SharePoint Delta-Query bei Full-Sync | delta_link=NULL für Full-Sync, items_synced=0 normal |

---

## Sicherheit / RLS

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L057 | 4-Stufen-Sicherheitskonzept für Dokumente | Stufe 1-4 für Mitarbeiter bis nur GF |

---

## Edge Functions

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L052 | Edge Function Performance: Daten einmal laden | DB-Abfragen vor Schleife, dann in-memory filtern |
| L053 | Matching mit Typo-Toleranz | Prefix-Matching statt exakt (feininstall statt feininstallation) |
| L115 | Edge Function Timeout bei Batch-GPT-Calls | Max 50 Positionen pro Call, 150s Hard-Limit |
| L116 | Lokale Subagenten für lang laufende Analysen | Kein Timeout, direkter DB-Zugriff via MCP |
| L154 | pg_net Trigger ohne Auth bei verify_jwt=false | Kein Vault-Secret nötig |

---

## Subagenten-Koordination

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L054 | Subagenten über Markdown-Dateien koordinieren | Tracker-Datei als Single Source of Truth |

---

## PDF-Generierung

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L085 | jsPDF-autotable: didDrawCell für gemischte Styles | Custom Styles via didDrawCell Hook |

---

## Excel-Import / LV-Synchronisation

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L086 | Excel-Dateien in Node.js parsen | xlsx Package mit sheet_to_json |
| L087 | Artikelnummer-Transformation bei LV-Imports | GWS.LV23- Präfix, Transformations-Map |
| L088 | Doppeltes Matching bei LV-Imports | Primär Artikelnr, Fallback normalisierte Bezeichnung |

---

## Telegram-Bot / Nachtrag-Erfassung

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L096 | Score-basiertes LV-Position-Matching | Gewerk +10, Wort +5, Keyword +15, Threshold 10 |
| L097 | Auftraggeber-Extraktion aus Monday-Projektnamen | Ersten Teil vor | extrahieren |
| L101 | CHECK constraints bei Telegram-Bot DB-Inserts | Valide Status-Werte verwenden |
| L102 | LV-Typen konsolidieren | Privat→neurealis, keine Doppelpflege |

---

## Embedding-basierte Suche

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L098 | Embedding-Suche vs. Keyword-Matching | pgvector semantisch robuster als Keywords |
| L099 | strip_html für saubere Embeddings | HTML-Tags vor Embedding entfernen |
| L100 | Similarity-Threshold für LV-Matching | 0.6 guter Kompromiss |
| L139 | pg_trgm für Fuzzy-Suche | Trigram-Index, similarity() Funktion |
| L140 | Hierarchisches Lern-System | Erst lv_typ, dann global mit is_global_match |

---

## Vertrieb / LV-Kalkulation

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L103 | lv_positionen: preis vs. listenpreis | preis=EK, listenpreis=VK - IMMER VK verwenden! |
| L104 | Transkription → Angebot Workflow | Plaud → KI-Extraktion → LV-Matching → HTML |

---

## Angebots-Erstellung / CPQ

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L109 | CPQ-Wizard Reihenfolge | Projekt→Positionen→Mengen→Kalkulation→Freigabe→Versand |
| L110 | LV-Abhängigkeiten aus Langtexten | GPT analysiert Verweise, Zulagen, Ähnlichkeit |
| L111 | Aufmaß-Mengen-Zuweisung UI-Pattern | Links Position, rechts Räume×Maßtypen Tabelle |
| L112 | Dokument-Nummernlogik mit Revisionen | ATBS-472-ANG01→ANG02, nie gleiche Nr wiederverwenden |
| L113 | Pricing-Profile für Kundengruppen | base_lv_typ + markup_percent + per_trade_overrides |
| L114 | Raumgeometrien für Aufmaß | Rechteck, L-Form, U-Form mit gemeinsamen Wänden |
| L117 | LV-spezifische Gewerke-Namen inkompatibel | Gewerke aus DB laden, nicht hardcoden |
| L118 | Hybrid-Prompt-Ansatz für transcription-parse | Ein Template + LV-spezifische Parameter |
| L119 | LV-Abhängigkeiten: Quellen und Typen | referenced_in_text, required, suggested, often_together |
| L120 | Bedarfspositionen: Preise immer aus LV | Live aus lv_positionen, nicht statisch |
| L121 | NUA-Vertragswerk: 12 Paragraphen | 3× Partner-Portal Pflicht betonen |

---

## CPQ-System Implementierung

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L126 | Svelte 5 Type-Exports in separater Datei | types.ts statt .svelte für Shared Types |
| L129 | OpenAI response_format erfordert konsistenten Prompt | json_object braucht Objekt im Prompt, kein Array |
| L138 | Supabase FunctionsHttpError kein echtes Error | Robuste getErrorMessage() Funktion nutzen |

---

## WordPress / IONOS

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L078 | WordPress Application Passwords | Basic Auth mit Application Password |
| L079 | WordPress REST API: POST für Create und Update | POST /posts für neu, POST /posts/{id} für Update |
| L080 | WordPress Slug-basierte Duplikat-Prüfung | status=any für Entwürfe und private Posts |
| L082 | WordPress Application Password User-Rollen | User braucht mind. Redakteur-Rolle |
| L083 | IONOS stripped Authorization Header | CGI-Modus blockiert Auth-Header |
| L084 | .htaccess Auth-Fixes können 500 Error verursachen | Vor Änderung IMMER Backup |
| L130 | IONOS X-WP-Auth Workaround | Custom Header X-WP-Auth statt Authorization |
| L131 | WordPress API Discovery: 485 Routen | /wp-json/ für vollständiges Schema |
| L132 | Elementor speichert in _elementor_data | JSON-Array mit Sections/Columns/Widgets |
| L133 | Yoast SEO Meta via _yoast_wpseo_* | title, metadesc, focuskw als Post-Meta |

---

## Meta / Prozess

| # | Titel | Kurzfassung |
|---|-------|-------------|
| L158 | Schritt-für-Schritt Dialog für User-Präferenzen | Eine Frage pro Bereich, ADHS-freundlich |

---

**Anzahl Learnings:** 162 (L001-L162, ohne Duplikate bei L053/L143/L144)

*Hinweis: L053 existiert zweimal (Telegram Webhook + Matching mit Typo-Toleranz), L143 existiert zweimal (Audio-Generierung + Telegram media_group_id), L144 existiert zweimal (Präfix-Konvention + Monday column_values). Die zweiten Vorkommen sollten umnummeriert werden.*
