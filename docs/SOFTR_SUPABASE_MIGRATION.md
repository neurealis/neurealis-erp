# Softr.io & Monday.com → Supabase Migration

**Status:** ✅ Abgeschlossen
**Letzte Aktualisierung:** 2026-01-24

---

## Übersicht

Bidirektionale Synchronisation zwischen Softr.io/Monday.com und Supabase neurealis ERP.

| Quelle | Ziel | Status |
|--------|------|--------|
| Softr.io Database (16 Tabellen) | neurealis ERP | ✅ Aktiv |
| Monday.com "Bau-Prozess" | neurealis ERP | ✅ Aktiv |
| Softr Attachments (898 Dateien) | neurealis ERP Storage | ✅ Aktiv |

---

## Projekt-Zuordnung

### neurealis ERP (mfpuijttdgkllnvhvjlu) - Geschäftlich

| Datenquelle | Sync-Intervall | Tabelle/Storage |
|-------------|----------------|-----------------|
| Softr.io (16 Tabellen) | 5 Min | Diverse Tabellen |
| Monday.com | 5 Min | `monday_bauprozess` |
| Softr Attachments | 15 Min | Storage `softr-files` |

**Dashboard:** https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu

### LifeOps (rlqkhsgulyyozhetlrqy) - Persönlich

| Datenquelle | Sync-Intervall |
|-------------|----------------|
| Telegram | Echtzeit (Webhook) |
| E-Mail (Posteo, Gmail) | IMAP Worker |
| OneDrive | 1 Stunde |

**Dashboard:** https://supabase.com/dashboard/project/rlqkhsgulyyozhetlrqy

---

## neurealis ERP - Synchronisierte Daten

### Monday.com

| Metrik | Wert |
|--------|------|
| Board | Bau-Prozess (ID: 1545426536) |
| Items | 193 |
| Gruppen | 6 |
| Tabelle | `monday_bauprozess` |

**Gruppen-Verteilung:**
| Gruppe | Anzahl |
|--------|--------|
| (0) Bedarfsanalyse | 12 |
| (2.1) Auftrag erhalten | 3 |
| (4) Bauphase | 4 |
| (5) Rechnungsstellung | 69 |
| (7) Projekt abgeschlossen | 64 |
| (9) Auftrag nicht erhalten | 41 |

### Softr.io Dateien (Storage)

| Tabelle | Synced | Errors | Größe |
|---------|--------|--------|-------|
| Dokumente | 812 | 2 | 187.5 MB |
| Protokolle Abnahmen | 39 | 10 | 120.5 MB |
| Einzelgewerke | 18 | 0 | 1.5 MB |
| Inventar | 11 | 0 | 6.3 MB |
| Ausfuehrungsmaengel | 9 | 0 | 13.0 MB |
| Maengel Fertigstellung | 9 | 0 | 4.5 MB |
| **Gesamt** | **898** | **12** | **~333 MB** |

*Fehler sind 404 (Dateien in Softr.io gelöscht)*

---

## Infrastruktur

### Tabellen (neurealis ERP - 21 Tabellen)

```
# Sync-Infrastruktur
softr_sync_config        # Tabellen-Mapping Softr → Supabase
softr_sync_log           # Sync-Protokoll
file_sync_config         # Attachment-Feld-Mapping (16 Felder)
file_sync_log            # Datei-Sync-Status
monday_bauprozess        # Monday.com Daten (193 Items)
monday_sync_log          # Monday Sync-Protokoll

# Bestehende ERP-Tabellen
projekte                 # Sanierungsprojekte
bedarfsanalysen          # OCR-verarbeitete Bedarfsbögen
angebots_drafts          # Angebotsentwürfe
angebots_positionen      # Angebotspositionen
lv_positionen            # Leistungsverzeichnis
checkbox_lv_mapping      # Checkbox → LV Mapping
raeume                   # Räume mit Maßen
aufmass_data             # Aufmaß-Daten (JSON)
matterport_spaces        # Matterport 3D-Scans
review_queue             # Manuelle Prüfung
tasks                    # Aufgaben
email_accounts           # E-Mail-Konten
emails                   # E-Mails
telegram_conversation_state  # Telegram Bot State
```

