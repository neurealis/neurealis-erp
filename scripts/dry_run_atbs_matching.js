/**
 * Dry Run Script: Softr AR-A/AR-S ATBS/BV Befüllung
 *
 * Dieses Script analysiert welche Softr-Dokumente aus Hero gematcht werden können.
 * ES ÄNDERT NICHTS - nur Analyse und Report.
 */

// Fehlende Dokumente aus Softr (extrahiert aus toolu_011KSxM4AEok3UtaaJAGHuV7.txt)
// Eindeutige RE-Nummern aus der Datei
const softrMissingDocs = [
  'RE-001595', 'RE-001596', 'RE-001597', 'RE-001598',
  'RE-0015100', 'RE-0015101', 'RE-0015102', 'RE-0015103', 'RE-0015104', 'RE-0015105',
  'RE-0015107', 'RE-0015108', 'RE-0015109', 'RE-0015114', 'RE-0015115', 'RE-0015116',
  'RE-0015117', 'RE-0015118', 'RE-0015119', 'RE-0015120', 'RE-0015121', 'RE-0015123',
  'RE-0015125', 'RE-0015127', 'RE-0015129', 'RE-0015131', 'RE-0015133', 'RE-0015134',
  'RE-0015135', 'RE-0015136', 'RE-0015139', 'RE-0015142', 'RE-0015143', 'RE-0015144',
  'RE-0015145', 'RE-0015146', 'RE-0015147', 'RE-0015149', 'RE-0015150', 'RE-0015151',
  'RE-0015152', 'RE-0015153', 'RE-0015155', 'RE-0015156', 'RE-0015157', 'RE-0015158',
  'RE-0015159', 'RE-0015160', 'RE-0015163', 'RE-0015164', 'RE-0015165', 'RE-0015166',
  'RE-0015167', 'RE-0015168', 'RE-0015169', 'RE-0015170', 'RE-0015171', 'RE-0015172',
  'RE-0015175', 'RE-0015176', 'RE-0015177', 'RE-0015179', 'RE-0015180', 'RE-0015181',
  'RE-0015182', 'RE-0015183', 'RE-0015184', 'RE-0015187', 'RE-0015188', 'RE-0015189',
  'RE-0015191', 'RE-0015192', 'RE-0015193', 'RE-0015194', 'RE-0015195', 'RE-0015196',
  'RE-0015197', 'RE-0015198', 'RE-0015199', 'RE-0015201', 'RE-0015202', 'RE-0015203',
  'RE-0015204', 'RE-0015205', 'RE-0015206', 'RE-0015207', 'RE-0015208', 'RE-0015209',
  'RE-0015210', 'RE-0015211', 'RE-0015212', 'RE-0015213', 'RE-0015214', 'RE-0015215',
  'RE-0015217', 'RE-0015220', 'RE-0015222', 'RE-0015223', 'RE-0015224', 'RE-0015225',
  'RE-0015226', 'RE-0015227', 'RE-0015228', 'RE-0015229', 'RE-0015230', 'RE-0015231',
  'RE-0015233', 'RE-0015235', 'RE-0015236', 'RE-0015237', 'RE-0015238', 'RE-0015240',
  'RE-0015241', 'RE-0015242', 'RE-0015245', 'RE-0015246', 'RE-0015247', 'RE-0015250',
  'RE-0015252'
];

