# neurealis ERP - Bestellsystem

**Stand:** 2026-01-26
**Status:** Phase I - MVP
**UI:** Netlify (neues Projekt, responsive, iframe-embedbar)

---

## Übersicht

Digitales Bestellsystem für Materialbestellungen bei Großhändlern im Rahmen von Wohnungssanierungen.

### Kernfunktionen

- Bestellungen pro Projekt (ATBS) erfassen
- Artikel nach Großhändler + Kunde filtern
- Automatischer E-Mail-Versand an Großhändler
- Freigabe-Workflow nach Rolle
- Wareneingang mit Checklist (Teillieferungen)
- Rechnungsabgleich (ER-M) mit Bestellungen
- Benachrichtigungen (E-Mail + Telegram)

---

## Dokumententypen

| Typ | Beschreibung | Verwendung |
|-----|--------------|------------|
| **BEST** | Bestellung | Ausgehende Bestellung an Großhändler |
| **ER-M** | Eingangsrechnung Material | Rechnung vom Großhändler für Material |
| **ER-NU-M** | Eingangsrechnung NU Material | Material für Nachunternehmer (wird von Schlussrechnung abgezogen) |

---

## Benutzerrollen & Authentifizierung

### Login

- **URL:** `https://neurealis-erp.netlify.app` (oder ähnlich)
- **Registrierung:** Nur @neurealis.de E-Mail-Adressen
- **Auto-Anlage:** Mitarbeiter aus Softr.io Kontakttabelle werden automatisch angelegt

### Rollen

| Rolle | Berechtigung | Freigabe erforderlich |
|-------|--------------|----------------------|
| **Bauleitung** | Alle Bestellungen | Nein |
| **Mitarbeiter** | Eigene Bestellungen | Ab 5.000 € |
| **Nachunternehmer** | Projekt-Bestellungen | Immer (durch Bauleitung) |

---

## Bestellformular (UI)

### URL-Parameter für Vorausfüllung

```
https://neurealis-erp.netlify.app/bestellung/neu
  ?atbs=ATBS-450
  &user=holger.neumann@neurealis.de
  &supplier=GUT
```

**Softr-Integration:** Formelfeld erzeugt URL mit Parametern → Button "Neue Bestellung"

### Schritt 1: Projekt auswählen

| Feld | Typ | Quelle | Filter |
|------|-----|--------|--------|
| **ATBS-Nr / Projekt** | Dropdown | `bauprozess` | Status = (2) Auftrag, (3) Vorbereitung, (4) Umsetzung |
| **Kunde** | Auto-Fill | Aus Projekt | `unternehmen_kurz` |

### Schritt 2: Lieferdetails

| Feld | Typ | Optionen |
|------|-----|----------|
| **Großhändler** | Dropdown | Aus `suppliers` Tabelle |
| **Lieferort** | Dropdown | Projektadresse / Lager (Kleyerweg 40, 44149 Dortmund) |
| **Ansprechpartner** | Dropdown | Mitarbeiter vor Ort / Tobias Rangohl (Lager) |
| **Lieferdatum & Uhrzeit** | Kalender-Popup | Datum + Zeitfenster wählen |

#### Kalender-Popup (Lieferdatum)

- **Kalender-Ansicht:** Monatsübersicht mit Navigation
- **Heute markiert:** Visuell hervorgehoben
- **Zeitfenster:** 08:00-10:00 / 10:00-12:00 / 12:00-14:00 / 14:00-16:00 / Ganztags
- **Anzeige:** "Di, 28. Januar 2026 • 08:00-10:00 Uhr"

### Schritt 3: Artikel auswählen

#### KI-Spracheingabe (Multilingual)

Bauarbeiter können Artikel per Sprache eingeben - in ihrer Muttersprache:

| Sprache | Code | Beispiel |
|---------|------|----------|
| **Deutsch** | DE | "Dreifachrahmen 10, Zweifachrahmen 15, Steckdosen 30" |
| **Ungarisch** | HU | "Tíz hármas keret, tizenöt kettes keret" |
| **Russisch** | RU | "Десять тройных рамок, пятнадцать двойных" |
| **Moldawisch/Rumänisch** | MD | "Zece rame triple, cincisprezece rame duble" |

