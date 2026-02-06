import json
import subprocess
import time

# All 99 hero_product_ids
all_ids = [
    "GXg1zEM9EAA", "Ge7LPSVXgAA", "Ge7LPVBXgAA", "Ge7LPXwXgAA", "Ge7LPYiXgAA",
    "Ge7LPTVXgAA", "Ge7LPUNXgAA", "Ge7LPjTXgAA", "Ge7LPmdXgAA", "Ge7LPntXgAA",
    "Ge7LPpOXgAA", "Ge7LPpkXgAA", "Ge7LPtwXgAA", "Ge7LPuUXgAA", "Ge7LPu1XgAA",
    "Ge7LPvpXgAA", "Ge7LPwZXgAA", "Ge7LPwsXgAA", "Ge7LP4tXgAA", "Ge7LP6QXgAA",
    "Ge7LP-AXgAA", "GGScJAkIsAA", "GGScJFDIsAA", "GGScJFHIsAA", "GGScJFbIsAA",
    "GGScJFiIsAA", "GGScJGDIsAA", "GGScJGIIsAA", "GGScJGqIsAA", "GGScJG_IsAA",
    "GGScJHTIsAA", "Ge7LQOfXgAA", "GGScJITIsAA", "GGScJIjIsAA", "GGScJImIsAA",
    "GGScJIpIsAA", "GGScJI6IsAA", "GGScJJjIsAA", "GGScJJrIsAA", "GGScJJ9IsAA",
    "GGScJKOIsAA", "GGScJKiIsAA", "GGScJLNIsAA", "GGScJDJIsAA", "GGScJDNIsAA",
    "GGScJEDIsAA", "GGScJEkIsAA", "GGScJNKIsAA", "GGScJNYIsAA", "GGScJNpIsAA",
    "GGScJN8IsAA", "GGScJOPIsAA", "GGScJOgIsAA", "GGScJOzIsAA", "GGScJPDIsAA",
    "GGScJPXIsAA", "GGScJPtIsAA", "GGScJP_IsAA", "GGScJSQIsAA", "Ge7LQaoXgAA",
    "GGScJTDIsAA", "GGScJT0IsAA", "GGScJQRIsAA", "Ge7LQYYXgAA", "GGScJRZIsAA",
    "GGScJRdIsAA", "Ge7LQgVXgAA", "Ge7LQ7tXgAA", "Ge7LQ46XgAA", "GGScKF7IsAA",
    "Ge7LROmXgAA", "Ge7LRNkXgAA", "Ge7LRN0XgAA", "GGScKOlIsAA", "Ge7LRUXXgAA",
    "GGScKQtIsAA", "Ge7LRaTXgAA", "Ge7LRa7XgAA", "Ge7LRbhXgAA", "Ge7LRcEXgAA",
    "Ge7LRmTXgAA", "Ge7LRmoXgAA", "Ge7LRq_XgAA", "Ge7LRc7XgAA", "Ge7LRryXgAA",
    "Ge7LRdfXgAA", "Ge7LRdyXgAA", "Ge7LRlZXgAA", "GGScKs6IsAA", "Ge7LRwuXgAA",
    "Ge7LRzUXgAA", "Ge7LRyzXgAA", "Ge7LRzDXgAA", "Ge7LR7OXgAA", "GGScLKXIsAA",
    "GGScLLIIsAA", "Ge7LSSpXgAA", "Ge7LSczXgAA", "Ge7LSdFXgAA",
]

HERO_URL = "https://login.hero-software.de/api/external/v7/graphql"
HERO_KEY = "ac_YDjiMpClamttVIZdjLv7uMZ3nhWUDYFz"

all_results = {}
BATCH_SIZE = 10

for i in range(0, len(all_ids), BATCH_SIZE):
    batch = all_ids[i:i+BATCH_SIZE]
    ids_str = ", ".join([f'\\"{pid}\\"' for pid in batch])
    query = f'{{ supply_product_versions(product_ids: [{ids_str}]) {{ product_id base_price list_price base_data {{ name }} }} }}'

    payload = json.dumps({"query": query})

    result = subprocess.run(
        ["curl", "-s", "-X", "POST", HERO_URL,
         "-H", f"Authorization: Bearer {HERO_KEY}",
         "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True, text=True, timeout=30
    )

    try:
        data = json.loads(result.stdout)
        versions = data.get("data", {}).get("supply_product_versions", [])
        for v in versions:
            all_results[v["product_id"]] = {
                "base_price": v.get("base_price"),
                "list_price": v.get("list_price"),
                "name": v.get("base_data", {}).get("name", "")
            }
        print(f"Batch {i//BATCH_SIZE + 1}: {len(versions)} Produkte geladen (gesamt: {len(all_results)})")
    except Exception as e:
        print(f"Batch {i//BATCH_SIZE + 1}: FEHLER - {e}")
        print(f"  Response: {result.stdout[:200]}")

    time.sleep(0.3)

print(f"\nGesamt: {len(all_results)} von {len(all_ids)} Produkten geladen")

# Save results
with open("/tmp/hero_all_prices.json", "w") as f:
    json.dump(all_results, f, indent=2)

print("Ergebnisse gespeichert in /tmp/hero_all_prices.json")
