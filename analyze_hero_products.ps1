$allProducts = @()
for ($offset = 0; $offset -lt 3500; $offset += 500) {
    $body = @{ query = "{ supply_product_versions(first: 500, offset: $offset) { nr internal_identifier base_data { name } supply_operator { name } } }" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "https://login.hero-software.de/api/external/v7/graphql" -Method POST -Headers @{ "Authorization" = "Bearer ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"; "Content-Type" = "application/json" } -Body $body
    $allProducts += $response.data.supply_product_versions
    Write-Host "Batch $offset geladen..."
}

$noOp = $allProducts | Where-Object { $_.supply_operator -eq $null }
Write-Host "`n=== $($noOp.Count) Artikel ohne Lieferant ===`n"

$patterns = @{}
foreach ($p in $noOp) {
    $nr = $p.nr
    if ($nr -match '^[A-Za-z]') {
        $prefix = ($nr -split '[\.\-_0-9]')[0]
    } else {
        $prefix = 'NUMERISCH'
    }
    if (-not $patterns[$prefix]) { $patterns[$prefix] = @() }
    $patterns[$prefix] += $p
}

Write-Host "=== Gruppierung nach Präfix ==="
$patterns.Keys | Sort-Object | ForEach-Object {
    Write-Host "$_ : $($patterns[$_].Count)"
}

Write-Host "`n=== Beispiele mit Buchstaben-Präfix ==="
$patterns.Keys | Where-Object { $_ -ne 'NUMERISCH' } | Sort-Object | ForEach-Object {
    $key = $_
    Write-Host "--- $key ---"
    $patterns[$key] | Select-Object -First 3 | ForEach-Object {
        Write-Host "  $($_.nr) -> $($_.base_data.name)"
    }
}
