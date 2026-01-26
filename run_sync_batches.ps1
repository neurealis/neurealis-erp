# Hero LV Sync - Alle Batches durchlaufen
$baseUrl = "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/hero-lv-sync"

$totalCreated = 0
$totalUpdated = 0
$totalSkipped = 0

for ($offset = 500; $offset -le 3500; $offset += 500) {
    Write-Host "Batch offset $offset..." -ForegroundColor Cyan
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl`?type=products&offset=$offset&limit=500" -TimeoutSec 180
        Write-Host "  Products: $($result.hero_products), Created: $($result.created), Updated: $($result.updated), Skipped: $($result.skipped)"
        $totalCreated += $result.created
        $totalUpdated += $result.updated
        $totalSkipped += $result.skipped

        if (-not $result.has_more) {
            Write-Host "Keine weiteren Produkte." -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "  Fehler: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 2
}

Write-Host "`n=== Zusammenfassung ===" -ForegroundColor Green
Write-Host "Gesamt Erstellt: $totalCreated"
Write-Host "Gesamt Aktualisiert: $totalUpdated"
Write-Host "Gesamt Übersprungen: $totalSkipped"
