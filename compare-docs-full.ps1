# VollstÃ¤ndiger Vergleich Hero vs Softr (ALLE Dokumente)

# Hero-Dokumente laden
$page1 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01WGNSpHfreRhNkHE7XHc3kV.txt' | ConvertFrom-Json
$page2 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01YAPMKiRz7ytnWqHhS8pNjx.txt' | ConvertFrom-Json
$page3 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_012mqEp48RVTWtr6tLhLTYAL.txt' | ConvertFrom-Json

$heroDocs = @()
$heroDocs += $page1.data.customer_documents
$heroDocs += $page2.data.customer_documents
$heroDocs += $page3.data.customer_documents

# Filter: ab 2025 und gÃ¼ltige Nr
$hero2025 = $heroDocs | Where-Object {
    $_.date -ge '2025-01-01' -and
    $_.nr -and
    $_.nr -notmatch 'xxxx'
}

# ALLE Softr-Dokumente laden (Pagination)
$softrDocs = @()
for ($i = 0; $i -le 3; $i++) {
    $file = "C:\Users\holge\neurealis-erp\softr_all_$i.json"
    if (Test-Path $file) {
        $content = Get-Content $file | ConvertFrom-Json
        if ($content.data) {
            $softrDocs += $content.data
            Write-Host "Seite $i`: $($content.data.Count) Dokumente"
        }
    }
}

Write-Host ""
Write-Host "=== VOLLSTÃ„NDIGER DOKUMENT-VERGLEICH ===" -ForegroundColor Cyan
Write-Host "Hero-Dokumente ab 2025:   $($hero2025.Count)"
Write-Host "Softr-Dokumente GESAMT:   $($softrDocs.Count)"
Write-Host ""

# Softr-Dokumentennummern extrahieren
$softrNummern = @{}
foreach ($doc in $softrDocs) {
    $dokNr = $doc.fields.'8Ae7U'
    $nuaNr = $doc.fields.'7xrdk'
    $artDok = $doc.fields.'6tf0K'

    if ($dokNr) {
        $softrNummern[$dokNr] = @{ id = $doc.id; art = $artDok; record = $doc }
    }
    if ($nuaNr -and -not $softrNummern.ContainsKey($nuaNr)) {
        $softrNummern[$nuaNr] = @{ id = $doc.id; art = $artDok; record = $doc }
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
        $artLabel = ""
        $artObj = $softrNummern[$nr].art
        if ($artObj -is [PSCustomObject] -and $artObj.label) {
            $artLabel = $artObj.label
        } elseif ($artObj -is [string]) {
            $artLabel = $artObj
        }

        $gefunden += [PSCustomObject]@{
            Nr = $nr
            HeroTyp = $heroDoc.type
            SoftrArt = $artLabel
            HeroBetrag = $heroDoc.value
        }
    } else {
        $nichtGefunden += [PSCustomObject]@{
            Nr = $nr
            HeroTyp = $heroDoc.type
            Betrag = $heroDoc.value
            Datum = $heroDoc.date
        }
    }
}

Write-Host "=== ERGEBNIS ===" -ForegroundColor Green
Write-Host "Bereits in Softr vorhanden: $($gefunden.Count)" -ForegroundColor Yellow
Write-Host "NICHT in Softr gefunden:    $($nichtGefunden.Count)" -ForegroundColor Red
Write-Host ""

# Gruppierung
Write-Host "=== BEREITS VORHANDEN (nach Hero-Typ) ===" -ForegroundColor Yellow
$gefunden | Group-Object HeroTyp | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("{0,-25} {1,5}" -f $_.Name, $_.Count)
}

Write-Host ""
Write-Host "=== NICHT GEFUNDEN (nach Hero-Typ) ===" -ForegroundColor Red
$nichtGefunden | Group-Object HeroTyp | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("{0,-25} {1,5}" -f $_.Name, $_.Count)
}

# RECHNUNGEN SPEZIFISCH
Write-Host ""
Write-Host "=== RECHNUNGEN ANALYSE ===" -ForegroundColor Cyan
$heroRechnungen = $hero2025 | Where-Object { $_.type -eq 'invoice' -or $_.type -eq 'reversal_invoice' }
$reGefunden = @()
$reNichtGefunden = @()

foreach ($re in $heroRechnungen) {
    if ($softrNummern.ContainsKey($re.nr)) {
        $artLabel = ""
        $artObj = $softrNummern[$re.nr].art
        if ($artObj -is [PSCustomObject] -and $artObj.label) {
            $artLabel = $artObj.label
        } elseif ($artObj -is [string]) {
            $artLabel = $artObj
        }

        $reGefunden += [PSCustomObject]@{
            Nr = $re.nr
            HeroTyp = $re.type
            SoftrArt = $artLabel
            Betrag = $re.value
        }
    } else {
        $reNichtGefunden += [PSCustomObject]@{
            Nr = $re.nr
            HeroTyp = $re.type
            Betrag = $re.value
            Datum = $re.date
        }
    }
}

Write-Host "Hero-Rechnungen ab 2025:     $($heroRechnungen.Count)"
Write-Host "Davon in Softr vorhanden:    $($reGefunden.Count)" -ForegroundColor Green
Write-Host "Davon NICHT in Softr:        $($reNichtGefunden.Count)" -ForegroundColor Red
Write-Host ""

# Zeige gefundene Rechnungen mit Softr-Typ
Write-Host "=== GEFUNDENE RECHNUNGEN (Typ-Check) ===" -ForegroundColor Yellow
$reGefunden | Format-Table Nr, HeroTyp, SoftrArt, Betrag -AutoSize

# Zeige fehlende Rechnungen
if ($reNichtGefunden.Count -gt 0) {
    Write-Host ""
    Write-Host "=== FEHLENDE RECHNUNGEN ===" -ForegroundColor Red
    $reNichtGefunden | Sort-Object Nr | Format-Table Nr, HeroTyp, Betrag, Datum -AutoSize
}

# PrÃ¼fe auf potenzielle Duplikate (gleiche Nr verschiedene Schreibweise)
Write-Host ""
Write-Host "=== DUPLIKAT-CHECK ===" -ForegroundColor Magenta
$potDup = @()
foreach ($re in $reNichtGefunden) {
    # PrÃ¼fe Varianten: RE-001234 vs RE001234 vs RE-1234
    $nr = $re.Nr
    $variants = @()

    # RE-001234 -> RE001234
    $variants += $nr -replace '-', ''
    # RE-001234 -> RE-1234
    if ($nr -match 'RE-0+(\d+)') {
        $variants += "RE-$($Matches[1])"
        $variants += "RE$($Matches[1])"
    }

    foreach ($v in $variants) {
        if ($softrNummern.ContainsKey($v)) {
            $potDup += [PSCustomObject]@{
                HeroNr = $nr
                SoftrNr = $v
                SoftrArt = $softrNummern[$v].art
            }
        }
    }
}

if ($potDup.Count -gt 0) {
    Write-Host "ACHTUNG: Potenzielle Duplikate mit anderer Schreibweise!"
    $potDup | Format-Table -AutoSize
} else {
    Write-Host "Keine Schreibweisen-Duplikate gefunden."
}

