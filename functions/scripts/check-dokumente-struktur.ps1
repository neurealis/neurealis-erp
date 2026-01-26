$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

# Nur 5 Dokumente abrufen zum Analysieren
$response = Invoke-RestMethod -Uri 'https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?limit=5' -Headers $headers

Write-Host "Erste 5 Dokumente - Feldstruktur:"
Write-Host ""

foreach ($doc in $response.data) {
    Write-Host "=== Record ID: $($doc.id) ==="
    $doc.fields.PSObject.Properties | ForEach-Object {
        $value = $_.Value
        if ($value -is [PSCustomObject]) {
            $value = $value | ConvertTo-Json -Compress
        }
        Write-Host "  $($_.Name): $value"
    }
    Write-Host ""
}