**Ablauf:**
1. 🎙️ **Aufnahme-Button** drücken → Sprache aufnehmen
2. ✨ **KI-Erkennung** drücken → Artikel + Mengen erkennen
3. **100% Match** → Menge wird automatisch eingetragen (grün markiert)
4. **Unsicherer Match** → Popup mit Top-3 Vorschlägen

**Match-Popup bei unklaren Artikeln:**
```
🤔 Artikel zuordnen

Erkannter Text: "Wechselschalter"

Welcher Artikel ist gemeint? (Auswahl wird gespeichert)

┌─────────────────────────────────────────────────┐
│ Wechselschalter (Gira Standard 55)   [92% Match]│
├─────────────────────────────────────────────────┤
│ Kreuzschalter (Gira Standard 55)     [67% Match]│
├─────────────────────────────────────────────────┤
│ Serienschalter (Gira Standard 55)    [54% Match]│
└─────────────────────────────────────────────────┘

        [Überspringen (nicht bestellen)]
```

**Lernen & Speichern:**
- Zuordnungen werden pro Benutzer + Sprache gespeichert
- Beim nächsten Mal: Automatischer Match ohne Nachfrage
- Tabelle: `voice_article_mappings`

#### Artikel-Tabelle

| Feld | Beschreibung |
|------|--------------|
| **Artikelliste** | Gefiltert nach: Großhändler + Kunde (Auftraggeber) |
| **Anzeige** | **Kurzname** (z.B. "Dreifachrahmen", "Steckdose") - NICHT volle Artikelbezeichnung |
| **Menge** | Eingabefeld pro Artikel |
| **Summe** | Automatisch berechnet (EK + Aufschlag = Vollkosten) |
| **Grün markiert** | Automatisch via Spracheingabe ausgefüllt |
| **Orange markiert** | Unsicherer Match, wartet auf Bestätigung |

### Schritt 4: Bestätigung

- Voraussichtliche Lieferzeit anzeigen
- Lieferkosten anzeigen
- Bestellung absenden → Status "Entwurf" oder "Freigabe angefordert"

---

## Bestellstatus

| Status | Beschreibung | Nächster Schritt |
|--------|--------------|------------------|
| **(0) Entwurf** | Bestellung erstellt, nicht abgesendet | Absenden |
| **(1) Freigabe angefordert** | Wartet auf Bauleitung (bei NU/Schwellwert) | Freigeben/Ablehnen |
| **(2) Freigegeben** | Bauleitung hat genehmigt | Auto-E-Mail |
| **(3) Bestellt** | E-Mail an Großhändler gesendet | Warten auf Lieferung |
| **(4) Teillieferung** | Teile geliefert, Rest offen | Restlieferung tracken |
| **(5) Geliefert** | Vollständig geliefert | Abgeschlossen |
| **(6) Storniert** | Bestellung abgebrochen | - |
| **(7) Reklamation** | Problem mit Lieferung | Klärung |

---

## Wareneingang (Responsive UI)

### Ablauf

1. Mitarbeiter öffnet Bestellung auf Smartphone/Tablet
2. Checklist mit **Kurznamen** der Artikel (leicht lesbar)
3. Pro Artikel: ✅ Geliefert / ❌ Fehlt / 🔢 Teilmenge eingeben
4. Bei Fehlbestand:
   - **Geplante Teillieferung?** → Markieren, warten auf Rest
   - **Ungeplant?** → Automatisches Feedback an Großhändler
5. Lieferung bestätigen → Status wechselt

### Feedback an Großhändler

Bei ungeplanter Fehlmenge automatische E-Mail:
```
Betreff: [REKLAMATION] BEST-ATBS-450-001 - Fehlende Artikel

Folgende Artikel wurden nicht geliefert:
- 5x Dreifachrahmen (bestellt: 10, geliefert: 5)
- 2x Steckdose (bestellt: 20, geliefert: 18)

Bitte um Nachlieferung.
```

---

## E-Mail-Konfiguration

### Ausgehende Bestellungen

