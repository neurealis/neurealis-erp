# Hero - Preisfelder prüfen
$HERO_API = "https://login.hero-software.de/api/external/v7/graphql"
$HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

$headers = @{
    "Authorization" = "Bearer $HERO_KEY"
    "Content-Type" = "application/json"
}

# Teste verschiedene Preisfelder
$priceFields = @(
    "base_price",
    "list_price",
    "listprice",
    "retail_price",
    "net_price",
    "sales_price",
    "purchase_price"
)

foreach ($field in $priceFields) {
    Write-Host "Teste: $field" -ForegroundColor Yellow
    $query = "{ supply_product_versions(first: 1) { product_id $field } }"
    $body = "{`"query`": `"$query`"}"

    try {
        $response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers $headers -Body $body
        if ($response.errors) {
            Write-Host "  -> Fehler: $($response.errors[0].message)" -ForegroundColor Red
        } else {
            Write-Host "  -> GEFUNDEN!" -ForegroundColor Green
            $response.data.supply_product_versions[0] | ConvertTo-Json
        }
    } catch {
        Write-Host "  -> Exception: $_" -ForegroundColor Red
    }
}

# Frage alle Preis-Daten ab
Write-Host "`n=== Beispiel Produktdaten ===" -ForegroundColor Cyan
$query = '{ supply_product_versions(first: 5) { product_id nr base_price base_data { name } supply_operator { name } } }'
$body = "{`"query`": `"$query`"}"
$response = Invoke-RestMethod -Uri $HERO_API -Method POST -Headers $headers -Body $body

$response.data.supply_product_versions | ForEach-Object {
    Write-Host "`nNr: $($_.nr)"
    Write-Host "  base_price: $($_.base_price)"
    Write-Host "  Operator: $($_.supply_operator.name)"
}
