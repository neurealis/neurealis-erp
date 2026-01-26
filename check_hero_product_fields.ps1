$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

# Alle Felder von supply_product_version prüfen
$query = @"
{
  __type(name: "SupplyProductVersion") {
    name
    fields {
      name
      type {
        name
        kind
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

Write-Host "=== SupplyProductVersion Felder ==="
$response.data.__type.fields | ForEach-Object {
    Write-Host "  $($_.name): $($_.type.name) ($($_.type.kind))"
}

# Ein vollständiges Product abrufen mit allen möglichen Feldern
$query2 = @"
{
  supply_product_versions(first: 2) {
    product_id
    nr
    internal_identifier
    base_data {
      name
      description
      manufacturer
      category
    }
    supply_operator {
      id
      name
    }
    base_price
    created_at
    updated_at
  }
}
"@

$body2 = @{ query = $query2 } | ConvertTo-Json
$response2 = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
} -Body $body2

Write-Host "`n=== Beispiel-Products ==="
$response2.data.supply_product_versions | ConvertTo-Json -Depth 5
