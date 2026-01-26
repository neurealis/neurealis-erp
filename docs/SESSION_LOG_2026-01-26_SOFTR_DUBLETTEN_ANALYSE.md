# Session Log: Softr Dokumente Dubletten-Analyse

**Datum:** 2026-01-26
**Thema:** Analyse und Report doppelter Rechnungsnummern in Softr Dokumente-Tabelle

---

## Zusammenfassung

Analyse der Softr.io Dokumente-Tabelle auf doppelte Rechnungsnummern bei Ausgangsrechnungen (AR-A/AR-S) und Erstellung von Reports für fehlende Ausgangsrechnungen bei Projekten.

---

## Durchgeführte Arbeiten

### 1. Dubletten-Analyse Ausgangsrechnungen

**Ergebnis:**
- 2.336 Dokumente in Softr analysiert
- 325 doppelte Rechnungsnummern insgesamt
- **7 Dubletten bei Ausgangsrechnungen (AR-A/AR-S)**

**Betroffene Rechnungen:**
| RE-Nr | ATBS | Problem |
|-------|------|---------|
| ATBS381-0000059 | ATBS-381 | 2x AR-S am gleichen Tag mit unterschiedlichen Beträgen |
| RE-0015164 | ATBS-330 | AR-A + AR-S mit identischem Betrag |
| RE-0015171 | ATBS-305 | AR-A + AR-S mit identischem Betrag |
| RE-0015172 | ATBS-288 | AR-A + AR-S mit identischem Betrag |
| RE-0015175 | ATBS-324 | AR-A + AR-S mit identischem Betrag |
| RE-0015176 | ATBS-340 | AR-A + AR-S mit identischem Betrag |
| RE-0015209 | ATBS-364 | 2x AR-A mit identischem Betrag |

### 2. Projekte ohne Ausgangsrechnung (2025/2026)

**Ergebnis:**
- 115 ATBS-Projekte aus 2025/2026
- **62 davon ohne Ausgangsrechnung (AR-A/AR-S)**

Viele dieser Projekte haben bereits NU-Aufträge und Eingangsrechnungen, aber keine Kundenrechnung.

### 3. E-Mail-Reports

Zwei E-Mails an tobias.ranglo@neurealis.de (CC: holger.neumann@neurealis.de) gesendet:
1. **Projekte ohne Ausgangsrechnung (2025/2026)** - 62 Projekte
2. **Doppelte Ausgangsrechnungen (AR-A/AR-S)** - 7 Dubletten

---

## Erstellte Dateien

| Datei | Beschreibung |
|-------|--------------|
| `functions/scripts/check-dokumente-dubletten.ps1` | Haupt-Skript für Dubletten-Check |
| `functions/scripts/check-alle-dubletten.ps1` | Alle Dokumenttypen analysieren |
| `functions/scripts/projekte-ohne-ar-clean.ps1` | Projekte ohne AR (bereinigt) |
| `functions/scripts/send-beide-emails.ps1` | E-Mail-Versand beider Reports |
| `projekte_ohne_ar_clean.csv` | CSV-Export der Projekte ohne AR |

---

## Technische Details

### Softr API-Zugriff
- **Table ID Dokumente:** `kNjsEhYYcNjAsj`
- **Relevante Feld-IDs:**
  - `6tf0K` = Art des Dokuments (Kategorie)
  - `8Ae7U` = Dokument-Nr (Rechnungsnummer)
  - `DAXGa` = Datum erstellt
  - `QuHkO` = Betrag (netto)
  - `kukJI` = Betrag (brutto)
  - `GBc7t` = ATBS-Nr
  - `1sWGL` = Bauvorhaben

### E-Mail-Versand
- Via Supabase Edge Function `email-send`
- Microsoft Graph API über kontakt@neurealis.de

---

## Nächste Schritte / Offene Punkte

1. **Dubletten bereinigen:** Die 7 AR-Dubletten sollten in Softr manuell geprüft und korrigiert werden
2. **Fehlende AR erstellen:** Für die 62 Projekte ohne AR sollten Ausgangsrechnungen erstellt werden
3. **Optional:** Automatische Warnung bei neuen Dubletten implementieren

---

## Statistik

| Metrik | Wert |
|--------|------|
| Dokumente analysiert | 2.336 |
| Gültige ATBS-Nummern | 120 |
| ATBS mit AR | 53 |
| ATBS ohne AR (2025/2026) | 62 |
| AR-Dubletten | 7 |

---

*Erstellt: 2026-01-26 14:45*
