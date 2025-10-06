import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { WatchlistProvider } from './context/WatchlistContext';
import { WatchedEpisodesProvider } from './context/WatchedEpisodesContext';
import Loader from './components/common/Loader';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy load page components for performance optimization
const Home = lazy(() => import('./components/pages/Home/Home'));
const MovieDetail = lazy(() => import('./components/pages/MovieDetail/MovieDetail'));
const TVDetail = lazy(() => import('./components/pages/TVDetail/TVDetail'));
const Player = lazy(() => import('./components/pages/PlayerPage'));
const SearchPage = lazy(() => import('./components/pages/SearchPage'));
const WatchlistPage = lazy(() => import('./components/pages/WatchlistPage'));
const SettingsPage = lazy(() => import('./components/pages/Settings/Settings'));

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WatchlistProvider>
        <WatchedEpisodesProvider>
          <HashRouter>
            <AppLayout>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader /></div>}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/movie/:id" element={<MovieDetail />} />
                  <Route path="/tv/:id" element={<TVDetail />} />
                  <Route path="/play/:type/:id" element={<Player />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </HashRouter>
        </WatchedEpisodesProvider>
      </WatchlistProvider>
    </ErrorBoundary>
  );
};

export default App;
