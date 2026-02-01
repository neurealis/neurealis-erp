# Audio-Briefing für Bauleiter - Konzept

**Stand:** 2026-02-01
**Version:** 1.0
**Status:** Konzept zur Freigabe

---

## 1. Übersicht

### Was ist das Audio-Briefing?

Ein **automatisch generierter Podcast** der täglich morgens an den Bauleiter per Telegram gesendet wird. Der Bauleiter kann das Briefing auf dem Weg zur Arbeit im Auto anhören und erhält so alle relevanten Informationen für den Tag bzw. die Woche.

**Kernvorteile:**
- **Hands-free:** Anhören während der Fahrt zur Baustelle
- **Zeitersparnis:** Keine manuelle Dashboard-Prüfung nötig
- **Vollständig:** Alle relevanten Daten in 2-5 Minuten
- **Personalisiert:** Nur Projekte des jeweiligen Bauleiters

### Format

| Eigenschaft | Wert |
|-------------|------|
| **Dateiformat** | MP3 (128 kbps) oder OGG/Opus (48 kbps, kleinere Dateien) |
| **Stimme** | Professionell, deutsch, männlich/weiblich |
| **Länge** | Ziel: 2-5 Minuten |
| **Stil** | Freundlich, klar, kompakt - wie ein Nachrichten-Briefing |
| **Delivery** | Push via Telegram (Audio-Message) |
| **Storage** | Supabase Storage (`briefings/` Bucket) |

---

## 2. Inhalt & Struktur

### 2.1 Montag-Briefing (Wochenübersicht)

Das Montag-Briefing ist **ausführlicher** und enthält eine Wochenvorschau.

**Gliederung (~4-5 Minuten):**

```
1. BEGRÜSSUNG (10 Sek)
   "Guten Morgen [Name]. Hier ist dein Wochen-Briefing für Montag,
   den [Datum]. Los geht's."

2. WOCHENÜBERSICHT (30 Sek)
   "Diese Woche hast du [X] aktive Projekte in Phase 3 und 4.
   Davon starten [Y] Projekte neu und [Z] sollen diese Woche
   fertiggestellt werden."

3. TERMINE DIESE WOCHE (60-90 Sek)
   • Baustart-Termine
   • Bauende-Termine
   • Kundenabnahmen (datum_kundenabnahme)
   • Erstbegehungen (datum_erstbegehung)
   • Endbegehungen (datum_endbegehung)
   → Gruppiert nach Wochentag

4. ÜBERFÄLLIGE MÄNGEL (30-60 Sek)
   "Es gibt aktuell [X] überfällige Mängel, davon [Y] kritisch
   über 7 Tage überfällig."
   → Top 5 mit Projekt, Art, Tage überfällig

5. OFFENE NACHTRÄGE (30 Sek)
   "Du hast [X] offene Nachträge mit einem Gesamtwert von [Y] Euro."
   → Status-Verteilung (Gemeldet, In Prüfung, Genehmigt)

6. PROJEKTE OHNE NU-VERGABE (30 Sek)
   "Bei [X] Projekten in Phase 2 fehlt noch die NU-Vergabe."
   → Liste der ATBS-Nummern

7. OFFENE BESTÄTIGUNGEN (20 Sek)
   "Du hast [X] Aufgaben, die deine Bestätigung erfordern."

8. ABSCHLUSS (10 Sek)
   "Das war dein Wochen-Briefing. Einen guten Start in die Woche!"
```

### 2.2 Tägliches Briefing (Dienstag-Freitag)

Das tägliche Briefing ist **kompakter** und fokussiert auf den aktuellen Tag.

**Gliederung (~2-3 Minuten):**

