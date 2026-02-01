# NU-Anbindung per Telegram - Konzept

**Stand:** 2026-02-01
**Status:** Konzept
**Priorität:** 🔴 Hoch

---

## Ziel

Nachunternehmer (NU) über Telegram an das neurealis-System anbinden, um:
1. WhatsApp-Gruppen-Chaos zu beenden
2. Kommunikation zu zentralisieren und dokumentieren
3. Automatische Benachrichtigungen zu ermöglichen
4. Nachweise digital einzusammeln

---

## Aktuelle Situation

| Kanal | Problem |
|-------|---------|
| WhatsApp-Gruppen | Unstrukturiert, nicht durchsuchbar, DSGVO-kritisch |
| Telefon | Keine Dokumentation |
| E-Mail | Langsam, wird übersehen |

**Ziel:** Telegram als zentraler Kommunikationskanal

---

## Architektur

### Option A: Ein Bot für alle (Empfohlen)

```
┌─────────────────────────────────────────────────┐
│           @neurealis_bedarfsanalyse_bot          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Bauleiter (BL)          Nachunternehmer (NU)   │
│  ┌─────────────┐         ┌─────────────┐        │
│  │ Alle        │         │ Nur eigene  │        │
│  │ Projekte    │         │ Projekte    │        │
│  │ Alle        │         │ Nur eigene  │        │
│  │ Features    │         │ Mängel      │        │
│  └─────────────┘         └─────────────┘        │
│                                                 │
│  Authentifizierung: telegram_chat_id → kontakte │
└─────────────────────────────────────────────────┘
```

**Vorteile:**
- Ein Bot, weniger Wartung
- Einheitliche Code-Basis
- Einfache Erweiterung

**Nachteile:**
- Komplexere Berechtigungslogik

### Option B: Separate Gruppen pro Projekt

```
┌─────────────────────────────────────────────────┐
│  Projekt ATBS-456                               │
│  ┌─────────────────────────────────────────┐    │
│  │ Telegram-Gruppe: "ATBS-456 Bollwerkstr" │    │
│  │ Members: BL + NU Elektrik + NU Sanitär  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Projekt ATBS-448                               │
│  ┌─────────────────────────────────────────┐    │
│  │ Telegram-Gruppe: "ATBS-448 Kleinweg"    │    │
│  │ Members: BL + NU Maler + NU Boden       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Vorteile:**
- Klare Trennung pro Projekt
- NU sieht nur sein Projekt

**Nachteile:**
- Viele Gruppen verwalten
- Bot muss Gruppen-Admin sein
- Komplexere Gruppen-Erstellung

### Empfehlung: Option A mit projekt-basierter Filterung

---

## Datenmodell

### Kontakte-Tabelle (erweitert)

```sql
ALTER TABLE kontakte ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE kontakte ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE kontakte ADD COLUMN IF NOT EXISTS telegram_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakte ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMPTZ;
```

### NU-Projekt-Zuordnung

Die Zuordnung NU → Projekt existiert bereits über:
- `monday_bauprozess.nachunternehmer` (Name des NU)
- `kontakte.firma` (Firmenname)

**Mapping-Logik:**
```sql
SELECT DISTINCT mb.atbs_nummer, mb.name as projekt
FROM monday_bauprozess mb
JOIN kontakte k ON mb.nachunternehmer ILIKE '%' || k.firma || '%'
WHERE k.telegram_chat_id = {chat_id}
  AND k.kontakt_typ = 'NU';
```

---

## Authentifizierung

### Onboarding-Flow

```
1. NU öffnet Bot, tippt /start
   ↓
2. Bot: "Willkommen! Bitte gib deine Telefonnummer ein
         (Format: +49...)"
   ↓
3. NU gibt Nummer ein: +49 151 12345678
   ↓
4. Bot sucht in kontakte WHERE telefon = '+4915112345678'
   ↓
5a. GEFUNDEN + kontakt_typ = 'NU':
    → Bot speichert telegram_chat_id
    → "✅ Du bist jetzt verbunden! Deine Projekte: ..."

5b. NICHT GEFUNDEN:
    → "❌ Nummer nicht bekannt. Bitte kontaktiere neurealis."
```

### Sicherheit

- **Telefon-Verifikation:** NU muss seine registrierte Nummer eingeben
- **Admin-Freischaltung:** Optional: BL muss NU freischalten
- **Rate-Limiting:** Max. 3 Versuche pro Stunde

---

## NU-Features

### 1. Meine Projekte anzeigen

**Trigger:** `/start` oder "🏗️ Meine Baustellen"

**Ausgabe:**
```
🏗️ Deine Baustellen:

