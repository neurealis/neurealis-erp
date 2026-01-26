# -*- coding: utf-8 -*-
import pandas as pd

# Hornbach Links für die Produkte
hornbach_links = {
    'Reflex SI': {
        'Kategorie': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-reflex-si/S29174/',
        'Ausschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Ausschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usgl-schaltereinsatz-aus-wechsel/3068226/',
        'Kontrollschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Kontrollschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2001-6-usgl-kontrollschalter-einsatz/3068227/',
        'Serienschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-2505-214-wippe-serie-reflex-si-alpinweiss/3068244/',
        'Serienschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-5-usgl-serienschalter-einsatz/3068225/',
        'Wechselschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-2506-214-wippe-universal-reflex-si-alpinweiss/3068186/',
        'Wechselschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usgl-schaltereinsatz-aus-wechsel/3068226/',
        'Steckdose Einsatz': 'https://www.hornbach.de/p/busch-jaeger-20-euc-214-steckdose-reflex-si-alpinweiss/3068164/',
        'TAE-Dose (Telefon)': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-reflex-si/S29174/',
        'Antennendose (SAT/TV)': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-reflex-si/S29174/',
        'Rahmen 1-fach': 'https://www.hornbach.de/p/busch-jaeger-2511-214-abdeckrahmen-1-fach-reflex-si-alpinweiss/3068150/',
        'Rahmen 2-fach': 'https://www.hornbach.de/p/busch-jaeger-2512-214-abdeckrahmen-2-fach-reflex-si-alpinweiss/3068151/',
        'Rahmen 3-fach': 'https://www.hornbach.de/p/busch-jaeger-2513-214-abdeckrahmen-3-fach-reflex-si-alpinweiss/3068152/',
    },
    'Future Linear': {
        'Kategorie': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-future-linear/S29172/',
        'Ausschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
        'Ausschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usgl-schaltereinsatz-aus-wechsel/3068226/',
        'Kontrollschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
        'Kontrollschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2001-6-usgl-kontrollschalter-einsatz/3068227/',
        'Serienschalter Wippe': 'https://www.hornbach.de/p/wippe-serie-busch-jaeger-future-linear-studioweiss/5139978/',
        'Serienschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-5-usgl-serienschalter-einsatz/3068225/',
        'Wechselschalter Wippe': 'https://www.hornbach.de/p/busch-jaeger-1786-84-wippe-universal-future-linear-studioweiss/5139973/',
        'Wechselschalter Einsatz': 'https://www.hornbach.de/p/busch-jaeger-2000-6-usgl-schaltereinsatz-aus-wechsel/3068226/',
        'Steckdose Einsatz': 'https://www.hornbach.de/p/steckdosen-einsatz-busch-jaeger-future-linear-studioweiss/5139971/',
        'TAE-Dose (Telefon)': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-future-linear/S29172/',
        'Antennendose (SAT/TV)': 'https://www.hornbach.de/c/leuchten-elektro/schalterprogramme/busch-jaeger-schalterprogramme/busch-jaeger-future-linear/S29172/',
        'Rahmen 1-fach': 'https://www.hornbach.de/p/busch-jaeger-1721-184k-abdeckrahmen-1-fach-future-linear-studioweiss/5139962/',
        'Rahmen 2-fach': 'https://www.hornbach.de/p/busch-jaeger-1722-184k-abdeckrahmen-2-fach-future-linear-studioweiss/5139963/',
        'Rahmen 3-fach': 'https://www.hornbach.de/p/busch-jaeger-1723-184k-abdeckrahmen-3-fach-future-linear-studioweiss/5139964/',
    },
}

