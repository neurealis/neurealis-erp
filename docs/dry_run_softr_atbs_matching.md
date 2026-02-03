# Dry Run: Softr AR-A/AR-S ATBS/BV Befüllung

**Datum:** 2026-02-02
**Status:** DRY RUN - Keine Änderungen durchgeführt

---

## Zusammenfassung

| Metrik | Wert |
|--------|------|
| Fehlende Dokumente in Softr | 304 (AR-A: 320, AR-S: 214, davon 304 ohne ATBS/BV) |
| In Hero analysiert (Stichprobe) | 119 |
| In Hero gefunden | 119 (100%) |
| Projekt-Match in Monday gefunden | **78 (66%)** |
| NICHT matchbar | **41 (34%)** |

---

## Analyse-Ergebnis

### Problem-Kategorien bei nicht-matchbaren Dokumenten

| Kategorie | Anzahl | Erklärung |
|-----------|--------|-----------|
| Hero-Projekt nicht in Monday | 39 | Projekt existiert in Hero, aber hat keine ATBS-Nummer in monday_bauprozess |
| Kein Projekt in Hero | 2 | `project_match_id = 0` - Rechnung in Hero ohne Projekt-Zuordnung |

### Fehlende Hero-Projekte in Monday

Diese Hero-Projekt-IDs haben Rechnungen, aber keine ATBS-Nummer in Supabase:

| Hero-Projekt-ID | Betroffene Rechnungen |
|-----------------|----------------------|
| 5904050 | RE-0015107 bis RE-0015133 (17 Rechnungen) |
| 5906183 | RE-0015134 bis RE-0015147 (10 Rechnungen) |
| 5342139 | RE-001598, RE-0015100 (2 Rechnungen) |
| 5712222 | RE-0015104, RE-0015105 (2 Rechnungen) |
| 5923507 | RE-0015158, RE-0015172 (2 Rechnungen) |
| 5431872 | RE-001595 (1 Rechnung) |
| 5425892 | RE-001596 (1 Rechnung) |
| 5405977 | RE-001597 (1 Rechnung) |
| 5103497 | RE-0015101 (1 Rechnung) |
| 5510419 | RE-0015103 (1 Rechnung) |
| 3888777 | RE-0015152 (1 Rechnung) |

**Empfehlung:** Diese Hero-Projekte sollten in Monday/Supabase mit ATBS-Nummern versehen werden, BEVOR das Update durchgeführt wird.

---

## Matchbare Dokumente (würden aktualisiert)

**78 Dokumente** können automatisch mit ATBS und Bauvorhaben befüllt werden:

