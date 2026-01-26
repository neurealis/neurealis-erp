# Prüfe welche Mängel in Softr keine Mangel-ID haben
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'

$response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records?limit=100" -Headers @{'Softr-Api-Key'=$SOFTR_API_KEY}

Write-Host "Gefunden: $($response.data.Count) Mängel in Softr" -ForegroundColor Cyan
Write-Host ""

$missing = @()
foreach ($record in $response.data) {
    $mangelId = $record.fields.'1UqYa'
    $projektNr = $record.fields.QEcc2

    if (-not $mangelId -or $mangelId -eq '') {
        $missing += [PSCustomObject]@{
            softr_id = $record.id
            projekt_nr = $projektNr
            beschreibung = if ($record.fields.ozrIj) { $record.fields.ozrIj.Substring(0, [Math]::Min(50, $record.fields.ozrIj.Length)) } else { "(leer)" }
        }
    }
}

if ($missing.Count -eq 0) {
    Write-Host "Alle Mängel haben eine Mangel-ID!" -ForegroundColor Green
} else {
    Write-Host "Mängel ohne Mangel-ID: $($missing.Count)" -ForegroundColor Yellow
    Write-Host ""
    $missing | Format-Table -AutoSize
}

# Ausgabe als JSON für weitere Verarbeitung
$missing | ConvertTo-Json | Out-File -FilePath "missing_mangel_ids.json" -Encoding utf8