ATBS-456 | Bollwerkstraße 9
  Phase: (4) Umsetzung
  Offene Mängel: 2
  [Öffnen]

ATBS-460 | Hauptstraße 15
  Phase: (3) Vorbereitung
  Offene Mängel: 0
  [Öffnen]
```

### 2. Mängel-Benachrichtigung (Push)

**Trigger:** Neuer Mangel wird erstellt mit `art_des_mangels` = Gewerk des NU

**Nachricht an NU:**
```
🔧 NEUER MANGEL für dich:

Projekt: ATBS-456 Bollwerkstraße 9
Mangel-Nr: ATBS-456-M3
Beschreibung: Steckdose Wohnzimmer locker

Frist: 04.02.2026 (in 3 Tagen)

[📸 Foto hochladen] [✅ Als erledigt melden]
```

**Implementierung:**
- Trigger auf `maengel_fertigstellung` INSERT
- Lookup: Welcher NU ist für dieses Gewerk bei diesem Projekt zuständig?
- Push via Telegram Bot API

### 3. Mangel-Fotos hochladen

**Trigger:** NU wählt Mangel und sendet Foto

**Flow:**
```
1. NU: [Projekt öffnen] → [Meine Mängel] → [ATBS-456-M3]
2. Bot: "📸 Sende ein Foto als Nachweis"
3. NU sendet Foto
4. Bot speichert in fotos_nachweis_nu
5. Bot: "✅ Foto gespeichert. Bauleiter wird benachrichtigt."
6. Push an BL: "NU hat Foto zu ATBS-456-M3 hochgeladen"
```

### 4. Nachweis-Erinnerung

**Trigger:** Cron-Job (täglich 08:00)

**Logik:**
```sql
SELECT DISTINCT k.telegram_chat_id, mb.atbs_nummer, mb.name
FROM monday_bauprozess mb
JOIN kontakte k ON mb.nachunternehmer ILIKE '%' || k.firma || '%'
WHERE k.kontakt_typ = 'NU'
  AND k.telegram_chat_id IS NOT NULL
  AND (
    -- Rohinstallation Elektrik fehlt
    (mb.ausfuehrung_elektrik = 'Komplett'
     AND NOT EXISTS (SELECT 1 FROM dokumente WHERE projekt_nr = mb.atbs_nummer AND dokumenttyp = 'NACHWEIS-ELEKT'))
    OR
    -- Abdichtung Bad fehlt
    (mb.ausfuehrung_bad ILIKE '%Komplett%'
     AND NOT EXISTS (SELECT 1 FROM dokumente WHERE projekt_nr = mb.atbs_nummer AND dokumenttyp = 'NACHWEIS-ABDICHT'))
  );
```

**Nachricht:**
```
⚠️ NACHWEIS ERFORDERLICH

Projekt: ATBS-456 Bollwerkstraße 9

Fehlende Nachweise:
• Rohinstallation Elektrik
• Abdichtung Bad

Bitte lade die Fotos hier hoch.

[📸 Nachweis hochladen]
```

### 5. Nachweis-Upload

**Flow:**
```
1. NU: [Nachweis hochladen]
2. Bot: "Welchen Nachweis möchtest du hochladen?"
   [⚡ Rohinstallation Elektrik]
   [🚿 Rohinstallation Sanitär]
   [💧 Abdichtung Bad]
   [✅ E-Check Protokoll]
3. NU wählt Typ
4. Bot: "📸 Sende das Foto"
5. NU sendet Foto
6. Bot speichert in dokumente mit Typ
7. Bot: "✅ Nachweis gespeichert!"
8. Push an BL: "NU hat Nachweis hochgeladen: Rohinstallation Elektrik"
```

### 6. Nachtrag-Anfrage (nicht selbst erstellen)

**Wichtig:** NU kann Nachträge nur **anfordern**, nicht selbst erstellen.

**Flow:**
```
1. NU: "Nachtrag anfordern"
2. Bot: "Beschreibe den Nachtrag:"
3. NU: "Zusätzliche Steckdose im Flur gewünscht"
4. Bot speichert als Nachtrag mit status = 'Angefragt (NU)'
5. Bot: "✅ Nachtrag-Anfrage gesendet. Bauleiter prüft."
6. Push an BL: "NU hat Nachtrag angefragt für ATBS-456"
7. BL kann: [✅ Genehmigen] [❌ Ablehnen]
```

---

## Bauleiter-Sicht (Ergänzungen)

### Push bei NU-Aktivität

| Event | Push an BL |
|-------|------------|
| NU lädt Mangel-Foto hoch | "📸 NU hat Foto zu ATBS-456-M3 hochgeladen" |
| NU lädt Nachweis hoch | "✅ Nachweis Rohinstallation Elektrik für ATBS-456" |
| NU fragt Nachtrag an | "📋 Nachtrag-Anfrage von NU für ATBS-456" |

### Schnell-Nachricht an NU

**Aus Projekt-Menü:**
```
📨 Nachricht an NU senden:

Nachunternehmer: Elektro Müller GmbH
Projekt: ATBS-456

[📅 Termin verschieben]
[🚚 Material morgen geliefert]
[⚠️ Bitte dringend anrufen]
[✏️ Eigene Nachricht]
```

**Bei "Eigene Nachricht":**
```
1. BL tippt: "Bitte morgen 8 Uhr vor Ort sein"
2. Bot sendet an NU:
   "📨 Nachricht vom Bauleiter (ATBS-456):
    Bitte morgen 8 Uhr vor Ort sein"
```

---

## Mitarbeiter-Typ (eingeschränkt)

### Definition

`kontakte.kontakt_typ = 'Mitarbeiter'` (Handwerker, nicht NU-Chef)

### Eingeschränkte Rechte

| Feature | NU-Chef | Mitarbeiter |
|---------|---------|-------------|
| Projekte sehen | ✅ | ✅ |
| Mängel sehen | ✅ | ✅ |
| Mangel-Fotos hochladen | ✅ | ✅ |
| Nachweise hochladen | ✅ | ✅ |
| Nachtrag anfordern | ✅ | ❌ |
| Nachrichten an BL | ✅ | ❌ |

---

## Baustellenchat (Konzept für später)

### Idee

Pro Projekt ein Gruppen-Chat mit:
- Bauleiter
- Alle NUs des Projekts
- Optional: Kunde (separater Chat)

### Technische Umsetzung

**Option 1: Telegram-Gruppen**
- Bot erstellt Gruppe automatisch
- Bot ist Admin
- Alle Nachrichten werden geloggt

**Option 2: Chat im Bot simulieren**
- Nachrichten werden intern geroutet
- Keine echte Telegram-Gruppe
- Volle Kontrolle über Inhalte

### Automatische Antworten

| Frage | Auto-Antwort |
|-------|--------------|
| "Wann ist Baustart?" | "Baustart ist am {baustart}." |
| "Welche Nachweise fehlen?" | "Fehlende Nachweise: {liste}" |
| "Wo ist das Projekt?" | "Adresse: {adresse} [📍 Google Maps]" |

### Entscheidung: Später (Phase 7)

---

## Implementierungs-Reihenfolge

### Phase 5a: Basis (2-3 Tage)

1. **NU-Onboarding** (Telefon-Verifikation)
2. **Meine Projekte** (Filterung nach NU)
3. **Mängel anzeigen** (nur eigene Gewerke)

### Phase 5b: Interaktion (2-3 Tage)

4. **Mangel-Fotos hochladen**
5. **Nachweis-Upload** (5 Typen)
6. **Push-Benachrichtigungen** (neue Mängel)

### Phase 5c: Kommunikation (2 Tage)

7. **Nachtrag-Anfrage** (nicht erstellen)
8. **Schnell-Nachrichten** (BL → NU)
9. **Nachweis-Erinnerungen** (Cron)

---

## Sicherheit & DSGVO

### Datenschutz

- Telegram-Chat-ID wird in `kontakte` gespeichert
- Nur verifizierte NUs bekommen Zugang
- Alle Nachrichten werden geloggt (nachvollziehbar)
- Löschrecht: NU kann Chat-ID löschen lassen

### Einwilligung

Bei Onboarding:
```
"Mit der Nutzung stimmst du zu, dass deine Nachrichten
gespeichert und für die Projektdokumentation verwendet werden.
[✅ Akzeptieren] [❌ Ablehnen]"
```

---

## Offene Fragen

- [ ] Gleicher Bot oder separate Gruppen pro Projekt?
- [ ] Authentifizierung nur über Telefonnummer?
- [ ] Admin-Freischaltung erforderlich?
- [ ] Darf NU Nachträge erstellen oder nur anfordern?
- [ ] Baustellenchat jetzt oder später?

---

*Erstellt: 2026-02-01*