```
1. BEGRÜSSUNG (10 Sek)
   "Guten Morgen [Name]. Hier ist dein Tages-Briefing für
   [Wochentag], den [Datum]."

2. TERMINE HEUTE (30-45 Sek)
   • Baustart heute
   • Bauende heute
   • Kundenabnahmen heute
   • NU-Termine heute (falls aus Kalender)

3. KRITISCHE MÄNGEL (30 Sek)
   "Du hast [X] überfällige Mängel. Der älteste ist bei [Projekt]
   seit [Y] Tagen offen."
   → Nur wenn > 0

4. OFFENE NACHTRÄGE (20 Sek)
   "Es gibt [X] offene Nachträge mit insgesamt [Y] Euro Volumen."
   → Nur wenn > 0

5. STATUS-CHANGES (30 Sek) - Optional
   "Seit gestern: [X] Mängel wurden als behoben gemeldet,
   [Y] neue Mängel erfasst."

6. ABSCHLUSS (10 Sek)
   "Das war dein Tages-Briefing. Viel Erfolg heute!"
```

### 2.3 SQL-Queries für Daten

#### 2.3.1 Aktive Projekte des Bauleiters

```sql
-- Aktive Projekte (Phase 2-4)
SELECT
  atbs_nummer,
  name,
  auftraggeber,
  adresse,
  baustart,
  bauende,
  status_projekt,
  status_nua,
  budget
FROM monday_bauprozess
WHERE bauleiter_email = $1  -- Bauleiter-E-Mail
  AND status_projekt IN ('(2) Angebot', '(3) Vorbereitung', '(4) Umsetzung')
ORDER BY baustart NULLS LAST;
```

#### 2.3.2 Termine diese Woche / heute

```sql
-- Termine in Zeitraum
SELECT
  atbs_nummer,
  name,
  'Baustart' as termin_art,
  baustart as datum
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND baustart BETWEEN $2 AND $3
UNION ALL
SELECT
  atbs_nummer,
  name,
  'Bauende' as termin_art,
  bauende as datum
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND bauende BETWEEN $2 AND $3
UNION ALL
SELECT
  atbs_nummer,
  name,
  'Kundenabnahme' as termin_art,
  datum_kundenabnahme as datum
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND datum_kundenabnahme BETWEEN $2 AND $3
UNION ALL
SELECT
  atbs_nummer,
  name,
  'Erstbegehung' as termin_art,
  datum_erstbegehung as datum
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND datum_erstbegehung BETWEEN $2 AND $3
UNION ALL
SELECT
  atbs_nummer,
  name,
  'Endbegehung' as termin_art,
  datum_endbegehung as datum
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND datum_endbegehung BETWEEN $2 AND $3
ORDER BY datum;
```

#### 2.3.3 Überfällige Mängel

```sql
-- Überfällige Mängel des Bauleiters
SELECT
  m.mangel_nr,
  m.projekt_nr,
  m.art_des_mangels,
  m.beschreibung_mangel,
  m.nachunternehmer,
  m.datum_frist,
  (CURRENT_DATE - DATE(m.datum_frist)) as tage_ueberfaellig
FROM maengel_fertigstellung m
WHERE m.bauleiter = $1  -- Bauleiter-Name
  AND m.status_mangel NOT IN ('Abgenommen', 'Abgeschlossen', 'Erledigt', 'Geschlossen')
  AND m.datum_frist < CURRENT_DATE
ORDER BY tage_ueberfaellig DESC
LIMIT 10;
```

#### 2.3.4 Offene Nachträge

```sql
-- Offene Nachträge des Bauleiters
SELECT
  n.nachtrag_nr,
  n.atbs_nummer,
  n.titel,
  n.status,
  n.betrag_kunde_netto,
  n.created_at
FROM nachtraege n
JOIN monday_bauprozess p ON n.atbs_nummer = p.atbs_nummer
WHERE p.bauleiter_email = $1
  AND n.status IN ('(0) Offen / Preis eingeben', '(1) In Prüfung', '(2) Genehmigt - nicht beauftragt')
ORDER BY n.created_at DESC;
```

#### 2.3.5 Projekte in Phase 2 ohne NUA

