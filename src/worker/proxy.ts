/**
 * FlixNest Same-Origin Proxy Worker
 * 
 * This Cloudflare Worker proxies vidsrc.cc content to make it same-origin,
 * allowing our frontend to intercept API responses and extract m3u8 URLs.
 * 
 * Flow:
 * 1. Frontend loads iframe: https://your-worker.workers.dev/proxy?embed=vidsrc.cc/v2/embed/movie/278
 * 2. Worker fetches from vidsrc.cc
 * 3. Worker injects interceptor script into HTML
 * 4. Browser executes vidsrc JS, generates VRF naturally
 * 5. Our interceptor captures /api/source/{hash} response
 * 6. postMessage sends m3u8 URL to parent window
 */

export interface Env {
  // Add environment variables if needed
}

// Interceptor script injected into vidsrc HTML
const INTERCEPTOR_SCRIPT = `
<script>
(function() {
  'use strict';
  
  // Store captured streams globally for parent to access
  window.__CAPTURED_STREAMS = [];
  window.__EXTRACTION_STATUS = 'waiting';
  
  console.log('[FlixNest Interceptor] Initialized');
  
  // Intercept fetch for API calls
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
    // Log all fetch calls for debugging
    console.log('[FlixNest Interceptor] Fetch:', url.substring(0, 100));
    
    // Intercept /api/source/{hash} calls
    if (url.includes('/api/source/')) {
      console.log('[FlixNest Interceptor] Captured source API call!');
      window.__EXTRACTION_STATUS = 'capturing';
      
      return originalFetch.apply(this, args).then(response => {
        // Clone response to read without consuming
        const clonedResponse = response.clone();
        
        clonedResponse.json().then(data => {
          console.log('[FlixNest Interceptor] API response:', data);
          
          if (data.success && data.data && data.data.source) {
            const streamData = {
              m3u8Url: data.data.source,
              subtitles: data.data.subtitles || [],
              type: data.data.type,
              serverName: 'auto',
              timestamp: Date.now(),
              headers: {
                Referer: 'https://vidsrc.cc/',
                Origin: 'https://vidsrc.cc'
              }
            };
            
            console.log('[FlixNest Interceptor] Extracted stream:', streamData.m3u8Url.substring(0, 80));
            window.__CAPTURED_STREAMS.push(streamData);
            window.__EXTRACTION_STATUS = 'captured';
            
            // Notify parent window
            try {
              window.parent.postMessage({
                type: 'FLIXNEST_M3U8_CAPTURED',
                data: streamData
              }, '*');
              console.log('[FlixNest Interceptor] Posted message to parent');
            } catch (e) {
              console.error('[FlixNest Interceptor] postMessage failed:', e);
            }
          }
        }).catch(err => {
          console.error('[FlixNest Interceptor] JSON parse error:', err);
        });
        
        // Return original response for vidsrc player
        return response;
      });
    }
    
    // Also capture /api/{id}/servers for debugging
    if (url.includes('/api/') && url.includes('/servers')) {
      console.log('[FlixNest Interceptor] Servers API call detected');
      return originalFetch.apply(this, args).then(response => {
        response.clone().json().then(data => {
          console.log('[FlixNest Interceptor] Servers:', data.data?.length || 0, 'servers found');
          window.parent.postMessage({
            type: 'FLIXNEST_SERVERS_FOUND',
            data: { count: data.data?.length || 0 }
          }, '*');
        }).catch(() => {});
        return response;
      });
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Also intercept XMLHttpRequest for legacy support
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._interceptedUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    const url = this._interceptedUrl || '';
    
    if (url.includes('/api/source/')) {
      console.log('[FlixNest Interceptor] XHR source API call:', url.substring(0, 60));
      
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          if (data.success && data.data && data.data.source) {
            const streamData = {
              m3u8Url: data.data.source,
              subtitles: data.data.subtitles || [],
              type: data.data.type,
              serverName: 'auto-xhr',
              timestamp: Date.now(),
              headers: {
                Referer: 'https://vidsrc.cc/',
                Origin: 'https://vidsrc.cc'
              }
            };
            window.__CAPTURED_STREAMS.push(streamData);
            window.parent.postMessage({
              type: 'FLIXNEST_M3U8_CAPTURED',
              data: streamData
            }, '*');
          }
        } catch (e) {}
      });
    }
    
    return originalXHRSend.apply(this, args);
  };
  
  // Notify parent that interceptor is ready
  window.parent.postMessage({ type: 'FLIXNEST_INTERCEPTOR_READY' }, '*');
})();
</script>
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    
    // Health check
    if (pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Main proxy endpoint: /proxy?embed=vidsrc.cc/v2/embed/movie/278
    if (pathname === '/proxy' || pathname === '/') {
      const embedParam = url.searchParams.get('embed');
      const type = url.searchParams.get('type') || 'movie';
      const id = url.searchParams.get('id');
      const season = url.searchParams.get('season');
      const episode = url.searchParams.get('episode');
      
      let targetUrl: string;
      
      if (embedParam) {
        // Direct embed URL
        targetUrl = embedParam.startsWith('http') 
          ? embedParam 
          : `https://${embedParam}`;
      } else if (id) {
        // Build from params
        if (type === 'tv' && season && episode) {
          targetUrl = `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
        } else {
          targetUrl = `https://vidsrc.cc/v2/embed/movie/${id}`;
        }
      } else {
        return new Response('Missing embed or id parameter', { status: 400 });
      }
      
      console.log('[Worker] Proxying embed:', targetUrl);
      return proxyRequest(targetUrl, request, true);
    }
    
    // Proxy API calls: /api/...
    if (pathname.startsWith('/api/')) {
      const targetUrl = `https://vidsrc.cc${pathname}${url.search}`;
      console.log('[Worker] Proxying API:', targetUrl);
      return proxyRequest(targetUrl, request, false);
    }
    
    // Proxy static assets: /saas/..., /assets/...
    if (pathname.startsWith('/saas/') || pathname.startsWith('/assets/') || pathname.startsWith('/cdn-cgi/')) {
      const targetUrl = `https://vidsrc.cc${pathname}${url.search}`;
      return proxyRequest(targetUrl, request, false);
    }
    
    // Proxy external CDN resources
    if (pathname.includes('.js') || pathname.includes('.css')) {
      // Pass through to original CDN
      const targetUrl = `https://vidsrc.cc${pathname}${url.search}`;
      return proxyRequest(targetUrl, request, false);
    }
    
    return new Response('Not found', { status: 404 });
  },
};

