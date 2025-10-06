import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './components/pages/HomePage';
import DetailPage from './components/pages/DetailPage';
import Player from './components/pages/PlayerPage';
import SearchPage from './components/pages/SearchPage';
import WatchlistPage from './components/pages/WatchlistPage';
import { WatchlistProvider } from './context/WatchlistContext';

const App: React.FC = () => {
  return (
    <WatchlistProvider>
      <HashRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/:type/:id" element={<DetailPage />} />
            <Route path="/play/:type/:id" element={<Player />} />
          </Routes>
        </AppLayout>
      </HashRouter>
    </WatchlistProvider>
  );
};

export default App;
