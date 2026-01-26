# Update BV-Feld für alle migrierten Ausführungsmängel
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'

$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json'
}

# Alle Mängel vom Typ "Ausführung" abrufen (die migrierten)
Write-Host "Abrufen der Ausführungsmängel..." -ForegroundColor Cyan
$url = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records?limit=100"
$data = Invoke-RestMethod -Uri $url -Headers @{'Softr-Api-Key' = $SOFTR_API_KEY}

# Filter auf Ausführung und leeres BV-Feld
$toUpdate = $data.data | Where-Object {
    $_.fields.'4qiAo'.label -eq 'Ausführung' -and
    $_.fields.FF4FP -and
    -not $_.fields.uaDbm
}

Write-Host "Gefunden: $($toUpdate.Count) Mängel zum Aktualisieren" -ForegroundColor Green

$successCount = 0
$errorCount = 0

foreach ($record in $toUpdate) {
    $recordId = $record.id
    $projektname = $record.fields.FF4FP

    if (-not $projektname) { continue }

    $body = @{
        fields = @{
            uaDbm = $projektname  # BV = Projektname komplett
        }
    } | ConvertTo-Json -Depth 5

    $updateUrl = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$recordId"

    try {
        Invoke-RestMethod -Uri $updateUrl -Method PATCH -Headers $headers -Body $body | Out-Null
        Write-Host "OK: $recordId -> BV = $projektname" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "FEHLER: $recordId - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }

    Start-Sleep -Milliseconds 100
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BV-Feld Update abgeschlossen:" -ForegroundColor Cyan
Write-Host "  Erfolgreich: $successCount" -ForegroundColor Green
Write-Host "  Fehler: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
