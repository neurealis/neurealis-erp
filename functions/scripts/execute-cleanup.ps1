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
    $projekt = $r.fields.QEcc2
    $bv = $r.fields.FF4FP
    $beschreibung = $r.fields.ozrIj
    $bauleiter = $r.fields.ctNAI

    # Test-Eintraege identifizieren
    $isTest = $false

    if ($projekt -match 'TEST|test') { $isTest = $true }
    if ($bv -match 'Test|test|API Test') { $isTest = $true }
    if ($beschreibung -match '^fdhdfh$|^ddjdfdhdd$|^Tet infos$') { $isTest = $true }
    if ($bauleiter -match 'Manual Test|test') { $isTest = $true }
    if ($projekt -eq '413' -or $projekt -eq '400') { $isTest = $true }

    if ($isTest) {
        $toDelete += $r
    } else {
        $toUpdate += $r
    }
}

# SCHRITT 1: Loeschen
Write-Host ""
Write-Host "=== SCHRITT 1: LOESCHEN ($($toDelete.Count) Eintraege) ===" -ForegroundColor Red
$deleteCount = 0
foreach ($r in $toDelete) {
    $deleteUrl = "https://tables-api.softr.io/api/v1/databases/$SOFTR_DATABASE_ID/tables/$TARGET_TABLE/records/$($r.id)"
    try {
        Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers | Out-Null
        Write-Host "Geloescht: $($r.id)" -ForegroundColor Yellow
        $deleteCount++
    } catch {
        Write-Host "Fehler beim Loeschen: $($r.id) - $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 100
}
Write-Host "Geloescht: $deleteCount Eintraege" -ForegroundColor Green

# SCHRITT 2: Maengel-IDs ausgeben (fuer Supabase)
Write-Host ""
Write-Host "=== SCHRITT 2: MAENGEL-IDS BERECHNEN ===" -ForegroundColor Cyan

# Gruppiere nach Projekt
$byProject = @{}
foreach ($r in $toUpdate) {
    $projekt = $r.fields.QEcc2
    if (-not $projekt) { $projekt = "UNKNOWN" }
    if (-not $byProject.ContainsKey($projekt)) {
        $byProject[$projekt] = @()
    }
    $byProject[$projekt] += $r
}

# Erstelle Liste fuer Supabase Update
$mangelIds = @()
foreach ($projekt in $byProject.Keys | Sort-Object) {
    $items = $byProject[$projekt] | Sort-Object { $_.createdAt }
    $counter = 1

    foreach ($r in $items) {
        $mangelId = "$projekt-M$counter"
        $mangelIds += @{
            softr_id = $r.id
            projekt = $projekt
            mangel_nr = $mangelId
            beschreibung = $r.fields.ozrIj
        }
        Write-Host "$mangelId - $($r.fields.ozrIj.Substring(0, [Math]::Min(50, $r.fields.ozrIj.Length)))" -ForegroundColor Green
        $counter++
    }
}

# Speichere fuer Supabase
$mangelIds | ConvertTo-Json -Depth 5 | Out-File -FilePath "C:\Users\holge\neurealis-erp\mangel_ids.json" -Encoding UTF8
Write-Host ""
Write-Host "Maengel-IDs gespeichert in: mangel_ids.json" -ForegroundColor Yellow

Write-Host ""
Write-Host "=== FERTIG ===" -ForegroundColor Cyan
Write-Host "Geloescht: $deleteCount" -ForegroundColor Red
Write-Host "IDs generiert: $updateCount" -ForegroundColor Green
