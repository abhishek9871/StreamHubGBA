# FlixNest - Project Documentation

## Overview

**FlixNest** (originally named "SteamHub" then "StreamHub") is a modern streaming web application built with **React 18**, **TypeScript**, **Vite**, and **TailwindCSS**. It aggregates movie and TV show content using the **TMDB API** for metadata and **MappletTV** for high-quality M3U8 streaming (with VidSrc.cc as fallback).

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| TypeScript | ~5.8.2 | Type Safety |
| Vite | ^6.2.0 | Build Tool & Dev Server |
| TailwindCSS | CDN | Styling |
| React Router DOM | 6.23.1 | Client-side Routing (HashRouter) |
| Axios | 1.7.2 | HTTP Client |
| React Toastify | 10.0.5 | Toast Notifications |
| React Icons | ^5.5.0 | Icon Library (FontAwesome) |
| **hls.js** | ^1.5.0 | HLS/M3U8 Video Playback |
| **puppeteer-real-browser** | Latest | Backend: Stealth Browser Automation |
| **Express** | ^4.18.0 | Backend: API Server |

---

## Project Structure

```
FlixNest/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   │   ├── Button.tsx
│   │   │   ├── ContentCard.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── HLSPlayer.tsx       # NEW: HLS.js video player for M3U8 streams
│   │   │   ├── Loader.tsx
│   │   │   └── SkeletonCard.tsx
│   │   ├── layout/          # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   └── Header.tsx
│   │   └── pages/           # Page components
│   │       ├── Home/
│   │       │   ├── Home.tsx
│   │       │   ├── HeroSection.tsx
│   │       │   └── ContentCarousel.tsx
│   │       ├── MovieDetail/
│   │       │   ├── MovieDetail.tsx  # Uses HLSPlayer for direct playback
│   │       │   └── CastCard.tsx
│   │       ├── TVDetail/
│   │       │   ├── TVDetail.tsx     # Uses HLSPlayer for direct playback
│   │       │   └── EpisodeCard.tsx
│   │       ├── Settings/
│   │       │   └── Settings.tsx
│   │       ├── PlayerPage.tsx
│   │       ├── SearchPage.tsx
│   │       └── WatchlistPage.tsx
│   ├── context/             # React Context providers
│   │   ├── WatchlistContext.tsx
│   │   └── WatchedEpisodesContext.tsx
│   ├── hooks/               # Custom hooks
│   │   └── useLocalStorage.ts
│   ├── services/            # API service modules
│   │   ├── tmdb.ts
│   │   ├── vidsrc.ts        # Legacy iframe player (fallback)
│   │   ├── mappletv.ts      # NEW: MappletTV M3U8 extraction service
│   │   └── storage.ts
│   ├── utils/               # Utility functions
│   │   ├── constants.ts
│   │   └── adBlocker.ts     # Ad blocking utilities
│   ├── types.ts             # TypeScript type definitions
│   └── App.tsx              # Main application component
├── backend/                 # NEW: Backend scraper server
│   ├── mappletv-scraper.js  # Puppeteer-based M3U8 extractor + proxy
│   ├── package.json
│   └── MAPPLETV_EXTRACTION.md
├── index.html               # Main HTML file
├── index.tsx                # React entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Features

### Core Features
1. **Home Page** - Hero carousel with trending content + multiple content carousels
2. **Movie Details** - Full movie information, cast, similar movies, inline HLS player
3. **TV Show Details** - Show info, season/episode selector, watch progress tracking, inline HLS player
4. **Video Player** - Two modes:
   - **HLS Player** (Primary) - Direct M3U8 streaming via MappletTV with quality selection
   - **VidSrc Iframe** (Fallback) - Embedded vidsrc.cc player
5. **Search** - Multi-search for movies and TV shows
6. **Watchlist** - Save movies/shows to personal watchlist
7. **Episode Tracking** - Mark TV episodes as watched
8. **Settings** - Clear watchlist and watch history

### Technical Features
- **HLS.js Integration** - Direct M3U8 playback with quality switching
- **Backend Proxy** - CORS bypass for M3U8 and video segments
- **Lazy Loading** - Route-based code splitting for performance
- **Error Boundary** - Graceful error handling
- **localStorage Persistence** - Watchlist and watch history saved locally
- **Cross-tab Sync** - localStorage changes sync across browser tabs
- **Mobile Responsive** - Full mobile support with hamburger menu
- **Toast Notifications** - User feedback for actions
- **Ad Blocking** - Built-in ad and popup blocking system

---

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Home | Landing page with content carousels |
| `/movie/:id` | MovieDetail | Movie details page |
| `/tv/:id` | TVDetail | TV show details page |
| `/play/:type/:id` | PlayerPage | Video player (type: movie/tv) |
| `/search` | SearchPage | Search results page |
| `/watchlist` | WatchlistPage | User's saved content |
| `/settings` | SettingsPage | App settings and data management |

---

## API Services

### TMDB API (`src/services/tmdb.ts`)
- `getTrending()` - Get trending movies/TV shows
- `getTrendingAll()` - Get all trending content
- `getPopularMovies()` - Get popular movies
- `getTopRatedMovies()` - Get top-rated movies
- `getPopularTVShows()` - Get popular TV shows
- `getTopRatedTVShows()` - Get top-rated TV shows
- `getMovieDetails()` - Get movie details with credits and similar
- `getTVShowDetails()` - Get TV show details with credits and similar
- `getSeasonDetails()` - Get season episodes
- `searchMulti()` - Search movies and TV shows

### VidSrc Service (`src/services/vidsrc.ts`) - *Legacy*
- `getMovieStreamUrl()` - Get streaming URL for movies (iframe-based)
- `getTvStreamUrl()` - Get streaming URL for TV episodes (iframe-based)

### MappletTV Service (`src/services/mappletv.ts`) - *Primary*
The primary streaming service that extracts M3U8 URLs from MappletTV.

**Functions:**
- `getMappleTVStream(tmdbId, type, season?, episode?)` - Extract M3U8 stream URL
- `getProxiedUrl(m3u8Url, referer)` - Generate proxied URL for CORS bypass

**Response Interface:**
```typescript
interface MappleTVResponse {
  success: boolean;
  m3u8Url?: string;
  referer?: string;
  provider?: string;
  qualities?: StreamQuality[];
  subtitles?: Subtitle[];
  error?: string;
}
```

**Features:**
- 2-minute timeout using AbortController
- Verbose logging for debugging
- Automatic URL proxying for CORS bypass

---

## Design System

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| bg-primary | `#0A0E14` | Main background |
| bg-secondary | `#141821` | Secondary background |
| surface | `#1A1F2E` | Card backgrounds |
| surface-hover | `#242938` | Hover states |
| accent-primary | `#E50914` | Primary accent (Netflix red) |
| accent-secondary | `#00A8E8` | Secondary accent (blue) |
| text-primary | `#FFFFFF` | Primary text |
| text-secondary | `#A0AEC0` | Secondary text |
| text-muted | `#718096` | Muted text |
| success | `#10B981` | Success states |
| error | `#EF4444` | Error states |
| warning | `#F59E0B` | Warning states |