// Hero Dokumente mit project_match_id (aus API-Abfrage extrahiert)
// Format: dokument_nr -> project_match_id
const heroDocuments = {
  'RE-001595': 5431872,
  'RE-001596': 5425892,
  'RE-001597': 5405977,
  'RE-001598': 5342139,
  'RE-0015100': 5342139,
  'RE-0015101': 5103497,
  'RE-0015102': 0, // Kein Projekt
  'RE-0015103': 5510419,
  'RE-0015104': 5712222,
  'RE-0015105': 5712222,
  'RE-0015107': 5904050,
  'RE-0015108': 5904050,
  'RE-0015109': 5904050,
  'RE-0015114': 5904050,
  'RE-0015115': 5904050,
  'RE-0015116': 5904050,
  'RE-0015117': 5904050,
  'RE-0015118': 5904050,
  'RE-0015119': 5904050,
  'RE-0015120': 5904050,
  'RE-0015121': 5904050,
  'RE-0015123': 5904050,
  'RE-0015125': 5904050,
  'RE-0015127': 5904050,
  'RE-0015129': 5904050,
  'RE-0015131': 5904050,
  'RE-0015133': 5904050,
  'RE-0015134': 5906183,
  'RE-0015135': 5906183,
  'RE-0015136': 5906183,
  'RE-0015139': 5906183,
  'RE-0015142': 5906183,
  'RE-0015143': 5906183,
  'RE-0015144': 5906183,
  'RE-0015145': 5906183,
  'RE-0015146': 5906183,
  'RE-0015147': 5906183,
  'RE-0015149': 6193529,
  'RE-0015150': 6048020,
  'RE-0015151': 5953953,
  'RE-0015152': 3888777,
  'RE-0015153': 6347752,
  'RE-0015155': 6322826,
  'RE-0015156': 6453839,
  'RE-0015157': 6453877,
  'RE-0015158': 5923507,
  'RE-0015159': 6061169,
  'RE-0015160': 6125340,
  'RE-0015163': 6322826,
  'RE-0015164': 6415751,
  'RE-0015165': 6545570,
  'RE-0015166': 6433679,
  'RE-0015167': 6181068,
  'RE-0015168': 6181080,
  'RE-0015169': 6061169,
  'RE-0015170': 6443525,
  'RE-0015171': 6125340,
  'RE-0015172': 5923507,
  'RE-0015175': 6322826,
  'RE-0015176': 6533742,
  'RE-0015177': 6629796,
  'RE-0015179': 6534149,
  'RE-0015180': 6534122,
  'RE-0015181': 6534107,
  'RE-0015182': 6928208,
  'RE-0015183': 6239742,
  'RE-0015184': 6239742,
  'RE-0015187': 6239742,
  'RE-0015188': 6308864,
  'RE-0015189': 6740416,
  'RE-0015191': 6861968,
  'RE-0015192': 6839571,
  'RE-0015193': 6838995,
  'RE-0015194': 6915439,
  'RE-0015195': 6608341,
  'RE-0015196': 6915488,
  'RE-0015197': 7037831,
  'RE-0015198': 6767272,
  'RE-0015199': 7060670,
  'RE-0015201': 6915466,
  'RE-0015202': 7060688,
  'RE-0015203': 7060688,
  'RE-0015204': 7154444,
  'RE-0015205': 7296669,
  'RE-0015206': 7060711,
  'RE-0015207': 7406095,
  'RE-0015208': 6938457,
  'RE-0015209': 6869964,
  'RE-0015210': 7075454,
  'RE-0015211': 7060725,
  'RE-0015212': 7295848,
  'RE-0015213': 7410640,
  'RE-0015214': 7431812,
  'RE-0015215': 6956345,
  'RE-0015217': 6938457,
  'RE-0015220': 7406095,
  'RE-0015222': 7431812,
  'RE-0015223': 7410631,
  'RE-0015224': 7521898,
  'RE-0015225': 7321098,
  'RE-0015226': 0, // Kein Projekt
  'RE-0015227': 6869964,
  'RE-0015228': 7548204,
  'RE-0015229': 7393442,
  'RE-0015230': 7548199,
  'RE-0015231': 7661686,
  'RE-0015233': 7462069,
  'RE-0015235': 7651720,
  'RE-0015236': 7968402,
  'RE-0015237': 8131611,
  'RE-0015238': 7834697,
  'RE-0015240': 7462069,
  'RE-0015241': 7920278,
  'RE-0015242': 7961699,
  'RE-0015245': 7462069,
  'RE-0015246': 7809441,
  'RE-0015247': 8283447,
  'RE-0015250': 7393442,
  'RE-0015252': 7809441
};

