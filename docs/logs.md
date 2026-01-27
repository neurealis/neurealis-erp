# Session Logs - neurealis ERP

**Stand:** 2026-01-27

---

## Index

| Log-ID | Datum | Titel | Status |
|--------|-------|-------|--------|
| LOG-001 | 2026-01-27 | UI-Migration Phase 1-2: Komplettes internes Portal | Abgeschlossen |
| LOG-002 | 2026-01-27 | Hero API Rechnungssync - invoice_style Entdeckung | Dokumentiert |
| LOG-003 | 2026-01-27 | VBW LV 2026 - Preisvergleich & Materialvorschläge | Abgeschlossen |

---

## LOG-001 - UI-Migration Phase 1-2: Komplettes internes Portal

**Datum:** 2026-01-27 19:00-20:00
**Dauer:** ~60 Minuten

### Zusammenfassung

Vollständige Migration des internen Softr-Portals zu SvelteKit mit Supabase-Datenanbindung.

### Durchgeführte Arbeiten

**Phase 1 - Layout-System:**
- AppShell, Sidebar (rollenbasiert), Header, BottomNav erstellt
- UI-Komponenten: Button, Card, Badge, Accordion, KPICard
- Design-Tokens erweitert (Breakpoints, Status-Farben)

**Phase 2 - Seiten mit Supabase:**
| Seite | Tabelle | Datensätze |
|-------|---------|------------|
| Dashboard | diverse | KPIs, Aktivitäten |
| Bauvorhaben | monday_bauprozess | 193 |
| Kalender | monday_bauprozess | Bauzeitenplan |
| Mängel | maengel_fertigstellung | 57 |
| Nachträge | nachtraege | aktiv |
| Finanzen | softr_dokumente | 2.000 |
| Einkauf | grosshaendler, bestellartikel, lv_positionen | 2.835 |
| Kontakte | kontakte | 1.379 |
| Leads | leads (NEU!) | 8 |
| Aufgaben | tasks | 1.755 |
| Nachunternehmer | kontakte + kontakte_nachunternehmer | 39 |

**Neue Datenbank-Tabelle:**
- `leads` mit Pipeline-Status (neu, kontaktiert, qualifiziert, angebot, gewonnen, verloren)
- `softr_dokumente` mit 2.000 importierten Rechnungen

### Technische Details

- Svelte 5 Runes ($state, $derived, $props)
- Parallele Subagenten für schnelle Implementierung (11 parallel)
- TypeScript durchgängig
- Responsive Design (Desktop + Mobile)

### Offene Punkte

- Kundenportal-Seiten: /angebote, /ansprechpartner
- Partnerportal-Seiten: /auftraege, /lvs, /nachweise, /vorlagen
- Auth-Rollen aus DB laden (derzeit hardcoded)
- Netlify Deploy

---

## LOG-002 - Hero API Rechnungssync - invoice_style Entdeckung

**Datum:** 2026-01-27 ~20:00
**Quelle:** Wiederherstellung aus abgestürztem Chat

### Zusammenfassung

Analyse der Hero GraphQL API zur direkten Unterscheidung von Teil- und Schlussrechnungen mittels `metadata.invoice_style`.

### Kernentdeckung

Die Hero API bietet ein **InvoiceStyle Enum**:

| Wert | Bedeutung | → Softr-Typ |
|------|-----------|-------------|
| `full` | Schlussrechnung | AR-S |
| `parted` | Teilrechnung | AR-A |
| `cumulative` | Kumulierte Rechnung | AR-A |
| `downpayment` | Abschlagsrechnung | AR-A |
| `null` | Entwurf | **Ignorieren** |

### Wichtige API-Felder

```graphql
customer_documents {
  nr                          # RE-0015xxx
  value                       # Netto EUR
  vat                         # MwSt EUR
  date                        # Datum
  metadata {
    invoice_style             # full/parted/cumulative/downpayment/null
    positions { name net_value vat }
  }
  file_upload {
    filename                  # Lesbarer Name
    url                       # Download-URL
  }
}
```

