# Konzept: Universelle Spracheingabe Telegram-Bot

**Version:** 1.0
**Datum:** 2026-02-03
**Status:** Genehmigt

---

## 1. Vision

Ein Telegram-Bot der wie ein intelligenter Baustellenassistent funktioniert:
**Ein Satz = komplette Aktion** - ohne Menü-Navigation.

```
"Mangel 456 Steckdose locker im Bad"
→ Projekt ATBS-456 öffnen + Mangel erfassen + Gewerk Elektrik + Speichern
→ Alles in < 3 Sekunden
```

---

## 2. Entscheidungen (User-Input)

| Aspekt | Entscheidung | Begründung |
|--------|--------------|------------|
| **Antwort-Sprache** | Deutsch (Multi-Language vorbereitet) | Später RU/HU/RO/PL ergänzen |
| **Bestätigung** | NIE | Maximale Geschwindigkeit, Korrektur nachträglich |
| **Fotos** | Optional, starke Empfehlung | Kein Blocker, aber Aufforderung |
| **Projekt-Scope** | One-Shot Commands | "Mangel 456: ..." funktioniert direkt |

---

## 3. Intent-Taxonomie

| Intent | Trigger-Wörter | Beispiel |
|--------|----------------|----------|
| `MANGEL_MELDEN` | mangel, defekt, kaputt, fehler, problem | "Mangel 456 Steckdose locker" |
| `NACHTRAG_ERFASSEN` | nachtrag, zusätzlich, extra, mehr, dazu | "Nachtrag 456: 2 Heizkörper" |
| `NACHWEIS_HOCHLADEN` | nachweis, e-check, abdichtung, rohr | "E-Check für 456" + Foto |
| `PROJEKT_OEFFNEN` | öffne, zeige, status, gehe zu | "Öffne Werner Hellweg" |
| `LISTE_MAENGEL` | mängel, offene mängel | "Meine offenen Mängel" |
| `LISTE_NACHTRAEGE` | nachträge, offene nachträge | "Offene Nachträge" |
| `FOTO_HINZUFUEGEN` | foto zu, bild für | (Foto ohne Text + Kontext) |
| `KORREKTUR` | nein, falsch, korrigiere, ändere | "nein, im Bad nicht Flur" |
| `ABBRECHEN` | abbrechen, stopp, zurück | "abbrechen" |

---

## 4. Entity-Extraction

### Projekt-Identifikation

| Pattern | Beispiel | Matching |
|---------|----------|----------|
| ATBS-XXX | "ATBS-456" | Exakt |
| nur Nummer | "456", "Projekt 456" | `ATBS-{nummer}` |
| Adresse | "Werner Hellweg", "Bollwerkstraße" | Fuzzy DB-Suche |
| Projektname | "Mustermann Sanierung" | Fuzzy DB-Suche |

### Gewerk-Erkennung

| Keywords | Gewerk |
|----------|--------|
| steckdose, lichtschalter, kabel, strom | Elektrik |
| wc, dusche, waschbecken, rohr, wasser, tropft | Sanitär |
| farbe, anstrich, tapete, weiß | Maler |
| fliese, boden, vinyl, parkett | Boden/Fliesen |
| tür, zarge, schloss, klinke | Türen |
| fenster, rolladen, glas | Fenster |
| heizung, therme, heizkörper, warm | Heizung |
| wand, decke, gipskarton, rigips, riss | Trockenbau |

### Raum-Erkennung

| Keywords | Raum |
|----------|------|
| bad, badezimmer, dusche, wc | Bad |
| küche | Küche |
| flur, diele, eingang | Flur |
| wohnzimmer, wohnen | Wohnzimmer |
| schlafzimmer, schlafen | Schlafzimmer |
| keller | Keller |
| balkon, terrasse | Außen |

---

## 5. Action-Flow

```
┌─────────────────────────────────────────────────────────┐
│  USER INPUT (Text / Voice / Foto)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PRE-PROCESSING                                          │
│  • Voice → Whisper Transkription                        │
│  • Session laden (aktuelles Projekt, letzte Aktion)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  INTENT DETECTION (GPT-5.2)                              │
│  Input: Text + Session-Kontext                          │
│  Output: Intent, Projekt, Entities, Sprache             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PROJEKT RESOLUTION                                      │
│  • Aus Text extrahiert? → DB-Lookup                     │
│  • Projekt in Session? → Verwenden                      │
│  • Kein Projekt? → Nachfragen                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  ACTION EXECUTION (OHNE Bestätigung)                    │
│  • Mangel → DB speichern → Erfolg melden                │
│  • Nachtrag → LV-Matching → DB speichern → Erfolg       │
│  • Nachweis → Storage + DB → Erfolg                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  RESPONSE + SESSION UPDATE                               │
│  • Erfolgsbestätigung (kompakt)                         │
│  • Inline-Buttons für Folgeaktionen                     │
│  • Session: letzte_aktion, projekt speichern            │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Session-Erweiterung

```typescript
interface ExtendedSession {
  // Bestehend
  chat_id: number;
  aktueller_modus: string | null;
  aktuelles_bv_id: string | null;
  modus_daten: Record<string, any>;

  // NEU: Kontext für Folge-Eingaben
  letzte_aktion?: {
    typ: 'mangel' | 'nachtrag' | 'nachweis' | 'status';
    id?: string;           // z.B. "ATBS-456-M12"
    projekt_nr?: string;
    timestamp: Date;
  };

  // NEU: Projekt-Memory (letzte 5)
  projekt_historie?: Array<{
    atbs: string;
    name?: string;
    timestamp: Date;
  }>;

  // NEU: Erkannte Sprache (für Multi-Language später)
  user_sprache?: 'DE' | 'RU' | 'HU' | 'RO' | 'PL';

