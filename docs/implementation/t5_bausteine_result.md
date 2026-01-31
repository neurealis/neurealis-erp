# T5: Angebots-Bausteine - Ergebnis

**Datum:** 2026-01-31
**Status:** Erfolgreich abgeschlossen

## Zusammenfassung

Die Tabelle `angebots_bausteine` wurde mit echten Inhalten befüllt.

## Aktuelle Datenbasis

| Typ | Anzahl |
|-----|--------|
| angebotsannahme | 3 |
| nua_vertragswerk | 2 |
| textbaustein | 10 |
| bedarfsposition | 29 |
| **Gesamt** | **44** |

## Neu eingefügte Bausteine (T5)

### 1. Angebotsannahme (HTML-Template)
- **ID 18:** Standard-Auftragserteilung
- Vollständiges HTML-Template mit Platzhaltern:
  - `{{angebotsnummer}}`, `{{datum}}`, `{{netto}}`, `{{mwst}}`, `{{brutto}}`
  - `{{zahlungsbedingungen}}`, `{{gueltig_bis}}`
- Unterschriftenfelder für Auftraggeber

### 2. NUA-Vertragswerk (HTML-Template)
- **ID 19:** Standard NUA-Vertrag
- Vollständiges Nachunternehmer-Vertragswerk mit 12 Paragraphen:
  - §1 Vertragsgegenstand, §2 Leistungsumfang, §3 Vergütung
  - §4 Ausführungsfristen, §5 Abnahme, §6 Gewährleistung (5 Jahre VOB/B)
  - §7 Versicherungen, §8 Nachweise, §9 Sicherheitseinbehalt (5%)
  - §10 Kündigung, §11 Gerichtsstand (Dortmund), §12 Schlussbestimmungen
- Platzhalter: `{{objekt_adresse}}`, `{{abschlag_prozent}}`, `{{baubeginn}}`, `{{fertigstellung}}`, `{{nachunternehmer_firma}}`

### 3. Textbausteine
| ID | Name | Inhalt |
|----|------|--------|
| 20 | Zahlungsbedingungen Standard | 14 Tage netto |
| 21 | Gewährleistung VOB | 5 Jahre ab Abnahme |
| 22 | Gültigkeit Angebot | 4 Wochen |
| 23 | Hinweis Preisbasis | Preisanpassungsvorbehalt |
| 24 | Abnahme-Hinweis | Mängel schriftlich |
| 25 | Haftungsausschluss | Standard-Ausschluss |

### 4. Bedarfspositionen (mit echten LV-Preisen)

**Container (aus GWS-LV):**
| ID | Name | Artikelnummer | Preis (VK) | Einheit |
|----|------|---------------|------------|---------|
| 26 | Containerstellung 3m³ | GWS.LV23-01.01.5 | 493,95 € | Stk |
| 27 | Containerstellung 7m³ | GWS.LV23-01.01.6 | 622,81 € | Stk |
| 28 | Containerstellung 10m³ | GWS.LV23-01.01.7 | 983,61 € | Stk |

**Stundenlohn (aus GWS-LV):**
| ID | Name | Artikelnummer | Preis (VK) | Einheit |
|----|------|---------------|------------|---------|
| 29 | Stundenlohn Facharbeiter | GWS.LV23-01.02.1 | 59,06 € | Std |
| 30 | Stundenlohn Helfer | GWS.LV23-01.02.2 | 42,95 € | Std |

**Reinigung (aus GWS-LV):**
| ID | Name | Artikelnummer | Preis (VK) | Einheit |
|----|------|---------------|------------|---------|
| 31 | Bauschluss-Reinigung 1-Zi bis 35m² | GWS.LV23-11.02.1 | 206,17 € | psch |
| 32 | Bauschluss-Reinigung 2-Zi bis 50m² | GWS.LV23-11.02.4 | 229,80 € | psch |
| 33 | Bauschluss-Reinigung 3-Zi bis 65m² | GWS.LV23-11.02.10 | 254,49 € | psch |
| 34 | Bauschluss-Reinigung 4-Zi bis 100m² | GWS.LV23-11.02.14 | 332,88 € | psch |
| 35 | Grundreinigung Treppenhaus EG | GWS.LV23-11.01.1 | 48,32 € | Wo |
| 36 | Reinigung weitere Etagen | GWS.LV23-11.01.2 | 28,13 € | Wo |

**Allgemeine Pauschalen (ohne LV-Referenz):**
| ID | Name | Preis (VK) | Einheit |
|----|------|------------|---------|
| 37 | Baustelleneinrichtung | 350,00 € | psch |
| 38 | Baustromverteiler | 180,00 € | psch |
| 39 | Anfahrtspauschale | 45,00 € | psch |
| 40 | Kleinmaterial unvorhergesehen | 150,00 € | psch |
| 41 | Dokumentation/Übergabe | 250,00 € | psch |

**Entsorgung (aus GWS-LV):**
| ID | Name | Artikelnummer | Preis (VK) | Einheit |
|----|------|---------------|------------|---------|
| 42 | Demontage NSP-Ofen 2-4 KW | GWS.LV23-20.01.29 | 412,61 € | Stk |
| 43 | Demontage NSP-Ofen 5-6 KW | GWS.LV23-20.01.30 | 457,46 € | Stk |
| 44 | Heizkörper demontieren + entsorgen | GWS.LV23-21.01.01.3 | 74,90 € | Stk |

## Hinweise

### Bereits vorhandene Daten (von T1)
Die Tabelle enthielt bereits Daten von einem früheren Import:
- 2 Angebotsannahme-Templates (ID 1-2)
- 1 NUA-Vertragswerk (ID 3)
- 4 Textbausteine (ID 4-7)
- 10 Bedarfspositionen (ID 8-17)

### Duplikate
Es gibt einige Duplikate bei Namen (z.B. "Stundenlohn Facharbeiter"):
- ID 14: 52,00 € (Schätzwert)
- ID 29: 59,06 € (echter GWS-LV Listenpreis)

**Empfehlung:** Die neuen Einträge mit GWS-Artikelnummern (ID 26-44) verwenden echte Listenpreise und sollten bevorzugt werden.

### Preisbasis
Alle Preise mit GWS-Artikelnummern stammen aus `lv_positionen.listenpreis` (= Verkaufspreis/VK), nicht aus `preis` (= Einkaufspreis/EK).

## Tabellenstruktur

```sql
angebots_bausteine (
  id SERIAL PRIMARY KEY,
  typ TEXT NOT NULL,           -- 'angebotsannahme', 'nua_vertragswerk', 'textbaustein', 'bedarfsposition'
  name TEXT NOT NULL,
  beschreibung TEXT,
  inhalt TEXT,                 -- HTML-Template für Dokumente
  artikelnummer TEXT,          -- GWS-Referenz für Bedarfspositionen
  einheit TEXT,
  preis NUMERIC,               -- VK-Preis
  mwst_satz NUMERIC,
  sortierung INTEGER,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## Nächste Schritte

1. **Duplikate bereinigen:** Alte Schätzwert-Positionen (ID 8-17) durch GWS-basierte ersetzen
2. **UI-Integration:** Bausteine im SvelteKit-Angebotsmodul verfügbar machen
3. **Template-Rendering:** HTML-Templates mit Platzhalter-Ersetzung implementieren