### Typography
- **Body Font**: Inter
- **Heading Font**: Poppins

---

## Git Commit History

| Commit | Date | Description |
|--------|------|-------------|
| `a70a835` | Oct 6, 2025 | Initial commit |
| `bb209c8` | Oct 6, 2025 | Initialize project with Vite and dependencies |
| `6074cb3` | Oct 6, 2025 | Refactor routing and component structure |
| `b9f818e` | Oct 6, 2025 | Rename PlayerPage component and update routing |
| `9b21b04` | Oct 6, 2025 | Implement home page content and styling |
| `aa4d042` | Oct 6, 2025 | Implement dedicated movie and TV show detail pages |
| `6e64608` | Oct 6, 2025 | Add settings page and watchlist/history clearing |
| `d77c16a` | Oct 6, 2025 | Improve performance with lazy loading |
| `980acf0` | Oct 6, 2025 | Fix HeroSection pagination and ErrorBoundary |
| `7322e83` | Oct 6, 2025 | Improve carousel controls and error boundary |
| `6e6653e` | Oct 6, 2025 | Adjust detail page layout for poster visibility |
| `3c8e849` | Oct 6, 2025 | Fix React imports and min-height on detail pages |
| `2e3b2dc` | Oct 6, 2025 | Adjust padding and React imports |
| `352f965` | Oct 6, 2025 | Implement mobile responsive header |
| `08426b3` | Oct 6, 2025 | Improve persistence and context handling |
| `92bc5f5` | Oct 6, 2025 | Improve ErrorBoundary and useLocalStorage hook |
| `06d8bca` | Oct 6, 2025 | Fix clearWatchlist() with proper state clearing |
| `95f6529` | Oct 7, 2025 | Site rename to FlixNest |
| `14bef32` | Nov 30, 2025 | Fix: Remove sandbox attribute for video playback |

