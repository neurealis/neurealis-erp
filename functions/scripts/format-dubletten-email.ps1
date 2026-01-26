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

# Sortieren: AR-A/AR-S zuerst
$sortedDuplicates = $duplicates | Sort-Object {
    $kategorien = $_.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }
    if ($hasAR) { 0 } else { 1 }
}, Name

# HTML für E-Mail generieren
$html = @"
<html>
<head>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; }
h1 { color: #333; }
h2 { color: #0066cc; margin-top: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
h3 { color: #666; margin-top: 20px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f5f5f5; }
.ar { background-color: #fff3cd; }
.warning { color: #cc0000; font-weight: bold; }
a { color: #0066cc; }
.notizen { font-size: 12px; color: #666; max-width: 400px; }
</style>
</head>
<body>
<h1>Doppelte Rechnungsnummern in der Dokumente-Tabelle</h1>
<p><strong>Datum:</strong> $(Get-Date -Format 'dd.MM.yyyy HH:mm')</p>
<p><strong>Gesamt:</strong> $($duplicates.Count) doppelte Rechnungsnummern gefunden</p>

<h2>1. Ausgangsrechnungen (AR-A / AR-S)</h2>
"@

$arCount = 0
foreach ($dup in $sortedDuplicates) {
    $kategorien = $dup.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }

    if ($hasAR) {
        $arCount++
        $html += @"
<h3>$arCount. Rechnungsnummer: $($dup.Name)</h3>
<table>
<tr><th>Kategorie</th><th>Datum</th><th>ATBS</th><th>Netto</th><th>Brutto</th><th>Bauvorhaben</th><th>Dokument</th><th>Notizen</th></tr>
"@
        foreach ($item in $dup.Group | Sort-Object datum_erstellt) {
            $nettoStr = if ($item.netto) { "{0:N2} EUR" -f $item.netto } else { "-" }
            $bruttoStr = if ($item.brutto) { "{0:N2} EUR" -f $item.brutto } else { "-" }
            $dokLink = if ($item.dokument_link) { "<a href='$($item.dokument_link)'>Dokument</a>" } else { "-" }
            $portalLink = if ($item.portal_link) { "<a href='$($item.portal_link)'>Portal</a>" } else { "" }
            $notizenStr = if ($item.notizen) {
                $n = $item.notizen
                if ($n.Length -gt 100) { $n = $n.Substring(0, 100) + "..." }
                "<span class='notizen'>$n</span>"
            } else { "-" }

            $html += "<tr class='ar'><td>$($item.kategorie)</td><td>$($item.datum_erstellt)</td><td>$($item.atbs)</td><td>$nettoStr</td><td>$bruttoStr</td><td>$($item.bauvorhaben)</td><td>$dokLink $portalLink</td><td>$notizenStr</td></tr>`n"
        }
        $html += "</table>`n"
    }
}

if ($arCount -eq 0) {
    $html += "<p>Keine Dubletten bei Ausgangsrechnungen gefunden.</p>`n"
}

$html += "<h2>2. Sonstige Dokumenttypen</h2>`n"

$otherCount = 0
foreach ($dup in $sortedDuplicates) {
    $kategorien = $dup.Group | Select-Object -ExpandProperty kategorie
    $hasAR = $kategorien | Where-Object { $_ -like 'AR-*' }

    if (-not $hasAR) {
        $otherCount++
        $html += @"
<h3>$otherCount. Rechnungsnummer: $($dup.Name)</h3>
<table>
<tr><th>Kategorie</th><th>Datum</th><th>ATBS/NUA</th><th>Netto</th><th>Brutto</th><th>Bauvorhaben</th><th>Dokument</th><th>Notizen</th></tr>
"@
        foreach ($item in $dup.Group | Sort-Object datum_erstellt) {
            $nettoStr = if ($item.netto) { "{0:N2} EUR" -f $item.netto } else { "-" }
            $bruttoStr = if ($item.brutto) { "{0:N2} EUR" -f $item.brutto } else { "-" }
            $dokLink = if ($item.dokument_link) { "<a href='$($item.dokument_link)'>Dokument</a>" } else { "-" }
            $portalLink = if ($item.portal_link) { "<a href='$($item.portal_link)'>Portal</a>" } else { "" }
            $atbsNua = @($item.atbs, $item.nua) | Where-Object { $_ } | Join-String -Separator " / "
            $notizenStr = if ($item.notizen) {
                $n = $item.notizen
                if ($n.Length -gt 100) { $n = $n.Substring(0, 100) + "..." }
                "<span class='notizen'>$n</span>"
            } else { "-" }

            $html += "<tr><td>$($item.kategorie)</td><td>$($item.datum_erstellt)</td><td>$atbsNua</td><td>$nettoStr</td><td>$bruttoStr</td><td>$($item.bauvorhaben)</td><td>$dokLink $portalLink</td><td>$notizenStr</td></tr>`n"
        }
        $html += "</table>`n"
    }
}

$html += @"
<hr>
<p style='font-size: 12px; color: #999;'>Automatisch generiert von neurealis ERP - Claude Code</p>
</body>
</html>
"@

# HTML in Datei speichern
$html | Out-File -FilePath "C:\Users\holge\neurealis-erp\dubletten_email.html" -Encoding UTF8

Write-Host "E-Mail HTML gespeichert: C:\Users\holge\neurealis-erp\dubletten_email.html"
Write-Host "AR-Dubletten: $arCount"
Write-Host "Sonstige Dubletten: $otherCount"
