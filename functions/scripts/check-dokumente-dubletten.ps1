$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

# Feld-IDs aus Softr Schema:
# 6tf0K = Art des Dokuments
# 8Ae7U = Dokument-Nr (Rechnungsnummer)
# DAXGa = Datum erstellt
# QuHkO = Betrag (netto)
# kukJI = Betrag (brutto)
# 1sWGL = Bauvorhaben
# GBc7t = ATBS-Nr

$allDocs = @()
$offset = 0
$limit = 500

Write-Host "Lade alle Dokumente aus Softr..."

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
    Write-Host "  Geladen: $($allDocs.Count) / $total"
} while ($allDocs.Count -lt $total)

Write-Host "Total records: $($allDocs.Count)"

# Filter für AR-A und AR-S
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
} | Where-Object {
    $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*'
}

Write-Host "AR-A/AR-S Dokumente: $($docs.Count)"

# Gruppieren nach Rechnungsnummer
$grouped = $docs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' } | Group-Object -Property rechnungsnummer

$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

Write-Host "Dubletten gefunden: $($duplicates.Count)"
Write-Host ""

if ($duplicates.Count -eq 0) {
    Write-Host "Keine Dubletten bei AR-A/AR-S Rechnungsnummern gefunden."
} else {
    Write-Host "=============================================="
    Write-Host "DUBLETTEN BEI AUSGANGSRECHNUNGEN (AR-A / AR-S)"
    Write-Host "=============================================="
    Write-Host ""

    foreach ($dup in $duplicates | Sort-Object Name) {
        Write-Host "RECHNUNGSNUMMER: $($dup.Name) ($($dup.Count) Einträge)"
        Write-Host "----------------------------------------------"
        foreach ($item in $dup.Group | Sort-Object datum_erstellt) {
            Write-Host "  Kategorie:   $($item.kategorie)"
            Write-Host "  Datum:       $($item.datum_erstellt)"
            Write-Host "  Netto:       $($item.netto)"
            Write-Host "  Brutto:      $($item.brutto)"
            Write-Host "  Bauvorhaben: $($item.bauvorhaben)"
            Write-Host "  ATBS:        $($item.atbs)"
            Write-Host "  Record-ID:   $($item.id)"
            Write-Host ""
        }
        Write-Host ""
    }
}
