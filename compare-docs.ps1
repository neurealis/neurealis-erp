# Vergleich Hero vs Softr nach Dokumentennummer

# Hero-Dokumente laden
$page1 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01WGNSpHfreRhNkHE7XHc3kV.txt' | ConvertFrom-Json
$page2 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01YAPMKiRz7ytnWqHhS8pNjx.txt' | ConvertFrom-Json
$page3 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_012mqEp48RVTWtr6tLhLTYAL.txt' | ConvertFrom-Json

$heroDocs = @()
$heroDocs += $page1.data.customer_documents
$heroDocs += $page2.data.customer_documents
$heroDocs += $page3.data.customer_documents

# Filter: ab 2025 und gültige Nr
$hero2025 = $heroDocs | Where-Object {
    $_.date -ge '2025-01-01' -and
    $_.nr -and
    $_.nr -notmatch 'xxxx'
}

# Softr-Dokumente laden
$softr1 = Get-Content 'C:\Users\holge\neurealis-erp\softr_docs_1.json' | ConvertFrom-Json
$softr2 = Get-Content 'C:\Users\holge\neurealis-erp\softr_docs_2.json' | ConvertFrom-Json

$softrDocs = @()
$softrDocs += $softr1.data
if ($softr2.data) { $softrDocs += $softr2.data }

Write-Host "=== DOKUMENT-VERGLEICH ===" -ForegroundColor Cyan
Write-Host "Hero-Dokumente ab 2025: $($hero2025.Count)"
Write-Host "Softr-Dokumente gesamt: $($softrDocs.Count)"
Write-Host ""

# Softr-Dokumentennummern extrahieren (Feld 8Ae7U = Dokument-Nr, 7xrdk = NUA-Nr)
$softrNummern = @{}
foreach ($doc in $softrDocs) {
    $dokNr = $doc.fields.'8Ae7U'
    $nuaNr = $doc.fields.'7xrdk'
    $artDok = $doc.fields.'6tf0K'

    if ($dokNr) {
        $softrNummern[$dokNr] = @{ id = $doc.id; art = $artDok }
    }
    if ($nuaNr -and -not $softrNummern.ContainsKey($nuaNr)) {
        $softrNummern[$nuaNr] = @{ id = $doc.id; art = $artDok }
    }
}

Write-Host "Eindeutige Softr-Dokumentennummern: $($softrNummern.Count)"
Write-Host ""

# Vergleich
$gefunden = @()
$nichtGefunden = @()

foreach ($heroDoc in $hero2025) {
    $nr = $heroDoc.nr
    if ($softrNummern.ContainsKey($nr)) {
        $gefunden += [PSCustomObject]@{
            Nr = $nr
            HeroTyp = $heroDoc.type
            SoftrArt = $softrNummern[$nr].art
        }
    } else {
        $nichtGefunden += [PSCustomObject]@{
            Nr = $nr
            HeroTyp = $heroDoc.type
            Betrag = $heroDoc.value
        }
    }
}

Write-Host "=== ERGEBNIS ===" -ForegroundColor Green
Write-Host "Bereits in Softr vorhanden: $($gefunden.Count)" -ForegroundColor Yellow
Write-Host "NICHT in Softr gefunden:    $($nichtGefunden.Count)" -ForegroundColor Red
Write-Host ""

# Gruppierung der gefundenen nach Hero-Typ
Write-Host "=== BEREITS VORHANDEN (nach Hero-Typ) ===" -ForegroundColor Yellow
$gefunden | Group-Object HeroTyp | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("{0,-25} {1,5}" -f $_.Name, $_.Count)
}

Write-Host ""
Write-Host "=== NICHT GEFUNDEN (nach Hero-Typ) ===" -ForegroundColor Red
$nichtGefunden | Group-Object HeroTyp | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("{0,-25} {1,5}" -f $_.Name, $_.Count)
}

# Prüfe ob "gefundene" einen anderen Typ in Softr haben
Write-Host ""
Write-Host "=== TYP-DISKREPANZEN ===" -ForegroundColor Magenta
Write-Host "(Hero-Dokumente die in Softr unter anderem Typ existieren)"
Write-Host ""

$diskrepanzen = $gefunden | Where-Object {
    $heroTyp = $_.HeroTyp
    $softrArt = $_.SoftrArt

    # Mapping prüfen
    $erwartet = switch ($heroTyp) {
        'invoice' { 'AR-' }
        'offer' { 'ANG-' }
        'confirmation' { 'AB ' }
        'measurement' { 'NUA-' }
        'reversal_invoice' { 'AR-X' }
        'calculation' { 'KALK' }
        default { $null }
    }

    if ($erwartet -and $softrArt) {
        -not ($softrArt -like "*$erwartet*")
    } else {
        $false
    }
}

if ($diskrepanzen.Count -gt 0) {
    Write-Host "Gefundene Diskrepanzen: $($diskrepanzen.Count)"
    $diskrepanzen | Select-Object -First 20 | Format-Table -AutoSize
} else {
    Write-Host "Keine Typ-Diskrepanzen gefunden."
}

# Rechnungen spezifisch
Write-Host ""
Write-Host "=== RECHNUNGEN SPEZIFISCH ===" -ForegroundColor Cyan
$heroRechnungen = $hero2025 | Where-Object { $_.type -eq 'invoice' -or $_.type -eq 'reversal_invoice' }
$reGefunden = $heroRechnungen | Where-Object { $softrNummern.ContainsKey($_.nr) }
$reNichtGefunden = $heroRechnungen | Where-Object { -not $softrNummern.ContainsKey($_.nr) }

Write-Host "Hero-Rechnungen ab 2025:     $($heroRechnungen.Count)"
Write-Host "Davon in Softr vorhanden:    $($reGefunden.Count)"
Write-Host "Davon NICHT in Softr:        $($reNichtGefunden.Count)"

if ($reNichtGefunden.Count -gt 0 -and $reNichtGefunden.Count -le 30) {
    Write-Host ""
    Write-Host "Fehlende Rechnungen:"
    $reNichtGefunden | Select-Object nr, type, value, date | Format-Table -AutoSize
}
