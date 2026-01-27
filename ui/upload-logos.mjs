// Script zum Herunterladen und Hochladen von Großhändler-Logos
// Ausführen mit: node scripts/upload-logos.js

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import path from 'path';

const SUPABASE_URL = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Logo-URLs der Großhändler
const logos = [
  { kurzname: 'ABEX/G.U.T.', url: 'https://www.gut-gruppe.de/fileadmin/glaser/Glaser_Logo_RGB.svg' },
  { kurzname: 'BAUPARTE', url: 'https://www.baupart.com/typo3conf/ext/sitepackage/Resources/Public/Images/logo.svg' },
  { kurzname: 'Bauzentrum', url: 'https://www.hagebau.de/dam/hagebau-de/content/bilder/logo/hagebau_logo.svg' },
  { kurzname: 'BECHER', url: 'https://www.becher-baustoffe.de/fileadmin/images/becher-logo.svg' },
  { kurzname: 'ELSPERMANN', url: 'https://www.pietsch-gruppe.de/media/config/theme/logo.png' },
  { kurzname: 'FORBO', url: 'https://forbo.azureedge.net/forboimages/forbo_logo.svg' },
  { kurzname: 'HELLWEG', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Hellweg_logo_2024.svg' },
  { kurzname: 'HORNBACH', url: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Hornbach_Logo_black.svg' },
  { kurzname: 'JORDAN', url: 'https://www.joka.de/fileadmin/templates/images/logo_joka.svg' },
  { kurzname: 'KERAMUNDO', url: 'https://www.keramundo.de/_assets/6d1de5283e7a0789b0993e8aaa93b0bc/images/keramundo_rgb.svg' },
  { kurzname: 'LINNENBECKER', url: 'https://www.linnenbecker.de/media/bd/73/50/1733997713/thumbnail_Logo_LI_2021_4C_gelbweiss.png' },
  { kurzname: 'PROSOL', url: 'https://www.prosol-farben.de/fileadmin/prosol/logos/prosol_logo.svg' },
  { kurzname: 'Raab Karcher', url: 'https://www.raabkarcher.de/medias/RK.svg' },
  { kurzname: 'Würth', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/W%C3%BCrth_Logo.svg' },
  { kurzname: 'ZANDER', url: 'https://zander.online/assets/logos/za.png' },
  { kurzname: 'ZERO', url: 'https://www.zero-lack.de/skins/website/en/images/sprites/logo.png' },
];

async function downloadFile(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) {
      reject(new Error('Zu viele Redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      }
    };

    protocol.get(options, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : `${parsedUrl.protocol}//${parsedUrl.host}${response.headers.location}`;
        downloadFile(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        resolve({ buffer: Buffer.concat(chunks), contentType });
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

function getFileExtension(url, contentType) {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).toLowerCase();
  if (ext) return ext;

  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('webp')) return '.webp';
  return '.png';
}

function sanitizeFilename(name) {
  return name.toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('Starte Logo-Upload...\n');

  const results = [];

  for (const logo of logos) {
    process.stdout.write(`${logo.kurzname}: `);

    try {
      const { buffer, contentType } = await downloadFile(logo.url);
      const ext = getFileExtension(logo.url, contentType);
      const filename = `${sanitizeFilename(logo.kurzname)}${ext}`;

      // Upload zu Supabase Storage
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(filename, buffer, {
          contentType: contentType.split(';')[0],
          upsert: true
        });

      if (error) throw error;

      // Public URL generieren
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filename);

      const publicUrl = urlData.publicUrl;

      // Kontakt-Tabelle aktualisieren
      const { error: updateError } = await supabase
        .from('kontakte')
        .update({ foto_url: publicUrl })
        .eq('firma_kurz', logo.kurzname);

      if (updateError) {
        console.log(`Upload OK, DB-Update fehlgeschlagen: ${updateError.message}`);
      } else {
        console.log(`OK -> ${publicUrl}`);
      }

      results.push({ kurzname: logo.kurzname, success: true, url: publicUrl });

    } catch (err) {
      console.log(`FEHLER: ${err.message}`);
      results.push({ kurzname: logo.kurzname, success: false, error: err.message });
    }
  }

  console.log('\n--- Zusammenfassung ---');
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Erfolgreich: ${success}/${logos.length}`);
  if (failed > 0) {
    console.log(`Fehlgeschlagen: ${failed}`);
    results.filter(r => !r.success).forEach(r => console.log(`  - ${r.kurzname}: ${r.error}`));
  }
}

main().catch(console.error);