| Eigenschaft | Wert |
|-------------|------|
| **Absender** | kontakt@neurealis.de |
| **Betreff** | `[BESTELLUNG] BEST-ATBS-450-001 - neurealis GmbH` |
| **Format** | HTML-Tabelle im Body (kein PDF-Anhang in Phase I) |
| **API** | Microsoft Graph API |

### E-Mail-Inhalt

```html
Bestellung BEST-ATBS-450-001

Kundennummer: 12345
Lieferadresse: Musterstraße 1, 44149 Dortmund
Ansprechpartner: Max Mustermann (0123-456789)
Gewünschtes Lieferdatum: 28.01.2026
ATBS-Nr für Rechnung: ATBS-450

┌─────────────────┬────────┬─────────┬───────────┐
│ Artikel         │ Menge  │ Einheit │ EK netto  │
├─────────────────┼────────┼─────────┼───────────┤
│ Dreifachrahmen  │ 10     │ Stk     │ 45,00 €   │
│ Steckdose       │ 20     │ Stk     │ 24,00 €   │
│ ...             │        │         │           │
├─────────────────┼────────┼─────────┼───────────┤
│ Summe netto     │        │         │ 930,00 €  │
└─────────────────┴────────┴─────────┴───────────┘

Bitte ATBS-Nr ATBS-450 auf der Rechnung vermerken!
```

---

## Eingangsrechnungen & Abgleich

### E-Mail-Eingang (Graph API)

| Postfach | Verwendung |
|----------|------------|
| **kontakt@neurealis.de** | Zentraler Ein-/Ausgang für Klassifizierung |
| **rechnungen@neurealis.de** | Optional: Separates Rechnungspostfach |

### Auto-Erkennung Eingangsrechnung

1. E-Mail von bekannter Großhändler-Adresse empfangen
2. PDF-Anhang als Rechnung erkennen
3. Dokumententyp setzen: **ER-M** (Material)
4. ATBS aus Rechnung extrahieren → Projekt zuordnen

### Rechnungsabgleich (Priorität)

| Priorität | Methode | Beschreibung |
|-----------|---------|--------------|
| **1** | ATBS-Nummer | Auf Rechnung steht ATBS-450 |
| **2** | Bestellnummer | Auf Rechnung steht BEST-ATBS-450-001 |
| **3** | Lieferadresse | Projektadresse auf Rechnung |
| **4** | Betrags-Matching | Rechnungsbetrag = Bestellsumme |

### Kontakt-Zuordnung

- Absender-E-Mail wird mit `suppliers.email_bestellung` abgeglichen
- Bei Match: Dokument automatisch dem Großhändler/Kontakt zugeordnet
- Neue E-Mail-Adressen: Hinweis zur manuellen Zuordnung

---

## Benachrichtigungen

### E-Mail

| Ereignis | Empfänger | Inhalt |
|----------|-----------|--------|
| Bestellung erstellt | Besteller | Bestätigung mit Details |
| Freigabe angefordert | Bauleitung | Approve/Reject-Buttons |
| Freigegeben | Besteller | Bestätigung |
| Bestellt (versendet) | Besteller | Kopie der Bestellung |
| Geliefert | Besteller + Bauleitung | Lieferbestätigung |
| Reklamation | Großhändler | Fehlende Artikel |

### Telegram (geparkt - Token wird nachgereicht)

- Bestellbestätigung an Besteller
- Freigabe-Anfrage an Bauleitung
- Lieferstatus-Updates

---

## Datenbank-Schema

### Tabelle: `suppliers` (Großhändler)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| kontakt_id | uuid | FK → softr_kontakte (für Zuordnung) |
| name | text | G.U.T. Glaser, MEG, etc. |
| kurzname | text | GUT, MEG, ZANDER |
| sortiment | text[] | ['SHK', 'Elektro'] |
| email_bestellung | text | bestellung@gut-gruppe.de |
| email_domains | text[] | ['@gut-gruppe.de', '@gc-gruppe.de'] (für Rechnungserkennung) |
| kundennummer | text | Unsere Kundennr beim Lieferanten |
| lieferkosten_frei_ab | numeric | Frei-Haus-Grenze |
| lieferzeit_tage | int | Standard-Lieferzeit |
| ansprechpartner | text | Kontaktperson |
| telefon | text | |
| standort | text | Bochum, Dortmund, etc. |

