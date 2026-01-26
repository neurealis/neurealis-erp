# E-Mail über Supabase Edge Function senden
$htmlContent = Get-Content -Path "C:\Users\holge\neurealis-erp\dubletten_email_final.html" -Raw -Encoding UTF8

# BOM entfernen falls vorhanden
$htmlContent = $htmlContent -replace '^\xEF\xBB\xBF', ''
$htmlContent = $htmlContent.TrimStart([char]0xFEFF, [char]0xFFFE)

$bodyObj = @{
    to = "tobiasrangol@neurealis.de"
    subject = "Doppelte Rechnungsnummern in Softr Dokumente - 325 gefunden (7 Ausgangsrechnungen)"
    body = $htmlContent
    html = $true
    raw = $true
    cc = "holger.neumann@neurealis.de"
}

# Konvertiere zu JSON mit korrektem Escaping
$jsonBody = $bodyObj | ConvertTo-Json -Depth 10 -Compress

$headers = @{
    "Content-Type" = "application/json; charset=utf-8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
}

try {
    $response = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-send" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody)) -ContentType "application/json; charset=utf-8"
    Write-Host "E-Mail erfolgreich gesendet!"
    $response | ConvertTo-Json
} catch {
    Write-Host "Fehler beim Senden:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host $reader.ReadToEnd()
    }
}
