/**
 * Vidsrc API Client
 * 
 * Dedicated client for interacting with the vidsrc.cc API chain.
 * Based on Playwright research findings:
 * 
 * Request Chain:
 * 1. GET /api/{tmdbId}/servers?id={tmdbId}&type={type}&v={base64}&vrf={vrf}&imdbId={imdbId}
 *    → Returns: { data: VidsrcServer[], success: boolean }
 * 
 * 2. GET /api/source/{hash}
 *    → Returns: { data: { type: 'hls', source: 'm3u8_url', subtitles: [...] }, success: boolean }
 * 
 * 3. Play m3u8 with headers: Referer: https://vidsrc.cc/, Origin: https://vidsrc.cc
 */

import type {
  VidsrcServer,
  VidsrcServersApiResponse,
  VidsrcSourceResponse,
  ExtractedStream,
  SubtitleTrack,
} from '../types/stream';

// ============================================================
// CONSTANTS
// ============================================================

const VIDSRC_BASE = 'https://vidsrc.cc';

// Required headers for m3u8 playback
export const VIDSRC_STREAM_HEADERS = {
  Referer: 'https://vidsrc.cc/',
  Origin: 'https://vidsrc.cc',
};

// ============================================================
// LOGGING
// ============================================================

function log(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[VidsrcApi] ${message}`, data);
  } else {
    console.log(`[VidsrcApi] ${message}`);
  }
}

function logError(message: string, error?: unknown): void {
  console.error(`[VidsrcApi] ERROR: ${message}`, error || '');
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Get available servers for a movie/TV show
 * 
 * TODO: Wire VRF generator when implemented.
 * Currently this function requires a pre-generated VRF token.
 * VRF generation requires reverse-engineering obfuscated JS.
 * 
 * @param tmdbId - TMDB ID of the movie/show
 * @param type - 'movie' or 'tv'
 * @param vrf - VRF token (required by API)
 * @param options - Optional parameters
 */
export async function getServers(
  tmdbId: string,
  type: 'movie' | 'tv',
  vrf: string,
  options?: {
    imdbId?: string;
    title?: string;
    year?: string;
    season?: number;
    episode?: number;
  }
): Promise<{ success: boolean; servers: VidsrcServer[]; error?: string }> {
  // Build the 'v' parameter (base64 of "Title_Year_null" or similar)
  // This is typically: btoa(`${title}_${year}_null`)
  const vParam = options?.title && options?.year
    ? btoa(`${options.title}_${options.year}_null`)
    : '';

  // Build URL
  const params = new URLSearchParams({
    id: tmdbId,
    type: type,
    vrf: vrf,
  });

  if (vParam) {
    params.set('v', vParam);
  }

  if (options?.imdbId) {
    params.set('imdbId', options.imdbId);
  }

  const url = `${VIDSRC_BASE}/api/${tmdbId}/servers?${params.toString()}`;
  log('getServers() - Fetching servers', { url, tmdbId, type });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Referer': VIDSRC_BASE,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`getServers() - HTTP ${response.status}`, errorText);
      return {
        success: false,
        servers: [],
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data: VidsrcServersApiResponse = await response.json();
    log('getServers() - Response', { success: data.success, serverCount: data.data?.length });

    if (!data.success || !data.data) {
      return {
        success: false,
        servers: [],
        error: 'API returned success: false or no data',
      };
    }

    return {
      success: true,
      servers: data.data,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logError('getServers() - Fetch failed', errMsg);
    return {
      success: false,
      servers: [],
      error: errMsg,
    };
  }
}

/**
 * Get stream source by server hash
 * 
 * This is the key function - given a hash from getServers(),
 * it returns the actual m3u8 URL and subtitles.
 * 
 * @param hash - Server hash from VidsrcServer.hash
 * @param serverName - Optional server name for logging
 */
export async function getSourceByHash(
  hash: string,
  serverName: string = 'unknown'
): Promise<{ success: boolean; stream?: ExtractedStream; error?: string }> {
  const url = `${VIDSRC_BASE}/api/source/${hash}`;
  log('getSourceByHash() - Fetching source', { url, serverName, hashPreview: hash.substring(0, 30) + '...' });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Referer': VIDSRC_BASE,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`getSourceByHash() - HTTP ${response.status}`, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data: VidsrcSourceResponse = await response.json();
    log('getSourceByHash() - Response', {
      success: data.success,
      type: data.data?.type,
      hasSource: !!data.data?.source,
      subtitleCount: data.data?.subtitles?.length,
    });

    if (!data.success || !data.data) {
      return {
        success: false,
        error: 'API returned success: false or no data',
      };
    }

    const { type, source, subtitles } = data.data;

    // Validate HLS stream
    if (type !== 'hls') {
      log('getSourceByHash() - Non-HLS type', { type });
      // Still try to use it if source looks like m3u8
    }

    if (!source) {
      return {
        success: false,
        error: 'No source URL in response',
      };
    }

    // Check if source is m3u8
    const isM3u8 = source.includes('.m3u8');
    if (!isM3u8) {
      log('getSourceByHash() - Source does not appear to be m3u8', { source: source.substring(0, 100) });
    }

    // Build ExtractedStream
    const extractedStream: ExtractedStream = {
      m3u8Url: source,
      subtitles: subtitles || [],
      provider: 'vidsrc',
      serverName: serverName,
      headers: VIDSRC_STREAM_HEADERS,
    };

    log('getSourceByHash() - Successfully extracted stream', {
      m3u8Url: source.substring(0, 80) + '...',
      subtitleCount: extractedStream.subtitles.length,
      serverName,
    });

    return {
      success: true,
      stream: extractedStream,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logError('getSourceByHash() - Fetch failed', errMsg);
    return {
      success: false,
      error: errMsg,
    };
  }
}

// ============================================================
// CONVENIENCE EXPORT
// ============================================================

export const vidsrcApi = {
  getServers,
  getSourceByHash,
  VIDSRC_BASE,
  VIDSRC_STREAM_HEADERS,
};

export default vidsrcApi;
