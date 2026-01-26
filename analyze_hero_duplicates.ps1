# Hero API Duplikate analysieren
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

function Invoke-HeroQuery($query) {
    $body = @{ query = $query } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
        "Authorization" = "Bearer $HERO_KEY"
        "Content-Type" = "application/json"
    } -Body $body
    return $response
}

# Alle Products abrufen
Write-Host "Lade alle Hero Products..."
$allProducts = @()
for ($offset = 0; $offset -lt 4000; $offset += 500) {
    $query = "{ supply_product_versions(first: 500, offset: $offset) { product_id nr internal_identifier base_data { name description } supply_operator { name } base_price } }"
    $result = Invoke-HeroQuery $query
    $allProducts += $result.data.supply_product_versions
    Write-Host "  Batch $offset... ($($allProducts.Count) total)"
    if ($result.data.supply_product_versions.Count -lt 500) { break }
    Start-Sleep -Milliseconds 300
}

Write-Host "`n=== Duplikat-Analyse ==="

# Gruppieren nach Artikelnummer
$byNr = $allProducts | Group-Object -Property nr

# Echte Duplikate finden (gleiche Nr, gleicher Preis, gleiche Beschreibung)
$duplicates = @()
foreach ($group in $byNr | Where-Object { $_.Count -gt 1 }) {
    $items = $group.Group
    # Prüfen ob wirklich identisch
    $first = $items[0]
    $identical = $items | Where-Object {
        $_.base_price -eq $first.base_price -and
        $_.base_data.name -eq $first.base_data.name -and
        $_.base_data.description -eq $first.base_data.description
    }
    if ($identical.Count -gt 1) {
        $duplicates += @{
            nr = $group.Name
            count = $identical.Count
            items = $identical
            price = $first.base_price
            name = $first.base_data.name
        }
    }
}

Write-Host "`nGefunden: $($duplicates.Count) Artikelnummern mit identischen Duplikaten"
Write-Host "`nBeispiele:"
$duplicates | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.nr) x$($_.count): $($_.name) @ $($_.price) EUR"
}

# GWS Duplikate mit verschiedenen Preisen
Write-Host "`n=== GWS Preis-Duplikate ==="
$gwsProducts = $allProducts | Where-Object { $_.supply_operator.name -eq 'GWS 2025-01' -or $_.nr -like 'GWS*' }
$gwsByNr = $gwsProducts | Group-Object -Property nr

$gwsPriceDupes = @()
foreach ($group in $gwsByNr | Where-Object { $_.Count -gt 1 }) {
    $items = $group.Group
    $prices = $items | Select-Object -ExpandProperty base_price -Unique
    if ($prices.Count -gt 1) {
        $gwsPriceDupes += @{
            nr = $group.Name
            items = $items | Sort-Object base_price -Descending
            prices = $items | ForEach-Object { $_.base_price } | Sort-Object -Descending
        }
    }
}

Write-Host "Gefunden: $($gwsPriceDupes.Count) GWS Artikelnummern mit verschiedenen Preisen"
$gwsPriceDupes | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.nr): Preise = $($_.prices -join ', ')"
}

# Export für weitere Verarbeitung
$export = @{
    identical_duplicates = $duplicates
    gws_price_duplicates = $gwsPriceDupes
    total_products = $allProducts.Count
}
$export | ConvertTo-Json -Depth 5 | Out-File "C:\Users\holge\neurealis-erp\hero_duplicates.json" -Encoding UTF8
Write-Host "`nExportiert nach hero_duplicates.json"
