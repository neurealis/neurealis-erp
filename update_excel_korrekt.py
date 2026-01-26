# -*- coding: utf-8 -*-
import pandas as pd

# ============================================================
# AKTUELLE HORNBACH-PREISE (Stand 26.01.2026) - BRUTTO
# ============================================================

hornbach_brutto = {
    # Einsätze (für beide Serien identisch)
    'Aus/Wechselschalter Einsatz': 5.76,
    'Serienschalter Einsatz': 8.85,
    'Kontrollschalter Einsatz': 15.81,

    # Reflex SI
    'RS Wippe universal': 2.31,
    'RS Wippe Serie': 4.69,
    'RS Steckdose': 4.02,
    'RS Rahmen 1-fach': 1.71,
    'RS Rahmen 2-fach': 2.98,
    'RS Rahmen 3-fach': 5.53,

    # Future Linear
    'FL Wippe universal': 3.85,
    'FL Wippe Serie': 5.85,
    'FL Steckdose': 5.54,
    'FL Rahmen 1-fach': 2.94,
    'FL Rahmen 2-fach': 3.33,
    'FL Rahmen 3-fach': 6.95,
}

# TAE/Antenne - geschätzt (gleich für beide)
hornbach_brutto['TAE-Dose'] = 9.95
hornbach_brutto['Antennendose'] = 14.95

# Brutto → Netto (÷ 1.19)
def brutto_zu_netto(brutto):
    return round(brutto / 1.19, 2)

# ============================================================
# ARTIKELLISTE MIT KORREKTEN PREISEN
# ============================================================

