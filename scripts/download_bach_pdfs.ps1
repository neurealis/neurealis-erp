$ErrorActionPreference = "Stop"

$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
    "Content-Type" = "application/json"
}

$targetFolder = "C:\Users\holge\neurealis GmbH\Mieter-Service neurealis - Verwaltung\50 Immoverwaltung Bach\Mieteingaenge"

# Zielordner erstellen falls nicht vorhanden
if (-not (Test-Path $targetFolder)) {
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
    Write-Host "Ordner erstellt: $targetFolder" -ForegroundColor Green
}

# 1. E-Mails abrufen
Write-Host "`n=== Schritt 1: E-Mails abrufen ===" -ForegroundColor Cyan
$body = '{"query": "subject:Abrechnung", "top": 100}'
$response = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-search" -Method POST -Headers $headers -Body $body

Write-Host "Gefundene E-Mails: $($response.count)"

# 2. Nach Bach/Immobilienverwaltung filtern
Write-Host "`n=== Schritt 2: Nach Bach/Immobilienverwaltung filtern ===" -ForegroundColor Cyan
$bachEmails = $response.emails | Where-Object {
    $_.from -match "bach" -or $_.from -match "immobilienverwaltung"
}

Write-Host "Gefilterte E-Mails von Bach: $($bachEmails.Count)"

# 3. Nur E-Mails mit Anhaengen
$emailsWithAttachments = $bachEmails | Where-Object { $_.hasAttachments -eq $true }
Write-Host "Davon mit Anhaengen: $($emailsWithAttachments.Count)"

# Ergebnisse speichern
$downloadedFiles = @()
$skippedFiles = @()

# 4. Fuer jede E-Mail Anhaenge abrufen (via GET mit Query-Parametern)
Write-Host "`n=== Schritt 3: Anhaenge abrufen und PDFs herunterladen ===" -ForegroundColor Cyan

foreach ($email in $emailsWithAttachments) {
    Write-Host "`nE-Mail: $($email.subject)" -ForegroundColor Yellow
    Write-Host "  Von: $($email.from)"
    Write-Host "  Datum: $($email.received)"
    Write-Host "  Message-ID: $($email.id)"

    # Anhaenge abrufen via GET mit URL-Parametern
    $encodedMessageId = [System.Web.HttpUtility]::UrlEncode($email.id)
    $attachmentUrl = "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-attachments?messageId=$encodedMessageId&mailbox=holger.neumann@neurealis.de"

    try {
        Write-Host "  Rufe Anhaenge ab..."
        $attachmentResponse = Invoke-RestMethod -Uri $attachmentUrl -Method GET -Headers $headers

        if ($attachmentResponse.success -and $attachmentResponse.results -and $attachmentResponse.results.Count -gt 0) {
            foreach ($result in $attachmentResponse.results) {
                Write-Host "  Anhaenge gefunden: $($result.attachments.Count)"

                foreach ($att in $result.attachments) {
                    Write-Host "    - $($att.name) ($($att.contentType), $([math]::Round($att.size / 1024, 1)) KB)"

                    # Nur PDFs herunterladen
                    if ($att.contentType -match "pdf" -or $att.name -match "\.pdf$") {
                        # Dateiname bereinigen
                        $safeFileName = $att.name -replace '[<>:"/\\|?*]', '_'
                        $filePath = Join-Path $targetFolder $safeFileName

                        # Pruefen ob Datei bereits existiert
                        if (Test-Path $filePath) {
                            Write-Host "      UEBERSPRUNGEN (existiert bereits)" -ForegroundColor DarkYellow
                            $skippedFiles += @{
                                fileName = $safeFileName
                                subject = $email.subject
                                reason = "Existiert bereits"
                            }
                            continue
                        }

                        # Base64 dekodieren und speichern
                        if ($att.contentBytes) {
                            $bytes = [Convert]::FromBase64String($att.contentBytes)
                            [System.IO.File]::WriteAllBytes($filePath, $bytes)
                            Write-Host "      GESPEICHERT: $safeFileName" -ForegroundColor Green
                            $downloadedFiles += @{
                                fileName = $safeFileName
                                subject = $email.subject
                                from = $email.from
                                received = $email.received
                                size = $bytes.Length
                            }
                        } else {
                            Write-Host "      FEHLER: Keine contentBytes" -ForegroundColor Red
                        }
                    }
                }
            }
        } else {
            Write-Host "  Keine Anhaenge in Response" -ForegroundColor DarkGray
            if ($attachmentResponse.error) {
                Write-Host "  Fehler: $($attachmentResponse.error)" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "  FEHLER beim Abrufen der Anhaenge: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Kurze Pause um Rate-Limiting zu vermeiden
    Start-Sleep -Milliseconds 1000
}

# 5. Zusammenfassung
Write-Host "`n`n=== ZUSAMMENFASSUNG ===" -ForegroundColor Cyan
Write-Host "Heruntergeladene PDFs: $($downloadedFiles.Count)" -ForegroundColor Green

if ($downloadedFiles.Count -gt 0) {
    Write-Host "`nHeruntergeladene Dateien:"
    foreach ($file in $downloadedFiles) {
        $sizeKB = [math]::Round($file.size / 1024, 1)
        Write-Host "  - $($file.fileName) ($sizeKB KB)"
        Write-Host "    Quelle: $($file.subject)"
    }
}

if ($skippedFiles.Count -gt 0) {
    Write-Host "`nUebersprungene Dateien: $($skippedFiles.Count)" -ForegroundColor DarkYellow
    foreach ($file in $skippedFiles) {
        Write-Host "  - $($file.fileName) ($($file.reason))"
    }
}

# 6. ZIP-Dateien im Ordner analysieren
Write-Host "`n=== ZIP-ANALYSE ===" -ForegroundColor Cyan
$zipFiles = Get-ChildItem -Path $targetFolder -Filter "*.zip" -ErrorAction SilentlyContinue

if ($zipFiles) {
    Write-Host "Gefundene ZIP-Dateien im Ordner:"
    foreach ($zip in $zipFiles) {
        Write-Host "  - $($zip.Name) ($([math]::Round($zip.Length / 1024, 1)) KB)"
    }

    # Pruefen welche ZIPs durch PDFs ersetzt werden koennen
    Write-Host "`nZIP-Dateien die moeglicherweise ersetzt werden koennen:"
    foreach ($zip in $zipFiles) {
        $zipBaseName = [System.IO.Path]::GetFileNameWithoutExtension($zip.Name)
        $matchingPdfs = $downloadedFiles | Where-Object { $_.fileName -match $zipBaseName }
        if ($matchingPdfs) {
            Write-Host "  - $($zip.Name) -> PDFs verfuegbar" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Keine ZIP-Dateien im Ordner gefunden."
}

# Ergebnis als JSON exportieren
$result = @{
    downloaded = $downloadedFiles
    skipped = $skippedFiles
    zipFiles = @($zipFiles | ForEach-Object { $_.Name })
}
$result | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $targetFolder "_download_log.json") -Encoding UTF8

Write-Host "`nLog gespeichert in: $targetFolder\_download_log.json" -ForegroundColor Gray
