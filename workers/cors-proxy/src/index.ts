/**
 * FlixNest CORS Proxy Worker
 * 
 * Relays requests to vidsrc.cc and other streaming APIs,
 * adding proper CORS headers to bypass browser restrictions.
 * 
 * Usage: GET /?url=https://vidsrc.cc/v2/embed/movie/278
 */

export interface Env {
  ENVIRONMENT?: string;
}

// Allowed origins for CORS (configure for production)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  // Add your production domain here
];

// Allowed target domains (security: only proxy to known video providers)
const ALLOWED_TARGET_DOMAINS = [
  'vidsrc.cc',
  'vidsrc.stream',
  'vidsrc.me',
  'vidsrc.to',
  'vidlink.pro',
  'superembed.stream',
  'embedsu.com',
  '2embed.cc',
  // Add more as needed
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreFlight(request);
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Validate request
    if (!targetUrl) {
      return new Response(JSON.stringify({
        error: 'Missing url parameter',
        usage: 'GET /?url=https://example.com/path',
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }

    // Validate target URL
    let parsedTargetUrl: URL;
    try {
      parsedTargetUrl = new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({
        error: 'Invalid target URL',
        url: targetUrl,
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }

    // Security: Check if target domain is allowed
    const targetDomain = parsedTargetUrl.hostname;
    const isAllowed = ALLOWED_TARGET_DOMAINS.some(
      domain => targetDomain === domain || targetDomain.endsWith('.' + domain)
    );

    if (!isAllowed && env.ENVIRONMENT !== 'development') {
      return new Response(JSON.stringify({
        error: 'Target domain not allowed',
        domain: targetDomain,
        allowed: ALLOWED_TARGET_DOMAINS,
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }

    try {
      console.log(`[CORSProxy] Fetching: ${targetUrl}`);

      // Build request headers
      const headers = new Headers({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': parsedTargetUrl.origin + '/',
        'Origin': parsedTargetUrl.origin,
      });

      // Forward any custom headers from query params
      const customReferer = url.searchParams.get('referer');
      if (customReferer) {
        headers.set('Referer', customReferer);
      }

      // Fetch from target
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        redirect: 'follow',
      });

      console.log(`[CORSProxy] Response status: ${response.status}`);

      // Clone response and add CORS headers
      const responseHeaders = new Headers(response.headers);
      
      // Add CORS headers
      const corsHeaders = getCorsHeaders(request);
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }

      // Remove problematic headers
      responseHeaders.delete('content-security-policy');
      responseHeaders.delete('x-frame-options');
      responseHeaders.delete('content-encoding'); // Let CF handle this

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CORSProxy] Error: ${errorMessage}`);

      return new Response(JSON.stringify({
        error: 'Proxy request failed',
        message: errorMessage,
        targetUrl,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }
  },
};

/**
 * Handle CORS preflight OPTIONS request
 */
function handleCorsPreFlight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  
  // In production, validate origin against ALLOWED_ORIGINS
  // For development, allow all origins
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Location',
  };
}
