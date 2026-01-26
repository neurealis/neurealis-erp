# Supabase neurealis - Schema-Dokumentation

**Letzte Aktualisierung:** 2026-01-24

---

## Projekt-Übersicht

| Projekt | Ref | Status | Beschreibung |
|---------|-----|--------|--------------|
| **ERP** | `mfpuijttdgkllnvhvjlu` | Aktiv | Wohnungssanierung ERP (Default) |
| Immobilien | `xqtqyqdqcxyjdkiazezs` | Inaktiv/DNS | Immobilienverwaltung |
| Privat | `zapfwqzmwshwebgnftty` | Inaktiv/DNS | Private Projekte |
| Management | `jvudihyndyhoxljewtde` | Inaktiv/DNS | Administration |

---

## Verbindungsdaten

### ERP-Projekt (aktiv)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://mfpuijttdgkllnvhvjlu.supabase.co` |
| **REST API** | `https://mfpuijttdgkllnvhvjlu.supabase.co/rest/v1` |
| **Dashboard** | `https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu` |

**API Keys:** Siehe `.supabase-config.json`

---

## ERP-Projekt Schema

**Anzahl Tabellen:** 17

### Tabellen-Übersicht

| Tabelle | Beschreibung | Spalten |
|---------|--------------|---------|
| `projekte` | Sanierungsprojekte (Stammdaten) | 13 |
| `bedarfsanalysen` | OCR-verarbeitete Bedarfsbögen | 13 |
| `angebots_drafts` | Angebotsentwürfe | 13 |
| `angebots_positionen` | Einzelne Angebotspositionen | 14 |
| `lv_positionen` | Leistungsverzeichnis-Positionen | 11 |
| `checkbox_lv_mapping` | Mapping Checkbox -> LV-Position | 9 |
| `raeume` | Räume mit Maßen | 12 |
| `aufmass_data` | Aufmaß-Daten (JSON) | 12 |
| `matterport_spaces` | Matterport 3D-Scans | 12 |
| `review_queue` | Positionen zur manuellen Prüfung | 19 |
| `tasks` | Aufgaben (MS Planner Sync) | 21 |
| `email_accounts` | E-Mail-Konten | 15 |
| `emails` | E-Mails | 17 |
| `telegram_conversation_state` | Telegram Bot State | 20 |
| `v_pending_reviews` | View: Offene Reviews | 14 |
| **`nachtraege`** | **Nachtragsmanagement** | **22** |
| **`nachtrag_notifications`** | **E-Mail-Benachrichtigungen** | **11** |

---

## Detailliertes Schema

### projekte

Stammdaten für Sanierungsprojekte.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| atbs_nummer | text | Ja | ATBS-Nummer (eindeutig) |
| bezeichnung | text | Nein | Projektname |
| adresse | text | Nein | Straße + Hausnummer |
| plz | text | Nein | Postleitzahl |
| ort | text | Nein | Stadt |
| kunde_name | text | Nein | Kundenname |
| kunde_email | text | Nein | Kunden-E-Mail |
| kunde_telefon | text | Nein | Kundentelefon |
| lv_typ | text | Nein | Typ des LV (LEG, VBW, etc.) |
| wohnflaeche_qm | numeric | Nein | Wohnfläche in m² |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### bedarfsanalysen

OCR-verarbeitete Bedarfsanalysebögen.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| projekt_id | uuid | Nein | FK -> projekte |
| telegram_message_id | text | Nein | Telegram Nachricht-ID |
| foto_urls | text[] | Nein | URLs der hochgeladenen Fotos |
| ocr_raw | jsonb | Nein | Rohe OCR-Ausgabe |
| ocr_structured | jsonb | Nein | Strukturierte OCR-Daten |
| auftraggeber | text | Nein | Angekreuzter Auftraggeber (bestimmt lv_typ) |
| pauschal_groesse | text | Nein | Wohnungsgröße für Pauschalpreise |
| sanierungsqualitaet | text | Nein | Sanierungsqualität |
| status | text | Nein | pending, processing, completed, error |
| error_message | text | Nein | Fehlermeldung |
| processed_at | timestamptz | Nein | Verarbeitet am |
| created_at | timestamptz | Nein | Erstellt am |