---

## Deployment Guide

### Cloudflare Pages Deployment

The project is deployed to **Cloudflare Pages** using the **Wrangler CLI**.

#### Project Information
- **Project Name**: `flixnest`
- **Production Domain**: `flixnest.pages.dev`
- **Production Branch**: `production`
- **Preview Branch**: `main`

#### Prerequisites
1. Wrangler CLI installed (`npm install -g wrangler` or use `npx`)
2. Authenticated with Cloudflare (`npx wrangler login`)

#### Build the Project
```bash
npm run build
```

#### Deploy to Production
```bash
npx wrangler pages deploy dist --project-name=flixnest --branch=production
```

#### Deploy to Preview (for testing)
```bash
npx wrangler pages deploy dist --project-name=flixnest --branch=main
```

#### Useful Wrangler Commands

**List all projects:**
```bash
npx wrangler pages project list
```

**List deployments for a project:**
```bash
npx wrangler pages deployment list --project-name=flixnest
```

**List deployments as JSON (for scripting):**
```bash
npx wrangler pages deployment list --project-name=flixnest --json
```

### Important Notes

1. **Branch Configuration**:
   - `--branch=production` → Updates the main `flixnest.pages.dev` domain
   - `--branch=main` → Updates preview URLs only (e.g., `d8e18699.flixnest.pages.dev`)

2. **Always build before deploying**: The `dist` folder must contain the latest build.

3. **Cache**: Cloudflare may cache old versions. Use hard refresh (Ctrl+Shift+R) or wait a few minutes after deployment.

---

## Known Issues & Fixes

### Issue: "Please Disable Sandbox" Error on Video Player

**Problem**: Videos wouldn't play, showing "Oops! Please Disable Sandbox" message from vidsrc.cc.

**Root Cause**: The iframe had a restrictive `sandbox` attribute that blocked vidsrc.cc functionality:
```tsx
sandbox="allow-same-origin allow-scripts allow-forms allow-presentation"
```

**Solution**: Removed the `sandbox` attribute from the iframe in `PlayerPage.tsx`:
```tsx
<iframe
  src={streamUrl}
  className="absolute top-0 left-0 w-full h-full"
  title="Video Player"
  frameBorder="0"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
  allowFullScreen
  referrerPolicy="origin"
/>
```

---

### Issue: Popup Ads Opening New Tabs

**Problem**: When users interact with the video player (click to play, pause, seek), popup ads would open in new browser tabs, disrupting the viewing experience.

**Root Cause**: vidsrc.cc injects ad triggers on user interactions within the iframe. Since the iframe is cross-origin, we cannot directly block these triggers.

**Solution**: Implemented an **Auto-Focus Recovery System** in `PlayerPage.tsx`:

```tsx
// Popup/Ad detection: When window loses focus (popup opened), refocus immediately
useEffect(() => {
  const handleBlur = () => {
    const now = Date.now();
    if (now - lastBlurTime.current > 500) {
      lastBlurTime.current = now;
      setTimeout(() => {
        window.focus();
        setAdsBlocked(prev => prev + 1);
      }, 100);
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setTimeout(() => window.focus(), 100);
    }
  };

  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

**How it works**:
1. **No blocking overlay** - Users can interact with video controls immediately
2. **Blur detection** - When a popup opens, our window loses focus (blur event fires)
3. **Auto-refocus** - We immediately call `window.focus()` to bring attention back to our tab
4. **Subtle notification** - "Ad blocked (N)" appears briefly in the corner
5. **Full video control** - Play, pause, seek, quality, volume, fullscreen all work normally

**Result**: Popup ads are effectively blocked - they may open in the background but the user stays on our tab and doesn't notice the interruption.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_TMDB_API_KEY` | TMDB API Key | Fallback key provided |

