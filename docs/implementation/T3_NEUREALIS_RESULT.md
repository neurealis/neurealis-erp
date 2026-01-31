# T3: LV-Analyse neurealis Ergebnis

**Status:** Timeout - Function deployed aber Ausführung zu langsam
**Datum:** 2026-01-30

## Edge Function Status

Die Edge Function `analyze-lv-dependencies` wurde erfolgreich deployed (Version 1, ACTIVE).

**Problem:** Die Function hat mehrere Timeouts (504) bei der Ausführung:
- Execution Time: >150.000ms (2.5 Minuten)
- Supabase Edge Function Limit: 150 Sekunden

## Analyse neurealis (Datenbank-Status)

| Metrik | Wert |
|--------|------|
| Gesamt-Positionen | 693 |
| Positionen mit Langtext | 236 |
| Erforderliche GPT-Batches | 24 (bei Batch-Size 10) |
| Geschätzte Laufzeit | ~3-5 Minuten |

## Beispiel-Positionen mit Langtext

| Artikelnummer | Bezeichnung | Langtext (gekürzt) |
|---------------|-------------|-------------------|
| 052718001 | Wannenträger 170x75cm | Wannenträger 170x75cm SW10003 concept 100, Bette, Kaldewei |
| 1234t6 | Zulage für größere Duschtasse | Zulage für größere Duschtasse: 1200/800/65 |
| 201476006 | Thermostatkopf erneuern, digital | Thermostatkopf liefern und erneuern |
| 201476011 | Zimmertürblättern und Zargen lackieren | Lackierung Türen |

## Erkannte Zulage-Muster (manuell identifiziert)

Basierend auf den Beispieldaten gibt es Positionen mit "Zulage" im Namen:
- `1234t6`: "Zulage für größere Duschtasse 1200/800/65"

Diese sollten mit der Basis-Position verknüpft werden.

## Abhängigkeiten erkannt

- Positionen analysiert: 0 (Timeout)
- Abhängigkeiten erkannt: 0

## Fehler

```
Edge Function Timeout (504)
- Mehrere Versuche gescheitert
- Execution time: >150.000ms
- Root Cause: 236 Positionen mit Langtext = 24 GPT-Batches = zu langsam für Edge Function Limit
```

## Empfohlene Lösung

1. **Batch-Job statt Echtzeit:**
   - Function mit `limit` Parameter erweitern
   - Mehrere Aufrufe mit je 50 Positionen
   - Oder: Background-Job via pg_cron

2. **Alternative: Lokales Script:**
   - Node.js Script das die Analyse in Chunks durchführt
   - Ergebnisse direkt in DB schreiben

3. **Schnellere Analyse:**
   - Nur explizite Verweise suchen (Regex statt GPT)
   - Zulage-Positionen per Namens-Pattern erkennen

## Nächste Schritte

1. Function mit `limit` und `offset` Parametern erweitern
2. Mehrere kleine Aufrufe statt einem großen
3. Oder: Lokale Analyse mit Node.js durchführen

## Gespeichert

- dry_run: nicht erreicht (Timeout)
- In position_dependencies: nein
