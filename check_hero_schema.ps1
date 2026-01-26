# Hero Schema prüfen - welche Felder gibt es?
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

# Introspection Query
$query = '{ __type(name: "SupplyProductVersion") { fields { name type { name kind ofType { name kind } } } } }'

$body = @{ query = $query } | ConvertTo-Json -Depth 10
$response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "=== SupplyProductVersion Felder ===" -ForegroundColor Cyan
$response.data.__type.fields | ForEach-Object {
    $typeName = if ($_.type.name) { $_.type.name } elseif ($_.type.ofType.name) { $_.type.ofType.name } else { $_.type.kind }
    Write-Host "  $($_.name) -> $typeName"
}
