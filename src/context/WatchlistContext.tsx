
import React, { createContext, useContext, ReactNode } from 'react';
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

  const addToWatchlist = (item: ContentItem) => {
    if (!watchlist.find(i => i.id === item.id)) {
      setWatchlist([...watchlist, item]);
      // FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type.
      toast.success(`${'title' in item ? item.title : item.name} added to watchlist!`);
    } else {
      // FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type.
      toast.info(`${'title' in item ? item.title : item.name} is already in your watchlist.`);
    }
  };

  const removeFromWatchlist = (id: number) => {
    const item = watchlist.find(i => i.id === id);
    setWatchlist(watchlist.filter(item => item.id !== id));
     if(item) {
        // FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type.
        toast.error(`${'title' in item ? item.title : item.name} removed from watchlist.`);
     }
  };

  const isInWatchlist = (id: number): boolean => {
    return watchlist.some(item => item.id === id);
  };

  const clearWatchlist = () => {
    setWatchlist([]);
    toast.success('Your watchlist has been cleared.');
  };

  return (
    <WatchlistContext.Provider value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, clearWatchlist }}>
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
