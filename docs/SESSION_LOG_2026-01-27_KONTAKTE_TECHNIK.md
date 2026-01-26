# Session-Log: Kontakte Technik-Team

**Datum:** 2026-01-27
**Thema:** Neue Mitarbeiter Technik-Abteilung angelegt

---

## Durchgeführte Änderungen

### Neue Kontakte angelegt

| Kontakt-Nr | Name | E-Mail | Position | Abteilung | Telefon |
|------------|------|--------|----------|-----------|---------|
| 2128 | David Hajdu | david.hajdu@neurealis.de | Handwerker | Technik | +49 162 9497448 |
| 2129 | Imre Pentek | imre.pentek@neurealis.de | Maler | Technik | +36 70 624 0950 |
| 2130 | Zoltan Barsony | zoltan.barsony@neurealis.de | Polier | Technik | +49 176 63866874 |

### Bestehende Kontakte aktualisiert

| Kontakt-Nr | Name | Änderung |
|------------|------|----------|
| 156 | Dirk Jansen | Position: Bauleiter, Abteilung: Technik |
| 1286 | Hannah Bennemann | Telefon: +49 172 524897 |

---

## Kontakte-Übersicht Technik-Team

```sql
-- Alle Technik-Mitarbeiter anzeigen
SELECT kontakt_nr, vorname, nachname, position, email, telefon_mobil
FROM kontakte
WHERE abteilung = 'Technik' AND aktiv = true
ORDER BY nachname;
```

---

## Nächste Schritte / Offen

- [ ] Weitere Mitarbeiter ergänzen falls nötig
- [ ] Fotos für neue Mitarbeiter hinterlegen (foto_url)
- [ ] Ggf. Dubletten bereinigen (mehrere Einträge für Dirk Jansen, Hannah Bennemann vorhanden)

---

## Schnell-Referenz

**Kontakt-IDs für direkten Zugriff:**
- David Hajdu: `kontakt_nr = 2128`
- Imre Pentek: `kontakt_nr = 2129`
- Zoltan Barsony: `kontakt_nr = 2130`
- Dirk Jansen: `kontakt_nr = 156`
- Hannah Bennemann: `kontakt_nr = 1286`

---

*Session beendet: 2026-01-27*