### Statistiken

- 53 Schlussrechnungen (full)
- 16 Teilrechnungen (parted)
- 1 kumulierte Rechnung
- 49 Entwürfe (null) → ignorieren

### Validierung

15 Dokumente verglichen: **100% Übereinstimmung** zwischen Hero `invoice_style` und Softr-Dokumenttyp.

### Erstellte Dokumentation

- `docs/HERO_RECHNUNGSSYNC_API.md` - Vollständige API-Referenz

### Nächste Schritte

1. [ ] Edge Function `hero-document-sync` anpassen
2. [ ] Fehlende Netto/Brutto in Supabase ergänzen
3. [ ] Positionen als Text-Feld speichern (optional)

---

## LOG-003 - VBW LV 2026 - Preisvergleich & Materialvorschläge

**Datum:** 2026-01-27 ~21:00-22:30
**Zweck:** Verhandlungsvorbereitung mit Großkunde VBW

### Zusammenfassung

Analyse des neuen VBW-Leistungsverzeichnisses 2026 mit Preisvergleich zu 2023 und Extraktion von Materialvorschlägen für Verhandlungsgespräch.

### Durchgeführte Arbeiten

**1. Excel-Analyse:**
- Original-Excel mit 125 Zeilen, 22 Kommentare extrahiert
- Kommentare enthielten Materialvorschläge und Preishinweise
- Umlaute-Encoding korrigiert

**2. Erstellte Ausgabe-Datei:**
`2026-01-27 VBW - LV 2026 - Preisvorschläge neurealis.xlsx`

**Spaltenstruktur:**
| Spalte | Inhalt |
|--------|--------|
| A | Pos. NEU |
| B | Kurztext NEU (2026) |
| C | Gewerk |
| D | LV 2023 (50m²) |
| E | LV 2026 (50m²) |
| F | Δ % |
| G | Preisvorschlag (nur wenn explizit) |
| H | Material-Vorschlag |
| I | Kommentar (Original) |
| J | Vergleichsposition (andere Kunden) |

**3. Supabase-Vergleich:**
- Vergleichspositionen aus `lv_positionen` für GWS, covivio, WBG Lünen, Privat, neurealis

### Kritische Preisänderungen (50m² netto)

| Pos | Position | 2023 | 2026 | Δ |
|-----|----------|------|------|---|
| 3.1 | Sanitär komplett | 3.980 € | 7.650 € | **+92%** |
| 4.8 | Therme Vaillant | 2.650 € | 4.300 € | **+62%** |
| 6.1 | Bodenbeläge entf. | 480 € | 350 € | **-27%** |
| 6.3 | Vinyl | 2.075 € | 1.565 € | **-25%** |

### Materialvorschläge für VBW

| Position | Vorschlag |
|----------|-----------|
| E-Anlage / Schalter | Gira Standard 55 (statt S2) |
| Sanitär | Vigour One |
| Fliesen | Kermos 8mm (DK02 nicht rutschhemmend) |
| Türen | Prüm Röhrenspahn / KK2 RC2 |
| Beschläge | Becher/Hoppe Amsterdam |

### Erkenntnisse für Verhandlung

1. **Untergrundvorbereitung fehlt im VBW-LV:**
   - Säubern + Grundieren nicht in 6.2 enthalten
   - GWS hat separate Positionen (Grundierung 2,63€/m², Untergrund 14,58€/m²)

2. **Explizite Preisvorschläge aus Kommentaren:**
   - 4.9 Rückbau MAG: 250€ (Stadtwerke-Abmeldung aufwendig)
   - 7.2 WE-Tür: 1.200€ (EK Material 1.050€)

### Erstellte Scripts

- `parse-vbw-excel.mjs` - Excel-Struktur analysieren
- `create-vbw-material-excel.mjs` - Erste Extraktion
- `update-vbw-final.mjs` - Finale Ausgabe mit Vergleichen

---

*Aktualisiert: 2026-01-27 22:30*