```sql
-- Phase 2 ohne NU-Vergabe
SELECT
  atbs_nummer,
  name,
  auftraggeber,
  budget
FROM monday_bauprozess
WHERE bauleiter_email = $1
  AND status_projekt = '(2) Angebot'
  AND (status_nua IS NULL OR status_nua = '' OR status_nua = 'Offen')
ORDER BY budget DESC NULLS LAST;
```

#### 2.3.6 Offene Aufgaben/Bestätigungen

```sql
-- Offene Tasks für Bauleiter (falls tasks-Tabelle genutzt wird)
SELECT
  COUNT(*) as offene_tasks
FROM tasks t
WHERE t.assignee_email = $1
  AND t.status IN ('offen', 'in_bearbeitung')
  AND t.due_date <= CURRENT_DATE + INTERVAL '7 days';
```

### 2.4 Ziellänge

| Briefing-Typ | Ziel-Länge | Wörter (~150/Min) |
|--------------|------------|-------------------|
| Montag (Woche) | 4-5 Min | 600-750 Wörter |
| Dienstag-Freitag | 2-3 Min | 300-450 Wörter |
| Samstag/Sonntag | - | Kein Briefing |

**Dynamische Anpassung:**
- Wenn keine überfälligen Mängel → Abschnitt überspringen
- Wenn keine Termine → Kurze Meldung "Keine Termine heute"
- Wenn viele Punkte → Priorisieren, nur Top-5 nennen

---

## 3. Technische Umsetzung

### 3.1 Text-to-Speech API

**Empfehlung: OpenAI TTS API**

| Provider | Qualität | Preis | Latenz | Empfehlung |
|----------|----------|-------|--------|------------|
| **OpenAI TTS** | Sehr gut | $15/1M chars | ~2s | ✅ Empfohlen |
| ElevenLabs | Exzellent | $11-99/Mo | ~3s | Zu teuer für Start |
| Google Cloud TTS | Gut | $4-16/1M chars | ~1s | Alternative |
| Azure TTS | Gut | $4/1M chars | ~1s | Alternative |

**OpenAI TTS Details:**
- Modelle: `tts-1` (schnell), `tts-1-hd` (besser)
- Stimmen: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- **Empfohlene Stimme:** `onyx` (männlich, professionell) oder `nova` (weiblich, freundlich)
- Output: MP3, Opus, AAC, FLAC
- Max Input: 4096 Zeichen pro Request

**Beispiel-Code:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

const mp3 = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'onyx',
  input: briefingText,
  response_format: 'mp3',
  speed: 1.0  // 0.25 - 4.0
});

const buffer = Buffer.from(await mp3.arrayBuffer());
```

**Kosten-Schätzung:**
- 500 Wörter ≈ 3.000 Zeichen
- Bei 20 Arbeitstagen/Monat = 60.000 Zeichen
- Kosten: ~$0.90/Monat/Bauleiter

### 3.2 Edge Function Architektur

**Neue Edge Functions:**

```
supabase/functions/
├── audio-briefing-generate/    # Hauptfunktion
│   └── index.ts
├── audio-briefing-send/        # Telegram-Push
│   └── index.ts
└── _shared/
    └── briefing-templates.ts   # Skript-Templates
```

**audio-briefing-generate/index.ts:**

```typescript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. Bauleiter-Daten laden
const bauleiterEmail = request.bauleiter_email;
const isMonday = new Date().getDay() === 1;

// 2. SQL-Queries ausführen
const projekte = await getAktiveProjekte(bauleiterEmail);
const termine = await getTermine(bauleiterEmail, isMonday);
const maengel = await getUeberfaelligeMaengel(bauleiterEmail);
const nachtraege = await getOffeneNachtraege(bauleiterEmail);
const ohneNUA = await getProjekteOhneNUA(bauleiterEmail);

