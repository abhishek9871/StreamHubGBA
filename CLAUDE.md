# CLAUDE.md - AI Assistant Guide for FlixNest

> **Project Name**: FlixNest (formerly StreamHub/SteamHub)
> **Last Updated**: December 5, 2025
> **Purpose**: Comprehensive guide for AI assistants working with this codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Codebase Architecture](#codebase-architecture)
4. [File Structure](#file-structure)
5. [Key Conventions](#key-conventions)
6. [Development Workflow](#development-workflow)
7. [Common Patterns](#common-patterns)
8. [Git Workflow](#git-workflow)
9. [Deployment](#deployment)
10. [AI Assistant Guidelines](#ai-assistant-guidelines)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

FlixNest is a modern streaming web application built with React 18 and TypeScript that aggregates movie and TV show content. It provides a Netflix-like experience with:

- **Content Discovery**: Browse trending, popular, and top-rated movies/TV shows
- **Detailed Information**: View comprehensive metadata, cast, similar content
- **Watchlist Management**: Save and track content
- **Episode Tracking**: Mark individual TV episodes as watched
- **Embedded Streaming**: Watch content via vidsrc.cc integration
- **Advanced Ad Blocking**: Ultra-aggressive multi-layer ad blocker

### Data Sources

- **TMDB API**: Movie/TV metadata, images, search
- **VidSrc.cc**: Video streaming embed URLs

---

## Tech Stack

### Core Dependencies

```json
{
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "react-router-dom": "6.23.1",
  "typescript": "~5.8.2",
  "vite": "^6.2.0"
}
```

### Key Libraries

- **Routing**: React Router DOM 6 with `HashRouter`
- **HTTP Client**: Axios 1.7.2
- **Notifications**: React Toastify 10.0.5
- **Icons**: React Icons 5.5.0 (FontAwesome)
- **Styling**: TailwindCSS (via CDN)

### Build Tools

- **Vite**: Development server and production builds
- **TypeScript**: Type safety and intellisense
- **Wrangler**: Cloudflare Pages deployment

---

## Codebase Architecture

### Project Structure

```
StreamHubGBA/
├── src/                          # Main source directory
│   ├── components/
│   │   ├── common/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── ContentCard.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Loader.tsx
│   │   │   ├── ScrollToTop.tsx
│   │   │   └── SkeletonCard.tsx
│   │   ├── layout/              # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   └── Header.tsx
│   │   └── pages/               # Page components (route targets)
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
│   ├── context/                 # React Context providers
│   │   ├── WatchlistContext.tsx
│   │   └── WatchedEpisodesContext.tsx
│   ├── hooks/                   # Custom React hooks
│   │   └── useLocalStorage.ts
│   ├── services/                # API service modules
│   │   ├── tmdb.ts             # TMDB API client
│   │   ├── vidsrc.ts           # VidSrc embed URLs
│   │   └── storage.ts          # localStorage utilities
│   ├── utils/                   # Utility functions
│   │   ├── constants.ts
│   │   └── adBlocker.ts        # Ad blocking system
│   ├── types.ts                # Global TypeScript types
│   └── App.tsx                 # Root application component
├── index.tsx                    # React entry point
├── index.html                   # HTML template
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
├── metadata.json               # Project metadata
├── README.md                   # User documentation
└── DOCUMENTATION.md            # Developer documentation
```

### Architectural Patterns

#### 1. Component Organization

- **Common Components**: Reusable UI elements (buttons, cards, loaders)
- **Layout Components**: Structural wrappers (header, app layout)
- **Page Components**: Route-specific views (home, detail pages)

#### 2. State Management

- **React Context**: Global state (watchlist, watched episodes)
- **Local State**: Component-specific state with `useState`
- **localStorage**: Persistent data (watchlist, watch history)

#### 3. Routing

- **HashRouter**: Client-side routing without server config
- **Lazy Loading**: Route-based code splitting for performance
- **Routes**:
  - `/` - Home page
  - `/movie/:id` - Movie details
  - `/tv/:id` - TV show details
  - `/play/:type/:id` - Video player
  - `/search` - Search results
  - `/watchlist` - User's watchlist
  - `/settings` - Settings page

#### 4. Data Fetching

- **Axios**: HTTP client for API requests
- **Services Layer**: Abstracted API calls in `services/` directory
- **Error Handling**: Try-catch with user-friendly error messages

---

## File Structure

### Important Files

#### `src/App.tsx`

Root application component that:
- Sets up routing with HashRouter
- Provides context providers (Watchlist, WatchedEpisodes)
- Initializes ultra-aggressive ad blocker
- Implements error boundary and lazy loading

#### `src/types.ts`

Global TypeScript type definitions:
- `Movie`, `TVShow`, `MovieDetails`, `TVShowDetails`
- `Season`, `Episode`, `CastMember`
- `PaginatedResponse<T>`, `ContentItem`

#### `src/services/tmdb.ts`

TMDB API client with methods:
- `getTrending()`, `getTrendingAll()`
- `getPopularMovies()`, `getTopRatedMovies()`
- `getPopularTVShows()`, `getTopRatedTVShows()`
- `getMovieDetails()`, `getTVShowDetails()`
- `getSeasonDetails()`, `searchMulti()`

#### `src/services/vidsrc.ts`

VidSrc URL generator:
- `getMovieStreamUrl(tmdbId)` - Returns embed URL for movies
- `getTvStreamUrl(tmdbId, season, episode)` - Returns embed URL for TV episodes

#### `src/utils/adBlocker.ts`

Ultra-aggressive ad blocker system:
- Overrides `window.open` to block popups
- Intercepts clicks in capture phase
- Blocks suspicious URLs, downloads, timing attacks
- Mobile-optimized touch event handling
- Automatic focus recovery

#### `src/context/WatchlistContext.tsx`

Manages user's watchlist:
- `addToWatchlist()`, `removeFromWatchlist()`
- `isInWatchlist()`, `clearWatchlist()`
- Persists to localStorage
- Cross-tab synchronization

#### `src/context/WatchedEpisodesContext.tsx`

Tracks watched TV episodes:
- `markEpisodeWatched()`, `markEpisodeUnwatched()`
- `isEpisodeWatched()`, `clearWatchedEpisodes()`
- Persists to localStorage

---

## Key Conventions

### Code Style

#### TypeScript

- **Always use TypeScript**: No plain JavaScript files
- **Strict typing**: Define types for all props, state, API responses
- **Interface over type**: Use `interface` for object types
- **Export types**: Export types alongside components

#### React

- **Functional components**: Always use function components with hooks
- **Props destructuring**: Destructure props in function signature
- **Named exports**: Use named exports for components
- **Hooks order**: Follow hooks rules (order, conditional calls)

#### Naming Conventions

- **Components**: PascalCase (e.g., `ContentCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useLocalStorage.ts`)
- **Services**: camelCase (e.g., `tmdb.ts`, `vidsrc.ts`)
- **Utils**: camelCase (e.g., `constants.ts`)
- **Types**: PascalCase (e.g., `Movie`, `TVShowDetails`)

### File Organization

#### Component Files

```tsx
// Imports: React, libraries, local modules
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMovieDetails } from '@/src/services/tmdb';
import Button from '@/src/components/common/Button';

// Types/Interfaces
interface MovieDetailProps {
  id: number;
}

// Component
const MovieDetail: React.FC<MovieDetailProps> = ({ id }) => {
  // State
  const [movie, setMovie] = useState<MovieDetails | null>(null);

  // Effects
  useEffect(() => {
    // Fetch data
  }, [id]);

  // Render
  return <div>...</div>;
};

export default MovieDetail;
```

#### Service Files

```typescript
// Imports
import axios from 'axios';
import { Movie, PaginatedResponse } from '@/src/types';

// Constants
const API_KEY = 'xxx';
const BASE_URL = 'https://api.themoviedb.org/3';

// API functions
export const getPopularMovies = async (): Promise<PaginatedResponse<Movie>> => {
  const response = await axios.get(`${BASE_URL}/movie/popular`, {
    params: { api_key: API_KEY }
  });
  return response.data;
};
```

### Design System

#### Color Palette

```css
/* Background */
--bg-primary: #0A0E14      /* Main background */
--bg-secondary: #141821    /* Secondary background */
--surface: #1A1F2E         /* Card backgrounds */
--surface-hover: #242938   /* Hover states */

/* Accent */
--accent-primary: #E50914   /* Netflix red */
--accent-secondary: #00A8E8 /* Blue */

/* Text */
--text-primary: #FFFFFF     /* Primary text */
--text-secondary: #A0AEC0   /* Secondary text */
--text-muted: #718096       /* Muted text */

/* Status */
--success: #10B981          /* Success */
--error: #EF4444            /* Error */
--warning: #F59E0B          /* Warning */
```

#### Typography

- **Body Font**: Inter
- **Heading Font**: Poppins

---

## Development Workflow

### Setup

```bash
# Clone repository
git clone <repo-url>
cd StreamHubGBA

# Install dependencies
npm install

# Start development server
npm run dev
# Server runs on http://localhost:3000
```

### Development Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create `.env` file in root:

```env
REACT_APP_TMDB_API_KEY=your_tmdb_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here  # If needed
```

**Note**: The app has fallback API keys, but using your own is recommended.

---

## Common Patterns

### 1. Fetching Data in Components

```tsx
import { useState, useEffect } from 'react';
import { getMovieDetails } from '@/src/services/tmdb';
import { MovieDetails } from '@/src/types';
import Loader from '@/src/components/common/Loader';

const MovieDetail: React.FC<{ id: number }> = ({ id }) => {
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const data = await getMovieDetails(id);
        setMovie(data);
      } catch (err) {
        setError('Failed to load movie details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  if (loading) return <Loader />;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!movie) return null;

  return <div>{/* Render movie */}</div>;
};
```

### 2. Using Context

```tsx
import { useWatchlist } from '@/src/context/WatchlistContext';

const MovieCard: React.FC<{ movie: Movie }> = ({ movie }) => {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  const inWatchlist = isInWatchlist(movie.id, 'movie');

  const handleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie.id, 'movie');
    } else {
      addToWatchlist({
        id: movie.id,
        type: 'movie',
        title: movie.title,
        poster_path: movie.poster_path,
      });
    }
  };

  return (
    <div>
      <button onClick={handleWatchlist}>
        {inWatchlist ? 'Remove' : 'Add to Watchlist'}
      </button>
    </div>
  );
};
```

### 3. Routing and Navigation

```tsx
import { useNavigate, useParams } from 'react-router-dom';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handlePlayClick = () => {
    navigate(`/play/movie/${id}`);
  };

  return (
    <div>
      <button onClick={handlePlayClick}>Play Now</button>
    </div>
  );
};
```

### 4. localStorage Persistence

```tsx
import { useLocalStorage } from '@/src/hooks/useLocalStorage';

const Settings: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<string>('theme', 'dark');

  return (
    <div>
      <button onClick={() => setTheme('light')}>Light Theme</button>
      <button onClick={() => setTheme('dark')}>Dark Theme</button>
    </div>
  );
};
```

---

## Git Workflow

### Branch Strategy

- **Current Branch**: `claude/claude-md-mistvqilf43bda9j-01DhYjZE5iLE2wwJ26xS15TS`
- **Production Branch**: `production` (deployed to flixnest.pages.dev)
- **Preview Branch**: `main` (preview deployments)

### Commit Message Convention

Follow conventional commits style:

```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes (formatting)
- refactor: Code refactoring
- test: Test changes
- chore: Build/tooling changes
```

Examples:
```
feat: Add iframe click shield to block video player ads
fix: Remove sandbox attribute for video playback
docs: Update DOCUMENTATION.md with deployment guide
refactor: Extract ad blocker to separate utility
```

### Git Commands

```bash
# Check status
git status

# Stage changes
git add .

# Commit with message
git commit -m "feat: Add new feature"

# Push to remote
git push -u origin <branch-name>

# View commit history
git log --oneline -20

# View diff
git diff
git diff --staged
```

---

## Deployment

### Cloudflare Pages Deployment

**Project Name**: `flixnest`
**Production Domain**: `flixnest.pages.dev`

#### Deploy to Production

```bash
# Build the project
npm run build

# Deploy to production
npx wrangler pages deploy dist --project-name=flixnest --branch=production
```

#### Deploy to Preview

```bash
# Build the project
npm run build

# Deploy to preview
npx wrangler pages deploy dist --project-name=flixnest --branch=main
```

#### Useful Wrangler Commands

```bash
# List all projects
npx wrangler pages project list

# List deployments
npx wrangler pages deployment list --project-name=flixnest

# List deployments as JSON
npx wrangler pages deployment list --project-name=flixnest --json

# Login to Cloudflare
npx wrangler login
```

---

## AI Assistant Guidelines

### When Working with This Codebase

#### 1. Understanding the Project

- **Read DOCUMENTATION.md first**: Contains detailed project history, features, and known issues
- **Check recent commits**: Understand recent changes and patterns
- **Review types.ts**: Understand data structures before making changes

#### 2. Making Changes

**Always:**
- Use TypeScript with proper types
- Follow existing code style and patterns
- Test changes in development mode (`npm run dev`)
- Update relevant documentation
- Write clear commit messages

**Never:**
- Introduce security vulnerabilities (XSS, injection)
- Break existing functionality
- Remove important features without discussion
- Skip type definitions
- Use deprecated patterns

#### 3. Component Development

**Creating New Components:**
```tsx
// 1. Define types/interfaces first
interface MyComponentProps {
  title: string;
  onClick: () => void;
}

// 2. Create functional component
const MyComponent: React.FC<MyComponentProps> = ({ title, onClick }) => {
  return (
    <button onClick={onClick} className="...">
      {title}
    </button>
  );
};

// 3. Export
export default MyComponent;
```

**Using Existing Components:**
- Check `src/components/common/` for reusable components
- Import from `@/src/components/...`
- Follow existing prop patterns

#### 4. API Integration

**Adding New TMDB Endpoints:**
```typescript
// In src/services/tmdb.ts

export const getNewEndpoint = async (params: SomeType): Promise<ResponseType> => {
  try {
    const response = await axios.get(`${BASE_URL}/endpoint`, {
      params: { api_key: API_KEY, ...params }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};
```

#### 5. State Management

**When to Use:**
- **Local State (`useState`)**: Component-specific, temporary data
- **Context**: Shared data across multiple components (watchlist, settings)
- **localStorage**: Persistent data that survives page refresh

#### 6. Styling

**Use TailwindCSS classes:**
```tsx
<div className="bg-surface text-primary p-4 rounded-lg hover:bg-surface-hover">
  Content
</div>
```

**Common patterns:**
- Spacing: `p-4`, `m-4`, `gap-4`
- Flex: `flex`, `flex-col`, `items-center`, `justify-between`
- Grid: `grid`, `grid-cols-2`, `gap-4`
- Responsive: `sm:`, `md:`, `lg:`, `xl:`

#### 7. Error Handling

```tsx
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  console.error('Error:', error);
  toast.error('Failed to load data');
  // Show user-friendly error message
}
```

#### 8. Performance Optimization

**Lazy Loading:**
```tsx
import { lazy, Suspense } from 'react';
import Loader from './Loader';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

const App = () => (
  <Suspense fallback={<Loader />}>
    <HeavyComponent />
  </Suspense>
);
```

**Memoization:**
```tsx
import { useMemo, useCallback } from 'react';

const expensiveCalculation = useMemo(() => {
  return heavyComputation(data);
}, [data]);

const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

#### 9. Testing Approach

**Before committing:**
1. Test in development mode (`npm run dev`)
2. Test all affected routes/components
3. Test on mobile and desktop viewport
4. Check browser console for errors
5. Build production bundle (`npm run build`)
6. Preview production build (`npm run preview`)

#### 10. Documentation

**When making significant changes:**
- Update DOCUMENTATION.md with new features/fixes
- Add comments for complex logic
- Document breaking changes
- Update types.ts if data structures change

---

## Troubleshooting

### Common Issues

#### 1. Video Player Not Working

**Issue**: "Please Disable Sandbox" error

**Solution**: Remove `sandbox` attribute from iframe in `PlayerPage.tsx`

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

#### 2. Ad Popups Opening

**Issue**: Ads open in new tabs on video interaction

**Solution**: The ultra-aggressive ad blocker in `src/utils/adBlocker.ts` should handle this. Ensure:
- Ad blocker is initialized in `App.tsx`
- Aggressiveness is set to `'extreme'`
- Mobile detection is working correctly

#### 3. TMDB API Rate Limiting

**Issue**: API requests failing with 429 status

**Solution**:
- Use your own TMDB API key in `.env`
- Implement request debouncing/throttling
- Add caching for frequently accessed data

#### 4. Build Errors

**Issue**: TypeScript errors during build

**Solution**:
- Check `tsconfig.json` configuration
- Ensure all imports have proper types
- Run `npm install` to update dependencies
- Clear cache: `rm -rf node_modules dist && npm install`

#### 5. Hot Reload Not Working

**Issue**: Changes not reflecting in dev mode

**Solution**:
- Restart dev server
- Clear browser cache
- Check Vite config in `vite.config.ts`

---

## Critical Ad Blocker System

### Overview

The ad blocker (`src/utils/adBlocker.ts`) is a critical component that prevents popup ads and click hijacking. It implements 13 layers of protection.

### Key Features

1. **window.open Override**: Blocks all non-whitelisted window.open calls
2. **Click Interception**: Captures clicks in capture phase before ad scripts
3. **Timing Attack Prevention**: Blocks popups within 200ms of user interaction
4. **Download Blocking**: Prevents suspicious download attribute links
5. **Mobile Optimization**: Touch event handling for mobile devices
6. **First-Click Protection**: Extra protection on first 3 clicks
7. **Focus Recovery**: Auto-refocus when popup tries to steal focus
8. **DOM Sanitization**: Removes suspicious elements periodically
9. **Suspicious URL Detection**: Blocks known ad/betting domains
10. **Target Blank Blocking**: Prevents unauthorized target="_blank" links
11. **Blur Detection**: Detects and prevents popup-induced blur
12. **Visibility Monitoring**: Tracks tab visibility changes
13. **Context Menu Blocking**: Prevents right-click hijacking

### Configuration

```typescript
const adBlocker = createAdBlocker({
  enabled: true,
  aggressiveness: 'extreme', // 'low' | 'medium' | 'high' | 'extreme'
  onAdBlocked: () => {
    console.log('Ad blocked!');
  }
});

adBlocker.start();
```

### When Modifying

- **Test thoroughly**: Ads are creative and find new ways
- **Mobile testing**: Many ad techniques are mobile-specific
- **Performance**: Ensure changes don't impact performance
- **Console logging**: Keep for debugging ad behavior

---

## Version History

### Recent Major Changes

| Date | Commit | Description |
|------|--------|-------------|
| Dec 5, 2025 | d9723a0 | Add iframe click shield for Opera/rajbets ads |
| Dec 5, 2025 | 9e794fc | Implement ultra-aggressive ad blocker |
| Nov 30, 2025 | 14bef32 | Remove sandbox attribute for video playback |
| Oct 7, 2025 | 95f6529 | Rename project to FlixNest |
| Oct 6, 2025 | d77c16a | Implement lazy loading for performance |

---

## Additional Resources

### External Documentation

- [React 18 Docs](https://react.dev/)
- [React Router v6](https://reactrouter.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TMDB API Docs](https://developers.themoviedb.org/3)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

### Internal Documentation

- `README.md` - User-facing documentation
- `DOCUMENTATION.md` - Detailed developer documentation
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration

---

## Contact and Support

For issues, questions, or suggestions:
1. Check `DOCUMENTATION.md` for detailed technical information
2. Review recent git commits for context
3. Test changes thoroughly in development mode
4. Ask for clarification before making breaking changes

---

**Last Updated**: December 5, 2025
**Maintainers**: AI assistants working with this codebase should follow these guidelines strictly to maintain code quality and consistency.
