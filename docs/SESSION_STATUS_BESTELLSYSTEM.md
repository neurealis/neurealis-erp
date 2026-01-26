# Session Status - Bestellsystem

**Stand:** 2026-01-26 (aktualisiert)
**Für Chat-Fortsetzung**

---

## Zusammenfassung

Bestellmanagement-Backend fertig. UI lädt Projekte aus `monday_bauprozess` (Phasen 2,3,4). Großhändler/Artikel noch Demo-Daten.

---

## Was ist fertig

### Datenbank (Supabase)

| Tabelle | Zeilen | Beschreibung |
|---------|--------|--------------|
| `grosshaendler` | 0 | Großhändler-Stammdaten |
| `bestellartikel` | 0 | Artikelkatalog mit Embedding |
| `bestellungen` | 0 | Bestellkopfdaten |
| `bestellpositionen` | 0 | Einzelpositionen |
| `mitarbeiter` | 0 | Auth-Verknüpfung |

**RPC-Funktion:** `match_bestellartikel` für semantische Artikelsuche

### Edge Function

| Function | Version | Beschreibung |
|----------|---------|--------------|
| `parse-bestellung` | v2 | Mehrsprachiges KI-Parsing (DE, HU, RU, RO) mit gpt-5.2 |

### SvelteKit UI

| Datei | Status |
|-------|--------|
| `ui/src/routes/bestellung/+page.svelte` | Grundgerüst fertig |
| `ui/src/lib/supabase.ts` | Client + parseArtikelText() |

**UI-Lookups:**
- ✅ Projekte → `monday_bauprozess` (live aus Supabase)
- ✅ Projekt-Filter → Phasen (2), (3), (4) aktiv
- ✅ RLS Policy `anon_read_bauprozess` hinzugefügt
- ❌ Großhändler → Demo-Daten (hardcoded)
- ❌ Artikel → Demo-Daten (hardcoded)

**Monday-Sync:**
- Edge Function `monday-sync` verfügbar
- Letzter Sync: 2026-01-26
- 194 Projekte synchronisiert

---

## Was fehlt

### Priorität 1 - Daten

1. **Artikellisten importieren** (Excel vom User)
2. **Großhändler-Stammdaten** anlegen
3. **Embeddings generieren** für Artikel

### Priorität 2 - UI anpassen

1. UI auf neue Tabellen umstellen:
   - `grosshaendler` statt Demo-Array ← **OFFEN**
   - `bestellartikel` statt Demo-Array ← **OFFEN**
2. ~~Projekt-Lookup erweitern~~ ✅ ERLEDIGT
   - ~~Quelle: `monday_bauprozess`~~
   - ~~Filter: Nur Phasen (2), (3), (4)~~
3. Bestellung speichern implementieren
4. Auth für Mitarbeiter-Login

### Priorität 3 - Workflow

1. E-Mail-Versand (Graph API)
2. Wareneingang-Checklist
3. Status-Tracking

---

## Nächste Schritte

```
1. Artikellisten bereitstellen (Excel/CSV)
2. Import-Script schreiben
3. Embeddings generieren
4. UI auf echte Daten umstellen
```

---

## Relevante Dateien

| Pfad | Beschreibung |
|------|--------------|
| `docs/NEUREALIS_BESTELLSYSTEM.md` | Hauptdokumentation |
| `docs/SESSION_LOG_2026-01-26_BESTELLMANAGEMENT_DB.md` | DB-Migration Details |
| `ui/src/routes/bestellung/+page.svelte` | Bestellformular |
| `ui/src/lib/supabase.ts` | Supabase Client |

---

## Quick Commands

```bash
# Dev-Server starten
cd C:\Users\holge\neurealis-erp\ui && npm run dev

# Läuft auf http://localhost:5173

# Tabellen prüfen
# → Supabase MCP: list_tables
```

---

*Erstellt: 2026-01-26*
