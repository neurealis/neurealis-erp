const fs = require('fs');
const path = require('path');

// Supabase-Daten laden (Format: [{type: 'text', text: 'Below is... <untrusted-data...>[JSON]</untrusted...'}])
console.log('Lade Supabase-Daten...');
const rawData = fs.readFileSync(path.join(process.cwd(), 'docs', 'supabase_gws_raw.json'), 'utf8');
const wrapper = JSON.parse(rawData);
let text = wrapper[0].text;
// Text ist doppelt escaped - zuerst unescapen
text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
// Extrahiere JSON-Array zwischen [ und ]
const startIdx = text.indexOf('[{');
const endIdx = text.lastIndexOf('}]') + 2;
if (startIdx === -1 || endIdx < 2) {
  console.error('Konnte Supabase-Daten nicht parsen!');
  console.log('Text-Anfang:', text.substring(0, 500));
  process.exit(1);
}
const jsonStr = text.substring(startIdx, endIdx);
const supabaseData = JSON.parse(jsonStr);

const supabasePositions = new Map();
for (const item of supabaseData) {
  supabasePositions.set(item.artikelnummer, {
    artikelnummer: item.artikelnummer,
    bezeichnung: item.bezeichnung,
    preis: item.preis,
    listenpreis: item.listenpreis
  });
}
console.log('Supabase GWS-Positionen:', supabasePositions.size);

// Hero-Daten laden
console.log('Lade Hero-Daten...');
const heroData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'hero_gws_aktiv.json'), 'utf8'));
const heroPositions = new Map();
for (const item of heroData) {
  heroPositions.set(item.nr, item);
}
console.log('Hero GWS-Positionen:', heroPositions.size);

// Vergleich
const abweichungen = [];
const nurInHero = [];
const nurInSupabase = [];

// Hero -> Supabase
for (const [nr, hero] of heroPositions) {
  const supa = supabasePositions.get(nr);

  if (!supa) {
    nurInHero.push({
      artikelnummer: nr,
      bezeichnung: hero.name,
      hero_ek: hero.base_price,
      hero_vk: hero.list_price
    });
    continue;
  }

  const deltaEK = Math.abs((hero.base_price || 0) - (supa.preis || 0));
  const deltaVK = Math.abs((hero.list_price || 0) - (supa.listenpreis || 0));

  if (deltaEK > 0.01 || deltaVK > 0.01) {
    abweichungen.push({
      artikelnummer: nr,
      bezeichnung: supa.bezeichnung,
      hero_ek: hero.base_price,
      supa_ek: supa.preis,
      delta_ek: parseFloat(((hero.base_price || 0) - (supa.preis || 0)).toFixed(2)),
      hero_vk: hero.list_price,
      supa_vk: supa.listenpreis,
      delta_vk: parseFloat(((hero.list_price || 0) - (supa.listenpreis || 0)).toFixed(2))
    });
  }
}

// Supabase-Positionen die nicht in Hero sind
for (const [artikelnummer, supa] of supabasePositions) {
  if (!heroPositions.has(artikelnummer)) {
    nurInSupabase.push({
      artikelnummer: artikelnummer,
      bezeichnung: supa.bezeichnung,
      preis: supa.preis,
      listenpreis: supa.listenpreis
    });
  }
}

// Ergebnis ausgeben
console.log('\n===============================================================');
console.log('GWS PREISVERGLEICH HERO VS SUPABASE');
console.log('===============================================================\n');

console.log('STATISTIK:');
console.log('  Hero GWS-Positionen (aktiv):   ' + heroPositions.size);
console.log('  Supabase GWS-Positionen:       ' + supabasePositions.size);
console.log('  Abweichungen (> 0.01 EUR):     ' + abweichungen.length);
console.log('  Nur in Hero:                   ' + nurInHero.length);
console.log('  Nur in Supabase:               ' + nurInSupabase.length);

// Sortieren nach Delta VK (groesste Abweichung zuerst)
abweichungen.sort((a, b) => Math.abs(b.delta_vk) - Math.abs(a.delta_vk));

if (abweichungen.length > 0) {
  console.log('\n===============================================================');
  console.log('PREISABWEICHUNGEN (Top 50)');
  console.log('===============================================================\n');

  // Markdown-Tabelle
  console.log('| Artikelnummer | Bezeichnung | Hero EK | Supa EK | Delta EK | Hero VK | Supa VK | Delta VK |');
  console.log('|---------------|-------------|---------|---------|----------|---------|---------|----------|');

  for (const a of abweichungen.slice(0, 50)) {
    const bez = a.bezeichnung.length > 35 ? a.bezeichnung.substring(0, 32) + '...' : a.bezeichnung;
    const heroEK = (a.hero_ek || 0).toFixed(2);
    const supaEK = (a.supa_ek || 0).toFixed(2);
    const deltaEK = (a.delta_ek > 0 ? '+' : '') + a.delta_ek.toFixed(2);
    const heroVK = (a.hero_vk || 0).toFixed(2);
    const supaVK = (a.supa_vk || 0).toFixed(2);
    const deltaVK = (a.delta_vk > 0 ? '+' : '') + a.delta_vk.toFixed(2);
    console.log('| ' + a.artikelnummer + ' | ' + bez + ' | ' + heroEK + ' | ' + supaEK + ' | ' + deltaEK + ' | ' + heroVK + ' | ' + supaVK + ' | ' + deltaVK + ' |');
  }

  if (abweichungen.length > 50) {
    console.log('\n... und ' + (abweichungen.length - 50) + ' weitere Abweichungen');
  }
}

if (nurInHero.length > 0) {
  console.log('\n===============================================================');
  console.log('NUR IN HERO (nicht in Supabase)');
  console.log('===============================================================\n');

  for (const item of nurInHero.slice(0, 20)) {
    console.log('  ' + item.artikelnummer + ': ' + item.bezeichnung.substring(0, 50) + ' (EK: ' + item.hero_ek + ', VK: ' + item.hero_vk + ')');
  }
  if (nurInHero.length > 20) {
    console.log('  ... und ' + (nurInHero.length - 20) + ' weitere');
  }
}

if (nurInSupabase.length > 0) {
  console.log('\n===============================================================');
  console.log('NUR IN SUPABASE (nicht in Hero aktiv)');
  console.log('===============================================================\n');

  for (const item of nurInSupabase.slice(0, 30)) {
    console.log('  ' + item.artikelnummer + ': ' + (item.bezeichnung || '').substring(0, 50));
  }
  if (nurInSupabase.length > 30) {
    console.log('  ... und ' + (nurInSupabase.length - 30) + ' weitere');
  }
}

// Ergebnis speichern
const result = {
  timestamp: new Date().toISOString(),
  statistik: {
    hero_gws_positionen: heroPositions.size,
    supabase_gws_positionen: supabasePositions.size,
    abweichungen: abweichungen.length,
    nur_in_hero: nurInHero.length,
    nur_in_supabase: nurInSupabase.length
  },
  abweichungen: abweichungen,
  nur_in_hero: nurInHero,
  nur_in_supabase: nurInSupabase
};

fs.writeFileSync(path.join(process.cwd(), 'docs', 'gws_preisvergleich_ergebnis.json'), JSON.stringify(result, null, 2));
console.log('\n===============================================================');
console.log('Ergebnis gespeichert: docs/gws_preisvergleich_ergebnis.json');
console.log('===============================================================\n');