### Tabelle: `order_articles` (Bestellartikel)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| supplier_id | uuid | FK → suppliers |
| artikelnummer | text | Artikelnr beim Großhändler |
| bezeichnung | text | Vollständige Bezeichnung (Backend) |
| kurzname | text | **Anzeige im Formular** (z.B. "Dreifachrahmen") |
| einheit | text | Stk, m, m², etc. |
| ek_preis | numeric | Einkaufspreis netto |
| aufschlag_prozent | numeric | Materialaufschlag % |
| vk_preis | numeric | GENERATED: ek_preis * (1 + aufschlag/100) |
| kunden | text[] | Auftraggeber-Filter (GWS, Covivio, etc.) |
| kategorie | text | Elektro, Sanitär, Maler, etc. |
| aktiv | boolean | Artikel bestellbar? |

### Tabelle: `orders` (Bestellungen)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| bestellnummer | text | GENERATED: BEST-{ATBS}-001 |
| projekt_id | uuid | FK → bauprozess (ATBS) |
| supplier_id | uuid | FK → suppliers |
| status | int | 0-7 (siehe oben) |
| bestelltyp | text | 'projekt' (Bauvorhaben) / 'allgemein' (später) |
| lieferort | text | Projektadresse / Lager |
| lieferort_typ | text | 'baustelle' / 'lager' |
| ansprechpartner | text | |
| ansprechpartner_telefon | text | |
| lieferdatum_gewuenscht | date | |
| lieferdatum_bestaetigt | date | |
| lieferkosten | numeric | |
| summe_netto | numeric | GENERATED aus Positionen |
| summe_brutto | numeric | GENERATED |
| erstellt_von | uuid | FK → users |
| erstellt_am | timestamptz | |
| freigabe_von | uuid | FK → users (Bauleitung) |
| freigabe_am | timestamptz | |
| bestellt_am | timestamptz | E-Mail gesendet |
| geliefert_am | timestamptz | |
| teillieferung_geplant | boolean | Großhändler hat Teillieferung angekündigt |
| bemerkungen | text | |
| dokument_id | uuid | FK → softr_dokumente (BEST) |

### Tabelle: `order_items` (Bestellpositionen)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| order_id | uuid | FK → orders |
| article_id | uuid | FK → order_articles |
| menge_bestellt | numeric | |
| menge_geliefert | numeric | Für Teillieferungen |
| status | text | 'offen' / 'geliefert' / 'fehlmenge' |
| einzelpreis | numeric | EK zum Bestellzeitpunkt |
| gesamtpreis | numeric | GENERATED |

### Tabelle: `voice_article_mappings` (Sprach-Zuordnungen)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| sprache | text | 'de' / 'hu' / 'ru' / 'md' |
| gesprochener_text | text | "Wechselschalter", "hármas keret" |
| article_id | uuid | FK → order_articles |
| confidence | numeric | Ursprünglicher Match-Score |
| verwendungen | int | Wie oft wurde diese Zuordnung genutzt |
| erstellt_am | timestamptz | |
| aktualisiert_am | timestamptz | |

**Unique Constraint:** `(user_id, sprache, gesprochener_text)`

---

## Softr-Integration

### Eigene Bestellungen-Seite

- Liste aller Bestellungen (gefiltert nach User/Projekt)
- Status-Anzeige mit Farben
- Button "Neue Bestellung" → Netlify-UI mit URL-Parametern

### Formelfeld für URL

```
CONCAT(
  "https://neurealis-erp.netlify.app/bestellung/neu",
  "?atbs=", {ATBS-Nr},
  "&user=", {Aktiver Nutzer E-Mail}
)
```

---

## Lager (Perspektive - Phase II)

- Gelieferte Artikel bei Lieferort "Lager" automatisch einbuchen
- Lagerbestand pro Artikel tracken
- Lagerbewertung (Summe aller EK-Preise)
- Entnahme für Projekte buchen

---

## Buchhaltungs-Integration

### Bestellung → Eingangsrechnung

