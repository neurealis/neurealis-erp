import json
import os

# Supabase data: (artikelnummer, ek_preis, vk_preis, hero_product_id)
sb_data = [
    ("GWS-LV24-05.5", 100.00, 145.0, "GXg1zEM9EAA"),
    ("GWS.LV23-01.01.1", 45.81, 73.02, "Ge7LPSVXgAA"),
    ("GWS.LV23-01.01.10", 13.88, 22.12, "Ge7LPVBXgAA"),
    ("GWS.LV23-01.01.21", 33.95, 54.12, "Ge7LPXwXgAA"),
    ("GWS.LV23-01.01.24", 115.87, 184.7, "Ge7LPYiXgAA"),
    ("GWS.LV23-01.01.4", 367.82, 586.3, "Ge7LPTVXgAA"),
    ("GWS.LV23-01.01.7", 720.83, 983.61, "Ge7LPUNXgAA"),
    ("GWS.LV23-01.02.2", 20.00, 42.95, "Ge7LPjTXgAA"),
    ("GWS.LV23-02.01.10", 62.50, 84.03, "Ge7LPmdXgAA"),
    ("GWS.LV23-02.01.14", 65.69, 102.71, "Ge7LPntXgAA"),
    ("GWS.LV23-02.01.19", 94.22, 147.32, "Ge7LPpOXgAA"),
    ("GWS.LV23-02.01.20", 134.30, 209.98, "Ge7LPpkXgAA"),
    ("GWS.LV23-02.02.13", 14.08, 19.82, "Ge7LPtwXgAA"),
    ("GWS.LV23-02.03.1", 25.00, 57.06, "Ge7LPuUXgAA"),
    ("GWS.LV23-04.01.1", 37.11, 59.28, "Ge7LPu1XgAA"),
    ("GWS.LV23-04.01.4", 52.41, 83.73, "Ge7LPvpXgAA"),
    ("GWS.LV23-04.01.7", 50.38, 80.49, "Ge7LPwZXgAA"),
    ("GWS.LV23-04.01.8", 67.03, 107.1, "Ge7LPwsXgAA"),
    ("GWS.LV23-04.02.5", 32.77, 52.36, "Ge7LP4tXgAA"),
    ("GWS.LV23-04.03.1", 25.00, 59.5, "Ge7LP6QXgAA"),
    ("GWS.LV23-05.01.11", 34.24, 53.64, "Ge7LP-AXgAA"),
    ("GWS.LV23-05.02.1", 36.93, 57.84, "GGScJAkIsAA"),
    ("GWS.LV23-06.01.10", 4.86, 7.68, "GGScJFDIsAA"),
    ("GWS.LV23-06.01.11", 6.10, 9.65, "GGScJFHIsAA"),
    ("GWS.LV23-06.01.12", 20.24, 32.01, "GGScJFbIsAA"),
    ("GWS.LV23-06.01.14", 46.14, 72.98, "GGScJFiIsAA"),
    ("GWS.LV23-06.01.16", 24.28, 38.41, "GGScJGDIsAA"),
    ("GWS.LV23-06.01.17", 15.50, 24.52, "GGScJGIIsAA"),
    ("GWS.LV23-06.01.19", 14.03, 22.19, "GGScJGqIsAA"),
    ("GWS.LV23-06.01.20", 9.31, 14.72, "GGScJG_IsAA"),
    ("GWS.LV23-06.01.21", 9.31, 14.72, "GGScJHTIsAA"),
    ("GWS.LV23-06.01.22", 4.08, 5.93, "Ge7LQOfXgAA"),
    ("GWS.LV23-06.01.24", 37.77, 59.75, "GGScJITIsAA"),
    ("GWS.LV23-06.01.25", 64.75, 102.43, "GGScJIjIsAA"),
    ("GWS.LV23-06.01.26", 24.28, 38.41, "GGScJImIsAA"),
    ("GWS.LV23-06.01.27", 24.28, 38.41, "GGScJIpIsAA"),
    ("GWS.LV23-06.01.28", 52.21, 82.58, "GGScJI6IsAA"),
    ("GWS.LV23-06.01.30", 40.47, 64.02, "GGScJJjIsAA"),
    ("GWS.LV23-06.01.32", 63.54, 100.51, "GGScJJrIsAA"),
    ("GWS.LV23-06.01.33", 59.90, 94.75, "GGScJJ9IsAA"),
    ("GWS.LV23-06.01.34", 10.08, 15.94, "GGScJKOIsAA"),
    ("GWS.LV23-06.01.35", 12.01, 18.99, "GGScJKiIsAA"),
    ("GWS.LV23-06.01.37", 14.16, 22.41, "GGScJLNIsAA"),
    ("GWS.LV23-06.01.5", 16.19, 25.61, "GGScJDJIsAA"),
    ("GWS.LV23-06.01.6", 11.33, 17.92, "GGScJDNIsAA"),
    ("GWS.LV23-06.01.8", 5.13, 8.39, "GGScJEDIsAA"),
    ("GWS.LV23-06.01.9", 5.52, 8.73, "GGScJEkIsAA"),
    ("GWS.LV23-06.02.4", 2.30, 3.65, "GGScJNKIsAA"),
    ("GWS.LV23-06.03.1", 45.14, 71.49, "GGScJNYIsAA"),
    ("GWS.LV23-06.03.2", 45.67, 72.34, "GGScJNpIsAA"),
    ("GWS.LV23-06.03.3", 48.50, 76.82, "GGScJN8IsAA"),
    ("GWS.LV23-06.03.4", 48.50, 76.82, "GGScJOPIsAA"),
    ("GWS.LV23-06.03.5", 48.50, 76.82, "GGScJOgIsAA"),
    ("GWS.LV23-06.03.6", 54.16, 85.78, "GGScJOzIsAA"),
    ("GWS.LV23-06.03.7", 56.86, 90.05, "GGScJPDIsAA"),
    ("GWS.LV23-06.04.1", 37.10, 58.68, "GGScJPXIsAA"),
    ("GWS.LV23-06.04.2", 26.98, 42.68, "GGScJPtIsAA"),
    ("GWS.LV23-07.01.1", 5.73, 9.03, "GGScJP_IsAA"),
    ("GWS.LV23-07.01.10", 23.49, 37.04, "GGScJSQIsAA"),
    ("GWS.LV23-07.01.12", 5.14, 8.1, "Ge7LQaoXgAA"),
    ("GWS.LV23-07.01.13", 16.25, 22.1, "GGScJTDIsAA"),
    ("GWS.LV23-07.01.16", 3.66, 5.77, "GGScJT0IsAA"),
    ("GWS.LV23-07.01.2", 7.47, 11.79, "GGScJQRIsAA"),
    ("GWS.LV23-07.01.4", 2.52, 3.98, "Ge7LQYYXgAA"),
    ("GWS.LV23-07.01.6", 22.00, 27.78, "GGScJRZIsAA"),
    ("GWS.LV23-07.01.7", 30.43, 47.99, "GGScJRdIsAA"),
    ("GWS.LV23-08.01.2", 19.32, 30.9, "Ge7LQgVXgAA"),
    ("GWS.LV23-09.01.14", 5.79, 9.26, "Ge7LQ7tXgAA"),
    ("GWS.LV23-09.01.4", 2.42, 3.87, "Ge7LQ46XgAA"),
    ("GWS.LV23-09.04.8", 6.69, 10.7, "GGScKF7IsAA"),
    ("GWS.LV23-09.05.11", 41.67, 66.59, "Ge7LROmXgAA"),
    ("GWS.LV23-09.05.7", 12.10, 19.33, "Ge7LRNkXgAA"),
    ("GWS.LV23-09.05.8", 29.84, 47.69, "Ge7LRN0XgAA"),
    ("GWS.LV23-11.01.1", 31.25, 48.32, "GGScKOlIsAA"),
    ("GWS.LV23-11.01.2", 17.65, 28.13, "Ge7LRUXXgAA"),
    ("GWS.LV23-11.02.4", 145.83, 229.8, "GGScKQtIsAA"),
    ("GWS.LV23-12.02.3", 0.00, None, "Ge7LRaTXgAA"),
    ("GWS.LV23-12.03.3", 0.00, None, "Ge7LRa7XgAA"),
    ("GWS.LV23-12.04.3", 0.00, None, "Ge7LRbhXgAA"),
    ("GWS.LV23-12.05.3", 0.00, None, "Ge7LRcEXgAA"),
    ("GWS.LV23-20.01.11", 63.72, 103.15, "Ge7LRmTXgAA"),
    ("GWS.LV23-20.01.12", 26.04, 42.16, "Ge7LRmoXgAA"),
    ("GWS.LV23-20.01.27", 175.00, 255.64, "Ge7LRq_XgAA"),
    ("GWS.LV23-20.01.3", 41.56, 67.27, "Ge7LRc7XgAA"),
    ("GWS.LV23-20.01.30", 287.50, 457.46, "Ge7LRryXgAA"),
    ("GWS.LV23-20.01.5", 458.53, 742.25, "Ge7LRdfXgAA"),
    ("GWS.LV23-20.01.6", 58.87, 95.3, "Ge7LRdyXgAA"),
    ("GWS.LV23-20.01.8", 82.15, 132.98, "Ge7LRlZXgAA"),
    ("GWS.LV23-20.02.1", 2500.00, 3587.92, "GGScKs6IsAA"),
    ("GWS.LV23-20.03.2", 45.00, 56.06, "Ge7LRwuXgAA"),
    ("GWS.LV23-21.01.01.10", 82.48, 126.89, "Ge7LRzUXgAA"),
    ("GWS.LV23-21.01.01.8", 35.80, 55.07, "Ge7LRyzXgAA"),
    ("GWS.LV23-21.01.01.9", 64.43, 99.13, "Ge7LRzDXgAA"),
    ("GWS.LV23-21.01.03.1", 3183.60, 5121.68, "Ge7LR7OXgAA"),
    ("GWS.LV23-21.02.01.27", 254.30, 409.35, "GGScLKXIsAA"),
    ("GWS.LV23-21.02.01.33", 230.00, 352.13, "GGScLLIIsAA"),
    ("GWS.LV23-21.02.01.35", 56.25, 89.13, "Ge7LSSpXgAA"),
    ("GWS.LV23-21.04.1", 51.27, 82.53, "Ge7LSczXgAA"),
    ("GWS.LV23-21.04.2", 34.18, 55.02, "Ge7LSdFXgAA"),
]

