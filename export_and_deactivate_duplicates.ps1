# Hero Duplikate exportieren und in Supabase/Softr deaktivieren
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"
$SUPABASE_URL = "https://mfpuijttdgkllnvhvjlu.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"

function Invoke-HeroQuery($query) {
    $body = @{ query = $query } | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
        "Authorization" = "Bearer $HERO_KEY"
        "Content-Type" = "application/json"
    } -Body $body
    return $response
}

Write-Host "=== Duplikate exportieren und deaktivieren ===" -ForegroundColor Cyan

# 1. Alle markierten Duplikate aus Hero abrufen
Write-Host "`n1. Lade markierte Duplikate aus Hero..."
$allProducts = @()
for ($offset = 0; $offset -lt 4000; $offset += 500) {
    $query = "{ supply_product_versions(first: 500, offset: $offset) { product_id nr base_data { name description } base_price supply_operator { name } } }"
    $result = Invoke-HeroQuery $query
    $allProducts += $result.data.supply_product_versions
    if ($result.data.supply_product_versions.Count -lt 500) { break }
    Start-Sleep -Milliseconds 300
}

# Markierte Duplikate filtern
$markedDuplicates = $allProducts | Where-Object {
    $_.nr -like 'DUPLIKAT-*' -or $_.nr -like 'ALT-*'
}

Write-Host "Gefunden: $($markedDuplicates.Count) markierte Duplikate in Hero"

# 2. Ursprüngliche Artikelnummern extrahieren
$duplicatesData = $markedDuplicates | ForEach-Object {
    $newNr = $_.nr
    # Extrahiere ursprüngliche Artikelnummer (entferne Präfix und ID-Suffix)
    $originalNr = $newNr
    if ($newNr -match '^DUPLIKAT-(.+)-[A-Za-z0-9]{4}$') {
        $originalNr = $Matches[1]
    } elseif ($newNr -match '^ALT-(.+)-[A-Za-z0-9]{4}$') {
        $originalNr = $Matches[1]
    }

    @{
        hero_product_id = $_.product_id
        neue_artikelnummer = $newNr
        urspruengliche_artikelnummer = $originalNr
        bezeichnung = $_.base_data.name
        beschreibung = $_.base_data.description
        preis = $_.base_price
        lieferant = $_.supply_operator.name
        typ = if ($newNr -like 'DUPLIKAT-*') { 'Identisches Duplikat' } else { 'Niedrigerer Preis' }
    }
}

# 3. Als Excel/CSV exportieren (Backup)
Write-Host "`n2. Exportiere Backup nach Excel..."
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "C:\Users\holge\neurealis-erp\backup_deaktivierte_positionen_$timestamp.csv"

$duplicatesData | ForEach-Object {
    [PSCustomObject]@{
        HeroProductID = $_.hero_product_id
        NeueArtikelnummer = $_.neue_artikelnummer
        UrspruenglicheArtikelnummer = $_.urspruengliche_artikelnummer
        Bezeichnung = $_.bezeichnung
        Beschreibung = $_.beschreibung
        Preis = $_.preis
        Lieferant = $_.lieferant
        Typ = $_.typ
        DeaktiviertAm = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
} | Export-Csv -Path $backupPath -NoTypeInformation -Encoding UTF8

Write-Host "Backup gespeichert: $backupPath" -ForegroundColor Green

# 4. In Supabase auf inaktiv setzen
Write-Host "`n3. Setze Positionen in Supabase auf inaktiv..."

# Ursprüngliche Artikelnummern sammeln
$originalNrs = $duplicatesData | ForEach-Object { $_.urspruengliche_artikelnummer } | Select-Object -Unique

Write-Host "Zu deaktivierende Artikelnummern: $($originalNrs.Count)"

# Supabase REST API zum Updaten
$deactivatedCount = 0
$notFoundCount = 0

foreach ($nr in $originalNrs) {
    # Prüfen ob die Position in Supabase existiert
    $checkUrl = "$SUPABASE_URL/rest/v1/lv_positionen?artikelnummer=eq.$([System.Uri]::EscapeDataString($nr))&select=id,artikelnummer"
    try {
        $existing = Invoke-RestMethod -Uri $checkUrl -Method GET -Headers @{
            "apikey" = $SUPABASE_KEY
            "Authorization" = "Bearer $SUPABASE_KEY"
        }

        if ($existing -and $existing.Count -gt 0) {
            # Update auf aktiv=false
            $updateUrl = "$SUPABASE_URL/rest/v1/lv_positionen?artikelnummer=eq.$([System.Uri]::EscapeDataString($nr))"
            $updateBody = @{ aktiv = $false } | ConvertTo-Json

            Invoke-RestMethod -Uri $updateUrl -Method PATCH -Headers @{
                "apikey" = $SUPABASE_KEY
                "Authorization" = "Bearer $SUPABASE_KEY"
                "Content-Type" = "application/json"
                "Prefer" = "return=minimal"
            } -Body $updateBody

            $deactivatedCount++
        } else {
            $notFoundCount++
        }
    } catch {
        Write-Host "  Fehler bei $nr : $_" -ForegroundColor Red
    }

    if ($deactivatedCount % 50 -eq 0 -and $deactivatedCount -gt 0) {
        Write-Host "  Fortschritt: $deactivatedCount deaktiviert..." -ForegroundColor Gray
    }
}

Write-Host "Supabase: $deactivatedCount deaktiviert, $notFoundCount nicht gefunden" -ForegroundColor Green

Write-Host "`n=== Zusammenfassung ===" -ForegroundColor Green
Write-Host "Markierte Duplikate in Hero: $($markedDuplicates.Count)"
Write-Host "Backup exportiert: $backupPath"
Write-Host "In Supabase deaktiviert: $deactivatedCount"
Write-Host "`nHinweis: Die Hero-Positionen wurden bereits umbenannt (DUPLIKAT-/ALT-)."
Write-Host "Eine Löschung in Hero ist über die API nicht möglich."