async function proxyRequest(
  targetUrl: string,
  request: Request,
  injectInterceptor: boolean
): Promise<Response> {
  try {
    // Build upstream request
    const headers = new Headers();
    headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    headers.set('Accept', request.headers.get('Accept') || '*/*');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Referer', 'https://vidsrc.cc/');
    headers.set('Origin', 'https://vidsrc.cc');
    
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      redirect: 'follow',
    });
    
    // Build response headers
    const responseHeaders = new Headers();
    
    // Copy safe headers from upstream
    const safeHeaders = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'];
    for (const header of safeHeaders) {
      const value = upstreamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }
    
    // CRITICAL: Remove frame-blocking headers
    responseHeaders.delete('X-Frame-Options');
    responseHeaders.delete('Content-Security-Policy');
    
    // Add permissive headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    // Check if HTML and should inject interceptor
    const contentType = upstreamResponse.headers.get('content-type') || '';
    
    if (injectInterceptor && contentType.includes('text/html')) {
      let html = await upstreamResponse.text();
      
      // Rewrite relative URLs to go through proxy
      // This ensures /api/... calls go through our worker
      const workerOrigin = new URL(request.url).origin;
      
      // Inject our interceptor script at the start of <head>
      html = html.replace('<head>', `<head>${INTERCEPTOR_SCRIPT}`);
      
      // Rewrite absolute vidsrc URLs to relative (so they go through proxy)
      html = html.replace(/https:\/\/vidsrc\.cc\//g, '/');
      
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      
      return new Response(html, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }
    
    // For non-HTML (JSON, JS, CSS), return as-is
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('[Worker] Proxy error:', error);
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
