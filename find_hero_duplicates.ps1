# Hero Duplikate finden und bereinigen
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

function Invoke-HeroQuery($query) {
    $body = @{ query = $query } | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
        "Authorization" = "Bearer $HERO_KEY"
        "Content-Type" = "application/json"
    } -Body $body
    return $response
}

function Invoke-HeroMutation($mutation) {
    $body = @{ query = $mutation } | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
        "Authorization" = "Bearer $HERO_KEY"
        "Content-Type" = "application/json"
    } -Body $body
    return $response
}

Write-Host "=== Hero Duplikate bereinigen ===" -ForegroundColor Cyan
Write-Host ""

# Alle Products abrufen
Write-Host "Lade alle Products..."
$allProducts = @()
for ($offset = 0; $offset -lt 4000; $offset += 500) {
    $query = "{ supply_product_versions(first: 500, offset: $offset) { product_id nr internal_identifier base_data { name description manufacturer } supply_operator { name id } base_price } }"
    $result = Invoke-HeroQuery $query
    $allProducts += $result.data.supply_product_versions
    Write-Host "  Batch $offset... ($($allProducts.Count) total)"
    if ($result.data.supply_product_versions.Count -lt 500) { break }
    Start-Sleep -Milliseconds 300
}

# Gruppieren nach Artikelnummer
$byNr = $allProducts | Group-Object -Property nr

Write-Host "`n=== 1. Identische Duplikate (gleiche Nr, Preis, Name, Beschreibung) ===" -ForegroundColor Yellow

$identicalDuplicates = @()
foreach ($group in $byNr | Where-Object { $_.Count -gt 1 }) {
    $items = $group.Group
    $first = $items[0]

    # Alle identischen (gleicher Preis, Name, Beschreibung)
    $identical = $items | Where-Object {
        $_.base_price -eq $first.base_price -and
        $_.base_data.name -eq $first.base_data.name -and
        $_.base_data.description -eq $first.base_data.description
    }

    if ($identical.Count -gt 1) {
        $identicalDuplicates += @{
            nr = $group.Name
            keep = $identical[0]  # Behalten
            remove = @($identical | Select-Object -Skip 1)  # Entfernen
        }
    }
}

Write-Host "Gefunden: $($identicalDuplicates.Count) Artikelnummern mit identischen Duplikaten"
Write-Host "Beispiele:"
$identicalDuplicates | Select-Object -First 5 | ForEach-Object {
    Write-Host "  $($_.nr): Behalte ID $($_.keep.product_id), entferne $($_.remove.Count) Duplikat(e)"
}

Write-Host "`n=== 2. GWS Preis-Duplikate (behalte höheren Preis) ===" -ForegroundColor Yellow

$gwsProducts = $allProducts | Where-Object { $_.supply_operator.name -eq 'GWS 2025-01' -or $_.nr -like 'GWS*' }
$gwsByNr = $gwsProducts | Group-Object -Property nr

$gwsPriceDuplicates = @()
foreach ($group in $gwsByNr | Where-Object { $_.Count -gt 1 }) {
    $items = $group.Group | Sort-Object base_price -Descending
    $prices = $items | Select-Object -ExpandProperty base_price -Unique

    if ($prices.Count -gt 1) {
        # Behalte den mit höchstem Preis
        $gwsPriceDuplicates += @{
            nr = $group.Name
            keep = $items[0]  # Höchster Preis
            remove = @($items | Select-Object -Skip 1)  # Niedrigere Preise
        }
    }
}

Write-Host "Gefunden: $($gwsPriceDuplicates.Count) GWS Artikelnummern mit verschiedenen Preisen"
Write-Host "Beispiele:"
$gwsPriceDuplicates | Select-Object -First 5 | ForEach-Object {
    $keepPrice = $_.keep.base_price
    $removePrice = $_.remove[0].base_price
    Write-Host "  $($_.nr): Behalte $keepPrice EUR, entferne $removePrice EUR"
}

# Kombinierte Liste aller zu entfernenden
$allToRemove = @()
$allToRemove += $identicalDuplicates | ForEach-Object { $_.remove } | ForEach-Object { $_ }
$allToRemove += $gwsPriceDuplicates | ForEach-Object { $_.remove } | ForEach-Object { $_ }

Write-Host "`n=== Zusammenfassung ===" -ForegroundColor Green
Write-Host "Identische Duplikate zu entfernen: $($identicalDuplicates | ForEach-Object { $_.remove.Count } | Measure-Object -Sum | Select-Object -ExpandProperty Sum)"
Write-Host "GWS Preis-Duplikate zu deaktivieren: $($gwsPriceDuplicates | ForEach-Object { $_.remove.Count } | Measure-Object -Sum | Select-Object -ExpandProperty Sum)"
Write-Host "Gesamt zu bereinigen: $($allToRemove.Count)"

# Export für Überprüfung
$export = @{
    identical_to_remove = $identicalDuplicates | ForEach-Object {
        @{
            nr = $_.nr
            keep_id = $_.keep.product_id
            remove_ids = $_.remove | ForEach-Object { $_.product_id }
        }
    }
    gws_price_to_remove = $gwsPriceDuplicates | ForEach-Object {
        @{
            nr = $_.nr
            keep_id = $_.keep.product_id
            keep_price = $_.keep.base_price
            remove = $_.remove | ForEach-Object { @{ id = $_.product_id; price = $_.base_price } }
        }
    }
}
$export | ConvertTo-Json -Depth 5 | Out-File "C:\Users\holge\neurealis-erp\hero_duplicates_to_remove.json" -Encoding UTF8
Write-Host "`nDetails exportiert nach hero_duplicates_to_remove.json"
