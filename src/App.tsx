
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Home from './components/pages/Home/Home';
import MovieDetail from './components/pages/MovieDetail/MovieDetail';
import TVDetail from './components/pages/TVDetail/TVDetail';
import Player from './components/pages/PlayerPage';
import SearchPage from './components/pages/SearchPage';
import WatchlistPage from './components/pages/WatchlistPage';
import SettingsPage from './components/pages/Settings/Settings';
import { WatchlistProvider } from './context/WatchlistContext';
import { WatchedEpisodesProvider } from './context/WatchedEpisodesContext';

const App: React.FC = () => {
  return (
    <WatchlistProvider>
      <WatchedEpisodesProvider>
        <HashRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/movie/:id" element={<MovieDetail />} />
              <Route path="/tv/:id" element={<TVDetail />} />
              <Route path="/play/:type/:id" element={<Player />} />
            </Routes>
          </AppLayout>
        </HashRouter>
      </WatchedEpisodesProvider>
    </WatchlistProvider>
  );
};

export default App;
