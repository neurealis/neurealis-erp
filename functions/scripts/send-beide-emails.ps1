$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

Write-Host "Lade Dokumente aus Softr..."

$allDocs = @()
$offset = 0
$limit = 500

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
} while ($allDocs.Count -lt $total)

Write-Host "Dokumente geladen: $($allDocs.Count)"

$docs = $allDocs | ForEach-Object {
    $fields = $_.fields
    $kategorie = $null
    if ($fields.'6tf0K' -and $fields.'6tf0K'.label) {
        $kategorie = $fields.'6tf0K'.label
    }

    [PSCustomObject]@{
        id = $_.id
        atbs = $fields.'GBc7t'
        kategorie = $kategorie
        datum_erstellt = $fields.'DAXGa'
        rechnungsnummer = $fields.'8Ae7U'
        netto = $fields.'QuHkO'
        brutto = $fields.'kukJI'
        bauvorhaben = $fields.'1sWGL'
        notizen = $fields.'iHzHD'
        dokument_link = $fields.'cIP4K'
        portal_link = $fields.'xMHBE'
    }
}

# Nur gültige ATBS-Nummern für Projekt-Liste
$validPattern = '^ATBS-\d{2,4}$'
$validDocs = $docs | Where-Object { $_.atbs -match $validPattern }

# ATBS mit erstem Dokument in 2025 oder 2026
$atbs2025_2026 = @{}
foreach ($doc in $validDocs) {
    if ($doc.datum_erstellt) {
        $jahr = ([datetime]$doc.datum_erstellt).Year
        if ($jahr -ge 2025) {
            if (-not $atbs2025_2026.ContainsKey($doc.atbs)) {
                $atbs2025_2026[$doc.atbs] = $jahr
            }
        }
    }
}

Write-Host "ATBS-Projekte aus 2025/2026: $($atbs2025_2026.Count)"

# ==================== E-MAIL 1: Projekte ohne AR (2025/2026) ====================