To use your own TMDB API key, create a `.env` file:
```
REACT_APP_TMDB_API_KEY=your_api_key_here
```

---

## Local Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## External Services

| Service | URL | Purpose |
|---------|-----|---------|
| TMDB API | `https://api.themoviedb.org/3` | Movie/TV metadata |
| TMDB Images | `https://image.tmdb.org/t/p` | Poster and backdrop images |
| VidSrc | `https://vidsrc.cc/v2/embed` | Video streaming (legacy) |
| **MappletTV** | `https://mappletv.uk` / `https://mapple.uk` | Primary video streaming (1080p) |
| VixSrc | `https://vixsrc.to` | Backend video source for MappletTV |

---

## MappletTV Integration - Complete Guide

### Overview

FlixNest has been upgraded to use **MappletTV** as the primary streaming provider, replacing the legacy VidSrc iframe-based player. This provides:

- **Direct HLS playback** using hls.js (no iframes)
- **1080p, 720p, 480p** quality options
- **Multi-language audio** (English, Italian, etc.)
- **Subtitles** in 10+ languages
- **No ads or popups** in the player interface

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend Scraper    │     │   MappletTV     │
│   (React)       │────▶│   (Node.js/Puppeteer)│────▶│   (mappletv.uk) │
│                 │     │   Port 7860          │     │                 │
├─────────────────┤     ├──────────────────────┤     └─────────────────┘
│ MovieDetail.tsx │     │ /api/mappletv/extract│              │
│ TVDetail.tsx    │     │ /api/proxy/m3u8      │◀─────────────┘
│ HLSPlayer.tsx   │     │ /api/proxy/segment   │     M3U8 + Segments
│ mappletv.ts     │     └──────────────────────┘
└─────────────────┘
```

### Components

#### 1. Backend Scraper (`backend/mappletv-scraper.js`)

A Node.js Express server using `puppeteer-real-browser` to extract M3U8 URLs.

**Why Puppeteer?**
- MappletTV uses anti-bot protection that blocks simple HTTP requests
- Puppeteer launches a real Chrome instance that bypasses these protections
- Uses stealth plugins to avoid detection

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mappletv/extract` | GET | Extract M3U8 URL for a movie/TV show |
| `/api/proxy/m3u8` | GET | Proxy M3U8 playlists and rewrite URLs |
| `/api/proxy/segment` | GET | Proxy video/audio segments |
| `/health` | GET | Health check |

**Extraction Process:**
1. Puppeteer navigates to `https://mappletv.uk/watch/{type}/{tmdbId}`
2. Intercepts network requests for `.m3u8` files
3. Captures the first M3U8 URL found (from `proxy.heistotron.uk`)
4. Returns the URL along with referer and metadata

**M3U8 Proxy Logic:**
The proxy rewrites all URLs inside M3U8 playlists to go through our backend:
- Lines after `#EXT-X-STREAM-INF:` → Proxied via `/api/proxy/m3u8`
- `URI=` in `#EXT-X-MEDIA:` → Proxied via `/api/proxy/m3u8`
- Segment files (`.ts`, `.aac`) → Proxied via `/api/proxy/segment`

This is necessary because:
- The original M3U8 URLs reference `proxy.heistotron.uk`
- Browser CORS blocks direct requests to this domain
- Our backend proxies all requests through `localhost:7860`

**Running the Backend:**
```bash
cd backend
npm install
node mappletv-scraper.js
# Server runs on http://localhost:7860
```

#### 2. Frontend Service (`src/services/mappletv.ts`)

TypeScript service for communicating with the backend scraper.

**Key Features:**
- **AbortController** with 2-minute timeout to prevent hanging requests
- **Verbose logging** with emoji prefixes for easy debugging
- **URL proxying** via `getProxiedUrl()` function

**Example Usage:**
```typescript
import mappleTVService from './services/mappletv';

const response = await mappleTVService.getMappleTVStream(812583, 'movie');
if (response.success && response.m3u8Url) {
  const proxiedUrl = mappleTVService.getProxiedUrl(response.m3u8Url, response.referer);
  // Use proxiedUrl with HLSPlayer
}
```

