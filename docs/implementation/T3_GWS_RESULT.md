# T3: LV-Analyse GWS Ergebnis

**Status:** ✅ Erfolg
**Datum:** 2026-01-30

## Edge Function

- **Name:** `analyze-lv-dependencies`
- **Version:** 2
- **Deployed:** ja
- **Features:**
  - `limit`/`offset` Parameter für Batch-Verarbeitung
  - `dry_run` Parameter (true = nur lesen, false = speichern)
  - Batch-GPT-Analyse (10 Positionen pro Call)

## Analyse GWS

| Metrik | Wert |
|--------|------|
| **Positionen gesamt** | 710 |
| **Positionen mit Langtext** | 593 |
| **Analysiert (Batch 1)** | 50 |
| **Abhängigkeiten erkannt** | 33 |

**Quote:** ~66% der analysierten Positionen haben mindestens eine erkannte Abhängigkeit.

## Beispiel-Abhängigkeiten

| Source | Target | Typ | Begründung |
|--------|--------|-----|------------|
| `FLQ-Tischler-Zimmertür` | `GWS-LV24-05.5` | referenced_in_text | Beide beschreiben Zimmertür. FLQ umfasst zusätzlich Zarge, Abbruch/Entsorgung; GWS-LV24-05.5 ist Türblatt-Spezifikation |
| `GWS-LV24-05.5` | `FLQ-Tischler-Zimmertür` | referenced_in_text | Türblatt-Position setzt Zarge/Einbausituation voraus - FLQ deckt das ab |
| `GWS.LV23-01.01.27` | `GWS.LV23-01.01.5` | referenced_in_text | Ausbau Fenster erzeugt Abfall - Container kann erforderlich sein |
| `GWS.LV23-01.01.27` | `GWS.LV23-01.01.6` | referenced_in_text | Entsorgung über Container; Containergröße projektspezifisch |

## Gespeichert

- **dry_run:** true (nur Analyse, nicht gespeichert)
- **In position_dependencies:** nein (erst bei dry_run=false)

## Nächste Schritte

1. **Vollständige Analyse:** Weitere Batches ausführen (offset=50, 100, 150...)
2. **Speichern:** Mit `dry_run: false` aufrufen um Abhängigkeiten zu persistieren
3. **Review:** Erkannte Abhängigkeiten manuell prüfen und ggf. Typ korrigieren

## API-Aufruf

```bash
# Analyse (dry_run)
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/analyze-lv-dependencies" \
  -H "Content-Type: application/json" \
  -d '{"lv_typ": "GWS", "dry_run": true, "limit": 50, "offset": 0}'

# Speichern
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/analyze-lv-dependencies" \
  -H "Content-Type: application/json" \
  -d '{"lv_typ": "GWS", "dry_run": false, "limit": 50, "offset": 0}'
```

## Fehler

Keine Fehler bei der Analyse.

---

*Erstellt: 2026-01-30 via Claude Agent*