### Storage Buckets (neurealis ERP)

| Bucket | Public | Max Size | Verwendung |
|--------|--------|----------|------------|
| `bedarfsanalysen` | 🔒 Nein | 50 MB | Bedarfsanalyse-PDFs |
| `softr-files` | 🔒 Nein | 50 MB | Softr Attachments (~333 MB) |

### Edge Functions (neurealis ERP - 15 Functions)

| Function | Version | Beschreibung |
|----------|---------|--------------|
| `softr-sync` | v4 | Softr.io → Supabase Daten-Sync |
| `monday-sync` | v4 | Monday.com → Supabase |
| `file-sync` | v4 | Softr Attachments → Storage |
| `process-bedarfsanalyse` | v21 | Bedarfsanalyse-Verarbeitung |
| `parse-matterport-csv` | v11 | Matterport CSV Parser |
| `get-matterport-link` | v11 | Matterport Link Generator |
| `telegram-webhook` | v33 | Telegram Bot Webhook |
| `generate-aufmass-excel` | v11 | Excel-Export |
| `process-aufmass-complete` | v13 | Aufmaß-Verarbeitung |
| `sync-matterport-projects` | v9 | Matterport Sync |
| `analyze-csv-gaps` | v8 | CSV Analyse |
| `complete-csv-with-measures` | v8 | CSV Vervollständigung |
| `finalize-angebot` | v19 | Angebot finalisieren |
| `remap-position` | v8 | Position Remapping |
| `export-to-odoo` | v12 | Odoo Export |

**Sync-Endpoints:**
```
https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync
https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/monday-sync
https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/file-sync
```

### Cron Jobs (neurealis ERP)

| Job | Schedule | Funktion |
|-----|----------|----------|
| `softr-sync-job` | `*/5 * * * *` | Softr Daten alle 5 Min |
| `monday-sync-job` | `*/5 * * * *` | Monday Daten alle 5 Min |
| `file-sync-job` | `*/15 * * * *` | Dateien alle 15 Min |

### Secrets (neurealis ERP)

| Secret | Beschreibung |
|--------|--------------|
| `MONDAY_API_KEY` | Monday.com API Token |
| `SOFTR_API_KEY` | Softr Tables API Key |
| `SOFTR_DATABASE_ID` | Softr Database ID |

---

## API-Nutzung

### File-Sync

```bash
# Statistiken abrufen
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/file-sync?mode=stats"

# Neue Dateien entdecken
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/file-sync?mode=discover"

# Dateien verarbeiten (Batch)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/file-sync?mode=process&limit=50"

# Fehlgeschlagene erneut versuchen
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/file-sync?mode=retry"
```

### Monday-Sync

```bash
# Vollständiger Sync
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/monday-sync"
```

### Softr-Sync

```bash
# Alle Tabellen synchronisieren
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync"

# Einzelne Tabelle (nach Softr Table ID)
curl "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/softr-sync?table=kNjsEhYYcNjAsj"
```

---

## Datei-Zugriff (Private Storage)

Da alle Buckets privat sind, müssen signierte URLs verwendet werden:

```typescript
// Im Frontend (mit Auth)
const { data } = await supabase.storage
  .from('softr-files')
  .createSignedUrl('dokumente/record_id/datei.pdf', 3600); // 1 Stunde gültig

// URL verwenden
window.open(data.signedUrl);
```

```sql
-- Im Backend: Datei-URL aus file_sync_log holen
SELECT storage_path, source_filename
FROM file_sync_log
WHERE softr_record_id = 'xyz'
AND sync_status = 'synced';
```

---

## Softr.io Tabellen-Mapping

