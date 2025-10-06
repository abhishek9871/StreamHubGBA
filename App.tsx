
import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import HomePage from './components/pages/HomePage';
import DetailPage from './components/pages/DetailPage';
import PlayerPage from './components/pages/PlayerPage';
import SearchPage from './components/pages/SearchPage';
import WatchlistPage from './components/pages/WatchlistPage';
import { WatchlistProvider } from './context/WatchlistContext';

const Layout: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const location = useLocation();
    const isPlayerPage = location.pathname.startsWith('/play');

    return (
        <>
            {!isPlayerPage && <Header />}
            <main className={!isPlayerPage ? 'pt-16' : ''}>
                {children}
            </main>
        </>
    );
};


const App: React.FC = () => {
  return (
    <WatchlistProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/:type/:id" element={<DetailPage />} />
            <Route path="/play/:type/:id" element={<PlayerPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </WatchlistProvider>
  );
};

export default App;
