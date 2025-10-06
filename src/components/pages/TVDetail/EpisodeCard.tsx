
import React from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaEye, FaEyeSlash } from 'react-icons/fa';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import type { Episode } from '../../../types';
import { useWatchedEpisodes } from '../../../context/WatchedEpisodesContext';

interface EpisodeCardProps {
  episode: Episode;
  tvId: number;
  seasonNumber: number;
}

const EpisodeCard: React.FC<EpisodeCardProps> = ({ episode, tvId, seasonNumber }) => {
  const { isEpisodeWatched, toggleEpisodeWatched } = useWatchedEpisodes();
  const isWatched = isEpisodeWatched(String(tvId), seasonNumber, episode.episode_number);
  
  const stillUrl = episode.still_path
    ? `${TMDB_IMAGE_BASE_URL}/w300${episode.still_path}`
    : 'https://picsum.photos/300/169?grayscale';

  return (
    <div className="bg-surface rounded-lg overflow-hidden shadow-lg flex flex-col">
      <div className="relative group">
        <img src={stillUrl} alt={episode.name} className="w-full object-cover aspect-video" loading="lazy" />
        <Link 
          to={`/play/tv/${tvId}?season=${seasonNumber}&episode=${episode.episode_number}`} 
          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center"
        >
          <FaPlay className="text-white text-4xl opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300" />
        </Link>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-text-primary pr-2">
                {episode.episode_number}. {episode.name}
            </h3>
            <button 
                onClick={() => toggleEpisodeWatched(String(tvId), seasonNumber, episode.episode_number)}
                className="text-text-secondary hover:text-accent-primary transition-colors flex-shrink-0"
                aria-label={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
            >
                {isWatched ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
            </button>
        </div>
        <p className="text-xs text-text-secondary line-clamp-3 flex-grow">{episode.overview || "No overview available."}</p>
        {episode.air_date && (
            <p className="text-xs text-text-muted mt-2 self-start">{new Date(episode.air_date).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
};

export default EpisodeCard;
