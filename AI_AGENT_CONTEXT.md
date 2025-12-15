# FlixNest AI Agent Context File
> **Last Updated:** December 15, 2025
> **Single Source of Truth for AI Agents**

---

## 🎬 Project Overview

**FlixNest** is a streaming web application that extracts and plays M3U8 video streams from MappletTV.

| Component | Technology | Location |
|-----------|------------|----------|
| Frontend | React + Vite + TypeScript | `c:\Users\VASU\Downloads\Projects\FlixNest\src\` |
| Backend Scraper | Node.js + Puppeteer | Deployed on Hugging Face Spaces |
| Video Player | HLS.js (optimized) | `src/components/common/HLSPlayer.tsx` |

---

## 🚀 Backend: Hugging Face Deployment

### Live URL
```
https://abhishek1996-fluxnest.hf.space
```

### Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/mappletv/extract?tmdbId=XXX&type=movie` | Extract M3U8 + subtitles for movie |
| `GET /api/mappletv/extract?tmdbId=XXX&type=tv&season=1&episode=1` | Extract M3U8 + subtitles for TV |
| `GET /api/proxy/m3u8?url=...&referer=...` | Proxy M3U8 playlists (CORS bypass) |
| `GET /api/proxy/segment?url=...&referer=...` | Proxy video segments |
| `GET /api/proxy/subtitle?url=...&referer=...` | Proxy subtitle files (VTT/SRT) |
| `GET /health` | Health check |

### Backend Files (in `backend/` folder)
| File | Purpose |
|------|---------|
| `scraper.js` | Main scraper with MappletTV provider, copied from `mappletv-scraper.js` |
| `Dockerfile` | Docker config for Hugging Face Spaces |
| `package.json` | Dependencies and start script |

### Critical Dockerfile Detail
The `xvfb-run` command MUST have single quotes INSIDE the server-args string:
```dockerfile
# CORRECT ✅ (single quotes inside the value)
CMD ["xvfb-run", "--auto-servernum", "--server-args='-screen 0 1280x800x24'", "node", "scraper.js"]

# WRONG ❌ (no inner quotes - causes silent hang)
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x800x24", "node", "scraper.js"]
```

### Scraper Features
- Uses `puppeteer-real-browser` with `turnstile: true` for Cloudflare bypass
- Multi-server fallback (tries up to 4 servers)
- 90s navigation timeout, 30s per-server timeout
- Browser launched lazily on first request (NOT on startup)
- TV URL format: `https://mappletv.uk/watch/tv/{tmdbId}-{season}-{episode}?autoPlay=true`

---

## 🎥 Frontend: HLS Player

### Configuration (`src/components/common/HLSPlayer.tsx`)
- **OPTIMIZED for Fast Playback**:
  - Small initial buffer (15s) for quick start
  - Max buffer 30s (prevents over-buffering)
  - Fast timeouts (20s fragment, 15s manifest)
  - ABR mode with 1Mbps initial estimate
- **Seeking Optimization**:
  - HLS.js `startLoad(position)` for faster seeks
  - Proper seek event handling
  - 15s back-buffer for quick rewinds
- **Features**:
  - Quality selector (Auto + manual levels)
  - Subtitle support with track loading
  - Skip forward/backward buttons (10s)
  - Keyboard shortcuts (Space/K, arrows, M, F)
- **Error Recovery**:
  - 4 retries with 1s delay
  - Media error auto-recovery

### Proxy Bypass Optimization (`src/services/mappletv.ts`)
MappletTV returns URLs from CORS-enabled domains (heistotron.uk). The frontend **skips double-proxying** for these:
```typescript
const corsEnabledDomains = ['heistotron.uk', 'source.heistotron.uk', 'proxy.heistotron.uk'];
if (corsEnabledDomains.some(domain => urlLower.includes(domain))) {
    return originalUrl; // Use directly, skip our proxy
}
```

### Environment Variable
```
VITE_SCRAPER_URL=https://abhishek1996-fluxnest.hf.space
```
Set in `.env` file at project root.

---

## 📡 TMDB Integration

The frontend fetches movie/TV metadata from TMDB API. The TMDB API key and proxy worker configuration are in the @tmdb-proxy folder.

---

## 🔑 Key Files Summary

| File | Purpose |
|------|---------|
| `backend/scraper.js` | MappletTV scraper (deploy to HF) |
| `backend/Dockerfile` | HF Spaces Docker config |
| `src/services/mappletv.ts` | Frontend service for backend calls |
| `src/components/common/HLSPlayer.tsx` | Video player with HLS.js |
| `src/components/pages/MovieDetail/MovieDetail.tsx` | Movie playback page |
| `src/components/pages/TVDetail/TVDetail.tsx` | TV playback page |
| `.env` | Environment variables (VITE_SCRAPER_URL) |

---

## ⚠️ Known Issues & Solutions

### 1. Buffering/Loading Issues (FIXED)
**Cause**: Previous HLS.js config had excessive buffer sizes (60s+) causing slow start.
**Solution**:
- Reduced initial buffer to 15s for fast playback start
- Max buffer 30s to prevent over-buffering
- Faster timeouts (20s fragment vs previous 120s)
- ABR mode with 1Mbps initial estimate

### 2. Seeking Freezes (FIXED)
**Cause**: HLS.js not properly handling seek events.
**Solution**:
- Added `startLoad(position)` call on seek
- Proper seek event handlers (seeking/seeked)
- 15s back-buffer for quick rewinds

### 3. Missing Subtitles (FIXED)
**Cause**: Backend had `parseSubtitles()` but never called it.
**Solution**:
- Backend now fetches M3U8 content and parses subtitles
- New `/api/proxy/subtitle` endpoint for CORS bypass
- Frontend loads subtitles into video text tracks

### 4. Cloudflare Blocking
**Solution**: `puppeteer-real-browser` with `turnstile: true` + `xvfb-run` for non-headless mode.

### 5. HTTPS Protocol Detection on HF
**Cause**: HF reverse proxy reports `http` to backend.
**Solution**: Force HTTPS when `host.includes('hf.space')` in proxy URL generation.

---

## 🛠️ Development Commands

```bash
# Frontend
cd c:\Users\VASU\Downloads\Projects\FlixNest
npm run dev

# Backend (local testing)
cd backend
node scraper.js

# Deploy to Hugging Face
# Upload: Dockerfile, scraper.js, package.json, package-lock.json, README.md
```

---

## 📝 For Future AI Agents

1. **Backend changes**: Edit `backend/scraper.js`, then upload to HF Spaces
2. **Frontend changes**: Files auto-reload with Vite dev server
3. **Testing extraction**: `https://abhishek1996-fluxnest.hf.space/api/mappletv/extract?tmdbId=487670&type=movie`
4. **Health check**: `https://abhishek1996-fluxnest.hf.space/health`

**Current State** (December 2025):
- Extraction: Working
- Playback: OPTIMIZED - Fast start, smooth seeking
- Subtitles: Working - Extracted and displayed
- Quality: ABR mode with manual selector
- Keyboard shortcuts: Space, arrows, M, F

**Key HLS.js Settings** (for reference):
```javascript
{
  maxBufferLength: 15,        // Fast start
  maxMaxBufferLength: 30,     // Prevents over-buffering
  fragLoadingTimeOut: 20000,  // Quick recovery
  abrEwmaDefaultEstimate: 1000000  // 1Mbps start estimate
}
```
