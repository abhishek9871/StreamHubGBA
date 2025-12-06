/**
 * VidSrc Stream Extractor (Backend)
 * 
 * Server-side extraction from multiple video providers:
 * - vidsrc.cc (requires VRF - complex)
 * - embed.su (simpler API)
 * - 2embed.cc (alternative)
 * 
 * No CORS restrictions - can fetch and parse freely
 */

import { decryptVidsrc, extractUrlFromDecrypted } from '../utils/decrypt';

// Constants - Multiple providers for fallback
const PROVIDERS = {
  VIDSRC_CC: {
    embed: 'https://vidsrc.cc/v2/embed',
    rcp: 'https://vidsrc.stream/rcp',
  },
  EMBED_SU: {
    embed: 'https://embed.su/embed',
    api: 'https://embed.su/api',
  },
  TWO_EMBED: {
    embed: 'https://2embed.cc/embed',
  },
  VIDSRC_TO: {
    embed: 'https://vidsrc.to/embed',
    api: 'https://vidsrc.to/ajax/embed',
  },
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ExtractRequest {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

interface StreamSource {
  url: string;
  quality: string;
  provider: string;
  headers?: Record<string, string>;
}

interface ExtractResult {
  success: boolean;
  streams: StreamSource[];
  error?: string;
}

interface ServerInfo {
  name: string;
  hash: string;
  dataId?: string;
}

/**
 * Build vidsrc embed URL
 */
function buildEmbedUrl(request: ExtractRequest): string {
  const { type, tmdbId, season, episode } = request;
  let url = `${PROVIDERS.VIDSRC_CC.embed}/${type}/${tmdbId}`;
  
  if (type === 'tv' && season !== undefined && episode !== undefined) {
    url += `/${season}/${episode}`;
  }
  
  return url;
}

/**
 * Fetch with proper headers
 */
async function fetchWithHeaders(url: string, referer?: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': referer || 'https://vidsrc.cc/',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Parse servers from embed page HTML
 * 
 * vidsrc.cc v2 loads servers dynamically, but we can try to find:
 * 1. data-hash attributes
 * 2. Internal video IDs (data-id)
 * 3. API endpoints in JavaScript
 */
function parseServers(html: string): ServerInfo[] {
  const servers: ServerInfo[] = [];

  // Pattern 1: Look for data-hash attributes
  const hashPattern = /data-hash="([^"]+)"/g;
  let match;
  while ((match = hashPattern.exec(html)) !== null) {
    const hash = match[1];
    if (!servers.some(s => s.hash === hash)) {
      servers.push({ name: `Server-${servers.length + 1}`, hash });
    }
  }

  // Pattern 2: Look for episode/video data-id (internal IDs)
  const dataIdPattern = /<a[^>]*href="javascript:;"[^>]*data-id="(\d+)"[^>]*data-number="(\d+)"[^>]*>/g;
  while ((match = dataIdPattern.exec(html)) !== null) {
    const dataId = match[1];
    console.log(`[VidSrc] Found internal video ID: ${dataId}`);
    // Store for potential API calls
    if (servers.length === 0) {
      servers.push({ name: 'Primary', hash: dataId, dataId });
    }
  }

  // Pattern 3: wrapper data-id
  const wrapperMatch = html.match(/id="wrapper"[^>]*data-id="(\d+)"/);
  if (wrapperMatch) {
    console.log(`[VidSrc] Found wrapper data-id: ${wrapperMatch[1]}`);
  }

  return servers;
}

/**
 * Try to extract stream from RCP endpoint
 */
async function extractFromRcp(hash: string, referer: string): Promise<StreamSource | null> {
  try {
    const rcpUrl = `${PROVIDERS.VIDSRC_CC.rcp}/${hash}`;
    console.log(`[VidSrc] Fetching RCP: ${rcpUrl}`);

    const html = await fetchWithHeaders(rcpUrl, referer);
    console.log(`[VidSrc] RCP response length: ${html.length}`);

    // Extract encrypted data: data-h="..."
    const encryptedMatch = html.match(/data-h="([^"]+)"/);
    if (!encryptedMatch) {
      console.log('[VidSrc] No encrypted data (data-h) found');
      return null;
    }
    const encryptedData = encryptedMatch[1];

    // Extract seed: data-i="..."
    const seedMatch = html.match(/data-i="([^"]+)"/);
    if (!seedMatch) {
      console.log('[VidSrc] No seed (data-i) found');
      return null;
    }
    const seed = seedMatch[1];

    console.log(`[VidSrc] Found encrypted data (${encryptedData.length} chars) and seed: ${seed}`);

    // Decrypt
    const decrypted = decryptVidsrc(encryptedData, seed);
    console.log(`[VidSrc] Decrypted: ${decrypted.substring(0, 100)}...`);

    // Extract URL
    const streamUrl = extractUrlFromDecrypted(decrypted);
    if (!streamUrl) {
      console.log('[VidSrc] Could not extract URL from decrypted data');
      return null;
    }

    console.log(`[VidSrc] Extracted stream URL: ${streamUrl}`);

    return {
      url: streamUrl,
      quality: 'auto',
      provider: 'vidsrc.cc',
      headers: {
        'Referer': 'https://vidsrc.stream/',
        'Origin': 'https://vidsrc.stream',
      },
    };
  } catch (error) {
    console.error('[VidSrc] RCP extraction failed:', error);
    return null;
  }
}