| Softr Table ID | Softr Name | Supabase Tabelle |
|----------------|------------|------------------|
| `baeVoaT73WSuFr` | Protokolle Abnahmen | `protokolle_abnahmen` |
| `J563LaZ43bZSQy` | Mängel Fertigstellung | `maengel_fertigstellung` |
| `RJGAYKFdDDxosc` | Aufgaben NEU | `softr_aufgaben` |
| `kNjsEhYYcNjAsj` | Dokumente | `softr_dokumente` |
| `XXJFvICfFvbXkY` | Konto Transaktionen | `konto_transaktionen` |
| `VzvQUdlHStrRtN` | Kontakte | `softr_kontakte` |
| `0xZkAxDadNyOMI` | Ausführungsmängel | `ausfuehrungsmaengel` |
| `bLgAqseB1AgVeu` | Einzelgewerke | `einzelgewerke` |
| `bl0tRF2R7aMLYC` | Personal Bewerber | `personal_bewerber` |
| `gGcyZx01A4bDuH` | Logs VAPI | `logs_vapi` |
| `ORCDcA1wFrCzu2` | Angebotserstellung | `softr_angebotserstellung` |
| `va3BbWTn101BXJ` | Leads | `softr_leads` |
| `xvtJVrb2An6wwl` | Inventar | `inventar` |
| `trBGeNEBfm2Jf7` | Projekt Umsatz | `projekt_umsatz` |

---

## Attachment-Felder (16 Felder)

| Softr Tabelle | Feld | Field ID |
|---------------|------|----------|
| Protokolle Abnahmen | Fotos | `IExFL` |
| Protokolle Abnahmen | Unterschrift AG | `h8GfQ` |
| Protokolle Abnahmen | Unterschrift BL | `mwVq2` |
| Mängel Fertigstellung | Fotos_Mangel | `aScwq` |
| Dokumente | Dokument Datei | `MRwYN` |
| Kontakte | Foto/logo | `hBQBB` |
| Ausführungsmängel | Fotos BL | `V7etW` |
| Ausführungsmängel | Fotos NU | `X7P67` |
| Einzelgewerke | Auftrag Kunde | `VgaBH` |
| Einzelgewerke | Rechnung Kunde | `NULcB` |
| Einzelgewerke | Zahlungsavis | `9aEXU` |
| Einzelgewerke | RE NU Datei | `8cOP0` |
| Personal Bewerber | Anlagen | `vtbpv` |
| Inventar | Checkliste Fotos | `38q0Q` |
| Inventar | Unterschrift | `yoxLq` |
| Inventar | Foto | `kyR7U` |

---

## Lokale Dateien

```
C:\Users\holge\neurealis-erp-functions\
└── supabase\
    └── functions\
        ├── file-sync\index.ts      # Datei-Synchronisation
        ├── monday-sync\index.ts    # Monday.com Sync
        └── softr-sync\index.ts     # Softr.io Daten-Sync
```

---

## Credentials

### Softr.io
| Eigenschaft | Wert |
|-------------|------|
| Database ID | `e74de047-f727-4f98-aa2a-7bda298672d3` |
| API Key | `dWhawF85Rw7tqSsaaqmavvmkE` (als Secret gespeichert) |
| API URL | `https://tables-api.softr.io/api/v1` |

### Monday.com
| Eigenschaft | Wert |
|-------------|------|
| Board ID | `1545426536` |
| API Key | Als Secret `MONDAY_API_KEY` gespeichert |
| API URL | `https://api.monday.com/v2` |

### Supabase (neurealis ERP)
| Eigenschaft | Wert |
|-------------|------|
| Ref | `mfpuijttdgkllnvhvjlu` |
| URL | `https://mfpuijttdgkllnvhvjlu.supabase.co` |
| Service Role Key | Siehe `.supabase-config.json` |

---

## Troubleshooting

### Monday API 401 Error
**Ursache:** API Key abgelaufen
**Lösung:** Neuen Token unter https://neurealis.monday.com/ → Developers → My Access Tokens erstellen und als Secret speichern:
```bash
npx supabase secrets set MONDAY_API_KEY="neuer_key" --project-ref mfpuijttdgkllnvhvjlu
```

### File Sync 404 Errors
**Ursache:** Dateien wurden in Softr.io gelöscht
**Lösung:** Diese Fehler können ignoriert werden. Die Einträge bleiben als `error` markiert.

### Softr API Rate Limit
**Symptom:** 429 Too Many Requests
**Lösung:** Sync läuft in Batches (100 Records). Bei Problemen Intervall in Cron Job erhöhen.

### Edge Function Timeout
**Symptom:** Function läuft in Timeout
**Lösung:** Batch-Size reduzieren (`limit=50` statt `limit=100`)

---

*Dokumentation aktualisiert: 2026-01-24*
