import React, { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ContentItem } from '../types';
import { toast } from 'react-toastify';

interface WatchlistContextType {
  watchlist: ContentItem[];
  addToWatchlist: (item: ContentItem) => void;
  removeFromWatchlist: (id: number) => void;
  isInWatchlist: (id: number) => boolean;
  clearWatchlist: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useLocalStorage<ContentItem[]>('watchlist', []);

  const addToWatchlist = useCallback((item: ContentItem) => {
    if (!watchlist.find(i => i.id === item.id)) {
      setWatchlist(prev => [...prev, item]);
      toast.success(`${'title' in item ? item.title : item.name} added to watchlist!`);
    } else {
      toast.info(`${'title' in item ? item.title : item.name} is already in your watchlist.`);
    }
  }, [watchlist, setWatchlist]);

  const removeFromWatchlist = useCallback((id: number) => {
    const item = watchlist.find(i => i.id === id);
    if (item) {
      setWatchlist(prev => prev.filter(i => i.id !== id));
      toast.error(`${'title' in item ? item.title : item.name} removed from watchlist.`);
    }
  }, [watchlist, setWatchlist]);

  const isInWatchlist = useCallback((id: number): boolean => {
    return watchlist.some(item => item.id === id);
  }, [watchlist]);

  const clearWatchlist = useCallback(() => {
    if (watchlist.length > 0) {
      setWatchlist([]);
      toast.success('Your watchlist has been cleared.');
    } else {
      toast.info('Your watchlist is already empty.');
    }
  }, [watchlist, setWatchlist]);

  const value = useMemo(() => ({
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    clearWatchlist
  }), [watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, clearWatchlist]);

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = (): WatchlistContextType => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};