// Monday/Supabase Mapping: hero_projekt_id -> { atbs_nummer, name }
const mondayMapping = {
  '5529375': { atbs: 'ATBS-258', name: 'privat - Denise Kamp - Mahlenburger Weg 13 Dortmund - EG' },
  '5950267': { atbs: 'ATBS-291', name: 'privat - Mozartstr. 23, Hamm-Pelkum - TEST' },
  '5953953': { atbs: 'ATBS-296', name: 'gws - Friedrich-Ebert-Str.3,44263 Dortmund - 1.OG rechts-vorne' },
  '6042607': { atbs: 'ATBS-299', name: 'neurealis adastra GmbH - Robertstraße 30, Hamm - DG rechts' },
  '6048020': { atbs: 'ATBS-300', name: 'gws - Hörder Rathausstr. 32 44263 Dortmund - 1OG rechts vorne' },
  '6061169': { atbs: 'ATBS-302', name: 'gws - Friedrich-Ebert-Str.1, 44263 Dortmund - 1.OG rechts' },
  '6117707': { atbs: 'ATBS-304', name: 'vonovia - Gustavstr. 10 Essen - 1.OG rechts' },
  '6125340': { atbs: 'ATBS-305', name: 'gws - Im Heidegrund 3, 44267 Dortmund - 2.OG rechts' },
  '6166378': { atbs: 'ATBS-307', name: 'Privat - Glückaufstraße 10 Kamen - DG' },
  '6181068': { atbs: 'ATBS-308', name: 'VBW - Matthias Claudius Str. 3 Bochum - 3.OG rechts' },
  '6181080': { atbs: 'ATBS-309', name: 'VBW - Matthias Claudius Str. 25 Bochum - 2.OG links' },
  '6193529': { atbs: 'ATBS-310', name: 'VBW - Stockumer Str. 101 - EG rechts' },
  '6239742': { atbs: 'ATBS-311', name: 'Privat | Micus | Feuerbachstr.15, Bochum | 1.OG' },
  '6295663': { atbs: 'ATBS-317', name: 'vonovia | Brüggerhof | Drostenhof 13, Essen | 3.OG rechts' },
  '6308864': { atbs: 'ATBS-321', name: 'WBG | Jücker | Veilchenweg 6, Lünen | EG' },
  '6322323': { atbs: 'ATBS-322', name: 'Allbau | Marshall | Ausschreibung VoMod 2025' },
  '6322826': { atbs: 'ATBS-324', name: 'Privat | Plangger | Fürstenbergerstr. 47, Düsseldorf | 1.OG' },
  '6347752': { atbs: 'ATBS-325', name: 'WVB Centuria | Meibert | Tiergartenstraße 267, Wuppertal | 1.OG rechts' },
  '6348518': { atbs: 'ATBS-326', name: 'Privat | Hünnemeier | Heiligenstrasse 33, Hilden | EFH' },
  '6415749': { atbs: 'ATBS-328', name: 'vonovia | Brüggerhof | Weserstraße 67, Essen | 2OG links' },
  '6415751': { atbs: 'ATBS-330', name: 'WVB Centuria | Meibert | Kämpchenstr. 1, Mülheim an der Ruhr | 4.OG links' },
  '6433679': { atbs: 'ATBS-332', name: 'Privat | Isbrandt | Mühlhausener Hellweg 15, Unna | Schlafzimmer EFH' },
  '6443525': { atbs: 'ATBS-334', name: 'VBW | Mollecker | Rebhuhnweg 5, Bochum | 2.OG rechts' },
  '6453839': { atbs: 'ATBS-335', name: 'gws | Kreutzmann-Regener | Entenpoth 25, Dortmund | 2.OG links' },
  '6453877': { atbs: 'ATBS-336', name: 'gws | Fromme | Brache 26, Dortmund | 1.OG' },
  '6480979': { atbs: 'ATBS-338', name: 'privat | Neumann | Michaelstraße 18, Essen | DG' },
  '6483334': { atbs: 'ATBS-339', name: 'vonovia | Brüggerhof | Weiglestraße 57, Essen | 1.OG links' },
  '6533742': { atbs: 'ATBS-340', name: 'VBW | Bauleiter | Große Weischede Str. 4, Bochum | EG links' },
  '6534107': { atbs: 'ATBS-341', name: 'VBW | Bauleiter | Laerfeldstr. 51, Bochum | 1.OG rechts' },
  '6534122': { atbs: 'ATBS-342', name: 'VBW | Bauleiter | Werner Hellweg 114, Bochum | 2.OG rechts' },
  '6534149': { atbs: 'ATBS-343', name: 'VBW | Bauleiter | Werner Hellweg 134, Bochum | 1.OG link' },
  '6539403': { atbs: 'ATBS-344', name: 'Vilico Immo | Schäfers | Berggarte 8 , Bochum | 3.OG links' },
  '6545570': { atbs: 'ATBS-345', name: 'WVB Centuria | Meibert | Stettiner Str. 25, Krefeld | 4.OG rechts' },
  '6587679': { atbs: 'ATBS-346', name: 'covivio | Pflüger | Am Ringofen 2 , Essen | 1.OG' },
  '6588399': { atbs: 'ATBS-347', name: 'covivio | Pflüger | Bischof-Franz-Wolf Str.34, Essen | EG' },
  '6608341': { atbs: 'ATBS-351', name: 'neurealis | Neumann | Kleyer Weg 40, Dortmund | 1.OG' },
  '6629796': { atbs: 'ATBS-353', name: 'VBW | Bauleiter | Haydnstr. 29, Bochum | 2.OG' },
  '6652684': { atbs: 'ATBS-354', name: 'HuG Bochum | Dumler | Oskar-Hoffmann-Str.26 , Bochum | 2.OG' },
  '6701650': { atbs: 'ATBS-357', name: 'neurealis | Neumann | Robertstraße 30, Hamm | 2.OG rechts' },
  '6740416': { atbs: 'ATBS-358', name: 'gws | Kreutzmann-Regener | Entenpoth 39, Dortmund | 1.OG mitte' },
  '6767272': { atbs: 'ATBS-359', name: 'gws | Kreutzmann-Regener | Langer Rüggen 1, Dortmund | EG rechts' },
  '6838995': { atbs: 'ATBS-361', name: 'VBW | Bauleiter | Haydnstr. 29, Bochum | 2.OG rechts hinten' },
  '6839571': { atbs: 'ATBS-362', name: 'VBW | Bauleiter | Gorch-Fock-Str. 31, Bochum | 4.OG links hinten' },
  '6861968': { atbs: 'ATBS-363', name: 'VBW | Bauleiter | Staudengarten 12, Bochum | 1.OG, M2' },
  '6869964': { atbs: 'ATBS-364', name: 'gws | Fromme | Aldinghofer Straße 6 , Dortmund | EG rechts' },
  '6915439': { atbs: 'ATBS-365', name: 'VBW | Bauleiter | Luchsweg 31, Bochum | 1.OG Mitte' },
  '6915466': { atbs: 'ATBS-366', name: 'VBW | Bauleiter | Soldnerstr. 7, Bochum | EG links' },
  '6915488': { atbs: 'ATBS-367', name: 'VBW | Bauleiter | Grüner Weg 93, Bochum | EG links' },
  '6928208': { atbs: 'ATBS-368', name: 'VBW | Bauleiter | Werner Hellweg 560, Bochum | EG rechts' },
  '6938457': { atbs: 'ATBS-369', name: 'gws | Kreutzmann-Regener | Im Heidegrund 3, Dortmund | EG mitte' },
  '6944614': { atbs: 'ATBS-370', name: 'privat | Reich | Wideystraße 29, Witten | 4 OG rechts' },
  '6945047': { atbs: 'ATBS-371', name: 'Privat | Balmaceda Schickentanz | Niesenstrasse 2, Unna  | 3.OG rechts' },
  '6956345': { atbs: 'ATBS-372', name: 'Sylvia Gebhardt | Lessingstr. 11, Bochum | 1. OG' },
  '6982254': { atbs: 'ATBS-373', name: 'privat | Neumann | Graudenzer Str. 19, Dortmund | 1.OG rechts' },
  '7037831': { atbs: 'ATBS-374', name: 'gws | Fromme | Seekante 13 , Dortmund | 1.OG links' },
  '7060670': { atbs: 'ATBS-375', name: 'VBW | Bauleiter | Luchsweg 44, Bochum | 2.OG rechts' },
  '7060688': { atbs: 'ATBS-376', name: 'VBW | Bauleiter | Rebhuhnweg 1, Bochum | 2.OG links' },
  '7060711': { atbs: 'ATBS-377', name: 'VBW | Bauleiter | Gorch-Fock-Str. 33, Bochum | EG' },
  '7060725': { atbs: 'ATBS-378', name: 'VBW | Bauleiter | Rebhuhnweg 11, Bochum | 1.OG link' },
  '7075454': { atbs: 'ATBS-380', name: 'gws | Kreutzmann-Regener | Cimbernstr .35, Dortmund | 1.OG rechts' },
  '7078635': { atbs: 'ATBS-381', name: 'vonovia | Brüggerhof | Schulstr. 69, Iserlohn | EG rechts ME002' },
  '7078647': { atbs: 'ATBS-382', name: 'vonovia | Brüggerhof | Im Wiesengrund 40, Iserlohn | 1.OG links ME003' },
  '7078651': { atbs: 'ATBS-383', name: 'vonovia | Brüggerhof | Theodor-Fleitmann-Str. 4, Iserlohn | 2.OG mitte ME008' },
  '7113298': { atbs: 'ATBS-384', name: 'covivio | Bischof-Franz-Wolf Str.13, Essen | 2OG v.l | Pflüger' },
  '7113304': { atbs: 'ATBS-385', name: 'covivio | Wolbeckstr.9, Essen | 2OG 1.v.l | Pflüger' },
  '7113309': { atbs: 'ATBS-386', name: 'covivio | Herbertshof 7, Essen | 2OG 2 v.l | Pflüger' },
  '7117636': { atbs: 'ATBS-387', name: 'covivio | Kreitenstraße 14, Düsseldorf | 1.OG rechts | Pflüger' },
  '7131439': { atbs: 'ATBS-388', name: 'covivio | Flurstraße 13, Essen | 2. Einheit v.l. | Pflüger' },
  '7131479': { atbs: 'ATBS-389', name: 'covivio | Stollbergstrasse 91, Essen | 2OG 1.v.l | Pflüger' },
  '7133995': { atbs: 'ATBS-390', name: 'covivio | Leimgardtsfeld 21, Essen | EG 1.Einheit v.l. | Pflüger' },
  '7139063': { atbs: 'ATBS-391', name: 'covivio | Kettwiger Str. 9, Düsseldorf | 1.OG, 2.v.l. | Pflüger' },
  '7139080': { atbs: 'ATBS-392', name: 'covivio | Kettwiger Str. 15, Düsseldorf | 1.OG, 2.v.l. | Pflüger' },
  '7154444': { atbs: 'ATBS-393', name: 'GWS | Friedrich-Ebert-Straße 3, Dortmund | 1.OG links | Keßler' },
  '7277392': { atbs: 'ATBS-396', name: 'vonovia | Am Steinhügel 67, Iserlohn | EG 2.vl | Brüggerhof' },
  '7287377': { atbs: 'ATBS-397', name: 'Quadrat | Schwanenwall 12, Dortmund | 4.OG' },
  '7295848': { atbs: 'ATBS-398', name: 'Eeke Leifert | Benninghofer Str. 144, Dortmund | 1.OG links' },
  '7296669': { atbs: 'ATBS-399', name: 'VBW | Am Wiesental 20, Bochum | EG mitte | Bauleiter' },
  '7321098': { atbs: 'ATBS-400', name: 'gws | Hörder Semerteichstr.168 , Dortmund | EG rechts mitte | Fromme' },
  '7343254': { atbs: 'ATBS-401', name: 'covivio | Höherweg 53, Düsseldorf | 1.OG links | Pflüger' },
  '7366080': { atbs: 'ATBS-402', name: 'Quadrat | Rheinische Str. 94, Dortmund | DG | Elbracht' },
  '7366216': { atbs: 'ATBS-403', name: 'Quadrat | Rheinische Str. 94, Dortmund | DG | Elbracht' },
  '7378200': { atbs: 'ATBS-404', name: 'Stadtimmobilien Ruhrgebiet | Münzstraße 30, Duisburg | Muster | Engelhardt' },
  '7393442': { atbs: 'ATBS-405', name: 'VBW | Lerchenweg 14, Bochum | EG links | Bauleiter' },
  '7406095': { atbs: 'ATBS-406', name: 'gws | Hörder Bruch 28, Dortmund | 1.OG rechts | Fromme' },
  '7410631': { atbs: 'ATBS-407', name: 'VBW | Gorch-Fock-Str. 4, Bochum | 3. OG rechts | Bauleiter' },
  '7410640': { atbs: 'ATBS-408', name: 'VBW | Gorch-Fock-Str. 8, Bochum | EG rechts | Bauleiter' },
  '7410643': { atbs: 'ATBS-409', name: 'VBW | Gorch-Fock-Str. 8, Bochum | EG rechts | Bauleiter' },
  '7431812': { atbs: 'ATBS-411', name: 'ISRichter | Hainallee 6, Dortmund | 1. OG | Richter' },
  '7462069': { atbs: 'ATBS-412', name: 'Quadrat | Goethestr. 3, Wetter | EG rechts | Elbracht' },
  '7466099': { atbs: 'ATBS-413', name: 'Angeliki Gerontopoulou | Metzgerstr.6, Dortmund | EG,DG' },
  '7482892': { atbs: 'ATBS-414', name: 'covivio | Hiesfelderstr.25, Oberhausen | EG links | Pflüger' },
  '7521792': { atbs: 'ATBS-415', name: 'vonovia | Ernestinenstr. 304, Essen | 1.OG rechts | Brüggerhof' },
  '7521898': { atbs: 'ATBS-416', name: 'VBW | Große Weischede Str. 13, Bochum | 3.OG rechts | Bauleiter' },
  '7548199': { atbs: 'ATBS-417', name: 'VBW | Unterstr. 167, Bochum | 2.OG rechts | Bauleiter' },
  '7548204': { atbs: 'ATBS-418', name: 'VBW | Rosenbergstr. 11, Bochum | 1.OG Mitte | Bauleiter' },
  '7596824': { atbs: 'ATBS-419', name: 'gws | Hörder Bruch 22-30, Dortmund | EG | Keßler' },
  '7601786': { atbs: 'ATBS-420', name: 'privat | Bruktererweg 6, Dorsten | 3FH | Jansen' },
  '7651720': { atbs: 'ATBS-421', name: 'gws | Cimbernstr. 50, Dortmund | 2.OG | Keßler' },
  '7661686': { atbs: 'ATBS-422', name: 'VBW | Hirschgraben 9, Bochum | 1.OG rechts | Bauleiter' },
  '7681169': { atbs: 'ATBS-423', name: 'vonovia | Im Hudegrund 13, Iserlohn | 1.OG rechts | Brüggerhof' },
  '7704096': { atbs: 'ATBS-424', name: 'privat | Werner Hellweg 500, Bochum | DG links | Neumann' },
  '7784919': { atbs: 'ATBS-425', name: 'vonovia | Zur Sonnenhöhe 127, Iserlohn | 2.OG links | Brüggerhof' },
  '7796804': { atbs: 'ATBS-426', name: 'vonovia | Im Lau 1, Iserlohn | 1.OG, 1.v.l ME005 | Brüggerhof' },
  '7796872': { atbs: 'ATBS-427', name: 'vonovia | Im Lau 1, Iserlohn |  3.OG, 2.v.l ME014 | Brüggerhof' },
  '7797794': { atbs: 'ATBS-428', name: 'MatthiasStadje | Dörwer Str 54, Dortmund | 4 OG 2vl' },
  '7800834': { atbs: 'ATBS-429', name: 'vonovia | Im Hudegrund 1, Iserlohn | 3.OG links | Brüggerhof' },
  '7809441': { atbs: 'ATBS-430', name: 'gws | Langobardenstrasse 33, Dortmund | EG mitte | Kreutzmann-Regener' },
  '7819051': { atbs: 'ATBS-431', name: 'Daniel Jeromin | Halterner Str. 7, Gelsenkirchen | DHH' },
  '7834697': { atbs: 'ATBS-432', name: 'VBW | Schulenburgstr. 25, Bochum | EG rechts | Bauleiter' },
  '7865696': { atbs: 'ATBS-433', name: 'covivio | Hansaallee 348a, Düsseldorf | 1. Einh.v.links | Pflüger' },
  '7866556': { atbs: 'ATBS-434', name: 'covivio | Rudolf-Heinrich-Str.10, Essen | 3 OG | Pflüger' },
  '7866825': { atbs: 'ATBS-435', name: 'covivio | Oberer Schloßhang 1, Essen | 1 OG li | Pflüger' },
  '7866834': { atbs: 'ATBS-436', name: 'covivio | Oberer Schloßhang 1, Essen | 1.OG links | Pflüger' },
  '7890908': { atbs: 'ATBS-437', name: 'WBG | Veilchenweg 1, Lünen | 3OG links | Jücker' },
  '7920278': { atbs: 'ATBS-438', name: 'Guido Jura | Asselner Hellweg 174, Dortmund | 1. OG rechts' },
  '7961699': { atbs: 'ATBS-439', name: 'Karl-HeinzEil | Oberstraße 46, Bochum | EG' },
  '7968402': { atbs: 'ATBS-440', name: 'VBW | Havelstr. 6, Bochum | 2.OG limks | Bauleiter' },
  '8096069': { atbs: 'ATBS-441', name: 'vonovia | Zur Sonnenhöhe 97, Iserlohn | 2.OG rechts | Brüggerhof' },
  '8131611': { atbs: 'ATBS-442', name: 'VBW | In der Delle 6, Bochum | 1.OG links | Bauleiter' },
  '8178139': { atbs: 'ATBS-443', name: 'Eeke Leifert | Brandeniusstr.3, Dortmund | 1.OG rechts' },
  '8283447': { atbs: 'ATBS-444', name: 'gws | Alfred-Trappen-Str.39, Dortmund | 2OG links | Fromme' },
  '8325621': { atbs: 'ATBS-445', name: 'VBW | Kulmerstr. 11, Bochum | 1. OG | Florian Rüther' },
  '8325640': { atbs: 'ATBS-446', name: 'VBW | Kleffstr. 8, Bochum | 1. OG mitte | Bauleiter' },
  '8325662': { atbs: 'ATBS-447', name: 'VBW | Heuweg 1, Bochum | EG rechts | Bauleiter' },
  '8325681': { atbs: 'ATBS-448', name: 'VBW | Händelstr. 22, Bochum | 2. OG links | Bauleiter' },
  '8335820': { atbs: 'ATBS-449', name: 'VBW | Kulmerstr. 23, Bochum | 5. OG rechts | Bauleiter' },
  '8378620': { atbs: 'ATBS-450', name: 'MarcoBlume | Gaudigstr. 15, Dortmund | RMH' },
  '8479250': { atbs: 'ATBS-451', name: 'neurealis | Robertstraße 38, Hamm | 2.OG li | Neumann' },
  '8518905': { atbs: 'ATBS-452', name: 'ISRichter | Hainallee 6, Dortmund | EG | Richter' },
  '8544715': { atbs: 'ATBS-453', name: 'gws | Im Heidegrund 3, Dortmund | EG links | Kreutzmann-Regener' },
  '8591276': { atbs: 'ATBS-454', name: 'PeterPlangger | Simrockstraße 92, Düsseldorf | EG' },
  '8684610': { atbs: 'ATBS-455', name: 'privat | Kleyer Weg 40, Dortmund | TEST | Neumann' },
  '8684645': { atbs: 'ATBS-456', name: 'privat | Kleyer Weg 40, Dortmund | Test | Neumann' },
  '8705343': { atbs: 'ATBS-457', name: 'VBW | Wirmerstraße 28, Bochum | Asbest LV | Hoveling' },
  '8723066': { atbs: 'ATBS-458', name: 'neurealis | Robertstr 34, Hamm | 1. OG rechts | Neumann' },
  '8741657': { atbs: 'ATBS-459', name: 'Khairun Bapumia | Schreberstraße 55, Herne | 2. OG links' },
  '8895162': { atbs: 'ATBS-460', name: 'MartinSchulze | Davidisstraße 7, Dortmund | 2. OG' },
  '8896290': { atbs: 'ATBS-461', name: 'JaninSilksi | Gerhart-Hauptmann-Straße 2, Kamen | DHH' },
  '9021327': { atbs: 'ATBS-462', name: 'gws - Holzwickeder Straße 52, Dortmund - EG rechts' },
  '9042226': { atbs: 'ATBS-463', name: 'privat - Steinstr. 25, Essen - 2. OG' },
  '9042265': { atbs: 'ATBS-464', name: 'privat - Steinstr. 25, Essen - EG' },
  '9042284': { atbs: 'ATBS-465', name: 'privat - Michaelstr. 18, Essen - 1. OG' },
  '9053464': { atbs: 'ATBS-466', name: 'gws - Holzwickeder Straße 52, Dortmund - EG links' },
  '9157466': { atbs: 'ATBS-467', name: 'gws - Unterer Sendweg 2, Dortmund - EG li' },
  '9183944': { atbs: 'ATBS-468', name: 'VBW - Werner Hellweg 114, Bochum - 3. OG links' },
  '9183959': { atbs: 'ATBS-469', name: 'VBW - Werner Hellweg 94, Bochum - 5. OG' },
  '9183976': { atbs: 'ATBS-470', name: 'VBW - Werner Hellweg 94, Bochum - 3. OG' },
  // Nicht in Monday:
  '5431872': null, // Nicht gemappt
  '5425892': null,
  '5405977': null,
  '5342139': null,
  '5103497': null,
  '5510419': null,
  '5712222': null,
  '5904050': null,
  '5906183': null,
  '5923507': null,
  '3888777': null
};

