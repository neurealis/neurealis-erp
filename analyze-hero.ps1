# Hero Dokumente Analyse
$page1 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01WGNSpHfreRhNkHE7XHc3kV.txt' | ConvertFrom-Json
$page2 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_01YAPMKiRz7ytnWqHhS8pNjx.txt' | ConvertFrom-Json
$page3 = Get-Content 'C:\Users\holge\.claude\projects\C--Users-holge-neurealis-erp\be2027d4-efd8-4811-819d-b58afc0e9af5\tool-results\toolu_012mqEp48RVTWtr6tLhLTYAL.txt' | ConvertFrom-Json

$allDocs = @()
$allDocs += $page1.data.customer_documents
$allDocs += $page2.data.customer_documents
$allDocs += $page3.data.customer_documents

# Filter: ab 2025 und gültige Nr
$docs2025 = $allDocs | Where-Object {
    $_.date -ge '2025-01-01' -and
    $_.nr -and
    $_.nr -notmatch 'xxxx'
}

Write-Host "=== HERO DOKUMENTE AB 2025 ===" -ForegroundColor Cyan
Write-Host ""

# Nach Typ gruppieren
$byType = $docs2025 | Group-Object -Property type | Sort-Object Count -Descending

Write-Host "NACH DOKUMENTTYP:" -ForegroundColor Yellow
foreach ($g in $byType) {
    Write-Host ("{0,-25} {1,5}" -f $g.Name, $g.Count)
}

Write-Host ""
Write-Host "=== RECHNUNGEN DETAIL ===" -ForegroundColor Cyan

# Nur Rechnungen
$invoices = $docs2025 | Where-Object { $_.type -eq 'invoice' -or $_.type -eq 'reversal_invoice' }

# AR (RE-*) vs ER (andere)
$ar = $invoices | Where-Object { $_.nr -match '^RE-' }
$er = $invoices | Where-Object { $_.nr -notmatch '^RE-' }

# Stornos
$stornos = $ar | Where-Object { $_.value -lt 0 }
$arNormal = $ar | Where-Object { $_.value -ge 0 }

Write-Host ""
Write-Host "Ausgangsrechnungen (RE-*):" -ForegroundColor Yellow
Write-Host ("  Normal (AR-A/AR-S):  {0}" -f $arNormal.Count)
Write-Host ("  Storno (AR-X):       {0}" -f $stornos.Count)
Write-Host ("  GESAMT AR:           {0}" -f $ar.Count)

Write-Host ""
Write-Host "Eingangsrechnungen (andere):" -ForegroundColor Yellow
Write-Host ("  ER-NU:               {0}" -f $er.Count)

Write-Host ""
Write-Host ("RECHNUNGEN GESAMT:     {0}" -f $invoices.Count) -ForegroundColor Green
