# Update BV und Projektname in Softr für alle Mängel
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'

# Feld-IDs: uaDbm = BV, FF4FP = Projektname komplett
$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json; charset=utf-8'
}

$updates = @(
    @{ id = "kYyAzm1EAyB6EU"; bv = "neurealis residential - Schildstr 7 - GE Ausbau Lager + Fassade" }
    @{ id = "SXYwmfWyFzYZ8G"; bv = "neurealis adastra GmbH - Robertstraße 30, Hamm - DG rechts" }
    @{ id = "ew7nWZAHN98J3u"; bv = "neurealis adastra GmbH - Robertstraße 30, Hamm - DG rechts" }
    @{ id = "C1NLxca169jv6H"; bv = "neurealis adastra GmbH - Robertstraße 30, Hamm - DG rechts" }
    @{ id = "s8o1FQZhFksakG"; bv = "VBW - Matthias Claudius Str. 3 Bochum - 3.OG rechts" }
    @{ id = "73VejaTGNr0eJb"; bv = "WBG | Jücker | Veilchenweg 6, Lünen | EG" }
    @{ id = "491VBKoinCBrBh"; bv = "WBG | Jücker | Veilchenweg 6, Lünen | EG" }
    @{ id = "m1ngPPAcT04UV6"; bv = "vonovia | Brüggerhof | Theodor-Fleitmann-Str. 4, Iserlohn | 2.OG mitte ME008" }
    @{ id = "1XhtMm9Hh0BgWP"; bv = "vonovia | Brueggerhof | Theodor-Fleitmann-Str. 4, Iserlohn | 2.OG mitte ME008" }
    @{ id = "HcEJoHjyVfepuA"; bv = "gws | Hoerder Semerteichstr.168 , Dortmund | EG rechts mitte | Fromme" }
    @{ id = "a7P0eVtIBOs5mf"; bv = "VBW | Gorch-Fock-Str. 4, Bochum | 3. OG rechts | Bauleiter" }
    @{ id = "D9jFOrKKX2Ty4g"; bv = "Quadrat | Goethestr. 3, Wetter | EG rechts | Elbracht" }
    @{ id = "K3Ky9FVJYOLtdK"; bv = "Quadrat | Goethestr. 3, Wetter | EG rechts | Elbracht" }
    @{ id = "a3wCTneLKqz14b"; bv = "VBW | Große Weischede Str. 13, Bochum | 3.OG rechts | Bauleiter" }
    @{ id = "jhHIkfRR70BXsJ"; bv = "gws | Langobardenstrasse 33, Dortmund | EG mitte | Kreutzmann-Regener" }
    @{ id = "nWoJe1yGrhhMtG"; bv = "VBW | Schulenburgstr. 25, Bochum | EG rechts | Bauleiter" }
    @{ id = "vyQnAnT6UmRteS"; bv = "VBW | Schulenburgstr. 25, Bochum | EG rechts | Bauleiter" }
    @{ id = "ThM2Ka3VBvGeBI"; bv = "VBW | Schulenburgstr. 25, Bochum | EG rechts | Bauleiter" }
    @{ id = "LuKpdIrMNv60Pt"; bv = "WBG | Veilchenweg 1, Luenen | 3OG links | Juecker" }
    @{ id = "FfsMd2PeEaejZt"; bv = "Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts" }
    @{ id = "pFFXDmyv968aJ6"; bv = "Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts" }
    @{ id = "Zn134KSrcJzk6Z"; bv = "Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts" }
    @{ id = "1NkxUKLhB7Ghaj"; bv = "Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts" }
    @{ id = "jMFtVdrNl7kYYA"; bv = "Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts" }
    @{ id = "CfrVjiVVR09PgU"; bv = "VBW | In der Delle 6, Bochum | 1.OG links | Bauleiter" }
    @{ id = "htkIBjQU6AUrhC"; bv = "ISRichter | Hainallee 6, Dortmund | EG | Richter" }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update BV-Feld in Softr (26 Einträge)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$successCount = 0
$errorCount = 0

foreach ($update in $updates) {
    $body = @{
        fields = @{
            uaDbm = $update.bv      # BV-Feld
            FF4FP = $update.bv      # Projektname komplett
        }
    } | ConvertTo-Json -Depth 5

    $url = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$($update.id)"

    try {
        $response = Invoke-RestMethod -Uri $url -Method PATCH -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8'
        Write-Host "OK: $($update.id)" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "FEHLER: $($update.id) - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }

    Start-Sleep -Milliseconds 100
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BV Update abgeschlossen:" -ForegroundColor Cyan
Write-Host "  Erfolgreich: $successCount" -ForegroundColor Green
Write-Host "  Fehler: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
