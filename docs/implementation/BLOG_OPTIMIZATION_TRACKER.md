# Blog-Optimierung Tracker

**Erstellt:** 2026-01-31
**Status:** In Arbeit

---

## Aufgaben

### T1 - Leerstand-Artikel überarbeiten
**Status:** done
**Subagent:** blog-quality-agent
**Output:** `docs/implementation/t1_leerstand_revision.md`
**Erledigt:** 2026-01-31

**Anforderungen:**
- Schreibstil anspruchsvoller (B2B-Vermieter-Niveau)
- Keine simplen Bullet-Point-Listen
- Tiefere Analyse, mehr Substanz
- Fließtext mit Zwischenüberschriften
- Professioneller Ton, keine Plattitüden

**Ergebnis:**
- Artikel komplett neu geschrieben (~2.100 Wörter)
- 3-Block-Methode als systematisches Framework eingeführt
- Alle Bullet-Listen in Fließtext umgewandelt
- Konkrete Beispielrechnung mit Zahlen durchgerechnet
- neurealis-USPs subtil als Lösungsansatz integriert
- 4 neue Learnings (L122-L125) in docs/learnings.md dokumentiert

---

### T2 - WordPress-Struktur analysieren
**Status:** done
**Subagent:** wordpress-analysis-agent
**Output:** `docs/implementation/t2_wordpress_struktur.md`

**Anforderungen:**
- Alle veröffentlichten Seiten/Posts auflisten
- Kategorien und Tags erfassen
- URL-Struktur dokumentieren
- Broken Links identifizieren (falls möglich)
- Meta-Descriptions Status prüfen
- Vorbereitung für AHREFS-Analyse

---

### T3 - Template "Sanierung Eigenheim Dortmund" erstellen
**Status:** done (2026-01-31)
**Subagent:** template-creation-agent
**Output:** `docs/implementation/t3_eigenheim_template.md`

**Vorlage:** https://neurealis.de/sanierung-mehrfamilienhaus-nrw/
**Ziel-Keyword:** "Sanierung Eigenheim Dortmund"
**Zielgruppe:** Mittelklasse, "Golfklasse"-Käufer
- Praktisch orientiert
- Nicht übertrieben anspruchsvoll
- Sauber, langfristig, nachhaltig
- Eigenheim = EFH, DHH, Reihenhaus

**Lieferung:**
- Vollständiger Artikel-Text
- Meta-Title
- Meta-Description
- Slug
- Als WordPress-Draft speichern

---

## Qualitätsrichtlinien (für alle Artikel)

### Schreibstil
- Professionell, aber nicht steif
- Fachlich fundiert mit konkreten Zahlen
- Keine generischen Füllsätze
- Aktive Sprache, direkte Ansprache
- Absätze statt Bullet-Listen wo möglich

### SEO
- Keyword natürlich im Text (nicht stuffing)
- H2/H3-Struktur sinnvoll
- Meta-Description 150-160 Zeichen
- Interne Verlinkung zu anderen Artikeln

### neurealis-Bezug
- USPs subtil einweben (98% Termintreue, Fixpreis)
- CTA am Ende (Sanierungskompass, Erstberatung)
- Lokaler Bezug Ruhrgebiet/Dortmund

---

## Koordination

Subagenten schreiben ihre Ergebnisse in die jeweiligen Output-Dateien.
Nach Abschluss: Status auf "done" setzen.

---

*Tracker erstellt: 2026-01-31*
