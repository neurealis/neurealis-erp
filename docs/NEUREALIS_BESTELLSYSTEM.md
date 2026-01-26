# neurealis ERP - Bestellsystem

**Stand:** 2026-01-26
**Version:** 1.2
**Status:** Phase I - MVP (DB-Tabellen fertig, 255 Artikel importiert, Softr-Anbindung)
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

## Datenbank-Schema (Implementiert)

> **Status:** ✅ Alle Tabellen angelegt am 2026-01-26

### Tabelle: `grosshaendler`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| kontakt_id | uuid | FK → kontakte |
| name | text | NOT NULL - G.U.T. Glaser, MEG, etc. |
| kurzname | text | GUT, MEG, ZANDER |
| typ | text | baustoff, sanitaer, elektro, farbe, werkzeug, sonstiges |
| kundennummer | text | Unsere Kundennr beim Lieferanten |
| bestellweg | text | telefon, email, portal, fax, app |
| bestell_email | text | Bestellungs-E-Mail |
| bestell_telefon | text | Bestellhotline |
| bestell_fax | text | Fax für Bestellungen |
| shop_url | text | Online-Shop URL |
| rabatt_prozent | numeric(5,2) | Standard-Rabatt |
| mindestbestellwert | numeric(10,2) | Mindestbestellwert |
| versandkostenfrei_ab | numeric(10,2) | Frei-Haus-Grenze |
| lieferzeit_werktage | int | Default: 2 |
| ansprechpartner_name | text | Kontaktperson |
| ansprechpartner_telefon | text | |
| ansprechpartner_email | text | |
| notizen | text | |
| ist_aktiv | boolean | Default: true |

### Tabelle: `bestellartikel`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| artikelnummer | text | NOT NULL - Artikelnr beim Großhändler |
| bezeichnung | text | NOT NULL - Vollständige Bezeichnung |
| beschreibung | text | Zusätzliche Infos |
| kategorie | text | Elektro, Sanitär, Maler, etc. |
| einheit | text | Default: 'Stück' |
| listenpreis | numeric(10,2) | Listenpreis |
| einkaufspreis | numeric(10,2) | Unser EK |
| waehrung | text | Default: 'EUR' |
| grosshaendler_id | uuid | FK → grosshaendler |
| grosshaendler_artikelnr | text | Artikelnr beim Händler |
| hersteller | text | Hersteller-Name |
| ean | text | EAN-Code |
| mindestbestellmenge | numeric(10,2) | Default: 1 |
| verpackungseinheit | text | z.B. "Karton à 10 Stk" |
| **embedding** | vector(1536) | **KI-Embedding für semantische Suche** |
| ist_aktiv | boolean | Default: true |

**Indizes:**
- `idx_bestellartikel_bezeichnung` (GIN für Volltextsuche)
- `idx_bestellartikel_artikelnummer`
- `idx_bestellartikel_grosshaendler`
- `idx_bestellartikel_embedding` (IVFFlat für Vektorsuche)

### Tabelle: `bestellungen`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| bestell_nr | serial | UNIQUE - Auto-incrementierte Bestellnummer |
| grosshaendler_id | uuid | FK → grosshaendler |
| projekt_id | uuid | FK → projekte |
| atbs_nummer | text | ATBS-Nummer für Zuordnung |
| bestellt_von_user_id | uuid | Supabase Auth User |
| bestellt_von_name | text | Name des Bestellers |
| bestellt_von_email | text | E-Mail des Bestellers |
| status | text | entwurf, bestellt, teilgeliefert, geliefert, storniert |
| summe_netto | numeric(12,2) | Berechnet aus Positionen |
| summe_brutto | numeric(12,2) | Mit MwSt |
| mwst_satz | numeric(4,2) | Default: 19.00 |
| **original_text** | text | **Freitext-Eingabe für KI-Parsing** |
| **parsing_confidence** | numeric(3,2) | **KI-Confidence 0-1** |
| **needs_review** | boolean | **Manuelle Prüfung nötig?** |
| lieferadresse | text | Lieferort |
| gewuenschtes_lieferdatum | date | |
| tatsaechliches_lieferdatum | date | |
| bestellt_am | timestamptz | Zeitpunkt der Bestellung |
| bestellt_via | text | telefon, email, portal |
| bestellbestaetigung_nr | text | Bestätigungs-Nr vom Händler |
| notizen | text | |

### Tabelle: `bestellpositionen`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| bestellung_id | uuid | FK → bestellungen (CASCADE) |
| position_nr | int | NOT NULL - Positionsnummer |
| artikel_id | uuid | FK → bestellartikel (optional) |
| artikelnummer | text | Kopiert oder Freitext |
| bezeichnung | text | NOT NULL - Artikelbezeichnung |
| beschreibung | text | Zusätzliche Infos |
| menge | numeric(12,3) | NOT NULL - Bestellmenge |
| einheit | text | Default: 'Stück' |
| einzelpreis | numeric(10,2) | EK zum Bestellzeitpunkt |
| gesamtpreis | numeric(12,2) | Berechnet |
| **original_text** | text | **Freitext für KI-Parsing** |
| **parsing_confidence** | numeric(3,2) | **KI-Confidence** |
| **needs_review** | boolean | **Prüfung nötig?** |
| gelieferte_menge | numeric(12,3) | Default: 0 |
| lieferstatus | text | offen, teilweise, komplett |
| notizen | text | |

### Tabelle: `mitarbeiter`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK |
| auth_user_id | uuid | UNIQUE - FK → Supabase Auth |
| kontakt_id | uuid | FK → kontakte |
| email | text | UNIQUE NOT NULL |
| vorname | text | NOT NULL |
| nachname | text | NOT NULL |
| rolle | text | admin, bauleiter, mitarbeiter, lager |
| darf_bestellen | boolean | Default: true |
| darf_freigeben | boolean | Default: false |
| max_bestellwert | numeric(10,2) | Limit für eigenständige Bestellungen |
| ist_aktiv | boolean | Default: true |
| letzter_login | timestamptz | |

### RPC-Funktion: `match_bestellartikel`

Semantische Artikelsuche via Embedding:

```sql
match_bestellartikel(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_grosshaendler uuid DEFAULT NULL
) RETURNS TABLE (id, artikelnummer, bezeichnung, einheit, einkaufspreis, grosshaendler_id, similarity)
```

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

- [x] Supabase: DB-Tabellen angelegt (2026-01-26)
  - `grosshaendler` - Großhändler-Stammdaten (erweitert um Kreditlimit, SEPA, Skonto)
  - `bestellartikel` - Artikelkatalog mit Embedding
  - `bestellungen` - Bestellkopfdaten
  - `bestellpositionen` - Einzelpositionen
  - `mitarbeiter` - Auth-Verknüpfung
- [x] Edge Function `parse-bestellung` deployed (v2)
  - Mehrsprachiges KI-Parsing (DE, HU, RU, RO)
  - gpt-5.2 für Artikelerkennung
  - Embedding-basierte Artikelsuche
- [x] RPC-Funktion `match_bestellartikel` für semantische Suche
- [x] Artikellisten aus Excel importiert (255 Artikel)
  - Elspermann (19), GUT (40), Zander (54), MEG (61), Keramundo (21), Hornbach/Gira (60)
- [x] Großhändler-Stammdaten angelegt (14 aktive Händler)
- [x] Softr.io direkt an Supabase angebunden (kein Monday.com-Sync)
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