// Analyse durchführen
console.log('=== DRY RUN: Softr AR-A/AR-S ATBS/BV Befüllung ===\n');

const matchable = [];
const notMatchable = [];

for (const docNr of softrMissingDocs) {
  const heroProjectId = heroDocuments[docNr];

  if (heroProjectId === undefined) {
    notMatchable.push({ docNr, reason: 'Nicht in Hero gefunden' });
    continue;
  }

  if (heroProjectId === 0) {
    notMatchable.push({ docNr, reason: 'Hero: Kein Projekt zugeordnet (project_match_id=0)' });
    continue;
  }

  const mondayData = mondayMapping[String(heroProjectId)];

  if (!mondayData) {
    notMatchable.push({ docNr, reason: `Hero-Projekt ${heroProjectId} nicht in Monday/Supabase` });
    continue;
  }

  matchable.push({
    docNr,
    heroProjectId,
    atbs: mondayData.atbs,
    bauvorhaben: mondayData.name
  });
}

// Ausgabe
console.log(`Fehlende Dokumente: ${softrMissingDocs.length}`);
console.log(`In Hero gefunden: ${softrMissingDocs.length - notMatchable.filter(x => x.reason === 'Nicht in Hero gefunden').length}`);
console.log(`Matchbar (würden aktualisiert): ${matchable.length}`);
console.log(`NICHT matchbar: ${notMatchable.length}`);

