# Telegram-Bot Roadmap

**Stand:** 2026-02-01
**Aktueller Stand:** v58 (Universelle Sprachbefehle)
**Bot:** @neurealis_bedarfsanalyse_bot

---

## Übersicht

| Phase | Titel | Status | Priorität |
|-------|-------|--------|-----------|
| 1 | Phasen-Filter & Projekt-Info | ✅ Fertig | - |
| 2 | Nachweise & Dokumente | ✅ Fertig | - |
| 3 | Termine & Sprach-Befehle | ✅ Fertig | - |
| 4 | Tages-Dashboard & Produktivität | ⏳ Geplant | 🔴 Hoch |
| 5 | NU-Anbindung | ⏳ Konzept | 🔴 Hoch |
| 6 | Admin & Berechtigungen | ⏳ Geplant | 🟡 Mittel |
| 7 | Kunden-Portal | 📋 Backlog | 🟢 Niedrig |

---

## ✅ Phase 1-3: Abgeschlossen (v51-v58)

### Implementierte Features

| Feature | Version | Status |
|---------|---------|--------|
| Phasen-Filter (0-4) | v51 | ✅ |
| ATBS-Schnellzugriff | v51 | ✅ |
| Kompakte Projekt-Info | v54 | ✅ |
| Gewerk-Status-Tabelle | v54 | ✅ |
| Ausführungsarten-Tabelle | v52 | ✅ |
| Brandschutz-Nachweis | v52 | ✅ |
| Multi-Foto-Upload | v53 | ✅ |
| Abnahmeprotokolle (NU/Kunde) | v53 | ✅ |
| Sprach-Befehle (Status, Termine) | v55 | ✅ |
| Befehle ohne offenes Projekt | v58 | ✅ |
| Erweiterte Datum-Formate | v58 | ✅ |
| GEWERK_ALIASES | v58 | ✅ |

---

## ⏳ Phase 4: Tages-Dashboard & Produktivität

**Priorität:** 🔴 Hoch
**Geschätzter Aufwand:** 3-5 Tage

### 4.1 Tages-Dashboard

**Beschreibung:** Beim `/start` zeigt der Bot eine Übersicht der anstehenden Aufgaben.

**Mockup:**
```
📅 Guten Morgen, Holger!

━━━ HEUTE (01.02.2026) ━━━

🚨 ÜBERFÄLLIGE MÄNGEL (3):
• ATBS-456: Steckdose fehlt (3 Tage)
• ATBS-448: Tür klemmt (5 Tage)
• ATBS-450: Fliese gerissen (2 Tage)

📅 TERMINE HEUTE:
• 09:00 ATBS-456 - NU-Termin Elektriker
• 14:00 ATBS-455 - Kundenabnahme
• 16:00 ATBS-460 - Erstbegehung

📋 OFFENE NACHTRÄGE: 7 (4.200€ netto)

━━━━━━━━━━━━━━━━━━━━━━━━━━

[🏗️ Baustelle öffnen] [📋 Alle Mängel]
```

**Datenquellen:**
- Mängel: `maengel_fertigstellung` WHERE `datum_frist < TODAY` AND `status_mangel != 'Abgenommen'`
- Termine: `monday_bauprozess` (baustart, bauende, datum_erstbegehung, etc.)
- Nachträge: `nachtraege` WHERE `status IN ('Gemeldet', 'In Prüfung')`

**Klärungsbedarf:**
- [ ] Nur Projekte des eingeloggten Bauleiters? (kontakte.telegram_chat_id → bauleiter)
- [ ] Termine aus Monday-Spalten oder separater Kalender?

---

### 4.2 Nummerierung Mängel & Nachträge

**Problem:** Aktuell fehlt konsistente Nummerierung

**Gewünschtes Format:**
| Typ | Format | Beispiel |
|-----|--------|----------|
| Mängel | `ATBS-{nr}-M{seq}` | ATBS-456-M1, ATBS-456-M2 |
| Nachträge | `ATBS-{nr}-N{seq}` | ATBS-456-N1, ATBS-456-N2 |

**Implementierung:**
```typescript
// Mängel-Nummer generieren
const { count } = await supabase
  .from('maengel_fertigstellung')
  .select('*', { count: 'exact', head: true })
  .eq('projekt_nr', `ATBS-${atbs}`);
const mangelNr = `ATBS-${atbs}-M${(count || 0) + 1}`;

// Nachtrag-Nummer generieren (FIX: NT- → ATBS-)
const nachtragNr = `ATBS-${atbs}-N${(count || 0) + 1}`;
```

**Betroffene Dateien:**
- `functions/supabase/functions/telegram-webhook/index.ts` (Zeile ~2390, ~2582)

---

### 4.3 Baustellenbegehungsberichte

**Beschreibung:** Langtext per Sprache/Text eingeben → als Dokument speichern

**Workflow:**
1. User: "Bericht für 456: Heute mit Elektriker vor Ort. Rohinstallation zu 80% fertig. Schlitze im Bad noch offen. Nächste Woche Sanitär geplant."
2. Bot extrahiert: Datum, Projekt, Inhalt
3. Bot speichert in `dokumente` mit Typ `BERICHT`
4. Bot bestätigt: "✅ Begehungsbericht gespeichert"

