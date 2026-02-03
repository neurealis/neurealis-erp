import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * wordpress-restore-elementor v1 - Stellt rohes Elementor-JSON wieder her
 * Nutzt X-WP-Auth Header für IONOS-Kompatibilität
 * Für Backup-Wiederherstellung ohne Konvertierung
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WORDPRESS_URL = Deno.env.get('WORDPRESS_URL') || 'https://neurealis.de';
const WORDPRESS_USER = Deno.env.get('WORDPRESS_USER') || 'wcksjjdrwwtx6cona4pc';
const WORDPRESS_APP_PASSWORD = Deno.env.get('WORDPRESS_APP_PASSWORD') || Deno.env.get('WORDPRESS_API_TOKEN') || '';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getJwtToken(): Promise<string> {
  if (cachedToken && tokenExpiry > Date.now() + 300000) {
    return cachedToken;
  }

  const wpUser = WORDPRESS_USER.toLowerCase();
  const wpPassword = WORDPRESS_APP_PASSWORD.replace(/\s+/g, '');

  console.log('Getting JWT token for user:', wpUser);

  const response = await fetch(`${WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: wpUser, password: wpPassword }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JWT Token failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 3600000;
  console.log('JWT token obtained successfully');
  return cachedToken!;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { post_id, elementor_data } = body;

    if (!post_id) {
      return new Response(
        JSON.stringify({ error: 'post_id ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!elementor_data) {
      return new Response(
        JSON.stringify({ error: 'elementor_data ist erforderlich (JSON-String)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`wordpress-restore-elementor v1 - Post ID: ${post_id}`);
    console.log(`Elementor data size: ${elementor_data.length} bytes`);

    if (!WORDPRESS_APP_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'WORDPRESS_APP_PASSWORD nicht gesetzt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = await getJwtToken();

    // Update durchfuehren - elementor_data ist bereits ein JSON-String
    const updateBody = {
      meta: {
        _elementor_data: elementor_data,
        _elementor_edit_mode: 'builder',
      },
    };

    console.log(`Sending update to WordPress...`);

    const updateResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/pages/${post_id}`, {
      method: 'POST',
      headers: {
        'X-WP-Auth': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    });

    const updateResult = await updateResponse.json();
    console.log(`WordPress response status: ${updateResponse.status}`);

    if (!updateResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Update fehlgeschlagen',
          details: updateResult,
          status: updateResponse.status,
        }),
        { status: updateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id,
        link: updateResult.link,
        modified: updateResult.modified,
        message: 'Elementor-Template erfolgreich wiederhergestellt!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
