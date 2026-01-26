$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

$allDocs = @()
$offset = 0
$limit = 500

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
} while ($allDocs.Count -lt $total)

$docs = $allDocs | ForEach-Object {
    $fields = $_.fields
    $kategorie = $null
    if ($fields.'6tf0K' -and $fields.'6tf0K'.label) {
        $kategorie = $fields.'6tf0K'.label
    }

    [PSCustomObject]@{
        atbs = $fields.'GBc7t'
        kategorie = $kategorie
        bauvorhaben = $fields.'1sWGL'
    }
}

# Nur gültige ATBS-Nummern (Format: ATBS-XXX mit 2-4 Ziffern)
$validPattern = '^ATBS-\d{2,4}$'
$validDocs = $docs | Where-Object { $_.atbs -match $validPattern }

$alleATBS = $validDocs | Select-Object -ExpandProperty atbs -Unique | Sort-Object { [int]($_ -replace 'ATBS-', '') }
$atbsMitAR = $validDocs | Where-Object { $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*' } | Select-Object -ExpandProperty atbs -Unique
$atbsOhneAR = $alleATBS | Where-Object { $_ -notin $atbsMitAR }

Write-Host "=========================================="
Write-Host "PROJEKTE OHNE AUSGANGSRECHNUNG (AR-A/AR-S)"
Write-Host "=========================================="
Write-Host ""
Write-Host "Gültige ATBS-Nummern gesamt: $($alleATBS.Count)"
Write-Host "Davon MIT Ausgangsrechnung:  $($atbsMitAR.Count)"
Write-Host "Davon OHNE Ausgangsrechnung: $($atbsOhneAR.Count)"
Write-Host ""

$result = @()
foreach ($atbs in $atbsOhneAR) {
    $projektDocs = $validDocs | Where-Object { $_.atbs -eq $atbs }
    $bauvorhaben = ($projektDocs | Where-Object { $_.bauvorhaben } | Select-Object -ExpandProperty bauvorhaben -First 1)
    $kategorien = ($projektDocs | Select-Object -ExpandProperty kategorie -Unique | Where-Object { $_ -and $_ -notlike '*null*' }) -join ", "

    $result += [PSCustomObject]@{
        ATBS = $atbs
        Bauvorhaben = $bauvorhaben
        VorhandeneDokumente = $kategorien
    }
}

# Sortiert ausgeben
$result | Sort-Object { [int]($_.ATBS -replace 'ATBS-', '') } | Format-Table -AutoSize -Wrap

# CSV exportieren
$result | Export-Csv -Path "C:\Users\holge\neurealis-erp\projekte_ohne_ar_clean.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "CSV exportiert: projekte_ohne_ar_clean.csv"
