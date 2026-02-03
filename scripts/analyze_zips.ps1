# ZIP-Analyse: Welche ZIP-Dateien koennen durch neue PDFs ersetzt werden?

$bachFolder = 'C:\Users\holge\neurealis GmbH\Mieter-Service neurealis - Verwaltung\50 Immoverwaltung Bach'
$newFolder = 'C:\Users\holge\neurealis GmbH\Mieter-Service neurealis - Verwaltung\50 Immoverwaltung Bach\Mieteingaenge'

Write-Host '=== ZIP-DATEIEN IM BACH-ORDNER ===' -ForegroundColor Cyan
$zipFiles = Get-ChildItem -Path $bachFolder -Filter '*.zip' -Recurse -ErrorAction SilentlyContinue
Write-Host "Gefundene ZIP-Dateien: $($zipFiles.Count)"

foreach ($zip in $zipFiles) {
    $sizeKB = [math]::Round($zip.Length / 1024, 1)
    Write-Host "`n$($zip.Name) ($sizeKB KB)" -ForegroundColor Yellow
    Write-Host "  Pfad: $($zip.FullName)"
}

Write-Host "`n`n=== NEUE PDFs (ZUSAMMENFASSUNG) ===" -ForegroundColor Cyan
$pdfFiles = Get-ChildItem -Path $newFolder -Filter '*.pdf' -ErrorAction SilentlyContinue
Write-Host "Heruntergeladene PDFs: $($pdfFiles.Count)"
$totalSizeKB = [math]::Round(($pdfFiles | Measure-Object -Property Length -Sum).Sum / 1024, 1)
Write-Host "Gesamtgroesse: $totalSizeKB KB ($([math]::Round($totalSizeKB / 1024, 2)) MB)"

Write-Host "`n=== EMPFEHLUNG ===" -ForegroundColor Green
Write-Host "Die neuen PDFs enthalten monatliche Abrechnungen von 2023-2025."
Write-Host "Die ZIP-Dateien koennen als Backup behalten werden."
Write-Host "Die entpackten PDFs sind jetzt im Ordner 'Mieteingaenge' verfuegbar."