results_dir = "/tmp/hero_results"
total = 0
match_count = 0
mismatch_count = 0
hero_error = 0
mismatches = []

print("=" * 130)
print("VOLLSTAENDIGE GWS-PREISVERIFIKATION: Supabase vs. Hero (alle 99 Positionen)")
print("=" * 130)
print()
hdr = f"| {'#':>3} | {'Artikelnr':<25} | {'SB-EK':>10} | {'Hero-EK':>10} | {'EK-Match':<8} | {'SB-VK':>10} | {'Hero-VK':>10} | {'VK-Match':<8} |"
print(hdr)
print(f"|{'':->5}|{'':->27}|{'':->12}|{'':->12}|{'':->10}|{'':->12}|{'':->12}|{'':->10}|")

for artikelnr, sb_ek, sb_vk, hero_id in sb_data:
    total += 1
    hero_file = os.path.join(results_dir, f"{hero_id}.json")

    if not os.path.exists(hero_file):
        hero_error += 1
        sb_vk_s = f"{sb_vk:.2f}" if sb_vk is not None else "NULL"
        print(f"| {total:>3} | {artikelnr:<25} | {sb_ek:>10.2f} | {'FEHLER':>10} | {'N/A':<8} | {sb_vk_s:>10} | {'FEHLER':>10} | {'N/A':<8} |")
        continue

    try:
        with open(hero_file) as f:
            data = json.load(f)

        versions = data.get("data", {}).get("supply_product_versions", [])
        if not versions:
            hero_error += 1
            sb_vk_s = f"{sb_vk:.2f}" if sb_vk is not None else "NULL"
            print(f"| {total:>3} | {artikelnr:<25} | {sb_ek:>10.2f} | {'LEER':>10} | {'N/A':<8} | {sb_vk_s:>10} | {'LEER':>10} | {'N/A':<8} |")
            continue

        v = versions[0]
        hero_ek = v.get("base_price")
        hero_vk = v.get("list_price")

        hero_ek_f = float(hero_ek) if hero_ek is not None else 0.0
        hero_vk_f = float(hero_vk) if hero_vk is not None else 0.0
        sb_ek_f = float(sb_ek) if sb_ek is not None else 0.0
        sb_vk_f = float(sb_vk) if sb_vk is not None else 0.0

        ek_match = abs(sb_ek_f - hero_ek_f) < 0.015
        vk_match = abs(sb_vk_f - hero_vk_f) < 0.015

        # Handle NULL cases
        if sb_vk is None and hero_vk is None:
            vk_match = True
        if sb_vk is None and hero_vk_f == 0.0:
            vk_match = True
        if sb_vk_f == 0.0 and hero_vk is None:
            vk_match = True

        ek_str = "OK" if ek_match else "DIFF"
        vk_str = "OK" if vk_match else "DIFF"

        hero_ek_display = f"{hero_ek_f:.2f}" if hero_ek is not None else "NULL"
        hero_vk_display = f"{hero_vk_f:.2f}" if hero_vk is not None else "NULL"
        sb_vk_display = f"{sb_vk_f:.2f}" if sb_vk is not None else "NULL"

        if ek_match and vk_match:
            match_count += 1
        else:
            mismatch_count += 1
            diff_ek = hero_ek_f - sb_ek_f
            diff_vk = hero_vk_f - sb_vk_f
            mismatches.append((artikelnr, sb_ek_f, hero_ek_f, diff_ek, sb_vk_f, hero_vk_f, diff_vk, ek_str, vk_str))

        print(f"| {total:>3} | {artikelnr:<25} | {sb_ek_f:>10.2f} | {hero_ek_display:>10} | {ek_str:<8} | {sb_vk_display:>10} | {hero_vk_display:>10} | {vk_str:<8} |")

    except Exception as e:
        hero_error += 1
        sb_vk_s = f"{sb_vk:.2f}" if sb_vk is not None else "NULL"
        print(f"| {total:>3} | {artikelnr:<25} | {sb_ek:>10.2f} | {'ERROR':>10} | {'N/A':<8} | {sb_vk_s:>10} | {'ERROR':>10} | {'N/A':<8} |")