| Dokument-Nr | Hero-Projekt | ATBS | Bauvorhaben |
|-------------|--------------|------|-------------|
| RE-0015149 | 6193529 | ATBS-310 | VBW - Stockumer Str. 101 - EG rechts |
| RE-0015150 | 6048020 | ATBS-300 | gws - Hörder Rathausstr. 32 44263 Dortmund |
| RE-0015151 | 5953953 | ATBS-296 | gws - Friedrich-Ebert-Str.3,44263 Dortmund |
| RE-0015153 | 6347752 | ATBS-325 | WVB Centuria - Tiergartenstraße 267, Wuppertal |
| RE-0015155 | 6322826 | ATBS-324 | Privat - Fürstenbergerstr. 47, Düsseldorf |
| RE-0015156 | 6453839 | ATBS-335 | gws - Entenpoth 25, Dortmund |
| RE-0015157 | 6453877 | ATBS-336 | gws - Brache 26, Dortmund |
| RE-0015159 | 6061169 | ATBS-302 | gws - Friedrich-Ebert-Str.1, 44263 Dortmund |
| RE-0015160 | 6125340 | ATBS-305 | gws - Im Heidegrund 3, 44267 Dortmund |
| RE-0015163 | 6322826 | ATBS-324 | Privat - Fürstenbergerstr. 47, Düsseldorf |
| RE-0015164 | 6415751 | ATBS-330 | WVB Centuria - Kämpchenstr. 1, Mülheim |
| RE-0015165 | 6545570 | ATBS-345 | WVB Centuria - Stettiner Str. 25, Krefeld |
| RE-0015166 | 6433679 | ATBS-332 | Privat - Mühlhausener Hellweg 15, Unna |
| RE-0015167 | 6181068 | ATBS-308 | VBW - Matthias Claudius Str. 3 Bochum |
| RE-0015168 | 6181080 | ATBS-309 | VBW - Matthias Claudius Str. 25 Bochum |
| RE-0015169 | 6061169 | ATBS-302 | gws - Friedrich-Ebert-Str.1, 44263 Dortmund |
| RE-0015170 | 6443525 | ATBS-334 | VBW - Rebhuhnweg 5, Bochum |
| RE-0015171 | 6125340 | ATBS-305 | gws - Im Heidegrund 3, 44267 Dortmund |
| RE-0015175 | 6322826 | ATBS-324 | Privat - Fürstenbergerstr. 47, Düsseldorf |
| RE-0015176 | 6533742 | ATBS-340 | VBW - Große Weischede Str. 4, Bochum |
| RE-0015177 | 6629796 | ATBS-353 | VBW - Haydnstr. 29, Bochum |
| RE-0015179 | 6534149 | ATBS-343 | VBW - Werner Hellweg 134, Bochum |
| RE-0015180 | 6534122 | ATBS-342 | VBW - Werner Hellweg 114, Bochum |
| RE-0015181 | 6534107 | ATBS-341 | VBW - Laerfeldstr. 51, Bochum |
| RE-0015182 | 6928208 | ATBS-368 | VBW - Werner Hellweg 560, Bochum |
| RE-0015183 | 6239742 | ATBS-311 | Privat - Feuerbachstr.15, Bochum |
| RE-0015184 | 6239742 | ATBS-311 | Privat - Feuerbachstr.15, Bochum |
| RE-0015187 | 6239742 | ATBS-311 | Privat - Feuerbachstr.15, Bochum |
| RE-0015188 | 6308864 | ATBS-321 | WBG - Veilchenweg 6, Lünen |
| RE-0015189 | 6740416 | ATBS-358 | gws - Entenpoth 39, Dortmund |
| RE-0015191 | 6861968 | ATBS-363 | VBW - Staudengarten 12, Bochum |
| RE-0015192 | 6839571 | ATBS-362 | VBW - Gorch-Fock-Str. 31, Bochum |
| RE-0015193 | 6838995 | ATBS-361 | VBW - Haydnstr. 29, Bochum |
| RE-0015194 | 6915439 | ATBS-365 | VBW - Luchsweg 31, Bochum |
| RE-0015195 | 6608341 | ATBS-351 | neurealis - Kleyer Weg 40, Dortmund |
| RE-0015196 | 6915488 | ATBS-367 | VBW - Grüner Weg 93, Bochum |
| RE-0015197 | 7037831 | ATBS-374 | gws - Seekante 13, Dortmund |
| RE-0015198 | 6767272 | ATBS-359 | gws - Langer Rüggen 1, Dortmund |
| RE-0015199 | 7060670 | ATBS-375 | VBW - Luchsweg 44, Bochum |
| RE-0015201 | 6915466 | ATBS-366 | VBW - Soldnerstr. 7, Bochum |
| RE-0015202 | 7060688 | ATBS-376 | VBW - Rebhuhnweg 1, Bochum |
| RE-0015203 | 7060688 | ATBS-376 | VBW - Rebhuhnweg 1, Bochum |
| RE-0015204 | 7154444 | ATBS-393 | GWS - Friedrich-Ebert-Straße 3, Dortmund |
| RE-0015205 | 7296669 | ATBS-399 | VBW - Am Wiesental 20, Bochum |
| RE-0015206 | 7060711 | ATBS-377 | VBW - Gorch-Fock-Str. 33, Bochum |
| RE-0015207 | 7406095 | ATBS-406 | gws - Hörder Bruch 28, Dortmund |
| RE-0015208 | 6938457 | ATBS-369 | gws - Im Heidegrund 3, Dortmund |
| RE-0015209 | 6869964 | ATBS-364 | gws - Aldinghofer Straße 6, Dortmund |
| RE-0015210 | 7075454 | ATBS-380 | gws - Cimbernstr .35, Dortmund |
| RE-0015211 | 7060725 | ATBS-378 | VBW - Rebhuhnweg 11, Bochum |
| ... | ... | ... | ... |

