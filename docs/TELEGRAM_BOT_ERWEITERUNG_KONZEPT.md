# Telegram-Bot Erweiterung - Konzept

**Stand:** 2026-01-31
**Status:** In Implementierung

---

## Grundprinzip

**WICHTIG:** Alle bestehenden Features bleiben erhalten!
- Mängel erfassen ✅
- Nachträge erfassen ✅
- Nachweise hochladen ✅
- Bedarfsanalyse ✅
- Aufmaß ✅
- ATBS-Suche direkt ✅

Die neuen Features sind **Ergänzungen**, keine Ersetzungen.

---

## 1. Neue Menü-Struktur

### Hauptmenü (erweitert)

```
Hauptmenü @neurealis_bedarfsanalyse_bot

[📐 Aufmaß starten        ]
[📋 Bedarfsanalyse starten]
[🏗️ Baustelle öffnen      ]  <- Erweitert mit Phasen-Filter
[🔍 ATBS direkt eingeben  ]  <- NEU: Schnellzugriff
[❓ Hilfe                 ]
```

### Baustelle öffnen - Neuer Flow

```
Schritt 1: Auswahl-Methode
===========================
Wie möchtest du ein Projekt finden?

[Nach Phase filtern    ]  <- NEU
[ATBS-Nummer eingeben  ]  <- Bestehend
[Alle aktiven Projekte ]  <- Bestehend
[<- Hauptmenü          ]
```

```
Schritt 2a: Phasen-Auswahl (NEU)
================================
Welche Phase?

[(0) Bedarfsanalyse ]
[(1) Angebotsstellung]
[(2) Auftrag erhalten]
[(3) Vorbereitung    ]
[(4) Umsetzung       ]
[<- Zurück           ]
```

```
Schritt 2b: Projekt-Auswahl
============================
Phase (4) Umsetzung - 12 Projekte:

[ATBS-456: VBW | Münsterstr. 15 | 2.OG     ]
[ATBS-455: GWS | Werner Hellweg 114 | EG   ]
[ATBS-454: Covivio | Rheinlanddamm 8 | 1.OG]
...

WICHTIG: Vollständiger Name anzeigen (Wohnungsnummer am Ende sichtbar!)
```

### Projekt-Menü (erweitert)

```
Projekt: ATBS-456
VBW | Münsterstr. 15 | 2.OG

━━━━━━━━━━━━━━━━━━━━
📍 Phase: (4) Umsetzung
👷 BL: Max Mustermann
🔧 NU: Malerbetrieb Schmidt

📅 Termine:
   Start: 15.01.2026
   Ende NU Plan: 28.02.2026
   Ende Mängelfrei: -
   Ende Kunde: -

⚠️ Offen: 3 Mängel | 2 Nachträge
━━━━━━━━━━━━━━━━━━━━

BESTEHEND:
[🔧 Mangel melden    ] [📋 Nachtrag erfassen]
[📸 Nachweis hochladen] [📊 Status anzeigen  ]

NEU:
[🏗️ Gewerk-Status    ] [📐 Ausführungsarten ]
[📅 Termine anpassen ] [📄 Abnahmeprotokoll ]

[❌ Projekt schließen] [🏠 Hauptmenü        ]
```

---

## 2. Neue Features im Detail

### 2.1 Gewerk-Status (NEU)

Tabellarische Anzeige mit Emojis:

```
🏗️ Gewerk-Status ATBS-456

┌─────────────┬────────────┐
│ Gewerk      │ Status     │
├─────────────┼────────────┤
│ Entkernung  │ ✅ Fertig   │
│ Maurer      │ ✅ Fertig   │
│ Elektrik    │ 🔨 Rohinstall│
│ Sanitär     │ 🔨 Läuft    │
│ Heizung     │ ⏳ Geplant  │
│ Tischler    │ ⏳ Geplant  │
│ Wände       │ ⏳ Geplant  │
│ Boden       │ ⏳ Geplant  │
│ Reinigung   │ ⏳ Geplant  │
└─────────────┴────────────┘

[🔧 Status ändern] [⬅️ Zurück]

Status ändern: NUR für Bauleiter!
```

### 2.2 Ausführungsarten (NEU)

Kombinierte Tabelle:

```
📐 Ausführungsarten ATBS-456

┌─────────┬────────────────┬─────────┐
│ Gewerk  │ Ausführung     │ Status  │
├─────────┼────────────────┼─────────┤
│ Bad     │ Komplett       │ 🔨 Läuft │
│ Elektrik│ Teil-Mod       │ ✅ Fertig│
│ Wände   │ Tapete+Anstrich│ ⏳ Gepl. │
│ Decken  │ Streichputz    │ ⏳ Gepl. │
│ Boden   │ Vinyl          │ ⏳ Gepl. │
│ Türen   │ 3 Innentüren   │ ⏳ Gepl. │
│ Gastherme│ Ohne          │ -       │
└─────────┴────────────────┴─────────┘

[⬅️ Zurück]
```

### 2.3 Termine anpassen (NEU)

