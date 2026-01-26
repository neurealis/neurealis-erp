$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$SOURCE_TABLE = '0xZkAxDadNyOMI'
$TARGET_TABLE = 'J563LaZ43bZSQy'

Write-Host "=== QUELL-TABELLE (Ausführungsmängel) ===" -ForegroundColor Cyan
$sourceData = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$SOURCE_TABLE/records?limit=100" -Headers @{'Softr-Api-Key' = $SOFTR_API_KEY}

$sourceWithPhotos = @()
foreach ($r in $sourceData.data) {
    if ($r.fields.V7etW -and $r.fields.V7etW.Count -gt 0) {
        Write-Host "$($r.fields.IvkMt) - $($r.fields.V7etW.Count) Fotos" -ForegroundColor Yellow
        $sourceWithPhotos += $r.fields.IvkMt
    }
}
Write-Host "Gesamt mit Fotos: $($sourceWithPhotos.Count)" -ForegroundColor Green

Write-Host "`n=== ZIEL-TABELLE (Mängel Fertigstellung) - Ausführungstyp ===" -ForegroundColor Cyan
$targetData = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records?limit=100" -Headers @{'Softr-Api-Key' = $SOFTR_API_KEY}

$targetAusfuehrung = $targetData.data | Where-Object { $_.fields.'4qiAo'.label -eq 'Ausführung' }
$targetWithPhotos = 0
foreach ($r in $targetAusfuehrung) {
    if ($r.fields.aScwq -and $r.fields.aScwq.Count -gt 0) {
        Write-Host "Record $($r.id) - $($r.fields.aScwq.Count) Fotos" -ForegroundColor Yellow
        $targetWithPhotos++
    }
}
Write-Host "Gesamt Ausführungsmängel mit Fotos: $targetWithPhotos" -ForegroundColor Green
