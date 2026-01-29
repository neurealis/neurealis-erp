import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * blog-wordpress-sync v1
 *
 * Synchronisiert Blog-Artikel von Supabase nach WordPress.
 * - Holt alle blog_posts mit status='veroeffentlicht' und review_status='approved'
 * - Prüft ob Post schon in WordPress existiert (via wordpress_post_id oder slug)
 * - Erstellt neue Posts oder aktualisiert bestehende
 * - Speichert wordpress_post_id zurück in Supabase
 *
 * Benötigte Secrets:
 * - WORDPRESS_URL: https://neurealis.de
 * - WORDPRESS_USER: WordPress-Benutzername
 * - WORDPRESS_APP_PASSWORD: Application Password aus WP
 *
 * Usage:
 * POST /functions/v1/blog-wordpress-sync
 * Body: { "dry_run": true } // Optional: Nur prüfen, nichts ändern
 *       { "post_id": "uuid" } // Optional: Nur einen bestimmten Post synchen
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// WordPress Config
const WORDPRESS_URL = Deno.env.get('WORDPRESS_URL') || 'https://neurealis.de';
const WORDPRESS_USER = Deno.env.get('WORDPRESS_USER') || '';
const WORDPRESS_APP_PASSWORD = Deno.env.get('WORDPRESS_APP_PASSWORD') || '';

// Supabase Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface BlogPost {
  id: string;
  post_nr: number;
  titel: string;
  slug: string | null;
  inhalt: string | null;
  excerpt: string | null;
  status: string;
  review_status: string | null;
  meta_title: string | null;
  meta_description: string | null;
  kategorie: string | null;
  autor: string | null;
  bild_url: string | null;
  wordpress_post_id: number | null;
  wordpress_synced_at: string | null;
  wordpress_sync_status: string | null;
}

interface WordPressPost {
  id: number;
  slug: string;
  title: { rendered: string };
  status: string;
  link: string;
}

interface SyncResult {
  id: string;
  titel: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  wordpress_post_id?: number;
  wordpress_url?: string;
  error?: string;
}

interface RequestBody {
  dry_run?: boolean;
  post_id?: string;
}

/**
 * Base64-Encoding für Basic Auth
 */
function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return btoa(credentials);
}

/**
 * Prüft ob ein Post mit dem Slug bereits in WordPress existiert
 */
