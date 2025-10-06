import React, { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { toast } from 'react-toastify';

type WatchedEpisodes = {
  [tvId: string]: {
    [season: number]: number[]; // array of episode numbers
  };
};

interface WatchedEpisodesContextType {
  watchedEpisodes: WatchedEpisodes;
  isEpisodeWatched: (tvId: string, season: number, episode: number) => boolean;
  toggleEpisodeWatched: (tvId: string, season: number, episode: number) => void;
  clearWatchedHistory: () => void;
}

const WatchedEpisodesContext = createContext<WatchedEpisodesContextType | undefined>(undefined);

export const WatchedEpisodesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [watchedEpisodes, setWatchedEpisodes] = useLocalStorage<WatchedEpisodes>('watchedEpisodes', {});

  const isEpisodeWatched = useCallback((tvId: string, season: number, episode: number): boolean => {
    return watchedEpisodes[tvId]?.[season]?.includes(episode) ?? false;
  }, [watchedEpisodes]);

  const toggleEpisodeWatched = useCallback((tvId: string, season: number, episode: number) => {
    const alreadyWatched = isEpisodeWatched(tvId, season, episode);

    setWatchedEpisodes(prev => {
      // Deep copy to avoid mutation
      const newWatched = JSON.parse(JSON.stringify(prev));
      const seasonEpisodes = newWatched[tvId]?.[season] || [];

      if (alreadyWatched) {
        // Remove episode
        newWatched[tvId][season] = seasonEpisodes.filter(e => e !== episode);
      } else {
        // Add episode
        if (!newWatched[tvId]) newWatched[tvId] = {};
        newWatched[tvId][season] = [...seasonEpisodes, episode].sort((a,b) => a - b);
      }
      return newWatched;
    });

    if (alreadyWatched) {
      toast.info(`Episode marked as unwatched.`);
    } else {
      toast.success(`Episode marked as watched!`);
    }
  }, [watchedEpisodes, setWatchedEpisodes, isEpisodeWatched]);
  
  const clearWatchedHistory = useCallback(() => {
    if (Object.keys(watchedEpisodes).length > 0) {
      setWatchedEpisodes({});
      toast.success('Your watch history has been cleared.');
    } else {
      toast.info('Your watch history is already empty.');
    }
  }, [watchedEpisodes, setWatchedEpisodes]);

  const value = useMemo(() => ({
    watchedEpisodes,
    isEpisodeWatched,
    toggleEpisodeWatched,
    clearWatchedHistory
  }), [watchedEpisodes, isEpisodeWatched, toggleEpisodeWatched, clearWatchedHistory]);

  return (
    <WatchedEpisodesContext.Provider value={value}>
      {children}
    </WatchedEpisodesContext.Provider>
  );
};

export const useWatchedEpisodes = (): WatchedEpisodesContextType => {
  const context = useContext(WatchedEpisodesContext);
  if (context === undefined) {
    throw new Error('useWatchedEpisodes must be used within a WatchedEpisodesProvider');
  }
  return context;
};