1. Bestellung wird versendet (BEST)
2. Großhändler liefert + sendet Rechnung
3. Rechnung kommt an kontakt@neurealis.de
4. Auto-Erkennung: Absender = Großhändler → ER-M
5. ATBS/Bestellnummer extrahieren → Verknüpfung
6. Beträge abgleichen (Bestellung vs. Rechnung)
7. Bei Abweichung: Hinweis an Buchhaltung

### ER-NU-M Abzug (bestehend in Softr)

- ER-NU-M Dokumente werden in Softr automatisch summiert
- Abzug von Schlussrechnung bleibt wie bisher
- Keine Änderung in Phase I

---

## Großhändler (Initial)

| Kurzname | Name | Sortiment | Standort | E-Mail-Domain |
|----------|------|-----------|----------|---------------|
| GUT | G.U.T. Glaser | SHK | Bochum | @gut-gruppe.de |
| ZANDER | Zander | Elektro, SHK | - | @zander.de |
| MEG | MEG Gruppe | Maler (exklusiv) | Recklinghausen | @meg-gruppe.de |
| KERAMUNDO | Keramundo | Fliesen | - | @keramundo.de |
| RAAB | Raab Karcher | Trockenbau | Recklinghausen | @raabkarcher.com |
| BAUPARTE | Bauparte | Türen | - | @bauparte.de |
| BUEDEKER | Büdeker & Richert | Fenster, Rollos | Dortmund | @buedeker.de |
| PROSOL | Prosol | Sockelleisten, Farben | - | @prosol.de |

---

## Implementierungs-Phasen

### Phase I - MVP (Jetzt)

- [ ] Supabase: `suppliers`, `order_articles`, `orders`, `order_items` Tabellen
- [ ] Großhändler aus Monday.com importieren
- [ ] Netlify: Neues Projekt `neurealis-erp`
- [ ] Auth: Login mit @neurealis.de
- [ ] UI: Bestellformular (responsive)
- [ ] UI: URL-Parameter für Vorausfüllung
- [ ] E-Mail: Bestellung versenden (Graph API, kontakt@neurealis.de)
- [ ] Dokument: BEST in softr_dokumente anlegen
- [ ] Softr: Bestellungen-Seite mit Button

### Phase II - Wareneingang

- [ ] UI: Wareneingang-Checklist (mobile-optimiert)
- [ ] Teillieferungen tracken
- [ ] Feedback bei Fehlmengen
- [ ] Lieferstatus-Updates

### Phase III - Rechnungsabgleich

- [ ] Graph API: Eingangsrechnungen scannen
- [ ] Auto-Erkennung: Großhändler via E-Mail-Domain
- [ ] ATBS/Bestellnummer extrahieren
- [ ] Verknüpfung Rechnung ↔ Bestellung
- [ ] Betragsabgleich

### Phase IV - Erweiterungen

- [ ] Telegram-Benachrichtigungen
- [ ] Lagerbestand tracken
- [ ] Allgemeine Bestellungen (nicht projekt-gebunden)
- [ ] API-Anbindung an Großhändler (falls verfügbar)

---

## Technische Umsetzung

| Komponente | Technologie |
|------------|-------------|
| **Frontend** | SvelteKit auf Netlify |
| **Backend** | Supabase (mfpuijttdgkllnvhvjlu) |
| **Auth** | Supabase Auth (E-Mail @neurealis.de) |
| **E-Mail Ausgang** | Edge Function + Graph API (kontakt@neurealis.de) |
| **E-Mail Eingang** | Graph API Polling/Webhook |
| **Sync** | Softr ↔ Supabase (bestehend) |

---

## Datenquellen

### Monday.com (zu importieren)

| Board | URL | Inhalt |
|-------|-----|--------|
| **Lieferanten** | https://neurealis.monday.com/boards/1547308184 | Großhändler-Stammdaten |
| **Beschaffung** | https://neurealis.monday.com/boards/1548482020 | Bestehende Bestellungen |
| **Lager** | https://neurealis.monday.com/boards/1570589152 | Lagerbestände (später) |

### OneDrive

| Ordner | Inhalt |
|--------|--------|
| `Wohnungssanierung - 15 Großhandel` | Großhändler-Infos |
| `15 Großhandel/10 Bestelllisten` | Artikellisten |

---

*Aktualisiert am 2026-01-26*
