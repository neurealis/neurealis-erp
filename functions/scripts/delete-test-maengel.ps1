# Lösche 3 Test-Mängel aus Softr
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'

$toDelete = @('aacsNrr3S2Tma4', 'BXMeFFP7AP8zWq', 'hPmWLchAL82yAS')

foreach ($id in $toDelete) {
    $url = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$id"
    try {
        Invoke-RestMethod -Uri $url -Method DELETE -Headers @{'Softr-Api-Key'=$SOFTR_API_KEY}
        Write-Host "Gelöscht: $id" -ForegroundColor Green
    } catch {
        Write-Host "Fehler: $id - $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 100
}

Write-Host "`n3 Test-Einträge gelöscht." -ForegroundColor Cyan
