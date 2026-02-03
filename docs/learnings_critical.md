# KRITISCHE LEARNINGS (IMMER BEACHTEN!)

Letzte Aktualisierung: 2026-02-03

Diese Learnings verhindern teure Fehler. Bei JEDEM Task prüfen!

---

| Nr | Kurztitel | Warum kritisch |
|----|-----------|----------------|
| L045 | Backup vor DB-Änderungen | Datenverlust nicht reversibel |
| L103 | preis vs. listenpreis | Falscher Preis = 41% Verlust |
| L041 | Upsert überschreibt NULL | Datenverlust bei Sync |
| L058 | Edge Functions LESEN | Funktionalität verloren |
| L177 | verify_jwt für Webhooks | Bot funktioniert nicht |
| L146 | verify_jwt für Cron | Edge Functions 401 Fehler |
| L137 | max_completion_tokens | GPT-5.2 gibt 400 Fehler |
| L006 | Umlaute korrekt | Unprofessionell, UTF-8 Pflicht |
| L147 | Learnings Summary | Context-Window Überlauf |
| L066 | Subagenten Overnight | Context-Window voll nach 7h |
| L143 | Audio nur auf Edge | OpenAI Key nur in Supabase |
| L144 | Präfix-Konvention nu_/bl_/ag_ | Verwechslungsgefahr bei Feldern |
| L176 | Elementor Backup PFLICHT | Template-Verlust |
| L060 | Edge Function Backup | Code nur in Supabase |
| L072 | Batch API für KI-Tasks | Timeout nach 60s |

---

## Details

### L045: PFLICHT - Backup vor DB-Änderungen mit KI
**Kategorie:** Workflow/Sicherheit
**Datum:** 2026-01-28
**Problem:** hero-document-sync überschrieb existierende Netto/Brutto-Werte mit 0
**Lösung:** VOR JEDER DB-Änderung:
1. SELECT * FROM tabelle WHERE bedingung → JSON exportieren
2. Speichern in `docs/backups/[datum]_[tabelle]_[aktion].json`
3. ERST DANN: UPDATE/DELETE/INSERT ausführen
**Beispiel:**
```json
{
  "datum": "2026-01-29",
  "tabelle": "maengel_fertigstellung",
  "aktion": "UPDATE status_mangel",
  "rollback_query": "UPDATE ... SET ... WHERE id IN (...)"
}
```
**Beweis:** `docs/softr_amounts_backup.json` rettete 11 Dokumente (~142.578 EUR)

---

### L103: preis = EK, listenpreis = VK - IMMER VK verwenden!
**Kategorie:** Business/Kalkulation
**Datum:** 2026-01-31
**Problem:** Angebot war 41% zu niedrig weil EK-Preise statt VK-Preise verwendet wurden
**Lösung:** Bei Angeboten an Kunden IMMER `listenpreis` (VK) verwenden!
**Beispiel:**
| Position | preis (EK) | listenpreis (VK) | Marge |
|----------|----------:|----------------:|------:|
| Wand-WC | 230,00 EUR | 352,13 EUR | +53% |
| E-Check | 332,47 EUR | 538,19 EUR | +62% |
**Fehlerfall:** EK-Angebot = sofortiger Verlust

---

### L041: Upsert überschreibt existierende Werte mit NULL/0
**Kategorie:** Technisch/Datenbank
**Datum:** 2026-01-28
**Problem:** Code `const netto = doc.value || 0;` setzt 0 wenn Quelle keinen Wert hat
**Lösung:** Felder nur ins Record aufnehmen wenn Quelle Werte hat:
```javascript
// RICHTIG: Nur setzen wenn vorhanden
const record = { ... };
if (doc.value !== null && doc.value !== 0) {
  record.betrag_netto = doc.value;
}
```
**Konsequenz:** 11 Dokumente mussten aus Backup wiederhergestellt werden

---

### L058: NIEMALS bestehende Edge Functions überschreiben
**Kategorie:** Workflow/Entwicklung
**Datum:** 2026-01-29
**Problem:** Annahme dass Code überschrieben wurde
**Lösung:** Bei Edge Function Updates IMMER:
1. Bestehenden Code LESEN via `mcp__supabase__get_edge_function`
2. Nur ERGÄNZEN, nicht ersetzen
3. Bestehende Befehle erhalten
**Konsequenz:** Funktionalität verloren, musste neu implementiert werden

---

### L177: Telegram-Webhook: verify_jwt MUSS false sein
**Kategorie:** Technisch/Edge Functions
**Datum:** 2026-02-02
**Problem:** Bot reagierte nicht auf /start, Logs zeigten 401 Unauthorized
**Ursache:** `verify_jwt: true` aber Telegram sendet kein JWT-Token
**Lösung:** Deploy mit `verify_jwt: false`
**Merkregel:** Externe Webhooks (Telegram, Stripe, etc.) → IMMER `verify_jwt: false`

