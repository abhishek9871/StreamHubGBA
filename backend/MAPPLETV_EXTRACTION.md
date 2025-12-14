# MappletTV M3U8 Extraction - Technical Documentation

## Overview

This document describes how to extract M3U8 streaming URLs from **MappletTV** (mappletv.uk / mapple.uk) for use in the FlixNest streaming application.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Flow Diagram](#flow-diagram)
3. [API Reference](#api-reference)
4. [Technical Details](#technical-details)
5. [M3U8 URL Structure](#m3u8-url-structure)
6. [Integration Guide](#integration-guide)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   FlixNest      │────▶│   Backend        │────▶│   MappletTV     │
│   Frontend      │     │   Scraper        │     │   (mapple.uk)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                         │
                               │                         ▼
                               │                 ┌───────────────────┐
                               │                 │ proxy.heistotron  │
                               │                 │ .uk (CDN Proxy)   │
                               ▼                 └───────────────────┘
                        ┌──────────────────┐             │
                        │   Video Player   │◀────────────┘
                        │   (HLS.js)       │     (M3U8 Stream)
                        └──────────────────┘
```

---

## Flow Diagram

```
1. User requests movie/TV show
           ↓
2. Frontend calls: GET /api/mappletv/extract?tmdbId=X&type=movie
           ↓
3. Backend launches puppeteer-real-browser (Stealth Mode)
           ↓
4. Navigate to: https://mappletv.uk/watch/movie/{tmdbId}?autoPlay=true
           ↓
5. Page redirects to: https://mapple.uk/watch/movie/{tmdbId}
           ↓
6. Wait for Cloudflare/Turnstile bypass
           ↓
7. Click play button / video element
           ↓
8. Intercept network responses for .m3u8 URLs
           ↓
9. Return M3U8 URL to frontend
           ↓
10. Frontend plays video using HLS.js
```

---

## API Reference

### Extract M3U8 Endpoint

**URL:** `GET /api/mappletv/extract`

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| tmdbId    | number | Yes      | TMDB ID of the content   |
| type      | string | Yes      | `movie` or `tv`          |
| season    | number | No*      | Season number (for TV)   |
| episode   | number | No*      | Episode number (for TV)  |

*Required if `type=tv`

**Example Requests:**

```bash
# Movie
curl "http://localhost:7860/api/mappletv/extract?tmdbId=812583&type=movie"

# TV Show
curl "http://localhost:7860/api/mappletv/extract?tmdbId=1396&type=tv&season=1&episode=1"
```

**Success Response:**

```json
{
  "success": true,
  "m3u8Url": "https://proxy.heistotron.uk/p/aHR0cHM6Ly...",
  "referer": "https://mapple.uk/",
  "provider": "mappletv",
  "qualities": ["1080p", "720p", "480p"],
  "qualityDetails": [
    {
      "resolution": "1920x1080",
      "quality": "1080p",
      "bandwidth": 4500000,
      "url": "https://proxy.heistotron.uk/p/..."
    }
  ],
  "subtitles": [
    {
      "label": "English [CC]",
      "language": "eng",
      "file": "https://proxy.heistotron.uk/p/..."
    }
  ]
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Could not extract M3U8 URL",
  "debug": {
    "finalUrl": "https://mapple.uk/...",
    "title": "Page Title"
  }
}
```

---

## Technical Details

### Dependencies

```json
{
  "dependencies": {
    "puppeteer-real-browser": "^1.x.x",
    "express": "^4.x.x",
    "cors": "^2.x.x",
    "axios": "^1.x.x"
  }
}
```

### Browser Configuration

The scraper uses `puppeteer-real-browser` with these settings:

```javascript
const { browser, page } = await connect({
    headless: false,    // MUST be visible for bot detection bypass
    turnstile: true,    // Handle Cloudflare Turnstile challenges
    fingerprint: true,  // Anti-fingerprint detection
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,720'
    ]
});
```

**Important:** The browser MUST run in headed mode (visible) to bypass bot detection.

### Detection Bypass

MappletTV uses several anti-bot measures:

1. **disable-devtool.js** - Blocks developer tools
2. **Cloudflare Turnstile** - Challenge verification
3. **User-agent verification** - Checks for real browser

Our scraper bypasses these using:
- Real browser automation (puppeteer-real-browser)
- Turnstile solver integration
- Human-like mouse movements
- Popup tab interception

---

## M3U8 URL Structure

### Proxied URL Format

The M3U8 URLs are proxied through `proxy.heistotron.uk`:

```
https://proxy.heistotron.uk/p/{base64_encoded_url}
```

### Decoded URL Structure

When decoded, the base64 reveals:

```
https://proxy.heistotron.uk/api/proxy/m3u8?url={encoded_source_url}&source=sakura|anananaPuTangInaMoPonananananaBatman!
```

### Actual Source

The real video source is **vixsrc.to**:

```
https://vixsrc.to/playlist/{id}?b=1&token={token}&expires={timestamp}&h=1&lang=en
```

### URL Parameters

| Parameter | Description                          |
|-----------|--------------------------------------|
| id        | Internal content ID                  |
| token     | Dynamic authentication token         |
| expires   | Unix timestamp for token expiration  |
| b         | Buffer setting (always 1)            |
| lang      | Subtitle language preference         |

### Token Lifetime

Tokens expire after a set time (typically ~30 days based on the `expires` value). A new token is generated each time the page is scraped.

---

## Integration Guide

### Frontend Integration (React/TypeScript)

```typescript
// services/mappletv.ts

const SCRAPER_BASE = 'http://your-backend-url:7860';

interface StreamResponse {
  success: boolean;
  m3u8Url?: string;
  referer?: string;
  qualities?: string[];
  subtitles?: Array<{
    label: string;
    language: string;
    file: string;
  }>;
  error?: string;
}

export async function getMappleTVStream(
  tmdbId: number, 
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<StreamResponse> {
  const params = new URLSearchParams({
    tmdbId: tmdbId.toString(),
    type
  });
  
  if (type === 'tv' && season && episode) {
    params.append('season', season.toString());
    params.append('episode', episode.toString());
  }
  
  const response = await fetch(`${SCRAPER_BASE}/api/mappletv/extract?${params}`);
  return response.json();
}
```

### Player Integration (HLS.js)

```typescript
import Hls from 'hls.js';

async function playVideo(tmdbId: number) {
  const stream = await getMappleTVStream(tmdbId, 'movie');
  
  if (!stream.success || !stream.m3u8Url) {
    throw new Error('Failed to get stream');
  }
  
  const video = document.getElementById('video-player') as HTMLVideoElement;
  
  if (Hls.isSupported()) {
    const hls = new Hls({
      xhrSetup: (xhr) => {
        // Set referer for CORS
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      }
    });
    
    hls.loadSource(stream.m3u8Url);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play();
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    video.src = stream.m3u8Url;
    video.play();
  }
}
```

### Subtitle Integration

```typescript
// Add subtitles to video player
function addSubtitles(video: HTMLVideoElement, subtitles: Array<{label: string, file: string, language: string}>) {
  subtitles.forEach((sub, index) => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.language;
    track.src = sub.file;
    if (index === 0) track.default = true;
    video.appendChild(track);
  });
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Browser launch failed"

**Cause:** Chrome/Chromium not installed or path issues.

**Solution:**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y chromium-browser

# Or use puppeteer's bundled Chrome
npm install puppeteer
```

#### 2. "No M3U8 URLs found"

**Cause:** Bot detection triggered or page structure changed.

**Solutions:**
- Ensure browser is running in headed mode (`headless: false`)
- Increase wait time before clicking play
- Check if MappletTV has updated their protection

#### 3. "Cloudflare challenge not bypassing"

**Cause:** Turnstile solver failing.

**Solutions:**
- Ensure `turnstile: true` is set
- Add human-like mouse movements
- Increase wait time after page load

#### 4. Token expired errors

**Cause:** The M3U8 URL token has expired.

**Solution:** Tokens are valid for ~30 days. Re-scrape to get a fresh token.

### Debugging

Enable verbose logging:

```javascript
console.log('[Debug] Current URL:', page.url());
console.log('[Debug] Page title:', await page.title());
console.log('[Debug] Frames:', page.frames().map(f => f.url()));
```

### Performance Optimization

1. **Reuse browser instance** - Don't create new browser for each request
2. **Cache M3U8 URLs** - Store with TTL matching token expiration
3. **Parallel extraction** - Use multiple browser pages for concurrent requests

---

## Security Considerations

1. **Token Security:** M3U8 tokens should not be exposed to end users unnecessarily
2. **Rate Limiting:** Implement rate limiting to avoid IP bans
3. **Proxy Usage:** Consider using rotating proxies for high-volume usage
4. **Legal Compliance:** Ensure usage complies with applicable laws

---

## Changelog

| Date       | Version | Changes                                    |
|------------|---------|--------------------------------------------|
| 2024-12-14 | 1.0.0   | Initial documentation                      |
|            |         | - MappletTV extraction working             |
|            |         | - 1080p/720p/480p quality support          |
|            |         | - Multi-language subtitle support          |

---

## Credits

- **puppeteer-real-browser** - For stealth browser automation
- **vixsrc.to** - Upstream video source
- **proxy.heistotron.uk** - CDN proxy service
