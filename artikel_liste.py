# -*- coding: utf-8 -*-
import pandas as pd

# Covivio 3-Zi-Wohnung (62,5m2) - Detaillierte Artikelliste
# Basierend auf Covivio Qualitaetshandbuch

print("=" * 90)
print("COVIVIO 3-Zi-Wohnung (62,5m2) - DETAILLIERTE ARTIKELLISTE")
print("=" * 90)

# Gesamtmengen basierend auf Covivio Grundausstattung
gesamt = {
    'Ausschalter': 4,           # Kueche, Bad Wand, Schlafzimmer, Kinderzimmer
    'Kontrollschalter': 1,      # Bad Decke
    'Serienschalter': 1,        # Wohnzimmer
    'Wechselschalter': 2,       # Diele (2 Schaltstellen)
    'Steckdose 1-fach': 14,     # Einzelsteckdosen
    'Steckdose 2-fach': 10,     # 2-fach Kombinationen (= 20 Einsaetze)
    'Steckdose Spuelmaschine': 1,
    'TAE-Dose': 1,              # Telefon Diele
    'Antennendose': 1,          # TV Wohnzimmer
    'Rahmen 1-fach': 18,        # Schalter + Einzelsteckdosen + TAE + Antenne
    'Rahmen 2-fach': 11,        # 2-fach Steckdosen
    'Rahmen 3-fach': 1,         # Kueche Arbeitsplatte
}

print("\nGESAMTMENGEN:")
print("-" * 40)
for art, menge in sorted(gesamt.items()):
    print(f"  {menge:2d}x {art}")

# Hornbach Preise (Stand 01/2026)
preise = {
    'Reflex SI': {
        'Ausschalter Wippe': 2.85,
        'Ausschalter Einsatz': 5.65,
        'Kontrollschalter Wippe': 2.85,
        'Kontrollschalter Einsatz': 11.50,
        'Serienschalter Wippe': 4.75,
        'Serienschalter Einsatz': 9.65,
        'Wechselschalter Wippe': 2.85,
        'Wechselschalter Einsatz': 5.65,
        'Steckdose Einsatz': 3.25,
        'Rahmen 1-fach': 1.90,
        'Rahmen 2-fach': 3.35,
        'Rahmen 3-fach': 4.80,
        'TAE-Dose': 8.95,
        'Antennendose': 12.50,
    },
    'Future Linear': {
        'Ausschalter Wippe': 4.30,
        'Ausschalter Einsatz': 5.65,
        'Kontrollschalter Wippe': 4.30,
        'Kontrollschalter Einsatz': 11.50,
        'Serienschalter Wippe': 7.15,
        'Serienschalter Einsatz': 9.65,
        'Wechselschalter Wippe': 4.30,
        'Wechselschalter Einsatz': 5.65,
        'Steckdose Einsatz': 3.25,
        'Rahmen 1-fach': 2.80,
        'Rahmen 2-fach': 5.00,
        'Rahmen 3-fach': 7.20,
        'TAE-Dose': 8.95,
        'Antennendose': 12.50,
    },
}

# Detaillierte Artikelliste
artikel_liste = []

# Schalter (Wippe + Einsatz getrennt)
schalter_typen = [
    ('Ausschalter', gesamt['Ausschalter']),
    ('Kontrollschalter', gesamt['Kontrollschalter']),
    ('Serienschalter', gesamt['Serienschalter']),
    ('Wechselschalter', gesamt['Wechselschalter']),
]

for schalter_typ, anzahl in schalter_typen:
    if anzahl > 0:
        # Wippe
        artikel_liste.append({
            'Artikel': f'{schalter_typ} Wippe',
            'Menge': anzahl,
            'Reflex SI EP': preise['Reflex SI'][f'{schalter_typ} Wippe'],
            'Future Linear EP': preise['Future Linear'][f'{schalter_typ} Wippe'],
        })
        # Einsatz
        artikel_liste.append({
            'Artikel': f'{schalter_typ} Einsatz',
            'Menge': anzahl,
            'Reflex SI EP': preise['Reflex SI'][f'{schalter_typ} Einsatz'],
            'Future Linear EP': preise['Future Linear'][f'{schalter_typ} Einsatz'],
        })

# Steckdosen (Einsaetze)
steckdosen_anzahl = (gesamt['Steckdose 1-fach'] +
                    gesamt['Steckdose Spuelmaschine'] +
                    gesamt['Steckdose 2-fach'] * 2)  # 2-fach = 2 Einsaetze