// 3. Skript generieren
const skript = generateBriefingSkript({
  bauleiterName: 'Dirk',
  isMonday,
  projekte,
  termine,
  maengel,
  nachtraege,
  ohneNUA
});

// 4. Text-to-Speech
const audio = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'onyx',
  input: skript,
  response_format: 'mp3'
});

// 5. In Storage speichern
const filename = `briefings/${bauleiterEmail}/${dateStr}_briefing.mp3`;
await supabase.storage.from('audio').upload(filename, audioBuffer);

// 6. Telegram senden
await sendTelegramAudio(chatId, audioBuffer, skript);

return { success: true, duration_seconds: audioDuration };
```

### 3.3 Cron-Job Timing

**Empfohlener Schedule:**

| Job | Schedule (Cron) | Zeit | Beschreibung |
|-----|-----------------|------|--------------|
| `audio-briefing-job` | `0 5 * * 1-5` | 06:00 MEZ | Mo-Fr, vor Arbeitsbeginn |

**Warum 06:00 Uhr?**
- Bauleiter fahren meist 06:30-07:30 zur ersten Baustelle
- Audio muss vor Fahrtbeginn verfügbar sein
- Genug Zeit für Generierung + Upload + Telegram-Push

**Alternative: User-spezifischer Zeitpunkt**
- Spalte `briefing_time` in `kontakte` Tabelle
- Default: 06:00, aber individuell konfigurierbar

### 3.4 Storage

**Supabase Storage Bucket:**

```sql
-- Bucket erstellen (einmalig)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  false,  -- Private, nur über signed URLs
  10485760,  -- 10 MB max
  ARRAY['audio/mpeg', 'audio/ogg', 'audio/mp4']
);
```

**Ordnerstruktur:**
```
audio/
├── briefings/
│   ├── dirk.jansen@neurealis.de/
│   │   ├── 2026-02-01_briefing.mp3
│   │   ├── 2026-02-02_briefing.mp3
│   │   └── ...
│   └── holger.neumann@neurealis.de/
│       └── ...
└── temp/
```

**Aufbewahrung:** 7 Tage, dann automatisch löschen (Storage Lifecycle Policy)

### 3.5 Telegram Audio-Push

**Telegram Bot API: sendAudio**

```typescript
async function sendTelegramAudio(
  chatId: number,
  audioBuffer: ArrayBuffer,
  caption: string
): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'briefing.mp3');
  formData.append('caption', caption.substring(0, 200));  // Max 200 chars
  formData.append('title', 'Tages-Briefing');
  formData.append('performer', 'neurealis ERP');

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`);
  }
}
```

**Alternative: sendVoice**
- Kompakter (Opus-Format)
- Keine Metadaten (Title, Performer)
- Einfacher für kurze Messages

```typescript
// sendVoice für kompaktere Nachrichten
formData.append('voice', blob, 'briefing.ogg');
```

---

## 4. Skript-Templates

### 4.1 Montag-Wochenbriefing Template

```typescript
function generateMondayBriefing(data: BriefingData): string {
  const { bauleiterName, projekte, termine, maengel, nachtraege, ohneNUA } = data;
  const today = formatDate(new Date());

  let skript = `
Guten Morgen ${bauleiterName}. Hier ist dein Wochen-Briefing für Montag, den ${today}. Los geht's.

