$page1 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01WGNSpHfreRhNkHE7XHc3kV.txt" | ConvertFrom-Json
$page2 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01YAPMKiRz7ytnWqHhS8pNjx.txt" | ConvertFrom-Json
$page3 = Get-Content "C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_012mqEp48RVTWtr6tLhLTYAL.txt" | ConvertFrom-Json

$heroDocs = @()
$heroDocs += $page1.data.customer_documents
$heroDocs += $page2.data.customer_documents
$heroDocs += $page3.data.customer_documents

$hero2025 = $heroDocs | Where-Object { $_.date -ge "2025-01-01" -and $_.nr -and $_.nr -notmatch "xxxx" }

$softrDocs = @()
for ($i = 0; $i -le 3; $i++) {
    $file = "C:\Users\holge\neurealis-erp\softr_all_$i.json"
    if (Test-Path $file) {
        $content = Get-Content $file | ConvertFrom-Json
        if ($content.data) {
            $softrDocs += $content.data
            Write-Host "Seite $i : $($content.data.Count) Dokumente"
        }
    }
}

Write-Host ""
Write-Host "Hero ab 2025: $($hero2025.Count)"
Write-Host "Softr GESAMT: $($softrDocs.Count)"

$softrNummern = @{}
foreach ($doc in $softrDocs) {
    $dokNr = $doc.fields."8Ae7U"
    $nuaNr = $doc.fields."7xrdk"
    $artDok = $doc.fields."6tf0K"
    if ($dokNr) { $softrNummern[$dokNr] = $artDok }
    if ($nuaNr -and -not $softrNummern.ContainsKey($nuaNr)) { $softrNummern[$nuaNr] = $artDok }
}

Write-Host "Eindeutige Softr-Nummern: $($softrNummern.Count)"
Write-Host ""

$heroRE = $hero2025 | Where-Object { $_.type -eq "invoice" -or $_.type -eq "reversal_invoice" }
$reGefunden = $heroRE | Where-Object { $softrNummern.ContainsKey($_.nr) }
$reFehlend = $heroRE | Where-Object { -not $softrNummern.ContainsKey($_.nr) }

Write-Host "=== RECHNUNGEN ==="
Write-Host "Hero-Rechnungen ab 2025: $($heroRE.Count)"
Write-Host "In Softr vorhanden:      $($reGefunden.Count)"
Write-Host "FEHLEND in Softr:        $($reFehlend.Count)"
Write-Host ""

if ($reGefunden.Count -gt 0) {
    Write-Host "=== VORHANDENE RECHNUNGEN (mit Softr-Typ) ==="
    foreach ($re in ($reGefunden | Sort-Object nr)) {
        $art = $softrNummern[$re.nr]
        $artLabel = if ($art.label) { $art.label } else { $art }
        Write-Host "$($re.nr) | Hero: $($re.type) | Softr: $artLabel | $($re.value) EUR"
    }
}

Write-Host ""
if ($reFehlend.Count -gt 0) {
    Write-Host "=== FEHLENDE RECHNUNGEN ==="
    foreach ($re in ($reFehlend | Sort-Object nr)) {
        Write-Host "$($re.nr) | $($re.type) | $($re.value) EUR | $($re.date)"
    }
}
