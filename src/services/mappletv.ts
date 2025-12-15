/**
 * MappletTV Streaming Service
 *
 * Connects to mappletv-scraper.js backend to extract M3U8 streaming URLs.
 */

// Backend scraper URL - defaults to HF production, can be overridden by env var for local dev
const SCRAPER_BASE_URL = (import.meta as any).env?.VITE_SCRAPER_URL || 'https://abhishek1996-fluxnest.hf.space';

export interface StreamQuality {
    resolution: string;
    quality: string;
    bandwidth: number;
    url: string;
}

export interface Subtitle {
    label: string;
    language?: string;
    file: string;
}

export interface StreamResponse {
    success: boolean;
    m3u8Url?: string;
    referer?: string;
    provider?: string;
    qualities?: string[];
    qualityDetails?: StreamQuality[];
    subtitles?: Subtitle[];
    allUrls?: string[];
    error?: string;
    debug?: {
        finalUrl?: string;
        title?: string;
    };
}

/**
 * Extract M3U8 streaming URL from MappletTV backend
 */
export async function getMappleTVStream(
    tmdbId: string | number,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<StreamResponse> {
    const params = new URLSearchParams({
        tmdbId: tmdbId.toString(),
        type
    });

    if (type === 'tv' && season !== undefined && episode !== undefined) {
        params.append('season', season.toString());
        params.append('episode', episode.toString());
    }

    // Endpoint for mappletv-scraper.js
    const url = `${SCRAPER_BASE_URL}/api/mappletv/extract?${params}`;
    console.log('[MappletTV] 📡 Requesting:', url);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('[MappletTV] ⏱️ Timeout after 2 minutes');
            controller.abort();
        }, 120000);

        console.log('[MappletTV] ⏳ Waiting for extraction (may take 30-60 seconds)...');
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('[MappletTV] 📥 Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MappletTV] ❌ HTTP Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: StreamResponse = await response.json();
        console.log('[MappletTV] ✅ Response:', JSON.stringify(data).substring(0, 300));
        return data;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[MappletTV] ❌ Request timeout');
            return { success: false, error: 'Timeout - extraction took too long' };
        }
        console.error('[MappletTV] ❌ Failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Check if backend is running
 */
export async function checkScraperHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${SCRAPER_BASE_URL}/health`, {
            signal: AbortSignal.timeout(5000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get proxied M3U8 URL for CORS bypass
 * Skips proxying if the URL is already from a known CORS-enabled domain
 */
export function getProxiedM3U8Url(originalUrl: string, referer?: string): string {
    // OPTIMIZATION: Skip proxying for URLs that already handle CORS
    // Only proxy.heistotron.uk actually supports CORS (source.heistotron.uk does NOT)
    const corsEnabledDomains = ['proxy.heistotron.uk'];
    const urlLower = originalUrl.toLowerCase();

    if (corsEnabledDomains.some(domain => urlLower.includes(domain))) {
        console.log('[MappletTV] 🚀 Using direct URL (already CORS-enabled):', originalUrl.substring(0, 60) + '...');
        return originalUrl;
    }

    const params = new URLSearchParams({ url: originalUrl });
    if (referer) {
        params.append('referer', referer);
    }
    return `${SCRAPER_BASE_URL}/api/proxy/m3u8?${params}`;
}

/**
 * Get proxied subtitle URL for CORS bypass
 */
export function getProxiedSubtitleUrl(originalUrl: string, referer?: string): string {
    // Skip if already CORS-enabled
    const corsEnabledDomains = ['heistotron.uk', 'source.heistotron.uk', 'proxy.heistotron.uk'];
    const urlLower = originalUrl.toLowerCase();

    if (corsEnabledDomains.some(domain => urlLower.includes(domain))) {
        return originalUrl;
    }

    const params = new URLSearchParams({ url: originalUrl });
    if (referer) {
        params.append('referer', referer);
    }
    return `${SCRAPER_BASE_URL}/api/proxy/subtitle?${params}`;
}

/**
 * Process subtitles from API response and proxy URLs if needed
 */
export function processSubtitles(subtitles: Subtitle[], referer?: string): Subtitle[] {
    if (!subtitles || subtitles.length === 0) return [];

    return subtitles.map(sub => ({
        ...sub,
        file: getProxiedSubtitleUrl(sub.file, referer)
    }));
}

export const mappleTVService = {
    getStream: getMappleTVStream,
    getMappleTVStream,
    checkHealth: checkScraperHealth,
    getProxiedUrl: getProxiedM3U8Url,
    getProxiedSubtitleUrl,
    processSubtitles
};

export default mappleTVService;