# Artikelliste mit allen Daten
artikel_liste = [
    {'Artikel': 'Ausschalter Wippe', 'Menge': 4, 'Reflex SI EP': 2.85, 'Future Linear EP': 4.30},
    {'Artikel': 'Ausschalter Einsatz', 'Menge': 4, 'Reflex SI EP': 5.65, 'Future Linear EP': 5.65},
    {'Artikel': 'Kontrollschalter Wippe', 'Menge': 1, 'Reflex SI EP': 2.85, 'Future Linear EP': 4.30},
    {'Artikel': 'Kontrollschalter Einsatz', 'Menge': 1, 'Reflex SI EP': 11.50, 'Future Linear EP': 11.50},
    {'Artikel': 'Serienschalter Wippe', 'Menge': 1, 'Reflex SI EP': 4.75, 'Future Linear EP': 7.15},
    {'Artikel': 'Serienschalter Einsatz', 'Menge': 1, 'Reflex SI EP': 9.65, 'Future Linear EP': 9.65},
    {'Artikel': 'Wechselschalter Wippe', 'Menge': 2, 'Reflex SI EP': 2.85, 'Future Linear EP': 4.30},
    {'Artikel': 'Wechselschalter Einsatz', 'Menge': 2, 'Reflex SI EP': 5.65, 'Future Linear EP': 5.65},
    {'Artikel': 'Steckdose Einsatz', 'Menge': 35, 'Reflex SI EP': 3.25, 'Future Linear EP': 3.25},
    {'Artikel': 'TAE-Dose (Telefon)', 'Menge': 1, 'Reflex SI EP': 8.95, 'Future Linear EP': 8.95},
    {'Artikel': 'Antennendose (SAT/TV)', 'Menge': 1, 'Reflex SI EP': 12.50, 'Future Linear EP': 12.50},
    {'Artikel': 'Rahmen 1-fach', 'Menge': 18, 'Reflex SI EP': 1.90, 'Future Linear EP': 2.80},
    {'Artikel': 'Rahmen 2-fach', 'Menge': 11, 'Reflex SI EP': 3.35, 'Future Linear EP': 5.00},
    {'Artikel': 'Rahmen 3-fach', 'Menge': 1, 'Reflex SI EP': 4.80, 'Future Linear EP': 7.20},
]

# Berechnung und Links hinzufügen
for row in artikel_liste:
    row['Reflex SI Ges.'] = round(row['Menge'] * row['Reflex SI EP'], 2)
    row['Future Linear Ges.'] = round(row['Menge'] * row['Future Linear EP'], 2)
    row['Differenz'] = round(row['Future Linear Ges.'] - row['Reflex SI Ges.'], 2)

    # Links hinzufügen
    artikel = row['Artikel']
    row['Link Reflex SI'] = hornbach_links['Reflex SI'].get(artikel, hornbach_links['Reflex SI']['Kategorie'])
    row['Link Future Linear'] = hornbach_links['Future Linear'].get(artikel, hornbach_links['Future Linear']['Kategorie'])

# DataFrame erstellen
df = pd.DataFrame(artikel_liste)

# Spaltenreihenfolge
df = df[['Artikel', 'Menge', 'Reflex SI EP', 'Reflex SI Ges.', 'Link Reflex SI',
         'Future Linear EP', 'Future Linear Ges.', 'Link Future Linear', 'Differenz']]

# Summen
summe_rs = df['Reflex SI Ges.'].sum()
summe_fl = df['Future Linear Ges.'].sum()

# Excel speichern
output = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - 11 Nachunternehmer - 11 Nachunternehmer\Elektrik - Wladimir Kusnezow\2026-01 covivio Rechnungen vergleich\Covivio_3Zi_Artikelliste_Vergleich.xlsx"

with pd.ExcelWriter(output, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='Artikelliste', index=False)

    # Worksheet für Formatierung
    worksheet = writer.sheets['Artikelliste']

    # Spaltenbreiten anpassen
    worksheet.column_dimensions['A'].width = 25  # Artikel
    worksheet.column_dimensions['B'].width = 8   # Menge
    worksheet.column_dimensions['C'].width = 12  # RS EP
    worksheet.column_dimensions['D'].width = 12  # RS Ges
    worksheet.column_dimensions['E'].width = 50  # Link RS
    worksheet.column_dimensions['F'].width = 12  # FL EP
    worksheet.column_dimensions['G'].width = 12  # FL Ges
    worksheet.column_dimensions['H'].width = 50  # Link FL
    worksheet.column_dimensions['I'].width = 10  # Differenz

print(f"Excel mit Links gespeichert: {output}")
print(f"\nSumme Reflex SI:      {summe_rs:.2f} EUR")
print(f"Summe Future Linear:  {summe_fl:.2f} EUR")
print(f"Differenz:           +{summe_fl - summe_rs:.2f} EUR")
