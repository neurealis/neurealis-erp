# Setze fehlende Mangel-IDs in Softr nach Schema ATBS-XXX-M*
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'
$MANGEL_ID_FIELD = '1UqYa'

$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json; charset=utf-8'
}

# Bestehende max Nummern pro Projekt (aus Supabase)
$maxNummern = @{
    "ATBS-200" = 1
    "ATBS-299" = 3
    "ATBS-308" = 1
    "ATBS-321" = 2
    "ATBS-383" = 2
    "ATBS-400" = 1
    "ATBS-407" = 1
    "ATBS-412" = 2
    "ATBS-416" = 1
    "ATBS-430" = 1
    "ATBS-432" = 3
    "ATBS-437" = 1
    "ATBS-438" = 5
    "ATBS-442" = 1
    "ATBS-452" = 1
}

# Fehlende Mängel (softr_id -> projekt_nr)
$missing = @(
    @{ id = "gMTNbb3MfVVya9"; projekt = "ATBS-412" }
    @{ id = "dZyHp1Ix6AbD9p"; projekt = "ATBS-412" }
    @{ id = "6vdR2hNSihuezX"; projekt = "ATBS-418" }
    @{ id = "CGoN8PK6qBh8oW"; projekt = "ATBS-413" }
    @{ id = "P9bjdFbhtJamxD"; projekt = "ATBS-413" }
    @{ id = "r06w6r17AoPTku"; projekt = "ATBS-413" }
    @{ id = "anp4puhMyk5jng"; projekt = "ATBS-400" }
    @{ id = "QUogtyQZX8VDYk"; projekt = "ATBS-437" }
    @{ id = "Hu4jeGQ8q93zTt"; projekt = "ATBS-383" }
    @{ id = "7bIQS3kdyyo6yE"; projekt = "ATBS-383" }
    @{ id = "yVnp7mw9QrSrj8"; projekt = "ATBS-383" }
    @{ id = "IxJOmvOdzV7Jmi"; projekt = "ATBS-383" }
    @{ id = "gSkNuVUSz8cxMh"; projekt = "ATBS-383" }
    @{ id = "IAuN3bnHju2m8g"; projekt = "ATBS-381" }
    @{ id = "aLVTD9s9eYWIEz"; projekt = "ATBS-425" }
    @{ id = "FAB7FW7HBcchvv"; projekt = "ATBS-427" }
    @{ id = "L1nXMBUUwu8m1J"; projekt = "ATBS-382" }
    @{ id = "RTtCVataypJTmc"; projekt = "ATBS-382" }
    @{ id = "0CwAHIyosUh1Bk"; projekt = "ATBS-382" }
)

# Test-Einträge überspringen (ohne Projekt oder mit "Test" in Beschreibung)
$skipped = @(
    "aacsNrr3S2Tma4"   # Kein Projekt
    "hPmWLchAL82yAS"   # Kein Projekt
    "BXMeFFP7AP8zWq"   # Test-Eintrag ATBS-411
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setze fehlende Mangel-IDs (19 Einträge)" -ForegroundColor Cyan
Write-Host "Übersprungen: $($skipped.Count) Test-Einträge" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

$successCount = 0
$errorCount = 0

foreach ($item in $missing) {
    $projekt = $item.projekt

    # Nächste Nummer berechnen
    if ($maxNummern.ContainsKey($projekt)) {
        $maxNummern[$projekt]++
    } else {
        $maxNummern[$projekt] = 1
    }

    $nextNr = $maxNummern[$projekt]
    $mangelId = "$projekt-M$nextNr"

    $body = @{
        fields = @{
            $MANGEL_ID_FIELD = $mangelId
        }
    } | ConvertTo-Json -Depth 5

    $url = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$($item.id)"

    try {
        Invoke-RestMethod -Uri $url -Method PATCH -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' | Out-Null
        Write-Host "OK: $($item.id) -> $mangelId" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "FEHLER: $($item.id) ($mangelId) - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }

    Start-Sleep -Milliseconds 100
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Mangel-ID Update abgeschlossen:" -ForegroundColor Cyan
Write-Host "  Erfolgreich: $successCount" -ForegroundColor Green
Write-Host "  Fehler: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
