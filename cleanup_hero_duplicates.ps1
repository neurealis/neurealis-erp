# Hero Duplikate bereinigen - Artikelnummern mit ALT- Präfix markieren
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

function Invoke-HeroMutation($mutation) {
    $body = @{ query = $mutation } | ConvertTo-Json -Depth 10
    try {
        $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
            "Authorization" = "Bearer $HERO_KEY"
            "Content-Type" = "application/json"
        } -Body $body
        return $response
    } catch {
        return @{ errors = @(@{ message = $_.Exception.Message }) }
    }
}

Write-Host "=== Hero Duplikate bereinigen ===" -ForegroundColor Cyan

# Lade die zu bereinigenden Duplikate
$data = Get-Content "C:\Users\holge\neurealis-erp\hero_duplicates_to_remove.json" -Raw | ConvertFrom-Json

$totalProcessed = 0
$totalSuccess = 0
$totalError = 0

# 1. Identische Duplikate
Write-Host "`n=== Bereinige identische Duplikate ===" -ForegroundColor Yellow
$identicalCount = @($data.identical_to_remove).Count
Write-Host "Zu bereinigen: $identicalCount Duplikat-Gruppen"

foreach ($item in $data.identical_to_remove) {
    $removeIds = @($item.remove_ids)
    foreach ($removeId in $removeIds) {
        $newNr = "DUPLIKAT-$($item.nr)"
        if ($newNr.Length -gt 45) { $newNr = $newNr.Substring(0, 45) }
        $uniqueNr = "$newNr-$($removeId.Substring(0,4))"

        $mutation = @"
mutation {
  update_supply_product_version(supply_product_version: {
    product_id: "$removeId"
    base_data: { name: "[DUPLIKAT] $($item.nr)" }
    nr: "$uniqueNr"
  }) { product_id nr }
}
"@
        $result = Invoke-HeroMutation $mutation
        $totalProcessed++

        if ($result.data -and -not $result.errors) {
            $totalSuccess++
        } else {
            $totalError++
            if ($result.errors) {
                Write-Host "  Fehler $removeId : $($result.errors[0].message)" -ForegroundColor Red
            }
        }
        Start-Sleep -Milliseconds 150
    }
    if ($totalProcessed % 50 -eq 0) {
        Write-Host "  Fortschritt: $totalProcessed verarbeitet, $totalSuccess erfolgreich" -ForegroundColor Gray
    }
}

Write-Host "Identische Duplikate: $totalSuccess erfolgreich, $totalError Fehler" -ForegroundColor $(if ($totalError -eq 0) { "Green" } else { "Yellow" })

# 2. GWS Preis-Duplikate
Write-Host "`n=== Deaktiviere GWS mit niedrigeren Preisen ===" -ForegroundColor Yellow
$gwsCount = @($data.gws_price_to_remove).Count
Write-Host "Zu bereinigen: $gwsCount Duplikat-Gruppen"

$gwsSuccess = 0
$gwsError = 0

foreach ($item in $data.gws_price_to_remove) {
    # Handle sowohl Array als auch einzelnes Objekt
    $removeItems = @($item.remove)

    foreach ($removeItem in $removeItems) {
        $removeId = $removeItem.id
        $oldPrice = $removeItem.price

        if (-not $removeId) { continue }

        $newNr = "ALT-$($item.nr)"
        if ($newNr.Length -gt 45) { $newNr = $newNr.Substring(0, 45) }
        $uniqueNr = "$newNr-$($removeId.Substring(0,4))"

        $displayName = "[ALT $oldPrice EUR] $($item.nr)"
        if ($displayName.Length -gt 100) { $displayName = $displayName.Substring(0, 100) }

        $mutation = @"
mutation {
  update_supply_product_version(supply_product_version: {
    product_id: "$removeId"
    base_data: { name: "$displayName" }
    nr: "$uniqueNr"
  }) { product_id nr }
}
"@
        $result = Invoke-HeroMutation $mutation
        $totalProcessed++

        if ($result.data -and -not $result.errors) {
            $totalSuccess++
            $gwsSuccess++
        } else {
            $totalError++
            $gwsError++
            if ($result.errors) {
                Write-Host "  Fehler $removeId : $($result.errors[0].message)" -ForegroundColor Red
            }
        }
        Start-Sleep -Milliseconds 150
    }
    if ($totalProcessed % 50 -eq 0) {
        Write-Host "  Fortschritt: $totalProcessed verarbeitet, $totalSuccess erfolgreich" -ForegroundColor Gray
    }
}

Write-Host "GWS Preis-Duplikate: $gwsSuccess erfolgreich, $gwsError Fehler" -ForegroundColor $(if ($gwsError -eq 0) { "Green" } else { "Yellow" })

Write-Host "`n=== Zusammenfassung ===" -ForegroundColor Green
Write-Host "Gesamt verarbeitet: $totalProcessed"
Write-Host "Erfolgreich: $totalSuccess" -ForegroundColor Green
Write-Host "Fehler: $totalError" -ForegroundColor $(if ($totalError -gt 0) { "Red" } else { "Green" })