`;

  // Wochenübersicht
  const phase3_4 = projekte.filter(p =>
    p.status_projekt?.includes('(3)') || p.status_projekt?.includes('(4)')
  );
  const startsThisWeek = termine.filter(t => t.termin_art === 'Baustart').length;
  const endsThisWeek = termine.filter(t => t.termin_art === 'Bauende').length;

  skript += `Diese Woche hast du ${phase3_4.length} aktive Projekte in Phase 3 und 4. `;
  if (startsThisWeek > 0) skript += `${startsThisWeek} Projekte starten diese Woche. `;
  if (endsThisWeek > 0) skript += `${endsThisWeek} Projekte sollen fertiggestellt werden. `;
  skript += '\n\n';

  // Termine diese Woche
  if (termine.length > 0) {
    skript += `Zu deinen Terminen diese Woche: `;
    const termineByDay = groupBy(termine, t => formatWeekday(t.datum));
    for (const [day, dayTermine] of Object.entries(termineByDay)) {
      skript += `Am ${day}: `;
      dayTermine.forEach(t => {
        skript += `${t.termin_art} bei ${t.atbs_nummer}. `;
      });
    }
    skript += '\n\n';
  } else {
    skript += `Diese Woche stehen keine besonderen Termine an.\n\n`;
  }

  // Überfällige Mängel
  if (maengel.length > 0) {
    const kritisch = maengel.filter(m => m.tage_ueberfaellig > 7);
    skript += `Achtung: Es gibt ${maengel.length} überfällige Mängel`;
    if (kritisch.length > 0) {
      skript += `, davon ${kritisch.length} kritisch über 7 Tage überfällig`;
    }
    skript += '. ';

    const top3 = maengel.slice(0, 3);
    top3.forEach(m => {
      skript += `Bei ${m.projekt_nr}: ${m.art_des_mangels}, ${m.tage_ueberfaellig} Tage offen. `;
    });
    skript += '\n\n';
  }

  // Offene Nachträge
  if (nachtraege.length > 0) {
    const summe = nachtraege.reduce((s, n) => s + (n.betrag_kunde_netto || 0), 0);
    skript += `Du hast ${nachtraege.length} offene Nachträge mit einem Gesamtwert von ${formatCurrency(summe)}.\n\n`;
  }

  // Projekte ohne NUA
  if (ohneNUA.length > 0) {
    skript += `Bei ${ohneNUA.length} Projekten in Phase 2 fehlt noch die NU-Vergabe: `;
    ohneNUA.slice(0, 3).forEach(p => {
      skript += `${p.atbs_nummer}, `;
    });
    skript += '\n\n';
  }

  skript += `Das war dein Wochen-Briefing. Einen guten Start in die Woche!`;

  return skript.trim();
}
```

### 4.2 Tägliches Briefing Template

```typescript
function generateDailyBriefing(data: BriefingData): string {
  const { bauleiterName, termineHeute, maengel, nachtraege } = data;
  const today = formatDate(new Date());
  const weekday = formatWeekday(new Date());

  let skript = `
Guten Morgen ${bauleiterName}. Hier ist dein Tages-Briefing für ${weekday}, den ${today}.

`;

  // Termine heute
  if (termineHeute.length > 0) {
    skript += `Deine Termine heute: `;
    termineHeute.forEach(t => {
      skript += `${t.termin_art} bei ${t.atbs_nummer}${t.adresse ? ' in ' + t.adresse : ''}. `;
    });
    skript += '\n\n';
  } else {
    skript += `Heute stehen keine besonderen Termine an.\n\n`;
  }

  // Kritische Mängel
  if (maengel.length > 0) {
    const aeltester = maengel[0];
    skript += `Du hast ${maengel.length} überfällige Mängel. `;
    skript += `Der älteste ist bei ${aeltester.projekt_nr}, ${aeltester.art_des_mangels}, `;
    skript += `seit ${aeltester.tage_ueberfaellig} Tagen offen.\n\n`;
  }

  // Offene Nachträge (kurz)
  if (nachtraege.length > 0) {
    const summe = nachtraege.reduce((s, n) => s + (n.betrag_kunde_netto || 0), 0);
    skript += `Es gibt ${nachtraege.length} offene Nachträge mit insgesamt ${formatCurrency(summe)} Volumen.\n\n`;
  }

  skript += `Das war dein Tages-Briefing. Viel Erfolg heute!`;

  return skript.trim();
}
```

### 4.3 Beispiel-Ausgabe

**Montag-Briefing Beispiel:**

