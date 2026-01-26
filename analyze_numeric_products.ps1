# Alle numerischen Positionen ohne Lieferant aus Hero abrufen und analysieren

$allProducts = @()
for ($offset = 0; $offset -lt 4000; $offset += 500) {
    $body = @{ query = "{ supply_product_versions(first: 500, offset: $offset) { product_id nr base_data { name description } supply_operator { name } } }" } | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "https://login.hero-software.de/api/external/v7/graphql" -Method POST -Headers @{ "Authorization" = "Bearer ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"; "Content-Type" = "application/json" } -Body $body
        $allProducts += $response.data.supply_product_versions
        Write-Host "Batch $offset geladen... ($($allProducts.Count) total)"
        Start-Sleep -Milliseconds 500
    } catch {
        Write-Host "Fehler bei Batch $offset : $_"
    }
}

# Numerische ohne Lieferant filtern
$numericNoOp = $allProducts | Where-Object {
    $_.supply_operator -eq $null -and
    $_.nr -match '^\d'
}

Write-Host "`n=== $($numericNoOp.Count) numerische Positionen ohne Lieferant ===`n"

# Gewerk-Keywords für Artikelnummer-Generierung
$gewerkKeywords = @{
    'Elektr' = 'Elektrik'
    'Steckdose' = 'Elektrik'
    'Schalter' = 'Elektrik'
    'Kabel' = 'Elektrik'
    'Leitung' = 'Elektrik'
    'Fenster' = 'Fenster'
    'Tür' = 'Tür'
    'Decke' = 'Decke'
    'Wand' = 'Wand'
    'Boden' = 'Boden'
    'Vinyl' = 'Boden'
    'Parkett' = 'Boden'
    'Laminat' = 'Boden'
    'Fliesen' = 'Fliesen'
    'Bad' = 'Bad'
    'Dusch' = 'Bad'
    'Wanne' = 'Bad'
    'WC' = 'Bad'
    'Sanitär' = 'Sanitär'
    'Wasser' = 'Sanitär'
    'Abfluss' = 'Sanitär'
    'Strang' = 'Sanitär'
    'Heiz' = 'Heizung'
    'Rohr' = 'Heizung'
    'Treppe' = 'Treppe'
    'Maler' = 'Maler'
    'Anstrich' = 'Maler'
    'Lackier' = 'Maler'
    'Putz' = 'Maurer'
    'Mauer' = 'Maurer'
    'Asbest' = 'Asbest'
    'Rückbau' = 'Rückbau'
    'Demontage' = 'Rückbau'
    'Entsorgu' = 'Entsorgung'
    'Reinig' = 'Reinigung'
    'Rollo' = 'Rollo'
    'Rollladen' = 'Rollo'
    'Miete' = 'Sonstiges'
    'Zulage' = 'Zulage'
    'Brand' = 'Brandschutz'
}

function Get-Gewerk($name, $beschreibung) {
    $text = "$name $beschreibung".ToLower()
    foreach ($key in $gewerkKeywords.Keys) {
        if ($text -match $key.ToLower()) {
            return $gewerkKeywords[$key]
        }
    }
    return 'Sonstiges'
}

function Clean-String($s) {
    # Umlaute ersetzen, Sonderzeichen entfernen, CamelCase
    $s = $s -replace 'ä', 'ae' -replace 'ö', 'oe' -replace 'ü', 'ue' -replace 'ß', 'ss'
    $s = $s -replace '[^a-zA-Z0-9\s]', ''
    $words = $s -split '\s+' | Where-Object { $_.Length -gt 2 }
    return ($words | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower() }) -join ''
}

function Generate-Artikelnummer($name, $beschreibung) {
    $gewerk = Get-Gewerk $name $beschreibung
    $cleanName = Clean-String $name

    # Kürzen auf max 30 Zeichen
    if ($cleanName.Length -gt 25) {
        $cleanName = $cleanName.Substring(0, 25)
    }

    return "$gewerk-$cleanName"
}

# Ausgabe
Write-Host "Nr`tName`tVorgeschlagene Artikelnummer"
Write-Host "---`t----`t----------------------------"

$numericNoOp | Select-Object -First 30 | ForEach-Object {
    $vorschlag = Generate-Artikelnummer $_.base_data.name $_.base_data.description
    $name = $_.base_data.name
    if ($name.Length -gt 40) { $name = $name.Substring(0,40) + "..." }
    Write-Host "$($_.nr)`t$name`t$vorschlag"
}

# Export als JSON für weiteren Import
$export = $numericNoOp | ForEach-Object {
    @{
        product_id = $_.product_id
        alte_nr = $_.nr
        name = $_.base_data.name
        beschreibung = $_.base_data.description
        neue_artikelnummer = Generate-Artikelnummer $_.base_data.name $_.base_data.description
    }
}

$export | ConvertTo-Json -Depth 3 | Out-File "C:\Users\holge\neurealis-erp\numeric_products_mapping.json" -Encoding UTF8
Write-Host "`nMapping exportiert nach numeric_products_mapping.json"