*(und weitere 28 Dokumente)*

---

## NICHT matchbare Dokumente

### Kein Projekt in Hero (project_match_id = 0)

| Dokument-Nr | Grund |
|-------------|-------|
| RE-0015102 | Kein Projekt in Hero zugeordnet |
| RE-0015226 | Kein Projekt in Hero zugeordnet |

**Aktion erforderlich:** Diese Rechnungen müssen in Hero manuell einem Projekt zugeordnet werden.

### Hero-Projekt nicht in Monday/Supabase

| Dokument-Nr | Hero-Projekt-ID | Aktion |
|-------------|-----------------|--------|
| RE-001595 | 5431872 | ATBS-Nummer in Monday anlegen |
| RE-001596 | 5425892 | ATBS-Nummer in Monday anlegen |
| RE-001597 | 5405977 | ATBS-Nummer in Monday anlegen |
| RE-001598 | 5342139 | ATBS-Nummer in Monday anlegen |
| RE-0015100 | 5342139 | ATBS-Nummer in Monday anlegen |
| RE-0015101 | 5103497 | ATBS-Nummer in Monday anlegen |
| RE-0015103 | 5510419 | ATBS-Nummer in Monday anlegen |
| RE-0015104-105 | 5712222 | ATBS-Nummer in Monday anlegen |
| RE-0015107-133 | 5904050 | **17 Rechnungen!** ATBS-Nummer in Monday anlegen |
| RE-0015134-147 | 5906183 | **10 Rechnungen!** ATBS-Nummer in Monday anlegen |
| RE-0015152 | 3888777 | ATBS-Nummer in Monday anlegen |
| RE-0015158, 172 | 5923507 | ATBS-Nummer in Monday anlegen |

---

## Nächste Schritte

### Vor dem echten Update:

1. **[ ] Hero-Projekte ohne ATBS-Nummer identifizieren**
   - Die Projekte 5904050 und 5906183 haben zusammen 27 Rechnungen
   - Diese müssen in Monday mit ATBS-Nummern versehen werden

2. **[ ] Rechnungen ohne Hero-Projekt prüfen**
   - RE-0015102 und RE-0015226 haben keine Projekt-Zuordnung in Hero
   - Manuell in Hero korrigieren

3. **[ ] User-Bestätigung einholen**
   - Alle 78 matchbaren Dokumente würden aktualisiert
   - Geschätzter Netto-Wert: ~1.2 Mio EUR

### Für echtes Update:

```sql
-- Beispiel-Update für matchbare Dokumente (NICHT AUSFÜHREN ohne Bestätigung)
UPDATE softr_dokumente
SET
  atbs_nummer = 'ATBS-XXX',
  bauvorhaben_name = 'Name aus Monday'
WHERE dokument_nr = 'RE-XXXXXXX'
  AND (atbs_nummer IS NULL OR atbs_nummer = '');
```

---

## Technische Details

### Datenquellen

| Quelle | Zweck |
|--------|-------|
| Softr.io API | 304 fehlende AR-A/AR-S Dokumente |
| Hero GraphQL API | `customer_documents` mit `project_match_id` |
| Supabase `monday_bauprozess` | `hero_projekt_id` → `atbs_nummer` Mapping |

### Analyse-Methodik

1. Aus Softr alle AR-A/AR-S Dokumente ohne ATBS-Nummer laden
2. In Hero die Dokumente nach Nummer suchen und `project_match_id` extrahieren
3. In Supabase/Monday das Mapping `hero_projekt_id` → ATBS finden
4. Match-Rate und Probleme dokumentieren

---

*Erstellt am 2026-02-02 durch Claude Opus 4.5*