**Datenstruktur:**
```sql
INSERT INTO dokumente (
  projekt_nr,
  dokumenttyp,
  titel,
  raw_text,
  erstellt_am,
  erstellt_von
) VALUES (
  'ATBS-456',
  'BERICHT',
  'Baustellenbegehung 01.02.2026',
  'Heute mit Elektriker vor Ort...',
  NOW(),
  'holger.neumann@neurealis.de'
);
```

**Klärungsbedarf:**
- [ ] GPT-Strukturierung? (Wetter, Anwesende, Nächste Schritte extrahieren)
- [ ] PDF-Export gewünscht?

---

### 4.4 Schnell-Nachricht an NU

**Beschreibung:** Vordefinierte Nachrichten direkt aus Bot an NU senden

**Implementierung (Phase 4):**
- Telegram-Deeplink zu NU (wenn NU Telegram hat)
- Fallback: WhatsApp-Deeplink

**Mockup:**
```
📨 Nachricht an NU senden:

[📅 Termin verschieben]
[🚚 Material morgen]
[⚠️ Bitte anrufen]
[✏️ Eigene Nachricht]
```

**Spätere Phase:** Direkte Nachricht über Bot (wenn NU angebunden)

---

### 4.5 Projekt-Favoriten

**Beschreibung:** Top 3 aktive Projekte als Quick-Buttons im Hauptmenü

**Logik:** Projekte sortiert nach:
1. Letzte Aktivität (Mangel/Nachtrag/Status)
2. Phase 3-4 (Vorbereitung/Umsetzung) priorisiert

**Mockup:**
```
🏠 Hauptmenü

⭐ FAVORITEN:
[ATBS-456 Bollwerkstr.] [ATBS-448 Kleinweg] [ATBS-460 Hauptstr.]

━━━━━━━━━━━━━━━━━━━━━

[📐 Aufmaß] [📝 Bedarfsanalyse] [🏗️ Baustelle öffnen]
```

---

## ⏳ Phase 5: NU-Anbindung

**Priorität:** 🔴 Hoch
**Geschätzter Aufwand:** 5-7 Tage
**Separates Konzept:** `docs/NU_ANBINDUNG_KONZEPT.md`

### Übersicht

| Feature | Beschreibung |
|---------|--------------|
| NU-Authentifizierung | Telefonnummer aus `kontakte` → Chat-ID |
| Mängel-Benachrichtigung | Push bei neuem Mangel für NU |
| Mangel-Fotos | NU kann Fotos zu seinen Mängeln hochladen |
| Nachweis-Erinnerung | Bot erinnert an fehlende Nachweise |
| Nachweis-Upload | NU lädt Nachweise direkt hoch |
| Nachtrag-Anfrage | NU kann Nachträge anfordern (nicht selbst erstellen) |

---

## ⏳ Phase 6: Admin & Berechtigungen

**Priorität:** 🟡 Mittel
**Geschätzter Aufwand:** 3-5 Tage
**Separates Konzept:** `docs/ADMIN_BERECHTIGUNGEN_KONZEPT.md`

### Übersicht

| Feature | Beschreibung |
|---------|--------------|
| Admin-Dashboard | UI unter `/admin` im ERP |
| Nutzer-Verwaltung | Alle MS365-Adressen als Nutzer |
| Rollen-Zuweisung | Admin, Bauleiter, Buchhaltung, Sachbearbeiter |
| CRUD-Matrix | Lesen/Schreiben/Löschen pro Kategorie |
| Freischaltung | Nutzer aktivieren/deaktivieren |

---

## 📋 Phase 7: Kunden-Portal (Backlog)

**Priorität:** 🟢 Niedrig
**Status:** Konzept später

### Geplante Features

- Separater Telegram-Zugang für Kunden
- Baufortschritts-Updates (automatisch)
- Termin-Erinnerungen (Einzug, Abnahme)
- Mängel nach Einzug melden
- Fotos vom Baufortschritt ansehen

---

## 📋 Backlog (Später)

| Feature | Beschreibung | Priorität |
|---------|--------------|-----------|
| Erinnerungen per Sprache | "Erinnere mich morgen an X" | 🟡 |
| Checklisten | Baustart-Checkliste, Vor-Abnahme | 🟡 |
| Aufmaß-Schnellerfassung | "3,5 x 4,2 fliesen" → Nachtrag | 🟡 |
| Material-Bestellung | Direkt an Einkauf melden | 🟢 |
| Wetterwarnungen | Bei Außenarbeiten warnen | 🟢 |
| Übergabe-Protokoll | Geführter Dialog → PDF | 🟢 |
| Tagesbericht | Fotos/Mängel des Tages als PDF | 🟢 |
| Voice-to-Tagesbericht | Lange Sprachnachricht → Bericht | 🟢 |

---

## Klärungsfragen (Offen)

### Nummerierung
- [ ] Format `ATBS-456-M1` oder `456-M1`?

### Tages-Dashboard
- [ ] Nur eigene Projekte oder alle?
- [ ] Termine aus Monday oder Kalender?

### Baustellenberichte
- [ ] GPT-Strukturierung gewünscht?
- [ ] PDF-Export?

### NU-Anbindung
- [ ] Gleicher Bot oder separate Gruppen?
- [ ] Authentifizierung über Telefonnummer?
- [ ] Darf NU Nachträge erstellen oder nur anfordern?

### Admin-Section
- [ ] Welche Rollen genau?
- [ ] Welche Kategorien für CRUD?

---

*Erstellt: 2026-02-01*