  // NEU: Pending Foto (wenn Foto ohne Text gesendet)
  pending_foto?: {
    file_id: string;
    timestamp: Date;
  };
}
```

---

## 7. Kontext-Awareness

### Folge-Eingaben erkennen

| Trigger | Bedeutung | Aktion |
|---------|-----------|--------|
| "noch einer", "auch noch", "und" | Folge-Mangel/Nachtrag | Gleiches Projekt |
| "nein, im Bad" | Korrektur letzte Aktion | Update Raum |
| "falsch, Sanitär" | Korrektur Gewerk | Update Gewerk |
| (Foto ohne Text) | Foto zur letzten Aktion | Zuordnen |

### Projekt-Kontext beibehalten

- Projekt bleibt offen bis:
  - User anderes Projekt öffnet
  - User explizit abschließt
  - 4h Inaktivität

- Bei neuer Eingabe ohne Projekt:
  - Erst in Text suchen
  - Dann Session-Projekt verwenden
  - Erst dann nachfragen

---

## 8. Antwort-Format (kompakt, keine Bestätigung)

### Mangel erfasst

```
✅ Mangel ATBS-456-M12 erfasst
📍 Bad | ⚡ Elektrik
Steckdose locker

[📷 Foto] [➕ Noch einer] [📊 Status]
```

### Nachtrag erfasst

```
✅ Nachtrag ATBS-456-N3 erfasst
🔧 Heizung | 2 Stk Heizkörper

📊 LV-Match (GWS):
• 2x Heizkörper bis 1m = 890,00€

[📷 Foto] [➕ Noch einer] [📊 Status]
```

### Korrektur

```
✏️ Korrigiert: ATBS-456-M12
📍 Bad → Küche

[👍 OK] [🔄 Weitere Änderung]
```

### Projekt nicht gefunden

```
❓ Projekt "Werner" nicht eindeutig.

Meintest du:
[ATBS-472 Werner Hellweg 9]
[ATBS-489 Werner-von-Siemens-Str]
[🔍 Neu suchen]
```

---

## 9. Multi-Language (vorbereitet)

### Template-Struktur

```typescript
const RESPONSES = {
  MANGEL_ERFASST: {
    DE: '✅ Mangel {nr} erfasst\n📍 {raum} | {gewerk_emoji} {gewerk}\n{beschreibung}',
    RU: '✅ Дефект {nr} зарегистрирован\n📍 {raum} | {gewerk_emoji} {gewerk}\n{beschreibung}',
    HU: '✅ Hiba {nr} rögzítve\n📍 {raum} | {gewerk_emoji} {gewerk}\n{beschreibung}',
    // RO, PL später ergänzen
  },
  FOTO_FRAGE: {
    DE: 'Möchtest du ein Foto hinzufügen?',
    RU: 'Хотите добавить фото?',
    HU: 'Szeretnél fényképet hozzáadni?',
  },
  // ... weitere
};

function t(key: string, lang: string, vars: Record<string, string>): string {
  const template = RESPONSES[key]?.[lang] || RESPONSES[key]?.['DE'] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}
```

### Sprach-Erkennung

GPT erkennt automatisch die Sprache aus der Eingabe und gibt sie im Intent-Response zurück.
Session speichert `user_sprache` für konsistente Antworten.

---

## 10. Implementierungs-Roadmap

### Phase 1: Intent-Detection (Priorität HOCH)
- [ ] `utils/intent_detection.ts` erstellen
- [ ] GPT-Prompt für Intent-Analyse
- [ ] Integration in `index.ts` vor Modus-Routing

### Phase 2: One-Shot Commands
- [ ] Projekt-Extraktion aus Text (`findProjektFromText()`)
- [ ] Mangel ohne Projekt-Vorauswahl
- [ ] Nachtrag ohne Projekt-Vorauswahl
- [ ] Session-Erweiterung (`letzte_aktion`, `projekt_historie`)

### Phase 3: Kontext-Awareness
- [ ] Folge-Eingaben erkennen ("noch einer")
- [ ] Korrektur-Flow ("nein, im Bad")
- [ ] Foto-Kontext (Foto ohne Text → letzte Aktion)

### Phase 4: Multi-Language Templates
- [ ] Response-Templates als Objekte
- [ ] `t()` Helper-Funktion
- [ ] DE-Texte migrieren
- [ ] (Später: RU, HU, RO, PL ergänzen)

---

## 11. Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `index.ts` | Intent-Detection vor Modus-Routing |
| `utils/intent_detection.ts` | NEU: GPT Intent-Analyse |
| `utils/session.ts` | Session-Schema erweitern |
| `utils/responses.ts` | NEU: Multi-Language Templates |
| `handlers/mangel.ts` | Projekt aus Intent statt Session |
| `handlers/nachtrag.ts` | Projekt aus Intent statt Session |
| `handlers/start.ts` | Projekt-Suche verbessern (Fuzzy) |

---

## 12. Test-Szenarien

| Input | Erwartete Aktion |
|-------|------------------|
| "Mangel 456 Steckdose locker Bad" | ATBS-456 → Mangel (Elektrik, Bad) |
| "Nachtrag Werner Hellweg: 2 Heizkörper Küche" | Projekt suchen → Nachtrag + LV-Match |
| "Öffne 472" | ATBS-472 öffnen |
| "noch ein Mangel: Riss Decke Flur" | Gleiches Projekt → Mangel (Trockenbau, Flur) |
| "nein, im Bad" | Korrektur: Raum → Bad |
| (Foto ohne Text, Mangel offen) | Foto zu letztem Mangel |
| "Status" (Projekt offen) | Status des offenen Projekts |
| "Status 456" | Status ATBS-456 |

---

*Erstellt: 2026-02-03*