print()
print("=" * 130)
print("ZUSAMMENFASSUNG")
print("=" * 130)
print(f"Gesamtanzahl geprueft:      {total}")
print(f"100% Match (EK+VK):         {match_count}")
print(f"Abweichungen:               {mismatch_count}")
print(f"Hero-Fehler/nicht gefunden:  {hero_error}")
print()

if mismatches:
    print("=" * 130)
    print("DETAILS ALLER ABWEICHUNGEN")
    print("=" * 130)
    for art, sb_e, h_e, d_e, sb_v, h_v, d_v, ek_s, vk_s in mismatches:
        print()
        print(f"  Artikelnr:  {art}")
        if ek_s == "DIFF":
            pct_e = ((h_e - sb_e) / sb_e * 100) if sb_e != 0 else float("inf")
            print(f"  EK: Supabase={sb_e:.2f}  Hero={h_e:.2f}  Differenz={d_e:+.2f} ({pct_e:+.2f}%)")
        else:
            print(f"  EK: OK (beide {sb_e:.2f})")
        if vk_s == "DIFF":
            pct_v = ((h_v - sb_v) / sb_v * 100) if sb_v != 0 else float("inf")
            print(f"  VK: Supabase={sb_v:.2f}  Hero={h_v:.2f}  Differenz={d_v:+.2f} ({pct_v:+.2f}%)")
        else:
            vk_display = f"{sb_v:.2f}" if sb_v else "NULL/0"
            print(f"  VK: OK (beide {vk_display})")
else:
    print("KEINE Abweichungen gefunden - alle Preise sind synchron!")
