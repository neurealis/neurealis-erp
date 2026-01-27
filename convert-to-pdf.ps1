$inputPath = "C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.docx"
$outputPath = "C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.pdf"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($inputPath)

    # wdFormatPDF = 17
    $doc.ExportAsFixedFormat($outputPath, 17)

    $doc.Close([ref]$false)
    $word.Quit()

    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null

    Write-Host "PDF erstellt: $outputPath"
}
catch {
    Write-Host "Fehler: $_"
    if ($doc) { $doc.Close([ref]$false) }
    if ($word) { $word.Quit() }
}
