# Maengel-Tabelle aufraeumen und IDs generieren
$SOFTR_API_KEY = 'dWhawF85Rw7tqSsaaqmavvmkE'
$SOFTR_DATABASE_ID = 'e74de047-f727-4f98-aa2a-7bda298672d3'
$TARGET_TABLE = 'J563LaZ43bZSQy'

$headers = @{
    'Softr-Api-Key' = $SOFTR_API_KEY
    'Content-Type' = 'application/json'
}

# Alle Maengel abrufen
Write-Host "=== ALLE MAENGEL ABRUFEN ===" -ForegroundColor Cyan
$data = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records?limit=100" -Headers @{'Softr-Api-Key' = $SOFTR_API_KEY}

Write-Host "Gefunden: $($data.metadata.total) Eintraege" -ForegroundColor Green

# Alle Eintraege analysieren
$toDelete = @()
$toUpdate = @()

foreach ($r in $data.data) {
    $id = $r.id
    $nr = $r.fields.XUtl4
    $projekt = $r.fields.QEcc2
    $bv = $r.fields.FF4FP
    $beschreibung = $r.fields.ozrIj
    $art = $r.fields.'4qiAo'.label
    $bauleiter = $r.fields.ctNAI

    # Test-Eintraege identifizieren
    $isTest = $false

    # Pruefe verschiedene Test-Indikatoren
    if ($projekt -match 'TEST|test') { $isTest = $true }
    if ($bv -match 'Test|test|API Test') { $isTest = $true }
    if ($beschreibung -match '^fdhdfh$|^ddjdfdhdd$|^Tet infos$') { $isTest = $true }
    if ($bauleiter -match 'Manual Test|test') { $isTest = $true }
    if ($projekt -eq '413' -or $projekt -eq '400') { $isTest = $true }

    $shortDesc = "(leer)"
    if ($beschreibung -and $beschreibung.Length -gt 0) {
        $len = [Math]::Min(40, $beschreibung.Length)
        $shortDesc = $beschreibung.Substring(0, $len)
    }

    if ($isTest) {
        Write-Host "LOESCHEN: Nr=$nr Projekt=$projekt Desc=$shortDesc" -ForegroundColor Red
        $toDelete += $r
    } else {
        $toUpdate += $r
    }
}

Write-Host ""
Write-Host "=== ZUSAMMENFASSUNG ===" -ForegroundColor Cyan
Write-Host "Zu loeschen (Test-Eintraege): $($toDelete.Count)" -ForegroundColor Red
Write-Host "Zu behalten: $($toUpdate.Count)" -ForegroundColor Green

# Ausgabe der zu loeschenden
if ($toDelete.Count -gt 0) {
    Write-Host ""
    Write-Host "=== ZU LOESCHENDE EINTRAEGE ===" -ForegroundColor Yellow
    foreach ($r in $toDelete) {
        $p = $r.fields.QEcc2
        $b = $r.fields.FF4FP
        Write-Host "  - ID: $($r.id) Projekt: $p BV: $b"
    }
}

Write-Host ""
Write-Host "Analyse fertig" -ForegroundColor Yellow
