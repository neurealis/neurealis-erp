# Analyse: Was wuerde bei Updates geaendert?

# Hero-Dokumente laden
$page1 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01WGNSpHfreRhNkHE7XHc3kV.txt" | ConvertFrom-Json
$page2 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01YAPMKiRz7ytnWqHhS8pNjx.txt" | ConvertFrom-Json
$page3 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_012mqEp48RVTWtr6tLhLTYAL.txt" | ConvertFrom-Json

$heroDocs = @()
$heroDocs += $page1.data.customer_documents
$heroDocs += $page2.data.customer_documents
$heroDocs += $page3.data.customer_documents

$hero2025 = $heroDocs | Where-Object { $_.date -ge "2025-01-01" -and $_.nr -and $_.nr -notmatch "xxxx" }

# Softr-Dokumente laden (alle Seiten)
$softrDocs = @()
for ($i = 0; $i -le 3; $i++) {
    $file = "C:\Users\holge\neurealis-erp\softr_all_$i.json"
    if (Test-Path $file) {
        $content = Get-Content $file | ConvertFrom-Json
        if ($content.data) { $softrDocs += $content.data }
    }
}

# Softr-Nummern mit allen Details
$softrMap = @{}
foreach ($doc in $softrDocs) {
    $dokNr = $doc.fields."8Ae7U"
    $nuaNr = $doc.fields."7xrdk"
    if ($dokNr) { $softrMap[$dokNr] = $doc }
    if ($nuaNr -and -not $softrMap.ContainsKey($nuaNr)) { $softrMap[$nuaNr] = $doc }
}

# Hero-Typ zu Softr-Mapping
$heroToSoftr = @{
    "offer" = "ANG-Ku Angebot Kunde"
    "confirmation" = "AB Auftragsbestaetigung"
    "measurement" = "NUA-S NU-Auftrag Schluss"
    "calculation" = "KALK Kalkulation"
    "invoice_notice" = "AVIS Avis"
    "generic" = "SONST Sonstiges"
}

# Finde Updates (keine Rechnungen, aber in Softr vorhanden)
$updates = @()
foreach ($hero in $hero2025) {
    $nr = $hero.nr
    $isRechnung = ($hero.type -eq "invoice" -or $hero.type -eq "reversal_invoice") -and $nr -match "^RE-"

    if (-not $isRechnung -and $softrMap.ContainsKey($nr)) {
        $softr = $softrMap[$nr]
        $softrArt = $softr.fields."6tf0K"
        $softrArtLabel = if ($softrArt.label) { $softrArt.label } else { $softrArt }
        $softrNetto = $softr.fields."QuHkO"
        $softrBrutto = $softr.fields."kukJI"
        $softrDatum = $softr.fields."DAXGa"
        $softrNotizen = $softr.fields."iHzHD"

        $heroArt = $heroToSoftr[$hero.type]
        $heroNetto = $hero.value
        $heroBrutto = $hero.value + $hero.vat
        $heroDatum = $hero.date

        $updates += [PSCustomObject]@{
            Nr = $nr
            HeroTyp = $hero.type
            SoftrArt = $softrArtLabel
            HeroArt = $heroArt
            SoftrNetto = $softrNetto
            HeroNetto = $heroNetto
            SoftrBrutto = $softrBrutto
            HeroBrutto = $heroBrutto
            SoftrDatum = $softrDatum
            HeroDatum = $heroDatum
            HatNotizen = if ($softrNotizen) { "Ja" } else { "Nein" }
        }
    }
}

Write-Host "=== UPDATE-ANALYSE ===" -ForegroundColor Cyan
Write-Host "Dokumente die aktualisiert wuerden: $($updates.Count)"
Write-Host ""

# Nach Typ gruppieren
Write-Host "=== NACH TYP ===" -ForegroundColor Yellow
$updates | Group-Object HeroTyp | Sort-Object Count -Descending | ForEach-Object {
    Write-Host ("{0,-20} {1,5}" -f $_.Name, $_.Count)
}

