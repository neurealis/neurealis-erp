$headers = @{
    'Softr-Api-Key' = 'dWhawF85Rw7tqSsaaqmavvmkE'
    'Content-Type' = 'application/json'
}

$allDocs = @()
$offset = 0
$limit = 500

do {
    $response = Invoke-RestMethod -Uri "https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/kNjsEhYYcNjAsj/records?offset=$offset&limit=$limit" -Headers $headers
    $allDocs += $response.data
    $total = $response.metadata.total
    $offset += $limit
} while ($allDocs.Count -lt $total)

$docs = $allDocs | ForEach-Object {
    $fields = $_.fields
    $kategorie = $null
    if ($fields.'6tf0K' -and $fields.'6tf0K'.label) {
        $kategorie = $fields.'6tf0K'.label
    }

    [PSCustomObject]@{
        id = $_.id
        rechnungsnummer = $fields.'8Ae7U'
        kategorie = $kategorie
        datum_erstellt = $fields.'DAXGa'
        netto = $fields.'QuHkO'
        brutto = $fields.'kukJI'
        bauvorhaben = $fields.'1sWGL'
        atbs = $fields.'GBc7t'
        nua = $fields.'7xrdk'
        notizen = $fields.'iHzHD'
        dokument_link = $fields.'cIP4K'
        portal_link = $fields.'xMHBE'
    }
}

$docsWithReNr = $docs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
$grouped = $docsWithReNr | Group-Object -Property rechnungsnummer
$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

# Nur AR-A/AR-S Dubletten
$arDuplicates = @()
foreach ($dup in $duplicates) {
    $kategorien = $dup.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }
    if ($hasAR) {
        $arDuplicates += $dup
    }
}

$html = @"
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
.summary { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
</style>
</head>
<body>
<h1>Doppelte Rechnungsnummern - Ausgangsrechnungen</h1>
<p><strong>Datum:</strong> $(Get-Date -Format 'dd.MM.yyyy HH:mm')</p>

<div class="summary">
<strong>Zusammenfassung:</strong><br>
Doppelte Ausgangsrechnungen (AR-A/AR-S): <strong>$($arDuplicates.Count)</strong>
</div>

"@

$arCount = 0
foreach ($dup in $arDuplicates | Sort-Object Name) {
    $arCount++
    $html += "<h3>$arCount. RE-Nr: $($dup.Name)</h3>`n"
    $html += "<table><tr><th>Kategorie</th><th>Datum</th><th>ATBS</th><th>Netto</th><th>Brutto</th><th>Bauvorhaben</th><th>Links</th><th>Notizen</th></tr>`n"

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

        $html += "<tr class='ar'><td>$($item.kategorie)</td><td>$($item.datum_erstellt)</td><td>$($item.atbs)</td><td style='text-align:right'>$nettoStr</td><td style='text-align:right'>$bruttoStr</td><td>$($item.bauvorhaben)</td><td>$linksStr</td><td>$notizenStr</td></tr>`n"
    }
    $html += "</table>`n"
}

$html += @"
<hr>
<p style='font-size: 12px; color: #999;'>Automatisch generiert von neurealis ERP</p>
</body>
</html>
"@

# E-Mail senden
$bodyObj = @{
    to = "tobias.ranglo@neurealis.de"
    subject = "Doppelte Ausgangsrechnungen (AR-A/AR-S) - $($arDuplicates.Count) gefunden"
    body = $html
    html = $true
    raw = $true
    cc = "holger.neumann@neurealis.de"
}

$jsonBody = $bodyObj | ConvertTo-Json -Depth 10 -Compress

$apiHeaders = @{
    "Content-Type" = "application/json; charset=utf-8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
}

try {
    $response = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-send" -Method Post -Headers $apiHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody)) -ContentType "application/json; charset=utf-8"
    Write-Host "E-Mail erfolgreich gesendet!"
    Write-Host "An: tobias.ranglo@neurealis.de"
    Write-Host "CC: holger.neumann@neurealis.de"
    Write-Host "Betreff: Doppelte Ausgangsrechnungen (AR-A/AR-S) - $($arDuplicates.Count) gefunden"
} catch {
    Write-Host "Fehler: $($_.Exception.Message)"
}
