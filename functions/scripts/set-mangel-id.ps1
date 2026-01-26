# Set Mangel-ID aus Supabase in Softr
# Die mangel_nr (z.B. ATBS-299-M1) wird in das Text-Feld "Mangel-ID" geschrieben

$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'
$MANGEL_ID_FIELD = '1UqYa'  # Das Feld wurde von FORMULA zu TEXT geändert

$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json'
}

# Mapping von Supabase (softr_record_id -> mangel_nr)
$mangelMapping = @(
    @{ softr_id = "kYyAzm1EAyB6EU"; mangel_nr = "ATBS-200-M1" }
    @{ softr_id = "SXYwmfWyFzYZ8G"; mangel_nr = "ATBS-299-M1" }
    @{ softr_id = "ew7nWZAHN98J3u"; mangel_nr = "ATBS-299-M2" }
    @{ softr_id = "C1NLxca169jv6H"; mangel_nr = "ATBS-299-M3" }
    @{ softr_id = "s8o1FQZhFksakG"; mangel_nr = "ATBS-308-M1" }
    @{ softr_id = "73VejaTGNr0eJb"; mangel_nr = "ATBS-321-M1" }
    @{ softr_id = "491VBKoinCBrBh"; mangel_nr = "ATBS-321-M2" }
    @{ softr_id = "m1ngPPAcT04UV6"; mangel_nr = "ATBS-383-M1" }
    @{ softr_id = "1XhtMm9Hh0BgWP"; mangel_nr = "ATBS-383-M2" }
    @{ softr_id = "HcEJoHjyVfepuA"; mangel_nr = "ATBS-400-M1" }
    @{ softr_id = "a7P0eVtIBOs5mf"; mangel_nr = "ATBS-407-M1" }
    @{ softr_id = "D9jFOrKKX2Ty4g"; mangel_nr = "ATBS-412-M1" }
    @{ softr_id = "K3Ky9FVJYOLtdK"; mangel_nr = "ATBS-412-M2" }
    @{ softr_id = "a3wCTneLKqz14b"; mangel_nr = "ATBS-416-M1" }
    @{ softr_id = "jhHIkfRR70BXsJ"; mangel_nr = "ATBS-430-M1" }
    @{ softr_id = "nWoJe1yGrhhMtG"; mangel_nr = "ATBS-432-M1" }
    @{ softr_id = "vyQnAnT6UmRteS"; mangel_nr = "ATBS-432-M2" }
    @{ softr_id = "ThM2Ka3VBvGeBI"; mangel_nr = "ATBS-432-M3" }
    @{ softr_id = "LuKpdIrMNv60Pt"; mangel_nr = "ATBS-437-M1" }
    @{ softr_id = "FfsMd2PeEaejZt"; mangel_nr = "ATBS-438-M1" }
    @{ softr_id = "pFFXDmyv968aJ6"; mangel_nr = "ATBS-438-M2" }
    @{ softr_id = "Zn134KSrcJzk6Z"; mangel_nr = "ATBS-438-M3" }
    @{ softr_id = "1NkxUKLhB7Ghaj"; mangel_nr = "ATBS-438-M4" }
    @{ softr_id = "jMFtVdrNl7kYYA"; mangel_nr = "ATBS-438-M5" }
    @{ softr_id = "CfrVjiVVR09PgU"; mangel_nr = "ATBS-442-M1" }
    @{ softr_id = "htkIBjQU6AUrhC"; mangel_nr = "ATBS-452-M1" }
    @{ softr_id = "aq8VQbm99T1AIO"; mangel_nr = "ATBS-456-M1" }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setze Mangel-IDs in Softr (27 Einträge)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$successCount = 0
$errorCount = 0

foreach ($mapping in $mangelMapping) {
    $recordId = $mapping.softr_id
    $mangelNr = $mapping.mangel_nr

    $body = @{
        fields = @{
            $MANGEL_ID_FIELD = $mangelNr
        }
    } | ConvertTo-Json -Depth 5

    $updateUrl = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$recordId"

    try {
        Invoke-RestMethod -Uri $updateUrl -Method PATCH -Headers $headers -Body $body | Out-Null
        Write-Host "OK: $recordId -> $mangelNr" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "FEHLER: $recordId ($mangelNr) - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }

    Start-Sleep -Milliseconds 100
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Mangel-ID Update abgeschlossen:" -ForegroundColor Cyan
Write-Host "  Erfolgreich: $successCount" -ForegroundColor Green
Write-Host "  Fehler: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
