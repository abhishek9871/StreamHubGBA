# FlixNest Stream Extraction Solution

## Complete Technical Documentation

**Document Version:** 1.0  
**Last Updated:** December 6, 2025  
**Status:** WORKING SOLUTION IMPLEMENTED

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Failed Approaches](#3-failed-approaches)
4. [Working Solution](#4-working-solution)
5. [Architecture](#5-architecture)
6. [File Structure](#6-file-structure)
7. [Implementation Details](#7-implementation-details)
8. [API Reference](#8-api-reference)
9. [Frontend Integration](#9-frontend-integration)
10. [How to Run](#10-how-to-run)
11. [Testing Results](#11-testing-results)
12. [Configuration](#12-configuration)
13. [Known Limitations](#13-known-limitations)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Executive Summary

### What We Built
A **backend Playwright-based scraper service** that extracts M3U8 streaming URLs from vidsrc.cc, enabling native video playback with quality selection in the FlixNest application.

### Why It Works
- Playwright runs a **real Chromium browser** (not subject to CORS/origin restrictions)
- Network interception happens at the **Chrome DevTools Protocol level**
- vidsrc.cc cannot distinguish it from a legitimate browser visit
- An **M3U8 proxy** on the backend bypasses CORS for the frontend

### Final Result
- ✅ Movies play natively with hls.js
- ✅ TV shows play natively with hls.js
- ✅ Quality selection works (Auto, 360p, 720p, 1080p)
- ✅ Subtitles are extracted (18-40 tracks per video)
- ✅ Fallback to iframe if extraction fails

---

## 2. Problem Statement

### Original Goal
Enable **native video playback** in FlixNest instead of embedding third-party iframes, allowing:
- Custom quality selection UI
- Subtitle control
- Better user experience
- No third-party ads

### Technical Challenge
**vidsrc.cc** (the video provider) has multiple protections:
1. **CORS restrictions** - Blocks cross-origin API requests
2. **VRF token validation** - Server-side validation tied to browser session
3. **Origin checking** - Rejects requests not from vidsrc.cc origin
4. **Dynamic hash generation** - Server hashes change per session

### Core Problem
The M3U8 URL is returned by `/api/source/{hash}` endpoint, but:
- Frontend cannot call this API directly (CORS blocked)
- Hash is dynamically generated with VRF validation
- VRF algorithm is obfuscated in their JavaScript

---

## 3. Failed Approaches

### Approach 1: Direct API Calls from Frontend
**What we tried:** Call vidsrc.cc APIs directly from React frontend  
**Why it failed:** CORS policy blocks all cross-origin requests  
**Error:** `Access-Control-Allow-Origin` header missing

### Approach 2: Cloudflare Worker Proxy
**What we tried:** 
- Deploy a Cloudflare Worker as same-origin proxy
- Inject interceptor script into vidsrc.cc HTML
- Capture M3U8 via postMessage from injected iframe

**Why it failed:**
- vidsrc.cc validates `Origin` header server-side
- VRF tokens are bound to the original browser session
- Even with proxy, the `/api/source/{hash}` call returned 400 errors

**Key Learning:** Origin validation happens at the application layer, not just CORS headers.

### Approach 3: VRF Algorithm Reverse Engineering
**What we tried:** Deobfuscate vidsrc.cc JavaScript to find VRF generation algorithm  
**Why it failed:** 
- Algorithm is heavily obfuscated
- Even if cracked, they can change it anytime
- Not a sustainable solution

---

## 4. Working Solution

### The Breakthrough: Backend Playwright Scraper

**Key Insight:** Run a **real browser** on the backend. A real browser:
- Is not subject to CORS (it's making first-party requests)
- Naturally generates valid VRF tokens (vidsrc.cc's own JS runs)
- Can intercept network responses at the protocol level

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React App (localhost:3000)                                     │
│                                                                 │
│  1. User clicks "Play" on MovieDetail or TVDetail               │
│  2. Frontend calls: GET http://localhost:3001/api/extract       │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND SCRAPER                              │
│  Node.js + Express + Playwright (localhost:3001)                │
│                                                                 │
│  3. Launch headless Chromium browser                            │
│  4. Navigate to: https://vidsrc.cc/v2/embed/movie/{tmdbId}      │
│  5. Intercept network responses via CDP                         │
│  6. Capture /api/source/{hash} response containing m3u8Url      │
│  7. Return m3u8Url + subtitles to frontend                      │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                 │
│  8. Receive m3u8Url (e.g., https://lightningbolt.site/...m3u8)  │
│  9. PROBLEM: Direct m3u8 fetch blocked by CORS                  │
│  10. SOLUTION: Proxy through backend                            │
│      GET http://localhost:3001/api/proxy/m3u8?url={m3u8Url}     │
│  11. hls.js loads proxied m3u8, plays video                     │
│  12. Quality selector shows available levels                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Architecture

### Component Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                           FLIXNEST                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │   MovieDetail    │     │    TVDetail      │                     │
│  │   TVDetail       │     │                  │                     │
│  └────────┬─────────┘     └────────┬─────────┘                     │
│           │                        │                               │
│           └──────────┬─────────────┘                               │
│                      ▼                                             │
│           ┌──────────────────┐                                     │
│           │ streamExtractor  │  src/services/streamExtractor.ts    │
│           │                  │                                     │
│           │ - tryBackendScraper()                                  │
│           │ - trySameOriginProxy() (fallback)                      │
│           │ - buildIframeUrl() (fallback)                          │
│           └────────┬─────────┘                                     │
│                    │                                               │
│                    ▼                                               │
│           ┌──────────────────┐                                     │
│           │  NativePlayer    │  src/components/common/             │
│           │                  │  NativePlayer.tsx                   │
│           │ - hls.js integration                                   │
│           │ - Quality selector                                     │
│           │ - Subtitle display                                     │
│           └──────────────────┘                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                      BACKEND SCRAPER                               │
│                      (backend/scraper.js)                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ /api/extract    │  │ /api/proxy/m3u8 │  │ /api/proxy/     │     │
│  │                 │  │                 │  │ segment         │     │
│  │ Playwright      │  │ Fetch & rewrite │  │ Binary proxy    │     │
│  │ extraction      │  │ m3u8 content    │  │ for .ts files   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     In-Memory Cache                         │   │
│  │                     (Map, 30 min TTL)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ Playwright (Headless Chromium)
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                        VIDSRC.CC                                   │
│                                                                    │
│  /v2/embed/movie/{tmdbId}                                          │
│  /v2/embed/tv/{tmdbId}/{season}/{episode}                          │
│  /api/{id}/servers  →  Returns server list with hashes             │
│  /api/source/{hash} →  Returns m3u8Url + subtitles                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. File Structure

### Backend Files (NEW)

```
backend/
├── scraper.js          # Main Express server with Playwright extraction
├── package.json        # Dependencies: express, cors, playwright
└── package-lock.json   # Lock file
```

### Frontend Files (MODIFIED/NEW)

```
src/
├── components/
│   ├── common/
│   │   ├── NativePlayer.tsx    # NEW: hls.js video player component
│   │   └── NativePlayer.css    # NEW: Player styles
│   └── pages/
│       ├── MovieDetail/
│       │   └── MovieDetail.tsx # MODIFIED: Added stream extraction
│       └── TVDetail/
│           └── TVDetail.tsx    # MODIFIED: Added stream extraction
├── services/
│   ├── streamExtractor.ts      # NEW: Stream extraction pipeline
│   └── vidsrcApi.ts            # NEW: Vidsrc API client (legacy)
├── types/
│   └── stream.ts               # NEW: TypeScript interfaces
└── utils/
    ├── streamDebugger.ts       # NEW: Debug utilities
    └── decryptUtils.ts         # NEW: Crypto utilities (legacy)
```

### Configuration Files (NEW/MODIFIED)

```
.env.example            # NEW: Environment variable template
.gitignore              # MODIFIED: Added backend/node_modules
wrangler.toml           # NEW: Cloudflare Worker config (fallback)
```

---

## 7. Implementation Details

### 7.1 Backend Scraper (`backend/scraper.js`)

**Total Lines:** 352

**Key Functions:**

#### `/api/extract` Endpoint (Lines 38-216)
```javascript
// Input validation
const { tmdbId, type, season, episode } = req.query;

// Cache check
const cacheKey = `${type}-${tmdbId}-${season || 'n/a'}-${episode || 'n/a'}`;
if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

// Launch Playwright
browser = await chromium.launch({ headless: true, args: [...] });

// Network interception
page.on('response', async (response) => {
  if (url.includes('/api/source/') && status === 200) {
    const data = await response.json();
    m3u8Url = data.data.source;
    subtitles = data.data.subtitles || [];
  }
});

// Navigate and wait
await page.goto(vidsrcUrl, { waitUntil: 'networkidle' });

// Return result
res.json({ success: true, m3u8Url, subtitles, serverName, extractionTime });
```

#### `/api/proxy/m3u8` Endpoint (Lines 222-286)
- Fetches M3U8 with proper headers (Referer, Origin)
- Rewrites relative URLs to absolute
- Rewrites all segment URLs to go through `/api/proxy/segment`
- Adds CORS headers for frontend access

#### `/api/proxy/segment` Endpoint (Lines 288-327)
- Binary passthrough for .ts video segments
- Adds required headers for vidsrc.cc
- Streams response to frontend

### 7.2 Stream Extractor (`src/services/streamExtractor.ts`)

**Total Lines:** 835

**Key Method: `tryBackendScraper()`** (Lines 298-414)
```typescript
// Build request URL
const url = `${scraperUrl}?${params.toString()}`;

// Call backend with timeout
const response = await fetch(url, {
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  signal: controller.signal,
});

// Proxy the m3u8 URL through backend
const proxiedM3u8Url = `${scraperBaseUrl}/api/proxy/m3u8?url=${encodeURIComponent(data.m3u8Url)}`;

// Return ExtractedStream
return {
  success: true,
  extractedStream: {
    m3u8Url: proxiedM3u8Url,
    subtitles: data.subtitles,
    provider: 'vidsrc',
    serverName: data.serverName,
  }
};
```

**Extraction Pipeline** (Lines 580-820)
```
Stage 1: Debug hash (for testing)
    ↓
Stage 2: Backend Playwright scraper (PRIMARY) ← THIS IS WHAT WORKS
    ↓
Stage 3: Same-origin proxy (FALLBACK)
    ↓
Stage 4: Iframe fallback (LAST RESORT)
```

### 7.3 NativePlayer (`src/components/common/NativePlayer.tsx`)

**Total Lines:** 220+

**Key Features:**
- Uses hls.js for HLS playback (Chrome, Firefox, Edge)
- Falls back to native HLS on Safari
- Quality selector dropdown
- Subtitle count display
- Provider info display
- Close button

**Critical Fix Applied:**
```typescript
// CORRECT: Prefer hls.js over native (native detection was buggy in Chrome)
if (Hls.isSupported()) {
  initHls(video);  // Use hls.js
  return;
}

// FALLBACK: Only for Safari/iOS
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = extracted.m3u8Url;  // Native HLS
}
```

---

## 8. API Reference

### Backend Scraper API

#### `GET /api/extract`

**Purpose:** Extract M3U8 URL from vidsrc.cc

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tmdbId | string | Yes | TMDB movie/show ID |
| type | string | Yes | "movie" or "tv" |
| season | number | TV only | Season number |
| episode | number | TV only | Episode number |

**Example Requests:**
```bash
# Movie
GET /api/extract?tmdbId=278&type=movie

# TV Show
GET /api/extract?tmdbId=1396&type=tv&season=1&episode=1
```

**Success Response (200):**
```json
{
  "success": true,
  "m3u8Url": "https://lightningbolt.site/_v27/BCMq...m3u8?code=...&hash=...",
  "subtitles": [
    {"kind": "captions", "file": "https://...", "label": "English", "default": true},
    {"kind": "captions", "file": "https://...", "label": "Spanish"}
  ],
  "serverName": "VidPlay",
  "extractionTime": 15403,
  "cached": false
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Could not extract m3u8 URL. The video may not be available.",
  "extractionTime": 45000
}
```

#### `GET /api/proxy/m3u8`

**Purpose:** Proxy M3U8 playlist with CORS headers

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL-encoded M3U8 URL |

**Example:**
```bash
GET /api/proxy/m3u8?url=https%3A%2F%2Flightningbolt.site%2F_v27%2F...m3u8
```

#### `GET /api/proxy/segment`

**Purpose:** Proxy .ts video segments

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL-encoded segment URL |

#### `GET /health`

**Purpose:** Health check

**Response:**
```json
{"status": "ok", "cache": 5}
```

#### `POST /api/cache/clear`

**Purpose:** Clear extraction cache

**Response:**
```json
{"success": true, "cleared": 5}
```

---

## 9. Frontend Integration

### MovieDetail Integration

**File:** `src/components/pages/MovieDetail/MovieDetail.tsx`

**Changes Made:**
1. Import `streamExtractor` and `NativePlayer`
2. Add state for `extractedStream`, `extracting`, `useFallbackIframe`
3. Add `handlePlayClick()` function
4. Conditional rendering: NativePlayer if extracted, iframe if fallback

```tsx
const handlePlayClick = async () => {
  setIsPlaying(true);
  setExtracting(true);
  
  const result = await streamExtractor.extract({
    type: 'movie',
    tmdbId: movie.id.toString(),
  });
  
  if (result.success && result.extractedStream) {
    setExtractedStream(result.extractedStream);
  } else {
    setUseFallbackIframe(true);
  }
  
  setExtracting(false);
};
```

### TVDetail Integration

**File:** `src/components/pages/TVDetail/TVDetail.tsx`

**Changes Made:**
1. Same imports as MovieDetail
2. Modified `playEpisode()` function to include extraction
3. Pass season and episode to extractor

```tsx
const playEpisode = async (season: number, episode: number) => {
  const result = await streamExtractor.extract({
    type: 'tv',
    tmdbId: show.id.toString(),
    season,
    episode,
  });
  // ... same handling as MovieDetail
};
```

---

## 10. How to Run

### Prerequisites
- Node.js 18+
- npm

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
# This also runs: npx playwright install chromium (downloads ~180MB)
```

### Step 2: Start Backend Scraper
```bash
cd backend
npm start

# Output:
# 🎬 FlixNest Scraper running on http://localhost:3001
```

### Step 3: Start Frontend
```bash
# In project root
npm run dev

# Output:
# ➜ Local: http://localhost:3000/
```

### Step 4: Test
1. Open http://localhost:3000
2. Navigate to a movie (e.g., http://localhost:3000/#/movie/278)
3. Click "Play"
4. Wait 15-25 seconds for extraction
5. Video should play with quality selector

---

## 11. Testing Results

### Movies Tested

| TMDB ID | Title | Status | Extraction Time | Subtitles |
|---------|-------|--------|-----------------|-----------|
| 278 | The Shawshank Redemption | ✅ Working | 21.4s (first), 8.2s (cached) | 18 tracks |

### TV Shows Tested

| TMDB ID | Title | Episode | Status | Extraction Time | Subtitles |
|---------|-------|---------|--------|-----------------|-----------|
| 1396 | Breaking Bad | S01E01 | ✅ Working | 15.4s | 40 tracks |

### Quality Levels Detected
- Auto (adaptive)
- 360p
- 720p
- 1080p

---

## 12. Configuration

### Environment Variables

#### Backend (`backend/.env`)
```bash
PORT=3001  # Optional, defaults to 3001
```

#### Frontend (`.env.local`)
```bash
VITE_SCRAPER_URL=http://localhost:3001/api/extract
VITE_PROXY_WORKER_URL=http://localhost:8787  # Optional fallback
```

### Timeouts

| Location | Variable | Default | Purpose |
|----------|----------|---------|---------|
| Backend | Page navigation | 30000ms | Max time to load vidsrc.cc |
| Backend | M3U8 wait | 15000ms | Max time to capture m3u8 (30 retries × 500ms) |
| Frontend | SCRAPER_CONFIG.timeout | 45000ms | Max time waiting for backend |

### Cache Settings

| Setting | Value | Location |
|---------|-------|----------|
| TTL | 30 minutes | `backend/scraper.js` line 31 |
| Storage | In-memory Map | Not persistent across restarts |

---

## 13. Known Limitations

### Performance
1. **Single-threaded** - No request queuing
2. **Memory intensive** - Each extraction uses 150-300MB (browser instance)
3. **Slow first extraction** - 15-25 seconds (browser cold start)

### Reliability
1. **No retry logic** - If extraction fails, it just returns error
2. **Cache not persistent** - Lost on server restart
3. **Single point of failure** - Backend must be running

### Compatibility
1. **Depends on vidsrc.cc** - If they change, scraper may break
2. **M3U8 URL expiry** - URLs may expire after some time (cached 30 min)

### Not Implemented
1. Multiple server fallback (only uses first server)
2. Request rate limiting
3. Concurrent extraction limits
4. Persistent cache (Redis/database)

---

## 14. Troubleshooting

### Issue: Blank screen when playing video

**Cause 1:** Backend not running
```bash
# Check if backend is running
curl http://localhost:3001/health

# If not, start it:
cd backend && npm start
```

**Cause 2:** Old frontend code (NativePlayer bug)
```bash
# Hard refresh browser
Ctrl + Shift + R

# Or clear node_modules and reinstall
rm -rf node_modules && npm install
```

**Cause 3:** hls.js not loading proxied m3u8
- Check browser console for errors
- Verify `/api/proxy/m3u8` is returning valid m3u8 content

### Issue: Extraction times out

**Possible causes:**
1. vidsrc.cc is slow/down
2. Network issues
3. Chromium failed to launch

**Solution:**
```bash
# Check backend logs for errors
# Increase timeout in scraper.js line 151:
timeout: 60000  # Increase from 30000
```

### Issue: "Executable doesn't exist" error

**Cause:** Playwright Chromium not installed

**Solution:**
```bash
cd backend
npx playwright install chromium
```

### Issue: CORS errors in browser

**Cause:** Frontend calling m3u8 directly instead of through proxy

**Solution:** Ensure `streamExtractor.ts` is proxying the URL:
```typescript
const proxiedM3u8Url = `${scraperBaseUrl}/api/proxy/m3u8?url=${encodeURIComponent(data.m3u8Url)}`;
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 6, 2025 | AI Assistant (Cascade) | Initial documentation |

---

## Quick Reference

### Start Everything
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
npm run dev
```

### Test Extraction Manually
```bash
# Movie
curl "http://localhost:3001/api/extract?tmdbId=278&type=movie"

# TV Show
curl "http://localhost:3001/api/extract?tmdbId=1396&type=tv&season=1&episode=1"
```

### Key Files
- **Backend entry:** `backend/scraper.js`
- **Frontend extractor:** `src/services/streamExtractor.ts`
- **Video player:** `src/components/common/NativePlayer.tsx`
- **Movie integration:** `src/components/pages/MovieDetail/MovieDetail.tsx`
- **TV integration:** `src/components/pages/TVDetail/TVDetail.tsx`