```
📅 Termine anpassen ATBS-456

Aktuelle Termine:
• BV Start: 15.01.2026
• BV Ende NU Plan: 28.02.2026
• BV Ende Mängelfrei: -
• BV Ende Kunde: 15.03.2026

[BV Ende NU Plan ändern  ]
[BV Ende Mängelfrei setzen]
[BV Ende Kunde ändern    ]
[⬅️ Zurück               ]
```

Datum-Eingabe (flexible Formate):
- `17.03.` oder `17.03.2026`
- `in 2 Tagen`
- `heute`
- `nächsten Montag`

### 2.4 Nachweis Brandschutz (NEU)

Erweiterung der Nachweis-Auswahl:

```
📸 Nachweis hochladen für ATBS-456

[Rohinstallation Elektrik ]
[Rohinstallation Sanitär  ]
[Abdichtung Bad           ]
[E-Check Protokoll        ]
[🔥 Brandschutz           ]  <- NEU
[⬅️ Zurück                ]
```

### 2.5 Abnahmeprotokolle (NEU)

```
📄 Abnahmeprotokoll hochladen ATBS-456

[👷 NU-Abnahme (intern)  ]  -> Dokumenttyp: QM-ABN-NU
[🏠 Kunden-Abnahme       ]  -> Dokumenttyp: QM-ABN-KU

[⬅️ Zurück]
```

### 2.6 Multi-Foto-Upload (FIX)

Wenn mehrere Fotos gleichzeitig gesendet werden:
- Alle Fotos werden dem **gleichen** Mangel/Nachtrag/Nachweis zugeordnet
- Telegram media_group_id erkennen
- 2 Sekunden warten, dann alle zusammen speichern

---

## 3. Sprach-Befehle

### Aus Hauptmenü (ATBS + Aktion)

```
"ATBS 450 setze Status Elektro auf Rohinstallation"
"ATBS-456 erstelle Nachtrag: 2 Heizkörper tauschen mit Thermostatventil"
"ATBS 450 verschiebe BV Ende Plan auf 17.03."
"ATBS 450 BV Ende Mängelfrei heute"
```

### Aus Projekt-Kontext

```
"Setze Status Elektrik auf Fertig"
"Verschiebe Ende um 2 Tage"
"Neuer Nachtrag: zusätzliche Steckdose im Bad"
```

---

## 4. Datenbank-Änderungen

### Monday.com (neue Spalten)

| Spalte | Typ | Werte |
|--------|-----|-------|
| Brandschutz \| status | Status | Ausstehend, Erledigt |
| Brandschutz \| fotos | Datei | Uploads |

### Supabase

```sql
-- fotos Tabelle: nachweis_typ erweitern
ALTER TABLE fotos DROP CONSTRAINT IF EXISTS fotos_nachweis_typ_check;
ALTER TABLE fotos ADD CONSTRAINT fotos_nachweis_typ_check
  CHECK (nachweis_typ IS NULL OR nachweis_typ = ANY (ARRAY[
    'rohinstall_elektrik',
    'rohinstall_sanitaer',
    'abdichtung_bad',
    'e_check',
    'brandschutz'  -- NEU
  ]));

-- telegram_sessions: Multi-Foto-Support
ALTER TABLE telegram_sessions
ADD COLUMN IF NOT EXISTS pending_fotos JSONB DEFAULT '[]';
```

### Dokumenttypen (dokumente Tabelle)

- `QM-ABN-NU` - Nachunternehmer-Abnahmeprotokoll
- `QM-ABN-KU` - Kunden-Abnahmeprotokoll

---

## 5. Berechtigungen

| Aktion | Wer darf? |
|--------|-----------|
| Status anzeigen | Alle |
| Status ändern | Nur Bauleiter |
| Termine anzeigen | Alle |
| Termine ändern | Nur Bauleiter |
| Mangel/Nachtrag erfassen | Alle |
| Nachweis hochladen | Alle |

Prüfung: `kontakte.rolle = 'BL'` oder `email = 'holger.neumann@neurealis.de'`

---

## 6. Implementierungs-Reihenfolge

### Phase 1: Phasen-Filter & Projekt-Info (~8h)
- [ ] Phasen-Filter beim Projekt-Öffnen
- [ ] ATBS-Schnellzugriff im Hauptmenü
- [ ] Vollständiger Projektname anzeigen
- [ ] Kompakte Projekt-Info (Phase, BL, NU, Termine, Offen)
- [ ] Gewerk-Status tabellarisch
- [ ] Ausführungsarten-Tabelle

### Phase 2: Nachweise & Dokumente (~6.5h)
- [ ] Brandschutz-Spalten in Monday anlegen
- [ ] Brandschutz im Bot
- [ ] Abnahmeprotokolle (QM-ABN-NU/KU)
- [ ] Multi-Foto-Upload Fix

### Phase 3: Termine (~4.5h)
- [ ] Flexible Datum-Parser
- [ ] Termine-Menü
- [ ] Spracheingabe für Termine

### Phase 4: Sprach-Befehle (~7.5h)
- [ ] Bauleiter-Berechtigung prüfen
- [ ] Status per Sprache ändern
- [ ] Nachtrag per Sprache aus Hauptmenü
- [ ] Monday-Sync für Änderungen

---

*Erstellt: 2026-01-31*