---

### angebots_drafts

Angebotsentwürfe mit Odoo-Export.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| projekt_id | uuid | Nein | FK -> projekte |
| bedarfsanalyse_id | uuid | Nein | FK -> bedarfsanalysen |
| lv_typ | text | Ja | LEG, VBW, etc. |
| status | text | Nein | draft, exported, accepted |
| summe_netto | numeric | Nein | Nettosumme |
| summe_brutto | numeric | Nein | Bruttosumme |
| odoo_angebot_id | text | Nein | Angebots-ID in Odoo |
| odoo_order_id | integer | Nein | sale.order ID in Odoo |
| odoo_url | text | Nein | Direktlink zum Odoo-Angebot |
| exported_at | timestamptz | Nein | Export-Zeitpunkt |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### angebots_positionen

Einzelne Positionen in einem Angebot.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| draft_id | uuid | Nein | FK -> angebots_drafts |
| lv_position_id | uuid | Nein | FK -> lv_positionen |
| position_nr | integer | Nein | Position im Angebot |
| checkbox_key | text | Nein | Checkbox-Schlüssel |
| menge | numeric | Nein | Menge |
| einheit | text | Nein | Einheit (m², Stk, etc.) |
| einzelpreis | numeric | Nein | Einzelpreis |
| gesamtpreis | numeric | Nein | Gesamtpreis |
| confidence | numeric | Nein | KI-Confidence (0-1) |
| needs_review | boolean | Nein | Manuelle Prüfung nötig? |
| review_status | text | Nein | pending, approved, rejected |
| notiz | text | Nein | Zusätzliche Notizen |
| created_at | timestamptz | Nein | Erstellt am |

---

### lv_positionen

Leistungsverzeichnis-Positionen (Stammdaten).

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| lv_typ | text | Ja | LEG, VBW, etc. |
| artikelnummer | text | Ja | Artikelnummer |
| bezeichnung | text | Ja | Positionsbezeichnung |
| beschreibung | text | Nein | Detaillierte Beschreibung |
| einheit | text | Nein | Einheit (m², Stk, lfm) |
| preis | numeric | Nein | Einheitspreis |
| embedding | vector(1536) | Nein | OpenAI Embedding für Suche |
| softr_record_id | text | Nein | Softr.io Record-ID |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### checkbox_lv_mapping

Mapping zwischen Checkboxen und LV-Positionen.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| checkbox_key | text | Ja | Eindeutiger Checkbox-Schlüssel |
| checkbox_label | text | Ja | Anzeigetext der Checkbox |
| gewerk | text | Ja | Gewerk (Elektro, Sanitär, etc.) |
| lv_typ | text | Nein | LEG, VBW (wenn spezifisch) |
| lv_position_id | uuid | Nein | FK -> lv_positionen |
| einheit_quelle | text | Nein | Woher kommt die Menge? |
| prioritaet | integer | Nein | Sortierung |
| created_at | timestamptz | Nein | Erstellt am |

---

### raeume

Räume mit Maßen (aus Matterport oder manuell).

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| projekt_id | uuid | Nein | FK -> projekte |
| bezeichnung | text | Ja | Raumname (Küche, Bad, etc.) |
| laenge_m | numeric | Nein | Länge in m |
| breite_m | numeric | Nein | Breite in m |
| hoehe_m | numeric | Nein | Höhe in m |
| flaeche_qm | numeric | Nein | Fläche in m² |
| umfang_lfm | numeric | Nein | Umfang in lfm |
| ist_l_foermig | boolean | Nein | L-förmiger Raum? |
| matterport_room_id | text | Nein | Matterport Raum-ID |
| created_at | timestamptz | Nein | Erstellt am |

---

### aufmass_data

