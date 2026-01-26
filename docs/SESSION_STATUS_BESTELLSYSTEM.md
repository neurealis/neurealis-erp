# Session Status - Bestellsystem

**Stand:** 2026-01-26 (aktualisiert)
**Für Chat-Fortsetzung**

---

## Zusammenfassung

Bestellmanagement-Backend fertig. Großhändler aus Monday.com importiert (20 aktiv). UI lädt Projekte und Großhändler aus Datenbank. Artikellisten noch offen.

---

## Was ist fertig

### Datenbank (Supabase)

| Tabelle | Zeilen | Beschreibung |
|---------|--------|--------------|
| `grosshaendler` | 20 | Großhändler mit erweiterten Feldern |
| `bestellartikel` | 0 | Artikelkatalog mit Embedding |
| `bestellungen` | 0 | Bestellkopfdaten |
| `bestellpositionen` | 0 | Einzelpositionen |
| `mitarbeiter` | 0 | Auth-Verknüpfung |

**RPC-Funktion:** `match_bestellartikel` für semantische Artikelsuche

### Edge Function

| Function | Version | Status |
|----------|---------|--------|
| `parse-bestellung` | v5 | ✅ JWT deaktiviert, funktioniert |

### SvelteKit UI

| Feature | Status |
|---------|--------|
| Projekt-Dropdown | ✅ `monday_bauprozess` (Phasen 2,3,4) |
| Großhändler-Dropdown | ✅ `grosshaendler` Tabelle |
| KI-Erkennung | ✅ Edge Function verbunden |
| Artikel-Tabelle | ❌ Demo-Daten |
| Bestellung speichern | ❌ Noch nicht implementiert |

---

## Großhändler (20 aktiv)

| Typ | Anzahl | Beispiele |
|-----|--------|-----------|
| baustoff | 5 | Bauzentrum, BECHER, Keramundo, Linnenbecker, Raab |
| elektro | 1 | Zander (+ sanitaer, heizung, klima) |
| farbe | 3 | MEG, Prosol, ZERO |
| fenster | 1 | B&R |
| sanitaer | 3 | ABEX, ELSPERMANN, GUT |
| werkzeug | 1 | Würth |
| sonstiges | 6 | Amazon, Hellweg, Hornbach, etc. |

**Zander:** Multi-Sortiment (elektro, sanitaer, heizung, klima)

---

## Was fehlt

### Priorität 1 - Großhändler-Daten
- [ ] Kundennummern eintragen
- [ ] Konditionen (Rabatt, Skonto, Zahlungsziel)
- [ ] Lieferbedingungen (Mindestbestellwert, Frei ab)
- [ ] Bestellschluss-Zeiten

### Priorität 2 - Artikellisten
- [ ] Excel/CSV importieren
- [ ] Embeddings generieren
- [ ] UI auf echte Artikel umstellen

### Priorität 3 - Workflow
- [ ] Bestellung speichern
- [ ] Auth für Mitarbeiter
- [ ] E-Mail-Versand

---

## Tabellenstruktur `grosshaendler`

```sql
-- Stammdaten
name, kurzname, typ, sortiment[], kundennummer

-- Bestellung
bestellweg, bestell_email, bestell_telefon, bestellung_bis, shop_url

-- Konditionen
rabatt_prozent, skonto_prozent, skonto_tage, zahlungsziel_tage, zahlart

-- Lieferung
lieferzeit_werktage, lieferkosten, mindestbestellwert, versandkostenfrei_ab

-- Bewertung
bewertung_preise, bewertung_kooperation, bewertung_lieferung (1-5)

-- Ansprechpartner
ansprechpartner_name, ansprechpartner_telefon, ansprechpartner_email
```

---

## Quick Commands

```bash
# Dev-Server starten
cd C:\Users\holge\neurealis-erp\ui && npm run dev

# Läuft auf http://localhost:5173/bestellung

# Großhändler prüfen
# Supabase Dashboard oder MCP
```

---

## Relevante Dateien

| Pfad | Beschreibung |
|------|--------------|
| `docs/NEUREALIS_BESTELLSYSTEM.md` | Hauptdokumentation |
| `docs/SESSION_LOG_2026-01-26_BESTELLSYSTEM_GROSSHAENDLER.md` | Diese Session |
| `ui/src/routes/bestellung/+page.svelte` | Bestellformular |

---

*Aktualisiert: 2026-01-26*
