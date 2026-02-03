# Learnings: Telegram-Bot

Letzte Aktualisierung: 2026-02-03

---

## Webhook / Setup

### L053: Telegram Webhook mit Supabase Edge Functions
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Lösung:** Edge Function mit `verify_jwt: false`
**Webhook-URL:** `https://{project}.supabase.co/functions/v1/telegram-webhook`
**Registrierung:**
```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url={WEBHOOK_URL}"
```
**Bot-Token:** Als Secret in Supabase, NIEMALS im Code!

---

### L177: verify_jwt MUSS false sein
**Kategorie:** Technisch
**Datum:** 2026-02-02
**Problem:** Bot reagierte nicht auf /start, 401 Unauthorized
**Ursache:** Telegram sendet kein JWT-Token
**Lösung:** Deploy mit `verify_jwt: false`

---

## Session-Management

### L054: telegram_sessions Tabelle
**Kategorie:** Technisch
**Datum:** 2026-01-29
**Felder:**
- `aktuelles_bv_id` - Aktuell geöffnetes Projekt
- `aktueller_modus` - 'idle', 'mangel_erfassen', etc.
- `kontext` (JSONB) - Zwischenspeicher
**Pattern:** Session pro chat_id, `last_activity` aktualisieren

---

### L143: media_group_id für Multi-Foto-Upload
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Problem:** Mehrere Fotos werden einzeln verarbeitet
**Lösung:**
```typescript
const mediaGroupId = update.message?.media_group_id;
if (mediaGroupId) {
  // Foto zur pending-Liste hinzufügen
  // Nach 1.5-2 Sekunden alle verarbeiten
}
```

---

## Mängel-Erfassung

### L089: Mangelnummer-Pattern
**Kategorie:** Business
**Datum:** 2026-01-30
**Format:** `{PROJEKT_NR}-M{laufend}`
**Beispiel:** ATBS-456-M1
```typescript
const { count } = await supabase
  .from('maengel_fertigstellung')
  .select('id', { count: 'exact', head: true })
  .eq('projekt_nr', projektNr);
return `${projektNr}-M${(count || 0) + 1}`;
```

---

### L090: KI-Prompt für Gewerke-spezifische Mängel
**Kategorie:** Technisch
**Datum:** 2026-01-30
**System-Prompt enthält:**
1. Gewerke benennen: Elektrik, Sanitär, Maler, Boden, etc.
2. Trennungs-Regeln für mehrere Mängel
3. Typische Beispiele pro Gewerk
4. Übersetzung: DE, RU, HU, RO, PL → Deutsche Ausgabe

---

### L091: Multi-Mangel Foto-Workflow
**Kategorie:** UX
**Datum:** 2026-01-30
**Zwei-Wege-Workflow:**
1. Mangel zuerst → dann Foto hochladen
2. Foto zuerst → Auswahl-Buttons erscheinen
```typescript
modus_daten: {
  pending_foto: { url, file_id },
  offene_maengel: [...]
}
```

---

### L092: Bauvorhaben-Pflichtfelder
**Kategorie:** Business
**Datum:** 2026-01-30
**Bei JEDER Eingabe über Bot befüllen:**
- `projektname_komplett` - aus Monday
- `projektname_extern` (falls vorhanden)
**JSON-Pfad:** `column_values->'text49__1'->>'text'`

---

### L157: Nummerierungsformat
**Kategorie:** Business
**Datum:** 2026-02-01
- Mängel: `ATBS-456-M1`
- Nachträge: `ATBS-456-N1`

---

## Nachtrag-Erfassung

### L096: Score-basiertes LV-Position-Matching
**Kategorie:** Technisch
**Datum:** 2026-01-30
```typescript
let score = 0;
if (gewerk === position.gewerk) score += 10;
for (const word of beschreibungWords) {
  if (positionName.includes(word)) score += 5;
}
// Threshold: score >= 10
```

---

### L101: CHECK constraints beachten
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Problem:** Nachtrag speichern scheiterte
**Ursache:** CHECK constraints erlauben nur bestimmte Werte
```sql
-- nachtraege_status_check
'(0) Offen / Preis eingeben', '(1) Genehmigt', '(2) Abgelehnt'

-- nachtraege_gemeldet_von_check
'bauleiter', 'nu', 'telegram'
```

---

## Benutzer-Interaktion

### L148: ATBS-Schnellzugriff im Menü
**Kategorie:** UX
**Datum:** 2026-02-01
**Beste Reihenfolge:**
1. Favoriten (Top 3)
2. ATBS direkt eingeben
3. Baustelle öffnen (Phasen-Filter)
4. Aufmaß erstellen
5. Audio-Briefing
6. Bedarfsanalyse

---

### L153: Sprach-Befehle ohne Projekt-Kontext
**Kategorie:** UX
**Datum:** 2026-02-01
**Problem:** User mussten erst Projekt öffnen
**Lösung:**
- `extractAtbsFromText()` erkennt ATBS-456, "456"
- `loadProjektByAtbs()` lädt on-demand
**Ergebnis:** "456 Elektrik fertig" funktioniert direkt

---

### L145: Berechtigungs-Prüfung
**Kategorie:** Sicherheit
**Datum:** 2026-01-31
```typescript
const BERECHTIGTE = [
  'holger.neumann@neurealis.de',
  'dirk.jansen@neurealis.de'
];

async function istBerechtigt(chatId: number): Promise<boolean> {
  const { data: kontakt } = await supabase
    .from('kontakte')
    .select('email')
    .eq('telegram_chat_id', chatId)
    .single();
  return BERECHTIGTE.includes(kontakt?.email?.toLowerCase());
}
```

---

## Embedding-basierte Suche

### L098: Embedding vs. Keyword-Matching
**Kategorie:** Technisch
**Datum:** 2026-01-31
**Vorteile pgvector:**
- Semantische Ähnlichkeit
- "Steckdose" findet "Wandsteckdose 2-fach"
- Robuster bei Variationen
**Threshold:** similarity >= 0.6

---

### L099: strip_html für saubere Embeddings
**Kategorie:** Technisch
**Datum:** 2026-01-31
```sql
CREATE OR REPLACE FUNCTION strip_html(text) RETURNS text AS $$
  SELECT COALESCE(regexp_replace($1, '<[^>]*>', ' ', 'g'), '');
$$ LANGUAGE sql IMMUTABLE;
```

---

### L100: Similarity-Threshold
**Kategorie:** Technisch
**Datum:** 2026-01-31
- **0.6** = guter Kompromiss
- < 0.5 = zu viele False Positives
- > 0.8 = zu viele False Negatives

---

*Vollständige Learnings siehe docs/learnings.md*