#### 3. HLS Player Component (`src/components/common/HLSPlayer.tsx`)

A custom video player built with **hls.js** for M3U8 playback.

**Features:**
- Quality switching (auto/manual)
- Subtitle selection
- Volume controls
- Fullscreen support
- Progress bar with buffering indicator
- Play/pause/seek controls
- Keyboard shortcuts

**React Strict Mode Handling:**
The component uses `requestAnimationFrame` + `setTimeout` to delay HLS initialization, preventing race conditions caused by React Strict Mode's double-mount behavior.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `src` | string | M3U8 URL (proxied) |
| `referer` | string | Original referer for backend proxy |
| `subtitles` | Subtitle[] | Available subtitle tracks |
| `onBack` | () => void | Callback when back button is pressed |
| `autoPlay` | boolean | Auto-play on load |
| `title` | string | Video title for display |

#### 4. Movie/TV Detail Pages

Both `MovieDetail.tsx` and `TVDetail.tsx` have been updated to:

1. Call `mappleTVService.getMappleTVStream()` when "Play" is clicked
2. Generate a proxied URL using `mappleTVService.getProxiedUrl()`
3. Render `HLSPlayer` with the proxied URL
4. Show loading state during extraction
5. Show error state if extraction fails

**Flow:**
```
User clicks "Play"
       ↓
setStreamLoading(true)
       ↓
mappleTVService.getMappleTVStream()
       ↓
Backend extracts M3U8 from MappletTV
       ↓
mappleTVService.getProxiedUrl()
       ↓
setHlsUrl(proxiedUrl)
       ↓
HLSPlayer renders with proxied URL
       ↓
hls.js loads manifest via /api/proxy/m3u8
       ↓
hls.js loads segments via /api/proxy/segment
       ↓
Video plays!
```

### Debugging

#### Console Log Prefixes

| Prefix | Source |
|--------|--------|
| `[MovieDetail]` | MovieDetail.tsx |
| `[TVDetail]` | TVDetail.tsx |
| `[MappletTV]` | mappletv.ts service |
| `[HLSPlayer]` | HLSPlayer component |
| `[HLS]` | hls.js events |
| `[Extract]` | Backend scraper |
| `[Proxy]` | Backend proxy |

#### Common Issues

**Issue: "Extracting stream..." hangs indefinitely**
- Check backend is running on port 7860
- Check network tab for failed requests
- Verify MappletTV.uk is accessible

**Issue: Video loads but doesn't play**
- Check console for HLS errors
- Verify M3U8 URLs are being proxied correctly
- Check for CORS errors in network tab

**Issue: React Strict Mode cleanup race condition**
- The HLSPlayer now uses delayed initialization
- Look for `[HLSPlayer] ⏰ Init callback fired` log

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SCRAPER_URL` | Backend scraper URL | `http://localhost:7860` |

### Current Status (December 2024)

**✅ FULLY WORKING:**
- ✅ Backend M3U8 extraction from MappletTV (~5-10 seconds)
- ✅ Backend proxy endpoints for M3U8 and segments
- ✅ URL rewriting in M3U8 playlists (dynamic protocol/host)
- ✅ Frontend service with timeout and logging
- ✅ HLSPlayer component with full controls
- ✅ Video playback working end-to-end
- ✅ Quality switching (1080p, 720p, 480p)
- ✅ Browser reuse for faster subsequent extractions

**Performance Optimizations Applied:**
- Backend: `domcontentloaded` instead of `networkidle2` for faster page load
- Backend: Reduced wait times (300ms page settle, 200ms polling)
- Backend: Skip quality parsing (HLS.js discovers automatically)
- Frontend: `lowLatencyMode: true` for faster start
- Frontend: Reduced buffer sizes for quicker initial playback
- Frontend: Correct HLS.js order (`attachMedia` → `loadSource`)

**Extraction Times:**
- First request: ~10-15 seconds (browser launch)
- Subsequent requests: ~5-8 seconds (browser reuse)

---

## License

This project is for educational and demonstration purposes only. It is not affiliated with TMDB or any streaming providers.