Aufmaß-Daten als JSON (Import aus Excel/CSV).

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| project_name | text | Ja | Projektname |
| atbs_nummer | text | Nein | ATBS-Nummer |
| rooms | jsonb | Ja | Raum-Array mit Maßen |
| total_rooms | integer | Ja | Anzahl Räume |
| total_netto_m2 | numeric | Nein | Gesamt-Nettofläche |
| total_brutto_m2 | numeric | Nein | Gesamt-Bruttofläche |
| source | text | Nein | Datenquelle |
| excel_filename | text | Nein | Ursprüngliche Datei |
| excel_generated_at | timestamptz | Nein | Excel-Export-Zeit |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### matterport_spaces

Matterport 3D-Scans.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| matterport_model_id | text | Ja | Matterport Model-ID |
| project_name | text | Ja | Projektname |
| atbs_nummer | text | Nein | ATBS-Nummer |
| address | text | Nein | Adresse |
| city | text | Nein | Stadt |
| unit | text | Nein | Wohneinheit |
| client_type | text | Nein | Kundentyp |
| direct_link | text | Nein | Link zum Immobilienbericht |
| is_active | boolean | Nein | Aktiv? |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### review_queue

Positionen zur manuellen Prüfung.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| projekt_id | uuid | Nein | FK -> projekte |
| bedarfsanalyse_id | uuid | Nein | FK -> bedarfsanalysen |
| checkbox_label | text | Ja | Checkbox-Text |
| checkbox_value | boolean | Nein | Angekreuzt? |
| source_page | integer | Nein | Seite im Dokument |
| image_url | text | Nein | Screenshot-URL |
| bounding_box | jsonb | Nein | Position im Bild |
| confidence | numeric | Nein | OCR-Confidence |
| suggested_lv_position_id | uuid | Nein | FK -> lv_positionen (Vorschlag) |
| suggested_position_text | text | Nein | Vorgeschlagener Text |
| final_lv_position_id | uuid | Nein | FK -> lv_positionen (Final) |
| final_checkbox_value | boolean | Nein | Finaler Wert |
| status | text | Nein | pending, approved, rejected |
| reviewed_by | text | Nein | Reviewer |
| reviewed_at | timestamptz | Nein | Review-Zeitpunkt |
| review_notes | text | Nein | Notizen |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### tasks

Aufgaben mit MS Planner Synchronisation.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| projekt_id | uuid | Nein | FK -> projekte |
| title | text | Ja | Aufgabentitel |
| description | text | Nein | Beschreibung |
| status | text | Nein | open, in_progress, completed |
| priority | text | Nein | low, normal, high, urgent |
| category | text | Nein | Kategorie |
| due_date | timestamptz | Nein | Fälligkeitsdatum |
| assigned_to | text | Nein | Zugewiesen an |
| completed_at | timestamptz | Nein | Abgeschlossen am |
| percent_complete | integer | Nein | Fortschritt (0-100) |
| source | text | Nein | Quelle (planner, manual) |
| planner_task_id | text | Nein | MS Planner Task-ID |
| planner_plan_id | text | Nein | MS Planner Plan-ID |
| planner_plan_name | text | Nein | Plan-Name |
| planner_bucket_id | text | Nein | Bucket-ID |
| planner_bucket_name | text | Nein | Bucket-Name |
| sync_status | text | Nein | synced, pending, error |
| last_synced_at | timestamptz | Nein | Letzte Sync |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### email_accounts

E-Mail-Konten für IMAP-Sync.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| user_id | text | Nein | User-ID |
| vertical | text | Ja | Vertical (sanierung, etc.) |
| email_address | text | Ja | E-Mail-Adresse |
| display_name | text | Nein | Anzeigename |
| provider | text | Ja | Provider (posteo, gmail) |
| imap_host | text | Nein | IMAP Server |
| imap_port | integer | Nein | IMAP Port |
| smtp_host | text | Nein | SMTP Server |
| smtp_port | integer | Nein | SMTP Port |
| username | text | Nein | Username |
| password_encrypted | text | Nein | Verschlüsseltes Passwort |
| is_active | boolean | Nein | Aktiv? |
| last_sync_at | timestamptz | Nein | Letzte Sync |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### emails

