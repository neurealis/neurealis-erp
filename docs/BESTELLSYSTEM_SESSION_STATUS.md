# Bestellsystem - Session Status

**Stand:** 2026-01-26 11:30 Uhr
**Nächster Schritt:** Implementierung Phase I

---

## Erledigte Aufgaben dieser Session

### 1. Projekt-Reorganisation ✅

Neue Verzeichnisstruktur erstellt:
```
C:\Users\holge\
├── CLAUDE.md              # Global (Präferenzen)
├── .mcp.json              # Nur Playwright
├── lifeops\               # LifeOps Workspace (Supabase: rlqkhsgulyyozhetlrqy)
└── neurealis-erp\         # neurealis ERP Workspace (Supabase: mfpuijttdgkllnvhvjlu)
```

### 2. Bestellsystem-Dokumentation ✅

Vollständige Dokumentation erstellt: `docs/NEUREALIS_BESTELLSYSTEM.md`

### 3. Mockup erstellt ✅

- HTML: `mockup-bestellformular.html`
- Screenshot: `C:\Users\holge\.playwright-mcp\bestellformular-mockup.png`

---

## Getroffene Entscheidungen

### APIs & Services

| Service | Entscheidung |
|---------|--------------|
| **OpenAI** | Gemeinsam für beide Projekte |
| **Mistral** | Gemeinsam für beide Projekte |
| **Supabase** | Getrennt (LifeOps / neurealis ERP) |
| **Google Cloud** | Getrennte Accounts (gmail.de / neurealis.de) |
| **Microsoft 365** | Ein Account, Ordner-Trennung |
| **Telegram** | Separate Bots pro Projekt |
| **Kontist** | Nur LifeOps |
| **Monday.com** | Nur neurealis ERP |
| **Softr.io** | Nur neurealis ERP |
| **Hero Software** | Nur neurealis ERP |

### Bestellsystem-Konfiguration

| Thema | Entscheidung |
|-------|--------------|
| **Besteller** | Bauleiter, Mitarbeiter, perspektivisch NU |
| **E-Mail Absender** | kontakt@neurealis.de |
| **E-Mail Format** | HTML-Tabelle im Body (Phase I) |
| **Freigabe** | Nach Rolle (NU immer, Mitarbeiter ab 5.000€) |
| **Wareneingang** | Alle mit Zugang, responsive UI |
| **Telegram** | Bestehender Bot (Token nachreichen) |
| **Softr-Integration** | Eigene Bestellungen-Seite |
| **Rechnungsabgleich** | ATBS > Bestellnummer > Adresse > Betrag |

### Dokumententypen

| Typ | Beschreibung |
|-----|--------------|
| **BEST** | Bestellung (ausgehend) |
| **ER-M** | Eingangsrechnung Material |
| **ER-NU-M** | Eingangsrechnung NU Material (Abzug Schlussrechnung) |

---

## Bestellformular - Design-Entscheidungen

### UI-Struktur (4 Schritte)

1. **Projekt** - ATBS auswählen (Filter: Status 2,3,4)
2. **Lieferdetails** - Großhändler, Lieferort, Ansprechpartner, Datum+Uhrzeit
3. **Artikel** - KI-Spracheingabe + Artikelliste
4. **Bestätigung** - Zusammenfassung, Absenden

### Neue Features (2026-01-26)

| Feature | Beschreibung |
|---------|--------------|
| **📅 Kalender-Popup** | Datum per Kalender + Zeitfenster (08-10, 10-12, etc.) |
| **🎤 Multilingual Spracheingabe** | DE, HU, RU, MD (Rumänisch) |
| **✨ KI-Artikel-Erkennung** | Whisper + GPT für Artikel-Matching |
| **🟢 Auto-Fill** | 100%-Matches direkt eintragen |
| **🤔 Top-3 Vorschläge** | Bei unsicheren Matches → Auswahl-Popup |
| **💾 Lernen** | Zuordnungen pro User+Sprache speichern |

### Spracheingabe-Beispiele

| Sprache | Beispiel |
|---------|----------|
| 🇩🇪 DE | "Dreifachrahmen 10, Steckdosen 30" |
| 🇭🇺 HU | "Tíz hármas keret, harminc konnektor" |
| 🇷🇺 RU | "Десять тройных рамок, тридцать розеток" |
| 🇲🇩 MD | "Zece rame triple, treizeci prize" |

### URL-Parameter für Vorausfüllung

```
https://neurealis-erp.netlify.app/bestellung/neu
  ?atbs=ATBS-450
  &user=holger.neumann@neurealis.de
  &supplier=GUT
```

### Artikel-Anzeige

- **Kurzname** im Formular (z.B. "Dreifachrahmen")
- **Volle Bezeichnung** nur im Backend
- Gefiltert nach: Großhändler + Auftraggeber (Kunde)

### Wareneingang

- Responsive Checklist auf Smartphone
- Pro Artikel: ✅ Geliefert / ❌ Fehlt / 🔢 Teilmenge
- Automatisches Feedback bei ungeplanter Fehlmenge

---

## Datenbank-Schema (zu erstellen)

### Tabellen

1. `suppliers` - Großhändler mit E-Mail-Domains
2. `order_articles` - Bestellartikel mit Kurznamen, EK, Aufschlag
3. `orders` - Bestellungen mit Status 0-7
4. `order_items` - Bestellpositionen mit Teillieferungs-Tracking
5. `voice_article_mappings` - Sprach-Zuordnungen (User+Sprache → Artikel)

### Großhändler (Initial)

| Kurzname | Name | Sortiment |
|----------|------|-----------|
| GUT | G.U.T. Glaser | SHK |
| ZANDER | Zander | Elektro, SHK |
| MEG | MEG Gruppe | Maler |
| KERAMUNDO | Keramundo | Fliesen |
| RAAB | Raab Karcher | Trockenbau |
| BAUPARTE | Bauparte | Türen |
| BUEDEKER | Büdeker & Richert | Fenster, Rollos |
| PROSOL | Prosol | Sockelleisten, Farben |

---

## Implementierungs-Phasen

### Phase I - MVP (als nächstes)

- [ ] Supabase: Tabellen erstellen
- [ ] Großhändler aus Monday.com importieren
- [ ] Netlify: Neues Projekt `neurealis-erp`
- [ ] Auth: Login mit @neurealis.de
- [ ] UI: Bestellformular (responsive)
- [ ] E-Mail: Bestellung versenden (Graph API)

### Phase II - Wareneingang

- [ ] Checklist UI
- [ ] Teillieferungen
- [ ] Reklamations-E-Mail

### Phase III - Rechnungsabgleich

- [ ] Graph API Eingang
- [ ] Auto-Erkennung via E-Mail-Domain
- [ ] Verknüpfung Rechnung ↔ Bestellung

### Phase IV - Erweiterungen

- [ ] Telegram
- [ ] Lager
- [ ] Allgemeine Bestellungen

---

## Offene Punkte

1. **Telegram Bot Token** - Nachreichen
2. **Monday.com Import** - Großhändler-Daten holen
3. **Artikellisten** - Aus OneDrive importieren
4. **E-Mail-Domains** - Für jeden Großhändler verifizieren

---

## Nächster Chat - Anweisung

```bash
cd C:\Users\holge\neurealis-erp
claude
```

Dann sagen:
> "Lies docs/BESTELLSYSTEM_SESSION_STATUS.md und docs/NEUREALIS_BESTELLSYSTEM.md.
> Implementiere Phase I - starte mit den Datenbank-Tabellen."

---

*Gespeichert am 2026-01-26*
