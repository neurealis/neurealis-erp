const fs = require('fs');
const https = require('https');

// WordPress credentials from Edge Function env
const WORDPRESS_URL = 'https://neurealis.de';
const WORDPRESS_USER = 'wcksjjdrwwtx6cona4pc';
const WORDPRESS_APP_PASSWORD = 'HejP z1LV jygM WSPD E3z7 YEqr';

function fetchUrl(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 120000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.setTimeout(options.timeout || 120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  try {
    // 1. Get JWT Token
    console.log('Getting JWT Token...');
    const wpPassword = WORDPRESS_APP_PASSWORD.replace(/\s+/g, '');
    const tokenResponse = await fetchUrl(WORDPRESS_URL + '/wp-json/jwt-auth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: WORDPRESS_USER.toLowerCase(), password: wpPassword })
    });

    console.log('Token response status:', tokenResponse.status);

    if (tokenResponse.status !== 200) {
      console.log('Token error:', tokenResponse.data);
      return;
    }

    const tokenData = JSON.parse(tokenResponse.data);
    const token = tokenData.token;
    console.log('JWT Token obtained successfully!');

    // 2. Read backup
    console.log('Loading backup...');
    const backupPath = 'C:/Users/holge/neurealis-erp/docs/backups/2026-02-02_elementor_backup_12089.json';
    const elementorData = fs.readFileSync(backupPath, 'utf-8');
    console.log('Backup size:', elementorData.length, 'bytes');

    // 3. Update WordPress page with _elementor_data
    console.log('Updating WordPress page 12089...');
    const updatePayload = JSON.stringify({
      meta: {
        _elementor_data: elementorData,
        _elementor_edit_mode: 'builder'
      }
    });

    console.log('Payload size:', updatePayload.length, 'bytes');

    const updateResponse = await fetchUrl(WORDPRESS_URL + '/wp-json/wp/v2/pages/12089', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-WP-Auth': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: updatePayload,
      timeout: 120000
    });

    console.log('Update response status:', updateResponse.status);

    if (updateResponse.status === 200 || updateResponse.status === 201) {
      const result = JSON.parse(updateResponse.data);
      console.log('');
      console.log('=== SUCCESS ===');
      console.log('Page ID:', result.id);
      console.log('Title:', result.title?.rendered);
      console.log('Link:', result.link);
      console.log('Modified:', result.modified);
      console.log('');
      console.log('Elementor template restored successfully!');
    } else {
      console.log('ERROR:', updateResponse.data.substring(0, 1000));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
