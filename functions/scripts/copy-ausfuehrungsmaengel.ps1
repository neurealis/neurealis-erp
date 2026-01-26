# Softr API Configuration
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$SOURCE_TABLE = '0xZkAxDadNyOMI'  # Ausführungsmängel
$TARGET_TABLE = 'J563LaZ43bZSQy'  # Mängel nach Fertigstellung

$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json'
}

# Alle Ausführungsmängel abrufen
Write-Host "Abrufen der Ausführungsmängel..." -ForegroundColor Cyan
$sourceUrl = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$SOURCE_TABLE/records?limit=100"
$sourceData = Invoke-RestMethod -Uri $sourceUrl -Headers @{'Softr-Api-Key' = $SOFTR_API_KEY}

Write-Host "Gefunden: $($sourceData.metadata.total) Ausführungsmängel" -ForegroundColor Green

# Status-Mapping (Ausführungsmängel -> Mängel nach Fertigstellung)
$statusMapping = @{
    '(0) Offen' = '(0) Offen'
    '(1) Nicht abgenommen' = '(3) Abgelehnt'
    '(2) Abgenommen' = '(2) Abgeschlossen'
}

$statusNuMapping = @{
    'Offen' = 'Offen'
    'Behoben' = 'Behoben'
}

$successCount = 0
$errorCount = 0
$results = @()

foreach ($record in $sourceData.data) {
    $fields = $record.fields

    # Neues Record für Ziel-Tabelle erstellen
    $targetFields = @{}

    # ProjektNr
    if ($fields.OejLi) { $targetFields['QEcc2'] = $fields.OejLi }

    # NUA-Nr
    if ($fields.C9YbR) { $targetFields['qxHu4'] = $fields.C9YbR }

    # Bauleiter
    if ($fields.wxHLj) { $targetFields['ctNAI'] = $fields.wxHLj }

    # Nachunternehmer
    if ($fields.apm1H) { $targetFields['4uDJM'] = $fields.apm1H }

    # Projektname komplett
    if ($fields.pJBBw) { $targetFields['FF4FP'] = $fields.pJBBw }

    # Beschreibung Mangel
    if ($fields.Zyn8m) { $targetFields['ozrIj'] = $fields.Zyn8m }

    # Kommentar NU
    if ($fields.RtJ9X) { $targetFields['LQPDA'] = $fields.RtJ9X }

    # Status Mangel (mit Mapping)
    if ($fields.'8HFir' -and $fields.'8HFir'.label) {
        $sourceStatus = $fields.'8HFir'.label
        if ($statusMapping.ContainsKey($sourceStatus)) {
            $targetFields['YUT8c'] = $statusMapping[$sourceStatus]
        } else {
            $targetFields['YUT8c'] = '(0) Offen'
        }
    }

    # Status Mangel NU (mit Mapping)
    if ($fields.qJEpT -and $fields.qJEpT.label) {
        $sourceStatusNu = $fields.qJEpT.label
        if ($statusNuMapping.ContainsKey($sourceStatusNu)) {
            $targetFields['mhgIW'] = $statusNuMapping[$sourceStatusNu]
        }
    }

    # Fotos Mangel (Attachment-Handling)
    if ($fields.V7etW -and $fields.V7etW.Count -gt 0) {
        $targetFields['aScwq'] = $fields.V7etW | ForEach-Object {
            @{
                url = $_.url
                filename = $_.filename
            }
        }
    }

    # Fotos Nachweis NU
    if ($fields.X7P67 -and $fields.X7P67.Count -gt 0) {
        $targetFields['zBq5l'] = $fields.X7P67 | ForEach-Object {
            @{
                url = $_.url
                filename = $_.filename
            }
        }
    }

    # Datum Meldung
    if ($fields.'3ElMV') { $targetFields['2la7j'] = $fields.'3ElMV' }

    # Datum Frist
    if ($fields.'3nzTU') { $targetFields['aGWIf'] = $fields.'3nzTU' }

    # Mangel behoben Datum
    if ($fields.RFYoe) { $targetFields['3v0hM'] = $fields.RFYoe }

    # Art des Mangels = "Ausführung"
    $targetFields['4qiAo'] = 'Ausführung'

    # Record erstellen
    $body = @{ fields = $targetFields } | ConvertTo-Json -Depth 10
    $targetUrl = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records"

    try {
        $response = Invoke-RestMethod -Uri $targetUrl -Method POST -Headers $headers -Body $body
        $mangelId = $fields.IvkMt
        Write-Host "OK: $mangelId -> $($response.data.id)" -ForegroundColor Green
        $successCount++
        $results += @{
            source_id = $record.id
            mangel_id = $mangelId
            target_id = $response.data.id
            status = 'success'
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host "FEHLER: $($fields.IvkMt) - $errorMsg" -ForegroundColor Red
        $errorCount++
        $results += @{
            source_id = $record.id
            mangel_id = $fields.IvkMt
            error = $errorMsg
            status = 'error'
        }
    }

    # Rate limiting
    Start-Sleep -Milliseconds 200
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Ergebnis:" -ForegroundColor Cyan
Write-Host "  Erfolgreich: $successCount" -ForegroundColor Green
Write-Host "  Fehler: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan

# Ergebnisse speichern
$results | ConvertTo-Json -Depth 5 | Out-File -FilePath "C:\Users\holge\neurealis-erp\maengel_sync_results.json" -Encoding UTF8
Write-Host "`nErgebnisse gespeichert in: maengel_sync_results.json" -ForegroundColor Yellow
