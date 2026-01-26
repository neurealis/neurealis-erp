# Session Log - Bestellsystem Großhändler

**Datum:** 2026-01-26
**Thema:** Großhändler-Import und Tabellenstruktur

---

## Zusammenfassung

Großhändler aus Monday.com Lieferanten-Tabelle importiert und `grosshaendler` Tabelle erweitert. Edge Function `parse-bestellung` repariert (JWT deaktiviert).

---

## Erledigte Aufgaben

### 1. Edge Function Fix
- **Problem:** `parse-bestellung` gab 401/non-2xx zurück
- **Ursache:** `verify_jwt: true` aber kein Login in UI
- **Lösung:** Function v5 deployed mit `verify_jwt: false`

### 2. Großhändler Import
- 14 Lieferanten aus `kontakte_lieferanten` importiert
- Duplikate bereinigt → **20 aktive Großhändler**
- RLS Policy `anon_read_grosshaendler` hinzugefügt

### 3. Tabellenstruktur erweitert

**Neue Felder in `grosshaendler`:**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `lieferkosten` | numeric | Lieferkosten € |
| `zahlungsziel_tage` | integer | Zahlungsziel in Tagen |
| `skonto_prozent` | numeric | Skonto % |
| `skonto_tage` | integer | Skonto-Frist |
| `bestellung_bis` | text | Bestellschluss (z.B. "14:00") |
| `zahlart` | text | Zahlungsart |
| `monday_lieferant_id` | text | Monday.com Item ID |
| `bewertung_preise` | integer | 1-5 Sterne |
| `bewertung_kooperation` | integer | 1-5 Sterne |
| `bewertung_lieferung` | integer | 1-5 Sterne |
| `sortiment` | text[] | Kategorien-Array |

### 4. Zander Multi-Sortiment
- Zander hat mehrere Kategorien: elektro, sanitaer, heizung, klima
- Neues Feld `sortiment` als Array für mehrere Kategorien

### 5. UI angepasst
- Großhändler-Dropdown lädt aus Datenbank statt Demo-Daten
- Zeigt Kurzname + Typ

---

## Aktuelle Großhändler (20)

| Kurzname | Typ | Sortiment |
|----------|-----|-----------|
| ABEX | sanitaer | - |
| Amazon | sonstiges | - |
| B&R | fenster | - |
| BAUPARTE | sonstiges | - |
| Bauzentrum | baustoff | - |
| BECHER | baustoff | - |
| BUEDEKER | sonstiges | - |
| ELSPERMANN | sanitaer | - |
| FORBO | sonstiges | - |
| GUT | sanitaer | - |
| Hellweg | sonstiges | - |
| Hornbach | sonstiges | - |
| Keramundo | baustoff | - |
| Linnenbecker | baustoff | - |
| MEG | farbe | - |
| Prosol | farbe | - |
| Raab | baustoff | - |
| Würth | werkzeug | - |
| Zander | elektro | elektro, sanitaer, heizung, klima |
| ZERO | farbe | - |

---

## Monday.com Lieferanten-Board

**Board-ID:** 1547308184

**Verfügbare Spalten:**
- KundenNr (`text7__1`)
- E-Mail Bestellung (`email__1`)
- Bestellart (`status0__1`)
- Bestellung bis (`text_mkxt46cs`)
- Lieferzeit (`zahlen0__1`)
- Lieferkosten (`zahlen3__1`)
- Skonto % (`zahlen5__1`)
- Zahlungsziel (`text_mkxfw78b`)
- Sortiment (`dropdown_mkxf9hj7`)
- Shop URL (`link_mkxfdcp1`)

**Nicht in Monday vorhanden:**
- Mindestbestellwert
- Versandkostenfrei ab

---

## Offene Aufgaben

1. **Großhändler-Daten vervollständigen**
   - Kundennummern eintragen
   - Konditionen (Rabatt, Skonto, Zahlungsziel)
   - Lieferbedingungen

2. **Artikellisten importieren**
   - Excel/CSV vom Benutzer
   - Embeddings generieren für KI-Suche

3. **UI erweitern**
   - Bestellung speichern
   - Auth für Mitarbeiter

---

## Migrationen

| Name | Beschreibung |
|------|--------------|
| `add_rls_policy_grosshaendler_anon_read` | RLS für anon Lesezugriff |
| `add_grosshaendler_typ_fenster` | Typ 'fenster' hinzugefügt |
| `extend_grosshaendler_fields` | Neue Felder (Lieferkosten, Zahlungsziel, etc.) |
| `add_grosshaendler_sortiment_array` | Sortiment als Array |

---

## Relevante Dateien

| Pfad | Änderung |
|------|----------|
| `ui/src/routes/bestellung/+page.svelte` | Großhändler aus DB laden |
| `ui/src/lib/supabase.ts` | Keine Änderung |
| `functions/supabase/functions/parse-bestellung/index.ts` | v5, JWT deaktiviert |

---

## Test-Befehle

```bash
# Dev-Server starten
cd C:\Users\holge\neurealis-erp\ui && npm run dev

# Großhändler prüfen
# Supabase MCP: SELECT * FROM grosshaendler WHERE ist_aktiv = true;

# Edge Function testen
curl -X POST https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/parse-bestellung \
  -H "Content-Type: application/json" \
  -d '{"text": "10 Dreifachrahmen und 5 Steckdosen"}'
```

---

*Erstellt: 2026-01-26*