# Felder die sich aendern wuerden
Write-Host ""
Write-Host "=== FELDER DIE UEBERSCHRIEBEN WERDEN ===" -ForegroundColor Magenta
Write-Host "- Dokument-Nr (8Ae7U)"
Write-Host "- Art des Dokuments (6tf0K)"
Write-Host "- Betrag Netto (QuHkO)"
Write-Host "- Betrag Brutto (kukJI)"
Write-Host "- Datum erstellt (DAXGa)"
Write-Host "- Notizen (iHzHD) -> wird mit 'Hero-Import: [timestamp]' ueberschrieben!"
Write-Host ""

# Pruefen: Wie viele haben Notizen die verloren gehen wuerden?
$mitNotizen = $updates | Where-Object { $_.HatNotizen -eq "Ja" }
Write-Host "Dokumente mit Notizen die ueberschrieben wuerden: $($mitNotizen.Count)" -ForegroundColor Red

# Pruefen: Art-Diskrepanzen (unterschiedlicher Typ)
Write-Host ""
Write-Host "=== TYP-AENDERUNGEN ===" -ForegroundColor Yellow
$typAenderungen = $updates | Where-Object { $_.SoftrArt -and $_.HeroArt -and $_.SoftrArt -ne $_.HeroArt }
Write-Host "Dokumente wo Typ geaendert wird: $($typAenderungen.Count)"

if ($typAenderungen.Count -gt 0) {
    Write-Host ""
    Write-Host "Beispiele Typ-Aenderungen (erste 20):"
    $typAenderungen | Select-Object -First 20 | ForEach-Object {
        Write-Host "$($_.Nr): '$($_.SoftrArt)' -> '$($_.HeroArt)'"
    }
}

# Pruefen: Betrags-Aenderungen
Write-Host ""
Write-Host "=== BETRAGS-AENDERUNGEN ===" -ForegroundColor Yellow
$betragsAenderungen = $updates | Where-Object {
    $_.SoftrNetto -ne $null -and $_.HeroNetto -ne $null -and
    [Math]::Abs($_.SoftrNetto - $_.HeroNetto) -gt 0.01
}
Write-Host "Dokumente wo Betrag geaendert wird: $($betragsAenderungen.Count)"

if ($betragsAenderungen.Count -gt 0 -and $betragsAenderungen.Count -le 30) {
    Write-Host ""
    Write-Host "Betrags-Aenderungen:"
    $betragsAenderungen | ForEach-Object {
        Write-Host "$($_.Nr): Softr=$($_.SoftrNetto) -> Hero=$($_.HeroNetto)"
    }
}

# Angebote Detail
Write-Host ""
Write-Host "=== ANGEBOTE (offer) ===" -ForegroundColor Cyan
$angebote = $updates | Where-Object { $_.HeroTyp -eq "offer" }
Write-Host "Anzahl: $($angebote.Count)"
$angMitTypAenderung = $angebote | Where-Object { $_.SoftrArt -and $_.SoftrArt -notlike "*ANG*" }
Write-Host "Davon mit Typ-Aenderung: $($angMitTypAenderung.Count)"

# AB Detail
Write-Host ""
Write-Host "=== AUFTRAGSBESTAETIGUNGEN (confirmation) ===" -ForegroundColor Cyan
$abs = $updates | Where-Object { $_.HeroTyp -eq "confirmation" }
Write-Host "Anzahl: $($abs.Count)"
$abMitTypAenderung = $abs | Where-Object { $_.SoftrArt -and $_.SoftrArt -notlike "*AB*" }
Write-Host "Davon mit Typ-Aenderung: $($abMitTypAenderung.Count)"

# NUA Detail
Write-Host ""
Write-Host "=== NUAs (measurement) ===" -ForegroundColor Cyan
$nuas = $updates | Where-Object { $_.HeroTyp -eq "measurement" }
Write-Host "Anzahl: $($nuas.Count)"
$nuaMitTypAenderung = $nuas | Where-Object { $_.SoftrArt -and $_.SoftrArt -notlike "*NUA*" }
Write-Host "Davon mit Typ-Aenderung: $($nuaMitTypAenderung.Count)"
