# Softr Dokumente - Duplikate Analyse

**Erstellt:** 2026-01-28
**Datenbank:** Supabase (mfpuijttdgkllnvhvjlu)
**Tabelle:** `softr_dokumente`

---

## Gesamtstatistik

| Metrik | Wert |
|--------|------|
| **Dokumente gesamt** | 2.000 |
| **Eindeutige dokument_nr** | 1.499 |
| **Duplikate (Überschuss)** | 501 |
| **Duplikat-Quote** | 25,05% |

---

## Kategorisierung der Duplikate

| Kategorie | Anzahl Einträge | Betroffene dokument_nr |
|-----------|-----------------|------------------------|
| Mit dokument_nr | 375 | 86 |
| NULL (keine Nummer) | 202 | 1 |
| "No result" | 6 | 1 |
| "???" (Unbekannt) | 6 | 1 |

---

## Top-Duplikate (nach Anzahl)

### 1. NULL-Einträge (202x)
- **Ursache:** Dokumente ohne dokument_nr
- **Typen:** Gemischt (S Sonstiges, AB, ANG-Ku, AR-S, etc.)
- **Empfehlung:** Prüfen ob diese Dokumente gültig sind oder bereinigt werden sollten

### 2. ANG-0021294 (159x)
- **Typ:** ANG-Ku Angebot Kunde (158x) + A Avis (1x)
- **Betrag:** 49.958,02 EUR (konsistent)
- **Ursache:** Massives Duplikat - vermutlich Sync-Fehler
- **Empfehlung:** Auf 1-2 Einträge reduzieren

### 3. NUA-358 (36x)
- **Typ:** NUA-A (34x) + NUA-S (2x)
- **Betrag:** 17.500,01 EUR
- **Empfehlung:** Auf NUA-A + NUA-S reduzieren

### 4. NUA-365 (7x)
- **Typ:** NUA-A (6x) + NUA-S (1x)
- **Betrag:** 15.168,75 EUR

### 5. "???" und "No result" (je 6x)
- **Ursache:** Fehlgeschlagene Dokumenterkennung
- **Empfehlung:** Manuell prüfen und korrigieren

### 6. NUA-357 (5x)
- **Typ:** NUA-A (2x), NUA-S (2x), Budget-NU-P (1x)
- **Betrag:** 19.855,46 EUR

### 7. ANG-0021284 (5x)
- **Typ:** ANG-Ku (4x) + A Avis (1x)
- **Beträge:** 152.180,92 EUR (3x), 128.101,22 EUR (1x), 65.211,83 EUR (Avis)
- **Empfehlung:** Prüfen - unterschiedliche Beträge deuten auf Versionen hin

---

## Duplikate mit 2-3 Einträgen

### Auftragsbestätigungen (AB)
| dokument_nr | Anzahl | Betrag (EUR) |
|-------------|--------|--------------|
| AB-01340 | 2 | 4.778,08 |
| AB-01341 | 2 | 23.222,88 |
| AB-01342 | 2 | 16.915,57 |
| AB-01343 | 2 | 23.251,06 |
| AB-01344 | 2 | 24.194,88 |
| AB-01345 | 2 | 20.186,09 |
| AB-01346 | 2 | 19.358,73 |
| AB-01347 | 2 | 19.860,01 |
| AB-01335 | 2 | 5,60 |
| AB-01336 | 2 | 7.319,27 |
| AB-01337 | 2 | 23.403,50 |
| AB-01338 | 2 | 51,20 |
| AB-01339 | 2 | 7.319,27 |
| AB-013105 | 2 | 22.981,88 |
| AB-013110 | 2 | 4,00 |