Synchronisierte E-Mails.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| account_id | uuid | Nein | FK -> email_accounts |
| message_id | text | Nein | Message-ID Header |
| folder | text | Nein | IMAP Folder |
| subject | text | Nein | Betreff |
| from_name | text | Nein | Absender-Name |
| from_address | text | Nein | Absender-Adresse |
| to_addresses | jsonb | Nein | Empfänger |
| cc_addresses | jsonb | Nein | CC |
| body_text | text | Nein | Plain-Text Body |
| body_html | text | Nein | HTML Body |
| body_preview | text | Nein | Vorschau (gekürzt) |
| has_attachments | boolean | Nein | Hat Anhänge? |
| is_read | boolean | Nein | Gelesen? |
| received_at | timestamptz | Nein | Empfangen am |
| raw_headers | jsonb | Nein | Alle Header |
| created_at | timestamptz | Nein | Erstellt am |

---

### telegram_conversation_state

State-Management für Telegram Bot.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| chat_id | bigint | Ja | Primary Key (Telegram Chat-ID) |
| mode | text | Nein | aufmass, bedarfsanalyse, review, edit, remap |
| waiting_for | text | Nein | Worauf wird gewartet? |
| project_name | text | Nein | Aktuelles Projekt |
| atbs_nummer | text | Nein | ATBS-Nummer |
| atbs_asked | boolean | Nein | Wurde nach ATBS gefragt? |
| lv_typ | text | Nein | LV-Typ |
| photos | jsonb | Nein | Hochgeladene Fotos |
| pending_csv | text | Nein | CSV zum Import |
| gap_rooms | jsonb | Nein | Räume mit Lücken |
| review_draft_id | uuid | Nein | FK -> angebots_drafts |
| review_positions | jsonb | Nein | Positionen im Review |
| review_index | integer | Nein | Aktuelle Position |
| edit_position_id | uuid | Nein | Position die bearbeitet wird |
| edit_field | text | Nein | Feld das bearbeitet wird |
| remap_results | jsonb | Nein | AI-Remapping Vorschläge |
| last_message_id | bigint | Nein | Letzte Bot-Nachricht |
| last_photo_at | bigint | Nein | Letztes Foto Timestamp |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

---

### v_pending_reviews (View)

View für offene Reviews mit Projekt-Details.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | Primary Key |
| projekt_id | uuid | FK -> projekte |
| atbs_nummer | text | ATBS-Nummer |
| projekt_bezeichnung | text | Projektname |
| bedarfsanalyse_id | uuid | FK -> bedarfsanalysen |
| checkbox_label | text | Checkbox-Text |
| checkbox_value | boolean | Angekreuzt? |
| source_page | integer | Seite |
| image_url | text | Screenshot-URL |
| confidence | numeric | OCR-Confidence |
| suggested_artikelnummer | text | Vorgeschlagene Artikelnummer |
| suggested_position_bezeichnung | text | Vorgeschlagene Bezeichnung |
| suggested_position_text | text | Vorgeschlagener Text |
| created_at | timestamptz | Erstellt am |

---

## Beziehungen (ER-Diagramm)

```
projekte (1) ─────┬──── (n) bedarfsanalysen
                  │
                  ├──── (n) angebots_drafts ──── (n) angebots_positionen
                  │                                      │
                  ├──── (n) raeume                       │
                  │                                      │
                  ├──── (n) review_queue                 │
                  │                                      │
                  └──── (n) tasks                        │
                                                         │
lv_positionen (1) ──────────────────────────────────────┘
      │
      └──── (n) checkbox_lv_mapping

email_accounts (1) ──── (n) emails

matterport_spaces (standalone)
aufmass_data (standalone)
telegram_conversation_state (standalone)
```

---

## Verwendete Extensions

- `pgvector` - Für Embeddings in `lv_positionen`
- `uuid-ossp` - UUID-Generierung