artikel_liste.append({
    'Artikel': 'Steckdose Einsatz',
    'Menge': steckdosen_anzahl,
    'Reflex SI EP': preise['Reflex SI']['Steckdose Einsatz'],
    'Future Linear EP': preise['Future Linear']['Steckdose Einsatz'],
})

# TAE + Antenne
artikel_liste.append({
    'Artikel': 'TAE-Dose (Telefon)',
    'Menge': gesamt['TAE-Dose'],
    'Reflex SI EP': preise['Reflex SI']['TAE-Dose'],
    'Future Linear EP': preise['Future Linear']['TAE-Dose'],
})

artikel_liste.append({
    'Artikel': 'Antennendose (SAT/TV)',
    'Menge': gesamt['Antennendose'],
    'Reflex SI EP': preise['Reflex SI']['Antennendose'],
    'Future Linear EP': preise['Future Linear']['Antennendose'],
})

# Rahmen
for rahmen_typ in ['Rahmen 1-fach', 'Rahmen 2-fach', 'Rahmen 3-fach']:
    anzahl = gesamt[rahmen_typ]
    if anzahl > 0:
        artikel_liste.append({
            'Artikel': rahmen_typ,
            'Menge': anzahl,
            'Reflex SI EP': preise['Reflex SI'][rahmen_typ],
            'Future Linear EP': preise['Future Linear'][rahmen_typ],
        })

# Berechnung der Gesamtpreise
for row in artikel_liste:
    row['Reflex SI Ges.'] = round(row['Menge'] * row['Reflex SI EP'], 2)
    row['Future Linear Ges.'] = round(row['Menge'] * row['Future Linear EP'], 2)
    row['Differenz'] = round(row['Future Linear Ges.'] - row['Reflex SI Ges.'], 2)

# DataFrame
df = pd.DataFrame(artikel_liste)

# Formatierte Ausgabe
print("\n" + "=" * 90)
print("PREISVERGLEICH REFLEX SI vs FUTURE LINEAR (Hornbach-Preise netto)")
print("=" * 90)

header = f"{'Artikel':<25} {'Menge':>6} {'RS EP':>9} {'RS Ges.':>10} {'FL EP':>9} {'FL Ges.':>10} {'Diff.':>9}"
print(f"\n{header}")
print("-" * 90)

summe_rs = 0
summe_fl = 0
for _, row in df.iterrows():
    artikel = row['Artikel']
    menge = row['Menge']
    rs_ep = row['Reflex SI EP']
    rs_ges = row['Reflex SI Ges.']
    fl_ep = row['Future Linear EP']
    fl_ges = row['Future Linear Ges.']
    diff = row['Differenz']

    diff_str = f"+{diff:.2f}" if diff > 0 else f"{diff:.2f}"
    print(f"{artikel:<25} {menge:>6} {rs_ep:>9.2f} {rs_ges:>10.2f} {fl_ep:>9.2f} {fl_ges:>10.2f} {diff_str:>9}")

    summe_rs += rs_ges
    summe_fl += fl_ges

print("-" * 90)
diff_summe = summe_fl - summe_rs
diff_str = f"+{diff_summe:.2f}" if diff_summe > 0 else f"{diff_summe:.2f}"
print(f"{'SUMME NETTO':<25} {'':>6} {'':>9} {summe_rs:>10.2f} {'':>9} {summe_fl:>10.2f} {diff_str:>9}")

prozent = ((summe_fl / summe_rs) - 1) * 100
print(f"\nAufpreis Future Linear vs Reflex SI: {diff_summe:.2f} EUR ({prozent:+.1f}%)")

# Excel speichern
output = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - 11 Nachunternehmer - 11 Nachunternehmer\Elektrik - Wladimir Kusnezow\2026-01 covivio Rechnungen vergleich\Covivio_3Zi_Artikelliste_Vergleich.xlsx"

df_export = df[['Artikel', 'Menge', 'Reflex SI EP', 'Reflex SI Ges.', 'Future Linear EP', 'Future Linear Ges.', 'Differenz']]

with pd.ExcelWriter(output, engine='openpyxl') as writer:
    df_export.to_excel(writer, sheet_name='Artikelliste', index=False)

    # Summenzeile
    summen = pd.DataFrame([{
        'Artikel': 'SUMME NETTO',
        'Menge': '',
        'Reflex SI EP': '',
        'Reflex SI Ges.': summe_rs,
        'Future Linear EP': '',
        'Future Linear Ges.': summe_fl,
        'Differenz': diff_summe,
    }])

    # Append to same sheet starting after data
    summen.to_excel(writer, sheet_name='Artikelliste', index=False, header=False, startrow=len(df)+2)

print(f"\nExcel gespeichert: {output}")