/**
 * Try alternative API endpoints for vidsrc.cc v2
 */
async function tryAlternativeApis(tmdbId: string, type: string, html: string): Promise<StreamSource | null> {
  // Try to find the internal video ID from the page
  const episodeMatch = html.match(/data-id="(\d+)"[^>]*data-number/);
  if (!episodeMatch) {
    console.log('[VidSrc] No internal video ID found for API calls');
    return null;
  }

  const internalId = episodeMatch[1];
  console.log(`[VidSrc] Trying API with internal ID: ${internalId}`);

  // Try various API endpoints that vidsrc might use
  const apiEndpoints = [
    `https://vidsrc.cc/api/source/${internalId}`,
    `https://vidsrc.cc/api/episodes/${internalId}/servers`,
    `https://vidsrc.stream/api/source/${internalId}`,
  ];

  for (const endpoint of apiEndpoints) {
    try {
      console.log(`[VidSrc] Trying API: ${endpoint}`);
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': 'https://vidsrc.cc/',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[VidSrc] API response:`, JSON.stringify(data).substring(0, 200));
        
        // Check if we got useful data
        if (data.data || data.sources || data.url) {
          // Process based on response structure
          const url = data.url || data.data?.url || data.sources?.[0]?.url;
          if (url) {
            return {
              url,
              quality: 'auto',
              provider: 'vidsrc.cc/api',
            };
          }
        }
      }
    } catch (error) {
      console.log(`[VidSrc] API ${endpoint} failed:`, error);
    }
  }

  return null;
}

/**
 * Try embed.su provider
 */
async function tryEmbedSu(request: ExtractRequest): Promise<StreamSource | null> {
  try {
    const { type, tmdbId, season, episode } = request;
    let embedUrl = `${PROVIDERS.EMBED_SU.embed}/${type}/${tmdbId}`;
    
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }

    console.log(`[EmbedSu] Fetching: ${embedUrl}`);
    const html = await fetchWithHeaders(embedUrl, 'https://embed.su/');
    
    // Look for hash-based servers
    const hashMatch = html.match(/data-hash="([^"]+)"/);
    if (hashMatch) {
      console.log(`[EmbedSu] Found hash: ${hashMatch[1]}`);
      
      // Try to fetch stream from hash
      const streamUrl = `${PROVIDERS.EMBED_SU.api}/source/${hashMatch[1]}`;
      const response = await fetch(streamUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': embedUrl,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.source || data.file || data.url) {
          return {
            url: data.source || data.file || data.url,
            quality: 'auto',
            provider: 'embed.su',
          };
        }
      }
    }
    
    // Try to find m3u8 directly in page
    const m3u8Match = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (m3u8Match) {
      console.log(`[EmbedSu] Found m3u8: ${m3u8Match[1]}`);
      return {
        url: m3u8Match[1],
        quality: 'auto',
        provider: 'embed.su',
      };
    }
    
    return null;
  } catch (error) {
    console.log('[EmbedSu] Failed:', error);
    return null;
  }
}

/**
 * Try vidsrc.to provider (different from vidsrc.cc)
 */
