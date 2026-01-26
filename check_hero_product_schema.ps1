$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

# Input-Type für supply_product_version prüfen
$query = @"
{
  __type(name: "SupplyProductVersionInput") {
    name
    inputFields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
}
"@

$body = @{ query = $query } | ConvertTo-Json
$response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "=== SupplyProductVersionInput Felder ==="
$response.data.__type.inputFields | ForEach-Object {
    $typeName = if ($_.type.name) { $_.type.name } else { "$($_.type.ofType.name) ($($_.type.kind))" }
    Write-Host "  $($_.name): $typeName"
}

# Auch base_data prüfen
$query2 = @"
{
  __type(name: "SupplyBaseDataInput") {
    name
    inputFields {
      name
      type {
        name
        kind
      }
    }
  }
}
"@

$body2 = @{ query = $query2 } | ConvertTo-Json
$response2 = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
} -Body $body2

Write-Host "`n=== SupplyBaseDataInput Felder ==="
$response2.data.__type.inputFields | ForEach-Object {
    Write-Host "  $($_.name): $($_.type.name)"
}

# Prüfen ob es ein "active" oder ähnliches Feld auf supply_product_versions gibt
$query3 = @"
{
  supply_product_versions(first: 1) {
    product_id
    nr
    is_deleted
    is_active
    status
    active
  }
}
"@

$body3 = @{ query = $query3 } | ConvertTo-Json -Depth 3
try {
    $response3 = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
        "Authorization" = "Bearer $HERO_KEY"
        "Content-Type" = "application/json"
    } -Body $body3
    Write-Host "`n=== Test: Verfügbare Status-Felder ==="
    $response3.data.supply_product_versions[0] | ConvertTo-Json
} catch {
    Write-Host "`nFehler bei Status-Abfrage: $_"
}
