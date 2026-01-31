# T3: LV-Analyse VBW Ergebnis

**Status:** Timeout / Fehlgeschlagen
**Datum:** 2026-01-30

## Analyse VBW
- Positionen vorhanden: 313
- Positionen mit Langtext: 313
- Abhängigkeiten erkannt: 0 (Timeout vor Abschluss)

## Edge Function Status
- **Function:** `analyze-lv-dependencies` existiert und ist ACTIVE
- **Problem:** Timeout (504) nach ~150 Sekunden
- **Ursache:** 313 Positionen in 10er-Batches = 32 GPT-Calls, das übersteigt das Supabase Edge Function Timeout

## Logs
```
POST | 504 | analyze-lv-dependencies | execution_time_ms: 150114
POST | 504 | analyze-lv-dependencies | execution_time_ms: 150101
POST | 500 | analyze-lv-dependencies | execution_time_ms: 32269
```

## Beispiel-Abhängigkeiten
| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| - | - | - | Keine Daten aufgrund Timeout |

## Gespeichert
- dry_run: true (geplant)
- In position_dependencies: nein (Timeout)

## Fehler
1. **Gateway Timeout (504):** Supabase Edge Functions haben ein max. Timeout von 150 Sekunden
2. **Zu viele API-Calls:** 313 Positionen / 10 pro Batch = 32 GPT-Calls sequentiell
3. **GPT-5.2 Response-Zeit:** Jeder Call dauert ~5 Sekunden = ~160 Sekunden Minimum

## Empfehlung zur Behebung

### Option A: Kleinere Batches mit Pagination
```typescript
// Neue Endpoints aufrufen:
POST /analyze-lv-dependencies { lv_typ: 'VBW', offset: 0, limit: 50 }
POST /analyze-lv-dependencies { lv_typ: 'VBW', offset: 50, limit: 50 }
// etc.
```

### Option B: Background Job mit pg_cron
- Positionen in Chunks speichern
- Cron-Job verarbeitet 10 Positionen pro Minute
- Ergebnisse werden inkrementell in position_dependencies gespeichert

### Option C: Direkter SQL-Ansatz (ohne GPT)
- Regex-basierte Erkennung von "siehe Pos.", "gem. Pos."
- Pattern-Matching für Zulagen (Position mit "Zulage" im Namen)
- Keine KI, aber schnell und deterministisch

## Nächster Schritt
Die Edge Function muss für große LVs angepasst werden:
1. Pagination-Parameter hinzufügen (offset/limit)
2. Oder: Hintergrund-Verarbeitung via Cron implementieren
