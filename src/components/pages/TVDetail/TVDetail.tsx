
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tmdbService } from '../../../services/tmdb';
import type { TVShowDetails, SeasonDetails } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { useWatchlist } from '../../../context/WatchlistContext';
import Loader from '../../common/Loader';
import Button from '../../common/Button';
import ContentCarousel from '../Home/ContentCarousel';
import EpisodeCard from './EpisodeCard';
import { FaPlay, FaHeart, FaRegHeart, FaStar, FaCalendarAlt, FaHashtag } from 'react-icons/fa';

const TVDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [show, setShow] = useState<TVShowDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  useEffect(() => {
    const fetchShow = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
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
    return <div className="min-h-screen flex items-center justify-center"><Loader /></div>;
  }

  if (error || !show) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error || 'TV Show not found.'}</div>;
  }

  const inWatchlist = isInWatchlist(show.id);
  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(show.id);
    } else {
      addToWatchlist({ ...show, media_type: 'tv' });
    }
  };
  
  const firstAirYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'N/A';

  const playFirstEpisode = () => {
    if(seasonDetails?.episodes && seasonDetails.episodes.length > 0) {
      navigate(`/play/tv/${show.id}?season=${selectedSeason}&episode=1`);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Hero Section */}
      <div className="relative h-[50vh] md:h-[70vh]">
        {show.backdrop_path && (
            <img
            src={`${TMDB_IMAGE_BASE_URL}/original${show.backdrop_path}`}
            alt={show.name}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/80 to-transparent"></div>
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col md:flex-row items-end pb-8 gap-8">
          <div className="w-48 md:w-64 flex-shrink-0 -mb-16 md:mb-0">
            {show.poster_path && (
                <img
                    src={`${TMDB_IMAGE_BASE_URL}/w500${show.poster_path}`}
                    alt={show.name}
                    className="rounded-lg shadow-2xl"
                />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-5xl font-bold font-heading">{show.name}</h1>
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-text-secondary">
              <div className="flex items-center gap-1"><FaStar className="text-yellow-400" /> {show.vote_average.toFixed(1)}</div>
              <div className="flex items-center gap-1"><FaCalendarAlt /> {firstAirYear}</div>
              <div className="flex items-center gap-1"><FaHashtag /> {show.number_of_seasons} Seasons</div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {show.genres.map(genre => (
                <span key={genre.id} className="text-xs bg-surface px-2 py-1 rounded">{genre.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="flex flex-col md:flex-row gap-8">
           <div className="w-full md:w-2/3">
              <h2 className="text-2xl font-bold font-heading mb-4">Overview</h2>
              <p className="text-text-secondary leading-relaxed mb-8">{show.overview}</p>
           </div>
           <div className="w-full md:w-1/3">
              <div className="flex flex-col gap-4">
                  <Button variant="primary" size="lg" fullWidth icon={FaPlay} onClick={playFirstEpisode}>
                      Play S{selectedSeason} E1
                  </Button>
                  <Button variant="outline" size="lg" fullWidth icon={inWatchlist ? FaHeart : FaRegHeart} onClick={handleWatchlistToggle}>
                      {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  </Button>
              </div>
           </div>
        </div>
        
        {/* Seasons and Episodes */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold font-heading">Seasons & Episodes</h2>
            {show.seasons && show.seasons.length > 0 && (
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="bg-surface border border-surface-hover rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {show.seasons.filter(s => s.season_number > 0).map(season => (
                  <option key={season.id} value={season.season_number}>
                    {season.name} ({season.episode_count} episodes)
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {seasonLoading ? (
            <div className="flex justify-center items-center h-64"><Loader /></div>
          ) : (
            seasonDetails?.episodes && seasonDetails.episodes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {seasonDetails.episodes.map(episode => (
                  <EpisodeCard key={episode.id} episode={episode} tvId={show.id} seasonNumber={selectedSeason} />
                ))}
              </div>
            ) : (
              <p className="text-text-secondary">No episodes found for this season.</p>
            )
          )}
        </div>
         
         {show.similar?.results && show.similar.results.length > 0 && (
            <div className="mt-12">
                <ContentCarousel title="Similar Shows" items={show.similar.results} />
            </div>
         )}
      </div>
    </div>
  );
};

export default TVDetail;
