
import React, { createContext, useContext, ReactNode } from 'react';
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
}

const WatchedEpisodesContext = createContext<WatchedEpisodesContextType | undefined>(undefined);

export const WatchedEpisodesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [watchedEpisodes, setWatchedEpisodes] = useLocalStorage<WatchedEpisodes>('watchedEpisodes', {});

  const isEpisodeWatched = (tvId: string, season: number, episode: number): boolean => {
    return watchedEpisodes[tvId]?.[season]?.includes(episode) ?? false;
  };

  const toggleEpisodeWatched = (tvId: string, season: number, episode: number) => {
    setWatchedEpisodes(prev => {
      const newWatched = JSON.parse(JSON.stringify(prev));
      if (!newWatched[tvId]) {
        newWatched[tvId] = {};
      }
      if (!newWatched[tvId][season]) {
        newWatched[tvId][season] = [];
      }

      const seasonEpisodes = newWatched[tvId][season];
      const episodeIndex = seasonEpisodes.indexOf(episode);

      if (episodeIndex > -1) {
        seasonEpisodes.splice(episodeIndex, 1);
        toast.info(`Episode marked as unwatched.`);
      } else {
        seasonEpisodes.push(episode);
        toast.success(`Episode marked as watched!`);
      }

      return newWatched;
    });
  };

  return (
    <WatchedEpisodesContext.Provider value={{ watchedEpisodes, isEpisodeWatched, toggleEpisodeWatched }}>
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
