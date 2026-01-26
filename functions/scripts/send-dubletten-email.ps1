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

# Alle Dokumente extrahieren
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

# Gruppieren nach Rechnungsnummer
$docsWithReNr = $docs | Where-Object { $_.rechnungsnummer -and $_.rechnungsnummer.Trim() -ne '' }
$grouped = $docsWithReNr | Group-Object -Property rechnungsnummer
$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

# Kategorisieren
$arDuplicates = @()
$otherDuplicates = @()

foreach ($dup in $duplicates) {
    $kategorien = $dup.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }
    if ($hasAR) {
        $arDuplicates += $dup
    } else {
        $otherDuplicates += $dup
    }
}

# Statistik nach Kategorie-Kombination für sonstige
$otherStats = @{}
foreach ($dup in $otherDuplicates) {
    $kategorien = ($dup.Group | Select-Object -ExpandProperty kategorie | Sort-Object -Unique) -join " + "
    if (-not $otherStats.ContainsKey($kategorien)) {
        $otherStats[$kategorien] = 0
    }
    $otherStats[$kategorien]++
}

# HTML für E-Mail generieren
$html = @"
<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
h1 { color: #1a237e; }
h2 { color: #0066cc; margin-top: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
h3 { color: #666; margin-top: 20px; background: #f5f5f5; padding: 10px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
th { background-color: #1a237e; color: white; }
.ar { background-color: #fff3cd; }
.warning { color: #cc0000; font-weight: bold; }
a { color: #0066cc; }
.notizen { font-size: 12px; color: #666; }
.summary { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
.stat-table { width: auto; }
.stat-table td { padding: 5px 15px 5px 5px; border: none; }
</style>
</head>
<body>
<h1>Doppelte Rechnungsnummern - Softr Dokumente</h1>
<p><strong>Datum:</strong> $(Get-Date -Format 'dd.MM.yyyy HH:mm')</p>

<div class="summary">
<strong>Zusammenfassung:</strong><br>
- Dokumente gesamt: $($allDocs.Count)<br>
- Eindeutige Rechnungsnummern: $($grouped.Count)<br>
- <span class="warning">Doppelte Rechnungsnummern gesamt: $($duplicates.Count)</span><br>
- Davon Ausgangsrechnungen (AR-A/AR-S): $($arDuplicates.Count)<br>
- Davon sonstige Dokumenttypen: $($otherDuplicates.Count)
</div>

<h2>1. Ausgangsrechnungen (AR-A / AR-S) - $($arDuplicates.Count) Dubletten</h2>
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
        $linksStr = if ($links.Count -gt 0) { $links -join "<br>" } else { "-" }
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

if ($arCount -eq 0) {
    $html += "<p>Keine Dubletten bei Ausgangsrechnungen gefunden.</p>`n"
}

$html += @"
<h2>2. Sonstige Dokumenttypen - $($otherDuplicates.Count) Dubletten (Zusammenfassung)</h2>
<table class="stat-table">
<tr><th>Kategorie-Kombination</th><th>Anzahl</th></tr>
"@

foreach ($stat in $otherStats.GetEnumerator() | Sort-Object Value -Descending) {
    $html += "<tr><td>$($stat.Key)</td><td>$($stat.Value)</td></tr>`n"
}

$html += @"
</table>
<p><em>Details zu sonstigen Dubletten auf Anfrage.</em></p>

<hr>
<p style='font-size: 12px; color: #999;'>Automatisch generiert von neurealis ERP - Claude Code<br>
Bei Fragen: holger.neumann@neurealis.de</p>
</body>
</html>
"@

# HTML in Datei speichern
$html | Out-File -FilePath "C:\Users\holge\neurealis-erp\dubletten_email_final.html" -Encoding UTF8

Write-Host "E-Mail HTML gespeichert"
Write-Host "AR-Dubletten: $arCount"
Write-Host "Sonstige Dubletten: $($otherDuplicates.Count)"

# JSON für API-Call ausgeben
$emailData = @{
    to = "tobiasrangol@neurealis.de"
    subject = "Doppelte Rechnungsnummern in Softr Dokumente - $($duplicates.Count) gefunden"
    html = $html
}

$emailData | ConvertTo-Json -Depth 3 -Compress | Out-File -FilePath "C:\Users\holge\neurealis-erp\email_payload.json" -Encoding UTF8
Write-Host "E-Mail Payload gespeichert"
