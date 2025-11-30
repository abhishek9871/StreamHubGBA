import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { tmdbService } from '../../../services/tmdb';
import type { TVShowDetails, SeasonDetails } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { useWatchlist } from '../../../context/WatchlistContext';
import { useWatchedEpisodes } from '../../../context/WatchedEpisodesContext';
import Loader from '../../common/Loader';
import ContentCarousel from '../Home/ContentCarousel';
import { FaPlay, FaPlus, FaCheck, FaStar, FaTimes, FaCheckCircle, FaChevronDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const TVDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<TVShowDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState<{ season: number; episode: number }>({ season: 1, episode: 1 });
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const { isEpisodeWatched, toggleEpisodeWatched } = useWatchedEpisodes();
  const lastBlurTime = useRef<number>(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(event.target as Node)) {
        setIsSeasonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Popup/Ad blocker - always active when component is mounted
  useEffect(() => {
    const handleBlur = () => {
      const now = Date.now();
      if (now - lastBlurTime.current > 500) {
        lastBlurTime.current = now;
        setTimeout(() => window.focus(), 100);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTimeout(() => window.focus(), 100);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const fetchShow = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setIsPlaying(false);
      try {
        const data = await tmdbService.getTVShowDetails(id);
        setShow(data);
        if (data.seasons && data.seasons.length > 0) {
          const initialSeason = data.seasons.find(s => s.season_number > 0)?.season_number || 1;
          setSelectedSeason(initialSeason);
        }
      } catch (err) {
        setError('Failed to fetch show details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchShow();
  }, [id]);

  useEffect(() => {
    const fetchSeason = async () => {
      if (!id || !show) return;
      setSeasonLoading(true);
      try {
        const data = await tmdbService.getSeasonDetails(id, selectedSeason);
        setSeasonDetails(data);
      } catch (err) {
        console.error(`Failed to fetch season ${selectedSeason}`, err);
      } finally {
        setSeasonLoading(false);
      }
    };
    fetchSeason();
  }, [id, show, selectedSeason]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-error">
        {error || 'TV Show not found.'}
      </div>
    );
  }

  const inWatchlist = isInWatchlist(show.id);
  const firstAirYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'N/A';
  const streamUrl = `https://vidsrc.cc/v2/embed/tv/${show.id}/${currentEpisode.season}/${currentEpisode.episode}?autoplay=1&autonext=1`;

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(show.id);
    } else {
      addToWatchlist({ ...show, media_type: 'tv' });
    }
  };

  const playEpisode = (season: number, episode: number) => {
    setCurrentEpisode({ season, episode });
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Episode navigation logic
  const totalEpisodes = seasonDetails?.episodes?.length || 0;
  const hasPreviousEpisode = currentEpisode.episode > 1;
  const hasNextEpisode = currentEpisode.episode < totalEpisodes;
  
  const currentEpisodeData = seasonDetails?.episodes?.find(
    ep => ep.episode_number === currentEpisode.episode
  );
  const nextEpisodeData = seasonDetails?.episodes?.find(
    ep => ep.episode_number === currentEpisode.episode + 1
  );
  const prevEpisodeData = seasonDetails?.episodes?.find(
    ep => ep.episode_number === currentEpisode.episode - 1
  );

  const goToPreviousEpisode = () => {
    if (hasPreviousEpisode) {
      playEpisode(currentEpisode.season, currentEpisode.episode - 1);
    }
  };

  const goToNextEpisode = () => {
    if (hasNextEpisode) {
      playEpisode(currentEpisode.season, currentEpisode.episode + 1);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Netflix-style Hero Section */}
      <div className="relative w-full" style={{ height: isPlaying ? '56.25vw' : '70vh', maxHeight: isPlaying ? '80vh' : '70vh' }}>
        
        {isPlaying ? (
          <>
            {/* Inline Video Player */}
            <iframe
              src={streamUrl}
              className="absolute inset-0 w-full h-full"
              title={show.name}
              frameBorder="0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
            />
            
            {/* Close button overlay */}
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-4 right-4 z-20 p-3 rounded-full bg-surface/80 hover:bg-surface text-text-primary transition-colors"
            >
              <FaTimes size={18} />
            </button>
          </>
        ) : (
          <>
            {/* Backdrop Image */}
            {show.backdrop_path && (
              <img
                src={`${TMDB_IMAGE_BASE_URL}/original${show.backdrop_path}`}
                alt={show.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
            )}
            
            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-bg-primary/30" />
            
            {/* Content Overlay */}
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4 md:px-8 lg:px-16">
                <div className="max-w-2xl space-y-4">
                  {/* Title */}
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading text-white drop-shadow-lg">
                    {show.name}
                  </h1>
                  
                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-sm md:text-base text-white/90">
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <FaStar className="text-yellow-400" /> {show.vote_average.toFixed(1)}
                    </span>
                    <span className="text-white/60">|</span>
                    <span>{firstAirYear}</span>
                    <span className="text-white/60">|</span>
                    <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}</span>
                    <span className="px-2 py-0.5 border border-white/40 rounded text-xs">HD</span>
                  </div>
                  
                  {/* Genres */}
                  <div className="flex flex-wrap gap-2">
                    {show.genres.slice(0, 4).map(genre => (
                      <span key={genre.id} className="text-sm text-white/80">
                        {genre.name}
                        {genre !== show.genres.slice(0, 4).at(-1) && <span className="ml-2">•</span>}
                      </span>
                    ))}
                  </div>
                  
                  {/* Overview */}
                  <p className="text-white/80 text-sm md:text-base line-clamp-3 max-w-xl">
                    {show.overview}
                  </p>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={() => playEpisode(selectedSeason, 1)}
                      className="flex items-center gap-2 px-6 md:px-8 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-md transition-colors text-lg"
                    >
                      <FaPlay /> Play
                    </button>
                    <button
                      onClick={handleWatchlistToggle}
                      className="flex items-center gap-2 px-6 md:px-8 py-3 bg-gray-500/70 hover:bg-gray-500/90 text-white font-semibold rounded-md transition-colors"
                    >
                      {inWatchlist ? <FaCheck /> : <FaPlus />}
                      {inWatchlist ? 'Added' : 'My List'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Episode Navigation Bar - Outside player, only shows when playing */}
      {isPlaying && (hasPreviousEpisode || hasNextEpisode) && (
        <div className="bg-bg-secondary border-b border-white/10">
          <div className="container mx-auto px-4 md:px-8 lg:px-16 py-3">
            <div className="flex items-center justify-between">
              {/* Current Episode Info */}
              <p className="text-white/70 text-sm">
                S{currentEpisode.season} E{currentEpisode.episode}
                {currentEpisodeData && <span className="hidden sm:inline"> • {currentEpisodeData.name}</span>}
              </p>
              
              {/* Navigation Buttons */}
              <div className="flex items-center gap-3">
                {/* Previous Episode Button */}
                {hasPreviousEpisode && (
                  <button
                    onClick={goToPreviousEpisode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-white text-sm font-medium transition-all duration-200"
                  >
                    <FaChevronLeft size={10} />
                    <span>E{currentEpisode.episode - 1}</span>
                  </button>
                )}
                
                {/* Next Episode Button */}
                {hasNextEpisode && (
                  <button
                    onClick={goToNextEpisode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-white text-sm font-medium transition-all duration-200"
                  >
                    <span>E{currentEpisode.episode + 1}</span>
                    <FaChevronRight size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="container mx-auto px-4 md:px-8 lg:px-16 py-8">
        
        {/* Episodes Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Episodes</h2>
            {show.seasons && show.seasons.length > 0 && (
              <div className="relative" ref={seasonDropdownRef}>
                {/* Dropdown trigger button */}
                <button
                  onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                  className="flex items-center gap-3 bg-transparent border-2 border-white/30 hover:border-white/50 rounded px-4 py-2.5 text-white font-medium transition-all duration-200 min-w-[140px] justify-between"
                >
                  <span>Season {selectedSeason}</span>
                  <FaChevronDown 
                    className={`transition-transform duration-200 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} 
                    size={12} 
                  />
                </button>
                
                {/* Dropdown menu */}
                {isSeasonDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl z-50 min-w-[160px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                      {show.seasons.filter(s => s.season_number > 0).map(season => (
                        <button
                          key={season.id}
                          onClick={() => {
                            setSelectedSeason(season.season_number);
                            setIsSeasonDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between ${
                            selectedSeason === season.season_number
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>Season {season.season_number}</span>
                          {selectedSeason === season.season_number && (
                            <FaCheck size={12} className="text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {seasonLoading ? (
            <div className="flex justify-center items-center h-48"><Loader /></div>
          ) : (
            <div className="space-y-3">
              {seasonDetails?.episodes?.map(episode => (
                <div 
                  key={episode.id}
                  className="flex gap-4 p-3 rounded-lg bg-surface/50 hover:bg-surface transition-colors group cursor-pointer"
                  onClick={() => playEpisode(selectedSeason, episode.episode_number)}
                >
                  {/* Episode Thumbnail */}
                  <div className="relative w-32 md:w-44 flex-shrink-0 aspect-video rounded overflow-hidden bg-surface">
                    {episode.still_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE_URL}/w300${episode.still_path}`}
                        alt={episode.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        No Image
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaPlay className="text-white text-2xl" />
                    </div>
                  </div>
                  
                  {/* Episode Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-accent-primary transition-colors">
                          {episode.episode_number}. {episode.name}
                        </h3>
                        <p className="text-sm text-text-muted mt-1">
                          {episode.air_date && new Date(episode.air_date).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEpisodeWatched(String(show.id), selectedSeason, episode.episode_number);
                        }}
                        className={`p-2 rounded-full transition-colors ${
                          isEpisodeWatched(String(show.id), selectedSeason, episode.episode_number)
                            ? 'text-green-500'
                            : 'text-text-muted hover:text-white'
                        }`}
                      >
                        <FaCheckCircle size={20} />
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary mt-2 line-clamp-2 hidden md:block">
                      {episode.overview || 'No description available.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* About Section */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">About {show.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <p className="text-text-secondary leading-relaxed">{show.overview}</p>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-text-muted">Genres:</span> <span className="text-white">{show.genres.map(g => g.name).join(', ')}</span></p>
              <p><span className="text-text-muted">First Air:</span> <span className="text-white">{show.first_air_date}</span></p>
              <p><span className="text-text-muted">Seasons:</span> <span className="text-white">{show.number_of_seasons}</span></p>
              <p><span className="text-text-muted">Episodes:</span> <span className="text-white">{show.number_of_episodes}</span></p>
            </div>
          </div>
        </div>

        {/* Similar Shows */}
        {show.similar?.results && show.similar.results.length > 0 && (
          <div className="mb-8">
            <ContentCarousel title="More Like This" items={show.similar.results} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TVDetail;