# Hero API Schema/Mutations prüfen
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

$introspectionQuery = @"
{
  __schema {
    mutationType {
      fields {
        name
        description
        args {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
}
"@

$body = @{ query = $introspectionQuery } | ConvertTo-Json
$response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "=== Hero API Mutations ==="
$mutations = $response.data.__schema.mutationType.fields | Where-Object { 
    $_.name -like '*product*' -or $_.name -like '*supply*' -or $_.name -like '*delete*' -or $_.name -like '*update*'
}

$mutations | ForEach-Object {
    Write-Host "`n$($_.name):"
    if ($_.description) { Write-Host "  Beschreibung: $($_.description)" }
    $_.args | ForEach-Object {
        Write-Host "  - $($_.name): $($_.type.name) ($($_.type.kind))"
    }
}

# Speichern für Analyse
$response | ConvertTo-Json -Depth 10 | Out-File "C:\Users\holge\neurealis-erp\hero_schema.json" -Encoding UTF8