async function tryVidsrcTo(request: ExtractRequest): Promise<StreamSource | null> {
  try {
    const { type, tmdbId, season, episode } = request;
    let embedUrl = `${PROVIDERS.VIDSRC_TO.embed}/${type}/${tmdbId}`;
    
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }

    console.log(`[VidsrcTo] Fetching: ${embedUrl}`);
    const html = await fetchWithHeaders(embedUrl, 'https://vidsrc.to/');
    
    // Look for data-id to get sources
    const dataIdMatch = html.match(/data-id="([^"]+)"/);
    if (dataIdMatch) {
      const dataId = dataIdMatch[1];
      console.log(`[VidsrcTo] Found data-id: ${dataId}`);
      
      // Try to get sources
      const sourcesUrl = `${PROVIDERS.VIDSRC_TO.api}/${type}/${dataId}/sources`;
      const response = await fetch(sourcesUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': embedUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[VidsrcTo] Sources response:`, JSON.stringify(data).substring(0, 200));
        
        if (data.result && Array.isArray(data.result)) {
          for (const source of data.result) {
            if (source.id) {
              // Get stream URL for this source
              const streamUrl = `${PROVIDERS.VIDSRC_TO.api}/source/${source.id}`;
              const streamResp = await fetch(streamUrl, {
                headers: {
                  'User-Agent': USER_AGENT,
                  'Referer': embedUrl,
                },
              });
              
              if (streamResp.ok) {
                const streamData = await streamResp.json();
                if (streamData.result?.url) {
                  return {
                    url: streamData.result.url,
                    quality: 'auto',
                    provider: `vidsrc.to/${source.title || 'unknown'}`,
                  };
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log('[VidsrcTo] Failed:', error);
    return null;
  }
}

/**
 * Main extraction function - tries multiple providers
 */
export async function extractVidsrcStream(request: ExtractRequest): Promise<ExtractResult> {
  console.log(`\n[Extractor] Starting extraction for ${request.type}/${request.tmdbId}`);
  const streams: StreamSource[] = [];
  const errors: string[] = [];

  // Provider 1: Try vidsrc.cc (original)
  try {
    console.log('\n[Extractor] Trying vidsrc.cc...');
    const embedUrl = buildEmbedUrl(request);
    const html = await fetchWithHeaders(embedUrl);
    
    const servers = parseServers(html);
    console.log(`[VidSrc] Found ${servers.length} servers`);

    for (const server of servers) {
      if (server.hash && !server.dataId) {
        const stream = await extractFromRcp(server.hash, embedUrl);
        if (stream) {
          streams.push(stream);
        }
      }
    }

    if (streams.length === 0) {
      const apiStream = await tryAlternativeApis(request.tmdbId, request.type, html);
      if (apiStream) {
        streams.push(apiStream);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    errors.push(`vidsrc.cc: ${msg}`);
    console.log('[Extractor] vidsrc.cc failed:', msg);
  }

  // Provider 2: Try embed.su
  if (streams.length === 0) {
    try {
      console.log('\n[Extractor] Trying embed.su...');
      const embedStream = await tryEmbedSu(request);
      if (embedStream) {
        streams.push(embedStream);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      errors.push(`embed.su: ${msg}`);
    }
  }

  // Provider 3: Try vidsrc.to
  if (streams.length === 0) {
    try {
      console.log('\n[Extractor] Trying vidsrc.to...');
      const vidsrcToStream = await tryVidsrcTo(request);
      if (vidsrcToStream) {
        streams.push(vidsrcToStream);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      errors.push(`vidsrc.to: ${msg}`);
    }
  }

  // Return results
  if (streams.length > 0) {
    console.log(`\n[Extractor] ✅ Found ${streams.length} stream(s)`);
    return {
      success: true,
      streams,
    };
  }

  // Fallback: Return iframe embed URLs that the frontend can use
  console.log('\n[Extractor] ⚠️ No direct streams found, returning fallback embed URLs');
  
  const { type, tmdbId, season, episode } = request;
  const fallbackStreams: StreamSource[] = [
    {
      url: `https://vidsrc.cc/v2/embed/${type}/${tmdbId}${type === 'tv' && season && episode ? `/${season}/${episode}` : ''}`,
      quality: 'iframe',
      provider: 'vidsrc.cc/iframe',
    },
    {
      url: `https://vidsrc.to/embed/${type}/${tmdbId}${type === 'tv' && season && episode ? `/${season}/${episode}` : ''}`,
      quality: 'iframe',
      provider: 'vidsrc.to/iframe',
    },
    {
      url: `https://embed.su/embed/${type}/${tmdbId}${type === 'tv' && season && episode ? `/${season}/${episode}` : ''}`,
      quality: 'iframe',
      provider: 'embed.su/iframe',
    },
  ];

  return {
    success: true, // Success but with iframe fallback
    streams: fallbackStreams,
    error: `Direct extraction unavailable. Providers require VRF/JS execution. Using iframe fallback.`,
  };
}
