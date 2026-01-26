import pandas as pd

# Covivio 3,5-Raum-Wohnung (3-Zi) Elektro-Ausstattung
# 62,5m² - Räume: Küche, Bad, Wohnzimmer, Schlafzimmer, Kinderzimmer, Diele

ausstattung = {
    'Küche': {
        'Deckenbrennstelle Ausschaltung': 1,
        'Steckdose einzeln': 2,
        'Steckdose Ausschaltung': 1,  # 2,10m
        'Steckdose 2-fach': 2,  # bei 3m Küchenzeile
        'Steckdose Dunsthaube': 1,
        'Steckdose Kühlschrank': 2,
        'Steckdose Spülmaschine': 1,
    },
    'Bad': {
        'Deckenbrennstelle Kontrollschaltung': 1,
        'Wandbrennstelle': 1,
        'Steckdose 2-fach': 1,
        'Steckdose Waschmaschine': 1,
    },
    'Wohnzimmer': {
        'Deckenbrennstelle Serienschaltung': 1,
        'Steckdose 2-fach': 2,
        'Steckdose einzeln': 2,
    },
    'Schlafzimmer': {
        'Deckenbrennstelle Ausschaltung': 1,
        'Steckdose 2-fach': 2,
        'Steckdose einzeln': 2,
    },
    'Kinderzimmer': {
        'Deckenbrennstelle Ausschaltung': 1,
        'Steckdose 2-fach': 2,
        'Steckdose einzeln': 2,
    },
    'Diele': {
        'Deckenbrennstelle Wechselschaltung': 1,  # 2 Wechselschalter
        'Steckdose 2-fach': 1,
        'Steckdose einzeln': 1,
    },
}

print("=== COVIVIO 3-Zi-Wohnung (62,5m2) - Feininstallation ===\n")

# Schalter zählen
schalter_mengen = {
    'Ausschalter (Wippe 1-fach)': 4,  # Küche, Bad Wand, Schlafzimmer, Kinderzimmer
    'Kontrollschalter (Wippe 1-fach)': 1,  # Bad Decke
    'Serienschalter (Wippe 2-fach)': 1,  # Wohnzimmer
    'Wechselschalter (Wippe 1-fach)': 2,  # Diele (2 Stellen)
}

# Steckdosen zählen
steckdosen_gesamt = 0
for raum, items in ausstattung.items():
    for item, menge in items.items():
        if 'Steckdose' in item:
            if '2-fach' in item:
                steckdosen_gesamt += menge * 2  # 2-fach = 2 Einsätze
            else:
                steckdosen_gesamt += menge

print(f"Steckdosen gesamt: {steckdosen_gesamt}")
print("Schalter-Mengen:")
for item, menge in schalter_mengen.items():
    print(f"  {item}: {menge}")

# Hornbach Preise (aus vorheriger Recherche)
# Reflex SI
reflex_si = {
    'Wippe 1-fach': 2.85,
    'Wippe 2-fach (Serienschalter)': 4.75,
    'Schaltereinsatz Aus/Wechsel': 5.65,
    'Schaltereinsatz Serien': 9.65,
    'Schaltereinsatz Kontroll': 11.50,
    'Steckdose Einsatz': 3.25,
    'Rahmen 1-fach': 1.90,
    'Rahmen 2-fach': 3.35,
    'Rahmen 3-fach': 4.80,
    'Rahmen 4-fach': 6.25,
    'TAE-Dose': 8.95,
    'Antennendose': 12.50,
}

# Future Linear
future_linear = {
    'Wippe 1-fach': 4.30,
    'Wippe 2-fach (Serienschalter)': 7.15,
    'Schaltereinsatz Aus/Wechsel': 5.65,  # gleich
    'Schaltereinsatz Serien': 9.65,  # gleich
    'Schaltereinsatz Kontroll': 11.50,  # gleich
    'Steckdose Einsatz': 3.25,  # gleich
    'Rahmen 1-fach': 2.80,
    'Rahmen 2-fach': 5.00,
    'Rahmen 3-fach': 7.20,
    'Rahmen 4-fach': 9.40,
    'TAE-Dose': 8.95,  # gleich
    'Antennendose': 12.50,  # gleich
}

# Rahmen-Verteilung (Annahme für 3-Zi)
rahmen = {
    '1-fach': 10,  # Schalter + einzelne Steckdosen
    '2-fach': 8,   # 2-fach Steckdosen
    '3-fach': 2,   # Küche Arbeitsplatte
}

# Kalkulation erstellen
kalk_data = []

# Ausschalter (Wippe + Einsatz)
kalk_data.append({
    'Position': 'Ausschalter (Wippe + Einsatz)',
    'Menge': 4,
    'Reflex SI EP': reflex_si['Wippe 1-fach'] + reflex_si['Schaltereinsatz Aus/Wechsel'],
    'Future Linear EP': future_linear['Wippe 1-fach'] + future_linear['Schaltereinsatz Aus/Wechsel'],
})

# Kontrollschalter
kalk_data.append({
    'Position': 'Kontrollschalter (Wippe + Einsatz)',
    'Menge': 1,
    'Reflex SI EP': reflex_si['Wippe 1-fach'] + reflex_si['Schaltereinsatz Kontroll'],
    'Future Linear EP': future_linear['Wippe 1-fach'] + future_linear['Schaltereinsatz Kontroll'],
})