artikel_liste = [
    {
        'Artikel': 'Ausschalter Wippe',
        'Menge': 4,
        'RS_Brutto': hornbach_brutto['RS Wippe universal'],
        'FL_Brutto': hornbach_brutto['FL Wippe universal'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
    },
    {
        'Artikel': 'Ausschalter Einsatz',
        'Menge': 4,
        'RS_Brutto': hornbach_brutto['Aus/Wechselschalter Einsatz'],
        'FL_Brutto': hornbach_brutto['Aus/Wechselschalter Einsatz'],  # gleich
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2000-6-us-wippschalter-einsatz-aus-wechselschalter/3069269/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-2000-6-us-wippschalter-einsatz-aus-wechselschalter/3069269/',
    },
    {
        'Artikel': 'Kontrollschalter Wippe',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['RS Wippe universal'],
        'FL_Brutto': hornbach_brutto['FL Wippe universal'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
    },
    {
        'Artikel': 'Kontrollschalter Einsatz',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['Kontrollschalter Einsatz'],
        'FL_Brutto': hornbach_brutto['Kontrollschalter Einsatz'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usk-wippkontrollschalter-einsatz-aus-wechselschaltung/3069281/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usk-wippkontrollschalter-einsatz-aus-wechselschaltung/3069281/',
    },
    {
        'Artikel': 'Serienschalter Wippe',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['RS Wippe Serie'],
        'FL_Brutto': hornbach_brutto['FL Wippe Serie'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2505-214-wippe-serie-reflex-si-alpinweiss/3068244/',
        'Link_FL': 'https://www.hornbach.de/p/wippe-serie-busch-jaeger-future-linear-studioweiss/5139978/',
    },
    {
        'Artikel': 'Serienschalter Einsatz',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['Serienschalter Einsatz'],
        'FL_Brutto': hornbach_brutto['Serienschalter Einsatz'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2000-5-us-wippschalter-einsatz-serienschaltung/3069261/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-2000-5-us-wippschalter-einsatz-serienschaltung/3069261/',
    },
    {
        'Artikel': 'Wechselschalter Wippe',
        'Menge': 2,
        'RS_Brutto': hornbach_brutto['RS Wippe universal'],
        'FL_Brutto': hornbach_brutto['FL Wippe universal'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
    },
    {
        'Artikel': 'Wechselschalter Einsatz',
        'Menge': 2,
        'RS_Brutto': hornbach_brutto['Aus/Wechselschalter Einsatz'],
        'FL_Brutto': hornbach_brutto['Aus/Wechselschalter Einsatz'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2000-6-us-wippschalter-einsatz-aus-wechselschalter/3069269/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-2000-6-us-wippschalter-einsatz-aus-wechselschalter/3069269/',
    },
    {
        'Artikel': 'Steckdose Einsatz',
        'Menge': 35,
        'RS_Brutto': hornbach_brutto['RS Steckdose'],
        'FL_Brutto': hornbach_brutto['FL Steckdose'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-20-euc-214-steckdose-reflex-si-alpinweiss/3068164/',
        'Link_FL': 'https://www.hornbach.de/p/steckdosen-einsatz-busch-jaeger-future-linear-studioweiss/5139971/',
    },
    {
        'Artikel': 'TAE-Dose (Telefon)',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['TAE-Dose'],
        'FL_Brutto': hornbach_brutto['TAE-Dose'],
        'Link_RS': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-reflex-si/S29174/',
        'Link_FL': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-future-linear/S29172/',
    },
    {
        'Artikel': 'Antennendose (SAT/TV)',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['Antennendose'],
        'FL_Brutto': hornbach_brutto['Antennendose'],
        'Link_RS': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-reflex-si/S29174/',
        'Link_FL': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-future-linear/S29172/',
    },
    {
        'Artikel': 'Rahmen 1-fach',
        'Menge': 18,
        'RS_Brutto': hornbach_brutto['RS Rahmen 1-fach'],
        'FL_Brutto': hornbach_brutto['FL Rahmen 1-fach'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2511-214-abdeckrahmen-1-fach-reflex-si-alpinweiss/3068150/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1721-184k-abdeckrahmen-1-fach-future-linear-studioweiss/5139962/',
    },
    {
        'Artikel': 'Rahmen 2-fach',
        'Menge': 11,
        'RS_Brutto': hornbach_brutto['RS Rahmen 2-fach'],
        'FL_Brutto': hornbach_brutto['FL Rahmen 2-fach'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2512-214-abdeckrahmen-2-fach-reflex-si-alpinweiss/3068288/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1722-184k-abdeckrahmen-2-fach-future-linear-studioweiss/7358809/',
    },
    {
        'Artikel': 'Rahmen 3-fach',
        'Menge': 1,
        'RS_Brutto': hornbach_brutto['RS Rahmen 3-fach'],
        'FL_Brutto': hornbach_brutto['FL Rahmen 3-fach'],
        'Link_RS': 'https://www.hornbach.de/p/busch-jaeger-2513-214-abdeckrahmen-3-fach-reflex-si-alpinweiss/3068299/',
        'Link_FL': 'https://www.hornbach.de/p/busch-jaeger-1723-184k-abdeckrahmen-3-fach-future-linear-studioweiss/7358811/',
    },
]

# Netto-Preise und Summen berechnen
for row in artikel_liste:
    row['RS_Netto'] = brutto_zu_netto(row['RS_Brutto'])
    row['FL_Netto'] = brutto_zu_netto(row['FL_Brutto'])
    row['RS_Ges_Netto'] = round(row['Menge'] * row['RS_Netto'], 2)
    row['FL_Ges_Netto'] = round(row['Menge'] * row['FL_Netto'], 2)
    row['Differenz'] = round(row['FL_Ges_Netto'] - row['RS_Ges_Netto'], 2)

# DataFrame erstellen
df = pd.DataFrame(artikel_liste)

# Spaltenreihenfolge für Export
df_export = df[[
    'Artikel', 'Menge',
    'RS_Brutto', 'RS_Netto', 'RS_Ges_Netto', 'Link_RS',
    'FL_Brutto', 'FL_Netto', 'FL_Ges_Netto', 'Link_FL',
    'Differenz'
]]

# Spalten umbenennen für bessere Lesbarkeit
df_export.columns = [
    'Artikel', 'Menge',
    'Reflex SI Brutto', 'Reflex SI Netto', 'RS Gesamt Netto', 'Link Reflex SI',
    'Future Linear Brutto', 'Future Linear Netto', 'FL Gesamt Netto', 'Link Future Linear',
    'Differenz Netto'
]

# Summen
summe_rs = df['RS_Ges_Netto'].sum()
summe_fl = df['FL_Ges_Netto'].sum()
differenz = summe_fl - summe_rs

# Ausgabe
print("=" * 100)
print("COVIVIO 3-Zi-Wohnung (62,5m²) - KORRIGIERTE PREISE")
print("Hornbach-Preise vom 26.01.2026 (Brutto -> Netto)")
print("=" * 100)

print(f"\n{'Artikel':<25} {'Menge':>6} {'RS Brutto':>10} {'RS Netto':>10} {'FL Brutto':>10} {'FL Netto':>10} {'Diff.':>8}")
print("-" * 100)

for _, row in df.iterrows():
    diff_str = f"+{row['Differenz']:.2f}" if row['Differenz'] > 0 else f"{row['Differenz']:.2f}"
    print(f"{row['Artikel']:<25} {row['Menge']:>6} {row['RS_Brutto']:>10.2f} {row['RS_Netto']:>10.2f} {row['FL_Brutto']:>10.2f} {row['FL_Netto']:>10.2f} {diff_str:>8}")

print("-" * 100)
print(f"{'SUMME NETTO':<25} {'':>6} {'':>10} {summe_rs:>10.2f} {'':>10} {summe_fl:>10.2f} {'+' + str(round(differenz,2)):>8}")

print(f"\n\nAufpreis Future Linear: {differenz:.2f} EUR netto ({(differenz/summe_rs)*100:.1f}%)")

# Excel speichern
output = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - 11 Nachunternehmer - 11 Nachunternehmer\Elektrik - Wladimir Kusnezow\2026-01 covivio Rechnungen vergleich\Covivio_3Zi_Artikelliste_Vergleich.xlsx"

with pd.ExcelWriter(output, engine='openpyxl') as writer:
    df_export.to_excel(writer, sheet_name='Artikelliste', index=False)

    worksheet = writer.sheets['Artikelliste']

    # Spaltenbreiten
    worksheet.column_dimensions['A'].width = 25
    worksheet.column_dimensions['B'].width = 8
    worksheet.column_dimensions['C'].width = 14
    worksheet.column_dimensions['D'].width = 14
    worksheet.column_dimensions['E'].width = 14
    worksheet.column_dimensions['F'].width = 70
    worksheet.column_dimensions['G'].width = 16
    worksheet.column_dimensions['H'].width = 16
    worksheet.column_dimensions['I'].width = 14
    worksheet.column_dimensions['J'].width = 70
    worksheet.column_dimensions['K'].width = 12

print(f"\nExcel gespeichert: {output}")
