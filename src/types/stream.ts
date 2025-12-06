/**
 * Stream Extraction Type Definitions
 * For vidsrc.cc native HLS stream extraction
 * 
 * Based on Playwright research of the real vidsrc.cc API chain:
 * 1. GET /api/{tmdbId}/servers?vrf=... → { data: VidsrcServer[] }
 * 2. GET /api/source/{hash} → VidsrcSourceResponse
 * 3. Play m3u8 from lightningbolt.site with Referer: https://vidsrc.cc/
 */

// ============================================================
// VIDSRC API TYPES (matches real API responses)
// ============================================================

/**
 * Server entry from /api/{tmdbId}/servers response
 */
export interface VidsrcServer {
  name: string;   // e.g., "VidPlay", "UpCloud", "GoCloud(Hindi audio)"
  hash: string;   // Hash used to call /api/source/{hash}
}

/**
 * Response from /api/{tmdbId}/servers
 */
export interface VidsrcServersApiResponse {
  data: VidsrcServer[];
  success: boolean;
}

/**
 * Subtitle track from source response
 */
export interface SubtitleTrack {
  file: string;       // URL to subtitle file (.vtt or .srt)
  label: string;      // Language label, e.g., "English", "Spanish"
  kind?: string;      // Usually "captions"
  default?: boolean;  // Whether this is the default track
}

/**
 * Response data from /api/source/{hash}
 */
export interface VidsrcSourceData {
  type: 'hls' | string;         // Stream type, usually "hls"
  source: string;               // Master m3u8 URL (e.g., https://lightningbolt.site/...)
  subtitles: SubtitleTrack[];   // Available subtitle tracks
}

/**
 * Full response from /api/source/{hash}
 */
export interface VidsrcSourceResponse {
  data: VidsrcSourceData;
  success: boolean;
}

// ============================================================
// EXTRACTED STREAM (our internal representation)
// ============================================================

/**
 * Successfully extracted stream ready for playback
 */
export interface ExtractedStream {
  m3u8Url: string;              // Direct m3u8 URL for hls.js
  subtitles: SubtitleTrack[];   // Available subtitles
  provider: 'vidsrc';           // Provider identifier
  serverName: string;           // Which server this came from (e.g., "VidPlay")
  headers?: {                   // Required headers for m3u8 fetch
    Referer?: string;
    Origin?: string;
  };
}

// ============================================================
// STREAM EXTRACTION (existing types, updated)
// ============================================================

export interface StreamQuality {
  height: number;
  label: string; // "1080p", "720p", "480p", "auto"
}

export interface StreamSource {
  url: string;                          // m3u8 or direct video URL
  quality: string;                      // "1080p", "720p", "480p", "auto"
  provider: string;                     // "vidsrc.cc", "vidlink.pro", etc.
  headers?: Record<string, string>;     // Required headers for playback
  isDefault?: boolean;                  // Whether this is the default/best quality
  subtitles?: SubtitleTrack[];          // Associated subtitles
  serverName?: string;                  // Server name if from vidsrc
}

export interface StreamExtractionError {
  code: string;                         // Error code like "FETCH_FAILED", "DECRYPT_FAILED"
  message: string;                      // Human-readable error message
  step: string;                         // Which step failed
}

export interface StreamDebugMetadata {
  provider: string;
  timestamp: number;
  stepsCompleted: string[];
  embedUrl?: string;
  serversFound?: number;
  extractionTimeMs?: number;
  usedDebugHash?: boolean;              // True if debug hash was used
}

export interface StreamExtractionResult {
  success: boolean;
  streams: StreamSource[];
  extractedStream?: ExtractedStream;    // The primary extracted stream (if successful)
  error?: StreamExtractionError;
  debugMetadata?: StreamDebugMetadata;
}

export interface StreamExtractionRequest {
  type: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  debugHash?: string;                   // Optional: bypass servers API and use this hash directly
}
