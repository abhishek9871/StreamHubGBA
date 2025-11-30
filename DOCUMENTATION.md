# FlixNest - Project Documentation

## Overview

**FlixNest** (originally named "SteamHub" then "StreamHub") is a modern streaming web application built with **React 18**, **TypeScript**, **Vite**, and **TailwindCSS**. It aggregates movie and TV show content using the **TMDB API** for metadata and **vidsrc.cc** for streaming.

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
│   │       │   ├── MovieDetail.tsx
│   │       │   └── CastCard.tsx
│   │       ├── TVDetail/
│   │       │   ├── TVDetail.tsx
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
│   │   ├── vidsrc.ts
│   │   └── storage.ts
│   ├── utils/               # Utility functions
│   │   └── constants.ts
│   ├── types.ts             # TypeScript type definitions
│   └── App.tsx              # Main application component
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
2. **Movie Details** - Full movie information, cast, similar movies, play button
3. **TV Show Details** - Show info, season/episode selector, watch progress tracking
4. **Video Player** - Embedded vidsrc.cc player for streaming
5. **Search** - Multi-search for movies and TV shows
6. **Watchlist** - Save movies/shows to personal watchlist
7. **Episode Tracking** - Mark TV episodes as watched
8. **Settings** - Clear watchlist and watch history

### Technical Features
- **Lazy Loading** - Route-based code splitting for performance
- **Error Boundary** - Graceful error handling
- **localStorage Persistence** - Watchlist and watch history saved locally
- **Cross-tab Sync** - localStorage changes sync across browser tabs
- **Mobile Responsive** - Full mobile support with hamburger menu
- **Toast Notifications** - User feedback for actions

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

### VidSrc Service (`src/services/vidsrc.ts`)
- `getMovieStreamUrl()` - Get streaming URL for movies
- `getTvStreamUrl()` - Get streaming URL for TV episodes

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
| VidSrc | `https://vidsrc.cc/v2/embed` | Video streaming |

---

## License

This project is for educational and demonstration purposes only. It is not affiliated with TMDB or any streaming providers.
