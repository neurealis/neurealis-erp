import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * wordpress-update-elementor v2 - Aktualisiert Elementor-Content einer WordPress-Page
 * Nutzt X-WP-Auth Header für IONOS-Kompatibilität
 * NEU: Setzt auch Slug, Status und Title
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
  return cachedToken!;
}

async function wpFetch(endpoint: string, method: string, token: string, body?: any): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${WORDPRESS_URL}/wp-json/wp/v2${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'X-WP-Auth': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

// Generiert eine zufällige Elementor-ID (8 Zeichen hex)
function generateElementorId(): string {
  return Math.random().toString(16).substr(2, 8);
}

// Konvertiert Markdown zu Elementor-JSON-Struktur
function markdownToElementor(markdown: string): any[] {
  const sections: any[] = [];
  const lines = markdown.split('\n');
  let currentSection: any = null;
  let currentContent = '';
  let currentHeading = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H2 Überschrift startet neue Section
    if (line.startsWith('## ')) {
      // Vorherige Section speichern
      if (currentHeading || currentContent.trim()) {
        sections.push(createSection(currentHeading, currentContent.trim()));
      }
      currentHeading = line.replace('## ', '');
      currentContent = '';
    }
    // H3 Überschrift als Zwischenüberschrift
    else if (line.startsWith('### ')) {
      currentContent += `<h3>${line.replace('### ', '')}</h3>\n`;
    }
    // Normaler Text
    else if (line.trim()) {
      currentContent += `<p>${line}</p>\n`;
    }
    // Leere Zeile
    else {
      // Ignorieren
    }
  }

  // Letzte Section speichern
  if (currentHeading || currentContent.trim()) {
    sections.push(createSection(currentHeading, currentContent.trim()));
  }

  return sections;
}

function createSection(heading: string, content: string): any {
  const sectionId = generateElementorId();
  const columnId = generateElementorId();
  const elements: any[] = [];

  // Heading Widget
  if (heading) {
    elements.push({
      id: generateElementorId(),
      elType: 'widget',
      settings: {
        title: heading,
        header_size: 'h2',
        title_color: '#333333',
      },
      elements: [],
      widgetType: 'heading',
    });
  }

  // Text Editor Widget
  if (content) {
    elements.push({
      id: generateElementorId(),
      elType: 'widget',
      settings: {
        editor: content,
      },
      elements: [],
      widgetType: 'text-editor',
    });
  }

  return {
    id: sectionId,
    elType: 'section',
    settings: {
      layout: 'boxed',
      gap: 'default',
      structure: '10',
    },
    elements: [
      {
        id: columnId,
        elType: 'column',
        settings: {
          _column_size: 100,
          _inline_size: null,
        },
        elements: elements,
      },
    ],
  };
}

// Extrahiert den Titel aus Markdown (erste H1 Überschrift)
function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match ? match[1] : 'Eigenheim sanieren';
}

// Generiert einen Slug aus dem Titel
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      post_id,
      content_markdown,
      mode = 'preview',
      slug = null,
      status = 'publish',
      title = null
    } = body;

    if (!post_id) {
      return new Response(
        JSON.stringify({ error: 'post_id ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content_markdown) {
      return new Response(
        JSON.stringify({ error: 'content_markdown ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`wordpress-update-elementor v2 - Mode: ${mode}, Post ID: ${post_id}`);

    if (!WORDPRESS_APP_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'WORDPRESS_APP_PASSWORD nicht gesetzt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = await getJwtToken();

    // Konvertiere Markdown zu Elementor-Struktur
    const elementorData = markdownToElementor(content_markdown);
    const elementorJson = JSON.stringify(elementorData);

    // Extrahiere Titel und Slug aus Markdown
    const extractedTitle = title || extractTitle(content_markdown);
    const extractedSlug = slug || generateSlug(extractedTitle);

    if (mode === 'preview') {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'preview',
          post_id,
          title: extractedTitle,
          slug: extractedSlug,
          elementor_data: elementorData,
          sections_count: elementorData.length,
          message: 'Vorschau generiert. Nutze mode=update zum Speichern.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update durchführen
    const updateBody: any = {
      title: extractedTitle,
      slug: extractedSlug,
      status: status,
      meta: {
        _elementor_data: elementorJson,
        _elementor_edit_mode: 'builder',
      },
    };

    console.log(`Updating page with title: ${extractedTitle}, slug: ${extractedSlug}, status: ${status}`);

    const updateResponse = await wpFetch(`/pages/${post_id}`, 'POST', token, updateBody);
    const updateResult = await updateResponse.json();

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
        mode: 'update',
        post_id,
        title: extractedTitle,
        slug: extractedSlug,
        link: updateResult.link,
        sections_count: elementorData.length,
        message: 'Elementor-Daten erfolgreich aktualisiert!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