### Angebote (ANG) - Duplikate mit Avis
| dokument_nr | Anzahl | Betrag (EUR) | Bemerkung |
|-------------|--------|--------------|-----------|
| ANG-0021120 | 2 | 7.319,27 | 1x ANG + 1x Avis |
| ANG-0021121 | 2 | 5,60 | 1x ANG + 1x Avis |
| ANG-0021122 | 2 | 111,70 | 1x ANG + 1x Avis |
| ANG-0021123 | 2 | 23.403,50 | 1x ANG + 1x Avis |
| ANG-0021124 | 2 | 9.548,66 | 1x ANG + 1x Avis |
| ANG-0021125 | 2 | 22.201,73 | 1x ANG + 1x Avis |
| ... | ... | ... | (45+ weitere ANG-Duplikate) |

### NU-Aufträge (NUA)
| dokument_nr | Anzahl | Typen |
|-------------|--------|-------|
| NUA-203 | 2 | 2x NUA-S |
| NUA-204 | 2 | 2x NUA-S |
| NUA-205 | 2 | 2x NUA-S |
| NUA-207 | 2 | 2x NUA-S |
| NUA-208 | 2 | 2x NUA-S |
| NUA-209 | 2 | 2x NUA-S |
| NUA-214 | 2 | 2x NUA-S |
| NUA-217 | 2 | 2x NUA-S |
| NUA-288 | 2 | 2x NUA-S |
| NUA-324 | 2 | 2x NUA-S |
| NUA-334 | 2 | 2x NUA-S |
| NUA-342 | 2 | 2x NUA-S |
| NUA-359 | 2 | 2x NUA-S |
| NUA-363 | 3 | 2x NUA-S + 1x NUA-A |
| NUA-364 | 2 | 1x NUA-A + 1x NUA-S |
| NUA-366 | 2 | 2x NUA-S |

### Sonstige
| dokument_nr | Anzahl | Typen |
|-------------|--------|-------|
| ATBS-411-NUB-F | 2 | NUA-S + NUA-A |
| ATBS-439-NUA-S | 2 | NUA-S + ER-M |
| ATBS381-0000059 | 2 | 2x AR-S (unterschiedliche Beträge!) |
| RE20250156 | 2 | ER-NU-M + ER-NU-S |
| 1177 | 2 | 2x ER-NU-S |

---

## Analyse und Handlungsempfehlungen

### Sofort beheben (kritisch)

1. **ANG-0021294** - 159 Duplikate löschen, nur 1 behalten
2. **NULL-Einträge** - 202 Dokumente ohne Nummer prüfen
3. **NUA-358** - Von 36 auf 2 reduzieren (NUA-A + NUA-S)

### Strukturelle Probleme

1. **ANG + Avis Duplikate:**
   - Viele Angebote haben je 1 Eintrag als "ANG-Ku" und 1 als "A Avis"
   - Vermutlich werden Avis-Dokumente als separate Einträge angelegt statt verknüpft
   - Empfehlung: Sync-Logik prüfen

2. **NUA-S Duplikate:**
   - Viele NU-Aufträge haben 2x NUA-S Schluss
   - Vermutlich werden Updates als neue Einträge statt Aktualisierungen gespeichert

3. **ATBS381-0000059:**
   - 2x AR-S mit unterschiedlichen Beträgen (138,58 vs 3.249,81)
   - Manuell prüfen - könnte ein Datenfehler sein

---

## SQL zum Bereinigen

### Duplikate identifizieren (zum manuellen Prüfen)
```sql
SELECT id, dokument_nr, art_des_dokuments, betrag_netto, created_at
FROM softr_dokumente
WHERE dokument_nr IN (
    SELECT dokument_nr FROM softr_dokumente
    GROUP BY dokument_nr HAVING COUNT(*) > 1
)
ORDER BY dokument_nr, created_at;
```

### Neueste behalten, ältere löschen (Beispiel für ANG-0021294)
```sql
-- ACHTUNG: Erst prüfen, dann ausführen!
DELETE FROM softr_dokumente
WHERE dokument_nr = 'ANG-0021294'
AND id NOT IN (
    SELECT id FROM softr_dokumente
    WHERE dokument_nr = 'ANG-0021294'
    ORDER BY created_at DESC
    LIMIT 1
);
```

---

*Hinweis: Vor jeder Löschung Backup erstellen und manuell prüfen!*
