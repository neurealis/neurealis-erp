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

# Alle Dokumente extrahieren
$docs = $allDocs | ForEach-Object {
    $fields = $_.fields
    $kategorie = $null
    if ($fields.'6tf0K' -and $fields.'6tf0K'.label) {
        $kategorie = $fields.'6tf0K'.label
    }

    # Dokument-Link extrahieren
    $dokLink = $fields.'cIP4K'
    $dokDatei = $null
    if ($fields.'MRwYN' -and $fields.'MRwYN'.Count -gt 0) {
        $dokDatei = ($fields.'MRwYN' | ForEach-Object { $_.url }) -join ", "
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
        nua = $fields.'7xrdk'
        notizen = $fields.'iHzHD'
        ki_infos = $fields.'OKcBc'
        dokument_link = $dokLink
        dokument_datei = $dokDatei
        portal_link = $fields.'xMHBE'
    }
}

# Gruppieren nach Rechnungsnummer
$docsWithReNr = $docs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
$grouped = $docsWithReNr | Group-Object -Property rechnungsnummer
$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

# Sortieren: AR-A/AR-S zuerst, dann andere
$sortedDuplicates = $duplicates | Sort-Object {
    $kategorien = $_.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }
    if ($hasAR) { 0 } else { 1 }
}, Name

# JSON-Output für weitere Verarbeitung
$output = @{
    total_duplicates = $duplicates.Count
    duplicates = @()
}

foreach ($dup in $sortedDuplicates) {
    $dupData = @{
        rechnungsnummer = $dup.Name
        anzahl = $dup.Count
        eintraege = @()
    }

    foreach ($item in $dup.Group | Sort-Object datum_erstellt) {
        $dupData.eintraege += @{
            kategorie = $item.kategorie
            datum = $item.datum_erstellt
            netto = $item.netto
            brutto = $item.brutto
            bauvorhaben = $item.bauvorhaben
            atbs = $item.atbs
            nua = $item.nua
            notizen = if ($item.notizen) { $item.notizen.Substring(0, [Math]::Min(200, $item.notizen.Length)) } else { $null }
            dokument_link = $item.dokument_link
            portal_link = $item.portal_link
            record_id = $item.id
        }
    }

    $output.duplicates += $dupData
}

$output | ConvertTo-Json -Depth 10
