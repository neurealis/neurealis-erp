# T1: DB-Migration Ergebnis

**Status:** ✅ Erfolg
**Datum:** 2026-01-30

## Erstellte Tabellen
- [x] pricing_profiles
- [x] kunde_pricing
- [x] position_dependencies
- [x] angebote
- [x] angebots_positionen (erweitert um CPQ-Spalten)
- [x] dokument_sequenzen

## RPC Funktionen
- [x] get_next_dokument_nr(p_atbs TEXT, p_typ TEXT)

## Seed-Daten
- [x] 6 Pricing-Profile eingefügt:
  - GWS Basis (Standard, 25% Marge)
  - VBW Basis (22% Marge)
  - Covivio Basis (20% Marge)
  - neurealis Privat (30% Marge)
  - Privataufschlag 15% (30% Marge)
  - Privataufschlag 20% (35% Marge)

## Migration Details

Die Migration wurde in 4 Teilen ausgeführt, da `angebots_positionen` bereits existierte:

1. **cpq_basistabellen_part1**: pricing_profiles, kunde_pricing, position_dependencies
2. **cpq_basistabellen_part2**: angebote
3. **cpq_basistabellen_part3**: angebots_positionen (Spalten-Erweiterung), dokument_sequenzen, get_next_dokument_nr()
4. **cpq_basistabellen_part4**: lv_positionen.ist_favorit, RLS Policies

## RLS Policies erstellt

- angebote: SELECT/INSERT/UPDATE für authenticated
- position_dependencies: ALL für authenticated
- pricing_profiles: SELECT + ALL für authenticated
- kunde_pricing: SELECT + ALL für authenticated

## Indexes erstellt

- idx_dependencies_source_art
- idx_dependencies_lv_typ
- idx_dependencies_active (partial)
- idx_angebote_atbs
- idx_angebote_kunde
- idx_angebote_status
- idx_ang_pos_angebot
- idx_ang_pos_gewerk
- idx_lv_favoriten (partial)

## Fehler (falls vorhanden)
Keine - alle Migrationen erfolgreich ausgeführt.

## Hinweis

Die bestehende `angebots_positionen` Tabelle wurde um CPQ-Spalten erweitert (angebot_id, artikelnummer, bezeichnung, etc.). Die ursprünglichen Spalten (draft_id, checkbox_key, etc.) bleiben erhalten für Rückwärtskompatibilität mit dem Draft-System.
