$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

# Alle Dokumente abrufen
$response = Invoke-RestMethod -Uri 'https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?limit=500' -Headers $headers

Write-Host "Total records: $($response.metadata.total)"

# Alle einzigartigen Kategorien sammeln
$kategorien = @{}
$response.data | ForEach-Object {
    $fields = $_.fields
    $kat = $fields.'Art des Dokuments'
    if ($kat) {
        $katValue = if($kat.label) { $kat.label } else { $kat }
        if (-not $kategorien.ContainsKey($katValue)) {
            $kategorien[$katValue] = 0
        }
        $kategorien[$katValue]++
    }
}

Write-Host ""
Write-Host "Alle Kategorien:"
$kategorien.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host "  $($_.Key): $($_.Value) Dokumente"
}
