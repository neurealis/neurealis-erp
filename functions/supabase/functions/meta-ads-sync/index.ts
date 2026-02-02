import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Meta Ads Sync Edge Function v1
 *
 * Synchronisiert Kampagnen und Metriken von Meta Ads API nach Supabase.
 *
 * Credentials (in Supabase Vault/Secrets):
 * - META_ACCESS_TOKEN: System User Token
 * - META_AD_ACCOUNT_ID: act_XXXXXXXXXX
 * - META_PIXEL_ID: Pixel ID (für spätere Conversion-Nutzung)
 *
 * Tabellen:
 * - ad_platforms: Sync-Status aktualisieren
 * - marketing_campaigns: Kampagnen upserten
 * - campaign_metrics_daily: Tägliche Metriken upserten
 *
 * Aufruf via Cron (empfohlen: alle 6 Stunden) oder manuell
 */

// Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Meta API Konfiguration
const META_API_VERSION = 'v19.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Rate Limiting Konfiguration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_DELAY_MS = 200; // Verzögerung zwischen API-Aufrufen

// Meta Platform ID (aus ad_platforms Tabelle)
const META_PLATFORM_ID = 'a55f27cc-6932-4ae6-905d-769677ca518c';

// Interfaces
interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
}

interface MetaInsight {
  date_start: string;
  date_stop: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

interface SyncResult {
  success: boolean;
  campaigns_synced: number;
  metrics_synced: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Verzögerung für Rate-Limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Meta API Aufruf mit Retry-Logik
 */
async function metaApiRequest<T>(
  endpoint: string,
  accessToken: string,
  retryCount = 0
): Promise<T> {
  const url = `${META_API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${accessToken}`;

  try {
    const response = await fetch(url);

    // Rate Limit Handling (Code 80004 oder HTTP 429)
    if (response.status === 429 || response.status === 503) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`);
      }

      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);

      console.log(`Rate limited. Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await delay(delayMs);
      return metaApiRequest<T>(endpoint, accessToken, retryCount + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta API Error ${response.status}: ${errorBody}`);
    }

    return await response.json() as T;
  } catch (error) {
    // Netzwerk-Fehler mit Retry
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      console.log(`Network error. Retrying in ${INITIAL_RETRY_DELAY_MS}ms...`);
      await delay(INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount));
      return metaApiRequest<T>(endpoint, accessToken, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Lädt alle Kampagnen vom Ad Account
 */
async function fetchCampaigns(adAccountId: string, accessToken: string): Promise<MetaCampaign[]> {
  console.log(`Fetching campaigns from ${adAccountId}...`);

  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time';
  const endpoint = `/${adAccountId}/campaigns?fields=${fields}&limit=100`;

  interface CampaignsResponse {
    data: MetaCampaign[];
    paging?: {
      next?: string;
      cursors?: {
        after?: string;
      };
    };
  }

  const allCampaigns: MetaCampaign[] = [];
  let nextEndpoint: string | null = endpoint;

  // Pagination
  while (nextEndpoint) {
    const response = await metaApiRequest<CampaignsResponse>(nextEndpoint, accessToken);
    allCampaigns.push(...response.data);

    // Check for more pages
    if (response.paging?.cursors?.after) {
      nextEndpoint = `${endpoint}&after=${response.paging.cursors.after}`;
    } else {
      nextEndpoint = null;
    }

    await delay(REQUEST_DELAY_MS);
  }

  console.log(`Fetched ${allCampaigns.length} campaigns`);
  return allCampaigns;
}

/**
 * Lädt Insights für eine Kampagne (letzte 7 Tage)
 */
async function fetchCampaignInsights(
  campaignId: string,
  accessToken: string,
  daysBack = 7
): Promise<MetaInsight[]> {
  const today = new Date();
  const sinceDate = new Date(today);
  sinceDate.setDate(today.getDate() - daysBack);

  const since = sinceDate.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];

  const fields = 'impressions,clicks,spend,reach,frequency,ctr,cpc,actions';
  const endpoint = `/${campaignId}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&time_increment=1&level=campaign`;

  interface InsightsResponse {
    data: MetaInsight[];
    paging?: {
      next?: string;
    };
  }

  try {
    const response = await metaApiRequest<InsightsResponse>(endpoint, accessToken);
    return response.data || [];
  } catch (error) {
    // Manche Kampagnen haben keine Insights (z.B. Draft-Kampagnen)
    console.log(`No insights for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

/**
 * Upsert Kampagne in Supabase
 */
async function upsertCampaign(campaign: MetaCampaign): Promise<string | null> {
  const campaignData = {
    platform_id: META_PLATFORM_ID,
    external_id: campaign.id,
    name: campaign.name,
    status: campaign.status.toLowerCase(),
    objective: campaign.objective || null,
    daily_budget_cents: campaign.daily_budget ? Math.round(parseFloat(campaign.daily_budget)) : null,
    lifetime_budget_cents: campaign.lifetime_budget ? Math.round(parseFloat(campaign.lifetime_budget)) : null,
    start_date: campaign.start_time ? campaign.start_time.split('T')[0] : null,
    end_date: campaign.stop_time ? campaign.stop_time.split('T')[0] : null,
    platform_data: {
      created_time: campaign.created_time,
      updated_time: campaign.updated_time
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .upsert(campaignData, {
      onConflict: 'platform_id,external_id',
      ignoreDuplicates: false
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error upserting campaign ${campaign.id}:`, error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Extrahiert Conversions aus Meta Actions
 */
function extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;

  // Relevante Conversion-Typen summieren
  const conversionTypes = [
    'lead',
    'complete_registration',
    'contact',
    'submit_application',
    'onsite_conversion.messaging_first_reply'
  ];

  let total = 0;
  for (const action of actions) {
    if (conversionTypes.includes(action.action_type)) {
      total += parseFloat(action.value) || 0;
    }
  }

  return total;
}

/**
 * Upsert Tages-Metriken in Supabase
 */
async function upsertDailyMetrics(
  campaignId: string,
  insight: MetaInsight
): Promise<boolean> {
  // Meta gibt date_start und date_stop - für Daily ist beides gleich
  const date = insight.date_start.split('T')[0];

  const metricsData = {
    campaign_id: campaignId,
    date: date,
    impressions: parseInt(insight.impressions || '0'),
    clicks: parseInt(insight.clicks || '0'),
    cost_cents: Math.round(parseFloat(insight.spend || '0') * 100), // EUR → Cents
    reach: parseInt(insight.reach || '0'),
    frequency: parseFloat(insight.frequency || '0'),
    ctr: parseFloat(insight.ctr || '0'),
    cpc_cents: insight.cpc ? Math.round(parseFloat(insight.cpc) * 100) : null,
    conversions: extractConversions(insight.actions),
    platform_metrics: {
      raw_actions: insight.actions
    }
  };

  const { error } = await supabase
    .from('campaign_metrics_daily')
    .upsert(metricsData, {
      onConflict: 'campaign_id,date',
      ignoreDuplicates: false
    });

  if (error) {
    console.error(`Error upserting metrics for ${date}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Aktualisiert den Sync-Status der Platform
 */
async function updatePlatformSyncStatus(
  status: 'success' | 'error',
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    sync_status: status,
    credentials_configured: true,
    updated_at: new Date().toISOString()
  };

  if (status === 'error' && errorMessage) {
    updateData.sync_error = errorMessage.substring(0, 500); // Limit error message
  } else {
    updateData.sync_error = null;
  }

  const { error } = await supabase
    .from('ad_platforms')
    .update(updateData)
    .eq('id', META_PLATFORM_ID);

  if (error) {
    console.error('Error updating platform sync status:', error.message);
  }
}

/**
 * Haupt-Sync-Funktion
 */
async function syncMetaAds(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    campaigns_synced: 0,
    metrics_synced: 0,
    errors: [],
    duration_ms: 0
  };

  // Credentials laden
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');
  const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');

  if (!accessToken) {
    result.errors.push('META_ACCESS_TOKEN nicht konfiguriert');
    await updatePlatformSyncStatus('error', result.errors.join(', '));
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  if (!adAccountId) {
    result.errors.push('META_AD_ACCOUNT_ID nicht konfiguriert');
    await updatePlatformSyncStatus('error', result.errors.join(', '));
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  try {
    // 1. Kampagnen abrufen
    const campaigns = await fetchCampaigns(adAccountId, accessToken);

    // 2. Jede Kampagne upserten und Insights laden
    for (const campaign of campaigns) {
      // Kampagne speichern
      const supabaseCampaignId = await upsertCampaign(campaign);

      if (supabaseCampaignId) {
        result.campaigns_synced++;

        // Insights für die Kampagne laden
        await delay(REQUEST_DELAY_MS);
        const insights = await fetchCampaignInsights(campaign.id, accessToken);

        // Tägliche Metriken speichern
        for (const insight of insights) {
          const saved = await upsertDailyMetrics(supabaseCampaignId, insight);
          if (saved) {
            result.metrics_synced++;
          }
        }
      }
    }

    result.success = true;
    await updatePlatformSyncStatus('success');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    result.errors.push(errorMessage);
    await updatePlatformSyncStatus('error', errorMessage);
    console.error('Meta Ads Sync Error:', errorMessage);
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// HTTP Handler
Deno.serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Meta Ads Sync v1 ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Parameter aus URL oder Body
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';

    if (dryRun) {
      // Dry-Run: Nur Credentials prüfen und Kampagnen zählen
      const accessToken = Deno.env.get('META_ACCESS_TOKEN');
      const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');

      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Credentials nicht konfiguriert',
            details: {
              access_token: !!accessToken,
              ad_account_id: !!adAccountId
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Test-Aufruf
      const campaigns = await fetchCampaigns(adAccountId, accessToken);

      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          campaigns_found: campaigns.length,
          campaigns: campaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status
          }))
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Vollständiger Sync
    const result = await syncMetaAds();

    console.log(`Sync completed: ${result.campaigns_synced} campaigns, ${result.metrics_synced} metrics, ${result.duration_ms}ms`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Unhandled error:', errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