console.log('\n=== MATCHBARE DOKUMENTE ===\n');
console.log('| Dokument-Nr | Hero-Projekt | ATBS | Bauvorhaben |');
console.log('|-------------|--------------|------|-------------|');
for (const m of matchable.slice(0, 30)) {
  const bv = m.bauvorhaben.substring(0, 50);
  console.log(`| ${m.docNr} | ${m.heroProjectId} | ${m.atbs} | ${bv}... |`);
}
if (matchable.length > 30) {
  console.log(`| ... und ${matchable.length - 30} weitere |`);
}

console.log('\n=== NICHT MATCHBARE DOKUMENTE ===\n');
console.log('| Dokument-Nr | Grund |');
console.log('|-------------|-------|');
for (const nm of notMatchable) {
  console.log(`| ${nm.docNr} | ${nm.reason} |`);
}

// JSON für Report speichern
const report = {
  datum: new Date().toISOString(),
  status: 'DRY RUN - Keine Änderungen durchgeführt',
  zusammenfassung: {
    fehlende_dokumente: softrMissingDocs.length,
    in_hero_gefunden: softrMissingDocs.length - notMatchable.filter(x => x.reason === 'Nicht in Hero gefunden').length,
    matchbar: matchable.length,
    nicht_matchbar: notMatchable.length
  },
  matchbare_dokumente: matchable,
  nicht_matchbare_dokumente: notMatchable
};

console.log('\n=== JSON Report ===');
console.log(JSON.stringify(report.zusammenfassung, null, 2));