> Guten Morgen Dirk. Hier ist dein Wochen-Briefing für Montag, den 3. Februar 2026. Los geht's.
>
> Diese Woche hast du 8 aktive Projekte in Phase 3 und 4. 2 Projekte starten diese Woche. 1 Projekt soll fertiggestellt werden.
>
> Zu deinen Terminen diese Woche: Am Dienstag: Baustart bei ATBS-472. Am Mittwoch: Kundenabnahme bei ATBS-456. Am Freitag: Bauende bei ATBS-448, Erstbegehung bei ATBS-480.
>
> Achtung: Es gibt 5 überfällige Mängel, davon 2 kritisch über 7 Tage überfällig. Bei ATBS-456: Steckdose fehlt, 8 Tage offen. Bei ATBS-448: Fliese gesprungen, 5 Tage offen. Bei ATBS-450: Tür klemmt, 3 Tage offen.
>
> Du hast 7 offene Nachträge mit einem Gesamtwert von 4.200 Euro.
>
> Bei 3 Projekten in Phase 2 fehlt noch die NU-Vergabe: ATBS-478, ATBS-479, ATBS-481.
>
> Das war dein Wochen-Briefing. Einen guten Start in die Woche!

**Geschätzte Dauer:** ~3,5 Minuten bei normalem Sprechtempo

---

## 5. Entscheidungen (User-Feedback 2026-02-01)

| Frage | Entscheidung |
|-------|--------------|
| **Multi-Bauleiter** | ✅ Ja, von Anfang an multi-userfähig |
| **Bauleiter-Zuordnung** | Über `monday_bauprozess.bauleiter` → `kontakte.telegram_chat_id` |
| **Stimme** | **Nova** (weiblich, freundlich) |
| **Push-Zeitpunkt** | **06:00 Uhr** fix für alle |
| **On-Demand** | ✅ Zusätzlich `/briefing` Befehl im Bot |
| **Wetter** | ❌ Nicht benötigt |
| **Zahlungseingänge** | ❌ Nicht benötigt |
| **MS365 Kalender** | ✅ Ja, Termine mit aufnehmen |
| **Status-Changes** | ✅ Ja, "X Mängel gestern behoben" |
| **Text-Zusammenfassung** | ✅ Nur 3 Zeilen High-Level (Datum, Baustellen) |

### Architektur-Entscheidung

```
monday_bauprozess.bauleiter_email
         ↓
kontakte WHERE email = bauleiter_email
         ↓
kontakte.telegram_chat_id
         ↓
Audio-Briefing pushen (06:00 Uhr)
```

### MS365 Kalender-Integration

- Graph API: `/me/calendarview` für Termine
- OAuth über bestehenden MS365-Token
- Nur Termine des aktuellen Tages/der Woche

---

## 6. Nächste Schritte nach Freigabe

1. **Stimme festlegen** - Audio-Samples generieren und auswählen
2. **DB-Migration** - `audio_briefings` Tracking-Tabelle + Storage Bucket
3. **Edge Function** - `audio-briefing-generate` implementieren
4. **Telegram Integration** - sendAudio in bestehenden Bot einbinden
5. **Cron-Job** - Automatischen Schedule einrichten
6. **Test-Phase** - 1 Woche manuell testen, dann automatisieren

**Geschätzter Aufwand:** 2-3 Tage für MVP

---

## 7. Technische Abhängigkeiten

| Komponente | Status | Notwendig |
|------------|--------|-----------|
| OpenAI API Key | ✅ Vorhanden | Ja |
| Telegram Bot | ✅ v58 aktiv | Ja |
| Supabase Storage | ✅ Bucket erstellen | Ja |
| monday_bauprozess | ✅ 97 Spalten | Ja |
| maengel_fertigstellung | ✅ Vollständig | Ja |
| nachtraege | ✅ Vollständig | Ja |
| kontakte.telegram_chat_id | ✅ Vorhanden | Ja |

---

*Erstellt: 2026-02-01 | Konzept-Agent | neurealis ERP*