$atbsMitAR = $validDocs | Where-Object { $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*' } | Select-Object -ExpandProperty atbs -Unique
$atbsOhneAR_2025_2026 = $atbs2025_2026.Keys | Where-Object { $_ -notin $atbsMitAR } | Sort-Object { [int]($_ -replace 'ATBS-', '') }

Write-Host "Davon OHNE Ausgangsrechnung: $($atbsOhneAR_2025_2026.Count)"

$html1 = @"
<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
h1 { color: #1a237e; }
h2 { color: #0066cc; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #1a237e; color: white; }
tr:nth-child(even) { background-color: #f9f9f9; }
.summary { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
a { color: #0066cc; }
</style>
</head>
<body>
<h1>Projekte ohne Ausgangsrechnung (2025/2026)</h1>
<p><strong>Datum:</strong> $(Get-Date -Format 'dd.MM.yyyy HH:mm')</p>

<div class="summary">
<strong>Zusammenfassung:</strong><br>
- ATBS-Projekte aus 2025/2026 gesamt: $($atbs2025_2026.Count)<br>
- Davon OHNE Ausgangsrechnung (AR-A/AR-S): <strong>$($atbsOhneAR_2025_2026.Count)</strong>
</div>

<table>
<tr><th>#</th><th>ATBS</th><th>Bauvorhaben</th><th>Vorhandene Dokumente</th></tr>
"@

$count = 0
foreach ($atbs in $atbsOhneAR_2025_2026) {
    $count++
    $projektDocs = $validDocs | Where-Object { $_.atbs -eq $atbs }
    $bauvorhaben = ($projektDocs | Where-Object { $_.bauvorhaben } | Select-Object -ExpandProperty bauvorhaben -First 1)
    $kategorien = ($projektDocs | Select-Object -ExpandProperty kategorie -Unique | Where-Object { $_ -and $_ -notlike '*null*' }) -join ", "

    $html1 += "<tr><td>$count</td><td>$atbs</td><td>$bauvorhaben</td><td>$kategorien</td></tr>`n"
}

$html1 += @"
</table>
<hr>
<p style='font-size: 12px; color: #999;'>Automatisch generiert von neurealis ERP</p>
</body>
</html>
"@

# ==================== E-MAIL 2: AR-Dubletten (ALLE Dokumente) ====================

# Für Dubletten: ALLE Dokumente mit AR-A/AR-S durchsuchen
$arDocs = $docs | Where-Object { $_.kategorie -like 'AR-A*' -or $_.kategorie -like 'AR-S*' }
$arWithReNr = $arDocs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
$arGrouped = $arWithReNr | Group-Object -Property rechnungsnummer
$arDuplicates = $arGrouped | Where-Object { $_.Count -gt 1 }

Write-Host "AR-Dubletten gefunden: $($arDuplicates.Count)"

$html2 = @"
<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
h1 { color: #1a237e; }
h2 { color: #0066cc; margin-top: 20px; }
h3 { color: #666; margin-top: 15px; background: #f5f5f5; padding: 8px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
th { background-color: #1a237e; color: white; }
.ar { background-color: #fff3cd; }
a { color: #0066cc; }
.notizen { font-size: 12px; color: #666; }
.summary { background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; }
</style>
</head>
<body>
<h1>Doppelte Ausgangsrechnungen (AR-A / AR-S)</h1>
<p><strong>Datum:</strong> $(Get-Date -Format 'dd.MM.yyyy HH:mm')</p>

<div class="summary">
<strong>Achtung:</strong> $($arDuplicates.Count) doppelte Rechnungsnummern bei Ausgangsrechnungen gefunden!
</div>

"@

$arCount = 0
foreach ($dup in $arDuplicates | Sort-Object Name) {
    $arCount++
    $html2 += "<h3>$arCount. RE-Nr: $($dup.Name)</h3>`n"
    $html2 += "<table><tr><th>Kategorie</th><th>Datum</th><th>ATBS</th><th>Netto</th><th>Brutto</th><th>Bauvorhaben</th><th>Links</th><th>Notizen</th></tr>`n"

    foreach ($item in $dup.Group | Sort-Object datum_erstellt) {
        $nettoStr = if ($item.netto) { "{0:N2} EUR" -f [decimal]$item.netto } else { "-" }
        $bruttoStr = if ($item.brutto) { "{0:N2} EUR" -f [decimal]$item.brutto } else { "-" }
        $links = @()
        if ($item.dokument_link) { $links += "<a href='$($item.dokument_link)'>Dokument</a>" }
        if ($item.portal_link) { $links += "<a href='$($item.portal_link)'>Portal</a>" }
        $linksStr = if ($links.Count -gt 0) { $links -join " | " } else { "-" }
        $notizenStr = "-"
        if ($item.notizen) {
            $n = $item.notizen -replace '<', '&lt;' -replace '>', '&gt;'
            if ($n.Length -gt 150) { $n = $n.Substring(0, 150) + "..." }
            $notizenStr = "<span class='notizen'>$n</span>"
        }

        $html2 += "<tr class='ar'><td>$($item.kategorie)</td><td>$($item.datum_erstellt)</td><td>$($item.atbs)</td><td style='text-align:right'>$nettoStr</td><td style='text-align:right'>$bruttoStr</td><td>$($item.bauvorhaben)</td><td>$linksStr</td><td>$notizenStr</td></tr>`n"
    }
    $html2 += "</table>`n"
}

$html2 += @"
<hr>
<p style='font-size: 12px; color: #999;'>Automatisch generiert von neurealis ERP</p>
</body>
</html>
"@

# ==================== E-MAILS SENDEN ====================

$apiHeaders = @{
    "Content-Type" = "application/json; charset=utf-8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
}

# E-Mail 1 senden
Write-Host ""
Write-Host "Sende E-Mail 1: Projekte ohne AR..."
$body1 = @{
    to = "tobias.ranglo@neurealis.de"
    subject = "Projekte ohne Ausgangsrechnung (2025/2026) - $($atbsOhneAR_2025_2026.Count) gefunden"
    body = $html1
    html = $true
    raw = $true
    cc = "holger.neumann@neurealis.de"
} | ConvertTo-Json -Depth 10 -Compress

try {
    $response1 = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-send" -Method Post -Headers $apiHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($body1)) -ContentType "application/json; charset=utf-8"
    Write-Host "E-Mail 1 gesendet!"
} catch {
    Write-Host "Fehler E-Mail 1: $($_.Exception.Message)"
}

Start-Sleep -Seconds 2

# E-Mail 2 senden
Write-Host ""
Write-Host "Sende E-Mail 2: AR-Dubletten..."
$body2 = @{
    to = "tobias.ranglo@neurealis.de"
    subject = "Doppelte Ausgangsrechnungen (AR-A/AR-S) - $($arDuplicates.Count) gefunden"
    body = $html2
    html = $true
    raw = $true
    cc = "holger.neumann@neurealis.de"
} | ConvertTo-Json -Depth 10 -Compress

try {
    $response2 = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-send" -Method Post -Headers $apiHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($body2)) -ContentType "application/json; charset=utf-8"
    Write-Host "E-Mail 2 gesendet!"
} catch {
    Write-Host "Fehler E-Mail 2: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== FERTIG ==="
Write-Host "E-Mail 1: Projekte ohne Ausgangsrechnung (2025/2026) - $($atbsOhneAR_2025_2026.Count) Projekte"
Write-Host "E-Mail 2: Doppelte Ausgangsrechnungen - $($arDuplicates.Count) Dubletten"