---

## Quick-Referenz

### Python-Verbindung

```python
from supabase import create_client

url = "https://mfpuijttdgkllnvhvjlu.supabase.co"
key = "eyJhbGciOi..."  # service_role aus .supabase-config.json

supabase = create_client(url, key)

# Beispiel: Projekte abfragen
projekte = supabase.table("projekte").select("*").execute()
```

### REST API

```bash
# Projekte abrufen
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/rest/v1/projekte" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

---

## Nachtragsmanagement (NEU - 2026-01-24)

### nachtraege

Nachträge während der Bauphase (Zusatzleistungen, Mängelbehebung).

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| nachtrag_nr | text | Auto | **Eindeutige Nummer** (ATBS-450-N1, N2, ...) |
| atbs_nummer | text | Ja | Projektnummer |
| monday_item_id | bigint | Nein | Referenz zu monday_bauprozess |
| status | text | Ja | `(0) Offen`, `(1) Preis eingegeben`, `(2) Genehmigt`, `(3) Abgelehnt` |
| titel | text | Nein | Titel des Nachtrags |
| beschreibung | text | Nein | Detailbeschreibung |
| foto_urls | text[] | Nein | Array mit Foto-URLs |
| betrag_kunde_netto | numeric(12,2) | Nein | Nettobetrag Kunde |
| marge_prozent | numeric(5,2) | Auto | Marge % (vom Projekt geholt) |
| betrag_nu_netto | numeric(12,2) | Auto | **Berechnet:** Kunde × (1 - Marge%) |
| verzoegerung_tage | integer | Nein | Verzögerung des Bauvorhabens |
| gemeldet_von | text | Nein | `bauleiter` oder `nu` |
| melder_name | text | Nein | Name des Melders |
| nu_name | text | Auto | Name NU (vom Projekt) |
| nu_email | text | Auto | E-Mail NU (vom Projekt) |
| bauleiter_name | text | Auto | Name BL (vom Projekt) |
| bauleiter_email | text | Auto | E-Mail BL (vom Projekt) |
| benachrichtigung_gesendet | boolean | Nein | E-Mail versendet? |
| benachrichtigt_am | timestamptz | Nein | Zeitpunkt der Benachrichtigung |
| created_at | timestamptz | Nein | Erstellt am |
| updated_at | timestamptz | Nein | Geändert am |

**Trigger:**
- `trg_nachtrag_auto_fields` - Generiert `nachtrag_nr`, berechnet `betrag_nu_netto`
- `trg_prepare_nachtrag_notification` - Holt Kontaktdaten vom Projekt
- `trg_queue_nachtrag_notifications` - Erstellt E-Mail in Queue

---

### nachtrag_notifications

E-Mail-Benachrichtigungs-Queue für Nachträge.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| id | uuid | Ja | Primary Key |
| nachtrag_id | uuid | Ja | FK -> nachtraege |
| recipient_type | text | Ja | `bauleiter`, `nu`, `admin` |
| recipient_email | text | Ja | E-Mail-Adresse |
| recipient_name | text | Nein | Name des Empfängers |
| subject | text | Ja | Betreff |
| body | text | Ja | E-Mail-Text |
| status | text | Nein | `pending`, `sent`, `failed` |
| error_message | text | Nein | Fehlermeldung |
| created_at | timestamptz | Nein | Erstellt am |
| sent_at | timestamptz | Nein | Versendet am |

---

### Funktionen

| Funktion | Beschreibung |
|----------|--------------|
| `create_nachtrag(...)` | Erstellt Nachtrag mit automatischer Marge vom Projekt |
| `get_next_nachtrag_nr(atbs)` | Generiert nächste Nummer (ATBS-XXX-N1, N2, ...) |
| `calculate_nachtrag_fields()` | Trigger: Auto-Nummer + NU-Berechnung |
| `prepare_nachtrag_notification()` | Trigger: Kontaktdaten vom Projekt |
| `queue_nachtrag_notifications()` | Trigger: E-Mail-Queue befüllen |

**Beispiel:**
```sql
-- Nachtrag erstellen (Nummer + Marge automatisch)
SELECT * FROM create_nachtrag(
    'ATBS-450',           -- atbs_nummer
    'Zusätzliche Steckdosen',  -- titel
    'Kunde wünscht 3 Steckdosen mehr',  -- beschreibung
    '{}',                 -- foto_urls
    'bauleiter',          -- gemeldet_von
    'Holger',             -- melder_name
    2                     -- verzoegerung_tage
);
-- Ergebnis: {id: "...", nachtrag_nr: "ATBS-450-N1"}
```

---

### Edge Functions

| Function | Beschreibung | Cron |
|----------|--------------|------|
| `nachtraege-sync` | Sync Softr <-> Supabase, generiert Nummern | */2 * * * * |
| `nachtrag-notify` | Versendet E-Mails aus Queue | */2 * * * * |
| `nachtrag-webhook` | Webhook für sofortige Verarbeitung | - |

---

### Softr.io Integration

**Tabelle:** `Nachtraege` (ID: `XBbQjiFnPkmSE9`)

| Softr Feld-ID | Supabase Spalte | Typ |
|---------------|-----------------|-----|
| nBEvh | nachtrag_nr | SINGLE_LINE_TEXT |
| 2eVhs | atbs_nummer | SINGLE_LINE_TEXT |
| BwLca | status | SELECT |
| AYdFA | titel | SINGLE_LINE_TEXT |
| t0nhv | beschreibung | LONG_TEXT |
| D544K | betrag_kunde_netto | NUMBER (Currency) |
| QN67y | marge_prozent | NUMBER |
| DeIfR | betrag_nu_netto | NUMBER (Currency) |
| UkKF5 | verzoegerung_tage | NUMBER |
| xe65z | gemeldet_von | SINGLE_LINE_TEXT |
| NMic0 | melder_name | SINGLE_LINE_TEXT |
| 45hz6 | foto_urls | ATTACHMENT (Multi) |
| fLPQN | nu_name | SINGLE_LINE_TEXT |
| bwloV | nu_email | EMAIL |
| ANRmN | bauleiter_name | SINGLE_LINE_TEXT |
| 2W1s2 | bauleiter_email | EMAIL |

**Sync:** Bidirektional, alle 2 Minuten via `nachtraege-sync`

---

### Workflow

```
1. Neuer Nachtrag in Softr (Bauleiter/NU)
   - ATBS-Nummer + Titel + Beschreibung + Fotos eingeben
   - Status: "(0) Offen"