# Serienschalter
kalk_data.append({
    'Position': 'Serienschalter (Wippe 2-fach + Einsatz)',
    'Menge': 1,
    'Reflex SI EP': reflex_si['Wippe 2-fach (Serienschalter)'] + reflex_si['Schaltereinsatz Serien'],
    'Future Linear EP': future_linear['Wippe 2-fach (Serienschalter)'] + future_linear['Schaltereinsatz Serien'],
})

# Wechselschalter
kalk_data.append({
    'Position': 'Wechselschalter (Wippe + Einsatz)',
    'Menge': 2,
    'Reflex SI EP': reflex_si['Wippe 1-fach'] + reflex_si['Schaltereinsatz Aus/Wechsel'],
    'Future Linear EP': future_linear['Wippe 1-fach'] + future_linear['Schaltereinsatz Aus/Wechsel'],
})

# Steckdosen
kalk_data.append({
    'Position': 'Steckdose (Einsatz)',
    'Menge': steckdosen_gesamt,
    'Reflex SI EP': reflex_si['Steckdose Einsatz'],
    'Future Linear EP': future_linear['Steckdose Einsatz'],
})

# TAE + Antenne
kalk_data.append({
    'Position': 'TAE-Dose (Telefon)',
    'Menge': 1,
    'Reflex SI EP': reflex_si['TAE-Dose'],
    'Future Linear EP': future_linear['TAE-Dose'],
})

kalk_data.append({
    'Position': 'Antennendose (SAT/TV)',
    'Menge': 1,
    'Reflex SI EP': reflex_si['Antennendose'],
    'Future Linear EP': future_linear['Antennendose'],
})

# Rahmen
for groesse, menge in rahmen.items():
    key = f'Rahmen {groesse}'
    kalk_data.append({
        'Position': key,
        'Menge': menge,
        'Reflex SI EP': reflex_si[key],
        'Future Linear EP': future_linear[key],
    })

# Gesamt berechnen
for row in kalk_data:
    row['Reflex SI Gesamt'] = row['Menge'] * row['Reflex SI EP']
    row['Future Linear Gesamt'] = row['Menge'] * row['Future Linear EP']

# DataFrame erstellen
df = pd.DataFrame(kalk_data)
df = df[['Position', 'Menge', 'Reflex SI EP', 'Reflex SI Gesamt', 'Future Linear EP', 'Future Linear Gesamt']]

# Summen berechnen
summe_rs = df['Reflex SI Gesamt'].sum()
summe_fl = df['Future Linear Gesamt'].sum()
differenz = summe_fl - summe_rs
prozent = (differenz / summe_rs) * 100

# Ausgabe
print("\n" + "="*80)
print(df.to_string(index=False))
print("="*80)
print(f"\nSUMME Reflex SI:      {summe_rs:8.2f} EUR")
print(f"SUMME Future Linear:  {summe_fl:8.2f} EUR")
print(f"Differenz:            {differenz:8.2f} EUR ({prozent:+.1f}%)")

# Vergleich mit LEG
print("\n" + "="*80)
print("VERGLEICH MIT LEG PAUSCHALE (60-70m2):")
print("="*80)
leg_pauschale = 434.94  # LEG Neuinstallation 60-70m2
print(f"LEG Pauschale Neuinstallation:  {leg_pauschale:8.2f} EUR")
print(f"  davon Material (Reflex SI):   {summe_rs:8.2f} EUR")
print(f"  davon Montage:                {leg_pauschale - summe_rs:8.2f} EUR")
print()
print(f"Fairer Preis mit Future Linear: {summe_fl + (leg_pauschale - summe_rs):8.2f} EUR")
print(f"  (Material FL + Montage-Anteil)")

# Wladi Rechnung
wladi_material = 920.64
print(f"\nWladi Eldis Rechnung Material:  {wladi_material:8.2f} EUR")
print(f"Differenz zu Fair-Preis:       +{wladi_material - summe_fl:8.2f} EUR")

# Excel speichern
output_file = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\12 Covivio\00 LVs\Covivio_3Zi_Feininstallation_Kalkulation.xlsx"

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='Kalkulation', index=False)

    # Zusammenfassung
    summary = pd.DataFrame([
        {'Beschreibung': 'SUMME Reflex SI (Hornbach)', 'Betrag EUR': summe_rs},
        {'Beschreibung': 'SUMME Future Linear (Hornbach)', 'Betrag EUR': summe_fl},
        {'Beschreibung': 'Differenz FL vs RS', 'Betrag EUR': differenz},
        {'Beschreibung': 'Aufpreis FL in %', 'Betrag EUR': prozent},
        {'Beschreibung': '', 'Betrag EUR': ''},
        {'Beschreibung': 'LEG Pauschale 60-70m2', 'Betrag EUR': leg_pauschale},
        {'Beschreibung': 'LEG Material-Anteil (RS)', 'Betrag EUR': summe_rs},
        {'Beschreibung': 'LEG Montage-Anteil', 'Betrag EUR': leg_pauschale - summe_rs},
        {'Beschreibung': '', 'Betrag EUR': ''},
        {'Beschreibung': 'Fairer Preis mit Future Linear', 'Betrag EUR': summe_fl + (leg_pauschale - summe_rs)},
        {'Beschreibung': 'Wladi Eldis Rechnung', 'Betrag EUR': wladi_material},
        {'Beschreibung': 'Differenz Wladi vs Fair', 'Betrag EUR': wladi_material - summe_fl},
    ])
    summary.to_excel(writer, sheet_name='Zusammenfassung', index=False)

print(f"\n==> Excel gespeichert: {output_file}")
