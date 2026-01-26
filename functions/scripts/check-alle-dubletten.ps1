$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

$allDocs = @()
$offset = 0
$limit = 500

Write-Host "Lade alle Dokumente aus Softr..."

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
} while ($allDocs.Count -lt $total)

Write-Host "Total records: $($allDocs.Count)"
Write-Host ""

# Alle Dokumente mit Rechnungsnummer extrahieren
$docs = $allDocs | ForEach-Object {
    $fields = $_.fields
    $kategorie = $null
    if ($fields.'6tf0K' -and $fields.'6tf0K'.label) {
        $kategorie = $fields.'6tf0K'.label
    }

    [PSCustomObject]@{
        id = $_.id
        rechnungsnummer = $fields.'8Ae7U'
        kategorie = $kategorie
        datum_erstellt = $fields.'DAXGa'
        netto = $fields.'QuHkO'
        brutto = $fields.'kukJI'
        bauvorhaben = $fields.'1sWGL'
        atbs = $fields.'GBc7t'
    }
}

# Statistik nach Kategorie
Write-Host "=== STATISTIK NACH KATEGORIE ==="
$docs | Group-Object kategorie | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("  {0,-50} {1,5}" -f $_.Name, $_.Count)
}
Write-Host ""

# Alle Dokumente mit Rechnungsnummer gruppieren
$docsWithReNr = $docs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
Write-Host "Dokumente mit Rechnungsnummer: $($docsWithReNr.Count)"

$grouped = $docsWithReNr | Group-Object -Property rechnungsnummer
$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

Write-Host "Eindeutige Rechnungsnummern: $($grouped.Count)"
Write-Host "Doppelte Rechnungsnummern (gesamt): $($duplicates.Count)"
Write-Host ""

# Aufschlüsselung nach Kategorie-Kombination
Write-Host "=== DUBLETTEN NACH KATEGORIE-KOMBINATION ==="
$dupStats = @{}
foreach ($dup in $duplicates) {
    $kategorien = ($dup.Group | Select-Object -ExpandProperty kategorie | Sort-Object -Unique) -join " + "
    if (-not $dupStats.ContainsKey($kategorien)) {
        $dupStats[$kategorien] = 0
    }
    $dupStats[$kategorien]++
}
$dupStats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host ("  {0,-60} {1,3}" -f $_.Key, $_.Value)
}
Write-Host ""

# Nur AR-A und AR-S Dubletten
$arDocs = $docs | Where-Object { $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*' }
$arWithReNr = $arDocs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
$arGrouped = $arWithReNr | Group-Object -Property rechnungsnummer
$arDuplicates = $arGrouped | Where-Object { $_.Count -gt 1 }

Write-Host "=== NUR AR-A / AR-S ==="
Write-Host "AR-A/AR-S Dokumente gesamt: $($arDocs.Count)"
Write-Host "AR-A/AR-S mit Rechnungsnummer: $($arWithReNr.Count)"
Write-Host "AR-A/AR-S Dubletten: $($arDuplicates.Count)"
