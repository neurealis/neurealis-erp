$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

Write-Host "Lade Dokumente aus Softr..."

$allDocs = @()
$offset = 0
$limit = 500

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
} while ($allDocs.Count -lt $total)

Write-Host "Dokumente geladen: $($allDocs.Count)"

# Alle Dokumente mit ATBS extrahieren
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
} | Where-Object { $_.atbs -and $_.atbs.Trim() -ne '' }

# Alle eindeutigen ATBS-Nummern
$alleATBS = $docs | Select-Object -ExpandProperty atbs -Unique | Sort-Object

Write-Host "Eindeutige ATBS-Nummern: $($alleATBS.Count)"

# ATBS mit AR-A oder AR-S
$atbsMitAR = $docs | Where-Object { $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*' } | Select-Object -ExpandProperty atbs -Unique

Write-Host "ATBS mit Ausgangsrechnung: $($atbsMitAR.Count)"

# ATBS ohne AR-A/AR-S
$atbsOhneAR = $alleATBS | Where-Object { $_ -notin $atbsMitAR }

Write-Host "ATBS OHNE Ausgangsrechnung: $($atbsOhneAR.Count)"
Write-Host ""
Write-Host "=========================================="
Write-Host "PROJEKTE OHNE AUSGANGSRECHNUNG (AR-A/AR-S)"
Write-Host "=========================================="
Write-Host ""

# Details für jede ATBS ohne AR
$result = @()
foreach ($atbs in $atbsOhneAR) {
    $projektDocs = $docs | Where-Object { $_.atbs -eq $atbs }
    $bauvorhaben = ($projektDocs | Select-Object -ExpandProperty bauvorhaben -First 1)
    $kategorien = ($projektDocs | Select-Object -ExpandProperty kategorie -Unique | Where-Object { $_ }) -join ", "

    $result += [PSCustomObject]@{
        ATBS = $atbs
        Bauvorhaben = $bauvorhaben
        VorhandeneDokumente = $kategorien
    }

    Write-Host "$atbs"
    Write-Host "  Bauvorhaben: $bauvorhaben"
    Write-Host "  Dokumente:   $kategorien"
    Write-Host ""
}

# Als CSV exportieren
$result | Export-Csv -Path "C:\Users\holge\neurealis-erp\projekte_ohne_ar.csv" -NoTypeInformation -Encoding UTF8
Write-Host "CSV exportiert: projekte_ohne_ar.csv"