2. Automatischer Sync (max. 2 Min)
   - Record wird nach Supabase kopiert
   - Nachtrag-Nr wird generiert (ATBS-450-N1)
   - Marge wird vom Projekt geholt (z.B. 40%)
   - Kontaktdaten (BL + NU) werden vom Projekt geholt
   - E-Mail-Benachrichtigung wird in Queue gestellt
   - Nummer wird nach Softr zurückgeschrieben

3. Kundenbetrag eintragen (Tobi)
   - betrag_kunde_netto = 500€
   - betrag_nu_netto wird automatisch berechnet: 500 × 0.6 = 300€
   - Status: "(1) Preis eingegeben"

4. Freigabe
   - Status: "(2) Genehmigt" oder "(3) Abgelehnt"
```

---

### E-Mail-Benachrichtigung (ausstehend)

**SMTP-Konfiguration erforderlich:**

Dashboard: https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu/functions/nachtrag-notify/secrets

| Secret | Wert |
|--------|------|
| SMTP_HOST | smtp.office365.com |
| SMTP_PORT | 587 |
| SMTP_USER | kontakt@neurealis.de |
| SMTP_PASS | (App-Passwort) |
| SMTP_FROM | kontakt@neurealis.de |
| SMTP_FROM_NAME | neurealis Nachtragsmanagement |

---

*Dokumentation aktualisiert am 2026-01-24*