async function findWordPressPostBySlug(slug: string): Promise<WordPressPost | null> {
  const authHeader = `Basic ${encodeBasicAuth(WORDPRESS_USER, WORDPRESS_APP_PASSWORD)}`;

  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Failed to search for post by slug: ${response.status}`);
    return null;
  }

  const posts: WordPressPost[] = await response.json();
  return posts.length > 0 ? posts[0] : null;
}

/**
 * Holt einen WordPress-Post anhand der ID
 */
async function getWordPressPostById(postId: number): Promise<WordPressPost | null> {
  const authHeader = `Basic ${encodeBasicAuth(WORDPRESS_USER, WORDPRESS_APP_PASSWORD)}`;

  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts/${postId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    console.error(`Failed to get post by ID: ${response.status}`);
    return null;
  }

  return await response.json();
}

/**
 * Erstellt einen neuen WordPress-Post
 */
async function createWordPressPost(post: BlogPost): Promise<WordPressPost> {
  const authHeader = `Basic ${encodeBasicAuth(WORDPRESS_USER, WORDPRESS_APP_PASSWORD)}`;

  const wpPostData = {
    title: post.titel,
    content: post.inhalt || '',
    slug: post.slug || undefined,
    status: 'publish', // Direkt veröffentlichen
    excerpt: post.excerpt || post.meta_description || '',
    // Meta-Felder (falls Yoast SEO oder ähnliches Plugin installiert ist)
    meta: {
      _yoast_wpseo_metadesc: post.meta_description || '',
      _yoast_wpseo_title: post.meta_title || post.titel,
    },
  };

  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wpPostData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create WordPress post: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Aktualisiert einen bestehenden WordPress-Post
 */
async function updateWordPressPost(postId: number, post: BlogPost): Promise<WordPressPost> {
  const authHeader = `Basic ${encodeBasicAuth(WORDPRESS_USER, WORDPRESS_APP_PASSWORD)}`;

  const wpPostData = {
    title: post.titel,
    content: post.inhalt || '',
    slug: post.slug || undefined,
    status: 'publish',
    excerpt: post.excerpt || post.meta_description || '',
    meta: {
      _yoast_wpseo_metadesc: post.meta_description || '',
      _yoast_wpseo_title: post.meta_title || post.titel,
    },
  };

  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts/${postId}`;

  const response = await fetch(url, {
    method: 'POST', // WordPress REST API uses POST for updates too (or PUT)
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wpPostData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update WordPress post: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Synchronisiert einen einzelnen Blog-Post nach WordPress
 */
async function syncPost(
  supabase: ReturnType<typeof createClient>,
  post: BlogPost,
  dryRun: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    id: post.id,
    titel: post.titel,
    action: 'skipped',
  };

  try {
    let existingWpPost: WordPressPost | null = null;
    let needsUpdate = false;

    // 1. Prüfen ob bereits via wordpress_post_id verknüpft
    if (post.wordpress_post_id) {
      existingWpPost = await getWordPressPostById(post.wordpress_post_id);
      if (existingWpPost) {
        needsUpdate = true;
        console.log(`Post "${post.titel}" existiert bereits (ID: ${post.wordpress_post_id})`);
      } else {
        // WordPress-Post wurde gelöscht, neu erstellen
        console.log(`Post "${post.titel}" wurde in WordPress gelöscht, erstelle neu`);
        post.wordpress_post_id = null;
      }
    }

    // 2. Falls keine ID, nach Slug suchen
    if (!existingWpPost && post.slug) {
      existingWpPost = await findWordPressPostBySlug(post.slug);
      if (existingWpPost) {
        needsUpdate = true;
        console.log(`Post "${post.titel}" via Slug gefunden (ID: ${existingWpPost.id})`);
      }
    }

    // Dry-Run: Nur prüfen, nicht ändern
    if (dryRun) {
      result.action = needsUpdate ? 'updated' : 'created';
      result.wordpress_post_id = existingWpPost?.id;
      console.log(`[DRY-RUN] Würde ${result.action}: "${post.titel}"`);
      return result;
    }

    let wpPost: WordPressPost;

    // 3. Erstellen oder Aktualisieren
    if (needsUpdate && existingWpPost) {
      wpPost = await updateWordPressPost(existingWpPost.id, post);
      result.action = 'updated';
      console.log(`Post aktualisiert: "${post.titel}" (ID: ${wpPost.id})`);
    } else {
      wpPost = await createWordPressPost(post);
      result.action = 'created';
      console.log(`Post erstellt: "${post.titel}" (ID: ${wpPost.id})`);
    }

    result.wordpress_post_id = wpPost.id;
    result.wordpress_url = wpPost.link;

    // 4. Supabase aktualisieren
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({
        wordpress_post_id: wpPost.id,
        wordpress_synced_at: new Date().toISOString(),
        wordpress_sync_status: 'synced',
      })
      .eq('id', post.id);

    if (updateError) {
      console.error(`Fehler beim Aktualisieren von Supabase:`, updateError);
      // Post wurde trotzdem in WordPress erstellt/aktualisiert
    }

  } catch (error) {
    result.action = 'error';
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`Fehler bei Post "${post.titel}":`, result.error);

    // Fehler-Status in Supabase speichern
    if (!dryRun) {
      await supabase
        .from('blog_posts')
        .update({
          wordpress_sync_status: `error: ${result.error}`.substring(0, 255),
        })
        .eq('id', post.id);
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Request-Body parsen
    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      // Leerer Body ist OK
    }

    const dryRun = body.dry_run === true;
    const specificPostId = body.post_id;

    console.log(`blog-wordpress-sync v1 - ${dryRun ? 'DRY-RUN' : 'LIVE'}`);

    // Config prüfen
    if (!WORDPRESS_USER || !WORDPRESS_APP_PASSWORD) {
      return new Response(
        JSON.stringify({
          error: 'WordPress-Credentials nicht konfiguriert',
          hint: 'Setze WORDPRESS_URL, WORDPRESS_USER und WORDPRESS_APP_PASSWORD in Supabase Secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Blog-Posts laden
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'veroeffentlicht')
      .eq('review_status', 'approved');

    // Optional: Nur einen bestimmten Post
    if (specificPostId) {
      query = query.eq('id', specificPostId);
    }

    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Fehler beim Laden der Posts: ${fetchError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Keine Posts zum Synchronisieren gefunden',
          filters: {
            status: 'veroeffentlicht',
            review_status: 'approved',
            post_id: specificPostId || 'alle',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${posts.length} Posts zum Synchronisieren gefunden`);

    // Posts synchronisieren
    const results: SyncResult[] = [];

    for (const post of posts as BlogPost[]) {
      const result = await syncPost(supabase, post, dryRun);
      results.push(result);

      // Kleine Pause zwischen Requests um Rate-Limiting zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Zusammenfassung
    const created = results.filter(r => r.action === 'created').length;
    const updated = results.filter(r => r.action === 'updated').length;
    const errors = results.filter(r => r.action === 'error').length;
    const skipped = results.filter(r => r.action === 'skipped').length;

    console.log(`Sync abgeschlossen: ${created} erstellt, ${updated} aktualisiert, ${errors} Fehler, ${skipped} übersprungen`);

    return new Response(
      JSON.stringify({
        success: errors === 0,
        dry_run: dryRun,
        summary: {
          total: results.length,
          created,
          updated,
          errors,
          skipped,
        },
        results,
        wordpress_url: WORDPRESS_URL,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fehler:', error);
    return new Response(
      JSON.stringify({
        error: 'Sync fehlgeschlagen',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
