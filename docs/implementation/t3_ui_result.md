# T3 UI Result - Angebots-Wizard

**Stand:** 2026-01-31
**Task:** Angebots-Wizard unter /angebote/neu erstellen

---

## Erstellte Dateien

### Seiten

| Datei | Beschreibung |
|-------|--------------|
| `ui/src/routes/angebote/+page.svelte` | Angebotsübersicht mit Tabelle, Filter, Stats |
| `ui/src/routes/angebote/neu/+page.svelte` | 8-Schritt Wizard fuer Angebotserstellung |

### API Routes

| Datei | Beschreibung |
|-------|--------------|
| `ui/src/routes/api/position-correction/+server.ts` | POST-Endpoint fuer Positions-Korrekturen (Lern-System) |

### Sidebar Update

| Datei | Aenderung |
|-------|-----------|
| `ui/src/lib/components/layout/Sidebar.svelte` | Angebote-Link fuer admin/mitarbeiter hinzugefuegt |

---

## Routing-Struktur

```
ui/src/routes/
├── angebote/
│   ├── +page.svelte          # Angebotsübersicht
│   └── neu/
│       └── +page.svelte      # 8-Schritt Wizard
└── api/
    └── position-correction/
        └── +server.ts        # Korrektur-API
```

---

## Wizard-Schritte

| Schritt | Name | Funktion |
|---------|------|----------|
| 1 | Projekt + Struktur | Projekt-Auswahl, LV-Typ automatisch, Gewerk/Raum Toggle |
| 2 | Eingabe | Transkription Textarea, KI-Analyse Trigger |
| 3 | Positionen pruefen | 3-Spalten Grid: Original, Erkannt, Alternativen |
| 4 | Gruppen bearbeiten | PositionGroupList Komponente, Drag&Drop |
| 5 | Abhängigkeiten | Checkboxen fuer position_dependencies |
| 6 | Aufmass | Tabelle mit Mengen-Inputs, m2-Kalkulator |
| 7 | Preise/Margen | Pricing-Profile, Rabatt, Margen-Berechnung |
| 8 | Freigabe + Export | Optionen, Vorschau, Speichern |

---

## Verwendete Komponenten

### Bestehende CPQ-Komponenten
- `PositionGroupList.svelte` - Hauptkomponente fuer Gewerke/Positionen
- `PositionGroup.svelte` - Einzelne Gruppe
- `PositionItem.svelte` - Einzelne Position

### UI-Komponenten
- `Button.svelte` - Primary, Secondary Varianten
- `Card.svelte` - Container mit Header/Footer
- `Badge.svelte` - Status-Anzeige, LV-Typ Badges

---

## Supabase Integration

### Tabellen (Lesen)
- `monday_bauprozess` - Projekt-Auswahl (Phase < 6)
- `pricing_profiles` - Aufschlag-Konfiguration
- `position_dependencies` - Abhängigkeiten laden

### Tabellen (Schreiben)
- `angebote` - Angebot speichern
- `angebots_positionen` - Positionen speichern
- `position_corrections` - Korrekturen speichern (Lern-System)

### Edge Functions
- `transcription-parse` - KI-Analyse der Transkription

### RPC Functions
- `get_next_dokument_nr('ANG')` - Angebotsnummer generieren

---

## Bekannte TODOs

### Funktional
1. **PDF-Generierung** - Platzhalter alert(), jsPDF Integration noetig
2. **Position manuell hinzufuegen** - Modal fuer manuelle Position fehlt
3. **NUA-Erkennung** - `isNUA` ist hardcoded false
4. **Raum-Struktur** - Nur Gewerk-Struktur implementiert

### Edge Function
5. **transcription-parse** - Response-Format anpassen an Wizard-Struktur
6. **Alternativen laden** - Embedding-basierte aehnliche Positionen

### UI/UX
7. **Mobile Optimierung** - Wizard-Steps auf Mobile verbessern
8. **Validierung** - Client-side Validierung pro Schritt
9. **Auto-Save** - Draft-Speicherung zwischen Schritten

### DB
10. **position_corrections Tabelle** - Migration erstellen falls nicht vorhanden

---

## Design-Entscheidungen

- **Eckiges Design**: border-radius: 0 ueberall (Softr-Rot Look)
- **Wizard-Navigation**: Sticky Header + Footer
- **3-Spalten Layout**: Step 3 fuer Position Check
- **Responsive**: Mobile Cards statt Tabellen
- **Farben**: Brand-Medium fuer Akzente, Gray-Palette fuer Neutral

---

## Test-Hinweise

### Lokaler Dev-Server
```bash
cd ui && npm run dev
# http://localhost:5173/angebote/neu
```

### Voraussetzungen
- Supabase-Tabellen: `angebote`, `angebots_positionen`, `pricing_profiles`
- Edge Function: `transcription-parse` deployed
- RPC: `get_next_dokument_nr` vorhanden

---

*Erstellt: 2026-01-31*
