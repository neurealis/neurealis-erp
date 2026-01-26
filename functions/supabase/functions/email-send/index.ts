import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { wrapEmail } from "../_shared/email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Microsoft Graph API Config
const TENANT_ID = Deno.env.get('MS_GRAPH_TENANT_ID') || '';
const CLIENT_ID = Deno.env.get('MS_GRAPH_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '';
const SENDER_EMAIL = Deno.env.get('SMTP_FROM') || 'kontakt@neurealis.de';

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  html?: boolean;
  cc?: string | string[];
  bcc?: string | string[];
  from_email?: string;  // Override sender (must have SendAs permission)
  raw?: boolean;        // Skip template wrapping (default: false)
}

// Get OAuth2 access token using client credentials flow
async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via Microsoft Graph API
async function sendEmail(
  accessToken: string,
  from: string,
  to: string[],
  subject: string,
  body: string,
  isHtml: boolean,
  cc?: string[],
  bcc?: string[]
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${from}/sendMail`;

  const message: Record<string, unknown> = {
    message: {
      subject: subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: body,
      },
      toRecipients: to.map(email => ({
        emailAddress: { address: email }
      })),
    },
    saveToSentItems: true,
  };

  // Add CC if provided
  if (cc && cc.length > 0) {
    (message.message as Record<string, unknown>).ccRecipients = cc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  // Add BCC if provided
  if (bcc && bcc.length > 0) {
    (message.message as Record<string, unknown>).bccRecipients = bcc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error: ${response.status} - ${error}`);
  }
}

Deno.serve(async (req: Request) => {
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
    const body: SendEmailRequest = await req.json();
    const { to, subject, body: emailBody, html, cc, bcc, from_email, raw } = body;

    // Wrap in template unless raw=true or plain text
    const isHtml = html !== false; // Default to HTML
    const finalBody = (isHtml && !raw) ? wrapEmail(subject, emailBody) : emailBody;

    // Validate required fields
    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Missing: to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!subject || !emailBody) {
      return new Response(
        JSON.stringify({ error: 'Missing: subject or body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check Graph API config
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Microsoft Graph API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const senderEmail = from_email || SENDER_EMAIL;
    const toAddresses = Array.isArray(to) ? to : [to];
    const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
    const bccAddresses = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    console.log(`Sending email from ${senderEmail} to ${toAddresses.join(', ')}`);

    // Get access token
    const accessToken = await getAccessToken();
    console.log('Access token obtained');

    // Send email
    await sendEmail(
      accessToken,
      senderEmail,
      toAddresses,
      subject,
      finalBody,
      isHtml,
      ccAddresses,
      bccAddresses
    );

    console.log('Email sent successfully via Microsoft Graph API');

    return new Response(
      JSON.stringify({
        success: true,
        from: senderEmail,
        to: toAddresses,
        subject: subject
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