---

### L146: Edge Functions: verify_jwt für Cron-Jobs = false
**Kategorie:** Technisch/Edge Functions
**Datum:** 2026-02-01
**Problem:** Edge Functions mit `verify_jwt: true` können nicht von pg_net/Cron aufgerufen werden
**Fehler:** 401 Missing authorization header
**Regel:**
- `verify_jwt: true` → Nur für User-aufgerufene Functions (mit Auth-Token)
- `verify_jwt: false` → Für Cron-Jobs, DB-Trigger, interne Calls, Webhooks

---

### L137: GPT-5.2 erfordert max_completion_tokens
**Kategorie:** Technisch/OpenAI
**Datum:** 2026-01-31
**Problem:** API-Fehler 400: "Unsupported parameter: 'max_tokens'"
**Lösung:**
```javascript
// FALSCH bei GPT-5.2
{ model: 'gpt-5.2', max_tokens: 4000 }

// RICHTIG bei GPT-5.2
{ model: 'gpt-5.2', max_completion_tokens: 4000 }
```

---

### L006: Umlaute korrekt verwenden - ä/ö/ü/ß
**Kategorie:** UX/Qualität
**Datum:** 2026-01-26
**Problem:** ae/oe/ue sieht unprofessionell aus
**Lösung:** UTF-8 überall, deutsche Umlaute verwenden
**Ausnahme:** Technische Variablennamen, Datenbankfelder

---

### L147: Learnings Summary für Preflight (PFLICHT!)
**Kategorie:** Workflow/Claude
**Datum:** 2026-02-01
**Problem:** `learnings.md` mit 160+ Einträgen überschreitet 25k Token-Limit
**Lösung:** `learnings_summary.md` als kompakter Index
**Workflow:**
1. Preflight liest Summary (schnell, kompakt)
2. Bei Bedarf Volltext mit offset/limit
3. Neue Learnings IMMER in beiden Dateien ergänzen!

---

### L066: Subagenten für Overnight-Tasks (KRITISCH)
**Kategorie:** Workflow/Claude
**Datum:** 2026-01-29
**Problem:** Context Window voll nach ~7 Stunden
**Lösung:**
1. Tracker-Datei erstellen
2. PRO Task einen SUBAGENTEN starten
3. Hauptchat nur für Koordination
4. `run_in_background: true` für lange Tasks

---

### L143: Audio-Generierung NUR auf Edge Functions
**Kategorie:** Sicherheit/API
**Datum:** 2026-02-01
**Regel:** Audio-Briefings AUSSCHLIESSLICH über Supabase Edge Functions
**Grund:** OpenAI API Key nur in Supabase Secrets, nicht lokal

---

### L144: Präfix-Konvention in monday_bauprozess
**Kategorie:** Datenbank/Konvention
**Datum:** 2026-02-01
**Regel:** Spalten nach Entität benennen:
- `nu_firma`, `nu_email` (Nachunternehmer)
- `bl_name`, `bl_email` (Bauleiter)
- `ag_name`, `ag_email` (Auftraggeber)
**Vorteil:** Keine Verwechslung, eindeutige Queries

---

### L176: Elementor _elementor_data Backup vor Änderungen (PFLICHT!)
**Kategorie:** WordPress/Sicherheit
**Datum:** 2026-02-02
**Problem:** Elementor-Template wurde durch API-Update überschrieben
**Regel:**
1. VOR jedem Update: `wordpress-get-post` ausführen
2. `meta._elementor_data` in `docs/backups/` speichern
3. DANN ERST Updates durchführen

---

### L060: Backups von Edge Functions erstellen
**Kategorie:** Workflow/Sicherheit
**Datum:** 2026-01-29
**Problem:** Edge Functions die nur in Supabase existieren können verloren gehen
**Regel:** VOR jeder Änderung:
1. `mcp__supabase__get_edge_function` zum Abrufen
2. Backup speichern in `backups/edge-functions/`
3. Erst dann Änderungen vornehmen

---

### L072: PFLICHT - Batch API für langläufige KI-Tasks
**Kategorie:** Cloud/Performance
**Datum:** 2026-01-29
**Problem:** Supabase Edge Function Timeout = 60s (Pro: 150s)
**Regel:** Bei Cloud-Diensten IMMER Batch-Processing wenn:
1. API-Calls > 30 Sekunden dauern können
2. Mehrere Items verarbeitet werden
**Pattern:** Submit → Poll → Process

---

*Generiert aus docs/learnings.md - Diese Datei wird bei /pre IMMER geladen*
